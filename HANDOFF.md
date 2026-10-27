# Handoff: Snooper42/homelab-wizard — now 0.14 only

Written 27 October 2026, ~19:50 UTC, by session https://claude.ai/code/session_01K9KWLAh1ytLmA4j9MShtRU. Main is at **f18df09** (after #254). **Open: PR #255** (`claude/works-differently-on-screen`, head fa47ec2, draft; its CI was running at handoff; local click-through 528/528 ok). Everything else is pushed. This file lives on branch `claude/handoff` (never merged; `pr-drafts/` holds old PR drafts).

## STANDING RULE FOR WHOEVER PICKS THIS UP (and for every session after)

You can't see how much usage you have left, so assume you could be cut off at any moment.
1. Keep HANDOFF.md on `claude/handoff` current: update and push it after every PR and every major step.
2. Before you run out of usage, find a good stopping point: stop starting new work, merge what's green, push everything, and do a final update of HANDOFF.md.
3. Then give me, in the chat, a ready-to-paste handoff prompt for the next Claude session. It must include HANDOFF.md's contents and repeat this same rule word for word, so every later session also stops in time and hands off the same way.

## Scope (from the owner, 27 Oct 2026)

**Work only on 0.14 ("a frontend that grows", docs/Roadmap.md).** 0.10-0.13 are finished except one item that only needs time (below). One thing at a time: **never more than one open PR**. Push after every meaningful step. The owner's goal for 0.14 is that the app *feels fast*; the three items added for that (draw the last Status at once, clicks answer at once, Motion/Transparency) matter to them most.

## First thing to do

1. **PR #255** (0.12's last item: what works differently is said on the screen where it shows). If it is still open: read its 7 checks; if green, tick its *CI on this head* box in the body (with the run link) and add "the whole click-through locally: 528 checks ok", set draft=false, squash-merge with the full 40-char head SHA and title `0.12: what works differently is said on the screen where it shows (#255)`. If red, read the failing job's log and fix on that branch. If it is already merged, go on.
2. Then start 0.14 (plan below), one PR at a time.

## Still open in 0.10-0.13 (nothing to build)

