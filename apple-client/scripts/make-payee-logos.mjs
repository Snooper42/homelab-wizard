#!/usr/bin/env node
// Makes the iPhone app's payee logos from the computer's own, so the two
// never drift apart and nothing is copied by hand:
//
//     npm ci                                      # once, in the repo's root
//     node apple-client/scripts/make-payee-logos.mjs           # writes both files
//     node apple-client/scripts/make-payee-logos.mjs --check   # only says if they're current
//
// It reads web/src/finances/logos.ts (the brands: simple-icons, CC0),
// Mark.tsx (how a name finds its brand, and the icons for what a payment
// is for), payees.ts (a bank's wording made a person's), hues.ts and
// web/dist/style.css (the category colours), by compiling them with the
// frontend's own esbuild, and writes:
//
//   Shared/Resources/PayeeLogos.json   the app's copy: brands, the rules
//                                      that match a payee to one, colours
//   Tests/Resources/PayeeVectors.json  what the computer's own functions
//                                      answer for a few thousand payees,
//                                      so the Swift tests can check the
//                                      app's port answers the same
//
// Each brand's mark is rewritten as absolute moves, lines and cubic
// curves only (M, L, C, Z), so the app's drawing code stays a few lines.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const client = join(here, '..');
const repo = join(client, '..');
const fin = join(repo, 'web', 'src', 'finances');
const check = process.argv.includes('--check');

// The private tables a module keeps to itself, exported for this script only.
const extra = {
  'Mark.tsx': `
export const __mark = { aliases, loose: [...loose], tails: [...tails], models, hints, plainKinds: [...plainKinds],
  glyphs: Object.keys(kindIcons), brandTypes, brandKinds, autoHues };`,
  'payees.ts': `
export const __payees = { processors: [...processors], leading: leading.source, states: [...states], chains };`,
  'hues.ts': `
export const __hues = { hues, kindCategory };`,
};
const entry = `
export { brands } from ${JSON.stringify(join(fin, 'logos.ts'))};
export { cleanPayee, bankWording, shownNote, __payees } from ${JSON.stringify(join(fin, 'payees.ts'))};
export { brandOf, payeeBrand, autoMark, hintOf, __mark } from ${JSON.stringify(join(fin, 'Mark.tsx'))};
export { alike } from ${JSON.stringify(join(fin, 'importData.ts'))};
export { categoryHue, kindHue, kindHueOf, __hues } from ${JSON.stringify(join(fin, 'hues.ts'))};
`;
const out = await build({
  stdin: { contents: entry, resolveDir: fin, loader: 'ts' },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  jsx: 'automatic',
  jsxImportSource: 'preact',
  logLevel: 'error',
  plugins: [{
    name: 'tables',
    setup(b) {
      b.onLoad({ filter: /web[\\/]src[\\/]finances[\\/](Mark\.tsx|payees\.ts|hues\.ts)$/ }, (args) => {
        const name = args.path.split(/[\\/]/).pop();
        return { contents: readFileSync(args.path, 'utf8') + extra[name], loader: name.endsWith('x') ? 'tsx' : 'ts' };
      });
    },
  }],
});
const web = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));

// ---------------------------------------------------------------------------
// A path in absolute M, L, C and Z only.

/** The numbers and commands of an SVG path, with an arc's two flags read as one digit each ("a1 1 0 011 1"). */
function* tokens(d) {
  let i = 0;
  const num = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;
  let cmd = '', argn = 0;
  while (i < d.length) {
    const c = d[i];
    if (/[\s,]/.test(c)) { i++; continue; }
    if (/[MmLlHhVvCcSsQqTtAaZz]/.test(c)) { cmd = c; argn = 0; yield c; i++; continue; }
    // An arc's 4th and 5th numbers are flags: a single 0 or 1.
    if ((cmd === 'a' || cmd === 'A') && (argn % 7 === 3 || argn % 7 === 4) && (c === '0' || c === '1')) {
      yield Number(c); i++; argn++; continue;
    }
    const m = d.slice(i).match(num);
    if (!m) throw new Error(`can't read the path at ${i}: ${d.slice(i, i + 20)}`);
    yield Number(m[0]); i += m[0].length; argn++;
  }
}

