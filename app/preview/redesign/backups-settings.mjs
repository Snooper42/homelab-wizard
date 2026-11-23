// Redesign mock: Backups and Settings, on the computer and on the phone (docs/Redesign.md).
import { writeFileSync } from 'node:fs';
import { repo, out, logo, icon, P } from './lib.mjs';
import { deskCss } from './finances.mjs';
import { phoneCss, sb, tabsFor, ch, appLogo } from './phone.mjs';

Object.assign(P, {
  lock: 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2ZM7 11V7a5 5 0 0 1 10 0v4',
  printer: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  history: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5M12 7v5l4 2',
  file: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7ZM14 2v4a2 2 0 0 0 2 2h4',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0', moon: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z',
  phone: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2ZM12 18h.01',
  globe: 'c12,12,10|M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  drive: 'M22 12H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11ZM6 16h.01M10 16h.01',
  palette: 'c12,12,10|c8,10,1.3|c12,7,1.3|c16,10,1.3', zap: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  wrench: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
  shield: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
  cloud: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z', warn: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4M12 17h.01',
  pause: 'M6 4h4v16H6zM14 4h4v16h-4z', userplus: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M19 8v6M22 11h-6|c9,7,4',
});

// The example's backups (docs/images/app-backups.png): each app's newest copy.
const apps = [['vaultwarden', 'Vaultwarden', '94 KB'], ['immich-server', 'Immich database', '58 MB'], ['paperless', 'Paperless database', '13 MB'], ['moneymatter-frontend', 'MoneyMatter', '23 MB'],
  ['navidrome', 'Navidrome', '7.8 MB'], ['uptime-kuma', 'Uptime Kuma', '3.0 MB'], ['audiobookshelf', 'Audiobookshelf', '2.3 MB'], ['vikunja', 'Vikunja', '400 KB'], ['nginx-proxy-manager', 'Nginx Proxy Manager', '178 KB'], ['ntfy', 'ntfy', '23 KB']];
const nights = ['Tu', 'W', 'Th', 'F', 'Sa', 'Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa', 'Su', 'M'];
const strip = (n = 14, label = true) => `<div class="nights">${nights.slice(-n).map((d, i, a) => `<div><i class="${i === a.length - 1 ? 'part' : 'full'}"></i>${label ? `<span${i === a.length - 1 ? ' class="b"' : ''}>${d}</span>` : ''}</div>`).join('')}</div>`;
const toggle = (on = true) => `<span class="tg ${on ? 'on' : ''}"><i></i></span>`;
const av = (l, bg, fg) => `<span class="av" style="background:${bg};color:${fg}">${l}</span>`;

const extra = `
.nights{display:flex;gap:5px;margin-top:14px}.nights div{flex:1;display:grid;gap:4px;justify-items:center}.nights i{display:block;width:100%;height:22px;border-radius:6px;background:var(--in);opacity:.85}.nights i.part{background:linear-gradient(to top,var(--in) 0 88%,transparent 88%),repeating-linear-gradient(45deg,var(--out-soft) 0 4px,transparent 4px 8px);background:var(--in);box-shadow:inset 0 -6px 0 #d97706}
.nights span{font-size:10.5px;color:var(--muted)}.nights span.b{font-weight:700;color:var(--text)}
.chip.warn{background:#fff4e0;color:#b45309}@media (prefers-color-scheme:dark){.chip.warn{background:#2a2110;color:#fbbf24}}
.tg{width:42px;height:25px;border-radius:13px;background:var(--line2,#d1d1d6);position:relative;flex:none;display:inline-block}.tg i{position:absolute;top:2px;left:2px;width:21px;height:21px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25)}.tg.on{background:var(--acc)}.tg.on i{left:19px}
.srow{display:flex;align-items:center;gap:14px;padding:12px 0;border-top:1px solid var(--line)}.srow:first-of-type{border-top:0}.srow .n{flex:1;display:grid;gap:1px;min-width:0}.srow .n b{font-weight:550}.srow .n small{color:var(--muted);font-size:12.5px}
.sico{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;color:#fff;flex:none}
.alogo{border-radius:8px;flex:none;background:#fff;box-shadow:0 0 0 1px var(--line)}
.av{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:13px;flex:none}
.new{font-size:10.5px;font-weight:700;letter-spacing:.05em;padding:2px 7px;border-radius:99px;background:var(--acc-soft);color:var(--acc-ink);text-transform:uppercase}
`;

