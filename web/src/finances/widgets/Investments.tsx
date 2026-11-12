// Finances › Net worth › Investments: what each investment account holds,
// as Ghostfolio (the homelab's own investment tracker) last read it, kept
// in the plan so it shows with Ghostfolio stopped and on a phone. Four
// figures (what it is worth, what went in, the gain, this month's change),
// how it splits by account, and a row a holding, each opening its worth at
// each read. Read now reads Ghostfolio again, on the computer only; after
// the first, Finances reads it once a day on opening, unless turned off.
// Where Finances may be changed, an open holding lists its buys and sales
// as Ghostfolio keeps them, each to put right or delete.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Segmented } from '../../parts/Segmented';
import { AreaChart } from '../ui/charts';
import { Amount } from '../ui/Amount';
import { type Hue } from '../ui/Legend';
import { Spark } from '../../Spark';
import { Widget } from '../ui/Widget';
import { Mark } from '../Mark';
import { Row, Rows } from '../../parts/Row';
import { tickerBrand } from '../tickers';
import { rateOf, worthOf, worthOn } from '../model';
import { amountsHidden, compact, dayShort, isoDay, money, moneyIn, monthName, parseAmount, parseCount, signOf, tick, todayISO } from '../money';

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
  state?: InvestState;
  /** Keeps the plan (a match picked by hand, the morning's read on or off); none on a phone allowed only to look. */
  keep?: (plan: finance.Plan) => Promise<boolean>;
  /** Puts a buy or a sale into Ghostfolio and reads again (throws why not), and looks a ticker up there: wherever Finances may be changed. */
  add?: (x: app.InvestmentAdd) => Promise<void>;
  find?: (query: string) => Promise<app.AppSymbol[]>;
  /** Follows a ticker found (the Watchlist); throws why not. None on a phone allowed only to look. */
  follow?: (s: app.AppSymbol) => Promise<void>;
  /** A holding's buys and sales in Ghostfolio, each to put right or delete (throws why not): wherever Finances may be changed. */
  trades?: TradeOps;
}

