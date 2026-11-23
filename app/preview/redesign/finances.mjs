// Redesign mock of Finances on the computer (docs/Redesign.md): the Dashboard
// and Transactions, from the preview's example household.
import { writeFileSync } from 'node:fs';
import { repo, out, logo, icon, money, big, short, chip, cat, acct, tx, payee, worth, spent, spentTotal, inTotal, per, stepChart, areaChart, donut } from './lib.mjs';

// Sidebar, shared by both pages.
const groups = [
  ['Cash', '#2563eb', [['chase', 'Chase Checking', 2512.4], ['bankofamerica', 'BofA Savings', 6500]]],
  ['Credit cards', '#dc2626', [['chase', 'Chase Freedom', -1324.65], ['americanexpress', 'Amex Gold', -386.2]]],
  ['Investments', '#ea580c', [['robinhood', 'Robinhood', 8200], ['robinhood', 'Roth IRA', 14600], ['fidelity', 'Fidelity 401(k)', 38500]]],
  ['Home & car', '#f59e0b', [['zillow', 'Home', 410000], ['toyota', '2022 RAV4', 18500]]],
  ['Loans', '#7c3aed', [['wellsfargo', 'Mortgage', -287400], ['toyota', 'Toyota Financial', -11240]]],
];
const sidebar = (page) => `
<aside class="side">
  <div class="brand"><img src="file://${repo}/assets/logo.svg" width="26" height="26"><div><b>Homelab Wizard</b></div></div>
  <nav class="apps" aria-label="Homelab">
    ${[['layers', 'Choose apps'], ['activity', 'Status'], ['archive', 'Backups'], ['tidy', 'Tidy Up'], ['dollar', 'Finances']].map(([i, n]) => `<span class="${n === 'Finances' ? 'on' : ''}" title="${n}">${icon(i, 17)}</span>`).join('')}
  </nav>
  <nav class="fnav">
    ${[['grid', 'Dashboard'], ['list', 'Transactions'], ['target', 'Budgets'], ['receipt', 'Bills & paychecks'], ['cal', 'Calendar'], ['users', 'Shared with Jordan'], ['trend', 'Net worth'], ['pie', 'Reports']]
      .map(([i, n]) => `<a class="${n.toLowerCase() === page ? 'on' : ''}">${icon(i, 17)}<span>${n}</span></a>`).join('')}
  </nav>
  <div class="acchead"><span>ACCOUNTS</span><span class="mini">${icon('eye', 14)}</span><span class="mini">${icon('plus', 14)}</span></div>
  <div class="accts">
    ${groups.map(([g, c, list]) => `<div class="grp"><div class="gname">${icon('down', 13, 'muted')}<i style="background:${c}"></i><span>${g}</span><b>${short(list.reduce((a, x) => a + x[2], 0))}</b></div>
      ${list.map(([k, n, v]) => `<div class="arow">${logo(k, 22)}<span>${n}</span><b class="${v < 0 ? 'neg' : ''}">${short(v)}</b></div>`).join('')}</div>`).join('')}
  </div>
  <div class="foot">
    <div class="who"><span class="av">A</span><div><b>Alex</b><small>Your own Finances</small></div>${icon('down', 14, 'muted')}</div>
    <div class="synced"><i></i>Banks read 7:02 AM</div>
  </div>
</aside>`;

const topbar = (addLabel) => `
<header class="top">
  <div class="split"><button class="primary">${icon('plus', 16)}${addLabel}</button><button class="primary caret">${icon('down', 16)}</button></div>
  <div class="period">
    <button class="ghost">${icon('left', 16)}</button>
    <div><b>Alex's paycheck</b><small>Fri, Nov 6 – Thu, Nov 19</small></div>
    <button class="ghost">${icon('right', 16)}</button>
    <div class="seg"><span class="on">Paycheck</span><span>Month</span></div>
  </div>
  <div class="tools"><button class="sq" title="Hide amounts">${icon('eye', 17)}</button><button class="sq" title="Read banks now">${icon('sync', 17)}</button><button class="sq" title="Customize">${icon('sliders', 17)}</button></div>
</header>`;

