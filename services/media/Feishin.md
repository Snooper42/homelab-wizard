---
version: 0.14.0
---

# Feishin

A modern web player for Navidrome. It runs entirely in the browser and talks to Navidrome directly.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `feishin` in `compose/media.yaml` (project `homelab_media`) |
| Image | `ghcr.io/jeffvli/feishin:latest` |
| Category | Media |
| Starts with `./homelab up` | Yes (`./homelab up`) |
| Address | https://music.example.com (LAN and public, through the Cloudflare Tunnel) |
| On this machine | http://localhost:9180 (`FEISHIN_PORT`) |
| Depends on | `navidrome` |
| Updates | Nightly at 4 AM, with a copy of its data first |
<!-- END homelab:generated -->

## Purpose

A desktop-class music player in any browser, at `https://<TAILSCALE_HOST>:9180` in Home mode, or `https://music.example.com` with a domain.

## Setup

Open it and sign in with your Navidrome account. The server is preset to `https://navidrome.<domain>`.

## How it works

- Feishin is a React music player. This container only serves its web build on port 9180; it keeps no data on the server.
- Your browser talks to Navidrome directly at `https://navidrome.example.com` (`SERVER_URL`), so Navidrome has to be reachable from wherever you play.
- Settings, the play queue, and the sign-in are stored in the browser's local storage, separately in each browser.
- `SERVER_LOCK: "false"` lets you add other servers in the app; Feishin also works with Jellyfin and other OpenSubsonic servers.

## Everyday use

- Sign in once per browser, then browse by album, artist, genre, or playlist, and add songs or whole albums to the queue.
- Settings holds playback, theme, and hotkey options; the hotkeys are listed and can be changed there.
- The desktop app for macOS, Windows, and Linux (from the GitHub releases page) adds media keys and the MPV audio engine.

## Connects to

- [Navidrome](<Navidrome.md>) holds the library, the accounts, playlists, and play counts; Feishin is only the front end.
- `.env`: `FEISHIN_PORT` (default 9180) is its port on this Mac; `HOMELAB_DOMAIN` builds the preset server address.

## Tinkering ideas

- Install the desktop app and point it at `https://navidrome.example.com`; for gapless playback, switch its audio player to MPV in Settings (install MPV with `brew install mpv`).
- Build a smart playlist in Feishin's playlist editor; it is saved in Navidrome and works in every app.
- Add `.lrc` lyric files beside your tracks in the music folder; Feishin shows them in the full-screen player.
- Try the full-screen "now playing" view on a spare tablet as a living-room display.

## Useful commands

```zsh
./homelab logs feishin -f
./homelab compose feishin restart feishin
curl -sI http://localhost:9180
curl -s https://navidrome.example.com/ping
```

## Learn more

- Source, releases, and image: https://github.com/jeffvli/feishin

## Backup

Nothing: settings live in the browser.

## Troubleshooting

If sign-in fails, open https://navidrome.example.com directly to check Navidrome is up and the password is right.
