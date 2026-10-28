// A card: a panel of the page with its heading row. Most cards are a box in
// index.html that a component draws into; CardHead is their heading, Card
// the whole box for one a component draws itself (a tile, a notice).
import type { ComponentChildren } from 'preact';

/** A card's heading row: its title and a few words, or a button, beside it (just the title when nothing is). */
export function CardHead({ title, children }: { title: ComponentChildren; children?: ComponentChildren }) {
  if (children === undefined) return <h2>{title}</h2>;
  return <div class="row"><h2>{title}</h2>{children}</div>;
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
