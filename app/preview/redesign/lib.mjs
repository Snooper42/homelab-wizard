// What the redesign mocks share (docs/Redesign.md): the example household's
// figures (app/preview/finance.json), the app's own logos (web/src/finances/logos.ts),
// icons, money formatting, and the charts. node app/preview/redesign/build.mjs draws them all.
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const out = join(here, 'html') + '/';
mkdirSync(out, { recursive: true });
const fin = JSON.parse(readFileSync(repo + '/app/preview/finance.json', 'utf8'));

// Logos from the app's own logos.ts.
const logoSrc = readFileSync(repo + '/web/src/finances/logos.ts', 'utf8');
const logos = {};
for (const m of logoSrc.matchAll(/^  "([a-z0-9]+)": \{([^\n]*)\},?$/gm)) {
  const body = m[2], get = (k) => (body.match(new RegExp(k + ': "([^"]*)"')) || [])[1];
  logos[m[1]] = { bg: get('bg'), ink: get('ink'), path: get('path'), letters: get('letters') };
}
const logo = (key, size = 28, fallback = '?', bg = '#64748b') => {
  const l = logos[key] || { bg, ink: '#fff', letters: fallback };
  const inner = l.path
    ? `<svg viewBox="0 0 24 24" width="${size * 0.56}" height="${size * 0.56}"><path fill="${l.ink}" d="${l.path}"/></svg>`
    : `<span style="color:${l.ink};font-size:${size * (l.letters.length > 1 ? 0.36 : 0.44)}px">${l.letters}</span>`;
  return `<span class="logo" style="width:${size}px;height:${size}px;background:${l.bg}">${inner}</span>`;
};

