// Export (F18): the plan, and what's ahead, in open formats a household can
// keep or take elsewhere, and a month on paper. The plan is finance.json's
// own shape, so it reads back as it was; what's ahead is a CSV a
// spreadsheet opens, one payday or payment a row, with checking after each
// day; the month is a page of its own (nothing fetched from elsewhere)
// that prints itself when opened.
import { money } from './money';

/** A cell of a CSV: quoted when it holds a comma, quote, or line break; text a spreadsheet would run as a formula starts with an apostrophe. */
function cell(s: string): string {
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The plan as JSON, as finance.json keeps it. */
export const planJson = (plan: finance.Plan): string => JSON.stringify(plan, null, 2) + '\n';

/** Who an event is: a payment's name, or whose pay. */
function what(plan: finance.Plan, e: finance.Event): [string, string] {
  if (e.payment) {
    const p = plan.payments?.find((x) => x.id === e.payment);
    return [p?.name || e.payment, e.card ? 'Card charge' : e.amount >= 0 ? 'Money in' : 'Payment'];
  }
  const names = (e.people || []).map((id) => plan.people?.find((x) => x.id === id)?.name || id);
  return [names.length ? `${names.join(' and ')}'s pay` : 'Pay', 'Payday'];
}

const accountName = (plan: finance.Plan, id?: string) => (id ? plan.accounts?.find((a) => a.id === id)?.name || id : '');

/**
 * Every payday and payment from today to a year out, oldest first: the date,
 * who or what, its kind, the amount (money out a minus), the account it
 * comes from or goes to, and checking at the end of that day where the
 * projection reads it (the chart's months; past them, no balance). A charge
 * to a card says the card, and moves no checking money.
 */
export function aheadCsv(v: finance.View): string {
  const rows: string[][] = [['Date', 'What', 'Kind', 'Amount', 'Account', 'Checking after']];
  const days = [...(v.days || []), ...(v.later || [])].filter((d) => d.date >= v.today);
  for (const d of days) {
    const balance = (v.days || []).includes(d) ? d.balance.toFixed(2) : '';
    for (const e of d.events || []) {
      const [name, kind] = what(v.plan, e);
      const pay = e.payment ? v.plan.payments?.find((x) => x.id === e.payment) : undefined;
      const acct = e.card || (e.amount >= 0 ? pay?.to : pay?.from) || v.checking;
      rows.push([d.date, name, kind, e.amount.toFixed(2), accountName(v.plan, acct), balance]);
    }
    for (const e of d.charges || []) {
      const [name] = what(v.plan, e);
      rows.push([d.date, name, 'Card charge', e.amount.toFixed(2), accountName(v.plan, e.card), '']);
    }
  }
  // Amounts and balances are numbers, their minus a minus: never a formula's.
  return rows.map((row) => row.map((c, i) => (i === 3 || i === 5 ? c : cell(c))).join(',')).join('\r\n') + '\r\n';
}

/** A file name's day, and a month's. */
export const planName = (today: string) => `finances-plan-${today}.json`;
export const aheadName = (today: string) => `finances-ahead-${today}.csv`;
export const monthName = (month: string) => `finances-${month}.html`;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * A month on paper: each day with a payday or payment, what it is and its
 * amount, and checking at the day's end; then each paycheck starting in the
 * month, with what came in, went out, was saved, and was left. Amounts are
 * written as the screen writes them, so with Hide amounts on, they print
 * hidden too. month is YYYY-MM.
 */
export function monthPage(v: finance.View, month: string, title: string): string {
  const days = [...(v.days || []), ...(v.later || [])].filter((d) => d.date.startsWith(month) && ((d.events || []).length || (d.charges || []).length));
  const label = new Date(month + '-01T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const day = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const lines = days.map((d) => {
    const shown = (v.days || []).includes(d);
    const items = [...(d.events || []).map((e) => [what(v.plan, e)[0], money(e.amount)]),
      ...(d.charges || []).map((e) => [`${what(v.plan, e)[0]} (on ${accountName(v.plan, e.card)})`, money(e.amount)])];
    return `<tr><th scope="row">${esc(day(d.date))}</th><td>${items.map(([n, a]) => `<div><span>${esc(n)}</span><span class="n">${esc(a)}</span></div>`).join('')}</td><td class="n">${shown ? esc(money(d.balance)) : ''}</td></tr>`;
  }).join('\n');
  const pays = (v.periods || []).filter((p) => p.start.startsWith(month)).map((p) =>
    `<tr><th scope="row">${esc(day(p.start))} – ${esc(day(p.last))}</th><td class="n">${esc(money(p.in))}</td><td class="n">${esc(money(p.out))}</td><td class="n">${esc(money(p.saved))}</td><td class="n">${esc(money(p.left))}</td></tr>`).join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(title)} · ${esc(label)}</title>
<style>
body { font: 13px/1.45 -apple-system, "Segoe UI", system-ui, sans-serif; color: #111; margin: 32px; }
h1 { font-size: 20px; margin: 0 0 2px; } p { color: #555; margin: 0 0 18px; } h2 { font-size: 15px; margin: 26px 0 8px; }
table { width: 100%; border-collapse: collapse; } th, td { text-align: left; vertical-align: top; padding: 6px 8px; border-bottom: 1px solid #ddd; }
th { font-weight: 600; white-space: nowrap; } td div { display: flex; justify-content: space-between; gap: 16px; }
.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; } thead th { color: #555; font-weight: 500; }
@media print { body { margin: 0; } @page { margin: 16mm; } }
</style></head>
<body onload="print()">
<h1>${esc(title)}: ${esc(label)}</h1>
<p>Paydays and payments as planned on ${esc(day(v.today))}, with checking at each day's end.</p>
${days.length ? `<table><thead><tr><th>Day</th><th>What</th><th class="n">Checking after</th></tr></thead><tbody>\n${lines}\n</tbody></table>` : '<p>Nothing is planned this month.</p>'}
${pays ? `<h2>Paychecks</h2><table><thead><tr><th>Paycheck</th><th class="n">In</th><th class="n">Out</th><th class="n">Saved</th><th class="n">Left</th></tr></thead><tbody>\n${pays}\n</tbody></table>` : ''}
</body></html>
`;
}
