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
// What docker stats says over a minute: Immich indexing photos, Jellyfin
// streaming, Paperless reading a scan.
const usageSeries = [[162, 18, 9], [148, 22, 31], [171, 19, 12], [139, 25, 8], [155, 21, 6], [176, 17, 24], [151, 23, 7], [164, 20, 11]]
  .map(([ml, jf, pl]) => [{ name: 'immich-machine-learning', cpu: ml, mem: '1.4GiB' }, { name: 'paperless', cpu: pl, mem: '610MiB' }, { name: 'jellyfin', cpu: jf, mem: '420MiB' }, { name: 'vaultwarden', cpu: 0.2, mem: '38MiB' }]
    .sort((a, b) => b.cpu - a.cpu));

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
    { label: 'homelab folder, backups, Jellyfin data', space: '412 GB free of 994 GB (41%)', low: false, free: 412e9, total: 994e9 },
    { label: 'photos, media, downloads', space: '1.6 TB free of 3.6 TB (44%)', low: false, name: 'Hobbies', free: 1.6e12, total: 3.6e12 },
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
const cliLog = { 'update-all': ['Updates now what the nightly update would (3 apps): navidrome, vikunja, mealie.', '→ dumping mealie-db first', '✓ updated navidrome, vikunja, mealie'], backup: ['→ dump vaultwarden → recovery-staging/databases/vaultwarden', '✓ vaultwarden: vaultwarden-20261010-091502.sqlite.gz (96 KB)', '✓ immich-database: immich-database-20261010-091503.sql.gz (58.2 MB)', '✓ .env copied and verified'], upgrade: ['Homelab files', '  → 3 change(s) on origin/main:', '  ✓ now at origin/main', 'Start the homelab', '  ✓ nothing to change'], fix: ['Fix it', '  • restart the apps that are unwell, and recreate any that stay unwell: Navidrome', '  ✓ done; homelab doctor checks the rest'], 'restore-test': ['→ asking Duplicati to restore 12 file(s) from "Homelab AppData" into recovery-staging/restore-test', '✓ 12 of 12 sampled files identical'] };
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

