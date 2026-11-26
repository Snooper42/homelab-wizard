
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

export const kindHue: Record<string, number> = { home: 8, cards: 8, spending: 2, car: 1, utilities: 3, subscriptions: 5, loans: 6, other: 6 };

/** The category each payment kind is. */
const kindCategory: Record<string, string> = { home: 'Home', utilities: 'Utilities', car: 'Car', subscriptions: 'Subscriptions', spending: 'Shopping', other: 'Other' };

/** A payment kind's colour: its category's, else its own. */
export const kindHueOf = (kind: string | undefined, categories: finance.Category[] = known): number =>
  categoryHue(kindCategory[kind || 'other'], categories) || kindHue[kind || 'other'] || 6;
