// Screenshots of the desktop app for the docs, taken in Chromium with the
// fake backend in mock.js (no Wails, Docker, or Mac needed):
//
//   make screenshots          (or: node app/preview/shoot.mjs)
//
// The catalog comes from the real CLI (`homelab apps --json`) and the
// addresses from docs/Inventory.md, so the pictures follow the compose
// files. The state shown (which apps run, which setup steps are done) is
// an example. Writes docs/images/app-*.png in light and dark.
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require(execFileSync('npm', ['root', '-g']).toString().trim() + '/playwright'));
}

const catalog = JSON.parse(execFileSync('go', ['run', './cmd/homelab', 'apps', '--json'], { cwd: root }).toString().split('\n')[0]).data;

// Address and local URL of each app, from the generated inventory table.
const urls = {}, addresses = {};
const byName = Object.fromEntries(catalog.apps.map((a) => [a.name, a.id]));
for (const line of readFileSync(join(root, 'docs', 'Inventory.md'), 'utf8').split('\n')) {
  const id = byName[(line.match(/^\| \[([^\]]+)\]/) || [])[1]];
  if (!id) continue;
  const address = line.match(/\| https:\/\/(\S+) /), local = line.match(/\| (http:\/\/localhost:\d+) /);
  if (address) addresses[id] = address[1];
  if (local) urls[id] = local[1];
}

// Example state: the baseline running, a few optional apps installed.
const installed = new Set(['speedtest-tracker', 'vikunja', 'dozzle', 'mealie']);
const health = { 'immich-machine-learning': 'starting', 'paperless': 'healthy' };
const apps = catalog.apps
  .filter((a) => a.kind !== 'helper' && (a.kind !== 'optional' || installed.has(a.id)))
  .map((a) => ({
    id: a.id, name: a.name,
    state: a.kind === 'native' ? 'running' : a.id === 'mealie' ? 'stopped' : 'running',
    health: a.kind === 'native' ? 'native' : a.id === 'mealie' ? '' : health[a.id] || 'healthy',
    url: urls[a.id], address: addresses[a.id],
    // Up since the last restart: most for days, a few recreated by updates.
    since: a.kind === 'native' || a.id === 'mealie' ? undefined : new Date(Date.now() - (['vikunja', 'speedtest-tracker'].includes(a.id) ? 7.6 : 4 * 24) * 36e5).toISOString(),
    restarts: a.id === 'audiobookshelf' ? 3 : undefined,
    // Updated last night (the image before it is kept a week), or held after a rollback.
    updatedAt: ['vikunja', 'speedtest-tracker'].includes(a.id) ? new Date(Date.now() - 7.6 * 36e5).toISOString() : undefined,
    held: a.id === 'dozzle' || undefined,
  }));
const status = { apps, missing: 0, unmatched: 0, savings: 3292, updates: { paused: false, schedule: 'daily at 04:00' } };

// The setup checklist as the engine describes it, with example progress.
const setup = JSON.parse(execFileSync('go', ['run', './cmd/homelab', 'setup', '--json'], { cwd: root }).toString().split('\n')[0]).data;
const done = new Set(['runtime', 'started', 'address', 'adguard', 'cloudflare']);
let blocked = false;
for (const s of setup) {
  if (s.id === 'runtime') s.title = 'OrbStack is running';
  if (done.has(s.id)) { s.state = 'done'; continue; }
  s.state = blocked && s.state === 'waiting' ? 'waiting' : 'todo';
  if (s.id === 'domain') blocked = true;
  if (s.state === 'todo' && /after “/.test(s.detail || '')) s.detail = '';
}

