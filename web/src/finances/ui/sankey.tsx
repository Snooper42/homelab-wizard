// The flow chart: boxes in columns, each as tall as its money, and a band
// from each to where its money went, as wide as that part of it. Each box
// says its name, amount, and share of where it came from (or went). Resting
// on a box or band, or Tab to a box, lights what it is part of and dims the
// rest; a click (Return, a tap) picks a box, and the card shows what is
// behind it. Narrow, the first column is left out: its money starts in the
// second, and narrower still the second too. The last column's words are
// spread so none run into the next, the chart taller when they need it.
// Takes nodes and links only: it knows nothing of the plan.
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { type Hue, hue } from './Legend';

export interface SankeyNode { id: string; label: string; value: number; col: number; hue: Hue }
export interface SankeyLink { from: string; to: string; value: number }

interface Placed extends SankeyNode { x: number; y: number; h: number; share: number }

/** Narrower than these, the first column is left out, then the second. */
const midAt = 760, narrowAt = 480;
const nodeW = 14, gap = 10;

export function Sankey({ nodes, links, label, money, pick, picked, height }: {
  nodes: SankeyNode[];
  links: SankeyLink[];
  /** One sentence for a screen reader: what it shows. */
  label: string;
  money: (n: number) => string;
  /** A box picked: its ID. */
  pick?: (id: string) => void;
  picked?: string;
  height?: number;
}) {
  const box = useRef<HTMLElement>(null);
  const [w, setW] = useState(0);
  const [on, setOn] = useState<{ node?: string; link?: number; x?: number; y?: number } | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const read = () => setW(el.clientWidth);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const narrow = w > 0 && w < midAt;
  const drop = w > 0 && w < narrowAt ? 2 : narrow ? 1 : 0;
  const shown = nodes.filter((n) => n.value > 0.005 && n.col >= drop);
  // Room for each of the last column's words on two lines, one under another.
  const lineH = narrow ? 32 : 38;
  const lastCol = Math.max(...shown.map((n) => n.col), 0);
  const H = Math.max(height || (narrow ? 360 : 440), shown.filter((n) => n.col === lastCol).length * lineH);
  const ids = new Set(shown.map((n) => n.id));
  const ls = links.filter((l) => l.value > 0.005 && ids.has(l.from) && ids.has(l.to));
  const cols = [...new Set(shown.map((n) => n.col))].sort((a, b) => a - b);
  const labelW = drop === 2 ? 120 : narrow ? 170 : 230;
  const last = Math.max(0, w - labelW - nodeW);
  const xOf = (c: number) => (cols.length < 2 ? 0 : (cols.indexOf(c) / (cols.length - 1)) * last);
  // One scale for every column, so a dollar is as tall everywhere: the fullest column fits.
  const k = Math.min(...cols.map((c) => {
    const ns = shown.filter((n) => n.col === c);
    return (H - gap * Math.max(0, ns.length - 1)) / Math.max(ns.reduce((t, n) => t + n.value, 0), 1);
  }));
  const placed: Placed[] = [];
  for (const c of cols) {
    let y = 0;
    for (const n of shown.filter((q) => q.col === c)) {
      const h = Math.max(2, n.value * k);
      // Its share of where it came from (or, first, of where it went).
      const parent = ls.find((l) => l.to === n.id);
      const of = parent ? shown.find((q) => q.id === parent.from)?.value : ls.filter((l) => l.from === n.id).reduce((t, l) => t + l.value, 0);
      placed.push({ ...n, x: xOf(c), y, h, share: of ? n.value / of : 1 });
      y += h + gap;
    }
  }
  const at = new Map(placed.map((p) => [p.id, p]));
  // The last column's words: at their box's middle, pushed down past the one above, then up from the bottom if they run off it.
  const wordsAt = new Map<string, number>();
  const ends = placed.filter((p) => p.col === lastCol);
  let below = -Infinity;
  for (const p of ends) { const y = Math.max(p.y + p.h / 2, below + lineH, lineH / 2); wordsAt.set(p.id, y); below = y; }
  let above = H - lineH / 2;
  for (const p of [...ends].reverse()) { const y = Math.min(wordsAt.get(p.id)!, above); wordsAt.set(p.id, y); above = y - lineH; }
  // Bands leave each box top to bottom in the order of the boxes they go to, and arrive in the order of those they came from.
  const outAt = new Map<string, number>(), inAt = new Map<string, number>();
  const bands = [...ls].sort((a, b) => (at.get(a.to)!.y - at.get(b.to)!.y) || (at.get(a.from)!.y - at.get(b.from)!.y)).map((l) => {
    const s = at.get(l.from)!, t = at.get(l.to)!, th = l.value * k;
    const sy = s.y + (outAt.get(s.id) || 0), ty = t.y + (inAt.get(t.id) || 0);
    outAt.set(s.id, (outAt.get(s.id) || 0) + th); inAt.set(t.id, (inAt.get(t.id) || 0) + th);
    const x0 = s.x + nodeW, x1 = t.x, xm = (x0 + x1) / 2;
    return { l, s, t, d: `M${x0},${sy} C${xm},${sy} ${xm},${ty} ${x1},${ty} L${x1},${ty + th} C${xm},${ty + th} ${xm},${sy + th} ${x0},${sy + th} Z` };
  });
  // What is lit: a box and every band into or out of it, or one band and its two boxes.
  const lit = (from: string, to: string) => !on || (on.node ? on.node === from || on.node === to : false);
  const litNode = (id: string) => !on || (on.node ? on.node === id || ls.some((l) => (l.from === on.node && l.to === id) || (l.to === on.node && l.from === id)) : on.link !== undefined && (bands[on.link].l.from === id || bands[on.link].l.to === id));
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const said = (p: Placed) => `${p.label}, ${money(p.value)}${p.share < 0.9995 ? `, ${pct(p.share)}` : ''}`;
  const tip = on?.link !== undefined ? bands[on.link] : null;
  return (
    <figure class={'fx-sankey' + (narrow ? ' narrow' : '') + (on ? ' lit' : '')} ref={box} aria-label={label} style={{ height: `${H}px` }}
      onMouseLeave={() => setOn(null)}>
      {w > 0 && <>
        <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} aria-hidden="true">
          {bands.map((b, i) => <path key={i} class={'fx-sband ' + hue(b.s.col === 0 ? b.s.hue : b.t.hue) + (on && (on.link === i || lit(b.l.from, b.l.to)) ? ' on' : on ? ' off' : '')} d={b.d}
            onMouseMove={(e) => { const r = box.current!.getBoundingClientRect(); setOn({ link: i, x: e.clientX - r.left, y: e.clientY - r.top }); }} />)}
          {placed.map((p) => <rect key={p.id} class={'fx-snoderect ' + hue(p.hue) + (litNode(p.id) ? '' : ' off')} x={p.x} y={p.y} width={nodeW} height={p.h} rx="2" />)}
        </svg>
        {placed.map((p) => {
          const end = p.col === lastCol, small = !end && p.h < 34, mid = p.col !== cols[0] && !end;
          // In the middle, a box's words sit on it in a pill; at the ends, beside it. A short box in the middle gets one line.
          const style = mid && !small
            ? { left: `${Math.min(Math.max(p.x + nodeW / 2, 60), w - 60)}px`, top: `${p.y + p.h / 2}px` }
            : { left: `${p.x + nodeW + 8}px`, top: `${end ? wordsAt.get(p.id) : p.y + p.h / 2}px`, maxWidth: `${(end ? labelW : last / Math.max(1, cols.length - 1)) - 12}px` };
          return (
            <button key={p.id} type="button" class={'fx-snode' + (mid && !small ? ' pill' : '') + (small ? ' one' : '') + (picked === p.id ? ' picked' : '') + (litNode(p.id) ? '' : ' off')} style={style}
              aria-label={said(p)} aria-pressed={pick ? picked === p.id : undefined}
              onMouseEnter={() => setOn({ node: p.id })} onFocus={() => setOn({ node: p.id })} onBlur={() => setOn(null)}
              onClick={() => pick?.(p.id)}>
              <span class="fx-sname">{p.label}</span>
              <span class="fx-samt">{money(p.value)}{p.share < 0.9995 && <span class="fx-spct"> ({pct(p.share)})</span>}</span>
            </button>
          );
        })}
        {tip && <div class="fx-stip" role="presentation" style={{ left: `${Math.min(on!.x! + 12, w - 200)}px`, top: `${on!.y! + 12}px` }}>
          <span>{tip.s.label} → {tip.t.label}</span><strong>{money(tip.l.value)}</strong>
        </div>}
      </>}
    </figure>
  );
}
