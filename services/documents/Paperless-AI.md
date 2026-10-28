---
version: 0.14.0
---

# Paperless-AI

Titles, tags, and correspondents for Paperless-ngx's documents, from an AI model

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `paperless-ai` in `stacks/paperless/compose.yaml` (project `homelab_paperless`) |
| Image | `docker.io/clusterzx/paperless-ai:latest` |
| Category | Documents |
| Starts with `./homelab up` | No: optional, `./homelab install paperless-ai` |
| Address | https://docs-ai.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:8011 (`PAPERLESS_AI_PORT`) |
| Depends on | `paperless` |
| Helpers | `paperless-db` `docker.io/library/postgres:18`, dumped daily by `./homelab backup`<br>`paperless-broker` `docker.io/valkey/valkey:9-alpine` |
| Data | `appdata/paperless-ai` → `/app/data` |
| Database dump | Daily by `./homelab backup` into `recovery-staging/databases/paperless-ai` |
| Updates | Nightly at 4 AM, with a copy of its data first |
| Needs in .env | `PAPERLESS_AI_PAPERLESS_TOKEN` |
<!-- END homelab:generated -->

## Purpose

Reads each new document in [Paperless-ngx](<Paperless-ngx.md>) and asks an AI model for a title, tags, a correspondent, and the document's date, then writes them back to Paperless, so a scanned bill comes out as *City Water, January invoice* with the right tags instead of *scan_0042*. It also answers questions about your documents in a chat. The model can run on this machine with Ollama, so the documents never leave it, or be an OpenAI-compatible service you choose.

## Setup

