---
version: 0.16.0
---

# PsiTransfer

Send large files to anyone with a link that expires.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `psitransfer` in `compose/cloud.yaml` (project `homelab_cloud`) |
| Image | `psitrax/psitransfer:latest` |
| Category | Cloud & Files |
| Starts with `./homelab up` | No: optional, `./homelab install psitransfer` |
| Address | https://send.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:3030 (`PSITRANSFER_PORT`) |
| Data | `data/appdata/psitransfer` → `/data` |
| Updates | Nightly at 4 AM, with a copy of its data first |
| Also known as | wetransfer |
<!-- END homelab:generated -->

## Purpose

Send large files (videos, scans, photo sets) to anyone with a link, like WeTransfer: upload, set how long the link lasts and an optional password, and share it. Only the household can upload (the upload password); anyone with a link can download.

## Setup

1. `./homelab install psitransfer` and open `https://<TAILSCALE_HOST>:3030` in Home mode, or `https://send.example.com` with a domain.
2. Enter the upload password (Settings › `PSITRANSFER_UPLOAD_PASSWORD` › **Copy**), add files, choose the expiry, and upload.
3. To send to people outside the home (with a domain), publish it: add `public: true` to its `x-homelab` block and run `./homelab domain setup`. The upload password still keeps strangers from uploading.
4. The admin page (`/admin`, `PSITRANSFER_ADMIN_PASSWORD`) lists the current uploads. **Sign-in details** on its page in Status copies that password.

## Away from home

In Home mode it is on the tailnet, so every device signed in to Tailscale reaches it at home and away. With a domain it is on the home network only: install Tailscale to reach it from anywhere, or, to publish it through the tunnel, add `public: true` to its `x-homelab` block and run `./homelab domain setup` again.

## How it works

- A Node.js server with a Vue page. Uploads use the tus protocol, so a large upload resumes after a dropped connection.
- Each upload is a bucket with its own link, files, retention, and optional password, stored under `/data`, one folder per bucket.
- Expired buckets are deleted on their own; a one-time bucket is deleted after its first download.
- Its settings come from the defaults in its `config.js`, overridden by `PSITRANSFER_*` environment variables; here only the admin and upload passwords are set.

## Where things live

| What | Where |
|---|---|
| Uploads, one folder per bucket | `data/appdata/psitransfer` → `/data` |

## Everyday use

- Upload: enter the upload password, drop the files, choose how long the link lasts (from one download to several weeks), optionally set a password, then copy the link.
- The recipient sees each file with a download button, and can download everything at once as an archive.
- `/admin` lists the current buckets, their size, and when they expire.

## Connects to

- Behind [Nginx Proxy Manager](<../network/Nginx Proxy Manager.md>) at `send.example.com`; [Cloudflare Tunnel](<../network/Cloudflare Tunnel.md>) when you make it public.
- Its folder is in [Duplicati](<../system/Duplicati.md>)'s AppData job unless you exclude it.
- Keep both passwords in [Vaultwarden](<../security/Vaultwarden.md>). For devices in the same home, [PairDrop](<../cloud and files/PairDrop.md>) is quicker.
- `.env`: `PSITRANSFER_PORT`, `PSITRANSFER_ADMIN_PASSWORD`, `PSITRANSFER_UPLOAD_PASSWORD`.

## Tinkering ideas

- Change the retention choices or the default, or cap file and bucket size, with the matching `PSITRANSFER_*` variables listed in its README.
- Exclude `/source/appdata/psitransfer/` from the AppData job (Duplicati › job › Edit › Source data › Filters).
- Publish it for sending to family elsewhere; the upload password still guards uploads.
- Put a password on sensitive buckets and send the password by a different route than the link.

## Useful commands

The logs, a restart, how much space uploads take, and whether the page answers:

```zsh
./homelab logs psitransfer -f
./homelab compose psitransfer restart psitransfer
du -sh data/appdata/psitransfer
curl -sI http://localhost:3030
```

## Learn more

- Source, configuration, and the `psitrax/psitransfer` image: https://github.com/psi-4ward/psitransfer

## Backup

Uploads in `data/appdata/psitransfer` expire on their own and are not worth keeping; the AppData job covers them anyway. Exclude the folder in Duplicati if they grow large.

## Troubleshooting

- **Upload fails for big files:** the proxy's upload limit; in Nginx Proxy Manager, edit `send.example.com` › Advanced and add `client_max_body_size 0;`.
