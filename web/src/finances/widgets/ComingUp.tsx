// Coming up: the bills of the next two weeks, day by day, for the phone,
// where the calendar's month is too much to read on the way out the door.
// Each says its day and how soon, and a bill charged to a card says which
// card (no checking money moves). Money put by (savings) is not a bill, so
// it is left out; a card's payoff is in, as it leaves checking. It reads
// only what the calendar does: View.Days, then View.Later past them.
import { Empty } from '../../parts/Empty';
import { Row, Rows } from '../../parts/Row';
import { Amount, Stat } from '../ui/Amount';
import { Widget } from '../ui/Widget';
import { onCard } from '../Calendar';
import { PayMark } from '../Mark';
import { dayLong, daysBetween, type Lookup, plural, saving } from '../money';

/** How many days ahead it reads, today included. */
export const comingDays = 14;

/** A bill on its day: money out of checking, or a charge to a card. */
export interface Bill {
  date: string;
  e: finance.Event;
  /** Charged to a card: no checking money moves that day. */
  charge: boolean;
}

/** The bills from today to comingDays on, in order (a day's checking bills before its card charges, each the larger first). */
export function billsAhead(v: finance.View, L: Lookup): Bill[] {
  const out: Bill[] = [];
  const seen = new Set<string>();
  for (const d of [...(v.days || []), ...(v.later || [])]) {
    const n = daysBetween(v.today, d.date);
    if (n < 0 || n >= comingDays || seen.has(d.date)) continue;
    seen.add(d.date);
    const bill = (e: finance.Event) => !!e.payment && !e.people?.length && !saving(L.payment[e.payment]?.kind);
    const day = [
      ...(d.events || []).filter((e) => bill(e) && e.amount < 0).sort((a, b) => a.amount - b.amount).map((e) => ({ date: d.date, e, charge: false })),
      ...(d.charges || []).filter(bill).sort((a, b) => a.amount - b.amount).map((e) => ({ date: d.date, e, charge: true })),
    ];
    out.push(...day);
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** How soon, in words: "Today", "Tomorrow", "In 5 days". */
export const soon = (today: string, day: string): string => {
  const n = daysBetween(today, day);
  return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${plural(n, 'day')}`;
};

export function ComingUpWidget({ v, L, calendar }: { v: finance.View; L: Lookup; calendar?: () => void }) {
  const bills = billsAhead(v, L);
  // What leaves checking: a card's charge is paid later, with the card.
  const out = bills.filter((b) => !b.charge).reduce((t, b) => t - b.e.amount, 0);
  const charged = bills.filter((b) => b.charge).length;
  return (
    <Widget title="Coming up" kind="fx-comingup" actions={calendar && <button type="button" class="small" onClick={calendar}>Calendar</button>}>
      {bills.length ? <>
        <Stat value={<Amount value={out} form="full" />} caption={`Out of checking in the next ${comingDays} days` + (charged ? ` · ${plural(charged, 'charge')} on cards` : '')} />
        <Rows kind="fx-rows">
          {bills.map((b, i) => {
            const x = L.payment[b.e.payment || ''];
            // Today and tomorrow in amber: the ones to have the money for now.
            const near = daysBetween(v.today, b.date) <= 1;
            return <Row key={b.date + i} lead={<PayMark x={x} />} title={x?.name || b.e.payment}
              sub={`${soon(v.today, b.date)}, ${dayLong(b.date)}` + (b.charge ? ` · ${onCard(b.e, L)}` : '')} subTone={near ? 'warn' : ''}
              when={<Amount value={-b.e.amount} form="full" tone={b.charge ? 'muted' : ''} />} whenPlain />;
          })}
        </Rows>
      </> : <Empty>Nothing due in the next {comingDays} days.</Empty>}
    </Widget>
  );
}
