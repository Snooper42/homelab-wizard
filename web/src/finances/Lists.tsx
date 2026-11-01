// Finances › Recurring and Pay, laid from the kit. Recurring: a month of
// pay and what it pays, and the payments that repeat, each with its next
// day and the paycheck that covers it, opening its form; the subscriptions
// on their own, with what they cost a month and a year. Pay: each person
// who gets paid (the pay stub when typed in), the paychecks ahead, and
// the bank holidays and currency.
import { useState } from 'preact/hooks';
import { Card } from '../parts/Card';
import { Empty } from '../parts/Empty';
import { Row, Rows } from '../parts/Row';
import { Segmented } from '../parts/Segmented';
import { Amount, Stat } from './ui/Amount';
import { type Hue, Legend, type Part, SplitBar } from './ui/Legend';
import { IconButton, Widget } from './ui/Widget';
import { PayMark, Who } from './Mark';
import { SubscriptionsSummary } from './widgets/Subscriptions';
import { month, todayOf } from './model';
import { allPayments, dayLong, dayShort, daysBetween, type Lookup, money, plural, saving, scheduleText, todayISO, whole } from './money';

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
    <Widget title="Paydays and money" span="all">
      <div class="finsettings">
        <label class="field">A payday on a weekend or <select disabled={busy} value={holidays} onChange={(e) => keep({ currency, holidays: (e.target as HTMLSelectElement).value })}>{calendars.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select> comes the business day before</label>
        <label class="field">Amounts in <select disabled={busy} value={currency} onChange={(e) => keep({ currency: (e.target as HTMLSelectElement).value, holidays })}>{(currencies.includes(currency) ? currencies : [currency, ...currencies]).map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
      </div>
    </Widget>
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

/** How far off a day past the paychecks read ahead is: "in 11 months", "in 3 weeks". */
function after(day: string, today = todayISO()): string {
  const d = daysBetween(today, day);
  const months = Math.round(d / 30.4);
  return months >= 2 ? `in ${months} months` : d >= 14 ? `in ${Math.round(d / 7)} weeks` : `in ${plural(d, 'day')}`;
}

/** Each payment's next date and the paycheck that covers it. */
function nextOf(v: finance.View) {
  const out: Record<string, { date: string; period: finance.Period }> = {};
  for (const p of v.periods) for (const r of p.rows) if (!out[r.payment]) out[r.payment] = { date: r.date, period: p };
  return out;
}

export function Recurring({ v, L, edit }: ListProps) {
  const [filter, setFilter] = useState('all');
  const payments = allPayments(v.plan);
  const next = nextOf(v);
  const m = month(v, L);
  const share = (n: number) => (m.in ? `${Math.round((n / m.in) * 100)}% of pay` : '');
  const onCard = (x: finance.Payment) => L.account[x.from || '']?.kind === 'card';
  const list = payments.filter((x) => groups[filter](x.kind)).sort((a, b) => (next[a.id]?.date || '9').localeCompare(next[b.id]?.date || '9'));
  const count = (g: string) => payments.filter((x) => groups[g](x.kind)).length;
  // Money put by: the account it goes into, today and once the paycheck that pays it next is in.
  const kept = (x: finance.Payment, n?: { date: string; period: finance.Period }) => {
    const a = L.account[x.to || ''];
    if (!a || !saving(a.kind)) return null;
    const after = n?.period.accounts?.[a.id];
    return <span class="fx-kept">{a.name}: {money(todayOf(v, a))} today{after !== undefined && <>, {money(after)} after {dayShort(n!.period.last)}</>}</span>;
  };
  return (
    <div class="fin">
      <div class="fx-board">
        <Widget title="A typical month" span="all" kind="fx-monthsum">
          <div class="fx-stats">
            <Stat value={<Amount value={m.in} form="whole" tone="in" />} caption={`In · ${(v.plan.people || []).length === 1 ? '1 paycheck' : `${(v.plan.people || []).length} paychecks`}`} />
            <Stat value={<Amount value={m.spent} form="whole" tone="out" />} caption={`Spent · ${share(m.spent)}`} />
            <Stat value={<Amount value={m.saved} form="whole" tone="save" />} caption={<>Saved · {share(m.saved)}{!!m.viaPay && <span class="fx-capnote">plus {whole(m.viaPay)} before pay</span>}</>} />
            <Stat value={<Amount value={m.left} form="whole" tone={m.left < 0 ? 'out' : ''} />} caption="Left over" />
          </div>
          <SplitBar label="A typical month's pay" parts={[{ label: 'Spent', value: m.spent, color: 'out' }, { label: 'Saved', value: m.saved, color: 'save' }, { label: 'Left', value: Math.max(0, m.left), color: 'in' }]} />
        </Widget>
        <Widget title="Payments" span="all" kind="fx-payments"
          actions={<Segmented label="Show" value={filter} pick={setFilter} options={[['all', `All ${count('all')}`], ['bills', `Bills ${count('bills')}`], ['cards', `Cards ${count('cards')}`], ['subscriptions', `Subscriptions ${count('subscriptions')}`], ['spending', `Spending ${count('spending')}`], ['saving', `Saving ${count('saving')}`]]} />}>
          {filter === 'subscriptions' ? <SubscriptionsSummary v={v} L={L} edit={edit ? (w, id) => edit(w, id) : undefined} /> : <Rows kind="fx-rows">
            {list.map((x) => {
              const n = next[x.id];
              // Past the paychecks read ahead (a yearly one that just came): its own next day.
              const later = n ? '' : v.next?.[x.id] || '';
              // The paycheck that covers it; money moved into checking needs none.
              const from = n && (x.to && x.to === v.checking ? 'into checking' : onCard(x) ? 'on ' + L.account[x.from].name : n.period.now ? 'from the current balance' : `${n.period.pay.people.map((id) => L.person[id]?.name).join(' and ')}'s ${dayShort(n.period.pay.date)} check`);
              const into = x.to ? ' → ' + (L.account[x.to]?.name || x.to) : '';
              return <Row key={x.id} lead={<PayMark x={x} />}
                title={x.name} sub={<>{scheduleText(x.schedule, L) + into + (x.card ? ' · the card\'s balance' : x.estimate ? ' · about' : '')}{kept(x, n)}</>}
                end={<span class="fx-next">{n ? <><span>{dayLong(n.date)}</span><span class="fx-sub">{from}</span></> : later ? <><span>{dayLong(later)}{later.slice(0, 4) !== v.today.slice(0, 4) ? ', ' + later.slice(0, 4) : ''}</span><span class="fx-sub">{after(later, v.today)}</span></> : <span class="fx-sub">Nothing ahead</span>}</span>}
                when={<Amount value={x.card && n?.period ? (n.period.rows.find((r) => r.payment === x.id)?.amount ?? x.amount) : x.amount} form="full" />} whenPlain
                onOpen={edit ? () => edit('payment', x.id) : undefined} openLabel="edit" />;
            })}
            {!list.length && <li><Empty>{payments.length ? 'None of this kind.' : 'No payments yet: the mortgage, the car, subscriptions, a card\'s balance.'}</Empty></li>}
          </Rows>}
        </Widget>
      </div>
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
      <div class="fx-board">
        {people.map((e) => {
          const ded = e.deductions || [];
          const taken = ded.reduce((t, d) => t + d.amount, 0);
          return (
            <Widget key={e.id} kind="fx-person" title={<span class="fx-who"><Who name={e.name} n={L.order[e.id] ?? 0} size="lg" /><span>{e.name}<span class="fx-sub">{scheduleText(e.schedule)} · into {L.account[e.account || v.checking]?.name || 'checking'}</span></span></span>}
              actions={edit && <IconButton icon="edit" label={`Edit ${e.name}'s pay`} onClick={() => edit('person', e.id)} />}>
              <Stat value={<Amount value={e.net} />} caption="Take-home, each paycheck" />
              {!!e.gross && (() => {
                const parts: Part[] = [{ label: 'Take-home', value: e.net, color: 'in' }, ...ded.map((d) => ({ label: d.name, value: d.amount, color: (d.account ? 'save' : 'track') as Hue })), ...(e.gross - e.net - taken > 0.5 ? [{ label: 'Taxes and the rest', value: e.gross - e.net - taken, color: 'muted' as Hue }] : [])];
                return <><SplitBar size="sm" label={`${e.name}'s pay`} parts={parts} /><Legend layout="inline" items={parts.map((p) => ({ label: p.label, color: p.color }))} /></>;
              })()}
              {(!!e.gross || !!ded.length) && <Rows kind="fx-rows">
                {!!e.gross && <Row title="Gross" when={<Amount value={e.gross} form="full" />} whenPlain />}
                {ded.map((d, i) => <Row key={i} title={d.name} sub={d.account ? 'into ' + (L.account[d.account]?.name || d.account) : ''} when={<Amount value={-d.amount} form="full" />} whenPlain />)}
              </Rows>}
            </Widget>
          );
        })}
        {edit && <button type="button" class="finadd" onClick={() => edit('person')}><span aria-hidden="true">+</span>Add someone who gets paid</button>}
        {!people.length && !edit && <Card><Empty>No paychecks typed in yet.</Empty></Card>}
        {!!paydays.length && <Widget title="Next paychecks" span="all" kind="fx-paydays">
          <Rows kind="fx-rows">
            {paydays.map((p) => <Row key={p.date} lead={<span class="fwhos">{p.people.map((id) => <Who key={id} name={L.person[id]?.name} n={L.order[id] ?? 0} />)}</span>}
              title={dayLong(p.date)} sub={p.people.map((id) => L.person[id]?.name + (into(id) ? ` (into ${into(id)})` : '')).join(' and ')}
              end={(p.moved || []).map((mv) => <span key={mv.person} class="fx-badge fx-muted">{mv.why.charAt(0).toUpperCase() + mv.why.slice(1)}, from {dayShort(mv.from)}</span>)}
              when={<Amount value={p.total} sign tone="in" form="full" />} whenPlain />)}
          </Rows>
        </Widget>}
        {saveSettings && <Settings v={v} save={saveSettings} />}
      </div>
    </div>
  );
}
