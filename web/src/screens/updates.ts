// The update: one line at the top of every screen (updates/UpdateLine.tsx).
// The app looks for it by itself every 15 minutes and when the window
// comes forward (app/updates.go), downloads it ahead, and Update now puts
// the homelab files and the app in place in one step. Later hides the line
// until something newer turns up; the sidebar's ● Update ready brings it
// back. The menu bar item's Update to … opens the window on "update".
import { lineShown, mountUpdateLine, mountUpdateSettings } from '../updates/UpdateLine';
import { drawFoot } from './setup';
import { $, go, showError } from '../core';

let state: app.UpdateState | null = null;
let step: app.UpdateStep | null = null;
let download: app.Download | null = null;
let log = '';
let looking = false;
// Later: the update it hid, so a newer one shows again.
let laterKey = '';
let finishing = false;

const companion = () => document.documentElement.classList.contains('companion');
const key = (s: app.UpdateState) => `${s.version}|${s.files}|${s.app}`;
const ready = () => state?.state === 'ready';
const running = () => !!step && step.step !== 'done' && step.step !== 'failed';

function draw() {
  const box = $('updateLine');
  if (companion() || !state) { box.hidden = true; mountUpdateLine(box, null); return; }
  const hidden = !running() && step?.step !== 'failed' && ready() && laterKey === key(state) && !state.updated && !state.notInstalled;
  const shown = lineShown(state, step) && !hidden;
  box.hidden = !shown;
  box.className = 'updateline' + (step?.step === 'failed' ? ' failed' : state.updated && !ready() && !running() ? ' done' : '');
  mountUpdateLine(box, shown ? { s: state, step, download, log, update: updateNow, later, close, open: (url) => go().Open(url) } : null);
  drawFoot({ update: running() ? 'finishing' : ready() && hidden ? 'ready' : '', openSetup: showLine });
  const settings = $('updatesSettings');
  if (settings) mountUpdateSettings(settings, { s: state, looking, look: lookNow, setInstallOnQuit });
}

function set(s: app.UpdateState) {
  state = s;
  // The new app brought the files for the folder it made: they go in
  // place by themselves, once.
  if (s.finish && s.state === 'ready' && !finishing && !running()) {
    finishing = true;
    updateNow();
    return;
  }
  draw();
}

function later() { if (state) laterKey = key(state); draw(); }
function showLine() { laterKey = ''; draw(); }
function close() { go().ClearUpdated(); if (state) state = { ...state, updated: undefined, notInstalled: undefined }; step = null; draw(); }

/** Update now: the files, then the app, which opens again by itself. */
export async function updateNow() {
  if (running()) return;
  step = { step: 'files', percent: 3 };
  log = '';
  laterKey = '';
  draw();
  try {
    await go().UpdateNow();
  } catch (e) {
    // update:step says why; this is for a refusal before it began.
    if (!step || step.step !== 'failed') step = { step: 'failed', percent: 0, error: String((e && e.message) || e) };
    draw();
  }
}

async function lookNow() {
  looking = true;
  draw();
  try { set(await go().LookForUpdates(true)); } catch (e) { showError(e); }
  looking = false;
  draw();
}

async function setInstallOnQuit(on: boolean) {
  try { await go().SetInstallOnQuit(on); } catch (e) { showError(e); }
  try { set(await go().UpdateState()); } catch { /* the line keeps what it had */ }
}

// The window came forward: look again if the last look is 10 minutes old.
function cameForward() {
  if (document.hidden || companion()) return;
  go().LookForUpdates(false).then(set).catch(() => {});
}

/** The menu bar item's Update to …: the window opens on it and updates. */
export function updateFromMenu() {
  if (ready()) updateNow();
  else showLine();
}

/** Setup's Check again looks for updates too. */
export function lookForUpdates() { return lookNow(); }

if (window.runtime?.EventsOn) {
  window.runtime.EventsOn('update:state', set);
  window.runtime.EventsOn('update:step', async (e: app.UpdateStep) => {
    step = e;
    if (e.step === 'done') {
      try { state = await go().UpdateState(); } catch { /* keep the last */ }
      finishing = false;
    }
    draw();
  });
  window.runtime.EventsOn('app:download', (d: app.Download) => { download = d; if (running()) draw(); });
  window.runtime.EventsOn('cli:log', (line: string) => { if (running()) log += line + '\n'; });
}
window.addEventListener('focus', cameForward);
document.addEventListener('visibilitychange', cameForward);
try { go().UpdateState().then(set).catch(() => {}); } catch { /* the phone has no app to update */ }
