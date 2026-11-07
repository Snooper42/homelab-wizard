// A bill whose amount changes (an estimate: electric, water) paid at least
// three times in the last six months, as the ledger says (View.Paid), whose
// average is off the plan's by 3% or more: the Dashboard asks "Electric
// has averaged $152 over 6 months. Use that instead of $140?" Use it keeps
// the average; Keep is remembered on this device for that average, so a
// later one asks again. On a phone allowed only to look it only says so.
import { useState } from 'preact/hooks';
import { Row, Rows } from '../../parts/Row';
import { Widget } from '../ui/Widget';
import { PayMark } from '../Mark';
import { daysBetween, type Lookup, money } from '../money';

/** How far back the average reads, how many it needs, and how far off the plan it must be to ask. */
const back = 183, least = 3, off = 0.03;

/** A bill's average, from what it came to the times it was paid. */
export interface Average { payment: string; planned: number; average: number; months: number; times: number }

/** Each estimated bill whose last six months' average is 3% or more off the plan's amount. */
export function averages(v: finance.View): Average[] {
  const out: Average[] = [];
  for (const x of v.plan.payments || []) {
    if (!x.estimate || x.card || x.payer || !(x.amount > 0)) continue;
    const paid = (v.paid || []).filter((p) => p.payment === x.id && daysBetween(p.due, v.today) <= back);
    if (paid.length < least) continue;
    const average = Math.round((paid.reduce((t, p) => t + p.amount, 0) / paid.length) * 100) / 100;
    if (Math.abs(average - x.amount) < x.amount * off) continue;
    const first = paid.reduce((a, p) => (p.due < a ? p.due : a), paid[0].due);
    out.push({ payment: x.id, planned: x.amount, average, months: Math.max(1, Math.round(daysBetween(first, v.today) / 30.4)), times: paid.length });
  }
  return out;
}

const keptKey = (a: Average) => `homelab.finances.keptAverage.${a.payment}.${a.average}`;
const kept = (a: Average) => { try { return localStorage.getItem(keptKey(a)) === '1'; } catch { return false; } };

export function AveragesWidget({ v, L, keep }: { v: finance.View; L: Lookup; keep?: (plan: finance.Plan) => Promise<boolean> }) {
  const [busy, setBusy] = useState('');
  const [, redraw] = useState(0);
  const list = averages(v).filter((a) => !kept(a) && L.payment[a.payment]);
  if (!list.length) return null;
  const use = async (a: Average) => {
    if (!keep || busy) return;
    setBusy(a.payment);
    await keep({ ...v.plan, payments: (v.plan.payments || []).map((x) => (x.id === a.payment ? { ...x, amount: a.average } : x)) });
    setBusy('');
  };
  const leave = (a: Average) => { try { localStorage.setItem(keptKey(a), '1'); } catch { /* not kept: it asks again next time */ } redraw((n) => n + 1); };
  return (
    <Widget title={list.length === 1 ? 'A bill that changes' : 'Bills that change'} span="all" kind="fx-averages">
      <Rows kind="fx-rows">
        {list.map((a) => {
          const x = L.payment[a.payment];
          return <Row key={a.payment} lead={<PayMark x={x} />}
            title={`${x.name} has averaged ${money(a.average)} over ${a.months === 1 ? 'a month' : `${a.months} months`}`}
            sub={`Paid ${a.times} times; the plan says ${money(a.planned)}.${keep ? ` Use ${money(a.average)} instead?` : ''}`}
            end={keep && <span class="fx-linkbtns">
              <button type="button" class="small" disabled={!!busy} onClick={() => use(a)}>Use {money(a.average)}</button>
              <button type="button" class="small" disabled={!!busy} onClick={() => leave(a)}>Keep {money(a.planned)}</button>
            </span>} />;
        })}
      </Rows>
    </Widget>
  );
}
