# Loop Q: Quality

**Started by** the accounts' start lines in `lanes.md`: the table *Which account runs what* says which account runs lane Q when.

**Paused:** no (account C runs it from Tue Nov 24, 9 PM; lane S does Q0 before then)

## The job

What ships works on the owner's real machine, nothing leaks, and media automation keeps getting easier. Three kinds of work, in this order every session:

1. **Something broken comes first:**
   - main's CI red
   - a nightly run that failed (an issue titled *Nightly run failed on …*)
   - a line under **Doesn't work or bugs me** in `owner.md`
2. **Reviews:** every open pull request whose description starts **Needs Q's review: yes** (lanes.md rule 6). Review its current head and comment **Q review: OK**, or what must change and why. End the comment with the footer the session gives you. Review again after each push.
3. **Your list below.** At most one media automation item (Q7) per session, so the other two kinds aren't kept waiting.

A security hole you find in another lane's code: fix it yourself, with the smallest change, in a pull request of your own, if no open pull request claims the file. Otherwise write it under **From the other lanes** in that lane's loop file.

## A review, step by step

For a pull request that needs Q's review, check every one of these, and say which you checked:

- **What leaves the machine:** to which host, with what, when, and only once the person has turned it on. The screen says it plainly before it's on.
- **Secrets:** in `.env` only, at 0600; never in a log, an error, a page, an alert, `homelab report` or a fixture; in the redaction phones, alerts and reports get (lanes.md rule 9).
- **What a phone may call:** the names in `cmd/homelab/serve.go`'s `phoneMethods`; a look-only phone can't change anything; one person's phone can't read another's Finances.
- **Input from outside:** a size limit, a timeout, no private addresses (as `internal/sitelogo` refuses them), nothing written outside its folder.
- **Turned off means gone:** turning it off forgets the link or the key.
- **The docs:** `docs/Security.md` says what's sent, and its tests cover the above.

## The work, in order

- [x] **Q0. Find out why "nothing works."** One session, before anything else.
  - **Does the owner get the new builds?**
    - The release workflow publishes every build of main: check the latest releases exist, with their files.
    - The app updates itself (`app/autoupdate.go`, `app/updates.go`): its tests pass, and nothing obvious stops it on a Mac.
    - The iPhone app is built by hand with a free Apple ID, so it lapses after 7 days, and the owner sees only what they last built.
  - **Write what you found in `owner.md`:** a plain paragraph under **Waiting on you**, with the two questions only the owner can answer.
    - What version does Settings › This Mac show?
    - When did you last build the iPhone app in Xcode?
  - **Fix anything you find in the update path** in a pull request.
- **High priority, before Q1 (the owner, Nov 23): how the apps' data is kept.** Today: each app's files in `data/appdata/<app>`, databases in Docker volumes dumped nightly, uploads in volumes archived nightly, caches not backed up, the app's own records in JSON saved whole under a lock (`docs/Storage.md`). Three gaps, in this order:
  - [x] **D1. The Syncthing folder in the backups.** `SYNC_ROOT`, what the household syncs between devices, is in no backup today. Q4 (b) moved up to here: a *Not in any backup* card on Backups listing what's left out, with **Add**, and Syncthing's folder the first one in. Then a line for R under **From the other lanes** in `redesign-loop.md` (R7 lays it out).
  - [x] **D2. No app's data goes unbacked without anyone saying so.** A catalog check (`go run ./cmd/homelab --root . validate`): every named Docker volume is a database marked `dump`, listed under `archive`, or marked as rebuilding itself (a new `x-homelab` field, such as `rebuilds: [linkwarden-meilisearch]`). The table in `docs/Storage.md` gets the ones it lacks: Firefly III's uploads (archived), Linkwarden's search index and Tandoor's static files (rebuilt).
  - [ ] **D3. Choose where the apps' data lives.** A setting for the folder that's `data/appdata` today, as CasaOS has its data folder, so it can sit on a bigger or faster drive; every compose file reads it; changing it moves the data with Undo, and a restore test passes after. Moving the household's files needs the owner's yes (lanes.md rule 13): the pull request asks in `owner.md` and merges on their yes. Pairs with Q7 (d), a second drive.
  - **Decided, leave as they are (the owner, Nov 23):** one database per app, not one shared PostgreSQL (one app's upgrade can't break another, and Immich needs its own image); Finances in JSON, not a database, until bank imports (M1, M2) make it slow.
- [x] **Q1. The open security list.**
  - **Make the list.** From `audit-loop.md`'s *Security backlog, in order* (only that section, and only its items not marked done) and the open items in its *For Account 2* usability findings, write the ones still open into this file, one line each and worst first, under **The security list** below.
  - **Archive the history.** Say at the top of `audit-loop.md` that it's archived, then work the list from here.
- [ ] **Q2. The owner's machine, for real.** `test/realdocker` and the nightly workflow are the closest thing to it. Make sure the nightly run covers what the owner uses most:
  - Status's Start and Restart
  - a backup and a restore test
  - an update with its undo
  - Finances' save and load
  - Connect apps for media automation

  A gap becomes a test, and a failing one an issue.
