---
version: 0.1.0-alpha
---

# PairDrop

AirDrop between any devices on the home network, from the browser

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `pairdrop` in `compose/cloud.yaml` (project `homelab_cloud`) |
| Image | `lscr.io/linuxserver/pairdrop:latest` |
| Category | Cloud & Files |
| Starts with `./homelab up` | No: optional, `./homelab install pairdrop` |
| Address | https://drop.example.com (LAN, through Nginx Proxy Manager) |
| On this Mac | http://localhost:3020 (`PAIRDROP_PORT`) |
| Updates | Watchtower, nightly at 4 AM |
| Also known as | airdrop |
<!-- END homelab:generated -->

## Purpose

AirDrop for every device, including Windows, Android, and the Steam Machine: open the page on two devices on the home network and they see each other. Files go directly between the devices (peer to peer); the server only introduces them.

## Setup

1. `./homelab install pairdrop`.
2. Open `https://drop.example.com` on both devices; tap the other device and pick files, or paste text.
3. On a phone, add it to the home screen. To pair devices that are not on the same network, use **Pair device** with the code it shows.

## How it works

- A small Node.js server and a web app. The server only introduces devices to each other over a WebSocket; files and text go straight between the browsers over WebRTC.
- Devices that reach the server from the same network see each other on their own. Paired devices find each other wherever they are; the pairing is kept in each browser.
- Nothing is stored on this Mac. `WS_FALLBACK` is off, so when two devices cannot connect directly the transfer fails instead of going through the server. `RATE_LIMIT` is off.

## Everyday use

- Click a device to send files; right-click it (long-press on a phone) to send a text message.
- Paste on the page (⌘V) to send what is on the clipboard.
- Your device's name is shown at the bottom of the page.
- Pair a device once from the pairing option, or join a temporary public room with a code to swap files with a guest.
- On Android, install it from the browser menu as an app, and PairDrop appears in the share sheet.

## Connects to

- Behind [Nginx Proxy Manager](<../network/Nginx Proxy Manager.md>) at `drop.example.com`, with WebSockets on; on [Tailscale](<../network/Tailscale.md>), devices see each other when both are on the tailnet.
- To send to people outside the home, use [PsiTransfer](<../cloud and files/PsiTransfer.md>); for folders that stay the same everywhere, [Syncthing](<../cloud and files/Syncthing.md>).
- `.env`: `PAIRDROP_PORT`.

## Tinkering ideas

- Pair your phone and this Mac once, so they find each other even on different networks.
- On the Mac, add it to the Dock from Safari (File › Add to Dock) so it opens like an app.
- Use a public room to swap files with a visitor's phone without pairing.
- If transfers fail on some networks, try `WS_FALLBACK: "true"` in its `environment`; transfers then go through this Mac when a direct link fails.

## Useful commands

The logs (each device joining shows up), a restart, and whether the page answers:

```zsh
./homelab logs pairdrop -f
./homelab compose pairdrop restart pairdrop
curl -sI http://localhost:3020
```

## Learn more

- Source and docs: https://github.com/schlagmichdoch/PairDrop
- Image: https://docs.linuxserver.io/images/docker-pairdrop/

## Backup

Nothing to back up: PairDrop keeps no files.

## Troubleshooting

- **The other device does not appear:** both must be on the home Wi-Fi (or both on Tailscale), and the page must be open on both.
- **Transfers stall:** a VPN with a kill switch on one device blocks peer-to-peer connections; turn it off or allow LAN connections.
