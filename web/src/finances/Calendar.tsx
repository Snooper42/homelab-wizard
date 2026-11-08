// Finances › Calendar: the money month by month. Each day shows who is
// paid (in their colour), each payment's mark, a bank holiday, and checking
// at the end of the day, marked when it falls under the cushion. Picking a
// day says what moves on it and what checking holds after. Narrow (a
// phone), the month is a list, week by week, of the days something happens.
// It reads only what the projection gives (View.Days, Later, Paydays,
// Holidays): checking each day as far as the chart reads ahead, then a year
// from today of paychecks and payments on their days, without a balance,
// so a yearly renewal shows in its month. Before today, a day shows what
// the ledger recorded on it (each payee's mark and the day's total), back
// to a year ago.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Empty } from '../parts/Empty';
import { Row, Rows } from '../parts/Row';
import { Amount, Stat } from './ui/Amount';
import { IconButton, Widget } from './ui/Widget';
import { PayMark, Who } from './Mark';
import { inHome, kindName } from './model';
import { compact, dayLong, dayShort, isoDay, type Lookup, money, parseDay, signed } from './money';
import { TxMark, txTitle } from './Transactions';

export interface CalendarProps {
  v: finance.View;
  L: Lookup;
  /** What actually happened: the days before today show it. */
  ledger?: finance.Ledger | null;
  /** Opens a payment's or a transaction's form; none on a phone allowed only to look. */
  edit?: (what: 'payment' | 'transaction', id: string) => void;
}

/** What one day holds, for its cell, its row, and its card. */
interface DayInfo {
  date: string;
  balance: number;
  events: finance.Event[];
  /** Bills charged to a card that day: no checking money moves. */
  charges: finance.Event[];
  holiday?: string;
  moved: finance.Moved[];
  low: boolean;
  /** Past the chart's days (View.Later): what is planned, with no balance read. */
  later?: boolean;
  /** Before the chart's days: what the ledger recorded, with no balance read. */
  past?: boolean;
  /** The transactions recorded on the day (before today, and today's own). */
  spent: finance.Transaction[];
  /** What they came to in the plan's currency, transfers left out: they are neither in nor out. */
  net: number;
}

/** How many marks a day's cell shows before "+2". */
const shownMarks = 3;

