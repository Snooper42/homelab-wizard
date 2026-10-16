---
version: 0.1.0-alpha
---

# Jellyfin

Movies and TV for the household, streamed to TVs, phones, and browsers. It runs as the native macOS app, not a container, so it can use Apple Silicon's hardware video encoder.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Runs as | Native macOS app, not a container |
| Install | `brew install --cask jellyfin` |
| Category | Media |
| Starts with `./homelab up` | No: native macOS app (`brew install --cask jellyfin`) |
| Address | https://jellyfin.example.com (LAN, through Nginx Proxy Manager) |
| On this Mac | http://localhost:8096 |
<!-- END homelab:generated -->

## Purpose

- The family's video library from `/Volumes/Media/movies` and `/Volumes/Media/tv`.
- Hardware transcoding (VideoToolbox), which containers on macOS cannot do.

## Setup

1. `brew install --cask jellyfin`, open it, and add it to Login Items.
2. Finish the wizard at http://localhost:8096; create the admin, then a user per person.
3. Libraries: Movies → `/Volumes/Media/movies`, Shows → `/Volumes/Media/tv`.
4. Dashboard > Playback > Transcoding: hardware acceleration **Apple VideoToolbox**.
5. In Home mode it is at `https://<TAILSCALE_HOST>:8096` on the tailnet with nothing more to do. With a domain, `./homelab domain setup` creates https://jellyfin.example.com (the proxy reaches it at `host.docker.internal:8096`).
6. Set `JELLYFIN_DATA_DIR` in `.env` to the data folder shown under Dashboard > Paths, so Duplicati backs it up.

## How it works

