---
version: 0.9.0-beta
---

# Decisions

Architecture decisions and why they were made.

| ADR | Title | Status |
|---|---|---|
| ADR-0001 | A Mac as the only host | Accepted |
| ADR-0002 | OrbStack as the container runtime | Accepted |
| ADR-0003 | Cloudflare Tunnel for public access, through the proxy | Accepted |
| ADR-0004 | Custom Nginx Proxy Manager image with the CrowdSec bouncer | Accepted |
| ADR-0005 | No Cloudflare Access or WARP | Accepted |
| ADR-0006 | Watchtower opt-in by label | Accepted |
| ADR-0007 | Database dumps scheduled by launchd, not Duplicati scripts | Accepted |
| ADR-0008 | compose files are the catalog; one CLI in Go | Accepted |
| ADR-0009 | One shared Docker network; apps reached by name | Accepted |
| ADR-0010 | Native Jellyfin | Accepted |
| ADR-0011 | One .env for every project | Accepted |
| ADR-0012 | Home mode (no domain) is the default | Accepted |
| ADR-0013 | The app updates itself from a numbered build of main | Accepted |
| ADR-0014 | One engine, followed live through a local socket | Accepted |
| ADR-0015 | A typed Preact frontend, compiled and committed | Accepted |
| ADR-0016 | The watchdog heals once, then leaves it to a person | Accepted |
| ADR-0017 | CPU weights for background work, not throttling | Accepted |
| ADR-0018 | Not now: Docker Go SDK, tsnet, several machines | Accepted |
| ADR-0019 | Kopia as an optional second backup engine beside Duplicati | Proposed |
| ADR-0020 | A rollback puts back the app's data with its image | Proposed |

---

## ADR-0001: A Mac as the only host

**Context:** The homelab needs one always-on machine at home.
**Decision:** Run everything on one Mac with Apple Silicon (a Mac mini, or a MacBook kept plugged in), kept awake by the homelab's awake job.
**Trade-offs:** One machine is a single point of failure, and with FileVault nothing starts after a reboot until someone logs in. Apple Silicon is quiet and efficient, and native Jellyfin can use its media engine.

## ADR-0002: OrbStack as the container runtime

**Context:** Docker on macOS always runs in a Linux VM.
**Decision:** OrbStack, with Start at login enabled.
**Rationale:** Lighter and faster than Docker Desktop, fast bind mounts, Rosetta for the few Intel-only images. The CLI uses the plain `docker` CLI, so Docker Desktop still works.

## ADR-0003: Cloudflare Tunnel for public access, through the proxy

**Context:** Family members use some apps from outside the home without extra software. The router must not open ports.
**Decision:** One remotely managed tunnel. Each public hostname points at `http://nginx-proxy-manager:80`, not at the app.
**Rationale:** No inbound ports. Routing through the proxy means CrowdSec reads and blocks tunnel traffic exactly like LAN traffic, which removes the need for a separate edge bouncer and its Workers KV limits. The visitor's real address arrives in `CF-Connecting-IP`; proxy hosts trust `X-Forwarded-Proto`, so there is no redirect loop.
**Trade-offs:** The proxy becomes a dependency of public access. The watchdog checks it every 15 minutes.

## ADR-0004: Custom Nginx Proxy Manager image with the CrowdSec bouncer

**Context:** CrowdSec detects attacks but needs an enforcement point.
**Decision:** Build `dockerfiles/npm-crowdsec` from `jc21/nginx-proxy-manager` plus CrowdSec's Lua bouncer (`lua-cs-bouncer`) and `lua-resty-http`, following CrowdSec's own OpenResty reference build. The bouncer configuration comes from environment variables at start.
**Consequences:** Never update it by pulling the upstream image (that silently drops the bouncer). Excluded from Watchtower; `./homelab update nginx-proxy-manager` rebuilds it. With no bouncer key the bouncer turns itself off instead of stopping the proxy.

## ADR-0005: No Cloudflare Access or WARP

**Context:** Cloudflare Access could gate the public apps behind a login.
**Decision:** Do not use Access or WARP.
**Rationale:** The public apps are used through native apps (Bitwarden, Immich, Subsonic players, Audiobookshelf) that talk to APIs and cannot complete an Access login. WARP would mean installing software on every family device.
**Mitigation:** Strong unique passwords, 2FA where offered, CrowdSec, Cloudflare's managed rules.

