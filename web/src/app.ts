import { placeOf, readTargets, showSent } from './phone/send';
import { progress } from './setup/Checklist';
import { drawRemembered, leftStatus, loadStatus, pickStatusPart, refreshStatus, statusData, statusSideChanged, undoNow } from './screens/status';
import { drawHealth } from './status/healthLine';
import { healthData, hostData, loadAppearance, loadHost, loadSetup, setupNav, stepsData } from './screens/setup';
import { changed, loadSettings, settingsData } from './screens/settings';
import { loadCatalog } from './screens/choose';
import { backupsData, gapsData, jobsData, loadBackups } from './screens/backups';
import { openApp, openedApp, refreshApp } from './screens/apppage';
import { updateFromMenu } from './screens/updates';
import { financesData, ledgerData, loadFinances, sharedData, toggleHideAmounts } from './screens/finances';
import { loadTidy, tidyData } from './screens/tidy';
import { cliProgress, jobApp } from './jobs';
import { openPalette } from './palette/Palette';
import { openShortcuts } from './palette/Shortcuts';
import { undoShown } from './status/UndoNote';
import { arrivePlace, leavePlace } from './place';
import { wireNavMenus } from './palette/navMenu';
import { $, $$, $1, go, isMac, minute, mod, onPhone, showError } from './core';
import { h as vnode, render } from 'preact';
import { onTabChange, tabbed } from './tabs';

let placed = false; // a screen was shown: the one the page starts on has no place of its own to keep yet
export function show(name) {
  if (name === 'choose') { show('status'); pickStatusPart('find'); return; }
  const picked = name === 'app' || name === 'backups' ? 'status' : name;
  const was = document.querySelector('.screen.active')?.id;
  // Where the screen being left was (place.ts); not the one the page starts on, before any is shown.
  if (placed && was !== name) leavePlace(was);
  // Leaving Status (an app's page is part of it): what changed there is seen.
  if ((was === 'status' || was === 'app') && picked !== 'status') leftStatus();
  $$('nav button[data-screen]').forEach((b) => {
    b.classList.toggle('active', b.dataset.screen === picked);
    if (b.dataset.screen === picked) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === name));
  if (!placed || was !== name) arrivePlace(name);
  placed = true;
  setupNav();
  statusSideChanged();
  freshen(name);
  drawHealth(); // the line at the top: not on Status, on every other screen
}
function freshen(name) {
  if (name === 'status') { statusData.fresh(minute); healthData.fresh(minute); }
  if (name === 'app') { statusData.fresh(minute); refreshApp(); }
  // A phone's Status shows Setup's unfinished steps (no Setup tab there): read them at most every ten minutes.
  if (name === 'status' && onPhone()) stepsData.fresh(10 * minute);
  // Status too: a stale copy says why from its app's state.
  if (name === 'backups') { backupsData.fresh(minute); jobsData.fresh(minute); gapsData.fresh(minute).catch(() => {}); statusData.fresh(minute); }
  if (name === 'setup') { hostData.fresh(minute); stepsData.fresh(minute); healthData.fresh(minute); statusData.fresh(minute); }
  if (name === 'settings') { hostData.fresh(minute); if (!Object.keys(changed).length) settingsData.fresh(minute); }
  if (name === 'tidy') tidyData.fresh(minute);
  if (name === 'finances') { financesData.fresh(minute); ledgerData.fresh(minute); if (onPhone()) sharedData.fresh(5 * minute); }
  // The sidebar's Finances count shows on every screen (not on a phone): the
  // plan is read for it too, at most every five minutes off Finances.
  else if (!onPhone()) financesData.fresh(5 * minute);
  // The sidebar's foot says how the computer is on every screen: the machine read for it too, at most every five minutes.
  if (!onPhone()) healthData.fresh(5 * minute);
}
// Checking the screen again (⌘R, F5, the engine's refresh): its data read now.
/** Checks the screen that shows again (the palette's Check again). */
export function reloadScreen() { const current = document.querySelector('.screen.active')?.id; if (current) reload(current); }
function reload(name) {
  if (name === 'status') { loadStatus(); healthData.load(); }
  if (name === 'app') { loadStatus(); refreshApp(); }
  if (name === 'backups') loadBackups();
  if (name === 'setup') { loadHost().catch(showError); loadSetup(); healthData.load(); }
  if (name === 'settings') { loadSettings(); loadHost().catch(showError); }
  if (name === 'finances') loadFinances();
  if (name === 'tidy') loadTidy();
}
// After picking a screen, VoiceOver and the keyboard start at its heading.
export function focusScreen(name) {
  const h1 = $1(`#${name} h1`);
  if (!h1) return;
  h1.tabIndex = -1;
  h1.focus({ preventScroll: true });
}
let navigated = false; // the user picked a screen; never switch away from it
/** Picks a screen as the user would: the app never switches away from it after. */
export function navigate(name) {
  // The menu bar item's Update to …: Status, with the update going in place.
  if (name === 'update') { navigated = true; show('status'); updateFromMenu(); remember(); return; }
  navigated = true;
  show(name);
  remember();
}

