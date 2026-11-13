// The phone companion's bridge. homelab serve loads this before app.js in
// place of the desktop app's: each Go method becomes a request to the Mac,
// with the token this phone got when it was paired. Without a token it
// shows the pairing form instead of the screens.
(() => {
  const KEY = 'homelab.companion.token';
  const listeners = {};

  // Kiosk mode, for a TV or a wall screen: #kiosk in the address (kept, as
  // pairing drops the address's #), #kiosk=off to leave it. Status fills
  // the screen, without buttons, and the screen stays on.
  const KIOSK = 'homelab.companion.kiosk';
  let kiosk = false;
  try {
    const k = /(?:^|[#&])kiosk(=off)?(?:&|$)/.exec(location.hash);
    if (k) k[1] ? localStorage.removeItem(KIOSK) : localStorage.setItem(KIOSK, '1');
    kiosk = localStorage.getItem(KIOSK) === '1';
  } catch (e) { kiosk = /(?:^|[#&])kiosk(?:&|$)/.test(location.hash); }
  if (kiosk) document.documentElement.classList.add('kiosk');
  const emit = (name, data) => (listeners[name] || []).forEach((fn) => fn(data));
  let token = '';
  try { token = localStorage.getItem(KEY) || ''; } catch (e) { /* private browsing: pair each visit */ }

  window.runtime = {
    EventsOn(name, fn) {
      (listeners[name] ??= []).push(fn);
      return () => { listeners[name] = listeners[name].filter((f) => f !== fn); };
    },
    EventsEmit: emit,
  };

  // The last Status, offline: the answers Status is drawn from (Status
  // itself, and the computer, catalog and look it's drawn with) are kept
  // on this phone, with when. When the computer can't be reached (away
  // from home, Tailscale off), they answer instead, and a line at the top
  // says Status is from then; the next Status that comes through puts it
  // away. Nothing else is kept, and all of it goes when the phone is unpaired.
  const LAST = 'homelab.companion.lastStatus';
  const KEPT = ['StatusBoard', 'Host', 'Catalog', 'Appearance'];
  const keptAll = () => { try { return JSON.parse(localStorage.getItem(LAST) || 'null'); } catch (e) { return null; } };
  const keep = (method, result) => {
    const all = keptAll() || { answers: {} };
    all.answers[method] = result;
    if (method === 'StatusBoard') all.at = new Date().toISOString();
    try { localStorage.setItem(LAST, JSON.stringify(all)); } catch (e) { /* not kept */ }
  };
  function away(at) {
    document.documentElement.classList.toggle('away', !!at);
    const note = document.getElementById('awayNote');
    if (!note) return;
    note.hidden = !at;
    if (!at) return;
    const t = new Date(at);
    const today = t.toDateString() === new Date().toDateString();
    const when = t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + (today ? '' : ', ' + t.toLocaleDateString([], { weekday: 'long' }));
    note.textContent = `The homelab can't be reached from here (at home, or with Tailscale on, it can). This is Status as it was at ${when}.`;
  }
  // What a call answers while the computer can't be reached.
  function whileAway(method, e) {
    const all = keptAll();
    if (all?.at && method in all.answers) {
      if (method === 'StatusBoard') away(all.at);
      return all.answers[method];
    }
    if (all?.at && method === 'Screen') return ''; // nothing was asked to open
    const err = new Error("The homelab can't be reached from here: at home, or with Tailscale on, it can.");
    err.name = 'Away'; // the page leaves it to the line at the top (core.ts's showError)
    err.cause = e;
    throw err;
  }

  const never = new Promise(() => {});
  async function call(method, args) {
    if (!token) return never; // the pairing form is showing
    let r;
    try {
      r = await fetch('api/call/' + method, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(args),
        // A computer that can't be reached may not refuse at once: Status waits 20 seconds for it.
        signal: method === 'StatusBoard' && AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined,
      });
    } catch (e) {
      return whileAway(method, e);
    }
    if (r.ok && (r.headers.get('Content-Type') || '').startsWith('application/x-ndjson')) {
      const result = lines(r);
      if (method === 'StatusBoard') result.then((st) => { keep(method, st); away(''); }, () => {});
      return result;
    }
    const body = await r.json().catch(() => ({}));
    (body.log || []).forEach((line) => emit('cli:log', line));
    if (r.status === 401) { forget(); return never; }
    if (!r.ok) {
      const err = new Error(body.error || r.statusText);
      // Not served to phones (or not by this computer's version): the page
      // can tell that from a failure (core.ts's notOnPhone).
      if (r.status === 404) err.name = 'NotOnPhone';
      throw err;
    }
    if (KEPT.includes(method)) keep(method, body.result);
    return body.result;
  }

  // An answer in lines (StatusBoard): the result, and events before or
  // after it, each emitted as it comes; the call is answered with the
  // result while the events still come.
  function lines(r) {
    return new Promise((resolve, reject) => {
      const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = '';
      let answered = false;
      const line = (l) => {
        if (!l.trim()) return;
        let m;
        try { m = JSON.parse(l); } catch (e) { return; }
        if ('event' in m) emit(m.event, m.data);
        else if (!answered) {
          answered = true;
          'error' in m ? reject(new Error(m.error)) : resolve(m.result);
        }
      };
      (async () => {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += value;
          for (let i; (i = buf.indexOf('\n')) >= 0;) {
            line(buf.slice(0, i));
            buf = buf.slice(i + 1);
          }
        }
        line(buf);
        if (!answered) reject(new Error('the answer ended early'));
      })().catch((e) => { if (!answered) reject(e); });
    });
  }

  window.go = { main: { App: new Proxy({}, {
    get: (_, method) => (method === 'Open'
      ? (url) => { window.open(url, '_blank', 'noopener'); }
      : (...args) => call(method, args)),
  }) } };

  function forget() {
    token = '';
    try { localStorage.removeItem(KEY); localStorage.removeItem(LAST); } catch (e) { /* nothing kept */ }
    pairForm('This phone is not paired, or it was removed on the Mac.');
  }

  // The pairing form: the code from `homelab phone pair` (or the QR code),
  // filled in from the link's #pair=CODE.
  function pairForm(note) {
    document.documentElement.classList.add('unpaired');
    let box = document.getElementById('pairBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'pairBox';
      box.className = 'pairbox';
      box.innerHTML = '<div class="card"><h1>' + (kiosk ? 'Pair this screen' : 'Pair this phone') + '</h1>'
        + '<p class="lead">On the computer, run <code>./homelab phone pair</code> (or open Homelab Wizard › Settings › Phones), then enter the code it shows.</p>'
        + '<label class="field">Code <input id="pairCode" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false"></label>'
        + '<label class="field">Name for this phone <input id="pairName" placeholder="Anna’s iPhone"></label>'
        + '<button id="pairBtn" class="primary">Pair</button><p id="pairNote" class="muted"></p></div>';
      document.body.append(box);
      document.getElementById('pairBtn').onclick = pair;
    }
    const m = /(?:^|[#&])pair=([A-Za-z0-9]+)/.exec(location.hash);
    if (m) document.getElementById('pairCode').value = m[1];
    document.getElementById('pairNote').textContent = note || '';
  }

  async function pair() {
    const btn = document.getElementById('pairBtn');
    const note = document.getElementById('pairNote');
    btn.disabled = true;
    note.textContent = 'Pairing…';
    try {
      const r = await fetch('api/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: document.getElementById('pairCode').value, name: document.getElementById('pairName').value, kiosk }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || r.statusText);
      try { localStorage.setItem(KEY, body.token); } catch (e) { /* kept for this visit only */ }
      history.replaceState(null, '', location.pathname);
      location.reload();
    } catch (e) {
      note.textContent = String(e.message || e);
      btn.disabled = false;
    }
  }

  // Who this phone is: whether it may make changes (start, stop, back up),
  // and whether it sees Finances (the screen itself says if it may change them).
  // The answer is window.phoneMe too: a member's private Finances need whose phone it is.
  let told;
  window.phoneMe = new Promise((r) => { told = r; });
  async function me() {
    const r = await fetch('api/me', { headers: { Authorization: 'Bearer ' + token } });
    if (r.status === 401) return forget();
    const d = await r.json().catch(() => ({}));
    told(d);
    document.documentElement.classList.toggle('can-change', !!d.canChange);
    document.documentElement.classList.toggle('finances', !kiosk && (d.finances === 'view' || d.finances === 'edit'));
    // The money card on Status: a phone allowed only it, or a wall screen allowed it or more.
    document.documentElement.classList.toggle('wallcard', d.finances === 'card' || (kiosk && (d.finances === 'view' || d.finances === 'edit')));
    const foot = document.getElementById('foot');
    if (foot && d.name) foot.dataset.phone = d.name;
  }

  // Finances read forward on this phone (cmd/financewasm), for a household
  // member's private Finances, which the computer can't open: the Go runner
  // and finance.wasm, loaded the first time they're wanted. finances/privacy.ts calls it.
  let projection = null;
  window.phoneProjection = () => (projection ??= new Promise((ok, no) => {
    if (window.homelabFinance || window.Go) return ok();
    const s = document.createElement('script');
    s.src = 'wasm_exec.js';
    s.onload = ok;
    s.onerror = () => no(new Error('no wasm_exec.js'));
    document.head.append(s);
  }).then(async () => {
    if (window.homelabFinance) return;
    const g = new window.Go();
    const r = await WebAssembly.instantiateStreaming(fetch('finance.wasm'), g.importObject);
    g.run(r.instance); // sets window.homelabFinance, then waits for its calls
  }).catch((e) => { projection = null; throw e; }));

  // Status follows the computer's engine (api/events), as on the computer:
  // each change comes as status:changed. fetch reads the stream, since it
  // can send the token; it starts again a few seconds after it ends.
  async function follow() {
    for (;;) {
      try {
        const r = await fetch('api/events', { headers: { Authorization: 'Bearer ' + token } });
        if (r.status === 401) return forget();
        if (r.status === 404) return; // a computer from before the stream
        if (r.ok && r.body) {
          const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
          let buf = '';
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += value;
            for (let i; (i = buf.indexOf('\n\n')) >= 0;) {
              const data = buf.slice(0, i).split('\n').find((l) => l.startsWith('data: '));
              buf = buf.slice(i + 2);
              // A page the computer sent this phone (Send to my phone) comes as phone:open, every other change as status:changed.
              if (data) { try { const c = JSON.parse(data.slice(6)); if (c.open) emit('phone:open', c.open); else emit('status:changed', c); } catch (e) { /* not a change */ } }
            }
          }
        }
      } catch (e) { /* the computer is away: try again */ }
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  // A screen on the wall stays on while the page shows, where the browser
  // can (it lets go when the page is hidden, so ask again on return).
  async function stayAwake() {
    try { if (navigator.wakeLock && document.visibilityState === 'visible') await navigator.wakeLock.request('screen'); } catch (e) { /* not offered here */ }
  }

  // The time, large in the corner, so a wall screen is also a clock and
  // shows at a glance that it is live.
  function clock() {
    const el = document.createElement('div');
    el.id = 'kioskClock';
    el.setAttribute('aria-hidden', 'true');
    document.body.append(el);
    const tick = () => { el.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
    tick();
    setInterval(tick, 10000);
  }

  // The page itself, for when the computer can't be reached (sw.js). A
  // service worker needs HTTPS, so a phone on the computer's plain address
  // at home has none, and needs none there.
  if (navigator.serviceWorker && window.isSecureContext) navigator.serviceWorker.register('sw.js').catch(() => {});

  window.addEventListener('DOMContentLoaded', () => {
    if (!token) return pairForm(kiosk ? 'Pair this screen as you would a phone; it then shows Status only.' : '');
    me().catch(() => told({})); // away: not known, so Finances answer as the computer does
    follow();
    if (kiosk) {
      clock();
      stayAwake();
      document.addEventListener('visibilitychange', stayAwake);
    }
  });
})();
