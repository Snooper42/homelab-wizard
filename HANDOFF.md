# Handoff: Snooper42/homelab-wizard

Kept on branch `claude/handoff` only. **Never merge this branch.** Updated after each PR or major step.

Last updated: see the commit time.

The scheduled Nightly run on main (058d3a2, run 40477573725) passed.

## Scope (from the owner)

Finish the roadmap's 0.11, 0.12, and if possible 0.13 items (docs/Roadmap.md). One PR at a time; no parallel PRs. Push after every meaningful step.

## Open PRs (main at 959a9ea)

| PR | Branch | What | CI | Ready? |
|---|---|---|---|---|
| #240 | `claude/wire-real` (head 5a0df62) | ISSUE-0015 (a 1.0 item, outside the 0.11-0.13 scope, but finished): `test/realdocker/wire_test.go` (`TestTheMediaAppsConnect`, `REALDOCKER_WIRE=1`), a `wire` job in nightly.yml, ISSUE-0015 progress. | Dispatched run 40457484514 on b6bf546: `wire` job `--- PASS`. Main (#239) merged in at 5a0df62 (nightly.yml rebuilt: main + `wire`; Testing.md: every "Beside it" sentence, ONE "What it cannot reach" at the end). PR CI on 5a0df62 started ~11:42 UTC; life run ~40 min. | Merge when green. |

Merge order: #240, then open the queued branches one at a time (below). Each later merge of main into a branch conflicts the same way: nightly.yml (rebuild: `python3 addjob.py <branch head before merge> <job>`: main's file + the branch's job appended), docs/Testing.md (main's paragraph + the branch's own "Beside it" sentence, then keep one "What it cannot reach" at the end).

## Merged this stretch (for context)

#229 Duplicati restore in the nightly run; #232 Actual Budget via its API; #233 Setup's Kopia step reports the restore test; #231 watchdog puts data back only if the app never came up well (+ real-Docker step); #234 nightly backup records image digests, `move in` pins them; #235 `testdata/upgrades/<tag>` + `TestEachReleasesFolderUpgrades` (0.11 item ticked); #236 ISSUE-0016 Duplicati API read-back + repair as on a new machine; #237 weekly catalog check (`TestTheCatalogStarts`, `catalog` matrix job) + fixes for Ghostfolio (sslmode), File Browser/Seerr/Homebox (`user: PUID:PGID`), Homebox `HOMEBOX_API_KEY_PEPPER`, registry `toomanyrequests` retry (`internal/docker`); #238 `homelab validate` fails on merge-conflict markers; #239 `domain setup` against real NPM/AdGuard (`domain` nightly job).

## What is left for 0.11 / 0.12 / 0.13 (docs/Roadmap.md)

