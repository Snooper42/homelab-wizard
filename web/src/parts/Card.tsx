import type { ComponentChildren } from 'preact';

/** A card's heading row: its title and a few words, or a button, beside it (just the title when nothing is). */
export function CardHead({ title, id, children }: { title: ComponentChildren; id?: string; children?: ComponentChildren }) {
  if (children === undefined) return <h2 id={id}>{title}</h2>;
  return <div class="row"><h2 id={id}>{title}</h2>{children}</div>;
}

export interface CardProps {
  /** What kind of card: tile, notice, … (style.css). */
  kind?: string;
  id?: string;
  title?: string;
  role?: 'status' | 'alert';
  children?: ComponentChildren;
}

export function Card({ kind, id, title, role, children }: CardProps) {
  return <div id={id} title={title} role={role} class={'card' + (kind ? ' ' + kind : '')}>{children}</div>;
}

/** Which way a chip's figure went, and whether that's good (owing less going down is). */
export interface ChipProps {
  /** Up, down, or no change: its arrow. */
  dir: 'up' | 'down' | 'flat';
  /** Green for good, red for bad, grey for no change. */
  good: boolean | null;
  /** The change: "+$331.86", "+12.4%". */
  value: ComponentChildren;
  /** What it's compared with, under the pill: "vs last paycheck". */
  words?: string;
}

export function Chip({ dir, good, value, words }: ChipProps) {
  const tone = good === null ? 'flat' : good ? 'good' : 'bad';
  const arrow = dir === 'up' ? 'M7 17 17 7M8 7h9v9' : dir === 'down' ? 'M7 7l10 10M17 8v9H8' : 'M5 12h14';
  return (
    <span class="chip-cmp">
      <span class={'chip-pill ' + tone}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={arrow} /></svg>{value}</span>
      {words && <span class="chip-words">{words}</span>}
    </span>
  );
}

/** A card's one figure: the figure (its cents smaller, the caller's Amount does that), the small capitalised label under it, and the chip on the right. */
export function CardFigure({ figure, label, chip }: { figure: ComponentChildren; label?: ComponentChildren; chip?: ComponentChildren }) {
  return (
    <div class="card-figure">
      <div class="card-figuremain">
        <div class="card-figurevalue">{figure}</div>
        {label && <div class="card-figurelabel">{label}</div>}
      </div>
      {chip && <div class="card-figurechip">{chip}</div>}
    </div>
  );
}
