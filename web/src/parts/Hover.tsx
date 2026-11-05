// An answer on hover: a badge or a few words that show a small card when
// the pointer rests on them, when the keyboard reaches them (Tab), or when
// a phone taps them. Escape, the pointer leaving, or the focus moving on
// closes it. The card is the trigger's description (aria-describedby), so
// a screen reader reads it too; it is placed under the trigger, inside the
// window, so neither a table's edge nor the window cuts it off.
import { type ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';

let made = 0;

export function Hover({ label, cls = '', tip, wide }: {
  /** What shows in the row: the badge's words. */
  label: ComponentChildren;
  cls?: string;
  /** The card's content. */
  tip: ComponentChildren;
  /** A card wide enough for a strip of the week. */
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [id] = useState(() => `hover-${++made}`);
  const at = useRef<HTMLSpanElement>(null);
  const card = useRef<HTMLSpanElement>(null);
  const timer = useRef(0);
  const show = (soon: boolean) => { clearTimeout(timer.current); if (soon) setOpen(true); else timer.current = window.setTimeout(() => setOpen(true), 250); };
  const hide = () => { clearTimeout(timer.current); setOpen(false); };
  useLayoutEffect(() => {
    const t = at.current, c = card.current;
    if (!open || !t || !c) return;
    const r = t.getBoundingClientRect(), w = c.offsetWidth, h = c.offsetHeight, pad = 8;
    const left = Math.max(pad, Math.min(r.left, innerWidth - w - pad));
    const below = r.bottom + 6, top = below + h > innerHeight - pad && r.top - h - 6 > pad ? r.top - h - 6 : below;
    c.style.left = `${left}px`;
    c.style.top = `${top}px`;
  }, [open]);
  return (
    <span class={'hovers ' + cls} ref={at} tabIndex={0} aria-describedby={id}
      onMouseEnter={() => show(false)} onMouseLeave={hide} onFocus={() => show(true)} onBlur={hide}
      onClick={() => show(true)}
      onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); hide(); } }}>
      {label}
      <span id={id} role="tooltip" class={'hovercard' + (wide ? ' wide' : '')} ref={card} hidden={!open}>{tip}</span>
    </span>
  );
}
