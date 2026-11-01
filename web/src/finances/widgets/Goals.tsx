// Goals: money put by for something, from shares of the accounts (it never
// moves money). Each with a bar of what is saved against its target, what
// is left, what it needs a month and a paycheck to be there by its day,
// and the pace the accounts have kept, with the month that pace reaches it:
// in amber when that is after its day. Edit opens a goal's form; Add a
// goal a new one; none yet, it says what they are for. Over them, a word
// when the goals together need more a month than the plan puts by; under
// them, What if: another amount a paycheck, and when that gets there, or
// another day, and what that needs a paycheck.
import { useState } from 'preact/hooks';
import { Empty } from '../../parts/Empty';
import { Row, Rows } from '../../parts/Row';
import { Amount } from '../ui/Amount';
import { Widget } from '../ui/Widget';
import { month } from '../model';
import { currencySign, daysBetween, dayShort, type Lookup, money, monthName, parseAmount } from '../money';

/** "Jun 2028" from "2028-06". */
const monthOf = (ym: string) => `${monthName(ym + '-01').slice(0, 3)} ${ym.slice(0, 4)}`;

/** A goal's day with its year, as it is often a year or more away: "Jun 30, 2028". */
const byDay = (d: string) => `${dayShort(d)}, ${d.slice(0, 4)}`;

/** What a goal needs and how its pace stands, in words. */
export function goalWords(g: finance.GoalNow): string {
  if (g.left <= 0) return 'Reached';
  const needs = g.needsMonth ? `${money(g.needsMonth)} a month${g.needsPaycheck ? `, ${money(g.needsPaycheck)} a paycheck` : ''} to be there by ${byDay(g.date!)}` : g.date ? `wanted by ${byDay(g.date)}` : '';
  const pace = g.paced ? (g.pace > 0 ? `at ${money(g.pace)} a month, there by ${monthOf(g.reaches!)}` : 'not growing lately') : '';
  return [needs, pace].filter(Boolean).join('; ') || 'No day set';
}

/** How many paydays a month, from those read ahead (none read, none). */
export function paydaysAMonth(v: finance.View): number {
  const last = v.paydays.at(-1)?.date;
  const days = last ? daysBetween(v.today, last) : 0;
  return days > 0 ? v.paydays.length / (days / 30.44) : 0;
}

/** The month (YYYY-MM) n months on from a day. */
const monthsOn = (day: string, n: number) => { const d = new Date(+day.slice(0, 4), +day.slice(5, 7) - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

/**
 * What if, for a goal not reached: another amount put by a paycheck and the
 * month it gets there (before or after its day), or another day and what
 * it needs a paycheck. It changes nothing; the goal's form does.
 */
function WhatIf({ v, goals }: { v: finance.View; goals: finance.GoalNow[] }) {
  const open = goals.filter((g) => g.left > 0);
  const [id, setId] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState('');
  const g = open.find((x) => x.id === id) || open[0];
  if (!g) return null;
  const per = paydaysAMonth(v);
  const n = parseAmount(amount);
  const months = n > 0 && per > 0 ? Math.ceil(g.left / (n * per)) : 0;
  const reaches = months ? monthsOn(v.today, months) : '';
  const due = g.date?.slice(0, 7);
  const gap = reaches && due ? (+reaches.slice(0, 4) - +due.slice(0, 4)) * 12 + (+reaches.slice(5) - +due.slice(5)) : 0;
  const paychecks = day && day > v.today ? Math.max(1, Math.floor((daysBetween(v.today, day) / 30.44) * per)) : 0;
  return (
    <section class="fx-whatif" aria-label="What if">
      <h3>What if</h3>
      <div class="fx-whatifrow">
        {open.length > 1 && <select aria-label="Which goal" value={g.id} onChange={(e) => setId((e.target as HTMLSelectElement).value)}>{open.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
        {open.length === 1 && <strong>{g.name}</strong>}
        <label>I put by <span class="moneyfield"><span aria-hidden="true">{currencySign()}</span><input inputmode="decimal" aria-label="Put by a paycheck" value={amount} placeholder={g.needsPaycheck ? String(Math.round(g.needsPaycheck)) : '100'} onInput={(e) => setAmount((e.target as HTMLInputElement).value)} /></span> a paycheck</label>
        <label>or want it by <input type="date" aria-label="Want it by" value={day} onInput={(e) => setDay((e.target as HTMLInputElement).value)} /></label>
      </div>
      <p class="fx-sub" role="status">
        {months > 0 && <>At {money(n)} a paycheck (about {money(n * per)} a month), {g.name} gets there by {monthOf(reaches)}{due ? (gap > 0 ? `, ${gap} month${gap === 1 ? '' : 's'} after its day` : gap < 0 ? `, ${-gap} month${gap === -1 ? '' : 's'} before its day` : ', the month of its day') : ''}. </>}
        {paychecks > 0 && <>By {byDay(day)}, it needs {money(g.left / paychecks)} a paycheck ({paychecks} paychecks).</>}
        {!months && !paychecks && 'Type an amount a paycheck, or a day, to see what it changes. Nothing is saved.'}
      </p>
    </section>
  );
}

export function GoalsWidget({ v, L, edit }: { v: finance.View; L: Lookup; edit?: (what: 'goal', id?: string) => void }) {
  const goals = v.goals || [];
  // What the goals with a day need a month together, against what the plan puts by a month.
  const need = goals.reduce((t, g) => t + (g.needsMonth || 0), 0);
  const saved = goals.length ? month(v, L).saved : 0;
  return (
    <Widget title="Goals" span="all" kind="fx-goals" actions={edit && <button type="button" class="small" onClick={() => edit('goal')}>Add a goal</button>}>
      {need > saved + 0.005 && <p class="fx-goalsshort fx-warn" role="note">Together the goals need {money(need)} a month to be there in time; the plan puts by {money(saved)} a month, {money(need - saved)} short.</p>}
      {goals.length ? <Rows kind="fx-rows">
        {goals.map((g) => {
          const share = g.target > 0 ? Math.min(100, (g.saved / g.target) * 100) : 0;
          const tone = g.left <= 0 ? 'done' : g.behind ? 'warn' : '';
          return <Row key={g.id} title={g.name} sub={<span class={tone === 'warn' ? 'fx-warn' : ''}>{goalWords(g)}{tone === 'warn' && <span class="sr"> (behind)</span>}</span>}
            when={<span class="fx-goalleft">{g.left <= 0 ? <Amount value={g.target} form="full" /> : <><Amount value={g.left} form="full" /> left</>}</span>} whenPlain
            onOpen={edit ? () => edit('goal', g.id) : undefined} openLabel={edit ? 'edit' : undefined}>
            <span class={'fx-budgetbar' + (tone === 'warn' ? ' warn' : '')} role="img" aria-label={`${g.name}: ${money(g.saved)} of ${money(g.target)}`}>
              <span style={{ width: `${Math.max(share, g.saved > 0 ? 1 : 0)}%` }} />
            </span>
            <span class="fx-sub fx-goalsaved">{money(g.saved)} of {money(g.target)}</span>
          </Row>;
        })}
      </Rows> : <Empty>{edit ? 'No goals yet: an emergency fund, a trip, a car. Say how much, by when, and which accounts count toward it, and see what it needs each paycheck.' : 'No goals yet.'}</Empty>}
      <WhatIf v={v} goals={goals} />
    </Widget>
  );
}
