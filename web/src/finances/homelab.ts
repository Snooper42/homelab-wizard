// The homelab doing a paid service's job: a payment still in the plan for
// a service an app running here replaces (docs/Savings.md, through the
// catalog's Replaces). A payment is that service when every word of its
// name that says who it is (not "premium", "plan", or the like) is in the
// service's name: Netflix is "Netflix Standard", iCloud "iCloud+ 2 TB",
// and Google One is not "Google Home Premium".

/** A running app and the paid services it stands in for. */
export interface Running { name: string; replaces: string[] }

/** A payment an app running here does the job of: the service, and the apps. */
export interface Replaced { payment: finance.Payment; service: string; apps: string[] }

/** Words that say what plan, not whose. */
const generic = new Set(['subscription', 'plan', 'membership', 'premium', 'family', 'standard', 'plus', 'pro', 'basic', 'personal', 'monthly', 'yearly', 'annual', 'the', 'and', 'of']);

const words = (s: string): string[] => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);

/** Whether a payment's name is a service's: its own words all in the service's name. */
export function same(payment: string, service: string): boolean {
  const own = words(payment).filter((w) => !generic.has(w));
  const theirs = new Set(words(service));
  return own.length > 0 && own.every((w) => theirs.has(w));
}

/** The payments in the plan that running apps do the job of, each once, with every app that does. */
export function replacedBy(plan: finance.Plan, running: Running[]): Replaced[] {
  const out: Replaced[] = [];
  for (const x of plan.payments || []) {
    if (x.to || x.card) continue; // money moved, or a card paid off: not a service
    for (const app of running) {
      const service = app.replaces.find((s) => same(x.name, s));
      if (!service) continue;
      const had = out.find((r) => r.payment.id === x.id);
      if (had) { if (!had.apps.includes(app.name)) had.apps.push(app.name); } else out.push({ payment: x, service, apps: [app.name] });
    }
  }
  return out;
}
