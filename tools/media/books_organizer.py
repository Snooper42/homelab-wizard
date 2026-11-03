#!/usr/bin/env python3
"""
Books organizer for a Calibre library (the one Calibre-Web serves).

Tidies titles, fills in series and publishers, fixes genre tags, finds better covers, and flags
books that look misfiled or duplicated. Nothing changes until you've looked at the review page.

  python3 books_organizer.py init      find the Calibre library (e.g. from Calibre-Web); save the settings
  python3 books_organizer.py status    where things stand (--json for an app)
  python3 books_organizer.py review    look first; writes a review page, changes nothing
  python3 books_organizer.py apply     apply the review (Calibre-Web is paused while the database is written)
  python3 books_organizer.py undo      put back what the last apply changed

Options for review/apply:  --skip 123,456  --covers-for "Frankenstein; Dune"  --no-covers
                           --keep-subtitles  --no-online  --refetch

Needs Calibre's command-line tools (calibredb, fetch-ebook-metadata, ebook-meta) on this machine:
install the Calibre app. Calibre-Web doesn't include them.

For apps: --events json prints one JSON object per line; anything that asks a question needs --yes;
exit codes are 0 ok, 1 error, 130 stopped.
"""
import argparse
import csv
import difflib
import json
import os
import re
import shutil
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
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


def unhost(p):
    return re.sub(r"^/host_mnt(?=/)", "", p or "")  # Docker Desktop on a Mac sometimes reports this


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


def overlaps(a, b):
    a, b = str(a).rstrip("/"), str(b).rstrip("/")
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


# ============================================================== your genres (edit freely)
FICTION_GENRES = {"Fiction & Literary", "Sci-Fi & Dystopian", "Horror & Supernatural",
                  "Romance", "Mystery & Detective"}
NONFICTION_GENRES = {"History & Geopolitics", "Business & Economics", "Biography & Memoir",
                     "Cookbooks & Food", "Self-Help & Productivity", "Self-Help & Psychology",
                     "Science & Tech", "Non-Fiction & Essay"}
# Tags seen in your library that are also genres. Any tag a book already has is respected:
# the script never adds a second genre, it only fixes the specific books listed in OVERRIDES.
FICTION_GENRES |= {"Fantasy & Epic", "Thriller & Suspense", "Historical Fiction"}
OTHER_GENRES = {"Poetry"}
ALL_GENRES = FICTION_GENRES | NONFICTION_GENRES | OTHER_GENRES
GENERIC_GENRES = {"Fiction & Literary", "Non-Fiction & Essay"}  # only these get auto-corrected

# Online subject keywords -> your genre. Checked in order; first hit wins.
GENRE_RULES = [
    ("Cookbooks & Food", ["cookbook", "cooking", "cookery", "recipes", "food & wine"]),
    ("Historical Fiction", ["historical fiction"]),
    ("Sci-Fi & Dystopian", ["science fiction", "dystopia", "dystopian", "sci-fi"]),
    ("Fantasy & Epic", ["fantasy"]),
    ("Thriller & Suspense", ["thriller", "suspense"]),
    ("Horror & Supernatural", ["horror", "supernatural", "gothic"]),
    ("Mystery & Detective", ["mystery", "thriller", "suspense", "detective", "crime fiction"]),
    ("Romance", ["romance"]),
    ("Biography & Memoir", ["memoir", "biography", "biographies", "autobiography"]),
    ("History & Geopolitics", ["history", "military", "world war", "geopolitics", "terrorism"]),
    ("Business & Economics", ["business", "economics", "finance", "investing", "wall street"]),
    ("Science & Tech", ["science", "technology", "computers", "programming", "neuroscience",
                        "engineering", "physics", "chemistry", "climate", "environment"]),
    ("Self-Help & Productivity", ["productivity", "time management", "habits"]),
    ("Self-Help & Psychology", ["self-help", "psychology", "personal growth", "spirituality"]),
    ("Non-Fiction & Essay", ["essays", "political science", "politics", "sociology",
                             "social science", "current affairs", "nonfiction", "non-fiction"]),
    ("Fiction & Literary", ["fiction", "novel", "literary", "poetry", "poems"]),
]

JUNK_PUBLISHERS = ("epublibre", "manybooks", "unknown", "calibre", "z-library", "zlibrary",
                   "anna's archive", "libgen", "standard ebooks")

# Only the broad genres above are ever assigned; online sub-genres are never added as tags.
# Fixes I spotted in your screenshot. Keyed by (cleaned title, author fragment).
OVERRIDES = {
    ("the mysterious case of rudolf diesel", "brunt"): {"genre": "History & Geopolitics"},
    ("we are eating the earth", "grunwald"): {"genre": "Science & Tech"},
    ("the looming tower", "wright"): {"genre": "History & Geopolitics"},
    ("brave new world", "huxley"): {"genre": "Sci-Fi & Dystopian"},
    ("liar's poker", "lewis"): {"genre": "Business & Economics"},
    ("a night to remember", "lord"): {"genre": "History & Geopolitics"},
    ("day of infamy", "lord"): {"genre": "History & Geopolitics"},
    ("can't even", "petersen"): {"genre": "Non-Fiction & Essay"},
    ("phantoms in the brain", "ramacha"): {"genre": "Science & Tech"},
    ("why we're polarized", "klein"): {"genre": "Non-Fiction & Essay"},
    ("abundance", "klein"): {"genre": "Non-Fiction & Essay"},
    ("a room of one's own and three guineas", "woolf"): {"genre": "Non-Fiction & Essay"},
    ("just kids", "smith"): {"genre": "Biography & Memoir"},
    ("before the coffee gets cold", "kawaguchi"): {"series": "Before the Coffee Gets Cold",
                                                   "series_index": 1},
    ("the silence of the girls", "barker"): {"series": "Women of Troy", "series_index": 1},
    ("gone girl", "flynn"): {"publisher": "Crown"},
    # checked by hand from your preview: fantasy/sci-fi tagged as general fiction
    ("a game of thrones", ""): {"genre": "Fantasy & Epic"},
    ("a clash of kings", ""): {"genre": "Fantasy & Epic"},
    ("a storm of swords", ""): {"genre": "Fantasy & Epic"},
    ("a feast for crows", ""): {"genre": "Fantasy & Epic"},
    ("a dance with dragons", ""): {"genre": "Fantasy & Epic"},
    ("the way of kings", ""): {"genre": "Fantasy & Epic", "publisher": "Tor Books"},
    ("words of radiance", ""): {"genre": "Fantasy & Epic"},
    ("oathbringer", ""): {"genre": "Fantasy & Epic"},
    ("rhythm of war", ""): {"genre": "Fantasy & Epic"},
    ("darth plagueis", ""): {"genre": "Sci-Fi & Dystopian"},
    # non-fiction tagged as fiction
    ("born a crime", ""): {"genre": "Biography & Memoir"},
    ("shoe dog", ""): {"genre": "Biography & Memoir"},
    ("steve jobs", ""): {"genre": "Biography & Memoir"},
    ("how to build a car", ""): {"genre": "Biography & Memoir"},
    ("107 days", ""): {"genre": "Biography & Memoir"},
    ("leading with the heart", ""): {"genre": "Biography & Memoir"},
    ("shackleton's boat journey", ""): {"genre": "Biography & Memoir"},
    ("dead wake", ""): {"genre": "History & Geopolitics"},
    ("all about love", ""): {"genre": "Non-Fiction & Essay"},
    ("play nice", ""): {"genre": "Business & Economics"},
    ("blood, sweat, and pixels", ""): {"genre": "Business & Economics"},
    ("press reset", ""): {"genre": "Business & Economics"},
    ("the nvidia way", ""): {"genre": "Business & Economics"},
    ("the goal", ""): {"genre": "Business & Economics"},
}

