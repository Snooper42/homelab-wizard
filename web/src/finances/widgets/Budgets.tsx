// Budgets: each category's budget this month (or pay period), from the
// ledger: a bar of what is spent against what it may take, the line where
// an even pace would be by today, and what is left, or how far over. Over
// is in red; ahead of the pace, in amber. Edit budgets opens their form;
// with none yet, it says what they are for.
import { Empty } from '../../parts/Empty';
import { Row, Rows } from '../../parts/Row';
import { Amount } from '../ui/Amount';
import { Widget } from '../ui/Widget';
import { Mark } from '../Mark';
import { iconOf } from '../Transactions';
import { dayShort, money } from '../money';

/** How a budget stands: over, ahead of its pace, or fine. */
export const budgetTone = (b: finance.BudgetNow): 'out' | 'warn' | '' => (b.left < 0 ? 'out' : b.spent > b.pace + 0.005 ? 'warn' : '');

export function BudgetsWidget({ v, edit, only, title = 'Budgets' }: { v: finance.View; edit?: () => void; only?: (b: finance.BudgetNow) => boolean; title?: string }) {
  const list = (v.budgets || []).filter(only || (() => true));
  if (only && !list.length) return null;
  return (
    <Widget title={title} span="all" kind="fx-budgets"
      actions={edit && <button type="button" class="small" onClick={edit}>{v.budgets?.length ? 'Edit budgets' : 'Set budgets'}</button>}>
      {list.length ? <Rows kind="fx-rows">
        {list.map((b) => {
          const tone = budgetTone(b);
          const share = b.amount > 0 ? Math.min(100, (b.spent / b.amount) * 100) : 100;
          const pace = b.amount > 0 ? Math.min(100, (b.pace / b.amount) * 100) : 0;
          const icon = iconOf(v.categories, b.category);
          return <Row key={b.category} lead={<Mark kind={icon} type={icon} name={b.category} />} title={b.category}
            sub={`${b.per === 'paycheck' ? `This pay period, to ${dayShort(b.last)}` : `This month, to ${dayShort(b.last)}`} · ${money(b.spent)} of ${money(b.amount)}${b.rolled ? ` (${b.rolled > 0 ? 'with' : 'less'} ${money(Math.abs(b.rolled))} from last time)` : ''}`}
            when={<span class={'fx-budgetleft' + (tone ? ' fx-' + tone : '')}>{b.left < 0 ? <>{money(-b.left)} over</> : <><Amount value={b.left} form="full" /> left</>}</span>} whenPlain>
            <span class={'fx-budgetbar' + (tone ? ' ' + tone : '')} role="img" aria-label={`${b.category}: ${money(b.spent)} spent of ${money(b.amount)}${tone === 'warn' ? ', ahead of an even pace' : ''}`}>
              <span style={{ width: `${share}%` }} />
              <i style={{ left: `${pace}%` }} />
            </span>
          </Row>;
        })}
      </Rows> : <Empty>{edit ? 'No budgets yet: set how much a category may take a month or a paycheck, and see what is left as you go.' : 'No budgets yet.'}</Empty>}
    </Widget>
  );
}