const counts = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

/** The path's segments, absolute: [['M', x, y], ['L', x, y], ['C', x1, y1, x2, y2, x, y], ['Z']]. */
function normalize(d) {
  const t = [...tokens(d)];
  const segs = [];
  let i = 0, x = 0, y = 0, sx = 0, sy = 0;
  let lastC = null, lastQ = null; // the last control point, for S and T
  let cmd = null;
  while (i < t.length) {
    if (typeof t[i] === 'string') cmd = t[i++];
    else if (!cmd) throw new Error('a path starts with a number');
    const up = cmd.toUpperCase(), rel = cmd !== up;
    if (up === 'Z') {
      segs.push(['Z']); x = sx; y = sy; lastC = lastQ = null;
      // Numbers after a Z are an error in SVG; none in simple-icons.
      if (typeof t[i] === 'number') throw new Error('numbers after Z');
      continue;
    }
    const n = counts[up];
    const a = t.slice(i, i + n);
    if (a.length < n || a.some((v) => typeof v !== 'number')) throw new Error(`${cmd} needs ${n} numbers`);
    i += n;
    const ox = rel ? x : 0, oy = rel ? y : 0;
    let nextC = null, nextQ = null;
    switch (up) {
      case 'M':
        x = a[0] + ox; y = a[1] + oy; sx = x; sy = y; segs.push(['M', x, y]);
        cmd = rel ? 'l' : 'L'; // more pairs after a move are lines
        break;
      case 'L': x = a[0] + ox; y = a[1] + oy; segs.push(['L', x, y]); break;
      case 'H': x = a[0] + (rel ? x : 0); segs.push(['L', x, y]); break;
      case 'V': y = a[0] + (rel ? y : 0); segs.push(['L', x, y]); break;
      case 'C': {
        const c = ['C', a[0] + ox, a[1] + oy, a[2] + ox, a[3] + oy, a[4] + ox, a[5] + oy];
        segs.push(c); nextC = [c[3], c[4]]; x = c[5]; y = c[6]; break;
      }
      case 'S': {
        const [rx, ry] = lastC ? [2 * x - lastC[0], 2 * y - lastC[1]] : [x, y];
        const c = ['C', rx, ry, a[0] + ox, a[1] + oy, a[2] + ox, a[3] + oy];
        segs.push(c); nextC = [c[3], c[4]]; x = c[5]; y = c[6]; break;
      }
      case 'Q': case 'T': {
        const [qx, qy] = up === 'Q' ? [a[0] + ox, a[1] + oy] : lastQ ? [2 * x - lastQ[0], 2 * y - lastQ[1]] : [x, y];
        const [ex, ey] = up === 'Q' ? [a[2] + ox, a[3] + oy] : [a[0] + ox, a[1] + oy];
        segs.push(['C', x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey), ex, ey]);
        nextQ = [qx, qy]; x = ex; y = ey; break;
      }
      case 'A': {
        const ex = a[5] + ox, ey = a[6] + oy;
        for (const c of arc(x, y, a[0], a[1], a[2], a[3], a[4], ex, ey)) segs.push(c);
        x = ex; y = ey; break;
      }
    }
    lastC = nextC; lastQ = nextQ;
  }
  return segs;
}

