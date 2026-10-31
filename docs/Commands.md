---
version: 0.16.0
---

# Commands

Everything runs from a terminal in the homelab folder: `./homelab` on macOS and Linux, `homelab.cmd` on Windows. It builds itself the first time when Go is installed (`brew install go` on the Mac, `winget install GoLang.Go` on Windows); without Go it runs the copy the desktop app carries, so the app's buttons and the terminal both work without it. `./homelab help` prints the full list.

## The main loop

```bash
./homelab               # an interactive menu (in a terminal)
./homelab status        # what runs, its health, and its addresses (--all: the helpers too)
./homelab status --timing   # how long each part of Status takes on this machine
./homelab doctor        # anything wrong with this machine, the runtime, disk space, drive health, or .env
./homelab runtime install --apply   # Linux and SteamOS: Docker in your home folder, run as you, kept across system updates
./homelab kit           # a folder the app made: which build of the homelab files it is
./homelab kit update homelab-kit.tar.gz   # bring such a folder up to a newer kit (never .env, data, or your own apps)
./homelab fix           # repair what usually goes wrong (the plan first): runtime, apps down or unwell, settings not yet applied, CrowdSec's bouncer, a full disk, jobs
./homelab migrate       # move apps from homelab_core into their category's project (backup first)
./homelab report        # a file to share when asking for help: secrets, tokens, your account name, and email addresses removed (--stdout: print it)
./homelab upgrade       # the newest homelab files from GitHub (fast-forward only), then up (the app's Update now)
./homelab homepage      # Homepage's list of apps, from what runs (also after each install)
./homelab version       # this CLI's version
```

## Picking apps

Every command that takes apps (`install`, `plan`, `start`, `stop`, `restart`, `update`, `remove`) takes any mix of these:

