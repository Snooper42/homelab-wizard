// Finances › Calendar: the money month by month. Each day shows who is
// paid (in their colour), each payment's mark, a bank holiday, and checking
// at the end of the day, marked when it falls under the cushion. Picking a
// day says what moves on it and what checking holds after. Narrow (a
// phone), the month is a list, week by week, of the days something happens.
// It reads only what the projection gives (View.Days, Paydays, Holidays):
// the days from today as far as the chart reads ahead.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Empty } from '../parts/Empty';
import { Row, Rows } from '../parts/Row';
import { Amount, Stat } from './ui/Amount';
import { IconButton, Widget } from './ui/Widget';
import { PayMark, Who } from './Mark';
import { kindName } from './model';
import { compact, dayLong, dayShort, isoDay, type Lookup, money, parseDay, signed } from './money';

export interface CalendarProps {
  v: finance.View;
  L: Lookup;
  /** Opens a payment's form; none on a phone allowed only to look. */
  edit?: (what: 'payment', id: string) => void;
}

/** What one day holds, for its cell, its row, and its card. */
interface DayInfo {
  date: string;
  balance: number;
  events: finance.Event[];
  holiday?: string;
  moved: finance.Moved[];
  low: boolean;
}

/** How many marks a day's cell shows before "+2". */
const shownMarks = 3;