/** An elliptical arc as cubic curves of a quarter turn or less (SVG's own conversion, F.6). */
function arc(x1, y1, rx, ry, angle, large, sweep, x2, y2) {
  if (x1 === x2 && y1 === y2) return [];
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (!rx || !ry) return [['L', x2, y2]];
  const phi = (angle * Math.PI) / 180, cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy, y1p = -sin * dx + cos * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let k = Math.sqrt(Math.max(0, num / den));
  if (large === sweep) k = -k;
  const cxp = (k * rx * y1p) / ry, cyp = (-k * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const parts = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9));
  const step = dt / parts;
  const h = (4 / 3) * Math.tan(step / 4);
  const point = (t) => {
    const ct = Math.cos(t), st = Math.sin(t);
    return [cx + rx * ct * cos - ry * st * sin, cy + rx * ct * sin + ry * st * cos, -rx * st * cos - ry * ct * sin, -rx * st * sin + ry * ct * cos];
  };
  const out = [];
  let t = t1, p = point(t);
  for (let n = 0; n < parts; n++) {
    const q = point(t + step);
    out.push(['C', p[0] + h * p[2], p[1] + h * p[3], q[0] - h * q[2], q[1] - h * q[3], n === parts - 1 ? x2 : q[0], n === parts - 1 ? y2 : q[1]]);
    t += step; p = q;
  }
  return out;
}

/** A number in as few characters as it takes, to a thousandth. */
const num = (v) => {
  const r = Math.round(v * 1000) / 1000;
  return String(Object.is(r, -0) ? 0 : r);
};

/** Segments as the app reads them: each command's letter, then its numbers, a space between. */
const written = (segs) => segs.map(([c, ...n]) => c + n.map(num).join(' ')).join('');

// ---------------------------------------------------------------------------
// Colours, from style.css: the first :root block is the light look, the
// one under prefers-color-scheme: dark the dark look.

const css = readFileSync(join(repo, 'web', 'dist', 'style.css'), 'utf8');
const lightBlock = css.match(/:root\s*\{([\s\S]*?)\n\}/)[1];
const darkBlock = css.match(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([\s\S]*?)\n {2}\}/)[1];
const token = (block, name) => {
  const m = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\b`));
  return m ? m[1].toLowerCase() : undefined;
};
const catColours = (block, fallback) => Array.from({ length: web.__hues.hues }, (_, i) => {
  const get = (n) => token(block, n) ?? token(fallback, n);
  const c = { base: get(`cat-${i + 1}`), soft: get(`cat-${i + 1}-soft`), ink: get(`cat-${i + 1}-ink`) };
  if (!c.base || !c.soft || !c.ink) throw new Error(`style.css has no --cat-${i + 1} colours`);
  return c;
});
const autoColours = Array.from({ length: web.__mark.autoHues }, (_, i) => {
  const c = token(lightBlock, `auto-${i}`);
  if (!c) throw new Error(`style.css has no --auto-${i}`);
  return c;
});

// ---------------------------------------------------------------------------
// The app's copy.

const hex = /^#[0-9a-fA-F]{6}$/;
const sixDigits = (c) => (c.length === 4 ? '#' + [...c.slice(1)].map((x) => x + x).join('') : c).toLowerCase();
const brands = Object.entries(web.brands).map(([key, b]) => {
  const bg = sixDigits(b.bg), ink = sixDigits(b.ink);
  if (!hex.test(bg) || !hex.test(ink)) throw new Error(`${key}: a colour that isn't #rrggbb`);
  const o = { key, name: b.name, bg, ink, kind: b.kind || '' };
  if (b.path) o.path = written(normalize(b.path));
  else if (b.letters) o.letters = b.letters;
  else throw new Error(`${key}: neither a path nor letters`);
  return o;
});

const m = web.__mark, p = web.__payees;
const logos = {
  about: 'Made by apple-client/scripts/make-payee-logos.mjs from web/src/finances (logos.ts: simple-icons, CC0; Mark.tsx; payees.ts; hues.ts) and web/dist/style.css. Do not edit: run the script.',
  brands,
  aliases: Object.entries(m.aliases),
  loose: m.loose,
  tails: m.tails,
  models: Object.entries(m.models),
  hints: m.hints,
  plainKinds: m.plainKinds,
  glyphs: m.glyphs,
  brandTypes: m.brandTypes,
  brandKinds: m.brandKinds,
  payee: { processors: p.processors, leading: p.leading, states: p.states, chains: p.chains },
  colours: {
    category: { light: catColours(lightBlock, lightBlock), dark: catColours(darkBlock, lightBlock) },
    auto: autoColours,
  },
  kindHue: web.kindHue,
  kindCategory: web.__hues.kindCategory,
};