1. Have Paperless-ngx running and sign in to it as an administrator.
2. Have a model it can use: Ollama on this machine (Setup shows how on each system, once Paperless-AI is installed, and [Open WebUI](<Open WebUI.md>)'s Setup has the details), then `ollama pull llama3.2` or a larger model if the machine has the memory; or the address and key of an OpenAI-compatible service.
3. In Paperless, open your account (top right) › **My Profile** and create an **API Auth Token**. Paperless-AI acts as that account and needs to see its tags, correspondents, document types, custom fields, and users, so an administrator's token is simplest.
4. Put the token in Settings › `PAPERLESS_AI_PAPERLESS_TOKEN`, then `./homelab install paperless-ai`: it installs only once the token is set. Its image is a 4.6 GB download (13 GB on disk), mostly the chat's search index.
5. Open Paperless-AI. Its setup page has Paperless's address (`http://paperless:8000`) and the token filled in; add your Paperless username, then:
   - **AI provider:** Ollama, at `http://host.docker.internal:11434` with the model you pulled; or Custom, with the service's address, key, and model.
   - Your own username and password for Paperless-AI.
6. Save. It restarts with the settings and, every 30 minutes, works through the documents it has not seen yet. **Scan Now** on its dashboard starts at once.

Its setup page answers without signing in, even once it is set up, so the homelab keeps Paperless-AI off the internet (LAN and Tailscale only).

## How it works

- A Node.js app with a Python search service in one container. The app lists Paperless's documents through its API, sends each one's text to the model with a prompt, and writes the answer back: title, tags, correspondent, document type, date, and custom fields, each switched on or off in its settings.
- The search service indexes the documents' text for the chat (**Chat** and **RAG Chat**), on this machine.
- Its settings live in its own `data/.env`, written by its setup page and Settings. The homelab gives it Paperless's address and token (`PAPERLESS_AI_PAPERLESS_TOKEN`), which win over the ones on its own pages, so a new token goes in the homelab's Settings, followed by `./homelab up`. It also gives it `API_KEY` (`PAPERLESS_AI_API_KEY`, for its API) and `JWT_SECRET` (`PAPERLESS_AI_JWT_SECRET`, for its sign-in).
- Which documents it has done, its history, and the token counts are kept in a SQLite database, `documents.db`.

## Where things live

| What | Where |
|---|---|
| Settings (model, prompt, what it changes) | `appdata/paperless-ai/.env` |
| Documents done, history, accounts | `appdata/paperless-ai/documents.db` |
| The chat's search index | `appdata/paperless-ai` |
| Secrets | `PAPERLESS_AI_PAPERLESS_TOKEN`, `PAPERLESS_AI_API_KEY`, and `PAPERLESS_AI_JWT_SECRET` in `.env` |

## Everyday use

- **New scans:** drop them in Paperless as usual; within half an hour they have a title and tags. **History** lists what it changed; **Reset Selected** there has it look at those documents again on the next scan.
- **Only some documents:** in Settings, have it process only documents with a tag you choose, or switch off automatic processing and use **Manual** on the documents you pick.
- **Your own tags:** in Settings, limit it to the tags and correspondents you already have, so it does not invent new ones.
- **Ask your documents:** **Chat** answers from one document; **RAG Chat** searches all of them (*when does the car insurance renew?*).

## Connects to

- [Paperless-ngx](<Paperless-ngx.md>): the documents it reads and writes, through Paperless's API with your token (`PAPERLESS_AI_PAPERLESS_TOKEN`).
- Ollama on this machine (see [Open WebUI](<Open WebUI.md>)) or an OpenAI-compatible service: the model.
- On battery the homelab pauses it with the other background work (see [Host](<../../docs/Host.md>)).
- `.env`: `PAPERLESS_AI_PORT` (default `8011`), `PAPERLESS_AI_URL`, and the secrets above.

## Tinkering ideas

- Your own prompt, in Settings: ask for titles in your language, or for the amount and due date in a custom field.
- Webhook: a Paperless workflow that calls `POST /api/webhook/document` when a document is added, so it is done at once instead of on the next scan.
- A bigger model for the chat only, on a machine with the memory for it.

## Useful commands

```sh
./homelab logs paperless-ai -f
./homelab compose paperless restart paperless-ai
curl -s -X POST -H "x-api-key: $PAPERLESS_AI_API_KEY" http://localhost:8011/api/scan/now
curl -s -H "x-api-key: $PAPERLESS_AI_API_KEY" "http://localhost:8011/api/history?length=5"
```

## API

- **Key:** `PAPERLESS_AI_API_KEY` from `.env`, sent as the `x-api-key` header.
- **Base URL:** `http://localhost:8011` on this machine, `https://docs-ai.example.com` on the LAN.
- **Scan now:** `POST /api/scan/now`. **History:** `GET /api/history`. **A document as soon as it is added:** `POST /api/webhook/document`.
- The full reference is its own Swagger page at `/api-docs`.

## Learn more

- [GitHub: clusterzx/paperless-ai](https://github.com/clusterzx/paperless-ai) and its [wiki](https://github.com/clusterzx/paperless-ai/wiki)
- [Ollama](https://ollama.com), the models that run on this machine

## Backup

`./homelab backup` copies `documents.db` nightly into `recovery-staging/databases/paperless-ai`, and Duplicati takes it off-site with the rest. Its settings are in `appdata/paperless-ai/.env`: add that folder to the Homelab Stack Data job in Duplicati, or set it up again after a restore (a minute's work). The chat's search index is rebuilt from Paperless. The documents themselves are Paperless's, backed up with it.

## Troubleshooting

- **The setup page says the Paperless connection failed:** the token in Settings › `PAPERLESS_AI_PAPERLESS_TOKEN` is wrong or from an account that cannot see tags, correspondents, document types, custom fields, and users; make a new one in Paperless, put it there, and `./homelab up`. The address is `http://paperless:8000`, not `localhost` (inside its container, localhost is Paperless-AI itself).
- **Ollama connection failed:** Ollama is not answering on this machine, or (Linux) listens only on 127.0.0.1; [Open WebUI](<Open WebUI.md>)'s Setup shows how to let containers reach it. The model name must be one `ollama list` shows.
- **Documents are not changed:** in Settings, check that titles and tags are switched on and that no tag filter leaves them out; `./homelab logs paperless-ai` shows each document's answer from the model.
- **Slow or out of memory:** a smaller model, or fewer documents at once. The first start indexes every document for the chat, which takes a while on a large archive.
