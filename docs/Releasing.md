---
version: 0.9.0-beta
---

# Releasing

`.github/workflows/release.yml` builds the desktop app and the CLI for macOS, Windows, and Linux, signs what it has certificates for, and drafts a GitHub release for each `v*` tag. Every change to main that touches the app or the engine also publishes the Mac build as the latest build (Releases › Latest).

## Cut a release

1. Update `VERSION` and move the `[Unreleased]` notes in `CHANGELOG.md` under the new version.
2. Tag and push: `git tag v0.2.0 && git push origin v0.2.0`. Tags with a hyphen (`v0.2.0-beta`) become pre-releases.
3. When the workflow finishes, check its summary for "unsigned" notes, then publish the draft release on GitHub.

To get the files without a release (for testing the pipeline), run the workflow by hand: Actions > Release > Run workflow. It builds the Mac app unless you pick **all** (or Windows or Linux) under *Which builds to make*, and the files stay attached to the run for 3 days; a tagged build keeps them 14 days, and the release keeps its own copies.

If a run fails with *Artifact storage quota has been hit*, older runs' files fill the account's storage: run Actions > **Clean up artifacts** (it keeps the newest run's files and deletes the rest), wait for GitHub to recount (up to 12 hours), and run the release again.

## The latest build

Every push to main that changes `app/`, `web/`, `cmd/`, `internal/`, `go.mod`, `go.sum`, `VERSION`, or the workflow runs the `macos` job, then the `nightly` job replaces the release shown as Latest ("Homelab Wizard (latest build)", tag `nightly`, moved to that commit) with the Mac build. Nothing else is published from main: Windows and Linux build only for tags and by-hand runs. A newer push cancels a nightly build still running.

Each build carries where it came from: `-ldflags` set `main.version`, `main.commit`, and `main.repo` for the app, and `Commit` and `Repo` in `app/tray` for the menu bar item (the CLI gets `main.version`). The app's **Update** button (`internal/selfupdate`) reads the newest build for the update channel (the latest build, release tag `nightly`, on `testing`, the newest published `v*` release on `stable`), compares its commit with the running build's, and on a Mac downloads the DMG, checks it against the SHA-256 digest GitHub records for the asset (and stops if they differ), swaps itself for the new build, and reopens. The menu bar item checks once an hour and says *Update ready*.

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

Add these in the repository's Settings > Secrets and variables > Actions. Never paste them into a chat, an issue, or a mockup. Missing secrets mean unsigned files, not a failed run.

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
| Start at login (Setup) | a LaunchAgent | the user's Run key | `~/.config/autostart` | `~/.config/autostart`, starting the AppImage file |
| Install | drag to Applications | run the installer, or unzip the portable folder | `sudo apt install ./….deb`, `sudo dnf install ./….rpm`, or `sudo pacman -U ./….pkg.tar.zst` | `chmod +x`, then open it |

The app uses its own CLI for Setup's buttons when Go is not installed; with Go, the folder's `./homelab` is used so it always matches the checkout. When the scheduled jobs are installed from an AppImage (mounted only while it runs) or from a Mac app that was not moved out of the download folder, the CLI is copied to `bin/homelab` in the homelab folder first, so the jobs keep working when the app is closed.

The Linux packages and the AppImage carry AppStream metadata (`app/packaging/io.github.snooper42.HomelabWizard.metainfo.xml`), so Discover, GNOME Software, and AppImage managers show the app's name and summary. The AppImage holds WebKitGTK and its helper processes; `app/packaging/appimage.sh` builds it, pointing the library at the bundled helpers. Each release run starts it with the system's WebKitGTK moved away (`app/packaging/appimage-smoke.sh`) and fails unless the app comes up on its own copy; the run keeps a screenshot as the `linux-appimage-screenshot` artifact.
