# Handoff: Snooper42/homelab-wizard

Updated 27 October 2026 by the next session (https://claude.ai/code/session_01K9KWLAh1ytLmA4j9MShtRU). Main is at **29859eb** (after #250). **Open: PR #251** (`claude/tray-windows-menu`, draft, CI running: the Windows tray test now opens the menu by sending the SystrayClass window WM_USER+1/WM_RBUTTONUP, reads the #32768 menu via MN_GETHMENU + GetMenuStringW, and posts Quit's WM_COMMAND). If it passes: tick the Roadmap tray item, update Host's tray row (Windows menu read), CHANGELOG, merge. If it cannot work, say why in the Roadmap and close/merge just the docs.

## STANDING RULE FOR WHOEVER PICKS THIS UP (and for every session after)

You cannot see how much usage you have left, so plan to be cut off at any moment:

1. Keep this file (`HANDOFF.md` on branch `claude/handoff`, never merged) current: update and push it after every PR and every major step.
2. Before you run out of usage, find a good stopping point: stop starting new work, merge what is green, push everything, do a last update of `HANDOFF.md`.
3. Then give the owner, in the chat, **a ready-to-paste handoff prompt for the next Claude session** (on any app or account), which includes the contents of `HANDOFF.md` and **repeats this same rule**, so the next session also stops in time and hands off the same way. This applies to every session, forever, not just this one.

## Scope (from the owner)

Work only on finishing **0.11, 0.12, and if possible 0.13** of `docs/Roadmap.md`. One thing at a time: **never more than one open PR**, no parallel PRs. Push after every meaningful step.

## Owner rules in force

- Kopia stays beside Duplicati. The dashboard, the app's screens, and the frontend are **on hold** (don't touch `web/`, the app's screens). "Pick the most safe and logical option for an at-home homelab"; ask only when it is genuinely the owner's call.
- PRs: one theme each, branched from main, opened as drafts. To merge: tick the Validation box with the CI evidence, set draft=false, **squash** with the full 40-character head SHA and a title ending "(#N)". After each merge, merge main into the next branch (never rebase or force-push).
- Before every push: `make check`, `make coverage`, gosec: `bin/gosec -quiet -exclude=G104,G204,G301,G302,G304,G306,G702,G703 ./...` (also in `app/`, and with `-tags realdocker ./test/...`).
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: <your session link>`. PR body ends with "🤖 Generated with [Claude Code](https://claude.com/claude-code)" and the session link. No model names anywhere else in commits or PRs. Plain words.
- Never skip or disable a test to get green. Read CI's `--- PASS`/`ok` lines yourself before ticking a box.

## Merged in this stretch (newest last)

#229-#238 (earlier), then today: **#239** `domain setup` against real NPM/AdGuard (`domain` nightly job); **#240** ISSUE-0015 `homelab wire` against the real *arr apps (`wire` job); **#241** ISSUE-0001 proxy image built + CrowdSec ban gets 403 (`proxy` job); **#242** parity rows name real-machine steps (M16-18, W16-20, S14-16); **#243** each system's own words for opening `.env` / removing the app; **#244** release builds opened on each runner (`app/packaging/dmg-smoke.sh`, `windows-smoke.ps1`; release.yml run 40517316882 on main passed with them); **#245** the app's own update keeps window/phones/jobs (`TestAnUpdateKeepsTheWindowThePhonesAndTheJobs`) + an AppImage's jobs get the new CLI (`core.JobsCLIBehind`). Then (session_01K9KWLAh1ytLmA4j9MShtRU): **#246** Home mode walked through Setup every night against a fake tailnet (Headscale, `home` job); **#247** Roadmap: five items about the app's feel in 0.14/0.15 (owner asked); **#248** Jellyfin opened from Status and after a restart on the Mac runner (the parity table item ticked); **#249** Jellyfin on SteamOS as a container (`jellyfin-container`, `catalog.ForSteamOS`); **#250** the tray item on the Mac (menu read, Quit) and Windows (icon in NotifyIconSettings) runners, and the Mac alert in Notification Center's record.

## Next (nothing is open; pick in this order)

Everything in 0.11-0.13 that does not wait on the owner, on time, or on the screens (on hold) is small now:
1. Windows tray menu readback (0.12 *Proven on each runner*, see below), an experiment on a PR like #250 was.
2. The Mac Dock count / Windows tray dot ("needs a look" mark), same kind of experiment.
3. Then stop and ask the owner about the decisions below (recovery kit wording, signing certificates, lifting the screens' hold, widening scope to 0.15).

## What is left for 0.11 / 0.12 / 0.13 (after #250)

- 0.11: **nightly green for a week** (time only; scheduled Nightly at 09:00 UTC on main, first green night 27 Oct; a failed night opens an issue). **Recovery kit tested: WAITING ON OWNER** (the kit holds no secrets by design; the item's wording conflicts).
- 0.12:
  - *Missing* cells: only **signed builds** on macOS/Windows (WAITING ON OWNER: Apple Developer ID + Windows code-signing certificate, docs/Releasing.md). Jellyfin on SteamOS is done (#249).
  - The parity-table item itself ("every cell is one of the four, each *works* names its test") was ticked in #248.
  - *Works differently* cells explained on the screen where they show: needs frontend text; the screens are ON HOLD (owner).
  - Tray item: Windows' menu readback left (route ideas: UI Automation on the taskbar/overflow, a right-click via SendInput on the icon's rect from `Shell_NotifyIconGetRect`; untried).
  - "Needs a look" mark: Linux done; the Mac Dock count needs the real app (Wails) running with a count (the runner has no Docker; ideas: the app against a fake engine + `lsappinfo info -only StatusLabel "Homelab Wizard"`); Windows' tray dot: readback route unknown.
- 0.13: only Immich share links (needs a real person to follow the link) and Kopia's line on the Backups screen (screens on hold).

## Decisions waiting on the owner

- ADR-0020 part 2: the agent runs the nightly updates (`homelab update --all` at `WATCHTOWER_SCHEDULE`), which leaves Watchtower's container (raw Docker socket) with nothing to do. Remove it, or keep it monitor-only? Nothing built.
- The recovery-kit Roadmap item (see above).
- Signed builds (certificates).
- The second line of 1.0's "restore brings back the versions" (pinned versions in `.env` for self-migrating apps) ties into the Watchtower question.
- No promises are pending in PR comments.

## Gotchas

- Scheduled Nightly runs at 09:00 UTC on main (first one today, 27 Oct, green). The week of green nights for 0.11 ends 2 Nov at the earliest.

- The life run (`real-docker` job) takes 35-40 min; it runs on PRs touching compose/, stacks/, dockerfiles/, .env.example, test/realdocker/, nightly.yml. The `catalog`, `domain`, `wire`, `proxy`, `home` jobs do NOT run on PRs: dispatch Nightly on the branch (`workflow_dispatch`, input `catalog`=0-6 or all), read the job you need, then cancel the run (its life job duplicates the PR's).
- release.yml does not run on PRs either: dispatch it on the branch with `platforms`=all|macos|windows|linux (publishing needs main or a tag, so a branch dispatch publishes nothing).
- The smoke click-through jobs sometimes spend 10+ min installing Chromium; just wait.
- Watchtower's default schedule is 04:00 UTC; the life run moves it 12 h away (#234).
- CI logs are huge: read the tail with get_job_logs, look for `--- PASS`/`ok`. Only the last 60 lines of each `homelab` call are logged.
- `merge_pull_request` needs the full 40-character SHA (`git rev-parse HEAD` in the branch's worktree), not a short one.
- Claude cloud sandbox: runs as root (bind mounts root-owned); lscr.io and ghcr.io blobs blocked (pull Docker Hub `linuxserver/*`, retag to `lscr.io/...`); the Alpine mirror is blocked (the proxy image can't build here); no container IPv6; no systemd user manager (the `jobs` Setup step fails locally only); Docker Hub via mirror.gcr.io; GitHub's artifact store (blob.core.windows.net) is blocked, so screenshots can't be downloaded.
- Merging main into a branch that adds a job at the end of nightly.yml makes git interleave jobs (a job loses its steps; GitHub then shows a zero-job run and starts no PR run). Always rebuild nightly.yml with the helper and check each job's step count.
- `homelab validate` (in `make check`) fails on leftover conflict markers.
- Testing.md's "Proven every night" paragraph: keep each sentence once and one "What it cannot reach …" at the end (helper below).

## Where I stopped

**Latest (session_01K9KWLAh1ytLmA4j9MShtRU):** #250 (tray + Mac alert on the runners) MERGED at 29859eb. On the Mac runner System Events (Accessibility) works: `TestTrayRegistersForReal` reads the helper's menu (its `last menu bar`; a Mac runner without Docker has no "Open an app") and clicks Quit; `TestDesktopAlertArrivesForReal` finds the alert's title in usernoted's db-wal. On Windows the tray test finds the icon in `HKCU\Control Panel\NotifyIconSettings` (menu NOT read back). Roadmap: alert item ticked; tray item still open (Windows menu readback left).

Earlier: #249 (Jellyfin on SteamOS as a container) MERGED at 2a93d39 (life run ok 2318 s; dispatched catalog share 4: `TestTheCatalogStarts/jellyfin-container` PASS 32.6 s). The parity table now has no *missing* cell except signed builds (owner's certificates). Opened #250 (tray-runners). On #250: read the macOS and Windows test jobs; for each new test that passes, update Roadmap 0.12 (*Proven on each runner*: the tray item, the alert) + Host.md's tray / notification rows' *Proven by* + CHANGELOG; for each that cannot work on a runner (TCC/Accessibility refused, no NotifyIconSettings), remove that test and its CI step and write why in the Roadmap item. Then merge.

Earlier: #248 (native-mac) MERGED at 164cb8a: on the Mac runner both Jellyfin tests passed first try (the cask's app is `Jellyfin`). Opened #249 (jellyfin-steamos). Queued after it: `claude/tray-runners` (pushed, 1188e6e, no PR yet): `TestTrayRegistersForReal` for macOS (homelab-tray started, its menu read through System Events/Accessibility, Quit clicked) and `TestDesktopAlertArrivesForReal` for macOS (internal/notify; looks for the title in usernoted's db `~/Library/Group Containers/group.com.apple.usernoted/db2/db` or the old DARWIN_USER_DIR one), each a macOS-only CI step. Both are EXPERIMENTS: the runner may refuse Accessibility or the db (TCC). If one cannot work, drop that test and write *can't (why)* in the Roadmap/Host instead. Main must be merged in first; then update docs (Roadmap 0.12 Proven on each runner items, Host's tray and notification rows, CHANGELOG).

Earlier: #247 (roadmap-feel) MERGED at d81a1b4. Opened #248 (native-mac). `claude/jellyfin-steamos` is committed and pushed (e53534b, main of 980e1ec merged in; make check, coverage, gosec, 508 smoke checks clean locally): open its PR after #248 merges (merge main first; docs/Host.md's two Jellyfin rows will conflict with #248's: keep #248's macOS/Linux proofs and this branch's SteamOS cells and proof). Draft its PR body from the commit message and the In progress section below.

Earlier: #246 (home-real) MERGED at 980e1ec (real-docker `ok 2268.839s`). Opened #247 (`claude/roadmap-feel`, the owner's 5 feel items). Next after #247: `claude/native-mac`, then `claude/jellyfin-steamos` (local work in progress, see below).

Before that: merged main into `claude/home-real` (conflicts resolved as described; nightly.yml rebuilt, each job keeps its steps; make check/coverage/gosec clean), pushed ae3041f, opened **draft PR #246** from `pr-drafts/home.md`. Next: wait for its CI (life job ~40 min; all other checks already green), tick the last Validation box with the evidence, set draft=false, squash-merge with the full head SHA and title ending "(#246)". Then `claude/roadmap-feel` (owner asked for it: docs-only, 5 new Roadmap items in 0.14/0.15 about the app's feel; pushed, PR not opened yet; merge main, make check, open, merge when CI green). Then `claude/native-mac`.

Owner context from this session: the owner starts testing on the real machines tonight. Asked them for `./homelab status --timing` (Windows: `.\homelab.cmd status --timing`) cold and warm on each machine, and any M/W/S steps from docs/Testing.md. When they paste results: write the timings into Roadmap 0.10's open item and update docs/Host.md's parity table / Testing.md.

Earlier:

At a clean point: #245 merged, nothing open, both remaining branches pushed. Next session: start with `claude/home-real` (merge main, resolve as above, push, open the PR from `pr-drafts/home.md`, wait ~40 min, merge), then `claude/native-mac` the same way (`pr-drafts/native.md`). Keep this file current after each.

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
