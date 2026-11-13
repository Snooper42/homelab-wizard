# Audit: the UX and security loops

The master prompt for two sessions that audit homelab-wizard and fix what
they find, one finished fix per round, for as long as their loops run. One
session is the **UX team**, the other the **security team**. Start each on
this repository with:

    /loop Read .claude/prompts/audit-loop.md and do the next round as the UX team.

    /loop Read .claude/prompts/audit-loop.md and do the next round as the security team.

With no interval, /loop paces itself. Each round re-reads this file, so to
steer a team, edit its section, commit and push it to main, and the next
round follows.

## Account 3's job from Nov 6, 2026: the household's tester, and security

The owner's call (Nov 6): the app is to become clearly easier to use. This loop's main work is now **finding what gets in the household's way**, ranked, and handing each finding to the lane that owns the screen: **For Account 1** (Tidy Up, Finances) or **For Account 2** (every other screen), in this file. It then checks that the fix landed. Security stays covered, at a smaller share of the time, unless something High turns up. This loop builds no screens. It fixes security holes itself.

Start each round from the `/loop` line: `Read .claude/prompts/audit-loop.md and do the next round, applying .claude/prompts/lanes.md.`

### Each round

1. **Start:** `git fetch origin`; open PRs; merge main into your branch; read `lanes.md`, `.claude/prompts/complaints.md`, and the **For Account 3** sections in `features-loop.md` and `maintenance-loop.md`.
2. **Security, kept short:**
   - Read every PR merged since the last round for what can now reach what. A real hole (High or Medium) is fixed now: a test that fails first, the smallest fix in a commit of its own, recorded in `docs/Security.md`.
   - Then the owner-approved items below, one per round, before the security backlog.
   - Storage-code holes go **For Account 2** with the test that shows them.
3. **Usability, the main work:**
   1. Re-run each task whose findings a lane says it fixed, and update `docs/Usability.md`. A finding not fixed goes back to that lane, with what is still wrong.
   2. Run the next household task (the owner's complaints first, then the one not run longest), as each system, in light and dark, at 320px and with big text, against the fake backend (`make app-smoke`, `SMOKE_ONLY=…`, `node app/preview/shoot.mjs <shot>`, `app/preview/mock.js`; add states it does not draw yet). Open every picture.
   3. Rank what you found, worst first:
      - a dead end;
      - something wrong or misleading;
      - unreachable by keyboard or screen reader;
      - cut off at 320px or with big text;
      - jargon or code in words;
      - the same thing done two ways.
4. **Hand each finding over**, under **For Account 1** or **For Account 2**: the task and step, what the household sees (quoted), why it gets in the way, the screenshot path (committed under `docs/images/usability/`), what "fixed" looks like, and the smoke case that would fail today. Describe that smoke case; never add a failing test to the suite.
5. **Ship:** one open PR at a time, with the scoreboard, findings, screenshots, and any security fix; about once a day, sooner for a security fix. Merge per `lanes.md` Rule 5, at most 3 merges a day.
6. **Report to the owner** in a few plain lines: which tasks got easier and which didn't (the scoreboard's numbers), the top three findings and whose they are, and any security fix.

### The household tasks (the rows of `docs/Usability.md`)

Account 2's screens:
1. From a new computer to the first app open, with no docs.
2. Something is down: find out what, and fix it.
3. Install an app that needs a login or a drive.
4. Update everything, and know it worked (or what failed and what to do).
5. Get one file back from last week's backup.
6. Pair a partner's phone with only look access, then remove a lost phone.
7. Give a person their own account (People) and send them the welcome page.
8. Put the apps on your own domain.
9. The computer is slow: find out why and free memory.
10. After a restart or power cut: is everything back?
11. An alert arrives on the phone: understand it, and act from the phone.
12. Move the homelab to a new computer.

Account 1's screens:

13. Tidy Up: clean a music library and undo a mistake.
14. Tidy Up: find what takes the space and free some.
15. Finances: set up the month's bills and see what's left.
16. Finances: bring in a bank file and fix a wrong category.

Add tasks from the owner's complaints.

### Owner-approved security work (Nov 6), before the backlog

1. (done: round 62) **N25:** the companion's proxy host adds a header with a secret only it and the companion know; `trust_forwarded_proto` is off for that host; `Encrypted` believes "https" only with the secret. Try it against a real Nginx Proxy Manager (`jc21/nginx-proxy-manager` on Docker Hub).
2. (done: round 63) **N28:** the music jobs need Python 3.10 or newer and install pinned versions (a constraints file per supported Python, tested in a fresh venv for each). `tools/media` is Account 1's, so this is the smallest security fix, in a commit of its own, and only while no open PR claims those files.
3. (done: the independent review, Nov 10) **N29:** the app checks a Windows or Linux update against the build provenance the release workflow already makes (`actions/attest-build-provenance`, Sigstore, keyless), so no key is needed from the owner.
   - **Status (Nov 10, the independent review):** part 1, releases carry provenance: the `publish` job (the releases the app takes, from main) now attests `dist/*` before publishing; only the tag-only `release` job had, and it is skipped, so no release had any (`TestEveryReleaseIsAttested`).
   - **Part 2, the app's check, needs a choice made with a real bundle in hand** (fetch one from the first release after part 1: `GET /repos/Snooper42/homelab-wizard/attestations/sha256:<digest>`). Writing the check by hand (Fulcio chain, the workflow's identity in the certificate, the DSSE signature, Rekor's proof) needs no new dependency, but Sigstore's formats are moving (bundle v0.3, Rekor v2, timestamp authorities): a check that falls behind either blocks every update or must fail open. `sigstore-go` keeps up, but brings a large dependency tree (CONTRIBUTING names three) and, to refresh its trust roots, a new host (`tuf-repo-cdn.sigstore.dev`; rule 3). The conservative path: by hand, against the embedded public-good root, for exactly the format GitHub's attestations use, failing closed with words that say how to update by hand, and a test that fails when the release's bundle stops verifying.
4. **N21:** cloudflared at a fixed address on the `homelab` network, and NPM trusting `CF-Connecting-IP` from that address only. It changes every install's network, so it ships as one careful PR of its own, tried on real Docker.
   - **Built (Nov 10), simpler than the plan below:** cloudflared on `homelab-tunnel` alone (no alias and no ingress rewrite: whatever name its routes use, it leaves from 198.18.89.2), the network made before any `compose up` (internal/docker), `--ip-range` .4/30 so Docker never hands out .2, and the proxy job's real-Docker test. Only the proxy job runs it: dispatch Nightly on the branch.
   - **The plan (Nov 10, the independent review), as first written:** a fixed address on `homelab` needs that network recreated with a subnet (every container), so instead: (1) a small network of the tunnel's own, `homelab-tunnel`, made by the CLI as it makes `homelab` but with a fixed subnet from a range homes and Docker don't use (198.18.89.0/29, RFC 2544), cloudflared at a fixed address on it and NPM joined with an alias (`npm-tunnel`) that only that network resolves; (2) the tunnel's ingress sends to `http://npm-tunnel:80`, so its traffic can only arrive from that address (Publish rewrites the homelab's own rules; Unpublish and `away` accept the old service and the new); (3) `server_proxy.conf` adds `set_real_ip_from <that address>;`, which at server level replaces NPM's http-level private ranges, and an existing file that is still the image's exact old text is rewritten (one the household edited is left, and said). **The danger:** if tunnel traffic ever reaches NPM from another address, every visitor is that address, and CrowdSec can ban the whole internet's way in. So first a realdocker test that has none today: a container at the fixed address sending `CF-Connecting-IP` is seen as that visitor; one on `homelab` sending the same header is seen as itself; and the tunnel's own path, with cloudflared's container on both networks, reaches NPM from the fixed address.

The sections below keep the history (the UX team's method, the security backlog, every round done). Where they disagree with this section, this section wins. Backlog item 28 (the Apple client) is dropped: `apple-client/` is Account 4's.

---

Start them from a session of your own: a session that another session
started cannot run /loop. While no session runs a team, its rounds wait;
the owner's own session takes one only when the owner asks, on that
team's branch and PR.

---

## Your job, either team

You are a small team of senior engineers auditing this app as it is today,
not as the docs say it is. Each round:

1. **Sync.** `git fetch origin main`, merge it into your branch. On a
   conflict in `web/dist/*`, never merge by hand: resolve the sources and
   run `make frontend`. In CHANGELOG.md keep both sides' lines.
2. **Pick** the first open item in your team's backlog (below). If it is
   already fixed on main, mark it so with the commit, and take the next.
3. **Look before you judge.** Read the code. Run the app's real checks (the
   smoke suite, the Go tests, the screenshots) and look at what they show.
   A finding needs evidence: a screenshot you looked at, a test that fails,
   a request that gets through.
4. **Prove it, then fix it.** Write the check that fails first (a Go test, a
   smoke case in app/preview/shoot.mjs, a lint rule), show it failing, fix
   the code, show it passing. One finding per commit.
5. **Run what CONTRIBUTING.md lists** for what you changed (`make check`,
   `make coverage`, `make frontend-check`, `make app-check`, `make
   app-smoke` or its `SMOKE_ONLY=` subset, `make security`), and look at
   the screenshots before committing UI.
6. **Record it.** Mark the item done in this file with what you found and
   the commit; add a CHANGELOG line under Unreleased when someone running
   the homelab would notice. Commit and push this file with the fix.
7. **Grow the backlog.** When it has fewer than 5 open items, audit the
   area again and add at least 10 new, specific ones, worst first.

Never stop to ask the owner anything. When a decision is theirs, take the
most conservative choice that keeps the app working, write it under
**Decisions to look at** in your PR, and carry on.

## Branches, PRs, and the other sessions

- Your branch: `claude/audit-ux-<n>` or `claude/audit-security-<n>`,
  starting at 1, from the latest main. One open PR per team, opened as a
  **draft**.
