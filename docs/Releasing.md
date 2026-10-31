---
version: 0.15.0
---

# Releasing

`.github/workflows/release.yml` builds the desktop app and the CLI for macOS, Windows, and Linux, signs what it has certificates for, and drafts a GitHub release for each `v*` tag. Every change to main that touches the app or the engine also publishes a numbered release with the builds for every system as the latest build (Releases › Latest).

## Version numbers

Every build of main is a release of its own, numbered from `VERSION` and the commits since `VERSION` last changed: with `VERSION` at `0.11.0`, the fourth commit after it builds `0.11.4`, published as `v0.11.4` (the release workflow's `version` job). Versions carry no `-beta` from 0.11.0 on (October 2026, the owner's call); 0.9.0-beta to 0.10.0-beta kept it. Nothing needs committing for a build to get its number. A push that changes none of the built paths (docs alone) builds nothing, so the numbers can skip.

## A new minor or major version

1. Set `VERSION` (`0.12.0`, `1.0.0`), the `version:` front matter of every note to match (`./homelab validate` checks it), and move the `[Unreleased]` notes in `CHANGELOG.md` under a new `## [0.12.0] - <date>` heading, with a bold one-line summary of the version.
2. Push to main. That build is `v0.12.0` (the count starts again at `.0`), which the stable channel moves to, and its release notes are that version's section of the CHANGELOG; the builds after it are `v0.12.1` and on.
3. If this version changed the shape of a file the homelab folder keeps (`.env`, `data/*.json`, `scripts/logs/*.json`), add its folder to the upgrade set once it is tagged: `testdata/upgrades/make.sh v0.12.0`, then commit `testdata/upgrades/v0.12.0`. `TestEachReleasesFolderUpgrades` then opens it with every later build.

## Release notes

`CHANGELOG.md` is the patch notes: each version's **New**, **Improved**, and **Fixed**, one plain line each (CONTRIBUTING.md says how to write one). The `publish` job makes each build's notes from it: the version's own section for the first build of a version, then the CHANGELOG lines added since the release before (each commit's first line when a build added none). The app shows them before an update.

The versions before numbered releases (0.2.0 to 0.9.0-beta) were tagged afterwards at the commit where each ended, and their releases published by hand from their CHANGELOG sections. They have notes and no builds, so the stable channel skips them. A workflow could not publish them: its token may not tag a commit whose `.github/workflows` differ from main's.

A tag made with your own login (`gh release create`, `git push --tags`) starts a tag build of that commit, as a tag pushed by hand does. For a notes-only release of an old commit, cancel those runs in Actions: one that finishes attaches its build to the release, and the stable channel would then offer that old build.

A tag pushed by hand (`git tag v0.10.0 && git push origin v0.10.0`) still builds a draft release with checksums and build provenance, to check for "unsigned" notes and publish yourself.

To get the files without a release (for testing the pipeline), run the workflow by hand: Actions › Release › Run workflow. It builds the Mac app unless you pick **all** (or Windows or Linux) under *Which builds to make*, and the files stay attached to the run for 3 days; a tagged build keeps them 14 days, and the release keeps its own copies.