// ---------------------------------------------------------------------------
// What the computer's functions answer, for the Swift tests.

const upper = (s) => s.toUpperCase();
const names = new Set();
for (const b of Object.values(web.brands)) {
  names.add(b.name);
  names.add(upper(b.name));
  names.add(`POS DEBIT ${upper(b.name)} 57444 SAN JOSE CA`);
  names.add(`SQ *${upper(b.name)}`);
  names.add(`${b.name} subscription`);
}
for (const [a] of Object.entries(m.aliases)) { names.add(a); names.add(upper(a) + '.COM'); }
for (const [w] of p.chains) { names.add(upper(w) + ' #1234'); names.add(`${upper(w)} 00042 PORTLAND OR`); }
for (const [glyph, list] of m.hints) for (const w of list) names.add(`${w[0].toUpperCase()}${w.slice(1)} bill`), names.add(glyph);
[
  'NETFLIX.COM', 'AMZN MKTP US*2K4', 'SQ *BLUE BOTTLE', "TST* JOE'S CAFE 0042", 'PAYPAL *SPOTIFY', 'POS DEBIT SHELL OIL 57444 SAN JOSE CA',
  'WM SUPERCENTER #1234', 'Delta Dental', 'Delta', 'Delta Air Lines', 'Farmers market', 'Steam subscription', 'Box plan', 'Box of chocolates',
  'Maxwell', 'Max', 'HBO Max', 'Claude Pro', 'Amazon Prime Video', 'Amazon', 'Trader Joe’s', "TRADER JOE'S STORE 552", 'Roth IRA', 'TRANSFER TO ROTH',
  'CHECKCARD 1105 STARBUCKS STORE 01234 SEATTLE WA', 'ACH DEBIT VERIZON WIRELESS PAYMENTS', 'Recurring Netflix', 'apple.com/bill', 'ITUNES.COM/BILL',
  'GGL *YOUTUBEPREMIUM', 'PP*Hulu', 'Uber *Trip', 'UBER EATS', 'DD DOORDASH BURGERS', 'Lowe’s', 'H&M', 'AT&T', 'Disney+', 'Google One', 'Water and sewer',
  'Groceries and gas', 'XX1234 TARGET T-0123', 'Card ending ****4321', 'store #12 Kroger', '555-123-4567 CALL ME', '11/05/2026 PAYMENT', 'The Home Depot',
  '   ', '', '*', '1234', 'café de flore', 'ÉCOLE', 'Mazda 3', 'CX-5', 'F-150', 'My Camry', 'Model Y', 'Chevy truck', 'BMW X5', 'an old ring', 'Joe Smith', 'Kitchen',
  'A', 'the a an of and', 'O’Reilly Auto', "o'reilly", 'Pay-Pal', 'NYT', 'ny times', 'game pass', 'PS Plus', 'prime', 'bofa', 'amex platinum',
  'ACME CRUISES AD_PAYMENT PPD ID: 1234', 'Zelle payment from JANE DOE 1234567890', 'Zelle payment to Sam Lee', 'ZELLE TO BOB SMITH JPM99A8B7C6D',
  'zelle transfer from Ann', 'Payment to Chase card ending in 4321 11/05', 'PAYMENT TO CAPITAL ONE CARD ENDING IN 0042', 'MAZDA FINANCIAL PYMT WEB ID: 2222',
  'GUSTO PAYROLL NZTZP5VXA0Y1UPE CCD', 'COMCAST CABLE 8495 PPD ID:0000', 'APPLE GS SAVINGS TRANSFER', 'VERIZON WIRELESS PAYMENTS PPD', 'IRS USATAXPYMT PPD ID: 3387702000',
  'ach credit WEB ID 99 ACME_CORP DIR DEP', 'Pay to card ending in 12',
  // American Express: AplPay, its processors (WWP*, WL *), and the town padded into a column, glued to a store number, or a website.
  'AplPay STARBUCKS SEATTLE WA', 'AplPay PINE CAFE MIAMI FL', 'WWP*SUNNY DAYS SCHOOL 877-555-0100 FL', 'WL *STEAM PURCHASE 425-555-0100 WA',
  'WL *STEAM PURCHASE   425-555-0100        WA', 'BLUE BOTTLE COFFEE  OAKLAND             CA', 'SQ  *BLUE BOTTLE  OAKLAND  CA', 'PET SUPERMARKET #100SUNRISE FL',
  'AMAZON.COM AMZN.COM/BILL WA', 'UBER   *TRIP  HELP.UBER.COM CA', 'AplPay TST* JOES CAFE FORT LAUDERDALE FL', 'APLPAY KIDS ART CLUB', 'WWP*KIDS ART CLUB',
  'POS DEBIT  SHELL OIL 57444 SAN JOSE CA', 'AplPay  OAKLAND  CA', 'STORE  0042  FL', 'GREEN LEAF MARKET  SAN JOSE CA', 'aplpay  ca',
  // Game stores by their brand, and a known name after its maker's star.
  'STEAMGAMES.COM 4259522985 WA', 'Steam Purchase', 'STEAM CLEANING CO', 'PLAYSTATION NETWORK 800-555-0199 CA', 'MICROSOFT*XBOX', 'MICROSOFT*STORE',
  'MICROSOFT*ONEDRIVE', 'MSFT * E0400ABCD', 'NINTENDO CA1234567 WA', 'Nintendo', 'EPIC GAMES STORE', 'GAMESTOP #1234', 'ROBLOX CORPORATION'
].forEach((n) => names.add(n));

