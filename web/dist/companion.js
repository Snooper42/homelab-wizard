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

  const never = new Promise(() => {});
  async function call(method, args) {
    if (!token) return never; // the pairing form is showing
    const r = await fetch('api/call/' + method, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(args),
    });
    const body = await r.json().catch(() => ({}));
    (body.log || []).forEach((line) => emit('cli:log', line));
    if (r.status === 401) { forget(); return never; }
    if (!r.ok) throw new Error(body.error || r.statusText);
    return body.result;
  }

  window.go = { main: { App: new Proxy({}, {
    get: (_, method) => (method === 'Open'
      ? (url) => { window.open(url, '_blank', 'noopener'); }
      : (...args) => call(method, args)),
  }) } };

  function forget() {
    token = '';
    try { localStorage.removeItem(KEY); } catch (e) { /* nothing kept */ }
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
        body: JSON.stringify({ code: document.getElementById('pairCode').value, name: document.getElementById('pairName').value }),
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

  // Who this phone is: whether it may make changes (start, stop, back up).
  async function me() {
    const r = await fetch('api/me', { headers: { Authorization: 'Bearer ' + token } });
    if (r.status === 401) return forget();
    const d = await r.json().catch(() => ({}));
    document.documentElement.classList.toggle('can-change', !!d.canChange);
    const foot = document.getElementById('foot');
    if (foot && d.name) foot.dataset.phone = d.name;
  }

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
              if (data) { try { emit('status:changed', JSON.parse(data.slice(6))); } catch (e) { /* not a change */ } }
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

  window.addEventListener('DOMContentLoaded', () => {
    if (!token) return pairForm(kiosk ? 'Pair this screen as you would a phone; it then shows Status only.' : '');
    me().catch(() => {});
    follow();
    if (kiosk) {
      clock();
      stayAwake();
      document.addEventListener('visibilitychange', stayAwake);
    }
  });
})();
