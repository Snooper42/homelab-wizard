# Handoff: Snooper42/homelab-wizard

Kept on branch `claude/handoff` only. **Never merge this branch.** Updated after each PR or major step.

Last updated: see the commit time.

The scheduled Nightly run on main (058d3a2, run 40477573725) passed.

## Scope (from the owner)

Finish the roadmap's 0.11, 0.12, and if possible 0.13 items (docs/Roadmap.md). One PR at a time; no parallel PRs. Push after every meaningful step.

## Open PRs (main at da0a3a7)

| PR | Branch | What | CI | Ready? |
|---|---|---|---|---|
| #244 | `claude/release-open` (head ae37f69) | 0.11 release builds opened on each runner (dmg-smoke.sh, windows-smoke.ps1, release.yml steps + screenshots). | Proven by dispatched release.yml run 40499975280. PR CI (quick jobs) started ~13:52 UTC. release.yml runs on the merge to main: check its two new steps there. | Merge when green; then the next queued branch. |

Merge order: #244, then the queue below, one PR at a time. Each merge of main into a branch that adds a nightly job conflicts the same way: nightly.yml (rebuild with the helper at the end of this file: main's file + the branch's job appended), docs/Testing.md (run `resolve.py`-style: main's paragraph + the branch's "Beside it" sentence; then the Testing.md fix-up script at the end of this file: each sentence once, one "What it cannot reach" last), docs/Roadmap.md (keep main's ticks and the branch's own Done line).

## Merged this stretch (for context)

#229 Duplicati restore in the nightly run; #232 Actual Budget via its API; #233 Setup's Kopia step reports the restore test; #231 watchdog puts data back only if the app never came up well (+ real-Docker step); #234 nightly backup records image digests, `move in` pins them; #235 `testdata/upgrades/<tag>` + `TestEachReleasesFolderUpgrades` (0.11 item ticked); #236 ISSUE-0016 Duplicati API read-back + repair as on a new machine; #237 weekly catalog check (`TestTheCatalogStarts`, `catalog` matrix job) + fixes for Ghostfolio (sslmode), File Browser/Seerr/Homebox (`user: PUID:PGID`), Homebox `HOMEBOX_API_KEY_PEPPER`, registry `toomanyrequests` retry (`internal/docker`); #238 `homelab validate` fails on merge-conflict markers; #239 `domain setup` against real NPM/AdGuard (`domain` nightly job); #240 ISSUE-0015 `homelab wire` against the real *arr apps (`wire` nightly job); #241 ISSUE-0001 proxy image + CrowdSec ban 403 (`proxy` nightly job); #242 parity rows name real-machine steps; #243 each system's own words for opening .env and removing the app.

## What is left for 0.11 / 0.12 / 0.13 (docs/Roadmap.md)