## ADR-0006: Watchtower opt-in by label

**Decision:** `WATCHTOWER_LABEL_ENABLE=true`; every service states `com.centurylinklabs.watchtower.enable` explicitly.
**Rationale:** Updates happen where they are safe. The proxy (built locally), databases (major versions are pinned), and MoneyMatter (pinned build) are excluded and updated deliberately. The maintained `nickfedor/watchtower` fork is used because it negotiates the Docker API version.

## ADR-0007: Database dumps scheduled by launchd

**Context:** Duplicati runs in a container and cannot run host commands before a job.
**Decision:** `./homelab backup` dumps every database at 03:30 into `recovery-staging`, and the Duplicati jobs run afterwards.
**Rationale:** LaunchAgents run as the user, in the session where OrbStack lives, and the same command works by hand. The Linux and Windows profiles do the same with systemd user units and Task Scheduler.

## ADR-0008: compose files are the catalog; one CLI in Go

**Context:** Describing apps in several places (scripts, JSON, docs) let them drift apart.
**Decision:** Every app is a service with an `x-homelab` block in `compose/<category>.yaml` (included by `compose.yaml`) or `stacks/*/compose.yaml`. One Go binary (`./homelab`) installs, proxies, publishes, backs up, monitors, and documents from that metadata. Facts in the notes are generated from it.
**Rationale:** A single source cannot drift. Go builds a single small binary with no runtime to install, starts instantly, and has testing built in.

## ADR-0009: One shared Docker network

**Decision:** Every project joins the external `homelab` network. Web services are reached by service name; databases stay on their stack's private network.
**Rationale:** No hairpin through `host.docker.internal`, no published ports needed for the proxy or the tunnel, and a database can never be reached from another stack. Service names must therefore be unique across stacks; `homelab validate` enforces it.

## ADR-0010: Native Jellyfin

**Decision:** Jellyfin runs as the macOS app, not a container.
**Rationale:** Containers on macOS have no access to Apple's hardware video encoder; the native app does. The CLI still proxies it (`host.docker.internal:8096`), and Duplicati backs up its data folder.

## ADR-0011: One .env for every project

**Decision:** All projects read `~/Homelab/.env` (the CLI passes `--env-file`).
**Rationale:** One file to protect (mode 0600), one file in the Secrets backup job, and secrets generated in one place. `COMPOSE_PROJECT_NAME` must never be set in it, or it would override each stack's project name.

## ADR-0012: Home mode (no domain) is the default

**Context:** A domain means a Cloudflare account, an API token, AdGuard on every device, and a certificate: the steps where a new household got stuck.
**Decision:** `HOMELAB_DOMAIN` is empty in `.env.example`, so every new homelab, git clones included, starts in Home mode: Tailscale Serve gives each app `https://homelab.<tailnet>.ts.net:<port>`, and `homelab tailnet setup` reruns after every install. An existing `.env` keeps its domain; setting one later switches to the proxy, AdGuard, and the tunnel.
**Trade-offs:** Each device needs Tailscale, nothing is published to the internet, and single sign-on with Pocket ID needs a domain.

## ADR-0013: The app updates itself from a numbered build of main