0.11 (section "0.11: proven against real Docker"):
- [ ] Nightly run "Done when: green for a week in a row, and a failure opens an issue" — the run exists and opens issues; only time can tick it (check the scheduled `Nightly` runs on main for 7 green nights).
- [ ] Proxy image in the nightly run (ISSUE-0001): DONE on branch `claude/proxy-real` (head c89fd99), no PR yet (one-at-a-time rule). `test/realdocker/proxy_test.go` (`TestTheProxyBlocksABannedAddress`, `REALDOCKER_PROXY=1`), a `proxy` job in nightly.yml, Roadmap ticked, ISSUE-0001 "Verified on Linux, to verify on the Mac". Dispatched run 40490896326: `proxy` job `--- PASS` (bouncer pulling, ban on 172.18.0.1 -> 403, lifted -> 200). Open its PR after #240 merges; merge main first (rebuild nightly.yml as main + `proxy` job, see Gotchas).
- [x] `domain setup` against real NPM/AdGuard: merged (#239).
- [x] Home mode run with a fake tailnet: DONE on branch `claude/home-real` (head f74afad), no PR yet (queue below). `TestHomeModeSetupWalked` (`REALDOCKER_HOME=1`, nightly `home` job, sets lingering + XDG_RUNTIME_DIR/DBUS for systemd user units). Headscale 0.29.6 on the `homelab` network is the tailnet; .env seeded with HOMELAB_BASELINE=small, MEDIA_ROOT, TAILSCALE_AUTHKEY, TAILSCALE_EXTRA_ARGS=--login-server=http://headscale:8080. Dispatched run 40494114422: `home` job `--- PASS` (688 s; ~10 min of it is `signups open` counting down its 10 minutes, as the Setup button does). Product changes on the branch: `TAILSCALE_EXTRA_ARGS`; `tailnet setup`/`login` wait up to a minute for the link or the auth key's sign-in (race found by the test); `signups open` names the tailnet address in Home mode (`householdAddress`). Roadmap ticked, Testing.md sentence added (and the triple "What it cannot reach" cut to one on this branch).
- [ ] Release builds opened on each runner (DMG, Windows installer, AppImage): not started.
- [ ] Recovery kit tested: WAITING ON OWNER (the kit holds no secrets by design; the item's wording conflicts).
- [ ] The app's own update keeps window settings/phones/jobs: not started; needs the previous release's desktop app built and replaced (Wails), hard to do headless.
0.12:
- [ ] Parity table: "each *works* names the test or CI job": three rows still say "none" for a *works* cell (a native app started from Status, native apps opened after a restart, Frigate's detector on Linux). Needs real tests or rewording; not started.
- [ ] Each *missing* cell built or *can't*: left are Jellyfin on SteamOS (no native route; a container Jellyfin would close it) and signed builds on macOS/Windows (needs the owner's certificates, also a 1.0 item).
- [ ] *Works differently* cells explained on the screen where they show: needs frontend text, and the screens are on hold (owner). Ask before touching.
- [ ] Tray item, needs-a-look mark, alert on macOS/Windows runners: Linux (and Windows for the alert) done; the Mac's menu bar / Dock badge / Notification Center readback and Windows' notification area are the hard rest. Not started.
- [x] Numbered real-machine steps for every row: DONE on branch `claude/parity-steps` (head 7365258, docs only: docs/Host.md, docs/Testing.md, docs/Roadmap.md), no PR yet. Docs-only, so CI is the quick jobs only (~10 min).
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

## Queue of ready branches (open their PRs one at a time, in this order, after #239 and #240)

1. `claude/proxy-real` (0.11, ISSUE-0001).
2. `claude/parity-steps` (0.12 real-machine steps).
3. `claude/home-real` (0.11 Home mode with a fake tailnet). Touches compose/ and .env.example and test/realdocker, so its PR runs the life job (~40 min).

4. `claude/mac-words` (head 2a3e82e, 0.12 wording, ready): `duplicati setup` ("Open .env (open -e .env)") and `uninstall` ("drag it to the Trash") now say each system's own (`editEnv`, `removeApp(host.Profile)`); the Mac-only words test also catches `open -e .env` and `to the Trash`. CHANGELOG Fixed line; Roadmap's ticked words item gets a sentence. Quick CI only.
5. `claude/native-mac` (head 850bd8b, 0.12 parity, NOT proven yet; CI runs only on PRs): `app/native_forreal_darwin_test.go` (`TestNativeAppOpensForReal`, App.OpenNativeApp) and `cmd/homelab/native_forreal_darwin_test.go` (`TestNativeAppsOpenAfterARestartForReal`, openMacApps), plus a macOS-only CI step (`brew install --cask jellyfin`, clear quarantine, both tests). Unverified guesses: the cask's app name (code tries "Jellyfin" and "Jellyfin Server"), that it starts headless on the runner, /health says "Healthy". Still to add once `claude/parity-steps` is merged (same rows): docs/Host.md rows "A native app (Jellyfin) started from Status" and "Native apps opened after a restart" name these tests instead of "none"; Frigate's Linux detector cell becomes *works differently* (by hand, per Frigate's note; the homelab adds nothing); then check whether the Roadmap 0.12 parity-table item can be ticked.

- docs/Testing.md "Proven every night" paragraph on main repeats "What it cannot reach (...) stays in the lists below." three times (bad earlier merges); #239 adds a fourth. Clean it up (one, at the paragraph's end, after all "Beside it" sentences) in the next merge of main into claude/wire-real.

## Where I stopped / next

#239 merged (959a9ea). Waiting for #240's PR CI on 5a0df62 (life run ~40 min), then merge #240. Then the queue, one PR at a time: proxy-real, parity-steps, home-real, mac-words, native-mac (merge main into each first; see the conflict notes). Left after that for 0.11: release builds opened on runners, the app's own update, a green week of nightlies, the recovery kit (owner). For 0.12: the tray/needs-a-look/alert on the macOS and Windows runners, Jellyfin on SteamOS (missing), works-differently text on the screens (on hold).

## Helper: rebuild nightly.yml after merging main (run in the branch worktree, mid-merge)

```python
import sys,subprocess
# main's nightly.yml + the job block (from its comment to the end) the branch added before the merge.
branch_rev, job = sys.argv[1], sys.argv[2]
main=subprocess.check_output(['git','show','origin/main:.github/workflows/nightly.yml']).decode()
old=subprocess.check_output(['git','show',branch_rev+':.github/workflows/nightly.yml']).decode()
i=old.index('\n  # ', old.index('  real-docker:'))  # first job comment after real-docker
# find the comment that precedes "  <job>:"
j=old.index('\n  '+job+':\n')
k=old.rfind('\n\n', 0, j)+2
block=old[k:].rstrip('\n')+'\n'
open('.github/workflows/nightly.yml','w').write(main.rstrip('\n')+'\n\n'+block)
```

Usage: `git merge origin/main` (conflict in nightly.yml), then `python3 addjob.py <branch head before the merge> <job name>`, then check each job keeps its steps: `python3 -c "import yaml;d=yaml.safe_load(open('.github/workflows/nightly.yml'));print({k:len(v['steps']) for k,v in d['jobs'].items()})"`.
