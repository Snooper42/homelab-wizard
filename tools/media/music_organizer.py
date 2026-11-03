#!/usr/bin/env python3
"""
Music organizer for a Navidrome homelab.

Fixes tags, keeps albums together, folds genres into a few broad ones, adds missing artwork, and
lays everything out as Artist/Album (Year)/01 Title. Your original files are never modified: the
cleaned library is built in a hidden folder next to them and swapped in only when you say so.

  python3 music_organizer.py init            find the library, Navidrome and beets; save the settings
  python3 music_organizer.py status          where things stand (--json for an app)
  python3 music_organizer.py scan            look first; changes nothing
  python3 music_organizer.py run             build the cleaned library (hours, for a big library)
  python3 music_organizer.py finalize        pause Navidrome & co, back them up, swap, start again
  python3 music_organizer.py verify          check every song made it across
  python3 music_organizer.py genres          list songs whose genre isn't one of yours (--apply fixes them)
  python3 music_organizer.py undo            put the original library back
  python3 music_organizer.py delete-backup   free the space once you're happy
  Added lots of music since?                 run --start-over (after delete-backup)

The heavy lifting uses beets. If Docker has a beets image (e.g. linuxserver/beets), it runs in a
throwaway container from that image, with every folder at the same path as on this machine, so
nothing needs installing here. Otherwise beets is installed once into ~/.music-cleanup/venv.

For apps: --events json prints one JSON object per line (steps, progress, results); anything that
asks a question needs --yes; exit codes are 0 ok, 1 error, 2 verify found missing songs, 130 stopped.
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

# ============================================================== screen, log and app events
# On screen: progress bars and tidy status lines. On disk: a timestamped log.
# For an app: HOMELAB_MEDIA_EVENTS=json (or --events json) prints one JSON object per line instead:
#   {"type": "title"|"step"|"progress"|"working"|"ok"|"warn"|"fail"|"info"|"kv"|"cmd"|"result", ...}
import threading
import traceback

_ANSI = re.compile(r"\033\[[0-9;]*m")


def fmt_n(n):
    return "{:,}".format(n)


def fmt_time(sec):
    sec = int(max(0, sec))
    if sec < 60:
        return "%ds" % sec
    if sec < 3600:
        return "%dm %02ds" % (sec // 60, sec % 60)
    return "%dh %02dm" % (sec // 3600, sec % 3600 // 60)


def pretty_path(p):
    p, home = str(p), str(Path.home())
    return "~" + p[len(home):] if p == home or p.startswith(home + os.sep) else p


def shell_arg(p):
    """A path the way you'd type it in Terminal."""
    s = pretty_path(p)
    if re.fullmatch(r"[\w~/.\-]+", s):
        return s
    return '"%s"' % str(p).replace('"', '\\"')


def plain(t):
    return _ANSI.sub("", str(t))


def disp_width(s):
    """Columns a string takes in Terminal: Japanese, Chinese, Korean and emoji take two."""
    import unicodedata
    return sum(0 if unicodedata.combining(c) else 2 if unicodedata.east_asian_width(c) in "WF" else 1
               for c in plain(s))


def clip(s, cols):
    """Cut a string to fit in a number of Terminal columns."""
    if disp_width(s) <= cols:
        return s
    import unicodedata
    out, used = "", 0
    for c in s:
        w = 0 if unicodedata.combining(c) else 2 if unicodedata.east_asian_width(c) in "WF" else 1
        if used + w > cols - 1:
            break
        out, used = out + c, used + w
    return out + "…"


class UI:
    def __init__(self):
        self.events = False
        self.tty = sys.stdout.isatty()
        self.color = self.tty and not os.environ.get("NO_COLOR") and os.environ.get("TERM") != "dumb"
        self.log = None
        self.lock = threading.RLock()
        self.live = False
        self.started = time.time()
        if os.environ.get("HOMELAB_MEDIA_EVENTS") == "json":
            self.use_events()

    def use_events(self):
        self.events, self.tty, self.color = True, False, False
        os.environ["HOMELAB_MEDIA_EVENTS"] = "json"  # passed on to the engine container too

    def emit(self, kind, **data):
        data = dict(type=kind, **{k: plain(v) if isinstance(v, str) else v for k, v in data.items()})
        with self.lock:
            sys.stdout.write(json.dumps(data, ensure_ascii=False, default=str) + "\n")
            sys.stdout.flush()

    def open_log(self, path, banner):
        try:
            Path(path).parent.mkdir(parents=True, exist_ok=True)
            self.log = open(str(path), "a", encoding="utf-8")
            self.log.write("\n")
            self.to_log("=" * 64)
            self.to_log(banner)
            self.to_log("=" * 64)
        except OSError:
            self.log = None

    def paint(self, text, code):
        return "\033[%sm%s\033[0m" % (code, text) if self.color else text

    def bold(self, t):
        return self.paint(t, "1")

    def dim(self, t):
        return self.paint(t, "2")

    def green(self, t):
        return self.paint(t, "32")

    def yellow(self, t):
        return self.paint(t, "33")

    def red(self, t):
        return self.paint(t, "31")

    def cyan(self, t):
        return self.paint(t, "36")

    def to_log(self, text):
        if self.log:
            stamp = time.strftime("%Y-%m-%d %H:%M:%S")
            for line in (plain(text).splitlines() or [""]):
                self.log.write("%s  %s\n" % (stamp, line))
            self.log.flush()

    def clear_live(self):
        with self.lock:
            if self.live:
                sys.stdout.write("\r\033[2K")
                sys.stdout.flush()
                self.live = False

    def live_line(self, text):
        if self.events:
            return
        with self.lock:
            sys.stdout.write("\r\033[2K" + text)
            sys.stdout.flush()
            self.live = True

    def line(self, screen, log=None, kind="info", **data):
        if self.events:
            if data or plain(screen).strip():
                self.emit(kind, **(data or {"text": plain(screen).strip()}))
        else:
            with self.lock:
                self.clear_live()
                sys.stdout.write(screen + "\n")
                sys.stdout.flush()
        if log is not None:
            self.to_log(log)

    def title(self, text, sub=""):
        head = text + ("  ·  " + sub if sub else "")
        self.line("\n  " + self.bold(text) + (self.dim("  ·  " + sub) if sub else ""), head,
                  kind="title", text=text, sub=sub)
        if not self.events:
            self.line("  " + self.dim("─" * len(head)))

    def step(self, n, total, text):
        self.line("\n" + self.cyan("[%d/%d]" % (n, total)) + " " + self.bold(text),
                  "[%d/%d] %s" % (n, total, text), kind="step", n=n, total=total, text=text)

    def say(self, text="", log=True):
        self.line(("  " + text) if text else "", text if log else None)

    def ok(self, text):
        self.line("  " + self.green("✓") + " " + text, "OK     " + text, kind="ok", text=text)

    def warn(self, text):
        self.line("  " + self.yellow("!") + " " + text, "NOTE   " + text, kind="warn", text=text)

    def fail(self, text):
        self.line("  " + self.red("✗") + " " + text, "ERROR  " + text, kind="fail", text=text)

    def kv(self, label, value, width=16):
        self.line("  " + self.dim(label.ljust(width)) + " " + str(value),
                  "%s %s" % (label.ljust(width), plain(value)), kind="kv", label=label.strip(), value=str(value))

    def cmd(self, text):
        self.line("    " + self.cyan(text), "       " + text, kind="cmd", text=text)

    def result(self, **data):
        """The machine-readable outcome of a command (only shown in events mode)."""
        self.to_log("RESULT " + json.dumps(data, default=str))
        if self.events:
            self.emit("result", **data)

    def rule(self, width=0):
        if self.events:
            return
        width = width or min(72, shutil.get_terminal_size((80, 20)).columns - 4)
        self.line("  " + self.dim("─" * width))

    def progress(self, total, label):
        return Progress(self, total, label)

    def spinner(self, label):
        return Spinner(self, label)


class Progress:
    """with ui.progress(total, "Copying") as bar: ... bar.update(note="file.m4a")"""
    def __init__(self, ui, total, label):
        self.ui, self.total, self.label = ui, max(int(total), 0), label
        self.done, self.note, self.summary = 0, "", None
        self.start = self.last_draw = 0.0
        self.milestone = 25

    def __enter__(self):
        self.start = time.time()
        self.ui.to_log("       %s: %s to do" % (self.label, fmt_n(self.total)))
        self.draw(force=True)
        self._stop = threading.Event()
        self._tick = None
        if self.ui.tty:  # keep the clock moving even while waiting on a slow item
            self._tick = threading.Thread(target=self._ticker)
            self._tick.daemon = True
            self._tick.start()
        return self

    def _ticker(self):
        while not self._stop.wait(1.0):
            self.draw(force=True)

    def update(self, n=1, note=None, done=None):
        self.done = done if done is not None else self.done + n
        if self.total:
            self.done = max(0, min(self.done, self.total))
        if note is not None:
            self.note = note
        self.draw()

    def draw(self, force=False):
        with self.ui.lock:
            self._draw(force)

    def _draw(self, force=False):
        now = time.time()
        if self.ui.events:  # at most twice a second, so the app isn't flooded
            if force or now - self.last_draw >= 0.5 or self.done == self.total:
                self.last_draw = now
                self.ui.emit("progress", label=self.label, done=self.done, total=self.total, note=self.note,
                             elapsed=round(now - self.start, 1))
            return
        if not force and now - self.last_draw < 0.1:
            return
        self.last_draw = now
        pct = (self.done / float(self.total)) if self.total else 1.0
        if not self.ui.tty:  # piped to a file: a line every 25% instead of a bar
            while pct * 100 >= self.milestone and self.milestone < 100:
                self.ui.line("  %s %d%%  (%s of %s)" % (self.label, self.milestone,
                                                       fmt_n(self.done), fmt_n(self.total)))
                self.milestone += 25
            return
        cols = shutil.get_terminal_size((80, 20)).columns
        width = max(10, min(30, cols - 58))
        filled = int(round(width * pct))
        bar = self.ui.green("█" * filled) + self.ui.dim("░" * (width - filled))
        elapsed = now - self.start
        if self.done and elapsed > 3 and self.done < self.total:
            eta = "~%s left" % fmt_time(elapsed / self.done * (self.total - self.done))
        elif not self.done and self.total:
            eta = "working… %s" % fmt_time(elapsed)
        else:
            eta = fmt_time(elapsed)
        text = "  %-12s %s %s/%s %3d%%  %s" % (self.label, bar, fmt_n(self.done), fmt_n(self.total),
                                               pct * 100, self.ui.dim(eta))
        room = cols - disp_width(text) - 3
        if self.note and room > 8:
            text += "  " + self.ui.dim(clip(self.note, room))
        self.ui.live_line(text)

    def __exit__(self, exc_type, exc, tb):
        self._stop.set()
        if self._tick:
            self._tick.join()
        if exc_type is not None:
            self.ui.clear_live()
            self.ui.to_log("       %s: stopped at %s of %s" % (self.label, fmt_n(self.done), fmt_n(self.total)))
            return False
        msg = self.summary or "%s: %s done" % (self.label, fmt_n(self.done))
        took = time.time() - self.start
        self.ui.line("  " + self.ui.green("✓") + " " + msg + self.ui.dim(" · took %s" % fmt_time(took)),
                     "OK     " + msg + " · took %s" % fmt_time(took), kind="ok", text=msg, took=round(took, 1))
        return False


class Spinner:
    """with ui.spinner("Saving tags") as s: ...   (for steps with no countable progress)"""
    FRAMES = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"

    def __init__(self, ui, label):
        self.ui, self.label, self.summary = ui, label, None
        self.stop = threading.Event()
        self.thread = None
        self.start = 0.0

    def __enter__(self):
        self.start = time.time()
        self.ui.to_log("       %s..." % self.label)
        if self.ui.events:
            self.ui.emit("working", label=self.label)
        elif self.ui.tty:
            self.thread = threading.Thread(target=self._spin)
            self.thread.daemon = True
            self.thread.start()
        return self

    def _spin(self):
        i = 0
        cols = shutil.get_terminal_size((80, 20)).columns
        while not self.stop.wait(0.1):
            self.ui.live_line("  %s %s  %s" % (self.ui.cyan(self.FRAMES[i % len(self.FRAMES)]),
                                               clip(self.label, cols - 16),
                                               self.ui.dim(fmt_time(time.time() - self.start))))
            i += 1

    def __exit__(self, exc_type, exc, tb):
        self.stop.set()
        if self.thread:
            self.thread.join()
        if exc_type is not None:
            self.ui.clear_live()
            return False
        msg = self.summary or self.label
        took = time.time() - self.start
        self.ui.line("  " + self.ui.green("✓") + " " + msg + self.ui.dim(" · took %s" % fmt_time(took)),
                     "OK     " + msg + " · took %s" % fmt_time(took), kind="ok", text=msg, took=round(took, 1))
        return False


ui = UI()


def die(msg, hint=None, code=1):
    ui.fail(msg)
    if hint:
        for h in hint.splitlines():
            ui.say(h)
    sys.exit(code)


def run_main(main):
    try:
        main()
    except KeyboardInterrupt:
        ui.clear_live()
        ui.line("")
        ui.warn("Stopped. Run the same command again to carry on where it left off.")
        sys.stdout.flush()
        os._exit(130)  # don't wait for lookups still in flight
    except SystemExit:
        raise
    except Exception as e:  # anything unexpected: short message on screen, full details in the log
        ui.clear_live()
        ui.fail("Something unexpected went wrong: %s" % e)
        ui.to_log(traceback.format_exc())
        if ui.log:
            ui.say("The details are in %s." % pretty_path(ui.log.name))
        else:
            traceback.print_exc()
        sys.exit(1)


# ============================================================== settings (shared by both scripts)
# One settings file, homelab_media.json, with a "music" and a "books" section. Found next to this
# script, in ~/Homelab, in ~/.config, via HOMELAB_MEDIA_CONFIG, or with --config.
CONFIG_NAME = "homelab_media.json"
DEFAULT_CONFIG = {
    "reports_dir": "~/Downloads",
    "music": {
        "library": "",
        # where the tagging engine runs: "auto" (the beets image if Docker has one, else this
        # machine), "container", or "local" (a Python venv with beets in ~/.music-cleanup)
        "engine": "auto",
        "beets_image": "",           # empty = the image of your running beets container
        # containers stopped while the library is swapped: "auto" = every container whose
        # folders include the music library (Navidrome, beets, Plex...), or a list of names, or []
        "pause_containers": "auto",
    },
    "books": {
        "library": "",
        "calibre_bin_dir": "",       # where calibredb lives, if not in the usual places
        "pause_containers": "auto",  # e.g. Calibre-Web, while Calibre's database is written
        "workers": 4,
    },
}
CFG = json.loads(json.dumps(DEFAULT_CONFIG))
CFG_PATH = None
CFG_EXPLICIT = False
YES = False


