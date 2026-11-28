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
| 2B: dead weight and docs | Merged, #976: `docs/images/tidy-look/` (61 images, 6.5 MB) removed; no stale CLI command or broken link found |
| 2C: release policy and reset tool | Merged, #976: `docs/Release Process.md`, `scripts/reset-releases.sh`. The CHANGELOG work was already merged (#970, #974) |
| 2D: branches and automation | PR 3: `scripts/repo-hygiene.sh`, `scripts/cleanup-branches.sh`, `.github/workflows/repo-hygiene.yml` (reporting, not blocking), `.github/release.yml`, weekly grouped `dependabot.yml`, `.githooks/commit-msg`. `delete_branch_on_merge` was already on |
| 3 | **WAITING FOR ACCOUNT 1** (below) |
| 4 | At clean baseline after PR 3 (below) |

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

## Deferred Code Fixes

Go code, frozen for this handoff while Account 1 runs (Stage 2's forbidden paths); each needs a regression test when it's done (Stage 3, PR A). In priority order:

1. **CRITICAL, the home-only exposure guard. Vaultwarden and Paperless-ngx were reachable from the internet until Nov 28,** though `domain status` listed them home only: Cloudflare still had their tunnel hostnames (`passwords`, `docs`) from before they were marked home only, and Set up the domain hadn't run since. The owner ran `domain setup --apply` ("took 2 home-only hostname(s) off the internet"); `dig @1.1.1.1` now gives the home record's 10.0.0.16 for both. The gap to fix: nothing notices the drift. `domain status` and `domain setup --dry-run` say *home only, kept off the internet* without asking Cloudflare; `doctor` or the watchdog should compare Cloudflare's tunnel hostnames with the home-only list and alert.
2. **A stale Windows name rule breaks the domain on a PC that stopped being the host:** the owner's PC kept an NRPT rule `.snooper42.com → 10.0.0.242` (no Comment) from when it ran the homelab; every lookup under the domain went there and timed out, overriding Proton's DNS and even `Resolve-DnsName -Server`. Removing it fixed the PC. Fix to make: give the rule a Comment (*managed by homelab*), and have uninstall and Set up the domain remove one that points elsewhere. Go code, `cmd/homelab/domain.go`'s resolver, Windows.
3. **Calibre-Web's "default login still works" was a false alarm, from a missing library setting:** with no Calibre database location set, Calibre-Web sends every page, `/opds` included, to `/login?next=/admin/dbconfig`. `internal/claim`'s check (`/opds` with admin/admin123, following redirects) gets that sign-in page with 200 and calls it the default login working. On the owner's Mac, the fixes were: the admin password set in `app.db` (Calibre-Web's own `cps.py -s` refused a password meeting every rule), then *Location of Calibre database* `/books`. Fix to make: don't follow the redirect, and read a redirect to `/login` as refused, or as *its library isn't set yet*, with that step in the message. Also note that a wrong password makes Calibre-Web answer 429 for a while (already handled).
4. **`app/tray`'s `TestMenu` has a data race** under `-race`, on main too; CI runs without `-race`, so it goes unseen.
5. **`cmd/homelab` passes 10 minutes under `-race`** in a cloud container (it passes without in about a minute): `CLAUDE.md` rule 9's `go test -race ./...` needs a longer `-timeout` there.

## PR 2: dead weight, release policy, reset tool (Phase 2B and 2C)

**Removed, with the proof nothing uses it:** `docs/images/tidy-look/` (61 PNGs, 6.5 MB), the before-and-after pictures of the Tidy Up redesign's rounds (#485, #601, #615, #618, #620, #622). No file in the repository names `tidy-look` (`rg tidy-look --glob '!*.png'`: nothing), no generator writes them (`app/preview/shoot.mjs` writes `docs/images/app-*.png`, `app/preview/redesign/build.mjs` writes `docs/images/redesign/`), and the six pull requests mention the paths as text only, with no image link to them (no `blob/` or `raw/` URL in their descriptions).

**Kept, though a filename search finds no mention:** `docs/images/app-*.png` and `docs/images/redesign/*-full*.png` are what `make screenshots` and `make redesign` write, named in code (`{ name: 'status-add', … }`); `tools/media/requirements/music-3.*.txt` is generated and read by the `Makefile` (`music-$$v.txt`); `config/nextcloud/*/homelab.sh` is mounted by `stacks/nextcloud/compose.yaml`.

