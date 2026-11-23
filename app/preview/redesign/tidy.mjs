// Redesign mock: Tidy Up on the computer (docs/Redesign.md). Not on the phone (the owner, Nov 23).
// Figures from the screenshots' example (app/preview/shoot.mjs `tidy`).
import { writeFileSync } from 'node:fs';
import { repo, out, icon, P } from './lib.mjs';
import { deskCss } from './finances.mjs';
import { appLogo } from './phone.mjs';

Object.assign(P, {
  music: 'M9 18V5l12-2v13|c6,18,3|c18,16,3', film: 'M3 3h18v18H3zM7 3v18M17 3v18M3 7.5h4M3 12h18M3 16.5h4M17 7.5h4M17 16.5h4',
  tv: 'M4 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2ZM17 2l-5 5-5-5', book: 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20',
  audio: 'M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3',
  undo: 'M3 7v6h6M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13', folder: 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z',
  spark: 'M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z', shrink: 'M15 15l6 6M15 21v-6h6M9 9 3 3M9 3v6H3', q: 'c12,12,10|M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01',
  drive: 'M22 12H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11ZM6 16h.01M10 16h.01',
  box: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8', down2: 'M12 3v12M7 10l5 5 5-5M5 21h14',
});
const lib = { Music: ['music', '#e11d48'], Movies: ['film', '#2563eb'], TV: ['tv', '#7c3aed'], Books: ['book', '#059669'], Audiobooks: ['audio', '#d97706'] };
const tile = (k, s = 34) => `<span class="sico" style="width:${s}px;height:${s}px;background:${lib[k][1]}">${icon(lib[k][0], s * 0.5)}</span>`;
const plain = (i, s = 34) => `<span class="sico" style="width:${s}px;height:${s}px;background:var(--sunken);color:var(--muted)">${icon(i, s * 0.5)}</span>`;
const extra = `.sico{border-radius:9px;display:grid;place-items:center;color:#fff;flex:none}.alogo{border-radius:8px;background:#fff;box-shadow:0 0 0 1px var(--line);flex:none}
.chip.warn{background:#fff4e0;color:#b45309}@media (prefers-color-scheme:dark){.chip.warn{background:#2a2110;color:#fbbf24}}
.new{font-size:10.5px;font-weight:700;letter-spacing:.05em;padding:2px 7px;border-radius:99px;background:var(--acc-soft);color:var(--acc-ink);text-transform:uppercase}
.btn.pri{background:var(--acc);color:#fff;border-color:transparent}@media (prefers-color-scheme:dark){.btn.pri{color:#140c33}}
.libs{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}.lt{border:1px solid var(--line);border-radius:14px;padding:14px;display:grid;gap:8px;background:var(--panel)}.lt b.big{font-size:20px;font-variant-numeric:tabular-nums}.lt small{color:var(--muted);font-size:12.5px}
.stack{display:flex;height:14px;border-radius:7px;overflow:hidden;gap:2px}.stack i{display:block;height:100%}`;

// Drive: Hobbies, 4 TB.
const drive = [['Movies', 1.4], ['TV', 0.82], ['Music', 0.52], ['Books', 0.012]];
const free = 1.2, total = 4;

