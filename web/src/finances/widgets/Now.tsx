// The Dashboard's lead card, Left after this paycheck's bills
// (docs/Redesign.md): checking once the period picked has paid its bills,
// the chart of checking through it (each bill a dot, the cushion dashed),
// and under it the figures the household checks against its own sums:
// checking now, checking once the next paycheck lands, and the bills left.
// Resting on either of the first two, Tab to it, or a tap on a phone shows
// how it was reached, row by row: the balance it starts from, each thing
// in and out, and the result (finance.Working, the projection's own steps,
// so it is always the sum the app did).
import type { ComponentChildren } from 'preact';
import { Amount, MoneyChip } from '../ui/Amount';
import { AreaChart } from '../ui/charts';
import { Widget } from '../ui/Widget';
import { useHoverCard } from '../../parts/Hover';
import { compact, dayLong, dayShort, type Lookup, money, signed, tick } from '../money';

const names = (ids: string[], L: Lookup) => ids.map((id) => L.person[id]?.name || id).join(' and ');

/** What one step was, in the words its row uses elsewhere. */
function stepName(s: finance.Step, L: Lookup): string {
  if (s.people?.length) return `${names(s.people, L)}'s paycheck`;
  if (s.payment) { const x = L.payment[s.payment]; return x ? x.name + (x.payer ? `, from ${x.payer}` : '') : s.payment; }
  if (s.interest) return 'Interest';
  return s.name || 'A transaction';
}

/** The working: where it starts, each step with checking after it, and where it ends. */
function Working({ w, L, start, end, note }: { w: finance.Working; L: Lookup; start: string; end: string; note?: string }) {
  return (
    <span class="fx-working">
      <span class="fx-workrow fx-workhead"><span>{start}</span><Amount value={w.start} form="full" /></span>
      {w.steps.map((s, i) => (
        <span key={i} class="fx-workrow">
          <span><span class="fx-sub">{dayShort(s.date)}</span> {stepName(s, L)}{s.transaction && <span class="fx-sub"> (in Transactions)</span>}</span>
          <Amount value={s.amount} sign tone={s.amount > 0 ? 'in' : ''} form="full" />
          <span class="fx-sub fx-workafter"><Amount value={s.after} form="full" /></span>
        </span>
      ))}
      {!w.steps.length && <span class="fx-workrow fx-sub"><span>Nothing in or out in between</span></span>}
      <span class="fx-workrow fx-workhead fx-workend"><span>{end}</span><Amount value={w.result} form="full" tone={w.result < 0 ? 'out' : ''} /></span>
      {note && <span class="fx-sub fx-worknote">{note}</span>}
    </span>
  );
}

/** One of the figures under the chart: a button, so a tap or Tab shows its working, the card beside it. */
function Figure({ value, caption, tip, id }: { value: number; caption: string; tip: ComponentChildren; id: string }) {
  const { on, card, show } = useHoverCard<HTMLButtonElement>(tip, { wide: true });
  return (
    <div class="fx-clearfig">
      <button type="button" class="fx-clearbtn" id={id} {...on} onClick={() => show(true)}>
        <span class="fx-caption">{caption}</span>
        <span class="fx-figure"><Amount value={value} form="full" tone={value < 0 ? 'out' : ''} /></span>
        <span class="sr">How it adds up</span>
      </button>
      {card}
    </div>
  );
}

/** Each payment out of checking in the period: what the card counts as its bills (not one paid from a card, not money in). */
const billsOf = (p: finance.Period) => p.rows.filter((r) => !r.outside && !r.into);

export interface LeadProps {
  v: finance.View;
  L: Lookup;
  /** The paycheck the period bar picked (0 now, 1 and on ahead); before now or by month, now's. */
  sel: number;
  /** Opens Paychecks, every period ahead. */
  open?: () => void;
}