SMALL_WORDS = {"a", "an", "and", "as", "at", "but", "by", "for", "in", "nor", "of", "on",
               "or", "the", "to", "with", "from", "into", "vs"}

# ---------------------------------------------------------------- text helpers
def norm(s):
    s = (s or "").replace("\u2019", "'").replace("\u2018", "'")
    return re.sub(r"\s+", " ", s).strip()


def norm_key(s):
    return re.sub(r"[^a-z0-9' ]", "", norm(s).lower()).strip()


def strip_junk(title):
    t = norm(title)
    # trailing "(Barnes & Noble Classics Series)", "[Kindle Edition]", etc.
    t = re.sub(r"\s*[\(\[][^)\]]*\b(series|edition|classics?|novel|memoir|unabridged|"
               r"illustrated|annotated|ebook|kindle|epub|retail|azw3?)\b[^)\]]*[\)\]]\s*$",
               "", t, flags=re.I)
    # trailing "A Memoir" / ": A Novel"
    t = re.sub(r"[\s:\-\u2013\u2014]+an?\s+(novel|memoir)\s*$", "", t, flags=re.I)
    return t.strip(" -:")


LOWER_MID = {"and", "as", "at", "but", "by", "for", "in", "nor", "of", "on", "or", "to", "with",
             "from", "into", "vs", "via"}


def fix_case(title):
    words = title.split(" ")
    letters = [c for c in title if c.isalpha()]
    rebuilt = False
    # ALL CAPS or all lower titles (2+ words, so "IT" stays "IT") -> Title Case
    if len(words) >= 2 and letters and (all(c.isupper() for c in letters) or all(c.islower() for c in letters)):
        words = [w[:1].upper() + w[1:].lower() for w in words]
        rebuilt = True
    small = LOWER_MID | ({"a", "an", "the"} if rebuilt else set())
    out = []
    for i, w in enumerate(words):
        prev = out[-1] if out else ""
        starts_part = i == 0 or prev in ("-", "–", "—") or prev.endswith((":", "—", "?", "!"))
        if not starts_part and i < len(words) - 1 and w.lower() in small and w[:1].isupper() and w[1:].islower():
            w = w.lower()  # "Day Of Infamy" -> "Day of Infamy" (but never the last word)
        out.append(w)
    return " ".join(out)


def similar(a, b):
    a, b = norm_key(a), norm_key(b)
    if not a or not b:
        return False
    wa, wb = a.split(), b.split()
    n = min(len(wa), len(wb))
    if wa[:n] == wb[:n]:  # whole-word prefix: "Dopamine Detox" ~ "Dopamine Detox A Short Guide"
        return True
    return difflib.SequenceMatcher(None, a, b).ratio() >= 0.85  # tolerate small typos only


def nk(s):
    return " ".join(norm_key(s).split())


# Online results that are a different product even when the title is inside them.
NOT_THE_BOOK = {"workbook", "study", "guide", "summary", "analysis", "box", "boxed", "collection", "bundle",
                "set", "books", "cookbook", "novellas", "trilogy", "series", "omnibus"}


def same_book(online_title, local_title):
    """'Star Wars: Thrawn: Alliances (Book 2)' is 'Thrawn: Alliances';
    'Study Guide: In the Dream House' and box sets are not."""
    local = strip_junk(local_title)
    if similar(online_title.split(":")[0], local):
        return True
    o = re.sub(r"\([^)]*\)|\[[^\]]*\]", " ", online_title)
    o = re.sub(r"\b(paperback|hardcover|hardback|kindle edition|mass market)\b", " ", o, flags=re.I)
    lk = nk(local)
    if (set(nk(o).split()) - set(lk.split())) & NOT_THE_BOOK:
        return False
    segs = [re.sub(r"\s+by\s+[A-Z][\w.' -]+$", "", x).strip() for x in re.split(r":|\s[-–—]\s", o)]
    segs = [x for x in segs if x]
    for i in range(len(segs)):
        for j in range(i + 1, len(segs) + 1):
            if nk(" ".join(segs[i:j])) == lk:
                return True
    return False


def clean_title(local, online_title, keep_subtitles):
    t = strip_junk(local)
    if not keep_subtitles:
        head, _, sub = t.partition(":")
        # drop long descriptive subtitles only ("Sapiens: A Brief History of Humankind"),
        # never short ones that tell books apart ("Thrawn: Alliances" / "Thrawn: Treason")
        if sub and len(head.strip()) >= 3 and len(sub.split()) >= 3:
            t = head.strip()
        elif online_title and ":" in online_title and len(t) > 45:
            # "Dopamine Detox A Short Guide to ..." -> online says "Dopamine Detox: A Short..."
            head = norm(online_title.split(":")[0])
            if norm_key(t).startswith(norm_key(head)) and len(head) >= 3:
                t = t[:len(head)].strip()
    return fix_case(t)


def classify(subjects):
    tokens = set()
    for s in subjects:
        for part in re.split(r"[/>,;]| & ", s.lower()):
            part = part.strip()
            if part:
                tokens.add(part)
    blob = " | ".join(sorted(tokens))
    is_nonfic = any(t in ("nonfiction", "non-fiction") for t in tokens) or \
        any(t.startswith(("biograph", "history", "business", "science", "self-help", "politic",
                          "psychology", "true crime", "social science", "memoir", "essays"))
            for t in tokens)
    for genre, keys in GENRE_RULES:
        for k in keys:
            if k == "fiction":
                hit = any(re.search(r"(?<!non)(?<!non-)\bfiction\b", t) for t in tokens)
            else:
                hit = k in blob
            if hit:
                # don't call a non-fiction book Sci-Fi just because it mentions dystopia
                if genre in FICTION_GENRES and is_nonfic and genre != "Fiction & Literary":
                    continue
                if genre == "Fiction & Literary" and is_nonfic:
                    continue
                return genre
    return None


def genre_class(g):
    if g in FICTION_GENRES:
        return "fiction"
    if g in NONFICTION_GENRES:
        return "nonfiction"
    return g


# ---------------------------------------------------------------- calibre I/O
def find_bin(name, override_dir=None, required=True):
    exe = name + (".exe" if os.name == "nt" else "")
    candidates = []
    if override_dir:
        candidates.append(Path(override_dir) / exe)
    w = shutil.which(name)
    if w:
        candidates.append(Path(w))
    candidates += [Path("/Applications/calibre.app/Contents/MacOS") / exe,
                   Path(r"C:\Program Files\Calibre2") / exe,
                   Path(r"C:\Program Files (x86)\Calibre2") / exe,
                   Path("/usr/bin") / exe, Path("/opt/calibre") / exe]
    for c in candidates:
        if c.exists():
            return str(c)
    if not required:
        return None
    die("Couldn't find Calibre's '%s' tool. Is Calibre installed?" % name)


def run(cmd, timeout=None):
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if r.returncode != 0:
        err = (r.stderr or r.stdout).strip()
        if "Another calibre program" in err or "is running" in err:
            die("Calibre is open. Quit Calibre completely (Calibre menu → Quit), then run this again.",
                'Calibre running in a container? Add it to books → "pause_containers" in the settings.')
        raise RuntimeError(err[-800:])
    return r.stdout


def _list_books_basic(calibredb, lib):
    out = run([calibredb, "list", "--for-machine", "--library-path", lib,
               "--fields", "title,authors,tags,series,series_index,publisher"])
    books = json.loads(out)
    for b in books:
        if isinstance(b.get("authors"), list):
            b["authors"] = " & ".join(b["authors"])
        tags = b.get("tags") or []
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(",") if t.strip()]
        b["tags"] = tags
    return books


