// Redesign mock of the phone's page (homelab serve, docs/Redesign.md › The phone's page): how far the web page can go
// toward the Homelab app, on a server's homelab (tailnet only, with apps added as your own). Four pictures: Status on a
// phone added to the Home Screen, with alerts offered; an app's own page; an alert on the Lock Screen through Web Push;
// and the same page on a tablet or a wide window, with the sidebar laid out as the computer's (the screens as a strip
// of icons, then Status' own menu). Mocks only: nothing here is the app's code.
import { writeFileSync } from 'node:fs';
import { repo, out, icon, P } from './lib.mjs';
import { deskCss } from './finances.mjs';
import { phoneCss, sb, ch, appLogo } from './phone.mjs';

Object.assign(P, {
  gear: P.gear || 'c12,12,3',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  play: 'M7 4.5v15l12-7.5z', logs: 'M4 6h16M4 12h16M4 18h10', stop: 'M6 6h12v12H6z',
  restart: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5',
  history: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5M12 7v5l4 2',
  drive: 'M22 12H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11ZM6 16h.01M10 16h.01',
  lock: 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2ZM7 11V7a5 5 0 0 1 10 0v4',
  x: 'M18 6 6 18M6 6l12 12', box: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  flash: 'M18 6c0 2-2 2-2 4v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V10c0-2-2-2-2-4V2h12zM6 6h12M12 12v.01', camera: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z|c12,13,3',
});

// His homelab (the server of the README's questions): the apps he picked, and his own apps added with `homelab custom add`.
const own = (letters, bg, s) => `<span class="alogo own" style="width:${s}px;height:${s}px;background:${bg};font-size:${s * 0.36}px">${letters}</span>`;
// Your own apps' logos: each project's own icon (app/preview/redesign/logos/: Jellystat from dashboard-icons, the rest from
// project's repository or the dashboard-icons set), on its own background; else the letters. The real page reads
// each app's icon from the app itself (its favicon or web manifest, on this machine), so none is a letter for long.
const ownLogos = { JS: ['jellystat', '#0b0b12'], JF: ['jfa-go', '#ffffff'], AS: ['aiostreams', '#111827'], DP: ['decypharr', '#ffffff', 0.96], AM: ['aiometadata', '#ffffff', 0.8] };
const ownImg = (letters, s) => { const [f, bg, k = 0.72] = ownLogos[letters]; return `<span class="alogo own" style="width:${s}px;height:${s}px;background:${bg}"><img src="file://${repo}/app/preview/redesign/logos/${f}.png" width="${Math.round(s * k)}" height="${Math.round(s * k)}" style="display:block"></span>`; };
const logoOf = (id, s) => { if (!id.startsWith('own:')) return appLogo(id, s); const [l, bg] = id.slice(4).split(','); return ownLogos[l] ? ownImg(l, s) : own(l, bg, s); };
const groups = [
  ['Security', [['vaultwarden', 'Vaultwarden'], ['pocket-id', 'Pocket ID'], ['uptime-kuma', 'Uptime Kuma'], ['ntfy', 'ntfy']], 4],
  ['Cloud & Files', [['immich-server', 'Immich'], ['nextcloud', 'Nextcloud']], 2],
  ['Documents', [['paperless', 'Paperless-ngx']], 1],
  ['Media', [['jellyfin-container', 'Jellyfin'], ['own:JS,#7c3aed', 'Jellystat'], ['own:JF,#0e7490', 'jfa-go']], 3],
  ['Your own apps', [['own:AS,#2563eb', 'AIOStreams'], ['own:AM,#db2777', 'AIOMetadata'], ['own:DP,#ea580c', 'Decypharr'], ['own:RX,#16a34a', 'Remux']], 3],
  ['System', [['duplicati', 'Duplicati'], ['kopia', 'Kopia'], ['homelab-companion', 'Phone companion']], 3],
  ['Network', [['tailscale', 'Tailscale']], 1],
];
const total = groups.reduce((a, g) => a + g[1].length, 0), up = groups.reduce((a, g) => a + g[2], 0);
const host = 'homelab.tail3c9e.ts.net';
const stack = (apps, s) => `<span class="stack">${apps.slice(0, 3).map(([id]) => logoOf(id, s)).join('')}</span>`;
const namesOf = (g) => (g[0] === 'Your own apps' ? 'Decypharr stopped · AIOStreams +2' : g[1].length > 2 ? `${g[1][0][1]}, ${g[1][1][1]} +${g[1].length - 2}` : g[1].map((a) => a[1]).join(', '));
const running = (n, all) => `<span class="chip ${n === all ? 'up' : 'warn'}">${n === all ? icon('check', 12) + n + ' running' : n + ' of ' + all + ' running'}</span>`;
const nights = ['Th', 'F', 'Sa', 'Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa', 'Su', 'M', 'Tu', 'W'];
const strip = (n = 14) => `<div class="nights">${nights.slice(-n).map((d, i, a) => `<div><i></i><span${i === a.length - 1 ? ' class="b"' : ''}>${d}</span></div>`).join('')}</div>`;

const extra = `
.alogo.own{display:inline-grid;place-items:center;overflow:hidden;box-shadow:0 0 0 1px var(--line);color:#fff;font-weight:700;border-radius:9px;box-shadow:none}
.nights{display:flex;gap:4px;margin-top:12px}.nights div{flex:1;display:grid;gap:4px;justify-items:center}.nights i{display:block;width:100%;height:20px;border-radius:5px;background:var(--in);opacity:.85}
.nights span{font-size:10px;color:var(--muted)}.nights span.b{font-weight:700;color:var(--text)}
.chip.warn{background:var(--warn-soft,#fff4e0);color:var(--warn,#b45309)}
`;

