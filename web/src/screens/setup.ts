// Setup: what still needs you (the checklist, a homelab update) and how
// this machine looks after the homelab. Once nothing needs you, Setup
// leaves the sidebar; the machine's details and the report live in
// Settings › This Mac, and Status keeps the machine's line.
import { mountAppearance } from '../settings/Appearance';
import { noAccentNote, systemOf } from '../differs';
import { applyAppearance, applyMotion } from '../appearance';
import { type HostActions, type HostProps, mountHost, mountNewHomelab, mountRuntime } from '../setup/Host';
import { downloadWords, mountBanner, mountUpgrade, upgradeShown } from '../setup/Upgrade';
import { type ChecklistActions, mountChecklist, progress } from '../setup/Checklist';
import { mountHealthLine, mountHealthTiles } from '../setup/Health';
import { store } from '../store';
import { type FootProps, mountFoot } from '../parts/Foot';
import { mountReportActions } from '../parts/Notes';
import { cliFlow } from './status';
import { drawSettings, form, showSettings } from './settings';
import { loadCatalog } from './choose';
import { endJob, startJob } from '../jobs';
import { mountJobApps } from '../job/Apps';
import { navigate, show } from '../app';
import { $, $1, go, isMac, osName, showError, thisMachine } from '../core';

// Setup
// How to get the newest app build on this machine's platform.
export let hostOS = '';
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

// Settings › Appearance, as kept on this machine, and the accent the system
// gave (Host), which a picked accent replaces.
let look: tray.Appearance = { theme: 'system', accent: '', contrast: 'system', layout: 'classic', icon: '', motion: 'system', transparency: 'system' };
let systemAccent: app.Accent | undefined;
export async function loadAppearance() {
  // The phone keeps no Appearance: it follows its system's motion and transparency.
  try { look = await go().Appearance(); } catch { applyMotion(look); return; }
  applyAppearance(look, systemAccent);
}
async function setAppearance(next: tray.Appearance) {
  look = next;
  applyAppearance(look, systemAccent); // at once; saving follows
  renderAppearance();
  try { look = await go().SetAppearance(next); } catch (e) { showError(e); }
}
export const renderAppearance = () => mountAppearance($('appearanceCard'), { look, system: systemAccent, noAccent: noAccentNote(systemOf(osName, hostOS)), set: setAppearance });

// The machine as last read (store.ts), with the two switches beside it.
export const hostData = store(async () => {
  const i = await go().Host();
  const [atLogin, menu] = await Promise.all([go().TrayAtLogin().catch(() => null), go().MenuEntry().catch(() => null)]);
  return { i, atLogin, menu };
});
hostData.watch(drawHost);
hostData.watch(drawHealth);

// How this machine looks after the homelab (Health.tsx): Setup's tiles and
// Status' line. The phone has none.
export const healthData = store(() => go().Health());
healthData.watch(drawHealth);
const machineWords = () => thisMachine.charAt(0).toLowerCase() + thisMachine.slice(1);
function drawHealth() {
  const h = healthData.value, i = hostData.value?.i;
  const props = h && i && !healthData.error ? {
    h, i, machine: machineWords(),
    startAgent: async () => { try { await go().StartAgent(); } catch (e) { showError(e); } await healthData.load(); },
    openSetup: () => navigate('setup'),
  } : null;
  $('healthTiles').hidden = !props || !i!.rootOK;
  $('healthLine').hidden = !props || !i!.rootOK;
  mountHealthTiles($('healthTiles'), props);
  mountHealthLine($('healthLine'), props);
}
// Reads the machine; a failed read throws, for the caller to say why.
export async function loadHost() {
  await hostData.load();
  if (hostData.error) throw hostData.error;
  return hostData.value!.i;
}