// Settings, grouped as .env.example groups them.
const settings = [];
let section = '', help = [];
for (const line of readFileSync(join(root, '.env.example'), 'utf8').split('\n')) {
  const sec = line.match(/^# --- (.+?) -+$/);
  if (sec) { section = sec[1]; help = []; continue; }
  if (line.startsWith('#')) { help.push(line.replace(/^#\s?/, '')); continue; }
  const kv = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (kv && section) {
    const secret = /(TOKEN|PASSWORD|SECRET|_KEY|_AUTH)$|AUTHKEY$|HEARTBEAT_URL/.test(kv[1]);
    settings.push({ key: kv[1], section, help: help.join(' '), secret, set: secret ? !/TUNNEL|HEARTBEAT|TAILSCALE|ENROLL/.test(kv[1]) : true, value: secret ? '' : kv[2] });
  }
  help = [];
}

const logs = {
  default: [
    '2026-10-10T08:00:01Z INF Starting server on :3456',
    '2026-10-10T08:00:01Z INF Database migrations are up to date',
    '2026-10-10T08:14:22Z INF GET /api/v1/projects 200 4ms',
    '2026-10-10T08:14:23Z INF GET /api/v1/tasks/all 200 9ms',
    '2026-10-10T09:02:51Z INF POST /api/v1/tasks/12 200 6ms',
  ].join('\n'),
};
const actionLog = {
  restart: [' Container %s  Restarting', ' Container %s  Started'],
  update: [' %s Pulling', ' %s Pulled', ' Container %s  Recreate', ' Container %s  Recreated', ' Container %s  Started'],
  stop: [' Container %s  Stopping', ' Container %s  Stopped'],
  start: [' Container %s  Starting', ' Container %s  Started'],
};

const host = { os: 'macOS 26.0', machine: 'Mac mini (M4)', runtime: 'OrbStack', scheduler: 'launchd', supported: true, root: '/Users/you/Homelab', rootOK: true, runtimeOK: true, runtimeFound: 'OrbStack, engine 28.4.0', version: readFileSync(join(root, 'VERSION'), 'utf8').trim(),
  disks: [
    { label: 'homelab folder, backups, Jellyfin data', space: '412 GB free of 994 GB (41%)', low: false },
    { label: 'photos, media, downloads', space: '1.6 TB free of 3.6 TB (44%)', low: false },
  ] };
const envFor = { vikunja: ['VIKUNJA_PORT', 'VIKUNJA_SECRET'], grocy: ['GROCY_PORT'], karakeep: ['KARAKEEP_PORT', 'KARAKEEP_NEXTAUTH_SECRET'], 'home-assistant': ['HOME_ASSISTANT_PORT'] };

// Backups: last night's copies, one app stale, a restore test 12 days ago.
const hoursAgo = (n) => new Date(Date.now() - n * 3600e3).toISOString();
const dumped = [['nginx-proxy-manager', 'Nginx Proxy Manager', 182e3], ['vaultwarden', 'Vaultwarden', 96e3], ['uptime-kuma', 'Uptime Kuma', 3.1e6], ['ntfy', 'ntfy', 24e3], ['navidrome', 'Navidrome', 8.2e6], ['audiobookshelf', 'Audiobookshelf', 2.4e6], ['immich-database', 'Immich database', 61e6], ['paperless-db', 'Paperless database', 14e6], ['moneymatter-db', 'MoneyMatter database', 1.9e6], ['vikunja', 'Vikunja', 410e3]];
const backups = {
  destination: '~/Library/CloudStorage/ProtonDrive-you@proton.me-folder/homelab-backups', destinationOK: true,
  lastRun: hoursAgo(7.4), envCopied: hoursAgo(7.4), stale: 1, restoreDue: false, staleAfterHours: 26,
  restoreTest: { lastTest: hoursAgo(12 * 24), lastSummary: '12 of 12 sampled files identical', history: [
    { when: hoursAgo(43 * 24), seconds: 212, passed: true, summary: '12 of 12 sampled files identical', job: 'Homelab AppData' },
    { when: hoursAgo(12 * 24), seconds: 187, passed: true, summary: '12 of 12 sampled files identical', job: 'Homelab AppData' },
  ] },
  vaultExport: hoursAgo(9 * 24), vaultDue: false,
  copies: [
    ...dumped.map(([id, name, size]) => ({ id, name, newest: hoursAgo(7.5), size, count: 7, state: 'fresh' })),
    { id: 'mealie', name: 'Mealie', newest: hoursAgo(80), size: 640e3, count: 7, state: 'stale' },
    { id: 'moneymatter-attachments', name: 'MoneyMatter (attachments)', volume: true, newest: hoursAgo(7.5), size: 22e6, count: 7, state: 'fresh' },
  ],
};
const duplicatiJobs = [
  ['Homelab AppData', 6.7, '2.31 GB'], ['Homelab Databases', 7.1, '412 MB'], ['Homelab Infrastructure', 3 * 24, '18.4 MB'],
  ['Homelab Photos', 11, '286 GB'], ['Homelab Secrets', 7.1, '1.20 MB'], ['Homelab Stack Data', 6.6, '96.2 MB'],
].map(([name, h, size]) => ({ id: name, name, lastFinished: hoursAgo(h), nextRun: hoursAgo(h - (h > 24 ? 168 : 24)), size, state: 'ok' }));
const cliLog = { backup: ['→ dump vaultwarden → recovery-staging/databases/vaultwarden', '✓ vaultwarden: vaultwarden-20261010-091502.sqlite.gz (96 KB)', '✓ immich-database: immich-database-20261010-091503.sql.gz (58.2 MB)', '✓ .env copied and verified'], upgrade: ['Homelab files', '  → 3 change(s) on origin/main:', '  ✓ now at origin/main', 'Start the homelab', '  ✓ nothing to change'], fix: ['Fix it', '  • restart the apps that are unwell, and recreate any that stay unwell: Navidrome', '  ✓ done; homelab doctor checks the rest'], 'restore-test': ['→ asking Duplicati to restore 12 file(s) from "Homelab AppData" into recovery-staging/restore-test', '✓ 12 of 12 sampled files identical'] };
const alerts = [
  { id: 'a1', time: hoursAgo(0.6), topic: 'tunnel-watchdog', title: 'Homelab: recovered', message: 'photos.example.com answering again', tags: ['white_check_mark'] },
  { id: 'a2', time: hoursAgo(1.1), topic: 'tunnel-watchdog', title: 'Homelab: something is down', message: 'photos.example.com: HTTP 530 through the tunnel', priority: 4, tags: ['warning'] },
  { id: 'a3', time: hoursAgo(7.9), topic: 'watchtower', title: 'Watchtower updates', message: 'Updated vikunja, speedtest-tracker' },
];
// The watchdog's last run, a few minutes ago.
const watchdog = { lastRun: hoursAgo(0.07), checks: 47, failing: [], pending: 0 };
// CrowdSec: bans enforced, and what it caught this week.
const protection = {
  enforced: true, bouncer: "CrowdSec: the proxy's bouncer pulled decisions 6 seconds ago", week: 14, bannedNow: 2,
  recent: [
    { scenario: 'vpatch-CVE-2017-9841', ip: '203.0.113.7', country: 'NL', network: 'Example Hosting B.V.', when: hoursAgo(0.8), banned: true },
    { scenario: 'http-probing', ip: '198.51.100.23', country: 'US', network: 'Example Cloud', when: hoursAgo(2.5), banned: true },
    { scenario: 'http-bad-user-agent', ip: '192.0.2.150', country: 'SG', network: 'Example Transit', when: hoursAgo(19) },
  ],
};
// Savings recorded nightly: apps added over two months.
const savingsHistory = Array.from({ length: 60 }, (_, i) => ({
  date: new Date(Date.now() - (59 - i) * 864e5).toISOString().slice(0, 10),
  annual: i < 12 ? 2991 : i < 30 ? 3112 : i < 47 ? 3232 : 3292,
}));
// Three changes waiting on GitHub, one of them to the app.
const upgrade = {
  branch: 'main', upstream: 'origin/main', behind: 3, ahead: 0, appChanged: true, settingsChanged: false, version: '0.1.0-alpha', newVersion: '0.1.0-alpha', checked: hoursAgo(0),
  changes: [
    { hash: '0a51554', subject: 'Restore test through Duplicati\'s API, and a Troubleshooting page', when: hoursAgo(2) },
    { hash: '7d9be08', subject: 'App, Status: what needs a look first, and a clear notice without a runtime', when: hoursAgo(5) },
    { hash: 'e657cb2', subject: 'Watchdog: alert when a Duplicati job fails or stops running', when: hoursAgo(6) },
  ],
  notes: ['Updates you can undo.', 'Phone companion: `homelab serve` shows the Status and Backups screens on a phone.', 'Settings › Phones in the desktop app.'],
  previous: { version: '0.1.0-alpha', commit: '5ab0bff1c2', when: hoursAgo(24 * 6) },
};
const tests = { CLOUDFLARE_API_TOKEN: { key: 'CLOUDFLARE_API_TOKEN', ok: true, message: 'The token can read example.com. It can also manage the tunnel.' } };
// Phones paired with the companion.
const phones = [
  { id: 'a1b2c3', name: 'Anna’s iPhone', canChange: true, paired: hoursAgo(24 * 9), lastSeen: hoursAgo(0.2) },
  { id: 'd4e5f6', name: 'Kitchen iPad', canChange: false, paired: hoursAgo(24 * 3), lastSeen: hoursAgo(20) },
];

const mock = { platform: 'MacIntel', upgrade: { ...upgrade, behind: 0, changes: [], appChanged: false, appCommit: '7d9be080888433f921c9fa860a38b329ac368c88', appBehind: 0 }, catalog, status, setup, settings, host, logs, actionLog, urls, envFor, tests, backups, cliLog, alerts, watchdog, protection, savingsHistory, duplicatiJobs, phones, screen: 'status' };
const shots = [
  { name: 'status', screen: 'status', mock: { statusOpen: '' } },
  { name: 'choose', screen: 'choose', before: async (page) => { await page.click('#starters .starter:has-text("Music")'); await page.click('#more > summary'); await page.click('#presets .chip >> text=Household'); await page.waitForTimeout(500); } },
  { name: 'backups', screen: 'backups' },
  { name: 'setup', screen: 'setup' },
  { name: 'upgrade', screen: 'setup', mock: { upgrade } },
  { name: 'settings', screen: 'settings', before: async (page) => { await page.click('#setting-CLOUDFLARE_API_TOKEN button:has-text("Test")'); await page.waitForTimeout(500); await page.evaluate(() => { document.getElementById('setting-CLOUDFLARE_API_TOKEN').closest('.group').scrollIntoView({ block: 'start' }); document.querySelector('main').scrollBy(0, -130); }); } },
  // The phone companion (homelab serve): the same screens at phone width.
  { name: 'phone', screen: 'status', phone: ['companion'] },
  { name: 'phone-backups', screen: 'backups', phone: ['companion', 'can-change'] },
  { name: 'phones', screen: 'settings', before: async (page) => { await page.click('#pairPhone'); await page.waitForSelector('#pairing img'); } },
  { name: 'logs', screen: 'status', before: async (page) => { await page.click('#statusRows tr:has-text("Vikunja") button[title="Logs"]'); await page.waitForTimeout(300); } },
];

// Clicks through the buttons that run commands, against the fake backend
// (node app/preview/shoot.mjs --smoke, or make app-smoke): each must finish
// with its success text and no script error.
const smokes = [
  { name: 'Backups: pick where they go', screen: 'setup', mock: { setup: setup.map((s) => (s.id === 'backups' ? { ...s, state: 'todo', run: undefined, choices: [{ label: 'Use Proton Drive', run: [['duplicati', 'destination', '/p', '--apply']] }, { label: 'Use the Backup drive', run: [['duplicati', 'destination', '/Volumes/Backup/Homelab Backups', '--apply']] }] } : s)) }, run: async (page) => {
    await page.waitForSelector('#checklist button.choice:has-text("Use the Backup drive")', { timeout: 5000 });
    await page.click('#checklist button.choice:has-text("Use the Backup drive")');
    await page.waitForFunction(() => !document.querySelector('#checklist button.choice'), null, { timeout: 5000 });
  } },
  { name: 'Fix it for an unwell app', screen: 'status', mock: { status: { ...status, apps: status.apps.map((a) => (a.id === 'navidrome' ? { ...a, health: 'restarting', restarts: 7 } : a)) } }, run: async (page) => {
    await page.click('#fixIt');
    await page.waitForSelector('#cliLog:has-text("restart the apps that are unwell")', { timeout: 5000 });
    await page.click('#cliActions button:has-text("Fix these")');
    await page.waitForSelector('#cliLog:has-text("done; homelab doctor")', { timeout: 5000 });
  } },
  { name: 'No Fix it when all is well', screen: 'status', run: async (page) => {
    await page.waitForSelector('#tiles .tile', { timeout: 5000 });
    if (await page.isVisible('#fixIt')) throw new Error('Fix it should be hidden');
  } },
  { name: 'Install OrbStack, then open it', screen: 'setup', mock: { host: { ...host, runtimeOK: false, runtimeInstalled: false, runtimeDownload: 'https://orbstack.dev/download', runtimeHint: 'brew install --cask orbstack' } }, run: async (page) => {
    await page.waitForSelector('#runtimeCard:has-text("Install OrbStack")', { timeout: 5000 });
    await page.waitForSelector('#getRuntime');
  } },
  { name: 'Open OrbStack when it is installed', screen: 'setup', mock: { host: { ...host, runtimeOK: false, runtimeInstalled: true } }, run: async (page) => {
    await page.click('#startRuntime');
    await page.waitForSelector('#runtimeCard', { state: 'hidden', timeout: 9000 });
  } },
  { name: 'Set it up for me on a new machine', screen: 'setup', mock: { host: { ...host, rootOK: false, root: '', disks: [], kit: true, newRoot: '/Users/you/Homelab' } }, run: async (page) => {
    await page.waitForSelector('#newHomelab:has-text("/Users/you/Homelab")', { timeout: 5000 });
    await page.click('#createHomelab');
    await page.waitForSelector('#newHomelab', { state: 'hidden', timeout: 5000 });
    await page.waitForSelector('#hostInfo:has-text("/Users/you/Homelab")');
  } },
  { name: 'A starter pick ticks its apps', screen: 'choose', run: async (page) => {
    if (await page.isVisible('label.app:has-text("Navidrome")')) throw new Error('the full list should wait behind Add more');
    await page.click('#starters .starter:has-text("Music")');
    await page.waitForSelector('#starters .starter.on:has-text("Music")', { timeout: 5000 });
    await page.click('#more > summary');
    if (!(await page.isChecked('label.app:has-text("Feishin") input'))) throw new Error('Feishin should be ticked');
  } },
  { name: 'Searching opens Add more', screen: 'choose', run: async (page) => {
    await page.fill('#search', 'spotify');
    await page.waitForSelector('label.app:has-text("Navidrome")', { timeout: 5000 });
  } },
  { name: 'Nothing left to install says why', screen: 'choose', run: async (page) => {
    await page.click('#more > summary');
    await page.click('label.app:has-text("Vikunja") input');
    await page.waitForSelector('#nothingToInstall:has-text("already running")', { timeout: 5000 });
    if (!(await page.isDisabled('#installBtn'))) throw new Error('Install should be greyed out');
  } },
  { name: 'Test a restore', screen: 'backups', run: async (page) => {
    await page.click('#restoreTest');
    await page.waitForSelector('#backupTitle:has-text("Restore test passed")', { timeout: 5000 });
  } },
  { name: 'Create the backup jobs', screen: 'backups', mock: { duplicatiJobs: [] }, run: async (page) => {
    await page.click('#dupCard button:has-text("Create the backup jobs")');
    await page.waitForSelector('#backupTitle:has-text("Backup jobs created")', { timeout: 5000 });
  } },
  { name: 'Restore drills: timing and record', screen: 'backups', run: async (page) => {
    await page.waitForSelector('#restoreTile:has-text("in 3 minutes")', { timeout: 5000 });
    const title = await page.getAttribute('#restoreTile', 'title');
    if (!title || !title.includes('(2)') || !title.includes('passed in 4 minutes')) throw new Error(`record: ${title}`);
  } },
  { name: 'A failed restore test shows', screen: 'backups', mock: { backups: { ...backups, restoreTest: { ...backups.restoreTest, history: [...backups.restoreTest.history, { when: hoursAgo(20), seconds: 40, passed: false, summary: '2 of 12 sampled files differ' }] } } }, run: async (page) => {
    await page.waitForSelector('#restoreTile .bad:has-text("2 of 12 sampled files differ")', { timeout: 5000 });
  } },
  { name: 'Next Duplicati runs', screen: 'backups', run: async (page) => {
    await page.waitForSelector('#dupCard .next:has-text("next in")', { timeout: 5000 });
  } },
  { name: 'Back up now', screen: 'backups', run: async (page) => {
    await page.click('#backupNow');
    await page.waitForSelector('#backupTitle:has-text("Backup done")', { timeout: 5000 });
  } },
  { name: 'Get the update', screen: 'setup', mock: { upgrade }, run: async (page) => {
    await page.click('#upgradeBtn');
    await page.waitForSelector('#setupLog:has-text("Up to date.")', { timeout: 5000 });
  } },
  { name: 'A newer app build', screen: 'setup', mock: { upgrade: { ...upgrade, behind: 0, changes: [], appBehind: 2, appCommit: '0123456789', web: 'https://github.com/o/r' } }, run: async (page) => {
    await page.waitForSelector('#upgradeCard:has-text("A newer Homelab Wizard is ready")', { timeout: 5000 });
    await page.waitForSelector('#versionInfo:has-text("build 0123456")');
  } },
  { name: 'The footer keeps the version whole on Windows', screen: 'setup', mock: { host: { ...host, os: 'Windows 11 Pro 24H2' } }, run: async (page) => {
    await page.waitForSelector('#foot .part:has-text("Windows 11 Pro 24H2")', { timeout: 5000 });
    const lines = await page.evaluate(() => [...document.querySelectorAll('#foot .part')].map((e) => e.getClientRects().length));
    if (lines.some((n) => n !== 1)) throw new Error(`a footer part wraps: ${lines}`);
  } },
  { name: 'A newer app build on Windows', screen: 'setup', mock: { host: { ...host, os: 'Windows 11', machine: 'this machine' }, upgrade: { ...upgrade, behind: 0, changes: [], appBehind: 1, appCommit: '0123456789' } }, run: async (page) => {
    await page.waitForSelector('#upgradeCard:has-text("Artifacts › windows, and run the installer")', { timeout: 5000 });
    await page.waitForSelector('#hostInfo:has-text("Tray icon")');
  } },
  { name: 'Version says up to date once', screen: 'setup', run: async (page) => {
    await page.waitForSelector('#versionInfo:has-text("up to date")', { timeout: 5000 });
    await page.click('#recheck');
    await page.waitForTimeout(800);
    const text = await page.textContent('#versionInfo');
    if (text.split('up to date').length !== 2) throw new Error(`version line: ${text}`);
  } },
  { name: 'No app menu row outside the AppImage', screen: 'setup', run: async (page) => {
    await page.waitForSelector('#hostInfo:has-text("Homelab folder")', { timeout: 5000 });
    if (await page.$('#menuEntry')) throw new Error('the app menu row shows outside the AppImage');
  } },
  { name: 'AppImage: add to the app menu', screen: 'setup', mock: { menuEntry: { added: false }, host: { ...host, os: 'Linux (SteamOS 3.7)', machine: 'Steam Machine' } }, run: async (page) => {
    await page.waitForSelector('#hostInfo:has-text("opened from its file")', { timeout: 5000 });
    await page.click('#menuEntry');
    await page.waitForSelector('#hostInfo:has-text("in the app menu")', { timeout: 5000 });
  } },
  { name: 'A low disk on Setup', screen: 'setup', mock: { host: { ...host, disks: [{ ...host.disks[0], space: '6.0 GB free of 994 GB (0%)', low: true, hint: 'Under 49 GB: unused images (docker image prune -a), finished downloads, and Immich\'s trash are the usual places to free some' }, host.disks[1]] } }, run: async (page) => {
    await page.waitForSelector('#diskSpace .bad:has-text("6.0 GB free")', { timeout: 5000 });
    await page.waitForSelector('#diskSpace:has-text("docker image prune")', { timeout: 5000 });
  } },
  { name: 'Tray at login', screen: 'setup', run: async (page) => {
    await page.waitForSelector('#hostInfo:has-text("only while the app is open")', { timeout: 5000 });
    await page.click('#trayAtLogin');
    await page.waitForSelector('#hostInfo:has-text("starts at login")', { timeout: 5000 });
  } },
  { name: 'Settings: the everyday ones first, Test saves what was typed', screen: 'settings', run: async (page) => {
    await page.waitForSelector('#setting-MEDIA_ROOT', { state: 'visible', timeout: 5000 });
    if (await page.isVisible('#setting-PUID')) throw new Error('PUID shows among the everyday settings');
    await page.click('#settingsAll');
    await page.waitForSelector('#setting-PUID', { state: 'visible' });
    await page.click('#settingsAll');
    await page.fill('#setting-ADGUARD_PASSWORD input', 'typed-not-saved');
    await page.click('#setting-ADGUARD_PASSWORD button:has-text("Test")');
    await page.waitForSelector('#setting-ADGUARD_PASSWORD .test.ok', { timeout: 5000 });
    if (await page.evaluate(() => window.__MOCK.saved?.ADGUARD_PASSWORD) !== 'typed-not-saved') throw new Error('Test did not save the typed value first');
  } },
  { name: 'Search settings', screen: 'settings', run: async (page) => {
    await page.waitForSelector('#setting-CLOUDFLARE_API_TOKEN', { timeout: 5000 });
    await page.fill('#settingsSearch', 'cloudflare token');
    await page.waitForSelector('#setting-CLOUDFLARE_API_TOKEN:not([hidden])');
    if (await page.isVisible('#setting-BACKUP_DESTINATION')) throw new Error('BACKUP_DESTINATION should be hidden');
    await page.fill('#settingsSearch', 'nothing like this');
    await page.waitForSelector('#settingsNone:not([hidden])');
    await page.press('#settingsSearch', 'Escape');
    await page.waitForSelector('#setting-BACKUP_DESTINATION:not([hidden])');
  } },
  { name: 'Keyboard: Ctrl+2 opens Status on Windows', screen: 'setup', mock: { platform: 'Win32' }, run: async (page) => {
    await page.keyboard.press('Control+2');
    await page.waitForSelector('#status.screen.active', { timeout: 5000 });
    if (!(await page.$('html.os-windows'))) throw new Error('no os-windows class');
  } },
  { name: 'Keyboard: ⌘2 opens Status on a Mac', screen: 'setup', run: async (page) => {
    await page.keyboard.press('Meta+2');
    await page.waitForSelector('#status.screen.active', { timeout: 5000 });
  } },
  { name: 'Keyboard: ⌘, opens Settings, and the View menu\'s events work', screen: 'status', run: async (page) => {
    await page.keyboard.press('Meta+Comma');
    await page.waitForSelector('#settings.screen.active', { timeout: 5000 });
    await page.evaluate(() => window.__emit('navigate', 'backups'));
    await page.waitForSelector('#backups.screen.active', { timeout: 5000 });
  } },
  { name: 'Windows: the Settings-style pane, Mica only where Windows draws it', screen: 'status', mock: { platform: 'Win32' }, run: async (page) => {
    const pane = await page.evaluate(() => getComputedStyle(document.querySelector('nav')).backgroundColor);
    if (pane !== 'rgb(243, 243, 243)') throw new Error(`pane ${pane}`);
    await page.evaluate(() => window.__emit && document.documentElement.classList.add('backdrop'));
    const glass = await page.evaluate(() => getComputedStyle(document.querySelector('nav')).backgroundColor);
    if (glass !== 'rgba(0, 0, 0, 0)') throw new Error(`with Mica the pane should be clear: ${glass}`);
  } },
  { name: 'Linux: a grey sidebar, not the navy one', screen: 'status', mock: { platform: 'Linux x86_64' }, run: async (page) => {
    const pane = await page.evaluate(() => getComputedStyle(document.querySelector('nav')).backgroundColor);
    if (pane !== 'rgb(235, 235, 237)') throw new Error(`pane ${pane}`);
  } },
  { name: 'Buttons show the arrow, labels do not select', screen: 'status', run: async (page) => {
    const [cursor, select, field] = await page.evaluate(() => [getComputedStyle(document.querySelector('nav button')).cursor, getComputedStyle(document.querySelector('h1')).userSelect, getComputedStyle(document.querySelector('pre') || document.body).userSelect]);
    if (cursor !== 'default' || select !== 'none' || field !== 'text') throw new Error(`cursor ${cursor}, h1 ${select}, pre ${field}`);
  } },
  { name: 'Copy a secret', screen: 'settings', run: async (page) => {
    await page.click('#setting-CLOUDFLARE_API_TOKEN button:has-text("Copy")');
    await page.waitForSelector('#setting-CLOUDFLARE_API_TOKEN .test:has-text("Copied")', { timeout: 5000 });
  } },
  { name: 'Watchdog failures', screen: 'status', mock: { watchdog: { ...watchdog, failing: [{ name: 'crowdsec bouncer', problem: "the proxy's bouncer last pulled CrowdSec's decisions 9 minutes ago", since: hoursAgo(0.3) }] } }, run: async (page) => {
    await page.waitForSelector('#watchCard:has-text("1 of 47 checks failing")', { timeout: 5000 });
    await page.waitForSelector('#watchCard li:has-text("crowdsec bouncer")');
  } },
  { name: 'Bans not enforced', screen: 'status', mock: { protection: { ...protection, enforced: false, bouncer: "the proxy's bouncer last pulled CrowdSec's decisions 9 minutes ago" } }, run: async (page) => {
    await page.waitForSelector('#protectCard:has-text("Bans not enforced")', { timeout: 5000 });
    await page.waitForSelector('#protectCard:has-text("9 minutes ago")');
  } },
  { name: 'Watchdog not run yet', screen: 'status', mock: { watchdog: null }, run: async (page) => {
    await page.waitForSelector('#watchCard:has-text("once the jobs are installed")', { timeout: 5000 });
  } },
  { name: 'Healthy categories fold into their headings', screen: 'status', mock: { statusOpen: '' }, run: async (page) => {
    await page.waitForSelector('#statusRows tr.grouphead.fold:has-text("Security"):has-text("running ✓")', { timeout: 5000 });
    if (await page.isVisible('#statusRows tr:has(strong:text-is("Vaultwarden"))')) throw new Error('a healthy category is open');
    await page.click('#statusRows tr.grouphead.fold:has-text("Security")');
    await page.waitForSelector('#statusRows tr:has(strong:text-is("Vaultwarden"))', { timeout: 5000 });
    await page.click('#statusAll');
    await page.waitForSelector('#statusRows tr:has(strong:text-is("Navidrome"))', { timeout: 5000 });
  } },
  { name: 'The plan in a few lines, asking for what an app needs', screen: 'choose', run: async (page) => {
    await page.click('#more > summary');
    await page.fill('#search', 'qbittorrent');
    await page.click('#groups label.app:has(strong:text-is("qBittorrent")) input');
    await page.waitForSelector('#plan li:has-text("Gluetun"):has-text("fill in ProtonVPN WireGuard key below")', { timeout: 5000 });
    await page.waitForSelector('#inputs .fieldName:has-text("ProtonVPN WireGuard key")');
    await page.fill('#inputs input', 'wg-key-test');
    await page.waitForSelector('#plan .planLead:has-text("Installs 1 app")', { timeout: 5000 });
    if (await page.isVisible('#presets .chip:has-text("Immich")')) throw new Error("a stack's own preset is still a chip");
  } },
  { name: 'Photos per person on Status', screen: 'status', run: async (page) => {
    await page.waitForSelector('#storageCard:not([hidden]) li:has-text("Anna Smith") .when:has-text("412 GB")', { timeout: 5000 });
    await page.waitForSelector('#storageCard .muted:has-text("580 GB in Immich")');
  } },
  { name: 'No storage card before the first reading', screen: 'status', mock: { storage: { when: '0001-01-01T00:00:00Z', photos: [] } }, run: async (page) => {
    await page.waitForSelector('#statusRows tr', { timeout: 5000 });
    if (await page.isVisible('#storageCard')) throw new Error('the storage card shows with nothing to show');
  } },
  { name: 'Uptime and restarts on Status', screen: 'status', run: async (page) => {
    await page.waitForSelector('#statusRows tr:has-text("Audiobookshelf") .badge:has-text("restarted 3×")', { timeout: 5000 });
    await page.waitForSelector('#statusRows tr:has-text("Vikunja") .local:has-text("up 8 hours")');
    await page.waitForSelector('#statusRows tr:has-text("Vaultwarden") .local:has-text("up 4 days")');
  } },
  { name: 'A crash loop shows first, in red', screen: 'status', mock: { status: { ...status, apps: status.apps.map((a) => (a.id === 'navidrome' ? { ...a, health: 'restarting', restarts: 7 } : a)) } }, run: async (page) => {
    // The "Needs a look" group comes first, with Navidrome in it.
    await page.waitForSelector('#statusRows tr.grouphead.bad:first-child:has-text("Needs a look")', { timeout: 5000 });
    await page.waitForSelector('#statusRows tr:nth-child(2):has-text("Navidrome"):has-text("Restarting")');
    await page.waitForSelector('#tiles:has-text("Navidrome")');
  } },
  { name: 'A read-only phone has no restart or stop', screen: 'status', phone: ['companion'], run: async (page) => {
    await page.waitForSelector('#statusRows tr:has-text("Vikunja") button[title="Logs"]', { state: 'visible', timeout: 5000 });
    for (const sel of ['button[title="Restart"]', 'button[title="Stop (data is kept)"]']) {
      if (await page.isVisible(`#statusRows tr:has-text("Vikunja") ${sel}`)) throw new Error(sel + ' shows on a read-only phone');
    }
    if (await page.isVisible('nav button[data-screen="settings"]')) throw new Error('Settings shows on the phone');
  } },
  { name: 'A phone allowed to make changes can restart', screen: 'status', phone: ['companion', 'can-change'], run: async (page) => {
    await page.click('#statusRows tr:has-text("Vikunja") button[title="Restart"]', { timeout: 5000 });
    await page.waitForSelector('#cliPanel:not([hidden])', { timeout: 5000 });
  } },
  { name: 'Pair a phone, then let it make changes and remove it', screen: 'settings', run: async (page) => {
    await page.waitForSelector('#phonesCard li:has-text("Kitchen iPad"):has-text("Looks only")', { timeout: 5000 });
    await page.click('#pairPhone');
    await page.waitForSelector('#pairing img[src^="data:image/svg"]');
    await page.waitForSelector('#pairing code:has-text("K7QX4MRA")');
    await page.click('#phonesCard li:has-text("Kitchen iPad") button:has-text("Allow changes")');
    await page.waitForSelector('#phonesCard li:has-text("Kitchen iPad"):has-text("Can make changes")');
    await page.click('#phonesCard li:has-text("Kitchen iPad") button:has-text("Remove")');
    await page.waitForSelector('#phonesCard .row:has-text("1 paired")');
    if (await page.isVisible('#phonesCard li:has-text("Kitchen iPad")')) throw new Error('the removed phone is still listed');
  } },
  { name: 'Send a report shows only on the phone', screen: 'status', run: async (page) => {
    if (await page.isVisible('#phoneReport')) throw new Error('Send a report shows on the Mac');
    await page.evaluate(() => document.documentElement.classList.add('companion'));
    await page.waitForSelector('#phoneReport', { state: 'visible', timeout: 2000 });
  } },
  { name: 'Roll back an update', screen: 'status', run: async (page) => {
    await page.waitForSelector('#statusRows tr:has-text("Dozzle") .badge:has-text("updates held")', { timeout: 5000 });
    if (await page.isVisible('#statusRows tr:has-text("Navidrome") button[aria-label^="Roll back"]')) throw new Error('Roll back without an update');
    await page.click('#statusRows tr:has-text("Vikunja") button[aria-label^="Roll back"]');
    await page.waitForSelector('#cliTitle:has-text("Vikunja")', { timeout: 5000 });
  } },
  { name: 'What is new, and going back', screen: 'setup', mock: { upgrade }, run: async (page) => {
    await page.waitForSelector('#upgradeCard .whatsnew summary:has-text("What is new (3)")', { timeout: 5000 });
    await page.click('#upgradeBack');
    await page.waitForSelector('#upgradeBack:has-text("click again")');
    await page.click('#upgradeBack');
    await page.waitForSelector('#setupLog:not([hidden])');
  } },
  { name: 'Restart an app', screen: 'status', run: async (page) => {
    await page.click('#statusRows tr:has-text("Vikunja") button[title="Restart"]');
    await page.waitForSelector('#cliPanel:not([hidden])', { timeout: 5000 });
  } },
];

// An iPhone's screen, in CSS pixels.
const phoneSize = { width: 390, height: 844 };

if (process.argv.includes('--smoke')) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  let failed = 0;
  for (const s of smokes) {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript({ content: `window.__MOCK = ${JSON.stringify({ ...mock, ...s.mock, screen: s.screen })};\n${readFileSync(join(here, 'mock.js'), 'utf8')}` });
    if (s.phone) await page.setViewportSize(phoneSize);
    await page.goto(pathToFileURL(join(root, 'web', 'dist', 'index.html')).href);
    await page.evaluate((c) => document.documentElement.classList.add('preview', ...c), s.phone || []);
    await page.waitForTimeout(600);
    try {
      await s.run(page);
      if (errors.length) throw new Error(errors.join('; '));
      console.log('ok  ', s.name);
    } catch (e) {
      failed++;
      console.log('FAIL', s.name + ':', String(e.message || e).split('\n')[0]);
    }
    await page.close();
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
}

const out = join(root, 'docs', 'images');
mkdirSync(out, { recursive: true });
const only = process.argv.slice(2);
const written = [];
const browser = await chromium.launch();
for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, colorScheme: scheme });
  for (const shot of shots) {
    if (only.length && !only.includes(shot.name)) continue;
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript({ content: `window.__MOCK = ${JSON.stringify({ ...mock, ...shot.mock, screen: shot.screen })};\n${readFileSync(join(here, 'mock.js'), 'utf8')}` });
    if (shot.phone) await page.setViewportSize(phoneSize);
    await page.goto(pathToFileURL(join(root, 'web', 'dist', 'index.html')).href);
    await page.evaluate((c) => document.documentElement.classList.add('preview', ...c), shot.phone || []);
    await page.waitForTimeout(600);
    if (shot.before) await shot.before(page);
    await page.waitForTimeout(300);
    if (errors.length) throw new Error(`${shot.name}: ${errors.join('; ')}`);
    // An element the page hid must not show (a class's display style once beat the hidden attribute).
    const shown = await page.evaluate(() => [...document.querySelectorAll('[hidden]')]
      .filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.id || e.className || e.tagName));
    if (shown.length) throw new Error(`${shot.name}: hidden but displayed: ${shown.join(', ')}`);
    const file = join(out, `app-${shot.name}${scheme === 'dark' ? '-dark' : ''}.png`);
    await page.screenshot({ path: file });
    written.push(file);
    console.log('wrote', file.replace(root + '/', ''));
    await page.close();
  }
  await ctx.close();
}
await browser.close();

// Shrink the files to 256 colours when Pillow is around (UI pictures look
// the same at about 40% of the size).
const shrink = `import sys
from PIL import Image
for f in sys.argv[1:]:
    Image.open(f).convert('RGB').quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(f, optimize=True)`;
try {
  execFileSync('python3', ['-I', '-c', shrink, ...written], { stdio: 'pipe' });
  console.log(`shrank ${written.length} file(s)`);
} catch {
  console.log('Pillow not found: kept the full-colour files');
}
