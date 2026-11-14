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
// What a paired phone may call: the keys of serve.go's phoneMethods, as
// homelab serve answers them; anything else is refused ("not on the
// phone"). A phone shot's mock (phoneMock) refuses the rest the same way.
const phoneMethods = (() => {
  const src = readFileSync(join(root, 'cmd', 'homelab', 'serve.go'), 'utf8');
  const body = src.slice(src.indexOf('func (h *homelab) phoneMethods('));
  const names = [...body.slice(0, body.indexOf('\n}\n')).matchAll(/^\t\t"([A-Z][A-Za-z]+)":/gm)].map((m) => m[1]);
  if (!names.includes('StatusBoard') || !names.includes('Host')) throw new Error('could not read the phone\'s methods from serve.go: ' + names);
  return names;
})();
const phoneMock = (phone) => (phone?.includes('companion') ? { phone, phoneMethods } : {});
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
    // A public app, reached away from home through the tunnel (its switch shows).
    reach: a.id === 'paperless' ? 'away' : undefined,
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
    ...dumped.map(([id, name, size]) => ({ id, app: id, name, newest: hoursAgo(7.5), size, count: 7, state: 'fresh' })),
    { id: 'mealie', app: 'mealie', name: 'Mealie', newest: hoursAgo(80), size: 640e3, count: 7, state: 'stale' },
    { id: 'komga', app: 'komga', name: 'Komga', newest: hoursAgo(13 * 24), size: 4.6e6, count: 7, state: 'paused', waitingFor: '/Volumes/Hobbies' },
    { id: 'kavita', app: 'kavita', name: 'Kavita', newest: hoursAgo(13 * 24), size: 1.2e6, count: 7, state: 'paused', waitingFor: '/Volumes/Hobbies' },
    { id: 'moneymatter-attachments', app: 'moneymatter', name: 'MoneyMatter (attachments)', volume: true, newest: hoursAgo(7.5), size: 22e6, count: 7, state: 'fresh' },
  ],
};
const duplicatiJobs = [
  ['Homelab AppData', 6.7, '3.311 GiB'], ['Homelab Databases', 7.1, '412 MB'], ['Homelab Infrastructure', 3 * 24, '18.4 MB'],
  ['Homelab Photos', 11, '286 GB'], ['Homelab Secrets', 7.1, '1.20 MB'], ['Homelab Stack Data', 6.6, '96.2 MB'],
].map(([name, h, size]) => ({ id: name, name, lastFinished: hoursAgo(h), nextRun: hoursAgo(h - (h > 24 ? 168 : 24)), size, state: 'ok',
  // What its last run was (Duplicati's metadata): Photos' is the long one.
  ...(name === 'Homelab Photos' ? { took: 2460, holds: '301.2 GB', files: 48211, versions: 9, sources: ['/source/photos/library/', '/source/photos/upload/'] }
    : name === 'Homelab AppData' ? { took: 212, holds: '3.6 GB', files: 18342, versions: 14, sources: ['/source/appdata/'] } : {}) }));
const cliLog = { remove: ['Remove the containers for %s? App data on disk is kept.'], 'update-all': ['These 3 apps have updates: Navidrome, Vikunja, Mealie.', '→ dumping mealie-db first', 'Updated: Navidrome 0.53.3 → 0.54.0.', 'Already up to date: Vikunja, Mealie.'], backup: ['→ dump vaultwarden → recovery-staging/databases/vaultwarden', '✓ vaultwarden: vaultwarden-20261010-091502.sqlite.gz (96 KB)', '✓ immich-database: immich-database-20261010-091503.sql.gz (58.2 MB)', '✓ .env copied and verified'], upgrade: ['Homelab files', '  → 3 change(s) on origin/main:', '  ✓ now at origin/main', 'Start the homelab', '  ✓ nothing to change'], fix: ['Fix it', '  • restart the apps that are unwell, and recreate any that stay unwell: Navidrome', '  ✓ done; homelab doctor checks the rest'], 'restore-test': ['→ asking Duplicati to restore 12 file(s) from "Homelab AppData" into recovery-staging/restore-test', '✓ 12 of 12 sampled files identical'], 'restore-test-kopia': ['→ restoring 12 file(s) from Kopia\'s newest snapshot into recovery-staging/restore-test', '✓ 12 of 12 sampled files identical'] };
const alerts = [
  { id: 'a1', time: hoursAgo(0.6), topic: 'tunnel-watchdog', title: 'Homelab: recovered', message: 'photos.example.com answering again', tags: ['white_check_mark'] },
  { id: 'a2', time: hoursAgo(1.1), topic: 'tunnel-watchdog', title: 'Homelab: restarted an app that hung', message: 'vikunja\nUnwell on two checks in a row, so the watchdog restarted it (once in 6 hours at most; AUTO_HEAL=false turns this off).', tags: ['arrows_counterclockwise'] },
  { id: 'a3', time: hoursAgo(7.9), topic: 'watchtower', title: 'Homelab: apps updated tonight', message: 'Vikunja, Speedtest Tracker' },
];
// The watchdog's last run, a few minutes ago.
// The watchdog's runs per day this week (96 a day, one every 15 minutes):
// Vikunja missed a few on the fourth day, restarting for its update.
const dayAt = (n, h, m) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, m, 0, 0); return d.toISOString(); };
const dayKey = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// The apps above 90% of the memory Docker has, alerted: the three biggest (health.Memory).
const memoryHigh = { used: 7.52 * 2 ** 30, total: 8 * 2 ** 30, since: hoursAgo(0.5), alerted: true, biggest: [
  { id: 'immich-server', name: 'Immich', bytes: 2.5 * 2 ** 30 }, { name: 'someones-own', bytes: 1.2 * 2 ** 30 }, { id: 'paperless', name: 'Paperless-ngx', bytes: 900 * 2 ** 20 }] };
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
  // Today's, for the proxy's page: the first two of five (the rest are past MaxToday in this picture).
  today: [
    { scenario: 'vpatch-CVE-2017-9841', ip: '203.0.113.7', country: 'NL', network: 'Example Hosting B.V.', when: hoursAgo(0.8), banned: true },
    { scenario: 'http-probing', ip: '198.51.100.23', country: 'US', network: 'Example Cloud', when: hoursAgo(2.5), banned: true },
  ],
  todayCount: 5,
};
// Savings recorded nightly: apps added over two months.
const savingsHistory = Array.from({ length: 60 }, (_, i) => ({
  date: new Date(Date.now() - (59 - i) * 864e5).toISOString().slice(0, 10),
  annual: i < 12 ? 2991 : i < 30 ? 3112 : i < 47 ? 3232 : 3292,
}));
// Three changes waiting on GitHub, one of them to the app. The version is
// the repository's, so the pictures never show an old one.
const version = readFileSync(join(root, 'VERSION'), 'utf8').trim();
// The example household on Finances, read forward by the Go side (internal/finance TestPreview).
const finances = JSON.parse(readFileSync(join(root, 'app', 'preview', 'finance.json'), 'utf8'));
// What actually happened to it (ledger.json, from the same test): finance.json is read forward with it.
const ledger = JSON.parse(readFileSync(join(root, 'app', 'preview', 'ledger.json'), 'utf8'));
// Every logo's key (web/src/finances/logos.ts), for the test sheet: a payment for each.
const logoKeys = [...readFileSync(join(root, 'web', 'src', 'finances', 'logos.ts'), 'utf8').matchAll(/^  "([a-z0-9]+)": \{/gm)].map((m) => m[1]);
const logoSheet = { ...finances, plan: { ...finances.plan, payments: [
  ...logoKeys.map((k, i) => ({ id: 'logo' + i, name: k, amount: 1, kind: 'other', institution: k, schedule: { every: 'month', start: '2026-01-02' } })),
  // Rows with no brand among them: a kind's icon, a name's glyph, and a letter.
  { id: 'nologo1', name: 'HOA', amount: 1, kind: 'home', schedule: { every: 'month', start: '2026-01-02' } },
  { id: 'nologo2', name: 'Water and sewer', amount: 1, kind: 'utilities', schedule: { every: 'month', start: '2026-01-02' } },
  { id: 'nologo3', name: 'Questlog', amount: 1, schedule: { every: 'month', start: '2026-01-02' } },
] } };
// The ledger with August and September before it, for Reports' longer stretches.
const ledgerMonths = { ...ledger, transactions: [
  { id: 'h1', date: '2026-08-26', account: 'chk', amount: 2400, payee: "Jordan's paycheck", category: 'Income' },
  { id: 'h2', date: '2026-08-28', account: 'chk', amount: -120, payee: "Trader Joe's", category: 'Groceries' },
  { id: 'h3', date: '2026-09-12', account: 'chk', amount: -60, payee: 'Chipotle', category: 'Eating out' },
  { id: 'h4', date: '2026-09-25', account: 'chk', amount: 2400, payee: "Jordan's paycheck", category: 'Income' },
  { id: 'h5', date: '2026-09-27', account: 'chk', amount: -140, payee: 'Costco', category: 'Groceries' },
  { id: 'h6', date: '2026-09-30', account: 'chk', amount: 25, payee: 'Costco', category: 'Groceries', note: 'Returned' },
  ...ledger.transactions,
] };
// The loans at their rates, and a card carrying a balance (its payment into it), each read to zero as the Go side
// would (the paths drawn straight): for Pay more's figures, worked out in web/src/finances/payoffPlan.ts.
// Wallos running (Status), and the subscriptions it keeps: one in the plan by its brand (Netflix), two to add, one every
// 6 months, one turned off.
const runningToo = (...ids) => ({ ...status, apps: [...status.apps, ...ids.map((id) => ({ id, name: id, state: 'running', health: 'healthy' }))] });
const withWallos = { ...status, apps: [...status.apps, { id: 'wallos', name: 'Wallos', state: 'running', health: 'healthy', url: 'http://localhost:8282' }] };
const wallosSubs = [
  { name: 'Netflix Premium', amount: 22.99, every: 'month', cycle: 'every month', next: '2026-11-12', category: 'Entertainment' },
  { name: 'Proton Mail', amount: 9.99, every: 'month', cycle: 'every month', next: '2026-11-20', category: 'Software' },
  { name: 'YouTube Premium', amount: 139.99, every: 'year', cycle: 'every year', next: '2027-02-03', category: 'Entertainment' },
  { name: 'Home insurance', amount: 610, every: '', cycle: 'every 6 months', next: '2027-01-15', category: 'Insurance' },
  { name: 'Hulu', amount: 7.99, every: 'month', cycle: 'every month', next: '2026-11-08', off: true },
];
// The car loan read from its papers: $6,997.69 at 8.38%, $221.28 a month from Aug 9, three made; half of it a payment in the plan.
function papersMock() {
  const rows = [];
  let b = 6997.69;
  for (let k = 0; b > 0.005; k++) {
    const interest = Math.round(b * 8.38 / 1200 * 100) / 100, payment = Math.min(221.28, Math.round((b + interest) * 100) / 100);
    b = Math.round((b + interest - payment) * 100) / 100;
    const d = new Date(2026, 7 + k, 9);
    rows.push({ date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-09`, payment, principal: Math.round((payment - interest) * 100) / 100, interest, after: b });
  }
  const left = rows.slice(3);
  const plan = { ...finances.plan, accounts: finances.plan.accounts.map((a) => (a.id === 'carloan' ? { ...a, original: 6997.69, rate: 8.38, firstDue: '2026-08-09', payment: 221.28, term: 36, balance: rows[2].after } : a)),
    payments: finances.plan.payments.map((x) => (x.id === 'carpay' ? { ...x, amount: 110.64 } : x)) };
  return { ...finances, plan, start: { ...finances.start, carloan: rows[2].after },
    loans: [finances.loans[0], { account: 'carloan', balance: rows[2].after, rate: 8.38, monthly: 221.28, months: left.length, date: left.at(-1).date.slice(0, 7), interest: Math.round(left.reduce((t, x) => t + x.interest, 0) * 100) / 100, path: left.map((x) => x.after), rows, made: 3 }] };
}
const ratedLoans = [
  { account: 'mortgage', balance: 287400, rate: 6.25, monthly: 1845, months: 322, date: '2053-08', interest: 304893.68, path: Array.from({ length: 322 }, (_, i) => Math.max(0, 287400 - (i + 1) * 892.5)) },
  { account: 'carloan', balance: 11240, rate: 4.9, monthly: 412, months: 29, date: '2029-03', interest: 701.16, path: Array.from({ length: 29 }, (_, i) => Math.max(0, 11240 - (i + 1) * 388)) },
  { account: 'visa', balance: 1324.65, rate: 24.99, monthly: 60, months: 27, date: '2029-01', interest: 300, path: Array.from({ length: 27 }, (_, i) => Math.max(0, 1324.65 - (i + 1) * 49.1)) },
];
// A receipt-like picture, drawn in the page: a narrow slip with a few lines of print, as a PNG.
const receiptPicture = async (page) => Buffer.from(await page.evaluate(async () => {
  const c = new OffscreenCanvas(300, 520), g = c.getContext('2d');
  g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, 300, 520);
  g.fillStyle = '#222'; g.font = 'bold 22px sans-serif'; g.fillText('COSTCO', 100, 50);
  g.font = '15px monospace';
  [['KIRKLAND EGGS', '6.49'], ['ROTISSERIE CHKN', '4.99'], ['PAPER TOWELS', '21.99'], ['OLIVE OIL 2L', '17.49'], ['BATH TOWELS', '26.10'], ['BERRIES', '9.04']].forEach(([w, n], i) => { g.fillText(w, 24, 110 + i * 30); g.fillText(n, 230, 110 + i * 30); });
  g.fillText('TOTAL', 24, 330); g.fillText('86.10', 230, 330);
  const b = await c.convertToBlob({ type: 'image/png' });
  return btoa(String.fromCharCode(...new Uint8Array(await b.arrayBuffer())));
}), 'base64');
// The same household with both cards paid off in full with each paycheck (finance-cards.json).
const paidCards = JSON.parse(readFileSync(join(root, 'app', 'preview', 'finance-cards.json'), 'utf8'));
// The same household with a share of the mortgage, $900, sent by Sam (outside it) on the 3rd (finance-moneyin.json).
const moneyIn = JSON.parse(readFileSync(join(root, 'app', 'preview', 'finance-moneyin.json'), 'utf8'));
// The same household with $500 moved from savings into checking on Nov 8,
// and Sam's check going into savings on the 12th.
// The same household with its balances typed in on the 25th: Jordan's
// check since, the 28th's HOA not out yet, and today's on the day.
const since = { ...finances, typed: '2026-10-25', since: [
  { key: 'pay:jordan:2026-10-26', date: '2026-10-26', person: 'jordan', amount: 2400, in: true },
  { key: 'payment:rothpay:2026-10-27', date: '2026-10-27', payment: 'rothpay', amount: 250 },
  { key: 'payment:hoa:2026-10-28', date: '2026-10-28', payment: 'hoa', amount: 310, waiting: true },
] };
// Pokémon cards beside the example household's accounts: collectibles, a group of their own.
const collected = { ...finances, start: { ...finances.start, pokemon: 2400 }, plan: { ...finances.plan, accounts: [...finances.plan.accounts, { id: 'pokemon', name: 'Pokémon cards', kind: 'collectible', balance: 2400, updated: '2026-10-30' }] } };
const movedIn = (() => {
  const f = structuredClone(finances), now = f.periods[1];
  f.plan.payments.push({ id: 'pull', name: 'From savings', amount: 500, kind: 'savings', from: 'sav', to: 'chk', schedule: { every: 'once', start: '2026-11-08' } });
  f.plan.people.push({ id: 'sam', name: 'Sam', net: 640, account: 'sav', schedule: { every: 'month', start: '2026-01-12' } });
  const at = now.rows.findIndex((r) => r.date > '2026-11-08');
  for (const r of now.rows.slice(at)) r.after += 500;
  now.rows.splice(at, 0, { date: '2026-11-08', payment: 'pull', amount: 500, after: now.rows[at - 1].after + 500, into: true });
  now.in += 500;
  now.left += 500;
  for (const p of f.periods.slice(1)) { p.accounts.chk += 500; p.accounts.sav -= 500; }
  f.paydays.splice(1, 0, { date: '2026-11-12', people: ['sam'], amount: 0, total: 640 });
  return f;
})();
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
  { id: 'a1b2c3', name: 'Anna’s iPhone', canChange: true, finances: 'edit', paired: hoursAgo(24 * 9), lastSeen: hoursAgo(0.2) },
  { id: 'd4e5f6', name: 'Kitchen iPad', canChange: false, paired: hoursAgo(24 * 3), lastSeen: hoursAgo(20) },
];

// What a preview says before anything runs, as the computer words it (cmd/homelab: update --all).
const cliPreview = { 'update-all': ['These 3 apps have updates: Navidrome, Vikunja, Mealie.', 'Their data is copied first, so each update can be undone: Mealie.'] };
const cliSteps = { 'update-all': ['Updating navidrome', 'Updating vikunja', 'Updating mealie'], backup: ["Copying Vaultwarden's database", "Copying Immich's database", 'Copying the settings (.env)'] };
// Tidy Up: a music library swapped in and checked, films waiting to shrink,
// and what the last weeks did (app/tidy.go's TidyUp).
const tidyAt = (h) => new Date(Date.now() - h * 3600e3).toISOString();
/** Yesterday at 3:04 AM, this machine's time: a job that started before last midnight. */
const tidyYesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(3, 4, 0, 0); return d.toISOString(); };
const tidyRun = (action, h, result, ok = true) => ({ action, ok, exit: ok ? 0 : 1, at: tidyAt(h), result });
const tidy = {
  libraries: [
    { kind: 'music', folder: '/Volumes/Hobbies/music', found: true, stage: 'verified', freed: 0, last: {
      scan: tidyRun('scan', 60, { files: 13990 }), run: tidyRun('run', 40, { in_library: 13932, set_aside: 68, needs_attention: '/Users/you/Homelab/reports/media/Music - Needs Attention' }),
      finalize: tidyRun('finalize', 30, {}), verify: tidyRun('verify', 2, { original: 14000, new: 13932, set_aside: 68, missing: 0 }), genres: tidyRun('genres', 2, { applied: 27 }),
      lyrics: tidyRun('lyrics', 5, { check: true, synced: 9120, plain: 2210, none: 2402, instrumental: 200 }),
      'genre-counts': tidyRun('genre-counts', 2, { songs: 13932, unplaced: 0, genres: { Rock: 3120, 'Hip-Hop': 2480, Pop: 2010, Electronic: 1650, Jazz: 1390, 'Soul & R&B': 1120, Classical: 640, Folk: 520, Metal: 410, Country: 300, Reggae: 160, Blues: 80, Latin: 40, World: 12 } }) },
      size: 520e9 },
    { kind: 'books', folder: '/Volumes/Hobbies/Books', found: true, stage: 'reviewed', freed: 0, size: 12e9, last: { review: tidyRun('review', 1, { books: 412, changes: 3, held: [77] }) } },
    { kind: 'movies', folder: '/Volumes/Hobbies/movies', found: true, stage: 'scanned', freed: 412e9, counts: { lean: 310, bloated: 42, queued: 3 }, waiting: 1, size: 1.4e12,
      last: { scan: tidyRun('scan', 3, { files: 355, bloated: 45, saving: 380e9, reasons: { 'video is H264': 41, 'uncompressed or lossless audio': 12, '2 extra audio tracks': 9 } }),
        'genre-counts': tidyRun('genre-counts', 3, { items: 352, unplaced: 0, source: 'Jellyfin', genres: { Drama: 88, Action: 71, Comedy: 60, Thriller: 52, 'Science Fiction': 38, Animation: 24, Horror: 12, Documentary: 7 } }) } },
    { kind: 'tv', folder: '/Volumes/Hobbies/tv', found: true, stage: 'new', freed: 0, size: 820e9 },
    { kind: 'audiobooks', folder: '/Volumes/Hobbies/audiobooks', found: false, stage: 'new', freed: 0 },
  ],
  activity: [
    { at: tidyAt(30), kind: 'music', text: 'Cleaned library swapped in', sub: 'Navidrome paused and backed up' },
    { at: tidyAt(28), kind: 'music', text: 'Navidrome tidied', sub: '558 missing entries removed, full scan' },
    { at: tidyAt(2), kind: 'music', text: 'Nothing went missing', sub: '14,000 songs before = 13,932 songs + 68 songs set aside' },
    { at: tidyAt(1), kind: 'movies', text: 'Movies shrunk', sub: '12 files replaced', action: 'collect', freed: 412e9 },
  ],
  freed: 412e9,
  checks: [
    { id: 'python', name: 'Python 3', ok: true, note: 'Python 3.12', needs: 'all' },
    { id: 'drive', name: 'The Hobbies drive', ok: true, note: '/Volumes/Hobbies', needs: 'all' },
    { id: 'runtime', name: 'Docker', ok: true, note: 'Running' },
    { id: 'gpu', name: 'Graphics for transcoding', ok: true, note: 'None found: Tdarr transcodes on the processor (slower, same result)' },
    { id: 'power', name: 'Power', ok: true, note: 'Plugged in', needs: 'heavy' },
    { id: 'ffmpeg', name: 'ffmpeg and ffprobe', ok: true, note: 'Installed', needs: 'video' },
    { id: 'ffsubsync', name: 'ffsubsync (subtitle timing)', ok: false, note: 'Not installed', fix: 'pip install ffsubsync: subtitles are kept either way, aligned only with it' },
    { id: 'calibredb', name: "Calibre's tools", ok: true, note: 'Installed', needs: 'books' },
  ],
  inbox: { folders: ['/Users/you/Downloads', '/Volumes/Hobbies/downloads'], when: 'arrive', watching: true,
    last: tidyRun('scan', 0.2, { filed: { movies: ['/Volumes/Hobbies/movies/Heat (1995)/Heat (1995).mkv'], music: ['/Volumes/Hobbies/music/Radiohead/OK Computer (1997)'] }, waiting: [{ path: '/Users/you/Downloads/Dune.Part.Two.2024.2160p', why: 'still downloading' }] }) },
  settings: { TIDY_UP: 'true', TIDY_VIDEO_CODEC: 'hevc', TIDY_KEEP_LANGUAGES: 'eng', TIDY_LYRICS: 'embed' }, mediaRoot: '/Volumes/Hobbies',
  reports: '/Users/you/Homelab/reports/media', trash: 'the Trash', tdarr: { movies: 'tidyup-movies', tv: 'tidyup-tv' },
  drive: { name: 'Hobbies', free: 1.2e12, total: 4e12 },
};
const tidyReview = [
  { id: 12, title: 'dune', changes: [{ field: 'title', old: 'dune', new: 'Dune', reason: 'case' }, { field: 'series', old: '', new: 'Dune', reason: 'online' }], cover: false, held: false },
  { id: 40, title: 'Project Hail Mary (Unabridged)', changes: [{ field: 'title', old: 'Project Hail Mary (Unabridged)', new: 'Project Hail Mary', reason: 'junk' }], cover: false, held: false },
  { id: 77, title: 'Untitled scan', changes: [{ field: 'tags', old: 'Misc', new: 'Fiction', reason: 'online' }], cover: false, held: true },
];
// What was done (internal/history), oldest first by id.
const history = [
  { id: 1, at: hoursAgo(50), kind: 'update', app: 'vikunja', who: 'the nightly update', text: 'Updated Vikunja' },
  { id: 2, at: hoursAgo(26), kind: 'settings', who: 'this computer', text: 'Changed settings: QUIET_HOURS' },
  { id: 3, at: hoursAgo(5), kind: 'heal', app: 'vikunja', who: 'the watchdog', text: 'Restarted Vikunja (no answer): it stopped answering' },
  { id: 4, at: hoursAgo(3), kind: 'stop', app: 'immich', who: "Sam's iPhone", text: 'Stopped Immich' },
  { id: 5, at: hoursAgo(2), kind: 'restart', app: 'vikunja', who: 'this computer', text: 'Restarted Vikunja' },
];
// The computer's record of alerts (internal/history's alerts), newest first: one open and snoozed from a phone,
// one cleared, one from two days ago (past ntfy's 12 hours), and a Finances reminder kept by its plain line.
const alertLog = [
  { id: 4, at: hoursAgo(0.5), topic: 'tunnel-watchdog', title: 'Homelab: something is down', body: 'crowdsec bouncer: no pull for 9 minutes', priority: 4, checks: ['crowdsec bouncer'], snoozedUntil: hoursAgo(-0.5), snoozedBy: "Sam's iPhone" },
  { id: 3, at: hoursAgo(9), topic: 'tunnel-watchdog', title: 'A Finances reminder', priority: 3 },
  { id: 2, at: hoursAgo(14), topic: 'tunnel-watchdog', title: 'Homelab: something is down', body: 'vikunja: not answering', priority: 4, checks: ['vikunja'], clearedAt: hoursAgo(13.6) },
  { id: 1, at: hoursAgo(50), topic: 'watchtower', title: 'Homelab: an update was rolled back', body: 'Navidrome' },
];
const mock = { platform: 'MacIntel', tidy, tidyReview, cliSteps, upgrade: { ...upgrade, behind: 0, changes: [], appChanged: false, appCommit: '7d9be080888433f921c9fa860a38b329ac368c88', appBehind: 0 }, catalog, status, setup, settings, host, logs, actionLog, urls, envFor, tests, backups, cliLog, cliPreview, alerts, watchdog, protection, savingsHistory, duplicatiJobs, phones, finances, ledger, history, alertLog, screen: 'status' };
// Finances' tabs are four: Spending holds Transactions and Reports, Plan holds Calendar, Recurring and Paychecks (Pay),
// each in a second row under it. A page by its name, its tab first.
const finGroups = { Transactions: 'Spending', Reports: 'Spending', Calendar: 'Plan', Recurring: 'Plan', Pay: 'Plan', Paychecks: 'Plan', Collection: 'Net worth' };
// What the household shares with a member (serve.go's memberShared), made up.
const householdShared = { currency: 'USD', shares: ['bills', 'subscriptions', 'budgets'], bills: [{ name: 'Made-up Power', kind: 'utility', amount: 120, date: '2026-11-20', every: 'month' }], subscriptions: [{ name: 'Made-up Stream', amount: 15.99, every: 'month' }], budgets: [{ category: 'Groceries', amount: 600, spent: 200, left: 400 }] };

// What the phone's page keeps: localStorage, the IndexedDB databases, and private Finances' one record (privacy.ts).
async function keptInPage(page) {
  return page.evaluate(async () => {
    const all = Object.keys(localStorage).map((k) => k + '=' + localStorage.getItem(k)).join('\n');
    const dbs = indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name) : [];
    const sealed = !dbs.includes('homelab-private') ? 'null' : await new Promise((ok) => {
      const r = indexedDB.open('homelab-private');
      r.onsuccess = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('sealed')) { db.close(); ok('null'); return; }
        const g = db.transaction('sealed').objectStore('sealed').get('mine');
        g.onsuccess = () => { db.close(); ok(JSON.stringify(g.result ?? null)); };
        g.onerror = () => { db.close(); ok('null'); };
      };
      r.onerror = () => ok('null');
    });
    return { all, dbs, sealed };
  });
}

// Makes a member's Finances private on her phone's page (Private.tsx), with Face ID or, given one, a passphrase:
// answers her recovery code's 16 words, as shown once.
async function makePrivate(page, passphrase) {
  await page.click('#finPrivateOn button:text-is("Make them private…")', { timeout: 5000 });
  if (!/comes from the homelab computer/.test(await page.textContent('#finPrivateLimit'))) throw new Error('the page’s limit is not said');
  await page.click('#finPrivateOn button:text-is("Continue")');
  const words = await page.locator('#finPrivateCode li').allTextContents();
  if (words.length !== 16) throw new Error('the recovery code is not 16 words: ' + words);
  await page.click('#finPrivateOn button:text-is("I wrote them down")');
  const make = page.locator('#finPrivateOn button:text-is("Make them private with Face ID")');
  if (!(await make.isDisabled())) throw new Error('Face ID offered before two words were typed back');
  for (const label of await page.locator('#finPrivateOn label.field').allTextContents()) {
    const n = Number(/Word (\d+)/.exec(label)[1]);
    await page.locator('#finPrivateOn').getByLabel(`Word ${n}`, { exact: true }).fill(words[n - 1]);
  }
  await make.click();
  if (passphrase) {
    await page.waitForSelector('#finPrivateOn [role=alert]:has-text("choose a passphrase instead")', { timeout: 5000 });
    await page.locator('#finPrivateOn').getByLabel('Passphrase', { exact: true }).fill(passphrase);
    await page.locator('#finPrivateOn').getByLabel('The same again').fill(passphrase);
    await page.click('#finPrivateOn button:text-is("Make them private")');
  }
  await page.waitForSelector('#finPrivateOpen', { timeout: 15000 });
  return words;
}

async function finTab(page, name, opts = {}) {
  const group = finGroups[name];
  if (!group) return page.click(`#finRoot > .seg button:text-is("${name}")`, opts);
  await page.click(`#finRoot > .seg button:text-is("${group}")`, opts);
  return page.click(`#finRoot .fx-subtabs .seg button:text-is("${name === 'Pay' ? 'Paychecks' : name}")`, opts);
}
/** An account's form, from Net worth: its row opens the account's own page, whose Edit opens the form. */
async function acctForm(page, row, opts = {}) {
  await page.click(row, opts);
  await page.click('#finRoot .fx-account button:text-is("Edit")', { timeout: 5000 });
}
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
  { name: 'finances', screen: 'finances' },
  { name: 'finances-worth', screen: 'finances', before: async (page) => { await finTab(page, 'Net worth'); await page.waitForTimeout(300); } },
  { name: 'finances-pay', screen: 'finances', before: async (page) => { await finTab(page, 'Pay'); await page.waitForTimeout(300); } },
  { name: 'finances-car', screen: 'finances', before: async (page) => { await finTab(page, 'Net worth'); await page.click('#finRoot .toolbar button:text-is("Add an account")'); await page.click('#finSheet button.kindrow:has(strong:text-is("Car"))'); await page.click('#finSheet .brandgrid button:has-text("Toyota")'); await page.waitForTimeout(400); } },
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
  // Tidy Up: what to do next beside the drive, the shelf of libraries, and Music's own tab with its steps.
  { name: 'tidy', screen: 'tidy' },
  // Movies' tab: its Space card beside Genres, the two-up row Tidy Up's look lines up with Finances' (L4).
  { name: 'tidy-movies', screen: 'tidy', before: async (page) => { await page.click('#tidy .seg button:text-is("Movies")', { timeout: 5000 }); await page.waitForSelector('#tidy .tidyspace', { timeout: 5000 }); await page.evaluate(() => document.querySelector('#tidy .tidygenres').scrollIntoView({ block: 'center' })); } },
  // Overview's Genres, its library picked with Finances' switch (L4).
  { name: 'tidy-genres', screen: 'tidy', before: async (page) => { await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 }); await page.waitForSelector('#tidy .tidybottom .tidygenres', { timeout: 5000 }); await page.evaluate(() => document.querySelector('#tidy .tidygenres').scrollIntoView({ block: 'center' })); } },
  { name: 'tidy-music', screen: 'tidy', before: async (page) => { await page.click('#tidy .seg button:text-is("Music")', { timeout: 5000 }); await page.waitForSelector('#tidy .tidytrack', { timeout: 5000 }); } },
];

// Clicks through the buttons that run commands, against the fake backend
// (node app/preview/shoot.mjs --smoke, or make app-smoke): each must finish
// with its success text and no script error.
// A crash of the background agent yesterday, as LastCrash returns it.
const crashed = { who: 'the background agent', version: '0.9.7-beta', when: new Date(Date.now() - 864e5).toISOString(), doing: 'main.(*homelab).watchdog', file: 'scripts/logs/crash-2026-10-25.log' };
// A finger held on a Status row for ms, as a touchscreen sends it: touchstart, then touchend (and the click it makes).
const longPress = (page, name, ms) => page.evaluate(async ([name, ms]) => {
  const row = [...document.querySelectorAll('#statusRows tr')].find((r) => r.querySelector('strong')?.textContent === name);
  const cell = row.querySelector('td.state');
  cell.scrollIntoView({ block: 'center' });
  const r = cell.getBoundingClientRect();
  const touch = new Touch({ identifier: 1, target: cell, clientX: r.left + 20, clientY: r.top + r.height / 2 });
  cell.dispatchEvent(new TouchEvent('touchstart', { touches: [touch], targetTouches: [touch], changedTouches: [touch], bubbles: true, cancelable: true }));
  await new Promise((done) => setTimeout(done, ms));
  const end = new TouchEvent('touchend', { touches: [], targetTouches: [], changedTouches: [touch], bubbles: true, cancelable: true });
  cell.dispatchEvent(end);
  if (!end.defaultPrevented) cell.click();
}, [name, ms]);
// Mealie stopped by itself at 3:12 this morning, out of memory; Vikunja stopped last night with no reason Docker
// gave (a shutdown, or docker stop by hand). Neither was stopped from the app.
function stoppedByItself() {
  const now = new Date();
  const at = (days, h, m) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, h, m).toISOString();
  return { statusOpen: '', status: { ...status, apps: status.apps.map((a) =>
    a.id === 'mealie' ? { ...a, state: 'stopped', health: '', since: undefined, stoppedAt: at(0, 3, 12), stoppedWhy: 'it ran out of memory' }
      : a.id === 'vikunja' ? { ...a, state: 'stopped', health: '', since: undefined, stoppedAt: at(-1, 21, 40) } : a) } };
}

const smokes = [
  // Every card on Tidy Up holds its words and buttons inside its edges, as Status's do (its own cards once had none),
  // on every tab and while a job runs.
  { name: 'Tidy Up: every card keeps its contents off its edges', screen: 'tidy', mock: { tidyHold: true, tidy: { ...tidy, libraries: tidy.libraries.map((l) => (l.kind === 'audiobooks' ? { ...l, found: true } : l)) }, tidyEvents: { 'audiobooks scan': [{ type: 'step', n: 1, total: 2, text: 'Reading' }, { type: 'progress', label: 'Books', done: 5, total: 20, note: 'Dune' }] } }, run: async (page) => {
    await page.waitForSelector('#tidy .fx-board', { timeout: 5000 });
    const bad = [];
    const look = async (where) => bad.push(...(await page.evaluate((where) => {
      const out = [];
      for (const card of document.querySelectorAll('#tidy .card')) {
        if (!card.checkVisibility()) continue;
        const c = card.getBoundingClientRect();
        const name = card.querySelector('h2')?.textContent || card.className;
        for (const e of card.children) {
          if (!e.checkVisibility()) continue;
          const r = e.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          if (r.left - c.left < 12 || c.right - r.right < 12 && r.width > 40 && e.tagName !== 'DETAILS' || r.top - c.top < 10 && e === card.firstElementChild) out.push(`${where}: ${name}: ${e.tagName.toLowerCase()}.${e.className} sits ${Math.round(r.left - c.left)}px from the left, ${Math.round(r.top - c.top)}px from the top`);
        }
      }
      return out;
    }, where)));
    for (const tab of ['Inbox', 'Music', 'Movies', 'TV', 'Books', 'Audiobooks']) {
      await page.click(`#tidy .seg button:text-is("${tab}")`, { timeout: 5000 });
      await page.waitForTimeout(120);
      await look(tab);
    }
    // A job's card, at the top of the tab.
    await page.click('#tidy .tidyneeds button:text-is("Scan")');
    await page.waitForSelector('#tidyJob .progress', { timeout: 5000 });
    await look('A job running');
    if (bad.length) throw new Error(bad.slice(0, 4).join('; ') + (bad.length > 4 ? ` and ${bad.length - 4} more` : ''));
  } },
  // Every card's heading sits at the same height, whether it stands alone or beside a button or a dropdown.
  { name: 'Tidy Up: every card’s heading sits at the same height', screen: 'tidy', run: async (page) => {
    await page.waitForSelector('#tidy .fx-board', { timeout: 5000 });
    const bad = [];
    for (const tab of ['Inbox', 'Music', 'Movies', 'TV', 'Books', 'Audiobooks']) {
      await page.click(`#tidy .seg button:text-is("${tab}")`, { timeout: 5000 });
      await page.waitForTimeout(120);
      bad.push(...(await page.evaluate((tab) => [...document.querySelectorAll('#tidy .card:not(.notice)')].filter((c) => c.checkVisibility()).flatMap((c) => {
        const h = c.querySelector('h2');
        if (!h) return [];
        const top = h.getBoundingClientRect().top - c.getBoundingClientRect().top;
        return top > 24 ? [`${tab}: ${h.textContent.trim()} starts ${Math.round(top)}px down its card`] : [];
      }), tab)));
    }
    if (bad.length) throw new Error(bad.slice(0, 4).join('; ') + (bad.length > 4 ? ` and ${bad.length - 4} more` : ''));
  } },
  // Overview's list is what each library waits on, in order, each with the button that does it; the heading counts
  // the same things the card does, and a drive that is away is said, not counted.
  { name: 'Tidy Up: Overview lists what needs your OK, each with its button, and the counts agree', screen: 'tidy', run: async (page) => {
    await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
    await page.waitForSelector('#tidy .tidyneeds li', { timeout: 5000 });
    const rows = await page.$$eval('#tidy .tidyneeds li', (ls) => ls.map((l) => [l.querySelector('strong')?.textContent.trim(), l.querySelector('button')?.textContent.trim() || '']));
    const want = [['Free the old music library', 'Free it…'], ['2,402 songs could get lyrics', 'Add lyrics'], ['Shrink 42 films', 'Shrink'], ['Tdarr is shrinking 4 films', 'Collect'], ['2 books could look tidier', 'Look…'], ['Look at your TV first', 'Scan'], ['Audiobooks: its drive isn\'t plugged in', '']];
    const sorted = (a) => JSON.stringify([...a].sort((x, y) => x[0].localeCompare(y[0])));
    if (sorted(rows) !== sorted(want)) throw new Error('rows: ' + JSON.stringify(rows));
    if (!(await page.textContent('#tidy .tidyneeds li:has-text("Shrink 42 films")')).includes('380 GB')) throw new Error('the shrink does not say what it wins back');
    const head = (await page.textContent('#tidy .header .lead')).trim(), card = (await page.textContent('#tidy .tidyneeds .fx-actions')).trim();
    if (!head.includes('6 things need your OK') || !card.startsWith('6 things')) throw new Error(`the heading says “${head}”, the card “${card}”`);
    await page.click('#tidy .tidyneeds li:has-text("Look at your TV first") button:text-is("Scan")');
    await page.waitForFunction(() => (window.__MOCK.tidyRuns || []).length === 1, null, { timeout: 5000 });
    const runs = await page.evaluate(() => window.__MOCK.tidyRuns);
    if (JSON.stringify(runs[0]) !== JSON.stringify(['tv', 'scan', [], false])) throw new Error(JSON.stringify(runs));
  } },
  // ffmpeg missing, where the app can fetch it: Overview's row has Install; a TV scan that stops for want of it says
  // why (not "exit status 1") with Install ffmpeg, which fetches it and then runs the scan again by itself.
  { name: 'Tidy Up: ffmpeg missing: Install fetches it, and the scan that stopped carries on', screen: 'tidy', mock: (() => {
    const fix = 'Install gets ffmpeg 7.1 from ffmpeg.martin-riedl.de (about 52 MB, GPL), checked before it runs; or install ffmpeg: brew install ffmpeg in Terminal (Homebrew is at brew.sh)';
    const missing = { ...tidy, checks: tidy.checks.map((c) => (c.id === 'ffmpeg' ? { ...c, ok: false, note: 'Not installed', fix, install: 'ffmpeg' } : c)) };
    return { tidy: missing, tidyFails: { 'tv scan': `ffmpeg and ffprobe: Not installed. ${fix}` },
      tidyEvents: { 'install ffmpeg': [{ type: 'step', n: 1, total: 2, text: 'Downloading ffmpeg 7.1' }, { type: 'progress', label: 'MB', done: 52, total: 52 }, { type: 'ok', text: 'ffmpeg 7.1 is ready: Tidy Up uses it from now on' }] },
      tidyAfter: { 'install ffmpeg': { tidy, tidyFails: {} } } };
  })(), run: async (page) => {
    await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
    const row = '#tidy .tidyneeds li:has-text("Install ffmpeg")';
    await page.waitForSelector(`${row} button:text-is("Install")`, { timeout: 5000 });
    if (!(await page.textContent(row)).includes('from ffmpeg.martin-riedl.de')) throw new Error('the row does not say where it comes from');
    await page.click('#tidy .tidyneeds li:has-text("Look at your TV first") button:text-is("Scan")');
    await page.waitForSelector('#tidyJob h2:text-is("Scanning your TV: didn\'t finish")', { timeout: 5000 });
    const why = (await page.textContent('#tidyJob p.bad')).trim();
    if (!why.startsWith('ffmpeg and ffprobe: Not installed.')) throw new Error('the card says ' + why);
    await page.click('#tidyJob .tidyfix button:text-is("Install ffmpeg")');
    await page.waitForSelector('#tidyJob h2:text-is("Scanning your TV: done")', { timeout: 8000 });
    const runs = await page.evaluate(() => window.__MOCK.tidyRuns.map((r) => r.slice(0, 2).join(' ')));
    if (runs.join() !== 'tv scan,install ffmpeg,tv scan') throw new Error('ran: ' + runs.join());
    await page.waitForFunction(() => !document.querySelector('#tidy .tidyneeds li button')?.closest('li')?.textContent.includes('Install ffmpeg'), null, { timeout: 5000 })
      .catch(() => { throw new Error('the Install row stayed after ffmpeg was fetched'); });
  } },
  // Calibre missing: its row opens Calibre's download page (it's a whole app, so the app doesn't fetch it).
  { name: 'Tidy Up: Calibre missing: its row opens Calibre’s download page', screen: 'tidy', mock: { tidy: { ...tidy, checks: tidy.checks.map((c) => (c.id === 'calibredb' ? { ...c, ok: false, note: 'Not installed', fix: "Install the Calibre app (Calibre-Web doesn't include its tools)" } : c)) } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
    await page.click('#tidy .tidyneeds li:has-text("Calibre’s tools") button:text-is("Get Calibre"), #tidy .tidyneeds li:has-text("Calibre\'s tools") button:text-is("Get Calibre")', { timeout: 5000 });
    await page.waitForFunction(() => window.__MOCK.opened === 'https://calibre-ebook.com/download', null, { timeout: 3000 })
      .catch(async () => { throw new Error('opened ' + (await page.evaluate(() => window.__MOCK.opened))); });
  } },
  // A genre count that found nothing says what it counted and why (no Jellyfin key, no .nfo files), with Count again,
  // not the first ask as if nothing ran.
  { name: 'Tidy Up: a genre count with nothing to read says why', screen: 'tidy', mock: {
    tidy: { ...tidy, libraries: tidy.libraries.map((l) => (l.kind === 'movies' ? { ...l, last: { ...l.last, 'genre-counts': tidyRun('genre-counts', 1, { items: 4, genres: {}, unplaced: 4, source: 'nowhere yet',
      why: "Jellyfin's API key isn't set: make one in Jellyfin › Dashboard › API Keys, and put it in Settings › Jellyfin (Jellyfin API key); and none has an .nfo file beside it" }) } } : l)) } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Movies")', { timeout: 5000 });
    const box = '#tidy .tidygenres';
    await page.waitForSelector(`${box} button:text-is("Count again")`, { timeout: 5000 });
    const text = await page.textContent(box);
    if (!text.includes('Counted 4 films: none has a genre yet.') || !text.includes('Jellyfin › Dashboard › API Keys')) throw new Error('the box says ' + text);
    await page.click(`${box} button:text-is("Count again")`);
    await page.waitForFunction(() => (window.__MOCK.tidyRuns || []).some((r) => r[0] === 'movies' && r[1] === 'genre-counts'), null, { timeout: 5000 });
    // The key's own field, one click away: Settings opens on Jellyfin's page at it.
    await page.click(`${box} button:text-is("Add Jellyfin’s API key")`);
    await page.waitForSelector('#settings.active', { timeout: 5000 });
    await page.waitForFunction(() => document.getElementById('setting-JELLYFIN_API_KEY')?.checkVisibility(), null, { timeout: 3000 })
      .catch(() => { throw new Error('Settings did not open at the Jellyfin API key'); });
  } },
  // Lyrics: the card says what came of every song, the ones that kept theirs on grey lines; Overview counts only the songs
  // still worth asking LRCLIB about, and says how many it had nothing for.
  { name: 'Tidy Up: lyrics say what came of every song, and Overview counts only those still to ask', screen: 'tidy', mock: {
    tidy: { ...tidy, libraries: tidy.libraries.map((l) => (l.kind === 'music' ? { ...l, last: { ...l.last, lyrics: tidyRun('lyrics', 5, { synced: 9120, plain: 2210, none: 40, not_found: 2362, instrumental: 200 }) } } : l)) },
    tidyEvents: { 'music lyrics': [{ type: 'ok', text: 'Lyrics added to 3,348 songs; 1,181 plain ones replaced by time-synced' }, { type: 'note', text: '2,362 aren’t on LRCLIB yet: asked again in a month' },
      { type: 'note', text: '200 are instrumentals' }, { type: 'result', action: 'lyrics', ok: true }] } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
    const row = '#tidy .tidyneeds li:has-text("could get lyrics")';
    await page.waitForSelector(row, { timeout: 5000 });
    const text = await page.textContent(row);
    if (!text.includes('40 songs could get lyrics') || !text.includes('2,362 songs not on LRCLIB yet')) throw new Error('the row says ' + text);
    await page.click(`${row} button:text-is("Add lyrics")`);
    await page.waitForSelector('#tidyJob h2:text-is("Adding lyrics: done")', { timeout: 5000 });
    const lines = await page.$$eval('#tidyJob .tidylines li', (ls) => ls.map((l) => [l.querySelector('.dot')?.className.trim(), l.textContent.trim()]));
    const note = lines.find((l) => l[1].includes('aren’t on LRCLIB yet'));
    if (!note || note[0] !== 'dot') throw new Error('the note line: ' + JSON.stringify(lines));
    if (!lines.some((l) => l[0] === 'dot ok' && l[1].startsWith('Done: Lyrics added'))) throw new Error('lines: ' + JSON.stringify(lines));
  } },
  // Every song has lyrics, but some show two languages on one line (a translation after a caret): Overview still
  // offers to set them apart, which the lyrics job does.
  { name: 'Tidy Up: songs with two languages on one line are offered on Overview', screen: 'tidy', mock: {
    tidy: { ...tidy, libraries: tidy.libraries.map((l) => (l.kind === 'music' ? { ...l, last: { ...l.last, lyrics: tidyRun('lyrics', 5, { check: true, synced: 13932, none: 0, to_clean: 12 }) } } : l)) },
    tidyEvents: { 'music lyrics': [{ type: 'ok', text: 'Lyrics added to 0 songs; 0 plain ones replaced by time-synced' },
      { type: 'note', text: '12 had a translation after a caret on each line: each is on its own line under its original now' }, { type: 'result', action: 'lyrics', ok: true }] } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
    const row = '#tidy .tidyneeds li:has-text("two languages on one line")';
    await page.waitForSelector(row, { timeout: 5000 });
    const text = await page.textContent(row);
    if (!text.includes('12 songs show two languages on one line')) throw new Error('the row says ' + text);
    await page.click(`${row} button:text-is("Tidy lyrics")`);
    await page.waitForSelector('#tidyJob h2:text-is("Tidying lyrics: done")', { timeout: 5000 });
    const ran = await page.evaluate(() => window.__MOCK.tidyRuns || []);
    // Set right on this computer: never a wait on LRCLIB.
    if (!ran.some((r) => r[0] === 'music' && r[1] === 'lyrics' && (r[2] || []).includes('--tidy'))) throw new Error('ran ' + JSON.stringify(ran));
  } },
  // Thousands of songs with no lyrics yet, and some with two languages on one line (Nov 6, the owner): setting those
  // apart is offered on its own, not only inside Add lyrics, which asks LRCLIB about every song first.
  { name: 'Tidy Up: two languages on one line are tidied even with songs still to ask LRCLIB about', screen: 'tidy', mock: {
    tidy: { ...tidy, libraries: tidy.libraries.map((l) => (l.kind === 'music' ? { ...l, last: { ...l.last, lyrics: tidyRun('lyrics', 5, { check: true, synced: 9120, none: 2402, to_clean: 3150 }) } } : l)) } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
    const tidyRow = '#tidy .tidyneeds li:has-text("two languages on one line")';
    await page.waitForSelector(tidyRow, { timeout: 5000 });
    if (!(await page.textContent(tidyRow)).includes('3,150 songs show two languages on one line')) throw new Error('the row says ' + (await page.textContent(tidyRow)));
    if (!(await page.isVisible('#tidy .tidyneeds li:has-text("2,402 songs could get lyrics") button:text-is("Add lyrics")'))) throw new Error('no Add lyrics beside it');
    await page.click(`${tidyRow} button:text-is("Tidy lyrics")`);
    const ran = await page.evaluate(() => window.__MOCK.tidyRuns || []);
    if (!ran.some((r) => r[0] === 'music' && r[1] === 'lyrics' && (r[2] || []).includes('--tidy'))) throw new Error('ran ' + JSON.stringify(ran));
  } },
  // A lyrics check from before the count of songs with two languages on one line: Overview offers one more check,
  // which changes nothing, so those songs are found.
  { name: 'Tidy Up: an older lyrics check is offered again on Overview', screen: 'tidy', mock: {
    tidy: { ...tidy, libraries: tidy.libraries.map((l) => (l.kind === 'music' ? { ...l, last: { ...l.last, lyrics: tidyRun('lyrics', 5, { synced: 13932, none: 0, cleaned: 0 }) } } : l)) },
    tidyEvents: { 'music lyrics': [{ type: 'result', action: 'lyrics', ok: true, check: true, to_clean: 12 }] } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
    const row = '#tidy .tidyneeds li:has-text("Look over the lyrics again")';
    await page.waitForSelector(row, { timeout: 5000 });
    await page.click(`${row} button:text-is("Check lyrics")`);
    await page.waitForFunction(() => (window.__MOCK.tidyRuns || []).some((r) => r[0] === 'music' && r[1] === 'lyrics' && (r[2] || []).includes('--check')), null, { timeout: 5000 });
  } },
  // With nothing waiting, Overview says everything is tidy, and the heading says it too.
  { name: 'Tidy Up: with nothing to do, Overview says everything is tidy', screen: 'tidy', mock: { tidy: { ...tidy, libraries: [
    { ...tidy.libraries[0], stage: 'freed', last: { ...tidy.libraries[0].last, lyrics: tidyRun('lyrics', 5, { check: true, synced: 13932, none: 0, to_clean: 0 }) } },
    { ...tidy.libraries[1], last: { review: tidyRun('review', 1, { books: 412, changes: 0 }) } },
    { ...tidy.libraries[2], counts: { lean: 352 }, waiting: 0, last: { scan: tidyRun('scan', 3, { files: 352, bloated: 0 }) } },
    { ...tidy.libraries[3], last: { scan: tidyRun('scan', 3, { files: 800, bloated: 0 }) } },
    { ...tidy.libraries[4], found: true, last: { scan: tidyRun('scan', 3, { files: 40, books: 0 }) } },
  ] }, tidyReview: [] }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
    await page.waitForSelector('#tidy .tidyneeds .tidyclear:has-text("Everything\'s tidy")', { timeout: 5000 });
    if (await page.$('#tidy .tidyneeds li')) throw new Error('a row waits with nothing to do');
    const head = (await page.textContent('#tidy .header .lead')).trim();
    if (!head.endsWith('Everything is tidy')) throw new Error('the heading says ' + head);
  } },
  // Overview's books row opens the Books tab, with its review.
  { name: 'Tidy Up: Overview’s books row opens Books and its review', screen: 'tidy', run: async (page) => {
    await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
    await page.click('#tidy .tidyneeds li:has-text("could look tidier") button:text-is("Look…")');
    await page.waitForSelector('#tidyReview li:has-text("Project Hail Mary")', { timeout: 5000 });
    if ((await page.textContent('#tidy .seg [aria-checked="true"]')).trim() !== 'Books') throw new Error('the Books tab is not the one picked');
  } },
  // A tab kept from before the tabs changed opens where its things are now.
  { name: 'Tidy Up: a tab kept from before opens where its things are now', screen: 'tidy', mock: { tidyTab: 'inbox' }, run: async (page) => {
    await page.waitForSelector('#tidy .tidyneeds', { timeout: 5000 });
    if ((await page.textContent('#tidy .seg [aria-checked="true"]')).trim() !== 'Inbox') throw new Error('New downloads did not open on Inbox');
  } },
  // One genre chart: the music library's genres by share; with none counted yet, a button counts them.
  { name: 'Tidy Up: the genre chart shows music’s genres by share', screen: 'tidy', run: async (page) => {
    await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
    await page.waitForSelector('#tidy .tidygenres svg', { timeout: 5000 });
    const legend = await page.textContent('#tidy .tidygenres');
    for (const w of ['13,932', 'Rock', '22%', '8 more']) if (!legend.includes(w)) throw new Error(`the chart has no “${w}”: ${legend}`);
  } },
  { name: 'Tidy Up: with no genres counted, the chart’s button counts them', screen: 'tidy', mock: { tidy: { ...tidy, libraries: tidy.libraries.map((l) => (l.kind === 'music' ? { ...l, last: Object.fromEntries(Object.entries(l.last).filter(([k]) => k !== 'genre-counts')) } : l)) } }, run: async (page) => {
    // Overview shows what is counted (the films); Music offers its own count.
    await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
    await page.waitForSelector('#tidy .tidygenres:has-text("Drama")', { timeout: 3000 });
    await page.click('#tidy .seg button:text-is("Music")');
    await page.click('#tidy .tidygenres button:text-is("Count genres")', { timeout: 5000 });
    await page.waitForFunction(() => (window.__MOCK.tidyRuns || []).length === 1, null, { timeout: 5000 });
    const runs = await page.evaluate(() => window.__MOCK.tidyRuns);
    if (JSON.stringify(runs[0]) !== JSON.stringify(['music', 'genre-counts', [], false])) throw new Error(JSON.stringify(runs));
  } },
  // With more than one library counted, a switch picks whose genres the chart shows, as Finances' cards switch
  // (Tidy Up's look, L4: not a system select box).
  { name: 'Tidy Up: the genre chart’s switch picks the library', screen: 'tidy', run: async (page) => {
    await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
    const pick = '#tidy .tidygenres [role="radiogroup"][aria-label="Genres of"]';
    await page.waitForSelector(pick, { timeout: 5000 });
    if (await page.$('#tidy .tidygenres select')) throw new Error('a system select box');
    const options = await page.$$eval(`${pick} [role="radio"]`, (os) => os.map((o) => o.textContent));
    if (JSON.stringify(options) !== JSON.stringify(['Music', 'Movies'])) throw new Error('options: ' + JSON.stringify(options));
    if ((await page.getAttribute(`${pick} [role="radio"]:text-is("Music")`, 'aria-checked')) !== 'true') throw new Error('Music not picked first');
    await page.click(`${pick} [role="radio"]:text-is("Movies")`);
    await page.waitForSelector('#tidy .tidygenres:has-text("One genre each, from Jellyfin")', { timeout: 3000 });
    const t = await page.textContent('#tidy .tidygenres');
    for (const w of ['352', 'films', 'Drama', '25%', '2 more']) if (!t.includes(w)) throw new Error(`no “${w}”: ${t}`);
  } },
  // Two cards in a row line up as Finances' do (L4): the same height, the same padding, the figure on the same line.
  { name: 'Tidy Up: Movies’ Genres and Space line up, as Finances’ cards do', screen: 'tidy', run: async (page) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.click('#tidy .seg button:text-is("Movies")', { timeout: 5000 });
    await page.waitForSelector('#tidy .tidyspace', { timeout: 5000 });
    const [a, b] = await page.$$eval('#tidy .tidygenres, #tidy .tidyspace', (els) => els.map((e) => {
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e), f = e.querySelector('.fx-stat');
      return { top: Math.round(r.top), h: Math.round(r.height), pad: cs.padding, fig: f ? Math.round(f.getBoundingClientRect().top - r.top) : -1 };
    }));
    if (a.top !== b.top) throw new Error(`not in one row: ${a.top}, ${b.top}`);
    if (Math.abs(a.h - b.h) > 1) throw new Error(`heights ${a.h} and ${b.h}`);
    if (a.pad !== b.pad || a.fig !== b.fig) throw new Error(`padding ${a.pad} / ${b.pad}, figure at ${a.fig} / ${b.fig}`);
  } },
  // Rows as Finances lists them (L5): each caption on one line at 860px where it fits, said shorter where it ran on.
  { name: 'Tidy Up: rows say their caption on one line at 860px', screen: 'tidy', mock: { tidy: { ...tidy, libraries: tidy.libraries.map((l) => (l.kind !== 'music' ? l
    : { ...l, last: { ...l.last, lyrics: tidyRun('lyrics', 5, { check: true, synced: 9120, plain: 2210, none: 2402, to_clean: 0 }) } })) } }, run: async (page) => {
    await page.setViewportSize({ width: 860, height: 900 });
    const wraps = [];
    for (const [tab, rows] of [['Music', ['could get lyrics', 'Lyrics']], ['Movies', ['Tdarr is shrinking', 'what Radarr downloads']], ['TV', ['what Sonarr downloads']]]) {
      await page.click(`#tidy .seg button:text-is("${tab}")`, { timeout: 5000 });
      for (const r of rows) {
        const li = page.locator(`#tidy .tidyneeds li:has(strong:text-is("${r}")), #tidy .tidyneeds li:has(strong:has-text("${r}"))`).first();
        await li.waitFor({ timeout: 5000 });
        const lines = await li.evaluate((l) => { const e = l.querySelector('.grow > .muted, .grow > .line'); if (!e) return -1; return Math.round(e.getBoundingClientRect().height / (parseFloat(getComputedStyle(e).lineHeight) || 20)); });
        if (lines !== 1) wraps.push(`${tab} › ${r}: ${lines} lines`);
      }
    }
    if (wraps.length) throw new Error(wraps.join('; '));
  } },
  // L7: Tidy Up in the dark is Finances' night (a near-black ground, cards a step lighter with a thin line and no
  // shadow), not the rest of the app's grey; in the light, and with more contrast, both keep the app's own colours.
  { name: 'Tidy Up: its ground and cards are the same as Finances’ in each theme', screen: 'tidy', run: async (page) => {
    const look = () => page.evaluate(() => {
      const main = getComputedStyle(document.querySelector('main')), card = getComputedStyle(document.querySelector('section.active .card'));
      return { ground: main.backgroundColor, card: card.backgroundColor, line: card.borderTopColor, shadow: card.boxShadow };
    });
    await page.waitForSelector('#tidy .tidyneeds', { timeout: 5000 });
    const tidyLook = await look();
    await page.click('nav button[data-screen=finances]');
    await page.waitForSelector('#finances.active .card', { timeout: 5000 });
    const finLook = await look();
    if (JSON.stringify(tidyLook) !== JSON.stringify(finLook)) throw new Error(`Tidy Up ${JSON.stringify(tidyLook)}, Finances ${JSON.stringify(finLook)}`);
  } },
  // Rows as Finances lists them (L5): what a job freed is on the right of its line in Recently done, where Finances puts an
  // amount, and its words no longer repeat it; a line from before, its size in its words, reads as it did.
  { name: 'Tidy Up: Recently done puts what a job freed on the right, as Finances does an amount', screen: 'tidy', mock: { tidy: { ...tidy, activity: [...tidy.activity,
    { at: tidyAt(0.5), kind: 'tv', text: 'Extra copies in the Trash', sub: '3 copies · 13 GB freed' }] } }, run: async (page) => {
    const row = page.locator('#tidy .tidydone .fx-rows li:has-text("Movies shrunk")');
    await row.waitFor({ timeout: 5000 });
    const got = await row.evaluate((li) => {
      const fig = li.querySelector('.tidygain'), sub = li.querySelector('.grow > .muted, .grow > .line'), when = li.querySelector('.tidywhen');
      if (!fig) return { none: true, text: li.textContent };
      const f = fig.getBoundingClientRect(), w = when.getBoundingClientRect(), r = li.getBoundingClientRect();
      return { fig: fig.textContent, also: fig.nextElementSibling?.textContent, sub: sub?.textContent, cls: fig.className, weight: getComputedStyle(fig).fontWeight, right: f.right <= w.left + 1 && f.left > r.left + r.width / 2 };
    });
    if (got.none) throw new Error(`no figure on the right: ${got.text}`);
    if (got.fig !== '412 GB' || got.also !== ' freed' || got.sub !== '12 files replaced') throw new Error(JSON.stringify(got));
    if (!got.cls.includes('fx-amount') || Number(got.weight) < 600 || !got.right) throw new Error(`not as Finances' amounts: ${JSON.stringify(got)}`);
    const old = page.locator('#tidy .tidydone .fx-rows li:has-text("Extra copies in the Trash")');
    if (await old.locator('.tidygain').count() || !(await old.textContent()).includes('3 copies · 13 GB freed')) throw new Error(`a line from before: ${await old.textContent()}`);
  } },
  // Merging audiobooks wins space back too: its row says how much, as films' Shrink does, and Needs your OK counts it.
  { name: 'Tidy Up: Merge says what it wins back, as Shrink does', screen: 'tidy', mock: { tidy: { ...tidy, libraries: tidy.libraries.map((l) => (l.kind === 'audiobooks' ? { ...l, found: true, last: { scan: tidyRun('scan', 1, { books: 4, files: 96, bytes: 20e9, saving: 7e9, whole: 170 }) } } : l)) } }, run: async (page) => {
    await page.waitForSelector('#tidy .tidyneeds li:has-text("Merge 4 audiobooks")', { timeout: 5000 });
    const said = await page.textContent('#tidy .tidyneeds .muted');
    if (!said.includes('387 GB to win back')) throw new Error(`Needs your OK: ${said} (380 GB from Shrink and 7 GB from Merge)`);
    await page.click('#tidy .seg button:text-is("Audiobooks")');
    const row = page.locator('#tidy .tidyneeds li:has-text("Merge 4 audiobooks")');
    if ((await row.locator('.tidygain').textContent({ timeout: 5000 })) !== '7 GB') throw new Error(`Merge: ${await row.textContent()}`);
  } },
  // A library not counted yet offers it on its own tab, and runs its own count.
  { name: 'Tidy Up: TV’s genres are counted from its tab', screen: 'tidy', run: async (page) => {
    await page.click('#tidy .seg button:text-is("TV")', { timeout: 5000 });
    await page.waitForSelector('#tidy .tidygenres:has-text("how your shows split")', { timeout: 3000 });
    await page.click('#tidy .tidygenres button:text-is("Count genres")');
    await page.waitForFunction(() => (window.__MOCK.tidyRuns || []).length === 1, null, { timeout: 5000 });
    const runs = await page.evaluate(() => window.__MOCK.tidyRuns);
    if (JSON.stringify(runs[0]) !== JSON.stringify(['tv', 'genre-counts', [], false])) throw new Error(JSON.stringify(runs));
  } },
  // The same film twice: a row with what the extra copies take, a sheet that names them, and the run only after the yes.
  { name: 'Tidy Up: a film in the library twice asks, then removes the extra copy', screen: 'tidy', mock: { tidy: { ...tidy, libraries: tidy.libraries.map((l) => (l.kind === 'movies' ? { ...l, last: { ...l.last, scan: { ...l.last.scan, result: { ...l.last.scan.result, duplicates: 2, duplicate_bytes: 13e9,
    duplicate_list: [{ keep: '/Volumes/Hobbies/movies/Heat (1995)/Heat (1995).mkv', extra: ['/Volumes/Hobbies/movies/Heat (1995)/Heat.1995.1080p.x264.mkv'], bytes: 9e9 }, { keep: '/Volumes/Hobbies/movies/Ronin (1998)/Ronin.1998.2160p.mkv', extra: ['/Volumes/Hobbies/movies/Ronin (1998)/Ronin (1998).mkv'], bytes: 4e9 }] } } } } : l)) } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
    const row = '#tidy .tidyneeds li:has-text("2 films are in the library twice")';
    if ((await page.textContent(`${row} .tidygain`, { timeout: 3000 })).trim() !== '13 GB') throw new Error('the row does not say what the copies take: ' + (await page.textContent(row)));
    await page.click(`${row} button:text-is("Remove extras…")`);
    await page.waitForSelector('#tidySheet:not([hidden]) h2:text-is("Put the extra copies in the Trash?")', { timeout: 5000 });
    await page.waitForSelector('#tidySheet li:text-is("Heat.1995.1080p.x264.mkv goes; Heat (1995).mkv stays")', { timeout: 3000 });
    if ((await page.evaluate(() => window.__MOCK.tidyRuns || [])).length) throw new Error('it ran before the yes');
    await page.click('#tidySheet button:text-is("Put them in the Trash")');
    await page.waitForFunction(() => (window.__MOCK.tidyRuns || []).length === 1, null, { timeout: 5000 });
    const runs = await page.evaluate(() => window.__MOCK.tidyRuns);
    if (JSON.stringify(runs[0]) !== JSON.stringify(['movies', 'dedupe', [], true])) throw new Error(JSON.stringify(runs));
  } },
  { name: 'Tidy Up: once the extra copies are gone, the row is too', screen: 'tidy', mock: { tidy: { ...tidy, libraries: tidy.libraries.map((l) => (l.kind === 'movies' ? { ...l, last: { ...l.last, scan: { ...l.last.scan, result: { ...l.last.scan.result, duplicates: 2, duplicate_bytes: 13e9 } }, dedupe: tidyRun('dedupe', 1, { removed: 2, freed: 13e9 }) } } : l)) } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Movies")', { timeout: 5000 });
    await page.waitForSelector('#tidy .tidyneeds li:has-text("Shrink 42 films")', { timeout: 3000 });
    if (await page.$('#tidy .tidyneeds li:has-text("in the library twice")')) throw new Error('the row stayed after the extras went');
  } },
  // Episodes missing from a season, said on TV's tab with where, and nothing to press.
  { name: 'Tidy Up: TV says which episodes are missing', screen: 'tidy', mock: { tidy: { ...tidy, libraries: tidy.libraries.map((l) => (l.kind === 'tv' ? { ...l, stage: 'scanned', last: { scan: tidyRun('scan', 2, { files: 800, bloated: 0, missing: 3, missing_list: [{ show: 'Frieren', season: null, episodes: [2] }, { show: 'The Office (US)', season: 2, episodes: [3, 4] }] }) } } : l)) } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("TV")', { timeout: 5000 });
    const row = '#tidy .tidyneeds li:has-text("3 episodes are missing from 2 shows")';
    const t = await page.textContent(row, { timeout: 3000 });
    if (!t.includes('Frieren: 2 · The Office (US) season 2: 3, 4')) throw new Error('the row says ' + t);
    if (await page.$(`${row} button`)) throw new Error('a button on a row with nothing to do');
  } },
  // What Jellyfin shows with no poster: named, and one button asks it to look again.
  { name: 'Tidy Up: shows with no poster in Jellyfin can fetch them', screen: 'tidy', mock: { tidy: { ...tidy, libraries: tidy.libraries.map((l) => (l.kind === 'tv' ? { ...l, stage: 'scanned', last: { scan: tidyRun('scan', 2, { files: 800, bloated: 0, posterless: 2, posterless_list: ['Frieren', 'Severance'] }) } } : l)) } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("TV")', { timeout: 5000 });
    const row = '#tidy .tidyneeds li:has-text("2 shows have no poster in Jellyfin")';
    if (!(await page.textContent(row, { timeout: 3000 })).includes('Frieren, Severance')) throw new Error('the row does not name them');
    await page.click(`${row} button:text-is("Fetch posters")`);
    await page.waitForFunction(() => (window.__MOCK.tidyRuns || []).length === 1, null, { timeout: 5000 });
    const runs = await page.evaluate(() => window.__MOCK.tidyRuns);
    if (JSON.stringify(runs[0]) !== JSON.stringify(['tv', 'posters', [], false])) throw new Error(JSON.stringify(runs));
  } },
  // Whatever a run put in the Trash, its line can put back: it asks, then runs the restore with that run.
  { name: 'Tidy Up: Undo on a sweep puts it back, after asking', screen: 'tidy', mock: { tidy: { ...tidy, activity: [...tidy.activity, { at: tidyAt(0.5), kind: 'scrubber', text: 'Leftovers swept', sub: '14 leftovers and 3 empty folders in the Trash', undo: 'scrubber-scan-1793' }] } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
    await page.click('#tidy .tidydone li:has-text("Leftovers swept") button:text-is("Undo")', { timeout: 3000 });
    await page.waitForSelector('#tidySheet:not([hidden]) h2:text-is("Put it all back?")', { timeout: 5000 });
    if ((await page.evaluate(() => window.__MOCK.tidyRuns || [])).length) throw new Error('it ran before the yes');
    await page.click('#tidySheet button:text-is("Put it back")');
    await page.waitForFunction(() => (window.__MOCK.tidyRuns || []).length === 1, null, { timeout: 5000 });
    const runs = await page.evaluate(() => window.__MOCK.tidyRuns);
    if (JSON.stringify(runs[0]) !== JSON.stringify(['trash', 'restore', ['scrubber-scan-1793'], true])) throw new Error(JSON.stringify(runs));
  } },
  // The drive: its name, what is free, and each library's size.
  { name: 'Tidy Up: the drive card names the drive and what each library takes', screen: 'tidy', run: async (page) => {
    await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
    const t = await page.textContent('#tidy .tidydrive', { timeout: 5000 });
    for (const w of ['On the Hobbies drive', '1.2 TB free', 'Of 4 TB', 'Movies1.4 TB', 'Music520 GB', 'Free1.2 TB']) if (!t.includes(w)) throw new Error(`the drive card has no “${w}”: ${t}`);
  } },
  // Undo on the swap asks first, then puts the old library back.
  { name: 'Tidy Up: Undo on the swap asks first, then puts the old library back', screen: 'tidy', run: async (page) => {
    await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
    await page.click('#tidy .tidydone li:has-text("Cleaned library swapped in") button:text-is("Undo")');
    await page.waitForSelector('#tidySheet:not([hidden]) h2:text-is("Put the old library back?")', { timeout: 5000 });
    if ((await page.evaluate(() => window.__MOCK.tidyRuns || [])).length) throw new Error('it ran before the yes');
    if ((await page.$$('#tidy .tidydone button:text-is("Undo")')).length !== 1) throw new Error('more than one thing offers Undo');
    await page.click('#tidySheet button:text-is("Put it back")');
    await page.waitForFunction(() => (window.__MOCK.tidyRuns || []).length === 1, null, { timeout: 5000 });
    const runs = await page.evaluate(() => window.__MOCK.tidyRuns);
    if (JSON.stringify(runs[0]) !== JSON.stringify(['music', 'undo', [], true])) throw new Error(JSON.stringify(runs));
  } },
  // Undo is found by what a line was (its action), not its words (tidy-loop.md's queue, item 4): a swap and a books apply
  // worded differently still offer theirs, and run the right Undo.
  ...[
    ['the swap', { kind: 'music', action: 'finalize', text: 'Your cleaned library is in' }, (t) => t, 'Put the old library back?', 'Put it back', ['music', 'undo', [], true]],
    ['a books apply', { kind: 'books', action: 'apply', text: 'Your books were tidied' },
      (t) => ({ ...t, libraries: t.libraries.map((l) => (l.kind === 'books' ? { ...l, last: { ...l.last, apply: tidyRun('apply', 0.5, { changed: 2, covers: 1 }) } } : l)) }),
      'Undo the last apply?', 'Undo', ['books', 'undo', [], true]],
  ].map(([what, line, lib, title, yes, runs]) => ({ name: `Tidy Up: Undo is offered on ${what} whose line is worded differently`, screen: 'tidy',
    mock: { tidy: lib({ ...tidy, activity: [{ at: tidyAt(0.5), sub: '', ...line }] }) }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
    await page.click(`#tidy .tidydone li:has-text("${line.text}") button:text-is("Undo")`, { timeout: 5000 });
    await page.waitForSelector(`#tidySheet:not([hidden]) h2:text-is("${title}")`, { timeout: 5000 });
    await page.click(`#tidySheet button:text-is("${yes}")`);
    await page.waitForFunction(() => (window.__MOCK.tidyRuns || []).length === 1, null, { timeout: 5000 });
    const ran = await page.evaluate(() => window.__MOCK.tidyRuns[0]);
    if (JSON.stringify(ran) !== JSON.stringify(runs)) throw new Error(`ran: ${JSON.stringify(ran)}`);
  } })),
  // A library whose folder is not there (the fixture's audiobooks) says so on its tab, and runs nothing until it is back.
  { name: 'Tidy Up: a library whose folder is gone says so, and runs nothing', screen: 'tidy', run: async (page) => {
    await page.click('#tidy .seg button:text-is("Audiobooks")', { timeout: 5000 });
    await page.waitForSelector('#tidy .notice:has-text("Audiobooks: its folder isn\'t there")', { timeout: 3000 });
    if (await page.$('#tidy .fx-board button:enabled')) throw new Error('something can run on a folder that is not there');
    await page.click('#tidy .seg button:text-is("Movies")');
    await page.waitForSelector('#tidy .tidyneeds', { timeout: 3000 });
    if (await page.$('#tidy .notice:has-text("folder isn\'t there")')) throw new Error('a library that is there says it is not');
    if (await page.isDisabled('#tidy .tidyneeds button:text-is("Scan again")')) throw new Error('Movies cannot scan');
  } },
  // The words: good news never reads as a warning, one download as one, a language by its name, and H.264 written one way.
  { name: 'Tidy Up: good news is not a warning, one download, languages by name', screen: 'tidy', mock: { tidy: { ...tidy, libraries: tidy.libraries.map((l) => (l.kind === 'movies' ? { ...l, counts: { ...l.counts, queued: 0 } } : l)) } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
    await page.waitForSelector('#tidy .tidydone li:has-text("Nothing went missing")', { timeout: 3000 });
    if (await page.$('#tidy .tidydone li:has-text("Nothing went missing") .warn')) throw new Error('Nothing went missing reads as a warning');
    await page.click('#tidy .seg button:text-is("Movies")');
    await page.waitForSelector('#tidy .tidyneeds li:has-text("Tdarr is shrinking 1 film")', { timeout: 3000 });
    if (!(await page.textContent('#tidy .tidyspace')).includes('Tdarr: HEVC, English only')) throw new Error('the language is not named: ' + (await page.textContent('#tidy .tidyspace')));
    if (!(await page.textContent('#tidy .tidyneeds')).includes('H.264')) throw new Error('the reason is not given');
    if (await page.$('#tidy li:has-text("H264")')) throw new Error('H264 is written without its dot');
  } },
  { name: 'Tidy Up: Swap in asks first, then runs with its yes, and the job shows its step and bar', screen: 'tidy', mock: { tidy: { ...tidy, libraries: tidy.libraries.map((l) => (l.kind === 'music' ? { ...l, stage: 'built' } : l)) },
    tidyEvents: { 'music finalize': [{ type: 'step', n: 1, total: 2, text: 'Swapping the folders' }, { type: 'progress', label: 'Folders', done: 3, total: 4, note: 'Navidrome' }, { type: 'ok', text: 'Swapped' }, { type: 'result', action: 'finalize', ok: true }] } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Music")', { timeout: 5000 });
    await page.click('#tidy button:text-is("Swap in…")');
    await page.waitForSelector('#tidySheet:not([hidden]) h2:text-is("Swap in your tidy library?")', { timeout: 5000 });
    if ((await page.evaluate(() => window.__MOCK.tidyRuns || [])).length) throw new Error('it ran before the yes');
    await page.click('#tidySheet button:text-is("Swap in")');
    await page.waitForSelector('#tidyJob h2:has-text("Swapping in your cleaned library: done")', { timeout: 5000 });
    const runs = await page.evaluate(() => window.__MOCK.tidyRuns);
    if (JSON.stringify(runs) !== JSON.stringify([['music', 'finalize', [], true]])) throw new Error('runs: ' + JSON.stringify(runs));
    await page.waitForSelector('#tidyJob li:has-text("Swapped")', { timeout: 5000 });
    if (!(await page.isHidden('#tidySheet'))) throw new Error('the sheet stayed open');
  } },
  { name: 'Tidy Up: Free the space takes a second click, and Escape asks nothing', screen: 'tidy', run: async (page) => {
    await page.click('#tidy .seg button:text-is("Music")', { timeout: 5000 });
    await page.click('#tidy button:text-is("Free it…")');
    await page.waitForSelector('#tidySheet:not([hidden]) li:has-text("The Navidrome backup from the swap")', { timeout: 5000 });
    await page.click('#tidySheet button:text-is("Free the space")');
    await page.waitForSelector('#tidySheet button:text-is("Click again: free the space")', { timeout: 5000 });
    if ((await page.evaluate(() => window.__MOCK.tidyRuns || [])).length) throw new Error('one click freed the space');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#tidySheet[hidden]', { state: 'attached', timeout: 5000 });
    await page.click('#tidy button:text-is("Free it…")');
    await page.click('#tidySheet button:text-is("Free the space")');
    await page.click('#tidySheet button:text-is("Click again: free the space")');
    await page.waitForFunction(() => (window.__MOCK.tidyRuns || []).length === 1, null, { timeout: 5000 });
    const runs = await page.evaluate(() => window.__MOCK.tidyRuns);
    if (runs[0][0] !== 'music' || runs[0][1] !== 'free-space') throw new Error(JSON.stringify(runs));
  } },
  { name: 'Tidy Up: a book left alone in the review goes to apply as --skip', screen: 'tidy', run: async (page) => {
    await page.click('#tidy .seg button:text-is("Books")', { timeout: 5000 });
    await page.waitForSelector('#tidyReview li:has-text("Project Hail Mary")', { timeout: 5000 });
    if (!(await page.isVisible('#tidyReview li:has-text("Untitled scan"):has-text("Looks misfiled")'))) throw new Error('the held book says why');
    await page.click('#tidy button:text-is("Apply to 2 books…")');
    await page.click('#tidySheet button:text-is("Cancel")');
    await page.click('#tidyReview li:has-text("dune") input[type=checkbox]');
    await page.click('#tidy button:text-is("Apply to 1 book…")');
    await page.click('#tidySheet button:text-is("Apply")');
    await page.waitForFunction(() => (window.__MOCK.tidyRuns || []).length === 1, null, { timeout: 5000 });
    const runs = await page.evaluate(() => window.__MOCK.tidyRuns);
    if (JSON.stringify(runs[0]) !== JSON.stringify(['books', 'apply', ['--skip', '12'], true])) throw new Error(JSON.stringify(runs));
  } },
  { name: 'Tidy Up: a running job shows its step, bar, and what it is on; Stop asks the engine to stop, and every button waits meanwhile', screen: 'tidy', mock: { tidyHold: true, tidy: { ...tidy, libraries: tidy.libraries.map((l) => (l.kind === 'audiobooks' ? { ...l, found: true } : l)) }, tidyEvents: { 'audiobooks scan': [{ type: 'step', n: 1, total: 2, text: 'Reading' }, { type: 'progress', label: 'Books', done: 5, total: 20, note: 'Dune' }] } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Audiobooks")', { timeout: 5000 });
    await page.click('#tidy .tidyneeds button:text-is("Scan")');
    await page.waitForSelector('#tidyJob .tidystep:text-is("Step 1 of 2 · Reading")', { timeout: 5000 });
    await page.waitForSelector('#tidyJob [role=progressbar][aria-valuenow="25"]', { timeout: 5000 });
    await page.waitForSelector('#tidyJob .tidynow:text-is("Now: Dune")', { timeout: 5000 });
    if (!(await page.isDisabled('#tidy .tidyneeds button:text-is("Scan")'))) throw new Error('a second job could start');
    await page.click('#tidy .seg button:text-is("Inbox")');
    // Every button that does something waits; a switch's choices (Genres' library) only pick what a card shows.
    if (await page.$('#tidy .fx-board button:enabled:not([role="radio"])')) throw new Error('a button on Overview could start a second job');
    await page.click('#tidyJob button:text-is("Stop")');
    await page.waitForFunction(() => window.__MOCK.tidyStopped === true, null, { timeout: 5000 });
    await page.waitForSelector('#tidyJob button:text-is("Close")', { timeout: 5000 });
  } },
  { name: 'Tidy Up: a job that fails says why', screen: 'tidy', mock: { tidyFails: { 'movies run': 'Tdarr isn\'t answering at http://localhost:8265.' }, tidyEvents: { 'movies run': [{ type: 'step', n: 1, total: 2, text: 'Handing 42 videos to Tdarr' }] } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Movies")', { timeout: 5000 });
    await page.click('#tidy .tidyneeds button:text-is("Shrink")');
    await page.waitForSelector('#tidyJob .bad:has-text("Tdarr isn\'t answering")', { timeout: 5000 });
    await page.click('#tidyJob button:text-is("Close")');
    if (await page.locator('#tidyJob').count()) throw new Error('the panel stayed');
  } },
  // A job that ends on its own without finishing isn't "stopped" (that's what Stop does): it says so and why, with Try again;
  // the keyboard's place stays in the panel the whole time, and its log isn't called Docker's.
  { name: 'Tidy Up: a job that didn’t finish says so, with Try again, and the keyboard stays with it', screen: 'tidy', mock: { tidyFails: { 'movies collect': 'Tdarr isn\'t answering at http://localhost:8265.' }, tidyEvents: { 'movies collect': [{ type: 'step', n: 1, total: 2, text: 'Asking Tdarr what it finished' }] } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Movies")', { timeout: 5000 });
    await page.focus('#tidy .tidyneeds button:text-is("Collect")');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#tidyJob h2:text-is("Collecting Tdarr\'s work: didn\'t finish")', { timeout: 5000 });
    await page.waitForSelector('#tidyJob .bad:has-text("Tdarr isn\'t answering")', { timeout: 5000 });
    const where = await page.evaluate(() => document.activeElement?.closest('#tidyJob') ? document.activeElement.textContent : document.activeElement?.tagName);
    if (where !== 'Try again') throw new Error(`the keyboard went to ${where}`);
    const after = await page.evaluate(() => getComputedStyle(document.querySelector('#tidyJob .jobdetails > summary'), '::after').content);
    if (/Docker/.test(after)) throw new Error(`its details say ${after}`);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => (window.__MOCK.tidyRuns || []).length === 2, null, { timeout: 5000 });
    const ran = await page.evaluate(() => window.__MOCK.tidyRuns[1]);
    if (JSON.stringify(ran) !== JSON.stringify(['movies', 'collect', [], false])) throw new Error(`Try again ran ${JSON.stringify(ran)}`);
    await page.waitForSelector('#tidyJob button:text-is("Close")', { timeout: 5000 });
    await page.click('#tidyJob button:text-is("Close")');
    if (await page.evaluate(() => document.activeElement === document.body)) throw new Error('Close left the keyboard at the top of the window');
  } },
  // One figure, one way: the screen counts sizes as the engines do (1000 to a KB, as the Finder counts a drive).
  { name: 'Tidy Up: a size reads the same on the first line, the drive, and Recently done', screen: 'tidy', run: async (page) => {
    const lead = await page.textContent('#tidy .header .lead', { timeout: 5000 });
    if (!lead.startsWith('412 GB won back so far')) throw new Error(`the first line: ${lead}`);
    const done = page.locator('#tidy .tidydone .fx-rows li:has-text("12 files replaced")');
    if ((await done.locator('.tidygain').textContent({ timeout: 5000 })) !== '412 GB') throw new Error(`Recently done: ${await done.textContent()}`);
    const drive = await page.textContent('#tidy .tidydrive');
    if (!drive.includes('Of 4 TB · 412 GB won back so far')) throw new Error(`the drive: ${drive}`);
    const gain = await page.textContent('#tidy .tidyneeds .tidygain');
    if (gain !== '380 GB') throw new Error(`what Shrink wins back: ${gain} (the scan's saving is 380e9)`);
  } },
  // Install counts as a thing to OK on Overview, so the first line counts it too.
  { name: 'Tidy Up: the first line counts what Overview lists, a tool to install included', screen: 'tidy', mock: { tidy: { ...tidy, checks: tidy.checks.map((c) => (c.id === 'ffmpeg' ? { ...c, ok: false, note: 'Not installed', fix: 'Install runs brew install ffmpeg for you', install: true } : c)) } }, run: async (page) => {
    await page.waitForSelector('#tidy .tidyneeds button:text-is("Install")', { timeout: 5000 });
    const card = (await page.textContent('#tidy .tidyneeds .muted')).split(' · ')[0];
    const lead = await page.textContent('#tidy .header .lead');
    if (card !== '7 things' || !lead.includes('7 things need your OK')) throw new Error(`card: ${card}; first line: ${lead}`);
  } },
  // A review that can't be read says so, with Try again; it never says every book looks tidy.
  { name: 'Tidy Up: a books review that can’t be read says why, with Try again', screen: 'tidy', mock: { tidyReviewFails: 1 }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Books")', { timeout: 5000 });
    await page.waitForSelector('#tidyReviewError [role=alert]:text-is("Couldn\'t read the last review: Calibre\'s database is locked")', { timeout: 5000 });
    if (await page.locator('#tidy :text("Every book already looks tidy"), #tidy :text("Your books are tidy")').count()) throw new Error('it says the books are tidy');
    const lead = await page.textContent('#tidy .header .lead');
    if (!lead.includes('6 things need your OK')) throw new Error(`the count changed: ${lead}`);
    await page.click('#tidyReviewError button:text-is("Try again")');
    await page.waitForSelector('#tidyReview :text-is("Project Hail Mary (Unabridged)")', { timeout: 5000 });
  } },
  // Look… on the Books tab used to open the tab it was on: it shows the review and takes the keyboard there.
  { name: 'Tidy Up: Look… on Books shows the review and moves the keyboard to it', screen: 'tidy', run: async (page) => {
    await page.click('#tidy .seg button:text-is("Books")', { timeout: 5000 });
    await page.waitForSelector('#tidyReview', { timeout: 5000 });
    await page.focus('#tidy .tidyneeds button:text-is("Look…")');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !!document.activeElement?.closest('#tidyReview'), null, { timeout: 5000 });
  } },
  // A record that can't be read says nothing changed, with Try again.
  { name: 'Tidy Up: a record that can’t be read has Try again', screen: 'tidy', mock: { tidyUpFails: 1 }, run: async (page) => {
    await page.waitForSelector('#tidyError strong:text-is("Tidy Up couldn\'t read its record")', { timeout: 5000 });
    await page.click('#tidyError button:text-is("Try again")');
    await page.waitForSelector('#tidy .tidyneeds', { timeout: 5000 });
    if (await page.locator('#tidyError').count()) throw new Error('the error stayed');
  } },
  // What the screen says first: one main button, on the first thing to do, never on a step that throws things away.
  { name: 'Tidy Up: Overview has one main button, and never on a step that throws things away', screen: 'tidy', run: async (page) => {
    await page.waitForSelector('#tidy .tidyneeds button:text-is("Free it…")', { timeout: 5000 });
    const main = await page.$$eval('#tidy .tidyneeds button.primary', (b) => b.map((x) => x.textContent));
    if (main.length !== 1 || main[0] !== 'Add lyrics') throw new Error(`main buttons: ${JSON.stringify(main)}`);
  } },
  // Music's space is its header's (tidy-loop.md's look, L3): no card that is one figure the header already shows, and
  // Genres takes the whole row rather than leave half of it empty. Tdarr's row says what it holds, not that it has
  // finished it.
  { name: 'Tidy Up: Music’s space is in its header, Genres takes the row, and Tdarr’s row says what it is shrinking', screen: 'tidy', run: async (page) => {
    await page.click('#tidy .seg button:text-is("Music")', { timeout: 5000 });
    await page.waitForSelector('#tidy .tidyhero .tidyfacts div:has(dt:text-is("On the drive")) dd:text-is("520 GB")', { timeout: 5000 });
    await page.waitForSelector('#tidy .tidygenres', { timeout: 5000 });
    if (await page.$('#tidy .tidyspace')) throw new Error('a Space card repeats the header\'s figure');
    const widths = await page.$eval('#tidy .tidygenres', (g) => [g.getBoundingClientRect().width, g.parentElement.getBoundingClientRect().width]);
    if (widths[0] < widths[1] - 2) throw new Error(`Genres leaves part of its row empty: ${widths}`);
    await page.click('#tidy .seg button:text-is("Movies")');
    await page.waitForSelector('#tidy .tidyneeds strong:text-is("Tdarr is shrinking 4 films")', { timeout: 5000 });
    // The Space card's notes sit at the card's own gap.
    const gaps = await page.$$eval('#tidy .tidyspace > p.fx-sub', (ps) => ps.map((p) => parseFloat(getComputedStyle(p).marginTop) + parseFloat(getComputedStyle(p).marginBottom)));
    if (gaps.some((g) => g > 0)) throw new Error(`margins on the Space card's notes: ${gaps}`);
  } },
  // Nov 8, the owner: Books said "isn't a Calibre library": a folder of books with no metadata.db. Books offers Make a
  // Calibre library (and no review, which can't read them yet), asks first, then runs it with its yes.
  { name: 'Tidy Up: books with no Calibre library offer to make one, after asking', screen: 'tidy', mock: { tidy: { ...tidy, libraries: tidy.libraries.map((l) => (l.kind === 'books' ? { ...l, last: {}, noCalibre: true, loose: 301 } : l)) } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Books")', { timeout: 5000 });
    const row = '#tidy .tidyneeds li:has-text("Make a Calibre library from your 301 books")';
    await page.waitForSelector(row, { timeout: 5000 });
    if (await page.$('#tidy .tidyneeds li:has-text("Look over your books")')) throw new Error('a review is offered with no library to read');
    // Nor the review's list or a genre count, which read Calibre's database.
    if (await page.$('#tidyReview') || await page.$('#tidy .fx-board button:text-is("Count genres")')) throw new Error('the review or genres shown with no library');
    await page.click(`${row} button:text-is("Make it…")`);
    await page.waitForSelector('#tidySheet:not([hidden]) h2:text-is("Make a Calibre library from 301 books?")', { timeout: 5000 });
    await page.waitForSelector('#tidySheet:has-text("Books (before Calibre)")', { timeout: 2000 });
    if ((await page.evaluate(() => window.__MOCK.tidyRuns || [])).length) throw new Error('it ran before the yes');
    await page.click('#tidySheet button:text-is("Make it")');
    await page.waitForFunction(() => (window.__MOCK.tidyRuns || []).length === 1, null, { timeout: 5000 });
    const runs = await page.evaluate(() => window.__MOCK.tidyRuns);
    if (JSON.stringify(runs[0]) !== JSON.stringify(['books', 'build', [], true])) throw new Error(JSON.stringify(runs));
  } },
  // Audiobooks that are one file each already: said with how many, not a bare nought.
  { name: 'Tidy Up: audiobooks that are one file each say there is nothing to merge', screen: 'tidy', mock: { tidy: { ...tidy, libraries: tidy.libraries.map((l) => (l.kind === 'audiobooks' ? { ...l, found: true, last: { scan: tidyRun('scan', 1, { books: 0, files: 0, bytes: 0, whole: 177 }) } } : l)) } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Audiobooks")', { timeout: 5000 });
    await page.waitForSelector('#tidy .tidyneeds strong:text-is("All 177 audiobooks are one file each")', { timeout: 5000 });
    if (await page.$('#tidy .tidyneeds button:text-is("Merge")')) throw new Error('Merge offered with nothing to merge');
  } },
  // Tdarr paused on battery: the shrinking row says it isn't answering, in amber, and Recent has no "collect stopped" lines.
  { name: 'Tidy Up: Tdarr not answering is said on its row', screen: 'tidy', mock: { tidy: { ...tidy, libraries: tidy.libraries.map((l) => (l.kind === 'movies' ? { ...l, last: { ...l.last, collect: { ...tidyRun('collect', 0.1, {}, false), why: "Tdarr isn't answering at http://localhost:8265: start it from Status (Tdarr), then try again. What's with it stays in its queue" } } } : l)) } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Movies")', { timeout: 5000 });
    const row = '#tidy .tidyneeds li:has(strong:text-is("Tdarr is shrinking 4 films"))';
    await page.waitForSelector(`${row}:has-text("Tdarr isn't answering, so nothing is shrinking")`, { timeout: 5000 });
  } },
  // Nov 8, the owner: "drop a bunch of files … and this app will be able to pick that up … once a day maybe, or maybe even
  // manually". The Inbox tab opens on Drop anything here: the folders watched (one gone with its drive said), Add… from the
  // folder picker, Remove while another is left, when it tidies (kept at once), and Tidy up now.
  { name: 'Tidy Up: the Inbox card keeps its folders and when, and Tidy up now files what is waiting', screen: 'tidy', mock: { pickFolder: '/Volumes/Hobbies/Inbox', tidy: { ...tidy, inbox: { ...tidy.inbox, folders: ['/Users/you/Downloads'], gone: [] } } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
    const card = '#tidy .tidyinbox';
    await page.waitForSelector(`${card} h2:text-is("Drop anything here")`, { timeout: 5000 });
    await page.waitForSelector(`${card} li:has(strong:text-is("Downloads")):has-text("Watched: tidied as things arrive")`, { timeout: 2000 });
    if (await page.$(`${card} li:has(strong:text-is("Downloads")) button:text-is("Remove")`)) throw new Error('the only folder can be removed');
    await page.click(`${card} button:text-is("Add…")`);
    await page.waitForSelector(`${card} li:has(strong:text-is("Inbox")):has-text("/Volumes/Hobbies/Inbox")`, { timeout: 3000 });
    await page.click(`${card} .seg button:text-is("Once a day, 3 AM")`);
    await page.waitForSelector(`${card} .seg button[aria-checked="true"]:text-is("Once a day, 3 AM")`, { timeout: 3000 });
    await page.click(`${card} li:has(strong:text-is("Downloads")) button:text-is("Remove")`);
    await page.waitForFunction(() => (window.__MOCK.tidyInbox || []).length === 3, null, { timeout: 3000 });
    const kept = await page.evaluate(() => window.__MOCK.tidyInbox);
    const want = [{ folders: ['/Users/you/Downloads', '/Volumes/Hobbies/Inbox'], when: 'arrive' }, { folders: ['/Users/you/Downloads', '/Volumes/Hobbies/Inbox'], when: 'daily' }, { folders: ['/Volumes/Hobbies/Inbox'], when: 'daily' }];
    if (JSON.stringify(kept) !== JSON.stringify(want)) throw new Error(JSON.stringify(kept));
    await page.click(`${card} button:text-is("Tidy up now")`);
    await page.waitForFunction(() => (window.__MOCK.tidyRuns || []).length === 1, null, { timeout: 5000 });
    const runs = await page.evaluate(() => window.__MOCK.tidyRuns);
    if (JSON.stringify(runs[0].slice(0, 3)) !== JSON.stringify(['inbox', 'scan', ['--apply']])) throw new Error(JSON.stringify(runs));
  } },
  { name: 'Tidy Up: a watched folder on a drive that is unplugged says so', screen: 'tidy', mock: { tidy: { ...tidy, inbox: { ...tidy.inbox, gone: ['/Volumes/Hobbies/downloads'] } } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
    await page.waitForSelector('#tidy .tidyinbox li:has(strong:text-is("downloads")) .warn:has-text("Not there now: plug in its drive")', { timeout: 5000 });
  } },
  // What I did today: each download the inbox filed, newest first, in plain words; Undo puts one back (one already put back
  // says so, with no Undo); with nothing filed today, it says how to start.
  { name: 'Tidy Up: What I did today says what each download became, and Undo puts one back', screen: 'tidy', mock: { tidy: { ...tidy, today: [
    { id: 'c3', kind: 'tv', title: 'Show · 10 episodes', where: 'TV › Show › Season 03', did: ['renamed and filed'], from: '/Users/you/Downloads/Show.S03.WEB', undo: true, at: tidyAt(0.5) },
    { id: 'b2', kind: 'music', title: 'Album · Artist', where: 'Music › Artist › Album', did: ['12 songs, tags cleaned', 'lyrics added where found'], from: '/Users/you/Downloads/Album', undo: true, at: tidyAt(1), undone: true },
    { id: 'a1', kind: 'movies', title: 'Heat (1995)', where: 'Movies › Heat (1995)', did: ['too big, so Tdarr is shrinking it first'], from: '/Users/you/Downloads/Heat.1995.mkv', undo: true, at: tidyAt(2) },
  ] } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
    const card = '#tidy .tidytoday';
    await page.waitForSelector(`${card} h2:text-is("What I did today")`, { timeout: 5000 });
    const titles = await page.$$eval(`${card} li strong`, (e) => e.map((x) => x.textContent));
    if (JSON.stringify(titles) !== JSON.stringify(['Show · 10 episodes', 'Album · Artist', 'Heat (1995)'])) throw new Error(JSON.stringify(titles));
    await page.waitForSelector(`${card} li:has(strong:text-is("Heat (1995)")):has-text("Movies › Heat (1995) · too big, so Tdarr is shrinking it first")`, { timeout: 2000 });
    const album = `${card} li:has(strong:text-is("Album · Artist"))`;
    await page.waitForSelector(`${album}:has-text("Put back where it came from")`, { timeout: 2000 });
    if (await page.$(`${album} button:text-is("Undo")`)) throw new Error('Undo on one put back already');
    await page.click(`${card} li:has(strong:text-is("Heat (1995)")) button:text-is("Undo")`);
    await page.waitForFunction(() => (window.__MOCK.tidyRuns || []).length === 1, null, { timeout: 5000 });
    const runs = await page.evaluate(() => window.__MOCK.tidyRuns);
    if (JSON.stringify(runs[0].slice(0, 3)) !== JSON.stringify(['inbox', 'undo', ['a1']])) throw new Error(JSON.stringify(runs));
  } },
  { name: 'Tidy Up: What I did today with nothing yet says how to start', screen: 'tidy', mock: { tidy: { ...tidy, today: [] } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
    await page.waitForSelector('#tidy .tidytoday:has-text("Nothing yet today. Drop something in a watched folder, or press Tidy up now.")', { timeout: 5000 });
  } },
  // Nov 8, the owner's mockup: Needs a look, between Drop anything here and What I did today: what Tidy Up couldn't place,
  // with why. A video can be named a film or an episode in a sheet (File it waits for what it needs; a number box takes
  // digits only), anything can be shown in the file manager or left be; with nothing waiting, the card isn't there.
  { name: 'Tidy Up: Needs a look names a film or an episode, shows one, and leaves one be', screen: 'tidy', mock: { tidy: { ...tidy, needs: [
    { path: '/Users/you/Downloads/IMG_2041.mov', name: 'IMG_2041.mov', kind: 'movies', why: "Couldn't tell which film it is from its name." },
    { path: '/Users/you/Downloads/stuff', name: 'stuff', kind: 'tv', why: 'You put it back. Say what it is, or leave it.' },
    { path: '/Users/you/Downloads/track01.mp3', name: 'track01.mp3', kind: 'music', why: "Couldn't file it." },
  ] } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
    const card = '#tidy .tidyneedslook';
    await page.waitForSelector(`${card} h2:text-is("Needs a look")`, { timeout: 5000 });
    const order = await page.$$eval('#tidy .tidybody .fx-board:first-child > .fx-widget h2', (e) => e.map((x) => x.firstChild.textContent.trim()));
    if (JSON.stringify(order) !== JSON.stringify(['Drop anything here', 'Needs a look', 'What I did today'])) throw new Error(JSON.stringify(order));
    await page.waitForSelector(`${card} li:has(strong:text-is("IMG_2041.mov")) .warn:has-text("Couldn't tell which film it is from its name.")`, { timeout: 2000 });
    const song = `${card} li:has(strong:text-is("track01.mp3"))`;
    if (await page.$(`${song} button:text-is("It's a film…")`)) throw new Error('a song offered as a film');
    // Slow frames, as a busy CI runner's are at times: a question cleared a frame after it's drawn wiped what was typed
    // in that frame, and File it stayed greyed out (Nov 9: this check failed at random on main). Each sheet below is
    // typed in at once, so that comes back every time, not one run in several.
    await page.evaluate(() => { const r = window.requestAnimationFrame; window.requestAnimationFrame = (f) => setTimeout(() => r(f), 200); });
    await page.click(`${card} li:has(strong:text-is("IMG_2041.mov")) button:text-is("It's a film…")`);
    const sheet = '#tidySheet:not([hidden])';
    await page.waitForSelector(`${sheet} h2:text-is("Which film is IMG_2041.mov?")`, { timeout: 3000 });
    if (!await page.$(`${sheet} button:text-is("File it")[disabled]`)) throw new Error('File it before a title');
    await page.fill(`${sheet} label:has-text("Film") input`, 'The Big Lebowski');
    // The first box is typed in at once (above); the sheet then puts the cursor there itself, a slow frame later
    // (parts/Sheet.tsx), which took a second box's typing with it (Nov 9: Season's "2" went to Show, and File it stayed
    // grey). The second box waits for that: what's typed in the first is still checked when it's filed.
    const settled = () => page.waitForFunction(() => document.activeElement === document.querySelector('#tidySheet .tidyfields input'), null, { timeout: 3000 });
    await settled();
    await page.fill(`${sheet} label:has-text("Year") input`, '19x8');
    if (!await page.$(`${sheet} button:text-is("File it")[disabled]`)) throw new Error('a year that is not a number');
    await page.fill(`${sheet} label:has-text("Year") input`, '1998');
    await page.click(`${sheet} button:text-is("File it")`);
    await page.waitForFunction(() => (window.__MOCK.tidyRuns || []).length === 1, null, { timeout: 5000 });
    let runs = await page.evaluate(() => window.__MOCK.tidyRuns);
    if (JSON.stringify(runs[0].slice(0, 3)) !== JSON.stringify(['inbox', 'name', ['/Users/you/Downloads/IMG_2041.mov', 'movie', 'The Big Lebowski', '1998']])) throw new Error(JSON.stringify(runs));
    await page.waitForSelector('#tidySheet', { state: 'hidden', timeout: 3000 });
    await page.waitForSelector(`${card} button:text-is("It's an episode…"):not([disabled])`, { timeout: 8000 });
    await page.click(`${card} li:has(strong:text-is("stuff")) button:text-is("It's an episode…")`);
    await page.waitForSelector(`${sheet} h2:text-is("Which show is stuff?")`, { timeout: 3000 });
    await page.fill(`${sheet} label:has-text("Show") input`, ' Severance ');
    await settled();
    await page.fill(`${sheet} label:has-text("Season") input`, '2');
    await page.click(`${sheet} button:text-is("File it")`);
    await page.waitForFunction(() => (window.__MOCK.tidyRuns || []).length === 2, null, { timeout: 5000 });
    runs = await page.evaluate(() => window.__MOCK.tidyRuns);
    if (JSON.stringify(runs[1].slice(0, 3)) !== JSON.stringify(['inbox', 'name', ['/Users/you/Downloads/stuff', 'episode', 'Severance', '2']])) throw new Error(JSON.stringify(runs));
    await page.click(`${song} button:has-text("Show ")`);
    await page.waitForFunction(() => window.__MOCK.revealed === '/Users/you/Downloads/track01.mp3', null, { timeout: 3000 });
    await page.waitForSelector(`${song} button:text-is("Leave it"):not([disabled])`, { timeout: 8000 });
    await page.click(`${song} button:text-is("Leave it")`);
    await page.waitForFunction(() => (window.__MOCK.tidyRuns || []).length === 3, null, { timeout: 5000 });
    runs = await page.evaluate(() => window.__MOCK.tidyRuns);
    if (JSON.stringify(runs[2].slice(0, 3)) !== JSON.stringify(['inbox', 'leave', ['/Users/you/Downloads/track01.mp3']])) throw new Error(JSON.stringify(runs));
  } },
  // Nov 8, the owner's Inbox plan, item 5: songs with no names. Name these songs asks the album (and the artist, if
  // known), looks it up on MusicBrainz, and files the songs as the one picked: File them waits for a pick, typing again
  // asks to look again, and finding nothing, or not reaching MusicBrainz, says so in the sheet.
  { name: 'Tidy Up: Name these songs looks the album up, and files the songs as the one picked', screen: 'tidy', mock: { tidy: { ...tidy, needs: [
    { path: '/Users/you/Downloads/new stuff', name: 'new stuff', kind: 'music', why: "These songs don't say which artist or album they are." },
    { path: '/Users/you/Downloads/IMG_2041.mov', name: 'IMG_2041.mov', kind: 'movies', why: "Couldn't tell which film it is from its name." },
  ] }, tidyAlbums: [
    { id: '0e7f9bd8-ae28-3d16-8c3e-5b0c0c8e5a3d', title: 'Rumours', artist: 'Fleetwood Mac', year: '1977', songs: 11, format: 'Vinyl', country: 'US' },
    { id: '2e7f9bd8-ae28-3d16-8c3e-5b0c0c8e5a3d', title: 'Rumours', artist: 'Fleetwood Mac', year: '2013', songs: 38, format: '3×CD' },
    { id: '3e7f9bd8-ae28-3d16-8c3e-5b0c0c8e5a3d', title: 'Rumours Live', artist: 'Lindsey Buckingham & Christine McVie', songs: 18 },
  ] }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
    const card = '#tidy .tidyneedslook';
    const songs = `${card} li:has(strong:text-is("new stuff"))`;
    await page.waitForSelector(`${songs} .warn:has-text("These songs don't say which artist or album they are.")`, { timeout: 5000 });
    if (await page.$(`${card} li:has(strong:text-is("IMG_2041.mov")) button:text-is("Name these songs…")`)) throw new Error('a film offered as songs');
    if (await page.$(`${songs} button:text-is("It's a film…")`)) throw new Error('songs offered as a film');
    await page.click(`${songs} button:text-is("Name these songs…")`);
    const sheet = '#tidySheet:not([hidden])';
    await page.waitForSelector(`${sheet} h2:text-is("Which album is new stuff?")`, { timeout: 3000 });
    // The sheet puts the cursor in its first box a frame after it shows (parts/Sheet.tsx). Typed into Album before that,
    // a slow runner's late frame sent the word to Artist (Nov 9, CI dark: "Rumors" in Artist, Album empty): wait for it.
    const settled = () => page.waitForFunction(() => document.activeElement === document.querySelector('#tidySheet .tidyfields input'), null, { timeout: 3000 });
    await settled();
    if (!await page.$(`${sheet} button:text-is("Look it up")[disabled]`)) throw new Error('Look it up before an album');
    if (!await page.$(`${sheet} button:text-is("File them")[disabled]`)) throw new Error('File them before a pick');
    await page.fill(`${sheet} label:has-text("Artist") input`, 'Fleetwood Mac');
    await page.fill(`${sheet} label:has-text("Album") input`, 'Rumours');
    await page.click(`${sheet} button:text-is("Look it up")`);
    const found = `${sheet} [role="radiogroup"][aria-label="Albums found"]`;
    await page.waitForSelector(`${found} label:has(strong:text-is("Rumours")):has-text("Fleetwood Mac · 1977 · 11 songs · Vinyl, US")`, { timeout: 3000 });
    if ((await page.$$(`${found} input[type="radio"]`)).length !== 3) throw new Error('not every album found is listed');
    if (!await page.$(`${sheet} button:text-is("File them")[disabled]`)) throw new Error('File them before one of three is picked');
    await page.fill(`${sheet} label:has-text("Album") input`, 'Rumours ');
    await page.waitForSelector(found, { state: 'detached', timeout: 2000 });
    await page.click(`${sheet} button:text-is("Look it up")`);
    await page.click(`${found} label:has-text("2013")`);
    if (process.env.SMOKE_SHOTS) {
      mkdirSync(process.env.SMOKE_SHOTS, { recursive: true });
      await page.locator('#tidySheet').screenshot({ path: join(process.env.SMOKE_SHOTS, `name-these-songs-${await page.evaluate(() => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'))}.png`) });
    }
    await page.click(`${sheet} button:text-is("File them"):not([disabled])`);
    await page.waitForFunction(() => (window.__MOCK.tidyRuns || []).length === 1, null, { timeout: 5000 });
    const runs = await page.evaluate(() => window.__MOCK.tidyRuns);
    if (JSON.stringify(runs[0].slice(0, 3)) !== JSON.stringify(['inbox', 'name', ['/Users/you/Downloads/new stuff', 'album', '2e7f9bd8-ae28-3d16-8c3e-5b0c0c8e5a3d']])) throw new Error(JSON.stringify(runs));
    await page.waitForSelector('#tidySheet', { state: 'hidden', timeout: 3000 });
    // Nothing by that name, then MusicBrainz out of reach: each said in the sheet, and nothing filed.
    await page.evaluate(() => { window.__MOCK.tidyAlbums = []; });
    await page.waitForSelector(`${songs} button:text-is("Name these songs…"):not([disabled])`, { timeout: 8000 });
    await page.click(`${songs} button:text-is("Name these songs…")`);
    await settled();
    await page.fill(`${sheet} label:has-text("Album") input`, 'Rumors');
    await page.press(`${sheet} label:has-text("Album") input`, 'Enter');
    await page.waitForSelector(`${sheet} p:text-is("MusicBrainz has no album by that name. Check the spelling, or leave the artist out.")`, { timeout: 3000 });
    await page.evaluate(() => { window.__MOCK.tidyAlbumsFail = "couldn't reach MusicBrainz: is this computer online?"; });
    await page.click(`${sheet} button:text-is("Look again")`);
    await page.waitForSelector(`${sheet} .warn:text-is("couldn't reach MusicBrainz: is this computer online?")`, { timeout: 3000 });
    if (!await page.$(`${sheet} button:text-is("File them")[disabled]`)) throw new Error('File them with nothing picked');
    await page.click(`${sheet} button:text-is("Cancel")`);
    if ((await page.evaluate(() => window.__MOCK.tidyRuns)).length !== 1) throw new Error('filed with nothing picked');
  } },
  // Nov 8, the owner's Inbox plan, item 6: It's a film… and It's an episode… look what's typed up (Radarr, Sonarr, or
  // Jellyfin), so a person picks The Big Lebowski (1998) rather than typing the year. Picking is a help, not a must:
  // with nothing here to ask, the sheet says so and files what's typed. Typing the season keeps the show picked.
  { name: "Tidy Up: It's a film… and It's an episode… look the name up, and file the one picked", screen: 'tidy', mock: { tidy: { ...tidy, needs: [
    { path: '/Users/you/Downloads/IMG_2041.mov', name: 'IMG_2041.mov', kind: 'movies', why: "Couldn't tell which film it is from its name." },
    { path: '/Users/you/Downloads/stuff', name: 'stuff', kind: 'tv', why: "Couldn't tell which show and episode it is from its name." },
  ] }, tidyTitles: {
    movie: [{ name: 'The Big Lebowski', year: 1998, from: 'Radarr' }, { name: 'The Making of The Big Lebowski', year: 1998, from: 'Radarr' }],
    show: [{ name: 'Severance', year: 2022, from: 'Sonarr' }],
  } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
    const card = '#tidy .tidyneedslook';
    const sheet = '#tidySheet:not([hidden])';
    // The sheet puts the cursor in its first box a frame after it shows (parts/Sheet.tsx): type once it has.
    const settled = () => page.waitForFunction(() => document.activeElement === document.querySelector('#tidySheet .tidyfields input'), null, { timeout: 3000 });
    const ran = (n) => page.waitForFunction((n) => (window.__MOCK.tidyRuns || []).length === n, n, { timeout: 5000 }).then(() => page.evaluate(() => window.__MOCK.tidyRuns.at(-1).slice(0, 3)));
    const film = `${card} li:has(strong:text-is("IMG_2041.mov")) button:text-is("It's a film…")`;
    await page.click(film);
    await page.waitForSelector(`${sheet} h2:text-is("Which film is IMG_2041.mov?")`, { timeout: 3000 });
    await settled();
    if (!await page.$(`${sheet} button:text-is("Look it up")[disabled]`)) throw new Error('Look it up before a name');
    await page.fill(`${sheet} label:has-text("Film") input`, 'lebowski');
    await page.click(`${sheet} button:text-is("Look it up")`);
    const found = `${sheet} [role="radiogroup"][aria-label="Films found"]`;
    await page.waitForSelector(`${found} label:has(strong:text-is("The Big Lebowski")):has-text("1998 · from Radarr")`, { timeout: 3000 });
    if (await page.$(`${sheet} button:text-is("File it")[disabled]`)) throw new Error('File it waits for a pick it does not need');
    await page.click(`${found} label:has(strong:text-is("The Big Lebowski"))`);
    await page.click(`${sheet} button:text-is("File it")`);
    let run = await ran(1);
    if (JSON.stringify(run) !== JSON.stringify(['inbox', 'name', ['/Users/you/Downloads/IMG_2041.mov', 'movie', 'The Big Lebowski', '1998']])) throw new Error(JSON.stringify(run));
    await page.waitForSelector('#tidySheet', { state: 'hidden', timeout: 3000 });
    // A show: one found is picked already, and typing the season keeps it.
    await page.waitForSelector(`${card} button:text-is("It's an episode…"):not([disabled])`, { timeout: 8000 });
    await page.click(`${card} li:has(strong:text-is("stuff")) button:text-is("It's an episode…")`);
    await page.waitForSelector(`${sheet} h2:text-is("Which show is stuff?")`, { timeout: 3000 });
    await settled();
    await page.fill(`${sheet} label:has-text("Show") input`, 'severance');
    await page.click(`${sheet} button:text-is("Look it up")`);
    const shows = `${sheet} [role="radiogroup"][aria-label="Shows found"]`;
    await page.waitForSelector(`${shows} label.on:has(strong:text-is("Severance")):has-text("2022 · from Sonarr")`, { timeout: 3000 });
    await page.fill(`${sheet} label:has-text("Season") input`, '2');
    if (!await page.$(`${shows} label.on:has(strong:text-is("Severance"))`)) throw new Error('typing the season lost the show picked');
    await page.click(`${sheet} button:text-is("File it")`);
    run = await ran(2);
    if (JSON.stringify(run) !== JSON.stringify(['inbox', 'name', ['/Users/you/Downloads/stuff', 'episode', 'Severance', '2']])) throw new Error(JSON.stringify(run));
    await page.waitForSelector('#tidySheet', { state: 'hidden', timeout: 3000 });
    // Nothing here to ask: said in the sheet, and what's typed is filed.
    await page.evaluate(() => { window.__MOCK.tidyTitlesFail = 'nothing here can look titles up: Radarr (films), Sonarr (shows), or Jellyfin with its API key in Settings can. Type the name instead'; });
    await page.waitForSelector(`${film}:not([disabled])`, { timeout: 8000 });
    await page.click(film);
    await settled();
    await page.fill(`${sheet} label:has-text("Film") input`, 'Heat');
    await page.press(`${sheet} label:has-text("Film") input`, 'Enter');
    await page.waitForSelector(`${sheet} .warn:has-text("nothing here can look titles up")`, { timeout: 3000 });
    await page.fill(`${sheet} label:has-text("Year") input`, '1995');
    await page.click(`${sheet} button:text-is("File it")`);
    run = await ran(3);
    if (JSON.stringify(run) !== JSON.stringify(['inbox', 'name', ['/Users/you/Downloads/IMG_2041.mov', 'movie', 'Heat', '1995']])) throw new Error(JSON.stringify(run));
  } },
  { name: 'Tidy Up: with nothing to look at, Needs a look is not there', screen: 'tidy', mock: { tidy: { ...tidy, needs: [] } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
    await page.waitForSelector('#tidy .tidytoday', { timeout: 5000 });
    if (await page.$('#tidy .tidyneedslook')) throw new Error('an empty Needs a look');
  } },
  // Nov 9, the owner: piece 4, Where should your libraries live?, "completely okay": the first time it comes first;
  // after, the Inbox's Change where your libraries live… opens it. Each drive with its space and what's on it (the
  // backup drive can't be picked), each library's folder on the one picked, Another folder…, and Use it: kept, then
  // homelab fix lists the apps to restart and asks.
  ...(() => {
    const drives = [
      { root: '/Users/you/Media', name: '', internal: true, free: 128e9, total: 494e9, found: [] },
      { root: '/Volumes/Backup', name: 'Backup', internal: false, free: 1.2e12, total: 2e12, found: [], backups: true },
      { root: '/Volumes/Hobbies', name: 'Hobbies', internal: false, free: 1.2e12, total: 4e12, found: ['music', 'books', 'movies', 'tv'], current: true },
      { root: '/Volumes/New', name: 'New', internal: false, free: 3.9e12, total: 4e12, found: [] },
    ];
    const tidyPlaces = { '/Volumes/Hobbies': { root: '/Volumes/Hobbies', libraries: [
      { kind: 'music', folder: '/Volumes/Hobbies/music', found: true, items: 1204 }, { kind: 'books', folder: '/Volumes/Hobbies/Books', found: true, items: 288, calibre: true },
      { kind: 'movies', folder: '/Volumes/Hobbies/movies', found: true, items: 352 }, { kind: 'tv', folder: '/Volumes/Hobbies/tv', found: true, items: 61 },
      { kind: 'audiobooks', folder: '/Volumes/Hobbies/audiobooks', found: false, items: 0 }] } };
    const none = { ...tidy, libraries: tidy.libraries.map((l) => ({ ...l, found: false })), checks: tidy.checks.map((c) => (c.id === 'drive' ? { ...c, ok: true } : c)) };
    return [
      { name: 'Tidy Up: Change where your libraries live picks a drive, and restarts the apps after asking', screen: 'tidy', mock: { tidyDrives: drives, tidyPlaces }, run: async (page) => {
        await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
        await page.waitForSelector('#tidy .tidyinbox:has-text("Your libraries live in /Volumes/Hobbies.")', { timeout: 5000 });
        await page.click('#tidy .tidyinbox button:text-is("Change where your libraries live…")');
        const card = '#tidy .tidyplaces';
        await page.waitForSelector(`${card} .tidydrive[aria-checked="true"]:has(strong:text-is("Hobbies")):has-text("Your libraries are here now")`, { timeout: 5000 });
        await page.waitForSelector(`${card} li:has(strong:text-is("Books")):has-text("/Volumes/Hobbies/Books · a Calibre library, 288 authors")`, { timeout: 3000 });
        await page.waitForSelector(`${card} li:has(strong:text-is("Music")):has-text("found 1,204 artists")`, { timeout: 3000 });
        if (!await page.$(`${card} .tidydrive:has(strong:text-is("Backup"))[disabled]`)) throw new Error('the backup drive can be picked');
        if (await page.$(`${card} button:has-text("Use Hobbies")`)) throw new Error('Use on the drive they are on already');
        await page.click(`${card} .tidydrive:has(strong:text-is("New"))`);
        await page.waitForSelector(`${card} li:has(strong:text-is("Movies")):has-text("/Volumes/New/movies · new: made when the first one arrives")`, { timeout: 3000 });
        await page.click(`${card} button:text-is("Use New")`);
        await page.waitForFunction(() => (window.__MOCK.mediaRoots || []).length === 1, null, { timeout: 3000 });
        if ((await page.evaluate(() => window.__MOCK.mediaRoots))[0] !== '/Volumes/New') throw new Error('kept the wrong folder');
        await page.waitForSelector('#cliPanel:not([hidden]) #cliTitle:text-is("Use New")', { timeout: 5000 });
        await page.waitForSelector('#cliPanel button:text-is("Restart them")', { timeout: 5000 });
      } },
      { name: 'Tidy Up: the first time, Where should your libraries live? comes first, on the roomiest drive', screen: 'tidy', mock: { tidy: none, tidyDrives: drives.map((x) => ({ ...x, found: [], current: false })), pickMediaFolder: '/Volumes/NAS/Media' }, run: async (page) => {
        const card = '#tidy .tidyplaces';
        await page.waitForSelector(`${card} h2:text-is("Where should your libraries live?")`, { timeout: 5000 });
        if (await page.$('#tidy .tidyinbox') || await page.$(`${card} button:text-is("Cancel")`)) throw new Error('the first time, something else first');
        await page.waitForSelector(`${card} .tidydrive[aria-checked="true"]:has(strong:text-is("New"))`, { timeout: 3000 });
        await page.click(`${card} .tidydrive:has(strong:text-is("Another folder…"))`);
        await page.waitForSelector(`${card} .tidydrive[aria-checked="true"]:has(strong:text-is("Media")):has-text("A folder you chose")`, { timeout: 3000 });
        await page.waitForSelector(`${card} button:text-is("Use Media")`, { timeout: 3000 });
      } },
    ];
  })(),
  // On a phone, the six tabs in two even rows of three.
  { name: 'Tidy Up: on a phone the tabs sit in two rows of three', screen: 'tidy', run: async (page) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.waitForSelector('#tidy .seg button:text-is("Audiobooks")', { timeout: 5000 });
    // The tabs alone: the Inbox card's when choice is a row of its own.
    const rows = await page.$$eval('#tidyRoot > .seg button', (b) => b.reduce((m, x) => { const t = Math.round(x.getBoundingClientRect().top); m[t] = (m[t] || 0) + 1; return m; }, {}));
    if (JSON.stringify(Object.values(rows)) !== '[3,3]') throw new Error(`tabs per row: ${JSON.stringify(rows)}`);
    // Needs your OK's count reads as its subtitle, from the heading's left edge, not alone at the right.
    const [h, c] = await page.$$eval('#tidy .tidyneeds > .row h2, #tidy .tidyneeds > .row .fx-actions > *', (e) => e.map((x) => Math.round(x.getBoundingClientRect().left)));
    if (h !== c) throw new Error(`the heading starts at ${h}, its count at ${c}`);
  } },
  // VoiceOver: a running job is read when its step changes and when it ends, not on every file; a line's dot has words.
  { name: 'Tidy Up: VoiceOver hears each step and the end, not every tick, and what each line’s dot means', screen: 'tidy', mock: { tidyFails: { 'movies collect': 'Tdarr isn\'t answering at http://localhost:8265.' }, tidyEvents: { 'movies collect': [{ type: 'step', n: 1, total: 2, text: 'Asking Tdarr what it finished' }, { type: 'progress', label: 'Films', done: 1, total: 4 }, { type: 'fail', text: 'Tdarr isn\'t answering' }] } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("Movies")', { timeout: 5000 });
    await page.click('#tidy .tidyneeds button:text-is("Collect")');
    await page.waitForSelector('#tidyJob h2:has-text("didn\'t finish")', { timeout: 5000 });
    const live = await page.$$eval('#tidyJob [role=status], #tidyJob [aria-live], #tidyJob[role]', (e) => e.map((x) => `${x.className}: ${x.textContent}`));
    if (live.length !== 1 || !/^sr: Collecting Tdarr's work: didn't finish/.test(live[0])) throw new Error(`what is read out: ${JSON.stringify(live)}`);
    const said = await page.textContent('#tidyJob .tidylines li strong');
    if (said !== 'Failed: Tdarr isn\'t answering') throw new Error(`a failed line reads "${said}"`);
  } },
  // A check that found songs missing isn't asked for again as if it never ran: it says how many and whose, and offers
  // putting the old library back (asked first) or checking again; Free it… isn't offered.
  { name: 'Tidy Up: a music check that found songs missing says so, with Put it back and Check again', screen: 'tidy', mock: { tidy: { ...tidy, libraries: tidy.libraries.map((l) => (l.kind === 'music' ? { ...l, stage: 'swapped', last: { ...l.last, verify: tidyRun('verify', 1, { original: 14000, new: 13929, set_aside: 68, missing: 3, artists_with_fewer: [{ artist: 'Radiohead', fewer: 2 }, { artist: 'Björk', fewer: 1, folder_missing: true }] }, false) } } : l)) } }, run: async (page) => {
    const row = '#tidy .tidyneeds li:has-text("3 songs didn\'t make it into the new library")';
    await page.waitForSelector(row, { timeout: 5000 });
    const sub = await page.textContent(`${row} .warn`);
    if (!sub.startsWith('Radiohead (2 fewer), Björk (all of it) · ')) throw new Error(`it says: ${sub}`);
    if (await page.locator('#tidy .tidyneeds li:has-text("Check nothing went missing"), #tidy button:text-is("Free it…")').count()) throw new Error('it asks for the check again as if it never ran, or offers to free the space');
    await page.click(`${row} button:text-is("Put the old library back…")`);
    await page.waitForSelector('#tidySheet:not([hidden]) h2:text-is("Put the old library back?")', { timeout: 5000 });
    if ((await page.evaluate(() => window.__MOCK.tidyRuns || [])).length) throw new Error('it ran before the OK');
    await page.click('#tidySheet button:text-is("Put it back")');
    await page.waitForFunction(() => JSON.stringify((window.__MOCK.tidyRuns || [])[0]) === JSON.stringify(['music', 'undo', [], true]), null, { timeout: 5000 });
  } },
  // A review that was applied lists what was changed, not what could be: Overview doesn't offer it again, Books says it
  // was applied with Undo and no second Apply; after an Undo, the review is offered again.
  { name: 'Tidy Up: once a books review is applied, it isn’t offered again', screen: 'tidy', mock: { tidy: { ...tidy, libraries: tidy.libraries.map((l) => (l.kind === 'books' ? { ...l, stage: 'applied', last: { ...l.last, apply: tidyRun('apply', 0.5, { changed: 2 }) } } : l)) } }, run: async (page) => {
    await page.waitForSelector('#tidy .tidyneeds', { timeout: 5000 });
    if (await page.locator('#tidy .tidyneeds li:has-text("could look tidier")').count()) throw new Error('Overview offers the applied review again');
    await page.click('#tidy .seg button:text-is("Books")');
    // "Applied … ago": how long ago grows while the suite runs (the fixture's times are set once, at its start).
    await page.waitForSelector('#tidyReview :text-matches("^Applied .+ ago: the books in it were changed")', { timeout: 5000 });
    if (await page.locator('#tidyReview button:has-text("Apply to")').count()) throw new Error('it offers to apply the same changes again');
    await page.waitForSelector('#tidyReview button:text-is("Undo the last apply")', { timeout: 3000 });
  } },
  { name: 'Tidy Up: after an apply is undone, the review is offered again', screen: 'tidy', mock: { tidy: { ...tidy, libraries: tidy.libraries.map((l) => (l.kind === 'books' ? { ...l, last: { ...l.last, apply: tidyRun('apply', 0.5, { changed: 2 }), undo: tidyRun('undo', 0.2, {}) } } : l)) } }, run: async (page) => {
    await page.waitForSelector('#tidy .tidyneeds li:has-text("2 books could look tidier")', { timeout: 5000 });
    await page.click('#tidy .seg button:text-is("Books")');
    await page.waitForSelector('#tidyReview button:text-is("Apply to 2 books…")', { timeout: 5000 });
  } },
  // Stop on a job started elsewhere (tidy-loop.md's queue, item 3): it asks the computer to stop that job (the one shown:
  // its process and start), says Stopping… until it has, and can't be asked twice; then the card goes.
  { name: 'Tidy Up: a job started elsewhere can be stopped, and says Stopping…', screen: 'tidy', mock: (() => {
    const lock = { pid: 4242, kind: 'movies', action: 'collect', start: tidyAt(0.1), flags: [] };
    return { tidy: { ...tidy, lock }, tidyStopSlow: 4000 };
  })(), run: async (page) => {
    await page.click('#tidy .seg button:text-is("Movies")', { timeout: 5000 });
    await page.click('#tidyRunning button:text-is("Stop")', { timeout: 5000 });
    await page.waitForSelector('#tidyRunning button:text-is("Stopping…"):disabled', { timeout: 2000 });
    const asked = await page.evaluate(() => window.__MOCK.tidyStoppedElsewhere);
    const start = await page.evaluate(() => window.__MOCK.tidy.lock?.start);
    if (!asked || asked[0] !== 4242 || asked[1] !== start) throw new Error(`asked to stop ${JSON.stringify(asked)}`);
    await page.waitForSelector('#tidyRunning', { state: 'detached', timeout: 12000 });
  } },
  // Following a job started elsewhere carries on after a read that fails once (tidy-loop.md's queue, item 6): the next
  // ask finds it done, and the card goes, with no click.
  { name: 'Tidy Up: following a job started elsewhere tries again after a read fails', screen: 'tidy', mock: (() => {
    const lock = { pid: 4242, kind: 'movies', action: 'collect', start: tidyAt(0.1), flags: [] };
    return { tidy: { ...tidy, lock }, tidyLockFails: 1, tidyLocks: [{ now: {} }] };
  })(), run: async (page) => {
    await page.click('#tidy .seg button:text-is("Movies")', { timeout: 5000 });
    await page.waitForSelector('#tidyRunning', { timeout: 5000 });
    // The first ask (3 s in) fails; the next (3 s later) finds it done.
    await page.waitForSelector('#tidyRunning', { state: 'detached', timeout: 12000 });
  } },
  // A job this window didn't start (the agent's Collect every few minutes) holds the lock: followed, and every button waits.
  { name: 'Tidy Up: a job started elsewhere shows its step and bar, every button waits, and the screen reads again once it is done', screen: 'tidy', mock: (() => {
    const lock = { pid: 4242, kind: 'movies', action: 'collect', start: tidyAt(0.1) };
    return { tidy: { ...tidy, lock }, tidyLocks: [
      { lock, now: { step: { type: 'step', n: 2, total: 2, text: 'Swapping in the smaller copies' }, progress: { type: 'progress', label: 'Films', done: 1, total: 4, note: 'Heat (1995)' } } },
      { now: {} },
    ] };
  })(), run: async (page) => {
    await page.click('#tidy .seg button:text-is("Movies")', { timeout: 5000 });
    await page.waitForSelector('#tidyRunning h2:text-is("Collecting Tdarr\'s work")', { timeout: 5000 });
    const shrink = '#tidy .tidyneeds button:text-is("Shrink")';
    if (!(await page.isDisabled(shrink))) throw new Error('Shrink could start while another job holds the lock');
    const why = await page.getAttribute(shrink, 'title');
    if (why !== "Waits for collecting Tdarr's work to finish") throw new Error(`Shrink's hover: ${why}`);
    // The first ask, a few seconds in: where the job has got to.
    await page.waitForSelector('#tidyRunning .tidystep:text-is("Step 2 of 2 · Swapping in the smaller copies")', { timeout: 8000 });
    await page.waitForSelector('#tidyRunning [role=progressbar][aria-valuenow="25"]', { timeout: 5000 });
    await page.waitForSelector('#tidyRunning .tidynow:text-is("Now: Heat (1995)")', { timeout: 5000 });
    // The next: it's done, the card goes, and the buttons are back, with no click.
    await page.waitForSelector('#tidyRunning', { state: 'detached', timeout: 8000 });
    await page.waitForSelector(`${shrink}:enabled`, { timeout: 5000 });
  } },
  // A job started yesterday says so (tidy-loop.md's queue, item 7): "Started yesterday at 3:04 AM", never a bare "Started
  // at 3:04 AM" that reads as this morning; and one that stopped part-way says when it started, which it never did.
  ...[
    ['a job started elsewhere yesterday says yesterday', { lock: { pid: 4242, kind: 'movies', action: 'collect', start: tidyYesterday(), flags: [] } }, '#tidyRunning', 'Movies'],
    ['a job that stopped part-way says when it started', { stale: { pid: 4242, kind: 'music', action: 'finalize', start: tidyYesterday() } }, '#tidyStale', ''],
  ].map(([what, extra, card, tab]) => ({ name: `Tidy Up: ${what}`, screen: 'tidy', mock: { tidy: { ...tidy, ...extra } }, run: async (page) => {
    if (tab) await page.click(`#tidy .seg button:text-is("${tab}")`, { timeout: 5000 });
    await page.waitForSelector(card, { timeout: 5000 });
    const text = await page.textContent(card);
    if (!/Started yesterday at 3:04(\s| )?AM/i.test(text) && !/Started yesterday at 03:04/.test(text)) throw new Error(`it says: ${text}`);
  } })),
  // A swap that stopped part-way asked for an OK when it started: Carry on asks again, then runs with it (never without, which fails).
  { name: 'Tidy Up: a swap that stopped part-way asks again, then carries on with its OK', screen: 'tidy', mock: { tidy: { ...tidy, stale: { pid: 4242, kind: 'music', action: 'finalize', start: tidyAt(3) } } }, run: async (page) => {
    await page.waitForSelector('#tidyStale strong:text-is("Swapping in your cleaned library: stopped part-way")', { timeout: 5000 });
    await page.click('#tidyStale button:text-is("Carry on…")');
    await page.waitForSelector('#tidySheet:not([hidden]) h2:text-is("Carry on: swapping in your cleaned library?")', { timeout: 5000 });
    if (await page.evaluate(() => (window.__MOCK.tidyRuns || []).length)) throw new Error('it ran before the OK');
    await page.click('#tidySheet button:text-is("Carry on")');
    await page.waitForFunction(() => (window.__MOCK.tidyRuns || []).length === 1, null, { timeout: 5000 });
    const ran = await page.evaluate(() => window.__MOCK.tidyRuns[0]);
    if (JSON.stringify(ran) !== JSON.stringify(['music', 'finalize', [], true])) throw new Error(`ran: ${JSON.stringify(ran)}`);
  } },
  // A job that stopped part-way carries on as itself, with the flags its lock kept (tidy-loop.md's queue, item 2): Tidy
  // lyrics as Tidy lyrics (never Add lyrics, which asks LRCLIB about every song), Set up Tdarr and Check Downloads with
  // --apply (without it, a preview that takes no lock, and the card stays). A lock from before flags were kept: Tdarr
  // and Downloads lock only with --apply, so that is what they had; lyrics can't tell, so it says to start it again.
  ...[
    ['Tidy lyrics carries on as Tidy lyrics', { kind: 'music', action: 'lyrics', flags: ['--tidy'] }, 'Tidying lyrics', ['music', 'lyrics', ['--tidy']]],
    ['Set up Tdarr carries on with --apply', { kind: 'tdarr', action: 'setup', flags: ['--apply'] }, 'Setting up Tdarr', ['tdarr', 'setup', ['--apply']]],
    ['Check Downloads from an old lock carries on with --apply', { kind: 'inbox', action: 'scan' }, 'Checking Downloads', ['inbox', 'scan', ['--apply']]],
    ['lyrics from an old lock says to start it again, and runs nothing', { kind: 'music', action: 'lyrics' }, 'Adding lyrics', null],
  ].map(([what, lock, title, runs]) => ({ name: `Tidy Up: a job that stopped part-way, ${what}`, screen: 'tidy', mock: { tidy: { ...tidy, stale: { pid: 4242, start: tidyAt(3), ...lock } } }, run: async (page) => {
    await page.waitForSelector(`#tidyStale strong:text-is("${title}: stopped part-way")`, { timeout: 5000 });
    if (!runs) {
      if (await page.isVisible('#tidyStale button')) throw new Error('a lock that cannot say offers Carry on');
      await page.waitForSelector('#tidyStale:has-text("Music")', { timeout: 2000 });
      return;
    }
    await page.click('#tidyStale button:text-is("Carry on")');
    await page.waitForFunction(() => (window.__MOCK.tidyRuns || []).length === 1, null, { timeout: 5000 });
    const ran = await page.evaluate(() => window.__MOCK.tidyRuns[0].slice(0, 3));
    if (JSON.stringify(ran) !== JSON.stringify(runs)) throw new Error(`ran: ${JSON.stringify(ran)}`);
  } })),
  // Which books were left alone isn't kept with the job, so a books apply never carries on by itself: the review opens.
  { name: 'Tidy Up: a books apply that stopped part-way opens the review, and applies nothing by itself', screen: 'tidy', mock: { tidy: { ...tidy, stale: { pid: 4242, kind: 'books', action: 'apply', start: tidyAt(3) } } }, run: async (page) => {
    await page.waitForSelector('#tidyStale strong:text-is("Tidying your books: stopped part-way")', { timeout: 5000 });
    await page.click('#tidyStale button:text-is("Open the review")');
    await page.waitForSelector('#tidy .seg button[aria-checked="true"]:text-is("Books")', { timeout: 5000 });
    await page.waitForSelector('#tidyReview', { timeout: 5000 });
    const ran = await page.evaluate(() => window.__MOCK.tidyRuns || []);
    if (ran.length) throw new Error(`ran: ${JSON.stringify(ran)}`);
  } },
  // Stop waits for a safe point, which can take minutes: until then, the panel says it's stopping and Stop can't be pressed again.
  { name: 'Tidy Up: Stop says it is stopping until the job reaches a safe point', screen: 'tidy', mock: { tidyHold: true, tidyStopSlow: 1500, tidyEvents: { 'tv scan': [{ type: 'step', n: 1, total: 2, text: 'Reading' }, { type: 'progress', label: 'Episodes', done: 5, total: 800, note: 'Frieren S01E05' }] } }, run: async (page) => {
    await page.click('#tidy .seg button:text-is("TV")', { timeout: 5000 });
    await page.click('#tidy .tidyneeds button:text-is("Scan")');
    await page.waitForSelector('#tidyJob .tidynow:text-is("Now: Frieren S01E05")', { timeout: 5000 });
    await page.click('#tidyJob button:text-is("Stop")');
    await page.waitForSelector('#tidyJob h2:text-is("Scanning your TV: stopping")', { timeout: 2000 });
    if (!(await page.isDisabled('#tidyJob button:text-is("Stopping…")'))) throw new Error('Stop could be pressed again');
    await page.waitForSelector('#tidyJob .tidynow:has-text("Stopping at the next safe point")', { timeout: 2000 });
    await page.waitForSelector('#tidyJob button:text-is("Close")', { timeout: 5000 });
  } },
  // Take 2 (Nov 7, the owner's ask): the thing to do next leads Needs your OK, above a step that throws things away;
  // the libraries sit on a shelf, each with what it holds, how far along it is (only what the record can say), and
  // what it waits on; a tile opens its tab, which opens on that library.
  { name: 'Tidy Up: Overview leads with the next thing to do, and the shelf opens each library', screen: 'tidy', run: async (page) => {
    await page.waitForSelector('#tidy .tidyneeds li', { timeout: 5000 });
    const first = await page.$eval('#tidy .tidyneeds li', (li) => [li.querySelector('strong')?.textContent.trim(), !!li.querySelector('button.primary')]);
    if (first[0] !== '2,402 songs could get lyrics' || !first[1]) throw new Error(`Needs your OK starts with ${JSON.stringify(first)}`);
    const tiles = await page.$$eval('#tidy .tidyshelf .tidytile', (b) => b.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
    const want = ['Music13,932 songs · 520 GB83% with lyrics', 'Movies356 films · 1.4 TB87% already lean', 'TV820 GB', 'Books412 books · 12 GB', "AudiobooksIts drive isn't plugged in"];
    if (tiles.length !== 5 || want.some((w, i) => !tiles[i].startsWith(w))) throw new Error(`the shelf: ${JSON.stringify(tiles)}`);
    if (!tiles[0].includes('2,402 songs could get lyrics') || !tiles[1].includes('Shrink 42 films')) throw new Error(`the tiles don't say what waits: ${JSON.stringify(tiles)}`);
    await page.click('#tidy .tidyshelf .tidytile:has-text("Movies")');
    await page.waitForSelector('#tidy .seg button[aria-checked="true"]:text-is("Movies")', { timeout: 3000 });
    await page.waitForSelector('#tidy .tidyhero h2:has-text("Movies")', { timeout: 3000 });
  } },
  { name: 'Tidy Up: Music opens on its steps, each done one with when, and freeing the space next', screen: 'tidy', run: async (page) => {
    await page.click('#tidy .seg button:text-is("Music")', { timeout: 5000 });
    await page.waitForSelector('#tidy .tidyhero .tidytrack', { timeout: 3000 });
    const steps = await page.$$eval('#tidy .tidytrack li', (ls) => ls.map((l) => `${l.className}:${l.querySelector('strong').textContent}`));
    if (JSON.stringify(steps) !== JSON.stringify(['done:Scanned', 'done:Tidy copy built', 'done:Swapped in', 'done:Every song checked', 'now:Old library freed'])) throw new Error(`steps: ${JSON.stringify(steps)}`);
    const facts = (await page.textContent('#tidy .tidyhero .tidyfacts')).replace(/\s+/g, '');
    if (!facts.includes('Songs13,932') || !facts.includes('Onthedrive520GB') || !facts.includes('Withlyrics83%')) throw new Error(`the facts: ${facts}`);
  } },
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
  // Everything done but a step that can wait: the count says so, not just "18 of 18 done" under Finish setting up
  // (the owner's screenshot, Nov 12).
  { name: 'Setup: all done but one that can wait says it can wait', screen: 'setup', mock: { setup: setup.map((s) => (s.id === 'backups' ? { ...s, state: 'todo', later: true } : { ...s, state: 'done' })) }, run: async (page) => {
    await page.waitForSelector('#checkCount:not(:empty)', { timeout: 5000 });
    const count = (await page.textContent('#checkCount')).trim();
    if (!/^\d+ of \d+ done · 1 can wait$/.test(count)) throw new Error(`the count: ${count}`);
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
  // No container runtime yet, as each system has it: the card says how in
  // that system's own way. Dragging to Applications is the Mac's alone, and
  // SteamOS, whose system takes no install, is pointed to Set up Docker for
  // me (a step of the checklist, once the homelab is made).
  ...[['MacIntel', 'macOS', 'OrbStack', 'brew install --cask orbstack', 'https://orbstack.dev/download'], ['Win32', 'Windows', 'Docker Desktop', 'install Docker Desktop with the WSL 2 backend (winget install Docker.DockerDesktop)', 'https://www.docker.com/products/docker-desktop/'], ['Linux x86_64', 'Linux', 'Docker Engine', 'install Docker Engine and the compose plugin (https://docs.docker.com/engine/install/), then add yourself to the docker group', 'https://docs.docker.com/engine/install/'], ['Linux x86_64', 'SteamOS', 'Docker', 'Setup › Set up Docker for me (homelab runtime install --apply): Docker in your home folder, run as you, kept across SteamOS updates', '']].map(([platform, os, runtime, hint, download]) => ({ name: `First run on ${os} with no ${runtime}: the card says how there`, screen: 'setup', mock: { platform, host: { ...host, os, runtime, runtimeOK: false, runtimeInstalled: false, runtimeHint: hint, runtimeDownload: download, rootOK: false, root: '', disks: [], kit: true, newRoot: '/home/you/Homelab' } }, run: async (page) => {
    await page.waitForSelector('#runtimeCard:not([hidden])', { timeout: 5000 });
    const text = await page.textContent('#runtimeCard');
    if (/undefined/.test(text)) throw new Error('the card says "undefined": ' + text);
    if (os !== 'macOS' && /Applications/.test(text)) throw new Error(`${os} is told to drag it to Applications: ${text}`);
    if (os === 'SteamOS' && !/Set up Docker for me/.test(text)) throw new Error('SteamOS is not pointed to Set up Docker for me: ' + text);
  } })),
  // Before the homelab's folder exists nothing on the checklist can run
  // (its steps are read from a .env that is not there yet), so none of it
  // shows, nor a count in the sidebar: the first thing to do is the folder.
  // Once it is made, the checklist comes.
  { name: 'First run: no checklist before the homelab is made', screen: 'setup', mock: { host: { ...host, runtimeOK: false, runtimeInstalled: true, rootOK: false, root: '', disks: [], kit: true, newRoot: '/Users/you/Homelab' } }, run: async (page) => {
    await page.waitForSelector('#newHomelab:has-text("/Users/you/Homelab")', { timeout: 5000 });
    await page.waitForTimeout(500); // the steps are in by now
    const shown = await page.evaluate(() => ['checklist', 'checkTitle', 'runAll'].filter((id) => {
      const e = document.getElementById(id);
      return e && !e.closest('[hidden]') && e.getClientRects().length > 0;
    }));
    if (shown.length) throw new Error('shown before the homelab is made: ' + shown.join(', '));
    const count = (await page.textContent('#setupCount')).trim();
    if (count) throw new Error(`the sidebar counts ${count} steps before the homelab is made`);
    if (!(await page.isVisible('#checkWait'))) throw new Error('nothing says the steps come once the homelab is made');
    await page.click('#createHomelab');
    await page.waitForSelector('#checklist li', { state: 'visible', timeout: 5000 });
    if (await page.isVisible('#checkWait')) throw new Error('the wait note stays once the homelab is made');
  } },
  // A step that fails: why it failed, and what to do now, stay on the
  // screen after the red bar has gone (it goes after 6 seconds), beside
  // the step, not only in a log folded under Show details.
  { name: 'First run: a failed step still says why, and what next', screen: 'setup', mock: {
    setup: [{ id: 'backups', title: 'Back up to a drive', why: 'A copy of everything on a drive of its own.', state: 'todo', run: [['backup', 'setup', '--apply']], runLabel: 'Set up backups' }],
    runFails: { backups: 'the backup drive /Volumes/Backup is not plugged in' },
  }, run: async (page) => {
    await page.click('#checklist button:has-text("Set up backups")', { timeout: 5000 });
    await page.waitForSelector('#error:not([hidden])', { timeout: 5000 });
    await page.waitForTimeout(6500); // the red bar has gone
    const row = (await page.textContent('#checklist li:has-text("Back up to a drive")')).replace(/\s+/g, ' ');
    if (!row.includes('the backup drive /Volumes/Backup is not plugged in')) throw new Error('once the red bar has gone, the step does not say why it failed: ' + row);
    if (!/Set up backups again/.test(row)) throw new Error('the step does not say what to do next: ' + row);
    await page.click('#checklist button:has-text("Set up backups")');
    await page.waitForSelector('#checklist li:has-text("Back up to a drive") .failed', { state: 'detached', timeout: 2000 });
  } },
  // What a step gives you, and why it failed and what next, are read in full: before, each was cut to one line with
  // "…" (in an 860px window, every step's), and what to press next after a failure went with it. In a normal window,
  // and in a narrow one with big text.
  { name: 'First run: a failed step says why in full, not cut off', screen: 'setup', mock: {
    setup: [{ id: 'backups', title: 'Back up to a drive', why: 'A copy of everything on a drive of its own, made every night while you sleep, and checked each week.', state: 'todo', run: [['backup', 'setup', '--apply']], runLabel: 'Set up backups' }],
    runFails: { backups: 'the backup drive /Volumes/Backup is not plugged in, or is formatted for Windows (NTFS) and this computer can only read it' },
  }, run: async (page) => {
    await page.click('#checklist button:has-text("Set up backups")', { timeout: 5000 });
    const line = page.locator('#checklist li:has-text("Back up to a drive") .failed');
    await line.waitFor({ timeout: 5000 });
    for (const [w, zoom] of [[1280, '1'], [860, '1.5']]) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.evaluate((z) => document.documentElement.style.setProperty('--zoom', z), zoom);
      const cut = await page.$$eval('#checklist li .body > .sub', (es) => es.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim()));
      if (cut.length) throw new Error(`at ${w}px, text ${zoom}×, cut off: ${cut.join(' | ')}`);
    }
  } },
  // Once the homelab is made with no apps yet, Setup says the next thing
  // is picking them, and takes you there; with apps, it says nothing.
  { name: 'First run: once the homelab is made, Setup points to the first apps', screen: 'setup', mock: { status: { ...status, apps: [] }, host: { ...host, rootOK: false, root: '', disks: [], kit: true, newRoot: '/Users/you/Homelab' } }, run: async (page) => {
    await page.waitForSelector('#newHomelab:has-text("/Users/you/Homelab")', { timeout: 5000 });
    if (await page.isVisible('#firstApps')) throw new Error('the first apps are offered before the homelab is made');
    await page.click('#createHomelab');
    await page.waitForSelector('#checklist li', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(500);
    const said = await page.evaluate(() => document.querySelector('#setup').innerText);
    if (!/Choose apps/.test(said)) throw new Error('once the homelab is made, nothing on Setup points to picking the first apps');
    await page.click('#firstApps button:has-text("Choose apps")');
    await page.waitForSelector('#choose.active', { timeout: 5000 });
  } },
  { name: 'Setup says nothing of first apps once there are apps', screen: 'setup', run: async (page) => {
    await page.waitForSelector('#checklist li', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(500);
    if (await page.isVisible('#firstApps')) throw new Error('first apps offered with apps already running');
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
  // Suggestions from what you use: Add more opens on the apps that go with ones you run, each saying what it brings;
  // one whose partner you don't run is not suggested, and ticking a suggestion picks it.
  { name: 'Choose apps: suggestions from what you run', screen: 'choose', run: async (page) => {
    await page.click('#more > summary');
    const group = page.locator('.group.suggested');
    await group.locator('h2:has-text("Suggested for what you run")').waitFor({ timeout: 5000 });
    await group.locator('label.app:has-text("Beets") .goeswith').filter({ hasText: 'Goes with Navidrome, which you run: Tags and sorts the music' }).waitFor({ timeout: 3000 });
    await group.locator('.goeswith').filter({ hasText: 'Goes with Paperless-ngx, which you run: Titles, tags, and correspondents' }).waitFor({ timeout: 3000 });
    if (await group.locator('label.app:has-text("Bazarr")').count()) throw new Error('Bazarr is suggested without Sonarr or Radarr');
    if (await group.locator('label.app strong:text-is("Navidrome")').count()) throw new Error('an app you run is suggested');
    await group.locator('label.app:has-text("Beets") input').check();
    if (!(await page.isChecked('.group:not(.suggested) label.app:has-text("Beets") input'))) throw new Error('ticking a suggestion did not pick the app');
    // Searching hides the group; the row still says it.
    await page.fill('#search', 'beets');
    await page.waitForSelector('.group.suggested', { state: 'detached', timeout: 3000 });
    await page.locator('label.app:has-text("Beets") .goeswith').waitFor({ timeout: 3000 });
  } },
  // Two apps that do the same job: an app's row says which one you already run and why one might keep one or both,
  // from whichever side the pair is written, and an app you run says nothing.
  { name: 'Choose apps: an app that does what one you run does says so', screen: 'choose', run: async (page) => {
    await page.fill('#search', 'kavita');
    const kavita = page.locator('label.app:has-text("Kavita")');
    await kavita.locator('.samejob').filter({ hasText: 'You already run Komga: Both read comics and manga from the same folders' }).waitFor({ timeout: 5000 });
    await kavita.locator('.samejob').filter({ hasText: 'You already run Calibre-Web: Both serve your e-books' }).waitFor({ timeout: 3000 });
    // Written on Mealie's side, said on Tandoor's; Mealie is installed though stopped.
    await page.fill('#search', 'tandoor');
    await page.locator('label.app:has-text("Tandoor") .samejob').filter({ hasText: 'You already run Mealie: Both keep recipes' }).waitFor({ timeout: 3000 });
    await page.fill('#search', 'kopia');
    await page.locator('label.app:has-text("Kopia") .samejob').filter({ hasText: 'You already run Duplicati: Meant to run beside it' }).waitFor({ timeout: 3000 });
    // Komga runs: its own row names nothing.
    await page.fill('#search', 'komga');
    await page.waitForSelector('label.app:has-text("Komga")', { timeout: 3000 });
    if (await page.locator('label.app:has-text("Komga") .samejob').count()) throw new Error('an app you run says it does what another does');
  } },
  { name: 'Choose apps as a Mac: Beszel sees the VM, Frigate the processor', screen: 'choose', run: async (page) => {
    await page.fill('#search', 'beszel');
    await page.waitForSelector('label.app:has-text("Beszel") .sysnote:has-text("OrbStack\'s Linux VM")', { timeout: 5000 });
    await page.fill('#search', 'frigate');
    await page.waitForSelector('label.app:has-text("Frigate") .sysnote:has-text("containers reach no Coral")', { timeout: 5000 });
  } },
  // Remember where you were: each screen keeps its own scroll and open sections between visits (another screen starts at its
  // own place, not this one's) and after the app is opened again.
  { name: 'Each screen keeps where you were: its scroll and open sections, after quitting too', screen: 'choose', run: async (page) => {
    const top = () => page.evaluate(() => Math.round(document.querySelector('main').scrollTop));
    const scrollTo = (y) => page.evaluate((v) => { document.querySelector('main').scrollTop = v; }, y);
    // What is at the top of the window: the same after opening again, though a card drawn late above moves the pixels.
    const atTop = () => page.evaluate(() => { const m = document.querySelector('main').getBoundingClientRect(); return document.elementFromPoint(m.left + m.width / 2, m.top + 60)?.closest('label, li, h2, summary, p')?.textContent.trim().slice(0, 60) || ''; });
    await page.waitForSelector('#choose.active #more', { timeout: 5000 });
    await page.click('#more > summary');
    await page.waitForFunction(() => document.querySelector('#more').open, null, { timeout: 2000 });
    await page.waitForFunction(() => document.querySelector('main').scrollHeight > 2000, null, { timeout: 5000 });
    await scrollTo(900);
    const chose = await top(), shown = await atTop();
    if (chose < 800 || !shown) throw new Error(`Choose apps only scrolls to ${chose} (${shown})`);
    await page.click('nav button[data-screen=status]');
    await page.waitForSelector('#statusRows tr:has(strong:text-is("Vikunja"))', { timeout: 5000 });
    if ((await top()) !== 0) throw new Error(`Status opened ${await top()}px down, Choose apps' place`);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    await scrollTo(300);
    // Where it is as it is left (a card drawn late above moves it, keeping the rows in view).
    await page.waitForTimeout(500);
    const status = await top();
    if (status < 250) throw new Error(`Status only scrolls to ${status}`);
    await page.click('nav button[data-screen=choose]');
    await page.waitForFunction((y) => Math.abs(document.querySelector('main').scrollTop - y) <= 1, chose, { timeout: 3000 }).catch(() => {});
    if (Math.abs((await top()) - chose) > 1) throw new Error(`back on Choose apps at ${await top()}, not ${chose}`);
    if (!(await page.evaluate(() => document.querySelector('#more').open))) throw new Error('Add more closed again');
    await page.click('nav button[data-screen=status]');
    await page.waitForFunction((y) => Math.abs(document.querySelector('main').scrollTop - y) <= 1, status, { timeout: 3000 }).catch(() => {});
    if (Math.abs((await top()) - status) > 1) throw new Error(`back on Status at ${await top()}, not ${status}`);
    // Quit and open again (on Choose apps): it is where it was, and so is Status. Quitting is the page going away
    // (pagehide keeps Status's place); what it kept is what the app's storage holds when it opens again. Carried over by
    // hand: a reloaded file:// page in this browser can start with empty storage when the machine is busy.
    await page.evaluate(() => dispatchEvent(new Event('pagehide')));
    const kept = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    if (!JSON.parse(kept)['homelab.place']) throw new Error('nothing kept on quitting');
    await page.addInitScript((k) => { for (const [key, value] of Object.entries(JSON.parse(k))) localStorage.setItem(key, value); }, kept);
    await page.reload();
    await page.waitForSelector('#choose.active #more', { timeout: 5000 });
    await page.waitForFunction((y) => document.querySelector('main').scrollTop >= y - 1, chose, { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
    if ((await atTop()) !== shown || !(await page.evaluate(() => document.querySelector('#more').open))) throw new Error(`after opening again: at ${await top()} showing "${await atTop()}", not "${shown}"; Add more open ${await page.evaluate(() => document.querySelector('#more').open)}`);
    await page.click('nav button[data-screen=status]');
    await page.waitForFunction((y) => Math.abs(document.querySelector('main').scrollTop - y) <= 1, status, { timeout: 3000 }).catch(() => {});
    if (Math.abs((await top()) - status) > 1) throw new Error(`Status after opening again at ${await top()}, not ${status}`);
  } },
  { name: 'Choose apps as Windows: what Beszel and Frigate do there', screen: 'choose', mock: { platform: 'Win32', host: { ...host, os: 'Windows 11 24H2', machine: 'this PC' } }, run: async (page) => {
    await page.fill('#search', 'beszel');
    await page.waitForSelector('label.app:has-text("Beszel") .sysnote:has-text("Docker Desktop\'s WSL VM")', { timeout: 5000 });
    await page.fill('#search', 'frigate');
    await page.waitForSelector('label.app:has-text("Frigate") .sysnote:has-text("NVIDIA card")', { timeout: 5000 });
  } },
  { name: 'Choose apps as Linux: Beszel as everywhere, Frigate by hand', screen: 'choose', mock: { platform: 'Linux x86_64', host: { ...host, os: 'Ubuntu 24.04', machine: 'this machine' } }, run: async (page) => {
    await page.fill('#search', 'frigate');
    await page.waitForSelector('label.app:has-text("Frigate") .sysnote:has-text("a Coral or the graphics")', { timeout: 5000 });
    await page.fill('#search', 'beszel');
    await page.waitForSelector('label.app:has-text("Beszel")', { timeout: 5000 });
    if (await page.locator('label.app:has-text("Beszel") .sysnote').count()) throw new Error('Beszel has a note on Linux, where it sees the machine itself');
  } },
  { name: 'Choose apps as SteamOS: Frigate with its AMD graphics', screen: 'choose', mock: { platform: 'Linux x86_64', host: { ...host, os: 'Linux (SteamOS 3.7)', machine: 'Steam Machine', desktop: 'kde' } }, run: async (page) => {
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
  // A backup's contents: hover (or Tab to) an off-site job's time for its last run, how long it took, what it holds, the
  // versions kept, its folders, and its next run; a job Duplicati says little about says only that.
  // Savings over time: the year's figure on Status, hovered (or reached with Tab), says what has been saved since the
  // first record, month by month, newest first, and the card is not cut off.
  { name: 'Status: hover what the apps replace for what they have saved so far', screen: 'status', run: async (page) => {
    const tile = '#tiles .tile:has-text("Instead of subscriptions") .savedso';
    await page.waitForSelector(tile, { timeout: 5000 });
    await page.hover(tile);
    const card = await page.waitForSelector(`${tile} [role=tooltip]`, { state: 'visible', timeout: 3000 });
    const said = (await card.innerText()).replace(/\s+/g, ' ');
    // The preview's 60 days: 12 at $2,991 a year, 18 at $3,112, 17 at $3,232, and 13 at $3,292.
    if (!/^Saved so far: \$520 since /.test(said)) throw new Error(`the total: ${said}`);
    const months = await card.$$eval('.savedmonths li', (li) => li.map((l) => l.textContent));
    const now = new Date().toLocaleString('en-US', { month: 'long' });
    if (months.length < 2 || !months[0].startsWith(now)) throw new Error(`the months, newest first: ${months}`);
    const inside = await card.evaluate((c) => { const r = c.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && c.contains(hit); });
    if (!inside) throw new Error('the card is cut off or covered');
    await page.mouse.move(5, 5);
    await page.waitForSelector(`${tile} [role=tooltip]`, { state: 'hidden', timeout: 2000 });
    await page.focus(tile);
    await page.waitForSelector(`${tile} [role=tooltip]`, { state: 'visible', timeout: 2000 });
  } },
  // What changed since last night: a copy's size beside the night before's, said when it moved by a tenth, and a
  // copy less than half the night before's warned about on its row.
  { name: 'Backups: a copy beside the night before’s, and one that shrank', screen: 'backups', mock: { backups: { ...backups, shrank: 1, copies: backups.copies.map((c) =>
    c.id === 'immich-database' ? { ...c, size: 9e6, before: 61e6, shrank: true }
    : c.id === 'navidrome' ? { ...c, before: 6.1e6 }
    : c.id === 'vikunja' ? { ...c, before: 405e3 } : c) } }, run: async (page) => {
    const row = (name) => page.locator(`#copiesCard tr.copy:has(td.name:has-text("${name}"))`).first();
    await row('Immich database').locator('.note.bad').getByText('Less than half the night before\'s 58 MB: check that Immich database still has its data').waitFor({ timeout: 5000 });
    if (!(await row('Immich database').locator('.dot.bad').count())) throw new Error('the shrunk copy has no red dot');
    // Grown by a third: both sizes shown. Within a tenth: its own size only, the night before's on hover.
    await row('Navidrome').locator('td.size .was').getByText('(was 5.8 MB)').waitFor({ timeout: 3000 });
    if (await row('Vikunja').locator('td.size .was').count()) throw new Error('a copy within a tenth of the night before\'s says was');
    if ((await row('Vikunja').locator('td.size').getAttribute('title')) !== 'The night before: 396 KB') throw new Error(`Vikunja's hover: ${await row('Vikunja').locator('td.size').getAttribute('title')}`);
  } },
  { name: 'Backups: hover a job’s time for its last run, what it holds, and how long it took', screen: 'backups', run: async (page) => {
    const when = '#dupCard li:has-text("Homelab Photos") .when .hovers';
    await page.waitForSelector(when, { timeout: 5000 });
    await page.hover(when);
    const card = await page.waitForSelector(`${when} [role=tooltip]`, { state: 'visible', timeout: 3000 });
    const said = (await card.innerText()).replace(/\s+/g, ' ');
    for (const want of [/^Last ran .+, in 41 minutes/, /Holds 301\.2 GB of yours, 48,211 files/, /286 GB where it is kept, 9 versions to go back to/, /Copies library, upload/, /Next run /]) {
      if (!want.test(said)) throw new Error(`no ${want} in: ${said}`);
    }
    const inside = await card.evaluate((c) => { const r = c.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && c.contains(hit); });
    if (!inside) throw new Error('the card is cut off or covered');
    await page.mouse.move(5, 5);
    await page.waitForSelector(`${when} [role=tooltip]`, { state: 'hidden', timeout: 2000 });
    // Tab reaches another; one Duplicati says little about says only what it knows.
    const secrets = '#dupCard li:has-text("Homelab Secrets") .when .hovers';
    await page.focus(secrets);
    const small = (await (await page.waitForSelector(`${secrets} [role=tooltip]`, { state: 'visible', timeout: 2000 })).innerText()).replace(/\s+/g, ' ');
    if (!/^Last ran /.test(small) || /, in |Holds|versions|Copies/.test(small)) throw new Error('Secrets says: ' + small);
  } },
  // The weekly integrity check (homelab backup-check): a job whose check found a damaged file says so in red and
  // counts as needing a look; one that passed says when on its hover.
  { name: 'Backups: the weekly check, a damaged file in red and a passed one on hover', screen: 'backups', mock: { duplicatiJobs: duplicatiJobs.map((j) => (j.name === 'Homelab Photos' ? { ...j, checked: hoursAgo(30), checkProblem: 'Hash mismatch on file "duplicati-b9e2.dblock.zip.aes"' } : j.name === 'Homelab AppData' ? { ...j, checked: hoursAgo(30) } : j)) }, run: async (page) => {
    await page.waitForSelector('#dupCard h2 + * .warn:text-is("1 need a look"), #dupCard .warn:text-is("1 need a look")', { timeout: 5000 });
    const photos = page.locator('#dupCard li:has-text("Homelab Photos")');
    const sub = (await photos.innerText()).replace(/\s+/g, ' ');
    if (!/Failed its check .+: Hash mismatch on file "duplicati-b9e2\.dblock\.zip\.aes"\. A version may not restore/.test(sub)) throw new Error(`Photos says: ${sub}`);
    if (!(await photos.locator('.dot.bad, [class*="bad"]').count())) throw new Error('the damaged job is not marked bad');
    const when = '#dupCard li:has-text("Homelab AppData") .when .hovers';
    await page.hover(when);
    const said = (await (await page.waitForSelector(`${when} [role=tooltip]`, { state: 'visible', timeout: 3000 })).innerText()).replace(/\s+/g, ' ');
    if (!/Checked .+: a sample of its files matched/.test(said)) throw new Error(`AppData's hover: ${said}`);
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
    // One line a copy: no cell wraps, nor says "database" under the name. A copy with a note under its name (why it is
    // stale, or that it shrank) is that one line and the note: its other cells stay on one line each.
    const tall = await page.$$eval('tr.copy', (rows) => rows.filter((r) => (r.querySelector('.note')
      ? [...r.querySelectorAll('td:not(.name)')].some((td) => { const g = document.createRange(); g.selectNodeContents(td); return new Set([...g.getClientRects()].map((x) => Math.round(x.top))).size > 1; })
      : r.getBoundingClientRect().height > 44)).map((r) => r.textContent));
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
  { name: 'Take the homelab off this machine: the plan, typed out, then the run', screen: 'settings', run: async (page) => {
    await page.waitForSelector('#thisMacCard #uninstall', { timeout: 5000 });
    await page.check('#uninstall-folder');
    if (!(await page.isChecked('#uninstall-data')) || !(await page.isDisabled('#uninstall-data'))) throw new Error('the folder does not take the data with it');
    await page.check('#uninstall-backups');
    await page.click('#uninstallReview');
    await page.waitForSelector('#uninstallPlan:has-text("it is in Proton Drive")', { timeout: 5000 });
    if (!(await page.isDisabled('#uninstallGo'))) throw new Error('Uninstall goes ahead before the word is typed');
    await page.fill('#uninstallTyped', 'uninstall');
    await page.click('#uninstallGo');
    await page.waitForSelector('#uninstallDone', { timeout: 5000 });
    const o = await page.evaluate(() => window.__MOCK.uninstalled);
    if (!o?.folder || !o.data || !o.backups || o.app || o.everythingElse) throw new Error(`ran with ${JSON.stringify(o)}`);
    if (!(await page.textContent('#uninstallLog')).includes('removed the scheduled jobs')) throw new Error('no log');
  } },
  { name: 'Everything else in the runtime asks for delete everything', screen: 'settings', run: async (page) => {
    await page.waitForSelector('#thisMacCard #uninstall', { timeout: 5000 });
    await page.check('#uninstall-everythingElse');
    await page.click('#uninstallReview');
    await page.fill('#uninstallTyped', 'uninstall', { timeout: 5000 });
    if (!(await page.isDisabled('#uninstallGo'))) throw new Error('uninstall is enough for everything else');
    await page.fill('#uninstallTyped', 'delete everything');
    if (await page.isDisabled('#uninstallGo')) throw new Error('delete everything is not accepted');
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
    // Usability task 7, item 13: said on the screen, with ways to hand over the welcome page, not opened by itself.
    const note = page.locator('#personAdded');
    await note.waitFor({ timeout: 5000 });
    if (!/Anna Smith is added/.test(await note.textContent())) throw new Error(`the note: ${await note.textContent()}`);
    if (await page.evaluate(() => window.__MOCK.opened)) throw new Error('the welcome page opened by itself');
    if (!/for them alone.*fridge sheet/s.test(await note.textContent())) throw new Error('the note does not say the welcome page is theirs alone, and what to send instead');
    await note.locator('button:text-is("Show their sign-in to scan")').click();
    await page.waitForFunction(() => window.__MOCK.opened === 'anna', null, { timeout: 3000 });
    await note.locator('button:text-is("Open the fridge sheet")').click();
    await page.waitForFunction(() => window.__MOCK.openedSheet === 'anna', null, { timeout: 3000 });
    await note.locator('button:text-is("Done")').click();
    await page.waitForSelector('#personAdded', { state: 'detached', timeout: 3000 });
  } },
  // A member who keeps her Finances private (private-finances.md 3.3): her row says so and when she last saved,
  // and nothing more; Remove's title says the owner can delete them but never open them.
  { name: 'Settings › People: a member’s private Finances, the fact only', screen: 'settings', mock: { status: { ...status, apps: [...status.apps, { id: 'pocket-id', name: 'Pocket ID', state: 'running', health: 'healthy', url: 'http://localhost:1411' }] }, people: [{ username: 'anna', name: 'Anna Smith' }, { username: 'sam', name: 'Sam Smith' }], privateFinances: { anna: '2026-11-13T15:04:00-05:00' } }, run: async (page) => {
    await page.click('#settingsNav .pagebtn[data-page="People"]', { timeout: 5000 });
    const anna = page.locator('#peopleCard li:has-text("Anna Smith")');
    await anna.locator(':text("Keeps their Finances private (last saved Nov 13)")').waitFor({ timeout: 5000 });
    if (await page.locator('#peopleCard li:has-text("Sam Smith"):has-text("private")').count()) throw new Error('Sam’s row says private');
    if (!/delete .*never open/.test(await anna.locator('button:has-text("Remove")').getAttribute('title'))) throw new Error('Remove doesn’t say their Finances can be deleted but never opened');
  } },
  // What CrowdSec stopped: the proxy's page lists today's with where each came from and what it tried, says how
  // many more there were, and other apps' pages have no such card.
  { name: 'The proxy’s page: what CrowdSec stopped today', screen: 'app:nginx-proxy-manager', run: async (page) => {
    const card = page.locator('#appStopped');
    await card.locator('h2:has-text("What CrowdSec stopped today")').waitFor({ timeout: 5000 });
    await card.locator('text=5 today · 2 banned now').waitFor({ timeout: 3000 });
    const first = card.locator('li').first();
    for (const want of ['Probing for a known security hole', 'Netherlands · Example Hosting B.V.', 'Banned']) {
      if (!(await first.textContent()).includes(want)) throw new Error(`the newest row has no ${want}: ${await first.textContent()}`);
    }
    await card.locator('li:has-text("and 3 more today")').waitFor({ timeout: 3000 });
  } },
  { name: 'An app’s page says what was done to it, and everything is searchable', screen: 'app:vikunja', run: async (page) => {
    const card = page.locator('#appDone');
    await card.locator('h2:has-text("Recently done")').waitFor({ timeout: 5000 });
    const rows = card.locator('li');
    await rows.first().waitFor({ timeout: 3000 });
    const texts = await rows.allTextContents();
    if (texts.length !== 3 || !texts[0].includes('Restarted Vikunja') || !texts[0].includes('by this computer') || !texts[1].includes('by the watchdog') || texts.some((t) => t.includes('Immich'))) throw new Error(`Vikunja's newest first, only its own: ${JSON.stringify(texts)}`);
    await card.getByRole('button', { name: 'Everything that was done…' }).click();
    const sheet = page.locator('#doneSheet');
    await sheet.locator('h2:has-text("Everything that was done")').waitFor({ timeout: 3000 });
    await sheet.locator('li:has-text("Stopped Immich")').waitFor({ timeout: 3000 });
    await sheet.getByLabel('Search what was done').fill('iphone');
    await page.waitForFunction(() => document.querySelectorAll('#doneSheet li').length === 1, null, { timeout: 3000 });
    await sheet.getByLabel('Search what was done').fill('nothing like this');
    await sheet.getByText('Nothing done matches “nothing like this”.').waitFor({ timeout: 3000 });
    await sheet.getByRole('button', { name: 'Close' }).click();
    await sheet.waitFor({ state: 'hidden', timeout: 3000 });
  } },
  { name: 'An app’s page with nothing done to it says so', screen: 'app:vikunja', mock: { history: [] }, run: async (page) => {
    await page.locator('#appDone').getByText("Nothing done to it yet that's kept here.", { exact: false }).waitFor({ timeout: 5000 });
  } },
  { name: 'CrowdSec’s page on a quiet day', screen: 'app:crowdsec', mock: { protection: { ...protection, today: [], todayCount: 0, bannedNow: 0 } }, run: async (page) => {
    await page.locator('#appStopped').getByText(/^Nothing yet today; 14 this week, the last /).waitFor({ timeout: 5000 });
  } },
  { name: 'The proxy’s page when CrowdSec can’t be read', screen: 'app:nginx-proxy-manager', mock: { protection: null }, run: async (page) => {
    await page.locator('#appStopped').getByText('CrowdSec can\'t be read right now: it and the proxy both need to be running.').waitFor({ timeout: 5000 });
  } },
  { name: 'Other apps’ pages have no CrowdSec card', screen: 'app:vikunja', run: async (page) => {
    await page.waitForSelector('#appUpdates', { timeout: 5000 });
    if (await page.locator('#appStopped').count()) throw new Error('Vikunja\'s page shows what CrowdSec stopped');
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
  // Shapes as well as colours: on Status a running app's dot is a circle, one that needs a look a triangle, one that is
  // down a cross, so the state reads without telling green from red, and still in forced colours (Windows' contrast
  // themes), where every dot is drawn in one colour.
  { name: 'Status: the dot of each state has its own shape, in forced colours too', screen: 'status', mock: { status: { ...status, apps: status.apps.map((a) => (a.id === 'vikunja' ? { ...a, health: 'unhealthy' } : a)) } }, run: async (page) => {
    await page.waitForSelector('#statusRows tr:has(strong:text-is("Vikunja")) .dot.bad', { timeout: 5000 });
    const shapes = () => page.evaluate(() => Object.fromEntries(['ok', 'warn', 'bad'].map((t) => {
      const d = document.querySelector(`#statusRows .dot.${t}`);
      return [t, d ? getComputedStyle(d).clipPath : 'missing'];
    })));
    for (const forced of ['none', 'active']) {
      await page.emulateMedia({ forcedColors: forced });
      const s = await shapes();
      if (s.ok !== 'none' || !s.warn.startsWith('polygon') || !s.bad.startsWith('polygon') || s.warn === s.bad) throw new Error(`forced colours ${forced}: ${JSON.stringify(s)}`);
    }
    await page.emulateMedia({ forcedColors: 'none' });
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
  // The update line above Settings is whole: its title and buttons are what a click lands on, not the sticky header's
  // blurred backdrop, which reaches up over what is above it on the desktop layout.
  { name: 'The update line above Settings is whole, not under its header', screen: 'settings', mock: { update }, run: async (page) => {
    await page.waitForSelector('#updateLine:not([hidden]) #updateNow', { timeout: 5000 });
    await page.waitForTimeout(300);
    const covered = await page.$$eval('#updateLine .head, #updateLine button, #updateLine a', (els) => els.filter((e) => {
      const r = e.getBoundingClientRect();
      return [[0.5, 0.5], [0.5, 0.85]].some(([fx, fy]) => { const at = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy); return !at || !e.contains(at); });
    }).map((e) => e.textContent.trim()));
    if (covered.length) throw new Error(`covered: ${covered.join(', ')}`);
  } },
  { name: 'A copy that cannot replace itself offers its download', screen: 'status', mock: { host: { ...host, os: 'Windows 11', machine: 'this machine' }, update: { state: 'blocked', version: '0.15.0', app: true, files: 0, blocked: 'This copy of the app cannot replace itself: download the new one', page: 'https://github.com/o/r/releases/tag/v0.15.0' } }, run: async (page) => {
    await page.click('#updateDownload', { timeout: 5000 });
    const opened = await page.evaluate(() => window.__MOCK.opened || '');
    if (!opened.includes('/releases/tag/v0.15.0')) throw new Error(`opened ${opened}`);
    await page.click('nav button[data-screen="settings"]');
    await page.waitForSelector('#hostInfo:has-text("Tray icon")');
  } },
  // On the Mac, where it was asked to try again before the new build was found again: the line is red, as a failure,
  // and Try again runs Update now (which reads the newest build itself), so it is not a line that only says what to do.
  { name: 'An update that did not install is red, and Try again runs the update', screen: 'choose', mock: { update: { state: '', files: 0, app: false, version: '0.16.42', notInstalled: 'The update to 0.16.42 did not install: the new build was not put in place. Install it by hand from its release page, or try again.', page: 'https://github.com/o/r/releases/latest' } }, run: async (page) => {
    await page.waitForSelector('#updateLine.failed .line.failed .head:has-text("did not install")', { timeout: 5000 });
    const bg = await page.$eval('#updateLine', (e) => getComputedStyle(e).backgroundColor);
    const soft = await page.evaluate(() => { const d = document.createElement('div'); d.style.background = 'var(--bad-soft)'; document.body.append(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; });
    if (bg !== soft) throw new Error(`the line's colour is ${bg}, not the failure's ${soft}`);
    await page.waitForSelector('#updateDownload');
    await page.click('#updateRetry');
    await page.waitForFunction(() => window.__MOCK.calls.UpdateNow >= 1, null, { timeout: 3000 });
  } },
  { name: 'An update that did not install says so and why, offers its download, and goes when closed', screen: 'status', mock: { host: { ...host, os: 'Windows 11', machine: 'this machine' }, update: { ...update, files: 0, notInstalled: 'The update to 0.15.0 did not install: Windows blocked the new build. Install it by hand from its release page, or try again.', page: 'https://github.com/o/r/releases/tag/v0.15.0' } }, run: async (page) => {
    await page.waitForSelector('#updateLine .line.failed .head:text-is("Homelab Wizard 0.15.0 did not install")', { timeout: 5000 });
    await page.waitForSelector('#updateLine .sub:has-text("Windows blocked the new build")');
    if (await page.$('#updateNow')) throw new Error('it offers Update now as if nothing happened');
    await page.waitForSelector('#updateRetry');
    await page.click('#updateDownload');
    const opened = await page.evaluate(() => window.__MOCK.opened || '');
    if (!opened.includes('/releases/tag/v0.15.0')) throw new Error(`opened ${opened}`);
    await page.click('#updateClose');
    await page.waitForSelector('#updateLine .head:text-is("Homelab Wizard 0.15.0 is ready")', { timeout: 5000 });
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
  // Quiet hours: an everyday setting on the Notifications page, named for people, the night it ships with.
  { name: 'Settings: quiet hours among the everyday ones', screen: 'settings', run: async (page) => {
    await page.click('#settingsNav .pagebtn[data-page="Notifications"]', { timeout: 5000 });
    const row = page.locator('#setting-QUIET_HOURS');
    await row.waitFor({ state: 'visible', timeout: 5000 });
    if (!(await row.textContent()).includes('Quiet hours (no sound at night)')) throw new Error(`its name: ${await row.textContent()}`);
    if ((await row.locator('input').inputValue()) !== '22-7') throw new Error(`its value: ${await row.locator('input').inputValue()}`);
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
  // Settings on the phone's page (#596's gap 6), as the iPhone app has them: the settings this phone may change, none
  // of its secrets nor what it connects through, Save on a phone allowed changes; nothing on a wall screen.
  { name: 'Settings on a phone that may change things: the everyday ones, saved', screen: 'status', phone: ['companion', 'can-change'], run: async (page) => {
    await page.click('nav button[data-screen="settings"]', { timeout: 5000 });
    // At a phone's width the pages are a list to pick from.
    await page.selectOption('#settingsNav select', 'Notifications', { timeout: 5000 });
    if ((await page.$$eval('#settingsNav option', (o) => o.map((x) => x.value))).some((v) => ['Appearance', 'People', 'Phones'].includes(v))) throw new Error("the computer's own pages on the phone");
    await page.fill('#setting-QUIET_HOURS input', '23-6');
    await page.click('#saveSettings:text-is("Save 1 change")', { timeout: 3000 });
    await page.waitForSelector('#saveSettings', { state: 'hidden', timeout: 5000 });
    if ((await page.evaluate(() => window.__MOCK.saved || {})).QUIET_HOURS !== '23-6') throw new Error('not saved');
    // Nothing a phone can't change or use: no secret, no setting it connects through, no Phones, People or Uninstall.
    for (const sel of ['#setting-CLOUDFLARE_API_TOKEN', '#setting-PHONE_COMPANION', '#phonesCard', '#peopleCard', '#uninstallCard', '#report']) {
      if (await page.isVisible(sel)) throw new Error(`${sel} on the phone`);
    }
    const refused = await page.evaluate(() => window.__MOCK.refused);
    if (refused.length) throw new Error('asked what a phone is refused: ' + refused.join(', '));
  } },
  { name: 'Settings on a phone that only looks: read, no Save', screen: 'status', phone: ['companion'], run: async (page) => {
    await page.click('nav button[data-screen="settings"]', { timeout: 5000 });
    await page.selectOption('#settingsNav select', 'Notifications', { timeout: 5000 });
    await page.waitForSelector('#setting-QUIET_HOURS', { timeout: 3000 });
    if (await page.isEnabled('#setting-QUIET_HOURS input')) throw new Error('a field to type in, on a phone that only looks');
    if (await page.isVisible('#saveSettings')) throw new Error('Save on a phone that only looks');
  } },
  { name: 'Settings is not on a wall screen', screen: 'status', phone: ['companion', 'kiosk'], run: async (page) => {
    await page.waitForSelector('#statusRows tr', { timeout: 5000 });
    if (await page.isVisible('nav button[data-screen="settings"]')) throw new Error('Settings on a wall screen');
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
      // The selected screen's mark is its bar (the outline is the focus's).
      nav: ((a) => a.display !== 'none' && a.forcedColorAdjust === 'none' && parseFloat(a.width) >= 3 ? 'bar' : 'none')(getComputedStyle(document.querySelector('nav button.active'), '::before')),
      dot: getComputedStyle(document.querySelector('.dot')).forcedColorAdjust,
    }));
    if (marks.nav !== 'bar' || marks.dot !== 'none') throw new Error(JSON.stringify(marks));
  } },
  { name: 'A homelab with no apps yet: Status says to choose some, with no empty list', screen: 'status', mock: { status: { ...status, apps: [], savings: 0 } }, run: async (page) => {
    await page.waitForSelector('#statusEmpty:has-text("No apps yet")', { timeout: 5000 });
    for (const sel of ['#tiles .tile', '#status table.grouped', '#statusAll']) if (await page.isVisible(sel)) throw new Error(`${sel} shows with no apps`);
    await page.click('#statusEmpty button:text-is("Choose apps")');
    await page.waitForSelector('#choose.screen.active', { timeout: 5000 });
  } },
  { name: 'Backups before the first night: no 0 of 0, and no restore test said to be proven', screen: 'backups', mock: { backups: { ...backups, lastRun: undefined, envCopied: undefined, stale: 0, paused: 0, copies: [], restoreTest: { history: [] } } }, run: async (page) => {
    await page.waitForSelector('#copiesTile .value:text-is("None yet")', { timeout: 5000 });
    await page.waitForSelector('#restoreTile .value:text-is("Never")');
    if (await page.isVisible('#restoreTile:has-text("Proven")')) throw new Error('a restore test that never ran is called proven');
  } },
  // An app's week says when it was last down, for how long, and why (the watchdog's outages), not "Missed checks on
  // Thursday": with two, how many times; with misses but no outage, that each passed the next time; from an older agent
  // with no outages, how many checks it didn't answer.
  ...[
    ['its last outage, and why', { vikunja: [{ from: dayAt(5, 14, 0), to: dayAt(5, 14, 30), problem: 'nothing answers on its port' }, { from: dayAt(3, 3, 10), to: dayAt(3, 3, 55), problem: 'HTTP 502' }] },
      (d) => `Last down ${d} at 3:10 AM for 45 minutes: HTTP 502 · 2 outages`],
    ['misses that passed the next time', {}, () => 'Each check it missed passed the next time'],
    ['from an older agent', undefined, (d, long) => `It didn't answer 3 of its checks on ${long}`],
  ].map(([what, outages, want]) => ({ name: `An app's week says ${what}`, screen: 'app:vikunja', mock: { ...pageMock, watchdog: { ...watchdog, ...(outages ? { outages } : {}) } }, run: async (page) => {
    const d = new Date(); d.setDate(d.getDate() - 3);
    const words = want(d.toLocaleDateString('en-US', { weekday: 'short' }), d.toLocaleDateString('en-US', { weekday: 'long' }));
    await page.waitForSelector(`.tile:has-text("This week"):has-text("${words}")`, { timeout: 5000 });
  } })),
  // A stopped app's week, with the watchdog running (Status's header says checks are on): not "once Setup turns it on",
  // but that the watchdog doesn't check it while it's stopped (Account 3's tester, task 2).
  { name: "A stopped app's week says it isn't checked while stopped, not to turn Setup on", screen: 'app:mealie', mock: { ...pageMock, watchdog }, run: async (page) => {
    await page.waitForSelector('.tile:has-text("This week"):has-text("The watchdog doesn\'t check it while it\'s stopped")', { timeout: 5000 });
    if (await page.isVisible('.tile:has-text("This week"):has-text("once Setup turns it on")')) throw new Error('it says to turn on what is on');
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
  // In a contrast theme the current screen's mark and the keyboard's focus must not look alike.
  ...[['Windows', 'Win32'], ['Mac', 'MacIntel']].map(([os, platform]) => ({ name: `${os} high contrast: the current screen and the focus look different in the sidebar`, screen: 'settings', mock: { platform }, run: async (page) => {
    await page.emulateMedia({ forcedColors: 'active' });
    const tabTo = async (sel) => { for (let i = 0; i < 40 && !(await page.evaluate((s) => document.activeElement.matches(s), sel)); i++) await page.keyboard.press('Tab'); await page.waitForTimeout(250); };
    // In view first: with every account listed under its group, the sidebar can run past the window, and scrolls.
    const shot = async () => { const r = await page.$eval('nav button.active', (e) => { e.scrollIntoView({ block: 'nearest' }); const b = e.getBoundingClientRect(); return { x: b.left - 4, y: b.top - 4, width: b.width + 8, height: b.height + 8 }; }); return page.screenshot({ clip: r }); };
    const plain = await shot();
    await tabTo('nav button[data-screen="backups"]');
    const elsewhere = await shot();
    await tabTo('nav button.active');
    const focused = await shot();
    if (focused.equals(elsewhere)) throw new Error('Settings looks the same with the focus on it and on Backups');
    if (!plain.equals(elsewhere)) throw new Error('Settings changes when the focus is on Backups');
    const mark = await page.$eval('nav button.active', (e) => { const a = getComputedStyle(e, '::before'); return a.display !== 'none' && parseFloat(a.width) >= 3 && a.forcedColorAdjust === 'none'; });
    if (!mark) throw new Error('the current screen has no bar of its own');
  } })),
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
  // Snooze an alert: a failing check's alerts wait an hour or a day; its line says until when, and Alert again now undoes it.
  // A phone allowed to change things snoozes the same way; one that only looks has no Snooze.
  { name: 'Watchdog: snooze a failing check for an hour, then alert again', screen: 'status', mock: { watchdog: { ...watchdog, failing: [{ name: 'crowdsec bouncer', problem: "the proxy's bouncer last pulled CrowdSec's decisions 9 minutes ago", since: hoursAgo(0.3) }] } }, run: async (page) => {
    const pick = '#watchCard select[aria-label="Snooze the alerts about crowdsec bouncer"]';
    await page.waitForSelector(pick, { timeout: 5000 });
    await page.selectOption(pick, '1');
    await page.waitForSelector('#watchCard li:has-text("crowdsec bouncer"):has-text("No alerts about it until")', { timeout: 5000 });
    if (!(await page.evaluate(() => window.__MOCK.calls.SnoozeCheck))) throw new Error('not snoozed');
    const shown = await page.locator(`${pick} option:checked, ${pick} option[value=""]`).first().innerText();
    if (!/^Snoozed until /.test(shown)) throw new Error(`the menu says: ${shown}`);
    await page.selectOption(pick, '0');
    await page.waitForFunction(() => !document.querySelector('#watchCard li')?.textContent?.includes('No alerts about it until'), null, { timeout: 5000 });
  } },
  { name: 'Watchdog on a phone that may change things: snooze a failing check for a day', screen: 'status', phone: ['companion', 'can-change'], mock: { watchdog: { ...watchdog, failing: [{ name: 'crowdsec bouncer', problem: 'no pull for 9 minutes', since: hoursAgo(0.3) }] } }, run: async (page) => {
    const pick = '#watchCard select[aria-label="Snooze the alerts about crowdsec bouncer"]';
    await page.waitForSelector(pick, { state: 'visible', timeout: 5000 });
    await page.selectOption(pick, '24');
    await page.waitForSelector('#watchCard li:has-text("crowdsec bouncer"):has-text("No alerts about it until")', { timeout: 5000 });
    if (!(await page.evaluate(() => window.__MOCK.calls.SnoozeCheck))) throw new Error('not snoozed');
  } },
  { name: 'Watchdog on a phone that only looks: a failing check, no Snooze', screen: 'status', phone: ['companion'], mock: { watchdog: { ...watchdog, failing: [{ name: 'crowdsec bouncer', problem: 'no pull for 9 minutes', since: hoursAgo(0.3) }] } }, run: async (page) => {
    await page.waitForSelector('#watchCard li:has-text("crowdsec bouncer")', { timeout: 5000 });
    if (await page.isVisible('#watchCard select.snoozepick')) throw new Error('Snooze on a phone that only looks');
  } },
  { name: 'Bans not enforced', screen: 'status', mock: { protection: { ...protection, enforced: false, bouncer: "the proxy's bouncer last pulled CrowdSec's decisions 9 minutes ago" } }, run: async (page) => {
    await page.waitForSelector('#protectCard:has-text("Bans not enforced")', { timeout: 5000 });
    await page.waitForSelector('#protectCard:has-text("new attackers are not blocked")');
    await page.click('#protectFix');
    await page.waitForSelector('#cliTitle:has-text("Fix it")', { timeout: 5000 });
  } },
  // Memory nearly full: while the watchdog's alert stands (health.StepMemory), its card lists the biggest apps,
  // each with Stop; one the catalog does not know has none, and a phone that only looks shows none.
  { name: 'Memory nearly full: the biggest apps, each with Stop', screen: 'status', mock: { watchdog: { ...watchdog, memory: memoryHigh } }, run: async (page) => {
    await page.waitForSelector('#watchCard #memoryPressure:has-text("the apps use 94% of the 8.0 GB Docker has")', { timeout: 5000 });
    const rows = await page.locator('#memoryPressure li').allInnerTexts();
    if (rows.length !== 3 || !/Immich/.test(rows[0]) || !/2\.5 GB/.test(rows[0]) || !/900 MB/.test(rows[2])) throw new Error(`rows: ${JSON.stringify(rows)}`);
    if (await page.locator('#memoryPressure li:has-text("someones-own") button').count()) throw new Error('Stop on a container the catalog does not know');
    await page.click('#memoryPressure button[aria-label="Stop Immich"]');
    await page.waitForFunction(() => window.__MOCK.calls.AppAction === 1, null, { timeout: 5000 });
  } },
  { name: 'Memory nearly full on a phone that only looks: no Stop', screen: 'status', phone: ['companion'], mock: { watchdog: { ...watchdog, memory: memoryHigh } }, run: async (page) => {
    await page.waitForSelector('#memoryPressure li:has-text("Immich")', { timeout: 5000 });
    if (await page.isVisible('#memoryPressure button.memstop')) throw new Error('a phone that only looks may stop an app');
  } },
  // Health in one line: at the top of every screen but Status, the one thing that needs you, or All well.
  { name: 'Health in one line: on Backups the one app that needs a look, and Open Status', screen: 'backups', run: async (page) => {
    await page.waitForSelector('#oneLine.trouble:has-text("Mealie: Stopped")', { timeout: 5000 });
    await page.click('#oneOpen');
    await page.waitForSelector('#status.active', { timeout: 3000 });
    if (await page.isVisible('#oneLine')) throw new Error('the line shows on Status too');
    await page.click('nav button[data-screen="settings"]');
    await page.waitForSelector('#settings.active', { timeout: 5000 });
    await page.waitForSelector('#oneLine:has-text("Mealie: Stopped")', { timeout: 5000 });
  } },
  { name: 'Health in one line: All well, and several apps in one line', screen: 'settings', mock: { status: { ...status, apps: status.apps.filter((a) => a.state === 'running' && !['unhealthy', 'restarting'].includes(a.health) && !a.notAnswering) } }, run: async (page) => {
    await page.waitForSelector('#oneLine:not(.trouble):has-text("All well")', { timeout: 5000 });
    await page.evaluate(() => window.__emit('status:changed', { status: { ...window.__MOCK.status, apps: window.__MOCK.status.apps.map((a, i) => (i < 4 ? { ...a, health: 'unhealthy' } : a)) } }));
    await page.waitForSelector('#oneLine.trouble:has-text("4 apps need a look:"):has-text("and 2 more")', { timeout: 5000 });
  } },
  { name: 'Health in one line: a failing check that is no app’s', screen: 'backups', mock: { status: { ...status, apps: status.apps.filter((a) => a.state === 'running' && !['unhealthy', 'restarting'].includes(a.health) && !a.notAnswering) }, watchdog: { ...watchdog, failing: [{ name: 'crowdsec bouncer', problem: 'no pull for 9 minutes', since: hoursAgo(0.3) }] } }, run: async (page) => {
    await page.waitForSelector('#oneLine.trouble:has-text("The watchdog’s check of crowdsec bouncer is failing"), #oneLine.trouble:has-text("check of crowdsec bouncer is failing")', { timeout: 5000 });
  } },
  { name: 'Watchdog not run yet', screen: 'status', mock: { watchdog: null }, run: async (page) => {
    await page.waitForSelector('#watchCard:has-text("once the jobs are installed")', { timeout: 5000 });
  } },
  // The owner, Nov 12: Dashboard cards they can move and size ("maybe resize them"); the mockup's artboard 5 was a yes,
  // kept per device. Arrange the Dashboard: ▲ ▼ move a card, ⅓ ½ Full set its width, Hide puts it below; kept after a
  // reload; Reset puts the usual board back.
  { name: 'Finances: the Dashboard is arranged, kept on this device, and Reset', screen: 'finances', run: async (page) => {
    const ids = () => page.$$eval('#finRoot .fx-board.arranged > .fx-slot', (l) => l.filter((x) => x.querySelector('.card')).map((x) => x.dataset.card));
    await page.click('#finRoot button:text-is("Arrange the Dashboard")', { timeout: 5000 });
    await page.waitForSelector('#finRoot .fx-board.arranged.editing .fx-slot[data-card="networth"] .fx-slotbar', { timeout: 5000 });
    const before = await ids();
    await page.click('#finRoot .fx-slot[data-card="networth"] button[aria-label="Move Net worth up"]');
    const moved = await ids();
    if (moved.indexOf('networth') !== before.indexOf('networth') - 1) throw new Error(`Net worth didn't move up: ${before.join(' ')} → ${moved.join(' ')}`);
    await page.click('#finRoot .fx-slot[data-card="cashflow"] .fx-widths button:has-text("Full")');
    const wide = await page.evaluate(() => { const s = document.querySelector('#finRoot .fx-slot[data-card="cashflow"]'), b = document.querySelector('#finRoot .fx-board.arranged'); return s.className.includes('w-full') && s.getBoundingClientRect().width > b.getBoundingClientRect().width - 2; });
    if (!wide) throw new Error('Cash flow is not the whole row');
    await page.click('#finRoot .fx-slot[data-card="spent"] button:has-text("Hide")');
    await page.waitForSelector('#finRoot .fx-hiddencards button:has-text("+ Spent this month")', { timeout: 3000 });
    if ((await ids()).includes('spent')) throw new Error('Spent this month still shows');
    await page.click('#finRoot button:text-is("Done")');
    if (await page.locator('#finRoot .fx-slotbar').count()) throw new Error('the bars stayed after Done');
    // Kept on this device: after a reload, as it was left. What the page kept is carried over by hand, as the
    // quitting case does: a reloaded file:// page in this browser can start with empty storage when the machine is
    // busy (a second's wait still lost it, Nov 13 on #678), so the board came back unarranged.
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    if (!JSON.parse(stored)['homelab.finances.layout']) throw new Error('the layout was not kept on this device');
    await page.addInitScript((k) => { for (const [key, value] of Object.entries(JSON.parse(k))) localStorage.setItem(key, value); }, stored);
    await page.reload();
    await page.waitForSelector('#finRoot .fx-board.arranged .fx-slot[data-card="networth"] .card', { timeout: 5000 });
    const kept = await ids();
    if (kept.includes('spent') || kept.join(' ') !== moved.filter((id) => id !== 'spent').join(' ')) throw new Error(`not kept: ${kept.join(' ')}, was ${moved.join(' ')}`);
    await page.click('#finRoot button:text-is("Arrange the Dashboard")');
    await page.click('#finRoot button:text-is("Reset to the usual")');
    await page.click('#finRoot button:text-is("Done")');
    await page.waitForSelector('#finRoot .fx-board:not(.arranged) .fx-widget', { timeout: 3000 });
    if (await page.evaluate(() => localStorage.getItem('homelab.finances.layout'))) throw new Error('Reset kept the layout');
  } },
  { name: 'The phone: the Dashboard has no Arrange, and stacks as before', screen: 'finances', phone: ['companion', 'finances'], run: async (page) => {
    await page.waitForSelector('#finances.active .fx-board .fx-widget', { timeout: 5000 });
    if (await page.locator('#finRoot button:text-is("Arrange the Dashboard"), #finRoot .fx-board.arranged').count()) throw new Error('the phone offers Arrange');
  } },
  // A household member's private Finances on her phone's page (private-finances.md, step 3; mock.js's M.person):
  // turned on with Face ID's passkey, her recovery code shown once and two of its words typed back; then the
  // computer keeps only what it can't open, her Finances drawn from the phone's own projection, Lock drops them,
  // and Face ID or the recovery code opens them again. Nothing plain is left in the page's storage.
  ...[['with Face ID', { passkey: true }], ['with a passphrase, where the passkey can’t lock them', { passkey: 'noprf' }]].map(([how, extra]) => ({ name: `Private Finances on a member’s phone: made private ${how}, locked, opened again`, screen: 'finances', phone: ['companion', 'finances'], mock: { person: 'anna', ...extra }, run: async (page) => {
    const words = await makePrivate(page, extra.passkey === 'noprf' ? 'correct horse battery' : '');
    const m = await page.evaluate(() => ({ sealed: JSON.stringify(window.__MOCK.sealed || null), removed: window.__MOCK.plainRemoved, made: window.__MOCK.passkeyMade }));
    if (!m.removed || m.sealed === 'null' || /Chase|Checking|cushion/.test(m.sealed)) throw new Error('the computer was given her plain Finances, or kept them: ' + m.sealed.slice(0, 200));
    if (extra.passkey === true && m.made !== 1) throw new Error('no passkey was made for Face ID');
    // Her Finances, from the phone's projection, while the plain calls are refused.
    await page.waitForSelector('#finances.active #finRoot:not([hidden]) .fx-board .fx-widget', { timeout: 5000 });
    if (await page.locator('#finRoot :text("are private: they open")').count()) throw new Error('the plain refusal is shown');
    await page.click('#finPrivateOpen button:text-is("Lock")');
    await page.waitForSelector('#finPrivateLocked', { timeout: 3000 });
    if (await page.locator('#finRoot').isVisible()) throw new Error('locked, but Finances still show');
    const kept = await keptInPage(page);
    if (/Chase|cushion|anna|"plan"/.test(kept.all) || kept.dbs.some((d) => d !== 'homelab-private') || /Chase|cushion|"plan"|Made-up/.test(kept.sealed)) throw new Error('something plain is kept in the page: ' + JSON.stringify(kept).slice(0, 300));
    if (!/"envelope"/.test(kept.sealed) || JSON.parse(kept.sealed).key) throw new Error('the sealed copy for offline is not kept, or a key is kept with it: ' + kept.sealed.slice(0, 200));
    if (extra.passkey === true) {
      await page.click('#finPrivateLocked button:text-is("Unlock with Face ID")');
    } else {
      await page.fill('#finPrivateLocked input[type=password]', 'correct horse batter');
      await page.click('#finPrivateLocked button:text-is("Unlock")');
      await page.waitForSelector('#finPrivateLocked [role=alert]:has-text("That passphrase doesn’t open")', { timeout: 8000 });
      await page.fill('#finPrivateLocked input[type=password]', 'correct horse battery');
      await page.click('#finPrivateLocked button:text-is("Unlock")');
    }
    await page.waitForSelector('#finPrivateOpen', { timeout: 8000 });
    await page.waitForSelector('#finRoot:not([hidden]) .fx-board .fx-widget', { timeout: 5000 });
    // Another screen picked locks them; the recovery code opens them too, and a wrong one is refused in plain words.
    await page.click('nav button[data-screen="status"]');
    await page.click('nav button[data-screen="finances"]');
    await page.waitForSelector('#finPrivateLocked', { timeout: 3000 });
    await page.click('#finPrivateLocked button:text-is("Use your recovery code")');
    await page.fill('#finPrivateWords', [...words.slice(1), words[0]].join(' '));
    await page.click('#finPrivateLocked button:text-is("Unlock")');
    await page.waitForSelector('#finPrivateLocked [role=alert]:has-text("That recovery code doesn’t open these Finances")', { timeout: 8000 });
    await page.fill('#finPrivateWords', words.join(' ').toUpperCase());
    await page.click('#finPrivateLocked button:text-is("Unlock")');
    await page.waitForSelector('#finPrivateOpen', { timeout: 8000 });
  } })),
  // A change saved while private is sealed again on the phone: the computer gets a new envelope, never the plan; when
  // another of her devices saved first, the save is refused in plain words and hers is shown again.
  { name: 'Private Finances: a change is kept sealed, and one made elsewhere first is said plainly', screen: 'finances', phone: ['companion', 'finances'], mock: { person: 'anna', passkey: true }, run: async (page) => {
    await makePrivate(page, '');
    const save = (cushion) => page.evaluate(async (c) => {
      const v = await window.go.main.App.Finances();
      try { const w = await window.go.main.App.SaveFinances({ ...v.plan, cushion: c }); return { cushion: w.plan.cushion, rev: w.plan.rev }; } catch (e) { return { error: String(e.message) }; }
    }, cushion);
    const before = await page.evaluate(() => window.__MOCK.sealedRev);
    const was = await page.evaluate(() => window.__MOCK.sealed.sealed);
    const r = await save(777);
    const m = await page.evaluate(() => ({ rev: window.__MOCK.sealedRev, saved: window.__MOCK.financesSaved, sealed: window.__MOCK.sealed.sealed }));
    if (r.cushion !== 777 || r.rev !== m.rev || m.rev === before || m.saved || m.sealed === was) throw new Error('the change was not kept sealed: ' + JSON.stringify({ r, before, rev: m.rev, saved: m.saved }));
    await page.evaluate(() => { window.__MOCK.sealedConflict = true; });
    const c = await save(888);
    if (!/changed on another of your devices after this was read/.test(c.error || '')) throw new Error('a save another device beat was not said plainly: ' + JSON.stringify(c));
  } },
  // What the household shares with her (FinancesShared): read-only, beside her own, and still there while hers are
  // locked, as it is the household's and never sealed with hers.
  { name: 'A member’s phone: what the household shares shows read-only, locked or not', screen: 'finances', phone: ['companion', 'finances'], mock: { person: 'anna', passkey: true, shared: householdShared }, run: async (page) => {
    const card = page.locator('#finShared');
    await card.locator(':text("Shared with you")').waitFor({ timeout: 5000 });
    for (const t of ['Coming up', 'Made-up Power', 'Subscriptions', 'Made-up Stream', 'Budgets this month', 'Groceries', '$400 left']) {
      if (!(await card.locator(`:text("${t}")`).count())) throw new Error('the household card has no ' + t);
    }
    if (await card.locator('button, input, a').count()) throw new Error('the household card offers a change');
    await makePrivate(page, '');
    await page.click('#finPrivateOpen button:text-is("Lock")');
    await page.waitForSelector('#finPrivateLocked', { timeout: 3000 });
    if (!(await card.locator(':text("Made-up Power")').isVisible())) throw new Error('locked, the household card went too');
  } },
  { name: 'A member’s phone with nothing shared: no household card', screen: 'finances', phone: ['companion', 'finances'], mock: { person: 'anna' }, run: async (page) => {
    await page.waitForSelector('#finances.active .fx-board .fx-widget', { timeout: 5000 });
    await page.waitForTimeout(300);
    if (await page.locator('#finShared .fx-household').count()) throw new Error('a household card with nothing shared');
  } },
  // Privacy turned off from her phone, after she confirms: her plan and ledger kept plain again, a sealed receipt
  // opened on the phone and kept plain, the ledger naming it; then the offer to make them private comes back.
  { name: 'Private Finances: turned off from her phone, receipts and all, after she confirms', screen: 'finances', phone: ['companion', 'finances'], mock: { person: 'anna', passkey: true, ledger: { rev: 'l1', transactions: [{ id: 't1', date: '2026-11-02', payee: 'Made-up Grocer', amount: -42.17, receipt: '0'.repeat(31) + '9.jpg' }] }, receipts: { ['0'.repeat(31) + '9.jpg']: 'data:image/jpeg;base64,AAAA' } }, run: async (page) => {
    await makePrivate(page, '');
    const sealed = await page.evaluate(() => Object.values(window.__MOCK.sealedReceipts || {}));
    if (sealed.length !== 1 || sealed[0].includes('AAAA')) throw new Error('the receipt was not sealed: ' + JSON.stringify(sealed));
    await page.click('#finPrivateOpen button:text-is("Turn privacy off…")');
    const ask = page.locator('#finPrivateOff');
    await ask.locator(':text("the person who runs it can read them")').waitFor({ timeout: 3000 });
    if (await page.evaluate(() => window.__MOCK.unsealed)) throw new Error('turned off before she confirmed');
    await ask.locator('button:text-is("Cancel")').click();
    await page.waitForSelector('#finPrivateOpen', { timeout: 3000 });
    await page.click('#finPrivateOpen button:text-is("Turn privacy off…")');
    await page.click('#finPrivateOff button:text-is("Turn privacy off")');
    await page.waitForSelector('#finPrivateOn button:text-is("Make them private…")', { timeout: 8000 });
    const m = await page.evaluate(() => ({ sealed: window.__MOCK.sealed, unsealed: window.__MOCK.unsealed, ledger: window.__MOCK.ledger, saved: window.__MOCK.receiptsSaved }));
    if (m.sealed || !m.unsealed) throw new Error('privacy is still on');
    const t = m.ledger.transactions.find((x) => x.id === 't1');
    if (!t || !/^[0-9a-f]{32}\.jpg$/.test(t.receipt || '') || (m.saved || []).at(-1) !== 'data:image/jpeg;base64,AAAA') throw new Error('the receipt did not come back plain: ' + JSON.stringify({ t, saved: m.saved }));
    await page.waitForSelector('#finRoot:not([hidden]) .fx-board .fx-widget', { timeout: 5000 });
  } },
  // Offline (2E step 6, the page's half): her phone keeps only the sealed copy (IndexedDB), opens it with no
  // connection, keeps a change on the phone and sends it when the homelab answers again.
  { name: 'Private Finances offline: opened with no connection, a change kept and sent when home again', screen: 'finances', phone: ['companion', 'finances'], mock: { person: 'anna', passkey: true }, run: async (page) => {
    const words = await makePrivate(page, '');
    await page.click('#finPrivateOpen button:text-is("Lock")');
    // The page opened afresh away from home: no answer from the computer, nor from /api/me.
    const m = await page.evaluate(() => ({ sealed: window.__MOCK.sealed, sealedRev: window.__MOCK.sealedRev, sealedSaves: window.__MOCK.sealedSaves }));
    await page.evaluate((m) => sessionStorage.setItem('mock.next', JSON.stringify({ ...m, away: true, meAway: true })), m);
    await page.reload();
    await page.evaluate(() => document.documentElement.classList.add('preview', 'companion', 'finances'));
    await page.click('nav button[data-screen="finances"]');
    await page.waitForSelector('#finPrivateLocked', { timeout: 5000 });
    await page.click('#finPrivateLocked button:text-is("Use your recovery code")');
    await page.fill('#finPrivateWords', words.join(' '));
    await page.click('#finPrivateLocked button:text-is("Unlock")');
    await page.waitForSelector('#finPrivateOpen :text("Offline")', { timeout: 8000 });
    await page.waitForSelector('#finRoot:not([hidden]) .fx-board .fx-widget', { timeout: 5000 });
    const before = await page.evaluate(() => window.__MOCK.sealedRev);
    const r = await page.evaluate(async () => { const v = await window.go.main.App.Finances(); const w = await window.go.main.App.SaveFinances({ ...v.plan, cushion: 777 }); return w.plan.cushion; });
    if (r !== 777) throw new Error('the change was not kept on the phone');
    await page.waitForSelector('#finPrivateOpen :text("1 change waits for the homelab")', { timeout: 3000 });
    if ((await page.evaluate(() => window.__MOCK.sealedRev)) !== before) throw new Error('saved while away?');
    const kept = await keptInPage(page);
    // What's readable in it: its keys, numbers and plain strings, not what's sealed (base64) nor when it was read
    // (a time ending .777 matched "777" by chance, Nov 13 on #686).
    const readable = (json) => { const out = []; const walk = (v) => {
      if (typeof v === 'string') { if (!/^[A-Za-z0-9+/=]+$/.test(v) && !/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(v)) out.push(v); }
      else if (typeof v === 'number') out.push(String(v));
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.push(k); walk(x); }
    }; walk(JSON.parse(json)); return out.join(' '); };
    if (!/"pending"/.test(kept.sealed) || /cushion|777|Made-up/.test(readable(kept.sealed))) throw new Error('the waiting change is not kept sealed: ' + readable(kept.sealed).slice(0, 300));
    // Home again: sent by itself, and the line goes.
    await page.evaluate(() => { window.__MOCK.away = false; window.dispatchEvent(new Event('online')); });
    await page.waitForFunction((b) => window.__MOCK.sealedRev !== b, before, { timeout: 5000 });
    await page.waitForSelector('#finPrivateOpen:not(:has-text("Offline"))', { timeout: 5000 });
    if (/"pending"/.test((await keptInPage(page)).sealed)) throw new Error('the change sent still waits');
  } },
  { name: 'Private Finances offline: a change another device made meanwhile is said plainly when home again', screen: 'finances', phone: ['companion', 'finances'], mock: { person: 'anna', passkey: true }, run: async (page) => {
    await makePrivate(page, '');
    await page.evaluate(() => { window.__MOCK.away = true; });
    await page.evaluate(async () => { const v = await window.go.main.App.Finances(); await window.go.main.App.SaveFinances({ ...v.plan, cushion: 777 }); });
    await page.waitForSelector('#finPrivateOpen :text("1 change waits for the homelab")', { timeout: 3000 });
    await page.evaluate(() => { window.__MOCK.sealedRev = 'sealed-elsewhere'; window.__MOCK.away = false; window.dispatchEvent(new Event('online')); });
    await page.waitForSelector('#finPrivate [role=alert]:has-text("While you were away, your Finances were changed on another of your devices")', { timeout: 5000 });
    if (/"pending"/.test((await keptInPage(page)).sealed)) throw new Error('the beaten change still waits');
  } },
  // Turned off: the sealed copy goes from the phone too.
  { name: 'Private Finances: turned off, nothing kept on the phone', screen: 'finances', phone: ['companion', 'finances'], mock: { person: 'anna', passkey: true }, run: async (page) => {
    await makePrivate(page, '');
    await page.click('#finPrivateOpen button:text-is("Turn privacy off…")');
    await page.click('#finPrivateOff button:text-is("Turn privacy off")');
    await page.waitForSelector('#finPrivateOn button:text-is("Make them private…")', { timeout: 8000 });
    const kept = await keptInPage(page);
    if (kept.sealed !== 'null') throw new Error('the sealed copy is still kept: ' + kept.sealed.slice(0, 100));
  } },
  // Her own phone that may only look gets no offer to make them private; the owner's phone neither.
  ...[['a member’s phone that only looks', { person: 'anna', phoneFinances: 'view' }], ['the owner’s phone', {}]].map(([who, m]) => ({ name: `Private Finances: no offer on ${who}`, screen: 'finances', phone: ['companion', 'finances'], mock: m, run: async (page) => {
    await page.waitForSelector('#finances.active .fx-board .fx-widget', { timeout: 5000 });
    if (await page.locator('#finPrivate .fx-private').count()) throw new Error('offered to make them private');
  } })),
  // The owner, Nov 12: clicking an account on Net worth opened the form to update its balance and logo. It opens the
  // account's own page: its balance and a chart of it, its latest transactions, and Update balance and Edit as buttons;
  // Back goes back to Net worth.
  { name: 'Finances: an account opens its own page, with its chart and latest transactions', screen: 'finances', run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await page.click('#finRoot .finbody li:has(strong:text-is("Chase Checking")) .rowopen', { timeout: 5000 });
    const acct = page.locator('#finRoot .fx-account');
    await acct.locator('h2:text-is("Chase Checking")').waitFor({ timeout: 5000 });
    if (await page.locator('#finSheet:not([hidden])').count()) throw new Error('the balance form opened instead of the page');
    const seg = await page.textContent('#finRoot > .seg button[aria-checked="true"]');
    if (seg !== 'Net worth') throw new Error(`the tab shown is ${seg}`);
    for (const b of ['Update balance', 'Edit']) if (!(await acct.locator(`button:text-is("${b}")`).count())) throw new Error(`no ${b}`);
    if (!(await acct.locator('figure.fx-area[aria-label*="Chase Checking"]').count())) throw new Error('no chart of its balance');
    const rows = await acct.locator('.fx-acctlatest li').count();
    if (rows < 3) throw new Error(`${rows} latest transactions`);
    // Edit opens its form, as the row used to.
    await acct.locator('button:text-is("Edit")').click();
    await page.waitForSelector('#finSheet:not([hidden])', { timeout: 5000 });
    await page.keyboard.press('Escape');
    // All of them: Transactions, that account picked.
    await acct.locator('button:has-text("All of them")').click();
    await page.waitForSelector('#finRoot .fx-subtabs .seg button[aria-checked="true"]:text-is("Transactions")', { timeout: 5000 });
    const picked = await page.evaluate(() => [...document.querySelectorAll('#finRoot select')].map((s) => s.selectedOptions[0]?.textContent || '').join('|'));
    if (!picked.includes('Chase Checking')) throw new Error(`Transactions opened on ${picked}`);
    // Back: the account's page, then Net worth.
    await page.keyboard.press('Meta+BracketLeft');
    await acct.locator('h2:text-is("Chase Checking")').waitFor({ timeout: 3000 });
    await page.keyboard.press('Meta+BracketLeft');
    await page.waitForSelector('#finRoot .finbody li:has(strong:text-is("Chase Checking")) .rowopen', { timeout: 3000 });
  } },
  // The owner, Nov 12: their share of the mortgage goes as a Zelle payment to the person they share it with, and the
  // loan's page should say what's left, and link those payments to it. A loan's page: its share still owed, its
  // payment each month, rate and payoff; the payments linked to it; one over the plan's payment asked about each
  // time (the owner's pick); Link a payment… links another, and the same payee's next ones are offered by themselves.
  { name: 'Finances: a loan’s page lists the payments linked to it, and links another', screen: 'finances', mock: { ledger: { ...ledger, transactions: [...ledger.transactions,
    { id: 'z1', date: '2026-10-01', account: 'chk', amount: -1845, payee: 'Zelle to Sam', category: 'Housing', payment: 'mortgagepay' },
    { id: 'z2', date: '2026-09-01', account: 'chk', amount: -1945, payee: 'Zelle to Sam', category: 'Housing', payment: 'mortgagepay' },
    { id: 'z3', date: '2026-10-29', account: 'chk', amount: -1845, payee: 'Zelle to Sam', category: 'Housing' }] } }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await page.click('#finRoot .fx-owelist .rowopen:has(strong:text-is("Mortgage"))', { timeout: 5000 });
    const loan = page.locator('#finRoot .fx-account .fx-loan');
    await loan.waitFor({ timeout: 5000 });
    const facts = await loan.locator('.fx-loanfacts').textContent();
    for (const w of ['$1,845.00', 'Paid off']) if (!facts.includes(w)) throw new Error(`the loan's facts: ${facts}`);
    const linked = page.locator('#finRoot .fx-loanlinked');
    await linked.locator('li:has-text("Oct 1")').waitFor({ timeout: 5000 });
    // $100 over the plan's payment: asked about, with Count it and Not this one.
    const over = linked.locator('li:has-text("Sep 1")');
    if (!(await over.textContent()).includes('$100.00 more')) throw new Error(`the one over: ${await over.textContent()}`);
    await over.locator('button:text-is("Count it")').click();
    await page.waitForFunction(() => (window.__MOCK.ledgerSaved || []).length === 1, null, { timeout: 5000 });
    const saved = await page.evaluate(() => window.__MOCK.ledgerSaved[0].transactions.find((t) => t.id === 'z2'));
    if (!saved.extra || saved.payment !== 'mortgagepay') throw new Error(`Count it saved ${JSON.stringify(saved)}`);
    await page.waitForFunction(() => !document.querySelector('#finRoot .fx-loanlinked li button[aria-label*="Count it"], #finRoot .fx-loanlinked li:has(button) .fx-loanask'), null, { timeout: 5000 }).catch(() => {});
    // The Zelle on Oct 29 isn't linked: offered, from the same payee as the linked ones; Link links it.
    const offer = page.locator('#finRoot .fx-loanoffer li:has-text("Oct 29")');
    await offer.waitFor({ timeout: 5000 });
    await offer.locator('button:text-is("Link")').click();
    await page.waitForFunction(() => (window.__MOCK.ledgerSaved || []).length === 2, null, { timeout: 5000 });
    const z3 = await page.evaluate(() => window.__MOCK.ledgerSaved[1].transactions.find((t) => t.id === 'z3'));
    if (z3.payment !== 'mortgagepay') throw new Error(`Link saved ${JSON.stringify(z3)}`);
    // Link a payment…: the outgoing ones not linked to anything, each with Link.
    await page.click('#finRoot .fx-loanlinked button:text-is("Link a payment…")');
    await page.waitForSelector('#finRoot .fx-loanpick li:has-text("Trader Joe")', { timeout: 5000 });
  } },
  { name: 'The phone, view only: an account’s page has nothing to change', screen: 'finances', phone: ['companion', 'finances'], mock: { finances: { ...finances, readOnly: true } }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await page.click('#finRoot .finbody li:has(strong:text-is("Chase Checking")) .rowopen', { timeout: 5000 });
    const acct = page.locator('#finRoot .fx-account');
    await acct.locator('h2:text-is("Chase Checking")').waitFor({ timeout: 5000 });
    if (await acct.locator('button:text-is("Edit"), button:text-is("Update balance")').count()) throw new Error('a view-only phone can change it');
    if (!(await acct.locator('.fx-acctlatest li').count())) throw new Error('no latest transactions');
  } },
  // Back and Forward between screens, as a browser has them (the owner, Nov 11): ⌘[ and ⌘], an app's page coming back
  // with its app, and a two-finger swipe on a trackpad (sideways wheel), right for Back, left for Forward.
  { name: 'Back and Forward between screens: ⌘[ and ⌘], and a two-finger swipe', screen: 'status', run: async (page) => {
    const on = () => page.evaluate(() => document.querySelector('.screen.active')?.id);
    await page.click('nav button[data-screen="backups"]');
    await page.click('nav button[data-screen="finances"]');
    await page.keyboard.press('Meta+BracketLeft');
    if ((await on()) !== 'backups') throw new Error(`Back went to ${await on()}`);
    await page.keyboard.press('Meta+BracketLeft');
    if ((await on()) !== 'status') throw new Error(`Back again went to ${await on()}`);
    await page.keyboard.press('Meta+BracketRight');
    if ((await on()) !== 'backups') throw new Error(`Forward went to ${await on()}`);
    // An app's page comes back with its own app.
    await page.click('nav button[data-screen="status"]');
    await page.click('#statusRows tr:has(strong:text-is("Vikunja")) td.appname a, #statusRows tr:has(strong:text-is("Vikunja")) strong', { timeout: 5000 });
    await page.waitForSelector('#app.active h1:has-text("Vikunja")', { timeout: 5000 });
    await page.click('nav button[data-screen="settings"]');
    await page.keyboard.press('Meta+BracketLeft');
    await page.waitForSelector('#app.active h1:has-text("Vikunja")', { timeout: 5000 });
    // A two-finger swipe: fingers to the right (the page moves left) is Back; to the left, Forward.
    await page.mouse.move(640, 400);
    for (let i = 0; i < 6; i++) await page.mouse.wheel(-60, 0);
    await page.waitForFunction(() => document.querySelector('.screen.active')?.id === 'status', null, { timeout: 3000 });
    await page.waitForTimeout(400);
    for (let i = 0; i < 6; i++) await page.mouse.wheel(60, 0);
    await page.waitForSelector('#app.active h1:has-text("Vikunja")', { timeout: 3000 });
  } },
  // The owner, Nov 12: Back from Finances' Recurring or Spending went straight to Status. Back steps through the tabs a
  // screen was on (Finances' and Tidy Up's), then to the screen before it; Forward steps back through them again.
  { name: 'Back and Forward step through a screen’s tabs before leaving it', screen: 'status', run: async (page) => {
    const on = () => page.evaluate(() => document.querySelector('.screen.active')?.id);
    const finOn = () => page.evaluate(() => [...document.querySelectorAll('#finRoot .seg button[aria-pressed="true"], #finRoot .seg button.on, #finRoot .seg button[aria-checked="true"]')].map((b) => b.textContent.trim()).join(' › '));
    await page.click('nav button[data-screen="finances"]');
    await page.waitForSelector('#finRoot > .seg', { timeout: 5000 });
    await finTab(page, 'Transactions');
    await finTab(page, 'Recurring');
    const where = await finOn();
    await page.keyboard.press('Meta+BracketLeft');
    if ((await on()) !== 'finances') throw new Error(`Back from Recurring left Finances for ${await on()}`);
    // Plan opened on its first page, Calendar: a step of its own, as a browser has it.
    const back0 = await finOn();
    if (!back0.includes('Calendar')) throw new Error(`Back from Recurring (${where}) went to ${back0}`);
    await page.keyboard.press('Meta+BracketLeft');
    const back1 = await finOn();
    if (!back1.includes('Spending') || !back1.includes('Transactions')) throw new Error(`Back from Calendar went to ${back1}`);
    await page.keyboard.press('Meta+BracketLeft');
    if ((await on()) !== 'finances' || !(await finOn()).includes('Dashboard')) throw new Error(`Back again went to ${await on()}: ${await finOn()}`);
    await page.keyboard.press('Meta+BracketLeft');
    if ((await on()) !== 'status') throw new Error(`Back a third time went to ${await on()}`);
    for (let i = 0; i < 4; i++) await page.keyboard.press('Meta+BracketRight');
    if ((await on()) !== 'finances' || !(await finOn()).includes('Recurring')) throw new Error(`Forward four times: ${await on()}: ${await finOn()}`);
    // Tidy Up's tabs too.
    await page.click('nav button[data-screen="tidy"]');
    await page.click('#tidy .seg button:text-is("Music")', { timeout: 5000 });
    await page.click('#tidy .seg button:text-is("Books")');
    await page.keyboard.press('Meta+BracketLeft');
    await page.waitForSelector('#tidy.active .seg button[aria-pressed="true"]:text-is("Music"), #tidy.active .seg button.on:text-is("Music"), #tidy.active .seg button[aria-checked="true"]:text-is("Music")', { timeout: 3000 });
  } },
  { name: 'Healthy categories fold into their headings', screen: 'status', mock: { statusOpen: '' }, run: async (page) => {
    await page.waitForSelector('#statusRows tr.grouphead.fold:has-text("Security"):has-text("running ✓")', { timeout: 5000 });
    if (await page.isVisible('#statusRows tr:has(strong:text-is("Vaultwarden"))')) throw new Error('a healthy category is open');
    await page.click('#statusRows tr.grouphead.fold:has-text("Security")');
    await page.waitForSelector('#statusRows tr:has(strong:text-is("Vaultwarden"))', { timeout: 5000 });
    await page.click('#statusAll');
    await page.waitForSelector('#statusRows tr:has(strong:text-is("Navidrome"))', { timeout: 5000 });
  } },
  // The folds are the computer's, the same on every device (the owner, Nov 10): a group another device opened shows open
  // here though it's healthy; opening or folding one here saves it there; Show every app is this device's own and saves
  // nothing; Fold them again puts every device back to the defaults.
  { name: 'Status folds are kept by the computer, the same on every device', screen: 'status', mock: { statusOpen: '', statusFolds: { Security: true } }, run: async (page) => {
    await page.waitForSelector('#statusRows tr:has(strong:text-is("Vaultwarden"))', { timeout: 5000 });
    await page.click('#statusRows tr.grouphead:has-text("Security") button.foldbtn');
    await page.waitForFunction(() => window.__MOCK.statusFoldsSaved?.at(-1)?.Security === false, null, { timeout: 5000 });
    const saved = () => page.evaluate(() => (window.__MOCK.statusFoldsSaved || []).length);
    const before = await saved();
    await page.click('#statusAll');
    await page.waitForSelector('#statusRows tr:has(strong:text-is("Vaultwarden"))', { timeout: 5000 });
    if ((await saved()) !== before) throw new Error('Show every app was saved for every device');
    await page.click('#statusAll');
    await page.waitForFunction(() => JSON.stringify(window.__MOCK.statusFoldsSaved?.at(-1)) === '{}', null, { timeout: 5000 });
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
  // An app stopped on purpose says so, and Start them leaves it (its own row has Start); one stopped for a while
  // says until when. A group whose only stopped app was stopped on purpose needs no look, so it stays folded.
  { name: 'Stopped by you: its row says so, and Start them leaves it', screen: 'status', mock: { statusOpen: '', status: { ...status, stopped: { mealie: { since: new Date().toISOString() }, vikunja: { since: new Date().toISOString(), until: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1, 8).toISOString() } },
    apps: status.apps.map((a) => (a.id === 'vikunja' ? { ...a, state: 'stopped', health: '', since: undefined } : a)) } }, run: async (page) => {
    await page.waitForSelector('tr.grouphead:has(.names:has-text("Mealie"))', { timeout: 5000 });
    const label = (await page.locator('tr.grouphead:has(.names:has-text("Mealie")) .kiosklabel').textContent()).trim();
    const head = page.locator(`tr.grouphead:has(.kiosklabel:text-is("${label}"))`);
    await page.waitForSelector('#tiles .tile:has-text("Needs a look"):has-text("Nothing unhealthy or stopped")');
    if ((await head.locator('.foldbtn').getAttribute('aria-expanded')) !== 'false') throw new Error('a group with only an app stopped on purpose opened by itself');
    if (await head.locator('.startall').count()) throw new Error(`Start them offers an app stopped on purpose: ${await head.locator('.startall').textContent()}`);
    await page.click('#statusAll');
    await page.waitForSelector('tr:has(strong:text-is("Mealie")) td.state:text-is("Stopped by you")', { timeout: 3000 });
    await page.waitForSelector('tr:has(strong:text-is("Vikunja")) td.state:has-text("Stopped until tomorrow, 8")');
    if (await page.$('tr:has(strong:text-is("Mealie")) td.state .dot.warn')) throw new Error('stopped on purpose is shown as a warning');
    await page.waitForSelector('tr:has(strong:text-is("Mealie")) button.rowmain:text-is("Start")');
    await head.locator('.groupcount').click();
    await page.waitForSelector('.groupmenulist .heldnote:has-text("Stopped by you: Mealie, Vikunja")', { timeout: 3000 });
    if (await page.locator('.groupmenulist [role=menuitem]:has-text("Start")').count()) throw new Error('the group menu offers to start an app stopped on purpose');
    await page.keyboard.press('Escape');
    await page.click('tr:has(strong:text-is("Mealie")) button.rowmain');
    await page.waitForFunction(() => window.__MOCK.calls.AppAction >= 1, null, { timeout: 5000 });
    await page.waitForSelector('tr:has(strong:text-is("Mealie")) td.state:has-text("Running")', { timeout: 5000 });
  } },
  // A restart that keeps failing: the watchdog stopped it, and unlike one stopped by you it needs a look: its row
  // says why with a red dot, Needs a look counts it, its group opens, and the group menu does not call it yours.
  { name: 'Stopped for restarting over and over: its row says so, and it needs a look', screen: 'status', mock: { statusOpen: '', status: { ...status, stopped: { mealie: { since: new Date().toISOString(), why: 'restarting', restarts: 5 } } } }, run: async (page) => {
    await page.waitForSelector('tr:has(strong:text-is("Mealie")) td.state:has-text("Stopped: it restarted 5 times in an hour")', { timeout: 5000 });
    if (!(await page.$('tr:has(strong:text-is("Mealie")) td.state .dot.bad'))) throw new Error('stopped by the watchdog has no red dot');
    await page.waitForSelector('#tiles .tile:has-text("Needs a look"):has-text("Mealie")', { timeout: 3000 });
    const head = page.locator('#statusRows tr:has(strong:text-is("Mealie"))').locator('xpath=preceding-sibling::tr[contains(concat(" ", @class, " "), " grouphead ")][1]');
    if ((await head.locator('.foldbtn').getAttribute('aria-expanded')) !== 'true') throw new Error('its group stayed folded');
    if (await head.locator('.startall').count()) throw new Error('Start them offers it, which would only restart the loop');
    await head.locator('.groupcount').click();
    await page.waitForSelector('.groupmenulist', { timeout: 3000 });
    if (await page.locator('.groupmenulist .heldnote').count()) throw new Error(`the group menu says you stopped it: ${await page.locator('.groupmenulist .heldnote').textContent()}`);
    await page.keyboard.press('Escape');
    await page.waitForSelector('tr:has(strong:text-is("Mealie")) button.rowmain:text-is("Start")');
  } },
  // An app that stopped by itself, not from the app: its row says when, and why when Docker knows (out of memory, an
  // error, a port taken), with a red dot, and Needs a look counts it; one Docker gave no reason for says only when.
  // Its own row still offers Start.
  { name: 'Stopped by itself: its row says when and why, and it needs a look', screen: 'status', mock: stoppedByItself(), run: async (page) => {
    await page.click('#statusAll');
    await page.waitForSelector('tr:has(strong:text-is("Mealie")) td.state:has-text("Stopped at 3:12 AM: it ran out of memory")', { timeout: 5000 });
    if (!(await page.$('tr:has(strong:text-is("Mealie")) td.state .dot.bad'))) throw new Error('an app that ran out of memory has no red dot');
    await page.waitForSelector('#tiles .tile:has-text("Needs a look"):has-text("Mealie")', { timeout: 3000 });
    await page.waitForSelector('tr:has(strong:text-is("Vikunja")) td.state:text-is("Stopped yesterday, 9:40 PM")');
    await page.waitForSelector('tr:has(strong:text-is("Mealie")) button.rowmain:text-is("Start")');
  } },
  // On the phone, 320px wide and with big text (213px is 320 at 1.5×): the why is all there, on a line of its own if
  // need be, and nothing slides sideways.
  ...[320, 213].map((w) => ({ name: `Stopped by itself, on the phone at ${w}px: the why is all there`, screen: 'status', phone: ['companion'], mock: stoppedByItself(), run: async (page) => {
    await page.setViewportSize({ width: w, height: 640 });
    const cell = page.locator('#statusRows tr:has(strong:text-is("Mealie")) td.state');
    await cell.waitFor({ timeout: 5000 });
    await cell.scrollIntoViewIfNeeded();
    const text = (await cell.textContent()).trim();
    if (!text.includes('Stopped at 3:12 AM: it ran out of memory')) throw new Error(`Mealie's row says "${text}"`);
    const bad = await cell.evaluate((e) => {
      const m = document.querySelector('main'), edge = m.getBoundingClientRect().right + 1, found = [];
      if (m.scrollWidth > m.clientWidth + 1) found.push(`the page slides sideways (${m.scrollWidth} px in ${m.clientWidth})`);
      for (const x of [e, ...e.querySelectorAll('*')]) {
        if (getComputedStyle(x).textOverflow === 'ellipsis' && x.scrollWidth > x.clientWidth + 2) found.push('the why is cut off');
        if (x.getBoundingClientRect().right > edge) found.push('the why sticks out');
      }
      return [...new Set(found)];
    });
    if (bad.length) throw new Error(bad.join('; '));
  } })),
  // Its page says the same at the top, beside Start.
  { name: 'Stopped by itself: its page says when and why', screen: 'app:mealie', mock: stoppedByItself(), run: async (page) => {
    await page.waitForSelector('.pill.bad:has-text("Stopped at 3:12 AM: it ran out of memory")', { timeout: 5000 });
  } },
  // Account 3's tester, task 2: a stopped app's page says what to do, whatever stopped it, under its name.
  ...[
    ['stopped by you', { stopped: { mealie: { since: new Date().toISOString() } } }, {}, 'You stopped it, so nothing starts it by itself. Start starts it again.'],
    ['kept restarting', { stopped: { mealie: { since: new Date().toISOString(), why: 'restarting', restarts: 5 } } }, {}, 'The watchdog stopped it after Docker restarted it again and again; its log below says why. Once that is put right, Start tries again.'],
    ['out of memory', {}, { stoppedWhy: 'it ran out of memory' }, "If it runs out again, stop an app you aren't using, or give Docker more memory. Start tries again."],
    ['its port taken', {}, { stoppedWhy: 'another program is using its port 9925' }, 'Another program has port 9925. Quit it, then Start.'],
    ['stopped outside the homelab', {}, {}, 'It was stopped outside the homelab (by Docker, or a shutdown). Start starts it again.'],
  ].map(([what, extra, app, words]) => ({ name: `A stopped app's page says what to do: ${what}`, screen: 'app:mealie',
    mock: { ...pageMock, status: { ...status, ...extra, apps: status.apps.map((a) => (a.id === 'mealie' ? { ...a, ...app } : a)) } }, run: async (page) => {
    await page.waitForSelector(`.pagehead .stopnext:has-text("${words.replace(/"/g, '\\"')}")`, { timeout: 5000 });
    if (await page.isVisible('.pagehead .stopnext .lookonly')) throw new Error('the computer says a phone can only look');
  } })),
  // On a phone that only looks, a stopped app says where to start it, on Status and on its page; one that may make
  // changes has Start, and no such words.
  { name: 'A stopped app on a phone that only looks: start it from the computer', screen: 'status', phone: ['companion'], run: async (page) => {
    await page.waitForSelector('#statusRows tr:has(strong:text-is("Mealie")) .lookonly:visible:text-is("Start it from the computer")', { timeout: 5000 });
    if (await page.isVisible('#statusRows tr:has(strong:text-is("Mealie")) button.rowmain')) throw new Error('a look-only phone shows Start');
    await page.click('#statusRows tr:has(strong:text-is("Mealie")) .topage');
    await page.waitForSelector('.pagehead .stopnext:has-text("It was stopped outside the homelab") .lookonly:visible:has-text("Start it from the computer: this phone can only look.")', { timeout: 5000 });
    if (await page.isVisible('.pagehead .stopnext .change')) throw new Error('a look-only phone is told to press Start');
  } },
  { name: 'A stopped app on a phone that may make changes: Start', screen: 'status', phone: ['companion', 'can-change'], run: async (page) => {
    await page.waitForSelector('#statusRows tr:has(strong:text-is("Mealie")) button.rowmain:visible:text-is("Start")', { timeout: 5000 });
    if (await page.isVisible('#statusRows tr:has(strong:text-is("Mealie")) .lookonly')) throw new Error('a phone that may change says to use the computer');
  } },
  // The watchdog doesn't check a stopped app: beside "All 47 checks passed", it names it, on the computer and the phone.
  ...[[], ['companion']].map((phone) => ({ name: `The watchdog line names the stopped app it doesn't check${phone.length ? ', on the phone' : ''}`, screen: 'status', phone, run: async (page) => {
    await page.waitForSelector('#watchCard .unchecked:has-text("Not checked while stopped: Mealie")', { timeout: 5000 });
  } })),
  // Account 3's tester, task 2, finding 4: Status in a household's words. Apps, not stacks; the homelab's own apps, not
  // baseline ones; what the savings are instead of; what CrowdSec caught, not its scenario's name and an address.
  ...[[], ['companion']].map((phone) => ({ name: `Status in a household's words${phone.length ? ', on the phone' : ''}`, screen: 'status', phone, mock: { protection }, run: async (page) => {
    await page.waitForSelector('#tiles .tile:has-text("Running"):has-text("The homelab\'s own apps are all up")', { timeout: 5000 });
    await page.waitForSelector('#tiles .tile:has-text("Instead of subscriptions"):has-text("a year")');
    await page.waitForSelector('#protectCard li:has-text("Probing for a known security hole"):has-text("Netherlands · Example Hosting B.V.")', { timeout: 5000 });
    const said = await page.evaluate(() => document.body.innerText);
    for (const w of ['stacks', 'baseline', 'Replaces a year', 'vpatch-', 'http-probing', '203.0.113.7']) if (said.includes(w)) throw new Error(`Status says "${w}"`);
    if (!phone.length) await page.waitForSelector('nav button[data-screen="choose"]:has-text("Choose apps")');
  } })),
  // Finding 5: on the phone, an app's log wraps its lines: none runs out of its box.
  { name: "An app's log on the phone wraps its lines, 390px wide", screen: 'app:vikunja', phone: ['companion'], mock: pageMock, run: async (page) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const log = page.locator('#appLog .applog');
    await log.waitFor({ timeout: 5000 });
    const wide = await log.evaluate((e) => e.scrollWidth > e.clientWidth + 1);
    if (wide) throw new Error('a log line runs out of its box');
  } },
  // A stale copy says why, from its app's state, and what helps: Mealie is stopped (the preview's status), so the
  // nightly copy skips it; one whose app runs says Back up now tries again.
  ...[['its app is stopped', status, "It's stopped, so the nightly copy skips it. Start it, and tonight's copy catches up."],
    ['its app runs', { ...status, apps: status.apps.map((a) => (a.id === 'mealie' ? { ...a, state: 'running', health: 'healthy' } : a)) }, "Last night's copy didn't come. Back up now tries again; if it fails, the backup's log says why."],
  ].map(([what, st, words]) => ({ name: `A stale copy says why: ${what}`, screen: 'backups', mock: { status: st }, run: async (page) => {
    await page.waitForSelector(`tr.copy.stale:has-text("Mealie") .note:text-is("${words}")`, { timeout: 5000 });
  } })),
  // "This Mac" in a sentence keeps its capital: "Take the homelab off this Mac", not "this mac"; "this PC" on Windows.
  ...[['MacIntel', 'this Mac'], ['Win32', 'this PC']].map(([platform, words]) => ({ name: `Settings says ${words} in a sentence`, screen: 'settings', mock: { platform }, run: async (page) => {
    await page.waitForSelector(`h3.subhead:text-is("Take the homelab off ${words}")`, { timeout: 5000 });
    await page.waitForSelector(`label:has-text("Delete the backups on ${words}")`);
  } })),
  // The phone's Backups: a copy's when, size, and how many are kept on one line under its name, not three lines with
  // the size alone at the far right.
  { name: "The phone's Backups: each copy on two lines", screen: 'backups', phone: ['companion'], run: async (page) => {
    const row = page.locator('tr.copy:has-text("Vaultwarden")');
    await row.waitFor({ timeout: 5000 });
    const tops = await row.evaluate((r) => ['td.name', 'td.when', 'td.size', 'td.kept'].map((q) => Math.round(r.querySelector(q).getBoundingClientRect().top)));
    if (!(tops[1] > tops[0] && tops[1] === tops[2] && tops[2] === tops[3])) throw new Error(`the lines' tops: ${tops.join(', ')}`);
    if (!(await row.innerText()).includes('7 kept')) throw new Error('how many are kept is hidden');
  } },
  // The owner, Nov 6: a new Mac with the media drive unplugged and no Python, ffmpeg, or Calibre had nine rows under
  // Needs your OK. Now two: plug in the drive (the libraries on it named, Choose another… for media elsewhere), and the
  // tools a library here needs, in one row (Python only, while every library is away). Once the drive is back, the
  // tools row names all three; Calibre's also sits on Books' tab.
  ...(() => {
    const fresh = { ...tidy, activity: [], freed: 0, drive: null,
      libraries: ['music', 'movies', 'tv', 'books', 'audiobooks'].map((kind) => ({ kind, folder: `/Volumes/Media/${kind === 'books' ? 'Books' : kind}`, found: false, stage: 'new', freed: 0 })),
      checks: tidy.checks.map((c) => (c.id === 'drive' ? { ...c, name: 'The Media drive', ok: false, note: "/Volumes/Media isn't there", fix: 'Plug in the media drive (or set MEDIA_ROOT in Settings)' }
        : c.id === 'python' ? { ...c, ok: false, note: 'Not found', fix: 'Install Python 3: brew install python (or the installer from python.org)' }
        : c.id === 'ffmpeg' ? { ...c, ok: false, note: 'Not installed', fix: 'Install ffmpeg: brew install ffmpeg in Terminal (Homebrew is at brew.sh)' }
        : c.id === 'calibredb' ? { ...c, ok: false, note: 'Not installed', fix: "Install the Calibre app (Calibre-Web doesn't include its tools)" } : c)) };
    const back = { ...fresh, checks: fresh.checks.map((c) => (c.id === 'drive' ? { ...c, ok: true, note: '/Volumes/Media' } : c)),
      libraries: fresh.libraries.map((l) => ({ ...l, found: true })) };
    const rows = (page) => page.$$eval('.tidyneeds li', (li) => li.map((r) => r.querySelector('.title, strong')?.textContent.trim() || r.textContent.trim().slice(0, 60)));
    return [
      { name: 'Tidy Up on a new Mac with the drive away: two things, not nine', screen: 'tidy', mock: { tidy: fresh }, run: async (page) => {
        await page.waitForSelector('.tidyneeds li', { timeout: 5000 });
        const got = await rows(page);
        if (JSON.stringify(got) !== JSON.stringify(['Plug in the Media drive', 'Install Python 3'])) throw new Error(`Needs your OK lists: ${JSON.stringify(got)}`);
        await page.waitForSelector('.tidyneeds li:has-text("Music, Movies, TV, Books and Audiobooks are on it (/Volumes/Media)")');
        await page.waitForSelector('.tidyneeds li:has-text("Install Python 3"):has-text("brew install python (or the installer from python.org)")');
        // Choose another… opens Where should your libraries live?, as the Inbox's link does.
        await page.click('.tidyneeds li:has-text("Plug in the Media drive") button:has-text("Choose another…")');
        await page.waitForSelector('#tidy .tidyplaces h2:text-is("Where should your libraries live?")', { timeout: 3000 });
        // Its drives come a moment after it opens and push Cancel down: a click aimed before they're in can land on a
        // drive instead (smoke (light) on #595, smoke (dark) on main, Nov 11). Cancel once they're listed.
        await page.waitForSelector('#tidy .tidyplaces .tidydrives', { timeout: 3000 });
        await page.click('#tidy .tidyplaces button:text-is("Cancel")');
        await page.waitForSelector('.tidyneeds li:has-text("Plug in the Media drive")', { timeout: 3000 });
      } },
      { name: 'Tidy Up once the drive is back: the tools in one row, Calibre on Books too', screen: 'tidy', mock: { tidy: back }, run: async (page) => {
        await page.waitForSelector('.tidyneeds li', { timeout: 5000 });
        const got = await rows(page);
        if (got[0] !== "Install Python 3, ffmpeg and Calibre's tools" || got.some((t) => /drive/.test(t))) throw new Error(`Needs your OK lists: ${JSON.stringify(got)}`);
        await page.click('#tidy .seg button:text-is("Books")', { timeout: 5000 });
        await page.waitForSelector(".tidyneeds li:has-text(\"Install Python 3 and Calibre's tools\")", { timeout: 3000 });
      } },
    ];
  })(),
  // The owner, Nov 7: "I don't see the lyrics option". Never checked: Overview offers the check (it was on the Music tab
  // only). Checked, with nothing to tidy or add: the Music tab still has a Lyrics row, what the check found, and Check
  // again (before, no lyrics option was left anywhere).
  ...(() => {
    const withLyrics = (result) => ({ ...tidy, libraries: tidy.libraries.map((l) => (l.kind !== 'music' ? l
      : { ...l, last: Object.fromEntries(Object.entries(l.last).filter(([k]) => k !== 'lyrics').concat(result ? [['lyrics', tidyRun('lyrics', 5, result)]] : [])) })) });
    return [
      { name: 'Lyrics never checked: Overview offers the check', screen: 'tidy', mock: { tidy: withLyrics(null) }, run: async (page) => {
        await page.click('#tidy .seg button:text-is("Inbox")', { timeout: 5000 });
        await page.waitForSelector('#tidy .tidyneeds li:has-text("See how many songs have lyrics") button:text-is("Check lyrics")', { timeout: 5000 });
        await page.click('#tidy .tidyneeds li:has-text("See how many songs have lyrics") button:text-is("Check lyrics")');
        await page.waitForFunction(() => window.__MOCK.tidyRuns.some((r) => r.slice(0, 3).join(' ') === 'music lyrics --check'), null, { timeout: 5000 });
      } },
      { name: 'Lyrics checked, nothing to do: Music still has a Lyrics row and Check again', screen: 'tidy', mock: { tidy: withLyrics({ check: true, synced: 13700, plain: 228, none: 0, to_clean: 0, instrumental: 4 }) }, run: async (page) => {
        await page.click('#tidy .seg button:text-is("Music")', { timeout: 5000 });
        const row = '#tidy .tidyneeds li:has-text("Lyrics"):has-text("13,700 songs time-synced")';
        await page.waitForSelector(`${row}:has-text("none with two languages on one line") button:text-is("Check again")`, { timeout: 5000 });
      } },
    ];
  })(),
  // Stop for a while, from a group's menu: it asks when (the choice is the second click), the keyboard moves through
  // the times, Back returns to the menu, and each running app is stopped until the time chosen, not for good.
  { name: 'Stop for a while from a group’s menu', screen: 'status', mock: { usage }, run: async (page) => {
    const head = 'tr.grouphead:has(.foldbtn:has-text("Documents"))';
    await page.waitForSelector(`${head} .groupcount`, { timeout: 8000 });
    await page.click(`${head} .groupcount`);
    const n = Number((await page.locator(`${head} .groupmenulist [role=menuitem]:has-text("Restart")`).textContent()).match(/\d+/)?.[0] || 1);
    await page.click(`${head} .groupmenulist .stoplater`);
    await page.waitForSelector(`${head} .groupmenulist .menuhead:has-text("for a while")`, { timeout: 3000 });
    // The focus moves on the next frame: wait for it, as a slower runner may take a moment.
    const focused = async (sel) => {
      for (let i = 0; i < 20; i++) {
        if (await page.locator(sel).first().evaluate((b) => b === document.activeElement).catch(() => false)) return true;
        await page.waitForTimeout(100);
      }
      return false;
    };
    if (!(await focused(`${head} .groupmenulist [role=menuitem]`))) throw new Error('the first time did not take the focus');
    if (await page.evaluate(() => window.__MOCK.calls.StopUntil || window.__MOCK.calls.AppAction)) throw new Error('opening Stop for a while stopped something');
    await page.keyboard.press('ArrowDown');
    if (!(await focused(`${head} .groupmenulist [role=menuitem]:nth-of-type(2)`))) throw new Error('ArrowDown did not move to the next time');
    await page.click(`${head} .groupmenulist .menuback`);
    await page.waitForSelector(`${head} .groupmenulist .stoplater`, { timeout: 2000 });
    if (!(await focused(`${head} .groupmenulist .stoplater`))) throw new Error('Back did not put the focus on Stop for a while');
    // From the keyboard too: Return on it shows the times, the first with the focus, and the menu stays open.
    await page.keyboard.press('Enter');
    await page.waitForSelector(`${head} .groupmenulist .menuhead:has-text("for a while")`, { timeout: 3000 });
    if (!(await focused(`${head} .groupmenulist [role=menuitem]`))) throw new Error('Return on Stop for a while left no time with the focus');
    await page.waitForTimeout(300);
    if (!(await page.isVisible(`${head} .groupmenulist`))) throw new Error('the menu closed after Return on Stop for a while');
    await page.click(`${head} .groupmenulist .menuback`);
    await page.click(`${head} .groupmenulist .stoplater`);
    await page.click(`${head} .groupmenulist [role=menuitem]:text-is("For an hour")`);
    await page.waitForFunction((k) => (window.__MOCK.stoppedUntil || []).length >= k, n, { timeout: 8000 });
    const kept = await page.evaluate(() => window.__MOCK.stoppedUntil);
    const off = Math.abs(new Date(kept[0].until).getTime() - Date.now() - 36e5);
    if (off > 2 * 60e3) throw new Error(`stopped until ${kept[0].until}, not an hour from now`);
    if (await page.evaluate(() => window.__MOCK.calls.AppAction)) throw new Error('Stop for a while stopped an app for good');
    await page.waitForSelector(`tr:has(strong:text-is("Paperless-ngx")) td.state:has-text("Stopped until")`, { timeout: 8000 });
  } },
  // On an app's page, Stop for a while opens its times under it; the one picked stops the app until then.
  // Stop on an app's page asks for a second click, as a group's Stop does; it goes back to Stop when the focus leaves it.
  { name: 'Stop on an app’s page asks for a second click', screen: 'app:vikunja', mock: pageMock, run: async (page) => {
    const stop = page.locator('#app .pagehead .btngroup button:text-is("Stop")');
    await stop.click({ timeout: 5000 });
    await page.waitForSelector('#app .pagehead button.confirm:text-is("Click again to stop")', { timeout: 1000 });
    if (await page.evaluate(() => window.__MOCK.calls.AppAction)) throw new Error('one click on Stop stopped the app');
    await page.keyboard.press('Tab');
    await page.waitForSelector('#app .pagehead .btngroup button:text-is("Stop")', { timeout: 1000 });
    await stop.click();
    await page.click('#app .pagehead button:text-is("Click again to stop")');
    await page.waitForFunction(() => window.__MOCK.calls.AppAction === 1, null, { timeout: 5000 });
  } },
  { name: 'Stop for a while on an app’s page', screen: 'app:vikunja', mock: pageMock, run: async (page) => {
    const btn = page.locator('.pagehead button:has-text("Stop for a while")');
    await btn.waitFor({ timeout: 5000 });
    await btn.click();
    await page.waitForSelector('.pagehead .menu [role=menuitem]:has-text("For an hour")', { timeout: 3000 });
    const missed = await page.$$eval('.pagehead .menu [role=menuitem]', (bs) => bs.filter((b) => { const r = b.getBoundingClientRect(); const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !at || !b.contains(at); }).map((b) => b.textContent.trim()));
    if (missed.length) throw new Error(`cut off: ${missed.join(', ')}`);
    if (await page.evaluate(() => window.__MOCK.calls.StopUntil)) throw new Error('opening the menu stopped the app');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.pagehead .menu', { state: 'detached', timeout: 2000 });
    if (!(await btn.evaluate((b) => b === document.activeElement))) throw new Error('Escape did not put the focus back on the button');
    await btn.click();
    await page.locator('.pagehead .menu [role=menuitem]').last().click(); // 8 AM: this morning before 6, else tomorrow
    await page.waitForFunction(() => (window.__MOCK.stoppedUntil || []).length === 1, null, { timeout: 5000 });
    const [{ id, until }] = await page.evaluate(() => window.__MOCK.stoppedUntil);
    const t = new Date(until);
    if (id !== 'vikunja' || t.getHours() !== 8 || t.getMinutes() !== 0) throw new Error(`stopped ${id} until ${until}`);
    await page.waitForSelector('.pagehead .pill:has-text("Stopped until")', { timeout: 5000 });
    await page.waitForSelector('.pagehead button:text-is("Start")');
  } },
  // A right-click on an app's row opens its own menu where the pointer is: everything its page offers, each item whole on
  // screen. Copy address copies it and says so under the row; Stop asks for a second click; Escape closes it back on what had
  // the focus, and a press elsewhere (as WebKit's, which moves no focus) closes it too.
  { name: 'Right-click an app’s row: its menu', screen: 'status', run: async (page) => {
    // Tall enough for the whole menu under the pointer (Send to my phone › made it a row longer); a menu that would not
    // fit moves up, its own case.
    await page.setViewportSize({ width: 1280, height: 1000 });
    const row = page.locator('tr:has(strong:text-is("Vikunja"))');
    await row.waitFor({ timeout: 5000 });
    await row.scrollIntoViewIfNeeded();
    const box = await row.locator('td.state').boundingBox();
    await page.mouse.click(box.x + 20, box.y + box.height / 2, { button: 'right' });
    const menu = page.locator('.rowmenu');
    await menu.waitFor({ timeout: 2000 });
    const labels = (await menu.locator('[role^=menuitem]').allTextContents()).map((t) => t.replace('✓', '').trim());
    const want = ['Open', 'Open on a phone', 'Copy address', 'Send to my phone ›', 'Restart', 'Stop', 'Stop for a while ›', 'Logs', 'Back up now', 'Tell me if it stops', 'Pin to the top'];
    if (labels.join('|') !== want.join('|')) throw new Error(`items: ${labels.join(', ')}`);
    const m = await menu.boundingBox();
    if (Math.abs(m.x - (box.x + 20)) > 2 || Math.abs(m.y - (box.y + box.height / 2)) > 2) throw new Error(`the menu opened at ${m.x},${m.y}, not at the pointer`);
    const missed = await page.$$eval('.rowmenu [role^=menuitem]', (bs) => bs.filter((b) => { const r = b.getBoundingClientRect(); const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !at || !b.contains(at); }).map((b) => b.textContent.trim()));
    if (missed.length) throw new Error(`cut off: ${missed.join(', ')}`);
    if ((await menu.locator('[role=menuitemcheckbox]:has-text("Tell me if it stops")').getAttribute('aria-checked')) !== 'true') throw new Error('Tell me if it stops is not ticked for an app with alerts on');
    await menu.locator('[role=menuitem]:text-is("Stop")').click();
    await menu.locator('[role=menuitem]:has-text("Click again to stop Vikunja")').waitFor({ timeout: 1000 });
    if (await page.evaluate(() => window.__MOCK.calls.AppAction)) throw new Error('one click on Stop stopped it');
    await page.keyboard.press('Escape');
    await menu.waitFor({ state: 'detached', timeout: 1000 });
    if (await page.evaluate(() => window.__MOCK.calls.AppAction)) throw new Error('Escape stopped it');
    await page.mouse.click(box.x + 20, box.y + box.height / 2, { button: 'right' });
    await menu.locator('[role=menuitem]:text-is("Copy address")').click();
    await row.locator('.rowsaid:text-is("Address copied")').waitFor({ timeout: 2000 });
    const copied = await page.evaluate(() => window.__MOCK.clipboard);
    if (copied !== 'https://todo.example.com') throw new Error(`copied ${copied}`);
    if (await page.isVisible('#app.active')) throw new Error('a click in the menu opened the app’s page');
    await page.mouse.click(box.x + 20, box.y + box.height / 2, { button: 'right' });
    await menu.waitFor({ timeout: 2000 });
    await page.locator('#tiles').dispatchEvent('mousedown', { detail: 1 });
    await menu.waitFor({ state: 'detached', timeout: 1000 });
  } },
  // Open, your way: ⌥-click (Alt-click) an address copies it and says so, opening nothing; ⇧-click (Shift-click) Open uses
  // its address on this machine instead of the domain; a plain click still opens the domain. Each says so in its tooltip.
  ...[['Mac', 'MacIntel', '⌥', '⇧'], ['Windows', 'Win32', 'Alt-', 'Shift-']].map(([sys, platform, alt, shift]) => ({
    name: `Open, your way: ⌥-click copies an address, ⇧-click opens it on this machine, ${sys}`, screen: 'status', mock: { platform, host: sys === 'Mac' ? host : { ...host, os: 'Windows 11', machine: 'this PC' } }, run: async (page) => {
      const row = page.locator('#statusRows tr:not(.grouphead):has(strong:text-is("Vikunja"))');
      await row.waitFor({ timeout: 5000 });
      await row.scrollIntoViewIfNeeded();
      const local = await page.evaluate(() => window.__MOCK.status.apps.find((a) => a.id === 'vikunja').url);
      const link = row.locator('a[role=button]:has-text("todo.example.com")');
      if ((await link.getAttribute('title')) !== `${alt}click copies it`) throw new Error('the address says: ' + await link.getAttribute('title'));
      await link.click({ modifiers: ['Alt'] });
      await row.locator('.rowsaid:text-is("Address copied")').waitFor({ timeout: 2000 });
      if ((await page.evaluate(() => window.__MOCK.clipboard)) !== 'https://todo.example.com') throw new Error('copied ' + await page.evaluate(() => window.__MOCK.clipboard));
      if (await page.evaluate(() => window.__MOCK.opened)) throw new Error('⌥-click opened it too');
      if (await page.isVisible('#app.active')) throw new Error('⌥-click opened its page');
      const open = row.locator('button.rowmain:text-is("Open")');
      if ((await open.getAttribute('title')) !== `Open Vikunja (${shift}click: on this machine, ${local.replace('http://', '')})`) throw new Error('Open says: ' + await open.getAttribute('title'));
      await open.click({ modifiers: ['Shift'] });
      if ((await page.evaluate(() => window.__MOCK.opened)) !== local) throw new Error('⇧-click opened ' + await page.evaluate(() => window.__MOCK.opened));
      await open.click();
      if ((await page.evaluate(() => window.__MOCK.opened)) !== 'https://todo.example.com') throw new Error('a click opened ' + await page.evaluate(() => window.__MOCK.opened));
      await link.click();
      if ((await page.evaluate(() => window.__MOCK.opened)) !== 'https://todo.example.com') throw new Error('the address opened ' + await page.evaluate(() => window.__MOCK.opened));
    } })),
  // Send to my phone (the owner, Nov 12: pick a phone each time): a row's menu lists the phones its page can go to, a
  // member's only for their own apps, never a wall screen; one picked gets the app's own link, and the row says so.
  { name: "Status: an app's menu sends its page to a phone picked from the paired ones", screen: 'status', run: async (page) => {
    const sendFrom = async (app) => {
      const row = page.locator(`tr:has(strong:text-is("${app}"))`);
      await row.waitFor({ timeout: 5000 });
      await row.scrollIntoViewIfNeeded();
      const box = await row.locator('td.state').boundingBox();
      await page.mouse.click(box.x + 20, box.y + box.height / 2, { button: 'right' });
      await page.click('.rowmenu button:text-is("Send to my phone ›")', { timeout: 2000 });
      return (await page.locator('.rowmenu [role=menuitem]').allTextContents()).map((t) => t.trim());
    };
    let phones = await sendFrom('Immich');
    if (phones.join('|') !== "Sam's iPhone|The iPad|Anna's iPhone|‹ Back") throw new Error(`Immich goes to: ${phones}`);
    await page.click('.rowmenu button:text-is("The iPad")');
    const sent = await page.evaluate(() => window.__MOCK.sent?.at(-1));
    if (sent?.device !== 'p2' || sent.link !== 'homelab://app/immich-server' || sent.title !== 'Immich') throw new Error(`sent: ${JSON.stringify(sent)}`);
    await page.waitForSelector('tr:has(strong:text-is("Immich")) :text("Sent to The iPad")', { timeout: 5000 });
    await page.keyboard.press('Escape');
    phones = await sendFrom('Vikunja');
    if (phones.includes("Anna's iPhone")) throw new Error(`Anna's phone is offered an app that isn't hers: ${phones}`);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
  } },
  // ⌘K sends the page the window is on: a Finances tab only to a phone that sees Finances.
  { name: 'The command palette sends the page you are on to a phone', screen: 'finances', run: async (page) => {
    await finTab(page, 'Recurring', { timeout: 5000 });
    await page.keyboard.press('Meta+k'); // the mock's computer is a Mac
    await page.keyboard.type('send');
    const offered = await page.locator('#palette [role=option]').allTextContents();
    if (!offered.some((o) => o.includes("Send Finances › Recurring to Sam's iPhone")) || offered.some((o) => o.includes('The iPad') || o.includes('Anna'))) throw new Error(`offered: ${offered}`);
    await page.click('#palette [role=option]:has-text("Send Finances › Recurring to Sam\'s iPhone")');
    const sent = await page.evaluate(() => window.__MOCK.sent?.at(-1));
    if (sent?.device !== 'p1' || sent.link !== 'homelab://finances/recurring' || sent.title !== 'Finances › Recurring') throw new Error(`sent: ${JSON.stringify(sent)}`);
  } },
  // Open on the computer: a page a phone asked for, the window goes to it; anything but the app's own pages, nothing.
  { name: 'Open on the computer: the window goes to the page a phone asked for', screen: 'status', run: async (page) => {
    await page.evaluate(() => window.__emit('open:link', { link: 'homelab://finances/recurring', from: "Sam's iPhone" }));
    await page.waitForSelector('#finances.active #finRoot .seg button[aria-checked="true"]:text-is("Recurring")', { timeout: 5000 });
    await page.evaluate(() => window.__emit('open:link', { link: 'homelab://app/vikunja', from: "Sam's iPhone" }));
    await page.waitForSelector('#app.active h1:has-text("Vikunja")', { timeout: 5000 });
    await page.evaluate(() => window.__emit('open:link', { link: 'https://example.com', from: "Sam's iPhone" }));
    await page.waitForTimeout(300);
    if (!(await page.isVisible('#app.active h1:has-text("Vikunja")'))) throw new Error('a link that is not the app\'s own moved the window');
  } },
  // On the phone's page, a page the computer sent shows at the bottom with Open, which goes there.
  { name: 'The phone: a page sent from the computer shows with Open', screen: 'status', phone: ['companion', 'finances'], run: async (page) => {
    await page.evaluate(() => window.__emit('phone:open', { link: 'homelab://finances/recurring', title: 'Finances › Recurring' }));
    await page.waitForSelector('#undoNote .undonote:has-text("From the computer: Finances › Recurring")', { timeout: 5000 });
    await page.click('#undoNote button:text-is("Open")');
    await page.waitForSelector('#finances.active #finRoot .seg button[aria-checked="true"]:text-is("Recurring")', { timeout: 5000 });
    await page.evaluate(() => window.__emit('phone:open', { link: 'homelab://app/vikunja', title: 'Vikunja' }));
    await page.click('#undoNote button:text-is("Open")', { timeout: 5000 });
    await page.waitForSelector('#app.active h1:has-text("Vikunja")', { timeout: 5000 });
    // Not one of the app's own pages: nothing shows.
    await page.evaluate(() => window.__emit('phone:open', { link: 'https://example.com', title: 'Somewhere' }));
    await page.waitForTimeout(300);
    if (await page.isVisible('#undoNote .undonote')) throw new Error('a link that is not the app\'s own showed');
  } },
  // Pin to the top (a row's right-click): the app moves to Pinned, open under Needs a look, in the order pinned, and leaves
  // its own group; unpinned, it goes back. Ticked in the menu while pinned.
  { name: 'Pin an app to the top of Status', screen: 'status', run: async (page) => {
    const pin = async (name) => {
      const row = page.locator(`#statusRows tr:not(.grouphead):has(strong:text-is("${name}"))`).first();
      await row.waitFor({ timeout: 5000 });
      await row.scrollIntoViewIfNeeded();
      const box = await row.locator('td.state').boundingBox();
      await page.mouse.click(box.x + 20, box.y + box.height / 2, { button: 'right' });
      await page.locator('.rowmenu [role=menuitemcheckbox]:has-text("Pin to the top")').click({ timeout: 2000 });
    };
    // The rows in order, each group's heading as "# label".
    const rows = () => page.$$eval('#statusRows tr', (trs) => trs.map((r) => (r.classList.contains('grouphead') ? '# ' + (/Pinned|Needs a look/.exec(r.textContent)?.[0] || 'group') : r.querySelector('strong')?.textContent)));
    await pin('Vikunja');
    await page.waitForSelector('#statusRows tr.grouphead:has-text("Pinned")', { timeout: 3000 });
    await pin('Immich');
    await page.waitForFunction(() => { const rows = [...document.querySelectorAll('#statusRows tr')]; const p = rows.findIndex((r) => r.classList.contains('grouphead') && /Pinned/.test(r.textContent)); return rows[p + 2]?.querySelector('strong')?.textContent === 'Immich'; }, null, { timeout: 3000 });
    const list = await rows();
    const at = list.indexOf('# Pinned');
    if (at < 0 || list[at + 1] !== 'Vikunja' || list[at + 2] !== 'Immich' || !list[at + 3]?.startsWith('# ')) throw new Error('rows: ' + list.join(', '));
    if (list.filter((r) => r === 'Vikunja').length !== 1 || list.filter((r) => r === 'Immich').length !== 1) throw new Error('a pinned app shows twice: ' + list.join(', '));
    const heads = list.filter((r) => r?.startsWith('# '));
    if (heads[0] !== '# Pinned' && !(heads[0] === '# Needs a look' && heads[1] === '# Pinned')) throw new Error('Pinned is not at the top: ' + heads.join(', '));
    // Ticked while pinned; unpinned, it is back in its group.
    const row = page.locator('#statusRows tr:not(.grouphead):has(strong:text-is("Vikunja"))');
    await row.scrollIntoViewIfNeeded();
    const box = await row.locator('td.state').boundingBox();
    await page.mouse.click(box.x + 20, box.y + box.height / 2, { button: 'right' });
    const item = page.locator('.rowmenu [role=menuitemcheckbox]:has-text("Pin to the top")');
    if ((await item.getAttribute('aria-checked')) !== 'true') throw new Error('Pin to the top is not ticked for a pinned app');
    await item.click();
    await page.waitForFunction(() => window.__MOCK.status.pinned?.join() === 'immich-server', null, { timeout: 3000 });
    await page.waitForFunction(() => { const rows = [...document.querySelectorAll('#statusRows tr')]; const p = rows.findIndex((r) => r.classList.contains('grouphead') && /Pinned/.test(r.textContent)); return p >= 0 && rows[p + 1]?.querySelector('strong')?.textContent === 'Immich' && !rows[p + 2]?.querySelector('strong')?.textContent?.includes('Vikunja'); }, null, { timeout: 3000 });
    const sets = await page.evaluate(() => window.__MOCK.settingsSet);
    if (JSON.stringify(sets) !== JSON.stringify([['vikunja', 'pinned', true], ['immich-server', 'pinned', true], ['vikunja', 'pinned', false]])) throw new Error('set: ' + JSON.stringify(sets));
  } },
  // A right-click on a screen in the sidebar opens its own menu at the pointer, without picking the screen: each item opens
  // its screen and does what its button there does (Update all shows its list first). From the keyboard too; Escape closes
  // it back on the sidebar, and a press elsewhere (as WebKit's) closes it.
  { name: 'Right-click the sidebar: each screen’s own menu', screen: 'setup', mock: { jobApps: { 'update-all': ['navidrome', 'vikunja', 'mealie'] } }, run: async (page) => {
    const menu = page.locator('#contextMenu .rowmenu');
    const items = async () => (await menu.locator('[role=menuitem]').allTextContents()).map((t) => t.trim());
    const rightClick = async (screen) => {
      const b = await page.locator(`nav button[data-screen=${screen}]`).boundingBox();
      await page.mouse.click(b.x + 30, b.y + b.height / 2, { button: 'right' });
      await menu.waitFor({ timeout: 2000 });
      return b;
    };
    const b = await rightClick('status');
    if ((await items()).join('|') !== 'Check again|Update all apps…') throw new Error('Status: ' + (await items()).join(', '));
    if ((await menu.getAttribute('aria-label')) !== 'Status') throw new Error('the menu is named ' + await menu.getAttribute('aria-label'));
    const m = await menu.boundingBox();
    if (Math.abs(m.x - (b.x + 30)) > 2 || Math.abs(m.y - (b.y + b.height / 2)) > 2) throw new Error(`the menu opened at ${m.x},${m.y}, not at the pointer`);
    const missed = await page.$$eval('#contextMenu [role=menuitem]', (bs) => bs.filter((x) => { const r = x.getBoundingClientRect(); const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !at || !x.contains(at); }).map((x) => x.textContent.trim()));
    if (missed.length) throw new Error(`cut off: ${missed.join(', ')}`);
    if (!(await page.isVisible('#setup.active'))) throw new Error('the right-click picked the screen');
    await page.keyboard.press('Escape');
    await menu.waitFor({ state: 'detached', timeout: 1000 });
    // Backups: Back up now and Test a restore.
    await rightClick('backups');
    if ((await items()).join('|') !== 'Check again|Back up now|Test a restore') throw new Error('Backups: ' + (await items()).join(', '));
    await page.locator('#tiles').dispatchEvent('mousedown', { detail: 1 });
    await menu.waitFor({ state: 'detached', timeout: 1000 });
    // Finances, from the keyboard: Shift+F10 on its button, the first item focused, the arrows, Return.
    await page.focus('nav button[data-screen=finances]');
    await page.keyboard.press('Shift+F10');
    await menu.waitFor({ timeout: 2000 });
    if ((await items()).join('|') !== 'Check again|Add a transaction|Update balances|Hide amounts') throw new Error('Finances: ' + (await items()).join(', '));
    if ((await page.evaluate(() => document.activeElement.textContent.trim())) !== 'Check again') throw new Error('the first item is not focused');
    await page.keyboard.press('Escape');
    await menu.waitFor({ state: 'detached', timeout: 1000 });
    if ((await page.evaluate(() => document.activeElement.dataset.screen)) !== 'finances') throw new Error('Escape did not go back to the sidebar');
    await page.keyboard.press('Shift+F10');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#finances.active', { timeout: 3000 });
    await page.waitForSelector('#finSheet:not([hidden])', { timeout: 3000 });
    await page.keyboard.press('Escape');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 3000 });
    // Update all opens Status and its list, as its button does (a sheet that owns the window): nothing is updated yet.
    await rightClick('status');
    await menu.locator('[role=menuitem]:text-is("Update all apps…")').click();
    await page.waitForSelector('#status.active', { timeout: 3000 });
    await page.waitForSelector('#cliPanel:not([hidden]) #cliTitle:text-is("Update all apps now")', { timeout: 5000 });
    await page.waitForSelector('#cliActions button:text-is("Update them")', { timeout: 5000 });
    const ran = await page.evaluate(() => window.__MOCK.homelabRan || []);
    if (ran.join() !== 'update-all') throw new Error('ran: ' + ran.join());
  } },
  // From the keyboard: Shift+F10 (or the context-menu key) on a row's button opens the menu under its name with the first item
  // focused; the arrows move through it and Return runs one. Tell me if it stops turns its alerts off. A stopped app's menu offers
  // Start, not Restart or Stop.
  { name: 'Right-click an app’s row: from the keyboard, and a stopped app', screen: 'status', run: async (page) => {
    // Room under Vikunja, the last row, for the whole menu (near the bottom it opens upward: its own case).
    await page.setViewportSize({ width: 1280, height: 1000 });
    const row = page.locator('tr:has(strong:text-is("Vikunja"))');
    await row.locator('button.rowmain').focus({ timeout: 5000 });
    await page.keyboard.press('Shift+F10');
    const menu = page.locator('.rowmenu');
    await menu.waitFor({ timeout: 2000 });
    await page.waitForFunction(() => document.activeElement?.closest('.rowmenu') && document.activeElement.textContent === 'Open', null, { timeout: 2000 });
    const name = await row.locator('strong').boundingBox(), m = await menu.boundingBox();
    if (m.y < name.y + name.height || m.y > name.y + name.height + 12) throw new Error('the menu did not open under the app’s name');
    // End is Pin to the top; one up, Tell me if it stops.
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await menu.waitFor({ state: 'detached', timeout: 1000 });
    await page.waitForFunction(() => window.__MOCK.calls.SetAppSetting >= 1, null, { timeout: 3000 });
    if (JSON.stringify(await page.evaluate(() => window.__MOCK.settingsSet?.[0])) !== '["vikunja","alerts",false]') throw new Error('set ' + JSON.stringify(await page.evaluate(() => window.__MOCK.settingsSet)));
    if (!(await row.locator('button.rowmain').evaluate((b) => b === document.activeElement))) throw new Error('the focus did not come back to the row');
    await page.keyboard.press('ContextMenu');
    await menu.waitFor({ timeout: 2000 });
    await page.waitForFunction(() => document.activeElement?.closest('.rowmenu') && document.activeElement.textContent === 'Open', null, { timeout: 2000 });
    // Open, Open on a phone, Copy address, Send to my phone ›, then Restart.
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
    if ((await page.evaluate(() => document.activeElement.textContent)) !== 'Restart') throw new Error('the arrows did not reach Restart');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__MOCK.calls.AppAction >= 1, null, { timeout: 3000 });
    if (await page.isVisible('#cliPanel')) throw new Error('a sheet opened for a Restart: it runs on the row now');
    const mealie = page.locator('tr:has(strong:text-is("Mealie"))');
    await mealie.scrollIntoViewIfNeeded();
    const box = await mealie.locator('td.state').boundingBox();
    await page.mouse.click(box.x + 20, box.y + box.height / 2, { button: 'right' });
    await menu.waitFor({ timeout: 2000 });
    const labels = await menu.locator('[role^=menuitem]').allTextContents();
    if (!labels.includes('Start') || labels.includes('Restart') || labels.includes('Stop') || labels.includes('Open')) throw new Error(`a stopped app's menu: ${labels.join(', ')}`);
  } },
  // A right-click on a group's heading opens the group's menu, as a click on its count does; one near the window's bottom
  // edge opens upward, inside the window.
  { name: 'Right-click a group’s heading: its menu', screen: 'status', mock: { usage }, run: async (page) => {
    const head = page.locator('tr.grouphead:has(.foldbtn:has-text("Documents"))');
    await head.waitFor({ timeout: 5000 });
    await head.scrollIntoViewIfNeeded();
    const hb = await head.boundingBox();
    await page.mouse.click(hb.x + hb.width - 40, hb.y + hb.height / 2, { button: 'right' });
    await head.locator('.groupmenulist [role=menuitem]').first().waitFor({ timeout: 2000 });
    if ((await head.locator('.groupcount').getAttribute('aria-expanded')) !== 'true') throw new Error('the group’s menu did not open');
    await page.keyboard.press('Escape');
    const rows = page.locator('#statusRows tr:not(.grouphead)');
    const last = rows.last();
    await last.scrollIntoViewIfNeeded();
    const b = await last.boundingBox(), vh = await page.evaluate(() => innerHeight);
    await page.mouse.click(b.x + b.width - 30, Math.min(b.y + b.height / 2, vh - 6), { button: 'right' });
    const m = await page.locator('.rowmenu').boundingBox();
    if (m.y + m.height > vh || m.x + m.width > (await page.evaluate(() => innerWidth))) throw new Error('the menu runs past the window');
  } },
  // Status's cards leave no dead space: the short ones (Protection, What the apps keep) stacked in one column beside Recent
  // alerts; a long alert shows its first 3 lines and Show the rest; each app's size on one line with its bar.
  // Type to filter: letters typed on Status (nothing focused) open the filter box with them and keep only the apps whose
  // name has them, each group open with its whole count; Escape brings every app back and the focus to where it was;
  // a name nothing has says so; Return opens the first one's page.
  { name: 'Status: type an app’s name and the list narrows; Escape brings it back', screen: 'status', run: async (page) => {
    await page.waitForSelector('#statusRows tr.grouphead', { timeout: 5000 });
    const rows = () => page.$$eval('#statusRows tr:not(.grouphead)', (rs) => rs.filter((r) => r.checkVisibility()).map((r) => r.querySelector('strong')?.textContent || r.textContent.trim()));
    const heads = () => page.$$eval('#statusRows tr.grouphead', (rs) => rs.map((r) => r.querySelector('.foldbtn').textContent.replace(/^[▾▸]/, '')));
    const before = (await heads()).length;
    await page.keyboard.type('NAVI');
    await page.waitForSelector('#statusAllBox .filterbox input', { timeout: 3000 });
    if ((await page.inputValue('#statusAllBox .filterbox input')) !== 'NAVI') throw new Error('the box does not hold what was typed');
    if (!(await page.evaluate(() => document.activeElement?.matches('.filterbox input')))) throw new Error('the box does not have the focus');
    const kept = await rows();
    if (kept.join() !== 'Navidrome') throw new Error('kept: ' + kept.join(', '));
    if ((await heads()).length !== 1) throw new Error('groups shown: ' + (await heads()).join(', '));
    // Its heading still counts the whole group, and says it is open.
    if ((await page.getAttribute('#statusRows tr.grouphead .foldbtn', 'aria-expanded')) !== 'true') throw new Error('the group is not open');
    // The count follows the list a moment later (the list says how many it kept): wait for it, then read it.
    await page.waitForFunction(() => /^1 of \d+ apps$/.test(document.querySelector('.filterbox .filtercount')?.textContent || ''), null, { timeout: 3000 })
      .catch(async () => { throw new Error('the count says ' + (await page.textContent('.filterbox .filtercount'))); });
    // Another name, typed into the box.
    await page.fill('.filterbox input', 'vault');
    if (!(await rows()).includes('Vaultwarden')) throw new Error('vault does not find Vaultwarden');
    // A name nothing has: said across the table, with a way back.
    await page.fill('.filterbox input', 'zzzz');
    await page.waitForSelector('#statusRows tr.nomatch:has-text("No app’s name has “zzzz”")', { timeout: 3000 });
    await page.waitForSelector('.filterbox .filtercount:text-is("No app has that name")', { timeout: 3000 })
      .catch(async () => { throw new Error('the count does not say so: ' + (await page.textContent('.filterbox .filtercount'))); });
    await page.click('#statusRows tr.nomatch button:text-is("Show every app")');
    await page.waitForSelector('#statusAll', { timeout: 3000 });
    if ((await heads()).length !== before) throw new Error('every group did not come back');
    // Escape from the box: every app back, the focus where it was.
    await page.focus('#statusAll');
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.type('mea');
    await page.waitForSelector('.filterbox input', { timeout: 3000 });
    await page.keyboard.press('Escape');
    await page.waitForSelector('#statusAll', { timeout: 3000 });
    if (await page.$('.filterbox')) throw new Error('the box stays after Escape');
    if ((await heads()).length !== before) throw new Error('Escape did not bring every group back');
    // Return opens the first one's page.
    await page.keyboard.type('vikun');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#app h1:text-is("Vikunja")', { timeout: 5000 });
  } },
  // Not while typing in a field, with ⌘ or Ctrl held, or with a menu open: those keys are theirs.
  { name: 'Status: a key that is not typing a name does not filter', screen: 'status', run: async (page) => {
    await page.waitForSelector('#statusRows tr.grouphead', { timeout: 5000 });
    await page.keyboard.press('Meta+a');
    await page.keyboard.press('Control+a');
    await page.keyboard.press(' ');
    if (await page.$('.filterbox')) throw new Error('a shortcut or Space opened the filter');
    await page.click('#statusRows tr.grouphead button.groupcount');
    await page.waitForSelector('.groupmenulist', { timeout: 3000 });
    await page.keyboard.type('s');
    if (await page.$('.filterbox')) throw new Error('typing in an open menu opened the filter');
  } },
  // A sheet of shortcuts: ? on any screen, the focus not in a field, lists the screen's own shortcuts first, then those
  // that work everywhere and each screen's key, as this system writes them; on Status it doesn't start the filter. In a
  // field, ? is typed. The palette's Keyboard shortcuts opens it too, and Close puts the focus back where it was.
  { name: 'Keyboard shortcuts: ? and the palette open them, the screen’s own first', screen: 'status', run: async (page) => {
    const sheet = '#keysSheet';
    const heads = () => page.$$eval(`${sheet} h3`, (h) => h.map((x) => x.textContent));
    const text = () => page.$eval(sheet, (s) => s.innerText.replace(/\s+/g, ' '));
    await page.waitForSelector('#statusRows tr', { timeout: 5000 });
    await page.keyboard.press('?');
    await page.waitForSelector(`${sheet}:not([hidden])`, { timeout: 3000 });
    if ((await heads()).join('|') !== 'On Status|Everywhere|The screens') throw new Error(`the sections: ${await heads()}`);
    let said = await text();
    for (const want of ['Start typing an app’s name', '⌘K The command palette', '⌘R Check the screen again', '⌘⇧H Hide every amount', '⌘2 Status', '⌘, Settings']) {
      if (!said.includes(want)) throw new Error(`no "${want}" in: ${said}`);
    }
    if (said.includes('Ctrl') || /\bF1 /.test(said) || said.includes('F5')) throw new Error(`another system's keys on a Mac: ${said}`);
    if (await page.$('.filterbox')) throw new Error('? started the filter');
    await page.keyboard.press('Escape');
    await page.waitForSelector(`${sheet}`, { state: 'hidden', timeout: 2000 });
    // In a field, ? is a character like any other.
    await page.click('nav button[data-screen="choose"]');
    await page.fill('#search', 'what');
    await page.focus('#search');
    await page.keyboard.press('?');
    if ((await page.inputValue('#search')) !== 'what?') throw new Error(`the field holds "${await page.inputValue('#search')}"`);
    if (await page.isVisible(sheet)) throw new Error('? in a field opened the sheet');
    await page.fill('#search', '');
    // From the palette, on Finances: the calendar's keys, and Close back where the focus was.
    await page.click('nav button[data-screen="finances"]');
    await page.focus('nav button[data-screen="finances"]');
    await page.keyboard.press('Meta+k');
    await page.fill('.palette .palfield', 'keyboard');
    await page.keyboard.press('Enter');
    await page.waitForSelector(`${sheet}:not([hidden])`, { timeout: 3000 });
    if ((await heads())[0] !== 'On Finances') throw new Error(`the first section: ${await heads()}`);
    said = await text();
    if (!said.includes('Page Up Page Down The month before or after')) throw new Error(`no calendar keys in: ${said}`);
    await page.click(`${sheet} button:text-is("Close")`);
    await page.waitForSelector(`${sheet}`, { state: 'hidden', timeout: 2000 });
    await page.waitForFunction(() => document.activeElement?.matches('nav button[data-screen="finances"]'), null, { timeout: 2000 })
      .catch(async () => { throw new Error(`the focus went to ${await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80))}`); });
  } },
  // The same sheet on Windows: Ctrl, F5 beside Ctrl+R, the menu key, and F1 for the guide.
  { name: 'Keyboard shortcuts as Windows: Ctrl, F5, and F1', screen: 'backups', mock: { platform: 'Win32', host: { ...host, os: 'Windows 11 24H2', machine: 'this PC' } }, run: async (page) => {
    await page.keyboard.press('?');
    await page.waitForSelector('#keysSheet:not([hidden])', { timeout: 3000 });
    const said = await page.$eval('#keysSheet', (s) => s.innerText.replace(/\s+/g, ' '));
    for (const want of ['Ctrl+K The command palette', 'Ctrl+R F5 Check the screen again', 'Shift+F10 Menu key', 'F1 The guide', 'Ctrl+, Settings']) {
      if (!said.includes(want)) throw new Error(`no "${want}" in: ${said}`);
    }
    if (said.includes('⌘')) throw new Error(`a Mac's keys on Windows: ${said}`);
    if (await page.$('#keysSheet h3:text-is("On Backups")')) throw new Error('a section for a screen with no keys of its own');
  } },
  // The command palette: ⌘K (Ctrl+K) on any screen opens a field over it; an app's name lists its Open, page, Restart,
  // Stop, and Logs, the arrows pick, Return runs, a name nothing has says so, and Escape closes it with the focus back
  // where it was. Its field is a combobox whose active option follows the arrows (VoiceOver reads it).
  { name: 'Command palette: ⌘K, an app’s name, the arrows, and Escape', screen: 'backups', run: async (page) => {
    const mac = await page.evaluate(() => /Mac/.test(navigator.platform));
    const palette = () => page.keyboard.press(mac ? 'Meta+k' : 'Control+k');
    const options = () => page.$$eval('.palette [role=option]', (os) => os.map((o) => o.querySelector('.pallabel').textContent));
    const picked = () => page.evaluate(() => {
      const f = document.querySelector('.palette .palfield'), on = document.querySelectorAll('.palette [role=option][aria-selected=true]');
      return on.length === 1 && f.getAttribute('aria-activedescendant') === on[0].id ? on[0].querySelector('.pallabel').textContent : `${on.length} picked, the field says ${f.getAttribute('aria-activedescendant')}`;
    });
    await page.waitForSelector('#recoveryKit', { timeout: 5000 });
    await page.focus('#recoveryKit');
    await palette();
    await page.waitForSelector('.palette .palfield', { timeout: 3000 });
    if (!(await page.evaluate(() => document.activeElement?.matches('.palette .palfield')))) throw new Error('the field does not have the focus');
    if (!(await options()).includes('Back up now')) throw new Error('with nothing typed it offers: ' + (await options()).join(', '));
    await page.keyboard.type('navid');
    const nav = await options();
    for (const want of ['Open Navidrome', 'Navidrome’s page', 'Restart Navidrome', 'Stop Navidrome', 'Navidrome’s logs']) if (!nav.includes(want)) throw new Error(`"navid" offers no ${want}: ${nav.join(', ')}`);
    if (nav.some((o) => !/Navidrome/.test(o))) throw new Error('"navid" offers others too: ' + nav.join(', '));
    if (nav[0] !== 'Open Navidrome') throw new Error('Open is not first: ' + nav.join(', '));
    if ((await picked()) !== nav[0]) throw new Error('the first is not picked: ' + (await picked()));
    await page.keyboard.press('ArrowDown');
    if ((await picked()) !== nav[1]) throw new Error('Down did not pick the second: ' + (await picked()));
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    if ((await picked()) !== nav[nav.length - 1]) throw new Error('Up from the first did not go round to the last: ' + (await picked()));
    // A name nothing has: said, with nothing to pick.
    await page.fill('.palette .palfield', 'zzzz');
    await page.waitForSelector('.palette .palfoot:text-is("Nothing has “zzzz”")', { timeout: 3000 });
    if ((await options()).length) throw new Error('zzzz offers something');
    await page.keyboard.press('Enter');
    // Escape: closed, the focus where it was.
    await page.keyboard.press('Escape');
    if (await page.$('.palette')) throw new Error('Escape did not close it');
    await page.waitForFunction(() => document.activeElement?.id === 'recoveryKit', null, { timeout: 2000 })
      .catch(async () => { throw new Error('the focus went to ' + (await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)))); });
    // Return runs the picked one: an app's page, from another screen.
    await palette();
    await page.keyboard.type('vikunja page');
    if ((await picked()) !== 'Vikunja’s page') throw new Error('"vikunja page" picks ' + (await picked()));
    await page.keyboard.press('Enter');
    await page.waitForSelector('#app.active h1:text-is("Vikunja")', { timeout: 5000 });
    if (await page.$('.palette')) throw new Error('it stayed open after Return');
  } },
  // Stop from the palette asks for a second press, as the row's menu does (Return again, or a click again); "stop media"
  // finds the group's Stop first, which stops each of its apps and offers Undo.
  { name: 'Command palette: Stop asks twice, and stop media stops the group', screen: 'status', mock: { usage }, run: async (page) => {
    const mac = await page.evaluate(() => /Mac/.test(navigator.platform));
    const palette = () => page.keyboard.press(mac ? 'Meta+k' : 'Control+k');
    const calls = () => page.evaluate(() => window.__MOCK.calls.AppAction || 0);
    await page.waitForSelector('#statusRows tr.grouphead', { timeout: 8000 });
    await palette();
    await page.waitForSelector('.palette .palfield', { timeout: 3000 });
    await page.keyboard.type('stop media');
    const first = await page.textContent('.palette [role=option][aria-selected=true] .pallabel');
    const n = Number(first.match(/^Stop the (\d+) Media apps$/)?.[1]);
    if (!n) throw new Error('"stop media" picks ' + first);
    await page.keyboard.press('Enter');
    await page.waitForSelector(`.palette [role=option].danger .pallabel:text-is("Press Return again to stop the ${n} Media apps")`, { timeout: 2000 });
    if (await calls()) throw new Error('one Return stopped them');
    await page.keyboard.press('Enter');
    if (await page.$('.palette')) throw new Error('it stayed open');
    await page.waitForFunction((k) => (window.__MOCK.calls.AppAction || 0) >= k, n, { timeout: 8000 });
    await page.waitForSelector(`.undonote .undowords:text-is("Stopped ${n} Media apps")`, { timeout: 8000 });
    // One app, by clicks: the first click asks, the second stops it.
    await page.waitForSelector('#statusRows tr.grouphead .groupcount:not([disabled])', { timeout: 8000 });
    await palette();
    await page.waitForSelector('.palette .palfield', { timeout: 3000 });
    await page.keyboard.type('stop vikunja');
    const stop = page.locator('.palette [role=option]', { hasText: 'Stop Vikunja' });
    await stop.click();
    await page.waitForSelector('.palette [role=option].danger .pallabel:text-is("Click again to stop Vikunja")', { timeout: 2000 });
    if ((await calls()) !== n) throw new Error('one click stopped Vikunja');
    await stop.click();
    await page.waitForFunction((k) => window.__MOCK.calls.AppAction === k + 1, n, { timeout: 5000 });
  } },
  // The commands used now and then: Back up now starts the backup on Backups, Update all shows its list first (nothing
  // applied), ⌘K does nothing while that sheet is open, and a press outside closes the palette.
  { name: 'Command palette: back up now, update all, and a press outside', screen: 'status', run: async (page) => {
    const mac = await page.evaluate(() => /Mac/.test(navigator.platform));
    const palette = async () => { await page.keyboard.press(mac ? 'Meta+k' : 'Control+k'); await page.waitForSelector('.palette .palfield', { timeout: 3000 }); };
    await page.waitForSelector('#statusRows tr.grouphead', { timeout: 8000 });
    // A press outside it closes it, as WebKit sends one (no focus moves).
    await palette();
    await page.dispatchEvent('#status h1', 'mousedown', { detail: 1 });
    if (await page.$('.palette')) throw new Error('a press outside did not close it');
    await palette();
    await page.keyboard.type('back up now');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#backups.active #backupPanel:not([hidden])', { timeout: 5000 });
    if (!/Backing up|Backup done/.test(await page.textContent('#backupTitle'))) throw new Error('the backup did not start: ' + (await page.textContent('#backupTitle')));
    await palette();
    await page.keyboard.type('update all');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#status.active', { timeout: 5000 });
    await page.waitForSelector('#cliPanel:not([hidden]) #cliTitle:text-is("Update all apps now")', { timeout: 5000 });
    await page.waitForSelector('#cliActions button:text-is("Update them")', { timeout: 5000 });
    // Its list, once: nothing applied until Update them.
    const ran = (await page.evaluate(() => window.__MOCK.homelabRan || [])).filter((r) => r !== 'backup');
    if (ran.join() !== 'update-all') throw new Error('ran: ' + ran.join());
    // A sheet owns the window: ⌘K leaves it be.
    await page.keyboard.press(mac ? 'Meta+k' : 'Control+k');
    await page.waitForTimeout(200);
    if (await page.$('.palette')) throw new Error('it opened over a sheet');
  } },
  { name: 'Status’s cards: short ones stacked beside the alerts, a long alert folded', screen: 'status', mock: { alerts: [
    { id: 'down', time: new Date(Date.now() - 3 * 36e5).toISOString(), topic: 'tunnel-watchdog', title: 'Homelab: something is down', message: ['filebrowser', 'syncthing', 'freshrss', 'prowlarr', 'sonarr', 'radarr', 'lidarr', 'bazarr', 'flaresolverr', 'seerr', 'lazylibrarian'].map((a) => a + ': not running').join('\n'), priority: 4 },
    ...alerts] }, run: async (page) => {
    await page.waitForSelector('#alertsCard:not([hidden]) li:has-text("something is down")', { timeout: 8000 });
    await page.waitForSelector('#protectCard:not([hidden])', { timeout: 8000 });
    await page.waitForSelector('#storageCard:not([hidden]) .sizes li', { timeout: 8000 });
    const box = async (sel) => page.locator(sel).boundingBox();
    const [prot, stor, al] = [await box('#protectCard'), await box('#storageCard'), await box('#alertsCard')];
    if (Math.abs(prot.x - stor.x) > 1 || stor.y < prot.y + prot.height) throw new Error('What the apps keep is not under Protection, in its column');
    if (al.x < prot.x + prot.width) throw new Error('Recent alerts is not beside them');
    const row = page.locator('#alertsCard li:has-text("something is down")');
    const shown = await row.locator('.grow > .muted > div').count();
    if (shown !== 3) throw new Error(`a long alert shows ${shown} lines, not 3`);
    await row.locator('button.morelines:text-is("Show 8 more")').click();
    if ((await row.locator('.grow > .muted > div').count()) !== 11) throw new Error('Show 8 more did not show every line');
    const size = page.locator('#storageCard .sizes li').first();
    const [name, bar] = [await size.locator('strong').boundingBox(), await size.locator('.bar').boundingBox()];
    if (bar.y > name.y + name.height || bar.x < name.x + name.width) throw new Error('an app’s size takes two lines');
  } },
  // Start, Stop, and Restart run quietly: the row says what it is doing (an image coming down first included) and
  // Status shows the result, with no sheet of Docker's output to close. A failure says why under the row, and
  // Details shows that output.
  { name: 'Status: Start runs quietly, a download said on the row, and Details after a failure', screen: 'status', mock: { statusOpen: 'all', actionDelay: 700,
    actionLog: { ...actionLog, start: [' %s Pulling', ' 4f4fb700ef54 Downloading [=====>     ]  12.5MB/50MB', ' Container %s  Starting', ' Container %s  Started'] } }, run: async (page) => {
    const row = '#statusRows tr:has(strong:text-is("Mealie"))';
    await page.click(`${row} button:text-is("Start")`, { timeout: 5000 });
    await page.waitForSelector(`${row} td.state:has-text("Downloading the app…")`, { timeout: 3000 })
      .catch(async () => { throw new Error('the row says ' + (await page.textContent(`${row} td.state`))); });
    if (await page.isVisible('#cliPanel')) throw new Error('a sheet opened for Start');
    await page.waitForSelector(`${row} td.state:has-text("Running")`, { timeout: 8000 });
    if (await page.isVisible('#cliPanel')) throw new Error('a sheet opened after Start');
    // A failure: why, under the row, and Details for what Docker said.
    await page.evaluate(() => { window.__MOCK.actionError = 'port 9925 is taken by another program'; window.__MOCK.actionDelay = 0; });
    await page.click(`${row} button:text-is("Restart")`).catch(async () => {
      await page.click(`${row}`, { button: 'right' });
      await page.click('.rowmenu [role=menuitem]:text-is("Restart")');
    });
    await page.waitForSelector(`${row} .rowerr:has-text("Could not restart: port 9925 is taken by another program")`, { timeout: 5000 });
    await page.click(`${row} .rowerr button:text-is("Details")`);
    await page.waitForSelector('#cliPanel:not([hidden]) #cliTitle:text-is("Mealie: what happened")', { timeout: 3000 });
    if (!(await page.textContent('#cliLog')).includes('$ homelab restart mealie')) throw new Error('Details: ' + (await page.textContent('#cliLog')));
  } },
  // Undo: after a group's Stop all, a note says what stopped, and Undo starts those same apps again; nothing for Restart.
  { name: 'Undo: after Stop all, the note starts them again', screen: 'status', mock: { usage }, run: async (page) => {
    const head = 'tr.grouphead:has(.foldbtn:has-text("Media"))';
    await page.waitForSelector(`${head} .groupcount`, { timeout: 8000 });
    await page.click(`${head} .groupcount`);
    await page.locator(head).scrollIntoViewIfNeeded();
    const n = Number((await page.locator(`${head} .groupmenulist [role=menuitem]:has-text("Restart")`).textContent()).match(/\d+/)?.[0] || 1);
    await page.click(`${head} .groupmenulist [role=menuitem]:has-text("Restart")`);
    await page.waitForFunction((k) => (window.__MOCK.calls.AppAction || 0) >= k, n, { timeout: 8000 });
    await page.waitForTimeout(300);
    if (await page.isVisible('.undonote')) throw new Error('a note to undo a restart');
    await page.waitForSelector(`${head} .groupcount:not([disabled])`, { timeout: 8000 });
    await page.click(`${head} .groupcount`);
    await page.click(`${head} .groupmenulist [role=menuitem]:not(.stoplater):has-text("Stop")`);
    await page.click(`${head} .groupmenulist [role=menuitem]:has-text("Click again")`);
    await page.waitForSelector(`.undonote .undowords:text-is("Stopped ${n} Media apps")`, { timeout: 8000 });
    const before = await page.evaluate(() => window.__MOCK.calls.AppAction);
    await page.click('.undonote .undobtn');
    await page.waitForFunction(([b, k]) => window.__MOCK.calls.AppAction >= b + k, [before, n], { timeout: 8000 });
    if (await page.isVisible('.undonote')) throw new Error('the note stayed after Undo');
  } },
  // ⌘Z (Ctrl+Z) undoes too while the note shows, as Undo does; the note goes by itself after 10 seconds, but not while the
  // pointer is on it.
  { name: 'Undo: ⌘Z after a Stop, and the note’s 10 seconds', screen: 'app:vikunja', run: async (page) => {
    await page.click('#app .pagehead .btngroup button:text-is("Stop")', { timeout: 5000 });
    await page.click('#app .pagehead button:text-is("Click again to stop")');
    await page.waitForSelector('.undonote .undowords:text-is("Stopped Vikunja")', { timeout: 5000 });
    if (await page.isVisible('#cliPanel')) throw new Error('a sheet opened for a Stop: it runs on the row now');
    const mac = await page.evaluate(() => /Mac/.test(navigator.platform));
    await page.keyboard.press(mac ? 'Meta+z' : 'Control+z');
    await page.waitForFunction(() => window.__MOCK.calls.AppAction >= 2, null, { timeout: 5000 });
    if (await page.isVisible('.undonote')) throw new Error('the note stayed after ⌘Z');
    await page.waitForSelector('#app .pagehead .btngroup button:text-is("Stop")', { timeout: 5000 });
    await page.click('#app .pagehead .btngroup button:text-is("Stop")');
    await page.click('#app .pagehead button:text-is("Click again to stop")');
    const note = page.locator('.undonote');
    await note.waitFor({ timeout: 5000 });
    await note.hover();
    await page.waitForTimeout(10600);
    if (!(await note.isVisible())) throw new Error('the note went while the pointer was on it');
    await page.mouse.move(5, 5);
    await note.waitFor({ state: 'detached', timeout: 11000 });
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
  // Status read aloud: a screen reader hears each row's change as it is drawn, through one polite live region: a
  // Restart's step and its end, and apps that go down together in one line. Nothing on the first draw, nor while
  // another screen is shown.
  { name: 'Status read aloud: a row’s change, a job’s step, and two apps at once', screen: 'status', run: async (page) => {
    await page.waitForSelector('tr:has(strong:text-is("Vikunja")) td.state:has-text("Running")', { timeout: 5000 });
    await page.evaluate(() => {
      window.__said = [];
      const el = document.getElementById('statusAloud');
      new MutationObserver(() => { if (el.textContent) window.__said.push(el.textContent); }).observe(el, { childList: true, characterData: true, subtree: true });
    });
    const said = () => page.evaluate(() => window.__said);
    if ((await page.getAttribute('#statusAloud', 'role')) !== 'status') throw new Error('the region is not a status');
    await page.waitForTimeout(400);
    if ((await said()).length) throw new Error(`said on the first draw: ${await said()}`);
    // A Restart: its step as it starts, and the state it ends in.
    await page.evaluate(() => { window.__MOCK.actionDelay = 900; });
    await page.click('tr:has(strong:text-is("Vikunja")) td.state', { button: 'right' });
    await page.click('.rowmenu button:text-is("Restart")');
    await page.waitForFunction(() => window.__said.includes('Vikunja: Restarting…'), null, { timeout: 3000 })
      .catch(async () => { throw new Error(`no "Vikunja: Restarting…" in ${JSON.stringify(await said())}`); });
    await page.waitForFunction(() => window.__said.at(-1) === 'Vikunja: Running', null, { timeout: 5000 })
      .catch(async () => { throw new Error(`the end not said: ${JSON.stringify(await said())}`); });
    // Two apps down at once: one line.
    await page.evaluate(() => {
      const M = window.__MOCK;
      M.status = { ...M.status, apps: M.status.apps.map((a) => (a.id === 'vikunja' || a.id === 'navidrome' ? { ...a, health: 'unhealthy' } : a)) };
      window.__emit('status:changed', { apps: ['vikunja', 'navidrome'], status: M.status });
    });
    await page.waitForFunction(() => /^(Vikunja and Navidrome|Navidrome and Vikunja): Unhealthy$/.test(window.__said.at(-1) || ''), null, { timeout: 3000 })
      .catch(async () => { throw new Error(`two apps not said together: ${JSON.stringify(await said())}`); });
    // On another screen, Status's changes are not read out.
    const n = (await said()).length;
    await page.click('nav button[data-screen="backups"]');
    await page.evaluate(() => {
      const M = window.__MOCK;
      M.status = { ...M.status, apps: M.status.apps.map((a) => (a.id === 'navidrome' ? { ...a, state: 'stopped', health: '' } : a)) };
      window.__emit('status:changed', { apps: ['navidrome'], status: M.status });
    });
    await page.waitForTimeout(600);
    if ((await said()).length !== n) throw new Error(`said on Backups: ${JSON.stringify((await said()).slice(n))}`);
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
  // Every alert…: the computer's record, past ntfy's 12 hours, each saying when it cleared or who snoozed it, until when.
  ...[[], ['companion']].map((phone) => ({ name: `Every alert on Recent alerts lists the kept ones${phone.length ? ', on the phone' : ''}`, screen: 'status', phone: phone.length ? phone : undefined, run: async (page) => {
    await page.locator('#alertsCard').getByRole('button', { name: 'Every alert…' }).click();
    const sheet = page.locator('#alertLogSheet');
    await sheet.locator('h2:has-text("Every alert")').waitFor({ timeout: 5000 });
    await sheet.locator('li').nth(3).waitFor({ timeout: 3000 });
    const texts = await sheet.locator('li').allTextContents();
    if (texts.length !== 4) throw new Error(`four kept: ${JSON.stringify(texts)}`);
    if (!/Snoozed by Sam’s iPhone until/.test(texts[0].replace("'", '’'))) throw new Error(`who snoozed it: ${texts[0]}`);
    if (!/Cleared at /.test(texts[2])) throw new Error(`when it cleared: ${texts[2]}`);
    if (!texts[3].includes('rolled back')) throw new Error(`two days ago: ${texts[3]}`);
    await sheet.getByRole('button', { name: 'Close' }).click();
    await sheet.waitFor({ state: 'hidden', timeout: 3000 });
  } })),
  // Snooze… on an alert whose watchdog check still fails, as the Watchdog card has it (#596's gap 3); none on
  // one that cleared, one about no check, or one whose check passes now. A phone that only looks has none.
  ...[[], ['companion', 'can-change'], ['companion']].map((phone) => ({ name: `Every alert: Snooze on an alert whose check still fails${phone.length ? (phone.includes('can-change') ? ', on a phone that may change things' : ', none on a phone that only looks') : ''}`, screen: 'status', phone: phone.length ? phone : undefined,
    mock: { watchdog: { ...watchdog, failing: [{ name: 'immich', problem: 'not answering', since: hoursAgo(0.3) }] }, alertLog: [{ id: 5, at: hoursAgo(0.3), topic: 'tunnel-watchdog', title: 'Homelab: something is down', body: 'immich: not answering', priority: 4, checks: ['immich'] }, ...alertLog] }, run: async (page) => {
      await page.locator('#alertsCard').getByRole('button', { name: 'Every alert…' }).click();
      const sheet = page.locator('#alertLogSheet');
      await sheet.locator('li').nth(4).waitFor({ timeout: 5000 });
      const picks = sheet.locator('select.snoozepick');
      if (phone.length && !phone.includes('can-change')) {
        if (await picks.first().isVisible().catch(() => false)) throw new Error('Snooze on a phone that only looks');
        return;
      }
      // Only the open one: crowdsec bouncer passes now, vikunja cleared, the reminder is about no check.
      const pick = sheet.locator('li').first().locator('select[aria-label="Snooze the alerts about immich"]');
      await pick.waitFor({ state: 'visible', timeout: 3000 });
      if ((await picks.count()) !== 1) throw new Error(`one Snooze: ${await picks.count()}`);
      await pick.selectOption('1');
      await sheet.locator('li').first().locator('select.snoozepick option:first-child:has-text("Snoozed until")').waitFor({ state: 'attached', timeout: 5000 });
      const calls = await page.evaluate(() => window.__MOCK.calls.SnoozeCheck);
      if (!calls) throw new Error('not snoozed');
    } })),
  { name: 'Every alert with none kept says so', screen: 'status', mock: { alertLog: [] }, run: async (page) => {
    await page.locator('#alertsCard').getByRole('button', { name: 'Every alert…' }).click();
    await page.locator('#alertLogSheet').getByText('No alerts kept yet.', { exact: false }).waitFor({ timeout: 5000 });
  } },
  // Check again reads the alerts now: one whose problem cleared is gone.
  { name: 'Check again on Recent alerts reads them now', screen: 'status', run: async (page) => {
    await page.waitForSelector('#alertsCard:has-text("3 in the last 12 hours")', { timeout: 5000 });
    await page.evaluate(() => { window.__MOCK.alerts = window.__MOCK.alerts.slice(0, 2); });
    await page.click('#alertsCheck');
    await page.waitForSelector('#alertsCard:has-text("2 in the last 12 hours") #alertsCheck:has-text("Check again"):not([disabled])', { timeout: 5000 });
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
  // Folds are kept by the computer now (the owner, Nov 10), so the one call
  // folding makes is keeping them; it still reads nothing again.
  { name: 'Opening and folding every category reads nothing again, only keeps the folds', screen: 'status', mock: { statusOpen: '' }, run: async (page) => {
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
    const asked = diffCalls(before, await backendCalls(page)).filter((c) => !c.startsWith('SetStatusFolds'));
    if (asked.length) throw new Error('folding asked the backend: ' + asked.join(', '));
    const last = await page.evaluate(() => JSON.stringify(window.__MOCK.statusFoldsSaved?.at(-1)));
    if (last !== '{}') throw new Error('Fold them again kept ' + last);
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
  // A group's count opens its menu: what it holds in memory (an app with its helpers), each running app's share,
  // and Start, Restart, or Stop for them all; Stop asks for a second click, and Escape closes the menu back on the count.
  { name: 'A group’s menu on Status: its memory, and Restart or Stop them all', screen: 'status', mock: { usage }, run: async (page) => {
    const head = 'tr.grouphead:has(.foldbtn:has-text("Documents"))';
    await page.waitForSelector(`${head} .groupcount:has-text("MB")`, { timeout: 8000 });
    await page.click(`${head} .groupcount`);
    await page.waitForSelector(`${head} .groupmenulist .memlist li:has-text("Paperless"):has-text("640 MB")`, { timeout: 5000 });
    if (!(await page.isVisible(`${head} .groupmenulist .menuhead:has-text("in memory now")`))) throw new Error('no memory line');
    const restart = page.locator(`${head} .groupmenulist [role=menuitem]:has-text("Restart")`);
    const n = Number((await restart.textContent()).match(/\d+/)?.[0] || 1);
    const before = await page.evaluate(() => window.__MOCK.calls.AppAction || 0);
    await restart.click();
    await page.waitForFunction(([b, k]) => (window.__MOCK.calls.AppAction || 0) >= b + k, [before, n], { timeout: 8000 });
    if (await page.isVisible(`${head} .groupmenulist`)) throw new Error('the menu stayed open after Restart');
    await page.waitForSelector(`${head} .groupcount:not([disabled])`, { timeout: 8000 });
    await page.click(`${head} .groupcount`);
    const stop = page.locator(`${head} .groupmenulist [role=menuitem]:not(.stoplater):has-text("Stop")`);
    const mid = await page.evaluate(() => window.__MOCK.calls.AppAction || 0);
    await stop.click();
    await page.waitForSelector(`${head} .groupmenulist [role=menuitem]:has-text("Click again to stop")`, { timeout: 3000 });
    if ((await page.evaluate(() => window.__MOCK.calls.AppAction || 0)) !== mid) throw new Error('one click on Stop stopped something');
    await page.keyboard.press('Escape');
    await page.waitForSelector(`${head} .groupmenulist`, { state: 'detached', timeout: 2000 });
    if (!(await page.$eval(`${head} .groupcount`, (b) => b === document.activeElement))) throw new Error('Escape did not put the focus back on the count');
    await page.click(`${head} .groupcount`);
    await page.click(`${head} .groupmenulist [role=menuitem]:not(.stoplater):has-text("Stop")`);
    await page.click(`${head} .groupmenulist [role=menuitem]:has-text("Click again")`);
    await page.waitForFunction(([b, k]) => (window.__MOCK.calls.AppAction || 0) >= b + k, [mid, n], { timeout: 8000 });
  } },
  // The last group's menu is whole, not cut at the card's edge (a click on each item lands on it), and opening
  // another group's menu closes the first: one menu at a time. The last group is folded, so its heading is the
  // table's last row, and the clicks are as WebKit's on the Mac: a mouse click that leaves no focus on the button.
  { name: 'A group’s menu at the bottom of Status is whole, and one menu opens at a time', screen: 'status', mock: { usage }, run: async (page) => {
    const press = async (b) => { await b.dispatchEvent('mousedown', { detail: 1 }); await b.dispatchEvent('click', { detail: 1 }); };
    const heads = page.locator('#statusRows tr.grouphead') // Status's own (Backups' copies have group rows too, drawn once its data is read);
    await heads.first().waitFor({ timeout: 5000 });
    const last = heads.last();
    if ((await last.locator('.foldbtn').getAttribute('aria-expanded')) === 'true') await last.locator('.foldbtn').click();
    if (!(await page.$eval('#statusRows', (b) => b.lastElementChild.classList.contains('grouphead')))) throw new Error('the last group is not the last row');
    await last.locator('.groupcount').scrollIntoViewIfNeeded();
    await press(last.locator('.groupcount'));
    await page.locator('.groupmenulist [role=menuitem]').first().waitFor({ timeout: 3000 });
    await page.waitForTimeout(100);
    const missed = await page.$$eval('.groupmenulist [role=menuitem]', (bs) => bs.filter((b) => { const r = b.getBoundingClientRect(); const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !at || !b.contains(at); }).map((b) => b.textContent.trim()));
    if (missed.length) throw new Error(`cut off: ${missed.join(', ')}`);
    await press(heads.first().locator('.groupcount'));
    await page.waitForTimeout(300);
    const open = await page.locator('.groupmenulist').count();
    if (open !== 1) throw new Error(`${open} menus open after opening a second`);
    if ((await heads.first().locator('.groupcount').getAttribute('aria-expanded')) !== 'true') throw new Error('the second menu did not open');
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
    .flatMap(([sys, m]) => ['status', 'backups', 'setup', 'settings', 'choose', 'finances', 'tidy', 'app:vikunja'].map((screen) => ({ name: `Nothing scrolls sideways in the smallest window, ${screen.replace('app:vikunja', 'an app’s page')}, ${sys}`, screen, mock: { ...m, weekly: longWeek,
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
  { name: "Keyboard: Status's More… menu opens, moves with the arrows, and closes when the focus leaves it", screen: 'status', run: async (page) => {
    const state = () => page.evaluate(() => `${document.getElementById('statusMenu').hidden ? 'closed' : 'open'} ${(document.activeElement.textContent || '').trim()}`);
    const expect = async (step, want) => { await page.waitForTimeout(120); const got = await state(); if (got !== want) throw new Error(`${step}: ${got}, not ${want}`); };
    await page.focus('#statusMore');
    await page.keyboard.press('Enter'); await expect('Enter on More…', 'open Connect apps');
    await page.keyboard.press('ArrowDown'); await expect('Down', 'open Clean up old containers');
    await page.keyboard.press('ArrowDown'); await expect('Down from the last item', 'open Connect apps');
    await page.keyboard.press('ArrowUp'); await expect('Up from the first item', 'open Clean up old containers');
    await page.keyboard.press('Escape'); await expect('Escape', 'closed More…');
    await page.keyboard.press('ArrowDown'); await expect('Down on More…', 'open Connect apps');
    for (let i = 0; i < 4 && await page.evaluate(() => !!document.activeElement.closest('.menuwrap')); i++) await page.keyboard.press('Tab');
    await page.waitForTimeout(120);
    if (!(await page.$eval('#statusMenu', (m) => m.hidden))) throw new Error('the menu stays open after the focus left it');
  } },
  { name: 'A long command can be hidden: it carries on, its bar in the sidebar, and comes back from there', screen: 'status', mock: { homelabDelay: 2500, jobApps: { 'update-all': ['navidrome', 'vikunja', 'mealie'] } }, run: async (page) => {
    await page.click('#updateAll', { timeout: 5000 });
    await page.click('#cliActions button:has-text("Update them")', { timeout: 5000 });
    // Running, the sheet offers Hide, and Escape presses it.
    await page.waitForSelector('#cliActions button:text-is("Hide")', { timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForSelector('#cliPanel', { state: 'hidden', timeout: 3000 });
    if (await page.evaluate(() => document.documentElement.classList.contains('sheet-open'))) throw new Error('the screen stayed dimmed');
    await page.waitForSelector('#bgJob .bgjob.running .bgtitle:text-is("Update all apps now")', { timeout: 3000 });
    // Another command waits for it, saying so, and leaves its sheet be.
    await page.click('#updateAll');
    await page.waitForSelector('#error:not([hidden]):has-text("Wait for “Update all apps now” to finish")', { timeout: 3000 });
    if (await page.isVisible('#cliPanel')) throw new Error('a second command took the sheet');
    // The rest of the app is there to use meanwhile.
    await page.click('nav button[data-screen="backups"]');
    await page.waitForSelector('#backups.active', { timeout: 3000 });
    // A job of another screen waits its turn, saying so, and the chip says what is next.
    await page.click('#backupNow');
    await page.waitForSelector('#backupPanel:not([hidden]) #backupTitle:has-text("Waiting for “Update all apps now” to finish, then: Backing up…")', { timeout: 3000 });
    await page.waitForSelector('#bgJob .bgnext:text-is("Then: Backing up")', { timeout: 3000 });
    if ((await page.evaluate(() => window.__MOCK.homelabRan || [])).includes('backup')) throw new Error('the backup ran beside the command');
    // Done: the chip says so, and brings back the sheet, which says how it went.
    await page.waitForSelector('#bgJob .bgjob.done .bgstep:text-is("Done")', { timeout: 10000 });
    // Then the backup runs, in its turn.
    await page.waitForSelector('#backupTitle:text-is("Backup done")', { timeout: 10000 });
    await page.click('#bgJob .bgopen');
    await page.waitForSelector('#cliPanel:not([hidden]) #cliActions button:text-is("Close")', { timeout: 3000 });
    if (await page.$('#bgJob .bgjob')) throw new Error('the chip stayed with its sheet open');
    const ran = await page.evaluate(() => window.__MOCK.homelabRan || []);
    if (ran.join() !== 'update-all,update-all,backup') throw new Error('ran, in order: ' + ran.join());
  } },
  { name: 'An app’s Restart waits its turn behind a running command, saying so, and the other rows stay usable', screen: 'status', mock: { homelabDelay: 2500, jobApps: { 'update-all': ['navidrome', 'vikunja', 'mealie'] } }, run: async (page) => {
    await page.click('#updateAll', { timeout: 5000 });
    await page.click('#cliActions button:has-text("Update them")', { timeout: 5000 });
    await page.click('#cliActions button:text-is("Hide")', { timeout: 5000 });
    await page.waitForSelector('#cliPanel', { state: 'hidden', timeout: 3000 });
    const row = (name) => page.locator('#statusRows tr', { has: page.locator(`text="${name}"`) }).first();
    // Every row's buttons are there to press while it runs.
    if (await row('Vaultwarden').locator('button:has-text("Open")').isDisabled()) throw new Error('the rows are held while the command runs');
    await row('Vaultwarden').click({ button: 'right' });
    await page.click('.rowmenu [role=menuitem]:has-text("Restart")', { timeout: 3000 });
    await row('Vaultwarden').locator('text=Waiting for “Update all apps now” to finish').waitFor({ timeout: 3000 });
    if (await page.evaluate(() => window.__MOCK.calls.AppAction || 0)) throw new Error('the restart ran beside the command');
    // Then it runs, in its turn.
    await page.waitForFunction(() => (window.__MOCK.calls.AppAction || 0) > 0, null, { timeout: 15000 });
  } },
  { name: 'Keyboard: Tab and Shift+Tab stay inside an open sheet, before and after its job', screen: 'status', mock: { jobApps: { 'update-all': ['navidrome', 'vikunja', 'mealie'] } }, run: async (page) => {
    await page.click('#updateAll', { timeout: 5000 });
    await page.waitForSelector('#cliActions button:has-text("Update them")', { timeout: 5000 });
    const walk = async (key) => {
      const out = [];
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press(key);
        out.push(await page.evaluate(() => { const e = document.activeElement; return e.closest('.panel.sheet:not([hidden])') ? '' : `${e.tagName.toLowerCase()} "${(e.textContent || '').trim().slice(0, 20)}"`; }));
      }
      return out.filter(Boolean);
    };
    let out = [...await walk('Tab'), ...await walk('Shift+Tab')];
    if (out.length) throw new Error(`the focus left the sheet for ${out.join(', ')}`);
    await page.click('#cliActions button:has-text("Update them")');
    await page.waitForSelector('#cliActions button:has-text("Close")', { timeout: 8000 });
    out = [...await walk('Tab'), ...await walk('Shift+Tab')];
    if (out.length) throw new Error(`after the job, the focus left the sheet for ${out.join(', ')}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    if (!(await page.$eval('#updateAll', (e) => e === document.activeElement))) throw new Error('closing the sheet did not put the focus back on Update apps');
  } },
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
  ...[['Choose apps', 'choose', '#choose .cols'], ['Status', 'status', '#status .duo'], ['an app’s page', 'app:vikunja', '#app .pagecols']].map(([label, screen, sel]) => ({ name: `${label}: two columns only when there is room for both at the text size`, screen, mock: pageMock, run: async (page) => {
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
  // A computer set to another language: the app's dates stay in English words, in that computer's order and clock.
  ...[['German', 'de-DE', /Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|\d+\. (Jan|Feb|März|Apr|Mai|Juni|Juli|Aug|Sept|Okt|Nov|Dez)/], ['Japanese', 'ja-JP', /[月火水木金土日]曜日|\d+月\d+日/]].map(([lang, locale, foreign]) => ({ name: `A computer set to ${lang}: an app's dates in English, in its own order`, screen: 'app:vikunja', locale, mock: pageMock, run: async (page) => {
    await page.waitForSelector('#app .weekbars', { timeout: 5000 });
    const text = await page.$eval('#app', (e) => e.innerText);
    const found = text.match(foreign);
    if (found) throw new Error(`says "${found[0]}" in an English sentence`);
    if (!/Restore test passed \d{1,2} [A-Z][a-z]{2}\b/.test(text)) throw new Error(`the restore test's date is not day then month: ${(text.match(/Restore test passed [^\n]*/) || [''])[0]}`);
    const letters = await page.$$eval('#app .weekbars .day', (d) => d.map((x) => x.textContent.trim()));
    if (letters.some((l) => !/^[SMTWF]$/.test(l))) throw new Error(`the week's days are ${letters.join(' ')}`);
  } })),
  { name: 'A computer in the US keeps its dates as they were', screen: 'app:vikunja', locale: 'en-US', mock: pageMock, run: async (page) => {
    await page.waitForSelector('#app .weekbars', { timeout: 5000 });
    const text = await page.$eval('#app', (e) => e.innerText);
    if (!/Restore test passed [A-Z][a-z]{2} \d{1,2}\b/.test(text)) throw new Error(`the restore test's date is not month then day: ${(text.match(/Restore test passed [^\n]*/) || [''])[0]}`);
    if (!/(Today|Yesterday), \d{1,2}:\d{2} (AM|PM)/.test(text)) throw new Error('the last backup is not on a 12-hour clock');
  } },
  // A big monitor: every screen sits in the middle of the space beside the sidebar, not against it.
  ...['status', 'backups', 'settings', 'setup', 'finances', 'app:vikunja'].map((screen) => ({ name: `A big monitor centers ${screen === 'app:vikunja' ? 'an app\'s page' : 'the ' + screen[0].toUpperCase() + screen.slice(1) + ' screen'}`, screen, mock: screen === 'app:vikunja' ? pageMock : undefined, run: async (page) => {
    await page.setViewportSize({ width: 2560, height: 1440 });
    await page.waitForTimeout(300);
    const gaps = await page.evaluate(() => {
      const m = document.querySelector('main'), s = document.querySelector('main > .screen.active');
      const mr = m.getBoundingClientRect(), sr = s.getBoundingClientRect(), cs = getComputedStyle(m);
      return { left: sr.left - mr.left - parseFloat(cs.paddingLeft), right: mr.right - parseFloat(cs.paddingRight) - (mr.width - m.clientWidth) - sr.right };
    });
    if (gaps.left < 100 || Math.abs(gaps.left - gaps.right) > 2) throw new Error(`${Math.round(gaps.left)}px on the left and ${Math.round(gaps.right)}px on the right`);
  } })),
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
  // What happened overnight: in the morning, Status's first line is the night since 8 PM (updates, a rollback, the night's
  // copies, and whether anything needed you); an app down overnight says so instead; Hide until tomorrow keeps it away for
  // the day; in the afternoon there is none.
  ...(() => {
    const at = (h, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };
    const morning = at(7, 30), iso = (h, m = 0) => at(h, m).toISOString();
    const night = {
      overnight: true,
      status: { ...status, apps: status.apps.map((a) => ({ ...a, updatedAt: ['vikunja', 'speedtest-tracker'].includes(a.id) ? iso(4) : undefined })) },
      alerts: [{ id: 'r1', time: iso(4, 20), topic: 'watchtower', title: 'Homelab: Navidrome rolled back', message: 'It runs the version from before its update again.', tags: ['rewind'] },
        { id: 'o1', time: at(5, 0).toISOString(), topic: 'tunnel-watchdog', title: 'Homelab: recovered', message: 'all well' }],
      backups: { ...backups, copies: [{ id: 'immich', name: 'Immich', newest: iso(3, 30), size: 1.5 * 1024 ** 3, count: 7, state: 'fresh' }, { id: 'paperless', name: 'Paperless-ngx', newest: iso(3, 35), size: 0.6 * 1024 ** 3, count: 7, state: 'fresh' }, { id: 'old', name: 'Mealie', newest: new Date(at(3).getTime() - 864e5).toISOString(), size: 9e9, count: 7, state: 'stale' }] },
      watchdog: { lastRun: morning.toISOString(), checks: 40, failing: [], pending: 0, week: {}, outages: {} },
    };
    const line = '#overnightLine .overnight';
    return [
      // Backups failing in the morning: the overnight line asks for it again at most once a minute, not over and over.
      { name: 'What happened overnight: Backups failing is not asked for over and over', screen: 'status', mock: { ...night, backupsError: 'the database is locked' }, run: async (page) => {
        await page.clock.setFixedTime(morning);
        await page.evaluate(() => { window.__MOCK.calls.Backups = 0; window.__emit('status:changed'); });
        await page.waitForSelector('#statusRows tr', { timeout: 5000 });
        await page.waitForTimeout(1500);
        const asked = await page.evaluate(() => window.__MOCK.calls.Backups || 0);
        if (asked > 2) throw new Error(`Backups was asked ${asked} times in a second and a half`);
        await page.waitForSelector(line, { timeout: 5000 });
      } },
      { name: 'What happened overnight: Status’s first line in the morning', screen: 'status', mock: night, run: async (page) => {
        await page.clock.setFixedTime(morning);
        await page.evaluate(() => window.__emit('status:changed'));
        await page.waitForSelector(line, { timeout: 5000 });
        await page.waitForFunction((s) => /backup/.test(document.querySelector(s)?.textContent || ''), line, { timeout: 5000 });
        const said = (await page.textContent(`${line} > span`)).trim();
        if (said !== 'Overnight: 2 apps updated, 1 rolled back, a backup of 2.1 GB, nothing needed you.') throw new Error('it says: ' + said);
        // Above the machine's line, under the heading.
        if (!(await page.evaluate(() => document.getElementById('overnightLine').nextElementSibling?.id === 'healthLine'))) throw new Error('not above the machine’s line');
        await page.click(`${line} button:text-is("Hide until tomorrow")`);
        await page.waitForSelector('#overnightLine', { state: 'hidden', timeout: 2000 });
        await page.evaluate(() => window.__emit('status:changed'));
        await page.waitForTimeout(400);
        if (await page.isVisible(line)) throw new Error('back after Hide until tomorrow');
      } },
      { name: 'What happened overnight: an app down in the night says so, and none in the afternoon', screen: 'status',
        mock: { ...night, watchdog: { ...night.watchdog, outages: { 'immich-server': [{ from: iso(2, 10), to: iso(2, 40), problem: 'HTTP 502' }] } } }, run: async (page) => {
        await page.clock.setFixedTime(morning);
        await page.evaluate(() => window.__emit('status:changed'));
        await page.waitForFunction((s) => /was down/.test(document.querySelector(s)?.textContent || ''), line, { timeout: 5000 });
        if (!/Immich was down for a while\.$/.test((await page.textContent(`${line} > span`)).trim())) throw new Error('it says: ' + await page.textContent(line));
        await page.clock.setFixedTime(at(15));
        await page.evaluate(() => window.__emit('status:changed'));
        await page.waitForSelector('#overnightLine', { state: 'hidden', timeout: 3000 });
      } },
    ];
  })(),
  // What changed since you looked: nothing the first time; after leaving Status, a row whose app restarted, updated, stopped,
  // or started meanwhile has a dot saying how (its name for a screen reader); leaving Status again clears them. An app's page
  // counts as Status. Kept on this device across launches.
  { name: 'What changed since you looked: a dot on each row, cleared once seen', screen: 'status', run: async (page) => {
    const dots = () => page.$$eval('#statusRows tr:not(.grouphead)', (rs) => rs.filter((r) => r.querySelector('.changedot')).map((r) => `${r.querySelector('strong').textContent}: ${r.querySelector('.changedot').getAttribute('aria-label')}`).sort());
    await page.waitForSelector('#statusRows tr:has(strong:text-is("Vikunja"))', { timeout: 5000 });
    if ((await dots()).length) throw new Error('dots on the first visit: ' + (await dots()).join(', '));
    // An app's page is still Status: nothing is seen yet.
    await page.click('#statusRows tr:has(strong:text-is("Vikunja")) button.topage');
    await page.waitForSelector('#app.active', { timeout: 3000 });
    if (await page.evaluate(() => localStorage.getItem('homelab.statusSeen'))) throw new Error('an app’s page counted as leaving Status');
    await page.click('nav button[data-screen=setup]');
    await page.waitForSelector('#setup.active', { timeout: 3000 });
    // Meanwhile: Vikunja restarted, Navidrome updated, Mealie started, Immich stopped.
    await page.evaluate(() => {
      const now = new Date().toISOString();
      window.__MOCK.status = { ...window.__MOCK.status, apps: window.__MOCK.status.apps.map((a) => (
        a.id === 'vikunja' ? { ...a, since: now }
          : a.id === 'navidrome' ? { ...a, since: now, updatedAt: now }
          : a.id === 'mealie' ? { ...a, state: 'running', health: 'healthy', since: now }
          : a.id === 'immich-server' ? { ...a, state: 'stopped', health: '', since: undefined } : a)) };
    });
    await page.click('nav button[data-screen=status]');
    await page.evaluate(() => window.__emit('status:changed'));
    const want = ['Immich: Stopped since you looked', 'Mealie: Started since you looked', 'Navidrome: Updated since you looked', 'Vikunja: Restarted since you looked'];
    await page.waitForFunction((n) => document.querySelectorAll('#statusRows .changedot').length === n, want.length, { timeout: 5000 }).catch(() => {});
    if ((await dots()).join(' | ') !== want.join(' | ')) throw new Error('dots: ' + (await dots()).join(' | '));
    if ((await page.$eval('#statusRows .changedot', (d) => d.getAttribute('role'))) !== 'img') throw new Error('a dot has no name for a screen reader');
    // Seen: leaving and coming back clears them.
    await page.click('nav button[data-screen=backups]');
    await page.click('nav button[data-screen=status]');
    await page.waitForFunction(() => !document.querySelector('#statusRows .changedot'), null, { timeout: 3000 });
  } },
  { name: 'An app that was down this week says so', screen: 'status', mock: { watchdog: { lastRun: new Date().toISOString(), checks: 40, failing: [], pending: 0, week: { navidrome: 0.962, vaultwarden: 1 } } }, run: async (page) => {
    await page.waitForSelector('tr:has(strong:text-is("Navidrome")) .badge:has-text("96.2% up this week")', { timeout: 5000 });
    if (await page.isVisible('tr:has(strong:text-is("Vaultwarden")) .badge:has-text("up this week")')) throw new Error('a healthy app should not carry the badge');
  } },
  // Hover "96.2% up this week" (or Tab to it, or tap it): the week as a strip with each time it was down, and why.
  { name: 'The week’s outages on hover', screen: 'status', mock: { watchdog: { lastRun: new Date().toISOString(), checks: 40, failing: [], pending: 0, week: { navidrome: 0.962, vaultwarden: 0.98 },
    outages: { navidrome: [{ from: hoursAgo(50), to: hoursAgo(49.25), problem: 'nothing answers on its port' }, { from: hoursAgo(5), to: hoursAgo(4.5), problem: 'HTTP 502' }] } } }, run: async (page) => {
    const badge = 'tr:has(strong:text-is("Navidrome")) .badge:has-text("96.2% up this week")';
    await page.waitForSelector(badge, { timeout: 5000 });
    if (await page.isVisible('[role=tooltip]')) throw new Error('a card shows before any hover');
    await page.hover(badge);
    const card = await page.waitForSelector(`${badge} [role=tooltip]`, { state: 'visible', timeout: 3000 });
    const words = await card.innerText();
    if (!/45 minutes: nothing answers on its port/.test(words) || !/30 minutes: HTTP 502/.test(words)) throw new Error('the card says: ' + words);
    if (await card.$$eval('.outstrip .out', (o) => o.length) !== 2) throw new Error('not two marks on the strip');
    if (await card.$$eval('.outstrip .outday', (o) => o.length) !== 7) throw new Error('not 7 days on the strip');
    // Inside the window, and nothing over it.
    const inside = await card.evaluate((c) => { const r = c.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && c.contains(hit); });
    if (!inside) throw new Error('the card is cut off or covered');
    // The screen reader reads it as the badge's description.
    if (await page.$eval(badge, (b) => document.getElementById(b.getAttribute('aria-describedby'))?.getAttribute('role')) !== 'tooltip') throw new Error('not its description');
    await page.mouse.move(5, 5);
    await page.waitForSelector(`${badge} [role=tooltip]`, { state: 'hidden', timeout: 2000 });
    // A click (a phone's tap) shows it and stays on Status; Escape closes it.
    await page.click(badge);
    await page.waitForSelector(`${badge} [role=tooltip]`, { state: 'visible', timeout: 2000 });
    if (!(await page.isVisible('#status'))) throw new Error('the click left Status');
    await page.keyboard.press('Escape');
    await page.waitForSelector(`${badge} [role=tooltip]`, { state: 'hidden', timeout: 2000 });
    // Tab reaches it.
    await page.mouse.move(5, 5);
    await page.$eval(badge, (b) => b.blur());
    await page.focus(badge);
    await page.waitForSelector(`${badge} [role=tooltip]`, { state: 'visible', timeout: 2000 });
    // Only missed checks that passed the next time: it says so.
    const blips = 'tr:has(strong:text-is("Vaultwarden")) .badge:has-text("98% up this week")';
    await page.hover(blips);
    const said = await page.waitForSelector(`${blips} [role=tooltip]`, { state: 'visible', timeout: 3000 });
    if (!/No outage: each check it missed passed the next time/.test(await said.innerText())) throw new Error('Vaultwarden says: ' + await said.innerText());
  } },
  // Hover "up 8 hours" (or Tab to it) for why it last started, and when; an app with no reason kept has plain words.
  { name: 'Why an app restarted, on hover', screen: 'status', mock: { status: { ...status, apps: status.apps.map((a) => (a.id === 'vikunja' ? { ...a, startedBy: 'watchdog' } : a.id === 'audiobookshelf' ? { ...a, startedBy: 'docker' } : a)) } }, run: async (page) => {
    const up = '#statusRows tr:has(strong:text-is("Vikunja")) .local.hovers:has-text("up 8 hours")';
    await page.waitForSelector(up, { timeout: 5000 });
    await page.hover(up);
    const card = await page.waitForSelector(`${up} [role=tooltip]`, { state: 'visible', timeout: 3000 });
    const said = await card.innerText();
    if (!/The watchdog restarted it: it was unwell on two checks in a row/.test(said) || !/(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d+:\d\d (AM|PM)/.test(said)) throw new Error('Vikunja says: ' + said);
    await page.mouse.move(5, 5);
    await page.waitForSelector(`${up} [role=tooltip]`, { state: 'hidden', timeout: 2000 });
    const abs = '#statusRows tr:has(strong:text-is("Audiobookshelf")) .local.hovers';
    await page.focus(abs);
    const docker = await page.waitForSelector(`${abs} [role=tooltip]`, { state: 'visible', timeout: 2000 });
    if (!/Docker started it again after it stopped on its own/.test(await docker.innerText())) throw new Error('Audiobookshelf says: ' + await docker.innerText());
    // A click on the words stays on Status; nothing kept, nothing to hover.
    await page.click(up);
    if (!(await page.isVisible('#status'))) throw new Error('the click left Status');
    if (await page.$$eval('#statusRows tr:has(strong:text-is("Immich")) .local', (l) => l.some((e) => e.classList.contains('hovers')))) throw new Error('Immich has a hover with nothing to say');
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
  // A form opens at its top with the cursor in its first field; a command's sheet keeps the focus on its first button.
  { name: 'Keyboard: a Finances form opens at its top, the cursor in its first field', screen: 'finances', run: async (page) => {
    await page.setViewportSize({ width: 860, height: 560 });
    await page.click('#finances button:text-is("Add a payment")', { timeout: 5000 });
    await page.waitForTimeout(500);
    const s = await page.evaluate(() => {
      const p = document.querySelector('.panel.sheet:not([hidden])'), f = document.activeElement, t = p.querySelector('h2');
      return { top: p.scrollTop, field: f.matches('input, select, textarea') && p.contains(f), focus: `${f.tagName.toLowerCase()} "${(f.textContent || f.name || '').trim().slice(0, 20)}"`, title: t.getBoundingClientRect().top >= p.getBoundingClientRect().top - 1 };
    });
    if (!s.field) throw new Error(`the focus is on ${s.focus}, not a field`);
    if (s.top > 1 || !s.title) throw new Error(`the form opens scrolled ${Math.round(s.top)} px down, its title out of sight`);
  } },
  { name: 'Keyboard: a command sheet still takes the focus, not a field', screen: 'status', mock: { jobApps: { 'update-all': ['navidrome', 'vikunja', 'mealie'] } }, run: async (page) => {
    await page.click('#updateAll', { timeout: 5000 });
    await page.waitForSelector('#cliActions button:has-text("Update them")', { timeout: 5000 });
    await page.waitForTimeout(300);
    const f = await page.evaluate(() => { const e = document.activeElement; return e.closest('.panel.sheet') && !e.matches('input, select, textarea') ? '' : `${e.tagName.toLowerCase()} "${(e.textContent || '').trim().slice(0, 20)}"`; });
    if (f) throw new Error(`the focus is on ${f}`);
  } },
  // Finances' bars in a contrast theme keep their track, and a low balance is hatched.
  { name: 'Windows high contrast: Finances\' bars keep their colours', screen: 'finances', mock: { platform: 'Win32' }, run: async (page) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForSelector('#finRoot .fx-flow .fx-split > span', { timeout: 5000 });
    // A bar the contrast theme repainted in Canvas would vanish into its card.
    const look = (sel) => page.$$eval(sel, (es) => es.filter((e) => e.checkVisibility()).map((e) => { const t = getComputedStyle(e); return { cls: e.className, adjust: t.forcedColorAdjust, fill: t.backgroundColor, card: getComputedStyle(e.closest('.card')).backgroundColor }; }));
    const bars = [...await look('#finRoot .fx-split > span')];
    await finTab(page, 'Net worth');
    await page.waitForSelector('#finRoot .fx-worthchart .fx-seg', { timeout: 5000 });
    bars.push(...await look('#finRoot .fx-seg'));
    if (!bars.length) throw new Error('no bars');
    const flat = bars.filter((b) => b.adjust !== 'none' || b.fill === b.card || /rgba\(0, 0, 0, 0\)/.test(b.fill));
    if (flat.length) throw new Error(`${flat.length} of ${bars.length} bars lose their colour: ${JSON.stringify(flat[0])}`);
  } },
  // Finances by its own width: the board lays as many widgets in a row as
  // fit, so nothing is crushed (a letter a line) or slides sideways at any
  // text size.
  ...[['Dashboard', 1280, 1], ['Net worth', 1280, 1], ['Net worth', 1440, 1], ['Dashboard', 1280, 1.5], ['Net worth', 1280, 1.5], ['Recurring', 860, 2], ['Pay', 860, 2], ['Net worth', 860, 2]].map(([view, w, zoom]) => ({ name: `Finances, ${view}, ${w}px at text size ${zoom}: nothing crushed or sliding sideways`, screen: 'finances', run: async (page) => {
    await page.setViewportSize({ width: w, height: 800 });
    await page.evaluate((z) => document.documentElement.style.setProperty('--zoom', z), String(zoom));
    await page.waitForSelector('#finRoot .seg button', { timeout: 5000 });
    await finTab(page, view);
    await page.waitForTimeout(400);
    const out = await page.evaluate(() => {
      const found = [], m = document.querySelector('main');
      if (m.scrollWidth > m.clientWidth + 1) found.push(`the page slides sideways (${m.scrollWidth} px in ${m.clientWidth})`);
      for (const t of document.querySelectorAll('#finRoot li *, #finRoot .fx-widget h2 *')) {
        if (t.children.length || t.tagName === 'BUTTON' || t.textContent.trim().length < 4 || !t.checkVisibility()) continue;
        const lines = t.getBoundingClientRect().height / (parseFloat(getComputedStyle(t).lineHeight) || 18), words = t.textContent.trim().split(/\s+/).length;
        if (lines > words * 2 + 2) found.push(`"${t.textContent.trim().slice(0, 24)}" takes ${Math.round(lines)} lines`);
      }
      return [...new Set(found)];
    });
    if (out.length) throw new Error(out.slice(0, 5).join('; '));
  } })),
  // The icon sidebar: a two-digit count stays readable on its icon's corner.
  ...[['Mac', 'MacIntel'], ['Windows', 'Win32'], ['Linux', 'Linux x86_64']].map(([os, platform]) => ({ name: `${os}: in the icon sidebar, a two-digit count is solid and on top of its icon`, screen: 'status', mock: { platform, status: { ...status, apps: status.apps.map((a, i) => (i < 16 ? { ...a, state: 'stopped', health: '' } : a)) } }, run: async (page) => {
    await page.setViewportSize({ width: 860, height: 560 });
    await page.evaluate(() => document.documentElement.style.setProperty('--zoom', '1.5'));
    await page.waitForTimeout(400);
    const c = await page.$eval('nav button[data-screen="status"] .count', (e) => {
      const r = e.getBoundingClientRect(), bg = getComputedStyle(e).backgroundColor;
      const alpha = /rgba?\(([^)]+)\)/.test(bg) ? (bg.match(/rgba?\(([^)]+)\)/)[1].split(/[,\s/]+/).filter(Boolean)[3] ?? '1') : '1';
      const hit = document.elementFromPoint(r.left + 3, r.top + r.height / 2);
      return { text: e.textContent, alpha: parseFloat(alpha), onTop: e.contains(hit), w: r.width };
    });
    if (!/^\d\d$/.test(c.text)) throw new Error(`the count says "${c.text}"`);
    if (c.alpha < 1) throw new Error(`the count is see-through (alpha ${c.alpha})`);
    if (!c.onTop) throw new Error('the icon covers the count');
  } })),
  // Counts in words: "1 of the homelab's own apps is down", "7 other containers … aren't".
  ...[[1, 1, "1 of the homelab's own apps is down", '1 other container on this machine isn’t a catalog app.'], [3, 7, "3 of the homelab's own apps are down", '7 other containers on this machine aren’t catalog apps.']].map(([missing, unmatched, down, other]) => ({ name: `Status counts in words: ${down}, ${unmatched} other container${unmatched === 1 ? '' : 's'}`, screen: 'status', mock: { status: { ...status, missing, unmatched } }, run: async (page) => {
    await page.waitForSelector('#tiles .tile', { timeout: 5000 });
    const text = await page.$eval('#status', (e) => e.innerText);
    for (const want of [down, other]) if (!text.includes(want)) throw new Error(`no "${want}" (${(text.match(/[^\n]*(\(s\)|own apps? (is|are)|other container)[^\n]*/g) || []).join(' | ')})`);
  } })),
  // The phone zoomed in by its browser: 390 px at 150% is a 260 px page, at 175% about 213 px.
  ...[['status', 260], ['backups', 260], ['app:vikunja', 213], ['status', 213], ['backups', 213]].map(([screen, w]) => ({ name: `The phone zoomed in, ${w}px: ${screen === 'app:vikunja' ? 'an app’s page' : screen[0].toUpperCase() + screen.slice(1)} cuts nothing off and does not slide sideways`, screen, phone: ['companion', 'can-change'], mock: screen === 'app:vikunja' ? pageMock : undefined, run: async (page) => {
    await page.setViewportSize({ width: w, height: 600 });
    await page.waitForTimeout(400);
    const out = await page.evaluate(() => {
      const m = document.querySelector('main'), edge = m.getBoundingClientRect().right - parseFloat(getComputedStyle(m).paddingRight) + 1, found = [];
      if (m.scrollWidth > m.clientWidth + 1) found.push(`the page slides sideways (${m.scrollWidth} px in ${m.clientWidth})`);
      for (const e of m.querySelectorAll('.screen.active *')) {
        if (!e.checkVisibility() || !e.getBoundingClientRect().width) continue;
        const cs = getComputedStyle(e), text = e.textContent.trim().slice(0, 30);
        if (e.children.length < 3 && cs.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 2) found.push(`"${text}" is cut off`);
        else if (!e.children.length && e.getBoundingClientRect().right > edge && !e.closest('table')) found.push(`"${text}" sticks out`);
        else if (e.matches('table.grouped th') && e.getBoundingClientRect().right > edge) found.push(`the heading "${text}" sticks out`);
      }
      return [...new Set(found)];
    });
    if (out.length) throw new Error(out.slice(0, 6).join('; '));
  } })),
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
  // A paired phone asks only what homelab serve answers (serve.go's
  // phoneMethods; the mock refuses the rest as the companion does), and
  // Status shows no red error for it: neither the error bar nor Status's
  // own note. On an older computer's serve, without StatusBoard and
  // LastStatus (0.14.9 and earlier), Status still comes, from Status.
  ...[['', phoneMethods], [', from an older computer without StatusBoard', phoneMethods.filter((m) => m !== 'StatusBoard' && m !== 'LastStatus')]].map(([older, methods]) => ({ name: `The phone: Status shows no red error after pairing${older}`, screen: 'status', phone: ['companion'], mock: { phoneMethods: methods }, run: async (page) => {
    await page.waitForTimeout(2500); // Status, its cards, and the reads after it
    const red = await page.evaluate(() => {
      const shown = (e) => e && !e.closest('[hidden]') && e.getClientRects().length > 0 && e.textContent.trim();
      const out = [];
      if (shown(document.getElementById('error'))) out.push('the error bar: ' + document.getElementById('error').textContent);
      const note = document.querySelector('#statusNote .card');
      if (shown(note)) out.push('Status’s note: ' + note.textContent);
      for (const e of document.querySelectorAll('#status *')) if (shown(e) && /not on the phone/.test(e.textContent) && !e.children.length) out.push(e.textContent);
      return out;
    });
    if (red.length) throw new Error(red.join('; ') + ' (refused: ' + (await page.evaluate(() => window.__MOCK.refused.join(', '))) + ')');
    if (!(await page.isVisible('#statusRows tr:has(strong:text-is("Vaultwarden"))'))) throw new Error('Status did not come');
    // It asks nothing a phone is not served, but what an older computer lacks;
    // there the cards come one by one.
    const refused = [...new Set(await page.evaluate(() => window.__MOCK.refused))].filter((m) => methods.includes(m) || !['StatusBoard', 'LastStatus'].includes(m));
    if (refused.length) throw new Error('the phone asked what it is not served: ' + refused.join(', '));
    if (!(await page.isVisible('#watchCard')) || !(await page.isVisible('#alertsCard'))) throw new Error('the watchdog and alerts cards did not come');
  } })),
  { name: 'A read-only phone has no restart, stop, start, or switches', screen: 'status', phone: ['companion'], run: async (page) => {
    await page.waitForSelector('#statusRows tr:has(strong:text-is("Vikunja")) button.rowmain:has-text("Open")', { state: 'visible', timeout: 5000 });
    if (await page.isVisible('#statusRows tr:has(strong:text-is("Mealie")) button:has-text("Start")')) throw new Error('Start shows on a read-only phone');
    // Settings only to read (#596's gap 6): every field locked, no Save.
    await page.click('nav button[data-screen="settings"]');
    await page.waitForSelector('#settingsForm .setting', { timeout: 5000 });
    if (await page.$$eval('#settingsForm input', (l) => l.some((i) => !i.disabled))) throw new Error('a setting to change on a read-only phone');
    if (await page.isVisible('#saveSettings')) throw new Error('Save on a read-only phone');
    await page.click('nav button[data-screen="status"]');
    await page.click('#statusRows tr:has(strong:text-is("Vikunja")) td.state');
    await page.waitForSelector('#app.screen.active h1:text-is("Vikunja")', { timeout: 5000 });
    for (const sel of ['button:text-is("Restart")', 'button:text-is("Stop")', 'input.switch', 'button:has-text("Remove")']) {
      if (await page.isVisible(`#app ${sel}`)) throw new Error(sel + ' shows on a read-only phone');
    }
    await page.waitForSelector('#appSettings li:has-text("Tell me if it stops") .switchstate:text-is("On")');
  } },
  // Quick actions: on a phone that may make changes, a long press on an app's row opens the quick ones (Open, Restart,
  // Stop for a while, Logs), not this computer's (Back up now, alerts, Pin); the page does not open under it. A tap
  // still opens the page, and a phone that only looks has no menu.
  { name: 'The phone: a long press on an app for its quick actions', screen: 'status', phone: ['companion', 'can-change'], run: async (page) => {
    await page.waitForSelector('#statusRows tr:has(strong:text-is("Vikunja"))', { timeout: 5000 });
    await longPress(page, 'Vikunja', 650);
    const menu = page.locator('#statusRows .rowmenu');
    await menu.waitFor({ timeout: 3000 });
    const items = await menu.locator('[role^=menuitem]').allTextContents();
    for (const want of ['Open', 'Restart', 'Stop', 'Stop for a while ›', 'Logs']) if (!items.includes(want)) throw new Error(`no ${want} in ${items}`);
    for (const never of ['Back up now', 'Pin to the top', 'Open on a phone']) if (items.some((i) => i.startsWith(never))) throw new Error(`${never} on the phone: ${items}`);
    if (items.some((i) => i.startsWith('Tell me if it stops'))) throw new Error(`alerts on the phone: ${items}`);
    if (await page.isVisible('#app')) throw new Error('the long press opened the app\'s page too');
    // The finger held there selects no text (and iOS shows no callout).
    if ((await page.$eval('#statusRows tr:has(strong)', (r) => getComputedStyle(r).userSelect)) !== 'none') throw new Error('a held finger can select the row\'s text');
    // Where a finger can reach it: on the screen, and nothing over it.
    const reach = await page.evaluate(() => { const b = [...document.querySelectorAll('.rowmenu button')].find((x) => x.textContent === 'Restart'); const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && b.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); });
    if (!reach) throw new Error('the menu opened off the screen or under something');
    await menu.locator('button:text-is("Restart")').click();
    await page.waitForFunction(() => (window.__MOCK.calls.AppAction || 0) >= 1, null, { timeout: 5000 });
    // A short tap is a tap: the app's page.
    await longPress(page, 'Mealie', 80);
    await page.waitForSelector('#app h1:has-text("Mealie")', { timeout: 5000 });
  } },
  { name: 'The phone that only looks: a long press opens no menu', screen: 'status', phone: ['companion'], run: async (page) => {
    await page.waitForSelector('#statusRows tr:has(strong:text-is("Vikunja"))', { timeout: 5000 });
    await longPress(page, 'Vikunja', 650);
    await page.waitForTimeout(300);
    if (await page.locator('.rowmenu').count()) throw new Error('a look-only phone has a menu');
    if ((await page.$eval('#statusRows tr:has(strong)', (r) => getComputedStyle(r).userSelect)) === 'none') throw new Error('a look-only phone cannot select a row\'s text');
  } },
  { name: 'A phone allowed to make changes can restart, from the page', screen: 'app:vikunja', phone: ['companion', 'can-change'], run: async (page) => {
    await page.click('#app button:text-is("Restart")', { timeout: 5000 });
    await page.waitForFunction(() => window.__MOCK.calls.AppAction >= 1, null, { timeout: 5000 });
    if (await page.isVisible('#cliPanel')) throw new Error('a sheet opened for a Restart: it runs on the row now');
    if (await page.isVisible('#app button:has-text("Remove")')) throw new Error('Remove shows on a phone');
  } },
  // With no https link yet (no domain, no Tailscale), a phone pairs over the
  // home Wi-Fi and can only look, without Finances, whatever was picked:
  // the pairing says so for this phone, where what was picked would not hold.
  ...[[['http://192.168.1.10:8099/#pair=K7QX4MRA'], true, true], [['http://192.168.1.10:8099/#pair=K7QX4MRA'], false, false], [undefined, true, false]].map(([links, pick, warns]) => ({ name: `Pairing says when a phone will only look: ${links ? 'http only' : 'with https'}, ${pick ? 'changes and Finances picked' : 'nothing picked'}`, screen: 'settings', mock: links ? { pairLinks: links } : {}, run: async (page) => {
    await page.click('#settingsNav .pagebtn[data-page="Phones"]', { timeout: 5000 });
    if (pick) {
      await page.check('#phoneCanChange');
      await page.selectOption('#phoneFinances', 'edit');
    }
    await page.click('#pairPhone');
    await page.waitForSelector('#pairing img', { timeout: 5000 });
    const shown = await page.isVisible('#pairOnlyLooks');
    if (shown !== warns) throw new Error(warns ? 'nothing says this phone will only look' : 'says it will only look when it will not');
    if (warns && !/only look/.test(await page.textContent('#pairOnlyLooks'))) throw new Error('the note does not say it will only look');
  } })),
  // Once paired, a screen can be allowed only the money card; a new phone's pick does not offer it (a screen pairs without Finances).
  { name: 'Settings › Phones: a paired screen may show the money card only', screen: 'settings', run: async (page) => {
    await page.click('#settingsNav .pagebtn[data-page="Phones"]', { timeout: 5000 });
    const pick = page.locator('#phonesCard li:has-text("Kitchen iPad") select.finpick');
    await pick.waitFor({ timeout: 5000 });
    await pick.selectOption('card');
    await page.waitForSelector('#phonesCard li:has-text("Kitchen iPad"):has-text("shows the money card")', { timeout: 3000 });
    if (await page.locator('#phoneFinances option[value="card"]').count()) throw new Error('a new phone is offered the money card');
  } },
  { name: 'Pair a phone, then let it make changes and remove it', screen: 'settings', run: async (page) => {
    await page.click('#settingsNav .pagebtn[data-page="Phones"]', { timeout: 5000 }); 
    await page.waitForSelector('#phonesCard li:has-text("Kitchen iPad"):has-text("Looks only")', { timeout: 5000 });
    await page.click('#pairPhone');
    await page.waitForSelector('#pairing img[src^="data:image/svg"]');
    await page.waitForSelector('#pairing code:has-text("K7QX4MRA")');
    await page.selectOption('#phonesCard select[aria-label="What Kitchen iPad may do"]', 'change');
    await page.waitForSelector('#phonesCard li:has-text("Kitchen iPad"):has-text("Can make changes")');
    await page.click('#phonesCard li:has-text("Kitchen iPad") button:has-text("Remove")');
    await page.waitForSelector('#phonesCard .row:has-text("1 paired")');
    if (await page.isVisible('#phonesCard li:has-text("Kitchen iPad")')) throw new Error('the removed phone is still listed');
  } },
  // Usability task 6 (items 6 to 10): a phone and a wall screen pair as two choices, each with its own QR code
  // (the wall screen's with kiosk in it, nothing to edit), the link the QR code holds named as the one to use, the
  // home Wi-Fi link behind "If the phone can't open it" saying it only looks; every phone's row has the same
  // controls, and no warning mark nothing explains.
  { name: 'Settings › Phones: Pair a phone or a wall screen, each with its own QR code and the link to use', screen: 'settings', run: async (page) => {
    await page.click('#settingsNav .pagebtn[data-page="Phones"]', { timeout: 5000 });
    await page.click('#pairPhone', { timeout: 5000 });
    await page.waitForSelector('#pairing[data-kind="phone"] img', { timeout: 5000 });
    const use = await page.textContent('#pairing .pairuse');
    if (!/QR code holds it/.test(use) || !use.includes('https://homelab.example.com/#pair=K7QX4MRA') || use.includes('kiosk')) throw new Error(`the phone's link to use: ${use}`);
    const wifi = page.locator('#pairing details.pairwifi');
    if (!/can’t open it/.test(await wifi.locator('summary').textContent())) throw new Error('the home Wi-Fi link is not behind "If the phone can’t open it"');
    await wifi.locator('summary').click();
    if (!/192\.168\.1\.10:8099.*can only look/s.test(await wifi.textContent())) throw new Error(`the home Wi-Fi link: ${await wifi.textContent()}`);
    const text = await page.textContent('#phonesCard');
    for (const word of ['tailnet', 'kiosk', 'https:', 'http:', ' key']) {
      if (text.replace(/(https?:\/\/\S+)/g, '').includes(word)) throw new Error(`"${word}" on the Phones card, outside a link`);
    }
    await page.click('#pairing button:text-is("Done")');
    await page.click('#pairWall');
    await page.waitForSelector('#pairing[data-kind="wall"] img[alt*="wall screen"]', { timeout: 5000 });
    const wall = await page.textContent('#pairing .pairuse');
    if (!wall.includes('#pair=K7QX4MRA&kiosk')) throw new Error(`the wall screen's link holds no kiosk: ${wall}`);
    const paired = await page.evaluate(() => window.__MOCK.paired);
    if (paired?.canChange || paired?.finances) throw new Error(`a wall screen paired to do more than look: ${JSON.stringify(paired)}`);
    if (await page.locator('#phonesCard .dot.warn, #phonesCard .dot.bad').count()) throw new Error('a phone carries a warning mark nothing explains');
    const controls = await page.$$eval('#phonesCard li', (rows) => rows.map((r) => [...r.querySelectorAll('select, button')].map((c) => c.className.split(' ')[0] + (c.tagName === 'BUTTON' ? ':' + c.textContent : '')).join(',')));
    if (new Set(controls).size !== 1) throw new Error(`the phones' controls differ: ${controls.join(' | ')}`);
  } },
  { name: 'Settings › Phones: Finances phone by phone, and for a phone being paired', screen: 'settings', run: async (page) => {
    await page.click('#settingsNav .pagebtn[data-page="Phones"]', { timeout: 5000 });
    await page.waitForSelector('#phonesCard li:has-text("Anna’s iPhone"):has-text("changes Finances")', { timeout: 5000 });
    await page.selectOption('#phonesCard select[aria-label="Finances on Kitchen iPad"]', 'view');
    await page.waitForSelector('#phonesCard li:has-text("Kitchen iPad"):has-text("sees Finances")', { timeout: 5000 });
    if ((await page.evaluate(() => window.__MOCK.phones.find((p) => p.name === 'Kitchen iPad').finances)) !== 'view') throw new Error('the pick was not kept');
    await page.selectOption('#phoneFinances', 'edit');
    await page.click('#pairPhone');
    await page.waitForSelector('#pairing code:has-text("K7QX4MRA")');
    const paired = await page.evaluate(() => window.__MOCK.paired);
    if (paired?.finances !== 'edit' || paired.canChange) throw new Error(`paired with ${JSON.stringify(paired)}`);
  } },
  // Phones that expire: a guest's phone keeps changes and Finances for a week, the row says until when, and a phone
  // that only looks (the kitchen screen) has nothing to end.
  // Devices on your tailnet (Settings › Phones): Tailscale's own list, this machine first; one not seen for a month
  // is marked; Remove opens it in Tailscale's admin console. Hidden while Tailscale is not running.
  { name: 'Settings › Phones: the devices on the tailnet, a lost one marked, Remove in the admin console', screen: 'settings', mock: { tailnetDevices: [
    { name: 'homelab', os: 'linux', ip: '100.64.0.1', online: true, self: true, admin: 'https://login.tailscale.com/admin/machines/100.64.0.1' },
    { name: 'bens-macbook-air', os: 'macOS', ip: '100.64.0.3', online: true, admin: 'https://login.tailscale.com/admin/machines/100.64.0.3' },
    { name: 'old-pixel', os: 'android', ip: '100.64.0.4', online: false, lastSeen: hoursAgo(5 * 24), admin: 'https://login.tailscale.com/admin/machines/100.64.0.4' },
    { name: 'annas-iphone', os: 'iOS', ip: '100.64.0.2', online: false, lastSeen: hoursAgo(97 * 24), admin: 'https://login.tailscale.com/admin/machines/100.64.0.2' },
  ] }, run: async (page) => {
    await page.click('#settingsNav .pagebtn[data-page="Phones"]', { timeout: 5000 });
    await page.waitForSelector('#tailnetCard:has-text("4 devices, 2 online")', { timeout: 5000 });
    const rows = (await page.locator('#tailnetCard li').allInnerTexts()).map((r) => r.replace(/\s+/g, ' '));
    if (!/homelab.*Linux · this machine/.test(rows[0]) || /Remove/.test(rows[0])) throw new Error(`this machine: ${rows[0]}`);
    if (!/old-pixel.*Android · last seen 5 days ago/.test(rows[2]) || /Not seen for a month/.test(rows[2])) throw new Error(`old-pixel: ${rows[2]}`);
    if (!/annas-iphone.*iPhone or iPad · last seen .*Not seen for a month: if it is lost, remove it/.test(rows[3])) throw new Error(`annas-iphone: ${rows[3]}`);
    await page.click('#tailnetCard button[aria-label="Remove annas-iphone"]');
    await page.waitForFunction(() => window.__MOCK.opened === 'https://login.tailscale.com/admin/machines/100.64.0.2', null, { timeout: 3000 });
  } },
  { name: 'Settings › Phones without Tailscale: no tailnet card', screen: 'settings', run: async (page) => {
    await page.click('#settingsNav .pagebtn[data-page="Phones"]', { timeout: 5000 });
    await page.waitForSelector('#phonesCard li', { timeout: 5000 });
    if (await page.isVisible('#tailnetCard')) throw new Error('the tailnet card shows without Tailscale');
  } },
  { name: 'Settings › Phones: access for a week, then it only looks', screen: 'settings', run: async (page) => {
    await page.click('#settingsNav .pagebtn[data-page="Phones"]', { timeout: 5000 });
    const anna = '#phonesCard li:has-text("Anna’s iPhone")';
    await page.waitForSelector(`${anna} select[aria-label="How long Anna’s iPhone keeps it"]`, { timeout: 5000 });
    // Every phone has the same controls in the same places (usability task 6): one that only looks has the end greyed.
    if (!(await page.locator('#phonesCard select[aria-label="How long Kitchen iPad keeps it"]').isDisabled())) throw new Error('a phone that only looks offers an end');
    await page.selectOption(`${anna} select[aria-label="How long Anna’s iPhone keeps it"]`, String(24 * 7));
    await page.waitForSelector(`${anna} .phoneuntil:has-text("then it only looks")`, { timeout: 5000 });
    const until = await page.evaluate(() => window.__MOCK.phones.find((p) => p.name === 'Anna’s iPhone').until);
    const days = (new Date(until).getTime() - Date.now()) / 864e5;
    if (!(days > 6.9 && days < 7.1)) throw new Error(`kept until ${until}`);
    const want = new Date(until).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (!(await page.textContent(`${anna} .phoneuntil`)).includes(want)) throw new Error(`the row does not say ${want}: ${await page.textContent(`${anna} .phoneuntil`)}`);
    // Until you change it: the end goes.
    await page.selectOption(`${anna} select[aria-label="How long Anna’s iPhone keeps it"]`, '0');
    await page.waitForSelector(`${anna} .phoneuntil`, { state: 'detached', timeout: 5000 });
  } },
  // Finances on a phone: only where it may see them; a phone allowed to
  // look has no way to change them; every view fits a phone.
  { name: 'The phone: no Finances until the phone may see them', screen: 'status', phone: ['companion'], run: async (page) => {
    await page.waitForSelector('nav button[data-screen="status"]', { state: 'visible', timeout: 5000 });
    if (await page.isVisible('nav button[data-screen="finances"]')) throw new Error('Finances in the tab bar of a phone not allowed them');
    await page.evaluate(() => document.documentElement.classList.add('finances'));
    await page.click('nav button[data-screen="finances"]', { timeout: 2000 });
    await page.waitForSelector('#finances.active .fx-paycheck .fx-figure', { timeout: 5000 });
  } },
  { name: 'The phone, view only: Finances with nothing to edit, add, or save, in every view', screen: 'finances', phone: ['companion', 'finances'], mock: { finances: { ...finances, readOnly: true, payToday: finances.periods[1].pay } }, run: async (page) => {
    await page.waitForSelector('#finances.active .fx-paycheck .fx-figure', { timeout: 5000 });
    if (!(await page.textContent('#finances .lead')).includes('view only')) throw new Error('the heading does not say view only');
    for (const view of ['Dashboard', 'Recurring', 'Pay', 'Net worth']) {
      await finTab(page, view);
      await page.waitForTimeout(150);
      // What only looks may stay: an account's row on Net worth (it opens the account's page, which only looks: its own case),
      // the views and ranges, the pay period's ‹ › and Today, Renewing soon's, Budgets to watch's, and Goals' See all, Coming up's Calendar, a paycheck's column, Show all, Open Net worth, Export (which saves a copy and changes nothing), checking's two figures (each shows how it adds up), a holding on Investments (it opens its worth at each read), and what opens Transactions on what is behind it (Latest transactions' See all, a category of Spent this month, a month of Cash flow's six, a budget), a card's title that opens what it sums up, the look back's account and how far back, and the order Recurring's payments are listed in.
      const found = await page.evaluate(() => [...document.querySelectorAll('#finances button, #finances select, #finances input')].filter((e) => e.checkVisibility() && !e.closest('.seg, .finpost thead, .fx-clearfig, .fx-moneyflow, .fx-paycheck .fx-actions, #finPeriod, .fx-renewing .fx-actions, .fx-budgets .fx-actions, .fx-comingup .fx-actions, .fx-goals .fx-actions, .fx-more, .fx-export, .fx-holdings, .fx-latest .fx-actions, .fx-spentrows, .fx-monthbars, .fx-budgets .fx-rows, .fx-paytotal, .fx-ownlist .rowopen, .fx-owelist .rowopen, .fx-titleopen, .fx-trend .fx-actions') && !e.matches('button[aria-label^="Open "]')).map((e) => e.textContent.trim() || e.getAttribute('aria-label') || e.tagName));
      if (found.length) throw new Error(`${view}: ${found.join(', ')}`);
    }
    // Net worth's change shows on a phone that may not make changes (.change once hid it).
    if (!(await page.isVisible('.fx-figurecard:has(h2:has-text("Since")) .fx-badge'))) throw new Error('the net worth change is hidden');
  } },
  ...[[390, 844], [320, 568]].map(([w, h]) => ({ name: `The phone, ${w}px: every Finances view fits, nothing slides sideways`, screen: 'finances', phone: ['companion', 'finances'], run: async (page) => {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForSelector('#finances.active .fx-paycheck .fx-figure', { timeout: 5000 });
    for (const view of ['Dashboard', 'Recurring', 'Pay', 'Net worth']) {
      await finTab(page, view);
      await page.waitForTimeout(200);
      // Point at a chart, if the view has one, so its card shows.
      const plot = page.locator('#finances .fx-worthchart .fx-stackcol.on, #finances .fx-checking .fx-plot').first();
      if (await plot.count()) {
        await plot.scrollIntoViewIfNeeded();
        const box = await plot.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(150);
      }
      const bad = await page.evaluate(() => {
        const out = document.documentElement.scrollWidth > innerWidth + 1 ? [`the page is ${document.documentElement.scrollWidth}px wide`] : [];
        const right = document.querySelector('main').getBoundingClientRect().right;
        for (const e of document.querySelectorAll('#finances button, #finances .fx-amount, #finances .num')) {
          const r = e.getBoundingClientRect();
          if (e.checkVisibility() && r.width && r.right > right + 1 && !e.closest('.seg, .finpostscroll')) out.push(`${(e.textContent || '').trim().slice(0, 30)} ends at ${Math.round(r.right)}px`);
        }
        // A chart's card stays inside the chart's.
        for (const e of document.querySelectorAll('#finances .fx-tip')) {
          const r = e.getBoundingClientRect(), card = e.closest('.card').getBoundingClientRect();
          if (r.right > card.right + 1 || r.left < card.left - 1) out.push(`a chart's card runs past its card (${Math.round(r.left)}–${Math.round(r.right)}px)`);
        }
        // A pick may scroll inside its card, never run past it.
        for (const e of document.querySelectorAll('#finances .seg')) {
          const r = e.getBoundingClientRect(), card = e.closest('.card')?.getBoundingClientRect();
          if (e.checkVisibility() && r.right > (card ? card.right : right) + 1) out.push(`${e.getAttribute('aria-label')} ends at ${Math.round(r.right)}px, past its card`);
        }
        return out.slice(0, 4);
      });
      if (bad.length) throw new Error(`${view}: ${bad.join('; ')}`);
    }
  } })),
  { name: 'Send a report shows only on the phone', screen: 'status', run: async (page) => {
    if (await page.isVisible('#phoneReport')) throw new Error('Send a report shows on the Mac');
    await page.evaluate(() => document.documentElement.classList.add('companion'));
    await page.waitForSelector('#phoneReport', { state: 'visible', timeout: 2000 });
  } },
  // An update's notes: hover "updates held" for why it is held, how to put it back, and its newest release's first lines,
  // read from GitHub only when the card opens (and once); a release that cannot be read says why.
  { name: 'Hover “updates held” for why, and what its newest release says', screen: 'status', mock: { releaseNotes: { dozzle: { app: 'dozzle', repo: 'amir20/dozzle', running: 'v8.4.2', placed: true, releases: [
    { tag: 'v8.5.0', name: 'v8.5.0', when: '2026-10-30T12:00:00Z', url: 'https://github.com/amir20/dozzle/releases/tag/v8.5.0', notes: "## What's Changed\n- Logs from **every host** in one view by [@amir20](https://github.com/amir20)\n* Faster search\n- Fixed a crash" },
  ] } } }, run: async (page) => {
    const held = '#statusRows tr:has-text("Dozzle") .badge.hovers:has-text("updates held")';
    await page.waitForSelector(held, { timeout: 5000 });
    if (await page.evaluate(() => window.__MOCK.calls.ReleaseNotes)) throw new Error('GitHub was asked before any hover');
    await page.hover(held);
    const card = page.locator(`${held} [role=tooltip]`);
    await card.waitFor({ state: 'visible', timeout: 3000 });
    await card.locator(':text("Newest: v8.5.0")').waitFor({ timeout: 3000 });
    const said = (await card.innerText()).replace(/\s+/g, ' ');
    for (const want of [/Left out of the nightly updates after a rollback/, /Nightly updates on its page puts it back/, /Newest: v8\.5\.0 · Oct 30, 2026 \(it runs v8\.4\.2\)/, /Logs from every host in one view by @amir20 Faster search/]) {
      if (!want.test(said)) throw new Error(`no ${want} in: ${said}`);
    }
    if (/What's Changed|Fixed a crash|\*\*|\]\(/.test(said)) throw new Error('more than its first lines, or its marks: ' + said);
    await page.mouse.move(5, 5);
    await card.waitFor({ state: 'hidden', timeout: 2000 });
    await page.hover(held);
    await card.waitFor({ state: 'visible', timeout: 3000 });
    if ((await page.evaluate(() => window.__MOCK.calls.ReleaseNotes)) !== 1) throw new Error('read again: ' + await page.evaluate(() => window.__MOCK.calls.ReleaseNotes));
  } },
  { name: 'Hover “updates held”: a release that cannot be read says why', screen: 'status', run: async (page) => {
    const held = '#statusRows tr:has-text("Dozzle") .badge.hovers:has-text("updates held")';
    await page.waitForSelector(held, { timeout: 5000 });
    await page.focus(held);
    await page.locator(`${held} [role=tooltip] :text("Could not read its releases: GitHub answered 503 Service Unavailable")`).waitFor({ timeout: 3000 });
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
    await page.waitForSelector('#cliPlan:has-text("These 3 apps have updates")', { timeout: 5000 });
    await page.click('#cliActions button:has-text("Update them")');
    if (await page.isVisible('#cliPlan')) throw new Error('the plan stayed once it ran');
    await page.waitForSelector('#cliLog:has-text("Updated: Navidrome")', { state: 'attached', timeout: 5000 });
    // A row per app, each finished, with Docker's lines folded away.
    await page.waitForSelector('#cliApps li.done:has-text("Mealie")', { timeout: 8000 });
    if (await page.$$eval('#cliApps li.done', (l) => l.length) !== 3) throw new Error('not a finished row per app');
    if (await page.isVisible('#cliLog')) throw new Error('Show details stayed open under the rows');
    // The steps came as a bar, filled at the end.
    await page.waitForSelector('#cliProgress:not([hidden]) .step:text-is("Done")', { timeout: 5000 });
  } },
  // Usability task 4, item 11: before Update them, the sheet says what will happen in plain words, the apps by
  // their names and whose data is copied first, with the command and a terminal's marks folded under Show details.
  { name: 'Update apps says its plan in plain words before anything runs', screen: 'status', mock: { jobApps: { 'update-all': ['navidrome', 'vikunja', 'mealie'] } }, run: async (page) => {
    await page.click('#updateAll', { timeout: 5000 });
    await page.waitForSelector('#cliActions button:has-text("Update them")', { timeout: 5000 });
    const plan = await page.textContent('#cliPlan');
    if (!plan.includes('Navidrome, Vikunja, Mealie') || !/copied first.*Mealie/.test(plan)) throw new Error(`the plan: ${plan}`);
    if (await page.$eval('#cliDetails', (d) => d.open)) throw new Error('Show details is open before anything ran');
    const shown = await page.$eval('#cliPanel', (p) => p.innerText);
    for (const mark of ['✓', '$ homelab', '→', 'navidrome,']) if (shown.includes(mark)) throw new Error(`the sheet says "${mark}" before Update them: ${shown}`);
    await page.click('#cliDetails > summary');
    if (!(await page.textContent('#cliLog')).includes('$ homelab update-all')) throw new Error('the command is not under Show details');
  } },
  // Usability task 4, item 12: once Update apps is done, the sheet says what changed in words, above the rows:
  // which app went from which version to which, and which were already up to date.
  { name: 'Update apps, once done, says what changed and what was already up to date', screen: 'status', mock: { jobApps: { 'update-all': ['navidrome', 'vikunja', 'mealie'] } }, run: async (page) => {
    await page.click('#updateAll', { timeout: 5000 });
    await page.click('#cliActions button:has-text("Update them")', { timeout: 5000 });
    await page.waitForSelector('#cliActions button:text-is("Close")', { timeout: 8000 });
    await page.waitForSelector('#cliPlan:not([hidden])', { timeout: 3000 });
    const said = await page.textContent('#cliPlan');
    if (!said.includes('Updated: Navidrome 0.53.3 → 0.54.0.') || !said.includes('Already up to date: Vikunja, Mealie.')) throw new Error(`the sheet says: ${said}`);
    if (/These 3 apps|→ dumping/.test(said)) throw new Error(`the plan's or a terminal's words stayed: ${said}`);
    await page.$eval('#cliDetails', (d) => { d.open = false; });
    const fold = await page.$eval('#cliDetails > summary', (s) => getComputedStyle(s, '::after').content);
    if (/Docker/.test(fold) || !/as it ran/.test(fold)) throw new Error(`Show details reads ${fold}`);
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
  // A finished install can be put away: Close takes the bar, the rows, the details, and Ready to open away, and the
  // focus goes to the search, to pick what is next.
  { name: 'A finished install closes', screen: 'choose', run: async (page) => {
    await page.click('#starters .starter:has-text("Files")');
    await page.waitForSelector('#installBtn:not([disabled])', { timeout: 5000 });
    await page.click('#installBtn');
    await page.waitForSelector('#started #installClose', { timeout: 10000 });
    await page.click('#installClose');
    await page.waitForSelector('#started h2', { state: 'detached', timeout: 2000 });
    const left = await page.evaluate(() => ({
      bar: !document.getElementById('installProgress').hidden,
      rows: document.querySelectorAll('#installApps li').length,
      details: !document.getElementById('installDetails').hidden,
      focus: document.activeElement?.id,
    }));
    if (left.bar || left.rows || left.details) throw new Error(`left behind: ${JSON.stringify(left)}`);
    if (left.focus !== 'search') throw new Error(`the focus went to ${left.focus}`);
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
    // The window slides in (sheet-in, .18s): measured before it settled, a slow runner read it a pixel off (73px, then
    // 72px; #631's CI, Nov 12). Its own animations finish first; then it must not move at all.
    await page.evaluate(() => Promise.all(document.getElementById('cliPanel').getAnimations().map((a) => a.finished)));
    const before = await top();
    const calls = await backendCalls(page);
    await page.click('#cliActions button:has-text("Update them")');
    // Nothing cancels it while it runs: Hide alone, which lets it carry on behind.
    const buttons = await page.$$eval('#cliActions button', (b) => b.map((x) => x.textContent));
    if (buttons.join() !== 'Hide') throw new Error(`buttons while it runs: ${buttons.join(', ')}`);
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
  // A click on the dimmed screen around a sheet closes it, as its Close or Cancel would; a click in it does not,
  // and a form with something typed asks first (its Cancel's own question).
  { name: 'A click on the dimmed screen closes a sheet', screen: 'status', run: async (page) => {
    await page.click('#updateAll');
    await page.waitForSelector('#cliActions button:has-text("Update them")', { timeout: 5000 });
    await page.click('#cliPanel h2, #cliPanel .title, #cliPanel', { position: { x: 12, y: 12 } });
    if (!(await page.isVisible('#cliPanel'))) throw new Error('a click inside the sheet closed it');
    await page.mouse.click(8, 600);
    await page.waitForSelector('#cliPanel', { state: 'hidden', timeout: 2000 });
    const ran = await page.evaluate(() => (window.__MOCK.homelabRan || []).length);
    if (ran !== 1) throw new Error(`expected one preview and no run, the CLI ran ${ran} times`);
    await page.click('nav button[data-screen="finances"]');
    await page.click('#finRoot .toolbar button:text-is("Add a payment")', { timeout: 5000 });
    await page.fill('#finSheet label:has-text("Name") input', 'Gym');
    await page.mouse.click(8, 600);
    await page.waitForSelector('#finSheet .formerr:has-text("Nothing here is saved")', { timeout: 5000 });
    await page.mouse.click(8, 600);
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
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
  // A wall screen allowed the money card (companion.js marks it wallcard) shows it above the tiles: the next payday and
  // who is paid, what is left after its bills, and the next 3 bills, still with no button; with Finances hiding amounts,
  // the card says $••• for each. A screen not allowed it never asks for it.
  ...[[false, 'shows it'], [true, 'with its amounts hidden']].map(([hidden, what]) => ({ name: `Kiosk mode: the money card ${what}`, screen: 'status', phone: ['companion', 'kiosk'],
    mock: hidden ? { wall: { payday: '2026-11-06', who: ['Alex', 'Jordan'], left: 0, hidden: true, currency: 'USD', bills: [{ name: 'Mortgage', institution: 'wellsfargo', date: '2026-11-01', amount: 0 }] } } : {}, run: async (page) => {
    await page.waitForSelector('#statusRows tr', { timeout: 5000 });
    if (await page.evaluate(() => window.__MOCK.calls.FinancesWall)) throw new Error('a screen not allowed the card asked for it');
    if (await page.isVisible('#wallCard')) throw new Error('the card shows on a screen not allowed it');
    await page.evaluate(() => { document.documentElement.classList.add('wallcard'); window.__emit('status:changed', window.__MOCK.status); });
    await page.waitForSelector('#wallCard:not([hidden]) .wallcard:has-text("Next payday")', { timeout: 5000 });
    const text = await page.textContent('#wallCard');
    if (hidden) {
      if (/\$\d/.test(text) || !text.includes('$•••') || !text.includes('Alex and Jordan')) throw new Error(`the hidden card says: ${text}`);
    } else {
      for (const want of ['Alex', 'Left after its bills', '$739.77', 'Mortgage', '$1,845.00', 'Netflix', 'Internet']) if (!text.includes(want)) throw new Error(`no "${want}" in: ${text}`);
    }
    const tiles = await page.evaluate(() => document.getElementById('wallCard').compareDocumentPosition(document.getElementById('tiles')) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (!tiles) throw new Error('the card is not above the tiles');
    const buttons = await page.evaluate(() => [...document.querySelectorAll('main button')].filter((b) => b.offsetParent).map((b) => b.textContent.trim() || b.title));
    if (buttons.length) throw new Error('buttons show: ' + buttons.join(', '));
  } })),
  // On a wall screen each group of apps still says which it is (Network,
  // Security…), though its fold button is hidden with the other buttons.
  { name: 'Kiosk mode names each group of apps', screen: 'status', run: async (page) => {
    await page.evaluate(() => document.documentElement.classList.add('companion', 'kiosk'));
    await page.waitForSelector('#statusRows tr.grouphead', { timeout: 5000 });
    const heads = await page.evaluate(() => [...document.querySelectorAll('#statusRows tr.grouphead th')].map((th) => ({ label: th.querySelector('.foldbtn')?.textContent.replace(/[▾▸]/g, '').trim(), shown: th.innerText })));
    const unnamed = heads.filter((h) => !h.shown.includes(h.label));
    if (!heads.length || unnamed.length) throw new Error('groups without their name on the screen: ' + unnamed.map((h) => `${h.label} (shows "${h.shown.trim()}")`).join(', '));
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
    await page.click('#app button:text-is("Click again to stop")', { timeout: 1000 });
    await page.waitForSelector('#app .pill:has-text("Stopping…")', { timeout: 300 });
    await page.waitForSelector('#app .rowerr:has-text("Could not stop: the container runtime stopped answering")', { timeout: 5000 });
    await page.waitForSelector('#statusRows tr:has(strong:text-is("Vikunja")) .rowerr:has-text("Could not stop")', { state: 'attached', timeout: 2000 });
    if (!(await page.isVisible('#app .pill.ok:has-text("Running")'))) throw new Error('the page did not go back to Running');
    if (await page.isVisible('#cliPanel')) throw new Error('a sheet opened for a Stop: it runs on the row now');
    await page.click('#app button:text-is("Restart")', { timeout: 2000 });
    await page.waitForSelector('#app .rowerr:has-text("Could not restart")', { timeout: 5000 });
    if (await page.isVisible('#app .rowerr:has-text("Could not stop")')) throw new Error('the old failure stayed after another action');
  } },
  // Settings › Appearance › Motion and Transparency, on every screen.
  { name: 'Motion None: nothing moves on any screen, a running job and an open sheet included', screen: 'status', mock: { look: { motion: 'none' }, actionDelay: 1500 }, run: async (page) => {
    for (const screen of ['choose', 'backups', 'setup', 'settings', 'finances', 'status']) {
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
    await page.waitForSelector('#app .pill:has-text("Restarting…")', { timeout: 2000 });
    const restarting = await page.evaluate(movingNow);
    if (restarting.length) throw new Error(`a restart on its page: ${restarting.slice(0, 4).join('; ')}`);
    // A sheet and its job: Update apps (Start, Stop, and Restart open none now).
    await page.click('nav button[data-screen="status"]');
    await page.click('#updateAll', { timeout: 5000 });
    await page.waitForSelector('#cliPanel:not([hidden])', { timeout: 2000 });
    const moving = await page.evaluate(movingNow);
    if (moving.length) throw new Error(`an open sheet and a job: ${moving.slice(0, 4).join('; ')}`);
  } },
  { name: 'Motion Less: the sheet and the job bar stop moving, colours still fade', screen: 'status', mock: { look: { motion: 'less' }, actionDelay: 1500 }, run: async (page) => {
    // A sheet and its job bar: Update apps (Start, Stop, and Restart open none now).
    await page.click('#updateAll', { timeout: 5000 });
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
    if (await page.isVisible('#cliPanel')) throw new Error('a sheet opened for a Restart: it runs on the page now');
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
    // Vikunja can't be published: no Reach it away from home.
    if (await page.$(sw('Reach it away from home'))) throw new Error('Vikunja shows the reach switch');
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
  // Home only: a public app's Reach it away from home switch, on its page only (not on Vikunja, which can't be
  // published: the settings case checks that); off says home only at once and is the setting "away".
  { name: "An app's reach: Reach it away from home shows on a public app and turns it home only", screen: 'app:paperless', mock: { settingDelay: 600 }, run: async (page) => {
    const sw = `#appSettings input.switch[aria-label="Reach it away from home"]`;
    await page.waitForSelector(sw, { timeout: 5000 });
    if (!(await page.isChecked(sw))) throw new Error('a public app reached away starts off');
    await page.waitForSelector('#appSettings:has-text("Opens anywhere through your Cloudflare tunnel")');
    await page.click(sw);
    if (await page.isChecked(sw)) throw new Error('the switch did not move at once');
    await page.waitForSelector('#appSettings:has-text("Home only: it opens on your home Wi-Fi")', { timeout: 300 });
    await page.waitForSelector(`${sw}:not([disabled])`, { timeout: 5000 });
    const set = await page.evaluate(() => window.__MOCK.settingsSet);
    if (JSON.stringify(set) !== JSON.stringify([['paperless', 'away', false]])) throw new Error('set ' + JSON.stringify(set));
    if (await page.isChecked(sw)) throw new Error('the switch went back after Status was read');
    const reach = await page.evaluate(() => window.__MOCK.status.apps.find((a) => a.id === 'paperless').reach);
    if (reach !== 'home') throw new Error('Status says ' + reach);
  } },
  // An update window per app: Only on Sundays under Nightly updates, said at once; one set to other days from the
  // CLI says those days, and a held app has no window to choose.
  { name: "An app's update window: Only on Sundays, and the days the CLI set", screen: 'app:vikunja', mock: { settingDelay: 600 }, run: async (page) => {
    const sw = (label) => `#appSettings input.switch[aria-label="${label}"]`;
    await page.waitForSelector(sw('Only on Sundays'), { timeout: 5000 });
    if (await page.isChecked(sw('Only on Sundays'))) throw new Error('an app with no window starts on Sundays only');
    await page.waitForSelector('#appSettings:has-text("Every night, with a backup of its data first")');
    await page.click(sw('Only on Sundays'));
    if (!(await page.isChecked(sw('Only on Sundays')))) throw new Error('the switch did not move at once');
    await page.waitForSelector('#appSettings:has-text("On Sundays only, with a backup of its data first")', { timeout: 300 });
    await page.waitForSelector(`${sw('Only on Sundays')}:not([disabled])`, { timeout: 5000 });
    const set = await page.evaluate(() => window.__MOCK.settingsSet);
    if (JSON.stringify(set) !== JSON.stringify([['vikunja', 'sundays', true]])) throw new Error('set ' + JSON.stringify(set));
    if (!(await page.isChecked(sw('Only on Sundays')))) throw new Error('the switch went back after Status was read');
    // Days set from the CLI (homelab updates days vikunja sat+sun): the switch names them, and off is every night.
    await page.evaluate(() => { const M = window.__MOCK; M.status = { ...M.status, apps: M.status.apps.map((a) => (a.id === 'vikunja' ? { ...a, updateDays: ['sat', 'sun'] } : a)) }; });
    await page.click(sw('Tell me if it stops')); // a change reads Status again
    await page.waitForSelector(sw('Only on Saturdays and Sundays'), { timeout: 5000 });
    await page.waitForSelector('#appSettings:has-text("On Saturdays and Sundays only")');
    // Held: no window to choose.
    await page.click(sw('Nightly updates'));
    await page.waitForSelector('#appSettings:has-text("Held: the nightly update leaves it out")', { timeout: 300 });
    if (await page.locator(sw('Only on Saturdays and Sundays')).count()) throw new Error('a held app still offers its days');
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
  { name: 'Restart an app', screen: 'app:vikunja', mock: { actionDelay: 600 }, run: async (page) => {
    await page.click('#app button:text-is("Restart")', { timeout: 5000 });
    await page.waitForSelector('#app .pill:has-text("Restarting…")', { timeout: 2000 });
    if (await page.isVisible('#cliPanel')) throw new Error('a sheet opened for a Restart: it runs on the row now');
    await page.waitForSelector('#app .pill.ok:has-text("Running")', { timeout: 5000 });
  } },
  // Finances: post-pay checking for the next paycheck first; picking another changes it.
  // Hide amounts: Ctrl+Shift+H (⌘⇧H on a Mac) writes every amount as $••• on every view and in the sidebar, labels and
  // tooltips included, saves it in the plan, and the eye shows them again; a figure keeps no sign or colour meanwhile.
  { name: 'Finances: Hide amounts hides every amount, and the eye shows them again', screen: 'finances', run: async (page) => {
    const shown = () => page.evaluate(() => {
      const els = [document.getElementById('finRoot'), document.getElementById('finNav')];
      const text = els.map((e) => [e.innerText, ...[...e.querySelectorAll('[aria-label], [title]')].map((x) => `${x.getAttribute('aria-label') || ''} ${x.getAttribute('title') || ''}`)].join('\n')).join('\n');
      return (text.match(/[$€£]\s?\d[\d,.]*k?/g) || []).slice(0, 5);
    });
    await page.waitForSelector('#finances.active .fx-paycheck .fx-figure', { timeout: 5000 });
    if (!(await shown()).length) throw new Error('no amount shown to begin with');
    const mac = await page.evaluate(() => /Mac/.test(navigator.platform));
    await page.keyboard.press(mac ? 'Meta+Shift+H' : 'Control+Shift+H');
    await page.waitForSelector('#finRoot .fx-eye[aria-pressed="true"]', { timeout: 3000 });
    // Each figure is there, as $•••: not gone.
    const figure = (await page.textContent('#finRoot .fx-paycheck .fx-figure')).trim();
    if (figure !== '$•••') throw new Error(`the paycheck's figure says "${figure}"`);
    const narrow = await page.$$eval('#finRoot .fx-amount, #finNav .fx-amount', (els) => els.filter((e) => e.checkVisibility() && e.getBoundingClientRect().width < 8).length);
    if (narrow) throw new Error(`${narrow} hidden amounts take no room: they cannot be seen`);
    const groups = await page.$$eval('#finNav .fx-balance .fx-amount', (els) => els.map((e) => e.textContent.trim()));
    if (!groups.length || groups.some((t) => t !== '$•••')) throw new Error(`the sidebar's groups say ${groups.join(', ')}`);
    for (const tab of ['Dashboard', 'Calendar', 'Transactions', 'Reports', 'Recurring', 'Pay', 'Net worth']) {
      await finTab(page, tab);
      await page.waitForTimeout(150);
      const left = await shown();
      if (left.length) throw new Error(`${tab} still shows ${left.join(', ')}`);
    }
    if (!(await page.textContent('#finNav')).includes('$•••')) throw new Error('the sidebar does not say $•••');
    if (await page.$('#finRoot .fx-amount.fx-out, #finRoot .fx-amount.fx-in')) throw new Error('a hidden amount still says which way it went');
    const saved = await page.evaluate(() => window.__MOCK.financesSaved || []);
    if (!saved.length || !saved[saved.length - 1].hideAmounts) throw new Error('hidden amounts were not kept in the plan');
    // The sidebar's eye, from another screen, shows them again.
    await page.click('button[data-screen="status"]');
    await page.waitForSelector('#status.active', { timeout: 3000 });
    await page.click('#finNav .fx-eye');
    await page.waitForFunction(() => !(window.__MOCK.financesSaved.at(-1).hideAmounts), null, { timeout: 3000 });
    if (!(await page.textContent('#finNav')).match(/\$\d/)) throw new Error('the sidebar did not show its amounts again');
  } },
  // A phone allowed only to look follows the plan: amounts hidden, saying so, with no eye to show them.
  { name: 'The phone, view only: hidden amounts stay hidden', screen: 'finances', phone: ['companion', 'finances'], mock: { finances: { ...finances, readOnly: true, plan: { ...finances.plan, hideAmounts: true } } }, run: async (page) => {
    await page.waitForSelector('#finRoot .pill:text-is("Amounts hidden")', { timeout: 5000 });
    if (await page.$('.fx-eye')) throw new Error('a phone that may only look can show the amounts');
    const text = await page.textContent('#finRoot');
    if (/\$\d/.test(text) || !text.includes('$•••')) throw new Error('an amount shows on the phone');
    await page.keyboard.press((await page.evaluate(() => /Mac/.test(navigator.platform))) ? 'Meta+Shift+H' : 'Control+Shift+H');
    await page.waitForTimeout(300);
    if (await page.evaluate(() => (window.__MOCK.financesSaved || []).length)) throw new Error('the shortcut saved from a phone that may only look');
  } },
  // Checking now and after the next paycheck, each with how it adds up: resting on it, Tab, or a tap shows the start, every row, and the result.
  { name: 'Finances: checking now and after the next paycheck say how they add up', screen: 'finances', mock: {
    finances: { ...finances, checkingNow: { date: '2026-10-30', from: '2026-10-27', start: 2560.6, steps: [{ date: '2026-10-28', transaction: 't6', name: 'Shell', amount: -48.2, after: 2512.4 }], result: 2512.4 } },
  }, run: async (page) => {
    await page.waitForSelector('#finances.active .fx-clear #finAfterPay', { timeout: 5000 });
    const now = await page.textContent('#finNow .fx-figure'), after = await page.textContent('#finAfterPay .fx-figure');
    if (!now.includes('2,512') || !after.includes('2,557')) throw new Error(`checking now ${now}, after the paycheck ${after}`);
    if (!(await page.textContent('#finAfterPay .fx-caption')).includes("Alex's paycheck")) throw new Error('the figure does not say whose paycheck');
    await page.hover('#finAfterPay');
    const card = '.fx-clear .hovercard:has(.fx-working):visible';
    await page.waitForSelector(card, { timeout: 5000 });
    const text = await page.textContent(card);
    for (const want of ['Checking now', 'Groceries and gas', 'Mortgage', 'Netflix', 'Peloton', "Alex's paycheck", 'Once the paycheck is in', '2,557.91', 'One payment due']) {
      if (!text.includes(want)) throw new Error(`how it adds up has no ${want}: ${text}`);
    }
    // The keyboard reaches the other: its working starts from the balance as typed in, with what has happened since.
    await page.mouse.move(0, 0);
    await page.focus('#finNow');
    await page.waitForSelector(card, { timeout: 5000 });
    const since = await page.textContent(card);
    if (!since.includes('Checking, typed in') || !since.includes('Shell') || !since.includes('2,560.60')) throw new Error(`checking now's working: ${since}`);
    await page.keyboard.press('Escape');
    await page.waitForSelector(card, { state: 'hidden', timeout: 5000 });
  } },
  { name: 'The phone, view only: a tap on checking after the paycheck shows how it adds up', screen: 'finances', phone: ['companion', 'finances'], mock: { finances: { ...finances, readOnly: true } }, run: async (page) => {
    await page.waitForSelector('.fx-clear #finAfterPay', { timeout: 5000 });
    await page.click('#finAfterPay');
    await page.waitForSelector('.fx-clear .hovercard:has(.fx-working):visible', { timeout: 5000 });
    const box = await page.$eval('.fx-clear .hovercard:has(.fx-working)', (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth }; });
    if (box.l < 0 || box.r > box.w) throw new Error(`the card leaves the screen: ${JSON.stringify(box)}`);
  } },
  // One period picker for the whole Dashboard (finances-handoff.md, Step 4): a bar above every card, with the period's
  // name and days, ‹ › and Today; the paycheck card has no ‹ › of its own and follows it, as the checking chart does.
  { name: 'Finances: one period picker atop the Dashboard, the cards follow it', screen: 'finances', run: async (page) => {
    await page.waitForSelector('#finances.active #finPeriod h2', { timeout: 5000 });
    const first = await page.$eval('#finPeriod', (e) => !!(e.compareDocumentPosition(document.querySelector('#finRoot .fx-board')) & Node.DOCUMENT_POSITION_FOLLOWING) && !e.closest('.fx-board'));
    if (!first) throw new Error('the period bar is not above the cards');
    if (await page.$('.fx-paycheck button[aria-label="The pay period after"]')) throw new Error('the paycheck card still has its own ‹ ›');
    const dates = await page.textContent('.fx-paycheck .fx-dates');
    await page.click('#finPeriod button[aria-label="The pay period after"]');
    await page.waitForFunction((d) => document.querySelector('.fx-paycheck .fx-dates')?.textContent !== d, dates, { timeout: 5000 });
    const bar = await page.textContent('#finPeriod .fx-dates');
    if (bar !== (await page.textContent('.fx-paycheck .fx-dates'))) throw new Error(`the bar says ${bar}, the card ${await page.textContent('.fx-paycheck .fx-dates')}`);
    await page.click('#finPeriod button[aria-label="The pay period before"]');
    await page.waitForFunction((d) => document.querySelector('.fx-paycheck .fx-dates')?.textContent === d, dates, { timeout: 5000 });
    // Today: now, until the next paycheck, and then Today waits.
    await page.click('#finPeriod button:text-is("Today")');
    await page.waitForSelector('#finPeriod h2:text-matches("^Now")', { timeout: 5000 });
    if (!(await page.isDisabled('#finPeriod button:text-is("Today")'))) throw new Error('Today is offered while today is picked');
  } },
  // Step 4, PR 2: ‹ from now steps back to the paychecks that happened (View.before, from the plan's schedules run back),
  // each read from the ledger, not the plan: what came in and went out (a transfer to the Roth is neither), its
  // transactions in the paycheck card's place, and where it went; Latest transactions steps aside. The example's ledger:
  // Jordan's paycheck on Oct 26 ($2,400) and Shell on the 28th ($48.20); Claude Pro and Trader Joe's on Alex's Oct 23.
  { name: 'Finances: the period bar steps back to what happened, from the transactions', screen: 'finances', run: async (page) => {
    await page.waitForSelector('#finances.active #finPeriod h2', { timeout: 5000 });
    await page.click('#finPeriod button:text-is("Today")');
    await page.waitForSelector('#finPeriod h2:text-matches("^Now")', { timeout: 5000 });
    await page.click('#finPeriod button[aria-label="The pay period before"]');
    await page.waitForSelector('#finPeriod h2:text-is("Jordan\'s paycheck · Mon, Oct 26")', { timeout: 5000 });
    if ((await page.textContent('#finPeriod .fx-dates')) !== 'Oct 26 – Oct 29, what happened') throw new Error(`the days: ${await page.textContent('#finPeriod .fx-dates')}`);
    await page.waitForSelector('.fx-past', { timeout: 5000 });
    if (await page.$('.fx-paycheck, .fx-latest')) throw new Error('the plan\'s paycheck card, or Latest transactions, shows for a period before now');
    const sum = async (caption) => (await page.textContent(`.fx-past .fx-stat:has(.fx-caption:text-is("${caption}")) .fx-figure`)).replace(/\s+/g, '');
    if (!(await sum('Came in')).startsWith('$2,400')) throw new Error(`came in: ${await sum('Came in')}`);
    if (!(await sum('Went out')).startsWith('$48')) throw new Error(`went out (the Roth is a transfer): ${await sum('Went out')}`);
    await page.waitForSelector('.fx-past li:has-text("Shell")', { timeout: 5000 });
    if (await page.$('.fx-past li:has-text("Trader Joe")')) throw new Error('a transaction from before the period');
    await page.waitForSelector('.fx-spentmonth h2:text-is("Where it went")', { timeout: 5000 });
    // A paycheck further back: Alex's, Oct 23 to 25.
    await page.click('#finPeriod button[aria-label="The pay period before"]');
    await page.waitForSelector('#finPeriod h2:text-is("Alex\'s paycheck · Fri, Oct 23")', { timeout: 5000 });
    await page.waitForSelector('.fx-past li:has-text("Trader Joe")', { timeout: 5000 });
    await page.waitForSelector('.fx-past li:has-text("Claude Pro")', { timeout: 5000 });
    if (!(await sum('Went out')).startsWith('$263')) throw new Error(`went out: ${await sum('Went out')}`);
    // Today: the plan's again.
    await page.click('#finPeriod button:text-is("Today")');
    await page.waitForSelector('.fx-paycheck', { timeout: 5000 });
    await page.waitForSelector('.fx-latest', { timeout: 5000 });
    // Net worth reads the plan's periods only: a pick before now leaves it on now.
    await page.click('#finPeriod button[aria-label="The pay period before"]');
    await finTab(page, 'Net worth');
    await page.waitForSelector('.finpost tbody tr', { timeout: 5000 });
  } },
  // Step 4, PR 3: By month on the period bar. The example's today is Oct 30: October is so far (from the ledger) and
  // still to come (the plan's Oct 31); November is the plan; September is what happened (nothing kept that month).
  // Back to By paycheck, the paycheck card again.
  { name: 'Finances: By month steps months, and the cards follow', screen: 'finances', run: async (page) => {
    await page.waitForSelector('#finances.active #finPeriod h2', { timeout: 5000 });
    await page.click('#finPeriod .seg button:text-is("By month")');
    await page.waitForSelector('#finPeriod h2:text-is("October 2026")', { timeout: 5000 });
    if ((await page.textContent('#finPeriod .fx-dates')) !== 'Oct 1 – Oct 31, so far, then the plan') throw new Error(`the days: ${await page.textContent('#finPeriod .fx-dates')}`);
    if (await page.$('.fx-paycheck')) throw new Error('the paycheck card shows by month');
    await page.waitForSelector('.fx-past h2:text-is("So far this month")', { timeout: 5000 });
    // October's seven, the newest six first: Costco on the 30th, then Show all for Verizon on the 22nd.
    await page.waitForSelector('.fx-past li:has-text("Costco")', { timeout: 5000 });
    await page.click('.fx-past button:text-is("Show all 7 transactions")');
    await page.waitForSelector('.fx-past li:has-text("Verizon")', { timeout: 5000 });
    await page.waitForSelector('.fx-planned h2:text-is("Still to come")', { timeout: 5000 });
    await page.waitForSelector('.fx-planned li:has-text("Groceries and gas")', { timeout: 5000 });
    // November: the plan, its paychecks and payments; nothing spent yet, so no spending ring.
    await page.click('#finPeriod button[aria-label="The month after"]');
    await page.waitForSelector('#finPeriod h2:text-is("November 2026")', { timeout: 5000 });
    await page.waitForSelector('.fx-planned h2:text-is("The plan")', { timeout: 5000 });
    await page.waitForSelector('.fx-planned li:has-text("Alex\'s paycheck")', { timeout: 5000 });
    if (await page.$('.fx-past, .fx-spentmonth')) throw new Error('what happened, or the spending ring, shows for a month ahead');
    // September: what happened, from the ledger, which kept nothing then.
    await page.click('#finPeriod button:text-is("Today")');
    await page.waitForSelector('#finPeriod h2:text-is("October 2026")', { timeout: 5000 });
    await page.click('#finPeriod button[aria-label="The month before"]');
    await page.waitForSelector('#finPeriod h2:text-is("September 2026")', { timeout: 5000 });
    await page.waitForSelector('.fx-past :text("No transactions kept for these days.")', { timeout: 5000 });
    if (await page.$('.fx-planned')) throw new Error('the plan shows for a month before now');
    // By paycheck again: the paycheck card, and the bar's paycheck.
    await page.click('#finPeriod .seg button:text-is("By paycheck")');
    await page.waitForSelector('.fx-paycheck', { timeout: 5000 });
    await page.waitForSelector('#finPeriod h2:text-matches("paycheck|^Now")', { timeout: 5000 });
  } },
  { name: 'Finances: the next paycheck, picking another, and every view', screen: 'finances', run: async (page) => {
    await page.waitForSelector('#finances.active .fx-paycheck .fx-figure', { timeout: 5000 });
    const first = await page.textContent('.fx-paycheck .fx-figure');
    if (!first.includes('739')) throw new Error(`post-pay checking after the next paycheck: ${first}`);
    // The period bar atop the Dashboard steps to the paycheck after, and the one after that: Jordan's.
    await page.click('#finPeriod button[aria-label="The pay period after"]');
    await page.click('#finPeriod button[aria-label="The pay period after"]');
    await page.waitForSelector('#finPeriod h2:has-text("Jordan")', { timeout: 5000 });
    if ((await page.textContent('.fx-paycheck .fx-figure')) === first) throw new Error('picking another paycheck changed nothing');
    for (const [tab, sel] of [['Recurring', '.fx-payments li:has-text("Netflix")'], ['Pay', '.fx-person h2:has-text("Alex")'], ['Net worth', '.fx-ownlist li:has-text("RAV4")'], ['Dashboard', '.fx-paycheck']]) {
      await finTab(page, tab);
      await page.waitForSelector(sel, { timeout: 5000 });
    }
  } },
  // An account kept in euros, at $1.10: Update balances asks for it in euros, Net worth shows both, and the rate is kept in
  // Pay › Paydays and money (one of nothing or less refused); with no such account there is no rate to set.
  { name: 'Finances: an account in euros in Update balances, Net worth, and the rates', screen: 'finances', mock: {
    finances: { ...finances, start: { ...finances.start, sav: 7150 }, plan: { ...finances.plan, rates: { EUR: 1.1 }, accounts: finances.plan.accounts.map((a) => (a.id === 'sav' ? { ...a, currency: 'EUR' } : a)) } },
  }, run: async (page) => {
    await page.click('#finRoot .toolbar button:text-is("Update balances")', { timeout: 5000 });
    if ((await page.inputValue('#bal-sav')) !== '6500') throw new Error(`BofA Savings starts at ${await page.inputValue('#bal-sav')}`);
    await page.waitForSelector('#finSheet li:has(#bal-sav) .moneyfield > span:text-is("€")', { timeout: 5000 });
    await page.waitForSelector('#finSheet li:has(#bal-sav) small:has-text("expected €6,500.00")', { timeout: 5000 });
    await page.fill('#bal-sav', '6600');
    await page.waitForSelector('#finSheet li:has(#bal-sav) small:has-text("+€100.00")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    let plan = await page.evaluate(() => window.__MOCK.financesSaved.at(-1));
    if (plan.accounts.find((a) => a.id === 'sav').balance !== 6600 || plan.accounts.find((a) => a.id === 'chk').balance !== 2512.4) throw new Error(`saved ${JSON.stringify(plan.accounts.slice(0, 2))}`);
    await finTab(page, 'Net worth');
    await page.waitForSelector('.fin li:has-text("BofA Savings") .line:has-text("€6,500.00 · ")', { timeout: 5000 });
    await finTab(page, 'Pay');
    await page.waitForSelector('.finrates label:has-text("1 EUR is"):has-text("BofA Savings")', { timeout: 5000 });
    if ((await page.inputValue('.finrates input[aria-label="1 EUR in USD"]')) !== '1.1') throw new Error('the rate is not shown');
    await page.fill('.finrates input[aria-label="1 EUR in USD"]', '0');
    await page.press('.finrates input[aria-label="1 EUR in USD"]', 'Tab');
    await page.waitForSelector('.finrates .formerr:has-text("Type how many USD one EUR is.")', { timeout: 5000 });
    const before = await page.evaluate(() => window.__MOCK.financesSaved.length);
    await page.fill('.finrates input[aria-label="1 EUR in USD"]', '1.2');
    await page.press('.finrates input[aria-label="1 EUR in USD"]', 'Tab');
    await page.waitForFunction((n) => window.__MOCK.financesSaved.length === n + 1, before, { timeout: 5000 });
    plan = await page.evaluate(() => window.__MOCK.financesSaved.at(-1));
    if (plan.rates?.EUR !== 1.2 || (plan.currency || 'USD') !== 'USD') throw new Error(`rates ${JSON.stringify(plan.rates)} ${plan.currency}`);
    if (await page.$('.finrates .formerr')) throw new Error('the problem stayed');
  } },
  { name: 'Finances: with every account in one currency, no rates are asked for', screen: 'finances', run: async (page) => {
    await finTab(page, 'Pay', { timeout: 5000 });
    await page.waitForSelector('.finsettings', { timeout: 5000 });
    if (await page.$('.finrates')) throw new Error('rates asked for with no account in another currency');
  } },
  // Loans on Net worth: each read to zero (what goes to it a month, the month it is paid off), and the one picked charted to zero.
  { name: 'Finances: loans read to zero, and charted', screen: 'finances', run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await page.waitForSelector('.fx-loans li:has-text("Mortgage"):has-text("$1,845.00 a month: paid off Oct 2039")', { timeout: 5000 });
    await page.waitForSelector('.fx-loans li:has-text("Toyota Financial"):has-text("$412.00 a month: paid off Feb 2029")', { timeout: 5000 });
    await page.waitForSelector('.fx-loanchart h3:text-is("Mortgage, to zero")', { timeout: 5000 });
    await page.click('.fx-loanchart [role=radio]:text-is("Toyota Financial")');
    await page.waitForSelector('.fx-loanchart h3:text-is("Toyota Financial, to zero")', { timeout: 5000 });
    const rows = await page.$$eval('.fx-loanchart table.sr tbody tr', (rs) => rs.map((r) => r.textContent));
    if (rows.join(' | ') !== 'Dec 2026$10,416.00 | Dec 2027$5,472.00 | Dec 2028$528.00 | Feb 2029$0.00') throw new Error(`the car loan's years: ${rows.join(' | ')}`);
    if (await page.$('.fx-loansdone')) throw new Error('a paid-off list with every loan owing');
  } },
  // A payment that does not keep up with the interest, or none at all, in amber; a loan owing nothing under Paid off, uncharted.
  { name: 'Finances: a loan never paid off at its payment, and one paid off', screen: 'finances', mock: { finances: { ...finances, loans: [{ account: 'mortgage', balance: 287400, rate: 6.25, monthly: 1400, never: true }, { account: 'carloan', balance: 0, monthly: 0 }] } }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await page.waitForSelector('.fx-loans li:has-text("Mortgage") .fx-warn:text-is("$1,400.00 a month does not keep up with its interest · 6.25% a year")', { timeout: 5000 });
    await page.waitForSelector('.fx-loans h3.fx-loansdone + ul li:has-text("Toyota Financial"):has-text("Paid off")', { timeout: 5000 });
    if (await page.$('.fx-loanchart')) throw new Error('a loan never paid off was charted to zero');
  } },
  // A car read from its purchase: Net worth says what it cost and when; its form keeps the purchase, and a new one needs its day.
  { name: "Finances: a car's worth read from what it cost and when", screen: 'finances', run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await page.waitForSelector('.fx-ownlist li:has-text("RAV4") .line:has-text("bought for $32,000, Mar 2022")', { timeout: 5000 });
    await acctForm(page, '.fx-ownlist li:has-text("RAV4") button');
    if ((await page.inputValue('#finSheet label:has-text("Bought for") input')) !== '32000' || (await page.inputValue('#finSheet label:has-text("Bought on") input')) !== '2022-03-15' || (await page.inputValue('#finSheet label:has-text("How it holds its value") select')) !== 'holds') throw new Error('the purchase is not in the form');
    await page.waitForSelector('#finSheet .formsub:has-text("At its age it is worth about $"):has-text("falls from the day you type it")', { timeout: 5000 });
    await page.selectOption('#finSheet label:has-text("How it holds its value") select', 'fast');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    let car = await page.evaluate(() => window.__MOCK.financesSaved.at(-1).accounts.find((a) => a.id === 'rav4'));
    if (car.bought !== 32000 || car.boughtOn !== '2022-03-15' || car.holds !== 'fast' || car.balance !== 18500) throw new Error(`saved ${JSON.stringify(car)}`);
    await page.click('#finRoot .toolbar button:text-is("Add an account")');
    await page.click('#finSheet button.kindrow:has(strong:text-is("Car"))');
    await page.fill('#finSheet label:has-text("Name") input', 'Civic');
    await page.fill('#finSheet label:has-text("Bought for") input', '25000');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet .formerr:has-text("Pick the day it was bought, or leave what it cost empty.")', { timeout: 5000 });
    await page.fill('#finSheet label:has-text("Bought on") input', '2025-06-01');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    car = await page.evaluate(() => window.__MOCK.financesSaved.at(-1).accounts.find((a) => a.name === 'Civic'));
    if (car?.bought !== 25000 || car.boughtOn !== '2025-06-01' || car.holds || car.balance !== 0) throw new Error(`saved ${JSON.stringify(car)}`);
  } },
  // Financial independence: an estimate, said to be one; what is enough, how far there, and when, two growth points either way.
  // The two assumptions are kept as they change, within reason.
  { name: 'Finances: financial independence, an estimate and its two assumptions', screen: 'finances', run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await page.waitForSelector('.fx-fire .fx-firenote:text-is("An estimate from two assumptions below, not advice.")', { timeout: 5000 });
    const says = (await page.textContent('.fx-fire .fx-firesays')).replace(/\s+/g, ' ').trim();
    if (says !== "$1,579,429 would be enough: a year's spending of $63,177, drawing 4% of it a year. The investment and retirement accounts hold $61,300, 4% of it.") throw new Error(`says ${says}`);
    await page.waitForSelector('.fx-fire .fx-firewhen:text-is("At $1,080 a month put by and 5% growth a year after rising prices, about Apr 2062 (Aug 2055 at 7%, Jan 2074 at 3%).")', { timeout: 5000 });
    await page.fill('.fx-fire input[aria-label="Growth a year after rising prices, %"]', '25');
    await page.press('.fx-fire input[aria-label="Growth a year after rising prices, %"]', 'Tab');
    await page.waitForSelector('.fx-fire .formerr:text-is("Growth a year is between -10% and 20%.")', { timeout: 5000 });
    if (await page.evaluate(() => window.__MOCK.financesSaved?.length)) throw new Error('growth of 25% was kept');
    await page.fill('.fx-fire input[aria-label="Share to spend a year, %"]', '3.5');
    await page.press('.fx-fire input[aria-label="Share to spend a year, %"]', 'Tab');
    await page.waitForFunction(() => window.__MOCK.financesSaved?.length === 1, null, { timeout: 5000 });
    const plan = await page.evaluate(() => window.__MOCK.financesSaved.at(-1));
    if (plan.withdraw !== 3.5 || plan.growth) throw new Error(`kept ${plan.withdraw} ${plan.growth}`);
  } },
  { name: 'The phone, view only: the estimate shown, its assumptions not changed', screen: 'finances', phone: ['companion', 'finances'], mock: { finances: { ...finances, readOnly: true } }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await page.waitForSelector('.fx-fire .fx-firewhen', { timeout: 5000 });
    if (await page.$('.fx-fireset')) throw new Error('a phone allowed only to look can change the estimate');
  } },
  // A payment an app running here does the job of (docs/Savings.md through the catalog): said with what it still costs a year;
  // Cancelled it takes it out and keeps it, and the total of those cancelled because of the homelab shows under them.
  { name: 'Finances: payments the homelab does the job of, and one cancelled', screen: 'finances', run: async (page) => {
    await finTab(page, 'Recurring', { timeout: 5000 });
    await page.waitForSelector('.fx-homelab li:has-text("Netflix"):has-text("Jellyfin is running: Netflix still costs $185.88 a year")', { timeout: 5000 });
    const rows = await page.$$eval('.fx-homelab li', (ls) => ls.map((l) => l.querySelector('.grow > strong').textContent));
    if (rows.join() !== 'Netflix,Spotify') throw new Error(`replaced: ${rows}`);
    if (await page.$('.fx-homelab .fx-cancelled')) throw new Error('a total with nothing cancelled');
    await page.click('.fx-homelab li:has-text("Netflix") button:text-is("Cancelled it")');
    await page.waitForFunction(() => window.__MOCK.financesSaved?.length === 1, null, { timeout: 5000 });
    const plan = await page.evaluate(() => window.__MOCK.financesSaved.at(-1));
    const c = plan.cancelled?.[0];
    if (plan.payments.some((x) => x.id === 'netflix') || plan.cancelled.length !== 1 || c.name !== 'Netflix' || c.annual !== 185.88 || c.because !== 'Jellyfin' || !/^\d{4}-\d{2}-\d{2}$/.test(c.date)) throw new Error(`saved ${JSON.stringify(plan.cancelled)}`);
    await page.waitForSelector('.fx-homelab .fx-cancelled:has-text("Cancelled because of the homelab: $185.88 a year (Netflix)")', { timeout: 5000 });
  } },
  { name: 'The phone, view only: the homelab says what it does, nothing to cancel', screen: 'finances', phone: ['companion', 'finances'], mock: { finances: { ...finances, readOnly: true } }, run: async (page) => {
    await finTab(page, 'Recurring', { timeout: 5000 });
    await page.waitForSelector('.fx-homelab li:has-text("Netflix")', { timeout: 5000 });
    if (await page.$('.fx-homelab button')) throw new Error('a phone allowed only to look can cancel a payment');
  } },
  // Set aside on Pay: each bill that comes less often than monthly with what it needs a paycheck, and a payment into savings
  // with each paycheck that covers them all, added, then brought up to date when a bill changed.
  { name: 'Finances: set aside each paycheck for bills that come less often', screen: 'finances', run: async (page) => {
    await finTab(page, 'Pay', { timeout: 5000 });
    await page.waitForSelector('.fx-setaside .fx-setasidesays:text-is("$18.47 from each paycheck covers them as they come.")', { timeout: 5000 });
    await page.waitForSelector('.fx-setaside li:has-text("Water and sewer"):has-text("$480.00 a year · next Jan 10, 2027"):has-text("$13.03 a paycheck")', { timeout: 5000 });
    await page.waitForSelector('.fx-setaside li:has-text("Claude Pro"):has-text("$200.00 a year · next Oct 23, 2027"):has-text("$5.43 a paycheck")', { timeout: 5000 });
    await page.click('.fx-setaside button:text-is("Set it aside with each paycheck")');
    await page.waitForFunction(() => window.__MOCK.financesSaved?.length === 1, null, { timeout: 5000 });
    let x = await page.evaluate(() => window.__MOCK.financesSaved.at(-1).payments.find((q) => q.name === 'Set aside for bills'));
    if (x?.amount !== 18.47 || x.to !== 'sav' || x.kind !== 'savings' || x.schedule.every !== 'paycheck' || x.schedule.person) throw new Error(`added ${JSON.stringify(x)}`);
    await page.waitForSelector('.fx-setaside .fx-setasidesays:has-text("“Set aside for bills” moves it into BofA Savings.")', { timeout: 5000 });
    if (await page.$('.fx-setaside button')) throw new Error('offered again when it is up to date');
  } },
  { name: 'Finances: set aside brought up to date when the bills changed', screen: 'finances', mock: { finances: { ...finances, plan: { ...finances.plan, payments: [...finances.plan.payments, { id: 'aside', name: 'Set aside for bills', amount: 10, kind: 'savings', to: 'sav', schedule: { every: 'paycheck', start: '2026-10-30' } }] } } }, run: async (page) => {
    await finTab(page, 'Pay', { timeout: 5000 });
    await page.waitForSelector('.fx-setaside .fx-setasidesays:has-text("“Set aside for bills” moves $10.00 now.")', { timeout: 5000 });
    await page.click('.fx-setaside button:text-is("Make it $18.47 a paycheck")');
    await page.waitForFunction(() => window.__MOCK.financesSaved?.length === 1, null, { timeout: 5000 });
    const list = await page.evaluate(() => window.__MOCK.financesSaved.at(-1).payments.filter((q) => q.name === 'Set aside for bills'));
    if (list.length !== 1 || list[0].id !== 'aside' || list[0].amount !== 18.47) throw new Error(`kept ${JSON.stringify(list)}`);
  } },
  // The reminders through ntfy, each on to start and kept off or on again as it is ticked.
  { name: 'Finances: reminders turned off and on again', screen: 'finances', run: async (page) => {
    await finTab(page, 'Pay', { timeout: 5000 });
    await page.waitForSelector(".finreminders legend:text-is(\"Reminders through the homelab's ntfy\")", { timeout: 5000 });
    const on = await page.$$eval('.finreminders input[type=checkbox]', (bs) => bs.map((b) => b.checked));
    if (on.join() !== 'true,true,true,true') throw new Error(`to start: ${on}`);
    await page.click('.finreminders label:has-text("A bill or card due tomorrow") input');
    await page.waitForFunction(() => window.__MOCK.financesSaved?.length === 1, null, { timeout: 5000 });
    if (JSON.stringify(await page.evaluate(() => window.__MOCK.financesSaved.at(-1).quiet)) !== '["due"]') throw new Error('due not kept off');
    await page.waitForFunction(() => !document.querySelector('.finreminders label:first-of-type input').checked, null, { timeout: 5000 });
    await page.click('.finreminders label:has-text("A bill or card due tomorrow") input');
    await page.waitForFunction(() => window.__MOCK.financesSaved?.length === 2, null, { timeout: 5000 });
    if (await page.evaluate(() => window.__MOCK.financesSaved.at(-1).quiet)) throw new Error('due not on again');
  } },
  // The calendar feed: a link made with a random key (with amounts, as asked), shown to copy; a new one replaces the key,
  // amounts go off, and Turn it off takes the key away.
  { name: 'Finances: a calendar link made, made again, and turned off', screen: 'finances', run: async (page) => {
    await finTab(page, 'Pay', { timeout: 5000 });
    await page.waitForSelector('.fincalendar legend:text-is("Calendar feed")', { timeout: 5000 });
    await page.click('.fincalendar label:has-text("With amounts") input');
    await page.click('.fincalendar button:text-is("Make a calendar link")');
    await page.waitForFunction(() => window.__MOCK.financesSaved?.length === 1, null, { timeout: 5000 });
    let plan = await page.evaluate(() => window.__MOCK.financesSaved.at(-1));
    const key = plan.calendarKey;
    if (!/^[0-9a-f]{48}$/.test(key || '') || plan.calendarAmounts !== true) throw new Error(`made ${key} ${plan.calendarAmounts}`);
    await page.waitForFunction((k) => document.querySelector('.fincalendar input[aria-label="Calendar link"]')?.value === `https://homelab.tail1.ts.net:8099/finances.ics?key=${k}`, key, { timeout: 5000 });
    await page.click('.fincalendar button:text-is("Make a new link (the old one stops working)")');
    await page.waitForFunction(() => window.__MOCK.financesSaved?.length === 2, null, { timeout: 5000 });
    plan = await page.evaluate(() => window.__MOCK.financesSaved.at(-1));
    if (!/^[0-9a-f]{48}$/.test(plan.calendarKey) || plan.calendarKey === key || plan.calendarAmounts !== true) throw new Error(`made again ${plan.calendarKey}`);
    await page.click('.fincalendar label:has-text("With amounts") input');
    await page.waitForFunction(() => window.__MOCK.financesSaved?.length === 3, null, { timeout: 5000 });
    if (await page.evaluate(() => window.__MOCK.financesSaved.at(-1).calendarAmounts)) throw new Error('amounts not off');
    await page.click('.fincalendar button:text-is("Turn it off")');
    await page.waitForFunction(() => window.__MOCK.financesSaved?.length === 4, null, { timeout: 5000 });
    plan = await page.evaluate(() => window.__MOCK.financesSaved.at(-1));
    if (plan.calendarKey || plan.calendarAmounts) throw new Error(`not off: ${plan.calendarKey}`);
    await page.waitForSelector('.fincalendar button:text-is("Make a calendar link")', { timeout: 5000 });
  } },
  { name: 'Finances: a calendar link says why it cannot be made here', screen: 'finances', mock: { calendarProblem: 'the calendar needs Tailscale or the homelab\'s own domain: it is never sent over the home Wi-Fi', finances: { ...finances, plan: { ...finances.plan, calendarKey: 'a'.repeat(48) } } }, run: async (page) => {
    await finTab(page, 'Pay', { timeout: 5000 });
    await page.waitForSelector('.fincalendar .formerr:has-text("never sent over the home Wi-Fi")', { timeout: 5000 });
    if (await page.$('.fincalendar input[aria-label="Calendar link"]')) throw new Error('a link with nowhere to serve it');
  } },
  { name: 'The phone: no calendar link to make', screen: 'finances', phone: ['companion', 'finances'], run: async (page) => {
    await finTab(page, 'Pay', { timeout: 5000 });
    await page.waitForSelector('.finreminders', { timeout: 5000 });
    if (await page.$('.fincalendar')) throw new Error('the phone offers a calendar link');
  } },
  // Money flow on Recurring: a typical month, each person's pay before taxes (Alex's $3,050 every other week is $6,608.33 a
  // month; $599 of each is taxes, $1,297.83 a month) into all of it, out to taxes, each kind of bill, and saving, which goes
  // into the 401(k), the Roth IRA, and savings, the rest kept as cash ($1,110.24, what was left over before). A band for each
  // way money goes; a box a button for each.
  { name: 'Finances: money flow, pay to bills, saving, and what is left', screen: 'finances', run: async (page) => {
    await finTab(page, 'Recurring', { timeout: 5000 });
    await page.waitForSelector('.fx-moneyflow .fx-sankey svg', { timeout: 5000 });
    const rows = await page.$$eval('.fx-moneyflow .sr table tbody tr', (rs) => rs.map((r) => [...r.cells].map((c) => c.textContent).join('|')));
    for (const want of ["Alex's pay|Total income|$6,608.33", "Jordan's pay|Total income|$2,400.00", 'Total income|Taxes|$1,297.83', 'Expenses|Taken from pay|$255.67', 'Savings|Fidelity 401(k)|$396.50', 'Savings|Kept as cash|$1,110.24']) {
      if (!rows.includes(want)) throw new Error(`no ${want} in ${rows.join(' / ')}`);
    }
    if (rows.some((r) => r.startsWith('From your accounts'))) throw new Error('a month with more in than out takes from the accounts');
    const bands = await page.$$eval('.fx-moneyflow path.fx-sband', (ps) => ps.length);
    const boxes = await page.$$eval('.fx-moneyflow button.fx-snode', (bs) => bs.length);
    if (bands !== rows.length || boxes !== rows.length + 1) throw new Error(`${bands} bands and ${boxes} boxes for ${rows.length} rows`);
    if (!(await page.textContent('.fx-flowstrip')).replace(/\s+/g, '').includes('Saved$2,190.0724%savingsrate')) throw new Error('the strip: ' + await page.textContent('.fx-flowstrip'));
    await page.click('.fx-moneyflow button.fx-snode:has-text("Kept as cash")');
    await page.waitForSelector('.fx-flowpick p:has-text("stayed where it came in")', { timeout: 5000 });
  } },
  // Money flow on the Dashboard: this month from the ledger (Jordan's paycheck in; Costco and Trader Joe's are Food, Shell is
  // Car; the Roth IRA's transfer is saved). Picking a box lists what is behind it, each opening its transaction; ‹ goes to a
  // typical month from the plan, where Top 5 makes the rest Other; the keyboard picks a box too.
  { name: 'Finances: the money flow opens what is behind each box, month by month', screen: 'finances', run: async (page) => {
    await page.waitForSelector('#finances.active .fx-moneyflow .fx-periodname:text-is("Oct 2026")', { timeout: 5000 });
    const rows = await page.$$eval('.fx-moneyflow .sr table tbody tr', (rs) => rs.map((r) => [...r.cells].map((c) => c.textContent).join('|')));
    for (const want of ["Jordan's paycheck|Total income|$2,400.00", 'Expenses|Food|$149.85', 'Expenses|Car|$48.20', 'Savings|Roth IRA|$250.00']) {
      if (!rows.includes(want)) throw new Error(`no ${want} in ${rows.join(' / ')}`);
    }
    await page.click('.fx-moneyflow button.fx-snode:has-text("Food")');
    await page.waitForSelector('.fx-flowpick h3:has-text("Food")', { timeout: 5000 });
    const items = await page.$$eval('.fx-flowpick li', (ls) => ls.map((l) => l.textContent));
    if (items.length !== 2 || !items[0].includes('Costco') || !items[0].includes('−$86.10') || !items[1].includes("Trader Joe's")) throw new Error(`food: ${items.join(' | ')}`);
    await page.click('.fx-flowpick li:has-text("Costco") button');
    await page.waitForSelector('#finSheet:not([hidden]) h2:has-text("Costco")', { timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    await page.click('.fx-moneyflow button[aria-label="The month before"]');
    await page.waitForSelector('.fx-moneyflow .fx-periodname:text-is("A typical month")', { timeout: 5000 });
    if (await page.$('.fx-flowpick')) throw new Error('the box picked in October stays picked in another month');
    await page.selectOption('.fx-moneyflow select.fx-top', '5');
    await page.waitForSelector('.fx-moneyflow button.fx-snode:has-text("Other (3)")', { timeout: 5000 });
    await page.focus('.fx-moneyflow button.fx-snode:has-text("Taxes")');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.fx-flowpick li:has-text("Alex\'s taxes")', { timeout: 5000 });
    if ((await page.getAttribute('.fx-moneyflow button.fx-snode:has-text("Taxes")', 'aria-pressed')) !== 'true') throw new Error('the box picked does not say so');
  } },
  { name: 'The phone, view only: the money flow opens, with nothing to change', screen: 'finances', phone: ['companion', 'finances'], mock: { finances: { ...finances, readOnly: true } }, run: async (page) => {
    await page.waitForSelector('.fx-moneyflow .fx-sankey svg', { timeout: 5000 });
    await page.click('.fx-moneyflow button.fx-snode:has-text("Food")');
    await page.waitForSelector('.fx-flowpick li:has-text("Costco")', { timeout: 5000 });
    if (await page.$('.fx-flowpick li button')) throw new Error('a phone that may only look can open a transaction');
  } },
  // A month that takes more than comes in: the rest comes out of the accounts, and nothing is left over.
  { name: 'Finances: money flow when a month takes more than comes in', screen: 'finances', mock: { finances: { ...finances, plan: { ...finances.plan, payments: [...finances.plan.payments, { id: 'rent', name: 'Rent', amount: 5000, kind: 'home', schedule: { every: 'month', start: '2026-01-01' } }] } } }, run: async (page) => {
    await finTab(page, 'Recurring', { timeout: 5000 });
    // Out: taxes, bills with rent, and $1,079.83 into savings accounts; in: $9,008.33; from the accounts, $3,889.76.
    await page.waitForSelector('.fx-moneyflow .sr table tbody tr:has-text("From your accounts"):has-text("$3,889.76")', { state: 'attached', timeout: 5000 });
    if ((await page.textContent('.fx-moneyflow .sr table')).includes('Kept as cash')) throw new Error('kept as cash with more out than in');
    if (!(await page.textContent('.fx-flowstrip')).includes('Short')) throw new Error('the strip does not say it is short');
  } },
  // Pay more: an extra amount a paycheck on the loan picked, and every debt (a card carrying a balance too) paid down two ways.
  { name: 'Finances: pay more on a loan, highest rate or smallest balance first', screen: 'finances', mock: { finances: { ...finances, loans: ratedLoans } }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await page.waitForSelector('.fx-loans h2:text-is("Loans and cards carrying a balance")', { timeout: 5000 });
    await page.waitForSelector('.fx-paymore [role=status]:has-text("Nothing is saved")', { timeout: 5000 });
    // Nothing typed, no figure a month: not "about $0.00 a month".
    if (/about/.test(await page.textContent('.fx-paymore label'))) throw new Error(`with nothing typed: ${await page.textContent('.fx-paymore label')}`);
    await page.fill('.fx-paymore input[aria-label="More a paycheck"]', '100');
    await page.waitForSelector('.fx-paymore label:has-text("(about $306.96 a month)")', { timeout: 5000 });
    await page.waitForSelector('.fx-paymore [role=status]:text-is("Mortgage paid off Nov 2045, 93 months sooner, $99,595.13 less interest.")', { timeout: 5000 });
    const ways = await page.$$eval('.fx-ways li', (ls) => ls.map((l) => l.textContent.replace(/\s+/g, ' ').trim()));
    if (ways[0] !== 'Highest rate first: all paid off May 2041, $156,764.05 interest. In turn: Chase Freedom Feb 2027, Toyota Financial Mar 2029, Mortgage May 2041.'
      || ways[1] !== 'Smallest balance first: all paid off May 2041, $156,920.90 interest. In turn: Chase Freedom Feb 2027, Toyota Financial Mar 2028, Mortgage May 2041.') throw new Error(`the two ways: ${JSON.stringify(ways)}`);
    if (await page.evaluate(() => window.__MOCK.financesSaved?.length)) throw new Error('Pay more saved something');
  } },
  { name: 'The phone, view only: loans shown, nothing to type in', screen: 'finances', phone: ['companion', 'finances'], mock: { finances: { ...finances, readOnly: true } }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await page.waitForSelector('.fx-loans li:has-text("Mortgage")', { timeout: 5000 });
    if (await page.$('.fx-paymore, .fx-loans li button')) throw new Error('a phone allowed only to look can type into or open a loan');
  } },
  // Goals on Net worth: each with what is left, what it needs a month and a paycheck by its day, and its pace (amber when that is late).
  { name: 'Finances: goals say what is left, what they need, and their pace', screen: 'finances', run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    // What it needs (a paycheck first) under its name; under its bar, what is saved and the pace lately.
    await page.waitForSelector('.fx-goals li:has-text("Emergency fund"):has-text("$5,500.00 left"):has-text("$90.16 a paycheck ($274.91 a month) to be there by Jun 30, 2028")', { timeout: 5000 });
    const saved = (await page.textContent('.fx-goals li:has-text("Emergency fund") .fx-goalsaved', { timeout: 5000 })).replace(/\s+/g, ' ').trim();
    if (saved !== '$6,500.00 of $12,000.00 · $889.78 a month lately: there by May 2027') throw new Error(`under the bar: ${saved}`);
    await page.waitForSelector('.fx-goals li:has-text("Japan trip") .fx-warn:has-text("there by Oct 2031")', { timeout: 5000 });
    await page.waitForSelector('.fx-goals li:has-text("Japan trip") .fx-budgetbar.warn', { timeout: 5000 });
    if (await page.$('.fx-goals li:has-text("Emergency fund") .fx-warn')) throw new Error('a goal on pace is marked behind');
  } },
  // The goals together need more a month than the plan puts by: said over them. What if: another amount a paycheck, or another day.
  { name: 'Finances: goals that need more than is put by, and what if', screen: 'finances', run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await page.waitForSelector('.fx-goals .fx-goalsshort:has-text("Together the goals need $1,060.78 a month to be there in time"):has-text("short")', { timeout: 5000 });
    await page.selectOption('.fx-whatif select[aria-label="Which goal"]', 'japan');
    await page.waitForSelector('.fx-whatif [role=status]:has-text("Nothing is saved")', { timeout: 5000 });
    await page.fill('.fx-whatif input[aria-label="Put by a paycheck"]', '300');
    await page.waitForSelector('.fx-whatif [role=status]:has-text("At $300.00 a paycheck (about $920.87 a month), Japan trip gets there by Mar 2027, 1 month before its day.")', { timeout: 5000 });
    await page.fill('.fx-whatif input[aria-label="Put by a paycheck"]', '');
    await page.fill('.fx-whatif input[aria-label="Want it by"]', '2027-01-31');
    await page.waitForSelector('.fx-whatif [role=status]:has-text("By Jan 31, 2027, it needs $438.89 a paycheck (9 paychecks).")', { timeout: 5000 });
    if (await page.evaluate(() => window.__MOCK.financesSaved?.length)) throw new Error('What if saved something');
  } },
  { name: 'Finances: goals put by in time say nothing over them', screen: 'finances', mock: { finances: { ...finances, goals: finances.goals.map((g) => ({ ...g, needsMonth: 100 })) } }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await page.waitForSelector('.fx-goals li:has-text("Emergency fund")', { timeout: 5000 });
    if (await page.$('.fx-goalsshort')) throw new Error('goals needing $200 a month said to be short');
  } },
  // A goal added from shares of accounts: what other goals take of one is said, and more than the rest is refused.
  { name: 'Finances: a goal added, and one deleted', screen: 'finances', run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await page.click('.fx-goals button:text-is("Add a goal")');
    await page.waitForSelector('#finSheet h2:text-is("Add a goal")', { timeout: 5000 });
    await page.fill('#finSheet label:has-text("Name") input', 'New car');
    await page.fill('#finSheet label:has-text("How much it needs") input', '8000');
    await page.waitForSelector('#finSheet .goalshares li:has-text("Robinhood") small:text-is("25% for other goals")', { timeout: 5000 });
    if (await page.$('#finSheet .goalshares li:has-text("Chase Freedom")')) throw new Error('a card is offered to a goal');
    await page.click('#finSheet .goalshares li:has-text("Robinhood") input[type=checkbox]');
    if ((await page.inputValue('#finSheet input[aria-label="Share of Robinhood, %"]')) !== '75') throw new Error('the share does not start at what is left of it');
    await page.fill('#finSheet input[aria-label="Share of Robinhood, %"]', '80');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet .formerr:has-text("Robinhood: the other goals have 25% of it, so this one can have 75% at most.")', { timeout: 5000 });
    await page.fill('#finSheet input[aria-label="Share of Robinhood, %"]', '75');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    let plan = await page.evaluate(() => window.__MOCK.financesSaved.at(-1));
    const car = plan.goals.find((g) => g.name === 'New car');
    if (plan.goals.length !== 3 || car.target !== 8000 || car.date || JSON.stringify(car.shares) !== JSON.stringify([{ account: 'brk', percent: 75 }])) throw new Error(`saved ${JSON.stringify(plan.goals)}`);
    await page.click('.fx-goals li:has-text("Japan trip") button');
    await page.waitForSelector('#finSheet h2:text-is("Japan trip")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Delete")');
    await page.click('#finSheet button:text-is("Click again to delete")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    plan = await page.evaluate(() => window.__MOCK.financesSaved.at(-1));
    if (plan.goals.some((g) => g.id === 'japan')) throw new Error('the trip was not deleted');
  } },
  { name: 'The phone, view only: goals shown, none added or opened', screen: 'finances', phone: ['companion', 'finances'], mock: { finances: { ...finances, readOnly: true } }, run: async (page) => {
    // The Dashboard's goals: none opened, only See all.
    await page.waitForSelector('.fx-board > .fx-goals li:has-text("Emergency fund")', { timeout: 5000 });
    if (await page.$('.fx-goals li button, .fx-goals input, .fx-goals select')) throw new Error('a phone allowed only to look can open or type into a goal on the Dashboard');
    await finTab(page, 'Net worth', { timeout: 5000 });
    await page.waitForSelector('.fx-goals li:has-text("Emergency fund")', { timeout: 5000 });
    if (await page.$('.fx-goals button, .fx-goals input, .fx-goals select')) throw new Error('a phone allowed only to look can add, open, or type into a goal');
  } },
  // From Firefly III: each account found by its name fills its box (the difference shown), one not matched said; then saved.
  { name: 'Finances: balances read from Firefly III into Update balances', screen: 'finances', mock: { status: runningToo('firefly-iii'), firefly: [{ name: 'Chase Checking', balance: 2600, currency: 'USD' }, { name: 'BofA Savings', balance: 6550, currency: 'USD' }, { name: 'Ally Savings', balance: 100, currency: 'USD' }] }, run: async (page) => {
    await page.click('#finRoot .toolbar button:text-is("Update balances")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("From Firefly III")');
    await page.waitForSelector('#finSheet .fromapp [role=status]:text-is("Filled from Firefly III: Chase Checking, BofA Savings. Not matched: Ally Savings. Check them, then Save.")', { timeout: 5000 });
    if ((await page.inputValue('#bal-chk')) !== '2600' || (await page.inputValue('#bal-sav')) !== '6550') throw new Error('the boxes were not filled');
    await page.waitForSelector('#finSheet li:has(#bal-chk) small:has-text("+$87.60")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const plan = await page.evaluate(() => window.__MOCK.financesSaved.at(-1));
    if (plan.accounts.find((a) => a.id === 'chk').balance !== 2600 || plan.accounts.find((a) => a.id === 'sav').balance !== 6550) throw new Error('not saved');
  } },
  { name: 'Finances: Firefly III not read says why', screen: 'finances', mock: { status: runningToo('firefly-iii'), fireflyProblem: "Firefly III's token is not set: make one in Firefly III (Profile › OAuth › Personal access tokens) and put it in Settings › FIREFLY_IMPORTER_TOKEN" }, run: async (page) => {
    await page.click('#finRoot .toolbar button:text-is("Update balances")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("From Firefly III")');
    await page.waitForSelector('#finSheet .fromapp .formerr:has-text("token is not set")', { timeout: 5000 });
  } },
  // From Wallos, on Recurring while Wallos runs: those not in the plan to add (each, or all), with their logos and types;
  // one in the plan already (by its brand), one on a rhythm Finances doesn't keep, and one turned off, each named, not added.
  { name: 'Finances: subscriptions brought in from Wallos', screen: 'finances', mock: { status: withWallos, wallos: wallosSubs }, run: async (page) => {
    await finTab(page, 'Recurring', { timeout: 5000 });
    await page.click('.fx-wallos button:text-is("From Wallos")', { timeout: 5000 });
    await page.waitForSelector('.fx-wallos [role=status]:text-is("2 subscriptions not in the plan yet.")', { timeout: 5000 });
    const rows = await page.$$eval('.fx-wallos li', (ls) => ls.map((l) => [l.querySelector('.grow > strong').textContent, l.querySelector('.grow > small, .grow > .muted, .grow > span')?.textContent || '']));
    if (rows.map((r) => r[0]).join() !== 'Proton Mail,YouTube Premium') throw new Error(`offered ${JSON.stringify(rows)}`);
    await page.waitForSelector('.fx-wallos li:has-text("Proton Mail"):has-text("$9.99 a month · next Nov 20 · Software and apps")', { timeout: 5000 });
    await page.waitForSelector('.fx-wallos li:has-text("YouTube Premium") .fmark:not(.auto)', { timeout: 5000 });
    await page.waitForSelector('.fx-wallos .fx-wallosnote:text-is("In the plan already: Netflix Premium.")', { timeout: 5000 });
    await page.waitForSelector('.fx-wallos .fx-wallosnote:text-is("On a rhythm Finances doesn\'t keep, so add them by hand: Home insurance (every 6 months).")', { timeout: 5000 });
    await page.waitForSelector('.fx-wallos .fx-wallosnote:text-is("Turned off in Wallos, so left out: Hulu.")', { timeout: 5000 });
    await page.click('.fx-wallos li:has-text("Proton Mail") button:text-is("Add")');
    await page.waitForFunction(() => window.__MOCK.financesSaved?.length === 1, null, { timeout: 5000 });
    const plan = await page.evaluate(() => window.__MOCK.financesSaved.at(-1));
    const x = plan.payments.at(-1);
    if (x.name !== 'Proton Mail' || x.amount !== 9.99 || x.kind !== 'subscriptions' || x.institution !== 'proton' || x.type !== 'software' || x.schedule.every !== 'month' || x.schedule.start !== '2026-11-20' || x.id) throw new Error(`added ${JSON.stringify(x)}`);
    if (plan.payments.length !== 19) throw new Error(`${plan.payments.length} payments`);
    // Now in the plan: named with Netflix, and only YouTube Premium is left to add, on its own (no Add all).
    await page.waitForSelector('.fx-wallos .fx-wallosnote:text-is("In the plan already: Netflix Premium, Proton Mail.")', { timeout: 5000 });
    await page.waitForSelector('.fx-wallos [role=status]:text-is("1 subscription not in the plan yet.")', { timeout: 5000 });
    if (await page.$('.fx-wallos .fx-wallosall')) throw new Error('Add all for one');
  } },
  { name: 'Finances: Add all from Wallos adds every one not in the plan', screen: 'finances', mock: { status: withWallos, wallos: wallosSubs }, run: async (page) => {
    await finTab(page, 'Recurring', { timeout: 5000 });
    await page.click('.fx-wallos button:text-is("From Wallos")', { timeout: 5000 });
    await page.click('.fx-wallos button:text-is("Add all 2")', { timeout: 5000 });
    await page.waitForFunction(() => window.__MOCK.financesSaved?.length === 1, null, { timeout: 5000 });
    const plan = await page.evaluate(() => window.__MOCK.financesSaved.at(-1));
    const added = plan.payments.slice(-2).map((x) => `${x.name}/${x.institution}/${x.type}/${x.schedule.every}`);
    if (added.join() !== 'Proton Mail/proton/software/month,YouTube Premium/youtube/streaming/year') throw new Error(`added ${added}`);
    await page.waitForSelector('.fx-wallos [role=status]:text-is("Nothing in Wallos to add.")', { timeout: 5000 });
  } },
  { name: 'Finances: Wallos not read says why', screen: 'finances', mock: { status: withWallos, wallosProblem: "Wallos's API key is not set: copy it from Wallos (Profile › API Key) and put it in Settings › WALLOS_API_KEY" }, run: async (page) => {
    await finTab(page, 'Recurring', { timeout: 5000 });
    await page.click('.fx-wallos button:text-is("From Wallos")', { timeout: 5000 });
    await page.waitForSelector('.fx-wallos .formerr:has-text("API key is not set")', { timeout: 5000 });
  } },
  { name: 'Finances: no From Wallos while Wallos is not running, nor on a phone', screen: 'finances', run: async (page) => {
    await finTab(page, 'Recurring', { timeout: 5000 });
    await page.waitForSelector('.fx-homelab', { timeout: 5000 });
    if (await page.$('.fx-wallos')) throw new Error('From Wallos with Wallos not running');
  } },
  { name: 'The phone: no From Wallos', screen: 'finances', phone: ['companion', 'finances'], mock: { status: withWallos, wallos: wallosSubs }, run: async (page) => {
    await finTab(page, 'Recurring', { timeout: 5000 });
    await page.waitForSelector('.fx-homelab', { timeout: 5000 });
    if (await page.$('.fx-wallos')) throw new Error('From Wallos on a phone');
  } },
  // From Ghostfolio: each account's worth (cash and holdings) fills the box of the account with its name and currency;
  // one in another currency, or with no account of its name, said not matched; then saved.
  { name: 'Finances: balances read from Ghostfolio into Update balances', screen: 'finances', mock: { status: runningToo('ghostfolio'), ghostfolio: [{ name: 'Robinhood', balance: 8420.5, currency: 'USD' }, { name: 'Fidelity 401(k)', balance: 39120, currency: 'USD' }, { name: 'Trading 212', balance: 2100, currency: 'EUR' }] }, run: async (page) => {
    await page.click('#finRoot .toolbar button:text-is("Update balances")', { timeout: 5000 });
    if (await page.$('#finSheet button:text-is("From Firefly III")')) throw new Error('From Firefly III with Firefly III not running');
    await page.click('#finSheet button:text-is("From Ghostfolio")');
    await page.waitForSelector('#finSheet .fromapp [role=status]:text-is("Filled from Ghostfolio: Robinhood, Fidelity 401(k). Not matched: Trading 212. Check them, then Save.")', { timeout: 5000 });
    if ((await page.inputValue('#bal-brk')) !== '8420.50' || (await page.inputValue('#bal-k401')) !== '39120' || (await page.inputValue('#bal-chk')) !== '2512.40') throw new Error('the boxes were not filled as read');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const plan = await page.evaluate(() => window.__MOCK.financesSaved.at(-1));
    if (plan.accounts.find((a) => a.id === 'brk').balance !== 8420.5 || plan.accounts.find((a) => a.id === 'k401').balance !== 39120) throw new Error('not saved');
  } },
  { name: 'Finances: Ghostfolio not read says why', screen: 'finances', mock: { status: runningToo('ghostfolio'), ghostfolioProblem: "Ghostfolio refused the security token: put the one you sign in with in Settings › GHOSTFOLIO_SECURITY_TOKEN" }, run: async (page) => {
    await page.click('#finRoot .toolbar button:text-is("Update balances")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("From Ghostfolio")');
    await page.waitForSelector('#finSheet .fromapp .formerr:has-text("refused the security token")', { timeout: 5000 });
  } },
  // Net worth › Investments: what Ghostfolio last read, kept in the plan, shown with Ghostfolio stopped: four figures, the
  // split by account, a row a holding (the 401(k)'s cash a row of its own); a holding opens its worth at each read.
  { name: 'Finances: Investments on Net worth, from what was last read', screen: 'finances', run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    const card = '#finRoot .fx-invest';
    await page.waitForSelector(`${card} h2:has-text("from Ghostfolio, read 7:02 AM")`, { timeout: 5000 });
    for (const t of ['Total value', 'You paid', 'Gain', 'This month']) await page.waitForSelector(`${card} .fx-investfigs .fx-caption:text-is("${t}")`, { timeout: 2000 });
    await page.waitForSelector(`${card} .fx-investfigs .fx-sub:text-is("9 holdings in 3 accounts")`, { timeout: 2000 });
    if ((await page.$$(`${card} tbody.fx-hold`)).length !== 10) throw new Error('not a row a holding and the cash');
    await page.waitForSelector(`${card} tbody.fx-hold:has(strong:text-is("Cash")):has-text("Fidelity 401(k)")`, { timeout: 2000 });
    if (await page.$(`${card} .fx-investsaid`)) throw new Error('a read said with nothing read');
    const vti = `${card} button.fx-holdbtn:has(strong:text-is("VTI"))`;
    await page.click(vti);
    await page.waitForSelector(`${card} .fx-holddetail figure[aria-label^="VTI at each read"] svg`, { timeout: 2000 });
    if ((await page.getAttribute(vti, 'aria-expanded')) !== 'true') throw new Error('VTI not said open');
    await page.waitForSelector(`${card} .fx-holddetail :text("A share is worth")`, { timeout: 2000 });
    await page.click(vti);
    await page.waitForSelector(`${card} .fx-holddetail`, { state: 'detached', timeout: 2000 });
    if (await page.$(`${card} .fx-investleft`)) throw new Error('accounts to match with none left');
    // Add a holding is there whether or not Status reports Ghostfolio running: it may not see the one that answers.
    await page.waitForSelector(`${card} button:text-is("Add a holding")`, { timeout: 2000 });
  } },
  // The owner, Nov 12: no bar of what each account holds ("I like the look when they're all separated out"); a
  // traditional list: each holding's price and its trend over the year beside its worth and gain, and the total's
  // worth over time on top.
  { name: 'Finances: Investments list each holding with its price and trend, and no share bar', screen: 'finances', run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    const card = '#finRoot .fx-invest';
    await page.waitForSelector(`${card} tbody.fx-hold`, { timeout: 5000 });
    if (await page.locator(`${card} .fx-splitbar, ${card} [aria-label*="What each account holds"]`).count()) throw new Error('the share bar is still there');
    const head = await page.locator(`${card} .fx-holdings thead th`).allTextContents();
    if (!head.includes('Price') || !head.includes('Year')) throw new Error(`columns: ${head.join(' | ')}`);
    const vti = page.locator(`${card} tbody.fx-hold:has(strong:text-is("VTI"))`);
    const price = await vti.locator('.fx-holdprice').textContent();
    if (price.replace(/\s/g, '') !== '$285.93') throw new Error(`VTI's price: ${price} (26,420 for 92.4 shares)`);
    if (!(await vti.locator('.fx-holdtrend svg').count())) throw new Error('no trend for VTI');
    if (!(await page.locator(`${card} figure.fx-area[aria-label*="Investments"]`).count())) throw new Error("no chart of the investments' worth");
  } },
  // The Watchlist (the owner, Nov 12): tickers followed without owning them, priced at each read, never in the worth.
  // Follow a ticker looks one up and follows it; Unfollow takes it off; one Ghostfolio has no price for says so.
  { name: 'Finances: the Watchlist follows a ticker, says its change since, and unfollows', screen: 'finances', mock: { status: runningToo('ghostfolio'), quotes: { VOO: 556.25 },
    finances: { ...finances, plan: { ...finances.plan, watch: [{ symbol: 'GLBX', name: 'Globex Energy', dataSource: 'YAHOO', currency: 'USD', since: '2026-10-02', from: 45.4, price: 48.12, history: [{ date: '2026-10-02', amount: 45.4 }, { date: '2026-10-20', amount: 46.9 }, { date: '2026-10-30', amount: 48.12 }] }] } } }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    const watch = page.locator('#finRoot .fx-invest .fx-watch');
    const glbx = watch.locator('li:has(strong:text-is("GLBX"))');
    await glbx.waitFor({ timeout: 5000 });
    const said = await glbx.textContent();
    for (const w of ['$48.12', '+6.0% since Oct 2', 'Globex Energy']) if (!said.includes(w)) throw new Error(`GLBX: ${said}`);
    if (!(await glbx.locator('.spark').count())) throw new Error('no line for GLBX');
    const before = await page.textContent('#finRoot .fx-investfigs');
    await watch.locator('button:text-is("Follow a ticker")').click();
    await watch.locator('input').fill('VOO');
    await watch.locator('button:text-is("Look it up")').click();
    await watch.locator('.fx-watchadd li:has(strong:text-is("VOO")) button:text-is("Follow")').click();
    await watch.locator('li:has(strong:text-is("VOO")):has-text("$556.25")').waitFor({ timeout: 5000 });
    if ((await page.textContent('#finRoot .fx-investfigs')) !== before) throw new Error('a followed ticker changed the worth');
    // One Ghostfolio can't price is said, and nothing is added.
    await watch.locator('button:text-is("Follow a ticker")').click();
    await watch.locator('input').fill('AAPL');
    await watch.locator('button:text-is("Look it up")').click();
    await watch.locator('.fx-watchadd li:has(strong:text-is("AAPL")) button:text-is("Follow")').click();
    await watch.locator('[role="alert"]:has-text("no price for AAPL")').waitFor({ timeout: 5000 });
    await glbx.locator('button:text-is("Unfollow")').click();
    await watch.locator('li:has(strong:text-is("GLBX"))').waitFor({ state: 'detached', timeout: 5000 });
  } },
  { name: 'The phone, view only: the Watchlist shows, with nothing to follow or unfollow', screen: 'finances', phone: ['companion', 'finances'], mock: { finances: { ...finances, readOnly: true, plan: { ...finances.plan, watch: [{ symbol: 'GLBX', name: 'Globex Energy', since: '2026-10-02', from: 45.4, price: 48.12, history: [] }] } } }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    const watch = page.locator('#finRoot .fx-invest .fx-watch');
    await watch.locator('li:has(strong:text-is("GLBX"))').waitFor({ timeout: 5000 });
    if (await watch.locator('button').count()) throw new Error('a view-only phone can follow or unfollow');
  } },
  // After the first read, Finances reads Ghostfolio once as it opens, the last read being from another day; not again on
  // coming back. Read now reads it again and says when; an account Ghostfolio has that nothing matched is matched by hand
  // (here, as a new account), kept, and read again.
  { name: 'Finances: Investments read once as Finances opens, Read now, and a match by hand', screen: 'finances', mock: { status: runningToo('ghostfolio'), investUnmatched: ['Coinbase'] }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    const card = '#finRoot .fx-invest';
    await page.waitForSelector(`${card} [role=status]:has-text("Read from Ghostfolio at")`, { timeout: 5000 });
    await page.waitForSelector(`${card} [role=status]:has-text(": 9 holdings in 3 accounts.")`, { timeout: 2000 });
    if ((await page.evaluate(() => window.__MOCK.investReads)) !== 1) throw new Error('not read once on opening');
    await finTab(page, 'Dashboard');
    await finTab(page, 'Net worth');
    await page.waitForTimeout(300);
    if ((await page.evaluate(() => window.__MOCK.investReads)) !== 1) throw new Error('read again on coming back');
    await page.click(`${card} button:text-is("Read now")`);
    await page.waitForFunction(() => window.__MOCK.investReads === 2, null, { timeout: 5000 });
    await page.waitForSelector(`${card} h2:has-text("from Ghostfolio, read")`, { timeout: 2000 });
    await page.selectOption(`${card} .fx-investleft select`, 'new');
    await page.waitForFunction(() => window.__MOCK.investReads === 3, null, { timeout: 5000 });
    const plan = await page.evaluate(() => window.__MOCK.financesSaved.at(-1));
    const added = plan.accounts.find((a) => a.ghostfolio === 'Coinbase');
    if (!added || added.name !== 'Coinbase' || added.kind !== 'investment') throw new Error('Coinbase not added as an account matched by hand');
  } },
  { name: 'Finances: Investments say why Ghostfolio could not be read', screen: 'finances', mock: { status: runningToo('ghostfolio'), finances: { ...finances, plan: { ...finances.plan, readByHand: true } }, investProblem: 'Ghostfolio does not answer on this machine: is it running? (Status)' }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    const card = '#finRoot .fx-invest';
    await page.click(`${card} button:text-is("Read now")`, { timeout: 5000 });
    await page.waitForSelector(`${card} .formerr[role=alert]:text-is("Could not read Ghostfolio: Ghostfolio does not answer on this machine: is it running? (Status)")`, { timeout: 5000 });
    // What was last read is still shown.
    if ((await page.$$(`${card} tbody.fx-hold`)).length !== 10) throw new Error('the holdings went with the failed read');
  } },
  // Read only on Read now, when so set: opening Finances reads nothing; the box turns the morning's read back on.
  { name: 'Finances: Investments read only on Read now, when so set', screen: 'finances', mock: { status: runningToo('ghostfolio'), finances: { ...finances, plan: { ...finances.plan, readByHand: true } } }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    const box = '#finRoot .fx-invest .fx-investauto input[type=checkbox]';
    await page.waitForSelector(box, { timeout: 5000 });
    await page.waitForTimeout(300);
    if (await page.evaluate(() => window.__MOCK.investReads)) throw new Error('read on opening, set to read by hand');
    if (await page.isChecked(box)) throw new Error('the box says it reads each day');
    await page.click(box);
    await page.waitForFunction(() => window.__MOCK.financesSaved?.length, null, { timeout: 5000 });
    if (await page.evaluate(() => window.__MOCK.financesSaved.at(-1).readByHand)) throw new Error('still read by hand');
  } },
  // Never read: with Ghostfolio running, the card says what it would read and that only symbols leave the homelab.
  { name: 'Finances: Investments never read offer a first read', screen: 'finances', mock: { status: runningToo('ghostfolio'), finances: { ...finances, plan: { ...finances.plan, holdingsRead: undefined, accounts: finances.plan.accounts.map(({ holdings, ...a }) => a) } } }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    const card = '#finRoot .fx-invest';
    await page.waitForSelector(`${card} .fx-investintro:has-text("Only ticker symbols leave the homelab")`, { timeout: 5000 });
    await page.waitForSelector(`${card} button:text-is("Read now")`, { timeout: 2000 });
    if (await page.evaluate(() => window.__MOCK.investReads)) throw new Error('read before the first Read now');
  } },
  // A first read of a Ghostfolio with nothing in it yet still says the token worked, and what to add there.
  { name: 'Finances: Investments say the token worked when Ghostfolio is still empty', screen: 'finances', mock: { status: runningToo('ghostfolio'), finances: { ...finances, plan: { ...finances.plan, holdingsRead: undefined, accounts: finances.plan.accounts.map(({ holdings, ...a }) => a) } }, investAccounts: 0, investHoldings: 0 }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    const card = '#finRoot .fx-invest';
    await page.click(`${card} button:text-is("Read now")`, { timeout: 5000 });
    await page.waitForSelector(`${card} [role=status]:has-text("Signed in to Ghostfolio at")`, { timeout: 5000 });
    await page.waitForSelector(`${card} [role=status]:has-text("it has no accounts yet. Add yours there, named as they are here, then Read now.")`, { timeout: 2000 });
    if (await page.$(`${card} .fx-investintro`)) throw new Error('"nothing matched" said beside the read');
    await page.evaluate(() => { window.__MOCK.investAccounts = 2; });
    await page.click(`${card} button:text-is("Read now")`);
    await page.waitForSelector(`${card} [role=status]:has-text("its 2 accounts hold nothing yet. Add a buy for each holding there, then Read now.")`, { timeout: 5000 });
  } },
  // Add a holding: a buy typed on the card, the ticker picked from what Ghostfolio finds, put into Ghostfolio, then read back.
  { name: 'Finances: Investments add a buy to Ghostfolio from the card', screen: 'finances', mock: { status: runningToo('ghostfolio'), finances: { ...finances, plan: { ...finances.plan, readByHand: true } } }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    const card = '#finRoot .fx-invest';
    await page.click(`${card} button:text-is("Add a holding")`, { timeout: 5000 });
    const form = `${card} form.fx-investadd`;
    await page.waitForSelector(`${form} h3:text-is("Add a holding")`, { timeout: 2000 });
    // Nothing picked yet: said, and Ghostfolio is not asked.
    await page.click(`${form} button:text-is("Add to Ghostfolio")`);
    await page.waitForSelector(`${form} .formerr:text-is("Type a ticker or a name, then pick it from the list.")`, { timeout: 2000 });
    await page.selectOption(`${form} select`, 'k401');
    await page.fill(`${form} input[placeholder^="A ticker"]`, 'vti');
    await page.click(`${form} button.fx-symbol:has(strong:text-is("VTI"))`, { timeout: 3000 });
    await page.waitForSelector(`${form} .fx-symbolpicked:has-text("Vanguard Total Stock Market")`, { timeout: 2000 });
    if ((await page.inputValue(`${form} input[placeholder^="A ticker"]`)) !== 'VTI') throw new Error('the box does not say what was picked');
    await page.fill(`${form} input[placeholder="10"]`, '0');
    await page.fill(`${form} .moneyfield input`, '2000');
    await page.click(`${form} button:text-is("Add to Ghostfolio")`);
    await page.waitForSelector(`${form} .formerr:text-is("How many shares: more than 0.")`, { timeout: 2000 });
    if (await page.evaluate(() => window.__MOCK.investAdded)) throw new Error('Ghostfolio asked with 0 shares');
    // A part of a share: 11.038 is eleven and a bit, not eleven thousand; what a share comes to is said before it goes.
    await page.fill(`${form} input[placeholder="10"]`, '11.038');
    await page.fill(`${form} .moneyfield input`, '6653.35');
    await page.waitForSelector(`${form} .fx-eachshare:text-is("11.038 shares at $602.77 each.")`, { timeout: 2000 });
    await page.click(`${form} button:text-is("Add to Ghostfolio")`);
    await page.waitForSelector(form, { state: 'detached', timeout: 5000 });
    await page.waitForSelector(`${card} [role=status]:has-text("Added to Ghostfolio: bought 11.038 VTI. Read again at")`, { timeout: 2000 });
    const x = await page.evaluate(() => window.__MOCK.investAdded[0]);
    if (x.account !== 'k401' || x.symbol !== 'VTI' || x.dataSource !== 'YAHOO' || x.currency !== 'USD' || x.shares !== 11.038 || x.total !== 6653.35 || x.sold || x.newName || !/^\d{4}-\d\d-\d\d$/.test(x.date)) throw new Error(`sent ${JSON.stringify(x)}`);
  } },
  // A holding Ghostfolio has no prices for yet: worth today's price it looked up, and said so in its details; one with prices says nothing.
  { name: 'Finances: Investments say a worth is today\'s price while Ghostfolio has none of its own', screen: 'finances', mock: { finances: { ...finances, plan: { ...finances.plan, accounts: finances.plan.accounts.map((a) => (a.id === 'roth' ? { ...a, holdings: a.holdings.map((h) => (h.symbol === 'VOO' ? { ...h, quoted: true } : h)) } : a)) } } }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    const card = '#finRoot .fx-invest';
    await page.click(`${card} tbody.fx-hold:has(strong:text-is("VOO")) button.fx-holdbtn`, { timeout: 5000 });
    await page.waitForSelector(`${card} tbody.fx-hold:has(strong:text-is("VOO")) .fx-quoted:has-text("Ghostfolio has no prices of its own for VOO yet")`, { timeout: 2000 });
    await page.click(`${card} tbody.fx-hold:has(strong:text-is("BND")) button.fx-holdbtn`, { timeout: 5000 });
    await page.waitForSelector(`${card} tbody.fx-hold:has(strong:text-is("BND")) .fx-holdhist`, { timeout: 2000 });
    if (await page.$(`${card} tbody.fx-hold:has(strong:text-is("BND")) .fx-quoted`)) throw new Error('a holding with prices said to have none');
  } },
  // Ghostfolio's holdings counted VOO a thousand times over (its buys say 8): the card showed millions. Read now brings the
  // count from the buys and sales, the holding says so in one line, and the totals come back to what was paid and a little
  // more; a holding that agreed says nothing. One whose buys and sales couldn't be read, worth far more than was paid, says to check it.
  { name: 'Finances: Investments use the buys and sales when Ghostfolio counts a holding wrong', screen: 'finances', mock: (() => {
    const roth = finances.plan.accounts.find((a) => a.id === 'roth');
    const voo = roth.holdings.find((h) => h.symbol === 'VOO');
    const wrong = { ...roth, balance: roth.balance - voo.value + voo.value * 1000, holdings: roth.holdings.map((h) => (h === voo ? { ...h, shares: h.shares * 1000, value: h.value * 1000, quoted: true } : h)) };
    const right = { ...roth, holdings: roth.holdings.map((h) => (h === voo ? { ...h, quoted: true, recounted: true } : h)) };
    return { status: runningToo('ghostfolio'), finances: { ...finances, plan: { ...finances.plan, readByHand: true, accounts: finances.plan.accounts.map((a) => (a.id === 'roth' ? wrong : a)) } }, investedRead: { roth: right } };
  })(), run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    const card = '#finRoot .fx-invest';
    const fig = async (n) => Number((await page.textContent(`${card} .fx-investfigs > div:nth-child(${n}) .fx-investfig`)).replace(/[^0-9.]/g, ''));
    const voo = `${card} tbody.fx-hold:has(strong:text-is("VOO"))`;
    await page.waitForSelector(`${voo} .fx-holdshares:text-is("8,000")`, { timeout: 5000 });
    await page.click(`${card} button:text-is("Read now")`);
    await page.waitForFunction(() => window.__MOCK.investReads === 1, null, { timeout: 5000 });
    // Worth what was paid and a little more, not millions.
    const total = await fig(1), paid = await fig(2);
    if (!(total > paid * 0.9 && total < paid * 2)) throw new Error(`total ${total} against ${paid} paid`);
    await page.waitForSelector(`${voo} .fx-holdshares:text-is("8")`, { timeout: 2000 });
    await page.click(`${voo} button.fx-holdbtn`);
    await page.waitForSelector(`${voo} .fx-recounted:text-is("Ghostfolio's holdings count disagreed with its buys and sales; this uses the buys and sales.")`, { timeout: 2000 });
    if (await page.$(`${voo} .fx-doubtful`)) throw new Error('a recounted holding said to check');
    const bnd = `${card} tbody.fx-hold:has(strong:text-is("BND"))`;
    await page.click(`${bnd} button.fx-holdbtn`);
    await page.waitForSelector(`${bnd} .fx-holdhist`, { timeout: 2000 });
    if (await page.$(`${bnd} .fx-recounted, ${bnd} .fx-doubtful`)) throw new Error('a holding that agreed said it did not');
  } },
  { name: 'Finances: Investments say to check a holding worth far more than was paid', screen: 'finances', mock: { finances: { ...finances, plan: { ...finances.plan, accounts: finances.plan.accounts.map((a) => (a.id === 'roth' ? { ...a, holdings: a.holdings.map((h) => (h.symbol === 'VOO' ? { ...h, doubtful: true } : h)) } : a)) } } }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    const voo = '#finRoot .fx-invest tbody.fx-hold:has(strong:text-is("VOO"))';
    await page.click(`${voo} button.fx-holdbtn`, { timeout: 5000 });
    await page.waitForSelector(`${voo} .fx-doubtful:has-text("This looks wrong: check VOO in Ghostfolio.")`, { timeout: 2000 });
  } },
  // A buy typed wrong, put right from the card: an open holding lists its buys and sales from Ghostfolio, each to Change (what
  // is typed checked first; Ghostfolio's no said in its words, the form kept) or Delete (asked first; Keep it leaves it). Each
  // reads Ghostfolio again, so the row and the figures follow; the last buy deleted takes the holding off the card.
  { name: 'Finances: Investments change a buy typed wrong, and delete one', screen: 'finances', mock: { status: runningToo('ghostfolio'), finances: { ...finances, plan: { ...finances.plan, readByHand: true } } }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    const card = '#finRoot .fx-invest';
    const voo = `${card} tbody.fx-hold:has(strong:text-is("VOO"))`;
    await page.click(`${voo} button.fx-holdbtn`, { timeout: 5000 });
    const trades = `${voo} .fx-trades`;
    await page.waitForSelector(`${trades} h4:text-is("Buys and sales in Ghostfolio")`, { timeout: 2000 });
    const line = `${trades} li.fx-trade:has-text("Bought 8 shares")`;
    await page.waitForSelector(`${line}:has-text("paid $3,620.00")`, { timeout: 3000 });
    await page.click(`${line} button:text-is("Change")`);
    const form = `${trades} form.fx-tradeform`;
    await page.waitForSelector(`${form} h3:text-is("Change this buy of VOO")`, { timeout: 2000 });
    if ((await page.inputValue(`${form} .moneyfield input`)) !== '3620.00') throw new Error('the form does not start from what Ghostfolio has');
    await page.fill(`${form} label:has-text("Shares") input`, '0');
    await page.click(`${form} button:text-is("Save in Ghostfolio")`);
    await page.waitForSelector(`${form} .formerr:text-is("How many shares: more than 0.")`, { timeout: 2000 });
    if (await page.evaluate(() => window.__MOCK.investChanged)) throw new Error('Ghostfolio asked with 0 shares');
    await page.fill(`${form} label:has-text("Shares") input`, '8');
    await page.fill(`${form} .moneyfield input`, '4,000');
    await page.evaluate(() => { window.__MOCK.investTradeProblem = 'Ghostfolio did not take it: date must be a valid ISO 8601 date string'; });
    await page.click(`${form} button:text-is("Save in Ghostfolio")`);
    await page.waitForSelector(`${form} .formerr:has-text("date must be a valid")`, { timeout: 3000 });
    await page.evaluate(() => { window.__MOCK.investTradeProblem = ''; });
    await page.click(`${form} button:text-is("Save in Ghostfolio")`);
    await page.waitForSelector(form, { state: 'detached', timeout: 5000 });
    await page.waitForSelector(`${card} [role=status]:has-text("Changed in Ghostfolio: the buy of VOO on")`, { timeout: 2000 });
    const x = await page.evaluate(() => window.__MOCK.investChanged[0]);
    if (x.account !== 'roth' || x.symbol !== 'VOO' || x.shares !== 8 || x.total !== 4000 || x.sold || !x.id) throw new Error(`sent ${JSON.stringify(x)}`);
    await page.waitForSelector(`${voo} .fx-holdpaid:has-text("$4,000.00")`, { timeout: 3000 });
    await page.waitForSelector(`${line}:has-text("paid $4,000.00")`, { timeout: 3000 });
    // Delete: asked first; Keep it leaves it.
    await page.click(`${line} button:text-is("Delete")`);
    await page.waitForSelector(`${line} [role=group]:has-text("Delete it from Ghostfolio?")`, { timeout: 2000 });
    await page.click(`${line} button:text-is("Keep it")`);
    await page.waitForSelector(`${line} button:text-is("Change")`, { timeout: 2000 });
    if (await page.evaluate(() => window.__MOCK.investDeleted)) throw new Error('deleted after Keep it');
    await page.click(`${line} button:text-is("Delete")`);
    await page.click(`${line} .fx-tradeask button:text-is("Delete")`);
    await page.waitForSelector(voo, { state: 'detached', timeout: 5000 });
    await page.waitForSelector(`${card} [role=status]:has-text("Deleted from Ghostfolio: the buy of VOO on")`, { timeout: 2000 });
    if ((await page.evaluate(() => window.__MOCK.investDeleted)).length !== 1) throw new Error('not deleted once');
    await page.waitForSelector(`${card} .fx-investfigs .fx-sub:text-is("8 holdings in 3 accounts")`, { timeout: 2000 });
  } },
  // A sale into a new account, made in Finances and Ghostfolio by one name; turned down by Ghostfolio first, in its words, the form kept.
  { name: 'Finances: Investments add a sale into a new account, and say why Ghostfolio turned it down', screen: 'finances', mock: { status: runningToo('ghostfolio'), finances: { ...finances, plan: { ...finances.plan, readByHand: true } }, investAddProblem: 'Ghostfolio did not take it: Could not find a price for the asset AAPL' }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    const card = '#finRoot .fx-invest';
    await page.click(`${card} button:text-is("Add a holding")`, { timeout: 5000 });
    const form = `${card} form.fx-investadd`;
    await page.click(`${form} .seg button:text-is("Sold")`);
    await page.waitForSelector(`${form} label:has-text("What you got in all")`, { timeout: 2000 });
    await page.selectOption(`${form} select`, 'new');
    await page.fill(`${form} input[placeholder="Roth IRA"]`, 'Coinbase');
    await page.fill(`${form} input[placeholder^="A ticker"]`, 'apple');
    await page.click(`${form} button.fx-symbol:has(strong:text-is("AAPL"))`, { timeout: 3000 });
    await page.fill(`${form} input[placeholder="10"]`, '2');
    await page.fill(`${form} .moneyfield input`, '450');
    await page.click(`${form} button:text-is("Add to Ghostfolio")`);
    await page.waitForSelector(`${form} .formerr:text-is("Ghostfolio did not take it: Could not find a price for the asset AAPL")`, { timeout: 5000 });
    await page.evaluate(() => { window.__MOCK.investAddProblem = ''; });
    await page.click(`${form} button:text-is("Add to Ghostfolio")`);
    await page.waitForSelector(form, { state: 'detached', timeout: 5000 });
    await page.waitForSelector(`${card} [role=status]:has-text("Added to Ghostfolio: sold 2 AAPL, in Coinbase.")`, { timeout: 2000 });
    const x = await page.evaluate(() => window.__MOCK.investAdded[0]);
    if (x.account || x.newName !== 'Coinbase' || !x.sold || x.shares !== 2 || x.total !== 450) throw new Error(`sent ${JSON.stringify(x)}`);
  } },
  { name: 'Finances: Investments say when Ghostfolio finds nothing, and Cancel closes the form', screen: 'finances', mock: { status: runningToo('ghostfolio'), finances: { ...finances, plan: { ...finances.plan, readByHand: true } } }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    const card = '#finRoot .fx-invest';
    await page.click(`${card} button:text-is("Add a holding")`, { timeout: 5000 });
    const form = `${card} form.fx-investadd`;
    await page.fill(`${form} input[placeholder^="A ticker"]`, 'zzzz');
    await page.waitForSelector(`${form} #investFound:has-text("Ghostfolio found nothing for “zzzz”.")`, { timeout: 3000 });
    await page.click(`${form} button:text-is("Cancel")`);
    await page.waitForSelector(form, { state: 'detached', timeout: 2000 });
    await page.waitForSelector(`${card} button:text-is("Add a holding")`, { timeout: 2000 });
  } },
  // A phone allowed to change Finances reads Ghostfolio and adds a holding through the computer, as the computer does.
  { name: 'The phone: Investments read and add a holding, allowed to change Finances', screen: 'finances', phone: ['companion', 'finances'], mock: { finances: { ...finances, plan: { ...finances.plan, readByHand: true } } }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    const card = '#finRoot .fx-invest';
    await page.click(`${card} button:text-is("Read now")`, { timeout: 5000 });
    await page.waitForFunction(() => window.__MOCK.investReads === 1, null, { timeout: 5000 });
    await page.click(`${card} button:text-is("Add a holding")`);
    const form = `${card} form.fx-investadd`;
    await page.fill(`${form} input[placeholder^="A ticker"]`, 'voo');
    await page.click(`${form} button.fx-symbol:has(strong:text-is("VOO"))`, { timeout: 3000 });
    await page.fill(`${form} input[placeholder="10"]`, '2');
    await page.fill(`${form} .moneyfield input`, '1000');
    await page.click(`${form} button:text-is("Add to Ghostfolio")`);
    await page.waitForSelector(form, { state: 'detached', timeout: 5000 });
    if ((await page.evaluate(() => window.__MOCK.investAdded?.[0]?.symbol)) !== 'VOO') throw new Error('not added from the phone');
  } },
  // Status not reporting Ghostfolio (it runs elsewhere, or Status has not been read yet): the card still offers a first read and Add.
  { name: 'Finances: Investments offer a first read and Add a holding with Ghostfolio not on Status', screen: 'finances', mock: { finances: { ...finances, plan: { ...finances.plan, holdingsRead: undefined, accounts: finances.plan.accounts.map(({ holdings, ...a }) => a) } } }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    const card = '#finRoot .fx-invest';
    await page.waitForSelector(`${card} button:text-is("Read now")`, { timeout: 5000 });
    await page.waitForSelector(`${card} button:text-is("Add a holding")`, { timeout: 2000 });
  } },
  { name: 'The phone, view only: Investments shown, with nothing to read or match', screen: 'finances', phone: ['companion', 'finances'], mock: { status: runningToo('ghostfolio'), finances: { ...finances, readOnly: true }, investUnmatched: ['Coinbase'] }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    const card = '#finRoot .fx-invest';
    await page.waitForSelector(`${card} button.fx-holdbtn:has(strong:text-is("AAPL"))`, { timeout: 5000 });
    if (await page.$(`${card} button:text-is("Read now")`) || await page.$(`${card} .fx-investauto`) || await page.$(`${card} select`)) throw new Error('something to read or change on a phone allowed only to look');
    await page.waitForTimeout(300);
    if (await page.evaluate(() => window.__MOCK.investReads)) throw new Error('read on a phone');
    await page.click(`${card} button.fx-holdbtn:has(strong:text-is("AAPL"))`);
    await page.waitForSelector(`${card} .fx-holddetail svg`, { timeout: 2000 });
  } },
  // A direct debit or deposit loses its codes (PPD or WEB ID, its entry wording, a long reference); Zelle says who, in
  // ordinary capitals; a card paid from checking says which; Comcast's wording is Xfinity, Apple's savings transfer Apple Savings.
  { name: "Finances: a Chase CSV's direct debits, Zelle, and card payments come in by the names a person would write", screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-transactions button:text-is("Import a file")');
    const csv = 'Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #\n'
      + 'CREDIT,11/06/2026,"ACME CRUISES AD_PAYMENT PPD ID: 1234567890",1500.00,ACH_CREDIT,5000.00,,\n'
      + 'DEBIT,11/05/2026,"MAZDA FINANCIAL WEB ABCD1234EFGH5 WEB ID: 1111111111",-250.00,ACH_DEBIT,3500.00,,\n'
      + 'DEBIT,11/04/2026,"COMCAST-XFINITY CABLE SVCS PPD ID: 0000000001",-80.00,ACH_DEBIT,3750.00,,\n'
      + 'DEBIT,11/03/2026,"APPLE GS SAVINGS TRANSFER 123456789012 WEB ID: 2222222222",-300.00,ACH_DEBIT,3830.00,,\n'
      + 'DEBIT,11/02/2026,"Payment to Chase card ending in 1234 11/02",-120.00,LOAN_PMT,4130.00,,\n'
      + 'CREDIT,11/01/2026,"Zelle payment from JANE Q DOE 12345678901",40.00,QUICKPAY_CREDIT,4250.00,,\n';
    await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'Chase1234_Activity.CSV', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.waitForSelector('#finSheet .formsub:has-text("6 to bring in")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Bring in 6")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const txs = (await page.evaluate(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions)).slice(-6);
    const names = txs.map((t) => t.payee).join('|');
    if (names !== 'Acme Cruises|Mazda|Xfinity|Apple Savings|Payment to Chase card ••1234|Zelle from Jane Q Doe') throw new Error(`named ${names}`);
    if (!txs[0].note?.includes('ACME CRUISES AD_PAYMENT PPD ID: 1234567890')) throw new Error(`the bank's wording not kept: ${txs[0].note}`);
  } },
  // An American Express file: charges as plus amounts, a payment as minus. Into a card it is read the other way round,
  // said so, and can be turned off; into checking, as written.
  { name: 'Finances: an American Express file reads its plus amounts as charges', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-transactions button:text-is("Import a file")');
    const csv = 'Date,Description,Amount\n'
      + '11/05/2026,AMAZON.COM AMZN.COM/BILL WA,56.61\n'
      + '11/04/2026,PET SUPERMARKET #100SUNRISE FL,30.34\n'
      + '11/02/2026,AIRCOOL FLORIDA MIAMI FL,402.00\n'
      + '11/01/2026,AUTOPAY PAYMENT RECEIVED - THANK YOU,-500.00\n';
    await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'activity.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.selectOption('#finSheet label:has-text("Into the ledger of") select', 'amex');
    await page.waitForSelector('#finSheet .formsub:has-text("4 to bring in")', { timeout: 5000 });
    await page.waitForSelector('#finSheet .importnote:has-text("read as charges")', { timeout: 2000 });
    if (!(await page.isChecked('#finSheet label:has-text("Charges are plus amounts") input'))) throw new Error('not read as charges');
    const shown = await page.$$eval('#finSheet .importlist li > span:last-child', (s) => s.map((x) => x.textContent));
    if (shown.join(' ') !== '−$56.61 −$30.34 −$402.00 +$500.00') throw new Error(`shown ${shown.join(' ')}`);
    // Turned off, as written.
    await page.click('#finSheet label:has-text("Charges are plus amounts") input');
    if ((await page.textContent('#finSheet .importlist li > span:last-child')) !== '+$56.61') throw new Error('turned off, still the other way round');
    await page.click('#finSheet label:has-text("Charges are plus amounts") input');
    await page.click('#finSheet button:text-is("Bring in 4")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const txs = (await page.evaluate(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions)).slice(-4);
    if (txs.map((t) => `${t.account} ${t.amount}`).join('|') !== 'amex -56.61|amex -30.34|amex -402|amex 500') throw new Error(`saved ${txs.map((t) => `${t.account} ${t.amount}`)}`);
  } },
  // American Express's own wording: AplPay before the shop, WWP* and WL * (its processors), and the town and state after it,
  // padded into columns, glued to a store number, or in the file's City/State column. Each comes in as the shop, the
  // wording kept in its note.
  { name: "Finances: an American Express file's payees lose AplPay, WWP*, WL * and the town", screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-transactions button:text-is("Import a file")');
    const csv = 'Date,Description,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category\n'
      + '11/08/2026,AplPay STARBUCKS SEATTLE WA,6.10,,,,"SEATTLE\nWA",98101,UNITED STATES,,Restaurant\n'
      + '11/08/2026,AplPay PINE CAFE MIAMI FL,12.40,,,,"MIAMI\nFL",33101,UNITED STATES,,Restaurant\n'
      + '11/07/2026,WWP*SUNNY DAYS SCHOOL 877-555-0100 FL,250.00,,,,"877-555-0100\nFL",33101,UNITED STATES,,Education\n'
      + '11/07/2026,WL *STEAM PURCHASE   425-555-0100        WA,19.99,,,,,,,,Entertainment\n'
      + '11/06/2026,BLUE BOTTLE COFFEE  OAKLAND             CA,5.75,,,,,,,,Restaurant\n'
      + '11/06/2026,PET SUPERMARKET #100SUNRISE FL,30.34,,,,,,,,Merchandise\n'
      + '11/05/2026,AplPay TST* JOES CAFE FORT LAUDERDALE FL,22.00,,,,"FORT LAUDERDALE\nFL",33301,UNITED STATES,,Restaurant\n'
      + '11/05/2026,AMAZON.COM AMZN.COM/BILL WA,56.61,,,,,,,,Merchandise\n';
    await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'activity.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.selectOption('#finSheet label:has-text("Into the ledger of") select', 'amex');
    await page.waitForSelector('#finSheet .formsub:has-text("8 to bring in")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Bring in 8")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const txs = (await page.evaluate(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions)).filter((t) => t.account === 'amex' && t.date >= '2026-11-05');
    const want = ['Starbucks', 'Pine Cafe', 'Sunny Days School', 'Steam', 'Blue Bottle Coffee', 'Pet Supermarket', 'Joes Cafe', 'Amazon'];
    const got = txs.map((t) => t.payee);
    if ([...got].sort().join('|') !== [...want].sort().join('|')) throw new Error(`payees ${got.join('|')}`);
    // The bank's wording stays in the note, on one line.
    const steam = txs.find((t) => t.payee === 'Steam');
    if (!(steam?.note || '').includes('WL *STEAM PURCHASE 425-555-0100 WA')) throw new Error(`Steam's note ${JSON.stringify(steam?.note)}`);
  } },
  // A bank's file that says what each row is (American Express's Category column: "Restaurant-Restaurant",
  // "Merchandise & Supplies-Groceries"; Chase's: "Food & Drink") gives a shop the household's own category for it when
  // nothing better says (a known brand's still wins: Starbucks is Eating out whatever the file calls it). One that
  // says nothing the household has (Other-Miscellaneous) is left to pick, and the bank's word isn't a note. A company's
  // ending (LLC, Inc.) goes, as its town does.
  { name: "Finances: an American Express file's Category column gives each shop the household's category", screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-transactions button:text-is("Import a file")');
    const csv = 'Date,Description,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category\n'
      + '11/08/2026,PINE CAFE MIAMI FL,12.40,,,,"MIAMI\nFL",,,,Restaurant-Restaurant\n'
      + '11/08/2026,CORNER MARKET MIAMI FL,40.00,,,,"MIAMI\nFL",,,,Merchandise & Supplies-Groceries\n'
      + '11/07/2026,SUNNY DAYS SCHOOL MIAMI FL,250.00,,,,"MIAMI\nFL",,,,Other-Education\n'
      + '11/07/2026,RIVERSIDE INN ASHEVILLE NC,180.00,,,,"ASHEVILLE\nNC",,,,Travel-Lodging\n'
      + '11/06/2026,FUEL STOP 12 MIAMI FL,35.00,,,,"MIAMI\nFL",,,,Transportation-Fuel\n'
      + '11/06/2026,HOMETOWN HARDWARE MIAMI FL,22.00,,,,"MIAMI\nFL",,,,Merchandise & Supplies-Hardware Supplies\n'
      + '11/05/2026,BIG STORE MIAMI FL,60.00,,,,"MIAMI\nFL",,,,Merchandise & Supplies-Department Stores\n'
      + '11/05/2026,STARBUCKS SEATTLE WA,6.10,,,,"SEATTLE\nWA",,,,Merchandise & Supplies-Groceries\n'
      + '11/04/2026,MYSTERY LLC MIAMI FL,9.00,,,,"MIAMI\nFL",,,,Other-Miscellaneous\n'
      + '11/04/2026,"SUNSHINE DENTAL, INC. MIAMI FL",90.00,,,,"MIAMI\nFL",,,,Business Services-Health Care Services\n';
    await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'activity.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.selectOption('#finSheet label:has-text("Into the ledger of") select', 'amex');
    await page.waitForSelector('#finSheet .formsub:has-text("10 to bring in")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Bring in 10")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const txs = (await page.evaluate(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions)).filter((t) => t.account === 'amex' && t.date >= '2026-11-04');
    const got = Object.fromEntries(txs.map((t) => [t.payee, t.category || '']));
    const want = { 'Pine Cafe': 'Eating out', 'Corner Market': 'Groceries', 'Sunny Days School': 'Kids and school', 'Riverside Inn': 'Travel', 'Fuel Stop 12': 'Gas', 'Hometown Hardware': 'Repairs', 'Big Store': 'Shopping', Starbucks: 'Eating out', Mystery: '', 'Sunshine Dental': 'Health' };
    for (const [payee, cat] of Object.entries(want)) if (got[payee] !== cat) throw new Error(`${payee}: ${JSON.stringify(got[payee])}, not ${JSON.stringify(cat)} (${JSON.stringify(got)})`);
    if (txs.some((t) => /Restaurant|Merchandise|Miscellaneous/.test(t.note || ''))) throw new Error('the bank\'s category went into a note');
  } },
  // Chase's file says it in its own words, in a Category column beside its Memo.
  { name: "Finances: a Chase file's Category column gives each shop the household's category", screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-transactions button:text-is("Import a file")');
    const csv = 'Transaction Date,Post Date,Description,Category,Type,Amount,Memo\n'
      + '11/08/2026,11/09/2026,PINE CAFE,Food & Drink,Sale,-12.40,\n'
      + '11/07/2026,11/08/2026,CORNER MARKET,Groceries,Sale,-40.00,\n'
      + '11/06/2026,11/07/2026,FUEL STOP 12,Gas,Sale,-35.00,\n'
      + '11/05/2026,11/06/2026,TOWN CLINIC,Health & Wellness,Sale,-80.00,\n';
    await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'chase.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.waitForSelector('#finSheet .formsub:has-text("4 to bring in")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Bring in 4")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const txs = (await page.evaluate(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions)).filter((t) => t.date >= '2026-11-05' && t.amount < 0);
    const got = Object.fromEntries(txs.map((t) => [t.payee, t.category || '']));
    const want = { 'Pine Cafe': 'Eating out', 'Corner Market': 'Groceries', 'Fuel Stop 12': 'Gas', 'Town Clinic': 'Health' };
    for (const [payee, cat] of Object.entries(want)) if (got[payee] !== cat) throw new Error(`${payee}: ${JSON.stringify(got[payee])}, not ${JSON.stringify(cat)} (${JSON.stringify(got)})`);
  } },
  // A card's file brought into checking (left on the sheet's first account): most rows are money in, which a card's file
  // writes its charges as. The sheet says so before anything comes in, and moves it to the American Express card in one
  // tap, read as charges; a line says what comes in, out and in, before Bring in.
  { name: 'Finances: an American Express file left on checking says so, and moves to the card in one tap', screen: 'finances', run: async (page) => {
    await page.click('#finRoot > .seg button:text-is("Spending")', { timeout: 5000 });
    await page.click('.fx-transactions button:text-is("Import a file")');
    const csv = 'Date,Description,Amount\n'
      + '11/05/2026,AMAZON.COM AMZN.COM/BILL WA,56.61\n'
      + '11/04/2026,BLUE BOTTLE COFFEE  OAKLAND   CA,30.34\n'
      + '11/02/2026,SUNNY DAYS SCHOOL  MIAMI   FL,402.00\n'
      + '11/01/2026,AUTOPAY PAYMENT RECEIVED - THANK YOU,-500.00\n';
    await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'activity.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.waitForSelector('#finSheet .importnote:has-text("Most of these rows are money coming in")', { timeout: 5000 });
    await page.waitForSelector('#finSheet .importsum:text-is("1 out, $500.00 · 3 in, $488.95")', { timeout: 2000 });
    await page.click('#finSheet button:text-is("Bring it into Amex Gold")');
    if ((await page.$eval('#finSheet label:has-text("Into the ledger of") select', (e) => e.value)) !== 'amex') throw new Error('not moved to the card');
    await page.waitForSelector('#finSheet .importnote:has-text("read as charges")', { timeout: 2000 });
    await page.waitForSelector('#finSheet .importsum:text-is("3 out, $488.95 · 1 in, $500.00")', { timeout: 2000 });
    if (await page.isVisible('#finSheet .importnote:has-text("Most of these rows are money coming in")')) throw new Error('still warns on the card');
  } },
  // The card picked, but Charges are plus amounts unticked: the same warning, with Read them as charges.
  { name: 'Finances: an American Express file read as money in on the card says so, and reads them as charges in one tap', screen: 'finances', run: async (page) => {
    await page.click('#finRoot > .seg button:text-is("Spending")', { timeout: 5000 });
    await page.click('.fx-transactions button:text-is("Import a file")');
    const csv = 'Date,Description,Amount\n11/05/2026,AMAZON.COM AMZN.COM/BILL WA,56.61\n11/04/2026,BLUE BOTTLE COFFEE  OAKLAND   CA,30.34\n11/02/2026,SUNNY DAYS SCHOOL  MIAMI   FL,402.00\n';
    await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'activity.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.selectOption('#finSheet label:has-text("Into the ledger of") select', 'amex');
    await page.click('#finSheet label:has-text("Charges are plus amounts") input');
    await page.waitForSelector('#finSheet .importnote:has-text("on Amex Gold lowers what it owes")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Read them as charges")');
    if (!(await page.isChecked('#finSheet label:has-text("Charges are plus amounts") input'))) throw new Error('not read as charges');
    await page.waitForSelector('#finSheet .importsum:text-is("3 out, $488.95 · 0 in, $0.00")', { timeout: 2000 });
  } },
  // American Express's own cuts: a padded file whose town runs into a store number, its spelling of the marketplace, and a
  // name cut at its column with the town run into it. Each reads as the shop.
  { name: "Finances: an American Express name cut short or run into its town reads as the shop", screen: 'finances', run: async (page) => {
    await page.click('#finRoot > .seg button:text-is("Spending")', { timeout: 5000 });
    await page.click('.fx-transactions button:text-is("Import a file")');
    const csv = 'Date,Description,Amount\n'
      + '11/04/2026,PET SUPERMARKET #100SUNRISE           FL,30.34\n'
      + '11/03/2026,AMAZON MARKEPLACE NA PA,4.98\n'
      + '11/02/2026,ANTHROPIC CLAUDE SUSAN FRANCISCO CA,20.00\n';
    await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'activity.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.selectOption('#finSheet label:has-text("Into the ledger of") select', 'amex');
    await page.waitForSelector('#finSheet .formsub:has-text("3 to bring in")', { timeout: 5000 });
    const names = await page.$$eval('#finSheet .importlist li strong', (s) => s.map((x) => x.textContent));
    if (names.join('|') !== 'Pet Supermarket|Amazon|Claude') throw new Error(`names ${names.join('|')}`);
  } },
  // A game store's wording is its brand, with its logo (Steam, PlayStation, Xbox, Nintendo, Epic Games, GameStop, Roblox),
  // and its row goes into the household's own Gaming category; with none, Shopping.
  ...[[true, 'Gaming'], [false, 'Shopping']].map(([own, cat]) => ({ name: `Finances: a game store comes in as its brand, with its logo, into ${own ? 'your Gaming category' : 'Shopping without one'}`, screen: 'finances',
    mock: own ? { finances: { ...finances, categories: [...finances.categories, { name: 'Gaming', icon: 'gaming' }], plan: { ...finances.plan, categories: [...finances.categories, { name: 'Gaming', icon: 'gaming' }] } } } : {}, run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-transactions button:text-is("Import a file")');
    const csv = 'Date,Description,Amount\n'
      + '11/08/2026,WL *STEAM PURCHASE 425-555-0100 WA,-19.99\n'
      + '11/08/2026,STEAMGAMES.COM 4259522985 WA,-4.99\n'
      + '11/07/2026,PLAYSTATION NETWORK 800-555-0199 CA,-69.99\n'
      + '11/07/2026,MICROSOFT*XBOX,-29.99\n'
      + '11/06/2026,NINTENDO CA1234567 WA,-59.99\n'
      + '11/06/2026,EPIC GAMES STORE,-14.99\n'
      + '11/05/2026,GAMESTOP #1234,-39.99\n'
      + '11/05/2026,ROBLOX CORPORATION,-9.99\n';
    await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'activity.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.waitForSelector('#finSheet .formsub:has-text("8 to bring in")', { timeout: 5000 });
    for (const who of ['Steam', 'PlayStation', 'Xbox', 'Nintendo', 'Epic Games', 'GameStop', 'Roblox']) {
      await page.waitForSelector(`#finSheet .importlist li:has(strong:text-is("${who}")) small:has-text(" · ${cat}")`, { timeout: 2000 });
      await page.waitForSelector(`#finSheet .importlist li:has(strong:text-is("${who}")) .fmark.logo`, { timeout: 2000 });
    }
    await page.click('#finSheet button:text-is("Bring in 8")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const txs = (await page.evaluate(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions)).slice(-8);
    const got = txs.map((t) => `${t.payee} ${t.category}`).sort().join('|');
    const want = ['Steam', 'Steam', 'PlayStation', 'Xbox', 'Nintendo', 'Epic Games', 'GameStop', 'Roblox'].map((p) => `${p} ${cat}`).sort().join('|');
    if (got !== want) throw new Error(`saved ${got}`);
  } })),
  // The same file imported again over rows brought in before with the bank's codes in their names: those take the clearer
  // name, keeping their category; a payee typed in by hand stays as it is; nothing comes in twice.
  { name: 'Finances: a CSV imported again gives rows named with the bank\'s codes clearer names, never one typed by hand', screen: 'finances', mock: { ledger: { rev: 'r1', transactions: [
    { id: 'm1', date: '2026-11-06', account: 'chk', amount: 1500, payee: 'Acme Cruises Ad_payment Ppd Id', category: 'Pay', note: 'ACME CRUISES AD_PAYMENT PPD ID: 1234567890' },
    { id: 'm2', date: '2026-11-05', account: 'chk', amount: -250, payee: 'Car payment', note: 'MAZDA FINANCIAL WEB ABCD1234EFGH5 WEB ID: 1111111111' },
    { id: 'm3', date: '2026-11-03', account: 'chk', amount: -300, payee: 'Apple', note: 'APPLE GS SAVINGS TRANSFER 123456789012 WEB ID: 2222222222' },
  ] } }, run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-transactions button:text-is("Import a file")');
    const csv = 'Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #\n'
      + 'CREDIT,11/06/2026,"ACME CRUISES AD_PAYMENT PPD ID: 1234567890",1500.00,ACH_CREDIT,5000.00,,\n'
      + 'DEBIT,11/05/2026,"MAZDA FINANCIAL WEB ABCD1234EFGH5 WEB ID: 1111111111",-250.00,ACH_DEBIT,3500.00,,\n'
      + 'DEBIT,11/03/2026,"APPLE GS SAVINGS TRANSFER 123456789012 WEB ID: 2222222222",-300.00,ACH_DEBIT,3830.00,,\n';
    await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'Chase1234_Activity.CSV', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.waitForSelector('#finSheet .formsub:has-text("0 to bring in")', { timeout: 5000 });
    await page.waitForSelector('#finSheet .formsub:has-text("2 brought in before, given clearer names")', { timeout: 2000 });
    await page.waitForSelector('#finSheet .formsub:has-text("1 already in, skipped")', { timeout: 2000 });
    await page.click('#finSheet button:text-is("Fix 2")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const txs = await page.evaluate(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions);
    const by = (id) => txs.find((t) => t.id === id);
    if (txs.length !== 3 || by('m1').payee !== 'Acme Cruises' || by('m1').category !== 'Pay' || by('m2').payee !== 'Car payment' || by('m3').payee !== 'Apple Savings') throw new Error(`renamed ${JSON.stringify(txs)}`);
  } },
  // Imported rows take what they are plainly for: a known company's category, a planned payment's, a payroll deposit a
  // Paycheck; paying the household's own card, and money in from its own savings account, are moves, not spending; a Zelle
  // payment to someone is left for the household to pick. The preview says each before it comes in.
  // Four tabs, as the owner picked (Nov 10): Dashboard, Spending (Transactions, Reports), Plan (Calendar, Recurring,
  // Paychecks), Net worth (Net worth, Collection). A tab with pages opens its first and shows them in a second row, and again on the page it was
  // left on; a way into a page (a Dashboard card) picks its tab and page.
  { name: 'Finances: four tabs, Spending, Plan and Net worth with their pages in a second row', screen: 'finances', run: async (page) => {
    const top = await page.$$eval('#finRoot > .seg button', (bs) => bs.map((b) => b.textContent));
    if (top.join('|') !== 'Dashboard|Spending|Plan|Net worth') throw new Error(`tabs ${top.join('|')}`);
    if (await page.isVisible('#finRoot .fx-subtabs')) throw new Error('a second row on the Dashboard');
    const second = () => page.$$eval('#finRoot .fx-subtabs .seg button', (bs) => bs.map((b) => `${b.textContent}${b.getAttribute('aria-checked') === 'true' ? '*' : ''}`).join('|'));
    await page.click('#finRoot > .seg button:text-is("Spending")');
    await page.waitForSelector('#finRoot .fx-transactions', { timeout: 5000 });
    if ((await second()) !== 'Transactions*|Reports') throw new Error(`Spending's pages ${await second()}`);
    await page.click('#finRoot .fx-subtabs .seg button:text-is("Reports")');
    if ((await second()) !== 'Transactions|Reports*') throw new Error(`after Reports ${await second()}`);
    await page.click('#finRoot > .seg button:text-is("Plan")');
    if ((await second()) !== 'Calendar*|Recurring|Paychecks') throw new Error(`Plan's pages ${await second()}`);
    await page.click('#finRoot .fx-subtabs .seg button:text-is("Paychecks")');
    await page.waitForSelector('#finRoot > .seg button[aria-checked=true]:text-is("Plan")', { timeout: 2000 });
    // Net worth has its Collection beside it (Nov 13), so its pages are a second row too, Net worth first.
    await page.click('#finRoot > .seg button:text-is("Net worth")');
    if ((await second()) !== 'Net worth*|Collection') throw new Error(`Net worth's pages ${await second()}`);
    // Each tab opens again on the page it was left on.
    await page.click('#finRoot > .seg button:text-is("Spending")');
    if ((await second()) !== 'Transactions|Reports*') throw new Error(`Spending again ${await second()}`);
    await page.click('#finRoot > .seg button:text-is("Plan")');
    if ((await second()) !== 'Calendar|Recurring|Paychecks*') throw new Error(`Plan again ${await second()}`);
    // Back on the Dashboard, a card that opens Recurring picks Plan and Recurring.
    await page.click('#finRoot > .seg button:text-is("Dashboard")');
    await page.click('.fx-flow button[aria-label^="Open Recurring"]', { timeout: 5000 });
    await page.waitForSelector('#finRoot > .seg button[aria-checked=true]:text-is("Plan")', { timeout: 5000 });
    if ((await second()) !== 'Calendar|Recurring*|Paychecks') throw new Error(`from the Dashboard ${await second()}`);
  } },
  { name: 'Finances: an import fills in what each row is plainly for, and money between your own accounts moves', screen: 'finances', mock: { finances: { ...finances, plan: { ...finances.plan, accounts: [...finances.plan.accounts, { id: 'apple', name: 'Apple Savings', kind: 'savings', balance: 1000 }] } } }, run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-transactions button:text-is("Import a file")');
    const csv = 'Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #\n'
      + 'DEBIT,11/07/2026,"SHELL OIL 57444",-48.00,DEBIT_CARD,5000.00,,\n'
      + 'CREDIT,11/06/2026,"ACME CORP PAYROLL PPD ID: 12345",2000.00,ACH_CREDIT,5048.00,,\n'
      + 'DEBIT,11/05/2026,"Payment to Chase card ending in 1234 11/05",-120.00,LOAN_PMT,3048.00,,\n'
      + 'CREDIT,11/04/2026,"APPLE GS SAVINGS TRANSFER 123456789012 WEB ID: 2222222222",500.00,ACH_CREDIT,3168.00,,\n'
      + 'DEBIT,11/03/2026,"Zelle payment to Sam Lee 12345678901",-30.00,QUICKPAY_DEBIT,2668.00,,\n'
      + 'DEBIT,11/02/2026,"WHOLEFDS MKT 10234 AUSTIN TX",-64.10,DEBIT_CARD,2698.00,,\n';
    await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'Chase1234_Activity.CSV', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.waitForSelector('#finSheet .formsub:has-text("6 to bring in")', { timeout: 5000 });
    for (const [who, said] of [['Shell', ' · Gas'], ['Acme Corp Payroll', ' · Paycheck'], ['Payment to Chase card ••1234', ' · moves to Chase Freedom'], ['Apple Savings', ' · moves from Apple Savings']]) {
      await page.waitForSelector(`#finSheet .importlist li:has(strong:text-is("${who}")) small:has-text("${said}")`, { timeout: 2000 });
    }
    await page.click('#finSheet button:text-is("Bring in 6")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const txs = (await page.evaluate(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions)).slice(-6);
    const by = (p) => txs.find((t) => t.payee === p);
    if (by('Shell')?.category !== 'Gas' || by('Acme Corp Payroll')?.category !== 'Paycheck') throw new Error(`categories ${JSON.stringify(txs)}`);
    const card = by('Payment to Chase card ••1234'), sav = by('Apple Savings'), zelle = by('Zelle to Sam Lee');
    if (card?.to !== 'visa' || card.account !== 'chk' || card.amount !== -120 || card.category) throw new Error(`the card payment ${JSON.stringify(card)}`);
    if (sav?.account !== 'apple' || sav.to !== 'chk' || sav.amount !== -500 || sav.category) throw new Error(`the savings transfer ${JSON.stringify(sav)}`);
    if (!zelle || zelle.category || zelle.to) throw new Error(`the Zelle payment ${JSON.stringify(zelle)}`);
  } },
  // Rows brought in before with no category take one when the same file is imported again; one with a category keeps it.
  { name: 'Finances: a CSV imported again gives rows brought in before with no category theirs', screen: 'finances', mock: { ledger: { rev: 'r1', transactions: [
    { id: 'c1', date: '2026-11-07', account: 'chk', amount: -48, payee: 'Shell', note: 'SHELL OIL 57444' },
    { id: 'c2', date: '2026-11-06', account: 'chk', amount: 2000, payee: 'Acme Corp Payroll', category: 'Refunds', note: 'ACME CORP PAYROLL PPD ID: 12345' },
  ] } }, run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-transactions button:text-is("Import a file")');
    const csv = 'Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #\n'
      + 'DEBIT,11/07/2026,"SHELL OIL 57444",-48.00,DEBIT_CARD,5000.00,,\n'
      + 'CREDIT,11/06/2026,"ACME CORP PAYROLL PPD ID: 12345",2000.00,ACH_CREDIT,5048.00,,\n';
    await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'Chase1234_Activity.CSV', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.waitForSelector('#finSheet .formsub:has-text("1 brought in before, given a category")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Fix 1")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const txs = await page.evaluate(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions);
    if (txs.length !== 2 || txs.find((t) => t.id === 'c1').category !== 'Gas' || txs.find((t) => t.id === 'c2').category !== 'Refunds') throw new Error(`categorized ${JSON.stringify(txs)}`);
  } },
  // Ghostfolio in a container the homelab did not start (Status: Runs elsewhere) still answers on its port: Finances reads
  // it once as it opens (the last read being old), and Update balances offers From Ghostfolio, as for one it runs itself.
  { name: 'Finances: a Ghostfolio that runs elsewhere is read as Finances opens, and offered in Update balances', screen: 'finances', mock: { status: { ...status, apps: [...status.apps, { id: 'ghostfolio', name: 'Ghostfolio', state: 'elsewhere', container: 'my-ghostfolio' }] } }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await page.waitForFunction(() => window.__MOCK.investReads === 1, null, { timeout: 5000 });
    await page.click('#finRoot .toolbar button:text-is("Update balances")');
    await page.waitForSelector('#finSheet button:text-is("From Ghostfolio")', { timeout: 5000 });
  } },
  { name: 'Finances: Update balances reads from no app that is not running, nor on a phone', screen: 'finances', run: async (page) => {
    await page.click('#finRoot .toolbar button:text-is("Update balances")', { timeout: 5000 });
    await page.waitForSelector('#finSheet input#bal-chk', { timeout: 5000 });
    if (await page.$('#finSheet .fromapp')) throw new Error('reading from an app that is not running');
  } },
  { name: 'The phone: Update balances reads from no app', screen: 'finances', phone: ['companion', 'finances'], mock: { status: runningToo('firefly-iii', 'ghostfolio') }, run: async (page) => {
    await page.click('#finRoot .toolbar button:text-is("Update balances")', { timeout: 5000 });
    await page.waitForSelector('#finSheet input#bal-chk', { timeout: 5000 });
    if (await page.$('#finSheet .fromapp')) throw new Error('reading from an app on a phone');
  } },
  // Update balances: one panel with every account, each box at what is expected today, the difference as it is typed;
  // Enter keeps them all, each as today's, and the cushion with them.
  { name: 'Finances: Update balances keeps the balances typed in', screen: 'finances', run: async (page) => {
    await page.click('#finRoot .toolbar button:text-is("Update balances")', { timeout: 5000 });
    await page.waitForSelector('#finSheet input#bal-chk:focus', { timeout: 5000 });
    for (const [id, want] of [['chk', '2512.40'], ['sav', '6500'], ['roth', '14600'], ['visa', '1240.55'], ['mortgage', '287400'], ['home', '410000']]) {
      const got = await page.inputValue(`#finSheet input#bal-${id}`);
      if (got !== want) throw new Error(`${id} starts at ${got}, not ${want}`);
    }
    await page.fill('#finSheet input#bal-chk', '3000');
    await page.waitForSelector('#finSheet .balancelist li:has(#bal-chk) small:has-text("expected $2,512.40, +$487.60")', { timeout: 5000 });
    // What Save changes in all: nothing else differs yet; then the card owing $59.45 more, and its pending $15.90 less.
    if (await page.$('#finSheet .balsum')) {
      if ((await page.textContent('#finSheet .balsum')).trim() !== '1 balance differs from what was expected: net worth +$487.60.') throw new Error(await page.textContent('#finSheet .balsum'));
    } else throw new Error('no line says what Save changes');
    await page.fill('#finSheet input#bal-visa', '1300');
    await page.fill('#finSheet input[aria-label="Chase Freedom pending"]', '68.20');
    await page.waitForFunction(() => document.querySelector('#finSheet .balsum')?.textContent.trim() === '2 balances differ from what was expected: net worth +$444.05.', null, { timeout: 5000 })
      .catch(async () => { throw new Error(`two changed: ${await page.textContent('#finSheet .balsum')}`); });
    await page.fill('#finSheet input#bal-visa', '1240.55');
    await page.fill('#finSheet input[aria-label="Chase Freedom pending"]', '84.10');
    await page.fill('#finSheet label:has-text("Flag checking under") input', '600');
    // Enter keeps them, as Save does.
    await page.press('#finSheet input#bal-chk', 'Enter');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const saved = await page.evaluate(() => window.__MOCK.financesSaved?.[0]);
    if (saved?.accounts.find((a) => a.id === 'chk').balance !== 3000 || !saved.updated || saved.cushion !== 600) throw new Error(`saved ${JSON.stringify(saved?.accounts[0])}, cushion ${saved?.cushion}`);
    if (saved.accounts.some((a) => a.updated !== saved.updated)) throw new Error('an account was not kept as today\'s');
    if (saved.accounts.find((a) => a.id === 'sav').balance !== 6500) throw new Error('an account left as expected changed');
    // Net worth's grid opens the same panel.
    await finTab(page, 'Net worth');
    await page.click('.finpost button:text-is("Update balances")');
    await page.waitForSelector('#finSheet:not([hidden]) h2:text-is("Update balances")', { timeout: 5000 });
  } },
  { name: 'Finances: add a payment', screen: 'finances', run: async (page) => {
    await page.click('#finRoot .toolbar button:text-is("Add a payment")', { timeout: 5000 });
    await page.waitForSelector('#finSheet:not([hidden])', { timeout: 5000 });
    await page.fill('#finSheet label:has-text("Name") input', 'Gym');
    await page.fill('#finSheet label:has-text("Amount") input', '40');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const saved = await page.evaluate(() => window.__MOCK.financesSaved?.[0]);
    const gym = saved?.payments.find((x) => x.name === 'Gym');
    if (!gym || gym.amount !== 40 || gym.schedule.every !== 'month') throw new Error(`saved ${JSON.stringify(gym)}`);
  } },
  // Money in from someone outside the household: Comes in from someone asks who sends it, and keeps no account it comes out of.
  { name: 'Finances: add money that comes in from someone', screen: 'finances', run: async (page) => {
    await page.click('#finRoot .toolbar button:text-is("Add a payment")', { timeout: 5000 });
    await page.waitForSelector('#finSheet:not([hidden])', { timeout: 5000 });
    await page.click('#finSheet .finway [role=radio]:text-is("Comes in from someone")');
    if (await page.$('#finSheet label:has-text("Comes out of")') || await page.$('#finSheet label:has-text("Pays off a card")')) throw new Error('money in asks what it comes out of');
    await page.fill('#finSheet label:has-text("Name") input', 'Mortgage share');
    await page.fill('#finSheet label:has-text("Amount") input', '900');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet .formerr:has-text("Say who sends it")', { timeout: 5000 });
    await page.fill('#finSheet label:text-is("From") input', 'Sam');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const saved = await page.evaluate(() => window.__MOCK.financesSaved?.at(-1));
    const x = saved?.payments.find((q) => q.name === 'Mortgage share');
    if (!x || x.amount !== 900 || x.payer !== 'Sam' || x.from || x.card || x.to) throw new Error(`saved ${JSON.stringify(x)}`);
  } },
  { name: 'The phone, view only: money from someone shows, with nothing to change', screen: 'finances', phone: ['companion', 'finances'], mock: { finances: { ...moneyIn, readOnly: true } }, run: async (page) => {
    await page.waitForSelector('#finances.active .fx-paycheck', { timeout: 5000 });
    await page.click('#finPeriod button[aria-label="The pay period before"]').catch(() => {});
    await page.waitForSelector('.fx-paycheck li:has-text("Mortgage share"):has-text("from Sam"):has-text("+$900.00")', { timeout: 5000 });
    if (await page.$('.fx-paycheck li:has-text("Mortgage share") button')) throw new Error('a phone that may only look can open the payment');
  } },
  // Money from Sam on the 3rd: in the pay period's rows, Recurring, the month, the money flow, and the calendar, as money in.
  { name: 'Finances: money from someone shows as money in, everywhere it is planned', screen: 'finances', mock: { finances: moneyIn }, run: async (page) => {
    await page.waitForSelector('#finances.active .fx-paycheck', { timeout: 5000 });
    await page.click('#finPeriod button:text-is("Today")').catch(() => {});
    await page.waitForSelector('.fx-paycheck li:has-text("Mortgage share"):has-text("from Sam"):has-text("+$900.00")', { timeout: 5000 });
    await finTab(page, 'Recurring');
    await page.waitForSelector('.fx-payments li:has-text("Mortgage share"):has-text("from Sam"):has-text("+$900.00")', { timeout: 5000 });
    if (!(await page.textContent('.fx-monthsum')).includes('and Sam')) throw new Error('a typical month does not count what Sam sends');
    await page.waitForSelector('.fx-moneyflow :text("Mortgage share, from Sam")', { timeout: 5000 });
    await finTab(page, 'Calendar');
    await page.waitForSelector('.fx-calendar h2:has-text("October 2026")', { timeout: 5000 });
    await page.click('.fx-calendar button[aria-label="The month after"]');
    await page.click('.fx-month button[data-day="2026-11-03"]');
    await page.waitForSelector('.fx-dayone li:has-text("Mortgage share"):has-text("From Sam"):has-text("+$900.00")', { timeout: 5000 });
  } },
  // Another device saved after this one read: the save is refused, the
  // latest is read, and the form stays open with what was typed, so Save
  // again keeps both changes.
  { name: 'Finances: a save after another device’s reads the latest and keeps the form', screen: 'finances', mock: { financesConflict: true }, run: async (page) => {
    await page.click('#finRoot .toolbar button:text-is("Add a payment")', { timeout: 5000 });
    await page.fill('#finSheet label:has-text("Name") input', 'Gym');
    await page.fill('#finSheet label:has-text("Amount") input', '40');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#error:not([hidden]):has-text("changed on another device")', { timeout: 5000 });
    await page.waitForFunction(() => window.__MOCK.financesReads >= 2, null, { timeout: 5000 });
    if (!(await page.isVisible('#finSheet')) || (await page.inputValue('#finSheet label:has-text("Name") input')) !== 'Gym') throw new Error('the form closed or lost what was typed');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const saved = await page.evaluate(() => window.__MOCK.financesSaved?.at(-1));
    if (saved?.cushion !== 750 || !saved.payments.some((x) => x.name === 'Gym')) throw new Error(`saved cushion ${saved?.cushion}, payments ${saved?.payments.map((x) => x.name)}`);
  } },
  { name: 'Finances: every account post-pay, paycheck by paycheck, and a column picks its paycheck', screen: 'finances', run: async (page) => {
    // BofA Savings: $6,500 today; Alex's Nov 6 check moves $200 into it, and it earns its interest.
    await finTab(page, 'Net worth', { timeout: 5000 });
    const cell = async (row, col) => (await page.textContent(`.finpost tbody tr:has(th:has-text("${row}")) td:nth-of-type(${col})`)).replace(/\s+/g, ' ');
    if (!(await cell('BofA Savings', 1)).includes('$6,500.00')) throw new Error(`savings today: ${await cell('BofA Savings', 1)}`);
    const nov6 = await cell('BofA Savings', 3);
    if (!nov6.includes('$6,712.22') || !nov6.includes('+$')) throw new Error(`savings after Nov 6: ${nov6}`);
    if (!(await cell('Chase Checking', 3)).includes('$739.77')) throw new Error(`checking after Nov 6: ${await cell('Chase Checking', 3)}`);
    await page.click('.finpost thead button:has-text("Nov 20")');
    await page.waitForSelector('.finpost thead button[aria-pressed=true]:has-text("Nov 20")', { timeout: 5000 });
    await finTab(page, 'Dashboard');
    await page.waitForSelector('#finPeriod h2:has-text("Nov 20")', { timeout: 5000 });
  } },
  { name: 'Finances: a payment with each of someone\'s paychecks', screen: 'finances', run: async (page) => {
    await page.click('#finRoot .toolbar button:text-is("Add a payment")', { timeout: 5000 });
    await page.fill('#finSheet label:has-text("Name") input', 'To savings');
    await page.fill('#finSheet label:has-text("Amount") input', '500');
    await page.selectOption('#finSheet label:has-text("How often") select', 'paycheck:alex');
    if (await page.isVisible('#finSheet input[type=date]')) throw new Error('asks for a start date with each paycheck');
    await page.selectOption('#finSheet label:has-text("Goes into") select', 'sav');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const x = await page.evaluate(() => window.__MOCK.financesSaved?.[0]?.payments.find((p) => p.name === 'To savings'));
    if (x?.schedule.every !== 'paycheck' || x.schedule.person !== 'alex' || x.to !== 'sav') throw new Error(`saved ${JSON.stringify(x)}`);
    await finTab(page, 'Recurring');
    await page.waitForSelector('.fx-payments li:has-text("To savings"):has-text("With each of Alex\'s paychecks")', { timeout: 5000 });
  } },
  { name: 'Finances: net worth by month, what is owned and owed, and each account\'s change', screen: 'finances', run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    // Kept months, then the months ahead faded, and net worth's line through both.
    await page.waitForSelector('.fx-worthchart .fx-stackcol:not(.ahead)', { timeout: 5000 });
    await page.waitForSelector('.fx-worthchart .fx-stackcol.ahead', { timeout: 5000 });
    await page.waitForSelector('.fx-worthchart .fx-netline.ahead', { timeout: 5000 });
    const since = (await page.textContent('.fx-figurecard:has(h2:has-text("Since"))')).replace(/\s+/g, '');
    if (!since.includes('SinceJul31') || !since.includes('+$20,298') || !since.includes('+11.4%')) throw new Error(`the change: ${since}`);
    // What is owned and owed, account by account, largest first, each with its change.
    await page.waitForSelector('.fx-ownlist h2:has-text("$498,812")', { timeout: 5000 });
    const owned = await page.$$eval('.fx-ownlist li strong', (l) => l.map((e) => e.textContent));
    if (owned[0] !== 'Home' || !owned.includes('BofA Savings')) throw new Error(`owned: ${owned}`);
    await page.waitForSelector('.fx-ownlist li:has-text("BofA Savings"):has-text("updated today") .fx-change.fx-in', { timeout: 5000 });
    await page.waitForSelector('.fx-owelist li:has-text("Toyota Financial"):has-text("53% of $24,000 paid") .fx-change:has-text("less owed")', { timeout: 5000 });
    // A longer range reads back only as far as balances were kept.
    await page.click('.fx-worthchart [role=radio]:text-is("1 year")');
    await page.waitForSelector('.fx-figurecard h2:has-text("Since Jul 31")', { timeout: 5000 });
  } },
  // A home and its mortgage set the scale, and cash was a sliver: a home or car stands as its equity, and
  // without them what is left gets a scale of its own. Net worth is the same either way.
  { name: 'Finances: net worth by month shows cash, with and without the home and car', screen: 'finances', run: async (page) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await finTab(page, 'Net worth', { timeout: 5000 });
    const cash = () => page.$eval('.fx-worthchart .fx-stackcol.on .fx-seg.fx-h1', (e) => e.getBoundingClientRect().height);
    const tip = async () => {
      const box = await page.locator('.fx-worthchart .fx-stackcol.on').boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      return (await page.textContent('.fx-worthchart .fx-tip', { timeout: 5000 })).replace(/\s+/g, ' ');
    };
    const all = await cash();
    if (all < 8) throw new Error(`cash is ${all.toFixed(1)}px tall with everything`);
    const said = await tip();
    for (const want of ['Home & Car, less their loans$129,860.00', 'Other debts−$1,710.85', 'Net worth$198,461.55']) if (!said.replace(/ /g, '').includes(want.replace(/ /g, ''))) throw new Error(`the month's card: ${said}`);
    await page.mouse.move(0, 0);
    await page.click('.fx-worthchart [role=radio]:text-is("Without Home & Car")');
    const liquid = await cash();
    if (liquid < all * 2.5) throw new Error(`cash is ${liquid.toFixed(1)}px without the home and car, ${all.toFixed(1)}px with`);
    const without = (await tip()).replace(/ /g, '');
    if (!without.includes('NetworthwithoutHome&Car$68,601.55') || without.includes('Home&Car,less')) throw new Error(`the month's card: ${without}`);
  } },
  // The small Net worth card stretches to its row; its chart takes the room, not a gap above Owned and Owed.
  { name: 'Finances: the Net worth card\'s chart fills its card', screen: 'finances', run: async (page) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.waitForSelector('.fx-worthmini .fx-pair', { timeout: 5000 });
    await page.waitForTimeout(300);
    const gap = await page.$eval('.fx-worthmini', (c) => Math.round(c.querySelector('.fx-pair').getBoundingClientRect().top - c.querySelector('.fx-xlabels').getBoundingClientRect().bottom));
    if (gap > 24) throw new Error(`${gap}px between the chart and Owned and Owed`);
  } },
  { name: 'Finances: pointing at a month of net worth shows its card', screen: 'finances', run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    // The net worth line is drawn over the columns; the pointer still reaches them.
    await page.hover('.fx-worthchart .fx-stackcol >> nth=1');
    await page.waitForSelector('.fx-worthchart .fx-tip:has-text("Aug 31"):has-text("Net worth")', { timeout: 5000 });
  } },
  { name: 'Finances: a card paid off is still under what is owed', screen: 'finances', mock: { finances: { ...finances, start: { ...finances.start, amex: 0 }, plan: { ...finances.plan, accounts: finances.plan.accounts.map((a) => (a.id === 'amex' ? { ...a, balance: 0 } : a)) } } }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await page.waitForSelector('.fx-owelist li:has-text("Amex Gold"):has-text("$0.00")', { timeout: 5000 });
    if (await page.isVisible('.fx-ownlist li:has-text("Amex Gold")')) throw new Error('a card paid off is listed as owned');
  } },
  { name: 'Finances: a paycheck\'s deductions show without its gross', screen: 'finances', mock: { finances: { ...finances, plan: { ...finances.plan, people: finances.plan.people.map((e) => (e.id === 'alex' ? { ...e, gross: 0 } : e)) } } }, run: async (page) => {
    await finTab(page, 'Pay', { timeout: 5000 });
    await page.waitForSelector('.fx-person:has-text("Alex") li:has-text("401(k)"):has-text("into Fidelity 401(k)")', { timeout: 5000 });
    if (await page.isVisible('.fx-person:has-text("Alex") li:has-text("Gross")')) throw new Error('a gross of $0 is listed');
  } },
  // A bank's logo, an icon, and a person's initial line up, and so do the
  // names after them (a logo once took the sidebar's .brand margins).
  ...['Dashboard', 'Net worth'].map((view) => ({ name: `Finances, ${view}: logos, icons and initials line up, and the names after them`, screen: 'finances', run: async (page) => {
    await finTab(page, view, { timeout: 5000 });
    await page.waitForTimeout(300);
    const bad = await page.evaluate(() => {
      const out = [];
      for (const m of document.querySelectorAll('#finances .fmark, #finances .fwho:not(.fwho + .fwho)')) {
        const cs = getComputedStyle(m);
        if (m.checkVisibility() && [cs.marginLeft, cs.marginRight, cs.marginBottom].some((v) => v !== '0px')) out.push(`${m.className} has margins ${cs.marginLeft} ${cs.marginRight} ${cs.marginBottom}`);
      }
      // A row that opens what it is holds its logo and name in its button.
      for (const list of document.querySelectorAll('#finances ul.fx-rows')) {
        const lefts = [...list.children].map((li) => li.querySelector(':scope > .rowopen') || li).filter((r) => r.firstElementChild?.matches('.fmark:not(.sm), .fwho:not(.sm)')).map((r) => [r.querySelector('.grow strong')?.textContent, Math.round(r.querySelector('.grow').getBoundingClientRect().left)]);
        const want = lefts[0]?.[1];
        for (const [name, x] of lefts) if (Math.abs(x - want) > 1) out.push(`${name} starts at ${x}px, the first at ${want}px`);
      }
      return out.slice(0, 4);
    });
    if (bad.length) throw new Error(bad.join('; '));
  } })),
  { name: 'Finances: a bill charged to a card', screen: 'finances', run: async (page) => {
    await page.click('#finRoot .toolbar button:text-is("Add a payment")', { timeout: 5000 });
    await page.fill('#finSheet label:has-text("Name") input', 'Hulu');
    await page.fill('#finSheet label:has-text("Amount") input', '18');
    await page.selectOption('#finSheet label:has-text("charged to") select', 'visa');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const hulu = await page.evaluate(() => window.__MOCK.financesSaved?.[0]?.payments.find((x) => x.name === 'Hulu'));
    if (hulu?.from !== 'visa' || hulu.amount !== 18) throw new Error(`saved ${JSON.stringify(hulu)}`);
  } },
  { name: 'Finances: a loan keeps its interest rate', screen: 'finances', run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await acctForm(page, '#finRoot .fx-owelist .rowopen:has(strong:text-is("Toyota Financial"))');
    // The sheet puts its cursor in the first field a frame after it opens; typing before then can land there.
    await page.waitForSelector('#finSheet:not([hidden]) input:focus', { timeout: 5000 });
    await page.fill('#finSheet label:has-text("Interest (APR)") input', '4.9');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const loan = await page.evaluate(() => window.__MOCK.financesSaved?.[0]?.accounts.find((a) => a.id === 'carloan'));
    if (loan?.rate !== 4.9 || loan.updated) throw new Error(`saved ${JSON.stringify(loan)}: the rate, and no new balance date`);
  } },
  // A loan read from its papers: the payments ring, what is paid down, the next payment split, who pays it, and every payment.
  { name: 'Finances: a loan read from its papers, its payments ring', screen: 'finances', mock: { finances: papersMock() }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await page.waitForSelector('.fx-loans li:has-text("Toyota Financial"):has-text("3 of 36 payments made · $221.28 a month: paid off")', { timeout: 5000 });
    await page.click('.fx-loanchart [role=radio]:text-is("Toyota Financial")');
    await page.waitForSelector('.fx-papers .fx-ring[aria-label="3 of 36 payments made"]', { timeout: 5000 });
    const down = await page.textContent('.fx-papersdown');
    if (!/^\$[\d,.]+ of \$6,997\.69 paid down, \d+%$/.test(down)) throw new Error(`paid down: ${down}`);
    await page.waitForSelector('.fx-papersfacts p:has-text("Next, Nov 9, 2026: $221.28 ($"):has-text("pays it down, $"):has-text("is interest).")', { timeout: 5000 });
    await page.waitForSelector('.fx-papersfacts p:has-text("Each month: Car payment $110.64, and $110.64 paid another way.")', { timeout: 5000 });
    if (await page.isVisible('.fx-paperstable')) throw new Error('every payment shown before it is opened');
    await page.click('.fx-papersrows summary');
    const rows = await page.$$eval('.fx-paperstable tbody tr', (rs) => rs.map((r) => r.className));
    if (rows.length !== 36 || rows.slice(0, 3).some((c) => c !== 'fx-made') || rows[3] !== 'fx-nextrow') throw new Error(`rows: ${rows.length}, ${rows.slice(0, 5)}`);
    // Update balances has no box for it: it is worked out.
    await page.click('#finRoot button:has-text("Update balances")');
    await page.waitForSelector('#finSheet .balancelist li:has-text("Toyota Financial") .balpapers:text-is("From its papers")', { timeout: 5000 });
    if (await page.$('#bal-carloan')) throw new Error('a box for a loan read from its papers');
  } },
  // Its form: the papers' fields, what it owes worked out as they are typed, no Owed to type, and all of it saved.
  { name: "Finances: a loan's papers in its form", screen: 'finances', run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await acctForm(page, '#finRoot .fx-owelist .rowopen:has(strong:text-is("Toyota Financial"))');
    await page.waitForSelector('#finSheet:not([hidden]) input:focus', { timeout: 5000 });
    await page.waitForSelector('#finSheet .formsub:has-text("With the day its first payment was due")', { timeout: 5000 });
    // $24,000 at no interest, $400 a month from the first of this month a year ago: thirteen due before today (twelve on the 1st).
    const now = new Date(), first = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const iso = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-01`;
    const made = now.getDate() > 1 ? 13 : 12;
    await page.fill('#finSheet label:has-text("Interest (APR)") input', '');
    await page.fill('#finSheet label:has-text("First payment due") input', iso);
    await page.fill('#finSheet label:has-text("Each payment") input', '400');
    await page.fill('#finSheet label:has-text("Number of payments") input', '60');
    const owes = (24000 - made * 400).toLocaleString('en-US', { minimumFractionDigits: 2 });
    await page.waitForSelector(`#finSheet .formsub:has-text("Owes $${owes} today, after ${made} of 60 payments")`, { timeout: 5000 });
    if (await page.$$eval('#finSheet label.field', (ls) => ls.some((l) => l.firstChild?.textContent === 'Owed'))) throw new Error('Owed asked for with the papers typed in');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const loan = await page.evaluate(() => window.__MOCK.financesSaved?.[0]?.accounts.find((a) => a.id === 'carloan'));
    if (loan?.firstDue !== iso || loan.payment !== 400 || loan.term !== 60 || loan.charge || loan.balance !== 24000 - made * 400 || !loan.updated) throw new Error(`saved ${JSON.stringify({ ...loan, history: undefined })}`);
  } },
  { name: 'Finances: deleting an account asks about the payments that use it', screen: 'finances', run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await acctForm(page, '#finRoot .fx-ownlist .rowopen:has(strong:text-is("BofA Savings"))');
    await page.click('#finSheet button:text-is("Delete")');
    await page.waitForSelector('#finSheet .formerr:has-text("“Savings” uses it")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Delete it and them")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const saved = await page.evaluate(() => window.__MOCK.financesSaved?.[0]);
    if (saved.accounts.some((a) => a.id === 'sav') || saved.payments.some((x) => x.id === 'save')) throw new Error('the savings transfer stayed, now a $200 bill out of checking');
  } },
  // Adding an account: what kind first, in groups with what each is for; then its bank or broker by its mark.
  { name: 'Finances: adding an account starts with what kind, and Change goes back', screen: 'finances', run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await page.click('#finRoot .toolbar button:text-is("Add an account")');
    const groups = await page.$$eval('#finSheet .kindgroup h3', (hs) => hs.map((h) => h.textContent));
    if (groups.join() !== 'Cash,Credit,Investing,What you own') throw new Error(`the groups: ${groups}`);
    await page.waitForSelector('#finSheet button.kindrow:has(strong:text-is("Retirement")):has-text("A 401(k), an IRA")', { timeout: 5000 });
    await page.click('#finSheet button.kindrow:has(strong:text-is("Investment"))');
    await page.waitForSelector('#finSheet h2:text-is("Add an investment account")', { timeout: 5000 });
    await page.waitForSelector('#finSheet .brandsearch:focus', { timeout: 5000 });
    // Brokers first, then the banks.
    const first = await page.$$eval('#finSheet .brandgrid button > span:not(.fmark)', (bs) => bs.slice(0, 3).map((b) => b.textContent));
    if (first.join() !== 'Acorns,Ameriprise,Betterment') throw new Error(`the first brokers: ${first}`);
    await page.click('#finSheet button:text-is("Change")');
    await page.waitForSelector('#finSheet button.kindrow:has(strong:text-is("Checking"))', { timeout: 5000 });
    // Nothing typed: one Cancel closes.
    await page.click('#finSheet button:text-is("Cancel")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
  } },
  // An account kept in another currency: its code, the rate typed in (asked for when missing), its amounts in its own sign.
  { name: 'Finances: an account kept in another currency, at a rate typed in', screen: 'finances', run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await page.click('#finRoot .toolbar button:text-is("Add an account")');
    await page.click('#finSheet button.kindrow:has(strong:text-is("Retirement"))');
    await page.fill('#finSheet label:has-text("Name") input', 'UK pension');
    await page.fill('#finSheet label:has-text("Worth") input, #finSheet label:has-text("Balance") input', '20000');
    await page.fill('#finSheet label:has-text("Currency, if not USD") input', 'gbp');
    await page.waitForSelector('#finSheet .moneyfield > span:text-is("£")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet .formerr:has-text("Type how many USD one GBP is.")', { timeout: 5000 });
    await page.fill('#finSheet label:has-text("1 GBP is, in USD") input', '1.27');
    await page.waitForSelector('#finSheet .formsub:has-text("£20,000.00 is about $25,400.00 at this rate")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const plan = await page.evaluate(() => window.__MOCK.financesSaved.at(-1));
    const a = plan.accounts.find((x) => x.name === 'UK pension');
    if (a?.currency !== 'GBP' || a.balance !== 20000 || plan.rates?.GBP !== 1.27) throw new Error(`saved ${JSON.stringify(a)} ${JSON.stringify(plan.rates)}`);
  } },
  // Transactions on a euro account: each in euros on its row, the month's totals and Reports in dollars at the rate,
  // the export with each amount as typed and its currency.
  { name: 'Finances: transactions in another currency add up at the rate', screen: 'finances', mock: {
    finances: { ...finances, plan: { ...finances.plan, rates: { EUR: 1.1 }, accounts: finances.plan.accounts.map((a) => (a.id === 'sav' ? { ...a, currency: 'EUR' } : a)) } },
    ledger: { ...ledger, transactions: [...ledger.transactions, { id: 'e1', date: '2026-10-29', account: 'sav', amount: -100, payee: 'Boulangerie', category: 'Eating out' }] },
  }, run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.waitForSelector('.fx-txday li:has-text("Boulangerie") .when:has-text("−€100.00")', { timeout: 5000 });
    for (const [stat, want] of [['Money out', '$603'], ['7 transactions', '+$1,797']]) {
      const text = (await page.textContent(`.fx-txsum .fx-stat:has(.fx-caption:has-text("${stat}"))`, { timeout: 5000 })).replace(/\s+/g, '');
      if (!text.includes(want)) throw new Error(`${stat}: ${text}`);
    }
    await finTab(page, 'Reports');
    const out = (await page.textContent('.fx-reportsum .fx-stat:has(.fx-caption:has-text("Money out"))')).replace(/\s+/g, '');
    if (!out.includes('$603')) throw new Error(`Reports' money out: ${out}`);
    await page.waitForSelector('.fx-bycat li:has-text("Food"):has-text("Eating out $110.00")', { timeout: 5000 });
    await page.click('.fx-reportsum button:text-is("Export CSV")');
    await page.waitForSelector('.fx-exported:not(:empty)', { timeout: 5000 });
    const lines = (await page.evaluate(() => window.__MOCK.exported.at(-1).text)).split('\r\n');
    if (!lines[0].endsWith(',Transfer to,Currency') || !lines.includes('2026-10-29,BofA Savings,Boulangerie,Eating out,-100.00,,,,EUR') || !lines.includes("2026-10-24,Chase Checking,Trader Joe's,Groceries,-63.75,,,,USD")) throw new Error(`exported ${JSON.stringify(lines)}`);
  } },
  { name: 'Finances: a bank found by search names the account, and a search alone is not typing', screen: 'finances', run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await page.click('#finRoot .toolbar button:text-is("Add an account")');
    await page.click('#finSheet button.kindrow:has(strong:text-is("Checking"))');
    await page.fill('#finSheet .brandsearch', 'fid');
    const found = await page.$$eval('#finSheet .brandgrid button > span:not(.fmark)', (bs) => bs.map((b) => b.textContent));
    if (found.join() !== 'Fidelity,Another bank') throw new Error(`found ${found}`);
    await page.click('#finSheet button:text-is("Cancel")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    await page.click('#finRoot .toolbar button:text-is("Add an account")');
    await page.click('#finSheet button.kindrow:has(strong:text-is("Checking"))');
    await page.fill('#finSheet .brandsearch', 'fid');
    await page.click('#finSheet .brandgrid button:has-text("Fidelity")');
    await page.fill('#finSheet label:has-text("Balance") input', '1200');
    await page.waitForSelector('#finSheet .formsays:text-is("Fidelity Checking · $1,200.00")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const a = await page.evaluate(() => window.__MOCK.financesSaved?.[0]?.accounts.at(-1));
    if (a?.name !== 'Fidelity Checking' || a.institution !== 'fidelity' || a.kind !== 'checking' || a.balance !== 1200) throw new Error(`saved ${JSON.stringify(a)}`);
  } },
  // A form opens with the logo picked in view, however far down the list it is.
  { name: 'Finances: a form opens with its logo picked in view', screen: 'finances', run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await acctForm(page, '#finRoot .fx-owelist .rowopen:has(strong:text-is("Mortgage"))');
    await page.waitForTimeout(300);
    const seen = await page.$eval('#finSheet .brandgrid', (g) => { const on = g.querySelector('.on').getBoundingClientRect(), r = g.getBoundingClientRect(); return on.top >= r.top - 1 && on.bottom <= r.bottom + 1; });
    if (!seen) throw new Error('Wells Fargo, picked, is scrolled out of sight');
    // With none picked, the grid starts at its top, not at "None" at its end.
    await page.keyboard.press('Escape');
    await page.click('#finRoot .toolbar button:text-is("Add an account")');
    await page.click('#finSheet button.kindrow:has(strong:text-is("Checking"))');
    await page.waitForTimeout(300);
    if (await page.$eval('#finSheet .brandgrid', (g) => g.scrollTop) > 0) throw new Error('a new account opens its banks scrolled down');
  } },
  // Fidelity (no simple-icons mark) stands as its initial on its green, as a bank in no library does.
  { name: 'Finances: Fidelity shows its initial, and a bank with no mark its initials', screen: 'finances', run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    const fid = await page.$eval('.fx-ownlist li:has-text("Fidelity 401(k)") .fmark.logo.mono', (e) => [e.textContent, getComputedStyle(e).backgroundColor]);
    if (fid[0] !== 'F' || fid[1] !== 'rgb(54, 135, 39)') throw new Error(`Fidelity is ${fid}`);
    await page.click('#finRoot .toolbar button:text-is("Add an account")');
    await page.click('#finSheet button.kindrow:has(strong:text-is("Checking"))');
    await page.fill('#finSheet .brandsearch', 'ally');
    await page.waitForSelector('#finSheet .brandgrid button:has-text("Ally") .fmark.mono:text-is("A")', { timeout: 5000 });
  } },
  // Collectibles (cards, jewelry): owned, worth what is typed in, a group of their own.
  { name: 'Finances: add collectibles', screen: 'finances', run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await page.click('#finRoot .toolbar button:text-is("Add an account")');
    await page.click('#finSheet button.kindrow:has(strong:text-is("Collectibles"))');
    if (await page.isVisible('#finSheet .brandpick')) throw new Error('collectibles ask for a bank');
    await page.fill('#finSheet label:has-text("Name") input', 'Pokémon cards');
    await page.fill('#finSheet label:has-text("Worth") input', '2400');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const a = await page.evaluate(() => window.__MOCK.financesSaved?.[0]?.accounts.at(-1));
    if (a?.kind !== 'collectible' || a.balance !== 2400 || a.name !== 'Pokémon cards') throw new Error(`saved ${JSON.stringify(a)}`);
  } },
  { name: 'Finances: collectibles are their own group, with and without the home and car', screen: 'finances', mock: { finances: collected }, run: async (page) => {
    await page.waitForSelector('#finNav .fx-balance:has-text("Collectibles"):has-text("$2.40k")', { timeout: 5000 });
    await finTab(page, 'Net worth');
    await page.waitForSelector('.fx-ownlist li:has-text("Pokémon cards"):has-text("$2,400.00")', { timeout: 5000 });
    await page.waitForSelector('.fx-worthchart .fx-legend li:has-text("Collectibles")', { timeout: 5000 });
    await page.click('.fx-worthchart [role=radio]:text-is("Without Home & Car")');
    await page.waitForSelector('.fx-worthchart .fx-legend li:has-text("Collectibles")', { timeout: 5000 });
    // A payment neither comes out of collectibles nor goes into them.
    await finTab(page, 'Recurring');
    await page.click('#finRoot .toolbar button:text-is("Add a payment")');
    const options = await page.$$eval('#finSheet select option', (os) => os.map((o) => o.textContent));
    if (options.includes('Pokémon cards')) throw new Error('a payment can use collectibles');
  } },
  { name: 'Finances: something typed in as Other can be made collectibles', screen: 'finances', mock: { finances: { ...finances, start: { ...finances.start, ring: 3000 }, plan: { ...finances.plan, accounts: [...finances.plan.accounts, { id: 'ring', name: 'Ring', kind: 'other', balance: 3000 }] } } }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await acctForm(page, '#finRoot .fx-ownlist .rowopen:has(strong:text-is("Ring"))');
    await page.waitForSelector('#finSheet:not([hidden]) input:focus', { timeout: 5000 });
    const picks = await page.$$eval('#finSheet .kindswap [role=radio]', (bs) => bs.map((b) => b.textContent));
    if (picks.join() !== 'Collectibles,Something else') throw new Error(`the kinds offered: ${picks}`);
    await page.click('#finSheet .kindswap [role=radio]:text-is("Collectibles")');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const ring = await page.evaluate(() => window.__MOCK.financesSaved?.[0]?.accounts.find((a) => a.id === 'ring'));
    if (ring?.kind !== 'collectible' || ring.balance !== 3000) throw new Error(`saved ${JSON.stringify(ring)}`);
  } },
  { name: 'Finances: add a car by its make', screen: 'finances', run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await page.click('#finRoot .toolbar button:text-is("Add an account")');
    await page.click('#finSheet button.kindrow:has(strong:text-is("Car"))');
    await page.click('#finSheet .brandgrid button:has-text("Honda")');
    await page.fill('#finSheet label:has-text("Name") input', '2021 CR-V');
    await page.fill('#finSheet label:has-text("Worth") input', '21000');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const car = await page.evaluate(() => window.__MOCK.financesSaved?.[0]?.accounts.at(-1));
    if (car?.kind !== 'car' || car.institution !== 'honda' || car.balance !== 21000) throw new Error(`saved ${JSON.stringify(car)}`);
  } },
  { name: 'Finances: without a checking account, it says so and offers one', screen: 'finances', mock: { finances: { ...finances, checking: '', plan: { ...finances.plan, accounts: finances.plan.accounts.filter((a) => a.kind !== 'checking') } } }, run: async (page) => {
    await page.waitForSelector('.finnote:has-text("No checking account yet")', { timeout: 5000 });
    await page.click('.finnote button:text-is("Add your checking account")');
    // Straight to a checking account's form, past the choice of kind.
    await page.waitForSelector('#finSheet:not([hidden]) h2:text-is("Add a checking account")', { timeout: 5000 });
    if (await page.isVisible('#finSheet button:text-is("Change")')) throw new Error('a checking account offers another kind');
  } },
  { name: 'Finances: balances a week old say so', screen: 'finances', mock: { finances: { ...finances, typed: '2026-10-21' } }, run: async (page) => {
    await page.waitForSelector('#finances .lead.warn:has-text("9 days ago")', { timeout: 5000 });
  } },
  { name: 'Finances: a file that cannot be read says why, and nothing can be added over it', screen: 'finances', mock: { financesError: 'unexpected end of JSON input' }, run: async (page) => {
    await page.waitForSelector('#finRoot .empty:has-text("unexpected end of JSON input")', { timeout: 5000 });
    if (!(await page.isDisabled('#finRoot .toolbar button'))) throw new Error('Add is offered over a file that could not be read');
    await page.click('#finRoot .empty button:text-is("Try again")');
  } },
  { name: 'Finances: a payment without an amount says so and is not saved', screen: 'finances', run: async (page) => {
    await page.click('#finRoot .toolbar button:text-is("Add a payment")', { timeout: 5000 });
    await page.fill('#finSheet label:has-text("Name") input', 'Gym');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet .formerr:has-text("how much")', { timeout: 5000 });
    if (await page.evaluate(() => window.__MOCK.financesSaved)) throw new Error('saved without an amount');
    // Something is typed: the first Escape asks, the second drops it.
    await page.keyboard.press('Escape');
    await page.waitForSelector('#finSheet .formerr:has-text("Nothing here is saved")', { timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
  } },
  { name: 'Finances: a balance box left empty keeps the balance', screen: 'finances', run: async (page) => {
    await page.click('#finRoot .toolbar button:text-is("Update balances")', { timeout: 5000 });
    await page.waitForSelector('#finSheet input#bal-chk:focus', { timeout: 5000 });
    await page.fill('#finSheet input#bal-chk', '');
    await page.fill('#finSheet input#bal-sav', '$7,000.50');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const acc = await page.evaluate(() => window.__MOCK.financesSaved?.[0]?.accounts);
    if (acc?.find((a) => a.id === 'chk').balance !== 2512.4 || acc.find((a) => a.id === 'sav').balance !== 7000.5) throw new Error(`saved ${JSON.stringify(acc?.slice(0, 2))}`);
  } },
  { name: 'Finances: money moved in from savings comes in, and a check into savings says where it goes', screen: 'finances', mock: { finances: movedIn }, run: async (page) => {
    await page.waitForSelector('.fx-paycheck li:has-text("From savings"):has-text("from BofA Savings") .fx-in:has-text("+$500.00")', { timeout: 5000 });
    // It counts toward what the paycheck leaves: $331.86 without it.
    await page.waitForSelector('.fx-paycheck .fx-badge.fx-in:has-text("+$831.86")', { timeout: 5000 });
    await finTab(page, 'Pay');
    await page.waitForSelector('.fx-paydays li:has-text("Sam (into BofA Savings)"):has-text("+$640.00")', { timeout: 5000 });
  } },
  { name: 'Finances: Recurring keeps saving apart from spending', screen: 'finances', run: async (page) => {
    await finTab(page, 'Recurring', { timeout: 5000 });
    // Savings ($200 every 2 weeks) and the Roth IRA ($250) are kept; Alex's 401(k) is kept before the pay.
    for (const [stat, want] of [['Spent', '$5,265'], ['Saved', '$683'], ['Saved', 'plus $397 before pay'], ['Left over', '$1,110']]) {
      const text = (await page.textContent(`.fx-monthsum .fx-stat:has(.fx-caption:has-text("${stat}"))`, { timeout: 5000 })).replace(/\s+/g, '');
      if (!text.includes(want.replace(/\s+/g, ''))) throw new Error(`${stat}: ${text}`);
    }
    await page.click('#finRoot .fx-payments .seg button:has-text("Spending")');
    const names = await page.$$eval('.fx-payments li', (lis) => lis.map((li) => li.querySelector('.grow > strong')?.textContent));
    if (names.join() !== 'Groceries and gas') throw new Error(`Spending shows ${names}`);
  } },
  { name: 'Finances: a payment with no logo picked shows the brand in its name, and a yearly one its next day', screen: 'finances', run: async (page) => {
    await finTab(page, 'Recurring', { timeout: 5000 });
    for (const name of ['AMC A-List', 'Claude Pro']) await page.waitForSelector(`.fx-payments li:has-text("${name}") .fmark.logo`, { timeout: 5000 });
    await page.waitForSelector('.fx-payments li:has-text("Claude Pro") .fx-next:has-text("Oct 23, 2027"):has-text("in 12 months")', { timeout: 5000 });
    if (await page.$('.fx-payments li:has-text("HOA") .fmark.logo')) throw new Error('HOA has a logo: no brand is in its name');
  } },
  // A bill with no brand shows what it is for, read from its name; the checking line's day card shows each mark.
  { name: 'Finances: a payment with no brand shows what it is for, and the day card its marks', screen: 'finances', run: async (page) => {
    await page.locator('.fx-checking .fx-plot').scrollIntoViewIfNeeded({ timeout: 5000 });
    const box = await page.locator('.fx-checking .fx-plot').boundingBox({ timeout: 5000 });
    let found = false;
    for (let x = 2; x < box.width && !found; x += box.width / 62) {
      await page.mouse.move(box.x + x, box.y + box.height / 2);
      found = !!(await page.$('.fx-checking .fx-tip .fx-tiprow:has-text("Mortgage") .fmark.logo'));
    }
    if (!found) throw new Error('no day card shows the mortgage with its logo');
    await page.mouse.move(0, 0);
    await finTab(page, 'Recurring', { timeout: 5000 });
    for (const [name, icon] of [['Internet', 'internet'], ['Water and sewer', 'water'], ['Car insurance', 'insurance'], ['Groceries and gas', 'spending'], ['Electric', 'utilities'], ['HOA', 'home']]) {
      const got = await page.getAttribute(`.fx-payments li:has(.grow > strong:text-is("${name}")) .fmark.icon`, 'data-icon', { timeout: 5000 });
      if (got !== icon) throw new Error(`${name} shows ${got}, not ${icon}`);
    }
  } },
  // The money calendar: today's month first; each day its marks, a bank holiday, checking under the cushion;
  // a day picked says what moves on it, and the keys move day by day and into the next month.
  { name: 'Finances: the calendar shows each day\'s money, and the keys move through it', screen: 'finances', run: async (page) => {
    await finTab(page, 'Calendar', { timeout: 5000 });
    await page.waitForSelector('.fx-calendar h2:has-text("October 2026")', { timeout: 5000 });
    await page.waitForSelector('.fx-dayone h2:has-text("Oct 30, today")', { timeout: 5000 });
    if (!(await page.isDisabled('.fx-calendar button[aria-label="The month before"]'))) throw new Error('the month before today can be shown');
    await page.click('.fx-calendar button[aria-label="The month after"]');
    await page.waitForSelector('.fx-calendar h2:has-text("November 2026")', { timeout: 5000 });
    // Checking is $467.40 after the mortgage on Nov 1, under the $500 cushion.
    await page.waitForSelector('.fx-month td.fx-low button[data-day="2026-11-01"] .fmark.logo', { timeout: 5000 });
    await page.waitForSelector('.fx-month button[data-day="2026-11-11"] .fx-hol:text-is("Veterans Day")', { timeout: 5000 });
    await page.waitForSelector('.fx-month button[data-day="2026-11-26"] .fx-hol:text-is("Thanksgiving")', { timeout: 5000 });
    await page.click('.fx-month button[data-day="2026-11-06"]');
    await page.waitForSelector('.fx-dayone h2:has-text("Nov 6")', { timeout: 5000 });
    await page.waitForSelector('.fx-dayone li:has-text("Alex\'s paycheck") .fwho', { timeout: 5000 });
    await page.waitForSelector('.fx-dayone li:has-text("Savings") .fmark.logo', { timeout: 5000 });
    // Jordan's Nov 26 payday comes the day before Thanksgiving.
    await page.click('.fx-month button[data-day="2026-11-25"]:has(.fx-movedtag)');
    await page.waitForSelector('.fx-dayone .fx-daynote:has-text("Jordan\'s payday moved from Thu, Nov 26: Thanksgiving")', { timeout: 5000 });
    const label = await page.textContent('.fx-month button[data-day="2026-11-06"] .fx-hidden');
    if (!label.includes("Alex's paycheck +$") || !label.includes('checking $')) throw new Error(`Nov 6 reads out as: ${label}`);
    await page.click('.fx-month button[data-day="2026-11-06"]');
    // Nov 6 picked and focused before the keys (they move from the day picked).
    await page.waitForSelector('.fx-month button[data-day="2026-11-06"][aria-pressed=true]:focus', { timeout: 5000 });
    await page.keyboard.press('ArrowRight');
    await page.waitForSelector('.fx-month button[data-day="2026-11-07"][aria-pressed=true]:focus', { timeout: 5000 });
    for (const day of ['14', '21', '28']) {
      await page.keyboard.press('ArrowDown');
      await page.waitForSelector(`.fx-month button[data-day="2026-11-${day}"][aria-pressed=true]:focus`, { timeout: 5000 });
    }
    await page.keyboard.press('ArrowDown');
    await page.waitForSelector('.fx-calendar h2:has-text("December 2026")', { timeout: 5000 });
    await page.waitForSelector('.fx-month button[data-day="2026-12-05"][aria-pressed=true]:focus', { timeout: 5000 });
    await page.waitForSelector('.fx-month button[data-day="2026-12-25"] .fx-hol:text-is("Christmas")', { timeout: 5000 });
    // T, from the day the keys reached, goes back to today, the focus with it.
    await page.keyboard.press('t');
    await page.waitForSelector('.fx-month button[data-day="2026-10-30"][aria-pressed=true]:focus', { timeout: 5000 });
    await page.click('.fx-calendar button[aria-label="The month after"]');
    await page.click('.fx-calendar button:text-is("Today")');
    await page.waitForSelector('.fx-calendar h2:has-text("October 2026")', { timeout: 5000 });
    // A payment's row opens its form.
    await page.click('.fx-calendar button[aria-label="The month after"]');
    await page.click('.fx-month button[data-day="2026-11-03"]');
    await page.click('.fx-dayone li:has-text("Netflix") button');
    await page.waitForSelector('#finSheet:not([hidden]) h2:has-text("Netflix")', { timeout: 5000 });
  } },
  // Further ahead: past the chart's days, a year of what is planned, with no balance; Claude Pro, yearly on Oct 23, shows
  // in October 2027, and the calendar goes no further.
  { name: 'Finances: the calendar reads a year ahead, a yearly renewal in its month', screen: 'finances', run: async (page) => {
    await finTab(page, 'Calendar', { timeout: 5000 });
    await page.waitForSelector('.fx-calendar h2:has-text("October 2026")', { timeout: 5000 });
    for (let i = 0; i < 12; i++) await page.click('.fx-calendar button[aria-label="The month after"]');
    await page.waitForSelector('.fx-calendar h2:has-text("October 2027")', { timeout: 5000 });
    if (!(await page.isDisabled('.fx-calendar button[aria-label="The month after"]'))) throw new Error('the calendar goes past a year');
    await page.waitForSelector('.fx-calendar .fx-lead:has-text("What is planned this month")');
    if (await page.$('.fx-month .fx-daybal')) throw new Error('a balance shows past where checking is read');
    await page.click('.fx-month button[data-day="2027-10-23"]');
    await page.waitForSelector('.fx-dayone li:has-text("Claude Pro"):has-text("$200.00")', { timeout: 5000 });
    await page.waitForSelector('.fx-dayone .fx-daynote:has-text("its balance is not shown")');
    if (await page.$('.fx-dayone .fx-stat')) throw new Error('the day card shows a balance it did not read');
    const label = await page.textContent('.fx-month button[data-day="2027-10-23"] .fx-hidden');
    if (!label.includes('Claude Pro') || label.includes('checking $')) throw new Error(`Oct 23 reads out as: ${label}`);
    // A month in between: the mortgage on the 1st, and the July 4th holiday on its day.
    for (let i = 0; i < 3; i++) await page.click('.fx-calendar button[aria-label="The month before"]');
    await page.waitForSelector('.fx-calendar h2:has-text("July 2027")', { timeout: 5000 });
    await page.waitForSelector('.fx-month button[data-day="2027-07-01"] .fmark', { timeout: 5000 });
    await page.waitForSelector('.fx-month button[data-day="2027-07-05"] .fx-hol', { timeout: 5000 });
    // January 2027 holds both: checking each day to Jan 30, then what is planned.
    for (let i = 0; i < 6; i++) await page.click('.fx-calendar button[aria-label="The month before"]');
    await page.waitForSelector('.fx-calendar .fx-lead:has-text("after it, what is planned")', { timeout: 5000 });
  } },
  // Before today: what the ledger recorded on each day, its payees' marks and the day's total, back to its first month;
  // a day picked lists them, each opening its form; a month before reads what it came to; a transfer is in no total.
  { name: 'Finances: the calendar shows what was recorded on the days before today', screen: 'finances', mock: { ledger: ledgerMonths }, run: async (page) => {
    await finTab(page, 'Calendar', { timeout: 5000 });
    await page.waitForSelector('.fx-dayone h2:has-text("Oct 30, today")', { timeout: 5000 });
    await page.waitForSelector('.fx-month td.fx-past button[data-day="2026-10-28"] .fmark.logo', { timeout: 5000 });
    const bal = await page.textContent('.fx-month button[data-day="2026-10-28"] .fx-daybal');
    if (bal !== '−$48') throw new Error(`Oct 28 shows ${bal}`);
    // Jordan's paycheck is money in; the Roth IRA transfer moves money between the household's own accounts: no total.
    await page.waitForSelector('.fx-month button[data-day="2026-10-26"] .fx-daybal.fx-in:text-is("+$2.40k")', { timeout: 5000 });
    if (await page.$('.fx-month button[data-day="2026-10-27"] .fx-daybal')) throw new Error('a transfer has a total');
    const label = await page.textContent('.fx-month button[data-day="2026-10-28"] .fx-hidden');
    if (!label.includes('Shell −$48.20') || !label.includes('in all')) throw new Error(`Oct 28 reads out as: ${label}`);
    await page.click('.fx-month button[data-day="2026-10-28"]');
    await page.waitForSelector('.fx-dayone .fx-stat:has-text("What your transactions recorded")', { timeout: 5000 });
    await page.click('.fx-dayone li:has-text("Shell") button');
    await page.waitForSelector('#finSheet:not([hidden]) h2:has-text("Shell")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Cancel")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    // The month before: September, read from the ledger, and no further back than its first month (August).
    await page.click('.fx-calendar button[aria-label="The month before"]');
    await page.waitForSelector('.fx-calendar h2:has-text("September 2026")', { timeout: 5000 });
    await page.waitForSelector('.fx-calendar .fx-lead:text-is("What your transactions recorded: 2 payments out, +$2,225.00 in all.")', { timeout: 5000 });
    // A month past is what was recorded, not "so far".
    await page.waitForSelector('.fx-monthone li:has(.grow > strong:text-is("Recorded")):has-text("+$2,225.00")', { timeout: 5000 });
    await page.click('.fx-calendar button[aria-label="The month before"]');
    await page.waitForSelector('.fx-calendar h2:has-text("August 2026")', { timeout: 5000 });
    if (!(await page.isDisabled('.fx-calendar button[aria-label="The month before"]'))) throw new Error('the calendar goes back past the ledger\'s first month');
    await page.click('.fx-calendar button:text-is("Today")');
    await page.waitForSelector('.fx-calendar h2:has-text("October 2026")', { timeout: 5000 });
  } },
  // The month in all, beside the day: its paychecks, its bills, the lowest checking gets (under the cushion, said), and what was
  // recorded so far; the month after has no recorded line. Narrow, it comes before the week list.
  { name: 'Finances: the calendar sums up the month shown', screen: 'finances', run: async (page) => {
    await finTab(page, 'Calendar', { timeout: 5000 });
    const card = '.fx-monthone';
    await page.waitForSelector(`${card} h2:text-is("October in all")`, { timeout: 5000 });
    await page.waitForSelector(`${card} li:has-text("Lowest in checking"):has-text("Sat, Oct 31"):has-text("$2,312.40")`, { timeout: 5000 });
    await page.waitForSelector(`${card} li:has-text("Recorded so far"):has-text("1 in, 5 out"):has-text("+$1,906.95")`, { timeout: 5000 });
    await page.click('.fx-calendar button[aria-label="The month after"]');
    await page.waitForSelector(`${card} h2:text-is("November in all")`, { timeout: 5000 });
    await page.waitForSelector(`${card} li:has-text("Paychecks"):has-text("3 paychecks · Alex, Jordan"):has-text("+$6,700.00")`, { timeout: 5000 });
    await page.waitForSelector(`${card} li:has-text("Lowest in checking"):has-text("Thu, Nov 5, under your $500 cushion"):has-text("$407.91")`, { timeout: 5000 });
    if (await page.$(`${card} li:has-text("Recorded so far")`)) throw new Error('a month ahead says what was recorded');
    await page.setViewportSize({ width: 860, height: 900 });
    await page.waitForSelector('.fx-weeks', { state: 'visible', timeout: 5000 });
    const above = await page.evaluate(() => document.querySelector('.fx-monthone').getBoundingClientRect().top < document.querySelector('.fx-calendar').getBoundingClientRect().top);
    if (!above) throw new Error('narrow, the month in all comes after the week list');
  } },
  // No card alone with half its row empty: the Dashboard's Net worth the whole row; at two columns (1280px) What you own and What you owe side by side and By tag
  // the whole row; at three (1500px), the day picked and the month in all one above the other beside the calendar.
  { name: 'Finances: no card sits alone with half its row empty', screen: 'finances', run: async (page) => {
    const box = (sel) => page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width) }; });
    const row = async (sel) => page.$eval(sel, (e) => { const b = e.parentElement.getBoundingClientRect(), r = e.getBoundingClientRect(); return Math.round(r.right - r.left) / Math.round(b.width); });
    // The Dashboard's Net worth comes after Money flow, which takes its row: it takes its own.
    await page.waitForSelector('.fx-worthmini', { timeout: 5000 });
    if ((await row('.fx-worthmini')) < 0.99) throw new Error('the Dashboard\'s Net worth takes half its row');
    await finTab(page, 'Net worth', { timeout: 5000 });
    const own = await box('.fx-ownlist'), owe = await box('.fx-owelist');
    if (own.y !== owe.y || owe.x <= own.x) throw new Error(`own ${JSON.stringify(own)}, owe ${JSON.stringify(owe)}`);
    await finTab(page, 'Reports');
    await page.waitForSelector('.fx-bytag', { timeout: 5000 });
    if ((await row('.fx-bytag')) < 0.99) throw new Error('By tag takes half its row');
    await page.setViewportSize({ width: 1500, height: 900 });
    await finTab(page, 'Calendar');
    await page.waitForSelector('.fx-monthone', { timeout: 5000 });
    const cal = await box('.fx-calendar'), day = await box('.fx-dayone'), month = await box('.fx-monthone');
    if (day.x !== month.x || month.y <= day.y || day.x <= cal.x + cal.w - 1) throw new Error(`calendar ${JSON.stringify(cal)}, day ${JSON.stringify(day)}, month ${JSON.stringify(month)}`);
  } },
  // Pay's next paychecks month by month, each with how many and what they bring: December has four (Alex's Jan 1 moved
  // to Dec 31), and January, read to its end, is whole.
  { name: 'Finances: the next paychecks by month, each with its total', screen: 'finances', run: async (page) => {
    await finTab(page, 'Pay', { timeout: 5000 });
    const heads = await page.$$eval('.fx-paydays .fx-paymonth h3', (hs) => hs.map((h) => h.textContent.replace(/\s+/g, ' ').trim()));
    const want = ['November · 3 paychecks+$6,700.00', 'December · 4 paychecks+$8,850.00', 'January 2027 · 3 paychecks+$6,700.00'];
    if (JSON.stringify(heads) !== JSON.stringify(want)) throw new Error(`months: ${JSON.stringify(heads)}`);
    await page.waitForSelector('.fx-paymonth[aria-label="December"] li:has-text("Thu, Dec 31"):has-text("New Year")', { timeout: 5000 });
  } },
  // Recurring's payments say what those shown come to a month and a year (All: the typical month's spent and saved
  // together), and follow the filter; Subscriptions has its own summary instead.
  { name: 'Finances: the payments shown say what they come to a month', screen: 'finances', run: async (page) => {
    await finTab(page, 'Recurring', { timeout: 5000 });
    const said = () => page.textContent('.fx-payments .fx-paysum', { timeout: 5000 }).then((t) => t.replace(/\s+/g, ' ').trim());
    if ((await said()) !== "18 payments: about $5,948.10 a month, $71,377 a year, with each card's balance as it is now.") throw new Error(`all: ${await said()}`);
    await page.click('.fx-payments .seg button:has-text("Bills")');
    if (!/^8 payments: about \$[\d,]+\.\d\d a month, \$[\d,]+ a year\.$/.test(await said())) throw new Error(`bills: ${await said()}`);
    await page.click('.fx-payments .seg button:has-text("Subscriptions")');
    if (await page.$('.fx-payments .fx-paytotal')) throw new Error('Subscriptions has a second total');
  } },
  // A Reports row opens what is behind it: a category (a group finds its own, Food its Groceries) or a payee, on Transactions,
  // this month's; a category's line leads with its share of the spending, its own categories after.
  { name: 'Finances: a Reports row opens its transactions', screen: 'finances', run: async (page) => {
    await finTab(page, 'Reports', { timeout: 5000 });
    const sub = (await page.textContent('.fx-bycat li:has(.grow > strong:text-is("Food")) .grow')).replace(/\s+/g, ' ');
    if (!sub.includes('30% of the spending · Groceries $149.85')) throw new Error(`Food says ${sub}`);
    await page.click('.fx-bycat li:has(.grow > strong:text-is("Food")) button');
    await page.waitForSelector('.fx-transactions h2:text-is("2 transactions of 7")', { timeout: 5000 });
    if ((await page.inputValue('.fx-txfilters select[aria-label="Category"]')) !== 'Food' || (await page.inputValue('.fx-txfilters select[aria-label="Month"]')) !== '2026-10') throw new Error('not filtered to Food in October');
    const payees = await page.$$eval('.fx-txday li .grow > strong', (s) => s.map((x) => x.textContent));
    if (JSON.stringify(payees) !== JSON.stringify(['Costco', "Trader Joe's"])) throw new Error(`Food shows ${payees}`);
    await finTab(page, 'Reports');
    await page.click('.fx-payees li:has-text("Shell") button');
    await page.waitForSelector('.fx-transactions h2:text-is("1 transaction of 7")', { timeout: 5000 });
    if ((await page.inputValue('.fx-txsearch')) !== 'Shell') throw new Error('not searched for Shell');
    // Opened again from its tab, Transactions shows everything.
    await finTab(page, 'Calendar');
    await finTab(page, 'Transactions');
    await page.waitForSelector('.fx-transactions h2:text-is("Transactions")', { timeout: 5000 });
  } },
  // The Dashboard's Cash flow and Where it goes each open Recurring, where the typical month is, payment by payment.
  { name: 'Finances: Cash flow and Where it goes open Recurring', screen: 'finances', run: async (page) => {
    for (const card of ['.fx-flow', '.fx-spend']) {
      await finTab(page, 'Dashboard', { timeout: 5000 });
      await page.click(`${card} button[aria-label^="Open Recurring"]`, { timeout: 5000 });
      await page.waitForSelector('#finRoot .seg button:text-is("Recurring")[aria-checked=true], #finRoot .seg button:text-is("Recurring")[aria-pressed=true]', { timeout: 5000 });
      await page.waitForSelector('.fx-monthsum h2:text-is("A typical month")', { timeout: 5000 });
    }
  } },
  // ⌘F on Transactions goes to its search, its words picked to type over; elsewhere on Finances it does nothing.
  { name: 'Keyboard: ⌘F searches Finances’ transactions', screen: 'finances', run: async (page) => {
    await page.waitForSelector('#finances.active', { timeout: 5000 });
    await page.keyboard.press('Meta+f');
    if (await page.evaluate(() => document.activeElement?.matches('input'))) throw new Error('⌘F on the Dashboard went to a box');
    await finTab(page, 'Transactions');
    await page.fill('.fx-txsearch', 'Shell');
    await page.click('.fx-transactions h2');
    await page.keyboard.press('Meta+f');
    await page.waitForSelector('.fx-txsearch:focus', { timeout: 5000 });
    if (await page.evaluate(() => { const b = document.querySelector('.fx-txsearch'); return b.selectionEnd - b.selectionStart; }) !== 5) throw new Error('the words typed before are not picked');
  } },
  // Net worth's paycheck-by-paycheck table, wider than its card: its right edge is shaded while more columns lie past it
  // (a Mac hides its scroll bar), and the shade is gone once scrolled to the end.
  { name: 'Finances: the paycheck-by-paycheck table shows there is more to its right', screen: 'finances', run: async (page) => {
    // A window narrow enough that the table is wider than its card whatever the fonts (CI's are narrower than a Mac's).
    await page.setViewportSize({ width: 900, height: 800 });
    await finTab(page, 'Net worth', { timeout: 5000 });
    const edge = () => page.$eval('.finpostscroll', (e) => {
      const bg = getComputedStyle(e).backgroundImage;
      return { more: e.scrollWidth > e.clientWidth + 1, end: e.scrollLeft + e.clientWidth >= e.scrollWidth - 1, layers: (bg.match(/gradient/g) || []).length, local: getComputedStyle(e).backgroundAttachment };
    });
    const a = await edge();
    if (!a.more || a.end || a.layers !== 2 || !/local/.test(a.local)) throw new Error(`at the start: ${JSON.stringify(a)}`);
    await page.$eval('.finpostscroll', (e) => { e.scrollLeft = e.scrollWidth; });
    if (!(await edge()).end) throw new Error('it does not scroll to its end');
  } },
  // A long ledger (a year of bank files): the newest 200 drawn, Show more for the next 200, the count and totals of every one
  // still; another filter starts again from the newest 200.
  { name: 'Finances: a long ledger draws 200 transactions at a time', screen: 'finances', mock: { ledger: { rev: 'r1', transactions: Array.from({ length: 450 }, (_, i) => ({ id: 'n' + i, date: `2026-${String(10 - Math.floor(i / 60)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`, account: 'chk', amount: -10, payee: i % 2 ? 'Costco' : 'Shell', category: i % 2 ? 'Groceries' : 'Gas' })) } }, run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    const rows = () => page.$$eval('.fx-txday li', (l) => l.length);
    await page.waitForSelector('.fx-txmore:has-text("200 of 450 shown, newest first")', { timeout: 5000 });
    if ((await rows()) !== 200) throw new Error(`${await rows()} drawn`);
    await page.click('.fx-txmore button:text-is("Show 200 more")');
    await page.waitForSelector('.fx-txmore:has-text("400 of 450 shown")', { timeout: 5000 });
    await page.click('.fx-txmore button:text-is("Show 50 more")');
    await page.waitForSelector('.fx-txmore', { state: 'detached', timeout: 5000 });
    if ((await rows()) !== 450) throw new Error(`${await rows()} drawn after all`);
    await page.fill('.fx-txsearch', 'Costco');
    await page.waitForSelector('.fx-transactions h2:text-is("225 transactions of 450")', { timeout: 5000 });
    await page.waitForSelector('.fx-txmore:has-text("200 of 225 shown")', { timeout: 5000 });
    await page.waitForSelector('.fx-txtotal:has-text("−$2,250.00")', { timeout: 5000 });
  } },
  // This month's money out against last month's to the same day (Sep 30: Chipotle and Costco, the return being money in);
  // with no last month in the ledger, nothing is said.
  { name: 'Finances: this month\'s money out against last month to the same day', screen: 'finances', mock: { ledger: ledgerMonths }, run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    const said = (await page.textContent('.fx-txsum .fx-txvs', { timeout: 5000 })).replace(/\s+/g, ' ').trim();
    if (said !== '$293.05 more out than by Sep 30 last month ($200.00).') throw new Error(said);
    await page.waitForSelector('.fx-txvs .fx-out', { timeout: 5000 });
  } },
  { name: 'Finances: no last month, no comparison', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.waitForSelector('.fx-txsum .fx-stat', { timeout: 5000 });
    if (await page.$('.fx-txvs')) throw new Error('it compares with a month that has no transactions');
  } },
  // A plan with only a checking account and no cushion: nothing owed said plainly, A typical month with no dangling dots,
  // and the calendar's key for checking not drawn as under a cushion.
  { name: 'Finances: a new plan, only checking, says so plainly', screen: 'finances', mock: { finances: { ...finances, plan: { accounts: [{ id: 'chk', name: 'Checking', kind: 'checking', balance: 1200, updated: '2026-10-30' }] }, checking: 'chk', periods: finances.periods.slice(0, 1).map((p) => ({ ...p, rows: [], in: 0, out: 0, saved: 0 })), paydays: [], loans: [], goals: [], budgets: [], found: [], investments: undefined } }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await page.waitForSelector('.fx-say:text-is("Nothing owed: no card balance, no loan.")', { timeout: 5000 });
    await finTab(page, 'Recurring');
    const caps = await page.$$eval('.fx-monthsum .fx-caption', (c) => c.map((x) => x.textContent.trim()));
    if (caps.some((c) => /·\s*$/.test(c)) || !caps.includes('In · no paychecks yet')) throw new Error(`captions: ${JSON.stringify(caps)}`);
    await finTab(page, 'Calendar');
    if (await page.$('.fx-callegend .fx-keylow')) throw new Error('with no cushion, the key is drawn as under one');
  } },
  // The checking chart's key names only the marks it has: no bill of $300 or more ahead, no key for one.
  { name: 'Finances: the checking chart keys only what it marks', screen: 'finances', mock: { finances: { ...finances, days: finances.days.map((d) => ({ ...d, events: (d.events || []).filter((e) => e.people?.length || Math.abs(e.amount) < 300) })) } }, run: async (page) => {
    const keys = await page.$$eval('.fx-checking .fx-legend li', (l) => l.map((x) => x.textContent.trim()), { timeout: 5000 });
    if (!keys.includes('Paycheck') || keys.some((k) => k.startsWith('Bill of'))) throw new Error(`keys: ${keys}`);
  } },
  // A payment's form lists its last few from the transactions linked to it, each with how far it was from the plan,
  // and their average when they differ; one with none has no such list.
  { name: 'Finances: a payment\'s form says what it was paid lately', screen: 'finances', mock: { ledger: { ...ledger, transactions: [...ledger.transactions,
    { id: 'e1', date: '2026-08-18', account: 'chk', amount: -140, payee: 'FPL', payment: 'electric' },
    { id: 'e2', date: '2026-09-18', account: 'chk', amount: -131.1, payee: 'FPL', payment: 'electric' },
    { id: 'e3', date: '2026-10-18', account: 'chk', amount: -152.4, payee: 'FPL', payment: 'electric' }] } }, run: async (page) => {
    await finTab(page, 'Recurring', { timeout: 5000 });
    await page.click('.fx-payments li:has(.grow > strong:text-is("Electric")) button');
    await page.waitForSelector('#finSheet .paidlately h3:has-text("Paid lately, $141.17 on average")', { timeout: 5000 });
    const rows = await page.$$eval('#finSheet .paidlately li', (l) => l.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
    if (JSON.stringify(rows) !== JSON.stringify(['Sun, Oct 18FPL$12.40 more$152.40', 'Fri, Sep 18FPL$8.90 less$131.10', 'Tue, Aug 18FPL$140.00'])) throw new Error(`rows: ${JSON.stringify(rows)}`);
    await page.click('#finSheet button:text-is("Cancel")');
    await page.click('.fx-payments li:has(.grow > strong:text-is("Internet")) button');
    await page.waitForSelector('#finSheet:not([hidden]) h2', { timeout: 5000 });
    if (await page.$('#finSheet .paidlately')) throw new Error('a payment never paid lists what it was paid');
  } },
  // The Dashboard's latest transactions: the five newest (today's Costco first, Claude Pro on Oct 23 left out), each opening its form; See all opens
  // Transactions. With no ledger, no card; on a phone allowed only to look, the rows open nothing.
  { name: 'Finances: the Dashboard lists the latest transactions', screen: 'finances', run: async (page) => {
    await page.waitForSelector('.fx-latest li', { timeout: 5000 });
    const rows = await page.$$eval('.fx-latest li .grow', (l) => l.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
    if (JSON.stringify(rows) !== JSON.stringify(['CostcoToday · Groceries · Chase Freedom', 'ShellOct 28 · Gas · Chase Checking', 'Roth IRAOct 27 · Transfer · Chase Checking → Roth IRA', "Jordan's paycheckOct 26 · Income · Chase Checking", "Trader Joe'sOct 24 · Groceries · Chase Checking"])) throw new Error(`rows: ${JSON.stringify(rows)}`);
    await page.click('.fx-latest li:has-text("Shell") button');
    await page.waitForSelector('#finSheet:not([hidden]) h2:has-text("Shell")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Cancel")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    await page.click('.fx-latest button:text-is("See all")');
    await page.waitForSelector('.fx-transactions', { timeout: 5000 });
  } },
  { name: 'The phone, view only: the latest transactions open nothing', screen: 'finances', phone: ['companion', 'finances'], mock: { finances: { ...finances, readOnly: true } }, run: async (page) => {
    await page.waitForSelector('.fx-latest li', { timeout: 5000 });
    if (await page.$('.fx-latest li button')) throw new Error('a row can be opened to change');
  } },
  { name: 'Finances: no ledger, no latest transactions', screen: 'finances', mock: { ledger: { rev: 'r1', transactions: [] } }, run: async (page) => {
    await page.waitForSelector('.fx-paycheck', { timeout: 5000 });
    if (await page.$('.fx-latest')) throw new Error('an empty card of latest transactions');
  } },
  // A day clicked on the checking chart opens it on the calendar (Alex's Nov 6 paycheck, its green mark); the Calendar
  // tab picked after opens on today again.
  { name: 'Finances: a day clicked on the checking chart opens it on the calendar', screen: 'finances', run: async (page) => {
    await page.locator('.fx-checking .fx-mark.fx-h-in').first().scrollIntoViewIfNeeded({ timeout: 5000 });
    const mark = await page.$eval('.fx-checking .fx-mark.fx-h-in', (m) => { const r = m.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, { timeout: 5000 });
    await page.mouse.click(mark.x, mark.y);
    await page.waitForSelector('.fx-calendar h2:has-text("November 2026")', { timeout: 5000 });
    await page.waitForSelector('.fx-dayone h2:text-is("Fri, Nov 6")', { timeout: 5000 });
    await page.waitForSelector('.fx-month button[data-day="2026-11-06"][aria-pressed=true]', { timeout: 5000 });
    await finTab(page, 'Dashboard');
    await finTab(page, 'Calendar');
    await page.waitForSelector('.fx-dayone h2:has-text("Oct 30, today")', { timeout: 5000 });
  } },
  // Spent this month, from the ledger, beside the latest transactions: its total and each category, largest first; a
  // category opens this month's transactions of it.
  { name: 'Finances: the Dashboard says what was spent this month, a category opening its transactions', screen: 'finances', run: async (page) => {
    await page.waitForSelector('.fx-spentmonth .fx-stat:has-text("$493.05")', { timeout: 5000 });
    const rows = await page.$$eval('.fx-spentmonth li .grow', (l) => l.map((x) => x.textContent.trim()));
    if (JSON.stringify(rows) !== JSON.stringify(['Subscriptions', 'Food', 'Utilities', 'Car'])) throw new Error(`rows: ${rows}`);
    const latest = await page.$eval('.fx-latest', (e) => e.getBoundingClientRect().top), spent = await page.$eval('.fx-spentmonth', (e) => e.getBoundingClientRect().top);
    if (latest !== spent) throw new Error('Spent this month is not beside the latest transactions');
    await page.click('.fx-spentmonth li:has-text("Food") button');
    await page.waitForSelector('.fx-transactions h2:text-is("2 transactions of 7")', { timeout: 5000 });
    if ((await page.inputValue('.fx-txfilters select[aria-label="Category"]')) !== 'Food') throw new Error('not filtered to Food');
  } },
  // Cash flow's last six months from the ledger (May to October, August on having transactions), in beside out; a month opens
  // its transactions. With one month alone (the default ledger), none: a typical month already says as much.
  { name: 'Finances: Cash flow shows the last six months, a month opening its transactions', screen: 'finances', mock: { ledger: ledgerMonths }, run: async (page) => {
    await page.waitForSelector('.fx-flow .fx-monthbar', { timeout: 5000 });
    const bars = await page.$$eval('.fx-flow .fx-monthbar', (b) => b.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
    if (bars.length !== 6 || bars[0] !== 'May 2026: $0.00 in, $0.00 out, see its transactions' || bars[4] !== 'Sep 2026: $2,425.00 in, $200.00 out, see its transactions') throw new Error(`bars: ${JSON.stringify(bars)}`);
    await page.click('.fx-flow .fx-monthbar:has-text("Sep 2026")');
    await page.waitForSelector('.fx-transactions h2:text-is("4 transactions of 13")', { timeout: 5000 });
    if ((await page.inputValue('.fx-txfilters select[aria-label="Month"]')) !== '2026-09') throw new Error('not filtered to September');
  } },
  { name: 'Finances: one month of transactions, no six months on Cash flow', screen: 'finances', run: async (page) => {
    await page.waitForSelector('.fx-flow .fx-tiles', { timeout: 5000 });
    if (await page.$('.fx-flow .fx-lastmonths')) throw new Error('six months drawn from one');
  } },
  // Reports' payees: the five largest, then Show all for every one (six in all of the ledger, Costco twice), and Show fewer.
  { name: 'Finances: Reports shows every payee on asking', screen: 'finances', mock: { ledger: ledgerMonths }, run: async (page) => {
    await finTab(page, 'Reports', { timeout: 5000 });
    await page.click('.fx-reportsum button:text-is("All")');
    const count = () => page.$$eval('.fx-payees li', (l) => l.length);
    if ((await count()) !== 5) throw new Error(`${await count()} payees at first`);
    await page.click('.fx-payees button:text-is("Show all 6")');
    if ((await count()) !== 6) throw new Error(`${await count()} payees with all`);
    await page.click('.fx-payees button:text-is("Show fewer")');
    if ((await count()) !== 5) throw new Error(`${await count()} payees with fewer`);
  } },
  // An account's form lists its last balances as kept, newest first, each with how it moved from the one before.
  { name: 'Finances: an account\'s form says its balances lately', screen: 'finances', run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await acctForm(page, '.fx-ownlist li:has-text("Chase Checking") button');
    await page.waitForSelector('#finSheet .paidlately h3:text-is("Balances lately")', { timeout: 5000 });
    const rows = await page.$$eval('#finSheet .paidlately li', (l) => l.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
    if (rows.length !== 6 || rows[0] !== 'Fri, Oct 30+$55.50$2,512.40' || rows[5] !== 'Fri, Sep 25+$30.84$2,333.57') throw new Error(`rows: ${JSON.stringify(rows)}`);
  } },
  // A charge found by what it came to: 86.10 finds Costco, and 2,400 with its comma Jordan's paycheck; Oct 28 finds that day's.
  { name: 'Finances: a transaction found by its amount', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.fill('.fx-txsearch', '86.10');
    await page.waitForSelector('.fx-transactions h2:text-is("1 transaction of 7")', { timeout: 5000 });
    await page.waitForSelector('.fx-txday li:has-text("Costco")', { timeout: 5000 });
    await page.fill('.fx-txsearch', '2,400');
    await page.waitForSelector('.fx-txday li:has-text("Jordan\'s paycheck")', { timeout: 5000 });
    await page.waitForSelector('.fx-transactions h2:text-is("1 transaction of 7")', { timeout: 5000 });
    // And by its day as shown.
    await page.fill('.fx-txsearch', 'oct 28');
    await page.waitForSelector('.fx-txday li:has-text("Shell")', { timeout: 5000 });
    await page.waitForSelector('.fx-transactions h2:text-is("1 transaction of 7")', { timeout: 5000 });
  } },
  // Pay: each person's take-home a year too; one with no gross or deductions typed in says what they would show, with
  // Add them opening the form. None on a phone allowed only to look.
  { name: 'Finances: Pay says a year\'s take-home, and asks for the gross where none is typed', screen: 'finances', run: async (page) => {
    await finTab(page, 'Pay', { timeout: 5000 });
    await page.waitForSelector('.fx-person:has-text("Alex") .fx-caption:text-is("Take-home, each paycheck · about $55,900 a year")', { timeout: 5000 });
    await page.waitForSelector('.fx-person:has-text("Jordan") .fx-caption:text-is("Take-home, each paycheck · about $28,800 a year")', { timeout: 5000 });
    if (await page.$('.fx-person:has-text("Alex") .fx-payhint')) throw new Error('Alex, with a gross, is asked for one');
    await page.click('.fx-person:has-text("Jordan") .fx-payhint button:text-is("Add them")');
    await page.waitForSelector('#finSheet:not([hidden]) h2:text-is("Jordan")', { timeout: 5000 });
  } },
  // Reports' month columns open what is behind them: In and out's September its transactions, and Food's October (the
  // largest category over the year, the trend's first) Food's of October.
  { name: 'Finances: a month on a Reports chart opens its transactions', screen: 'finances', mock: { ledger: ledgerMonths }, run: async (page) => {
    await finTab(page, 'Reports', { timeout: 5000 });
    await page.click('.fx-reportsum button:text-is("3 months")');
    await page.locator('.fx-inout .fx-stackcol').nth(1).click({ timeout: 5000 });
    await page.waitForSelector('.fx-transactions h2:text-is("4 transactions of 13")', { timeout: 5000 });
    if ((await page.inputValue('.fx-txfilters select[aria-label="Month"]')) !== '2026-09') throw new Error('not September');
    await finTab(page, 'Reports');
    await page.waitForSelector('.fx-trend h2:text-is("Food, month by month")', { timeout: 5000 });
    // In Food's own colour, as its rows and its slice are.
    const hue = await page.$eval('.fx-bycat li:has(.grow > strong:text-is("Food")) .fx-catbar', (e) => [...e.classList].find((c) => /^fx-h\d$/.test(c)));
    if (!hue || !(await page.$(`.fx-trend .fx-seg.${hue}`))) throw new Error(`the trend is not in Food's ${hue}`);
    await page.locator('.fx-trend .fx-stackcol').last().click();
    await page.waitForSelector('.fx-transactions h2:text-is("2 transactions of 13")', { timeout: 5000 });
    if ((await page.inputValue('.fx-txfilters select[aria-label="Category"]')) !== 'Food' || (await page.inputValue('.fx-txfilters select[aria-label="Month"]')) !== '2026-10') throw new Error('not Food in October');
  } },
  // A day with more than one in or out says what they came to together; a day with one does not.
  { name: 'Finances: a day of several transactions says its total', screen: 'finances', mock: { ledger: { ...ledger, transactions: [...ledger.transactions, { id: 'x1', date: '2026-10-28', account: 'chk', amount: -12.5, payee: 'Starbucks', category: 'Eating out' }].sort((p, q) => p.date.localeCompare(q.date)) } }, run: async (page) => {
    // In date order, as the ledger is kept (CleanLedger).
    await finTab(page, 'Transactions', { timeout: 5000 });
    const sum = (await page.textContent('.fx-txday[aria-label="Wed, Oct 28"] .fx-txdaysum', { timeout: 5000 })).replace(/\s+/g, ' ').trim();
    if (sum !== '−$60.70 in all that day') throw new Error(`Oct 28: ${sum}`);
    if (await page.$('.fx-txday[aria-label="Thu, Oct 22"] .fx-txdaysum')) throw new Error('a day of one has a total');
  } },
  // Where it goes: every kind its own colour (Cards was Spending's purple, Loans Car's yellow).
  { name: 'Finances: Where it goes draws each kind in a colour of its own', screen: 'finances', run: async (page) => {
    await page.waitForSelector('.fx-spend .fx-spentrows li', { timeout: 5000 });
    const hues = await page.$$eval('.fx-spend .fx-spentrows li', (l) => l.map((x) => [x.querySelector('.grow').textContent, [...x.querySelector('.fx-dot').classList].find((c) => /^fx-h\d$/.test(c))]));
    const seen = new Map();
    for (const [label, hue] of hues) { if (seen.has(hue)) throw new Error(`${label} and ${seen.get(hue)} are both ${hue}`); seen.set(hue, label); }
  } },
  // A narrow Dashboard card puts its ring above the names, so no name breaks mid-word ("Utilitie / s", the owner's
  // screenshot, Nov 12): the ring and its list side by side only where the card, not the window, has the room.
  ...[1000, 1180, 1440].map((w) => ({ name: `Finances: Where it goes and Spent this month break no name mid-word, at ${w}px`, screen: 'finances', run: async (page) => {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForSelector('.fx-spend .fx-spentrows li', { timeout: 5000 });
    const broken = await page.$$eval('.fx-spend .fx-spentrows .grow > strong, .fx-spentmonth .grow > strong, .fx-spentmonth .fx-legendlabel', (els) => els.flatMap((el) => {
      const text = el.firstChild;
      if (!text || text.nodeType !== 3) return [];
      const out = [];
      for (const m of text.data.matchAll(/\S+/g)) {
        const r = document.createRange();
        r.setStart(text, m.index);
        r.setEnd(text, m.index + m[0].length);
        if (new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size > 1) out.push(m[0]);
      }
      return out;
    }));
    if (broken.length) throw new Error(`broken mid-word: ${broken.join(', ')}`);
  } })),
  // Where it goes: a kind opens Recurring on its payments (Cards on Cards; Home, a bill, on Bills).
  { name: 'Finances: a kind on Where it goes opens its payments', screen: 'finances', run: async (page) => {
    await page.click('.fx-spend li:has-text("Cards") button', { timeout: 5000 });
    await page.waitForSelector('.fx-payments .seg button[aria-checked=true]:has-text("Cards"), .fx-payments .seg button[aria-pressed=true]:has-text("Cards")', { timeout: 5000 });
    await finTab(page, 'Dashboard');
    await page.click('.fx-spend li:has-text("Home") button');
    await page.waitForSelector('.fx-payments .seg button[aria-checked=true]:has-text("Bills"), .fx-payments .seg button[aria-pressed=true]:has-text("Bills")', { timeout: 5000 });
  } },
  // A budget opens its transactions: on Transactions, Food's this month (its Groceries); on the Dashboard, Budgets to
  // watch's Subscriptions.
  { name: 'Finances: a budget opens its transactions', screen: 'finances', run: async (page) => {
    await page.click('.fx-budgets li:has-text("Subscriptions") button', { timeout: 5000 });
    await page.waitForSelector('.fx-transactions h2:text-is("1 transaction of 7")', { timeout: 5000 });
    if ((await page.inputValue('.fx-txfilters select[aria-label="Category"]')) !== 'Subscriptions') throw new Error('not Subscriptions');
    await page.click('.fx-transactions button:text-is("Show all")');
    await page.click('.fx-budgets li:has(.grow > strong:text-is("Food")) button');
    await page.waitForSelector('.fx-transactions h2:text-is("2 transactions of 7")', { timeout: 5000 });
    if ((await page.inputValue('.fx-txfilters select[aria-label="Category"]')) !== 'Food' || (await page.inputValue('.fx-txfilters select[aria-label="Month"]')) !== '2026-10') throw new Error('not Food in October');
  } },
  // Recurring's payments soonest first, or by what each costs a month, largest first (the mortgage, then the card paid in
  // full, then groceries every Saturday: $866.67 a month).
  { name: 'Finances: Recurring\'s payments largest first on asking', screen: 'finances', run: async (page) => {
    await finTab(page, 'Recurring', { timeout: 5000 });
    const names = () => page.$$eval('.fx-payments li .grow > strong', (s) => s.map((x) => x.textContent));
    if ((await names())[0] !== 'Groceries and gas') throw new Error(`soonest: ${await names()}`);
    // A payment not monthly says what it comes to a month; a monthly one does not.
    const sub = (name) => page.textContent(`.fx-payments li:has(.grow > strong:text-is("${name}")) .grow`).then((t) => t.replace(/\s+/g, ' '));
    if (!(await sub('Groceries and gas')).includes('Every Saturday · $866.67 a month') || !(await sub('Claude Pro')).includes('Yearly on Oct 23 · $16.67 a month')) throw new Error(`${await sub('Groceries and gas')} | ${await sub('Claude Pro')}`);
    if ((await sub('Netflix')).includes('a month')) throw new Error(await sub('Netflix'));
    await page.selectOption('.fx-payments select[aria-label="Order"]', 'size');
    const big = await names();
    if (JSON.stringify(big.slice(0, 3)) !== JSON.stringify(['Mortgage', 'Chase Freedom', 'Groceries and gas'])) throw new Error(`largest: ${big}`);
  } },
  // A calendar day adds on itself: a day ahead a payment starting on it, a day before today (or today) a transaction on it;
  // a new payment from the header afterwards starts today again.
  { name: 'Finances: a calendar day adds a payment or a transaction on itself', screen: 'finances', run: async (page) => {
    await finTab(page, 'Calendar', { timeout: 5000 });
    await page.click('.fx-calendar button[aria-label="The month after"]');
    await page.click('.fx-month button[data-day="2026-11-12"]');
    await page.click('.fx-dayone button:text-is("Add a payment")');
    await page.waitForSelector('#finSheet:not([hidden]) h2:text-is("Add a payment")', { timeout: 5000 });
    if ((await page.inputValue('#finSheet label:has-text("Next on") input')) !== '2026-11-12') throw new Error(`starts ${await page.inputValue('#finSheet label:has-text("Next on") input')}`);
    await page.click('#finSheet button:text-is("Cancel")');
    await page.click('#finRoot .toolbar button:has-text("Add a payment")');
    await page.waitForSelector('#finSheet:not([hidden]) h2:text-is("Add a payment")', { timeout: 5000 });
    // Today by this machine's clock, as the form's own default (todayISO): on Nov 12 itself the day picked and today are one.
    const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    const next = await page.inputValue('#finSheet label:has-text("Next on") input');
    if (next !== today) throw new Error(`the next form starts ${next}, not today (${today}): the day stuck to it`);
    await page.click('#finSheet button:text-is("Cancel")');
    await page.click('.fx-calendar button:text-is("Today")');
    await page.click('.fx-month button[data-day="2026-10-28"]');
    await page.click('.fx-dayone button:text-is("Add a transaction")');
    await page.waitForSelector('#finSheet:not([hidden]) h2:text-is("Add a transaction")', { timeout: 5000 });
    if ((await page.inputValue('#finSheet label:has-text("Day") input')) !== '2026-10-28') throw new Error(`on ${await page.inputValue('#finSheet label:has-text("Day") input')}`);
  } },
  // Transactions opened from another view has Back to it: from Reports (a payee), and from the Dashboard (See all); picked
  // from its own tab, none.
  { name: 'Finances: Transactions opened from a report or a card goes back to it', screen: 'finances', run: async (page) => {
    await finTab(page, 'Reports', { timeout: 5000 });
    await page.click('.fx-payees li:has-text("Shell") button');
    await page.click('.fx-txfilters button:has-text("Back to Reports")', { timeout: 5000 });
    await page.waitForSelector('.fx-reportsum', { timeout: 5000 });
    await finTab(page, 'Dashboard');
    await page.click('.fx-latest button:text-is("See all")');
    await page.click('.fx-txfilters button:has-text("Back to Dashboard")', { timeout: 5000 });
    await page.waitForSelector('.fx-latest', { timeout: 5000 });
    await finTab(page, 'Transactions');
    await page.waitForSelector('.fx-txfilters', { timeout: 5000 });
    if (await page.$('.fx-txfilters button:has-text("Back to")')) throw new Error('Back from its own tab');
  } },
  // On a phone, a budget's figures take only the room they need: each bar keeps most of the row, the same as the others.
  { name: 'The phone: budgets keep their bars wide', screen: 'finances', phone: ['companion', 'finances'], run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    const bars = await page.$$eval('.fx-budgets .fx-budgetbar', (b) => b.map((x) => Math.round(x.getBoundingClientRect().width)), { timeout: 5000 });
    if (bars.length !== 3 || Math.min(...bars) < 150 || Math.max(...bars) - Math.min(...bars) > 1) throw new Error(`bars ${bars}`);
  } },
  // The Collection (the owner's yes to the mockup, Nov 13): made-up cards in a collectible account worth what they are.
  ...(() => {
    const pokemon = { id: 'pokemon-cards', name: 'Pokémon cards', kind: 'collectible', balance: 417.55, updated: '2026-10-29', history: [{ date: '2026-06-01', amount: 260 }, { date: '2026-10-29', amount: 417.55 }] };
    const collection = [
      { id: 'ember-fox', account: 'pokemon-cards', name: 'Ember Fox', set: 'Set A', number: '4/102', grade: 'Near mint', paid: 45, paidOn: '2025-11-03', price: 182.4, priceOn: '2026-10-29' },
      { id: 'moon-moth', account: 'pokemon-cards', name: 'Moon Moth', grade: 'Graded 9', paid: 120, price: 150, priceOn: '2026-10-02', typed: true },
      { id: 'tide-turtle', account: 'pokemon-cards', name: 'Tide Turtle', set: 'Set A', number: '2/102', paid: 30, price: 64.1, priceOn: '2026-10-29' },
      { id: 'leaf-lizard', account: 'pokemon-cards', name: 'Leaf Lizard', set: 'Set B', number: '44/64', paid: 8.5, price: 11.25, priceOn: '2026-10-29' },
      { id: 'volt-mouse', account: 'pokemon-cards', name: 'Volt Mouse', set: 'Promo', number: '25', paid: 12, price: 9.8, priceOn: '2026-10-29' },
    ];
    const withCards = { finances: { ...finances, plan: { ...finances.plan, accounts: [...finances.plan.accounts, pokemon], collection } } };
    return [
      { name: 'Finances: the Collection lists your cards, and a card opens large', screen: 'finances', mock: withCards, run: async (page) => {
        await finTab(page, 'Collection', { timeout: 5000 });
        await page.waitForSelector('#finRoot .fx-collection .fx-figure, #finRoot .fx-collection .fx-stat', { timeout: 5000 });
        const head = await page.textContent('#finRoot .fx-collection');
        if (!head.includes('5 cards') || !head.includes('$417') || !head.includes('+$202.05') || !head.includes('$215.50')) throw new Error(`the collection says: ${head.replace(/\s+/g, ' ').slice(0, 300)}`);
        const rows = await page.$$eval('#finRoot .fx-cards li .grow > strong', (els) => els.map((e) => e.textContent));
        if (rows.join('|') !== 'Ember Fox|Moon Moth|Tide Turtle|Leaf Lizard|Volt Mouse') throw new Error(`rows: ${rows}`);
        const volt = await page.textContent('#finRoot .fx-cards li:has-text("Volt Mouse")');
        if (!volt.includes('$9.80') || !volt.includes('−$2.20') && !volt.includes('-$2.20')) throw new Error(`Volt Mouse: ${volt}`);
        await page.click('#finRoot .fx-cards li:has-text("Ember Fox") button.rowopen');
        await page.waitForSelector('#finRoot .fx-card h2:text-is("Ember Fox")', { timeout: 5000 });
        const card = await page.textContent('#finRoot .fx-card');
        if (!card.includes('$182') || !card.includes('You paid $45.00') || !card.includes('Set A · 4/102 · Near mint')) throw new Error(`the card's page: ${card.replace(/\s+/g, ' ').slice(0, 300)}`);
        if (!(await page.isVisible('#finRoot .fx-subtabs button[aria-checked="true"]:text-is("Collection")'))) throw new Error('a card is not under the Collection');
        await page.click('#finRoot .fx-card button:text-is("‹ Collection")');
        await page.waitForSelector('#finRoot .fx-cards', { timeout: 5000 });
      } },
      { name: 'Finances: Add a card keeps it in a new Pokémon cards account', screen: 'finances', run: async (page) => {
        await finTab(page, 'Collection', { timeout: 5000 });
        await page.click('#finRoot .fx-collection button:text-is("Add a card")');
        await page.waitForSelector('#finSheet:not([hidden]) h2:text-is("Add a card")', { timeout: 5000 });
        await page.fill('#finSheet label:has-text("Name") input', 'Ember Fox');
        await page.fill('#finSheet label:has-text("Number") input', '4/102');
        await page.fill('#finSheet label:has-text("Paid, each") input', '45');
        await page.fill('#finSheet label:has-text("Worth now, each") input', '182.40');
        await page.click('#finSheet button:text-is("Save")');
        await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
        const saved = await page.evaluate(() => window.__MOCK.financesSaved?.at(-1));
        const acct = saved?.accounts?.find((a) => a.kind === 'collectible' && a.name === 'Pokémon cards');
        const c = saved?.collection?.[0];
        if (!acct || c?.account !== acct.id || c.name !== 'Ember Fox' || c.number !== '4/102' || c.paid !== 45 || c.price !== 182.4 || !/^\d{4}-\d\d-\d\d$/.test(c.priceOn || '')) throw new Error(`saved: ${JSON.stringify({ acct, c })}`);
      } },
      { name: "Finances: a card's own photo, picked in its form, is kept and shown on its page", screen: 'finances', mock: withCards, run: async (page) => {
        await finTab(page, 'Collection', { timeout: 5000 });
        await page.click('#finRoot .fx-cards li:has-text("Ember Fox") button.rowopen');
        await page.click('#finRoot .fx-card button:text-is("Edit")', { timeout: 5000 });
        await page.waitForSelector('#finSheet:not([hidden]) h2:text-is("Ember Fox")', { timeout: 5000 });
        // A made-up photo (a plain 600×840 PNG), picked from a file.
        const png = await page.evaluate(async () => { const c = new OffscreenCanvas(600, 840); c.getContext('2d').fillRect(0, 0, 600, 840); const b = await c.convertToBlob({ type: 'image/png' }); return [...new Uint8Array(await b.arrayBuffer())]; });
        await page.setInputFiles('#finSheet .fx-cardphoto input[type=file]', { name: 'card.png', mimeType: 'image/png', buffer: Buffer.from(png) });
        await page.waitForSelector('#finSheet .fx-cardphoto img.fx-cardpic', { timeout: 5000 });
        const kept = await page.evaluate(() => Object.values(window.__MOCK.cardPictures || {})[0] || '');
        if (!kept.startsWith('data:image/jpeg;base64,')) throw new Error(`kept: ${kept.slice(0, 40)}`);
        await page.click('#finSheet button:text-is("Save")');
        await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
        const saved = await page.evaluate(() => window.__MOCK.financesSaved?.at(-1)?.collection?.find((c) => c.name === 'Ember Fox'));
        if (saved?.picture !== 'ab'.repeat(16) + '.jpg') throw new Error(`the card's picture: ${saved?.picture}`);
        // Its page shows it, read back from the computer, large.
        await page.waitForSelector('#finRoot .fx-card img.fx-cardpic.lg[src^="data:image/jpeg"]', { timeout: 5000 });
      } },
      { name: "Finances: Update prices says what it read, and a card's page draws its price over time", screen: 'finances', mock: withCards, run: async (page) => {
        await finTab(page, 'Collection', { timeout: 5000 });
        await page.click('#finRoot .fx-collection button:text-is("Update prices")');
        await page.waitForSelector('#finRoot .fx-pricesaid:has-text("Updated 3 cards from TCGplayer\'s prices.")', { timeout: 5000 });
        const said = await page.textContent('#finRoot .fx-pricesaid');
        if (!said.includes('Not found: Leaf Lizard (check its name and number).') || !said.includes('More than one printing: Volt Mouse (add its set).') || !said.includes('1 card keeps your own price.')) throw new Error(`said: ${said}`);
        if (await page.evaluate(() => window.__MOCK.calls.FinancesUpdatePrices) !== 1) throw new Error('not asked once');
        await page.click('#finRoot .fx-cards li:has-text("Ember Fox") button.rowopen');
        await page.waitForSelector('#finRoot .fx-cardnow figure[aria-label*="price on each day"]', { timeout: 5000 });
      } },
      { name: 'The phone, view only: the Collection shows, with nothing to add or change', screen: 'finances', phone: ['companion', 'finances'], mock: { finances: { ...withCards.finances, readOnly: true } }, run: async (page) => {
        await finTab(page, 'Collection', { timeout: 5000 });
        await page.waitForSelector('#finRoot .fx-cards li', { timeout: 5000 });
        if (await page.$('#finRoot .fx-collection button:text-is("Add a card")')) throw new Error('a look-only phone can add a card');
        if (await page.$('#finRoot .fx-collection button:text-is("Update prices")')) throw new Error('a look-only phone can update the prices');
        await page.click('#finRoot .fx-cards li:has-text("Ember Fox") button.rowopen');
        await page.waitForSelector('#finRoot .fx-card h2:text-is("Ember Fox")', { timeout: 5000 });
        if (await page.$('#finRoot .fx-card button:text-is("Edit")')) throw new Error('a look-only phone can edit a card');
      } },
    ];
  })(),
  // Step 6 (the owner's yes, Nov 12): Transactions in columns on a wide screen (Payee, Category, Account, Amount, each
  // in line down the rows), sorted by any column from the header above them: Amount most out first, again for most in;
  // Payee A to Z; Date again gives the days back. Narrow (800px, a phone) it is the list as before, no header.
  { name: 'Finances: Transactions in columns, sorted by any of them; the list again when narrow', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.waitForSelector('.fx-txhead button:text-is("Amount")', { timeout: 5000 });
    const left = (sel) => page.$$eval(sel, (els) => [...new Set(els.slice(0, 12).map((e) => Math.round(e.getBoundingClientRect().left)))]);
    for (const col of ['.fx-txcat', '.fx-txacct']) {
      const xs = await left(`.fx-transactions li ${col}`);
      if (xs.length !== 1) throw new Error(`${col} is not in one column: ${xs}`);
    }
    const amounts = () => page.$$eval('.fx-transactions li .when', (els) => els.map((e) => parseFloat(e.textContent.replace(/[−–]/g, '-').replace(/[^0-9.-]/g, ''))));
    await page.click('.fx-txhead button:text-is("Amount")');
    let a = await amounts();
    if (a[0] !== Math.min(...a)) throw new Error(`Amount: the first is ${a[0]}, not the most out (${Math.min(...a)})`);
    if (await page.$('.fx-transactions .fx-txday')) throw new Error('sorted by amount, still by day');
    await page.click('.fx-txhead button:has-text("Amount")');
    a = await amounts();
    if (a[0] !== Math.max(...a)) throw new Error(`Amount again: the first is ${a[0]}, not the most in (${Math.max(...a)})`);
    await page.click('.fx-txhead button:text-is("Payee")');
    const names = await page.$$eval('.fx-transactions li .grow > strong', (els) => els.map((e) => e.textContent.trim().toLowerCase()));
    if (names.some((n, i) => i && names[i - 1].localeCompare(n) > 0)) throw new Error(`Payee: not A to Z: ${names.slice(0, 6)}`);
    await page.click('.fx-txhead button:text-is("Date")');
    await page.waitForSelector('.fx-transactions .fx-txday', { timeout: 5000 });
    await page.setViewportSize({ width: 800, height: 900 });
    await page.waitForTimeout(200);
    if (await page.isVisible('.fx-txhead')) throw new Error('at 800px, a header over the list');
    const xs = await left('.fx-transactions li .fx-txcat');
    const names2 = await left('.fx-transactions li .grow > strong');
    if (xs.length === 1 && xs[0] > names2[0] + 200) throw new Error('at 800px, still in columns');
  } },
  { name: 'The phone: Transactions is the list, no columns to sort', screen: 'finances', phone: ['companion', 'finances'], run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.waitForSelector('.fx-transactions .fx-txday', { timeout: 5000 });
    if (await page.isVisible('.fx-txhead')) throw new Error('a header over the list on a phone');
  } },
  // Step 5 (the owner's yes, Nov 12): the Dashboard looks back as well as ahead. Checking, last 90 days, from the balance
  // typed in through its transactions (the same line as the account's own page): 30 days or a year instead, another
  // account picked, and a day clicked opens it on the calendar. The title opens the account's page.
  { name: 'Finances: the Dashboard looks back at an account, and a day opens on the calendar', screen: 'finances', run: async (page) => {
    await page.waitForSelector('#finRoot .fx-trend h2:text-is("Chase Checking, last 90 days")', { timeout: 5000 });
    // Its last point is today's end, as the account's own page has it.
    const said = await page.getAttribute('#finRoot .fx-trend figure', 'aria-label');
    await page.click('#finRoot .fx-trend .seg button:text-is("A year")');
    await page.waitForSelector('#finRoot .fx-trend h2:text-is("Chase Checking, last year")', { timeout: 5000 });
    await page.selectOption('#finRoot .fx-trend select[aria-label="Account"]', { label: 'BofA Savings' });
    await page.waitForSelector('#finRoot .fx-trend h2:text-is("BofA Savings, last year")', { timeout: 5000 });
    await page.selectOption('#finRoot .fx-trend select[aria-label="Account"]', { label: 'Chase Checking' });
    await page.click('#finRoot .fx-trend .seg button:text-is("90 days")');
    await page.click('#finRoot .fx-trend button.fx-titleopen');
    await page.waitForSelector('#finRoot .fx-account h2:text-is("Chase Checking")', { timeout: 5000 });
    const own = await page.getAttribute('#finRoot .fx-acctbalance figure', 'aria-label');
    const today = (x) => x?.match(/(\S+) today$/)?.[1];
    if (!today(said) || today(said) !== today(own)) throw new Error(`the Dashboard ends at ${today(said)}, the account's page at ${today(own)}`);
    await finTab(page, 'Dashboard');
    // A day near the end (in October, which the calendar holds from the 1st): the one its tip names opens there.
    const plot = page.locator('#finRoot .fx-trend .fx-plot');
    await plot.scrollIntoViewIfNeeded();
    const box = await plot.boundingBox();
    await page.mouse.move(box.x + box.width * 0.86, box.y + box.height / 2);
    const day = await page.textContent('#finRoot .fx-trend .fx-tip strong', { timeout: 5000 });
    await page.mouse.click(box.x + box.width * 0.86, box.y + box.height / 2);
    await page.waitForSelector('#finRoot .seg button[aria-checked="true"]:text-is("Calendar")', { timeout: 5000 });
    const opened = await page.textContent('#finRoot .fx-dayone h2', { timeout: 5000 });
    if (!opened.includes(day.replace(/^\w+, /, ''))) throw new Error(`the tip said ${day}, the calendar opened ${opened}`);
  } },
  // Each Dashboard card that sums something up opens what is behind it from its title (a click or a tap; the keyboard
  // has the ↗ or See all beside it): Spent this month its month's transactions, Cash flow and Where it goes Recurring,
  // Renewing soon the subscriptions, Budgets to watch and Latest transactions Transactions, Checking ahead the calendar,
  // This paycheck Paychecks, Net worth its tab. On the phone's page too, a phone allowed only to look included.
  ...[['the computer', undefined, {}], ['a phone allowed only to look', ['companion', 'finances'], { finances: { ...finances, readOnly: true } }]].map(([where, phone, mock]) => ({ name: `Finances: a Dashboard card's title opens what it sums up, ${where}`, screen: 'finances', phone, mock, run: async (page) => {
    const page2 = (name) => `#finRoot .seg button[aria-checked="true"]:text-is("${name}")`;
    const cards = [
      ['.fx-spentmonth', page2('Transactions'), async () => { if ((await page.inputValue('.fx-txfilters select[aria-label="Month"]')) !== '2026-10') throw new Error('Spent this month: not October'); }],
      ['.fx-flow', page2('Recurring')],
      ['.fx-spend', page2('Recurring')],
      ['.fx-renewing', page2('Recurring')],
      ['.fx-budgets', page2('Transactions')],
      ['.fx-latest', page2('Transactions')],
      ['.fx-checking', page2('Calendar')],
      ['.fx-paycheck', page2('Paychecks')],
      ['.fx-worthmini', page2('Net worth')],
      ['.fx-trend', '#finRoot .fx-account'],
    ];
    for (const [card, there, more] of cards) {
      await finTab(page, 'Dashboard', { timeout: 5000 });
      const title = page.locator(`#finRoot ${card} button.fx-titleopen`);
      if (!(await title.count())) { if (phone && (card === '.fx-latest')) continue; throw new Error(`${card}: its title opens nothing`); }
      await title.scrollIntoViewIfNeeded();
      await title.click({ timeout: 5000 });
      await page.waitForSelector(there, { timeout: 5000 }).catch(() => { throw new Error(`${card}: did not open ${there}`); });
      if (more) await more();
    }
  } })),
  // Budgets with long names, at half width on the Dashboard and on a phone: a line under a name breaks only between its
  // parts (the period, what is spent of what it may take, what came from last time), never inside an amount or "of";
  // what is left and its day's allowance keep one line each; and every bar is as wide as the others, so they line up.
  ...[['the Dashboard at 1100px', undefined], ['a phone', ['companion', 'finances']]].map(([where, phone]) => ({ name: `Finances: budgets with long names keep their figures whole and their bars in line, ${where}`, screen: 'finances', phone, mock: { finances: { ...finances, budgets: [
    { category: 'Restaurants and takeout', per: 'month', start: '2026-10-01', last: '2026-10-31', amount: 600, spent: 570, left: 30, pace: 580.65 },
    { category: 'Streaming and subscriptions', per: 'month', start: '2026-10-01', last: '2026-10-31', amount: 150, spent: 200, left: -50, pace: 145.16 },
    { category: 'Groceries', per: 'month', start: '2026-10-01', last: '2026-10-31', amount: 1200, spent: 1150.5, left: 49.5, pace: 1100, rolled: 125.4 },
    { category: "Kids' activities and school", per: 'paycheck', start: '2026-10-23', last: '2026-11-05', amount: 250, spent: 240, left: 10, pace: 200 },
  ] } }, run: async (page) => {
    if (!phone) await page.setViewportSize({ width: 1100, height: 900 });
    await page.waitForSelector('.fx-budgets .fx-budgetbar', { timeout: 5000 });
    const bad = await page.$$eval('.fx-budgets li', (rows) => {
      const lines = (range) => new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size;
      const out = [];
      for (const li of rows) {
        const name = li.querySelector('.grow > strong')?.textContent;
        const sub = li.querySelector('.grow > .muted');
        // Each amount with the words that join it to the next ("$200.00 of $150.00", "with $125.40 from last time").
        const text = [];
        const walk = document.createTreeWalker(sub, NodeFilter.SHOW_TEXT);
        for (let n = walk.nextNode(); n; n = walk.nextNode()) text.push(n);
        const all = text.map((n) => n.data).join('');
        for (const m of all.matchAll(/\$[\d,.]+ of \$[\d,.]+|\(with \$[\d,.]+ from last time\)|This (month|pay period), to \w+ \d+/g)) {
          const r = document.createRange();
          let at = 0;
          for (const n of text) {
            const end = at + n.data.length;
            if (m.index >= at && m.index < end) r.setStart(n, m.index - at);
            if (m.index + m[0].length > at && m.index + m[0].length <= end) r.setEnd(n, m.index + m[0].length - at);
            at = end;
          }
          if (lines(r) > 1) out.push(`${name}: "${m[0]}" breaks`);
        }
        for (const part of li.querySelectorAll('.fx-budgetday')) {
          const r = document.createRange();
          r.selectNodeContents(part);
          if (lines(r) > 1) out.push(`${name}: "${part.textContent}" breaks`);
        }
      }
      const bars = [...document.querySelectorAll('.fx-budgets .fx-budgetbar')].map((b) => Math.round(b.getBoundingClientRect().width));
      if (Math.max(...bars) - Math.min(...bars) > 1) out.push(`bars ${bars}`);
      return out;
    });
    if (bad.length) throw new Error(bad.join('; '));
  } })),
  // On a phone, Reports' twelve months label every other month, this one always: no two labels touch.
  { name: 'The phone: a twelve-month chart\'s labels do not run together', screen: 'finances', phone: ['companion', 'finances'], run: async (page) => {
    await finTab(page, 'Reports', { timeout: 5000 });
    const shown = await page.$$eval('.fx-trend .fx-barlabels span', (l) => l.filter((x) => getComputedStyle(x).visibility === 'visible').map((x) => { const r = document.createRange(); r.selectNodeContents(x); const b = r.getBoundingClientRect(); return [x.textContent, b.left, b.right]; }), { timeout: 5000 });
    if (shown.at(-1)[0] !== 'Oct') throw new Error(`this month is not labelled: ${JSON.stringify(shown)}`);
    for (let i = 1; i < shown.length; i++) if (shown[i][1] < shown[i - 1][2] + 4) throw new Error(`${shown[i - 1][0]} and ${shown[i][0]} touch`);
  } },
  // A payee linked to a payment before links again, its name saying nothing of it: the HOA, paid as Sunset Palms in
  // September and linked, comes in October ten days early and $5 off. A large amount to the cent links within two weeks
  // (a $412.00 car payment from a lender named nothing like it, eight days off); a small one only within a few days.
  { name: 'Finances: an import links a payee it has linked before, and a large amount to the cent', screen: 'finances', mock: { ledger: { ...ledger, transactions: [{ id: 'h0', date: '2026-09-28', account: 'chk', amount: -310, payee: 'Sunset Palms Eas Sunset Pal', payment: 'hoa' }, ...ledger.transactions] } }, run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-transactions button:text-is("Import a file")');
    const csv = 'Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #\n'
      + 'DEBIT,10/18/2026,"SUNSET PALMS EAS SUNSET PAL FT446739428 WEB ID: 2HOA",-305.00,ACH_DEBIT,1000.00,,\n'
      + 'DEBIT,10/07/2026,"WESTLAKE FIN SVC PMT WEB ID: 77",-412.00,ACH_DEBIT,700.00,,\n'
      + 'DEBIT,10/12/2026,"ACME STREAM 555",-15.49,DEBIT_CARD,600.00,,\n';
    await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'Chase1234_Activity.CSV', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.waitForSelector('#finSheet .importlist li:has-text("Sunset") :text("Looks like HOA")', { timeout: 5000 });
    await page.waitForSelector('#finSheet .importlist li:has-text("Westlake") :text("Looks like Car payment")', { timeout: 5000 });
    // Netflix's $15.49 nine days from its day, by a name saying nothing of it: too small to link by the cents alone that far off.
    if (await page.$('#finSheet .importlist li:has-text("Acme") :text("Looks like")')) throw new Error('a small amount linked far from its day');
  } },
  // The pay period card says checking at the end of payday, once that day's own payments are out (what a spreadsheet
  // counting paychecks against a month of bills comes to), beside the period's end; stepping on, the next payday's.
  { name: 'Finances: the pay period says checking on payday, once its own payments are out', screen: 'finances', run: async (page) => {
    const want = (day) => page.evaluate((d) => '$' + window.__MOCK.finances.days.find((x) => x.date === d).balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), day);
    const said = () => page.textContent('.fx-paycheck .fx-onpayday', { timeout: 5000 }).then((t) => t.replace(/\s+/g, ' ').trim());
    if ((await said()) !== `On payday, Nov 6, once its own payments are out: ${await want('2026-11-06')}`) throw new Error(await said());
    await page.click('#finPeriod button[aria-label="The pay period after"]');
    await page.waitForFunction(() => document.querySelector('.fx-paycheck .fx-onpayday')?.textContent.includes('Nov 20'), null, { timeout: 5000 });
    if ((await said()) !== `On payday, Nov 20, once its own payments are out: ${await want('2026-11-20')}`) throw new Error(await said());
  } },
  // Update balances lists the accounts under their groups, each heading in its colour, the cursor in the first box shown.
  { name: 'Finances: Update balances lists the accounts by group', screen: 'finances', run: async (page) => {
    await page.click('#finRoot .toolbar button:text-is("Update balances")', { timeout: 5000 });
    const heads = await page.$$eval('#finSheet .balgrouphead', (h) => h.map((x) => x.textContent.trim()), { timeout: 5000 });
    if (JSON.stringify(heads) !== JSON.stringify(['Cash', 'Credit cards', 'Investments', 'Home & Car', 'Loans'])) throw new Error(`groups: ${heads}`);
    const cards = await page.$$eval('#finSheet .balgroup:has(.balgrouphead:text-is("Credit cards")) li strong', (s) => s.map((x) => x.textContent));
    if (JSON.stringify(cards) !== JSON.stringify(['Chase Freedom', 'Amex Gold'])) throw new Error(`cards: ${cards}`);
    await page.waitForSelector('#finSheet input#bal-chk:focus', { timeout: 5000 });
  } },
  // A day's cells are the whole of its button: the platform's own table padding once inset every day in its cell.
  { name: 'Finances: a calendar day fills its cell', screen: 'finances', run: async (page) => {
    await finTab(page, 'Calendar', { timeout: 5000 });
    const gap = await page.$eval('.fx-month button[data-day="2026-10-30"]', (b) => { const c = b.parentElement.getBoundingClientRect(), r = b.getBoundingClientRect(); return Math.max(Math.abs(c.top - r.top), Math.abs(c.left - r.left), Math.abs(c.width - r.width)); });
    if (gap > 1) throw new Error(`the day is ${gap}px inside its cell`);
  } },
  // A bill charged to a card moves no checking money, yet shows on its day, on its card and with the card's due day, apart
  // from checking: its mark in the cell, a row in the day's card, and read out; on the phone, in the day's list.
  ...[[false, 'Finances: a card’s charge shows on its day, on its card'], [true, 'The phone: a card’s charge shows in the day’s list']].map(([phone, name]) => ({ name, screen: 'finances', ...(phone ? { phone: ['companion', 'finances'] } : {}),
    mock: { finances: { ...finances, ...(phone ? { readOnly: true } : {}), days: finances.days.map((d) => (d.date === '2026-11-12' ? { ...d, charges: [{ payment: 'spotify', amount: -11.99, card: 'visa', due: '2026-11-21' }] } : d)) } }, run: async (page) => {
    await finTab(page, 'Calendar', { timeout: 5000 });
    await page.click('.fx-calendar button[aria-label="The month after"]');
    if (phone) {
      await page.waitForSelector('.fx-weeks .fx-weekday:has(h3:has-text("Nov 12")) li:has-text("Spotify"):has-text("On Chase Freedom, due Nov 21")', { timeout: 5000 });
      return;
    }
    await page.waitForSelector('.fx-month button[data-day="2026-11-12"] .fx-daymarks > *:nth-child(2)', { timeout: 5000 });
    const label = await page.textContent('.fx-month button[data-day="2026-11-12"] .fx-hidden');
    if (!label.includes('Spotify $11.99 on Chase Freedom, due Nov 21')) throw new Error(`Nov 12 reads out as: ${label}`);
    await page.click('.fx-month button[data-day="2026-11-12"]');
    await page.waitForSelector('.fx-dayone li:has-text("Spotify"):has-text("On Chase Freedom, due Nov 21"):has-text("$11.99")', { timeout: 5000 });
    if (await page.$('.fx-dayone li:has-text("Spotify") .fx-out, .fx-dayone li:has-text("Spotify") .fx-in')) throw new Error('a charge reads as checking money');
  } })),
  { name: 'The phone, the calendar is a list of the days something happens', screen: 'finances', phone: ['companion', 'finances'], mock: { finances: { ...finances, readOnly: true } }, run: async (page) => {
    await finTab(page, 'Calendar', { timeout: 5000 });
    await page.click('.fx-calendar button[aria-label="The month after"]');
    await page.waitForSelector('.fx-weeks .fx-weekday.fx-low h3:has-text("Nov 1")', { timeout: 5000 });
    await page.waitForSelector('.fx-weeks .fx-weekday:has-text("Veterans Day")', { timeout: 5000 });
    await page.waitForSelector('.fx-weeks .fx-weekday:has(h3:has-text("Nov 6")) li:has-text("Alex\'s paycheck")', { timeout: 5000 });
    if (await page.isVisible('.fx-month')) throw new Error('the month grid shows on a phone');
    if (await page.$('.fx-weeks li button')) throw new Error('a phone allowed only to look can open a payment');
  } },
  // The phone's Dashboard opens with the next two weeks of bills (a card's charge on its card, not counted as checking
  // money; savings and paychecks left out), then the goals, short, with See all; the computer's Dashboard is as it was.
  ...[[true, 'The phone: Finances opens with the bills coming up and the goals'], [false, 'Finances: the computer’s Dashboard has no Coming up']].map(([phone, name]) => ({ name, screen: 'finances', ...(phone ? { phone: ['companion', 'finances'] } : {}),
    mock: { finances: { ...finances, days: finances.days.map((d) => (d.date === '2026-11-05' ? { ...d, charges: [{ payment: 'spotify', amount: -11.99, card: 'visa', due: '2026-11-21' }] } : d)) } }, run: async (page) => {
    await page.waitForSelector('#finances.active .fx-paycheck .fx-figure', { timeout: 5000 });
    if (!phone) {
      if (await page.$('#finances .fx-comingup')) throw new Error('Coming up shows on the computer');
      if (await page.$('#finances .fx-board > .fx-goals')) throw new Error('the goals show on the computer’s Dashboard');
      return;
    }
    const first = await page.evaluate(() => [...document.querySelectorAll('#finances .fx-board > .card')].slice(0, 2).map((e) => e.querySelector('h2')?.textContent));
    if (first.join() !== 'Coming up,Goals') throw new Error('the Dashboard opens with ' + first.join(', '));
    // A paycheck is a line of its own (its person's initial leading), before the first bill after its day; the rest are bills.
    const all = await page.$$eval('.fx-comingup li', (ls) => ls.map((l) => ({ pay: !!l.querySelector('.fwhos'), text: l.textContent })));
    const at = all.findIndex((r) => r.pay);
    if (at < 0 || !all[at].text.includes("Alex's paycheck") || !all[at].text.includes('In 7 days, Fri, Nov 6') || !all[at].text.includes('+$2,150.00')
      || !all[at - 1].text.includes('Thu, Nov 5') || !all[at + 1].text.includes('Sat, Nov 7')) throw new Error('the paycheck is not between Nov 5 and Nov 7: ' + all.map((r) => r.text).join(' | '));
    if (!(await page.textContent('.fx-comingup .fx-beforepay')).includes("$2,104.49 of it before Alex's paycheck on Nov 6")) throw new Error('before payday reads ' + await page.textContent('.fx-comingup .fx-beforepay'));
    const rows = all.filter((r) => !r.pay).map((r) => r.text);
    if (!rows.some((r) => r.includes('Mortgage') && r.includes('In 2 days, Sun, Nov 1') && r.includes('$1,845.00'))) throw new Error('no Mortgage in 2 days: ' + rows.join(' | '));
    if (!rows[0].includes('Tomorrow, Sat, Oct 31')) throw new Error('the first is not tomorrow’s: ' + rows[0]);
    if (!rows.some((r) => r.includes('Spotify') && r.includes('on Chase Freedom, due Nov 21') && r.includes('$11.99'))) throw new Error('the card’s charge is not on its card: ' + rows.join(' | '));
    if (rows.some((r) => /Savings|paycheck/.test(r))) throw new Error('savings or a paycheck is listed as a bill');
    if (rows.some((r) => r.includes('Nov 13'))) throw new Error('a bill past the two weeks is listed');
    // The charge is paid with the card, so the total out of checking is the other bills'.
    const stat = await page.textContent('.fx-comingup .fx-stat');
    if (!stat.includes('$2,958.64') || !stat.includes('1 charge on cards')) throw new Error('the total reads ' + stat);
    if (await page.$('.fx-board > .fx-goals .fx-whatif, .fx-board > .fx-goals .fx-goalsshort, .fx-board > .fx-goals button:text-is("Add a goal")')) throw new Error('the Dashboard’s goals ask What if, or add');
    if (!(await page.textContent('.fx-goals li:has-text("Emergency fund")')).includes('$90.16 a paycheck, by Jun 30, 2028')) throw new Error('the goal does not say what it needs a paycheck');
    await page.click('.fx-goals button:text-is("See all")');
    await page.waitForSelector('.fx-whatif', { timeout: 3000 });
    await finTab(page, 'Dashboard');
    await page.click('.fx-comingup button:text-is("Calendar")');
    await page.waitForSelector('.fx-calendar', { timeout: 3000 });
  } })),
  // Nothing due in two weeks, and no goals: it says so, and draws no empty Goals.
  { name: 'The phone: Coming up with nothing due', screen: 'finances', phone: ['companion', 'finances'], mock: { finances: { ...finances, goals: [], days: finances.days.map((d) => ({ ...d, events: (d.events || []).filter((e) => e.people?.length), charges: [] })) } }, run: async (page) => {
    await page.waitForSelector('.fx-comingup:has-text("Nothing due in the next 14 days.")', { timeout: 5000 });
    if (await page.$('#finances .fx-board > .fx-goals')) throw new Error('an empty Goals shows on the Dashboard');
  } },
  // The homelab's own bills show their logos from their names, as typed.
  { name: 'Finances: the homelab\'s bills show their logos', screen: 'finances', mock: { finances: { ...finances, plan: { ...finances.plan, payments: [...finances.plan.payments, ...['Plex Pass', 'Tailscale', 'Cloudflare', 'Hetzner', 'DigitalOcean', 'AWS', 'Namecheap', 'Porkbun', 'Bitwarden', 'Mullvad', 'GitHub Copilot', 'Docker Hub', 'Synology C2', 'Twitch Turbo', 'Discord Nitro'].map((name, i) => ({ id: 'hl' + i, name, amount: 5, kind: 'subscriptions', schedule: { every: 'month', start: '2026-01-02' } }))] } } }, run: async (page) => {
    await finTab(page, 'Recurring', { timeout: 5000 });
    for (const name of ['Plex Pass', 'Tailscale', 'Cloudflare', 'Hetzner', 'DigitalOcean', 'AWS', 'Namecheap', 'Porkbun', 'Bitwarden', 'Mullvad', 'GitHub Copilot', 'Docker Hub', 'Synology C2', 'Twitch Turbo', 'Discord Nitro']) {
      if (!(await page.$(`.fx-payments li:has(.grow > strong:text-is("${name}")) .fmark.logo`))) throw new Error(`${name} has no logo`);
    }
  } },
  // Subscriptions: each a month and a year, dearest first; what renews in a week and a month; yearly against monthly; each one's due day.
  { name: 'Finances: subscriptions, what they cost and when each renews', screen: 'finances', mock: { finances: { ...finances, last: { ...finances.last, spotify: '2026-10-29' } } }, run: async (page) => {
    await finTab(page, 'Recurring', { timeout: 5000 });
    await page.click('#finRoot .fx-payments .seg button:has-text("Subscriptions")');
    // Netflix $15.49, Peloton $44, AMC $29.95, and Spotify $11.99 a month; Claude Pro $200 a year.
    for (const [stat, want] of [['A month', '$118'], ['A year', '$1,417'], ['Renewing in 7 days', '$59'], ['In 30 days', '$101']]) {
      const text = (await page.textContent(`.fx-subs .fx-stat:has(.fx-caption:has-text("${stat}"))`, { timeout: 5000 })).replace(/\s+/g, ' ');
      if (!text.includes(want)) throw new Error(`${stat}: ${text}`);
    }
    await page.waitForSelector('.fx-subsplit:has-text("Paid yearly: 1 subscription, $200 a year. Paid more often: 4, $1,217 a year.")', { timeout: 5000 });
    const names = await page.$$eval('.fx-subs .fx-rows > li', (lis) => lis.map((li) => li.querySelector('.grow > strong')?.textContent));
    if (names.join() !== 'Peloton,AMC A-List,Claude Pro,Netflix,Spotify') throw new Error(`in order: ${names}`);
    for (const [name, due] of [['Netflix', 'In 4 days'], ['Claude Pro', 'Oct 23, 2027'], ['Spotify', 'Just paid']]) await page.waitForSelector(`.fx-subs li:has-text("${name}") .fx-due:has-text("${due}")`, { timeout: 5000 });
    await page.waitForSelector('.fx-subs li:has-text("Claude Pro"):has-text("$17 a month")', { timeout: 5000 });
    await page.click('.fx-subs li:has-text("Peloton") button');
    await page.waitForSelector('#finSheet:not([hidden]) h2:has-text("Peloton")', { timeout: 5000 });
  } },
  // A subscription's type: suggested from its logo or name, picked by hand, kept; its glyph with no brand; the year by type.
  { name: 'Finances: a subscription\'s type is suggested, can be picked, and sums by type', screen: 'finances', mock: { finances: { ...finances, plan: { ...finances.plan, payments: [...finances.plan.payments, { id: 'quest', name: 'Questlog', amount: 4, kind: 'subscriptions', type: 'gaming', schedule: { every: 'month', start: '2026-01-02' } }] } } }, run: async (page) => {
    await finTab(page, 'Recurring', { timeout: 5000 });
    if ((await page.getAttribute('.fx-payments li:has(.grow > strong:text-is("Questlog")) .fmark.icon', 'data-icon', { timeout: 5000 })) !== 'gaming') throw new Error('a gaming subscription with no brand does not show the gaming glyph');
    await page.click('#finRoot .fx-payments .seg button:has-text("Subscriptions")');
    // Netflix, AMC, and Spotify are streaming ($689 a year), Peloton fitness ($528), Claude software ($200), Questlog gaming ($48).
    for (const [type, year] of [['Streaming and music', '$689'], ['Fitness', '$528'], ['Software and apps', '$200'], ['Gaming', '$48']]) await page.waitForSelector(`.fx-subtypes li:has-text("${type}"):has-text("${year}")`, { timeout: 5000 });
    await page.waitForSelector('.fx-subs li:has-text("Claude Pro"):has-text("Software and apps · Yearly")', { timeout: 5000 });
    await page.click('#finRoot .toolbar button:text-is("Add a payment")');
    await page.selectOption('#finSheet label:has-text("Category") select', 'subscriptions');
    await page.fill('#finSheet label:has-text("Name") input', 'Hetzner Cloud');
    await page.waitForSelector('#finSheet label:has-text("Type") option[value=""]:text-is("Cloud and homelab (from its logo)")', { state: 'attached', timeout: 5000 });
    await page.fill('#finSheet label:has-text("Name") input', 'Local news');
    await page.waitForSelector('#finSheet label:has-text("Type") option[value=""]:text-is("News and reading (from its name)")', { state: 'attached', timeout: 5000 });
    await page.selectOption('#finSheet label:has-text("Type") select', 'gaming');
    await page.fill('#finSheet label:has-text("Amount") input', '7');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const saved = await page.evaluate(() => window.__MOCK.financesSaved?.[0]?.payments);
    if (saved?.find((x) => x.name === 'Local news')?.type !== 'gaming') throw new Error(`saved ${JSON.stringify(saved?.find((x) => x.name === 'Local news'))}`);
    if (saved.find((x) => x.id === 'netflix').type !== undefined) throw new Error('a subscription never given a type was saved with one');
  } },
  // One pay period card: whose paycheck and its days, each account after its bills with money in lit, ‹ › and Today;
  // the grid of every account by paycheck is Net worth's, not the dashboard's.
  { name: 'Finances: one pay period card steps through the paychecks, its accounts side by side', screen: 'finances', run: async (page) => {
    await page.waitForSelector('#finPeriod h2:text-is("Alex\'s paycheck · Fri, Nov 6")', { timeout: 5000 });
    // The paycheck's row (a person) and its payments' rows (logos) start their titles at one place.
    const lefts = await page.$$eval('.fx-paycheck .fx-rows > li .grow', (gs) => [...new Set(gs.map((g) => Math.round(g.getBoundingClientRect().left)))]);
    if (lefts.length !== 1) throw new Error(`titles start at ${lefts}`);
    await page.waitForSelector('.fx-paycheck .fx-dates:text-is("Nov 6 – Nov 19")', { timeout: 5000 });
    if (await page.$('#finRoot .finpost, .fx-flow .fx-barcol')) throw new Error('the dashboard still has the grid or the paycheck bars');
    const tile = (name) => `.fx-acctrow li:has(.fx-acctname:has-text("${name}"))`;
    await page.waitForSelector(`${tile('Chase Checking')}:not(.fx-gets) .fx-amount:text-is("$739.77")`, { timeout: 5000 });
    // Alex's Nov 6 check puts $200 into savings and $183 into the 401(k); the Roth gets nothing until the 27th.
    await page.waitForSelector(`${tile('BofA Savings')}.fx-gets .fx-gotin:text-is("$200 in")`, { timeout: 5000 });
    await page.waitForSelector(`${tile('Fidelity 401(k)')}.fx-gets .fx-gotin:text-is("$183 in")`, { timeout: 5000 });
    await page.waitForSelector(`${tile('Roth IRA')}:not(.fx-gets)`, { timeout: 5000 });
    await page.waitForSelector(`${tile('Cards')}`, { timeout: 5000 });
    if (await page.$(`${tile('Mortgage')}, ${tile('Home')}`)) throw new Error('a loan or the home is in the row');
    await page.click('#finPeriod button[aria-label="The pay period after"]');
    await page.click('#finPeriod button[aria-label="The pay period after"]');
    await page.waitForSelector('#finPeriod h2:text-is("Jordan\'s paycheck · Wed, Nov 25")', { timeout: 5000 });
    await page.waitForSelector(`${tile('Roth IRA')}.fx-gets .fx-gotin:text-is("$250 in")`, { timeout: 5000 });
    await page.click('#finPeriod button:text-is("Today")');
    await page.waitForSelector('#finPeriod h2:text-is("Now · until Thu, Nov 5")', { timeout: 5000 });
    // Before now are the paychecks that happened (View.before): ‹ steps back into them.
    if (await page.isDisabled('#finPeriod button[aria-label="The pay period before"]')) throw new Error('no period before now can be picked');
    await finTab(page, 'Net worth');
    await page.waitForSelector('.finpost tbody tr:has(th:has-text("Roth IRA"))', { timeout: 5000 });
  } },
  // Cards paid off in full with each paycheck: each payday into checking pays each card's whole balance (today's on Nov 6,
  // then what went on it since), post-pay checking counts it, and a month's spending counts the cards once.
  { name: 'Finances: cards paid off with each paycheck', screen: 'finances', mock: { finances: paidCards }, run: async (page) => {
    await page.waitForSelector('.fx-paycheck li:has-text("Chase Freedom"):has-text("Nov 6 · Cards"):has-text("−$1,324.65")', { timeout: 5000 });
    await page.waitForSelector('.fx-paycheck li:has-text("Amex Gold"):has-text("−$386.20")', { timeout: 5000 });
    await page.waitForSelector('.fx-paycheck .fx-figure:has-text("−$584")', { timeout: 5000 });
    await page.click('#finPeriod button[aria-label="The pay period after"]');
    await page.waitForSelector('.fx-paycheck li:has-text("Chase Freedom"):has-text("−$450.00")', { timeout: 5000 });
    await finTab(page, 'Recurring');
    // Alex's 26 checks a year and Jordan's 12 into checking: $600 of card spending each, $1,900 a month, not the $1,200 of card payments.
    const spent = (await page.textContent('.fx-monthsum .fx-stat:has(.fx-caption:has-text("Spent"))')).replace(/\s+/g, '');
    if (!spent.includes('$5,965')) throw new Error(`Spent: ${spent}`);
    await page.waitForSelector('.fx-payments li:has-text("Chase Freedom"):has-text("With each paycheck · the card\'s balance")', { timeout: 5000 });
    await page.click('.fx-payments li:has-text("Chase Freedom") button');
    await page.waitForSelector('#finSheet:not([hidden]) h2:text-is("Chase Freedom")', { timeout: 5000 });
    if (!(await page.isChecked('#finSheet label:has-text("I pay it off in full with each paycheck") input'))) throw new Error('the card is not paid off with each paycheck');
    if ((await page.inputValue('#finSheet label:has-text("Spending on it between paychecks") input')) !== '450') throw new Error('its spending is not 450');
  } },
  { name: 'Finances: a card paid off by a payment cannot be paid off with each paycheck too', screen: 'finances', run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await acctForm(page, '.fx-owelist li:has-text("Chase Freedom") button');
    await page.check('#finSheet label:has-text("I pay it off in full with each paycheck") input');
    await page.fill('#finSheet label:has-text("Spending on it between paychecks") input', '450');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet .formerr:has-text("“Chase Freedom” pays it off already")', { timeout: 5000 });
    if (await page.evaluate(() => window.__MOCK.financesSaved?.length)) throw new Error('saved a card paid off twice');
  } },
  // A box ticked by a real click stays ticked: the form drawn again between its input and change events once undid it.
  { name: 'Finances: a box ticked with the mouse stays ticked and is saved', screen: 'finances', run: async (page) => {
    await page.click('#finRoot .toolbar button:text-is("Add a payment")', { timeout: 5000 });
    await page.fill('#finSheet label:has-text("Name") input', 'Electric');
    await page.fill('#finSheet label:has-text("Amount") input', '140');
    await page.click('#finSheet label:has-text("The amount changes each time") input');
    if (!(await page.isChecked('#finSheet label:has-text("The amount changes each time") input'))) throw new Error('the box did not stay ticked');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const saved = await page.evaluate(() => window.__MOCK.financesSaved?.[0]?.payments.at(-1));
    if (!saved?.estimate) throw new Error(`saved ${JSON.stringify(saved)}`);
  } },
  // Saving with each paycheck, whoever is paid; savings and the Roth show today's balance and the one after the paycheck that pays them.
  { name: 'Finances: saving with each paycheck, and the accounts it goes into today and after', screen: 'finances', run: async (page) => {
    await finTab(page, 'Recurring', { timeout: 5000 });
    await page.waitForSelector('.fx-payments li:has(.grow > strong:text-is("Savings")) .fx-kept:text-is("BofA Savings: $6,500.00 today, $6,712.22 after Nov 19")', { timeout: 5000 });
    await page.waitForSelector('.fx-payments li:has(.grow > strong:text-is("Roth IRA")) .fx-kept:text-is("Roth IRA: $14,600.00 today, $14,850.00 after Dec 3")', { timeout: 5000 });
    if (await page.$('.fx-payments li:has(.grow > strong:text-is("Netflix")) .fx-kept')) throw new Error('a bill shows an account it goes into');
    await page.click('#finRoot .toolbar button:text-is("Add a payment")');
    await page.fill('#finSheet label:has-text("Name") input', 'Emergency fund');
    await page.fill('#finSheet label:has-text("Amount") input', '500');
    await page.selectOption('#finSheet label:has-text("Category") select', 'savings');
    await page.selectOption('#finSheet label:has-text("How often") select', { label: 'With each paycheck, whoever is paid' });
    await page.selectOption('#finSheet label:has-text("Goes into") select', { label: 'BofA Savings' });
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const saved = await page.evaluate(() => window.__MOCK.financesSaved?.[0]?.payments.at(-1));
    if (saved?.schedule.every !== 'paycheck' || saved.schedule.person || saved.to !== 'sav') throw new Error(`saved ${JSON.stringify(saved)}`);
  } },
  // An account's logo comes from its name as it is typed, a car's from its model, until one is picked; None picked by hand stays.
  { name: 'Finances: an account picks its logo from its name, a car from its model', screen: 'finances', mock: { finances: { ...finances, plan: { ...finances.plan, accounts: [...finances.plan.accounts, { id: 'cx5', name: '2021 CX-5', kind: 'car', balance: 21000 }, { id: 'fund', name: 'Model 3 fund', kind: 'savings', balance: 900 }] } } }, run: async (page) => {
    await finTab(page, 'Net worth', { timeout: 5000 });
    await page.waitForSelector('.fx-ownlist li:has-text("2021 CX-5") .fmark.logo', { timeout: 5000 });
    if (await page.$('.fx-ownlist li:has-text("Model 3 fund") .fmark.logo')) throw new Error('a savings account took a car make from a model name');
    const picked = () => page.textContent('#finSheet .brandgrid button[aria-checked=true] > span:not(.fmark)');
    for (const [kind, name, want] of [['Checking', 'Chase Checking', 'Chase'], ['Credit card', 'Amex Platinum', 'American Express'], ['Retirement', 'Fidelity 401(k)', 'Fidelity'], ['Savings', 'BofA Savings', 'Bank of America'], ['Car', 'Ford F-150', 'Ford'], ['Car', 'My CX-5', 'Mazda']]) {
      await page.click('#finRoot .toolbar button:text-is("Add an account")');
      await page.click(`#finSheet button.kindrow:has(strong:text-is("${kind}"))`);
      await page.fill('#finSheet label:has-text("Name") input', name);
      if ((await picked()).trim() !== want) throw new Error(`${name} picked ${await picked()}, not ${want}`);
      await page.click('#finSheet button:text-is("Cancel")');
      if (await page.isVisible('#finSheet')) await page.click('#finSheet button:text-is("Cancel")');
      await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    }
    // None by hand stays None while the name goes on being typed, and is kept.
    await page.click('#finRoot .toolbar button:text-is("Add an account")');
    await page.click('#finSheet button.kindrow:has(strong:text-is("Checking"))');
    await page.fill('#finSheet label:has-text("Name") input', 'Chase');
    await page.click('#finSheet .brandgrid button:has-text("Another bank")');
    await page.fill('#finSheet label:has-text("Name") input', 'Chase joint checking');
    if ((await picked()).trim() !== 'Another bank') throw new Error(`None picked by hand became ${await picked()}`);
    await page.fill('#finSheet label:has-text("Balance") input', '10');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const saved = await page.evaluate(() => window.__MOCK.financesSaved?.[0]?.accounts.at(-1));
    if (saved?.institution !== 'none') throw new Error(`saved ${JSON.stringify(saved)}`);
  } },
  // More institutions: a mark from simple-icons, or initials on the brand's colour where it has none (Fidelity, GEICO);
  // a brand that is an everyday word is read only from a name that is the brand ("Delta Dental" is no airline).
  { name: 'Finances: more institutions, initials where there is no mark, and no airline in Delta Dental', screen: 'finances', mock: { finances: { ...finances, plan: { ...finances.plan, payments: [...finances.plan.payments, ...['GEICO', 'State Farm', 'Steam', 'Delta Dental', 'Farmers market', 'Rocket Mortgage', 'Spectrum internet', 'Box plan'].map((name, i) => ({ id: 'more' + i, name, amount: 5, kind: 'other', schedule: { every: 'month', start: '2026-01-02' } }))] } } }, run: async (page) => {
    await finTab(page, 'Recurring', { timeout: 5000 });
    const mark = (name) => `.fx-payments li:has(.grow > strong:text-is("${name}")) .fmark`;
    for (const [name, sel] of [['GEICO', '.logo.mono'], ['State Farm', '.logo.mono.two'], ['Steam', '.logo:not(.mono)'], ['Rocket Mortgage', '.logo.mono'], ['Spectrum internet', '.logo:not(.mono)'], ['Box plan', '.logo']]) {
      if (!(await page.$(mark(name) + sel))) throw new Error(`${name} has no ${sel}`);
    }
    for (const name of ['Delta Dental', 'Farmers market']) if (await page.$(mark(name) + '.logo')) throw new Error(`${name} took a brand's logo`);
    // Fidelity's is its initial on its green, not a picture.
    await finTab(page, 'Net worth');
    if ((await page.textContent('.fx-ownlist li:has-text("Fidelity 401(k)") .fmark.logo.mono')).trim() !== 'F') throw new Error('Fidelity is not its initial');
    if (await page.$('#finRoot .fmark.art')) throw new Error('a logo is still a picture');
  } },
  // Your own image for a brand: picked from a file, made small on this device, kept in the plan, and drawn
  // everywhere the brand is; one for a payment with no brand goes by its name; Remove takes it out.
  { name: 'Finances: your own image for a logo, kept and shown wherever the brand is', screen: 'finances', run: async (page) => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAEklEQVR4nGM4IafxHx9mGBkKAJwVg0EdiZhbAAAAAElFTkSuQmCC', 'base64');
    await finTab(page, 'Net worth', { timeout: 5000 });
    await acctForm(page, '.fx-ownlist li:has-text("Chase Checking") button');
    await page.click('#finSheet .ownlogo button:text-is("Use your own image for Chase")');
    await page.setInputFiles('#finSheet .ownlogo input[type=file]', { name: 'chase.png', mimeType: 'image/png', buffer: png });
    await page.waitForSelector('#finSheet .formhead .fmark.own img', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const saved = await page.evaluate(() => window.__MOCK.financesSaved?.[0]?.logos);
    if (!/^data:image\/png;base64,/.test(saved?.chase || '')) throw new Error(`saved ${JSON.stringify(saved)?.slice(0, 80)}`);
    // A payment with no brand keeps one by its name.
    await finTab(page, 'Recurring');
    await page.click('.fx-payments li:has(.grow > strong:text-is("HOA")) button');
    await page.click('#finSheet .ownlogo button:text-is("Use your own image for HOA")');
    await page.setInputFiles('#finSheet .ownlogo input[type=file]', { name: 'hoa.png', mimeType: 'image/png', buffer: png });
    await page.waitForSelector('#finSheet .formhead .fmark.own img', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const hoa = await page.evaluate(() => window.__MOCK.financesSaved?.at(-1)?.logos);
    if (!hoa?.['name:hoa'] || !hoa.chase) throw new Error(`saved ${Object.keys(hoa || {})}`);
  } },
  { name: 'Finances: a brand\'s own image shows on every row of it, and Remove takes it out', screen: 'finances', mock: { finances: { ...finances, plan: { ...finances.plan, logos: { chase: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAEklEQVR4nGM4IafxHx9mGBkKAJwVg0EdiZhbAAAAAElFTkSuQmCC' } } } }, run: async (page) => {
    await page.waitForSelector('.fx-acctrow li:has(.fx-acctname:has-text("Chase Checking")) .fmark.own img', { timeout: 5000 });
    if (await page.$('.fx-acctrow li:has(.fx-acctname:has-text("BofA Savings")) .fmark.own')) throw new Error('another brand took the image');
    // The Chase Freedom card's payment is Chase's too.
    await finTab(page, 'Recurring');
    await page.waitForSelector('.fx-payments li:has(.grow > strong:text-is("Chase Freedom")) .fmark.own img', { timeout: 5000 });
    await finTab(page, 'Net worth');
    await acctForm(page, '.fx-owelist li:has-text("Chase Freedom") button');
    await page.click('#finSheet .ownlogo button:text-is("Remove your image")');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const saved = await page.evaluate(() => window.__MOCK.financesSaved?.[0]);
    if (saved?.logos?.chase) throw new Error('the image is still kept');
  } },
  // The logo test sheet: a row for every logo, and rows with none. Each mark is the same size and its drawing
  // centred in it, initials fit their tile, and every row's title starts at the same place.
  ...[[1280, 'desktop'], [390, 'phone']].map(([w, label]) => ({ name: `Finances: every logo on one sheet, the same size, centred, and lined up (${label})`, screen: 'finances', phone: w < 500 ? ['companion', 'finances'] : undefined, mock: { finances: logoSheet }, run: async (page) => {
    await page.setViewportSize({ width: w, height: 900 });
    await finTab(page, 'Recurring', { timeout: 5000 });
    await page.waitForSelector('.fx-payments li:has(.grow > strong:text-is("Questlog"))', { timeout: 5000 });
    const bad = await page.evaluate(() => {
      const out = [];
      const rows = [...document.querySelectorAll('.fx-payments .fx-rows > li')];
      const lefts = new Set();
      for (const li of rows) {
        const name = li.querySelector('.grow > strong')?.textContent;
        const m = li.querySelector('.fmark');
        if (!m) { out.push(`${name}: no mark`); continue; }
        const r = m.getBoundingClientRect();
        if (Math.round(r.width) !== 32 || Math.round(r.height) !== 32) out.push(`${name}: ${r.width}×${r.height}`);
        const inner = m.querySelector('svg, img') || m;
        const ir = inner === m ? (() => { const g = document.createRange(); g.selectNodeContents(m); return g.getBoundingClientRect(); })() : inner.getBoundingClientRect();
        const dx = Math.abs(ir.left + ir.width / 2 - (r.left + r.width / 2)), dy = Math.abs(ir.top + ir.height / 2 - (r.top + r.height / 2));
        if (dx > 1.5 || dy > 2) out.push(`${name}: off centre by ${dx.toFixed(1)}, ${dy.toFixed(1)}`);
        if (m.classList.contains('mono') && (m.scrollWidth > m.clientWidth || ir.width > r.width - 4)) out.push(`${name}: its initials do not fit (${ir.width.toFixed(1)}px)`);
        if (m.classList.contains('mono') && parseFloat(getComputedStyle(m).fontSize) < 10) out.push(`${name}: initials at ${getComputedStyle(m).fontSize}`);
        lefts.add(Math.round(li.querySelector('.grow').getBoundingClientRect().left));
      }
      if (lefts.size > 1) out.push(`titles start at ${[...lefts].join(', ')}`);
      return [rows.length, out];
    });
    if (bad[0] < 290) throw new Error(`the sheet has ${bad[0]} rows`);
    if (bad[1].length) throw new Error(bad[1].slice(0, 6).join('; ') + (bad[1].length > 6 ? `; and ${bad[1].length - 6} more` : ''));
    if (process.env.SMOKE_SHOTS) {
      mkdirSync(process.env.SMOKE_SHOTS, { recursive: true });
      const scheme = await page.evaluate(() => (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
      await page.locator('.fx-payments').screenshot({ path: join(process.env.SMOKE_SHOTS, `logo-sheet-${label}-${scheme}.png`) });
    }
  } })),
  // A brokerage, a Roth IRA, and a 401(k) are one group, Investments; the home and car are Home & Car.
  { name: 'Finances: Investments holds the brokerage, the IRA, and the 401(k)', screen: 'finances', run: async (page) => {
    const groups = await page.$$eval('#finNav .fx-balance', (ls) => ls.map((l) => l.textContent.replace(/\s+/g, ' ').trim()));
    if (!groups.some((g) => g.includes('Investments') && g.includes('$61.3k')) || groups.some((g) => g.includes('Retirement'))) throw new Error(`the groups: ${groups}`);
    if (!groups.some((g) => g.includes('Home & Car'))) throw new Error(`the groups: ${groups}`);
  } },
  // The sidebar's balances show on every screen, not only on Finances; a group opens Finances › Net worth.
  { name: 'The sidebar shows the balances on every screen, and a group opens Net worth', screen: 'status', run: async (page) => {
    await page.waitForSelector('#finNav .fx-balance:has-text("Investments")', { state: 'visible', timeout: 5000 });
    if (!(await page.textContent('#finNav')).includes('Net worth')) throw new Error(`the sidebar: ${await page.textContent('#finNav')}`);
    await page.click('#finNav .fx-balance:has-text("Investments")');
    await page.waitForSelector('#finances.active #finRoot .seg button.on:text-is("Net worth")', { timeout: 5000 });
  } },
  // Resting on a group in the sidebar (or Tab to it) shows its accounts beside it: each balance, how long since it was
  // updated, and a dot on one older than a month; the click still opens Net worth, and hidden amounts stay hidden there.
  { name: 'A sidebar balance shows its accounts on hover, and how long since each was updated', screen: 'status',
    mock: { finances: { ...finances, plan: { ...finances.plan, accounts: finances.plan.accounts.map((a) => (a.id === 'k401' ? { ...a, updated: '2026-09-10' } : a)) } } }, run: async (page) => {
    const inv = '#finNav .fx-balance:has-text("Investments")';
    await page.waitForSelector(inv, { state: 'visible', timeout: 5000 });
    const tipOf = (sel) => page.$eval(sel, (b) => b.getAttribute('aria-describedby'));
    const id = await tipOf(inv);
    if (await page.isVisible(`#${id}`)) throw new Error('a card shows before any hover');
    await page.hover(inv);
    const card = page.locator(`#${id}[role=tooltip]`);
    await card.waitFor({ state: 'visible', timeout: 3000 });
    const rows = (await card.locator('.fx-hoveracct').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    if (rows.length !== 3) throw new Error(`rows: ${rows.join(' | ')}`);
    if (!rows.some((r) => r.startsWith('Robinhood') && /\$[\d,]+ updated 2 days ago$/.test(r))) throw new Error(`Robinhood: ${rows.join(' | ')}`);
    if (!rows.some((r) => r.startsWith('Fidelity 401(k)') && /updated Sep 10, over a month ago$/.test(r))) throw new Error(`Fidelity: ${rows.join(' | ')}`);
    if (await card.locator('.fx-hoveracct.stale .fx-staledot').count() !== 1) throw new Error('not one account marked as old');
    if (!/One is over a month old/.test(await card.innerText())) throw new Error('no word on the old one: ' + await card.innerText());
    if (/Checking|Savings|Mortgage/.test(await card.innerText())) throw new Error('another group’s account in it');
    // Beside the button, in the window, and nothing over it; the button's name is still its own.
    const placed = await page.evaluate((c) => {
      const r = document.querySelector(`[aria-describedby="${c}"]`).getBoundingClientRect(), k = document.getElementById(c).getBoundingClientRect();
      const hit = document.elementFromPoint(k.left + k.width / 2, k.top + k.height / 2);
      return k.left >= r.right && k.right <= innerWidth && k.bottom <= innerHeight && document.getElementById(c).contains(hit);
    }, id);
    if (!placed) throw new Error('the card is not beside the button, or is cut off or covered');
    if (/updated/.test(await page.textContent(inv))) throw new Error('the card is in the button’s name');
    await page.mouse.move(600, 400);
    await card.waitFor({ state: 'hidden', timeout: 2000 });
    // Tab reaches it; Escape closes it.
    await page.focus(inv);
    await card.waitFor({ state: 'visible', timeout: 2000 });
    await page.keyboard.press('Escape');
    await card.waitFor({ state: 'hidden', timeout: 2000 });
    // The click still opens Net worth.
    await page.click(inv);
    await page.waitForSelector('#finances.active #finRoot .seg button.on:text-is("Net worth")', { timeout: 5000 });
  } },
  { name: 'With amounts hidden, a balance’s hover hides them too', screen: 'status', mock: { finances: { ...finances, plan: { ...finances.plan, hideAmounts: true } } }, run: async (page) => {
    const cash = '#finNav .fx-balance:has-text("Cash")';
    await page.waitForSelector(cash, { state: 'visible', timeout: 5000 });
    await page.hover(cash);
    const id = await page.$eval(cash, (b) => b.getAttribute('aria-describedby'));
    await page.waitForSelector(`#${id}`, { state: 'visible', timeout: 3000 });
    const shown = await page.$$eval(`#${id} .fx-amount`, (a) => a.map((e) => [e.classList.contains('fx-masked'), e.textContent]));
    if (!shown.length || shown.some(([m, t]) => !m || /\d/.test(t))) throw new Error('amounts show: ' + JSON.stringify(shown));
  } },
  // A balance opens its own group: Net worth on Investments alone, each of its accounts a band of its own month by month
  // (its history), only its accounts listed, and Show everything back to all of them; another view forgets it.
  { name: 'A sidebar balance opens Net worth on its own group, each account month by month', screen: 'status', run: async (page) => {
    await page.click('#finNav .fx-balance:has-text("Investments")', { timeout: 5000 });
    const card = page.locator('#finRoot .fx-groupcard');
    await card.waitFor({ timeout: 5000 });
    if (!(await card.locator('h2').textContent()).startsWith('Investments')) throw new Error(`the card: ${await card.locator('h2').textContent()}`);
    const legend = (await card.locator('.fx-legend li').allTextContents()).map((t) => t.trim());
    for (const name of ['Robinhood', 'Roth IRA', 'Fidelity 401(k)']) if (!legend.includes(name)) throw new Error(`no ${name} in the legend: ${legend}`);
    if (legend.some((n) => /Checking|Savings|Amex|Mortgage/.test(n))) throw new Error(`another group's account in it: ${legend}`);
    const listed = await page.$$eval('#finRoot .fx-ownlist li strong', (s) => s.map((e) => e.textContent.trim()));
    if (listed.some((n) => /Checking|Savings/.test(n)) || !listed.includes('Robinhood')) throw new Error(`listed: ${listed}`);
    if (await page.isVisible('#finRoot .fx-owelist')) throw new Error('What you owe shows for Investments');
    await card.locator('button:text-is("Show everything")').click();
    await card.waitFor({ state: 'detached', timeout: 2000 });
    if (!(await page.$$eval('#finRoot .fx-ownlist li strong', (s) => s.map((e) => e.textContent))).some((n) => /Checking/.test(n))) throw new Error('Show everything left the list narrowed');
    await page.click('#finNav .fx-balance:has-text("Loans")');
    await page.waitForSelector('#finRoot .fx-groupcard h2:has-text("Loans")', { timeout: 3000 });
    if (await page.isVisible('#finRoot .fx-ownlist')) throw new Error('What you own shows for Loans');
    await finTab(page, 'Dashboard');
    await finTab(page, 'Net worth');
    if (await page.isVisible('#finRoot .fx-groupcard')) throw new Error('another view did not forget the group');
  } },
  // Collectibles: a tile of their own in the pay period card, a group in the sidebar, and in net worth.
  { name: 'Finances: collectibles in the pay period card, the sidebar, and net worth', screen: 'finances', mock: { finances: collected }, run: async (page) => {
    await page.waitForSelector('.fx-acctrow li:has(.fx-acctname:has-text("Collectibles")) .fx-amount:text-is("$2,400.00")', { timeout: 5000 });
    const side = await page.$$eval('#finNav .fx-balance', (bs) => bs.map((b) => b.textContent.replace(/\s+/g, ' ').trim()));
    if (!side.some((t) => t.includes('Collectibles') && t.includes('$2.40k'))) throw new Error(`the sidebar: ${side}`);
    // $198,461.55 before them, and $2,400 of cards.
    if (!(await page.textContent('#finNav')).includes('$200.9k')) throw new Error(`net worth: ${await page.textContent('#finNav')}`);
  } },
  // Renewing soon: the subscriptions due in the next week, soonest first, and what they come to; See all opens
  // Recurring's Subscriptions; with none due it is not drawn.
  { name: 'Finances: the Dashboard says which subscriptions renew this week', screen: 'finances', run: async (page) => {
    await page.waitForSelector('.fx-renewing .fx-figure:has-text("$59.49")', { timeout: 5000 });
    const rows = await page.$$eval('.fx-renewing .fx-rows > li', (ls) => ls.map((l) => `${l.querySelector('.grow > strong').textContent} ${l.querySelector('.fx-due').textContent}`));
    if (rows.join() !== 'Netflix In 4 days,Peloton In 6 days') throw new Error(`renewing: ${rows}`);
    await page.click('.fx-renewing button:text-is("See all")');
    await page.waitForSelector('#finRoot .fx-payments .seg button[aria-checked=true]:has-text("Subscriptions")', { timeout: 5000 });
    await page.waitForSelector('.fx-subs', { timeout: 5000 });
    // Back on the Dashboard and to Recurring by its tab, it opens on All again.
    await finTab(page, 'Dashboard');
    await finTab(page, 'Recurring');
    await page.waitForSelector('#finRoot .fx-payments .seg button[aria-checked=true]:has-text("All")', { timeout: 5000 });
  } },
  { name: 'Finances: with nothing renewing this week, no Renewing soon', screen: 'finances', mock: { finances: { ...finances, plan: { ...finances.plan, payments: finances.plan.payments.filter((x) => x.kind !== 'subscriptions') } } }, run: async (page) => {
    await page.waitForSelector('.fx-paycheck', { timeout: 5000 });
    if (await page.$('.fx-renewing')) throw new Error('Renewing soon with nothing renewing');
  } },
  // The logo picker as the name is typed: the logo it picks comes into view, and a new payment's category follows the
  // logo (Netflix a subscription, Toyota the car, Verizon a utility) until one is picked by hand.
  { name: 'Finances: typing a payee picks its logo in view, and its category', screen: 'finances', run: async (page) => {
    await page.click('#finRoot .toolbar button:text-is("Add a payment")', { timeout: 5000 });
    const category = () => page.inputValue('#finSheet label:has-text("Category") select');
    const inView = () => page.$eval('#finSheet .brandgrid', (g) => { const on = g.querySelector('.on'); if (!on) return false; const a = g.getBoundingClientRect(), b = on.getBoundingClientRect(); return b.top >= a.top - 1 && b.bottom <= a.bottom + 1; });
    for (const [name, want] of [['Netflix', 'subscriptions'], ['Toyota payment', 'car'], ['Verizon', 'utilities'], ['Costco run', 'spending']]) {
      await page.fill('#finSheet label:has-text("Name") input', name);
      await page.waitForTimeout(100);
      if ((await category()) !== want) throw new Error(`${name}: ${await category()}, not ${want}`);
      if (!(await inView())) throw new Error(`${name}: its logo is out of view`);
    }
    await page.selectOption('#finSheet label:has-text("Category") select', 'other');
    await page.fill('#finSheet label:has-text("Name") input', 'Netflix');
    if ((await category()) !== 'other') throw new Error('a category picked by hand changed with the name');
  } },
  // Transactions: what actually happened, newest first by day; this month's money in and out (a transfer is
  // neither); a row opens its form; a new one is added, one changed, one deleted, each saved to the ledger.
  { name: 'Finances: transactions, newest first, with this month in and out', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    for (const [stat, want] of [['Money in', '$2,400'], ['Money out', '$493'], ['Kept · 6 transactions', '+$1,907']]) {
      const text = (await page.textContent(`.fx-txsum .fx-stat:has(.fx-caption:has-text("${stat}"))`, { timeout: 5000 })).replace(/\s+/g, '');
      if (!text.includes(want)) throw new Error(`${stat}: ${text}`);
    }
    const days = await page.$$eval('.fx-txday h3', (hs) => hs.map((h) => h.textContent));
    if (days[0] !== 'Fri, Oct 30, today' || days.at(-1) !== 'Thu, Oct 22') throw new Error(`days: ${days}`);
    await page.waitForSelector('.fx-txday li:has-text("Roth IRA"):has-text("Transfer · Chase Checking → Roth IRA")', { timeout: 5000 });
    await page.waitForSelector('.fx-txday li:has-text("Shell"):has-text("Road trip")', { timeout: 5000 });
    await page.waitForSelector('.fx-txday li:has-text("Costco") .fmark.logo', { timeout: 5000 });
    await page.waitForSelector('.fx-txday li:has-text("Jordan\'s paycheck") .fx-in:has-text("+$2,400.00")', { timeout: 5000 });
  } },
  // One account picked: what it held after each day, worked back from the balance typed in on its day (checking's $2,512.40
  // on Oct 30) through each transaction in or out of it, a transfer out too; a card says what it owed, more after a charge.
  // With every account, no balance shows.
  { name: 'Finances: one account picked, each day says what it held after', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    if (await page.$('.fx-txday .fx-txbal')) throw new Error('a balance shows with every account');
    await page.selectOption('.fx-txfilters select[aria-label="Account"]', 'chk');
    const bal = (day) => page.textContent(`.fx-txday[aria-label="${day}"] .fx-txbal`, { timeout: 5000 }).then((t) => t.replace(/\s+/g, ' ').trim());
    for (const [day, want] of [['Wed, Oct 28', '$2,512.40'], ['Tue, Oct 27', '$2,560.60'], ['Mon, Oct 26', '$2,810.60'], ['Sat, Oct 24', '$410.60'], ['Thu, Oct 22', '$474.35']]) {
      const got = await bal(day);
      if (!got.startsWith(want + ' ')) throw new Error(`${day}: ${got}, not ${want}`);
    }
    await page.waitForSelector('.fx-txrunning:has-text("worked from the $2,512.40 typed in on Oct 30")', { timeout: 5000 });
    await page.selectOption('.fx-txfilters select[aria-label="Account"]', 'visa');
    if (!(await bal('Fri, Oct 30')).startsWith('$1,240.55 owed') || !(await bal('Fri, Oct 23')).startsWith('$1,154.45 owed')) throw new Error(`the card: ${await bal('Fri, Oct 30')}, ${await bal('Fri, Oct 23')}`);
  } },
  // Finding transactions: words in the payee, category, or note; an account (a transfer into it counts as money in);
  // a category; a month; in or out; the total of what shows; Show all clears them.
  { name: 'Finances: transactions found by search and filters, with their total', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    const names = () => page.$$eval('.fx-txday li .grow > strong', (ss) => ss.map((s) => s.textContent).join());
    await page.fill('.fx-txsearch', 'groceries');
    if ((await names()) !== "Costco,Trader Joe's") throw new Error(`groceries: ${await names()}`);
    await page.waitForSelector('.fx-transactions h2:text-is("2 transactions of 7")', { timeout: 5000 });
    await page.waitForSelector('.fx-txtotal:has-text("−$149.85")', { timeout: 5000 });
    await page.fill('.fx-txsearch', 'road trip');
    if ((await names()) !== 'Shell') throw new Error(`road trip: ${await names()}`);
    await page.fill('.fx-txsearch', '');
    await page.selectOption('.fx-txfilters select[aria-label="Account"]', 'roth');
    if ((await names()) !== 'Roth IRA') throw new Error(`Roth IRA's: ${await names()}`);
    await page.waitForSelector('.fx-txtotal:has-text("+$250.00")', { timeout: 5000 });
    await page.selectOption('.fx-txfilters select[aria-label="Account"]', '');
    await page.selectOption('.fx-txfilters select[aria-label="In or out"]', 'in');
    if ((await names()) !== "Jordan's paycheck") throw new Error(`money in: ${await names()}`);
    await page.selectOption('.fx-txfilters select[aria-label="In or out"]', 'out');
    await page.selectOption('.fx-txfilters select[aria-label="Category"]', 'Subscriptions');
    if ((await names()) !== 'Claude Pro') throw new Error(`subscriptions out: ${await names()}`);
    await page.fill('.fx-txsearch', 'nothing like this');
    await page.waitForSelector('.fx-transactions :text("None match")', { timeout: 5000 });
    await page.click('.fx-txfilters button:text-is("Show all")');
    if ((await names()).split(',').length !== 7) throw new Error(`Show all: ${await names()}`);
    if (await page.$('.fx-txtotal')) throw new Error('a total with nothing filtered');
  } },
  // A transaction split across categories, its parts coming to the whole, and tags; the list and the filters read both.
  { name: 'Finances: a transaction split across categories, with tags', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-txday li:has-text("Costco") button');
    await page.click('#finSheet button:text-is("Split it")');
    if ((await page.inputValue('#finSheet input[aria-label="Part 1 category"]')) !== 'Groceries' || (await page.inputValue('#finSheet input[aria-label="Part 1 amount"]')) !== '86.10') throw new Error('the first part is not the whole');
    await page.fill('#finSheet input[aria-label="Part 1 amount"]', '60');
    await page.fill('#finSheet input[aria-label="Part 2 category"]', 'Home');
    await page.fill('#finSheet input[aria-label="Part 2 amount"]', '20');
    await page.waitForSelector('#finSheet .formsub:has-text("$6.10 left to place")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet .formerr:has-text("The parts come to $80.00, not $86.10")', { timeout: 5000 });
    await page.fill('#finSheet input[aria-label="Part 2 amount"]', '26.10');
    await page.waitForSelector('#finSheet .formsub:has-text("all of it placed")', { timeout: 5000 });
    await page.fill('#finSheet label:has-text("Tags") input', 'Household, costco run, household');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const t = await page.evaluate(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions.find((q) => q.id === 't7'));
    if (JSON.stringify(t.splits) !== JSON.stringify([{ category: 'Groceries', amount: -60 }, { category: 'Home', amount: -26.1 }]) || t.category || t.tags.join() !== 'household,costco run') throw new Error(`saved ${JSON.stringify(t)}`);
    await page.waitForSelector('.fx-txday li:has-text("Costco"):has-text("Groceries, Home · Chase Freedom")', { timeout: 5000 });
    await page.selectOption('.fx-txfilters select[aria-label="Category"]', 'Home');
    await page.waitForSelector('.fx-txday li:has-text("Costco")', { timeout: 5000 });
    await page.fill('.fx-txsearch', 'costco run');
    await page.waitForSelector('.fx-transactions h2:text-is("1 transaction of 7")', { timeout: 5000 });
  } },
  // A tag: shown on its transaction, picked in Transactions to see only those, and in Reports, By tag, which narrows every report to it.
  { name: 'Finances: a tag picked in Transactions and in Reports', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.waitForSelector('.fx-txday li:has-text("Shell") .fx-tag:text-is("road trip")', { timeout: 5000 });
    await page.selectOption('.fx-txfilters select[aria-label="Tag"]', 'road trip');
    const names = await page.$$eval('.fx-txday li .grow > strong', (ss) => ss.map((s) => s.textContent).join());
    if (names !== 'Shell') throw new Error(`road trip: ${names}`);
    await page.waitForSelector('.fx-transactions h2:text-is("1 transaction of 7")', { timeout: 5000 });
    await page.click('.fx-txfilters button:text-is("Show all")');
    if ((await page.inputValue('.fx-txfilters select[aria-label="Tag"]')) !== '') throw new Error('Show all kept the tag');
    await finTab(page, 'Reports');
    await page.waitForSelector('.fx-bytag li:has-text("road trip"):has-text("1 transaction"):has-text("$48.20")', { timeout: 5000 });
    await page.click('.fx-bytag li:has-text("road trip") button');
    await page.waitForSelector('.fx-reportsum h2:text-is("Reports, tagged road trip")', { timeout: 5000 });
    const out = (await page.textContent('.fx-reportsum .fx-stat:has(.fx-caption:has-text("Money out"))')).replace(/\s+/g, '');
    if (!out.includes('$48')) throw new Error(`money out, tagged: ${out}`);
    if (await page.$('.fx-bytag')) throw new Error('By tag shown with a tag picked');
    await page.selectOption('.fx-reportsum select[aria-label="Tag"]', '');
    await page.waitForSelector('.fx-reportsum h2:text-is("Reports")', { timeout: 5000 });
  } },
  // Export CSV: the stretch's transactions (a tag's, when one is picked) for a spreadsheet, saved where the dialog says.
  { name: 'Finances: Reports exports the stretch as a CSV', screen: 'finances', run: async (page) => {
    await finTab(page, 'Reports', { timeout: 5000 });
    await page.click('.fx-reportsum button:text-is("Export CSV")');
    await page.waitForSelector('.fx-exported:has-text("Saved to /Users/alex/Downloads/finances-2026-10-01-to-2026-10-31.csv")', { timeout: 5000 });
    let x = await page.evaluate(() => window.__MOCK.exported.at(-1));
    const lines = x.text.split('\r\n');
    if (lines[0] !== 'Date,Account,Payee,Category,Amount,Note,Tags,Transfer to' || lines.length !== 9 || lines[8] !== '') throw new Error(`exported ${JSON.stringify(lines)}`);
    for (const want of ['2026-10-28,Chase Checking,Shell,Gas,-48.20,Road trip,road trip,', '2026-10-27,Chase Checking,Roth IRA,,-250.00,,,Roth IRA', "2026-10-24,Chase Checking,Trader Joe's,Groceries,-63.75,,,"]) {
      if (!lines.includes(want)) throw new Error(`no line ${want} in ${JSON.stringify(lines)}`);
    }
    await page.selectOption('.fx-reportsum select[aria-label="Tag"]', 'road trip');
    await page.click('.fx-reportsum button:text-is("Export CSV")');
    await page.waitForSelector('.fx-exported:has-text("finances-2026-10-01-to-2026-10-31-road-trip.csv")', { timeout: 5000 });
    x = await page.evaluate(() => window.__MOCK.exported.at(-1));
    if (x.text.split('\r\n').length !== 3) throw new Error(`the tag's export: ${JSON.stringify(x.text)}`);
    // Cancelled, nothing is said.
    await page.evaluate(() => { window.__MOCK.exportPick = ''; });
    await page.click('.fx-reportsum button:text-is("Export CSV")');
    await page.waitForFunction(() => window.__MOCK.exported.length === 3, null, { timeout: 5000 });
    await page.waitForFunction(() => document.querySelector('.fx-exported').textContent === '', null, { timeout: 5000 });
  } },
  // Export (F18): the plan as JSON (finance.json's own shape), the year ahead as a CSV (each payday and payment with
  // checking after), and this month or the next on a page that prints itself; each says where it went.
  { name: 'Finances: Export the plan, the year ahead, and a month to print', screen: 'finances', run: async (page) => {
    const menu = async (item) => {
      await page.click('#finances .header .fx-export button[aria-haspopup=menu]:has-text("Export")', { timeout: 5000 });
      await page.click(`#finances .header [role=menuitem]:has-text("${item}")`, { timeout: 3000 });
    };
    await menu('The plan, as JSON');
    await page.waitForSelector('.fx-exportsaid:has-text("Saved to /Users/alex/Downloads/finances-plan-")', { timeout: 5000 });
    let x = await page.evaluate(() => window.__MOCK.exported.at(-1));
    if (!/^finances-plan-\d{4}-\d\d-\d\d\.json$/.test(x.name)) throw new Error('named ' + x.name);
    const plan = JSON.parse(x.text);
    if (!plan.accounts?.length || !plan.payments?.length || !plan.people?.length) throw new Error('the plan exported: ' + Object.keys(plan).join(', '));
    await menu('The year ahead');
    await page.waitForFunction(() => /^finances-ahead-.*\.csv$/.test(window.__MOCK.exported.at(-1).name), null, { timeout: 5000 });
    x = await page.evaluate(() => window.__MOCK.exported.at(-1));
    const lines = x.text.split('\r\n');
    if (lines[0] !== 'Date,What,Kind,Amount,Account,Checking after') throw new Error('header ' + lines[0]);
    if (!lines.some((l) => /,Payday,\d+\.\d\d,/.test(l)) || !lines.some((l) => /,Payment,-\d+\.\d\d,/.test(l))) throw new Error('no payday or payment: ' + lines.slice(0, 6).join(' | '));
    const dates = lines.slice(1, -1).map((l) => l.slice(0, 10));
    if (dates.join() !== [...dates].sort().join()) throw new Error('not oldest first');
    const months = new Set(dates.map((d) => d.slice(0, 7)));
    if (months.size < 12) throw new Error(`only ${months.size} months ahead`);
    await page.click('#finances .header .fx-export button[aria-haspopup=menu]:has-text("Export")');
    const printItems = await page.$$eval('#finances .header [role=menuitem]', (b) => b.map((x) => x.textContent).filter((t) => t.endsWith(', to print')));
    if (printItems.length !== 2) throw new Error('print items: ' + printItems.join(', '));
    await page.click(`#finances .header [role=menuitem]:text-is("${printItems[0]}")`);
    await page.waitForSelector('.fx-exportsaid:has-text("Opened /Users/alex/Homelab/reports/finances/finances-")', { timeout: 5000 });
    const p = await page.evaluate(() => window.__MOCK.printed.at(-1));
    if (!/^finances-\d{4}-\d\d\.html$/.test(p.name) || !p.html.includes('<body onload="print()">') || !p.html.includes('<h1>Finances: ')) throw new Error('the page: ' + p.name);
    if (/<script|https?:\/\//.test(p.html)) throw new Error('the printed page loads something from elsewhere');
  } },
  // Export stands level with the toolbar beside it on each system: the same middle as the capsule's buttons
  // (the capsule keeps to the header's top, so a centred Export once sat a few pixels lower).
  ...[['Mac', 'MacIntel', 'macOS 26.0'], ['Windows', 'Win32', 'Windows 11'], ['Linux', 'Linux x86_64', 'Ubuntu 24.04']].map(([sys, platform, os]) => ({
    name: `Finances: Export sits level with the toolbar on ${sys}`, screen: 'finances', mock: { platform, host: { ...host, os } }, run: async (page) => {
      await page.waitForSelector('#finances .header .fx-export button[aria-haspopup=menu]', { timeout: 5000 });
      const at = await page.evaluate(() => {
        const mid = (e) => { const r = e.getBoundingClientRect(); return { mid: r.top + r.height / 2, top: r.top, bottom: r.bottom }; };
        return { exp: mid(document.querySelector('#finances .header .fx-export button[aria-haspopup=menu]')), btn: mid(document.querySelector('#finances .header .toolbar .btn')) };
      });
      if (Math.abs(at.exp.mid - at.btn.mid) > 0.5) throw new Error(`Export's middle is at ${at.exp.mid.toFixed(1)}px, the toolbar's buttons' at ${at.btn.mid.toFixed(1)}px`);
    } })),
  // A phone allowed only to look exports too (it changes nothing): the plan downloads.
  { name: 'The phone, view only: Export downloads the plan', screen: 'finances', phone: ['companion', 'finances'], mock: { finances: { ...finances, readOnly: true } }, run: async (page) => {
    await page.click('#finances .header .fx-export button[aria-haspopup=menu]:has-text("Export")', { timeout: 5000 });
    const [file] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.click('#finances .header [role=menuitem]:has-text("The plan, as JSON")')]);
    if (!/^finances-plan-.*\.json$/.test(file.suggestedFilename())) throw new Error('downloaded ' + file.suggestedFilename());
  } },
  { name: 'The phone, view only: Reports exports as a download', screen: 'finances', phone: ['companion', 'finances'], mock: { finances: { ...finances, readOnly: true } }, run: async (page) => {
    await finTab(page, 'Reports', { timeout: 5000 });
    const [file] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.click('.fx-reportsum button:text-is("Export CSV")')]);
    if (file.suggestedFilename() !== 'finances-2026-10-01-to-2026-10-31.csv') throw new Error(`downloaded ${file.suggestedFilename()}`);
    if (await page.evaluate(() => window.__MOCK.exported?.length)) throw new Error('the phone asked the computer to save');
    await page.waitForSelector('.fx-exported:has-text("Downloaded finances-2026-10-01-to-2026-10-31.csv")', { timeout: 5000 });
  } },
  // A receipt: a photo made smaller here and kept at once, shown in the form, saved by its name, read back, and removed.
  { name: 'Finances: a receipt kept with a transaction', screen: 'finances', run: async (page) => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-txday li:has-text("Costco") button');
    await page.setInputFiles('#finSheet .receipt input[type=file]', { name: 'costco.png', mimeType: 'image/png', buffer: png });
    await page.waitForSelector('#finSheet img.receiptview[alt="The receipt"]', { timeout: 5000 });
    const sent = await page.evaluate(() => window.__MOCK.receiptsSaved);
    if (sent?.length !== 1 || !sent[0].startsWith('data:image/jpeg;base64,')) throw new Error(`kept ${JSON.stringify(sent?.map((x) => x.slice(0, 30)))}`);
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    let t = await page.evaluate(() => window.__MOCK.ledgerSaved.at(-1).transactions.find((q) => q.id === 't7'));
    if (t.receipt !== '0'.repeat(31) + '1.jpg') throw new Error(`saved ${JSON.stringify(t)}`);
    await page.waitForSelector('.fx-txday li:has-text("Costco") .fx-txreceipt:has-text("Receipt")', { timeout: 5000 });
    // Opened again, it is read back; removed, the transaction keeps none.
    await page.click('.fx-txday li:has-text("Costco") button');
    await page.waitForSelector('#finSheet img.receiptview', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Remove the receipt")');
    if (await page.$('#finSheet img.receiptview')) throw new Error('a removed receipt still shows');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    t = await page.evaluate(() => window.__MOCK.ledgerSaved.at(-1).transactions.find((q) => q.id === 't7'));
    if (t.receipt) throw new Error(`still ${t.receipt}`);
  } },
  // A PDF is kept as it is and shown in a frame; one over 2 MB, or a file that is no picture, is refused with why.
  { name: 'Finances: a PDF receipt, and one refused', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('#finRoot .toolbar button:text-is("Add a transaction")');
    await page.setInputFiles('#finSheet .receipt input[type=file]', { name: 'big.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc((2 << 20) + 1, 'x') });
    await page.waitForSelector('#finSheet .receipt .formerr:has-text("That PDF is over 2 MB")', { timeout: 5000 });
    await page.setInputFiles('#finSheet .receipt input[type=file]', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a picture') });
    await page.waitForSelector('#finSheet .receipt .formerr:has-text("not a picture this can read")', { timeout: 5000 });
    if (await page.evaluate(() => window.__MOCK.receiptsSaved?.length)) throw new Error('a refused file was kept');
    await page.setInputFiles('#finSheet .receipt input[type=file]', { name: 'hardware.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n a receipt') });
    await page.waitForSelector('#finSheet object.receiptview.pdf', { timeout: 5000 });
    if (await page.$('#finSheet .receipt .formerr')) throw new Error('the problem stayed after a good file');
    const sent = await page.evaluate(() => window.__MOCK.receiptsSaved);
    if (sent.length !== 1 || sent[0] !== 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4\n a receipt').toString('base64')) throw new Error(`kept ${sent}`);
  } },
  // Paid, from the ledger: a planned payment a transaction paid says so on its row, and by how much it differed.
  { name: 'Finances: Recurring says what the ledger paid, and by how much it differed', screen: 'finances', run: async (page) => {
    await finTab(page, 'Recurring', { timeout: 5000 });
    for (const [name, said] of [['Verizon', 'Paid Oct 22'], ['Claude Pro', 'Paid Oct 23'], ['Roth IRA', 'Paid Oct 27']]) await page.waitForSelector(`.fx-payments li:has(.grow > strong:text-is("${name}")) .fx-paidline:text-is("${said}")`, { timeout: 5000 });
    if (await page.$('.fx-payments li:has(.grow > strong:text-is("Netflix")) .fx-paidline')) throw new Error('Netflix says paid with nothing in the ledger for it');
  } },
  { name: 'Finances: a payment paid late and for more says both', screen: 'finances', mock: { finances: { ...finances, paid: [{ payment: 'phones', due: '2026-10-22', date: '2026-10-24', amount: 110, planned: 95, transaction: 't1' }] } }, run: async (page) => {
    await finTab(page, 'Recurring', { timeout: 5000 });
    await page.waitForSelector('.fx-payments li:has(.grow > strong:text-is("Verizon")) .fx-paidline:has-text("Paid Oct 24, for Oct 22: $110.00, $15.00 more than planned")', { timeout: 5000 });
  } },
  // Categories: a transaction with no logo shows its category's icon; a payee typed again brings its last category;
  // the household's categories are offered as the category is typed.
  { name: 'Finances: a transaction takes its category\'s icon, and its payee\'s last category', screen: 'finances', mock: { ledger: { ...ledger, transactions: [{ id: 'cm1', date: '2026-10-19', account: 'chk', amount: -31.2, payee: 'Corner Market', category: 'Groceries' }, ...ledger.transactions] } }, run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    const icon = (name) => page.getAttribute(`.fx-txday li:has(.grow > strong:text-is("${name}")) .fmark.icon`, 'data-icon', { timeout: 5000 });
    // A payee with no brand shows its category's icon (Corner Market, Groceries).
    if ((await icon('Corner Market')) !== 'spending') throw new Error(`Corner Market shows ${await icon('Corner Market')}`);
    if ((await icon("Jordan's paycheck")) !== 'savings') throw new Error(`the paycheck shows ${await icon("Jordan's paycheck")}`);
    await page.click('#finRoot .toolbar button:text-is("Add a transaction")');
    await page.fill('#finSheet label:has-text("Paid to") input', 'Corner Market');
    if ((await page.inputValue('#finSheet label:has-text("Category") input')) !== 'Groceries') throw new Error('the payee did not bring its category');
    await page.waitForSelector('#finSheet .formhead .fmark.icon[data-icon="spending"]', { timeout: 5000 });
    await page.waitForSelector('#finCategories option[value="Eating out"]', { state: 'attached', timeout: 5000 });
    // Typed by hand, the category stays when the payee changes.
    await page.fill('#finSheet label:has-text("Category") input', 'Gifts and giving');
    await page.fill('#finSheet label:has-text("Paid to") input', 'Shell');
    if ((await page.inputValue('#finSheet label:has-text("Category") input')) !== 'Gifts and giving') throw new Error('a category typed by hand changed with the payee');
  } },
  // The categories: renamed on every transaction, deleted into its group, each name once.
  { name: 'Finances: categories renamed and deleted, the transactions following', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-transactions button:text-is("Categories")');
    await page.waitForSelector('#finSheet:not([hidden]) h2:text-is("Categories")', { timeout: 5000 });
    const row = (name) => `#finSheet .catlist li[data-was="${name}"]`;
    await page.fill(`${row('Groceries')} input[aria-label="Name"]`, 'Food shopping');
    await page.click(`${row('Gas')} button:text-is("Delete")`);
    // Two of a name are refused, then put right.
    await page.click('#finSheet button:text-is("Add a category")');
    await page.fill('#finSheet .catlist li:last-child input[aria-label="Name"]', 'Travel');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet .formerr:has-text("Two categories are called “Travel”")', { timeout: 5000 });
    await page.fill('#finSheet .catlist li:last-child input[aria-label="Name"]', 'Pets');
    await page.selectOption('#finSheet .catlist li:last-child select[aria-label="Pets\'s icon"]', 'other');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const cats = await page.evaluate(() => window.__MOCK.financesSaved?.at(-1)?.categories);
    if (!cats?.some((c) => c.name === 'Food shopping' && c.parent === 'Food') || cats.some((c) => c.name === 'Gas' || c.name === 'Groceries') || !cats.some((c) => c.name === 'Pets' && c.icon === 'other')) throw new Error(`categories saved: ${JSON.stringify(cats?.map((c) => c.name))}`);
    const txs = await page.evaluate(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions);
    const cat = (payee) => txs?.find((t) => t.payee === payee)?.category;
    if (cat("Trader Joe's") !== 'Food shopping' || cat('Costco') !== 'Food shopping' || cat('Shell') !== 'Car' || cat('Verizon') !== 'Utilities') throw new Error(`the ledger: ${JSON.stringify(txs?.map((t) => [t.payee, t.category]))}`);
  } },
  // Budgets: each category's this month from the ledger, what is left or how far over; Edit budgets changes them.
  { name: 'Finances: budgets say what is left, and over in red', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    const left = (cat) => page.textContent(`.fx-budgets li:has(.grow > strong:text-is("${cat}")) .fx-budgetleft`, { timeout: 5000 });
    // What is left, and under it how much a day keeps it on budget to the month's end (Oct 30 and 31: two days; the
    // end is in the line under the name).
    for (const [cat, want] of [['Food', '$450.15 left$225.08 a day'], ['Car', '$251.80 left$125.90 a day'], ['Subscriptions', '$50.00 over']]) {
      if ((await left(cat)).replace(/\s+/g, ' ').trim() !== want) throw new Error(`${cat}: ${await left(cat)}`);
    }
    await page.waitForSelector('.fx-budgets li:has-text("Subscriptions") .fx-budgetleft.fx-out', { timeout: 5000 });
    await page.waitForSelector('.fx-budgets li:has-text("Food") .fx-budgetbar[aria-label="Food: $149.85 spent of $600.00"]', { timeout: 5000 });
    await page.click('.fx-budgets button:text-is("Edit budgets")');
    await page.waitForSelector('#finSheet:not([hidden]) h2:text-is("Budgets")', { timeout: 5000 });
    await page.fill('#finSheet input[aria-label="Budget 1 amount"]', '700');
    await page.click('#finSheet button[aria-label="Remove budget 2"]');
    await page.click('#finSheet button:text-is("Add a budget")');
    await page.selectOption('#finSheet select[aria-label="Budget 3 category"]', 'Food');
    await page.fill('#finSheet input[aria-label="Budget 3 amount"]', '50');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet .formerr:has-text("Food has two budgets")', { timeout: 5000 });
    await page.selectOption('#finSheet select[aria-label="Budget 3 category"]', 'Utilities');
    await page.selectOption('#finSheet select[aria-label="Budget 3 per"]', 'paycheck');
    await page.click('#finSheet .budgetlist li:nth-child(3) .fcheckbox input');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const b = await page.evaluate(() => window.__MOCK.financesSaved?.at(-1)?.budgets);
    if (JSON.stringify(b) !== JSON.stringify([{ category: 'Food', amount: 700 }, { category: 'Subscriptions', amount: 150 }, { category: 'Utilities', amount: 50, per: 'paycheck', rollover: true }])) throw new Error(`saved ${JSON.stringify(b)}`);
  } },
  { name: 'Finances: with no budgets, Transactions says what they are for', screen: 'finances', mock: { finances: { ...finances, budgets: undefined, plan: { ...finances.plan, budgets: undefined } } }, run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.waitForSelector('.fx-budgets button:text-is("Set budgets")', { timeout: 5000 });
    await page.waitForSelector('.fx-budgets :text("No budgets yet: set how much a category may take")', { timeout: 5000 });
  } },
  // The Dashboard's Budgets to watch: only those over, ahead of their pace, or nine tenths gone; See all opens Transactions.
  { name: 'Finances: the Dashboard shows the budgets to watch', screen: 'finances', run: async (page) => {
    await page.waitForSelector('.fx-budgets h2:text-is("Budgets to watch")', { timeout: 5000 });
    const cats = await page.$$eval('.fx-budgets li .grow > strong', (ss) => ss.map((s) => s.textContent).join());
    if (cats !== 'Subscriptions') throw new Error(`to watch: ${cats}`);
    await page.click('.fx-budgets button:text-is("See all")');
    await page.waitForSelector('#finRoot .fx-subtabs .seg button[aria-checked=true]:text-is("Transactions")', { timeout: 5000 });
    await page.waitForSelector('.fx-budgets h2:text-is("Budgets")', { timeout: 5000 });
  } },
  { name: 'Finances: no budget to watch, no card', screen: 'finances', mock: { finances: { ...finances, budgets: finances.budgets.filter((b) => b.category !== 'Subscriptions') } }, run: async (page) => {
    await page.waitForSelector('.fx-paycheck', { timeout: 5000 });
    if (await page.$('.fx-budgets')) throw new Error('a Budgets to watch card with nothing to watch');
  } },
  // Reports: money in and out over a stretch, spending by category (a group with its own under it, a refund off),
  // where it went by payee, and month by month with a table for a screen reader; a transfer is neither.
  { name: 'Finances: reports, this month and three months', screen: 'finances', mock: { ledger: ledgerMonths }, run: async (page) => {
    await finTab(page, 'Reports', { timeout: 5000 });
    const stat = async (cap) => (await page.textContent(`.fx-reportsum .fx-stat:has(.fx-caption:text-is("${cap}"))`, { timeout: 5000 })).replace(/\s+/g, '');
    if (!(await stat('Money in')).includes('$2,400') || !(await stat('Money out')).includes('$493')) throw new Error(`this month: ${await stat('Money in')} ${await stat('Money out')}`);
    const cats = () => page.$$eval('.fx-bycat .fx-rows > li', (ls) => ls.map((l) => `${l.querySelector('.grow > strong').textContent} ${l.querySelector('.when').textContent.trim()}`).join(', '));
    if ((await cats()) !== 'Subscriptions $200.00, Food $149.85, Utilities $95.00, Car $48.20') throw new Error(`by category: ${await cats()}`);
    await page.waitForSelector('.fx-bycat li:has-text("Food"):has-text("Groceries $149.85")', { timeout: 5000 });
    // No month by month for one month.
    if (await page.$('.fx-inout')) throw new Error('month by month for a single month');
    await page.click('.fx-reportsum [role=radio]:text-is("3 months")');
    if (!(await stat('Money in')).includes('$7,225') || !(await stat('Money out')).includes('$813')) throw new Error(`3 months: ${await stat('Money in')} ${await stat('Money out')}`);
    await page.waitForSelector('.fx-bycat li:has-text("Food"):has-text("$444.85"):has-text("Groceries $384.85 · Eating out $60.00")', { timeout: 5000 });
    const payees = await page.$$eval('.fx-payees .fx-rows > li', (ls) => ls.map((l) => `${l.querySelector('.grow > strong').textContent} ${l.querySelector('.when').textContent.trim()}`).join(', '));
    if (payees !== "Costco $226.10, Claude Pro $200.00, Trader Joe's $183.75, Verizon $95.00, Chipotle $60.00") throw new Error(`payees: ${payees}`);
    await page.waitForSelector('.fx-payees li:has-text("Costco"):has-text("2 times")', { timeout: 5000 });
    const rows = await page.$$eval('.fx-inout table.sr tbody tr', (rs) => rs.map((r) => r.textContent).join(' | '));
    if (rows !== 'Aug 2026$2,400.00$120.00 | Sep 2026$2,425.00$200.00 | Oct 2026$2,400.00$493.05') throw new Error(`months: ${rows}`);
  } },
  // A category's last twelve months, and this month so far against the same days a year before (Oct 31, 2025 is after them).
  { name: "Finances: a category's trend, and this month against a year before", screen: 'finances', mock: { ledger: { ...ledgerMonths, transactions: [
    { id: 'y1', date: '2025-10-12', account: 'chk', amount: -100, payee: "Trader Joe's", category: 'Groceries' },
    { id: 'y2', date: '2025-10-31', account: 'chk', amount: -50, payee: "Trader Joe's", category: 'Groceries' },
    ...ledgerMonths.transactions] } }, run: async (page) => {
    await finTab(page, 'Reports', { timeout: 5000 });
    await page.waitForSelector('.fx-trend h2:text-is("Food, month by month")', { timeout: 5000 });
    const yoy = async () => (await page.textContent('.fx-trend .fx-yoy')).replace(/\s+/g, ' ').trim();
    if ((await yoy()) !== 'This month to Oct 30: $149.85; the same days of October 2025: $100.00, $49.85 more (50%).') throw new Error(`a year before: ${await yoy()}`);
    const rows = await page.$$eval('.fx-trend table.sr tbody tr', (rs) => rs.map((r) => r.textContent));
    if (rows.length !== 12 || rows[0] !== 'November 2025$0.00' || rows.slice(-3).join(' | ') !== 'August 2026$120.00 | September 2026$175.00 | October 2026$149.85') throw new Error(`trend: ${rows.join(' | ')}`);
    if ((await page.$$('.fx-trend .fx-stackcol')).length !== 12 || await page.$('.fx-trend .fx-netline')) throw new Error('the trend is not twelve bars and no line');
    await page.selectOption('.fx-trend select[aria-label="Which category"]', 'Car');
    await page.waitForSelector('.fx-trend h2:text-is("Car, month by month")', { timeout: 5000 });
    if ((await yoy()) !== 'This month to Oct 30: $48.20; the same days of October 2025: $0.00.') throw new Error(`Car a year before: ${await yoy()}`);
  } },
  { name: "Finances: a category's trend says when a year before is not in yet", screen: 'finances', mock: { ledger: ledgerMonths }, run: async (page) => {
    await finTab(page, 'Reports', { timeout: 5000 });
    await page.waitForSelector('.fx-trend .fx-yoy:has-text("A year before is not in the transactions yet.")', { timeout: 5000 });
  } },
  { name: 'Finances: reports with no transactions say where they come from', screen: 'finances', mock: { ledger: null }, run: async (page) => {
    await finTab(page, 'Reports', { timeout: 5000 });
    await page.waitForSelector('.fin :text("Reports read the transactions")', { timeout: 5000 });
  } },
  // A bank's file into the ledger: a CSV's columns guessed, those already in skipped (the same day and amount, a payee
  // alike), a payee bringing its last category; an OFX statement by the bank's own IDs, so the same file twice is once.
  { name: 'Finances: a bank\'s CSV comes into the ledger, what is in already skipped', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-transactions button:text-is("Import a file")');
    await page.waitForSelector('#finSheet:not([hidden]) h2:text-is("Import a bank\'s file")', { timeout: 5000 });
    const csv = 'Date,Description,Amount\n10/24/2026,TRADER JOE\'S #552,-63.75\n10/27/2026,TRANSFER TO ROTH,-250.00\n10/31/2026,STARBUCKS STORE 123,-6.45\n11/01/2026,PAYROLL ACME,"2,150.00"\n10/31/2026,Trader Joe\'s,-20.00\n,,\n';
    await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'chase.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.waitForSelector('#finSheet .formsub:has-text("3 to bring in"):has-text("2 already in, skipped")', { timeout: 5000 });
    await page.waitForSelector('#finSheet .importlist li:not(.dup):has-text("STARBUCKS STORE 123") .fmark.logo', { timeout: 5000 });
    await page.waitForSelector('#finSheet .importlist li:not(.dup):has-text("Trader Joe\'s"):has-text("Groceries")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Bring in 3")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const txs = await page.evaluate(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions);
    // Each payee as a person writes it; the bank's wording kept in the note when it says more than other capitals.
    const sb = txs?.find((t) => t.payee === 'Starbucks'), pay = txs?.find((t) => t.payee === 'Payroll Acme'), tj = txs?.find((t) => t.payee === "Trader Joe's" && t.date === '2026-10-31');
    if (txs?.length !== 10 || sb?.amount !== -6.45 || sb.account !== 'chk' || sb.date !== '2026-10-31' || sb.note !== 'STARBUCKS STORE 123' || pay?.amount !== 2150 || pay.note || tj?.category !== 'Groceries') throw new Error(`brought in ${JSON.stringify(txs?.slice(-3))}, ${txs?.length}`);
  } },
  // Chase's checking CSV: Details (CREDIT or DEBIT) comes before Description, the payee, and each row ends in an empty cell.
  // A Chase file's bills by their company's name (FPL, Mazda, Apple Cash), a card paid off moving to that card, and a bill
  // whose name says nothing (FPL paying Electric, the HOA's own wording paying HOA) paying the planned one of its amount to
  // the cent; the list leaves the bank's wording out (it stays in the note).
  { name: 'Finances: bills come in by their company, a card payment moves to its card, and an amount to the cent pays its bill', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-transactions button:text-is("Import a file")');
    const csv = 'Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #\n'
      + 'DEBIT,10/18/2026,"FPL DIRECT DEBIT ELEC PYMT PPD ID: 3590247775",-140.00,ACH_DEBIT,1000.00,,\n'
      + 'DEBIT,10/19/2026,"AMERICAN EXPRESS ACH PMT M8056 WEB ID: 2005032111",-300.00,ACH_DEBIT,700.00,,\n'
      + 'DEBIT,10/15/2026,"MAZDA FINANCIAL WEB NZTZP5VXA0Y1UPE WEB ID: 1111111111",-399.00,ACH_DEBIT,301.00,,\n'
      + 'DEBIT,10/28/2026,"SUNSET PALMS EAS SUNSET PAL FT446739428 WEB ID: 2HOA",-310.00,ACH_DEBIT,0.00,,\n'
      + 'CREDIT,10/26/2026,"APPLE CASH BANK XFER JANE Q DOE WEB ID: 6192912998",107.00,ACH_CREDIT,107.00,,\n';
    await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'Chase1234_Activity.CSV', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.waitForSelector('#finSheet .formsub:has-text("5 to bring in")', { timeout: 5000 });
    await page.waitForSelector('#finSheet .importlist li:has-text("American Express"):has-text("moves to Amex Gold")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Bring in 5")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const txs = (await page.evaluate(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions)).filter((t) => t.date >= '2026-10-15' && (t.note || '').length > 20);
    const by = (p) => txs.find((t) => t.payee === p);
    const fpl = by('FPL'), amex = by('American Express'), mazda = by('Mazda'), hoa = by('Sunset Palms Eas Sunset Pal'), cash = by('Apple Cash');
    if (!fpl || fpl.payment !== 'electric' || fpl.category !== 'Electric' || !/FPL DIRECT DEBIT/.test(fpl.note)) throw new Error(`FPL ${JSON.stringify(fpl)}`);
    if (!amex || amex.to !== 'amex' || amex.category) throw new Error(`American Express ${JSON.stringify(amex)}`);
    // A car's make pays the plan's car payment by what it is (#508), $399 about its planned $412.
    if (!mazda || mazda.payment !== 'carpay') throw new Error(`Mazda ${JSON.stringify(mazda)}`);
    if (!hoa || hoa.payment !== 'hoa') throw new Error(`HOA ${JSON.stringify(hoa)}`);
    if (!cash || cash.amount !== 107) throw new Error(`Apple Cash ${JSON.stringify(cash)}`);
    // The list shows the clean name, not the bank's wording.
    const row = page.locator('.fx-txday li:has-text("FPL")').first();
    await row.waitFor({ timeout: 5000 });
    if (/PPD ID|3590247775/.test(await row.innerText())) throw new Error('the bank wording is shown in the list');
  } },
  // A bill paid by what the payee is, its name saying nothing of it: FPL pays Electric though $157.06 is a tenth and more over
  // the planned $140 (a utility changes each time), and a car's make pays the car payment (Mazda, the plan's car payment
  // set up as a Toyota, about its amount); a grocer pays no spending envelope however close its amount.
  { name: 'Finances: an electric company pays the Electric bill, and a car make the car payment, by what they are', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-transactions button:text-is("Import a file")');
    const csv = 'Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #\n'
      + 'DEBIT,10/18/2026,"FPL DIRECT DEBIT ELEC PYMT PPD ID: 3590247775",-157.06,ACH_DEBIT,1000.00,,\n'
      + 'DEBIT,10/16/2026,"MAZDA FINANCIAL WEB NZTZP5VXA0Y1UPE WEB ID: 2953775816",-405.00,ACH_DEBIT,600.00,,\n'
      + 'DEBIT,10/31/2026,"COSTCO WHSE #1234",-198.00,DEBIT_CARD,400.00,,\n';
    await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'Chase1234_Activity.CSV', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.waitForSelector('#finSheet .importlist li:has-text("FPL") :text("Looks like Electric")', { timeout: 5000 });
    await page.waitForSelector('#finSheet .importlist li:has-text("Mazda") :text("Looks like Car payment")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Bring in 3")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const txs = await page.evaluate(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions);
    const by = (p) => txs.find((t) => t.payee === p);
    if (by('FPL')?.payment !== 'electric' || by('Mazda')?.payment !== 'carpay' || by('Costco')?.payment) throw new Error(`linked ${JSON.stringify(txs.slice(-3))}`);
  } },
  // Rules (the owner's yes, Nov 11): a transaction renamed to the start of its name (Pine Pest Control 80 to Pine Pest
  // Control) and given a category, with Always ticked, makes a rule for every name starting so: the ones already in
  // take the name and the category (one picked before too), and the next import of another branch comes in so. The
  // Rules sheet lists it; its category changed there is kept; Remove takes it away.
  { name: 'Finances: Always do this for a payee, and the next import does it', screen: 'finances', mock: { ledger: { rev: 'r1', transactions: [
    { id: 'p1', date: '2026-10-20', account: 'chk', amount: -50, payee: 'Pine Pest Control 80' },
    { id: 'p2', date: '2026-09-20', account: 'chk', amount: -50, payee: 'Pine Pest Control 81', category: 'Other' },
    { id: 'p3', date: '2026-08-20', account: 'chk', amount: -50, payee: 'Pine Pest Control 112' },
  ] } }, run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-txday li:has-text("Pine Pest Control 80") button >> nth=0');
    await page.locator('#finSheet label.field').filter({ hasText: /^Paid to/ }).locator('input').fill('Pine Pest Control');
    await page.locator('#finSheet label.field').filter({ hasText: /^Category/ }).locator('input').fill('Repairs');
    await page.click('#finSheet label:has-text("Always do this for “Pine Pest Control 80”") input');
    if (!(await page.isChecked('#finSheet label:has-text("Any name starting with") input[type=radio]'))) throw new Error('not starts-with by default');
    if ((await page.inputValue('#finSheet input[aria-label="Names starting with"]')) !== 'Pine Pest Control') throw new Error('the start');
    if (!(await page.isChecked('#finSheet label:has-text("Also change the 2 already in") input'))) throw new Error('not applied to those already in');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const rules = await page.evaluate(() => window.__MOCK.financesSaved?.at(-1)?.rules);
    if (JSON.stringify(rules) !== JSON.stringify([{ match: 'Pine Pest Control', prefix: true, payee: 'Pine Pest Control', category: 'Repairs' }])) throw new Error(`rules ${JSON.stringify(rules)}`);
    const txs = await page.evaluate(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions);
    if (txs.filter((t) => t.payee === 'Pine Pest Control' && t.category === 'Repairs').length !== 3) throw new Error(`those already in ${JSON.stringify(txs)}`);
    await page.click('.fx-transactions button:text-is("Import a file")');
    const csv = 'Date,Description,Amount\n11/20/2026,PINE PEST CONTROL 205  TUCSON   AZ,-50.00\n';
    await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'bank.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.waitForSelector('#finSheet .importlist li:has(strong:text-is("Pine Pest Control")) small:has-text(" · Repairs")', { timeout: 5000 });
    // Cancel with a file picked asks once more (nothing is saved yet): pressed again, the sheet closes.
    await page.click('#finSheet button:text-is("Cancel")');
    if (await page.isVisible('#finSheet .formerr:has-text("Cancel again")')) await page.click('#finSheet button:text-is("Cancel")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    await page.click('.fx-transactions button:text-is("Rules (1)")', { timeout: 5000 });
    await page.fill('#finSheet .rulelist input[aria-label="Category for Pine Pest Control"]', 'Home');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    if ((await page.evaluate(() => window.__MOCK.financesSaved?.at(-1)?.rules?.[0]?.category)) !== 'Home') throw new Error('the category changed in the Rules sheet was not kept');
    await page.click('.fx-transactions button:text-is("Rules (1)")', { timeout: 5000 });
    await page.click('#finSheet .rulelist li button:text-is("Remove")');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    if ((await page.evaluate(() => (window.__MOCK.financesSaved?.at(-1)?.rules || []).length)) !== 0) throw new Error('Remove was not kept');
  } },
  // Only that name: a category given with Always, the name kept, is a rule for that name alone; a name that only starts
  // the same (Corner Cafe Downtown) is left as it was.
  { name: 'Finances: Always do this for only that name leaves a name starting the same alone', screen: 'finances', mock: { ledger: { rev: 'r1', transactions: [
    { id: 'c1', date: '2026-10-20', account: 'chk', amount: -12, payee: 'Corner Cafe' },
    { id: 'c2', date: '2026-10-21', account: 'chk', amount: -9, payee: 'Corner Cafe Downtown' },
  ] } }, run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-txday li:has(strong:text-is("Corner Cafe")) button >> nth=0');
    await page.locator('#finSheet label.field').filter({ hasText: /^Category/ }).locator('input').fill('Eating out');
    await page.click('#finSheet label:has-text("Always do this for “Corner Cafe”") input');
    if (!(await page.isChecked('#finSheet label:has-text("Only “Corner Cafe”") input[type=radio]'))) throw new Error('not only by default');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const rules = await page.evaluate(() => window.__MOCK.financesSaved?.at(-1)?.rules);
    if (JSON.stringify(rules) !== JSON.stringify([{ match: 'Corner Cafe', category: 'Eating out' }])) throw new Error(`rules ${JSON.stringify(rules)}`);
    const txs = await page.evaluate(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions);
    if (txs.find((t) => t.id === 'c2')?.category) throw new Error('a name starting the same was changed');
  } },
  // A sheet puts its cursor in its first field a frame after it opens, but not once the cursor is already in one of its
  // fields: a click into Category as it opens stays there, and what is typed goes into Category, not onto Paid to.
  { name: 'A sheet leaves the cursor in the field it was put in as it opened', screen: 'finances', mock: { ledger: { rev: 'r1', transactions: [
    { id: 'c1', date: '2026-10-20', account: 'chk', amount: -12, payee: 'Corner Cafe' },
  ] } }, run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    const where = await page.evaluate(async () => {
      document.querySelector('.fx-txday li button').click();
      const cat = [...document.querySelectorAll('#finSheet label.field')].find((l) => /^Category/.test(l.textContent.trim()))?.querySelector('input');
      if (!cat) return 'no Category field';
      cat.focus();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return document.activeElement === cat ? 'Category' : document.activeElement?.closest('label')?.textContent.trim() || document.activeElement?.tagName;
    });
    if (where !== 'Category') throw new Error(`the cursor moved to ${where}`);
    await page.keyboard.type('Eating out');
    const payee = await page.locator('#finSheet label.field').filter({ hasText: /^Paid to/ }).locator('input').inputValue();
    if (payee !== 'Corner Cafe') throw new Error(`Paid to became ${payee}`);
  } },
  // A payee renamed by hand renames the others by its old name (unless unticked), and the next import of that wording comes in by the new one.
  { name: 'Finances: a payee renamed renames its other transactions, and the next import comes in by that name', screen: 'finances', mock: { ledger: { rev: 'r1', transactions: [
    { id: 'h1', date: '2026-09-28', account: 'chk', amount: -310, payee: 'Sunset Palms Eas Sunset Pal', note: 'SUNSET PALMS EAS SUNSET PAL FT446739428 WEB ID: 2HOA' },
    { id: 'h2', date: '2026-10-28', account: 'chk', amount: -310, payee: 'Sunset Palms Eas Sunset Pal', note: 'SUNSET PALMS EAS SUNSET PAL FT446739999 WEB ID: 2HOA' },
  ] } }, run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-txday li:has-text("Sunset Palms") button >> nth=0');
    const box = page.locator('#finSheet label.field').filter({ hasText: /^Paid to/ }).locator('input');
    await box.fill('HOA');
    await page.waitForSelector('#finSheet .renameall:has-text("Rename the other transaction from “Sunset Palms Eas Sunset Pal” too")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    let txs = await page.evaluate(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions);
    if (txs.filter((t) => t.payee === 'HOA').length !== 2) throw new Error(`renamed ${JSON.stringify(txs)}`);
    await page.click('.fx-transactions button:text-is("Import a file")');
    const csv = 'Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #\nDEBIT,10/29/2026,"SUNSET PALMS EAS SUNSET PAL FT447000001 WEB ID: 2HOA",-310.00,ACH_DEBIT,0.00,,\n';
    await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'Chase1234_Activity.CSV', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.waitForSelector('#finSheet .importlist li:has-text("HOA")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Bring in 1")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    txs = await page.evaluate(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions);
    if (txs.filter((t) => t.payee === 'HOA').length !== 3) throw new Error(`after import ${JSON.stringify(txs)}`);
  } },
  // Logos: each payee and account showing initials, its website guessed from its brand; Get them all asks each website (the
  // computer's FinancesFetchLogo), one with none says so, and Save keeps the ones got in the plan under their brand.
  { name: 'Finances: Logos gets the real logos from each company\'s website, and keeps them', screen: 'finances', mock: { noLogo: ['traderjoes.com'] }, run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-transactions button:text-is("Logos")');
    await page.waitForSelector('#finSheet h2:text-is("Logos")', { timeout: 5000 });
    const costco = page.locator('#finSheet .logolist li:has-text("Costco")');
    if (await costco.locator('input').inputValue() !== 'costco.com') throw new Error('Costco\'s website was not guessed');
    await page.click('#finSheet button:has-text("Get them all")');
    await page.waitForSelector('#finSheet .logolist li:has-text("Costco") :text("From costco.com")', { timeout: 5000 });
    await page.waitForSelector('#finSheet .logolist li:has-text("Trader Joe") .bad:has-text("no logo")', { timeout: 5000 });
    if (!(await costco.locator('.fmark.own img').count())) throw new Error('the logo got is not shown');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const logos = await page.evaluate(() => window.__MOCK.financesSaved?.at(-1)?.logos || {});
    if (!/^data:image\/(png|webp);base64,/.test(logos.costco || '') || logos.traderjoes) throw new Error(`kept ${Object.keys(logos)}`);
    const asked = await page.evaluate(() => window.__MOCK.logosFetched);
    if (!asked.includes('costco.com') || asked.some((s) => /local|192\.168|127\./.test(s))) throw new Error(`asked ${asked}`);
  } },
  // A transaction's logo: Change logo offers its website, and the real logo got is kept for that payee with the transaction.
  { name: 'Finances: a transaction gets its payee\'s real logo from the website', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-txday li:has-text("Costco") button');
    await page.click('#finSheet button:text-is("Change logo")');
    const site = page.locator('#finSheet .getlogo input');
    if (await site.inputValue() !== 'costco.com') throw new Error(`guessed ${await site.inputValue()}`);
    await page.click('#finSheet button:text-is("Get the real logo")');
    await page.waitForSelector('#finSheet .getlogofrom:text("From costco.com")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const logos = await page.evaluate(() => window.__MOCK.financesSaved?.at(-1)?.logos || {});
    if (!logos.costco || !(await page.evaluate(() => window.__MOCK.ledgerSaved?.length))) throw new Error(`kept ${Object.keys(logos)}`);
  } },
  { name: 'Finances: a Chase checking CSV takes its payee from Description, not Details', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-transactions button:text-is("Import a file")');
    const csv = 'Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #\nDEBIT,11/06/2026,"COSTCO WHSE #0123",-236.15,DEBIT_CARD,4321.00,,\nCREDIT,11/06/2026,"ACME CORP PAYROLL PPD ID: 12345",2169.24,ACH_CREDIT,4557.15,,\n';
    await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'Chase1234_Activity.CSV', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.waitForSelector('#finSheet .formsub:has-text("2 to bring in")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Bring in 2")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const txs = (await page.evaluate(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions)).slice(-2);
    if (txs.some((t) => /^(CREDIT|DEBIT)$/i.test(t.payee || '')) || txs[0].amount !== -236.15 || txs[1].amount !== 2169.24) throw new Error(`brought in ${JSON.stringify(txs)}`);
  } },
  // A Chase file read before as CREDIT and DEBIT, imported again: those rows take their payees (and keep a category given
  // them since), rather than coming in twice; a row not in the ledger yet still comes in.
  { name: 'Finances: a Chase CSV imported again gives rows brought in as CREDIT or DEBIT their payees', screen: 'finances', mock: { ledger: { rev: 'r1', transactions: [
    { id: 'w1', date: '2026-11-06', account: 'chk', amount: -236.15, payee: 'DEBIT', category: 'Groceries' },
    { id: 'w2', date: '2026-11-06', account: 'chk', amount: 2169.24, payee: 'CREDIT' },
  ] } }, run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-transactions button:text-is("Import a file")');
    const csv = 'Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #\nDEBIT,11/06/2026,"COSTCO WHSE #0123",-236.15,DEBIT_CARD,4321.00,,\nCREDIT,11/06/2026,"ACME CORP PAYROLL PPD ID: 12345",2169.24,ACH_CREDIT,4557.15,,\nDEBIT,11/04/2026,"SHELL OIL 57444",-48.00,DEBIT_CARD,4569.15,,\n';
    await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'Chase1234_Activity.CSV', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.waitForSelector('#finSheet .formsub:has-text("1 to bring in"):has-text("2 brought in before as CREDIT or DEBIT")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Bring in 1, fix 2")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const txs = await page.evaluate(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions);
    const w1 = txs.find((t) => t.id === 'w1'), w2 = txs.find((t) => t.id === 'w2');
    if (txs.length !== 3 || !/costco/i.test(w1?.payee || '') || w1.category !== 'Groceries' || !/acme/i.test(w2?.payee || '') || !txs.some((t) => /shell/i.test(t.payee || ''))) throw new Error(`fixed ${JSON.stringify(txs)}`);
  } },
  // A file whose Payee column only says which way the money went: the names come from the column that has them, and
  // a payee column picked by hand that has none is said to have none.
  { name: 'Finances: a CSV whose payee column says only Withdrawal or Deposit reads names from another column', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-transactions button:text-is("Import a file")');
    const csv = 'Date,Payee,Amount,Text\n11/02/2026,Withdrawal,-12.50,CORNER BAKERY 44\n11/03/2026,Deposit,300.00,REFUND FROM ACME\n';
    await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'bank.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.waitForSelector('#finSheet .importlist li:has-text("Corner Bakery")', { timeout: 5000 });
    if (await page.locator('#finSheet .importnote.bad').count()) throw new Error('warned with names found');
    await page.locator('#finSheet label.field').filter({ hasText: /^Payee/ }).locator('select').selectOption({ label: 'Payee' });
    await page.waitForSelector('#finSheet .importnote.bad:has-text("No payee here is a name")', { timeout: 5000 });
  } },
  // Deleted, they come back with Undo; and with Ctrl+Z (⌘Z) after another delete.
  { name: 'Finances: deleted transactions come back with Undo', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    const n = await page.locator('.fx-transactions .fx-txday li.opens').count();
    const del = async (count) => {
      await page.click('.fx-transactions button:text-is("Select")');
      for (let i = 0; i < count; i++) await page.click(`.fx-transactions .fx-txday li.opens >> nth=${i}`);
      await page.click(`.fx-txpick button:text-is("Delete ${count}")`);
      await page.click(`.fx-txpick button:has-text("Click again to delete")`);
      await page.waitForSelector(`#undoNote :text("Deleted ${count === 1 ? '1 transaction' : count + ' transactions'}")`, { timeout: 5000 });
      await page.click('.fx-transactions button:text-is("Done")');
    };
    await del(2);
    await page.click('#undoNote button:text-is("Undo")');
    await page.waitForFunction((n) => window.__MOCK.ledgerSaved?.at(-1)?.transactions.length === n, n, { timeout: 5000 });
    await page.waitForSelector('#undoNote .undonote', { state: 'detached', timeout: 5000 });
    await del(1);
    await page.keyboard.press((await page.evaluate(() => navigator.platform.startsWith('Mac'))) ? 'Meta+z' : 'Control+z');
    await page.waitForFunction((n) => window.__MOCK.ledgerSaved?.at(-1)?.transactions.length === n, n, { timeout: 5000 });
  } },
  // Shift+click picks a range; Move to puts them in another account, Undo puts them back; a category set is undone too.
  { name: 'Finances: selected transactions move to another account, a Shift+click range, with Undo', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    const rows = '.fx-transactions .fx-txday li.opens';
    const ids = await page.evaluate(() => window.__MOCK.ledger?.transactions?.length);
    await page.click('.fx-transactions button:text-is("Select")');
    // The fifth to the seventh rows shown (Trader Joe's, Claude Pro, Verizon): none a transfer.
    await page.click(`${rows} >> nth=4`);
    await page.click(`${rows} >> nth=6`, { modifiers: ['Shift'] });
    await page.waitForSelector('.fx-txpick :text("3 transactions selected")', { timeout: 5000 });
    await page.selectOption('.fx-txpick select[aria-label="Move the selected to an account"]', { label: 'Amex Gold' });
    await page.waitForSelector('#undoNote :text("Moved 3 transactions to Amex Gold")', { timeout: 5000 });
    let txs = await page.evaluate(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions);
    const moved = txs.filter((t) => t.account === 'amex').map((t) => t.id);
    if (moved.length !== 3) throw new Error(`moved ${JSON.stringify(txs)}`);
    await page.click('#undoNote button:text-is("Undo")');
    await page.waitForFunction((m) => { const t = window.__MOCK.ledgerSaved?.at(-1)?.transactions; return t && !t.some((x) => m.includes(x.id) && x.account === 'amex'); }, moved, { timeout: 5000 });
    // A category set, then undone: each back to its own.
    await page.click(`${rows} >> nth=4`);
    await page.fill('.fx-txpick input[aria-label="Category for the selected"]', 'Fun');
    await page.click('.fx-txpick button:text-is("Set category")');
    await page.waitForSelector('#undoNote :text("1 transaction put in Fun")', { timeout: 5000 });
    await page.click('#undoNote button:text-is("Undo")');
    await page.waitForFunction(() => !window.__MOCK.ledgerSaved?.at(-1)?.transactions.some((t) => t.category === 'Fun'), null, { timeout: 5000 });
    txs = await page.evaluate(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions);
    if (ids && txs.length !== ids) throw new Error(`${txs.length} of ${ids}`);
  } },
  // While selecting, Ctrl+A (⌘A on a Mac) takes every row shown and Escape stops selecting.
  { name: 'Finances: while selecting transactions, Ctrl+A selects them all and Escape stops', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    const n = await page.locator('.fx-transactions .fx-txday li.opens').count();
    await page.click('.fx-transactions button:text-is("Select")');
    await page.waitForSelector('.fx-txpick :text("None selected")', { timeout: 5000 });
    await page.keyboard.press('ControlOrMeta+a');
    await page.waitForSelector(`.fx-txpick :text("${n} transactions selected")`, { timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForSelector('.fx-txpick', { state: 'detached', timeout: 5000 });
    await page.waitForSelector('.fx-transactions button:text-is("Select")', { timeout: 5000 });
  } },
  // Select: rows picked by a click, or every one a filter shows; Delete asks once more, then they go; a category given to each.
  { name: 'Finances: transactions selected together are deleted or given a category', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    const before = await page.locator('.fx-transactions .fx-txday li.opens').count();
    await page.click('.fx-transactions button:text-is("Select")');
    await page.click('.fx-transactions .fx-txday li.opens >> nth=0');
    await page.click('.fx-transactions .fx-txday li.opens >> nth=1');
    await page.waitForSelector('.fx-txpick :text("2 transactions selected")', { timeout: 5000 });
    if (await page.locator('.fx-transactions .rowopen[aria-pressed=true]').count() !== 2) throw new Error('two rows should be pressed');
    await page.fill('.fx-txpick input[aria-label="Category for the selected"]', 'Fun');
    await page.click('.fx-txpick button:text-is("Set category")');
    await page.waitForSelector('.fx-txpick :text("None selected")', { timeout: 5000 });
    let txs = await page.evaluate(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions);
    if (txs.filter((t) => t.category === 'Fun').length < 2) throw new Error(`categories ${JSON.stringify(txs)}`);
    await page.click(`.fx-txpick button:text-is("Select all ${before}")`);
    await page.click(`.fx-txpick button:text-is("Delete ${before}")`);
    await page.click(`.fx-txpick button:text-is("Click again to delete ${before} transactions")`);
    await page.waitForFunction(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions.length === 0, null, { timeout: 5000 });
  } },
  // An estimated bill paid three times or more in six months, its average 3% or more off the plan's: the Dashboard asks to
  // use the average. Use keeps it; Keep is remembered on this device. Twice is too few to ask.
  ...[['Use $152.00', 152], ['Keep $140.00', 140]].map(([button, want]) => ({ name: `Finances: a bill that changes, its average offered, ${button}`, screen: 'finances', mock: { finances: { ...finances, plan: { ...finances.plan, payments: finances.plan.payments.map((x) => (x.id === 'water' ? { ...x, estimate: true } : x)) }, paid: [
    { payment: 'electric', due: '2026-07-18', date: '2026-07-17', amount: 148, planned: 140, transaction: 'x1' },
    { payment: 'electric', due: '2026-08-18', date: '2026-08-18', amount: 161, planned: 140, transaction: 'x2' },
    { payment: 'electric', due: '2026-09-18', date: '2026-09-19', amount: 147, planned: 140, transaction: 'x3' },
    { payment: 'water', due: '2026-09-20', date: '2026-09-20', amount: 150, planned: 120, transaction: 'x4' },
    { payment: 'water', due: '2026-10-20', date: '2026-10-20', amount: 150, planned: 120, transaction: 'x5' }] } }, run: async (page) => {
    await page.waitForSelector('.fx-averages li:has-text("Electric has averaged $152.00 over 3 months")', { timeout: 5000 });
    if (await page.$('.fx-averages li:has-text("Water")')) throw new Error('two payments are taken as an average');
    await page.click(`.fx-averages button:text-is("${button}")`);
    if (want === 152) {
      await page.waitForFunction(() => window.__MOCK.financesSaved?.length === 1, null, { timeout: 5000 });
      const x = await page.evaluate(() => window.__MOCK.financesSaved[0].payments.find((q) => q.id === 'electric'));
      if (x.amount !== 152 || !x.estimate) throw new Error(`saved ${JSON.stringify(x)}`);
    } else {
      await page.waitForSelector('.fx-averages', { state: 'detached', timeout: 5000 });
      if (await page.evaluate(() => window.__MOCK.financesSaved)) throw new Error('Keep saved the plan');
    }
  } })),
  // The sidebar lists each group's accounts under it, each with its round logo and balance; a group's arrow folds them away,
  // and they stay folded when the app opens again; an account opens Net worth on its group.
  { name: 'The sidebar lists each account under its group, and a group folds away', screen: 'status', run: async (page) => {
    await page.waitForSelector('.fx-balances .fx-balgroup:has-text("Cash") .fx-balacct:has-text("Chase Checking") .fmark', { timeout: 5000 });
    if (!(await page.$eval('.fx-balances .fx-balacct:has-text("Chase Checking") .fmark', (e) => getComputedStyle(e).borderRadius === '50%'))) throw new Error('an account\'s logo in the sidebar is not round');
    const arrow = '.fx-balances .fx-balgroup:has-text("Cash") .fx-balfold';
    if ((await page.getAttribute(arrow, 'aria-expanded')) !== 'true') throw new Error('Cash starts folded');
    await page.click(arrow);
    await page.waitForSelector('.fx-balances .fx-balacct:has-text("Chase Checking")', { state: 'detached', timeout: 5000 });
    if ((await page.getAttribute(arrow, 'aria-expanded')) !== 'false') throw new Error('the arrow does not say Cash is folded');
    if (!(await page.$('.fx-balances .fx-balacct:has-text("Robinhood")'))) throw new Error('folding Cash folded Investments too');
    // Opened again: still folded. Carried over by hand, as Status's place is: a reloaded file:// page in this browser can
    // start with empty storage when the machine is busy.
    const kept = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    if (!JSON.parse(kept)['homelab.finances.foldedGroups']?.includes('cash')) throw new Error('the fold is not kept on this device');
    await page.addInitScript((k) => { for (const [key, value] of Object.entries(JSON.parse(k))) localStorage.setItem(key, value); }, kept);
    await page.reload();
    await page.waitForSelector('.fx-balances .fx-balacct:has-text("Robinhood")', { timeout: 5000 });
    if (await page.$('.fx-balances .fx-balacct:has-text("Chase Checking")')) throw new Error('Cash opened again by itself');
    await page.click('.fx-balances .fx-balacct:has-text("Robinhood")');
    await page.waitForSelector('#finances.active .fx-ownlist li:has-text("Robinhood")', { timeout: 5000 });
  } },
  // On Finances every mark is round, a logo on a coin: a payment's logo on Recurring, an account's on Net worth, a
  // category's icon on Transactions.
  { name: 'Finances: logos and icons are round on every row', screen: 'finances', run: async (page) => {
    const round = (sel) => page.$eval(sel, (e) => getComputedStyle(e).borderRadius === '50%');
    await finTab(page, 'Recurring', { timeout: 5000 });
    await page.waitForSelector('.fx-payments li:has-text("Netflix") .fmark.logo', { timeout: 5000 });
    if (!(await round('.fx-payments li:has-text("Netflix") .fmark'))) throw new Error('a payment\'s logo is not round');
    await finTab(page, 'Net worth');
    await page.waitForSelector('.fx-ownlist li:has-text("RAV4") .fmark', { timeout: 5000 });
    if (!(await round('.fx-ownlist li:has-text("RAV4") .fmark'))) throw new Error('an account\'s logo is not round');
    await finTab(page, 'Transactions');
    await page.waitForSelector('.fx-txday .fmark', { timeout: 5000 });
    if (!(await page.$$eval('.fx-txday .fmark', (ms) => ms.every((e) => getComputedStyle(e).borderRadius === '50%')))) throw new Error('a transaction\'s mark is not round');
  } },
  // One colour per category, everywhere: Food (the third top category, so the third colour) on a transaction with no logo,
  // its budget, its row and bar on Reports, and its box in the money flow; a payment's kind takes its category's colour
  // (Groceries and gas is Shopping, the seventh). The icon reads on its tint at 4.5:1 (lint.mjs checks the tokens).
  { name: 'Finances: a category keeps one colour on every row, budget, report, and chart', screen: 'finances', mock: { ledger: { ...ledger, transactions: [...ledger.transactions, { id: 'd1', date: '2026-10-29', account: 'chk', amount: -12.5, payee: 'Corner Deli', category: 'Eating out', institution: 'none' }] } }, run: async (page) => {
    const tintOf = (sel) => page.$eval(sel, (e) => { const s = getComputedStyle(e); return `${s.backgroundColor}/${s.color}`; });
    await page.waitForSelector('.fx-moneyflow rect.fx-snoderect.fx-h3', { state: 'attached', timeout: 5000 });
    await finTab(page, 'Transactions');
    await page.waitForSelector('.fx-budgets li:has-text("Food") .fmark.tint.t3', { timeout: 5000 });
    const food = await tintOf('.fx-budgets li:has-text("Food") .fmark.tint');
    await page.waitForSelector('.fx-txday li:has-text("Corner Deli") .fmark.tint.t3', { timeout: 5000 });
    if ((await tintOf('.fx-txday li:has-text("Corner Deli") .fmark.tint')) !== food) throw new Error('the transaction and its budget differ in colour');
    await finTab(page, 'Reports');
    await page.waitForSelector('.fx-bycat li:has-text("Food") .fmark.tint.t3', { timeout: 5000 });
    if ((await tintOf('.fx-bycat li:has-text("Food") .fmark.tint')) !== food) throw new Error('the report row and the budget differ in colour');
    if (!(await page.$('.fx-bycat li:has-text("Food") .fx-catbar.fx-h3'))) throw new Error('the report bar is not in Food\'s colour');
    await finTab(page, 'Recurring');
    await page.waitForSelector('.fx-payments li:has-text("Groceries and gas") .fmark.tint.t7', { timeout: 5000 });
  } },
  // A bill paid in the ledger before with nothing for its last day, three days on: the Dashboard says so. One not followed
  // in the ledger, or due two days ago, is not said.
  { name: 'Finances: a bill paid before but not seen yet is said on the Dashboard', screen: 'finances', mock: { finances: { ...finances, paid: [...(finances.paid || []),
    { payment: 'electric', due: '2026-09-18', date: '2026-09-17', amount: 140, planned: 140, transaction: 'x1' },
    { payment: 'hoa', due: '2026-09-28', date: '2026-09-28', amount: 310, planned: 310, transaction: 'x2' }] } }, run: async (page) => {
    await page.waitForSelector('.fx-missing li:has-text("Electric"):has-text("Due Sun, Oct 18, 12 days ago")', { timeout: 5000 });
    if ((await page.$$('.fx-missing li')).length !== 1) throw new Error('more than Electric is said: ' + await page.textContent('.fx-missing'));
    await page.click('.fx-missing button:text-is("Transactions")');
    await page.waitForSelector('.fx-transactions', { timeout: 5000 });
  } },
  // A subscription charged the same new price twice in a row: the Dashboard asks to update the plan; Keep is remembered on
  // this device, Update keeps the new amount. Charged a new price once, it asks nothing.
  ...[['Update to $17.99', 17.99], ['Keep $15.49', 15.49]].map(([button, want]) => ({ name: `Finances: a subscription's new price, ${button}`, screen: 'finances', mock: { finances: { ...finances, paid: [...(finances.paid || []),
    { payment: 'netflix', due: '2026-09-03', date: '2026-09-03', amount: 17.99, planned: 15.49, transaction: 'x1' },
    { payment: 'netflix', due: '2026-10-03', date: '2026-10-03', amount: 17.99, planned: 15.49, transaction: 'x2' },
    { payment: 'spotify', due: '2026-10-12', date: '2026-10-12', amount: 12.99, planned: 11.99, transaction: 'x3' }] } }, run: async (page) => {
    await page.waitForSelector('.fx-prices li:has-text("Netflix is now $17.99, was $15.49")', { timeout: 5000 });
    if (await page.$('.fx-prices li:has-text("Spotify")')) throw new Error('one new charge asks to change the plan');
    await page.click(`.fx-prices button:text-is("${button}")`);
    if (want === 17.99) {
      await page.waitForFunction(() => window.__MOCK.financesSaved?.length === 1, null, { timeout: 5000 });
      const x = await page.evaluate(() => window.__MOCK.financesSaved[0].payments.find((q) => q.id === 'netflix'));
      if (x.amount !== 17.99) throw new Error(`saved ${JSON.stringify(x)}`);
    } else {
      await page.waitForSelector('.fx-prices', { state: 'detached', timeout: 5000 });
      if (await page.evaluate(() => window.__MOCK.financesSaved)) throw new Error('Keep saved the plan');
      // Opened again: what this device kept is what it starts with. Carried over by hand, as Status's place is: a reloaded
      // file:// page in this browser can start with empty storage when the machine is busy.
      const kept = await page.evaluate(() => JSON.stringify({ ...localStorage }));
      if (!Object.keys(JSON.parse(kept)).some((k) => k.startsWith('homelab.finances.keptPrice.netflix.'))) throw new Error('Keep kept nothing on this device');
      await page.addInitScript((k) => { for (const [key, value] of Object.entries(JSON.parse(k))) localStorage.setItem(key, value); }, kept);
      await page.reload();
      await page.waitForSelector('#finances.active .fx-paycheck', { timeout: 5000 });
      if (await page.$('.fx-prices')) throw new Error('Keep was not remembered');
    }
  } })),
  { name: 'The phone, view only: a subscription\'s new price is said, with nothing to press', screen: 'finances', phone: ['companion', 'finances'], mock: { finances: { ...finances, readOnly: true, paid: [
    { payment: 'netflix', due: '2026-09-03', date: '2026-09-03', amount: 17.99, planned: 15.49, transaction: 'x1' },
    { payment: 'netflix', due: '2026-10-03', date: '2026-10-03', amount: 17.99, planned: 15.49, transaction: 'x2' }] } }, run: async (page) => {
    await page.waitForSelector('.fx-prices li:has-text("Netflix is now $17.99, was $15.49")', { timeout: 5000 });
    if (await page.$('.fx-prices button')) throw new Error('a phone that may only look can change the price');
  } },
  // A row that plainly pays a planned payment (its name or brand, its amount give or take a tenth, near one of its days) is
  // linked to it, so the plan does not take it out again; the preview says so, and the link can be taken off there.
  { name: 'Finances: an imported bill paid early is linked to its planned payment, and can be unlinked', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-transactions button:text-is("Import a file")');
    const csv = 'Date,Description,Amount\n10/29/2026,NETFLIX.COM,-15.49\n10/29/2026,PELOTON INTERACTIVE,-60.00\n10/28/2026,ELECTRIC COMPANY,-150.00\n';
    await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'bank.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.waitForSelector('#finSheet .formsub:has-text("3 to bring in")', { timeout: 5000 });
    await page.waitForSelector('#finSheet .importlist li:has(strong:text-is("Netflix")) .importlink:has-text("Looks like Netflix, planned $15.49")', { timeout: 5000 });
    await page.waitForSelector('#finSheet .importlist li:has(strong:text-is("Electric Company")) .importlink:has-text("Looks like Electric, planned $140.00")', { timeout: 5000 });
    // $60 is too far from Peloton's $44 to be it.
    if (await page.$('#finSheet .importlist li:has(strong:text-is("Peloton Interactive")) .importlink')) throw new Error('a charge a third over Peloton\'s is linked to it');
    if (!(await page.isVisible('#finSheet .importnote'))) throw new Error('the preview does not say what a link does');
    await page.selectOption('#finSheet .importlist li:has(strong:text-is("Electric Company")) select', '');
    await page.waitForSelector('#finSheet .importlist li:has(strong:text-is("Electric Company")) .importlink:has-text("Not a planned payment")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Bring in 3")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const txs = await page.evaluate(() => window.__MOCK.ledgerSaved.at(-1).transactions.slice(-3).map((t) => `${t.payee}|${t.payment || ''}`));
    if (txs.join() !== 'Netflix|netflix,Peloton Interactive|,Electric Company|') throw new Error(`saved ${txs}`);
  } },
  // Money in from someone, in a bank's file by their name, is linked to what they send as planned.
  { name: 'Finances: an imported transfer from someone is linked to the money they send', screen: 'finances', mock: { finances: moneyIn }, run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-transactions button:text-is("Import a file")');
    const csv = 'Date,Description,Amount\n10/30/2026,ZELLE FROM SAM,900.00\n10/30/2026,ZELLE FROM PAT,900.00\n';
    await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'bank.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.waitForSelector('#finSheet .importlist li:has(strong:text-is("Zelle from Sam")) .importlink:has-text("Looks like Mortgage share, planned $900.00")', { timeout: 5000 });
    if (await page.$('#finSheet .importlist li:has(strong:text-is("Zelle from Pat")) .importlink')) throw new Error('money from someone else is linked to what Sam sends');
    await page.click('#finSheet button:text-is("Bring in 2")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const txs = await page.evaluate(() => window.__MOCK.ledgerSaved.at(-1).transactions.slice(-2).map((t) => `${t.payee}|${t.payment || ''}`));
    if (txs.join() !== 'Zelle from Sam|share,Zelle from Pat|') throw new Error(`saved ${txs}`);
  } },
  // A minus on checking and the same plus on savings a day later look like one transfer: Join makes them one, its arriving
  // half's bank ID kept, so the savings statement brought in again skips it. Not one transfer keeps them apart.
  ...['Join', 'Not one transfer'].map((button) => ({ name: `Finances: two rows that look like one transfer, ${button}`, screen: 'finances', mock: { ledger: { ...ledger, transactions: [...ledger.transactions,
    { id: 'o1', date: '2026-10-28', account: 'chk', amount: -500, payee: 'TRANSFER TO SAVINGS', bank: 'C1' },
    { id: 'i1', date: '2026-10-29', account: 'sav', amount: 500, payee: 'TRANSFER FROM CHECKING', bank: 'S1' },
    { id: 'o2', date: '2026-10-20', account: 'chk', amount: -40, payee: 'Gas' },
    { id: 'i2', date: '2026-10-21', account: 'sav', amount: 45, payee: 'Interest' }] } }, run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.waitForSelector('.fx-pairs li:has-text("Chase Checking → BofA Savings"):has-text("$500.00")', { timeout: 5000 });
    if ((await page.$$('.fx-pairs li')).length !== 1) throw new Error('$40 out and $45 in are taken as one transfer');
    await page.click(`.fx-pairs button:text-is("${button}")`);
    await page.waitForFunction(() => window.__MOCK.ledgerSaved?.length === 1, null, { timeout: 5000 });
    const txs = await page.evaluate(() => window.__MOCK.ledgerSaved[0].transactions);
    const o1 = txs.find((t) => t.id === 'o1'), i1 = txs.find((t) => t.id === 'i1');
    if (button === 'Join') {
      if (i1 || o1?.to !== 'sav' || o1.amount !== -500 || o1.toBank !== 'S1' || o1.bank !== 'C1') throw new Error(`joined ${JSON.stringify(txs.slice(-4))}`);
      await page.waitForSelector('.fx-pairs', { state: 'detached', timeout: 5000 });
      await page.waitForSelector('.fx-txday li:has-text("Chase Checking → BofA Savings")', { timeout: 5000 });
      // The savings statement again: its half is in already.
      await page.click('.fx-transactions button:text-is("Import a file")');
      const ofx = '<OFX><BANKTRANLIST><STMTTRN><DTPOSTED>20261029<TRNAMT>500.00<FITID>S1<NAME>TRANSFER FROM CHECKING</STMTTRN></BANKTRANLIST></OFX>';
      await page.selectOption('#finSheet label:has-text("Into the ledger of") select', 'sav');
      await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'savings.ofx', mimeType: 'application/x-ofx', buffer: Buffer.from(ofx) });
      await page.waitForSelector('#finSheet .formsub:has-text("1 already in, skipped")', { timeout: 5000 });
    } else {
      if (!o1?.apart || !i1?.apart || o1.to) throw new Error(`apart ${JSON.stringify([o1, i1])}`);
      await page.waitForSelector('.fx-pairs', { state: 'detached', timeout: 5000 });
    }
  } })),
  // Transactions already in the ledger that look like planned payments are offered, each to link or say Not it; once
  // linked, a row says what it pays. Not it is kept, so it is not offered again.
  { name: 'Finances: transactions that look like planned payments can be linked, or said not to be', screen: 'finances', mock: { ledger: { ...ledger, transactions: [...ledger.transactions,
    { id: 'e1', date: '2026-10-17', account: 'chk', amount: -142.1, payee: 'Electric Co' },
    { id: 'n1', date: '2026-10-29', account: 'chk', amount: -15.49, payee: 'NETFLIX.COM' },
    { id: 'p1', date: '2026-10-29', account: 'chk', amount: -60, payee: 'Peloton' }] } }, run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.waitForSelector('.fx-links li:has-text("Electric Co"):has-text("looks like Electric, planned $140.00 for Oct 18")', { timeout: 5000 });
    await page.waitForSelector('.fx-links li:has-text("NETFLIX.COM"):has-text("looks like Netflix")', { timeout: 5000 });
    if (await page.$('.fx-links li:has-text("Peloton")')) throw new Error('$60 to Peloton, planned $44, is offered');
    await page.waitForSelector('.fx-links button:text-is("Link all 2")', { timeout: 5000 });
    await page.click('.fx-links li:has-text("NETFLIX.COM") button:text-is("Not it")');
    await page.waitForFunction(() => window.__MOCK.ledgerSaved?.length === 1, null, { timeout: 5000 });
    const n1 = await page.evaluate(() => window.__MOCK.ledgerSaved[0].transactions.find((t) => t.id === 'n1'));
    if (!n1.notPlanned || n1.payment) throw new Error(`Not it saved ${JSON.stringify(n1)}`);
    await page.waitForSelector('.fx-links li:has-text("NETFLIX.COM")', { state: 'detached', timeout: 5000 });
    await page.click('.fx-links li:has-text("Electric Co") button:text-is("Link")');
    await page.waitForFunction(() => window.__MOCK.ledgerSaved?.length === 2, null, { timeout: 5000 });
    const e1 = await page.evaluate(() => window.__MOCK.ledgerSaved[1].transactions.find((t) => t.id === 'e1'));
    if (e1.payment !== 'electric') throw new Error(`Link saved ${JSON.stringify(e1)}`);
    await page.waitForSelector('.fx-links', { state: 'detached', timeout: 5000 });
    await page.waitForSelector('.fx-txday li:has-text("Electric Co") .fx-txpays:has-text("pays Electric")', { timeout: 5000 });
  } },
  // A transaction typed in links itself to what it plainly pays, saying so; picking None keeps it from being offered again.
  { name: 'Finances: a typed transaction links itself to the planned payment it pays', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('#finRoot .toolbar button:text-is("Add a transaction")');
    await page.waitForSelector('#finSheet:not([hidden])', { timeout: 5000 });
    await page.fill('#finSheet label:has-text("Paid to") input', 'Netflix');
    await page.fill('#finSheet label:has-text("Amount") input', '15.49');
    await page.fill('#finSheet label:has-text("Day") input', '2026-10-29');
    await page.waitForSelector('#finSheet .fx-looks:has-text("Looks like Netflix, planned $15.49")', { timeout: 5000 });
    if ((await page.inputValue('#finSheet label:has-text("Pays a planned payment") select')) !== 'netflix') throw new Error('the pick does not show the link');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    let t = await page.evaluate(() => window.__MOCK.ledgerSaved.at(-1).transactions.find((q) => q.payee === 'Netflix'));
    if (t.payment !== 'netflix' || t.notPlanned) throw new Error(`saved ${JSON.stringify(t)}`);
    // Peloton, with None picked: it pays nothing planned, and says so.
    await page.click('#finRoot .toolbar button:text-is("Add a transaction")');
    await page.fill('#finSheet label:has-text("Paid to") input', 'Peloton');
    await page.fill('#finSheet label:has-text("Amount") input', '44');
    await page.fill('#finSheet label:has-text("Day") input', '2026-11-04');
    await page.waitForSelector('#finSheet .fx-looks:has-text("Looks like Peloton")', { timeout: 5000 });
    await page.selectOption('#finSheet label:has-text("Pays a planned payment") select', '');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    t = await page.evaluate(() => window.__MOCK.ledgerSaved.at(-1).transactions.find((q) => q.payee === 'Peloton'));
    if (t.payment || !t.notPlanned) throw new Error(`saved ${JSON.stringify(t)}`);
  } },
  // A bank's wording made the name a person writes, each with its logo where it has one; one kept in the ledger as the bank
  // wrote it still shows its logo.
  { name: "Finances: a bank's wording comes in as the payee's own name, with its logo", screen: 'finances', mock: { ledger: { ...ledger, transactions: [...ledger.transactions, { id: 'raw1', date: '2026-10-29', account: 'chk', amount: -15.49, payee: 'NETFLIX.COM' }] } }, run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.waitForSelector('.fx-txday li:has-text("NETFLIX.COM") .fmark.logo', { timeout: 5000 });
    await page.click('.fx-transactions button:text-is("Import a file")');
    const csv = 'Date,Description,Amount\n10/25/2026,SQ *BLUE BOTTLE,-5.75\n10/26/2026,AMZN MKTP US*2K4AB1,-42.10\n10/27/2026,WM SUPERCENTER #1234,-88.30\n10/28/2026,PAYPAL *SPOTIFY,-11.99\n10/29/2026,POS DEBIT SHELL OIL 57444 SAN JOSE CA,-48.00\n';
    await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'bank.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.waitForSelector('#finSheet .formsub:has-text("5 to bring in")', { timeout: 5000 });
    const rows = await page.$$eval('#finSheet .importlist li', (ls) => ls.map((l) => `${l.querySelector('strong').textContent}|${!!l.querySelector('.fmark.logo:not(.auto)')}`));
    if (rows.join() !== 'Blue Bottle|false,Amazon|true,Walmart|true,Spotify|true,Shell|true') throw new Error(`read as ${rows}`);
    await page.waitForSelector('#finSheet .importlist li:has-text("Amazon") small:has-text("AMZN MKTP US*2K4AB1")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Bring in 5")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const txs = await page.evaluate(() => window.__MOCK.ledgerSaved.at(-1).transactions.slice(-5).map((t) => `${t.payee}|${t.note}`));
    if (txs.join() !== 'Blue Bottle|SQ *BLUE BOTTLE,Amazon|AMZN MKTP US*2K4AB1,Walmart|WM SUPERCENTER #1234,Spotify|PAYPAL *SPOTIFY,Shell|POS DEBIT SHELL OIL 57444 SAN JOSE CA') throw new Error(`saved ${txs}`);
  } },
  // A logo picked on a transaction is its payee's: every transaction to it takes it, and a new one too; None picked stays none.
  { name: 'Finances: a logo picked on a transaction goes with its payee', screen: 'finances', mock: { ledger: { ...ledger, transactions: [{ id: 'bb1', date: '2026-10-20', account: 'chk', amount: -5.75, payee: 'Blue Bottle', category: 'Eating out' }, { id: 'bb2', date: '2026-10-21', account: 'chk', amount: -6.25, payee: 'Blue Bottle', category: 'Eating out' }, ...ledger.transactions] } }, run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-txday li:has-text("Blue Bottle") button');
    if (await page.$('#finSheet .formhead .fmark.logo:not(.auto)')) throw new Error('Blue Bottle has a logo to start');
    await page.click('#finSheet button:text-is("Change logo")');
    await page.fill('#finSheet .txlogo .brandsearch', 'kroger');
    await page.click('#finSheet .txlogo .brandgrid button:has-text("Kroger")');
    await page.waitForSelector('#finSheet .formhead .fmark.logo:not(.auto)', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    let txs = await page.evaluate(() => window.__MOCK.ledgerSaved.at(-1).transactions.filter((t) => t.payee === 'Blue Bottle').map((t) => t.institution));
    if (txs.join() !== 'kroger,kroger') throw new Error(`Blue Bottle took ${txs}`);
    await page.click('#finRoot .toolbar button:text-is("Add a transaction")');
    await page.fill('#finSheet label:has-text("Paid to") input', 'Blue Bottle');
    await page.waitForSelector('#finSheet .formhead .fmark.logo:not(.auto)', { timeout: 5000 });
    await page.fill('#finSheet label:has-text("Amount") input', '12');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    txs = await page.evaluate(() => window.__MOCK.ledgerSaved.at(-1).transactions.filter((t) => t.payee === 'Blue Bottle').map((t) => t.institution));
    if (txs.join() !== 'kroger,kroger,kroger') throw new Error(`a new one took ${txs}`);
    // None picked for Costco: no logo, though its name has one.
    await page.click('.fx-txday li:has-text("Costco") button');
    await page.click('#finSheet button:text-is("Change logo")');
    await page.click('#finSheet .txlogo .brandgrid button:has-text("None")');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    if ((await page.evaluate(() => window.__MOCK.ledgerSaved.at(-1).transactions.find((t) => t.id === 't7').institution)) !== 'none') throw new Error('None not kept');
    await page.waitForSelector('.fx-txday li:has-text("Costco") .fmark:not(.logo)', { timeout: 5000 });
  } },
  // A payee with no brand and no category's icon gets its own mark: its initials on the colour its name picks, the same for each
  // of its transactions; a brand keeps its logo, a category its icon, and money moved between accounts its arrows.
  { name: "Finances: a payee with no brand has a mark of its own", screen: 'finances', mock: { ledger: { ...ledger, transactions: [{ id: 'bb1', date: '2026-10-20', account: 'chk', amount: -5.75, payee: 'SQ *BLUE BOTTLE' }, { id: 'bb2', date: '2026-10-21', account: 'chk', amount: -6.25, payee: 'Blue Bottle' }, ...ledger.transactions] } }, run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    const marks = await page.$$eval('.fx-txday li:has-text("BLUE BOTTLE"), .fx-txday li:has-text("Blue Bottle")', (ls) => ls.map((l) => { const m = l.querySelector('.fmark'); return `${m.textContent}|${m.className}`; }));
    if (marks.length !== 2 || new Set(marks).size !== 1 || !/^BB\|fmark logo mono auto a[0-7] two$/.test(marks[0])) throw new Error(`Blue Bottle's marks: ${marks}`);
    // A category's icon comes first: the paycheck keeps its Income icon.
    await page.waitForSelector(".fx-txday li:has-text(\"Jordan's paycheck\") .fmark.icon[data-icon=\"savings\"]", { timeout: 5000 });
    await page.waitForSelector('.fx-txday li:has-text("Costco") .fmark.logo:not(.auto)', { timeout: 5000 });
    if (await page.$('.fx-txday li:has-text("Roth IRA") .fmark.auto')) throw new Error('money moved between accounts took a mark of its own');
  } },
  // Everyday chains have their logos, from a bank's wording too: a mark from simple-icons, or initials on the brand's colour;
  // an everyday word that is also a brand's name gets none unless it is the brand itself.
  { name: 'Finances: everyday chains show their logos', screen: 'finances', mock: { ledger: { ...ledger, transactions: [
    { id: 'c1', date: '2026-10-21', account: 'chk', amount: -4.5, payee: 'DUNKIN #3456' }, { id: 'c2', date: '2026-10-21', account: 'chk', amount: -210, payee: 'BOOKING.COM' },
    { id: 'c3', date: '2026-10-21', account: 'chk', amount: -89, payee: 'IKEA' }, { id: 'c4', date: '2026-10-21', account: 'chk', amount: -2.9, payee: 'MTA NYC SUBWAY FARE' },
    { id: 'c5', date: '2026-10-21', account: 'chk', amount: -9.25, payee: "TRADER JOE'S #552" }, ...ledger.transactions] } }, run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    const mark = (who) => page.$eval(`.fx-txday li:has-text("${who}") .fmark`, (m) => `${m.className}|${m.textContent}`);
    const got = { dunkin: await mark('DUNKIN'), booking: await mark('BOOKING.COM'), ikea: await mark('IKEA'), subway: await mark('SUBWAY FARE'), tj: await mark("TRADER JOE'S") };
    if (got.dunkin !== 'fmark logo mono|D' || !/^fmark logo\|$/.test(got.booking) || !/^fmark logo\|$/.test(got.ikea) || !/ auto /.test(got.subway) || got.tj !== 'fmark logo mono two|TJ') throw new Error(`marks ${JSON.stringify(got)}`);
  } },
  { name: 'Finances: an OFX statement comes in once, however often it is imported', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    const ofx = 'OFXHEADER:100\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>\n<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261031120000<TRNAMT>-15.49<FITID>X1<NAME>NETFLIX.COM<MEMO>Streaming\n</STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>\n';
    for (const round of [1, 2]) {
      await page.click('.fx-transactions button:text-is("Import a file")');
      await page.selectOption('#finSheet label:has-text("Into the ledger of") select', 'visa');
      await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'freedom.qfx', mimeType: 'application/x-ofx', buffer: Buffer.from(ofx) });
      if (round === 1) {
        await page.waitForSelector('#finSheet .formsub:has-text("1 to bring in")', { timeout: 5000 });
        await page.click('#finSheet button:text-is("Bring in 1")');
        await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
        const nf = await page.evaluate(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions.find((t) => t.bank === 'X1'));
        // The payee as a person writes it, the bank's own wording kept in the note with its memo.
        if (nf?.payee !== 'Netflix' || nf.amount !== -15.49 || nf.account !== 'visa' || nf.note !== 'Streaming (NETFLIX.COM)') throw new Error(`saved ${JSON.stringify(nf)}`);
      } else {
        await page.waitForSelector('#finSheet .formsub:has-text("0 to bring in"):has-text("1 already in, skipped")', { timeout: 5000 });
        if (!(await page.isDisabled('#finSheet button:text-is("Bring in")'))) throw new Error('the same statement can be brought in twice');
      }
    }
  } },
  { name: 'Finances: a European bank\'s CSV reads its days and amounts', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-transactions button:text-is("Import a file")');
    await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'konto.csv', mimeType: 'text/csv', buffer: Buffer.from('Datum;Empfänger;Betrag\n30.10.2026;REWE Markt;-1.234,56\n') });
    await page.waitForSelector('#finSheet .importlist li:has-text("REWE Markt"):has-text("Fri, Oct 30"):has-text("−$1,234.56")', { timeout: 5000 });
  } },
  // Found in the ledger: a payee paid on a rhythm the plan does not have, added to it in one click.
  { name: 'Finances: a bill found in the transactions is added to the plan', screen: 'finances', mock: { finances: { ...finances, found: [{ payee: 'Hulu', account: 'chk', amount: 17.99, every: 'month', since: '2026-06-03', last: '2026-10-03', next: '2026-11-03', times: 5, category: 'Streaming and music' }] } }, run: async (page) => {
    await finTab(page, 'Recurring', { timeout: 5000 });
    await page.waitForSelector('.fx-found li:has-text("Hulu"):has-text("$17.99 monthly since Jun 3 · 5 times · next about Nov 3") .fmark.logo', { timeout: 5000 });
    await page.click('.fx-found li:has-text("Hulu") button:text-is("Add to the plan")');
    await page.waitForFunction(() => window.__MOCK.financesSaved?.length, null, { timeout: 5000 });
    const x = await page.evaluate(() => window.__MOCK.financesSaved.at(-1).payments.find((p) => p.name === 'Hulu'));
    if (x?.amount !== 17.99 || x.kind !== 'subscriptions' || x.schedule.every !== 'month' || x.schedule.start !== '2026-11-03' || x.from) throw new Error(`added ${JSON.stringify(x)}`);
  } },
  // A phone allowed only to look opens no form, but a row with a receipt opens it under the row; one no longer kept says so.
  { name: 'The phone, view only: a receipt shown under its transaction', screen: 'finances', phone: ['companion', 'finances'], mock: {
    finances: { ...finances, readOnly: true },
    ledger: { ...ledger, transactions: ledger.transactions.map((t) => (t.id === 't7' ? { ...t, receipt: '0'.repeat(31) + '7.jpg' } : t.id === 't6' ? { ...t, receipt: '0'.repeat(31) + '8.pdf' } : t)) },
    receipts: { ['0'.repeat(31) + '7.jpg']: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' },
  }, run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.waitForSelector('.fx-txday li:has-text("Costco") button:has(.sr:text-is(", see the receipt"))', { timeout: 5000 });
    if (await page.$('.fx-txday li:has-text("Trader Joe") button')) throw new Error('a row with no receipt opens on a phone allowed only to look');
    await page.click('.fx-txday li:has-text("Costco") button');
    await page.waitForSelector('.fx-receiptshown img.receiptview[alt="The receipt"]', { timeout: 5000 });
    if (await page.$('#finSheet:not([hidden])')) throw new Error('a form opened on a phone allowed only to look');
    await page.waitForSelector('.fx-txday li:has-text("Costco") button:has(.sr:text-is(", hide the receipt"))', { timeout: 5000 });
    await page.click('.fx-txday li:has-text("Costco") button');
    await page.waitForSelector('.fx-receiptshown', { state: 'detached', timeout: 5000 });
    await page.click('.fx-txday li:has-text("Shell") button');
    await page.waitForSelector('.fx-receiptshown .formerr:has-text("is not kept here any more")', { timeout: 5000 });
  } },
  { name: 'The phone, view only: nothing found is offered to add', screen: 'finances', phone: ['companion', 'finances'], mock: { finances: { ...finances, readOnly: true, found: [{ payee: 'Hulu', account: 'chk', amount: 17.99, every: 'month', since: '2026-06-03', last: '2026-10-03', next: '2026-11-03', times: 5 }] } }, run: async (page) => {
    await finTab(page, 'Recurring', { timeout: 5000 });
    await page.waitForSelector('.fx-payments', { timeout: 5000 });
    if (await page.$('.fx-found')) throw new Error('a phone allowed only to look is offered to add a payment');
  } },
  { name: 'Finances: add, change, and delete a transaction', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('#finRoot .toolbar button:text-is("Add a transaction")');
    await page.waitForSelector('#finSheet:not([hidden]) h2:text-is("Add a transaction")', { timeout: 5000 });
    // A planned payment fills in what is still empty.
    await page.selectOption('#finSheet label:has-text("Pays a planned payment") select', 'netflix');
    if ((await page.inputValue('#finSheet label:has-text("Paid to") input')) !== 'Netflix' || (await page.inputValue('#finSheet label:has-text("Amount") input')) !== '15.49' || (await page.inputValue('#finSheet label:has-text("Category") input')) !== 'Subscriptions') throw new Error('the planned payment did not fill the form');
    await page.waitForSelector('#finSheet .formhead .fmark.logo', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    let saved = await page.evaluate(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions);
    const nf = saved?.find((t) => t.payee === 'Netflix');
    if (!nf || nf.amount !== -15.49 || nf.account !== 'chk' || nf.payment !== 'netflix' || saved.length !== 8) throw new Error(`saved ${JSON.stringify(nf)}, ${saved?.length}`);
    // Costco changed to $90.
    await page.click('.fx-txday li:has-text("Costco") button');
    // The sheet open on Costco, its cursor put in its first field (a frame
    // after it opens), before the amount is typed: on a slow runner the 90
    // once went into the payee ("Costco90").
    await page.waitForSelector('#finSheet:not([hidden]) #finSheetTitle:text-is("Costco")', { timeout: 5000 });
    await page.waitForFunction(() => document.getElementById('finSheet')?.contains(document.activeElement), null, { timeout: 5000 });
    await page.fill('#finSheet label:has-text("Amount") input', '90');
    if ((await page.inputValue('#finSheet label:has-text("Amount") input')) !== '90' || (await page.inputValue('#finSheet label:has-text("Paid to") input')) !== 'Costco') throw new Error('the amount was not typed into Amount alone');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    saved = await page.evaluate(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions);
    if (saved.find((t) => t.id === 't7')?.amount !== -90) throw new Error(`Costco saved as ${JSON.stringify(saved.find((t) => t.id === 't7'))}`);
    // Shell deleted, asked twice.
    await page.click('.fx-txday li:has-text("Shell") button');
    await page.click('#finSheet button:text-is("Delete")');
    await page.click('#finSheet button:text-is("Click again to delete")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    saved = await page.evaluate(() => window.__MOCK.ledgerSaved?.at(-1)?.transactions);
    if (saved.some((t) => t.payee === 'Shell') || saved.length !== 7) throw new Error(`after delete: ${saved.map((t) => t.payee)}`);
    // Between my accounts needs the account it went into.
    await page.click('#finRoot .toolbar button:text-is("Add a transaction")');
    await page.click('#finSheet .kindswap [role=radio]:text-is("Between my accounts")');
    await page.fill('#finSheet label:has-text("Amount") input', '100');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet .formerr:has-text("Pick the account it went into")', { timeout: 5000 });
  } },
  { name: 'Finances: a save of transactions after another device\'s reads the latest and keeps the form', screen: 'finances', mock: { ledgerConflict: true }, run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('#finRoot .toolbar button:text-is("Add a transaction")');
    await page.fill('#finSheet label:has-text("Paid to") input', 'Bakery');
    await page.fill('#finSheet label:has-text("Amount") input', '7');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#error:not([hidden]):has-text("changed on another device")', { timeout: 5000 });
    if (!(await page.isVisible('#finSheet')) || (await page.inputValue('#finSheet label:has-text("Paid to") input')) !== 'Bakery') throw new Error('the form closed or lost what was typed');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
  } },
  { name: 'The phone, view only: transactions with nothing to add or open', screen: 'finances', phone: ['companion', 'finances'], mock: { finances: { ...finances, readOnly: true } }, run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.waitForSelector('.fx-txday li:has-text("Costco")', { timeout: 5000 });
    if (await page.$('.fx-txday li button, #finRoot .toolbar button, .fx-budgets .fx-actions button, .fx-transactions .fx-actions button')) throw new Error('a phone allowed only to look can add or open a transaction, or edit budgets or categories');
    // A budget only shows its transactions (the list filtered to it), and nothing is saved.
    await page.click('.fx-budgets li:has(.grow > strong:text-is("Food")) button');
    if ((await page.inputValue('.fx-txfilters select[aria-label="Category"]')) !== 'Food') throw new Error('a budget did not show its transactions');
    if (await page.evaluate(() => window.__MOCK.financesSaved?.length || window.__MOCK.ledgerSaved?.length)) throw new Error('a phone allowed only to look saved something');
  } },
  { name: 'Finances: no transactions yet says how to add one', screen: 'finances', mock: { ledger: null }, run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.waitForSelector('.fx-transactions :text("No transactions yet: add what you spend")', { timeout: 5000 });
  } },
  { name: 'Finances: twice a month on the same day twice says so and is not saved', screen: 'finances', run: async (page) => {
    await page.click('#finRoot .toolbar button:text-is("Add a payment")', { timeout: 5000 });
    await page.fill('#finSheet label:has-text("Name") input', 'Rent');
    await page.fill('#finSheet label:has-text("Amount") input', '900');
    await page.selectOption('#finSheet label:has-text("How often") select', 'twice a month');
    await page.fill('#finSheet input[type=date]', '2026-11-15');
    await page.fill('#finSheet label:has-text("And on day") input', '15');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet .formerr:has-text("the first one again")', { timeout: 5000 });
    if (await page.evaluate(() => window.__MOCK.financesSaved)) throw new Error('saved the 15th and the 15th');
  } },
  { name: 'Finances: what is taken as done since the balances were typed in can be marked Not yet', screen: 'finances', mock: { finances: since }, run: async (page) => {
    await page.waitForSelector('.fx-since li:has-text("Jordan\'s paycheck"):has-text("since the balance") [role=radio][aria-checked=true]:text-is("In")', { timeout: 5000 });
    await page.waitForSelector('.fx-since li:has-text("HOA"):has-text("not yet: it comes today") [role=radio][aria-checked=true]:text-is("Not yet")', { timeout: 5000 });
    await page.click('.fx-since li:has-text("Jordan\'s paycheck") [role=radio]:text-is("Not yet")');
    await page.waitForFunction(() => window.__MOCK.financesSaved?.length === 1, null, { timeout: 5000 });
    const saved = await page.evaluate(() => window.__MOCK.financesSaved[0]);
    if (saved.waiting?.join() !== 'payment:hoa:2026-10-28,pay:jordan:2026-10-26' || saved.notYet) throw new Error(`waiting ${saved.waiting}, notYet ${saved.notYet}`);
  } },
  // A bill due the day the balances were typed in comes out that day; Already in says the balance has it, and is kept.
  { name: 'Finances: a bill on the day the balances were typed comes out, unless Already in', screen: 'finances', mock: { finances: { ...since, plan: { ...since.plan, waiting: ['payment:hoa:2026-10-28'] }, since: [
    { key: 'payment:netflix:2026-10-25', date: '2026-10-25', payment: 'netflix', amount: 15.49, typed: true },
    ...since.since,
  ] } }, run: async (page) => {
    await page.waitForSelector('.fx-since li:has-text("Netflix"):has-text("due the day the balance was typed") [role=radio][aria-checked=true]:text-is("Comes out")', { timeout: 5000 });
    if (!(await page.textContent('.fx-since .fx-lead')).includes('A bill due that day still comes out')) throw new Error('the list does not say a bill that day comes out');
    await page.click('.fx-since li:has-text("Netflix") [role=radio]:text-is("Already in")');
    await page.waitForFunction(() => window.__MOCK.financesSaved?.length === 1, null, { timeout: 5000 });
    const saved = await page.evaluate(() => window.__MOCK.financesSaved[0]);
    // What waits stays waiting; the bill is now in the balance.
    if (saved.inBalance?.join() !== 'payment:netflix:2026-10-25' || saved.waiting?.join() !== 'payment:hoa:2026-10-28') throw new Error(`in the balance ${saved.inBalance}, waiting ${saved.waiting}`);
  } },
  { name: 'The phone, view only: what is taken as done is shown, with nothing to mark', screen: 'finances', phone: ['companion', 'finances'], mock: { finances: { ...since, readOnly: true, since: [{ key: 'payment:netflix:2026-10-25', date: '2026-10-25', payment: 'netflix', amount: 15.49, typed: true, inBalance: true }, ...since.since] } }, run: async (page) => {
    await page.waitForSelector('.fx-since li:has-text("Netflix"):has-text("already in the balance")', { timeout: 5000 });
    if (await page.$('.fx-since [role=radio]')) throw new Error('a phone that may only look can mark what is taken as done');
  } },
  { name: 'Finances: typed changes are not dropped by one Cancel or Escape', screen: 'finances', run: async (page) => {
    await page.click('#finRoot .toolbar button:text-is("Add a payment")', { timeout: 5000 });
    await page.fill('#finSheet label:has-text("Name") input', 'Gym');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#finSheet:not([hidden]) .formerr:has-text("Nothing here is saved")', { timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    if (await page.evaluate(() => window.__MOCK.financesSaved)) throw new Error('saved on Cancel');
    // Nothing typed: one Cancel closes.
    await page.click('#finRoot .toolbar button:text-is("Add a payment")');
    await page.click('#finSheet button:text-is("Cancel")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
  } },
  // Cancel asked about, then Save: what stops the save is what shows, not the Cancel's question.
  { name: 'Finances: a Save after Cancel says what stops it', screen: 'finances', run: async (page) => {
    await page.click('#finRoot .toolbar button:text-is("Add a payment")', { timeout: 5000 });
    await page.fill('#finSheet label:has-text("Name") input', 'Gym');
    await page.click('#finSheet button:text-is("Cancel")');
    await page.waitForSelector('#finSheet .formerr:has-text("Nothing here is saved")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet:not([hidden]) .formerr:text-is("Type how much it is.")', { timeout: 5000 });
    // And Cancel asks again before it drops what was typed.
    await page.click('#finSheet button:text-is("Cancel")');
    await page.waitForSelector('#finSheet:not([hidden]) .formerr:has-text("Nothing here is saved")', { timeout: 5000 });
  } },
  // A filter whose last transaction is deleted lets go: its menu would say Every category over an empty list.
  { name: 'Finances: a transaction filter lets go when its last transaction goes', screen: 'finances', run: async (page) => {
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.selectOption('.fx-txfilters select[aria-label="Category"]', 'Gas');
    await page.waitForSelector('.fx-transactions h2:text-is("1 transaction of 7")', { timeout: 5000 });
    await page.click('.fx-txday li:has-text("Shell") button');
    await page.click('#finSheet button:text-is("Delete")');
    await page.click('#finSheet button:text-is("Click again to delete")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    await page.waitForSelector('.fx-transactions h2:text-is("Transactions")', { timeout: 5000 });
    if (await page.$('.fx-transactions :text("None match")')) throw new Error('filtered by a category with nothing in it');
    if ((await page.inputValue('.fx-txfilters select[aria-label="Category"]')) !== '') throw new Error('the menu still has a pick');
  } },
  { name: 'Finances: amounts in euros, typed the European way', screen: 'finances', mock: { finances: { ...finances, plan: { ...finances.plan, currency: 'EUR' } } }, run: async (page) => {
    await page.waitForSelector('.fx-paycheck .fx-figure:has-text("€")', { timeout: 5000 });
    await page.click('#finRoot .toolbar button:text-is("Update balances")', { timeout: 5000 });
    await page.waitForSelector('#finSheet input#bal-chk:focus', { timeout: 5000 });
    await page.fill('#finSheet input#bal-sav', '7.000,50');
    await page.click('#finSheet button:text-is("Save")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
    const sav = await page.evaluate(() => window.__MOCK.financesSaved?.[0]?.accounts.find((a) => a.id === 'sav'));
    if (sav?.balance !== 7000.5) throw new Error(`saved ${sav?.balance}`);
  } },
  { name: 'Finances: Pay keeps the bank holidays and currency picked', screen: 'finances', run: async (page) => {
    await finTab(page, 'Pay', { timeout: 5000 });
    await page.selectOption('.finsettings select >> nth=0', 'uk');
    await page.waitForFunction(() => window.__MOCK.financesSaved?.length === 1, null, { timeout: 5000 });
    await page.selectOption('.finsettings select >> nth=1', 'GBP');
    await page.waitForFunction(() => window.__MOCK.financesSaved?.length === 2, null, { timeout: 5000 });
    const saved = await page.evaluate(() => window.__MOCK.financesSaved[1]);
    if (saved.holidays !== 'uk' || saved.currency !== 'GBP') throw new Error(`saved ${saved.holidays} ${saved.currency}`);
    await page.waitForSelector('.fx-person:has-text("£")', { timeout: 5000 });
  } },
  { name: 'Finances: a new homelab starts with three things to add', screen: 'finances', mock: { finances: null }, run: async (page) => {
    await page.click('.finstart button:text-is("Add an account")', { timeout: 5000 });
    await page.waitForSelector('#finSheet:not([hidden]) h2:text-is("Add a checking account")', { timeout: 5000 });
    await page.click('#finSheet button:text-is("Cancel")');
    await page.waitForSelector('#finSheet', { state: 'hidden', timeout: 5000 });
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
  { name: 'Status, filtered by name', screen: 'status', before: async (page) => { await page.waitForSelector('#statusRows tr.grouphead', { timeout: 5000 }); await page.keyboard.type('me'); await page.waitForSelector('.filterbox input'); } },
  { name: 'Command palette, an app typed', screen: 'status', before: async (page) => { await page.waitForSelector('#statusRows tr.grouphead', { timeout: 5000 }); await page.keyboard.press((await page.evaluate(() => /Mac/.test(navigator.platform))) ? 'Meta+k' : 'Control+k'); await page.keyboard.type('navi'); await page.waitForSelector('.palette [role=option]'); } },
  { name: 'Status after a crash', screen: 'status', mock: { crash: crashed } },
  { name: 'Choose apps', screen: 'choose' },
  { name: 'Backups', screen: 'backups' },
  { name: 'Setup', screen: 'setup' },
  // The runtime down and no folder yet; each system's hint and folder are its own (systems).
  { name: 'Setup on a new machine', screen: 'setup', mock: { host: { runtimeOK: false, runtimeInstalled: true, rootOK: false, root: '', disks: [], kit: true } } },
  { name: 'Settings', screen: 'settings' },
  { name: 'Finances', screen: 'finances' },
  { name: 'Finances before anything is typed in', screen: 'finances', mock: { finances: null } },
  { name: 'Finances, with what has happened since the balances', screen: 'finances', mock: { finances: since } },
  { name: 'Finances, money moved in from savings', screen: 'finances', mock: { finances: movedIn } },
  { name: 'Finances, Net worth', screen: 'finances', before: async (page) => { await finTab(page, 'Net worth', { timeout: 5000 }); } },
  { name: 'Finances, Recurring, found in the transactions', screen: 'finances', mock: { finances: { ...finances, found: [{ payee: 'Hulu', account: 'chk', amount: 17.99, every: 'month', since: '2026-06-03', last: '2026-10-03', next: '2026-11-03', times: 5, category: 'Streaming and music' }, { payee: 'Climbing gym', account: 'chk', amount: 22, every: 'week', since: '2026-09-02', last: '2026-10-28', next: '2026-11-04', times: 9 }] } }, before: async (page) => { await finTab(page, 'Recurring', { timeout: 5000 }); await page.waitForSelector('.fx-found', { timeout: 5000 }); } },
  { name: 'Finances, Reports, exported', screen: 'finances', before: async (page) => { await finTab(page, 'Reports', { timeout: 5000 }); await page.click('.fx-reportsum button:text-is("Export CSV")'); await page.waitForSelector('.fx-exported:not(:empty)', { timeout: 5000 }); } },
  { name: 'Finances, a transaction with its receipt', screen: 'finances', before: async (page) => { await finTab(page, 'Transactions', { timeout: 5000 }); await page.click('.fx-txday li:has-text("Costco") button'); await page.setInputFiles('#finSheet .receipt input[type=file]', { name: 'costco.png', mimeType: 'image/png', buffer: await receiptPicture(page) }); await page.waitForSelector('#finSheet img.receiptview', { timeout: 5000 }); } },
  { name: 'The phone, Finances, a transaction with its receipt', screen: 'finances', phone: ['companion', 'finances'], before: async (page) => { await finTab(page, 'Transactions', { timeout: 5000 }); await page.click('.fx-txday li:has-text("Costco") button'); await page.setInputFiles('#finSheet .receipt input[type=file]', { name: 'costco.png', mimeType: 'image/png', buffer: await receiptPicture(page) }); await page.waitForSelector('#finSheet img.receiptview', { timeout: 5000 }); } },
  { name: 'The phone, Finances, view only, a receipt', screen: 'finances', phone: ['companion', 'finances'], mock: { finances: { ...finances, readOnly: true }, ledger: { ...ledger, transactions: ledger.transactions.map((t) => (t.id === 't7' ? { ...t, receipt: '0'.repeat(31) + '7.jpg' } : t)) } }, before: async (page) => {
    const url = 'data:image/png;base64,' + (await receiptPicture(page)).toString('base64');
    await page.evaluate((u) => { window.__MOCK.receipts = { ['0'.repeat(31) + '7.jpg']: u }; }, url);
    await finTab(page, 'Transactions', { timeout: 5000 });
    await page.click('.fx-txday li:has-text("Costco") button');
    await page.waitForSelector('.fx-receiptshown img.receiptview', { timeout: 5000 });
  } },
  { name: 'Finances, an account in another currency', screen: 'finances', before: async (page) => { await finTab(page, 'Net worth', { timeout: 5000 }); await page.click('#finRoot .toolbar button:text-is("Add an account")'); await page.click('#finSheet button.kindrow:has(strong:text-is("Retirement"))'); await page.fill('#finSheet label:has-text("Name") input', 'UK pension'); await page.fill('#finSheet label:has-text("Worth") input, #finSheet label:has-text("Balance") input', '20000'); await page.fill('#finSheet label:has-text("Currency, if not USD") input', 'GBP'); await page.fill('#finSheet label:has-text("1 GBP is, in USD") input', '1.27'); await page.waitForSelector('#finSheet .formsub:has-text("is about")', { timeout: 5000 }); } },
  { name: 'Finances, Pay, a rate for euros', screen: 'finances', mock: { finances: { ...finances, start: { ...finances.start, sav: 7150 }, plan: { ...finances.plan, rates: { EUR: 1.1 }, accounts: finances.plan.accounts.map((a) => (a.id === 'sav' ? { ...a, currency: 'EUR' } : a)) } } }, before: async (page) => { await finTab(page, 'Pay', { timeout: 5000 }); await page.waitForSelector('.finrates', { timeout: 5000 }); } },
  { name: 'Finances, a goal', screen: 'finances', before: async (page) => { await finTab(page, 'Net worth', { timeout: 5000 }); await page.click('.fx-goals li:has-text("Japan trip") button'); await page.waitForSelector('#finSheet h2:text-is("Japan trip")', { timeout: 5000 }); } },
  { name: 'Finances, goals, what if', screen: 'finances', before: async (page) => { await finTab(page, 'Net worth', { timeout: 5000 }); await page.selectOption('.fx-whatif select[aria-label="Which goal"]', 'japan'); await page.fill('.fx-whatif input[aria-label="Put by a paycheck"]', '300'); await page.waitForSelector('.fx-whatif [role=status]:has-text("gets there by")', { timeout: 5000 }); } },
  { name: 'The phone, Finances, goals, what if', screen: 'finances', phone: ['companion', 'finances'], before: async (page) => { await finTab(page, 'Net worth', { timeout: 5000 }); await page.selectOption('.fx-whatif select[aria-label="Which goal"]', 'japan'); await page.fill('.fx-whatif input[aria-label="Put by a paycheck"]', '300'); await page.waitForSelector('.fx-whatif [role=status]:has-text("gets there by")', { timeout: 5000 }); } },
  { name: 'Finances, loans, pay more', screen: 'finances', mock: { finances: { ...finances, loans: ratedLoans } }, before: async (page) => { await finTab(page, 'Net worth', { timeout: 5000 }); await page.fill('.fx-paymore input[aria-label="More a paycheck"]', '100'); await page.waitForSelector('.fx-ways li', { timeout: 5000 }); } },
  { name: 'The phone, Finances, loans, pay more', screen: 'finances', phone: ['companion', 'finances'], mock: { finances: { ...finances, loans: ratedLoans } }, before: async (page) => { await finTab(page, 'Net worth', { timeout: 5000 }); await page.fill('.fx-paymore input[aria-label="More a paycheck"]', '100'); await page.waitForSelector('.fx-ways li', { timeout: 5000 }); } },
  { name: "Finances, a car's purchase", screen: 'finances', before: async (page) => { await finTab(page, 'Net worth', { timeout: 5000 }); await acctForm(page, '.fx-ownlist li:has-text("RAV4") button'); await page.waitForSelector('#finSheet .formsub:has-text("At its age")', { timeout: 5000 }); } },
  { name: 'Finances, Pay, a calendar link', screen: 'finances', mock: { finances: { ...finances, plan: { ...finances.plan, calendarKey: '3f9a1c07be52d84e6a0b19c7d2e8f45a10b6c3d97e2f8a41', calendarAmounts: true } } }, before: async (page) => { await finTab(page, 'Pay', { timeout: 5000 }); await page.waitForSelector('.fincalendar input[aria-label="Calendar link"]', { timeout: 5000 }); } },
  { name: "Finances, Import a bank's wording", screen: 'finances', before: async (page) => { await finTab(page, 'Transactions', { timeout: 5000 }); await page.click('.fx-transactions button:text-is("Import a file")'); await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'bank.csv', mimeType: 'text/csv', buffer: Buffer.from('Date,Description,Amount\n10/25/2026,SQ *BLUE BOTTLE,-5.75\n10/26/2026,AMZN MKTP US*2K4AB1,-42.10\n10/27/2026,WM SUPERCENTER #1234,-88.30\n10/28/2026,PAYPAL *SPOTIFY,-11.99\n10/29/2026,POS DEBIT SHELL OIL 57444 SAN JOSE CA,-48.00\n') }); await page.waitForSelector('#finSheet .formsub:has-text("5 to bring in")', { timeout: 5000 }); } },
  { name: "Finances, a transaction's logo picked", screen: 'finances', before: async (page) => { await finTab(page, 'Transactions', { timeout: 5000 }); await page.click('.fx-txday li:has-text("Trader Joe\'s") button'); await page.click('#finSheet button:text-is("Change logo")'); await page.fill('#finSheet .txlogo .brandsearch', 'kroger'); await page.click('#finSheet .txlogo .brandgrid button:has-text("Kroger")'); await page.waitForSelector('#finSheet .formhead .fmark.logo', { timeout: 5000 }); } },
  { name: 'Finances, everyday chains', screen: 'finances', mock: { ledger: { ...ledger, transactions: ['Google', 'IKEA', 'Taco Bell', 'Burger King', 'KFC', 'Uniqlo', 'H&M', 'Zara', 'Lidl', 'Tesco', 'Booking.com', 'Hotels.com', 'JetBlue', 'Shopify', 'Waze', "Trader Joe's", 'Whole Foods', 'Chick-fil-A', "Dunkin'", 'Subway', "Wendy's", 'Publix', 'Aldi', '7-Eleven', "Domino's", 'Pizza Hut', 'Safeway', 'Panera Bread', 'Dollar General', 'Gap', 'Old Navy', 'Nordstrom', 'Sephora', 'Petco', 'PetSmart', 'GameStop', 'Barnes & Noble', 'Wayfair', 'Dollar Tree'].map((payee, i) => ({ id: 'ch' + i, date: '2026-10-29', account: 'chk', amount: -10 - i, payee })) } }, before: async (page) => { await finTab(page, 'Transactions', { timeout: 5000 }); await page.waitForSelector('.fx-txday li:has-text("Dollar Tree")', { timeout: 5000 }); } },
  { name: 'Finances, subscriptions from Wallos', screen: 'finances', mock: { status: withWallos, wallos: wallosSubs }, before: async (page) => { await finTab(page, 'Recurring', { timeout: 5000 }); await page.click('.fx-wallos button:text-is("From Wallos")', { timeout: 5000 }); await page.waitForSelector('.fx-wallos [role=status]', { timeout: 5000 }); await page.$eval('.fx-wallos', (e) => e.scrollIntoView()); } },
  { name: 'Finances, Update balances from Firefly III and Ghostfolio', screen: 'finances', mock: { status: runningToo('firefly-iii', 'ghostfolio'), firefly: [{ name: 'Chase Checking', balance: 2600, currency: 'USD' }, { name: 'BofA Savings', balance: 6550, currency: 'USD' }] }, before: async (page) => { await page.click('#finRoot .toolbar button:text-is("Update balances")', { timeout: 5000 }); await page.click('#finSheet button:text-is("From Firefly III")'); await page.waitForSelector('#finSheet .fromapp [role=status]', { timeout: 5000 }); } },
  { name: 'Finances, Subscriptions', screen: 'finances', before: async (page) => { await finTab(page, 'Recurring', { timeout: 5000 }); await page.click('#finRoot .fx-payments .seg button:has-text("Subscriptions")'); } },
  { name: 'Finances, Transactions', screen: 'finances', before: async (page) => { await finTab(page, 'Transactions', { timeout: 5000 }); await page.waitForSelector('.fx-txday'); } },
  { name: 'Finances, Logos, got', screen: 'finances', mock: { noLogo: ['traderjoes.com'] }, before: async (page) => { await finTab(page, 'Transactions', { timeout: 5000 }); await page.click('.fx-transactions button:text-is("Logos")'); await page.click('#finSheet button:has-text("Get them all")'); await page.waitForSelector('#finSheet .logolist li:has-text("Costco") :text("From costco.com")'); await page.waitForSelector('#finSheet .logolist .bad'); } },
  { name: 'Finances, Transactions, two selected', screen: 'finances', before: async (page) => { await finTab(page, 'Transactions', { timeout: 5000 }); await page.click('.fx-transactions button:text-is("Select")'); await page.click('.fx-txday li.opens >> nth=0'); await page.click('.fx-txday li.opens >> nth=2'); await page.waitForSelector('.fx-txpick :text("2 transactions selected")'); } },
  { name: 'Finances, Categories', screen: 'finances', before: async (page) => { await finTab(page, 'Transactions', { timeout: 5000 }); await page.click('.fx-transactions button:text-is("Categories")'); await page.waitForSelector('#finSheet .catlist'); } },
  { name: 'Finances, Budgets', screen: 'finances', before: async (page) => { await finTab(page, 'Transactions', { timeout: 5000 }); await page.click('.fx-budgets button:text-is("Edit budgets")'); await page.waitForSelector('#finSheet .budgetlist'); } },
  { name: 'Finances, Reports', screen: 'finances', mock: { ledger: ledgerMonths }, before: async (page) => { await finTab(page, 'Reports', { timeout: 5000 }); await page.click('.fx-reportsum [role=radio]:text-is("3 months")'); await page.waitForSelector('.fx-inout'); } },
  { name: 'Finances, Import a file', screen: 'finances', before: async (page) => { await finTab(page, 'Transactions', { timeout: 5000 }); await page.click('.fx-transactions button:text-is("Import a file")'); await page.setInputFiles('#finSheet .importfile input[type=file]', { name: 'chase.csv', mimeType: 'text/csv', buffer: Buffer.from('Date,Description,Amount\n10/24/2026,TRADER JOE\'S #552,-63.75\n10/31/2026,STARBUCKS,-6.45\n') }); await page.waitForSelector('#finSheet .importlist'); } },
  // The Dashboard with three months of transactions: Cash flow's six months, Latest transactions and Spent this month.
  { name: 'Finances, Dashboard with months of transactions', screen: 'finances', mock: { ledger: ledgerMonths } },
  { name: 'Finances, Calendar', screen: 'finances', before: async (page) => { await finTab(page, 'Calendar', { timeout: 5000 }); await page.click('.fx-calendar button[aria-label="The month after"]'); await page.waitForSelector('.fx-calendar h2:has-text("November 2026")'); } },
  { name: 'Finances, Net worth with collectibles', screen: 'finances', mock: { finances: collected }, before: async (page) => { await finTab(page, 'Net worth', { timeout: 5000 }); } },
  { name: 'Finances without a checking account', screen: 'finances', mock: { finances: { ...finances, checking: '', plan: { ...finances.plan, accounts: finances.plan.accounts.filter((a) => a.kind !== 'checking') } } } },
  { name: 'Tidy Up', screen: 'tidy' },
  // Music has every part the other tabs share (its list, the genre chart, what was done), so it goes through every
  // system and accent; the other tabs through each platform's look (Mac, Windows, Linux).
  ...['Music', 'Movies', 'TV', 'Books', 'Audiobooks'].map((tab) => ({ name: `Tidy Up, ${tab}`, screen: 'tidy', ...(tab === 'Music' ? {} : { systems: ['Mac', 'Windows', 'Linux'] }), before: async (page) => { await page.click(`#tidy .seg button:text-is("${tab}")`, { timeout: 5000 }); await page.waitForTimeout(150); } })),
  { name: 'Tidy Up, a job running', screen: 'tidy', mock: { tidyEvents: { 'music run': [{ type: 'step', n: 2, total: 5, text: 'Matching albums with MusicBrainz' }, { type: 'progress', label: 'Albums', done: 4812, total: 7233, note: "Taylor Swift — Fearless (Taylor's Version)", eta: 3900 }, { type: 'ok', text: 'Read 13,990 songs' }] }, tidy: { ...tidy, libraries: tidy.libraries.map((l) => (l.kind === 'music' ? { ...l, stage: 'scanned' } : l)) } },
    before: async (page) => { await page.evaluate(() => { window.__MOCK.tidyHold = true; }); await page.click('#tidy .seg button:text-is("Music")', { timeout: 5000 }); await page.click('#tidy .tidyneeds button:text-is("Build")'); await page.waitForSelector('#tidyJob .tidynow', { timeout: 5000 }); } },
  { name: 'An app’s page', screen: 'app:vikunja', mock: { ...pageMock, explainer: 'llama3.2:latest' } },
  { name: 'The phone', screen: 'status', phone: ['companion'] },
  { name: 'The phone, an app’s page', screen: 'app:vikunja', mock: pageMock, phone: ['companion'] },
  { name: 'The phone, Backups', screen: 'backups', phone: ['companion', 'can-change'] },
  { name: 'The phone, Finances', screen: 'finances', phone: ['companion', 'finances'] },
  { name: 'The phone, Finances, view only', screen: 'finances', phone: ['companion', 'finances'], mock: { finances: { ...finances, readOnly: true } } },
  { name: 'The phone, Finances, Transactions', screen: 'finances', phone: ['companion', 'finances'], before: async (page) => { await finTab(page, 'Transactions', { timeout: 5000 }); await page.waitForSelector('.fx-txday'); } },
  { name: 'The phone, Finances, Transactions, two selected', screen: 'finances', phone: ['companion', 'finances'], before: async (page) => { await finTab(page, 'Transactions', { timeout: 5000 }); await page.click('.fx-transactions button:text-is("Select")'); await page.click('.fx-txday li.opens >> nth=0'); await page.click('.fx-txday li.opens >> nth=2'); await page.waitForSelector('.fx-txpick :text("2 transactions selected")'); } },
  { name: 'The phone, Finances, Reports', screen: 'finances', phone: ['companion', 'finances'], mock: { ledger: ledgerMonths }, before: async (page) => { await finTab(page, 'Reports', { timeout: 5000 }); await page.click('.fx-reportsum [role=radio]:text-is("3 months")'); await page.waitForSelector('.fx-inout'); } },
  { name: 'The phone, Finances, Calendar', screen: 'finances', phone: ['companion', 'finances'], before: async (page) => { await finTab(page, 'Calendar', { timeout: 5000 }); await page.click('.fx-calendar button[aria-label="The month after"]'); await page.waitForSelector('.fx-calendar h2:has-text("November 2026")'); } },
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
  const ctx = await browser.newContext({ viewport: s.phone ? phoneSize : { width: 1280, height: 800 }, colorScheme: look.scheme || 'light', contrast: look.contrast || 'no-preference', ...(s.locale ? { locale: s.locale } : {}) });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript({ content: `window.__MOCK = ${JSON.stringify({ ...mock, ...phoneMock(s.phone), ...look.mock, ...s.mock, host: { ...mock.host, ...look.mock?.host, ...s.mock?.host }, screen: s.screen })};\n${readFileSync(join(here, 'mock.js'), 'utf8')}` });
  // What happened overnight shows only in the morning: kept hidden in every case but its own (mock.overnight), so a
  // case or a picture is the same whatever the hour it runs at.
  if (!s.mock?.overnight) await page.addInitScript(() => { try { localStorage.setItem('homelab.overnightHidden', new Date().toDateString()); } catch { /* none */ } });
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
// SMOKE_ONLY=text runs the checks whose name has it, SMOKE_SHARD=i/n runs
// every nth from the ith (CI runs n at once: together they are every
// check), SMOKE_DEBUG=1 prints what axe measured, and SMOKE_SHOTS=folder
// keeps a picture of each screen and each check that passed (for a pull
// request's after; a failing check's picture in app/preview/failures is
// its before).
if (process.argv.includes('--smoke')) {
  const schemes = ['light', 'dark'].filter((t) => !process.argv.includes(t === 'light' ? 'dark' : 'light'));
  const [shard, shards] = (process.env.SMOKE_SHARD || '1/1').split('/').map(Number);
  if (!(shards >= 1 && shard >= 1 && shard <= shards)) throw new Error(`SMOKE_SHARD is i/n, not ${process.env.SMOKE_SHARD}`);
  let seen = 0;
  const picked = (label) => (!process.env.SMOKE_ONLY || label.includes(process.env.SMOKE_ONLY)) && seen++ % shards === shard - 1;
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
        // The screen as the check left it, for a pull request's after (a failing check's is its before).
        if (process.env.SMOKE_SHOTS) {
          mkdirSync(process.env.SMOKE_SHOTS, { recursive: true });
          await page.screenshot({ path: join(process.env.SMOKE_SHOTS, `${scheme}-${s.name}`.replace(/[^\w.-]+/g, '-').slice(0, 120) + '.png'), fullPage: true });
        }
      } catch (e) {
        failed++;
        // The first line, and what it was waiting for (Playwright's call log), so a timeout says which step.
        const lines = String(e.message || e).split('\n');
        const waiting = lines.find((l) => /waiting for/.test(l));
        console.log('FAIL', `${s.name} (${scheme}):`, lines[0] + (waiting ? ` (${waiting.trim()})` : ''));
        await keep(page, `${scheme}-${s.name}`);
      }
      await ctx.close();
    }
    for (const sys of systems) {
      for (const contrast of ['no-preference', 'more']) {
        for (const s of screens) {
          const label = `${s.name}, ${sys.name}, ${scheme}${contrast === 'more' ? ', more contrast' : ''}`;
          // A screen may name the systems it needs (s.systems): one whose parts are
          // all checked elsewhere in every accent needs only each platform's look.
          if (s.systems && !s.systems.includes(sys.name)) continue;
          if (!picked(label)) continue;
          const { ctx, page, errors } = await open(browser, s, { scheme, contrast, mock: sys.mock });
          try {
            // A screen in a state a click puts it in (a Finances view), as the pictures' before does.
            if (s.before) { await s.before(page); await page.waitForTimeout(200); }
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

// The docs' pictures show a homelab that is well: Mealie, stopped in the example
// state for the checks above (which have exited by now), runs here, with a
// fresh backup, so no screen opens on a red bar. A shot that sets its own
// status or backups keeps them.
{
  const fine = status.apps.find((a) => a.id === 'vikunja');
  mock.status = { ...status, apps: status.apps.map((a) => (a.id === 'mealie' ? { ...a, state: 'running', health: 'healthy', since: fine.since, updatedAt: fine.updatedAt } : a)) };
  mock.backups = { ...backups, stale: 0, copies: backups.copies.map((c) => (c.id === 'mealie' ? { ...c, newest: hoursAgo(7.5), state: 'fresh' } : c)) };
}
// And the version a visitor sees on GitHub: the newest release runs in the
// pictures, and the update line offers the one after it. VERSION is only the
// floor builds count from (docs/Releasing.md), so 0.17.0 there would read as old.
{
  let latest = '';
  try { latest = execFileSync('git', ['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().replace(/^v/, ''); } catch { /* no tags here: VERSION stays */ }
  if (/^\d+\.\d+\.\d+$/.test(latest)) {
    const [major, minor, patch] = latest.split('.').map(Number);
    host.version = latest;
    for (const shot of shots) if (shot.mock?.host) shot.mock.host = { ...shot.mock.host, version: latest }; // made with the host before this
    update.version = `${major}.${minor}.${patch + 1}`;
  }
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
    // Each picture starts as a first visit: the app keeps a screen's scroll in localStorage (Remember where you were), which one shot would hand to the next.
    await page.addInitScript(() => { if (!sessionStorage.getItem('shotFresh')) { localStorage.clear(); sessionStorage.setItem('shotFresh', '1'); } });
    await page.addInitScript({ content: `window.__MOCK = ${JSON.stringify({ ...mock, ...phoneMock(shot.phone), ...shot.mock, screen: shot.screen })};\n${readFileSync(join(here, 'mock.js'), 'utf8')}` });
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
