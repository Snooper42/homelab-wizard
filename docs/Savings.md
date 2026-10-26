---
version: 0.9.0-beta
---

# Savings

What the homelab could replace if the household used it to the full: every paid service each app can stand in for, with its monthly and annual price, organised by stack (the same categories as `services/`).

This is the full-replacement picture. Each saving is tagged with what it takes to get it, so you can see how much is automatic and how much depends on owning the media.

## Summary

| Stack | Services replaced | Monthly | Annual plan | Paid monthly for a year |
|---|---:|---:|---:|---:|
| Network | 2 | $11.99 | $115.90 | $143.88 |
| Security | 4 | $47.98 | $459.87 | $575.76 |
| System | 2 | $16.00 | $183.00 | $192.00 |
| Cloud & Files | 3 | $29.98 | $323.76 | $359.76 |
| Documents | 5 | $74.97 | $697.75 | $899.64 |
| Finance | 3 | $33.31 | $248.99 | $399.72 |
| Media | 14 | $205.82 | $2,137.94 | $2,469.84 |
| Media Automation | 1 | $5.00 | $60.00 | $60.00 |
| Household | 4 | $17.19 | $159.87 | $206.28 |
| **Everything** | **38** | **$442.24** | **$4,387.08** | **$5,306.88** |
| Baseline apps only (no optional apps) | 24 | $324.76 | $3,291.58 | $3,897.12 |

Used to the full, the homelab replaces about **$4,387 a year** in subscriptions, or **$5,307** at month-to-month prices. After running costs (about $36 a year) that is roughly **$4,351 a year**.

### By kind of saving

| Kind | What it means | Services | Annual plan |
|---|---|---:|---:|
| Direct | The app does the same job; the saving is real as soon as you switch | 15 | $1,376.39 |
| Library | Needs media you own (films, music, books); the app replaces the service's player and catalogue | 12 | $2,027.96 |
| Equivalent | A paid product with the same function that a household may not otherwise buy | 11 | $982.73 |

**How to read the numbers**

- **Monthly**: the month-to-month price. Marked † where the service only bills yearly; the figure is the annual price ÷ 12.
- **Annual plan**: the cheapest way to pay for a year (an annual plan where one exists, otherwise 12 × monthly). The headline totals use this column.
- **Paid monthly for a year**: 12 × Monthly, what a year costs without an annual commitment.
- **Runs**: Baseline apps start with `./homelab up`; Optional apps need `./homelab install <app>` first; Native is Jellyfin, the Mac app.

## Network

| App | Runs | Replaces | Kind | Monthly | Annual plan | Condition |
|---|---|---|---|---:|---:|---|
| [AdGuard Home](<../services/network/AdGuard Home.md>) | Baseline | NextDNS Pro | Direct | $1.99 | $19.90 | Every device uses 192.168.1.10 for DNS, or the tailnet's DNS setting points at it |
| [Cloudflare Tunnel](<../services/network/Cloudflare Tunnel.md>) + [Nginx Proxy Manager](<../services/network/Nginx Proxy Manager.md>) | Baseline | ngrok Hobbyist | Equivalent | $10.00 | $96.00 | Public apps reach you through your own tunnel and proxy instead of a paid tunnel service |
| **Subtotal** | | | | **$11.99** | **$115.90** | |

Not counted: Gluetun (needs your existing ProtonVPN plan); Ad blocking on the tailnet (it carries DNS to AdGuard Home, already counted against NextDNS Pro); Tailscale (its Personal plan is free, and the homelab uses that plan rather than replacing it); Speedtest Tracker (no consumer service sells scheduled speed tests with a history).

## Security