// ---------- Computer ----------
const homeSide = (on) => `
<aside class="side">
  <div class="brand"><img src="file://${repo}/assets/logo.svg" width="26" height="26"><div><b>Homelab Wizard</b></div></div>
  <nav class="fnav">${[['activity', 'Status', 1], ['archive', 'Backups'], ['tidy', 'Tidy Up'], ['dollar', 'Finances'], ['layers', 'Choose apps']].map(([i, n, b]) => `<a class="${n === on ? 'on' : ''}">${icon(i, 17)}<span style="flex:1">${n}</span>${b ? `<span class="pill" style="background:#fdeee6;color:#c2410c">${b}</span>` : ''}</a>`).join('')}</nav>
  <div style="flex:1"></div>
  <nav class="fnav"><a class="${on === 'Settings' ? 'on' : ''}">${icon('gear', 17)}<span>Settings</span></a></nav>
  <div class="foot"><div class="synced"><i></i>412 GB free · plugged in</div></div>
</aside>`;
const head = (title, right) => `<header class="top"><h2 style="margin:0;font-size:24px;font-weight:700;letter-spacing:-.01em;flex:1">${title}</h2>${right}</header>`;
const cardHead = (t, extra = '') => `<div class="ch"><h3>${t}</h3>${extra}</div>`;
const desk = (title, body, on) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${deskCss}${extra}</style></head><body>${homeSide(on)}<main>${body}</main></body></html>`;

const backups = `
${head('Backups', `<div style="display:flex;gap:8px"><button class="btn" style="height:38px;padding:0 14px">${icon('printer', 15)}Recovery kit</button><button class="primary" style="border-radius:10px">${icon('sync', 16)}Back up now</button></div>`)}
<div class="grid">
  <section class="card span2">
    ${cardHead('Last night', '<span class="muted" style="font-size:13px">Every night at 3:30</span>')}
    <div class="figrow"><div><div class="fig">11<small> of 12 copied</small></div><div class="lab">Finished 3:41 AM · 128 MB · encrypted to Proton Drive</div></div><span class="chip warn">${icon('warn', 12)}Mealie skipped</span></div>
    ${strip()}
    <div class="trio" style="margin-top:16px"><div><span>Next</span><b>Tonight, 3:30</b></div><div><span>Last night's size</span><b>128 MB</b></div><div><span>Kept</span><b>7 nights · 12 months</b></div></div>
  </section>
  <section class="card">
    ${cardHead('Needs you', '<span class="pill" style="background:#fff4e0;color:#b45309">3</span>')}
    <div class="txl">
      <div class="txr">${appLogo('mealie', 32)}<div class="n"><b>Mealie</b><small>Stopped, so last night's copy skipped it</small></div><button class="btn" style="background:var(--acc);color:#fff;border:0">Start</button></div>
      <div class="txr">${appLogo('komga', 32)}<div class="n"><b>Komga</b><small>Waiting for the Hobbies drive</small></div><span class="muted">${icon('pause', 15)}</span></div>
      <div class="txr">${appLogo('kavita', 32)}<div class="n"><b>Kavita</b><small>Waiting for the Hobbies drive</small></div><span class="muted">${icon('pause', 15)}</span></div>
    </div>
  </section>
  <section class="card">
    ${cardHead('Restore test')}
    <div class="figrow"><div><div class="fig" style="font-size:24px">Passed</div><div class="lab">12 days ago</div></div><span class="chip up">${icon('check', 12)}12 of 12 files</span></div>
    <p class="muted" style="font-size:13px;margin:12px 0">A sample of files was brought back and matched the originals exactly. Next test in 18 days.</p>
    <button class="btn">${icon('history', 14)}Test a restore</button>
  </section>
  <section class="card">
    ${cardHead('Off-site')}
    <div class="figrow"><div><div class="fig" style="font-size:24px">Proton Drive</div><div class="lab">1.2 GB · encrypted before it leaves</div></div><span class="muted">${icon('lock', 18)}</span></div>
    <p class="muted" style="font-size:13px;margin:12px 0 0">Keeps 7 nights, 4 weeks and 12 months. Only your recovery kit can open it.</p>
  </section>
  <section class="card">
    ${cardHead('Not in any backup')}
    <div class="txl">
      <div class="txr">${appLogo('syncthing', 32)}<div class="n"><b>Synced files</b><small>38 GB in Syncthing's folder</small></div><button class="btn">Add</button></div>
      <div class="txr">${appLogo('qbittorrent', 32)}<div class="n"><b>Downloads</b><small>Left out on purpose</small></div></div>
    </div>
  </section>
  <section class="card span3" style="grid-column:1/-1">
    ${cardHead(`Get something back <span class="new">New</span>`)}
    <div class="filters" style="margin-top:4px">
      <div class="field"><span class="muted">App</span>${appLogo('paperless', 20)}<b>Paperless-ngx</b>${icon('down', 14)}</div>
      <div class="field"><span class="muted">As it was</span><b>Last night, 3:30 AM</b>${icon('down', 14)}</div>
      <div class="seg" style="margin:0"><span class="on">One file</span><span>The whole app</span></div>
      <div class="field grow">${icon('search', 16)}Find a file by its name</div>
    </div>
    <div class="txl" style="margin-top:10px">
      ${[['Tax return 2025.pdf', '1.4 MB · added Nov 3'], ['Car title.pdf', '380 KB · added Oct 18']].map(([n, s]) => `<div class="txr"><span class="sico" style="background:var(--sunken);color:var(--muted)">${icon('file', 17)}</span><div class="n"><b>${n}</b><small>${s}</small></div><button class="btn">Save a copy…</button><button class="btn">Put it back</button></div>`).join('')}
    </div>
  </section>
  <section class="card" style="grid-column:1/-1">
    ${cardHead('Each app', '<span class="muted" style="font-size:13px">Newest copy · how many kept · the last 7 nights</span>')}
    <div style="display:grid;grid-template-columns:1fr 1fr;column-gap:32px">
      ${apps.map(([id, n, s]) => `<div class="txr">${appLogo(id, 28)}<div class="n"><b>${n}</b></div><span class="muted" style="font-size:13px;width:64px;text-align:right">${s}</span><span class="muted" style="font-size:13px;width:54px;text-align:right">7 kept</span><span style="display:flex;gap:3px;margin-left:8px">${Array.from({ length: 7 }, () => '<i class="dot" style="background:var(--in);width:8px;height:8px"></i>').join('')}</span></div>`).join('')}
    </div>
  </section>