def merge(base, over):
    out = dict(base)
    for k, v in (over or {}).items():
        out[k] = merge(base[k], v) if isinstance(v, dict) and isinstance(base.get(k), dict) else v
    return out


def config_candidates(explicit=None):
    here = Path(os.path.abspath(__file__)).parent
    c = []
    if explicit:
        c.append(Path(explicit).expanduser())
    if os.environ.get("HOMELAB_MEDIA_CONFIG"):
        c.append(Path(os.environ["HOMELAB_MEDIA_CONFIG"]).expanduser())
    return c + [here / CONFIG_NAME, Path.home() / "Homelab" / CONFIG_NAME, Path.home() / ".config" / CONFIG_NAME]


def load_config(explicit=None):
    global CFG, CFG_PATH, CFG_EXPLICIT
    CFG_EXPLICIT = bool(explicit)
    if explicit and not Path(explicit).expanduser().is_file():
        die("Settings file not found: %s" % explicit, "Create one with:\n  " + me("init"))
    for p in config_candidates(explicit):
        if p.is_file():
            try:
                raw = json.loads(p.read_text(encoding="utf-8"))
            except ValueError as e:
                die("Your settings file %s isn't valid JSON: %s" % (pretty_path(p), e))
            for sec, old in (("music", "media_servers"), ("books", "stop_containers")):  # older names
                s = raw.get(sec) or {}
                if old in s and "pause_containers" not in s:
                    s["pause_containers"] = s.pop(old)
            CFG = merge(DEFAULT_CONFIG, raw)
            CFG_PATH = p
            return


def save_config_section(section, values, explicit=None):
    """Update one section of the settings file, keeping everything else in it."""
    target = Path(explicit).expanduser() if explicit else (
        CFG_PATH or Path(os.path.abspath(__file__)).parent / CONFIG_NAME)
    data = {}
    if target.is_file():
        try:
            data = json.loads(target.read_text(encoding="utf-8"))
        except ValueError:
            die("%s isn't valid JSON, so I won't overwrite it." % pretty_path(target))
    data = merge(DEFAULT_CONFIG, data)
    data[section] = merge(data.get(section) or {}, values)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return target


def state_dir():
    d = Path.home() / ".homelab-media"
    d.mkdir(parents=True, exist_ok=True)
    return d


def reports_dir():
    """Where reports, logs, backups and set-aside files go (Downloads unless you change it)."""
    out = Path(os.path.expanduser(os.environ.get("HOMELAB_MEDIA_REPORTS") or CFG.get("reports_dir") or "~/Downloads"))
    try:
        out.mkdir(parents=True, exist_ok=True)
        if os.access(str(out), os.W_OK):
            return out
    except OSError:
        pass
    return state_dir()


def q(a):
    a = str(a)
    return a if re.fullmatch(r"[\w\-.,=/~]+", a) else '"%s"' % a.replace('"', '\\"')


def me(*args):
    """This script's command line, the way you'd type it in Terminal."""
    parts = ["python3", shell_arg(os.path.abspath(__file__))] + [q(a) for a in args]
    if CFG_EXPLICIT and CFG_PATH:
        parts += ["--config", q(pretty_path(CFG_PATH))]
    return " ".join(parts)


def confirm(question, word=None):
    """Ask before doing something big. --yes answers for you (scripts, apps, events mode)."""
    if YES:
        ui.to_log("       %s -> yes (--yes)" % question)
        return True
    if ui.events or not sys.stdin.isatty():
        die("This step needs your OK, and there's no one to ask.", "Run it in Terminal, or add --yes.")
    prompt = "  %s %s " % (question, ("Type %s to continue:" % word) if word else "[y/N]")
    ans = input(prompt).strip()
    ui.to_log("       %s answer: %r" % (question, ans))
    return ans == word if word else ans.lower() in ("y", "yes")


