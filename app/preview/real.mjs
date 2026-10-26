// The app's page against a real homelab, as a phone sees it: the phone
// companion (homelab serve) in front of real containers, not the fake
// backend. The real-Docker run (test/realdocker) starts the server, makes
// a pairing code, and runs this with the names of the apps it installed:
//
//   node app/preview/real.mjs <address> <pairing code> <screenshots folder> <app name>...
//
// It pairs with the code, then: Status lists every app, Backups shows the
// nightly backup's copies fresh (none stale), and Back up now runs to the
// end in its job window. A failing step keeps a screenshot.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const [address, code, shots, ...names] = process.argv.slice(2);
if (!address || !code || !shots || !names.length) {
  console.error('usage: node app/preview/real.mjs <address> <pairing code> <screenshots folder> <app name>...');
  process.exit(2);
}
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
let failed = 0;
async function step(what, fn) {
  try {
    await fn();
    if (errors.length) throw new Error(errors.splice(0).join('; '));
    console.log('ok  ', what);
  } catch (e) {
    failed++;
    console.log('FAIL', `${what}:`, String(e.message || e).split('\n')[0]);
    await page.screenshot({ path: join(shots, what.replace(/[^\w.-]+/g, '-').slice(0, 80) + '.png'), fullPage: true }).catch(() => {});
  }
}

await step('paired with a one-time code', async () => {
  await page.goto(`${address}/#pair=${code}`);
  await page.fill('#pairName', 'Nightly run', { timeout: 30000 });
  await page.click('#pairBtn');
  await page.waitForSelector('#statusRows tr', { timeout: 60000 });
});

await step('Status lists every app the run installed', async () => {
  await page.click('#statusAll', { timeout: 10000 });
  for (const name of names) {
    await page.waitForSelector(`#statusRows tr:has(strong:text-is(${JSON.stringify(name)}))`, { timeout: 60000 });
  }
});

// An app with no database yet (Uptime Kuma before its first monitor) is
// "None yet", as it would be on a new homelab; none may be stale.
await step("Backups shows the nightly backup's copies, fresh", async () => {
  await page.click('nav button[data-screen="backups"]', { timeout: 10000 });
  await page.waitForSelector('#backupRows tr:has-text("Fresh")', { timeout: 60000 });
  const rows = await page.$$eval('#backupRows tr', (trs) => trs.map((r) => [r.querySelector('strong')?.textContent, r.querySelector('.state')?.textContent]));
  console.log('     ', rows.map(([name, state]) => `${name}: ${state}`).join('; '));
  const stale = rows.filter(([, state]) => /Stale/.test(state)).map(([name]) => name);
  if (stale.length) throw new Error(`stale: ${stale.join(', ')}`);
});

await step('Back up now runs to the end in its window', async () => {
  await page.click('#backupNow', { timeout: 10000 });
  await page.waitForSelector('#backupPanel:not([hidden])', { timeout: 10000 });
  await page.waitForFunction(() => !/…$/.test(document.getElementById('backupTitle').textContent), null, { timeout: 15 * 60000 });
  const title = await page.textContent('#backupTitle');
  if (title !== 'Backup done') throw new Error(`the window says "${title}": ${(await page.textContent('#backupLog')).trim().split('\n').slice(-5).join(' | ')}`);
});

await browser.close();
process.exit(failed ? 1 : 0);
