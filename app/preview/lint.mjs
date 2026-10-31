// Static checks for the frontend, run in CI without a browser: no merge
// conflict markers are left, each script parses, every element the app
// looks up by ID (anywhere in web/src) exists in index.html or is created
// by the app itself, app.ts stays down to choosing screens (under 400
// lines), no screen builds elements by hand (document.createElement), the
// shared blocks are drawn only by web/src/parts, and colours are tokens.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dist = join(root, 'web', 'dist');
const scripts = [join(dist, 'app.js'), join(dist, 'companion.js'), join(root, 'app', 'preview', 'mock.js'), join(root, 'app', 'preview', 'shoot.mjs'), join(root, 'app', 'preview', 'real.mjs'), join(root, 'app', 'preview', 'companion.mjs')];
for (const f of scripts) execFileSync(process.execPath, ['--check', f], { stdio: 'inherit' });

// A merge left half done: CSS shrugs off conflict markers, so check for them.
// Every TypeScript source of the app, app.ts and the screens first.
const srcDir = join(root, 'web', 'src');
const sources = readdirSync(srcDir, { recursive: true }).filter((f) => /\.tsx?$/.test(f)).map((f) => join(srcDir, f));
for (const f of ['style.css', 'index.html', 'app.js', 'companion.js', ...sources.map((f) => relative(dist, f))]) {
  if (/^(<{7}|>{7}|={7})( |$)/m.test(readFileSync(join(dist, f), 'utf8'))) {
    console.error(`web/dist/${f} has a merge conflict marker`);
    process.exit(1);
  }
}

const js = sources.map((f) => readFileSync(f, 'utf8')).join('\n');
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const defined = new Set([
  ...[...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]),
  ...[...js.matchAll(/\bid:\s*'([^']+)'/g)].map((m) => m[1]),
  ...[...js.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]), // drawn by a component (JSX)
]);
const used = new Set([...js.matchAll(/(?:(?<![\w$])\$|getElementById)\('([^']+)'\)/g)].map((m) => m[1]));
const missing = [...used].filter((id) => !defined.has(id)).sort();
if (missing.length) {
  console.error(`app.js looks up IDs that nothing defines: ${missing.join(', ')}`);
  process.exit(1);
}

// app.ts only loads data and chooses screens: each screen's code lives in
// web/src/screens (0.14's "a frontend that grows").
const appLines = readFileSync(join(srcDir, 'app.ts'), 'utf8').split('\n').length;
if (appLines >= 400) {
  console.error(`web/src/app.ts is ${appLines} lines: keep it under 400 by putting a screen's code in web/src/screens`);
  process.exit(1);
}
// No screen builds elements by hand: Preact components draw them.
const byHand = sources.filter((f) => /document\.createElement\b/.test(readFileSync(f, 'utf8'))).map((f) => relative(root, f));
if (byHand.length) {
  console.error(`built by hand with document.createElement: ${byHand.join(', ')}; draw it with a Preact component`);
  process.exit(1);
}
// The shared blocks (web/src/parts) are the only ones that write their
// markup: a card's heading row, a list of rows, a segmented control, an
// empty state, a sheet, a card a component draws itself. index.html holds
// no sheet either: the screens' cards are boxes there, sheets are not.
const blockMarkup = [
  [/class="row">\s*<h2/, 'a card heading: use CardHead (parts/Card.tsx)'],
  [/class=["{'`]+card\b|'card /, 'a card: use Card (parts/Card.tsx)'],
  [/\balertlist\b/, 'a list of rows: use Rows and Row (parts/Row.tsx)'],
  [/class="seg\b/, 'a segmented control: use Segmented (parts/Segmented.tsx)'],
  [/muted empty/, 'an empty state: use Empty (parts/Empty.tsx)'],
  [/class="panel sheet"|role="dialog"/, 'a sheet: use Sheet (parts/Sheet.tsx)'],
];
const partsDir = join(srcDir, 'parts');
const offBlock = [];
for (const f of sources) {
  if (f.startsWith(partsDir)) continue;
  const text = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '');
  for (const [re, why] of blockMarkup) {
    const m = re.exec(text);
    if (m) offBlock.push(`${relative(root, f)}:${text.slice(0, m.index).split('\n').length}: ${why}`);
  }
}
if (/class="panel sheet"|role="dialog"/.test(html)) offBlock.push('web/dist/index.html: a sheet: draw it with Sheet (parts/Sheet.tsx)');
if (offBlock.length) {
  console.error(`a shared block's markup written by hand:\n  ${offBlock.join('\n  ')}`);
  process.exit(1);
}
// Colours are tokens only: a rule in style.css uses var(--…), and only a
// custom property (--name: value) holds a colour itself. In web/src a
// colour is written only where it is data, listed here with why.
const colour = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/;
const css = readFileSync(join(dist, 'style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
const loose = [];
for (const m of css.matchAll(/([\w-]+)\s*:\s*([^;{}]+)/g)) {
  if (!m[1].startsWith('--') && colour.test(m[2])) loose.push(`web/dist/style.css:${css.slice(0, m.index).split('\n').length}: ${m[0].trim().slice(0, 80)}`);
}
const colourData = {
  'web/src/appearance.ts': 'works out the shades of an accent from it, against white, black, and the pages it is drawn on',
  'web/src/settings/Appearance.tsx': 'the accent swatches: the colour a pick keeps in appearance.json',
  'web/src/finances/logos.ts': "the brands' own colours behind their marks (simple-icons)",
};
for (const f of sources) {
  const rel = relative(root, f);
  if (rel in colourData) continue;
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => { if (colour.test(line.replace(/\/\/.*$/, ''))) loose.push(`${rel}:${i + 1}: ${line.trim().slice(0, 80)}`); });
}
if (loose.length) {
  console.error(`colours written outside the tokens (add a token to style.css's :root and use var(--…)):\n  ${loose.join('\n  ')}`);
  process.exit(1);
}
// Each Finances logo's mark (or initials) on its colour reads at 4.5:1, as
// text does: a brand's own colour too light or too dark for its ink takes
// the other ink, or a shade darker.
const lum = (hex) => {
  const h = hex.length === 4 ? hex.slice(1).replace(/./g, '$&$&') : hex.slice(1);
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const logos = [...readFileSync(join(srcDir, 'finances', 'logos.ts'), 'utf8').matchAll(/"([\w]+)": \{ name: "[^"]*", bg: "(#[0-9a-fA-F]{3,6})", ink: "(#[0-9a-fA-F]{3,6})"/g)];
const faint = logos.filter(([, , bg, ink]) => ratio(bg, ink) < 4.5).map(([, k, bg, ink]) => `${k}: ${ink} on ${bg} reads at ${ratio(bg, ink).toFixed(2)}:1`);
if (logos.length < 100 || faint.length) {
  console.error(logos.length < 100 ? `read only ${logos.length} logos from web/src/finances/logos.ts` : `Finances logos under 4.5:1 (take the other ink, or a shade darker):\n  ${faint.join('\n  ')}`);
  process.exit(1);
}
console.log(`frontend ok: ${scripts.length} scripts parse, ${used.size} IDs found, app.ts ${appLines} lines, nothing built by hand, blocks drawn by web/src/parts, colours as tokens only, ${logos.length} logos at 4.5:1`);
