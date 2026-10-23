// A sparkline: a line through values, scaled to fill w×h.

export function Spark({ values, w = 96, h = 24, title }: { values: number[]; w?: number; h?: number; title?: string }) {
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const points = values.map((v, i) => `${((i / Math.max(1, values.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - lo) / span) * (h - 4)).toFixed(1)}`).join(' ');
  return (
    <svg class="spark" viewBox={`0 0 ${w} ${h}`} role={title ? 'img' : undefined} aria-label={title}>
      <polyline points={points} fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
    </svg>
  );
}
