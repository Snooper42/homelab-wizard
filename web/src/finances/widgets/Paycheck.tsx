// The pay period picked, the dashboard's one card for it: ‹ and › step
// from paycheck to paycheck and Today comes back. Its title says whose
// paycheck and when, with the days it covers. Under it, the accounts side
// by side, each as it stands once the paycheck is in and its bills are
// paid, with the change since the period before; one money goes into in
// that period is lit (the Roth the day its $625 lands). The cards are one
// tile together. Then checking after the bills, and each payment the
// paycheck covers, in order; a row opens its payment's form.
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { Rows, Row } from '../../parts/Row';
import { Empty } from '../../parts/Empty';
import { Amount, Delta, Stat } from '../ui/Amount';
import { IconButton, Widget } from '../ui/Widget';
import { AcctMark, Mark, PayMark, Who } from '../Mark';
import { kindName, todayOf } from '../model';
import { compact, dayLong, dayShort, type Lookup, money, signed } from '../money';

/** How many payments show before Show all. */
const shown = 5;

/** Accounts that stand on their own in the row; the cards go together, and a loan, home, car, or collectible is Net worth's. */
const ownTile = ['checking', 'savings', 'investment', 'retirement'];

const names = (ids: string[], L: Lookup) => ids.map((id) => L.person[id]?.name || id).join(' and ');

/** The period's title: whose paycheck and its day, or now, until the next one. */
export const periodTitle = (p: finance.Period, L: Lookup): string => (p.now ? `Now · until ${dayLong(p.last)}` : `${names(p.pay!.people, L)}'s paycheck · ${dayLong(p.pay!.date)}`);

/** What goes into each account in a period: payments to it, and pay put there (a check into savings, a 401(k) taken from the pay). */
function into(v: finance.View, L: Lookup, p: finance.Period): Record<string, number> {
  const out: Record<string, number> = {};
  const add = (id: string | undefined, n: number) => { if (id && id !== v.checking) out[id] = (out[id] || 0) + n; };
  for (const r of p.rows) add(L.payment[r.payment]?.to, r.amount);
  // Pay that lands in the period: the paycheck that starts it, and any check into savings on its days.
  for (const d of v.paydays || []) {
    if (d.date < p.start || d.date > p.last) continue;
    for (const id of d.people) {
      const e = L.person[id];
      if (!e) continue;
      add(e.account, e.net);
      for (const x of e.deductions || []) add(x.account, x.amount);
    }
  }
  return out;
}

interface Tile { key: string; name: string; lead: ComponentChildren; after: number; was: number; owes: boolean; in: number }

/** The account tiles for a period: each account's balance after it and the period before it (today, for now). */
function tiles(v: finance.View, L: Lookup, i: number): Tile[] {
  const p = v.periods[i], before = v.periods[i - 1];
  const went = into(v, L, p);
  const at = (a: finance.Account, q?: finance.Period) => (q ? q.accounts?.[a.id] ?? todayOf(v, a) : todayOf(v, a));
  const accounts = v.plan.accounts || [];
  const out: Tile[] = accounts.filter((a) => ownTile.includes(a.kind)).map((a) => ({
    key: a.id, name: a.name, lead: <AcctMark a={a} size="sm" />,
    after: at(a, p), was: at(a, before), owes: false, in: went[a.id] || 0,
  }));
  const cards = accounts.filter((a) => a.kind === 'card');
  if (cards.length) {
    const sum = (q?: finance.Period) => cards.reduce((t, a) => t + at(a, q), 0);
    // A card's payment is money into it: what it owes goes down.
    out.push({ key: 'cards', name: cards.length === 1 ? cards[0].name : 'Cards', owes: true, after: sum(p), was: sum(before), in: cards.reduce((t, a) => t + (went[a.id] || 0), 0) + p.rows.filter((r) => cards.some((a) => L.payment[r.payment]?.card === a.id)).reduce((t, r) => t + r.amount, 0),
      lead: cards.length === 1 ? <AcctMark a={cards[0]} size="sm" /> : <Mark kind="card" name="Cards" size="sm" /> });
  }
  return out;
}

export function PaycheckWidget({ v, L, sel, pick, edit }: { v: finance.View; L: Lookup; sel: number; pick: (i: number) => void; edit?: (what: 'payment', id: string) => void }) {
  const [all, setAll] = useState(false);
  const i = Math.min(sel, v.periods.length - 1);
  const p = v.periods[i];
  if (!p) return null;
  const rows = all ? p.rows : p.rows.slice(0, shown);
  const cushion = v.plan.cushion || 0;
  const row = tiles(v, L, i);
  return (
    <Widget title={periodTitle(p, L)} kind="fx-paycheck" span="all"
      actions={<>
        <button type="button" class="small" disabled={i === 0} onClick={() => pick(0)}>Today</button>
        <IconButton icon="prev" label="The pay period before" disabled={i === 0} onClick={() => pick(i - 1)} />
        <IconButton icon="next" label="The pay period after" disabled={i >= v.periods.length - 1} onClick={() => pick(i + 1)} />
      </>}>
      <p class="fx-sub fx-lead fx-dates">{dayShort(p.start)} – {dayShort(p.last)}{p.now ? ', from today' : ''}</p>
      {!!row.length && <ul class="fx-acctrow" aria-label="Each account after this paycheck's bills">
        {row.map((t) => {
          // What is owed reads as a minus, and owing less is the good direction.
          const sign = t.owes ? -1 : 1, d = (t.after - t.was) * sign;
          return (
            <li key={t.key} class={'fx-accttile' + (t.in >= 0.005 ? ' fx-gets' : '')}>
              <span class="fx-acctname">{t.lead}<span>{t.name}</span></span>
              <Amount value={t.after * sign} form="full" />
              <span class="fx-acctnote">
                {Math.abs(d) >= 0.005 ? <span class={d < 0 ? 'fx-out' : 'fx-in'}>{signed(d)}</span> : <span class="fx-sub">No change</span>}
                {t.in >= 0.005 && <span class="fx-gotin">{t.owes ? `${compact(t.in)} paid` : `${compact(t.in)} in`}</span>}
              </span>
            </li>
          );
        })}
      </ul>}
      <Stat value={<Amount value={p.left} tone={p.left < 0 ? 'out' : p.left < cushion ? 'warn' : ''} />}
        caption={<>{p.now ? `Checking on ${dayShort(p.last)}, before the next paycheck` : `Checking on ${dayShort(p.last)}, after its bills`}
          {p.left < 0 ? <span class="fx-out">, short {money(-p.left)}</span> : p.left < cushion ? <span>, under your {compact(cushion)} cushion</span> : ''}</>}
        aside={!p.now && <Delta value={p.in - p.out} />} />
      <Rows kind="fx-rows">
        {!p.now && <Row lead={<Who name={L.person[p.pay!.people[0]]?.name} n={L.order[p.pay!.people[0]] ?? 0} />} title={`${names(p.pay!.people, L)}'s paycheck`} sub={dayLong(p.pay!.date)}
          when={<Amount value={p.pay!.amount} sign tone="in" form="full" />} whenPlain />}
        {rows.map((r, k) => {
          const x = L.payment[r.payment];
          const src = L.account[x?.from];
          const via = r.outside || r.into ? (src?.kind === 'card' ? 'on ' : 'from ') + (src?.name || 'another account') : kindName(x?.kind || 'other');
          return <Row key={k} lead={<PayMark x={x} />}
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