const cardHead = (title, actions = ['open']) => `<div class="ch"><h3>${title}</h3><span class="acts">${actions.map((a) => `<span class="mini">${icon(a, 15)}</span>`).join('')}</span></div>`;

const css = `
@font-face{font-family:X;src:local('Inter')}
:root{--bg:#f4f5f8;--panel:#fff;--sunken:#f7f8fa;--text:#0f172a;--muted:#64748b;--line:#e6e8ee;--line2:#d5d9e2;--acc:#6d4ae0;--acc-ink:#5b3fd6;--acc-soft:#efebfc;--in:#157a3a;--in-soft:#e7f6ee;--out:#c2410c;--out-soft:#fdeee6;--side:#fbfbfc;--shadow:0 1px 2px rgba(15,23,42,.04),0 1px 1px rgba(15,23,42,.03)}
@media (prefers-color-scheme:dark){:root{--bg:#0d0d0f;--panel:#17171a;--sunken:#121215;--text:#ececf1;--muted:#9a9aa6;--line:#26262b;--line2:#3a3a42;--acc:#9c86f5;--acc-ink:#b8a9ff;--acc-soft:#251f3d;--in:#5bd69c;--in-soft:#12291e;--out:#ff8a73;--out-soft:#2f1a15;--side:#121215;--shadow:none}}
*{box-sizing:border-box}body{background:linear-gradient(to right,var(--side) 248px,var(--line) 248px,var(--line) 249px,var(--bg) 249px)!important;margin:0;font:14px/1.45 Inter,system-ui,sans-serif;background:var(--bg);color:var(--text);display:flex;-webkit-font-smoothing:antialiased;font-feature-settings:'cv11','ss01'}
.ic{flex:none}.muted{color:var(--muted)}
.side{width:248px;flex:none;height:100vh;position:sticky;top:0;background:var(--side);border-right:1px solid var(--line);display:flex;flex-direction:column;padding:14px 12px 12px;gap:6px}
.brand{display:flex;align-items:center;gap:10px;padding:2px 6px 8px;font-size:14.5px}
.apps{display:flex;gap:2px;padding:4px;background:var(--sunken);border:1px solid var(--line);border-radius:10px;margin-bottom:6px}
.apps span{flex:1;display:grid;place-items:center;height:30px;border-radius:7px;color:var(--muted)}.apps span.on{background:var(--panel);color:var(--acc);box-shadow:var(--shadow);outline:1px solid var(--line)}
.fnav a{display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:8px;color:var(--text);font-weight:500;font-size:13.5px}.fnav a .ic{color:var(--muted)}
.fnav a.on{background:var(--panel);outline:1px solid var(--line);box-shadow:var(--shadow)}.fnav a.on .ic{color:var(--acc)}
.acchead{display:flex;align-items:center;gap:6px;margin:12px 4px 2px;font-size:11px;letter-spacing:.06em;color:var(--muted);font-weight:600}.acchead span:first-child{flex:1}
.mini{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:7px;border:1px solid var(--line);color:var(--muted);background:var(--panel)}
.accts{overflow:hidden;flex:1;mask-image:linear-gradient(#000 85%,transparent)}
.gname,.arow{display:flex;align-items:center;gap:8px;padding:4px 6px;font-size:13px}.gname{font-weight:600;margin-top:4px}.gname i{width:8px;height:8px;border-radius:50%}
.gname>span:not(.logo),.arow>span:not(.logo){flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gname b,.arow b{font-variant-numeric:tabular-nums;font-weight:600}.arow{padding-left:22px}.arow b{font-weight:500}.neg{color:var(--out)}
.foot{border-top:1px solid var(--line);padding-top:10px;display:grid;gap:8px}
.who{display:flex;align-items:center;gap:10px;padding:4px 6px}.who div{flex:1;display:grid}.who small{color:var(--muted);font-size:12px}
.av{width:30px;height:30px;border-radius:50%;background:var(--acc-soft);color:var(--acc-ink);display:grid;place-items:center;font-weight:700}
.synced{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted);padding:0 8px}.synced i{width:7px;height:7px;border-radius:50%;background:var(--in)}
.logo{display:inline-grid;place-items:center;border-radius:50%;flex:none;font-weight:700;font-family:Inter}
main{flex:1;min-width:0;padding:0 24px 28px}
.top{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:16px;padding:14px 0;background:var(--bg)}
button{font:inherit;border:0;cursor:pointer}
.split{display:flex}.primary{display:flex;align-items:center;gap:8px;background:var(--acc);color:#fff;padding:0 16px;height:38px;border-radius:10px 0 0 10px;font-weight:600}
@media (prefers-color-scheme:dark){.primary{color:#140c33}}
.primary.caret{border-radius:0 10px 10px 0;padding:0 10px;margin-left:1px}
.period{flex:1;display:flex;align-items:center;justify-content:center;gap:10px}.period>div:not(.seg){display:grid;text-align:center;min-width:220px}.period small{color:var(--muted);font-size:12.5px}
.ghost{background:none;color:var(--muted);width:32px;height:32px;border-radius:8px;display:grid;place-items:center}
.seg{display:flex;background:var(--sunken);border:1px solid var(--line);border-radius:9px;padding:3px;font-size:12.5px;font-weight:600;margin-left:6px}.seg span{padding:4px 10px;border-radius:6px;color:var(--muted)}.seg span.on{background:var(--panel);color:var(--text);box-shadow:var(--shadow);outline:1px solid var(--line)}
.tools{display:flex;gap:8px}.sq{width:38px;height:38px;border-radius:10px;background:var(--panel);border:1px solid var(--line);color:var(--muted);display:grid;place-items:center}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:18px 20px;box-shadow:var(--shadow);min-width:0}
.ch{display:flex;align-items:center;gap:8px;margin-bottom:10px}.ch h3{margin:0;font-size:14.5px;font-weight:600;flex:1}.acts{display:flex;gap:6px}
.fig{font-size:30px;font-weight:650;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1.1}.fig small{font-size:.6em;color:var(--muted);font-weight:600}
.lab{font-size:11px;letter-spacing:.07em;color:var(--muted);font-weight:600;text-transform:uppercase;margin-top:4px}
.figrow{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.chip{display:inline-flex;align-items:center;gap:3px;font-size:12px;font-weight:600;padding:3px 8px;border-radius:999px;white-space:nowrap}.chip.up{background:var(--in-soft);color:var(--in)}.chip.dn{background:var(--out-soft);color:var(--out)}
.vs{font-size:11.5px;color:var(--muted);text-align:right;margin-top:4px}
.chart .line{fill:none;stroke:var(--acc);stroke-width:2.2;vector-effect:non-scaling-stroke}.chart .area{fill:var(--acc);opacity:.10}
.chart .tick{font-size:10.5px;fill:var(--muted)}.dl{font-size:11px;fill:var(--muted)}.dv{font-size:15px;font-weight:700;fill:var(--text)}.chart .cushion{stroke:var(--out);stroke-dasharray:3 4;opacity:.6;vector-effect:non-scaling-stroke}
.dotin{fill:var(--in)}.dotout{fill:var(--panel);stroke:var(--out);stroke-width:2}
.trio{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:8px}.trio div{background:var(--sunken);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.trio b{display:block;font-size:16px;font-variant-numeric:tabular-nums}.trio span{font-size:11px;letter-spacing:.06em;color:var(--muted);font-weight:600;text-transform:uppercase}
.txl{display:grid}.txr{display:flex;align-items:center;gap:12px;padding:9px 0;border-top:1px solid var(--line)}.txr:first-child{border-top:0}
.txr .n{flex:1;min-width:0;display:grid}.txr .n b{font-weight:550;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.txr .n small{color:var(--muted);font-size:12px;display:flex;align-items:center;gap:5px}
.txr .a{text-align:right;display:grid;font-variant-numeric:tabular-nums}.txr .a b{font-weight:600}.txr .a small{color:var(--muted);font-size:12px}.pos{color:var(--in)}
.dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex:none}
.bar{height:8px;border-radius:99px;background:var(--sunken);border:1px solid var(--line);overflow:hidden;display:flex}.bar i{display:block;height:100%}
.legend{display:grid;gap:7px;font-size:12.5px;flex:1;min-width:0}.legend div{display:flex;align-items:center;gap:8px}.legend span{flex:1}.legend b{font-variant-numeric:tabular-nums;font-weight:550}.legend em{color:var(--muted);font-style:normal;width:30px;text-align:right;font-size:12px}
.bud{display:grid;gap:14px}.bud .r{display:grid;gap:6px}.bud .t{display:flex;justify-content:space-between;font-size:13px}.bud .t b{font-weight:550}.bud .t span{color:var(--muted);font-variant-numeric:tabular-nums}
.pill{font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:99px;background:var(--acc-soft);color:var(--acc-ink)}
.btn{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;padding:5px 10px;border-radius:8px;border:1px solid var(--line2);background:var(--panel);color:var(--text)}
.span2{grid-column:span 2}.row2{grid-row:span 2}
/* Transactions */
.filters{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.field{display:flex;align-items:center;gap:8px;height:36px;padding:0 12px;border-radius:9px;border:1px solid var(--line);background:var(--panel);color:var(--muted);font-size:13px}
.field.grow{flex:1;min-width:220px}.field b{color:var(--text);font-weight:550}
.sumline{display:flex;gap:18px;align-items:center;font-size:13px;color:var(--muted)}.sumline b{color:var(--text);font-variant-numeric:tabular-nums}
table{width:100%;border-collapse:collapse;font-size:13.5px}th{font-size:11.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);font-weight:600;text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);background:var(--sunken)}
td{padding:9px 12px;border-bottom:1px solid var(--line);white-space:nowrap}td.amt,th.amt{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
.cell{display:flex;align-items:center;gap:10px}.box{width:16px;height:16px;border:1.5px solid var(--line2);border-radius:4px;display:inline-block}
.catb{display:inline-flex;align-items:center;gap:7px;padding:3px 10px 3px 8px;border-radius:99px;font-size:12.5px;font-weight:550}
.billtag{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;color:var(--acc-ink);font-weight:600}
.tablecard{padding:0;overflow:hidden}.tablehead{display:flex;align-items:center;gap:12px;padding:12px 16px}
.daysep td{background:var(--bg);font-size:12px;font-weight:600;color:var(--muted);padding:6px 12px}
`;

