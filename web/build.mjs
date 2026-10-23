// Compiles the frontend's TypeScript and Preact TSX (web/src) into
// web/dist/app.js, which is committed so the Go builds need no Node: npm
// run build. With --check it only says whether web/dist/app.js is current
// (make frontend-check).
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'dist', 'app.js');
const check = process.argv.includes('--check');
const result = await build({
  entryPoints: [join(here, 'src', 'app.ts')],
  bundle: true,
  format: 'iife',
  target: ['es2022', 'safari15'], // the WebKit of macOS 12, the oldest the app runs on
  charset: 'utf8',
  jsx: 'automatic', // TSX components, with Preact's runtime
  jsxImportSource: 'preact',
  outfile: out,
  write: !check,
  logLevel: 'warning',
});
if (check) {
  const built = result.outputFiles[0].text;
  if (built !== readFileSync(out, 'utf8')) {
    console.error('web/dist/app.js is out of date with web/src: npm run build');
    process.exit(1);
  }
  console.log('web/dist/app.js matches web/src');
}
