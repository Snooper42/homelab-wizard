---
version: 0.14.0
---

# Tdarr

Shrinks the media library by converting films and shows to a smaller format

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `tdarr` in `compose/media-automation.yaml` (project `homelab_media_automation`) |
| Image | `docker.io/haveagitgat/tdarr:latest` |
| Category | Media Automation |
| Starts with `./homelab up` | No: optional, `./homelab install tdarr` |
| Address | https://tdarr.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:8265 (`TDARR_PORT`) |
| Data | `data/appdata/tdarr/server` → `/app/server`<br>`data/appdata/tdarr/configs` → `/app/configs`<br>`data/appdata/tdarr/logs` → `/app/logs`<br>`/Volumes/Media/tv` → `/media/tv`<br>`/Volumes/Media/movies` → `/media/movies`<br>`/Volumes/Media/tdarr-cache` → `/temp` |
| Database dump | Daily by `./homelab backup` into `recovery-staging/databases/tdarr` |
| Updates | Nightly at 4 AM, with a copy of its data first |
<!-- END homelab:generated -->

## Purpose

Goes through the film and TV folders and converts each file to a smaller format (usually H.265, also called HEVC), so the same library takes much less of the media drive, often half. It can also tidy files on the way: drop subtitle and audio tracks in languages nobody watches, or move every file to the same container. [Jellyfin](<../media/Jellyfin.md>) plays the converted files as before.

It is heavy and optional: converting means decoding and encoding every frame, so it keeps the processor busy for hours at a time. Install it when the drive is filling up, not by default.

## Setup

1. `./homelab install tdarr` (a 1.6 GB download).
2. Open it and create your account: the first account made is the only one, and sign-up closes after it.
3. **Libraries › Library +**: name it, set **Source** to `/media/movies` (or `/media/tv`) and **Transcode Cache** to `/temp`. Under **Transcode options**, keep the classic plugins it suggests, or pick a Flow.
4. **Nodes** (on its home page): the node `homelab` is this machine. Give it workers: **Transcode CPU** 1 to start with, and **Health check CPU** 1. It does nothing until it has workers.
5. Keep it to the night (below), then **Scan (Find new)** on the library.

Try it on a copy of a few files first, in a folder of their own: a converted file replaces the original once it passes the size check.

## How much it takes, and keeping it to the night

- **Processor:** converting on the processor uses every core it is given, for roughly as long as the film runs, and longer on an older machine. A library of a few hundred films is weeks of nights. Each **Transcode CPU** worker is one file at a time; one worker is enough on a machine that also runs the other apps.
- **Memory:** about 100 MB idle, and a gigabyte or more while a file converts.
- **Disk:** a converted file is written in full to the cache (`tdarr-cache` on the media drive) before it replaces the original, so leave free space the size of the largest film.
- **At night only:** in the library's **Schedule** tab, untick the daytime hours (for example 07:00 to 23:00 every day); outside the ticked hours it starts nothing new. The homelab also pauses it while a laptop is on battery.
- **On each system:** on the Mac, containers cannot use Apple's video encoder, so it converts on the processor. On Linux and SteamOS, an Intel or AMD graphics chip can do the work (see Tinkering ideas). On Windows, only an NVIDIA graphics card can, through WSL 2.

## How it works

- One container holds the Tdarr server (the web page, the library database, the schedule) and a node of its own named `homelab` that does the work with FFmpeg and HandBrake.
- The server scans the libraries, decides with the plugins or a Flow what each file needs, and hands files to the node's workers. Results replace the originals in place.
- Libraries, settings, and the file history are in a SQLite database under `data/appdata/tdarr/server`.
- Other computers can join as extra nodes (Tinkering ideas); the server's node port (8266) stays inside the container unless you publish it.

## Where things live

| What | Where |
|---|---|
| Libraries, settings, history, account | `data/appdata/tdarr/server` (SQLite in `Tdarr/DB2/SQL`) |
| Node settings | `data/appdata/tdarr/configs` |
| Logs | `data/appdata/tdarr/logs` |
| Films and shows it converts | `<MEDIA_ROOT>/movies`, `<MEDIA_ROOT>/tv` (as `/media/movies`, `/media/tv`) |
| Files being converted | `<MEDIA_ROOT>/tdarr-cache` (as `/temp`) |

## Everyday use

- **Progress:** the home page shows each worker's file and percentage, and **Stats** the space saved so far.
- **A file that failed:** **Libraries › Transcode: Error/Cancelled** lists them with the reason; **Requeue** tries again.
- **Pause:** the node's worker counts at 0, or stop it: `./homelab compose media-automation stop tdarr`.

## Connects to

- [Sonarr](<Sonarr.md>) and [Radarr](<Radarr.md>) put the files in the folders it converts; it is best to let them finish importing before Tdarr picks a file up (a library's **Folder Watch**, or the nightly schedule).
- [Jellyfin](<../media/Jellyfin.md>) plays the converted files; Jellyfin finds the changes on its next library scan.
- `.env`: `TDARR_PORT` (default `8265`).

## Tinkering ideas

- **Graphics chip on Linux and SteamOS:** add `devices: ["/dev/dri:/dev/dri"]` to `tdarr` in `compose/media-automation.yaml`, `./homelab up`, and pick a plugin or Flow that encodes with VAAPI or QSV. On an NVIDIA card instead, install NVIDIA's container toolkit and add `gpus: all`.
- **Another computer as a node:** publish the server port (`${BIND_IP:-127.0.0.1}:8266:8266`, with `BIND_IP` this machine's address) and run Tdarr's node there with `serverIP` set to this machine.
- **Flows:** Tdarr's visual pipelines (**Flows**) do more than the classic plugins, such as keeping only the languages you speak.

## Useful commands

```sh
./homelab logs tdarr -f
./homelab compose media-automation restart tdarr
curl -s http://localhost:8265/api/v2/status
```

## API

- **Token:** `POST /api/v2/public/auth/login` with `{"username":…,"password":…}` (its `token`), or an API key from its **API Keys** settings sent as `x-api-key`.
- **Base URL:** `http://localhost:8265/api/v2` on this machine, `https://tdarr.example.com/api/v2` on the LAN, with `Authorization: Bearer <token>`.
- **Nodes:** `GET /api/v2/get-nodes`. **Libraries:** `POST /api/v2/cruddb` with `{"data":{"collection":"LibrarySettingsJSONDB","mode":"getAll"}}`.
- The reference is its own page at `/api/v2/public/api-docs`.

## Learn more

- [tdarr.io](https://tdarr.io) and its [documentation](https://docs.tdarr.io)
- Tdarr is free, with a paid Pro tier (its site says what Pro adds); this homelab uses the free tier.

## Backup

`./homelab backup` copies its database nightly into `recovery-staging/databases/tdarr`, and Duplicati takes it off-site with the rest. The films themselves are backed up with the media drive, if at all; Tdarr changes them in place, so a backup of the drive made before a conversion is the only way back to an original.

## Troubleshooting

- **Nothing happens:** the node has no workers (step 4), the library's schedule has no ticked hour now, or **Scan** was never run.
- **Every file errors:** open one in **Transcode: Error/Cancelled** and read its log; a full cache drive or a plugin that does not suit the file are the usual causes.
- **The machine is slow while it runs:** fewer workers, or a schedule kept to the night.
