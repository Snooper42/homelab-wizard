// Redesign mock of the iPhone app (docs/Redesign.md): Finances, Transactions,
// Status, and Finances on a partner's phone (Jordan, the example household's).
import { writeFileSync } from 'node:fs';
import { repo, out, logo, icon, money, big, chip, cat, acct, tx, payee, worth, spentTotal, inTotal, per, steps, P } from './lib.mjs';

const appLogo = (id, s = 30) => `<img class="alogo" src="file://${repo}/apple-client/Shared/Assets.xcassets/AppLogos/${id}.imageset/${id}.png" width="${s}" height="${s}">`;
Object.assign(P, { gear: 'c12,12,3|M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z',
  apps: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z', filter: 'M3 6h18M7 12h10M10 18h4', play: 'M7 4.5v15l12-7.5z', logs: 'M4 6h16M4 12h16M4 18h10' });

const css = `
:root{--bg:#f2f2f7;--card:#fff;--sunken:#f2f2f7;--text:#0b0b0f;--muted:#6e6e78;--line:#e5e5ea;--acc:#6d4ae0;--acc-ink:#5b3fd6;--acc-soft:#efebfc;--in:#157a3a;--in-soft:#e7f6ee;--out:#c2410c;--out-soft:#fdeee6;--warn:#b45309;--warn-soft:#fff4e0;--glass:rgba(255,255,255,.9);--glassline:rgba(0,0,0,.06)}
@media (prefers-color-scheme:dark){:root{--bg:#000;--card:#1c1c1e;--sunken:#2c2c2e;--text:#f5f5f7;--muted:#98989f;--line:#2c2c2e;--acc:#9c86f5;--acc-ink:#b8a9ff;--acc-soft:#251f3d;--in:#5bd69c;--in-soft:#12291e;--out:#ff8a73;--out-soft:#2f1a15;--warn:#fbbf24;--warn-soft:#2a2110;--glass:rgba(36,36,40,.92);--glassline:rgba(255,255,255,.08)}}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg)}body{width:390px;font:15px/1.35 Inter,system-ui,sans-serif;color:var(--text);-webkit-font-smoothing:antialiased;padding-bottom:110px}
.ic{flex:none}.muted{color:var(--muted)}.pos{color:var(--in)}.neg{color:var(--out)}
.sb{height:54px;display:flex;align-items:center;justify-content:space-between;padding:0 30px 0 36px;font-weight:600;font-size:16px;position:relative}
.island{position:absolute;left:50%;top:11px;transform:translateX(-50%);width:124px;height:36px;background:#000;border-radius:20px}
.sig{display:flex;gap:6px;align-items:center}.sig i{display:inline-block;background:currentColor;border-radius:2px}
.nav{display:flex;justify-content:flex-end;gap:10px;padding:4px 16px 0}.gb{width:44px;height:44px;border-radius:50%;background:var(--glass);border:1px solid var(--glassline);display:grid;place-items:center;color:var(--acc);backdrop-filter:blur(20px);box-shadow:0 2px 10px rgba(0,0,0,.06)}
.nav .who{margin-right:auto;display:flex;align-items:center;gap:8px;padding:0 14px 0 6px;height:44px;border-radius:22px;background:var(--glass);border:1px solid var(--glassline);font-weight:600;font-size:14px}
.av{width:32px;height:32px;border-radius:50%;background:var(--acc-soft);color:var(--acc-ink);display:grid;place-items:center;font-weight:700;font-size:14px}
h1{font-size:34px;font-weight:750;letter-spacing:-.02em;margin:6px 20px 2px}
.sub{margin:0 20px 12px;color:var(--muted);font-size:14px;display:flex;align-items:center;gap:6px}.live{width:7px;height:7px;border-radius:50%;background:var(--in)}
.period{display:flex;align-items:center;gap:4px;margin:4px 16px 14px}.period .p{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;height:40px;border-radius:20px;background:var(--card);font-weight:600;font-size:14.5px;box-shadow:0 1px 2px rgba(0,0,0,.04)}.period .p small{color:var(--muted);font-weight:500}
.period .a{width:40px;height:40px;border-radius:50%;background:var(--card);display:grid;place-items:center;color:var(--muted)}
.card{background:var(--card);border-radius:22px;margin:0 16px 14px;padding:16px 18px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.ch{display:flex;align-items:center;gap:8px;margin-bottom:8px}.ch h3{margin:0;font-size:15px;font-weight:650;flex:1}.ch a{color:var(--acc);font-size:14px;font-weight:600;display:flex;align-items:center;gap:2px}
.fig{font-size:34px;font-weight:750;letter-spacing:-.025em;font-variant-numeric:tabular-nums;line-height:1.05}.fig small{font-size:.58em;color:var(--muted);font-weight:650}.fig.md{font-size:24px}
.lab{font-size:11px;letter-spacing:.07em;color:var(--muted);font-weight:650;text-transform:uppercase;margin-top:5px}
.figrow{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.chip{display:inline-flex;align-items:center;gap:3px;font-size:12.5px;font-weight:650;padding:4px 9px;border-radius:999px;white-space:nowrap}.chip.up{background:var(--in-soft);color:var(--in)}.chip.dn{background:var(--out-soft);color:var(--out)}.chip.warn{background:var(--warn-soft);color:var(--warn)}
.vs{font-size:11.5px;color:var(--muted);text-align:right;margin-top:4px}
.chart .line{fill:none;stroke:var(--acc);stroke-width:2.2;vector-effect:non-scaling-stroke}.chart .area{fill:var(--acc);opacity:.11}.chart .tick{font-size:10px;fill:var(--muted)}.chart .cushion{stroke:var(--out);stroke-dasharray:3 4;opacity:.6;vector-effect:non-scaling-stroke}
.dotin{fill:var(--in)}.dotout{fill:var(--card);stroke:var(--out);stroke-width:2}
.trio{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:6px}.trio div{background:var(--sunken);border-radius:12px;padding:8px 10px}.trio b{display:block;font-size:14.5px;font-variant-numeric:tabular-nums}.trio span{font-size:10px;letter-spacing:.06em;color:var(--muted);font-weight:650;text-transform:uppercase}
.strip{display:flex;gap:10px;overflow:hidden;padding:0 16px;margin-bottom:14px}.acard{flex:none;width:150px;border-radius:18px;padding:12px 14px;color:#fff;display:grid;gap:14px}.acard b{font-size:18px;font-variant-numeric:tabular-nums}.acard span{font-size:12.5px;opacity:.9;font-weight:550}
.two{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 16px 14px}.two .card{margin:0;padding:14px 14px}
.row{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--line)}.row:first-child{border-top:0}.row .n{flex:1;min-width:0;display:grid}.row .n b{font-weight:600;font-size:15.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.row .n small{color:var(--muted);font-size:13px;display:flex;align-items:center;gap:5px;white-space:nowrap;overflow:hidden}
.row .a{text-align:right;display:grid;font-variant-numeric:tabular-nums}.row .a b{font-weight:650;font-size:15.5px}.row .a small{color:var(--muted);font-size:12.5px}
.dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex:none}
.bar{height:8px;border-radius:99px;background:var(--sunken);overflow:hidden;display:flex}.bar i{display:block;height:100%}
.pill{font-size:11.5px;font-weight:650;padding:2px 8px;border-radius:99px;background:var(--acc-soft);color:var(--acc-ink)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:36px;padding:0 16px;border-radius:18px;font-weight:650;font-size:14.5px;background:var(--acc-soft);color:var(--acc-ink);border:0;font-family:inherit}.btn.pri{background:var(--acc);color:#fff}
@media (prefers-color-scheme:dark){.btn.pri{color:#140c33}}
.logo{display:inline-grid;place-items:center;border-radius:50%;flex:none;font-weight:700}.alogo{border-radius:9px;flex:none;background:#fff;box-shadow:0 0 0 1px var(--line)}
.search{display:flex;align-items:center;gap:8px;height:40px;margin:0 16px 10px;padding:0 12px;border-radius:12px;background:var(--card);color:var(--muted);font-size:16px}
.chips{display:flex;gap:8px;overflow:hidden;padding:0 16px;margin-bottom:12px}.chips span{flex:none;display:flex;align-items:center;gap:5px;height:34px;padding:0 12px;border-radius:17px;background:var(--card);font-size:14px;font-weight:600}.chips span.on{background:var(--acc-soft);color:var(--acc-ink)}
.sum{display:flex;gap:14px;margin:0 20px 12px;font-size:13.5px;color:var(--muted)}.sum b{color:var(--text);font-variant-numeric:tabular-nums}
.dayh{display:flex;justify-content:space-between;margin:4px 32px 6px;font-size:13px;font-weight:650;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.list{background:var(--card);border-radius:22px;margin:0 16px 14px;padding:2px 16px}
.stack{display:flex}.stack img{margin-left:-8px;border:2px solid var(--card);border-radius:10px;box-sizing:content-box}.stack img:first-child{margin-left:0}
.tabs{position:fixed;left:16px;right:16px;bottom:22px;height:64px;border-radius:32px;background:var(--glass);border:1px solid var(--glassline);backdrop-filter:blur(24px);display:flex;align-items:center;justify-content:space-around;padding:0 8px;box-shadow:0 8px 30px rgba(0,0,0,.12)}
.tabs span{position:relative;display:grid;justify-items:center;gap:2px;font-size:11px;font-weight:600;color:var(--text);padding:7px 14px;border-radius:24px}.tabs span.on{color:var(--acc);background:color-mix(in srgb,var(--acc) 12%,transparent)}
.tabs em{position:absolute;top:0;right:6px;min-width:18px;height:18px;border-radius:9px;background:#ff3b30;color:#fff;font-style:normal;font-size:11px;display:grid;place-items:center;font-weight:700}
.note{margin:0 16px 14px;border-radius:22px;padding:14px 16px;background:var(--acc-soft);display:flex;gap:12px;align-items:center}.note .n{flex:1;display:grid;gap:2px}.note b{font-size:15px}.note small{color:var(--muted);font-size:13px}
`;
const sb = `<div class="sb"><span>9:41</span><span class="island"></span><span class="sig"><i style="width:3px;height:6px"></i><i style="width:3px;height:8px"></i><i style="width:3px;height:10px"></i><i style="width:3px;height:12px"></i><svg width="18" height="13" viewBox="0 0 18 13"><path d="M9 3a9 9 0 0 1 6.4 2.6l1.4-1.4A11 11 0 0 0 1.2 4.2l1.4 1.4A9 9 0 0 1 9 3Zm0 4a5 5 0 0 1 3.5 1.5l1.4-1.4a7 7 0 0 0-9.8 0l1.4 1.4A5 5 0 0 1 9 7Zm0 4 2-2a3 3 0 0 0-4 0Z" fill="currentColor"/></svg><svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="18" height="9" rx="2" fill="currentColor"/><rect x="24.5" y="4.5" width="1.5" height="4" rx=".7" fill="currentColor" opacity=".4"/></svg></span></div>`;
const tabsFor = (on, set = 'alex') => {
  const list = set === 'alex' ? [['activity', 'Status', 1], ['archive', 'Backups'], ['dollar', 'Finances'], ['gear', 'Settings']] : [['dollar', 'Finances'], ['apps', 'Apps'], ['gear', 'Settings']];
  return `<nav class="tabs">${list.map(([i, n, b]) => `<span class="${n === on ? 'on' : ''}">${icon(i, 23)}${n}${b ? `<em>${b}</em>` : ''}</span>`).join('')}</nav>`;
};
const html = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${sb}${body}</body></html>`;
const ch = (t, link) => `<div class="ch"><h3>${t}</h3>${link ? `<a>${link}${icon('right', 15)}</a>` : ''}</div>`;
const txRow = (t) => `<div class="row">${payee(t, 38)}<div class="n"><b>${t[2]}</b><small><i class="dot" style="background:${cat[t[3]]}"></i>${t[3]} · ${acct[t[4]][1]}</small></div><div class="a"><b class="${t[5] > 0 ? 'pos' : ''}">${t[5] > 0 ? '+' : '−'}${money(Math.abs(t[5]))}</b>${t[7] ? `<small>${icon('link', 11)} bill</small>` : ''}</div></div>`;

function stepMini(w, h) {
  const dx = (d) => Number(d.slice(3)) - 5, xs = (d) => 4 + (dx(d) / 15) * (w - 8), ys = (v) => 6 + (1 - v / 2700) * (h - 22);
  let d = `M${xs(steps[0].d)},${ys(steps[0].v)}`;
  for (let i = 1; i < steps.length; i++) d += ` H${xs(steps[i].d)} V${ys(steps[i].v)}`;
  d += ` H${w - 4}`;
  const ticks = [['11-06', 'Nov 6'], ['11-12', '12'], ['11-18', '18']].map(([t, l]) => `<text x="${xs(t)}" y="${h - 3}" class="tick">${l}</text>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" class="chart"><path d="${d} V${h - 16} H${xs(steps[0].d)} Z" class="area"/><line x1="4" x2="${w - 4}" y1="${ys(500)}" y2="${ys(500)}" class="cushion"/><path d="${d}" class="line"/>${steps.slice(1).map((s) => `<circle cx="${xs(s.d)}" cy="${ys(s.v)}" r="3" class="${s === steps[1] ? 'dotin' : 'dotout'}"/>`).join('')}${ticks}</svg>`;
}
const spark = (vals, w, h) => {
  const min = Math.min(...vals), max = Math.max(...vals);
  const d = 'M' + vals.map((v, i) => `${(i / (vals.length - 1)) * w},${(2 + (1 - (v - min) / (max - min)) * (h - 4)).toFixed(1)}`).join(' L');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" class="chart"><path d="${d} V${h} H0 Z" class="area"/><path d="${d}" class="line"/></svg>`;
};

// ---- Finances (Alex) ----
const fin = `
<div class="nav"><span class="who"><span class="av">A</span>Alex${icon('down', 14, 'muted')}</span><span class="gb">${icon('eye', 20)}</span><span class="gb">${icon('plus', 22)}</span></div>
<h1>Finances</h1>
<div class="period"><span class="a">${icon('left', 18)}</span><span class="p">Alex's paycheck <small>Nov 6 – 19</small>${icon('down', 14, 'muted')}</span><span class="a">${icon('right', 18)}</span></div>
<section class="card">
  ${ch("Left after this paycheck's bills")}
  <div class="figrow"><div><div class="fig">${big(per.left)}</div><div class="lab">In checking on Nov 19</div></div><div>${chip(331.86, '+$331.86')}<div class="vs">vs last paycheck</div></div></div>
  ${stepMini(354, 96)}
  <div class="trio"><div><span>Now</span><b>$2,512</b></div><div><span>Payday</span><b>$2,558</b></div><div><span>Bills · 10</span><b class="neg">−$1,818</b></div></div>
</section>
<div class="strip">
  ${[['#117ACA', 'chase', 'Chase Checking', '$2,512.40'], ['#012169', 'bankofamerica', 'BofA Savings', '$6,500.00'], ['#1c4f8c', 'chase', 'Chase Freedom', '−$1,324.65'], ['#2E77BC', 'americanexpress', 'Amex Gold', '−$386.20']]
    .map(([bg, k, n, v]) => `<div class="acard" style="background:linear-gradient(135deg,${bg},color-mix(in srgb,${bg} 70%,#fff))">${logo(k, 26)}<div style="display:grid"><b>${v}</b><span>${n}</span></div></div>`).join('')}
</div>
<div class="two">
  <section class="card">${ch('Net worth')}<div class="fig md">$198.1k</div><div style="margin:4px 0 6px">${chip(20299, '+$20.3k')}</div>${spark(worth, 150, 40)}</section>
  <section class="card">${ch('Cash flow')}<div class="fig md pos">+$2,999</div><div style="margin:4px 0 10px">${chip(12.4, '+12.4%')}</div><div class="bar"><i style="width:${(spentTotal / inTotal) * 100}%;background:var(--out)"></i><i style="flex:1;background:var(--in)"></i></div><div class="muted" style="font-size:12px;margin-top:6px">70% kept · November</div></section>
</div>
<section class="card">
  ${ch('Coming up', 'Calendar')}
  ${[[null, 'HOA', 'Nov 26', 310, 'H', '#0891b2'], ['netflix', 'Netflix', 'Nov 28', 15.49], ['wellsfargo', 'Mortgage', 'Dec 1', 1845, null, null, 1]]
    .map(([k, n, d, a, l, c, sh]) => `<div class="row">${k ? logo(k, 38) : logo('', 38, l, c)}<div class="n"><b>${n}${sh ? ' <span class="pill">Shared</span>' : ''}</b><small>${d}</small></div><div class="a"><b>${money(a)}</b>${sh ? '<small>Jordan pays $922.50</small>' : ''}</div></div>`).join('')}
</section>
<section class="card">
  ${ch('Shared with Jordan', 'All')}
  <div class="figrow"><div><div class="fig md">${big(1060.71)}</div><div class="lab">Jordan's part this month</div></div><span class="chip up">${icon('check', 12)}1 of 3 settled</span></div>
  <div style="margin-top:6px">${[['wellsfargo', 'Mortgage', '50/50', 922.5, 'Due Dec 1'], [null, 'PG&E', '50/50', 68.21, '<span class="pos">Paid you</span>', 'PG', '#ca8a04'], [null, 'Xfinity', 'Jordan pays it all', 70, 'Her bill', 'X', '#ca8a04']]
    .map(([k, n, how, a, st, l, c]) => `<div class="row">${k ? logo(k, 34) : logo('', 34, l, c)}<div class="n"><b>${n}</b><small>${how}</small></div><div class="a"><b>${money(a)}</b><small>${st}</small></div></div>`).join('')}</div>
</section>
<section class="card">${ch('Latest transactions', 'All 18')}${tx.slice(0, 4).map(txRow).join('')}</section>
<section class="card">${ch('Budgets', 'All')}
  ${[['Food', 297.95, 600, '#16a34a'], ['Subscriptions', 200, 150, '#7c3aed'], ['Car', 48.2, 300, '#2563eb']].map(([n, s, b, c]) => `<div style="display:grid;gap:6px;padding:7px 0"><div style="display:flex;justify-content:space-between;font-size:14.5px"><b style="font-weight:600">${n}</b><span class="${s > b ? 'neg' : 'muted'}" style="font-size:13.5px">${s > b ? money(s - b, false) + ' over' : money(b - s, false) + ' left'}</span></div><div class="bar"><i style="width:${Math.min(100, (s / b) * 100)}%;background:${s > b ? 'var(--out)' : c}"></i></div></div>`).join('')}
</section>
${tabsFor('Finances')}`;
writeFileSync(out + 'phone-finances.html', html(fin));

// ---- Transactions ----
const days = [...new Set(tx.map((t) => t[0]))].slice(0, 6);
const txp = `
<div class="nav"><span class="gb">${icon('left', 22)}</span><span style="flex:1"></span><span class="gb">${icon('import', 19)}</span><span class="gb">${icon('plus', 22)}</span></div>
<h1>Transactions</h1>
<div class="search">${icon('search', 18)}Payee, category, note or amount</div>
<div class="chips"><span class="on">${icon('cal', 14)}Nov 6 – 19${icon('down', 13)}</span><span>All accounts${icon('down', 13)}</span><span>All categories${icon('down', 13)}</span><span>In and out${icon('down', 13)}</span></div>
<div class="note"><span style="color:var(--acc)">${icon('sync', 22)}</span><div class="n"><b>3 new from your banks</b><small>This morning · 2 matched to bills, 1 needs a category</small></div><button class="btn pri">Review</button></div>
<div class="sum"><span><b>18</b> transactions</span><span>In <b class="pos">+$4,300</b></span><span>Out <b class="neg">−$2,300</b></span></div>
${days.map((d) => { const l = tx.filter((t) => t[0] === d), net = l.reduce((a, t) => a + t[5], 0); return `<div class="dayh"><span>${d}</span><span>${net > 0 ? '+' : '−'}${money(Math.abs(net))}</span></div><div class="list">${l.map(txRow).join('')}</div>`; }).join('')}
${tabsFor('Finances')}`;
writeFileSync(out + 'phone-transactions.html', html(txp));

// ---- Status ----
const groups = [['Network', ['adguard-home', 'cloudflared', 'nginx-proxy-manager', 'speedtest-tracker'], 4, 4], ['Security', ['vaultwarden', 'crowdsec', 'uptime-kuma', 'ntfy'], 4, 4], ['System', ['duplicati', 'dozzle', 'homelab-companion'], 3, 3],
  ['Cloud & Files', ['immich-server'], 1, 1], ['Documents', ['paperless'], 1, 1], ['Finance', ['moneymatter-frontend'], 1, 1], ['Media', ['jellyfin', 'navidrome', 'audiobookshelf', 'komga', 'calibre-web', 'feishin'], 6, 6], ['Household', ['vikunja', 'mealie'], 1, 2]];
const names = { Network: 'AdGuard, Cloudflare +2', Security: 'Vaultwarden, CrowdSec +2', System: 'Duplicati, Dozzle +1', 'Cloud & Files': 'Immich', Documents: 'Paperless-ngx', Finance: 'MoneyMatter', Media: 'Jellyfin, Navidrome +4', Household: 'Mealie stopped · Vikunja' };
const st = `
<div class="nav"><span style="flex:1"></span><span class="gb">${icon('search', 20)}</span><span class="gb">${icon('sync', 20)}</span></div>
<h1>Status</h1>
<div class="sub"><i class="live"></i>This Mac · live</div>
<section class="card">
  <div class="figrow"><div><div class="fig md" style="color:var(--warn)">1 app needs you</div><div class="lab">21 of 22 running</div></div></div>
  <div class="row" style="margin-top:6px">${appLogo('mealie', 40)}<div class="n"><b>Mealie</b><small>Stopped 2 hours ago, outside the homelab</small></div></div>
  <div style="display:flex;gap:8px"><button class="btn pri" style="flex:1">${icon('play', 14)}Start</button><button class="btn" style="flex:1">${icon('logs', 15)}Logs</button><button class="btn" style="flex:1">Its page</button></div>
</section>
<div class="two">
  <section class="card">${ch('Backups')}<div class="fig md">11<small style="font-size:15px"> of 12</small></div><div class="muted" style="font-size:12.5px;margin-top:4px">Last night at 3:30<br>Mealie skipped (stopped)</div></section>
  <section class="card">${ch('This Mac')}<div class="fig md">412<small style="font-size:15px"> GB free</small></div><div class="muted" style="font-size:12.5px;margin-top:4px">Plugged in · OrbStack<br>Updates tonight, 4:00</div></section>
</div>
<div class="dayh"><span>Apps</span><span>22</span></div>
<div class="list">
  ${groups.map(([g, ids, up, all]) => `<div class="row"><span class="stack">${ids.slice(0, 3).map((i) => appLogo(i, 28)).join('')}</span><div class="n"><b>${g}</b><small>${names[g]}</small></div><div class="a" style="display:flex;align-items:center;gap:6px"><span class="chip ${up === all ? 'up' : 'warn'}">${up === all ? icon('check', 12) + up + ' running' : up + ' of ' + all + ' running'}</span><span class="muted">${icon('right', 16)}</span></div></div>`).join('')}
</div>
${tabsFor('Status')}`;
writeFileSync(out + 'phone-status.html', html(st));

// ---- Jordan's phone ----
const jtx = [['Nov 22', 'target', 'Target', 'Household', -46.18], ['Nov 21', 'starbucks', 'Starbucks', 'Coffee', -5.85], ['Nov 20', 'wholefoods', 'Whole Foods', 'Groceries', -74.3], ['Nov 19', 'uber', 'Uber', 'Car', -18.6]];
const jor = `
<div class="nav"><span class="who"><span class="av" style="background:#fde7ef;color:#be185d">J</span>Jordan</span><span class="gb">${icon('eye', 20)}</span><span class="gb">${icon('plus', 22)}</span></div>
<h1>Finances</h1>
<div class="period"><span class="a">${icon('left', 18)}</span><span class="p">My paycheck <small>Oct 26 – Nov 25</small>${icon('down', 14, 'muted')}</span><span class="a">${icon('right', 18)}</span></div>
<section class="card">
  ${ch("Left after this month's bills")}
  <div class="figrow"><div><div class="fig">${big(1284.1)}</div><div class="lab">In checking on Nov 25</div></div><div>${chip(96.4, '+$96.40')}<div class="vs">vs last month</div></div></div>
  <div class="trio" style="margin-top:12px"><div><span>Now</span><b>$1,902</b></div><div><span>Bills left · 4</span><b class="neg">−$618</b></div><div><span>Next pay</span><b>Nov 26</b></div></div>
</section>
<section class="card">
  ${ch('Shared with Alex', 'All')}
  <div class="figrow"><div><div class="fig md">${big(922.5)}</div><div class="lab">To send Alex by Dec 1</div></div><button class="btn pri">Mark sent</button></div>
  <div style="margin-top:6px">${[['wellsfargo', 'Mortgage', 'Your half of $1,845', 922.5, 'Due Dec 1'], [null, 'PG&E', 'Your half', 68.21, '<span class="pos">Sent ✓</span>', 'PG', '#ca8a04'], [null, 'Xfinity', 'You pay it all', 70, 'Paid Nov 9', 'X', '#ca8a04']]
    .map(([k, n, how, a, s, l, c]) => `<div class="row">${k ? logo(k, 34) : logo('', 34, l, c)}<div class="n"><b>${n}</b><small>${how}</small></div><div class="a"><b>${money(a)}</b><small>${s}</small></div></div>`).join('')}</div>
</section>
<div class="note"><span style="color:var(--acc)">${icon('bank', 22)}</span><div class="n"><b>Bring your transactions in by themselves?</b><small>Connect your banks with SimpleFIN. Off until you turn it on; Alex never sees your banks.</small></div></div>
<section class="card">${ch('Latest transactions', 'All')}
  ${jtx.map(([d, k, n, c, a]) => `<div class="row">${logo(k, 38)}<div class="n"><b>${n}</b><small><i class="dot" style="background:${cat[c]}"></i>${c} · ${d}</small></div><div class="a"><b>−${money(Math.abs(a))}</b></div></div>`).join('')}
</section>
${tabsFor('Finances', 'jordan')}`;
writeFileSync(out + 'phone-jordan.html', html(jor));
export { css as phoneCss, sb, tabsFor, ch, appLogo, html as phoneHtml };
