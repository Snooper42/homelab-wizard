// Homelab Wizard frontend. Plain JavaScript, no build step: Wails serves
// this folder and exposes the Go methods in app.go as window.go.main.App.
const go = () => window.go.main.App;
const $ = (id) => document.getElementById(id);

// h builds an element; text is always set as text, never as HTML.
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
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

// Feather icons (MIT), as SVG path data.
const icons = {
  restart: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
  update: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  start: '<polygon points="6 3 20 12 6 21 6 3"/>',
  logs: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  rollback: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
  key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  photos: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  film: '<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
};
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.innerHTML = icons[name]; // constant markup from the table above
  return svg;
}

function showError(e) {
  const el = $('error');
  el.textContent = String((e && e.message) || e);
  el.hidden = false;
  clearTimeout(showError.timer);
  showError.timer = setTimeout(() => (el.hidden = true), 6000);
}

function show(name) {
  document.querySelectorAll('nav button').forEach((b) => {
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
  const h1 = document.querySelector(`#${name} h1`);
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
const mod = isMac ? '⌘' : 'Ctrl+';
document.querySelectorAll('nav button').forEach((b, i) => {
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
  if (e.key === 'Escape' && e.target.matches?.('input[type=search]') && e.target.value) {
    e.target.value = '';
    e.target.dispatchEvent(new Event('input'));
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
let catalog = null;
let statusById = {}; // the latest status, best effort: empty while the runtime is down
const selected = new Set();
const settings = {}; // form values, sent with every plan and install
const appName = (id) => (catalog.apps.find((a) => a.id === id) || { name: id }).name;

async function loadCatalog() {
  try {
    catalog = await go().Catalog();
  } catch (e) {
    $('groups').replaceChildren(h('p', { class: 'bad' }, String(e)));
    return;
  }
  await loadAppStates();
  fillCategories();
  const toggle = (p) => () => {
    const on = p.apps.every((id) => selected.has(id));
    p.apps.forEach((id) => (on ? selected.delete(id) : selected.add(id)));
    renderApps(); replan();
  };
  // Bundles only: a stack's own preset is the same as ticking its app.
  $('presets').replaceChildren(...catalog.presets.filter((p) => !p.starter && !p.id.startsWith('stack:')).map((p) => {
    const chip = h('button', { class: 'chip', title: p.description || '', onclick: toggle(p) }, p.name);
    chip.apps = p.apps;
    return chip;
  }));
  const starterLooks = { photos: ['photos', '#ff9500'], passwords: ['lock', '#34c759'], movies: ['film', '#ff3b30'], music: ['music', '#ff2d55'], files: ['folder', '#007aff'] };
  // The starter picks come first; the full list waits behind Add more.
  const starters = catalog.presets.filter((p) => p.starter);
  $('starterBox').hidden = !starters.length;
  if (!starters.length) $('more').open = true;
  $('starters').replaceChildren(...starters.map((p) => {
    const running = p.apps.every((id) => statusById[id]?.state === 'running');
    // A tinted symbol for each starter, as an app's icon in System Settings.
    const [glyph, tint] = starterLooks[p.id] || [];
    const card = h('button', { class: 'starter', onclick: toggle(p) },
      glyph ? h('span', { class: 'glyph', style: `--tint:${tint}` }, icon(glyph)) : null,
      h('strong', {}, p.name),
      h('span', { class: 'desc' }, p.description || ''),
      running ? h('span', { class: 'state' }, 'Running') : null);
    card.apps = p.apps;
    return card;
  }));
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

// The search box filters by name, what an app does, and what it replaces.
let query = '';
const matches = (a) => !query || [a.name, a.id, a.description, ...(a.replaces || []), ...(a.aliases || [])].join(' ').toLowerCase().includes(query);

function renderApps() {
  const byCategory = {};
  for (const a of catalog.apps) if (a.kind !== 'helper' && matches(a)) (byCategory[a.category] ??= []).push(a);
  if (query && !Object.keys(byCategory).length) {
    $('groups').replaceChildren(h('p', { class: 'muted empty' }, `No app matches “${query}”. Add your own below.`));
    markPresets();
    return;
  }
  $('groups').replaceChildren(...catalog.categories.filter((c) => byCategory[c.id]).map((c) => {
    const running = byCategory[c.id].filter((a) => statusById[a.id]?.state === 'running').length;
    return h('div', { class: 'group' }, h('h2', {}, c.label, h('span', { class: 'n' }, `${running} of ${byCategory[c.id].length} running`)), byCategory[c.id].map(appRow));
  }));
  markPresets();
}

// A preset chip is lit while all of its apps are ticked.
function markPresets() {
  for (const chip of [...$('presets').children, ...$('starters').children]) chip.classList.toggle('on', !!chip.apps?.length && chip.apps.every((id) => selected.has(id)));
}

const stateBadge = { running: ['running', 'ok'], stopped: ['stopped', 'warn'], elsewhere: ['runs elsewhere', 'warn'] };

function appRow(a) {
  const native = a.kind === 'native';
  const st = statusById[a.id];
  const box = h('input', { type: 'checkbox', checked: selected.has(a.id), disabled: native,
    onchange: (e) => { e.target.checked ? selected.add(a.id) : selected.delete(a.id); markPresets(); replan(); } });
  const [stateText, stateCls] = (st && stateBadge[st.state]) || [];
  const target = st?.state === 'running' ? (st.address ? 'https://' + st.address : st.url) : '';
  // Links inside the label must not toggle the checkbox.
  const quiet = (fn) => (e) => { e.preventDefault(); e.stopPropagation(); fn(); };
  const links = [
    target ? h('a', { onclick: quiet(() => go().Open(target)) }, 'Open') : null,
    a.inputs?.length ? h('a', { onclick: quiet(() => showSettings(a.inputs)) }, 'Settings') : null,
  ].filter(Boolean);
  return h('label', { class: 'app' }, box, h('div', { class: 'grow' },
    h('strong', {}, a.name),
    native ? h('span', { class: 'badge' }, 'runs natively') : null,
    stateText ? h('span', { class: 'badge ' + stateCls }, stateText) : null,
    h('div', { class: 'desc' }, a.description),
    a.replaces?.length ? h('div', { class: 'replaces' }, 'Replaces ' + a.replaces.join(', ')) : null),
    links.length ? h('div', { class: 'links-inline' }, links) : null);
}

let planSeq = 0;
function replan() { clearTimeout(replan.timer); replan.timer = setTimeout(doPlan, 250); }
const filled = () => Object.fromEntries(Object.entries(settings).filter(([, v]) => v !== ''));

async function doPlan() {
  const seq = ++planSeq;
  const tokens = [...selected];
  if (!tokens.length) {
    $('plan').replaceChildren('Nothing selected yet. Pick something to start with, or tick an app.');
    $('installBtn').disabled = true;
    return;
  }
  let p;
  try {
    p = await go().Plan(tokens, filled());
  } catch (e) {
    if (seq === planSeq) { $('plan').replaceChildren(h('p', { class: 'bad' }, String(e))); $('installBtn').disabled = true; }
    return;
  }
  if (seq !== planSeq) return; // a newer selection is being planned
  renderPlan(p);
  renderInputs(p);
  const wireable = new Set(catalog.wireable || []);
  $('wireRow').hidden = ![...p.start, ...selected].some((id) => wireable.has(id));
  $('installBtn').disabled = !(p.ready && p.start.length);
}

const list = (title, items, cls = '') => items.length ? [h('h2', {}, title), h('ul', { class: cls }, items.map((i) => h('li', {}, i)))] : [];
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// The plan in a few lines: the apps that will start, what still needs a
// setting, and anything wrong. Helpers (databases, queues), apps already
// running, port moves, and settings written wait under Details.
function renderPlan(p) {
  const picked = p.start.filter((id) => !p.added[id]);
  const helpers = p.start.filter((id) => p.added[id]);
  const running = p.skips.filter((s) => /^already running/.test(s.reason));
  const quiet = p.skips.filter((s) => /^only needed by/.test(s.reason));
  const needs = p.skips.filter((s) => !running.includes(s) && !quiet.includes(s));
  const lead = picked.length
    ? `Installs ${plural(picked.length, 'app', 'apps')}` + (helpers.length ? `, with ${plural(helpers.length, 'helper', 'helpers')} they need` : '') + '.'
    : '';
  const details = [
    ...list('Helpers that start with them', helpers.map((id) => `${appName(id)} (for ${appName(p.added[id])})`)),
    ...list('Port changes', p.portChanges.map((c) => `${c.var}: ${c.from} → ${c.to} (${c.reason})`)),
    ...list('Settings written', p.envChanges.map((c) => c.secret ? `${c.key} (hidden)` : `${c.key} = ${c.value}`)),
  ];
  $('plan').replaceChildren(
    lead ? h('p', { class: 'planLead' }, lead) : '',
    picked.length ? h('ul', { class: 'ok planApps' }, picked.map((id) => h('li', {}, appName(id)))) : '',
    ...list('Waiting for a setting', needs.map((s) => h('span', {}, h('strong', {}, appName(s.app)), ': ', friendlyReason(s.reason))), 'warn'),
    ...list('Problems', p.problems, 'bad'),
    ...list('Worth knowing', p.warnings, 'warn'),
    running.length ? h('p', { class: 'muted small' }, `Already running: ${running.map((s) => appName(s.app)).join(', ')}.`) : '',
    details.length ? h('details', { class: 'planDetails' }, h('summary', { class: 'muted' }, 'Details'), ...details) : '',
  );
  // Install greys out when nothing would start; say why instead of leaving
  // a blank button.
  if (!p.start.length) {
    const why = needs.length
      ? 'Fill in the settings below to install the rest.'
      : 'Nothing left to install: everything you picked is already running.';
    $('plan').append(h('p', { id: 'nothingToInstall', class: 'muted' }, why));
  }
}

// "set TAILSCALE_AUTHKEY in .env first" reads as the setting's own name.
function friendlyReason(r) {
  return r.replace(/set ([A-Z0-9_]+(?:(?:, | and | or )[A-Z0-9_]+)*) in \.env first/g, (_, keys) =>
    'fill in ' + keys.split(/, | and | or /).map(settingLabel).join(' and ') + ' below');
}

// The form shows the settings the chosen apps need, by their names for
// people and with their help (where to find a key, what it is for). It is
// rebuilt only when that set changes, so typing keeps focus.
let inputKeys = '';
let settingHelp = null;
async function renderInputs(p) {
  const ids = new Set([...selected, ...p.start, ...p.skips.map((s) => s.app)]);
  const keys = [...new Set(catalog.apps.filter((a) => ids.has(a.id)).flatMap((a) => a.inputs || []))];
  if (keys.join() === inputKeys) return;
  inputKeys = keys.join();
  if (keys.length && !settingHelp) {
    try { settingHelp = Object.fromEntries((await go().Settings()).map((s) => [s.key, s])); } catch { settingHelp = {}; }
  }
  $('inputs').replaceChildren(...(keys.length ? [h('h2', {}, 'Settings they need')] : []), ...keys.map((k) => {
    const meta = settingHelp?.[k] || {};
    const secret = meta.secret ?? /KEY|TOKEN|PASS|SECRET/.test(k);
    return h('label', { class: 'field' }, h('span', { class: 'fieldName' }, settingLabel(k)),
      h('input', {
        type: secret ? 'password' : 'text', value: settings[k] || '', autocomplete: 'off', spellcheck: 'false',
        placeholder: meta.set ? 'set already · leave empty to keep it' : 'not set yet',
        oninput: (e) => { settings[k] = e.target.value; replan(); },
      }),
      meta.help ? h('span', { class: 'help' }, meta.help) : null);
  }));
}

$('installBtn').onclick = async () => {
  const btn = $('installBtn');
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
const dollars = (v) => '$' + Math.round(v).toLocaleString('en-US');

// One dot and a few words for an app's state and health.
// Start them: every stopped container app of a category, one after another.
function startStopped(g) {
  const stopped = g.apps.filter((a) => a.state === 'stopped' && !a.waitingFor && !batteryPaused.has(a.id) && catalog?.apps.find((c) => c.id === a.id)?.kind !== 'native');
  if (!stopped.length || document.documentElement.classList.contains('companion')) return null;
  return h('button', { class: 'small startall', title: 'Start ' + stopped.map((a) => a.name).join(', '), onclick: async (e) => {
    e.stopPropagation();
    e.target.disabled = true;
    for (const [i, a] of stopped.entries()) {
      e.target.textContent = `Starting ${i + 1} of ${stopped.length}…`;
      try { await go().AppAction(a.id, 'start'); } catch (err) { showError(err); break; }
    }
    loadStatus();
  } }, stopped.length === 1 ? 'Start it' : `Start the ${stopped.length} stopped`);
}

// The apps the battery saver paused, from the last Status.
let batteryPaused = new Set();
function stateOf(a) {
  if (a.state !== 'running' && batteryPaused.has(a.id)) return ['warn', 'Paused on battery'];
  if (a.state === 'stopped' && a.waitingFor) return ['warn', `Waiting for the ${a.waitingFor.replace(/^\/Volumes\//, '')} drive`];
  if (a.state === 'running') {
    if (a.health === 'unhealthy') return ['bad', 'Unhealthy'];
    if (a.health === 'restarting') return ['bad', 'Restarting'];
    if (a.health === 'starting') return ['warn', 'Starting'];
    return ['ok', a.health === 'native' ? 'Running (native app)' : 'Running'];
  }
  return { stopped: ['warn', 'Stopped'], missing: ['bad', 'Not running'], elsewhere: ['warn', 'Runs elsewhere'], 'not running': ['warn', 'Not running'] }[a.state] || ['', a.state];
}

// How long a running app has been up, and a warning when its restart
// policy has had to restart it (a crash loop shows here first).
// Each app's share of the watchdog's passing checks this week (0 to 1).
let weekUp = {};
function uptime(a) {
  if (a.state !== 'running' || !a.since) return null;
  const week = weekUp[a.id];
  const mins = Math.max(0, Math.round((Date.now() - new Date(a.since)) / 60000)), hours = Math.round(mins / 60);
  const up = mins < 60 ? (mins <= 1 ? 'up a minute' : `up ${mins} minutes`) : hours < 48 ? (hours === 1 ? 'up an hour' : `up ${hours} hours`) : `up ${Math.round(hours / 24)} days`;
  return [h('span', { class: 'local' }, up),
    a.restarts ? h('span', { class: 'badge warn', title: 'Docker restarted it after it stopped on its own; its log says why' }, `restarted ${a.restarts}×`) : null,
    a.held ? h('span', { class: 'badge', title: `Left out of nightly updates after a rollback; homelab updates release ${a.id} puts it back` }, 'updates held') : null,
    week !== undefined && week < 0.99 ? h('span', { class: 'badge warn', title: 'The share of the watchdog\u2019s checks (every 15 minutes) it passed in the last 7 days' }, `${Math.floor(week * 1000) / 10}% up this week`) : null];
}

function tile(label, value, sub, tone) {
  return h('div', { class: 'card tile' + (tone ? ' ' + tone : '') }, h('div', { class: 'label' }, label), h('div', { class: 'value' }, value), h('div', { class: 'sub' }, sub));
}

// The savings trend: a sparkline of the last 90 recorded days and the
// change since the first of them (the nightly backup records one a day).
let savingsHistory = [];
async function loadSavingsHistory() {
  try { savingsHistory = (await go().SavingsHistory()) || []; } catch { savingsHistory = []; }
}
function savingsTrend() {
  const pts = savingsHistory.slice(-90);
  if (pts.length < 2) return 'in subscriptions';
  const first = pts[0], last = pts[pts.length - 1];
  const vals = pts.map((p) => p.annual), lo = Math.min(...vals), hi = Math.max(...vals);
  const w = 96, hgt = 24, span = hi - lo || 1;
  const points = vals.map((v, i) => `${((i / (vals.length - 1)) * w).toFixed(1)},${(hgt - 2 - ((v - lo) / span) * (hgt - 4)).toFixed(1)}`).join(' ');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'spark');
  svg.setAttribute('viewBox', `0 0 ${w} ${hgt}`);
  svg.innerHTML = `<polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`; // numbers only
  const delta = last.annual - first.annual;
  const since = new Date(first.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return [svg, h('span', { class: 'trend' }, delta === 0 ? `same since ${since}` : `${delta > 0 ? '+' : '−'}${dollars(Math.abs(delta))} since ${since}`)];
}

function renderTiles(st) {
  const running = st.apps.filter((a) => a.state === 'running');
  const trouble = st.apps.filter((a) => a.health === 'unhealthy' || a.health === 'restarting' || a.state === 'missing' || a.state === 'stopped');
  const u = st.updates || {};
  $('tiles').replaceChildren(
    tile('Running', [String(running.length), h('small', {}, ` of ${st.apps.length}`)], st.missing ? h('span', { class: 'bad' }, `${st.missing} baseline app(s) down`) : 'All baseline apps are up'),
    tile('Needs a look', String(trouble.length), trouble.length ? trouble.slice(0, 3).map((a) => a.name).join(', ') + (trouble.length > 3 ? '…' : '') : 'Nothing unhealthy or stopped', trouble.length ? 'warn' : ''),
    tile('Replaces a year', st.savings > 0 ? dollars(st.savings) : '$0', savingsTrend()),
    tile('Nightly updates', u.paused ? 'Paused' : 'On', [u.paused ? 'Until you resume them' : `Run ${u.schedule}`, h('button', { class: 'small change', onclick: async (e) => {
      e.target.disabled = true;
      try { await go().SetUpdatesPaused(!u.paused); } catch (err) { showError(err); }
      loadStatus();
    } }, u.paused ? 'Resume' : 'Pause')]));
  const n = trouble.length;
  $('statusCount').textContent = n ? String(n) : '';
  // Fix it for what it can repair: baseline apps down, or unwell ones
  // (a stopped optional app was stopped on purpose).
  $('fixIt').hidden = !(st.missing || st.apps.some((a) => a.health === 'unhealthy' || a.health === 'restarting'));
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
    const groups = [{ label: 'Needs a look', apps: st.apps.filter(trouble), alert: true },
      ...(catalog?.categories || []).map((c) => ({ label: c.label, apps: st.apps.filter((a) => !trouble(a) && catOf[a.id] === c.id) })),
      { label: 'Other', apps: st.apps.filter((a) => !trouble(a) && !(catalog?.categories || []).some((c) => c.id === catOf[a.id])) }].filter((g) => g.apps.length);
    const row = (a) => {
      const [cls, words] = stateOf(a);
      return h('tr', {},
        h('td', {}, h('strong', {}, a.name)),
        h('td', { class: 'state' }, h('span', { class: 'dot ' + cls }), words, a.state === 'elsewhere'
          ? [h('span', { class: 'local' }, 'container ' + a.container), h('button', { class: 'small', onclick: () => cliFlow(`Move ${a.name} into the homelab`, 'adopt', a.id, 'Move it') }, 'Move in')]
          : uptime(a)),
        // One address: the app's own name when it has one (its address on
        // this machine is in the tooltip), else the local one.
        h('td', { title: a.address && a.url ? 'On this machine: ' + a.url : '' }, a.address ? link('https://' + a.address, a.address) : (a.url ? link(a.url, a.url.replace(/^http:\/\//, '')) : h('span', { class: 'muted' }, '—'))),
        h('td', { class: 'rowActions' }, appActions(a)));
    };
    // Every category folds into its heading. Until the user picks, one
    // where everything runs is folded, and what needs a look stays open.
    const fine = (g) => !g.alert && g.apps.every((a) => a.state === 'running');
    const isOpen = (g) => statusOpenAll || (g.label in statusFold ? statusFold[g.label] : !fine(g));
    lastStatusOpen = Object.fromEntries(groups.map((g) => [g.label, isOpen(g)]));
    $('statusRows').replaceChildren(...groups.flatMap((g) => {
      const open = isOpen(g);
      const running = g.apps.filter((a) => a.state === 'running').length;
      const head = h('tr', { class: 'grouphead fold' + (g.alert ? ' bad' : ''), 'aria-expanded': String(open), tabindex: 0,
        onclick: () => toggleStatusGroup(g.label), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleStatusGroup(g.label); } } },
      h('th', { colspan: 4 }, h('span', { class: 'chev' }, open ? '▾' : '▸'), g.label,
        h('span', { class: 'n' }, g.alert ? String(g.apps.length) : running === g.apps.length ? `${running} running ✓` : `${running} of ${g.apps.length} running`),
        startStopped(g),
        !open ? h('span', { class: 'names' }, g.apps.map((a) => a.name).join(' · ')) : null));
      return [head, ...(open ? g.apps.map(row) : [])];
    }));
    $('statusAll').textContent = statusOpenAll ? 'Fold them again' : 'Show every app';
    const waiting = [...new Set(st.apps.filter((a) => a.state === 'stopped' && a.waitingFor).map((a) => a.waitingFor.replace(/^\/Volumes\//, '')))];
    $('statusNote').textContent = [waiting.length ? `Plug in ${waiting.join(' and ')}: the apps waiting for ${waiting.length === 1 ? 'it' : 'them'} start within 15 minutes of ${waiting.length === 1 ? 'it' : 'them'} appearing.` : '',
      batteryPaused.size ? `On battery: ${batteryPaused.size} app${batteryPaused.size === 1 ? '' : 's'} paused until this computer is plugged in (Settings › Battery saver).` : '',
      st.unmatched ? `${st.unmatched} other container(s) on this machine are not catalog apps.` : ''].filter(Boolean).join(' ');
  } catch (e) {
    // Most often the container runtime is not running: say so plainly.
    $('statusRows').replaceChildren();
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
  let w;
  try { w = await go().Watchdog(); } catch { card.hidden = true; return; }
  weekUp = w.week || {};
  card.hidden = false;
  const title = h('h2', {}, 'Watchdog');
  if (never(w.lastRun)) {
    card.replaceChildren(h('div', { class: 'row' }, title,
      h('span', { class: 'muted' }, 'It checks every app, address, and backup every 15 minutes once the jobs are installed. ', h('a', { onclick: () => { navigated = true; show('setup'); } }, 'Open Setup'))));
    return;
  }
  const failing = w.failing || [];
  const late = Date.now() - new Date(w.lastRun) > 45 * 60000;
  card.replaceChildren(
    h('div', { class: 'row' }, title, h('span', {},
      failing.length ? h('span', { class: 'bad' }, `${failing.length} of ${w.checks} checks failing`) : h('span', { class: 'ok' }, `✓ All ${w.checks} checks passed`),
      h('span', { class: 'muted' }, `${w.pending && !failing.length ? `, ${w.pending} checked again next run` : ''} · ${ago(w.lastRun)}`))),
    late ? h('div', { class: 'muted more' }, `It has not run since ${ago(w.lastRun)}. Setup › Install the jobs schedules it every 15 minutes.`) : '',
    failing.length ? h('div', { class: 'row more' }, h('span', { class: 'muted' }, 'Fix it restarts what is down or unwell and reconnects what dropped; it shows the plan first.'),
      h('button', { id: 'watchFix', class: 'small', onclick: () => cliFlow('Fix it', 'fix', '', 'Fix these') }, 'Fix it')) : '',
    failing.length ? h('ul', { class: 'alertlist' }, failing.map((f) => h('li', {},
      h('span', { class: 'dot bad' }),
      h('div', { class: 'grow' }, h('strong', {}, f.name), f.problem ? h('div', { class: 'muted' }, f.problem) : null),
      h('span', { class: 'when muted', title: 'Failing since' }, ago(f.since))))) : '');
}

// Protection: whether the proxy enforces CrowdSec's bans, and the attacks
// CrowdSec caught this week. Read once a minute (each read runs cscli in
// its container); hidden until CrowdSec and the proxy run.
let protectionAt = 0;
async function loadProtection() {
  protectionAt = Date.now();
  const card = $('protectCard');
  let p;
  try { p = await go().Protection(); } catch { card.hidden = true; return; }
  card.hidden = false;
  const recent = p.recent || [];
  const week = p.week === 1 ? '1 attack caught this week' : `${p.week} caught this week`;
  card.replaceChildren(
    h('div', { class: 'row' }, h('h2', {}, 'Protection'), h('span', {},
      p.enforced ? h('span', { class: 'ok' }, '✓ Bans enforced') : h('span', { class: 'bad' }, 'Bans not enforced'),
      h('span', { class: 'muted' }, ` · ${p.week ? week : 'nothing caught this week'}${p.bannedNow ? ` · ${p.bannedNow} banned now` : ''}`))),
    p.enforced ? '' : h('div', { class: 'row more' },
      h('span', { class: 'muted', title: p.bouncer }, 'The proxy is not getting CrowdSec\'s ban list, so new attackers are not blocked.'),
      h('button', { id: 'protectFix', class: 'small', title: 'Reconnects the proxy to CrowdSec (both restart for a moment); shows the plan first', onclick: () => cliFlow('Fix it', 'fix', '', 'Fix these') }, 'Fix')),
    recent.length ? h('ul', { class: 'alertlist' }, recent.slice(0, 3).map((a) => h('li', {},
      h('span', { class: 'dot ' + (a.banned ? 'bad' : '') }),
      h('div', { class: 'grow' }, h('strong', {}, a.scenario),
        h('div', { class: 'muted' }, [a.ip, a.country, a.network].filter(Boolean).join(' · '))),
      a.banned ? h('span', { class: 'badge' }, 'Banned') : null,
      h('span', { class: 'when muted' }, ago(a.when))))) : '');
}

// Photos per person: what each person keeps in Immich, as the nightly
// backup last read it, largest first, with a bar against the largest.
function bytesText(n) {
  const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
  return `${i ? n.toFixed(n < 10 ? 1 : 0) : n} ${units[i]}`;
}
async function loadStorage() {
  const card = $('storageCard');
  let rec;
  try { rec = await go().Storage(); } catch { rec = null; }
  const people = (rec?.photos || []).filter((p) => p.bytes > 0);
  const folders = (rec?.apps || []).filter((f) => f.bytes > 0);
  card.hidden = !people.length && !folders.length;
  if (card.hidden) return;
  const nameOf = (id) => catalog?.apps.find((a) => a.id === id)?.name || id;
  const bars = (rows) => {
    const most = rows[0].bytes;
    return h('ul', { class: 'alertlist usage' }, rows.map((r) => h('li', {},
      h('div', { class: 'grow' }, h('strong', {}, r.label), h('div', { class: 'bar' }, h('span', { style: `width:${Math.max(2, Math.round((r.bytes / most) * 100))}%` }))),
      h('span', { class: 'when' }, bytesText(r.bytes)))));
  };
  const total = (rows) => rows.reduce((t, r) => t + r.bytes, 0);
  card.replaceChildren(
    ...(people.length ? [h('div', { class: 'row' }, h('h2', {}, 'Photos per person'), h('span', { class: 'muted' }, `${bytesText(total(people))} in Immich · ${ago(rec.when)}`)),
      bars(people.map((p) => ({ label: p.name, bytes: p.bytes })))] : []),
    ...(folders.length ? [h('div', { class: 'row' }, h('h2', {}, 'What the apps keep'), h('span', { class: 'muted', title: 'Each app\u2019s folder in data/appdata, measured by the nightly backup; photos and media on their own drive are not counted' }, `${bytesText(total(folders))} of app data · ${ago(rec.when)}`)),
      bars(folders.slice(0, 6).map((f) => ({ label: nameOf(f.app), bytes: f.bytes })))] : []));
}

// What's using power: each running app's CPU right now (docker stats),
// read at most once a minute since docker measures over a second or two.
let usageAt = 0;
async function loadUsage() {
  if (Date.now() - usageAt < 60000) return;
  usageAt = Date.now();
  const card = $('usageCard');
  let stats;
  try { stats = await go().Usage(); } catch { stats = []; }
  const busy = stats.filter((s) => s.cpu >= 1);
  card.hidden = !busy.length;
  if (card.hidden) return;
  const nameOf = (id) => catalog?.apps.find((a) => a.id === id)?.name || id;
  const total = stats.reduce((t, s) => t + s.cpu, 0);
  const most = Math.max(busy[0].cpu, 100);
  const heavy = busy.filter((s) => s.cpu >= 50);
  card.replaceChildren(
    h('div', { class: 'row' }, h('h2', {}, 'What\u2019s using power'), h('span', { class: 'muted', title: 'Percent of one processor core, measured just now; 100% is one core kept busy' }, `${Math.round(total)}% of a core in all \u00b7 just now`)),
    h('ul', { class: 'alertlist usage' }, busy.slice(0, 6).map((s) => h('li', {},
      h('div', { class: 'grow' }, h('strong', {}, nameOf(s.name)), h('div', { class: 'bar' }, h('span', { style: `width:${Math.max(2, Math.round((s.cpu / most) * 100))}%` }))),
      h('span', { class: 'when' }, `${Math.round(s.cpu)}%${s.mem ? ' \u00b7 ' + s.mem : ''}`)))),
    h('p', { class: 'muted' }, heavy.length
      ? `${heavy.map((s) => nameOf(s.name)).join(' and ')} ${heavy.length === 1 ? 'is' : 'are'} busy. Some apps work hard for a while after you add files (Immich reads new photos); if it lasts, stop what you don\u2019t use. On battery, the battery saver pauses the heaviest apps.`
      : 'Nothing is working hard. On battery, the battery saver pauses the heaviest apps.'));
}

// This week: the Sunday summary (homelab digest), read at most every 10
// minutes since it asks several apps.
let weekAt = 0;
async function loadWeek() {
  if (Date.now() - weekAt < 600000) return;
  weekAt = Date.now();
  const card = $('weekCard');
  let w;
  try { w = await go().Weekly(); } catch { card.hidden = true; return; }
  const lines = w.body.split('\n').filter(Boolean);
  card.hidden = !lines.length;
  card.replaceChildren(
    h('div', { class: 'row' }, h('h2', {}, 'This week'), h('span', { class: w.problems ? 'warn' : 'ok' }, w.problems ? `${w.problems} thing${w.problems === 1 ? '' : 's'} to look at` : '\u2713 All well')),
    h('ul', { class: 'alertlist week' }, lines.map((l) => {
      const ok = l.startsWith('\u2713');
      return h('li', {}, h('span', { class: 'dot ' + (ok ? 'ok' : 'warn') }), h('div', { class: 'grow' }, l.replace(/^[\u2713\u2022]\s*/, '')));
    })),
    h('p', { class: 'muted' }, 'The same summary reaches your phone on Sundays once alerts are set up.'));
}

// Recent alerts: what Watchtower, Duplicati, Uptime Kuma, and the watchdog
// sent to ntfy in the last 12 hours, read with notify setup's read token.
const topicName = { watchtower: 'Updates', 'duplicati-alerts': 'Backups', 'uptime-kuma': 'Uptime Kuma', 'tunnel-watchdog': 'Watchdog' };
async function loadAlerts() {
  const card = $('alertsCard');
  let events;
  try {
    events = await go().Alerts();
  } catch (e) {
    const msg = String((e && e.message) || e);
    card.hidden = false;
    card.replaceChildren(h('div', { class: 'row' }, h('h2', {}, 'Recent alerts'),
      /NTFY_READ_TOKEN/.test(msg)
        ? h('span', { class: 'muted' }, 'They appear here once the alert token is set up. ', h('a', { onclick: () => { navigated = true; show('setup'); } }, 'Open Setup'))
        : h('span', { class: 'muted' }, msg)));
    return;
  }
  card.hidden = false;
  if (!events?.length) {
    card.replaceChildren(h('div', { class: 'row' }, h('h2', {}, 'Recent alerts'), h('span', { class: 'ok' }, '✓ None in the last 12 hours')));
    return;
  }
  const shown = events.slice(0, 5);
  card.replaceChildren(
    h('div', { class: 'row' }, h('h2', {}, 'Recent alerts'), h('span', { class: 'muted' }, `${events.length} in the last 12 hours`)),
    h('ul', { class: 'alertlist' }, shown.map((e) => h('li', {},
      h('span', { class: 'dot ' + (e.priority >= 4 ? 'bad' : (e.tags || []).includes('white_check_mark') || /^recovered/i.test(e.title || '') ? 'ok' : '') }),
      h('div', { class: 'grow' }, h('strong', {}, e.title || e.message), e.title && e.message ? h('div', { class: 'muted' }, e.message) : null),
      h('span', { class: 'badge' }, topicName[e.topic] || e.topic),
      h('span', { class: 'when muted' }, ago(e.time))))),
    events.length > shown.length ? h('div', { class: 'muted more' }, `and ${events.length - shown.length} more in the ntfy app`) : '');
}

// Each app's own buttons: start or stop, restart, update, and its log.
// Apps that run natively or elsewhere are managed outside the homelab.
function appActions(a) {
  const entry = catalog?.apps.find((c) => c.id === a.id), kind = entry?.kind;
  if (kind === 'native') {
    // A Mac app the homelab cannot start itself: open it.
    return entry?.macApp && a.state !== 'running' && isMac
      ? [h('button', { class: 'small', title: `Open ${a.name}; it then keeps running in the menu bar`, onclick: (e) => { e.target.disabled = true; go().OpenNativeApp(a.id).then(() => setTimeout(loadStatus, 3000), showError); } }, 'Open')]
      : [];
  }
  if (a.state === 'elsewhere') return [];
  if (a.state === 'missing') return [h('button', { class: 'small', onclick: () => { selected.add(a.id); navigated = true; show('choose'); renderApps(); replan(); } }, 'Install')];
  const btn = (action, title, extra = '') => h('button', { class: 'iconbtn ' + extra, title, 'aria-label': title, onclick: () => runAppAction(a, action) }, icon(action));
  const logs = h('button', { class: 'iconbtn', title: 'Logs', 'aria-label': 'Logs', onclick: () => showLogs(a) }, icon('logs'));
  const back = a.updatedAt ? btn('rollback', `Roll back: the version it ran before its update ${ago(a.updatedAt)}, and hold its updates`) : null;
  const onPhone = a.address && a.state === 'running'
    ? h('button', { class: 'iconbtn', title: 'Open on a phone', 'aria-label': 'Open on a phone', onclick: () => showQR(a) }, icon('phone')) : null;
  const signIn = entry?.login?.length && a.state === 'running'
    ? h('button', { class: 'iconbtn', title: 'Sign-in details', 'aria-label': 'Sign-in details', onclick: () => showSignIn(a, entry.login) }, icon('key')) : null;
  return a.state === 'running'
    ? [onPhone, signIn, btn('restart', 'Restart'), btn('update', 'Update: dump its database, pull the newest image, and recreate it'), back, btn('stop', 'Stop (data is kept)', 'danger'), logs]
    : [btn('start', 'Start'), back, logs];
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
    const s = byKey[k] || {};
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
  actions.replaceChildren();
  document.querySelectorAll('.rowActions button').forEach((b) => (b.disabled = true));
  panel.scrollIntoView({ block: 'nearest' });
  const off = window.runtime.EventsOn('cli:log', (line) => { log.textContent += line + '\n'; log.scrollTop = log.scrollHeight; });
  let failed = false;
  try { await go().AppAction(a.id, action); } catch (e) { failed = true; showError(e); }
  if (typeof off === 'function') off();
  $('cliTitle').textContent = failed ? `${actionTitle[action]} ${a.name} failed` : `${a.name}: ${action} done`;
  actions.replaceChildren(h('button', { class: 'small', onclick: () => (panel.hidden = true) }, 'Close'));
  loadStatus();
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

// A homelab command with a preview: show its plan, then run it on confirm.
let cliStop = null; // the open flow's log listener
async function cliFlow(title, action, target, confirmLabel) {
  const panel = $('cliPanel'), log = $('cliLog'), actions = $('cliActions');
  log.hidden = false;
  if (cliStop) cliStop();
  panel.hidden = false;
  $('cliTitle').textContent = title;
  log.textContent = '';
  actions.replaceChildren();
  const off = window.runtime.EventsOn('cli:log', (line) => { log.textContent += line + '\n'; log.scrollTop = log.scrollHeight; });
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
      try { await go().Homelab(action, target, true); } catch (err) { showError(err); }
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
document.addEventListener('click', (e) => { if (!$('statusMenu').hidden && !e.target.closest('.menuwrap')) closeMenu(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('statusMenu').hidden) closeMenu(); });
setInterval(() => { if ($('status').classList.contains('active')) loadStatus(); }, 10000);

// Backups: the newest copy of each database and volume, the destination,
// and the last restore test, read from the files the nightly job leaves.
const never = (t) => !t || t.startsWith('0001-');
// "in 6 hours", "tomorrow", "in 3 days" for a time ahead.
function untilText(t) {
  const mins = Math.round((new Date(t) - Date.now()) / 60000);
  if (mins <= 1) return 'now';
  if (mins < 60) return `in ${mins} minutes`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? 'in an hour' : `in ${hours} hours`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'tomorrow' : `in ${days} days`;
}

// "45 seconds", "3 minutes".
const tookText = (s) => (s < 120 ? `${s} seconds` : `${Math.round(s / 60)} minutes`);

// The restore test tile: when one last passed and how long it took, a
// failure since, and the drills on record when hovered.
function restoreTile(t, due) {
  const runs = t.history || [];
  const newest = runs[runs.length - 1];
  const timed = runs.slice().reverse().find((r) => r.passed && r.seconds > 0);
  let sub;
  if (newest && !newest.passed) sub = h('span', { class: 'bad' }, `Failed ${ago(newest.when)}: ${newest.summary}`);
  else if (due) sub = h('span', { class: 'warn' }, 'Due: Test a restore');
  else sub = (t.lastSummary || 'Proven in the last 30 days') + (timed ? ` · in ${tookText(timed.seconds)}` : '');
  const record = runs.slice(-6).reverse().map((r) => `${new Date(r.when).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}: ${r.passed ? 'passed' : 'failed'}${r.seconds ? ' in ' + tookText(r.seconds) : ''}`);
  const el = tile('Restore test', never(t.lastTest) ? 'Never' : ago(t.lastTest), sub);
  el.id = 'restoreTile';
  if (record.length) el.title = `Restore drills on record (${runs.length}):\n` + record.join('\n');
  return el;
}

function ago(t) {
  if (never(t)) return 'never';
  const mins = Math.max(0, Math.round((Date.now() - new Date(t)) / 60000));
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  if (hours < 36) return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}
function bytes(n) {
  if (!n) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n < 10 && i ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}

async function loadBackups() {
  let o;
  try { o = await go().Backups(); } catch (e) { $('backupRows').replaceChildren(); showError(e); return; }
  const order = { stale: 0, none: 1, fresh: 2 };
  const copies = (o.copies || []).slice().sort((a, b) => order[a.state] - order[b.state]);
  const shortPath = (p) => { const parts = p.split('/').filter(Boolean); return parts.length > 2 ? '…/' + parts.slice(-2).join('/') : p; };
  const fresh = copies.filter((c) => c.state === 'fresh').length;
  const stale = copies.filter((c) => c.state === 'stale');
  const t = o.restoreTest || {};
  $('backupTiles').replaceChildren(
    tile('Last backup', never(o.lastRun) ? 'Never' : ago(o.lastRun), never(o.envCopied) ? 'Settings file not copied yet' : `Settings file copied ${ago(o.envCopied)}`),
    tile('Fresh copies', [String(fresh), h('small', {}, ` of ${copies.length}`)], stale.length ? h('span', { class: 'bad' }, 'Stale: ' + stale.map((c) => c.name).join(', ')) : `Each under ${o.staleAfterHours} hours old`),
    tile('Destination', o.destinationOK ? 'Set' : h('span', { class: 'warn' }, 'Not set'), o.destinationOK ? h('span', { title: o.destination }, shortPath(o.destination)) : 'Put a Proton Drive folder in Settings › BACKUP_DESTINATION'),
    restoreTile(t, o.restoreDue));
  const mark = { fresh: ['ok', 'Fresh'], stale: ['bad', 'Stale'], none: ['', 'None yet'] };
  $('backupRows').replaceChildren(...copies.map((c) => {
    const [cls, word] = mark[c.state] || ['', c.state];
    return h('tr', {},
      h('td', {}, h('strong', {}, c.name), h('span', { class: 'local' }, c.volume ? 'volume archive' : 'database')),
      h('td', { class: 'state' }, h('span', { class: 'dot ' + cls }), c.state === 'none' ? word : `${word} · ${ago(c.newest)}`),
      h('td', {}, bytes(c.size)),
      h('td', {}, c.count ? String(c.count) : '—'));
  }));
  if (!copies.length) $('backupRows').append(h('tr', {}, h('td', { colspan: 4, class: 'muted' }, 'No installed app has a database to dump yet.')));
  const plain = o.plainExports || [];
  $('vaultCard').replaceChildren(
    h('div', { class: 'row' }, h('h2', {}, 'Password vault export'),
      plain.length ? h('span', { class: 'bad' }, '✗ Delete the plain export') : never(o.vaultExport) ? h('span', { class: 'warn' }, 'Never exported') : o.vaultDue ? h('span', { class: 'warn' }, `Due: last ${ago(o.vaultExport)}`) : h('span', { class: 'ok' }, `✓ Exported ${ago(o.vaultExport)}`)),
    plain.length ? h('p', { class: 'bad' }, `${plain.join(', ')} in recovery-staging/secrets holds every password readable. Delete it, then export again encrypted.`) : '',
    h('p', {}, 'The database backup needs the server to open. Once a month, also keep an export you can open anywhere: in the Bitwarden web vault, Tools › Export vault › .json (Encrypted) › Password protected, with that password kept outside the vault. Save it in ', h('code', {}, 'recovery-staging/secrets'), ' and the nightly Secrets job takes it off-site. The backup reminds you when one is due.'));
  $('backupsCount').textContent = stale.length + plain.length ? String(stale.length + plain.length) : '';
  loadDuplicatiJobs();
  const dup = statusById.duplicati;
  $('openDuplicati').hidden = !(dup?.state === 'running' && dup.url);
  $('openDuplicati').onclick = () => go().Open(dup.url);
}

// The encrypted off-site jobs: each Duplicati job's last run.
async function loadDuplicatiJobs() {
  const card = $('dupCard');
  let jobs;
  $('restoreTest').hidden = true;
  try {
    jobs = await go().DuplicatiJobs();
  } catch (e) {
    const msg = String((e && e.message) || e);
    card.replaceChildren(h('div', { class: 'row' }, h('h2', {}, 'Off-site jobs (Duplicati)'),
      h('span', { class: 'muted' }, /DUPLICATI_PASSWORD is empty/.test(msg) ? 'Shown here once DUPLICATI_PASSWORD is in Settings.' : msg)));
    return;
  }
  if (!jobs?.length) {
    card.replaceChildren(
      h('div', { class: 'row' }, h('h2', {}, 'Off-site jobs (Duplicati)'),
        h('button', { class: 'small', onclick: () => backupTask('duplicati-setup', 'Creating the backup jobs…', 'Backup jobs created', 'Creating the jobs stopped: the log says why') }, 'Create the backup jobs')),
      h('p', { class: 'muted' }, 'No jobs yet. This makes the jobs in docs/Automation.md, encrypted with passphrases kept in .env, and runs the small ones once. Then copy DUPLICATI_SECRETS_PASSPHRASE from Settings into Vaultwarden.'));
    return;
  }
  // The restore test needs the Homelab AppData job to have run once.
  $('restoreTest').hidden = !jobs.some((j) => j.name.toLowerCase() === 'homelab appdata' && j.state !== 'never');
  const mark = { ok: ['ok', 'Ran'], failed: ['bad', 'Failed'], stale: ['warn', 'Not run for over a week'], never: ['warn', 'Never run'] };
  const bad = jobs.filter((j) => j.state !== 'ok').length;
  card.replaceChildren(
    h('div', { class: 'row' }, h('h2', {}, 'Off-site jobs (Duplicati)'), bad ? h('span', { class: 'warn' }, `${bad} need a look`) : h('span', { class: 'ok' }, `✓ All ${jobs.length} ran`)),
    h('ul', { class: 'alertlist' }, jobs.map((j) => {
      const [cls, word] = mark[j.state] || ['', j.state];
      return h('li', {},
        h('span', { class: 'dot ' + cls }),
        h('div', { class: 'grow' }, h('strong', {}, j.name), j.errorMessage ? h('div', { class: 'bad' }, j.errorMessage) : j.state !== 'ok' ? h('div', { class: 'muted' }, word) : null),
        j.size ? h('span', { class: 'size muted' }, j.size) : '',
        h('span', { class: 'when muted', title: never(j.nextRun) ? '' : 'Next run ' + new Date(j.nextRun).toLocaleString() }, never(j.lastFinished) ? 'never' : ago(j.lastFinished),
          never(j.nextRun) ? '' : h('span', { class: 'next' }, ' · next ' + untilText(j.nextRun))));
    })));
}

// Runs a backup-screen command, streaming its output into the panel.
async function backupTask(action, busy, done, failed) {
  const panel = $('backupPanel'), log = $('backupLog'), btns = [$('backupNow'), $('restoreTest')];
  panel.hidden = false;
  $('backupTitle').textContent = busy;
  log.textContent = '';
  btns.forEach((b) => { b.disabled = true; });
  const off = window.runtime.EventsOn('cli:log', (line) => { log.textContent += line + '\n'; log.scrollTop = log.scrollHeight; });
  let ok = true;
  try { await go().Homelab(action, '', action === 'backup'); } catch (e) { ok = false; showError(e); }
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
  if (hostOS.startsWith('Windows')) return 'Release › the latest green run › Artifacts › windows, and run the installer';
  if (hostOS.startsWith('Linux')) return 'Release › the latest green run › Artifacts › linux: the package for this system, or the AppImage';
  return 'open the latest build, download Homelab-Wizard-macOS.dmg, quit this app, and drag the new one to Applications';
}

// What the homelab runs in the background, in plain words: the scheduled
// jobs (Login Items lists them under Homelab Wizard) and the menu bar icon.
function backgroundRow() {
  const box = h('div', { id: 'bgList', class: 'bglist', hidden: true });
  const summary = h('span', {}, 'the scheduled jobs ');
  const toggle = h('a', { id: 'bgToggle', class: 'small', onclick: async () => {
    if (!box.hidden) { box.hidden = true; toggle.textContent = 'What are these?'; return; }
    let jobs = [];
    try { jobs = await go().Background(); } catch (e) { return showError(e); }
    box.replaceChildren(h('ul', { class: 'alertlist' }, jobs.map((j) => h('li', {},
      h('span', { class: 'dot ' + (j.installed ? 'ok' : '') }),
      h('div', { class: 'grow' }, h('strong', {}, j.name), h('div', { class: 'muted' }, j.what)),
      h('span', { class: 'when muted', title: j.label }, j.installed ? j.when : 'not installed')))),
    h('p', { class: 'muted small' }, 'macOS lists these in System Settings › General › Login Items & Extensions, under Homelab Wizard. They only work on the homelab, and only use power while they run. Uninstalling (homelab uninstall) removes every one.'),
    ...(jobs.some((j) => j.installed && j.label !== 'tray') ? [h('button', { id: 'bgOff', class: 'small', title: 'The apps keep running, but nothing starts them after a restart, backs them up at night, or watches them. Setup offers to put the jobs back.', onclick: () => { show('status'); cliFlow('Turn off the scheduled jobs', 'jobs-remove', '', 'Turn them off'); } }, 'Turn the scheduled jobs off')] : []));
    box.hidden = false;
    toggle.textContent = 'Hide';
  } }, 'What are these?');
  return [summary, toggle, box];
}

async function loadHost() {
  const i = await go().Host();
  hostOS = i.os || '';
  document.documentElement.classList.toggle('backdrop', !!i.backdrop);
  const atLogin = await go().TrayAtLogin().catch(() => null);
  const menu = await go().MenuEntry().catch(() => null);
  const row = (k, v) => h('div', {}, h('dt', {}, k), h('dd', {}, v));
  $('hostInfo').replaceChildren(
    row('Machine', [i.supported ? i.os : `${i.os} (not supported)`, i.machine ? h('span', { class: 'muted' }, ' · ' + i.machine) : null]),
    row('Container runtime', i.runtimeOK ? [h('span', { class: 'dot ok' }), i.runtimeFound] : h('span', { class: 'bad' }, `${i.runtime} is not ready: ${i.runtimeHint}`)),
    row('Runs in the background', backgroundRow()),
    atLogin === null ? '' : row(i.os.startsWith('macOS') ? 'Menu bar item' : 'Tray icon', trayAtLoginRow(atLogin)),
    menu && menu.available ? row('App menu', menuEntryRow(menu.added)) : '',
    row('Homelab folder', [i.rootOK ? i.root : h('span', { class: 'bad' }, i.kit ? 'not set up yet' : 'not found'), ' ',
      h('a', { class: 'small', title: 'Choose the folder with compose.yaml', onclick: chooseRoot }, i.rootOK ? 'Change…' : 'Choose…')]),
    (i.disks || []).length ? h('div', { class: 'diskrow' }, h('dt', {}, 'Storage'), h('dd', {}, h('div', { id: 'diskSpace', class: 'disks' }, i.disks.map(diskBar)))) : '',
    h('div', {}, h('dt', {}, 'Version'), h('dd', { id: 'versionInfo' }, i.version, h('span', { id: 'upgradeState' }))));
  // Each part kept whole: a long Windows name wraps before the version, not inside it.
  $('foot').replaceChildren(h('span', { class: 'part' }, i.os), ' · ', h('span', { class: 'part' }, i.version));
  if (i.rootOK) loadUpgrade(false);
  renderNewHomelab(i);
  renderRuntime(i);
  return i;
}

// One disk as a storage bar, as in System Settings: the drive's name and
// what is free, the used part filled (red when low), and what lives on it.
function diskBar(d) {
  const used = d.total ? Math.min(100, Math.max(1, Math.round(100 * (1 - d.free / d.total)))) : 0;
  return h('div', { class: 'disk' + (d.low ? ' low' : ''), title: d.hint || '' },
    h('div', { class: 'dhead' }, h('strong', {}, d.name || 'Internal disk'), h('span', { class: d.low ? 'bad' : 'muted' }, d.space.replace(/\s*\(\d+%\)$/, ''))),
    d.total ? h('div', { class: 'storagebar', role: 'meter', 'aria-valuenow': used, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': `${used}% used` }, h('span', { style: `width:${used}%` })) : null,
    h('div', { class: 'muted small' }, d.label),
    d.low ? h('div', { class: 'muted small' }, d.hint) : null);
}

// The container runtime, walked through: download it, open it, and this
// screen notices on its own once it answers.
let runtimeWatch = null;
function renderRuntime(i) {
  const card = $('runtimeCard');
  card.hidden = !!i.runtimeOK;
  clearInterval(runtimeWatch);
  if (card.hidden) return;
  runtimeWatch = setInterval(async () => {
    const now = await go().Host().catch(() => null);
    if (now && now.runtimeOK) { clearInterval(runtimeWatch); await loadHost(); loadSetup(); }
  }, 5000);
  const steps = i.runtimeInstalled
    ? [h('p', {}, `${i.runtime} is installed but not running. Open it, accept what it asks the first time, and turn on starting at login in its settings.`),
      h('div', { class: 'actions' }, h('button', { id: 'startRuntime', class: 'primary', onclick: () => go().StartRuntime().catch(showError) }, `Open ${i.runtime}`),
        h('span', { class: 'muted' }, 'This screen moves on by itself once it is running.'))]
    : [h('ol', {}, h('li', {}, `Download ${i.runtime}, the engine every app runs in.`), h('li', {}, 'Open the downloaded file and drag it to Applications (or run the installer).'), h('li', {}, 'Open it once and accept what it asks.')),
      h('div', { class: 'actions' }, i.runtimeDownload ? h('button', { id: 'getRuntime', class: 'primary', onclick: () => go().Open(i.runtimeDownload) }, `Download ${i.runtime}`) : null,
        h('span', { class: 'muted' }, `Or in Terminal: ${i.runtimeHint}. This screen moves on by itself once it is running.`))];
  card.replaceChildren(h('h2', {}, i.runtimeInstalled ? `Start ${i.runtime}` : `Install ${i.runtime}`), ...steps);
}

// No homelab folder yet: a build that carries the homelab files makes one.
function renderNewHomelab(i) {
  const card = $('newHomelab');
  card.hidden = i.rootOK || !i.kit;
  if (card.hidden) return;
  const btn = h('button', { id: 'createHomelab', class: 'primary', onclick: async () => {
    btn.disabled = true;
    btn.textContent = 'Setting it up…';
    try { await go().CreateHomelab(); await loadHost(); await loadCatalog(); await loadSetup(); } catch (e) { showError(e); btn.disabled = false; btn.textContent = 'Set it up for me'; }
  } }, 'Set it up for me');
  card.replaceChildren(
    h('h2', {}, 'Start your homelab'),
    h('p', {}, `Homelab Wizard makes the folder everything lives in, at ${i.newRoot}, with the apps' settings and guides. Your photos, media, and backups can live elsewhere; Settings says where.`),
    h('div', { class: 'actions' }, btn, h('span', { class: 'muted' }, 'Already have one? ', h('a', { onclick: chooseRoot }, 'Choose it'))));
}

// Whether the menu bar item (the tray icon elsewhere) starts at login, and
// a button to change it.
function trayAtLoginRow(on) {
  return [on ? h('span', { class: 'ok' }, '✓ starts at login') : h('span', { class: 'muted' }, 'only while the app is open'), ' ',
    h('button', { class: 'small', id: 'trayAtLogin', onclick: async (e) => {
      e.target.disabled = true;
      try { await go().SetTrayAtLogin(!on); } catch (err) { showError(err); }
      loadHost();
    } }, on ? 'Turn off' : 'Start at login')];
}

// The AppImage in the system's app menu (SteamOS's desktop mode, where its
// menu item also offers Add to Steam), and a button to change it.
function menuEntryRow(added) {
  return [added ? h('span', { class: 'ok' }, '✓ in the app menu') : h('span', { class: 'muted' }, 'opened from its file'), ' ',
    h('button', { class: 'small', id: 'menuEntry', onclick: async (e) => {
      e.target.disabled = true;
      try { await go().SetMenuEntry(!added); } catch (err) { showError(err); }
      loadHost();
    } }, added ? 'Remove' : 'Add to the app menu')];
}

// Update the homelab: the changes waiting on GitHub, and a button that
// fast-forwards the folder and runs up.
async function loadUpgrade(force) {
  const card = $('upgradeCard');
  let c;
  try { c = await go().UpgradeCheck(force); } catch (e) {
    card.hidden = true;
    document.getElementById('upgradeState')?.replaceChildren(h('span', { class: 'muted', title: String((e && e.message) || e) }, ' · no update check'));
    return;
  }
  const n = c.behind, s = n === 1 ? '' : 's';
  footUpdate(n > 0 || !!c.appUpdate || c.appBehind > 0);
  // Replaced, not appended: loadHost and Check again can both get here.
  document.getElementById('upgradeState')?.replaceChildren(
    n ? h('span', { class: 'warn' }, ` · ${n} new change${s}`) : h('span', { class: 'ok' }, ' · ✓ up to date'),
    c.appCommit ? h('span', { class: 'muted', title: 'The commit this app was built from' }, ` · build ${c.appCommit.slice(0, 7)}`) : '',
    ...(c.previous ? [' · ', goBackLink(c.previous)] : []));
  // Stable: the published releases; testing: the latest Release run's builds.
  const releases = c.web ? c.web + (c.channel === 'stable' ? '/releases' : '/actions/workflows/release.yml') : '';
  const app = c.appUpdate;
  if (!n && app) {
    // The folder is current, and GitHub has a newer build of this app.
    card.hidden = false;
    card.replaceChildren(
      h('div', { class: 'row' }, h('h2', {}, app.version ? `Homelab Wizard ${app.version} is ready` : 'A newer Homelab Wizard is ready'),
        app.canInstall ? h('button', { id: 'appUpdateBtn', class: 'primary small', onclick: installApp }, 'Update now')
          : h('button', { class: 'primary small', onclick: () => go().Open(app.page) }, 'Download it')),
      h('p', { class: 'muted' }, app.canInstall
        ? 'Update now downloads it, puts it in place of this one, and opens it again. Your homelab keeps running.'
        : `Download it from the release page: ${newestBuildSteps()}.`));
    return;
  }
  if (!n && c.appBehind > 0) {
    // The folder is current, but this app was built before its latest changes.
    card.hidden = false;
    card.replaceChildren(
      h('div', { class: 'row' }, h('h2', {}, 'A newer Homelab Wizard is ready'),
        releases ? h('button', { class: 'primary small', onclick: () => go().Open(releases) }, 'Open the release builds') : ''),
      h('p', {}, `The homelab folder has ${c.appBehind} change${c.appBehind === 1 ? '' : 's'} to the app since this build. Download the newest: ${newestBuildSteps()} (Upgrading.md).`));
    return;
  }
  card.hidden = !n;
  if (!n) return;
  const notes = [];
  if (c.newVersion && c.newVersion !== c.version) notes.push(`Version ${c.version} → ${c.newVersion}.`);
  if (c.settingsChanged) notes.push('New settings are added to .env on the way.');
  if (app?.canInstall) notes.push('The app updates too, and opens again.');
  else if (c.selfUpdates && (c.appChanged || app)) notes.push('The app updates too, once its new build is out: the banner offers it.');
  else if (c.appChanged || app) notes.push(`The desktop app changed too: afterwards, ${newestBuildSteps()}.`);
  if (c.dirty?.length) notes.push(`Edited here, and kept: ${c.dirty.join(', ')}.`);
  if (c.ahead) notes.push(`This folder has ${c.ahead} commit(s) of its own, so it cannot simply move forward.`);
  if (c.fetchError) notes.push('GitHub could not be reached just now; this is from the last check.');
  const shown = (c.changes || []).slice(0, 6);
  card.replaceChildren(
    h('div', { class: 'row' }, h('h2', {}, `Update the homelab: ${n} new change${s}`),
      h('button', { id: 'upgradeBtn', class: 'primary small', onclick: () => runUpgrade(app), disabled: c.ahead > 0 }, 'Update')),
    h('ul', { class: 'alertlist' }, shown.map((ch) => h('li', {},
      h('span', { class: 'dot' }), h('div', { class: 'grow' }, ch.subject), h('span', { class: 'when muted' }, ago(ch.when))))),
    n > shown.length ? h('p', { class: 'muted' }, `and ${n - shown.length} more`) : '',
    notes.length ? h('p', {}, notes.join(' ')) : '',
    c.notes?.length ? h('details', { class: 'whatsnew' }, h('summary', {}, `What is new (${c.notes.length})`), h('ul', {}, c.notes.map((t) => h('li', {}, t)))) : '',
    h('p', { class: 'muted' }, `Update moves the homelab folder forward to ${c.channel === 'stable' && c.target ? c.target + ' (the stable channel)' : c.upstream}, never merging or overwriting your own edits, then starts the homelab again so changed apps are recreated. Upgrading.md says what each batch of changes asks of you.`));
}
// The sidebar says when an update is waiting, on every screen.
function footUpdate(on) {
  document.getElementById('footUpdate')?.remove();
  if (on) $('foot').append(h('a', { id: 'footUpdate', class: 'update', title: 'Open Setup to update', onclick: () => { navigated = true; show('setup'); } }, '● Update ready'));
}
// Checked again every hour (the check itself asks GitHub at most every 10 minutes).
setInterval(() => { if (document.getElementById('versionInfo')) loadUpgrade(false); }, 3600e3);

// A newer app build, found in the background (app:update): what changed,
// Restart to update, and installing on quit instead. Later hides it until
// a newer build than that one turns up.
let updateLater = '';
function updateBanner(u) {
  const box = $('updateBanner');
  if (!u || u.commit === updateLater || document.documentElement.classList.contains('companion')) { box.hidden = true; return; }
  const notes = u.notes || [];
  const list = h('ul', { id: 'updateNotes', hidden: true }, [...notes.slice(0, 12).map((n) => h('li', {}, n)),
    ...(notes.length > 12 ? [h('li', { class: 'muted' }, `and ${notes.length - 12} more`)] : [])]);
  const toggle = notes.length ? h('a', { id: 'updateWhatsNew', class: 'small', onclick: () => {
    list.hidden = !list.hidden;
    toggle.textContent = list.hidden ? 'What\u2019s new' : 'Hide';
  } }, 'What\u2019s new') : null;
  const quit = h('input', { type: 'checkbox', id: 'installOnQuit', onchange: async (e) => {
    try { await go().SetInstallOnQuit(e.target.checked); } catch (err) { e.target.checked = !e.target.checked; showError(err); }
  } });
  quit.checked = !!u.installOnQuit;
  box.replaceChildren(
    h('div', { class: 'row' },
      h('strong', { class: 'grow' }, u.version ? `Homelab Wizard ${u.version} is ready` : 'A Homelab Wizard update is ready'),
      toggle,
      h('button', { id: 'updateRestart', class: 'primary small', title: u.ready ? 'Already downloaded: the app closes and opens again in a few seconds' : 'Downloads it (a minute or two), then the app closes and opens again', onclick: async (e) => {
        e.target.disabled = true;
        e.target.textContent = u.ready ? 'Restarting\u2026' : 'Downloading\u2026';
        try { await go().InstallAppUpdate(); } catch (err) { e.target.disabled = false; e.target.textContent = 'Restart to update'; showError(err); }
      } }, 'Restart to update'),
      h('button', { id: 'updateLater', class: 'small', onclick: () => { updateLater = u.commit; box.hidden = true; } }, 'Later')),
    list,
    h('label', {}, quit, 'Install updates when I quit the app, without asking'),
    h('span', { class: 'muted small' }, 'Your homelab keeps running while the app updates.' +
      (isMac ? ' Afterwards macOS may say Homelab Wizard added items that can run in the background: that is this update, not something new. The app is not signed with a Developer ID, so macOS sees each build as new.' : '')));
  box.hidden = false;
}
window.runtime?.EventsOn?.('app:update', updateBanner);
try { go().PendingAppUpdate().then(updateBanner).catch(() => {}); } catch { /* the phone has no app to update */ }

// Back to the version before the last update (homelab upgrade --back):
// the first click asks, the second goes.
function goBackLink(p) {
  const a = h('a', { id: 'upgradeBack', title: `The homelab files as they were before the update of ${new Date(p.when).toLocaleString()}; settings and data stay` }, `go back to ${p.version} (${p.commit.slice(0, 7)})`);
  keyable(a);
  a.onclick = async () => {
    if (!a.dataset.sure) { a.dataset.sure = '1'; a.textContent = `click again to go back to ${p.version}`; return; }
    const log = $('setupLog');
    log.hidden = false;
    log.textContent = 'Going back…\n';
    const off = window.runtime.EventsOn('cli:log', (line) => { log.textContent += line + '\n'; log.scrollTop = log.scrollHeight; });
    try { await go().Homelab('upgrade-back', '', true); } catch (e) { showError(e); }
    if (typeof off === 'function') off();
    loadUpgrade(true);
  };
  return a;
}

// The newest app build in place of this one; the app quits and opens again.
async function installApp() {
  const log = $('setupLog'), btn = document.getElementById('appUpdateBtn');
  if (btn) btn.disabled = true;
  log.hidden = false;
  log.textContent += 'Downloading the newest Homelab Wizard (a minute or two)…\n';
  try {
    await go().InstallAppUpdate();
    log.textContent += 'Opening the new version…\n';
  } catch (e) {
    if (btn) btn.disabled = false;
    log.textContent += 'The app update stopped; the homelab is fine. Try again, or download it from the release page.\n';
    showError(e);
  }
}

async function runUpgrade(app) {
  const log = $('setupLog'), btn = $('upgradeBtn');
  btn.disabled = true;
  log.hidden = false;
  log.textContent = 'Getting the update…\n';
  const off = window.runtime.EventsOn('cli:log', (line) => { log.textContent += line + '\n'; log.scrollTop = log.scrollHeight; });
  let ok = true;
  try { await go().Homelab('upgrade', '', true); } catch (e) { ok = false; showError(e); }
  if (typeof off === 'function') off();
  log.textContent += ok ? '\nThe homelab is up to date.\n' : '\nThe update stopped: the log says why. Nothing was merged or overwritten.\n';
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
let lastSteps = [];
let showDoneSteps = false;

function renderSetup(steps) {
  lastSteps = steps;
  const done = steps.filter((s) => s.state === 'done').length;
  $('checkTitle').textContent = done === steps.length ? `First-time setup · all ${steps.length} done` : `First-time setup · ${done} of ${steps.length} done`;
  $('setupMeter').style.width = steps.length ? `${Math.round((100 * done) / steps.length)}%` : '0';
  setupBadge(steps.length - done);
  const ready = runnable(steps);
  $('runAll').hidden = runningAll || ready.length < 2;
  if (!runningAll) $('runAll').textContent = `Do the ${ready.length} steps I can`;
  // Finished steps fold into one line, so what is left stands out.
  const fold = done > 0 && done < steps.length && !showDoneSteps;
  const summary = done > 0 && done < steps.length ? h('li', { class: 'done folded' },
    h('span', { class: 'mark' }, icon('check')),
    h('div', { class: 'body' }, h('strong', { class: 'title' }, `${done} done`)),
    h('div', { class: 'actions' }, h('a', { id: 'toggleDone', class: 'small', onclick: () => { showDoneSteps = !showDoneSteps; renderSetup(lastSteps); } }, showDoneSteps ? 'Hide' : 'Show'))) : null;
  $('checklist').replaceChildren(...(summary ? [summary] : []), ...steps.map((s, i) => {
    if (fold && s.state === 'done') return null;
    const actions = [];
    if (s.state !== 'waiting' && s.state !== 'done') {
      if (s.settings?.length) actions.push(h('button', { class: 'small', onclick: () => showSettings(s.settings) }, 'Fill in settings'));
      if (s.run?.length) actions.push(h('button', { class: 'small', onclick: (e) => runStep(s, e.target) }, s.runLabel || 'Run'));
      (s.choices || []).forEach((c, ci) => actions.push(h('button', { class: 'small choice', onclick: (e) => runStep(s, e.target, ci) }, c.label)));
      if (s.open) actions.push(link(s.open, 'Open ' + s.open.replace(/^https?:\/\//, '').replace(/\/$/, '')));
    }
    if (s.id === 'vaultwarden' && s.state !== 'waiting' && s.state !== 'done') {
      actions.push(h('button', { class: 'small', onclick: async () => {
        const log = $('setupLog');
        log.hidden = false;
        const off = window.runtime.EventsOn('cli:log', (line) => { log.textContent += line + '\n'; });
        try { await go().Homelab('signups-close', '', true); } catch (e) { showError(e); }
        if (typeof off === 'function') off();
      } }, 'Close sign-ups now'));
    }
    if (s.manual && s.state !== 'waiting') {
      actions.push(h('label', { class: 'small' }, h('input', { type: 'checkbox', checked: s.state === 'done',
        onchange: async (e) => { try { renderSetup(await go().MarkSetupDone(s.id, e.target.checked)); } catch (err) { showError(err); } } }), ' Done'));
    }
    // A row: the step's number, what it gives you, and its buttons on the right.
    return h('li', { class: s.state },
      h('span', { class: 'mark' }, s.state === 'done' ? icon('check') : String(i + 1)),
      h('div', { class: 'body' }, h('strong', { class: 'title' }, s.title),
        h('div', { class: 'sub muted' }, s.why),
        s.state !== 'done' && s.detail ? h('div', { class: 'sub' }, s.detail) : null),
      actions.length ? h('div', { class: 'actions' }, actions) : null);
  }).filter(Boolean));
}

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

async function runStep(step, button, choice) {
  const log = $('setupLog');
  log.hidden = false;
  log.textContent = '';
  button.disabled = true;
  const off = window.runtime.EventsOn('setup:log', (line) => { log.textContent += line + '\n'; log.scrollTop = log.scrollHeight; });
  try {
    renderSetup(await (choice === undefined ? go().RunSetup(step.id) : go().RunSetupChoice(step.id, choice)));
  } catch (e) {
    showError(e);
    loadSetup();
  } finally {
    if (typeof off === 'function') off();
  }
}

// Settings: .env as a form. Secrets are never sent to the page; an empty
// secret field keeps the stored value. Logins, tokens, and folders have a
// Test button that checks the saved value against the real service.
const changed = {};
let testable = null;

// Phones: the ones paired with the phone companion (homelab serve), and a
// one-time code with its QR code to pair another.
async function loadPhones() {
  const card = $('phonesCard');
  let phones;
  try { phones = await go().Phones(); } catch (e) { card.hidden = true; return; }
  card.hidden = false;
  const name = h('input', { id: 'phoneName', placeholder: 'Name, e.g. Anna\u2019s iPhone', autocomplete: 'off', spellcheck: 'false' });
  const canChange = h('input', { type: 'checkbox', id: 'phoneCanChange' });
  card.replaceChildren(
    h('div', { class: 'row' }, h('h2', {}, 'Phones'), h('span', { class: 'muted' }, phones.length ? `${phones.length} paired` : 'none paired yet')),
    h('p', { class: 'muted' }, 'Status and Backups on your phones, at home and on the tailnet (never on the internet). Each phone pairs once with a code; it can only look unless you let it make changes.'),
    phones.length ? h('ul', { class: 'alertlist' }, phones.map((p) => h('li', {},
      h('span', { class: 'dot ' + (p.canChange ? 'warn' : 'ok') }),
      h('div', { class: 'grow' }, h('strong', {}, p.name), h('div', { class: 'muted' }, `${p.canChange ? 'Can make changes' : 'Looks only'} · last seen ${ago(p.lastSeen)}`)),
      h('button', { class: 'small', title: p.canChange ? 'Only look from now on' : 'Let it start, stop, restart, update, and back up', onclick: async () => {
        try { await go().SetPhoneCanChange(p.id, !p.canChange); } catch (e) { showError(e); }
        loadPhones();
      } }, p.canChange ? 'Make read-only' : 'Allow changes'),
      h('button', { class: 'small', title: 'Unpair it: it stops working at once', onclick: async () => {
        try { await go().RemovePhone(p.id); } catch (e) { showError(e); }
        loadPhones();
      } }, 'Remove')))) : '',
    h('div', { class: 'inputrow pairrow' }, name, h('label', { class: 'check' }, canChange, ' Can make changes'),
      h('button', { class: 'small', id: 'pairPhone', onclick: async () => {
        try { showPairing(await go().PairPhone(name.value, canChange.checked)); } catch (e) { showError(e); }
      } }, 'Pair a phone')),
    h('div', { id: 'pairing', hidden: true }));
}

// People: the household, each with a Pocket ID sign-in and a welcome page
// (homelab person). Adding someone needs Pocket ID running.
async function loadPeople() {
  const card = $('peopleCard');
  let list, st;
  try { [list, st] = await Promise.all([go().People(), go().Status()]); } catch { card.hidden = true; return; }
  card.hidden = false;
  const byId = Object.fromEntries(st.apps.map((a) => [a.id, a]));
  const pocket = byId['pocket-id']?.state === 'running';
  const active = list.filter((p) => !p.removed || p.removed.startsWith('0001'));
  const head = h('div', { class: 'row' }, h('h2', {}, 'People'), h('span', { class: 'muted' }, active.length ? `${active.length} in the household` : 'just you so far'));
  const why = h('p', { class: 'muted' }, 'Each person gets one sign-in for the apps (with a passkey, no password to remember) and a welcome page with their apps and the phone apps to install.');
  if (!pocket) {
    card.replaceChildren(head, why, h('div', { class: 'row' },
      h('span', { class: 'muted' }, 'Adding people uses Pocket ID, the household\u2019s sign-in.'),
      h('button', { class: 'small', id: 'installPocket', onclick: () => { selected.add('pocket-id'); navigated = true; show('choose'); renderApps(); replan(); } }, 'Install Pocket ID')));
    return;
  }
  const catOf = Object.fromEntries((catalog?.apps || []).map((x) => [x.id, x]));
  const personal = st.apps.filter((a) => a.state === 'running' && (a.address || a.url) && a.id !== 'homepage' && catOf[a.id]?.kind !== 'helper'
    && (!['network', 'system', 'security'].includes(catOf[a.id]?.category) || a.id === 'vaultwarden'));
  const name = h('input', { id: 'personName', placeholder: 'Name, e.g. Anna Smith', autocomplete: 'off', spellcheck: 'false' });
  const email = h('input', { id: 'personEmail', type: 'email', placeholder: 'Email (optional)', autocomplete: 'off', spellcheck: 'false' });
  const picks = personal.map((a) => h('label', { class: 'check' }, h('input', { type: 'checkbox', value: a.id }), ' ', a.name));
  const log = h('pre', { id: 'peopleLog', hidden: true });
  const run = async (button, action, who, mail = '', apps = []) => {
    button.disabled = true;
    log.hidden = false;
    log.textContent = '';
    const off = window.runtime.EventsOn('cli:log', (line) => { log.textContent += line + '\n'; log.scrollTop = log.scrollHeight; });
    let ok = true;
    try { await go().PersonAction(action, who, mail, apps); } catch (e) { ok = false; showError(e); }
    if (typeof off === 'function') off();
    button.disabled = false;
    return ok;
  };
  card.replaceChildren(head, why,
    active.length ? h('ul', { class: 'alertlist' }, active.map((p) => h('li', {},
      h('span', { class: 'dot ok' }),
      h('div', { class: 'grow' }, h('strong', {}, p.name), h('div', { class: 'muted' }, [p.email, (p.apps || []).length ? `${p.apps.length} app${p.apps.length === 1 ? '' : 's'}` : 'every app'].filter(Boolean).join(' · '))),
      h('button', { class: 'small', title: 'Open their welcome page, to print or send', onclick: () => go().OpenWelcome(p.username).catch(showError) }, 'Welcome page'),
      h('button', { class: 'small', title: 'A new sign-in link (the old one stops working) and a fresh welcome page', onclick: async (e) => { if (await run(e.target, 'welcome', p.username)) go().OpenWelcome(p.username).catch(showError); } }, 'New sign-in link'),
      h('button', { class: 'small danger', title: 'Turn their sign-in off; their photos, documents, and the rest stay', onclick: async (e) => {
        if (e.target.dataset.sure !== '1') { e.target.dataset.sure = '1'; e.target.textContent = 'Click again to remove'; return; }
        if (await run(e.target, 'remove', p.username)) loadPeople();
      } }, 'Remove')))) : '',
    h('details', { class: 'addperson', open: !active.length },
      h('summary', {}, h('strong', {}, 'Add a person')),
      h('div', { class: 'inputrow' }, name, email),
      picks.length ? h('div', { class: 'picks' }, h('div', { class: 'muted small' }, 'The apps they use (none ticked: all of them)'), picks) : '',
      h('button', { class: 'small primary', id: 'addPerson', onclick: async (e) => {
        if (!name.value.trim()) { name.focus(); return; }
        const apps = picks.map((l) => l.querySelector('input')).filter((i) => i.checked).map((i) => i.value);
        if (await run(e.target, 'add', name.value.trim(), email.value.trim(), apps)) {
          const added = (await go().People()).find((p) => p.name === name.value.trim());
          if (added) go().OpenWelcome(added.username).catch(() => {});
          loadPeople();
        }
      } }, 'Add them')),
    log);
}

function showPairing(p) {
  const box = $('pairing');
  box.hidden = false;
  box.replaceChildren(h('div', { class: 'pairing' },
    p.qr ? h('img', { src: p.qr, alt: 'QR code for pairing', width: 180, height: 180 }) : '',
    h('div', {},
      h('p', {}, 'Scan this with the phone\u2019s camera, or open a link on the phone, then tap ', h('strong', {}, 'Pair'), '. The code is ', h('code', {}, p.code), ' and works once, for 10 minutes.'),
      h('ul', {}, (p.links || []).map((l) => h('li', {}, h('code', {}, l)))),
      p.off ? h('p', { class: 'bad' }, 'The phone companion is off (PHONE_COMPANION=false): turn it on below and save first.') : '',
      h('p', { class: 'muted' }, 'Then, in Safari: Share \u203a Add to Home Screen.'),
      h('button', { class: 'small', onclick: () => { box.hidden = true; loadPhones(); } }, 'Done'))));
}

async function loadSettings(focus = []) {
  loadPhones();
  loadPeople();
  let list;
  try { list = await go().Settings(); } catch (e) { $('settingsForm').replaceChildren(h('p', { class: 'bad' }, String(e))); return; }
  for (const k of Object.keys(changed)) delete changed[k];
  markChanged();
  if (!testable) { try { testable = new Set(await go().SettingTests()); } catch { testable = new Set(); } }
  const checks = {};
  for (const s of lastSteps) for (const k of s.settings || []) checks[k] = s;
  // Pages, as in System Settings: the homelab-wide sections, then one page
  // per app (its port, settings, and secrets together), then People and
  // Phones. The .env sections of every app's ports and every app's settings
  // are split by app.
  const pages = settingsPages(list);
  const wanted = new Set([...everyday, ...(catalog?.apps || []).flatMap((a) => a.inputs || []), ...Object.keys(checks), ...focus]);
  everydayCount = list.filter((s) => wanted.has(s.key)).length;
  moreCount = list.length - everydayCount;
  $('settingsForm').replaceChildren(...pages.map((pg) => h('div', { class: 'group', 'data-page': pg.name, 'data-kind': pg.kind },
    h('h2', {}, pg.name), pg.items.map((s) => {
    const step = checks[s.key];
    const result = h('div', { class: 'test', hidden: true });
    const toggle = !s.secret && /^(true|false)$/i.test(s.value || '');
    const input = toggle
      ? h('input', { type: 'checkbox', class: 'switch', role: 'switch', checked: /^true$/i.test(s.value), 'aria-label': settingLabel(s.key),
        onchange: (e) => { changed[s.key] = e.target.checked ? 'true' : 'false'; markChanged(); } })
      : h('input', {
        type: s.secret ? 'password' : 'text', autocomplete: 'off', spellcheck: 'false',
        value: s.secret ? '' : s.value || '', 'aria-label': settingLabel(s.key),
        placeholder: s.secret ? (s.set ? 'set · leave empty to keep' : 'not set') : '',
        oninput: (e) => { changed[s.key] = e.target.value; markChanged(); },
      });
    const test = testable.has(s.key) ? h('button', { class: 'small', title: 'Check the saved value with the service it is for', onclick: (e) => testSetting(s.key, e.target, result) }, 'Test') : null;
    const copy = s.secret && s.set ? h('button', { class: 'small', title: 'Copy the saved value, to keep it in the password manager; the clipboard clears after 90 seconds', onclick: (e) => copySetting(s.key, e.target, result) }, 'Copy') : null;
    const choose = !s.secret && folderKey.test(s.key) ? h('button', { class: 'small', title: 'Pick the folder', onclick: async () => {
      try {
        const dir = await go().ChooseFolder(s.key);
        if (dir) { input.value = dir; changed[s.key] = dir; markChanged(); }
      } catch (e) { showError(e); }
    } }, 'Choose…') : null;
    const row = h('div', { class: 'setting' + (focus.includes(s.key) ? ' focus' : '') + (wanted.has(s.key) ? '' : ' more'), id: 'setting-' + s.key },
      h('div', { class: 'key' }, h('span', { class: 'label' }, settingLabel(s.key)), h('code', {}, s.key)),
      test || copy || choose ? h('div', { class: 'inputrow' }, input, choose, copy, test) : input,
      result,
      s.help ? h('div', { class: 'help' }, s.help) : null,
      step && step.state !== 'waiting' ? h('div', { class: 'check ' + (step.state === 'done' ? 'ok' : 'warn') },
        step.state === 'done' ? `✓ ${step.title}` : `${step.title}: ${step.detail || 'to do'}`) : null);
    return row;
  }))));
  if (focus.length) settingsPage = pages.find((pg) => pg.items.some((s) => s.key === focus[0]))?.name || settingsPage;
  if (!pages.some((pg) => pg.name === settingsPage) && !extraPages.includes(settingsPage)) settingsPage = pages[0]?.name || '';
  renderSettingsNav(pages);
  filterSettings();
  if (focus.length) document.getElementById('setting-' + focus[0])?.scrollIntoView({ block: 'center' });
}

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
    prefixes: [[norm(a.id), 0], [norm(a.name), 2], [norm(a.id.split('-')[0]), 1]] }));
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
      page(s.section, isApp ? 'app' : 'general').items.push(s);
      continue;
    }
    const a = appOf(s.key);
    page(a ? a.name : 'Other apps', 'app').items.push(s);
  }
  const appPages = [...byApp.values()].sort((a, b) => (a.name === 'Other apps') - (b.name === 'Other apps') || a.name.localeCompare(b.name));
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
    h('div', { class: 'navhead' }, 'General'), ...general.map((p) => item(p.name, 'general')), ...extraPages.map((n) => item(n, 'general')),
    ...(mine.length ? [h('div', { class: 'navhead' }, 'Apps'), ...mine.map((p) => item(p.name, 'app'))] : []),
    ...(others.length ? [h('div', { class: 'navhead' }, 'Not installed'), ...others.map((p) => item(p.name, 'app'))] : []));
}
function showSettingsPage(name) {
  document.querySelector(`#settingsNav .pagebtn[data-page="${CSS.escape(name)}"]`)?.click();
}

// The settings people change: where things are, the accounts the homelab
// uses, and how it behaves. Apps' own inputs and Setup's steps join them.
const everyday = new Set(['TZ', 'HOMELAB_DOMAIN', 'MEDIA_ROOT', 'DOWNLOADS_ROOT', 'IMMICH_UPLOAD_LOCATION', 'BACKUP_DESTINATION',
  'JELLYFIN_DATA_DIR', 'SYNC_ROOT', 'KEEP_AWAKE', 'BATTERY_SAVER', 'PHONE_COMPANION', 'AUTO_DOMAIN', 'CLOUDFLARE_API_TOKEN', 'TUNNEL_TOKEN',
  'ADGUARD_USER', 'ADGUARD_PASSWORD', 'HELPER_EMAIL', 'HEARTBEAT_URL', 'DESKTOP_ALERTS', 'UPDATES_PAUSED', 'AUTO_ROLLBACK',
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
  const words = $('settingsSearch').value.toLowerCase().split(/\s+/).filter(Boolean);
  let shown = 0, pageMore = 0;
  const counts = {};
  for (const group of $('settingsForm').querySelectorAll('.group')) {
    const name = group.dataset.page, here = name === settingsPage, general = group.dataset.kind === 'general';
    const section = name.toLowerCase();
    let any = false;
    for (const row of group.querySelectorAll('.setting')) {
      const text = section + ' ' + row.textContent.toLowerCase().replace(/_/g, ' ') + ' ' + row.id.toLowerCase();
      const more = general && row.classList.contains('more');
      if (here && more) pageMore++;
      const match = words.length ? words.every((w) => text.includes(w)) : here && (settingsShowAll || !more);
      row.hidden = !match;
      any = any || match;
      if (match) { shown++; counts[name] = (counts[name] || 0) + 1; }
    }
    group.hidden = !any;
    group.querySelector('h2').hidden = !words.length;
  }
  for (const [id, name] of [['peopleCard', 'People'], ['phonesCard', 'Phones']]) $(id).classList.toggle('offpage', !!words.length || settingsPage !== name);
  for (const b of $('settingsNav').querySelectorAll('.pagebtn')) {
    b.classList.toggle('active', !words.length && b.dataset.page === settingsPage);
    b.classList.toggle('nomatch', !!words.length && !counts[b.dataset.page]);
    b.querySelector('.n').textContent = words.length && counts[b.dataset.page] ? String(counts[b.dataset.page]) : '';
  }
  $('settingsNone').hidden = shown > 0 || !words.length;
  $('settingsAll').hidden = !!words.length || !pageMore;
  $('settingsAll').textContent = settingsShowAll ? 'Show the everyday settings only' : `Show all settings (${pageMore} more)`;
}
$('settingsSearch').oninput = filterSettings;

// Settings that hold a folder get a Choose… button.
const folderKey = /(_ROOT|_DESTINATION|_LOCATION|_DIR)$/;

async function copySetting(key, button, out) {
  out.hidden = false;
  try {
    await go().CopySetting(key);
    out.className = 'test ok';
    out.textContent = '✓ Copied. Paste it into Vaultwarden; the clipboard clears in 90 seconds.';
  } catch (e) {
    out.className = 'test bad';
    out.textContent = String((e && e.message) || e);
  }
}

async function testSetting(key, button, out) {
  out.hidden = false;
  button.disabled = true;
  // The test checks the saved value, so a value just typed is saved first.
  if (key in changed) {
    const input = document.querySelector(`#setting-${key} input`);
    if (!(input?.type === 'password' && changed[key] === '')) {
      try {
        await go().SaveSettings({ [key]: changed[key] });
      } catch (e) {
        out.className = 'test bad';
        out.textContent = String((e && e.message) || e);
        button.disabled = false;
        return;
      }
    }
    delete changed[key];
    markChanged();
  }
  out.className = 'test muted';
  out.textContent = 'Testing…';
  try {
    const r = await go().TestSetting(key);
    out.className = 'test ' + (r.ok ? 'ok' : 'bad');
    out.textContent = (r.ok ? '✓ ' : '✗ ') + r.message;
  } catch (e) {
    out.className = 'test bad';
    out.textContent = String((e && e.message) || e);
  }
  button.disabled = false;
}

function showSettings(keys) {
  show('settings');
  loadSettings(keys);
}

$('saveSettings').onclick = async () => {
  const values = {};
  for (const [k, v] of Object.entries(changed)) {
    const input = document.querySelector(`#setting-${k} input`);
    if (input?.type === 'password' && v === '') continue; // keep the stored secret
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
  window.runtime.EventsOn('refresh', () => { const current = document.querySelector('.screen.active')?.id; if (current) show(current); });
  try {
    const info = await loadHost();
    if (!info.rootOK) return show('setup');
    await loadCatalog();
    const screen = await go().Screen();
    if (screen) return show(screen);
    // Until the first-time setup is done, the app opens on it.
    const steps = await go().Setup();
    const left = steps.filter((s) => s.state !== 'done').length;
    setupBadge(left);
    if (left && !navigated) show('setup');
  } catch (e) {
    showError(e);
    show('setup');
  }
});
