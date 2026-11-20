# Media automation made easy: the loop (lane 5)

The owner, Nov 19, 2026: improve the \*arr stack that's already there, so someone who isn't technical can use it. **Remove friction**: no new apps for their own sake, no debrid or streaming add-ons (looked at and dropped on Nov 19). This file is the whole job for the account that runs it. The iPhone and iPad app stays with lane 4 (`apple-loop.md`) on another account. Don't touch `apple-client/`.

## Launcher (paste into a new session)

    /loop Read .claude/prompts/arr-loop.md and do the next round.

With no interval, /loop paces itself. Each round re-reads this file, so to steer the loop, edit it on main.

**Paused:** no. (Change this to **yes** and push to pause the loop: a round that reads yes opens nothing, merges nothing, says it's paused, and waits.)

## The goal in one line

A household member touches two things: **Seerr to ask for a film or show, Jellyfin to watch it.** Everything in between is the wizard's job. A round that person wouldn't notice is a round wasted, unless it fixes a failure, lost data, or a security hole (`lanes.md`, *The goal*).

## 0. Rules (they never bend)

1. **`lanes.md` first, every round.** Where it and this file disagree, it wins. Rule 2 (a file claimed by another lane's open PR) applies before every branch and every push.
2. **The wizard never picks search sites.** It may say none are set up yet, open Prowlarr's page for adding one, and tick when one works. It never names, suggests, ships, or preconfigures an indexer, a tracker, or a scraper. Words stay neutral: "find and download what you ask for", never "free movies" or "replace Netflix". The bundle stays opt-in, as now.
3. **Secrets stay secret.** VPN keys, API keys and the passwords the wizard makes go in `.env` (0600, ADR-0011) and nowhere else on the computer: never in a log, a link, an alert, a PR, or this file. A new secret goes in `.env.example` with a comment saying where it comes from, and must be covered by the redaction phones, alerts and reports get (`docs/Security.md` N15).
4. **A failing test first, then the fix.** The Go tests next to the code, against the fake APIs `internal/wiring` already uses. A screen change gets a smoke case and before/after pictures (`app/preview/shoot.mjs`).
5. **Running `wire` twice changes nothing the second time.** Every link it makes must be found and left alone on the next run, and a key or address that changed must be corrected, never duplicated (`wiring_test.go` checks this for today's links; keep it true for new ones).
6. **One open PR at a time**, on `claude/arr-*` branches only. Merge per `lanes.md` Rule 5: squash, `expectedHeadSha` pinned, every check green on that head, and main's new commits touch none of its files. **No daily cap** (the owner, Nov 19): merge as soon as that holds.
7. **While a PR waits:** call `subscribe_pr_activity` and end the turn. Don't poll.
8. **Every PR ends with "Try this tonight"**: 3 to 5 clicks the owner can do in one evening, with what each should show. Say if it needs the VPN key, or an app started again.
9. **Ask the owner only with the AskUserQuestion pop-up**, every question at once, and only when the decision is genuinely theirs. Recommend one option.
10. **Never without the owner's yes:** weaken a security choice, delete a branch or data, move files on the media drive, loosen CI, or open a second PR. No model name in commits or PRs.

## Start here (every round)

1. `git fetch origin main`. Land your open PR if it's green; fix it first if it's red.
2. Read `complaints.md` under **Media automation (Account 5)**, and every **For Account 5** section in the other loop files. Those come first.
3. Take the next item from section 4 that isn't done. Before starting, list every other open PR's files (Rule 2).
4. Before you stop: update section 3 (where it stands) and push it with your PR, or on its own to main if no PR is open.

## 1. What you're working with (facts, checked Nov 19)

- **The bundle:** `x-homelab-bundles.arr` in `compose.yaml`: Prowlarr, Sonarr, Radarr, Lidarr, Bazarr, FlareSolverr, qBittorrent, and Seerr. Gluetun comes with qBittorrent. All are in `compose/media-automation.yaml`.
- **What `homelab wire` already connects** (`internal/wiring/wiring.go`, `steps()`): Prowlarr to Sonarr, Radarr and Lidarr; FlareSolverr in Prowlarr; qBittorrent as each app's download client (categories `tv`, `movies`, …); each app's root folder; Bazarr to Sonarr and Radarr; Seerr to Sonarr and Radarr. **Seerr's Jellyfin sign-in is printed as a step for the person to do** (`seerrSignIn`, `more.go:228`).
- **How it's tested:** fake APIs in `wiring_test.go` and `more_test.go`. The nightly workflow's `wire` job runs `wire --apply` against real Prowlarr, Sonarr, Radarr, Lidarr and FlareSolverr. **qBittorrent can't be tested for real in CI:** it waits for Gluetun, which needs a real VPN key (`docs/Known Issues.md`). Keep qBittorrent's side against fakes, and say so in the PR.
- **The VPN:** Gluetun with ProtonVPN WireGuard, port forwarding on (`PORT_FORWARD_ONLY`, `VPN_PORT_FORWARDING`). It needs a **paid** Proton plan (`.env.example:424`). The forwarded port is copied into qBittorrent by hand today (Gluetun's page, Setup step 5), and it changes when the VPN reconnects.
- **The layout copies rather than hard-links:** `/downloads` and `/tv` are separate mounts (`Sonarr.md:68`), so every import is a full copy and takes double the space while the torrent seeds. Not to be changed (Nov 19): item 0 stops the seeding and moves the file once instead.
- **Tidy Up is involved, and it's lane 1's (parked):** it puts the \*arr apps to rest while nothing is pending (`cmd/homelab/media_arr_rest.go`, `docs/Tidy Up.md` line ~97), and **Hand over** turns off the \*arrs' own filing so Tidy Up files downloads instead (`homelab media arr --apply`). The owner agreed (Nov 19) to the changes item 0 needs; note them under **For Account 1** in `tidy-loop.md`.
- **Jellyfin is native** (ADR-0010) at `host.docker.internal:8096`, with `JELLYFIN_API_KEY` in `.env` when set (Settings › People uses it).
- **ntfy is already set up with tokens** (`internal/notify`, Setup's alert step).

## 2. The friction today (walked through Nov 19)

From ticking **Media automation** to watching something, a person goes through about eight steps in five apps:

1. Gets a ProtonVPN WireGuard key (paid plan, port forwarding on) and pastes it into the plan.
2. Copies the forwarded port from Gluetun's log into qBittorrent, which goes stale on every reconnect.
3. Sets a login in each \*arr on first open ("Authentication required").
4. Finds qBittorrent's temporary password in its log, then saves a permanent one as `QBITTORRENT_PASSWORD`.
5. Runs **Connect apps**.
6. Signs into Seerr with a Jellyfin admin, then runs **Connect apps** again.
7. Adds search sites in Prowlarr. Nothing downloads until they do, and nothing says so.
8. Chooses quality profiles (jargon) and whether to **Hand over** to Tidy Up (a choice they can't judge).

Afterwards, a request that can't be found or downloaded sits at "Requested" in Seerr with no explanation.

## 3. Where it stands

- **The owner's answers (Nov 19; don't ask again):**
  1. **Tidy Up files every download.** Setup turns **Hand over** on by itself.
  2. **No daily merge cap** for lane 5 (rule 6, `lanes.md` Rule 5).
  3. **Disk space comes first:** storage is expensive. Never two copies of a download; item 7's default is *save space*; no hard links (item 9 dropped them).
- **Nov 19, round 1:** this file and `lanes.md` updated with the answers, item 0 and the CasaOS-style items (a)–(d). Item 0's check done from the code (below); next round starts item 0's fix.
- **Nov 19, round 2:** item 0, part 1: `wire` sets qBittorrent to stop sharing once a download is finished and keep unfinished ones in `incomplete/` with `.!qB` (`internal/wiring/qbit.go`, against a fake qBittorrent). Next: part 2, the inbox waits for qBittorrent (a torrent an indexer keeps seeding is still listed), and Setup turns Hand over on. **#767 merged.**
- **Nov 19, round 3:** item 0, part 2a: the inbox files a download from qBittorrent's folder only once qBittorrent says it's finished and stopped (or gone); running but unreadable holds the whole folder, said on the card (`cmd/homelab/media_inbox_qbit.go`, `inbox.py` `held_by_torrent`; noted under **For Account 1** in `tidy-loop.md`). Next: part 2b, Setup turns Hand over on.
- **Nov 20, round 4:** #770 merged. Item 0, part 2b: Connect apps (`wire`) turns Hand over on by itself whenever the inbox files `DOWNLOADS_ROOT`; otherwise each app keeps filing and wire says why (`owner.go` `tidyFilingSteps`). **The owner, Nov 20: always merge a PR once it's green** (rule 6). Item 0 is done with this; next is item 1a.
- **Nov 20, round 5:** #771 merged (item 0 done). Item 1a: the ⚙ on every Status row and app page opens Sign-in details (address; *Sign in*, *Paste into another app*, *Keep safe*), `keys`/`recovery`/`keyfile` in the catalog, `CopyAppKey`, the copy shown on the button. Filled for the media apps, qBittorrent's login, Duplicati's and Kopia's recovery. Next: fill `login`, `keys` and `recovery` across the catalog (1a's second PR), then 1b.
- **Nov 20, round 6:** #773 merged (1a's first PR, and the Paperless-ngx 3.5 fix that had failed the nightly since Nov 17, #747/#748/#758). 1a's second PR: `login` and `keys` across the catalog (not native apps: Jellyfin's key stays in Settings); two keys sharing a label show by name. Next: 1b, *Saved in Proton Pass?*
- **Nov 19, round 7 (9:50 PM ET):** #775 merged (1a done). 1b: the Saved tick (`internal/kept`, `data/kept.json`, by name), the ⚙'s dot (`Unkept`), Setup's *N passwords aren't in your password manager yet* (`password-manager`, Keep safe first); a new value saved in Settings clears its tick. **The owner, Nov 19 (via another session): times in ET, never UTC**, in notifications, PR text and these notes. Next: 1d (logins made for them), then 1c's note for Account 4.
- **Nov 19, the owner's ask:** a ⚙ on every app (Status and its page) with its sign-in details to copy into Proton Pass, the copy shown on the button; a *Saved* tick; the phone too, behind Face ID; no bulk import file. Item 1 (1a–1d), after item 0's part 2.

## 4. The work, in order

Each item is one small PR unless it says otherwise. Before writing code, **check the app's current API** (each app's own docs or source) for every call named here; these were planned from memory and are not yet verified.

0. **Tidy Up and qBittorrent agree** (the owner, Nov 19; disk space first).
   - **Today (checked Nov 19, from the code; not yet seen on a real qBittorrent):** the inbox calls a download finished when it has no partial file (`.!qB`, …) and nothing in it changed for 5 minutes (`inbox.py` `settled()`). It never asks qBittorrent. So a torrent that's still seeding is filed after 5 minutes: a rename on the same drive, else a copy then delete (`media_common.move_file`). Only one copy stays, but qBittorrent loses its files and the torrent shows *Missing files*. Worse, a stalled download with no `.!qB` names (qBittorrent's default) and outside `incomplete/` (set by hand today, qBittorrent.md:77) looks finished too, and is filed half-done. `wire` sets no seeding limit.
   - **The fix:** `wire` sets qBittorrent to stop seeding once a download is finished (share limit reached at once, action *Stop*, or remove the torrent and keep its files), and to keep unfinished files in `incomplete/` with `.!qB` on. The inbox files a download from qBittorrent's folders only once qBittorrent says it's finished and stopped (or gone); can't read qBittorrent means wait, said on the card. The file is moved once, never copied and kept twice.
   - Setup turns **Hand over** on by itself (answer 1), so the \*arrs never import a second copy. Lane 1's code: note it under **For Account 1** in `tidy-loop.md`.
   - Test: a fake qBittorrent with one torrent seeding and one stopped; the inbox files only the stopped one, and a second `wire` changes nothing.
1. **Every app's sign-in, one gear away** (the owner, Nov 19: every password and token goes into their Proton Pass, not only the app; asked for every app, not only the media ones). Lane 2's screens are parked, so lane 5 builds this; note each PR under **For Account 2** in `maintenance-loop.md`. One PR per bullet:
   - **1a. The gear and its sheet.** A ⚙ on every Status row and on each app's page opens the app's **Sign-in details**: its address, user name, password and API key, as far as the homelab knows them. Each secret shows as ••••••• with its own **Copy**. The value goes straight to the clipboard, never to the page, and the clipboard clears after 90 seconds. **A copy shows on the button itself:** a highlight around it and a small bounce (no bounce with Reduce Motion), then *Copied. Paste it into Proton Pass*. Settings' copy note says Proton Pass too (it says Vaultwarden today). An app with nothing to copy shows its address and *Nothing to sign in with: it uses the homelab's sign-in* (or *the app asks you to make one on first open*).
     - **Show only what a person uses**, sorted by what they do with it: *Sign in* (user name, email, password: the catalog's `login`), *Paste into another app* (API keys and tokens: a new catalog list, `keys`), and *Keep safe* (what opens the backups: `DUPLICATI_PASSPHRASE`, `KOPIA_PASSWORD`, a new `recovery` list, with *Without this the backups can't be opened*). Internal secrets (database passwords, signing secrets such as `*_DB_PASSWORD`, `*_SECRET_KEY`, `*_JWT_SECRET`) stay in Settings only. `validate` checks every listed key is in `.env.example`, as it does for `login`.
     - **Keys an app keeps itself:** the \*arr apps' API keys are in their `config.xml`, Seerr's in its `settings.json`, Bazarr's in its `config.yaml`. A catalog field says where (`keyfile`), and one copy call reads it there (as `wiring.apiKey` does) and puts it on the clipboard the same way. qBittorrent gets `login: [QBITTORRENT_USER, QBITTORRENT_PASSWORD]`.
     - Start with the media apps and the five apps that have `login` today; then fill `login`, `keys` and `recovery` across the catalog in one more PR.
     - A smoke case for the gear, the dots, the bounce and *Copied*, and before/after pictures.
   - **1b. "Saved in Proton Pass?"** After a copy, the row offers a quiet **Saved** tick, kept by key (never the value) in `data/`. The gear shows a dot while an app has a password or key not ticked. Setup gets one item, *N passwords aren't in your password manager yet*, with the *Keep safe* ones first, since losing those loses the backups. A password made anew (1d, or a reset) clears its tick.
   - **1c. On the phone, behind Face ID** (the owner, Nov 19: yes). Once 1a's calls exist, write them under **For Account 4**: a read call listing each app's rows (labels and whether set, never a value), and a copy call returning one value. Only phones allowed to change the homelab (`Change: true`) may call it, Face ID first on the phone, every copy written to the app's history (*Sonarr's password copied on Alex's iPhone*), and the phone clears its clipboard after 90 seconds (`UIPasteboard` expiry). A security choice: write it up in the PR (lane 3 is parked), and the owner looks before it merges.
   - **Not doing (the owner, Nov 19):** one file of every sign-in for Proton Pass's import. Copy one at a time; a password only ever sits on the clipboard.
   - **1d. Logins made for them** (removes steps 3–4), shown in 1a's sheet:
     - At install, the wizard generates a password for the \*arrs and qBittorrent, saves it in `.env` and sets it in each app, so "Authentication required" never appears. Check whether each \*arr's `/api/v3/config/host` (`/api/v1` for Prowlarr and Lidarr) takes the method, username and password, and how qBittorrent's password is set before first start.
     - 1a's sheet shows it, and 1b's Setup item asks once to save it in Proton Pass.
     - Test: a fresh install has a login on each app, and a second `wire` run changes nothing.
2. **The VPN looks after itself** (removes step 2, softens step 1).
   - Gluetun puts its forwarded port into qBittorrent by itself on every change. Check Gluetun's wiki for its port-forwarding "up" command and what qBittorrent needs to accept it from `127.0.0.1` (they share a network).
   - The wizard checks the downloads leave through the VPN, not the home connection, and shows a green **Downloads are private** tick (in Setup and on qBittorrent's page). Today that check is a command typed by hand (Gluetun step 4).
   - The plan's VPN-key field gets a plain three-step walkthrough of where to find the key, and says up front that it needs a paid Proton plan.
3. **Seerr signs into Jellyfin for them** (removes step 6).
   - The wizard asks for the Jellyfin admin password once, uses it for Seerr's first-run sign-in through Seerr's own API, and doesn't keep it.
   - `wire` then links Seerr to Sonarr and Radarr in the same run. `seerrSignIn` becomes a fallback when the password is wrong.
   - This touches Setup or the plan (Account 2's screens): see section 6.
4. **Sensible defaults `wire` sets** (one PR; each one a step that is found next time).
   - Sonarr and Radarr tell Jellyfin to refresh after each import (Settings › Connect › Emby / Jellyfin, with `JELLYFIN_API_KEY`, and the path mapped from `/tv` to the media drive's path). Skipped, with a line saying why, when there's no key.
   - Sonarr, Radarr and Lidarr send health and failed-grab alerts to ntfy, in plain words, through the alert token `notify setup` made.
   - qBittorrent: Automatic torrent management, so each category gets its own folder (the seeding stop is item 0's).
5. **Search sites: guided, never chosen** (step 7; Rule 2).
   - A Setup item: "No search sites yet". Its button opens Prowlarr's page for adding an indexer. A live tick appears when Prowlarr lists at least one that passes its own test.
   - The item explains what a search site is in one sentence, with no names.
6. **The Downloads card** (the "why isn't anything happening?" fix; may be two PRs).
   - One card on Status, in plain words, e.g. *Getting 2 · 1 stuck: no search site has it · Drive 82% full*. It's built from the \*arr queues, qBittorrent, Seerr's requests, and the drive's free space. The resting logic already reads most of this; reuse it, don't copy it (a shared function in lane 1's code is fine; note it under **For Account 1** in `tidy-loop.md`).
   - **It warns before the drive is full:** at 85% it says so in plain words (and roughly how many more films fit), and at 95% it's the card's first line; the same warning goes through ntfy once, not every hour. (d) below reuses this check for every drive.
   - The same messages go to the phone through ntfy.
   - Then write a **For Account 4** note in this file: the companion call that serves the card, so lane 4 can show it on the phone.
7. **One plain question instead of quality profiles** (step 8).
   - "What do you mostly watch on?": *a 4K TV* / *an HD TV or phones* / *save space*. **Save space is the default** (answer 3). The answer maps to a profile in Sonarr and Radarr, and Seerr's default profile follows it.
   - Keep the mapping in one place, with a test for each answer.
8. **The \*arr apps folded away.** On Status, the \*arr apps sit under one "Media automation" line, open on a click; the card from item 6 is what people see. This uses `internal/statusfolds` and is Account 2's screen: see section 6.
9. **Later, once 0–8 are done** (ask the owner before starting): **Recyclarr** for tested quality profiles behind item 7's three answers. (Hard links dropped Nov 19: item 0 already keeps one copy.)

**Lane 5's next work, CasaOS-style (the owner, Nov 19): the computer side only.** Once the computer's call for (b), (c) or (d) exists, write it under **For Account 4** below, so lane 4 builds the phone side. (a) stays on the computer. Choose and install and an app's page are lane 2's (parked): change them in small PRs and note it under **For Account 2** in `maintenance-loop.md`.

- **(a) Add your own app** by pasting a compose file. The wizard checks it (it parses, no clash with a port or name already used, no secret pasted in plain text: offer to move it to `.env`), shows in words what it will run, and installs it like a catalog app, with its own page.
- **(b) Change Settings on an app's page:** its address (port), its folders, and the settings its catalog entry lists. A copy of the app's settings is kept first, and **Undo** puts it back; a change that stops the app from starting is undone by itself.
- **(c) Share a folder on the home network** with one switch: read-only by default, home network only (never reachable from the internet). A security choice: write it up in the PR for the owner (lane 3 is parked).
- **(d) Drives:** warn before any drive fills (item 6's check), and put new films on a second drive without moving the old ones (a second Radarr root folder that new films go to; Tidy Up files there too: lane 1's code, so **For Account 1**). Never move files already on a drive (rule 10).

## 5. Ask the owner first

**Answered Nov 19** (section 3): Tidy Up files every download; no daily cap. Nothing open.

## 6. Where lane 5's work meets other lanes

Today only lane 4 has an account (`lanes.md`, *Who's working now*). Lanes 1, 2 and 3 are parked, so nothing here waits on them.

| Need | Whose | How |
|---|---|---|
| `compose/media-automation.yaml`, `internal/wiring`, `services/media automation/*`, the bundle in `compose.yaml`, and the media automation parts of Setup, the install plan and Status | **Lane 5** | Yours (`lanes.md`, row 5) |
| Other Setup, Status and Settings code an item needs (Settings › Copy, the Status card's frame, `internal/statusfolds`) | Lane 2, parked | Change it yourself in a small PR, then note what you changed under **For Account 2** in `maintenance-loop.md` |
| Resting the \*arrs (`cmd/homelab/media_arr_rest.go`), **Hand over**, Tidy Up's filing | Lane 1, parked | Change it only if an item needs it and the owner agreed (section 5), then note it under **For Account 1** in `tidy-loop.md` |
| The phone showing the Downloads card | Lane 4, **active** (`apple-loop.md`) | Don't touch `apple-client/`. Once the computer's call exists, write what it serves under **For Account 4** below; lane 4 builds the phone's side |
| A security question (secrets, what's exposed) | Lane 3, parked | Write it up in the PR. The owner looks before it merges |

## For Account 4

Lane 5's notes for the iPhone and iPad app. Lane 4 reads this section at the start of each round.

- Nothing yet. Coming, in this order: the Downloads card (item 6), then (b), (c) and (d).

## Done
