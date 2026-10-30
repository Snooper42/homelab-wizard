// Finances › Net worth: what the household owns less what it owes, over
// time (each balance typed in is kept) and ahead (the paychecks read
// forward, dashed); the accounts by group, each with its line and how long
// ago it was typed in; and assets and liabilities by kind.
import { useState } from 'preact/hooks';
import { Card, CardHead } from '../parts/Card';
import { Empty } from '../parts/Empty';
import { Row, Rows } from '../parts/Row';
import { Segmented } from '../parts/Segmented';
import { Spark } from '../Spark';
import { Mark } from './Mark';
import { Money } from './Overview';
import { currencySign, daysBetween, dayShort, isoDay, type Lookup, money, owed, parseDay, signed } from './money';

interface WorthProps {
  v: finance.View;
  L: Lookup;
  edit: (what: 'account' | 'person' | 'payment', id?: string) => void;
}

/** The groups the accounts are listed in, in order. */
const groups: [string, string, string[]][] = [
  ['cash', 'Cash', ['checking', 'savings']],
  ['cards', 'Credit cards', ['card']],
  ['investments', 'Investments', ['investment']],
  ['retirement', 'Retirement', ['retirement']],
  ['property', 'Property', ['home', 'car']],
  ['other', 'Other', ['other']],
  ['loans', 'Loans', ['loan']],
];

/** What the household has and owes, by kind, each in its own colour (--cat-N, a fixed order: a kind keeps its colour). */
const assetKinds: [string, string[], number][] = [['Cash', ['checking', 'savings'], 1], ['Investments', ['investment'], 2], ['Retirement', ['retirement'], 3], ['Real estate', ['home'], 4], ['Vehicles', ['car'], 5], ['Other', ['other'], 6]];
const debtKinds: [string, string[], number][] = [['Loans', ['loan'], 7], ['Credit cards', ['card'], 8]];

/** The time a change is over: a month, three, a year, or everything kept. */
const ranges: [string, string, number][] = [['1m', '1 month', 30], ['3m', '3 months', 91], ['1y', '1 year', 365], ['all', 'All', 1e6]];

/** "today", "yesterday", "3 days ago", "Oct 2". */
function ago(day: string | undefined, today: string): string {
  if (!day) return '';
  const n = daysBetween(day, today);
  return n <= 0 ? 'today' : n === 1 ? 'yesterday' : n < 14 ? `${n} days ago` : dayShort(day);
}

/** A whole-dollar axis label: "$680k", "$2,500", "−$1,000". */
const tick = (t: number) => (t < 0 ? '−' : '') + currencySign() + (Math.abs(t) >= 10000 ? `${Math.round(Math.abs(t) / 1000).toLocaleString('en-US')}k` : Math.abs(t).toLocaleString('en-US'));

