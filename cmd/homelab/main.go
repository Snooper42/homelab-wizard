// Command homelab runs the homelab on macOS (OrbStack) or Linux (Docker
// Engine): it starts the
// baseline, slots in optional apps, wires up the domain, and runs the
// scheduled jobs (backups, watchdog). compose.yaml and stacks/*/compose.yaml
// are the catalog.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/host"
	"github.com/Snooper42/homelab-wizard/internal/install"
	"github.com/Snooper42/homelab-wizard/internal/progress"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// version is set at build time with -ldflags "-X main.version=...".
var version = "dev"

const usage = `homelab: run the homelab on this machine (macOS with OrbStack, Linux with Docker Engine or Docker in your home folder, or Windows with Docker Desktop)

Apps:
  homelab                              interactive menu
  homelab up                           start the baseline (every always-on app)
  homelab install [apps...]            slot in optional apps (no args: pick from a list)
  homelab plan [apps...]               what up/install would do; changes nothing
  homelab status [--all]               state, health, and address of every app
  homelab apps [--category ID]         browse the catalog
  homelab detect                       containers already running on this machine
  homelab cleanup [--volumes]          remove old containers whose apps now run in the homelab
  homelab signups open|close           Vaultwarden sign-ups, open for 10 minutes (--for 30m)
  homelab custom add <id> --image X    add your own app (--port, --volume, --env, --install)
  homelab custom [remove <id>]         list or remove your own apps
  homelab adopt <apps>                 move apps running outside the homelab into it:
                                       stop the old containers, copy their data, start
  homelab start|stop|restart <apps>
  homelab update <apps>                dump their databases, pull (or rebuild), and recreate
  homelab update --all                 every app the nightly update would, now
  homelab db upgrade <db> [--to N]     a PostgreSQL database to a new major version: dump,
                                       start the new version, restore, check (back if not)
  homelab rollback <app>               back to the image it ran before its last update
                                       (kept a week), and hold its updates
  homelab remove <apps>                remove containers; data stays
  homelab logs <app> [-f]
  homelab logs <app> --explain         what its log says, in plain words, from the Ollama on
                                       this machine (the log stays here)
  homelab compose <app|stack> <args>   docker compose for that app's project
  homelab updates [pause|resume]       nightly image updates (Watchtower)
  homelab updates hold|release <app>   leave one app out of them, or put it back
  homelab updates notes <app>          what updating it brings: its newer releases' notes
  homelab wire                         connect running apps: Prowlarr, FlareSolverr,
                                       qBittorrent (QBITTORRENT_PASSWORD), Seerr, Bazarr

Domain:
  homelab domain setup [domain]        proxy hosts, LAN DNS, certificate, public hostnames
  homelab domain status
  homelab domain resolver              this machine finds every app by name, also with a VPN on
  homelab domain resolver --undo       takes that back, and homelab's lines in the hosts file
  homelab person add "<name>" --email A  someone in the household: a Pocket ID account, a first
                                       sign-in link, and a welcome page with their apps
  homelab person [list]|welcome|remove the household; remove turns sign-in off, data stays
  homelab person apps <name> [<app>…]  the apps they use: their welcome page and Homepage tab
  homelab sso [setup]                  the apps that sign in with Pocket ID; setup connects the
                                       rest (their clients in Pocket ID, their settings)
  homelab tailnet login                sign Tailscale in through its page in the browser (no auth key)
  homelab tailnet setup                without a domain (Home mode): every app at
                                       https://homelab.<tailnet>.ts.net:<port> through Tailscale
  homelab adguard setup                AdGuard Home's first run with a generated login, and the
                                       tailnet DNS setting for ad blocking on every device

Jobs (launchd on macOS, systemd user units on Linux, Task Scheduler on Windows):
  homelab backup                       dump databases, archive volumes, copy .env
  homelab watchdog                     check the tunnel and public apps; alert via ntfy
  homelab restore-test --auto [--engine duplicati|kopia] | <restored> <original>
  homelab duplicati setup|jobs         create the backup jobs (passphrases in .env) / list them
  homelab notify setup|test            ntfy write grants for alert topics / test message
  homelab digest [--send]              the weekly summary the nightly backup sends on Sundays
  homelab schedule install|status|remove
  homelab agent                        the background job: starts the apps at login, keeps awake,
                                       the phone companion, the watchdog, and the nightly backup
  homelab awake                        keep this machine awake while plugged in (the awake job)
  homelab awake allow [--undo]         on Linux, let the awake job hold off sleep (asks for the
                                       administrator's password once)
  homelab serve                        the phone companion on port 8099, home network and
                                       tailnet only (the serve job)

Phones:
  homelab phone pair [--name N]        a one-time code for a phone (--can-change: it may
                                       start, stop, restart, and back up)
  homelab phone [list]                 the paired phones
  homelab phone allow|read-only <id>   let a phone make changes, or only look
  homelab phone remove <id>            unpair a phone; its token stops working

Maintenance:
  homelab setup                        the first-time setup checklist, with live checks
  homelab upgrade                      get the newest homelab files from GitHub (with what is new
                                       from the CHANGELOG), then up
  homelab upgrade --back               back to the version before the last upgrade, then up
  homelab migrate                      move apps from an old Compose project into their
                                       category's (a backup first; data stays)
  homelab kit [update FILE]            a folder the desktop app made: its kit, or update it
  homelab homepage                     write Homepage's list of apps (also after installs)
  homelab doctor                       check this machine, the container runtime, and settings
  homelab runtime install              Linux (SteamOS too): set up Docker in your home folder, run
                                       as you, kept across system updates
  homelab fix                          repair what usually goes wrong: the runtime stopped,
                                       apps down or unwell, a full disk, jobs missing
  homelab report [--stdout]            a diagnostics file to share, with every secret removed
  homelab docs                         refresh the generated facts in docs/ and services/
  homelab validate                     compose metadata and docs (CI runs this)
  homelab export [--photos] [--to <folder>]
                                       every app's data in open formats in one folder: tables as
                                       CSV, documents with tags, albums, vault exports
  homelab move out [--to <file>]       move to another machine: back up, stop, and pack it in one file
  homelab move in <file>               on the new machine: unpack, load the databases, start what ran
  homelab recovery-kit                 a printable page: where the backups and passphrases are,
                                       and how to restore (no secrets in it)
  homelab uninstall [--data]           remove the containers, images, jobs, and tray icon;
                                       the data stays unless --data (backups always stay)
  homelab version

Selecting apps:
  sonarr radarr     by name             overseerr      aliases (-> seerr)
  '*-arr'           the *arr set        cat:media      a category
  @arr              a bundle            --exclude x    leave apps out

Commands that change something show a plan first. In a terminal they ask;
elsewhere (scheduled jobs, scripts) add --apply (or -y) to go ahead.

Global flags:
  --root DIR        repository directory (default: auto-detected)
  --no-color        plain output
  --json            one JSON object per line, {"schema": 1, "type": ..., "data": ...}, for
                    apps, plan, install, up, status, wire, updates, setup,
                    upgrade (the check);
                    install and up then need --apply and stream progress events

Settings for install, plan, and up:
  --set KEY=value   write a setting to .env (repeatable); plans never echo it
  --set-stdin       read KEY=value lines from stdin, keeping secrets off the
                    command line
`

