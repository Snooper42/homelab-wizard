import { render } from 'preact';
import { useState } from 'preact/hooks';
import { AppMark } from '../parts/AppMark';
import { Card } from '../parts/Card';
import { Spark } from '../Spark';
import { formatMem, memoryByApp } from './memory';
import type { History } from './Usage';

/** The whole machine's samples, oldest first: the apps' processor (percent of one core) and memory (bytes). */
export interface Totals { at: number[]; cpu: number[]; mem: number[] }

/** Samples of the whole machine kept: an hour at one every 10 seconds. */
export const keepTotals = 360;

/** Adds one sample of every app's use to totals. */
export function recordTotals(t: Totals, stats: docker.Stat[], catalog: api.Catalog | null, now = Date.now()) {
  if (!stats.length) return;
  const mem = Object.values(memoryByApp(stats, catalog)).reduce((s, n) => s + n, 0);
  t.at.push(now); t.cpu.push(stats.reduce((s, x) => s + x.cpu, 0)); t.mem.push(mem);
  for (const k of ['at', 'cpu', 'mem'] as const) if (t[k].length > keepTotals) t[k].shift();
}

export interface AnalyticsProps {
  stats: docker.Stat[];
  /** Each app's processor samples (Usage's), by compose service. */
  history: History;
  totals: Totals;
  /** This computer's processor cores; none on a phone (the phone's own would mislead). */
  cores?: number;
  /** The drive the apps keep their data on: free and total bytes. */
  disk: { free: number; total: number; low?: boolean } | null;
  /** Each app's folder, as the nightly backup measured it. */
  storage: storage.Record | null;
  apps: api.AppStatus[];
  catalog: api.Catalog | null;
  icons?: Record<string, string>;
  page: (a: api.AppStatus) => void;
}

/** Bytes on a drive, short: "3.4 TB", "412 GB". */
export function formatDisk(b: number): string {
  if (b >= 1e12) return `${(b / 1e12).toFixed(b >= 1e13 ? 0 : 1)} TB`;
  if (b >= 1e9) return `${Math.round(b / 1e9)} GB`;
  return `${Math.max(0, Math.round(b / 1e6))} MB`;
}

const pct = (n: number) => (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10);
const minutesOf = (t: Totals) => (t.at.length > 1 ? Math.max(1, Math.round((t.at[t.at.length - 1] - t.at[0]) / 60000)) : 0);

/** A line over time with its area under it, scaled from 0 to its peak, with three marks on the right. */
function Chart({ values, kind, label, mark }: { values: number[]; kind: 'cpu' | 'mem'; label: string; mark: (v: number) => string }) {
  const w = 600, h = 110;
  const top = Math.max(...values, kind === 'cpu' ? 10 : 1) * 1.15;
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * w, y = (v: number) => h - (v / top) * h;
  const line = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <figure class={'antimeline ' + kind}>
      <figcaption>{label}</figcaption>
      <div class="antplot">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={`${label}: ${mark(values[values.length - 1])} now, ${mark(Math.max(...values))} at most`}>
          {[0.25, 0.5, 0.75].map((f) => <line key={f} class="grid" x1="0" x2={w} y1={h * f} y2={h * f} />)}
          <polygon class="area" points={`0,${h} ${line} ${w},${h}`} />
          <polyline class="line" points={line} vector-effect="non-scaling-stroke" />
        </svg>
        <span class="antmarks" aria-hidden="true">{[0.75, 0.5, 0.25].map((f) => <span key={f}>{mark(top * f)}</span>)}</span>
      </div>
    </figure>
  );
}