const kinds = [undefined, 'car', 'other', 'collectible', 'checking', 'subscriptions', 'utilities'];
const vectors = {
  about: 'Made by apple-client/scripts/make-payee-logos.mjs: what web/src/finances answers for each name, for PayeeLogoTests. Do not edit: run the script.',
  payees: [...names].map((raw) => ({ raw, clean: web.cleanPayee(raw), brand: web.payeeBrand(undefined, raw) ?? null })),
  // Every name as no kind and as a car, and one in twenty-five as every kind.
  brandOf: [...names].flatMap((name, n) => (n % 25 === 0 ? kinds : [undefined, 'car'])
    .map((kind) => ({ name, kind: kind ?? null, brand: web.brandOf(undefined, name, kind) ?? null }))),
  picked: [
    { institution: 'none', payee: 'NETFLIX.COM', brand: web.payeeBrand('none', 'NETFLIX.COM') ?? null },
    { institution: 'chase', payee: 'NETFLIX.COM', brand: web.payeeBrand('chase', 'NETFLIX.COM') ?? null },
    { institution: '', payee: 'NETFLIX.COM', brand: web.payeeBrand('', 'NETFLIX.COM') ?? null },
  ],
  autoMark: [...names].map((name) => ({ name, ...web.autoMark(name) })),
  hints: [...names].flatMap((name, n) => [undefined, 'checking', 'utilities'].map((kind) => ({ name, kind: kind ?? null, hint: web.hintOf(kind, name) ?? null }))
    .filter((v) => v.hint !== null || n % 10 === 0)),
  // A note as a transaction's page shows it: the bank's wording left out (payees.ts's shownNote).
  notes: [
    ['ACME CRUISES AD_PAYMENT PPD ID: 1234', 'Acme Cruises'], ['ACME CRUISES AD_PAYMENT PPD ID: 1234', ''], ['Birthday dinner', 'Chipotle'],
    ['Birthday dinner (CHIPOTLE 1234 ONLINE)', 'Chipotle'], ['Payment to Chase card ending in 9495 11/06', 'Payment to Chase card ••9495'],
    ['FPL DIRECT DEBIT ELEC PYMT', 'FPL'], ['FPL DIRECT DEBIT ELEC PYMT', 'Electric'], ['Split with Sam', 'Trader Joe\'s'], ['', 'Netflix'],
    ['XFER TO SAVINGS 123', 'Savings'], ['for the kids (WEB ID: 2222 MAZDA FINANCIAL)', 'Mazda'], ['GROCERIES FOR THE WEEK', 'Kroger'],
    ['NETFLIX.COM', 'Netflix'], ['netflix.com', 'Netflix'], ['Order 123456 refund', 'Amazon'], ['  spaced note  ', 'X'],
  ].map(([note, payee]) => ({ note, payee, shown: web.shownNote(note, payee || undefined), bank: web.bankWording(note) })),
  alike: [
    ["Trader Joe's", "TRADER JOE'S STORE 552"], ['Roth IRA', 'TRANSFER TO ROTH'], ['Netflix', 'NETFLIX.COM'], ['Netflix', 'Hulu'], ['The Card', 'Debit card'],
    ['Ab', 'ab'], ['Ab', 'Ab cd'], ['Payment', 'payment'], ['Water bill', 'City water'], ['', ''],
  ].map(([a, b]) => ({ a, b, alike: web.alike(a, b) })),
};
const cats = [
  { name: 'Income', income: true }, { name: 'Paycheck', parent: 'Income', income: true }, { name: 'Home' }, { name: 'Rent', parent: 'Home' },
  { name: 'Utilities' }, { name: 'Water', parent: 'Utilities' }, { name: 'Food' }, { name: 'Groceries', parent: 'Food' }, { name: 'Car' },
  { name: 'Subscriptions' }, { name: 'Health' }, { name: 'Shopping' }, { name: 'Kids and school' }, { name: 'Gifts and giving' }, { name: 'Travel' },
  { name: 'Fees and interest' }, { name: 'Other' },
];
vectors.categories = cats;
vectors.categoryHue = ['Income', 'Paycheck', 'Home', 'rent', 'Water', 'Groceries', 'Travel', 'Fees and interest', 'Other', 'Nothing like it', '', 'SHOPPING']
  .map((name) => ({ name, hue: web.categoryHue(name, cats) }));
