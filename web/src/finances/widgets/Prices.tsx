// A subscription whose charge changed: the last two it was paid (linked
// transactions, View.Paid) came to the same new amount, not the plan's.
// The Dashboard asks once: "Netflix is now $17.99, was $15.49. Update
// the plan?" Update keeps the new amount; Keep the plan's is remembered on
// this device for that amount, so a later change asks again. On a phone
// allowed only to look it only says so.
import { useState } from 'preact/hooks';
import { Row, Rows } from '../../parts/Row';
import { Widget } from '../ui/Widget';
import { PayMark } from '../Mark';
import { dayShort, type Lookup, money } from '../money';

/** A subscription's new price, from the last two it was paid. */
export interface NewPrice { payment: string; was: number; now: number; last: string }

/** Each subscription the last two payments of which came to the same amount, and not the plan's. */
export function newPrices(v: finance.View): NewPrice[] {
  const out: NewPrice[] = [];
  for (const x of v.plan.payments || []) {
    if (x.kind !== 'subscriptions' || x.estimate || x.card || x.payer || !(x.amount > 0)) continue;
    const [a, b] = (v.paid || []).filter((p) => p.payment === x.id).sort((p, q) => q.due.localeCompare(p.due));
    if (a && b && Math.abs(a.amount - b.amount) < 0.005 && Math.abs(a.amount - x.amount) >= 0.005) out.push({ payment: x.id, was: x.amount, now: a.amount, last: a.date });
  }
  return out;
}

const keptKey = (p: NewPrice) => `homelab.finances.keptPrice.${p.payment}.${p.now}`;
const kept = (p: NewPrice) => { try { return localStorage.getItem(keptKey(p)) === '1'; } catch { return false; } };

export function PricesWidget({ v, L, keep }: { v: finance.View; L: Lookup; keep?: (plan: finance.Plan) => Promise<boolean> }) {
  const [busy, setBusy] = useState('');
  const [, redraw] = useState(0);
  const list = newPrices(v).filter((p) => !kept(p) && L.payment[p.payment]);
  if (!list.length) return null;
  const update = async (p: NewPrice) => {
    if (!keep || busy) return;
    setBusy(p.payment);
    await keep({ ...v.plan, payments: (v.plan.payments || []).map((x) => (x.id === p.payment ? { ...x, amount: p.now } : x)) });
    setBusy('');
  };
  const leave = (p: NewPrice) => { try { localStorage.setItem(keptKey(p), '1'); } catch { /* not kept: it asks again next time */ } redraw((n) => n + 1); };
  return (
    <Widget title={list.length === 1 ? 'A price changed' : 'Prices changed'} span="all" kind="fx-prices">
      <Rows kind="fx-rows">
        {list.map((p) => {
          const x = L.payment[p.payment];
          return <Row key={p.payment} lead={<PayMark x={x} />}
            title={`${x.name} is now ${money(p.now)}, was ${money(p.was)}`}
            sub={`Charged ${money(p.now)} on ${dayShort(p.last)} and the time before.${keep ? ' Update the plan?' : ''}`}
            end={keep && <span class="fx-linkbtns">
              <button type="button" class="small" disabled={!!busy} onClick={() => update(p)}>Update to {money(p.now)}</button>
              <button type="button" class="small" disabled={!!busy} onClick={() => leave(p)}>Keep {money(p.was)}</button>
            </span>} />;
        })}
      </Rows>
    </Widget>
  );
}
