// Tail of app/preview/audit.mjs (scratch, never committed to main). Recreate: head of shoot.mjs up to the line before "if (process.argv.includes('--smoke'))", then this. Env: AUDIT_OUT, AUDIT_SHOTS, AUDIT_SCREENS, AUDIT_ZOOMS, AUDIT_SIZES, AUDIT_LOOKS (light,dark,hc,more), AUDIT_VARIANTS (normal,long,empty,fresh), AUDIT_SYS, AUDIT_CSS, AUDIT_JS, AUDIT_WHO.
// ---- audit (scratch, not committed) ----
const outDir = process.env.AUDIT_OUT;
mkdirSync(outDir, { recursive: true });
const longName = (a, i) => ({ ...a, name: i % 3 === 0 ? `${a.name} with an extraordinarily long display name for testing` : a.name, address: a.address && a.address.replace('example.com', 'a-really-long-subdomain-name.snooper42-homelab-wizard.example.com') });
const variants = {
  normal: {},
  long: { status: { ...status, apps: status.apps.map(longName) }, weekly: longWeek },
  empty: { status: { ...status, apps: [], savings: 0 } },
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
  const m = { ...mock, ...sys.mock, ...(screen.startsWith('app:') ? pageMock : {}), ...variants[v], host: { ...mock.host, ...sys.mock.host }, screen };
  await page.addInitScript({ content: `window.__MOCK = ${JSON.stringify(m)};\n${readFileSync(join(here, 'mock.js'), 'utf8')}` });
  await page.goto(pathToFileURL(join(root, 'web', 'dist', 'index.html')).href);
  await page.evaluate(() => document.documentElement.classList.add('preview'));
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