0.11 (section "0.11: proven against real Docker"):
- [ ] Nightly run "Done when: green for a week in a row, and a failure opens an issue" — the run exists and opens issues; only time can tick it (check the scheduled `Nightly` runs on main for 7 green nights).
- [x] Proxy image in the nightly run (ISSUE-0001): MERGED (#241). Was on branch `claude/proxy-real` (head c89fd99), no PR yet (one-at-a-time rule). `test/realdocker/proxy_test.go` (`TestTheProxyBlocksABannedAddress`, `REALDOCKER_PROXY=1`), a `proxy` job in nightly.yml, Roadmap ticked, ISSUE-0001 "Verified on Linux, to verify on the Mac". Dispatched run 40490896326: `proxy` job `--- PASS` (bouncer pulling, ban on 172.18.0.1 -> 403, lifted -> 200). Open its PR after #240 merges; merge main first (rebuild nightly.yml as main + `proxy` job, see Gotchas).
- [x] `domain setup` against real NPM/AdGuard: merged (#239).
- [x] Home mode run with a fake tailnet: DONE on branch `claude/home-real` (head f74afad), no PR yet (queue below). `TestHomeModeSetupWalked` (`REALDOCKER_HOME=1`, nightly `home` job, sets lingering + XDG_RUNTIME_DIR/DBUS for systemd user units). Headscale 0.29.6 on the `homelab` network is the tailnet; .env seeded with HOMELAB_BASELINE=small, MEDIA_ROOT, TAILSCALE_AUTHKEY, TAILSCALE_EXTRA_ARGS=--login-server=http://headscale:8080. Dispatched run 40494114422: `home` job `--- PASS` (688 s; ~10 min of it is `signups open` counting down its 10 minutes, as the Setup button does). Product changes on the branch: `TAILSCALE_EXTRA_ARGS`; `tailnet setup`/`login` wait up to a minute for the link or the auth key's sign-in (race found by the test); `signups open` names the tailnet address in Home mode (`householdAddress`). Roadmap ticked, Testing.md sentence added (and the triple "What it cannot reach" cut to one on this branch).
- [x] Release builds opened on each runner: DONE on branch `claude/release-open` (head 88caf3b, no PR yet; queue item 6). `app/packaging/dmg-smoke.sh` + `app/packaging/windows-smoke.ps1` + steps and screenshot uploads in release.yml; Roadmap ticked, ISSUE-0014 "Partly verified", ISSUE-0021 note, CHANGELOG Improved line. Proven by dispatched run 40499975280 (platforms=all): macOS "The DMG's app starts from Applications", Windows "window: Homelab Wizard", Linux AppImage step green. Gotchas found: the Windows app is `Homelab Wizard.exe` (not homelab-wizard.exe); the Mac app starts its menu bar helper (pkill it too); artifacts can't be downloaded into the Claude sandbox (blob storage host blocked), so the screenshots weren't looked at, only their sizes (274 KB, 62 KB). release.yml doesn't run on PRs (push to main / tags / dispatch), so its PR CI won't exercise it; cite the dispatched run.
- [ ] Recovery kit tested: WAITING ON OWNER (the kit holds no secrets by design; the item's wording conflicts).
- [x] The app's own update keeps the window/phones/jobs: DONE on branch `claude/app-update` (head a5b662e, no PR yet; queue). `internal/selfupdate/keeps_test.go` (`TestAnUpdateKeepsTheWindowThePhonesAndTheJobs`): real swap helper per OS on stand-in builds, window.json, phones from testdata/upgrades' newest release, the agent's job; Linux-proven locally, macOS/Windows branches only run on the PR's CI (unproven until then). Product fix: `core.JobsCLIBehind` + `app/app.go` moveToAgent re-runs `schedule install` when the AppImage jobs' `bin/homelab` copy differs from the bundled CLI (the update left the old copy). Roadmap ticked, CHANGELOG Fixed line.
0.12:
- [ ] Parity table: "each *works* names the test or CI job": three rows still say "none" for a *works* cell (a native app started from Status, native apps opened after a restart, Frigate's detector on Linux). Needs real tests or rewording; not started.
- [ ] Each *missing* cell built or *can't*: left are Jellyfin on SteamOS (no native route; plan: a container Jellyfin used on SteamOS only, AMD graphics through /dev/dri, Status/Setup treating it as the native one there; sizeable, touches the catalog's native-vs-container handling) and signed builds on macOS/Windows (needs the owner's Apple Developer ID and Windows code-signing certificate, docs/Releasing.md; also a 1.0 item, so WAITING ON OWNER).
- [ ] *Works differently* cells explained on the screen where they show: needs frontend text, and the screens are on hold (owner). Ask before touching.
- [ ] Tray item, needs-a-look mark, alert on macOS/Windows runners: Linux (and Windows for the alert) done; the Mac's menu bar / Dock badge / Notification Center readback and Windows' notification area are the hard rest. Not started. Ideas tried/considered: the Mac Dock badge can't be set from a Go test (setDockBadge dispatches to the main queue; no Cocoa run loop in a test), and the real app on the Mac runner shows no count (no Docker, so no troubled apps); a route is the app with a fake engine plus `lsappinfo info -only StatusLabel "Homelab Wizard"`. The Mac alert: Notification Center's record is in `$(getconf DARWIN_USER_DIR)/com.apple.notificationcenter/db2/db` (may need Full Disk Access on the runner; untried).
- [x] Numbered real-machine steps for every row: MERGED (#242), was branch `claude/parity-steps` (head 7365258, docs only: docs/Host.md, docs/Testing.md, docs/Roadmap.md), no PR yet. Docs-only, so CI is the quick jobs only (~10 min).
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

1. (merged #241) `claude/proxy-real`.
2. (merged #242) `claude/parity-steps`.
3. `claude/home-real` (0.11 Home mode with a fake tailnet). Touches compose/ and .env.example and test/realdocker, so its PR runs the life job (~40 min).

4. (merged #243) `claude/mac-words` (head 2a3e82e, 0.12 wording, ready): `duplicati setup` ("Open .env (open -e .env)") and `uninstall` ("drag it to the Trash") now say each system's own (`editEnv`, `removeApp(host.Profile)`); the Mac-only words test also catches `open -e .env` and `to the Trash`. CHANGELOG Fixed line; Roadmap's ticked words item gets a sentence. Quick CI only.
5. (PR #244) `claude/release-open` (0.11 release builds opened; see the 0.11 list above). release.yml isn't run by PR CI: cite run 40499975280.
6. `claude/app-update` (0.11 app's own update; see the 0.11 list above).
7. `claude/native-mac` (head 0ca1d00, main merged in, Host.md rows + Frigate reword + Roadmap parity item ticked are now IN the branch; 0.12 parity, NOT proven yet; CI runs only on PRs): `app/native_forreal_darwin_test.go` (`TestNativeAppOpensForReal`, App.OpenNativeApp) and `cmd/homelab/native_forreal_darwin_test.go` (`TestNativeAppsOpenAfterARestartForReal`, openMacApps), plus a macOS-only CI step (`brew install --cask jellyfin`, clear quarantine, both tests). Unverified guesses: the cask's app name (code tries "Jellyfin" and "Jellyfin Server"), that it starts headless on the runner, /health says "Healthy". Still to add once `claude/parity-steps` is merged (same rows): docs/Host.md rows "A native app (Jellyfin) started from Status" and "Native apps opened after a restart" name these tests instead of "none"; Frigate's Linux detector cell becomes *works differently* (by hand, per Frigate's note; the homelab adds nothing); then check whether the Roadmap 0.12 parity-table item can be ticked.

- docs/Testing.md's "Proven every night" paragraph: fixed on main by #240 (one "What it cannot reach", at the end). Keep it that way when merging (script below).

PR descriptions are drafted in `pr-drafts/` on this branch (home.md, words.md, release.md, update.md, native.md). Tick their CI box when green. Expected conflicts when merging main: release-open in docs/Known Issues.md (its ISSUE-0014 progress paragraph sits right before ISSUE-0015's section, where #240 added ISSUE-0015 progress; keep both); home-real in nightly.yml, Roadmap.md, Testing.md (as described). The other three merge cleanly. home-real's `home` job passed again on its head f74afad (run 40506439258, 700 s; sign-ups named https://homelab.fake-tailnet.test:8087).

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

## Helper: docs/Testing.md's "Proven every night" paragraph after a merge

```python
import re
p='docs/Testing.md'
s=open(p).read()
sent="What it cannot reach (a real Mac, Windows, the Steam Machine, the phone, Proton Drive) stays in the lists below."
start=s.index('Before a step reaches this page, CI tries it')
end=s.index('\n',start)
parts=re.split(r'(?<=\.) (?=[A-Z])', s[start:end])
seen=[]; out=[]
for x in parts:
    if x==sent or x in seen: continue
    seen.append(x); out.append(x)
out.append(sent)
s=s[:start]+' '.join(out)+s[end:]
open(p,'w').write(s)
```

Resolve the conflict first by taking main's paragraph and appending the branch's own "Beside it, the `<job>` job ..." sentence, then run this.
