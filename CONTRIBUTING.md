# Contributing

How to change the code and the compose files. For operating the homelab and adding a service, see [docs/Contributing](docs/Contributing.md).

## Setup

```bash
brew install go
make check
```

Go 1.23 or newer. The only dependency is `gopkg.in/yaml.v3`.

## Layout

| Path | What |
|---|---|
| `cmd/homelab` | Commands and their end-to-end tests (a fake `docker` on `PATH`) |
| `cmd/homelab-run` | Windows only: starts a scheduled job's script without a console window |
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
- `make compose-config` passes when a compose file changes (needs the `docker compose` CLI).
- A change to the desktop app passes `make app-check` (formatting, vet, and Windows builds of the app module for x64 and ARM64) and `make frontend-check`. The frontend is TypeScript in `web/src`; `make frontend` (or `npm run build`) compiles it with esbuild into `web/dist/app.js`, which is committed so the Go builds need no Node, and `make frontend-check` fails while it is out of date. Screens move into Preact components (`.tsx`, typed against `web/types`) one at a time: a component file exports a `mount…(element, props)` function that `app.ts` calls where it used to build the DOM by hand (`web/src/status/Tiles.tsx` is the first). It also type-checks `web/src` (`npm ci` fetches TypeScript and esbuild) against the Go side's types: `web/types/backend.d.ts` is generated from the methods the app binds and the events it sends, and after changing them, `cd app && go test -run TestBindings -update .` rewrites it (CI fails while it is out of date). Its look follows each platform (`html.os-mac`, `os-windows`, `os-linux` in `style.css`); the preview stands in for one with `platform` in its mock. With Playwright and Chromium: `make app-smoke` clicks through the buttons that run commands (Test a restore, Create the backup jobs, Get the update, Copy, …) against the fake backend, and `make screenshots` refreshes the pictures and fails if an element the page hid is displayed.
- Anything that changes state previews first and acts only with `--apply` or a yes in a terminal.
- Never print, log, or pass secrets on a command line. Read them from `.env` when needed.
- New behaviour gets a test. Network APIs are tested against `httptest` fakes; Docker against the fake CLI in `cmd/homelab/main_test.go`.
- A change someone running the homelab would notice gets a line in `CHANGELOG.md` under Unreleased.

## Releases

1. Move the Unreleased entries under a new version heading in `CHANGELOG.md`.
2. Set the version in `VERSION` and in the `version:` front matter of every note (`./homelab validate` checks they match).
3. `make check`, commit, and tag `v<version>`.
