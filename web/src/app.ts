// Homelab Wizard frontend, in TypeScript: esbuild compiles it to
// web/dist/app.js (npm run build), which Wails serves and homelab serve
// shows on a phone. The Go methods in app.go are window.go.main.App, typed
// in web/types. This file chooses the screen, answers the keyboard, and
// starts the app; each screen's code is in web/src/screens, drawn by Preact
// components (*.tsx). app/preview/lint.mjs keeps it under 400 lines.
import { progress } from './setup/Checklist';
import { drawRemembered, loadStatus, refreshStatus, statusData } from './screens/status';
import { healthData, hostData, loadAppearance, loadHost, loadSetup, setupNav, stepsData } from './screens/setup';
import { changed, loadSettings, settingsData } from './screens/settings';
import { loadCatalog } from './screens/choose';
import { backupsData, jobsData, loadBackups } from './screens/backups';
import { openApp, refreshApp } from './screens/apppage';
import { updateFromMenu } from './screens/updates';
import { cliProgress, jobApp } from './jobs';
import { $, $$, $1, go, isMac, minute, mod, showError } from './core';

export function show(name) {
  // An app's page belongs to Status: its button stays the one picked.
  const picked = name === 'app' ? 'status' : name;
  $$('nav button').forEach((b) => {
    b.classList.toggle('active', b.dataset.screen === picked);
    if (b.dataset.screen === picked) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === name));
  setupNav();
  freshen(name);
}
// Each screen's data is kept between visits (store.ts): picking a screen
// draws what is kept, and reads it again only when it is out of date (the
// engine said it changed, an install added settings) or over a minute old.
// Settings with something typed and not saved are not read again.
function freshen(name) {
  if (name === 'status') { statusData.fresh(minute); healthData.fresh(minute); }
  if (name === 'app') { statusData.fresh(minute); refreshApp(); }
  if (name === 'backups') { backupsData.fresh(minute); jobsData.fresh(minute); }
  if (name === 'setup') { hostData.fresh(minute); stepsData.fresh(minute); healthData.fresh(minute); }
  if (name === 'settings') { hostData.fresh(minute); if (!Object.keys(changed).length) settingsData.fresh(minute); }
}
// Checking the screen again (⌘R, F5, the engine's refresh): its data read now.
function reload(name) {
  if (name === 'status') { loadStatus(); healthData.load(); }
  if (name === 'app') { loadStatus(); refreshApp(); }
  if (name === 'backups') loadBackups();
  if (name === 'setup') { loadHost().catch(showError); loadSetup(); healthData.load(); }
  if (name === 'settings') { loadSettings(); loadHost().catch(showError); }
}
// After picking a screen, VoiceOver and the keyboard start at its heading.
function focusScreen(name) {
  const h1 = $1(`#${name} h1`);
  if (!h1) return;
  h1.tabIndex = -1;
  h1.focus({ preventScroll: true });
}
let navigated = false; // the user picked a screen; never switch away from it
/** Picks a screen as the user would: the app never switches away from it after. */
export function navigate(name) {
  // The menu bar item's Update to …: Status, with the update going in place.
  if (name === 'update') { navigated = true; show('status'); updateFromMenu(); return; }
  navigated = true;
  show(name);
}
$$('nav button').forEach((b, i) => {
  b.onclick = () => { navigate(b.dataset.screen); focusScreen(b.dataset.screen); };
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
    if (current) reload(current);
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
    navigate('settings');
  } else if (n >= 1 && n <= screens.length) {
    e.preventDefault();
    navigate(screens[n - 1]);
  } else if (e.key.toLowerCase() === 'r') {
    e.preventDefault();
    if (current) reload(current);
  } else if (e.key.toLowerCase() === 'f') {
    const search = { choose: 'search', settings: 'settingsSearch' }[current];
    if (search) { e.preventDefault(); $(search).focus(); $(search).select(); }
  }
});

window.addEventListener('load', async () => {
  window.runtime.EventsOn('navigate', (screen) => { navigate(screen); });
  window.runtime.EventsOn('status:changed', refreshStatus);
  window.runtime.EventsOn('cli:step', cliProgress);
  window.runtime.EventsOn('job:app', jobApp);
  window.runtime.EventsOn('refresh', () => { const current = document.querySelector('.screen.active')?.id; if (current) reload(current); });
  await loadAppearance(); // before the first paint of the screens
  // Asked beside the machine, so the last Status is drawn without waiting for Docker.
  const last = Promise.resolve().then(() => go().LastStatus());
  try {
    const info = await loadHost();
    if (!info.rootOK) return show('setup');
    await loadCatalog();
    await drawRemembered(last);
    // The steps are read whatever screen opens: Setup's place in the sidebar follows them.
    const steps = stepsData.load();
    // A wall screen (the companion's kiosk mode) shows Status only.
    if (document.documentElement.classList.contains('kiosk')) return show('status');
    const screen = await go().Screen();
    if (screen) return screen.startsWith('app:') ? openApp(screen.slice(4)) : navigate(screen);
    // Until the first-time setup is done, the app opens on it.
    await steps;
    if (stepsData.error) throw stepsData.error;
    if (progress(stepsData.value!).left && !navigated) show('setup');
  } catch (e) {
    showError(e);
    show('setup');
  }
});
