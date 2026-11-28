---
version: 0.17.0
---

# Release process

How a version of Homelab Wizard gets cut and published. The owner adopted it on Nov 28, 2026.

> [!IMPORTANT]
> **Not in effect yet.** Until `.github/workflows/release.yml` is changed, every merge to main that touches the app still builds and publishes a numbered release, as [Releasing](<Releasing.md#version-numbers>) describes. That change waits for the reliability reset to finish (`.claude/prompts/hygiene-progress.md`, *Deferred until Account 1 finishes*). This page is the process it switches to.

## The rules

1. **Merging a pull request never publishes a release and never changes a version.** Main moves on its own; the household's apps don't update with every merge.
2. **A version is cut on purpose**, by hand, from **Actions › Release › Run workflow**, choosing what kind it is:

   | Kind | From v0.48.3 it makes | For |
   |---|---|---|
   | `patch` | v0.48.4 | Fixes only |
   | `minor` | v0.49.0 | New things, a batch of fixes, a change people will notice |
   | `beta` | v0.49.0-beta.1, then .2, … | Trying a minor version on one machine before everyone gets it |

3. **Its notes are written for the household**, under **New**, **Improved** and **Fixed** in plain words: the version's own section of [CHANGELOG](<../CHANGELOG.md>), moved there from *Unreleased* when the version is cut. A line about CI, the docs, tests or wording doesn't go in.
4. **One optional rolling pre-release, `beta-nightly`,** may be rebuilt in place from main for testing. It's a pre-release, never the repository's *Latest*, so no household's app installs it unless someone picks it on purpose.

## Cutting a version

1. On a branch, move the lines under `[Unreleased]` in `CHANGELOG.md` into a new `## [0.49.0] - <today>` section with a bold one-line summary. Leave the two marker comments at the top of each `[Unreleased]` part. Merge it. That publishes nothing.
2. **Actions › Release › Run workflow**, choose the kind, and run it. The workflow works out the number from the newest tag, builds every system, and publishes the release with that section as its notes.
3. Check the release page, then that an installed app offers the update.

## Where the version lives

One number, written everywhere by the release build, so nothing is bumped by hand:

| Where | How it gets the number |
|---|---|
| The release's tag (`v0.49.0`) | The workflow makes it |
| The desktop app (Settings › This Mac) and its installer | `-X main.version=…` at build time, and `app/wails.json`'s `productVersion`, set by the workflow before the build |
| The `homelab` CLI (`homelab version`) | `-X main.version=…` at build time |
| The iPhone and iPad app (Settings › About) | The newest release tag in the checkout (`apple-client/scripts/app-version.sh`) |
| `VERSION` | The floor the numbers count up from, and the docs' `version:` front matter (`./homelab validate` checks they match). Raised by hand only for a new minor or major line |

## How the app picks up a version

The desktop app's updater installs the repository's **Latest** release when it was built from a different commit than the installed app (`internal/selfupdate`, `Release.Newer`). It doesn't compare version numbers. So a published version reaches every household's app however it's numbered, and a merge that publishes nothing changes nothing for them.

Three other things do read the numbers, which is why versions only ever go up:
- the iPhone and iPad app's version (the newest tag);
- the next number the workflow picks (`internal/tools/nextversion`, one more than the newest tag);
- the upgrade tests, which keep a homelab folder for some releases (`testdata/upgrades/<tag>`).

## The releases from before this process

Since 0.17.0, every merge to main published a release: about 300 of them, from v0.17.1 to v0.47.x. They're kept for history: their notes are the CHANGELOG's sections, one per minor version. `scripts/reset-releases.sh` takes the builds between minor versions off the releases page (`--dry-run` lists them first; it keeps every tag unless told otherwise). The next version continues upward from the newest tag, so nothing that reads the numbers goes backwards.
