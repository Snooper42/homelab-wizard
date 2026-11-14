# Contributing

How to change the code and the compose files. For operating the homelab and adding a service, see [docs/Contributing](docs/Contributing.md).

## Setup

```bash
brew install go          # or your system's package, or go.dev/dl
make check
```

Go 1.26 or newer for the CLI and the desktop app (Go fetches the version in `go.mod` by itself). The CLI's only dependencies are `gopkg.in/yaml.v3`, `rsc.io/qr`, and, on Windows, `github.com/Microsoft/go-winio` (Docker Desktop's named pipe). The frontend needs Node (`npm ci`), and the desktop app the Wails CLI ([app/README.md](app/README.md#run-and-build)).

| You changed | Run before the pull request |
|---|---|
| Go code in `cmd/` or `internal/` | `make check` and `make coverage` |
| A compose file or `x-homelab` metadata | `./homelab docs`, `make check`, and `make compose-config` |
| The desktop app (`app/`) | `make app-check` |
| The frontend (`web/src`) | `make frontend` (commit `web/dist`), `make frontend-check`, and `make app-smoke` |
| Tidy Up's engines (`tools/media`) | `make check` (it runs their tests, `python3 -m unittest discover -s tools/media/tests`); `make music-pins` after changing `tools/media/requirements/music.in`, and `make music-pins-check` |
| The iPhone and iPad app (`apple-client/`) | `cd apple-client && swift build && swift test` on a Mac with full Xcode; [apple-client/README.md](apple-client/README.md) has the iOS build |
| Finances' phone projection (`mobile/finance`) | `make check`, then `make phone-finance-wasm` (and `make phone-finance-framework` on a Mac with Xcode, for the iPhone app) |
| Only docs | `make check` (it runs `homelab validate`: links, versions, generated blocks) |
| The docs website's look or its sidebar (`tools/site`) | `pip install -r tools/site/requirements.txt` in a venv, then `python3 tools/site/assemble.py && mkdocs serve -f tools/site/mkdocs.yml` to browse it. A page added under `docs/` goes in `mkdocs.yml`'s `nav` too. CI builds it on every docs change, and puts main's on the `gh-pages` branch |
| A screen the docs show | `make screenshots` (every picture in `docs/images`, light and dark), and `node app/preview/tour.mjs` and `node app/preview/tour.mjs dark` for the README's walkthrough (`docs/images/tour.gif`, `tour-dark.gif`; needs ffmpeg) |
| A screen of the Homelab app (iPhone) the docs show | Nothing by hand: after a build of main that changes `apple-client/`, its CI puts the docs' ten iPhone pictures on the `iphone-screenshots` branch. Take them with `git fetch origin iphone-screenshots && git checkout FETCH_HEAD -- docs/images`, and commit |

## Layout

| Path | What |
|---|---|
| `cmd/homelab` | Commands and their end-to-end tests (a fake `docker` on `PATH`) |
| `cmd/homelab-run` | Windows only: starts a scheduled job's script without a console window |
| `test/realdocker` | A homelab's life against a real Docker Engine (build tag `realdocker`): install, data through each app's API, backup, the watchdog's cases, update and rollback, move out, wipe, move in; and, in a job of its own (`REALDOCKER_REBUILD=1`), a wiped homelab rebuilt from Duplicati's backups alone. `.github/workflows/nightly.yml` runs it every night and on pull requests that change the catalog; each new app joins its `apps` table |
| `internal/compose` | Reads compose files, ports, volumes, and `x-homelab` metadata |
| `internal/catalog` | Apps across every compose file, categories, bundles, validation |
| `internal/selector`, `detect`, `ports`, `install` | Choosing apps, finding running containers, free ports, install plans |
| `internal/docker`, `dockerapi`, `envfile` | The engine (Docker's API over its socket, or the named pipe on Windows, with the `docker` CLI behind it; commands run in containers) and `.env` |
| `internal/npm`, `domain`, `crowdsec` | Nginx Proxy Manager API, AdGuard, Cloudflare, tunnel ingress, the proxy's CrowdSec bouncer |
| `internal/backup`, `health`, `notify`, `schedule` | Jobs: dumps and archives, the backup overview, checks, ntfy, launchd, systemd, and Task Scheduler |
| `internal/duplicati` | Duplicati's API: jobs' last runs, creating, running, and repairing jobs, default options, restores |
| `internal/finance` | The Finances screen's plan in `data/finance.json`, read forward paycheck by paycheck |
| `internal/digest`, `savings`, `updates` | The weekly summary, what the apps replace (and its history), pausing and holding the nightly updates |
| `internal/diskspace` | Free space on each disk the homelab writes to (statfs, or GetDiskFreeSpaceEx on Windows) |
| `internal/diskhealth` | Each drive's own health report (SMART) through smartctl |
| `internal/procattr` | Windows: commands started without a console of their own open no window |
| `internal/upgrade` | The homelab folder against GitHub: changes waiting, fast-forward pulls, the app's build against the folder |
| `internal/setup`, `settings`, `api`, `host` | The first-time checklist and Settings tests, `.env` as a form, status for the app, per-OS profiles |
| `internal/wiring`, `homepage`, `adopt`, `custom` | Connecting apps through their APIs, Homepage's list of apps, moving old containers in, your own apps |
| `internal/docs` | Generated blocks in the notes, version and link checks |
| `internal/ui` | Terminal output and prompts |
| The rest of `internal/` | [Maintainer Guide › Code layout](docs/Maintainer%20Guide.md#code-layout) lists every package |
| `app/` | The desktop app (its own module): `app.go` binds the engine to the frontend in `web/dist` (shared with `homelab serve`, as is `internal/core`); `tray/` and `cmd/homelab-tray` are the menu bar item; per-platform files (`menu_darwin.go`, `backdrop_windows.go`, `autostart_*.go`, `menuentry_linux.go`) hold each OS's window, menus, and login items; `packaging/` builds the Linux packages and the AppImage; `preview/` runs the frontend in Chromium with a fake backend |
| `tools/media/` | Tidy Up's engines (Python), with their tests in `tools/media/tests` and the music jobs' pinned versions in `tools/media/requirements` |
| `apple-client/` | The native iPhone and iPad app (SwiftUI), a client of the phone companion |
| `mobile/finance`, `cmd/financewasm` | Finances' projection built for a phone (WebAssembly and an iOS framework) |

## Rules

- `make help` lists the targets. `make check` passes before every commit: `gofmt`, `go vet`, `bash -n`, tests, and `homelab validate`.
- `make coverage` passes: every package at or above its floor in `coverage-floors.txt`. Raise a package's floor when its tests raise its coverage; lower one only with the reason in the pull request.
- `make compose-config` passes when a compose file changes (needs the `docker compose` CLI).
- A new catalog app gets a row in `test/realdocker`'s `apps` table (its page, and data put in and read back through its API where it has one), so the nightly run shows it starts and answers. Locally: `go test -tags realdocker -v ./test/realdocker` with Docker running (`REALDOCKER_APPS=ntfy,vaultwarden` for a few, `REALDOCKER_KEEP=1` to leave them running).
- A change to the desktop app passes `make app-check` (formatting, vet, and Windows builds of the app module for x64 and ARM64) and `make frontend-check`. The frontend is TypeScript in `web/src`; `make frontend` (or `npm run build`) compiles it with esbuild into `web/dist/app.js`, which is committed so the Go builds need no Node, and `make frontend-check` fails while it is out of date. Every screen is drawn by Preact components (`.tsx`, typed against `web/types`), one folder per screen or part (`web/src/status`, `backups`, `choose`, `setup`, `settings`, `finances`, `page` for an app's page, `updates`, `job`, `sheets`): a component file exports a `mount…(element, props)` function, and the screen's module in `web/src/screens` reads the data, runs the commands, and mounts the components with what they need; `app.ts` only chooses the screen and starts the app, and `make frontend-check` fails if it reaches 400 lines or anything calls `document.createElement`. Keep what someone types or toggles in the component (a typed setting, a click-again confirmation), and what a command changes as a prop (`busy`), never as an edit of the DOM Preact drew. Preact renders beside what it did not draw, so a mount point starts empty in `index.html` (or the component clears it first). It also type-checks `web/src` (`npm ci` fetches TypeScript and esbuild) against the Go side's types: `web/types/backend.d.ts` is generated from the methods the app binds and the events it sends, and after changing them, `cd app && go test -run TestBindings -update .` rewrites it (CI fails while it is out of date). It also fails on a Mac word ("menu bar", "Finder", "this Mac", OrbStack, ⌘) in a string outside a Mac branch (`app/preview/words.mjs`, like the Go side's `TestNoMacOnlyWordsElsewhere`). Its look follows each platform (`html.os-mac`, `os-windows`, `os-linux` in `style.css`); the preview stands in for one with `platform` in its mock. With Playwright and Chromium (`npm ci`, then `npx playwright install chromium` if no Chromium for Playwright 1.63 is installed): `make app-smoke` clicks through the buttons that run commands (Test a restore, Create the backup jobs, Get the update, Copy, …) against the fake backend in light and dark, then checks every screen as each system (Mac, Windows, GNOME, KDE, SteamOS), with and without more contrast, through axe (no serious or critical WCAG 2.1 AA finding), for a broken layout, and, as any system but the Mac, for a Mac word on the screen; CI runs it on every pull request and keeps the screenshots of a failure. `SMOKE_ONLY=Setup` runs the checks whose name has it, `SMOKE_SHARD=2/3` runs every third one from the second (CI runs three at once in each theme's job, which together are every check), `SMOKE_DEBUG=1` prints what axe measured. Text in the accent colour uses `--link`, and a filled button `--primary` and `--primary-text`: shades of the accent that read at 4.5:1 (a system blue is too light for small text on white). Colours are tokens only: a rule in `style.css` uses `var(--…)`, and only a custom property in `:root` (or a theme's or platform's block) holds a colour itself (`--shade-08` and `--glow-08` are black and white at 8%); `make frontend-check` fails on a colour written in a rule, or in `web/src` outside the few files where a colour is data (`app/preview/lint.mjs` lists them with why). The shared blocks are in `web/src/parts`: `Card` and `CardHead` (a card and its heading row), `Rows` and `Row` (a list with a dot, a title, a line under it, what goes at the end, and when), `Segmented` (one choice of a few), `Empty` (what a list says with nothing in it), and `Sheet` (a panel over the screen for one task, as the command and log sheets are: the focus goes into it and back after, and Escape closes it through its own Close or Cancel); a screen uses them rather than writing their markup, and `make frontend-check` fails on a card heading, a card, a list of rows, a segmented control, an empty state, or a sheet written outside `web/src/parts`. `make screenshots` refreshes the pictures and fails if an element the page hid is displayed.
- Anything that changes state previews first and acts only with `--apply` or a yes in a terminal.
- Never print, log, or pass secrets on a command line. Read them from `.env` when needed.
- A feature added or changed on any device changes its row in [docs/Parity.md](docs/Parity.md), the map of what each device can do; a new phone call is named there (`TestParityNamesEveryPhoneCall` fails until it is).
- New behaviour gets a test. Network APIs are tested against `httptest` fakes; Docker against the fake CLI in `cmd/homelab/main_test.go`.
- A change someone running the homelab would notice gets a line in `CHANGELOG.md` under Unreleased, in **New**, **Improved**, or **Fixed**. These are patch notes, read in the app before an update and on the release page: one line in plain words about what changed for you ("Opening a category on Status is instant"), not how. The pull request holds the detail.

## Releases

1. Move the Unreleased entries under a new version heading in `CHANGELOG.md`, with a bold one-line summary of the version under it, and add its compare link at the bottom.
2. Set the version in `VERSION` and in the `version:` front matter of every note (`./homelab validate` checks they match).
3. `make check`, commit, and tag `v<version>`.
