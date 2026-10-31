// The paycheck picked: checking once it is in and its bills are paid, the
// lowest it gets, and each payment it covers, in order. A row opens its
// payment's form. Until the next paycheck it is "Coming up", from today.
import { useState } from 'preact/hooks';
import { Rows, Row } from '../../parts/Row';
import { Empty } from '../../parts/Empty';
import { Amount, Delta, Stat } from '../ui/Amount';
import { Widget } from '../ui/Widget';
import { brandOf, Mark, Who } from '../Mark';
import { kindName } from '../model';
import { compact, dayLong, dayShort, type Lookup, money } from '../money';

/** How many payments show before Show all. */
const shown = 5;

const names = (ids: string[], L: Lookup) => ids.map((id) => L.person[id]?.name || id).join(' and ');

export function PaycheckWidget({ v, L, sel, edit }: { v: finance.View; L: Lookup; sel: number; edit?: (what: 'payment', id: string) => void }) {
  const [all, setAll] = useState(false);
  const p = v.periods[Math.min(sel, v.periods.length - 1)];
  if (!p) return null;
  const rows = all ? p.rows : p.rows.slice(0, shown);
  const cushion = v.plan.cushion || 0;
  const title = p.now ? 'Coming up' : `${names(p.pay.people, L)} · ${dayLong(p.pay.date)}`;
  return (
    <Widget title={title} kind="fx-paycheck">
      <Stat value={<Amount value={p.left} tone={p.left < 0 ? 'out' : p.left < cushion ? 'warn' : ''} />}
        caption={<>{p.now ? `Checking on ${dayShort(p.last)}, before the next paycheck` : `Checking on ${dayShort(p.last)}, after its bills`}
          {p.left < 0 ? <span class="fx-out">, short {money(-p.left)}</span> : p.left < cushion ? <span>, under your {compact(cushion)} cushion</span> : ''}</>}
        aside={!p.now && <Delta value={p.in - p.out} />} />
      <Rows kind="fx-rows">
        {!p.now && <Row lead={<Who name={L.person[p.pay.people[0]]?.name} n={L.order[p.pay.people[0]] ?? 0} />} title={`${names(p.pay.people, L)}'s paycheck`} sub={dayLong(p.pay.date)}
          when={<Amount value={p.pay.amount} sign tone="in" form="full" />} whenPlain />}
        {rows.map((r, i) => {
          const x = L.payment[r.payment];
          const src = L.account[x?.from];
          const via = r.outside || r.into ? (src?.kind === 'card' ? 'on ' : 'from ') + (src?.name || 'another account') : kindName(x?.kind || 'other');
          return <Row key={i} lead={<Mark brand={brandOf(x?.institution, x?.name)} kind={x?.kind} name={x?.name} />}
            title={<>{x?.name || r.payment}{r.estimate && <span class="fx-sub"> (about)</span>}</>} sub={`${dayShort(r.date)} · ${via}`}
            when={<Amount value={r.into ? r.amount : -r.amount} sign={r.into} tone={r.into ? 'in' : ''} form="full" />} whenPlain
            onOpen={edit && x ? () => edit('payment', x.id) : undefined} openLabel={x ? 'edit' : undefined} />;
        })}
        {!p.rows.length && <li><Empty>Nothing to pay before the next paycheck.</Empty></li>}
      </Rows>
      {p.rows.length > shown && <p class="actions fx-more"><button type="button" class="small" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${p.rows.length} payments`}</button></p>}
    </Widget>
  );
}
