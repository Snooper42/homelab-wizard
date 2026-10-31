// Status: the apps as last read (store.ts) with their cards, each row's
// actions and the sheets they open, a homelab command with its preview,
// and the phone's report.
import { ago } from '../format';
import { mountTiles, troubled } from '../status/Tiles';
import { mountAlerts, mountProtection, mountStorage, mountWatchdog, mountWeek, storageShown } from '../status/Cards';
import { type AppListActions, type AppListProps, clearAppList, mountAppList, mountShowAll, type Pending } from '../status/AppList';
import { store } from '../store';
import { ReleaseNotes } from '../status/ReleaseNotes';
import { h as vnode } from 'preact';
import { mountStatusNote } from '../parts/Notes';
import { Buttons, mountSheet, mountSheets, PhoneCode, type SheetButton, SignIns } from '../sheets/Sheet';
import { mountCrashNote } from '../status/CrashNote';
import { type History as UsageHistory, mountUsage, record as recordUsage } from '../status/Usage';
import { settingLabel, showSettingsPage } from './settings';
import { catalog, renderApps, replan, selected } from './choose';
import { cliProgress, startJob } from '../jobs';
import { navigate } from '../app';
import { $, errorText, go, notOnPhone, osName, showError, thisMachine } from '../core';

// Status
export let statusById: Record<string, api.AppStatus> = {}; // the latest status, best effort: empty while the runtime is down

// The apps the battery saver paused, from the last Status.
let batteryPaused = new Set<string>();
// Each app's share of the watchdog's passing checks this week (0 to 1).
let weekUp = {};

// The savings trend: a sparkline of the last 90 recorded days and the
// change since the first of them (the nightly backup records one a day).
let savingsHistory: savings.Point[] = [];
let lastAttention = -1;
function renderTiles(st: api.Status) {
  const trouble = st.apps.filter(troubled);
  mountTiles($('tiles'), {
    status: st,
    history: savingsHistory,
    onPause: async (paused) => {
      try { await go().SetUpdatesPaused(paused); } catch (err) { showError(err); }
      await loadStatus();
    },
    onChoose: () => navigate('choose'),
  });
  const n = trouble.length;
  $('statusCount').textContent = n ? String(n) : '';
  // The same count on the Dock icon (the Mac), as Mail shows unread mail;
  // a phone has no Dock.
  if (n !== lastAttention && !document.documentElement.classList.contains('companion')) {
    lastAttention = n;
    Promise.resolve(go().SetAttention(n)).catch(() => {});
  }
  // Fix it for what it can repair: baseline apps down, or unwell ones
  // (a stopped optional app was stopped on purpose).
  $('fixIt').hidden = !(st.missing || st.apps.some((a) => a.health === 'unhealthy' || a.health === 'restarting' || a.notAnswering || a.settingsChanged));
}

mountShowAll($('statusAllBox'));

// The app list from the status last loaded; opening or folding a category
// is the list's own (AppList.tsx), so it never asks the runtime.
let lastStatus: api.Status | null = null;
function renderAppList(st: api.Status) {
  // Grouped by category, as on Choose stacks; what needs a look comes
  // first, in a group of its own.
  const trouble = (a) => a.health === 'unhealthy' || a.health === 'restarting' || a.state === 'missing';
  const catOf = Object.fromEntries((catalog?.apps || []).map((x) => [x.id, x.category]));
  const groups: { label: string; apps: api.AppStatus[]; alert?: boolean }[] = [{ label: 'Needs a look', apps: st.apps.filter(trouble), alert: true },
    ...(catalog?.categories || []).map((c) => ({ label: c.label, apps: st.apps.filter((a) => !trouble(a) && catOf[a.id] === c.id) })),
    { label: 'Other', apps: st.apps.filter((a) => !trouble(a) && !(catalog?.categories || []).some((c) => c.id === catOf[a.id])) }].filter((g) => g.apps.length);
  appList = { groups, pending, catalog, weekUp, batteryPaused, busy: appsBusy, companion: document.documentElement.classList.contains('companion'), os: osName, on: appListActions };
  mountAppList($('statusRows'), appList);
}