/** A holding's buys and sales, as Ghostfolio keeps them: listed, changed, deleted; a change or a delete reads Ghostfolio again. */
export interface TradeOps {
  list: (account: string, symbol: string) => Promise<app.InvestmentTrade[]>;
  change: (t: app.InvestmentTrade) => Promise<void>;
  remove: (t: app.InvestmentTrade) => Promise<void>;
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

export function InvestmentsWidget({ v, read, state = {}, keep, add, find, trades, follow }: InvestmentsProps) {
  const [open, setOpen] = useState('');
  const [adding, setAdding] = useState(false);
  const accounts = (v.plan.accounts || []).filter((a) => a.holdings?.length);
  const ever = !!v.plan.holdingsRead;
  // Never read: a first read is offered wherever one can be made; on a phone allowed only to look, nothing is shown.
  if (!accounts.length && !read) return null;
  const when = readWhen(v.plan.holdingsRead, v.today);
  const canAdd = !!(add && find);
  const button = <>
    {canAdd && !adding && <button type="button" class="small" disabled={state.busy} onClick={() => setAdding(true)}>Add a holding</button>}
    {read && <button type="button" class="small" disabled={state.busy} onClick={read}>{state.busy ? 'Reading…' : 'Read now'}</button>}
  </>;
  const form = adding && add && find && <AddForm v={v} add={add} find={find} close={() => setAdding(false)} />;
  const said = <>
    {state.said && <p class="fx-sub fx-investsaid" role="status">{state.said}</p>}
    {state.problem && <p class="formerr bad fx-investsaid" role="alert">{state.problem}</p>}
  </>;
  if (!accounts.length) {
    return (
      <Widget title="Investments" span="all" kind="fx-invest" actions={button}>
        {form}
        {!form && !(ever && state.said) && <p class="fx-sub fx-investintro">{ever
          ? canAdd ? 'Nothing in Ghostfolio matched an investment or retirement account here yet. Add a holding to put one there.' : 'Nothing in Ghostfolio matched an investment or retirement account here yet.'
          : 'Read what each of your investment accounts holds from Ghostfolio, the investment tracker on your homelab: each fund and share, what went in, and what it is worth now. Only ticker symbols leave the homelab, when Ghostfolio looks prices up; amounts and accounts stay here.'}</p>}
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
  // The first of each of the last twelve months, then today.
  const year = [...Array.from({ length: 12 }, (_, i) => { const d = new Date(+v.today.slice(0, 4), +v.today.slice(5, 7) - 13 + i + 1, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }), v.today];
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  return (
    <Widget title={<>Investments <span class="fx-sub">from Ghostfolio{when ? `, ${when}` : ''}</span></>} span="all" kind="fx-invest" actions={button}>
      {form}
      {said}
      <div class="fx-investfigs">
        <div><div class="fx-caption">Total value</div><div class="fx-investfig"><Amount value={total} form="full" /></div><div class="fx-sub">{n(holdings, 'holding', 'holdings')} in {n(accounts.length, 'account', 'accounts')}</div></div>
        <div><div class="fx-caption">You paid</div><div class="fx-investfig"><Amount value={paid} form="full" /></div><div class="fx-sub">what went in</div></div>
        <div><div class="fx-caption">Gain</div><div class="fx-investfig"><Amount value={gain} form="full" sign tone="auto" /></div><div class="fx-sub">{amountsHidden() ? 'on what you paid' : `${share(gain, paid)} on what you paid`}</div></div>
        <div><div class="fx-caption">This month</div><div class="fx-investfig"><Amount value={month} form="full" sign tone="auto" /></div><div class="fx-sub">{amountsHidden() ? '' : share(month, before) + ' '}since {dayShort(first)}</div></div>
      </div>
      {/* The owner, Nov 12: no bar of what each account holds; the total's worth over the year instead, each holding separate below. */}
      <AreaChart values={year.map((d) => accounts.reduce((t, a) => t + worthOn(v, a, d), 0))} zero={false} height={140} format={compact}
        xLabels={[{ i: 0, label: monthName(year[0]).slice(0, 3) }, { i: 6, label: monthName(year[6]).slice(0, 3) }, { i: 12, label: 'Today' }]}
        label={`Investments' worth over the last year, month by month, to ${money(total)} today`} />
      <table class="fx-holdings">
        <thead><tr><th scope="col">Holding</th><th scope="col" class="n">Shares</th><th scope="col" class="n">Price</th><th scope="col" class="n">You paid</th><th scope="col" class="n">Worth now</th><th scope="col" class="n">Gain</th><th scope="col" class="n">Year</th></tr></thead>
        {lines.map((l) => <HoldingRow key={l.key} v={v} l={l} open={open === l.key} toggle={() => setOpen(open === l.key ? '' : l.key)} trades={trades} />)}
      </table>
      <Watchlist v={v} keep={keep} follow={follow} find={find} />
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

/**
 * The Watchlist (the owner, Nov 12): tickers followed without owning them, each with its price as last read, its change
 * since it was followed, and a line of it; never in the worth above. Follow a ticker looks one up (as Add a holding
 * does) and follows it; Unfollow saves the plan without it. A phone allowed only to look sees the list alone.
 */
function Watchlist({ v, keep, follow, find }: { v: finance.View; keep?: InvestmentsProps['keep']; follow?: InvestmentsProps['follow']; find?: InvestmentsProps['find'] }) {
  const list = v.plan.watch || [];
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<app.AppSymbol[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const can = !!(follow && find);
  if (!list.length && !can) return null;
  const said = (e: unknown) => setProblem(String((e as Error)?.message || e));
  const look = async () => { setBusy(true); setProblem(''); try { setFound(await find!(q)); } catch (e) { said(e); } setBusy(false); };
  const pick = async (sym: app.AppSymbol) => {
    setBusy(true); setProblem('');
    try { await follow!(sym); setAdding(false); setFound(null); setQ(''); } catch (e) { said(e); }
    setBusy(false);
  };
  const unfollow = (symbol: string) => keep?.({ ...v.plan, watch: list.filter((w) => w.symbol !== symbol) });
  return (
    <div class="fx-watch">
      <div class="fx-watchhead">
        <div><h3>Watchlist</h3><p class="fx-sub">Followed, not owned: priced by Ghostfolio at each read, never counted in your worth</p></div>
        {can && <button type="button" class="small" aria-expanded={adding} onClick={() => { setAdding(!adding); setProblem(''); }}>Follow a ticker</button>}
      </div>
      {adding && <div class="fx-watchadd">
        <label class="field">Ticker or name <input value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) { e.preventDefault(); look(); } }} spellcheck={false} autocapitalize="characters" /></label>
        <button type="button" class="small" disabled={busy || !q.trim()} onClick={look}>{busy && !found ? 'Looking…' : 'Look it up'}</button>
        {found && (found.length ? <Rows kind="fx-rows">{found.map((sym) => <Row key={sym.symbol + sym.dataSource} lead={<Mark brand={tickerBrand(sym.symbol)} name={sym.symbol} auto size="sm" />} title={sym.symbol} sub={sym.name}
          end={<button type="button" class="small" disabled={busy || list.some((w) => w.symbol === sym.symbol)} onClick={() => pick(sym)}>{list.some((w) => w.symbol === sym.symbol) ? 'Followed' : 'Follow'}</button>} />)}</Rows>
          : <p class="fx-say">Ghostfolio found nothing by that.</p>)}
      </div>}
      {problem && <p class="formerr bad" role="alert">{problem}</p>}
      {list.length ? <Rows kind="fx-rows">{list.map((w) => {
        const pts = (w.history || []).map((p) => p.amount);
        const ch = w.from ? (w.price || 0) / w.from - 1 : 0;
        return <Row key={w.symbol} lead={<Mark brand={tickerBrand(w.symbol)} name={w.symbol} auto size="sm" />} title={w.symbol}
          sub={`${w.name ? w.name + ' · ' : ''}followed since ${w.since ? dayShort(w.since) : 'today'}`}
          end={<>{pts.length > 1 && <span class={'fx-holdtrend' + (ch < 0 ? ' down' : '')}><Spark values={pts} w={72} h={20} title={`${w.symbol} since it was followed: ${ch < 0 ? 'down' : 'up'}`} /></span>}
            {!!w.from && <span class={'fx-change ' + (ch >= 0 ? 'fx-in' : 'fx-out')}>{ch >= 0 ? '+' : '−'}{Math.abs(ch * 100).toFixed(1)}% since {w.since ? dayShort(w.since) : 'today'}</span>}
            {keep && can && <button type="button" class="small" onClick={() => unfollow(w.symbol)}>Unfollow</button>}</>}
          when={moneyIn(w.price || 0, w.currency)} whenPlain />;
      })}</Rows> : <p class="fx-say">Follow a ticker to see its price here without owning it.</p>}
    </div>
  );
}

/** The day a year before an ISO day. */
const yearAgo = (day: string) => `${+day.slice(0, 4) - 1}${day.slice(4)}`;

/** A holding's row (or an account's cash), and under it, when open, its worth at each read. */
function HoldingRow({ v, l, open, toggle, trades }: { v: finance.View; l: Line; open: boolean; toggle: () => void; trades?: TradeOps }) {
  const a = l.account, cur = a.currency;
  const symbol = l.h ? l.h.symbol : 'Cash';
  const name = l.h ? l.h.name || l.h.symbol : 'Not in a holding';
  const paid = l.h ? l.h.paid : l.cash!, worth = l.h ? l.h.value : l.cash!;
  const gain = worth - paid;
  // Its worth at each read over the last year, for the line in Year: green up, the out colour down.
  const trend = l.h ? (l.h.history || []).filter((p) => p.date >= yearAgo(v.today)).map((p) => p.amount) : [];
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
        <td class="n fx-holdprice">{l.h && l.h.shares > 0 ? <Amount value={l.h.value / l.h.shares} form="full" currency={cur} /> : ''}</td>
        <td class="n fx-holdpaid"><span class="fx-holdunit">{l.h ? `${shares(l.h.shares)} shares · ` : ''}paid </span><Amount value={paid} form="full" currency={cur} /></td>
        <td class="n fx-holdworth"><Amount value={worth} form="full" currency={cur} /></td>
        <td class="n fx-holdgain">{l.h && <><Amount value={gain} form="full" sign tone="auto" currency={cur} />{!amountsHidden() && <span class="fx-sub"> {share(gain, paid)}</span>}</>}</td>
        <td class={'n fx-holdtrend' + (trend.length > 1 && trend[trend.length - 1] < trend[0] ? ' down' : '')}>{trend.length > 1 && <Spark values={trend} w={72} h={20} title={`${l.h!.symbol} over the year: ${trend[trend.length - 1] < trend[0] ? 'down' : 'up'}`} />}</td>
      </tr>
      {l.h && open && <tr class="fx-holddetail" id={id}><td colSpan={7}><HoldingHistory v={v} h={l.h} cur={cur} />{trades && <Trades account={a} h={l.h} ops={trades} />}</td></tr>}
    </tbody>
  );
}

/** A holding's worth at each read, and what a share is worth against what one cost. */
function HoldingHistory({ v, h, cur }: { v: finance.View; h: finance.Holding; cur?: string }) {
  const pts = h.history || [];
  const each = (n: number) => (h.shares > 0 ? (amountsHidden() ? money(0) : moneyIn(n / h.shares, cur)) : '');
  const facts = h.shares > 0 ? <>
    <p class="fx-sub">A share is worth {each(h.value)} now; they cost {each(h.paid)} each on average.</p>
    {h.recounted && <p class="fx-sub fx-recounted">Ghostfolio's holdings count disagreed with its buys and sales; this uses the buys and sales.</p>}
    {h.doubtful && <p class="fx-sub fx-doubtful">This looks wrong: check {h.symbol} in Ghostfolio. It's worth over a hundred times what was paid, and its buys and sales couldn't be read.</p>}
    {h.quoted && <p class="fx-sub fx-quoted">Ghostfolio has no prices of its own for {h.symbol} yet, so its worth is today's price Ghostfolio looked up. Ghostfolio was asked to gather its prices; once it has, they're its own.</p>}
  </> : null;
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

/** "Nov 8, 2026": a trade's day, with its year, as buys go back years. */
const dayYear = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * A holding's buys and sales, read from Ghostfolio as it opens: each with
 * its day, shares, and what was paid (or got) in all, to Change (in a
 * short form) or Delete (asked first). Either reads Ghostfolio again, so
 * the card's figures follow.
 */
function Trades({ account, h, ops }: { account: finance.Account; h: finance.Holding; ops: TradeOps }) {
  const [list, setList] = useState<app.InvestmentTrade[] | null>(null);
  const [problem, setProblem] = useState('');
  const [editing, setEditing] = useState('');
  const [asking, setAsking] = useState('');
  const [busy, setBusy] = useState(false);
  const live = useRef(true);
  const why = (e: unknown) => String((e as Error)?.message || e);
  const load = async () => {
    try {
      const r = await ops.list(account.id, h.symbol);
      if (live.current) { setList(r); setProblem(''); }
    } catch (e) {
      if (live.current) setProblem(`Could not read its buys and sales from Ghostfolio: ${why(e)}`);
    }
  };
  useEffect(() => { live.current = true; load(); return () => { live.current = false; }; }, [account.id, h.symbol]);
  const drop = async (t: app.InvestmentTrade) => {
    setBusy(true);
    setProblem('');
    try {
      await ops.remove(t);
      setAsking('');
      await load();
    } catch (e) {
      if (live.current) setProblem(why(e));
    } finally {
      if (live.current) setBusy(false);
    }
  };
  const what = (t: app.InvestmentTrade) => `${t.sold ? 'sale' : 'buy'} of ${shares(t.shares)} ${h.symbol} on ${dayYear(t.date)}`;
  return (
    <div class="fx-trades">
      <h4 class="fx-caption">Buys and sales in Ghostfolio</h4>
      {list === null && !problem && <p class="fx-sub">Reading them from Ghostfolio…</p>}
      {list && !list.length && <p class="fx-sub">Ghostfolio has none for {h.symbol} in {account.name}.</p>}
      {list && list.length > 0 && <ul>
        {list.map((t) => editing === t.id
          ? <li key={t.id}><TradeForm t={t} symbol={h.symbol} change={ops.change} done={async (saved) => { setEditing(''); if (saved) await load(); }} /></li>
          : <li key={t.id} class="fx-trade">
            <span class="fx-tradewhat"><strong>{t.sold ? 'Sold' : 'Bought'}</strong> {shares(t.shares)} shares · {t.sold ? 'got' : 'paid'} <Amount value={t.total} form="full" currency={t.currency} /> <span class="fx-sub">· {dayYear(t.date)}</span></span>
            {asking === t.id
              ? <span class="fx-tradeask" role="group" aria-label={`Delete the ${what(t)}?`}>
                <span>Delete it from Ghostfolio?</span>
                <span class="fx-tradeacts">
                  <button type="button" class="small danger" disabled={busy} onClick={() => drop(t)}>{busy ? 'Deleting…' : 'Delete'}</button>
                  <button type="button" class="small" disabled={busy} onClick={() => setAsking('')}>Keep it</button>
                </span>
              </span>
              : <span class="fx-tradeacts">
                <button type="button" class="small" disabled={busy || !!editing} aria-label={`Change the ${what(t)}`} onClick={() => { setProblem(''); setEditing(t.id); }}>Change</button>
                <button type="button" class="small" disabled={busy || !!editing} aria-label={`Delete the ${what(t)}`} onClick={() => { setProblem(''); setAsking(t.id); }}>Delete</button>
              </span>}
          </li>)}
      </ul>}
      {problem && <p class="formerr bad" role="alert">{problem}</p>}
    </div>
  );
}

/** What the shares and the total typed come to a share, so a count read wrong shows before it is saved. */
function EachShare({ shares, total, currency, sold }: { shares: string; total: string; currency?: string; sold: boolean }) {
  const n = parseCount(shares), t = parseAmount(total);
  if (!(n > 0) || !(t > 0)) return null;
  const count = n.toLocaleString('en-US', { maximumFractionDigits: 8 });
  return <p class="fx-sub fx-eachshare" role="status">{count} {n === 1 ? 'share' : 'shares'} at {moneyIn(t / n, currency)} each{sold ? ' sold' : ''}.</p>;
}

/** A buy or a sale put right: bought or sold, how many shares, what was paid (or got) in all, and the day. */
function TradeForm({ t, symbol, change, done }: { t: app.InvestmentTrade; symbol: string; change: TradeOps['change']; done: (saved: boolean) => void }) {
  const [way, setWay] = useState(t.sold ? 'sold' : 'bought');
  const [count, setCount] = useState(String(t.shares));
  const [total, setTotal] = useState(t.total.toFixed(2));
  const [day, setDay] = useState(t.date);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const sold = way === 'sold';
  const id = 'trade-' + t.id.replace(/[^A-Za-z0-9]+/g, '-');
  const submit = async (e: Event) => {
    e.preventDefault();
    const n = parseCount(count), m = parseAmount(total);
    const wrong = !(n > 0) ? 'How many shares: more than 0.'
      : isNaN(m) || m < 0 ? `What you ${sold ? 'got' : 'paid'} in all: type it without a minus.`
      : !day || day > todayISO() ? 'Pick the day it happened, today or before.' : '';
    setProblem(wrong);
    if (wrong) return;
    setBusy(true);
    try {
      await change({ ...t, shares: n, total: m, date: day, sold: sold || undefined });
      done(true);
    } catch (err) {
      setProblem(String((err as Error)?.message || err));
      setBusy(false);
    }
  };
  return (
    <form class="finform fx-investadd fx-tradeform" onSubmit={submit} aria-labelledby={id}>
      <div class="fx-investaddhead">
        <h3 id={id}>Change this {t.sold ? 'sale' : 'buy'} of {symbol}</h3>
        <Segmented label="Bought or sold" value={way} pick={setWay} options={[['bought', 'Bought'], ['sold', 'Sold']]} />
      </div>
      <div class="fx-investaddgrid">
        <label class="field">Shares<input inputmode="decimal" value={count} onInput={(e) => setCount((e.target as HTMLInputElement).value)} /></label>
        <label class="field">{sold ? 'What you got in all' : 'What you paid in all'}<span class="moneyfield"><span aria-hidden="true">{signOf(t.currency)}</span><input inputmode="decimal" value={total} onInput={(e) => setTotal((e.target as HTMLInputElement).value)} /></span></label>
        <label class="field">Day<input type="date" value={day} max={todayISO()} onInput={(e) => setDay((e.target as HTMLInputElement).value)} /></label>
      </div>
      <EachShare shares={count} total={total} currency={t.currency} sold={sold} />
      {problem && <p class="formerr bad" role="alert">{problem}</p>}
      <div class="fx-investaddactions">
        <button type="button" class="small" disabled={busy} onClick={() => done(false)}>Cancel</button>
        <button type="submit" class="small primary" disabled={busy}>{busy ? 'Saving…' : 'Save in Ghostfolio'}</button>
      </div>
    </form>
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

/**
 * Add a holding: bought or sold, into which account (or a new one, made
 * in Finances and Ghostfolio by one name), what (a ticker or a name,
 * picked from what Ghostfolio finds), how many shares, what was paid (or
 * got) in all, and the day. Ghostfolio keeps it; the card reads it back.
 */
function AddForm({ v, add, find, close }: { v: finance.View; add: NonNullable<InvestmentsProps['add']>; find: NonNullable<InvestmentsProps['find']>; close: () => void }) {
  const invest = (v.plan.accounts || []).filter((a) => a.kind === 'investment' || a.kind === 'retirement');
  const [way, setWay] = useState('bought');
  const [account, setAccount] = useState(invest[0]?.id || 'new');
  const [newName, setNewName] = useState('');
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<app.AppSymbol[]>([]);
  const [looking, setLooking] = useState(false);
  const [picked, setPicked] = useState<app.AppSymbol | null>(null);
  const [shares, setShares] = useState('');
  const [total, setTotal] = useState('');
  const [day, setDay] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const timer = useRef(0);
  const asked = useRef(0);
  const why = (e: unknown) => String((e as Error)?.message || e);
  // Looked up as it is typed, once typing stops; only the latest answer counts.
  const type = (q: string) => {
    setQuery(q);
    setPicked(null);
    clearTimeout(timer.current);
    if (!q.trim()) { setFound([]); return; }
    timer.current = window.setTimeout(async () => {
      const n = ++asked.current;
      setLooking(true);
      try {
        const r = await find(q);
        if (n === asked.current) { setFound(r); setProblem(''); }
      } catch (e) {
        if (n === asked.current) setProblem(why(e));
      } finally {
        if (n === asked.current) setLooking(false);
      }
    }, 350);
  };
  const sold = way === 'sold';
  const submit = async (e: Event) => {
    e.preventDefault();
    const n = parseCount(shares), t = parseAmount(total);
    const wrong = account === 'new' && !newName.trim() ? 'Name the new account.'
      : !picked ? 'Type a ticker or a name, then pick it from the list.'
      : !(n > 0) ? 'How many shares: more than 0.'
      : isNaN(t) || t < 0 ? `What you ${sold ? 'got' : 'paid'} in all: type it without a minus.`
      : !day || day > todayISO() ? 'Pick the day it happened, today or before.' : '';
    setProblem(wrong);
    if (wrong || !picked) return;
    setBusy(true);
    try {
      await add({ account: account === 'new' ? undefined : account, newName: account === 'new' ? newName.trim() : undefined, symbol: picked.symbol, dataSource: picked.dataSource, currency: picked.currency, shares: n, total: t, date: day, sold: sold || undefined });
      close();
    } catch (err) {
      setProblem(why(err));
      setBusy(false);
    }
  };
  return (
    <form class="finform fx-investadd" onSubmit={submit} aria-labelledby="investAddTitle">
      <div class="fx-investaddhead">
        <h3 id="investAddTitle">Add a holding</h3>
        <Segmented label="Bought or sold" value={way} pick={setWay} options={[['bought', 'Bought'], ['sold', 'Sold']]} />
      </div>
      <div class="fx-investaddgrid">
        <label class="field">Account
          <select value={account} onChange={(e) => setAccount((e.target as HTMLSelectElement).value)}>
            {invest.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            <option value="new">A new account…</option>
          </select>
        </label>
        {account === 'new' && <label class="field">Its name<input value={newName} placeholder="Roth IRA" onInput={(e) => setNewName((e.target as HTMLInputElement).value)} /></label>}
        <label class="field wide">What you {sold ? 'sold' : 'bought'}
          <input value={query} placeholder="A ticker, like VTI, or a name" autocomplete="off" aria-describedby="investFound" onInput={(e) => type((e.target as HTMLInputElement).value)} />
        </label>
      </div>
      <div id="investFound" class="fx-symbols" aria-live="polite">
        {picked ? <p class="fx-symbolpicked"><strong>{picked.symbol}</strong> {picked.name} <span class="fx-sub">· {picked.currency}</span> <button type="button" class="small" onClick={() => { setPicked(null); }}>Change</button></p>
          : looking ? <p class="fx-sub">Looking it up in Ghostfolio…</p>
          : query.trim() && !found.length ? <p class="fx-sub">Ghostfolio found nothing for “{query.trim()}”.</p>
          : found.map((s) => <button key={s.dataSource + s.symbol} type="button" class="fx-symbol" onClick={() => { setPicked(s); setQuery(s.symbol); setFound([]); }}><strong>{s.symbol}</strong><span>{s.name}</span><small>{s.currency}</small></button>)}
      </div>
      <div class="fx-investaddgrid">
        <label class="field">Shares<input inputmode="decimal" value={shares} placeholder="10" onInput={(e) => setShares((e.target as HTMLInputElement).value)} /></label>
        <label class="field">{sold ? 'What you got in all' : 'What you paid in all'}<span class="moneyfield"><span aria-hidden="true">{signOf(picked?.currency)}</span><input inputmode="decimal" value={total} placeholder="0.00" onInput={(e) => setTotal((e.target as HTMLInputElement).value)} /></span></label>
        <label class="field">Day<input type="date" value={day} max={todayISO()} onInput={(e) => setDay((e.target as HTMLInputElement).value)} /></label>
      </div>
      <EachShare shares={shares} total={total} currency={picked?.currency} sold={sold} />
      <p class="fx-sub fx-investaddnote">It goes into Ghostfolio on this computer{account === 'new' ? ', and the new account into Finances too, by the same name' : ''}. Only the ticker leaves the homelab, when Ghostfolio looks it up.</p>
      {problem && <p class="formerr bad" role="alert">{problem}</p>}
      <div class="fx-investaddactions">
        <button type="button" class="small" disabled={busy} onClick={close}>Cancel</button>
        <button type="submit" class="small primary" disabled={busy}>{busy ? 'Adding…' : 'Add to Ghostfolio'}</button>
      </div>
    </form>
  );
}
