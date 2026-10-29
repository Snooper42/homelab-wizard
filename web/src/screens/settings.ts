// Settings: .env as a form in pages, with Appearance, People, and Phones
// beside it.
import { type FormActions, formProblem, type FormProps, mountForm, type Page as FormPage, shown as shownSettings, type View as FormView } from '../settings/Form';
import { mountPeople, type PeopleActions, type PeopleProps } from '../settings/People';
import { mountPhones, type PhonesActions } from '../settings/Phones';
import { store } from '../store';
import { mountNav, type NavGroup } from '../settings/Nav';
import { lastSteps, renderAppearance, stepsData } from './setup';
import { catalog, renderApps, replan, selected } from './choose';
import { statusById } from './status';
import { navigate, show } from '../app';
import { $, $1, errorText, go, showError, thisMachine } from '../core';

// Settings: .env as a form. Secrets are never sent to the page; an empty
// secret field keeps the stored value. Logins, tokens, and folders have a
// Test button that checks the saved value against the real service.
export const changed: Record<string, string> = {};
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
/** An app the household signs in to and uses (Settings › People, an app's page): one with a page of its own, not the homelab's machinery. */
export const usedByPeople = (a: api.AppStatus, entry?: api.App) => !!(a.address || a.url) && a.id !== 'homepage' && entry?.kind !== 'helper'
  && (!['network', 'system', 'security'].includes(entry?.category || '') || a.id === 'vaultwarden');
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
  const personal = st.apps.filter((a) => a.state === 'running' && usedByPeople(a, catOf[a.id]));
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
  installPocket: () => { selected.add('pocket-id'); navigate('choose'); renderApps(); replan(); },
  added: async (name) => {
    const added = (await go().People()).find((p) => p.name === name);
    if (added) go().OpenWelcome(added.username).catch(() => {});
    loadPeople();
  },
  reload: () => loadPeople(),
};

// Settings as last read (store.ts), with Phones and People beside them.
// The settings marked (focus) are a Setup step's, asked for from there.
let settingsFocus: string[] = [];
export const settingsData = store(async () => {
  loadPhones();
  loadPeople();
  // Which settings have a Test, asked once, beside the settings.
  const tests = testable ? null : go().SettingTests().catch(() => []);
  const list = await go().Settings();
  if (tests) testable = new Set(await tests);
  return list;
});
settingsData.watch(() => {
  if (settingsData.error) { form = null; formProblem($('settingsForm'), String(settingsData.error)); return; }
  drawSettings(true, true);
});
export function loadSettings(focus: string[] = []) {
  settingsFocus = focus;
  return settingsData.load();
}

// Draws the settings as last read. afresh: they were just read, so the
// form starts again and what was typed is dropped; else it is kept.
// scroll: to the first marked setting.
export function drawSettings(afresh: boolean, scroll: boolean) {
  renderAppearance();
  const list = settingsData.value!, focus = settingsFocus;
  if (afresh) {
    for (const k of Object.keys(changed)) delete changed[k];
    markChanged();
    formVersion++;
  }
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
  form = { pages, wanted, focus, checks, testable: testable!, label: settingLabel, view: settingsView(), on: formActions };
  renderSettingsNav(pages);
  filterSettings();
  if (scroll && focus.length) document.getElementById('setting-' + focus[0])?.scrollIntoView({ block: 'center' });
}

// The other settings each test reads (setup.Tester).
const testReads: Record<string, string[]> = {
  CLOUDFLARE_API_TOKEN: ['HOMELAB_DOMAIN'],
  TUNNEL_TOKEN: ['CLOUDFLARE_API_TOKEN'],
  ADGUARD_USER: ['ADGUARD_PASSWORD'], ADGUARD_PASSWORD: ['ADGUARD_USER'],
  NPM_API_EMAIL: ['NPM_API_PASSWORD'], NPM_API_PASSWORD: ['NPM_API_EMAIL'],
};

