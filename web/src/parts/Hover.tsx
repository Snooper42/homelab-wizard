// An answer on hover: a badge, a few words, or a button that shows a small
// card when the pointer rests on it, when the keyboard reaches it (Tab), or
// when a phone taps it. Escape, the pointer leaving, or the focus moving on
// closes it. The card is the trigger's description (aria-describedby), so
// a screen reader reads it too; it is placed under the trigger (or beside
// it, in the sidebar), inside the window, so neither a table's edge nor the
// window cuts it off.
import { type ComponentChildren, type JSX } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';

let made = 0;

export interface HoverCardOptions {
  /** A card wide enough for a strip of the week. */
  wide?: boolean;
  /** Where it opens: under the trigger, or to its right (the sidebar's). */
  side?: 'below' | 'right';
  /** Its content drawn only while it shows: one that reads something (release notes) reads it then, not with every row. */
  lazy?: boolean;
}

/**
 * The card for a trigger of the caller's own (a button keeps its own click):
 * spread `on` onto the trigger, and put `card` beside it, outside it, so the
 * trigger's name stays its own words.
 */
export function useHoverCard<T extends HTMLElement>(tip: ComponentChildren, { wide, side = 'below', lazy }: HoverCardOptions = {}) {
  const [open, setOpen] = useState(false);
  const [id] = useState(() => `hover-${++made}`);
  const at = useRef<T>(null);
  const box = useRef<HTMLSpanElement>(null);
  const timer = useRef(0);
  const show = (soon: boolean) => { clearTimeout(timer.current); if (soon) setOpen(true); else timer.current = window.setTimeout(() => setOpen(true), 250); };
  const hide = () => { clearTimeout(timer.current); setOpen(false); };
  useLayoutEffect(() => {
    const t = at.current, c = box.current;
    if (!open || !t || !c) return;
    const r = t.getBoundingClientRect(), w = c.offsetWidth, h = c.offsetHeight, pad = 8;
    let left: number, top: number;
    if (side === 'right') {
      left = Math.min(r.right + 8, innerWidth - w - pad);
      top = Math.max(pad, Math.min(r.top - 4, innerHeight - h - pad));
    } else {
      left = Math.max(pad, Math.min(r.left, innerWidth - w - pad));
      const below = r.bottom + 6;
      top = below + h > innerHeight - pad && r.top - h - 6 > pad ? r.top - h - 6 : below;
    }
    c.style.left = `${left}px`;
    c.style.top = `${top}px`;
  }, [open]);
  const on = {
    ref: at,
    'aria-describedby': id,
    onMouseEnter: () => show(false),
    onMouseLeave: hide,
    onFocus: () => show(true),
    onBlur: hide,
    onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Escape' && open) { e.stopPropagation(); hide(); } },
  };
  const card: JSX.Element = <span id={id} role="tooltip" class={'hovercard' + (wide ? ' wide' : '')} ref={box} hidden={!open}>{(!lazy || open) && tip}</span>;
  return { on, card, show, open };
}

/** Words that answer on hover: a badge in a row, focusable, its card inside it. */
export function Hover({ label, cls = '', tip, wide, lazy }: {
  /** What shows in the row: the badge's words. */
  label: ComponentChildren;
  cls?: string;
  /** The card's content. */
  tip: ComponentChildren;
  wide?: boolean;
  lazy?: boolean;
}) {
  const { on, card, show } = useHoverCard<HTMLSpanElement>(tip, { wide, lazy });
  return (
    <span class={'hovers ' + cls} tabIndex={0} {...on} onClick={() => show(true)}>
      {label}
      {card}
    </span>
  );
}
