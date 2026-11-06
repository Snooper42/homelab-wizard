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
28. **The native Apple client** (#424, apple-client/, once merged): the
    pairing token in the Keychain (not UserDefaults or a backup), the
    companion's certificate checked, nothing secret in widgets, the lock
    screen, or a crash log.
29. **Phones that expire** (`claude/feature-phones-expire`, once its PR
    is open): an expired phone refused on every method and on a stream
    already open, and a clock set back not bringing it back.
30. **The update window** (`claude/feature-update-window`,
    `data/update-days.json`): a window must not hold a security release
    forever, and a crafted record must not stop every update.
31. (done: round 32) **Explain on another machine's Ollama**: what the model is sent when
    `OLLAMA_HOST` points off this machine (item 9 checked only
    172.17.0.1), and whether that counts as leaving the machine (Rule 3).
32. **Tailnet devices and Two-step sign-in, nudged** (the roadmap's next
    Security items): the Tailscale API key and each app's admin key used
    to read them stay in `.env`, and Remove a lost device is computer
    only, never a phone method.

Added after round 36 (four left, all waiting on other lanes; worst first):

33. **The Docker socket in apps' hands** (internal/dockerapi, the compose
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
38. **Quiet hours** (#439, once merged): a crafted or careless setting
    must not silence the alerts that matter at night (a ban that failed,
    a backup that failed, a disk dying, the tunnel down).
39. **What ntfy carries** (the weekly summary, the morning line, Finances
    reminders, restart-loop logs): ntfy may be on a public name, and a
    phone's lock screen shows the first lines; list what each message
    holds (amounts, names, log lines) and what a lock screen shows.
40. **Tailscale** (internal/tailnet): the homelab never turns on Funnel;
    what `tailscale serve` (or the apps' tailnet addresses) offers to
    every device on the tailnet, shared-in devices included.
41. **The proxy's CrowdSec start script** (dockerfiles/npm-crowdsec
    homelab-init.sh): runs as root in the proxy's container with the
    bouncer key; how the key is passed and kept, and file modes.
42. **Crash notes** (internal/crash, with #436's cleanup): what a note
    holds (a panic can print values, secrets among them), where it is
    kept and at what mode, and whether a report or a phone gets it.
43. **The kit's writes** (internal/kit): files go through a fixed
    `<name>.kit-tmp` and `.local` copy, which follow a link put there by
    someone else on the machine (Low); and that the kit a newer app
    brings comes only from the signed app itself.

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

## For Account 1

- **The update window's record is written 0644**
  (`claude/feature-update-window`, `updates.SaveDays`): the other records
  the homelab writes moved to 0600 today (#431–#433). Nothing secret is
  in it; 0600 keeps it with the rest.
- **A window holds a security release too:** Vaultwarden set to Sundays
  takes a security fix up to 6 days late. The roadmap's own example
  ("Vaultwarden at once when a security release comes out") is not built;
  worth saying on the app's page when a password app gets a window.

## For Account 2

- (done: #434) **`data/restarts.json` is written in place, without a lock** (#427,
  cmd/homelab/restartloop.go `stopRestartLoops`): `os.WriteFile`, 0644,
  read and rewritten whole by each watchdog run. Two runs at once (the
  agent's and the one after sleep, #422, or `homelab watchdog` by hand)
  can lose a count, or a reader can see it half-written; the cost is a
  restart loop noticed one run later, nothing more (no secret in it). A
  test like `TestNotesAtOnceAreAllKept` (40 runs at once, count the
  kept entries and check the mode) would show it; save it with
  internal/lockedfile as started.json is.