</div>`;
writeFileSync(out + 'backups.html', desk('Backups', backups, 'Backups'));

const settingsNav = ['General', 'People', 'Phones', 'Automatic care', 'Alerts', 'Bank connections', 'Reaching the apps', 'This Mac', 'Appearance', 'Advanced'];
const settings = `
${head('Settings', `<div class="field" style="width:320px">${icon('search', 16)}Search settings</div>`)}
<div style="display:grid;grid-template-columns:200px minmax(0,1fr);gap:20px;align-items:start">
  <nav class="fnav" style="position:sticky;top:70px">${settingsNav.map((n, i) => `<a class="${i === 0 ? 'on' : ''}"><span>${n}</span></a>`).join('')}</nav>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    <section class="card">
      ${cardHead('People', `<button class="btn">${icon('userplus', 14)}Add a person</button>`)}
      <div class="srow">${av('A', 'var(--acc-soft)', 'var(--acc-ink)')}<div class="n"><b>Alex</b><small>You · runs the homelab</small></div><span class="muted">${icon('right', 16)}</span></div>
      <div class="srow">${av('J', '#fde7ef', '#be185d')}<div class="n"><b>Jordan</b><small>Her own Finances · Photos, Passwords, Movies</small></div><span class="muted">${icon('right', 16)}</span></div>
    </section>
    <section class="card">
      ${cardHead('Phones', `<button class="btn">${icon('plus', 14)}Pair a phone</button>`)}
      <div class="srow"><span class="sico" style="background:#6d4ae0">${icon('phone', 17)}</span><div class="n"><b>Alex's iPhone</b><small>Can make changes · seen just now</small></div><span class="muted">${icon('right', 16)}</span></div>
      <div class="srow"><span class="sico" style="background:#db2777">${icon('phone', 17)}</span><div class="n"><b>Jordan's iPhone</b><small>Looks only · her Finances · seen 2 hours ago</small></div><span class="muted">${icon('right', 16)}</span></div>
    </section>
    <section class="card">
      ${cardHead('Automatic care')}
      ${[['sync', '#16a34a', 'Update apps every night', 'At 4:00 AM, each app backed up first', true], ['activity', '#2563eb', 'Restart an app that stops answering', 'Checked every 15 minutes', true], ['history', '#ea580c', 'Undo an update that breaks an app', 'Puts the version before back by itself', true]]
        .map(([i, c, n, s, on]) => `<div class="srow"><span class="sico" style="background:${c}">${icon(i, 17)}</span><div class="n"><b>${n}</b><small>${s}</small></div>${toggle(on)}</div>`).join('')}
    </section>
    <section class="card">
      ${cardHead('Alerts')}
      <div class="srow"><span class="sico" style="background:#dc2626">${icon('bell', 17)}</span><div class="n"><b>On your phones</b><small>When something stops, fills up, or fails to back up</small></div>${toggle(true)}</div>
      <div class="srow"><span class="sico" style="background:#4f46e5">${icon('moon', 17)}</span><div class="n"><b>Quiet hours</b><small>Alerts arrive without a sound</small></div><span class="muted" style="font-size:13px">10 PM – 7 AM</span>${icon('right', 16, 'muted')}</div>
      <div class="srow"><span class="sico" style="background:#64748b">${icon('grid', 17)}</span><div class="n"><b>On this Mac's screen</b><small>A notification in the corner</small></div>${toggle(true)}</div>
    </section>
    <section class="card">
      ${cardHead(`Bank connections <span class="new">New</span>`)}
      <div class="srow">${av('A', 'var(--acc-soft)', 'var(--acc-ink)')}<div class="n"><b>Alex · SimpleFIN</b><small>4 accounts · read this morning at 7:02</small></div><span class="chip up">${icon('check', 12)}On</span></div>
      <div class="srow">${av('J', '#fde7ef', '#be185d')}<div class="n"><b>Jordan</b><small>Off · only she can turn it on, from her phone</small></div><span class="chip" style="background:var(--sunken);color:var(--muted)">Off</span></div>
      <p class="muted" style="font-size:12.5px;margin:10px 0 0">Each person's banks are read with their own SimpleFIN code. Nobody sees another person's banks.</p>
    </section>
    <section class="card">
      ${cardHead('Reaching the apps')}
      <div class="srow"><span class="sico" style="background:#0d9488">${icon('shield', 17)}</span><div class="n"><b>Home only</b><small>Your phones and computers reach the apps through Tailscale, at home and away. Nothing is on the internet.</small></div></div>
      <div class="srow"><span class="sico" style="background:#64748b">${icon('globe', 17)}</span><div class="n"><b>Use your own domain</b><small>Addresses like photos.yourname.com</small></div><button class="btn">Set it up…</button></div>
    </section>
    <section class="card" style="grid-column:1/-1">
      ${cardHead('This Mac')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${[['drive', 'Storage', '412 GB free of 1 TB'], ['zap', 'Power', 'Plugged in · battery saver on'], ['palette', 'Appearance', 'Follows the Mac (light)'], ['wrench', 'Advanced', "Each app's own settings, keys and tokens · 48"]].map(([i, n, s]) => `<div class="srow" style="border:1px solid var(--line);border-radius:12px;padding:12px 14px"><span class="sico" style="background:var(--sunken);color:var(--muted)">${icon(i, 17)}</span><div class="n"><b>${n}</b><small>${s}</small></div></div>`).join('')}
      </div>
    </section>
  </div>
</div>`;
writeFileSync(out + 'settings.html', desk('Settings', settings, 'Settings'));

// ---------- Phone ----------
const pextra = extra + `.btn{height:34px}.nights i{height:20px}.nights{gap:4px}`;
const phone = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>${phoneCss}${pextra}</style></head><body>${sb}${body}</body></html>`;
const prow = (left, n, s, right = icon('right', 16, 'muted')) => `<div class="row">${left}<div class="n"><b>${n}</b>${s ? `<small>${s}</small>` : ''}</div>${right}</div>`;
const pb = `
<div class="nav"><span style="flex:1"></span><span class="gb">${icon('printer', 19)}</span><span class="gb">${icon('sync', 20)}</span></div>
<h1>Backups</h1>
<section class="card">
  <div class="ch"><h3>Last night</h3><span class="chip warn">${icon('warn', 12)}Mealie skipped</span></div>
  <div class="fig">11<small> of 12 copied</small></div><div class="lab">3:41 AM · encrypted to Proton Drive</div>
  ${strip(14, true)}
  <div style="display:flex;gap:8px;margin-top:14px"><button class="btn pri" style="flex:1">Back up now</button><button class="btn" style="flex:1">Test a restore</button></div>
</section>
<div class="dayh"><span>Needs you</span><span>3</span></div>
<div class="list">
  ${prow(appLogo('mealie', 36), 'Mealie', 'Stopped, so the copy skipped it', '<button class="btn pri" style="height:32px;padding:0 14px">Start</button>')}
  ${prow(appLogo('komga', 36), 'Komga', 'Waiting for the Hobbies drive', `<span class="muted">${icon('pause', 15)}</span>`)}
  ${prow(appLogo('kavita', 36), 'Kavita', 'Waiting for the Hobbies drive', `<span class="muted">${icon('pause', 15)}</span>`)}
</div>
<div class="two">
  <section class="card">${ch('Restore test')}<div class="fig md">Passed</div><div class="muted" style="font-size:12.5px;margin-top:4px">12 days ago<br>12 of 12 files matched</div></section>
  <section class="card">${ch('Off-site')}<div class="fig md" style="font-size:20px;padding-top:3px">Proton Drive</div><div class="muted" style="font-size:12.5px;margin-top:4px">1.2 GB, encrypted<br>Kept 7 nights, 12 months</div></section>
</div>
<div class="list">${prow(`<span class="sico" style="background:var(--acc)">${icon('history', 17)}</span>`, `Get something back <span class="new">New</span>`, 'A file, or a whole app, as it was on a night')}</div>
<div class="dayh"><span>Each app</span><span>12</span></div>
<div class="list">${apps.slice(0, 6).map(([id, n, s]) => prow(appLogo(id, 34), n, `${s} · 7 kept`, `<span style="display:flex;gap:3px">${Array.from({ length: 7 }, () => '<i class="dot" style="background:var(--in)"></i>').join('')}</span>`)).join('')}</div>
${tabsFor('Backups')}`;
writeFileSync(out + 'phone-backups.html', phone(pb));

const ps = `
<div class="nav"><span style="flex:1"></span></div>
<h1>Settings</h1>
<section class="card" style="display:flex;gap:14px;align-items:center">${appLogo('homelab-companion', 52)}<div style="flex:1;display:grid;gap:1px"><b style="font-size:17px">Homelab Wizard</b><small class="muted">homelab.example.com</small><small class="pos" style="font-weight:600">This iPhone can make changes</small></div>${icon('right', 16, 'muted')}</section>
<div class="dayh"><span>Household</span></div>
<div class="list">
  ${prow(`<span style="display:flex">${av('A', 'var(--acc-soft)', 'var(--acc-ink)')}<span style="margin-left:-8px">${av('J', '#fde7ef', '#be185d')}</span></span>`, 'People', 'Alex and Jordan')}
  ${prow(`<span class="sico" style="background:#db2777">${icon('phone', 17)}</span>`, 'Phones', "2 paired · Jordan's looks only")}
</div>
<div class="dayh"><span>Automatic care</span></div>
<div class="list">
  ${prow(`<span class="sico" style="background:#16a34a">${icon('sync', 17)}</span>`, 'Update apps nightly', 'At 4:00 AM, backed up first', toggle(true))}
  ${prow(`<span class="sico" style="background:#2563eb">${icon('activity', 17)}</span>`, 'Restart apps that hang', 'Checked every 15 minutes', toggle(true))}
  ${prow(`<span class="sico" style="background:#ea580c">${icon('history', 17)}</span>`, 'Undo bad updates', 'Puts the version before back', toggle(true))}
  ${prow(`<span class="sico" style="background:#4f46e5">${icon('moon', 17)}</span>`, 'Quiet hours', '10 PM – 7 AM')}
</div>
<div class="dayh"><span>Finances</span></div>
<div class="list">
  ${prow(`<span class="sico" style="background:#6d4ae0">${icon('bank', 17)}</span>`, `Bank connection <span class="new">New</span>`, 'SimpleFIN · on · read 7:02 AM')}
  ${prow(`<span class="sico" style="background:#64748b">${icon('eye', 17)}</span>`, 'Hide amounts when it opens', '', toggle(false))}
</div>
<div class="dayh"><span>This iPhone</span></div>
<div class="list">
  ${prow(`<span class="sico" style="background:#0d9488">${icon('lock', 17)}</span>`, 'Face ID', 'To open, and before any change', '<span class="muted" style="font-size:14px">On</span>')}
  ${prow(`<span class="sico" style="background:#dc2626">${icon('bell', 17)}</span>`, 'Alerts', 'Something stops, fills up or fails')}
  ${prow(`<span class="sico" style="background:#64748b">${icon('grid', 17)}</span>`, 'Widget', 'Status on the Home Screen')}
</div>
<div class="list">${prow(`<span class="sico" style="background:var(--sunken);color:var(--muted)">${icon('file', 17)}</span>`, 'Send a diagnostics report', 'Secrets removed; you read it first')}${prow(`<span class="sico" style="background:#fdeee6;color:#c2410c">${icon('phone', 17)}</span>`, '<span class="neg">Unpair this iPhone</span>', '', '')}</div>
${tabsFor('Settings')}`;
writeFileSync(out + 'phone-settings.html', phone(ps));