**Docs:** `validate` finds no broken link in `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `docs/` or `services/`. Every `./homelab <command>` the README and docs mention is one of the CLI's 70 commands (`cmd/homelab/main.go`'s table); the one other hit, `./homelab builds`, is prose (*builds itself on first run*).

**Drift (read only):** `go mod tidy -diff` changes nothing in either module; `homelab docs --check`: up to date.

### Option A or B: the releases from before the new process

What reads a version number, from the code:
- The desktop app's updater **doesn't**: it installs the repository's *Latest* release whenever it was built from another commit (`internal/selfupdate`, `Release.Newer`). A lower number would still reach every Mac; no reinstall needed for the app.
- The iPhone app's version is the newest tag (`apple-client/scripts/app-version.sh`); `internal/tools/nextversion` picks one more than the newest tag; `testdata/upgrades/<tag>` keeps folders by tag; the stable channel takes `vX.Y.0`.

- **Option A (reset low, e.g. v0.1.0 or v0.2.0-beta.1):** needs every v0.17.1 to v0.47.x tag deleted (about 400) so the newest tag is the new low one. That breaks the iPhone app's version, the upgrade tests' tags, and the CHANGELOG's links to the history. Not worth it.
- **Option B, recommended:** keep every tag, take the 363 patch builds off the releases page (`scripts/reset-releases.sh --apply --confirm`, tags kept), and cut the next version on purpose upward: **v0.48.0** (a monotonic minor, honest about not being 1.0 yet; [Roadmap](<../../docs/Roadmap.md#10-stable>) says what 1.0 needs), then `1.0.0-beta.1` once the reset's flows are `VERIFIED`.

Dry run, Nov 28: 476 releases; Latest v0.47.5; 113 kept; 363 patch builds to take off the page, their tags kept.

## Branches (Nov 28)

None of the `claude/*` branches had a pull request, and none is merged into main (none is an ancestor of main, and merging each changes main), so none was deleted. GitHub already deletes a branch when its pull request merges (`delete_branch_on_merge: true`).

| Branch | Last change | Class | For the owner |
|---|---|---|---|
| `claude/iphone-few-words` | Nov 26 | Superseded: both its headlines are in the CHANGELOG | Delete |
| `claude/iphone-backups-in-status` | Nov 26 | Superseded: all 3 headlines in the CHANGELOG | Delete |
| `claude/ipad-status` | Nov 26 | Mostly superseded: 4 of 5 headlines in the CHANGELOG | Delete, unless the fifth (*Setup is one of Settings' pages on the iPhone, with a Finish setting up card*) is wanted |
| `claude/data-phone-tidy` | Nov 26 | Unique: Tidy Up to look at from a phone; what each app replaces, for Subscriptions | Keep or drop (lane W is paused) |
| `claude/data-appdata-move` | Nov 26 | Unique: *Move the apps' data to another drive* | Keep: the owner deferred it on Nov 27 |
| `claude/busy-mendel-whfrtc` | Nov 27 (under 24 hours) | Unique: Tidy Up called *Library*, 18 commits of redesign | Not touched (recent); lane R is paused |
| `gh-pages`, `iphone-screenshots` | live | Infrastructure: the docs site; the iPhone screenshots `apple-client.yml` fetches | Keep |

## STAGE 3: WAITING FOR ACCOUNT 1

Checked Nov 28, 04:16 UTC: reset-progress.md's phases 1 to 5 are merged, but Account 1 opened **#977** (*A home-only app is checked to be off the internet, not assumed so*): `cmd/homelab/{away,doctor,domain,jobs}.go`, `internal/domain/exposed.go`, `docs/Known Issues.md`, `docs/Security.md`. Account 1 is running, so Branch B: no Go, no `services/`, no existing workflow, no blocking mode.

**Deferred Code Fixes, item 1 (the home-only exposure guard) is Account 1's in #977.** Once it merges, check it covers `domain status`, Set up the domain's plan and `doctor` (red, doctor failing), the zone's wildcard as well as a host's own CNAME, and that a host with its own record is not counted.

**Ready to go once Account 1 has no open pull request** (built and tested in this session; each needs a fresh branch from main):

- **PR A, the other three fixes, each with a regression test that failed first:**
  - *Calibre-Web with no library* (`internal/claim`): with the default login, don't follow redirects; `Location` with `dbconfig` → `claim.NoLibrary` (*its library isn't set yet*), any other redirect can't tell; `claim.Advice(name, why)` says *set Location of Calibre database to /books*. Tests: `TestCalibreWebWithoutItsLibrary`, `TestAdviceForEachReason`.
  - *Windows' name rule* (`internal/domain/undo.go`): `nrptRules` (comment and servers per rule) and `homelabs()` (comment `homelab`, or no comment and only private, loopback or link-local servers, no zone); `ResolverPresent` and `RemoveResolver` use them, naming an older homelab's rule by its servers; `uninstall --apply` takes the rule back (plan line *take back …*), reading the domain before the folder goes. Test: `TestRemoveResolverWindows` rewritten on an NRPT table fake, keeping that a rule with someone's comment or a public server stays.
  - *`app/tray` `TestMenu` race*: `menu.jobs sync.WaitGroup` (Add before each job's goroutine, Done last); the test waits on it with a 10 s limit instead of polling titles.
  - *`internal/sitelogo` race* (found running `-race` on main): `client()` copies `Public` once; a background dial read it while a test restored it (1 report in 10 runs before, 0 in 20 after).
  - CHANGELOG lines (Fixed) for the first two and item 1 if #977 hasn't one; `services/network/Cloudflare Tunnel.md`'s *never removes routes* corrected (#977 may already).
- **PR B, the release cutover:** `internal/tools/nextversion` gets a fourth argument `patch|minor|beta` (`cut`; 12 cases in `TestCut`, `next` unchanged); `release.yml`: `on.push` only `tags: [v*]`; `workflow_dispatch` input `release: [test, patch, minor, beta]`; the version job passes `$KIND`; build jobs build every system unless `test`; `publish` only for a by-hand release from main (today a by-hand run from main publishes too: its `if` is only `github.ref == 'refs/heads/main'`); a beta `--prerelease --latest=false`, and no nightly replacement; `concurrency.cancel-in-progress: false`. Then the docs: `docs/Release Process.md` without its *not in effect* banner, `docs/Releasing.md`, `docs/README.md`'s quick reference, the Roadmap's intro, CONTRIBUTING's *Releases*, and `docs/Decisions.md`'s ADR (a *Since then* line). And `repo-hygiene.yml`: `continue-on-error: false`, `--check-deps --check-generated` in the PR job.
- **`go test -race -timeout 15m ./...` in a cloud container:** `cmd/homelab` takes more than 15 minutes under `-race` here (it timed out at 900 s; about 1 minute without `-race`), so the full run can't pass in this container whatever the code; CI runs without `-race`. `internal/companion`'s `TestARemovedPhonesStreamEnds` failed once in the full parallel run and passed 30 of 30 alone (`-cpu=1`): not changed without a failure message to go on.

**Release plan (Option B, recommended):** after PR B merges, the owner runs `scripts/reset-releases.sh` (dry run: 476 releases, 113 kept, 363 patch builds to take off, tags kept), then `scripts/reset-releases.sh --apply --confirm`, then **Actions › Release › Run workflow** with `release: minor` for **v0.48.0**.

**Scrubbing old commit trailers (optional, offline, the owner's call; rewrites history and needs a force-push, so not done here):**

```bash
git clone --mirror https://github.com/Snooper42/homelab-wizard.git hw-mirror && cd hw-mirror
pip install git-filter-repo
git filter-repo --message-callback 'import re; return re.sub(rb"(?im)^(Co-Authored-By:.*(claude|anthropic).*|Claude-Session:.*|.*Generated with \[Claude Code\].*)\r?\n?", b"", message)'
# Every commit hash changes: every open pull request, clone and tag must move to the new history.
```

## At Clean Baseline — Awaiting Direction

After PR 3: main checked out, nothing uncommitted. The bookmarked work (none from before this handoff; the lanes R, M and W are paused in `lanes.md`, and `CLAUDE.md` freezes the iPhone app, Finances, the Ollama log explanations and new catalog apps) doesn't resume on its own. Next, on the owner's word or once Account 1 has no open pull request: PR A, then PR B.

## Deferred Until Account 1 Finishes

- **`release.yml`, for the new release process** (`docs/Release Process.md`): drop `branches: [main]` and its `paths:` from `on.push` (keep `tags: ["v*"]`); give `workflow_dispatch` an input `kind` (`patch`, `minor`, `beta`); have the `version` job pass it to `internal/tools/nextversion` (which then needs a `kind` argument: Go, frozen until then); publish as *Latest* only for `patch` and `minor` (`--latest=false --prerelease` for `beta`); the notes stay the version's own CHANGELOG section, else the entries the release before didn't have (#970). Retire the *Replace the nightly release* step, or rename it `beta-nightly` as a pre-release.
- **`ci.yml`:** the Go tests could run `-race` with `-timeout 15m` once `app/tray`'s race is fixed (Deferred Code Fixes).

- **The nightly run is red (Nov 27):** `TestAHomelabsLife/data_in_each_app`, `paperless-ai: Paperless-AI's setup: 403 Forbidden ... setup_code_required`. Paperless-AI's newest image asks for a setup code (its log, `data/setup-code`) at first start; `test/realdocker/apps_test.go`'s `seedPaperlessAI` and `services/documents/Paperless-AI.md` don't know it. Both paths are read-only for this handoff; Core Reliability's to fix. Nov 25's red was `TestTheCatalogStarts/immich-server` (install exit 1), not looked into.

Files PR #961 touches (read-only until it merges or closes): `CLAUDE.md`, `.claude/prompts/lanes.md`, `owner.md`, `reset-progress.md`, `redesign-loop.md`, `money-loop.md`, `web-loop.md`, `setup-loop.md`, `quality-loop.md`, `.github/pull_request_template.md`, `docs/Known Issues.md`.

- `owner.md` line 11: "open Claude Code on the web" (an instruction to the owner, not an authorship claim; likely stays).

## Next concrete step

The owner's answer on Vaultwarden (above). Then, on their yes, the Windows name-rule fix. The handoff's text after Phase 2A (2B onward, Stages 3 and 4) was never sent; ask for it before starting them.
