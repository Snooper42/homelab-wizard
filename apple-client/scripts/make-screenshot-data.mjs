// The sample homelab the iPhone app's screenshots show (Screenshots/data.json):
// the same example household and apps as the computer's own screenshots
// (app/preview/shoot.mjs and mock.js), answered method by method as a phone
// calls them. Only the screenshot build (SCREENSHOTS) reads it.
//
//   node apple-client/scripts/make-screenshot-data.mjs
//
// Times are kept as "@ago:<seconds>", made into dates when the app reads
// them, so "7 hours ago" stays 7 hours ago whenever the pictures are taken.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const preview = join(root, 'app', 'preview');

// shoot.mjs's example state: everything up to its `const mock = …` line,
// without Playwright, run as a module beside it so its paths still work.
const shoot = readFileSync(join(preview, 'shoot.mjs'), 'utf8');
const end = shoot.indexOf('\n', shoot.indexOf('\nconst mock = {') + 1);
let prefix = shoot.slice(0, end).replace(/let chromium;\ntry \{[\s\S]*?\n\}\n/, '');
prefix += '\nexport { mock, watchdog, protection, alerts, savingsHistory, ledgerMonths, usage };\n';
const tmp = join(preview, `.screenshot-data-${process.pid}.mjs`);
writeFileSync(tmp, prefix);
let state;
try {
  state = await import(pathToFileURL(tmp).href);
} finally {
  rmSync(tmp, { force: true });
}
const { mock, watchdog, protection, alerts, savingsHistory, ledgerMonths } = state;

// mock.js, as the page runs it, to answer each method the way the computer would.
// A month as a household's ledger has one, for the transactions' pictures:
// brands as banks write them, a refund, a split, transfers.
const more = [
  ['m1', '2026-10-01', 'chk', -1850, 'Wells Fargo Home Mortgage', 'Housing', { to: 'mortgage' }],
  ['m2', '2026-10-02', 'visa', -15.49, 'NETFLIX.COM', 'Subscriptions'],
  ['m3', '2026-10-03', 'amex', -42.18, 'STARBUCKS STORE 01234', 'Eating out'],
  ['m4', '2026-10-04', 'visa', -118.42, 'AMAZON MKTPLACE PMTS', 'Shopping'],
  ['m5', '2026-10-06', 'chk', -61.3, 'DUKE ENERGY PAYMENT', 'Utilities'],
  ['m6', '2026-10-08', 'amex', -11.99, 'Spotify', 'Subscriptions'],
  ['m7', '2026-10-09', 'chk', 2150, "Alex's paycheck", 'Income'],
  ['m8', '2026-10-11', 'amex', -134.56, 'Whole Foods Market', 'Groceries'],
  ['m9', '2026-10-12', 'visa', -27.5, 'Uber', 'Transportation'],
  ['m10', '2026-10-14', 'chk', -500, 'BofA Savings', '', { to: 'sav' }],
  ['m11', '2026-10-15', 'amex', -89, 'Target', 'Shopping', { note: 'Birthday gifts (TARGET 00012345)' }],
  ['m12', '2026-10-17', 'visa', -9.99, 'Apple', 'Subscriptions', { note: 'iCloud+' }],
  ['m13', '2026-10-18', 'amex', -76.4, 'Chipotle', 'Eating out'],
  ['m14', '2026-10-19', 'visa', 32.1, 'AMAZON MKTPLACE PMTS', 'Shopping', { note: 'Returned' }],
  ['m15', '2026-10-20', 'chk', -385, 'Toyota Financial', 'Car', { to: 'carloan' }],
  ['m16', '2026-10-21', 'amex', -54.12, 'Home Depot', 'Home'],
  ['m17', '2026-10-23', 'chk', 2150, "Alex's paycheck", 'Income'],
  ['m18', '2026-10-25', 'visa', -22.85, 'DoorDash', 'Eating out'],
  ['m19', '2026-10-29', 'amex', -64.9, 'Kroger', 'Groceries'],
  ['m20', '2026-10-30', 'visa', -6.75, 'Blue Bottle Coffee', 'Eating out'],
].map(([id, date, account, amount, payee, category, extra = {}]) => ({ id, date, account, amount, payee, ...(category ? { category } : {}), ...extra }));
const ledgerFull = { ...ledgerMonths, transactions: [...ledgerMonths.transactions, ...more].sort((x, y) => x.date.localeCompare(y.date)) };
const M = structuredClone({ ...mock, ledger: ledgerFull, phone: ['companion', 'can-change'] });
const window = { __MOCK: M };
const store = new Map();
const context = vm.createContext({
  window, localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
  Navigator: function Navigator() {}, structuredClone, setTimeout, clearTimeout, Promise, Date, JSON, Math, console, URL, encodeURIComponent, Object, Array, String, Number, Boolean, Set, Map, Error,
});
context.Navigator.prototype = {};
vm.runInContext(readFileSync(join(preview, 'mock.js'), 'utf8'), context);
const App = window.go.main.App;

