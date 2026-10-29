---
version: 0.14.0
---

# Vaultwarden

The household password manager. It speaks the Bitwarden protocol, so the official Bitwarden apps and browser extensions work with it. It also holds every homelab credential.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `vaultwarden` in `compose/security.yaml` (project `homelab_security`) |
| Image | `vaultwarden/server:latest` |
| Category | Security |
| Starts with `./homelab up` | Yes (`./homelab up`) |
| Address | https://passwords.example.com (LAN and public, through the Cloudflare Tunnel) |
| On this machine | http://localhost:8087 (`VAULTWARDEN_PORT`) |
| Data | `data/appdata/vaultwarden` → `/data` |
| Database dump | Daily by `./homelab backup` into `recovery-staging/databases/vaultwarden` |
| Updates | Watchtower, nightly at 4 AM |
<!-- END homelab:generated -->

## Purpose

- Passwords, 2FA codes, and secure notes for the family, synced to every device.
- The homelab's own credentials, as `homelab - <service> <credential>`.

## Setup

1. Open sign-ups for a while: Setup › **Open sign-ups for 10 minutes**, or `./homelab signups open` (`--for 30m` for longer).
2. Create each family account at `https://<TAILSCALE_HOST>:8087` in Home mode, or `https://passwords.example.com` with a domain.
3. Sign-ups close by themselves when the time is up (or `./homelab signups close` now). By hand instead: `VAULTWARDEN_SIGNUPS_ALLOWED=true`, `./homelab update vaultwarden`, and back to `false` afterwards; `./homelab doctor` warns while sign-ups are open.
4. Turn on two-step login for every account.
5. In the Bitwarden apps, choose Self-hosted and enter that same address.

Keep an offline copy of your master password: every other credential, including the backup passphrases, is in here.

## How it works

- A Rust server that speaks the Bitwarden client API, so the official Bitwarden apps work with it. It also serves the Bitwarden web vault.
- Everything is encrypted on your devices with a key derived from the master password. The server stores only the encrypted vault and cannot read it, which is also why a lost master password cannot be reset.
- Data is a SQLite database (`/data/db.sqlite3`), plus attachments and Sends on disk and an RSA key that signs sign-in tokens.
- `DOMAIN` (`https://passwords.example.com`) is used for links and for passkey two-step login, so it must match the address you use.
- Clients get live updates over a websocket on the same port, through the proxy (websockets are on in its proxy host).
- No admin page (`ADMIN_TOKEN` is not set) and no email (no SMTP settings), so features that send email, such as emergency access, do not work as is.

## Where things live

| What | Where |
|---|---|
| Database (accounts, encrypted vaults, organizations) | `data/appdata/vaultwarden` → `/data/db.sqlite3` |
| File attachments | `/data/attachments/` |
| Sends with files | `/data/sends/` |
| Key that signs sign-in tokens | `/data/rsa_key.pem` |
| Website icon cache | `/data/icon_cache/` |
| Daily database dump | `recovery-staging/databases/vaultwarden` |

## Everyday use

- **Apps:** Bitwarden for iPhone and Android (turn it on as the AutoFill provider in the phone's settings), the browser extension, and the desktop app. In each: Self-hosted, server `https://passwords.example.com`.
- **Browser extension shortcut:** Cmd+Shift+L (Ctrl+Shift+L elsewhere) fills the login for the current page.
- **Generator:** strong passwords and passphrases, in every app and the web vault.
- **Account settings › Security › Two-step login:** an authenticator app or a passkey for each account.
- **Send:** share a password or file with a link that expires.
- **Organizations:** a shared family vault with collections.
- **Export vault:** in the web vault's Tools, for the encrypted extra copy in Backup.

## Connects to

- Public through [Cloudflare Tunnel](<../network/Cloudflare Tunnel.md>) and [Nginx Proxy Manager](<../network/Nginx Proxy Manager.md>), so the apps sync away from home; [CrowdSec](<CrowdSec.md>) watches the proxy in front of it.
- Holds the homelab's own credentials, including [Duplicati](<../system/Duplicati.md>)'s backup passphrases and the admin logins of [Uptime Kuma](<Uptime Kuma.md>) and the others.
- [Uptime Kuma](<Uptime Kuma.md>) checks `http://vaultwarden:80/alive`.
- `.env`: `VAULTWARDEN_PORT`, `VAULTWARDEN_SIGNUPS_ALLOWED`, and `HOMELAB_DOMAIN` (its `DOMAIN`). `./homelab doctor` warns while sign-ups are open.

## Tinkering ideas

- Create a "Family" organization with collections (Wi-Fi, streaming, utilities) and move shared logins into it.
- Run the web vault's Reports for reused, weak, and exposed passwords, and fix the worst ones.
- Store website passkeys in Bitwarden; the browser extension and phone app offer to save them.
- Use Send instead of a chat message to share a one-off password, with an expiry and an access limit.
- Install the Bitwarden CLI (`bw`) on this Mac for scripted lookups and exports (commands below).
- Turn on the "unlock with biometrics" option in each app, so the master password is typed less often but stays strong.

## Useful commands

`/alive` answers when the server is up. The two `bw` lines point the Bitwarden CLI at this server and sign in.

```zsh
./homelab logs vaultwarden -f
./homelab compose vaultwarden restart vaultwarden
./homelab compose vaultwarden exec vaultwarden /vaultwarden --version
./homelab compose vaultwarden exec vaultwarden ls -la /data
./homelab update vaultwarden
curl -s http://localhost:8087/alive
bw config server https://passwords.example.com
bw login
```

## Learn more

- [Vaultwarden wiki](https://github.com/dani-garcia/vaultwarden/wiki)
- [Source on GitHub](https://github.com/dani-garcia/vaultwarden)
- [Image on Docker Hub](https://hub.docker.com/r/vaultwarden/server)
- [Bitwarden help](https://bitwarden.com/help/) for the apps

## Backup

`data/appdata/vaultwarden` (the SQLite database, attachments, keys) is in the Homelab AppData job. Each Bitwarden app also keeps an encrypted offline copy of its vault. Export the vault (encrypted) now and then as an extra copy.

Also keep a monthly password-protected export in `recovery-staging/secrets`: [Backups](<../../docs/Backups.md#password-vault-export>) has the steps, and the nightly backup reminds you.

## Troubleshooting

| Symptom | Fix |
|---|---|
| The web vault says it needs a secure context | Open it through `https://passwords...` (or `http://localhost:8087` on the Mac), not by IP |
| Apps fail to sync from outside | The tunnel or proxy is down. `./homelab watchdog` |
| Sign-up page missing | Sign-ups are closed, as intended. Open them briefly as in Setup |
