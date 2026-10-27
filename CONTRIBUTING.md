# Contributing

How to change the code and the compose files. For operating the homelab and adding a service, see [docs/Contributing](docs/Contributing.md).

## Setup

```bash
brew install go
make check
```

Go 1.25 or newer (Go fetches the version in `go.mod` by itself). The only dependency is `gopkg.in/yaml.v3`.

## Layout

| Path | What |
|---|---|
| `cmd/homelab` | Commands and their end-to-end tests (a fake `docker` on `PATH`) |
| `cmd/homelab-run` | Windows only: starts a scheduled job's script without a console window |
| `test/realdocker` | A homelab's life against a real Docker Engine (build tag `realdocker`): install, data through each app's API, backup, the watchdog's cases, update and rollback, move out, wipe, move in. `.github/workflows/nightly.yml` runs it every night and on pull requests that change the catalog; each new app joins its `apps` table |
| `internal/compose` | Reads compose files, ports, volumes, and `x-homelab` metadata |
| `internal/catalog` | Apps across every compose file, categories, bundles, validation |
| `internal/selector`, `detect`, `ports`, `install` | Choosing apps, finding running containers, free ports, install plans |
| `internal/docker`, `envfile` | The `docker` CLI and `.env` |
| `internal/npm`, `domain`, `crowdsec` | Nginx Proxy Manager API, AdGuard, Cloudflare, tunnel ingress, the proxy's CrowdSec bouncer |
| `internal/backup`, `health`, `notify`, `schedule` | Jobs: dumps and archives, the backup overview, checks, ntfy, launchd, systemd, and Task Scheduler |
| `internal/duplicati` | Duplicati's API: jobs' last runs, creating, running, and repairing jobs, default options, restores |
| `internal/digest`, `savings`, `updates` | The weekly summary, what the apps replace (and its history), pausing Watchtower |
| `internal/diskspace` | Free space on each disk the homelab writes to (statfs, or GetDiskFreeSpaceEx on Windows) |
| `internal/diskhealth` | Each drive's own health report (SMART) through smartctl |
| `internal/procattr` | Windows: commands started without a console of their own open no window |
| `internal/upgrade` | The homelab folder against GitHub: changes waiting, fast-forward pulls, the app's build against the folder |
| `internal/setup`, `settings`, `api`, `host` | The first-time checklist and Settings tests, `.env` as a form, status for the app, per-OS profiles |
| `internal/wiring`, `homepage`, `adopt`, `custom` | Connecting apps through their APIs, Homepage's list of apps, moving old containers in, your own apps |
| `internal/docs` | Generated blocks in the notes, version and link checks |
| `internal/ui` | Terminal output and prompts |
| `app/` | The desktop app (its own module): `app.go` binds the engine to the frontend in `web/dist` (shared with `homelab serve`, as is `internal/core`); `tray/` and `cmd/homelab-tray` are the menu bar item; per-platform files (`menu_darwin.go`, `backdrop_windows.go`, `autostart_*.go`, `menuentry_linux.go`) hold each OS's window, menus, and login items; `packaging/` builds the Linux packages and the AppImage; `preview/` runs the frontend in Chromium with a fake backend |

## Rules

