import { Chip } from '../../parts/Card';
import { Row, Rows } from '../../parts/Row';
import { Amount } from '../ui/Amount';
import { Widget } from '../ui/Widget';
import { AcctMark } from '../Mark';
import { todayOf, worthOn } from '../model';
import { amountsHidden } from '../money';

const kinds = ['investment', 'retirement'];

/** "+3.1%" from what it was to what it is; "" when there was nothing to grow from. */
const share = (was: number, now: number) => (Math.abs(was) < 0.005 ? '' : `${now >= was ? '+' : '−'}${Math.abs(((now - was) / Math.abs(was)) * 100).toFixed(1)}%`);

export function InvestSummaryWidget({ v, open, openAccount }: { v: finance.View; open?: () => void; openAccount?: (id: string) => void }) {
  const first = v.today.slice(0, 8) + '01';
  const accounts = (v.plan.accounts || []).filter((a) => kinds.includes(a.kind)).map((a) => ({ a, now: todayOf(v, a), was: worthOn(v, a, first) })).sort((x, y) => y.now - x.now);
  if (!accounts.length) return null;
  const total = accounts.reduce((t, x) => t + x.now, 0), before = accounts.reduce((t, x) => t + x.was, 0);
  const month = share(before, total);
  const chip = month && !amountsHidden() && <Chip dir={total > before + 0.005 ? 'up' : total < before - 0.005 ? 'down' : 'flat'} good={Math.abs(total - before) < 0.005 ? null : total > before} value={month} words="this month" />;
  return (
    <Widget title="Investments" kind="fx-investsum" open={open} openLabel="Open Net worth's investments"
      figure={<Amount value={total} />} label={accounts.length === 1 ? 'One account' : `${accounts.length} accounts`} chip={chip || undefined}>
      <Rows kind="fx-rows">
        {accounts.map(({ a, now, was }) => <Row key={a.id} lead={<AcctMark a={a} size="sm" />} title={a.name}
          when={<span class="fx-whenstack"><Amount value={now} form="full" />{share(was, now) && !amountsHidden() && <span class={'fx-sub ' + (now >= was ? 'fx-in' : 'fx-out')}>{share(was, now)}</span>}</span>} whenPlain onOpen={openAccount && (() => openAccount(a.id))} openLabel={openAccount ? 'open' : undefined} />)}
      </Rows>
    </Widget>
  );
}