| App | Runs | Replaces | Kind | Monthly | Annual plan | Condition |
|---|---|---|---|---:|---:|---|
| [Vaultwarden](<../services/security/Vaultwarden.md>) | Baseline | 1Password Families | Direct | $7.99 | $71.88 | Everyone's passwords live in Vaultwarden (Bitwarden Families would be $47.88) |
| [Uptime Kuma](<../services/security/Uptime Kuma.md>) | Baseline | UptimeRobot Solo | Equivalent | $10.00 | $108.00 | Monitors set up as in [Monitoring](<Monitoring.md>) |
| [ntfy](<../services/security/ntfy.md>) | Baseline | Pushbullet Pro | Equivalent | $4.99 | $39.99 | Alerts and pushes go through ntfy |
| [CrowdSec](<../services/security/CrowdSec.md>) | Baseline | Cloudflare Pro (WAF) | Equivalent | $25.00 | $240.00 | CrowdSec and the proxy's bouncer block attacks on public apps, the job of a paid web application firewall |
| **Subtotal** | | | | **$47.98** | **$459.87** | |

UptimeRobot's Solo price varies by source; some list $13 a month or $144 a year after a mid-2026 change.

Not counted: Pocket ID (sign-in services for a household are free; for businesses they are priced per user).

## System

| App | Runs | Replaces | Kind | Monthly | Annual plan | Condition |
|---|---|---|---|---:|---:|---|
| [Duplicati](<../services/system/Duplicati.md>) | Baseline | Backblaze Personal Backup | Direct | $9.00 | $99.00 | Backups run nightly and pass the monthly restore test; storage stays on your Proton Drive plan |
| [Dozzle](<../services/system/Dozzle.md>) | Optional | Papertrail (paid plan) | Equivalent | $7.00 | $84.00 | Container logs are read and searched in Dozzle instead of a hosted log service; counted at 12 × monthly |
| **Subtotal** | | | | **$16.00** | **$183.00** | |
| Baseline apps only | | | | $9.00 | $99.00 | |

Not counted: Watchtower; the Phone companion (it shows the homelab rather than replacing a service); Homarr and Homepage (start pages have free commercial equivalents).

## Cloud & Files

| App | Runs | Replaces | Kind | Monthly | Annual plan | Condition |
|---|---|---|---|---:|---:|---|
| [File Browser](<../services/cloud and files/File Browser.md>) | Optional | Dropbox Plus | Equivalent | $11.99 | $119.88 | Files are shared from the media drive instead of cloud storage |
| [Immich](<../services/cloud and files/Immich.md>) | Baseline | iCloud+ 2 TB | Direct | $9.99 | $119.88 | Phones back up photos to Immich instead of iCloud Photos; no annual plan exists |
| [PsiTransfer](<../services/cloud and files/PsiTransfer.md>) | Optional | WeTransfer Starter | Equivalent | $8.00 | $84.00 | Large files are sent from the homelab instead of a transfer service ($7 a month billed yearly) |
| **Subtotal** | | | | **$29.98** | **$323.76** | |
| Baseline apps only | | | | $9.99 | $119.88 | |

Not counted: Syncthing (the paid sync services it resembles are counted once, against File Browser, and Resilio Sync Home Pro is a one-off licence, not a subscription); Baikal (calendar and contact sync is free with iCloud and Google); PairDrop (AirDrop and Quick Share are free); Dawarich (Google Maps Timeline is free).

## Documents

