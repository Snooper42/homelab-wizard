// The kit's charts: an area over days with marks on them, bars (signed,
// pickable), bars stacked above and below zero with a line over them, and
// a donut. Each takes numbers, labels, and hues (ui/Legend), knows nothing
// of the plan, says what it shows to a screen reader in one sentence, and
// draws the rest with tokens (style.css, fx-chart). Pointing at the area or
// the stacked bars shows the day's or month's card (tip).
import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { type Hue, hue } from './Legend';

/** Round steps for an axis from lo to hi, about count of them, zero among them when it is in range. */
export function ticks(lo: number, hi: number, count = 4): { ticks: number[]; top: number; bottom: number } {
  const span = Math.max(hi - lo, 1);
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || 10 * mag;
  const bottom = Math.floor(lo / step) * step, top = Math.ceil(hi / step) * step;
  const out: number[] = [];
  for (let t = bottom; t <= top + step / 1e6; t += step) out.push(Math.round(t * 100) / 100);
  return { ticks: out, top, bottom };
}

/** Where a tip sits beside a point at x% across: on the right of it, or on the left near the end. */
const tipSide = (x: number) => (x < 60 ? { left: `calc(${x}% + 14px)` } : { right: `calc(${100 - x}% + 14px)` });

/** The y axis: its labels, right-aligned beside the plot. */
function Axis({ marks, y, format }: { marks: number[]; y: (n: number) => number; format: (n: number) => string }) {
  return <div class="fx-axis" aria-hidden="true">{marks.map((t) => <span key={t} class={t === 0 ? 'zero' : ''} style={{ top: `${y(t)}px` }}>{format(t)}</span>)}</div>;
}

export interface AreaChartProps {
  /** One value a step (a day). */
  values: number[];
  /** Labels under the plot, at their step. */
  xLabels: { i: number; label: string }[];
  /** Marks on the line: money in (green) or out (red) that step. */
  marks?: { i: number; tone: 'in' | 'out' }[];
  /** A dashed level across, named in the legend: the cushion. */
  threshold?: number;
  /** Steps from this one on are ahead, drawn dashed. */
  aheadFrom?: number;
  /** A stretch shaded behind the line (the paycheck picked). */
  band?: { from: number; to: number };
  height?: number;
  /** An axis label: "$2k". */
  format: (n: number) => string;
  /** The card for the step pointed at. */
  tip?: (i: number) => ComponentChildren;
  /** What the chart shows, in one sentence. */
  label: string;
  /** Its scale starts at zero (the default); off, it fits the values, for a trend. */
  zero?: boolean;
  /** Its y axis and grid (the default); off, a bare trend. */
  axis?: boolean;
  /** It grows into the room its card leaves, height its least (a card stretched to its row's height). */
  fill?: boolean;
}