- `make help` lists the targets. `make check` passes before every commit: `gofmt`, `go vet`, `bash -n`, tests, and `homelab validate`.
- `make coverage` passes: every package at or above its floor in `coverage-floors.txt`. Raise a package's floor when its tests raise its coverage; lower one only with the reason in the pull request.
- `make compose-config` passes when a compose file changes (needs the `docker compose` CLI).
- A new catalog app gets a row in `test/realdocker`'s `apps` table (its page, and data put in and read back through its API where it has one), so the nightly run shows it starts and answers. Locally: `go test -tags realdocker -v ./test/realdocker` with Docker running (`REALDOCKER_APPS=ntfy,vaultwarden` for a few, `REALDOCKER_KEEP=1` to leave them running).
- A change to the desktop app passes `make app-check` (formatting, vet, and Windows builds of the app module for x64 and ARM64) and `make frontend-check`. The frontend is TypeScript in `web/src`; `make frontend` (or `npm run build`) compiles it with esbuild into `web/dist/app.js`, which is committed so the Go builds need no Node, and `make frontend-check` fails while it is out of date. Every screen is drawn by Preact components (`.tsx`, typed against `web/types`), one folder per screen (`web/src/status`, `backups`, `choose`, `setup`, `settings`, `logs`): a component file exports a `mount…(element, props)` function, and the screen's module in `web/src/screens` reads the data, runs the commands, and mounts the components with what they need; `app.ts` only chooses the screen and starts the app, and `make frontend-check` fails if it reaches 400 lines or anything calls `document.createElement`. Keep what someone types or toggles in the component (a typed setting, a click-again confirmation), and what a command changes as a prop (`busy`), never as an edit of the DOM Preact drew. Preact renders beside what it did not draw, so a mount point starts empty in `index.html` (or the component clears it first). It also type-checks `web/src` (`npm ci` fetches TypeScript and esbuild) against the Go side's types: `web/types/backend.d.ts` is generated from the methods the app binds and the events it sends, and after changing them, `cd app && go test -run TestBindings -update .` rewrites it (CI fails while it is out of date). It also fails on a Mac word ("menu bar", "Finder", "this Mac", OrbStack, ⌘) in a string outside a Mac branch (`app/preview/words.mjs`, like the Go side's `TestNoMacOnlyWordsElsewhere`). Its look follows each platform (`html.os-mac`, `os-windows`, `os-linux` in `style.css`); the preview stands in for one with `platform` in its mock. With Playwright and Chromium (`npm ci`, then `npx playwright install chromium`): `make app-smoke` clicks through the buttons that run commands (Test a restore, Create the backup jobs, Get the update, Copy, …) against the fake backend in light and dark, then checks every screen as each system (Mac, Windows, GNOME, KDE, SteamOS), with and without more contrast, through axe (no serious or critical WCAG 2.1 AA finding), for a broken layout, and, as any system but the Mac, for a Mac word on the screen; CI runs it on every pull request and keeps the screenshots of a failure. `SMOKE_ONLY=Setup` runs the checks whose name has it, `SMOKE_DEBUG=1` prints what axe measured. Text in the accent colour uses `--link`, and a filled button `--primary` and `--primary-text`: shades of the accent that read at 4.5:1 (a system blue is too light for small text on white). Colours are tokens only: a rule in `style.css` uses `var(--…)`, and only a custom property in `:root` (or a theme's or platform's block) holds a colour itself (`--shade-08` and `--glow-08` are black and white at 8%); `make frontend-check` fails on a colour written in a rule, or in `web/src` outside the few files where a colour is data (`app/preview/lint.mjs` lists them with why). `make screenshots` refreshes the pictures and fails if an element the page hid is displayed.
- Anything that changes state previews first and acts only with `--apply` or a yes in a terminal.
- Never print, log, or pass secrets on a command line. Read them from `.env` when needed.
- New behaviour gets a test. Network APIs are tested against `httptest` fakes; Docker against the fake CLI in `cmd/homelab/main_test.go`.
- A change someone running the homelab would notice gets a line in `CHANGELOG.md` under Unreleased, in **New**, **Improved**, or **Fixed**. These are patch notes, read in the app before an update and on the release page: one line in plain words about what changed for you ("Opening a category on Status is instant"), not how. The pull request holds the detail.

## Releases

1. Move the Unreleased entries under a new version heading in `CHANGELOG.md`, with a bold one-line summary of the version under it, and add its compare link at the bottom.
2. Set the version in `VERSION` and in the `version:` front matter of every note (`./homelab validate` checks they match).
3. `make check`, commit, and tag `v<version>`.
