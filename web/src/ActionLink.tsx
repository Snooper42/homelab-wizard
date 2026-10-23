import type { ComponentChildren } from 'preact';

/** A link that does something rather than go somewhere: reached with Tab, pressed with Enter or Space. */
export function ActionLink({ onClick, title, id, cls, children }: { onClick: () => void; title?: string; id?: string; cls?: string; children: ComponentChildren }) {
  const key = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } };
  return <a id={id} class={cls} tabIndex={0} role="button" title={title} onClick={onClick} onKeyDown={key}>{children}</a>;
}
