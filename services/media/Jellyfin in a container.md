---
version: 0.16.0
---

# Jellyfin in a container

Movies and TV for the household, the same [Jellyfin](<Jellyfin.md>) in a container. It is the Jellyfin for SteamOS: SteamOS's system is read-only and takes no packages, so the native app has no install there, and on SteamOS `homelab install jellyfin` and the **Movies and TV** pick install this one. On a Mac, Windows, or another Linux it is an alternative to the native app, which can use the graphics for transcoding.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `jellyfin-container` in `compose/media.yaml` (project `homelab_media`) |
| Image | `jellyfin/jellyfin:latest` |
| Category | Media |
| Starts with `./homelab up` | No: optional, `./homelab install jellyfin-container` |
| Address | https://jellyfin.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:8096 (`JELLYFIN_PORT`) |
| Data | `~/.local/share/jellyfin` → `/config`<br>`~/.local/share/jellyfin/cache` → `/cache`<br>`/Volumes/Media/movies, read-only` → `/media/movies`<br>`/Volumes/Media/tv, read-only` → `/media/tv` |
| Updates | Nightly at 4 AM, with a copy of its data first |
<!-- END homelab:generated -->

## Purpose

- The family's video library from the media drive's `movies` and `tv` folders.
- On SteamOS, Jellyfin without installing anything on the system.

## Setup

1. `./homelab install jellyfin` on SteamOS (`./homelab install jellyfin-container` elsewhere), or the **Movies and TV** pick.
2. Finish the wizard at http://localhost:8096; create the admin, then a user per person.
3. Libraries: Movies → `/media/movies`, Shows → `/media/tv` (the media drive's folders, read-only inside the container).
4. In Home mode it is at `https://<TAILSCALE_HOST>:8096` on the tailnet with nothing more to do. With a domain, `./homelab domain setup` creates https://jellyfin.example.com.

## How it works

- The official image, run as you (`PUID`/`PGID`; with Docker run as you on SteamOS, root inside the container is you outside it).
- Its library (users, watch history, metadata, plugins, settings, logs) is in `JELLYFIN_DATA_DIR`, the same folder and the same layout as the native app's, so a library moves between the two by keeping that folder. The cache is `cache/` inside it.
- Transcoding is on the processor. Direct play costs almost nothing.
- Updates come with the nightly updates, like the other containers.

## Graphics for transcoding (by hand)

The Steam Machine's and the Steam Deck's AMD graphics can transcode through VA-API. The container does not get them by default, because a machine without `/dev/dri` would not start it. To add them, add `devices: ["/dev/dri:/dev/dri"]` to `jellyfin-container` in `compose/media.yaml`, then `./homelab install jellyfin-container` again, and in Dashboard › Playback › Transcoding choose **Video Acceleration API (VA-API)** with `/dev/dri/renderD128`. If the device is refused, your account must be able to open `/dev/dri/renderD128` (`ls -l /dev/dri`).

## Connects to

- [Radarr](<../media automation/Radarr.md>) and [Sonarr](<../media automation/Sonarr.md>) put films and episodes in `movies` and `tv`.
- [Seerr](<../media automation/Seerr.md>) signs in with a Jellyfin admin at `jellyfin-container:8096`.
- [Nginx Proxy Manager](<../network/Nginx Proxy Manager.md>) serves https://jellyfin.example.com on the home network; [Tailscale](<../network/Tailscale.md>) reaches it from elsewhere.
- [Duplicati](<../system/Duplicati.md>) reads `JELLYFIN_DATA_DIR` as `/source/jellyfin` (Homelab Jellyfin job).

## Useful commands

```sh
./homelab status
./homelab logs jellyfin-container
curl -s http://localhost:8096/health
./homelab compose jellyfin-container restart jellyfin-container
```

## Backup

The data folder (`JELLYFIN_DATA_DIR`) is in the Homelab Jellyfin job, each week; the cache, transcodes, and logs are left out. Stop the container before restoring it. The media itself is not backed up.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Library empty | The media drive mounted after the container started. `./homelab compose jellyfin-container restart jellyfin-container`, then scan the libraries |
| "cannot run alongside jellyfin" | The native Jellyfin is installed and running; keep one of the two |
| Playback stutters | A stream is transcoding on the processor (Dashboard › Activity); add the graphics as above, or play on a device that plays the file as it is |