If a run fails with *Artifact storage quota has been hit*, older runs' files fill the account's storage: run Actions › **Clean up artifacts** (it keeps the newest run's files and deletes the rest), wait for GitHub to recount (up to 12 hours), and run the release again.

## The latest build

Every push to main that changes `app/`, `web/`, `cmd/`, `internal/`, `go.mod`, `go.sum`, `VERSION`, or the workflow runs the `macos`, `windows`, and `linux` jobs, then the `publish` job makes the numbered release ("Homelab Wizard 0.14.3", tag `v0.14.3` on that commit, with its release notes from the CHANGELOG) the repository's Latest, with every build that worked (the Mac build must; a failed Windows or Linux build is left out until the next push). A newer push cancels a build still running. The same files also replace the `nightly` pre-release, which apps from before numbered releases look for; their next update brings a build that follows the numbered releases.

Each build carries where it came from: `-ldflags` set `main.version`, `main.commit`, and `main.repo` for the app, and `Commit` and `Repo` in `app/tray` for the menu bar item (the CLI gets `main.version`). The app's update (`internal/selfupdate`, **Update now** on the line at the top of the window) reads the newest build for the update channel (the Latest release on `testing`, the newest `vX.Y.0` release with builds on `stable`), compares its commit with the running build's, downloads the file for how it was installed (the Mac's DMG, the Windows portable zip for the PC's processor, whether the app came from the installer or the zip, with the installer only for a release that has no zip; the AppImage; or the .deb, .rpm, or Arch package), checks it against the SHA-256 digest GitHub records for the asset (and stops if they differ), swaps itself for the new build, and reopens. On Windows a hidden PowerShell script puts the zip's files in place once the app has quit, as an administrator (one approval) only where the account cannot write the folder (Program Files), so SmartScreen and Smart App Control, which blocked the unsigned installer, are not in the way. Each attempt's steps go in `update.log` in the user's cache folder; a build that did not go in place says why when the app opens on the old one, with the release page, and the same update is not offered again. A homelab folder the app made then follows by itself (`homelab upgrade`, *Finishing the update…*), on every system. The app looks every 15 minutes and when its window comes forward; with the window closed, the menu bar item looks on the same schedule and says *Update to …*.

## What gets built

| Platform | Files | Signing |
|---|---|---|
| macOS | `Homelab-Wizard-macOS.dmg` (Apple Silicon and Intel; the app beside a shortcut to Applications), `homelab-darwin-arm64.zip`, `homelab-darwin-amd64.zip` | Developer ID, hardened runtime, notarized; the DMG is stapled |
| Windows | `Homelab-Wizard-Windows-Setup.exe` (NSIS installer for x64 and ARM64 PCs: the app, the `homelab.exe` CLI, and `homelab-run.exe`, which starts the scheduled jobs without a console window, each built for the PC's processor), `Homelab-Wizard-Windows-portable.zip` and `Homelab-Wizard-Windows-ARM64-portable.zip` (the same three files, no installer), `homelab-windows-amd64.exe`, `homelab-windows-arm64.exe` | Authenticode with `signtool`; the installer is rebuilt around the signed files, then signed |
| Linux | `homelab-wizard_<version>_amd64.deb` (Ubuntu 22.04+, Debian 12+), `homelab-wizard-<version>-1.x86_64.rpm` (Fedora), `homelab-wizard-<version>-1-x86_64.pkg.tar.zst` (Arch), `Homelab-Wizard-x86_64.AppImage` (SteamOS, or any system without WebKitGTK), `homelab-wizard-linux-amd64.tar.gz`, `homelab-linux-amd64`, `homelab-linux-arm64` | none; see below |
| All | `SHA256SUMS`, build provenance | `gh attestation verify <file> --repo Snooper42/homelab-wizard` proves a file came from this workflow (the step is skipped if the repository is ever private again; GitHub doesn't store attestations for private personal repositories) |

## Opening an unsigned build

Until the Developer ID secrets are in place, the Mac app is signed ad hoc, which macOS blocks for downloads. After dragging it to Applications, clear the download flag once:

```sh
xattr -dr com.apple.quarantine "/Applications/Homelab Wizard.app"
```

(Or open it, then System Settings › Privacy & Security › Open Anyway.) The app carries its own `homelab` CLI in `Contents/Helpers`, used for Setup's buttons when Go is not installed; with Go, the repository's `./homelab` is used so it always matches the checkout.

## Secrets

Add these in the repository's Settings › Secrets and variables › Actions. Never paste them into a chat, an issue, or a mockup. Missing secrets mean unsigned files, not a failed run.

| Secret | What it is |
|---|---|
| `MACOS_CERT_P12` | Your "Developer ID Application" certificate and key, exported from Keychain Access as .p12, then `base64 -i cert.p12 \| pbcopy` |
| `MACOS_CERT_PASSWORD` | The .p12 export password |
| `MACOS_SIGN_IDENTITY` | The certificate's name, e.g. `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_ID`, `APPLE_TEAM_ID` | The Apple Developer account and its team ID (for notarization) |
| `APPLE_APP_PASSWORD` | An app-specific password from account.apple.com |
| `WINDOWS_CERT_PFX`, `WINDOWS_CERT_PASSWORD` | A code-signing certificate as base64 .pfx, and its password |

macOS signing needs the Apple Developer Program. On Windows, code-signing certificates issued since mid-2023 keep their key on hardware or in a cloud signing service, so most cannot be exported as .pfx. With one of those, replace the "Sign the app" step with the provider's signing tool (for example Microsoft's cloud signing service and its GitHub action). The Microsoft Store is the other route: the Store signs MSIX packages itself, so no certificate is needed, but the MSIX package is not built yet.

Linux packages are not signed; the checksums and build provenance cover them.

## Each platform's build

| | macOS | Windows | Linux packages | AppImage |
|---|---|---|---|---|
| Built on | macOS 14, universal | Windows Server 2022 | Ubuntu 22.04 (its glibc is the oldest supported) | Ubuntu 22.04 |
| Web view | WKWebView (the system's) | WebView2 (the installer fetches it when missing) | WebKitGTK 4.1, a package dependency | WebKitGTK 4.1 inside the file |
| The `homelab` CLI | `Contents/Helpers/homelab` | `homelab.exe` beside the app, with `homelab-run.exe` for windowless jobs | `/usr/bin/homelab` | inside the file |
| The homelab files (`homelab-kit.tar.gz`, for **Set it up for me** and updates without git) | `Contents/Resources/` | beside the app | `/usr/share/homelab-wizard/` | inside the file |
| Menu bar or tray | a helper in the bundle (`Contents/Helpers/homelab-tray`) | the app started with `--tray` | the app started with `--tray` (needs a status-notifier tray: KDE, or GNOME's AppIndicator extension) | the AppImage started with `--tray` |
| Start at login (Settings › This Mac) | a LaunchAgent | the user's Run key | `~/.config/autostart` | `~/.config/autostart`, starting the AppImage file |
| Install | drag to Applications | run the installer, or unzip the portable folder | `sudo apt install ./….deb`, `sudo dnf install ./….rpm`, or `sudo pacman -U ./….pkg.tar.zst` | `chmod +x`, then open it |

The app uses its own CLI for Setup's buttons when Go is not installed; with Go, the folder's `./homelab` is used so it always matches the checkout. When the scheduled jobs are installed from an AppImage (mounted only while it runs) or from a Mac app that was not moved out of the download folder, the CLI is copied to `bin/homelab` in the homelab folder first, so the jobs keep working when the app is closed.

The Linux packages and the AppImage carry AppStream metadata (`app/packaging/io.github.snooper42.HomelabWizard.metainfo.xml`), so Discover, GNOME Software, and AppImage managers show the app's name and summary. The AppImage holds WebKitGTK and its helper processes; `app/packaging/appimage.sh` builds it, pointing the library at the bundled helpers. Each release run starts it with the system's WebKitGTK moved away (`app/packaging/appimage-smoke.sh`) and fails unless the app comes up on its own copy; the run keeps a screenshot as the `linux-appimage-screenshot` artifact.
