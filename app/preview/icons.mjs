// Makes the phone companion's Home Screen icons from assets/appicon-phone.svg:
// web/dist/icon-180.png (an iPhone's apple-touch-icon), icon-192.png and
// icon-512.png (Android's, the larger one also its maskable icon). Run it
// again after changing the SVG: node app/preview/icons.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const svg = readFileSync(join(root, 'assets', 'appicon-phone.svg'), 'utf8');
const browser = await chromium.launch();
for (const size of [180, 192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: join(root, 'web', 'dist', `icon-${size}.png`), omitBackground: false });
  await page.close();
  console.log(`web/dist/icon-${size}.png`);
}
await browser.close();
