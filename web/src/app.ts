// Homelab Wizard frontend, in TypeScript: esbuild compiles it to
// web/dist/app.js (npm run build), which Wails serves and homelab serve
// shows on a phone. The Go methods in app.go are window.go.main.App, typed
// in web/types. Screens move into Preact components (*.tsx) one at a time.
import { ago, dollars, never } from './format';
import { mountTiles, troubled } from './status/Tiles';
import { catalogProblem, mountBundles, mountGroups, mountInputs, mountPlan, mountStarters } from './choose/Choose';
import { mountExplain } from './logs/Explain';
import { formProblem, mountForm, shown as shownSettings, type FormActions, type FormProps, type Page as FormPage, type View as FormView } from './settings/Form';
import { mountPeople, type PeopleActions, type PeopleProps } from './settings/People';
import { mountPhones, type PhonesActions } from './settings/Phones';
import { mountHost, mountNewHomelab, mountRuntime, type HostActions, type HostProps } from './setup/Host';
import { mountBanner, mountUpgrade, upgradeShown } from './setup/Upgrade';
import { mountChecklist, progress, type ChecklistActions } from './setup/Checklist';
import { mountBackupTiles, mountCopyRows, mountJobs, mountVault } from './backups/Backups';
import { mountAlerts, mountProtection, mountStorage, mountWatchdog, mountWeek, storageShown } from './status/Cards';
import { clearAppList, mountAppList, type AppListActions, type AppListProps } from './status/AppList';
import { mountReleaseNotes } from './status/ReleaseNotes';
import { mountUsage, record as recordUsage, type History as UsageHistory } from './status/Usage';

const go = () => window.go.main.App;
/** An element by ID, loosely typed: it may be an input, a button, a details. */
const $ = (id: string): any => document.getElementById(id);
/** The elements a selector finds, loosely typed like $. */
const $$ = (sel: string, root: ParentNode = document): any[] => [...root.querySelectorAll(sel)];
/** The first element a selector finds, or null; loosely typed like $. */
const $1 = (sel: string, root: ParentNode = document): any => root.querySelector(sel);

/** h builds an element; text is always set as text, never as HTML. */
function h(tag: string, attrs: Record<string, any> = {}, ...kids: any[]): any {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') (el as any).value = v;
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
  // A link that acts (no href) is a button to the keyboard and VoiceOver:
  // reached with Tab, pressed with Enter or Space.
  if (tag === 'a' && attrs.onclick && !attrs.href) keyable(el);
  return el;
}
function keyable(el) {
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
  return el;
}

let errorTimer = 0;
function showError(e) {
  const el = $('error');
  el.textContent = String((e && e.message) || e);
  el.hidden = false;
  clearTimeout(errorTimer);
  errorTimer = setTimeout(() => (el.hidden = true), 6000);
}

