# Handoff: Snooper42/homelab-wizard

Written 27 October 2026, ~14:15 UTC, by the session that is stopping here. Main is at **8f6b6f3** (after #245). **No PR is open.** Everything below is pushed.

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

#229-#238 (earlier), then today: **#239** `domain setup` against real NPM/AdGuard (`domain` nightly job); **#240** ISSUE-0015 `homelab wire` against the real *arr apps (`wire` job); **#241** ISSUE-0001 proxy image built + CrowdSec ban gets 403 (`proxy` job); **#242** parity rows name real-machine steps (M16-18, W16-20, S14-16); **#243** each system's own words for opening `.env` / removing the app; **#244** release builds opened on each runner (`app/packaging/dmg-smoke.sh`, `windows-smoke.ps1`; release.yml run 40517316882 on main passed with them); **#245** the app's own update keeps window/phones/jobs (`TestAnUpdateKeepsTheWindowThePhonesAndTheJobs`) + an AppImage's jobs get the new CLI (`core.JobsCLIBehind`).

## Next: two ready branches, open their PRs one at a time

Both are pushed and proven as far as they can be without a PR. PR descriptions are drafted in `pr-drafts/` on this branch (`home.md`, `native.md`); tick their CI box when green.

1. **`claude/home-real`** (head f74afad) — 0.11 "The same run in Home mode, with Tailscale replaced by a fake tailnet". `test/realdocker/home_test.go` (`TestHomeModeSetupWalked`, `REALDOCKER_HOME=1`), nightly `home` job (sets lingering + XDG_RUNTIME_DIR/DBUS for systemd user units), Headscale 0.29.6 as the tailnet, `TAILSCALE_EXTRA_ARGS` (compose/network.yaml `TS_EXTRA_ARGS`, .env.example, docs), fixes: `tailnet setup/login` wait up to a minute for the link or the auth key's sign-in; `signups open` names the tailnet address in Home mode (`householdAddress`). Roadmap ticked, Testing sentence, CHANGELOG. **Proven:** dispatched Nightly runs 40494114422 (c80f27a) and 40506439258 (f74afad): `home` job `--- PASS` (~700 s; ~10 min of it is `signups open` counting down). **To do:** merge main into it. Expect conflicts in `.github/workflows/nightly.yml` (rebuild with the helper below: `python3 addjob.py f74afad home`), `docs/Roadmap.md` (keep main's ticks + this branch's Home-mode tick and Done line), `docs/Testing.md` (main's paragraph + this branch's "Beside it, the `home` job …" sentence, then the Testing helper below), maybe `CHANGELOG.md` (keep both sides' lines, one list, no blank line inside). Then `make check`, push, open the PR. Its CI runs the life job (~40 min) because it touches compose/ and test/realdocker/.
2. **`claude/native-mac`** (head 0ca1d00) — 0.12 parity table. `app/native_forreal_darwin_test.go` (`TestNativeAppOpensForReal`) and `cmd/homelab/native_forreal_darwin_test.go` (`TestNativeAppsOpenAfterARestartForReal`) + a macOS-only CI step in ci.yml (`brew install --cask jellyfin`, clear quarantine, run both). docs/Host.md's two Jellyfin rows name these tests; Frigate's Linux detector cell is now *works differently* (by hand); Roadmap parity item ticked (every cell is works / works differently / missing / can't, each *works* names its test). **NOT proven yet**: CI only runs on PRs, and this is the first macOS run. Unverified guesses: the cask's app name (code tries "Jellyfin" and "Jellyfin Server"), that it starts headless on the runner, `/health` saying "Healthy". If it fails, read the macOS job log and fix; if it can't work on a runner, untick the Roadmap item and say why. Merge main first (CHANGELOG may conflict).

## What is left for 0.11 / 0.12 / 0.13 after those two

- 0.11: **nightly green for a week** (only time; check the scheduled `Nightly` runs on main; a failed night opens an issue). **Recovery kit tested: WAITING ON OWNER** (the kit holds no secrets by design; the item's wording conflicts).
- 0.12:
  - *Missing* cells: **Jellyfin on SteamOS** (plan: a container Jellyfin used on SteamOS only, AMD graphics via /dev/dri; needs a container fallback for a native app in the catalog, sizeable) and **signed builds** (WAITING ON OWNER: Apple Developer ID + Windows code-signing certificate, docs/Releasing.md).
  - *Works differently* cells explained on the screen where they show: needs frontend text, and the screens are ON HOLD (owner).
  - Tray item / needs-a-look mark / alert on the macOS and Windows runners: Linux done (and the Windows toast). Ideas: the Mac Dock badge can't be set from a Go test (no Cocoa run loop); the real app on the Mac runner has no Docker, so no count; a route is the app against a fake engine + `lsappinfo info -only StatusLabel "Homelab Wizard"`. The Mac alert's record is in `$(getconf DARWIN_USER_DIR)/com.apple.notificationcenter/db2/db` (may need Full Disk Access; untried). Windows tray menu readback: no route found yet.
- 0.13: only Immich share links (needs a real person to follow the link) and Kopia's line on the Backups screen (screens on hold).

## Decisions waiting on the owner

- ADR-0020 part 2: the agent runs the nightly updates (`homelab update --all` at `WATCHTOWER_SCHEDULE`), which leaves Watchtower's container (raw Docker socket) with nothing to do. Remove it, or keep it monitor-only? Nothing built.
- The recovery-kit Roadmap item (see above).
- Signed builds (certificates).
- The second line of 1.0's "restore brings back the versions" (pinned versions in `.env` for self-migrating apps) ties into the Watchtower question.
- No promises are pending in PR comments.

## Gotchas

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