const monthOf = (day: string) => day.slice(0, 7);
const addMonths = (month: string, n: number) => { const d = parseDay(month + '-01'); return isoDay(new Date(d.getFullYear(), d.getMonth() + n, 1)).slice(0, 7); };
const addDays = (day: string, n: number) => { const d = parseDay(day); return isoDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
const monthTitle = (month: string) => parseDay(month + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const weekday = (day: string, form: 'short' | 'long') => parseDay(day).toLocaleDateString(undefined, { weekday: form });

/** The days the projection read, by date, each with its holiday, paydays moved, and whether it is under the cushion. */
function daysOf(v: finance.View): Record<string, DayInfo> {
  const cushion = v.plan.cushion || 0;
  const moved: Record<string, finance.Moved[]> = {};
  for (const p of v.paydays || []) if (p.moved?.length) moved[p.date] = p.moved;
  const out: Record<string, DayInfo> = {};
  for (const d of v.days || []) out[d.date] = { date: d.date, balance: d.balance, events: d.events || [], holiday: v.holidays?.[d.date], moved: moved[d.date] || [], low: !!cushion && d.balance < cushion };
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

/** Why a payday moved, in words: "Moved from Sat, Nov 7: the weekend". */
const movedText = (m: finance.Moved, L: Lookup) => `${L.person[m.person]?.name || m.person}'s payday moved from ${dayLong(m.from)}: ${m.why}`;

/** A day read out: what moves and what checking holds after. */
function dayLabel(d: DayInfo, L: Lookup, cushion: number) {
  const said = d.events.map((e) => `${named(e, L)} ${signed(e.amount)}`);
  return [dayLong(d.date) + (d.holiday ? `, ${d.holiday}` : ''), said.length ? said.join(', ') : 'nothing comes or goes',
    `checking ${money(d.balance)} after` + (d.low ? `, under your ${compact(cushion)} cushion` : '')].join('. ');
}

export function Calendar({ v, L, edit }: CalendarProps) {
  const days = daysOf(v);
  const dates = Object.keys(days).sort();
  const first = dates[0] || v.today, last = dates[dates.length - 1] || v.today;
  const [month, setMonth] = useState(monthOf(first));
  const [sel, setSel] = useState(first);
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
            <button type="button" class="small" disabled={monthOf(v.today) === month && sel === (days[v.today] ? v.today : first)} onClick={() => go(days[v.today] ? v.today : first)}>Today</button>
            <IconButton icon="prev" label="The month before" onClick={() => turn(-1)} disabled={month <= monthOf(first)} />
            <IconButton icon="next" label="The month after" onClick={() => turn(1)} disabled={month >= monthOf(last)} />
          </>}>
          <p class="fx-sub fx-lead">{lowCount ? `Checking falls under your ${compact(cushion)} cushion on ${lowCount === 1 ? '1 day' : `${lowCount} days`} this month.` : `From today to ${dayShort(last)}, as far as Finances reads ahead.`}</p>
          <table class="fx-month" ref={grid} aria-label={`${monthTitle(month)}: paydays, payments, and checking each day`}>
            <thead><tr>{heads.map((d) => <th key={d} scope="col" abbr={weekday(d, 'long')}>{weekday(d, 'short')}</th>)}</tr></thead>
            <tbody>
              {weeks.map((w, i) => <tr key={i}>{w.map((d, k) => {
                if (!d) return <td key={k} class="fx-blank" />;
                const info = days[d];
                const n = Number(d.slice(8));
                if (!info) return <td key={k} class="fx-off"><span class="fx-daynum"><span class="fx-hidden">{dayLong(d)}, before today or past what Finances reads ahead</span><span aria-hidden="true">{n}</span></span>{v.holidays?.[d] && <span class="fx-hol">{v.holidays[d]}</span>}</td>;
                const pays = info.events.filter((e) => e.people?.length), bills = info.events.filter((e) => !e.people?.length);
                const marks = [...pays, ...bills];
                return (
                  <td key={k} class={(info.low ? 'fx-low' : '') + (d === v.today ? ' fx-today' : '')}>
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
                      <span class={'fx-daybal' + (info.low ? ' fx-out' : '')} aria-hidden="true">{compact(info.balance)}</span>
                    </button>
                  </td>
                );
              })}</tr>)}
            </tbody>
          </table>
          <ul class="fx-legend inline fx-callegend" aria-hidden="true">
            <li><span class="fx-key fx-keylow" /><span class="fx-legendlabel">{cushion ? `Under your ${compact(cushion)} cushion` : 'Checking at the end of the day'}</span></li>
            <li><span class="fx-key fx-keyhol" /><span class="fx-legendlabel">Bank holiday</span></li>
            <li><span class="fx-movedtag">moved</span><span class="fx-legendlabel">A payday moved before a weekend or holiday</span></li>
          </ul>
          <WeekList v={v} L={L} days={days} inMonth={inMonth} col={col} cushion={cushion} edit={edit} />
        </Widget>
        {picked && <DayCard v={v} L={L} d={picked} cushion={cushion} edit={edit} />}
      </div>
    </div>
  );
}

/** The day picked: checking after it, and each paycheck and payment on it. */
function DayCard({ v, L, d, cushion, edit }: { v: finance.View; L: Lookup; d: DayInfo; cushion: number; edit?: CalendarProps['edit'] }) {
  return (
    <Widget title={dayLong(d.date) + (d.date === v.today ? ', today' : '')} kind="fx-dayone">
      <Stat value={<Amount value={d.balance} tone={d.balance < 0 ? 'out' : d.low ? 'warn' : ''} />}
        caption={<>In checking at the end of the day{d.low && <span>, under your {compact(cushion)} cushion</span>}</>} />
      {(d.holiday || !!d.moved.length) && <p class="fx-sub fx-daynote">{[d.holiday && `${d.holiday}: the banks are closed.`, ...d.moved.map((m) => movedText(m, L) + '.')].filter(Boolean).join(' ')}</p>}
      <DayRows L={L} d={d} edit={edit} />
    </Widget>
  );
}

/** A day's paychecks and payments as rows; a payment's opens its form. */
function DayRows({ L, d, edit }: { L: Lookup; d: DayInfo; edit?: CalendarProps['edit'] }) {
  return (
    <Rows kind="fx-rows">
      {d.events.map((e, i) => {
        const x = L.payment[e.payment || ''];
        return <Row key={i} lead={<Lead e={e} L={L} />} title={named(e, L)}
          sub={e.people?.length ? 'Paycheck' : x?.card ? 'The card\'s balance' : kindName(x?.kind || 'other')}
          when={<Amount value={e.amount} sign tone={e.amount > 0 ? 'in' : ''} form="full" />} whenPlain
          onOpen={edit && x ? () => edit('payment', x.id) : undefined} openLabel={x && edit ? 'edit' : undefined} />;
      })}
      {!d.events.length && <li><Empty>Nothing comes or goes.</Empty></li>}
    </Rows>
  );
}

/** Narrow: the month week by week, each day something happens with what moves and checking after. */
function WeekList({ v, L, days, inMonth, col, cushion, edit }: { v: finance.View; L: Lookup; days: Record<string, DayInfo>; inMonth: string[]; col: (day: string) => number; cushion: number; edit?: CalendarProps['edit'] }) {
  const busy = inMonth.filter((d) => days[d] && (days[d].events.length || days[d].holiday || days[d].low));
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
                  <span class={'fx-daybal' + (info.low ? ' fx-out' : '')}>{money(info.balance)}<span class="fx-sub"> after{info.low ? `, under ${compact(cushion)}` : ''}</span></span></h3>
                {!!info.moved.length && <p class="fx-sub fx-daynote">{info.moved.map((m) => movedText(m, L)).join('. ')}.</p>}
                {!!info.events.length && <DayRows L={L} d={info} edit={edit} />}
              </div>
            );
          })}
        </section>
      ))}
      {!busy.length && <Empty>Nothing comes or goes this month.</Empty>}
    </div>
  );
}
