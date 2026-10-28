---
version: 0.14.0
---

# Memos

Quick notes from any device, with tags and search

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `memos` in `compose/documents.yaml` (project `homelab_documents`) |
| Image | `neosmemo/memos:stable` |
| Category | Documents |
| Starts with `./homelab up` | No: optional, `./homelab install memos` |
| Address | https://notes.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:5230 (`MEMOS_PORT`) |
| Data | `data/appdata/memos` → `/var/opt/memos` |
| Database dump | Daily by `./homelab backup` into `recovery-staging/databases/memos` |
| Updates | Nightly at 4 AM, with a copy of its data first |
<!-- END homelab:generated -->

## Purpose

Quick notes from any device: a thought, a link, a list, a photo, with tags and search, like a private timeline. Longer documents and scans belong in Paperless-ngx; Memos is for the small things.

## Setup

1. `./homelab install memos` and open `https://<TAILSCALE_HOST>:5230` in Home mode, or `https://notes.example.com` with a domain.
2. The first account becomes the admin. Then Settings › System › turn off **Allow user signup** once everyone has an account.
3. On a phone, add it to the home screen.

## Away from home

In Home mode (the default), Memos is on the tailnet: it opens at home and away on every device signed in to Tailscale. With a domain, it is on the home network only: install Tailscale to reach it from anywhere, or, to publish it through the tunnel, add `public: true` to its `x-homelab` block and run `./homelab domain setup` again.

## How it works

- A single Go program that serves both the API and the React web app on port 5230.
- Everything lives in one SQLite database, `memos_prod.db`, in the data folder `/var/opt/memos`.
- Memos are Markdown. A `#word` becomes a tag and `- [ ]` makes a checklist.
- Attachments are stored in the database or as files in the data folder, depending on Settings › Storage; local files go under `assets`.
- Each memo has a visibility: private (only you), workspace (signed-in users), or public.

## Where things live

| What | Where |
|---|---|
| Database (memos, users, settings) | `data/appdata/memos/memos_prod.db` → `/var/opt/memos/memos_prod.db` |
| Attachments kept as files | `data/appdata/memos/assets/` → `/var/opt/memos/assets` |
| Daily consistent copy | `recovery-staging/databases/memos` (by `./homelab backup`) |

## Everyday use

- **Write:** type in the box at the top and press **Cmd+Return** (or **Save**). Add `#tags` as you go.
- **Find:** the search box, the tag list, and the activity calendar filter the timeline by word, tag, or day.
- **Keep on top:** pin a memo from its **...** menu; archive it when it is done.
- **Checklists:** tick boxes right in the timeline, without opening the memo.
- **Phone:** the web app added to the home screen, or a third-party app such as MoeMemos (iOS and Android).
- **Export:** Settings › Export & Import.

## Connects to

- [Paperless-ngx](<Paperless-ngx.md>) is the place for scans and long documents; Memos is for small notes.
- [Karakeep](<Karakeep.md>) is better for links you want archived; Memos for a quick thought about one.
- [Pocket ID](<../security/Pocket ID.md>) can be its sign-in: Settings › SSO, with a client made in Pocket ID.
- [Nginx Proxy Manager](<../network/Nginx Proxy Manager.md>) serves `https://notes.example.com`; `.env` sets only `MEMOS_PORT` (default `5230`).

## Tinkering ideas

- Quick capture from the iPhone: a Shortcut with **Get Contents of URL** that POSTs to the API (see API), on the share sheet or the Action button.
- Webhooks: Settings › Webhooks calls a URL whenever a memo is created or changed.
- Attachments as files: Settings › Storage › local storage keeps new images in `assets` instead of the database, so the database stays small.
- Share a single note: set one memo to public and send its link (public memos are only reachable on the LAN or the tailnet here).
- A daily review: filter the calendar to a day a year ago and see what you were thinking.

## Useful commands

Follow the log, restart, look at the data folder, and use the API with an access token from Settings › My Account › Access Tokens:

```zsh
./homelab logs memos -f
./homelab compose memos restart memos
./homelab compose memos exec memos ls -la /var/opt/memos
curl -s -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5230/api/v1/memos
```

## API

- **Token:** Settings › My Account › Access Tokens.
- **Base URL:** `http://localhost:5230/api/v1` on this Mac, or `https://notes.example.com/api/v1`, with `Authorization: Bearer <token>`.
- **New memo:** `curl -s -X POST -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" -d '{"content":"Buy batteries #shopping"}' http://localhost:5230/api/v1/memos`

## Learn more

- [usememos.com](https://usememos.com) (documentation and API reference)
- [GitHub: usememos/memos](https://github.com/usememos/memos) (source of the `neosmemo/memos` image)

## Backup

The nightly backup takes a consistent copy of the database (`memos_prod.db`); attachments in `data/appdata/memos` are covered by the AppData job.

## Troubleshooting

- **Images do not load after a move:** attachments are stored in `data/appdata/memos/assets`; keep that folder with the database.
