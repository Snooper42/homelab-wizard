# Handoff: Snooper42/homelab-wizard

Kept on branch `claude/handoff` only. **Never merge this branch.** Updated after each PR or major step.

Last updated: see the commit time.

The scheduled Nightly run on main (058d3a2, run 40477573725) passed.

## Scope (from the owner)

Finish the roadmap's 0.11, 0.12, and if possible 0.13 items (docs/Roadmap.md). One PR at a time; no parallel PRs. Push after every meaningful step.

## Open PRs (main at 058d3a2)

| PR | Branch | What | CI | Ready? |
|---|---|---|---|---|
| #239 | `claude/domain-real` (head cefa4af) | 0.11 item "`domain setup` against the real Nginx Proxy Manager and AdGuard Home": `test/realdocker/domain_test.go` (`TestTheDomainThroughTheProxy`, needs `REALDOCKER_DOMAIN=1`), a `domain` job in `.github/workflows/nightly.yml`, Roadmap item ticked, ISSUE-0004 progress. | Dispatched run 40455468846 on 915ea2c: `domain` job `--- PASS` (5 proxy hosts, AdGuard rewrite, name via AdGuard DNS, ntfy through the proxy). PR CI on cefa4af running (dadaacf had a broken nightly.yml from the merge, fixed); its real-docker (life run) takes ~40 min. | Merge when PR CI is green. |
| #240 | `claude/wire-real` (head be81319) | ISSUE-0015 (a 1.0 item, outside the 0.11-0.13 scope, but finished): `test/realdocker/wire_test.go` (`TestTheMediaAppsConnect`, `REALDOCKER_WIRE=1`), a `wire` job in nightly.yml, ISSUE-0015 progress. | Dispatched run 40457484514 on b6bf546: `wire` job `--- PASS` (4 links done, then already). PR CI on be81319 (main merged, nightly.yml rebuilt) running. | Merge after #239 when green; it will then conflict in nightly.yml (keep both `domain` and `wire` jobs) and docs/Testing.md (one paragraph under "Proven every night": keep every "Beside it, ..." sentence). |

Merge order: #239, then merge main into `claude/wire-real`, resolve, push, wait for CI, then #240.

## Merged this stretch (for context)

#229 Duplicati restore in the nightly run; #232 Actual Budget via its API; #233 Setup's Kopia step reports the restore test; #231 watchdog puts data back only if the app never came up well (+ real-Docker step); #234 nightly backup records image digests, `move in` pins them; #235 `testdata/upgrades/<tag>` + `TestEachReleasesFolderUpgrades` (0.11 item ticked); #236 ISSUE-0016 Duplicati API read-back + repair as on a new machine; #237 weekly catalog check (`TestTheCatalogStarts`, `catalog` matrix job) + fixes for Ghostfolio (sslmode), File Browser/Seerr/Homebox (`user: PUID:PGID`), Homebox `HOMEBOX_API_KEY_PEPPER`, registry `toomanyrequests` retry (`internal/docker`); #238 `homelab validate` fails on merge-conflict markers.

## What is left for 0.11 / 0.12 / 0.13 (docs/Roadmap.md)

