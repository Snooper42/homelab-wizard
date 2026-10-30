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
import { dayLong, dayShort, type Lookup, money, owed, perMonth, plural, scheduleText } from './money';

export interface ListProps {
  v: finance.View;
  L: Lookup;
  edit: (what: 'account' | 'person' | 'payment', id?: string) => void;
}

const groups: Record<string, (k: string) => boolean> = {
  all: () => true,
  bills: (k) => ['home', 'utilities', 'car', 'loans', 'other', ''].includes(k || ''),
  cards: (k) => k === 'cards',
  subscriptions: (k) => k === 'subscriptions',
  saving: (k) => k === 'savings' || k === 'spending',
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
  const inMonth = (v.plan.people || []).reduce((t, e) => t + e.net * perMonth(e.schedule), 0);
  const outMonth = payments.reduce((t, x) => t + x.amount * perMonth(x.schedule), 0);
  const list = payments.filter((x) => groups[filter](x.kind)).sort((a, b) => (next[a.id]?.date || '9').localeCompare(next[b.id]?.date || '9'));
  const count = (g: string) => payments.filter((x) => groups[g](x.kind)).length;
  return (
    <div class="fin">
      <div class="tiles">
        <Tile label="In, a month" value={<Money n={inMonth} />} sub={plural((v.plan.people || []).length, 'paycheck') + ', on average'} />
        <Tile label="Out, a month" value={<Money n={outMonth} />} sub={plural(payments.length, 'payment') + ', on average'} />
        <Tile label="Left, a month" value={<Money n={inMonth - outMonth} tone={inMonth - outMonth < 0 ? 'bad' : ''} />} sub={inMonth ? `${Math.round((outMonth / inMonth) * 100)}% of pay goes out` : 'Add who gets paid'} />
      </div>
      <Card>
        <CardHead title="Payments">
          <Segmented label="Show" value={filter} pick={setFilter} options={[['all', `All ${count('all')}`], ['bills', `Bills ${count('bills')}`], ['cards', `Cards ${count('cards')}`], ['subscriptions', `Subscriptions ${count('subscriptions')}`], ['saving', `Saving ${count('saving')}`]]} />
        </CardHead>
        <Rows kind="finrows">
          {list.map((x) => {
            const n = next[x.id];
            const from = n && (n.period.now ? 'current balance' : `${n.period.pay.people.map((id) => L.person[id]?.name).join(' and ')}'s ${dayShort(n.period.pay.date)} check`);
            const into = x.to ? ' → ' + (L.account[x.to]?.name || x.to) : '';
            return <Row key={x.id} lead={<Mark brand={x.institution} kind={x.kind} name={x.name} />}
              title={x.name} sub={scheduleText(x.schedule) + into + (x.card ? ' · the card\'s balance' : x.estimate ? ' · estimate' : '')}
              end={<>
                <span class="finnext">{n ? <><span>{dayLong(n.date)}</span><span class="muted">{from}</span></> : <span class="muted">Not in the next year</span>}</span>
                <button class="small" onClick={() => edit('payment', x.id)} aria-label={`Edit ${x.name}`}>Edit</button>
              </>}
              when={(x.estimate ? '~' : '') + money(x.card && n?.period ? (n.period.rows.find((r) => r.payment === x.id)?.amount ?? x.amount) : x.amount)} whenPlain />;
          })}
          {!list.length && <li><Empty>{payments.length ? 'None of this kind.' : 'No payments yet: the mortgage, the car, subscriptions, a card\'s balance.'}</Empty></li>}
        </Rows>
        <p class="actions"><button class="small" onClick={() => edit('payment')}>Add a payment</button></p>
      </Card>
    </div>
  );
}

export function Pay({ v, L, edit }: ListProps) {
  const people = v.plan.people || [];
  const paydays = v.periods.filter((p) => p.pay).slice(0, 10);
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
                <button class="small" onClick={() => edit('person', e.id)}>Edit</button>
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
        <button type="button" class="finadd" onClick={() => edit('person')}><span aria-hidden="true">+</span>Add someone who gets paid</button>
      </div>
      {!!paydays.length && <Card>
        <CardHead title="Next paychecks" />
        <Rows kind="finrows">
          {paydays.map((p) => <Row key={p.start} lead={<span class="whos">{p.pay.people.map((id) => <Who key={id} name={L.person[id]?.name} n={L.order[id] ?? 0} />)}</span>}
            title={dayLong(p.pay.date)} sub={p.pay.people.map((id) => L.person[id]?.name).join(' and ')}
            end={(p.pay.moved || []).map((m) => <span key={m.person} class="pill info">{m.why === 'weekend' ? 'Weekend' : m.why}, from {dayShort(m.from)}</span>)}
            when={<span class="ok">+{money(p.in)}</span>} whenPlain />)}
        </Rows>
      </Card>}
    </div>
  );
}

const assetGroups: [string, string[]][] = [['Cash', ['checking', 'savings']], ['Investments', ['investment', 'retirement']], ['Other', ['other']]];