- A .NET (C#) server with its own web app, installed by Homebrew as `Jellyfin.app` and started at login. It runs outside Docker, so the homelab CLI does not start, stop, or update it, and `./homelab logs` and `./homelab compose` do not apply.
- When a device cannot play a file as it is, Jellyfin's bundled ffmpeg converts it on the fly using Apple VideoToolbox. Direct play costs almost nothing.
- Users, libraries, and watch history are in SQLite (`data/jellyfin.db` in its data folder); posters and other artwork go in `metadata/`.
- Film and show details come from online providers such as TMDb; more providers come as plugins.
- Scheduled tasks (Dashboard › Scheduled Tasks) scan the libraries, extract chapter and trickplay images, and clean the transcode cache.
- Containers reach it at `host.docker.internal:8096`: Nginx Proxy Manager, Seerr, Uptime Kuma, and Tailscale. The address and port come from the `x-homelab-native` block in `compose.yaml`.
- Updates come from Homebrew, not Watchtower.

## Where things live

These paths are inside the data folder (`JELLYFIN_DATA_DIR` in `.env`, default `~/.local/share/jellyfin`); Dashboard › Paths shows the real ones.

| What | Where |
|---|---|
| Movies | `/Volumes/Media/movies` |
| Shows | `/Volumes/Media/tv` |
| Data folder | `JELLYFIN_DATA_DIR` (listed in Dashboard › Paths) |
| Database | `data/jellyfin.db` |
| Artwork and metadata | `metadata/` |
| Plugins | `plugins/` |
| Logs | `log/`, one `log_<yyyymmdd>.log` per day (also Dashboard › Logs) |
| Server settings | `config/` (`system.xml`, `network.xml`, `encoding.xml`) |
| Cache and transcodes | `cache/` (Cache and Transcodes in Dashboard › Paths) |
| The app | `/Applications/Jellyfin.app` |

## Everyday use

- Watch in the browser at https://jellyfin.example.com, or in an app: Jellyfin for iOS and Swiftfin (iPhone, iPad, Apple TV), Jellyfin for Android and Android TV, Jellyfin Media Player (Mac and PC), or Infuse (Apple TV).
- Quick Connect: sign in on a TV by typing its code on your phone, from your user menu › Quick Connect (turn it on in the Dashboard's general settings).
- Dashboard › Users: library access, parental ratings, and whether a person may transcode.
- Dashboard › Libraries: scan a library or change its options; Dashboard › Activity shows who is watching and whether a stream is transcoding.
- In the web player: Space pauses, F toggles full screen, M mutes, and the arrow keys seek and change the volume.
- SyncPlay (the group icon at the top of the page) keeps playback in step for people watching together in different places.

## Connects to

- [Radarr](<../media automation/Radarr.md>) and [Sonarr](<../media automation/Sonarr.md>) put films and episodes in `movies` and `tv`; [Bazarr](<../media automation/Bazarr.md>) adds subtitles beside them.
- [Seerr](<../media automation/Seerr.md>) signs in with a Jellyfin admin at `host.docker.internal:8096` and imports the household's users.
- [Nginx Proxy Manager](<../network/Nginx Proxy Manager.md>) serves https://jellyfin.example.com on the home network; [Tailscale](<../network/Tailscale.md>) reaches it from elsewhere.
- [Uptime Kuma](<../security/Uptime Kuma.md>) watches `http://host.docker.internal:8096/health`.
- [Duplicati](<../system/Duplicati.md>) reads `JELLYFIN_DATA_DIR` as `/source/jellyfin` (Homelab Jellyfin job).
- It gives out API keys (Dashboard › API Keys) for apps such as Sonarr and Radarr.
- `.env`: only `JELLYFIN_DATA_DIR`; port 8096 is fixed in `compose.yaml`.

## Tinkering ideas

- Refresh Jellyfin when a download lands: in Sonarr and Radarr, Settings › Connect › Emby / Jellyfin, host `host.docker.internal`, port `8096`, with a Jellyfin API key.
- Trickplay previews on the seek bar: turn on trickplay image extraction in a library's settings; the work runs as a scheduled task.
- Dashboard › Playback › Transcoding: try tone mapping for HDR films on SDR screens, and allow HEVC encoding.
- Dashboard › Plugins: Playback Reporting for viewing statistics, OpenSubtitles for subtitles; more plugins come from third-party repositories, such as Intro Skipper.
- Single sign-on with Pocket ID through the third-party SSO plugin (home network only, like Pocket ID).
- Add a Home Videos and Photos library for family clips from the media drive.

## Useful commands

Jellyfin is a Mac app, so these run on this Mac directly, without `./homelab logs` or `compose exec`. They use the default data folder; change `~/.local/share/jellyfin` if `JELLYFIN_DATA_DIR` differs. The last command checks that the proxy container can reach it.

```zsh
./homelab status
open -a Jellyfin
osascript -e 'quit app "Jellyfin"'
lsof -nP -iTCP:8096 -sTCP:LISTEN
curl -s http://localhost:8096/health
curl -s http://localhost:8096/System/Info/Public
ls ~/.local/share/jellyfin/log
tail -f ~/.local/share/jellyfin/log/log_$(date +%Y%m%d).log
brew upgrade --cask jellyfin
./homelab compose nginx-proxy-manager exec nginx-proxy-manager curl -s http://host.docker.internal:8096/health
```

## API

- Key: Dashboard › API Keys › add one, named after the app or script that uses it.
- Base URL: `http://localhost:8096`; send the key as `Authorization: MediaBrowser Token="<key>"`.
- Example: `curl -s -H 'Authorization: MediaBrowser Token="KEY"' http://localhost:8096/Library/VirtualFolders` lists the libraries; `curl -X POST` with the same header to `http://localhost:8096/Library/Refresh` scans them all.
- Docs: https://api.jellyfin.org

## Learn more

- Documentation: https://jellyfin.org/docs/
- Source: https://github.com/jellyfin/jellyfin
- Homebrew cask: https://formulae.brew.sh/cask/jellyfin

## Backup

The data folder (`JELLYFIN_DATA_DIR`: users, watch history, metadata) is in the Homelab Jellyfin job. Quit Jellyfin before restoring it. The media itself is not backed up.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Proxy gives 502 | Jellyfin is not running on the Mac. Open it |
| Library empty after a restart | The drive mounted after Jellyfin started. Scan the libraries again |
| Playback stutters | Check that VideoToolbox is selected; Dashboard > Activity shows whether a stream is transcoding |
