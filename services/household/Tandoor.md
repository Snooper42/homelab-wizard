---
version: 0.12.0
---

# Tandoor

Recipes with meal planning, shopping lists, and nutrition

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `tandoor` in `stacks/tandoor/compose.yaml` (project `homelab_tandoor`) |
| Image | `docker.io/vabene1111/recipes:latest` |
| Category | Household |
| Starts with `./homelab up` | No: optional, `./homelab install tandoor` |
| Address | https://recipes.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:8093 (`TANDOOR_PORT`) |
| Depends on | `tandoor-db` |
| Helpers | `tandoor-db` `docker.io/library/postgres:18`, dumped daily by `./homelab backup` |
| Data | `tandoor-static (volume)` → `/opt/recipes/staticfiles`<br>`appdata/tandoor/media` → `/opt/recipes/mediafiles` |
| Updates | Watchtower, nightly at 4 AM |
| Also known as | tandoor-recipes |
<!-- END homelab:generated -->

## Purpose

The household's recipes in one place, with what Mealie leaves out: a meal plan by the week, a shopping list built from it and sorted by the shop's aisles, nutrition per serving from the ingredients, and recipes imported from almost any cooking site by its address. Pick one of [Mealie](<Mealie.md>) and Tandoor for the household; Mealie is simpler, Tandoor does more.

## Setup

1. `./homelab install tandoor`, then open it: `https://<TAILSCALE_HOST>:8093` in Home mode, `https://recipes.example.com` with a domain, or `http://localhost:8093` on this computer.
2. The first page makes the first account, which is the administrator; keep its password in Vaultwarden.
3. Create the household's *space* (its shared cookbook) when asked, then invite the others from the space's settings (**Members** › **Invite**), each with their own account.
4. **Import** a few recipes by their web address, or bring a whole collection over from Mealie, Paprika, Chowdown, or another app (**Import** › the app's export file).

## Away from home

In Home mode (the default), Tandoor is on the tailnet: it opens at home and away on every device signed in to Tailscale. With a domain, it is on the home network only; install Tailscale to reach it from anywhere, or set `public: true` in its `x-homelab` block and run `./homelab domain setup` again to publish it.

## How it works

- One container runs Tandoor (Django) behind its own nginx on port 80; PostgreSQL keeps the recipes, plans, lists, and accounts.
- Photos and files you upload are kept in `appdata/tandoor/media`; the web page's own files (`tandoor-static`) are rebuilt by every start.
- Each space is a separate cookbook with its own members, so a second household or a club can share the same Tandoor without seeing each other's recipes.
- Nutrition comes from the ingredients' foods (Tandoor's food database, or values you add), scaled to the recipe's servings.

## Where things live

| What | Where |
|---|---|
| Recipes, plans, lists, accounts | PostgreSQL in the `tandoor-pgdata` volume |
| Uploaded photos and files | `appdata/tandoor/media` → `/opt/recipes/mediafiles` |
| Daily database dump | `recovery-staging/databases/tandoor-db` (by `./homelab backup`) |

## Everyday use

- **Plan:** Meal Plan › drag recipes onto the week; **Add to shopping list** puts their ingredients on the list, merged and in aisle order.
- **Shop:** the shopping list on a phone, ticked off as you go; it updates for everyone at once.
- **Cook:** a recipe's page scales to the servings you need and keeps the screen on while you cook.
- **Collect:** **Import** with a recipe's web address, or the browser bookmarklet from Settings.

## Connects to

- [Mealie](<Mealie.md>), the simpler recipe app (pick one), and [Grocy](<Grocy.md>), for what is already in the cupboards.
- Tandoor's AI features (importing a recipe from a photo, for one) can use the Ollama on this computer, so recipes stay here: in its AI settings, an Ollama provider at `http://host.docker.internal:11434` (the model [Open WebUI](<../documents/Open WebUI.md>) uses works).
- `.env`: `TANDOOR_PORT` (default `8093`), `TANDOOR_URL`, `TANDOOR_SECRET_KEY` and `TANDOOR_DB_PASSWORD` (generated), `TANDOOR_DB_VERSION`.

## Tinkering ideas

- Supermarket categories (Settings › Shopping) in the order of your shop's aisles.
- Recipe books for each person's favourites, shared with the space.
- The API (below) to put the week's meals on [Homepage](<../system/Homepage.md>) or a wall screen.

## Useful commands

```sh
./homelab logs tandoor -f
./homelab compose tandoor restart tandoor
./homelab compose tandoor exec tandoor sh -c 'cd /opt/recipes && . venv/bin/activate && python manage.py changepassword <user>'
```

## API

The whole app is an API under `/api/` (its schema at `/api/schema/`, browsable at `/docs/api/`). Make a token under **Settings** › **API** and send it as `Authorization: Bearer <token>`; for example `curl -H "Authorization: Bearer <token>" http://localhost:8093/api/recipe/?query=soup`.

## Learn more

- [docs.tandoor.dev](https://docs.tandoor.dev)
- [GitHub: TandoorRecipes/recipes](https://github.com/TandoorRecipes/recipes)

## Backup

The nightly backup dumps the database (`tandoor-db`); the uploaded photos and files in `appdata/tandoor/media` are covered by the Stack Data job. Tandoor's own **Export** saves recipes as files for another app.

## Troubleshooting

- **400 Bad Request on every page:** an old `ALLOWED_HOSTS` setting; the homelab sets `*`, so `./homelab update tandoor` brings it back.
- **The page does not load at all, and its log says `socket() [::]:80 failed (97: Address family not supported by protocol)`:** IPv6 is turned off in this machine's kernel, and Tandoor's built-in nginx always listens on IPv6 too. Turn IPv6 back on (remove `ipv6.disable=1` from the kernel's settings), as Linux does by default.
- **Forms fail with "CSRF verification failed":** the address it is opened at differs from `TANDOOR_URL`; set it in Settings to that address and `./homelab update tandoor`.
- **Forgot the password:** the `changepassword` command above.
