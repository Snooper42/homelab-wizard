// The kit's primitives for money: an amount, a change, and a figure with
// its caption. They take numbers and words only, never the plan; colours
// come from the tone classes (fx-in, fx-out, …) in style.css.
import type { ComponentChildren } from 'preact';
import { compact, money, signed, split, whole } from '../money';

/** What an amount means: money in, money out, kept, a warning, or nothing to say ("auto": in when above zero, out below). */
export type Tone = 'in' | 'out' | 'save' | 'warn' | 'muted' | 'auto' | '';

const toneClass = (tone: Tone | undefined, n: number) => (tone === 'auto' ? (n < -0.005 ? ' fx-out' : n > 0.005 ? ' fx-in' : '') : tone ? ' fx-' + tone : '');

export interface AmountProps {
  value: number;
  /** "small" (the default) writes the cents smaller; "whole" rounds; "compact" writes $9.01k. */
  form?: 'small' | 'full' | 'whole' | 'compact';
  /** A + before money in, as well as the − before money out. */
  sign?: boolean;
  tone?: Tone;
}

/** An amount in the plan's currency. */
export function Amount({ value, form = 'small', sign, tone }: AmountProps) {
  const cls = 'fx-amount' + toneClass(tone, value);
  if (form === 'compact') return <span class={cls}>{compact(value)}</span>;
  if (form === 'whole') return <span class={cls}>{sign && value > 0.5 ? '+' : ''}{whole(value)}</span>;
  if (form === 'full') return <span class={cls}>{sign ? signed(value) : money(value)}</span>;
  const [d, c] = split(Math.abs(value));
  return <span class={cls}>{value < -0.005 ? '−' : sign && value > 0.005 ? '+' : ''}{d}<small>{c}</small></span>;
}

export interface DeltaProps {
  /** The change. */
  value: number;
  /** What it changed from, for its share ("+4.1%"); none leaves the share out. */
  base?: number;
  /** "badge" (the default) is a small tinted pill; "text" an arrow and words. */
  look?: 'badge' | 'text';
  /** Words after it, in grey: "this month". */
  label?: ComponentChildren;
  /** Whether going down is the good direction (what is owed). */
  downIsGood?: boolean;
  /** Only the share, no amount (a badge beside a figure). */
  shareOnly?: boolean;
}

/** A change: up or down, how much, and its share of what it changed from. */
export function Delta({ value, base, look = 'badge', label, downIsGood, shareOnly }: DeltaProps) {
  const flat = Math.abs(value) < 0.005;
  const good = flat ? null : (value > 0) !== !!downIsGood;
  const tone = good === null ? 'muted' : good ? 'in' : 'out';
  const pct = base && Math.abs(base) > 0.005 ? `${value < 0 ? '−' : '+'}${Math.abs((value / Math.abs(base)) * 100).toFixed(1)}%` : '';
  if (look === 'badge') return <span class={'fx-badge fx-' + tone}>{shareOnly ? pct : <>{signed(value)}{pct && <> {pct}</>}</>}</span>;
  return (
    <span class="fx-delta">
      <span class={'fx-' + tone}>{flat ? 'No change' : <><span aria-hidden="true">{value < 0 ? '↓ ' : '↑ '}</span>{signed(value)}{pct && ` (${pct})`}</>}</span>
      {label && <span class="fx-sub"> {label}</span>}
    </span>
  );
}

export interface StatProps {
  /** The figure: usually an Amount. */
  value: ComponentChildren;
  /** The caption under it, small capitals: "Today", "Left in a typical month". */
  caption?: ComponentChildren;
  /** Beside the figure, at the end: a Delta, a pill. */
  aside?: ComponentChildren;
  size?: 'lg' | 'md' | 'sm';
}

/** A figure with its caption under it, and something beside it. */
export function Stat({ value, caption, aside, size = 'md' }: StatProps) {
  return (
    <div class={'fx-stat ' + size}>
      <div class="fx-statmain"><div class="fx-figure">{value}</div>{aside && <div class="fx-aside">{aside}</div>}</div>
      {caption && <div class="fx-caption">{caption}</div>}
    </div>
  );
}

/** Small bordered figures side by side: Income, Spending, Saved. */
export function Tiles({ items }: { items: { label: string; value: ComponentChildren; tone?: Tone }[] }) {
  return (
    <div class="fx-tiles">
      {items.map((t) => <div key={t.label} class="fx-tile"><div class="fx-caption">{t.label}</div><div class={'fx-tilevalue' + toneClass(t.tone, 0)}>{t.value}</div></div>)}
    </div>
  );
}