vectors.kindHue = ['home', 'cards', 'spending', 'car', 'utilities', 'subscriptions', 'loans', 'other', 'unknown', '']
  .flatMap((kind) => [{ kind, withCategories: true, hue: web.kindHueOf(kind || undefined, cats) }, { kind, withCategories: false, hue: web.kindHueOf(kind || undefined, []) }]);

// ---------------------------------------------------------------------------

const files = [
  [join(client, 'Shared', 'Resources', 'PayeeLogos.json'), JSON.stringify(logos) + '\n'],
  [join(client, 'Tests', 'Resources', 'PayeeVectors.json'), JSON.stringify(vectors, null, 0).replace(/\},\{/g, '},\n{') + '\n'],
];
let stale = false;
for (const [path, text] of files) {
  let was = '';
  try { was = readFileSync(path, 'utf8'); } catch { /* not made yet */ }
  if (was === text) { console.log(`${path.slice(repo.length + 1)} is current`); continue; }
  if (check) { console.error(`${path.slice(repo.length + 1)} is out of date with web/src/finances: node apple-client/scripts/make-payee-logos.mjs`); stale = true; continue; }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  console.log(`wrote ${path.slice(repo.length + 1)} (${Math.round(text.length / 1024)} KB)`);
}
console.log(`${brands.length} brands, ${brands.filter((b) => b.path).length} with a mark`);
if (stale) process.exit(1);

