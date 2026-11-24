// The Dashboard's Investments card (docs/images/redesign/computer-finances.png;
// redesign-loop R3): what the brokerage, the IRAs and the 401(k) hold
// together today, and each account under it, largest first; the card
// opens Net worth's Investments, a row its account. The picture's chip and
// each account's change this month wait for a month of each account's
// balances (money-loop M6): no figure is made up meanwhile.
import { Row, Rows } from '../../parts/Row';
import { Amount } from '../ui/Amount';
import { Widget } from '../ui/Widget';
import { AcctMark } from '../Mark';
import { todayOf } from '../model';

const kinds = ['investment', 'retirement'];

export function InvestSummaryWidget({ v, open, openAccount }: { v: finance.View; open?: () => void; openAccount?: (id: string) => void }) {
  const accounts = (v.plan.accounts || []).filter((a) => kinds.includes(a.kind)).map((a) => ({ a, now: todayOf(v, a) })).sort((x, y) => y.now - x.now);
  if (!accounts.length) return null;
  const total = accounts.reduce((t, x) => t + x.now, 0);
  return (
    <Widget title="Investments" kind="fx-investsum" open={open} openLabel="Open Net worth's investments"
      figure={<Amount value={total} />} label={accounts.length === 1 ? 'One account' : `${accounts.length} accounts`}>
      <Rows kind="fx-rows">
        {accounts.map(({ a, now }) => <Row key={a.id} lead={<AcctMark a={a} size="sm" />} title={a.name}
          when={<Amount value={now} form="full" />} whenPlain onOpen={openAccount && (() => openAccount(a.id))} openLabel={openAccount ? 'open' : undefined} />)}
      </Rows>
    </Widget>
  );
}
