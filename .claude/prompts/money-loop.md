# Loop M: Money

**Launcher** (the scheduled task's prompt, and what the owner pastes into the first session):

    Read .claude/prompts/lanes.md and .claude/prompts/money-loop.md, and follow them.

**Paused:** no

## The job

Finances that need almost no typing. The owner, Nov 23: *"it's starting to become overwhelming how often I'd have to update the transactions and balances to keep everything up to date. I need this to be easy."* Done means:

- **The banks bring transactions and balances in by themselves** for whoever turns SimpleFIN on, and a dropped bank file does the same for whoever doesn't.
- **Every payee has its logo.**
- **Shared bills are split between the people who share them.**
- **A partner can open and use her own Finances** on her phone.

The decisions behind it are in `docs/Redesign.md` (*What the owner decided*, *Logos for every payee*, *New work behind the pictures*). Lane R lays out the screens: ship the data with the plainest UI that works, and tell R what it can lay out (lanes.md, *Where R and M meet*).

## The owner's answers (Nov 23; don't ask again)

- **Separate Finances, with shared bills.** The split varies by bill: 50/50, a fixed amount, or one person pays it all.
- **All of it:** transactions, categories, budgets and reports, as well as the paycheck plan.
- **SimpleFIN, opt-in for everyone,** each person with their own setup code; off by default.
- **Logos: a logo service, opt-in** (logo.dev, which MoneyMatter uses, or Brandfetch), plus everything that can be built in.
- **A partner's Finances are "just separate,"** not sealed. `docs/Private Finances.md` stays for whoever wants it.
- **She has no iPhone app for now** (no paid Apple Developer account), so she uses the phone's page.
- **As close to MoneyMatter as possible,** in its ideas only (lanes.md rule 11).

## Where things are (read the code before relying on this)

- **The plan and the View:** `internal/finance` (`project.go` for the projection; `View` is what the screen reads). `app/financeapps.go` reads Firefly III and Ghostfolio on a click.
- **The import:** `web/src/finances/importData.ts` (CSV, OFX, QFX, QIF; `plannedFor` links a row to a planned payment, and `pairs` joins transfers), `payees.ts` (`cleanPayee`, `shopOf`), `guessCategory.ts`, and the rules (`Plan.Rules`). The iPhone app's port is `apple-client/Shared/Models/BankImport.swift` and `BankGuess.swift`, tested against the computer's answers in `apple-client/Tests/Resources/PayeeVectors.json` (made by `apple-client/scripts/make-payee-logos.mjs`).
- **Logos:** `web/src/finances/logos.ts` (337 simple-icons marks with bg and ink, contrast checked by `app/preview/lint.mjs`), `sites.ts` (each brand's website), `Mark.tsx` (`brandOf`), and `internal/sitelogo` (Get the real logo, only on a click).
- **Sharing today:** `cmd/homelab/member.go` (`homelab person share`, read-only bills, subscriptions and budgets) and `web/src/finances/Shared.tsx`.
- **Secrets:** `.env`, 0600, with ADR-0011 in `docs/Decisions.md`. The no-bank-connection decision is ADR *Typed in by hand* in `docs/Decisions.md`.
- **The planned design for bank files and SimpleFIN:** `handoff.md` section **2I** (read only that section).

## The work, in order

- [ ] **M1. SimpleFIN for one person (the owner).** Needs Q's review (lanes.md rule 6).
  - **Turning it on:** paste a SimpleFIN setup code (one plain line first: the transactions then pass through SimpleFIN on their way here). The homelab claims it for its access link, kept as a secret and never logged.
  - **Reading:** each morning on the homelab's schedule, and on **Read now**, it reads accounts, balances and new transactions.
  - **Matching accounts:** each SimpleFIN account is matched to a Finances account once (the owner picks; it's remembered).
  - **Transactions:** they take the same path as an imported file (duplicates skipped, rules applied, linked to planned bills). Keep one set of matching rules. The matching lives in TypeScript today, and in its Swift port: either hand the rows to that same path, or move the matching to Go as `mobile/finance` did. Pick the smaller change and say why in the pull request.
  - **Balances:** each account's balance comes from SimpleFIN, with its date.
  - **Saying how it went:** when it last read, and what failed, in words. **Turn off** forgets the link.
  - **Docs:** `docs/Decisions.md` rewritten (opt-in bank connection), and `docs/Private Finances.md` and `docs/Security.md` where they say there's no bank connection.
  - **Tests:** against a fake SimpleFIN server; SimpleFIN's own demo setup code (in its developer docs) for one real try.
  - Then a line for R (Bank connections, the banks' strip, Read now).
- [ ] **M2. Balances from files, and the watched folder.** A bank file's balance (OFX `LEDGERBAL`, a CSV's balance column) sets that account's balance with its date; today an import never changes a balance. Then the watched folder from `handoff.md` 2I.1: a folder Finances watches; a dropped file is read on the computer, matched to its account, duplicates skipped, rules applied, and moved to *Imported* beside it; one it can't place waits in Finances, once. Nothing leaves the computer.
- [ ] **M3. A logo for every payee** (`docs/Redesign.md`, *Logos for every payee*). Split into these pull requests:
  - **(a) Built in, nothing sent.** All of simple-icons (about 3,300 marks; mind `app.js`'s size: a separate file loaded when Finances opens is fine), each pair at 4.5:1 or better and the licence header true. A merchant list of common US merchants: how banks spell them, and their websites. `cleanPayee` and `shopOf` learn the card processors' prefixes (SQ \*, TST\*, PAYPAL \*, …), with the Swift port and `PayeeVectors.json` changed in the same pull request.
  - **(b) Fixing one by hand.** A payee's website, and a logo search that picks a brand ("blue bottle", then pick).
  - **(c) Nothing found:** the category's icon, or a monogram in the category's colour.
  - **(d) The logo service, opt-in, per person.** Needs Q's review. The computer asks, never a page or the phone, so the key stays home. Each payee is looked up once, by name, for its website and logo, and the logo is kept in the plan. One plain line before it's on: the service sees which shops you use, never an amount. Default logo.dev; say why in the pull request if you pick Brandfetch.
  - **Done when** the preview ledger's payees all show a logo or their category's mark, and the owner's own month shows a real logo on at least nine rows in ten (ask them in `owner.md` once (d) ships).
- [ ] **M4. Shared bills with splits.**
  - A payment marked shared, with its people and the split (50/50, an amount each, or one pays it all).
  - Each person's plan counts their own share, and what's been paid back (**Mark sent**).
  - The View gives each person's side for R's *Shared with …* card, on both people's Finances.
  - It replaces `homelab person share` for bills; subscriptions and budgets stay as they are.
  - The owner's mortgage, entered today as money in from her (`Payment.Payer`), becomes a shared bill when they open it once.
  - Old plans keep loading (lanes.md rule 10).
- [ ] **M5. A partner's own Finances, easily, on the phone's page.**
  - She pairs her phone and sees her own Finances, just separate.
  - She can turn SimpleFIN on for herself from her phone. The computer keeps her link, and the owner never sees her banks or her figures on the computer's screens.
  - Her page has three tabs (Finances, Apps, Settings). **Apps** lists her homelab apps (Photos, Passwords, Movies, …), one tap each.
  - Needs Q's review (what a phone may call).
  - Then a line for R (its R10).
- [ ] **M6. The period before, for every chip.** For each of the Dashboard's figures, the View gives the same figure for the period before, so R's chips are right.
- [ ] **M7. Update balances, nearly gone.** With M1 and M2 in place:
  - Accounts read by SimpleFIN or a file aren't asked.
  - A loan's balance follows its papers.
  - The house and the car get a yearly nudge.
  - Update balances asks only for what nothing else knows, and says so.

## From the other lanes

Lanes R and Q add a line here when they need something from Finances' data, with where and why.

- (none yet)