const page = (title, body, pageKey) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${css}</style></head><body>${sidebar(pageKey)}<main>${body}</main></body></html>`;

// ---------- Dashboard ----------
const dash = `
${topbar('Add transaction')}
<div class="grid">
  <section class="card span2">
    ${cardHead('Left after this paycheck\'s bills', ['open', 'sliders'])}
    <div class="figrow">
      <div><div class="fig">${big(per.left)}</div><div class="lab">In checking on Nov 19, after 10 bills</div></div>
      <div>${chip(331.86, '+$331.86')}<div class="vs">vs last paycheck</div></div>
    </div>
    ${stepChart(720, 150)}
    <div class="trio">
      <div><span>Checking now</span><b>${money(2512.4)}</b></div>
      <div><span>After payday, Nov 6</span><b>${money(per.carried + per.in)}</b></div>
      <div><span>Bills left · 10</span><b class="neg">${money(-per.out)}</b></div>
    </div>
  </section>
  <section class="card row2">
    ${cardHead('Latest transactions', ['open'])}
    <div class="txl">
      ${tx.slice(0, 9).map((t) => `<div class="txr">${payee(t, 32)}<div class="n"><b>${t[2]}</b><small><i class="dot" style="background:${cat[t[3]]}"></i>${t[3]}${t[7] ? ' · ' + icon('link', 11) + ' bill' : ''}</small></div><div class="a"><b class="${t[5] > 0 ? 'pos' : ''}">${t[5] > 0 ? '+' : '−'}${money(Math.abs(t[5]))}</b><small>${t[0]}</small></div></div>`).join('')}
    </div>
  </section>
  <section class="card">
    ${cardHead('Net worth', ['open'])}
    <div class="figrow"><div><div class="fig">${big(worth.at(-1))}</div><div class="lab">Today</div></div><div>${chip(20299, '+$20,299')}<div class="vs">past 3 months</div></div></div>
    ${areaChart(worth, 360, 120)}
  </section>
  <section class="card">
    ${cardHead('Cash flow', ['open'])}
    <div class="figrow"><div><div class="fig pos">+${big(inTotal - spentTotal)}</div><div class="lab">November so far</div></div><div>${chip(12.4, '+12.4%')}<div class="vs">vs October</div></div></div>
    <div class="bar" style="margin:14px 0 12px"><i style="width:${(spentTotal / inTotal) * 100}%;background:var(--out)"></i><i style="flex:1;background:var(--in)"></i></div>
    <div class="trio"><div><span>In</span><b class="pos">${money(inTotal, false)}</b></div><div><span>Out</span><b class="neg">${money(spentTotal, false)}</b></div><div><span>Kept</span><b>${Math.round((1 - spentTotal / inTotal) * 100)}%</b></div></div>
  </section>
  <section class="card">
    ${cardHead('Where the money went', ['list', 'open'])}
    <div style="display:flex;gap:14px;align-items:center">
      ${donut(Object.entries(spent).sort((a, b) => b[1] - a[1]))}
      <div class="legend">${Object.entries(spent).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, v]) => `<div><i class="dot" style="background:${cat[n]}"></i><span>${n}</span><b>${money(v, false)}</b><em>${Math.round((v / spentTotal) * 100)}%</em></div>`).join('')}</div>
    </div>
  </section>
  <section class="card">
    ${cardHead('Coming up', ['cal', 'open'])}
    <div class="txl">
      ${[['Nov 26', null, 'HOA', 310, 'H', '#0891b2'], ['Nov 28', 'netflix', 'Netflix', 15.49], ['Dec 1', 'wellsfargo', 'Mortgage', 1845, null, null, 'shared'], ['Dec 1', 'peloton', 'Peloton', 44], ['Dec 3', 'verizon', 'Verizon', 95]]
        .map(([d, k, n, a, l, c, sh]) => `<div class="txr">${k ? logo(k, 30) : logo('', 30, l, c)}<div class="n"><b>${n}${sh ? ' <span class="pill">Shared</span>' : ''}</b><small>${d}</small></div><div class="a"><b>${money(a)}</b>${sh ? '<small>Jordan pays $922.50</small>' : ''}</div></div>`).join('')}
    </div>
  </section>
  <section class="card">
    ${cardHead('Shared with Jordan', ['users', 'open'])}
    <div class="figrow"><div><div class="fig">${big(1060.71)}</div><div class="lab">Jordan's part this month</div></div><div><span class="chip up">${icon('check', 12)}1 of 3 settled</span></div></div>
    <div class="txl" style="margin-top:8px">
      ${[['wellsfargo', 'Mortgage', '50/50', 922.5, false], [null, 'PG&E', '50/50', 68.21, true, 'PG', '#ca8a04'], [null, 'Xfinity', 'Jordan pays it all', 70, false, 'X', '#ca8a04']]
        .map(([k, n, how, a, done, l, c]) => `<div class="txr">${k ? logo(k, 28) : logo('', 28, l, c)}<div class="n"><b>${n}</b><small>${how}</small></div><div class="a"><b>${money(a)}</b><small>${done ? '<span class="pos">Paid you</span>' : 'Due Dec 1'}</small></div></div>`).join('')}
    </div>
  </section>
  <section class="card span2">
    ${cardHead('Budgets', ['sliders', 'open'])}
    <div class="bud" style="grid-template-columns:1fr 1fr;column-gap:28px">
      ${[['Food', 297.95, 600, '#16a34a'], ['Car', 48.2, 300, '#2563eb'], ['Subscriptions', 200, 150, '#7c3aed'], ['Fun', 61.8, 200, '#db2777'], ['Household', 57.12, 150, '#4f46e5'], ['Coffee', 6.45, 40, '#92400e']].map(([n, s, b, c]) => `<div class="r"><div class="t"><b>${n}</b><span>${money(s, false)} of ${money(b, false)} · <em style="font-style:normal;color:${s > b ? 'var(--out)' : 'var(--muted)'}">${s > b ? money(s - b, false) + ' over' : money(b - s, false) + ' left'}</em></span></div><div class="bar"><i style="width:${Math.min(100, (s / b) * 100)}%;background:${s > b ? 'var(--out)' : c}"></i></div></div>`).join('')}
    </div>
  </section>
  <section class="card">
    ${cardHead('Investments', ['open'])}
    <div class="figrow"><div><div class="fig">${big(61300)}</div><div class="lab">3 accounts</div></div><div>${chip(1840, '+3.1%')}<div class="vs">this month</div></div></div>
    <div class="txl" style="margin-top:8px">${[['fidelity', 'Fidelity 401(k)', 38500, 2.4], ['robinhood', 'Roth IRA', 14600, 3.9], ['robinhood', 'Robinhood', 8200, 4.6]].map(([k, n, v, c]) => `<div class="txr">${logo(k, 26)}<div class="n"><b>${n}</b></div><div class="a"><b>${money(v, false)}</b><small class="pos">+${c}%</small></div></div>`).join('')}</div>
  </section>
