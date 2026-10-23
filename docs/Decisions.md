---
version: 0.1.0-alpha
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
| ADR-0013 | The app updates itself from a rolling latest build | Accepted |
| ADR-0014 | One engine, followed live through a local socket | Accepted |
| ADR-0015 | A typed Preact frontend, compiled and committed | Accepted |
| ADR-0016 | The watchdog heals once, then leaves it to a person | Accepted |
| ADR-0017 | CPU weights for background work, not throttling | Accepted |
| ADR-0018 | Not now: Docker Go SDK, tsnet, several machines | Accepted |

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

## ADR-0013: The app updates itself from a rolling latest build

**Context:** Downloading a build, dragging it to Applications, and clearing the download flag is too much to ask for every change.
**Decision:** Every push to main that touches the app or the engine publishes the Mac build as the `nightly` pre-release. Builds carry their commit and repository (`-X main.commit`, `-X main.repo`); `internal/selfupdate` compares them with the newest build (Nightly, or the newest `v*` release on the stable channel), checks the download against GitHub's SHA-256 digest, replaces the app, and reopens it. See [Releasing](<Releasing.md#nightly>).
**Trade-offs:** Until the builds are signed, the update trusts GitHub's release and digest; Windows and Linux still update by hand.

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
