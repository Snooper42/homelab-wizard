// Net worth, small: today's, its change over the month, and month by
// month (the months ahead hatched), opening the Net worth view. And the
// sidebar's balances: each group of accounts with its total, the way a
// glance at the side of the screen answers "how are we doing", and under
// it each of its accounts with its logo and balance. A group's arrow folds
// its accounts away; which are folded is kept on this device.
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { Amount, Delta, Stat } from '../ui/Amount';
import { AreaChart } from '../ui/charts';
import { Dot } from '../ui/Legend';
import { Widget } from '../ui/Widget';
import { HideAmounts } from '../ui/HideAmounts';
import { grouped, netWorth, worthOf, worthByMonth } from '../model';
import { compact, daysBetween, dayShort, money, tick } from '../money';
import { ago } from '../Worth';
import { useHoverCard } from '../../parts/Hover';
import { AcctMark } from '../Mark';

export function NetWorthWidget({ v, open }: { v: finance.View; open: () => void }) {
  if (!(v.plan.accounts || []).length) return null;
  const now = netWorth(v);
  // Each day kept, ending on today's estimate; and its change over the last month.
  const kept = (v.worth || []).filter((p) => p.date < v.today);
  const values = [...kept.map((p) => p.amount), now];
  const month = worthByMonth(v, 1, 0)[0];
  const each = (v.plan.accounts || []).map((a) => worthOf(v, a));
  const owned = each.filter((n) => n > 0).reduce((t, n) => t + n, 0), owes = -each.filter((n) => n < 0).reduce((t, n) => t + n, 0);
  return (
    <Widget title="Net worth" span="all" kind="fx-worthmini" open={open} openLabel="Open Net worth">
      <Stat value={<Amount value={now} />} caption="Today" aside={month && <Delta value={now - month.net} base={month.net} shareOnly />} />
      {values.length > 2 && <AreaChart values={values} zero={false} axis={false} height={92} fill format={tick}
        xLabels={[{ i: 0, label: dayShort(kept[0]?.date || v.today) }, { i: values.length - 1, label: 'Today' }]}
        label={`Net worth from ${money(values[0])} on ${dayShort(kept[0]?.date || v.today)} to ${money(now)} today.`}
        tip={(i) => <div class="fx-tiphead"><span>{i === values.length - 1 ? 'Today' : dayShort(kept[i].date)}</span><Amount value={values[i]} form="whole" /></div>} />}
      <div class="fx-pair">
        <Stat size="sm" value={<Amount value={owned} form="whole" />} caption="Owned" />
        <Stat size="sm" value={<Amount value={owes} form="whole" />} caption="Owed" />
      </div>
    </Widget>
  );
}

/** Where the groups folded away are kept, on this device. */
const foldedKey = 'homelab.finances.foldedGroups';
const readFolded = (): string[] => { try { return JSON.parse(localStorage.getItem(foldedKey) || '[]') || []; } catch { return []; } };

/**
 * The sidebar's balances, on every screen: each group and its total, and
 * under it its accounts, each with its logo and balance; picking a group or
 * an account opens Finances › Net worth on that group. Each group's arrow
 * folds its accounts away, and it stays folded.
 */
function Balances({ v, open, toggle }: { v: finance.View; open: (group: string) => void; toggle?: () => void }) {
  const [folded, setFolded] = useState(readFolded);
  const list = grouped(v);
  if (!list.length) return null;
  const fold = (key: string) => {
    const next = folded.includes(key) ? folded.filter((k) => k !== key) : [...folded, key];
    setFolded(next);
    try { localStorage.setItem(foldedKey, JSON.stringify(next)); } catch { /* not kept: open again next time */ }
  };
  return (
    <div class="fx-balances" role="group" aria-label="Balances">
      <div class="fx-caption fx-balhead">Accounts{toggle && <HideAmounts small hidden={!!v.plan.hideAmounts} toggle={toggle} />}</div>
      {list.map((g) => {
        const shut = folded.includes(g.key);
        const stale = (a: finance.Account) => { const d = updatedOn(a); return !!d && daysBetween(d, v.today) > staleDays; };
        return (
          <div key={g.key} class="fx-balgroup">
            <div class="fx-balrow">
              <button type="button" class="fx-balfold" aria-expanded={!shut} aria-label={`${g.name}'s accounts`} title={shut ? `Show ${g.name}'s accounts` : `Hide ${g.name}'s accounts`} onClick={() => fold(g.key)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
              </button>
              <Balance v={v} g={g} open={open} />
            </div>
            {!shut && <ul class="fx-balaccts" aria-label={`${g.name}'s accounts`}>
              {g.accounts.map((a) => (
                <li key={a.id}>
                  <button type="button" class="fx-balacct" title={a.name} onClick={() => open(g.key)}>
                    <AcctMark a={a} size="sm" />
                    <span class="fx-balname">{stale(a) && <span class="fx-staledot" aria-label="over a month since it was updated" />}<span>{a.name}</span></span>
                    <Amount value={worthOf(v, a)} form="compact" tone={worthOf(v, a) < 0 ? 'out' : ''} />
                  </button>
                </li>
              ))}
            </ul>}
          </div>
        );
      })}
      <div class="fx-balance total"><span class="fx-legendlabel">Net worth</span><span class="fx-amount">{compact(netWorth(v))}</span></div>
    </div>
  );
}

/** When an account was last typed in: its own date, else its last kept balance's. */
const updatedOn = (a: finance.Account): string | undefined => a.updated || (a.history || []).at(-1)?.date;

/** Older than this (days), an account's balance is marked on the hover. */
export const staleDays = 30;

/** A group's accounts on hover: each with its balance and how long since it was updated, a dot on one older than a month. */
export function GroupAccounts({ v, accounts }: { v: finance.View; accounts: finance.Account[] }) {
  const stale = (a: finance.Account) => { const d = updatedOn(a); return !!d && daysBetween(d, v.today) > staleDays; };
  const old = accounts.filter(stale);
  return (
    <>
      <span class="fx-hoveraccts">
        {accounts.map((a) => {
          const d = updatedOn(a), late = stale(a);
          return (
            <span key={a.id} class={'fx-hoveracct' + (late ? ' stale' : '')}>
              <span class="fx-hovername">{late && <span class="fx-staledot" aria-hidden="true" />}{a.name}</span>
              <Amount value={worthOf(v, a)} form="whole" />
              <span class="fx-hoverwhen">{ago(d, v.today)}{late ? ', over a month ago' : ''}</span>
            </span>
          );
        })}
      </span>
      {!!old.length && <span class="outfoot">{old.length === 1 ? 'One is' : `${old.length} are`} over a month old: Update balances on Finances</span>}
    </>
  );
}

/** One group in the sidebar: a click opens Net worth on it; resting on it, or Tab, shows its accounts. */
function Balance({ v, g, open }: { v: finance.View; g: ReturnType<typeof grouped>[number]; open: (group: string) => void }) {
  const { on, card } = useHoverCard<HTMLButtonElement>(<GroupAccounts v={v} accounts={g.accounts} />, { side: 'right' });
  return (
    <>
      <button type="button" class="fx-balance" {...on} onClick={() => open(g.key)}>
        <Dot color={g.color} />
        <span class="fx-legendlabel">{g.name}</span>
        <Amount value={g.total} form="compact" tone={g.total < 0 ? 'out' : ''} />
      </button>
      {card}
    </>
  );
}

export function mountBalances(el: Element, v: finance.View | null, open: (group: string) => void, toggle?: () => void) {
  render(v ? <Balances v={v} open={open} toggle={toggle} /> : null, el);
}