def parse_opf(text):
    start = min([i for i in (text.find("<?xml"), text.find("<package")) if i >= 0], default=-1)
    if start < 0:
        return None
    root = ET.fromstring(text[start:])
    res = {"title": None, "publisher": None, "subjects": [], "series": None, "series_index": None}
    for el in root.iter():
        tag = el.tag.split("}")[-1]
        if tag == "title" and not res["title"]:
            res["title"] = (el.text or "").strip()
        elif tag == "publisher":
            res["publisher"] = (el.text or "").strip()
        elif tag == "subject" and el.text:
            res["subjects"].append(el.text.strip())
        elif tag == "meta":
            name = el.get("name") or ""
            if name == "calibre:series":
                res["series"] = el.get("content")
            elif name == "calibre:series_index":
                res["series_index"] = el.get("content")
    return res


def fetch_online(fetch_bin, title, authors):
    cmd = [fetch_bin, "--opf", "--timeout", "30", "--title", strip_junk(title)]
    if authors and authors.lower() != "unknown":
        cmd += ["--authors", authors.split(" & ")[0]]
    try:
        return parse_opf(run(cmd, timeout=120))
    except Exception:
        return None


# ---------------------------------------------------------------- planning
def junk_series(series, title):
    """'Liar's Poker Series' for the book 'Liar's Poker' isn't a real series."""
    return bool(re.search(r"\bseries$", series.strip(), re.I)) and \
        norm_key(re.sub(r"\s+series$", "", series.strip(), flags=re.I)) == norm_key(title)

def plan_book(b, online, keep_subtitles):
    changes = {}
    notes = []
    authors = norm(b.get("authors", ""))
    if online and online.get("title") and not same_book(online["title"], b["title"]):
        notes.append(f"online match '{online['title']}' rejected (different book)")
        online = None

    new_title = clean_title(b["title"], online and online.get("title"), keep_subtitles)
    if new_title and new_title != b["title"]:
        changes["title"] = (b["title"], new_title, "cleaned title")

    key_title = norm_key(new_title)
    ov = {}
    for (t, a), v in OVERRIDES.items():
        t = nk(t)
        if (nk(key_title) == t or nk(key_title).startswith(t + " ")) and a in authors.lower():
            ov = v
            break

    # series
    cur_series = b.get("series") or ""
    if ov.get("series") and not cur_series:
        changes["series"] = ("", ov["series"], "known series")
        changes["series_index"] = (b.get("series_index"), ov["series_index"], "known series")
    elif not cur_series and online and online.get("series") and not junk_series(online["series"], new_title):
        changes["series"] = ("", online["series"], "found online")
        idx = online.get("series_index")
        if idx:
            try:
                idx = float(idx)
                idx = int(idx) if idx.is_integer() else idx
                changes["series_index"] = (b.get("series_index"), idx, "found online")
            except ValueError:
                pass

    # publisher
    cur_pub = norm(b.get("publisher") or "")
    junk = cur_pub.lower().startswith(JUNK_PUBLISHERS)
    if ov.get("publisher") and ov["publisher"] != cur_pub:
        changes["publisher"] = (cur_pub, ov["publisher"], "known publisher")
    elif (not cur_pub or junk) and online and online.get("publisher"):
        changes["publisher"] = (cur_pub, online["publisher"],
                                "replaced junk publisher" if junk else "found online")

    # genre tag: your existing tags are respected; only known mislabels are fixed, and a
    # genre is added only to books with no tags at all
    tags = list(b["tags"])
    genre_tags = [t for t in tags if t in ALL_GENRES or " & " in t]
    new, reason = None, ""
    if ov.get("genre") and genre_tags != [ov["genre"]]:
        new, reason = ov["genre"], "known mislabel"
    elif not tags and online and online.get("subjects"):
        sug = classify(online["subjects"])
        if sug:
            new, reason = sug, "had no tags; from online categories"
    if new:
        new_tags = [t for t in tags if t not in genre_tags] + [new]
        changes["tags"] = (", ".join(tags), ", ".join(new_tags), reason)
    return changes, notes


# ---------------------------------------------------------------- covers & misfiled books
COVERS = "calibre_covers"          # folder in Downloads: current/ (backups), new/ (proposed), applied/
REVIEW_PAGE = "calibre_review.html"


def list_books_full(calibredb, lib):
    out = run([calibredb, "list", "--for-machine", "--library-path", lib, "--fields",
               "title,authors,tags,series,series_index,publisher,cover,identifiers,comments,formats,size"])
    books = json.loads(out)
    for b in books:
        if isinstance(b.get("authors"), list):
            b["authors"] = " & ".join(b["authors"])
        b["authors"] = b.get("authors") or ""
        tags = b.get("tags") or []
        b["tags"] = [t.strip() for t in tags.split(",") if t.strip()] if isinstance(tags, str) else list(tags)
        f = b.get("formats") or []
        b["formats"] = [f] if isinstance(f, str) else list(f)
    return books


def image_size(path):
    """Width and height of a JPEG or PNG, read from the file header (no extra tools needed)."""
    import struct
    try:
        with open(path, "rb") as f:
            head = f.read(26)
            if head[:8] == b"\x89PNG\r\n\x1a\n":
                return struct.unpack(">II", head[16:24])
            if head[:2] != b"\xff\xd8":
                return None
            f.seek(2)
            while True:
                b = f.read(1)
                while b and b != b"\xff":
                    b = f.read(1)
                while b == b"\xff":
                    b = f.read(1)
                if not b:
                    return None
                m = b[0]
                if m in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                    f.read(3)
                    h, w = struct.unpack(">HH", f.read(4))
                    return w, h
                if m in (0xD8, 0xD9) or 0xD0 <= m <= 0xD7:
                    continue
                (length,) = struct.unpack(">H", f.read(2))
                f.seek(length - 2, 1)
    except (OSError, struct.error):
        return None


def read_bmp(path):
    """Pixels of a 24/32-bit BMP (what macOS 'sips' produces) as (r, g, b) tuples."""
    import struct
    d = open(path, "rb").read()
    (off,) = struct.unpack("<I", d[10:14])
    w, h = struct.unpack("<ii", d[18:26])
    (bpp,) = struct.unpack("<H", d[28:30])
    (comp,) = struct.unpack("<I", d[30:34])
    if bpp not in (24, 32):
        return None
    step, row = bpp // 8, ((bpp * w + 31) // 32) * 4
    masks = None
    if bpp == 32 and comp in (3, 6):  # BI_BITFIELDS: channel order given by masks
        masks = struct.unpack("<III", d[54:66])

    def chan(v, m):
        if not m:
            return 0
        shift = (m & -m).bit_length() - 1
        return ((v & m) >> shift) * 255 // (m >> shift)

    px = []
    for y in range(abs(h)):
        line = d[off + y * row: off + (y + 1) * row]
        for x in range(w):
            if masks:
                v = int.from_bytes(line[x * 4:x * 4 + 4], "little")
                px.append((chan(v, masks[0]), chan(v, masks[1]), chan(v, masks[2])))
            else:
                b, g, r = line[x * step:x * step + 3]
                px.append((r, g, b))
    return px


def thumb_pixels(path, w=24, h=32):
    """A tiny w x h thumbnail as (r, g, b) tuples, via Pillow or the Mac's built-in sips."""
    try:
        from PIL import Image
        with Image.open(path) as im:
            raw = im.convert("RGB").resize((w, h)).tobytes()
            return [tuple(raw[i:i + 3]) for i in range(0, len(raw), 3)]
    except ImportError:
        pass
    except Exception:
        return None
    if shutil.which("sips"):
        import tempfile
        fd, tmp = tempfile.mkstemp(suffix=".bmp")
        os.close(fd)
        try:
            r = subprocess.run(["sips", "-s", "format", "bmp", "-z", str(h), str(w), path, "--out", tmp],
                               capture_output=True)
            if r.returncode == 0:
                px = read_bmp(tmp)
                return px if px and len(px) == w * h else None
        except Exception:
            return None
        finally:
            if os.path.exists(tmp):
                os.remove(tmp)
    return None