export function NetWorth({ v, L, edit }: WorthProps) {
  const [range, setRange] = useState('1m');
  const [share, setShare] = useState('totals');
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const accounts = v.plan.accounts || [];
  if (!accounts.length) {
    return (
      <Card kind="finstart">
        <h2>Nothing here yet</h2>
        <Rows>
          <Row lead={<Mark kind="checking" name="Accounts" />} title="Bank accounts, cards, and investments" sub="What each holds, typed in" end={<button class="small" onClick={() => edit('account')}>Add an account</button>} />
          <Row lead={<Mark kind="home" name="Home" />} title="A home or a car" sub="What it is worth, and the loan against it: its equity" end={<button class="small" onClick={() => edit('account')}>Add property</button>} />
        </Rows>
      </Card>
    );
  }
  const days = ranges.find(([k]) => k === range)?.[2] ?? 30;
  const label = ranges.find(([k]) => k === range)?.[1] ?? '1 month';
  const from = (() => { const d = parseDay(v.today); d.setDate(d.getDate() - days); return isoDay(d); })();
  // Each account today (as typed in, with what has happened since), as a plus for what is there and a minus for what is owed.
  const now = (a: finance.Account) => { const n = v.start?.[a.id] ?? (a.kind === 'card' ? a.balance + (a.pending || 0) : a.balance); return owed(a.kind) ? -n : n; };
  // And on a day: its last balance kept on or before it; before its first, that one; with none kept, its balance (as View.Worth does).
  const on = (a: finance.Account, day: string) => {
    const h = a.history || [];
    let n = h.length ? h[0].amount : a.kind === 'card' ? a.balance + (a.pending || 0) : a.balance;
    for (const pt of h) if (pt.date <= day) n = pt.amount;
    return owed(a.kind) ? -n : n;
  };
  const sum = (list: finance.Account[], f: (a: finance.Account) => number) => list.reduce((t, a) => t + f(a), 0);
  const total = sum(accounts, now);
  const before = sum(accounts, (a) => on(a, from));
  return (
    <div class="fin">
      <WorthChart v={v} total={total} days={days} from={from} label={label} range={range} setRange={setRange} change={total - before} />
      <div class="fincols">
        <div class="fin">
          {groups.map(([key, name, kinds]) => {
            const list = accounts.filter((a) => kinds.includes(a.kind));
            if (!list.length) return null;
            const open = !closed[key], t = sum(list, now), d = t - sum(list, (a) => on(a, from));
            return (
              <Card key={key} kind="fingroup">
                <div class="grouphead">
                  <button type="button" class="fold" aria-expanded={open} onClick={() => setClosed({ ...closed, [key]: open })}>
                    <span class="chev" aria-hidden="true">{open ? '▾' : '▸'}</span><strong>{name}</strong>
                    <Change d={d} base={t - d} label={label} />
                  </button>
                  <strong class="num">{money(t)}</strong>
                </div>
                {open && <Rows kind="finrows">
                  {list.map((a) => <AccountRow key={a.id} a={a} v={v} L={L} edit={edit} value={now(a)} line={[...(a.history || []).filter((pt) => pt.date >= from).map((pt) => (owed(a.kind) ? -pt.amount : pt.amount)), now(a)]} />)}
                </Rows>}
              </Card>
            );
          })}
        </div>
        <Card kind="finsummary">
          <CardHead title="Summary"><Segmented label="Show" value={share} pick={setShare} options={[['totals', 'Totals'], ['percent', 'Percent']]} /></CardHead>
          <Split title="Assets" kinds={assetKinds} accounts={accounts} value={(a) => Math.max(0, now(a))} percent={share === 'percent'} />
          <Split title="Liabilities" kinds={debtKinds} accounts={accounts} value={(a) => Math.max(0, -now(a))} percent={share === 'percent'} />
        </Card>
      </div>
    </div>
  );
}

/** "↑ +$1,826.10 (2.9%) 1 month change". */
function Change({ d, base, label }: { d: number; base: number; label: string }) {
  if (Math.abs(d) < 0.005) return <span class="change muted">No change in {label}</span>;
  const pct = Math.abs(base) >= 0.005 ? ` (${Math.abs((d / Math.abs(base)) * 100).toFixed(1)}%)` : '';
  return <span class="change"><span class={d < 0 ? 'bad' : 'ok'}><span aria-hidden="true">{d < 0 ? '↓ ' : '↑ '}</span>{signed(d)}{pct}</span> <span class="muted">{label} change</span></span>;
}

