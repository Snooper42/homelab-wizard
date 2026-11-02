// Finances › Recurring and Pay, laid from the kit. Recurring: a month of
// pay and what it pays, and the payments that repeat, each with its next
// day and the paycheck that covers it, opening its form; the subscriptions
// on their own, with what they cost a month and a year. Pay: each person
// who gets paid (the pay stub when typed in), the paychecks ahead, and
// the bank holidays and currency.
import { useEffect, useState } from 'preact/hooks';
import { Card } from '../parts/Card';
import { Empty } from '../parts/Empty';
import { Row, Rows } from '../parts/Row';
import { Segmented } from '../parts/Segmented';
import { Amount, Stat } from './ui/Amount';
import { type Hue, Legend, type Part, SplitBar } from './ui/Legend';
import { IconButton, Widget } from './ui/Widget';
import { brandOf, kindForBrand, Mark, PayMark, Who } from './Mark';
import { SetAsideWidget } from './widgets/SetAside';
import { HomelabWidget } from './widgets/Homelab';
import { WallosWidget } from './widgets/Wallos';
import { replacedBy, type Running } from './homelab';
import { MoneyFlowWidget } from './widgets/Flow';
import { SubscriptionsSummary } from './widgets/Subscriptions';
import { month, todayOf } from './model';
import { allPayments, currencySign, dayLong, dayShort, daysBetween, type Lookup, money, parseAmount, plural, saving, scheduleText, todayISO, whole } from './money';

export interface ListProps {
  v: finance.View;
  L: Lookup;
  /** Opens the form for one, or a new one; none on a phone allowed only to look. */
  edit?: (what: 'account' | 'person' | 'payment', id?: string) => void;
}

/** Keeps the plan's currency, bank holidays, and rates for the other currencies accounts are kept in; false when it failed. */
export type SaveSettings = (s: { currency: string; holidays: string; rates?: Record<string, number>; quiet?: string[]; calendarKey?: string; calendarAmounts?: boolean }) => Promise<boolean>;

const currencies = ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'NZD', 'CHF', 'SEK', 'NOK', 'DKK', 'JPY', 'MXN', 'INR', 'ZAR'];
/** A new calendar link's key: 24 random bytes as hex, made on this device. */
const newKey = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');

/**
 * The calendar feed: paydays and bills in a phone's calendar, through a
 * link only the household has (over Tailscale or the homelab's own
 * domain, never the home Wi-Fi). Made, copied, with amounts or without,
 * made again (the old link stops working), or turned off.
 */
function CalendarFeed({ v, calendar, busy, set }: { v: finance.View; calendar: () => Promise<string>; busy: boolean; set: (key: string | undefined, amounts: boolean) => void }) {
  const key = v.plan.calendarKey, amounts = !!v.plan.calendarAmounts;
  const [link, setLink] = useState<{ key?: string; url?: string; problem?: string }>({});
  const [said, setSaid] = useState('');
  const [withAmounts, setWithAmounts] = useState(false);
  useEffect(() => {
    if (!key || link.key === key) return;
    calendar().then((url) => setLink({ key, url }), (e) => setLink({ key, problem: String(e?.message || e) }));
  }, [key]);
  const copy = async () => {
    try { if (window.runtime?.ClipboardSetText) await window.runtime.ClipboardSetText(link.url!); else await navigator.clipboard.writeText(link.url!); setSaid('Copied.'); } catch { setSaid('Select the link and copy it.'); }
  };
  return (
    <fieldset class="fincalendar">
      <legend>Calendar feed</legend>
      {!key ? <>
        <p class="fx-sub">Paydays and bills in your phone's calendar, through a link only you have. It works over Tailscale or the homelab's own domain, never over the home Wi-Fi.</p>
        <label class="fcheckbox"><input type="checkbox" checked={withAmounts} onClick={(e) => setWithAmounts((e.currentTarget as HTMLInputElement).checked)} /> With amounts</label>
        <p><button type="button" class="small" disabled={busy} onClick={() => set(newKey(), withAmounts)}>Make a calendar link</button></p>
      </> : <>
        {link.key === key && link.url && <div class="fincalendarlink">
          <input readOnly value={link.url} aria-label="Calendar link" onFocus={(e) => (e.target as HTMLInputElement).select()} />
          <button type="button" class="small" onClick={copy}>Copy</button>
        </div>}
        {link.key === key && link.problem && <span class="formerr bad" role="alert">{link.problem}</span>}
        <p class="fx-sub" role="status">{said || 'Subscribe to it in your phone\'s calendar (on an iPhone: Settings › Calendar › Accounts › Add Account › Other › Add Subscribed Calendar). Anyone with the link sees what it shows.'}</p>
        <label class="fcheckbox"><input type="checkbox" disabled={busy} checked={amounts} onClick={(e) => set(key, (e.currentTarget as HTMLInputElement).checked)} /> With amounts</label>
        <p class="fincalendarbuttons">
          <button type="button" class="small" disabled={busy} onClick={() => { setSaid(''); set(newKey(), amounts); }}>Make a new link (the old one stops working)</button>
          <button type="button" class="small" disabled={busy} onClick={() => { setSaid(''); set(undefined, false); }}>Turn it off</button>
        </p>
      </>}
    </fieldset>
  );
}

