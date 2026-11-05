// A right-click menu at the pointer (or under its button, from Shift+F10 or
// the context-menu key), as an app's row's menu on Status works: its first
// item takes the focus, the arrow keys, Home, and End move through it,
// Escape closes it back where the focus was, and a press elsewhere, the
// window losing focus, or a resize closes it (the press is read as it
// begins, since WebKit moves no focus on a click). An item that changes
// much (Update all) asks for a second click.
import { render } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { $ } from '../core';

export interface ContextItem {
  label: string;
  run: () => void;
  disabled?: boolean;
  /** Asks for a second click first, with these words: "Click again to update every app". */
  sure?: string;
}

/** An item, or a line between groups of them. */
export type ContextEntry = ContextItem | '-';

export function ContextMenu({ label, x, y, items, close }: { label: string; x: number; y: number; items: ContextEntry[]; close: (refocus?: boolean) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState({ left: x, top: y });
  const [sure, setSure] = useState('');
  const buttons = () => [...(box.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]:not([disabled])') || [])];
  // Inside the window: moved left or up when it would run past an edge.
  useLayoutEffect(() => {
    const m = box.current?.getBoundingClientRect();
    if (!m) return;
    setAt({ left: Math.max(8, Math.min(x, innerWidth - m.width - 8)), top: y + m.height > innerHeight - 8 ? Math.max(8, y - m.height) : y });
  }, [x, y]);
  useEffect(() => {
    buttons()[0]?.focus();
    const outside = (e: Event) => { if (!box.current?.contains(e.target as Node)) close(); };
    const gone = () => close();
    document.addEventListener('mousedown', outside, true);
    window.addEventListener('blur', gone);
    window.addEventListener('resize', gone);
    return () => { document.removeEventListener('mousedown', outside, true); window.removeEventListener('blur', gone); window.removeEventListener('resize', gone); };
  }, []);
  return (
    <div ref={box} class="menu rowmenu" role="menu" aria-label={label} style={{ left: at.left + 'px', top: at.top + 'px' }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); return; }
        const all = buttons(), i = all.indexOf(document.activeElement as HTMLButtonElement);
        const to = ({ ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: all.length - 1 } as Record<string, number>)[e.key];
        if (to === undefined || !all.length) return;
        e.preventDefault();
        all[(to + all.length) % all.length].focus();
      }}>
      {items.map((it, i) => (it === '-'
        ? <hr key={i} />
        : <button key={it.label} type="button" role="menuitem" class={sure === it.label ? 'danger' : undefined} disabled={it.disabled}
          onClick={() => { if (it.sure && sure !== it.label) { setSure(it.label); return; } close(true); it.run(); }}>
          {sure === it.label ? it.sure : it.label}
        </button>))}
    </div>
  );
}

let from: HTMLElement | null = null;

/** Opens a context menu at x, y; a second one replaces the first. Closing it puts the focus back on what had it, when asked. */
export function openContextMenu(label: string, x: number, y: number, items: ContextEntry[]) {
  const host = $('contextMenu');
  from = document.activeElement as HTMLElement | null;
  const close = (refocus?: boolean) => {
    render(null, host);
    if (refocus && from?.isConnected && from !== document.body) from.focus();
  };
  render(null, host);
  render(<ContextMenu label={label} x={x} y={y} items={items} close={close} />, host);
}
