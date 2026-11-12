// The period the Dashboard shows, picked once at its top: the period's name
// and days, ‹ and › to step from paycheck to paycheck, and Today to come
// back. Every card under it that is about a period follows it (the
// paycheck's accounts and payments, the checking chart's shaded days), so
// none has a picker of its own.
import { Card } from '../../parts/Card';
import { IconButton } from '../ui/Widget';
import { periodTitle } from './Paycheck';
import { dayShort, type Lookup } from '../money';

export function PeriodBar({ v, L, sel, pick }: { v: finance.View; L: Lookup; sel: number; pick: (i: number) => void }) {
  const i = Math.min(sel, v.periods.length - 1);
  const p = v.periods[i];
  if (!p) return null;
  return (
    <Card kind="fx-periodbar" id="finPeriod">
      <IconButton icon="prev" label="The pay period before" disabled={i === 0} onClick={() => pick(i - 1)} />
      <div class="fx-periodname" aria-live="polite">
        <h2>{periodTitle(p, L)}</h2>
        <p class="fx-sub fx-dates">{dayShort(p.start)} – {dayShort(p.last)}{p.now ? ', from today' : ''}</p>
      </div>
      <IconButton icon="next" label="The pay period after" disabled={i >= v.periods.length - 1} onClick={() => pick(i + 1)} />
      <button type="button" class="small" disabled={i === 0} onClick={() => pick(0)}>Today</button>
    </Card>
  );
}
