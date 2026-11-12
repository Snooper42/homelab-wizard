// The period the Dashboard shows, picked once at its top: by paycheck or by
// month, the period's name and days, ‹ and › to step, and Today to come
// back. Every card under it that is about a period follows it (the
// paycheck's accounts and payments, the checking chart's shaded days,
// what happened in a period before now, the plan for a month ahead), so
// none has a picker of its own. By paycheck, ahead of now a period is the
// plan's (View.periods) and before now one of the paydays the computer
// kept (View.before), read from the ledger: the pick is an index, 0 now, 1
// and on the paychecks ahead, -1 and below the periods before now. By
// month, the months monthPeriods gives. Overview works out which; this
// only draws it.
import { Card } from '../../parts/Card';
import { Segmented } from '../../parts/Segmented';
import { IconButton } from '../ui/Widget';
import type { PastPeriod } from '../model';

/** By paycheck or by month, kept on this device. */
export type PeriodBy = 'pay' | 'month';
const byKey = 'homelab.finances.periodBy';
export const readBy = (): PeriodBy => { try { return localStorage.getItem(byKey) === 'month' ? 'month' : 'pay'; } catch { return 'pay'; } };
export const keepBy = (by: PeriodBy) => { try { localStorage.setItem(byKey, by); } catch { /* a private window: this visit only */ } };

/** The pick by paycheck, kept within the periods there are, before now and ahead. */
export const pickedOf = (v: finance.View, past: PastPeriod[], sel: number): number => Math.max(-past.length, Math.min(sel, v.periods.length - 1));

export interface PeriodBarProps {
  by: PeriodBy;
  setBy: (by: PeriodBy) => void;
  /** The period's name ("Alex's paycheck · Fri, Nov 6", "October 2026") and its days, with what it is read from. */
  title: string;
  dates: string;
  step: (d: -1 | 1) => void;
  canBack: boolean;
  canOn: boolean;
  today: () => void;
  atToday: boolean;
}

export function PeriodBar({ by, setBy, title, dates, step, canBack, canOn, today, atToday }: PeriodBarProps) {
  const unit = by === 'month' ? 'month' : 'pay period';
  return (
    <Card kind="fx-periodbar" id="finPeriod">
      <Segmented label="Show the Dashboard by" value={by} pick={(b) => setBy(b as PeriodBy)} options={[['pay', 'By paycheck'], ['month', 'By month']]} />
      <IconButton icon="prev" label={`The ${unit} before`} disabled={!canBack} onClick={() => step(-1)} />
      <div class="fx-periodname" aria-live="polite">
        <h2>{title}</h2>
        <p class="fx-sub fx-dates">{dates}</p>
      </div>
      <IconButton icon="next" label={`The ${unit} after`} disabled={!canOn} onClick={() => step(1)} />
      <button type="button" class="small" disabled={atToday} onClick={today}>Today</button>
    </Card>
  );
}
