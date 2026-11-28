# Hygiene handoff: progress

Tracks the master hygiene handoff (Stages 1 to 4) so it can be resumed in a new session. Updated after every pull request and every stage. Runs alongside Account 1's Core Reliability Reset (`.claude/prompts/reset-progress.md`, on its open pull request) and never touches its files.

## Paused Work Bookmark

- **Active task when the handoff arrived:** none. This session started fresh with the handoff as its first message (Nov 27, 2026): no task in progress, no open pull request, no branch of its own besides `claude/master-handoff-hygiene-7on3sb` (at `origin/main`, `e04638b`).
- **Lane and backlog:** none assigned to this session. Account 1's open PR #961 pauses lanes R, M, W, Q and S (`*-loop.md` set to **Paused: yes**) and makes `reset-progress.md` the only backlog. Nothing here resumes until the owner approves.
- **Other unmerged remote branches seen** (not this session's; not touched): `claude/busy-mendel-whfrtc`, `claude/data-appdata-move`, `claude/data-phone-tidy`, `claude/ipad-status`, `claude/iphone-backups-in-status`, `claude/iphone-few-words`, `iphone-screenshots`. `claude/homelab-reliability-reset-nnq2ve` is Account 1's active branch: never touch.

## Stage status

| Stage | State |
|---|---|
| 1: finish active task, bookmark | Done (nothing was active) |
| 2A: disable future attribution, scrub allowed files | Merged: #962 |
| Owner's ask, Nov 27: bring the repo's picture of the app up to date | Merged in #962: `docs/Where Things Stand.md` (new), README's Beta note, both docs indexes. Version stamps: by design (they track `VERSION`), no change |
| Owner's ask, Nov 27: the Roadmap matches the releases | Merged: #964 (both roadmaps), table kept current in #970 |
| Owner's ask, Nov 27: the CHANGELOG split, now | Merged: #970 (`release.yml`'s notes list only entries the release before didn't have; first run, v0.47.5, listed exactly its one new line) and #974 (`CHANGELOG.md` only: 30 sections, 0.17.1 to 0.46). Next: 0.47's section once v0.47.10 is built, `CHANGELOG.md` only (fast CI) |
| 2B onward, 3, 4 | Waiting: the handoff's text stopped partway through Phase 2A; the rest is needed before starting |

## Pull requests

### PR 1: attribution off for future sessions (Phase 2A)

- **Files:** `.claude/settings.json` (new: `attribution.commit` and `attribution.pr` empty, `sessionUrl` false; no `includeCoAuthoredBy` key existed), `.claude/prompts/hygiene-progress.md` (new).
- **Scrub survey** (searched for co-author lines, claude.ai links, "Claude Code", "Anthropic", "generated with", "AI-assisted"):
  - Public docs (`README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/`): no claim the code is AI-written. Nothing to remove.
  - **Kept, product functionality:** Finances' payee cleanup of the card merchant *ANTHROPIC CLAUDE* (`web/src/finances/payees.ts`, `Mark.tsx`, `apple-client/...PayeeVectors.json`, `PayeeLogoTests.swift`, `make-payee-logos.mjs`, `app/preview/shoot.mjs`, a `CHANGELOG.md` line). The Ollama log explanations: untouched.
  - **Candidates, not changed:** claude.ai canvas links and "Claude Code" mentions in history prompt files (`handoff.md`, `apple-loop.md`); `docs/Usability.md` line 7 names "Account 3, `.claude/prompts/audit-loop.md`". `owner.md` line 11 is in PR #961 (deferred below).

## Verified on the owner's Mac (their pasted output, Nov 27 and 28)

- **#967, Seerr → Sonarr and Radarr in Connect apps:** both green, "corrected activeProfileId…" (screenshot, Nov 27).
- **#972, qBittorrent 5.2's 204 sign-in:** Connect apps shows 30 connected, nothing failing (screenshot, Nov 28). The cause was read on the Mac first: `HTTP/1.1 204`, cookie `QBT_SID_8082`.
- **The Windows PC reaches every app by name with Proton VPN on:** Proton's custom DNS a public server (94.140.14.14), Allow LAN connections on, and the Cloudflare home record (`*.snooper42.com → 10.0.0.16`, already there). Proton on Windows sends custom DNS through its tunnel, so a LAN address (10.0.0.16) as custom DNS can't work there; on the iPhone it does.

## Found, for Core Reliability

- **A stale Windows name rule breaks the domain on a PC that stopped being the host:** the owner's PC kept an NRPT rule `.snooper42.com → 10.0.0.242` (no Comment) from when it ran the homelab; every lookup under the domain went there and timed out, overriding Proton's DNS and even `Resolve-DnsName -Server`. Removing it fixed the PC. Fix to make: give the rule a Comment (*managed by homelab*), and have uninstall and Set up the domain remove one that points elsewhere. Go code, `cmd/homelab/domain.go`'s resolver, Windows.
- **`passwords.snooper42.com` resolves to Cloudflare** although `domain status` lists Vaultwarden as home only. The owner is checking from a phone off Wi-Fi whether the vault's page loads; if it does, it's reachable from the internet.
- **`app/tray`'s `TestMenu` has a data race** under `-race`, on main too; CI runs without `-race`, so it goes unseen.
- **`cmd/homelab` passes 10 minutes under `-race`** in a cloud container (it passes without in about a minute): `CLAUDE.md` rule 9's `go test -race ./...` needs a longer `-timeout` there.

## Deferred Until Account 1 Finishes

- **The nightly run is red (Nov 27):** `TestAHomelabsLife/data_in_each_app`, `paperless-ai: Paperless-AI's setup: 403 Forbidden ... setup_code_required`. Paperless-AI's newest image asks for a setup code (its log, `data/setup-code`) at first start; `test/realdocker/apps_test.go`'s `seedPaperlessAI` and `services/documents/Paperless-AI.md` don't know it. Both paths are read-only for this handoff; Core Reliability's to fix. Nov 25's red was `TestTheCatalogStarts/immich-server` (install exit 1), not looked into.

Files PR #961 touches (read-only until it merges or closes): `CLAUDE.md`, `.claude/prompts/lanes.md`, `owner.md`, `reset-progress.md`, `redesign-loop.md`, `money-loop.md`, `web-loop.md`, `setup-loop.md`, `quality-loop.md`, `.github/pull_request_template.md`, `docs/Known Issues.md`.

- `owner.md` line 11: "open Claude Code on the web" (an instruction to the owner, not an authorship claim; likely stays).

## Next concrete step

The owner's answer on Vaultwarden (above). Then, on their yes, the Windows name-rule fix. The handoff's text after Phase 2A (2B onward, Stages 3 and 4) was never sent; ask for it before starting them.
