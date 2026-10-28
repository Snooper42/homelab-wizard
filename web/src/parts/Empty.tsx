// An empty state: what a list shows when it has nothing in it, in a few
// words, and what to do about it if anything.
import type { ComponentChildren } from 'preact';

export function Empty({ id, children }: { id?: string; children: ComponentChildren }) {
  return <p id={id} class="muted empty">{children}</p>;
}