function show(name) {
  $$('nav button').forEach((b) => {
    b.classList.toggle('active', b.dataset.screen === name);
    if (b.dataset.screen === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === name));
  if (name === 'status') loadStatus();
  if (name === 'backups') loadBackups();
  if (name === 'setup') { loadHost(); loadSetup(); }
  if (name === 'settings') loadSettings();
}
// After picking a screen, VoiceOver and the keyboard start at its heading.
function focusScreen(name) {
  const h1 = $1(`#${name} h1`);
  if (!h1) return;
  h1.tabIndex = -1;
  h1.focus({ preventScroll: true });
}
let navigated = false; // the user picked a screen; never switch away from it
// Each platform's conventions (style.css): html.os-mac, os-windows, or os-linux.
const platform = navigator.platform || navigator.userAgent;
const osName = /Mac/.test(platform) ? 'mac' : /Win/.test(platform) ? 'windows' : 'linux';
document.documentElement.classList.add('os-' + osName);
const isMac = osName === 'mac';
// This computer, as each system calls it (.env.example's "This Mac" section).
const thisMachine = isMac ? 'This Mac' : osName === 'windows' ? 'This PC' : 'This machine';
const mod = isMac ? '⌘' : 'Ctrl+';
$$('nav button').forEach((b, i) => {
  b.onclick = () => { navigated = true; show(b.dataset.screen); focusScreen(b.dataset.screen); };
  b.title = `${b.textContent.trim()} (${mod}${i + 1})`;
});

// Keyboard: Cmd (Ctrl elsewhere) with 1-5 picks a screen, comma opens
// Settings, R refreshes, F finds (Choose stacks, Settings); Escape clears a
// search. On the Mac the View menu has the same shortcuts and sends them as
// navigate and refresh events.
// Text size, kept per machine: the whole app scales, 80% to 200%.
let textSize = 1;
function setTextSize(z) {
  textSize = Math.round(Math.min(2, Math.max(0.8, z)) * 10) / 10;
  document.documentElement.style.setProperty('--zoom', String(textSize));
  try { localStorage.setItem('homelab.textSize', String(textSize)); } catch { /* none */ }
}
try { const z = Number(localStorage.getItem('homelab.textSize')); if (z) setTextSize(z); } catch { /* none */ }
const screens = ['choose', 'status', 'backups', 'setup', 'settings'];
document.addEventListener('keydown', (e) => {
  const current = document.querySelector('.screen.active')?.id;
  const target = e.target as any;
  if (e.key === 'Escape' && target.matches?.('input[type=search]') && target.value) {
    target.value = '';
    target.dispatchEvent(new Event('input'));
    return;
  }
  // F1 opens the guide on Windows and Linux, as Help does in the Mac's menu bar.
  if (e.key === 'F1' && !isMac) {
    e.preventDefault();
    Promise.resolve(go().Open('https://github.com/Snooper42/homelab-wizard/blob/main/docs/Getting%20Started.md')).catch(showError);
    return;
  }
  // F5 checks the screen again on Windows and Linux, as in their own apps
  // (Ctrl+R and the Mac's ⌘R do the same below).
  if (e.key === 'F5' && !isMac && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault();
    if (current) show(current);
    return;
  }
  if (!(isMac ? e.metaKey : e.ctrlKey) || e.altKey) return;
  // Bigger and smaller text: + and - (with or without Shift), 0 for the usual size.
  if (['=', '+', '-', '_', '0'].includes(e.key)) {
    e.preventDefault();
    setTextSize(e.key === '0' ? 1 : textSize + (e.key === '-' || e.key === '_' ? -0.1 : 0.1));
    return;
  }
  if (e.shiftKey) return;
  const n = Number(e.key);
  if (e.key === ',') {
    e.preventDefault();
    navigated = true;
    show('settings');
  } else if (n >= 1 && n <= screens.length) {
    e.preventDefault();
    navigated = true;
    show(screens[n - 1]);
  } else if (e.key.toLowerCase() === 'r') {
    e.preventDefault();
    if (current) show(current);
  } else if (e.key.toLowerCase() === 'f') {
    const search = { choose: 'search', settings: 'settingsSearch' }[current];
    if (search) { e.preventDefault(); $(search).focus(); $(search).select(); }
  }
});

// Choose stacks
let catalog: api.Catalog | null = null;
let statusById: Record<string, api.AppStatus> = {}; // the latest status, best effort: empty while the runtime is down
const selected = new Set<string>();
const settings: Record<string, string> = {}; // form values, sent with every plan and install
const appName = (id) => (catalog.apps.find((a) => a.id === id) || { name: id }).name;

async function loadCatalog() {
  try {
    catalog = await go().Catalog();
  } catch (e) {
    catalogProblem($('groups'), String(e));
    return;
  }
  await loadAppStates();
  fillCategories();
  // The starter picks come first; the full list waits behind Add more.
  const starters = catalog.presets.filter((p) => p.starter);
  $('starterBox').hidden = !starters.length;
  if (!starters.length) $('more').open = true;
  renderApps();
}

async function loadAppStates() {
  try {
    const st = await go().Status();
    statusById = Object.fromEntries(st.apps.map((a) => [a.id, a]));
  } catch {
    statusById = {};
  }
}

$('search').oninput = (e) => {
  query = e.target.value.trim().toLowerCase();
  if (query) $('more').open = true;
  // While searching, the matches come first: the starters and presets wait.
  $('choose').classList.toggle('searching', !!query);
  renderApps();
};

// Add your own app: checked in Go, written by homelab custom add, then
// ticked so the plan shows what installing it does.
function fillCategories() {
  $('cCategory').replaceChildren(...catalog.categories.map((c) => h('option', { value: c.id }, c.label)));
  $('cCategory').value = 'documents';
}

$('cAdd').onclick = async () => {
  const log = $('cLog');
  const spec = {
    id: '', // the Go side makes it from the name
    name: $('cName').value.trim(),
    image: $('cImage').value.trim(),
    port: Number($('cPort').value) || 0,
    category: $('cCategory').value,
    description: $('cDesc').value.trim(),
    volumes: $('cVolumes').value.split(',').map((v) => v.trim()).filter(Boolean),
    env: {},
  };
  log.hidden = false;
  log.textContent = '';
  $('cAdd').disabled = true;
  const off = window.runtime.EventsOn('cli:log', (line) => { log.textContent += line + '\n'; });
  try {
    const before = new Set(catalog.apps.map((a) => a.id));
    catalog = await go().AddCustom(spec);
    const added = catalog.apps.find((a) => !before.has(a.id));
    renderApps();
    if (added) { selected.add(added.id); renderApps(); replan(); }
    for (const id of ['cName', 'cImage', 'cPort', 'cDesc', 'cVolumes']) $(id).value = '';
  } catch (e) {
    showError(e);
  } finally {
    if (typeof off === 'function') off();
    $('cAdd').disabled = false;
  }
};

// The search, lower case.
let query = '';

// A pick (a starter or a bundle) ticks all of its apps, or unticks them
// when all are ticked; a stack's own preset is the same as ticking its app.
function togglePreset(p: api.Preset) {
  const on = p.apps.every((id) => selected.has(id));
  p.apps.forEach((id) => (on ? selected.delete(id) : selected.add(id)));
  renderApps();
  replan();
}

function renderApps() {
  const picks = { selected, status: statusById, toggle: togglePreset };
  mountStarters($('starters'), { ...picks, presets: catalog.presets.filter((p) => p.starter) });
  mountBundles($('presets'), { ...picks, presets: catalog.presets.filter((p) => !p.starter && !p.id.startsWith('stack:')) });
  mountGroups($('groups'), {
    catalog, status: statusById, selected, query,
    tick: (id, on) => { if (on) selected.add(id); else selected.delete(id); renderApps(); replan(); },
    open: (url) => go().Open(url),
    settings: (keys) => showSettings(keys),
  });
}

let planSeq = 0;
let replanTimer = 0;
function replan() { clearTimeout(replanTimer); replanTimer = setTimeout(doPlan, 250); }
const filled = () => Object.fromEntries(Object.entries(settings).filter(([, v]) => v !== ''));

async function doPlan() {
  const seq = ++planSeq;
  const tokens = [...selected];
  // A new choice after an install: its steps belonged to the last plan.
  if (tokens.length && !installing) {
    $('progress').replaceChildren();
    $('started').replaceChildren();
    $('wiring').replaceChildren();
    $('installLog').textContent = '';
    $('installLog').parentElement.hidden = true;
  }
  const plan = (p: api.Plan | string | null) => mountPlan($('plan'), { plan: p, appName, reason: friendlyReason });
  if (!tokens.length) {
    plan(null);
    $('installBtn').disabled = true;
    return;
  }
  let p: api.Plan;
  try {
    p = await go().Plan(tokens, filled());
  } catch (e) {
    if (seq === planSeq) { plan(String(e)); $('installBtn').disabled = true; }
    return;
  }
  if (seq !== planSeq) return; // a newer selection is being planned
  plan(p);
  renderInputs(p);
  const wireable = new Set(catalog.wireable || []);
  $('wireRow').hidden = ![...p.start, ...selected].some((id) => wireable.has(id));
  $('installBtn').disabled = !(p.ready && p.start.length);
}

// "set TAILSCALE_AUTHKEY in .env first" reads as the setting's own name.
function friendlyReason(r) {
  return r.replace(/set ([A-Z0-9_]+(?:(?:, | and | or )[A-Z0-9_]+)*) in \.env first/g, (_, keys) =>
    'fill in ' + keys.split(/, | and | or /).map(settingLabel).join(' and ') + ' below');
}

// The settings the chosen apps need, with .env's help for each.
let settingHelp: Record<string, settings.Setting> | null = null;
async function renderInputs(p: api.Plan) {
  const ids = new Set([...selected, ...p.start, ...p.skips.map((s) => s.app)]);
  const keys = [...new Set(catalog.apps.filter((a) => ids.has(a.id)).flatMap((a) => a.inputs || []))];
  if (keys.length && !settingHelp) {
    try { settingHelp = Object.fromEntries((await go().Settings()).map((s) => [s.key, s])); } catch { settingHelp = {}; }
  }
  mountInputs($('inputs'), { keys, meta: settingHelp || {}, values: settings, label: settingLabel, input: (k, v) => { settings[k] = v; replan(); } });
}

let installing = false;
$('installBtn').onclick = async () => {
  const btn = $('installBtn');
  installing = true;
  btn.disabled = true;
  btn.textContent = 'Installing…';
  $('progress').replaceChildren();
  $('started').replaceChildren();
  $('wiring').replaceChildren();
  const rows = {};
  const names = { env: 'Write settings (.env)', folders: 'Create folders', networks: 'Create networks' };
  const ilog = $('installLog');
  ilog.textContent = '';
  ilog.parentElement.hidden = true;
  const offLog = window.runtime.EventsOn('install:log', (line) => {
    ilog.parentElement.hidden = false;
    ilog.textContent += line + '\n';
    ilog.scrollTop = ilog.scrollHeight;
  });
  const off = window.runtime.EventsOn('progress', (ev) => {
    const label = ev.name === 'start' ? `Start ${(ev.apps || []).map(appName).join(', ')}` : names[ev.name];
    const li = rows[ev.step] || (rows[ev.step] = $('progress').appendChild(h('li')));
    li.className = ev.error ? 'failed' : ev.done ? 'done' : '';
    li.textContent = label + (ev.error ? ` failed: ${ev.error}` : ev.done ? ' ✓' : ' …');
  });
  try {
    const started = await go().Install([...selected], filled());
    $('started').replaceChildren(h('h2', {}, 'Started'), started.length
      ? h('ul', {}, started.map((s) => h('li', {}, s.url ? h('a', { onclick: () => go().Open(s.url) }, s.name) : s.name)))
      : h('p', { class: 'muted' }, 'Nothing new to start.'));
    if (!$('wireRow').hidden && $('wire').checked && started.length) await wire($('wiring'));
    selected.clear();
    await loadAppStates();
    renderApps();
  } catch (e) {
    showError(e);
  } finally {
    if (typeof off === 'function') off();
    if (typeof offLog === 'function') offLog();
    btn.textContent = 'Install';
    installing = false;
    replan();
  }
};

// Wiring: connect the running apps, showing each link as it finishes.
const linkMark = { done: ['✓', 'ok'], already: ['✓', 'ok'], manual: ['!', 'warn'], failed: ['✗', 'bad'] };
async function wire(box) {
  const list = h('ul', { class: 'links' });
  box.replaceChildren(h('h2', {}, 'Connected for you'), h('p', { class: 'muted' }, 'Connecting… this can take a minute while new apps start.'), list);
  const off = window.runtime.EventsOn('link', (l) => {
    const [mark, cls] = linkMark[l.state] || ['•', 'muted'];
    list.append(h('li', {}, h('span', { class: cls }, mark + ' '), l.text, l.detail ? h('span', { class: 'detail' }, l.detail) : null));
  });
  try {
    const links = await go().Wire();
    box.children[1].textContent = links.length ? '' : 'Nothing to connect: none of the apps it links is running.';
  } catch (e) {
    showError(e);
  } finally {
    if (typeof off === 'function') off();
  }
}
$('connect').onclick = () => wire($('statusWiring'));

// Status
const link = (url, text) => h('a', { onclick: () => go().Open(url) }, text);

// The apps the battery saver paused, from the last Status.
let batteryPaused = new Set<string>();
// Each app's share of the watchdog's passing checks this week (0 to 1).
let weekUp = {};

// The savings trend: a sparkline of the last 90 recorded days and the
// change since the first of them (the nightly backup records one a day).
let savingsHistory: savings.Point[] = [];
async function loadSavingsHistory() {
  try { savingsHistory = (await go().SavingsHistory()) || []; } catch { savingsHistory = []; }
}
function renderTiles(st: api.Status) {
  const trouble = st.apps.filter(troubled);
  mountTiles($('tiles'), {
    status: st,
    history: savingsHistory,
    onPause: async (paused) => {
      try { await go().SetUpdatesPaused(paused); } catch (err) { showError(err); }
      await loadStatus();
    },
  });
  const n = trouble.length;
  $('statusCount').textContent = n ? String(n) : '';
  // Fix it for what it can repair: baseline apps down, or unwell ones
  // (a stopped optional app was stopped on purpose).
  $('fixIt').hidden = !(st.missing || st.apps.some((a) => a.health === 'unhealthy' || a.health === 'restarting' || a.notAnswering || a.settingsChanged));
}

// Which categories are open on Status, kept between visits: each one the
// user opened or closed; the rest open when something in them is not running.
let statusFold = {};
let statusOpenAll = false;
let lastStatusOpen = {};
try {
  const v = localStorage.getItem('homelab.statusOpen');
  if (v === 'all') statusOpenAll = true;
  else if (v) {
    const kept = JSON.parse(v);
    statusFold = Array.isArray(kept) ? Object.fromEntries(kept.map((l) => [l, true])) : kept;
  }
} catch { /* private window: the defaults */ }
function saveStatusOpen() {
  try { localStorage.setItem('homelab.statusOpen', statusOpenAll ? 'all' : JSON.stringify(statusFold)); } catch { /* not kept */ }
}
function toggleStatusGroup(label) {
  if (statusOpenAll) { statusOpenAll = false; statusFold = Object.fromEntries(Object.keys(lastStatusOpen).map((l) => [l, true])); }
  statusFold[label] = !lastStatusOpen[label];
  saveStatusOpen();
  loadStatus();
}
$('statusAll').onclick = () => {
  statusOpenAll = !statusOpenAll;
  statusFold = {};
  saveStatusOpen();
  loadStatus();
};

async function loadStatus() {
  try {
    const st = await go().Status();
    statusById = Object.fromEntries(st.apps.map((a) => [a.id, a]));
    batteryPaused = new Set(st.batteryPaused || []);
    if (!savingsHistory.length) await loadSavingsHistory();
    renderTiles(st);
    await loadWatchdog(); // before the rows: they show each app's week
    if (Date.now() - protectionAt > 60000) loadProtection();
    loadAlerts();
    loadStorage();
    loadUsage();
    loadWeek();
    $('statusRows').closest('table').hidden = false;
    // Grouped by category, as on Choose stacks; what needs a look comes
    // first, in a group of its own.
    const trouble = (a) => a.health === 'unhealthy' || a.health === 'restarting' || a.state === 'missing';
    const catOf = Object.fromEntries((catalog?.apps || []).map((x) => [x.id, x.category]));
    const groups: { label: string; apps: api.AppStatus[]; alert?: boolean }[] = [{ label: 'Needs a look', apps: st.apps.filter(trouble), alert: true },
      ...(catalog?.categories || []).map((c) => ({ label: c.label, apps: st.apps.filter((a) => !trouble(a) && catOf[a.id] === c.id) })),
      { label: 'Other', apps: st.apps.filter((a) => !trouble(a) && !(catalog?.categories || []).some((c) => c.id === catOf[a.id])) }].filter((g) => g.apps.length);
    // Every category folds into its heading. Until the user picks, one
    // where everything runs is folded, and what needs a look stays open.
    const fine = (g) => !g.alert && g.apps.every((a) => a.state === 'running');
    const isOpen = (g) => statusOpenAll || (g.label in statusFold ? statusFold[g.label] : !fine(g));
    lastStatusOpen = Object.fromEntries(groups.map((g) => [g.label, isOpen(g)]));
    appList = { groups, open: lastStatusOpen, catalog, weekUp, batteryPaused, busy: appsBusy, companion: document.documentElement.classList.contains('companion'), os: osName, on: appListActions };
    mountAppList($('statusRows'), appList);
    $('statusAll').textContent = statusOpenAll ? 'Fold them again' : 'Show every app';
    const waiting = [...new Set(st.apps.filter((a) => a.state === 'stopped' && a.waitingFor).map((a) => a.waitingFor.replace(/^\/Volumes\//, '')))];
    $('statusNote').textContent = [waiting.length ? `Plug in ${waiting.join(' and ')}: the apps waiting for ${waiting.length === 1 ? 'it' : 'them'} start within 15 minutes of ${waiting.length === 1 ? 'it' : 'them'} appearing.` : '',
      batteryPaused.size ? `On battery: ${batteryPaused.size} app${batteryPaused.size === 1 ? '' : 's'} paused until this computer is plugged in (Settings › Battery saver).` : '',
      st.unmatched ? `${st.unmatched} other container(s) on this machine are not catalog apps.` : ''].filter(Boolean).join(' ');
  } catch (e) {
    // Most often the container runtime is not running: say so plainly.
    appList = null;
    clearAppList($('statusRows'));
    $('statusRows').closest('table').hidden = true;
    $('tiles').replaceChildren();
    $('alertsCard').hidden = true;
    $('watchCard').hidden = true;
    $('protectCard').hidden = true;
    protectionAt = 0;
    const msg = String((e && e.message) || e);
    $('statusNote').replaceChildren(h('div', { class: 'card notice' },
      h('strong', {}, /not running/.test(msg) ? 'The container runtime is not running' : 'Status is not available'),
      h('div', { class: 'muted' }, msg),
      h('div', { class: 'muted' }, 'Every app runs inside it, so they are all paused until it starts. This page checks again every 10 seconds.')));
  }
}

// The watchdog's last run: every app, public address, database copy,
// Duplicati job, and the CrowdSec bouncer, checked every 15 minutes by the
// scheduled job. Failing checks are the ones it alerted about.
async function loadWatchdog() {
  const card = $('watchCard');
  let w: health.Summary;
  try { w = await go().Watchdog(); } catch { card.hidden = true; return; }
  weekUp = w.week || {};
  card.hidden = false;
  mountWatchdog(card, { w, openSetup: () => { navigated = true; show('setup'); }, fix: () => cliFlow('Fix it', 'fix', '', 'Fix these') });
}

// Protection: whether the proxy enforces CrowdSec's bans, and the attacks
// CrowdSec caught this week. Read once a minute (each read runs cscli in
// its container); hidden until CrowdSec and the proxy run.
let protectionAt = 0;
async function loadProtection() {
  protectionAt = Date.now();
  const card = $('protectCard');
  let p: crowdsec.Protection;
  try { p = await go().Protection(); } catch { card.hidden = true; return; }
  card.hidden = false;
  mountProtection(card, { p, fix: () => cliFlow('Fix it', 'fix', '', 'Fix these') });
}

// Photos per person: what each person keeps in Immich, as the nightly
// backup last read it, largest first, with a bar against the largest.
async function loadStorage() {
  const card = $('storageCard');
  let rec: storage.Record | null;
  try { rec = await go().Storage(); } catch { rec = null; }
  card.hidden = !storageShown(rec);
  if (card.hidden) return;
  mountStorage(card, { rec: rec!, nameOf: (id) => catalog?.apps.find((a) => a.id === id)?.name || id });
}

// What's using power: each running app's CPU right now (docker stats),
// read at most once a minute since docker measures over a second or two.
let usageAt = 0;
async function loadUsage() {
  if (Date.now() - usageAt < 9000) return;
  usageAt = Date.now();
  let stats: docker.Stat[];
  try { stats = await go().Usage(); } catch { stats = []; }
  recordUsage(usageHistory, stats);
  mountUsage($('usageCard'), { stats, history: usageHistory, nameOf: (id) => catalog?.apps.find((a) => a.id === id)?.name || id });
}
// While Status is open (and the window shown), usage is sampled every 10
// seconds for the card's lines.
const usageHistory: UsageHistory = new Map();
setInterval(() => { if (!document.hidden && $('status').classList.contains('active')) loadUsage(); }, 10000);

// This week: the Sunday summary (homelab digest), read at most every 10
// minutes since it asks several apps.
let weekAt = 0;
async function loadWeek() {
  if (Date.now() - weekAt < 600000) return;
  weekAt = Date.now();
  const card = $('weekCard');
  let w: app.Weekly;
  try { w = await go().Weekly(); } catch { card.hidden = true; return; }
  card.hidden = !w.body.split('\n').some(Boolean);
  if (!card.hidden) mountWeek(card, { w });
}

// Recent alerts: what Watchtower, Duplicati, Uptime Kuma, and the watchdog
// sent to ntfy in the last 12 hours, read with notify setup's read token.
async function loadAlerts() {
  const card = $('alertsCard');
  const openSetup = () => { navigated = true; show('setup'); };
  card.hidden = false;
  try {
    mountAlerts(card, { events: (await go().Alerts()) || [], openSetup });
  } catch (e) {
    mountAlerts(card, { events: null, problem: String((e && e.message) || e), openSetup });
  }
}

// What the app list's rows do.
const appListActions: AppListActions = {
  act: (a, action) => (action === 'update' ? showUpdate(a) : runAppAction(a, action)),
  logs: (a) => showLogs(a),
  phone: (a) => showQR(a),
  signIn: (a, keys) => showSignIn(a, keys),
  openNative: (a) => go().OpenNativeApp(a.id).then(() => { setTimeout(loadStatus, 3000); }, (err) => { showError(err); throw err; }),
  install: (a) => { selected.add(a.id); navigated = true; show('choose'); renderApps(); replan(); },
  adopt: (a) => cliFlow(`Move ${a.name} into the homelab`, 'adopt', a.id, 'Move it'),
  open: (url) => go().Open(url),
  startAll: async (apps, progress) => {
    for (const [i, a] of apps.entries()) {
      progress(i);
      try { await go().AppAction(a.id, 'start'); } catch (err) { showError(err); break; }
    }
    loadStatus();
  },
  toggle: (label) => toggleStatusGroup(label),
};
// The list as last shown, and whether an app's command runs (every row's
// buttons wait meanwhile).
let appList: AppListProps | null = null;
let appsBusy = false;
function setAppsBusy(busy: boolean) {
  appsBusy = busy;
  if (appList) mountAppList($('statusRows'), (appList = { ...appList, busy }));
}

// Open on a phone: the app's address as a QR code for the phone's camera.
async function showQR(a) {
  const panel = $('cliPanel'), url = 'https://' + a.address;
  if (cliStop) cliStop();
  let img;
  try { img = await go().QR(url); } catch (e) { return showError(e); }
  panel.hidden = false;
  $('cliTitle').textContent = `Open ${a.name} on a phone`;
  $('cliLog').hidden = true;
  const tailnet = /\.ts\.net(:|$)/.test(a.address);
  const phoneApp = catalog?.apps.find((c) => c.id === a.id)?.phone;
  $('cliActions').replaceChildren(h('div', { class: 'pairing' },
    h('img', { src: img, alt: `QR code for ${url}`, width: 180, height: 180 }),
    h('div', {},
      h('p', {}, 'Point the phone\u2019s camera at the code and tap the link. ', h('code', {}, url)),
      h('p', { class: 'muted' }, tailnet ? 'The phone needs the Tailscale app, signed in to the same tailnet; then it works at home and away.' : 'The phone needs to be on the home Wi-Fi (or on Tailscale away from home).'),
      phoneApp ? h('p', { class: 'muted' }, `Its phone app: ${phoneApp}.`) : '',
      h('button', { class: 'small', onclick: () => { panel.hidden = true; $('cliLog').hidden = false; } }, 'Close'))));
  panel.scrollIntoView({ block: 'nearest' });
}

// Sign in: the user name the homelab set up the app with, and the password
// copied (it never reaches the page), from .env.
async function showSignIn(a, keys) {
  const panel = $('cliPanel');
  if (cliStop) cliStop();
  let list = [];
  try { list = await go().Settings(); } catch (e) { return showError(e); }
  const byKey = Object.fromEntries(list.map((s) => [s.key, s]));
  const label = (k) => (/PASSWORD$/.test(k) ? 'Password' : /EMAIL$/.test(k) ? 'Email' : /USER$/.test(k) ? 'User name' : settingLabel(k));
  panel.hidden = false;
  $('cliTitle').textContent = `Sign in to ${a.name}`;
  $('cliLog').textContent = '';
  $('cliLog').hidden = true;
  const note = h('span', { class: 'muted' });
  const rows = keys.map((k) => {
    const s = byKey[k] || ({} as any);
    const copy = s.secret
      ? () => go().CopySetting(k).then(() => { note.textContent = '✓ Password copied; the clipboard clears in 90 seconds.'; }, showError)
      : () => { window.runtime.ClipboardSetText?.(s.value || ''); note.textContent = `✓ ${label(k)} copied.`; };
    return h('div', { class: 'signin' }, h('span', { class: 'muted' }, label(k)),
      h('strong', {}, s.secret ? (s.set ? '••••••••' : 'not set') : (s.value || 'not set')),
      s.set ? h('button', { class: 'small', onclick: copy }, 'Copy') : null);
  });
  $('cliActions').replaceChildren(h('div', { class: 'signins' }, rows), note,
    h('button', { class: 'small', onclick: () => { panel.hidden = true; $('cliLog').hidden = false; } }, 'Close'));
  panel.scrollIntoView({ block: 'nearest' });
}

const actionTitle = { start: 'Starting', stop: 'Stopping', restart: 'Restarting', update: 'Updating', rollback: 'Rolling back' };
async function runAppAction(a, action) {
  const panel = $('cliPanel'), log = $('cliLog'), actions = $('cliActions');
  log.hidden = false;
  if (cliStop) cliStop();
  panel.hidden = false;
  $('cliTitle').textContent = `${actionTitle[action]} ${a.name}…`;
  log.textContent = '';
  progressBox = 'cliProgress';
  cliProgress(null);
  actions.replaceChildren();
  setAppsBusy(true);
  panel.scrollIntoView({ block: 'nearest' });
  const off = window.runtime.EventsOn('cli:log', (line) => { log.textContent += line + '\n'; log.scrollTop = log.scrollHeight; });
  let failed = false;
  try { await go().AppAction(a.id, action); } catch (e) { failed = true; showError(e); }
  setAppsBusy(false);
  if (typeof off === 'function') off();
  cliProgress(failed ? 'failed' : 'done');
  $('cliTitle').textContent = failed ? `${actionTitle[action]} ${a.name} failed` : `${a.name}: ${action} done`;
  actions.replaceChildren(h('button', { class: 'small', onclick: () => (panel.hidden = true) }, 'Close'));
  loadStatus();
}

// Update: what it brings first (its newer releases' notes), then Update
// runs it in the same panel.
function showUpdate(a) {
  const panel = $('cliPanel'), box = h('div');
  if (cliStop) cliStop();
  panel.hidden = false;
  $('cliTitle').textContent = `Update ${a.name}`;
  $('cliLog').hidden = true;
  cliProgress(null);
  $('cliActions').replaceChildren(box);
  mountReleaseNotes(box, {
    name: a.name,
    load: () => go().ReleaseNotes(a.id),
    onUpdate: () => runAppAction(a, 'update'),
    onCancel: () => { panel.hidden = true; $('cliLog').hidden = false; },
    open: (url) => go().Open(url),
  });
  panel.scrollIntoView({ block: 'nearest' });
}

// A longer job's steps (ui.Step in the CLI, sent as cli:step): a bar and
// the step at hand above the log of the panel running it (progressBox).
// Each command starts without one, a job of one step never shows it, and
// the end fills it ('done') or marks it red.
let progressBox = 'cliProgress';
function cliProgress(s) {
  const box = $(progressBox);
  if (!s) { box.hidden = true; return; }
  const fill = box.querySelector('.fill'), step = box.querySelector('.step');
  if (s === 'done' || s === 'failed') {
    if (box.hidden) return;
    fill.style.width = '100%';
    box.classList.toggle('failed', s === 'failed');
    step.textContent = s === 'done' ? 'Done' : 'Stopped with a problem; the log says which';
    return;
  }
  if (s.total < 2) return;
  box.hidden = false;
  box.classList.remove('failed');
  fill.style.width = `${Math.round(((s.n - 0.5) / s.total) * 100)}%`;
  step.textContent = `${s.text} · ${s.n} of ${s.total}`;
}

// The end of an app's log, with a link to Dozzle for following it live.
let logApp = null;
async function showLogs(a) {
  logApp = a;
  const panel = $('logPanel'), text = $('logText');
  panel.hidden = false;
  $('logTitle').textContent = `${a.name}: last 200 lines`;
  text.textContent = 'Loading…';
  const dozzle = statusById.dozzle;
  $('logActions').replaceChildren(...[
    h('button', { class: 'small', onclick: () => showLogs(a) }, 'Refresh'),
    dozzle?.state === 'running' && dozzle.url ? h('button', { class: 'small', title: 'Follow every log live in Dozzle', onclick: () => go().Open(dozzle.url) }, 'Open Dozzle') : null,
    h('button', { class: 'small', onclick: () => { panel.hidden = true; logApp = null; } }, 'Close'),
  ].filter(Boolean));
  // Explain, when the Ollama on this machine has a model; a fresh box per
  // log, so an answer never shows under another app's.
  const explainBox = h('div');
  $('logExplain').replaceChildren(explainBox);
  $('logExplain').hidden = true;
  go().Explainer().then((model) => {
    if (!model || logApp !== a) return;
    $('logExplain').hidden = false;
    mountExplain(explainBox, { model, ask: () => go().ExplainLogs(a.id) });
  }, () => {});
  try {
    const out = await go().Logs(a.id, 200);
    if (logApp !== a) return; // another app's log was opened meanwhile
    text.textContent = out.trim() || '(the log is empty)';
    text.scrollTop = text.scrollHeight;
  } catch (e) {
    if (logApp === a) text.textContent = String((e && e.message) || e);
  }
  panel.scrollIntoView({ block: 'nearest' });
}

// The command and log panels are sheets: over the screen, with the focus
// in them while open and back where it was after, and Escape to close one
// through its own Close or Cancel (a command still running has neither).
for (const panel of $$('.panel.sheet')) {
  let before = null;
  new MutationObserver(() => {
    document.documentElement.classList.toggle('sheet-open', !!document.querySelector('.panel.sheet:not([hidden])'));
    if (!panel.hidden) {
      if (!panel.contains(document.activeElement)) before = document.activeElement;
      requestAnimationFrame(() => ($1('button:not([disabled])', panel) || panel).focus());
    } else if (before && document.contains(before)) {
      before.focus();
      before = null;
    }
  }).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
}
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const open = $$('.panel.sheet:not([hidden])').pop();
  const close = open && $$('button:not([disabled])', open).find((b) => /^(Close|Cancel)$/.test(b.textContent.trim()));
  if (close) { e.preventDefault(); close.click(); }
});

// A homelab command with a preview: show its plan, then run it on confirm.
let cliStop = null; // the open flow's log listener
async function cliFlow(title, action, target, confirmLabel) {
  const panel = $('cliPanel'), log = $('cliLog'), actions = $('cliActions');
  log.hidden = false;
  if (cliStop) cliStop();
  panel.hidden = false;
  $('cliTitle').textContent = title;
  log.textContent = '';
  progressBox = 'cliProgress';
  cliProgress(null);
  actions.replaceChildren();
  // The CLI's "run again with --apply" is the confirm button here.
  const off = window.runtime.EventsOn('cli:log', (line) => {
    if (/^Preview only: nothing was changed/.test(line.trim())) return;
    log.textContent += line + '\n';
    log.scrollTop = log.scrollHeight;
  });
  const stop = () => { if (typeof off === 'function') off(); if (cliStop === stop) cliStop = null; };
  cliStop = stop;
  try {
    await go().Homelab(action, target, false);
  } catch (e) {
    showError(e);
    stop();
    return;
  }
  actions.replaceChildren(
    h('button', { class: 'primary small', onclick: async (e) => {
      e.target.disabled = true;
      log.textContent += '\n';
      let failed = false;
      try { await go().Homelab(action, target, true); } catch (err) { failed = true; showError(err); }
      cliProgress(failed ? 'failed' : 'done');
      stop();
      actions.replaceChildren(h('button', { class: 'small', onclick: () => (panel.hidden = true) }, 'Close'));
      loadStatus();
    } }, confirmLabel),
    h('button', { class: 'small', onclick: () => { stop(); panel.hidden = true; } }, 'Cancel'));
}
$('cleanup').onclick = () => cliFlow('Remove old containers whose apps now run in the homelab', 'cleanup', '', 'Remove them');
$('fixIt').onclick = () => cliFlow('Fix it', 'fix', '', 'Fix these');
$('updateAll').onclick = () => cliFlow('Update all apps now', 'update-all', '', 'Update them');

// More… on Status: the actions needed now and then.
function closeMenu() { $('statusMenu').hidden = true; $('statusMore').setAttribute('aria-expanded', 'false'); }
$('statusMore').onclick = (e) => {
  e.stopPropagation();
  const open = $('statusMenu').hidden;
  $('statusMenu').hidden = !open;
  $('statusMore').setAttribute('aria-expanded', String(open));
};
$('statusMenu').addEventListener('click', closeMenu);
document.addEventListener('click', (e) => { if (!$('statusMenu').hidden && !(e.target as Element).closest('.menuwrap')) closeMenu(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('statusMenu').hidden) closeMenu(); });
// Status follows the engine (app.go's status:changed): a container that
// starts, stops, or changes health reloads it at once. One load at a time;
// a change during a load loads again after it. The poll each minute catches
// what the engine does not report (the watchdog, storage, alerts).
let statusLoad = null, statusAgain = false;
function refreshStatus() {
  if (!$('status').classList.contains('active')) return;
  if (statusLoad) { statusAgain = true; return; }
  statusLoad = loadStatus().finally(() => {
    statusLoad = null;
    if (statusAgain) { statusAgain = false; refreshStatus(); }
  });
}
setInterval(refreshStatus, 60000);

// Backups: the newest copy of each database and volume, the destination,
// and the last restore test, read from the files the nightly job leaves.




async function loadBackups() {
  let o: backup.Overview;
  try { o = await go().Backups(); } catch (e) { mountCopyRows($('backupRows'), null); showError(e); return; }
  mountBackupTiles($('backupTiles'), { o, os: osName });
  mountCopyRows($('backupRows'), { o });
  mountVault($('vaultCard'), { o });
  const problems = (o.copies || []).filter((c) => c.state === 'stale').length + (o.plainExports || []).length;
  $('backupsCount').textContent = problems ? String(problems) : '';
  loadDuplicatiJobs();
  const dup = statusById.duplicati;
  $('openDuplicati').hidden = !(dup?.state === 'running' && dup.url);
  $('openDuplicati').onclick = () => go().Open(dup.url);
}

// The encrypted off-site jobs: each Duplicati job's last run.
async function loadDuplicatiJobs() {
  const card = $('dupCard');
  const create = () => backupTask('duplicati-setup', 'Creating the backup jobs…', 'Backup jobs created', 'Creating the jobs stopped: the log says why');
  $('restoreTest').hidden = true;
  let jobs: duplicati.Job[];
  try {
    jobs = (await go().DuplicatiJobs()) || [];
  } catch (e) {
    mountJobs(card, { jobs: null, problem: String((e && e.message) || e), create });
    return;
  }
  // The restore test needs the Homelab AppData job to have run once.
  $('restoreTest').hidden = !jobs.some((j) => j.name.toLowerCase() === 'homelab appdata' && j.state !== 'never');
  mountJobs(card, { jobs, create });
}

// Runs a backup-screen command, streaming its output into the panel.
async function backupTask(action, busy, done, failed) {
  const panel = $('backupPanel'), log = $('backupLog'), btns = [$('backupNow'), $('restoreTest')];
  panel.hidden = false;
  $('backupTitle').textContent = busy;
  log.textContent = '';
  progressBox = 'backupProgress';
  cliProgress(null);
  btns.forEach((b) => { b.disabled = true; });
  const off = window.runtime.EventsOn('cli:log', (line) => { log.textContent += line + '\n'; log.scrollTop = log.scrollHeight; });
  let ok = true;
  try { await go().Homelab(action, '', action === 'backup'); } catch (e) { ok = false; showError(e); }
  cliProgress(ok ? 'done' : 'failed');
  progressBox = 'cliProgress';
  if (typeof off === 'function') off();
  $('backupTitle').textContent = ok ? done : failed;
  btns.forEach((b) => { b.disabled = false; });
  loadBackups();
}
// Moving: out packs this homelab into one file and stops it; in unpacks one here.
async function moveTask(direction, button) {
  if (direction === 'out' && button.dataset.sure !== '1') {
    button.dataset.sure = '1';
    button.textContent = 'Click again: back up, stop every app, and pack';
    return;
  }
  const panel = $('backupPanel'), log = $('backupLog');
  button.disabled = true;
  panel.hidden = false;
  $('backupTitle').textContent = direction === 'out' ? 'Moving out (a backup first, then packing)…' : 'Moving in…';
  log.textContent = '';
  const off = window.runtime.EventsOn('cli:log', (line) => { log.textContent += line + '\n'; log.scrollTop = log.scrollHeight; });
  let file = '', ok = true;
  try { file = await go().Move(direction); } catch (e) { ok = false; showError(e); }
  if (typeof off === 'function') off();
  button.disabled = false;
  delete button.dataset.sure;
  button.textContent = direction === 'out' ? 'Move out…' : 'Move in…';
  if (ok && !file) { panel.hidden = true; return; }
  $('backupTitle').textContent = !ok ? 'The move stopped: the log says why'
    : direction === 'out' ? 'Packed. This machine is stopped: take the file and the media drive to the new one' : 'Moved in: the apps that ran before are starting';
}
$('moveOut').onclick = (e) => moveTask('out', e.target);
$('moveIn').onclick = (e) => moveTask('in', e.target);
$('backupNow').onclick = () => backupTask('backup', 'Backing up…', 'Backup done', 'The backup failed: the log says which step');
$('recoveryKit').onclick = async () => {
  const btn = $('recoveryKit');
  btn.disabled = true;
  try { await go().RecoveryKit(); } catch (e) { showError(e); }
  btn.disabled = false;
};
$('restoreTest').onclick = () => backupTask('restore-test', 'Testing a restore (a few minutes)…', 'Restore test passed', 'The restore test failed: the log says why');

// Setup
// How to get the newest app build on this machine's platform.
let hostOS = '';
function newestBuildSteps() {
  if (hostOS.startsWith('Windows')) return 'download Homelab-Wizard-Windows-Setup.exe and run it';
  if (hostOS.startsWith('Linux')) return 'download the package for this system (.deb, .rpm, or the Arch package), or the AppImage';
  return 'open the latest build, download Homelab-Wizard-macOS.dmg, quit this app, and drag the new one to Applications';
}

// Where the system lists the background job, in its own words.
function whereBackgroundIs() {
  if (hostOS.startsWith('Windows')) return 'Windows starts them when you sign in: Task Manager › Startup apps lists them as homelab-run.';
  if (hostOS.startsWith('macOS') || !hostOS) return 'macOS lists these in System Settings › General › Login Items & Extensions, under Homelab Wizard.';
  return 'systemd runs them for you as the homelab-agent service: systemctl --user status homelab-agent shows it.';
}

async function loadHost() {
  const i = await go().Host();
  hostOS = i.os || '';
  document.documentElement.classList.toggle('backdrop', !!i.backdrop);
  // The accent picked in the system's settings, in place of the platform's blue.
  const root = document.documentElement;
  // KDE Plasma (SteamOS's desktop) gets Breeze's look instead of GNOME's.
  root.classList.toggle('de-kde', i.desktop === 'kde');
  root.classList.toggle('sys-accent', !!i.accent);
  if (i.accent) {
    root.style.setProperty('--sys-accent-light', i.accent.light);
    root.style.setProperty('--sys-accent-dark', i.accent.dark);
  }
  // Text on the accent, where white would not read (the Mac's yellow).
  if (i.accent?.text) root.style.setProperty('--accent-text', i.accent.text);
  else root.style.removeProperty('--accent-text');
  const [atLogin, menu] = await Promise.all([go().TrayAtLogin().catch(() => null), go().MenuEntry().catch(() => null)]);
  host = { i, atLogin, menu, upgrade: host?.upgrade || null, on: hostActions };
  renderHost();
  // Each part kept whole: a long Windows name wraps before the version, not inside it.
  $('foot').replaceChildren(h('span', { class: 'part' }, i.osVersion || i.os), ' · ', h('span', { class: 'part' }, i.version));
  if (i.rootOK) loadUpgrade(false);
  renderNewHomelab(i);
  renderRuntime(i);
  return i;
}

// The machine card as last read; the update check fills in its version line.
let host: HostProps | null = null;
const renderHost = () => { if (host) mountHost($('hostInfo'), host); };
const hostActions: HostActions = {
  background: async () => { try { return (await go().Background()) || []; } catch (e) { showError(e); throw e; } },
  whereBackground: () => whereBackgroundIs(),
  jobsOff: () => { show('status'); cliFlow('Turn off the scheduled jobs', 'jobs-remove', '', 'Turn them off'); },
  setTrayAtLogin: async (on) => { try { await go().SetTrayAtLogin(on); } catch (e) { showError(e); } await loadHost(); },
  setMenuEntry: async (on) => { try { await go().SetMenuEntry(on); } catch (e) { showError(e); } await loadHost(); },
  chooseRoot: () => chooseRoot(),
  goBack: async () => {
    const log = $('setupLog');
    log.hidden = false;
    log.textContent = 'Going back…\n';
    const off = window.runtime.EventsOn('cli:log', (line) => { log.textContent += line + '\n'; log.scrollTop = log.scrollHeight; });
    try { await go().Homelab('upgrade-back', '', true); } catch (e) { showError(e); }
    if (typeof off === 'function') off();
    loadUpgrade(true);
  },
};


// The container runtime, walked through: download it, open it, and this
// screen notices on its own once it answers.
let runtimeWatch = null;
function renderRuntime(i: app.HostInfo) {
  const card = $('runtimeCard');
  card.hidden = !!i.runtimeOK;
  clearInterval(runtimeWatch);
  if (card.hidden) return;
  runtimeWatch = setInterval(async () => {
    const now = await go().Host().catch(() => null);
    if (now && now.runtimeOK) { clearInterval(runtimeWatch); await loadHost(); loadSetup(); }
  }, 5000);
  mountRuntime(card, { i, start: () => { go().StartRuntime().catch(showError); }, open: (url) => go().Open(url) });
}

// No homelab folder yet: a build that carries the homelab files makes one.
function renderNewHomelab(i: app.HostInfo) {
  const card = $('newHomelab');
  card.hidden = i.rootOK || !i.kit;
  if (card.hidden) return;
  mountNewHomelab(card, {
    i,
    create: async () => {
      try { await go().CreateHomelab(); await loadHost(); await loadCatalog(); await loadSetup(); } catch (e) { showError(e); throw e; }
    },
    choose: () => chooseRoot(),
  });
}

// Update the homelab: the changes waiting on GitHub, and a button that
// fast-forwards the folder and runs up.
async function loadUpgrade(force: boolean) {
  const card = $('upgradeCard');
  let c: app.UpgradeInfo;
  try { c = await go().UpgradeCheck(force); } catch (e) {
    card.hidden = true;
    if (host) { host = { ...host, upgrade: { error: String((e && e.message) || e), behind: 0 } }; renderHost(); }
    return;
  }
  upgradeInfo = c;
  footUpdate(upgradeShown(c));
  if (host) { host = { ...host, upgrade: { behind: c.behind, appCommit: c.appCommit, previous: c.previous } }; renderHost(); }
  renderUpgrade();
}
// The last update check, and whether an update or an app install runs.
let upgradeInfo: app.UpgradeInfo | null = null;
let upgrading = false;
function renderUpgrade() {
  const card = $('upgradeCard'), c = upgradeInfo;
  card.hidden = !c || !upgradeShown(c);
  mountUpgrade(card, c && !card.hidden ? { c, buildSteps: newestBuildSteps(), busy: upgrading, upgrade: () => runUpgrade(c.appUpdate), installApp: () => installApp(), open: (url) => go().Open(url) } : null);
}
// The sidebar says when an update is waiting, on every screen.
function footUpdate(on) {
  document.getElementById('footUpdate')?.remove();
  if (on) $('foot').append(h('a', { id: 'footUpdate', class: 'update', title: 'Open Setup to update', onclick: () => { navigated = true; show('setup'); } }, '● Update ready'));
}
// Checked again every hour (the check itself asks GitHub at most every 10 minutes).
setInterval(() => { if (host?.i.rootOK) loadUpgrade(false); }, 3600e3);

// A newer app build, found in the background (app:update): what changed,
// Restart to update, and installing on quit instead. Later hides it until
// a newer build than that one turns up.
let updateLater = '';
function updateBanner(u: app.PendingUpdate | null) {
  const box = $('updateBanner');
  if (!u || u.commit === updateLater || document.documentElement.classList.contains('companion')) { box.hidden = true; mountBanner(box, null); return; }
  mountBanner(box, {
    u, isMac,
    later: () => { updateLater = u.commit; box.hidden = true; },
    restart: async () => { try { await go().InstallAppUpdate(); } catch (e) { showError(e); throw e; } },
    setInstallOnQuit: async (on) => { try { await go().SetInstallOnQuit(on); } catch (e) { showError(e); throw e; } },
  });
  box.hidden = false;
}
window.runtime?.EventsOn?.('app:update', updateBanner);
try { go().PendingAppUpdate().then(updateBanner).catch(() => {}); } catch { /* the phone has no app to update */ }


// The newest app build in place of this one; the app quits and opens again.
async function installApp() {
  const log = $('setupLog');
  upgrading = true;
  renderUpgrade();
  log.hidden = false;
  log.textContent += 'Downloading the newest Homelab Wizard (a minute or two)…\n';
  try {
    await go().InstallAppUpdate();
    log.textContent += 'Opening the new version…\n';
  } catch (e) {
    upgrading = false;
    renderUpgrade();
    log.textContent += 'The app update stopped; the homelab is fine. Try again, or download it from the release page.\n';
    showError(e);
  }
}

async function runUpgrade(app?: app.AppUpdate | null) {
  const log = $('setupLog');
  upgrading = true;
  renderUpgrade();
  log.hidden = false;
  log.textContent = 'Getting the update…\n';
  const off = window.runtime.EventsOn('cli:log', (line) => { log.textContent += line + '\n'; log.scrollTop = log.scrollHeight; });
  let ok = true;
  try { await go().Homelab('upgrade', '', true); } catch (e) { ok = false; showError(e); }
  if (typeof off === 'function') off();
  log.textContent += ok ? '\nThe homelab is up to date.\n' : '\nThe update stopped: the log says why. Nothing was merged or overwritten.\n';
  upgrading = false;
  if (ok && app?.canInstall) return installApp();
  await loadHost();
  loadCatalog();
  loadSetup();
}
$('report').onclick = async () => {
  const log = $('setupLog'), btn = $('report');
  btn.disabled = true;
  log.hidden = false;
  log.textContent = 'Making the report (about a minute)…\n';
  const off = window.runtime.EventsOn('cli:log', (line) => { log.textContent += line + '\n'; log.scrollTop = log.scrollHeight; });
  let ok = true;
  try { await go().Homelab('report', '', false); } catch (e) { ok = false; showError(e); }
  if (typeof off === 'function') off();
  btn.disabled = false;
  if (ok) {
    const reveal = hostOS.startsWith('macOS') ? 'Show in Finder' : hostOS.startsWith('Windows') ? 'Show in Explorer' : 'Show the file';
    log.append(h('div', { class: 'actions reveal' },
      h('button', { class: 'small', onclick: () => go().RevealReport().catch(showError) }, reveal),
      h('button', { id: 'emailReport', class: 'small', onclick: () => go().EmailReport().catch(showError) }, 'Email it to my helper'),
      h('span', { class: 'muted' }, 'Read it through, then share the file when asking for help. Email starts a message to HELPER_EMAIL and shows the file to attach.')));
  }
};
async function chooseRoot() {
  try { await go().ChooseRoot(); await loadHost(); await loadCatalog(); await loadSetup(); } catch (e) { showError(e); }
}

// First-time setup: the checklist from the engine, each step with its
// live check, what to fill in, and a button for what the engine can do.
let lastSteps: setup.Step[] = [];
let showDoneSteps = false;
// The step running now: its buttons wait.
let runningStep: string | null = null;

function renderSetup(steps: setup.Step[]) {
  lastSteps = steps;
  const { done, total, left, wait } = progress(steps);
  const waiting = wait ? ` · ${wait} can wait` : '';
  $('checkTitle').textContent = (done === total ? `First-time setup · all ${total} done` : `First-time setup · ${done} of ${total} done`) + waiting;
  $('setupMeter').style.width = total ? `${Math.round((100 * done) / total)}%` : '0';
  setupBadge(left);
  const ready = runnable(steps);
  $('runAll').hidden = runningAll || ready.length < 2;
  if (!runningAll) $('runAll').textContent = `Do the ${ready.length} steps I can`;
  mountChecklist($('checklist'), { steps, showDone: showDoneSteps, running: runningStep, on: checklistActions });
}

// What the checklist's buttons do.
const checklistActions: ChecklistActions = {
  fill: (keys) => showSettings(keys),
  run: (s, choice) => runStep(s, choice),
  open: (url) => go().Open(url),
  closeSignups: async () => {
    const log = $('setupLog');
    log.hidden = false;
    const off = window.runtime.EventsOn('cli:log', (line) => { log.textContent += line + '\n'; });
    try { await go().Homelab('signups-close', '', true); } catch (e) { showError(e); }
    if (typeof off === 'function') off();
  },
  markDone: async (s, done) => { try { renderSetup(await go().MarkSetupDone(s.id, done)); } catch (err) { showError(err); } },
  toggleDone: () => { showDoneSteps = !showDoneSteps; renderSetup(lastSteps); },
};

// The Setup tab shows how many first-time steps are left.
function setupBadge(left) {
  $('setupCount').textContent = left ? String(left) : '';
}

async function loadSetup() {
  $('checkTitle').textContent = 'First-time setup · checking…';
  try { renderSetup(await go().Setup()); } catch (e) { showError(e); }
}
$('recheck').onclick = () => { loadSetup(); loadHost().then(() => loadUpgrade(true)); };

// The steps whose button can run now, without a setting or a choice.
function runnable(steps) {
  return steps.filter((s) => s.state === 'todo' && s.run?.length);
}

// Do the steps I can: each ready step in turn, re-checked after each, until
// none is left or one fails.
let runningAll = false;
$('runAll').onclick = async () => {
  const log = $('setupLog'), btn = $('runAll');
  runningAll = true;
  btn.disabled = true;
  log.hidden = false;
  log.textContent = '';
  const off = window.runtime.EventsOn('setup:log', (line) => { log.textContent += line + '\n'; log.scrollTop = log.scrollHeight; });
  const tried = new Set();
  try {
    for (;;) {
      const next = runnable(lastSteps || []).find((s) => !tried.has(s.id));
      if (!next) break;
      tried.add(next.id);
      btn.textContent = `Doing: ${next.title}…`;
      log.textContent += `\n— ${next.title}\n`;
      renderSetup(await go().RunSetup(next.id));
    }
    log.textContent += '\nDone. What is left needs you: a setting to fill in, a choice, or a step only a person can do.\n';
  } catch (e) {
    showError(e);
    log.textContent += '\nStopped at a step that failed: the log above says why.\n';
  } finally {
    if (typeof off === 'function') off();
    runningAll = false;
    btn.disabled = false;
    loadSetup();
  }
};

async function runStep(step: setup.Step, choice?: number) {
  const log = $('setupLog');
  log.hidden = false;
  log.textContent = '';
  runningStep = step.id;
  renderSetup(lastSteps);
  const off = window.runtime.EventsOn('setup:log', (line) => { log.textContent += line + '\n'; log.scrollTop = log.scrollHeight; });
  try {
    const steps = await (choice === undefined ? go().RunSetup(step.id) : go().RunSetupChoice(step.id, choice));
    runningStep = null;
    renderSetup(steps);
  } catch (e) {
    runningStep = null;
    showError(e);
    loadSetup();
  } finally {
    runningStep = null;
    if (typeof off === 'function') off();
  }
}

// Settings: .env as a form. Secrets are never sent to the page; an empty
// secret field keeps the stored value. Logins, tokens, and folders have a
// Test button that checks the saved value against the real service.
const changed: Record<string, string> = {};
let testable: Set<string> | null = null;

// Phones: the ones paired with the phone companion (homelab serve), and a
// one-time code with its QR code to pair another.
async function loadPhones() {
  const card = $('phonesCard');
  let phones: companion.Phone[];
  try { phones = await go().Phones(); } catch { card.hidden = true; return; }
  card.hidden = false;
  mountPhones(card, { phones: phones || [], on: phonesActions });
}
const phonesActions: PhonesActions = {
  setCanChange: async (id, can) => { try { await go().SetPhoneCanChange(id, can); } catch (e) { showError(e); } loadPhones(); },
  remove: async (id) => { try { await go().RemovePhone(id); } catch (e) { showError(e); } loadPhones(); },
  pair: async (name, can) => { try { return await go().PairPhone(name, can); } catch (e) { showError(e); throw e; } },
  reload: () => loadPhones(),
};

// People: the household, each with a Pocket ID sign-in and a welcome page
// (homelab person). Adding someone needs Pocket ID running.
let peopleView: PeopleProps | null = null;
let peopleLog = '';
function renderPeople() {
  if (peopleView) mountPeople($('peopleCard'), { ...peopleView, log: peopleLog });
}
async function loadPeople() {
  const card = $('peopleCard');
  let list: people.Person[], st: api.Status;
  try { [list, st] = await Promise.all([go().People(), go().Status()]); } catch { card.hidden = true; return; }
  card.hidden = false;
  const catOf = Object.fromEntries((catalog?.apps || []).map((x) => [x.id, x]));
  const personal = st.apps.filter((a) => a.state === 'running' && (a.address || a.url) && a.id !== 'homepage' && catOf[a.id]?.kind !== 'helper'
    && (!['network', 'system', 'security'].includes(catOf[a.id]?.category) || a.id === 'vaultwarden'));
  peopleLog = '';
  peopleView = { people: list || [], pocket: st.apps.some((a) => a.id === 'pocket-id' && a.state === 'running'), apps: personal.map((a) => ({ id: a.id, name: a.name })), log: '', on: peopleActions };
  renderPeople();
}
const peopleActions: PeopleActions = {
  act: async (action, who, mail = '', apps = []) => {
    peopleLog = '';
    renderPeople();
    const off = window.runtime.EventsOn('cli:log', (line) => { peopleLog += line + '\n'; renderPeople(); });
    let ok = true;
    try { await go().PersonAction(action, who, mail, apps); } catch (e) { ok = false; showError(e); }
    if (typeof off === 'function') off();
    return ok;
  },
  openWelcome: (username) => { go().OpenWelcome(username).catch(showError); },
  installPocket: () => { selected.add('pocket-id'); navigated = true; show('choose'); renderApps(); replan(); },
  added: async (name) => {
    const added = (await go().People()).find((p) => p.name === name);
    if (added) go().OpenWelcome(added.username).catch(() => {});
    loadPeople();
  },
  reload: () => loadPeople(),
};

async function loadSettings(focus: string[] = []) {
  loadPhones();
  loadPeople();
  let list: settings.Setting[];
  try { list = await go().Settings(); } catch (e) { form = null; formProblem($('settingsForm'), String(e)); return; }
  for (const k of Object.keys(changed)) delete changed[k];
  markChanged();
  if (!testable) { try { testable = new Set(await go().SettingTests()); } catch { testable = new Set(); } }
  const checks: Record<string, setup.Step> = {};
  for (const s of lastSteps) for (const k of s.settings || []) checks[k] = s;
  // Pages, as in System Settings: the homelab-wide sections, then one page
  // per app (its port, settings, and secrets together), then People and
  // Phones. The .env sections of every app's ports and every app's settings
  // are split by app.
  const pages: FormPage[] = settingsPages(list);
  const wanted = new Set([...everyday, ...(catalog?.apps || []).flatMap((a) => a.inputs || []), ...Object.keys(checks), ...focus]);
  everydayCount = list.filter((s) => wanted.has(s.key)).length;
  moreCount = list.length - everydayCount;
  if (focus.length) settingsPage = pages.find((pg) => pg.items.some((s) => s.key === focus[0]))?.name || settingsPage;
  if (!pages.some((pg) => pg.name === settingsPage) && !extraPages.includes(settingsPage)) settingsPage = pages[0]?.name || '';
  formVersion++;
  form = { pages, wanted, focus, checks, testable: testable!, label: settingLabel, view: settingsView(), on: formActions };
  renderSettingsNav(pages);
  filterSettings();
  if (focus.length) document.getElementById('setting-' + focus[0])?.scrollIntoView({ block: 'center' });
}

// The form as last read, and its version: a new one drops what was typed.
let form: FormProps | null = null;
let formVersion = 0;
const settingsView = (): FormView => ({ query: $('settingsSearch').value, page: settingsPage, showAll: settingsShowAll });
const errorText = (e) => String((e && e.message) || e);
const isSecret = (key: string) => !!form?.pages.some((pg) => pg.items.some((s) => s.key === key && s.secret));
const formActions: FormActions = {
  edited: (edits) => {
    for (const k of Object.keys(changed)) delete changed[k];
    Object.assign(changed, edits);
    markChanged();
  },
  // The test checks the saved value, so a value just typed is saved first.
  test: async (key, pending) => {
    let used = false;
    if (pending !== undefined) {
      if (!(isSecret(key) && pending === '')) {
        try { await go().SaveSettings({ [key]: pending }); } catch (e) { return { result: { tone: 'bad', text: errorText(e) }, used: false }; }
      }
      used = true;
    }
    try {
      const r = await go().TestSetting(key);
      return { result: { tone: r.ok ? 'ok' : 'bad', text: (r.ok ? '✓ ' : '✗ ') + r.message }, used };
    } catch (e) {
      return { result: { tone: 'bad', text: errorText(e) }, used };
    }
  },
  copy: async (key) => {
    try {
      await go().CopySetting(key);
      return { tone: 'ok', text: '✓ Copied. Paste it into Vaultwarden; the clipboard clears in 90 seconds.' };
    } catch (e) {
      return { tone: 'bad', text: errorText(e) };
    }
  },
  choose: async (key) => { try { return (await go().ChooseFolder(key)) || ''; } catch (e) { showError(e); return ''; } },
};

// The page Settings shows; People and Phones are pages of their own.
let settingsPage = '';
const extraPages = ['People', 'Phones'];

// settingsPages groups the settings into pages: each .env section, except
// the two that hold every app's ports and settings, which are split by app
// (by the app's inputs, else its ID as the key's prefix: IMMICH_PORT is
// Immich's). An app page joins the section named after it (AdGuard Home).
function settingsPages(list) {
  // A key belongs to the app whose ID is its longest prefix (IMMICH_ML_ to
  // immich-ml), else to the app named by its first word (IMMICH_PORT to
  // Immich), a main app before a helper.
  const norm = (t) => t.toUpperCase().replace(/[^A-Z0-9]+/g, '_') + '_';
  const apps = (catalog?.apps || []).map((a) => ({ name: a.name, inputs: new Set(a.inputs || []), helper: a.kind === 'helper', stack: a.stack,
    prefixes: [[norm(a.id), 0], [norm(a.name), 2], [norm(a.id.split('-')[0]), 1]] as [string, number][] }));
  // A helper's settings (its database) go on the page of the app it serves.
  const main = (a) => (a && a.helper && a.stack && apps.find((b) => !b.helper && b.stack === a.stack)) || a;
  const appOf = (key) => main(findApp(key));
  const findApp = (key) => {
    const own = apps.find((a) => a.inputs.has(key));
    if (own) return own;
    let best = null, score = 0;
    for (const a of apps) {
      for (const [p, bonus] of a.prefixes) {
        const sc = key.startsWith(p) ? p.length * 10 + bonus + (a.helper ? 0 : 3) : 0;
        if (sc > score) { best = a; score = sc; }
      }
    }
    return best;
  };
  const perApp = (name) => /^App (ports|settings)/.test(name);
  const general = [], byApp = new Map();
  const page = (name, kind) => {
    if (kind === 'general') {
      let p = general.find((g) => g.name === name);
      if (!p) general.push(p = { name, kind, items: [] });
      return p;
    }
    const known = [...byApp.keys()].find((n) => n === name || n.startsWith(name + ' '));
    if (!byApp.has(known || name)) byApp.set(name, { name, kind, items: [] });
    return byApp.get(known || name);
  };
  for (const s of list) {
    if (!perApp(s.section)) {
      const isApp = apps.some((a) => s.section === a.name || s.section.startsWith(a.name + ' '));
      page(s.section === 'This Mac' ? thisMachine : s.section, isApp ? 'app' : 'general').items.push(s);
      continue;
    }
    const a = appOf(s.key);
    page(a ? a.name : 'Other apps', 'app').items.push(s);
  }
  const appPages = [...byApp.values()].sort((a, b) => Number(a.name === 'Other apps') - Number(b.name === 'Other apps') || a.name.localeCompare(b.name));
  return [...general, ...appPages];
}

// The page list on the left: General, then Apps (the installed ones first,
// as Status knows them), with a count of matches while searching.
function renderSettingsNav(pages) {
  const installed = (name) => Object.values(statusById || {}).some((a) => a.name === name && a.state !== 'missing');
  const item = (name) => h('button', { class: 'pagebtn', 'data-page': name, onclick: () => {
    settingsPage = name;
    $('settingsSearch').value = '';
    filterSettings();
    document.querySelector('main').scrollTo({ top: 0 });
  } }, h('span', {}, name), h('span', { class: 'n' }));
  const general = pages.filter((p) => p.kind === 'general');
  const apps = pages.filter((p) => p.kind === 'app');
  const known = Object.keys(statusById || {}).length > 0;
  const mine = known ? apps.filter((p) => installed(p.name) || p.name === 'Other apps') : apps;
  const others = known ? apps.filter((p) => !mine.includes(p)) : [];
  $('settingsNav').replaceChildren(
    h('div', { class: 'navhead' }, 'General'), ...general.map((p) => item(p.name)), ...extraPages.map((n) => item(n)),
    ...(mine.length ? [h('div', { class: 'navhead' }, 'Apps'), ...mine.map((p) => item(p.name))] : []),
    ...(others.length ? [h('div', { class: 'navhead' }, 'Not installed'), ...others.map((p) => item(p.name))] : []));
}
function showSettingsPage(name) {
  $1(`#settingsNav .pagebtn[data-page="${CSS.escape(name)}"]`)?.click();
}

// The settings people change: where things are, the accounts the homelab
// uses, and how it behaves. Apps' own inputs and Setup's steps join them.
const everyday = new Set(['TZ', 'HOMELAB_DOMAIN', 'MEDIA_ROOT', 'DOWNLOADS_ROOT', 'IMMICH_UPLOAD_LOCATION', 'BACKUP_DESTINATION',
  'JELLYFIN_DATA_DIR', 'SYNC_ROOT', 'KEEP_AWAKE', 'BATTERY_SAVER', 'PHONE_COMPANION', 'AUTO_DOMAIN', 'CLOUDFLARE_API_TOKEN', 'TUNNEL_TOKEN',
  'ADGUARD_USER', 'ADGUARD_PASSWORD', 'HELPER_EMAIL', 'HEARTBEAT_URL', 'DESKTOP_ALERTS', 'UPDATES_PAUSED', 'AUTO_ROLLBACK', 'AUTO_HEAL',
  'UPDATE_CHANNEL', 'VAULTWARDEN_SIGNUPS_ALLOWED', 'DUPLICATI_SECRETS_PASSPHRASE', 'NTFY_PHONE_PASSWORD', 'TAILSCALE_AUTHKEY',
  'PROTONVPN_WIREGUARD_PRIVATE_KEY', 'PROTONVPN_SERVER_COUNTRIES', 'QBITTORRENT_PASSWORD', 'CROWDSEC_ENROLL_KEY',
  'ROMM_IGDB_CLIENT_ID', 'ROMM_IGDB_CLIENT_SECRET', 'ROMM_SCREENSCRAPER_USER', 'ROMM_SCREENSCRAPER_PASSWORD']);
let everydayCount = 0;
let moreCount = 0;
let settingsShowAll = false;
$('settingsAll').onclick = () => { settingsShowAll = !settingsShowAll; filterSettings(); };

// A setting's name for people; the .env key stays beside it.
const settingLabels = {
  TZ: 'Time zone', PUID: 'User ID', PGID: 'Group ID', BIND_IP: 'Apps listen on', LAN_BIND_IP: 'Proxy and DNS listen on',
  KEEP_AWAKE: 'Keep this machine awake', BATTERY_SAVER: 'Battery saver', MEDIA_ROOT: 'Media drive', DOWNLOADS_ROOT: 'Downloads folder',
  IMMICH_UPLOAD_LOCATION: 'Photos folder', BACKUP_DESTINATION: 'Backups go to', JELLYFIN_DATA_DIR: 'Jellyfin data folder',
  SYNC_ROOT: 'Syncthing folder', HOMELAB_DOMAIN: 'Domain (empty: addresses on your tailnet)', HOMELAB_BASELINE: 'Apps that always start (small or full)', AUTO_DOMAIN: 'Give new apps their addresses',
  CLOUDFLARE_API_TOKEN: 'Cloudflare API token', TUNNEL_TOKEN: 'Tunnel token', DESKTOP_ALERTS: 'Alerts on this screen',
  HELPER_EMAIL: "Your helper's email", HEARTBEAT_URL: 'Heartbeat ping URL', UPDATES_PAUSED: 'Pause nightly updates',
  VAULTWARDEN_SIGNUPS_ALLOWED: 'Vaultwarden sign-ups open', TAILSCALE_AUTHKEY: 'Tailscale auth key (optional)', TAILSCALE_HOST: 'This machine on the tailnet', TAILNET_ADMIN_APPS: 'Admin apps on the tailnet',
  PROTONVPN_WIREGUARD_PRIVATE_KEY: 'ProtonVPN WireGuard key', PROTONVPN_SERVER_COUNTRIES: 'ProtonVPN server countries',
};
const upper = new Set(['NPM', 'API', 'URL', 'DNS', 'IP', 'HTTP', 'HTTPS', 'ID', 'PDF', 'AI', 'IGDB', 'SSL', 'UI']);
function settingLabel(key) {
  if (settingLabels[key]) return settingLabels[key];
  const words = key.split('_').map((w) => (upper.has(w) ? w : w.toLowerCase()));
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// The Save button appears, with a count, once something changed.
function markChanged() {
  const n = Object.keys(changed).length;
  $('saveSettings').hidden = n === 0;
  $('saveSettings').textContent = n === 1 ? 'Save 1 change' : `Save ${n} changes`;
}

// Settings search: by key, help text, or section; every word must match,
// across every page. Without a search, the chosen page shows; on the
// homelab-wide pages, the rarely changed settings wait behind Show all.
function filterSettings() {
  if (!form) return;
  form = { ...form, view: settingsView() };
  mountForm($('settingsForm'), form, formVersion);
  const searching = !!form.view.query.trim();
  const sh = shownSettings(form.pages, form.view, form.wanted, form.label, form.checks);
  for (const [id, name] of [['peopleCard', 'People'], ['phonesCard', 'Phones']]) $(id).classList.toggle('offpage', searching || settingsPage !== name);
  for (const b of $('settingsNav').querySelectorAll('.pagebtn')) {
    b.classList.toggle('active', !searching && b.dataset.page === settingsPage);
    b.classList.toggle('nomatch', searching && !sh.counts[b.dataset.page]);
    b.querySelector('.n').textContent = searching && sh.counts[b.dataset.page] ? String(sh.counts[b.dataset.page]) : '';
  }
  $('settingsNone').hidden = sh.keys.size > 0 || !searching;
  $('settingsAll').hidden = searching || !sh.pageMore;
  $('settingsAll').textContent = settingsShowAll ? 'Show the everyday settings only' : `Show all settings (${sh.pageMore} more)`;
}
$('settingsSearch').oninput = filterSettings;

function showSettings(keys) {
  show('settings');
  loadSettings(keys);
}

$('saveSettings').onclick = async () => {
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(changed)) {
    if (isSecret(k) && v === '') continue; // keep the stored secret
    values[k] = v;
  }
  try {
    await go().SaveSettings(values);
    lastSteps = await go().Setup(); // check the new values
    await loadSettings(Object.keys(values));
  } catch (e) { showError(e); }
};

// On the phone: a diagnostics report to share (Mail, Messages) with a helper.
$('phoneReport').onclick = async (e) => {
  const btn = e.target;
  btn.disabled = true;
  btn.textContent = 'Making the report…';
  try {
    const r = await go().Report();
    const file = new File([r.text], 'homelab-report.txt', { type: 'text/plain' });
    const text = 'My homelab needs a look. The report has every password and token removed.';
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Homelab report', text });
    } else {
      const a = h('a', { href: URL.createObjectURL(file), download: file.name });
      a.click();
      if (r.helper) location.href = 'mailto:' + encodeURIComponent(r.helper) + '?subject=' + encodeURIComponent('Homelab report') + '&body=' + encodeURIComponent(text + ' The file is attached.');
    }
  } catch (err) { if (err && err.name !== 'AbortError') showError(err); }
  btn.disabled = false;
  btn.textContent = 'Send a report';
};

window.addEventListener('load', async () => {
  window.runtime.EventsOn('navigate', (screen) => { navigated = true; show(screen); });
  window.runtime.EventsOn('status:changed', refreshStatus);
  window.runtime.EventsOn('cli:step', cliProgress);
  window.runtime.EventsOn('refresh', () => { const current = document.querySelector('.screen.active')?.id; if (current) show(current); });
  try {
    const info = await loadHost();
    if (!info.rootOK) return show('setup');
    await loadCatalog();
    // A wall screen (the companion's kiosk mode) shows Status only.
    if (document.documentElement.classList.contains('kiosk')) return show('status');
    const screen = await go().Screen();
    if (screen) return show(screen);
    // Until the first-time setup is done, the app opens on it.
    const steps = await go().Setup();
    const { left } = progress(steps);
    setupBadge(left);
    if (left && !navigated) show('setup');
  } catch (e) {
    showError(e);
    show('setup');
  }
});