function drawHost() {
  if (hostData.error) return; // loadHost's caller says why
  const { i, atLogin, menu } = hostData.value!;
  hostOS = i.os || '';
  // Windows' Mica behind the side panel (drawn solid when Transparency is off: style.css).
  document.documentElement.classList.toggle('backdrop', !!i.backdrop);
  // The accent picked in the system's settings, in place of the platform's blue.
  const root = document.documentElement;
  // KDE Plasma (SteamOS's desktop) gets Breeze's look instead of GNOME's.
  root.classList.toggle('de-kde', i.desktop === 'kde');
  systemAccent = i.accent;
  applyAppearance(look, systemAccent);
  renderAppearance(); // its notes depend on the system, known from here
  host = { i, atLogin, menu, upgrade: host?.upgrade || null, on: hostActions };
  renderHost();
  $('thisMacTitle').textContent = thisMachine;
  drawFoot({ system: i.osVersion || i.os, version: i.version });
  if (i.rootOK) loadUpgrade(false);
  renderNewHomelab(i);
  renderRuntime(i);
}

// A job on this screen (Update, Go back, a step, the report): its bar, a
// row per app, and its log, which stay once it ends, to be read, until
// Clear takes them off.
function setupJob() {
  startJob('setup');
  $('setupClear').hidden = true;
}
function setupJobEnded() {
  endJob();
  $('setupClear').hidden = false;
}
$('setupClear').onclick = () => {
  $('setupProgress').hidden = true;
  $('setupProgress').classList.remove('failed');
  mountJobApps($('setupApps'), []);
  const log = $('setupLog');
  log.hidden = true;
  log.textContent = '';
  $('setupClear').hidden = true;
  setupNav();
};

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
    navigate('setup'); // from Settings › This Mac: its progress shows on Setup
    setupJob();
    const log = $('setupLog');
    log.hidden = false;
    log.textContent = 'Going back…\n';
    const off = window.runtime.EventsOn('cli:log', (line) => { log.textContent += line + '\n'; log.scrollTop = log.scrollHeight; });
    try { await go().Homelab('upgrade-back', '', true); } catch (e) { showError(e); }
    if (typeof off === 'function') off();
    setupJobEnded();
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
  // A folder the app made gets its files from the app's own copy, so after
  // a new app opens they are behind it: brought in line here, by itself,
  // so an update is one step rather than the app and then Setup › Update.
  if (c.kit && c.behind > 0 && !kitFinished && !upgrading) {
    kitFinished = true;
    finishUpdate();
    return;
  }
  footUpdate(upgradeShown(c));
  setupNav();
  if (host) { host = { ...host, upgrade: { behind: c.behind, appCommit: c.appCommit, previous: c.previous } }; renderHost(); }
  renderUpgrade();
}
// The last update check, and whether an update or an app install runs.
let upgradeInfo: app.UpgradeInfo | null = null;
let upgrading = false;
let kitFinished = false;
// The new app's homelab files, put in place (homelab upgrade), with the
// sidebar saying so; Setup's log shows each step.
async function finishUpdate() {
  drawFoot({ update: 'finishing' });
  await runUpgrade(null);
  await loadUpgrade(true);
}
function renderUpgrade() {
  const card = $('upgradeCard'), c = upgradeInfo;
  card.hidden = !c || !upgradeShown(c);
  mountUpgrade(card, c && !card.hidden ? { c, buildSteps: newestBuildSteps(), busy: upgrading, upgrade: () => runUpgrade(c.appUpdate), installApp: () => installApp(), open: (url) => go().Open(url) } : null);
}
// The sidebar says when an update is waiting, on every screen.
function footUpdate(on) { drawFoot({ update: on ? 'ready' : '' }); }
// The sidebar's foot (parts/Foot.tsx): this system, the version, and an update waiting.
let foot: FootProps = { system: '', version: '', update: '', openSetup: () => { navigate('setup'); } };
function drawFoot(change: Partial<FootProps>) { mountFoot($('foot'), (foot = { ...foot, ...change })); }
// Checked again every hour (the check itself asks GitHub at most every 10 minutes).
setInterval(() => { if (host?.i.rootOK) loadUpgrade(false); }, 3600e3);

