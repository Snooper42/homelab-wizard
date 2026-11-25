// The redesign mocks (docs/Redesign.md), drawn and photographed:
//
//   node app/preview/redesign/build.mjs
//
// Writes each mock's page to app/preview/redesign/html/ (not kept in git;
// open one in a browser to inspect it), then its pictures to
// docs/images/redesign/: the first screen in light and dark, and the whole
// page scrolled. Mocks only: nothing here is the app's code.
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const html = join(here, 'html');
const pics = join(root, 'docs', 'images', 'redesign');
mkdirSync(pics, { recursive: true });

// Each generator writes its pages when imported.
await import('./finances.mjs');
await import('./phone.mjs');
await import('./backups-settings.mjs');
await import('./tidy.mjs');
await import('./web.mjs');

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require(execFileSync('npm', ['root', '-g']).toString().trim() + '/playwright'));
}

// Page file, picture name.
const computer = [['dashboard', 'computer-finances'], ['transactions', 'computer-transactions'], ['backups', 'computer-backups'], ['settings', 'computer-settings'], ['tidy', 'computer-tidy'], ['web-wide', 'web-wide']];
const phone = [['phone-finances', 'phone-finances'], ['phone-transactions', 'phone-transactions'], ['phone-status', 'phone-status'], ['phone-jordan', 'phone-partner'], ['phone-backups', 'phone-backups'], ['phone-settings', 'phone-settings'], ['web-status', 'web-status'], ['web-app', 'web-app'], ['web-push', 'web-push']];

const browser = await chromium.launch();
const loaded = (page) => page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 10000 });
for (const scheme of ['light', 'dark']) {
  const suffix = scheme === 'dark' ? '-dark' : '';
  for (const [file, name] of computer) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, colorScheme: scheme, deviceScaleFactor: 2 });
    await page.goto(pathToFileURL(join(html, file + '.html')).href);
    await loaded(page);
    await page.screenshot({ path: join(pics, `${name}${suffix}.png`) });
    await page.close();
    const full = await browser.newPage({ viewport: { width: 1280, height: 800 }, colorScheme: scheme, deviceScaleFactor: 1 });
    await full.goto(pathToFileURL(join(html, file + '.html')).href);
    await loaded(full);
    await full.screenshot({ path: join(pics, `${name}-full${suffix}.png`), fullPage: true });
    await full.close();
  }
  for (const [file, name] of phone) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: scheme, deviceScaleFactor: 2 });
    await page.goto(pathToFileURL(join(html, file + '.html')).href);
    await loaded(page);
    await page.screenshot({ path: join(pics, `${name}${suffix}.png`) });
    // The whole page, with the floating tab bar at its foot rather than
    // halfway down where the first screen ends.
    await page.addStyleTag({ content: 'body{position:relative}.tabs{position:absolute!important;bottom:22px}' });
    await page.screenshot({ path: join(pics, `${name}-full${suffix}.png`), fullPage: true });
    await page.close();
  }
}
await browser.close();

// A third of the size with no visible change: 256 colours, no dithering
// (flat UI colours), where Python's imaging library is installed.
const shrink = `
import glob, sys
from PIL import Image
for p in glob.glob(sys.argv[1] + '/*.png'):
    im = Image.open(p)
    if im.mode == 'P':
        continue
    im.convert('RGB').quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(p, optimize=True)
`;
try {
  execFileSync('python3', ['-c', shrink, pics], { stdio: 'pipe' });
} catch {
  console.log('Pictures kept at full size (no python3 with Pillow to shrink them)');
}
console.log('Drew the redesign mocks into docs/images/redesign');
