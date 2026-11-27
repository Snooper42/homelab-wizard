# Reliability reset: progress

The one backlog during the stop-the-line reliability reset (`CLAUDE.md`, `lanes.md`). Updated after every phase and every pull request: what's done, what's risky, the exact files touched, and the next concrete step. Status words are `CLAUDE.md`'s: `MERGED`, `READY FOR MAC VERIFICATION`, `VERIFIED` (the owner's pasted output only).

## Phases

| Phase | What | State |
|---|---|---|
| 1 | Governance: `CLAUDE.md`, one Core Reliability lane, Owner Notice Test, two-stage Done, anti-shortcut rules, scope freeze | `MERGED` (#961, Nov 27) |
| 2 | SRE audit (`docs/SRE-Audit-2026-11.md`) and fixes for every Critical and High finding | PR 2 (C1, H1 to H6 fixed; M1 to M8 recorded) |
| 3 | Known Issues' real-hardware gaps, one PR per flow: backups and blind restore; `launchd` jobs and start at boot; updates and rollback; app wiring against live Docker | Flow 1 committed locally (PR 3, opens once #963 merges) |
| 4 | Live Mac verification runner; Gold Tier catalog; disk-full runway warning | Not started |
| 5 | The owner's handoff: *Run This On Your Mac Tonight* at the top of `owner.md` | Not started |

## Pull requests

### PR 1: governance (Phase 1), #961, merged

- **Owner notice:** none on the Mac: this pull request changes only how the agents work. It is the one governance exception the reset asks for.
- **Files:** `CLAUDE.md` (new), `.claude/prompts/lanes.md`, `.claude/prompts/owner.md`, `.claude/prompts/reset-progress.md` (new), `.claude/prompts/{redesign,money,web,setup,quality}-loop.md` (**Paused: yes**), `docs/Known Issues.md` (status vocabulary), `.github/pull_request_template.md` (an **Owner notice** line).

### PR 2: SRE audit and its Critical and High fixes (Phase 2)

- **Owner notice:** a phone's web page no longer offers *Take the homelab off this machine*. `homelab rollback` now stops, with the app left stopped, instead of reporting a half-restored database as fine. The nightly backup alerts when the backup drive or the photos' drive is unplugged.
- **Fixed:** C1 (the phone's web page wipe), H1 (dump loads checked), H2 (a partial put-back leaves the app stopped), H3 (only this update's dump is kept), H4 (`logs --explain` hides `.env` values), H5 and H6 (the nightly preflight).
- **Files:** `docs/SRE-Audit-2026-11.md` (new), `docs/Security.md`, `CHANGELOG.md`, `cmd/homelab/{serve_web_settings,serve_web,db,keep,rollback,main,jobs,notes}.go`, `internal/duplicati/homelab.go`; tests `cmd/homelab/{nowipe,rollback_safety}_test.go` (new), `cmd/homelab/{fakebin,explainlogs,serve_web}_test.go`, `internal/duplicati/preflight_test.go` (new); `web/src/screens/settings.ts`, `web/dist/app.js`, `app/preview/shoot.mjs` (one phone case added); `internal/media/media_test.go` (a data race in the test itself, `TestExecuteStopsOnBattery`, which `go test -race ./...` found).

### PR 3: backups and blind restore on the Mac (Phase 3, flow 1)

- **Owner notice:** on a Mac whose Proton Drive keeps the backup online only, `homelab rebuild` and `homelab restore-test --auto` now download those files first and say *downloaded N file(s)*, instead of Duplicati failing or stalling on placeholders.
- **Files:** `internal/backup/{hydrate,dataless_darwin,dataless_other}.go` (new) and their tests `internal/backup/{hydrate,hydrate_unix}_test.go`; `cmd/homelab/{rebuild,jobs}.go`, `cmd/homelab/hydrate_test.go` (new); `docs/Known Issues.md` (ISSUE-0003 and ISSUE-0016: READY FOR MAC VERIFICATION); `CHANGELOG.md`.

## Open risks

- **Each Phase 2 fix is `MERGED` at most:** it is proven against a fake `docker` and fake `psql`. A real Immich or Paperless rollback across a schema change (H1) and a real unplugged drive (H5) are for the Mac run in Phase 4.
- **Duplicati still runs its own schedule:** the preflight alerts, but cannot stop the 1 AM Photos job from backing up an empty folder. The follow-up is a `run-script-before-required` guard on large jobs, which needs the real image (Phase 3, backups).
- **M1 to M8** in the audit are recorded, not fixed.
- **`make coverage` here** reads `internal/ports` at 82.7% (floor 83%). That package is unchanged, and this container runs as root, so its not-root branch goes unrun here. CI, which is not root, measures it. The floor is not lowered.
- `lanes.md` rule 6 still applies to phone-facing changes. PR 2 only removes powers, as the owner decided on Nov 27.

## Next concrete step

Phase 3, flow 1 (backups and blind restore): trace `homelab rebuild` and `restore-test` on macOS, the launchd environment, Proton Drive's File Provider folder, Duplicati's large-job guard; fix the real failure modes; mark ISSUE-0003 and ISSUE-0016 `READY FOR MAC VERIFICATION`.
