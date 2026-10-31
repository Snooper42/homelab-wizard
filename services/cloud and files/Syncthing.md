---
version: 0.16.0
---

# Syncthing

Keeps folders in sync between your devices, with no cloud in between.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `syncthing` in `compose/cloud.yaml` (project `homelab_cloud`) |
| Image | `lscr.io/linuxserver/syncthing:latest` |
| Category | Cloud & Files |
| Starts with `./homelab up` | No: optional, `./homelab install syncthing` |
| Address | https://sync.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:8384 (`SYNCTHING_PORT`) |
| Data | `data/appdata/syncthing` → `/config`<br>`data/sync` → `/data` |
| Updates | Nightly at 4 AM, with a copy of its data first |
<!-- END homelab:generated -->

## Purpose

Keeps folders in sync between your devices directly over the home network, with no cloud in between. Complements File Browser (sharing from the media drive) and Immich (photos).

## Setup

1. `./homelab install syncthing`. Shared folders live under `SYNC_ROOT` (`data/sync` by default).
2. Open the web UI, set a GUI user and password under Actions › Settings › GUI.
3. Install Syncthing (or Möbius Sync on iPhone) on each device, add this Mac by its device ID, and share folders.
4. On each device, edit this Mac's entry: Advanced › Addresses `tcp://192.168.1.10:22000, dynamic`. In a container Syncthing cannot announce the Mac's own address, so without this devices go through slow relays.

## How it works

- A Go program. Each device has an ID derived from its TLS certificate; devices only talk to IDs you have accepted, and all traffic is encrypted.
- Devices sync on port 22000 (TCP, and QUIC over UDP) and find each other on the LAN with broadcasts on 21027/UDP. When no direct path works they fall back to global discovery and public relays run by the Syncthing project.
- Each folder has a folder ID; devices sharing that ID keep it in step block by block, both ways unless the folder is send-only or receive-only.
- The container's host name is `homelab`, the name other devices see by default.
- The web UI and its REST API listen on 8384.

## Where things live

| What | Where |
|---|---|
| Settings: devices, folders, GUI user, API key | `data/appdata/syncthing/config.xml` (`/config`) |
| This device's identity | `data/appdata/syncthing/cert.pem` and `key.pem` |
| Index database | `data/appdata/syncthing/` |
| Shared folders | `SYNC_ROOT` (`data/sync`) → `/data/<folder>` |
| Old versions, when versioning is on | `.stversions` inside each folder |
| Ignore patterns | `.stignore` inside each folder |

## Everyday use

- **Add Folder**: a path under `/data/...`, then the Sharing tab to pick devices.
- **Add Remote Device**: paste the other device's ID. Actions › Show ID shows this Mac's ID as text and a QR code.
- Devices or folders offered by others appear as a banner at the top to accept.
- Pause a folder or device from its panel; Actions › Recent Changes shows what moved.
- Apps: Syncthing for macOS, Windows, and Linux; Syncthing-Fork on Android (the original Android app is no longer maintained); Möbius Sync on iPhone.

## Connects to

- Complements [File Browser](<../cloud and files/File Browser.md>) (the media drive), [Immich](<../cloud and files/Immich.md>) (photos), and [PairDrop](<../cloud and files/PairDrop.md>) (one-off transfers).
- `SYNC_ROOT` is not mounted in [Duplicati](<../system/Duplicati.md>): add a read-only volume to Duplicati's service and a job to back it up.
- Only the web UI goes through [Nginx Proxy Manager](<../network/Nginx Proxy Manager.md>) (`sync.example.com`); sync traffic uses ports 22000 and 21027 on the Mac directly (`LAN_BIND_IP`).
- `.env`: `SYNCTHING_PORT`, `SYNC_ROOT`, `LAN_BIND_IP`, and `PUID`/`PGID` (who owns the synced files).

## Tinkering ideas

- Turn on versioning (folder › Edit › File Versioning, Staggered) so a file deleted on a phone can still be recovered here.
- Make a receive-only folder for a phone's camera or scans, so the copy on the Mac cannot be changed by mistake.
- Add `.DS_Store` and other junk to a folder's Ignore Patterns.
- Keep it on the LAN: Actions › Settings › Connections, untick Global Discovery and Enable Relaying (devices then need this Mac's address, step 4 of Setup).
- Share a folder with an untrusted device (a friend's computer) encrypted, for an off-site copy it cannot read.
- Sync a notes folder, such as an Obsidian vault, between the Mac and a phone.

## Useful commands

The health check, this device's status (including its ID), its connections, the logs, and a restart. Put the API key from Actions › Settings › General in `SYNCTHING_API_KEY` first:

```zsh
curl -s http://localhost:8384/rest/noauth/health
curl -s -H "X-API-Key: $SYNCTHING_API_KEY" http://localhost:8384/rest/system/status
curl -s -H "X-API-Key: $SYNCTHING_API_KEY" http://localhost:8384/rest/system/connections
./homelab logs syncthing -f
./homelab compose syncthing restart syncthing
```

## API

- Key: Actions › Settings › General › API Key; send it as the `X-API-Key` header.
- Base URL on this Mac: `http://localhost:8384/rest`.
- Example, rescan a folder now (its folder ID is in the folder's Edit dialog):

```zsh
curl -s -X POST -H "X-API-Key: $SYNCTHING_API_KEY" "http://localhost:8384/rest/db/scan?folder=abcd-1234"
```

- Reference: https://docs.syncthing.net/dev/rest.html

## Learn more

- Docs: https://docs.syncthing.net/
- Source: https://github.com/syncthing/syncthing
- Image: https://docs.linuxserver.io/images/docker-syncthing/

## Backup

The configuration in `data/appdata/syncthing` is covered by the AppData job. The synced folders in `SYNC_ROOT` are not: add them to a Duplicati job if this Mac is their only extra copy.

## Troubleshooting

- **Devices do not connect:** ports 22000 (TCP and UDP) and 21027 (UDP) must be free on the Mac; a VPN on the Mac can block the LAN.
- **Slow syncing ("relay" in the device list):** the device does not have this Mac's address; see step 4.