func main() {
	// A closed terminal (SIGHUP) cancels like Ctrl-C, so cleanups such as
	// closing Vaultwarden sign-ups still run. Output to a reader that went
	// away (the app quit) is dropped instead of killing the command.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM, syscall.SIGHUP)
	defer stop()
	signal.Ignore(syscall.SIGPIPE)
	os.Exit(run(ctx, ui.New(), os.Args[1:]))
}

func run(ctx context.Context, u *ui.UI, args []string) int {
	root := os.Getenv("HOMELAB_ROOT")
	var rest []string
	for i := 0; i < len(args); i++ {
		switch a := args[i]; {
		case a == "--no-color":
			u.Color = false
		case a == "--json":
			u.JSON, u.Color, u.Interactive = true, false, false
		case a == "--root" && i+1 < len(args):
			root = args[i+1]
			i++
		case strings.HasPrefix(a, "--root="):
			root = strings.TrimPrefix(a, "--root=")
		default:
			rest = append(rest, a)
		}
	}
	if len(rest) > 0 {
		switch rest[0] {
		case "-h", "--help", "help":
			fmt.Fprint(u.Out, usage)
			return 0
		case "version", "--version":
			fmt.Fprintln(u.Out, "homelab", version)
			return 0
		case "runtime":
			// Before there is a homelab folder: Docker comes first.
			return exit(u, runtimeCmd(ctx, u, rest[1:]))
		}
	}
	h, err := newHomelab(u, root)
	if err != nil {
		return exit(u, err)
	}
	if len(rest) == 0 {
		if !u.Interactive {
			fmt.Fprint(u.Out, usage)
			return 2
		}
		return exit(u, h.menu(ctx))
	}
	cmd, cmdArgs := rest[0], rest[1:]
	commands := map[string]func(context.Context, []string) error{
		"menu":         func(ctx context.Context, _ []string) error { return h.menu(ctx) },
		"up":           h.up,
		"install":      h.install,
		"plan":         h.plan,
		"status":       h.status,
		"apps":         h.apps,
		"bundles":      h.bundles,
		"detect":       h.detect,
		"adopt":        h.adopt,
		"custom":       h.custom,
		"signups":      h.signups,
		"cleanup":      h.cleanup,
		"start":        h.lifecycle("start"),
		"stop":         h.lifecycle("stop"),
		"restart":      h.lifecycle("restart"),
		"update":       h.lifecycle("update"),
		"remove":       h.lifecycle("remove"),
		"logs":         h.logs,
		"compose":      h.compose,
		"wire":         h.wire,
		"updates":      h.updates,
		"domain":       h.domain,
		"backup":       h.backup,
		"restore-test": h.restoreTest,
		"duplicati":    h.duplicatiCmd,
		"homepage":     h.homepageCmd,
		"digest":       h.digestCmd,
		"watchdog":     h.watchdog,
		"notify":       h.notify,
		"schedule":     h.schedule,
		"doctor":       h.doctor,
		"report":       h.report,
		"setup":        h.setupChecklist,
		"docs":         h.docs,
		"validate":     h.validate,
		"upgrade":      h.upgradeCmd,
		"kit":          h.kitCmd,
		"awake":        h.awake,
		"agent":        h.agent,
		"serve":        h.serve,
		"rollback":     h.rollback,
		"db":           h.dbCmd,
		"sso":          h.ssoCmd,
		"person":       h.personCmd,
		"uninstall":    h.uninstall,
		"recovery-kit": h.recoveryKit,
		"export":       h.exportCmd,
		"move":         h.moveCmd,
		"phone":        h.phoneCmd,
		"fix":          h.fix,
		"migrate":      h.migrate,
		"tailnet":      h.tailnetCmd,
		"adguard":      h.adguardCmd,
	}
	fn, ok := commands[cmd]
	if !ok {
		u.Fail("unknown command %q (see: homelab help)", cmd)
		return 2
	}
	return exit(u, fn(ctx, cmdArgs))
}