const monthOf = (day: string) => day.slice(0, 7);
const addMonths = (month: string, n: number) => { const d = parseDay(month + '-01'); return isoDay(new Date(d.getFullYear(), d.getMonth() + n, 1)).slice(0, 7); };
const addDays = (day: string, n: number) => { const d = parseDay(day); return isoDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
const monthTitle = (month: string) => parseDay(month + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const weekday = (day: string, form: 'short' | 'long') => parseDay(day).toLocaleDateString(undefined, { weekday: form });

/** How far back the calendar shows what was recorded: a year, from the 1st of its month. */
const backMonths = 12;

/** The days the projection read, by date, each with its holiday, paydays moved, and whether it is under the cushion; before them, what the ledger recorded. */
function daysOf(v: finance.View, ledger?: finance.Ledger | null): Record<string, DayInfo> {
  const cushion = v.plan.cushion || 0;
  const moved: Record<string, finance.Moved[]> = {};
  for (const p of v.paydays || []) if (p.moved?.length) moved[p.date] = p.moved;
  // The ledger by day, each day's total in the plan's currency (an account may keep another).
  const txs = ledger?.transactions || [];
  const home = new Map(inHome(v.plan, txs).map((t) => [t.id, t.amount]));
  const byDay: Record<string, finance.Transaction[]> = {};
  for (const t of txs) (byDay[t.date] ||= []).push(t);
  const recorded = (date: string) => {
    const spent = byDay[date] || [];
    return { spent, net: spent.filter((t) => !t.to).reduce((n, t) => n + (home.get(t.id) ?? t.amount), 0) };
  };
  const out: Record<string, DayInfo> = {};
  const firstRead = (v.days || [])[0]?.date;
  // Before the days read ahead: what was recorded, from the month of the first transaction, a year back at most.
  const earliest = Object.keys(byDay).filter((d) => firstRead && d < firstRead).sort()[0];
  if (firstRead && earliest) {
    const t = parseDay(v.today);
    const floor = isoDay(new Date(t.getFullYear(), t.getMonth() - backMonths, 1));
    for (let d = earliest.slice(0, 7) + '-01' < floor ? floor : earliest.slice(0, 7) + '-01'; d < firstRead; d = addDays(d, 1)) {
      out[d] = { date: d, balance: 0, events: [], charges: [], holiday: v.holidays?.[d], moved: [], low: false, past: true, ...recorded(d) };
    }
  }
  for (const d of v.days || []) out[d.date] = { date: d.date, balance: d.balance, events: d.events || [], charges: d.charges || [], holiday: v.holidays?.[d.date], moved: moved[d.date] || [], low: !!cushion && d.balance < cushion, ...(d.date <= v.today ? recorded(d.date) : { spent: [], net: 0 }) };
  // Further ahead, every day to a year from today: what falls on it, or nothing.
  const later = v.later || [];
  const ahead = Object.fromEntries(later.map((d) => [d.date, d]));
  const lastDay = (v.days || []).at(-1)?.date;
  if (lastDay) {
    const end = isoDay(new Date(parseDay(v.today).getFullYear() + 1, parseDay(v.today).getMonth(), parseDay(v.today).getDate() - 1));
    for (let d = addDays(lastDay, 1); d <= end; d = addDays(d, 1)) {
      out[d] = { date: d, balance: 0, events: ahead[d]?.events || [], charges: ahead[d]?.charges || [], holiday: v.holidays?.[d], moved: [], low: false, later: true, spent: [], net: 0 };
    }
  }
  return out;
}

/** An event in words: "Alex's paycheck", or the payment's name. */
const named = (e: finance.Event, L: Lookup) => (e.people?.length ? e.people.map((id) => L.person[id]?.name || id).join(' and ') + "'s paycheck" : L.payment[e.payment || '']?.name || e.payment || '');

/** What leads an event: who is paid, or the payment's mark. */
function Lead({ e, L, size }: { e: finance.Event; L: Lookup; size?: 'sm' }) {
  if (e.people?.length) return <span class="fwhos">{e.people.map((id) => <Who key={id} name={L.person[id]?.name} n={L.order[id] ?? 0} size={size} />)}</span>;
  const x = L.payment[e.payment || ''];
  return <PayMark x={x} size={size} />;
}

/** Where a charge goes, in words: "on Chase Freedom, due Nov 21". */
export const onCard = (e: finance.Event, L: Lookup) => `on ${L.account[e.card || '']?.name || 'a card'}` + (e.due ? `, due ${dayShort(e.due)}` : '');

/** Why a payday moved, in words: "Moved from Sat, Nov 7: the weekend". */
const movedText = (m: finance.Moved, L: Lookup) => `${L.person[m.person]?.name || m.person}'s payday moved from ${dayLong(m.from)}: ${m.why}`;

/** A day read out: what moves and what checking holds after; before today, what was recorded. */
function dayLabel(d: DayInfo, L: Lookup, cushion: number) {
  if (d.past) return [dayLong(d.date) + (d.holiday ? `, ${d.holiday}` : ''), d.spent.length ? d.spent.map((t) => `${txTitle(t, L)} ${signed(t.amount)}`).join(', ') : 'nothing recorded', d.spent.some((t) => !t.to) ? `${signed(d.net)} in all` : ''].filter(Boolean).join('. ');
  const said = [...d.events.map((e) => `${named(e, L)} ${signed(e.amount)}`), ...d.charges.map((e) => `${named(e, L)} ${money(-e.amount)} ${onCard(e, L)}`)];
  return [dayLong(d.date) + (d.holiday ? `, ${d.holiday}` : ''), said.length ? said.join(', ') : 'nothing comes or goes',
    d.later ? 'planned, past where checking is read ahead' : `checking ${money(d.balance)} after` + (d.low ? `, under your ${compact(cushion)} cushion` : '')].join('. ');
}

export function Calendar({ v, L, ledger, edit }: CalendarProps) {
  const days = daysOf(v, ledger);
  const dates = Object.keys(days).sort();
  const first = dates[0] || v.today, last = dates[dates.length - 1] || v.today;
  // The first and last days checking is read for; before, what was recorded; after, only what is planned.
  const from = (v.days || [])[0]?.date || first;
  const read = (v.days || []).at(-1)?.date || last;
  const [month, setMonth] = useState(monthOf(from));
  const [sel, setSel] = useState(from);
  // The day the keys moved to: focused once it is drawn (in another month too).
  const focusing = useRef('');
  const grid = useRef<HTMLTableElement>(null);
  useEffect(() => {
    if (!focusing.current) return;
    grid.current?.querySelector<HTMLButtonElement>(`button[data-day="${focusing.current}"]`)?.focus();
    focusing.current = '';
  });
  const cushion = v.plan.cushion || 0;
  if (!dates.length) return <div class="fin"><Widget title="Calendar" span="all"><Empty>Nothing to show yet: add a checking account, a paycheck, and the payments that repeat.</Empty></Widget></div>;

  const go = (day: string, focus = false) => {
    const d = day < first ? first : day > last ? last : day;
    setSel(d);
    setMonth(monthOf(d));
    if (focus) focusing.current = d;
  };
  const turn = (n: number) => {
    const m = addMonths(month, n);
    setMonth(m);
    // The day picked follows: the same day of the month, kept to the days read.
    const want = m + sel.slice(7);
    setSel(want < first ? first : want > last ? last : days[want] ? want : last);
  };
  // From the day picked, not the button the key reached: a key pressed
  // before the focus caught up still moves on from where the last one went.
  const keys = (e: KeyboardEvent) => {
    const day = sel;
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (step[e.key]) go(addDays(day, step[e.key]), true);
    else if (e.key === 'PageUp' || e.key === 'PageDown') { const m = addMonths(monthOf(day), e.key === 'PageUp' ? -1 : 1); go(m + day.slice(7) > last ? last : m + day.slice(7), true); }
    else if (e.key === 'Home') go(addDays(day, -col(day)), true);
    else if (e.key === 'End') go(addDays(day, 6 - col(day)), true);
    else return;
    e.preventDefault();
  };

  // Weeks start on Monday with UK bank holidays, else on Sunday.
  const monday = v.plan.holidays === 'uk';
  const col = (day: string) => (parseDay(day).getDay() + (monday ? 6 : 0)) % 7;
  const start = month + '-01';
  const inMonth: string[] = [];
  for (let d = start; monthOf(d) === month; d = addDays(d, 1)) inMonth.push(d);
  const cells: (string | null)[] = [...Array(col(start)).fill(null), ...inMonth];
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const heads = Array.from({ length: 7 }, (_, i) => addDays('2026-11-01', (i + (monday ? 1 : 0)) % 7)); // Nov 1, 2026 is a Sunday

  const picked = days[sel];
  const lowCount = inMonth.filter((d) => days[d]?.low).length;
  return (
    <div class="fin">
      <div class="fx-board fx-calboard">
        <Widget title={monthTitle(month)} span={2} kind="fx-calendar"
          actions={<>
            <button type="button" class="small" disabled={monthOf(v.today) === month && sel === (days[v.today] ? v.today : from)} onClick={() => go(days[v.today] ? v.today : from)}>Today</button>
            <IconButton icon="prev" label="The month before" onClick={() => turn(-1)} disabled={month <= monthOf(first)} />
            <IconButton icon="next" label="The month after" onClick={() => turn(1)} disabled={month >= monthOf(last)} />
          </>}>
          <p class="fx-sub fx-lead">{month < monthOf(from) ? pastLead(inMonth.map((d) => days[d]).filter(Boolean)) : lowCount ? `Checking falls under your ${compact(cushion)} cushion on ${lowCount === 1 ? '1 day' : `${lowCount} days`} this month.` : month > monthOf(read) ? `What is planned this month. Checking is read ahead to ${dayShort(read)}, so no balance shows.` : last > read ? `Checking each day to ${dayShort(read)}; after it, what is planned, to ${dayShort(last)}${last.slice(0, 4) !== v.today.slice(0, 4) ? `, ${last.slice(0, 4)}` : ''}.` : `From today to ${dayShort(last)}, as far as Finances reads ahead.`}</p>
          <table class="fx-month" ref={grid} aria-label={`${monthTitle(month)}: paydays, payments, and checking each day`}>
            <thead><tr>{heads.map((d) => <th key={d} scope="col" abbr={weekday(d, 'long')}>{weekday(d, 'short')}</th>)}</tr></thead>
            <tbody>
              {weeks.map((w, i) => <tr key={i}>{w.map((d, k) => {
                if (!d) return <td key={k} class="fx-blank" />;
                const info = days[d];
                const n = Number(d.slice(8));
                if (!info) return <td key={k} class="fx-off"><span class="fx-daynum"><span class="fx-hidden">{dayLong(d)}, before today or past what Finances reads ahead</span><span aria-hidden="true">{n}</span></span>{v.holidays?.[d] && <span class="fx-hol">{v.holidays[d]}</span>}</td>;
                const pays = info.events.filter((e) => e.people?.length), bills = info.events.filter((e) => !e.people?.length);
                const marks = [...pays, ...bills, ...info.charges];
                if (info.past) return (
                  <td key={k} class="fx-past">
                    <button type="button" class="fx-day" data-day={d} aria-pressed={d === sel} tabIndex={d === sel ? 0 : -1}
                      onClick={() => setSel(d)} onKeyDown={keys}>
                      <span class="fx-hidden">{dayLabel(info, L, cushion)}</span>
                      <span class="fx-daynum" aria-hidden="true">{n}</span>
                      {info.holiday && <span class="fx-hol" aria-hidden="true">{info.holiday}</span>}
                      <span class="fx-daymarks" aria-hidden="true">
                        {info.spent.slice(0, shownMarks).map((t) => <TxMark key={t.id} t={t} size="sm" categories={v.categories} />)}
                        {info.spent.length > shownMarks && <span class="fx-moremarks">+{info.spent.length - shownMarks}</span>}
                      </span>
                      {info.spent.some((t) => !t.to) && <span class={'fx-daybal' + (info.net > 0 ? ' fx-in' : '')} aria-hidden="true">{info.net > 0 ? '+' : ''}{compact(info.net)}</span>}
                    </button>
                  </td>
                );
                return (
                  <td key={k} class={(info.low ? 'fx-low' : '') + (d === v.today ? ' fx-today' : '') + (info.later ? ' fx-later' : '')}>
                    {/* The day in words is its name; what it draws says the same, so it is hidden from a screen reader. */}
                    <button type="button" class="fx-day" data-day={d} aria-pressed={d === sel} tabIndex={d === sel ? 0 : -1}
                      onClick={() => setSel(d)} onKeyDown={keys}>
                      <span class="fx-hidden">{dayLabel(info, L, cushion)}</span>
                      <span class="fx-daynum" aria-hidden="true">{n}{!!info.moved.length && <span class="fx-movedtag">moved</span>}</span>
                      {info.holiday && <span class="fx-hol" aria-hidden="true">{info.holiday}</span>}
                      <span class="fx-daymarks" aria-hidden="true">
                        {marks.slice(0, shownMarks).map((e, j) => <Lead key={j} e={e} L={L} size="sm" />)}
                        {marks.length > shownMarks && <span class="fx-moremarks">+{marks.length - shownMarks}</span>}
                      </span>
                      {!info.later && <span class={'fx-daybal' + (info.low ? ' fx-out' : '')} aria-hidden="true">{compact(info.balance)}</span>}
                    </button>
                  </td>
                );
              })}</tr>)}
            </tbody>
          </table>
          <ul class="fx-legend inline fx-callegend" aria-hidden="true">
            {month <= monthOf(from) && first < from && <li><span class="fx-key fx-keypast" /><span class="fx-legendlabel">What your transactions recorded</span></li>}
            <li><span class={'fx-key' + (cushion ? ' fx-keylow' : '')} /><span class="fx-legendlabel">{cushion ? `Under your ${compact(cushion)} cushion` : 'Checking at the end of the day'}</span></li>
            <li><span class="fx-key fx-keyhol" /><span class="fx-legendlabel">Bank holiday</span></li>
            <li><span class="fx-movedtag">moved</span><span class="fx-legendlabel">A payday moved before a weekend or holiday</span></li>
          </ul>
          <WeekList v={v} L={L} days={days} inMonth={inMonth} col={col} cushion={cushion} edit={edit} />
        </Widget>
        {picked && <DayCard v={v} L={L} d={picked} cushion={cushion} edit={edit} read={read} />}
        <MonthCard L={L} month={month} ds={inMonth.map((d) => days[d]).filter(Boolean)} cushion={cushion} today={v.today} />
      </div>
    </div>
  );
}

/**
 * The month shown in all: what its paychecks bring and its bills take,
 * the lowest checking gets and on which day, and, for its days before
 * today, what the transactions recorded. Beside the day picked.
 */
function MonthCard({ L, month, ds, cushion, today }: { L: Lookup; month: string; ds: DayInfo[]; cushion: number; today: string }) {
  const name = parseDay(month + '-01').toLocaleDateString(undefined, { month: 'long' });
  const events = ds.flatMap((d) => d.events);
  const pays = events.filter((e) => e.people?.length), bills = events.filter((e) => !e.people?.length && e.amount < 0), comes = events.filter((e) => !e.people?.length && e.amount > 0);
  const charges = ds.flatMap((d) => d.charges);
  const sum = (es: finance.Event[]) => es.reduce((n, e) => n + e.amount, 0);
  const who = [...new Set(pays.flatMap((e) => e.people || []))].map((id) => L.person[id]?.name || id);
  // The lowest of the days checking is read for, from today on: the past has no balance read.
  const read = ds.filter((d) => !d.past && !d.later && d.date >= today);
  const low = read.reduce<DayInfo | undefined>((m, d) => (!m || d.balance < m.balance ? d : m), undefined);
  const spent = ds.flatMap((d) => d.spent).filter((t) => !t.to && (ds.find((d) => d.date === t.date)?.past || t.date === today));
  const recIn = spent.filter((t) => t.amount > 0).length, recOut = spent.filter((t) => t.amount < 0).length;
  const recNet = ds.filter((d) => d.past || d.date === today).reduce((n, d) => n + d.net, 0);
  const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
  const nothing = !pays.length && !bills.length && !comes.length && !charges.length && !low && !spent.length;
  return (
    <Widget title={`${name} in all`} kind="fx-monthone">
      <Rows kind="fx-rows">
        {!!pays.length && <Row title="Paychecks" sub={`${plural(pays.length, 'paycheck')} · ${who.join(', ')}`} when={<Amount value={sum(pays)} sign tone="in" form="full" />} whenPlain />}
        {!!comes.length && <Row title="Money coming in" sub={plural(comes.length, 'payment')} when={<Amount value={sum(comes)} sign tone="in" form="full" />} whenPlain />}
        {!!bills.length && <Row title="Bills and payments" sub={plural(bills.length, 'payment') + ' from checking'} when={<Amount value={sum(bills)} sign form="full" />} whenPlain />}
        {!!charges.length && <Row title="Charged to cards" sub={`${plural(charges.length, 'charge')}, paid with the card`} when={<Amount value={-sum(charges)} form="full" tone="muted" />} whenPlain />}
        {low && <Row title="Lowest in checking" sub={dayLong(low.date) + (low.low ? `, under your ${compact(cushion)} cushion` : '')} subTone={low.low ? 'warn' : ''}
          when={<Amount value={low.balance} tone={low.balance < 0 ? 'out' : low.low ? 'warn' : ''} form="full" />} whenPlain />}
        {!!spent.length && <Row title="Recorded so far" sub={[recIn && `${recIn} in`, recOut && `${recOut} out`].filter(Boolean).join(', ') + ' · in your transactions'} when={<Amount value={recNet} sign tone="auto" form="full" />} whenPlain />}
        {nothing && <li><Empty>Nothing comes or goes this month.</Empty></li>}
      </Rows>
    </Widget>
  );
}

/** A month before today in words: what its transactions came to. */
function pastLead(ds: DayInfo[]): string {
  const all = ds.flatMap((d) => d.spent).filter((t) => !t.to);
  if (!all.length) return 'Nothing was recorded this month. Days before today show what your transactions recorded.';
  const out = ds.reduce((n, d) => n + d.spent.filter((t) => !t.to && t.amount < 0).length, 0);
  const net = ds.reduce((n, d) => n + d.net, 0);
  return `What your transactions recorded: ${out === 1 ? '1 payment' : `${out} payments`} out, ${signed(net)} in all.`;
}

/** The day picked: checking after it, and each paycheck and payment on it; before today, what was recorded. */
function DayCard({ v, L, d, cushion, edit, read }: { v: finance.View; L: Lookup; d: DayInfo; cushion: number; edit?: CalendarProps['edit']; read: string }) {
  if (d.past) return (
    <Widget title={dayLong(d.date)} kind="fx-dayone">
      <Stat value={<Amount value={d.net} sign tone={d.net > 0 ? 'in' : ''} />} caption="What your transactions recorded" />
      {d.holiday && <p class="fx-sub fx-daynote">{d.holiday}: the banks were closed.</p>}
      <TxRows v={v} L={L} d={d} edit={edit} />
    </Widget>
  );
  return (
    <Widget title={dayLong(d.date) + (d.date === v.today ? ', today' : '')} kind="fx-dayone">
      {d.later ? <p class="fx-sub fx-daynote">What is planned for the day. Checking is read ahead to {dayShort(read)}, so its balance is not shown.</p> : <Stat value={<Amount value={d.balance} tone={d.balance < 0 ? 'out' : d.low ? 'warn' : ''} />}
        caption={<>In checking at the end of the day{d.low && <span>, under your {compact(cushion)} cushion</span>}</>} />}
      {(d.holiday || !!d.moved.length) && <p class="fx-sub fx-daynote">{[d.holiday && `${d.holiday}: the banks are closed.`, ...d.moved.map((m) => movedText(m, L) + '.')].filter(Boolean).join(' ')}</p>}
      <DayRows L={L} d={d} edit={edit} />
      {!!d.spent.length && <><h3 class="fx-daysub">Recorded today</h3><TxRows v={v} L={L} d={d} edit={edit} /></>}
    </Widget>
  );
}

/** A day's transactions as rows, as Transactions draws them; each opens its form. */
function TxRows({ v, L, d, edit }: { v: finance.View; L: Lookup; d: DayInfo; edit?: CalendarProps['edit'] }) {
  return (
    <Rows kind="fx-rows">
      {d.spent.map((t) => {
        const a = L.account[t.account];
        const where = t.to ? `${a?.name || t.account} → ${L.account[t.to]?.name || t.to}` : a?.name || t.account;
        const what = t.splits?.length ? t.splits.map((sp) => sp.category).join(', ') : t.category || (t.to ? 'Transfer' : 'No category');
        return <Row key={t.id} lead={<TxMark t={t} categories={v.categories} />} title={txTitle(t, L)} sub={`${what} · ${where}`}
          when={<Amount value={t.amount} sign={t.amount > 0} tone={t.amount > 0 && !t.to ? 'in' : ''} form="full" currency={a?.currency} />} whenPlain
          onOpen={edit ? () => edit('transaction', t.id) : undefined} openLabel={edit ? 'edit' : undefined} />;
      })}
      {!d.spent.length && <li><Empty>Nothing recorded.</Empty></li>}
    </Rows>
  );
}

/** A day's paychecks and payments as rows; a payment's opens its form. */
function DayRows({ L, d, edit }: { L: Lookup; d: DayInfo; edit?: CalendarProps['edit'] }) {
  return (
    <Rows kind="fx-rows">
      {d.events.map((e, i) => {
        const x = L.payment[e.payment || ''];
        return <Row key={i} lead={<Lead e={e} L={L} />} title={named(e, L)}
          sub={e.people?.length ? 'Paycheck' : x?.payer ? 'From ' + x.payer : x?.card ? 'The card\'s balance' : kindName(x?.kind || 'other')}
          when={<Amount value={e.amount} sign tone={e.amount > 0 ? 'in' : ''} form="full" />} whenPlain
          onOpen={edit && x ? () => edit('payment', x.id) : undefined} openLabel={x && edit ? 'edit' : undefined} />;
      })}
      {d.charges.map((e, i) => {
        const x = L.payment[e.payment || ''];
        return <Row key={'c' + i} lead={<Lead e={e} L={L} />} title={named(e, L)} sub={onCard(e, L).replace(/^on/, 'On')}
          when={<Amount value={-e.amount} form="full" tone="muted" />} whenPlain
          onOpen={edit && x ? () => edit('payment', x.id) : undefined} openLabel={x && edit ? 'edit' : undefined} />;
      })}
      {!d.events.length && !d.charges.length && <li><Empty>Nothing comes or goes.</Empty></li>}
    </Rows>
  );
}

/** Narrow: the month week by week, each day something happens with what moves and checking after. */
function WeekList({ v, L, days, inMonth, col, cushion, edit }: { v: finance.View; L: Lookup; days: Record<string, DayInfo>; inMonth: string[]; col: (day: string) => number; cushion: number; edit?: CalendarProps['edit'] }) {
  const busy = inMonth.filter((d) => days[d] && (days[d].events.length || days[d].charges.length || days[d].spent.length || days[d].holiday || days[d].low));
  // Each busy day under the first day of its week.
  const weeks: string[][] = [];
  let from = '';
  for (const d of busy) {
    const w = addDays(d, -col(d));
    if (w !== from) { weeks.push([]); from = w; }
    weeks[weeks.length - 1].push(d);
  }
  return (
    <div class="fx-weeks">
      {weeks.map((w) => (
        <section key={w[0]} class="fx-week" aria-label={`Week of ${dayShort(w[0])}`}>
          {w.map((d) => {
            const info = days[d];
            return (
              <div key={d} class={'fx-weekday' + (info.low ? ' fx-low' : '')}>
                <h3><span>{dayLong(d)}{d === v.today ? ', today' : ''}{info.holiday ? ` · ${info.holiday}` : ''}</span>
                  {info.past ? info.spent.some((t) => !t.to) && <span class="fx-daybal">{signed(info.net)}<span class="fx-sub"> recorded</span></span>
                    : !info.later && <span class={'fx-daybal' + (info.low ? ' fx-out' : '')}>{money(info.balance)}<span class="fx-sub"> after{info.low ? `, under ${compact(cushion)}` : ''}</span></span>}</h3>
                {!!info.moved.length && <p class="fx-sub fx-daynote">{info.moved.map((m) => movedText(m, L)).join('. ')}.</p>}
                {!!(info.events.length || info.charges.length) && <DayRows L={L} d={info} edit={edit} />}
                {!!info.spent.length && <TxRows v={v} L={L} d={info} edit={edit} />}
              </div>
            );
          })}
        </section>
      ))}
      {!busy.length && <Empty>Nothing comes or goes this month.</Empty>}
    </div>
  );
}