export function Analytics({ stats, history, totals, cores, disk, storage, apps, catalog, icons, page }: AnalyticsProps) {
  const [all, setAll] = useState(false);
  const byId = Object.fromEntries(apps.map((a) => [a.id, a]));
  const nameOf = (id: string) => byId[id]?.name || catalog?.apps.find((a) => a.id === id)?.name || id;
  const mem = memoryByApp(stats, catalog);
  // An app's processor: its own and its helpers', as its memory is counted.
  const helpers = Object.fromEntries((catalog?.apps || []).filter((a) => a.kind !== 'helper').flatMap((a) => (a.dependsOn || []).filter((d) => catalog?.apps.find((x) => x.id === d)?.kind === 'helper').map((d) => [d, a.id])));
  const cpu: Record<string, number> = {};
  const past: Record<string, number[]> = {};
  for (const s of stats) {
    const id = helpers[s.name] || s.name;
    cpu[id] = (cpu[id] || 0) + s.cpu;
    if (!helpers[s.name]) past[id] = history.get(s.name) || [];
  }
  const disked = Object.fromEntries((storage?.apps || []).map((f) => [f.app, f.bytes]));
  const ids = [...new Set([...Object.keys(mem), ...Object.keys(cpu)])].filter((id) => byId[id] || catalog?.apps.some((a) => a.id === id));
  const rows = ids.sort((a, b) => (mem[b] || 0) - (mem[a] || 0) || (cpu[b] || 0) - (cpu[a] || 0));
  const most = Math.max(1, ...rows.map((id) => mem[id] || 0));
  const totalCpu = stats.reduce((s, x) => s + x.cpu, 0), totalMem = Object.values(mem).reduce((s, n) => s + n, 0);
  const busiest = [...rows].sort((a, b) => (cpu[b] || 0) - (cpu[a] || 0))[0];
  const heaviest = rows[0];
  const read = stats.length > 0;
  const mins = minutesOf(totals);
  const span = mins ? (mins === 1 ? 'The last minute' : `The last ${mins} minutes`) : 'Now';
  const who = (id: string | undefined, words: string) => id
    ? <span class="antwho"><AppMark id={id} name={nameOf(id)} icon={icons?.[id] || ''} small /><span class="antname">{nameOf(id)}</span><span class="antfigs">{words}</span></span>
    : <span class="antwho">Not read yet</span>;
  const used = disk && disk.total ? Math.min(100, Math.max(1, Math.round(100 * (1 - disk.free / disk.total)))) : 0;
  const folders = (storage?.apps || []).reduce((s, f) => s + f.bytes, 0);
  const photos = (storage?.photos || []).reduce((s, p) => s + p.bytes, 0);
  return (
    <div class="antpage">
      <div class="row header"><div><h1>Analytics</h1><p class="lead">{span}</p></div></div>
      <div class="anttiles">
        <Card kind="anttile" id="antCpu">
          <div class="anthead"><h2>Processor</h2><span class="muted">{cores ? `${cores} cores` : ''}</span></div>
          <div class="antfig">{read ? <>{cores ? pct(totalCpu / cores) : pct(totalCpu)}<small>%</small> <span class="muted">{cores ? 'in use' : 'of a core'}</span></> : '—'}</div>
          <div class="antline muted">{read && busiest && cpu[busiest] >= 0.1 ? who(busiest, `uses the most · ${pct(cpu[busiest])}%`) : read ? <span class="antwho">Every app idle</span> : who(undefined, '')}</div>
          <div class="antfoot">{totals.cpu.length > 2 ? <Spark values={totals.cpu} w={240} h={36} title={`The apps' processor, ${span.toLowerCase()}`} /> : <span class="antempty" />}</div>
        </Card>
        <Card kind="anttile" id="antMem">
          <div class="anthead"><h2>Memory</h2><span class="muted" /></div>
          <div class="antfig">{read ? <>{formatMem(totalMem).replace(/ (\w+)$/, '')}<small>{formatMem(totalMem).replace(/^[^ ]+/, '')}</small> <span class="muted">in use</span></> : '—'}</div>
          <div class="antline muted">{read && heaviest ? who(heaviest, `uses the most · ${formatMem(mem[heaviest] || 0)}`) : who(undefined, '')}</div>
          <div class="antfoot">{totals.mem.length > 2 ? <Spark values={totals.mem} w={240} h={36} title={`The apps' memory, ${span.toLowerCase()}`} /> : <span class="antempty" />}</div>
        </Card>
        <Card kind="anttile" id="antDisk">
          <div class="anthead"><h2>Drives</h2><span class="muted">{disk?.total ? formatDisk(disk.total) : ''}</span></div>
          <div class={'antfig' + (disk?.low ? ' bad' : '')}>{disk ? <>{formatDisk(disk.free).replace(/ (\w+)$/, '')}<small>{formatDisk(disk.free).replace(/^[^ ]+/, '')}</small> <span class="muted">free</span></> : '—'}</div>
          <div class="antline muted"><span class="antwho">{folders ? `The apps' data ${formatDisk(folders)}${photos ? ` · photos ${formatDisk(photos)}` : ''}` : disk ? `${formatDisk(disk.total - disk.free)} used` : 'Not read yet'}</span></div>
          <div class="antfoot">{disk?.total ? <div class="antbar" role="img" aria-label={`${used}% used`}><span style={{ width: `${used}%` }} /></div> : <span class="antempty" />}</div>
        </Card>
      </div>
      <Card kind="antweek" id="antTime">
        <div class="anthead"><h2>{span}</h2><span class="muted">A week isn't kept yet</span></div>
        {totals.cpu.length > 2 ? <>
          <Chart values={totals.cpu} kind="cpu" label="Processor" mark={(v) => `${Math.round(cores ? v / cores : v)}%`} />
          <Chart values={totals.mem} kind="mem" label="Memory" mark={(v) => formatMem(v)} />
        </> : <p class="muted antwait">Drawn as Status reads the apps, every 10 seconds</p>}
      </Card>
      <Card kind="antapps" id="antApps">
        <div class="anthead"><h2>What each app uses</h2><span class="muted">Heaviest first</span></div>
        {rows.length ? <table class="anttable">
          <thead><tr><th>App</th><th>Memory now</th><th class="antspark">Recent</th><th class="num">Processor</th><th class="num">On disk</th></tr></thead>
          <tbody>
            {(all ? rows : rows.slice(0, 8)).map((id) => (
              <tr key={id} class={byId[id] ? 'topage' : undefined} onClick={byId[id] ? () => page(byId[id]) : undefined}>
                <td><span class="antapp"><AppMark id={id} name={nameOf(id)} icon={icons?.[id] || ''} small />{nameOf(id)}</span></td>
                <td><span class="antmem"><span class="antbar"><span style={{ width: `${Math.max(2, Math.round(((mem[id] || 0) / most) * 100))}%` }} /></span>{formatMem(mem[id] || 0)}</span></td>
                <td class="antspark">{(past[id]?.length || 0) > 2 ? <Spark values={past[id]} w={120} h={18} title={`${nameOf(id)}'s processor, ${span.toLowerCase()}`} /> : null}</td>
                <td class="num">{pct(cpu[id] || 0)}%</td>
                <td class="num">{disked[id] ? formatDisk(disked[id]) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table> : <p class="muted antwait">Not read yet</p>}
        {rows.length > 8 && <button type="button" class="linkbtn antall" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${rows.length}`}</button>}
      </Card>
    </div>
  );
}

export const mountAnalytics = (el: Element, props: AnalyticsProps | null) => render(props && <Analytics {...props} />, el);
