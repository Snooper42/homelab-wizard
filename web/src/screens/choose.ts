// Choose stacks: the catalog, the picks, the plan, the install, and wiring
// the apps together.
import { catalogProblem, mountBundles, mountGroups, mountInputs, mountPlan, mountStarters } from '../choose/Choose';
import { appNote, systemOf } from '../differs';
import { mountJobApps } from '../job/Apps';
import { mountCategories, mountStarted, mountWiring, type WireLink } from '../choose/Started';
import { loadStatus, statusById, statusData } from './status';
import { hostOS } from './setup';
import { settingLabel, settingsData, showSettings } from './settings';
import { cliProgress, startJob } from '../jobs';
import { $, go, minute, osName, showError } from '../core';

// Choose stacks
export let catalog: api.Catalog | null = null;
export const selected = new Set<string>();
const settings: Record<string, string> = {}; // form values, sent with every plan and install
const appName = (id) => (catalog.apps.find((a) => a.id === id) || { name: id }).name;

export async function loadCatalog() {
  try {
    catalog = await go().Catalog();
  } catch (e) {
    catalogProblem($('groups'), String(e));
    return;
  }
  statusData.fresh(minute); // which apps run, for the ticks (drawStatus)
  fillCategories();
  // The starter picks come first; the full list waits behind Add more.
  const starters = catalog.presets.filter((p) => p.starter);
  $('starterBox').hidden = !starters.length;
  if (!starters.length) $('more').open = true;
  renderApps();
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
  mountCategories($('cCategory'), catalog.categories);
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

export function renderApps() {
  const picks = { selected, status: statusById, toggle: togglePreset };
  mountStarters($('starters'), { ...picks, presets: catalog.presets.filter((p) => p.starter) });
  mountBundles($('presets'), { ...picks, presets: catalog.presets.filter((p) => !p.starter && !p.id.startsWith('stack:')) });
  mountGroups($('groups'), {
    catalog, status: statusById, selected, query,
    tick: (id, on) => { if (on) selected.add(id); else selected.delete(id); renderApps(); replan(); },
    open: (url) => go().Open(url),
    settings: (keys) => showSettings(keys),
    note: (id) => appNote(id, systemOf(osName, hostOS)),
  });
}

let planSeq = 0;
let replanTimer = 0;
export function replan() { clearTimeout(replanTimer); replanTimer = setTimeout(doPlan, 250); }
const filled = () => Object.fromEntries(Object.entries(settings).filter(([, v]) => v !== ''));

async function doPlan() {
  const seq = ++planSeq;
  const tokens = [...selected];
  // A new choice after an install: its steps belonged to the last plan.
  if (tokens.length && !installing) {
    $('installProgress').hidden = true;
    mountJobApps($('installApps'), []);
    $('started').replaceChildren();
    $('wiring').replaceChildren();
    $('installLog').textContent = '';
    $('installDetails').hidden = true;
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
  startJob('install');
  $('started').replaceChildren();
  $('wiring').replaceChildren();
  // The plan's steps, in plain words, on the bar; each app's own row comes
  // from what Compose prints (job:app).
  const words = { env: 'Saving your settings', folders: 'Making the folders', networks: 'Getting the network ready' };
  const ilog = $('installLog');
  ilog.textContent = '';
  $('installDetails').hidden = true;
  const offLog = window.runtime.EventsOn('install:log', (line) => {
    $('installDetails').hidden = false;
    ilog.textContent += line + '\n';
    ilog.scrollTop = ilog.scrollHeight;
  });
  const off = window.runtime.EventsOn('progress', (ev) => {
    if (ev.error) return;
    const text = ev.name === 'start' ? `Starting ${(ev.apps || []).map(appName).join(', ')}` : words[ev.name];
    cliProgress({ n: ev.step, total: ev.steps + 1, text });
  });
  try {
    const started = await go().Install([...selected], filled());
    cliProgress('done');
    mountStarted($('started'), { started, open: (url) => go().Open(url) });
    if (!$('wireRow').hidden && $('wire').checked && started.length) await wire($('wiring'));
    selected.clear();
    // New apps: Settings has their settings, and Status (with the ticks here) changed.
    settingsData.stale();
    await loadStatus();
  } catch (e) {
    cliProgress('failed');
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
async function wire(box) {
  const done: WireLink[] = [];
  let note = 'Connecting… this can take a minute while new apps start.';
  const draw = () => mountWiring(box, { links: [...done], note });
  draw();
  const off = window.runtime.EventsOn('link', (l) => { done.push(l); draw(); });
  try {
    const links = await go().Wire();
    note = links.length ? '' : 'Nothing to connect: none of the apps it links is running.';
    draw();
  } catch (e) {
    showError(e);
  } finally {
    if (typeof off === 'function') off();
  }
}
$('connect').onclick = () => wire($('statusWiring'));
