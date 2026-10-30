// The Finances screen: its heading, the four views (Overview, Recurring,
// Pay, Net worth), and the one shown. screens/finances.ts reads the plan,
// keeps it, and opens the sheet; this only draws.
import { render } from 'preact';
import { Segmented } from '../parts/Segmented';
import { Empty } from '../parts/Empty';
import type { What } from './Edit';
import { NetWorth, Pay, Recurring } from './Lists';
import { daysBetween, dayShort, lookup } from './money';
import { Overview, type OverviewProps } from './Overview';

export interface FinancesProps {
  /** The plan read forward; null until it is read. */
  v: finance.View | null;
  /** Why it could not be read, and reading it again. */
  error?: string;
  retry: () => void;
  tab: string;
  setTab: (tab: string) => void;
  sel: number;
  pick: (i: number) => void;
  saveBalances: OverviewProps['saveBalances'];
  edit: (what: What, id?: string) => void;
}

const tabs: [string, string][] = [['overview', 'Overview'], ['recurring', 'Recurring'], ['pay', 'Pay'], ['worth', 'Net worth']];
const adds: Record<string, [What, string]> = { overview: ['payment', 'Add a payment'], recurring: ['payment', 'Add a payment'], pay: ['person', 'Add a paycheck'], worth: ['account', 'Add an account'] };

function FinancesScreen({ v, error, retry, tab, setTab, sel, pick, saveBalances, edit }: FinancesProps) {
  const L = v ? lookup(v.plan) : null;
  const [what, label] = adds[tab] || adds.overview;
  // Every number reads from the balances typed in: a week old, they say so.
  const age = v?.plan.updated ? daysBetween(v.plan.updated, v.today) : -1;
  const lead = age < 0 ? 'Typed in by you, kept on this machine'
    : age === 0 ? 'Balances from today' : `Balances from ${dayShort(v.plan.updated)}` + (age >= 7 ? `, ${age} days ago: update them with Edit` : '');
  return (
    <>
      <div class="row header">
        <div><h1>Finances</h1><p class={'lead' + (age >= 7 ? ' warn' : '')}>{lead}</p></div>
        <div class="toolbar"><button class="btn" onClick={() => edit(what)} disabled={!v}>{label}</button></div>
      </div>
      <Segmented label="View" value={tab} pick={setTab} options={tabs} />
      <div class="finbody">
        {!v && error ? <Empty>The finances file could not be read: {error} <button class="small" onClick={retry}>Try again</button></Empty>
          : !v ? <Empty>Reading…</Empty>
          : tab === 'recurring' ? <Recurring v={v} L={L} edit={edit} />
          : tab === 'pay' ? <Pay v={v} L={L} edit={edit} />
          : tab === 'worth' ? <NetWorth v={v} L={L} edit={edit} />
          : <Overview v={v} L={L} sel={sel} pick={pick} saveBalances={saveBalances} add={(w) => edit(w)} />}
      </div>
    </>
  );
}

export function mountFinances(el: Element, props: FinancesProps) { render(<FinancesScreen {...props} />, el); }
