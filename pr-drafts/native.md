## Summary

The 0.12 item "The parity table in Host: one row per feature …, one column per system". **Done when:** "every cell says *works*, *works differently (how)*, *missing*, or *can't (why)*, and each *works* names the test or CI job that shows it".

The last *works* cells without a test, and one that was not really *works*:

- **`TestNativeAppOpensForReal`** (`app`, `-tags forreal`, macOS only): Jellyfin quit, then opened by `App.OpenNativeApp` (Status's Open button), and its server answering `Healthy` on 8096; a container app is refused.
- **`TestNativeAppsOpenAfterARestartForReal`** (`cmd/homelab`, `-tags forreal`, macOS only): Jellyfin quit, then opened by `openMacApps` (what `up --wait-media` runs after a restart), answering, and left alone when it already runs.
- **CI (`test (macos-latest)`)**: a step installs the Jellyfin cask as the catalog's note says (`brew install --cask jellyfin`), clears quarantine as opening it once in Finder would, and runs both.
- **docs/Host.md:** the two Jellyfin rows name these tests; Frigate's detector on Linux becomes *works differently*: added by hand, as Frigate's note says, the homelab adds none of it.
- **docs/Roadmap.md:** the item ticked (every cell is one of the four, each *works* names its test). CHANGELOG Improved line.

## Safety impact

- [x] Does not expose an app to the internet by default
- [x] Does not write secrets anywhere but `.env`
- [x] Does not delete data without a backup and a confirmation first
- [x] Does not claim it works on a machine unless it was actually tried there

## Validation

- [x] `make check` clean; both tests vet for darwin
- [x] A check that every system cell in the table starts with works, works differently, missing, or can't, and no *works* row's proof says none
- [ ] CI on this head: the macOS runner runs both tests for the first time (Jellyfin's app name, its headless start on the runner, and `/health` are not yet seen there)

## Notes

Handoff: merge once CI is green; if the macOS step fails, read its log (the cask's app name, a first-run dialog, or quarantine are the likely causes).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01RK6Vw4qnad3nDZKbqeBwqp