def looks_alike(a, b):
    """True if two images look like the same artwork (e.g. a small and a sharp copy)."""
    pa, pb = thumb_pixels(a, 12, 18), thumb_pixels(b, 12, 18)
    if not pa or not pb:
        return False
    diff = sum(abs(x - y) for p, q in zip(pa, pb) for x, y in zip(p, q)) / (3.0 * 255 * len(pa))
    return diff < 0.15


def image_stats(path):
    """(share of near-white pixels, average colourfulness) from a tiny thumbnail, or None."""
    px = thumb_pixels(path)
    if not px:
        return None
    white = sum(1 for r, g, b in px if r > 225 and g > 225 and b > 225) / float(len(px))
    colour = sum((max(p) - min(p)) / 255.0 for p in px) / len(px)
    return white, colour


def cover_problems(path):
    if not path or not os.path.exists(path):
        return ["no cover"]
    probs = []
    size = image_size(path)
    if size:
        w, h = size
        if w < 250 or h < 375:  # only really tiny ones; ~330x500 is normal for ebooks
            probs.append("very low resolution (%dx%d)" % (w, h))
        ratio = h / float(w) if w else 0
        if ratio < 1.1:
            probs.append("not book-shaped (square or wide)")
        elif ratio > 1.9:
            probs.append("unusually tall and thin")
    st = image_stats(path)
    if st and st[0] > 0.78 and st[1] < 0.06:
        probs.append("looks like a plain title page, not a cover")
    return probs


def html_text(s):
    import html
    return html.unescape(re.sub(r"<[^>]+>", " ", s or "")).replace("\xa0", " ")


def file_metadata(ebook_meta, path):
    """Title and authors stored inside the book file itself."""
    try:
        out = subprocess.run([ebook_meta, path], capture_output=True, text=True, timeout=60).stdout
    except Exception:
        return None
    title = re.search(r"^Title\s*:\s*(.+)$", out, re.M)
    auth = re.search(r"^Author\(s\)\s*:\s*(.+)$", out, re.M)
    if not title:
        return None
    a = re.sub(r"\s*\[[^\]]*\]", "", auth.group(1)).strip() if auth else ""
    return title.group(1).strip(), a


def misfile_checks(books, ebook_meta, workers):
    issues = {b["id"]: [] for b in books}
    groups = {}
    for b in books:
        groups.setdefault((nk(strip_junk(b["title"])), nk(b["authors"])), []).append(b)
    for g in groups.values():
        if len(g) > 1:
            for b in g:
                issues[b["id"]].append("%d books share this exact title and author: duplicates, or some are "
                                       "a different book" % len(g))
    numbered = {}
    for b in books:
        if b.get("series") and b.get("series_index"):
            numbered.setdefault((nk(b["series"]), float(b["series_index"])), []).append(b)
    for (s, i), g in numbered.items():
        if len({nk(x["title"]) for x in g}) > 1:
            for b in g:
                issues[b["id"]].append("%s #%g is also used by: %s" % (
                    b["series"], i, ", ".join('"%s"' % x["title"] for x in g if x is not b)))
    # title and author swapped, or an author field holding a series name
    series_names = {nk(b["series"]) for b in books if b.get("series")}
    author_names = {nk(a) for b in books for a in b["authors"].split(" & ") if a.strip()}
    for b in books:
        auths = [nk(a) for a in b["authors"].split(" & ") if a.strip()]
        if any(a in series_names for a in auths) or (nk(b["title"]) in author_names and nk(b["title"]) not in auths):
            issues[b["id"]].append("the title and author look swapped or wrong")
    # a description that is clearly about another author's book: their name AND one of their
    # titles, for authors with several books here (blurbs quoting other writers are normal)
    by_author = {}
    for b in books:
        for a in b["authors"].split(" & "):
            if a.strip():
                by_author.setdefault(a.strip(), []).append(strip_junk(b["title"]))
    for b in books:
        text = html_text(b.get("comments")).lower()
        own = [a.strip().lower() for a in b["authors"].split(" & ") if a.strip()]
        if not text or any(o and o in text for o in own):
            continue  # descriptions that name their own author are normal blurbs
        for name, titles in by_author.items():
            low = name.lower()
            if low in own or len(titles) < 2 or len(name.split()) < 2:
                continue
            if not re.search(r"\b%s\b" % re.escape(low), text):
                continue
            named = [t for t in titles if len(t) >= 6 and nk(t) != nk(b["title"]) and nk(t) in nk(text)]
            if named:
                issues[b["id"]].append('the description is about %s ("%s"), not %s' % (
                    name, named[0], b["authors"] or "?"))
                break
    # what the book file itself says
    todo = [b for b in books if b["formats"]]
    if ebook_meta and todo:
        ex = ThreadPoolExecutor(max_workers=workers)
        try:
            with ui.progress(len(todo), "Book files") as bar:
                futs = {ex.submit(file_metadata, ebook_meta, b["formats"][0]): b for b in todo}
                for f in as_completed(futs):
                    b = futs[f]
                    bar.update(note=b["title"])
                    res = f.result()
                    if not res:
                        continue
                    ftitle, fauth = res
                    # a completely different author inside the file is the strong signal
                    # (titles alone vary too much: "The Secret" vs "The Secret of Secrets")
                    adiff = fauth and nk(fauth) not in ("unknown", "") and \
                        not set(nk(fauth).split()) & set(nk(b["authors"]).split())
                    if adiff:
                        issues[b["id"]].append('the book file itself says "%s" by %s' % (ftitle, fauth))
                        b["file_says"] = (ftitle, fauth)
                bar.note = ""
                bar.summary = "Compared Calibre's details with each book file"
        except KeyboardInterrupt:
            try:
                ex.shutdown(wait=False, cancel_futures=True)
            except TypeError:
                ex.shutdown(wait=False)
            raise
        ex.shutdown()
    return {k: v for k, v in issues.items() if v}


def safe_name(b):
    return "%s - %s.jpg" % (b["id"], re.sub(r"[^\w\- ]+", "", b["title"])[:60].strip())


def is_strong(reason):
    """Misfile signals (vs. plain 'duplicate' or 'same series number' notes)."""
    return not reason[0].isdigit() and "is also used by" not in reason


def cover_file(folder, bid):
    hits = sorted(Path(folder).glob("%s - *.jpg" % bid)) if Path(folder).exists() else []
    return hits[0] if hits else None


PAGE_CSS = """
:root{--bg:#fafaf9;--fg:#1c1917;--muted:#78716c;--card:#fff;--line:#e7e5e4;--warn:#b45309;--ok:#15803d;--old:#a8a29e}
@media (prefers-color-scheme:dark){:root{--bg:#1c1917;--fg:#f5f5f4;--muted:#a8a29e;--card:#292524;--line:#44403c;--warn:#f59e0b;--ok:#4ade80;--old:#78716c}}
body{background:var(--bg);color:var(--fg);font:15px/1.45 -apple-system,system-ui,sans-serif;margin:0 auto;padding:24px 16px 64px;max-width:1100px}
h1{font-size:26px;margin:0 0 4px}h2{font-size:19px;margin:36px 0 6px}p.lead{color:var(--muted);margin:0 0 10px}
nav{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 0}nav a{color:var(--fg);text-decoration:none;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:4px 12px;font-size:14px}
code{background:var(--card);border:1px solid var(--line);border-radius:4px;padding:1px 5px;font-size:13px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}
.card,.swap,.edit{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;display:flex;gap:12px}
.card img,.card .none{width:84px;height:126px;object-fit:cover;border-radius:4px;flex:none}
.t{font-weight:600;min-width:0}.t span{font-weight:400;color:var(--muted)}
ul{margin:6px 0 0;padding-left:18px;font-weight:400;color:var(--warn)}
.swap{align-items:flex-start;margin-bottom:10px}.swap .t{flex:1}
figure{margin:0;text-align:center}figure img,figure .none{width:130px;height:195px;object-fit:cover;border-radius:4px;border:1px solid var(--line)}
figcaption{font-size:12px;color:var(--muted)}.why{color:var(--warn);font-weight:400;margin:6px 0}
.id{font-size:12px}li.strong{font-weight:600}
.file{font:12px ui-monospace,monospace;color:var(--muted);word-break:break-all;font-weight:400}
.none{display:flex;align-items:center;justify-content:center;background:var(--line);color:var(--muted);font-size:12px}
.edits{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:10px}
.edit{flex-direction:column;gap:4px}.edit table{border-collapse:collapse;font-size:14px;width:100%}
.edit td{padding:3px 6px 3px 0;vertical-align:top}.edit td.f{color:var(--muted);white-space:nowrap;width:1%}
.edit del{color:var(--old)}.edit ins{text-decoration:none;color:var(--ok);font-weight:600}
@media (max-width:600px){.swap{flex-wrap:wrap}figure img,figure .none{width:110px;height:165px}}
"""