// ---------- Status on the phone, added to the Home Screen ----------
const tabs = (on) => `<nav class="tabs">${[['activity', 'Status', 1], ['archive', 'Backups'], ['gear', 'Settings']].map(([i, n, b]) => `<span class="${n === on ? 'on' : ''}">${icon(i, 23)}${n}${b ? `<em>${b}</em>` : ''}</span>`).join('')}</nav>`;
const phone = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>${phoneCss}${extra}</style></head><body>${sb}${body}</body></html>`;
const status = `
<div class="nav"><span style="flex:1"></span><span class="gb">${icon('search', 20)}</span><span class="gb">${icon('sync', 20)}</span></div>
<h1>Status</h1>
<div class="sub"><i class="live"></i>The server · live</div>
<div class="note"><span style="color:var(--acc)">${icon('bell', 22)}</span><div class="n"><b>Alerts on this phone</b><small>When an app stops or a backup fails, even with this page closed</small></div><button class="btn pri">Turn on</button></div>
<section class="card">
  <div class="row" style="padding-top:0;border-top:0">${logoOf('own:DP,#ea580c', 44)}<div class="n"><b style="font-size:18px">Decypharr stopped</b><small>20 minutes ago · ${up} of ${total} running</small></div></div>
  <div style="display:flex;gap:8px;margin-top:4px"><button class="btn pri" style="flex:1">${icon('play', 14)}Start</button><button class="btn" style="flex:1">${icon('logs', 15)}Logs</button><button class="btn" style="flex:1">Its page</button></div>
</section>
<div class="two">
  <section class="card">${ch('Backups')}<div class="fig md">17<small style="font-size:15px"> of 17</small></div><div class="muted" style="font-size:12.5px;margin-top:4px">Last night at 3:30<br>Off-site to Hetzner</div></section>
  <section class="card">${ch('The server')}<div class="fig md">3.4<small style="font-size:15px"> TB free</small></div><div class="muted" style="font-size:12.5px;margin-top:4px">Both disks healthy<br>Updates tonight, 4:00</div></section>
</div>
<div class="dayh"><span>Apps</span><span>${total}</span></div>
<div class="list">
  ${groups.map((g) => `<div class="row">${stack(g[1], 28)}<div class="n"><b>${g[0]}</b><small>${namesOf(g)}</small></div><div class="a" style="display:flex;align-items:center;gap:6px">${running(g[2], g[1].length)}<span class="muted">${icon('right', 16)}</span></div></div>`).join('')}
</div>
${tabs('Status')}`;
writeFileSync(out + 'web-status.html', phone(status));

// ---------- An app's own page ----------
const week = [100, 100, 100, 97, 100, 100, 100];
const appPage = `
<div class="nav"><span class="who" style="padding:0 14px 0 8px;color:var(--acc)">${icon('left', 20)}Status</span><span style="flex:1"></span><span class="gb">${icon('open', 19)}</span></div>
<div style="display:flex;align-items:center;gap:14px;margin:8px 20px 4px">${appLogo('immich-server', 56)}<div style="display:grid;gap:2px"><h1 style="margin:0;font-size:30px">Immich</h1><div class="sub" style="margin:0"><i class="live"></i>Running · up 6 days</div></div></div>
<div class="sub" style="margin:6px 20px 14px">${icon('lock', 13)}<span>photos.${host.split('.').slice(1).join('.')}</span></div>
<div style="display:flex;gap:8px;margin:0 16px 14px"><button class="btn pri" style="flex:1.3">${icon('open', 15)}Open</button><button class="btn" style="flex:1">${icon('restart', 15)}Restart</button><button class="btn" style="flex:1">${icon('logs', 15)}Logs</button><button class="btn" style="width:44px;padding:0">${icon('stop', 13)}</button></div>
<section class="card">${ch('This week')}
  <div class="figrow"><div><div class="fig md">99.6<small style="font-size:15px">% up</small></div><div class="lab">Down 40 minutes on Sunday</div></div><span class="chip up">${icon('check', 12)}Answering</span></div>
  <div style="display:flex;gap:5px;margin-top:12px">${week.map((v, i) => `<div style="flex:1;display:grid;gap:4px;justify-items:center"><i style="display:block;width:100%;height:20px;border-radius:5px;background:${v === 100 ? 'var(--in)' : 'var(--warn)'};opacity:.85"></i><span style="font-size:10px;color:var(--muted)">${['Th', 'F', 'Sa', 'Su', 'M', 'Tu', 'W'][i]}</span></div>`).join('')}</div>
</section>
<section class="card">${ch('Backups', 'Get something back')}
  <div class="figrow"><div><div class="fig md">Last night</div><div class="lab">Copied at 3:41 AM</div></div><span class="chip up">${icon('check', 12)}7 of 7 nights</span></div>
  <div class="muted" style="font-size:13px;margin-top:8px">61 MB database and 412 GB of photos, to Hetzner, with a second copy in Kopia</div>
</section>
<section class="card">${ch('Last update')}
  <div class="row" style="padding-top:2px"><span class="sico" style="width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:var(--acc-soft);color:var(--acc)">${icon('box', 19)}</span><div class="n"><b>v2.3.1 → v2.4.0</b><small>Last night at 4:02</small></div><button class="btn">${icon('history', 14)}Roll back</button></div>
</section>
<section class="card">${ch('Uses')}
  <div class="trio" style="margin-top:0"><div><span>Memory</span><b>1.9 GB</b></div><div><span>Processor</span><b>2%</b></div><div><span>On disk</span><b>412 GB</b></div></div>
