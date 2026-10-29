// An app's page (page/AppPage.tsx): opened from its row on Status, it reads
// what it shows beside the Status already read (its usage, the watchdog's
// week, the last backup, who uses it), and its buttons run the rows'
// actions (screens/status.ts), so a row and the page say the same.
import { type Day, mountAppPage } from '../page/AppPage';
import { stateOf } from '../status/AppList';
import { appActions, appsBusyNow, cliFlow, pageOpener, pendingOf, statusById, statusData, watchRows } from './status';
import { backupsData } from './backups';
import { catalog } from './choose';
import { usedByPeople } from './settings';
import { navigate, show } from '../app';
import { $, $1, go, minute, showError, thisMachine } from '../core';

// The app shown, and what was read for it.
let id = '';
let usage: docker.Stat | null | undefined;
let disk: number | undefined;
let watch: health.Summary | null = null;
let household: people.Person[] | null = null;
let explainer = '';
// Its settings switched since the click, by app, until Status says so.
const switching: Record<string, Record<string, boolean>> = {};
async function setSetting(appId: string, setting: string, on: boolean) {
  switching[appId] = { ...switching[appId], [setting]: on };
  draw();
  try { await go().SetAppSetting(appId, setting, on); } catch (e) { showError(e); }
  await statusData.load().catch(() => {});
  const { [setting]: _, ...rest } = switching[appId] || {};
  switching[appId] = rest;
  draw();
}

// Each app's icon as last read; the Go side keeps them and asks the app once a week.
const icons: Record<string, string> = {};

const shown = () => !!id && $('app').classList.contains('active');

/** Opens an app's page, from its row or the app's --screen app:<id>. */
export function openApp(appId: string) {
  if (appId !== id) { usage = undefined; disk = undefined; household = null; }
  id = appId;
  navigate('app');
  const h1 = $1('#app h1');
  if (h1) { h1.tabIndex = -1; h1.focus({ preventScroll: true }); }
  $('app').scrollIntoView?.({ block: 'start' });
}
pageOpener.open = openApp;

/** Reads what the page shows again (picking it, ⌘R). */
export function refreshApp() {
  if (!id) return show('status');
  draw();
  readIcon(id);
  readUsage();
  readRest();
  backupsData.fresh(minute);
}

// The week's bars: the last seven days, oldest first, from the watchdog's
// runs per day.
function week(): Day[] {
  const runs = watch?.days?.[id] || {};
  const out: Day[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const [ok, all] = runs[key] || [0, 0];
    out.push({ letter: d.toLocaleDateString(undefined, { weekday: 'narrow' }), name: d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }), weekday: d.toLocaleDateString(undefined, { weekday: 'long' }), ok, all, today: i === 0 });
  }
  return out;
}

async function readUsage() {
  const at = id;
  let stats: docker.Stat[] = [];
  try { stats = (await go().Usage()) || []; } catch { /* the runtime is down: none */ }
  if (at !== id) return;
  usage = stats.find((s) => s.name === id) || null;
  draw();
}
// docker stats measures over a second or two: every 10 seconds while the page shows.
setInterval(() => { if (!document.hidden && shown()) readUsage(); }, 10000);

async function readIcon(of: string) {
  let icon = '';
  try { icon = (await go().AppIcon(of)) || ''; } catch { /* none: the letter */ }
  if (icon === (icons[of] || '')) return;
  icons[of] = icon;
  if (of === id) draw();
}

async function readRest() {
  const at = id;
  const [w, st, ppl, ex] = await Promise.allSettled([go().Watchdog(), go().Storage(), go().People(), go().Explainer()]);
  if (at !== id) return;
  watch = w.status === 'fulfilled' ? w.value : null;
  disk = st.status === 'fulfilled' ? st.value?.apps?.find((x) => x.app === id)?.bytes : undefined;
  household = ppl.status === 'fulfilled' ? (ppl.value || []).filter((p) => never(p.removed) && (!p.apps?.length || p.apps.includes(id))) : null;
  explainer = ex.status === 'fulfilled' ? ex.value || '' : '';
  draw();
}
const never = (t?: string) => !t || t.startsWith('0001-');

function draw() {
  if (!id) return;
  const a = statusById[id];
  if (!a) {
    // Not in the last Status (removed, or the runtime is down): back to Status.
    if (shown() && statusData.value) { mountAppPage($('appPage'), null); show('status'); }
    return;
  }
  const entry = catalog?.apps.find((c) => c.id === id);
  const companion = document.documentElement.classList.contains('companion');
  mountAppPage($('appPage'), {
    a, entry, state: stateOf(a, new Set(statusData.value?.batteryPaused || [])), pending: pendingOf(id), busy: appsBusyNow(),
    usage: a.state === 'running' ? usage : undefined, disk, days: week(), switching: switching[id] || {},
    backup: backupsData.value || null,
    people: usedByPeople(a, entry) && household ? household : null,
    icon: icons[id] || '', explainer,
    // Dozzle is kept to this computer (docs/Security.md, L1): not on a phone.
    dozzle: !companion && statusById.dozzle?.state === 'running' ? statusById.dozzle.url || '' : '',
    machine: thisMachine.replace(/^This/, 'this'), companion,
    on: {
      back: () => navigate('status'),
      act: (action) => appActions.act(a, action),
      update: () => appActions.update(a),
      open: (url) => go().Open(url),
      phone: () => appActions.phone(a),
      signIn: (keys) => appActions.signIn(a, keys),
      // The app's clipboard, or the browser's on a phone.
      copy: async (text) => {
        if (window.runtime.ClipboardSetText) await window.runtime.ClipboardSetText(text); else await navigator.clipboard.writeText(text);
        return 'Copied';
      },
      logs: (lines) => go().Logs(id, lines),
      explain: () => go().ExplainLogs(id),
      // Backups runs it, in its own panel with its progress.
      backupNow: () => { navigate('backups'); $('backupNow').click(); },
      openBackups: () => navigate('backups'),
      setting: (setting, on) => setSetting(a.id, setting, on),
      remove: () => cliFlow(`Remove ${a.name}: a backup of its data first, then its container goes`, 'remove', a.id, 'Back up and remove'),
      openPeople: () => { navigate('settings'); $('peopleCard')?.scrollIntoView({ block: 'start' }); },
    },
  });
}
statusData.watch(() => { if (shown()) draw(); });
backupsData.watch(() => { if (shown()) draw(); });
watchRows(() => { if (shown()) draw(); });
