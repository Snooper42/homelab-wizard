# One session for everything: Tidy Up, Finances, and the iPhone app (Nov 10, 2026)

The owner has one Claude account for this repository. This file joins the lines of work that had sessions of their own, says where each stands, and puts them in one order. Start a new session with the launcher at the bottom. It sits above, and does not replace, the files it points to: each keeps the detail and its own rules.

You are working on homelab-wizard (github.com/Snooper42/homelab-wizard) with its owner. They are not a designer or a developer, and they work on this in the evening, at home with their Mac and phones. Explain choices in plain words, recommend one option rather than listing many, and show what changed. They like a short back-and-forth on what's in flight and why; keep reports plain and short, and say what you need from them.

## 0. Rules for this one session

- **`lanes.md` still describes four accounts; only the owner changes it.** This session does the work of Account 1 (Tidy Up, Finances), of the iPhone app (Account 4's `apple-client/`), and the desktop side the iPhone needs (the owner's yes, Nov 9). The owner also said yes (Nov 9) to item 4's SQLite record, which is Account 2's base, and to the privacy work below. Other screens and audits stay their lanes': write what you find in the loop files' **For Account N** sections.
- **One open PR at a time**, across all of it. Before a branch and before each push, list the open PRs' files (Rule 2).
- **Merging (the owner's standing rule):** merge each PR as soon as every check is green on its head, without asking: squash, `expectedHeadSha` pinned to that head, after checking what main gained since (Rule 5). The 3-a-day cap is waived. Never merge red.
- **Waiting on CI:** `subscribe_pr_activity` and one `send_later` check-in about 50 minutes out, then end the turn; don't poll. A PR that touches `.env.example` or `compose/` also runs the nightly's `real-docker` job (up to an hour).
- **GitHub is the only source of truth.** Start with `git fetch origin`, the open PRs, and `git ls-remote origin 'refs/heads/claude/*'`. Always branch from `origin/main`.
- **Money stays on the machine** (`finances-loop.md`'s rules): never put the owner's amounts, holdings, account names or screenshots of Finances in a commit, a PR, a prompt file or an artifact. Describe a Finances bug in ratios and shapes, and test it with made-up numbers.

## 1. Where it stands (Nov 10, 00:00 UTC)

**Nothing is open.** #544 to #555 merged on Nov 9, each green:

| PR | What it did |
|---|---|
| #544, #545, #546, #548 | The iPhone app away from home through the Cloudflare tunnel (ADR-0023): Cloudflare Access with a service token, sealed end to end (`TunnelSeal`, `internal/companion/tunnel.go`), looking only; Setup's *Reach Finances away from home*; the phone tries home first, then the tunnel; Away mode when neither answers; a change of network tries home first again (`NetworkKind`) |
| #547 | `HOMELAB_SIGNED=1`, the switch for the day they join the paid Apple program, and the README's *The day you sign* |
| #549 | Links into the app (`homelab://…`, `DeepLink.swift`); an action link waits for one tap |
| #550 | Buttons on alerts: ntfy view buttons as `homelab://` links (`internal/notify/actions.go`) |
| #551, #552, #553 | `/api/me` says what the computer can do (`computer`: version, calls, features); `CompanionContract.json` and `ContractTests`; the phone says "Update Homelab Wizard on the computer" and hides what the computer lacks |
| #554 | The \*arr apps rest unless something is pending (`cmd/homelab/media_arr_rest.go`, `TIDY_ARR_REST`) |
| #555 | A record of what was done (`internal/history`, `data/homelab.db`, ADR-0022's first table), on each app's page on the computer and the phone, and `homelab history` |

**Mockups of that work** (for the owner): https://claude.ai/artifact/6pMZY4aTNPG3gtcMaN4vrz

**Lessons from Nov 9, for whoever comes next:**
- GitHub once marked a round of runs failed **with no jobs at all**: a re-run of each went green. Re-run such a run once before looking for a cause.
- **After resolving a conflict, diff every touched file against `origin/main`** before pushing: on #555 a hand-merged Swift test file lost two closing braces, and the Swift didn't compile. A file should only add what the PR adds.
- `go build ./cmd/homelab` fails in the repo root (a `homelab` script is there): build with `-o /dev/null`.
- A merged PR's branch is deleted on GitHub: start the next from a fresh `origin/main` and push plainly.
- `govulncheck` can't reach its database from the container; CI's **security** job runs it.
- This container can't compile Swift: CI's **Apple client** job is the first compile; the last six Swift PRs compiled first time, the seventh failed only on the merge mistake above.

## 2. The order

Take the first that applies; one PR each.

1. **The owner's Finances bug: Investments shows share counts about a thousand times too big** (reported Nov 10 with a screenshot; the numbers are the owner's, so none are written here). Details below. First.
2. **A "home only" switch for each public app** (privacy, the owner's worry; details below).
3. **An independent security review** of #544 to #555: **in a session of its own**, never this one (launcher below). Everything since #544 was reviewed only by the session that wrote it.
4. **Photos through the sealed tunnel**: the Homelab app shows the Immich library itself, so it never passes Cloudflare readable and Immich can be home only too. Ask the owner before building; it's large.
5. **The owner's complaints** in `complaints.md`, in any area.
6. **The rest of the iPhone and desktop work**, `unison-handoff.md` section 4, items 5 onwards (5: the same preferences everywhere; 6: alerts in the app, which can read `internal/history`).
7. **Tidy Up** (`tidy-loop.md`): the queue's item 2 (High) and the rest of the queue, the look's L3 to L7; and the \*arr rest's last piece (sending again a Seerr request that failed while they rested).
8. **Finances** (`finances-handoff.md`, its first section): the #532 follow-ups, then Steps 4 to 7, each shown to the owner first.

### 2.1 The Investments bug (first)

**What the owner sees** (Finances › Investments, desktop, dark): every holding's **Shares** is roughly 900 to 1,000 times what its own **Buys and sales in Ghostfolio** list says (a single buy of a dozen shares shows as a holding of about twelve thousand). Everything multiplied by it follows: **Worth now**, **Gain**, **Total value**, **This month**, the holding's chart (a line from 0 up to millions between two days), and the average cost a share, in cents. **You paid** is right. Every holding also says *Ghostfolio has no prices of its own for X yet, so its worth is today's price Ghostfolio looked up*. With the buys' counts, the totals come to a plausible few percent gain.

**What was read (Nov 10, no fix yet):**
- `internal/ghostfolio/ghostfolio.go`, `Holdings`: `shares := float64(h.Quantity)` straight from Ghostfolio's holdings answer (`gfHolding.Quantity`), times `marketPrice` (or the quote looked up when `Investment` is 0, the "no prices yet" path), is **Worth now**.
- The buys list is `Trades`, from Ghostfolio's activities (`gfActivity.Quantity` × `UnitPrice`); it shows the right count.
- `num.UnmarshalJSON` parses plainly (`strconv.ParseFloat`); `parseCount` (`web/src/finances/money.ts`) reads a typed decimal count right; `shares()` in `web/src/finances/widgets/Investments.tsx` formats both rows the same way. So the screen draws what the computer gives, and **Ghostfolio's holdings answer and its activities disagree** (or the holdings answer is read from the wrong field: check against the Ghostfolio version the owner runs, and its answer's shape for a holding with no market data yet).
- **Ask the owner first** what Ghostfolio's own page says (Ghostfolio › Holdings › the symbol: how many shares). About the buys' count: this app reads it wrong. The big number: Ghostfolio's own report is off for holdings without prices yet, and the app must not trust it.

**The fix, either way:**
- A holding's shares are checked against **its account's buys minus sales for that symbol** (the activities `Holdings` already reads for "paid" when `Investment` is 0; read them for every account with holdings). When they disagree by more than a rounding (say 0.1%, or 0.0001 shares), use the activities' count, compute **Worth now** from it, and mark the holding so the screen says one line: *Ghostfolio's holdings count disagreed with its buys and sales; this uses the buys and sales.* If the activities can't be read, keep Ghostfolio's count but never let one holding's worth be more than, say, 100 times what was paid without that line (*this looks wrong: check the holding in Ghostfolio*).
- **What the wrong reads left in the plan** (`data/finance.json`, through `ApplyHoldings` in `internal/finance/holdings.go`): each holding's `Shares`, `Value` and its daily `History` points (the chart and **This month**), **and the account's `Balance`**, which a read overwrites with its total. So the investment account's balance, and with it **net worth** on the Dashboard and its history, were inflated too. After the fix, a fresh **Read now** puts right today's figures and point; the earlier days' wrong points (Nov 8 and 9, and any net-worth history kept from them) stay unless repaired: when a stored point is more than 100 times what the holding's buys cost, drop it (with a test), and check what net worth keeps day by day. Tell the owner to press **Read now** once the fix is in.
- **Tests first, with made-up numbers** (never the owner's): the Ghostfolio stand-in in `internal/ghostfolio/ghostfoliotest` answering a holding of 12,500 shares with no market data and one buy of 12.5; expect 12.5 shares and the line. Also a matching holding (no line), a sale, two accounts with the same symbol, and activities that can't be read. A smoke case in `app/preview/shoot.mjs` with the mock's investments disagreeing, expecting the line and sensible totals.
- `finances-loop.md`'s **How Finances works** and its rules apply; it's Account 1's.

### 2.2 The home-only switch

`publishable()` in `cmd/homelab/domain.go` is the one place that decides what gets published (the tunnel and Cloudflare DNS). A household list (`data/home-only.json` through `internal/applist`, as `ALERTS_OFF` became `data/alerts-off.json`) makes it false, and Set up the domain then **takes that app's hostname out of the tunnel's ingress and Cloudflare's DNS** (it only adds them today: read `cmd/homelab/domain.go` and `internal/domain` for what it writes, and remove only what it wrote). A **Reach it away from home** switch on each public app's page, desktop and phone; for new installs, home only unless the person turns it on, with one sentence on the trade-off. Suggest to the owner: **Immich reachable** (they view their library away, sync at home); **Paperless and Vaultwarden home only** (Bitwarden's offline copy still reads passwords away; adding one waits for home). They haven't confirmed that; ask.

Told the owner on Nov 9: away from home, public apps pass Cloudflare decrypted (only the phone companion's traffic is sealed end to end); at home with AdGuard's DNS nothing does, but Proton VPN's own DNS at home sends public hostnames through Cloudflare. Their own two-minute fixes: Proton VPN's LAN or custom-DNS setting at home, and the Immich app's Wi-Fi-only backup with automatic URL switching.

### Waiting on the owner

- **What Ghostfolio's own Holdings page says** for one of the wrong holdings (2.1).
- **Paperless and Vaultwarden home only, Immich reachable?** (2.2)
- **The Cloudflare token's two permissions** (*Access: Apps and Policies*, *Access: Service Tokens*, Edit), then Setup's *Reach Finances away from home*, then pair the phone again at home: away from home stays off until then.
- **The App Group test** (`unison-handoff.md` section 2): `HOMELAB_WIDGET=1 ./apple-client/scripts/run-on-iphone.sh <prefix>`, and whether it signs.
- **Trying Nov 9's work on a phone**: they were installing it on Nov 10 (`git pull`, then `run-on-iphone.sh` with their prefix, after updating the computer).
- **Finances:** whether "After <name>'s paycheck" matches their spreadsheet (`finances-handoff.md`).
- **`unison-handoff.md` section 6's three questions** and Tidy Up's sidebar badge (`tidy-loop.md` queue item 8).
- **Branches safe to delete** (the owner deletes): `claude/feature-iphone-signed` (replaced by #547), `claude/inspiring-noether-x39490` (its file is on main).

## 3. Read before each kind of work

| Work | Read first | Its rules |
|---|---|---|
| Finances | `finances-handoff.md` (first section), `finances-loop.md` (**How Finances works**) | `finances-loop.md`'s **Rules that never bend** (money data never leaves the machine) |
| Tidy Up | `tidy-loop.md` (**Open now**, the queue, the look) | its **Standing rules** and **Rules that never bend**; promises P1 to P12 |
| The iPhone app and its desktop side | `unison-handoff.md`, `apple-client/README.md` | its section 5 (**Every PR**: a failing test first, security, **Try this tonight**) |
| Security and privacy | `docs/Security.md` (its Nov 2026 reviews), `docs/Decisions.md` (ADR-0005, ADR-0022, ADR-0023) | `audit-loop.md` for the review itself |
| Every PR | `lanes.md`, `complaints.md`, `CONTRIBUTING.md`, `docs/Testing.md` | this file's section 0 |

## Launchers (paste one into a new session)

The work, in this file's order (starts with the Investments bug):

    Read .claude/prompts/handoff.md and follow it: take section 2's order, starting with the Investments bug in 2.1. Merge each PR as soon as it's green.

The independent security review, in a session of its own (run it before or after the other, not at the same time):

    Read .claude/prompts/audit-loop.md and follow it, against what merged from #544 to #555 (Nov 9): the phone through the tunnel (ADR-0023), links into the app, alert buttons, the *arr apps resting, and the new history database (internal/history). Write each finding with a test that fails without its fix, and fix the real ones.
