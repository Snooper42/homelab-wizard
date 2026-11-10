# Handoff: the home-only switch, half built (Nov 10, 2026)

> **Done (Nov 10):** PR A merged as #559 (the computer side); PR B, the native iPhone app's switch, is the PR that adds this line. What's left is the last section: stop, and ask the owner what's next.

This picks up a session that ran out of usage partway through handoff.md's item **2.2**, the "home only" switch. Everything it wrote is on the branch **`claude/investments-bug-pr-merges-pmy7tp`**, in one work-in-progress commit. There's no PR yet. `.claude/prompts/handoff.md` still holds the standing rules (its section 0) and the order of work (its section 2); this file says where that order stands now and what's left of 2.2.

The owner isn't a developer. Talk plainly, recommend one option, and keep reports short.

## Where things stand

- **2.1, the Investments bug: done.** #558 merged (Nov 10). It checks each holding's shares against its account's buys and sales, adds the lines *disagreed…* and *looks wrong…*, and on the next **Read now** drops the stored days worth over 100× what was paid. Still waiting on the owner: whether they pressed Read now and it looks right, and how many shares Ghostfolio's own Holdings page shows for one of the wrong symbols (it tells us whether Ghostfolio itself is wrong).
- **#557 merged** too (the owner dropped the phone away from home).
- **Nothing is open.** Branches safe to delete (the owner deletes): `claude/feature-iphone-signed`, `claude/inspiring-noether-x39490`, `claude/nice-bohr-ab4jg1` (#557's).

### 2.2, the home-only switch: what the owner decided (Nov 10)

- Build it.
- **New installs of a public app start home only.** Apps installed before this keep working as they do now.
- **Immich stays reachable away from home; Paperless and Vaultwarden go home only.** The owner flips those two switches themselves once it ships: tell them how in the PR's *Try this tonight*.
- The switch shows **only on apps that can be published**, and only once the domain has the Cloudflare tunnel.

### Already written, on the branch (tests pass: `cmd/homelab`, `internal/domain`, `internal/api`, `internal/install`, `internal/applist`, `internal/companion`)

| Piece | Where |
|---|---|
| The list, `data/home-only.json` | `applist.HomeOnly` (`internal/applist/applist.go`); never a `.env` key, so not in `Moved` |
| `homelab away on\|off <app>` | `cmd/homelab/away.go`; in the command table and usage (`cmd/homelab/main.go`). Off: on the list, then `domain.Unpublish`. On: off the list, `mayPublish` (first-account check), then `domain.Publish`. Without the domain, tunnel or Cloudflare token, it keeps the list and says so |
| Removing only what the homelab put there | `domain.Unpublish` (`internal/domain/tunnel.go`): the tunnel rule for that host *and* the proxy's service only; the CNAME only when it points at this tunnel (`removeCNAME`, `internal/domain/dns.go`). The household's own rules and records are left and named |
| Set up the domain | `cmd/homelab/domain.go`: home-only apps are left out of `public`, named in the plan (*home only, kept off the internet: …*), and unpublished if they're still on; `domain status` lists them |
| New installs start home only | `install.Plan.HomeOnly` (a public app whose state was `NotInstalled`), saved in Apply's "env" step (`internal/install/install.go`) |
| What the page reads | `AppStatus.Reach` (`internal/api/api.go`, `status.go`): `"away"`, `"home"`, or `""` (no switch). TS types regenerated (`web/types/backend.d.ts`) |
| The setting | `SetAppSetting(id, "away", on)` on the computer (`app/app.go`) and for phones (`cmd/homelab/serve.go`); the companion advertises feature `"away"` (`internal/companion/server.go`); `CompanionContract.json` regenerated |
| Tests | `TestUnpublish`, `TestAwayOffKeepsAnAppHomeOnly`, `TestAwayWithoutTheTunnelIsKept`, `TestANewPublicAppStartsHomeOnly`, `TestStatusReach`; `TestDomainSetupEndToEnd` now keeps Vaultwarden home only. The install and domain tests were checked to fail without their change |

## What's left, in order

**PR A, the computer side (finish and ship this first):**

1. **The switch on the app page:** `web/src/page/AppPage.tsx`, `Settings`. When `a.reach` is set: `<Switch label="Reach it away from home" …>`, on = `switching.away ?? a.reach === 'away'`, calling `on.setting('away', v)`. Its sub line is the trade-off in one sentence. On: *Opens anywhere through your Cloudflare tunnel; away from home, Cloudflare can see what passes.* Off: *Home only: it opens on your home Wi-Fi, and nobody outside can reach it.* Update the `setting` doc comment (around line 48). The phone's *web* page reuses this page, so this also covers phones using the browser companion.
2. **Preview mock:** `app/preview/mock.js` `SetAppSetting` sets `reach` (`on ? 'away' : 'home'`) for `'away'`. As it stands, any setting it doesn't know falls through to `quiet`. Give one public app in the preview status a `reach` (see `apps` near the top of `app/preview/shoot.mjs`, line ~69: check which public apps it has).
3. **Smoke cases** in `app/preview/shoot.mjs`, next to *An app's settings: Nightly updates and Tell me if it stops…* (around line 4832):
   - the switch shows for the app with `reach`, and not for Vikunja;
   - clicking it moves it at once, records `['<id>', 'away', false]` in `settingsSet`, and the sub line turns to *Home only…*.
4. **The command test:** add `"away"` to the phone's `SetAppSetting` cases if `cmd/homelab/commands_test.go` lists them (around line 287).
5. **Docs:**
   - `docs/Storage.md`: a row for `data/home-only.json`, beside `alerts-off.json`.
   - `docs/Security.md`: line ~37 (public apps) and the row at ~84: new public apps start home only; `homelab away off` takes one off the internet, removing only what the homelab made.
   - `docs/Testing.md`: a hand-test row.
6. **Checks** (CONTRIBUTING.md): `make check`, `make coverage`, `make frontend` (commit `web/dist`), `make frontend-check`, `make app-check`, and the smoke cases you touched, in light and dark (`SMOKE_ONLY="…" node app/preview/shoot.mjs --smoke dark`).
7. **Commit, push, and open the PR**, following handoff.md section 0: one open PR; list open PRs first; merge as soon as every check is green, squash, `expectedHeadSha` pinned. Squash-merging turns the WIP commit into one clean commit.
   - The PR touches no `compose/` or `.env.example`, so no nightly `real-docker` wait.
   - *Try this tonight*: update the computer; open Paperless's page and turn **Reach it away from home** off, then Vaultwarden's; leave Immich on; then check `https://<paperless>.<domain>` doesn't open on mobile data and does at home.

**PR B, the native iPhone app's switch (after A merges, from a fresh `origin/main`):**

- `AppSetting` gets an `away` case. It's in `apple-client/Shared/…`; `apple-client/Tests/ActionTests.swift:191` lists the cases.
- Show the toggle where the app's status has `reach` and `computer.features` contains `"away"`. Otherwise hide it, the way #553 hides what the computer lacks.
- Read `unison-handoff.md` section 5 first. Swift compiles only in CI's **Apple client** job; after any conflict, diff every touched file against `origin/main`.

## Then stop, and ask the owner what's next

Once PR B merges (or if the owner says to stop sooner), **don't start anything else**. Tell the owner in a few plain lines what shipped and what they need to do on their computer. Then ask which of these comes next, with your recommendation first:

1. **The independent security review** of #544 to #558 (handoff.md item 3). Recommend this one: nothing since #544 has had a second pair of eyes, and #558 and the switch touch money and the internet. It must run **in a session of its own**, with handoff.md's second launcher.
2. **Photos through the sealed tunnel**, so Immich can be home only too (item 4). It's large: ask before building.
3. **The owner's complaints** in `complaints.md` (item 5).
4. **The rest of the iPhone and desktop work** (`unison-handoff.md` section 4, items 5 onward).
5. **Tidy Up** (`tidy-loop.md`) or **Finances** (`finances-handoff.md`).

## Lessons from this session

- Investments' smoke checks read their totals from the preview's precomputed view, not from the plan's balances, so a case can't inflate a total by changing a balance in the mock.
- **smoke (dark)** once failed on an unrelated transactions check (*a typed transaction links itself…*, a 5 s wait). It passed 3 of 3 locally and on one re-run. Re-run such a failure once before looking for a cause.
- Don't `git checkout origin/main -- .` to compare: the safety check refuses it, as it would overwrite the work. Use `git diff origin/main` or `git stash`.