| App | Runs | Replaces | Kind | Monthly | Annual plan | Condition |
|---|---|---|---|---:|---:|---|
| [Paperless-ngx](<../services/documents/Paperless-ngx.md>) | Baseline | Evernote Advanced | Direct | $24.99 | $249.99 | Documents are scanned into Paperless (Advanced is Evernote's tier without a note cap) |
| [Stirling PDF](<../services/documents/Stirling PDF.md>) | Optional | Adobe Acrobat Pro | Direct | $29.99 | $239.88 | OCR, redaction, comparing, and signing are done in Stirling PDF |
| [FreshRSS](<../services/documents/FreshRSS.md>) | Optional | Feedly Pro | Direct | $8.00 | $72.00 | Feeds are read through FreshRSS |
| [Karakeep](<../services/documents/Karakeep.md>) | Optional | Raindrop.io Pro | Direct | $3.00 | $28.00 | Bookmarks and read-later live in Karakeep, with its full-text search and page archives |
| [Linkwarden](<../services/documents/Linkwarden.md>) | Optional | Raindrop.io Pro | Direct | $3.00 | $28.00 | Shared bookmark collections live in Linkwarden, each page kept; with Karakeep too, Raindrop.io is counted once, here and on Status |
| [Changedetection.io](<../services/documents/Changedetection.io.md>) | Optional | changedetection.io (hosted) | Direct | $8.99 | $107.88 | Pages are watched by your own copy instead of the hosted service; no annual plan exists |
| **Subtotal** | | | | **$74.97** | **$697.75** | |
| Baseline apps only | | | | $24.99 | $249.99 | |

Raindrop.io Pro is counted once in the subtotal, though Karakeep and Linkwarden can each replace it (Linkwarden's own hosted plan is $3 a month per person too).

Not counted: Kiwix (Wikipedia and the other libraries are free online; it keeps them readable without the internet); Open WebUI (local models are a private assistant, not a ChatGPT Plus replacement); Memos (note-taking is counted once, against Paperless-ngx); Docmost (Notion's free plan covers a household wiki).

## Finance

| App | Runs | Replaces | Kind | Monthly | Annual plan | Condition |
|---|---|---|---|---:|---:|---|
| [MoneyMatter](<../services/finance/MoneyMatter.md>) | Baseline | YNAB | Direct | $14.99 | $109.00 | The budget lives in MoneyMatter |
| [Actual Budget](<../services/finance/Actual Budget.md>) | Optional | YNAB | Direct | $14.99 | $109.00 | The budget lives in Actual Budget, an envelope budget like YNAB's; with MoneyMatter too, YNAB is counted once, here and on Status |
| [Firefly III](<../services/finance/Firefly III.md>) | Optional | Monarch Money Core | Equivalent | $14.99 | $99.99 | The household's accounts and budgets are kept in Firefly III instead of a hosted tracker (bank files come in through its importer, not a live bank sync) |
| [Ghostfolio](<../services/finance/Ghostfolio.md>) | Optional | Ghostfolio Premium | Direct | $3.33 † | $40.00 | Investments are tracked in your own copy instead of the hosted one (market data comes from free sources) |
| **Subtotal** | | | | **$33.31** | **$248.99** | |
| Baseline apps only | | | | $14.99 | $109.00 | |

YNAB is counted once in the subtotal, though two apps can replace it. Goodbudget Premium, the closest envelope app, is $10 a month or $80 a year.

Not counted: Wallos (it finds savings rather than replacing a paid service; trackers such as Rocket Money bundle it with other features).

## Media

| App | Runs | Replaces | Kind | Monthly | Annual plan | Condition |
|---|---|---|---|---:|---:|---|
| [Jellyfin](<../services/media/Jellyfin.md>) | Native | Plex Pass | Direct | $6.99 | $69.99 | Jellyfin is the media server |
| [Jellyfin](<../services/media/Jellyfin.md>) | Native | Netflix Standard | Library | $19.99 | $239.88 | Your own library; no annual plan exists |
| [Jellyfin](<../services/media/Jellyfin.md>) | Native | Hulu (No Ads) | Library | $18.99 | $227.88 | Your own library; no annual plan exists |
| [Jellyfin](<../services/media/Jellyfin.md>) | Native | Disney+ Premium | Library | $21.49 | $214.99 | Your own library |
| [Jellyfin](<../services/media/Jellyfin.md>) | Native | HBO Max Standard | Library | $18.49 | $184.99 | Your own library |
| [Jellyfin](<../services/media/Jellyfin.md>) | Native | Peacock Premium Plus | Library | $19.99 | $199.99 | Your own library |
| [Jellyfin](<../services/media/Jellyfin.md>) | Native | Paramount+ Premium | Library | $13.99 | $139.99 | Your own library |
| [Jellyfin](<../services/media/Jellyfin.md>) | Native | Apple TV | Library | $14.99 | $119.00 | Your own library |
| [Navidrome](<../services/media/Navidrome.md>) + [Feishin](<../services/media/Feishin.md>) | Baseline | Spotify Premium Family | Library | $21.99 | $263.88 | Your music library covers what the household plays; no annual plan exists |
| [Audiobookshelf](<../services/media/Audiobookshelf.md>) | Baseline | Audible Premium Plus | Library | $14.95 | $149.50 | Audiobooks you own (for example DRM-free purchases) |
| [Audiobookshelf](<../services/media/Audiobookshelf.md>) | Baseline | Pocket Casts Plus | Direct | $3.99 | $39.99 | Podcasts sync across devices through Audiobookshelf |
| [Calibre-Web](<../services/media/Calibre-Web.md>) | Baseline | Kindle Unlimited | Library | $11.99 | $143.88 | Reading comes from your own e-book library; counted at 12 × monthly |
| [Komga](<../services/media/Komga.md>) | Baseline | Marvel Unlimited | Library | $9.99 | $68.99 | Comics come from your own collection |
| [Komga](<../services/media/Komga.md>) | Baseline | DC Universe Infinite | Library | $7.99 | $74.99 | Comics come from your own collection |
| **Subtotal** | | | | **$205.82** | **$2,137.94** | |

**Streaming video.** Jellyfin with a library of films and shows you own (ripped discs, DRM-free purchases, home video) covers what the seven streaming services would provide: $1,327 a year on their own. Drop only the services your library actually covers; the rows are independent, so the total shrinks one row at a time.

Not counted: Kavita (optional; it overlaps Calibre-Web and Komga, so counting it would count the same saving twice); RomM (no subscription sells a library of games you own).

## Media Automation

| App | Runs | Replaces | Kind | Monthly | Annual plan | Condition |
|---|---|---|---|---:|---:|---|
| [Sonarr](<../services/media automation/Sonarr.md>) + [Radarr](<../services/media automation/Radarr.md>) + [Seerr](<../services/media automation/Seerr.md>) | Optional | Trakt VIP | Equivalent | $5.00 † | $60.00 | Sonarr and Radarr calendars and Seerr's watchlist do the tracking and release alerts |
| **Subtotal** | | | | **$5.00** | **$60.00** | |

These apps keep the Media stack's library organised: they track series and films, fetch subtitles, and take requests. Their value shows up in the Media stack, where the streaming services are counted once against Jellyfin. No saving is claimed for what the download apps fetch, since that would mean pricing content rather than software.

Not counted: Prowlarr, Lidarr, Bazarr, LazyLibrarian, qBittorrent, and FlareSolverr (they feed the library rather than stand in for a subscription).

## Household

| App | Runs | Replaces | Kind | Monthly | Annual plan | Condition |
|---|---|---|---|---:|---:|---|
| [Mealie](<../services/household/Mealie.md>) | Optional | Plan to Eat | Direct | $5.95 | $49.00 | Recipes and meal plans live in Mealie |
| [Tandoor](<../services/household/Tandoor.md>) | Optional | Plan to Eat | Direct | $5.95 | $49.00 | Recipes, meal plans, and shopping lists live in Tandoor; with Mealie too, Plan to Eat is counted once, here and on Status |
| [Vikunja](<../services/household/Vikunja.md>) | Optional | Todoist Pro | Direct | $7.00 | $60.00 | To-dos and projects live in Vikunja |
| [Grocy](<../services/household/Grocy.md>) | Optional | AnyList Complete (household) | Equivalent | $1.25 † | $14.99 | Shopping lists and what is in the cupboards are kept in Grocy |
| [Home Assistant](<../services/household/Home Assistant.md>) | Optional | Homey Premium | Equivalent | $2.99 | $35.88 | Devices and automations run in Home Assistant instead of a hosted smart-home platform (Homey's free tier stops at 5 devices); no annual plan exists |
| **Subtotal** | | | | **$17.19** | **$159.87** | |

Plan to Eat is counted once in the subtotal, though Mealie and Tandoor can each replace it.

Home Assistant is counted against Homey Premium, the subscription for a hosted hub with no device cap; the big-brand hubs (Google Home, Alexa, Apple Home) have free apps, so the saving is Equivalent, not Direct.

Not counted: Homebox (home inventory apps are free for a household, or priced for businesses).

## What the homelab costs to run

| Cost | Per year | Note |
|---|---:|---|
| Domain (`example.com`, Cloudflare at cost) | about $11 | |
| Electricity | about $25 | About 15 W average for the Mac, 131 kWh a year at about $0.18 per kWh |
| Proton Drive, ProtonVPN | not counted | Existing plans, paid for anyway |
| The Mac and the media drive | not counted | Already owned |
| Buying the media in your library | not counted | One-off purchases instead of rentals |
| **Total** | **about $36** | |

| | Per year |
|---|---:|
| Everything, annual plans | $4,387.08 |
| Minus running costs | −$36 |
| **Net, everything** | **about $4,351** |
| **Net, baseline apps only** | **about $3,256** |

## Over time

Every night the backup job records what the running apps replace that day (the figure Status shows) in `data/savings-history.json`, keeping about a year. The app's Status tile draws the last 90 days and the change since the first of them, so adding or removing apps shows up the next morning.

## Keeping this page current

- Prices are US list prices before tax, checked in October 2026 from vendor pricing as reported by current pricing guides, news coverage of price changes, and app-store listings. Where sources disagreed, the lower figure was used.
- Streaming prices change often (several rose in 2026). Check them once a year and update the tables and the summary.
- When you slot in a service that replaces a paid one, add a row to its stack and update the summary ([Contributing](<Contributing.md>)).

## Price sources

- NextDNS: [TechRadar review](https://www.techradar.com/reviews/nextdns)
- Backblaze: [Cloudwards](https://www.cloudwards.net/backblaze-pricing/)
- ngrok: [toolsurf](https://www.toolsurf.com/ngrok-pricing-in-2025-every-plan-explained-free-personal-pro-enterprise-2026-plans-features-best-deals-compared/), [PricingSaaS](https://pricingsaas.com/companies/ngrok)
- 1Password Families: [9to5Google](https://9to5google.com/2026/02/24/1passwords-annual-subscription-plans-are-getting-a-price-hike-next-month/), [Ubergizmo](https://www.ubergizmo.com/2026/02/1password-price-increase/)
- Bitwarden Families: [tech-insider.org](https://tech-insider.org/ca/bitwarden-families-plan-setup-2026/)
- UptimeRobot: [Notifier](https://notifier.so/guides/uptimerobot-pricing-2026/), [Hyperping](https://hyperping.com/blog/uptimerobot-pricing)
- Pushbullet: [Fonearena](https://www.fonearena.com/blog/164995/pushbullet-introduces-optional-pro-account-costs-us39-99-per-year.html/amp)
- Cloudflare Pro: [CDNsun](https://blog.cdnsun.com/cloudflare-pricing/)
- Evernote: [eesel.ai](https://www.eesel.ai/blog/evernote-pricing), [harbor.my](https://harbor.my/blog/evernote-price-history/)
- YNAB: [getfinny](https://getfinny.app/blog/ynab-pricing-2026)
- Monarch Money: [getfinny](https://getfinny.app/blog/monarch-money-pricing-2026), [CostBench](https://www.costbench.com/software/personal-finance/monarch-money/)
- Goodbudget: [Goodbudget](https://goodbudget.com/?p=20645), [NerdWallet](https://www.nerdwallet.com/finance/learn/goodbudget-app-review)
- Adobe Acrobat Pro: [Xodo](https://www.xodo.com/blog/adobe-acrobat-pricing-explained), [thebusinessdive](https://thebusinessdive.com/adobe-acrobat-pricing)
- Dropbox: [Internxt](https://blog.internxt.com/dropbox-pricing/)
- Feedly: [Feeder](https://feeder.co/knowledge-base/rss-basics/feedly-vs-feedbin/)
- Plan to Eat: [Plan to Eat help](https://learn.plantoeat.com/help/how-much-does-plan-to-eat-cost)
- Todoist Pro: [Routine](https://routine.co/blog/posts/todoist-pricing), [Morgen](https://morgen.so/blog-posts/todoist-pricing)
- iCloud+: [bestcloudstorageguide.com](https://bestcloudstorageguide.com/blog/icloud-pricing-2026-pricing-guide-2026)
- Plex Pass: [9to5Mac](https://9to5mac.com/2026/05/19/plex-increasing-lifetime-plex-pass-cost-to-whopping-750/)
- Netflix: [FOX 5 New York](https://www.fox5ny.com/news/netflix-raising-prices-again-all-plans-how-much-more-youll-be-paying)
- Hulu: [agoodmovietowatch](https://agoodmovietowatch.com/platforms/hulu-review/)
- Disney+: [Gadget Review](https://www.gadgetreview.com/?p=414004), [smarttvs.org](https://smarttvs.org/disney-plus-hulu-price-increase-2026/)
- HBO Max: [TV Guide](https://www.tvguide.com/news/hbo-max-price-and-bundles/), [smarttvs.org](https://smarttvs.org/hbo-max-plans-2026/)
- Peacock: [Droid Life](https://www.droid-life.com/2026/08/18/peacock-raises-prices/)
- Paramount+: [Clark](https://clark.com/streaming-tv/paramount-plus-pricing-2026/)
- Apple TV: [TheWrap](https://www.thewrap.com/media-platforms/streaming/apple-tv-price-increase-per-month/)
- Spotify: [documentarytube](https://www.documentarytube.com/blog/spotify-raises-premium-prices-again-what-u-s-subscribers-will-pay-in-2026/)
- Audible: [NerdWallet](https://www.nerdwallet.com/finance/learn/how-much-does-audible-cost)
- Pocket Casts: [App Store](https://apps.apple.com/us/app/pocket-casts-podcast-player/id414834813)
- Kindle Unlimited: [subger](https://subger.com/en/service/kindle-unlimited)
- Marvel Unlimited: [App Pricing Lab](https://www.apppricinglab.com/app/apple/607205403)
- DC Universe Infinite: [App Pricing Lab](https://apppricinglab.com/iap/apple/1329018000)
- Trakt VIP: [AlternativeTo](https://alternativeto.net/news/2025/5/trakt-announces-all-vip-renewals-will-switch-to-a-new-standard-rate-doubling-prices/)
- Raindrop.io Pro: [Raindrop.io](https://raindrop.io/pro), [ContextBolt](https://contextbolt.com/blog/raindrop-pricing/)
- Linkwarden Cloud: [Linkwarden](https://linkwarden.app/pricing)
- AnyList Complete: [AnyList](https://www.anylist.com/premium), [App Pricing Lab](https://apppricinglab.com/app/apple/522167641)
- Papertrail: [Software Advice](https://www.softwareadvice.com/product/144190-Papertrail/), [CostBench](https://costbench.com/software/log-management/papertrail/alternatives/) (some list consumption pricing at $5 per GB instead; the lowest fixed plan was used)
- Homey Premium: [Homey](https://homey.app/premium)
- Ghostfolio Premium: [Gappsy](https://gappsy.com/tools/ghostfolio/), [FindMyMoat](https://www.findmymoat.com/vs/ghostfolio-vs-myinvestor) (some list $48 a year)
- changedetection.io: [fitgap](https://us.fitgap.com/products/changedetection-io), [the project's documentation](https://mintlify.com/dgtlmoon/changedetection.io/introduction) (older pages list $6.99)
- WeTransfer: [WeTransfer help center](https://getcomics.wetransfer.com/help-center/subscriptions/plan-limits), [goodsign.io](https://goodsign.io/blog/wetransfer-pricing.md), [PricingSaaS](https://pricingsaas.com/companies/wetransfer)
