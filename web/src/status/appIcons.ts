// Each app's own icon (the computer keeps them in data/icons and asks an app at most once a week):
// read once per app per visit, one after another, and shared by its page and Status's categories.
import { go } from '../core';

export const icons: Record<string, string> = {};
const asked = new Set<string>();
const listeners: (() => void)[] = [];

/** Calls back when an icon arrives that changes what's drawn. */
export function onIcon(f: () => void) { listeners.push(f); }

/** Reads an app's icon again (its page asks each time it opens). */
export async function readIcon(id: string): Promise<boolean> {
  asked.add(id);
  let icon = '';
  try { icon = (await go().AppIcon(id)) || ''; } catch { /* none: the letter */ }
  if (icon === (icons[id] || '')) return false;
  icons[id] = icon;
  listeners.forEach((f) => f());
  return true;
}

let queue: string[] = [];
let reading = false;
/** The icons of these apps, the ones not asked for yet, one at a time. */
export async function wantIcons(ids: string[]) {
  queue.push(...ids.filter((id) => !asked.has(id) && !queue.includes(id)));
  if (reading) return;
  reading = true;
  try {
    while (queue.length) await readIcon(queue.shift()!);
  } finally { reading = false; queue = []; }
}
