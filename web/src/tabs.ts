
export interface Tabs { now: () => string; put: (tab: string) => void }

export const tabbed: Record<string, Tabs> = {};
let changed = () => {};

/** A screen's tabs: which it is on, and how to put one back. */
export function keepsTabs(screen: string, now: () => string, put: (tab: string) => void) { tabbed[screen] = { now, put }; }

/** A screen's tab changed: a step for Back. */
export function tabChanged() { changed(); }

/** What a tab change does (app.ts: remember the place). */
export function onTabChange(f: () => void) { changed = f; }
