---
version: 0.13.0
---

# Beszel agent

Reads this machine and its containers for Beszel

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `beszel-agent` in `stacks/beszel/compose.yaml` (project `homelab_beszel`) |
| Image | `docker.io/henrygd/beszel-agent:latest` |
| Category | System |
| Starts with `./homelab up` | No: optional, `./homelab install beszel-agent` |
| Updates | Watchtower, nightly at 4 AM |
| Needs in .env | `BESZEL_AGENT_KEY` |
<!-- END homelab:generated -->

## Purpose

Reads this machine and its containers for [Beszel](<Beszel.md>): CPU, memory, disks, network, temperatures, and each container's share.

## Setup

It starts once `BESZEL_AGENT_KEY` is set: Beszel's note, Setup.

## How it works

- A small Go program on this machine's network (`network_mode: host`), listening on `BESZEL_AGENT_PORT` (45876) for the hub, which signs in with its SSH key; the agent only answers that key.
- It reads the containers through Docker's socket, read-only. On the host's network it cannot reach the socket proxy the other readers use by name.
- With Docker Desktop or OrbStack, "this machine" is the runtime's Linux VM (Beszel's note).

## Where things live

| What | Where |
|---|---|
| The hub's key it accepts | `BESZEL_AGENT_KEY` in `.env` |

## Everyday use

Nothing to do: Beszel shows what it reads.

## Connects to

- [Beszel](<Beszel.md>), which reads it.

## Tinkering ideas

- `EXTRA_FILESYSTEMS` (in Beszel's documentation) adds the media drive as its own disk on the graphs.

## Useful commands

```sh
./homelab logs beszel-agent -f
```

## Learn more

- [Beszel's agent documentation](https://beszel.dev/guide/agent-installation)

## Backup

Nothing of its own; its key is in `.env`.

## Troubleshooting

- **It restarts again and again:** `BESZEL_AGENT_KEY` is empty or not a key; copy it from Beszel's Add System.