// A newer app build, found in the background (app:update): what changed,
// Restart to update, and installing on quit instead. Later hides it until
// a newer build than that one turns up.
let updateLater = '';
let pendingUpdate: app.PendingUpdate | null = null;
function updateBanner(u: app.PendingUpdate | null) {
  pendingUpdate = u;
  const box = $('updateBanner');
  if (!u || u.commit === updateLater || document.documentElement.classList.contains('companion')) { box.hidden = true; mountBanner(box, null); return; }
  mountBanner(box, {
    u, isMac, download: appDownload,
    later: () => { updateLater = u.commit; box.hidden = true; },
    restart: async () => { try { await go().InstallAppUpdate(); } catch (e) { showError(e); throw e; } },
    setInstallOnQuit: async (on) => { try { await go().SetInstallOnQuit(on); } catch (e) { showError(e); throw e; } },
  });
  box.hidden = false;
}
window.runtime?.EventsOn?.('app:update', updateBanner);

// How far the app's own update has downloaded (app:download): the banner's
// bar, and Setup's while Update now runs.
let appDownload: app.Download | null = null;
let installingApp = false;
function downloadProgress(d: app.Download) {
  appDownload = d;
  if (pendingUpdate) updateBanner(pendingUpdate);
  const box = $('setupProgress');
  if (!installingApp || !box) return;
  box.hidden = false;
  box.classList.remove('failed');
  box.querySelector('.fill').style.width = `${d.percent >= 0 ? d.percent : 10}%`;
  box.querySelector('.step').textContent = downloadWords(d);
}
window.runtime?.EventsOn?.('app:download', downloadProgress);
try { go().PendingAppUpdate().then(updateBanner).catch(() => {}); } catch { /* the phone has no app to update */ }


// The newest app build in place of this one; the app quits and opens again.
async function installApp() {
  const log = $('setupLog');
  upgrading = true;
  installingApp = true;
  renderUpgrade();
  log.hidden = false;
  log.textContent += 'Downloading the newest Homelab Wizard (a minute or two)…\n';
  try {
    await go().InstallAppUpdate();
    log.textContent += 'Opening the new version…\n';
  } catch (e) {
    upgrading = false;
    installingApp = false;
    $('setupProgress').classList.add('failed');
    renderUpgrade();
    log.textContent += 'The app update stopped; the homelab is fine. Try again, or download it from the release page.\n';
    setupJobEnded();
    showError(e);
  }
}

async function runUpgrade(app?: app.AppUpdate | null) {
  setupJob();
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
  setupJobEnded();
  await loadHost();
  loadCatalog();
  loadSetup();
}
// The diagnostics report, in Settings › This Mac: its log under the button.
$('report').onclick = async () => {
  const log = $('reportLog'), btn = $('report');
  btn.disabled = true;
  mountReportActions($('reportActions'), null);
  log.hidden = false;
  log.textContent = 'Making the report (about a minute)…\n';
  const off = window.runtime.EventsOn('cli:log', (line) => { log.textContent += line + '\n'; log.scrollTop = log.scrollHeight; });
  let ok = true;
  try { await go().Homelab('report', '', false); } catch (e) { ok = false; showError(e); }
  if (typeof off === 'function') off();
  btn.disabled = false;
  if (ok) {
    const reveal = hostOS.startsWith('macOS') ? 'Show in Finder' : hostOS.startsWith('Windows') ? 'Show in Explorer' : 'Show the file';
    mountReportActions($('reportActions'), { reveal, show: () => go().RevealReport().catch(showError), email: () => go().EmailReport().catch(showError) });
  }
};
async function chooseRoot() {
  try { await go().ChooseRoot(); await loadHost(); await loadCatalog(); await loadSetup(); } catch (e) { showError(e); }
}

// First-time setup: the checklist from the engine, each step with its
// live check, what to fill in, and a button for what the engine can do.
export let lastSteps: setup.Step[] = [];
let showDoneSteps = false;
let showLaterSteps = false;
// The step running now: its buttons wait.
let runningStep: string | null = null;

