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
started cannot run /loop. While no session runs a team, the cleanup
session takes that team's rounds in turn, between its own checks, on its
own branch and PR.

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
  **Ready for review**. The cleanup session merges Ready PRs once their
  checks are green. Start the next batch on `<team>-<n+1>` from the latest
  main; open its draft PR only once the one before is merged or closed.
- **The cleanup session** clears PRs, keeps main green, and owns VERSION and
  releases: never touch VERSION, never cut a release, never merge, close, or
  push to a PR that is not yours.
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

1. **First run, from nothing.** Setup on an empty homelab as each system:
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
