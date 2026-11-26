import { CardFigure, Chip } from '../../parts/Card';
import { Amount } from '../ui/Amount';
import { Widget } from '../ui/Widget';
import { inHome } from '../model';
import { dayShort, money, plural } from '../money';

export function ThisMonthWidget({ v, ledger }: { v: finance.View; ledger: finance.Ledger | null }) {
  if (!ledger) return null;
  const all = ledger.transactions;
  // What each came to in the plan's currency, so the totals add up (an account may keep another).
  const home = new Map(inHome(v.plan, all).map((t) => [t.id, t.amount]));
  const amt = (t: finance.Transaction) => home.get(t.id) ?? t.amount;
  const now = v.today.slice(0, 7);
  const thisMonth = all.filter((t) => t.date.startsWith(now) && !t.to);
  const sum = (f: (t: finance.Transaction) => boolean) => thisMonth.filter(f).reduce((s, t) => s + amt(t), 0);
  // Last month to the same day (its last, in a shorter month): what had gone out by then, to set this month's against.
  const lastMonthDay = (() => { const d = new Date(+v.today.slice(0, 4), +v.today.slice(5, 7) - 2, 1); const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(Math.min(end, +v.today.slice(8, 10))).padStart(2, '0')}`; })();
  const before = all.filter((t) => !t.to && t.date.startsWith(lastMonthDay.slice(0, 7)) && t.date <= lastMonthDay);
  const outBefore = -before.filter((t) => t.amount < 0).reduce((s, t) => s + amt(t), 0);
  const outNow = -sum((t) => t.amount < 0);
  const same = Math.abs(outNow - outBefore) < 0.005;
  return (
    <Widget title="This month" span="all" kind="fx-txsum">
      <div class="fx-stats">
        <CardFigure figure={<Amount value={sum((t) => t.amount > 0)} form="whole" tone="in" />} label="Money in" />
        <CardFigure figure={<Amount value={outNow} form="whole" tone="out" />} label="Money out"
          chip={before.length ? <span class="fx-txvs"><Chip dir={same ? 'flat' : outNow > outBefore ? 'up' : 'down'} good={same ? null : outNow < outBefore}
            value={same ? 'the same' : `${outNow > outBefore ? '+' : '−'}${money(Math.abs(outNow - outBefore))}`}
            words={`vs ${dayShort(lastMonthDay)} last month (${money(outBefore)})`} /></span> : undefined} />
        {/* What's kept, as Reports says it, with how many transactions it is. */}
        <CardFigure figure={<Amount value={sum(() => true)} form="whole" sign tone="auto" />} label={`Kept · ${plural(thisMonth.length, 'transaction')}`} />
      </div>
    </Widget>
  );
}