- **0.11 "A nightly CI run … Done when: the run is green for a week in a row"**: the scheduled `Nightly` workflow runs at 09:00 UTC on main; the first green night was 27 Oct, so it can be ticked on 2 Nov at the earliest. Check `list_workflow_runs` for nightly.yml with event=schedule: 7 green in a row → tick the item in docs/Roadmap.md (a docs PR, or fold the tick into a 0.14 PR's docs). A failed night opens an issue by itself; if one does, fixing it comes before 0.14 work (it is the safety net).
- Real-machine steps (M/W/S in docs/Testing.md), the 0.10 real-machine timings, and a person following Immich's share-link guide were moved by the owner to **0.15**, where they will test on real hardware. Don't hold anything for them.
- Signed builds moved to **1.0** (the owner needs an Apple Developer ID and a Windows code-signing certificate).

## Owner rules in force

- **Frontend work is allowed** (the old hold on the screens/`web/` is lifted for 0.14). The dashboard idea in "After the two goals" is still not in scope.
- Kopia stays beside Duplicati. "Pick the most safe and logical option for an at-home homelab"; ask only when it is genuinely the owner's call (use AskUserQuestion with a recommended first option).
- PRs: one theme each, branched from main, opened as **drafts**. To merge: tick the Validation box with the CI evidence (run link and the lines you read), set draft=false, **squash** with the full 40-character head SHA and a title ending "(#N)". After each merge, merge main into the next branch (never rebase or force-push).
- Before every push: `make check`, `make coverage`, `make frontend-check`, `make app-check`, gosec: `bin/gosec -quiet -exclude=G104,G204,G301,G302,G304,G306,G702,G703 ./...` (also in `app/`; install it with `GOTOOLCHAIN=$(go env GOVERSION) GOBIN=$PWD/bin go install github.com/securego/gosec/v2/cmd/gosec@v2.30.0`). For frontend changes also run the click-through locally (below).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: <your session link>`. PR bodies end with "🤖 Generated with [Claude Code](https://claude.com/claude-code)" and the session link. No model names anywhere else in commits or PRs. Plain words in docs and UI text (the repo's style: short, concrete, no jargon).
- Never skip or disable a test to get green. Read CI's `--- PASS`/`ok` lines yourself before ticking a box.
- Use your own environment's attribution lines where they differ from the above.

## 0.14 plan (docs/Roadmap.md › "0.14: a frontend that grows")

Open items, in the order I'd do them (each one PR, each must leave the click-through green):

1. **One store per screen's data** (the base for 2 and 3): "written by the engine's changes; components keep their own small state (which categories are open), so a click never reloads a screen. Done when: no screen calls the backend from a click handler except for an action, and the smoke test counts zero reloads while opening and folding every category." Today `show(name)` in `web/src/app.ts` calls `loadStatus()`/`loadBackups()`/`loadHost(); loadSetup()`/`loadSettings()` on every switch, and `loadStatus` makes ~8 backend calls (Status, watchdog, crash, savings history, protection, alerts, storage, usage, week). The engine already emits `status:changed` (app.ts ~line 1734 `EventsOn('status:changed', refreshStatus)`), plus `refresh` and `navigate`.
2. **The window draws the last Status at once when it opens, then refreshes it** (Done when: the click-through opens the app against a slow fake engine and the list is drawn before the engine answers, then updated). Needs the Go side to keep the last Status (the agent/`core.StatusNow` already shares one reading between the window and the tray; see `internal/core`) and a frontend age label ("a few seconds ago").
3. **A click answers at once**: Start/Stop/Restart/Update change their row straight away ("Starting…"), then the runtime confirms or the row goes back with the error (Done when: the click-through sees the row change before the fake backend answers, and a failed action puts the row back and says why). Status rows: `web/src/status/AppList.tsx`.
4. **Motion and Transparency in Settings › Appearance** (`web/src/settings/Appearance.tsx`, Go side `app/tray/appearance.go` `Appearance` struct + `Clean()`; regenerate `web/types/backend.d.ts`): Motion (Like the system, Less, None), Transparency (Like the system, Off); every animation/transition obeys them, including those that ignore "reduce motion" today (the meter `.meter > div` transition, the row buttons' opacity fade, the switch); Transparency Off drops the `backdrop-filter` blur (save bar, the phone companion's nav). CSS is `web/dist/style.css` (hand-written, committed). Done when: the click-through draws each screen with Motion None and finds no running animation/transition, and with Transparency Off no `backdrop-filter`.
5. **The last screens built by hand as components** (the command and log sheets, Settings' page list); `app.ts` under 400 lines (1,753 now) and no screen builds elements with `document.createElement` (app.ts has an `h()` helper that does).
6. **Shared building blocks** (card, sheet, row, segmented control, empty state) with colours as tokens only; a `frontend-check` check fails on a colour written outside the tokens; each block gets a page in the preview showing its states.
7. **An app page**: one app's state, address, logs, usage, week, settings, actions in one place (log with **Explain this**, last backup and restore test, update history with **Roll back**, who can sign in); every Status-row action also on the page; the row keeps only Open and the page.

Done already in 0.14: the job window (row per app with its bar).

## Frontend primer (how this repo's UI works)

- **The app** is Wails (Go) in `app/` (`app/app.go` holds every method the UI calls; `window.go.main.App` in JS, `go()` in app.ts). Types for the UI come from Go: `web/types/backend.d.ts` is generated — after changing a Go struct or method the UI uses, run `cd app && go test -run Bindings -update .` and commit the file.
- **The UI**: `web/src/*.ts(x)`, Preact 10 + TypeScript, bundled by esbuild into `web/dist/app.js` (**committed**; `make frontend` builds it, `make frontend-check` fails if it is stale). `web/dist/index.html` and `web/dist/style.css` are hand-written and committed. `web/src/app.ts` is the big imperative file (screens: choose, status, backups, setup, settings; `show(name)`, `load*()` functions, `mount*()` calls into components). Components: `status/AppList.tsx`, `status/Cards.tsx`, `status/Tiles.tsx`, `backups/Backups.tsx`, `setup/Host.tsx`, `setup/Checklist.tsx`, `settings/*.tsx`, `choose/Choose.tsx`, `job/Apps.tsx`, `differs.ts` (each system's words for *works differently* notes, added in #255).
- **Checks**: `make frontend-check` = `app/preview/lint.mjs` (every ID the scripts look up exists in index.html), `tsc`, `app/preview/words.mjs` (no Mac-only words outside a Mac branch: "menu bar", "Finder", "this Mac", "OrbStack", "Dock icon", "⌘"; write such text only inside `isMac ? … :`, `=== 'mac'`, or `startsWith('macOS')` branches), and the app.js freshness check.
- **The click-through** (`make app-smoke` = `node app/preview/shoot.mjs --smoke`): Playwright + Chromium against a mock backend (`app/preview/mock.js`, state in `M`, e.g. `M.cliLog[action]` lines for `Homelab(action)`), ~528 named checks drawn as Mac/Windows/GNOME/KDE/SteamOS, light and dark, with axe. A check is `{ name, screen, mock: {...overrides}, run: async (page) => {...} }` in shoot.mjs; `mock.platform` ('MacIntel', 'Win32', 'Linux x86_64') and `mock.host.os` choose the system. Run one: `SMOKE_ONLY='part of a name' node app/preview/shoot.mjs --smoke light`. Needs `npm ci` once (node_modules is not committed); Chromium is preinstalled in the cloud sandbox (`require('playwright')` works). CI runs it as `smoke (light)` and `smoke (dark)`.
- **CI on every PR** (ci.yml): `check` (make check, coverage, builds), `app` (Linux app build + forreal tray/badge/alert tests), `test (macos-latest)` and `test (windows-latest)` (Go tests + forreal tests), `security`, `smoke (light)`, `smoke (dark)`. The ~40 min real-Docker life run (nightly.yml `real-docker`) runs on PRs only when compose/, stacks/, dockerfiles/, .env.example, test/realdocker/ or nightly.yml change — 0.14 work normally won't trigger it.

## Decisions waiting on the owner (not 0.14)

- ADR-0020 part 2: the agent runs the nightly updates (`homelab update --all` at `WATCHTOWER_SCHEDULE`), which leaves Watchtower's container (raw Docker socket) with nothing to do. Remove it, or keep it monitor-only? Nothing built.
- 1.0's "restore brings back the versions" second line (pinned versions in `.env` for self-migrating apps) ties into the Watchtower question.

## What this session did (27 Oct, newest last)

#246 Home mode walked through Setup nightly against a fake tailnet (Headscale); #247 Roadmap: five "feel" items in 0.14/0.15 (owner asked); #248 Jellyfin opened from Status/after restart on the Mac runner; #249 Jellyfin on SteamOS as a container (`jellyfin-container`, `catalog.ForSteamOS`); #250 tray item on Mac (menu via System Events) and Windows (icon in NotifyIconSettings) runners + Mac alert in Notification Center's db; #251 Windows tray menu read back (SystrayClass + MN_GETHMENU); #252 Dock badge read back (`app/dock`, lsappinfo); #253 owner decisions (signing → 1.0; recovery kit reworded + `TestRecoveryKitHoldsNoSecretAndNamesWhatARestoreNeeds`; real machines → 0.15; Immich share links ticked); #254 Kopia's line on Backups; #255 (open at handoff) *works differently* said on screen. Earlier sessions: #229-#245.

## Gotchas

- `merge_pull_request` needs the full 40-character SHA (`git rev-parse HEAD`), not a short one.
- CI logs are huge: read the tail with get_job_logs, look for `--- PASS`/`ok`. The smoke jobs sometimes spend 10+ min installing Chromium; just wait.
- After merging main into a branch that touched web/src, **rebuild** `web/dist/app.js` (`make frontend`) rather than trusting git's auto-merge of the generated file; CHANGELOG.md often conflicts: keep both sides' lines in one list.
- The background notification for a PR's whole check suite arrives once all jobs finish; a single failing job also sends a `check_run.completed` event. Use `send_later` as a safety-net check-in while waiting.
- Claude cloud sandbox: runs as root; dockerd isn't started (start it with `dockerd &` if needed); Docker Hub via mirror.gcr.io; lscr.io/ghcr.io blobs blocked; GitHub's artifact store is blocked, so CI screenshots can't be downloaded.
- `homelab validate` (in `make check`) fails on leftover conflict markers. `homelab docs` regenerates the generated tables in README/docs/services when the catalog changes.
- Nightly-only jobs (`catalog`, `domain`, `wire`, `proxy`, `home`) can be dispatched on a branch (`workflow_dispatch`, input `catalog`=0-6|all); cancel the run after reading the job you need. A failed scheduled night opens an issue.

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