// Status comes without waiting for the apps' pages (up to 3 seconds when
// one hangs); the answers fill in after, on the same status if no newer one
// has been drawn since. A board's come as its "answers" card; a Status the
// agent sent asks for them.
async function answerPages(st: api.Status) {
  let why: Record<string, string>;
  try { why = await go().Answers(); } catch { return; }
  applyAnswers(st, why);
}
function applyAnswers(st: api.Status, why: Record<string, string>) {
  if (lastStatus !== st) return;
  let changed = false;
  for (const a of st.apps) {
    if (!(a.id in why) || (a.notAnswering || '') === why[a.id]) continue;
    a.notAnswering = why[a.id] || undefined;
    changed = true;
  }
  st.checking = false;
  if (!changed) return;
  renderTiles(st);
  renderAppList(st);
}

// A crash of the app, the menu bar item, or the agent since it was last
// waved away: a note at the top of Status, whose button makes the report.
async function loadCrash() {
  let c: crash.Crash | null = null;
  try { c = await go().LastCrash(); } catch { /* an older backend */ }
  showCrash(c);
}
function showCrash(c: crash.Crash | null) {
  const seen = () => go().CrashSeen().catch(() => {}).then(loadCrash);
  mountCrashNote($('crashNote'), {
    crash: c,
    send: () => { seen(); navigate('settings'); showSettingsPage(thisMachine); $('report').click(); },
    hide: seen,
  });
}

// Status as last read (store.ts), with the cards beside it read alongside.
export const statusData = store(readStatus);
// The agent's last reading, drawn at once when the window opens (marked
// with its age) while Status reads a fresh one; none once that is in.
let remembered: api.Reading | null = null;
export async function drawRemembered(last: Promise<api.Reading | null>) {
  let r: api.Reading | null = null;
  try { r = await last; } catch { return; } // an older agent or phone companion
  if (!r || statusData.value || statusData.error) return; // none, or the fresh one came first
  remembered = r;
  statusData.set(r.status);
  statusData.stale(); // read when Status shows
}
statusData.watch(drawStatus);
export function loadStatus() { return statusData.load(); }

// One request for Status and the cards beside it (StatusBoard): Status
// comes back, and each card as a status:card event as soon as it is read,
// so the quick ones show while the slow ones are still being read. The
// cards read at most every so often are asked for only when due.
let boardNo = 0; // the latest board asked for
let boardStatus: api.Status | null = null; // its Status, once in
let boardFailed = false; // its Status could not be read
let boardAnswers: Record<string, string> | null = null; // its pages' answers, once in
async function readStatus() {
  const want = ['watchdog', 'crash', 'alerts', 'storage'];
  if (!savingsHistory.length) want.push('savings');
  if (Date.now() - protectionAt > 60000) { protectionAt = Date.now(); want.push('protection'); }
  if (Date.now() - usageAt >= 9000) { usageAt = Date.now(); want.push('usage'); }
  if (Date.now() - weekAt >= 600000) { weekAt = Date.now(); want.push('week'); }
  const n = ++boardNo;
  boardStatus = boardAnswers = null;
  boardFailed = false;
  try {
    const st = boardServed
      ? await go().StatusBoard(n, want).catch((e) => {
        if (!notOnPhone(e)) throw e;
        boardServed = false;
        return statusAlone(n, want);
      })
      : await statusAlone(n, want);
    if (n === boardNo) boardStatus = st;
    return st;
  } catch (e) {
    if (n === boardNo) boardFailed = true;
    // The cards that ask the runtime were not read: due again next time.
    if (want.includes('protection')) protectionAt = 0;
    if (want.includes('usage')) usageAt = 0;
    if (want.includes('week')) weekAt = 0;
    throw e;
  }
}

// A phone's computer from before StatusBoard (0.14.9 and earlier) refuses it:
// Status alone, then the phone's cards that computer answers one by one
// (the others were never read on a phone).
let boardServed = true;
const singly: Record<string, string> = { watchdog: 'Watchdog', alerts: 'Alerts', protection: 'Protection', savings: 'SavingsHistory' };
async function statusAlone(n: number, want: string[]) {
  const st = await go().Status();
  for (const name of want.filter((w) => singly[w])) {
    (go() as any)[singly[name]]().then((data) => showCard({ board: n, name, data }), (e) => showCard({ board: n, name, data: null, error: errorText(e) }));
  }
  return st;
}