0.11 (section "0.11: proven against real Docker"):
- [ ] Nightly run "Done when: green for a week in a row, and a failure opens an issue" — the run exists and opens issues; only time can tick it (check the scheduled `Nightly` runs on main for 7 green nights).
- [ ] Proxy image in the nightly run (ISSUE-0001): DONE on branch `claude/proxy-real` (head c89fd99), no PR yet (one-at-a-time rule). `test/realdocker/proxy_test.go` (`TestTheProxyBlocksABannedAddress`, `REALDOCKER_PROXY=1`), a `proxy` job in nightly.yml, Roadmap ticked, ISSUE-0001 "Verified on Linux, to verify on the Mac". Dispatched run 40490896326: `proxy` job `--- PASS` (bouncer pulling, ban on 172.18.0.1 -> 403, lifted -> 200). Open its PR after #240 merges; merge main first (rebuild nightly.yml as main + `proxy` job, see Gotchas).
- [ ] `domain setup` against real NPM/AdGuard: PR #239.
- [ ] Home mode run with a fake tailnet (Setup walked top to bottom by the CLI): not started; large.
- [ ] Release builds opened on each runner (DMG, Windows installer, AppImage): not started.
- [ ] Recovery kit tested: WAITING ON OWNER (the kit holds no secrets by design; the item's wording conflicts).
- [ ] The app's own update keeps window settings/phones/jobs: not started; needs the previous release's desktop app built and replaced (Wails), hard to do headless.
0.12: parity table in docs/Host.md, missing/works-differently cells, tray/needs-a-look/alerts on each runner, numbered steps for real machines. Not started this stretch; read the section before choosing.
0.13: only two unticked: Immich share links (needs a real person to follow it, per the item) and Kopia (only the Backups screen's line per engine is left, and the screens are on hold by owner decision).

## Decisions waiting on the owner

- ADR-0020 part 2: the agent running the nightly updates (`homelab update --all` at `WATCHTOWER_SCHEDULE`) leaves Watchtower's container (raw Docker socket) with nothing to do. Remove it, or keep it (monitor-only)? Asked in the handoff only; nothing built.
- Recovery-kit Roadmap item: ambiguous (kit holds no secrets by design).
- Second line of 1.0's "restore brings back the versions" (pinned versions in `.env` for self-migrating apps) ties into the Watchtower question.

## Owner rules in force

Kopia beside Duplicati. Dashboard/screens/frontend on hold (don't touch). "Most safe and logical option for an at-home homelab"; ask only when it's the owner's call. PR rules: drafts, one theme, branched from main; merge = draft false + squash with full head sha + title "(#N)"; after each merge, merge main into open branches (never rebase/force-push). Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` + `Claude-Session:` link. Before push: `make check`, `make coverage`, gosec (`bin/gosec -quiet -exclude=G104,G204,G301,G302,G304,G306,G702,G703 ./...`, also in `app/`, and `-tags realdocker ./test/...`).

## Gotchas

- Real-docker life run (`real-docker` job) takes 35-40 min; it runs on PRs touching compose/, stacks/, test/realdocker/, nightly.yml, .env.example. Every merge forces the other open branches to re-run it.
- The `catalog`, `domain`, `wire` jobs do not run on PRs: dispatch the workflow on the branch (`workflow_dispatch`, input `catalog`=all|0-6). A dispatch also runs the life job; cancel it once the extra jobs finish if the PR's own run covers it.
- Watchtower's default schedule is 04:00 UTC; the life run now moves it 12 h away (fixed in #234). Runs that crossed 04:00 used to fail at the update step.
- Seven catalog shares in parallel hit lscr.io's per-minute throttle; the CLI now retries (#237).
- CI logs are huge: fetch with get_job_logs into a file and grep `--- PASS|FAIL`. Only the last 60 lines of each `homelab` call are logged.
- Sandbox (Claude cloud): runs as root (PUID stays 501, bind mounts root-owned: apps with fixed uids fail locally but not in CI); lscr.io and ghcr.io blobs blocked (use Docker Hub `linuxserver/*` + retag to `lscr.io/...`); Alpine mirror blocked (proxy image and `homelab/sqlite:1` cannot build; build an ubuntu stand-in for sqlite); containers have no IPv6 (Firefly importer's nginx fails locally only); Docker Hub via `{"registry-mirrors":["https://mirror.gcr.io"]}`.
- Merging main into a branch that adds a job at the end of `.github/workflows/nightly.yml` lets git interleave the jobs (a job loses its `steps`; YAML still parses but GitHub shows a zero-job "push" run named after the file and starts no PR run). Rebuild the file as main's plus the branch's job, appended whole, and check `python3 -c "import yaml; ..."` that each job keeps its steps.
- `docs --check` does not catch conflict markers; `homelab validate` now does (#238).

## Where I stopped / next

Waiting for #239's PR CI (life run), then merge #239, merge main into #240, wait, merge #240. Then the ISSUE-0001 proxy item (plan above). Then pick 0.11's Home-mode run or 0.12's parity table.
