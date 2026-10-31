// Checking, day by day: the next month (or three) as an area, paydays
// marked in green and big bills in red, the cushion dashed, the lowest day
// called out, and the paycheck picked shaded. Pointing at a day says what
// happened on it.
import { useState } from 'preact/hooks';
import { Segmented } from '../../parts/Segmented';
import { Amount, Stat } from '../ui/Amount';
import { AreaChart } from '../ui/charts';
import { Dot } from '../ui/Legend';
import { Widget } from '../ui/Widget';
import { checkingDays, todayOf } from '../model';
import { compact, dayLong, dayShort, type Lookup, money, signed, tick } from '../money';

/** A bill this big or bigger gets its mark on the line. */
const bigBill = 300;

export function CheckingWidget({ v, L, sel }: { v: finance.View; L: Lookup; sel: number }) {
  const [span, setSpan] = useState('31');
  const days = checkingDays(v, Number(span));
  if (days.length < 2) return null;
  const cushion = v.plan.cushion || 0;
  const values = days.map((d) => d.balance);
  const low = values.indexOf(Math.min(...values));
  // Today is checking now, as the bank shows it; the line's first day is after today's paychecks and bills.
  const now = L.account[v.checking] ? todayOf(v, L.account[v.checking]) : values[0];
  const marks = days.flatMap((d, i) => (d.events || []).filter((e) => e.people || Math.abs(e.amount) >= bigBill).map((e) => ({ i, tone: (e.amount > 0 ? 'in' : 'out') as 'in' | 'out' })));
  const p = v.periods[sel];
  const from = days.findIndex((d) => d.date >= (p?.start || '')), to = days.map((d) => d.date <= (p?.last || '')).lastIndexOf(true);
  const step = Math.max(1, Math.round(days.length / 4.5));
  const xLabels = days.map((d, i) => ({ i, label: dayShort(d.date) })).filter((_, i) => i % step === 0 || i === days.length - 1).filter((l, k, all) => k === all.length - 1 || days.length - 1 - l.i > step / 2);
  const said = (e: finance.Event) => (e.people ? e.people.map((id) => L.person[id]?.name || id).join(' and ') + "'s paycheck" : L.payment[e.payment]?.name || e.payment);
  return (
    <Widget title={span === '31' ? 'Checking, next 30 days' : 'Checking, next 3 months'} span={2} kind="fx-checking"
      actions={<Segmented label="How far ahead" value={span} pick={setSpan} options={[['31', '30 days'], ['93', '3 months']]} />}>
      <Stat value={<Amount value={now} />} caption="Today"
        aside={<div class="fx-right"><Amount value={values[low]} form="full" tone={values[low] < cushion ? 'out' : ''} /><div class="fx-sub">lowest, {dayLong(days[low].date)}{values[low] < cushion ? `, under your ${compact(cushion)} cushion` : ''}</div></div>} />
      <AreaChart values={values} xLabels={xLabels} marks={marks} height={300} threshold={cushion || undefined} format={tick}
        band={from >= 0 && to > from ? { from, to } : undefined}
        label={`Checking each day from ${dayShort(days[0].date)} to ${dayShort(days[days.length - 1].date)}: ${money(now)} today, lowest ${money(values[low])} on ${dayShort(days[low].date)}. The paycheck's payments list every number.`}
        tip={(i) => <>
          <div class="fx-tiphead"><span>{dayLong(days[i].date)}</span><Amount value={days[i].balance} form="full" /></div>
          {(days[i].events || []).slice(0, 6).map((e, k) => <div key={k} class="fx-tiprow"><Dot color={e.amount > 0 ? 'in' : 'out'} /><span>{said(e)}</span><span class={e.amount > 0 ? 'fx-in' : ''}>{signed(e.amount)}</span></div>)}
          {!(days[i].events || []).length && <div class="fx-sub" style={{ marginTop: '4px' }}>Nothing comes or goes</div>}
        </>} />
      <ul class="fx-legend inline" aria-hidden="true">
        <li><Dot color="in" /><span class="fx-legendlabel">Paycheck</span></li>
        <li><Dot color="out" /><span class="fx-legendlabel">Bill of {compact(bigBill)} or more</span></li>
        {!!cushion && <li><Dot color="out" shape="dash" /><span class="fx-legendlabel">{compact(cushion)} cushion</span></li>}
        {from >= 0 && <li><Dot color="accent" shape="square" /><span class="fx-legendlabel">The paycheck picked</span></li>}
      </ul>
    </Widget>
  );
}
