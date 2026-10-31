---
version: 0.16.0
---

# Frigate

Cameras recorded on this machine, with person, car, and animal detection.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `frigate` in `stacks/frigate/compose.yaml` (project `homelab_frigate`) |
| Image | `ghcr.io/blakeblackshear/frigate:0.18.2` |
| Category | Security |
| Starts with `./homelab up` | No: optional, `./homelab install frigate` |
| Address | https://cameras.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:8971 (`FRIGATE_PORT`) |
| Depends on | `frigate-mqtt` |
| Helpers | `frigate-mqtt` `docker.io/library/eclipse-mosquitto:2` |
| Data | `appdata/frigate` → `/config`<br>`/Volumes/Media/frigate` → `/media/frigate` |
| Database dump | Daily by `./homelab backup` into `recovery-staging/databases/frigate` |
| Updates | By hand. A new version can change the settings file and migrate the database; set FRIGATE_VERSION to a newer release after reading its notes, then ./homelab update frigate |
<!-- END homelab:generated -->

## Purpose

Records your cameras on this machine and watches them for people, cars, and animals, so you get "a person at the front door" instead of every leaf that moves. Nothing goes to a vendor's cloud: no subscription, and the footage stays home. With [Home Assistant](<../household/Home Assistant.md>), its detections become sensors, camera views, and phone notifications.

It is heavy and optional: decoding video and running detection keeps the processor busy around the clock, about one core for each camera without a detector chip.

## Setup

1. Find each camera's stream address (RTSP) in its manual or app, usually `rtsp://user:password@<camera address>:554/<path>`. Cameras that only work through a vendor's cloud app cannot be used.
2. `./homelab install frigate` (it brings its event broker). Recordings go to `frigate` on the media drive, or to the folder in `FRIGATE_RECORDINGS` if you add that setting to `.env`.
3. Sign in: on its first start Frigate makes the account `admin` with a random password, written in its log: `./homelab logs frigate | grep -i password`. Change it under your account once signed in.
4. Add the cameras: open the configuration editor in Frigate's settings, replace the example `front_door` camera's address with yours, set `enabled: true`, then save and restart from the editor. Each further camera is another entry under `cameras`.
5. To keep recordings, add to each camera (or once at the top level):
   ```yaml
   record:
     enabled: true
   ```
   and choose how long to keep them in its settings. A camera recording all the time at 4 Mbit/s fills about 43 GB a day.
6. Pair it with Home Assistant (below).

## Pairing with Home Assistant

