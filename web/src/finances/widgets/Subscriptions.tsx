// Recurring › Subscriptions: what the subscriptions cost a month and a
// year, together and each (dearest first), which renew in the next week
// and month, how many are paid yearly against monthly, and where each
// stands: due today, tomorrow, in a few days, or just paid. A row opens
// its payment's form.
import { Empty } from '../../parts/Empty';
import { Row, Rows } from '../../parts/Row';
import { Amount, Stat } from '../ui/Amount';
import { brandOf, Mark } from '../Mark';
import { dayLong, daysBetween, type Lookup, perMonth, plural, scheduleText, whole } from '../money';

/** Paid this many days ago or fewer, it was just paid. */
const justPaid = 3;

export interface SubscriptionsProps {
  v: finance.View;
  L: Lookup;
  edit?: (what: 'payment', id: string) => void;
}

/** Where a subscription stands today, in words and a tone. */
export function dueOf(v: finance.View, id: string): { text: string; tone: 'warn' | 'in' | 'muted' | ''; days: number } {
  const next = v.next?.[id], last = v.last?.[id];
  const d = next ? daysBetween(v.today, next) : -1;
  if (d === 0) return { text: 'Due today', tone: 'warn', days: 0 };
  if (d === 1) return { text: 'Due tomorrow', tone: 'warn', days: 1 };
  if (last && daysBetween(last, v.today) <= justPaid) return { text: 'Just paid', tone: 'in', days: d };
  if (d > 1 && d <= 30) return { text: `In ${plural(d, 'day')}`, tone: d <= 7 ? 'muted' : '', days: d };
  if (d > 30) return { text: dayLong(next!) + (next!.slice(0, 4) !== v.today.slice(0, 4) ? ', ' + next!.slice(0, 4) : ''), tone: '', days: d };
  return { text: 'Nothing ahead', tone: '', days: -1 };
}

export function SubscriptionsSummary({ v, L, edit }: SubscriptionsProps) {
  const people = v.plan.people || [];
  const subs = (v.plan.payments || []).filter((x) => x.kind === 'subscriptions').map((x) => {
    const month = x.amount * perMonth(x.schedule, people);
    return { x, month, year: month * 12, due: dueOf(v, x.id) };
  }).sort((a, b) => b.year - a.year || a.x.name.localeCompare(b.x.name));
  if (!subs.length) return <Empty>{edit ? 'No subscriptions yet: add one with Add a payment, its category Subscriptions.' : 'No subscriptions yet.'}</Empty>;
  const sum = (list: typeof subs) => list.reduce((t, s) => t + s.year, 0);
  const total = sum(subs);
  const soon = (n: number) => subs.filter((s) => s.due.days >= 0 && s.due.days <= n);
  const yearly = subs.filter((s) => s.x.schedule.every === 'year');
  const week = soon(7), month = soon(30);
  const charge = (list: typeof subs) => list.reduce((t, s) => t + s.x.amount, 0);
  return (
    <div class="fx-subs">
      <div class="fx-stats">
        <Stat value={<Amount value={total / 12} form="whole" />} caption={`A month · ${plural(subs.length, 'subscription')}`} />
        <Stat value={<Amount value={total} form="whole" />} caption="A year" />
        <Stat value={<Amount value={charge(week)} form="whole" tone={week.length ? 'warn' : ''} />} caption={week.length ? `Renewing in 7 days · ${week.length}` : 'Nothing renews in 7 days'} />
        <Stat value={<Amount value={charge(month)} form="whole" />} caption={month.length ? `In 30 days · ${month.length}` : 'Nothing renews in 30 days'} />
      </div>
      {!!yearly.length && <p class="fx-sub fx-subsplit">
        Paid yearly: {plural(yearly.length, 'subscription')}, {whole(sum(yearly))} a year. Paid more often: {subs.length - yearly.length}, {whole(total - sum(yearly))} a year.
      </p>}
      <Rows kind="fx-rows">
        {subs.map(({ x, month, year, due }) => (
          <Row key={x.id} lead={<Mark brand={brandOf(x.institution, x.name)} kind={x.kind} name={x.name} />}
            title={x.name} sub={`${scheduleText(x.schedule, L)} · ${x.schedule.every === 'year' ? `${whole(month)} a month` : `${whole(year)} a year`}`}
            end={<span class={'fx-badge fx-due' + (due.tone ? ' fx-' + due.tone : '')}>{due.text}</span>}
            when={<Amount value={x.amount} form="full" />} whenPlain
            onOpen={edit ? () => edit('payment', x.id) : undefined} openLabel={edit ? 'edit' : undefined} />
        ))}
      </Rows>
    </div>
  );
}
