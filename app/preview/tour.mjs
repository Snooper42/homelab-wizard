// The README's walkthrough (docs/images/tour.gif, and tour-dark.gif in dark): the app against the fake
// backend, with a cursor and a caption for each screen, recorded as video and
// made into a GIF with ffmpeg. Every app is well in it, for a first look.
//
//   node app/preview/tour.mjs            (light; needs Playwright, Chromium and ffmpeg)
//   node app/preview/tour.mjs dark       (the same in dark)
//
// The example state is shoot.mjs's own: this reads shoot.mjs up to its first
// shot and keeps what it builds (the catalog from the real CLI, the example
// household), so the two never drift apart.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require(execFileSync('npm', ['root', '-g']).toString().trim() + '/playwright'));
}
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const work = mkdtempSync(join(tmpdir(), 'homelab-tour-'));
// shoot.mjs's example state, up to its first shot, saved as JSON.
const shoot = readFileSync(join(here, 'shoot.mjs'), 'utf8');
const preamble = shoot.slice(0, shoot.indexOf('\nconst finGroups')).replace(/^const here = .*$/m, `const here = ${JSON.stringify(here)};`);
writeFileSync(join(work, 'state.mjs'), preamble + `\nimport { writeFileSync as __w } from 'node:fs';\n__w(${JSON.stringify(join(work, 'mock.json'))}, JSON.stringify(mock));\n`);
execFileSync(process.execPath, [join(work, 'state.mjs')], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, NODE_PATH: process.env.NODE_PATH || '' } });
const base = JSON.parse(readFileSync(join(work, 'mock.json'), 'utf8'));
// Every app well, for a first look: Mealie, stopped in the example, runs; its backup is fresh.
const vik = base.status.apps.find((x) => x.id === 'vikunja');
base.status.apps = base.status.apps.map((x) => (x.id === 'mealie' ? { ...x, state: 'running', health: 'healthy', since: vik.since, updatedAt: vik.updatedAt } : x));
base.backups.copies = base.backups.copies.map((x) => (x.id === 'mealie' ? { ...x, state: 'fresh', newest: base.backups.copies.find((c) => c.id === 'vikunja').newest } : x));
const W = 1280, H = 800;
const scheme = process.argv.includes('dark') ? 'dark' : 'light';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: scheme, recordVideo: { dir: work, size: { width: W, height: H } } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.addInitScript({ content: `window.__MOCK = ${JSON.stringify({ ...base, screen: 'status' })};\n${readFileSync(join(here, 'mock.js'), 'utf8')}` });
// A cursor the video can see: an arrow that follows the mouse.
await page.addInitScript((dark) => {
  addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div');
    c.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2l15 11-6.5 1.2L16 21l-3 1.4-3.4-6.6L4 20z" fill="${dark ? '#fff' : '#111'}" stroke="${dark ? '#111' : '#fff'}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    Object.assign(c.style, { position: 'fixed', left: '640px', top: '420px', zIndex: 2147483647, pointerEvents: 'none', transition: 'transform .12s' });
    document.body.appendChild(c);
    addEventListener('mousemove', (e) => { c.style.left = e.clientX - 3 + 'px'; c.style.top = e.clientY - 2 + 'px'; }, true);
    addEventListener('mousedown', () => { c.style.transform = 'scale(.82)'; }, true);
    addEventListener('mouseup', () => { c.style.transform = ''; }, true);
  });
}, scheme === 'dark');
await page.goto(pathToFileURL(join(root, 'web', 'dist', 'index.html')).href);
await page.evaluate(() => document.documentElement.classList.add('preview'));
const wait = (ms) => page.waitForTimeout(ms);
let mx = 640, my = 420;
async function moveTo(sel) {
  const box = await page.locator(sel).first().boundingBox();
  if (!box) throw new Error('not found: ' + sel);
  const x = box.x + Math.min(box.width / 2, 60), y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 18 });
  mx = x; my = y;
}
async function click(sel, after = 1800) { await moveTo(sel); await wait(250); await page.mouse.down(); await wait(90); await page.mouse.up(); await page.locator(sel).first().click({ trial: true }).catch(() => {}); await wait(after); }
const marks = [];
const captions = {
  status: 'Status: every app on the computer, live, and what needs a look',
  page: "An app's page: restart it, read its log in plain words, undo an update",
  finances: 'Finances: what each paycheck leaves once the bills are paid',
  worth: 'Net worth, month by month, typed in by you and kept at home',
  tidy: "Tidy Up: drop in a download, and it's filed in the right library",
  music: 'Each library tidied step by step, with Undo for every change',
  backups: 'Backups: a copy of everything every night, and proof it restores',
  choose: 'Choose apps: tick what you want, and it installs and connects them',
};
const caption = (text) => page.evaluate(([t, d]) => {
  let c = document.getElementById('tourcap');
  if (!c) { c = document.createElement('div'); c.id = 'tourcap'; Object.assign(c.style, { position: 'fixed', left: '50%', bottom: '26px', transform: 'translateX(-50%)', zIndex: 2147483646, background: d ? 'rgba(250,250,252,.94)' : 'rgba(17,17,20,.86)', color: d ? '#111' : '#fff', font: '600 19px/1.3 Inter, -apple-system, system-ui, sans-serif', padding: '12px 22px', borderRadius: '14px', boxShadow: '0 8px 30px rgba(0,0,0,.25)', whiteSpace: 'nowrap', pointerEvents: 'none', transition: 'opacity .25s' }); document.body.appendChild(c); }
  c.style.opacity = '0'; setTimeout(() => { c.textContent = t; c.style.opacity = '1'; }, 180);
}, [text, scheme === 'dark']);
const mark = (name) => { marks.push([name, Date.now()]); return caption(captions[name]); };
const t0 = Date.now();
await page.mouse.move(mx, my);
await wait(1200);
await mark('status');
await wait(2600);
// An app's page: Vikunja's row.
await click('#statusRows tr:has(strong:text-is("Vikunja")) td:first-child', 0);
await page.locator('#statusRows tr:has(strong:text-is("Vikunja")) td:first-child').first().click();
await mark('page'); await wait(3000);
// Finances.
await click('nav button[data-screen=finances]', 0); await page.click('nav button[data-screen=finances]');
await mark('finances'); await wait(3000);
await click('#finRoot button:text-is("Net worth")', 0); await page.click('#finRoot button:text-is("Net worth")');
await mark('worth'); await wait(2800);
// Tidy Up.
await click('nav button[data-screen=tidy]', 0); await page.click('nav button[data-screen=tidy]');
await mark('tidy'); await wait(2800);
await click('#tidy button:text-is("Music")', 0); await page.click('#tidy button:text-is("Music")');
await mark('music'); await wait(2800);
// Backups, then Choose apps.
await click('nav button[data-screen=backups]', 0); await page.click('nav button[data-screen=backups]');
await mark('backups'); await wait(2800);
await click('nav button[data-screen=choose]', 0); await page.click('nav button[data-screen=choose]');
await mark('choose'); await wait(3000);
await click('nav button[data-screen=status]', 0); await page.click('nav button[data-screen=status]');
await wait(1500);
const video = page.video();
await ctx.close();
await browser.close();
const webm = await video.path();
const gif = join(root, 'docs', 'images', scheme === 'dark' ? 'tour-dark.gif' : 'tour.gif');
// 10 frames a second, 960 wide, one palette for the whole: about 5 MB.
execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '1.0', '-i', webm, '-vf', 'fps=10,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle', '-loop', '0', gif], { stdio: 'inherit' });
rmSync(work, { recursive: true, force: true });
console.log('wrote', gif.replace(root + '/', ''), marks.map(([n, t]) => `${n} ${((t - t0) / 1000).toFixed(1)}s`).join(', '));
