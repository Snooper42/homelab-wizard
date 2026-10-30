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
// A week with long lines, as a homelab that needs looking after gets.
const longWeek = { title: 'Homelab this week: 4 things to look at', problems: 4, body: '\u2022 20 of 21 apps well; needs a look: Cloudflare Tunnel (not running)\n\u2022 Watchdog: failing: crowdsec bouncer\n\u2022 Backups: 5 stale (Navidrome, Audiobookshelf, Calibre-Web, Komga, Kavita)\n\u2022 Off-site jobs: Duplicati is not reachable: connection refused\n\u25e6 No restore test yet (Backups \u203a Test a restore)\n\u25e6 Vault export due (Backups \u203a Password export)\n\u2713 Disk space: 73 GB free of 460 GB (15%)\nReplacing $2,656 a year in subscriptions' };
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
// Navidrome's scan with one folder it cannot read: a warning to explain.
const navidromeLog = [
  'time="2026-10-10T03:00:02Z" level=info msg="Starting scan" library=/music',
  'time="2026-10-10T03:00:09Z" level=warning msg="Could not read folder" path=/music/Live error="permission denied"',
  'time="2026-10-10T03:01:47Z" level=info msg="Scan done" songs=2841 elapsed=1m45s',
  'time="2026-10-10T08:12:30Z" level=info msg="HTTP: GET /rest/getAlbumList2" status=200',
].join('\n');
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

// Backups: last night's copies, one app stale, two paused while their apps
// wait for the Hobbies drive, a restore test 12 days ago.
const hoursAgo = (n) => new Date(Date.now() - n * 3600e3).toISOString();
const dumped = [['nginx-proxy-manager', 'Nginx Proxy Manager', 182e3], ['vaultwarden', 'Vaultwarden', 96e3], ['uptime-kuma', 'Uptime Kuma', 3.1e6], ['ntfy', 'ntfy', 24e3], ['navidrome', 'Navidrome', 8.2e6], ['audiobookshelf', 'Audiobookshelf', 2.4e6], ['immich-database', 'Immich database', 61e6], ['paperless-db', 'Paperless database', 14e6], ['moneymatter-db', 'MoneyMatter database', 1.9e6], ['vikunja', 'Vikunja', 410e3]];
const backups = {
  destination: '~/Library/CloudStorage/ProtonDrive-you@proton.me-folder/homelab-backups', destinationOK: true,
  lastRun: hoursAgo(7.4), envCopied: hoursAgo(7.4), stale: 1, paused: 2, restoreDue: false, staleAfterHours: 26,
  restoreTest: { lastTest: hoursAgo(12 * 24), lastSummary: '12 of 12 sampled files identical', history: [
    { when: hoursAgo(43 * 24), seconds: 212, passed: true, summary: '12 of 12 sampled files identical', job: 'Homelab AppData' },
    { when: hoursAgo(12 * 24), seconds: 187, passed: true, summary: '12 of 12 sampled files identical', job: 'Homelab AppData' },
  ] },
  vaultExport: hoursAgo(9 * 24), vaultDue: false,
  copies: [
    ...dumped.map(([id, name, size]) => ({ id, name, newest: hoursAgo(7.5), size, count: 7, state: 'fresh' })),
    { id: 'mealie', name: 'Mealie', newest: hoursAgo(80), size: 640e3, count: 7, state: 'stale' },
    { id: 'komga', name: 'Komga', newest: hoursAgo(13 * 24), size: 4.6e6, count: 7, state: 'paused', waitingFor: '/Volumes/Hobbies' },
    { id: 'kavita', name: 'Kavita', newest: hoursAgo(13 * 24), size: 1.2e6, count: 7, state: 'paused', waitingFor: '/Volumes/Hobbies' },
    { id: 'moneymatter-attachments', name: 'MoneyMatter (attachments)', volume: true, newest: hoursAgo(7.5), size: 22e6, count: 7, state: 'fresh' },
  ],
};
const duplicatiJobs = [
  ['Homelab AppData', 6.7, '3.311 GiB'], ['Homelab Databases', 7.1, '412 MB'], ['Homelab Infrastructure', 3 * 24, '18.4 MB'],
  ['Homelab Photos', 11, '286 GB'], ['Homelab Secrets', 7.1, '1.20 MB'], ['Homelab Stack Data', 6.6, '96.2 MB'],
].map(([name, h, size]) => ({ id: name, name, lastFinished: hoursAgo(h), nextRun: hoursAgo(h - (h > 24 ? 168 : 24)), size, state: 'ok' }));
const cliLog = { remove: ['Remove the containers for %s? App data on disk is kept.'], 'update-all': ['Updates now what the nightly update would (3 apps): navidrome, vikunja, mealie.', '→ dumping mealie-db first', '✓ updated navidrome, vikunja, mealie'], backup: ['→ dump vaultwarden → recovery-staging/databases/vaultwarden', '✓ vaultwarden: vaultwarden-20261010-091502.sqlite.gz (96 KB)', '✓ immich-database: immich-database-20261010-091503.sql.gz (58.2 MB)', '✓ .env copied and verified'], upgrade: ['Homelab files', '  → 3 change(s) on origin/main:', '  ✓ now at origin/main', 'Start the homelab', '  ✓ nothing to change'], fix: ['Fix it', '  • restart the apps that are unwell, and recreate any that stay unwell: Navidrome', '  ✓ done; homelab doctor checks the rest'], 'restore-test': ['→ asking Duplicati to restore 12 file(s) from "Homelab AppData" into recovery-staging/restore-test', '✓ 12 of 12 sampled files identical'], 'restore-test-kopia': ['→ restoring 12 file(s) from Kopia\'s newest snapshot into recovery-staging/restore-test', '✓ 12 of 12 sampled files identical'] };
const alerts = [
  { id: 'a1', time: hoursAgo(0.6), topic: 'tunnel-watchdog', title: 'Homelab: recovered', message: 'photos.example.com answering again', tags: ['white_check_mark'] },
  { id: 'a2', time: hoursAgo(1.1), topic: 'tunnel-watchdog', title: 'Homelab: something is down', message: 'photos.example.com: HTTP 530 through the tunnel', priority: 4, tags: ['warning'] },
  { id: 'a3', time: hoursAgo(7.9), topic: 'watchtower', title: 'Homelab: apps updated tonight', message: 'Vikunja, Speedtest Tracker' },
];
// The watchdog's last run, a few minutes ago.
// The watchdog's runs per day this week (96 a day, one every 15 minutes):
// Vikunja missed a few on the fourth day, restarting for its update.
const dayKey = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const watchdog = { lastRun: hoursAgo(0.07), checks: 47, failing: [], pending: 0, week: { vikunja: 0.996 },
  days: { vikunja: Object.fromEntries([6, 5, 4, 3, 2, 1, 0].map((n) => [dayKey(n), n === 3 ? [93, 96] : n === 0 ? [40, 40] : [96, 96]])) } };
// The household, for an app's Who uses it.
const people = [
  { username: 'anna', name: 'Anna Smith', email: 'anna@example.com', pocketId: 'p1', added: hoursAgo(24 * 30), removed: '0001-01-01T00:00:00Z' },
  { username: 'ben', name: 'Ben Smith', email: 'ben@example.com', pocketId: 'p2', added: hoursAgo(24 * 20), removed: '0001-01-01T00:00:00Z', apps: ['vikunja', 'mealie'] },
  { username: 'cleo', name: 'Cleo Smith', email: 'cleo@example.com', pocketId: 'p3', added: hoursAgo(24 * 10), removed: '0001-01-01T00:00:00Z', apps: ['immich'] },
];
// What docker stats says of a few apps now.
const usage = [{ name: 'vikunja', cpu: 0.4, mem: '182MiB' }, { name: 'paperless', cpu: 6.1, mem: '610MiB' }, { name: 'vaultwarden', cpu: 0.2, mem: '38MiB' }];
// An app's page as the pictures and checks show it.
// A stand-in for an app's favicon, as the Go side hands it over (a data: URL).
const sampleIcon = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#2f6fde"/><path d="M9.5 16.5l4.5 4.5 8.5-9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>').toString('base64');
// A favicon of one pixel: drawn larger with sharp pixels.
const tinyIcon = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const pageMock = { people, usage, icons: { vikunja: sampleIcon } };
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
// Three changes waiting on GitHub, one of them to the app. The version is
// the repository's, so the pictures never show an old one.
const version = readFileSync(join(root, 'VERSION'), 'utf8').trim();
// The update the last look found (app/updates.go): the files and the app.
const update = { state: 'ready', version: '0.15.0', files: 3, app: true, downloaded: true, notes: ['Backups: copies paused while their apps wait for a drive', 'Settings, organized by category', 'Updates are found by themselves, and take one step'] };
const upgrade = {
  branch: 'main', upstream: 'origin/main', behind: 3, ahead: 0, appChanged: true, settingsChanged: false, version, newVersion: version, checked: hoursAgo(0),
  changes: [
    { hash: '0a51554', subject: 'Status draws the apps at once; their pages\' answers fill in after', when: hoursAgo(2) },
    { hash: '7d9be08', subject: 'Settings › Appearance: theme, accent, contrast, and the tray icon\'s colour', when: hoursAgo(5) },
    { hash: 'e657cb2', subject: 'The watchdog makes a gone app again', when: hoursAgo(6) },
  ],
  notes: ['Status shows your apps straight away.', 'Settings › Appearance: pick the theme, an accent colour, and more contrast.', 'The watchdog rebuilds an app whose container was removed.'],
  previous: { version, commit: '5ab0bff1c2', when: hoursAgo(24 * 6) },
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
  { name: 'update', screen: 'status', mock: { update } },
  { name: 'settings', screen: 'settings', before: async (page) => { await page.click('#settingsNav .pagebtn[data-page="Domain"]', { timeout: 5000 }); await page.click('#setting-CLOUDFLARE_API_TOKEN button:has-text("Test")'); await page.waitForTimeout(500); } },
  // The phone companion (homelab serve): the same screens at phone width.
  { name: 'phone', screen: 'status', phone: ['companion'] },
  { name: 'phone-backups', screen: 'backups', phone: ['companion', 'can-change'] },
  { name: 'phones', screen: 'settings', before: async (page) => { await page.click('#settingsNav .pagebtn[data-page="Phones"]', { timeout: 5000 }); await page.click('#pairPhone'); await page.waitForSelector('#pairing img'); } },
  // An app's page, its log explained by the AI on this machine.
  { name: 'page', screen: 'app:vikunja', mock: { ...pageMock, explainer: 'llama3.2:latest', explained: { vikunja: 'Vikunja started cleanly, its database is up to date, and every recent request worked (HTTP 200). Nothing to do.' } }, before: async (page) => {
    await page.click('#appLog button:has-text("Explain this")', { timeout: 5000 });
    await page.waitForSelector('#appLog .explained .answer', { timeout: 5000 });
  } },
  // An app's log on its page, a warning tinted, explained by the AI on this machine.
  { name: 'logs', screen: 'app:navidrome', mock: { ...pageMock, explainer: 'llama3.2:latest', logs: { ...logs, navidrome: navidromeLog }, explained: { navidrome: 'Navidrome is running, but one folder of the music library could not be read: /music/Live is not readable by the app. Every other folder was scanned (2,841 songs). To fix it, give the app read access to that folder, then Rescan in Navidrome.' } }, before: async (page) => {
    await page.click('#appLog button:has-text("Explain this")', { timeout: 5000 });
    await page.waitForSelector('#appLog .explained .answer', { timeout: 5000 });
  } },
];