type Place = { screen: string; app?: string; tab?: string };
const keep = 500;
const kept = (() => { try { return JSON.parse(localStorage.getItem('homelab.history') || '{}'); } catch { return {}; } })();
const back: Place[] = Array.isArray(kept.back) ? kept.back.slice(-keep) : [], ahead: Place[] = Array.isArray(kept.ahead) ? kept.ahead.slice(-keep) : [];
function keepHistory() { try { localStorage.setItem('homelab.history', JSON.stringify({ back: back.slice(-keep), ahead: ahead.slice(-keep) })); } catch { /* this device keeps none */ } }
let current: Place | undefined;
let moving = false;
onTabChange(() => remember());
function remember() {
  const screen = document.querySelector('.screen.active')?.id;
  if (!screen) return;
  const next = { screen, app: screen === 'app' ? openedApp() : undefined, tab: tabbed[screen]?.now() };
  if (!moving && current && (current.screen !== next.screen || current.app !== next.app || current.tab !== next.tab)) {
    back.push(current);
    if (back.length > keep) back.shift();
    ahead.length = 0;
    keepHistory();
  }
  current = next;
}
function visit(p: Place) {
  moving = true;
  try {
    if (p.screen === 'app' && p.app) openApp(p.app);
    else {
      if (p.tab !== undefined && tabbed[p.screen]?.now() !== p.tab) tabbed[p.screen]?.put(p.tab);
      navigate(p.screen);
      focusScreen(p.screen);
    }
  } finally { moving = false; }
}
/** Where the window is now: the screen, an app's page with its app, a screen's tab. */
export const here = (): Place | undefined => current;
/** Opens a place as a click would (a page the computer sent the phone): an app's page, or a screen on its tab. */
export function goTo(p: Place) {
  if (p.app) return openApp(p.app);
  if (p.tab !== undefined && tabbed[p.screen]?.now() !== p.tab) tabbed[p.screen]?.put(p.tab);
  navigate(p.screen);
  focusScreen(p.screen);
}
/** Back to the screen before (false when there is none). */
export function goBack(): boolean {
  const p = back.pop();
  if (!p) return false;
  if (current) ahead.push(current);
  visit(p);
  keepHistory();
  swipeHint('back');
  return true;
}
/** Forward to the screen Back left (false when there is none). */
export function goForward(): boolean {
  const p = ahead.pop();
  if (!p) return false;
  if (current) back.push(current);
  visit(p);
  keepHistory();
  swipeHint('forward');
  return true;
}
/** A small arrow at that edge for a moment: where Back or Forward went. */
let hintGone: number | undefined;
function swipeHint(way: 'back' | 'forward') {
  const box = document.getElementById('swipeHint');
  if (!box) return;
  window.clearTimeout(hintGone);
  render(vnode('div', { key: Date.now(), class: 'swipehint ' + way }, way === 'back' ? '‹' : '›'), box);
  hintGone = window.setTimeout(() => render(null, box), 500);
}
let swipeSum = 0, swipeAt = 0, swiped = false;
function scrollsSideways(t: EventTarget | null, dx: number): boolean {
  for (let el = t instanceof Element ? t : null; el && el !== document.body; el = el.parentElement) {
    if (!/(auto|scroll)/.test(getComputedStyle(el).overflowX) || el.scrollWidth <= el.clientWidth + 1) continue;
    if (dx < 0 ? el.scrollLeft > 0 : el.scrollLeft + el.clientWidth < el.scrollWidth - 1) return true;
  }
  return false;
}
addEventListener('wheel', (e) => {
  if (onPhone() || e.ctrlKey || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
  const now = performance.now();
  if (now - swipeAt > 300) { swipeSum = 0; swiped = false; }
  swipeAt = now;
  if (swiped || scrollsSideways(e.target, e.deltaX)) return;
  swipeSum += e.deltaX;
  if (Math.abs(swipeSum) > 150) { swiped = true; if (swipeSum < 0) goBack(); else goForward(); }
}, { passive: true });
// The mouse's own back and forward buttons.
addEventListener('mouseup', (e) => { if (e.button === 3 && goBack()) e.preventDefault(); if (e.button === 4 && goForward()) e.preventDefault(); });
// Cmd (Ctrl elsewhere) with a number picks a screen: the first five as they
// always were, Finances after them, then Tidy Up.
const screens = ['choose', 'status', 'backups', 'setup', 'settings', 'finances', 'tidy'];
// Quitting: where the screen showing was, for next time. Opening: the screen it starts on is put back at once,
// not only once the app picks it.
addEventListener('pagehide', () => leavePlace(document.querySelector('.screen.active')?.id));
{ const first = document.querySelector('.screen.active')?.id; if (first) { arrivePlace(first); placed = true; } }
remember();
// Closing the app on Status: what it showed is what was seen.
addEventListener('pagehide', () => { const on = document.querySelector('.screen.active')?.id; if (on === 'status' || on === 'app') leftStatus(); });
$$('nav button[data-screen]').forEach((b) => {
  b.onclick = () => { navigate(b.dataset.screen); focusScreen(b.dataset.screen); };
  b.title = `${b.querySelector('span').textContent.trim()} (${mod}${screens.indexOf(b.dataset.screen) + 1})`;
});
// A right-click on a screen in the sidebar: its own menu (palette/navMenu.tsx).
wireNavMenus();

let textSize = 1;
function setTextSize(z) {
  textSize = Math.round(Math.min(2, Math.max(0.8, z)) * 10) / 10;
  document.documentElement.style.setProperty('--zoom', String(textSize));
  try { localStorage.setItem('homelab.textSize', String(textSize)); } catch { /* none */ }
}
try { const z = Number(localStorage.getItem('homelab.textSize')); if (z) setTextSize(z); } catch { /* none */ }
document.addEventListener('keydown', (e) => {
  const current = document.querySelector('.screen.active')?.id;
  const target = e.target as any;
  // Back and Forward: ⌘[ ⌘] on the Mac; Alt+← Alt+→ elsewhere (not while typing, where they move the cursor).
  const typing = target.matches?.('input, textarea, select, [contenteditable="true"]');
  if (isMac ? e.metaKey && !e.shiftKey && !e.altKey && (e.key === '[' || e.key === ']') : e.altKey && !e.ctrlKey && !typing && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    const isBack = e.key === '[' || e.key === 'ArrowLeft';
    if (isBack ? goBack() : goForward()) e.preventDefault();
    return;
  }
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
    if (current) reload(current);
    return;
  }
  // ? (Shift+/ on most keyboards) lists the keyboard shortcuts, the focus not in a field or a menu.
  if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey && !target.closest?.('input, textarea, select, [contenteditable], [role=menu]')) {
    if (openShortcuts()) e.preventDefault();
    return;
  }
  if (!(isMac ? e.metaKey : e.ctrlKey) || e.altKey) return;
  // Bigger and smaller text: + and - (with or without Shift), 0 for the usual size.
  if (['=', '+', '-', '_', '0'].includes(e.key)) {
    e.preventDefault();
    setTextSize(e.key === '0' ? 1 : textSize + (e.key === '-' || e.key === '_' ? -0.1 : 0.1));
    return;
  }
  // ⌘⇧H (Ctrl+Shift+H) hides every amount, or shows them again, on any screen.
  if (e.shiftKey && e.key.toLowerCase() === 'h') {
    e.preventDefault();
    toggleHideAmounts();
    return;
  }
  // ⌘K (Ctrl+K) opens the command palette on any screen.
  if (!e.shiftKey && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openPalette();
    return;
  }
  // ⌘Z (Ctrl+Z) undoes the last stop while its note shows; in a field, it is the field's own undo.
  if (!e.shiftKey && e.key.toLowerCase() === 'z' && !target.closest?.('input, textarea, select, [contenteditable]') && (undoShown() || undoNow())) {
    e.preventDefault();
    return;
  }
  if (e.shiftKey) return;
  const n = Number(e.key);
  if (e.key === ',') {
    e.preventDefault();
    navigate('settings');
  } else if (n >= 1 && n <= screens.length) {
    e.preventDefault();
    navigate(screens[n - 1]);
  } else if (e.key.toLowerCase() === 'r') {
    e.preventDefault();
    if (current) reload(current);
  } else if (e.key.toLowerCase() === 'f') {
    const search = { status: 'statusFind', settings: 'settingsSearch' }[current];
    if (search) { e.preventDefault(); $(search).focus(); $(search).select(); }
    // Finances: Transactions' own search, while it shows.
    const box = current === 'finances' ? document.querySelector<HTMLInputElement>('#finances .fx-txsearch') : null;
    if (box) { e.preventDefault(); box.focus(); box.select(); }
  }
});

