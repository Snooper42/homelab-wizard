// Finances › Net worth › Investments: what each investment account holds,
// as Ghostfolio (the homelab's own investment tracker) last read it, kept
// in the plan so it shows with Ghostfolio stopped and on a phone. Four
// figures (what it is worth, what went in, the gain, this month's change),
// how it splits by account, and a row a holding, each opening its worth at
// each read. Read now reads Ghostfolio again, on the computer only; after
// the first, Finances reads it once a day on opening, unless turned off.
import { useState } from 'preact/hooks';
import { AreaChart } from '../ui/charts';
import { Amount } from '../ui/Amount';
import { type Hue, Legend, SplitBar } from '../ui/Legend';
import { Widget } from '../ui/Widget';
import { Mark } from '../Mark';
import { tickerBrand } from '../tickers';
import { rateOf, worthOf, worthOn } from '../model';
import { amountsHidden, dayShort, isoDay, money, moneyIn, tick } from '../money';

/** What Read now is doing, or last said. */
export interface InvestState {
  busy?: boolean;
  /** When it read, in words, or why it could not. */
  said?: string;
  problem?: string;
  /** Ghostfolio's accounts no account here matched. */
  unmatched?: string[];
}

export interface InvestmentsProps {
  v: finance.View;
  /** Reads Ghostfolio now: on the computer only. */
  read?: () => void;
  /** Whether Ghostfolio runs here (Status): the card offers a first read only then. */
  running?: boolean;
  state?: InvestState;
  /** Keeps the plan (a match picked by hand, the morning's read on or off); none on a phone allowed only to look. */
  keep?: (plan: finance.Plan) => Promise<boolean>;
}

/** "read 7:02 AM today", "read yesterday at 7:02 AM", "read Nov 2". */
export function readWhen(at: string | undefined, today: string): string {
  if (!at) return '';
  const d = new Date(at);
  if (isNaN(d.getTime())) return '';
  const day = isoDay(d);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const y = new Date(today + 'T12:00:00');
  y.setDate(y.getDate() - 1);
  const yesterday = isoDay(y);
  return day === today ? `read ${time} today` : day === yesterday ? `read yesterday at ${time}` : `read ${dayShort(day)}`;
}

/** +24.4%, −3.1%; nothing without what went in. */
const share = (gain: number, paid: number) => (Math.abs(paid) < 0.005 ? '' : `${gain < 0 ? '−' : '+'}${Math.abs((gain / Math.abs(paid)) * 100).toFixed(1)}%`);

/** Shares as people write them: 92.4, 120, 0.0521. */
const shares = (n: number) => (amountsHidden() ? '•••' : n.toLocaleString('en-US', { maximumFractionDigits: n < 1 ? 4 : 3 }));

interface Line {
  key: string;
  account: finance.Account;
  hue: Hue;
  h?: finance.Holding;
  /** Cash: what the account holds besides its holdings. */
  cash?: number;
}