**Context:** Downloading a build, dragging it to Applications, and clearing the download flag is too much to ask for every change.
**Decision:** Every push to main that touches the app or the engine publishes the builds as a numbered release, the repository's Latest: `VERSION` with the patch raised by the commits since `VERSION` changed (`v0.9.4-beta`), so each build has a version people can read without a commit to bump it. Builds carry their version, commit, and repository (`-X main.version`, `main.commit`, `main.repo`); `internal/selfupdate` compares the commit with the newest build (the Latest release, or the newest `vX.Y.0` on the stable channel), checks the download against GitHub's SHA-256 digest, replaces the app, and reopens it. See [Releasing](<Releasing.md#the-latest-build>).
**Trade-offs:** Until the builds are signed, the update trusts GitHub's release and digest. A release for every build fills the releases page; the stable channel takes only `vX.Y.0`.

## ADR-0014: One engine, followed live through a local socket

**Context:** The app, the menu bar item, and the phone each polled the container runtime every 10 to 60 seconds, so a stopped app showed late and each asked the runtime on its own.
**Decision:** The engine follows `docker events` (`internal/engine`), gathering a burst into one change. The agent serves it on a socket only your account can open (`/v1/status`, `/v1/events` as Server-Sent Events); the app and the menu bar item follow it, and `homelab serve` passes the changes on to paired phones. Without the agent, each follows the runtime itself.
**Trade-offs:** One more long-running process to keep healthy; a client falls back to its own follower, so nothing depends on it.

## ADR-0015: A typed Preact frontend, compiled and committed

**Context:** The frontend was one 2,000-line script building the page by hand: no types against the Go side, and every live change rebuilt whole screens (losing focus and typed values).
**Decision:** TypeScript checked against types generated from the methods the app binds, and Preact components per screen, compiled by esbuild into `web/dist/app.js`. The built file is committed, so `go build` needs no Node; CI fails while it is out of date. Preact rather than React or a framework with its own build: 10 KB, the same model, and no runtime beyond the bundle.
**Trade-offs:** A contributor changing the frontend needs Node for `make frontend`; Go-only work does not.

## ADR-0016: The watchdog heals once, then leaves it to a person

**Context:** Docker restarts a container that stops, not one that hangs (running, but unhealthy or not answering), and those stayed down until someone clicked **Fix it**.
**Decision:** The watchdog restarts an app whose check failed on two runs in a row, at most once in 6 hours (`AUTO_HEAL`), and says so. An app updated in the last 6 hours is left to the rollback, which now also counts a page that stopped answering; a crash loop is left to Docker. Settings that changed under a running container are shown, not applied by themselves: recreating is the user's call (**Fix it**).
**Trade-offs:** A restart can hide a slow leak until the next one; the alert on every restart keeps it visible.

## ADR-0017: CPU weights for background work, not throttling

**Context:** Backups, photo indexing, and downloads could slow the apps people were using.
**Decision:** Background services and the backup's own containers run with `cpu_shares: 256` (a quarter of Docker's default). Weights only count while the CPU is busy, so idle machines still give background work all of it.
**Trade-offs:** Only between containers: native apps such as Jellyfin are outside it. Watching load and changing limits on the fly was left out as more moving parts for the same result.

## ADR-0018: Not now: Docker Go SDK, tsnet, several machines

**Decision:** Left out of the 0.17 work: the Docker Go SDK in place of the `docker` CLI (its JSON is already typed, and the CLI resolves each system's socket, context, and Windows pipe, which could not be tested here); Tailscale built into the binary with tsnet (Tailscale Serve already gives every app its address); several machines as one, and moving apps between them by power (a different product, for a household with one computer); GitOps (a homelab folder that is a git checkout already updates with `homelab upgrade`).
**Revisit when:** the CLI's output stops being enough, or a household runs the homelab on more than one machine.

## ADR-0019: Kopia as an optional second backup engine beside Duplicati

**Status:** Proposed, waiting for the owner's decision (Roadmap 0.13). Nothing is built until it is accepted.

**Context:** Duplicati is the only engine. One engine is one way to fail: its local database can need a repair before a restore, a restore of a large job is slow, and a bug or a corrupted destination loses every copy at once. The 3-2-1 rule (three copies, two kinds of storage, one off-site) is easier to meet with a second, independent copy.

**Proposal:**

- **What it backs up:** the same read-only sources as Duplicati (`/source/appdata`, `/source/homelab-appdata`, `/source/stacks`, `/source/immich`, `/source/jellyfin`, `/source/calibre`) and `recovery-staging` (the dumps and the secrets copy), as Kopia snapshots, one per source, so a restore can pick one app's folder.
- **Where:** its own destination, never Duplicati's folder: `KOPIA_REPOSITORY`, a folder (a second drive, or a cloud drive's folder) or an S3-compatible bucket (Backblaze B2, Wasabi). The repository is encrypted with `KOPIA_PASSWORD`, kept with the recovery kit like `DUPLICATI_SECRETS_PASSPHRASE`.
- **How it runs:** `kopia/kopia` (Docker Hub) as an optional app in `compose/system.yaml`, in server mode with its web page (admin only), on the same read-only mounts as Duplicati. Its own schedule runs after the nightly dumps (03:30), with `cpu_shares` like the other background work. Failures go to ntfy's `duplicati-alerts` topic through Kopia's webhook notifications, so one topic covers backups.
- **Restore test:** `homelab restore-test --auto` gains `--engine kopia`. It picks the same sample of unchanged files from `/source/appdata`, restores them from the newest snapshot with `kopia restore` into `recovery-staging/restore-test`, and hashes them against the live files, exactly as for Duplicati. `restore-test.json` records the engine with each drill, and the 30-day reminder counts each engine. The nightly real-Docker run tests both.
- **The Backups screen:** the off-site tile lists each engine with its last run and its last passed restore test; **Test a restore** asks which engine when both are set up. With Kopia not installed, nothing changes.
- **How someone chooses:** Duplicati stays the default, set up by Setup. Kopia is in Choose stacks › System as optional, described as "a second, independent copy somewhere else". Setup's backup step gains a line once it is installed: where its repository is, and whether its first snapshot and restore test passed.

