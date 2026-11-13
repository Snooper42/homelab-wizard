# A household member's own Finances, sealed so only she can read them

**The owner's ask** (Nov 13, 2026, chosen by multiple choice): his wife checks in on her **own** finances from her phone, and **only she** can read them, **even he**, who runs the homelab computer, cannot.
- **Where:** in the Homelab iPhone app and on the phone's web page.
- **What:** her own accounts and bills, what he already shares with her, and her own bank files.

Written by the security session (`audit-loop.md`, the owner's other account), which builds no screens. **You build it** (`handoff.md`'s session: Finances, the phone's web page and `apple-client/`). The security session reviews each of your PRs once it merges.

## 1. What already exists, so this sits on it rather than beside it

Read these before planning. Most of the feature is already here, in plain form.

**A member's phone**
- A household member is a `people.Person` (`internal/people`, Settings › People).
- A phone becomes theirs with `Store.SetPerson` (Settings › Phones), which sets `Device.Person`.
- `cmd/homelab/member.go` has the rest:
  - `h.member(ctx)` says whose phone is calling, through `companion.Caller`;
  - `onlyTheirs` and `forMember` cut Status and the change stream down to their own apps.

**A member already has her own Finances**
- `h.financeRoot(ctx)` sends every Finances call from a member's phone to `memberRoot`: `data/members/<username>/data/`. There she has `finance.json`, `finance-ledger.json` and `finance-receipts/`, apart from the household's.
- These phone methods in `cmd/homelab/serve.go` (`phoneMethods`) all route through it, each `Member: true` with a Finances level:
  - `Finances`, `SaveFinances`;
  - `FinancesLedger`, `SaveFinancesLedger`;
  - `FinancesReceipt`, `SaveFinancesReceipt`;
  - `FinancesWall`.
- The phone's web page (`web/src/finances/*`) and the iPhone app (`FinancesView.swift`, `FinancesViewModel.swift`, `MemberViews.swift`) already draw them.
- **So her own accounts, bills, ledger and bank-file imports work today. They are only not private:** the files are plain JSON on the computer.

**What the owner shares with her**
- `FinancesShared` returns `memberShared`, built by `sharedFor` in `member.go`: the bills, subscriptions and budgets he shares (`homelab person share`).
- It is the household's money, shown read-only. It stays exactly as it is.

**The model and the projection run on the computer**
- `finance.ProjectWith(plan, ledger, today, periods)` (`internal/finance`, about 8,000 lines of Go) turns the plan and ledger into the `finance.View` every screen draws.
- Saves are guarded by `Rev` and `finance.ErrChanged`.
- **This is the crux:** once her data is sealed, the computer can no longer project it.

**Backups**
- As of N74 (#660), `data/members/` is one of the records the nightly backup copies into the encrypted Homelab Secrets job (`internal/backup/records.go`).
- Before #660 it was in no backup at all. Her sealed file will sit in the same folder and be carried the same way.

**Other things to know**
- **Limits and the tunnel:** `companion.MaxCall`, plus `MaxTunnel` away from home (ADR-0023). Every phone method already passes the per-phone checks (`Change`, `Member`, `Finances`, `Private`).
- **What reads a member's Finances on the computer today:**
  - the nightly Finances reminders (in `homelab backup`: a bill due tomorrow, a paycheck under the cushion);
  - the Finances calendar feed (`h.financeCalendar`);
  - `recordFinances` (the record of who changed what);
  - `FinancesWall`.

  Each of these is household-side; section 3 says what happens to each for her.

## 2. What "even from him" means, and its one limit

- Her Finances are encrypted **on her phone**, with a key the computer never sees.
- The computer keeps a sealed blob it cannot open, and passes it only to her phone.
- Nothing the computer runs (reminders, calendar, wall card, history, logs) can see inside it.

**The limit, to say in one plain line where she turns it on, and in the docs:**
- The phone's **web page** is code the computer serves. An owner who changed that code could make the page send him her key the next time she unlocks.
- The **iPhone app** comes from the App Store or TestFlight, not from the computer, so it doesn't have this weakness.
- So on the web page, privacy holds while the page is the homelab's own; the app is the stronger home. Never claim more than that.

## 3. How to build it

### 3.1 Sealing (her phone only)

**The data key**
- A random 256-bit data key, made on her phone.
- Her plan, ledger and receipts are sealed with AES-256-GCM: one sealed record per save, a fresh 96-bit nonce each time, and the format version and her username as associated data (so a blob can't be moved to another member).

**Wrapping the data key**
- **By her passkey**, through the WebAuthn PRF extension:
  - on the page, `navigator.credentials.get` with `extensions.prf`;
  - in the app, `ASAuthorizationPlatformPublicKeyCredentialAssertionRequest` with PRF (iOS 18 and later).
  - It syncs through her own iCloud Keychain, so a new phone of hers unlocks it.
  - The passkey's relying party is the homelab's own name. Say which in the doc; on the tunnel it is the tunnel's host.
- **By a recovery code:** 128 random bits shown once as words, stretched with scrypt (N=2^17, r=8, p=1) or Argon2id.
- **Fallback where PRF is missing:** a passphrase of at least 12 characters, stretched the same way and wrapped the same way. The recovery code still applies.

**Rules**
- Nothing that unwraps the data key ever leaves her phone.
- The opened key is held in memory only while Finances is open, and dropped when it locks: on leaving the screen, after 5 minutes away, or when the page is hidden.
- On the web page, never put the opened key or plain data in `localStorage` or IndexedDB.
- In the app, the Keychain only, `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, if it is kept at all.

### 3.2 The projection, on her phone

The computer can't run `finance.ProjectWith` on sealed data, so her phone must run it. **Don't write a second copy of the model** in TypeScript or Swift: it would drift from the Go one, and every Finances fix would have to land three times. Instead, build the same Go package for the phone:
- **The web page:** `internal/finance` built for WebAssembly (`GOOS=js GOARCH=wasm`; TinyGo if the size is too big). Serve it from `web.Files` as `finance.wasm`, loaded only when a sealed member opens Finances. Calls in and out pass JSON, the same `finance.View` the screens draw today, so the screens don't change.
- **The iPhone app:** the same package through `gomobile bind` as an xcframework, called from `FinancesViewModel` where it now calls `APIClient`.
- **Measure first.** Build both before any screen work, and put the sizes in the PR.
  - If the WebAssembly file is over about 4 MB compressed, or the xcframework over about 15 MB, ask the owner with the pop-up (multiple choice) before going on.
  - The alternative to offer is a cut-down projection for the phone, in TypeScript only, checked against the same golden plans as Go.
- Today's date comes from the phone. Anything `ProjectWith` reads from outside the plan and ledger must be passed in, not fetched.

### 3.3 The computer's side

**The sealed file**
- `data/members/<username>/data/finance.sealed`, beside her plain files' old place.
- One JSON envelope:
  - `{version, rev, kdf, wrappedByPasskey, wrappedByCode, sealed}`;
  - base64 for bytes; nothing else in it; 0600 in her 0700 folder;
  - written whole under `lockedfile.Update`.
- Receipts:
  - each one is sealed on the phone and kept as `finance-receipts/<hash>.sealed`;
  - `<hash>` is a hash of the sealed bytes, so nothing about the receipt is learned from its name.

**Two new phone methods** in `phoneMethods`, beside the Finances ones:
- `FinancesSealed`: returns her envelope, or "none".
- `SaveFinancesSealed(rev, envelope)`:
  - refuses a stale `rev` as `finance.ErrChanged` is refused;
  - caps the size under `MaxCall` (and `MaxTunnel` away) before reading it whole;
  - checks only the envelope's shape and size, never its contents.
- Both are `Member: true` and `Finances: companion.FinancesView` (the save at `FinancesEdit`), and need an encrypted connection, as Finances does.
- **Both answer only a member's own phone.** The owner's phones, a wall screen, another member's phone, a removed member, and a member whose `Person` is no longer active are refused. Check this in the method itself (`h.member(ctx)` must say `isMember`), not only through the flags: a non-member must never reach the household's root by mistake.
- Sealed receipts: `FinancesSealedReceipt(hash)` and `SaveFinancesSealedReceipt(hash, bytes)`, with the same checks and the size cap `SaveFinancesReceipt` has.

**Once she is sealed** (the envelope exists):
- every plain Finances call from her phone is refused with one plain line, "Her Finances are private; they open on her phone": `Finances`, `SaveFinances`, `FinancesLedger`, `SaveFinancesLedger`, `FinancesReceipt`, `SaveFinancesReceipt`, `FinancesWall`;
- so nothing plain is ever written for her again.
- `FinancesShared` keeps working: it is the household's money.

**Turning it on, from her phone**
1. Her phone reads her plain Finances (as today).
2. It makes the key, the passkey wrap and the recovery code, and has her type back two of the code's words.
3. It seals and saves with `SaveFinancesSealed`.
4. Only after that save succeeds, the computer removes her plain `finance.json`, `finance-ledger.json` and plain receipts (in the same call, after the write).
5. A failure at any step leaves her plain data as it was.
6. The plain copies in the last 7 nights of the Secrets backup age out on their own; say so in one line.

**Turning it off:** only from her phone, which saves her plain data back and removes the sealed file. Ask her to confirm.

**On the computer, for the owner**
- Settings › People shows only "Keeps her Finances private (last saved …)" on her row. A desktop binding gives that fact and nothing else; run `cd app && go test -run TestBindings -update .`.
- No desktop method, CLI command, alert, history entry or log line reads or mentions what is inside.
- `recordFinances` writes "changed her private Finances" with no detail, or nothing at all.
- **Remove a person** (`cmd/homelab/person.go`):
  - ask whether to keep her Finances, keep by default;
  - say plainly that the owner can delete the sealed file but never open it.

**What the computer no longer does for her**, said in the doc:
- no nightly Finances reminders;
- no calendar feed;
- no wall card.

The iPhone app instead gives her **local** reminders, computed on the phone from her own projection (the app's local notifications, #593).

### 3.4 Her phone's screens

- **Reuse the existing Finances screens.** They draw a `finance.View`; the only change is where the view comes from (her phone's projection instead of the computer's).
- **Add:**
  - **Turn on privacy**, with the one-line limit on the web page;
  - **Lock** and **Unlock** (Face ID, or the passphrase);
  - **Use your recovery code**;
  - **Turn privacy off**.
- **What he shares with her:** a section beside her own, read-only, from `FinancesShared`, never mixed into her sealed data.
- **Bank files:** read and parsed on the phone as today (`importData.ts`, the app's import), added to her sealed ledger. The file never goes to the computer.
- **Lost phone:** Remove on the computer cuts that phone off as now. Her data stays sealed. She pairs her new phone and unlocks with her synced passkey or her recovery code.
- **Lost passkey and recovery code:** her private Finances can't be opened by anyone. Say this before she turns it on.
- **Words:** plain ones that pass `app/preview/words.mjs`, and no Mac-only words in shared code (`TestNoMacOnlyWordsElsewhere`). Not "PRF", "AES" or "envelope"; for example "Only you can open these, with Face ID or your recovery code."

## 4. Tests that must fail first

**Go (`cmd/homelab`, `internal/companion`, `internal/finance`)**
- The sealed methods refuse each caller in 3.3's list, with a test for each.
- Once sealed, every plain Finances method from her phone is refused, and `FinancesShared` still answers.
- A stale `rev` is refused. A body over the cap is refused before it is read whole.
- The stored file never holds a known string the test's fake phone sealed. It is 0600 in a 0700 folder.
- Turning privacy on removes the plain files only after the sealed save. A failed save leaves them.
- No log line, alert, history entry or calendar feed mentions her figures.
- The WebAssembly build of `internal/finance` gives the same `finance.View` as the native one, on a small set of golden plans you add in step 1 (`internal/finance/testdata/`: made-up plans and ledgers, with the native `View` saved beside each as JSON).

**The page (`app/preview/shoot.mjs`, `mock.js`, adding lines only)**
- Turn on, lock, unlock with a passkey stand-in, unlock with the recovery code; a wrong code is refused in plain words.
- Nothing plain is left in `localStorage` or IndexedDB after locking.
- The shared section shows read-only.
- The one-line limit is shown on the web page.

**Swift Testing (`apple-client/Tests/`)**
- Seal and open round-trip; a wrong key and a tampered blob (GCM's tag) are refused.
- The passkey and recovery-code unwraps open the same data key.
- The xcframework's projection matches the golden plans.

## 5. Order: one PR at a time, each merged when green (`handoff.md`'s rules)

1. **Measure:** `internal/finance` as WebAssembly and as an xcframework, with sizes, the golden plans (`internal/finance/testdata/`, made up) and the match test. Ask the owner only if too big (3.2).
2. **The computer's side:** the sealed methods, the refusals once sealed, the store, the People row's fact, Remove's question. Go tests only; nothing visible yet.
3. **The phone's web page:** turn on, unlock and lock, her Finances drawn from the phone's projection, the shared section, bank files, recovery, turn off.
4. **The iPhone app:** the same, with the passkey's PRF, the Keychain and local reminders. Update `docs/Parity.md`.
5. **The docs:**
   - a page under `docs/` for the household, in plain words: what is sealed, what the owner can and cannot do, the web page's limit, losing the code;
   - `services/system/Phone companion.md`'s methods;
   - `docs/Storage.md`'s new file.
6. **`docs/Security.md` is the security session's.** Don't edit it; it adds the section after reviewing your PRs.

## 6. The two sessions, without stepping on each other

**You** (`handoff.md`'s session, the other account)
- Build all of this, on your own branches, one open PR at a time.
- Before each push, list the security session's open PR's files (lanes Rule 2). Wait if you would touch one, apart from `CHANGELOG.md`, where both add lines.
- Never edit `.claude/prompts/audit-loop.md` or `docs/Security.md`, and never touch the security session's branch (`claude/zealous-brahmagupta-bu2nrv`) or its PRs.

**The security session** (this account)
- Builds no screens and will not touch your branches, your PRs, `handoff.md`, or this feature's code while one of your PRs claims it.
- After each of your PRs merges, it reads the diff for holes. A real hole gets the smallest fix with a test, in a commit of its own on its own branch, only in a file no open PR of yours claims. Otherwise it writes it under **For Account 1** in `audit-loop.md`, which you read at the start of each round.
- It writes `docs/Security.md`'s section for this.

**Both**
- **Money stays on this machine** (`finances-loop.md`). No amounts, account names or merchants of hers in a commit, a PR, a prompt file, a screenshot or a test fixture. Made-up numbers only.
- The owner's other rules from `lanes.md` and `handoff.md` section 0 apply as they do to everything else.
