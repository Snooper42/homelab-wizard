# CLAUDE.md: how every agent session works in this repository

**Read this first, every session.** Then `.claude/prompts/lanes.md`, then `.claude/prompts/owner.md`, then `.claude/prompts/reset-progress.md`. Nothing else in `.claude/prompts/` is read unless one of those four points at it.

## Stop-the-line reliability reset (the owner, Nov 27, 2026)

All feature work, visual redesigns, and layout or copy polish are **paused**. There is one lane, **Core Reliability**, and it runs the phases in `.claude/prompts/reset-progress.md` until every core flow is `VERIFIED` on the owner's Mac. Lanes R (Redesign), M (Money) and W (Phone Web) are paused; their loop files say **Paused: yes**.

## The Owner Notice Test (no pull request starts without it)

Before you branch, write one sentence that says **what the owner can click, run, or observe on their Mac that was broken or missing before**. It goes in the first line of the pull request description, under **Owner notice:**. Layout, spacing, wording and copy polish never pass this test. If you cannot write the sentence, do not open the pull request.

## Two-stage Done

| Status | Means | Who sets it |
|---|---|---|
| `MERGED` | The change is on main, with CI green against fakes (fake `docker`, fake `launchctl`, temp folders). It proves the logic, not the machine. | The agent, when the pull request merges |
| `READY FOR MAC VERIFICATION` | `MERGED`, and the owner has the exact commands and expected output to check it on the real Mac (`.claude/prompts/owner.md`, *Run This On Your Mac Tonight*). | The agent |
| `VERIFIED` | The owner ran it on real hardware and pasted the output back, and it matched. | **Only the owner's pasted output.** An agent never writes `VERIFIED` on its own say-so. |

`docs/Known Issues.md` uses these words in its Status column for every real-hardware item.

## Rules that never bend

1. **Never weaken a quality gate.** Never lower a floor in `coverage-floors.txt`, never skip, delete or `t.Skip` a test to get green, never loosen an assertion, never disable a linter, `go vet`, `govulncheck` or `gosec` rule (beyond `GOSEC_EXCLUDE` as it stands, which `docs/Security.md` explains), never mark a CI job `continue-on-error`. Change an expected value only after proving the new one is right.
2. **No busywork.** No pull request for wording tweaks, spacing or layout polish, new catalog apps, or speculative refactors. **When the only items left in your backlog are polish, stop and escalate** in `owner.md` under *Waiting on you*. Do not invent work to stay busy. Do not pad coverage with shallow tests: a test asserts a real behaviour, an error path, or an edge case.
3. **Merged is not Verified.** CI passing against a fake `docker` proves unit logic only. Never mark a real-hardware item `VERIFIED`.
4. **Preserve contracts.** Every versioned `--json` output (`cmd/homelab/contract_test.go`) keeps its fields and meaning. Add fields only; never rename or drop one.
5. **Secrets stay secret.** Keys, tokens and passwords live in `.env` (0600) only: never in a log, an error, a page, an alert, `homelab report`, an export, an Ollama prompt, a test fixture, or a pull request.
6. **Destructive actions need the machine itself.** No phone, web page or remote caller can wipe the homelab, delete app data, or delete backups. Those need someone at the host and an explicit CLI confirmation (`--apply`, and the command's own prompt).
7. **Track state.** After every phase or pull request, update `.claude/prompts/reset-progress.md`: completed pull requests, open risks, the exact files touched, and the next concrete step.
8. **Decide the small things.** For a minor engineering choice, take the safest, most conservative option, write the assumption in `owner.md` under *Assumptions the agents made*, and keep going. Stop and ask only when an action could risk real household data or needs a secret or credential.
9. **The checks every pull request passes:** `go test -race ./...`, `go vet ./...` (and `-tags forreal`), `make coverage` against `coverage-floors.txt`, `make security` (govulncheck and gosec), `go run ./cmd/homelab --root . validate`, and every CI job on the pull request.
10. **Never commit to main directly.** No model name in a commit, a pull request, or a file.

## Scope freeze

Frozen until the owner lifts it here. Fix only a critical security or data-loss bug in them:

- The Swift iOS and iPadOS app (`apple-client/`).
- Finances (`internal/finance`, `app/finance*.go`, `web/src/finances`, `mobile/finance`).
- Ollama log explanations (`internal/explain`).
- New catalog apps (`compose/`, `stacks/`, `services/`).

## Locked-in owner decisions (Nov 27, 2026)

- **Phone web wipe:** never. A phone or web page cannot wipe the homelab, app data, or backups.
- **30-day CPU and memory history for Analytics:** not built. Health monitoring answers "is something broken?" and gives plain-English disk-full runway warnings.
- **"Move the apps' data…" button:** deferred. No live volume migration now.

## Where things are

- CLI: `cmd/homelab` (one `homelab` binary); packages under `internal/`; the desktop app is its own module in `app/`.
- Checks: `make check`, `make coverage`, `make security`; `CONTRIBUTING.md` has the table of what to run for what you changed.
- Known real-hardware gaps: `docs/Known Issues.md`.