window.runtime?.EventsOn?.('status:card', showCard);
function showCard(c) {
  // While Status cannot be read only a crash shows (it may say why).
  if (c.board === boardNo && boardFailed && c.name !== 'crash') return;
  const err = c.error ? new Error(c.error) : null;
  const data: any = c.data;
  switch (c.name) {
    case 'watchdog': showWatchdog(err ? null : data); break;
    case 'crash': showCrash(err ? null : data); break;
    case 'savings':
      savingsHistory = (!err && data) || [];
      if (lastStatus) renderTiles(lastStatus);
      break;
    case 'protection': showProtection(data, err); break;
    case 'alerts': showAlerts(data, err); break;
    case 'storage': showStorage(err ? null : data); break;
    case 'usage': showUsage((!err && data) || []); break;
    case 'week': showWeek(err ? null : data); break;
    case 'answers':
      if (c.board !== boardNo) return;
      boardAnswers = data || {};
      if (boardStatus) applyAnswers(boardStatus, boardAnswers);
  }
}

function drawStatus() {
  const kept = !statusData.error && statusData.value === remembered?.status;
  $('statusAge').hidden = !kept;
  if (kept) $('statusAge').textContent = `As it was ${Date.now() - new Date(remembered!.at).getTime() < 60000 ? 'a few seconds ago' : ago(remembered!.at)}; checking now…`;
  if (statusData.error) {
    // Most often the container runtime is not running: say so plainly.
    statusById = {};
    if (catalog) renderApps();
    appList = lastStatus = null;
    clearAppList($('statusRows'));
    $('statusRows').closest('table').hidden = true;
    $('tiles').replaceChildren();
    $('alertsCard').hidden = true;
    $('watchCard').hidden = true;
    $('protectCard').hidden = true;
    protectionAt = 0;
    const e: any = statusData.error;
    mountStatusNote($('statusNote'), { text: '', down: String((e && e.message) || e) });
    return;
  }
  const st = statusData.value!;
  statusById = Object.fromEntries(st.apps.map((a) => [a.id, a]));
  if (catalog) renderApps(); // Choose stacks ticks what runs
  batteryPaused = new Set(st.batteryPaused || []);
  renderTiles(st);
  $('statusRows').closest('table').hidden = false;
  lastStatus = st;
  renderAppList(st);
  if (st.checking && !kept) {
    if (st !== boardStatus) answerPages(st);
    else if (boardAnswers) applyAnswers(st, boardAnswers);
  }
  const waiting = [...new Set(st.apps.filter((a) => a.state === 'stopped' && a.waitingFor).map((a) => a.waitingFor.replace(/^\/Volumes\//, '')))];
  mountStatusNote($('statusNote'), { text: [waiting.length ? `Plug in ${waiting.join(' and ')}: the apps waiting for ${waiting.length === 1 ? 'it' : 'them'} start within 15 minutes of ${waiting.length === 1 ? 'it' : 'them'} appearing.` : '',
    batteryPaused.size ? `On battery: ${batteryPaused.size} app${batteryPaused.size === 1 ? '' : 's'} paused until this computer is plugged in (Settings › Battery saver).` : '',
    st.unmatched === 1 ? '1 other container on this machine isn’t a catalog app.' : st.unmatched ? `${st.unmatched} other containers on this machine aren’t catalog apps.` : ''].filter(Boolean).join(' ') });
}

// The watchdog's last run: every app, public address, database copy,
// Duplicati job, and the CrowdSec bouncer, checked every 15 minutes by the
// scheduled job. Failing checks are the ones it alerted about.
function showWatchdog(w: health.Summary | null) {
  const card = $('watchCard');
  if (!w) { card.hidden = true; return; }
  weekUp = w.week || {};
  if (appList && lastStatus) renderAppList(lastStatus); // the week on the rows
  card.hidden = false;
  mountWatchdog(card, { w, openSetup: () => { navigate('setup'); }, fix: () => cliFlow('Fix it', 'fix', '', 'Fix these') });
}

// Protection: whether the proxy enforces CrowdSec's bans, and the attacks
// CrowdSec caught this week. Read once a minute (each read runs cscli in
// its container); hidden until CrowdSec and the proxy run.
let protectionAt = 0;
function showProtection(p: crowdsec.Protection, err: Error | null) {
  const card = $('protectCard');
  if (err) { card.hidden = true; return; }
  card.hidden = false;
  mountProtection(card, { p, fix: () => cliFlow('Fix it', 'fix', '', 'Fix these') });
}

// Photos per person: what each person keeps in Immich, as the nightly
// backup last read it, largest first, with a bar against the largest.
function showStorage(rec: storage.Record | null) {
  const card = $('storageCard');
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
  showUsage(stats);
}
function showUsage(stats: docker.Stat[]) {
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
function showWeek(w: app.Weekly | null) {
  const card = $('weekCard');
  if (!w) { card.hidden = true; return; }
  card.hidden = !w.body.split('\n').some(Boolean);
  if (!card.hidden) mountWeek(card, { w });
}

// Recent alerts: what the nightly updates, Duplicati, Uptime Kuma, and the watchdog
// sent to ntfy in the last 12 hours, read with notify setup's read token,
// less those whose problem has cleared (core.Current). Check again reads
// Status and its cards now.
function showAlerts(events: notify.Event[] | null, err: Error | null) {
  const card = $('alertsCard');
  const openSetup = () => { navigate('setup'); };
  card.hidden = false;
  if (err) mountAlerts(card, { events: null, problem: err.message, openSetup, refresh: loadStatus });
  else mountAlerts(card, { events: events || [], openSetup, refresh: loadStatus });
}

// What the app list's rows do.
const appListActions: AppListActions = {
  act: (a, action) => (action === 'update' ? showUpdate(a) : runAppAction(a, action)),
  openNative: (a) => go().OpenNativeApp(a.id).then(() => { setTimeout(loadStatus, 3000); }, (err) => { showError(err); throw err; }),
  install: (a) => { selected.add(a.id); navigate('choose'); renderApps(); replan(); },
  adopt: (a) => cliFlow(`Move ${a.name} into the homelab`, 'adopt', a.id, 'Move it'),
  open: (url) => go().Open(url),
  page: (a) => pageOpener.open(a.id),
  startAll: async (apps, progress) => {
    for (const [i, a] of apps.entries()) {
      progress(i);
      setPending(a.id, { action: 'start' });
      try { await go().AppAction(a.id, 'start'); } catch (err) {
        setPending(a.id, { action: 'start', failed: errorText(err) });
        break;
      }
    }
    await loadStatus();
    for (const a of apps) if (!pending[a.id]?.failed) setPending(a.id, null);
  },
};
// An app's page (screens/apppage.ts) runs the rows' actions with its own
// buttons and follows what they do; it sets how a row opens it.
export const pageOpener = { open: (_id: string) => {} };
export const appActions = { act: (a: api.AppStatus, action: string) => appListActions.act(a, action), phone: showQR, signIn: showSignIn, update: showUpdate };
export const pendingOf = (id: string): Pending | undefined => pending[id];
export const appsBusyNow = () => appsBusy;
const rowWatchers: (() => void)[] = [];
/** Calls fn when a row's action starts, ends, or fails. */
export function watchRows(fn: () => void) { rowWatchers.push(fn); }
// The list as last shown, and whether an app's command runs (every row's
// buttons wait meanwhile).
let appList: AppListProps | null = null;
let appsBusy = false;
function setAppsBusy(busy: boolean) {
  appsBusy = busy;
  if (appList) mountAppList($('statusRows'), (appList = { ...appList, busy }));
  rowWatchers.forEach((fn) => fn());
}
// A click answers at once: the row says what it is doing ("Starting…")
// until Status confirms it, or goes back as it was and says why it failed.
const pending: Record<string, Pending> = {};
function setPending(id: string, p: Pending | null) {
  if (p) pending[id] = p; else delete pending[id];
  if (appList) mountAppList($('statusRows'), (appList = { ...appList, pending: { ...pending } }));
  rowWatchers.forEach((fn) => fn());
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
  mountSheet($('cliActions'), vnode(PhoneCode, { url, img, tailnet: /\.ts\.net(:|$)/.test(a.address), phoneApp: catalog?.apps.find((c) => c.id === a.id)?.phone, close: closeCli }));
  panel.scrollIntoView({ block: 'nearest' });
}
// Closes the command sheet, its log ready for the next command.
function closeCli() { $('cliPanel').hidden = true; $('cliLog').hidden = false; }
// The command sheet's buttons, in place of what it showed.
const cliButtons = (buttons: SheetButton[]) => mountSheet($('cliActions'), vnode(Buttons, { buttons }));

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
  const rows = keys.map((k) => {
    const s = byKey[k] || ({} as any);
    const copy = s.secret
      ? () => go().CopySetting(k).then(() => '✓ Password copied; the clipboard clears in 90 seconds.', (e) => { showError(e); throw e; })
      : async () => { window.runtime.ClipboardSetText?.(s.value || ''); return `✓ ${label(k)} copied.`; };
    return { label: label(k), shown: s.secret ? (s.set ? '••••••••' : 'not set') : (s.value || 'not set'), copy: s.set ? copy : undefined };
  });
  mountSheet($('cliActions'), vnode(SignIns, { rows, close: closeCli }));
  panel.scrollIntoView({ block: 'nearest' });
}

const actionTitle = { start: 'Starting', stop: 'Stopping', restart: 'Restarting', update: 'Updating', rollback: 'Rolling back' };
async function runAppAction(a, action) {
  const panel = $('cliPanel'), log = $('cliLog');
  log.hidden = false;
  if (cliStop) cliStop();
  panel.hidden = false;
  $('cliTitle').textContent = `${actionTitle[action]} ${a.name}…`;
  log.textContent = '';
  startJob('cli');
  cliButtons([]);
  setPending(a.id, { action });
  setAppsBusy(true);
  panel.scrollIntoView({ block: 'nearest' });
  const off = window.runtime.EventsOn('cli:log', (line) => { log.textContent += line + '\n'; log.scrollTop = log.scrollHeight; });
  let failed = '';
  try { await go().AppAction(a.id, action); } catch (e) { failed = errorText(e); showError(e); }
  // A failure puts the row back at once, saying why; a success waits for
  // the runtime to confirm it.
  if (failed) setPending(a.id, { action, failed });
  setAppsBusy(false);
  if (typeof off === 'function') off();
  cliProgress(failed ? 'failed' : 'done');
  $('cliTitle').textContent = failed ? `${actionTitle[action]} ${a.name} failed` : `${a.name}: ${action} done`;
  cliButtons([{ label: 'Close', onClick: () => { panel.hidden = true; } }]);
  await loadStatus();
  if (!failed) setPending(a.id, null);
}

// Update: what it brings first (its newer releases' notes), then Update
// runs it in the same panel.
function showUpdate(a) {
  const panel = $('cliPanel');
  if (cliStop) cliStop();
  panel.hidden = false;
  $('cliTitle').textContent = `Update ${a.name}`;
  $('cliLog').hidden = true;
  cliProgress(null);
  mountSheet($('cliActions'), vnode(ReleaseNotes, {
    key: a.id,
    name: a.name,
    load: () => go().ReleaseNotes(a.id),
    onUpdate: () => runAppAction(a, 'update'),
    onCancel: closeCli,
    open: (url) => go().Open(url),
  }));
  panel.scrollIntoView({ block: 'nearest' });
}

// The command sheet (sheets/Sheet.tsx), closed until a command opens it.
// Status behind it holds still (see refreshStatus) and catches up once it
// closes.
mountSheets($('sheets'), () => { if (missed) refreshStatus(); });

// A homelab command with a preview: show its plan, then run it on confirm.
let cliStop = null; // the open flow's log listener
export async function cliFlow(title, action, target, confirmLabel) {
  const panel = $('cliPanel'), log = $('cliLog');
  log.hidden = false;
  if (cliStop) cliStop();
  panel.hidden = false;
  $('cliTitle').textContent = title;
  log.textContent = '';
  startJob('cli');
  cliButtons([]);
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
  cliButtons([
    { label: confirmLabel, primary: true, onClick: async () => {
      log.textContent += '\n';
      // Running, it can no longer be cancelled: no buttons until it ends.
      cliButtons([]);
      let failed = false;
      try { await go().Homelab(action, target, true); } catch (err) { failed = true; showError(err); }
      cliProgress(failed ? 'failed' : 'done');
      stop();
      cliButtons([{ label: 'Close', onClick: () => { panel.hidden = true; } }]);
      loadStatus();
    } },
    { label: 'Cancel', onClick: () => { stop(); panel.hidden = true; } },
  ]);
}
$('cleanup').onclick = () => cliFlow('Remove old containers whose apps now run in the homelab', 'cleanup', '', 'Remove them');
$('fixIt').onclick = () => cliFlow('Fix it', 'fix', '', 'Fix these');
$('updateAll').onclick = () => cliFlow('Update all apps now', 'update-all', '', 'Update them');

// More… on Status: the actions needed now and then, with the keys every
// menu takes: Down (or Enter) opens it on its first item, Up and Down move
// through the items, Escape closes it back on More…, and it closes when the
// focus leaves it.
const menuItems = () => ([...$('statusMenu').querySelectorAll('[role=menuitem]')] as HTMLButtonElement[]).filter((b) => !b.hidden && !b.disabled);
function closeMenu() { $('statusMenu').hidden = true; $('statusMore').setAttribute('aria-expanded', 'false'); }
function openMenu(at?: 'first' | 'last') {
  $('statusMenu').hidden = false;
  $('statusMore').setAttribute('aria-expanded', 'true');
  const items = menuItems();
  if (at && items.length) items[at === 'first' ? 0 : items.length - 1].focus();
}
$('statusMore').onclick = (e) => {
  e.stopPropagation();
  // A click from the keyboard (Enter, Space) has no pointer: it opens on the first item.
  if ($('statusMenu').hidden) openMenu(e.detail === 0 ? 'first' : undefined); else closeMenu();
};
$('statusMore').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openMenu(e.key === 'ArrowDown' ? 'first' : 'last'); }
});
$('statusMenu').addEventListener('keydown', (e) => {
  const items = menuItems(), at = items.indexOf(document.activeElement as HTMLButtonElement);
  const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: items.length - 1 }[e.key];
  if (to === undefined || !items.length) return;
  e.preventDefault();
  items[(to + items.length) % items.length].focus();
});
$('statusMenu').addEventListener('click', closeMenu);
document.addEventListener('click', (e) => { if (!$('statusMenu').hidden && !(e.target as Element).closest('.menuwrap')) closeMenu(); });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || $('statusMenu').hidden) return;
  const inside = $('statusMenu').contains(document.activeElement);
  closeMenu();
  if (inside) $('statusMore').focus();
});
// The focus moving on (Tab, or a click elsewhere) closes it; the window
// losing the focus to another app does not.
$('statusMore').closest('.menuwrap')!.addEventListener('focusout', () => setTimeout(() => {
  if (!$('statusMenu').hidden && document.hasFocus() && !$('statusMore').closest('.menuwrap')!.contains(document.activeElement)) closeMenu();
}));
// Status follows the engine (app.go's status:changed): a container that
// starts, stops, or changes health is drawn at once. The agent sends the
// Status it read after the change, which is drawn as it is, on any screen,
// with nothing asked; from a watcher in this app (no agent) Status is read
// again (one read at a time; a change during one reads again after it).
// The poll each minute catches what the engine does not report (the
// watchdog, storage, alerts). Without a Status, another screen only marks
// it out of date, read when picked; behind an open sheet it waits either
// way, so the page does not jump while a job runs (the sheet's closing
// reads it).
let missed = false; // a change came while a sheet was open
export function refreshStatus(c?: engine.Change) {
  const behind = document.documentElement.classList.contains('sheet-open');
  missed = behind;
  if (c?.status && !behind) { statusData.set(c.status); return; }
  if ($('status').classList.contains('active') && !behind) loadStatus(); else statusData.stale();
}
setInterval(refreshStatus, 60000);

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
      const a = $('reportDownload');
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      a.click();
      if (r.helper) location.href = 'mailto:' + encodeURIComponent(r.helper) + '?subject=' + encodeURIComponent('Homelab report') + '&body=' + encodeURIComponent(text + ' The file is attached.');
    }
  } catch (err) { if (err && err.name !== 'AbortError') showError(err); }
  btn.disabled = false;
  btn.textContent = 'Send a report';
};
