// Static checks for the frontend, run in CI without a browser: no merge
// conflict markers are left, each script parses, every element the app
// looks up by ID (anywhere in web/src) exists in index.html or is created
// by the app itself, app.ts stays down to choosing screens (under 400
// lines), and no screen builds elements by hand (document.createElement).
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dist = join(root, 'web', 'dist');
const scripts = [join(dist, 'app.js'), join(dist, 'companion.js'), join(root, 'app', 'preview', 'mock.js'), join(root, 'app', 'preview', 'shoot.mjs'), join(root, 'app', 'preview', 'real.mjs')];
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
console.log(`frontend ok: ${scripts.length} scripts parse, ${used.size} IDs found, app.ts ${appLines} lines, nothing built by hand`);
