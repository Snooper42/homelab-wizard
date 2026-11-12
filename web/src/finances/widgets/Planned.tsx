// What the plan says for days ahead, the Dashboard's card for a month
// picked by month (the rest of this one, or one after it): what comes in
// and goes out, checking at the end of the days, and each paycheck and
// payment in order, a payment opening its form. Read from the plan's days
// (View.days), so it reaches as far as the chart does.
import { useState } from 'preact/hooks';
import { Empty } from '../../parts/Empty';
import { Row, Rows } from '../../parts/Row';
import { Amount, Stat } from '../ui/Amount';
import { Dot } from '../ui/Legend';
import { Widget } from '../ui/Widget';
import { PayMark, Who } from '../Mark';
import { dayLong, dayShort, type Lookup } from '../money';

/** How many rows show before Show all. */
const shown = 6;

export function PlannedWidget({ v, L, title, start, last, edit }: { v: finance.View; L: Lookup; title: string; start: string; last: string; edit?: (what: 'payment', id: string) => void }) {
  const [all, setAll] = useState(false);
  const days = (v.days || []).filter((d) => d.date >= start && d.date <= last);
  const rows = days.flatMap((d) => (d.events || []).map((e) => ({ day: d.date, e })));
  const cameIn = rows.filter((r) => r.e.amount > 0).reduce((t, r) => t + r.e.amount, 0);
  const goesOut = -rows.filter((r) => r.e.amount < 0).reduce((t, r) => t + r.e.amount, 0);
  const end = days.at(-1);
  const cushion = v.plan.cushion || 0;
  const list = all ? rows : rows.slice(0, shown);
  return (
    <Widget title={title} kind="fx-planned" span="all">
      <p class="fx-sub fx-lead fx-dates">{dayShort(start)} – {dayShort(last)}, from the plan</p>
      {rows.length ? <>
        <div class="fx-pastsums">
          <Stat value={<Amount value={cameIn} tone="in" />} caption="Comes in" />
          <Stat value={<Amount value={goesOut} />} caption="Goes out" />
          {end && <Stat value={<Amount value={end.balance} tone={end.balance < 0 ? 'out' : end.balance < cushion ? 'warn' : ''} />} caption={`Checking on ${dayShort(end.date)}`} />}
        </div>
        <Rows kind="fx-rows">
          {list.map(({ day, e }, k) => {
            const x = e.payment ? L.payment[e.payment] : undefined;
            const who = e.people?.map((id) => L.person[id]?.name || id).join(' and ');
            return <Row key={k} lead={e.people?.length ? <Who name={L.person[e.people[0]]?.name} n={L.order[e.people[0]] ?? 0} /> : x ? <PayMark x={x} /> : <Dot color={e.amount > 0 ? 'in' : 'out'} />}
              title={who ? `${who}'s paycheck` : x?.name || e.payment || 'Payment'} sub={dayLong(day)}
              when={<Amount value={e.amount} sign={e.amount > 0} tone={e.amount > 0 ? 'in' : ''} form="full" />} whenPlain
              onOpen={edit && x ? () => edit('payment', x.id) : undefined} openLabel={x && edit ? 'edit' : undefined} />;
          })}
        </Rows>
        {rows.length > shown && <p class="actions fx-more"><button type="button" class="small" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${rows.length}`}</button></p>}
      </> : <Empty>Nothing planned for these days.</Empty>}
    </Widget>
  );
}
