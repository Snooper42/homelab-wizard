---
version: 0.17.0
---

# Private Finances

A household member can keep her own Finances private, so that only she can open them, on her own phone. That includes the person who runs the homelab. This page says what that means, in plain words, for her and for whoever runs the computer.

## What it is

Everyone in Settings › People whose phone is theirs (Settings › Phones) already has Finances of their own on that phone: their accounts, bills, budgets, transactions and receipts, apart from the household's. Until they're private, the computer keeps them as ordinary files, and whoever runs it could open those files.

**Make them private…** (in Finances on her phone, in the Homelab app or on the phone's page) locks them on her phone before they reach the computer. From then on:

- The computer keeps one locked file for her, `finance.sealed`, and her receipts locked beside it. It can't open them. Neither can anyone at the computer, nor anything it runs.
- Her phone opens them, reads them forward with the computer's own Finances code built into the phone, and saves them locked again.
- What the household shares with her (`homelab person share`: bills, subscriptions, budgets) still shows, as before. It's the household's money, not hers, so it isn't locked.

## How she opens them

- **Her recovery code:** 16 words, shown once when she turns privacy on. She writes them down and types two of them back. The code opens her Finances anywhere, a new phone included.
- **Face ID:**
  - On the phone's page, a passkey made for them. It works at the address it was made on; another address (the homelab reached a different way) asks for the code instead.
  - In the Homelab app, Face ID opens them on any device where she opened them once with her passphrase or code. The key is then kept in that device's Keychain behind Face ID: never synced, never backed up, gone when the phone is unpaired. (The app can't use the page's passkey: that needs Apple's servers to reach the homelab's own address, and a homelab at home isn't on the internet.)
- **A passphrase** (12 characters or more), where Face ID's passkey can't lock them, and always when she turns privacy on in the app.

They lock again when she leaves Finances, after 5 minutes untouched, and when the page is hidden or the app goes to the background.

## Away from home

Her phone keeps the locked copy it last read (only ever locked, never her key). With no signal, Face ID, her passphrase or her code still opens them. A change she makes then waits on her phone, locked, and goes to the homelab by itself once it answers. If another of her devices changed them meanwhile, her phone says so plainly and shows the newest; the change made away isn't kept, and she makes it again.

## If she loses them

- **Her phone:** Remove it on the computer (Settings › Phones) as usual. Her Finances stay locked. She pairs her new phone and opens them with her recovery code (or, in the app, her passphrase).
- **Her recovery code and her passphrase, and her passkey:** no one can open her private Finances, ever. The app and the page say so before she turns privacy on.

## What the person who runs the homelab can and can't do

- **Can't:** open them, read them, or see any amount, account, payee or receipt of hers, on the computer, in a backup, a log or the record of who changed what.
- **Can see:** that she keeps them private, and when they were last saved (Settings › People, and `homelab person list`).
- **Can delete them:** removing her from the household (`homelab person remove`) asks whether to keep her Finances, and keeps them unless told otherwise (`--delete-finances`). Deleting them can't be undone.
- **No longer does for her:** the nightly Finances reminders, the Finances calendar feed, and the money card on a wall screen. The computer can't read her Finances to make them. The Homelab app on her phone gives her the same reminders itself (a bill due tomorrow, a paycheck that leaves checking under her cushion, a yearly renewal, balances not updated for weeks), worked out on her phone with the computer's own code each time she opens her Finances, and planned two weeks ahead.

## The phone's page has one limit

The phone's page is served by the homelab computer. Someone who changed the homelab's own code could make the page send them her key the next time she opens her Finances there. The Homelab app comes from Apple, not from the computer, so it doesn't have this limit: it's the stronger home for private Finances. The page says this where she turns privacy on.

## Turning it off

**Turn privacy off…** (on her phone, once she confirms) keeps her Finances plain on the homelab again, receipts included. The locked file and her recovery code stop mattering; whoever runs the computer could read her Finances again.

## Backups

Her locked file is in the nightly backup of the homelab's records (the encrypted Homelab Secrets job), as the rest of `data/members/` is. The copies of her plain Finances from before she turned privacy on are in the last 7 nights' backups, and age out on their own.

## For the curious

How it's built: the format and the steps are in `.claude/prompts/private-finances.md`. In short, a random key locks her Finances with AES-256-GCM on her phone; that key is itself locked by her recovery code (stretched with scrypt) and by her passkey or passphrase. The computer stores only what's locked (`internal/finance/sealed.go`) and checks its shape and size, never what's in it. The security review is in [Security](<Security.md>).