// ---------- Computer ----------
const side = `
<aside class="side">
  <div class="brand"><img src="file://${repo}/assets/logo.svg" width="26" height="26"><div><b>Homelab Wizard</b></div></div>
  <nav class="apps" aria-label="Homelab">${[['activity', 'Status'], ['archive', 'Backups'], ['tidy', 'Tidy Up'], ['dollar', 'Finances'], ['layers', 'Choose apps']].map(([i, n]) => `<span class="${n === 'Tidy Up' ? 'on' : ''}">${icon(i, 17)}</span>`).join('')}</nav>
  <nav class="fnav">
    <a class="on">${icon('grid', 17)}<span style="flex:1">Overview</span><span class="pill">6</span></a>
    ${Object.entries(lib).map(([n, [i]]) => `<a>${icon(i, 17)}<span>${n}</span></a>`).join('')}
  </nav>
  <div class="acchead"><span>DRIVES</span></div>
  <div style="display:grid;gap:10px;padding:4px 8px">
    <div style="display:grid;gap:6px"><div style="display:flex;justify-content:space-between;font-size:13px"><b style="font-weight:600">Hobbies</b><span class="muted">1.2 TB free</span></div><div class="bar"><i style="width:70%;background:var(--acc)"></i></div></div>
    <div style="display:grid;gap:6px"><div style="display:flex;justify-content:space-between;font-size:13px"><b style="font-weight:600">This Mac</b><span class="muted">412 GB free</span></div><div class="bar"><i style="width:59%;background:var(--muted)"></i></div></div>
  </div>
  <div style="flex:1"></div>
  <div class="foot"><div class="synced"><i></i>Watching 2 folders · as things arrive</div></div>
</aside>`;
const H = (t, x = '') => `<div class="ch"><h3>${t}</h3>${x}</div>`;
const body = `
<header class="top"><div style="flex:1;display:grid"><h2 style="margin:0;font-size:24px;font-weight:700">Tidy Up</h2><span class="muted" style="font-size:13px">Last looked 4 minutes ago · 412 GB won back so far</span></div>
  <button class="sq" title="Watched folders and when">${icon('sliders', 17)}</button><button class="primary" style="border-radius:10px">${icon('spark', 16)}Tidy up now</button></header>
<div class="grid">
  <section class="card span2">
    ${H('Today', '<span class="muted" style="font-size:13px">From Downloads and Hobbies/downloads</span>')}
    <div class="figrow"><div><div class="fig">4<small> downloads filed</small></div><div class="lab">Since midnight · 1 still downloading</div></div><span class="chip up">${icon('check', 12)}Nothing lost</span></div>
    <div class="txl" style="margin-top:8px">
      ${[['Movies', 'Heat (1995)', 'Film · into Movies · subtitles kept', '6 min ago', 1], ['Music', 'OK Computer (1997)', 'Radiohead · 12 songs · tags cleaned, lyrics added', '1 h ago', 1], ['TV', 'Severance, season 2, episode 4', 'Into TV › Severance › Season 2', '3 h ago', 1], ['Books', 'The Martian', 'Andy Weir · added to Calibre', '5 h ago', 0]]
        .map(([k, n, s, t, u]) => `<div class="txr">${tile(k)}<div class="n"><b>${n}</b><small>${s}</small></div><span class="muted" style="font-size:12.5px;width:70px;text-align:right">${t}</span>${u ? `<button class="btn">${icon('undo', 13)}Undo</button>` : '<span style="width:72px"></span>'}</div>`).join('')}
      <div class="txr">${plain('down2')}<div class="n"><b>Dune Part Two (2024)</b><small>Still downloading · filed when it's done</small></div><div class="bar" style="width:140px"><i style="width:64%;background:var(--acc)"></i></div></div>
    </div>
  </section>
  <section class="card">
    ${H('Needs a look', '<span class="pill" style="background:#fff4e0;color:#b45309">3</span>')}
    <div class="txl">
      <div class="txr" style="align-items:flex-start">${plain('q')}<div class="n" style="gap:6px"><div style="display:grid"><b>VID_20231104.mkv</b><small>Its name says nothing about what it is</small></div><div style="display:flex;gap:6px"><button class="btn">It's a film…</button><button class="btn">An episode…</button></div></div></div>
      <div class="txr" style="align-items:flex-start">${tile('Music')}<div class="n" style="gap:6px"><div style="display:grid"><b>14 songs, no album</b><small>Downloads › new music</small></div><div><button class="btn">Name these songs…</button></div></div></div>
      <div class="txr" style="align-items:flex-start">${plain('box')}<div class="n" style="gap:6px"><div style="display:grid"><b>Lost.S01.rar</b><small>Packed: open it, and it's filed next time</small></div><div><button class="btn">Show in Finder</button></div></div></div>
    </div>
  </section>
  <section class="card span2">
    ${H('Needs your OK', '<span class="muted" style="font-size:13px">6 things, the next one first</span>')}
    <div class="txr" style="background:var(--acc-soft);border-radius:14px;padding:14px;border:0;margin-bottom:6px">${tile('Music', 40)}<div class="n"><span class="lab" style="margin:0;color:var(--acc-ink)">Next up</span><b style="font-size:16px">2,402 songs could get lyrics</b><small>Synced, so they scroll along in Navidrome</small></div><button class="btn pri" style="height:36px;padding:0 16px">Add lyrics</button></div>
    <div class="txl">
      ${[['Movies', 'Shrink 42 films', 'Wins back about 380 GB · same picture, newer format', 'Shrink them'], ['Books', 'Look over 3 book fixes', 'Titles and series, before they change', 'Look over'], ['TV', 'Scan TV for the first time', '820 GB, never looked at', 'Scan'], ['Audiobooks', 'Audiobooks have no folder yet', 'Pick one, or skip them', 'Choose…'], ['Music', 'Free the old music library', 'Every song made it · 68 set-aside copies go with it', 'Free it…']]
        .map(([k, n, s, b]) => `<div class="txr">${tile(k, 30)}<div class="n"><b>${n}</b><small>${s}</small></div><button class="btn">${b}</button></div>`).join('')}
    </div>
  </section>
  <section class="card">
    ${H('The Hobbies drive')}
    <div class="figrow"><div><div class="fig">1.2<small> TB free</small></div><div class="lab">of 4 TB</div></div><span class="chip up">${icon('arrowup', 12)}412 GB won back</span></div>
    <div class="stack" style="margin:16px 0 14px">${drive.map(([k, v]) => `<i style="width:${(v / total) * 100}%;background:${lib[k][1]}"></i>`).join('')}<i style="flex:1;background:var(--sunken)"></i></div>
    <div class="legend">${drive.map(([k, v]) => `<div><i class="dot" style="background:${lib[k][1]}"></i><span>${k}</span><b>${v >= 1 ? v + ' TB' : Math.round(v * 1000) + ' GB'}</b></div>`).join('')}<div><i class="dot" style="background:var(--line2)"></i><span>Free</span><b>1.2 TB</b></div></div>
    <p class="muted" style="font-size:12.5px;margin:12px 0 0">Shrinking the 42 films would free about 380 GB more.</p>
  </section>
  <section class="card" style="grid-column:1/-1">
    ${H('Your libraries')}
    <div class="libs">
      ${[['Music', '13,932', 'songs · 520 GB', 83, '83% have lyrics'], ['Movies', '355', 'films · 1.4 TB', 87, '87% already lean'], ['TV', '820 GB', 'not scanned yet', 0, 'Scan to see'], ['Books', '412', 'books · 12 GB', 99, '3 fixes to look over'], ['Audiobooks', '—', 'no folder yet', 0, 'Choose a folder']]
        .map(([k, n, s, p, t]) => `<div class="lt"><div style="display:flex;align-items:center;gap:10px">${tile(k, 30)}<b>${k}</b></div><div style="display:grid"><b class="big">${n}</b><small>${s}</small></div><div class="bar"><i style="width:${p}%;background:${lib[k][1]}"></i></div><small>${t}</small></div>`).join('')}
    </div>
  </section>
  <section class="card span2">
    ${H('Recently done', '<span class="muted" style="font-size:13px">Everything thrown away goes to the Trash first</span>')}
    <div class="txl">
      ${[['Movies', 'Movies shrunk', '12 files replaced · 412 GB freed', '1 h ago', 0], ['Music', 'Nothing went missing', '14,000 songs before = 13,932 + 68 set aside', '2 h ago', 0], ['Music', 'Navidrome tidied', '558 missing entries removed', 'Yesterday', 0], ['Music', 'Cleaned music library swapped in', 'Navidrome paused and backed up first', 'Yesterday', 1]]
        .map(([k, n, s, t, u]) => `<div class="txr">${tile(k, 30)}<div class="n"><b>${n}</b><small>${s}</small></div><span class="muted" style="font-size:12.5px;width:70px;text-align:right">${t}</span>${u ? `<button class="btn">${icon('undo', 13)}Undo</button>` : '<span style="width:72px"></span>'}</div>`).join('')}
    </div>
  </section>
  <section class="card">
    ${H('Genres', `<span class="btn" style="padding:4px 10px">Music ${icon('down', 13)}</span>`)}
    ${(() => { const g = [['Rock', 3120, '#e11d48'], ['Hip-Hop', 2480, '#f97316'], ['Pop', 2010, '#eab308'], ['Electronic', 1650, '#22c55e'], ['Jazz', 1390, '#06b6d4'], ['Other', 3282, '#94a3b8']];
      const T = g.reduce((a, x) => a + x[1], 0); let a0 = -Math.PI / 2, arcs = '';
      for (const [, v, c] of g) { const a1 = a0 + (v / T) * Math.PI * 2 - 0.03, p = (a) => [60 + 46 * Math.cos(a), 60 + 46 * Math.sin(a)].map((x) => x.toFixed(1)).join(','); arcs += `<path d="M${p(a0)} A46,46 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}" stroke="${c}" stroke-width="14" fill="none"/>`; a0 = a1 + 0.03; }
      return `<div style="display:flex;gap:14px;align-items:center"><svg viewBox="0 0 120 120" width="112" height="112" style="flex:none">${arcs}<text x="60" y="57" text-anchor="middle" style="font-size:10px;fill:var(--muted)">14 genres</text><text x="60" y="73" text-anchor="middle" style="font-size:13px;font-weight:700;fill:var(--text)">13,932</text></svg><div class="legend">${g.map(([n, v, c]) => `<div><i class="dot" style="background:${c}"></i><span>${n}</span><b>${v.toLocaleString()}</b></div>`).join('')}</div></div>`; })()}
  </section>
</div>`;
writeFileSync(out + 'tidy.html', `<!doctype html><html><head><meta charset="utf-8"><title>Tidy Up</title><style>${deskCss}${extra}</style></head><body>${side}<main>${body}</main></body></html>`);

