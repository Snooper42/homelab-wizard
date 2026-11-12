// The period the Dashboard shows, picked once at its top: the period's name
// and days, ‹ and › to step from paycheck to paycheck, and Today to come
// back. Every card under it that is about a period follows it (the
// paycheck's accounts and payments, the checking chart's shaded days, and
// for a period before now what happened in it), so none has a picker of
// its own. Ahead of now a period is the plan's (View.periods); before now,
// one of the paydays the computer kept (View.before), read from the ledger.
// The pick is an index: 0 is now, 1 and on the paychecks ahead, -1 and
// below the periods before now, the newest first.
import { Card } from '../../parts/Card';
import { IconButton } from '../ui/Widget';
import { paydayTitle, periodTitle } from './Paycheck';
import type { PastPeriod } from '../model';
import { dayShort, type Lookup } from '../money';

/** The pick, kept within the periods there are, before now and ahead. */
export const pickedOf = (v: finance.View, past: PastPeriod[], sel: number): number => Math.max(-past.length, Math.min(sel, v.periods.length - 1));

export function PeriodBar({ v, L, past, sel, pick }: { v: finance.View; L: Lookup; past: PastPeriod[]; sel: number; pick: (i: number) => void }) {
  const i = pickedOf(v, past, sel);
  const p = i >= 0 ? v.periods[i] : undefined, was = i < 0 ? past[-i - 1] : undefined;
  if (!p && !was) return null;
  return (
    <Card kind="fx-periodbar" id="finPeriod">
      <IconButton icon="prev" label="The pay period before" disabled={i <= -past.length} onClick={() => pick(i - 1)} />
      <div class="fx-periodname" aria-live="polite">
        <h2>{p ? periodTitle(p, L) : paydayTitle(was!.pay, L)}</h2>
        <p class="fx-sub fx-dates">{p ? `${dayShort(p.start)} – ${dayShort(p.last)}${p.now ? ', from today' : ''}` : `${dayShort(was!.start)} – ${dayShort(was!.last)}, what happened`}</p>
      </div>
      <IconButton icon="next" label="The pay period after" disabled={i >= v.periods.length - 1} onClick={() => pick(i + 1)} />
      <button type="button" class="small" disabled={i === 0} onClick={() => pick(0)}>Today</button>
    </Card>
  );
}
