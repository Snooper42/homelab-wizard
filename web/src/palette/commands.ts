// What the command palette (Palette.tsx) offers, read fresh each time it
// opens or Status changes: the screens, the commands used now and then
// (Update all, Back up now, Check again, Hide amounts), each group's Start,
// Restart, and Stop, and each app's Open, page, Restart, Stop, Logs, and
// Copy address, as its row's menu has them. Each runs what the screen's own
// button does, so nothing here changes state another way: Update all shows
// its list first, Stop asks for a second press.
import { appsBusyNow, batteryPausedNow, heldNow, pageOpener, rowActions, statusById } from '../screens/status';
import { catalog } from '../screens/choose';
import { financesData, toggleHideAmounts } from '../screens/finances';
import { here, navigate, reloadScreen } from '../app';
import { sendTo, targetsFor } from '../phone/send';
import { $, isMac, mod, onPhone } from '../core';
import { openShortcuts } from './Shortcuts';

export interface Command {
  id: string;
  label: string;
  /** What it is, or its shortcut, on the right: "⌘2", "Media". */
  hint?: string;
  /** Other words it is found by: the app's ID, its group, "backup". */
  also?: string;
  /** Stopping: a second press (Return or a click) runs it. */
  danger?: string;
  /** Runs it; what it says when it is done there and then ("Address copied"), the palette shows a moment. */
  run: () => void | Promise<string>;
}

/** Words as they are matched: lower case, accents off, split on anything else. */
export const words = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/**
 * The commands that have every word typed, each as the start of one of
 * theirs, best first: those whose own label has the words before those
 * found by their other words, and otherwise in the list's order.
 */
export function match(list: Command[], query: string): Command[] {
  const want = words(query);
  if (!want.length) return list;
  const scored: { c: Command; score: number; i: number }[] = [];
  list.forEach((c, i) => {
    const own = words(c.label), other = [...own, ...words(c.also || '')];
    if (!want.every((w) => other.some((o) => o.startsWith(w)))) return;
    let score = want.filter((w) => own.some((o) => o.startsWith(w))).length * 2;
    if (own.join(' ') === want.join(' ')) score += 4;
    scored.push({ c, score, i });
  });
  return scored.sort((a, b) => b.score - a.score || a.i - b.i).map((s) => s.c);
}

const screenList: [string, string, string, string][] = [
  ['choose', 'Choose apps', '1', 'install add apps'],
  ['status', 'Status', '2', 'apps running'],
  ['backups', 'Backups', '3', 'backup restore'],
  ['setup', 'Setup', '4', ''],
  ['settings', 'Settings', ',', 'preferences options'],
  ['finances', 'Finances', '6', 'money budget bills'],
  ['tidy', 'Tidy Up', '7', 'media library music books films'],
];

/** Finances' tabs as a link and a phone name them. */
const finTabs: Record<string, string> = { overview: 'Dashboard', transactions: 'Transactions', reports: 'Reports', calendar: 'Calendar', recurring: 'Recurring', pay: 'Paychecks', worth: 'Net worth' };

/** The page the window is on as a link a phone can open, and its name: an app's page, Status, Backups, a Finances tab. */
function sendable(): { link: string; title: string } | null {
  const p = here();
  if (!p) return null;
  if (p.screen === 'app' && p.app) return { link: 'homelab://app/' + p.app, title: statusById[p.app]?.name || p.app };
  if (p.screen === 'status' || p.screen === 'backups') return { link: 'homelab://' + p.screen, title: p.screen === 'status' ? 'Status' : 'Backups' };
  if (p.screen === 'finances') {
    const tab = p.tab && finTabs[p.tab] ? p.tab : 'overview';
    return { link: tab === 'overview' ? 'homelab://finances' : 'homelab://finances/' + tab, title: tab === 'overview' ? 'Finances' : `Finances › ${finTabs[tab]}` };
  }
  return null;
}

/** Status first, with the row's action showing, then fn. */
const onStatus = (fn: () => void) => () => { navigate('status'); fn(); };

