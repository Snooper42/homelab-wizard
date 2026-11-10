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
   - **The plan (Nov 10, the independent review), not built yet:** a fixed address on `homelab` needs that network recreated with a subnet (every container), so instead: (1) a small network of the tunnel's own, `homelab-tunnel`, made by the CLI as it makes `homelab` but with a fixed subnet from a range homes and Docker don't use (198.18.89.0/29, RFC 2544), cloudflared at a fixed address on it and NPM joined with an alias (`npm-tunnel`) that only that network resolves; (2) the tunnel's ingress sends to `http://npm-tunnel:80`, so its traffic can only arrive from that address (Publish rewrites the homelab's own rules; Unpublish and `away` accept the old service and the new); (3) `server_proxy.conf` adds `set_real_ip_from <that address>;`, which at server level replaces NPM's http-level private ranges, and an existing file that is still the image's exact old text is rewritten (one the household edited is left, and said). **The danger:** if tunnel traffic ever reaches NPM from another address, every visitor is that address, and CrowdSec can ban the whole internet's way in. So first a realdocker test that has none today: a container at the fixed address sending `CF-Connecting-IP` is seen as that visitor; one on `homelab` sending the same header is seen as itself; and the tunnel's own path, with cloudflared's container on both networks, reaches NPM from the fixed address.

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

## The security team

You audit every way into the homelab's own code: what can reach it, what
guards it, and whether the guard holds. Start from docs/Security.md: its
**Threat review of the app** was read against 0.6.0, and much has been
added since. Your findings go in a new section there, **Threat review
(November 2026)**, in the same table form (H/M/L with an ID, the finding in
plain words, the fix), each ticked when its fix merges.

**How to look.** Read the handler or function, then attack it with a test:
a paired phone with the wrong permission, a crafted file, a value with a
newline or `../`, a request from a public address, a body too large. Run
`make security` (govulncheck, gosec, npm audit) every round. A finding
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
58. **Apps with no sign-in when `BIND_IP` is the LAN address** (Dozzle,
    `local: true`, and any app whose port is on `BIND_IP`): which then
    face the whole home network, and whether Settings says so when the
    address is changed.
59. **CrowdSec's API on the shared network**: whether any app on
    `homelab` can reach the LAPI, and what it could do there (read
    decisions, add or remove a ban) with or without the bouncer key.
60. **Databases on the shared network**: every app's database should sit
    on its own project's network, never on `homelab`; a test like
    N27's over the catalog would hold it.
61. **Vaultwarden on a public name**: `SIGNUPS_ALLOWED` and the admin
    page (`ADMIN_TOKEN`, hashed or not) when it goes through the tunnel,
    as N19 asked of the apps with a first account.
62. **Uptime Kuma's status pages and push URLs** on a public name: what
    a stranger can read or post there.
63. **Homarr's `SECRET_ENCRYPTION_KEY`**: made where, kept 0600, carried
    by which backup, and what Homarr keeps with it (the integrations'
    keys).
64. **The app's link to the agent on Windows** (the named pipe or local
    port item 8 read on the Mac): who on the same computer may use it.
