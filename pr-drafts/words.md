## Summary

Two CLI messages gave the Mac's way on every system, which 0.12's "No Mac-only words on other systems" check did not catch:

- `duplicati setup` ended with "Open .env (open -e .env), copy it into Vaultwarden…". Now each system's own: `open -e .env` on a Mac, `notepad .env` on Windows, "in a text editor, or nano .env" on Linux (`editEnv`).
- `uninstall` listed "Homelab Wizard (drag it to the Trash)" as left for you. Now: the Trash on a Mac, Settings › Apps › Installed apps on Windows, "remove the homelab-wizard package, or delete its AppImage" on Linux, "delete its AppImage" on SteamOS (`removeApp(host.Profile)`).
- The Mac-only words test (`internal/host`) now also fails on `open -e .env` and `to the Trash` outside Mac-only code.
- CHANGELOG Fixed line; a sentence added to the Roadmap's ticked words item.

Both showed up in the log of the Home-mode run on Linux (the queued `claude/home-real`).

## Safety impact

- [x] Does not expose an app to the internet by default
- [x] Does not write secrets anywhere but `.env`
- [x] Does not delete data without a backup and a confirmation first
- [x] Does not claim it works on a machine unless it was actually tried there

## Validation

- [x] `make check`, `make coverage`, gosec clean
- [x] `TestRemoveAppOnEachSystem` (each system's profile, and `editEnv` for each), and the words test passing with the two new words
- [ ] CI on this head

## Notes

Handoff: merge once CI is green.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01RK6Vw4qnad3nDZKbqeBwqp