/** One account: its line over the range, what it has (or owes) today, and when it was typed in. */
function AccountRow({ a, v, L, edit, value, line }: { a: finance.Account; v: finance.View; L: Lookup; edit: WorthProps['edit']; value: number; line: number[] }) {
  const kindName = { checking: 'Checking', savings: 'Savings', card: 'Credit card', investment: 'Investment', retirement: 'Retirement', home: 'Home', car: 'Vehicle', loan: 'Loan', other: 'Other' }[a.kind] || a.kind;
  const loan = a.loan ? L.account[a.loan] : undefined;
  const paid = a.kind === 'loan' && a.original ? Math.max(0, Math.min(1, (a.original - a.balance) / a.original)) : -1;
  const sub = [
    kindName,
    loan ? `equity ${money(a.balance - (v.start?.[loan.id] ?? loan.balance))}` : '',
    paid >= 0 ? `${Math.round(paid * 100)}% of ${money(a.original)} paid` : '',
    a.rate ? `${a.rate}% a year` : '',
    a.kind === 'card' && a.pending ? `${money(a.pending)} pending` : '',
    a.detail || '',
  ].filter(Boolean).join(' · ');
  return <Row lead={<Mark brand={a.institution} kind={a.kind} name={a.name} />} title={a.name} sub={sub}
    end={<>{line.length > 2 && <Spark values={line} title={`${a.name}, the range shown`} />}<button class="small" onClick={() => edit('account', a.id)} aria-label={`Edit ${a.name}`}>Edit</button></>}
    when={<span class="worthval"><span class="num">{money(value)}</span><span class="muted">{a.updated ? 'Updated ' + ago(a.updated, v.today) : 'Not typed in yet'}</span></span>} whenPlain />;
}

/** Assets or liabilities by kind: a bar in parts, and each part named with its amount (or share). */
function Split({ title, kinds, accounts, value, percent }: { title: string; kinds: [string, string[], number][]; accounts: finance.Account[]; value: (a: finance.Account) => number; percent: boolean }) {
  const parts = kinds.map(([name, ks, n]) => ({ name, n, amount: accounts.filter((a) => ks.includes(a.kind)).reduce((t, a) => t + value(a), 0) })).filter((x) => x.amount >= 0.005);
  const all = parts.reduce((t, x) => t + x.amount, 0);
  return (
    <div class="finsplit">
      <div class="splithead"><strong>{title}</strong><span class="num">{money(all)}</span></div>
      {all > 0 ? <>
        <div class="splitbar" aria-hidden="true">{parts.map((x) => <span key={x.name} class={'c' + x.n} style={{ flexGrow: x.amount }} />)}</div>
        <ul class="splitlist">
          {parts.map((x) => <li key={x.name}><span class={'dot c' + x.n} aria-hidden="true" /><span class="grow">{x.name}</span><span class="num">{percent ? `${((x.amount / all) * 100).toFixed(1)}%` : money(x.amount)}</span></li>)}
        </ul>
      </> : <p class="muted">None.</p>}
    </div>
  );
}

/**
 * Net worth over the range, each day as typed in, then today's and the
 * paychecks ahead dashed (as far ahead as the range looks back, at most the
 * paychecks read); pointing at a day says what it was, or is expected to be.
 */