// Icons (Lucide-style strokes).
const P = {
  plus: 'M12 5v14M5 12h14', left: 'm15 18-6-6 6-6', right: 'm9 18 6-6-6-6', down: 'm6 9 6 6 6-6',
  eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z|c12,12,3', sync: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5',
  sliders: 'M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4', open: 'M7 7h10v10M7 17 17 7',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z', list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  cal: 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM16 2v4M8 2v4M3 10h18', pie: 'M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10z',
  trend: 'M22 7 13.5 15.5 8.5 10.5 2 17M16 7h6v6', target: 'c12,12,10|c12,12,6|c12,12,2',
  receipt: 'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1ZM16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 17.5v-11',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75|c9,7,4', search: 'm21 21-4.3-4.3|c11,11,8',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2', archive: 'M3 3h18v5H3zM4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4', tidy: 'M3 6h18M7 12h10M10 18h4',
  layers: 'M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83ZM22 17.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65M22 12.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65',
  dollar: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6', check: 'M20 6 9 17l-5-5',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  import: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3', bank: 'M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2l10 5H2z',
  arrowup: 'M7 17 17 7M8 7h9v9', arrowdown: 'M7 7l10 10M17 8v9H8', table: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18',
};
const icon = (n, s = 16, extra = '') => {
  const parts = P[n].split('|').map((d) => (d.startsWith('c') ? (([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`)(d.slice(1).split(',')) : `<path d="${d}"/>`)).join('');
  return `<svg class="ic ${extra}" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${parts}</svg>`;
};
const money = (n, cents = true) => (n < 0 ? '−' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
const big = (n) => { const s = money(n); const i = s.lastIndexOf('.'); return `${s.slice(0, i)}<small>${s.slice(i)}</small>`; };
const short = (n) => (n < 0 ? '−' : '') + '$' + (Math.abs(n) >= 1000 ? (Math.abs(n) / 1000).toFixed(Math.abs(n) >= 100000 ? 1 : 2) + 'k' : Math.abs(n).toFixed(0));
const chip = (v, txt, good = v >= 0) => `<span class="chip ${good ? 'up' : 'dn'}">${icon(v >= 0 ? 'arrowup' : 'arrowdown', 12)}${txt}</span>`;

// Categories and their colours.
const cat = {
  Groceries: '#16a34a', Gas: '#ea580c', Utilities: '#ca8a04', Dining: '#dc2626', Coffee: '#92400e', Subscriptions: '#7c3aed',
  Car: '#2563eb', Insurance: '#0d9488', Shopping: '#db2777', Household: '#4f46e5', Income: '#15803d', Transfer: '#64748b', Home: '#0891b2',
};
const acct = { chk: ['chase', 'Chase Checking'], sav: ['bankofamerica', 'BofA Savings'], visa: ['chase', 'Chase Freedom'], amex: ['americanexpress', 'Amex Gold'] };
// November, Alex's own money (made-up rows in the example household's accounts and bills).
const tx = [
  ['Nov 22', 'costco', 'Costco', 'Groceries', 'visa', -142.36],
  ['Nov 21', 'shell', 'Shell', 'Gas', 'chk', -48.2],
  ['Nov 20', null, "Alex's paycheck", 'Income', 'chk', 2150, 'P'],
  ['Nov 20', 'traderjoes', "Trader Joe's", 'Groceries', 'amex', -63.75],
  ['Nov 18', null, 'PG&E', 'Utilities', 'chk', -136.42, 'PG', 'bill'],
  ['Nov 17', 'starbucks', 'Starbucks', 'Coffee', 'amex', -6.45],
  ['Nov 16', 'chipotle', 'Chipotle', 'Dining', 'visa', -24.8],
  ['Nov 15', 'toyota', 'Toyota Financial', 'Car', 'chk', -412, null, 'bill'],
  ['Nov 14', 'spotify', 'Spotify', 'Subscriptions', 'visa', -11.99, null, 'bill'],
  ['Nov 13', 'amazon', 'Amazon', 'Shopping', 'visa', -38.99],
  ['Nov 12', null, 'GEICO', 'Insurance', 'chk', -168, 'G', 'bill'],
  ['Nov 11', 'amc', 'AMC A-List', 'Subscriptions', 'visa', -29.95, null, 'bill'],
  ['Nov 10', 'target', 'Target', 'Household', 'visa', -57.12],
  ['Nov 9', 'americanexpress', 'Amex Gold payment', 'Transfer', 'chk', -386.2, null, 'bill'],
  ['Nov 9', null, 'Xfinity', 'Utilities', 'chk', -70, 'X', 'bill'],
  ['Nov 7', 'wholefoods', 'Whole Foods', 'Groceries', 'amex', -91.4],
  ['Nov 6', null, "Alex's paycheck", 'Income', 'chk', 2150, 'P'],
  ['Nov 6', 'bankofamerica', 'To BofA Savings', 'Transfer', 'chk', -200, null, 'bill'],
];
const payee = (t, s = 32) => t[1] ? logo(t[1], s) : logo('', s, t[6] || t[2][0], cat[t[3]]);

const worth = fin.worth.map((p) => p.amount);
const spent = {};
for (const t of tx) if (t[5] < 0 && t[3] !== 'Transfer' && t[3] !== 'Income') spent[t[3]] = (spent[t[3]] || 0) - t[5];
const spentTotal = Object.values(spent).reduce((a, b) => a + b, 0);
const inTotal = tx.filter((t) => t[5] > 0).reduce((a, t) => a + t[5], 0);

const per = fin.periods[1];
const steps = [{ d: '11-05', v: per.carried }, { d: '11-06', v: per.carried + per.in, pay: true }];
let run = per.carried + per.in;
for (const r of per.rows) { run -= r.amount; steps.push({ d: r.date.slice(5), v: Math.round(run * 100) / 100 }); }
const dayX = (d) => (Number(d.slice(3)) - (d.startsWith('11') ? 5 : -26)) ;
function stepChart(w, h) {
  const xs = (d) => 8 + (dayX(d) / 15) * (w - 16), max = 2700, ys = (v) => 10 + (1 - v / max) * (h - 30);
  let d = `M${xs(steps[0].d)},${ys(steps[0].v)}`;
  for (let i = 1; i < steps.length; i++) d += ` H${xs(steps[i].d)} V${ys(steps[i].v)}`;
  d += ` H${xs('11-20')}`;
  const area = d + ` V${h - 20} H${xs(steps[0].d)} Z`;
  const ticks = ['11-06', '11-09', '11-12', '11-15', '11-18'].map((t) => `<text x="${xs(t)}" y="${h - 4}" class="tick">Nov ${Number(t.slice(3))}</text>`).join('');
  const dots = steps.slice(1).map((s) => `<circle cx="${xs(s.d)}" cy="${ys(s.v)}" r="3.5" class="${s.pay ? 'dotin' : 'dotout'}"/>`).join('');
  const cushion = `<line x1="8" x2="${w - 8}" y1="${ys(500)}" y2="${ys(500)}" class="cushion"/><text x="14" y="${ys(500) + 13}" class="tick">Cushion $500</text>`;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" class="chart"><path d="${area}" class="area"/>${cushion}<path d="${d}" class="line"/>${dots}${ticks}</svg>`;
}
function areaChart(vals, w, h) {
  const min = Math.min(...vals) * 0.995, max = Math.max(...vals) * 1.002;
  const pts = vals.map((v, i) => [8 + (i / (vals.length - 1)) * (w - 16), 8 + (1 - (v - min) / (max - min)) * (h - 28)]);
  const d = 'M' + pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' L');
  const ticks = [['Aug', 0.0], ['Sep', 0.33], ['Oct', 0.66], ['Nov', 0.98]].map(([t, f]) => `<text x="${8 + f * (w - 16)}" y="${h - 4}" class="tick" text-anchor="${f > 0.9 ? 'end' : 'start'}">${t}</text>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" class="chart"><path d="${d} V${h - 20} H8 Z" class="area"/><path d="${d}" class="line"/>${ticks}</svg>`;
}
function donut(parts, r = 56, wd = 16) {
  const total = parts.reduce((a, p) => a + p[1], 0); let a0 = -Math.PI / 2, s = '';
  for (const [n, v] of parts) {
    const a1 = a0 + (v / total) * Math.PI * 2 - 0.02, large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a) => [70 + r * Math.cos(a), 70 + r * Math.sin(a)].map((x) => x.toFixed(2)).join(',');
    s += `<path d="M${p(a0)} A${r},${r} 0 ${large} 1 ${p(a1)}" stroke="${cat[n]}" stroke-width="${wd}" fill="none"/>`; a0 = a1 + 0.02;
  }
  return `<svg viewBox="0 0 140 140" width="118" height="118" style="flex:none">${s}<text x="70" y="66" text-anchor="middle" class="dl">Spent</text><text x="70" y="86" text-anchor="middle" class="dv">${money(total, false)}</text></svg>`;
}
export { repo, out, fin, logos, logo, icon, money, big, short, chip, cat, acct, tx, payee, worth, spent, spentTotal, inTotal, per, steps, stepChart, areaChart, donut, P };