**Trade-offs:** two engines are two passwords, two destinations, and two schedules to explain; the disk is read twice each night; Kopia's web page is plainer than Duplicati's.

**Alternatives:**

- A second Duplicati job to another destination: no new engine, but the same software, so not independent of Duplicati's bugs or its database.
- Restic with Backrest's web page instead of Kopia: similar design (content-addressed, encrypted, deduplicated); Kopia has its own web page and server mode in one image, Backrest is a separate project wrapping restic.
- Kopia instead of Duplicati: fewer moving parts in the end, but it replaces a working, tested engine and every household's existing backups.

**Questions for the owner:**

1. Beside Duplicati (this proposal), or replacing it later?
2. Kopia, or restic with Backrest?
3. Should Setup offer a destination for it (a second drive, or B2 with its price), or leave that to its note?
4. Is a restore test of both engines in every nightly run worth its time (a few minutes)?

## ADR-0020: A rollback puts back the app's data with its image

**Status:** Proposed, waiting for the owner's decision ([ISSUE-0022](<Known Issues.md#issue-0022-a-rollback-brings-back-the-image-not-the-data-the-newer-version-changed>)).

**Context:** A rollback starts the earlier image on today's data. An app whose newer version migrated its data (ntfy 2.11 after 2.34: "version 17 is higher than current version 13") then refuses to start. `homelab update` dumps databases first, but Watchtower's nightly updates are not preceded by anything, the rollback restores nothing, and files outside a dump (ntfy's message cache, SQLite apps' side files, settings folders) are not kept at all.

**Proposal:**

- **A copy before every update.** Watchtower stops updating by itself: the nightly updates are run by the agent as `homelab update --all --nightly` at the same hour, using Watchtower only to pull and recreate (its `--run-once` mode, for the apps that have a newer image). Before each app is updated, the homelab:
  1. dumps its databases, as `homelab update` does today;
  2. stops it and copies its own data: the bind-mounted folders inside the homelab folder and its named volumes (tarred, as `archive:` does), into `recovery-staging/before-update/<app>/<time>/`;
  3. starts the update.
- **What is left out:** folders outside the homelab folder (`MEDIA_ROOT`, `IMMICH_UPLOAD_LOCATION`, Jellyfin's data), and any folder over a size limit (`UPDATE_COPY_LIMIT`, 2 GB by default). Those apps' schemas live in their databases, which the dump covers. The update says which folders it did not copy.
- **The rollback** (by hand, or the watchdog's after a failed update) stops the app; moves today's data aside to `recovery-staging/rolled-back/<app>/<time>/` (never deleted by the rollback); puts the copy back; restores the dump into its database (PostgreSQL through `pgexec`, SQLite as a file); then starts the earlier image. It says what was put back and that changes made since the update are in the rolled-back folder.
- **Keeping copies:** the newest copy per app, until the rollback window closes (a week, as for the earlier image); the backup's clean-up removes older ones.

**Trade-offs:** each update stops the app for the copy (seconds for most, a minute for a large settings folder); disk for one copy per updated app; and anything written between the update and the rollback is set aside, not merged.

**Alternatives:**

- Keep Watchtower as it is and copy every app's data in the nightly backup before 4 AM: no change to how updates run, but a copy of every app every night, and up to a few hours of changes lost on rollback.
- Restore only the dumps (no folder copies): smaller, but leaves ntfy's case, and every SQLite app's side files, unsolved.
- Offer "restore the dump from before the update" as a separate step after a rollback: least work, but a person must know to do it, and the watchdog's automatic rollback still loops.

**Questions for the owner:**

1. Move the nightly updates from Watchtower's own schedule to the agent (this proposal), or copy every app nightly before 4 AM instead?
2. Is 2 GB the right limit for a copied folder?
3. Should the watchdog's automatic rollback also put the data back, or only a rollback someone asks for?

