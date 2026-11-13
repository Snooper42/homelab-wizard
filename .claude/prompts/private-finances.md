# A household member's own finances, private even from the owner

The owner's ask (Nov 13, 2026), by multiple choice: his wife checks in on her **own** personal finances from her phone, and **only she** can read them, **even he**, the person who runs the homelab computer, cannot. It lives on her phone, in **the Homelab iPhone app and the phone's web page**. It holds:
- **her own accounts and bills**, with the same month view and "what's left" as Finances;
- **what the owner already shares with her** (the bills, subscriptions and budgets of `memberShared`, `cmd/homelab/member.go`), beside her own;
- **her own bank files** (CSV, OFX), imported on her phone.

Written by the security session (`audit-loop.md`), which builds no screens. Account 1 builds the computer's side and the phone's web page; the iPhone app's side is Account 4's lane (`apple-client/`). The security session reviews each PR as it merges.

## What "even from me" means, and its one limit

The owner holds the computer, its disk, its backups and the code it serves. So her finances must never reach the computer readable:
- They are encrypted **on her phone**, with a key the computer never sees.
- The computer keeps only a sealed blob it cannot open, and gives it back to her phone and to no other.

**The limit, to say plainly in the app and in the docs:** the phone's web page is code the computer serves. An owner who changed that code could make the page send him her key the next time she unlocks. The iPhone app is code from the App Store or TestFlight, not from the computer, so it does not have this weakness. The web page's privacy therefore holds while the page is the homelab's own, and the iPhone app is the stronger home for it. Say so in one plain line where she sets it up. Never claim more.

## How it works

**Her key**
- A random 256-bit data key, made on her phone. Her finances are sealed with AES-256-GCM, a fresh nonce on every save.
- The data key is itself sealed ("wrapped") twice:
  - **by her passkey**, through WebAuthn's PRF extension (iOS 18 and later; in the app, `ASAuthorizationPlatformPublicKeyCredentialProvider` with PRF). The passkey syncs through her own iCloud Keychain, so a new phone of hers unlocks it.
  - **by a recovery code**: 128 random bits, shown once as words to write down, stretched with scrypt or Argon2id before use.
- A phone without PRF falls back to a passphrase she chooses (at least 12 characters, scrypt or Argon2id with strong settings). It is wrapped the same way, and the recovery code still applies.
- Nothing that unwraps the data key is ever sent to the computer.

**The computer's side**
- **The blob:** one file per person, `data/private/<username>.bin`, 0600 in a 0700 folder. It holds the sealed data, the two wrapped keys, the KDF settings, a format version and a revision number. Nothing in it is readable.
- **`PrivateLoad`, a phone method:** answers that blob, only to a paired phone whose `Device.Person` is that person and who is still an active member. The owner's phones, a wall screen, another member's phone and a removed phone are refused.
- **`PrivateSave(rev, blob)`, a phone method:** the same check, plus:
  - a size cap (say 8 MB, under `MaxCall`);
  - the revision must match, or the save is refused as stale, so two phones of hers don't overwrite each other;
  - written whole, under `lockedfile.Update`.
- **No other door.** No desktop method, CLI command or alert reads it. Nothing shows its size or count beyond "Anna has private finances (last saved …)", and logs never mention it.
- **What the owner can still do, said honestly:**
  - He can delete the file. Settings › People › Remove asks whether to keep it, keep by default.
  - The encrypted Homelab Secrets backup carries the blob still sealed, and a restore brings it back still sealed.
  - He can never read it.
- **Away from home** (the tunnel, ADR-0023): the blob is sealed already. The calls go through the same per-phone checks and `MaxTunnel`.

**Her phone's side**
- **Unlock:** passkey (Face ID or Touch ID), or the passphrase. The opened data key is held in memory only while the screen is open. Never in `localStorage` or IndexedDB in plain form; in the app, never in UserDefaults, only the Keychain with `.whenUnlockedThisDeviceOnly` if kept at all.
- **Bank files:** read and parsed on the phone (as Finances already does in the page), added to her own sealed ledger. The file never goes to the computer.
- **What the owner shares:** fetched as it is today for a member's phone. Shown beside her own, read-only, and never mixed into her sealed data.
- **Lost phone:** Remove on the computer cuts that phone off as now. Her data is safe because it is sealed. On her new phone she pairs again and unlocks with her synced passkey or her recovery code.
- **Lost passkey and recovery code:** her private finances cannot be opened by anyone. Say this when she sets it up, and have her confirm she wrote the code down (type back two of its words).

## Tests that must fail first (the security session will look for them)

**Go (`internal/companion`, `cmd/homelab`)**
- `PrivateLoad` and `PrivateSave` refuse the owner's phone, a wall screen, another member's phone, a member who was removed, and an unpaired caller.
- A stale `rev` is refused. A blob over the cap is refused before it is read whole.
- The stored file never holds a known plaintext string that the test's fake phone sealed. Its mode is 0600 and its folder 0700.
- No log line, alert or history entry mentions it.

**The page (`app/preview/shoot.mjs`)**
- Set up, lock, unlock with the passkey stand-in, then with the recovery code.
- A wrong code is refused with a plain word.
- Nothing plain is left in `localStorage` or IndexedDB after locking.

**Swift Testing (`apple-client/Tests/`)**
- Seal and open round-trip.
- Wrong key refused; a tampered blob refused (GCM's tag).
- PRF-derived and recovery-code unwraps both open the same data key.

## The rule every PR keeps

`finances-loop.md`'s **money stays on this machine** applies, and goes further here:
- no amounts, account names or merchants of hers anywhere outside her phone;
- not in a commit, a PR, a prompt file, a screenshot or a test fixture;
- test with made-up numbers.

## Order

1. **The computer's side and its Go tests** (Account 1): the two phone methods and the store. Nothing visible yet.
2. **The phone's web page** (Account 1): set up, unlock, her accounts and bills, the shared slice, bank files. Include the one plain line on the web page's limit.
3. **The iPhone app** (Account 4): the same screens, with the passkey's PRF and the Keychain.
4. **The docs:**
   - `docs/Security.md` gets a section reviewed by the security session;
   - the phone companion's page in `services/` says what is sealed and what the owner can and cannot do.