func exit(u *ui.UI, err error) int {
	switch {
	case err == nil:
		return 0
	case u.JSON && errors.Is(err, errPreview):
		emit(u, "preview", nil)
		return 0
	case u.JSON:
		emit(u, "error", map[string]string{"message": err.Error()})
		return 1
	case errors.Is(err, errPreview):
		u.Printf("\n%s\n", u.Dim("Preview only: nothing was changed. Run again with --apply to go ahead."))
		return 0
	case errors.Is(err, errCancelled):
		u.Println("Cancelled.")
		return 1
	case errors.Is(err, flag.ErrHelp):
		return 2
	}
	u.Fail("%v", err)
	return 1
}

// jsonSchema is the --json contract's version, in every line. It goes up
// only when a field clients read is removed or changes meaning (new fields
// do not change it); internal/api's TestJSONContract guards it.
const jsonSchema = 1

// emit writes one line of JSON output: {"schema": 1, "type": typ, "data": data}.
func emit(u *ui.UI, typ string, data any) {
	line, err := json.Marshal(struct {
		Schema int    `json:"schema"`
		Type   string `json:"type"`
		Data   any    `json:"data,omitempty"`
	}{jsonSchema, typ, data})
	if err != nil {
		line, _ = json.Marshal(map[string]any{"schema": jsonSchema, "type": "error", "data": map[string]string{"message": err.Error()}})
	}
	fmt.Fprintf(u.Out, "%s\n", line)
}

var (
	errCancelled = errors.New("cancelled")
	errPreview   = errors.New("preview")
)

// homelab holds what every command needs.
type homelab struct {
	ui      *ui.UI
	root    string
	envFile string
	catalog *catalog.Catalog
	client  *docker.Client
	// rows shows Compose's lines as a line per app, in a terminal (rows.go).
	rows *appRows
	host host.Profile
}

