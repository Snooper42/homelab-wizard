# Loop S: Set up (account C, now to Tue Nov 24, 9 PM ET)

**Started by** the accounts' start lines in `lanes.md`: the table *Which account runs what* says which account runs lane S when.

**Paused:** no

## The job

Get accounts A and B ready to start, and make the first change the owner can see, before account A opens on Tue Nov 24 at 9 PM ET. You're the lead until account B takes everything over on Mon Nov 30: you'll run lane Q after this, and lane R once account A's trial ends, so read `docs/Redesign.md` in full once. Follow `lanes.md` (every session's steps and its rules) as lane **S**. **Until S1 is merged,** read `lanes.md` and the other loop files from `origin/plan`, the same way you read this one. These are the differences:

- Your branches are `claude/setup-*`.
- You do the items below, which are other lanes' items. Tick each in **its own** loop file, in the pull request that finishes it.
- **From Tue Nov 24, 8:30 PM ET, start nothing new.** Merge what's green. Leave an unfinished pull request with a clear **Next** in its description for lane R, and set **Paused: yes** here.

## The work, in order

- [ ] **S0. Check the machinery.** Your scheduled task is made (lanes.md step 5). You can open, check and merge a pull request with the GitHub tools (S1 proves it), and send a push notification. Anything that asks the owner for a permission, or can't be done, goes in `owner.md` at once: it would stop accounts A and B too.
- [x] **S1. Put the plan on main.** Open a pull request from `claude/vibrant-mayer-jiim8w` to main, with this title: *The redesign's target and three loops that ship by themselves*. It holds:
  - `docs/Redesign.md` and its pictures
  - the mocks' source (`app/preview/redesign`)
  - these loop files

  It changes no code the app runs. Merge it when it's green (lanes.md rule 5); fix what's red on that branch. From then on, read every file from main.
- [ ] **S2. Why the owner sees nothing change:** `quality-loop.md`'s **Q0**, in full. It ends with the owner's two questions in `owner.md`.
- [ ] **S3. The card:** `redesign-loop.md`'s **R1**.
- [ ] **S4. Finances' frame:** `redesign-loop.md`'s **R2**, split as it says if it's big.
- [ ] **S5. If there's time:** `redesign-loop.md`'s **R3**, the Dashboard.