export function commands(): Command[] {
  const phone = onPhone();
  const list: Command[] = [];
  const add = (c: Command) => list.push(c);
  // The commands used now and then.
  add({ id: 'reload', label: 'Check again', hint: mod + 'R', also: 'reload refresh', run: () => reloadScreen() });
  if (!phone) {
    add({ id: 'updateall', label: 'Update all apps', also: 'upgrade everything', run: onStatus(() => $('updateAll').click()) });
    add({ id: 'backupnow', label: 'Back up now', also: 'backup', run: () => { navigate('backups'); $('backupNow').click(); } });
  }
  if (!$('fixIt').hidden) add({ id: 'fixit', label: 'Fix it', also: 'repair what is wrong', run: onStatus(() => $('fixIt').click()) });
  const fin = financesData.value;
  if (fin && !fin.readOnly) add({ id: 'hide', label: fin.plan.hideAmounts ? 'Show amounts' : 'Hide amounts', hint: isMac ? '⌘⇧H' : 'Ctrl+Shift+H', also: 'money privacy blur', run: toggleHideAmounts });
  // Opened once the palette has closed and put the focus back, where the sheet returns it.
  if (!phone) add({ id: 'shortcuts', label: 'Keyboard shortcuts', hint: '?', also: 'keys help', run: () => { requestAnimationFrame(() => requestAnimationFrame(() => openShortcuts())); } });
  // Send to my phone: this page, to each phone it can go to (the owner, Nov 12: pick a phone each time).
  const page = sendable();
  if (page && !phone) for (const t of targetsFor(page.link)) add({ id: `send:${t.id}`, label: `Send ${page.title} to ${t.name}`, also: 'send to my phone open on', run: () => sendTo(t, page.link, page.title) });
  for (const [id, label, key, also] of screenList) {
    if (phone && (id === 'setup' || id === 'choose')) continue;
    add({ id: 'screen:' + id, label, hint: mod + key, also: 'screen go ' + also, run: () => navigate(id) });
  }

  const apps = Object.values(statusById);
  if (!apps.length) return list;
  const entry = (id: string) => catalog?.apps.find((c) => c.id === id);
  const busy = appsBusyNow(), held = heldNow(), paused = batteryPausedNow();
  const container = (a: api.AppStatus) => entry(a.id)?.kind !== 'native';
  const startable = (a: api.AppStatus) => a.state === 'stopped' && !a.waitingFor && !paused.has(a.id) && !held[a.id];
  const m = rowActions.menu;

  // Each group's Start, Restart, and Stop, as its menu on Status has them.
  if (!phone && !busy) {
    for (const g of catalog?.categories || []) {
      const mine = apps.filter((a) => entry(a.id)?.category === g.id && container(a));
      const running = mine.filter((a) => a.state === 'running'), stopped = mine.filter(startable);
      const n = (k: number) => (k === 1 ? `the 1 ${g.label} app` : `the ${k} ${g.label} apps`);
      const act = (action: 'start' | 'stop' | 'restart', of: api.AppStatus[]) => onStatus(() => { rowActions.groupAct(of, action, () => {}); });
      if (stopped.length) add({ id: `group:${g.id}:start`, label: `Start ${n(stopped.length)} stopped`, hint: g.label, run: act('start', stopped) });
      if (running.length) add({ id: `group:${g.id}:restart`, label: `Restart ${n(running.length)}`, hint: g.label, run: act('restart', running) });
      if (running.length) add({ id: `group:${g.id}:stop`, label: `Stop ${n(running.length)}`, hint: g.label, danger: `stop ${n(running.length)}`, run: act('stop', running) });
    }
  }

  // Each app's own, as its row's menu has them, by name.
  for (const a of apps.sort((x, y) => x.name.localeCompare(y.name))) {
    const g = catalog?.categories.find((c) => c.id === entry(a.id)?.category)?.label || '';
    const also = `${a.id} ${g}`;
    const url = a.address ? 'https://' + a.address : a.url || '';
    const running = a.state === 'running';
    const own = (verb: string, label: string, run: () => void, danger?: string) => add({ id: `app:${a.id}:${verb}`, label, hint: g, also, danger, run });
    if (running && url) own('open', `Open ${a.name}`, () => m.open(url));
    own('page', `${a.name}’s page`, () => pageOpener.open(a.id));
    if (container(a) && !phone && !busy) {
      if (a.state === 'stopped') own('start', `Start ${a.name}`, onStatus(() => m.act(a, 'start')));
      if (running) own('restart', `Restart ${a.name}`, onStatus(() => m.act(a, 'restart')));
      if (running) own('stop', `Stop ${a.name}`, onStatus(() => m.act(a, 'stop')), `stop ${a.name}`);
    }
    if (container(a)) own('logs', `${a.name}’s logs`, () => m.logs(a));
    if (url) own('copy', `Copy ${a.name}’s address`, () => m.copy(url).then(() => 'Address copied', () => 'Could not copy the address'));
  }
  return list;
}
