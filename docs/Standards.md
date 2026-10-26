---
version: 0.9.0-beta
---

# Standards

## Versioning

- The repository has one version, in `VERSION`, following Semantic Versioning. Every build of main adds a patch number to it (`0.9.5-beta`); [Releasing](<Releasing.md>) says how.
- Every note in `docs/` and `services/` carries the same version in its front matter. `./homelab validate` fails if one differs.
- A release bumps `VERSION`, every front matter `version`, and adds a section to `CHANGELOG.md`. Notes carry no change history of their own.

## Notes

- Front matter with `version`, then a title that matches the file name.
- Facts that come from the compose files (image, ports, addresses, data, backups, updates) live only in the generated block; never edit inside the markers.
- Service notes have hand-written sections after the generated block: Purpose, Setup, How it works, Where things live, Everyday use, Connects to, Tinkering ideas, Useful commands, API (where the app has one), Learn more, Backup, Troubleshooting.
- Write for the person fixing it at 2 AM: commands they can paste, expected results, and what to do if the result differs.
- Links use the `[Name](<Relative Path.md>)` form so spaces work in both GitHub and Obsidian.
- No secrets, public IP addresses, or MAC addresses in any note. The repository is public: use placeholders (`example.com`, `192.168.1.10`, `/Volumes/Media`), never a real household's names or data.

## Compose

- One service block per container, with `<<: *service` (restart, `no-new-privileges`, log rotation).
- The image tag says what you mean: `latest` for apps Watchtower updates, an exact version or digest for anything pinned.
- Every service states `com.centurylinklabs.watchtower.enable`.
- Ports: `${BIND_IP:-127.0.0.1}:${<APP>_PORT:-<default>}:<container port>`. Only the proxy and DNS use `LAN_BIND_IP`.
- Settings come from `.env` with a sensible default (`${TZ:-UTC}`); secrets have no default.
- `x-homelab` is always the last key of a service.
- Databases and caches use named volumes; user files use bind mounts under `data/appdata`, `appdata`, or the media drive.

## Code

- Go, formatted with `gofmt`, checked with `go vet`; `make check` must pass before a commit.
- Commands that change something preview first and need `--apply` (or a yes in a terminal).
- Secrets are read from `.env` at the moment they are needed and never printed.
- New behaviour comes with a test. End-to-end tests run the real CLI against a fake `docker`.
- `--json` output is a contract: every line carries `"schema": 1`, and `TestJSONContract` holds each type to the fields recorded in `internal/api/testdata/contract.json`. Adding a field is fine (`UPDATE_CONTRACT=1 go test ./internal/api` records it); removing or renaming one, or changing what it means, bumps the schema.

## Commits

- Small, focused commits with a message that says why.
- `CHANGELOG.md` gets a line for every change someone running the homelab would notice.
- CI runs `make check`, a `docker compose config` of every file, cross-builds of the CLI for macOS, Linux, and Windows, the desktop app's build and tests, and `make frontend-check` on every push.
