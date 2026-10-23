// Static checks for the frontend, run in CI without a browser: no merge
// conflict markers are left, each script parses, and every element app.js looks up by ID exists in index.html or is
// created by app.js itself.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dist = join(root, 'web', 'dist');
const scripts = [join(dist, 'app.js'), join(dist, 'companion.js'), join(root, 'app', 'preview', 'mock.js'), join(root, 'app', 'preview', 'shoot.mjs')];
for (const f of scripts) execFileSync(process.execPath, ['--check', f], { stdio: 'inherit' });

// A merge left half done: CSS shrugs off conflict markers, so check for them.
for (const f of ['style.css', 'index.html', 'app.js', 'companion.js']) {
  if (/^(<{7}|>{7}|={7})( |$)/m.test(readFileSync(join(dist, f), 'utf8'))) {
    console.error(`web/dist/${f} has a merge conflict marker`);
    process.exit(1);
  }
}

const js = readFileSync(join(dist, 'app.js'), 'utf8');
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const defined = new Set([
  ...[...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]),
  ...[...js.matchAll(/\bid:\s*'([^']+)'/g)].map((m) => m[1]),
]);
const used = new Set([...js.matchAll(/(?:(?<![\w$])\$|getElementById)\('([^']+)'\)/g)].map((m) => m[1]));
const missing = [...used].filter((id) => !defined.has(id)).sort();
if (missing.length) {
  console.error(`app.js looks up IDs that nothing defines: ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`frontend ok: ${scripts.length} scripts parse, ${used.size} IDs found`);