/** The reminders Finances sends, as the household reads them (internal/finance's RemindKinds). */
const reminders: [string, string][] = [['due', 'A bill or card due tomorrow'], ['cushion', 'Three days before a paycheck leaves checking under the cushion'], ['renewal', 'A week before a yearly payment renews'], ['balances', 'Each week the balances go without an update']];
const calendars: [string, string][] = [['us', 'US bank holidays'], ['uk', 'UK bank holidays (England and Wales)'], ['none', 'Weekends only']];

/**
 * Pay › Paydays and money: the bank holidays a payday moves before, the
 * currency amounts are in, and, for each other currency an account is kept
 * in, how much of the plan's one of it is (typed in, never looked up),
 * kept as it changes.
 */
function Settings({ v, save, calendar }: { v: finance.View; save: SaveSettings; calendar?: () => Promise<string> }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const currency = v.plan.currency || 'USD', holidays = v.plan.holidays || 'us', rates = v.plan.rates || {};
  const keep = async (s: { currency: string; holidays: string; rates?: Record<string, number>; quiet?: string[]; calendarKey?: string; calendarAmounts?: boolean }) => { setBusy(true); await save({ rates: v.plan.rates, quiet: v.plan.quiet, calendarKey: v.plan.calendarKey, calendarAmounts: v.plan.calendarAmounts, ...s }); setBusy(false); };
  // A reminder on or off: kept at once, as the household's quiet ones.
  const quiet = v.plan.quiet || [];
  const remind = (kind: string) => (e: MouseEvent) => { const on = (e.currentTarget as HTMLInputElement).checked; keep({ currency, holidays, quiet: on ? quiet.filter((k) => k !== kind) : [...quiet, kind] }); };
  // The other currencies the accounts are kept in, each with the accounts in it.
  const others = [...new Set((v.plan.accounts || []).map((a) => a.currency || '').filter((c) => c && c !== currency))].sort();
  const setRate = (code: string, text: string) => {
    const n = parseAmount(text);
    if (!(n > 0)) { setProblem(`Type how many ${currency} one ${code} is.`); return; }
    setProblem('');
    keep({ currency, holidays, rates: { ...rates, [code]: n } });
  };
  return (
    <Widget title="Paydays and money" span="all">
      <div class="finsettings">
        <label class="field">A payday on a weekend or <select disabled={busy} value={holidays} onChange={(e) => keep({ currency, holidays: (e.target as HTMLSelectElement).value })}>{calendars.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select> comes the business day before</label>
        <label class="field">Amounts in <select disabled={busy} value={currency} onChange={(e) => keep({ currency: (e.target as HTMLSelectElement).value, holidays })}>{(currencies.includes(currency) ? currencies : [currency, ...currencies]).map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
      </div>
      {!!others.length && <div class="finrates">
        <p class="fx-sub">Accounts in other currencies count at these rates, typed in by you: Finances never looks a rate up.</p>
        {others.map((code) => (
          <label key={code} class="field finrate">1 {code} is <span class="moneyfield"><span aria-hidden="true">{currencySign()}</span><input inputmode="decimal" disabled={busy} value={rates[code] ?? ''} aria-label={`1 ${code} in ${currency}`} onChange={(e) => setRate(code, (e.target as HTMLInputElement).value)} /></span>
            <small class="muted">{(v.plan.accounts || []).filter((a) => a.currency === code).map((a) => a.name).join(', ')}</small></label>
        ))}
        {problem && <span class="formerr bad" role="alert">{problem}</span>}
      </div>}
      <fieldset class="finreminders">
        <legend>Reminders through the homelab's ntfy</legend>
        {reminders.map(([kind, words]) => <label key={kind} class="fcheckbox"><input type="checkbox" disabled={busy} checked={!quiet.includes(kind)} onClick={remind(kind)} /> {words}</label>)}
      </fieldset>
      {calendar && <CalendarFeed v={v} calendar={calendar} busy={busy} set={(key, amounts) => keep({ currency, holidays, calendarKey: key, calendarAmounts: amounts })} />}
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

/** The filter Recurring opens on next (the Dashboard's See all asks for Subscriptions), then All again. */
let opening = '';
export const openOn = (filter: string) => { opening = filter; };

/** A payment's category from a transaction's (Groceries is Spending, Netflix's Subscriptions is a subscription). */
const kindFromCategory = (cat: string | undefined, cats: finance.Category[] | undefined): string => {
  const c = (cats || []).find((q) => q.name.toLowerCase() === (cat || '').toLowerCase());
  const top = (c?.parent || c?.name || cat || '').toLowerCase();
  return ({ home: 'home', utilities: 'utilities', car: 'car', subscriptions: 'subscriptions', food: 'spending', shopping: 'spending' } as Record<string, string>)[top] || 'other';
};

/**
 * Found in your transactions: payees paid on a rhythm no planned payment
 * covers (View.Found), each with Add to the plan, which keeps it as a
 * payment from its next day; then it is covered, and gone from here.
 */
function FoundWidget({ v, add }: { v: finance.View; add?: (x: finance.Payment) => void }) {
  if (!v.found?.length || !add) return null;
  const every: Record<string, string> = { week: 'weekly', '2 weeks': 'every other week', month: 'monthly', '3 months': 'every 3 months', year: 'yearly' };
  return (
    <Widget title="Found in your transactions" span="all" kind="fx-found">
      <p class="fx-sub fx-lead">Paid on a rhythm, but not in the plan yet.</p>
      <Rows kind="fx-rows">
        {v.found.map((f) => (
          <Row key={f.payee + f.account} lead={<Mark brand={brandOf(f.institution, f.payee)} name={f.payee} />} title={f.payee}
            sub={`${money(f.amount)} ${every[f.every] || f.every} since ${dayShort(f.since)} · ${plural(f.times, 'time')}${f.next ? ` · next about ${dayShort(f.next)}` : ''}`}
            end={<button type="button" class="small" onClick={() => add({ id: '', name: f.payee, amount: f.amount, institution: f.institution,
              kind: kindForBrand(brandOf(f.institution, f.payee)) || kindFromCategory(f.category, v.categories),
              from: f.account === v.checking ? undefined : f.account, schedule: { every: f.every, start: f.next || f.last } })}>Add to the plan</button>} />
        ))}
      </Rows>
    </Widget>
  );
}

export function Recurring({ v, L, edit, keep, running, fromWallos }: ListProps & { keep?: (plan: finance.Plan) => Promise<boolean>; running?: Running[]; fromWallos?: () => Promise<app.AppSubscription[]> }) {
  const [filter, setFilter] = useState(() => { const f = opening || 'all'; opening = ''; return f; });
  const payments = allPayments(v.plan);
  const next = nextOf(v);
  const m = month(v, L);
  const share = (n: number) => (m.in ? `${Math.round((n / m.in) * 100)}% of pay` : '');
  const onCard = (x: finance.Payment) => L.account[x.from || '']?.kind === 'card';
  const list = payments.filter((x) => groups[filter](x.kind)).sort((a, b) => (next[a.id]?.date || '9').localeCompare(next[b.id]?.date || '9'));
  const count = (g: string) => payments.filter((x) => groups[g](x.kind)).length;
  // Paid, as the ledger says: its latest in the last six weeks, and what it came to when that was not what was planned.
  const paidLine = (x: finance.Payment) => {
    const pd = (v.paid || []).filter((q) => q.payment === x.id && daysBetween(q.date, v.today) <= 42).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!pd) return null;
    const off = pd.amount - pd.planned;
    return <span class="fx-kept fx-paidline">Paid {dayShort(pd.date)}{pd.due !== pd.date ? `, for ${dayShort(pd.due)}` : ''}{Math.abs(off) >= 0.005 && <>: {money(pd.amount)}, <span class={off > 0 ? 'fx-out' : 'fx-in'}>{off > 0 ? `${money(off)} more` : `${money(-off)} less`}</span> than planned</>}</span>;
  };
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
        <HomelabWidget v={v} replaced={replacedBy(v.plan, running || [])} keep={keep} />
        <FoundWidget v={v} add={keep && ((x) => { keep({ ...v.plan, payments: [...(v.plan.payments || []), x] }); })} />
        {keep && fromWallos && <WallosWidget v={v} read={fromWallos} keep={keep} />}
        <Widget title="A typical month" span="all" kind="fx-monthsum">
          <div class="fx-stats">
            <Stat value={<Amount value={m.in} form="whole" tone="in" />} caption={`In · ${(v.plan.people || []).length === 1 ? '1 paycheck' : `${(v.plan.people || []).length} paychecks`}`} />
            <Stat value={<Amount value={m.spent} form="whole" tone="out" />} caption={`Spent · ${share(m.spent)}`} />
            <Stat value={<Amount value={m.saved} form="whole" tone="save" />} caption={<>Saved · {share(m.saved)}{!!m.viaPay && <span class="fx-capnote">plus {whole(m.viaPay)} before pay</span>}</>} />
            <Stat value={<Amount value={m.left} form="whole" tone={m.left < 0 ? 'out' : ''} />} caption="Left over" />
          </div>
          <SplitBar label="A typical month's pay" parts={[{ label: 'Spent', value: m.spent, color: 'out' }, { label: 'Saved', value: m.saved, color: 'save' }, { label: 'Left', value: Math.max(0, m.left), color: 'in' }]} />
        </Widget>
        <MoneyFlowWidget v={v} L={L} />
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
                title={x.name} sub={<>{scheduleText(x.schedule, L) + into + (x.card ? ' · the card\'s balance' : x.estimate ? ' · about' : '')}{kept(x, n)}{paidLine(x)}</>}
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

export function Pay({ v, L, edit, saveSettings, keep, calendar }: ListProps & { saveSettings?: SaveSettings; keep?: (plan: finance.Plan) => Promise<boolean>; calendar?: () => Promise<string> }) {
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
        <SetAsideWidget v={v} keep={keep} />
        {saveSettings && <Settings v={v} save={saveSettings} calendar={calendar} />}
      </div>
    </div>
  );
}
