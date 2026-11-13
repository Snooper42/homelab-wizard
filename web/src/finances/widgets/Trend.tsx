// Looking back (Finances Step 5, the owner's yes Nov 12): an account at each
// day's end over the last 30 or 90 days or a year, checking first, as its
// own page draws it; another account picked from the list. A day clicked
// opens it on the calendar (what happened that day); the title opens the
// account's page. With no account to look back at, no card.
import { useState } from 'preact/hooks';
import { Segmented } from '../../parts/Segmented';
import { Amount, Stat } from '../ui/Amount';
import { AreaChart } from '../ui/charts';
import { Widget } from '../ui/Widget';
import { spans } from '../Account';
import { balanceSeries } from '../model';
import { compact, dayShort, money } from '../money';

export function TrendWidget({ v, ledger, openDay, openAccount }: { v: finance.View; ledger?: finance.Ledger | null;
  /** The calendar on a day. */ openDay?: (day: string) => void;
  /** An account's own page. */ openAccount?: (id: string) => void }) {
  const accounts = (v.plan.accounts || []).filter((a) => a.updated);
  const [span, setSpan] = useState('90');
  const [picked, setPicked] = useState('');
  const a = accounts.find((x) => x.id === picked) || accounts.find((x) => x.id === v.checking) || accounts[0];
  if (!a) return null;
  const [, words, days] = spans.find(([k]) => k === span)!;
  const { steps, values, runs } = balanceSeries(v, a, ledger?.transactions || [], days);
  const low = values.reduce((m, x, i) => (x < values[m] ? i : m), 0);
  const last = values[values.length - 1];
  const change = last - values[0];
  const when = days === 365 ? 'last year' : `last ${words}`;
  return (
    <Widget title={`${a.name}, ${when}`} span="all" kind="fx-trend" open={openAccount && (() => openAccount(a.id))} openLabel={`Open ${a.name}'s page`}
      actions={<>
        {accounts.length > 1 && <select class="finpick" aria-label="Account" value={a.id} onChange={(e) => setPicked((e.target as HTMLSelectElement).value)}>{accounts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
        <Segmented label="How far back" value={span} pick={setSpan} options={spans.map(([k, t]) => [k, t] as [string, string])} />
      </>}>
      <Stat value={<Amount value={last} />} caption="Today"
        aside={<div class="fx-right"><Amount value={change} sign tone="auto" form="full" /><div class="fx-sub">since {dayShort(steps[0])}</div></div>} />
      <AreaChart values={values} xLabels={[0, Math.round(days / 2), days].map((i) => ({ i, label: i === days ? 'Today' : dayShort(steps[i]) }))} zero={false} height={200} format={compact}
        onPick={openDay && ((i) => openDay(steps[i]))}
        label={`${a.name} at the end of each day over the ${when}: lowest ${money(values[low])} on ${dayShort(steps[low])}${openDay ? '. A day clicked opens it on the calendar' : ''}, ${money(last)} today`}
        tip={(i) => <><strong>{dayShort(steps[i])}</strong><br />{money(values[i])}</>} />
      <p class="fx-sub">{runs ? `Lowest ${money(values[low])}, ${dayShort(steps[low])}. Worked from the balance typed in ${dayShort(a.updated!)} through its transactions.` : 'From the balances typed in over time.'}</p>
    </Widget>
  );
}
