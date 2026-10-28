"""Moves one version's lines out of CHANGELOG.md's [Unreleased] under its own
heading, sets VERSION, and the version: front matter of every note.
Usage: python3 release.py 0.10   (run in the repository)"""
import re, subprocess, sys

DATE = '2026-10-28'
# Each [Unreleased] line, by the start of its text, to the version that built it.
WHERE = {
    '0.10': [
        '`homelab status --timing`', 'Status shows your apps straight away', 'Opening or folding a category on Status is instant',
        'The window and the menu bar item share one look at Docker', 'Backups and Settings load their parts side by side',
    ],
    '0.11': [
        'Every build of the app has its own version number', 'If the app, its tray icon, or the background agent stops',
        '`TAILSCALE_EXTRA_ARGS`', 'The recovery kit is checked', 'Every build of the app is opened on its own system',
        'Links, buttons, and the green, orange, and red states', 'The watchdog rebuilds an app whose container was removed',
        'Bundles install without their `@`', "Setup's **Addresses on your tailnet**", '`homelab signups open` in Home mode',
        'After the app updates itself from an AppImage', 'On Windows, removing the scheduled jobs', 'The watchdog brings back an app you installed',
        '`homelab uninstall --data`', '**Set up the alert token**', "The background jobs' own logs no longer grow",
        'On Linux with Docker Engine, the proxy and Tailscale', 'A failed `homelab db upgrade`',
    ],
    '0.12': [
        '**Jellyfin on SteamOS:**', '**SteamOS:** Setup can install Docker', '**Settings › Appearance:** pick the theme',
        "Setup checks that this machine can open the apps' tailnet", '`homelab domain resolver --undo`', "`homelab doctor` reads KDE Plasma's sleep",
        'Where a system does something differently', 'The Dock\'s "needs a look" count', 'The menu bar item is started on a Mac runner',
        'Jellyfin opened from Status and after a restart', 'On Windows, Setup says the tray icon', "Messages and the apps' notes use each system's own words",
        "On Windows, a new homelab takes the PC's time zone", '`homelab doctor` finds smartctl', "A bar shows how far along the app's own update",
        "The count of apps that need a look shows on the app's icon", 'Changing the hosts file from the app', 'A port another program holds',
        'On Windows and Linux, `duplicati setup`', 'On Linux, the homelab keeps the machine awake', "Alerts on a Windows PC's screen",
        'After signing in on Windows', 'On Windows and Linux, keeping the computer awake', "`homelab doctor` warns when the machine's address",
    ],
    '0.13': [
        '**Tandoor:**', '**Linkwarden:**', '**Beszel:**', '**Kiwix:**', '**Actual Budget:**', '**Paperless-AI:**', '**Tdarr:**',
        '**Frigate:**', '**Kopia:**', '**Nextcloud:**', '**Firefly III:**', 'With Kopia installed, Backups shows its line',
        "Setup's *A second copy with Kopia* step", '`homelab update` keeps a copy of each app', 'Each nightly backup notes the image',
        'Sending an Immich album to family', 'Status counts a service once', 'Ghostfolio starts again', 'A registry that asks to wait',
        'Homebox starts again', 'File Browser, Seerr, and Homebox', 'With the homelab run as root',
    ],
}
SUMMARY = {
    '0.10': '**Fast, everywhere.** Status answers at once on every system: the window and the menu bar item share one look at Docker, the list draws before each app\'s check comes back, and each part of a load is timed.',
    '0.11': '**Proven against real Docker.** Every night CI installs a real homelab, fills it, backs it up, wipes and restores it, updates and rolls back, and lets the watchdog heal it; the jobs and each build of the app are tried on macOS, Windows, and Linux. (The nightly run is still counting its first week of green nights.)',
    '0.12': '**The same on every system.** macOS, Windows, Linux, and SteamOS each get their own words, progress bars, tray, alerts, and look, and where one works differently the screen says so.',
    '0.13': '**More apps.** Ten new apps, from Actual Budget and Tandoor to Frigate and Nextcloud, and Kopia as a second backup beside Duplicati.',
}

ver = sys.argv[1]
full = ver + '.0'
s = open('CHANGELOG.md').read()
start = s.index('## [Unreleased]')
end = s.index('\n## [', start + 1) + 1
un = s[start:end]
moved, kept, section = {}, [], None
for line in un.split('\n'):
    if line.startswith('### '):
        section = line
        kept.append(line)
        continue
    if line.startswith('- ') and any(line[2:].startswith(k) for k in WHERE[ver]):
        moved.setdefault(section, []).append(line)
        continue
    kept.append(line)
missing = [k for k in WHERE[ver] if not any(l[2:].startswith(k) for ls in moved.values() for l in ls)]
if missing:
    sys.exit(f'not found in [Unreleased]: {missing}')
# Drop a section heading [Unreleased] no longer has a line under.
out, i = [], 0
while i < len(kept):
    l = kept[i]
    if l.startswith('### '):
        j = i + 1
        while j < len(kept) and not kept[j].startswith('### ') and not kept[j].startswith('- '):
            j += 1
        if j >= len(kept) or kept[j].startswith('### '):
            i = j
            continue
    out.append(l)
    i += 1
unreleased = re.sub(r'\n{3,}', '\n\n', '\n'.join(out)).rstrip('\n') + '\n\n'
new = [f'## [{full}] - {DATE}', '', SUMMARY[ver], '']
for sec in ('### New', '### Improved', '### Fixed'):
    if sec in moved:
        new += [sec, ''] + moved[sec] + ['']
s = s[:start] + unreleased + '\n'.join(new) + '\n' + s[end:]
# The compare links: [Unreleased] from this version, and this version from the one before.
m = re.search(r'^\[Unreleased\]: (\S+)/compare/(v\S+)\.\.\.HEAD$', s, flags=re.M)
repo, before = m.group(1), m.group(2)
s = s.replace(m.group(0), f'[Unreleased]: {repo}/compare/v{full}...HEAD\n[{full}]: {repo}/compare/{before}...v{full}')
open('CHANGELOG.md', 'w').write(s)
open('VERSION', 'w').write(full + '\n')
files = [f for f in subprocess.check_output(['git', 'grep', '-lz', '-E', r'^version: [0-9]', '--', '*.md']).decode().split('\0') if f]
for f in files:
    t = open(f).read()
    t2 = re.sub(r'^version: \S+$', 'version: ' + full, t, count=1, flags=re.M)
    if t2 != t:
        open(f, 'w').write(t2)
print(f'{full}: moved {sum(len(v) for v in moved.values())} lines; {len(files)} notes')