export function NetWorth({ v, L, edit }: ListProps) {
  const accounts = v.plan.accounts || [];
  const worth = (a: finance.Account) => (owed(a.kind) ? 0 : a.balance);
  const debt = (a: finance.Account) => (owed(a.kind) ? a.balance + (a.pending || 0) : 0);
  const assets = accounts.reduce((t, a) => t + worth(a), 0), owes = accounts.reduce((t, a) => t + debt(a), 0);
  const property = accounts.filter((a) => a.kind === 'home' || a.kind === 'car');
  const debts = accounts.filter((a) => owed(a.kind));
  const share = assets > 0 ? Math.max(0, (assets - owes) / assets) : 0;
  const row = (a: finance.Account) => <Row key={a.id} lead={<Mark brand={a.institution} kind={a.kind} name={a.name} />} title={a.name}
    sub={[a.detail, a.rate ? `${a.rate}% a year` : '', a.updated ? 'Updated ' + dayShort(a.updated) : ''].filter(Boolean).join(' · ')}
    end={<button class="small" onClick={() => edit('account', a.id)} aria-label={`Edit ${a.name}`}>Edit</button>} when={money(a.balance)} whenPlain />;
  return (
    <div class="fin">
      <Card kind="finworth">
        <div><div class="label">Net worth</div><div class="big"><Money n={assets - owes} tone={assets - owes < 0 ? 'bad' : ''} /></div></div>
        <div class="grow">
          <div class="spread"><span><span class="muted">Assets</span> <strong>{money(assets)}</strong></span><span><span class="muted">Liabilities</span> <strong>{money(owes)}</strong></span></div>
          <div class="worthbar" aria-hidden="true"><span style={{ width: `${(share * 100).toFixed(1)}%` }} /></div>
          <div class="spread muted"><span>{Math.round(share * 100)}% owned</span><span>{assets ? Math.round((owes / assets) * 100) : 0}% owed</span></div>
        </div>
      </Card>
      <div class="fingrid">
        {property.map((a) => {
          const loan = a.loan ? L.account[a.loan] : undefined;
          const debtOn = loan ? loan.balance : 0;
          const eq = a.balance - debtOn;
          const pct = a.balance > 0 ? Math.max(0, Math.min(1, eq / a.balance)) : 0;
          return (
            <Card key={a.id} kind="finperson">
              <div class="personhead">
                <Mark brand={a.institution} kind={a.kind} name={a.name} size="lg" />
                <div class="grow"><h3>{a.name}</h3><div class="muted">{a.detail || (a.kind === 'home' ? 'Home' : 'Car')}</div></div>
                <button class="small" onClick={() => edit('account', a.id)}>Edit</button>
              </div>
              <div class="label">Equity</div>
              <div class="mid"><Money n={eq} tone={eq < 0 ? 'bad' : ''} /></div>
              <div class="worthbar eq" aria-hidden="true"><span style={{ width: `${(pct * 100).toFixed(1)}%` }} /></div>
              <Rows kind="finrows">
                <Row title="Value" sub={a.updated ? 'Updated ' + dayShort(a.updated) : ''} when={money(a.balance)} whenPlain />
                {loan && <Row lead={<Mark brand={loan.institution} kind="loan" name={loan.name} size="sm" />} title={loan.name} when={'−' + money(debtOn)} whenPlain />}
              </Rows>
            </Card>
          );
        })}
        <button type="button" class="finadd" onClick={() => edit('account')}><span aria-hidden="true">+</span>Add a home, a car, or an account</button>
      </div>
      <div class="fincols">
        <Card>
          <CardHead title="Accounts" />
          {assetGroups.map(([name, kinds]) => {
            const list = accounts.filter((a) => kinds.includes(a.kind));
            if (!list.length) return null;
            return <div key={name} class="fingroup"><div class="grouptitle"><span>{name}</span><span class="num">{money(list.reduce((t, a) => t + a.balance, 0))}</span></div><Rows kind="finrows">{list.map(row)}</Rows></div>;
          })}
          {!accounts.some((a) => assetGroups.some(([, k]) => k.includes(a.kind))) && <Empty>No accounts yet.</Empty>}
        </Card>
        <Card>
          <CardHead title="Liabilities" />
          <Rows kind="finrows">
            {debts.map((a) => {
              const paid = a.original ? Math.max(0, Math.min(1, (a.original - a.balance) / a.original)) : -1;
              return <Row key={a.id} lead={<Mark brand={a.institution} kind={a.kind} name={a.name} />} title={a.name}
                sub={a.kind === 'card' ? (a.pending ? `${money(a.pending)} pending` : 'Card') : paid >= 0 ? `${Math.round(paid * 100)}% of ${money(a.original)} paid` : a.detail}
                end={<>{paid >= 0 && <span class="bar" aria-hidden="true"><span style={{ width: `${(paid * 100).toFixed(1)}%` }} /></span>}<button class="small" onClick={() => edit('account', a.id)} aria-label={`Edit ${a.name}`}>Edit</button></>}
                when={'−' + money(debt(a))} whenPlain />;
            })}
            {!debts.length && <li><Empty>Nothing owed.</Empty></li>}
          </Rows>
        </Card>
      </div>
    </div>
  );
}
