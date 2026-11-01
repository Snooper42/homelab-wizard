// The homelab doing a paid service's job: each payment still in the plan
// that an app running here stands in for ("Jellyfin is running: Netflix
// still costs $239.88 a year"), with Cancelled it where Finances may be
// changed, which takes the payment out and keeps it among those cancelled
// because of the homelab; under them, what those come to a year.
import { Row, Rows } from '../../parts/Row';
import { Amount } from '../ui/Amount';
import { Widget } from '../ui/Widget';
import { PayMark } from '../Mark';
import { type Replaced } from '../homelab';
import { money, perMonth, todayISO } from '../money';

/** "Jellyfin", "Jellyfin and Plex", "A, B, and C". */
const and = (names: string[]) => (names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`);

export function HomelabWidget({ v, replaced, keep }: { v: finance.View; replaced: Replaced[]; keep?: (plan: finance.Plan) => Promise<boolean> }) {
  const cancelled = v.plan.cancelled || [];
  if (!replaced.length && !cancelled.length) return null;
  const year = (x: finance.Payment) => x.amount * perMonth(x.schedule, v.plan.people, v.checking) * 12;
  const total = cancelled.reduce((t, c) => t + c.annual, 0);
  const cancel = (r: Replaced) => keep!({
    ...v.plan,
    payments: (v.plan.payments || []).filter((x) => x.id !== r.payment.id),
    cancelled: [...cancelled, { name: r.payment.name, annual: Math.round(year(r.payment) * 100) / 100, date: todayISO(), because: and(r.apps) }],
  });
  return (
    <Widget title="Your homelab does this now" span="all" kind="fx-homelab">
      {!!replaced.length && <Rows kind="fx-rows">
        {replaced.map((r) => (
          <Row key={r.payment.id} lead={<PayMark x={r.payment} />} title={r.payment.name}
            sub={`${and(r.apps)} ${r.apps.length > 1 ? 'are' : 'is'} running: ${r.payment.name} still costs ${money(year(r.payment))} a year`}
            end={keep && <button type="button" class="small" onClick={() => cancel(r)}>Cancelled it</button>}
            when={<Amount value={year(r.payment)} form="full" />} whenPlain />
        ))}
      </Rows>}
      {!!cancelled.length && <p class="fx-sub fx-cancelled">Cancelled because of the homelab: <strong>{money(total)} a year</strong> ({cancelled.map((c) => c.name).join(', ')}).</p>}
    </Widget>
  );
}
