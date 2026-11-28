---
version: 0.17.0
---

# SRE audit, November 2026

The reliability reset's Phase 2 (`CLAUDE.md`). Unit coverage numbers were ignored. Each path was read end to end, as someone protecting a household's photos, passwords, documents and finances would read it. Citations are `file:line` on `main` at `e04638b`, where the finding was made. The **Fixed** line names the regression test that holds the fix.

Every fix here is `MERGED` at most. None is `VERIFIED` until the owner runs it on the Mac (`docs/Known Issues.md`).

## Ranked findings

| ID | Severity | Area | Finding | State |
|---|---|---|---|---|
| C1 | Critical | Security | The phone's web page could wipe the homelab, its data and its backups | Fixed |
| H1 | High | Rollback | A database dump that half-loads is reported as loaded | Fixed |
| H2 | High | Rollback | A rollback that put data back only in part starts the app on the mix | Fixed |
| H3 | High | Rollback | The pre-update copy can keep an old dump, which a rollback then loads | Fixed |
| H4 | High | Secrets | `homelab logs --explain` sends `.env` values to the model | Fixed |
| H5 | High | Backups | An unplugged media drive is backed up as every photo deleted, silently | Fixed (detected, alerted, and Duplicati's own run refused) |
| H6 | High | Backups | A missing backup folder is not caught before the night's backups | Fixed (detected and alerted) |
| M1 | Medium | Backups | Dumps and archives are renamed into place without `fsync` | Fixed (Nov 28) |
| M2 | Medium | Restore | Putting a volume back empties it before extracting | Fixed (Nov 28) |
| M3 | Medium | Rollback | Folders and volumes over `UPDATE_COPY_LIMIT` are not copied before an update | Open (by design, said) |
| M4 | Medium | Restore | The nightly restore test samples Homelab AppData only | Open |
| M5 | Medium | Secrets | `OLLAMA_HOST` can point off the machine while the CLI says "it stays here" | Open |
| M6 | Medium | Security | The Beszel agent holds the raw Docker socket on the host network | Open (documented, N18) |
| M7 | Medium | Backups | Duplicati is `:latest`, unpinned | Open (ISSUE-0016) |
| M8 | Medium | Host | `diskspace.Mounted` is true on macOS for any folder that exists | Fixed (Nov 28) |

### C1: the phone's web page could wipe the homelab (Critical)

- **Where:** `cmd/homelab/serve_web_settings.go:248` (`UninstallPlan`) and `:260` (`Uninstall`) ran `homelab uninstall --data --folder --backups --everything-else --apply` for any device allowed to change things, from #916. `cmd/homelab/serve_web.go:294` let the web page's `Homelab` action run `cleanup --volumes --apply`, which deletes old containers' named volumes.
- **Failure:** a phone left unlocked at home, or a stolen device token used over Tailscale, deletes every app's data and every backup. Nothing could bring it back.
- **Fixed:** both methods are gone. `cleanup --volumes` is refused before anything runs, and the web page no longer shows the card. The owner's decision (Nov 27) is written in `CLAUDE.md`. Held by `TestNoWipeFromThePhone` and `TestServedCodeNamesNoDeletingCommand` (a static check of every `cmd/homelab/serve*.go`), plus the smoke case *On a phone that may change things, This machine has no Take the homelab off this machine*. The computer's own Settings keeps it, behind its typed confirmation.

### H1: a database dump that half-loads reads as loaded (High)

- **Where:** `cmd/homelab/db.go:241-251`. `restoreDump` piped the dump into `psql` and trusted its exit code, but `psql` without `ON_ERROR_STOP` exits 0 after errors. It is used by rollback (`keep.go`, `putBack`), by `homelab db upgrade`, and by the blind restore (`move.go`, `restoreDatabases`, run by `homelab rebuild`).
- **Failure:** a schema migration ran (Immich, Paperless-ngx), then a rollback. If an app session still holds the database, `DROP DATABASE` fails. The dump's tables then collide with the migrated ones (`relation already exists`, duplicate keys). The result is a database that is neither the dump nor today's, reported as *its data is as it was before the update*. Immich's dumps also fail to build some indexes unless the dump's empty `search_path` is relaxed, which Immich's own restore instructions do.
- **Fixed:** other sessions are ended first (`pg_terminate_backend`), and the empty `search_path` line is rewritten as Immich documents. Any `ERROR:` or `FATAL:` line fails the load, except the two that every `pg_dumpall --clean` load prints: the connecting role cannot drop itself, and so already exists. Held by `TestDumpErrors`, `TestSearchPathRelaxed` and `TestRestoreDumpChecksThatItLoaded`.
- **Not achievable here:** a truly atomic restore (load into a new cluster, then swap). The safe outcome now is *detected and stopped* (H2), with today's data set aside.
- **Proven against real PostgreSQL 18 (Nov 28):** the live check's *A database put back after a schema change* dumps a database, migrates it (a new column, table and row), holds an app's session open, and loads the dump back through `restoreDump`: the database is exactly the one from before. With session-ending removed from `restoreDump`, the same run fails with *database "household" is being accessed by other users*, which the old code reported as loaded. The nightly workflow's `live` job runs it every night, with a round on Immich's own database image.

### H2: a partial put-back starts the app on the mix (High)

- **Where:** `cmd/homelab/rollback.go:135-137` (`doRollback`) and `:273` (`restoreData`). After `putBack` failed (`keep.go:230` loading a volume, or the dump load), the app was still started with `up --force-recreate`.
- **Failure:** a volume half-extracted, or a database half-loaded, plus the older image, which may run its own migrations or write on top. That can damage the data further.
- **Fixed:** `putBack` marks an error raised after it changed anything (`errPartlyPutBack`). The rollback then leaves the app stopped and does not record it as rolled back, so it can be tried again. It says where today's data was set aside (`recovery-staging/rolled-back/<app>/<time>`). Held by `TestARollbackThatPutsBackOnlyPartLeavesTheAppStopped`, which covers both `rollback` and `rollback --data`.

### H3: the pre-update copy can keep an old dump (High)

- **Where:** `cmd/homelab/keep.go:155`. `copyBeforeUpdate` linked the newest file in `recovery-staging/databases/<db>/` as the dump "from just before the update". `beforeUpdate` (`rollback.go:287`) dumps only databases that are running (`dumpsFor`, `rollback.go:328`).
- **Failure:** the database was stopped at update time, so no new dump was made and last week's was kept. A rollback then loads last week's database over today's: every document, photo record or password entry since then is gone, and it is reported as success.
- **Fixed:** only a dump made since this command began dumping (`homelab.dumpsSince`) is kept. Any other is listed as *not kept*, and the rollback leaves that database as it is. Held by `TestAStaleDumpIsNotKeptAsTheOneBeforeAnUpdate`.

### H4: `homelab logs --explain` sends `.env` values to the model (High)

- **Where:** `cmd/homelab/notes.go:151` passed the raw log to `explain.Explain`, which only pattern-redacts (`internal/explain/explain.go:195`). The desktop app (`app/app.go:1882`) and the phone (`cmd/homelab/serve.go:1318`) also hide `.env`'s values. The CLI did not.
- **Failure:** an app that prints a password bare (a connection error quoting it, say) puts it in the model's context and Ollama's own logs.
- **Fixed:** the CLI uses the same redaction as the phone (`phoneLog`). Held by `TestExplainLogsSendsNoSecretFromEnv`.

### H5 and H6: backups that are wrong without Duplicati failing (High)

- **Where:** `compose/system.yaml:53-58` mounts `IMMICH_UPLOAD_LOCATION`, `MEDIA_ROOT/Books` and `BACKUP_DESTINATION` with the short syntax, which makes a missing host folder as an empty one. The nightly backup (`cmd/homelab/jobs.go`, `backup`) never checked either side.
- **Failure:**
  - **H5:** the media drive is unplugged, and Duplicati's Homelab Photos job backs up Docker's empty folder: every photo is recorded as deleted, and the job succeeds. Smart retention keeps older versions for up to a year, but the *newest* version, which a blind restore takes, is empty.
  - **H6:** the backup drive is unplugged, or Proton Drive is not running. The backups have nowhere real to go.
- **Fixed:** the nightly backup now runs `duplicati.Preflight` when Duplicati is installed. It fails, and therefore alerts, when the backup folder is not there, or when a large job's folder here is empty or missing while its backup holds files. A new homelab with nothing backed up yet is not flagged. Held by `TestPreflight` and `TestBackupFailsWhenDuplicatiWouldBackUpNothing`.
- **Duplicati's own run is now stopped too (Nov 28):** each large job runs a guard before it backs up (`run-script-before-required`, `internal/duplicati/guard.go`), which refuses while the job's folder is empty or holds only hidden files. `duplicati setup` puts it on new jobs, and the nightly backup adds it to jobs made before. Proven against the real `linuxserver/duplicati` image and server: with the folder empty, no new version, and the job's last error the guard's; with a photo in it, the next version as before. Writing a job back keeps its passphrase (Duplicati returns it masked): its next backup opened with the real passphrase and refused the mask.

### Medium (recorded, not fixed in the reset)

- **M1:** `internal/backup/backup.go:66` and `:125` rename a dump into place without `fsync`. After a power cut, a "complete" dump can be zero bytes on some file systems. APFS is less exposed than ext4.
- **M2:** `cmd/homelab/move.go:336` runs `rm -rf /v/*` and then `tar xzf`. A failed extract leaves the volume half full. It is mitigated: `putBack` sets today's data aside first, and H2 now stops the app.
- **M3:** `cmd/homelab/keep.go:23`: a folder or volume over 2 GB is not copied before an update. A rollback then restores the image and the database dump only. This is said in the update's output.
- **M4:** `cmd/homelab/jobs.go:436`: `restore-test --auto` defaults to Homelab AppData. The Databases, Secrets and Photos jobs are proven restorable only by the nightly CI `rebuild` job, never on the household's own backups.
- **M5:** `internal/explain/explain.go:33`: `OLLAMA_HOST` may be any URL. The log is redacted, but it then leaves the machine over plain HTTP, while the CLI says "it stays here".
- **M6:** `stacks/beszel/compose.yaml:69`: `:ro` on a socket does not limit the Docker API. The agent can do anything Docker can. It is pinned and documented (N18).
- **M7:** `compose/system.yaml:34`: `lscr.io/linuxserver/duplicati:latest` can change its API under the homelab (ISSUE-0016).
- **M8:** `internal/diskspace/diskspace.go:206`: on macOS a drive counts as mounted whenever its folder exists. An empty `/Volumes/<name>` left behind reads as the drive.

**Fixed after the audit (Nov 28):**
- **M1:** each dump and archive is written to the disk (`fsync`) before it is renamed into place, and its folder after (`internal/backup/backup.go`, `syncClose` and `keep`).
- **M2:** putting a volume back reads the archive into a folder beside the contents first. Only once it has read whole do the old contents go and the new move in (`cmd/homelab/move.go`, `loadScript`, also used by `db upgrade`'s way back). Proven in `alpine:3` against real Docker: an archive cut short left the volume as it was.
- **M8:** on a Mac, a drive counts as mounted only when its folder is on another device from `/Volumes`, as on Linux. The macOS CI job's real disk image (`TestExternalDriveForReal`) checks it attached and detached.

## Area notes

### 1. Backups and restore

The pipeline: the agent's nightly `homelab backup` dumps each database (temp file, completion marker checked, renamed: `internal/backup/backup.go:38`). It archives the named volumes (read back before they are kept), copies `.env` with a hash check, and copies the homelab's own records into `recovery-staging`. Duplicati's jobs, on their own schedule inside the container, take `recovery-staging` and `data/appdata` to `BACKUP_DESTINATION`, AES-encrypted, with smart retention. `restore-test --auto` restores a sample and hashes it against the live files.

Sound: a stopped database fails the night (`jobs.go`, `NotRunningLine`), dumps are never half-written, and the Secrets job has its own passphrase. Weak before this audit: H5, H6, M1 and M4. Duplicati writing into Proton Drive's File Provider folder is still unproven on the Mac (ISSUE-0003).

**Duplicati or Restic?** An objective assessment; nothing is migrated.

| | Duplicati 2 (today) | Restic |
|---|---|---|
| Repository format | Local SQLite database plus remote blocks. The local database must match the remote, or it needs a slow *repair* (ISSUE-0016's rebuild path) | Content-addressed, no local state needed. Any machine with the password reads it |
| Interrupted backup | Can leave the local database inconsistent. The next run may refuse until repaired | Safe: a snapshot exists only once its index is written. Leftover packs are pruned |
| Verification | `test` samples remote volumes | `restic check --read-data-subset=n%` reads real data. `restore --verify` exists in 0.17 and later |
| Cloud folders (Proton Drive) | Writes through a mounted folder, the same File Provider risk as today | The same folder risk. Restic has no Proton backend, though rclone can serve one |
| Scheduling | Its own scheduler, in the container: the homelab cannot block a run (H5's gap) | Run by the homelab's agent: a preflight can stop the run itself |
| Restore without the app | Needs Duplicati's CLI and image (`homelab rebuild` runs it) | One static binary |
| Already in the homelab | Every job, Setup, Backups, `rebuild`, the nightly CI | Kopia already gives a second, Restic-like copy (`internal/kopia`) |

**Verdict:** Restic, or Kopia, which the homelab already ships as its second engine, is the safer design. It has no local state to drift, interrupted runs are safe, and the homelab decides when a run happens, so a preflight can block it. **Migration effort, estimated:** about 4 to 6 focused pull requests:
1. Make the engine choosable per job, behind the existing `backup.Overview` and `Sources`.
2. Have the agent drive snapshots, with the Preflight gating them.
3. Point the restore test and `rebuild` at the new engine.
4. Add Setup's step and the Backups screen's engine line.
5. Run both engines side by side for a month, then retire Duplicati.

The household's existing Duplicati history is kept read-only, for its retention year. **Recommendation:** promote Kopia, which already exists, rather than add Restic. The go/no-go is the owner's (`.claude/prompts/owner.md`).

### 2. Stateful updates and rollback

The flow:
1. `homelab update` dumps the running databases (`beforeUpdate`), then pulls.
2. For each app whose image changed, it stops the app and archives its writable folders and its project's named volumes (up to `UPDATE_COPY_LIMIT`). It also links that update's dumps (`copyBeforeUpdate`), then starts the new image.
3. `homelab rollback` sets today's data aside, puts the copy back, loads the dumps (`putBack`) and starts the older image.

**Does a rollback atomically restore the pre-update dump after a migration ran?** Before this audit: no, and it said yes. A half-loaded dump read as loaded (H1), the app started on it anyway (H2), and the dump could be from the wrong day (H3). Now each failure is detected, the app is left stopped, and today's data is kept. It is still not a single atomic swap; see H1. For Vaultwarden (SQLite), the database file is in its folder's archive, so it goes back with the folder. Immich keeps its photos on the media drive, untouched by a rollback, with their records in Postgres (H1, H3).

### 3. Security and privilege boundaries

- **Docker socket:** only `docker-socket-proxy` (containers and info only, its own network; `compose/system.yaml:199`) and the Beszel agent (M6) hold it.
- **Phone pairing:** 8-character codes from a 31-letter alphabet (about 40 bits), single-use, 10 minutes, hashed at rest. Too many wrong codes locks pairing (`internal/companion/server.go:387`). Tokens are 32 random bytes, hashed.
- **Read-only phones:** `allowed()` (`internal/companion/server.go:519`) is the one gate for the home network and the tunnel. A `Change` method needs `CanChange` and an encrypted link, and a phone paired over plain HTTP is marked look-only. A scan of every served method for side effects without `Change: true` found only reads and Finances' own edit level.
- **What a phone can delete:** after C1, nothing that holds data. Its most destructive actions are rollback (today's data set aside, never deleted) and `remove` (containers only, with a backup first).
- **Secrets in logs, exports and Ollama:** `homelab report` hides `.env` values and token shapes (`cmd/homelab/report.go:220`), and so do the phone's logs (`serve.go:1318`), the desktop's model calls (`app/app.go:1882`) and now the CLI's (H4). The recovery kit names the passphrases and never holds them (`recoverykit_test.go`).

### 4. Mock blind spots

These tests pass only because something real is faked. Each is a reason the Mac run (Phase 4) exists:

- **`tar` through Docker:** the fake `docker run … tar czf` writes a one-file archive (`cmd/homelab/fakebin_test.go`), and `tar xzf` always succeeds unless `FAKE_LOAD_FAILS` is set. Real ownership, permissions, OrbStack's UID mapping and large volumes are never exercised.
- **`psql` and `pg_dumpall`:** the fake dump is two lines and `psql` prints what the test says. No test loads a real dump across a real schema change; the nightly's schema-change proof is ntfy, which uses SQLite.
- **Duplicati:** unit tests fake its HTTP API. The nightly uses the real image on Linux, never Proton Drive's File Provider folder on macOS (ISSUE-0003).
- **launchd:** `JobsInstalledForReal` runs on a CI Mac without a logged-in GUI session, Homebrew's `PATH` or OrbStack's `docker` shim (ISSUE-0005).
- **Drives:** `diskspace.Mounted` is faked by temp folders. On macOS any existing folder counts (M8). An unplugged drive is simulated by a missing folder, never by a real unmount.
- **Phones:** methods are called directly with a `companion.Device` in the context. The real Tailscale HTTPS path and a real browser's stored token are not.