FIELD_NAMES = {"title": "Title", "series": "Series", "series_index": "Number", "publisher": "Publisher",
               "tags": "Genre"}


def write_review_page(path, edits, checks, swaps, no_better, script):
    import html
    e = html.escape

    def img(rel):
        return '<img src="%s" alt="">' % e(rel) if rel else '<div class="none">no cover</div>'

    def who(b, ident=False):
        s = "%s<br><span>%s</span>" % (e(b["title"]), e(b["authors"]))
        if b.get("series"):
            s += "<br><span>%s #%g</span>" % (e(b["series"]), float(b.get("series_index") or 0))
        if ident:
            size = " · %.1f MB" % (b["size"] / 1e6) if b.get("size") else ""
            s += '<br><span class="id">search <b>id:%s</b> in Calibre%s</span>' % (b["id"], size)
        return s

    cards_check = "".join(
        '<div class="card warn">%s<div class="t">%s<ul>%s</ul></div></div>' % (
            img(rel), who(b, True), "".join(
                '<li%s>%s</li>' % (' class="strong"' if is_strong(r) else "", e(r))
                for r in sorted(reasons, key=lambda r: not is_strong(r))))
        for b, rel, reasons in checks)

    def edit_card(b, changes):
        rows = "".join(
            '<tr><td class="f">%s</td><td>%s<ins>%s</ins><br><span class="file">%s</span></td></tr>' % (
                FIELD_NAMES.get(f, f), ("<del>%s</del> → " % e(str(old))) if str(old).strip() not in ("", "1.0") else "",
                e(str(new)), e(why))
            for f, old, new, why in changes)
        return '<div class="edit"><div class="t">%s<br><span class="id">id:%s</span></div><table>%s</table></div>' % (
            e(b["title"]) + "<br><span>%s</span>" % e(b["authors"]), b["id"], rows)

    cards_edit = "".join(edit_card(b, ch) for b, ch in edits)
    cards_swap = "".join(
        '<div class="swap"><div class="t">%s<p class="why">%s</p><p class="file">%s</p></div>'
        '<figure>%s<figcaption>now</figcaption></figure><figure>%s<figcaption>new</figcaption></figure></div>' % (
            who(b), e("; ".join(reasons)), e(COVERS + "/new/" + Path(new).name), img(old), img(new))
        for b, old, new, reasons in swaps)
    cards_none = "".join("<li>%s: %s</li>" % (e(b["title"]), e("; ".join(r))) for b, r in no_better)
    n_edits = sum(len(c) for _, c in edits)
    page = """<!doctype html><html><head><meta charset="utf-8"><title>Calibre review</title>
<meta name="viewport" content="width=device-width, initial-scale=1"><style>%(css)s</style></head><body>
<h1>Calibre review</h1>
<p class="lead">Made %(when)s. Nothing has been changed yet. When it all looks right, run <code>%(script)s</code>.
Want to leave some books alone? Add <code>--skip 123,456</code> with their ids. Everything can be put back with <code>%(undo)s</code>.</p>
<nav><a href="#check">Books to check · %(nc)d</a><a href="#edits">Detail changes · %(ne)d books</a><a href="#covers">New covers · %(ns)d</a></nav>
<h2 id="check">Books to check (%(nc)d)</h2>
<p class="lead">These might be misfiled or duplicated, so the script leaves their details and covers alone. Fix them in Calibre:
search the id, press <b>E</b>, correct the title, author and series. For true duplicates, keep the biggest copy and remove the rest.</p>
<div class="grid">%(checks)s</div>
<h2 id="edits">Changes to book details (%(ne)d books, %(nf)d changes)</h2>
<p class="lead">Titles tidied, series and publishers filled in, and genre tags corrected.</p>
<div class="edits">%(edits)s</div>
<h2 id="covers">New covers (%(ns)d)</h2>
<p class="lead">Don't like one? Delete its file from the <code>%(covers)s/new</code> folder next to this page before applying.
Your current covers are saved in <code>%(covers)s/current</code>.</p>
%(swaps)s
%(none_block)s
</body></html>""" % {
        "css": PAGE_CSS, "when": time.strftime("%d %b %Y, %H:%M"), "script": e(script), "undo": e(me("undo")),
        "nc": len(checks), "ne": len(edits), "nf": n_edits, "ns": len(swaps), "covers": COVERS,
        "checks": cards_check or "<p>Nothing looks misfiled or duplicated.</p>",
        "edits": cards_edit or "<p>No details need changing.</p>",
        "swaps": cards_swap or "<p>No covers need replacing.</p>",
        "none_block": ("<h2>Covers that look off, but no better one was found (%d)</h2><ul>%s</ul>"
                       % (len(no_better), cards_none)) if no_better else ""}
    Path(path).write_text(page, encoding="utf-8")


def online_lookups(args, books, cache_path):
    cache = {}
    if cache_path.exists() and not args.refetch:
        try:
            cache = json.loads(cache_path.read_text())
        except ValueError:
            cache = {}
    fetch_bin = find_bin("fetch-ebook-metadata", args.calibre_dir)
    todo = [b for b in books if str(b["id"]) not in cache]
    saved = len(books) - len(todo)
    if saved:
        ui.ok("%s books already looked up last time (saved)" % fmt_n(saved))
    if todo:
        ex = ThreadPoolExecutor(max_workers=args.workers)
        try:
            with ui.progress(len(todo), "Looking up") as bar:
                futs = {ex.submit(fetch_online, fetch_bin, b["title"], b.get("authors")): b for b in todo}
                for n, f in enumerate(as_completed(futs), 1):
                    b = futs[f]
                    cache[str(b["id"])] = f.result()
                    bar.update(note=b["title"])
                    if n % 10 == 0:
                        cache_path.write_text(json.dumps(cache, indent=1))
                found = sum(1 for b in todo if cache.get(str(b["id"])))
                bar.note = ""
                bar.summary = "Looked up %s books (%s found online)" % (fmt_n(len(todo)), fmt_n(found))
        except KeyboardInterrupt:
            cache_path.write_text(json.dumps(cache, indent=1))  # keep what's done so far
            try:
                ex.shutdown(wait=False, cancel_futures=True)
            except TypeError:
                ex.shutdown(wait=False)
            raise
        ex.shutdown()
        cache_path.write_text(json.dumps(cache, indent=1))
    return cache


def plan_details(books, cache, args, hold):
    """Detail changes for every book except the ones on hold (suspected misfiles, --skip)."""
    plan, edits, rows = {}, [], []
    fields, rejected = Counter(), 0
    for b in books:
        if b["id"] in hold:
            continue
        online = None if args.no_online else cache.get(str(b["id"]))
        changes, notes = plan_book(b, online, args.keep_subtitles)
        if changes:
            plan[b["id"]] = changes
            edits.append((b, [(f, old, new, why) for f, (old, new, why) in changes.items()]))
        for field, (old, new, why) in changes.items():
            rows.append([b["id"], b["title"], field, old, new, why])
            if field in FIELD_LABELS:
                fields[field] += 1
        for note in notes:
            rows.append([b["id"], b["title"], "(note)", "", "", note])
            rejected += 1
    return plan, edits, rows, fields, rejected