func newHomelab(u *ui.UI, root string) (*homelab, error) {
	if root == "" {
		root = findRoot()
	}
	if root == "" {
		return nil, errors.New("could not find compose.yaml; run from the homelab folder or pass --root")
	}
	root, _ = filepath.Abs(root)
	cat, err := catalog.Load(root)
	if err != nil {
		return nil, err
	}
	return &homelab{ui: u, root: root, envFile: filepath.Join(root, ".env"), catalog: cat, host: host.Current()}, nil
}

// findRoot looks for compose.yaml from the working directory upward, then
// next to the executable (bin/homelab lives one level below the repo).
func findRoot() string {
	isRoot := func(dir string) bool {
		_, err := os.Stat(filepath.Join(dir, "compose.yaml"))
		_, err2 := os.Stat(filepath.Join(dir, ".env.example"))
		return err == nil && err2 == nil
	}
	if wd, err := os.Getwd(); err == nil {
		for dir := wd; ; dir = filepath.Dir(dir) {
			if isRoot(dir) {
				return dir
			}
			if dir == filepath.Dir(dir) {
				break
			}
		}
	}
	if exe, err := os.Executable(); err == nil {
		exe, _ = filepath.EvalSymlinks(exe)
		for _, dir := range []string{filepath.Dir(exe), filepath.Dir(filepath.Dir(exe))} {
			if isRoot(dir) {
				return dir
			}
		}
	}
	return ""
}

// docker returns a client, or a helpful error when no runtime is available.
func (h *homelab) docker(ctx context.Context) (*docker.Client, error) {
	if h.client != nil {
		return h.client, nil
	}
	c, err := docker.New()
	if err != nil {
		return nil, fmt.Errorf("%w (%s)", err, h.host.InstallRuntime)
	}
	if _, err := c.Info(ctx); err != nil {
		return nil, fmt.Errorf("%s, then retry.\n    %v", h.host.Unreachable(err), err)
	}
	// Run from the app (which reads the steps as JSON): Compose's progress
	// as JSON too, for the app's row per app. In a terminal, the same rows,
	// as lines (rows.go), instead of Docker's own.
	switch {
	case h.ui.Progress:
		if c.JSONProgress(ctx) {
			c.Progress = "json"
		}
	case h.ui.Live && !h.ui.JSON:
		if c.JSONProgress(ctx) {
			c.Progress = "json"
		}
		h.rows = newAppRows(h.ui, progress.New(h.catalog, h.envMap()))
		c.Runner = rowsRunner{ExecRunner: docker.ExecRunner{Stdout: h.rows, Stderr: h.rows}, rows: h.rows}
	}
	h.client = c
	return c, nil
}

// project is how Compose runs for one file.
func (h *homelab) project(f *compose.File) docker.Project { return install.ProjectFor(f, h.envFile) }

// repoVersion is the version in the VERSION file.
func (h *homelab) repoVersion() string {
	data, err := os.ReadFile(filepath.Join(h.root, "VERSION"))
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(data))
}

// parseFlags parses flags that may appear before, between, or after positional args.
func parseFlags(fs *flag.FlagSet, args []string) ([]string, error) {
	var positional []string
	for {
		if err := fs.Parse(args); err != nil {
			return nil, err
		}
		args = fs.Args()
		if len(args) == 0 {
			return positional, nil
		}
		positional = append(positional, args[0])
		args = args[1:]
	}
}

func newFlags(name string) *flag.FlagSet {
	fs := flag.NewFlagSet(name, flag.ContinueOnError)
	fs.Usage = func() { fmt.Fprintf(fs.Output(), "see: homelab help\n") }
	return fs
}

// applyFlag registers --apply, --yes, and -y as one switch.
func applyFlag(fs *flag.FlagSet) *bool {
	v := fs.Bool("apply", false, "")
	fs.BoolVar(v, "yes", false, "")
	fs.BoolVar(v, "y", false, "")
	return v
}

// goAhead decides whether to apply a plan: --apply, or a yes in a terminal.
// Without a terminal and without --apply it is a preview.
func (h *homelab) goAhead(apply bool, question string) error {
	if apply {
		return nil
	}
	if !h.ui.Interactive {
		return errPreview
	}
	if !h.ui.Confirm(question, true) {
		return errCancelled
	}
	return nil
}