65. **The tunnel's catch-all kept by hand** (`MergeIngress` keeps a
    catch-all someone added): one that sends every hostname to the proxy
    would put each home-only app behind the tunnel; say so when it is
    there (round 58 found the homelab's own catch-all answers 404).

### Security done

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

## For Account 2

### Usability findings (Account 3's tester, worst first; take these ahead of your own order)

From task 2, **Something is down: find out what, and fix it** (Nov 6, against the fake backend: Mealie stopped). Pictures in `docs/images/usability/`.

1. **A stopped app's page never says why, or what to do if Start does not help** (`t2-mealie-page.png`). The page shows "▲ Stopped", a Start button, and a log of old, normal lines from Oct 10 ("Starting server on :3456"). Nothing says whether it was stopped on purpose, stopped for a while, crashed, or kept restarting, nor what to try next. *Fixed looks like:* a line under the title saying why it stopped and since when (stopped by you or for a while; crashed with its last error line; kept restarting and was stopped), and what to do (Start; or Restart, then the log's error; or "it needs X"). *Smoke case that fails today:* the app page for an app the watchdog stopped in a restart loop names the reason and when.
2. **On the phone, a stopped app offers nothing and says nothing** (`t2-phone-status.png`, `t2-phone-mealie-page.png`). Every running app has Open; Mealie has no button and no word, on the list or on its page. *Fixed looks like:* a phone that may make changes gets Start; one that only looks says "Start it from the computer". *Smoke case:* the phone's Status (look-only and may-change) for a stopped app shows the action or the sentence.
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
5. **The phone cuts log lines off at the right** (`t2-phone-mealie-page.png`, 390px): "INF Starting server on" ends mid-line with no wrap or scroll hint. *Fixed looks like:* lines wrap, or the box says it scrolls. *Smoke case:* the app page at 390px has no text running out of its box.

From task 6, **Pair a partner's phone with only look access, then remove a lost phone** (Nov 6, against the fake backend; `t6-phones.png`):

6. **Pairing one phone means reading three paragraphs, and a wall screen needs a link edited by hand.** The panel explains `http:` against `https:`, a "key", Finances, and then says a TV pairs "with `&kiosk` at the end of the link". Typing that onto a URL is a dead end for most households. *Fixed looks like:* "Pair a phone" and "Pair a wall screen" as two choices, each with its own QR code and one plain sentence; the details behind "More about this". *Smoke case:* Settings › Phones offers a wall-screen pairing whose QR code carries `kiosk`, with no link to edit.
7. **Two links, with nothing saying which to use or which the QR code holds.** `https://homelab.example.com/#pair=…` and `http://192.168.1.10:8099/#pair=…` sit side by side, and the second quietly makes a phone that only looks. *Fixed looks like:* the QR code and the first link are the https one, labelled as the one to use; the home-Wi-Fi link sits under "If the phone can't open it", saying it can only look. *Smoke case:* the pairing panel names which link the QR code holds.
8. **A red ▲ beside Anna's iPhone, unexplained.** Nothing on the row says what it warns about. *Fixed looks like:* the mark has words beside it ("Can change apps and Finances"), or isn't there.
9. **The same thing, done two ways:** Anna's row has "Until you change it" and "Make read-only", while the iPad's has "Allow changes" and no time limit. *Fixed looks like:* every phone has the same controls in the same places.
10. **Words:** "tailnet", "http:" and "https:", "key", and "kiosk", on a screen a household opens to pair a phone. *Fixed looks like:* "at home and on your own private network", "the secure link", "the home Wi-Fi link", "wall screen".

From task 4, **Update everything, and know it worked** (Nov 6, Update apps on Status, against the fake backend):

11. **Before you press Update, the sheet already says it updated them, in a terminal's words** (`t4-plan.png`). Under "Update all apps now" it shows `$ homelab update-all`, "→ dumping mealie-db first", "✓ updated navidrome, vikunja, mealie": app IDs, not names, and "✓ updated" before anything has happened. *Fixed looks like:* "These 3 apps have updates: Navidrome, Vikunja, Mealie. Mealie's recipes are copied first." with the command behind Details. *Smoke case:* the Update apps sheet, before Update them, shows no "✓", "$", or "→", and names apps by their names.
12. **"Done" does not say what changed** (`t4-done.png`): each app is "Running" with a full bar, so the household cannot tell which got a new version, from what to what, or which were already up to date; "what Docker said" is jargon. *Fixed looks like:* "Updated: Navidrome 0.53 → 0.54. Already up to date: Vikunja, Mealie." with a link to what's new. *Smoke case:* after Update apps, the sheet names each app's old and new version or says it was already up to date.

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
