// The ledger widgets: what the balances are taken to hold (Taken as done,
// each with In or Not yet), on the Dashboard; and every account today and
// after each paycheck ahead (Accounts, paycheck by paycheck), on Net worth.
import { useState } from 'preact/hooks';
import { Empty } from '../../parts/Empty';
import { Row, Rows } from '../../parts/Row';
import { Segmented } from '../../parts/Segmented';
import { Widget } from '../ui/Widget';
import { AcctMark, Mark, PayMark, Who } from '../Mark';
import { todayOf } from '../model';
import { dayLong, dayShort, type Lookup, money, owed, signed } from '../money';

/**
 * What the balances are taken to hold: each paycheck and payment dated the
 * day a balance was typed in, or after it and before today. One the
 * household marks Not yet waits, and comes today.
 */
export function SinceWidget({ v, L, set }: { v: finance.View; L: Lookup; set?: (key: string, waiting: boolean) => Promise<boolean> }) {
  const [busy, setBusy] = useState('');
  const [all, setAll] = useState(false);
  const list = v.since || [];
  const pick = async (s: finance.Past, choice: string) => {
    if ((choice === 'not') === !!s.waiting || busy) return;
    setBusy(s.key);
    await set(s.key, choice === 'not');
    setBusy('');
  };
  const name = (s: finance.Past) => (s.person ? `${L.person[s.person]?.name || s.person}'s paycheck` : L.payment[s.payment]?.name || s.payment);
  const shown = all ? list : list.slice(0, 5);
  return (
    <Widget title="Taken as done" span="all" kind="fx-since">
      <p class="fx-sub fx-lead">Dated on or after the day you typed in the balances, so counted in them.{set && ' Mark any that hasn\'t happened yet: it comes today.'}</p>
      <Rows kind="finrows fx-rows">
        {shown.map((s) => {
          const x = s.payment ? L.payment[s.payment] : undefined;
          return <Row key={s.key} lead={s.person ? <Who name={L.person[s.person]?.name} n={L.order[s.person] ?? 0} /> : <PayMark x={x} />}
            title={name(s)} sub={dayLong(s.date) + (s.waiting ? ' · not yet: it comes today' : s.typed ? ' · the day its balance was typed in' : ' · since the balance was typed in')}
            end={set && <Segmented label={`${name(s)}, ${dayLong(s.date)}`} value={s.waiting ? 'not' : 'in'} pick={(c) => pick(s, c)} options={[['in', 'In'], ['not', 'Not yet']]} />}
            when={<span class={s.in ? "fx-amount fx-in" : "fx-amount"}>{s.in ? "+" : s.outside ? "" : "−"}{money(s.amount)}</span>} whenPlain />;
        })}
      </Rows>
      {list.length > 5 && <p class="actions"><button class="small" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${list.length}`}</button></p>}
    </Widget>
  );
}

/** The accounts in the table: money and cards, not loans or property (Net worth has those). */
const shown = (a: finance.Account) => ['checking', 'savings', 'investment', 'retirement', 'card'].includes(a.kind);

/** How many stretches the table shows: now and the six paychecks after it (the table scrolls sideways for them). */
const postCols = 7;

/**
 * Each account today and post-pay after each paycheck ahead, with what it
 * changed by: what checking, savings, or a Roth IRA will hold once the
 * paycheck is in and its bills are paid, and what a card will owe. Picking
 * a column picks that paycheck. Update balances opens the one panel for
 * them (Edit's BalancesForm).
 */
export function PostPayWidget({ v, L, sel, pick, update }: { v: finance.View; L: Lookup; sel: number; pick: (i: number) => void; update?: () => void }) {
  const accounts = (v.plan.accounts || []).filter(shown);
  const cols = v.periods.slice(0, postCols);
  // Money as a plus, what a card owes as a minus.
  const today = (a: finance.Account) => (owed(a.kind) ? -todayOf(v, a) : todayOf(v, a));
  const at = (a: finance.Account, p: finance.Period) => (owed(a.kind) ? -(p.accounts?.[a.id] ?? 0) : p.accounts?.[a.id] ?? a.balance);
  const total = (f: (a: finance.Account) => number) => accounts.reduce((t, a) => t + f(a), 0);
  const change = (d: number) => Math.abs(d) >= 0.005 && <span class={'delta ' + (d < 0 ? 'bad' : 'ok')}>{signed(d)}</span>;
  const head = (p: finance.Period) => (p.now ? <><span>Until {dayShort(p.last)}</span><small>Now</small></> : <><span>{dayShort(p.pay.date)}</span><small>{p.pay.people.map((id) => L.person[id]?.name || id).join(' and ')}</small></>);
  if (!accounts.length) return null;
  return (
    <Widget span="all" kind="finpost" title={<>Accounts, paycheck by paycheck <span class="fx-sub">after the bills</span></>}
      actions={update && <button type="button" class="small" onClick={update}>Update balances</button>}>
      <div class="finpostscroll">
        <table class="finpost">
          <thead><tr>
            <th scope="col">Account</th>
            <th scope="col" class="today"><span>Today</span><small>{dayShort(v.today)}</small></th>
            {cols.map((p, i) => <th key={p.start} scope="col" class={i === sel ? 'on' : ''}><button type="button" aria-pressed={i === sel} onClick={() => pick(i)}>{head(p)}</button></th>)}
          </tr></thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <th scope="row"><span class="acct"><AcctMark a={a} size="sm" /><span><strong>{a.name}</strong>{(a.kind === 'card' ? (a.pending ? `${money(a.pending)} pending` : '') : a.detail) && <small>{a.kind === 'card' ? `${money(a.pending)} pending` : a.detail}</small>}</span></span></th>
                <td class="today"><span class="num">{money(today(a))}</span></td>
                {cols.map((p, i) => {
                  const was = i ? at(a, cols[i - 1]) : today(a), now = at(a, p);
                  return <td key={p.start} class={i === sel ? 'on' : ''}><span class={'num' + (a.id === v.checking && p.left < (v.plan.cushion || 0) ? (p.left < 0 ? ' bad' : ' warn') : '')}>{money(now)}</span>{change(now - was)}</td>;
                })}
              </tr>
            ))}
          </tbody>
          <tfoot><tr>
            <th scope="row">Total</th>
            <td class="today"><span class="num">{money(total(today))}</span></td>
            {cols.map((p, i) => <td key={p.start} class={i === sel ? 'on' : ''}><span class="num">{money(total((a) => at(a, p)))}</span></td>)}
          </tr></tfoot>
        </table>
      </div>
    </Widget>
  );
}
