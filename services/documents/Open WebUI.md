---
version: 0.11.0
---

# Open WebUI

Private AI chat with models that run on this Mac (Ollama)

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `open-webui` in `compose/documents.yaml` (project `homelab_documents`) |
| Image | `ghcr.io/open-webui/open-webui:main` |
| Category | Documents |
| Starts with `./homelab up` | No: optional, `./homelab install open-webui` |
| Address | https://ai.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:3080 (`OPEN_WEBUI_PORT`) |
| Data | `data/appdata/open-webui` → `/app/backend/data` |
| Updates | Watchtower, nightly at 4 AM |
<!-- END homelab:generated -->

## Purpose

A private ChatGPT-style chat whose models run on this Mac through Ollama. Prompts and answers never leave the house. Local models are smaller than the big cloud ones, so treat it as a private assistant rather than a full ChatGPT Plus replacement.

## Setup

1. Install Ollama on the machine itself, outside a container, so it can use the GPU, then pull a model, for example `ollama pull llama3.2`:

   | | Install and start |
   |---|---|
   | macOS | `brew install ollama`, then `brew services start ollama` |
   | Linux | `curl -fsSL https://ollama.com/install.sh \| sh`. It listens only on 127.0.0.1, which containers cannot reach: `sudo systemctl edit ollama`, add `Environment=OLLAMA_HOST=0.0.0.0` under `[Service]`, then `sudo systemctl restart ollama` |
   | Windows | `winget install Ollama.Ollama` (it starts at sign-in) |

   `./homelab doctor` warns while Open WebUI runs and Ollama does not answer, with this machine's line from the table.
2. `./homelab install open-webui`.
3. Open it and create the first account, which becomes the admin. Later accounts wait for the admin's approval.

## How it works

- A Python (FastAPI) backend with a Svelte web app, both in one container on port 8080.
- It holds no models itself. Each chat is sent to Ollama, which runs natively on this Mac so it can use the GPU, at `OLLAMA_BASE_URL` (`http://host.docker.internal:11434`).
- Users, chats, and settings are in a SQLite database, `webui.db`, in `/app/backend/data`. Most admin settings are saved there too, so they survive restarts.
- Files you attach or put in a knowledge base are split up and embedded by a small local model, then stored in a Chroma vector index in `vector_db`, so the chat can quote them (RAG).
- `WEBUI_SECRET_KEY` (`OPEN_WEBUI_SECRET_KEY` in `.env`) signs sign-in sessions; changing it signs everyone out. Telemetry is off (`ANONYMIZED_TELEMETRY`).

## Where things live

| What | Where |
|---|---|
| Database (users, chats, settings) | `data/appdata/open-webui/webui.db` → `/app/backend/data/webui.db` |
| Uploaded files | `data/appdata/open-webui/uploads/` |
| Document index (RAG) | `data/appdata/open-webui/vector_db/` |
| Downloaded helper models (embeddings, speech) | `data/appdata/open-webui/cache/` |
| Chat models | Ollama's own folder on this Mac, `~/.ollama/models` |

## Everyday use

- **Chat:** **New Chat**, pick a model at the top, and type. Set a favourite as the default from the model menu.
- **Ask about a file:** attach it with **+**, or type `#` to pull in a knowledge base.
- **Saved prompts:** Workspace › Prompts; type `/` in a chat to use one.
- **Your own assistants:** Workspace › Models: a base model plus a system prompt, knowledge, and settings, shown in the model list.
- **Accounts:** Admin Panel › Users approves new sign-ups and sets roles.
- **Phone:** open `https://<TAILSCALE_HOST>:3080` in Home mode, or `https://ai.example.com` with a domain, and add it to the home screen; it works as an app.

## Connects to

- **Ollama** on this Mac, outside the homelab: `brew services start ollama`, models with `ollama pull`. `./homelab doctor` warns when it does not answer.
- [Karakeep](<Karakeep.md>) can use the same Ollama for automatic tags.
- [Pocket ID](<../security/Pocket ID.md>) is its sign-in once `./homelab sso setup` has run (`OPENID_PROVIDER_URL`, `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `ENABLE_OAUTH_SIGNUP`, and the rest in `data/sso/open-webui.env`); accounts with the same email are merged.
- [Home Assistant](<../household/Home Assistant.md>) has its own Ollama integration if you want a local model behind its voice assistant.
- `.env`: `OPEN_WEBUI_PORT` (default `3080`), `OPEN_WEBUI_SECRET_KEY`, and `HOMELAB_DOMAIN` for `WEBUI_URL`.

## Tinkering ideas

- Household manuals: Workspace › Knowledge › new collection, upload the PDFs, then ask "how do I descale the coffee machine" with `#` and the collection.
- Try other models: `ollama pull qwen2.5`, `ollama pull gemma3`, or a vision model such as `llama3.2-vision` to ask about photos.
- Voice: the microphone button transcribes with a local Whisper model (Admin Panel › Settings › Audio).
- Web search: Admin Panel › Settings › Web Search can add results to answers; it sends your queries to the search provider you choose.
- Cloud models side by side: Admin Panel › Settings › Connections takes any OpenAI-compatible API key, if you want a bigger model now and then.
- Tools and functions from the community (Workspace › Tools) run as code inside the container: read them before installing.

## Useful commands

Follow the log, restart, check which models Ollama has and which are loaded, and check that the container can reach Ollama:

```zsh
./homelab logs open-webui -f
./homelab compose open-webui restart open-webui
ollama list
ollama ps
curl -s http://localhost:11434/api/tags
./homelab compose open-webui exec open-webui curl -s http://host.docker.internal:11434/api/version
```

## API

- **Key:** API keys are off by default. Turn them on in Admin Panel › Settings › General, then make one under Settings › Account › API Keys.
- **Base URL:** `http://localhost:3080/api`, with `Authorization: Bearer <key>`. It is OpenAI-compatible, so OpenAI clients work against it.
- **List models:** `curl -s -H "Authorization: Bearer YOUR_KEY" http://localhost:3080/api/models`
- **Chat:** `curl -s -H "Authorization: Bearer YOUR_KEY" -H "Content-Type: application/json" -d '{"model":"llama3.2","messages":[{"role":"user","content":"Hello"}]}' http://localhost:3080/api/chat/completions`

## Learn more

- [Open WebUI documentation](https://docs.openwebui.com)
- [GitHub: open-webui/open-webui](https://github.com/open-webui/open-webui) (source of the `ghcr.io/open-webui/open-webui` image)
- [ollama.com](https://ollama.com) (model library) and [GitHub: ollama/ollama](https://github.com/ollama/ollama)

## Backup

`data/appdata/open-webui` (accounts, chats, settings) is covered by the AppData job. Models live in Ollama's own folder (`~/.ollama`) and can be pulled again.

## Troubleshooting

- **"Ollama not reachable":** Ollama is not running natively (`brew services start ollama`), or it only listens on localhost, which `host.docker.internal` reaches on OrbStack.
- **Slow answers:** pick a smaller model; 16 GB of memory suits 3-8B models.
