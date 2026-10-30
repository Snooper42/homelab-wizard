// Finances › Recurring, Pay, and Net worth: the payments that repeat, who
// gets paid and the paychecks ahead, and what the household owns and owes.
import { useState } from 'preact/hooks';
import { Card, CardHead } from '../parts/Card';
import { Empty } from '../parts/Empty';
import { Row, Rows } from '../parts/Row';
import { Segmented } from '../parts/Segmented';
import { Tile } from '../status/Tiles';
import { Mark, Who } from './Mark';
import { Money } from './Overview';
import { dayLong, dayShort, type Lookup, money, perMonth, plural, saving, scheduleText } from './money';

export interface ListProps {
  v: finance.View;
  L: Lookup;
  /** Opens the form for one, or a new one; none on a phone allowed only to look. */
  edit?: (what: 'account' | 'person' | 'payment', id?: string) => void;
}

/** Keeps the plan's currency and bank holidays; false when it failed. */
export type SaveSettings = (s: { currency: string; holidays: string }) => Promise<boolean>;

const currencies = ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'NZD', 'CHF', 'SEK', 'NOK', 'DKK', 'JPY', 'MXN', 'INR', 'ZAR'];
const calendars: [string, string][] = [['us', 'US bank holidays'], ['uk', 'UK bank holidays (England and Wales)'], ['none', 'Weekends only']];