def propose_covers(args, books, covers, hold, new_titles):
    """Check every cover; download better ones for those that look off."""
    forced = [nk(x) for x in re.split(r"[;\n]", args.covers_for or "") if x.strip()]
    for sub in ("current", "new"):
        d = covers / sub
        if sub == "new" and d.exists():
            shutil.rmtree(str(d))  # proposals from an earlier review
        d.mkdir(parents=True, exist_ok=True)
    flagged = []
    with ui.progress(len(books), "Covers") as bar:
        for b in books:
            bar.update(note=b["title"])
            cover = b.get("cover") or ""
            if cover and os.path.exists(cover) and not cover_file(covers / "applied", b["id"]):
                try:  # backup copy (never overwritten while an --undo may still need it)
                    old = cover_file(covers / "current", b["id"])
                    if old:
                        old.unlink()
                    shutil.copy2(cover, str(covers / "current" / safe_name(b)))
                except OSError:
                    pass
            probs = cover_problems(cover)
            if forced and any(f in nk(b["title"]) for f in forced):
                probs = probs or ["you asked for a new cover"]
            if probs and b["id"] not in hold:
                flagged.append((b, probs))
        bar.note = ""
        bar.summary = "Checked %s covers: %s look off" % (fmt_n(len(books)), fmt_n(len(flagged)))
    swaps, no_better = [], []
    if not flagged:
        return swaps, no_better
    fetch_bin = find_bin("fetch-ebook-metadata", args.calibre_dir)

    def get(b, probs):
        """Same edition (ISBN) first, then a title search. Keep the first good result."""
        dest = str(covers / "new" / safe_name(b))
        old = b.get("cover") or ""
        sharpen_only = all(p.startswith("very low resolution") for p in probs)
        ids = b.get("identifiers") or {}
        isbn = ids.get("isbn") if isinstance(ids, dict) else None
        title = new_titles.get(b["id"], b["title"])
        tries = ([["--isbn", isbn]] if isbn else []) + \
            [["--title", strip_junk(title)] + (["--authors", b["authors"].split(" & ")[0]] if b["authors"] else [])]
        for extra in tries:
            if os.path.exists(dest):
                os.remove(dest)
            try:
                subprocess.run([fetch_bin] + extra + ["--cover", dest, "--timeout", "30"],
                               capture_output=True, timeout=180)
            except Exception:
                continue
            if not (os.path.exists(dest) and os.path.getsize(dest) > 0) or cover_problems(dest):
                continue
            if sharpen_only:
                ow, oh = image_size(old) or (0, 0)
                nw, nh = image_size(dest) or (0, 0)
                if nw * nh <= ow * oh or not looks_alike(old, dest):
                    continue  # not the same artwork, or not actually sharper
            return dest
        if os.path.exists(dest):
            os.remove(dest)
        return None

    ex = ThreadPoolExecutor(max_workers=args.workers)
    try:
        with ui.progress(len(flagged), "New covers") as bar:
            futs = {ex.submit(get, b, probs): (b, probs) for b, probs in flagged}
            for f in as_completed(futs):
                b, probs = futs[f]
                bar.update(note=b["title"])
                new = f.result()
                (swaps.append((b, probs, new)) if new else no_better.append((b, probs)))
            bar.note = ""
            bar.summary = "Found better covers for %s of %s books" % (fmt_n(len(swaps)), fmt_n(len(flagged)))
    except KeyboardInterrupt:
        try:
            ex.shutdown(wait=False, cancel_futures=True)
        except TypeError:
            ex.shutdown(wait=False)
        raise
    ex.shutdown()
    return swaps, no_better


def set_covers(files, calibredb, lib, covers, label="Covers", undo=False):
    (covers / "applied").mkdir(parents=True, exist_ok=True)
    done = []
    with ui.progress(len(files), label) as bar:
        for p in files:
            bid = p.name.split(" - ")[0]
            bar.update(note=p.stem.split(" - ", 1)[-1])
            try:
                run([calibredb, "set_metadata", "--library-path", lib, "--field", "cover:%s" % p, bid])
                done.append(bid)
                if undo:
                    for a in (covers / "applied").glob("%s - *.jpg" % bid):
                        a.unlink()
                else:
                    shutil.move(str(p), str(covers / "applied" / p.name))
            except Exception as e:
                ui.to_log("NOTE   cover for book %s: %s" % (bid, e))
        bar.summary = "%s %s cover%s" % ("Restored" if undo else "Replaced", fmt_n(len(done)),
                                          "" if len(done) == 1 else "s")
    return done


def embed(ids, calibredb, lib):
    ids = sorted({str(i) for i in ids}, key=int)
    if not ids:
        return
    with ui.progress(len(ids), "Book files") as bar:
        for i in range(0, len(ids), 10):
            try:
                run([calibredb, "embed_metadata", "--library-path", lib] + ids[i:i + 10])
            except Exception as e:
                ui.to_log("NOTE   embed: %s" % e)
            bar.update(len(ids[i:i + 10]))
        bar.summary = "Wrote the changes into the book files (so they show on your Kindle)"



def undo_last(args, calibredb, lib, out):
    covers = out / COVERS
    state_path = covers / "last_apply.json"
    if not state_path.exists():
        die("There's nothing to undo (nothing has been applied yet).")
    st = json.loads(state_path.read_text())
    ui.step(1, 1, "Putting your library back")
    ui.warn("This returns your Calibre library to how it was on %s." % st["time"])
    ui.say("Any edits you made in Calibre since then will be undone too.")
    if not confirm("Undo?", word="UNDO"):
        ui.ok("Nothing changed")
        return
    run([calibredb, "list", "--library-path", lib, "--limit", "1"])  # stops here if Calibre is open
    backup = Path(st["backup"])
    if not backup.exists():
        die("The database backup %s is missing, so I can't undo." % pretty_path(backup))
    shutil.copy2(str(Path(lib) / "metadata.db"), str(Path(lib) / ("metadata.db.before-undo-%s"
                                                                   % datetime.now().strftime("%Y%m%d-%H%M%S"))))
    shutil.copy2(str(backup), str(Path(lib) / "metadata.db"))
    ui.ok("Book details restored from %s" % backup.name)
    files = [cover_file(covers / "current", i) for i in st.get("covers", [])]
    files = [f for f in files if f]
    if files:
        set_covers(files, calibredb, lib, covers, undo=True)
    embed(set(st.get("changed", [])) | set(st.get("covers", [])), calibredb, lib)
    state_path.unlink()
    ui.say()
    ui.ok("Your library is back to how it was. Open Calibre to check.")
    ui.result(action="undo", ok=True, restored_from=str(backup))


# ---------------------------------------------------------------- main
FIELD_LABELS = {"title": "titles cleaned up", "series": "series filled in", "publisher": "publishers filled in",
                "tags": "genre tags fixed"}


# ============================================================== books: commands
def book_cache_path(out):
    """Saved online lookups, so re-runs are quick (reuses the old script's cache if it's around)."""
    p = state_dir() / "books_online_cache.json"
    if not p.exists():
        for old in (out / "cleanup_online_cache.json", Path(os.path.abspath(__file__)).parent / "cleanup_online_cache.json",
                    Path.home() / "Downloads" / "cleanup_online_cache.json"):
            if old.is_file():
                shutil.copy2(str(old), str(p))
                break
    return p


