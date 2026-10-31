// The kit's colour keys: a coloured dot, a bar split in proportion, and a
// legend that names each part. A colour is a series number (1 to 8, the
// fixed --cat-N order, colour-blind checked) or a meaning (in, out, save,
// accent, track), never a value, so light, dark, and contrast themes hold.
import type { ComponentChildren } from 'preact';

/** A series colour: --cat-1 … --cat-8, or what it means. */
export type Hue = number | 'in' | 'out' | 'save' | 'accent' | 'track' | 'muted';

/** The class that colours an element with a hue (its --fx-hue). */
export const hue = (h: Hue): string => (typeof h === 'number' ? `fx-h${h}` : `fx-h-${h}`);

export function Dot({ color, shape = 'round' }: { color: Hue; shape?: 'round' | 'square' | 'line' | 'dash' }) {
  return <span class={`fx-dot ${shape} ${hue(color)}`} aria-hidden="true" />;
}

export interface Part {
  label: string;
  value: number;
  color: Hue;
}

/** A bar split in proportion to its parts' values; it says what they are to a screen reader. */
export function SplitBar({ parts, label, size = 'md' }: { parts: Part[]; label: string; size?: 'sm' | 'md' }) {
  const total = parts.reduce((t, p) => t + Math.max(0, p.value), 0);
  const said = parts.filter((p) => p.value > 0).map((p) => `${p.label} ${Math.round((p.value / (total || 1)) * 100)}%`).join(', ');
  return (
    <div class={'fx-split ' + size} role="img" aria-label={`${label}: ${said}`}>
      {parts.filter((p) => p.value > 0).map((p) => <span key={p.label} class={hue(p.color)} style={{ flexGrow: p.value }} />)}
    </div>
  );
}

/** Each part named, with what it comes to (and its share, or anything else) at the end. */
export function Legend({ items, layout = 'list' }: { items: { label: ComponentChildren; color: Hue; value?: ComponentChildren; note?: ComponentChildren; shape?: 'round' | 'square' | 'line' | 'dash' }[]; layout?: 'list' | 'inline' }) {
  return (
    <ul class={'fx-legend ' + layout}>
      {items.map((it, i) => (
        <li key={i}>
          <Dot color={it.color} shape={it.shape} />
          <span class="fx-legendlabel">{it.label}</span>
          {it.note !== undefined && <span class="fx-sub">{it.note}</span>}
          {it.value !== undefined && <span class="fx-legendvalue">{it.value}</span>}
        </li>
      ))}
    </ul>
  );
}
