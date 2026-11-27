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
| 2A: disable future attribution, scrub allowed files | PR 1 open: #962 |
| Owner's ask, Nov 27: bring the repo's picture of the app up to date | In #962: `docs/Where Things Stand.md` (new), README's Beta note, both docs indexes. Release history split waits for Stage 3 (needs `release.yml`'s notes to skip moved lines). Version stamps: by design (they track `VERSION`), no change |
| 2B onward, 3, 4 | Waiting: the handoff's text stopped partway through Phase 2A; the rest is needed before starting |

## Pull requests

### PR 1: attribution off for future sessions (Phase 2A)

- **Files:** `.claude/settings.json` (new: `attribution.commit` and `attribution.pr` empty, `sessionUrl` false; no `includeCoAuthoredBy` key existed), `.claude/prompts/hygiene-progress.md` (new).
- **Scrub survey** (searched for co-author lines, claude.ai links, "Claude Code", "Anthropic", "generated with", "AI-assisted"):
  - Public docs (`README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/`): no claim the code is AI-written. Nothing to remove.
  - **Kept, product functionality:** Finances' payee cleanup of the card merchant *ANTHROPIC CLAUDE* (`web/src/finances/payees.ts`, `Mark.tsx`, `apple-client/...PayeeVectors.json`, `PayeeLogoTests.swift`, `make-payee-logos.mjs`, `app/preview/shoot.mjs`, a `CHANGELOG.md` line). The Ollama log explanations: untouched.
  - **Candidates, not changed:** claude.ai canvas links and "Claude Code" mentions in history prompt files (`handoff.md`, `apple-loop.md`); `docs/Usability.md` line 7 names "Account 3, `.claude/prompts/audit-loop.md`". `owner.md` line 11 is in PR #961 (deferred below).

## Deferred Until Account 1 Finishes

Files PR #961 touches (read-only until it merges or closes): `CLAUDE.md`, `.claude/prompts/lanes.md`, `owner.md`, `reset-progress.md`, `redesign-loop.md`, `money-loop.md`, `web-loop.md`, `setup-loop.md`, `quality-loop.md`, `.github/pull_request_template.md`, `docs/Known Issues.md`.

- `owner.md` line 11: "open Claude Code on the web" (an instruction to the owner, not an authorship claim; likely stays).

## Next concrete step

Merge PR 1 on green CI. Then get the rest of the handoff (Phase 2A's remaining steps, 2B onward, Stages 3 and 4) and continue from there.
