// On a household member's phone: what the household shares with her
// (homelab person share, FinancesShared), to look at, beside her own
// Finances and never mixed into them, as the Homelab app's Household card
// shows it: the bills coming up, the subscriptions, this month's budgets.
import { render } from 'preact';
import { Card } from '../parts/Card';
import { dayShort, moneyIn } from './money';
import type { Shared, SharedPayment } from './privacy';

const often: Record<string, string> = { week: 'Weekly', '2 weeks': 'Every other week', 'twice a month': 'Twice a month', month: 'Monthly', '3 months': 'Every 3 months', year: 'Yearly', paycheck: 'With each paycheck' };

function Pay({ p, end, currency }: { p: SharedPayment; end: string; currency: string }) {
  return <li><span>{p.name}</span><span class="muted">{end}</span><strong>{p.estimate ? '≈ ' : ''}{moneyIn(p.amount, currency)}</strong></li>;
}

function Household({ s }: { s: Shared }) {
  const c = s.currency;
  return <Card kind="fx-household">
    <div class="fx-householdhead"><h2>Household</h2><span class="muted">Shared with you</span></div>
    {!!s.bills?.length && <><h3>Coming up</h3><ul>{s.bills.slice(0, 5).map((b) => <Pay p={b} currency={c} end={b.date ? dayShort(b.date) : ''} />)}</ul></>}
    {!!s.subscriptions?.length && <><h3>Subscriptions</h3><ul>{s.subscriptions.map((b) => <Pay p={b} currency={c} end={often[b.every || ''] || ''} />)}</ul></>}
    {!!s.budgets?.length && <><h3>Budgets this month</h3><ul>{s.budgets.map((b) => (
      <li class="fx-householdbudget">
        <span>{b.category}</span><strong class={b.left < 0 ? 'bad' : ''}>{moneyIn(Math.max(b.left, 0), c).replace(/\.00$/, '')} left</strong>
        <span class="fx-householdbar" aria-hidden="true"><span style={{ width: `${Math.min(100, b.amount > 0 ? (b.spent / b.amount) * 100 : 0)}%` }} /></span>
      </li>))}</ul></>}
  </Card>;
}

/** Draws the household's card, or nothing when nothing is shared (or this isn't a member's phone). */
export function mountShared(el: Element, s: Shared | null | undefined) {
  render(s && (s.bills?.length || s.subscriptions?.length || s.budgets?.length) ? <Household s={s} /> : null, el);
}