export function InvestmentsWidget({ v, read, running, state = {}, keep }: InvestmentsProps) {
  const [open, setOpen] = useState('');
  const accounts = (v.plan.accounts || []).filter((a) => a.holdings?.length);
  const ever = !!v.plan.holdingsRead;
  // Never read: a first read is offered on the computer while Ghostfolio runs; otherwise nothing is shown.
  if (!accounts.length && !(read && (running || ever))) return null;
  const when = readWhen(v.plan.holdingsRead, v.today);
  const button = read && <button type="button" class="small" disabled={state.busy} onClick={read}>{state.busy ? 'Reading…' : 'Read now'}</button>;
  const said = <>
    {state.said && <p class="fx-sub fx-investsaid" role="status">{state.said}</p>}
    {state.problem && <p class="formerr bad fx-investsaid" role="alert">{state.problem}</p>}
  </>;
  if (!accounts.length) {
    return (
      <Widget title="Investments" span="all" kind="fx-invest" actions={button}>
        <p class="fx-sub fx-investintro">{ever
          ? 'Nothing in Ghostfolio matched an investment or retirement account here yet.'
          : 'Read what each of your investment accounts holds from Ghostfolio, the investment tracker on your homelab: each fund and share, what went in, and what it is worth now. Only ticker symbols leave the homelab, when Ghostfolio looks prices up; amounts and accounts stay here.'}</p>
        {said}
        <Unmatched v={v} state={state} keep={keep} read={read} />
      </Widget>
    );
  }
  // Largest account first, its holdings largest first, then its cash.
  const own = (a: finance.Account) => worthOf(v, a);
  accounts.sort((a, b) => own(b) - own(a));
  const lines: Line[] = accounts.flatMap((a, i) => {
    const hue = ((i % 7) + 1) as Hue;
    const held = [...a.holdings!].sort((x, y) => y.value - x.value);
    const cash = Math.round((a.balance - held.reduce((t, h) => t + h.value, 0)) * 100) / 100;
    return [...held.map((h) => ({ key: a.id + ':' + h.symbol, account: a, hue, h })), ...(cash >= 0.01 ? [{ key: a.id + ':cash', account: a, hue, cash }] : [])];
  });
  // In the plan's currency: an account kept in another, at its rate.
  const inHome = (l: Line, n: number) => n * rateOf(v.plan, l.account);
  const total = accounts.reduce((t, a) => t + own(a), 0);
  const paid = lines.reduce((t, l) => t + inHome(l, l.h ? l.h.paid : l.cash!), 0);
  const gain = total - paid;
  const first = v.today.slice(0, 8) + '01';
  const month = accounts.reduce((t, a) => t + own(a) - worthOn(v, a, first), 0);
  const before = total - month;
  const holdings = lines.filter((l) => l.h).length;
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  return (
    <Widget title={<>Investments <span class="fx-sub">from Ghostfolio{when ? `, ${when}` : ''}</span></>} span="all" kind="fx-invest" actions={button}>
      {said}
      <div class="fx-investfigs">
        <div><div class="fx-caption">Total value</div><div class="fx-investfig"><Amount value={total} form="full" /></div><div class="fx-sub">{n(holdings, 'holding', 'holdings')} in {n(accounts.length, 'account', 'accounts')}</div></div>
        <div><div class="fx-caption">You paid</div><div class="fx-investfig"><Amount value={paid} form="full" /></div><div class="fx-sub">what went in</div></div>
        <div><div class="fx-caption">Gain</div><div class="fx-investfig"><Amount value={gain} form="full" sign tone="auto" /></div><div class="fx-sub">{amountsHidden() ? 'on what you paid' : `${share(gain, paid)} on what you paid`}</div></div>
        <div><div class="fx-caption">This month</div><div class="fx-investfig"><Amount value={month} form="full" sign tone="auto" /></div><div class="fx-sub">{amountsHidden() ? '' : share(month, before) + ' '}since {dayShort(first)}</div></div>
      </div>
      {accounts.length > 1 && <>
        <SplitBar label="What each account holds" parts={accounts.map((a, i) => ({ label: a.name, value: own(a), color: ((i % 7) + 1) as Hue }))} />
        <Legend layout="inline" items={accounts.map((a, i) => ({ label: a.name, color: ((i % 7) + 1) as Hue, value: <Amount value={own(a)} form="whole" /> }))} />
      </>}
      <table class="fx-holdings">
        <thead><tr><th scope="col">Holding</th><th scope="col" class="n">Shares</th><th scope="col" class="n">You paid</th><th scope="col" class="n">Worth now</th><th scope="col" class="n">Gain</th></tr></thead>
        {lines.map((l) => <HoldingRow key={l.key} v={v} l={l} open={open === l.key} toggle={() => setOpen(open === l.key ? '' : l.key)} />)}
      </table>
      <Unmatched v={v} state={state} keep={keep} read={read} />
      {keep && read && (
        <label class="fx-investauto">
          <input type="checkbox" checked={!v.plan.readByHand} onChange={(e) => keep({ ...v.plan, readByHand: (e.target as HTMLInputElement).checked ? undefined : true })} />
          Read Ghostfolio once a day when Finances opens
        </label>
      )}
    </Widget>
  );
}