1. In Home Assistant: **Settings › Devices & services › Add integration › MQTT**. Broker `frigate-mqtt`, port `1883`, username `frigate`, password `FRIGATE_MQTT_PASSWORD` from Settings (Show).
2. Install the Frigate integration. It is not built in: add [HACS](https://hacs.xyz) to Home Assistant, then search HACS for **Frigate** and install it, and restart Home Assistant.
3. **Add integration › Frigate**, with the URL `http://frigate:5000` (Frigate by its name inside Docker; that port needs no sign-in and is not reachable from outside Docker).
4. Each camera appears as a device with its live view, a sensor for each kind of object, and the latest snapshot; automations can notify your phone on a person, with the picture.

## How much it takes, on each system

- **Processor:** each camera's stream is decoded all the time, and detection runs on the moving parts. On the processor alone, plan on one core for each 720p camera at 5 frames a second.
- **Shared memory:** `shm_size` in `stacks/frigate/compose.yaml` is 512 MB, enough for several 720p cameras. Raise it if the log says *Bus error*.
- **A detector chip** (a Coral, or a graphics chip) makes detection several times faster:
  - **Mac:** containers cannot reach USB devices or Apple's graphics, so it runs on the processor.
  - **Windows:** an NVIDIA graphics card works through WSL 2, with the `-tensorrt` image; a USB Coral cannot be passed through.
  - **Linux:** a USB Coral, Intel graphics (OpenVINO), AMD graphics (the `-rocm` image), or NVIDIA (the `-tensorrt` image, with NVIDIA's container toolkit) can all be passed through (Tinkering ideas).
  - **SteamOS:** its AMD graphics can be passed through like on Linux, with the `-rocm` image.

## How it works

- One container runs Frigate: FFmpeg reads each camera, a motion check finds what changed, and the detector looks for objects there. Recordings and snapshots are written to `/media/frigate`.
- `frigate-mqtt` (Mosquitto) is the stack's event broker: Frigate publishes each detection there, and Home Assistant listens. It lets only the `frigate` account in, with `FRIGATE_MQTT_PASSWORD`.
- Port 8971 is its page and API with sign-in (the one the proxy and `http://localhost:8971` use). Port 5000, without sign-in, stays inside Docker for Home Assistant.
- Events, reviews, and the users are in a SQLite database, `frigate.db`, next to `config.yml`.

## Where things live

| What | Where |
|---|---|
| Settings | `appdata/frigate/config.yml` |
| Events, reviews, users | `appdata/frigate/frigate.db` |
| Recordings, clips, snapshots | `<MEDIA_ROOT>/frigate`, or `FRIGATE_RECORDINGS` |
| Secrets | `FRIGATE_MQTT_PASSWORD` in `.env`; the `admin` password in its database |

## Everyday use

- **Review:** the home page lists what it saw, by camera, as short clips; mark them reviewed as you go.
- **Explore:** search past detections by object, camera, and time.
- **Zones and masks:** draw where a person matters (the path to the door) and what to ignore (a busy street, a waving tree), in each camera's settings.
- **On the phone:** through Home Assistant's app, or open `https://cameras.example.com` at home and over Tailscale.

## Connects to

- [Home Assistant](<../household/Home Assistant.md>): sensors, camera views, and notifications (Pairing, above).
- The media drive: recordings, alongside the films; `homelab doctor` warns when it fills.
- `.env`: `FRIGATE_PORT` (default `8971`), `FRIGATE_VERSION`, `FRIGATE_MQTT_PASSWORD`, `FRIGATE_RECORDINGS`.

## Tinkering ideas

- **A USB Coral (Linux):** add `devices: ["/dev/bus/usb:/dev/bus/usb"]` to `frigate` in `stacks/frigate/compose.yaml` and, in `config.yml`, `detectors: { coral: { type: edgetpu, device: usb } }`.
- **Intel graphics (Linux, SteamOS on Intel):** add `devices: ["/dev/dri:/dev/dri"]` and an `openvino` detector with `device: GPU`; AMD graphics need the `-rocm` image (set the image tag to `${FRIGATE_VERSION}-rocm`).
- **Face and licence-plate recognition:** built into Frigate, switched on in its settings; both run better with a detector chip.

## Useful commands

```sh
./homelab logs frigate -f
./homelab compose frigate restart frigate
./homelab compose frigate exec frigate curl -s http://127.0.0.1:5000/api/stats
./homelab update frigate          # after changing FRIGATE_VERSION
```

## API

- **Sign in:** `POST /api/login` with `{"user":"admin","password":…}` on port 8971 (it sets a cookie), or use port 5000 from another container (no sign-in).
- **Base URL:** `http://localhost:8971/api` on this machine, `https://cameras.example.com/api` on the LAN.
- **Useful calls:** `GET /api/stats` (each camera's frames per second), `GET /api/events`, `GET /api/<camera>/latest.jpg`.
- The reference is in Frigate's [documentation](https://docs.frigate.video/integrations/api).

## Learn more

- [frigate.video](https://frigate.video) and its [documentation](https://docs.frigate.video)
- [GitHub: blakeblackshear/frigate](https://github.com/blakeblackshear/frigate) and the [Home Assistant integration](https://github.com/blakeblackshear/frigate-hass-integration)

## Backup

`./homelab backup` copies `frigate.db` nightly into `recovery-staging/databases/frigate`, and Duplicati takes it off-site with the rest; `config.yml` is in `appdata/frigate`, with the apps' folders. Recordings are on the media drive and are not backed up: they are kept for the days you set and then deleted.

## Troubleshooting

- **A camera shows nothing:** check its address in VLC first; in Frigate's log, *Connection refused* or *401* means the address or the camera's password is wrong.
- **Bus error, or Frigate restarting:** raise `shm_size` in `stacks/frigate/compose.yaml`, then `./homelab up`.
- **The processor is always busy:** lower each camera's `detect` size and `fps` (5 is enough), add motion masks, or add a detector chip where the system allows it.
- **Home Assistant shows no events:** its MQTT integration must use `frigate-mqtt` and the `frigate` account; Frigate's log says *MQTT connected* when its own side works.
