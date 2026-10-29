---
version: 0.15.0
---

# Dawarich

Where you have been, from the phone's location history, on a map with trips and stats.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `dawarich` in `stacks/dawarich/compose.yaml` (project `homelab_dawarich`) |
| Image | `docker.io/freikin/dawarich:latest` |
| Category | Cloud & Files |
| Starts with `./homelab up` | No: optional, `./homelab install dawarich` |
| Address | https://location.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:3050 (`DAWARICH_PORT`) |
| Depends on | `dawarich-db`, `dawarich-redis`, `dawarich-sidekiq` |
| Helpers | `dawarich-db` `docker.io/postgis/postgis:17-3.5-alpine`, dumped daily by `./homelab backup`<br>`dawarich-redis` `docker.io/valkey/valkey:9-alpine`<br>`dawarich-sidekiq` `docker.io/freikin/dawarich:latest` |
| Data | `dawarich-public (volume)` → `/var/app/public`<br>`appdata/dawarich/watched` → `/var/app/tmp/imports/watched`<br>`appdata/dawarich/storage` → `/var/app/storage` |
| Updates | By hand. Dawarich changes quickly and some releases need steps from their notes; update by hand with ./homelab update dawarich dawarich-sidekiq |
| Also known as | google-timeline, location-history, owntracks |
<!-- END homelab:generated -->

## Purpose

Where you have been, kept on this Mac instead of Google's servers: every point the phone records, on a map, with trips, places you visited, countries and cities, distance per month, and a year in review. It replaces Google Maps Timeline (which moved onto the phone and no longer keeps history in the cloud) and works with Owntracks, Overland, or Dawarich's own iOS app.

## Setup

1. `./homelab install dawarich`. The first start runs the database migrations and takes a few minutes; `./homelab logs dawarich -f` shows when Rails is listening.
2. Open http://localhost:3050. Sign in with `demo@dawarich.app` / `password`, then change the email and password at once (Account settings).
3. Account settings › API key: copy it.
4. On the phone, install the Dawarich app (iOS) or Overland or Owntracks, and point it at the address you open Dawarich with, plus the key. Away from home that means Tailscale (Home mode) or the domain through the tunnel; Dawarich is not published to the internet by default.
5. Bring your history: Imports › New import takes a Google Takeout (Records.json or the phone's Timeline export), GPX, GeoJSON, or Owntracks files.

## How it works

- A Ruby on Rails app (`dawarich`) with a Sidekiq worker (`dawarich-sidekiq`) that does the heavy lifting: imports, reverse geocoding, and working out visits, trips, and stats in the background.
- Points live in PostgreSQL with PostGIS (`dawarich-db`), which answers the map's "which points fall in this area" questions. Redis (`dawarich-redis`, Valkey here) is the job queue.
- `STORE_GEODATA` keeps reverse-geocoding results so each place is looked up once. Without a geocoding service of your own, Dawarich uses a public one with a rate limit, so naming thousands of places takes a while.
- `APPLICATION_HOSTS` lists the names Rails answers to: localhost, `location.<domain>`, and the tailnet name. A name not on the list gets "Blocked host".
- It runs Dawarich's default `development` mode, as their compose file does.

## Where things live

| What | Where |
|---|---|
| Location points, users, trips | the `dawarich-pgdata` volume (PostGIS 17) |
| Daily database dump | `recovery-staging/databases/dawarich-db` |
| Uploaded imports and exports | `appdata/dawarich/storage` (`/var/app/storage`) |
| Watched import folder | `appdata/dawarich/watched` (`/var/app/tmp/imports/watched`) |
| Built web assets | the `dawarich-public` volume (rebuilt from the image) |

## Everyday use

- Map: pick a day, week, or range; layers show the route, points, a heatmap, visited cities, and fog of war.
- Trips: name a date range ("Lisbon 2025") and Dawarich draws it with its distance and photos from [Immich](<Immich.md>) once connected.
- Visits: places you stayed at; confirm or rename the suggestions.
- Stats: distance, countries, and cities per month and year.
- Exports: GeoJSON or GPX of any range.

## Connects to

- [Immich](<Immich.md>): Account settings › Integrations takes Immich's address (`http://immich-server:2283` from inside Docker) and an Immich API key, and shows your photos on the map and in trips.
- [Tailscale](<../network/Tailscale.md>): the phone keeps reporting away from home without publishing Dawarich.
- [Duplicati](<../system/Duplicati.md>): the Databases job keeps the dump; the Stack Data job keeps `appdata/dawarich`.

## Tinkering ideas

- Drop GPX files from a bike computer or watch into `appdata/dawarich/watched/<your email>/` and Dawarich imports them by itself.
- Connect Immich so trips show the photos taken there.
- Areas: draw home, work, and the gym, and see time spent in each.
- Turn on the public share of a single trip for family.
- Point reverse geocoding at your own Photon instance for faster place names (`PHOTON_API_HOST`).

## Useful commands

The app and worker logs, a Rails console, and the size of the history:

```zsh
./homelab logs dawarich -f
./homelab logs dawarich-sidekiq -f
./homelab compose dawarich exec dawarich bin/rails console
./homelab compose dawarich exec dawarich-db psql -U postgres -d dawarich_development -c 'select count(*) from points'
./homelab update dawarich dawarich-sidekiq
```

## API

Each user's key is under Account settings. The base URL is `http://localhost:3050/api/v1/`; pass the key as `api_key` or a `Bearer` header. Interactive docs are at http://localhost:3050/api-docs.

```zsh
curl -s "http://localhost:3050/api/v1/points?api_key=YOUR_KEY&start_at=2025-01-01&end_at=2025-01-02" | head -c 400
```

## Learn more

- [Dawarich](https://dawarich.app) and its [documentation](https://dawarich.app/docs/intro)
- [Dawarich on GitHub](https://github.com/Freika/dawarich)

## Backup

The nightly backup dumps the database (`dawarich-db`, every location point), and the Stack Data job keeps `appdata/dawarich` (imports and exports). Redis and the public assets rebuild themselves. Keep your original Google Takeout too: it can always be imported again.

## Troubleshooting

- **"Blocked host" in the browser:** you opened it at a name not in `APPLICATION_HOSTS`; use localhost, `location.<domain>`, or the tailnet name, or add yours in `stacks/dawarich/compose.yaml`.
- **The first start shows nothing for minutes:** migrations run first; watch `./homelab logs dawarich -f`.
- **Imports sit at "processing":** the worker is down; `./homelab status`, then `./homelab logs dawarich-sidekiq`.
- **Slow on Apple Silicon:** the PostGIS image is Intel-only and runs under Rosetta; it is fine for one household's history.
- **After an update the app will not start:** read Dawarich's release notes for manual steps, or go back with the previous image tag.
