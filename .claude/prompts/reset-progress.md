# Reliability reset: progress

The one backlog during the stop-the-line reliability reset (`CLAUDE.md`, `lanes.md`). Updated after every phase and every pull request: what's done, what's risky, the exact files touched, and the next concrete step. Status words are `CLAUDE.md`'s: `MERGED`, `READY FOR MAC VERIFICATION`, `VERIFIED` (the owner's pasted output only).

## Phases

| Phase | What | State |
|---|---|---|
| 1 | Governance: `CLAUDE.md`, one Core Reliability lane, Owner Notice Test, two-stage Done, anti-shortcut rules, scope freeze | In review (PR 1) |
| 2 | SRE audit (`docs/SRE-Audit-2026-11.md`) and fixes for every Critical and High finding | Not started |
| 3 | Known Issues' real-hardware gaps, one PR per flow: backups and blind restore; `launchd` jobs and start at boot; updates and rollback; app wiring against live Docker | Not started |
| 4 | Live Mac verification runner; Gold Tier catalog; disk-full runway warning | Not started |
| 5 | The owner's handoff: *Run This On Your Mac Tonight* at the top of `owner.md` | Not started |

## Pull requests

### PR 1: governance (Phase 1)

- **Owner notice:** none on the Mac: this pull request changes only how the agents work. It is the one governance exception the reset asks for.
- **Files:** `CLAUDE.md` (new), `.claude/prompts/lanes.md`, `.claude/prompts/owner.md`, `.claude/prompts/reset-progress.md` (new), `.claude/prompts/{redesign,money,web,setup,quality}-loop.md` (**Paused: yes**), `docs/Known Issues.md` (status vocabulary), `.github/pull_request_template.md` (an **Owner notice** line).

## Open risks

- **Critical, live on main:** the phone's web page can run `homelab uninstall --data --backups --apply` (`cmd/homelab/serve_web_settings.go`, `Uninstall` and `UninstallPlan`, from #916) for any phone allowed to change things. It is the first fix in Phase 2.
- `lanes.md` rule 6 (the review of a pull request that changes what a phone may call) still applies. The owner's Nov 27 decision ("hard no") covers removing the wipe. Any other phone-facing change waits for the owner's yes in `owner.md`.

## Next concrete step

Phase 2: remove `Uninstall` and `UninstallPlan` from the phone's methods, with a test that no method reachable from a phone or the web page can delete data or backups. Then audit backups and restore, updates and rollback, the security boundaries, and the mock blind spots, into `docs/SRE-Audit-2026-11.md`.
