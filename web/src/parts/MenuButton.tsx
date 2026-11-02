// A button that opens a short menu under it, as Status's More… and a
// group's menu do: the arrow keys, Home, and End move through it, Escape
// closes it back on its button, and a press anywhere else closes it (read
// as the press begins, since WebKit moves no focus on a click). Opened from
// the keyboard, its first item takes the focus.
import { type ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

export interface MenuItem {
  label: string;
  onClick: () => void;
}

export function MenuButton({ label, title, menuLabel, items, foot, disabled, cls = 'btn' }: {
  label: ComponentChildren;
  title?: string;
  /** What a screen reader calls the menu. */
  menuLabel: string;
  items: MenuItem[];
  /** A line under the items. */
  foot?: string;
  disabled?: boolean;
  cls?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const all = () => [...(wrap.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]') || [])];
  const close = (refocus?: boolean) => { setOpen(false); if (refocus) btn.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => { if (!wrap.current?.contains(e.target as Node)) close(); };
    document.addEventListener('mousedown', outside, true);
    return () => document.removeEventListener('mousedown', outside, true);
  }, [open]);
  const show = (first: 'first' | 'last' | null) => {
    setOpen(true);
    if (first) requestAnimationFrame(() => { const m = all(); m[first === 'first' ? 0 : m.length - 1]?.focus(); });
  };
  return (
    <span class="menuwrap" ref={wrap}
      onKeyDown={(e) => {
        if (!open) return;
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); return; }
        const m = all(), at = m.indexOf(document.activeElement as HTMLButtonElement);
        const to = ({ ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: m.length - 1 } as Record<string, number>)[e.key];
        if (to === undefined || !m.length) return;
        e.preventDefault();
        m[(to + m.length) % m.length].focus();
      }}
      onFocusOut={() => setTimeout(() => { if (open && document.hasFocus() && !wrap.current?.contains(document.activeElement)) close(); })}>
      <button type="button" ref={btn} class={cls} title={title} aria-haspopup="menu" aria-expanded={open} disabled={disabled}
        onClick={(e) => (open ? close() : show(e.detail === 0 ? 'first' : null))}
        onKeyDown={(e) => { if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); show(e.key === 'ArrowDown' ? 'first' : 'last'); } }}>
        {label}<span class="drop" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div class="menu" role="menu" aria-label={menuLabel}>
          {items.map((it) => <button key={it.label} type="button" role="menuitem" onClick={() => { close(true); it.onClick(); }}>{it.label}</button>)}
          {foot && <p class="menufoot muted">{foot}</p>}
        </div>
      )}
    </span>
  );
}
