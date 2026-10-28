// Status shows every app in the previews and tests unless a shot asks
// for the folded view (statusOpen: '').
try { localStorage.setItem('homelab.statusOpen', (window.__MOCK || {}).statusOpen ?? 'all'); } catch { /* none */ }
// A stand-in for the Go backend, so the frontend can run in a plain browser
// for screenshots and quick checks. shoot.mjs fills window.__MOCK with the
// real catalog (from `homelab apps --json`) and example state; every method
// app.go binds is answered here from that data.
(() => {
  const M = window.__MOCK;
  // The platform the page believes it runs on (os-mac and ⌘ shortcuts, or not).
  if (M.platform) Object.defineProperty(Navigator.prototype, 'platform', { get: () => M.platform });
  const listeners = {};
  const later = (v, ms = 40) => new Promise((r) => setTimeout(() => r(structuredClone(v)), ms));
  const emit = (name, data) => (listeners[name] || []).forEach((fn) => fn(data));
  // Lets a smoke test stand in for the Mac menu's events.
  window.__emit = emit;

  window.runtime = {
    EventsOn(name, fn) {
      (listeners[name] ??= []).push(fn);
      return () => { listeners[name] = listeners[name].filter((f) => f !== fn); };
    },
    EventsEmit: emit,
    ClipboardSetText: (v) => { M.clipboard = v; return Promise.resolve(true); },
  };

  // A stand-in for the QR code the Go side draws: a checkerboard of the same size.
  const qrStandIn = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 33 33" shape-rendering="crispEdges"><rect width="33" height="33" fill="#fff"/><path d="' +
    Array.from({ length: 25 * 25 }, (_, i) => ((i * 7919) % 3 === 0 ? `M${4 + (i % 25)} ${4 + Math.floor(i / 25)}h1v1h-1z` : '')).join('') + '"/></svg>');
  const appByID = (id) => M.catalog.apps.find((a) => a.id === id) || { id, name: id };

  window.go = { main: { App: {
    Host: () => later(M.host),
    Catalog: () => later(M.catalog),
    // statusDelay: a slow engine (ms); M.statusAnswered once it has answered.
    Status: () => (M.statusError ? Promise.reject(new Error(M.statusError)) : later(M.status, M.statusDelay).then((st) => { M.statusAnswered = true; return st; })),
    // lastStatus: the agent's last reading, lastStatusAge seconds old (default 20).
    LastStatus: () => later(M.lastStatus ? { status: M.lastStatus, at: new Date(Date.now() - (M.lastStatusAge ?? 20) * 1000).toISOString() } : null),
    Setup: () => later(M.setup),
    Settings: () => later(M.settings),
    Screen: () => later(M.screen || ''),
    Open: (url) => { M.opened = url; },
    SetAttention: (n) => { M.attention = n; },
    MarkSetupDone: () => later(M.setup),
    SetUpdatesPaused: (p) => { M.status.updates.paused = p; return later(M.status.updates); },
    SaveSettings: (values) => { M.saved = { ...(M.saved || {}), ...values }; return later(M.settings); },
    ChooseRoot: () => later(M.host),
    StartRuntime() { M.host = { ...M.host, runtimeOK: true, runtimeFound: 'OrbStack, engine 28.3.0' }; return later(null); },
    CreateHomelab() { M.host = { ...M.host, rootOK: true, kit: false, root: M.host.newRoot }; return later(M.host); },
    Plan(tokens, filled = {}) {
      const running = new Set(M.status.apps.filter((a) => a.state === 'running').map((a) => a.id));
      const start = [];
      const added = {};
      const waiting = [];
      for (const id of tokens) {
        const preset = M.catalog.presets.find((p) => p.id === id || p.token === id);
        for (const a of preset ? preset.apps : [id]) {
          const needs = (x) => (appByID(x).inputs || []).filter((k) => !filled[k]);
          const dep = (appByID(a).dependsOn || []).find((d) => needs(d).length);
          if (dep) { waiting.push({ app: dep, reason: `set ${needs(dep).join(', ')} in .env first` }, { app: a, reason: `needs ${appByID(dep).name}` }); continue; }
          if (needs(a).length) { waiting.push({ app: a, reason: `set ${needs(a).join(', ')} in .env first` }); continue; }
          for (const dep of appByID(a).dependsOn || []) if (!running.has(dep) && !start.includes(dep)) { start.push(dep); added[dep] = a; }
          if (!running.has(a) && !start.includes(a)) start.push(a);
        }
      }
      return later({
        ready: true, requested: tokens, added, notes: [], start,
        skips: [...tokens.filter((id) => running.has(id)).map((id) => ({ app: id, reason: 'already running' })), ...waiting],
        portChanges: [], folders: [], networks: [], warnings: [], problems: [],
        envChanges: start.flatMap((id) => (M.envFor[id] || []).map((key) => ({ key, secret: /SECRET|PASSWORD|TOKEN|KEY/.test(key), value: '' }))),
      });
    },
    // What Compose prints, as the app reads it (internal/progress): each
    // app downloads, then is set up and starts, a little apart.
    async playApps(ids) {
      const name = (id) => appByID(id).name;
      const u = (id, stage, words, percent = -1, done = false) => emit('job:app', { app: id, name: name(id), stage, words, percent, done });
      for (const p of [0, 35, 70, 100]) {
        ids.forEach((id, i) => u(id, 'downloading', `Downloading · ${Math.min(100, p + i * 10)}%`, Math.min(100, p + i * 10)));
        await later(null, 90);
      }
      for (const id of ids) { u(id, 'starting', 'Starting'); await later(null, 90); }
      for (const id of ids) { u(id, 'running', 'Running', -1, true); await later(null, 60); }
    },
    async Install(tokens) {
      const steps = [['env'], ['folders'], ['start', tokens]];
      for (const [i, [name, apps]] of steps.entries()) {
        emit('progress', { step: i + 1, steps: steps.length, name, apps, done: false });
        if (name === 'start') await this.playApps(apps.filter((id) => !(M.status.apps || []).some((a) => a.id === id && a.state === 'running')));
        await later(null, 300);
        emit('progress', { step: i + 1, steps: steps.length, name, apps, done: true });
      }
      return tokens.map((id) => ({ id, name: appByID(id).name, url: M.urls[id] }));
    },
    // actionDelay: a slow runtime (ms); actionError: the action fails with it.
    async AppAction(id, action) {
      M.actionDone = false;
      emit('cli:log', `$ homelab ${action} ${id}`);
      for (const line of M.actionLog[action] || []) { await later(null, 120); emit('cli:log', line.replace('%s', id)); }
      if (M.actionDelay) await later(null, M.actionDelay);
      M.actionDone = true;
      if (M.actionError) throw new Error(M.actionError);
      if (action === 'start') M.status = { ...M.status, apps: M.status.apps.map((a) => (a.id === id ? { ...a, state: 'running', health: 'healthy' } : a)) };
    },
    Logs: (id) => later(M.logs[id] || M.logs.default),
    AppIcon: (id) => later(M.icons?.[id] || ''),
    Explainer: () => later(M.explainer || ''),
    ExplainLogs: (id) => later(M.explained?.[id] || 'The log looks normal.', 300),
    Backups: () => later(M.backups),
    DuplicatiJobs: () => later(M.duplicatiJobs || []),
    Alerts: () => later(M.alerts || []),
    Protection: () => (M.protection ? later(M.protection) : Promise.reject(new Error('CrowdSec and the proxy are not both running'))),
    TrayAtLogin: () => later(!!M.trayAtLogin),
    SetTrayAtLogin: (on) => { M.trayAtLogin = on; return later(null); },
    Answers: () => later(M.answers || {}),
    Appearance: () => later({ theme: 'system', accent: '', contrast: 'system', layout: 'classic', icon: '', motion: 'system', transparency: 'system', ...M.look }),
    SetAppearance: (look) => { M.look = look; return later(look); },
    // Offered only by the Linux AppImage (mock: menuEntry set).
    MenuEntry: () => later(M.menuEntry ? { available: true, added: !!M.menuEntry.added } : { available: false, added: false }),
    SetMenuEntry: (on) => { M.menuEntry = { added: on }; return later(null); },
    Watchdog: () => later(M.watchdog || { lastRun: '0001-01-01T00:00:00Z', checks: 0, failing: [], pending: 0 }),
    RevealReport: () => later(null),
    RecoveryKit: () => later(null),
    EmailReport: () => later(null),
    LastCrash: () => later(M.crashSeen ? null : M.crash || null),
    CrashSeen() { M.crashSeen = true; return later(null); },
    PendingAppUpdate: () => later(M.pendingUpdate || null),
    SetInstallOnQuit: (on) => { M.installOnQuit = on; return later(null); },
    // downloadSteps: the percents its download reports (app:download) before it is in place.
    InstallAppUpdate: async () => {
      for (const p of M.downloadSteps || []) { await later(null, 200); emit('app:download', { done: p * 1000, total: 100000, percent: p }); }
      await later(null, M.downloadSteps ? 400 : 0);
      M.appInstalled = true;
      return null;
    },
    UpgradeCheck: () => (M.upgrade ? later(M.upgrade) : Promise.reject(new Error('not a git checkout'))),
    // A series (usageSeries) gives each call the next sample, for the power card's lines.
    Usage: () => later(M.usageSeries ? M.usageSeries[(M.usageAt = (M.usageAt ?? -1) + 1) % M.usageSeries.length] : M.usage || []),
    ReleaseNotes: (id) => (M.releaseNotes?.[id] ? later(M.releaseNotes[id], 300) : Promise.reject(new Error('GitHub answered 503 Service Unavailable'))),
    SavingsHistory: () => later(M.savingsHistory || []),
    Storage: () => later(M.storage || { when: new Date(Date.now() - 5 * 3600e3).toISOString(), photos: [{ name: 'Anna Smith', email: 'anna@example.com', bytes: 412e9 }, { name: 'Ben Smith', email: 'ben@example.com', bytes: 168e9 }], apps: [{ app: 'paperless', bytes: 18.4e9 }, { app: 'navidrome', bytes: 2.1e9 }, { app: 'vaultwarden', bytes: 41e6 }] }),
    SettingTests: () => later(['ADGUARD_PASSWORD', 'ADGUARD_USER', 'BACKUP_DESTINATION', 'CLOUDFLARE_API_TOKEN', 'DUPLICATI_PASSWORD', 'HEARTBEAT_URL', 'MEDIA_ROOT', 'NPM_API_EMAIL', 'NPM_API_PASSWORD', 'NTFY_PHONE_PASSWORD', 'NTFY_PUBLISH_TOKEN', 'NTFY_READ_TOKEN', 'TUNNEL_TOKEN']),
    CopySetting: () => later(null),
    ChooseFolder: () => later(''),
    TestSetting: (key) => later(M.tests?.[key] || { key, ok: true, message: 'Accepted.' }, 300),
    async Homelab(action, target, apply) {
      (M.homelabRan ||= []).push(action);
      emit('cli:log', `$ homelab ${action}`);
      const steps = apply ? M.cliSteps?.[action] || [] : [];
      for (const [i, text] of steps.entries()) { await later(null, 80); emit('cli:step', { n: i + 1, total: steps.length, text }); }
      for (const line of M.cliLog[action] || ['Nothing to do.']) { await later(null, 80); emit('cli:log', line); }
      if (apply && M.jobApps?.[action]) await this.playApps(M.jobApps[action]);
    },
    // runSteps: the steps a setup step's command reports (cli:step), as Docker's setup does.
    RunSetup: async (id) => {
      (M.ran ||= []).push(id);
      for (const s of M.runSteps?.[id] || []) { await later(null, 200); emit('cli:step', s); }
      M.setup = M.setup.map((st) => (st.id === id && M.runMarksDone ? { ...st, state: 'done' } : st));
      return later(M.setup, M.runSteps?.[id] ? 800 : 600);
    },
    RunSetupChoice(id, i) { M.setup = M.setup.map((s) => (s.id === id ? { ...s, state: 'done', chosen: s.choices[i].label } : s)); return later(M.setup, 300); },
    // wireLinks: what the wiring reports, one link at a time.
    async Wire() { for (const l of M.wireLinks || []) { await later(null, 80); emit('link', l); } return later(M.wireLinks || []); },
    Phones: () => later(M.phones || []),
    People: () => later(M.people || []),
    PersonAction: (action, name, email, apps) => {
      M.people ||= [];
      if (action === 'add') M.people.push({ username: name.split(' ')[0].toLowerCase(), name, email, apps, added: new Date().toISOString(), removed: '0001-01-01T00:00:00Z' });
      if (action === 'remove') M.people = M.people.filter((p) => p.username !== name);
      M.personActions = [...(M.personActions || []), [action, name, email, apps]];
      emit('cli:log', `$ homelab person ${action} ${name}`);
      return later(null, 200);
    },
    QR: () => later(qrStandIn),
    OpenNativeApp: (id) => { M.openedNative = id; return later(null); },
    Background: () => later([
      { name: 'Start the apps after a restart', what: 'Waits for the container runtime and your drives, then starts the apps.', when: 'at login', label: 'com.homelab.startup', installed: true },
      { name: 'Nightly backup', what: 'Copies the databases and settings for the encrypted off-site backup.', when: 'daily at 03:30', label: 'com.homelab.backup', installed: true },
      { name: 'Menu bar icon', what: 'Shows how the homelab is doing and opens this app.', when: 'at login', label: 'tray', installed: false }]),
    Weekly: () => later(M.weekly || { title: 'Homelab this week: 1 thing to look at', body: '\u2713 22 apps running\n\u2713 Backups: 12 copies, all fresh\n\u2022 No restore test yet (Backups \u203a Test a restore)\n\u2713 3 attacks blocked', problems: 1 }),
    Move: (direction) => { M.moved = direction; emit('cli:log', `$ homelab move ${direction}`); return later(M.moveFile ?? '/Users/you/homelab-move.tar', 200); },
    OpenWelcome: (u) => { M.opened = u; return later(null); },
    PairPhone: (name, canChange) => later({ code: 'K7QX4MRA', links: ['https://homelab.example.com/#pair=K7QX4MRA', 'http://192.168.1.10:8099/#pair=K7QX4MRA'], qr: qrStandIn, off: false }),
    SetPhoneCanChange(id, on) { M.phones = M.phones.map((p) => (p.id === id ? { ...p, canChange: on } : p)); return later(M.phones); },
    RemovePhone(id) { M.phones = M.phones.filter((p) => p.id !== id); return later(M.phones); },
    Report: () => later({ text: 'Homelab report\n', helper: '' }, 300),
    AddCustom: () => later(M.catalog),
  } } };
  // Every call the page makes, by method (M.calls), for the checks that
  // count what a click asks the backend.
  const app = window.go.main.App;
  M.calls = {};
  for (const [name, fn] of Object.entries(app)) {
    if (typeof fn === 'function' && /^[A-Z]/.test(name)) app[name] = function (...args) { M.calls[name] = (M.calls[name] || 0) + 1; return fn.apply(this, args); };
  }
})();
