---
version: 0.17.0
---

# SABnzbd

Usenet downloader, preferred over torrents. It has no network except the ProtonVPN tunnel.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `sabnzbd` in `compose/media-automation.yaml` (project `homelab_media_automation`) |
| Image | `lscr.io/linuxserver/sabnzbd:latest` |
| Category | Media Automation |
| Starts with `./homelab up` | No: optional, `./homelab install sabnzbd` |
| Address | https://sabnzbd.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:8091 (`SABNZBD_PORT`) |
| Depends on | `gluetun` |
| Data | `data/appdata/sabnzbd` → `/config`<br>`/Volumes/Media/downloads` → `/downloads` |
| Updates | Nightly at 4 AM, with a copy of its data first |
<!-- END homelab:generated -->

## Purpose

Downloads from Usenet for Sonarr, Radarr and Lidarr. A Usenet server keeps a release whole for years whether or not anyone else shares it, so a request doesn't sit at 0% waiting for people to share a torrent (the usual reason requests used to stall). Usenet goes first: **Connect apps** sets Sonarr's and Radarr's default delay profile (Settings › Profiles) to prefer Usenet and to wait an hour (`TORRENT_DELAY_MINUTES`, 60) before taking a torrent, so a torrent (qBittorrent) is used only when no Usenet release turns up within the hour. Lidarr keeps its own delay profile, which prefers a Usenet release over a torrent of the same quality. A delay profile of your own, with tags, is left alone; `TORRENT_DELAY_MINUTES=0` leaves the default one to you too.

It runs inside [Gluetun](<Gluetun.md>)'s network, like qBittorrent: the Usenet server sees ProtonVPN's address, not yours, and nothing leaves if the VPN is down.

## Setup

You need two things, both paid and both your choice (the homelab names none): a **Usenet service** (the server you download from) and at least one **Usenet search site** (an indexer, which you add in Prowlarr like any other search site).

1. Set `PROTONVPN_WIREGUARD_PRIVATE_KEY` ([Gluetun](<Gluetun.md>)), then `./homelab install sabnzbd` (it also comes with the Media automation bundle, `./homelab install @arr`).
2. In **Settings**, fill in your Usenet service's details, from its welcome email or account page: *Usenet server* (`USENET_HOST`), *Usenet user name* (`USENET_USER`), *Usenet password* (`USENET_PASSWORD`). Leave *port* (`USENET_PORT`, 563) and *connections* (`USENET_CONNECTIONS`, 8) empty unless your plan says otherwise. SSL is always on.
3. **Connect apps** (`./homelab wire --apply`) then:
   - gives SABnzbd the homelab's login (`ARR_USER`, `ARR_PASSWORD`, the same as Prowlarr's and Sonarr's), so its page asks for it;
   - keeps unfinished downloads in `/downloads/incomplete/usenet` and finished ones in `/downloads/tv`, `/downloads/movies` and `/downloads/music`, the same folders qBittorrent uses, with a category for each app;
   - adds your Usenet server;
   - makes SABnzbd the Usenet download client of Sonarr, Radarr and Lidarr, at `gluetun:8080` with its API key.
   - has Sonarr and Radarr wait an hour for Usenet before taking a torrent.
   Running it again changes nothing, and puts back a setting changed by hand.
4. Add your Usenet search site in Prowlarr (Indexers › Add Indexer). Prowlarr sends it to the apps.

SABnzbd's first-run wizard doesn't show once Connect apps has added the server.

## How it works

- SABnzbd is a Python program. It fetches the parts of a release (an `.nzb` file lists them) over several connections at once, checks and repairs them with their par2 files, unpacks them, and moves the result into the category's folder.
- It runs inside Gluetun's network (`network_mode: service:gluetun`), so it has no address of its own. Its page is published on Gluetun's ports (`SABNZBD_PORT`, 8091), and the apps reach it at `gluetun:8080`.
- The apps send it an `.nzb` with their category through its API (with its API key, in `sabnzbd.ini`), watch its queue, and import from `/downloads/<category>` once it's done, as with qBittorrent.
- Once it has a login, SABnzbd answers any address its page is opened at; without one (`ARR_PASSWORD` cleared by hand) it answers only `localhost`, addresses, `.local` names and its `host_whitelist`, to which Connect apps adds `gluetun`.
- Tidy Up's rest stops it with qBittorrent and Gluetun when nothing is pending (a Usenet download is in an app's queue, so it keeps them up), and the battery saver pauses it.

## Where things live

| What | Where |
|---|---|
| Settings and API key | `data/appdata/sabnzbd/sabnzbd.ini` (`/config/sabnzbd.ini`) |
| Logs | `data/appdata/sabnzbd/logs/` |
| Unfinished downloads | `DOWNLOADS_ROOT/incomplete/usenet` |
| Finished downloads | `DOWNLOADS_ROOT/tv`, `/movies`, `/music` |

## Backup

`data/appdata/sabnzbd` is backed up with the other apps' settings. Unfinished downloads aren't: a job lost is fetched again.

## Troubleshooting

- **Connect apps says *SABnzbd downloads from your Usenet server* needs you:** the Usenet server isn't in Settings yet (step 2).
- **Downloads fail with an authentication error:** check *Usenet user name* and *Usenet password* in Settings, then Connect apps again.
- **"Too many connections":** your plan allows fewer at once than `USENET_CONNECTIONS` (8): lower it, then Connect apps again.
- **Nothing downloads while the VPN is down:** that's on purpose, as for qBittorrent.
