# Loop S: Set up (one account, Nov 23 to Tue Nov 24, 9 PM ET)

**Launcher** (the owner pastes this into the fresh account's first session):

    /loop Run: git fetch origin main claude/vibrant-mayer-jiim8w. Then read .claude/prompts/setup-loop.md from main if it's there, else from the branch (git show FETCH_HEAD:.claude/prompts/setup-loop.md), and follow it.

**Paused:** no

## The job

Get the other two loops ready to start, and make the first change the owner can see, before lane R's account opens on Tue Nov 24 at 9 PM ET. Follow `lanes.md` (every session's steps and its rules) as lane **S**, with these differences:

- Your title is `Loop S: Set up`, and your branches are `claude/setup-*`.
- **Make no scheduled task:** `/loop` paces you.
- You do the items below, which are other lanes' items. Tick each in **its own** loop file, in the pull request that finishes it.
- **From Tue Nov 24, 8:30 PM ET, start nothing new.** Merge what's green. Leave an unfinished pull request with a clear **Next** in its description for lane R, and set **Paused: yes** here.

## The work, in order

- [ ] **S1. Put the plan on main.** Open a pull request from `claude/vibrant-mayer-jiim8w` to main, with this title: *The redesign's target and three loops that ship by themselves*. It holds:
  - `docs/Redesign.md` and its pictures
  - the mocks' source (`app/preview/redesign`)
  - these loop files

  It changes no code the app runs. Merge it when it's green (lanes.md rule 5); fix what's red on that branch. From then on, read every file from main.
- [ ] **S2. Why the owner sees nothing change:** `quality-loop.md`'s **Q0**, in full. It ends with the owner's two questions in `owner.md`.
- [ ] **S3. The card:** `redesign-loop.md`'s **R1**.
- [ ] **S4. Finances' frame:** `redesign-loop.md`'s **R2**, split as it says if it's big.
- [ ] **S5. If there's time:** `redesign-loop.md`'s **R3**, the Dashboard.
