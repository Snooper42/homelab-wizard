// One colour per category, everywhere it is drawn: a transaction's icon,
// a budget, a report's row and bar, the money flow, the donut. Each top
// category of the household's takes the next of the eight --cat colours in
// turn; a category under another takes its group's. A payment's kind takes
// the colour of the category it is (Home, Utilities, Car…). The screen sets
// the categories once it reads them (setCategories), so a mark anywhere can
// colour itself. Plain functions: no drawing.

/** How many colours there are (--cat-1 … --cat-8 in style.css, each with a -soft and an -ink at 4.5:1). */
const hues = 8;

let known: finance.Category[] = [];

/** The household's categories, as Finances last read them: what each mark's colour is worked out from. */
export const setCategories = (categories?: finance.Category[]) => { known = categories || []; };

/** A category's colour, 1 to 8: its own as a top category, or its group's; 0 for none known. */
export function categoryHue(name: string | undefined, categories: finance.Category[] = known): number {
  if (!name) return 0;
  const c = categories.find((q) => q.name.toLowerCase() === name.toLowerCase());
  const top = c?.parent || c?.name || name;
  const tops = categories.filter((q) => !q.parent && !q.income);
  const at = tops.findIndex((q) => q.name.toLowerCase() === top.toLowerCase());
  return at < 0 ? 0 : (at % hues) + 1;
}

/**
 * Each payment kind's colour when no category of its name is kept (Cards, Loans), as before categories had colours.
 * Cards and Loans take 8 and 6, which no kind's category takes among the default ones (Home 1, Utilities 2, Car 4,
 * Subscriptions 5, Shopping 7): with 7 and 4 they were drawn as Spending's purple and Car's yellow beside them.
 */
export const kindHue: Record<string, number> = { home: 8, cards: 8, spending: 2, car: 1, utilities: 3, subscriptions: 5, loans: 6, other: 6 };

/** The category each payment kind is. */
const kindCategory: Record<string, string> = { home: 'Home', utilities: 'Utilities', car: 'Car', subscriptions: 'Subscriptions', spending: 'Shopping', other: 'Other' };

/** A payment kind's colour: its category's, else its own. */
export const kindHueOf = (kind: string | undefined, categories: finance.Category[] = known): number =>
  categoryHue(kindCategory[kind || 'other'], categories) || kindHue[kind || 'other'] || 6;
