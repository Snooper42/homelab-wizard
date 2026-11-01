// Financial independence, as an estimate: what is enough to live on what
// it earns (a year's spending over the share drawn a year), what is in the
// investment and retirement accounts toward it, and the month it gets
// there at what is put by a month, at the growth taken and two points
// either way. The two assumptions are the household's to change, where
// Finances may be changed; it is said to be an estimate, not advice.
import { useState } from 'preact/hooks';
import { Amount } from '../ui/Amount';
import { Widget } from '../ui/Widget';
import { fire } from '../fire';
import { month, todayOf } from '../model';
import { type Lookup, money, monthName, parseAmount, whole } from '../money';

/** "Mar 2041", n months from a day. */
const when = (day: string, n: number) => { const d = new Date(+day.slice(0, 4), +day.slice(5, 7) - 1 + n, 1); return `${monthName(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`).slice(0, 3)} ${d.getFullYear()}`; };

export function FireWidget({ v, L, keep }: { v: finance.View; L: Lookup; keep?: (plan: finance.Plan) => Promise<boolean> }) {
  const m = month(v, L);
  const withdraw = v.plan.withdraw || 4, growth = v.plan.growth || 5;
  const [problem, setProblem] = useState('');
  const invested = (v.plan.accounts || []).filter((a) => a.kind === 'investment' || a.kind === 'retirement');
  const have = invested.reduce((t, a) => t + todayOf(v, a), 0);
  const monthly = m.saved + m.viaPay;
  if (m.spent <= 0) return null;
  const f = fire(m.spent * 12, have, monthly, withdraw, growth);
  const share = Math.min(100, (have / f.target) * 100);
  const set = (key: 'withdraw' | 'growth', text: string, lo: number, hi: number) => {
    const n = parseAmount(text);
    if (isNaN(n) || n < lo || n > hi || (key === 'withdraw' && n === 0)) { setProblem(key === 'withdraw' ? 'A share to spend a year is more than 0 and at most 20%.' : 'Growth a year is between -10% and 20%.'); return; }
    setProblem('');
    keep!({ ...v.plan, [key]: n });
  };
  const range = f.sooner !== null && f.later !== null && f.sooner !== f.later ? ` (${when(v.today, f.sooner)} at ${growth + 2}%, ${when(v.today, f.later)} at ${growth - 2}%)` : '';
  return (
    <Widget title="Financial independence" span="all" kind="fx-fire">
      <p class="fx-sub fx-firenote">An estimate from two assumptions below, not advice.</p>
      <p class="fx-firesays">
        <Amount value={f.target} form="whole" /> would be enough: a year's spending of {whole(m.spent * 12)}, drawing {withdraw}% of it a year.
        {' '}The investment and retirement accounts hold {whole(have)}, {Math.round(share)}% of it.
      </p>
      <span class="fx-budgetbar" role="img" aria-label={`${money(have)} of ${money(f.target)}`}><span style={{ width: `${Math.max(share, have > 0 ? 1 : 0)}%` }} /></span>
      <p class="fx-firewhen" role="status">
        {f.months === 0 ? 'There already, at this estimate.'
          : f.months === null ? `Not within a hundred years at ${whole(monthly)} a month put by and ${growth}% growth a year.`
          : <>At {whole(monthly)} a month put by and {growth}% growth a year after rising prices, about {when(v.today, f.months)}{range}.</>}
      </p>
      {keep && <div class="fx-fireset">
        <label>Draw <input inputmode="decimal" aria-label="Share to spend a year, %" value={String(withdraw)} onChange={(e) => set('withdraw', (e.target as HTMLInputElement).value, 0, 20)} />% a year</label>
        <label>Growth <input inputmode="decimal" aria-label="Growth a year after rising prices, %" value={String(growth)} onChange={(e) => set('growth', (e.target as HTMLInputElement).value, -10, 20)} />% a year</label>
        {problem && <span class="formerr bad" role="alert">{problem}</span>}
      </div>}
    </Widget>
  );
}