/** An area over steps, its line in the accent, with marks on it and a card for the step pointed at. */
export function AreaChart({ values, xLabels, marks = [], threshold, aheadFrom, band, height = 200, format, tip, label, zero = true, axis: showAxis = true, fill }: AreaChartProps) {
  const [at, setAt] = useState(-1);
  const n = values.length;
  // Filling, the plot is as tall as the room it is given, measured, so the line and the pin stay on its scale.
  const plot = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState(0);
  useLayoutEffect(() => {
    if (!fill || !plot.current) return;
    const watch = new ResizeObserver(([e]) => setRoom(Math.round(e.contentRect.height)));
    watch.observe(plot.current);
    return () => watch.disconnect();
  }, [fill, n >= 2]);
  if (n < 2) return null;
  const tall = fill ? Math.max(height, room) : height;
  const lo = zero ? Math.min(0, ...values, threshold ?? 0) : Math.min(...values), hi = zero ? Math.max(...values, threshold ?? 0, 1) : Math.max(...values);
  const axis = zero ? ticks(lo, hi * 1.08) : ticks(lo - (hi - lo) * 0.1, hi + (hi - lo) * 0.1);
  const y = (v: number) => ((axis.top - v) / (axis.top - axis.bottom || 1)) * tall;
  const x = (i: number) => (i / (n - 1)) * 1000;
  const pct = (i: number) => (i / (n - 1)) * 100;
  const cut = aheadFrom === undefined ? n - 1 : Math.min(n - 1, aheadFrom);
  const path = (from: number, to: number) => values.slice(from, to + 1).map((v, k) => `${k ? 'L' : 'M'}${x(from + k).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const solid = path(0, cut);
  const move = (e: PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setAt(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
  };
  return (
    <figure class={'fx-chart fx-area' + (fill ? ' fill' : '')} aria-label={label}>
      <div class="fx-plotrow">
        {showAxis && <Axis marks={axis.ticks} y={y} format={format} />}
        <div ref={plot} class="fx-plot" style={fill ? { minHeight: `${height}px` } : { height: `${height}px` }} onPointerMove={move} onPointerLeave={() => setAt(-1)}>
          {showAxis && axis.ticks.map((t) => <span key={t} class={'fx-grid' + (t === 0 ? ' zero' : '')} style={{ top: `${y(t)}px` }} />)}
          {band && <span class="fx-band" style={{ left: `${pct(band.from)}%`, width: `${pct(band.to) - pct(band.from)}%` }} />}
          {threshold !== undefined && <span class="fx-threshold" style={{ top: `${y(threshold)}px` }} />}
          <svg viewBox={`0 0 1000 ${tall}`} preserveAspectRatio="none" aria-hidden="true">
            <path class="fx-areafill" d={`${solid} L${x(cut).toFixed(1)} ${tall} L0 ${tall} Z`} />
            <path class="fx-line" d={solid} vector-effect="non-scaling-stroke" />
            {cut < n - 1 && <path class="fx-line ahead" d={path(cut, n - 1)} vector-effect="non-scaling-stroke" />}
          </svg>
          {marks.map((m, k) => <span key={k} class={'fx-mark fx-h-' + m.tone} style={{ left: `${pct(m.i)}%`, top: `${y(values[m.i])}px` }} />)}
          {at >= 0 && <>
            <span class="fx-cross" style={{ left: `${pct(at)}%` }} />
            <span class="fx-pin" style={{ left: `${pct(at)}%`, top: `${y(values[at])}px` }} />
            {tip && <div class="fx-tip" style={tipSide(pct(at))}>{tip(at)}</div>}
          </>}
        </div>
      </div>
      <div class={'fx-xlabels' + (showAxis ? '' : ' bare')} aria-hidden="true">{xLabels.map((l) => <span key={l.i} style={{ left: `${pct(l.i)}%` }}>{l.label}</span>)}</div>
    </figure>
  );
}

export interface Bar {
  label: string;
  /** Under the label: who, or a second word. */
  sub?: string;
  value: number;
  /** Its hue; by default money in for above zero and out for below. */
  color?: Hue;
  /** Hatched: read forward, not typed in. */
  ahead?: boolean;
}

export interface BarsProps {
  bars: Bar[];
  height?: number;
  /** The bar picked, raised; with pick, each bar is a button. */
  picked?: number;
  pick?: (i: number) => void;
  /** Words a screen reader says for each bar: "Nov 6, $362 left". */
  say: (b: Bar) => string;
  /** What the bars show, in one sentence (before the bars' own words). */
  label: string;
}

/** Bars from zero, up and down; picking one is how a widget picks its paycheck. */
export function Bars({ bars, height = 96, picked, pick, say, label }: BarsProps) {
  const lo = Math.min(0, ...bars.map((b) => b.value)), hi = Math.max(0, ...bars.map((b) => b.value));
  const span = hi - lo || 1;
  const zero = (hi / span) * height;
  const size = (v: number) => Math.max(2, (Math.abs(v) / span) * height);
  return (
    <figure class={'fx-chart fx-bars' + (pick ? ' pick' : '')} aria-label={label}>
      <div class="fx-barplot" style={{ height: `${height}px`, gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}>
        <span class="fx-grid zero" style={{ top: `${zero}px` }} />
        {bars.map((b, i) => {
          const style = { height: `${size(b.value)}px`, top: `${b.value >= 0 ? zero - size(b.value) : zero}px` };
          const cls = `fx-bar ${hue(b.color ?? (b.value < 0 ? 'out' : 'in'))}${b.value < 0 ? ' down' : ''}${b.ahead ? ' ahead' : ''}${i === picked ? ' on' : ''}`;
          return pick
            ? <button key={i} type="button" class="fx-barcol" aria-pressed={i === picked} aria-label={say(b)} onClick={() => pick(i)}><span class={cls} style={style} /></button>
            : <span key={i} class="fx-barcol" role="img" aria-label={say(b)}><span class={cls} style={style} /></span>;
        })}
      </div>
      <div class="fx-barlabels" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}>
        {bars.map((b, i) => <span key={i} class={i === picked ? 'on' : ''}>{b.label}{b.sub && <small>{b.sub}</small>}</span>)}
      </div>
    </figure>
  );
}

export interface Column {
  label: string;
  /** What is above zero, bottom first. */
  up: { value: number; color: Hue }[];
  /** What is below zero, top first (as positive amounts). */
  down: { value: number; color: Hue }[];
  /** The line's value at this column (net worth). */
  line: number;
  ahead?: boolean;
}

/** Bars stacked above zero and below it, a line through their middles, and the column pointed at (or the last typed in) carded. */
export function StackedBars({ columns, height = 260, format, tip, label }: { columns: Column[]; height?: number; format: (n: number) => string; tip: (i: number) => ComponentChildren; label: string }) {
  const last = columns.map((c) => !c.ahead).lastIndexOf(true);
  const [at, setAt] = useState(-1);
  // The column pointed at gets its card; with none, the last typed in is raised.
  const shown = at >= 0 ? at : last;
  const top = Math.max(...columns.map((c) => c.up.reduce((t, p) => t + p.value, 0)), ...columns.map((c) => c.line), 1);
  const bottom = Math.min(0, ...columns.map((c) => -c.down.reduce((t, p) => t + p.value, 0)), ...columns.map((c) => c.line));
  const axis = ticks(bottom, top, 4);
  // The scale ends a little past what it draws, not at the next round step (a $1.7k card balance under a
  // $212k net worth would take a whole $100k below zero); the labels are the steps inside it.
  const pad = (top - bottom) * 0.04;
  const ceil = Math.min(axis.top, top + pad), floor = bottom < 0 ? Math.max(axis.bottom, bottom - pad) : 0;
  const marks = axis.ticks.filter((t) => t <= ceil + 1e-6 && t >= floor - 1e-6);
  const y = (v: number) => ((ceil - v) / (ceil - floor || 1)) * height;
  const n = columns.length;
  const cx = (i: number) => ((i + 0.5) / n) * 1000;
  const line = (from: number, to: number) => columns.slice(from, to + 1).map((c, k) => `${cx(from + k).toFixed(1)},${y(c.line).toFixed(1)}`).join(' ');
  return (
    <figure class="fx-chart fx-stacked" aria-label={label}>
      <div class="fx-plotrow">
        <Axis marks={marks} y={y} format={format} />
        <div class="fx-plot" style={{ height: `${height}px` }} onPointerLeave={() => setAt(-1)}>
          {marks.map((t) => <span key={t} class={'fx-grid' + (t === 0 ? ' zero' : '')} style={{ top: `${y(t)}px` }} />)}
          {floor < 0 && <span class="fx-below" style={{ top: `${y(0)}px` }} />}
          {columns.map((c, i) => {
            let up = 0, down = 0;
            return (
              <div key={i} class={'fx-stackcol' + (c.ahead ? ' ahead' : '') + (i === shown ? ' on' : '')} style={{ left: `${(i / n) * 100}%`, width: `${100 / n}%` }} onPointerEnter={() => setAt(i)}>
                {c.up.map((p, k) => { const t = y(up + p.value), h = y(up) - t; up += p.value; return <span key={'u' + k} class={'fx-seg ' + hue(p.color) + (k === c.up.length - 1 ? ' cap' : '')} style={{ top: `${t}px`, height: `${Math.max(h, p.value > 0 ? 1 : 0)}px` }} />; })}
                {c.down.map((p, k) => { const t = y(-down), h = y(-down - p.value) - t; down += p.value; return <span key={'d' + k} class={'fx-seg ' + hue(p.color) + (k === c.down.length - 1 ? ' foot' : '')} style={{ top: `${t}px`, height: `${Math.max(h, p.value > 0 ? 1 : 0)}px` }} />; })}
              </div>
            );
          })}
          <svg viewBox={`0 0 1000 ${height}`} preserveAspectRatio="none" aria-hidden="true">
            <polyline class="fx-netline" points={line(0, last)} vector-effect="non-scaling-stroke" />
            {last < n - 1 && <polyline class="fx-netline ahead" points={line(last, n - 1)} vector-effect="non-scaling-stroke" />}
          </svg>
          {columns.map((c, i) => <span key={i} class={'fx-netdot' + (i === shown ? ' on' : '')} style={{ left: `${((i + 0.5) / n) * 100}%`, top: `${y(c.line)}px` }} />)}
          {at >= 0 && <div class="fx-tip wide" style={tipSide(((at + 0.5) / n) * 100)}>{tip(at)}</div>}
        </div>
      </div>
      <div class="fx-barlabels" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {columns.map((c, i) => <span key={i} class={i === shown ? 'on' : ''}>{c.label}</span>)}
      </div>
    </figure>
  );
}

/** A ring split in proportion, with what it adds up to in the middle. */
export function Donut({ slices, center, size = 150, label }: { slices: { label: string; value: number; color: Hue }[]; center: ComponentChildren; size?: number; label: string }) {
  const total = slices.reduce((t, s) => t + Math.max(0, s.value), 0) || 1;
  const r = 56, c = 2 * Math.PI * r, gap = slices.length > 1 ? 2 : 0;
  let run = 0;
  const said = slices.map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`).join(', ');
  return (
    <div class="fx-donut" style={{ width: `${size}px`, height: `${size}px` }}>
      <svg viewBox="0 0 150 150" role="img" aria-label={`${label}: ${said}`}>
        {slices.map((s) => {
          const len = (Math.max(0, s.value) / total) * c;
          const el = <circle key={s.label} class={'fx-slice ' + hue(s.color)} cx="75" cy="75" r={r} stroke-dasharray={`${Math.max(len - gap, 0.5).toFixed(2)} ${c.toFixed(2)}`} stroke-dashoffset={(-run).toFixed(2)} />;
          run += len;
          return el;
        })}
      </svg>
      <div class="fx-donutcenter">{center}</div>
    </div>
  );
}