const cliSteps = { 'update-all': ['Updating navidrome', 'Updating vikunja', 'Updating mealie'], backup: ["Copying Vaultwarden's database", "Copying Immich's database", 'Copying the settings (.env)'] };
const mock = { platform: 'MacIntel', cliSteps, upgrade: { ...upgrade, behind: 0, changes: [], appChanged: false, appCommit: '7d9be080888433f921c9fa860a38b329ac368c88', appBehind: 0 }, catalog, status, setup, settings, host, logs, actionLog, urls, envFor, tests, backups, cliLog, alerts, watchdog, protection, savingsHistory, duplicatiJobs, phones, screen: 'status' };
const shots = [
  { name: 'status', screen: 'status', mock: { statusOpen: '' } },
  // Below the apps: storage, and what is using power with each busy app's
  // last minutes (a minute of samples, run on the page's clock).
  { name: 'status-cards', screen: 'status', clock: true, mock: { usageSeries }, before: async (page) => {
    await page.clock.runFor(65000);
    await page.waitForSelector('#usageCard .spark', { timeout: 5000 });
    await page.evaluate(() => document.getElementById('storageCard').scrollIntoView({ block: 'start' }));
  } },
  { name: 'choose', screen: 'choose', before: async (page) => { await page.click('#starters .starter:has-text("Music")'); await page.click('#more > summary'); await page.click('#presets .chip >> text=Household'); await page.waitForTimeout(500); } },
  { name: 'backups', screen: 'backups' },
  { name: 'setup', screen: 'setup' },
  { name: 'firstrun', screen: 'setup', mock: { host: { ...host, runtimeOK: false, runtimeInstalled: true, runtimeHint: 'open OrbStack (open -a OrbStack) and turn on Settings > General > Start at login', rootOK: false, root: '', disks: [], kit: true, newRoot: '/Users/you/Homelab' } } },
  { name: 'upgrade', screen: 'setup', mock: { upgrade } },
  { name: 'settings', screen: 'settings', before: async (page) => { await page.click('#settingsNav .pagebtn[data-page="Domain"]', { timeout: 5000 }); await page.click('#setting-CLOUDFLARE_API_TOKEN button:has-text("Test")'); await page.waitForTimeout(500); } },
  // The phone companion (homelab serve): the same screens at phone width.
  { name: 'phone', screen: 'status', phone: ['companion'] },
  { name: 'phone-backups', screen: 'backups', phone: ['companion', 'can-change'] },
  { name: 'phones', screen: 'settings', before: async (page) => { await page.click('#settingsNav .pagebtn[data-page="Phones"]', { timeout: 5000 }); await page.click('#pairPhone'); await page.waitForSelector('#pairing img'); } },
  { name: 'logs', screen: 'status', mock: { explainer: 'llama3.2:latest', explained: { vikunja: 'The log looks normal: Vikunja started, its database is up to date, and the recent requests all succeeded (HTTP 200). Nothing to fix.' } }, before: async (page) => {
    await page.click('#statusRows tr:has-text("Vikunja") button[title="Logs"]');
    await page.click('#logExplain button:has-text("Explain this log")', { timeout: 5000 });
    await page.waitForSelector('#logExplain .answer', { timeout: 5000 });
  } },
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
    await page.waitForSelector('#backupProgress:not([hidden]) .step:text-is("Done")', { timeout: 5000 });
    if (await page.isVisible('#cliProgress')) throw new Error('the command sheet took the backup steps');
  } },
  { name: 'Do the steps I can', screen: 'setup', mock: { runMarksDone: true, setup: [
    { id: 'a', title: 'Step A', why: 'x', state: 'todo', run: [['a']] },
    { id: 'b', title: 'Step B', why: 'x', state: 'todo', run: [['b']] },
    { id: 'c', title: 'Step C', why: 'x', state: 'waiting', run: [['c']] },
    { id: 'd', title: 'Step D', why: 'x', state: 'todo', settings: ['X'] }] }, run: async (page) => {
    await page.click('#runAll:has-text("Do the 2 steps I can")', { timeout: 5000 });
    await page.waitForSelector('#setupLog:has-text("What is left needs you")', { timeout: 8000 });
    const ran = await page.evaluate(() => window.__MOCK.ran);
    if (ran.join() !== 'a,b') throw new Error(`ran ${ran}`);
    if (await page.isVisible('#runAll')) throw new Error('nothing is left to run');
  } },
  { name: 'Update', screen: 'setup', mock: { upgrade }, run: async (page) => {
    await page.click('#upgradeBtn');
    await page.waitForSelector('#setupLog:has-text("The homelab is up to date.")', { timeout: 5000 });
  } },
  { name: 'Update also replaces the app', screen: 'setup', mock: { upgrade: { ...upgrade, appUpdate: { commit: 'abcdef1234', page: 'https://github.com/o/r/releases/tag/nightly', canInstall: true } } }, run: async (page) => {
    await page.waitForSelector('#upgradeCard:has-text("The app updates too")', { timeout: 5000 });
    await page.click('#upgradeBtn');
    await page.waitForSelector('#setupLog:has-text("Opening the new version")', { timeout: 5000 });
    if (!(await page.evaluate(() => window.__MOCK.appInstalled))) throw new Error('the app update was not installed');
  } },
  { name: 'Move out asks twice', screen: 'backups', run: async (page) => {
    await page.click('#moveCard > summary', { timeout: 5000 });
    await page.click('#moveOut', { timeout: 5000 });
    if (await page.evaluate(() => window.__MOCK.moved)) throw new Error('moved on the first click');
    await page.click('#moveOut');
    await page.waitForSelector('#backupTitle:has-text("This machine is stopped")', { timeout: 5000 });
  } },
  { name: 'Move in, or cancel the file dialog', screen: 'backups', mock: { moveFile: '' }, run: async (page) => {
    await page.click('#moveCard > summary', { timeout: 5000 });
    await page.click('#moveIn', { timeout: 5000 });
    await page.waitForTimeout(500);
    if (!(await page.isHidden('#backupPanel'))) throw new Error('a cancelled dialog should leave nothing behind');
  } },
  { name: 'Open an app on a phone', screen: 'status', run: async (page) => {
    await page.click('tr:has(strong:text-is("Vaultwarden")) button[title="Open on a phone"]', { timeout: 5000 });
    await page.waitForSelector('#cliTitle:has-text("Open Vaultwarden on a phone")');
    await page.waitForSelector('#cliActions img[alt^="QR code for https://"]');
    await page.waitForSelector('#cliActions:has-text("Bitwarden")');
  } },
  { name: 'Add a person needs Pocket ID', screen: 'settings', run: async (page) => {
    await page.click('#settingsNav .pagebtn[data-page="People"]', { timeout: 5000 }); 
    await page.waitForSelector('#peopleCard:has-text("Install Pocket ID")', { timeout: 5000 });
  } },
  { name: 'Add a person', screen: 'settings', mock: { status: { ...status, apps: [...status.apps, { id: 'pocket-id', name: 'Pocket ID', state: 'running', health: 'healthy', url: 'http://localhost:1411' }] } }, run: async (page) => {
    await page.click('#settingsNav .pagebtn[data-page="People"]', { timeout: 5000 }); 
    await page.fill('#personName', 'Anna Smith', { timeout: 5000 });
    await page.fill('#personEmail', 'anna@example.com');
    await page.click('#peopleCard label.check:has-text("Vikunja") input');
    await page.click('#addPerson');
    await page.waitForSelector('#peopleCard li:has-text("Anna Smith")', { timeout: 5000 });
    const [act] = await page.evaluate(() => window.__MOCK.personActions);
    if (act.join('|') !== 'add|Anna Smith|anna@example.com|vikunja') throw new Error(`asked ${act}`);
    if ((await page.evaluate(() => window.__MOCK.opened)) !== 'anna') throw new Error('the welcome page did not open');
  } },
  { name: 'Sign-in details for the proxy', screen: 'status', run: async (page) => {
    await page.click('tr:has(strong:text-is("Nginx Proxy Manager")) button[title="Sign-in details"]', { timeout: 5000 });
    await page.waitForSelector('#cliTitle:has-text("Sign in to Nginx Proxy Manager")');
    await page.waitForSelector('#cliActions .signin:has-text("homelab@example.com")');
    await page.click('#cliActions .signin:has-text("Email") button');
    if ((await page.evaluate(() => window.__MOCK.clipboard)) !== 'homelab@example.com') throw new Error('the email was not copied');
    await page.click('#cliActions .signin:has-text("Password") button');
    await page.waitForSelector('#cliActions:has-text("Password copied")');
  } },
  { name: 'Bigger text with the keyboard', screen: 'status', run: async (page) => {
    const mod = (await page.evaluate(() => navigator.platform)).startsWith('Mac') ? 'Meta' : 'Control';
    await page.keyboard.press(`${mod}+Equal`);
    await page.keyboard.press(`${mod}+Equal`);
    const z = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--zoom').trim());
    if (z !== '1.2') throw new Error(`zoom ${z}`);
    const fits = await page.evaluate(() => document.body.getBoundingClientRect().bottom <= window.innerHeight + 1);
    if (!fits) throw new Error('the window scrolls past the app');
    await page.keyboard.press(`${mod}+Digit0`);
  } },
  { name: 'Screen readers hear the screen change', screen: 'status', run: async (page) => {
    await page.click('nav button[data-screen="backups"]', { timeout: 5000 });
    const where = await page.evaluate(() => [document.activeElement.textContent, document.querySelector('nav button[aria-current="page"]')?.dataset.screen]);
    if (where[0] !== 'Backups' || where[1] !== 'backups') throw new Error(`focus ${where}`);
  } },
  { name: 'Links that act work from the keyboard', screen: 'status', mock: { upgrade }, run: async (page) => {
    await page.focus('#footUpdate', { timeout: 5000 });
    await page.keyboard.press('Enter');
    await page.waitForSelector('#setup.active', { timeout: 5000 });
  } },
  { name: 'The sidebar says an update is ready', screen: 'status', mock: { upgrade }, run: async (page) => {
    await page.click('#footUpdate', { timeout: 5000 });
    await page.waitForSelector('#setup.active #upgradeCard:has-text("Update the homelab")', { timeout: 5000 });
  } },
  { name: 'Update now for a newer app build', screen: 'setup', mock: { upgrade: { ...upgrade, behind: 0, changes: [], appCommit: '0123456789', appUpdate: { commit: 'abcdef1234', page: 'https://github.com/o/r/releases/tag/nightly', canInstall: true } } }, run: async (page) => {
    await page.click('#appUpdateBtn');
    await page.waitForSelector('#setupLog:has-text("Opening the new version")', { timeout: 5000 });
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
    await page.waitForSelector('#upgradeCard:has-text("download Homelab-Wizard-Windows-Setup.exe and run it")', { timeout: 5000 });
    await page.waitForSelector('#hostInfo:has-text("Tray icon")');
  } },
  { name: 'Update banner on Linux: no install on quit', screen: 'status', mock: { platform: 'Linux x86_64', host: { ...host, os: 'Ubuntu 24.04', machine: 'this machine' }, pendingUpdate: { commit: 'abc1234', notes: ['A change'], ready: false, installOnQuit: false, canInstallOnQuit: false } }, run: async (page) => {
    await page.waitForSelector('#updateBanner:has-text("asks for an administrator")', { timeout: 5000 });
    if (await page.$('#installOnQuit')) throw new Error('install on quit offered where installing asks for a password');
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
  { name: 'A low disk on Setup', screen: 'setup', mock: { host: { ...host, disks: [{ ...host.disks[0], space: '6.0 GB free of 994 GB (0%)', free: 6e9, low: true, hint: 'Under 49 GB: unused images (docker image prune -a), finished downloads, and Immich\'s trash are the usual places to free some' }, host.disks[1]] } }, run: async (page) => {
    await page.waitForSelector('#diskSpace .bad:has-text("6.0 GB free")', { timeout: 5000 });
    await page.waitForSelector('#diskSpace:has-text("docker image prune")', { timeout: 5000 });
    await page.waitForSelector('#diskSpace .disk.low .storagebar span[style*="99%"]');
    await page.waitForSelector('#diskSpace .disk:has(strong:text-is("Hobbies")) .storagebar');
  } },
  { name: 'Tray at login', screen: 'setup', run: async (page) => {
    await page.waitForSelector('#hostInfo:has-text("only while the app is open")', { timeout: 5000 });
    await page.click('#trayAtLogin');
    await page.waitForSelector('#hostInfo:has-text("starts at login")', { timeout: 5000 });
  } },
  { name: 'Settings: the everyday ones first, Test saves what was typed', screen: 'settings', run: async (page) => {
    await page.click('#settingsNav .pagebtn[data-page="Storage"]', { timeout: 5000 }); 
    await page.waitForSelector('#setting-MEDIA_ROOT', { state: 'visible', timeout: 5000 });
    await page.click('#settingsNav .pagebtn[data-page="This Mac"]', { timeout: 5000 }); 
    await page.waitForSelector('#setting-TZ', { state: 'visible', timeout: 5000 });
    if (await page.isVisible('#setting-PUID')) throw new Error('PUID shows among the everyday settings');
    await page.click('#settingsAll');
    await page.waitForSelector('#setting-PUID', { state: 'visible' });
    await page.click('#settingsAll');
    await page.click('#settingsNav .pagebtn[data-page="AdGuard Home"]', { timeout: 5000 }); 
    if (await page.isVisible('#setting-TZ')) throw new Error('another page still shows');
    await page.fill('#setting-ADGUARD_PASSWORD input', 'typed-not-saved');
    await page.click('#setting-ADGUARD_PASSWORD button:has-text("Test")');
    await page.waitForSelector('#setting-ADGUARD_PASSWORD .test.ok', { timeout: 5000 });
    if (await page.evaluate(() => window.__MOCK.saved?.ADGUARD_PASSWORD) !== 'typed-not-saved') throw new Error('Test did not save the typed value first');
  } },
  { name: 'Save typed settings, a switch too; a search keeps what was typed', screen: 'settings', run: async (page) => {
    await page.click('#settingsNav .pagebtn[data-page="This Mac"]', { timeout: 5000 });
    await page.fill('#setting-TZ input', 'Europe/Berlin');
    await page.waitForSelector('#saveSettings:text-is("Save 1 change")');
    // Searching and coming back keeps the typed value.
    await page.fill('#settingsSearch', 'zzzz-nothing');
    await page.waitForSelector('#settingsNone:not([hidden])');
    await page.fill('#settingsSearch', '');
    if (await page.inputValue('#setting-TZ input') !== 'Europe/Berlin') throw new Error('the typed value was lost');
    const sw = await page.$('#settingsForm input.switch');
    if (sw) {
      await sw.click();
      await page.waitForSelector('#saveSettings:text-is("Save 2 changes")');
    }
    await page.click('#saveSettings');
    await page.waitForSelector('#saveSettings', { state: 'hidden', timeout: 5000 });
    const saved = await page.evaluate(() => window.__MOCK.saved || {});
    if (saved.TZ !== 'Europe/Berlin') throw new Error('not saved: ' + JSON.stringify(saved));
  } },
  { name: 'Search settings', screen: 'settings', run: async (page) => {
    await page.click('#settingsNav .pagebtn[data-page="Storage"]', { timeout: 5000 }); 
    await page.fill('#settingsSearch', 'cloudflare token');
    await page.waitForSelector('#setting-CLOUDFLARE_API_TOKEN:not([hidden])');
    if (await page.isVisible('#setting-BACKUP_DESTINATION')) throw new Error('BACKUP_DESTINATION should be hidden');
    await page.fill('#settingsSearch', 'nothing like this');
    await page.waitForSelector('#settingsNone:not([hidden])');
    await page.press('#settingsSearch', 'Escape');
    await page.waitForSelector('#setting-BACKUP_DESTINATION:not([hidden])');
  } },
  { name: 'Settings name each app as the app spells it', screen: 'settings', run: async (page) => {
    await page.fill('#settingsSearch', 'webui port');
    await page.waitForSelector('#setting-OPEN_WEBUI_PORT:not([hidden])', { timeout: 5000 });
    const labels = await page.evaluate(() => ['OPEN_WEBUI_PORT', 'QBITTORRENT_PORT', 'ADGUARD_PORT', 'IMMICH_DB_PASSWORD'].map((k) => document.querySelector(`#setting-${k} .label`)?.textContent));
    if (labels.join('|') !== 'Open WebUI port|qBittorrent port|AdGuard Home port|Immich database password') throw new Error(labels.join('|'));
  } },
  { name: 'Keyboard: F1 opens the guide on Windows', screen: 'status', mock: { platform: 'Win32' }, run: async (page) => {
    await page.keyboard.press('F1');
    const url = await page.evaluate(() => window.__MOCK.opened);
    if (!/Getting%20Started/.test(url || '')) throw new Error(`F1 opened ${url}`);
  } },
  { name: 'Keyboard: F5 checks the screen again on Windows', screen: 'status', mock: { platform: 'Win32' }, run: async (page) => {
    await page.evaluate(() => {
      const app = window.go.main.App, status = app.Status;
      window.__statusCalls = 0;
      app.Status = (...a) => { window.__statusCalls++; return status(...a); };
    });
    await page.keyboard.press('F5');
    await page.waitForFunction(() => window.__statusCalls > 0, null, { timeout: 5000 });
  } },
  { name: 'Windows high contrast: the selected screen and the status dots keep a mark', screen: 'status', mock: { platform: 'Win32' }, run: async (page) => {
    await page.emulateMedia({ forcedColors: 'active' });
    const marks = await page.evaluate(() => ({
      nav: getComputedStyle(document.querySelector('nav button.active')).outlineStyle,
      dot: getComputedStyle(document.querySelector('.dot')).forcedColorAdjust,
    }));
    if (marks.nav !== 'solid' || marks.dot !== 'none') throw new Error(JSON.stringify(marks));
  } },
  { name: 'Keyboard: Ctrl+2 opens Status on Windows', screen: 'setup', mock: { platform: 'Win32' }, run: async (page) => {
    await page.keyboard.press('Control+2');
    await page.waitForSelector('#status.screen.active', { timeout: 5000 });
    if (!(await page.$('html.os-windows'))) throw new Error('no os-windows class');
  } },
  { name: 'Windows: buttons and links take the accent picked in Settings', screen: 'status', mock: { platform: 'Win32', host: { ...host, os: 'Windows 11', accent: { light: '#c30052', dark: '#ff4fa3' } } }, run: async (page) => {
    await page.waitForSelector('html.sys-accent', { timeout: 5000 });
    const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
    if (accent !== '#c30052') throw new Error(`--accent is ${accent}`);
  } },
  { name: 'Mac: the Dock icon shows how many apps need a look', screen: 'status', run: async (page) => {
    await page.waitForFunction(() => window.__MOCK.attention !== undefined, null, { timeout: 5000 });
    const [dock, side] = await page.evaluate(() => [window.__MOCK.attention, document.getElementById('statusCount').textContent]);
    if (String(dock) !== side) throw new Error(`Dock ${dock}, sidebar ${side}`);
  } },
  { name: 'Mac: the accent from System Settings, with dark text on yellow', screen: 'status', mock: { host: { ...host, accent: { light: '#ffcc00', dark: '#ffd60a', text: '#000' } } }, run: async (page) => {
    await page.waitForSelector('html.os-mac.sys-accent', { timeout: 5000 });
    const css = await page.evaluate(() => { const s = getComputedStyle(document.documentElement); return [s.getPropertyValue('--accent').trim(), s.getPropertyValue('--accent-text').trim()]; });
    if (css[0] !== '#ffcc00' || css[1] !== '#000') throw new Error(css.join(' '));
  } },
  { name: 'KDE (SteamOS): drawn as Breeze, with bordered buttons', screen: 'status', mock: { platform: 'Linux x86_64', host: { ...host, os: 'Linux (SteamOS 3.7)', machine: 'Steam Machine', desktop: 'kde' } }, run: async (page) => {
    await page.waitForSelector('html.os-linux.de-kde', { timeout: 5000 });
    const border = await page.evaluate(() => getComputedStyle(document.getElementById('updateAll')).borderTopStyle);
    if (border !== 'solid') throw new Error(`Update apps border: ${border}`);
  } },
  { name: 'Increase contrast: lines take the stronger grey', screen: 'status', run: async (page) => {
    await page.emulateMedia({ contrast: 'more' });
    const css = await page.evaluate(() => { const s = getComputedStyle(document.documentElement); return [s.getPropertyValue('--line').trim(), s.getPropertyValue('--line-strong').trim(), s.getPropertyValue('--muted').trim()]; });
    if (!css[0] || css[0] !== css[1] || !css[2].startsWith('color-mix')) throw new Error(css.join(' '));
  } },
  { name: 'Increase contrast on KDE too', screen: 'status', mock: { platform: 'Linux x86_64', host: { ...host, os: 'Linux (SteamOS 3.7)', desktop: 'kde' } }, run: async (page) => {
    await page.emulateMedia({ contrast: 'more' });
    await page.waitForSelector('html.os-linux.de-kde', { timeout: 5000 });
    const css = await page.evaluate(() => { const s = getComputedStyle(document.documentElement); return [s.getPropertyValue('--line').trim(), s.getPropertyValue('--line-strong').trim()]; });
    if (css[0] !== '#bcc2c7') throw new Error(css.join(' '));
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
  { name: 'Settings: a page per app, with its port', screen: 'settings', run: async (page) => {
    await page.waitForSelector('#settingsNav .navhead:text-is("Apps")', { timeout: 5000 });
    await page.click('#settingsNav .pagebtn[data-page="Immich"]');
    await page.waitForSelector('#setting-IMMICH_PORT', { state: 'visible' });
    await page.fill('#settingsSearch', 'immich');
    await page.waitForSelector('#settingsNav .pagebtn[data-page="Immich"] .n:not(:empty)');
  } },
  { name: 'Copy a secret', screen: 'settings', run: async (page) => {
    await page.click('#settingsNav .pagebtn[data-page="Domain"]', { timeout: 5000 }); 
    await page.click('#setting-CLOUDFLARE_API_TOKEN button:has-text("Copy")');
    await page.waitForSelector('#setting-CLOUDFLARE_API_TOKEN .test:has-text("Copied")', { timeout: 5000 });
  } },
  { name: 'Watchdog failures', screen: 'status', mock: { watchdog: { ...watchdog, failing: [{ name: 'crowdsec bouncer', problem: "the proxy's bouncer last pulled CrowdSec's decisions 9 minutes ago", since: hoursAgo(0.3) }] } }, run: async (page) => {
    await page.waitForSelector('#watchCard:has-text("1 of 47 checks failing")', { timeout: 5000 });
    await page.waitForSelector('#watchCard li:has-text("crowdsec bouncer")');
  } },
  { name: 'Bans not enforced', screen: 'status', mock: { protection: { ...protection, enforced: false, bouncer: "the proxy's bouncer last pulled CrowdSec's decisions 9 minutes ago" } }, run: async (page) => {
    await page.waitForSelector('#protectCard:has-text("Bans not enforced")', { timeout: 5000 });
    await page.waitForSelector('#protectCard:has-text("new attackers are not blocked")');
    await page.click('#protectFix');
    await page.waitForSelector('#cliTitle:has-text("Fix it")', { timeout: 5000 });
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
  { name: 'Start the stopped apps of a category', screen: 'status', run: async (page) => {
    await page.click('#statusRows tr.grouphead:has-text("Household") button.startall', { timeout: 5000 });
    await page.waitForSelector('#statusRows tr.grouphead:has-text("Household") button.startall', { state: 'detached', timeout: 5000 });
  } },
  { name: 'Open Jellyfin when it is not running', screen: 'status', mock: { status: { ...status, apps: status.apps.map((a) => (a.id === 'jellyfin' ? { ...a, state: 'not running', health: '' } : a)) } }, run: async (page) => {
    await page.click('tr:has(strong:text-is("Jellyfin")) button:has-text("Open")', { timeout: 5000 });
    if ((await page.evaluate(() => window.__MOCK.openedNative)) !== 'jellyfin') throw new Error('Jellyfin was not opened');
  } },
  { name: 'The phone companion before the scheduled jobs: why it is not running', screen: 'status', mock: { status: { ...status, apps: status.apps.map((a) => (a.id === 'homelab-companion' ? { ...a, state: 'not running' } : a)) } }, run: async (page) => {
    await page.click('#statusAll', { timeout: 5000 });
    const row = await page.textContent('tr:has(strong:text-is("Phone companion"))', { timeout: 5000 });
    if (!row.includes('Starts with the scheduled jobs')) throw new Error(row);
    if (await page.isVisible('tr:has(strong:text-is("Phone companion")) .dot.warn')) throw new Error('marked as a warning');
    // Not counted yet: its group says all running, and the tile's total leaves it out.
    const group = await page.textContent('tr.grouphead:has-text("System") .n');
    if (!group.includes('running ✓')) throw new Error(`System group: ${group}`);
    const tile = await page.textContent('#tiles .tile:has-text("Running")');
    const of = (tile.match(/of\s*(\d+)/) || [])[1];
    if (Number(of) !== status.apps.length - 1) throw new Error(`Running tile: ${tile}`);
  } },
  { name: 'Start Jellyfin on Linux when it is not running', screen: 'status', mock: { platform: 'Linux x86_64', status: { ...status, apps: status.apps.map((a) => (a.id === 'jellyfin' ? { ...a, state: 'not running', health: '' } : a)) } }, run: async (page) => {
    await page.click('tr:has(strong:text-is("Jellyfin")) button:has-text("Start")', { timeout: 5000 });
    if ((await page.evaluate(() => window.__MOCK.openedNative)) !== 'jellyfin') throw new Error('Jellyfin was not started');
  } },
  { name: 'A long plan scrolls, so Install stays in reach', screen: 'choose', run: async (page) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.click('#more > summary');
    for (const p of ['Media automation', 'Household']) await page.click(`#presets .chip >> text=${p}`, { timeout: 5000 });
    await page.waitForSelector('#plan .planLead', { timeout: 5000 });
    await page.locator('#installBtn').scrollIntoViewIfNeeded();
    const box = await page.locator('#installBtn').boundingBox();
    if (!box || box.y + box.height > 720) throw new Error(`Install is out of reach: ${JSON.stringify(box)}`);
  } },
  { name: 'After a new app opens, its homelab files follow by themselves', screen: 'status', mock: { upgrade: { ...upgrade, kit: true, behind: 1, changes: [] } }, run: async (page) => {
    await page.waitForFunction(() => (window.__MOCK.homelabRan || []).includes('upgrade'), null, { timeout: 5000 });
    const ran = await page.evaluate(() => window.__MOCK.homelabRan.filter((a) => a === 'upgrade').length);
    if (ran !== 1) throw new Error(`upgrade ran ${ran} times`);
  } },
  { name: 'An app update found in the background', screen: 'status', mock: { pendingUpdate: { commit: 'abc1234', notes: ["Status: what's using power", 'Setup: turn the scheduled jobs off'], ready: true, installOnQuit: false } }, run: async (page) => {
    await page.waitForSelector('#updateBanner:not([hidden]):has-text("update is ready")', { timeout: 5000 });
    await page.click('#updateWhatsNew');
    await page.waitForSelector('#updateNotes li:has-text("what\u2019s using power"), #updateNotes li:has-text("what\'s using power")');
    await page.check('#installOnQuit');
    await page.waitForFunction(() => window.__MOCK.installOnQuit === true);
    await page.click('#updateRestart');
    await page.waitForFunction(() => window.__MOCK.appInstalled === true);
  } },
  { name: 'Later hides the update banner', screen: 'status', mock: { pendingUpdate: { commit: 'abc1234', notes: [], ready: false, installOnQuit: false } }, run: async (page) => {
    await page.click('#updateLater', { timeout: 5000 });
    await page.waitForSelector('#updateBanner', { state: 'hidden' });
    if (await page.isVisible('#updateWhatsNew')) throw new Error('What is new shows with no notes');
  } },
  { name: 'No update banner without an update', screen: 'status', run: async (page) => {
    await page.waitForSelector('#statusRows tr', { timeout: 5000 });
    if (await page.isVisible('#updateBanner')) throw new Error('the update banner shows with no update');
  } },
  { name: 'An app that updates itself never asks for a download', screen: 'setup', mock: { upgrade: { ...upgrade, appChanged: true, selfUpdates: true } }, run: async (page) => {
    await page.waitForSelector('#upgradeCard:has-text("The app updates too")', { timeout: 5000 });
    if (await page.isVisible('#upgradeCard:has-text("drag")')) throw new Error('a self-updating app is told to drag a download');
  } },
  { name: 'What runs in the background', screen: 'setup', run: async (page) => {
    await page.click('#bgToggle', { timeout: 5000 });
    await page.waitForSelector('#bgList li:has-text("Nightly backup"):has-text("daily at 03:30")');
    await page.waitForSelector('#bgList li:has-text("Menu bar icon"):has-text("not installed")');
    await page.click('#bgOff');
    await page.waitForSelector('#cliPanel:not([hidden]) #cliTitle:has-text("Turn off the scheduled jobs")');
    await page.waitForSelector('#cliActions button:has-text("Turn them off")');
  } },
  { name: 'Paused on battery', screen: 'status', mock: { status: { ...status, batteryPaused: ['navidrome'], apps: status.apps.map((a) => (a.id === 'navidrome' ? { ...a, state: 'stopped', health: '' } : a)) } }, run: async (page) => {
    await page.waitForSelector('#statusNote:has-text("On battery: 1 app paused")', { timeout: 5000 });
    await page.waitForSelector('tr:has(strong:text-is("Navidrome")) td.state:has-text("Paused on battery")');
  } },
  { name: 'Waiting for a drive', screen: 'status', mock: { status: { ...status, apps: status.apps.map((a) => (a.id === 'navidrome' ? { ...a, state: 'stopped', health: '', waitingFor: '/Volumes/Hobbies' } : a)) } }, run: async (page) => {
    await page.waitForSelector('tr:has(strong:text-is("Navidrome")) td.state:has-text("Waiting for the Hobbies drive")', { timeout: 5000 });
    await page.waitForSelector('#statusNote:has-text("Plug in Hobbies")');
  } },
  { name: 'A running app that does not answer needs a look', screen: 'status', mock: { status: { ...status, apps: status.apps.map((a) => (a.id === 'vikunja' ? { ...a, notAnswering: 'HTTP 502' } : a)) } }, run: async (page) => {
    await page.waitForSelector('tr:has(strong:text-is("Vikunja")) td.state:has-text("Not answering: HTTP 502")', { timeout: 5000 });
    await page.waitForSelector('#tiles .tile.warn:has-text("Vikunja")');
    await page.waitForSelector('#fixIt:not([hidden])');
  } },
  { name: 'Status follows the engine', screen: 'status', run: async (page) => {
    await page.waitForSelector('tr:has(strong:text-is("Navidrome")) td.state:has-text("Running")', { timeout: 5000 });
    await page.evaluate(() => {
      const M = window.__MOCK;
      M.status = { ...M.status, apps: M.status.apps.map((a) => (a.id === 'navidrome' ? { ...a, state: 'stopped', health: '' } : a)) };
      window.__emit('status:changed', { apps: ['navidrome'] });
    });
    // Well before the minute's poll.
    await page.waitForSelector('tr:has(strong:text-is("Navidrome")) td.state:has-text("Stopped")', { timeout: 2000 });
  } },
  { name: 'A live change keeps the focus where it was', screen: 'status', run: async (page) => {
    await page.focus('#statusRows tr:has-text("Vikunja") button[title="Restart"]');
    await page.evaluate(() => {
      const M = window.__MOCK;
      M.status = { ...M.status, apps: M.status.apps.map((a) => (a.id === 'navidrome' ? { ...a, state: 'stopped', health: '' } : a)) };
      window.__emit('status:changed', { apps: ['navidrome'] });
    });
    await page.waitForSelector('tr:has(strong:text-is("Navidrome")) td.state:has-text("Stopped")', { timeout: 2000 });
    const kept = await page.evaluate(() => document.activeElement?.getAttribute('title') === 'Restart' && !!document.activeElement.closest('tr')?.textContent.includes('Vikunja'));
    if (!kept) throw new Error('the focus was lost: ' + await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)));
  } },
  { name: 'A category with something stopped folds too', screen: 'status', mock: { statusOpen: '' }, run: async (page) => {
    await page.waitForSelector('#statusRows tr:has(strong:text-is("Mealie"))', { timeout: 5000 });
    await page.click('#statusRows tr.grouphead:has-text("Household")');
    await page.waitForSelector('#statusRows tr:has(strong:text-is("Mealie"))', { state: 'detached', timeout: 5000 });
    await page.click('#statusRows tr.grouphead:has-text("Household")');
    await page.waitForSelector('#statusRows tr:has(strong:text-is("Mealie"))', { timeout: 5000 });
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
    await page.waitForSelector('#storageCard li:has-text("Paperless-ngx") .when:has-text("18 GB")');
  } },
  { name: 'What is using power on Status', screen: 'status', mock: { usage: [{ name: 'immich-machine-learning', cpu: 143.5, mem: '1.2GiB' }, { name: 'jellyfin', cpu: 12.3, mem: '300MiB' }, { name: 'vaultwarden', cpu: 0.1, mem: '40MiB' }] }, run: async (page) => {
    await page.waitForSelector('#usageCard:not([hidden]) li:has-text("Jellyfin") .when:has-text("12%")', { timeout: 5000 });
    await page.waitForSelector('#usageCard .muted:has-text("156% of a core")');
    await page.waitForSelector('#usageCard p:has-text("is busy")');
    if (await page.isVisible('#usageCard li:has-text("Vaultwarden")')) throw new Error('an idle app is listed as using power');
  } },
  { name: 'No power card when nothing is busy', screen: 'status', run: async (page) => {
    await page.waitForSelector('#statusRows tr', { timeout: 5000 });
    if (await page.isVisible('#usageCard')) throw new Error('the power card shows with nothing busy');
  } },
  { name: 'No storage card before the first reading', screen: 'status', mock: { storage: { when: '0001-01-01T00:00:00Z', photos: [] } }, run: async (page) => {
    await page.waitForSelector('#statusRows tr', { timeout: 5000 });
    if (await page.isVisible('#storageCard')) throw new Error('the storage card shows with nothing to show');
  } },
  { name: 'This week on Status', screen: 'status', run: async (page) => {
    await page.waitForSelector('#weekCard:not([hidden]) li:has-text("No restore test yet") .dot.warn, #weekCard li:has-text("No restore test yet")', { timeout: 5000 });
    await page.waitForSelector('#weekCard .warn:has-text("1 thing to look at")');
  } },
  { name: 'This week on a new homelab: still to set up, in grey', screen: 'status', mock: { weekly: { title: 'Homelab this week: getting started, 2 still to set up (Setup)', body: '\u2713 4 apps running and healthy\n\u25e6 No restore test yet (Backups \u203a Test a restore)\n\u25e6 Off-site jobs: none yet (Setup \u203a Create the backup jobs)\nReplacing $247 a year in subscriptions', problems: 0 } }, run: async (page) => {
    await page.waitForSelector('#weekCard .muted:has-text("Getting started: 2 still to set up")', { timeout: 5000 });
    if (await page.locator('#weekCard .dot.warn').count()) throw new Error('an orange dot on a new homelab');
    if (!(await page.isVisible('#weekCard li:has-text("Replacing $247") .dot:not(.ok):not(.warn)'))) throw new Error('the savings line is not grey');
  } },
  { name: 'An app that was down this week says so', screen: 'status', mock: { watchdog: { lastRun: new Date().toISOString(), checks: 40, failing: [], pending: 0, week: { navidrome: 0.962, vaultwarden: 1 } } }, run: async (page) => {
    await page.waitForSelector('tr:has(strong:text-is("Navidrome")) .badge:has-text("96.2% up this week")', { timeout: 5000 });
    if (await page.isVisible('tr:has(strong:text-is("Vaultwarden")) .badge:has-text("up this week")')) throw new Error('a healthy app should not carry the badge');
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
    await page.click('#settingsNav .pagebtn[data-page="Phones"]', { timeout: 5000 }); 
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
  { name: 'The plan replaces the first words, and comes back to them', screen: 'choose', run: async (page) => {
    await page.click('#starters .starter:has-text("Files")');
    await page.waitForSelector('#plan .planLead', { timeout: 5000 });
    if ((await page.textContent('#plan')).includes('Nothing selected yet')) throw new Error('the first words stayed beside the plan');
    await page.click('#starters .starter:has-text("Files")');
    await page.waitForSelector('#plan:has-text("Nothing selected yet")', { timeout: 5000 });
    if (await page.isVisible('#plan .planLead')) throw new Error('the plan stayed');
  } },
  { name: 'Search puts the matches first', screen: 'choose', run: async (page) => {
    await page.fill('#search', 'memos');
    await page.waitForSelector('#starterBox', { state: 'hidden', timeout: 5000 });
    await page.waitForSelector('#groups .app:has-text("Memos")', { timeout: 5000 });
    await page.fill('#search', '');
    await page.waitForSelector('#starters .starter', { timeout: 5000 });
  } },
  { name: 'Update all apps now', screen: 'status', run: async (page) => {
    await page.click('#updateAll');
    await page.waitForSelector('#cliLog:has-text("Updates now what the nightly update would")', { timeout: 5000 });
    await page.click('#cliActions button:has-text("Update them")');
    await page.waitForSelector('#cliLog:has-text("updated navidrome")', { timeout: 5000 });
    // The steps came as a bar, filled at the end.
    await page.waitForSelector('#cliProgress:not([hidden]) .step:text-is("Done")', { timeout: 5000 });
  } },
  { name: 'Update shows what is new first', screen: 'status', mock: { releaseNotes: { vikunja: { app: 'vikunja', repo: 'go-vikunja/vikunja', running: 'v0.24.4', placed: true, page: 'https://github.com/go-vikunja/vikunja/releases', releases: [
    { tag: 'v0.24.6', when: '2026-10-12T09:00:00Z', url: 'https://github.com/go-vikunja/vikunja/releases/tag/v0.24.6', notes: 'Fixes\n- Reminders are sent once again' },
    { tag: 'v0.24.5', name: 'Security release', when: '2026-09-30T09:00:00Z', url: 'https://github.com/go-vikunja/vikunja/releases/tag/v0.24.5', notes: '- Link shares respect their expiry' },
  ] } } }, run: async (page) => {
    await page.click('#statusRows tr:has-text("Vikunja") button[aria-label^="Update"]');
    await page.waitForSelector('#cliActions .notes p:has-text("runs v0.24.4; updating brings 2 releases, up to v0.24.6")', { timeout: 5000 });
    await page.waitForSelector('#cliActions .release strong:has-text("v0.24.5 — Security release")');
    if (await page.isVisible('#cliLog')) throw new Error('the empty log shows above the notes');
    await page.click('#cliActions button:has-text("Update")');
    await page.waitForSelector('#cliTitle:has-text("Vikunja: update done")', { timeout: 5000 });
    await page.click('#cliActions button:has-text("Close")');
    // Notes that cannot be read leave Update there.
    await page.click('#statusRows tr:has-text("Navidrome") button[aria-label^="Update"]');
    await page.waitForSelector('#cliActions .notes p:has-text("could not be read")', { timeout: 5000 });
    await page.click('#cliActions button:has-text("Cancel")');
    await page.waitForSelector('#cliPanel', { state: 'hidden' });
  } },
  { name: 'Changed settings show, and Fix it applies them', screen: 'status', mock: { status: { ...status, apps: status.apps.map((a) => (a.id === 'vikunja' ? { ...a, settingsChanged: true } : a)) } }, run: async (page) => {
    await page.waitForSelector('#statusRows tr:has-text("Vikunja") .badge:has-text("settings changed")', { timeout: 5000 });
    await page.waitForSelector('#fixIt:not([hidden])');
  } },
  { name: 'Explain a log with the AI on this machine', screen: 'status', mock: { explainer: 'llama3.2:latest', explained: { vikunja: 'Something is wrong: Vikunja cannot reach its database.' } }, run: async (page) => {
    await page.click('#statusRows tr:has-text("Vikunja") button[aria-label="Logs"]');
    await page.click('#logExplain button:has-text("Explain this log")', { timeout: 5000 });
    await page.waitForSelector('#logExplain .answer:has-text("cannot reach its database")', { timeout: 5000 });
    await page.waitForSelector('#logExplain button:has-text("Ask again")');
  } },
  { name: 'No Explain without a local model', screen: 'status', run: async (page) => {
    await page.click('#statusRows tr:has-text("Vikunja") button[aria-label="Logs"]');
    await page.waitForSelector('#logText:not(:has-text("Loading"))', { timeout: 5000 });
    if (await page.isVisible('#logExplain')) throw new Error('Explain shows without Ollama');
  } },
  { name: 'Kiosk mode shows Status only, without buttons', screen: 'status', run: async (page) => {
    await page.evaluate(() => document.documentElement.classList.add('companion', 'kiosk'));
    await page.waitForSelector('#statusRows tr', { timeout: 5000 });
    if (await page.isVisible('nav')) throw new Error('the sidebar shows');
    const buttons = await page.evaluate(() => [...document.querySelectorAll('main button')].filter((b) => b.offsetParent).map((b) => b.textContent.trim() || b.title));
    if (buttons.length) throw new Error('buttons show: ' + buttons.join(', '));
    if (!(await page.isVisible('#tiles'))) throw new Error('the tiles are hidden');
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
    if (shot.clock) await page.clock.install();
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