// Clicks through the buttons that run commands, against the fake backend
// (node app/preview/shoot.mjs --smoke, or make app-smoke): each must finish
// with its success text and no script error.
// A crash of the background agent yesterday, as LastCrash returns it.
const crashed = { who: 'the background agent', version: '0.9.7-beta', when: new Date(Date.now() - 864e5).toISOString(), doing: 'main.(*homelab).watchdog', file: 'scripts/logs/crash-2026-10-25.log' };
const smokes = [
  { name: 'After a crash, Status says so and sends the report', screen: 'status', mock: { crash: crashed }, run: async (page) => {
    await page.waitForSelector('#crashNote:not([hidden]) strong:has-text("The background agent stopped unexpectedly yesterday")', { timeout: 5000 });
    await page.click('#crashNote button:has-text("Send the report")');
    await page.waitForSelector('#settings.screen.active #thisMacCard:not(.offpage)', { timeout: 5000 });
    await page.waitForSelector('#emailReport', { timeout: 10000 });
    const [ran, seen] = await page.evaluate(() => [window.__MOCK.homelabRan || [], window.__MOCK.crashSeen]);
    if (!ran.includes('report') || !seen) throw new Error(`report run: ${ran}, seen: ${seen}`);
  } },
  { name: 'A crash note hidden stays hidden', screen: 'status', mock: { crash: crashed }, run: async (page) => {
    await page.click('#crashNote button:has-text("Hide")', { timeout: 5000 });
    await page.waitForSelector('#crashNote[hidden]', { state: 'attached', timeout: 5000 });
    if (!(await page.evaluate(() => window.__MOCK.crashSeen))) throw new Error('not marked seen');
  } },
  { name: 'No crash, no note', screen: 'status', run: async (page) => {
    await page.waitForSelector('#statusRows tr', { timeout: 5000 });
    if (await page.isVisible('#crashNote')) throw new Error('a note without a crash');
  } },
  { name: 'Backups: pick where they go', screen: 'setup', mock: { setup: setup.map((s) => (s.id === 'backups' ? { ...s, state: 'todo', run: undefined, choices: [{ label: 'Use Proton Drive', run: [['duplicati', 'destination', '/p', '--apply']] }, { label: 'Use the Backup drive', run: [['duplicati', 'destination', '/Volumes/Backup/Homelab Backups', '--apply']] }] } : s)) }, run: async (page) => {
    // Backups leave this machine can wait: its choices show under Can wait › Show.
    if (await page.isVisible('#toggleLater')) await page.click('#toggleLater');
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
    await page.click('nav button[data-screen="settings"]');
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
  { name: 'Choose stacks as a Mac: Beszel sees the VM, Frigate the processor', screen: 'choose', run: async (page) => {
    await page.fill('#search', 'beszel');
    await page.waitForSelector('label.app:has-text("Beszel") .sysnote:has-text("OrbStack\'s Linux VM")', { timeout: 5000 });
    await page.fill('#search', 'frigate');
    await page.waitForSelector('label.app:has-text("Frigate") .sysnote:has-text("containers reach no Coral")', { timeout: 5000 });
  } },
  { name: 'Choose stacks as Windows: what Beszel and Frigate do there', screen: 'choose', mock: { platform: 'Win32', host: { ...host, os: 'Windows 11 24H2', machine: 'this PC' } }, run: async (page) => {
    await page.fill('#search', 'beszel');
    await page.waitForSelector('label.app:has-text("Beszel") .sysnote:has-text("Docker Desktop\'s WSL VM")', { timeout: 5000 });
    await page.fill('#search', 'frigate');
    await page.waitForSelector('label.app:has-text("Frigate") .sysnote:has-text("NVIDIA card")', { timeout: 5000 });
  } },
  { name: 'Choose stacks as Linux: Beszel as everywhere, Frigate by hand', screen: 'choose', mock: { platform: 'Linux x86_64', host: { ...host, os: 'Ubuntu 24.04', machine: 'this machine' } }, run: async (page) => {
    await page.fill('#search', 'frigate');
    await page.waitForSelector('label.app:has-text("Frigate") .sysnote:has-text("a Coral or the graphics")', { timeout: 5000 });
    await page.fill('#search', 'beszel');
    await page.waitForSelector('label.app:has-text("Beszel")', { timeout: 5000 });
    if (await page.locator('label.app:has-text("Beszel") .sysnote').count()) throw new Error('Beszel has a note on Linux, where it sees the machine itself');
  } },
  { name: 'Choose stacks as SteamOS: Frigate with its AMD graphics', screen: 'choose', mock: { platform: 'Linux x86_64', host: { ...host, os: 'Linux (SteamOS 3.7)', machine: 'Steam Machine', desktop: 'kde' } }, run: async (page) => {
    await page.fill('#search', 'frigate');
    await page.waitForSelector('label.app:has-text("Frigate") .sysnote:has-text("AMD graphics")', { timeout: 5000 });
  } },
  { name: 'Setup on Windows: the tray icon\'s dot', screen: 'settings', mock: { platform: 'Win32', host: { ...host, os: 'Windows 11 24H2', machine: 'this PC' } }, run: async (page) => {
    await page.waitForSelector('#trayNote:has-text("orange dot on the tray icon")', { timeout: 5000 });
  } },
  { name: 'Setup on GNOME: the tray icon needs AppIndicator', screen: 'settings', mock: { platform: 'Linux x86_64', host: { ...host, os: 'Ubuntu 24.04', machine: 'this machine', desktop: 'gnome' } }, run: async (page) => {
    await page.waitForSelector('#trayNote:has-text("AppIndicator extension")', { timeout: 5000 });
  } },
  { name: 'Setup on KDE: no tray note', screen: 'settings', mock: { platform: 'Linux x86_64', host: { ...host, os: 'Linux (SteamOS 3.7)', machine: 'Steam Machine', desktop: 'kde' } }, run: async (page) => {
    await page.waitForSelector('#trayAtLogin', { timeout: 5000 });
    if (await page.locator('#trayNote').count()) throw new Error('a tray note on KDE, where the tray works as on the others');
  } },
  { name: 'Appearance on Linux with no system accent says why', screen: 'settings', mock: { platform: 'Linux x86_64', host: { ...host, os: 'Ubuntu 22.04', machine: 'this machine', desktop: 'gnome', accent: undefined } }, run: async (page) => {
    await page.click('#settingsNav .pagebtn[data-page="Appearance"]', { timeout: 5000 });
    await page.waitForSelector('#noAccent:has-text("GNOME from version 47")', { timeout: 5000 });
  } },
  { name: 'Nothing left to install says why', screen: 'choose', run: async (page) => {
    await page.click('#more > summary');
    await page.click('label.app:has-text("Vikunja") input');
    await page.waitForSelector('#nothingToInstall:has-text("already running")', { timeout: 5000 });
    if (!(await page.isDisabled('#installBtn'))) throw new Error('Install should be greyed out');
  } },
  { name: 'Backups: copies paused while their apps wait for a drive, the place named, one line a copy', screen: 'backups', run: async (page) => {
    await page.waitForSelector('#copiesTile:has-text("2 more paused: their apps wait for the Hobbies drive")', { timeout: 5000 });
    const value = await page.textContent('#copiesTile .value');
    if (value.replace(/\s+/g, ' ').trim() !== '11 of 12') throw new Error(`copies up to date: ${value}`);
    await page.waitForSelector('#offsiteTile .value:text-is("Proton Drive")', { timeout: 5000 });
    await page.waitForSelector('#offsiteTile:has-text("Encrypted, in homelab-backups")');
    // Paused is folded, with its names and why; stale and up to date are open.
    await page.waitForSelector('tr.copygroup.paused:not(.open) .names:has-text("Komga, Kavita wait for the Hobbies drive; their last copies (13 days ago) are kept")');
    if (await page.isVisible('tr.copy.paused')) throw new Error('the paused copies show before their group is opened');
    await page.waitForSelector('tr.copygroup.stale.open + tr.copy.stale:has-text("Mealie")');
    await page.click('tr.copygroup.paused .foldbtn');
    await page.waitForSelector('tr.copy.paused:has-text("Komga")');
    if (await page.isVisible('tr.copy:has-text("Komga") .dot.bad')) throw new Error('a paused copy shows red');
    if ((await page.textContent('#backupsCount')).trim() !== '1') throw new Error('a paused copy counted as a problem');
    // One line a copy: no cell wraps, nor says "database" under the name.
    const tall = await page.$$eval('tr.copy', (rows) => rows.filter((r) => r.getBoundingClientRect().height > 44).map((r) => r.textContent));
    if (tall.length) throw new Error(`copies on more than one line: ${tall.join(' | ')}`);
    if (await page.isVisible('#copiesCard .local')) throw new Error('"database" under each name');
    // Off-site sizes as the app's other sizes: 3.311 GiB → 3.3 GB.
    await page.waitForSelector('#dupCard .size:text-is("3.3 GB")');
    await page.waitForSelector('#dupCard h2:text-is("Encrypted to Proton Drive")');
  } },
  { name: "Backups: Duplicati waiting for its drive, in words, not Go's error", screen: 'backups', mock: { duplicatiError: 'Post "http://127.0.0.1:8200/api/v1/auth/login": dial tcp 127.0.0.1:8200: connect: connection refused', status: { ...status, apps: [...status.apps, { id: 'duplicati', name: 'Duplicati', state: 'stopped', health: '', waitingFor: '/Volumes/Hobbies' }] } }, run: async (page) => {
    await page.waitForSelector('#dupCard:has-text("Duplicati waits for the Hobbies drive: the jobs show here once it is plugged in.")', { timeout: 5000 });
    if (await page.isVisible('#dupCard:has-text("dial tcp")')) throw new Error("Go's error shows");
  } },
  { name: 'The vault export, moving, and how the backups work: one line each, opening for the rest', screen: 'backups', run: async (page) => {
    await page.waitForSelector('#vaultCard .morerow:not([open]) summary:has-text("Password vault export")', { timeout: 5000 });
    if (await page.isVisible('#vaultCard p')) throw new Error('the vault how-to shows before How');
    await page.click('#vaultCard summary');
    await page.waitForSelector('#vaultCard p:has-text("Tools › Export vault")');
    if (await page.isVisible('#moveOut')) throw new Error('Move out shows before its row is opened');
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
  { name: 'No Kopia line without Kopia', screen: 'backups', run: async (page) => {
    await page.waitForSelector('#dupCard .next', { timeout: 5000 });
    if (!(await page.isHidden('#kopiaCard'))) throw new Error('the Kopia line shows without Kopia');
  } },
  { name: "Kopia's line on Backups, and its restore test", screen: 'backups', mock: { backups: { ...backups, kopia: { repository: '/Volumes/Spare/Homelab Kopia', lastTest: hoursAgo(5 * 24), due: false } } }, run: async (page) => {
    await page.waitForSelector('#kopiaCard:not([hidden]) .ok:has-text("Restore proven")', { timeout: 5000 });
    await page.waitForSelector('#kopiaCard:has-text("…/Spare/Homelab Kopia")', { timeout: 5000 });
    await page.click('#kopiaCard button:has-text("Test Kopia\'s restore")');
    await page.waitForSelector('#backupTitle:has-text("Kopia\'s restore test passed")', { timeout: 5000 });
  } },
  { name: "Kopia's failed restore test shows", screen: 'backups', mock: { backups: { ...backups, kopia: { repository: './backups-kopia', lastTest: hoursAgo(40 * 24), failed: '3 of 12 sampled files differ', due: true } } }, run: async (page) => {
    await page.waitForSelector('#kopiaCard .bad:has-text("Restore test failed")', { timeout: 5000 });
    await page.waitForSelector('#kopiaCard:has-text("3 of 12 sampled files differ")', { timeout: 5000 });
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
    await page.click('#runAll:has-text("Do the 2 I can do for you")', { timeout: 5000 });
    await page.waitForSelector('#setupLog:has-text("What is left needs you")', { timeout: 8000 });
    const ran = await page.evaluate(() => window.__MOCK.ran);
    if (ran.join() !== 'a,b') throw new Error(`ran ${ran}`);
    if (await page.isVisible('#runAll')) throw new Error('nothing is left to run');
  } },
  // Setup is in the sidebar while something needs you; once every step is
  // done it leaves (owner, 29 Oct), and still opens from its shortcut.
  { name: 'Setup leaves the sidebar once nothing needs you', screen: 'status', mock: { setup: setup.map((s) => ({ ...s, state: 'done' })) }, run: async (page) => {
    await page.waitForSelector('nav button[data-screen="setup"]', { state: 'hidden', timeout: 5000 });
    const mod = (await page.evaluate(() => navigator.platform)).startsWith('Mac') ? 'Meta' : 'Control';
    await page.keyboard.press(`${mod}+4`);
    await page.waitForSelector('#setup.active #checkTitle:text-is("Everything is set up")', { timeout: 5000 });
    if (!(await page.isVisible('nav button[data-screen="setup"]'))) throw new Error('Setup, open, is not in the sidebar');
    await page.waitForSelector('#checklist li.alldone:has-text("steps are done")');
    await page.click('nav button[data-screen="status"]');
    await page.waitForSelector('nav button[data-screen="setup"]', { state: 'hidden', timeout: 5000 });
  } },
  { name: 'Setup stays in the sidebar while a step is left', screen: 'status', run: async (page) => {
    await page.waitForSelector('#statusRows tr', { timeout: 5000 });
    await page.waitForTimeout(300);
    if (!(await page.isVisible('nav button[data-screen="setup"]'))) throw new Error('Setup left the sidebar with steps to do');
  } },
  { name: "Setup's tiles: a stopped agent says so, and Start it starts it", screen: 'setup', mock: { health: { agent: 'stopped', lastCheck: '0001-01-01T00:00:00Z', power: 'battery', keptAwake: true } }, run: async (page) => {
    await page.waitForSelector('#health-agent:has-text("Stopped")', { timeout: 5000 });
    await page.waitForSelector('#health-power:has-text("On battery")');
    await page.waitForSelector('#health-runtime:has-text("OrbStack")');
    await page.waitForSelector('#health-disk:has-text("free")');
    await page.click('#startAgent');
    await page.waitForSelector('#health-agent:has-text("Running")', { timeout: 5000 });
    if (!(await page.evaluate(() => window.__MOCK.agentStarted))) throw new Error('Start it did not start the agent');
  } },
  { name: "Status keeps this machine's line", screen: 'status', mock: { health: { agent: 'running', lastCheck: new Date().toISOString(), power: 'battery', keptAwake: true } }, run: async (page) => {
    await page.waitForSelector('#healthLine .item.warn:has-text("On battery")', { timeout: 5000 });
    await page.waitForSelector('#healthLine .item.ok:has-text("Backups and checks on")');
  } },
  { name: 'Finish setting up: what can wait folds, and a step opens for the rest', screen: 'setup', mock: { setup: [
    { id: 'a', title: 'Step A', why: 'Why A matters, at some length so that it would not fit on one line beside its buttons at all.', detail: 'Right now: something to know about A.', state: 'todo', run: [['a']] },
    { id: 'b', title: 'Step B', why: 'x', state: 'todo', later: true },
    { id: 'c', title: 'Step C', why: 'x', state: 'done' }] }, run: async (page) => {
    await page.waitForSelector('#checklist li.grouphead:text-is("Needs you · 1")', { timeout: 5000 });
    if (await page.isVisible('#checklist li:has-text("Right now: something to know about A")')) throw new Error("a step's detail shows before it is opened");
    await page.click('#checklist li.todo .more');
    await page.waitForSelector('#checklist li.open .detail:has-text("Right now: something to know about A")');
    if (await page.isVisible('#checklist li.todo:has(.title:text-is("Step B"))')) throw new Error('what can wait shows before Show');
    await page.click('#toggleLater');
    await page.waitForSelector('#checklist li:has(.title:text-is("Step B"))');
    await page.click('#toggleDone');
    await page.waitForSelector('#checklist li.done:has(.title:text-is("Step C"))');
  } },
  { name: 'The diagnostics report, from Settings › This Mac', screen: 'settings', run: async (page) => {
    await page.waitForSelector('#thisMacCard #hostInfo:has-text("Homelab folder")', { timeout: 5000 });
    await page.click('#report');
    await page.waitForSelector('#reportLog:not([hidden])', { timeout: 5000 });
  } },
  { name: 'SteamOS: Set up Docker for me moves its bar through the download', screen: 'setup', mock: {
    host: { ...host, os: 'Linux (SteamOS 3.7)', machine: 'Steam Machine', desktop: 'kde', runtimeOK: false },
    setup: [{ id: 'runtime', title: 'Docker', why: 'The apps run in Docker.', state: 'todo', run: [['runtime', 'install', '--apply']], runLabel: 'Set up Docker for me' }],
    runSteps: { runtime: [{ n: 1, total: 3, text: 'Downloading Docker', percent: 40 }, { n: 1, total: 3, text: 'Downloading Docker', percent: 90 }] },
  }, run: async (page) => {
    await page.click('button:has-text("Set up Docker for me")', { timeout: 5000 });
    await page.waitForSelector('#setupProgress:not([hidden]) .step:has-text("Downloading Docker · 90% · 1 of 3")', { timeout: 5000 });
    const width = await page.evaluate(() => document.querySelector('#setupProgress .fill').style.width);
    if (width !== '30%') throw new Error(`the bar is at ${width}, not 30% (90% of the first of three steps)`);
  } },
  { name: 'Update now: the homelab files, then Updated to, without leaving the screen', screen: 'backups', mock: { update: { ...update, app: false } }, run: async (page) => {
    await page.waitForSelector('#updateLine:not([hidden]) .head:text-is("Homelab Wizard 0.15.0 is ready")', { timeout: 5000 });
    await page.click('#updateNow');
    await page.waitForSelector('#updateLine .head:text-is("Updating…")', { timeout: 2000 });
    await page.waitForSelector('#updateLine.done .head:text-is("Updated to 0.15.0")', { timeout: 5000 });
    if (!(await page.isVisible('#backups.screen.active'))) throw new Error('the update took the window to another screen');
    if (await page.isVisible('#setupLog')) throw new Error('the update showed a log');
    await page.click('#updateWhatsNew');
    await page.waitForSelector('#updateNotes li:has-text("Settings, organized by category")');
    await page.click('#updateClose');
    await page.waitForSelector('#updateLine', { state: 'hidden' });
  } },
  { name: 'A finished Go back stays on Setup until Clear', screen: 'settings', mock: { upgrade: { ...upgrade, previous: { commit: 'abc1234', version: '0.13.0', when: new Date(Date.now() - 864e5).toISOString() } }, jobApps: { 'upgrade-back': ['navidrome', 'vikunja', 'mealie'] } }, run: async (page) => {
    await page.click('#upgradeBack', { timeout: 5000 });
    await page.click('#upgradeBack');
    // The rows fold Show details away: the log is there, not shown.
    await page.waitForSelector('#setupLog:has-text("Going back")', { state: 'attached', timeout: 8000 });
    // The owner's report (28 Oct): after a job the apps' rows stayed on
    // Setup with nothing to take them off.
    await page.waitForSelector('#setupApps li:has-text("Vikunja")', { timeout: 5000 });
    await page.click('#setupClear', { timeout: 8000 });
    const left = await page.evaluate(() => ({
      rows: document.querySelectorAll('#setupApps li').length,
      bar: !document.querySelector('#setupProgress').hidden,
      log: !document.querySelector('#setupLog').hidden || document.querySelector('#setupLog').textContent !== '',
      clear: !document.querySelector('#setupClear').hidden,
    }));
    if (left.rows || left.bar || left.log || left.clear) throw new Error(`Clear left ${JSON.stringify(left)}`);
  } },
  { name: 'Update now puts the files in place, then the app, which opens again', screen: 'status', mock: { update }, run: async (page) => {
    await page.click('#updateNow', { timeout: 5000 });
    await page.waitForFunction(() => window.__MOCK.appInstalled === true, null, { timeout: 5000 });
    const ran = await page.evaluate(() => window.__MOCK.updating);
    if (!ran) throw new Error('Update now did not run');
    if (!(await page.isVisible('#updateLine .head:text-is("Updating…")'))) throw new Error('the line does not say it is updating');
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
  { name: 'Open an app on a phone, from its page', screen: 'app:vaultwarden', run: async (page) => {
    await page.click('#app button:has-text("Open on a phone")', { timeout: 5000 });
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
  { name: 'Sign-in details for the proxy, from its page', screen: 'app:nginx-proxy-manager', run: async (page) => {
    await page.click('#appPeople button:has-text("Sign-in details")', { timeout: 5000 });
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
  { name: 'Links that act work from the keyboard', screen: 'status', mock: { update }, run: async (page) => {
    await page.click('#updateLater', { timeout: 5000 });
    await page.focus('#footUpdate', { timeout: 5000 });
    await page.keyboard.press('Enter');
    await page.waitForSelector('#updateLine:not([hidden])', { timeout: 5000 });
  } },
  { name: 'After Later, the sidebar says an update is ready, and brings the line back', screen: 'status', mock: { update }, run: async (page) => {
    if (await page.isVisible('#footUpdate')) throw new Error('the sidebar repeats the line');
    await page.click('#updateLater', { timeout: 5000 });
    await page.waitForSelector('#updateLine', { state: 'hidden' });
    await page.click('#footUpdate:has-text("Update ready")', { timeout: 5000 });
    await page.waitForSelector('#updateLine:not([hidden]) #updateNow');
    if (await page.isVisible('#setup.active')) throw new Error('it opened Setup');
  } },
  { name: 'Update now for a newer app build alone', screen: 'settings', mock: { update: { ...update, files: 0 } }, run: async (page) => {
    await page.click('#updateNow', { timeout: 5000 });
    await page.waitForFunction(() => window.__MOCK.appInstalled === true, null, { timeout: 5000 });
  } },
  { name: 'A build made by hand is told to get the newest, in one line', screen: 'status', mock: { update: { state: 'blocked', app: false, files: 0, blocked: 'This build was made by hand: build or download the newest one' }, upgrade: { ...upgrade, behind: 0, changes: [], appBehind: 2, appCommit: '0123456789', web: 'https://github.com/o/r' } }, run: async (page) => {
    await page.waitForSelector('#updateLine:not([hidden]) .sub:has-text("made by hand")', { timeout: 5000 });
    if (await page.isVisible('#updateNow')) throw new Error('Update now offered where it cannot');
    await page.click('nav button[data-screen="settings"]');
    await page.waitForSelector('#versionInfo:has-text("build 0123456")');
  } },
  { name: 'The footer keeps the version whole on Windows', screen: 'setup', mock: { host: { ...host, os: 'Windows 11 Pro 24H2' } }, run: async (page) => {
    await page.waitForSelector('#foot .part:has-text("Windows 11 Pro 24H2")', { timeout: 5000 });
    const lines = await page.evaluate(() => [...document.querySelectorAll('#foot .part')].map((e) => e.getClientRects().length));
    if (lines.some((n) => n !== 1)) throw new Error(`a footer part wraps: ${lines}`);
  } },
  { name: 'A copy that cannot replace itself offers its download', screen: 'status', mock: { host: { ...host, os: 'Windows 11', machine: 'this machine' }, update: { state: 'blocked', version: '0.15.0', app: true, files: 0, blocked: 'This copy of the app cannot replace itself: download the new one', page: 'https://github.com/o/r/releases/tag/v0.15.0' } }, run: async (page) => {
    await page.click('#updateDownload', { timeout: 5000 });
    const opened = await page.evaluate(() => window.__MOCK.opened || '');
    if (!opened.includes('/releases/tag/v0.15.0')) throw new Error(`opened ${opened}`);
    await page.click('nav button[data-screen="settings"]');
    await page.waitForSelector('#hostInfo:has-text("Tray icon")');
  } },
  { name: 'Install on quit is on until turned off, and not offered where installing asks for a password', screen: 'settings', mock: { update: { ...update, canInstallOnQuit: true } }, run: async (page) => {
    await page.waitForSelector('#updatesSettings #installOnQuit:checked', { timeout: 5000 });
    await page.click('#updatesSettings #installOnQuit');
    await page.waitForFunction(() => window.__MOCK.installOnQuit === false);
    await page.waitForSelector('#updatesSettings:has-text("Last looked 3 minutes ago")');
    await page.click('#lookNow');
    await page.waitForFunction(() => window.__MOCK.looksNow === 1);
  } },
  { name: 'No install on quit where installing asks for a password', screen: 'settings', mock: { platform: 'Linux x86_64', host: { ...host, os: 'Ubuntu 24.04', machine: 'this machine' }, update: { ...update, canInstallOnQuit: false } }, run: async (page) => {
    await page.waitForSelector('#updatesSettings:has-text("Look for updates")', { timeout: 5000 });
    if (await page.$('#installOnQuit')) throw new Error('install on quit offered where installing asks for a password');
  } },
  { name: 'Version says up to date once', screen: 'settings', run: async (page) => {
    await page.waitForSelector('#versionInfo:has-text("up to date")', { timeout: 5000 });
    // Check again (on Setup) reads the machine and the update again.
    await page.evaluate(() => document.getElementById('recheck').click());
    await page.waitForTimeout(800);
    const text = await page.textContent('#versionInfo');
    if (text.split('up to date').length !== 2) throw new Error(`version line: ${text}`);
  } },
  { name: 'No app menu row outside the AppImage', screen: 'settings', run: async (page) => {
    await page.waitForSelector('#hostInfo:has-text("Homelab folder")', { timeout: 5000 });
    if (await page.$('#menuEntry')) throw new Error('the app menu row shows outside the AppImage');
  } },
  { name: 'AppImage: add to the app menu', screen: 'settings', mock: { menuEntry: { added: false }, host: { ...host, os: 'Linux (SteamOS 3.7)', machine: 'Steam Machine' } }, run: async (page) => {
    await page.waitForSelector('#hostInfo:has-text("opened from its file")', { timeout: 5000 });
    await page.click('#menuEntry');
    await page.waitForSelector('#hostInfo:has-text("in the app menu")', { timeout: 5000 });
  } },
  { name: 'A low disk in Settings › This machine', screen: 'settings', mock: { host: { ...host, disks: [{ ...host.disks[0], space: '6.0 GB free of 994 GB (0%)', free: 6e9, low: true, hint: 'Under 49 GB: unused images (docker image prune -a), finished downloads, and Immich\'s trash are the usual places to free some' }, host.disks[1]] } }, run: async (page) => {
    await page.waitForSelector('#diskSpace .bad:has-text("6.0 GB free")', { timeout: 5000 });
    await page.waitForSelector('#diskSpace:has-text("docker image prune")', { timeout: 5000 });
    await page.waitForSelector('#diskSpace .disk.low .storagebar span[style*="99%"]');
    await page.waitForSelector('#diskSpace .disk:has(strong:text-is("Hobbies")) .storagebar');
  } },
  { name: 'Tray at login', screen: 'settings', run: async (page) => {
    await page.waitForSelector('#hostInfo:has-text("only while the app is open")', { timeout: 5000 });
    await page.click('#trayAtLogin');
    await page.waitForSelector('#hostInfo:has-text("starts at login")', { timeout: 5000 });
  } },
  { name: 'Tray at sign-in, in Windows\' word', screen: 'settings', mock: { platform: 'Win32', host: { ...host, os: 'Windows 11' } }, run: async (page) => {
    await page.click('#trayAtLogin:has-text("Start at sign-in")', { timeout: 5000 });
    await page.waitForSelector('#hostInfo:has-text("starts at sign-in")', { timeout: 5000 });
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
    // An app's page is in its category's fold.
    await page.click('#settingsNav .navfold:has-text("Network")', { timeout: 5000 });
    await page.click('#settingsNav .pagebtn[data-page="AdGuard Home"]', { timeout: 5000 }); 
    if (await page.isVisible('#setting-TZ')) throw new Error('another page still shows');
    await page.fill('#setting-ADGUARD_PASSWORD input', 'typed-not-saved');
    await page.click('#setting-ADGUARD_PASSWORD button:has-text("Test")');
    await page.waitForSelector('#setting-ADGUARD_PASSWORD .test.ok', { timeout: 5000 });
    if (await page.evaluate(() => window.__MOCK.saved?.ADGUARD_PASSWORD) !== 'typed-not-saved') throw new Error('Test did not save the typed value first');
  } },
  { name: 'Testing the Cloudflare token saves the Domain typed above it', screen: 'settings', run: async (page) => {
    await page.click('#settingsNav .pagebtn[data-page="Domain"]', { timeout: 5000 });
    await page.fill('#setting-HOMELAB_DOMAIN input', 'snooper42.com');
    await page.click('#setting-CLOUDFLARE_API_TOKEN button:has-text("Test")');
    await page.waitForSelector('#setting-CLOUDFLARE_API_TOKEN .test.ok', { timeout: 5000 });
    if (await page.evaluate(() => window.__MOCK.saved?.HOMELAB_DOMAIN) !== 'snooper42.com') throw new Error('Test did not save the typed Domain first');
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
      const app = window.go.main.App, status = app.StatusBoard;
      window.__statusCalls = 0;
      app.StatusBoard = (...a) => { window.__statusCalls++; return status(...a); };
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
  { name: 'A homelab with no apps yet: Status says to choose some, with no empty list', screen: 'status', mock: { status: { ...status, apps: [], savings: 0 } }, run: async (page) => {
    await page.waitForSelector('#statusEmpty:has-text("No apps yet")', { timeout: 5000 });
    for (const sel of ['#tiles .tile', '#status table.grouped', '#statusAll']) if (await page.isVisible(sel)) throw new Error(`${sel} shows with no apps`);
    await page.click('#statusEmpty button:text-is("Choose stacks")');
    await page.waitForSelector('#choose.screen.active', { timeout: 5000 });
  } },
  { name: 'Backups before the first night: no 0 of 0, and no restore test said to be proven', screen: 'backups', mock: { backups: { ...backups, lastRun: undefined, envCopied: undefined, stale: 0, paused: 0, copies: [], restoreTest: { history: [] } } }, run: async (page) => {
    await page.waitForSelector('#copiesTile .value:text-is("None yet")', { timeout: 5000 });
    await page.waitForSelector('#restoreTile .value:text-is("Never")');
    if (await page.isVisible('#restoreTile:has-text("Proven")')) throw new Error('a restore test that never ran is called proven');
  } },
  { name: 'Windows high contrast: an app’s week shows the day with missed checks', screen: 'app:vikunja', mock: { ...pageMock, platform: 'Win32' }, run: async (page) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.waitForSelector('.weekbars .bar.ok', { timeout: 5000 });
    // The system would paint every bar in its own background colour: they keep theirs, solid or hatched.
    const bars = await page.evaluate(() => {
      const look = (e) => e && { adjust: getComputedStyle(e).forcedColorAdjust, color: getComputedStyle(e).backgroundColor, image: getComputedStyle(e).backgroundImage };
      return { good: look(document.querySelector('.weekbars .bar.ok')), missed: look(document.querySelector('.weekbars .bar:is(.warn, .bad)')) };
    });
    if (!bars.missed) throw new Error('the example week has no day with missed checks');
    if (bars.good.adjust !== 'none' || bars.missed.adjust !== 'none') throw new Error('the system repaints the week bars all alike');
    if (!/gradient/.test(bars.missed.image) || bars.good.image !== 'none') throw new Error(`a day with missed checks is not hatched: ${JSON.stringify(bars)}`);
  } },
  { name: 'Windows high contrast: a switch shows whether it is on', screen: 'app:vikunja', mock: { ...pageMock, platform: 'Win32' }, run: async (page) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.waitForSelector('#appSettings input.switch', { timeout: 5000 });
    // The same switch drawn on and off: its track and its knob must differ.
    const look = () => page.$eval('#appSettings input.switch', (e) => [getComputedStyle(e).forcedColorAdjust, getComputedStyle(e).backgroundColor, getComputedStyle(e, '::after').backgroundColor, getComputedStyle(e).borderTopColor]);
    const on = await page.$eval('#appSettings input.switch', (e) => e.checked);
    const first = await look();
    await page.$eval('#appSettings input.switch', (e) => { e.checked = !e.checked; });
    await page.waitForTimeout(400); // past the switch's colour transition
    const second = await look();
    if (first[0] !== 'none') throw new Error('the system repaints the switch, knob and track alike');
    if (first[1] === second[1]) throw new Error(`the track is ${first[1]} both ${on ? 'on' : 'off'} and ${on ? 'off' : 'on'}`);
    if (first[2] === first[1] || second[2] === second[1]) throw new Error('the knob is the colour of its track');
  } },
  { name: 'Keyboard: Ctrl+2 opens Status on Windows', screen: 'setup', mock: { platform: 'Win32' }, run: async (page) => {
    await page.keyboard.press('Control+2');
    await page.waitForSelector('#status.screen.active', { timeout: 5000 });
    if (!(await page.$('html.os-windows'))) throw new Error('no os-windows class');
  } },
  { name: 'Windows: buttons and links take the accent picked in Settings', screen: 'status', mock: { platform: 'Win32', host: { ...host, os: 'Windows 11', accent: { light: '#c30052', dark: '#ff4fa3' } } }, run: async (page) => {
    await page.waitForSelector('html.sys-accent', { timeout: 5000 });
    const [accent, dark] = await page.evaluate(() => [getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), matchMedia('(prefers-color-scheme: dark)').matches]);
    if (accent !== (dark ? '#ff4fa3' : '#c30052')) throw new Error(`--accent is ${accent}`);
  } },
  { name: 'Mac: the Dock icon shows how many apps need a look', screen: 'status', run: async (page) => {
    await page.waitForFunction(() => window.__MOCK.attention !== undefined, null, { timeout: 5000 });
    const [dock, side] = await page.evaluate(() => [window.__MOCK.attention, document.getElementById('statusCount').textContent]);
    if (String(dock) !== side) throw new Error(`Dock ${dock}, sidebar ${side}`);
  } },
  { name: 'Mac: the accent from System Settings, with dark text on yellow', screen: 'status', mock: { host: { ...host, accent: { light: '#ffcc00', dark: '#ffd60a', text: '#000' } } }, run: async (page) => {
    await page.waitForSelector('html.os-mac.sys-accent', { timeout: 5000 });
    const css = await page.evaluate(() => { const s = getComputedStyle(document.documentElement); return [s.getPropertyValue('--accent').trim(), s.getPropertyValue('--accent-text').trim(), matchMedia('(prefers-color-scheme: dark)').matches]; });
    if (css[0] !== (css[2] ? '#ffd60a' : '#ffcc00') || css[1] !== '#000') throw new Error(css.join(' '));
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
    if (css[0] !== css[1] || !css[0]) throw new Error(`--line ${css[0]}, --line-strong ${css[1]}`);
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
    const [pane, dark] = await page.evaluate(() => [getComputedStyle(document.querySelector('nav')).backgroundColor, matchMedia('(prefers-color-scheme: dark)').matches]);
    if (pane !== (dark ? 'rgb(32, 32, 32)' : 'rgb(243, 243, 243)')) throw new Error(`pane ${pane}`);
    await page.evaluate(() => window.__emit && document.documentElement.classList.add('backdrop'));
    const glass = await page.evaluate(() => getComputedStyle(document.querySelector('nav')).backgroundColor);
    if (glass !== 'rgba(0, 0, 0, 0)') throw new Error(`with Mica the pane should be clear: ${glass}`);
  } },
  { name: 'Linux: a grey sidebar, not the navy one', screen: 'status', mock: { platform: 'Linux x86_64' }, run: async (page) => {
    const [pane, dark] = await page.evaluate(() => [getComputedStyle(document.querySelector('nav')).backgroundColor, matchMedia('(prefers-color-scheme: dark)').matches]);
    if (pane !== (dark ? 'rgb(46, 46, 50)' : 'rgb(235, 235, 237)')) throw new Error(`pane ${pane}`);
  } },
  { name: 'Buttons show the arrow, labels do not select', screen: 'status', run: async (page) => {
    const [cursor, select, field] = await page.evaluate(() => [getComputedStyle(document.querySelector('nav button')).cursor, getComputedStyle(document.querySelector('h1')).userSelect, getComputedStyle(document.querySelector('pre') || document.body).userSelect]);
    if (cursor !== 'default' || select !== 'none' || field !== 'text') throw new Error(`cursor ${cursor}, h1 ${select}, pre ${field}`);
  } },
  { name: "Settings: plain names, the .env name on hover and while searching, no true/false in a switch's help", screen: 'settings', run: async (page) => {
    await page.waitForSelector('#setting-TZ .label:text-is("Time zone")', { timeout: 5000 });
    if (await page.isVisible('#setting-TZ .key code')) throw new Error('the .env name shows beside every setting');
    if ((await page.getAttribute('#setting-TZ .key', 'title')) !== 'TZ') throw new Error('no .env name on hover');
    const help = await page.textContent('#setting-KEEP_AWAKE .help');
    if (/\b(true|false)\b/.test(help)) throw new Error(`a switch's help spells out a value: ${help}`);
    await page.fill('#settingsSearch', 'TZ');
    await page.waitForSelector('#setting-TZ .key code', { state: 'visible', timeout: 5000 });
  } },
  { name: 'Settings: a page per app, with its port', screen: 'settings', run: async (page) => {
    await page.waitForSelector('#settingsNav .navhead:text-is("Apps")', { timeout: 5000 });
    // Folded by category, as on Status; a search opens the folds with matches.
    if (await page.isVisible('#settingsNav .pagebtn[data-page="Immich"]')) throw new Error('the apps are not folded');
    await page.click('#settingsNav .navfold:has-text("Cloud & Files")');
    await page.click('#settingsNav .pagebtn[data-page="Immich"]');
    await page.waitForSelector('#setting-IMMICH_PORT', { state: 'visible' });
    await page.click('#settingsNav .navfold:has-text("Cloud & Files")');
    await page.waitForSelector('#settingsNav .pagebtn[data-page="Immich"]', { state: 'detached' });
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
  { name: 'The phone companion before the scheduled jobs: why it is not running', screen: 'status', mock: { statusOpen: 'all', status: { ...status, apps: status.apps.map((a) => (a.id === 'homelab-companion' ? { ...a, state: 'not running' } : a)) } }, run: async (page) => {
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
  { name: 'Start Jellyfin on Linux says it asks for the password', screen: 'status', mock: { platform: 'Linux x86_64', status: { ...status, apps: status.apps.map((a) => (a.id === 'jellyfin' ? { ...a, state: 'not running', health: '' } : a)) } }, run: async (page) => {
    const title = await page.getAttribute('tr:has(strong:text-is("Jellyfin")) button:has-text("Start")', 'title', { timeout: 5000 });
    if (!title || !title.includes('asks for your password')) throw new Error(`Linux: ${title}`);
  } },
  { name: 'Start Jellyfin on Windows says it asks for approval', screen: 'status', mock: { platform: 'Win32', host: { ...host, os: 'Windows 11 24H2' }, status: { ...status, apps: status.apps.map((a) => (a.id === 'jellyfin' ? { ...a, state: 'not running', health: '' } : a)) } }, run: async (page) => {
    const title = await page.getAttribute('tr:has(strong:text-is("Jellyfin")) button:has-text("Start")', 'title', { timeout: 5000 });
    if (!title || !title.includes('Windows asks for approval')) throw new Error(`Windows: ${title}`);
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
  { name: 'After a new app opens, its homelab files follow by themselves', screen: 'status', mock: { update: { state: 'ready', files: 1, app: false, finish: true, version: '0.15.0', notes: ['A change'] } }, run: async (page) => {
    await page.waitForSelector('#updateLine.done .head:text-is("Updated to 0.15.0")', { timeout: 5000 });
    if (await page.isVisible('#updateNow')) throw new Error('it asked for what goes in place by itself');
  } },
  { name: 'An update found in the background: What’s new, no Check again needed', screen: 'status', mock: { update }, run: async (page) => {
    await page.waitForSelector('#updateLine:not([hidden]):has-text("Homelab Wizard 0.15.0 is ready")', { timeout: 5000 });
    if (await page.isVisible('#updateNotes')) throw new Error('the notes show before What’s new');
    await page.click('#updateWhatsNew');
    await page.waitForSelector('#updateNotes li:has-text("Updates are found by themselves")');
    // The window coming forward looks again (at most every 10 minutes, app/updates.go).
    const before = await page.evaluate(() => window.__MOCK.looks || 0);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForFunction((n) => (window.__MOCK.looks || 0) > n, before, { timeout: 5000 });
  } },
  { name: 'An update the app finds while open shows by itself', screen: 'status', run: async (page) => {
    await page.waitForSelector('#statusRows tr', { timeout: 5000 });
    if (await page.isVisible('#updateLine')) throw new Error('a line before an update');
    await page.evaluate((u) => window.__emit('update:state', { ...u, looked: new Date().toISOString(), installOnQuit: true, canInstallOnQuit: true }), update);
    await page.waitForSelector('#updateLine:not([hidden]) #updateNow', { timeout: 2000 });
  } },
  { name: 'Update now shows how far it has come', screen: 'status', mock: { update: { ...update, files: 0, downloaded: false }, downloadSteps: [10, 80] }, run: async (page) => {
    await page.click('#updateNow', { timeout: 5000 });
    await page.waitForFunction(() => Number(document.querySelector('#updateLine [role="progressbar"]')?.getAttribute('aria-valuenow')) >= 88, null, { timeout: 5000 });
    await page.waitForFunction(() => window.__MOCK.appInstalled === true);
  } },
  { name: 'An update that stops says why, with Details and Try again', screen: 'status', mock: { update: { ...update, app: false }, updateFails: 'the homelab folder has local changes to compose/media.yaml' }, run: async (page) => {
    await page.click('#updateNow', { timeout: 5000 });
    await page.waitForSelector('#updateLine.failed .sub:has-text("local changes to compose/media.yaml")', { timeout: 5000 });
    await page.click('#updateDetails');
    await page.waitForSelector('#updateLog:has-text("homelab upgrade --apply")');
    await page.waitForSelector('#updateRetry');
  } },
  { name: 'Later hides the update line', screen: 'status', mock: { update: { ...update, notes: [] } }, run: async (page) => {
    if (await page.isVisible('#updateWhatsNew', { timeout: 5000 })) throw new Error('What’s new shows with no notes');
    await page.click('#updateLater', { timeout: 5000 });
    await page.waitForSelector('#updateLine', { state: 'hidden' });
  } },
  { name: 'No update line without an update', screen: 'status', run: async (page) => {
    await page.waitForSelector('#statusRows tr', { timeout: 5000 });
    if (await page.isVisible('#updateLine')) throw new Error('the update line shows with no update');
  } },
  { name: 'An app that updates itself never asks for a download', screen: 'status', mock: { update }, run: async (page) => {
    await page.waitForSelector('#updateLine:not([hidden]) #updateNow', { timeout: 5000 });
    if (await page.isVisible('#updateDownload') || await page.isVisible('#updateLine:has-text("drag")')) throw new Error('a self-updating app is told to download');
  } },
  { name: 'What runs in the background', screen: 'settings', run: async (page) => {
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
  { name: "The agent's change carries Status: drawn on any screen, nothing asked", screen: 'status', run: async (page) => {
    await page.waitForSelector('tr:has(strong:text-is("Navidrome")) td.state:has-text("Running")', { timeout: 5000 });
    await page.click('nav button[data-screen="backups"]');
    const before = await backendCalls(page);
    await page.evaluate(() => {
      const M = window.__MOCK;
      const st = { ...M.status, apps: M.status.apps.map((a) => (a.id === 'navidrome' ? { ...a, state: 'stopped', health: '' } : a)) };
      window.__emit('status:changed', { apps: ['navidrome'], status: st });
    });
    await page.click('nav button[data-screen="status"]');
    await page.waitForSelector('tr:has(strong:text-is("Navidrome")) td.state:has-text("Stopped")', { timeout: 2000 });
    const asked = diffCalls(before, await backendCalls(page)).filter((c) => c.startsWith('StatusBoard '));
    if (asked.length) throw new Error(`Status was asked again: ${asked}`);
  } },
  // One request when Status opens: the cards come with it, each drawn as
  // it is read, the quick ones while the slow one is still on its way.
  { name: 'Status opens in one request; its cards fill in one by one', screen: 'status',
    mock: { status: { ...status, checking: true }, answers: { vikunja: 'HTTP 502' }, cardDelay: { week: 1500 } }, run: async (page) => {
      await page.waitForSelector('#watchCard:not([hidden])', { timeout: 5000 });
      await page.waitForSelector('#alertsCard:not([hidden])', { timeout: 2000 });
      await page.waitForSelector('tr:has(strong:text-is("Vikunja")) td.state:has-text("Not answering: HTTP 502")', { timeout: 2000 });
      if (await page.isVisible('#weekCard')) throw new Error('the slow card came with the quick ones');
      await page.waitForSelector('#weekCard:not([hidden])', { timeout: 3000 });
      const reads = ['Status', 'StatusBoard', 'Watchdog', 'LastCrash', 'SavingsHistory', 'Alerts', 'Storage', 'Usage', 'Weekly', 'Protection', 'Answers'];
      const asked = Object.entries(await backendCalls(page)).filter(([k]) => reads.includes(k)).map(([k, n]) => `${k} ×${n}`);
      if (asked.join(', ') !== 'StatusBoard ×1') throw new Error('Status asked: ' + asked.join(', '));
    } },
  { name: 'A live change keeps the focus where it was', screen: 'status', run: async (page) => {
    await page.focus('#statusRows tr:has(strong:text-is("Vikunja")) button.topage');
    await page.evaluate(() => {
      const M = window.__MOCK;
      M.status = { ...M.status, apps: M.status.apps.map((a) => (a.id === 'navidrome' ? { ...a, state: 'stopped', health: '' } : a)) };
      window.__emit('status:changed', { apps: ['navidrome'] });
    });
    await page.waitForSelector('tr:has(strong:text-is("Navidrome")) td.state:has-text("Stopped")', { timeout: 2000 });
    const kept = await page.evaluate(() => !!document.activeElement?.classList.contains('topage') && !!document.activeElement.closest('tr')?.textContent.includes('Vikunja'));
    if (!kept) throw new Error('the focus was lost: ' + await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)));
  } },
  // A screen's data is kept (web/src/store.ts): folding asks nothing, and
  // so does going back to a screen already read.
  { name: 'Opening and folding every category asks the backend nothing', screen: 'status', mock: { statusOpen: '' }, run: async (page) => {
    await page.waitForSelector('#statusRows tr.grouphead', { timeout: 5000 });
    await page.waitForTimeout(500); // the cards read beside Status
    const before = await backendCalls(page);
    const heads = await page.$$eval('#statusRows tr.grouphead .foldbtn', (b) => b.length);
    if (heads < 3) throw new Error(`only ${heads} categories`);
    for (let i = 0; i < heads; i++) {
      for (let twice = 0; twice < 2; twice++) {
        const btn = page.locator('#statusRows tr.grouphead .foldbtn').nth(i);
        const was = await btn.getAttribute('aria-expanded');
        await btn.click();
        await page.waitForFunction(([n, w]) => document.querySelectorAll('#statusRows tr.grouphead .foldbtn')[n]?.getAttribute('aria-expanded') !== w, [i, was], { timeout: 2000 });
      }
    }
    await page.click('#statusAll');
    await page.waitForSelector('#statusAll:has-text("Fold them again")', { timeout: 2000 });
    await page.click('#statusAll');
    await page.waitForSelector('#statusAll:has-text("Show every app")', { timeout: 2000 });
    const asked = diffCalls(before, await backendCalls(page));
    if (asked.length) throw new Error('folding asked the backend: ' + asked.join(', '));
  } },
  { name: 'Going back to a screen draws what was read', screen: 'status', run: async (page) => {
    await page.waitForSelector('#statusRows tr', { timeout: 5000 });
    for (const screen of ['backups', 'setup', 'settings', 'status']) {
      await page.click(`nav button[data-screen="${screen}"]`);
      await page.waitForTimeout(400);
    }
    await page.waitForSelector('#settingsNav .pagebtn', { state: 'attached', timeout: 5000 });
    const before = await backendCalls(page);
    for (const screen of ['backups', 'setup', 'settings', 'status', 'setup', 'status']) await page.click(`nav button[data-screen="${screen}"]`);
    await page.waitForTimeout(300);
    await page.waitForSelector('#statusRows tr', { timeout: 2000 });
    const asked = diffCalls(before, await backendCalls(page));
    if (asked.length) throw new Error('going back asked the backend: ' + asked.join(', '));
  } },
  { name: "The engine's change reads Status on Status, and marks it on another screen", screen: 'status', run: async (page) => {
    await page.waitForSelector('#statusRows tr', { timeout: 5000 });
    await page.waitForTimeout(300);
    const reads = () => page.evaluate(() => window.__MOCK.calls.StatusBoard || 0);
    let n = await reads();
    await page.evaluate(() => { window.__MOCK.status.apps = window.__MOCK.status.apps.map((a) => (a.id === 'vikunja' ? { ...a, state: 'stopped', health: '' } : a)); window.__emit('status:changed'); });
    await page.waitForSelector('tr:has(strong:text-is("Vikunja")) td.state:has-text("Stopped")', { timeout: 3000 });
    if (await reads() !== n + 1) throw new Error(`Status read ${await reads() - n} times for one change`);
    await page.click('nav button[data-screen="backups"]');
    await page.waitForTimeout(300);
    n = await reads();
    await page.evaluate(() => window.__emit('status:changed'));
    await page.waitForTimeout(300);
    if (await reads() !== n) throw new Error('Status was read while Backups showed');
    await page.click('nav button[data-screen="status"]');
    await page.waitForFunction((was) => window.__MOCK.calls.StatusBoard > was, n, { timeout: 3000 });
  } },
  { name: 'Settings kept: what was typed stays after another screen', screen: 'settings', run: async (page) => {
    await page.click('#settingsNav .pagebtn[data-page="Domain"]', { timeout: 5000 });
    await page.fill('#setting-HOMELAB_DOMAIN input', 'home.example.org');
    await page.waitForSelector('#saveSettings:not([hidden])', { timeout: 2000 });
    await page.click('nav button[data-screen="status"]');
    await page.click('nav button[data-screen="settings"]');
    await page.waitForTimeout(300);
    if (await page.inputValue('#setting-HOMELAB_DOMAIN input') !== 'home.example.org') throw new Error('what was typed is gone');
    if (await page.isHidden('#saveSettings')) throw new Error('Save went away');
  } },
  // The window opens on the agent's last reading, marked with its age,
  // while a slow engine reads a fresh one; then the fresh one replaces it.
  { name: 'Status draws the last reading at once, then the fresh one', screen: 'status',
    mock: { statusDelay: 3000, lastStatus: { ...status, apps: status.apps.map((a) => (a.id === 'vikunja' ? { ...a, state: 'stopped', health: '' } : a)) } }, run: async (page) => {
      await page.waitForSelector('#status.active tr:has(strong:text-is("Vikunja")) td.state:has-text("Stopped")', { timeout: 1500 });
      await page.waitForSelector('#statusAge:not([hidden]):has-text("As it was a few seconds ago; checking now")', { timeout: 500 });
      if (await page.evaluate(() => window.__MOCK.statusAnswered)) throw new Error('the engine answered before the check: not slow enough');
      await page.waitForSelector('tr:has(strong:text-is("Vikunja")) td.state:has-text("Running")', { timeout: 5000 });
      await page.waitForSelector('#statusAge', { state: 'hidden', timeout: 1000 });
      if (await page.evaluate(() => window.__MOCK.calls.StatusBoard) !== 1) throw new Error(`Status read ${await page.evaluate(() => window.__MOCK.calls.StatusBoard)} times`);
    } },
  { name: 'With no last reading, Status waits for the engine', screen: 'status', mock: { statusDelay: 1500 }, run: async (page) => {
    if (await page.isVisible('#statusAge')) throw new Error('an age with nothing kept');
    await page.waitForSelector('#status.active tr:has(strong:text-is("Vikunja")) td.state:has-text("Running")', { timeout: 4000 });
    if (await page.isVisible('#statusAge')) throw new Error('an age on a fresh reading');
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
  // The smallest window the app allows (app/window.go), at its text size and one step up, with
  // long addresses, apps waiting for a drive, badges and a long week: no screen scrolls sideways.
  ...[['Mac', { platform: 'MacIntel' }], ['Windows', { platform: 'Win32' }], ['GNOME', { platform: 'Linux x86_64', host: { ...host, os: 'Ubuntu 24.04', machine: 'this machine', desktop: 'gnome' } }], ['KDE', { platform: 'Linux x86_64', host: { ...host, os: 'Linux (SteamOS 3.7)', machine: 'Steam Machine', desktop: 'kde' } }]]
    .flatMap(([sys, m]) => ['status', 'backups', 'setup', 'settings', 'choose', 'app:vikunja'].map((screen) => ({ name: `Nothing scrolls sideways in the smallest window, ${screen.replace('app:vikunja', 'an app’s page')}, ${sys}`, screen, mock: { ...m, weekly: longWeek,
      status: { ...status, apps: status.apps.map((a, i) => ({ ...a, address: a.address && a.address.replace('example.com', 'snooper42-homelab.com'), ...(i % 5 === 2 ? { state: 'stopped', waitingFor: '/Volumes/Hobbies' } : {}), ...(i % 7 === 1 ? { restarts: 3, held: true, settingsChanged: true } : {}) })) } }, run: async (page) => {
      await page.setViewportSize({ width: 860, height: 560 });
      await page.waitForTimeout(300);
      for (const zoom of ['1', '1.2', '1.5', '2']) {
        await page.evaluate((z) => document.documentElement.style.setProperty('--zoom', z), zoom);
        await page.waitForTimeout(100);
        const wide = await page.evaluate(() => {
          const m = document.querySelector('main'), screen = document.querySelector('.screen.active').getBoundingClientRect();
          if (m.scrollWidth > m.clientWidth + 1) return `${m.scrollWidth}px of content in ${m.clientWidth}px`;
          // Nor does anything stick out of the screen, or get cut off by its card.
          const out = [...document.querySelectorAll('.screen.active .header .toolbar, .screen.active .tile .sub > *, #copiesCard table')].filter((e) => e.checkVisibility())
            .find((e) => e.getBoundingClientRect().right > Math.min(screen.right, e.parentElement.getBoundingClientRect().right) + 1);
          if (out) return `${out.id || out.className || out.tagName} sticks out: "${out.textContent.trim().slice(0, 40)}"`;
          const cut = [...document.querySelectorAll('.screen.active .tile .sub .trend')].find((e) => e.checkVisibility() && e.scrollWidth > e.clientWidth + 1);
          return cut ? `"${cut.textContent.trim()}" is cut off` : '';
        });
        if (wide) throw new Error(`at text size ${zoom}, the screen scrolls sideways: ${wide}`);
      }
    } }))),
  // Big text in the smallest window: the sidebar is a rail of icons, each still named, its count on it.
  ...[['Mac', { platform: 'MacIntel' }], ['Windows', { platform: 'Win32' }], ['GNOME', { platform: 'Linux x86_64', host: { ...host, os: 'Ubuntu 24.04', machine: 'this machine', desktop: 'gnome' } }]]
    .map(([sys, m]) => ({ name: `The sidebar becomes icons when the text is big for the window, ${sys}`, screen: 'status', mock: m, run: async (page) => {
      await page.setViewportSize({ width: 860, height: 560 });
      await page.waitForSelector('#statusCount:not(:empty)', { timeout: 5000 });
      const nav = async () => page.evaluate(() => {
        const n = document.querySelector('nav'), b = document.querySelector('nav button[data-screen="status"]'), label = b.querySelector('span:not(.count)'), count = b.querySelector('.count');
        const r = b.getBoundingClientRect(), c = count.getBoundingClientRect(), z = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
        return { width: n.getBoundingClientRect().width / z, label: label.getBoundingClientRect().width, countIn: c.left >= r.left - 1 && c.right <= r.right + 1 && c.top >= r.top - 1 && c.width > 0, cut: n.scrollHeight > n.clientHeight + 1 && getComputedStyle(n).overflowY === 'hidden' };
      });
      const wide = await nav();
      if (wide.width < 180 || wide.label < 20) throw new Error(`at text size 1 the sidebar is ${Math.round(wide.width)}px with its names hidden`);
      for (const zoom of ['1.5', '2']) {
        await page.evaluate((z) => document.documentElement.style.setProperty('--zoom', z), zoom);
        await page.waitForTimeout(100);
        const rail = await nav();
        if (rail.width > 80) throw new Error(`at text size ${zoom} the sidebar is still ${Math.round(rail.width)}px wide`);
        if (rail.label > 3) throw new Error(`at text size ${zoom} the screen names still show in the rail`);
        if (!rail.countIn) throw new Error(`at text size ${zoom} Status' count is not on its icon`);
        if (rail.cut) throw new Error(`at text size ${zoom} the sidebar is cut off at the bottom`);
        if (await page.getByRole('button', { name: /^Status/ }).count() !== 1) throw new Error('the Status button lost its name');
      }
      await page.click('nav button[data-screen="backups"]');
      await page.waitForSelector('#backups.screen.active', { timeout: 5000 });
    } })),
  { name: 'A tile’s line wraps under its chart rather than being cut off, at big text', screen: 'status', run: async (page) => {
    for (const [w, zoom] of [[1280, '1.5'], [1100, '1.25'], [860, '1.2']]) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.evaluate((z) => document.documentElement.style.setProperty('--zoom', z), zoom);
      await page.waitForSelector('#tiles .trend', { timeout: 5000 });
      await page.waitForTimeout(100);
      const cut = await page.$eval('#tiles .trend', (e) => e.scrollWidth > e.clientWidth + 1);
      if (cut) throw new Error(`in a ${w}px window at text size ${zoom}, “${await page.textContent('#tiles .trend')}” is cut off`);
    }
  } },
  // A long name and a long address (a deep subdomain on your own domain): the page wraps them, in a wide window and a narrow one.
  ...[[1280, 800, '1'], [860, 560, '1.25']].map(([w, h, zoom]) => ({ name: `A long name and address fit an app’s page, ${w}×${h} at text size ${zoom}`, screen: 'app:vikunja',
    mock: { ...pageMock, status: { ...status, apps: status.apps.map((a) => (a.id === 'vikunja' ? { ...a, name: 'Vikunja for the whole extended family and friends', address: 'todo.household-projects.snooper42-homelab-wizard.example.com' } : a)) } }, run: async (page) => {
      await page.setViewportSize({ width: w, height: h });
      await page.evaluate((z) => document.documentElement.style.setProperty('--zoom', z), zoom);
      await page.waitForSelector('#app h1:has-text("extended family")', { timeout: 5000 });
      await page.waitForTimeout(200);
      const bad = await page.evaluate(() => {
        const m = document.querySelector('main'), screen = document.querySelector('#app').getBoundingClientRect(), out = [];
        if (m.scrollWidth > m.clientWidth + 1) out.push(`the page scrolls sideways (${m.scrollWidth}px in ${m.clientWidth}px)`);
        const address = [...document.querySelectorAll('#app .tile .value')].find((v) => v.textContent.includes('household-projects'));
        if (!address) out.push('no address shown');
        else if (address.scrollWidth > address.clientWidth + 1 || getComputedStyle(address).textOverflow === 'ellipsis') out.push('the address is cut short');
        for (const e of document.querySelectorAll('#app h1, #app .remove button')) if (e.getBoundingClientRect().right > screen.right + 1) out.push(`${e.textContent.trim().slice(0, 30)} sticks out`);
        return out;
      });
      if (bad.length) throw new Error(bad.join('; '));
    } })),
  { name: 'A long search without spaces wraps its no-match line', screen: 'choose', run: async (page) => {
    await page.setViewportSize({ width: 860, height: 560 });
    await page.evaluate(() => document.documentElement.style.setProperty('--zoom', '1.5'));
    await page.fill('#search', 'Supercalifragilisticexpialidocious'.repeat(3), { timeout: 5000 });
    await page.waitForSelector('#choose .empty:has-text("No app matches")', { timeout: 5000 });
    const wide = await page.evaluate(() => { const m = document.querySelector('main'); return m.scrollWidth > m.clientWidth + 1 ? `${m.scrollWidth}px in ${m.clientWidth}px` : ''; });
    if (wide) throw new Error(`the screen scrolls sideways: ${wide}`);
  } },
  // Big text: the sheets, the update line, and the screens' columns go by the room there is at the text size.
  ...[[860, 560, '1.5'], [860, 560, '2'], [1280, 800, '2']].map(([w, h, zoom]) => ({ name: `A sheet stays inside the window, ${w}×${h} at text size ${zoom}`, screen: 'status', mock: { jobApps: { 'update-all': ['navidrome', 'vikunja', 'mealie'] } }, run: async (page) => {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate((z) => document.documentElement.style.setProperty('--zoom', z), zoom);
    await page.click('#updateAll', { timeout: 5000 });
    await page.waitForSelector('#cliActions button:has-text("Update them")', { timeout: 5000 });
    const out = await page.evaluate(() => {
      const r = document.getElementById('cliPanel').getBoundingClientRect(), b = [...document.querySelectorAll('#cliActions button')].find((e) => /Update them/.test(e.textContent)).getBoundingClientRect();
      return [r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1 ? `the sheet is ${Math.round(r.left)},${Math.round(r.top)} to ${Math.round(r.right)},${Math.round(r.bottom)} in a ${innerWidth}×${innerHeight} window` : '',
        b.left < 0 || b.right > innerWidth ? 'Update them is out of the window' : ''].filter(Boolean);
    });
    if (out.length) throw new Error(out.join('; '));
  } })),
  { name: 'The job window keeps each app’s words readable at big text', screen: 'status', mock: { jobApps: { 'update-all': ['navidrome', 'vikunja', 'mealie'] } }, run: async (page) => {
    await page.setViewportSize({ width: 860, height: 560 });
    await page.evaluate(() => document.documentElement.style.setProperty('--zoom', '2'));
    await page.click('#updateAll', { timeout: 5000 });
    await page.click('#cliActions button:has-text("Update them")', { timeout: 5000 });
    await page.waitForSelector('#cliApps .jobwords', { timeout: 5000 });
    const cut = await page.$$eval('#cliApps .jobwords', (w) => w.filter((e) => e.textContent.trim() && e.scrollWidth > e.clientWidth + 1 && e.clientWidth < 120).map((e) => e.textContent.trim()));
    if (cut.length) throw new Error(`cut to a few letters: ${cut.join(', ')}`);
  } },
  ...[['0.15.0', '1.5'], ['0.15.0', '2'], ['0.15.0-beta.12+build.7d9be080888433f9', '1']].map(([version, zoom]) => ({ name: `The update line keeps Update now in reach, version ${version} at text size ${zoom}`, screen: 'status', mock: { update: { ...update, version } }, run: async (page) => {
    await page.setViewportSize({ width: 860, height: 560 });
    await page.evaluate((z) => document.documentElement.style.setProperty('--zoom', z), zoom);
    await page.waitForSelector('#updateNow', { timeout: 5000 });
    await page.waitForTimeout(100);
    const cut = await page.evaluate(() => {
      const line = document.getElementById('updateLine').getBoundingClientRect();
      return ['updateLater', 'updateNow'].filter((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.right > line.right + 1 || r.bottom > line.bottom + 1; });
    });
    if (cut.length) throw new Error(`cut off: ${cut.join(', ')}`);
  } })),
  ...[['Choose stacks', 'choose', '#choose .cols'], ['Status', 'status', '#status .duo'], ['an app’s page', 'app:vikunja', '#app .pagecols']].map(([label, screen, sel]) => ({ name: `${label}: two columns only when there is room for both at the text size`, screen, mock: pageMock, run: async (page) => {
    for (const [w, h, zoom, want] of [[1280, 800, '1', 2], [1440, 900, '2', 1], [1280, 800, '1.5', 1]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.evaluate((z) => document.documentElement.style.setProperty('--zoom', z), zoom);
      await page.waitForSelector(sel, { state: 'attached', timeout: 5000 });
      await page.waitForTimeout(100);
      const n = await page.$eval(sel, (e) => getComputedStyle(e).gridTemplateColumns.split(' ').length);
      if (n !== want) throw new Error(`in a ${w}×${h} window at text size ${zoom}: ${n} columns, not ${want}`);
    }
  } })),
  { name: 'Settings: a field keeps its room at big text in a big window', screen: 'settings', run: async (page) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => document.documentElement.style.setProperty('--zoom', '1.5'));
    await page.click('#settingsNav .pagebtn[data-page="Storage"]', { timeout: 5000 });
    await page.waitForSelector('#settingsForm .setting .inputrow', { timeout: 5000 });
    const bad = await page.evaluate(() => {
      const m = document.querySelector('main');
      if (m.scrollWidth > m.clientWidth + 1) return `the screen scrolls sideways (${m.scrollWidth}px in ${m.clientWidth}px)`;
      const row = [...document.querySelectorAll('#settingsForm .setting')].find((s) => [...s.querySelectorAll('.inputrow > *')].some((e) => e.getBoundingClientRect().right > s.getBoundingClientRect().right + 1));
      const narrow = [...document.querySelectorAll('#settingsForm .setting .inputrow input')].find((i) => i.checkVisibility() && i.getBoundingClientRect().width < 120);
      return row ? `${row.querySelector('.key')?.textContent.trim()} sticks out of its card` : narrow ? 'a field is too narrow to read' : '';
    });
    if (bad) throw new Error(bad);
  } },
  { name: 'Settings: one Page drop-down in place of the list when the screen is narrow', screen: 'settings', run: async (page) => {
    await page.setViewportSize({ width: 860, height: 560 });
    await page.waitForSelector('#settingsNav .pagebtn', { timeout: 5000 });
    if (await page.isVisible('#settingsNav select')) throw new Error('the drop-down shows in a window with room for the list');
    await page.evaluate(() => document.documentElement.style.setProperty('--zoom', '2'));
    await page.waitForSelector('#settingsNav select', { state: 'visible', timeout: 5000 });
    if (await page.isVisible('#settingsNav .pagebtn')) throw new Error('the list still shows beside the drop-down');
    await page.selectOption('#settingsNav select', 'Appearance');
    await page.waitForSelector('#settingsNav .pagebtn.active[data-page="Appearance"]', { state: 'attached', timeout: 5000 });
    if (await page.$eval('#settingsNav select', (e) => e.value) !== 'Appearance') throw new Error('the drop-down does not say the page shown');
  } },
  { name: 'A wide window keeps the full sidebar at big text', screen: 'status', run: async (page) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.evaluate(() => document.documentElement.style.setProperty('--zoom', '1.5'));
    await page.waitForTimeout(200);
    if (!(await page.isVisible('nav button[data-screen="status"] span:text-is("Status")'))) throw new Error('the sidebar lost its names in a wide window');
  } },
  ...[['Mac', { platform: 'MacIntel' }], ['Windows', { platform: 'Win32' }]].map(([sys, m]) => ({ name: `A screen's toolbar stays one line at big text, ${sys}`, screen: 'backups', mock: m, run: async (page) => {
    await page.setViewportSize({ width: 860, height: 560 });
    await page.evaluate(() => document.documentElement.style.setProperty('--zoom', '1.5'));
    await page.waitForSelector('#openDuplicati', { state: 'visible', timeout: 5000 });
    const tops = await page.$$eval('#backups .header .toolbar > button:not([hidden])', (b) => b.map((e) => Math.round(e.getBoundingClientRect().top)));
    if (new Set(tops).size !== 1) throw new Error(`the toolbar's buttons are on ${new Set(tops).size} lines`);
  } })),
  { name: 'A Setup step’s buttons go under its words in a narrow window', screen: 'setup', run: async (page) => {
    await page.setViewportSize({ width: 860, height: 560 });
    await page.waitForSelector('.checklist > li > .actions button', { timeout: 5000 });
    const bad = await page.$$eval('.checklist > li:not(.fold, .alldone):has(> .actions button)', (li) => li.map((l) => {
      const t = l.querySelector('.title').getBoundingClientRect(), a = l.querySelector(':scope > .actions').getBoundingClientRect();
      return a.top < t.bottom ? l.querySelector('.title').textContent : '';
    }).filter(Boolean));
    if (bad.length) throw new Error(`buttons beside the words of: ${bad.join(', ')}`);
  } },
  { name: 'This week: one thing a line, however long', screen: 'status', mock: { weekly: longWeek }, run: async (page) => {
    await page.waitForSelector('#weekCard li', { timeout: 5000 });
    const lefts = await page.$$eval('#weekCard li', (li) => li.map((l) => Math.round(l.getBoundingClientRect().left)));
    if (lefts.length !== 8 || new Set(lefts).size !== 1) throw new Error(`the lines are side by side (left edges ${lefts.join(', ')})`);
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
  ...[[390, 844], [320, 568]].map(([w, h]) => ({ name: `The phone: each app’s address on a line of its own, ${w}px wide`, screen: 'status', phone: ['companion'], mock: { status: { ...status, apps: status.apps.map((a) => (a.id === 'vaultwarden' ? { ...a, address: 'passwords.a-really-long-subdomain-name.snooper42-homelab-wizard.example.com' } : a)) } }, run: async (page) => {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForSelector('#statusRows tr:has(strong:text-is("Vaultwarden"))', { timeout: 5000 });
    const bad = await page.$$eval('#statusRows tr:not(.grouphead)', (rows) => rows.flatMap((tr) => {
      const [name, state, address] = tr.children, a = address.getBoundingClientRect(), s = state.getBoundingClientRect(), n = name.getBoundingClientRect();
      if (!address.querySelector('a') || !a.width) return [];
      const why = a.top < s.bottom - 1 ? 'beside its state' : a.width < n.width * 0.8 ? `squeezed to ${Math.round(a.width)}px` : '';
      return why ? [`${name.textContent.trim()}: ${why}`] : [];
    }));
    if (bad.length) throw new Error(bad.slice(0, 3).join('; '));
  } })),
  { name: 'The phone: buttons, chevrons, folds and switches a finger can hit', screen: 'status', phone: ['companion', 'can-change'], run: async (page) => {
    await page.waitForSelector('#statusRows button.rowmain', { timeout: 5000 });
    const size = (sel) => page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
    const small = [];
    for (const [sel, w, h] of [['#statusRows button.rowmain', 0, 36], ['#statusRows .iconbtn.topage', 40, 40], ['#statusRows .foldbtn', 0, 40]]) {
      const [sw, sh] = await size(sel);
      if (sw < w || sh < h) small.push(`${sel} is ${sw}×${sh}`);
    }
    await page.click('#statusRows tr:has(strong:text-is("Vikunja")) td.state');
    await page.waitForSelector('#app input.switch', { timeout: 5000 });
    for (const [sel, w, h] of [['#app a.back', 0, 40], ['#app input.switch', 51, 31]]) {
      const [sw, sh] = await size(sel);
      if (sw < w || sh < h) small.push(`${sel} is ${sw}×${sh}`);
    }
    if (small.length) throw new Error(small.join('; '));
  } },
  { name: 'A read-only phone has no restart, stop, start, or switches', screen: 'status', phone: ['companion'], run: async (page) => {
    await page.waitForSelector('#statusRows tr:has(strong:text-is("Vikunja")) button.rowmain:has-text("Open")', { state: 'visible', timeout: 5000 });
    if (await page.isVisible('#statusRows tr:has(strong:text-is("Mealie")) button:has-text("Start")')) throw new Error('Start shows on a read-only phone');
    if (await page.isVisible('nav button[data-screen="settings"]')) throw new Error('Settings shows on the phone');
    await page.click('#statusRows tr:has(strong:text-is("Vikunja")) td.state');
    await page.waitForSelector('#app.screen.active h1:text-is("Vikunja")', { timeout: 5000 });
    for (const sel of ['button:text-is("Restart")', 'button:text-is("Stop")', 'input.switch', 'button:has-text("Remove")']) {
      if (await page.isVisible(`#app ${sel}`)) throw new Error(sel + ' shows on a read-only phone');
    }
    await page.waitForSelector('#appSettings li:has-text("Tell me if it stops") .switchstate:text-is("On")');
  } },
  { name: 'A phone allowed to make changes can restart, from the page', screen: 'app:vikunja', phone: ['companion', 'can-change'], run: async (page) => {
    await page.click('#app button:text-is("Restart")', { timeout: 5000 });
    await page.waitForSelector('#cliPanel:not([hidden])', { timeout: 5000 });
    if (await page.isVisible('#app button:has-text("Remove")')) throw new Error('Remove shows on a phone');
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
  { name: 'Roll back an update, from its page', screen: 'status', run: async (page) => {
    await page.waitForSelector('#statusRows tr:has-text("Dozzle") .badge:has-text("updates held")', { timeout: 5000 });
    await page.click('#statusRows tr:has(strong:text-is("Navidrome")) button.topage');
    await page.waitForSelector('#app h1:text-is("Navidrome")', { timeout: 5000 });
    if (await page.isVisible('#app button:text-is("Roll back")')) throw new Error('Roll back without an update');
    await page.click('#app a.back');
    await page.click('#statusRows tr:has(strong:text-is("Vikunja")) button.topage');
    await page.click('#appUpdates button:text-is("Roll back")', { timeout: 5000 });
    await page.waitForSelector('#cliTitle:has-text("Vikunja")', { timeout: 5000 });
  } },
  { name: 'Going back, from Settings › This Mac', screen: 'settings', mock: { upgrade: { ...upgrade, previous: { commit: 'abc1234', version: '0.13.0', when: new Date(Date.now() - 864e5).toISOString() } } }, run: async (page) => {
    await page.click('#upgradeBack', { timeout: 5000 });
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
  { name: 'Update all apps now', screen: 'status', mock: { jobApps: { 'update-all': ['navidrome', 'vikunja', 'mealie'] } }, run: async (page) => {
    await page.click('#updateAll');
    await page.waitForSelector('#cliLog:has-text("Updates now what the nightly update would")', { timeout: 5000 });
    await page.click('#cliActions button:has-text("Update them")');
    await page.waitForSelector('#cliLog:has-text("updated navidrome")', { state: 'attached', timeout: 5000 });
    // A row per app, each finished, with Docker's lines folded away.
    await page.waitForSelector('#cliApps li.done:has-text("Mealie")', { timeout: 8000 });
    if (await page.$$eval('#cliApps li.done', (l) => l.length) !== 3) throw new Error('not a finished row per app');
    if (await page.isVisible('#cliLog')) throw new Error('Show details stayed open under the rows');
    // The steps came as a bar, filled at the end.
    await page.waitForSelector('#cliProgress:not([hidden]) .step:text-is("Done")', { timeout: 5000 });
  } },
  { name: 'Install shows a row per app', screen: 'choose', run: async (page) => {
    await page.click('#starters .starter:has-text("Files")');
    await page.waitForSelector('#installBtn:not([disabled])', { timeout: 5000 });
    await page.click('#installBtn');
    await page.waitForSelector('#installProgress:not([hidden]) .step', { timeout: 5000 });
    await page.waitForSelector('#installApps li', { timeout: 5000 });
    await page.waitForSelector('#started h2:text-is("Ready to open")', { timeout: 10000 });
    if (await page.$$eval('#installApps li:not(.done)', (l) => l.length)) throw new Error('an app row did not finish');
    if (await page.$$eval('#installProgress .step', (e) => e[0].textContent) !== 'Done') throw new Error('the bar did not end on Done');
  } },
  { name: 'Update shows what is new first', screen: 'app:vikunja', mock: { releaseNotes: { vikunja: { app: 'vikunja', repo: 'go-vikunja/vikunja', running: 'v0.24.4', placed: true, page: 'https://github.com/go-vikunja/vikunja/releases', releases: [
    { tag: 'v0.24.6', when: '2026-10-12T09:00:00Z', url: 'https://github.com/go-vikunja/vikunja/releases/tag/v0.24.6', notes: 'Fixes\n- Reminders are sent once again' },
    { tag: 'v0.24.5', name: 'Security release', when: '2026-09-30T09:00:00Z', url: 'https://github.com/go-vikunja/vikunja/releases/tag/v0.24.5', notes: '- Link shares respect their expiry' },
  ] } } }, run: async (page) => {
    await page.click('#appUpdates button:has-text("Check for an update")', { timeout: 5000 });
    await page.waitForSelector('#cliActions .notes p:has-text("runs v0.24.4; updating brings 2 releases, up to v0.24.6")', { timeout: 5000 });
    await page.waitForSelector('#cliActions .release strong:has-text("v0.24.5 — Security release")');
    if (await page.isVisible('#cliLog')) throw new Error('the empty log shows above the notes');
    await page.click('#cliActions button:has-text("Update")');
    await page.waitForSelector('#cliTitle:has-text("Vikunja: update done")', { timeout: 5000 });
    await page.click('#cliActions button:has-text("Close")');
    // Notes that cannot be read leave Update there.
    await page.click('#app a.back');
    await page.click('#statusRows tr:has(strong:text-is("Navidrome")) button.topage');
    await page.click('#appUpdates button:has-text("Check for an update")', { timeout: 5000 });
    await page.waitForSelector('#cliActions .notes p:has-text("could not be read")', { timeout: 5000 });
    await page.click('#cliActions button:has-text("Cancel")');
    await page.waitForSelector('#cliPanel', { state: 'hidden' });
  } },
  { name: 'Changed settings show, and Fix it applies them', screen: 'status', mock: { status: { ...status, apps: status.apps.map((a) => (a.id === 'vikunja' ? { ...a, settingsChanged: true } : a)) } }, run: async (page) => {
    await page.waitForSelector('#statusRows tr:has-text("Vikunja") .badge:has-text("settings changed")', { timeout: 5000 });
    await page.waitForSelector('#fixIt:not([hidden])');
  } },
  { name: 'Explain a log with the AI on this machine', screen: 'app:vikunja', mock: { explainer: 'llama3.2:latest', explained: { vikunja: 'Something is wrong: Vikunja cannot reach its database.' } }, run: async (page) => {
    await page.click('#appLog button:has-text("Explain this")', { timeout: 5000 });
    await page.waitForSelector('#appLog .explained .answer:has-text("cannot reach its database")', { timeout: 5000 });
    await page.waitForSelector('#appLog .explained a:has-text("Ask again")');
  } },
  { name: 'An answer about one log never shows under another app\'s', screen: 'app:vikunja', mock: { explainer: 'llama3.2:latest', explained: { vikunja: 'Something is wrong: Vikunja cannot reach its database.' } }, run: async (page) => {
    await page.click('#appLog button:has-text("Explain this")', { timeout: 5000 });
    await page.waitForSelector('#appLog .explained .answer', { timeout: 5000 });
    await page.click('#app a.back');
    // Watched from the click on, so even one frame of it counts.
    await page.evaluate(() => {
      window.__leaked = false;
      new MutationObserver(() => {
        if (document.querySelector('#app h1')?.textContent === 'Navidrome' && document.querySelector('#appLog .explained')) window.__leaked = true;
      }).observe(document.getElementById('app'), { childList: true, subtree: true, characterData: true });
    });
    await page.click('#statusRows tr:has(strong:text-is("Navidrome")) button.topage', { timeout: 5000 });
    await page.waitForSelector('#app h1:text-is("Navidrome")', { timeout: 2000 });
    await page.waitForSelector('#appLog button:has-text("Explain this")', { timeout: 5000 });
    if (await page.isVisible('#appLog .explained') || await page.evaluate(() => window.__leaked)) throw new Error("Vikunja's answer shows under Navidrome's log");
  } },
  { name: "An app's log: Read it again reads it again, Show more of it reads more", screen: 'app:vikunja', run: async (page) => {
    await page.waitForSelector('#appLog .applog .line', { timeout: 5000 });
    const reads = await page.evaluate(() => window.__MOCK.calls.Logs);
    await page.click('#appLog button[title="Read it again"]');
    await page.waitForFunction((n) => window.__MOCK.calls.Logs > n, reads, { timeout: 2000 });
    await page.click('#appLog a:has-text("Show more of it")');
    await page.waitForSelector('#appLog a:has-text("Show more of it")', { state: 'detached', timeout: 2000 });
  } },
  { name: "An app's log offers Dozzle while it runs", screen: 'app:vikunja', mock: { status: { ...status, apps: status.apps.map((a) => (a.id === 'dozzle' ? { ...a, state: 'running', health: 'healthy', url: 'http://localhost:9999' } : a)) } }, run: async (page) => {
    await page.click('#appLog a:has-text("Dozzle")', { timeout: 5000 });
    if ((await page.evaluate(() => window.__MOCK.opened)) !== 'http://localhost:9999') throw new Error('Dozzle did not open');
  } },
  // As each system, and on the phone: the sheet's place is the same rule everywhere, so each must hold still.
  ...[['Mac', { platform: 'MacIntel' }], ['Windows', { platform: 'Win32' }], ['Linux', { platform: 'Linux x86_64' }]].map(([sys, mock]) => ({ name: `Update apps holds still, ${sys}: the window does not move as rows come, nothing to cancel while it runs, Status waits behind it`, screen: 'status', mock, run: async (page) => {
    // Fourteen apps, as an update of a whole homelab gives.
    await page.evaluate(() => { window.__MOCK.jobApps = { 'update-all': window.__MOCK.catalog.apps.slice(0, 14).map((a) => a.id) }; });
    await page.click('#updateAll');
    await page.waitForSelector('#cliActions button:has-text("Update them")', { timeout: 5000 });
    const top = () => page.evaluate(() => Math.round(document.getElementById('cliPanel').getBoundingClientRect().top));
    const before = await top();
    const calls = await backendCalls(page);
    await page.click('#cliActions button:has-text("Update them")');
    const buttons = await page.$$eval('#cliActions button', (b) => b.map((x) => x.textContent));
    if (buttons.length) throw new Error(`buttons while it runs: ${buttons.join(', ')}`);
    // The engine says containers changed while the job runs: Status behind the sheet waits.
    await page.waitForSelector('#cliApps li', { timeout: 5000 });
    await page.evaluate(() => window.__emit('status:changed'));
    await page.waitForSelector('#cliApps li:nth-child(14)', { timeout: 8000 });
    const during = await top();
    if (during !== before) throw new Error(`the window moved from ${before}px to ${during}px as its rows came`);
    const read = diffCalls(calls, await backendCalls(page)).filter((c) => c.startsWith('StatusBoard '));
    if (read.length) throw new Error(`Status was read behind the open sheet: ${read.join(', ')}`);
    const rows = await page.evaluate(() => { const l = document.querySelector('#cliApps .jobapps'); return l.scrollHeight > l.clientHeight && getComputedStyle(l).overflowY === 'auto'; });
    if (!rows) throw new Error('the rows do not scroll in a box of their own');
    await page.waitForSelector('#cliActions button:has-text("Close")', { timeout: 10000 });
    const after = await backendCalls(page);
    await page.click('#cliActions button:has-text("Close")');
    // Closed, Status catches up on what it missed.
    await page.waitForFunction((n) => (window.__MOCK.calls.StatusBoard || 0) > n, after.StatusBoard || 0, { timeout: 3000 });
  } })),
  { name: 'A command shows its plan; Cancel or Escape leaves it unrun', screen: 'status', run: async (page) => {
    await page.click('#updateAll');
    await page.waitForSelector('#cliActions button:has-text("Update them")', { timeout: 5000 });
    await page.click('#cliActions button:has-text("Cancel")');
    await page.waitForSelector('#cliPanel', { state: 'hidden', timeout: 2000 });
    await page.click('#updateAll');
    await page.waitForSelector('#cliActions button:has-text("Update them")', { timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForSelector('#cliPanel', { state: 'hidden', timeout: 2000 });
    const ran = await page.evaluate(() => (window.__MOCK.homelabRan || []).length);
    if (ran !== 2) throw new Error(`expected two previews and no run, the CLI ran ${ran} times`);
  } },
  { name: 'With the runtime down, Status says so, then shows the apps once it answers', screen: 'status', mock: { statusError: 'the container runtime is not running' }, run: async (page) => {
    await page.waitForSelector('#statusNote .notice strong:has-text("The container runtime is not running")', { timeout: 5000 });
    if (await page.isVisible('#statusRows tr')) throw new Error('rows show with the runtime down');
    await page.evaluate(() => { window.__MOCK.statusError = ''; window.__emit('status:changed'); });
    await page.waitForSelector('#statusRows tr:has(strong:text-is("Vikunja"))', { timeout: 5000 });
    if (await page.isVisible('#statusNote .notice')) throw new Error('the notice stayed after the runtime answered');
    // The cards that ask the runtime were not read while it was down: they
    // come with the first Status that is, not minutes later.
    await page.waitForSelector('#weekCard:not([hidden])', { timeout: 3000 });
    await page.waitForSelector('#protectCard:not([hidden])', { timeout: 3000 });
  } },
  { name: 'Connect apps lists each link as it finishes', screen: 'status', mock: { wireLinks: [{ state: 'done', text: 'Sonarr → Prowlarr' }, { state: 'manual', text: 'Bazarr → Sonarr', detail: 'set its API key in Bazarr' }] }, run: async (page) => {
    await page.click('#statusMore');
    await page.click('#connect');
    await page.waitForSelector('#statusWiring h2:text-is("Connected for you")', { timeout: 2000 });
    await page.waitForSelector('#statusWiring li:has(.ok:has-text("✓")):has-text("Sonarr → Prowlarr")', { timeout: 3000 });
    await page.waitForSelector('#statusWiring li:has(.warn:has-text("!")):has-text("Bazarr → Sonarr") .detail:has-text("set its API key")', { timeout: 3000 });
    await page.waitForSelector('#statusWiring p.muted:empty', { state: 'attached', timeout: 3000 });
  } },
  { name: 'Connect apps with nothing to connect says so', screen: 'status', run: async (page) => {
    await page.click('#statusMore');
    await page.click('#connect');
    await page.waitForSelector('#statusWiring p:has-text("Nothing to connect")', { timeout: 3000 });
  } },
  { name: 'Add your own app offers every category, Documents first picked', screen: 'choose', run: async (page) => {
    const [n, value] = await page.evaluate(() => [document.querySelectorAll('#cCategory option').length, document.getElementById('cCategory').value]);
    const want = await page.evaluate(() => window.__MOCK.catalog.categories.length);
    if (n !== want || value !== 'documents') throw new Error(`${n} of ${want} categories, ${value} picked`);
  } },
  { name: 'No Explain without a local model', screen: 'app:vikunja', run: async (page) => {
    await page.waitForSelector('#appLog .applog .line', { timeout: 5000 });
    if (await page.isVisible('#appLog button:has-text("Explain this")')) throw new Error('Explain shows without Ollama');
  } },
  { name: 'Kiosk mode shows Status only, without buttons', screen: 'status', run: async (page) => {
    await page.evaluate(() => document.documentElement.classList.add('companion', 'kiosk'));
    await page.waitForSelector('#statusRows tr', { timeout: 5000 });
    if (await page.isVisible('nav')) throw new Error('the sidebar shows');
    const buttons = await page.evaluate(() => [...document.querySelectorAll('main button')].filter((b) => b.offsetParent).map((b) => b.textContent.trim() || b.title));
    if (buttons.length) throw new Error('buttons show: ' + buttons.join(', '));
    if (!(await page.isVisible('#tiles'))) throw new Error('the tiles are hidden');
  } },
  // A click answers at once: the row says what it does before the runtime
  // answers, and goes back with the reason when the action fails.
  { name: 'A click answers at once: the row says Starting… before the runtime answers', screen: 'status', mock: { actionDelay: 2000 }, run: async (page) => {
    const row = 'tr:has(strong:text-is("Mealie"))';
    await page.waitForSelector(`${row} td.state:has-text("Stopped")`, { timeout: 5000 });
    await page.click(`${row} button.rowmain:has-text("Start")`);
    await page.waitForSelector(`${row} td.state:has-text("Starting…")`, { timeout: 300 });
    if (await page.evaluate(() => window.__MOCK.actionDone)) throw new Error('the runtime answered before the row changed');
    await page.waitForSelector(`${row} td.state:has-text("Running")`, { timeout: 6000 });
    if (await page.isVisible(`${row} .rowerr`)) throw new Error('an error after a start that worked');
  } },
  { name: "A click on an app's page answers at once, there and on its row", screen: 'app:vikunja', mock: { actionDelay: 2000 }, run: async (page) => {
    await page.click('#app button:text-is("Restart")', { timeout: 5000 });
    await page.waitForSelector('#app .pill:has-text("Restarting…")', { timeout: 300 });
    await page.waitForSelector('#statusRows tr:has(strong:text-is("Vikunja")) td.state:has-text("Restarting…")', { state: 'attached', timeout: 300 });
    if (await page.evaluate(() => window.__MOCK.actionDone)) throw new Error('the runtime answered before the page changed');
    await page.waitForSelector('#app .pill.ok:has-text("Running")', { timeout: 6000 });
  } },
  { name: 'A failed action puts the page and the row back and says why', screen: 'app:vikunja', mock: { actionDelay: 500, actionError: 'the container runtime stopped answering' }, run: async (page) => {
    await page.click('#app button:text-is("Stop")', { timeout: 5000 });
    await page.waitForSelector('#app .pill:has-text("Stopping…")', { timeout: 300 });
    await page.waitForSelector('#app .rowerr:has-text("Could not stop: the container runtime stopped answering")', { timeout: 5000 });
    await page.waitForSelector('#statusRows tr:has(strong:text-is("Vikunja")) .rowerr:has-text("Could not stop")', { state: 'attached', timeout: 2000 });
    if (!(await page.isVisible('#app .pill.ok:has-text("Running")'))) throw new Error('the page did not go back to Running');
    await page.click('#cliActions button:has-text("Close")', { timeout: 2000 });
    await page.click('#app button:text-is("Restart")', { timeout: 2000 });
    await page.waitForSelector('#app .rowerr:has-text("Could not restart")', { timeout: 5000 });
    if (await page.isVisible('#app .rowerr:has-text("Could not stop")')) throw new Error('the old failure stayed after another action');
  } },
  // Settings › Appearance › Motion and Transparency, on every screen.
  { name: 'Motion None: nothing moves on any screen, a running job and an open sheet included', screen: 'status', mock: { look: { motion: 'none' }, actionDelay: 1500 }, run: async (page) => {
    for (const screen of ['choose', 'backups', 'setup', 'settings', 'status']) {
      await page.click(`nav button[data-screen="${screen}"]`);
      await page.waitForTimeout(250);
      const moving = await page.evaluate(movingNow);
      if (moving.length) throw new Error(`${screen}: ${moving.slice(0, 4).join('; ')}`);
    }
    await page.click('tr:has(strong:text-is("Vikunja")) button.topage', { timeout: 5000 });
    await page.waitForTimeout(250);
    const onPage = await page.evaluate(movingNow);
    if (onPage.length) throw new Error(`an app's page: ${onPage.slice(0, 4).join('; ')}`);
    await page.click('#app button:text-is("Restart")', { timeout: 5000 });
    await page.waitForSelector('#cliPanel:not([hidden])', { timeout: 2000 });
    const moving = await page.evaluate(movingNow);
    if (moving.length) throw new Error(`an open sheet and a job: ${moving.slice(0, 4).join('; ')}`);
  } },
  { name: 'Motion Less: the sheet and the job bar stop moving, colours still fade', screen: 'status', mock: { look: { motion: 'less' }, actionDelay: 1500 }, run: async (page) => {
    await page.click('tr:has(strong:text-is("Mealie")) button.rowmain:has-text("Start")', { timeout: 5000 });
    await page.waitForSelector('#cliPanel:not([hidden])', { timeout: 2000 });
    const anims = await page.evaluate(() => document.getAnimations().map((a) => a.animationName || a.transitionProperty));
    if (anims.length) throw new Error('still animating: ' + anims.join(', '));
    const fade = await page.evaluate(() => getComputedStyle(document.querySelector('#statusRows tr .rowActions > *')).transitionProperty);
    if (!/opacity/.test(fade)) throw new Error('the row buttons no longer fade: ' + fade);
  } },
  { name: 'Motion Like the system follows the system turning on reduce motion', screen: 'status', run: async (page) => {
    if (await page.evaluate(() => document.documentElement.classList.contains('motion-less'))) throw new Error('reduced before the system asked');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.documentElement.classList.contains('motion-less'), null, { timeout: 2000 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => !document.documentElement.classList.contains('motion-less'), null, { timeout: 2000 });
  } },
  { name: 'Picking Motion None in Settings › Appearance stops everything at once and keeps it', screen: 'settings', run: async (page) => {
    await page.click('#settingsNav .pagebtn[data-page="Appearance"]', { timeout: 5000 });
    await page.click('[role=radiogroup][aria-label="Motion"] button:has-text("None")');
    await page.waitForFunction(() => document.documentElement.classList.contains('motion-none'), null, { timeout: 2000 });
    await page.waitForFunction(() => window.__MOCK.look?.motion === 'none', null, { timeout: 2000 });
    await page.click('[role=radiogroup][aria-label="Transparency"] button:has-text("Off")');
    await page.waitForFunction(() => document.documentElement.classList.contains('no-blur') && window.__MOCK.look?.transparency === 'off', null, { timeout: 2000 });
  } },
  { name: 'Transparency Off: no blur on any screen, the save bar, the phone bar, and the error included', screen: 'settings', mock: { look: { transparency: 'off' } }, run: async (page) => {
    await page.click('#settingsNav .pagebtn[data-page="Domain"]', { timeout: 5000 });
    await page.fill('#setting-HOMELAB_DOMAIN input', 'home.example.org');
    await page.waitForSelector('#saveSettings:not([hidden])', { timeout: 2000 });
    await page.evaluate(() => { const e = document.getElementById('error'); e.textContent = 'Something went wrong'; e.hidden = false; });
    for (const phone of [false, true]) {
      if (phone) await page.evaluate(() => document.documentElement.classList.add('companion'));
      for (const screen of ['settings', 'status', 'backups']) {
        if (screen !== 'settings') await page.click(`nav button[data-screen="${screen}"]`);
        const blurred = await page.evaluate(() => [...document.querySelectorAll('*')].filter((e) => {
          const cs = getComputedStyle(e);
          return (cs.backdropFilter && cs.backdropFilter !== 'none') || (cs.webkitBackdropFilter && cs.webkitBackdropFilter !== 'none');
        }).map((e) => e.id || e.className || e.tagName));
        if (blurred.length) throw new Error(`${phone ? 'phone, ' : ''}${screen}: blur behind ${blurred.join(', ')}`);
      }
    }
  } },
  { name: 'Transparency Like the system keeps the save bar\'s blur', screen: 'settings', run: async (page) => {
    await page.click('#settingsNav .pagebtn[data-page="Domain"]', { timeout: 5000 });
    await page.fill('#setting-HOMELAB_DOMAIN input', 'home.example.org');
    await page.waitForSelector('#saveSettings:not([hidden])', { timeout: 2000 });
    const blur = await page.evaluate(() => getComputedStyle(document.querySelector('.savebar')).backdropFilter);
    if (!blur || blur === 'none') throw new Error('no blur with Transparency Like the system: ' + blur);
  } },
  { name: "An app's page opens from its row, and Status's button stays picked", screen: 'status', mock: pageMock, run: async (page) => {
    await page.click('#statusRows tr:has(strong:text-is("Vikunja")) button.topage', { timeout: 5000 });
    await page.waitForSelector('#app.screen.active h1:text-is("Vikunja")', { timeout: 5000 });
    if (!(await page.isVisible('nav button[data-screen="status"].active'))) throw new Error('Status is not the picked screen on an app page');
    await page.waitForSelector('#app .pill.ok:has-text("Running · up 8 hours")');
    await page.waitForSelector('#app .tile:has-text("Address") .value a', { timeout: 5000 });
    await page.waitForSelector('#app .tile:has-text("Uses now") .value:has-text("182 MB")', { timeout: 5000 });
    await page.waitForSelector('#app .tile:has-text("This week") .value:has-text("Up 99")', { timeout: 5000 });
    if ((await page.$$('#app .weekbars .bar.warn')).length !== 1) throw new Error('the day with missed checks is not marked');
    await page.waitForSelector('#app .tile:has-text("Last backup") .value:has-text("Today"), #app .tile:has-text("Last backup") .value:has-text("Yesterday")', { timeout: 5000 });
    await page.waitForSelector('#appLog .applog .line:has-text("Starting server")', { timeout: 5000 });
    await page.waitForSelector('#appPeople li:has-text("Anna Smith")', { timeout: 5000 });
    if (await page.isVisible('#appPeople li:has-text("Cleo Smith")')) throw new Error('someone who does not use Vikunja is listed');
    await page.click('#app a.back');
    await page.waitForSelector('#status.screen.active', { timeout: 5000 });
  } },
  { name: "Restart from an app's page, which says so at once", screen: 'app:vikunja', mock: { actionDelay: 600 }, run: async (page) => {
    await page.click('#app button:text-is("Restart")', { timeout: 5000 });
    await page.waitForSelector('#app .pill:has-text("Restarting…")', { timeout: 2000 });
    await page.waitForSelector('#cliPanel:not([hidden])', { timeout: 5000 });
    await page.waitForSelector('#app .pill.ok:has-text("Running")', { timeout: 5000 });
  } },
  { name: "An app's page copies its address and explains its log", screen: 'app:vikunja', mock: { explainer: 'llama3.2:latest', explained: { vikunja: 'Vikunja is fine.' } }, run: async (page) => {
    await page.click('#app .tile:has-text("Address") button:has-text("Copy")', { timeout: 5000 });
    await page.waitForSelector('#app .tile:has-text("Address") button:has-text("Copied")', { timeout: 2000 });
    const copied = await page.evaluate(() => window.__MOCK.clipboard);
    if (!/^https?:\/\//.test(copied || '')) throw new Error('copied ' + copied);
    await page.click('#appLog button:has-text("Explain this")');
    await page.waitForSelector('#appLog .explained .answer:has-text("Vikunja is fine.")', { timeout: 5000 });
    await page.waitForSelector('#appLog .explained:has-text("the log never left it")');
    await page.click('#appLog .explained a:has-text("Hide")');
    await page.waitForSelector('#appLog .explained', { state: 'detached', timeout: 2000 });
  } },
  { name: "An app's page shows the app's own icon, else its first letter", screen: 'app:vikunja', mock: { icons: { vikunja: sampleIcon, paperless: tinyIcon, vaultwarden: 'data:image/png;base64,bm90IGEgcGljdHVyZQ==' } }, run: async (page) => {
    const mark = async (name, want) => {
      await page.waitForSelector(`#app h1:text-is("${name}")`, { timeout: 5000 });
      await page.waitForFunction((w) => {
        const m = document.querySelector('#app .appmark');
        const img = m?.querySelector('img');
        if (w === 'letter') return !!m && !img && m.textContent.length === 1;
        return !!img && img.complete && img.naturalWidth > 0 && (w === 'small' ? img.classList.contains('small') : !img.classList.contains('small'));
      }, want, { timeout: 5000 }).catch(() => { throw new Error(`${name}'s mark is not ${want}`); });
    };
    await mark('Vikunja', 'icon');
    for (const [name, want] of [['Paperless-ngx', 'small'], ['Vaultwarden', 'letter'], ['Mealie', 'letter']]) {
      await page.click('#app a.back');
      await page.click(`#statusRows tr:has(strong:text-is("${name}")) button.topage`, { timeout: 5000 });
      await mark(name, want);
    }
  } },
  { name: "A row keeps one button: Open, or Start when stopped; a click on the row opens its page", screen: 'status', run: async (page) => {
    const row = (name) => `#statusRows tr:has(strong:text-is("${name}"))`;
    await page.waitForSelector(`${row('Vikunja')} button.rowmain:text-is("Open")`, { timeout: 5000 });
    await page.waitForSelector(`${row('Mealie')} button.rowmain:text-is("Start")`);
    const extra = await page.evaluate(() => [...document.querySelectorAll('#statusRows .rowActions button')].filter((b) => !b.classList.contains('rowmain') && !b.classList.contains('topage') && !/^(Install|Open|Start)$/.test(b.textContent.trim())).map((b) => b.title || b.textContent));
    if (extra.length) throw new Error('more buttons on the rows: ' + [...new Set(extra)].slice(0, 5).join(', '));
    await page.click(`${row('Vikunja')} button.rowmain`);
    if (!/todo\.|vikunja|localhost/.test((await page.evaluate(() => window.__MOCK.opened)) || '')) throw new Error('Open did not open the app');
    if (await page.isVisible('#app.screen.active')) throw new Error('Open went to the page');
    await page.click(`${row('Vikunja')} td.state`);
    await page.waitForSelector('#app.screen.active h1:text-is("Vikunja")', { timeout: 5000 });
  } },
  { name: "An app's settings: Nightly updates and Tell me if it stops switch at once, and say so", screen: 'app:vikunja', mock: { settingDelay: 600 }, run: async (page) => {
    const sw = (label) => `#appSettings input.switch[aria-label="${label}"]`;
    await page.waitForSelector('#appSettings:has-text("In the nightly backup")', { timeout: 5000 });
    if (!(await page.isChecked(sw('Nightly updates'))) || !(await page.isChecked(sw('Tell me if it stops')))) throw new Error('a switch starts off');
    await page.click(sw('Nightly updates'));
    if (await page.isChecked(sw('Nightly updates'))) throw new Error('the switch did not move at once');
    await page.waitForSelector('#appSettings:has-text("Held: the nightly update leaves it out")', { timeout: 300 });
    await page.waitForSelector(`${sw('Nightly updates')}:not([disabled])`, { timeout: 5000 });
    await page.click(sw('Tell me if it stops'));
    await page.waitForSelector('#appSettings:has-text("without an alert")', { timeout: 300 });
    await page.waitForSelector(`${sw('Tell me if it stops')}:not([disabled])`, { timeout: 5000 });
    const set = await page.evaluate(() => window.__MOCK.settingsSet);
    if (JSON.stringify(set) !== JSON.stringify([['vikunja', 'updates', false], ['vikunja', 'alerts', false]])) throw new Error('set ' + JSON.stringify(set));
    // Status says so too: the row's badge.
    await page.waitForSelector('#statusRows tr:has(strong:text-is("Vikunja")) .badge:has-text("updates held")', { state: 'attached', timeout: 5000 });
    if (await page.isChecked(sw('Nightly updates'))) throw new Error('the switch went back after Status was read');
  } },
  { name: "A stopped app's nightly updates can be held too", screen: 'app:vikunja', mock: { status: { ...status, apps: status.apps.map((a) => (a.id === 'vikunja' ? { ...a, state: 'stopped', health: '' } : a)) } }, run: async (page) => {
    const sw = '#appSettings input.switch[aria-label="Nightly updates"]';
    await page.waitForSelector(`${sw}:not([disabled])`, { timeout: 5000 });
    await page.click(sw);
    await page.waitForSelector('#appSettings:has-text("Held: the nightly update leaves it out")', { timeout: 5000 });
    const set = await page.evaluate(() => window.__MOCK.settingsSet);
    if (JSON.stringify(set) !== JSON.stringify([['vikunja', 'updates', false]])) throw new Error('set ' + JSON.stringify(set));
  } },
  { name: "A setting that fails goes back and says why", screen: 'app:vikunja', mock: { settingError: 'another install or setup step is running' }, run: async (page) => {
    await page.click('#appSettings input.switch[aria-label="Tell me if it stops"]', { timeout: 5000 });
    await page.waitForSelector('#error:has-text("another install or setup step is running"), .error:has-text("another install or setup step is running")', { timeout: 5000 });
    await page.waitForFunction(() => document.querySelector('#appSettings input.switch[aria-label="Tell me if it stops"]')?.checked === true, null, { timeout: 5000 });
  } },
  { name: "Remove an app: what it does first, a backup, then it goes", screen: 'app:vikunja', run: async (page) => {
    await page.click('#appMore button:has-text("Remove Vikunja…")', { timeout: 5000 });
    await page.waitForSelector('#cliTitle:has-text("Remove Vikunja")', { timeout: 5000 });
    await page.waitForSelector('#cliLog:has-text("App data on disk is kept")', { timeout: 5000 });
    if ((await page.evaluate(() => window.__MOCK.homelabRan)).length !== 1) throw new Error('it ran before the confirm');
    await page.click('#cliActions button:has-text("Back up and remove")');
    await page.waitForSelector('#cliActions button:has-text("Close")', { timeout: 5000 });
    await page.waitForSelector('#app .pill:has-text("Not running")', { timeout: 5000 });
  } },
  { name: "A stopped app's page offers Start, and uses nothing", screen: 'app:mealie', run: async (page) => {
    await page.waitForSelector('#app h1:text-is("Mealie")', { timeout: 5000 });
    await page.waitForSelector('#app .pill.warn:has-text("Stopped")');
    await page.waitForSelector('#app .tile:has-text("Uses now") .value:has-text("Nothing")');
    if (await page.isVisible('#app button:text-is("Restart")')) throw new Error('Restart on a stopped app');
    await page.click('#app button:text-is("Start")');
    await page.waitForSelector('#app .pill.ok:has-text("Running")', { timeout: 5000 });
  } },
  { name: 'Restart an app', screen: 'app:vikunja', run: async (page) => {
    await page.click('#app button:text-is("Restart")', { timeout: 5000 });
    await page.waitForSelector('#cliPanel:not([hidden])', { timeout: 5000 });
  } },
];

// An iPhone's screen, in CSS pixels.
const phoneSize = { width: 390, height: 844 };

// Every screen as each system draws it, for the accessibility and layout
// pass: the platform the page believes it runs on, and the classes the
// phone companion adds.
const screens = [
  { name: 'Status', screen: 'status' },
  { name: 'Status, every app open', screen: 'status', mock: { statusOpen: 'all' } },
  { name: 'Status after a crash', screen: 'status', mock: { crash: crashed } },
  { name: 'Choose stacks', screen: 'choose' },
  { name: 'Backups', screen: 'backups' },
  { name: 'Setup', screen: 'setup' },
  // The runtime down and no folder yet; each system's hint and folder are its own (systems).
  { name: 'Setup on a new machine', screen: 'setup', mock: { host: { runtimeOK: false, runtimeInstalled: true, rootOK: false, root: '', disks: [], kit: true } } },
  { name: 'Settings', screen: 'settings' },
  { name: 'An app’s page', screen: 'app:vikunja', mock: { ...pageMock, explainer: 'llama3.2:latest' } },
  { name: 'The phone', screen: 'status', phone: ['companion'] },
  { name: 'The phone, an app’s page', screen: 'app:vikunja', mock: pageMock, phone: ['companion'] },
  { name: 'The phone, Backups', screen: 'backups', phone: ['companion', 'can-change'] },
];
// Each system as its own machine says it: the runtime, the scheduler, and
// the folder are what the Go side reports there (internal/host).
const macHost = { ...host, runtimeHint: shots.find((s) => s.name === 'firstrun').mock.host.runtimeHint, newRoot: '/Users/you/Homelab' };
const windowsHost = { ...host, os: 'Windows 11', machine: 'Surface Laptop (7th Edition)', runtime: 'Docker Desktop', runtimeFound: 'Docker Desktop, engine 28.4.0', runtimeHint: 'start Docker Desktop and turn on Settings > General > Start Docker Desktop when you sign in', scheduler: 'taskscheduler', root: 'C:\\Users\\you\\Homelab', newRoot: 'C:\\Users\\you\\Homelab' };
const linuxHost = { ...host, os: 'Ubuntu 24.04', machine: 'ThinkCentre M75q Gen 5', runtime: 'Docker Engine', runtimeFound: 'Docker Engine 28.4.0', runtimeHint: 'sudo systemctl enable --now docker', scheduler: 'systemd', root: '/home/you/homelab', newRoot: '/home/you/homelab' };
const systems = [
  { name: 'Mac', mock: { platform: 'MacIntel', host: macHost } },
  { name: 'Windows', mock: { platform: 'Win32', host: windowsHost } },
  { name: 'Linux', mock: { platform: 'Linux x86_64', host: linuxHost } },
  { name: 'KDE', mock: { platform: 'Linux x86_64', host: { ...linuxHost, os: 'Fedora Linux 42 (KDE Plasma Desktop Edition)', desktop: 'kde' } } },
  // Plasma in desktop mode, with Docker in the home folder, run as you.
  { name: 'SteamOS', mock: { platform: 'Linux x86_64', host: { ...linuxHost, os: 'Linux (SteamOS 3.7)', machine: 'Steam Machine', runtime: 'Docker', runtimeFound: 'Docker 28.4.0, run as you', runtimeHint: 'systemctl --user start docker', root: '/home/deck/Homelab', newRoot: '/home/deck/Homelab', desktop: 'kde' } } },
  // An accent from the system: the link and button colours worked out from it.
  { name: 'Windows, pink accent', mock: { platform: 'Win32', host: { ...windowsHost, accent: { light: '#c30052', dark: '#ff4fa3' } } } },
  { name: 'Mac, yellow accent', mock: { platform: 'MacIntel', host: { ...macHost, accent: { light: '#ffcc00', dark: '#ffd60a', text: '#000' } } } },
];
// The Mac's own words (internal/host/words_test.go has the same list): as
// another system, no screen may show one, in its text or what a screen
// reader says.
const macWords = ['menu bar', 'Finder', 'this Mac', 'This Mac', 'OrbStack', 'Dock icon', '⌘'];
// What axe must find nothing of: WCAG 2.1 A and AA, at serious or worse.
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

// A page with the fake backend, the way the app opens it.
async function open(browser, s, look = {}) {
  const ctx = await browser.newContext({ viewport: s.phone ? phoneSize : { width: 1280, height: 800 }, colorScheme: look.scheme || 'light', contrast: look.contrast || 'no-preference' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript({ content: `window.__MOCK = ${JSON.stringify({ ...mock, ...look.mock, ...s.mock, host: { ...mock.host, ...look.mock?.host, ...s.mock?.host }, screen: s.screen })};\n${readFileSync(join(here, 'mock.js'), 'utf8')}` });
  await page.goto(pathToFileURL(join(root, 'web', 'dist', 'index.html')).href);
  await page.evaluate((c) => document.documentElement.classList.add('preview', ...c), s.phone || []);
  await page.waitForTimeout(600);
  return { ctx, page, errors };
}

// What moves on the page now: running animations and transitions, and any
// element (or ::before, ::after) still given a transition or an animation.
const movingNow = () => {
  const out = document.getAnimations().map((a) => `running ${a.animationName || a.transitionProperty || 'animation'}`);
  for (const e of document.querySelectorAll('*')) {
    for (const pseudo of [null, '::before', '::after']) {
      const cs = getComputedStyle(e, pseudo);
      const t = cs.transitionDuration.split(',').some((d) => parseFloat(d) > 0);
      const a = cs.animationName !== 'none' && cs.animationDuration.split(',').some((d) => parseFloat(d) > 0);
      if (t || a) out.push(`${e.id || e.className || e.tagName}${pseudo || ''}: ${t ? 'transition ' + cs.transitionProperty : 'animation ' + cs.animationName}`);
    }
  }
  return out;
};

// The fake backend's calls so far, by method; and what was called more
// since, leaving out Usage, which the power card samples on a timer.
const backendCalls = (page) => page.evaluate(() => ({ ...window.__MOCK.calls }));
const diffCalls = (before, after) => Object.entries(after).filter(([k, n]) => k !== 'Usage' && n !== (before[k] || 0)).map(([k, n]) => `${k} ×${n - (before[k] || 0)}`);

// The screenshot of a failing check, kept for CI (app/preview/failures).
const failures = join(here, 'failures');
async function keep(page, label) {
  mkdirSync(failures, { recursive: true });
  await page.screenshot({ path: join(failures, label.replace(/[^\w.-]+/g, '-').slice(0, 120) + '.png'), fullPage: true }).catch(() => {});
}

// Clicks through every smoke check in light and dark; then each screen, as
// each system, in both themes, with and without more contrast, through axe
// and a layout check. `--smoke light` or `--smoke dark` runs one theme;
// SMOKE_ONLY=text runs the checks whose name has it, SMOKE_DEBUG=1
// prints what axe measured, and SMOKE_SHOTS=folder keeps a picture of each
// screen that passed (for a pull request).
if (process.argv.includes('--smoke')) {
  const schemes = ['light', 'dark'].filter((t) => !process.argv.includes(t === 'light' ? 'dark' : 'light'));
  const picked = (label) => !process.env.SMOKE_ONLY || label.includes(process.env.SMOKE_ONLY);
  const browser = await chromium.launch();
  let failed = 0;
  for (const scheme of schemes) {
    for (const s of smokes) {
      if (!picked(`${s.name} (${scheme})`)) continue;
      const { ctx, page, errors } = await open(browser, s, { scheme });
      try {
        await s.run(page);
        if (errors.length) throw new Error(errors.join('; '));
        console.log('ok  ', `${s.name} (${scheme})`);
      } catch (e) {
        failed++;
        console.log('FAIL', `${s.name} (${scheme}):`, String(e.message || e).split('\n')[0]);
        await keep(page, `${scheme}-${s.name}`);
      }
      await ctx.close();
    }
    for (const sys of systems) {
      for (const contrast of ['no-preference', 'more']) {
        for (const s of screens) {
          const label = `${s.name}, ${sys.name}, ${scheme}${contrast === 'more' ? ', more contrast' : ''}`;
          if (!picked(label)) continue;
          const { ctx, page, errors } = await open(browser, s, { scheme, contrast, mock: sys.mock });
          try {
            if (errors.length) throw new Error(errors.join('; '));
            const layout = await page.evaluate(() => {
              const wide = document.documentElement.scrollWidth > innerWidth + 1 ? [`the page is ${document.documentElement.scrollWidth}px wide in a ${innerWidth}px window`] : [];
              const shown = [...document.querySelectorAll('[hidden]')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => `hidden but displayed: ${e.id || e.className || e.tagName}`);
              return [...wide, ...shown];
            });
            if (layout.length) throw new Error(layout.join('; '));
            if (sys.mock.platform !== 'MacIntel') {
              const said = await page.evaluate((words) => {
                const text = [document.body.innerText, ...[...document.querySelectorAll('[aria-label], [title]')].filter((e) => e.checkVisibility()).map((e) => `${e.getAttribute('aria-label') || ''} ${e.getAttribute('title') || ''}`)].join('\n');
                return words.flatMap((w) => { const at = text.indexOf(w); return at < 0 ? [] : [`says "${w}": …${text.slice(Math.max(0, at - 40), at + w.length + 40).replace(/\s+/g, ' ')}…`]; });
              }, macWords);
              if (said.length) throw new Error(said.join('; '));
            }
            await page.evaluate(axeSource);
            const found = await page.evaluate((tags) => window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] }), axeTags);
            const bad = found.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
            if (process.env.SMOKE_DEBUG) for (const v of bad) for (const n of v.nodes) console.log('  ', v.id, n.target.join(' '), JSON.stringify(n.any[0]?.data || {}));
            if (bad.length) throw new Error(bad.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(', ')}${v.nodes.length > 3 ? ` and ${v.nodes.length - 3} more` : ''}`).join('; '));
            console.log('ok  ', label);
            if (process.env.SMOKE_SHOTS) {
              // The whole screen, for a pull request: the window made tall enough to hold it.
              const tall = await page.evaluate(() => document.querySelector('main').scrollHeight + 60);
              await page.setViewportSize({ width: s.phone ? phoneSize.width : 1280, height: Math.max(s.phone ? phoneSize.height : 800, tall) });
              mkdirSync(process.env.SMOKE_SHOTS, { recursive: true });
              await page.screenshot({ path: join(process.env.SMOKE_SHOTS, label.replace(/[^\w.-]+/g, '-').slice(0, 120) + '.png') });
            }
          } catch (e) {
            failed++;
            console.log('FAIL', `${label}:`, String(e.message || e));
            await keep(page, label);
          }
          await ctx.close();
        }
      }
    }
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
