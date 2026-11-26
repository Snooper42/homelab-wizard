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
  title: string;
  dates: string;
  step: (d: -1 | 1) => void;
  canBack: boolean;
  canOn: boolean;
  today: () => void;
  atToday: boolean;
  /** In the computer's top bar: part of the bar, not a card of its own. */
  bare?: boolean;
}

/** The bar's box: a card on its own (the phone), or a plain part of the computer's top bar. */
function Box({ bare, children }: { bare?: boolean; children: preact.ComponentChildren }) {
  return bare ? <div class="fx-periodbar" id="finPeriod">{children}</div> : <Card kind="fx-periodbar" id="finPeriod">{children}</Card>;
}

export function PeriodBar({ by, setBy, title, dates, step, canBack, canOn, today, atToday, bare }: PeriodBarProps) {
  const unit = by === 'month' ? 'month' : 'pay period';
  return (
    <Box bare={bare}>
      <Segmented label="Show the Dashboard by" value={by} pick={(b) => setBy(b as PeriodBy)} options={[['pay', 'Paycheck'], ['month', 'Month']]} />
      {/* Back, the name and forward kept on one line, the name wrapping between them (usability task 15, item 4). */}
      <div class="fx-periodstep">
        <IconButton icon="prev" label={`The ${unit} before`} disabled={!canBack} onClick={() => step(-1)} />
        <div class="fx-periodname" aria-live="polite">
          <h2>{title}</h2>
          <p class="fx-sub fx-dates">{dates}</p>
        </div>
        <IconButton icon="next" label={`The ${unit} after`} disabled={!canOn} onClick={() => step(1)} />
      </div>
      <button type="button" class="small" disabled={atToday} onClick={today}>Today</button>
    </Box>
  );
}