export function LeadWidget({ v, L, sel, open }: LeadProps) {
  const now = v.checkingNow, pay = v.afterPay;
  const i = Math.max(0, Math.min(sel, v.periods.length - 1));
  const p = v.periods[i];
  if (!now && !p) return null;
  const typedToday = now && now.from === now.date;
  const who = pay && v.periods.find((q) => q.pay?.date === pay.date)?.pay;
  const whose = who ? names(who.people, L) : '';
  // Payments due on payday come out of that paycheck, after it is in.
  const sameDay = pay ? v.periods.find((q) => q.pay?.date === pay.date)?.rows.filter((r) => r.date === pay.date && !r.outside && !r.into).length || 0 : 0;
  const bills = p ? billsOf(p) : [];
  const owed = bills.reduce((t, r) => t + r.amount, 0);
  const cushion = v.plan.cushion || 0;
  const before = i > 0 ? v.periods[i - 1] : undefined;
  const figures = (
    <div class="fx-clearrow">
      {now && <Figure id="finNow" value={now.result} caption="Checking now"
        tip={<Working w={now} L={L} start={`Checking, typed in ${dayLong(now.from)}`} end="Checking now"
          note={typedToday ? 'As typed in today.' : `Typed in ${dayShort(now.from)}, with what has happened since.`} />} />}
      {pay && <Figure id="finAfterPay" value={pay.result} caption={`After payday, ${dayShort(pay.date)}`}
        tip={<Working w={pay} L={L} start="Checking now" end={`Once the paycheck is in, ${dayLong(pay.date)}`}
          note={sameDay ? `${sameDay === 1 ? 'One payment' : `${sameDay} payments`} due ${dayShort(pay.date)} come${sameDay === 1 ? 's' : ''} out of this paycheck after it lands, so ${sameDay === 1 ? 'it is' : 'they are'} not in this number.` : undefined} />} />}
      {p && <div class="fx-clearfig"><div class="fx-cleartile">
        <span class="fx-caption">Bills left · {bills.length}</span>
        <span class="fx-figure"><Amount value={-owed} form="full" tone={owed > 0.005 ? 'out' : ''} /></span>
      </div></div>}
    </div>
  );
  if (!p) return <Widget title="Checking now" span="all" kind="fx-clear fx-lead">{figures}</Widget>;
  // Checking each day of the period, as the plan works it out: a step at each payday and bill.
  const days = (v.days || []).filter((d) => d.date >= p.start && d.date <= p.last);
  const values = days.map((d) => d.balance);
  const marks = days.flatMap((d, k) => (d.events || []).filter((e) => e.people?.length || e.amount < 0).map(() => ({ i: k, tone: (d.events!.some((e) => e.people?.length) ? 'in' : 'out') as 'in' | 'out' })))
    .filter((m, k, all) => all.findIndex((n) => n.i === m.i) === k);
  const step = Math.max(1, Math.round(days.length / 5));
  const xLabels = days.map((d, k) => ({ i: k, label: dayShort(d.date) })).filter((_, k) => k % step === 0);
  const said = (e: finance.Event) => (e.people?.length ? names(e.people, L) + "'s paycheck" : L.payment[e.payment || '']?.name || e.payment || 'A payment');
  return (
    <Widget title="Left after this paycheck's bills" span="all" kind="fx-clear fx-lead" open={open} openLabel="Open Paychecks"
      figure={<Amount value={p.left} tone={p.left < 0 ? 'out' : p.left < cushion ? 'warn' : ''} />}
      label={<>In checking on {dayShort(p.last)}, after {bills.length === 1 ? 'one bill' : `${bills.length} bills`}
        {p.left < 0 ? <span class="fx-out">, short {money(-p.left)}</span> : p.left < cushion ? <span>, under your {compact(cushion)} cushion</span> : ''}</>}
      chip={before && <MoneyChip value={p.left - before.left} words="vs last paycheck" />}>
      {days.length >= 2 && <AreaChart values={values} xLabels={xLabels} marks={marks} height={170} axis={false} zero={false} stepped threshold={cushion || undefined} format={tick}
        label={`Checking each day from ${dayShort(days[0].date)} to ${dayShort(days[days.length - 1].date)}, ${money(values[0])} at the start and ${money(p.left)} at the end${cushion ? `, against your ${compact(cushion)} cushion` : ''}. The figures under it say how they add up.`}
        tip={(k) => <>
          <div class="fx-tiphead"><span>{dayLong(days[k].date)}</span><Amount value={days[k].balance} form="full" /></div>
          {(days[k].events || []).slice(0, 6).map((e, n) => <div key={n} class="fx-tiprow"><span>{said(e)}</span><span class={e.amount > 0 ? 'fx-in' : ''}>{signed(e.amount)}</span></div>)}
          {!(days[k].events || []).length && <div class="fx-sub" style={{ marginTop: '4px' }}>Nothing comes or goes</div>}
        </>} />}
      {!!cushion && days.length >= 2 && <p class="fx-sub fx-leadcushion" aria-hidden="true"><span class="fx-leaddash" />Cushion {compact(cushion)}</p>}
      {figures}
    </Widget>
  );
}