- **Every 3 rounds, ship.** Make sure everything passes, update the PR
  description (Done, Decisions to look at, what's next), and mark the PR
  **Ready for review**, then merge it yourself: once every CI check on its
  head is green and GitHub says it merges cleanly, squash-merge it with a
  title that ends in its number. Start the next batch on `<team>-<n+1>`
  from the latest main; open its draft PR only once the one before is
  merged or closed.
- **No cleanup session runs any more** (the owner, Nov 1). Each loop merges
  its own PRs and keeps main green for its own changes. VERSION and
  releases belong to the owner's own session, when the owner asks: never
  touch VERSION, never cut a release, and never merge, close, or push to a
  PR that is not yours. If main's CI is red for a reason that is not yours,
  note it in your PR; fix it in a small PR of its own, merged the same way,
  only when the cause and the fix are clear, and otherwise leave it for the
  owner.
- **The Finances session** (.claude/prompts/finances-loop.md) owns, as its
  file says: internal/finance, web/src/finances, app/preview's
  finance*.json and ledger.json, the Finances cases in shoot.mjs and the
  Finances parts of mock.js, the Finances methods in cmd/homelab/serve.go
  (Finances, SaveFinances, FinancesLedger, SaveFinancesLedger) and in
  internal/companion, the Finances docs, and its own prompt file. Never
  edit those, or its prompt file. Write a UX finding there under **For
  the Finances session** in your PR. A security flaw there is yours to
  fix only when it is a real hole, in its smallest form, in a commit of
  its own that says why; anything less goes in the PR for that session.
- **Files everyone shares** (shoot.mjs, mock.js, serve.go, internal/companion,
  CHANGELOG.md, web/dist): add, never reorder or reformat what is there,
  and keep your changes to your own cases and lines, so merges stay clean.
  Merge main at the start of every round and before you mark a PR ready.
  **Screenshots**: retake only the pictures of what you changed
  (`node app/preview/shoot.mjs <shot name>…`), never all of docs/images
  with `make screenshots`, which would redraw the Finances pictures too.
- The two audit teams: UX owns how things look, read, and behave; security
  owns what can be reached and what guards it. A finding in the other's
  area goes into the other team's backlog in this file, not into your code.

## Rules that never bend

1. **Never skip, weaken, or delete a test or check** to get green, and never
   add a `#nosec`, a lint exception, or an axe exclusion to quiet a finding.
   Change an expected value only after proving the new one is right.
2. **Prove every fix** with a check that failed before it.
3. **Nothing new leaves the machine.** No new outside service, telemetry,
   or fetched asset. Secrets are read from `.env` when needed and never
   printed, logged, or sent to the page.
4. **Old files keep loading**: `.env`, `data/*.json`, and the phone's
   saved token from an older version keep working (TestEachReleasesFolderUpgrades).
5. **The house style**: UI words, CHANGELOG lines, and commit titles are short,
   plain English about what the household gets (git log, CHANGELOG.md,
   app/preview/words.mjs). No Mac words outside a Mac branch.
6. **Every platform**: a change holds on the Mac, Windows, Linux (GNOME,
   KDE), SteamOS, and the phone, in light, dark, and more contrast.
7. **Small and safe**: a fix is the smallest change that closes the finding.
   A redesign or a new feature goes into **Decisions to look at** instead.

---

## The UX team

You audit what the household sees and does: every screen, sheet, message,
and flow, on every system and on the phone, for someone who is not
technical, in a hurry, maybe on a small screen or with big text.

**How to look.** The smoke suite (`make app-smoke`, `SMOKE_ONLY=…`) and
the docs shots (`node app/preview/shoot.mjs <shot name>…`) draw every
screen against the fake backend (app/preview/mock.js) as each system, in
light, dark, and more contrast. Open the pictures and look. Shots write
into docs/images: commit only the ones you changed on purpose, and
`git checkout -- docs/images` the rest. Add a `shots` entry or a smoke case to see a state that is not drawn
yet (an error, an empty list, a slow engine, a long name). The phone's
shots refuse what a phone is not served (serve.go's phoneMethods), as the
real computer does.

**What counts as a finding**, worst first:

- A dead end: a screen or error that does not say what to do next.
- Something wrong or misleading on screen (a count, a state, a date).
- A control that cannot be reached or understood with the keyboard or a
  screen reader (axe passes is not enough: tab through it).
- Something cut off, overlapping, or sliding sideways at 320px, at 200%
  text, or in a contrast theme.
- Words: jargon, a Mac word on another system, an error that names code.
- Inconsistency: the same thing done or said two ways.

**Each fix comes with** a smoke case (or a lint rule) that fails on the old
behaviour, and the screenshots retaken where they changed.

### UX backlog, in order

1. **First run, from nothing** (done: rounds 1, 5, 7, 8). Setup on an empty homelab as each system:
   every step's words, what each button does, what a failed step says, and
   whether someone can get from launch to their first app without the docs.
2. **Every error the page can show** (`showError`, a card's `problem`, a
   sheet's failure): list them from the code, draw each one, and make each
   say what happened and what to do, in plain words.
3. **The phone, by permission**: unpaired, looks only, makes changes, sees
   Finances, changes Finances, kiosk. Every screen at 390px and 320px,
   with big text; nothing offered that the phone will be refused.
4. **Settings › Phones and pairing**: the code, the QR, the link, what each
   permission means, removing a lost phone. Can the owner pair their
   partner's phone without help?
5. **Settings › People and the welcome page**: add, Reset password, remove;
   the welcome page printed and on a phone; what the person reads first.
6. **Keyboard and screen reader on every sheet**: the focus goes in and back,
   Escape closes, every icon button has a name, the order makes sense.
7. **Empty, loading, and slow states**: no apps yet, the engine stopped, a
   slow engine (`statusDelay`), a card that fails, a list of one, a list of 80.
8. **Backups**: the restore drill, the recovery kit, the move, as someone who
   has never restored a backup. What does "it worked" look like?
9. **Choose apps and the install plan**: search, bundles, what an app needs
   (a drive, a login), and the plan's words before **Install**.
10. **The update line and release notes**: what an update says before,
    during, after, and when it fails, on each system.
11. **Kiosk on a TV**: legible from across the room, nothing to press,
    what a stopped app looks like from the sofa.
12. **Consistency pass**: buttons' words (Remove, Delete, Turn off), dates
    and times, money and sizes, capitalization, across every screen.

### UX done

- **Round 1 (item 1, first run), the first finding:** with no homelab
  folder yet, Setup listed the whole checklist (steps read from a .env that
  is not there), offered "Do the 6 I can do for you", and counted 8 in the
  sidebar, while none of it could run. Now the checklist and the count wait
  for the folder, and one line says the rest follows; making the folder
  reloads the steps. Smoke: "First run: no checklist before the homelab is
  made" (failed before: checklist, checkTitle, runAll shown). Still to do
  in item 1: each system's first run (Windows, Linux, SteamOS), a failed
  step's words, and from launch to the first app without the docs.
- **Round 2 (item 2, every error), the first finding:** a command the app
  runs (a backup, Fix it, a Setup step, the recovery kit) that failed sent
  the page Go's "exit status 1", which the red error bar showed. Now the
  error is the CLI's own "✗" line, else its last line (lineWriter.Why);
  callers' context stays ("the backup before removing it failed, so it was
  not removed: Docker is not running"). TestAFailedCommandSaysWhy failed
  before (exit status 1, exit status 2). Still to do in item 2: errors from
  the engine and from Go bindings that name code ("SaveFinances takes the
  plan"), drawn one by one.
- **Round 3 (item 4, pairing):** the QR holds the https link when there is
  one. With none (no domain, no Tailscale), picking "Can make changes" or a
  Finances level and scanning gave a look-only phone without Finances, with
  only a general note about http links. The pairing now says, for that
  phone, that it will only look and how to give it more (#pairOnlyLooks).
  Smoke: "Pairing says when a phone will only look" (http only with
  changes picked failed before; http with nothing picked and https stay
  quiet).
- **Round 4 (item 5, the welcome page):** drawn with real-looking data at
  320 and 390 px and in print. On a phone the app password broke at a
  hyphen ("k7mp-2xqr-9wfd-" / "h3nt"), and the page slid sideways. The
  password stays whole (white-space: nowrap) and narrow screens stack the
  table's columns. Measured before (2 passwords split, sideways at both
  widths) and after (none); TestWelcomeKeepsAPasswordWhole holds the
  rules. Print was already fine.
- **Round 5 (item 1 again, each system's first run):** drawn as Windows,
  Linux, and SteamOS with no runtime. Windows and SteamOS shared the Mac's
  card: "Open the downloaded file and drag it to Applications", and on
  SteamOS no download button and a "Terminal" hint naming a Setup step.
  Now Windows runs the installer, and SteamOS gets its own: start the
  homelab, then Set up Docker for me. Smoke: "First run on <system> with
  no <runtime>: the card says how there" (Windows and SteamOS failed
  before).
- **Round 6 (item 11, kiosk on a TV):** drawn at 1920×1080. Every group of
  apps said only "4 running ✓": its name sits on the fold button, and
  kiosk hides every button. A plain-text name shows in kiosk mode only
  (.kiosklabel). Smoke: "Kiosk mode names each group of apps" (failed
  before, every group); "without buttons" still holds.
- **Round 7 (item 1 again, a failed step's words):** drawn with a step
  whose command fails. Its reason showed in the red bar, which goes after
  6 seconds; then only a bare "✗ …" line in the log at the top was left,
  and the step's row looked as if it had never run, with nothing on what
  to do next. Now the row keeps "Did not work: <why>. Once that is put
  right, press <its button> again." until the step runs again (one step
  or "Do the … I can do for you"). Smoke: "First run: a failed step still says why,
  and what next" (failed before: the row said neither). Still to do in
  item 1: from launch to the first app without the docs.
- **Round 8 (item 1, from launch to the first app):** walked in the
  preview from no folder to Choose stacks. After Set it up for me, Setup
  showed the machine and a checklist (each app's steps join it only once
  the app is installed) and nothing anywhere said to pick apps: no step,
  no link, no mention of Choose stacks; only Status, if opened, said "No
  apps yet". Now, with the homelab made and no apps, one line under the
  machine says to pick the first apps on Choose stacks and takes you
  there (#firstApps). Smoke: "First run: once the homelab is made, Setup
  points to the first apps" (failed before) and "Setup says nothing of
  first apps once there are apps". Item 1 is done.
- **Round 9 (item 2, every error):** listed the errors app.go sends the
  page. Start on a native app (Jellyfin) on Linux runs pkexec; a closed
  password prompt showed "starting Jellyfin: exit status 126 Error
  executing command as another user: Request dismissed". Now: "Jellyfin
  did not start: it needs your password. Press Start again and enter it."
  (127: this account may not start it; else the service's own last line).
  TestStartingANativeAppSaysWhyPlainly (fake pkexec; failed before, all 3
  cases). Still to do in item 2: the same Start on Windows (a declined
  approval gives PowerShell's multi-line error), and resume's
  "homelab resume: exit status …".

---

90. (done: holds, Nov 12, round 6) **Who can publish an alert, buttons and all** (ntfy, #550's buttons into the iPhone app): ntfy's default is `deny-all`; only `homelab` may write to the alert topics (write-only), the app's reader and the phone's account only read, and no app's container holds `NTFY_PUBLISH_TOKEN` (only `.env`). A forged alert with a `homelab://` button needs the whole machine already.
91. (done: holds, Nov 12, round 6) **A `homelab://` link from anywhere** (#549, #604, apple-client `DeepLink.swift`): unknown or malformed opens Status; an app's ID is checked (letters, digits, `._-`, 64 at most); an action only waits on the app's page for one tap, on a device allowed changes, and the dialog names the app from the computer's own status, never the link's words ("A link asked for this").
92. (done: holds, Nov 12, round 6) **Buys and sales into Ghostfolio from a phone** (`FinancesAddInvestment`, `…Change…`, `…Delete…`): Finances' edit permission; shares, total and day checked (no minus, no infinity, no day to come); a buy or sale to change or delete is looked up in Ghostfolio's own list for the plan's account (`kept`), never taken from the phone as a path, and every path part is escaped.
93. (done: N47, Nov 12, round 6) **A sealed message replayed through the tunnel** (ADR-0023, `tunnelGuard`): the time must be within `TunnelSkew` and the nonce is taken once, but the memory of what was taken lived only in the running process, so after a restart a message captured a moment before was taken again (reads only: the tunnel refuses every change). Now one sealed before this run began is refused.
94. (done: holds, Nov 12, round 6) **Tidy Up's Undo** (`tools/media/trash_restore.py`): a line is moved back only from directly inside the Trash of its old place's drive (`trashed_from`), only when nothing is in its old place, and after the household confirms. The log is under `data/`, so a crafted line needs the machine already. Left as item 98.
95. (done: holds, Nov 12, round 6) **`/api/me` before pairing**: answers only a paired device (401 otherwise); pairing's body is capped at 4 KB.
96. (done: holds, Nov 12, round 6) **The kept alerts and the record of what was done** (internal/history, #555, #591): kept 90 days and at most `MaxEntries`, every text cleaned of control characters and cut to a length, the database's files this account's alone.
97. (done: holds, Nov 12, round 6) **The ledger's size from a phone**: no limit on a payee's or note's length or on how many rows, but a phone's whole ledger arrives in one call, capped at `MaxCall` (4 MB) before it is read, and only a phone allowed to edit Finances can send it.
98. (done: N58, Nov 12, round 19: `from` must resolve, links and `..` included, inside a library, an inbox folder, a scrubber root or the reports folder) **Undo puts things back only where Tidy Up works** (Low, hardening): `trash_restore.py` checks where a thing is in the Trash but not that its old place (`from`) is under a library Tidy Up looks after. Check `from` against the media roots, so a line in the log can only ever put a file back into a library.
99. (done: holds, Nov 12, round 7: ntfy sends ntfy.sh only a poll request, the message's ID, to a topic that is the SHA-256 of this server's address and the topic; the words, title and buttons stay here. services/security/ntfy.md says so) **What ntfy.sh learns** (`NTFY_UPSTREAM_BASE_URL: https://ntfy.sh`, for the iPhone's push): ntfy forwards a poll request to ntfy.sh for each message on a topic an iPhone follows. Check what it carries (the message's ID and a hash of the topic, not its words?) and say so in docs/Security.md's privacy part.
100. (done, Nov 12, round 7: How to look says so) **Make `make security` work from a cloud session, or say it can't** (process): `govulncheck` can't reach vuln.go.dev from here (refused), so every round here leans on CI's security job, which runs `make security` on each PR. Say so in this file's How to look, so a round doesn't count govulncheck as run.

101. (done: holds, Nov 12, round 7) **A setting with a line break, into .env** (internal/envfile `quote`): any value not plain goes in double quotes with `\`, `"`, `$` and line breaks escaped, so one value can never become a second line (`BIND_IP=0.0.0.0` slipped in) or a variable.
102. (done: holds, Nov 12, round 7) **SQL into the apps' databases** (internal/pgexec): its one caller (storage's Immich reading) sends fixed text; the database and the query travel as `sh -c` arguments (`$1`, `$2`), never inside the script.
103. (done: holds, Nov 12, round 7) **Backup passwords on a command line** (Kopia, Duplicati, Secrets): none is passed as an argument another account could read in the process list; they travel in the environment or a file.
104. (done: holds, Nov 12, round 7) **Root shells** (internal/domain `asRoot`, the Mac's password window, cmd/homelab `asAdmin`): every path is quoted with `shQuote`, a domain is held to `validDomain` before any of it, the drop-in's text goes in a staged file, and the AppleScript escapes `\` and `"` in the script.
105. (done: N71, Nov 12, round 40, with item 166: the engine already serves the same kind of socket on the Mac and Windows, so the Mac's half was no longer untried) (was left, Nov 12: moving the tray to a socket of the account's own changes how the tray and `homelab quit` meet on each system, with the Mac's untried here; it is a nuisance between accounts on one computer, not a way in) **The tray's port** (`app/tray`, 127.0.0.1:47231, Low): any process of any account on the computer can send "quit", and another account starting first holds the port, so this account's tray never starts ("another tray is running"). A socket in the account's own folder (as the engine's, item 83) would be its own. A web page can't send it (a browser's request starts with its own line, never "quit").
106. (done: holds, Nov 12: no app added since Nov 10; compose changed only for N41 to N49) **New apps whose first visitor becomes the admin** (item 67, N38, after every app added since Nov 10): list each app added or changed since, and check its first account is claimed at install, or it waits (N38's way), before Reach it away from home can publish it.
107. (done: holds, Nov 12, round 7: the CLI only, no phone call; files 0600 in a 0700 folder; table names made safe; Paperless's export copied as regular files only, links skipped, though a file swapped for a link between the walk and the copy would be followed: a compromised container at that moment) **What Export writes** (internal/export): what the household's export holds (a database dump with secrets in it?), its file's mode, where it lands, and whether a phone can ask for one.
108. (done: N48, Nov 12, round 7: its own password, KOPIA_SERVER_PASSWORD, but on its command line; now read from the environment) **Kopia's own server and its password** (Settings › Backups, Kopia's UI): who can open its page on its port, with what account, and whether its server password is the repository's (`KOPIA_PASSWORD`) or one of its own.
109. (done: holds, Nov 12, round 7: every answer at home carries `X-Frame-Options: DENY`, `frame-ancestors 'none'` and a `default-src 'self'` policy) **The companion's web pages, framed** (`homelab serve`, anything it serves as a page rather than JSON): a page another site frames (clickjacking a tap on Restart) needs `X-Frame-Options`/`frame-ancestors`; check what it answers to a browser.
110. (done: holds, Nov 12: only a message opened with a paired phone's key reaches `fresh`; entries older than 2×TunnelSkew go on every message; every call is capped) **The tunnel guard's nonce memory over a day** (N47's neighbour): `seen` drops entries after `2*TunnelSkew` on each message; a phone sending many in that window keeps them all. Bounded by the lockout and the call limit? Count it with a test.
111. (done: N50, Nov 12, round 9: with nothing left out gosec finds only the excluded rules; their reasons hold, and its taint rules led to Tailscale's sign-in link, opened unchecked) **gosec's excluded rules, again** (Makefile `GOSEC_EXCLUDE`: G104, G204, G301, G302, G304, G306, G702, G703): each exclusion's reason in docs/Security.md still true; run once without the excludes and read what is new since it was set.

112. (done: N49, Nov 12, round 8) **Kopia's page with its CSRF checks off** (Medium; `config/kopia/start.sh` `--disable-csrf-token-checks`): Kopia's page signs in with basic auth, which a browser sends again on its own, and with the checks off a web page the household visits could post to Kopia's API at 127.0.0.1:51515 (delete snapshots, change a policy) while they're signed in there. The checks are off because the homelab's client (internal/kopia: snapshots, objects, restore, tasks) and the container's healthcheck (`/api/v1/repo/status`) call the UI's API, which wants the token. The fix: the client GETs `/` with basic auth, keeps the session cookie and reads `<meta name="kopia-csrf-token">`, then sends `X-Kopia-Csrf-Token`; the healthcheck moves to `/api/v1/control/status` as a `server-control` user (`--server-control-username`, its password from the environment); then the flag goes. A real-Docker case should prove a restore still works.
113. (done: N69, Nov 12, round 35: tried on real Docker as the note asked: the broker's password piped into `mosquitto_passwd`'s prompt (`-U` on a plain file was tried too and refused a password with a colon); the cron's token in a 0600 file, sent by `printf` and `cat` into `nc` from a job file, held open up to 15 minutes; Firefly III itself answered 200, as to `wget`) (was left, Nov 12: each tool would need its password from stdin, untried here for Mosquitto's `mosquitto_passwd` and Firefly's cron; the broker is internal and the token runs only Firefly's own nightly jobs, so a change that could stop either is worth more than the moment in `ps`. Try with a real-Docker case first) **Two short-lived secrets on a command line** (Low): Frigate's broker runs `mosquitto_passwd -b … "$FRIGATE_MQTT_PASSWORD"` once at start, and Firefly III's cron runs `wget …/cron/$FIREFLY_CRON_TOKEN` each night (the token in its crontab too). Each is in `ps` for a moment; the cron token only runs Firefly's own nightly jobs. Feed them on stdin or from a file if each tool allows, and widen `TestNoSecretOnACommandLine` to them.

114. (done: holds, Nov 12, round 10: every app update goes through `Stage`, now checking provenance on all three systems; the kit travels inside the app; a release's time is GitHub's publish time; the git checkout is item 79) **What the desktop app's own update trusts on each system** (internal/selfupdate, after N51): Windows and Linux and now the Mac check the build provenance; check the AppImage's own update path, the `.deb`/`.rpm` installs (Install), and the git checkout (item 79) against the same bar, and that a release's `When` can't be set back to skip it (it comes from GitHub's API, as the assets do).

115. (done: holds, Nov 12, round 10) **Homepage's config from names typed** (internal/homepage): every value is written as a JSON string, which YAML reads as one double-quoted scalar, so a name with a line break can't add a key.

116. (done: holds, Nov 12, round 11) **Every phone call that changes something, after N52**: `AppAction` and `StopUntil` take only the homelab's own container apps and fixed actions (the stop time goes as a flag's value), `Homelab` runs only backup, restore-test and fix, `SetStatusFolds` and `SnoozeCheck` are capped (N42), `SetAppSetting` is public apps only, and Finances' saves are data (Ghostfolio's address comes from `GHOSTFOLIO_PORT`, now the computer's).
117. (done: holds, Nov 12, round 11) **Duplicati's passphrases**: jobs are made through its API (JSON); `rebuild` hands the passphrase to `duplicati-cli` in the container's environment (`-e PASSPHRASE`), never as an argument.
118. (done: holds, Nov 12, round 11) **The companion's server against a slow client**: `ReadHeaderTimeout` 10 s, every body capped before it is read (`MaxCall`, `MaxTunnel`, pairing 4 KB); no write timeout, for the event stream.
119. (done: N53, Nov 12, round 11) **A member's folder from their username** (cmd/homelab member.go `memberRoot`).

120. (done: holds, Nov 12, round 12) **The Finances calendar feed's key** (`/finances.ics?key=`): served only over the https (Tailscale) link, a key of 32 to 128 letters and digits (`CalendarKeyOK`), compared in constant time, `no-store`; a member's phone has no feed of its own.
121. (done: holds, Nov 12, round 12) **Adopting an older setup's containers** (internal/adopt): the owner runs it on the computer; what it copies is another container's mounts, made by someone with Docker already (root, in effect); the secrets it carries into `.env` go through its quoting (item 101).
122. (done: holds, Nov 12, round 12) **Claiming a public app's first account** (internal/claim): it only asks each app whether its first account exists, and handles no credential; Reach it away from home waits on it (N38).
123. (done: holds, Nov 12, round 12) **What the desktop app starts** (app.go's native apps, tray_other.go): a service or program named by the catalog under Program Files or systemd, never a value from a page; `APPIMAGE` is the account's own environment.

124. (done: holds, Nov 12, round 13) **Crash notes** (internal/crash): kept on this computer only, in a 0700 folder, each note 0600, 90 days; `homelab report` redacts what it carries (item 11).
125. (done: holds, Nov 12, round 13) **The weekly digest** (internal/digest): sent only through the household's own ntfy (ntfy.sh sees only a message's ID, item 99).
126. (done: holds, Nov 12, round 13) **Disk health** (internal/diskhealth): `smartctl` as this account, its arguments as a list, never elevated by the homelab.
127. (done: holds, Nov 12, round 13) **Tidy Up and what a download names** (tools/media): names made from a download's metadata go through `safe_name` (no slash, no `..`, no device name); music is moved by beets, which cleans each part of a path itself; nothing runs a shell. The Inbox's zips unpack only inside their folder (an absolute path or one that resolves outside is refused) and Python's zipfile writes no links. Seen, not a finding: no limit on how much a zip unpacks to, so a download built to swell can fill the drive it lands on (only what the household downloads).

128. (done: holds, Nov 12, round 14) **The last packages never read** (internal/savings, battery, storage, awake): their records are 0600 through `lockedfile`; battery reads `pmset -g batt` only; `homelab awake allow` writes one polkit rule granting this account `login1.inhibit-block-sleep` alone, its name held to `validUser`.
129. (done: N56, Nov 12, round 16: kept only at most 1,024 pixels a side, checked on save and on load) **An image of one's own is unpacked whole on the phone** (#627, `apple-client` `LogoCircle.cgImage`; `internal/finance` `Clean`): the 64 KB cap is on the file, not the pixels, and a PNG of a few kilobytes can say 4,000 pixels square. Who can set one: anyone allowed to edit Finances.
130. (done: N57, Nov 12, round 18) **A ticker's "." or ".." in Ghostfolio's address; the Watchlist's words unbounded** (#632, `internal/ghostfolio` `quote` and both `/admin/gather` calls; `internal/finance` `cleanWatch`): escaping left "." and "..", which step out of `/admin/gather/<source>/<symbol>` with the homelab's sign-in; a followed ticker's name and currency had no length. A phone allowed to edit Finances sends both.

Added after round 19 (the backlog was down to 105 and 113; worst first):

131. (done: N59, Nov 12, round 20) **The Inbox's Undo from a crafted record** (`tools/media/inbox.py` `undo`, `data/media-filed.jsonl`): it took the files to move and where to put them from the record as written, so a line could move any file of the account anywhere. Now only library files, only into an inbox folder.
132. (done: N60, Nov 12, round 21: it held, tried on beets 2.14.1; both queries now `field:=~value`) **beets removes by a substring query from a download's tags** (Medium: a file someone else made; `music_tidy.py` `file_music`): after trashing the exact matches, `beet rm -f "albumartist:<artist>" "album:<album>"` matches every album whose names *contain* those words, and a tag starting with `:` makes it a regex (`albumartist::.*`), so a download tagged to match an album already there can take every album out of beets' database (files stay). Remove by the matched items' ids, or an exact query, for the pinned beets; a test with a regex tag first.
133. (done: N61, Nov 12, round 22: to another origin only Accept and User-Agent go along) **Tidy Up's keys follow a redirect to any host** (Low; `media_common.http_json`): Python's `urlopen` keeps `X-Emby-Token`, `X-Plex-Token`, Tdarr's `x-api-key` and `Authorization` on a redirect to another host. Refuse redirects for calls that carry a key, or drop the key across hosts; a test with a local server answering 302.
134. (done: N62, Nov 12, round 23: `name_as` acts only inside an inbox folder) **A Needs a look entry from a crafted record** (Low; `app/tidy.go` `needsListed`, `HOMELAB_MEDIA_NEEDS`, `inbox.py` `name_as`): **It's a film…** renames and files whatever path the needs record lists, and that record is under `data/` too. Check `name_as` takes only a path inside an inbox folder.
135. (done: N64, Nov 12, round 25: `skip` leaves the three records out of Pack and Unpack) **A move file brings Tidy Up's records from another computer** (Low, closes N58's, N59's and 134's class; `internal/move`): `data/media-trash.jsonl`, `media-filed.jsonl` and the needs record name paths on the other computer. Leave them out of a move (or out of move in), and say so.
136. (done: holds, Nov 12, round 23: these live in the account's own home folder, never in `data/` or a move file; whoever can write them can already run code as the account, `~/.bashrc` or a login item) **The engines' own records in the home folder** (Low; `~/.homelab-media/*.json`, `~/.music-cleanup/*/plan.json`): the video engine's `pending` stages and the music cleanup's plan name paths that are later moved. Check each move stays inside its library (`collect_staged`'s `relative_to` raises; the plan's moves?).
137. (done: N65, Nov 12, round 26: the listed sizes are added up first, and a zip that would leave its drive under 1 GB free isn't unpacked) **The Inbox's zips have no size cap** (Low hardening; seen in item 127): a download built to swell can fill the drive it lands on. Cap what a zip may unpack to (its listed sizes against free space, with a margin) and say so.
138. (done: N63, Nov 12, round 24: every reply capped at 64 MB, lrclib.net 2 MB, MusicBrainz 8 MB) **Answers from outside read whole** (Low; `http_json`, `_lrclib_get`, `musicbrainz_reachable`): no cap on a response's size, so an answer from lrclib.net or a server on the home network can take the job's memory. Read at most a few MB.
139. (done: Nov 12, round 26: docs/Security.md's Posture now has a row, Tidy Up's lookups, naming each service and what it gets) **What lrclib.net, MusicBrainz and AcoustID learn** (privacy, Rule 3): each song's artist, title, album and length to lrclib.net; AcoustID gets a fingerprint and the key. Check docs/Security.md's privacy part names each, and that lyrics on new music can be turned off (`TIDY_LYRICS_NEW_MUSIC`).
140. (done: holds, Nov 12, round 26: `PLEX_URL` is the owner's own setting in `.env`, so the token goes only where the owner pointed it; Plex's own apps talk plain HTTP on a home network, so refusing `http://` would break ordinary setups) **Plex's token to a typed address** (Low; `PLEX_URL`, `Servers._plex`): sent as `X-Plex-Token` to whatever address is typed, over plain HTTP if that is what was typed. Say so beside the setting, or refuse a non-local http address.
141. (done: holds, Nov 12, round 23: every path handed to ffmpeg, ffprobe, calibredb, beets, `cp`, `sips` and `ebook-meta` is absolute, libraries and inbox folders being absolute in the settings and resolved by `expand`, so a name starting with `-` always follows a `/`) **A download's name as a tool's option** (Low, check): ffmpeg, ffprobe, calibredb, beets and alass get download paths as arguments; each should be absolute (or after `--`) so a name starting with `-` is never an option. List each call and test one.
142. (done: N66, Nov 12, round 27: each save through a temporary file of its own; lost updates between an unlocked scan and Collect remain, a record of what a scan saw, not a way in) **Tidy Up's records written in place** (Low, as item 19 was for stopped.json): `note_thrown` and `note_filed` append, but `save_state`'s fixed `.tmp` name is shared by two jobs writing the same record at once (`Lock: true` covers most jobs, not all: check which run unlocked).

Added after round 27 (items 131–142 done; audited Tidy Up's outside calls, installs and folders again; worst first):

143. (done: Nov 12, round 28) **The Posture row for Tidy Up's lookups left two plugins out** (item 139's row): a music cleanup's beets also runs `fetchart` (Cover Art Archive, iTunes, Amazon, AlbumArt.org) and `lastgenre` (Last.fm). The row names them now.
144. (done: holds, Nov 12, round 28) **Install, for ffmpeg** (`internal/media/fetch.go`): one pinned build per system, fetched over HTTPS and checked against its pinned SHA-256 before anything is unpacked; only the named program is taken, by its base name, to a fixed path, at most 512 MB.
145. (done: holds, Nov 12, round 28) **beets' config from settings** (`music_organizer.write_beets_config`, `music_tidy.write_inbox_beets_config`): written with `yaml.safe_dump`, so a library path with a line break can't add a key (`pluginpath` would load code).
146. (done: holds, Nov 12, round 28) **Show in Finder** (`app/tidy.go` `TidyReveal`, `core.Reveal`): only a library, an inbox folder, the reports or the logs; `open -R`, `explorer /select,` and `xdg-open` of the folder show a thing, never run it.
147. (done: holds, Nov 12, round 28: `homelab report` and a phone's Report don't read `scripts/logs/media` or `reports/media`; no log line carries a URL, token or key, http errors drop the query; the files take the default mode, so another account on the same computer could read media titles, which needs someone already on the machine) **Tidy Up's job logs** (Low, privacy; `reports/media`, `media.LogDir`, `ui.open_log`): opened with the default umask (0644 likely); check their folder's mode, what a line can hold (`$ beet …` with titles and paths, a Subsonic URL with `t=`/`s=`, an error with a server's address), and whether `homelab report` or a phone's **Report** carries them.
148. (done: N67, Nov 12, round 29: the Inbox's beets call has an hour; the PDF counter 30 s, ffprobe 120 s, ebook-meta 60 s and calibredb add 300 s already had one; left: books_organizer.py's `sips` and `calibredb set_metadata`/`embed_metadata` have none, but the engine is vendored and kept unchanged, so a wrapper would mean launching it differently: the owner's call) **Parsers fed strangers' files** (Low; every tool Tidy Up runs on a download: ffprobe, the PDF page counter, `ebook-meta`, `calibredb add`, `sips`, `fpcalc` through beets, `fetch-ebook-metadata`): each should have a timeout, since the Inbox holds the media lock while it runs and a crafted file that hangs a parser would stall Tidy Up for good. List each with its timeout and test one without.
149. (done: Nov 12, round 30: the books review sends a book's title and first author, and its ISBN for a cover, to `fetch-ebook-metadata`, which asks the sources enabled in Calibre's own preferences; the Posture row says so) **What the books cleanup asks outside** (privacy, Rule 3; `books_organizer.py` `fetch_bin`, Calibre's metadata download): which sources `fetch-ebook-metadata` asks (Google, Amazon, …), with what (title, author, ISBN), and add them to the Posture row.
150. (done: holds, Nov 12, round 32: Tidy Up sends Tdarr only plugin names and their settings; the plugins are Tdarr's own community ones, from its publisher like its image (`haveagitgat/tdarr:latest`, taken by the nightly update), so they carry the same trust as the image; holding Tdarr back as N54 holds Vaultwarden would be the owner's call) **Tdarr's plugins** (Low; `tdarr_setup.py`, `plugin_stack`): the stack names community plugins, which Tdarr runs as code in its container with the libraries mounted. Check where Tdarr gets them (its own image or a fetch from GitHub at run time), whether they update by themselves, and whether the homelab pins them.
151. (done: N68, Nov 12, round 31: control characters but newline and tab taken out; over 100,000 characters not written) **Lyrics written into songs** (Low; `music_tidy.py` lyrics): LRCLIB's text goes into each song's tags or a `.lrc`. Check it is stripped of control characters and held to a length, since Navidrome, Jellyfin and players then show it (and a web player could draw markup from it).
152. (done: holds, Nov 12, round 30: Tidy Up sends no ntfy alert at all; the filed record is read only by the app's own screen and the media jobs, and no alert asks ntfy for markdown) **A download's names in alerts** (Low; ntfy messages that name what Tidy Up filed, the weekly digest): a title from a stranger's tags with markdown or a link, shown on a lock screen as the homelab's. Check which messages carry a download's name and whether ntfy is asked to render markdown or click links.
153. (done: holds, Nov 12, round 32: `RepairVenv` only removes a broken venv; the remake is the same one-time setup, which installs with `--require-hashes` from the pins for its Python and refuses a Python with none) **The music venv remade** (Low, after N28; `internal/media/venv.go`): when Python changes the venv is removed and made again; check the remake installs with `--require-hashes` from the constraints file, as the first install does, and fails closed when no constraints file fits the new Python.
154. (done: holds, Nov 12, round 32: no pin is refused plainly, nothing fetched; and `ffmpeg-pins.json` is `{}` today, so Install is offered nowhere until the pins are made, a gap in the feature, not a way in) **Install, for ffmpeg, on a system with no pin** (Low; `FFmpegPins`): check that a system or architecture missing from `ffmpeg-pins.json` is refused plainly, never fetched from a URL built at run time.

Added after round 32 (items 131–154 done; audited what a phone and the page may point Tidy Up at; worst first):

155. (done: holds, Nov 12, round 33) **A phone moving Tidy Up's folders** (`phoneEveryday`): a phone allowed changes may only turn the Inbox on or off (`TIDY_INBOX`) and pick its timing; the inbox folders, each library and `MEDIA_ROOT` are the computer's. An unknown `TIDY_MUSIC_ENGINE` is read as "auto", and the beets image isn't a setting.
156. (done: holds, Nov 12, round 33) **Where should your libraries live?** (`TidyPlace`, `TidySetMediaRoot`): the app's own page only, an absolute path, the owner's choice; it makes the folder and saves `MEDIA_ROOT` through Settings.
157. (done: holds, Nov 12, round 33) **The music engine's container mounts** (`music_organizer.engine_in_container`, vendored): each folder goes as `-v path:path`, so a path with a `:` doubles into a spec Docker refuses, never mounts another folder; the image is the household's own running beets container's.
158. (done: holds, Nov 12, round 33: `Paused` starts them again on a normal end, an error and Stop (Ctrl-C reaches `__exit__`); updates leave the library apps while the media lock is held, and the watchdog's heal never starts a stopped container (only running-but-unwell or gone ones); only a job killed outright leaves them stopped, and they show as down like any app that stopped) **Containers left paused** (Low, availability; `mo.Paused` around the books apply and build): Calibre-Web and the other apps reading the books library are paused while Calibre writes. Check they are unpaused when the job crashes, is stopped, or the computer sleeps mid-job, and that Status says so if one stays paused.
159. (done: Nov 12, round 33: nothing empties it, and the docs never said it was there; docs/Tidy Up.md now says where it is and to empty it before the drive goes to someone else. The owner chose, Nov 12: empty it after 30 days; built in round 38: the nightly scrub removes a day's folder over 30 days old unless a trash-log line still points into it, real folders named for a date only, never through a link) **Windows' `.tidy-trash` on a removable drive** (Low, privacy; `_trash_beside`): a USB drive or network share has no Recycle Bin, so Tidy Up keeps a hidden dated folder at its top. Check whether anything ever empties it, and that Undo's 30-day pruning reaches it, since the drive may go to someone else with everything Tidy Up threw away still on it.

Added after round 38 (the owner chose a fresh audit pass, Nov 12; the packages the audit had never named, and the workflows):

160. (done: holds, Nov 12, round 39) **The CI and release workflows** (`.github/workflows`): every action pinned to a full commit; no `pull_request_target`; no pull request, issue or comment text in a `run:`; `issues: write` used only by scheduled nightly runs, with fixed words; the release runs on main and tags only; the artifact cleanup's `actions: write` only by hand.
161. (done: holds, Nov 12, round 39) **Rootless Docker's downloads** (`internal/rootless`): Docker's static builds and Compose fetched over HTTPS and checked against SHA-256s pinned in the app before anything is unpacked; the tarball's regular files only, by their base name.
162. (done: holds, Nov 12, round 39) **The jobs' launchd and systemd files** (`internal/schedule`): the plist's every value XML-escaped; each systemd argument quoted, `%` doubled, so a homelab folder's odd name can't add a key or a specifier.
163. (done: holds, Nov 12, round 39) **The recovery kit** (`internal/recovery`, `homelab recovery-kit`): written 0600; it names the backup folder (`BACKUP_DESTINATION` is a folder, never a URL with a login), the apps and the people, and leaves the Secrets passphrase to be written on by hand.
164. (done: holds, Nov 12, round 39) **Pocket ID's client secrets** (`internal/sso`): each app's in `data/sso/<app>.env`, 0600 in a 0700 folder, a value spanning lines refused, carried by the encrypted Secrets job (item 18).
165. (done: holds, Nov 12, round 39) **`internal/api` and `internal/setup`**: `api` has no listener of its own (the engine's view, read in the process); `setup` fetches nothing and checks a domain already held to `validDomain`.
166. (done: N71, Nov 12, round 40: `core.ListenTray` on `tray.sock` beside the engine's socket, on all three systems; `QuitTray` asks there and at the old address) **Item 105 on Linux and Windows** (Low): the tray's quit and its "another tray is running" check go through 127.0.0.1:47231, which any account on the computer can reach or hold. A socket in the account's own folder (as the engine's, item 83) on Linux, and a named pipe with the account's own ACL on Windows, can be built and tested here; the Mac's half needs a Mac.

Added in round 41 (Nov 13; the backlog was empty: #654's Send to my phone, and surfaces the log had never named):

167. (done: N72, Nov 13, round 41) **A sent page passed on unchecked** (Low; `companion.FollowSent`, the events stream): the desktop app checks `MayOpen` when it sends, and the companion passed the file on up to two minutes later to whichever phone it named. Check again, with the phone as it is paired then.
168. (done: holds, Nov 13, round 41: `data/` is written only by this account's own processes; no container mounts `data/` or the homelab folder whole, and the folder is 0700; a send is a few hundred bytes the desktop app writes) **The send folder's size** (Low; `data/phone-sent`): the companion reads every `.json` there each second with no cap on count or size.
169. (done: holds, Nov 13, round 41: the window serves only the embedded assets; every link in the page is `href="#"` or its own address with `preventDefault`, and goes through `App.Open`, which opens only http, https and mailto in the browser) **The desktop window's navigation** (Wails): can a link in the window take the window itself to a remote page that could then call the Go bindings?
170. (done: holds, Nov 13, round 41: `html/template`, 0600 in a 0700 folder, carried only by the encrypted Secrets job with `data/people`) **Welcome pages** (`people.Render`, `OpenWelcome`): each person's name, apps, addresses and an app's first password in HTML: escaping, file mode, and which backup carries it.
171. (done: holds, Nov 13, round 41: only a setting marked secret and saved; never sent to the page; cleared after 90 seconds unless something else was copied) **Copy a saved password** (`CopySetting`, the clipboard).
172. (done: N73, Nov 13, round 41) **Release notes in a terminal** (Low; `internal/releases`, `homelab updates notes`): a stranger's tag, name and notes printed as they came, with escapes; a release link anywhere; `.`/`..` as a project.
173. (done: holds, Nov 13, round 41: availability only; a client that can't reach the engine follows Docker itself, as `engine.Follow` already does when the engine is gone) **The engine's socket under a long home folder** (after N71's fix): `engine.sock` has the same 104-byte limit on macOS.
174. (done: holds, Nov 13, round 41: the link only opens the app's page with the action waiting for one confirming tap (`DeepLink.swift`), and the companion checks the phone's permission on the call itself; ntfy's header carries only `homelab://` links, plainly) **An alert's Restart button** (`internal/notify/actions.go`, `?do=restart`).
175. (done: holds, Nov 13, round 41: a crash's stack and the process's name, 0600 in the logs folder; nothing reads the environment, and nothing sends it anywhere) **Crash reports** (`internal/crash`).
176. (done: holds, Nov 13, round 41: `TestASendReachesOnlyItsPhone`; the device ID is never sent on, `json:"-"`; a kiosk's and an owner's stream pass every other change as before, a member's through `ForMember`) **Every phone's stream after #654** (`events`, now one `StreamOnly` for all).

## The security team

### Hand-off: where the security loop stands (Nov 12, 2026, 3:00 PM ET)

The second account ran this loop all day and handed it to a fresh session here. Read this first.

- **State:** no security PR is open; main has every finding through **N57** (`docs/Security.md`, "Threat review (November 2026)"). Every package has been read once (item 128). The backlog runs to item 130; all are done or decided (105: N71) and no open item from 131 on but 105 and 113 (151: N68; 148: N67; 142: N66; 98: N58; 131: N59; 132: N60; 133: N61; 134: N62; 138: N63; 135: N64; 137: N65), left open with their reasons in the backlog below.
- **Last merges read:** everything through **#663** (round 42: #659, #661, #662 and #663 are the other account's card Collection, its photos, its prices from TCGdex and the iPhone's Collection). Start the next round at the first merge after `40c7270`.
- **Each round from here:** `git fetch origin`; read every PR merged since the last one by its diff, riskiest first: a new `phoneMethods` entry in `cmd/homelab/serve.go` (which permission, what it writes), anything building a URL, path or command from input (escaping leaves `.` and `..`, as N57 found), anything a phone or another household member sends that is stored and later unpacked (sizes in bytes *and* pixels, as N56 found), and update and provenance code. Display-only changes (Swift views, TSX without raw HTML or links) get a quick scan. Record each round in the done log at the end of this section.
- **Splitting the work (the owner, Nov 12):** this session does the security audit only; the other account does feature work. Never touch the other account's PRs or features. Fix security holes yourself, each with a test that fails first.
- **Asking the owner:** always as a multiple-choice question (AskUserQuestion), never open-ended. Report briefly each round with the time in **Eastern** (UTC−5 in November: 19:00 UTC is 2:00 PM ET; check with `TZ=America/New_York date`).
- **What the owner decided** (don't ask again): this account goes back to the household tester's job ("Account 3's job" at the top of this file: usability first, the open UX backlog items 2–11, findings handed to the screen's owner), with security kept short: every merge still read, and a real hole fixed at once (Nov 13, after N73, with the security backlog empty and N71–N73 released in v0.34.4); the books engine runs through `books_run.py` with time limits, `books_organizer.py` unchanged (Nov 12, N70); Tidy Up empties its own `.tidy-trash` on removable drives after 30 days, past Undo's reach (Nov 12); no daily cap on this loop's merges (Nov 12, 7:25 PM ET: "do as many as you can in one day"), each still only once every check on its head is green; Vaultwarden, Pocket ID and CrowdSec hold a new release 3 days (N54); a git checkout moves only to verified releases (N55); a lost phone's token is kept as it is (item 86).
- **CI and merging:**
  - A PR touching `compose/**`, `stacks/**` or `test/realdocker/**` runs the real-Docker job, about 40 minutes; others take about 15.
  - Main moves often and `CHANGELOG.md` conflicts each time: merge `origin/main` into the branch and keep both entries. Never rebase or force-push a pushed branch (the classifier refuses it): put a rebased branch back on the remote's commit and merge instead.
  - A new field on a type the desktop app returns needs `cd app && go test -run TestBindings -update .` (it writes `web/types/backend.d.ts`).
  - Merge only when every check on the current head is green, with `expectedHeadSha`, squash. After a merge, restart the branch from main.
- **Running checks from a cloud session:** `go test ./...`, `make lint`, `bin/gosec -quiet -exclude=G104,G204,G301,G302,G304,G306,G702,G703 ./<pkg>/...`, `go run ./cmd/homelab validate` and `docs --check`, and the package's line in `coverage-floors.txt`. govulncheck can't reach its server here; CI's security job runs it.

You audit every way into the homelab's own code: what can reach it, what
guards it, and whether the guard holds. Start from docs/Security.md: its
**Threat review of the app** was read against 0.6.0, and much has been
added since. Your findings go in a new section there, **Threat review
(November 2026)**, in the same table form (H/M/L with an ID, the finding in
plain words, the fix), each ticked when its fix merges.

**How to look.** Read the handler or function, then attack it with a test:
a paired phone with the wrong permission, a crafted file, a value with a
newline or `../`, a request from a public address, a body too large. Run
`make security` (govulncheck, gosec, npm audit) every round. From a cloud session govulncheck can't reach vuln.go.dev (refused): run gosec and npm audit by hand there, and count on CI's security job, which runs all of `make security` on every PR, for govulncheck. Say which ran. A finding
needs a test that shows the hole; a fix needs that test passing.

**Risk**, as in docs/Security.md: **High** is reachable from outside the
machine without a secret, or loses data or secrets; **Medium** needs a
paired device, the home network, or a file someone else made; **Low**
needs something already broken or someone already on the machine.

### Security backlog, in order

1. **The phone companion since 0.6.0** (internal/companion, cmd/homelab
   serve.go): every method in `phoneMethods` against every permission
   (looks only, changes, kiosk, Finances view and edit, plain HTTP vs
   encrypted); `StatusBoard`'s stream and `/api/events`; `AppIcon` and
   `Logs` with crafted app IDs; the 4 MB call limit (#336) and what a
   paired device can make the computer do with it.
2. **Finances' data** (internal/finance): `SaveFinances` from a phone with
   a stale or forged `Rev`, a huge or hostile plan (deep nesting, thousands
   of payments, own logos past `MaxLogo`), and that finance.json stays 0600
   and in the encrypted Secrets job only. The same for the ledger (#337,
   `SaveFinancesLedger`, data/finance-ledger.json): a phone sends the whole
   ledger, so after years of imported transactions (about 16,000 at 250
   bytes each) it meets the companion's 4 MB call limit. Find what the
   phone then shows, and make it fail plainly or send less.
3. **Settings › People** (internal/accounts, cmd/homelab person.go):
   `JELLYFIN_API_KEY` and `NAVIDROME_ADMIN_*` never printed or sent to the
   page; the welcome page holding a password (0600, folder 0700, never in a
   backup in the clear); a person's name or username crafted to break the
   page's HTML or a command.
4. **The home DNS record** (internal/domain home.go, `UpsertHome`): a
   private address in public DNS (what it tells the world; DNS rebinding
   against the apps and the companion); the watchdog moving the record with
   the Cloudflare token; `data/home-address.json` edited by hand.
5. **`homelab rebuild`** from backups: archives from Duplicati unpacked
   safely (links, `../`, absolute paths, as M2 fixed for move files); the
   Secrets passphrase never printed or kept.
6. **Connect apps** (internal/wiring): API keys read from each app's config
   files (a crafted config.yaml or settings.json); keys sent only to the
   app's own address.
7. **The Windows update** (internal/selfupdate's PowerShell script): every
   path or value placed into the script, elevation only when needed,
   update.log holding nothing secret.
8. **The agent and its socket** (`/v1/cards`, `/v1/events`): still owner-only
   and read-only, cards holding nothing a phone should not see.
9. **Explain and Ollama on Docker's address** (#332): what else can reach
   `172.17.0.1:11434`; logs sent to the model with secrets taken out.
10. **The release pipeline**: actions pinned, permissions least, the DMG
    smoke copy (#335), what a pull request from a fork can and cannot do.
11. **Secrets in logs and reports**: every log line and `homelab report`
    against a `.env` full of distinctive fake secrets; none may appear.
12. **Re-check the 0.6.0 findings** (M1–M6, L1–L5): each still fixed on
    main, each with a test that would catch it coming back.

Done or checked so far (see Security done): 1 (in part), 3, 4 (in part),
5, 7, 8, 9, 10, 11, 12. Added after Finances batches 3–4 (November 1):

13. **Receipts from a phone** (#340, internal/finance receipts.go,
    SaveFinancesReceipt): a PDF or picture crafted to look like another
    kind, a receipt shown back inside the app (a PDF in a frame: what the
    app's web view runs in it), and how many a phone that may change
    Finances can keep (the disk, MaxReceipt, pruning).
14. **Bank files brought in** (web/src/finances importData.ts): a CSV or
    OFX/QFX file that is huge, malformed, or holds markup; nothing of it
    may run, and a bad file says so plainly.
15. **The ledger from a phone at the 4 MB call limit** (item 2's note):
    what a phone shows past it, and whether it should send less.
16. **Kiosk screens and logs**: a wall screen may read redacted logs and
    reports (N2); decide with evidence whether it should be refused them.
17. **DNS rebinding against the companion and the agent** (item 4's rest):
    a website pointed at this machine's address, with the home record's
    public name; what answers without a token.
18. **Every file the homelab writes under data/** with a secret or money in
    it: 0600, in the encrypted Secrets job only, and never in the AppData
    job in the clear (finance.json, the ledger, receipts, people, sso,
    phones.json, home-address.json).

Added after round 14 (#355–#402: Tidy Up, Stop for a while, the money card):

19. (done: round 15) **`data/stopped.json` written in place** (internal/stopped, #367,
    #375): the awake job (each minute), `homelab stop --until`, and a
    phone's `StopUntil` each read, change, and write it whole with
    `os.WriteFile`, no lock and no rename. A torn or lost write forgets an
    app stopped on purpose, and the watchdog starts it again. Show it with
    a test (two writers, or a read during a write), then save it as
    record.go does (a temporary file, then rename) under a lock.
20. (done: round 16) **Tidy Up's Undo from a crafted trash log** (data/media-trash.jsonl,
    `homelab media restore`): what the engine moves where when a line's
    `from` or `to` is a path outside the libraries, or a link.
21. (done: round 17) **Tidy Up's page-sent arguments** (app/tidy.go `TidyRun`'s `args`):
    passed to the CLI as they come; list which flags the media commands
    take and whether any of them reaches outside the libraries.


22. (done: round 23) **`data/started.json` written as stopped.json was** (internal/started,
    #411): six writers (Start and Restart, updates, Fix it, the watchdog,
    the battery saver, a drive back, the stop timer) each read, change,
    and rewrite it in place with no lock. Only the "up 9 minutes" hover
    reads it, so a lost or torn write costs a reason on a hover, nothing
    more; save it as stopped.Update does (lock, temporary file, rename).

Added after round 27 (the backlog was empty; worst first):

23. (done: round 28) **An app's own secrets in what leaves its log** (#427's restart-loop
    alert, Explain, `homelab report`, a phone's Logs): each takes out only
    the values in `.env`. An app that prints a secret of its own at start
    (a database URL with its password, an admin token it made, a
    `token=` in a URL it logs) sends it to ntfy and every phone. Run each
    catalog app's startup log through `redact` and look; take out
    credentials in URLs (`://user:pass@`) and `key=`/`token=` values too.
24. (done: round 29) **`homelab move in` from a file someone else made** (internal/move):
    besides links and tickets, a bundle brings `.env` (a `TUNNEL_TOKEN`
    for its maker's Cloudflare tunnel, which would put the apps on their
    domain), `data/phones.json` (their paired phones, able to change
    things), and sso. What does move in say before it applies them, and
    should it unpair phones and ask before keeping a tunnel?
25. (done: round 30) **Apps started without a turn** (#425's decision): a drive coming
    back (#423), the battery saver, and the stop timer start apps while an
    update or backup may have them down on purpose. Show one starting an
    app mid-backup (its database stopped for the dump), then decide.
26. (done: round 31) **Release notes from GitHub** (#419, internal/releases): the repo is
    taken from an image's own `org.opencontainers.image.source` label, so
    a custom app's image picks any repo; check the path built from it
    (`..`, `?`), that the notes are drawn as text (no raw HTML, no
    `javascript:` links), and what the lookup tells GitHub.
27. (done: round 35) **What CrowdSec stopped** (#430, once merged): scenario, network, and
    country names come from outside; drawn by Preact, but check the phone
    and a kiosk get `Protection` only with the permission they need.
28. (dropped Nov 6: `apple-client/` is Account 4's) **The native Apple client** (#424, apple-client/, once merged): the
    pairing token in the Keychain (not UserDefaults or a backup), the
    companion's certificate checked, nothing secret in widgets, the lock
    screen, or a crash log.
29. (done: round 52) **Phones that expire** (`claude/feature-phones-expire`, once its PR
    is open): an expired phone refused on every method and on a stream
    already open, and a clock set back not bringing it back.
30. (done: round 53, on #457) **The update window** (`claude/feature-update-window`,
    `data/update-days.json`): a window must not hold a security release
    forever, and a crafted record must not stop every update.
31. (done: round 32) **Explain on another machine's Ollama**: what the model is sent when
    `OLLAMA_HOST` points off this machine (item 9 checked only
    172.17.0.1), and whether that counts as leaving the machine (Rule 3).
32. (done: round 59, Tailnet devices on #465; Two-step not built) **Tailnet devices and Two-step sign-in, nudged** (the roadmap's next
    Security items): the Tailscale API key and each app's admin key used
    to read them stay in `.env`, and Remove a lost device is computer
    only, never a phone method.

Added after round 36 (four left, all waiting on other lanes; worst first):

33. (done: round 37) **The Docker socket in apps' hands** (internal/dockerapi, the compose
    files): list every container that mounts `/var/run/docker.sock` (or
    the Docker Desktop and OrbStack sockets), read-only or not, and
    through a socket proxy or not. A container with the socket is root on
    the machine; one reachable through the proxy or the tailnet (Dozzle,
    Homepage, Beszel) is a way in.
34. (done: round 38) **The companion on a public name**: with a domain and the Cloudflare
    tunnel, can `phone.<domain>` (or any name) reach `homelab serve`?
    If so, the pairing code's length, expiry, and guesses allowed per
    minute from the internet decide whether a stranger can pair.
35. (done: round 39) **What is public by default** (internal/npm, install, custom apps,
    Connect apps): the PR template promises no app goes on the internet
    by default; check each path that makes a proxy host (a new app, a
    custom app, an adopted one) against that, and the access list each
    gets.
36. (done: round 40) **Homepage's widget keys** (internal/homepage): its config is written
    0644 into `data/appdata/homepage`, which the AppData job copies in
    the clear (N9). Does any widget's config carry an app's API key, and
    does Homepage serve it to a browser?
37. (done: round 41) **Adopting a container** (internal/adopt): moving an app you already
    run into the homelab reads its environment (passwords included):
    where those values go (`.env` 0600, or a compose file 0644), what is
    printed, and whether its volumes may name any host folder (`/`,
    `/etc`, the home folder).
38. (done: round 51) **Quiet hours** (#439, once merged): a crafted or careless setting
    must not silence the alerts that matter at night (a ban that failed,
    a backup that failed, a disk dying, the tunnel down).
39. (done: rounds 42 and 46) **What ntfy carries** (the weekly summary, the morning line, Finances
    reminders, restart-loop logs): ntfy may be on a public name, and a
    phone's lock screen shows the first lines; list what each message
    holds (amounts, names, log lines) and what a lock screen shows.
40. (done: round 43) **Tailscale** (internal/tailnet): the homelab never turns on Funnel;
    what `tailscale serve` (or the apps' tailnet addresses) offers to
    every device on the tailnet, shared-in devices included.
41. (done: round 44, N21 open) **The proxy's CrowdSec start script** (dockerfiles/npm-crowdsec
    homelab-init.sh): runs as root in the proxy's container with the
    bouncer key; how the key is passed and kept, and file modes.
42. (done: round 45) **Crash notes** (internal/crash, with #436's cleanup): what a note
    holds (a panic can print values, secrets among them), where it is
    kept and at what mode, and whether a report or a phone gets it.
43. (done: round 46) **The kit's writes** (internal/kit): files go through a fixed
    `<name>.kit-tmp` and `.local` copy, which follow a link put there by
    someone else on the machine (Low); and that the kit a newer app
    brings comes only from the signed app itself.
44. (done: round 54, N24) **What the self-update trusts** (internal/selfupdate): the checksum
    it checks is GitHub's own `digest`, from the same API as the
    download, so it catches a broken download but not a release swapped
    on GitHub. Does the Mac copy's code signature (and Team ID) get
    checked before it replaces the app, and what do Linux and Windows
    check?
45. (done: round 55, N25 open) **Pairing's demotions are separate saves** (internal/companion
    server.go `pair`): a kiosk or a phone paired over plain HTTP is saved
    first with the code's permissions, then lowered in up to three more
    saves (`SetCanChange`, `SetFinances`, `MarkUnencrypted`). With N22's
    race, or a save that fails part-way, a wall screen or a Wi-Fi-paired
    phone could keep Can make changes or Finances. One save, or a test
    that each failure leaves the device with less.
46. (done: rounds 56 and 57, N26) **A kiosk is not remembered as one** (`Device` has no kiosk field):
    kiosk mode is enforced only at pairing, so the Phones page can later
    give a wall screen Can make changes or Finances with nothing saying
    it is a screen anyone walking past can use. And which `phoneMethods`
    a kiosk may call beyond Status (Logs, AppIcon, a Finances card).
47. (done: round 57) **The pairing limit** (`tooMany`): global or per address? A device on
    the Wi-Fi sending wrong codes may lock the household out of pairing
    for 10 minutes; check the code's length and lifetime against the
    limit, and that the limit holds across a restart of `homelab serve`.
48. (done: round 57, notes for the Finances session) **The Finances calendar link** (`/finances.ics?key=`, the Finances
    session's code): a key in a URL ends up in calendar apps, their sync
    servers, and proxy logs. What it shows with Hide amounts on, how it
    is turned off or changed, and that a wrong key is refused at the same
    rate limit as a code. A real hole is fixed in its smallest form;
    anything less goes in the PR for that session.
49. (done: round 57) **The phone's offline page across homelabs** (#453, web/dist/sw.js):
    the copy is kept per address, not per pairing, so a phone paired again
    to another homelab at the same name (a new computer, a move) is
    served the old page until it is reached; check that nothing kept
    carries a token or answer from the other one, and the worker's scope.
50. (done: round 57, N27) **What each holder of Docker's socket may do** (after N18's pins): a
    read-only mount does not limit Docker's API. List each app that gets
    the raw socket rather than `docker-socket-proxy`, and the proxy's
    allowed endpoints (POST, EXEC, CONTAINERS) against what each app needs.
51. (done: round 57) **Duplicati's passphrase** (the backups' own secret): where it is
    kept (.env, Duplicati's database), whether a move file, `homelab
    report`, or the Secrets job carries it, and what someone holding only
    the off-site copy can read.
52. (done: round 57) **The proxy's own admin page** (Nginx Proxy Manager): the address its
    admin port is bound to (the LAN, or this machine only), who changes
    its first login and when, and that it is never itself a proxy host
    (N19's question, asked of the proxy).
53. (done: round 57) **ntfy on a public name** (`homelab notify setup`): the server's
    default access, the publish and read tokens' reach, and whether a
    stranger can read the topic or send a fake alert ("backup failed,
    open this link") that a phone shows as the homelab's.
54. (done: round 57; N28 fixed in round 63) **The music jobs' Python** (internal/media, the beets venv #444 and
    #454 remake): the venv is made with whatever `python3` comes first on
    PATH and installs beets from PyPI at the first run. Is the version
    pinned, with hashes? A remade venv fetches it again, unattended.
55. (done: round 58, N29 open) **Windows and Linux updates rest on the release alone** (after N24):
    neither build is signed (release.yml signs only the Mac's), so the
    app checks GitHub's checksum, from the same release. The release has
    build provenance (`actions/attest-build-provenance`); checking it in
    the app, or a key the app carries (minisign), would tell a build the
    workflow made from one put up by hand. Windows also asks for Authenticode.
56. (done: round 59) **Duplicati's error text** (Backups, a phone's Backups, the
    watchdog's alert, `homelab report`, #463's weekly check): a failed
    backup's message can name its destination; check that no login in a
    destination URL (`auth-username`, `auth-password`, a key) reaches a
    phone, ntfy, or a report.
57. (done: round 60, N30) **What a custom app may take** (stacks/custom, cmd/homelab custom.go,
    and a move file's own apps, N16): `privileged`, `network_mode: host`,
    `pid: host`, Docker's socket, or `/` mounted are taken without a word.
    Name them before it starts, as N16 names its image.
58. (done: N35) **Apps with no sign-in when `BIND_IP` is the LAN address** (Dozzle,
    `local: true`, and any app whose port is on `BIND_IP`): which then
    face the whole home network, and whether Settings says so when the
    address is changed.
59. (done: the independent review, Nov 10; holds) **CrowdSec's API on the shared network**: whether any app on
    `homelab` can reach the LAPI, and what it could do there (read
    decisions, add or remove a ban) with or without the bouncer key.
60. (done: the independent review, Nov 10; holds, now tested) **Databases on the shared network**: every app's database should sit
    on its own project's network, never on `homelab`; a test like
    N27's over the catalog would hold it.
61. (done: holds) **Vaultwarden on a public name**: `SIGNUPS_ALLOWED` and the admin
    page (`ADMIN_TOKEN`, hashed or not) when it goes through the tunnel,
    as N19 asked of the apps with a first account.
62. (done: holds) **Uptime Kuma's status pages and push URLs** on a public name: what
    a stranger can read or post there.
63. (done: holds) **Homarr's `SECRET_ENCRYPTION_KEY`**: made where, kept 0600, carried
    by which backup, and what Homarr keeps with it (the integrations'
    keys).
64. (done: holds) **The app's link to the agent on Windows** (the named pipe or local
    port item 8 read on the Mac): who on the same computer may use it.
65. (done: N33, #562) **The tunnel's catch-all kept by hand** (`MergeIngress` keeps a
    catch-all someone added): one that sends every hostname to the proxy
    would put each home-only app behind the tunnel; say so when it is
    there (round 58 found the homelab's own catch-all answers 404).
66. (done: N36) **Dozzle on the shared network**: Dozzle (every container's logs) is
    on `homelab` (its stack's default), so any app there can read every
    log at `dozzle:8080` without a sign-in, as N27 was for the socket
    proxy's environment. It needs no proxy host (`local: true`), so its
    own network (with a gateway, for its published port) and the socket
    one may be enough: try it on real Docker.
67. (done: N38, the public side, with its test; the tailnet side is a decision, Nov 10: in Home mode the tailnet is how the household reaches a new app to make its first account, so holding unclaimed apps off it would lock the owner out of their own setup; it is the household's own network, a risk only on a tailnet shared beyond it, which Tailscale.md could say) **Apps whose first visitor becomes the admin**:
    - On the internet this holds. `internal/claim` keeps Immich,
      Audiobookshelf, Komga, Navidrome and Calibre-Web off the tunnel until
      each has its first account, and Nextcloud and Paperless get theirs
      from `.env`.
    - Two things are missing:
      - A catalog test that every `public: true` app either takes its first
        account from `.env` (`login:`), has a claim check, or is named as
        having no accounts (Feishin). Without it, a new public app could
        slip through.
      - The tailnet. `tailnet setup` gives every running web app a listener
        at once, so Firefly III, Linkwarden, Tandoor, Memos, Docmost,
        Wallos, Ghostfolio, Baikal, Tdarr and Paperless-AI can be claimed
        by anyone on the tailnet first. That matters on a tailnet shared
        with family or friends. Use the same claim check before the serve
        listener, or say so on the app's page.
68. (done: N41, Nov 10; the owner chose to narrow them; Nextcloud, Firefly III and its importer are on `homelab-front` only and trust the proxy's and Tailscale's fixed addresses there) **Apps that trust forwarded headers from everyone**: Nextcloud has
    `TRUSTED_PROXIES: 172.16.0.0/12 192.168.0.0/16 10.0.0.0/8`, and Firefly
    III and its importer have `TRUSTED_PROXIES: "**"`. Through the proxy,
    N21 now hands them one address. But with "listen on the network" on,
    the app's own port is reached through Docker's gateway, a trusted
    private hop, so a device at home that sends `X-Forwarded-For` straight
    to the port still picks its address (brute-force limits). Firefly also
    trusts `X-Forwarded-Host`, which builds reset links. Narrow both to the
    proxy, and prove it with a realdocker case.
69. (done: holds after N21; the proxy overwrites both headers) **Every app that reads the client's address**: list each one and the
    header it reads (Vaultwarden `IP_HEADER`, Nextcloud, Firefly, Immich,
    Paperless, Pocket ID, Uptime Kuma). Add a catalog test that each reads
    a header the proxy overwrites (`X-Real-IP`) or a chain it cannot
    extend.
70. (done: holds, Nov 10; every public app is closed after its first account) **Sign-ups left open after the first account** (Linkwarden, Karakeep,
    Memos, Wallos, Immich: "turn sign-ups off" in their docs). Can the
    install close them by setting (Linkwarden
    `NEXT_PUBLIC_DISABLE_REGISTRATION`, Karakeep `DISABLE_SIGNUPS`, and so
    on)? Does Status say so while one is open on a public name?
71. (left, Nov 10: Paperless-AI is `admin: true`, never public; its window is the household's own network, as item 67's tailnet side; doing it needs a Paperless token made at install, worth it only with a test like the nightly's) **Paperless-AI 4's setup window (after N37)**: the install could call
    `POST /api/setup` itself with a user and password from `.env`, as the
    nightly test does, so the window closes the moment it starts.
72. (done: N39) **Gluetun's control server on the shared network**: its HTTP control
    API (`:8000`; `/v1/publicip/ip`, the forwarded port, `PUT
    /v1/vpn/status`) answers any container on `homelab`. Its auth depends
    on the version, and `:latest` floats. qBittorrent shares its network
    namespace, so `HTTP_CONTROL_SERVER_ADDRESS=127.0.0.1:8000`, or an auth
    file, keeps it to qBittorrent. Write the test first, as for N27.
73. (done: holds, Nov 10) **The database dumps in the backup's staging folder**
    (`/staging/databases`, every app's data, Vaultwarden's included): file
    and folder modes on the host, who else on the machine can read them
    between runs, and whether a failed run leaves them behind.
74. (done: holds, Nov 10) **The ntfy token in Duplicati's alert URL**
    (`http://ntfy:80/duplicati-alerts?auth=…`):
    - It is kept in each job's settings, so it shows in Duplicati's own
      page, its exports and its logs.
    - Is the token publish-only on that one topic?
    - What does someone holding it get?
75. (done: holds, Nov 10) **Beszel's agent on the host network**: it listens on
    `BESZEL_AGENT_PORT` (45876) on every interface, guarded by `KEY` alone.
    Check what it answers without the key, whether it can listen on
    loopback where the hub runs on the same machine, and how the key is
    made and kept.
76. (done: holds, Nov 10) **Kopia's server**:
    - `KOPIA_SERVER_PASSWORD` for user `admin` over plain HTTP. The port is
      this machine's own unless "listen on the network" is on. Does it go
      over the tailnet in clear?
    - What does `config/kopia/start.sh` pass (`--insecure`,
      `--without-password`)?
    - How is the password made and kept?
77. (done: holds, Nov 10; Finances' CSVs already escape, the data export is for import) **CSV exports a spreadsheet would run** (`internal/export`, `homelab db
    export`): payee and note text from a bank file that starts with `=`,
    `+`, `-` or `@` becomes a formula when the CSV is opened (formula
    injection). Prefix such cells with `'`, or say so beside the export.
78. (done: N40) **Apps that are local but still on the shared network**: N35 keeps
    Dozzle and beets off the tailnet and the domain, and N36 moves Dozzle
    off `homelab`. Add a catalog-wide rule: an app with no sign-in is on no
    network another app's user can reach, and get the list from the
    catalog, not by hand.
79. (done: N55, Nov 12, round 16: both channels move only to a release tag on the upstream branch whose verified build provenance names the commit the tag points at; anything else is refused) **The git checkout's upgrade trusts the branch tip alone**
    (`internal/upgrade`, `homelab upgrade`): `git pull --ff-only` from
    origin over HTTPS, then the new version's `up` runs. N29 made release
    downloads prove where they were built; a source checkout has no such
    proof. It is done by hand and lists the commits first. Could it check
    that the new tip is signed by a key the checkout already trusts (`git
    verify-commit` with an allowed-signers file), or move only to tags
    whose release was attested? Low.
80. (done: hardening, Nov 10) **A desktop alert's title read as one of
    notify-send's options** (`internal/notify/desktop.go`): the title
    went as a bare argument, so one starting with `-` was an option. Now
    `--` comes first; `TestDesktop` sends `-u critical …` as a title.
81. (done: hardening, Nov 10; `TestOpenURL` refuses file:, javascript:, an option and a host-less https) **The tray opens app addresses without a scheme check**
    (`app/tray/tray.go` `openURL`: `open`, `xdg-open`, `rundll32` on each
    entry's URL from Status). The URLs come from the catalog and its
    ports, but the desktop app's `Open` refuses anything but
    http/https/mailto (`webLink`). Give the tray the same check, and a test.
82. (done: holds, Nov 10: the proxy's access logs are files in its own volume, `homelab_core_npm-logs`, not its output, so Dozzle and `homelab report` never show them; only CrowdSec mounts them, read-only; reading them takes Docker or root, which is the whole computer already; CrowdSec sends a request's context on only with an alert, which the household's own calendar does not trip) **The calendar feed's key in the proxy's access log**: through the
    tunnel, `/finances.ics?key=…` passes Nginx Proxy Manager, whose access
    log keeps the request URI (the `npm-logs` volume), and CrowdSec reads
    that log. Who can read it, for how long, and could the key travel
    where the log drops it, or the line be redacted?
83. (done: holds, Nov 10: `Serve` sets the socket 0600 inside a folder made 0700, which also covers the moment before the chmod; the `TempDir` fallback is only for an account with no cache folder at all, and on Linux it is `$XDG_RUNTIME_DIR`, the account's own) **The engine socket's mode** (`internal/engine` `SocketPath`): its
    folder is made 0700, but what is the socket file's own mode? And what
    happens with the `os.TempDir()` fallback on a machine other accounts
    share?
84. (done: holds, Nov 10: a bank file is read in the page, on the person's own device, so a huge one can stall only their own screen; every phone call to the companion is capped, `MaxCall` and `MaxTunnel`, before it is read; Go's XML is not used for it) **Bank files brought in**:
    - Size and row limits on a file picked on the computer and on one
      arriving from the phone (Import a file), so a huge CSV or a deeply
      nested OFX cannot hang the app.
    - Go's XML expands no entities; check the limits it does have.
85. (done, Nov 10: a move file's own app that publishes a port beyond this computer, with no host IP, 0.0.0.0, ::, or any address but 127.0.0.1/localhost/::1/`${BIND_IP…}`, is now named "the home network, on <ports>" with N30's list; `homelab custom add` already writes `${BIND_IP}`; `extra_hosts` only adds names, so it is left) **What a custom app's compose may still widen** (`stacks/custom`;
    item 57 covered privileges): `network_mode: host`, `pid: host`, a
    published port on `0.0.0.0` ignoring `BIND_IP`, `extra_hosts`. Does
    `validate` warn for each, as it does for the socket?
86. (decided by the owner, Nov 12: keep as is; Remove revokes the phone's own key, lock 3; looked at Nov 10, left a decision: one Access service token, made `duration: forever`, is given to every phone at pairing; a lost phone keeps it, so lock 1 lets it through, but its device key is revoked at Remove and lock 3 refuses it. Rotating the token at Remove would bring lock 1 back too, at the cost of every other phone pairing again at home to go out: a choice for the owner; `homelab phone away --new-token` would be the shape) **The away API's Cloudflare Access credential**: how the phones'
    credential is made, where it is kept (on the phone and the computer),
    what it opens beyond `homelab-away`, and how a lost phone's is taken
    back.
87. (done: N54, Nov 12, the owner's decision: `hold: 3`, counted from when the homelab first sees a digest, 14 days at most; the notes are `homelab updates notes <app>`) **Vaultwarden and Pocket ID on moving tags** (`vaultwarden/server:latest`,
    `pocket-id:v2`): the nightly update takes each new image, and these
    hold every password and every sign-in. The socket holders are pinned
    (M6). This is a decision: pinning delays their own security fixes. A
    digest check against the release, or a short hold with the release
    notes shown, may sit between the two.
88. (done: N54, Nov 12, as item 87) **CrowdSec on `latest` with the proxy's logs and the bouncer key**: it
    reads every request and decides who is banned. Should it be pinned
    with the socket holders, or is its own hub update the trust anchor?
89. (done: N44 for Pocket ID, N45 for Home Assistant, both on `homelab-front` trusting only the proxy and Tailscale Serve) **Pocket ID and Home Assistant trust a forwarded address from
    any hop** (after N41): Pocket ID has `TRUST_PROXY: "true"` and is on
    `homelab`; Home Assistant's starter `configuration.yaml` trusts every
    private range. With Settings › Apps listen on the home network, a
    device on the Wi-Fi sends its own `X-Forwarded-For` to their ports.
    Move Pocket ID to `homelab-front` if its `TRUST_PROXY` can name the
    proxy's address (or check what it trusts), and give new Home
    Assistant installs the two front addresses (it runs on the host
    network on Linux: check where its requests come from first).

### Security done

- **N54 (Nov 12, round 15):** items 87 and 88 built as the owner chose: Vaultwarden, Pocket ID and CrowdSec take a new image only once it has been out 3 days (from when first seen, 14 at most), read from the registry without pulling. Next: item 79, a git checkout moving only to releases whose provenance verifies.
- **N55 (Nov 12, round 16):** item 79 built as the owner chose: `homelab upgrade` on a git checkout moves only to a release tag (testing: every release of main; stable: `vX.Y.0`), once the release's attestation verifies and its certificate names the very commit the tag points at. Commits past the newest release wait for the next one. Next: back to reading the other account's new merges, riskiest surfaces first.
- **N56 (Nov 12, round 16):** read #627 (the phone draws Finances' own logos): item 129, an image small in the file but enormous unpacked, built: Finances keeps one only at most 1,024 pixels a side, by its header, on save and on load.
- **Round 17 (Nov 12):** #626 merged. Read #628 (Back steps through tabs: frontend, and `TestTheTunnel` now checks a sealed answer by its fields and the box's bytes, no weaker), #629 (an account's page: frontend only, no raw HTML or links from the plan) and #630 (a loan's page: `Transaction.Extra`, kept only with a payment, saved through the ledger's own save, which a look-only phone can't call). Nothing new.
- **N57 (Nov 12, round 18):** read #631 (Investments as a list: frontend), #632 (the Watchlist: a phone method at Finances' edit level, Ghostfolio prices) and #633 (an account's page on the iPhone: display only). Item 130 from #632 built: every Ghostfolio address of a symbol refuses "." and "..", and a followed ticker's words are capped.
- **Hand-off check (Nov 12):** #635 merged. Read #634 (the Watchlist on the iPhone: it calls `FinancesFollow`, which N57 guards), #636 (a loan's page on the iPhone: the ledger's own save) and #637 (arranging the Dashboard, kept in the browser). Nothing new. Handed to a fresh session (the hand-off at the top of this section).
- **N58 (Nov 12, round 19):** nothing merged since #637 but the two hand-offs (#638, #639: prompt files only). Item 98 built: Undo puts a thing back only inside a library, an inbox folder, a scrubber root or the reports folder, with links and `..` resolved; the test failed first with all three crafted lines put back. `tools/media` is Account 1's; no open PR claimed it. Left: 105 and 113, each with its reason. The backlog is down to those two: next round audits again and adds new items.
- **N59 (Nov 12, round 20):** nothing merged since #640. Audited Tidy Up's records again and added items 131–142. Item 131 built: the Inbox's Undo moves only files in a library, only into an inbox folder; the test failed first with the SSH key moved into Downloads. Next: item 132 (beets' substring query).
- **N60 (Nov 12, round 21):** nothing merged since #642. Item 132 held on the pinned beets 2.14.1 (in a scratch venv): `albumartist:Queen` matched *Queen + Adam Lambert* too, and `albumartist::.` every album. Both the lookup and `rm -f` now ask `field:=~value`, which removed only the one album, `:.` included. Next: item 133 (keys on a redirect).
- **N61 (Nov 12, round 22):** read #641 (Finances budget bars: display only, no raw HTML or links). Nothing new. Item 133 held: a local server's 302 to another port received all five keys (Jellyfin, Tdarr, Audiobookshelf, Plex, Navidrome). `http_json` now follows a redirect to another origin with only Accept and User-Agent. Next: item 134 (Needs a look from a crafted record).
- **N62 (Nov 12, round 23):** item 134 held: a private video outside the inbox was named and filed. `name_as` now acts only inside an inbox folder. Items 136 and 141 checked: both hold. Next: item 138 (answers from outside read whole).
- **N63 (Nov 12, round 24):** read #644 (Finances: a Dashboard card opens what it sums up; navigation only, no raw HTML, links or phone methods). Item 138 built: every reply Tidy Up reads is capped (64 MB; lrclib.net 2 MB, MusicBrainz 8 MB). Next: item 135 (a move file brings Tidy Up's records).
- **N64 (Nov 12, round 25):** item 135 built: neither end of a move carries Tidy Up's Trash log, filed record or needs list (`skip`, Pack and Unpack). `go test ./...` passes. Next: item 137 (the Inbox's zips have no size cap).
- **N65 (Nov 12, round 26):** item 137 built: the Inbox adds up a zip's listed sizes before unpacking and refuses one that would leave its drive under 1 GB free. Items 139 (the Posture row, Tidy Up's lookups) and 140 (holds) done too. Next: item 142 (Tidy Up's records written in place), then audit again for new items.
- **N66 (Nov 12, round 27):** item 142 built: `save_state` writes through a temporary file of its own. Items 131–142 are all done or hold. Next: audit again and add new items (fewer than 5 open: only 105 and 113).
- **Round 28 (Nov 12):** #647 merged. Audited Tidy Up's outside calls, installs and folders again: items 143–154 added; 143 fixed (the Posture row now names fetchart's and lastgenre's services), 144–147 hold. Next: item 148 (parsers fed strangers' files, timeouts).
- **N67 (Nov 12, round 29):** item 148: the Inbox's beets call now has an hour; books_organizer.py's calls left (vendored). Next: item 149 (what the books cleanup asks outside).
- **Round 30 (Nov 12):** item 149 done (the Posture row names the books review's lookups), item 152 holds (Tidy Up sends no alerts). Next: item 151 (lyrics written into songs).
- **N68 (Nov 12, round 31):** item 151 built: lyrics from LRCLIB lose control characters and are held to 100,000 characters. Next: item 153 (the music venv remade).
- **Round 32 (Nov 12):** items 150, 153 and 154 hold. Items 131–154 are all done or hold. Next: audit again (the Go side not read since round 18: the companion's newest phone methods, `homelab move`'s other records, the desktop app's bindings that take a path).
- **Round 33 (Nov 12):** audited what a phone and the page may point Tidy Up at: items 155–159 added; 155–158 hold; 159 documented (the hidden `.tidy-trash` on Windows' removable drives). Next: audit again.
- **Round 34 (Nov 12):** read #646 (Finances: the Dashboard looks back at an account; display only). Audited records under `data/` that code later acts on as paths (N58's class): the copy before an update deletes a folder found on disk (`Checkpoint.Dir` is never saved), a crash note's `File` is the log found on disk (`filepath.Base` of a glob), and a title lookup's `From` is only shown. The companion has had no change since #632, read in round 18. Nothing new. Next: the next merge, or audit again.
- **N69 (Nov 12, round 35):** item 113 built on real Docker (`dockerd` started in the cloud session): Frigate's broker password piped into `mosquitto_passwd`, Firefly III's cron token kept in a 0600 file and sent through `printf`/`cat` into `nc`. `TestNoSecretAsAnArgument` guards both. Only item 105 (the tray's port, a Mac question) is left open. Next: audit again.
- **Round 36 (Nov 12):** #651 merged (N69). Read #649 (the other account's hand-off) and #650 (Finances: Transactions in columns, sorted by any of them; display only, no raw HTML, links, phone methods or commands). Nothing new. Next: the next merge.
- **N70 (Nov 12, round 37):** the owner chose (multiple choice) a wrapper for the books engine, emptying `.tidy-trash` after 30 days, and a fresh audit pass. Built the wrapper: `books_run.py` gives each tool the engine starts a limit, the engine unchanged. Next: `.tidy-trash` after 30 days, then the audit pass.
- **Round 38 (Nov 12):** `.tidy-trash` emptied after 30 days by the nightly scrub (`empty_old_tidy_trash`), a day Undo still reaches kept. Next: the fresh audit pass.
- **Round 39 (Nov 12):** the fresh audit pass: the packages the log had never named and the workflows. Items 160–166 added; 160–165 hold. Open: 105/166 (the tray's port), and nothing else. Next: item 166.
- **N71 (Nov 12, round 40):** items 105 and 166: the tray listens on a socket in the account's own folder (`core.ListenTray`), the kind the engine already serves on every system; `homelab quit` asks there and at the old address. No item is open. Next: the next merge, or audit again.
- **Round 41 (Nov 13, N72 and N73):** #655 merged (N71; the Mac's real tray test needed a short socket path under a long home folder, which a too-long path now falls back to, in a folder of the account's own). Read #654 (Send to my phone): one of the app's own links, to one phone, the title as text; N72 built from it (the companion checks the phone again as it passes a send on). The backlog was empty: items 167–176 added; N73 built (release notes in a terminal as plain text); the rest hold. Then read #656 (Open on the Computer: `OpenOnComputer` is a change, so only a phone allowed them; `MayOpen` with no member apps, so a member's phone may ask only Status; the app's own links with no action; the desktop window only goes to that page, the phone's name shown as text): holds. No item is open. Next: the next merge, or audit again.
- **Round 42 (Nov 13, usability first; N74 and N75):** task 7 run (People and the welcome page: four findings for Account 2, items 13 to 16). N74 found while writing the owner's spec for a member's private Finances (`.claude/prompts/private-finances.md`, for the other account's session): `data/members` was in no backup; now a record folder. Read #659 (the Collection: plan fields, clipped and capped), #661 (a card's photo: bytes and pixels by its header, a content name, the owner's phones only), #662 (prices from TCGdex on a click, the owner's yes: N75, a redirect followed anywhere, now only within TCGdex over https) and #663 (the iPhone's Collection). Next: task 1 or 3, and the private Finances PRs as they merge.

- **The owner's decisions (Nov 12):** items 87 and 88, a short hold before Vaultwarden, Pocket ID and CrowdSec take a new release; item 79, a git checkout moves only to releases whose provenance verifies; item 86, kept as is. Next: build 87 and 88, then 79.

- **Round 14 (Nov 12): every package has now been read.** Item 128 holds. From here a round reads what merges (the other account's PRs as they land, by their diff) and goes back over the riskiest surfaces when they change: the phone companion's calls and permissions, the tunnel, what is published, `.env` from a phone (N52's list), the updates. Open: items 79, 87, 88 (the owner's decisions), 98, 105, 113 (left, with reasons).

- **Round 13 (Nov 12):** items 124 to 127 hold (crash notes, the digest, disk health, Tidy Up against what a download names, the Inbox's zips). The other account's latest (#622) is Tidy Up's dark look. Next: what lands next, and what is left (internal/savings, battery, awake, storage).

- **Round 12 (Nov 12):** N53 merged. Items 120 to 123 hold (the calendar feed's key, adopting, claiming, what the desktop app starts). The other account's latest (#618, #620) are Tidy Up's look only. Next: ten new items, from what is left unread and what lands next.

- **N53 (Nov 12, round 11):** a username typed with `--username` was taken as typed and named a member's folder (`data/members/<username>`): `../../elsewhere` led outside. Now it must be one `people.Username` could make, where it is typed and where the folder is made. Items 116 to 118 hold. Next: what the other account merges, read as it lands, and ten new items.

- **N52 (Nov 12, round 10):** a phone allowed changes could save any setting but secrets and the ones it connects through: an app's image or version, open sign-ups, where the household signs in, what the away tunnel checks, which Docker, the folders mounted into apps and their owner. Now a list of everyday settings only (`phoneEveryday`). Found reading #614 (Settings on the phone's page), whose own change was the page; the calls were older. Items 114 and 115 hold. Next: ten new items.

- **N51 (Nov 12, round 10):** the desktop app's update on a Mac. An ad-hoc app (no Team ID) took any disk image the release listed, checked only against GitHub's checksum; now its build provenance too, as Windows' and Linux's (N29). Items 106 and 110 hold, 105 left. New: item 114. Next: item 114, then ten more from what has not been read.

- **N49 merged (Nov 12):** the real-Docker run passed with Kopia's checks on (snapshot, restore, read back after a move, through the new client).
- **N50 (Nov 12, round 9, item 111):** gosec with no rule left out: 427 findings, all of the eight excluded rules; the reasons in docs/Security.md hold. Its taint rule G702 pointed at `openLink`, which opened Tailscale's `AuthURL` from its status with `open`/`xdg-open`/`rundll32` unchecked; now only an https link with a host. Item 113 left (see it). Next: items 105, 106, 110.

- **N49 (Nov 12, round 8, item 112):** Kopia's CSRF checks are on again. The homelab's client signs in as Kopia's page does (the page's session cookie and token, again after a restart), the healthcheck reads the page, and the real-Docker case uses the same client. Read in Kopia 0.23.1's own source (`internal/server`, `apiclient`) for the cookie, header and meta names. Next: item 113, then 105, 106, 110, 111.

- **N48 (Nov 12, round 7, items 107 to 109):** Export and the companion's framing hold. Found: Kopia's server password on its command line, which every account sees in `ps` on Linux; now read from the environment, with `TestNoSecretOnACommandLine` over every script and compose file. Kopia's CSRF checks are off for the homelab's own client, which a web page could use while the household is signed in to Kopia: item 112, with the way to fix it. Two short-lived secrets on command lines: item 113. Next: item 112.

- **Round 7 (Nov 12):** items 99 and 100. What ntfy.sh learns holds (a message's ID and a hashed topic, never its words); ntfy's page now says exactly what. How to look says govulncheck runs only in CI from a cloud session. Item 98 (Undo only into a library) is left: the tools have no one list of the libraries yet, and a forged line needs `data/` and the Trash already. Then eleven new items (101 to 111), as nothing server-side merged since round 6 but my own: what has never been read (envfile, pgexec, backup passwords, root shells, all hold), and five left open. `make security` this round: gosec clean, npm audit 0 (govulncheck in CI). Next: item 109 (framing), then 107, 108, 106, 105, 110, 111.

- **N47 (Nov 12, round 6):** the backlog ran out after item 89, so eleven new items (90 to 100), from what merged since Nov 7: who can publish an alert, a `homelab://` link from anywhere, buys and sales from a phone, a sealed message replayed, Tidy Up's Undo, `/api/me`, the kept alerts and record, the ledger's size; all hold but one. Found: the tunnel's memory of what it had taken lived only in the running process, so a sealed message captured before a restart could be read again within `TunnelSkew`; now one sealed before this run began is refused, not counted as a wrong attempt. `make security`: gosec clean, npm audit 0; govulncheck can't reach its database from a cloud session (CI's security job runs it on each PR). Next: items 98 to 100, then 79, 87 and 88 (decisions).

- **N46 (Nov 12, round 5):** the imports in the browser, and Get the real logo beside them. Read and found holding: a bank's file is read on the device and shown only as text (Preact escapes it; the one `innerHTML` is the app's own icons), the import asks nothing of any website, the logos are kept in the app, an amount of a trillion or more is refused (N43), and the server checks each row's day, account, transfer, split and receipt name before it saves (`CleanLedger`); a phone needs Finances' edit permission to save. Found: the logo lookup took 198.18.0.0/15 (the homelab's own front and tunnel networks) and other reserved ranges for websites; now refused. Seen, not a finding: the ledger has no limit on a payee's or note's length or on how many rows there are, but only the household's own file or a phone allowed to edit Finances can add them. Next: the backlog's next item.

- **N45 (Nov 12, round 4):** backlog item 89's Home Assistant half. It was on the Docker network, not the host network as the backlog guessed. It moved to `homelab-front` alone, the starter trusts the two front addresses, and an existing `configuration.yaml` is brought up to date before each start (Home Assistant refuses a forwarded request from a hop it doesn't trust, so moving it without that would break it). Frigate and its broker joined the front network for the Frigate integration. Left as a decision: Home Assistant no longer finds other apps by name. Next: the imports in the browser (`importData.ts`): what a crafted file can make the page do.

- **N44 (Nov 11, round 3):** backlog item 89's Pocket ID half: `TRUST_PROXY: "true"` trusted every address (Pocket ID's own `TrustProxyConfig` reads true as `0.0.0.0/0`); now `homelab-front` only, trusting the proxy and Tailscale Serve. Next: item 89's Home Assistant half (it runs on the host network on Linux: see where its requests come from first), then the imports in the browser.

- **N43 (Nov 11, round 2):** an amount of 1e308 (from a phone allowed to change Finances, or a bank's file) became infinity as cents and the ledger's save wrote an empty file over every transaction; the plan's save had the same unchecked encoding. Both now refuse a number of a trillion or more and write nothing (docs/Security.md). Read and found holding: Finances rules (500 at most, 100 letters each, a rule that does nothing refused, the matching a plain start of a name, no pattern), the ledger's other checks (accounts, transfers, splits, receipts by name). Next: backlog item 89, then the imports in the browser (`importData.ts`) for what a crafted file can make the page do.

- **N42 (Nov 11, the security review of #556 onwards, round 1):** a phone's `SnoozeCheck` took any name into a file with no limit; now only the watchdog's checks, and 256 at most (docs/Security.md). Read and found holding this round: the companion's `allowed` (home and tunnel alike; a wall screen, a member's phone and an unencrypted one can never be given changes), `SetStatusFolds` (names and count capped, 0600, owner's phones only), `SetAppSetting` away (public catalog apps only, `mayPublish` before publishing, the tunnel refuses every change), `AlertLog` (phoneLog redaction, a wall screen not told who snoozed), the CSV export (formula cells guarded), the iPhone's local alerts (only the last seen id kept; what a notification shows stays in Notification Center, as the ntfy app's do). Next: Finances rules (#584, #585) and imports (#583, #589), then backlog item 89.

- **Round 1 (item 1, the phone companion), in part:** every method in
  `phoneMethods` read against each permission. Changes all need `Change`
  and check their arguments against a fixed list; `AppIcon`'s ID is
  checked before any path is made. Found: `Encrypted` trusts a forged
  `X-Forwarded-Proto` (N1), harmless because a phone paired over plain
  HTTP is look-only and without Finances from pairing on; now held by
  `TestAForgedHTTPSHeaderGivesACopiedTokenNothingMore` (fails when that
  step is removed). `Report` open to every paired device (N2), fine as
  it is. Still to do in item 1: `StatusBoard`'s stream and `/api/events`
  by permission, `Logs` for a kiosk screen, and what the 4 MB limit lets
  a paired device make the computer do.
- **Round 2 (items 3, 5, and 11):** the welcome page is html/template (a
  crafted name is escaped, no javascript: link); rebuild's copyTree reads
  within the restored folder (os.OpenRoot) and skips links. Found N3: the
  redaction for reports and phones' logs (M3) went by a key's name, so
  HOMEBOX_API_KEY_PEPPER and GHOSTFOLIO_ACCESS_TOKEN_SALT, secret only by
  their placeholder, were left in. Fixed with settings.SecretKeys;
  TestEverySecretIsRedacted covers every secret .env.example names (it
  named both before). Items 3 and 5 still to finish: the welcome page's
  file and folder modes, and Duplicati's own restore of the archives.
- **Round 3 (item 7, the Windows update):** the swap script is a constant
  with paths as parameters; the elevated unpack quotes both paths and is
  passed encoded. N4 (Low, fine as it is): a program already running as
  you could swap the zip between the checksum and the approval prompt;
  signed builds (1.0) are the fix.
- **Round 4 (item 4, the home DNS record):** UpsertHome took over any
  private-address `*.domain` A record without the homelab's comment,
  though no earlier version wrote one: a household's own record for a NAS
  was moved to this machine (N5). Now one without the comment is adopted
  only when it already points here. TestHomeRecord gained the NAS case,
  which failed before. Still to do in item 4: what a private address in
  public DNS tells the world, and DNS rebinding against the companion.
- **Round 5 (item 9, Explain):** Explain sent the model an app's log with
  only token-shaped text taken out, not .env's secret values (N6); with
  OLLAMA_HOST elsewhere, a plainly printed secret would leave. Now
  settings.SecretValues and settings.Hide, shared with reports and
  phones' logs, take them out first. TestExplainSendsNoSecret failed
  before.
- **Round 6 (item 12, the 0.6.0 findings):** each fixed finding has a test
  that would catch it coming back: M2 (TestUnpackRefusesWritingThroughLinks,
  TestUnpackRefusesEscapes), M3 (the phone-log redaction tests, and
  TestEverySecretIsRedacted), M4 and M5 (companion pairing tests), L3
  (TestWebLink), L4 (TestVerify). M1 had none: every `uses:` is pinned
  today, but nothing kept it so. TestWorkflowActionsArePinned now does
  (fails on an unpinned step, checked with actions/checkout@v4).
- **Round 7 (item 10, the release pipeline):** CI and Nightly run on
  pull_request, read-only, no secrets; Release only on pushes to main,
  tags, and by hand; no step takes text a pull request's author wrote (N7,
  fine as it is). TestWorkflowsGiveAPullRequestNothing now holds that
  (fails on pull_request_target and on a PR title in a step, both tried).
- **Round 8 (item 8, the agent's socket):** /v1/cards serves what Status
  shows, read-only; the socket is in your own runtime or cache folder,
  0600 in 0700 (N8, fine as it is). TestTheSocketIsYoursAlone now holds
  the modes (fails with 0666).
- **Round 9 (item 18, what data/ keeps):** finance.json, the ledger,
  receipts, people, sso, and phones.json are written 0600 and go off-site
  only in the encrypted Secrets job; the other jobs read only data/appdata
  and appdata (N9, fine as it is). TestNoOtherJobReadsTheRecords holds the
  mounts (fails when ./data is mounted as a source).
- **Round 10 (items 13–17, read through):** receipts are named by their
  hash, typed by their bytes, 2 MB at most, 0600, and read back only by a
  hash name; on a phone the companion's CSP keeps a PDF from showing in
  its frame (safe; a gap for the Finances session: a phone cannot open a
  PDF receipt). Bank files are parsed on the device and drawn by Preact,
  which escapes them. Past the 4 MB call limit a phone is told "too large
  for the computer". Kiosk logs and reports stay as N2; a rebinding site
  gets the page and pairing only, as the 0.6.0 review found. No code
  change needed.
- **Round 11 (items 6, 1, and 2, read through):** Connect apps sends a
  key only to an app's own address on this machine (ports.WebURL: its
  binding, localhost or BIND_IP, always this machine's). StatusBoard gives
  a phone only the watchdog, savings, protection, and alerts cards; a kiosk
  screen is made look-only and without Finances when it pairs. A phone
  that may change Finances saves only what the household could type on the
  computer, and Clean holds it. No code change needed. **The security
  backlog is done**: the next items come from what is added from here on
  (a new phone method, file, job, or outside service each opens one).
- **Round 12 (what #346 added: the calendar feed and reminders):**
  `/finances.ics` answers only a key of 32 to 128 letters and digits
  (192 random bits from the app), compared in constant time, only over an
  encrypted connection and never through Cloudflare (`TestCalendarFeed`),
  `no-store`; no proxy keeps an access log with the key in it. A wrong
  key is told nothing. Reminders and the weekly summary's Finances lines
  go only to the homelab's own ntfy, with its publish token, as every
  alert does. A phone that was unpaired keeps a key it saw: making a new
  link in Finances › Pay ends it (the feed's own text says so). No code
  change needed.
- **Round 13 (#351 and #354: uninstall, in the CLI and the app):** read
  every deletion against the plan's words. Found, and fixed in #354
  before it merged: `--folder` alone took the default backups with it
  (`./backups` and `./backups-kopia` are inside the homelab folder) though
  the plan said they stay; `--backups` deleted each backup folder whole,
  which can be a backup drive with the household's own files on it. Now
  `--folder` keeps the backups and media folders inside it, and
  `--backups` deletes only what the backups wrote (Duplicati's job folders
  and `duplicati-` files, a Kopia repository not at a drive's top), names
  the rest, and keeps a folder holding the home folder, the homelab
  folder, or the media drive. Held by
  `TestUninstallFolderKeepsTheBackupsInIt` and
  `TestUninstallBackupsDeletesOnlyTheBackups` (both failed before). The
  container that empties a root-owned folder never follows a link.
  `--everything-else` empties the runtime of what is not the homelab's,
  by design, behind `delete everything` typed out. Still untried on a
  real machine (#354 says so); a nightly or hand run on each system is
  docs/Testing.md's Uninstall row.
- **Round 14 (#355–#402, read through):** Tidy Up's ffmpeg Install
  fetches one pinned build over HTTPS, checks its SHA-256 and size before
  unpacking, takes only ffmpeg and ffprobe by name, and keeps them only
  once they run. The engines get their keys from the environment, never a
  command line or the settings file (homelab_media.json holds none), and
  send them in headers. Tdarr's first account goes only to 127.0.0.1, and
  its password to `.env`. `TidyReveal` opens only Tidy Up's folders;
  Calibre's Flatpak scripts are fixed text. Finances' Firefly III, Wallos,
  and Ghostfolio readers reach only 127.0.0.1, and no error repeats
  Wallos's key; every new secret (`WALLOS_API_KEY`, `TDARR_PASSWORD`, …)
  is in .env.example, so reports and phones' logs take it out. The phone's
  `StopUntil` needs Change, a known container app, and a time
  `ParseUntil` reads. The update swap scripts are still fixed text with
  the paths as parameters. gosec and npm audit clean, `make check` green;
  govulncheck could not reach vuln.go.dev from this session. No code
  change needed; items 19–21 added.
- **Round 15 (item 19, `data/stopped.json`):** N10. The awake job read
  the record, spent the seconds of a `compose start`, and saved its copy
  over a stop made meanwhile (a phone's Stop for a while), and every save
  rewrote the file in place, so a reader could see it empty; the watchdog
  then started an app stopped on purpose. Now `stopped.Update` changes it
  under a lock file beside it (stale after 30 s), the awake job drops only
  entries no one changed since, and `Save` writes a new file (0600) and
  renames it in. `TestStartWhenDueKeepsAStopMadeMeanwhile` (the fake
  docker stops radarr during sonarr's start), `TestSaveReplacesTheRecordWhole`
  (a link to the old file changed), and `TestUpdateLosesNoChange` (40
  writers, run without the lock) each failed before.
- **Round 16 (item 20, Undo from a crafted trash log):** N11, Medium.
  `trash_restore.py` moved each line's `to` back to its `from` wherever
  either was. A move file carries `data/` (the log, and media.json's run
  that Undo offers) and can carry the payload, so one Undo put a file in
  `~/Library/LaunchAgents` or `~/.config/autostart`: M2 again, by another
  door. Now `mc.trashed_from` lets back only what sits directly in the
  Trash of its old place's drive (a dated `.tidy-trash` folder on a
  Windows removable drive); the rest is named and left.
  `test_a_crafted_log_moves_nothing_that_is_not_in_the_trash` failed
  before (2 planted); `test_undo_takes_back_only_from_where_things_are_thrown`
  holds the Windows branch.
- **Round 17 (item 21, the screen's arguments):** N12, Low. `TidyRun`
  passed the page's `args` to `homelab media` as they came: `--library`
  pointed a job at any folder, and `file` took any path (`--config` alone
  was safe: Go's comes last, and argparse keeps the last). Only the app's
  own page calls it, so it needs a bug there first (as L3). Now
  `tidyScreenArgs` takes only what the screen sends (`--apply`, `--check`,
  `--skip` ids, one Undo run). `TestTidyArgsTakesOnlyWhatTheScreenSends`
  failed before (9 of 9 went through). The fake launcher's ffmpeg failure
  now answers `movies scan --check`, since `unready` is refused before it
  runs; `TestTidyRunSaysWhyItStopped` checks the same thing as before.
  Items 19–21 done: the next come from what is added from here on.
- **Round 18 (#405 and #406, read through):** Finances' Export writes a
  month's page the screen built (`PrintFinances`) into
  reports/finances, 0600 in a 0700 folder, and opens it in the browser;
  every name in it, a bank file's payee too, is escaped (`esc`, element
  text only), and the year-ahead CSV keeps a cell from reading as a
  formula. Neither method is a phone method: a phone builds its files
  itself. The week's outages (#406) keep only what the checks already
  said, drawn by Preact. No code change needed.
- **Round 19 (#409, read through):** the sidebar balances' hover lists
  each account and how old its balance is; account names (a bank
  file's too) are drawn by Preact, with no raw HTML anywhere in the
  change, and nothing new reaches a phone or the Go side. No code
  change needed.
- **Round 20 (#408, read through):** Tdarr is handed only the two
  folders its container mounts (narrower than before); lyrics are read
  from a song's own .lrc and .txt beside it, and still come only from
  LRCLIB, which Tidy Up already used. No code change needed.
- **Round 21 (#411, read through):** why an app last started, for the
  "up 9 minutes" hover: data/started.json, written by six parts of the
  homelab without a lock, as stopped.json was before N10. Nothing starts
  or stops by it (only the hover reads it), so it is no hole; item 22.
- **Round 22 (#413–#420, read through):** pinning (`homelab pin`, the
  phone's SetAppSetting "pinned", which needs Change) writes APPS_PINNED
  to .env, but only a catalog app ID; the backups hover (#418) sends a
  job's run time, sizes, versions, and source folders, never its
  destination (which can hold credentials); the rest is the page. No
  code change needed.
- **Round 23 (item 22, data/started.json):** saved under a lock and
  whole, with internal/lockedfile (stopped.Update's way, for any record),
  0600. `TestNotesAtOnceAreAllKept` failed before: 40 notes at once kept
  fewer, the record was written in place, and it was 0644.
- **Round 24 (#422 read through; N13, the queue across processes):** the
  watchdog after sleep (#422) changes only when it checks. N13: the app,
  homelab serve, and the agent's nightly jobs each kept their own "one at
  a time", so they could change the homelab at once, and the watchdog
  could restart an app mid-update. Now internal/turn queues every command
  that changes something (tickets in data/turns, oldest live first, a
  job's children sharing its turn), and the watchdog heals nothing while
  a job has it. Found on the way: a move would have carried a ticket (and
  record locks) to the new machine and held its jobs up (TestMoveOutAndIn
  hung); a move now leaves them behind, and a ticket from another machine
  is cleared. `TestAChangeWaitsForAnotherProcesssTurn`,
  `TestWatchdogWaitsOutAJob`, and `TestPackLeavesThisMachinesJobsBehind`
  failed before. CI's real agent test then hung: the startup's `up
  --wait-media 15m` took the turn before waiting for the drive, so every
  change (removing the agent, a phone's Restart) waited up to 15 minutes
  behind it. It now waits for the drive first and takes its turn after
  (`TestUpWaitsForTheDriveBeforeItsTurn` failed before). Attacking the
  queue itself: a move file someone else made could hold a ticket for
  PID 1 (always running) dated in the future, never too old, first in
  line for good, so every change, the nightly backup included, would
  wait forever. Unpack now leaves out what Pack does (tickets, locks,
  half-made saves), and a ticket over 10 minutes ahead of the clock holds
  no one up. `TestUnpackLeavesOutAnotherMachinesJobs` and
  `TestATicketFromTheFutureHoldsNoOneUp` failed before.
- **Round 25 (#423, #426, #427 read through; N14):** #423 starts only
  apps Docker could not start for a missing folder, once their drive is
  back; nothing reaches it from outside. #426 is the lanes file. #427's
  alert carries the last log lines with the homelab's secrets taken out,
  and goes only to the homelab's own ntfy. N14: its restart-loop stop
  ran without N13's turn check, so an app restarting while an update
  brought its database back was stopped mid-job and kept stopped. Now it
  waits for the job as heal does. `TestWatchdogLeavesRestartLoopsToAJob`
  failed before. `data/restarts.json` is written in place, 0644, without
  a lock: a storage matter, under For Account 2.
- **Round 26 (#428 and #429, read through):** #428 tells Docker not to
  make a library folder that is missing (an unplugged drive), and the
  install makes it instead, wherever its folder setting points. Those
  settings come only from `.env`: a phone's SetAppSetting takes only
  updates, alerts, and pinned, each true or false. Before, Docker made
  the same folders, as root on Linux, so this is narrower. #429 waits out
  a busy registry for the same pulls as before (pinned or catalog
  images), and nothing new is printed or sent. No code change needed.

- **Round 27 (#431, read through):** an app's alerts off moved from
  `.env` to `data/alerts-off.json`, saved whole under its lock, 0600,
  holding only app IDs. A phone reaches it as before, through
  SetAppSetting's "alerts", which needs Change and a catalog app ID; a
  hand-edited record can only name apps, matched exactly. `envfile.Delete`
  takes out the key and only the comment lines just above it. No code
  change needed.

- **Round 28 (item 23, an app's own secrets in its log):** N15, Medium.
  `redact` (a phone's Logs, the restart-loop alert, `homelab report`)
  took out `.env`'s values and some token shapes, not what an app makes
  and prints: qBittorrent prints its Web UI admin password at every
  start until a permanent one is set, and Jellyfin logs `?api_key=`.
  Every paired device reads logs, look-only and kiosk too. Now a printed
  temporary/generated/admin password and `password`/`token`/`secret`/
  `api_key` values (key=value, JSON) are taken out; the app on the
  computer and `homelab logs` still show the whole log.
  `TestAnAppsOwnSecretsAreTakenOut` failed before (all four kept by the
  alert, qBittorrent's by a phone). Left for item 31: Explain's
  `forModel` misses the printed-password sentence.

- **Round 29 (item 24, move in from a file someone else made):** N16,
  Medium. A bundle brings its maker's paired phones, Cloudflare tunnel
  and domain, and own apps (run by Docker as written), all kept, and the
  plan said only "unpack .env and the apps' data". Now `move.Brings` reads
  them from the bundle and the plan names each (phones and whether they
  may make changes, the tunnel, the domain, each own app with its image)
  and warns to move in only a file you made, before it asks.
  `TestMoveInNamesWhatReachesIn` failed before. Kept, not dropped: a move
  between your own machines needs them (a decision for the owner).

- **Round 30 (item 25, apps started without a turn):** N17, Low. The
  battery saver, unplugged mid-update, could stop an app the update had
  just started (which the update then rolls back), and the stop timer and
  a drive coming back could start apps a job had down. Each now leaves
  the apps to a job that has the turn (`jobRunning`, the watchdog's rule)
  and looks again on its next run. `TestStartersWaitOutAJob` failed
  before (the saver stopped sonarr, the timer started radarr, mid-job).

- **Round 31 (item 26, release notes, read through):** the notes are
  drawn as plain text (`<pre>`), and Full notes and all releases open
  through `Open`, which takes only http(s) with a host or mailto
  (`webLink`, held by `TestWebLink`), so a crafted `data/releases.json`
  from a move file opens nothing else. A repo name with `..` or `?`
  (from an image label or a custom app's image) changes only which
  unauthenticated api.github.com page is read; nothing is sent with it
  but the repo's name, and only when the household looks. No code change.
- **Round 32 (item 31, Explain on another machine's Ollama):** N15's
  rest. Explain's `forModel` (and a phone's Logs, which also goes through
  `explain.Redact`) took out key=value secrets but not a password an app
  prints in a sentence, and `OLLAMA_HOST` may put the model on another
  computer. `explain.Redact` now takes it out too.
  `TestRedactAPrintedPassword` failed before.

- **Round 33 (item 30, the update window, read on its branch before its
  PR):** `claude/feature-update-window`. A crafted
  `data/update-days.json` can only narrow an app to some weekdays (an
  unknown day is dropped, none left is every night), so it cannot stop
  every update; the phone's `"sundays"` setting needs Change and a
  container app, as `"updates"` does. Two notes under For Account 1.
  Re-check once its PR is open: item 30 stays open until then.

- **Round 34 (item 29, phones that expire, read on its branch before its
  PR):** `claude/feature-phones-expire`. Every request finds its phone
  through `Store.Lookup`, which loads the record and expires it first;
  once its time has passed, Change and Finances are taken off the record
  itself (Until cleared), so a clock set back gives nothing back. An open
  `/api/events` stream only says something changed; what changed is read
  again through methods, which check the permission then. Fine as it is
  on the branch; item 29 stays open until its PR is.

- **Round 35 (#430 and #434, read through; item 27):** #430's list of
  what CrowdSec stopped today reaches every paired device through the
  read-only `Protection` method, as the week's five did: scanners'
  addresses, country and network, and what they tried, nothing of the
  household's; drawn by Preact as text. #434 (Account 2) saves the
  updates, Setup, people, and restarts records whole under their locks,
  0600, which settles the note below. No code change needed.

- **Round 36 (#435, #437, #438, read through):** #435 shows each
  backup's size beside the night before's from what the overview already
  read; #437 is the page only; #438 adds catalog metadata (which apps do
  the same job). No new phone method, record, or outside call. No code
  change needed. The backlog was down to four items, all waiting on other
  lanes: items 33 to 43 added.

- **Round 37 (item 33, the Docker socket):** N18, Medium. Homarr and
  Dozzle reach Docker through the read-only socket proxy (pinned, M6);
  only the Beszel agent mounts the socket itself, read-only, which does
  not limit Docker's API, and it ran `:latest` under the nightly update.
  Now pinned to 0.21.1 (`BESZEL_AGENT_VERSION`), updated by hand.
  `TestWhatHoldsTheDockerSocketIsPinned` failed before; it holds every
  app that mounts the socket to a pin and a fixed tag.

- **Round 38 (item 34, the companion on a public name, read through):**
  the tunnel points only at the proxy, and only for catalog apps marked
  `public` and not admin; the companion (8099) is not a catalog app and
  has no proxy host, so it stays on the home network and the tailnet. No
  stranger reaches its pairing code. No code change needed.
- **Round 39 (item 35, what is public by default):** N19, High. Seven
  apps are public once a domain and tunnel are set, and `AUTO_DOMAIN`
  publishes one as it is installed; Immich, Audiobookshelf, Komga, and
  Navidrome are claimed by their first visitor, and Calibre-Web starts as
  admin/admin123. Now each is asked first (`claimedAt`, claim.go) and
  stays off the internet until it says it has its first account; the
  plan says why. `TestAnUnclaimedAppStaysOffTheInternet` failed before.
  `TestDomainSetupEndToEnd` now states its Immich has its administrator
  (a fake answering `isInitialized: true`), the case where publishing it
  is right. Decision for the owner: whether the watchdog should publish
  such an app by itself once claimed, instead of the next Set up the
  domain.

- **Round 40 (item 36, Homepage's config, read through):** the
  services.yaml it writes holds each running app's name, description,
  address, and icon, and people's first names on their tabs; no widget
  carries a key. Homepage is a system app, never published. No code
  change needed.
- **Round 41 (item 37, adopting a container, read through):** the plan
  prints only the names of the settings carried over (`carry X over from
  the old container`), and their values go into `.env` through envfile
  (0600). Where each folder goes comes from the catalog, inside the
  homelab folder or a named volume, never from the old container; a
  container crafted to name another source needs Docker on this machine
  already (Low, nothing to fix). No code change needed.

- **Round 42 (item 39, what ntfy carries), in part:** N20, Low. With
  Hide amounts on, Finances' reminders and the weekly summary's Finances
  lines still went to ntfy with every amount (lock screens show them).
  Fixed in its smallest form in `financeView` (cmd/homelab/finances.go,
  the Finances session's code, a commit of its own):
  `TestHiddenAmountsStayHiddenInAlerts` failed before. Still to read in
  item 39: the morning line and the restart-loop alert's log lines on a
  lock screen.

- **Round 43 (item 40, Tailscale, read through; item 38 on #439's
  diff):** the Serve config the homelab writes has no `AllowFunnel`, so
  nothing goes to the internet through Tailscale; Serve offers each app
  over HTTPS to the household's tailnet only, and `TAILNET_ADMIN_APPS`
  keeps the admin apps to this machine. Quiet hours (#439, open) only
  ever lower an alert's priority, keep Priority 5 (the vault down,
  backups failing two nights) sounding, and sound everything when the
  setting cannot be read. A note under For Account 1. Item 38 stays open
  until #439 merges. No code change needed.

- **Round 44 (item 41, the proxy's CrowdSec start script):** the bouncer
  key goes into the bouncer's config inside the proxy's container and is
  never echoed. N21, Low, left open as a decision: NPM's nginx.conf trusts
  a client-address header from every private network (read from its
  source: `set_real_ip_from` 10/8, 172.16/12, 192.168/16), and our
  `server_proxy.conf` makes it `CF-Connecting-IP`, so a device at home or
  on the tailnet can be any address to the proxy, CrowdSec, and the apps.
  Trusting it from the tunnel alone needs cloudflared at a fixed address
  (or its own listener), a change to every install's network: for the
  owner.

- **Round 45 (item 42, crash notes, read through):** a crash note is the
  header and Go's own report (goroutine stacks, arguments as addresses,
  not values); `homelab report` includes the newest one, and the whole
  report goes through `redact`; no phone method serves it. Notes and job
  logs are 0644 in a 0755 `scripts/logs`, readable by another account on
  the same computer (Low): a note under For Account 2. No code change.

- **Round 46 (items 39's rest and 43, read through):** the weekly
  summary carries the disks' free space, the backups, the apps' state,
  the savings figure, and Finances' lines, which honour Hide amounts since
  N20; the restart-loop alert's log lines are redacted since N15; the
  morning line is Status's own and goes to no phone. The kit's fixed
  `<name>.kit-tmp` and `.local` names could be turned into links only by
  someone who can write into the homelab folder already. No code change.
  Left open: 28 (#424), 29 and 30 (their PRs), 32 (not built yet), 38
  (#439), and N21 (the owner's decision).
- **Round 47 (#446, the welcome sheet, read on its PR):** the sheet for
  the fridge holds each app's name, address, phone app, and a QR code of
  the address, never the sign-in link or a password; the template escapes
  every name, and its one raw value is the QR image, taken only after its
  fixed `data:image/svg+xml;base64,` prefix is checked. Written 0600 in
  `data/people` beside the welcome page, named by a username round 3
  checked, and removed with the person. Fine as it is.

- **Round 48 (item 28, the Apple client, read on draft #424):** the
  device token is kept in the Keychain as `WhenUnlockedThisDeviceOnly`,
  never synced, and read for each request; it goes only to the origin it
  was paired with (each request and each final URL checked), redirects
  are refused, sessions are ephemeral with App Transport Security fully on
  and https only (localhost excepted on the Mac), and the logs never
  carry a token or a code. No widget, notification, or Live Activity
  shows anything, and the screen is covered whenever the app is not in
  front. Fine as it is on the draft; item 28 stays open until it merges.
  Its branch, `claude/hopeful-turing-bfcknh`, matches no lane (lanes.md
  Rule 1): for the owner.

- **Round 49 (`make security` on the batch):** gosec flagged N19's own
  probe (G704: a request built from `.env`'s port). Fixed, not quieted:
  the question is now asked only at `127.0.0.1:<port>` (Calibre-Web's
  carries its default login, which must go nowhere else), and the probe
  lives in `internal/claim`, as the other app probes live in internal
  packages; `TestAskedOnlyOnThisMachine` holds the loopback rule. gosec
  and npm audit clean; govulncheck could not reach vuln.go.dev from this
  session (CI's security job runs it).

- **Round 50 (N19 tried on Docker 29.9):** each claim question asked of
  the real app, fresh, here: Komga's `/api/v1/claim` said
  `{"isClaimed":false}`, then `true` once claimed; Audiobookshelf 2.37.2's
  `/status` said `"isInit":false`; Navidrome's `/app/` page held
  `firstTime\":true`, which the pattern reads; a new Calibre-Web sends the
  default login to its setup page (302), held back as it should be. Found
  on the way: Calibre-Web, asked too often, turns every sign-in away (429)
  for a while, which the check read as "its default login still works";
  it now says it cannot tell yet (still held back). Immich not tried: its
  images come from ghcr.io, whose downloads are blocked from this session.

- **Round 51 (Account 2's note: a removed phone comes back; N22):**
  confirmed and written up in docs/Security.md as N22 (Medium), and under
  For Account 2 with the test that shows it. `Lookup` reads phones.json,
  then saves it whole when a phone is due a last-seen time; `Remove`,
  `SetCanChange`, and `SetFinances` from another process in between are
  saved over (`Store.mu` is one process's). A throwaway test, two stores
  on one file with the first's `Now` removing the phone through the
  second, failed: the removed token still looked up. Not fixed here: it
  is storage code, Account 2's to fix first. Item 38 (quiet hours, #439)
  read on main: a serious alert (priority 5) sounds at any hour, an
  unreadable setting sounds everything, and the night only lowers, so no
  setting silences what matters; done (the dying disk and failed bans
  not being priority 5 stay under For Account 1). Read through as they
  merged, no change: #444 (removes only `~/.music-cleanup/venv`, a link
  there removed as a link), #449 and #450 (the page only), #451 (read
  aloud through `textContent`), #452 (the phone's icons and colours,
  fixed files), #442 (dead code out, Finances saved under a lock), and
  #453 (the phone offline: its service worker keeps only the page's own
  files, never `/api/` or the calendar; Status and the three answers it
  is drawn with are kept, never Finances, and cleared on a 401; one note
  under For Account 1). `make security`: gosec (both modules) and npm
  audit clean; govulncheck still cannot reach vuln.go.dev from this
  session (CI's security job runs it). Backlog grown by 11 (items 44 to
  54), as 4 were open.

- **Round 52 (item 29, phones that expire, #455 on main; N23):** a
  phone's `Until` is checked in `load()` against the clock on every
  lookup, so a phone past it makes no change and sees no Finances from
  its next request; a stale copy saved by another process (N22) still
  carries `Until`, so the next read takes the permissions away again,
  and N22 cannot bring an expired permission back. A wall screen keeps
  its money card, as it should. The app and `homelab phone until` both
  go through `SetUntil`. Fine as it is (one wording note under For
  Account 1). Found on the way, **N23 (Medium)**: `/api/events` looked
  the phone up only when the stream opened, and its half-minute comment
  kept it open for good, so a removed phone kept getting every Status
  change. Fixed: looked up again every 5 seconds while it follows, the
  stream ended once it is not paired. `TestARemovedPhonesStreamEnds`
  failed before. #455 also makes `load()` save when a phone's time is
  up, so readers write too: added to N22's note for Account 2.

- **Round 53 (item 30, the update window, read on #457 before it
  merged):** `ParseDays` takes only weekdays (three letters or more), and
  an empty or seven-day list is every night, so neither a typo nor a
  crafted `data/update-days.json` (one a move file brings) can hold an
  app for more than 6 days: an app is never left out of every night.
  `SaveDays` writes under `lockedfile.Update`. A phone changes the window
  through `SetAppSetting`, which needs Can make changes, and checks the
  app is a container app before running a fixed `homelab updates days`
  command; `homelab update <app>` by name still updates it on any day.
  Fine as it is; the record is still written 0644 on #457 (the note
  under For Account 1 stands), and a window still holds a security
  release (also there). Re-read if #457 changes before it merges.

- **Round 54 (item 44, what the self-update trusts; N24):** the Mac
  update checked the download against GitHub's own `digest`, from the
  same release, then took the quarantine off the new app
  (`swapScript`'s `xattr -dr`), so nothing asked who made it: a release
  put up by someone who got at the repository would have run on every
  Mac that took it. **N24 (Medium), fixed:** an installed app signed
  with a Developer ID takes a new one only if `codesign --verify --deep
  --strict` holds and its Team ID is the same; an ad-hoc build has none
  to keep and updates as before (the workflow signs only when its
  secret is there). `TestAMacUpdateKeepsItsSigner` (stand-ins for
  hdiutil, ditto, codesign) failed before for another team, no team,
  and a broken signature. Windows and Linux builds are not signed:
  item 55. Also read #458 (memory pressure) as it merged: its alert
  names apps and figures only. gosec clean on the change.

- **Round 55 (item 45, pairing's demotions; N25):** the separate saves
  are safe: `pair` sends the token only after every lowering has saved,
  and any error answers 500 without it, so a failure part-way leaves a
  device no one holds a token for, not one with too much; a lowering
  saved over by another process is N22's, fixed with it. Found on the
  way, **N25 (Medium), open as a decision:** whether a pairing phone
  came over https is read from `X-Forwarded-Proto`, which anyone sends,
  so a code caught on the Wi-Fi (the plain `:8099` link sends it in
  clear) and used first with the header gets the code's changes and
  Finances, not look-only; the companion's own proxy host passes the
  header on too (`trust_forwarded_proto` on every route). The existing
  `TestPairingOverTheHomeWiFiIsReadOnly` shows it: it uses
  `192.168.1.20` with the header to stand for the proxy, as the server
  cannot tell the two apart. Not fixed here: the proxy reaches the
  companion from loopback, OrbStack's address, the bridge's gateway, or
  its own container address (with `HOST_GATEWAY` the LAN address), so
  no address rule holds; a header only the proxy adds, with
  `trust_forwarded_proto` off for the companion's host, changes every
  domain install's proxy and is for the owner (Decisions to look at).

- **Round 56 (item 46, a kiosk not remembered; N26):** `pair` reads
  `Kiosk` from the screen's own request and only lowers (changes off,
  Finances off), so claiming it gains nothing; but `Device` keeps no
  kiosk mark, and Settings › Phones or `homelab phone allow` can later
  give a wall screen changes or Finances as any phone. **N26 (Low),
  open:** keep `Kiosk` on the device and refuse those as
  `ErrUnencrypted` is refused; it is a change to `devices.go`, which
  Account 2 is rewriting for N22, so it waits for that to merge (item
  46 stays open until then). What a screen may call is what any
  look-only phone may: `StatusBoard`, `Logs` (N15's redaction), `Report`
  (secrets removed; it also sends `HELPER_EMAIL`, the helper the owner
  named), and `FinancesWall` with the card level. Fine as they are.

- **Round 57 (items 46 to 54; N27 and N26 fixed, N28 open):**
  **N27 (Medium), fixed:** `docker-socket-proxy` answers every GET under
  `/containers`, each container's environment (its secrets) and files
  (`/archive`, `/export`) included, and it sat on the `homelab` network
  every app joins. Tried on Docker 29.9 (with `DISABLE_IPV6=1`, as this
  session has no IPv6): a container on the shared network read another's
  `ADMIN_TOKEN` and exported its files; only POSTs were refused. Now on
  an internal `socket` network of its own with Dozzle, Homarr, and
  Homepage; tried again, an app on the shared network cannot resolve it
  and a reader still lists containers. `TestTheSocketProxyIsOnlyForItsReaders`
  failed before. **N26 (Low), fixed** now that #460 has merged: a
  screen is marked when it pairs and refused changes and Finances beyond
  the card (`TestAWallScreenStaysOne` failed before). Item 47: a code is
  8 of 31 letters (8.5e11) against 10 wrong tries in 10 minutes for all
  devices together, so guessing is hopeless; one device on the Wi-Fi can
  hold pairing off for 10 minutes at a time, the trade a per-address
  limit would lose. Item 48: the calendar key is 32 to 128 random
  letters and digits, compared in constant time, made anew in Finances ›
  Pay, never through the tunnel; notes below for the Finances session.
  Item 49: the service worker keeps only the page's own files, network
  first, per address; a phone re-paired elsewhere drops the kept Status
  at the first 401. Item 51: the passphrases live only in `.env` (0600);
  the off-site copies are encrypted, the Secrets job with its own
  passphrase kept off the machine, and the recovery kit leaves a blank
  for it. Item 52: NPM's admin port is on `BIND_IP` (this machine by
  default), its first login comes from `.env`, and admin apps are never
  published. Item 53: ntfy is `deny-all` and is published only once its
  publishers use a token. **N28 (Medium), open:** the music jobs' venv
  installs `beets`, `requests`, `pylast`, `Pillow`, and `pyacoustid`
  unpinned (and remade unattended since #444/#454); one pinned list does
  not fit Python 3.8 to 3.14 (today's need 3.10 to 3.12+), so the way to
  pin is for the owner. Read as they merged: #460 (N22's fix: the round
  51 test keeps the phone removed), #461 (a dump before risky changes,
  through the backup's own path), #454.

  **For the Finances session** (in the PR, not fixed): the calendar
  feed shows bill amounts by `CalendarAmounts` alone, so with Hide
  amounts on, a phone's calendar can still show them (N20's kind); and
  NPM's access log for `homelab.<domain>` keeps the feed's whole URL,
  key included.

- **Round 58 (item 55; N29 open; the tunnel; #462, #463):** Windows
  and Linux builds are not signed, so their updates rest on GitHub's
  checksum from the same release: **N29 (Medium), open**, as it needs a
  key or certificate only the owner can make. The tunnel checked while
  on the domain code: one ingress rule per public hostname and a
  catch-all answering 404, and home-only names under `*.domain` are DNS
  only, so a forged Host header reaches nothing through it (item 65 for
  a catch-all kept by hand). N27 tried with Dozzle itself on Docker
  29.9: it connects through the proxy on the new network and lists the
  containers (3 of 3 starts; the very first, which also made the
  network, missed the proxy once and was restarted by Docker), and an app on `homelab` cannot
  resolve the proxy. Read as they merged: #462 (rebuild writes
  settings whole), #463 (the weekly Verify: its record is 0600 under
  its lock; the problem text is Duplicati's own, which already reached
  Backups, item 56). Backlog grown by 10 (items 56 to 65), as 2 were
  open.

- **Round 59 (item 56, Duplicati's error text; item 32 on #465):** a
  job's `ErrorMessage` is Duplicati's own `LastErrorMessage`, sent as it
  is to any paired device (`DuplicatiJobs`, look-only, wall screens
  too) and into the watchdog's alert. Tried on Duplicati 2.x
  (`duplicati/duplicati`, Docker Hub) through the homelab's own client,
  with a login in each destination: FTP, SSH, WebDAV, and S3 that could
  not connect each said "Connection refused" (with the address at
  most); an unknown backend named only its protocol; a missing local
  folder was made. No login reached the message, so no change (a fix
  needs a check that fails first); re-run if Duplicati's messages
  change. Item 32's Tailnet devices, read on #465: Settings only (no
  phone method), a fixed `tailscale status --json` in the Tailscale
  container, devices shared in from other tailnets left out, names
  drawn as text, and the admin link a fixed prefix with the device's
  IPv4. Fine as it is. #465 changes the generated
  `web/types/backend.d.ts`, which N26 had too (`kiosk` on a phone for
  the screens): N26 now keeps the mark on the stored device only, so
  the two PRs share no file (lanes.md Rule 2); the Phones page can show
  it later.

- **Round 60 (item 57, what a custom app may take; N30):** `homelab
  custom add` writes the service itself (image, one port, volumes under
  `data/appdata/<id>`, env), so it cannot ask for more; a hand-edited
  `stacks/custom` file is the owner's own; a move file's own apps were
  named with their image only. **N30 (Low), fixed:** each is named with
  what it takes (privileged, Docker's socket, host network or
  processes, `/` mounted, `cap_add`, devices). Read as they merged: #466
  (CI's smoke shards interpolate only the fixed matrix and fail closed;
  Windows renames retry 2 s on "access denied" only), #467 (Duplicati's
  ntfy report decoded and cut to three lines: less reaches a phone).

- **Round 61 (the new job's first round; #464 merged):** the loop now
  leads with the tester's job (owner, Nov 6), with `docs/Usability.md`
  as the scoreboard. Task 2 (something is down) run against the fake
  backend: five findings for Account 2 (under **For Account 2**). Read
  as they merged: #468 (Tdarr gets a generated key in `.env`, 0600, read
  by Tdarr from its compose settings, which apps can no longer read
  through the socket proxy since N27), #471 (`scripts/logs` and crash
  notes private: the note for Account 2 is done).

- **Round 62 (N25, owner-approved; #472 read):** NPM 2.16 passes a
  client's own `X-Forwarded-Proto: https` on in its `proxy.conf`, whatever
  `trust_forwarded_proto` says (that only stops the redirect), so the fix
  is the companion's own location (`domain.CompanionLocation`): `$scheme`
  and a key (`COMPANION_PROXY_KEY`, made by domain setup, saved once the
  proxy holds it, letters and digits only as it is written into nginx's
  settings). The companion believes "https" from the proxy only with the
  key once it is set; with none yet it is as before (no phone loses its
  changes until the domain is set up again; the doctor says so). Tried
  on a real NPM 2.16 with an echo app behind it (see N25).
  `TestDomainSetupEndToEnd` now checks the companion's host carries the
  key saved in `.env` instead of trusting the forwarded scheme. #472
  (Account 2's loop file) read: no security change.

- **Round 63 (N28, owner-approved; #470, #474, #476, #478, #479 read):**
  the music jobs' venv now installs only `tools/media/requirements/music-3.N.txt`
  for its own Python (3.10 to 3.14; from `music.in` by `make music-pins`,
  uv's universal resolution with every file's hash), with
  `--require-hashes`, and no `pip --upgrade pip`. The file is chosen by the
  venv's `pyvenv.cfg` (a venv may have been made by another Python than
  the one running), and `homelab-pins` in the venv holds the file's hash,
  so an old unpinned venv is brought to the pins once and a later pin
  bump reaches it. Python 3.9 and older is told to install 3.10 or newer
  (or add the beets app, off Windows); 3.15 has no pins (beets 2.14.1
  wants <3.15) and installs nothing. `music_organizer.py` is vendored: the
  change is the owner's N28, recorded beside the Nov 3 fixes in the
  `VENDORED` comment. `PinnedBeets` failed before (5 of 5). Tried: `make
  music-pins-check` (a fresh `python -m venv` per Python, its own pip,
  each file whole: beets 2.14.1 ran on 3.10.20, 3.11.18, 3.12.3, 3.13.18,
  3.14.6); 3.10's file with pip 22.0.2 (Ubuntu 22.04's); the real
  bootstrap in a throwaway home (15 s, then 1 s with nothing fetched); a
  copy with beets' hashes changed was refused and nothing installed.
  Read as they merged: #474 (why a stopped app stopped: fixed phrases and
  a port number, never Docker's own text, to phones too; Protection's
  catches in words, the address on hover as before), #476 (`TidyLock`,
  desktop only; `media.Follow` reads only a `.jsonl` in Tidy Up's own log
  folder), #478 (records saved whole; the rollback kit renamed into place,
  now 0600; a ticket's process that started after it is not its owner,
  which a forged ticket cannot use as Unpack leaves tickets out), #470 and
  #479 (the page only). No new hole.

## For Account 1

- **Tidy Up has its own loop now** (the owner's ask, Nov 7): `.claude/prompts/tidy-loop.md`, run with `/loop Read .claude/prompts/tidy-loop.md and do the next round.` Its queue starts with two High items found reading the code: **Tidy lyrics** is refused by `tidyScreenArgs` (`--tidy` isn't allowed; proved with `tidyArgs("music", "lyrics", ["--tidy"])`), and **Carry on** loses a stopped job's flags. Item 1 loosens this lane's N12 guard: allow `--tidy` for `music lyrics` only.
- **The update window's record is written 0644**
  (`claude/feature-update-window`, `updates.SaveDays`): the other records
  the homelab writes moved to 0600 today (#431–#433). Nothing secret is
  in it; 0600 keeps it with the rest.
- **Quiet hours and a dying disk** (#439): a drive whose SMART report
  says it is failing, and CrowdSec's bans no longer reaching the proxy,
  are not Priority 5, so at night they arrive without a sound. Both are
  the kind of thing worth waking for; worth a look.
- **A window holds a security release too:** Vaultwarden set to Sundays
  takes a security fix up to 6 days late. The roadmap's own example
  ("Vaultwarden at once when a security release comes out") is not built;
  worth saying on the app's page when a password app gets a window.
- **A phone removed while away keeps its last Status** (#453,
  web/dist/companion.js): the kept Status goes only when the computer
  answers 401, so a phone removed while it is away from home (lost, say)
  shows Status as it last was until it next reaches the homelab. It is
  what the phone had already seen, and no Finances; the comment's "all
  of it goes when the phone is unpaired" could say "once it learns it
  was removed". Worth a line on the Phones page's Remove.
- **`homelab phone until` with a huge number** (#455, `parseFor`):
  `999999999999w` overflows the duration and lands in 1848, so the phone
  only looks at once (the safe way) while the command says it "may do
  more than look until" a date long past. A cap (a year, say) would say
  so plainly.
- **Two smoke cases time out on a busy CI runner** (Nov 10, on #569 and
  #570, PRs that change no screen; each passed on re-run):
  - "Tidy Up on a new Mac with the drive away: two things, not nine"
    (`app/preview/shoot.mjs`, about line 2703) waits only 3 s for the
    row to come back after Cancel, where its neighbours allow 5 s. It
    failed twice in dark mode.
  - "Finances: a typed transaction links itself to the planned payment
    it pays" timed out at 5 s waiting for `Looks like Peloton`, once in
    light mode.

  Worth finding what each waits on (a re-fetch, an animation) rather
  than only raising the timeout.

## For Account 2

### Usability findings (Account 3's tester, worst first; take these ahead of your own order)

From task 2, **Something is down: find out what, and fix it** (Nov 6, against the fake backend: Mealie stopped). Pictures in `docs/images/usability/`.

1. **A stopped app's page never says why, or what to do if Start does not help** (`t2-mealie-page.png`). The page shows "▲ Stopped", a Start button, and a log of old, normal lines from Oct 10 ("Starting server on :3456"). Nothing says whether it was stopped on purpose, stopped for a while, crashed, or kept restarting, nor what to try next. *Fixed looks like:* a line under the title saying why it stopped and since when (stopped by you or for a while; crashed with its last error line; kept restarting and was stopped), and what to do (Start; or Restart, then the log's error; or "it needs X"). *Smoke case that fails today:* the app page for an app the watchdog stopped in a restart loop names the reason and when.
2. (done: the phone's web page in #524; the iPhone app on Nov 10, after #575) **On the phone, a stopped app offers nothing and says nothing** (`t2-phone-status.png`, `t2-phone-mealie-page.png`). Every running app has Open; Mealie has no button and no word, on the list or on its page. *Fixed looks like:* a phone that may make changes gets Start; one that only looks says "Start it from the computer". *Smoke case:* the phone's Status (look-only and may-change) for a stopped app shows the action or the sentence.
3. **The screens disagree about checks** (`t2-phone-status.png`, `t2-mealie-page.png`).
   - The phone's Status says "Watchdog ✓ All 47 checks passed" while Mealie is stopped and the desktop's "Needs a look" card names it.
   - Mealie's page says "Not checked yet… once Setup turns it on", while Status's header says "Backups and checks on".

   *Fixed looks like:* the watchdog line counts a stopped app (or says why it is not checked), and the page says the same as the header. *Smoke case:* Status with one app stopped says it in the watchdog line.
4. **Words a household cannot read** (`t2-status.png`, `t2-phone-status.png`):
   - "Choose stacks" (the sidebar);
   - "All baseline apps are up";
   - "Replaces a year $3,292", which does not say it means what the apps would cost as subscriptions;
   - the Protection card listing scanner names ("vpatch-CVE-2017-9841", "http-probing") and raw addresses.

   *Fixed looks like:* plain names ("Choose apps"; "Blocked: someone probing for a known web-server hole"; the subscription sense said). *Smoke case:* the words lint (`app/preview/words.mjs`) refusing "stacks", "baseline", and a raw scenario name on a screen.
5. (done: the phone's web page wraps them since #524, with its smoke case; the iPhone app's log already wrapped) **The phone cuts log lines off at the right** (`t2-phone-mealie-page.png`, 390px): "INF Starting server on" ends mid-line with no wrap or scroll hint. *Fixed looks like:* lines wrap, or the box says it scrolls. *Smoke case:* the app page at 390px has no text running out of its box.

From task 6, **Pair a partner's phone with only look access, then remove a lost phone** (Nov 6, against the fake backend; `t6-phones.png`):

6. **Pairing one phone means reading three paragraphs, and a wall screen needs a link edited by hand.** The panel explains `http:` against `https:`, a "key", Finances, and then says a TV pairs "with `&kiosk` at the end of the link". Typing that onto a URL is a dead end for most households. *Fixed looks like:* "Pair a phone" and "Pair a wall screen" as two choices, each with its own QR code and one plain sentence; the details behind "More about this". *Smoke case:* Settings › Phones offers a wall-screen pairing whose QR code carries `kiosk`, with no link to edit.
7. **Two links, with nothing saying which to use or which the QR code holds.** `https://homelab.example.com/#pair=…` and `http://192.168.1.10:8099/#pair=…` sit side by side, and the second quietly makes a phone that only looks. *Fixed looks like:* the QR code and the first link are the https one, labelled as the one to use; the home-Wi-Fi link sits under "If the phone can't open it", saying it can only look. *Smoke case:* the pairing panel names which link the QR code holds.
8. **A red ▲ beside Anna's iPhone, unexplained.** Nothing on the row says what it warns about. *Fixed looks like:* the mark has words beside it ("Can change apps and Finances"), or isn't there.
9. **The same thing, done two ways:** Anna's row has "Until you change it" and "Make read-only", while the iPad's has "Allow changes" and no time limit. *Fixed looks like:* every phone has the same controls in the same places.
10. **Words:** "tailnet", "http:" and "https:", "key", and "kiosk", on a screen a household opens to pair a phone. *Fixed looks like:* "at home and on your own private network", "the secure link", "the home Wi-Fi link", "wall screen".

From task 4, **Update everything, and know it worked** (Nov 6, Update apps on Status, against the fake backend):

11. **Before you press Update, the sheet already says it updated them, in a terminal's words** (`t4-plan.png`). Under "Update all apps now" it shows `$ homelab update-all`, "→ dumping mealie-db first", "✓ updated navidrome, vikunja, mealie": app IDs, not names, and "✓ updated" before anything has happened. *Fixed looks like:* "These 3 apps have updates: Navidrome, Vikunja, Mealie. Mealie's recipes are copied first." with the command behind Details. *Smoke case:* the Update apps sheet, before Update them, shows no "✓", "$", or "→", and names apps by their names.
12. **"Done" does not say what changed** (`t4-done.png`): each app is "Running" with a full bar, so the household cannot tell which got a new version, from what to what, or which were already up to date; "what Docker said" is jargon. *Fixed looks like:* "Updated: Navidrome 0.53 → 0.54. Already up to date: Vikunja, Mealie." with a link to what's new. *Smoke case:* after Update apps, the sheet names each app's old and new version or says it was already up to date.

From task 7, **Give a person their own account, and send the welcome page** (Nov 13, Settings › People against the fake backend: Pocket ID running, then adding Anna Smith with her email; on the Mac at full width in light, and at 320px with big text in dark):

13. **A dead end at "send": after Add them, nothing says what happened or how the welcome page gets to Anna** (`t7-after-add.png`). The row appears and the welcome page opens in the browser with no word on the screen. There is no Send, though her email was just typed: the household has to find an HTML file in the homelab folder and attach it themselves, and the only hint is the button's hover text ("to print or send"). That page also holds her one-time sign-in link and her Jellyfin and Navidrome password, so emailing it as it stands hands both to anyone who reads the mail. *Fixed looks like:* after Add them, a note or sheet says "Anna is added" and offers ways to hand it over: show her sign-in as a code to scan now, print, or copy the link. It says the page is for her alone because it holds her password, and anything emailed is the fridge sheet, which has neither. *Smoke case:* People, Add them: the screen says the person was added and offers a way to hand over the welcome page.
14. **At 320px with big text, a person's row breaks** (`t7-people-320-dark.png`): the name runs one letter per line, and the four buttons run off the right edge ("New sig…" cut, Reset password and Remove out of reach). This Mac's "Container runtime" value does the same on that page. *Fixed looks like:* the buttons wrap under the name, and a value wraps by words. *Smoke case:* Settings › People with one person, at 320px with big text: no text narrower than a word, nothing past the right edge.
15. **The stopped-app banner at the top of Settings is cut off** (`t7-after-add.png`, `t7-people-320-dark.png`): at full width "Mealie: Stopped Open Status" shows only its top half, and at 320px its Open Status link sits under the Settings heading. *Fixed looks like:* the banner shows whole, above the heading, with its link reachable. *Smoke case:* Settings with an app stopped: the banner's link is visible and clicks through to Status.
16. **Words** (`t7-no-pocket-id.png`, `t7-after-add.png`):
    - "passkey", "Pocket ID", "Infuse", and "with their keys in Settings" (which keys, where?);
    - "Welcome page" beside "New sign-in link", with nothing saying which one Anna needs;
    - "Reset password", which says only on hover that it is for Jellyfin and Navidrome;
    - "The apps they use (none ticked: all of them)": ticking one app gives them only that app.

    *Fixed looks like:* plain words ("a sign-in with her phone's face or fingerprint", "the household's sign-in"), the music and films password named on its button, and "All the apps" as a choice of its own beside "Only these". *Smoke case:* the words lint refusing "passkey" and "Pocket ID" without a plain gloss on People.

Not a screen, but yours: **`TestJobLogSplitsAtOnceAllFinish` (#471) failed once on Windows CI** (Nov 6, #475's run: "open …\\watchdog.log: The process cannot access the file because it is being used by another process"; green on a re-run). Either the test is flaky on Windows, or a log can't be rotated on Windows while another process has it open, which would also bite a household's Windows machine. Worth a look before it turns another lane's run red.

- (done: #460) **N22: a phone removed on the computer can come back** (your note in
  maintenance-loop.md, confirmed; docs/Security.md N22, Medium). Take it
  next, ahead of your own order (lanes.md Rule 3). `Store.Lookup` in
  `internal/companion/devices.go` reads `data/phones.json`, and when a
  phone is due a last-seen time saves the whole store a moment later;
  `Remove`, `SetCanChange`, and `SetFinances` run in another process
  (`homelab phone`, the app) and save it the same way. The test that
  shows it, which failed here: pair a phone through one `NewStore(path)`,
  then make a second `NewStore(path)` whose `Now` (called between
  `Lookup`'s read and its save) calls `first.Remove(name)` once and
  returns an hour on; `second.Lookup(token)`, then
  `NewStore(path).Lookup(token)` still finds the removed phone. The same
  with `SetCanChange(name, false)` brings Can make changes back. Fix:
  every change under `lockedfile.Update`, as `internal/stopped` does
  (and so no shared `phones.json.tmp`). Since #455, `load()` itself
  saves when a phone's `Until` has passed, so `Devices()` and `Phones()`
  write too: they need the same lock. Account 3 ticks N22 once it
  merges.
- (done: #471) **`scripts/logs` is 0755 and its files 0644** (the agent's
  `MkdirAll(h.logsDir(), 0o755)`, `crash.Watch`, `openJobLog`): another
  account on the same computer can read every job log and crash note.
  Nothing secret is meant to be in them, but they are the household's
  diagnostics; 0700 for the folder (and 0600 for new files) keeps them to
  this account. Show it with a test on the folder's and a note's mode.

- (done: #434) **`data/restarts.json` is written in place, without a lock** (#427,
  cmd/homelab/restartloop.go `stopRestartLoops`): `os.WriteFile`, 0644,
  read and rewritten whole by each watchdog run. Two runs at once (the
  agent's and the one after sleep, #422, or `homelab watchdog` by hand)
  can lose a count, or a reader can see it half-written; the cost is a
  restart loop noticed one run later, nothing more (no secret in it). A
  test like `TestNotesAtOnceAreAllKept` (40 runs at once, count the
  kept entries and check the mode) would show it; save it with
  internal/lockedfile as started.json is.