function renderSetup(steps: setup.Step[]) {
  lastSteps = steps;
  const { done, total, left, wait } = progress(steps);
  const all = !left && !wait;
  $('checkTitle').textContent = all ? 'Everything is set up' : 'Finish setting up';
  $('checkCount').textContent = all ? '' : `${done} of ${total} done`;
  $('setupMeter').parentElement!.hidden = all;
  $('setupMeter').style.width = total ? `${Math.round((100 * done) / total)}%` : '0';
  setupBadge(left);
  const ready = runnable(steps);
  $('runAll').hidden = runningAll || ready.length < 2;
  if (!runningAll) $('runAll').textContent = `Do the ${ready.length} I can do for you`;
  mountChecklist($('checklist'), { steps, showDone: showDoneSteps, showLater: showLaterSteps, running: runningStep, on: checklistActions });
  setupNav();
}

// Setup is in the sidebar while it has something for you: a step left (or
// one that can wait), a homelab update, a missing runtime or folder, or a
// job's results still on it; and while it is the screen shown. Opened from
// the sidebar's update line, the tray, or its shortcut, it is always there.
export function setupNav() {
  const btn = $1('nav button[data-screen="setup"]');
  if (!btn) return;
  const p = lastSteps.length ? progress(lastSteps) : null;
  const i = hostData.value?.i;
  const needed = !p || p.left > 0 || p.wait > 0 || !!(upgradeInfo && upgradeShown(upgradeInfo)) || !i?.rootOK || !i?.runtimeOK
    || !$('setupClear').hidden || runningAll || !!runningStep || upgrading || $('setup').classList.contains('active');
  btn.hidden = !needed;
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
  markDone: async (s, done) => { try { stepsData.set(await go().MarkSetupDone(s.id, done)); } catch (err) { showError(err); } },
  toggleDone: () => { showDoneSteps = !showDoneSteps; renderSetup(lastSteps); },
  toggleLater: () => { showLaterSteps = !showLaterSteps; renderSetup(lastSteps); },
};

// The Setup tab shows how many first-time steps are left.
function setupBadge(left) {
  $('setupCount').textContent = left ? String(left) : '';
}

// The steps as last read (store.ts); a step that runs answers with them all.
export const stepsData = store(() => go().Setup());
stepsData.watch(() => {
  if (stepsData.error) return showError(stepsData.error);
  renderSetup(stepsData.value!);
  if (form) drawSettings(false, false); // each setting's step, marked under it
});
export async function loadSetup() {
  $('checkCount').textContent = 'checking…';
  await stepsData.load();
}
$('recheck').onclick = () => { loadSetup(); healthData.load(); loadHost().then(() => loadUpgrade(true)); };

// The steps whose button can run now, without a setting or a choice.
function runnable(steps) {
  return steps.filter((s) => s.state === 'todo' && s.run?.length);
}

// Do the steps I can: each ready step in turn, re-checked after each, until
// none is left or one fails.
let runningAll = false;
$('runAll').onclick = async () => {
  setupJob();
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
      stepsData.set(await go().RunSetup(next.id));
    }
    log.textContent += '\nDone. What is left needs you: a setting to fill in, a choice, or a step only a person can do.\n';
  } catch (e) {
    showError(e);
    log.textContent += '\nStopped at a step that failed: the log above says why.\n';
  } finally {
    if (typeof off === 'function') off();
    setupJobEnded();
    runningAll = false;
    btn.disabled = false;
    loadSetup();
  }
};

async function runStep(step: setup.Step, choice?: number) {
  setupJob();
  const log = $('setupLog');
  log.hidden = false;
  log.textContent = '';
  runningStep = step.id;
  renderSetup(lastSteps);
  const off = window.runtime.EventsOn('setup:log', (line) => { log.textContent += line + '\n'; log.scrollTop = log.scrollHeight; });
  try {
    const steps = await (choice === undefined ? go().RunSetup(step.id) : go().RunSetupChoice(step.id, choice));
    runningStep = null;
    stepsData.set(steps);
  } catch (e) {
    runningStep = null;
    showError(e);
    loadSetup();
  } finally {
    runningStep = null;
    if (typeof off === 'function') off();
    setupJobEnded();
  }
}