def keep_awake():
    """Stop a Mac from sleeping while this runs (the same as running it under caffeinate -i)."""
    if sys.platform == "darwin" and shutil.which("caffeinate") and not os.environ.get("HOMELAB_MEDIA_IN_CONTAINER"):
        try:
            subprocess.Popen(["caffeinate", "-i", "-w", str(os.getpid())],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except OSError:
            pass


# ============================================================== docker
def docker_ok():
    if os.environ.get("HOMELAB_MEDIA_IN_CONTAINER") or not shutil.which("docker"):
        return False
    try:
        return subprocess.run(["docker", "info"], capture_output=True, timeout=20).returncode == 0
    except Exception:
        return False


def docker(*args, timeout=180):
    r = subprocess.run(["docker"] + list(args), capture_output=True, text=True, timeout=timeout)
    if r.returncode != 0:
        raise RuntimeError("docker %s: %s" % (args[0], (r.stderr or r.stdout).strip()[-300:]))
    return r.stdout


def list_containers():
    rows = []
    for line in docker("ps", "-a", "--format", "{{.Names}}\t{{.Image}}\t{{.State}}").splitlines():
        p = line.split("\t")
        if len(p) >= 3:
            rows.append({"name": p[0], "image": p[1], "running": p[2].strip() == "running"})
    return rows


def unhost(p, windows=os.name == "nt"):
    """A mount's folder as this machine names it. Docker Desktop on a Mac sometimes reports
    /host_mnt/Users/...; on Windows it reports M:\\music as /run/desktop/mnt/host/m/music (or
    /host_mnt/m/music), which never matched the library, so nothing was paused."""
    p = p or ""
    if windows:
        m = re.match(r"^(?:/run/desktop/mnt/host|/host_mnt|/mnt)/([a-zA-Z])(/.*)?$", p)
        return "%s:%s" % (m.group(1).upper(), m.group(2) or "/") if m else p
    return re.sub(r"^/host_mnt(?=/)", "", p)


def inspect_container(name):
    data = json.loads(docker("inspect", name))[0]
    env = dict(e.split("=", 1) for e in ((data.get("Config") or {}).get("Env") or []) if "=" in e)
    mounts = [(unhost(m.get("Source")), (m.get("Destination") or "").rstrip("/") or "/", m.get("Type") or "")
              for m in data.get("Mounts") or []]
    return {"env": env, "mounts": mounts, "image_ref": (data.get("Config") or {}).get("Image") or ""}


def host_path(info, inside):
    """Where a folder inside a container lives on this machine (None for Docker-managed volumes)."""
    best = None
    for src, dst, typ in info["mounts"]:
        if inside == dst or inside.startswith(dst + "/"):
            if best is None or len(dst) > len(best[1]):
                best = (src, dst, typ)
    if not best or best[2] == "volume":
        return None
    return Path(best[0] + inside[len(best[1]):])


def overlaps(a, b, windows=os.name == "nt"):
    a, b = str(a).rstrip("/"), str(b).rstrip("/")
    if windows:  # M:\Music and m:/music are one folder there
        a, b = a.replace("\\", "/").rstrip("/").lower(), b.replace("\\", "/").rstrip("/").lower()
    return a == b or a.startswith(b + "/") or b.startswith(a + "/")


def containers_using(library, setting):
    """Containers to pause while a library changes: every one whose folders include it ("auto"),
    or the names listed in the settings."""
    if not setting or not docker_ok():
        return []
    out = []
    for c in list_containers():
        if isinstance(setting, list) and c["name"] not in setting:
            continue
        try:
            info = inspect_container(c["name"])
        except Exception:
            continue
        if setting == "auto" and not any(t == "bind" and src and overlaps(src, library)
                                         for src, _, t in info["mounts"]):
            continue
        c.update(info)
        out.append(c)
    if isinstance(setting, list):
        missing = set(setting) - {c["name"] for c in out}
        for n in sorted(missing):
            ui.warn("No container called %s; skipping it." % n)
    return out


class Paused:
    """with Paused(containers): ...  stops the running ones, always starts them again afterwards."""
    def __init__(self, conts):
        self.conts, self.stopped = conts, []

    def __enter__(self):
        for c in self.conts:
            if c.get("running"):
                with ui.spinner("Stopping %s" % c["name"]) as s:
                    docker("stop", c["name"])
                    s.summary = "Stopped %s" % c["name"]
                self.stopped.append(c)
        return self

    def __exit__(self, exc_type, exc, tb):
        for c in self.stopped:
            try:
                docker("start", c["name"])
                ui.ok("Started %s again" % c["name"])
            except Exception as e:
                ui.warn("Couldn't start %s again (%s). Start it with: docker start %s" % (c["name"], e, c["name"]))
        return False


def announce_pause(conts, when):
    running = [c for c in conts if c.get("running")]
    if running:
        ui.say()
        ui.say("These will be stopped %s and started again after:" % when)
        for c in running:
            ui.say("  • %s" % c["name"])


# Every genre in your library is folded into one of these. Edit freely:
# (genre name, words that map to it). Checked top to bottom; first match wins.
# Words of 4 letters or fewer must match a whole word; longer ones match word starts.
GENRES = [
    ("Holiday", ["christmas", "xmas", "holiday", "новогод", "рождеств"]),
    ("Comedy", ["comedy", "stand-up", "standup", "spoken word", "humor", "humour", "юмор"]),
    ("Soundtrack", ["soundtrack", "score", "ost", "film", "movie", "musical", "show tunes",
                    "video game", "game music", "anime", "саундтрек"]),
    ("Classical", ["classical", "baroque", "opera", "orchestra", "symphon", "chamber music",
                   "choral", "concerto", "sonata", "neoclassical", "классич"]),
    ("Latin", ["reggaeton", "latin", "salsa", "bachata", "cumbia", "merengue", "dembow", "tango",
               "flamenco", "mariachi", "corrido", "banda", "bossa nova", "samba", "mpb",
               "sertanejo", "urbano", "regional mexican"]),
    ("Reggae", ["reggae", "dancehall", "ska", "dub", "rocksteady", "регги"]),
    ("Hip-Hop & Rap", ["hip hop", "hip-hop", "hiphop", "rap", "trap", "drill", "grime", "phonk",
                       "boom bap", "g-funk", "gangsta", "crunk", "хип-хоп", "хип хоп", "рэп", "фонк"]),
    ("R&B & Soul", ["r&b", "rnb", "r and b", "rhythm and blues", "soul", "soulful", "funk", "funky",
                    "motown", "neo soul", "neo-soul", "new jack swing", "quiet storm", "gospel",
                    "соул", "фанк"]),
    ("Electronic & Dance", ["electronic", "electronica", "electro", "edm", "house", "techno",
                            "trance", "dance", "disco", "dubstep", "drum and bass", "drum & bass",
                            "dnb", "jungle", "breakbeat", "garage", "ambient", "downtempo",
                            "chillout", "chill out", "chill", "lo-fi", "lofi", "idm", "synthwave",
                            "hardstyle", "eurodance", "club", "trip hop", "trip-hop", "vaporwave",
                            "new age", "meditation", "relax", "sleep",
                            "электрон", "танцев", "техно", "хаус", "транс", "диско"]),
    ("Rock & Metal", ["metal", "rock", "rockabilly", "punk", "grunge", "emo", "hardcore",
                      "alternative", "indie", "shoegaze", "post-punk", "new wave", "britpop",
                      "psychedelic", "prog", "stoner", "рок", "метал", "панк"]),
    ("Jazz & Blues", ["jazz", "jazzy", "blues", "swing", "bebop", "big band", "fusion", "джаз", "блюз"]),
    ("Country & Folk", ["country", "bluegrass", "americana", "folk", "singer-songwriter",
                        "acoustic", "celtic", "кантри", "фолк"]),
    ("World", ["afrobeats", "afrobeat", "afro", "amapiano", "african", "world", "bollywood",
               "indian", "arabic", "middle eastern", "balkan", "highlife"]),
    ("Pop", ["pop", "k-pop", "kpop", "j-pop", "oldies", "adult contemporary", "easy listening",
             "vocal", "teen", "schlager", "chanson", "christian", "worship", "children",
             "поп", "эстрад", "шансон"]),
]
# Genres the word rules above would get wrong.
GENRE_EXACT = {
    "synthpop": "Pop", "synth-pop": "Pop", "synth pop": "Pop", "electropop": "Pop",
    "dance pop": "Pop", "dance-pop": "Pop", "indie pop": "Pop", "latin pop": "Latin",
    "latin trap": "Latin", "trap latino": "Latin", "pop rap": "Hip-Hop & Rap",
    "jazz rap": "Hip-Hop & Rap", "afro house": "Electronic & Dance",
    "electro swing": "Electronic & Dance", "dubstep": "Electronic & Dance",
    "country rock": "Country & Folk", "folk rock": "Country & Folk",
    "pop punk": "Rock & Metal", "pop-punk": "Rock & Metal", "ska punk": "Rock & Metal",
    "indietronica": "Electronic & Dance", "soul jazz": "Jazz & Blues", "acid jazz": "Jazz & Blues",
    "afrobeats": "World", "afropop": "World", "uk garage": "Electronic & Dance",
    "garage rock": "Rock & Metal", "garage punk": "Rock & Metal",
}
# Words that mark a different edition of the same album ("Album (Deluxe Edition)").
EDITION_WORDS = {"deluxe", "edition", "expanded", "remaster", "remastered", "bonus", "track", "tracks",
                 "version", "special", "anniversary", "extended", "explicit", "clean", "collector",
                 "collectors", "platinum", "complete", "super", "limited", "reissue", "digital",
                 "original", "international", "the", "s", "edit", "uncensored", "standard"}
# Hidden tags some players (e.g. Navidrome) also use to tell albums apart.
RAW_GROUP_KEYS = ("RELEASEDATE", "ALBUMVERSION")

AUDIO_EXT = {".mp3", ".m4a", ".mp4", ".aac", ".flac", ".ogg", ".oga", ".opus", ".wma",
             ".wav", ".aif", ".aiff", ".ape", ".wv", ".mpc", ".alac", ".dsf"}
IMAGE_NAMES = ("cover", "folder", "front", "album", "albumart", "art")
GENERIC_DIRS = {"music", "downloads", "download", "itunes", "itunesmedia", "media", "unknown",
                "unknownalbum", "unknownartist", "newfolder", "misc", "various", "variousartists",
                "compilations", "singles", "mp3", "mp3s", "flac", "songs", "library", "tracks",
                "audio", "musiclibrary", "automaticallyaddtomusic", "incoming", "unsorted",
                "playlist", "playlists", "spotdl", "deemix", "tidal", "qobuz", "soulseek", "complete"}
WORK = ".music-cleanup"
NEEDS = "_Needs Attention"
VA = "Various Artists"
# Folders that hold system or app files, never music. Everything else is read, INCLUDING folders
# whose names start with a dot ("...And Out Come the Wolves", ".mp3"): the first version skipped
# those, which silently dropped whole albums from the cleaned library.
SYSTEM_DIRS = {WORK, NEEDS, ".Trashes", ".Trash", ".Spotlight-V100", ".fseventsd", ".TemporaryItems",
               ".DocumentRevisions-V100", ".AppleDouble", ".AppleDB", ".AppleDesktop", ".git", "@eaDir",
               "#recycle", "#snapshot", ".snapshot", ".snapshots", "$RECYCLE.BIN", "System Volume Information",
               "lost+found", ".stfolder", ".stversions", ".caltrash", ".calnotes"}


def is_audio_name(fn):
    """Music file by name; macOS "._" sidecar files on exFAT/NTFS drives are not music."""
    return not fn.startswith("._") and Path(fn).suffix.lower() in AUDIO_EXT


# ============================================================== bootstrap
def bootstrap():
    """Make sure beets is importable; inside a beets container use the existing install."""
    if os.environ.get("MUSIC_CLEANUP_CHILD") == "1":
        return
    if sys.version_info < (3, 8):
        die("Python 3.8 or newer is needed (found %s)." % sys.version.split()[0])
    try:
        import beets  # noqa: F401
        import mediafile  # noqa: F401
        return  # beets already here (e.g. a beets container)
    except ImportError:
        pass
    beet = shutil.which("beet")  # beets installed under another interpreter?
    if beet:
        try:
            first = open(beet, "rb").readline().decode("utf-8", "ignore")
            if first.startswith("#!"):
                py = first[2:].strip().split()[0]
                if py.endswith("env"):
                    py = shutil.which(first[2:].strip().split()[1]) or py
                if os.path.exists(py) and subprocess.run(
                        [py, "-c", "import beets, mediafile"], capture_output=True).returncode == 0:
                    relaunch(py)
        except OSError:
            pass
    if os.environ.get("HOMELAB_MEDIA_IN_CONTAINER"):
        die("This Docker image doesn't have beets in it.",
            'Set "beets_image" to a beets image (e.g. lscr.io/linuxserver/beets), or "engine": "local".')
    venv = Path.home() / ".music-cleanup" / "venv"
    py = venv / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    check = [str(py), "-c", "import beets, mediafile, requests, pylast"]
    if not py.exists() or subprocess.run(check, capture_output=True).returncode != 0:
        with ui.spinner("One-time setup: installing beets (about a minute)") as sp:
            if not py.exists():
                r = subprocess.run([sys.executable, "-m", "venv", str(venv)], capture_output=True, text=True)
                if r.returncode != 0:
                    raise RuntimeError("couldn't create %s: %s" % (venv, r.stderr[-400:]))
            pip = [str(py), "-m", "pip", "install", "--quiet", "--disable-pip-version-check",
                   "--no-warn-script-location"]
            subprocess.run(pip + ["--upgrade", "pip"], capture_output=True)
            r = subprocess.run(pip + ["beets", "requests", "pylast"], capture_output=True, text=True)
            if r.returncode != 0:
                tail = (r.stderr or r.stdout).strip().splitlines()[-3:]
                raise RuntimeError("couldn't install beets (%s). Check the internet connection."
                                   % " / ".join(tail))
            subprocess.run(pip + ["Pillow"], capture_output=True)  # optional: resizes artwork
            if shutil.which("fpcalc"):
                subprocess.run(pip + ["pyacoustid"], capture_output=True)
            if subprocess.run(check, capture_output=True).returncode != 0:
                raise RuntimeError("beets installed but won't load. Delete %s and run again." % venv)
            sp.summary = "One-time setup done"
    relaunch(str(py))


def relaunch(py):
    env = dict(os.environ, MUSIC_CLEANUP_CHILD="1")
    sys.exit(subprocess.call([py, os.path.abspath(__file__)] + sys.argv[1:], env=env))


# ============================================================== text helpers
FEAT_RE = re.compile(r"\s*[\(\[]?\s*\b(?:feat\.?|ft\.?|featuring)(?:\s|$).*$", re.I)
MULTI_RE = re.compile(r"\s*(?:;|\s/\s|\s+x\s+|\s+vs\.?\s+|\s+with\s+)\s*", re.I)
SOFT_RE = re.compile(r"\s*(?:,|&|\band\b)\s*", re.I)
DISC_DIR_RE = re.compile(r"^\s*(?:cd|disc|disk)\s*[-_.]?\s*(\d+)\b", re.I)
DISC_SUFFIX_RE = re.compile(r"[\s\-:,]*[\(\[]?\s*(?:disc|disk|cd)\s*(\d+)(?:\s*(?:of|/)\s*\d+)?\s*[\)\]]?\s*$", re.I)
TRACKNUM_RE = re.compile(r"^\s*(?:(\d)[-.])?(\d{1,3})(?:\s*[-._)]\s*|\s+)")


def track_number_prefix(stem):
    """'01 Song' / '1. Song' / '1-05 Song' -> match; '50 Cent - Song' -> None."""
    m = TRACKNUM_RE.match(stem)
    if not m:
        return None
    trailing = stem[m.end(2):m.end()]
    if m.group(1) or m.group(2).startswith("0") or any(c in "-._)" for c in trailing):
        return m
    return None


def akey(s):
    """Compact key for comparing artist names."""
    k = re.sub(r"[\W_]+", "", (s or "").casefold())
    return k or (s or "").strip().casefold()  # names like "!!!" or "?" are real names


def album_key(s):
    raw = DISC_SUFFIX_RE.sub("", s or "")
    k = re.sub(r"[^\w\s]", " ", raw.casefold().replace("&", " and "))
    k = re.sub(r"\s+", " ", k).strip()
    return k or raw.strip().casefold()  # albums called "?" or "=" are real names


def strip_feat(a):
    a = FEAT_RE.sub("", a or "").strip()
    return MULTI_RE.split(a)[0].strip() if a else ""


def primary_artist(a, known):
    a1 = strip_feat(a)
    parts = [p for p in SOFT_RE.split(a1) if p.strip()]
    # "Drake, Future" -> "Drake", but only if Drake also appears on his own somewhere;
    # protects real names like "Simon & Garfunkel" or "Earth, Wind & Fire".
    if len(parts) > 1 and akey(parts[0]) in known:
        return parts[0].strip()
    return a1


def generic_dir(p, source):
    return p == source or akey(p.name) in GENERIC_DIRS or not akey(p.name)


def most_common(values):
    values = [v for v in values if v not in (None, "", 0)]
    return Counter(values).most_common(1)[0] if values else (None, 0)


HOLIDAY_RE = re.compile(r"\b(christmas|xmas|x-mas|holiday|navidad|no[eë]l|weihnacht|рождеств|новогод)", re.I)
_GENRE_RULES = [(g, [re.compile(r"(?<!\w)" + re.escape(w) + (r"(?!\w)" if len(w) <= 4 else ""))
                     for w in words]) for g, words in GENRES]
_GENRE_NAMES = {g for g, _ in GENRES}


def map_genre(values):
    """Raw genre tag values -> one broad genre (or None)."""
    parts = []
    for v in values or []:
        parts += [p.strip() for p in re.split(r"[;/|,]|\s-\s", v or "") if p.strip()]
    for p in parts:
        if p in _GENRE_NAMES:
            return p
        low = re.sub(r"\s+", " ", p.casefold().replace("_", " ")).strip()
        if low in GENRE_EXACT:
            return GENRE_EXACT[low]
        for g, pats in _GENRE_RULES:
            if any(pt.search(low) for pt in pats):
                return g
    return None


def folder_year(name):
    m = re.search(r"[\(\[]\s*((?:19|20)\d\d)\s*[\)\]]|^\s*((?:19|20)\d\d)\s*[-.]", name)
    return int(m.group(1) or m.group(2)) if m else 0


def parse_folder_name(name):
    """'Daft Punk - Discovery (2001) [FLAC]' -> ('Daft Punk', 'Discovery')"""
    n = re.sub(r"\[[^\]]*\]|\{[^}]*\}|\((?:19|20)\d\d[^)]*\)", " ", name)
    n = re.sub(r"\((?:flac|mp3|320|v0|web|cd|vinyl|24bit|16bit|hi-?res)[^)]*\)", " ", n, flags=re.I)
    n = re.sub(r"^\s*(?:19|20)\d\d\s*[-.]\s*", "", n)
    n = re.sub(r"\s+", " ", n).strip(" -_.")
    m = re.match(r"^(.+?)\s+-\s+(.+)$", n)
    return (m.group(1).strip(), m.group(2).strip()) if m else ("", n)


# ============================================================== reading
def _raw_keys(tags, key):
    """Matching keys for a free-form tag across ID3 / MP4 / Vorbis / APE."""
    out = []
    for k in list(tags.keys()):
        name = str(k)
        for prefix in ("TXXX:", "----:com.apple.iTunes:"):
            if name.upper().startswith(prefix.upper()):
                name = name[len(prefix):]
        if name.upper() == key:
            out.append(k)
    return out


def raw_read(path):
    import mutagen
    out = {}
    try:
        f = mutagen.File(path)
        if f is None or f.tags is None:
            return out
        for key in RAW_GROUP_KEYS:
            for k in _raw_keys(f.tags, key):
                v = f.tags[k]
                v = getattr(v, "text", v)
                if isinstance(v, (list, tuple)):
                    v = v[0] if v else ""
                if isinstance(v, bytes):
                    v = v.decode("utf-8", "ignore")
                out[key] = str(v)
                break
    except Exception:
        pass
    return out


def raw_delete(path, keys):
    import mutagen
    f = mutagen.File(path)
    if f is None or f.tags is None:
        return
    hit = False
    for key in keys:
        for k in _raw_keys(f.tags, key):
            del f.tags[k]
            hit = True
    if hit:
        f.save()


def read_track(path):
    from mediafile import MediaFile
    f = MediaFile(str(path))
    try:
        genres = list(f.genres or [])
    except Exception:
        genres = [f.genre] if f.genre else []
    return {
        "title": f.title or "", "artist": f.artist or "", "albumartist": f.albumartist or "",
        "album": f.album or "", "genres": [g for g in genres if g],
        "year": f.year or 0, "month": f.month or 0, "day": f.day or 0,
        "disc": f.disc or 0, "disctotal": f.disctotal or 0, "track": f.track or 0,
        "comp": bool(f.comp), "mb_albumid": f.mb_albumid or "",
        "mb_albumartistid": f.mb_albumartistid or "", "mb_releasegroupid": f.mb_releasegroupid or "",
        "has_art": bool(f.images),
        "albumartists": list(getattr(f, "albumartists", None) or []),
        "albumartist_sort": getattr(f, "albumartist_sort", None) or "",
        "raw": raw_read(str(path)),
    }


def scan_files(source):
    files = []
    for dirpath, dirnames, filenames in os.walk(source):
        dirnames[:] = sorted(d for d in dirnames if d not in SYSTEM_DIRS)
        for fn in sorted(filenames):
            if is_audio_name(fn):
                files.append(Path(dirpath) / fn)
    return files


def stage_name(src):
    """File name for the staging copy. beets ignores names starting with a dot, so: "...Ready" -> "…Ready"."""
    name = Path(src).name
    if name.startswith("."):
        name = re.sub(r"^\.\.\.", "\u2026", name).lstrip(".")
        if not Path(name).suffix or not Path(name).stem:
            name = "track" + Path(src).suffix
    return name


def read_all(files):
    tracks, unreadable = [], []

    def one(p):
        try:
            return p, read_track(p)
        except Exception:
            return p, None

    with ui.progress(len(files), "Reading") as bar, ThreadPoolExecutor(max_workers=8) as ex:
        for p, t in ex.map(one, files):
            if t is None:
                unreadable.append(str(p))
            else:
                t["src"] = str(p)
                t["size"] = p.stat().st_size
                tracks.append(t)
            bar.update(note=p.parent.parent.name + " / " + p.parent.name)
        bar.note = ""
        bar.summary = "Read %s music files" % fmt_n(len(files))
    return tracks, unreadable


# ============================================================== planning
def build_plan(source, tracks):
    known = set()
    for t in tracks:
        for a in (t["albumartist"], t["artist"]):
            s = strip_feat(a)
            if s and len(SOFT_RE.split(s)) == 1:
                known.add(akey(s))
    for i, t in enumerate(tracks):
        t["i"] = i
        t["edits"] = {}

    def root_of(t):
        d = Path(t["src"]).parent
        return d.parent if DISC_DIR_RE.match(d.name) and d != source else d

    by_root = defaultdict(list)
    for t in tracks:
        by_root[root_of(t)].append(t)

    groups, loose = [], []
    stats = Counter()
    for root, ts in sorted(by_root.items(), key=lambda kv: str(kv[0])):
        keyed, empty = defaultdict(list), []
        for t in ts:
            k = album_key(t["album"])
            (keyed[k] if k else empty).append(t)
        # "Album" and "Album (Deluxe Edition)" in one folder -> one album
        # (but never "Greatest Hits" and "Greatest Hits Vol 2")
        for a in sorted(keyed, key=len):
            for b in list(keyed):
                if a in keyed and b != a and b.startswith(a + " "):
                    extra = b[len(a):].split()
                    if all(w in EDITION_WORDS or re.fullmatch(r"\d+(?:st|nd|rd|th)?", w) for w in extra):
                        keyed[a] += keyed.pop(b)
        if not keyed:
            if len(empty) >= 2 and not generic_dir(root, source):
                artist, album = parse_folder_name(root.name)
                if not artist and not generic_dir(root.parent, source):
                    artist = root.parent.name
                yr = folder_year(root.name)
                for t in empty:
                    t["edits"]["album"] = album
                    if yr and not t["year"]:
                        t["year"] = yr
                        t["edits"]["year"] = yr
                groups.append({"root": str(root), "tracks": empty, "hint": artist, "from_folder": True})
                stats["albums named from folder"] += 1
            else:
                loose += empty
        elif len(keyed) == 1 and len(next(iter(keyed.values()))) >= 2:
            only = next(iter(keyed.values()))
            album = most_common([DISC_SUFFIX_RE.sub("", t["album"]) for t in only])[0]
            for t in empty:
                t["edits"]["album"] = album
            groups.append({"root": str(root), "tracks": only + empty, "hint": ""})
        else:
            for k, g in keyed.items():
                groups.append({"root": str(root), "tracks": g, "hint": ""})
            loose += empty

    # ---- album artist for every album (the fix for albums splitting apart)
    for g in groups:
        ts = g["tracks"]
        n = len(ts)
        g["album"] = most_common([DISC_SUFFIX_RE.sub("", t["edits"].get("album", t["album"])) for t in ts])[0] or ""
        g["key"] = album_key(g["album"])
        aa, c = most_common([strip_feat(t["albumartist"]) for t in ts])
        comp_flag = sum(t["comp"] for t in ts) * 2 > n
        if aa and c * 2 >= n:
            g["aa"] = aa
        else:
            prims = [primary_artist(t["artist"], known) for t in ts]
            by_key = defaultdict(list)
            for p in prims:
                if p:
                    by_key[akey(p)].append(p)
            if not by_key:
                g["aa"] = g["hint"] or ""
            else:
                best = max(by_key.values(), key=len)
                if len(best) * 2 >= n or n == 1:
                    g["aa"] = Counter(best).most_common(1)[0][0]
                elif len(by_key) >= 3 or comp_flag:
                    g["aa"] = VA
                else:
                    g["aa"] = Counter(best).most_common(1)[0][0]
        g["comp"] = akey(g["aa"]) == akey(VA) or (comp_flag and akey(g["aa"]) == akey(VA))
        if g["comp"]:
            g["aa"] = VA

    # ---- put albums back together when their tracks sit in different folders
    merged, index = [], {}
    for g in groups:
        k = (akey(g["aa"]), g["key"])
        tgt = index.get(k)
        if tgt is not None and g["key"] and not g["comp"] and tgt["root"] != g["root"]:
            ids_a = {t["mb_albumid"] for t in tgt["tracks"] if t["mb_albumid"]}
            ids_b = {t["mb_albumid"] for t in g["tracks"] if t["mb_albumid"]}
            seen = {(t["disc"], t["track"], akey(t["title"])) for t in tgt["tracks"]}
            dup = any((t["disc"], t["track"], akey(t["title"])) in seen for t in g["tracks"])
            if not dup and not (ids_a and ids_b and not ids_a & ids_b):
                tgt["tracks"] += g["tracks"]
                stats["albums pieced together from different folders"] += 1
                continue
        index.setdefault(k, g)
        merged.append(g)
    groups = merged

    # ---- exact duplicate tracks (same artist, album, title): keep the best copy
    best = {}
    for g in groups:
        for t in g["tracks"]:
            k = (akey(g["aa"]), g["key"], t["disc"], t["track"], akey(t["title"]))
            if not akey(t["title"]):
                continue
            rank = (len(g["tracks"]), Path(t["src"]).suffix.lower() in (".flac", ".alac", ".wav", ".aiff"),
                    t["size"])
            if k not in best or rank > best[k][0]:
                best[k] = (rank, t)
    dupes = []
    for g in groups:
        keep = []
        for t in g["tracks"]:
            k = (akey(g["aa"]), g["key"], t["disc"], t["track"], akey(t["title"]))
            if k in best and best[k][1] is not t:
                dupes.append(t)
            else:
                keep.append(t)
        g["tracks"] = keep
    groups = [g for g in groups if g["tracks"]]
    if dupes:
        stats["duplicate copies set aside"] = len(dupes)

    # ---- make album-level tags identical on every track of an album
    for g in groups:
        ts = g["tracks"]
        n = len(ts)
        changed = Counter()

        def setf(t, field, value):
            cur = t["edits"].get(field, t.get(field))
            if (cur or None) != (value or None):
                t["edits"][field] = value
                changed[field] += 1

        for t in ts:
            setf(t, "album", g["album"])
            setf(t, "albumartist", g["aa"])
            setf(t, "comp", g["comp"])
            if not t["artist"] and g["aa"] and not g["comp"]:
                setf(t, "artist", g["aa"])
        year, _ = most_common([t["year"] for t in ts])
        if year:  # majority year, plus the fullest date seen for that year
            md, _ = most_common([(t["month"], t["day"]) for t in ts if t["year"] == year and t["month"]])
            md = md or (0, 0)
            for t in ts:
                setf(t, "year", year)
                setf(t, "month", md[0])
                setf(t, "day", md[1])
        for field in ("mb_albumid", "mb_albumartistid", "mb_releasegroupid"):
            val, c = most_common([t[field] for t in ts])
            if val and c * 2 < n:
                val = ""  # too inconsistent to trust; players then group by name instead
            if val or any(t[field] for t in ts):
                for t in ts:
                    setf(t, field, val)
        lists = {tuple(t["albumartists"]) for t in ts}
        if any(lists - {()}) and (len(lists) > 1 or changed["albumartist"]):
            for t in ts:  # the multi-value album artist tag must agree too
                if tuple(t["albumartists"]) != (g["aa"],):
                    t["edits"]["albumartists"] = [g["aa"]]
                    changed["albumartists"] += 1
        sorts = {t["albumartist_sort"] for t in ts}
        if any(sorts) and (len(sorts) > 1 or changed["albumartist"]):
            for t in ts:
                if t["albumartist_sort"]:
                    t["edits"]["albumartist_sort"] = ""
        for key in RAW_GROUP_KEYS:
            vals = {t["raw"].get(key, "") for t in ts}
            if len(vals) > 1:  # differs between tracks -> drop it so the album stays together
                for t in ts:
                    if t["raw"].get(key):
                        t["edits"].setdefault("_rawdel", []).append(key)
                        changed["raw"] += 1
        for t in ts:  # disc numbers from "CD2" folders or "Album (Disc 2)" titles
            if not t["disc"]:
                m = DISC_DIR_RE.match(Path(t["src"]).parent.name) or DISC_SUFFIX_RE.search(t["album"])
                if m:
                    setf(t, "disc", int(m.group(1)))
        maxdisc = max([t["edits"].get("disc", t["disc"]) or 0 for t in ts] + [0])
        if maxdisc > 1:
            for t in ts:
                if not t["edits"].get("disc", t["disc"]):
                    setf(t, "disc", 1)
                setf(t, "disctotal", max(maxdisc, t["disctotal"]))
        if changed["albumartist"]:
            stats["albums given one consistent album artist"] += 1
        if changed["comp"]:
            stats['tracks with a wrong "compilation" flag fixed'] += changed["comp"]
        if changed["disc"] or changed["disctotal"]:
            stats["albums with disc numbers fixed"] += 1
        if g["comp"]:
            stats["albums marked Various Artists"] += 1
        if changed["year"] or changed["month"] or changed["day"] or changed["mb_albumid"] or changed["raw"]:
            stats["albums with mismatched dates/IDs unified"] += 1

    # ---- titles/track numbers from file names when tags are empty
    for t in tracks:
        stem = Path(t["src"]).stem
        m = track_number_prefix(stem)
        if not t["track"] and m:
            t["edits"]["track"] = int(m.group(2))
        if not t["title"]:
            rest = stem[m.end():] if m else stem
            if " - " in rest:
                artist, title = rest.split(" - ", 1)
                if not t["artist"]:
                    t["edits"]["artist"] = artist.strip()
                rest = title
            t["edits"]["title"] = rest.strip() or stem
            stats["tracks titled from file name"] += 1

    # ---- one broad genre per album (single value, so no more R&B/Soul doubles)
    genre_counts = defaultdict(Counter)
    artist_genres = defaultdict(Counter)  # tie-breaker: what this artist mostly is across the library
    for g in groups:
        for t in g["tracks"]:
            mg = map_genre(t["genres"])
            if mg:
                artist_genres[akey(g["aa"])][mg] += 1
    order = {name: i for i, (name, _) in enumerate(GENRES)}
    for g in groups + [{"tracks": [t]} for t in loose]:
        mapped = [map_genre(t["genres"]) for t in g["tracks"]]
        for t, mg in zip(g["tracks"], mapped):
            for raw in t["genres"] or ["(none)"]:
                genre_counts[raw][mg or "(no match)"] += 1
        counts = Counter(x for x in mapped if x)
        best = None
        if HOLIDAY_RE.search(g.get("album", "")) or counts.get("Holiday", 0) * 3 >= len(mapped) > 0 \
                and counts.get("Holiday"):
            best = "Holiday"  # Christmas albums stay Holiday even if some tracks say Pop
        elif counts:
            top = max(counts.values())
            tied = [x for x in counts if counts[x] == top]
            fav = artist_genres[akey(g.get("aa", ""))]
            best = sorted(tied, key=lambda x: (-fav[x], order.get(x, 99)))[0]
        g["genre"] = best or ""
        for t in g["tracks"]:
            if best and (t["genres"] != [best]):
                t["edits"]["genre"] = best
                stats["tracks moved into your broad genres"] += 1
            elif not best and t["genres"]:
                t["edits"]["genre"] = ""  # junk like "Other": cleared, then looked up online
                stats["junk genres cleared (looked up online instead)"] += 1

    # ---- cover art from image files in the album's folder, for tracks without art
    art_cache = {}
    for g in groups:
        missing = [t for t in g["tracks"] if not t["has_art"]]
        if not missing:
            continue
        img = None
        for d in [Path(t["src"]).parent for t in g["tracks"]] + [Path(g["root"])]:
            if d not in art_cache:
                art_cache[d] = find_folder_image(d)
            if art_cache[d]:
                img = art_cache[d]
                break
        if img:
            for t in missing:
                t["edits"]["_art"] = str(img)
            stats["albums getting artwork from their folder"] += 1

    return groups, loose, dupes, stats, genre_counts


def find_folder_image(d):
    try:
        imgs = [p for p in d.iterdir() if p.suffix.lower() in (".jpg", ".jpeg", ".png")
                and not p.name.startswith(".") and p.stat().st_size < 4_000_000]
    except OSError:
        return None
    for name in IMAGE_NAMES:
        for p in imgs:
            if p.stem.casefold() == name or p.stem.casefold().startswith(name):
                return p
    return imgs[0] if len(imgs) == 1 else None


# ============================================================== staging copy
def copy_file(src, dst, mode):
    if mode == "clone":
        r = subprocess.run(["cp", "-c", "-p", src, dst], capture_output=True)
        if r.returncode == 0:
            return
    elif mode == "reflink":
        r = subprocess.run(["cp", "--reflink=always", "-p", src, dst], capture_output=True)
        if r.returncode == 0:
            return
    shutil.copy2(src, dst)


def apply_edits(path, edits):
    if not edits:
        return
    from mediafile import MediaFile, Image, ImageType
    f = MediaFile(path)
    for field, value in edits.items():
        if field == "_rawdel":
            continue
        if field == "_art":
            try:
                data = Path(value).read_bytes()
                f.images = [Image(data=data, desc="", type=ImageType.front)]
            except Exception:
                pass
            continue
        if field in ("mb_albumid", "mb_albumartistid", "mb_releasegroupid", "genre",
                     "albumartist_sort") and not value:
            value = None
        try:
            setattr(f, field, value)
        except Exception:
            pass
    f.save()
    if edits.get("_rawdel"):
        raw_delete(path, edits["_rawdel"])


# ============================================================== beets
def has_module(name):
    import importlib.util
    try:
        return importlib.util.find_spec(name) is not None
    except Exception:
        return False


def write_beets_config(beetsdir, cleaned, offline, import_log):
    import yaml
    pillow = has_module("PIL")
    plugins = ["inline", "ftintitle"]
    if not offline:
        plugins += ["fetchart", "embedart", "lastgenre"]
        if has_module("beetsplug.musicbrainz"):
            plugins.insert(0, "musicbrainz")
        if shutil.which("fpcalc") and has_module("acoustid"):
            plugins.append("chroma")
    cfg = {
        "directory": str(cleaned),
        "library": str(beetsdir / "library.db"),
        "plugins": plugins,
        "threaded": True,
        "per_disc_numbering": True,
        "id3v23": True,
        "art_filename": "cover",
        "ui": {"color": False},
        # read everything handed over (staging names never start with a dot anyway)
        "ignore": ["._*", ".DS_Store", "*~", "System Volume Information", "lost+found"],
        "ignore_hidden": False,
        # beets' own defaults, plus: "...Album" becomes "…Album" (not a hidden "_..Album" folder)
        "replace": {r"^\.\.\.": "\u2026", r"\.\.\.$": "\u2026", r"[\\/]": "_", r"^\.": "_",
                    r"[\x00-\x1f]": "_", r'[<>:"\?\*\|]': "_", r"\.$": "_", r"\s+$": "", r"^\s+": "",
                    r"^-": "_"},
        "import": {
            "move": True, "copy": False, "write": True, "quiet": True, "quiet_fallback": "asis",
            "incremental": True, "resume": True, "timid": False, "group_albums": False,
            "duplicate_action": "keep", "languages": ["en"], "detail": False, "bell": False,
            "log": str(import_log),
        },
        "match": {
            "strong_rec_thresh": 0.04,
            # never auto-accept an online match whose track list doesn't line up
            # (stops deluxe/remaster/wrong-album matches)
            "max_rec": {"missing_tracks": "medium", "unmatched_tracks": "medium"},
            "preferred": {"media": ["Digital Media|File", "CD"], "original_year": True},
            "ignored_media": ["Data CD", "DVD", "DVD-Video", "Blu-ray", "HD-DVD", "VCD",
                              "SVCD", "UMD", "VHS"],
            "ignore_video_tracks": True,
        },
        "musicbrainz": {"genres": False},
        "ftintitle": {"auto": True, "drop": False},
        "fetchart": {"auto": False, "minwidth": 300, "cautious": False,
                     "sources": ["coverart", "itunes", "amazon", "albumart"]},
        "embedart": {"auto": False, "ifempty": True, "remove_art_file": False},
        "lastgenre": {"auto": False, "canonical": True, "count": 1, "source": "album",
                      "force": True, "whitelist": True, "prefer_specific": False},
        "item_fields": {
            "disc_and_track": "(u'%i-%02i ' % (disc, track) if disctotal > 1 else u'%02i ' % track) if track else u''",
            # "Album (2013)", matching the usual Artist/Album (Year) layout
            "album_dir": "(album or u'Unknown Album') + (u' (%i)' % year if year else u'')",
        },
        "paths": {
            "default": "%if{$albumartist,$albumartist,Unknown Artist}/"
                       "$album_dir%aunique{}/$disc_and_track%if{$title,$title,Track}",
            "comp": VA + "/$album_dir%aunique{}/$disc_and_track%if{$title,$title,Track}",
            "singleton": "%if{$artist,$artist,Unknown Artist}/Singles/%if{$title,$title,Track}",
        },
    }
    if pillow:
        cfg["fetchart"]["maxwidth"] = 1200
        cfg["embedart"]["maxwidth"] = 1200
    beetsdir.mkdir(parents=True, exist_ok=True)
    (beetsdir / "config.yaml").write_text(yaml.safe_dump(cfg, allow_unicode=True, sort_keys=False))


def genre_field():
    try:
        from beets.library import Item
        return "genres" if "genres" in Item._fields else "genre"
    except Exception:
        return "genre"


class Beets:
    """Runs beets quietly; everything it says goes to the details log in Downloads."""
    def __init__(self, sp):
        self.env = dict(os.environ, BEETSDIR=str(sp["beets"]))
        self.cmd = [sys.executable, "-c", "import sys; from beets.ui import main; sys.exit(main())"]
        self.details = sp["details"]

    def _header(self, args):
        return "\n%s  $ beet %s\n" % (time.strftime("%Y-%m-%d %H:%M:%S"), " ".join(args))

    def run(self, *args, check=False):
        r = subprocess.run(self.cmd + list(args), env=self.env, stdin=subprocess.DEVNULL,
                           stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                           encoding="utf-8", errors="replace")
        if args and args[0] != "ls":
            try:
                with open(str(self.details), "a", encoding="utf-8") as f:
                    f.write(self._header(args) + r.stdout)
            except OSError:
                pass
        if check and r.returncode != 0:
            raise RuntimeError("beet %s failed: %s" % (args[0], r.stdout.strip()[-500:]))
        return r

    def lines(self, *args):
        return [l for l in self.run(*args, check=True).stdout.splitlines() if "\t" in l]

    def run_watching(self, args, done_fn, bar):
        """Run a long beets command, moving the progress bar as files get organized."""
        with open(str(self.details), "a", encoding="utf-8") as f:
            f.write(self._header(args))
            f.flush()
            p = subprocess.Popen(self.cmd + list(args), env=self.env, stdin=subprocess.DEVNULL,
                                 stdout=f, stderr=subprocess.STDOUT)
            try:
                while p.poll() is None:
                    time.sleep(1.5)
                    bar.update(done=done_fn())
            except KeyboardInterrupt:
                p.wait()
                raise
            bar.update(done=done_fn())
        return p.returncode


def id_query(ids):
    q = []
    for i in ids:
        q += ["id:%s" % i, ","]
    return q[:-1]


def chunks(xs, n=200):
    for i in range(0, len(xs), n):
        yield xs[i:i + n]


# ============================================================== main steps
def state_paths(source):
    h = hashlib.sha1(str(source).encode()).hexdigest()[:10]
    base = None
    for cand in (Path.home(), Path("/config"), source / WORK):
        try:
            (cand / ".music-cleanup").mkdir(parents=True, exist_ok=True)
            if os.access(str(cand / ".music-cleanup"), os.W_OK):
                base = cand
                break
        except OSError:
            continue
    if base is None:
        die("Can't find a writable place for the cleanup's working files.")
    local = base / ".music-cleanup" / ("%s-%s" % (re.sub(r"\W+", "_", source.name)[:30], h))
    out = reports_dir()  # reports, logs and set-aside files go here
    work = source / WORK
    return {"local": local, "plan": local / "plan.json", "copied": local / "copied.txt",
            "beets": local / "beets", "work": work, "staging": work / "staging",
            "cleaned": work / "cleaned", "backup": work / "original", "done": local / "DONE",
            "final": local / "FINALIZED", "out": out,
            "needs": out / "Music - Needs Attention",
            "changes_csv": out / "music_cleanup_planned_changes.csv",
            "report_csv": out / "music_cleanup_album_report.csv",
            "log": out / "music_cleanup_log.txt",
            "details": out / "music_cleanup_details.log"}


def make_plan(source, sp, fresh=False):
    if sp["plan"].exists() and not fresh:
        return json.loads(sp["plan"].read_text())
    with ui.spinner("Finding music files") as s:
        files = scan_files(source)
        s.summary = "Found %s music files" % fmt_n(len(files))
        hidden = {p.parent for p in files if any(part.startswith(".") for part in p.relative_to(source).parts[:-1])}
    if not files:
        die("No music files found in %s" % source, "Is that the right folder? Is the drive plugged in?")
    tracks, unreadable = read_all(files)
    groups, loose, dupes, stats, genre_counts = build_plan(source, tracks)
    entries = []
    for gi, g in enumerate(groups, 1):
        bucket = "full" if len(g["tracks"]) >= 3 else "small"
        used = set()
        for t in g["tracks"]:
            name = stage_name(t["src"])
            base, ext = os.path.splitext(name)
            n = 1
            while name.casefold() in used:
                n += 1
                name = "%s (%d)%s" % (base, n, ext)
            used.add(name.casefold())
            entries.append({"src": t["src"], "dst": "%s/%05d/%s" % (bucket, gi, name),
                            "edits": t["edits"], "size": t["size"]})
    used = set()
    for t in loose:
        name = stage_name(t["src"])
        base, ext = os.path.splitext(name)
        n = 1
        while name.casefold() in used:
            n += 1
            name = "%s (%d)%s" % (base, n, ext)
        used.add(name.casefold())
        entries.append({"src": t["src"], "dst": "loose/" + name, "edits": t["edits"], "size": t["size"]})
    for t in dupes:
        name = stage_name(t["src"])
        base, ext = os.path.splitext(name)
        n = 1
        while ("dupes/" + name).casefold() in used:
            n += 1
            name = "%s (%d)%s" % (base, n, ext)
        used.add(("dupes/" + name).casefold())
        entries.append({"src": t["src"], "dst": "dupes/" + name, "edits": {}, "size": t["size"]})
    plan = {
        "source": str(source), "entries": entries, "unreadable": unreadable,
        "stats": dict(stats), "genres": {k: dict(v) for k, v in genre_counts.items()},
        "albums": len(groups), "full": sum(len(g["tracks"]) >= 3 for g in groups),
        "loose": len(loose), "hidden_dirs": len(hidden), "total_bytes": sum(e["size"] for e in entries),
                "changes": [[t["src"], k if k != "_rawdel" else "removed tag",
                     "; ".join(t["genres"]) if k == "genre" else
                     (str(t.get(k, "")) if not k.startswith("_") else ""), str(v)]
                    for t in tracks for k, v in t["edits"].items()],
    }
    sp["local"].mkdir(parents=True, exist_ok=True)
    sp["plan"].write_text(json.dumps(plan))
    return plan


def print_report(plan, sp):
    n = len(plan["entries"]) + len(plan["unreadable"])
    size = plan["total_bytes"]
    ui.kv("Music files", "%s  (%s)" % (fmt_n(n), "%.1f GB" % (size / 1e9) if size >= 1e9 else "%d MB" % (size / 1e6)))
    ui.kv("Albums", "%s  (%s with 3+ tracks)" % (fmt_n(plan["albums"]), fmt_n(plan["full"])))
    if plan.get("hidden_dirs"):
        ui.kv("Dot-named folders", "%s  (included; their names get a … instead)" % fmt_n(plan["hidden_dirs"]))
    if plan["loose"]:
        ui.kv("Loose tracks", fmt_n(plan["loose"]) + "  (no album name)")
    if plan["unreadable"]:
        ui.kv("Unreadable", "%s  (copies go to %s)" % (fmt_n(len(plan["unreadable"])), pretty_path(sp["needs"])))
    stats = [(k, v) for k, v in plan["stats"].items() if v]
    ui.say()
    if stats:
        ui.say(ui.bold("Fixes planned"), log=False)
        ui.to_log("Fixes planned")
        for k, v in sorted(stats, key=lambda kv: -kv[1]):
            if v == 1:  # "1 album", not "1 albums"
                k = re.sub(r"^(albums|tracks|junk genres|duplicate copies)\b",
                           lambda m: {"albums": "album", "tracks": "track", "junk genres": "junk genre",
                                      "duplicate copies": "duplicate copy"}[m.group(1)], k)
            ui.say("%9s  %s" % (fmt_n(v), k))
    else:
        ui.say("No tag fixes needed.")

    totals, sources = Counter(), defaultdict(Counter)
    for raw, d in plan["genres"].items():
        for tgt, c in d.items():
            totals[tgt] += c
            sources[tgt][raw] += c
    before = len([g for g in plan["genres"] if g != "(none)"])
    after = len([g for g in totals if g != "(no match)"])
    ui.say()
    ui.say(ui.bold("Genres") + "  %d now → %d after" % (before, after), log=False)
    ui.to_log("Genres  %d now -> %d after" % (before, after))
    for tgt in sorted([g for g, _ in GENRES if totals.get(g)], key=lambda g: -totals[g]) + ["(no match)"]:
        if not totals.get(tgt):
            continue
        src = [r for r, _ in sources[tgt].most_common()]
        shown = ", ".join(src[:4]) + (ui.dim(" +%d more" % (len(src) - 4)) if len(src) > 4 else "")
        label = tgt if tgt != "(no match)" else "(no genre yet)"
        if tgt == "(no match)":
            shown = ui.dim("looked up online during run")
        ui.say("  %-20s %7s   %s" % (label, fmt_n(totals[tgt]), shown))

    csv_path = sp["changes_csv"]
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    import csv
    with open(str(csv_path), "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["file", "field", "old", "new"])
        w.writerows(plan["changes"])
    est = plan["full"] * 3 + (plan["albums"] + plan["loose"]) * 1.2 + n * 0.05
    ui.say()
    ui.kv("Every change", pretty_path(csv_path))
    ui.kv("Time for run", "about a minute" if est < 90 else "about %d minutes" % round(est / 60)
          if est < 5400 else "about %.1f hours" % (est / 3600))
    ui.result(action="scan", ok=True, files=n, bytes=size, albums=plan["albums"], full_albums=plan["full"],
              loose=plan["loose"], unreadable=len(plan["unreadable"]), dot_folders=plan.get("hidden_dirs", 0),
              fixes=plan["stats"], genres={"before": before, "after": after, "totals": dict(totals)},
              estimate_seconds=int(est), changes_csv=str(csv_path))


def do_copy(plan, sp):
    staging = sp["staging"]
    done = set()
    if sp["copied"].exists():
        done = set(sp["copied"].read_text(encoding="utf-8").splitlines())
    todo = [e for e in plan["entries"] if e["dst"] not in done]
    if not todo:
        ui.ok("All files already copied")
        return
    # fast copies: APFS clones on a Mac, reflinks on btrfs/XFS; test once, else plain copy
    mode = "copy"
    sp["work"].mkdir(parents=True, exist_ok=True)
    probe = sp["work"] / ".probe"
    for cand, cmd in (("clone", ["cp", "-c"]), ("reflink", ["cp", "--reflink=always"])):
        if (cand == "clone") != (sys.platform == "darwin") or not shutil.which("cp"):
            continue
        ok = subprocess.run(cmd + [todo[0]["src"], str(probe)], capture_output=True).returncode == 0
        if probe.exists():
            probe.unlink()
        if ok:
            mode = cand
            break
    need = sum(e["size"] for e in todo)
    free = shutil.disk_usage(str(sp["work"])).free
    if mode == "copy" and need * 1.05 + 1e9 > free and not os.environ.get("MUSIC_CLEANUP_SKIP_SPACE"):
        die("Not enough free space on that drive: need about %.1f GB, have %.1f GB." % (need / 1e9, free / 1e9),
            "Free up some space and run the same command again. Nothing has been changed.")
    ui.to_log("       copy method: %s, %.1f GB, %.1f GB free" % (mode, need / 1e9, free / 1e9))
    problems = []
    with open(str(sp["copied"]), "a", encoding="utf-8") as log, ui.progress(len(todo), "Copying") as bar:
        for n, e in enumerate(todo, 1):
            dst = staging / e["dst"]
            dst.parent.mkdir(parents=True, exist_ok=True)
            bar.update(note=Path(e["src"]).name)
            try:
                copy_file(e["src"], str(dst), mode)
            except FileNotFoundError:
                problems.append("gone since the scan: %s" % e["src"])
                log.write(e["dst"] + "\n")
                continue
            except OSError as ex:
                problems.append("couldn't copy %s (%s); it stays only in your originals" % (e["src"], ex))
                continue
            try:
                apply_edits(str(dst), e["edits"])
            except Exception as ex:
                problems.append("couldn't write tags to %s (%s); kept as it was" % (e["src"], ex))
            log.write(e["dst"] + "\n")
            if n % 200 == 0:
                log.flush()
        bar.note = ""
        bar.summary = "Copied %s files and fixed their tags (your originals are untouched)" % fmt_n(len(todo))
    for p in problems[:5]:
        ui.warn(p)
    for p in problems[5:]:
        ui.to_log("NOTE   " + p)
    if len(problems) > 5:
        ui.warn("...and %d more like that (all listed in the log)" % (len(problems) - 5))


def do_import(sp, offline):
    b = Beets(sp)
    st = sp["staging"]
    passes = [("full", [], "Albums"), ("small", ["-A"], "Singles"), ("loose", ["-A", "-s"], "Loose")]
    for name, flags, label in passes:
        d = st / name
        total = count_audio(d)
        if not total:
            continue
        if offline and "-A" not in flags:
            flags = flags + ["-A"]
        for attempt in (1, 2):
            with ui.progress(total, label) as bar:
                rc = b.run_watching(["import", "-q"] + flags + [str(d)], lambda: total - count_audio(d), bar)
                bar.summary = {"full": "Organized %s tracks on full albums%s",
                               "small": "Organized %s tracks from partial albums and singles%s",
                               "loose": "Organized %s loose tracks%s"}[name] % (
                    fmt_n(total), " (checked against MusicBrainz)" if name == "full" and not offline else "")
                if rc != 0:
                    bar.summary = "%s: beets stopped early" % label
            if rc == 0:
                break
            if attempt == 1:
                ui.warn("beets hit a problem on this step; trying it once more...")
                total = count_audio(d) or total
            else:
                die("beets keeps failing on this step, so I stopped. Nothing in your music folder was changed.",
                    "The details are in %s." % pretty_path(sp["details"]))
    with ui.spinner("Saving the tidied tags into the files") as s:
        # beets drops the compilation flag on as-is albums; put it back for real compilations
        b.run("modify", "-y", "-a", "albumartist::^%s$" % VA, "comp=1")
        b.run("write")  # make file tags match beets (e.g. "feat." moved into titles)
        s.summary = "Saved the tidied tags into the files"


def do_genres_and_art(sp, offline):
    b = Beets(sp)
    if offline:
        return
    gf = genre_field()
    empty = [l.split("\t")[0] for l in b.lines("ls", "-a", "-f", "$id\t$" + gf) if not l.split("\t")[1].strip()]
    if empty:
        with ui.progress(len(empty), "Genres") as bar:
            for ch in chunks(empty, 10):
                b.run("lastgenre", "-f", *id_query(ch))
                bar.update(len(ch))
            bar.summary = "Looked up genres for %s albums that had none" % fmt_n(len(empty))
    fix = defaultdict(list)
    for l in b.lines("ls", "-a", "-f", "$id\t$" + gf):
        aid, genre = l.split("\t", 1)
        genre = re.split(r";\s*|,\s*", genre)[0].strip()
        if genre and genre not in _GENRE_NAMES:
            fix[map_genre([genre]) or ""].append(aid)
    with ui.spinner("Folding new genres into your list") as s:
        for target, ids in fix.items():
            for ch in chunks(ids):
                b.run("modify", "-y", "-a", *id_query(ch), "%s=%s" % (gf, target))
        b.run("write")
        s.summary = "Every album now uses one of your %d genres" % len(GENRES)
    # artwork: fetch only for albums where some track still has none
    from mediafile import MediaFile
    rows = b.lines("ls", "-f", "$album_id\t$path")

    def lacks(row):
        aid, path = row.split("\t", 1)
        try:
            return aid if aid and not MediaFile(path).images else None
        except Exception:
            return None

    need = set()
    with ui.progress(len(rows), "Artwork") as bar, ThreadPoolExecutor(max_workers=8) as ex:
        for a in ex.map(lacks, rows):
            if a:
                need.add(a)
            bar.update()
        bar.summary = "Checked artwork: %s albums have none" % fmt_n(len(need)) if need \
            else "Checked artwork: every album has cover art"
    if need:
        ids = sorted(need, key=int)
        with ui.progress(len(ids), "Covers") as bar:
            for ch in chunks(ids, 10):
                b.run("fetchart", *id_query(ch))
                b.run("embedart", "-y", *id_query(ch))
                bar.update(len(ch))
            bar.summary = "Looked for cover art for %s albums" % fmt_n(len(ids))


def musicbrainz_reachable():
    url = "https://musicbrainz.org/ws/2/release/?query=test&limit=1&fmt=json"
    headers = {"User-Agent": "music-cleanup/1.0 ( beets )"}
    try:
        import requests
        requests.get(url, timeout=20, headers=headers)
        return True
    except ImportError:
        pass
    except Exception:
        return False
    import urllib.request
    import urllib.error
    try:
        urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=20).read(64)
        return True
    except urllib.error.HTTPError:
        return True  # server answered (e.g. busy) - it's reachable
    except Exception:
        return False


def write_ignore_markers(folder):
    """Tell Navidrome / Plex / Jellyfin to skip a folder."""
    for marker, text in ((".ndignore", ""), (".plexignore", "*\n"), (".ignore", "")):
        try:
            (folder / marker).write_text(text)
        except OSError:
            pass


def finish(plan, sp):
    b = Beets(sp)
    needs = sp["needs"]
    genre_safety_pass(sp)
    with ui.spinner("Final checks and reports") as s:
        for p in [p for p in sp["staging"].rglob("*") if p.is_file() and is_audio_name(p.name)]:
            rel = p.relative_to(sp["staging"])
            if rel.parts[0] == "dupes":
                dst = needs / "duplicates" / Path(*rel.parts[1:])
            else:
                dst = needs / "not imported" / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(p), str(dst))
        for src in plan["unreadable"]:
            dst = needs / "unreadable" / os.path.relpath(src, plan["source"])
            dst.parent.mkdir(parents=True, exist_ok=True)
            if not dst.exists():
                shutil.copy2(src, str(dst))
        shutil.rmtree(str(sp["staging"]), ignore_errors=True)

        in_lib = len(b.lines("ls", "-f", "$id\t$path"))
        in_needs = count_audio(needs)
        expected = len(plan["entries"]) + len(plan["unreadable"])
        import csv
        albums = b.lines("ls", "-a", "-f", "$id\t$albumartist\t$album\t$year\t$" + genre_field()
                         + "\t$data_source\t$path")
        counts = Counter(l.split("\t")[0] for l in b.lines("ls", "-f", "$album_id\t$id"))
        same = Counter((l.split("\t")[1].casefold(), l.split("\t")[2].casefold()) for l in albums)
        with open(str(sp["report_csv"]), "w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(["Album Artist", "Album", "Year", "Genre", "Tracks", "Matched online", "Folder", "Note"])
            for l in albums:
                aid, aa, al, yr, ge, ds, path = (l.split("\t") + [""] * 7)[:7]
                note = "same name as another album: duplicate or different edition?" \
                    if same[(aa.casefold(), al.casefold())] > 1 else ""
                w.writerow([aa, al, yr if yr.strip("0") else "", ge, counts.get(aid, 0),
                            "yes" if ds.strip() and ds != "$data_source" else "",
                            os.path.relpath(path, str(sp["cleaned"])), note])
        twins = sum(1 for v in same.values() if v > 1)
        sp["done"].write_text(time.strftime("%Y-%m-%d %H:%M"))
        s.summary = "Final checks done"

    all_ok = in_lib + in_needs >= expected
    ui.say()
    ui.rule()
    if all_ok:
        ui.line("  " + ui.green("✓ Done. Your cleaned library is ready.") + " " + ui.dim("Your player still shows the old one."),
                "DONE   cleaned library ready")
    else:
        ui.line("  " + ui.yellow("! Done, but some files are unaccounted for (see below)."), "DONE   with missing files")
    ui.rule()
    ui.kv("In the library", "%s tracks" % fmt_n(in_lib), 18)
    if in_needs:
        ui.kv("Set aside for you", "%s  (duplicates / unreadable → %s)" % (fmt_n(in_needs), pretty_path(needs)), 18)
    ui.kv("Accounted for", "%s of %s %s" % (fmt_n(in_lib + in_needs), fmt_n(expected),
                                             ui.green("✓") if all_ok else ui.red("← some are missing (see the log)")), 18)
    if twins:
        ui.kv("Same-name albums", "%d  (marked in the album report: duplicate or edition?)" % twins, 18)
    ui.kv("Took", fmt_time(time.time() - ui.started), 18)
    ui.say()
    ui.say("In %s:" % pretty_path(sp["out"]), log=False)
    for f, what in ((sp["report_csv"], "the finished album list"), (sp["changes_csv"], "every tag change"),
                    (sp["log"], "what happened, step by step"), (sp["details"], "technical details, if anything goes wrong")):
        ui.say("  %-36s %s" % (f.name, ui.dim(what)), log=False)
    ui.say()
    ui.say("Next, swap it in (Navidrome is paused and backed up for you):")
    ui.cmd(script_cmd(plan["source"], "finalize"))
    ui.result(action="run", ok=all_ok, in_library=in_lib, set_aside=in_needs, expected=expected,
              same_name_albums=twins, album_report=str(sp["report_csv"]), changes_csv=str(sp["changes_csv"]),
              needs_attention=str(needs), log=str(sp["log"]), details=str(sp["details"]))


def finalize(source, sp, undo=False):
    """Swap the cleaned library in (or back out). Every move is recorded first, so an
    interrupted swap can simply be run again, and --undo always knows what to put back."""
    cleaned, backup = sp["cleaned"], sp["backup"]
    journal = sp["local"] / "swap.json"
    if sp["local"].joinpath("BACKUP_DELETED").exists():
        die("Your originals were deleted after the swap, so there's nothing to swap or undo.")
    if not undo:
        ui.step(1, 1, "Swapping the cleaned library in")
        if not sp["done"].exists():
            die("The cleaned library isn't built yet.", "Run this first:\n  " + script_cmd(source, "run"))
        if sp["final"].exists():
            die("It's already swapped in.", "To go back to your originals:\n  " + script_cmd(source, "--undo"))
        if journal.exists():
            j = json.loads(journal.read_text())
            ui.warn("Finishing an earlier swap that was interrupted")
        else:
            plan = json.loads(sp["plan"].read_text())
            known = {e["src"] for e in plan["entries"]} | set(plan["unreadable"])
            added = [p for p in scan_files(source) if str(p) not in known]
            if added:  # music added after the scan: keep a copy where you'll see it
                dest = sp["needs"] / "added after the scan"
                for p in added:
                    d = dest / p.relative_to(source)
                    d.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(str(p), str(d))
                ui.warn("%s files were added after the scan; copies are in %s" % (fmt_n(len(added)), pretty_path(dest)))
            j = {"orig": sorted(p.name for p in source.iterdir() if p.name != WORK),
                 "new": sorted(p.name for p in cleaned.iterdir())}
            journal.write_text(json.dumps(j))
        with ui.spinner("Swapping") as s:
            backup.mkdir(parents=True, exist_ok=True)
            for n in j["orig"]:
                if os.path.lexists(str(source / n)) and not os.path.lexists(str(backup / n)):
                    os.rename(str(source / n), str(backup / n))
            for n in j["new"]:
                if os.path.lexists(str(cleaned / n)) and not os.path.lexists(str(source / n)):
                    os.rename(str(cleaned / n), str(source / n))
            sp["final"].write_text(time.strftime("%Y-%m-%d %H:%M"))
            s.summary = "Swapped in. Your originals are kept safely in a hidden backup"
    else:
        ui.step(1, 1, "Putting your original library back")
        if not journal.exists():
            die("There's nothing to undo.")
        if not backup.is_dir() or not any(backup.iterdir()):
            die("The copy of your originals in %s is missing, so I won't undo." % pretty_path(backup))
        j = json.loads(journal.read_text())
        with ui.spinner("Restoring") as s:
            cleaned.mkdir(parents=True, exist_ok=True)
            for n in j["new"]:
                if os.path.lexists(str(source / n)) and not os.path.lexists(str(cleaned / n)):
                    os.rename(str(source / n), str(cleaned / n))
            for n in j["orig"]:
                if os.path.lexists(str(backup / n)) and not os.path.lexists(str(source / n)):
                    os.rename(str(backup / n), str(source / n))
            if sp["final"].exists():
                sp["final"].unlink()
            journal.unlink()
            s.summary = "Your original library is back, exactly as it was"


def delete_backup(sp):
    ui.step(1, 1, "Deleting the backup of your originals")
    if not sp["final"].exists():
        die("Only after the cleaned library is swapped in (finalize).")
    if not sp["backup"].is_dir():
        die("There's no backup to delete.")
    ui.warn("This permanently deletes your ORIGINAL music files (the hidden backup).")
    ui.say("You can't undo the swap after this.")
    if not confirm("Delete the backup?", word="DELETE"):
        ui.ok("Nothing deleted")
        return
    with ui.spinner("Deleting") as s:
        shutil.rmtree(str(sp["backup"]))
        sp["local"].joinpath("BACKUP_DELETED").write_text(time.strftime("%Y-%m-%d %H:%M"))
        leftover = [p for p in sp["cleaned"].rglob("*") if p.is_file()] if sp["cleaned"].exists() else []
        if not leftover:
            shutil.rmtree(str(sp["work"]), ignore_errors=True)
        s.summary = "Backup deleted and the space freed"
    ui.result(action="delete-backup", ok=True)



def count_audio(d):
    if not d.exists():
        return 0
    return sum(1 for p in d.rglob("*") if is_audio_name(p.name) and p.is_file())



# ============================================================== genres: check & fix the finished library
# Navidrome splits genre tags on ";", "/" and "," ("R&B/Soul" shows as both R&B and Soul), and reads
# every genre field a file has. This reads them the same way, so what it reports is what Navidrome shows.
SEPARATORS = re.compile(r"\s*[;/,]\s*")


def _id3_genre_names():
    try:
        from mutagen.id3 import TCON
        return list(TCON.GENRES)
    except Exception:
        return []


def read_genre_fields(path):
    """Every genre value stored in the file, from every tag type it carries."""
    import mutagen
    vals = []
    try:
        f = mutagen.File(path)
    except Exception:
        return None
    if f is None:
        return None
    tags = f.tags
    if tags is not None:
        if hasattr(tags, "getall"):                       # ID3 (mp3, aiff, wav)
            for fr in tags.getall("TCON"):
                vals += [str(g) for g in (getattr(fr, "genres", None) or fr.text)]
        elif type(tags).__name__ == "MP4Tags":            # m4a / aac / alac
            names = _id3_genre_names()
            vals += [str(v) for v in tags.get("\xa9gen", [])]
            for v in tags.get("gnre", []):                # old iTunes numeric genre
                v = v[0] if isinstance(v, (list, tuple)) else v
                if isinstance(v, int) and 0 < v <= len(names):
                    vals.append(names[v - 1])
        elif type(tags).__name__ == "ASFTags":            # wma
            vals += [str(v) for v in tags.get("WM/Genre", [])]
        else:                                             # flac / ogg / opus (Vorbis comments), ape...
            try:
                vals += [str(v) for v in (tags.get("genre") or tags.get("GENRE") or [])]
            except Exception:
                pass
    if Path(path).suffix.lower() in (".mp3", ".ape", ".wv", ".mpc"):
        try:
            from mutagen.apev2 import APEv2
            ape = APEv2(path)
            if "Genre" in ape:
                vals += [v for v in str(ape["Genre"]).split("\0") if v]
        except Exception:
            pass
    return vals


def write_genre_fields(path, genre):
    """Set the genre to exactly one value in every genre field the file has."""
    import mutagen
    f = mutagen.File(path)
    if f is None:
        raise RuntimeError("can't read this file")
    if f.tags is None:
        f.add_tags()
    tags = f.tags
    if hasattr(tags, "getall"):
        from mutagen.id3 import TCON
        tags.setall("TCON", [TCON(encoding=3, text=[genre])])
        v3 = getattr(tags, "version", (2, 4, 0))[1] == 3  # beets writes ID3v2.3; keep it that way
        try:
            f.save(v2_version=3) if v3 else f.save()
        except TypeError:
            f.save()
    else:
        if type(tags).__name__ == "MP4Tags":
            tags["\xa9gen"] = [genre]
            if "gnre" in tags:
                del tags["gnre"]
        elif type(tags).__name__ == "ASFTags":
            tags["WM/Genre"] = [genre]
        else:
            for k in [k for k in list(tags.keys()) if str(k).lower() == "genre"]:
                del tags[k]
            tags["genre"] = [genre]
        f.save()
    if Path(path).suffix.lower() in (".mp3", ".ape", ".wv", ".mpc"):
        try:
            from mutagen.apev2 import APEv2
            ape = APEv2(path)
            if "Genre" in ape:
                ape["Genre"] = genre
                ape.save(path)
        except Exception:
            pass


def genre_tokens(vals):
    """Genres the way Navidrome lists them: split, and each one once ("Pop; Pop" is just Pop)."""
    return list(dict.fromkeys(t for v in vals or [] for t in SEPARATORS.split(v.strip()) if t))


APE_SUFFIXES = (".mp3",)


def has_ape(path):
    """MP3s sometimes carry an old APE tag next to the normal one. beets only rewrites the normal
    (ID3) tag, so the APE one keeps stale genres, names and albums, and Navidrome reads it."""
    if Path(path).suffix.lower() not in APE_SUFFIXES:
        return False
    try:
        from mutagen.apev2 import APEv2
        APEv2(path)
        return True
    except Exception:
        return False


def strip_ape(path):
    from mutagen.apev2 import delete
    delete(path)


def plan_genre_fixes(source, tracks):
    """tracks: [(path, values)]. Returns (fixes, unplaceable) with one genre per album folder."""
    albums = defaultdict(list)
    for p, vals in tracks:
        albums[Path(p).parent].append((p, vals))
    artist_fav = defaultdict(Counter)
    for d, ts in albums.items():
        for p, vals in ts:
            mg = map_genre(vals)
            if mg:
                artist_fav[akey(d.parent.name)][mg] += 1
    order = {name: i for i, (name, _) in enumerate(GENRES)}
    fixes, unplaceable = [], []
    for d, ts in sorted(albums.items(), key=lambda kv: str(kv[0])):
        toks = [genre_tokens(v) for _, v in ts]
        stray = any(any(t not in _GENRE_NAMES for t in tk) for tk in toks)
        mixed = len({tuple(tk) for tk in toks}) > 1
        if not stray and not mixed:
            continue
        mapped = [map_genre(v) for _, v in ts]
        counts = Counter(m for m in mapped if m)
        if HOLIDAY_RE.search(d.name) or (counts.get("Holiday") and counts["Holiday"] * 3 >= len(ts)):
            target = "Holiday"
        elif counts:
            top = max(counts.values())
            tied = [g for g in counts if counts[g] == top]
            fav = artist_fav[akey(d.parent.name)]
            target = sorted(tied, key=lambda g: (-fav[g], order.get(g, 99)))[0]
        else:
            unplaceable.append((str(d), sorted({t for tk in toks for t in tk})))
            continue
        for (p, vals), tk in zip(ts, toks):
            if tk != [target]:
                fixes.append((p, "; ".join(vals), target))
    return fixes, unplaceable


def read_all_genres(files, label="Reading"):
    tracks, unreadable = [], []

    ape = []

    def one(p):
        try:
            return p, read_genre_fields(str(p)), has_ape(str(p))
        except Exception:
            return p, None, False

    with ui.progress(len(files), label) as bar, ThreadPoolExecutor(max_workers=8) as ex:
        for p, vals, a in ex.map(one, files):
            (unreadable.append(str(p)) if vals is None else tracks.append((str(p), vals)))
            if a:
                ape.append(str(p))
            bar.update(note=p.parent.name)
        bar.note = ""
        bar.summary = "Read the genres of %s songs" % fmt_n(len(files))
    return tracks, unreadable, ape


def genre_safety_pass(sp):
    """Last step of run: whatever slipped through (a second genre field, a tag beets didn't
    rewrite...), every song in the cleaned library ends up with one of your genres."""
    with ui.spinner("Finding music files") as s:
        files = scan_files(sp["cleaned"])
        s.summary = "Found %s music files" % fmt_n(len(files))
    if not files:
        return
    tracks, _, ape = read_all_genres(files, "Genre check")
    stripped = 0
    for p in ape:  # beets already wrote everything into the normal tag; the APE one is stale
        try:
            strip_ape(p)
            stripped += 1
            ui.to_log("       removed old APE tag: %s" % p)
        except Exception as e:
            ui.to_log("NOTE   couldn't remove the APE tag of %s: %s" % (p, e))
    if stripped:
        ui.ok("Removed stale APE tags from %s MP3s" % fmt_n(stripped))
        tracks = [(p, vals if p not in set(ape) else read_genre_fields(p) or []) for p, vals in tracks]
    fixes, unplaceable = plan_genre_fixes(sp["cleaned"], tracks)
    failed = 0
    for p, old, target in fixes:
        try:
            write_genre_fields(p, target)
            ui.to_log("       genre: %s  [%s] -> %s" % (p, old, target))
        except Exception as e:
            failed += 1
            ui.to_log("NOTE   couldn't fix the genre of %s: %s" % (p, e))
    if fixes:
        ui.ok("Folded the last %s songs with other genres into yours" % fmt_n(len(fixes) - failed))
    for d, g in unplaceable:
        ui.to_log("NOTE   can't place the genre of %s  [%s]" % (d, ", ".join(g)))
    if unplaceable:
        ui.warn("%s albums have genres that match none of your rules (listed in the log)" % fmt_n(len(unplaceable)))


def genres_cmd(source, sp, apply=False):
    ui.step(1, 2, "Reading every file's genre tags")
    with ui.spinner("Finding music files") as s:
        files = scan_files(source)
        s.summary = "Found %s music files" % fmt_n(len(files))
    tracks, unreadable, ape = read_all_genres(files)

    seen = Counter(t for _, v in tracks for t in genre_tokens(v))
    stray = {g: n for g, n in seen.items() if g not in _GENRE_NAMES}
    no_genre = sum(1 for _, v in tracks if not genre_tokens(v))
    fixes, unplaceable = plan_genre_fixes(source, tracks)

    ui.step(2, 2, "What I found")
    ui.kv("Genres in files", "%d  (%d of them yours)" % (len(seen), len(set(seen) & _GENRE_NAMES)), 18)
    if stray:
        ui.say(ui.bold("Not one of your genres:"), log=False)
        for g, n in sorted(stray.items(), key=lambda kv: -kv[1])[:25]:
            ui.say("  %-28s %7s song%s" % (g, fmt_n(n), "" if n == 1 else "s"))
    if no_genre:
        ui.kv("No genre at all", "%s songs (left alone)" % fmt_n(no_genre), 18)
    csv_path = sp["out"] / "music_genre_fixes.csv"
    import csv
    with open(str(csv_path), "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["file", "genre now", "genre after"])
        w.writerows(fixes)
    albums_fixed = len({str(Path(p).parent) for p, _, _ in fixes})
    ui.kv("To fix", "%s songs in %s albums  (list: %s)" % (fmt_n(len(fixes)), fmt_n(albums_fixed),
                                                          pretty_path(csv_path)), 18)
    if ape:
        ui.kv("Old APE tags", "%s MP3s also carry a stale APE tag that Navidrome reads (removed on --apply)"
              % fmt_n(len(ape)), 18)
        for p in ape:
            ui.to_log("       APE tag: %s" % p)
    if unplaceable:
        ui.kv("Can't place", "%s albums whose genres match none of your rules (left alone):"
              % fmt_n(len(unplaceable)), 18)
        for d, g in unplaceable[:10]:
            ui.say("  %s  [%s]" % (pretty_path(d), ", ".join(g)))
        for d, g in unplaceable[10:]:
            ui.to_log("       can't place: %s  [%s]" % (d, ", ".join(g)))
        if len(unplaceable) > 10:
            ui.say(ui.dim("  ...and %d more (in the log)" % (len(unplaceable) - 10)), log=False)
    result = dict(action="genres", files=len(files), unreadable=len(unreadable), stray=stray,
                  no_genre=no_genre, to_fix=len(fixes), albums=albums_fixed,
                  unplaceable=[d for d, _ in unplaceable], fixes_csv=str(csv_path), ape_tags=len(ape))

    if not fixes and not ape:
        ui.say()
        if unplaceable:
            ui.ok("Nothing more to fix automatically. The albums above need a genre set by hand.")
        else:
            ui.ok("Every file already uses your genres.")
        ui.say("If Navidrome still lists other old genres, they belong to entries for files that moved:")
        ui.say("remove them from Missing Files in Navidrome's user menu, then run a full scan.")
        ui.result(ok=True, applied=0, **result)
        return
    if not apply:
        ui.say()
        ui.ok("Nothing was changed. To fix them:")
        ui.cmd(script_cmd(source, "genres") + " --apply")
        ui.result(ok=True, applied=0, **result)
        return
    what = " and ".join(x for x in ("rewrite the genre of %s songs" % fmt_n(len(fixes)) if fixes else "",
                                     "remove %s stale APE tags" % fmt_n(len(ape)) if ape else "") if x)
    if not confirm(what[0].upper() + what[1:] + "?"):
        ui.ok("Nothing changed")
        return
    failed = []
    if ape:
        with ui.progress(len(ape), "APE tags") as bar:
            for p in ape:
                try:
                    strip_ape(p)
                except Exception as e:
                    failed.append((p, "APE tag: %s" % e))
                bar.update(note=Path(p).parent.name)
            bar.note = ""
            bar.summary = "Removed stale APE tags from %s MP3s" % fmt_n(len(ape) - len(failed))
    if fixes:
        with ui.progress(len(fixes), "Fixing") as bar:
            for p, _, target in fixes:
                try:
                    write_genre_fields(p, target)
                except Exception as e:
                    failed.append((p, str(e)))
                bar.update(note=Path(p).parent.name)
            bar.note = ""
            bar.summary = "Set %s songs to one of your genres" % fmt_n(len(fixes) - len(failed))
    for p, e in failed[:5]:
        ui.warn("Couldn't fix %s: %s" % (pretty_path(p), e))
    for p, e in failed[5:]:
        ui.to_log("NOTE   couldn't fix %s: %s" % (p, e))
    ui.say()
    ui.say("Now in Navidrome: run a full scan, then remove what's left under Missing Files.")
    ui.result(ok=not failed, applied=len(fixes) + len(ape) - len(failed), failed=len(failed), **result)



# ============================================================== navidrome
# Lessons from the first big cleanup: Navidrome must be stopped while folders swap; its image cache
# keeps "no cover" placeholders afterwards; and the folder it reads is ND_MUSICFOLDER, which isn't
# always the /music mount you'd expect.
def is_navidrome(c):
    return "navidrome" in (c["image"] + " " + c["name"]).lower()


def describe_navidrome(c):
    if "mounts" not in c:
        c.update(inspect_container(c["name"]))
    c["navidrome"] = True
    c["music_inside"] = c["env"].get("ND_MUSICFOLDER", "/music")
    c["music_dir"] = host_path(c, c["music_inside"])
    c["data_dir"] = host_path(c, c["env"].get("ND_DATAFOLDER", "/data"))
    return c


def check_navidrome_folder(c, library):
    md = c.get("music_dir")
    if md is None:
        ui.warn("%s reads %s, which is a Docker-managed volume, not your library." % (c["name"], c["music_inside"]))
        ui.say("  Point ND_MUSICFOLDER at the folder where your library is mounted.")
        return False
    if not overlaps(md, library):
        ui.warn("%s reads %s, not %s." % (c["name"], md, library))
        return False
    return True


def backup_navidrome(c, out):
    """Copy Navidrome's users, plays and playlists, and move its artwork cache aside."""
    d = c.get("data_dir")
    if not d or not Path(d).is_dir():
        ui.warn("Couldn't find %s's data folder, so it wasn't backed up." % c["name"])
        return None
    stamp = time.strftime("%Y%m%d-%H%M%S")
    dest, n = out / ("navidrome-backup-%s" % stamp), 1
    while dest.exists():
        n += 1
        dest = out / ("navidrome-backup-%s-%d" % (stamp, n))
    with ui.spinner("Backing up %s's data (users, plays, playlists)" % c["name"]) as s:
        shutil.copytree(str(d), str(dest), ignore=shutil.ignore_patterns("cache"))
        images = Path(d) / "cache" / "images"
        if images.is_dir():  # stale "no cover" results otherwise linger after the swap
            shutil.move(str(images), str(dest / "image-cache-old"))
        s.summary = "Backed up %s's data to %s" % (c["name"], pretty_path(dest))
    return dest


def find_navidromes():
    return [describe_navidrome(c) for c in list_containers() if is_navidrome(c)] if docker_ok() else []


# ============================================================== where beets runs
def local_engine_ready():
    try:
        import beets  # noqa: F401
        import mediafile  # noqa: F401
        return True
    except ImportError:
        pass
    py = Path.home() / ".music-cleanup" / "venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    return py.exists() and subprocess.run([str(py), "-c", "import beets, mediafile"],
                                          capture_output=True).returncode == 0


def beets_image():
    img = CFG["music"].get("beets_image") or ""
    if img or not docker_ok():
        return img
    for c in list_containers():
        if re.search(r"(^|/)beets(:|@|$)", c["image"]):
            return c["image"]
    return ""


def choose_engine(override=None):
    if os.environ.get("HOMELAB_MEDIA_IN_CONTAINER"):
        return "local", ""
    mode = override or CFG["music"].get("engine") or "auto"
    if mode == "local":
        return "local", ""
    if os.name == "nt":
        # The engine's container sees each folder at the same path as here, and M:\music can't be a
        # path in a Linux container: on Windows, beets runs on this machine.
        if mode == "container":
            ui.warn("beets' container can't open Windows folders; running beets on this machine instead.")
        return "local", ""
    img = beets_image()
    if img:
        return "container", img
    if mode == "container":
        die("There's no beets image to run the engine in.",
            'Pull one (docker pull lscr.io/linuxserver/beets), or set "engine": "local" in the settings.')
    return "local", ""


def engine_in_container(img, source, argv):
    """Run this same script inside a throwaway container from the beets image. Every folder is
    mounted at the same path as here, so paths, saved progress and reports are all shared."""
    state = Path.home() / ".music-cleanup"
    state.mkdir(parents=True, exist_ok=True)
    out = reports_dir()
    script = Path(os.path.abspath(__file__))
    want = [(source, False), (state, False), (out, False), (script.parent, True)]
    if CFG_PATH:
        want.append((CFG_PATH.parent, True))
    mounts = []
    for p, ro in want:
        p = str(p)
        if any(p == m or (p.startswith(m.rstrip("/") + "/") and not mro) for m, mro in mounts):
            continue  # already reachable through a writable folder above it
        mounts.append((p, ro))
    cmd = ["docker", "run", "--rm", "--init", "--name", "music-organizer-engine-%d" % os.getpid(),
           "--label", "homelab.media.engine=music", "--entrypoint", "sh", "--network", "bridge"]
    if sys.stdin.isatty() and sys.stdout.isatty() and not ui.events:
        cmd += ["-it"]
    if hasattr(os, "getuid"):
        cmd += ["-u", "%d:%d" % (os.getuid(), os.getgid())]  # new files belong to you, not root
    for p, ro in mounts:
        cmd += ["-v", "%s:%s%s" % (p, p, ":ro" if ro else "")]
    env = {"HOME": str(Path.home()), "HOMELAB_MEDIA_IN_CONTAINER": "1", "HOMELAB_MEDIA_REPORTS": str(out),
           "TERM": os.environ.get("TERM", "xterm-256color")}
    for k in ("HOMELAB_MEDIA_EVENTS", "NO_COLOR", "MUSIC_CLEANUP_SKIP_SPACE"):
        if os.environ.get(k):
            env[k] = os.environ[k]
    if CFG_PATH:
        env["HOMELAB_MEDIA_CONFIG"] = str(CFG_PATH)
    for k, v in env.items():
        cmd += ["-e", "%s=%s" % (k, v)]
    cmd += [img, "-c", 'P=$(command -v /lsiopy/bin/python3 || command -v python3); exec "$P" "$@"', "sh",
            str(script)] + argv
    ui.to_log("       engine: " + " ".join(cmd))
    try:
        return subprocess.call(cmd)
    except KeyboardInterrupt:
        return 130


# ============================================================== music: commands
def script_cmd(source, action):
    args = [action.lstrip("-")]
    lib = CFG["music"].get("library")
    if not lib or Path(os.path.expanduser(lib)).resolve() != Path(source).resolve():
        args += ["--library", str(source)]
    return me(*args)


def swap(source, sp, undo=False):
    """Finalize or undo, with every container using the library paused, and Navidrome backed up."""
    journal = sp["local"] / "swap.json"
    if undo and not journal.exists():
        die("There's nothing to undo.")
    if not undo and not sp["done"].exists():
        die("The cleaned library isn't built yet.", "Run this first:\n  " + script_cmd(source, "run"))
    if not undo and sp["final"].exists():
        die("It's already swapped in.", "To check nothing went missing:\n  " + script_cmd(source, "verify"))

    setting = CFG["music"].get("pause_containers", "auto")
    conts = []
    if setting:
        if docker_ok():
            conts = [describe_navidrome(c) if is_navidrome(c) else c for c in containers_using(source, setting)]
        else:
            ui.warn("Docker isn't running, so I can't pause your music server.")
            ui.say("  Stop Navidrome yourself (or start Docker) before going on.")
    navi = [c for c in conts if c.get("navidrome")]
    announce_pause(conts, "during the swap")
    for c in navi:
        check_navidrome_folder(c, source)
    ui.say()
    if not confirm("Put your original library back?" if undo else "Swap the cleaned library in?"):
        ui.ok("Nothing changed")
        return

    keep_awake()
    backups = []
    with Paused(conts):
        for c in navi:
            b = backup_navidrome(c, sp["out"])
            if b:
                backups.append(b)
        finalize(source, sp, undo=undo)

    ui.say()
    if navi:
        ui.say(ui.bold("In Navidrome") + " (it rescans on start-up; give it a few minutes):", log=False)
        ui.say("  1. Run a full scan: activity icon, top right → full scan.")
        ui.say("  2. Faded albums are old entries for files that moved. Remove them from")
        ui.say("     Missing Files in the user menu (newer Navidrome versions).")
        ui.say("  3. Hard-refresh the browser (Cmd+Shift+R) if covers look stale.")
        for b in backups:
            ui.kv("Navidrome backup", pretty_path(b), 18)
    else:
        ui.say("Now run a full rescan in your music player.")
    if any(re.search(r"(^|/)beets(:|@|$)", c["image"]) for c in conts):
        ui.say("beets' own library (its web page) still lists the old file paths. If you use it,")
        ui.say("re-import the library there as-is so it matches the new layout.")
    if not undo:
        ui.say()
        ui.say("Then check that nothing went missing:")
        ui.cmd(script_cmd(source, "verify"))
        ui.say("Changed your mind? This puts everything back exactly as it was:")
        ui.cmd(script_cmd(source, "undo"))
    else:
        ui.say("To swap the cleaned one in again:")
        ui.cmd(script_cmd(source, "finalize"))
    ui.result(action="undo" if undo else "finalize", ok=True, paused=[c["name"] for c in conts],
              navidrome_backups=[str(b) for b in backups])


def verify(source, sp):
    """Compare the new library with the backup of the original, artist by artist."""
    ui.step(1, 1, "Checking nothing went missing")
    backup = sp["backup"]
    if not backup.is_dir() or not any(backup.iterdir()):
        die("There's no backup of your originals to compare with.",
            "verify works after finalize and before delete-backup.")

    def by_artist(root):
        counts, names = Counter(), {}
        for p in scan_files(root):
            rel = p.relative_to(root)
            top = rel.parts[0] if len(rel.parts) > 1 else "(loose files)"
            counts[akey(top)] += 1
            names.setdefault(akey(top), top)
        return counts, names

    with ui.spinner("Counting songs in both libraries") as s:
        new, _ = by_artist(source)
        old, names = by_artist(backup)
        aside = count_audio(sp["needs"])
        s.summary = "Counted songs in both libraries"
    n_new, n_old = sum(new.values()), sum(old.values())
    ui.kv("Original library", "%s songs" % fmt_n(n_old), 18)
    ui.kv("New library", "%s songs" % fmt_n(n_new), 18)
    ui.kv("Set aside", "%s songs  (%s)" % (fmt_n(aside), pretty_path(sp["needs"])), 18)
    gap = n_old - n_new - aside
    short = sorted(((k, old[k] - new.get(k, 0)) for k in old if old[k] > new.get(k, 0)), key=lambda kv: -kv[1])
    ui.result(action="verify", ok=gap <= 0, original=n_old, new=n_new, set_aside=aside, missing=max(gap, 0),
              artists_with_fewer=[{"artist": names[k], "fewer": d, "folder_missing": not new.get(k)}
                                  for k, d in short[:50]])
    if gap <= 0:
        ui.say()
        ui.ok("Every song is accounted for.")
        ui.say("When you're happy with the new library, free the space with:")
        ui.cmd(script_cmd(source, "delete-backup"))
        return
    ui.say()
    ui.warn("%s songs from your original library aren't in the new one or the set-aside folder." % fmt_n(gap))
    ui.say("Artists with fewer songs than before (some may just have moved under Various Artists):")
    for k, d in short[:15]:
        ui.say("  %-40s %s fewer%s" % (names[k][:40], fmt_n(d),
                                       ui.dim("  (artist folder missing)") if not new.get(k) else ""))
    if len(short) > 15:
        ui.say(ui.dim("  ...and %d more (listed in the log)" % (len(short) - 15)), log=False)
        for k, d in short[15:]:
            ui.to_log("       %s: %d fewer" % (names[k], d))
    ui.say()
    ui.say("Your originals are safe in %s. Don't run delete-backup until this is sorted." % pretty_path(backup))
    sys.exit(2)


def music_cmd(args):
    lib = args.library or CFG["music"].get("library")
    if not lib:
        die("Which music folder?", 'Add --library "/path/to/music", or save it once with:\n  ' + me("init"))
    source = Path(os.path.expanduser(lib)).resolve()
    if not source.is_dir():
        die("Folder not found: %s" % source, "Is the drive plugged in? Check the path and try again.")
    action = args.action

    if action in ("scan", "run", "genres"):
        engine, img = choose_engine(args.engine)
        if engine == "container":
            ui.kv("Engine", "beets container (%s)" % img)
            if action == "run":
                keep_awake()
            argv = [action, "--library", str(source)] + (["--rescan"] if args.rescan else []) \
                + (["--start-over"] if args.start_over else []) + (["--offline"] if args.offline else []) \
                + (["--apply"] if args.apply else []) + (["--yes"] if YES else [])
            rc = engine_in_container(img, source, argv)
            if rc:
                sys.exit(rc)
            return
        bootstrap()
        if action == "run":
            keep_awake()

    sp = state_paths(source)
    ui.open_log(sp["log"], "music %s  %s" % (action, source))
    ui.title("Music library", {"scan": "scan only, nothing will be changed", "run": "building the cleaned library",
                               "finalize": "swap", "undo": "undo", "delete-backup": "free space",
                               "verify": "check", "genres": "genre check" + (" and fix" if args.apply else "")}[action])
    ui.kv("Library", source)

    if action in ("finalize", "undo"):
        return swap(source, sp, undo=action == "undo")
    if action == "delete-backup":
        return delete_backup(sp)
    if action == "verify":
        return verify(source, sp)
    if action == "genres":
        return genres_cmd(source, sp, apply=args.apply)

    if args.start_over:
        if sp["backup"].is_dir() and any(sp["backup"].iterdir()):
            die("The backup from your last cleanup is still there (%s)." % pretty_path(sp["backup"]),
                "Check it with verify, then free it first:\n  " + script_cmd(source, "delete-backup"))
        if sp["work"].is_dir() and count_audio(sp["work"]):
            die("%s still has music in it from an unfinished cleanup." % pretty_path(sp["work"]),
                "Finish it with finalize, or move that folder away first.")
        if sp["local"].exists():
            sp["local"].rename(sp["local"].with_name(sp["local"].name + "-" + time.strftime("%Y%m%d-%H%M%S")))
        shutil.rmtree(str(sp["work"]), ignore_errors=True)
        sp = state_paths(source)
        ui.ok("Starting a fresh cleanup (the old one's records were kept)")
    if sp["final"].exists():
        ui.ok("This library was cleaned and swapped in already.")
        ui.say("Check nothing went missing:")
        ui.cmd(script_cmd(source, "verify"))
        ui.say("Added lots of music since? Free the old backup, then clean again:")
        ui.cmd(script_cmd(source, "delete-backup"))
        ui.cmd(script_cmd(source, "run") + " --start-over")
        ui.result(action=action, ok=True, stage="swapped in")
        return
    if sp["done"].exists():
        ui.ok("The cleaned library is already built.")
        ui.say("Next, swap it in (Navidrome is paused and backed up for you):")
        ui.cmd(script_cmd(source, "finalize"))
        ui.result(action=action, ok=True, stage="built")
        return

    run_now = action == "run"
    fresh = (args.rescan or run_now or not sp["plan"].exists()) and not sp["copied"].exists()
    steps = (["Reading your library"] if fresh else []) + ["What I found"]
    if run_now:
        steps += (["Checking the connection"] if not args.offline else []) + ["Copying", "Organizing"] \
            + (["Genres and artwork"] if not args.offline else []) + ["Finishing up"]
    step = iter(range(1, len(steps) + 1))

    def next_step(name):
        ui.step(next(step), len(steps), name)

    if fresh:
        next_step("Reading your library")
    plan = make_plan(source, sp, fresh=fresh)
    next_step("What I found")
    print_report(plan, sp)
    if not run_now:
        ui.say()
        ui.ok("Nothing was changed. When you're ready:")
        ui.cmd(script_cmd(source, "run"))
        return

    if not args.offline:
        next_step("Checking the connection")
        with ui.spinner("Checking MusicBrainz, the online music database") as s:
            reachable = musicbrainz_reachable()
            s.summary = "MusicBrainz is reachable"
        if not reachable:
            die("Can't reach MusicBrainz right now, so albums couldn't be matched online.",
                "Check the internet connection and run the same command again. Nothing was changed.")
    sp["beets"].mkdir(parents=True, exist_ok=True)
    sp["cleaned"].mkdir(parents=True, exist_ok=True)
    write_ignore_markers(sp["work"])
    write_beets_config(sp["beets"], sp["cleaned"], args.offline, sp["details"])
    next_step("Copying")
    do_copy(plan, sp)
    next_step("Organizing")
    do_import(sp, args.offline)
    if not args.offline:
        next_step("Genres and artwork")
        do_genres_and_art(sp, args.offline)
    next_step("Finishing up")
    finish(plan, sp)


# ============================================================== init & status
def init_cmd(args):
    ui.title("Music organizer", "setup")
    values = {}
    music = Path(os.path.expanduser(args.library)) if args.library else None
    navs = find_navidromes()
    for c in navs:
        if not music and c["music_dir"] and Path(c["music_dir"]).is_dir():
            music = Path(c["music_dir"])
            ui.ok("Found Navidrome (%s), reading %s" % (c["name"], music))
        elif music:
            check_navidrome_folder(c, music)
    if music:
        values["library"] = str(music)
    else:
        ui.warn('Couldn\'t find your music folder. Run init again with --library "/path/to/music".')
    img = beets_image()
    if img:
        ui.ok("beets will run in a container from %s (nothing to install on this Mac)" % img)
    elif local_engine_ready():
        ui.ok("beets is installed on this machine")
    else:
        ui.say("No beets image in Docker; beets will be installed into ~/.music-cleanup/venv on the first scan.")
    target = save_config_section("music", values, args.config)
    ui.kv("Settings saved", pretty_path(target))
    ui.say("See where things stand:")
    ui.cmd(me("status"))
    ui.result(action="init", ok=bool(music), settings=str(target), library=values.get("library"), beets_image=img)


def status_cmd(args):
    info = {"settings": str(CFG_PATH) if CFG_PATH else None, "reports_dir": str(reports_dir()),
            "docker": docker_ok(), "library": CFG["music"].get("library") or None}
    lib = info["library"]
    mode = CFG["music"].get("engine") or "auto"
    img = "" if mode == "local" else beets_image()
    engine = "container" if img else "local"
    info["engine"] = {"where": engine, "image": img or None, "local_ready": local_engine_ready()}
    if lib and Path(os.path.expanduser(lib)).is_dir():
        source = Path(os.path.expanduser(lib)).resolve()
        sp = state_paths(source)
        backup = sp["backup"].is_dir() and any(sp["backup"].iterdir())
        info["stage"] = ("swapped in" if sp["final"].exists() else "built" if sp["done"].exists()
                         else "running or stopped part-way" if sp["copied"].exists()
                         else "scanned" if sp["plan"].exists() else "not cleaned yet")
        info["backup"] = str(sp["backup"]) if backup else None
        info["reports"] = {k: str(sp[k]) for k in ("report_csv", "changes_csv", "log", "details", "needs")
                           if sp[k].exists()}
        info["next"] = ("verify" if backup else "finalize" if info["stage"] == "built"
                        else "run" if info["stage"] in ("scanned", "running or stopped part-way") else "scan")
    elif lib:
        info["stage"] = "folder not found (drive unplugged?)"
    info["navidrome"] = [{"name": c["name"], "running": c["running"],
                          "reads": str(c["music_dir"]) if c["music_dir"] else c["music_inside"] + " (Docker volume)",
                          "data": str(c["data_dir"] or ""),
                          "reads_this_library": bool(lib and c["music_dir"] and
                                                     overlaps(c["music_dir"], Path(os.path.expanduser(lib)).resolve()))}
                         for c in (find_navidromes() if info["docker"] else [])]
    if args.json or ui.events:
        print(json.dumps(info, indent=None if ui.events else 2))
        return
    ui.title("Music organizer", "status")
    ui.kv("Settings", pretty_path(CFG_PATH) if CFG_PATH else ui.yellow("none yet: run " + me("init")))
    ui.kv("Library", info["library"] or ui.dim("not set"))
    if info.get("stage"):
        ui.kv("Stage", info["stage"])
    if info.get("backup"):
        ui.kv("Backup", pretty_path(info["backup"]))
    ui.kv("Engine", "beets container (%s)" % img if engine == "container" else
          "this machine" + ("" if info["engine"]["local_ready"] else " (installs beets on first scan)"))
    for n in info["navidrome"]:
        ui.kv(n["name"], "%s, reads %s %s" % ("running" if n["running"] else "stopped", n["reads"],
                                             ui.green("✓") if n["reads_this_library"] else ui.yellow("← not this library")))
    if not info["docker"]:
        ui.kv("Docker", ui.dim("not running"))
    if info.get("next"):
        ui.kv("Next", script_cmd(Path(os.path.expanduser(lib)).resolve(), info["next"]))


# ============================================================== command line
def main():
    global YES
    ap = argparse.ArgumentParser(prog=Path(__file__).name, description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("action", choices=["init", "status", "scan", "run", "finalize", "verify", "genres", "undo",
                                       "delete-backup"])
    ap.add_argument("--apply", action="store_true", help="genres: rewrite the ones that aren't yours")
    ap.add_argument("--library", help="music folder (overrides the settings file)")
    ap.add_argument("--config", help="settings file (default: homelab_media.json next to this script)")
    ap.add_argument("--rescan", action="store_true", help="re-read the library instead of the saved plan")
    ap.add_argument("--start-over", action="store_true", help="clean again after a finished cleanup")
    ap.add_argument("--engine", choices=["auto", "container", "local"], help="where beets runs (overrides settings)")
    ap.add_argument("--yes", action="store_true", help="don't ask for confirmation")
    ap.add_argument("--events", choices=["text", "json"], help="json: one JSON object per line, for apps")
    ap.add_argument("--json", action="store_true", help="status: print it as JSON")
    ap.add_argument("--offline", action="store_true", help=argparse.SUPPRESS)
    args = ap.parse_args()
    if args.events == "json":
        ui.use_events()
    YES = args.yes
    if args.action == "init" and args.config and not Path(args.config).expanduser().exists():
        load_config(None)  # init will create it
    else:
        load_config(args.config)
    if args.action == "init":
        return init_cmd(args)
    if args.action == "status":
        return status_cmd(args)
    return music_cmd(args)


if __name__ == "__main__":
    run_main(main)
