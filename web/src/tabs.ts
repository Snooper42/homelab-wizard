// A screen's tabs, for Back and Forward (app.ts): which tab it is on, and how
// to put one back (the owner, Nov 12: Back from Finances' Recurring or
// Spending went straight to Status). A module of its own, with nothing to
// import, so a screen can name its tabs as it loads, before app.ts has.

export interface Tabs { now: () => string; put: (tab: string) => void }

export const tabbed: Record<string, Tabs> = {};
let changed = () => {};

/** A screen's tabs: which it is on, and how to put one back. */
export function keepsTabs(screen: string, now: () => string, put: (tab: string) => void) { tabbed[screen] = { now, put }; }

/** A screen's tab changed: a step for Back. */
export function tabChanged() { changed(); }

/** What a tab change does (app.ts: remember the place). */
export function onTabChange(f: () => void) { changed = f; }