/** A holding's row (or an account's cash), and under it, when open, its worth at each read. */
function HoldingRow({ v, l, open, toggle }: { v: finance.View; l: Line; open: boolean; toggle: () => void }) {
  const a = l.account, cur = a.currency;
  const symbol = l.h ? l.h.symbol : 'Cash';
  const name = l.h ? l.h.name || l.h.symbol : 'Not in a holding';
  const paid = l.h ? l.h.paid : l.cash!, worth = l.h ? l.h.value : l.cash!;
  const gain = worth - paid;
  const id = 'hold-' + l.key.replace(/[^A-Za-z0-9]+/g, '-');
  const mark = l.h ? <Mark brand={tickerBrand(l.h.symbol)} name={l.h.symbol} auto size="sm" /> : <Mark name="Cash" auto size="sm" />;
  const who = <span class="fx-holdwho"><strong>{symbol}</strong><small>{l.h ? `${name} · ` : ''}{a.name}</small></span>;
  return (
    <tbody class={'fx-hold' + (open ? ' open' : '')}>
      <tr onClick={l.h ? toggle : undefined}>
        <th scope="row">{l.h
          ? <button type="button" class="fx-holdbtn" aria-expanded={open} aria-controls={id} onClick={(e) => { e.stopPropagation(); toggle(); }}>{mark}{who}</button>
          : <span class="fx-holdbtn">{mark}{who}</span>}
        </th>
        <td class="n fx-holdshares">{l.h ? shares(l.h.shares) : ''}</td>
        <td class="n fx-holdpaid"><span class="fx-holdunit">{l.h ? `${shares(l.h.shares)} shares · ` : ''}paid </span><Amount value={paid} form="full" currency={cur} /></td>
        <td class="n fx-holdworth"><Amount value={worth} form="full" currency={cur} /></td>
        <td class="n fx-holdgain">{l.h && <><Amount value={gain} form="full" sign tone="auto" currency={cur} />{!amountsHidden() && <span class="fx-sub"> {share(gain, paid)}</span>}</>}</td>
      </tr>
      {l.h && open && <tr class="fx-holddetail" id={id}><td colSpan={5}><HoldingHistory v={v} h={l.h} cur={cur} /></td></tr>}
    </tbody>
  );
}

/** A holding's worth at each read, and what a share is worth against what one cost. */
function HoldingHistory({ v, h, cur }: { v: finance.View; h: finance.Holding; cur?: string }) {
  const pts = h.history || [];
  const each = (n: number) => (h.shares > 0 ? (amountsHidden() ? money(0) : moneyIn(n / h.shares, cur)) : '');
  const facts = h.shares > 0 ? <p class="fx-sub">A share is worth {each(h.value)} now; they cost {each(h.paid)} each on average.</p> : null;
  if (pts.length < 2) {
    return <div class="fx-holdhist">{facts}<p class="fx-sub">{pts.length ? `Read once so far, on ${dayShort(pts[0].date)}.` : 'Not read yet.'} Each read from now on adds its day here.</p></div>;
  }
  return (
    <div class="fx-holdhist">
      {facts}
      <AreaChart values={pts.map((p) => p.amount)} xLabels={[{ i: 0, label: dayShort(pts[0].date) }, { i: pts.length - 1, label: dayShort(pts[pts.length - 1].date) }]} format={tick} height={140} zero={false}
        label={`${h.symbol} at each read: ${pts.map((p) => `${dayShort(p.date)} ${moneyIn(p.amount, cur)}`).join(', ')}.`}
        tip={(i) => <><div class="fx-caption">{pts[i].date === v.today ? 'Today' : dayShort(pts[i].date)}</div><div class="fx-tiptotal"><span>{h.symbol}</span><Amount value={pts[i].amount} form="full" currency={cur} /></div></>} />
    </div>
  );
}

/** Ghostfolio's accounts nothing here matched, each to match by hand: to an account, or as a new one; then read again. */
function Unmatched({ v, state, keep, read }: { v: finance.View; state: InvestState; keep?: InvestmentsProps['keep']; read?: () => void }) {
  const left = state.unmatched || [];
  if (!left.length || !keep || !read) return null;
  const free = (v.plan.accounts || []).filter((a) => (a.kind === 'investment' || a.kind === 'retirement') && !a.ghostfolio);
  const pick = async (name: string, to: string) => {
    if (!to) return;
    const plan = v.plan;
    const accounts = to === 'new'
      ? [...(plan.accounts || []), { id: '', name, kind: 'investment', balance: 0, ghostfolio: name }]
      : (plan.accounts || []).map((a) => (a.id === to ? { ...a, ghostfolio: name } : a));
    if (await keep({ ...plan, accounts })) read();
  };
  return (
    <div class="fx-investleft">
      <p class="fx-sub">Not matched to an account here yet, so not shown: pick which account each is.</p>
      <ul>
        {left.map((name) => (
          <li key={name}>
            <label><strong>{name}</strong> in Ghostfolio is
              <select disabled={state.busy} onChange={(e) => pick(name, (e.target as HTMLSelectElement).value)}>
                <option value="">Pick an account…</option>
                {free.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                <option value="new">A new account, “{name}”</option>
              </select>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
