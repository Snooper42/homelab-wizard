---
version: 0.1.0-alpha
---

# Mealie

Recipes and meal planning. Import a recipe from any website by its URL, plan the week, and build the shopping list.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `mealie` in `compose/household.yaml` (project `homelab_household`) |
| Image | `ghcr.io/mealie-recipes/mealie:latest` |
| Category | Household |
| Starts with `./homelab up` | No: optional, `./homelab install mealie` |
| Address | https://mealie.example.com (LAN, through Nginx Proxy Manager) |
| On this Mac | http://localhost:9000 (`MEALIE_PORT`) |
| Data | `data/appdata/mealie` → `/app/data` |
| Database dump | Daily by `./homelab backup` into `recovery-staging/databases/mealie` |
| Updates | Watchtower, nightly at 4 AM |
<!-- END homelab:generated -->

## Purpose

One family cookbook, with meal plans and shopping lists everyone can open.

## Setup

1. `./homelab install mealie`; with a domain, then `./homelab domain setup`.
2. Open `https://<TAILSCALE_HOST>:9000` in Home mode, or `https://mealie.example.com` with a domain, and sign in with the default admin, `changeme@example.com` / `MyPassword`. Change the email and password immediately.
3. Invite the family from the admin settings; open sign-up is off (`ALLOW_SIGNUP=false`).

## How it works

- A Python (FastAPI) backend with a Vue (Nuxt) web app, both on port 9000 in one container.
- Data is in a SQLite database, `mealie.db`, in `/app/data`; recipe images and assets are files in `recipes/`, one folder per recipe.
- Importing from a URL reads the recipe data most recipe sites publish in the page (schema.org), so ingredients, steps, times, and the photo come across cleanly.
- Users belong to a household within a group. Recipes are shared across the group; meal plans and shopping lists belong to the household.
- `BASE_URL` (`https://mealie.example.com`) is used for links in invitations and shared recipes; `ALLOW_SIGNUP=false` keeps the sign-up form closed.

## Where things live

| What | Where |
|---|---|
| Database | `data/appdata/mealie/mealie.db` → `/app/data/mealie.db` |
| Recipe images and assets | `data/appdata/mealie/recipes/` → `/app/data/recipes` |
| Mealie's own backups | `data/appdata/mealie/backups/` → `/app/data/backups` |
| User avatars | `data/appdata/mealie/users/` |
| Daily consistent copy | `recovery-staging/databases/mealie` (by `./homelab backup`) |

## Everyday use

- **Add a recipe:** **+** › Import from a URL, or create one by hand; bulk URL import takes a list of addresses.
- **Cook:** open a recipe, scale the servings, and use cook mode, which keeps the screen on with large steps.
- **Plan:** Meal Planner: put recipes on days, or let a random pick fill the week.
- **Shop:** Shopping Lists: add a recipe's ingredients in one go, then tick items off in the shop.
- **Organise:** tags, categories, and cookbooks (saved collections, for example "Weeknight dinners").
- **Phone:** add `https://mealie.example.com` to the home screen; it is a Progressive Web App.

## Connects to

- [Home Assistant](<Home Assistant.md>) has a Mealie integration that shows today's meal plan and the shopping lists as to-do lists.
- [Grocy](<Grocy.md>) also keeps a shopping list and recipes; pick one place for each so they do not drift apart.
- [Pocket ID](<../security/Pocket ID.md>) is its sign-in once `./homelab sso setup` has run (`OIDC_AUTH_ENABLED`, `OIDC_CONFIGURATION_URL`, `OIDC_CLIENT_ID`, and related settings in `data/sso/mealie.env`).
- [Duplicati](<../system/Duplicati.md>) backs up `data/appdata/mealie` in the AppData job.
- `.env`: `MEALIE_PORT` (default `9000`), `PUID`, `PGID`, `TZ`; `BASE_URL` comes from `HOMELAB_DOMAIN`.

## Tinkering ideas

- Ingredient parser: on a recipe, parse the ingredients into amount, unit, and food, so scaling and shopping lists combine them properly.
- Recipe timeline: mark a recipe as made and add a photo and a note, so you remember what worked.
- Import from other apps: the data migrations page takes exports from apps such as Paprika, Plan to Eat, Tandoor, and Nextcloud Cookbook.
- Notifiers: Mealie can send events (a new recipe, tomorrow's meal plan) to an Apprise URL such as `ntfys://` for [ntfy](<../security/ntfy.md>), from the group or household settings.
- Share one recipe with someone outside the household through a share link.

## Useful commands

Follow the log, restart, look at the data folder, check the version, and call the API with a token from your profile's API tokens page:

```zsh
./homelab logs mealie -f
./homelab compose mealie restart mealie
./homelab compose mealie exec mealie ls -la /app/data
curl -s http://localhost:9000/api/app/about
curl -s -H "Authorization: Bearer YOUR_TOKEN" http://localhost:9000/api/recipes
```

## API

- **Token:** your profile › API tokens › generate one.
- **Base URL:** `http://localhost:9000/api` on this Mac, or `https://mealie.example.com/api`, with `Authorization: Bearer <token>`.
- **Import a recipe by URL:** `curl -s -X POST -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" -d '{"url":"https://example.com/recipe"}' http://localhost:9000/api/recipes/create/url`
- **Reference:** the interactive API documentation at `http://localhost:9000/docs`.

## Learn more

- [Mealie documentation](https://docs.mealie.io)
- [GitHub: mealie-recipes/mealie](https://github.com/mealie-recipes/mealie) (source of the `ghcr.io/mealie-recipes/mealie` image)

## Backup

`data/appdata/mealie` (database, images) is in the Homelab AppData job. Mealie can also make its own backups (Admin > Backups).

## Troubleshooting

If recipe import fails, the site blocks scrapers; paste the recipe text instead.
