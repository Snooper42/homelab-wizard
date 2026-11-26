import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';

const field = 'input:not([disabled]):not([type=hidden]):not([type=checkbox]):not([type=file]):not([hidden]), select:not([disabled]), textarea:not([disabled])';
const openSheets = () => [...document.querySelectorAll<HTMLElement>('.panel.sheet:not([hidden])')];

// What Tab stops on in a sheet, as drawn now.
const stops = (sheet: HTMLElement) => [...sheet.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')]
  .filter((e) => e.getClientRects().length > 0);

// The sheet's own Close or Cancel (or Hide, for a command that carries on
// behind it), which Escape and the dimmed screen press.
const closer = (sheet: HTMLElement) => [...sheet.querySelectorAll<HTMLButtonElement>('button:not([disabled])')].find((b) => /^(Close|Cancel|Hide)$/.test(b.textContent!.trim()));

let listening = false;
function keys() {
  if (listening) return;
  listening = true;
  let downOnDim = false;
  document.addEventListener('mousedown', (e) => { downOnDim = e.target === document.body && openSheets().length > 0; }, true);
  document.addEventListener('click', (e) => {
    const open = openSheets().pop();
    if (!open || !downOnDim || e.target !== document.body) return;
    downOnDim = false;
    closer(open)?.click();
  });
  document.addEventListener('keydown', (e) => {
    const open = openSheets().pop();
    if (!open) return;
    if (e.key === 'Escape') {
      const close = closer(open);
      if (close) { e.preventDefault(); close.click(); }
    } else if (e.key === 'Tab') {
      // After the last control back to the first (Shift+Tab the other way);
      // the screen behind the sheet never takes the focus.
      const all = stops(open);
      if (!all.length) { e.preventDefault(); open.focus(); return; }
      const at = all.indexOf(document.activeElement as HTMLElement);
      const next = at < 0 ? (e.shiftKey ? all.length - 1 : 0) : at + (e.shiftKey ? -1 : 1);
      if (at < 0 || next < 0 || next >= all.length) { e.preventDefault(); all[(next + all.length) % all.length].focus(); }
    }
  });
}

/** onClose: called when the last open sheet closes. */
export function Sheet({ id, titleId, onClose, children }: { id: string; titleId: string; onClose?: () => void; children: ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    keys();
    const panel = ref.current!;
    let before: Element | null = null;
    const seen = new MutationObserver(() => {
      document.documentElement.classList.toggle('sheet-open', openSheets().length > 0);
      if (!panel.hidden) {
        if (!panel.contains(document.activeElement)) before = document.activeElement;
        requestAnimationFrame(() => {
          const now = document.activeElement;
          if (panel.hidden || (now && now !== panel && panel.contains(now))) return;
          panel.scrollTop = 0;
          (panel.querySelector<HTMLElement>(field) || panel.querySelector<HTMLElement>('button:not([disabled])') || panel).focus();
        });
      } else {
        if (before && document.contains(before)) (before as HTMLElement).focus();
        before = null;
        if (!openSheets().length) onClose?.();
      }
    });
    seen.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
    return () => seen.disconnect();
  }, []);
  return <div ref={ref} id={id} class="panel sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} hidden>{children}</div>;
}
