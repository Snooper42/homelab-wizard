## Summary

The 0.11 item "The same, for the app's own update: the previous release's app replaced by this one keeps the window's settings, the paired phones, and the jobs". **Done when:** "a test replaces the previous release's build with this one in a scratch folder and reads each setting back".

- **`TestAnUpdateKeepsTheWindowThePhonesAndTheJobs`** (`internal/selfupdate`, plain `go test`, so on the Ubuntu, macOS, and Windows runners): each system's real update helper (the Mac's bundle swap script, the AppImage's, the portable Windows build's) replaces a stand-in previous build with a stand-in new one in a scratch folder. Beside it: the window's place and size where the app keeps them, the phones the newest release in `testdata/upgrades` paired, and the agent's job (its plist, systemd unit, or Run value) pointing at the CLI. After the swap each reads back the same, the phones through this build's `companion` store, and the job's program is there.
- **Fix it found:** an AppImage's jobs run a copy of the CLI in the homelab folder (`bin/homelab`, made by `schedule install` because the AppImage's own path goes away when it closes). The update left that copy on the previous release, so the watchdog, the nightly backup, and the updates kept running the old CLI. `core.JobsCLIBehind` notices a copy that differs from the CLI the app ships, and the app runs `schedule install` again at its next start, which copies it again (`app/app.go` moveToAgent). The agent runs each part through that path, so the next run of each is the new release's.
- **Docs:** Roadmap item ticked with a Done line (the builds are stand-ins; the helpers are the real ones); CHANGELOG Fixed line.

## Safety impact

- [x] Does not expose an app to the internet by default
- [x] Does not write secrets anywhere but `.env`
- [x] Does not delete data without a backup and a confirmation first: `schedule install` only rewrites the jobs and the CLI copy
- [x] Does not claim it works on a machine unless it was actually tried there

## Validation

- [x] `make check`, `make coverage`, gosec (root and `app/`) clean
- [x] `TestAnUpdateKeepsTheWindowThePhonesAndTheJobs` and `TestJobsCLIBehind` pass on Linux here
- [ ] CI on this head: the macOS and Windows branches of the test run there for the first time

## Notes

Handoff: merge once CI is green.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01RK6Vw4qnad3nDZKbqeBwqp