const methods = ['Status', 'LastStatus', 'Catalog', 'Backups', 'DuplicatiJobs', 'Host', 'Settings', 'Finances', 'FinancesLedger', 'FinancesWall'];
const answers = {};
for (const m of methods) answers[m] = await App[m]();
// A phone's Settings comes wrapped, with the keys only the computer may change (serve.go's phoneSettings).
answers.Settings = { settings: answers.Settings, computerOnly: answers.Settings.filter((s) => /TUNNEL|TAILSCALE|DOMAIN|ACME/.test(s.key)).map((s) => s.key) };
// The cards a phone asks for (StatusCard.phoneCards), as StatusBoard sends them.
const cards = { watchdog, protection, alerts, savings: savingsHistory };
for (const [name, fn] of Object.entries({ watchdog: 'Watchdog', protection: 'Protection', alerts: 'Alerts', savings: 'SavingsHistory' })) {
  if (App[fn]) cards[name] = await App[fn]();
}
// The watchdog's last fourteen days, all checks together (health.Day), for the Overview's Apps card: every app answered.
cards.watchdog = { ...cards.watchdog, daily: Array.from({ length: 14 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - (13 - i));
  return { date: d.toISOString().slice(0, 10), failed: 0, runs: 96 };
}) };
// An app's page (StatusCard.appCards): each app's memory and processor, and its folder, without the
// household's names and addresses (serve.go's phoneStorage), Vikunja's too, the app the pictures open.
cards.usage = state.usage;
const storage = await App.Storage();
cards.storage = { when: storage.when, apps: [...storage.apps, { app: 'vikunja', bytes: 64e6 }] };
// The computer's free space and power, for Status's This Machine card (core.MachineFacts).
cards.machine = { free: 412 * 2 ** 30, total: 994 * 2 ** 30, low: false, power: 'plugged', keptAwake: true };

// Settings › Phones and iPads and Setup's checklist (serve.go's phonePhone and phoneSetupStep):
// made-up phones and steps, never anyone's real ones.
const hour = 3600e3, day = 24 * hour;
const ago = (ms) => new Date(Date.now() - ms).toISOString();
answers.Phones = [
  { id: 'a1b2c3', name: "Alex's iPhone", canChange: true, finances: 'edit', paired: ago(40 * day), lastSeen: ago(60e3), this: true },
  { id: 'k4i5t6', name: 'Kitchen iPad', canChange: false, finances: 'card', kiosk: true, paired: ago(30 * day), lastSeen: ago(2 * 60e3) },
  { id: 'j7o8r9', name: "Jordan's iPhone", canChange: false, personName: 'Jordan', paired: ago(25 * day), lastSeen: ago(day) },
  { id: 'g1u2e3', name: 'Guest iPhone', canChange: true, paired: ago(3 * day), lastSeen: ago(3 * day), until: new Date(Date.now() + 6 * hour).toISOString() },
];
answers.Setup = [
  { id: 'started', title: 'The homelab is started', why: "Your homelab's own apps start (updates, backups, alerts), each with a strong password made for it.", state: 'done' },
  { id: 'address', title: 'This machine keeps its address', why: 'Your phones find the apps at this address; if the router hands out a new one, the apps seem to vanish.', state: 'done' },
  { id: 'jobs', title: 'Scheduled jobs', why: 'The homelab looks after itself: it starts again after a restart, backs up every night, and checks every app every 15 minutes.', state: 'todo', forYou: true },
  { id: 'adguard', title: 'Home DNS answers (AdGuard Home)', why: 'Makes the example.com names point at this machine at home, and blocks ads.', state: 'todo', forYou: true },
  { id: 'backups', title: 'Backups leave this machine', why: 'A cloud drive keeps them safe from fire and theft; an external drive is quicker to restore from.', state: 'todo' },
  { id: 'twofactor', title: 'Two-step sign-in', why: 'A stolen password alone then opens neither your password vault nor the homelab\'s settings.', state: 'todo' },
  { id: 'heartbeat', title: 'Alerts when this machine is down', why: 'If this machine loses power or crashes, an outside service notices the silence and tells you.', state: 'todo', later: true },
];
// An app's page › Who Uses It (serve.go's AppPeople): made-up names only.
answers.AppPeople = { household: true, people: [{ name: 'Alex' }, { name: 'Sam' }, { name: 'Jordan' }] };
// An app's page › Sign-in Details (signinphone.go's SignInDetails): made-up rows, labels only (never a value).
answers.SignInDetails = [
  { app: 'vikunja', key: 'VIKUNJA_PASSWORD', label: 'Vikunja: password', section: 'sign-in', saved: true },
  { app: 'vikunja', key: 'app:vikunja', label: 'Vikunja: its API key', section: 'paste', saved: false },
];
// What the computer answers (the contract the iPhone's tests read): every call, Phones and Setup with them.
const contract = JSON.parse(readFileSync(join(root, 'apple-client', 'Tests', 'Resources', 'CompanionContract.json'), 'utf8'));

// Times become "@ago:<seconds>".
const now = Date.now();
const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const relative = (v) => {
  if (typeof v === 'string' && iso.test(v)) return `@ago:${Math.round((now - Date.parse(v)) / 1000)}`;
  if (Array.isArray(v)) return v.map(relative);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, relative(x)]));
  return v;
};
const data = relative({
  me: { id: 'screenshots', name: 'iPhone', canChange: true, finances: 'edit', computer: contract.me.computer },
  answers,
  cards,
});
writeFileSync(join(root, 'apple-client', 'Screenshots', 'data.json'), JSON.stringify(data, null, 1) + '\n');
console.log(`Screenshots/data.json: ${methods.length} methods, ${Object.keys(cards).length} cards, ${answers.FinancesLedger.transactions.length} transactions`);
