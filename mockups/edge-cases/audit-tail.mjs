// Tail of app/preview/audit.mjs (scratch, never committed to main). Recreate: head of shoot.mjs up to the line before "if (process.argv.includes('--smoke'))", then this. Env: AUDIT_OUT, AUDIT_SHOTS, AUDIT_SCREENS, AUDIT_ZOOMS, AUDIT_SIZES, AUDIT_LOOKS (light,dark,hc,more), AUDIT_VARIANTS (normal,long,empty,fresh), AUDIT_SYS, AUDIT_CSS, AUDIT_JS, AUDIT_WHO.
// ---- audit (scratch, not committed) ----
const outDir = process.env.AUDIT_OUT;
mkdirSync(outDir, { recursive: true });
const longName = (a, i) => ({ ...a, name: i % 3 === 0 ? `${a.name} with an extraordinarily long display name for testing` : a.name, address: a.address && a.address.replace('example.com', 'a-really-long-subdomain-name.snooper42-homelab-wizard.example.com') });

const allApps = catalog.apps.filter((a) => a.kind !== 'helper').map((a, i) => ({ id: a.id, name: a.name, state: i % 7 === 3 ? 'stopped' : 'running', health: a.kind === 'native' ? 'native' : i % 7 === 3 ? '' : i % 11 === 5 ? 'unhealthy' : i % 13 === 4 ? 'starting' : 'healthy', url: urls[a.id], address: addresses[a.id], since: new Date(Date.now() - (i % 5 + 1) * 86400e3 * 37).toISOString(), restarts: i % 9 === 2 ? 1287 : undefined, held: i % 17 === 6 || undefined }));
const bigAlerts = Array.from({ length: 30 }, (_, i) => ({ id: 'x' + i, time: hoursAgo(i * 3.3), topic: 'tunnel-watchdog', title: i % 2 ? 'Homelab: something is down' : 'Homelab: recovered', message: `photos.example.com: HTTP 530 through the tunnel; the tunnel's connector reported "context deadline exceeded" ${i} times while reaching the origin at http://immich-server:2283`, priority: i % 2 ? 4 : 3, tags: [i % 2 ? 'warning' : 'white_check_mark'] }));
const manyPeople = Array.from({ length: 20 }, (_, i) => ({ username: 'user' + i, name: ['Maximilian Alexander von Habsburg-Lothringen', 'Bo', 'Anna Smith'][i % 3] + ' ' + i, email: `someone.with.a.long.address${i}@an-example-family-domain.example.com`, pocketId: 'p' + i, added: hoursAgo(24 * (30 + i)), removed: '0001-01-01T00:00:00Z', apps: ['vikunja', 'mealie', 'immich'] }));
const variants = {
  normal: {},
  long: { status: { ...status, apps: status.apps.map(longName) }, weekly: longWeek },
  empty: { status: { ...status, apps: [], savings: 0 } },
  extreme: { status: { ...status, apps: allApps, savings: 1234567, missing: 3, unmatched: 7 }, alerts: bigAlerts, people: manyPeople, savingsHistory: undefined,
    host: { ...host, disks: [{ label: 'homelab folder, backups, Jellyfin data', space: '1.2 GB free of 994 GB (0%)', low: true, free: 1.2e9, total: 994e9 }, { label: 'photos, media, downloads', space: '18.3 TB free of 128 TB (14%)', low: false, name: 'Hobbies-and-everything-else-external-RAID', free: 18.3e12, total: 128e12 }] },
    backups: { ...backups, stale: 23, paused: 9, copies: backups.copies.map((c) => ({ ...c, size: c.size * 1e5, state: 'stale' })) },
    watchdog: { ...watchdog, failing: allApps.slice(0, 9).map((a) => a.id) } },
  fresh: { status: { ...status, apps: [], savings: 0 }, savingsHistory: [], alerts: [], protection: undefined, backups: { destination: '', destinationOK: false, copies: [], restoreTest: { history: [] } }, duplicatiJobs: [] },
};
const pages = (process.env.AUDIT_SCREENS || 'status,backups,setup,settings,choose,app:vikunja').split(',');
const zooms = (process.env.AUDIT_ZOOMS || '1,1.5,2').split(',');
const sizes = (process.env.AUDIT_SIZES || '860x560').split(',').map((s) => s.split('x').map(Number));
const looks = (process.env.AUDIT_LOOKS || 'light').split(',');
const vars = (process.env.AUDIT_VARIANTS || 'normal').split(',');
const sysName = process.env.AUDIT_SYS || 'Mac';
const sys = systems.find((s) => s.name === sysName);
const browser = await chromium.launch();
const report = [];
for (const look of looks) for (const v of vars) for (const screen of pages) for (const [w, hgt] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, colorScheme: look === 'dark' ? 'dark' : 'light', forcedColors: look === 'hc' ? 'active' : 'none', contrast: look === 'more' ? 'more' : 'no-preference' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const m = { ...mock, ...sys.mock, ...(screen.startsWith('app:') ? pageMock : {}), ...variants[v], host: { ...mock.host, ...sys.mock.host, ...variants[v].host }, screen };
  await page.addInitScript({ content: `window.__MOCK = ${JSON.stringify(m)};\n${readFileSync(join(here, 'mock.js'), 'utf8')}` });
  await page.goto(pathToFileURL(join(root, 'web', 'dist', 'index.html')).href);
  await page.evaluate((c) => document.documentElement.classList.add('preview', ...c), process.env.AUDIT_PHONE ? ['companion', 'can-change'] : []);
  if (process.env.AUDIT_JS) { await page.waitForTimeout(700); await page.evaluate(eval(readFileSync(process.env.AUDIT_JS, "utf8"))); }
  if (process.env.AUDIT_CSS) await page.addStyleTag({ content: readFileSync(process.env.AUDIT_CSS, "utf8") });
  await page.waitForTimeout(700);
  for (const z of zooms) {
    await page.evaluate((z) => document.documentElement.style.setProperty('--zoom', z), z);
    await page.waitForTimeout(150);
    const found = await page.evaluate(() => {
      const out = [];
      const mn = document.querySelector('main');
      if (mn.scrollWidth > mn.clientWidth + 1) out.push(`main scrolls sideways ${mn.scrollWidth}/${mn.clientWidth}`);
      if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) out.push(`page ${document.documentElement.scrollWidth}/${document.documentElement.clientWidth}`);
      const mr = mn.getBoundingClientRect();
      // Visible elements sticking out past main's right edge or clipped by an overflow:hidden ancestor.
      for (const e of mn.querySelectorAll('*')) {
        if (!e.checkVisibility()) continue;
        const r = e.getBoundingClientRect();
        if (!r.width) continue;
        const cs = getComputedStyle(e);
        if ((cs.overflowX === 'hidden' || cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis') && e.scrollWidth > e.clientWidth + 2 && e.children.length < 3) out.push(`clipped: ${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}.${[...e.classList].join('.')} "${e.textContent.trim().slice(0, 40)}" ${e.scrollWidth}/${e.clientWidth}`);
      }
      const nav = document.querySelector('nav');
      if (nav && nav.scrollHeight > nav.clientHeight + 1 && getComputedStyle(nav).overflowY === 'hidden') out.push('nav clipped vertically');
      return [...new Set(out)].slice(0, 12);
    });
    if (process.env.AUDIT_WHO) found.push(...await page.evaluate(eval(readFileSync(process.env.AUDIT_WHO, "utf8"))));
    const label = `${sysName} ${look} ${v} ${screen} ${w}x${hgt} z${z}`;
    report.push(`${found.length || errors.length ? 'ISSUE' : 'ok   '} ${label}${found.length ? '\n    ' + found.join('\n    ') : ''}${errors.length ? '\n    errors: ' + errors.join('; ') : ''}`);
    if (process.env.AUDIT_SHOTS) await page.screenshot({ path: join(outDir, label.replace(/[^\w.-]+/g, '-') + '.png') });
  }
  await ctx.close();
}
await browser.close();
console.log(report.join('\n'));