def books_cmd(args):
    bc = CFG["books"]
    out = reports_dir()
    covers = out / COVERS
    cache_path = book_cache_path(out)
    mode = {"review": "preview", "apply": "apply", "undo": "undo"}[args.action]
    args.calibre_dir = bc.get("calibre_bin_dir") or None
    args.workers = args.workers or int(bc.get("workers") or 4)
    apply_cmd = me("apply", *(["--skip", args.skip] if args.skip else []))
    ui.open_log(out / "books_organizer_log.txt", "books %s" % args.action)
    ui.title("Calibre library", {"preview": "review, nothing will be changed", "apply": "applying the review",
                                 "undo": "undo"}[mode])

    lib = os.path.expanduser(args.library or bc.get("library") or str(Path.home() / "Calibre Library"))
    if not (Path(lib) / "metadata.db").exists():
        die("No Calibre library at %s" % pretty_path(lib),
            'Add --library "/path/to/your/Calibre Library", or save it once with:\n  ' + me("init") +
            "\n(In Calibre, click the library icon > Switch/create library to see the path.)")
    ui.kv("Library", pretty_path(lib))
    calibredb = find_bin("calibredb", args.calibre_dir)
    pause = containers_using(Path(lib).resolve(), bc.get("pause_containers", "auto"))
    if mode == "undo":
        announce_pause(pause, "while Calibre's database is restored")
        with Paused(pause):
            return undo_last(args, calibredb, lib, out)

    skip = {int(x) for x in re.findall(r"\d+", args.skip or "")}
    do_covers = not args.no_covers and mode == "preview"
    steps = ["Reading your library"] + ([] if args.no_online else ["Looking books up online"]) \
        + ["Looking for misfiled books", "Planning changes"] + (["Checking covers"] if do_covers else []) \
        + (["Applying"] if mode == "apply" else [])
    step = iter(range(1, len(steps) + 1))

    def next_step(name):
        ui.step(next(step), len(steps), name)

    next_step("Reading your library")
    with ui.spinner("Reading your Calibre library") as s:
        books = list_books_full(calibredb, lib)
        s.summary = "Found %s books" % fmt_n(len(books))
    by_id = {b["id"]: b for b in books}

    cache = {}
    if not args.no_online:
        next_step("Looking books up online")
        cache = online_lookups(args, books, cache_path)

    next_step("Looking for misfiled books")
    review_state = covers / "review.json"
    if mode == "apply" and review_state.exists():
        checks = {int(k): v for k, v in json.loads(review_state.read_text()).get("checks", {}).items()}
        ui.ok("Using the checks from your review (%s books on hold)" % fmt_n(
            sum(1 for v in checks.values() if any(is_strong(r) for r in v))))
    else:
        ebook_meta = find_bin("ebook-meta", args.calibre_dir, required=False) if mode == "preview" else None
        checks = misfile_checks(books, ebook_meta, args.workers)
        if checks:
            ui.warn("%s books might be misfiled or duplicated" % fmt_n(len(checks)))
        else:
            ui.ok("Nothing looks misfiled or duplicated")
    checks = {k: v for k, v in checks.items() if k in by_id}
    hold = {i for i, v in checks.items() if any(is_strong(r) for r in v)} | skip

    next_step("Planning changes")
    plan, edits, rows, fields, rejected = plan_details(books, cache, args, hold)
    preview = out / "calibre_cleanup_preview.csv"
    with open(str(preview), "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["book_id", "current_title", "field", "old", "new", "reason"])
        w.writerows(rows)
    ui.kv("Books", fmt_n(len(books)))
    ui.kv("Need changes", fmt_n(len(plan)))
    for field in ("title", "series", "publisher", "tags"):
        if fields[field]:
            ui.say("%9s  %s" % (fmt_n(fields[field]), FIELD_LABELS[field]))
    if rejected:
        ui.say("%9s  %s" % (fmt_n(rejected), ui.dim("online match%s ignored (a different book; nothing changed)"
                                                    % ("" if rejected == 1 else "es"))))
    if hold:
        ui.say("%9s  %s" % (fmt_n(len(hold)), ui.dim("books left alone (suspected misfiles%s)"
                                                     % (" and --skip" if skip else ""))))

    if mode == "preview":
        swaps, no_better = [], []
        if do_covers:
            next_step("Checking covers")
            new_titles = {bid: ch["title"][1] for bid, ch in plan.items() if "title" in ch}
            swaps, no_better = propose_covers(args, books, covers, hold, new_titles)
        else:
            covers.mkdir(parents=True, exist_ok=True)
        review_state.write_text(json.dumps({"time": time.strftime("%Y-%m-%d %H:%M"),
                                            "checks": {str(k): v for k, v in checks.items()}}))

        def rel(folder, b):
            f = cover_file(covers / folder, b["id"])
            return "%s/%s/%s" % (COVERS, folder, f.name) if f else ""

        page = out / REVIEW_PAGE
        write_review_page(
            page, sorted(edits, key=lambda x: x[0]["title"]),
            [(by_id[i], rel("current", by_id[i]), r) for i, r in sorted(
                checks.items(), key=lambda kv: (not any(is_strong(x) for x in kv[1]), by_id[kv[0]]["title"], kv[0]))],
            [(b, rel("current", b), rel("new", b), probs) for b, probs, _ in sorted(swaps, key=lambda x: x[0]["title"])],
            sorted(no_better, key=lambda x: x[0]["title"]), apply_cmd)
        ui.say()
        ui.kv("Books to check", fmt_n(len(checks)))
        ui.kv("Detail changes", "%s books" % fmt_n(len(plan)))
        if do_covers:
            ui.kv("New covers", fmt_n(len(swaps)))
        ui.kv("Review page", pretty_path(page))
        ui.say()
        ui.ok("Nothing was changed. Look over the review page, then apply everything with:")
        ui.cmd(apply_cmd)
        ui.result(action="review", ok=True, books=len(books), to_check=len(checks), changes=len(plan),
                  new_covers=len(swaps), held=sorted(hold), review_page=str(page), preview_csv=str(preview))
        if sys.platform == "darwin" and sys.stdout.isatty() and not ui.events:
            subprocess.run(["open", str(page)], capture_output=True)
        return

    # ---- apply
    next_step("Applying")
    new_covers = [p for p in sorted((covers / "new").glob("*.jpg"))
                  if int(p.name.split(" - ")[0]) not in hold] if (covers / "new").exists() else []
    if not plan and not new_covers:
        ui.ok("Nothing to change. Your library is already tidy.")
        ui.result(action="apply", ok=True, changed=0, covers=0)
        return
    announce_pause(pause, "while Calibre's database is written")
    if not confirm("Apply %s detail changes and %s new covers?" % (fmt_n(len(plan)), fmt_n(len(new_covers)))):
        ui.ok("Nothing changed")
        return
    failed, changed, cover_ids = [], [], []
    with Paused(pause):
        backup = Path(lib) / ("metadata.db.backup-%s" % datetime.now().strftime("%Y%m%d-%H%M%S"))
        shutil.copy2(str(Path(lib) / "metadata.db"), str(backup))
        ui.ok("Backed up your Calibre database (%s)" % backup.name)
        if plan:
            with ui.progress(len(plan), "Details") as bar:
                for bid, changes in plan.items():
                    cmd = [calibredb, "set_metadata", "--library-path", lib]
                    for field, (_, new, _) in changes.items():
                        cmd += ["--field", "%s:%s" % (field, new)]
                    cmd.append(str(bid))
                    bar.update(note=by_id[bid]["title"])
                    try:
                        run(cmd)
                        changed.append(bid)
                    except SystemExit:
                        raise
                    except Exception as e:
                        failed.append((by_id[bid]["title"], (str(e).strip().splitlines() or [""])[-1]))
                bar.note = ""
                bar.summary = "Updated the details of %s books" % fmt_n(len(changed))
        cover_ids = set_covers(new_covers, calibredb, lib, covers) if new_covers else []
        embed(set(changed) | set(int(i) for i in cover_ids), calibredb, lib)
        (covers / "last_apply.json").write_text(json.dumps({
            "time": time.strftime("%d %b %Y at %H:%M"), "backup": str(backup),
            "changed": changed, "covers": [int(i) for i in cover_ids]}))
    for title, err in failed[:5]:
        ui.warn("Couldn't update \"%s\": %s" % (title, err))
    for title, err in failed[5:]:
        ui.to_log("NOTE   couldn't update %s: %s" % (title, err))
    if len(failed) > 5:
        ui.warn("...and %d more (all listed in the log)" % (len(failed) - 5))
    ui.say()
    ui.rule()
    ui.line("  " + ui.green("✓ Done.") + " Open Calibre to see the results.", "DONE")
    ui.rule()
    ui.kv("Details updated", "%s books" % fmt_n(len(changed)))
    ui.kv("Covers replaced", fmt_n(len(cover_ids)))
    if hold:
        ui.kv("Left alone", "%s books (fix the misfiled ones by hand, see the review page)" % fmt_n(len(hold)))
    ui.kv("Took", fmt_time(time.time() - ui.started))
    ui.say("Changed your mind? This puts everything back:")
    ui.cmd(me("undo"))
    ui.result(action="apply", ok=not failed, changed=len(changed), covers=len(cover_ids), held=sorted(hold),
              failed=[{"title": t, "error": e} for t, e in failed], backup=str(backup))


# ============================================================== init & status
def library_from_containers():
    """The Calibre library a container like Calibre-Web serves (the folder holding metadata.db)."""
    if not docker_ok():
        return None, None
    for c in list_containers():
        if not re.search(r"calibre", c["image"] + " " + c["name"], re.I):
            continue
        try:
            info = inspect_container(c["name"])
        except Exception:
            continue
        for src, dst, typ in info["mounts"]:
            if typ != "bind" or not src:
                continue
            for cand in [Path(src)] + ([p for p in Path(src).iterdir() if p.is_dir()] if Path(src).is_dir() else []):
                try:
                    if (cand / "metadata.db").is_file():
                        return cand, c["name"]
                except OSError:
                    continue
    return None, None


def guess_books_library():
    cands = [Path.home() / "Calibre Library"]
    vols = Path("/Volumes")
    if vols.is_dir():
        for v in sorted(vols.iterdir()):
            for name in ("books", "Books", "Calibre Library", "calibre"):
                d = v / name
                try:
                    cands += [d] + (sorted(p for p in d.iterdir() if p.is_dir()) if d.is_dir() else [])
                except OSError:
                    continue
    for c in cands:
        try:
            if (c / "metadata.db").is_file():
                return c
        except OSError:
            continue
    return None


def init_cmd(args):
    ui.title("Books organizer", "setup")
    values = {}
    lib = Path(os.path.expanduser(args.library)) if args.library else None
    if not lib:
        lib, who = library_from_containers()
        if lib:
            ui.ok("Found the Calibre library %s serves: %s" % (who, pretty_path(lib)))
    if not lib:
        lib = guess_books_library()
        if lib:
            ui.ok("Found a Calibre library at %s" % pretty_path(lib))
    if lib and (Path(lib) / "metadata.db").is_file():
        values["library"] = str(lib)
    else:
        ui.warn('Couldn\'t find a Calibre library (a folder with metadata.db). Run init again with --library.')
    tools = find_bin("calibredb", CFG["books"].get("calibre_bin_dir") or None, required=False)
    if tools:
        ui.ok("Calibre's tools are installed (%s)" % pretty_path(Path(tools).parent))
    else:
        ui.warn("Calibre's command-line tools aren't on this machine. Install the Calibre app first.")
    if lib and docker_ok():
        users = [c["name"] for c in containers_using(Path(lib).resolve(), CFG["books"].get("pause_containers", "auto"))]
        if users:
            ui.ok("Will pause %s while Calibre's database is written" % ", ".join(users))
    target = save_config_section("books", values, args.config)
    ui.kv("Settings saved", pretty_path(target))
    ui.cmd(me("status"))
    ui.result(action="init", ok=bool(values.get("library")), settings=str(target), library=values.get("library"),
              calibre_tools=bool(tools))


def status_cmd(args):
    out = reports_dir()
    lib = CFG["books"].get("library") or ""
    info = {"settings": str(CFG_PATH) if CFG_PATH else None, "reports_dir": str(out), "library": lib or None,
            "calibre_tools": bool(find_bin("calibredb", CFG["books"].get("calibre_bin_dir") or None, required=False))}
    db = Path(os.path.expanduser(lib)) / "metadata.db" if lib else None
    if db and db.is_file():
        import sqlite3
        try:
            con = sqlite3.connect("file:%s?mode=ro" % db, uri=True)
            info["books"] = con.execute("select count(*) from books").fetchone()[0]
            con.close()
        except Exception:
            info["books"] = None
        covers = out / COVERS
        for key, f, field in (("last_review", "review.json", "time"), ("last_apply", "last_apply.json", "time")):
            p = covers / f
            info[key] = json.loads(p.read_text()).get(field) if p.exists() else None
        page = out / REVIEW_PAGE
        info["review_page"] = str(page) if page.exists() else None
        info["pause"] = [c["name"] for c in containers_using(db.parent.resolve(), CFG["books"].get("pause_containers", "auto"))]
    elif lib:
        info["error"] = "no Calibre library there"
    if args.json or ui.events:
        print(json.dumps(info, indent=None if ui.events else 2))
        return
    ui.title("Books organizer", "status")
    ui.kv("Settings", pretty_path(CFG_PATH) if CFG_PATH else ui.yellow("none yet: run " + me("init")))
    ui.kv("Library", pretty_path(lib) if lib else ui.dim("not set"))
    if info.get("error"):
        ui.kv("Problem", info["error"])
    if "books" in info:
        ui.kv("Books", fmt_n(info["books"]) if info["books"] is not None else "?")
        ui.kv("Last review", info.get("last_review") or ui.dim("never"))
        ui.kv("Last apply", info.get("last_apply") or ui.dim("never"))
        if info.get("pause"):
            ui.kv("Pauses", ", ".join(info["pause"]))
    if not info["calibre_tools"]:
        ui.kv("Calibre tools", ui.yellow("not found: install the Calibre app, or set books → calibre_bin_dir"))
    ui.kv("Next", me("review"))


# ============================================================== command line
def main():
    global YES
    ap = argparse.ArgumentParser(prog=Path(__file__).name, description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("action", choices=["init", "status", "review", "apply", "undo"])
    ap.add_argument("--library", help="Calibre library folder (overrides the settings file)")
    ap.add_argument("--config", help="settings file (default: homelab_media.json next to this script)")
    ap.add_argument("--skip", default="", help="book ids to leave alone, e.g. 1049,1069")
    ap.add_argument("--covers-for", help='also get new covers for these titles, e.g. "Frankenstein; Dune"')
    ap.add_argument("--no-covers", action="store_true", help="skip the cover checks")
    ap.add_argument("--keep-subtitles", action="store_true", help='don\'t shorten "Title: Long Subtitle"')
    ap.add_argument("--no-online", action="store_true", help="don't look books up online")
    ap.add_argument("--refetch", action="store_true", help="ignore the saved online lookups")
    ap.add_argument("--workers", type=int, default=0, help=argparse.SUPPRESS)
    ap.add_argument("--yes", action="store_true", help="don't ask for confirmation")
    ap.add_argument("--events", choices=["text", "json"], help="json: one JSON object per line, for apps")
    ap.add_argument("--json", action="store_true", help="status: print it as JSON")
    args = ap.parse_args()
    if args.events == "json":
        ui.use_events()
    YES = args.yes
    if args.action == "init" and args.config and not Path(args.config).expanduser().exists():
        load_config(None)
    else:
        load_config(args.config)
    if args.action == "init":
        return init_cmd(args)
    if args.action == "status":
        return status_cmd(args)
    return books_cmd(args)


if __name__ == "__main__":
    run_main(main)