// The form as last read, and its version: a new one drops what was typed.
export let form: FormProps | null = null;
let formVersion = 0;
const settingsView = (): FormView => ({ query: $('settingsSearch').value, page: settingsPage, showAll: settingsShowAll });
const isSecret = (key: string) => !!form?.pages.some((pg) => pg.items.some((s) => s.key === key && s.secret));
const formActions: FormActions = {
  edited: (edits) => {
    for (const k of Object.keys(changed)) delete changed[k];
    Object.assign(changed, edits);
    markChanged();
  },
  // The test checks the saved values, so a value just typed is saved
  // first, with the ones its test reads too (the Domain for the token).
  test: async (key, pending) => {
    let used = false;
    const save = {};
    for (const k of testReads[key] || []) if (k in changed && !(isSecret(k) && changed[k] === '')) save[k] = changed[k];
    if (pending !== undefined) {
      if (!(isSecret(key) && pending === '')) save[key] = pending;
      used = true;
    }
    if (Object.keys(save).length) {
      try { await go().SaveSettings(save); } catch (e) { return { result: { tone: 'bad', text: errorText(e) }, used: false }; }
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
const extraPages = ['Appearance', 'People', 'Phones'];

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

// The page list on the left (owner, 29 Oct: "per category"): this machine,
// the household, and reaching the apps; then the installed apps folded by
// their category on Status; then the apps not installed, folded as one.
// A page not named in the groups joins the first.
const pageGroups: [string, string[]][] = [
  [thisMachine, [thisMachine, 'Storage', 'Appearance']],
  ['Household', ['People', 'Phones']],
  ['Reaching the apps', ['Domain', 'Notifications']],
];
let navGroups: NavGroup[] = [];
function renderSettingsNav(pages) {
  const installed = (name) => Object.values(statusById || {}).some((a) => a.name === name && a.state !== 'missing');
  const general = [...pages.filter((p) => p.kind === 'general').map((p) => p.name), ...extraPages];
  const apps = pages.filter((p) => p.kind === 'app');
  const known = Object.keys(statusById || {}).length > 0;
  const mine = known ? apps.filter((p) => installed(p.name) || p.name === 'Other apps') : apps;
  const others = known ? apps.filter((p) => !mine.includes(p)) : [];
  const groups: NavGroup[] = pageGroups.map(([head, names]) => ({ head, pages: names.filter((n) => general.includes(n)) }));
  const named = new Set(pageGroups.flatMap(([, names]) => names));
  groups[0].pages.push(...general.filter((n) => !named.has(n)));
  // An app page's category: its app's (a page named for an app, or for an
  // app and its helpers, as "Nginx Proxy Manager and CrowdSec").
  const cats = catalog?.categories || [];
  const catOf = (name) => (catalog?.apps || []).find((a) => a.kind !== 'helper' && (name === a.name || name.startsWith(a.name + ' ')))?.category || '';
  const folds = cats.map((c) => ({ label: c.label, pages: mine.filter((p) => p.name !== 'Other apps' && catOf(p.name) === c.id).map((p) => p.name) }))
    .filter((f) => f.pages.length);
  const loose = mine.filter((p) => p.name !== 'Other apps' && !cats.some((c) => c.id === catOf(p.name))).map((p) => p.name);
  const other = mine.some((p) => p.name === 'Other apps') ? ['Other apps'] : [];
  navGroups = [...groups,
    { head: 'Apps', pages: loose, folds: [...folds, ...(others.length ? [{ label: "Apps you don't have", pages: others.map((p) => p.name) }] : [])], after: other }];
}
function pickSettingsPage(name) {
  settingsPage = name;
  $('settingsSearch').value = '';
  filterSettings();
  document.querySelector('main').scrollTo({ top: 0 });
}
// A page in a folded category has no button until its fold opens: picked
// directly, its fold opens with it.
export function showSettingsPage(name) {
  pickSettingsPage(name);
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
  CLOUDFLARE_API_TOKEN: 'Cloudflare API token', TUNNEL_TOKEN: 'Cloudflare Tunnel token', DESKTOP_ALERTS: 'Alerts on this screen',
  HELPER_EMAIL: "Your helper's email", HEARTBEAT_URL: 'Heartbeat ping URL', UPDATES_PAUSED: 'Pause nightly updates',
  VAULTWARDEN_SIGNUPS_ALLOWED: 'Vaultwarden sign-ups open', TAILSCALE_AUTHKEY: 'Tailscale auth key (optional)', TAILSCALE_HOST: 'This machine on the tailnet', TAILNET_ADMIN_APPS: 'Admin apps on the tailnet',
  PROTONVPN_WIREGUARD_PRIVATE_KEY: 'ProtonVPN WireGuard key', PROTONVPN_SERVER_COUNTRIES: 'ProtonVPN server countries',
  ADGUARD_DNS_BIND_IP: 'AdGuard Home DNS listens on', HOST_GATEWAY: "Apps reach this machine's own apps at", SSO_HOST: 'Pocket ID address for the apps', HOMEBOX_ALLOW_REGISTRATION: 'Homebox sign-ups open',
  AUTO_ROLLBACK: 'Undo an update that breaks an app', AUTO_HEAL: 'Restart an app that stops answering', UPDATE_CHANNEL: 'Homelab update channel',
  WATCHTOWER_SCHEDULE: 'When apps update', SPEEDTEST_SCHEDULE: 'When the speed test runs', OLLAMA_MODEL: 'Model that explains logs',
  UPDATES_HELD: 'Apps with updates held', UPDATES_HELD_CONTAINERS: 'Containers with updates held',
  NTFY_PUBLISH_AUTH: 'ntfy publish token, as a link', NTFY_READ_TOKEN: 'ntfy read-only token', MONEYMATTER_FRONTEND_IMAGE: 'MoneyMatter frontend image',
};
const upper = new Set(['API', 'URL', 'DNS', 'IP', 'HTTP', 'HTTPS', 'ID', 'PDF', 'AI', 'IGDB', 'SSL', 'UI', 'OCR', 'JWT', 'SSO', 'VPN']);
const wordLabels = { DB: 'database', NEXTAUTH: 'NextAuth', MEILI: 'Meilisearch', SCREENSCRAPER: 'ScreenScraper', NPM: 'Nginx Proxy Manager' };
const envPrefix = (t) => t.toUpperCase().replace(/[^A-Z0-9]+/g, '_') + '_';
// The app a key starts with, in the app's own spelling (OPEN_WEBUI_PORT:
// Open WebUI), by its ID, its name, or the first word of both (ADGUARD_PORT:
// AdGuard Home), a main app before a helper.
function keyApp(key): [string, string] | null {
  let best: [string, string] | null = null, score = 0;
  for (const a of catalog?.apps || []) {
    const first = envPrefix(a.id.split('-')[0]);
    const prefixes = [envPrefix(a.id), envPrefix(a.name)];
    if (a.kind !== 'helper' && envPrefix(a.name).startsWith(first)) prefixes.push(first);
    for (const p of prefixes) {
      const sc = key.startsWith(p) ? p.length * 2 + (a.kind === 'helper' ? 0 : 1) : 0;
      if (sc > score) { best = [a.name, key.slice(p.length)]; score = sc; }
    }
  }
  return best;
}
export function settingLabel(key) {
  if (settingLabels[key]) return settingLabels[key];
  const app = keyApp(key);
  const words = (app ? app[1] : key).split('_').filter(Boolean).map((w) => wordLabels[w] || (upper.has(w) ? w : w.toLowerCase()));
  if (app) return [app[0], ...words].join(' ');
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
  for (const [id, name] of [['thisMacCard', thisMachine], ['appearanceCard', 'Appearance'], ['peopleCard', 'People'], ['phonesCard', 'Phones']]) $(id).classList.toggle('offpage', searching || settingsPage !== name);
  mountNav($('settingsNav'), { groups: navGroups, active: settingsPage, counts: searching ? sh.counts : null, pick: pickSettingsPage });
  $('settingsForm').classList.toggle('searching', searching);
  $('settingsNone').hidden = sh.keys.size > 0 || !searching;
  $('settingsAll').hidden = searching || !sh.pageMore;
  $('settingsAll').textContent = settingsShowAll ? 'Show the everyday settings only' : `Show all settings (${sh.pageMore} more)`;
}
$('settingsSearch').oninput = filterSettings;

// A Setup step's settings: Settings opens at the first of them, each
// marked, keeping what was typed (read first if never read).
export function showSettings(keys) {
  settingsFocus = keys;
  const kept = settingsData.at > 0;
  show('settings');
  if (kept) drawSettings(false, true);
}

$('saveSettings').onclick = async () => {
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(changed)) {
    if (isSecret(k) && v === '') continue; // keep the stored secret
    values[k] = v;
  }
  try {
    await go().SaveSettings(values);
    stepsData.set(await go().Setup()); // check the new values
    await loadSettings(Object.keys(values));
  } catch (e) { showError(e); }
};
