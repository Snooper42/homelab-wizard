// The phone companion's bridge. homelab serve loads this before app.js in
// place of the desktop app's: each Go method becomes a request to the Mac,
// with the token this phone got when it was paired. Without a token it
// shows the pairing form instead of the screens.
(() => {
  const KEY = 'homelab.companion.token';
  const listeners = {};
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
      box.innerHTML = '<div class="card"><h1>Pair this phone</h1>'
        + '<p class="lead">On the Mac, run <code>./homelab phone pair</code> (or open Homelab Wizard › Settings › Phones), then enter the code it shows.</p>'
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

  window.addEventListener('DOMContentLoaded', () => {
    if (!token) return pairForm();
    me().catch(() => {});
  });
})();
