---
version: 0.17.0
---

# Everyday tasks

What you do with the homelab once it runs: each in the app, then the same from a terminal in the homelab folder (`homelab.cmd` on Windows). New here? [The tour](<Tour.md>) shows each screen first.

## The common ones

| To… | In the app | In a terminal | More |
|---|---|---|---|
| Add an app | Choose apps › tick it › **Install** | `./homelab install <app>` | [Services](<Services.md>) |
| Open an app on a phone | Status › the app's page › **Open on a phone** (a QR code) | `./homelab status` lists the addresses | [Inventory](<Inventory.md>) |
| Put right what is down | Status › **Fix it** (the plan first) | `./homelab fix` | [Troubleshooting](<Troubleshooting.md>) |
| Read an app's log, in plain words | Status › the app's page › its log › **Explain this** | `./homelab logs <app> --explain` | [Monitoring](<Monitoring.md>) |
| Update an app now, or undo an update | The app's page › **Check for an update**, or **Roll back** | `./homelab update <app>`, `./homelab rollback <app>` | [Automation](<Automation.md#nightly-updates-the-background-agent>) |
| Pause the nightly updates | Status › *Nightly updates* › **Pause** | `./homelab updates pause` (and `resume`) | [Automation](<Automation.md>) |
| See what's left after each paycheck | **Finances** in the sidebar (on a phone too, once allowed in Settings › Phones) | — | [Phone companion](<../services/system/Phone companion.md>) |
| File a download into the right library, or free space | **Tidy Up** › Inbox › **Tidy up now**, or a library's tab | `./homelab media inbox --apply`, `./homelab media <library> scan` | [Tidy Up](<Tidy Up.md>) |
| Back up now, or prove a restore works | Backups › **Back up now**, **Test a restore** | `./homelab backup --apply`, `./homelab restore-test --auto` | [Backups](<Backups.md>) |
| Update Homelab Wizard and the homelab | **Update now** on the line at the top of the window | `./homelab upgrade` | [Upgrading](<Upgrading.md>) |
| Add someone in the household | Settings › **People** › **Add a person** | `./homelab person add "Anna Smith" --email anna@example.com` | [Pocket ID](<../services/security/Pocket ID.md>) |
| Pair a phone (the Homelab app, or its browser) | Settings › **Phones** › **Pair a phone**, then scan the QR code from the Homelab app | `./homelab phone pair` | [Phone companion](<../services/system/Phone companion.md>) |
| Use a domain of your own | Settings › `HOMELAB_DOMAIN`, then the new steps on Setup | `./homelab domain setup` | [Getting Started](<Getting Started.md#later-a-domain-of-your-own>) |
| Move to a new computer | Backups › **Moving to a new machine** › **Move out…** | `./homelab move out --to <file>`, then `move in` there | [Disaster Recovery](<Disaster Recovery.md#scenario-moving-to-a-new-machine>) |
| Rebuild a lost computer from the backups | Install the app on the new one, then in a terminal | `./homelab rebuild <backup folder>` | [Disaster Recovery](<Disaster Recovery.md#scenario-full-mac-rebuild>) |
| Print the recovery kit | Backups › **Recovery kit** | `./homelab recovery-kit` | [Disaster Recovery](<Disaster Recovery.md>) |
| Ask for help | Settings › This Mac › **Make a diagnostics report** | `./homelab report` | [Getting help](<../README.md#getting-help>) |

## Add your own app, or one to the catalog

The quick way, for any container image: **Add your own app** at the bottom of the app's Choose apps screen, or

```bash
./homelab custom add wiki --image ghcr.io/requarks/wiki:2 --port 3000 --volume /wiki/data --install
```

It goes into `stacks/custom/compose.yaml` with the same metadata as the catalog, a free port, an address on your tailnet (or `https://wiki.example.com` with a domain), and its folders under `data/appdata/wiki`, which the nightly backup already covers. Like `.env`, the custom stack is yours alone: git ignores it, so `git pull` keeps working. `./homelab custom` lists your apps; `./homelab custom remove wiki` takes one out (its data stays).

**Adding an app to the catalog itself** (with its note, bundles, and wiring):

```yaml
  myapp:
    <<: *service
    image: example/myapp:latest
    profiles: [optional]
    ports:
      - ${BIND_IP:-127.0.0.1}:${MYAPP_PORT:-8123}:8080
    volumes:
      - ./data/appdata/myapp:/config
    x-homelab:
      name: My App
      category: documents
      description: What it is for
      subdomain: myapp
      web: 8080
```

```bash
./homelab docs && make check          # creates its note, checks everything
./homelab install myapp               # starts it
./homelab domain setup                # with a domain: https://myapp.example.com
```

Multi-container apps get their own `stacks/<name>/` folder. The full guide and checklist are in [Contributing](<Contributing.md>).

## Commands at a glance

```bash
./homelab                       # interactive menu
./homelab help                  # every command
./homelab status                # what runs, health, addresses
./homelab doctor                # anything wrong with this machine, the runtime, disk space, or .env
./homelab install '*-arr'       # slot in apps by name, alias, bundle, or category
./homelab update <app>          # what is new first, then dump its database, pull (or rebuild), and recreate
./homelab updates notes <app>   # the release notes newer than the version it runs
./homelab rollback <app>        # back to the image before its last update
./homelab fix                   # restart what is down or unwell, apply changed settings, reconnect the proxy to CrowdSec
./homelab logs <app> --explain  # what its log says, in plain words, from the Ollama on this machine
./homelab upgrade               # the newest homelab files, then up (the app's Update now)
./homelab tailnet setup         # Home mode: every app's address on the tailnet (signs in if needed)
./homelab domain setup          # with a domain: proxy hosts, LAN DNS, certificate, tunnel hostnames
./homelab domain resolver       # with a domain: this machine finds every app by name
./homelab backup                # database dumps, volume archives, .env copy
./homelab watchdog              # every app and address checked, a hung app restarted, ntfy alerts
./homelab digest                # this week's summary, as on Status
./homelab media                 # Tidy Up: each library, and the engines (music, books, movies, tv, audiobooks)
./homelab schedule install      # the background agent (launchd, systemd, or the Windows Run key)
./homelab person add "Anna Smith" --email anna@example.com   # an account, a welcome page, a start-page tab
./homelab sso setup             # the apps sign in with Pocket ID
./homelab phone pair            # the phone companion
./homelab export                # everyone's data in open formats, in one folder
./homelab move out              # to a new machine (then move in there)
./homelab rebuild <folder>      # the machine is lost: everything back from Duplicati's backups
./homelab report                # a diagnostics file to share, every secret removed
./homelab compose immich ps     # docker compose for any project
```

Commands that change something show a plan first and ask (or need `--apply` when not in a terminal). `--json` gives one object per line, each with `"schema": 1`, for scripts and apps. Full list, with how to pick apps (`@arr`, `cat:media`, `--exclude`): [Commands](<Commands.md>).

## Take the homelab off this machine

In the app: Settings › This Mac (*This PC*, *This machine*) › **Take the homelab off this machine**. Tick what else goes, **Review what goes…** shows the plan, and nothing happens until you type `uninstall` (`delete everything` with the last box ticked). The same from a terminal:

```bash
./homelab uninstall                    # the plan first; --apply removes the containers, images (the update undo copies too), scheduled jobs, and the tray icon at login
./homelab uninstall --data             # ...and the apps' data, and signs this machine's homelab out of the tailnet
./homelab uninstall --folder           # ...and the whole homelab folder, .env included (print the recovery kit first)
./homelab uninstall --backups          # ...and the backups on this machine; a backup folder in a cloud drive always stays
./homelab uninstall --app              # ...and Homelab Wizard itself, with its settings and downloads
./homelab uninstall --everything-else  # ...and every other container, image, and volume in the runtime, the homelab's or not
```

Combine them as you like (`--folder --backups --app` takes everything of the homelab off). In a terminal, `--folder`, `--backups`, and `--everything-else` are typed out before anything goes. The media drive is never touched, `--folder` alone keeps the backups inside the folder (`./backups` by default), `--backups` deletes only the backups' own files and folders (anything else on a backup drive stays), and a backup folder in a cloud drive (Proton Drive, iCloud Drive, Google Drive, OneDrive, Dropbox) is never deleted: another machine's homelab may use it, and the deletion would sync. `--app` moves the app to the Trash on a Mac, runs its uninstaller on Windows (Windows asks for approval), deletes the AppImage, or names the package command on Linux (it needs your password). With a domain, `./homelab domain resolver --undo` takes back this machine's name lookups first. The container runtime itself stays; the last lines say how to remove it.
