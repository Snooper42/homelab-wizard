---
version: 0.11.0
---

# FlareSolverr

A helper for Prowlarr: it opens indexer sites in a headless browser to get past Cloudflare challenges.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `flaresolverr` in `compose/media-automation.yaml` (project `homelab_media_automation`) |
| Image | `ghcr.io/flaresolverr/flaresolverr:latest` |
| Category | Media Automation |
| Starts with `./homelab up` | No: optional, `./homelab install flaresolverr` |
| Updates | Watchtower, nightly at 4 AM |
<!-- END homelab:generated -->

## Purpose

Some indexers sit behind Cloudflare's browser check. Prowlarr hands those requests to FlareSolverr at `http://flaresolverr:8191`.

## Setup

1. Installed with the *arr bundle (`./homelab install @arr`), or alone with `./homelab install flaresolverr`.
2. In Prowlarr: Settings > Indexers > add FlareSolverr, host `http://flaresolverr:8191`, tag `flaresolverr`.
3. Add the `flaresolverr` tag to each indexer that needs it.

## How it works

- FlareSolverr is a small Python web server that drives a headless Chromium browser. It has no web UI and no settings file.
- Prowlarr sends it a URL; FlareSolverr opens the page, waits for the Cloudflare check to pass, and returns the page together with its cookies and user agent to Prowlarr.
- It handles only the automatic browser check. It cannot solve CAPTCHAs, so an indexer that asks for one still fails.
- Each request starts a browser, so it uses a fair amount of memory and CPU while it works, and nothing while idle.
- It listens on port `8191` on the `homelab` Docker network only; the compose file publishes no port, so it is not reachable from this Mac's browser.

## Connects to

- [Prowlarr](<Prowlarr.md>) is its only client, through an indexer proxy at `http://flaresolverr:8191` and the `flaresolverr` tag.
- `./homelab wire` sets this up when Prowlarr and FlareSolverr both run: it creates the `flaresolverr` tag and the proxy. Tagging the indexers is still up to you.
- `.env`: only `TZ`.

## Tinkering ideas

- Prowlarr › Settings › Indexers › FlareSolverr: raise the request timeout if challenges time out on a slow site.
- Tag only the indexers that need it: every tagged request is far slower than a plain one.
- For more detail in its log while debugging, set `LOG_LEVEL: debug` in its `environment` in `compose/media-automation.yaml`, then `./homelab update flaresolverr`.

## Useful commands

FlareSolverr has no published port, so the checks run from inside the Prowlarr container. The first shows the version and that it is ready; the second solves a test page.

```zsh
./homelab logs flaresolverr -f
./homelab compose flaresolverr restart flaresolverr
./homelab compose prowlarr exec prowlarr curl -s http://flaresolverr:8191/
./homelab compose prowlarr exec prowlarr curl -s -X POST http://flaresolverr:8191/v1 -H 'Content-Type: application/json' -d '{"cmd":"request.get","url":"https://example.com","maxTimeout":60000}'
```

## API

There is no key. Send `POST /v1` with a JSON body naming a command (`request.get`, `request.post`, or the `sessions.*` commands) and a URL; the reply has the status, the page, and the cookies. The commands and options are listed in the project's README.

## Learn more

- [FlareSolverr on GitHub](https://github.com/FlareSolverr/FlareSolverr) (code, image, and documentation)

## Backup

Nothing: it keeps no state.

## Troubleshooting

Challenges change often and FlareSolverr breaks when they do. Check `./homelab logs flaresolverr`, then `./homelab update flaresolverr`. If it still fails, upstream usually has an open issue.
