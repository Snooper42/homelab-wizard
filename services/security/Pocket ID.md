---
version: 0.14.0
---

# Pocket ID

One sign-in with passkeys for the household's apps (OpenID Connect)

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `pocket-id` in `compose/security.yaml` (project `homelab_security`) |
| Image | `ghcr.io/pocket-id/pocket-id:v2` |
| Category | Security |
| Starts with `./homelab up` | No: optional, `./homelab install pocket-id` |
| Address | https://id.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:1411 (`POCKET_ID_PORT`) |
| Data | `data/appdata/pocket-id` → `/app/data` |
| Updates | Nightly at 4 AM, with a copy of its data first |
| Also known as | sso, oidc, passkeys |
<!-- END homelab:generated -->

## Purpose

One sign-in for the household, with passkeys (Face ID, Touch ID, or a security key) instead of a password per app. `./homelab sso setup` makes it the sign-in of Karakeep, Open WebUI, Paperless-ngx, Mealie, and Vikunja by itself, and makes Immich's client with the steps to paste it. Other apps with OpenID Connect (Audiobookshelf) are connected by hand.

## Setup

1. `./homelab install pocket-id` and open `/setup` on its https address: `https://<TAILSCALE_HOST>:1411/setup` in Home mode, or `https://id.example.com/setup` with a domain (passkeys need the https address, not localhost).
2. Create the admin account and register a passkey.
3. **Users** › add each person, then send them the sign-up link it makes so they register their own passkey.
4. `./homelab sso setup` (it needs a domain; see below): for each app it supports that runs here, it makes an OIDC client through Pocket ID's API (`POCKET_ID_API_KEY`, its `STATIC_API_KEY`) and writes the app's sign-in settings to `data/sso/<app>.env`, which the app's service reads, then restarts the app. `./homelab sso` shows which are connected.
5. Any other app: **OIDC Clients** › **Add**, name it, set the callback URL from the app's own SSO settings, and copy the client ID and secret into the app.

The apps' containers reach `id.example.com` through Nginx Proxy Manager on this Mac whatever their DNS says (`SSO_HOST`, mapped to the host in each of their services). In Home mode they cannot reach the tailnet address from inside a container, so single sign-on needs Set up the domain.

`POCKET_ID_ENCRYPTION_KEY` in `.env` protects Pocket ID's signing keys. It is backed up with `.env` (Secrets job); losing it means everyone registers their passkeys again.

## Away from home

In Home mode (the default), Pocket ID is on the tailnet: it opens at home and away on every device signed in to Tailscale. With a domain, it is on the home network only: install Tailscale to reach it from anywhere, or, to publish it through the tunnel, add `public: true` to its `x-homelab` block and run `./homelab domain setup` again.

## How it works

- One Go program serves the web UI and the OpenID Connect endpoints on port 1411. It is a sign-in provider only, and passkeys are the only way to sign in: there are no passwords.
- An app sends you to Pocket ID, you confirm with a passkey, and Pocket ID sends you back with a code; the app then trades the code for your name, email, and groups.
- Users, passkeys, OIDC clients, and the audit log are in a SQLite database under `/app/data`. `ENCRYPTION_KEY` (`POCKET_ID_ENCRYPTION_KEY`) encrypts its signing keys.
- `APP_URL` is `https://id.example.com`. Passkeys are bound to that name, which is why `localhost` cannot sign in.
- `TRUST_PROXY=true` takes the client's address from the proxy's headers, so the audit log shows real addresses.

## Where things live

| What | Where |
|---|---|
| Database (users, passkeys, clients, audit log) and uploaded images | `data/appdata/pocket-id` → `/app/data` |
| Key that encrypts the signing keys | `POCKET_ID_ENCRYPTION_KEY` in `.env` |
| What apps read to configure themselves | `https://id.example.com/.well-known/openid-configuration` |

## Everyday use

- **My Account:** your name and email, and your passkeys. Add a second passkey (another device or a security key) so a lost phone does not lock you out.
- **Users:** `./homelab person add "Anna Smith" --email anna@example.com` adds someone, with a one-time link to add their passkey and a welcome page listing their apps (`data/people/anna.html`); `./homelab person remove anna` turns their sign-in off. In Pocket ID itself: send sign-up links, and make a one-time sign-in link for someone who lost their passkey.
- **User Groups:** group people (adults, kids) to decide who may use which app.
- **OIDC Clients:** one per connected app, with its callback URL, client ID, and secret.
- **Audit log:** recent sign-ins with device and address.

## Connects to

- Apps with OpenID Connect sign-in, among them [Immich](<../cloud and files/Immich.md>), [Paperless-ngx](<../documents/Paperless-ngx.md>), [Karakeep](<../documents/Karakeep.md>), [Vikunja](<../household/Vikunja.md>), [Open WebUI](<../documents/Open WebUI.md>), [Grocy](<../household/Grocy.md>), [Mealie](<../household/Mealie.md>), and [Audiobookshelf](<../media/Audiobookshelf.md>). Each gets a client ID and secret, and the issuer URL `https://id.example.com`.
- Reached through [Nginx Proxy Manager](<../network/Nginx Proxy Manager.md>) at home and [Tailscale](<../network/Tailscale.md>) away.
- `.env`: `POCKET_ID_ENCRYPTION_KEY`, `POCKET_ID_PORT`, and `HOMELAB_DOMAIN` (its address).

## Tinkering ideas

- Connect [Immich](<../cloud and files/Immich.md>) first (Administration › Settings › Authentication Settings › OAuth): it shows the whole flow, including mobile sign-in.
- Limit an OIDC client to a user group, so only the adults can sign in to [Paperless-ngx](<../documents/Paperless-ngx.md>).
- Add custom claims to a user or group for apps that expect extra fields.
- Save a passkey in Bitwarden ([Vaultwarden](<Vaultwarden.md>)) as a second one that follows you across devices.
- Set up email in the application settings, so people get a message when their account signs in from a new device.
- Make an API key in the admin settings to script adding users.

## Useful commands

If every admin passkey is lost, `one-time-access-token` makes a one-time sign-in link for that user. The `curl` line shows the discovery document apps read.

```zsh
./homelab logs pocket-id -f
./homelab compose pocket-id restart pocket-id
./homelab compose pocket-id exec pocket-id /app/pocket-id one-time-access-token <username>
curl -s http://localhost:1411/.well-known/openid-configuration
```

## Learn more

- [Pocket ID docs](https://pocket-id.org/docs)
- [Source on GitHub](https://github.com/pocket-id/pocket-id)
- [Image on GitHub Container Registry](https://github.com/pocket-id/pocket-id/pkgs/container/pocket-id)

## Backup

The database and keys are in `data/appdata/pocket-id`, covered by the AppData job.

## Troubleshooting

- **"Passkeys are not supported":** open it through `https://id.example.com`; passkeys need HTTPS on the real name.
- **Changing the domain:** passkeys are tied to `id.example.com`. After moving to another domain, everyone registers again.