/** Pay › Paydays and money: the bank holidays a payday moves before, and the currency amounts are in. */
function Settings({ v, save }: { v: finance.View; save: SaveSettings }) {
  const [busy, setBusy] = useState(false);
  const currency = v.plan.currency || 'USD', holidays = v.plan.holidays || 'us';
  const keep = async (s: { currency: string; holidays: string }) => { setBusy(true); await save(s); setBusy(false); };
  return (
    <Card>
      <CardHead title="Paydays and money" />
      <div class="finsettings">
        <label class="field">A payday on a weekend or <select disabled={busy} value={holidays} onChange={(e) => keep({ currency, holidays: (e.target as HTMLSelectElement).value })}>{calendars.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select> comes the business day before</label>
        <label class="field">Amounts in <select disabled={busy} value={currency} onChange={(e) => keep({ currency: (e.target as HTMLSelectElement).value, holidays })}>{(currencies.includes(currency) ? currencies : [currency, ...currencies]).map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
      </div>
    </Card>
  );
}

const groups: Record<string, (k: string) => boolean> = {
  all: () => true,
  bills: (k) => ['home', 'utilities', 'car', 'loans', 'other', ''].includes(k || ''),
  cards: (k) => k === 'cards',
  subscriptions: (k) => k === 'subscriptions',
  spending: (k) => k === 'spending',
  saving: (k) => k === 'savings',
};

/** Each payment's next date and the paycheck that covers it. */
function nextOf(v: finance.View) {
  const out: Record<string, { date: string; period: finance.Period }> = {};
  for (const p of v.periods) for (const r of p.rows) if (!out[r.payment]) out[r.payment] = { date: r.date, period: p };
  return out;
}

export function Recurring({ v, L, edit }: ListProps) {
  const [filter, setFilter] = useState('all');
  const payments = v.plan.payments || [];
  const next = nextOf(v);
  // A month of pay, and of what it pays: spent, or kept in savings, an
  // investment, or retirement. A bill charged to a card is, through the
  // card's payment (which pays it, with the card's other spending).
  // Payments between other accounts, and money moved into checking, are not.
  const people = v.plan.people || [];
  const inMonth = people.reduce((t, e) => t + e.net * perMonth(e.schedule), 0);
  const kept = (id?: string) => saving(L.account[id || '']?.kind);
  const onCard = (x: finance.Payment) => L.account[x.from || '']?.kind === 'card';
  const fromPay = payments.filter((x) => (!x.from || x.from === v.checking || onCard(x)) && !(x.to && x.to === v.checking));
  const month = (list: finance.Payment[]) => list.reduce((t, x) => t + x.amount * perMonth(x.schedule, people), 0);
  const spentMonth = month(fromPay.filter((x) => !kept(x.to))), savedMonth = month(fromPay.filter((x) => kept(x.to)));
  // A 401(k) and the like, kept before the take-home pay.
  const viaPay = people.reduce((t, e) => t + (e.deductions || []).filter((d) => kept(d.account)).reduce((u, d) => u + d.amount, 0) * perMonth(e.schedule), 0);
  const share = (n: number) => `${Math.round((n / inMonth) * 100)}% of pay`;
  const list = payments.filter((x) => groups[filter](x.kind)).sort((a, b) => (next[a.id]?.date || '9').localeCompare(next[b.id]?.date || '9'));
  const count = (g: string) => payments.filter((x) => groups[g](x.kind)).length;
  return (
    <div class="fin">
      <div class="tiles">
        <Tile label="In, a month" value={<Money n={inMonth} />} sub={plural(people.length, 'paycheck') + ', on average'} />
        <Tile label="Spent, a month" value={<Money n={spentMonth} />} sub={inMonth ? share(spentMonth) : plural(payments.length, 'payment') + ', on average'} />
        <Tile label="Saved, a month" value={<Money n={savedMonth} />} sub={(inMonth ? share(savedMonth) : 'Into savings and investments') + (viaPay ? `, and ${money(viaPay)} from paychecks` : '')} />
        <Tile label="Left, a month" value={<Money n={inMonth - spentMonth - savedMonth} tone={inMonth - spentMonth - savedMonth < 0 ? 'bad' : ''} />} sub={inMonth ? 'After spending and saving' : 'Add who gets paid'} />
      </div>
      <Card>
        <CardHead title="Payments">
          <Segmented label="Show" value={filter} pick={setFilter} options={[['all', `All ${count('all')}`], ['bills', `Bills ${count('bills')}`], ['cards', `Cards ${count('cards')}`], ['subscriptions', `Subscriptions ${count('subscriptions')}`], ['spending', `Spending ${count('spending')}`], ['saving', `Saving ${count('saving')}`]]} />
        </CardHead>
        <Rows kind="finrows">
          {list.map((x) => {
            const n = next[x.id];
            // The paycheck that covers it; money moved into checking needs none.
            const from = n && (x.to && x.to === v.checking ? 'into checking' : onCard(x) ? 'on ' + L.account[x.from].name : n.period.now ? 'current balance' : `${n.period.pay.people.map((id) => L.person[id]?.name).join(' and ')}'s ${dayShort(n.period.pay.date)} check`);
            const into = x.to ? ' → ' + (L.account[x.to]?.name || x.to) : '';
            return <Row key={x.id} lead={<Mark brand={x.institution} kind={x.kind} name={x.name} />}
              title={x.name} sub={scheduleText(x.schedule, L) + into + (x.card ? ' · the card\'s balance' : x.estimate ? ' · estimate' : '')}
              end={<>
                <span class="finnext">{n ? <><span>{dayLong(n.date)}</span><span class="muted">{from}</span></> : <span class="muted">Not in the next year</span>}</span>
                {edit && <button class="small" onClick={() => edit('payment', x.id)} aria-label={`Edit ${x.name}`}>Edit</button>}
              </>}
              when={(x.estimate ? '~' : '') + money(x.card && n?.period ? (n.period.rows.find((r) => r.payment === x.id)?.amount ?? x.amount) : x.amount)} whenPlain />;
          })}
          {!list.length && <li><Empty>{payments.length ? 'None of this kind.' : 'No payments yet: the mortgage, the car, subscriptions, a card\'s balance.'}</Empty></li>}
        </Rows>
        {edit && <p class="actions"><button class="small" onClick={() => edit('payment')}>Add a payment</button></p>}
      </Card>
    </div>
  );
}

export function Pay({ v, L, edit, saveSettings }: ListProps & { saveSettings?: SaveSettings }) {
  const people = v.plan.people || [];
  // Every paycheck ahead, a check into savings too, which says where it goes.
  const paydays = (v.paydays || []).slice(0, 10);
  const into = (id: string) => { const to = L.person[id]?.account; return to && to !== v.checking ? L.account[to]?.name || to : ''; };
  return (
    <div class="fin">
      <div class="fingrid">
        {people.map((e) => {
          const ded = e.deductions || [];
          return (
            <Card key={e.id} kind="finperson">
              <div class="personhead">
                <Who name={e.name} n={L.order[e.id] ?? 0} size="lg" />
                <div class="grow"><h3>{e.name}</h3><div class="muted">{scheduleText(e.schedule)} · into {L.account[e.account || v.checking]?.name || 'checking'}</div></div>
                {edit && <button class="small" onClick={() => edit('person', e.id)}>Edit</button>}
              </div>
              <div class="finfacts">
                {!!e.gross && <div><span class="k">Gross</span><span class="v">{money(e.gross)}</span></div>}
                {!!ded.length && <div><span class="k">Deductions</span><span class="v">−{money(ded.reduce((t, d) => t + d.amount, 0))}</span></div>}
                <div class="net"><span class="k">Take-home</span><span class="v">{money(e.net)}</span></div>
              </div>
              {!!ded.length && <Rows kind="finrows">
                {ded.map((d, i) => <Row key={i} title={d.name} sub={d.account ? 'into ' + (L.account[d.account]?.name || d.account) : ''} end={e.gross ? <span class="bar" aria-hidden="true"><span style={{ width: `${Math.min(100, (d.amount / e.gross) * 400).toFixed(1)}%` }} /></span> : undefined} when={'−' + money(d.amount)} whenPlain />)}
              </Rows>}
            </Card>
          );
        })}
        {edit && <button type="button" class="finadd" onClick={() => edit('person')}><span aria-hidden="true">+</span>Add someone who gets paid</button>}
        {!people.length && !edit && <Card><Empty>No paychecks typed in yet.</Empty></Card>}
      </div>
      {!!paydays.length && <Card>
        <CardHead title="Next paychecks" />
        <Rows kind="finrows">
          {paydays.map((p) => <Row key={p.date} lead={<span class="fwhos">{p.people.map((id) => <Who key={id} name={L.person[id]?.name} n={L.order[id] ?? 0} />)}</span>}
            title={dayLong(p.date)} sub={p.people.map((id) => L.person[id]?.name + (into(id) ? ` (into ${into(id)})` : '')).join(' and ')}
            end={(p.moved || []).map((m) => <span key={m.person} class="fpill info">{m.why.charAt(0).toUpperCase() + m.why.slice(1)}, from {dayShort(m.from)}</span>)}
            when={<span class="ok">+{money(p.total)}</span>} whenPlain />)}
        </Rows>
      </Card>}
      {saveSettings && <Settings v={v} save={saveSettings} />}
    </div>
  );
}
