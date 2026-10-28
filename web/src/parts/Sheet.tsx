// A sheet: a panel over the screen for one task (a command and its log, an
// app's log), with the focus in it while it is open and back where it was
// after, and Escape closing it through its own Close or Cancel (a command
// still running has neither). The screens open and close it by its hidden
// attribute, and fill it by the IDs inside.
import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';

const openSheets = () => [...document.querySelectorAll<HTMLElement>('.panel.sheet:not([hidden])')];

let escapes = false;
function closeOnEscape() {
  if (escapes) return;
  escapes = true;
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = openSheets().pop();
    const close = open && [...open.querySelectorAll<HTMLButtonElement>('button:not([disabled])')].find((b) => /^(Close|Cancel)$/.test(b.textContent!.trim()));
    if (close) { e.preventDefault(); close.click(); }
  });
}

/** onClose: called when the last open sheet closes. */
export function Sheet({ id, titleId, onClose, children }: { id: string; titleId: string; onClose?: () => void; children: ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    closeOnEscape();
    const panel = ref.current!;
    let before: Element | null = null;
    const seen = new MutationObserver(() => {
      document.documentElement.classList.toggle('sheet-open', openSheets().length > 0);
      if (!panel.hidden) {
        if (!panel.contains(document.activeElement)) before = document.activeElement;
        requestAnimationFrame(() => (panel.querySelector<HTMLElement>('button:not([disabled])') || panel).focus());
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
