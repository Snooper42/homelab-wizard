---
version: 0.15.0
---

# Homelab Manifest

## Mission

Run the household's private services on hardware we own, securely and reliably, with as little upkeep as possible.

## Values

1. **Data first.** Photos, documents, and passwords are irreplaceable. Nothing else matters if they are lost.
2. **Secure by default.** No open ports, no default passwords, least privilege everywhere.
3. **Boring is good.** Prefer the simple, well-trodden solution to the clever one.
4. **One source of truth.** The compose files describe the apps; the notes are generated from them; nothing is described twice.
5. **Reversible changes.** Preview, back up, change, verify.
6. **Written down.** If it is not in the docs, it does not exist.

## Rules

- No change without a backup and a rollback plan.
- No secret in git, a note, a chat, a command line, or a log.
- No public hostname without authentication in the app and CrowdSec in front of it.
- No container gets the raw Docker socket to change the engine: read-only users go through the socket proxy, and the nightly updates run outside any container. The one exception is the optional Beszel agent, which runs on the host's network and reads the socket mounted read-only.
- No app is added without a note, a backup decision, and a monitor ([Contributing](<Contributing.md>)).
- The baseline holds only what the household needs every day. Everything else is optional.

## Definition of healthy

- `./homelab status` shows every baseline app running and healthy.
- `./homelab watchdog` passes.
- Last night's backup jobs succeeded, and a restore test passed this month.
- No unread alerts in ntfy.