</div>`;
writeFileSync(out + 'dashboard.html', page('Finances', dash, 'dashboard'));

// ---------- Transactions ----------
const days = [...new Set(tx.map((t) => t[0]))];
const rows = days.map((d) => {
  const list = tx.filter((t) => t[0] === d), net = list.reduce((a, t) => a + t[5], 0);
  return `<tr class="daysep"><td colspan="5">${d}, 2026</td><td class="amt" style="font-weight:600">${net > 0 ? '+' : '−'}${money(Math.abs(net))}</td></tr>` +
    list.map((t) => `<tr><td style="width:36px"><span class="box"></span></td>
      <td><div class="cell">${payee(t, 28)}<b style="font-weight:550">${t[2]}</b></div></td>
      <td><span class="catb" style="background:color-mix(in srgb, ${cat[t[3]]} 14%, transparent);color:color-mix(in srgb, ${cat[t[3]]} 80%, var(--text))"><i class="dot" style="background:${cat[t[3]]}"></i>${t[3]}</span></td>
      <td><div class="cell">${logo(acct[t[4]][0], 20)}<span>${acct[t[4]][1]}</span></div></td>
      <td>${t[7] ? `<span class="billtag">${icon('link', 12)}Planned bill</span>` : t[3] === 'Income' ? '<span class="billtag">' + icon('link', 12) + 'Paycheck</span>' : '<span class="muted">—</span>'}</td>
      <td class="amt ${t[5] > 0 ? 'pos' : ''}">${t[5] > 0 ? '+' : '−'}${money(Math.abs(t[5]))}</td></tr>`).join('');
}).join('');
const txPage = `
${topbar('Add transaction')}
<section class="card" style="padding:14px 16px;margin-bottom:16px">
  <div class="filters">
    <div class="field grow">${icon('search', 16)}Search payees, notes, amounts</div>
    <div class="field">${icon('cal', 15)}<b>Nov 6 – Nov 19</b>${icon('down', 14)}</div>
    <div class="field"><b>All accounts</b>${icon('down', 14)}</div>
    <div class="field"><b>All categories</b>${icon('down', 14)}</div>
    <div class="field"><b>In and out</b>${icon('down', 14)}</div>
    <button class="btn">${icon('import', 14)}Import a file</button>
  </div>
</section>
<section class="card" style="margin-bottom:16px;padding:14px 18px">
  <div style="display:flex;align-items:center;gap:14px">
    <span style="font-weight:600;flex:1;display:flex;align-items:center;gap:8px">${icon('sync', 16, 'muted')}3 new from your banks this morning <span class="muted" style="font-weight:400">· 2 matched to planned bills, 1 needs a category</span></span>
    <button class="btn">Review 1</button>
  </div>
</section>
<section class="card tablecard">
  <div class="tablehead">
    <div class="sumline"><span><b>${tx.length}</b> transactions</span><span>In <b class="pos">${money(inTotal)}</b></span><span>Out <b class="neg">${money(-tx.filter((t) => t[5] < 0).reduce((a, t) => a - t[5], 0))}</b></span></div>
    <span style="flex:1"></span>
    <div class="seg"><span class="on">${icon('table', 14)}</span><span>${icon('list', 14)}</span></div>
  </div>
  <table>
    <thead><tr><th><span class="box"></span></th><th>Payee</th><th>Category</th><th>Account</th><th>Linked to</th><th class="amt">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>`;
writeFileSync(out + 'transactions.html', page('Transactions', txPage, 'transactions'));
export { css as deskCss };
