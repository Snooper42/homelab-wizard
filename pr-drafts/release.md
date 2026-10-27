## Summary

The 0.11 item "The release builds opened on each runner: the DMG mounted and the app started, the Windows installer run silently and `homelab.exe` found beside the app, the AppImage already started on its own (ISSUE-0014, ISSUE-0021)". **Done when:** "`release.yml` does each of these on every run and keeps a screenshot of each window".

- **`app/packaging/dmg-smoke.sh`** (macOS job): mounts the DMG, checks its Applications shortcut, drags the app to `~/Applications` (ditto) as a person does, checks its signature (`codesign --verify --deep --strict`), the CLI inside (`Contents/Helpers/homelab version`), the menu bar helper and the homelab files, opens it, and finds it still running 20 seconds on; `screencapture`; stops the app and its menu bar helper.
- **`app/packaging/windows-smoke.ps1`** (Windows job): runs the installer silently (`/S`, as `install.ps1` does), finds `Homelab Wizard.exe` in `Program Files\Snooper42\Homelab Wizard` with `homelab.exe`, `homelab-run.exe`, and the homelab files beside it, runs `homelab.exe version`, starts the app, and waits for its window titled Homelab Wizard; a screenshot of the screen; stops every app process.
- **`.github/workflows/release.yml`**: both steps, and screenshot artifacts `macos-dmg-screenshot` and `windows-installer-screenshot` (kept even when the step fails), beside the AppImage's existing `linux-appimage-screenshot`.
- **Docs:** Roadmap item ticked with a Done line; ISSUE-0014 "Partly verified, to verify" with progress; ISSUE-0021 notes the silent installer; CHANGELOG Improved line.

## Safety impact

- [x] Does not expose an app to the internet by default
- [x] Does not write secrets anywhere but `.env`
- [x] Does not delete data without a backup and a confirmation first: it installs into the runner only
- [x] Does not claim it works on a machine unless it was actually tried there: ISSUE-0014 stays open for the real machines

## Validation

- [x] `make check` clean
- [x] release.yml dispatched on the branch with all platforms ([run 40499975280](https://github.com/Snooper42/homelab-wizard/actions/runs/40499975280); publishing needs main or a tag, so nothing was released): macOS "homelab 0.9.69-beta" from inside the bundle and "The DMG's app starts from Applications"; Windows "The installer put the app in C:\Program Files\Snooper42\Homelab Wizard with the CLI beside it, and the app starts (window: Homelab Wizard)"; Linux's AppImage step green. Earlier runs found the app's name on Windows is `Homelab Wizard.exe` and that the Mac app starts its menu bar helper, both handled.
- [x] Screenshots kept (274 KB on macOS, 62 KB on Windows). The artifact store cannot be reached from the sandbox this was written in, so nobody has looked at them yet.
- [ ] CI on this head (release.yml itself does not run on pull requests; it runs on the merge to main)

## Notes

Handoff: merge once CI is green. After the merge, check the next release.yml run on main for the two new steps.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01RK6Vw4qnad3nDZKbqeBwqp