</section>
${tabs('Status')}`;
writeFileSync(out + 'web-app.html', phone(appPage));

// ---------- An alert on the Lock Screen (Web Push, from the page added to the Home Screen) ----------
const lockCss = `
*{box-sizing:border-box}html,body{margin:0}body{width:390px;height:844px;overflow:hidden;font:15px/1.3 Inter,system-ui,sans-serif;color:#fff;-webkit-font-smoothing:antialiased;
background:radial-gradient(120% 70% at 20% 10%,#5b3fd6 0%,transparent 60%),radial-gradient(90% 60% at 90% 80%,#0e7490 0%,transparent 60%),linear-gradient(#1b1340,#081621)}
@media (prefers-color-scheme:light){body{background:radial-gradient(120% 70% at 20% 10%,#a78bfa 0%,transparent 60%),radial-gradient(90% 60% at 90% 80%,#67e8f9 0%,transparent 60%),linear-gradient(#6d4ae0,#0e7490)}}
.sb{height:54px;display:flex;align-items:center;justify-content:flex-end;padding:0 30px;position:relative}.island{position:absolute;left:50%;top:11px;transform:translateX(-50%);width:124px;height:36px;background:#000;border-radius:20px}
.lockic{display:grid;justify-items:center;margin-top:6px;opacity:.9}
.date{text-align:center;font-size:20px;font-weight:600;margin-top:8px;opacity:.92}.time{text-align:center;font-size:96px;font-weight:700;letter-spacing:-.03em;line-height:1;margin-top:2px}
.ns{position:absolute;left:10px;right:10px;bottom:132px;display:grid;gap:8px}
.n{display:flex;gap:11px;padding:12px 14px;border-radius:22px;background:rgba(245,245,247,.72);color:#0b0b0f;backdrop-filter:blur(30px)}
@media (prefers-color-scheme:dark){.n{background:rgba(40,40,46,.72);color:#f5f5f7}}
.n img{width:38px;height:38px;border-radius:9px;flex:none}.n .t{flex:1;display:grid;gap:1px;min-width:0}.n .h{display:flex;justify-content:space-between}.n .h b{font-size:15px}.n .h span{font-size:13px;opacity:.6}.n p{margin:0;font-size:15px;line-height:1.28}
.n.dim{transform:scale(.95);opacity:.85;margin-top:-4px}
.q{position:absolute;bottom:44px;left:46px;right:46px;display:flex;justify-content:space-between}.q span{width:50px;height:50px;border-radius:50%;background:rgba(0,0,0,.35);display:grid;place-items:center;backdrop-filter:blur(20px)}
.bar{position:absolute;bottom:9px;left:50%;transform:translateX(-50%);width:140px;height:5px;border-radius:3px;background:#fff}`;
const icon180 = `file://${repo}/web/dist/icon-180.png`;
const lock = `<!doctype html><html><head><meta charset="utf-8"><style>${lockCss}</style></head><body>
<div class="sb"><span class="island"></span></div>
<div class="lockic">${icon('lock', 18)}</div>
<div class="date">Wednesday, November 25</div><div class="time">9:41</div>
<div class="ns">
  <div class="n"><img src="${icon180}"><div class="t"><div class="h"><b>Decypharr stopped</b><span>now</span></div><p>The debrid service didn't answer. Open to start it again.</p></div></div>
  <div class="n dim"><img src="${icon180}"><div class="t"><div class="h"><b>Last night's backup</b><span>3:41 AM</span></div><p>17 of 17 copied, encrypted to Hetzner. Kopia's copy too.</p></div></div>
</div>
<div class="q"><span>${icon('flash', 22)}</span><span>${icon('camera', 22)}</span></div><div class="bar"></div>
</body></html>`;
writeFileSync(out + 'web-push.html', lock);

// ---------- On a tablet or a wide window: the computer's sidebar ----------
const wideCss = `
/* The same soft backdrop and see-through cards as a category's page (the tester liked the soft purple, Nov 25). */
.ov{--glass:rgba(255,255,255,.62);--glassline:rgba(255,255,255,.75);min-height:100vh;background:radial-gradient(60% 55% at 15% 0%,#e9e3ff,transparent 70%),radial-gradient(55% 60% at 100% 100%,#dff3f6,transparent 70%),var(--bg)}
@media (prefers-color-scheme:dark){.ov{--glass:rgba(255,255,255,.05);--glassline:rgba(255,255,255,.09);background:radial-gradient(60% 55% at 15% 0%,rgba(124,92,255,.22),transparent 70%),radial-gradient(55% 60% at 100% 100%,rgba(14,116,144,.2),transparent 70%),var(--bg)}}
.ov .card{background:var(--glass);border-color:var(--glassline);backdrop-filter:blur(18px);box-shadow:none}.ov .top{background:transparent}.ov .search,.ov .sq{background:var(--glass);border-color:var(--glassline)}

/* The overview's top cards share one anatomy (the owner, Nov 25: never three cards built three ways): a title row,
   one figure on the same line in every card, one line under it, and a footer pinned to the bottom at the same height. */
.grid .card.k{display:flex;flex-direction:column;gap:0;min-height:216px}
.k .kh{display:flex;align-items:baseline;gap:8px;margin-bottom:14px}.k .kh h3{margin:0;flex:1;font-size:14.5px;font-weight:600}.k .kh span{font-size:12.5px;color:var(--muted)}
.k .kf{display:flex;align-items:center;gap:10px;height:40px;font-size:30px;font-weight:650;letter-spacing:-.02em;font-variant-numeric:tabular-nums;white-space:nowrap}.k .kf small{font-size:15px;font-weight:600;color:var(--muted);letter-spacing:0;margin-left:2px;align-self:flex-end;padding-bottom:7px}.k .kf .alogo,.k .kf .own{border-radius:9px}.k .kf span{font-size:26px}
.k .ks .alogo,.k .ks .own{vertical-align:-3px;margin-right:4px;border-radius:4px}.k .ks{margin-top:6px;font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.k .kb{margin-top:auto;padding-top:16px;height:54px;display:flex;align-items:flex-end;gap:8px}.k .kb .cta{flex:1;height:34px}.k .kb .cta.sqb{flex:none;width:38px;padding:0}
.k .kb .nights{margin:0;width:100%}.k .kb .nights div{gap:0}.k .kb .nights i{height:34px;border-radius:7px}
.k .kbar{flex-direction:column;align-items:stretch;justify-content:flex-end;gap:8px}.k .kbar .bar2{margin:0;height:10px;border-radius:99px;background:var(--sunken);overflow:hidden}.k .kbar .bar2 i{display:block;height:100%;background:var(--acc);border-radius:99px}.k .kbar span{font-size:12.5px;color:var(--muted)}

.side .foot .synced{padding:0 6px}
.apps span{position:relative}.apps em{position:absolute;top:-4px;right:6px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#fdeee6;color:#c2410c;font:700 10px/16px Inter,system-ui;text-align:center}
@media (prefers-color-scheme:dark){.apps em{background:#2f1a15;color:#ff8a73}}
.fnav a .cnt{margin-left:auto;font-size:11.5px;font-weight:700;padding:1px 7px;border-radius:99px;background:#fdeee6;color:#c2410c}@media (prefers-color-scheme:dark){.fnav a .cnt{background:#2f1a15;color:#ff8a73}}
.fnav a .n{margin-left:auto;color:var(--muted);font-size:12.5px}.fnav a .sdot{margin-left:auto;width:8px;height:8px;border-radius:50%;background:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,.18)}.fnav a .sdot+.n{margin-left:10px}
.alogo{border-radius:8px;flex:none;background:#fff;box-shadow:0 0 0 1px var(--line)}
.stack{display:flex}.stack img,.stack .own{margin-left:-7px;border:2px solid var(--panel);box-sizing:content-box}.stack>:first-child{margin-left:0}
.warnfig{color:#b45309}@media (prefers-color-scheme:dark){.warnfig{color:#fbbf24}}
.cta{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:34px;padding:0 14px;border-radius:9px;font-weight:600;font-size:13px;border:1px solid var(--line2);background:var(--panel);color:var(--text)}.cta.pri{background:var(--acc);border-color:var(--acc);color:#fff}
@media (prefers-color-scheme:dark){.cta.pri{color:#140c33}}
.search{display:flex;align-items:center;gap:8px;height:38px;width:280px;padding:0 12px;border-radius:10px;border:1px solid var(--line);background:var(--panel);color:var(--muted);font-size:13px}
.grow{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--line)}.grow:first-child{border-top:0}.grow .n{flex:1;min-width:0;display:grid}.grow .n b{font-weight:600}.grow .n small{color:var(--muted);font-size:12.5px}
`;
// Status' menu: Overview, then each category, your own apps last (never a +: it read as "add an app" in the middle
// of the list). No Stopped item (the owner, Nov 25): a category holding a stopped app shows an amber dot by its count.
const sideOrder = [...groups.filter((g) => g[0] !== 'Your own apps'), ...groups.filter((g) => g[0] === 'Your own apps')];
// Analytics under Overview (the owner, Nov 25): the machine's numbers (processor, memory, drives, what each app uses) get
// a screen of their own, mocked on another account; a category's page is only its apps.
const sideMenu = [['grid', 'Overview', ''], ['chart', 'Analytics', ''], ...sideOrder.map((g) => [{ Security: 'shield', 'Cloud & Files': 'cloud', Documents: 'file', Media: 'film', 'Your own apps': 'box', System: 'server', Network: 'globe' }[g[0]], g[0], g[1].length])];
Object.assign(P, {
  warn: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4M12 17h.01',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', cloud: 'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6', film: 'M2 2h20v20H2zM7 2v20M17 2v20M2 12h20',
  server: 'M2 2h20v8H2zM2 14h20v8H2zM6 6h.01M6 18h.01', globe: 'c12,12,10|M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
});
Object.assign(P, { chart: 'M3 3v18h18M7 15l4-4 3 3 5-6' });
const sideFor = (here, stopped = []) => `
<aside class="side">
  <div class="brand"><img src="file://${repo}/assets/logo.svg" width="26" height="26"><div><b>Homelab Wizard</b></div></div>
  <nav class="apps" aria-label="Homelab">${[['activity', 'Status', 1], ['archive', 'Backups'], ['layers', 'Choose apps']].map(([i, n, b]) => `<span class="${n === 'Status' ? 'on' : ''}" title="${n}">${icon(i, 17)}${b ? `<em>${b}</em>` : ''}</span>`).join('')}</nav>
  <nav class="fnav">${sideMenu.map(([i, n, c]) => `<a class="${n === here ? 'on' : ''}">${icon(i, 17)}<span>${n}</span>${stopped.includes(n) ? '<i class="sdot"></i>' : ''}${c ? `<span class="n">${c}</span>` : ''}</a>`).join('')}</nav>
  <div style="flex:1"></div>
  <nav class="fnav"><a>${icon('gear', 17)}<span>Settings</span></a></nav>
  <div class="foot"><div class="synced"><i></i>Linux · 0.42.8 · 3.4 TB free</div></div>
</aside>`;
const wideSide = sideFor('Overview', ['Your own apps']);
Object.assign(P, { dots: 'c5,12,1|c12,12,1|c19,12,1' });
// The first card is always Apps (the owner, Nov 25: a card about one stopped app has nothing to say once it starts).
// The same anatomy in both states: all well, the figure is how many run and the footer the last fourteen days (a day
// any app was down is amber); something stopped, the figure turns amber, the line names it, and the footer becomes
// its Start and Logs (two or more: Start all and See them). Start it, and the card goes back without moving.
const days14 = (amber = []) => `<div class="nights">${Array.from({ length: 14 }, (_, i) => `<div><i${amber.includes(i) ? ' style="background:#f59e0b"' : ''}></i></div>`).join('')}</div>`;
const appsCardFor = (stopped) => stopped ? `<section class="card k">
    <div class="kh"><h3>Apps</h3><span>Checked 2 min ago</span></div>
    <div class="kf warnfig">${up}<small>of ${total} running</small></div>
    <div class="ks">${logoOf('own:DP,#ea580c', 16)} Decypharr stopped 20 min ago</div>
    <div class="kb"><span class="cta pri">${icon('play', 13)}Start</span><span class="cta">${icon('logs', 14)}Logs</span><span class="cta sqb">${icon('dots', 16)}</span></div>
  </section>` : `<section class="card k">
    <div class="kh"><h3>Apps</h3><span>Checked 2 min ago</span></div>
    <div class="kf">${total}<small>running</small></div>
    <div class="ks">All answering · 1 outage in 14 days</div>
    <div class="kb">${days14([9])}</div>
  </section>`;
let appsCard = appsCardFor(true);
const wide = `
<header class="top"><h2 style="margin:0;font-size:24px;font-weight:700;letter-spacing:-.01em;flex:1">Status</h2><div class="search">${icon('search', 15)}Find an app</div><button class="sq">${icon('sync', 17)}</button></header>
<div class="grid">
  ${appsCard}
  <section class="card k">
    <div class="kh"><h3>Backups</h3><span>Every night at 3:30</span></div>
    <div class="kf">17<small>of 17 copied</small></div>
    <div class="ks">Last night · encrypted to Hetzner · Kopia too</div>
    <div class="kb">${strip(14).replace(/<span[^>]*>[^<]*<\/span>/g, '')}</div>
  </section>
  <section class="card k">
    <div class="kh"><h3>The server</h3><span>Up 23 days</span></div>
    <div class="kf">3.4<small>TB free</small></div>
    <div class="ks">Both disks healthy · updates tonight at 4:00</div>
    <div class="kb kbar"><div class="bar2"><i style="width:34%"></i></div><span>Memory · 11 of 32 GB</span></div>
  </section>
  <section class="card" style="grid-column:1/-1;padding-top:8px;padding-bottom:8px">
    <div style="display:grid;grid-template-columns:1fr 1fr;column-gap:36px">
      ${groups.map((g) => `<div class="grow">${stack(g[1], 26)}<div class="n"><b>${g[0]}</b><small>${namesOf(g)}</small></div>${running(g[2], g[1].length)}<span class="muted">${icon('right', 15)}</span></div>`).join('')}
    </div>
  </section>
</div>`;
writeFileSync(out + 'web-wide.html', `<!doctype html><html><head><meta charset="utf-8"><title>Status</title><style>${deskCss}${extra}${wideCss}</style></head><body>${wideSide}<main class="ov">${wide}</main></body></html>`);
writeFileSync(out + 'web-wide-ok.html', `<!doctype html><html><head><meta charset="utf-8"><title>Status</title><style>${deskCss}${extra}${wideCss}</style></head><body>${sideFor('Overview').replace('<em>1</em>', '')}<main class="ov">${wide.replace(appsCardFor(true), appsCardFor(false)).replace(running(3, 4), running(4, 4)).replace('Decypharr stopped · AIOStreams +2', 'AIOStreams, AIOMetadata +2')}</main></body></html>`);

// ---------- A category's own page: the apps as a home screen (the owner, Nov 25) ----------
// Click a category in Status' menu: its apps as big-icon tiles three across, as CasaOS's dashboard lays out apps
// (its ideas only: the icon is the hero, the name under it, light tiles over a soft backdrop, the live numbers in a
// widget rather than on every tile, adding an app as the last tile). Ours: the app's state as a dot, one small
// button (Open, Start), ⋯ for the rest; the apps to add below, faded, with Install.
Object.assign(P, { dots: 'c5,12,1|c12,12,1|c19,12,1', download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3' });
const media = [
  { id: 'jellyfin-container', name: 'Jellyfin', state: 'running', note: '2 watching now' },
  { id: 'own:JS,#7c3aed', name: 'Jellystat', state: 'running', note: 'Up 6 days' },
  { id: 'own:JF,#0e7490', name: 'jfa-go', state: 'stopped', note: 'Stopped 20 min ago' },
];
// Every Media app in the catalog that isn't on this machine (the owner, Nov 25: show them all, no "More" tile).
const more = [
  { id: 'navidrome', name: 'Navidrome', note: 'Your music' },
  { id: 'feishin', name: 'Feishin', note: 'Music player in the browser' },
  { id: 'audiobookshelf', name: 'Audiobookshelf', note: 'Audiobooks, podcasts' },
  { id: 'calibre-web', name: 'Calibre-Web', note: 'E-books' },
  { id: 'komga', name: 'Komga', note: 'Comics and manga' },
  { id: 'kavita', name: 'Kavita', note: 'Books, comics, manga' },
  { id: 'romm', name: 'RomM', note: 'Your game library' },
  { id: 'beets', name: 'beets', note: 'Tags and sorts music' },
];
const ring = (pct, label, sub) => { const r = 30, c = 2 * Math.PI * r; return `<div class="ring"><svg viewBox="0 0 72 72" width="72" height="72"><circle cx="36" cy="36" r="${r}" fill="none" stroke="var(--ringbg)" stroke-width="7"/><circle cx="36" cy="36" r="${r}" fill="none" stroke="var(--acc)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(pct / 100) * c} ${c}" transform="rotate(-90 36 36)"/><text x="36" y="41" text-anchor="middle">${pct}%</text></svg><b>${label}</b><small>${sub}</small></div>`; };
const tileCss = `
:root{--glass:rgba(255,255,255,.62);--glass2:rgba(255,255,255,.34);--glassline:rgba(255,255,255,.7);--ringbg:rgba(15,23,42,.08);--bd1:#e9e3ff;--bd2:#dff3f6}
@media (prefers-color-scheme:dark){:root{--glass:rgba(255,255,255,.06);--glass2:rgba(255,255,255,.025);--glassline:rgba(255,255,255,.09);--ringbg:rgba(255,255,255,.09);--bd1:rgba(124,92,255,.22);--bd2:rgba(14,116,144,.20)}}
.backdrop{background:radial-gradient(60% 55% at 15% 0%,var(--bd1),transparent 70%),radial-gradient(55% 60% at 100% 100%,var(--bd2),transparent 70%),var(--bg)}
.tiles6{display:grid;grid-template-columns:repeat(var(--cols,3),minmax(0,1fr));gap:var(--gap,14px)}
.sect{margin:22px 4px 10px;font-size:14px;font-weight:650;color:var(--text);display:flex;gap:8px;align-items:baseline}.sect span{color:var(--muted);font-weight:500;font-size:13px}.sect:first-of-type{margin-top:6px}
.tile6{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;aspect-ratio:var(--ar,1.35);padding:14px 12px;border-radius:20px;background:var(--glass);border:1px solid var(--glassline);backdrop-filter:blur(18px);text-align:center;min-width:0}
.tile6 .alogo,.tile6 .own{border-radius:18px;box-shadow:0 6px 18px rgba(0,0,0,.18)}
.tile6 .own{display:inline-grid;place-items:center;color:#fff;font-weight:700}
.tile6 b{font-size:15px;font-weight:600;margin-top:6px;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tile6 small{font-size:12.5px;color:var(--muted);white-space:nowrap}
.tile6 .dot{position:absolute;top:14px;left:14px;width:9px;height:9px;border-radius:50%}.dot.run{background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.18)}.dot.stop{background:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,.18)}
.tile6 .more{position:absolute;top:8px;right:8px;width:30px;height:30px;border-radius:9px;display:grid;place-items:center;color:var(--muted)}
.pill{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 13px;border-radius:14px;font:600 12.5px Inter,system-ui,sans-serif;margin-top:4px;background:var(--glass);border:1px solid var(--glassline);color:var(--text)}
.pill.pri{background:var(--acc);border-color:transparent;color:#fff}@media (prefers-color-scheme:dark){.pill.pri{color:#140c33}}
.tile6.add{background:var(--glass2);border-style:dashed}.tile6.add .alogo{opacity:.75;box-shadow:none}
.tile6.new{background:transparent;border-style:dashed;color:var(--muted)}.tile6.new .plus{width:64px;height:64px;border-radius:18px;display:grid;place-items:center;border:1.5px dashed var(--glassline);color:var(--acc)}
.widgets{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:8px}.widgets .widget{display:flex;flex-direction:column;min-height:150px}.widgets .widget .wfoot{margin-top:auto;font-size:12.5px;color:var(--muted)}
.widget{border-radius:20px;background:var(--glass);border:1px solid var(--glassline);backdrop-filter:blur(18px);padding:14px 16px}
.widget h5{margin:0 0 8px;font-size:13px;font-weight:600;color:var(--muted)}
.rings{display:flex;gap:28px;align-items:center}.ring{grid-template-columns:auto;}.bar2{height:8px;border-radius:99px;background:var(--ringbg);overflow:hidden;margin:10px 0 6px}.bar2 i{display:block;height:100%;width:9%;background:var(--acc);border-radius:99px}.ring{display:grid;justify-items:center;gap:1px}.ring text{font:700 15px Inter,system-ui;fill:var(--text)}.ring b{font-size:12.5px;font-weight:600}.ring small{font-size:11px;color:var(--muted)}
.wnum{font-size:26px;font-weight:700;letter-spacing:-.02em}.wnum small{font-size:13px;color:var(--muted);font-weight:500}
.chead{display:flex;align-items:center;gap:16px;margin:4px 0 14px}.chead .t{flex:1}.chead h2{margin:0;font-size:26px;font-weight:700;letter-spacing:-.01em}
`;
const tile = (a) => `<div class="tile6"><i class="dot ${a.state === 'running' ? 'run' : 'stop'}"></i><span class="more">${icon('dots', 16)}</span>${logoOf(a.id, 64)}<b>${a.name}</b><small>${a.note}</small>${a.state === 'running' ? `<span class="pill">${icon('open', 12)}Open</span>` : `<span class="pill pri">${icon('play', 11)}Start</span>`}</div>`;
const addTile = (a) => `<div class="tile6 add">${logoOf(a.id, 64)}<b>${a.name}</b><small>${a.note}</small><span class="pill">${icon('download', 12)}Install</span></div>`;
const newTile = `<div class="tile6 new"><span class="plus">${icon('plus', 26)}</span><b style="color:var(--text)">More for Media</b><small>7 more to add</small></div>`;
const widgets = `<div class="widgets">
  <div class="widget"><h5>Right now</h5><div class="rings">${ring(7, 'Processor', 'of 8 cores')}${ring(18, 'Memory', '1.6 of 32 GB')}</div></div>
  <div class="widget"><h5>Watching</h5><div class="wnum">2 <small>on Jellyfin</small></div><div class="wfoot">Backed up last night · 3 of 3</div></div>
  <div class="widget"><h5>Media drive</h5><div class="wnum">3.4 <small>TB free</small></div><div class="bar2"><i></i></div><div class="wfoot">330 GB of films, shows and music</div></div>
</div>`;
const grid = `<div class="sect">On this server <span>3</span></div><div class="tiles6">${media.map(tile).join('')}</div>
<div class="sect">Add to Media <span>${more.length}</span></div><div class="tiles6">${more.map(addTile).join('')}</div>`;
const catHead = `<div class="chead"><div class="t"><h2>Media</h2><small style="color:var(--muted);font-size:13px">3 on this server · 2 running · 8 to add</small></div><div class="search" style="width:260px;background:var(--glass);border-color:var(--glassline)">${icon('search', 15)}Find an app</div></div>`;
writeFileSync(out + 'web-category.html', `<!doctype html><html><head><meta charset="utf-8"><title>Media</title><style>${deskCss}${extra}${wideCss}${tileCss}
main.backdrop{min-height:100vh}.tiles6{--ar:1.45}.ring svg{width:62px;height:62px}</style></head><body>${sideFor('Media', ['Media'])}<main class="backdrop"><header class="top" style="padding-bottom:0;background:transparent"></header>${catHead}${grid}</main></body></html>`);

// The computer app (Homelab Wizard's own window): the same page, with the computer's strip of screens (Choose apps,
// Status, Backups, Tidy Up, Finances) and its foot. The owner, Nov 25: the categories' pages go into the computer too.
const computerSide = sideFor('Media', ['Media'])
  .replace(/<nav class="apps"[\s\S]*?<\/nav>/, `<nav class="apps" aria-label="Homelab">${[['layers', 'Choose apps'], ['activity', 'Status', 1], ['archive', 'Backups'], ['tidy', 'Tidy Up'], ['dollar', 'Finances']].map(([i, n, b]) => `<span class="${n === 'Status' ? 'on' : ''}" title="${n}">${icon(i, 17)}${b ? `<em>${b}</em>` : ''}</span>`).join('')}</nav>`)
  .replace('Linux · 0.42.8 · 3.4 TB free', '412 GB free · plugged in');
writeFileSync(out + 'computer-category.html', `<!doctype html><html><head><meta charset="utf-8"><title>Media</title><style>${deskCss}${extra}${wideCss}${tileCss}
main.backdrop{min-height:100vh}.tiles6{--ar:1.45}</style></head><body>${computerSide}<main class="backdrop"><header class="top" style="padding-bottom:0;background:transparent"></header>${catHead.replace('3 on this server', '3 on this Mac')}${grid.replace('On this server', 'On this Mac')}</main></body></html>`);

// On a phone (two across) and the iPhone Duo unfolded upright (three across): the same, under the tab bar.
const catPhone = (cols, ar) => `<!doctype html><html><head><meta charset="utf-8"><style>${phoneCss}${extra}${tileCss}
body{width:auto;min-height:100vh}.tiles6{--cols:${cols};--ar:${ar};--gap:12px;margin:0 16px}.sect{margin-left:20px}.tiles6{--ar:0.95}
.tile6 .alogo,.tile6 .own{width:56px!important;height:56px!important}</style></head><body class="backdrop">${sb}
<div class="nav"><span class="who" style="padding:0 14px 0 8px;color:var(--acc)">${icon('left', 20)}Status</span><span style="flex:1"></span><span class="gb">${icon('search', 20)}</span></div>
<h1>Media</h1><div class="sub">3 on this server · 2 running · 8 to add</div>
${grid}${tabs('Status')}</body></html>`;
writeFileSync(out + 'web-category-duo.html', catPhone(3, 0.95));
writeFileSync(out + 'web-category-phone.html', catPhone(2, 0.95));

// ---------- Analytics (the owner, Nov 25): the machine's numbers, off the category pages ----------
// Under Overview in Status' menu. Three cards built one way (processor, memory, drives: a figure, one line, a footer
// line of the last 24 hours or the drive's bar), then the week as one chart with the nightly jobs marked, then what
// each app uses, heaviest first, each with its logo. A period switch (Day, Week, Month) on top.
Object.assign(P, { chart: P.chart || 'M3 3v18h18M7 15l4-4 3 3 5-6' });
const usage = [
  ['immich-server', 'Immich', 2.1, 3.2, '412 GB'], ['jellyfin-container', 'Jellyfin', 1.4, 6.1, '38 GB'], ['nextcloud', 'Nextcloud', 0.92, 1.4, '61 GB'],
  ['paperless', 'Paperless-ngx', 0.78, 0.9, '4.2 GB'], ['own:AS,#111827', 'AIOStreams', 0.41, 0.6, '120 MB'], ['own:JS,#0b0b12', 'Jellystat', 0.21, 0.3, '310 MB'],
  ['kopia', 'Kopia', 0.19, 0.2, '—'], ['duplicati', 'Duplicati', 0.17, 0.2, '—'], ['own:AM,#ffffff', 'AIOMetadata', 0.15, 0.2, '40 MB'],
  ['uptime-kuma', 'Uptime Kuma', 0.12, 0.3, '90 MB'], ['pocket-id', 'Pocket ID', 0.07, 0.1, '12 MB'], ['vaultwarden', 'Vaultwarden', 0.06, 0.1, '94 MB'],
];
const series = (n, base, amp, spikes = []) => Array.from({ length: n }, (_, i) => base + amp * (0.5 + 0.5 * Math.sin(i / 3.1) * Math.cos(i / 7.3)) + (spikes.includes(i % 24) ? amp * 2.6 : 0));
const lineSvg = (vals, w, h, max, cls = 'line') => {
  const pts = vals.map((v, i) => `${((i / (vals.length - 1)) * w).toFixed(1)},${(h - (v / max) * (h - 4) - 2).toFixed(1)}`);
  return `<path d="M${pts.join(' L')}" class="${cls}" fill="none"/>`;
};
// The last 24 hours, scaled to the day's own range so its shape shows (the figure above says how much).
const spark24 = (vals) => { const lo = Math.min(...vals) * 0.9, hi = Math.max(...vals); const y = (v) => (40 - ((v - lo) / (hi - lo)) * 34 - 2).toFixed(1); const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * 300},${y(v)}`).join(' L'); return `<svg viewBox="0 0 300 40" width="100%" height="40" preserveAspectRatio="none" class="chart"><path d="M0,40 L${pts} L300,40 Z" class="area"/><path d="M${pts}" class="line" fill="none"/></svg>`; };
const cpu24 = series(24, 4, 3, [3, 20]), mem24 = series(24, 10.2, 0.9, [3]);
const weekCpu = series(168, 5, 5, [3]), weekMem = series(168, 10, 1.2, [3]);
const weekChart = (w, h) => {
  const days = ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed'];
  const grid = [0, 25, 50, 75, 100].map((p) => `<line x1="0" x2="${w}" y1="${h - (p / 100) * (h - 24) - 20}" y2="${h - (p / 100) * (h - 24) - 20}" class="gl"/>`).join('');
  const nights = days.map((_, d) => { const x = ((d * 24 + 3.5) / 167) * w; return `<line x1="${x}" x2="${x}" y1="4" y2="${h - 20}" class="nl"/>`; }).join('');
  const labels = days.map((d, i) => `<text x="${((i * 24 + 12) / 167) * w}" y="${h - 4}" class="tick" text-anchor="middle">${d}</text>`).join('');
  const cpu = weekCpu.map((v) => (v / 40) * 100), mem = weekMem.map((v) => (v / 32) * 100);
  const path = (vals, cls) => `<path d="M${vals.map((v, i) => `${((i / 167) * w).toFixed(1)},${(h - 20 - (v / 100) * (h - 24)).toFixed(1)}`).join(' L')}" class="${cls}" fill="none"/>`;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" class="chart wk">${grid}${nights}${path(mem, 'mem')}${path(cpu, 'cpu')}${labels}</svg>`;
};
const anaCss = `
.chart .area{fill:var(--acc);opacity:.12}.chart .line{stroke:var(--acc);stroke-width:2;vector-effect:non-scaling-stroke}
.wk .gl{stroke:var(--line);stroke-width:1;vector-effect:non-scaling-stroke}.wk .nl{stroke:var(--muted);stroke-dasharray:2 4;opacity:.45;vector-effect:non-scaling-stroke}
.wk .cpu{stroke:var(--acc);stroke-width:2;vector-effect:non-scaling-stroke}.wk .mem{stroke:#14b8a6;stroke-width:2;vector-effect:non-scaling-stroke}.wk .tick{font-size:11px;fill:var(--muted)}
.legend2{display:flex;gap:16px;font-size:12.5px;color:var(--muted)}.legend2 i{display:inline-block;width:10px;height:3px;border-radius:2px;margin-right:6px;vertical-align:middle}
.seg2{display:flex;background:var(--glass);border:1px solid var(--glassline);border-radius:10px;padding:3px;font-size:13px;font-weight:600}.seg2 span{padding:6px 14px;border-radius:7px;color:var(--muted)}.seg2 span.on{background:var(--panel);color:var(--text);box-shadow:0 0 0 1px var(--line)}
.utab{width:100%;border-collapse:collapse;font-size:13.5px}.utab th{background:transparent;text-align:left;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:600;padding:8px 10px;border-bottom:1px solid var(--line)}
.utab td{padding:9px 10px;border-bottom:1px solid var(--line);white-space:nowrap}.utab tr:last-child td{border-bottom:0}.utab td.app{display:flex;align-items:center;gap:10px;font-weight:550}.utab td.num{text-align:right;font-variant-numeric:tabular-nums;color:var(--muted)}
.mbar{width:180px;height:8px;border-radius:99px;background:var(--sunken);overflow:hidden;display:inline-block;vertical-align:middle;margin-right:10px}.mbar i{display:block;height:100%;background:var(--acc);border-radius:99px}
.utab .alogo,.utab .own{border-radius:7px}
`;
const usageRows = (rows, showDisk = true) => rows.map(([id, n, gb, cpu, disk]) => `<tr><td class="app">${logoOf(id, 26)}${n}</td><td><span class="mbar"><i style="width:${(gb / 2.1) * 100}%"></i></span><span style="font-variant-numeric:tabular-nums">${gb >= 1 ? gb.toFixed(1) + ' GB' : Math.round(gb * 1000) + ' MB'}</span></td><td class="num">${cpu.toFixed(1)}%</td>${showDisk ? `<td class="num">${disk}</td>` : ''}</tr>`).join('');
const anaWide = `
<header class="top" style="background:transparent"><h2 style="margin:0;font-size:24px;font-weight:700;letter-spacing:-.01em;flex:1">Analytics</h2><div class="seg2"><span>Day</span><span class="on">Week</span><span>Month</span></div></header>
<div class="grid">
  <section class="card k"><div class="kh"><h3>Processor</h3><span>8 cores</span></div><div class="kf">7<small>% on average</small></div><div class="ks">Busiest at 3:31 AM · the nightly backup</div><div class="kb">${spark24(cpu24)}</div></section>
  <section class="card k"><div class="kh"><h3>Memory</h3><span>32 GB</span></div><div class="kf">11<small>of 32 GB in use</small></div><div class="ks">${logoOf('immich-server', 16)} Immich uses the most · 2.1 GB</div><div class="kb">${spark24(mem24)}</div></section>
  <section class="card k"><div class="kh"><h3>Drives</h3><span>RAID 1 · 2 × 4 TB</span></div><div class="kf">3.4<small>TB free</small></div><div class="ks">Both disks healthy · full in about 3 years</div><div class="kb kbar"><div class="bar2"><i style="width:15%"></i></div><span>520 GB used · photos 412 GB</span></div></section>
  <section class="card" style="grid-column:1/-1"><div class="ch"><h3>This week</h3><div class="legend2"><span><i style="background:var(--acc)"></i>Processor</span><span><i style="background:#14b8a6"></i>Memory</span><span><i style="background:var(--muted);height:1px;opacity:.6"></i>Nightly backups and updates</span></div></div>${weekChart(1000, 190)}</section>
  <section class="card" style="grid-column:1/-1"><div class="ch"><h3>What each app uses</h3><span class="muted" style="font-size:12.5px">Right now · heaviest first</span></div>
    <table class="utab"><thead><tr><th>App</th><th>Memory</th><th style="text-align:right">Processor</th><th style="text-align:right">On disk</th></tr></thead><tbody>${usageRows(usage)}</tbody></table></section>
</div>`;
const anaSide = (computer) => { let s = sideFor('Analytics', ['Your own apps']); if (computer) s = s.replace(/<nav class="apps"[\s\S]*?<\/nav>/, `<nav class="apps" aria-label="Homelab">${[['layers', 'Choose apps'], ['activity', 'Status', 1], ['archive', 'Backups'], ['tidy', 'Tidy Up'], ['dollar', 'Finances']].map(([i, n, b]) => `<span class="${n === 'Status' ? 'on' : ''}" title="${n}">${icon(i, 17)}${b ? `<em>${b}</em>` : ''}</span>`).join('')}</nav>`); return s; };
writeFileSync(out + 'web-analytics.html', `<!doctype html><html><head><meta charset="utf-8"><title>Analytics</title><style>${deskCss}${extra}${wideCss}${anaCss}</style></head><body>${anaSide(false)}<main class="ov">${anaWide}</main></body></html>`);

// On a phone: the same, one column; the period as a segmented switch under the title; the app list without disk.
const anaPhone = `<!doctype html><html><head><meta charset="utf-8"><style>${phoneCss}${extra}${anaCss}
.seg2{margin:0 16px 14px;justify-content:space-between}.seg2 span{flex:1;text-align:center}.utab td,.utab th{padding:8px 6px}.mbar{width:70px}.card .kh{display:flex;justify-content:space-between;margin-bottom:6px}.card .kh h3{margin:0;font-size:15px}.card .kh span{color:var(--muted);font-size:12.5px}
.kf{font-size:30px;font-weight:700;letter-spacing:-.02em}.kf small{font-size:14px;color:var(--muted);font-weight:600;margin-left:6px}.ks{color:var(--muted);font-size:13px;margin:4px 0 10px}.ks .alogo,.ks .own{vertical-align:-3px;border-radius:4px;margin-right:4px}</style></head><body>${sb}
<div class="nav"><span class="who" style="padding:0 14px 0 8px;color:var(--acc)">${icon('left', 20)}Status</span><span style="flex:1"></span></div>
<h1>Analytics</h1><div class="sub">The server · this week</div>
<div class="seg2"><span>Day</span><span class="on">Week</span><span>Month</span></div>
<section class="card"><div class="kh"><h3>Memory</h3><span>32 GB</span></div><div class="kf">11<small>of 32 GB</small></div><div class="ks">${logoOf('immich-server', 16)} Immich uses the most · 2.1 GB</div>${spark24(mem24)}</section>
<section class="card"><div class="kh"><h3>Processor</h3><span>8 cores</span></div><div class="kf">7<small>% on average</small></div><div class="ks">Busiest at 3:31 AM · the nightly backup</div>${spark24(cpu24)}</section>
<section class="card"><div class="ch"><h3>What each app uses</h3></div><table class="utab"><tbody>${usageRows(usage.slice(0, 6), false)}</tbody></table></section>
${tabs('Status')}</body></html>`;
writeFileSync(out + 'web-analytics-phone.html', anaPhone);
