// Coming up: the bills of the next two weeks, day by day, for the phone,
// where the calendar's month is too much to read on the way out the door.
// Each says its day and how soon, and a bill charged to a card says which
// card (no checking money moves). Money put by (savings) is not a bill, so
// it is left out; a card's payoff is in, as it leaves checking. It reads
// only what the calendar does: View.Days, then View.Later past them. A
// paycheck in the two weeks is a line of its own among them, before its
// day's bills, so what is due before payday shows, with its total.
import { Empty } from '../../parts/Empty';
import { Row, Rows } from '../../parts/Row';
import { Fragment } from 'preact';
import { Amount, Stat } from '../ui/Amount';
import { Widget } from '../ui/Widget';
import { onCard } from '../Calendar';
import { PayMark, Who } from '../Mark';
import { dayLong, dayShort, daysBetween, type Lookup, money, plural, saving } from '../money';

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
  // The paychecks of the two weeks, each drawn before the first bill on or after its day.
  const pays = (v.paydays || []).filter((p) => { const n = daysBetween(v.today, p.date); return n >= 0 && n < comingDays; });
  const who = (p: finance.Payday) => p.people.map((id) => L.person[id]?.name || id).join(' and ');
  const first = pays[0];
  const before = first ? bills.filter((b) => !b.charge && b.date < first.date).reduce((t, b) => t - b.e.amount, 0) : 0;
  const payLine = (p: finance.Payday) => <Row key={'pay' + p.date} lead={<span class="fwhos">{p.people.map((id) => <Who key={id} name={L.person[id]?.name} n={L.order[id] ?? 0} />)}</span>}
    title={`${who(p)}'s paycheck`} sub={`${soon(v.today, p.date)}, ${dayLong(p.date)}`}
    when={<Amount value={p.total} sign tone="in" form="full" />} whenPlain />;
  return (
    <Widget title="Coming up" kind="fx-comingup" actions={calendar && <button type="button" class="small" onClick={() => calendar()}>Calendar</button>}>
      {bills.length ? <>
        <Stat value={<Amount value={out} form="full" />} caption={`Out of checking in the next ${comingDays} days` + (charged ? ` · ${plural(charged, 'charge')} on cards` : '')} />
        {first && <p class="fx-sub fx-beforepay">{before > 0.005 ? `${money(before)} of it before ${who(first)}'s paycheck on ${dayShort(first.date)}` : `None of it before ${who(first)}'s paycheck on ${dayShort(first.date)}`}</p>}
        <Rows kind="fx-rows fx-comingrows">
          {bills.map((b, i) => {
            const x = L.payment[b.e.payment || ''];
            // Today and tomorrow in amber: the ones to have the money for now.
            const near = daysBetween(v.today, b.date) <= 1;
            // A paycheck comes before the first bill on or after its day.
            const landing = pays.filter((p) => p.date <= b.date && (i === 0 || bills[i - 1].date < p.date));
            return <Fragment key={b.date + i}>{landing.map(payLine)}<Row lead={<PayMark x={x} />} title={x?.name || b.e.payment}
              sub={`${soon(v.today, b.date)}, ${dayLong(b.date)}` + (b.charge ? ` · ${onCard(b.e, L)}` : '')} subTone={near ? 'warn' : ''}
              when={<Amount value={-b.e.amount} form="full" tone={b.charge ? 'muted' : ''} />} whenPlain /></Fragment>;
          })}
          {pays.filter((p) => !bills.length || p.date > bills[bills.length - 1].date).map(payLine)}
        </Rows>
      </> : <Empty>Nothing due in the next {comingDays} days.</Empty>}
    </Widget>
  );
}
