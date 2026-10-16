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