- [ ] **Q3. Privacy of every call out.** `internal/sitelogo`, `internal/cardprice`, the release-notes reader, and each new one as it ships (SimpleFIN, the logo service).
  - **What's sent, when, and on whose click,** written in `docs/Security.md`. (Done Nov 25: *What leaves this computer, and on whose click*.)
  - **What's in `homelab report` and the logs:** checked to carry no amount, payee or key.
- [ ] **Q4. The backups' engine, for R's Backups** (`docs/Redesign.md`, *New work behind the pictures*).
  - [x] **(a) Each app's result each night,** kept for fourteen nights. (Nov 25: `data/backup-nights.json`, `backup.Night`, in `Backups()` as `nights`.)
  - **(b) Not in any backup:** moved up, as D1.
  - **(c) Get something back:** one file or a whole app from a chosen night, through the backup engine, saved as a copy or put back, with a test against a real Duplicati and Kopia (`test/realdocker`).

  Each part is one pull request, then a line for R under **From the other lanes** in `redesign-loop.md`.
- [ ] **Q5. The security list** (Q1), worst first, one item per pull request.
- [ ] **Q6. Whatever's flaky.** (Nov 25: `TestJobLogSplitsAtOnceAllFinish`'s cause found and fixed: `lockedfile.Write` retried a rename only on *access is denied*, not on Windows' *in use by another process* or *delete pending*, which Read already waited out.) A test that fails now and then (the Windows `TestJobLogSplitsAtOnceAllFinish`, *being used by another process*): find the cause and fix it, never retry it away.
- [ ] **Q7. Media automation.**
  - **Where it stands:** `arr-loop.md`'s sections *3. Where it stands* and *4. The work, in order*, and its *0. Rules*, which still bind media automation (above all rule 2: the wizard never picks search sites).
  - **What's left:**
    - (a) add your own app from a pasted compose file
    - (b) change an app's settings on its page, with Undo
    - (c) share a folder on the home network: a security choice, so the owner decides (lanes.md rule 4)
    - (d) drives: put new films on a second drive
  - **Each one:** one pull request, with **Try this tonight**.

## The security list

Q1 filled this in (Nov 25), one line each, worst first; Q5 works it. Read against `audit-loop.md`'s *Security backlog* (166 items: all done, held or decided but the two below) and its *For Account 2* findings (all fixed but 22, Q4 (c)'s); N21 shipped as `homelab-tunnel`.

1. **N29 part 2, Medium: the app checks a Windows or Linux update's build provenance** before it swaps itself. Releases have carried provenance since Nov 10 (`TestEveryReleaseIsAttested`); the app doesn't check it yet. Fetch a real bundle from a release first (`GET /repos/Snooper42/homelab-wizard/attestations/sha256:<digest>`), then choose: check by hand (Fulcio chain, the workflow's identity, the DSSE signature, Rekor's proof) or a pinned library.
2. **Item 71, Low: Paperless-AI's first-run window.** Until its first account, anyone on the household's network (or tailnet) who opens it first makes the admin; it's `admin: true`, never public. The install could call `POST /api/setup` itself with a user and password from `.env`, as the nightly test does, so the window never opens; worth it only with a test like the nightly's.
3. **For Account 2, item 22 (usability, not security): nothing gets one file back.** It's Q4 (c).

## From the other lanes

Lanes R and M add a line here: a check that failed for a reason outside their change, a security worry, or something the backups' engine must do.

- **Nov 24 (account C, lane S):** *Connect apps signs Seerr in to Jellyfin from a name and password* failed once on #828's smoke (dark), passed on its re-run, and fails about 1 in 3 locally while the machine is busy: it waits 3 s for *Seerr sends requests to Sonarr*, though the mock answers in under half a second. Likely Status drawing Connect apps' list afresh while the sign-in's lines come in. For Q6. **Root cause found and fixed (Nov 24, R6's pull request):** not the timing. Once Connect apps ends, the links that went fine fold into one "connected" line (the owner, Nov 20), so *Seerr sends requests to Sonarr* goes off screen; the test passed only when it looked before the fold. It now looks for the link in the page and checks the fold says "2 connected".
- **Nov 24 (account C, lane S):** *TestJobsInstalledForReal* (`cmd/homelab`, macOS, `-tags forreal`) failed once on #831, a pull request with no Go in it: after `homelab quit --apply`, `homelab schedule status` said `com.homelab.agent  always  present, not loaded` without *stopped by homelab quit*. It passed on #829's and #830's macOS runs. For Q6: what writes the quit note, and whether status can read before it's there.
- **Nov 25 (account A, lane R):** `check`'s *make coverage* step failed once on #885, a pull request with no Go in it, and passed on its re-run; the same Go tests passed in that run on Mac and Windows, and four times locally. Which test failed can't be told: the Makefile's `coverage` sends `go test`'s output to `/dev/null`, so a failure there prints nothing but *Error 1*. Letting the failing lines through (say, `| grep -E '^(--- FAIL|FAIL|panic)'`, or only on failure) would name the next one.
