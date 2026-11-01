// Goals: money put by for something, from shares of the accounts (it never
// moves money). Each with a bar of what is saved against its target, what
// is left, what it needs a month and a paycheck to be there by its day,
// and the pace the accounts have kept, with the month that pace reaches it:
// in amber when that is after its day. Edit opens a goal's form; Add a
// goal a new one; none yet, it says what they are for.
import { Empty } from '../../parts/Empty';
import { Row, Rows } from '../../parts/Row';
import { Amount } from '../ui/Amount';
import { Widget } from '../ui/Widget';
import { dayShort, money, monthName } from '../money';

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

export function GoalsWidget({ v, edit }: { v: finance.View; edit?: (what: 'goal', id?: string) => void }) {
  const goals = v.goals || [];
  return (
    <Widget title="Goals" span="all" kind="fx-goals" actions={edit && <button type="button" class="small" onClick={() => edit('goal')}>Add a goal</button>}>
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
    </Widget>
  );
}
