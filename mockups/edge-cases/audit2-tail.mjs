// Tail of app/preview/audit2.mjs (scratch). Recreate as audit-tail.mjs says. Env: AUDIT_OUT, AUDIT_SHOTS, AUDIT_SYS, AUDIT_ZOOMS, AUDIT_SIZE, AUDIT_LOOK, AUDIT_ONLY, AUDIT_PHONE, AUDIT_CSS.
// ---- audit 2 (scratch) ----
const outDir = process.env.AUDIT_OUT; mkdirSync(outDir, { recursive: true });
const sys = systems.find((s) => s.name === (process.env.AUDIT_SYS || 'Mac'));
const zooms = (process.env.AUDIT_ZOOMS || '1,1.5,2').split(',');
const [W, H] = (process.env.AUDIT_SIZE || '860x560').split('x').map(Number);
const look = process.env.AUDIT_LOOK || 'light';
const longText = (n) => 'An unusually long piece of text that keeps going '.repeat(n).trim();
const settingsPages = settings.map((s) => s.section || s.group).filter(Boolean);
const longApps = { status: { ...status, apps: status.apps.map((a, i) => ({ ...a, name: i % 3 === 0 ? a.name + ' with an extraordinarily long display name' : a.name, address: a.address && a.address.replace('example.com', 'a-really-long-subdomain-name.snooper42-homelab-wizard.example.com') })) }, weekly: longWeek };
const scenarios = [
  { name: 'status-long', screen: 'status', mock: longApps, steps: async (page, check) => { await check('long'); await page.evaluate(() => document.querySelector('#statusRows tr:not(.grouphead)').scrollIntoView()); await check('rows'); } },
  { name: 'status-rows', screen: 'status', steps: async (page, check) => { await page.evaluate(() => document.querySelector('#statusRows tr:not(.grouphead)').scrollIntoView()); await check('rows'); } },
  { name: 'backups-long', screen: 'backups', mock: longApps, steps: async (page, check) => { await check('long'); } },
  { name: 'app-long', screen: 'app:vikunja', mock: { ...pageMock, ...longApps }, steps: async (page, check) => { await check('long'); } },
  { name: 'settings-pages', screen: 'settings', steps: async (page, check) => {
    const pages = await page.$$eval('#settingsNav .pagebtn', (b) => b.map((x) => x.dataset.page));
    for (const p of pages) { await page.click(`#settingsNav .pagebtn[data-page="${p}"]`).catch(() => {}); await page.waitForTimeout(250); await check('page ' + p); }
  } },
  { name: 'status-more-menu', screen: 'status', steps: async (page, check) => { await page.click('#statusMore'); await page.waitForTimeout(200); await check('menu'); } },
  { name: 'status-update-sheet', screen: 'status', mock: { jobApps: { 'update-all': catalog.apps.slice(0, 14).map((a) => a.id) } }, steps: async (page, check) => {
    await page.click('#updateAll'); await page.waitForSelector('#cliActions button', { timeout: 5000 }); await check('sheet plan');
    await page.click('#cliActions button:has-text("Update them")'); await page.waitForTimeout(1500); await check('sheet running');
  } },
  { name: 'status-crash', screen: 'status', mock: { crash: crashed }, steps: async (page, check) => { await check('crash note'); } },
  { name: 'status-runtime-down', screen: 'status', mock: { statusError: 'the container runtime is not running: ' + longText(3) }, steps: async (page, check) => { await check('down'); } },
  { name: 'status-long-alerts', screen: 'status', mock: { alerts: alerts.map((a) => ({ ...a, title: a.title + ' ' + longText(1), message: a.message + ' ' + longText(2) + ' https://averyveryverylonghostname-without-any-breaks-at-all.example.com/path/to/something' })), protection: { ...protection, recent: protection.recent.map((r) => ({ ...r, scenario: r.scenario + '-with-a-very-long-scenario-name-from-the-hub', network: r.network + ' ' + longText(1) })) } }, steps: async (page, check) => { await check('long cards'); } },
  { name: 'status-watchdog-failing', screen: 'status', mock: { watchdog: { ...watchdog, failing: ['crowdsec bouncer', 'cloudflared tunnel answering for photos.a-really-long-subdomain-name.snooper42-homelab-wizard.example.com', 'immich-machine-learning'], pending: 2 } }, steps: async (page, check) => { await check('failing'); } },
  { name: 'status-update-normal', screen: 'status', mock: { update }, steps: async (page, check) => { await check('update line'); } },
  { name: 'status-update-line', screen: 'status', mock: { update: { ...update, version: '0.15.0-beta.12+build.7d9be080888433f9' } }, steps: async (page, check) => { await check('update line'); } },
  { name: 'app-stopped', screen: 'app:mealie', mock: pageMock, steps: async (page, check) => { await check('stopped'); } },
  { name: 'app-phone-sheet', screen: 'app:vaultwarden', steps: async (page, check) => { await page.click('#app button:has-text("Open on a phone")'); await page.waitForTimeout(500); await check('phone sheet'); } },
  { name: 'app-explained', screen: 'app:vikunja', mock: { ...pageMock, explainer: 'llama3.2:latest', explained: { vikunja: longText(6) } }, steps: async (page, check) => {
    await page.click('#app button:has-text("Explain")').catch(() => {}); await page.waitForTimeout(800); await check('explained');
  } },
  { name: 'app-long-log', screen: 'app:vikunja', mock: { ...pageMock, logs: { ...logs, vikunja: '2026-10-10T08:00:01Z INF ' + 'x'.repeat(400) + '\n' + longText(5) } }, steps: async (page, check) => { await check('long log'); } },
  { name: 'app-error', screen: 'app:vikunja', mock: { actionDelay: 100, actionError: 'the container runtime stopped answering: ' + longText(4) }, steps: async (page, check) => {
    await page.click('#app button:text-is("Restart")').catch(() => {}); await page.waitForTimeout(800); await check('action error');
  } },
  { name: 'backups-running', screen: 'backups', steps: async (page, check) => { await page.click('#backupNow'); await page.waitForTimeout(1200); await check('backup running'); } },
  { name: 'backups-duplicati-error', screen: 'backups', mock: { duplicatiError: longText(4) }, steps: async (page, check) => { await check('dup error'); } },
  { name: 'backups-long-dest', screen: 'backups', mock: { backups: { ...backups, destination: '/Users/someone-with-a-long-name/Library/CloudStorage/ProtonDrive-someone.with.a.long.address@proton.me-folder/homelab-backups-for-the-whole-house' }, duplicatiJobs: duplicatiJobs.map((j) => ({ ...j, name: j.name + ' with a long custom job name' })) }, steps: async (page, check) => { await check('long dest'); } },
  { name: 'setup-new', screen: 'setup', mock: { host: { runtimeOK: false, runtimeInstalled: true, rootOK: false, root: '', disks: [], kit: true } }, steps: async (page, check) => { await check('new machine'); } },
  { name: 'setup-open-rows', screen: 'setup', steps: async (page, check) => {
    for (const b of await page.$$('.checklist button.iconbtn.more')) await b.click().catch(() => {});
    await page.waitForTimeout(300); await check('rows open');
  } },
  { name: 'choose-plain', screen: 'choose', steps: async (page, check) => { await check('plain'); } },
  { name: 'app-plain', screen: 'app:vikunja', mock: pageMock, steps: async (page, check) => { await page.evaluate(() => document.querySelector('#app .pagecols')?.scrollIntoView()); await check('cols'); } },
  { name: 'status-cards', screen: 'status', steps: async (page, check) => { await page.evaluate(() => document.querySelector('#status .duo')?.scrollIntoView()); await check('cards'); } },
  { name: 'choose-many', screen: 'choose', steps: async (page, check) => {
    for (const b of (await page.$$('.starter')).slice(0, 6)) await b.click().catch(() => {});
    await page.waitForTimeout(400); await check('many picked');
    await page.fill('#search', 'zzzz-no-such-app-' + 'q'.repeat(60)); await page.waitForTimeout(300); await check('no match');
  } },
  { name: 'settings-search-none', screen: 'settings', steps: async (page, check) => { await page.fill('#settingsSearch', 'nothing matches this at all ' + 'z'.repeat(30)); await page.waitForTimeout(300); await check('none'); } },
  { name: 'settings-phones-pair', screen: 'settings', mock: { phones: [...phones, { id: 'x', name: 'A phone with a remarkably long name given by its owner, Anna-Katharina', canChange: false, paired: phones[0].paired, lastSeen: phones[0].lastSeen }] }, steps: async (page, check) => {
    await page.click('#settingsNav .pagebtn[data-page="Phones"]'); await check('phones');
    await page.click('#pairPhone').catch(() => {}); await page.waitForTimeout(600); await check('pairing');
  } },
  { name: 'error-toast', screen: 'app:vikunja', mock: { actionError: longText(5) }, steps: async (page, check) => {
    await page.evaluate((t) => { const e = document.getElementById('error'); e.textContent = t; e.hidden = false; }, longText(5)); await check('toast');
  } },
];
const browser = await chromium.launch();
const report = [];
const pick = process.env.AUDIT_ONLY;
for (const sc of scenarios) {
  if (pick && !sc.name.includes(pick)) continue;
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: look === 'dark' ? 'dark' : 'light', forcedColors: look === 'hc' ? 'active' : 'none' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const m = { ...mock, ...sys.mock, ...sc.mock, host: { ...mock.host, ...sys.mock.host, ...sc.mock?.host }, screen: sc.screen };
  await page.addInitScript({ content: `window.__MOCK = ${JSON.stringify(m)};\n${readFileSync(join(here, 'mock.js'), 'utf8')}` });
  await page.goto(pathToFileURL(join(root, 'web', 'dist', 'index.html')).href);
  await page.evaluate((c) => document.documentElement.classList.add('preview', ...c), process.env.AUDIT_PHONE ? ['companion', 'can-change'] : []);
  await page.waitForTimeout(700);
  if (process.env.AUDIT_CSS) await page.addStyleTag({ content: readFileSync(process.env.AUDIT_CSS, 'utf8') });
  const check = async (state) => {
    for (const z of zooms) {
      await page.evaluate((z) => document.documentElement.style.setProperty('--zoom', z), z);
      await page.waitForTimeout(150);
      const found = await page.evaluate(() => {
        const out = [], vw = innerWidth, vh = innerHeight;
        const mn = document.querySelector('main');
        if (mn.scrollWidth > mn.clientWidth + 1) out.push(`main scrolls sideways ${mn.scrollWidth}/${mn.clientWidth}`);
        const name = (e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.classList.length ? '.' + [...e.classList].join('.') : ''} "${e.textContent.trim().replace(/\s+/g, ' ').slice(0, 36)}"`;
        const all = [...document.querySelectorAll('main *, #sheets *, #error')].filter((e) => e.checkVisibility());
        for (const e of all) {
          const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
          const cs = getComputedStyle(e);
          if (cs.position === 'fixed' && (r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1)) out.push(`off the window: ${name(e)} ${Math.round(r.left)},${Math.round(r.top)}-${Math.round(r.right)},${Math.round(r.bottom)} in ${vw}x${vh}`);
          if (/hidden|clip/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 2 && !['PRE', 'TEXTAREA'].includes(e.tagName) && cs.textOverflow !== 'ellipsis' && e.children.length < 4) out.push(`cut off: ${name(e)} ${e.scrollWidth}/${e.clientWidth}`);
        }
        const hits = all.filter((e) => e.matches('button, a, input, select, .pill, .badge'));
        const rects = hits.map((e) => e.getBoundingClientRect());
        for (let i = 0; i < hits.length; i++) for (let j = i + 1; j < hits.length; j++) {
          if (hits[i].contains(hits[j]) || hits[j].contains(hits[i])) continue;
          const a = rects[i], b = rects[j];
          if (a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2) out.push(`overlap: ${name(hits[i])} / ${name(hits[j])}`);
        }
        return [...new Set(out)].slice(0, 10);
      });
      const label = `${sys.name} ${look} ${sc.name} [${state}] ${W}x${H} z${z}`;
      report.push(`${found.length || errors.length ? 'ISSUE' : 'ok   '} ${label}${found.length ? '\n    ' + found.join('\n    ') : ''}${errors.length ? '\n    errors: ' + errors.join('; ') : ''}`);
      if (process.env.AUDIT_SHOTS) await page.screenshot({ path: join(outDir, label.replace(/[^\w.-]+/g, '-') + '.png') });
    }
    await page.evaluate(() => document.documentElement.style.setProperty('--zoom', '1'));
  };
  try { await sc.steps(page, check); } catch (e) { report.push(`STEPFAIL ${sc.name}: ${String(e.message).split('\n')[0]}`); }
  await ctx.close();
}
await browser.close();
console.log(report.join('\n'));
