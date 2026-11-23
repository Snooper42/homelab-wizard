# Loop Q: Quality

**Started by** the accounts' start lines in `lanes.md`: the table *Which account runs what* says which account runs lane Q when.

**Paused:** no (account C runs it from Tue Nov 24, 9 PM; lane S does Q0 before then)

## The job

What ships works on the owner's real machine, nothing leaks, and media automation keeps getting easier. Three kinds of work, in this order every session:

1. **Something broken comes first:**
   - main's CI red
   - a nightly run that failed (an issue titled *Nightly run failed on …*)
   - a line under **Doesn't work or bugs me** in `owner.md`
2. **Reviews:** every open pull request whose description starts **Needs Q's review: yes** (lanes.md rule 6). Review its current head and comment **Q review: OK**, or what must change and why. End the comment with the footer the session gives you. Review again after each push.
3. **Your list below.** At most one media automation item (Q7) per session, so the other two kinds aren't kept waiting.

A security hole you find in another lane's code: fix it yourself, with the smallest change, in a pull request of your own, if no open pull request claims the file. Otherwise write it under **From the other lanes** in that lane's loop file.

## A review, step by step

For a pull request that needs Q's review, check every one of these, and say which you checked:

- **What leaves the machine:** to which host, with what, when, and only once the person has turned it on. The screen says it plainly before it's on.
- **Secrets:** in `.env` only, at 0600; never in a log, an error, a page, an alert, `homelab report` or a fixture; in the redaction phones, alerts and reports get (lanes.md rule 9).
- **What a phone may call:** the names in `cmd/homelab/serve.go`'s `phoneMethods`; a look-only phone can't change anything; one person's phone can't read another's Finances.
- **Input from outside:** a size limit, a timeout, no private addresses (as `internal/sitelogo` refuses them), nothing written outside its folder.
- **Turned off means gone:** turning it off forgets the link or the key.
- **The docs:** `docs/Security.md` says what's sent, and its tests cover the above.

## The work, in order

- [ ] **Q0. Find out why "nothing works."** One session, before anything else.
  - **Does the owner get the new builds?**
    - The release workflow publishes every build of main: check the latest releases exist, with their files.
    - The app updates itself (`app/autoupdate.go`, `app/updates.go`): its tests pass, and nothing obvious stops it on a Mac.
    - The iPhone app is built by hand with a free Apple ID, so it lapses after 7 days, and the owner sees only what they last built.
  - **Write what you found in `owner.md`:** a plain paragraph under **Waiting on you**, with the two questions only the owner can answer.
    - What version does Settings › This Mac show?
    - When did you last build the iPhone app in Xcode?
  - **Fix anything you find in the update path** in a pull request.
- [ ] **Q1. The open security list.**
  - **Make the list.** From `audit-loop.md`'s *Security backlog, in order* (only that section, and only its items not marked done) and the open items in its *For Account 2* usability findings, write the ones still open into this file, one line each and worst first, under **The security list** below.
  - **Archive the history.** Say at the top of `audit-loop.md` that it's archived, then work the list from here.
- [ ] **Q2. The owner's machine, for real.** `test/realdocker` and the nightly workflow are the closest thing to it. Make sure the nightly run covers what the owner uses most:
  - Status's Start and Restart
  - a backup and a restore test
  - an update with its undo
  - Finances' save and load
  - Connect apps for media automation

  A gap becomes a test, and a failing one an issue.
- [ ] **Q3. Privacy of every call out.** `internal/sitelogo`, `internal/cardprice`, the release-notes reader, and each new one as it ships (SimpleFIN, the logo service).
  - **What's sent, when, and on whose click,** written in `docs/Security.md`.
  - **What's in `homelab report` and the logs:** checked to carry no amount, payee or key.
- [ ] **Q4. The backups' engine, for R's Backups** (`docs/Redesign.md`, *New work behind the pictures*).
  - **(a) Each app's result each night,** kept for fourteen nights.
  - **(b) Not in any backup:** what's left out (Syncthing's folder, `SYNC_ROOT`, today), with **Add**.
  - **(c) Get something back:** one file or a whole app from a chosen night, through the backup engine, saved as a copy or put back, with a test against a real Duplicati and Kopia (`test/realdocker`).

  Each part is one pull request, then a line for R under **From the other lanes** in `redesign-loop.md`.
- [ ] **Q5. The security list** (Q1), worst first, one item per pull request.
- [ ] **Q6. Whatever's flaky.** A test that fails now and then (the Windows `TestJobLogSplitsAtOnceAllFinish`, *being used by another process*): find the cause and fix it, never retry it away.
- [ ] **Q7. Media automation.**
  - **Where it stands:** `arr-loop.md`'s sections *3. Where it stands* and *4. The work, in order*, and its *0. Rules*, which still bind media automation (above all rule 2: the wizard never picks search sites).
  - **What's left:**
    - (a) add your own app from a pasted compose file
    - (b) change an app's settings on its page, with Undo
    - (c) share a folder on the home network: a security choice, so the owner decides (lanes.md rule 4)
    - (d) drives: put new films on a second drive
  - **Each one:** one pull request, with **Try this tonight**.

## The security list

Q1 fills this in, one line each, worst first; Q5 works it.

- (Q1 hasn't run yet)

## From the other lanes

Lanes R and M add a line here: a check that failed for a reason outside their change, a security worry, or something the backups' engine must do.

- (none yet)