window.addEventListener('load', async () => {
  window.runtime.EventsOn('navigate', (screen) => { navigate(screen); });
  window.runtime.EventsOn('hideAmounts', () => toggleHideAmounts());
  window.runtime.EventsOn('palette', () => openPalette());
  window.runtime.EventsOn('status:changed', refreshStatus);
  // A page the computer sent this phone (Send to my phone): at the bottom, with Open.
  window.runtime.EventsOn('phone:open', (o) => showSent(o, goTo));
  void readTargets(); // the phones Send to my phone lists, read before a menu first asks
  // Open on the computer: a page a phone asked this window to show (the window has come forward already).
  window.runtime.EventsOn('open:link', (o) => { const p = placeOf(o.link); if (p) goTo(p); });
  window.runtime.EventsOn('cli:step', cliProgress);
  window.runtime.EventsOn('job:app', jobApp);
  window.runtime.EventsOn('refresh', reloadScreen);
  await loadAppearance(); // before the first paint of the screens
  // Asked beside the machine, so the last Status is drawn without waiting for Docker.
  // An older agent or phone companion has none (drawRemembered draws nothing).
  const last = Promise.resolve().then(() => go().LastStatus()).catch(() => null);
  try {
    const info = await loadHost();
    if (!info.rootOK) return show('setup');
    await loadCatalog();
    await drawRemembered(last);
    // The steps are read whatever screen opens: Setup's place in the sidebar
    // follows them. The phone has no Setup, and its computer does not serve one.
    const steps = onPhone() ? null : stepsData.load();
    // A wall screen (the companion's kiosk mode) shows Status only.
    if (document.documentElement.classList.contains('kiosk')) return show('status');
    const screen = await go().Screen();
    if (screen) return screen.startsWith('app:') ? openApp(screen.slice(4)) : navigate(screen);
    if (!steps) return show('status');
    // Until the first-time setup is done, the app opens on it.
    await steps;
    if (stepsData.error) throw stepsData.error;
    if (progress(stepsData.value!).left && !navigated) show('setup');
  } catch (e) {
    showError(e);
    show('setup');
  }
});
