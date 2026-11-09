# One session for everything: Tidy Up, Finances, and the iPhone app (Nov 9, 2026)

The owner now has one Claude account for this repository. This file joins the three lines of work that had sessions of their own, says where each stands, and puts them in one order. Start a new session with the launcher at the bottom. It sits above, and does not replace, the files it points to: each keeps the detail and its own rules.

You are working on homelab-wizard (github.com/Snooper42/homelab-wizard) with its owner. They are not a designer or a developer, and they work on this in the evening, at home with their Mac and phones. Explain choices in plain words, recommend one option rather than listing many, and show what changed.

## 0. Rules for this one session

- **`lanes.md` still describes four accounts; only the owner changes it.** Until they do, this session does the work of Account 1 (Tidy Up, Finances) and of the iPhone app (Account 4's `apple-client/`), and the desktop side the iPhone needs (the owner's yes, Nov 9: "build both", a desktop PR first, then the iPhone PR that uses it). Account 2's other screens and Account 3's audits stay theirs: write what you find for them in the loop files' **For Account N** sections.
- **One open PR at a time**, across all of it. Before a branch and before each push, list the open PRs' files (Rule 2).
- **Merging (the owner's standing rule):** merge each PR as soon as every check is green on its head, without asking: squash, `expectedHeadSha` pinned to that head, after checking what main gained since (Rule 5). The 3-a-day cap is waived. Never merge red.
- **Waiting on CI:** `subscribe_pr_activity` and one `send_later` check-in about 50 minutes out, then end the turn; don't poll. A PR that touches `.env.example` or `compose/` also runs the nightly's `real-docker` job (up to an hour).
- **GitHub is the only source of truth.** Start with `git fetch origin`, the open PRs, and `git ls-remote origin 'refs/heads/claude/*'`. Always branch from `origin/main`.

## 1. Where it stands (Nov 9, evening)

**In flight** (Nov 9, 23:20 UTC): #544 to #554 merged: away from home on both sides, the switch for the day they sign, links into the app (`homelab://`), buttons on alerts, what the computer can do (`/api/me`'s `computer`, its contract, the phone saying to update the computer and hiding what it lacks), and the \*arr apps resting. On Nov 9 at 18:26 GitHub marked a round of runs failed without starting any jobs: a re-run of each went green. If a run fails with no jobs at all, re-run it once before looking for a cause.
1. **`claude/nice-bohr-ab4jg1`: item 4, a record of what was done** (the owner's yes, Nov 9): `internal/history` (`data/homelab.db`, ADR-0022's first table), recorded from `noteLifecycle`, the watchdog, rollback, settings and Finances saves with who did it; `homelab history`; the desktop's **Recently done** on each app's page and **Everything that was done…**; the phone's on an app's More About page; the nightly backup's snapshot; `docs/Security.md`'s review. This file's update rides it. `claude/feature-iphone-signed` (replaced by #547) can go.

**Next after that: privacy first (the owner, Nov 9, 23:10 UTC, worried about exposure and privacy; "do whatever you recommend first"):**
1. **A "home only" switch for each public app**, ahead of everything else. `publishable()` in `cmd/homelab/domain.go` is the one place that decides what gets published (tunnel and Cloudflare DNS); a household list (`data/home-only.json` through `internal/applist`, as `ALERTS_OFF` is) makes it false, and Set up the domain then takes that app's hostname out of the tunnel and Cloudflare's DNS. A **Reach it away from home** switch on each public app's page (desktop and phone). New installs: home only unless the person turns it on, with one sentence on the trade-off. The owner's choices to suggest: Immich reachable (they view their library away, sync at home); Paperless and Vaultwarden home only (Bitwarden's offline copy still reads passwords away).
2. **An independent security review** of #544 onwards, in a session of its own running `.claude/prompts/audit-loop.md`: everything since was reviewed only by the session that wrote it.
3. **Photos through the sealed tunnel** (a roadmap idea, the owner's privacy): the Homelab app shows the Immich library itself, so it never passes Cloudflare readable and Immich can be home only too.
4. Then `unison-handoff.md` section 4 items 5 onwards, then Tidy Up and Finances in section 2's order.

Told the owner (Nov 9): away from home, public apps pass Cloudflare decrypted (only the phone companion's traffic is sealed end to end); at home with AdGuard's DNS nothing does, but Proton VPN's own DNS at home sends public hostnames through Cloudflare; their two-minute fixes are Proton VPN's LAN or custom-DNS setting at home and the Immich app's Wi-Fi-only backup with automatic URL switching. Mockups of tonight's work: https://claude.ai/artifact/6pMZY4aTNPG3gtcMaN4vrz

**Waiting on the owner:**
- **The App Group test** (`unison-handoff.md` section 2): `HOMELAB_WIDGET=1 ./apple-client/scripts/run-on-iphone.sh <prefix>`, and whether it signs. It decides the widget, Live Activities and Control Center work.
- **The Cloudflare token's two permissions** (*Access: Apps and Policies*, *Access: Service Tokens*, Edit) on their `CLOUDFLARE_API_TOKEN`, for the Setup step.
- **Finances:** whether "After <name>'s paycheck" now matches their spreadsheet (`finances-handoff.md`, its first section).
- **`unison-handoff.md` section 6's three questions** and Tidy Up's sidebar badge (`tidy-loop.md` queue item 8).

**Answered on Nov 9** (written where each belongs): all the \*arr apps rest unless something is actually pending, waking every 12 hours for new releases, with seeding keeping qBittorrent up, and a resting app says just **Resting** on Status (`tidy-loop.md`'s **Open now**); this session builds the desktop side too (above).

## 2. The order

Take the first that applies; one small PR each.

1. **What's in flight** (section 1), to merged.
2. **The owner's complaints** in `complaints.md`, in any of the three areas.
3. **The iPhone app away from home** (`unison-handoff.md` section 4, item 0): the Setup step *Reach Finances away from home* (Cloudflare Access application, service token, the tunnel's hostname, written to `.env`), then the phone's side (both addresses, the sealing in `internal/companion/tunnel.go`, Away mode).
4. **The rest of the iPhone and desktop work, in `unison-handoff.md`'s order:** section 3's switch for the day they sign, then section 4's items 1 to 12.
5. **Tidy Up** (`tidy-loop.md`): **Open now**'s \*arr rest, then the queue's item 2 (High) and the rest of the queue, and the look's L3 to L7.
6. **Finances** (`finances-handoff.md`, its first section): the #532 follow-ups, then Steps 4 to 7, each shown to the owner first.

When two are ready at once, the owner's own word on what hurts most wins (`unison-handoff.md` section 6 asks it).

## 3. Read before each kind of work

| Work | Read first | Its rules |
|---|---|---|
| Tidy Up | `tidy-loop.md` (**Open now**, the queue, the look) | its **Standing rules** and **Rules that never bend**; promises P1 to P12 |
| Finances | `finances-handoff.md` (first section), `finances-loop.md` (**How Finances works**) | `finances-loop.md`'s **Rules that never bend** (money data never leaves the machine) |
| The iPhone app and its desktop side | `unison-handoff.md`, `apple-client/README.md` | its section 5 (**Every PR**: a failing test first, security, **Try this tonight**) |
| Every PR | `lanes.md`, `complaints.md`, `CONTRIBUTING.md`, `docs/Testing.md` | this file's section 0 |

## Launcher (paste into a new session)

    Read .claude/prompts/handoff.md and follow it: finish what's in flight, then take section 2's order. Merge each PR as soon as it's green.
