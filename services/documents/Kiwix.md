---
version: 0.9.0-beta
---

# Kiwix

Wikipedia and other reference libraries, readable offline

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `kiwix` in `compose/documents.yaml` (project `homelab_documents`) |
| Image | `ghcr.io/kiwix/kiwix-serve:latest` |
| Category | Documents |
| Starts with `./homelab up` | No: optional, `./homelab install kiwix` |
| Address | https://kiwix.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:8098 (`KIWIX_PORT`) |
| Data | `data/appdata/kiwix` → `/library`<br>`/Volumes/Media/kiwix` → `/zim` |
| Updates | Watchtower, nightly at 4 AM |
| Also known as | wikipedia, offline-wikipedia |
<!-- END homelab:generated -->

## Purpose

Wikipedia, Wiktionary, Project Gutenberg's books, Stack Exchange sites, medical references, and other libraries, kept on the media drive and readable from every device at home, with no internet: for a power cut, a trip, or children who should read without the rest of the web. Each library is one ZIM file.

## Setup

1. `./homelab install kiwix`. It waits for the media drive, like the other apps that use it, and serves an empty library until you add a file.
2. Pick a library at [library.kiwix.org](https://library.kiwix.org) and download its `.zim` file into `kiwix` on the media drive (`MEDIA_ROOT/kiwix`, or `KIWIX_ZIM_ROOT` if you set it). All of English Wikipedia with pictures is over 100 GB; "nopic" and "mini" versions are much smaller.
3. `./homelab restart kiwix`: each start adds every `.zim` file in the folder to the library.
4. Open it (`http://localhost:8098`, or `https://kiwix.example.com` with a domain).

## How it works

- `kiwix-serve` in one container. Its library is the file `data/appdata/kiwix/library.xml` (the homelab puts an empty one there at install), which lists the ZIM files; it follows changes to that file while it runs.
- At each start, a line of shell before it adds every `/zim/*.zim` to the library with `kiwix-manage`, so dropping a file in the folder and restarting is enough.
- A ZIM file is compressed and indexed: articles open straight from it, and its own search works offline.

## Where things live

| What | Where |
|---|---|
| The libraries (ZIM files) | `MEDIA_ROOT/kiwix` on the media drive → `/zim` (or `KIWIX_ZIM_ROOT`) |
| The list of libraries | `data/appdata/kiwix/library.xml` → `/library/library.xml` |

## Everyday use

- **Read:** the home page lists each library; open one and use its search box, or the search across all of them at the top.
- **Update a library:** download the newer ZIM, delete the old one, and `./homelab restart kiwix`.
- **On a phone or laptop away from home:** the Kiwix apps for iOS, Android, macOS, Windows, and Linux read the same ZIM files directly from the device.

## Connects to

- [Homepage](<../system/Homepage.md>) and [Homarr](<../system/Homarr.md>) can link it like any other app.
- `.env`: `KIWIX_PORT` (default `8098`), and `KIWIX_ZIM_ROOT` to keep the files somewhere other than `MEDIA_ROOT/kiwix`.

## Tinkering ideas

- A "kids" library: Wikipedia for Schools (`wikipedia_en_for-schools`) is small and curated.
- Keep a medical library (WikiMed) and a survival or repair guide (iFixit) for a power cut.
- Offline documentation for the tools you use (DevDocs ZIMs).

## Useful commands

```sh
./homelab logs kiwix -f
./homelab restart kiwix
./homelab compose kiwix exec kiwix kiwix-manage /library/library.xml show
curl -s http://localhost:8098/catalog/v2/entries
```

## API

- `GET /catalog/v2/entries` lists the libraries (OPDS, an Atom feed); `GET /search?pattern=…` searches them. The reference is in [kiwix-serve's documentation](https://kiwix-tools.readthedocs.io/en/latest/kiwix-serve.html).

## Learn more

- [kiwix.org](https://kiwix.org) and [library.kiwix.org](https://library.kiwix.org)
- [GitHub: kiwix/kiwix-tools](https://github.com/kiwix/kiwix-tools)

## Backup

The ZIM files are not backed up: each can be downloaded again from library.kiwix.org, and they are large. `library.xml` is in `data/appdata/kiwix` and is rebuilt from the files at each start.

## Troubleshooting

- **A new library does not show:** the file's name must end in `.zim`, and Kiwix needs a restart (`./homelab restart kiwix`). A half-downloaded file is skipped; download it again.
- **It is not running:** the media drive is not mounted; `./homelab status` says it is waiting for it.