| Write | Selects |
|---|---|
| `sonarr radarr` | Apps by name (`./homelab apps` lists them) |
| `overseerr`, `money` | An alias (Seerr, MoneyMatter) |
| `'*-arr'`, `'son*'` | The whole *arr set (the bundle's alias), or a pattern over app names; quote it so the shell leaves the `*` alone |
| `@arr`, `arr`, `@household`, `@adblock` | A bundle (`./homelab bundles` lists them; the `@` is optional, as PowerShell needs) |
| `stack:immich` | Everything in one stack folder |
| `cat:media` | A whole category (`cat:network`, `cat:household`, …) |
| `--exclude x` | Leave an app out of the rest |

## Start, add, remove

```bash
./homelab up                     # start the baseline (preview, then confirm)
./homelab install sonarr radarr  # slot in optional apps
./homelab install '*-arr'        # the whole *arr set
./homelab plan qbittorrent       # what an install would do, nothing changed
./homelab stop|start|restart <app>
./homelab update <app>           # dump its databases, pull or rebuild, then recreate
./homelab update --all           # every app the nightly update would, now
./homelab db upgrade paperless-db  # a database to its next PostgreSQL major version (--to N), back by itself on failure
./homelab upgrade --back         # the homelab files as they were before the last upgrade, then up
./homelab rollback <app>         # back to the image before its last update (kept a week), with its data from just before; holds its updates
./homelab rollback <app> --image-only  # the earlier image on today's data
./homelab rollback <app> --data  # after a rollback that kept today's data: put back the copy from before the update
./homelab remove <app>           # remove the container; data stays
./homelab logs <app> -f
./homelab logs <app> --explain   # what its log says, from the Ollama on this machine
./homelab apps                   # the catalog (--category ID)
./homelab bundles                # the bundles, such as @arr and @adblock (the @ is optional: install adblock, as PowerShell needs)
./homelab detect                 # containers already running on this machine
./homelab adopt vaultwarden      # move an app from an older setup into the homelab
```

```bash
./homelab cleanup                # remove old containers whose apps now run in the homelab
./homelab cleanup --volumes      # ...and their volumes, when nothing else uses them
./homelab signups open           # Vaultwarden sign-ups for 10 minutes (--for 30m), then closed
./homelab signups close
./homelab updates                # whether the nightly updates run, and when
./homelab updates pause          # stop them until resumed (kept across up)
./homelab updates resume
./homelab updates hold <app>     # leave one app out of nightly updates
./homelab updates release <app>  # put it back (after a rollback too)
./homelab updates notes <app>    # what updating it brings: its newer releases' notes
./homelab wire                   # connect running apps: Prowlarr, FlareSolverr, qBittorrent, root folders, Bazarr, Seerr
./homelab move out --to /Volumes/Drive/homelab.tar   # moving machines: back up, stop, pack it into one file
./homelab move in /Volumes/Drive/homelab.tar         # on the new machine: unpack, load the databases, start what ran
./homelab rebuild ~/ProtonDrive/Homelab\ Backups      # the machine is lost: restore .env and the data from Duplicati's backups, start what ran
                                                     #   (--force: into a folder that already has apps' data)
./homelab uninstall              # take the homelab off this machine; the folder, data, and backups stay
./homelab uninstall --data       # ...and delete the apps' data too (never the backups or the media drive)
```

```bash
./homelab custom add wiki --image ghcr.io/requarks/wiki:2 --port 3000 --volume /wiki/data
./homelab custom                 # your own apps
./homelab custom remove wiki     # take one out; its data stays
```

`custom add` writes the app into `stacks/custom/compose.yaml` (optional, on the shared network, on a free port, its folders under `data/appdata/<id>`) and validates the catalog, putting everything back on any problem. The custom stack is yours alone, like `.env`: git ignores it and the generated docs leave it out, so `git pull` keeps working. `--install` starts it straight away; `--env KEY=value` passes settings.

`adopt` is for apps that `status` lists as **elsewhere**. It stops the old container (and, by name, its helpers such as `moneymatter-db`), copies each folder or volume the old container used to where the homelab keeps it (matched by the path inside the container; shared folders like the media drive stay put), carries the generated secrets the copied data depends on (a database password) into `.env` without printing them, and starts the app. It refuses to overwrite a folder that has files or a volume that exists, and to copy PostgreSQL data across major versions. The old container is only stopped; the last line says how to go back.

## Compose, without changing folders

```bash
./homelab compose immich ps
./homelab compose paperless exec paperless document_exporter ../export
./homelab compose media down      # a whole category's project (homelab_media)
```

The first argument is an app, a category (`network`, `media`, `media-automation`, …), or a stack folder (`immich`, `paperless`, `budget-tracker`, `cloudflare`).

## Domain

```bash
./homelab domain setup --dry-run   # preview
./homelab domain setup             # proxy hosts, AdGuard rewrite, tunnel hostnames
./homelab domain setup --ssl       # also the wildcard certificate (first time)
./homelab domain status
./homelab domain resolver          # this machine finds every app by name, also with a VPN on (asks for the administrator's password once)
./homelab domain resolver --undo   # takes that back, and homelab's lines in the hosts file
```

`domain resolver` writes `/etc/resolver/<domain>` on macOS, a systemd-resolved drop-in (`/etc/systemd/resolved.conf.d/homelab-<domain>.conf`) on Linux, or a Name Resolution Policy Table rule on Windows, pointing at AdGuard Home on this machine's home-network address (`--ip` to name it). Outside a terminal it previews; `--apply` writes it. `--undo` removes it again (only what homelab wrote: a file it did not write, or a rule without its `homelab` comment, stays), and homelab's lines in the hosts file from `domain setup --dns hosts`; name the domain (`--undo old.example.org`) to take back one the homelab had before. `uninstall` leaves them, and says so.

Home mode (no domain), every app on the tailnet:

```bash
./homelab tailnet login            # sign Tailscale in through its page in the browser; no auth key needed
./homelab tailnet setup            # https://<TAILSCALE_HOST>:<port> for the running apps (signs in first when needed)
```

With `TAILNET_ADMIN_APPS=false`, the admin apps (the proxy, AdGuard Home, Duplicati, Dozzle) stay off the tailnet and open on this machine only.

Ad blocking (AdGuard Home), in either mode:

```bash
./homelab install @adblock         # AdGuard Home, and DNS on the tailnet address
./homelab adguard setup            # first-run wizard with a generated login; the tailnet DNS setting
```

The household (Pocket ID accounts):

```bash
./homelab person add "Anna Smith" --email anna@example.com   # account, first sign-in link, welcome page
./homelab person                   # who is in the household
./homelab person welcome anna      # a new sign-in link and welcome page
./homelab person password anna     # a new password in Jellyfin and Navidrome, on a fresh welcome page
./homelab person apps anna immich-server paperless mealie   # only these on their page and Homepage tab (--all: every app)
./homelab person remove anna       # sign-in off; their data stays in every app
```

Single sign-on with Pocket ID (needs a domain):

```bash
./homelab sso                      # which apps sign in with Pocket ID
./homelab sso setup                # connect the rest: their clients in Pocket ID, their settings
```

## Phones

```bash
./homelab phone pair --name "My iPhone"   # a one-time code and the links to open on the phone (--can-change: it may make changes;
                                          #   --finances view|edit: it sees Finances, or changes them too)
./homelab phone list                      # paired phones, what they may do, when last seen
./homelab phone allow <id>                # may start, stop, restart, and back up
./homelab phone read-only <id>
./homelab phone finances <id> view        # it sees Finances (edit: it may change them too; off: hidden again)
./homelab phone remove <id>               # its token stops working
./homelab serve                           # the companion itself (the serve job runs it)
```

Finances go only to a phone paired with the https link (Tailscale, or `https://homelab.example.com` with a domain), never to one paired over plain home Wi-Fi, nor to a TV or wall screen in kiosk mode, whatever is picked for it.

## Jobs

```bash
./homelab backup                   # preview; --apply to run
./homelab watchdog                 # the checks the watchdog job runs every 15 minutes
./homelab agent                    # the background agent itself, which runs the parts below (schedule install sets it up)
./homelab awake                    # hold off sleep while plugged in (the awake job runs it)
./homelab awake allow              # Linux: let the awake job hold off sleep (once, with the administrator's password); --undo takes it back
./homelab notify setup             # write grants for the alert topics
./homelab notify test duplicati-alerts
./homelab notify off vikunja        # checked, but no alerts about it (on: alerts again)
./homelab digest                   # the weekly summary; --send sends it now
./homelab schedule install         # the startup, backup, watchdog, awake, and serve jobs
./homelab schedule status
./homelab schedule remove          # take the jobs out again
./homelab quit                     # stop the homelab until the next login: the agent (still installed), the tray item, every app
./homelab resume                   # start what quit stopped; opening the app or the next login does it too
./homelab duplicati destination    # BACKUP_DESTINATION: "Homelab Backups" in Proton Drive, or a folder you name
./homelab duplicati setup          # create the Duplicati backup jobs (preview, then confirm)
./homelab duplicati jobs           # each job's last and next run
./homelab kopia repository <folder>  # KOPIA_REPOSITORY: Kopia's second copy, never in Duplicati's folder; Kopia starts again there
./homelab restore-test --auto      # Duplicati restores a sample; checked against the live files
./homelab restore-test --auto --engine kopia   # the same from Kopia's newest snapshot, when it is installed
./homelab restore-test recovery-staging/restore-test data/appdata
./homelab recovery-kit             # recovery-kit.html to print: where the backups and passphrases are, how to restore
./homelab export                   # every app's data in open formats in export-<date>: tables as CSV, documents, albums
./homelab export --photos --to /Volumes/Drive/Export   # ...with the original photos, onto a drive with room
```

## Docs and checks

```bash
./homelab docs        # refresh the generated tables in docs/ and services/
./homelab docs --check   # fail if a generated table is out of date
./homelab validate    # compose metadata and docs (links, versions, lines left from a merge); CI runs this
make check            # gofmt, vet, tests, validate
```

## Global flags

| Flag | Does |
|---|---|
| `--apply` (or `-y`) | Go ahead without asking; needed outside a terminal (scheduled jobs, scripts) |
| `--json` | One JSON object per line (below) |
| `--root DIR` | The homelab folder, when not run from it (`HOMELAB_ROOT` does the same) |
| `--no-color` | Plain output |
| `--set KEY=value`, `--set-stdin` | For `install`, `plan`, and `up`: write a setting to `.env` first, never echoed |

## Driving the CLI from an app

The desktop app (and scripts) use `--json`: every line of output is one object, `{"schema": 1, "type": ..., "data": ...}`. `schema` changes only when a field a client may read is removed or changes meaning; new fields can appear at any time, so ignore the ones you do not know. The fields are the JSON types in `internal/api` (plus `setup.Step` and `install.Event`), and `internal/api/testdata/contract.json` is the list a test holds them to.

| Command | Lines |
| --- | --- |
| `homelab --json apps` | `catalog`: categories, apps (kind, dependencies, the `.env` inputs each needs), and presets (bundles like `@arr`, whole stacks like `stack:immich`) |
| `homelab --json plan <apps>` | `plan`: what would start, what was added as a dependency, skips, port and `.env` changes, problems |
| `homelab --json install <apps> --apply` | `plan`, then a `progress` pair (start, done) per step, then `done` with each started app's address; without `--apply`, `plan` then `preview` |
| `homelab --json status` | `status`: state, health, and address of every app |
| `homelab --json updates [pause\|resume] --apply` | `updates`: whether nightly updates are paused, and their schedule |
| `homelab --json setup` | `setup`: each first-time step with its state, detail, and the settings it needs |
| `homelab --json upgrade` | `upgrade`: the check only: changes waiting on GitHub, and whether the app or the settings changed |
| `homelab --json digest` | `digest`: the weekly summary's title, body, and what needs a look (`problems`) |
| `homelab --json duplicati jobs` | `jobs`: each backup job's last and next run |
| `homelab --json wire --apply` | `wiring` (the planned links), then a `link` line as each connection is made: `done`, `already`, `manual` (with what to do), or `failed` |

Longer jobs (`update`, `start`, `stop`, `restart`, `remove` across several projects, `fix`, `backup`, and `restore-test --auto`) report their steps as `step` lines, `{"n": 2, "total": 5, "text": "Updating vikunja"}`; in a terminal they read `[2/5] Updating vikunja`, and `HOMELAB_PROGRESS=json` writes them as JSON lines without the rest of `--json` (the desktop app sets it to show a progress bar). Any failure ends with an `error` line and exit code 1; a command that only previewed (no `--apply`) ends with a `preview` line. Form values go in with `--set KEY=value`, or `--set-stdin` (`KEY=value` lines) to keep secrets out of the process list; plans mark them secret and never print them. Go code can call the same engine directly: `internal/api` holds the JSON types and `install.ApplyWithProgress` reports the steps.

## First-time setup

```bash
./homelab setup                  # the bring-up as a checklist, each step checked live
```

`./homelab doctor` also checks the network: the home-network address (a VPN's tunnel or a container bridge is never taken for it), whether a VPN carries all traffic (other devices may then not reach the homelab), whether this machine uses the home DNS, how much of the runtime's memory the containers use, the free space on each disk the homelab writes to (with what the runtime keeps in images, volumes, and build cache), and, with `smartctl` installed, each drive's own health report. With CrowdSec and the proxy running, it also says when the proxy's bouncer last pulled CrowdSec's decisions (bans are only enforced while it does).

Each step says what is missing, which `.env` settings it needs, and the command that does it. The app's Setup screen shows the same checklist with buttons, and its Settings screen edits `.env`.

## Rules of thumb

- Without `--apply`, a command only previews. In a terminal it asks first.
- If an output looks wrong, stop and read it before applying anything.
- Never `docker volume prune` or `docker system prune --volumes`: databases live in volumes.