function WorthChart({ v, total, days, from, label, range, setRange, change }: { v: finance.View; total: number; days: number; from: string; label: string; range: string; setRange: (r: string) => void; change: number }) {
  const [hover, setHover] = useState(-1);
  // Past: kept balances in the range, today's estimate last.
  const past = (v.worth || []).filter((pt) => pt.date >= from && pt.date < v.today).map((pt) => ({ date: pt.date, amount: pt.amount, ahead: false }));
  past.push({ date: v.today, amount: total, ahead: false });
  // Ahead: net worth at the end of each stretch read forward.
  const sign = Object.fromEntries((v.plan.accounts || []).map((a) => [a.id, owed(a.kind) ? -1 : 1]));
  const reach = Math.min(days, 400);
  const ahead = v.periods.filter((p) => daysBetween(v.today, p.last) > 0 && daysBetween(v.today, p.last) <= reach)
    .map((p) => ({ date: p.last, amount: Object.entries(p.accounts || {}).reduce((t, [id, n]) => t + (sign[id] ?? 0) * n, 0), ahead: true }));
  const pts = [...past, ...ahead];
  const start = pts[0].date, span = Math.max(1, daysBetween(start, pts[pts.length - 1].date));
  const x = (d: string) => (daysBetween(start, d) / span) * 1000;
  const vals = pts.map((p) => p.amount);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const step = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1e6].find((s) => (hi - lo) / s <= 4) || 2.5e6;
  const bottom = Math.floor(lo / step) * step, top = Math.max(bottom + step, Math.ceil(hi / step) * step);
  const H = 200, y = (n: number) => ((top - n) / (top - bottom)) * H;
  const path = (list: typeof pts) => list.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)} ${y(p.amount).toFixed(1)}`).join(' ');
  const line = path(past), dashed = ahead.length ? path([past[past.length - 1], ...ahead]) : '';
  const area = past.length > 1 ? `${line} L${x(v.today).toFixed(1)} ${H} L${x(start).toFixed(1)} ${H} Z` : '';
  const ticks: number[] = [];
  for (let t = bottom; t <= top + 0.01; t += step) ticks.push(t);
  const h = hover >= 0 ? pts[hover] : null;
  const move = (e: MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect(), at = ((e.clientX - r.left) / r.width) * 1000;
    let best = 0;
    pts.forEach((p, i) => { if (Math.abs(x(p.date) - at) < Math.abs(x(pts[best].date) - at)) best = i; });
    setHover(best);
  };
  return (
    <Card kind="finchart finworthchart">
      <div class="worthhead">
        <div>
          <div class="label">Net worth</div>
          <div class="big"><Money n={total} tone={total < 0 ? 'bad' : ''} /></div>
          <Change d={change} base={total - change} label={label} />
        </div>
        <Segmented label="Range" value={range} pick={setRange} options={ranges.map(([k, t]) => [k, t])} />
      </div>
      <figure aria-label={`Net worth from ${dayShort(start)}: ${money(pts[0].amount)}, to ${money(total)} today${ahead.length ? `, and ${money(ahead[ahead.length - 1].amount)} expected by ${dayShort(ahead[ahead.length - 1].date)}` : ''}. The accounts below have every number.`}>
        <div class="axis" aria-hidden="true">{ticks.map((t) => <span key={t} style={{ top: `${y(t) - 8}px` }}>{tick(t)}</span>)}</div>
        <div class="plot" style={{ height: `${H}px` }} onMouseMove={move} onMouseLeave={() => setHover(-1)}>
          {ticks.map((t) => <span key={t} class="grid" style={{ top: `${y(t)}px` }} />)}
          {ahead.length > 0 && <span class="todayline" style={{ left: `${x(v.today) / 10}%` }} />}
          <svg viewBox={`0 0 1000 ${H}`} preserveAspectRatio="none" aria-hidden="true">
            {area && <path class="area" d={area} />}
            {past.length > 1 && <path class="line" d={line} vector-effect="non-scaling-stroke" />}
            {dashed && <path class="line ahead" d={dashed} vector-effect="non-scaling-stroke" />}
          </svg>
          {h && <>
            <span class="cross" style={{ left: `${x(h.date) / 10}%` }} />
            <span class="dotat" style={{ left: `${x(h.date) / 10}%`, top: `${y(h.amount)}px` }} />
            <div class="tip" style={x(h.date) < 620 ? { left: `calc(${x(h.date) / 10}% + 14px)` } : { right: `calc(${100 - x(h.date) / 10}% + 14px)` }}>
              <div class="tiphead"><strong>{dayShort(h.date)}</strong><strong class="num">{money(h.amount)}</strong></div>
              <div class="tipline"><span class="muted">{h.ahead ? 'Expected, post-pay' : h.date === v.today ? 'Today' : 'As typed in'}</span></div>
            </div>
          </>}
        </div>
        <div class="xlabels" aria-hidden="true"><span>{dayShort(start)}</span>{ahead.length > 0 && <span style={{ left: `${x(v.today) / 10}%` }} class="mid">Today</span>}<span>{dayShort(pts[pts.length - 1].date)}</span></div>
      </figure>
      {past.length < 3 && <p class="muted hint">The line draws itself as you update your balances: each day's are kept.</p>}
    </Card>
  );
}
