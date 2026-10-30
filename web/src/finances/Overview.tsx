// Finances › Overview: checking post-pay for the paycheck picked, what is
// true right now, the paychecks ahead to pick from, what the picked one
// pays, every account today and post-pay (typed in with Edit), and
// checking day by day.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Card, CardHead } from '../parts/Card';
import { Empty } from '../parts/Empty';
import { Row, Rows } from '../parts/Row';
import { Segmented } from '../parts/Segmented';
import { Mark, Who } from './Mark';
import { cents, currencySign, dayLong, dayShort, type Lookup, money, monthName, owed, parseAmount, plural, signed, split } from './money';

/** What Overview draws; saveBalances, add, and setWaiting are left out on a phone allowed only to look, so it offers no way to change anything. */
export interface OverviewProps {
  v: finance.View;
  L: Lookup;
  /** The period picked: 0 is now, 1 the next paycheck. */
  sel: number;
  pick: (i: number) => void;
  /** Keeps the balances typed in (by account ID) and the cushion; false when it failed. */
  saveBalances?: (balances: Record<string, { balance: number; pending: number }>, cushion: number) => Promise<boolean>;
  add?: (what: 'account' | 'person' | 'payment') => void;
  /** Says whether a paycheck or payment taken as done has not happened yet (true: it waits, and comes today). */
  setWaiting?: (key: string, waiting: boolean) => Promise<boolean>;
}

/** Dollars big and the cents smaller. */
export function Money({ n, tone }: { n: number; tone?: string }) {
  const [d, c] = split(n);
  return <span class={'money' + (tone ? ' ' + tone : '')}>{d}<small>{c}</small></span>;
}

const toneOf = (n: number, cushion: number) => (n < 0 ? 'bad' : n < cushion ? 'warn' : '');

/** The people a payday pays, overlapping. */
function Whos({ ids, L, size }: { ids: string[]; L: Lookup; size?: 'sm' | 'lg' }) {
  return <span class="fwhos">{ids.map((id) => <Who key={id} name={L.person[id]?.name} n={L.order[id] ?? 0} size={size} />)}</span>;
}

const names = (ids: string[], L: Lookup) => ids.map((id) => L.person[id]?.name || id).join(' and ');

function Stat({ label, children, note, tone }: { label: string; children: any; note?: string; tone?: string }) {
  return <div class="finstat"><div class="k">{label}</div><div class={'v' + (tone ? ' ' + tone : '')}>{children}{note && <span class="muted"> {note}</span>}</div></div>;
}

function Hero({ p, next, L, cushion, cards, hasCards, checking }: { p: finance.Period; next: finance.Period; L: Lookup; cushion: number; cards: number; hasCards: boolean; checking: number }) {
  // The paycheck less the payments; money moved in from another account is
  // its own line, and what went into savings is kept, not spent.
  const paid = p.pay?.amount || 0, movedIn = cents(p.in - paid), saved = p.saved || 0;
  const surplus = paid - p.out;
  const spentRows = p.rows.filter((r) => !r.into && !r.outside && !r.saved).length, savedRows = p.rows.filter((r) => !r.outside && r.saved).length;
  const pct = paid > 0 ? ` ${Math.round((surplus / paid) * 100)}%` : '';
  const tone = toneOf(p.left, cushion);
  return (
    <Card kind="finhero">
      <div class="main">
        <div class="herohead">
          {p.now ? <Mark kind="checking" name="Now" size="sm" /> : <Whos ids={p.pay.people} L={L} />}
          <strong>{p.now ? 'Until the next paycheck' : `${names(p.pay.people, L)} · ${dayLong(p.pay.date)}`}</strong>
          {!p.now && paid > 0 && <span class="fpill ok">+{money(paid)}</span>}
          {!p.now && (p.pay.moved || []).map((m) => <span key={m.person} class="fpill info" title={`${L.person[m.person]?.name}'s day is ${dayLong(m.from)}`}>Early: {m.why}</span>)}
        </div>
        <div class="label">{p.now ? `Checking on ${dayLong(p.last)}` : `Post-pay checking · ${dayLong(p.last)}`}</div>
        <div class="big"><Money n={p.left} tone={tone} /></div>
        {tone && <span class={'fpill ' + tone}>{p.left < 0 ? `Short ${money(-p.left)}` : `Under your ${money(cushion).replace('.00', '')} cushion`}</span>}
        <div class="stats">
          {p.now ? <>
            <Stat label="Checking today">{money(p.carried)}</Stat>
            <Stat label="Spent" note={plural(spentRows, 'payment')}>−{money(p.out - saved)}</Stat>
            {saved > 0 && <Stat label="Saved" note={plural(savedRows, 'transfer')}>{money(saved)}</Stat>}
            {movedIn > 0 && <Stat label="Moved in">+{money(movedIn)}</Stat>}
            {next?.pay && <Stat label="Next paycheck" note={names(next.pay.people, L)}>{dayShort(next.pay.date)}</Stat>}
          </> : <>
            <Stat label="Surplus" note={pct.trim()} tone={surplus < 0 ? 'bad' : 'ok'}>{signed(surplus)}</Stat>
            <Stat label="Spent" note={plural(spentRows, 'payment')}>−{money(p.out - saved)}</Stat>
            {saved > 0 && <Stat label="Saved" note={plural(savedRows, 'transfer')}>{money(saved)}</Stat>}
            {movedIn > 0 && <Stat label="Moved in">+{money(movedIn)}</Stat>}
            <Stat label="Carried in">{money(p.carried)}</Stat>
          </>}
        </div>
      </div>
      <div class="side">
        <h2>Right now</h2>
        <NowLine label="Checking" kind="checking" value={money(checking)} />
        <NowLine label={next?.pay ? `Until ${dayShort(next.pay.date)}` : 'This month'} kind="clock" value={money(next ? next.carried : checking)} tone={toneOf(next ? next.carried : checking, cushion)} />
        {hasCards && <NowLine label="Owed on cards" kind="card" value={money(cards)} />}
        {hasCards && <NowLine label="Checking minus cards" kind="minus" value={money(checking - cards)} tone={checking - cards < 0 ? 'bad' : ''} />}
      </div>
    </Card>
  );
}

function NowLine({ label, kind, value, tone }: { label: string; kind: string; value: string; tone?: string }) {
  return <div class="nowline"><Mark kind={kind} name={label} /><div><div class="k">{label}</div><div class={'v' + (tone ? ' ' + tone : '')}>{value}</div></div></div>;
}

/** The paychecks ahead, one card each; the picked one raised. */
function Checks({ v, L, sel, pick, cushion }: { v: finance.View; L: Lookup; sel: number; pick: (i: number) => void; cushion: number }) {
  // A person's third check in a month says so.
  const seen: Record<string, number> = {};
  const third = new Set<number>();
  v.periods.forEach((p, i) => (p.pay?.people || []).forEach((id) => {
    const k = id + p.pay.date.slice(0, 7);
    seen[k] = (seen[k] || 0) + 1;
    if (seen[k] === 3) third.add(i);
  }));
  return (
    <div class="fchecks" role="group" aria-label="Paychecks">
      {v.periods.map((p, i) => {
        const room = p.carried + p.in;
        const share = room > 0 ? Math.max(0, Math.min(1, p.left / room)) : 0;
        const tone = toneOf(p.left, cushion);
        return (
          <button key={p.start} type="button" class={'fcheck' + (i === sel ? ' on' : '') + (tone ? ' low' : '')} aria-pressed={i === sel} onClick={() => pick(i)}>
            <span class="d"><span>{p.now ? 'Now' : dayLong(p.pay.date)}</span>{p.now ? <Mark kind="checking" name="Now" size="sm" /> : <Whos ids={p.pay.people} L={L} size="sm" />}</span>
            <span class={'amt ' + tone}>{money(p.left)}</span>
            <span class="meterbar" aria-hidden="true"><span style={{ width: `${(share * 100).toFixed(1)}%` }} /></span>
            <span class="s">{p.now ? `Until ${dayShort(p.last)}` : third.has(i) ? `3rd check in ${monthName(p.pay.date)}` : `+${money(p.pay.amount)}`}</span>
          </button>
        );
      })}
    </div>
  );
}

function Payments({ p, L, cushion }: { p: finance.Period; L: Lookup; cushion: number }) {
  return (
    <Card kind="finpay">
      <CardHead title={<>Payments <span class="muted">{p.now ? 'Today' : dayShort(p.start)} – {dayShort(p.last)}</span></>}><strong class="num">−{money(p.out)}</strong></CardHead>
      <Rows kind="finrows">
        {p.now
          ? <Row lead={<Mark kind="checking" name="Checking" />} title="Checking today" when={money(p.carried)} whenPlain />
          : <Row lead={<Whos ids={p.pay.people} L={L} size="lg" />} title={`${names(p.pay.people, L)} paycheck`} sub={dayLong(p.pay.date)}
              end={<span class="after muted">{money(p.carried + p.pay.amount)}</span>} when={<span class="ok">+{money(p.pay.amount)}</span>} whenPlain />}
        {p.rows.map((r, i) => {
          const x = L.payment[r.payment];
          // Paid from another account, charged to a card, or moved into checking from one: which.
          const src = L.account[x?.from];
          const other = r.outside || r.into ? (src?.kind === 'card' ? ' · on ' : ' · from ') + (src?.name || 'another account') : '';
          return <Row key={i} lead={<Mark brand={x?.institution} kind={x?.kind} name={x?.name} />} title={<>{x?.name || r.payment}{r.estimate && <span class="muted"> (est.)</span>}</>}
            sub={dayLong(r.date) + other}
            end={!r.outside && <span class={'after ' + (toneOf(r.after, cushion) || 'muted')}>{money(r.after)}</span>} when={r.into ? <span class="ok">+{money(r.amount)}</span> : '−' + money(r.amount)} whenPlain />;
        })}
        {!p.rows.length && <li><Empty>No payments before the next paycheck.</Empty></li>}
      </Rows>
      <div class="finfoot"><span>Checking on {dayShort(p.last)}</span><strong class={'num ' + toneOf(p.left, cushion)}>{money(p.left)}</strong></div>
    </Card>
  );
}

/**
 * What the balances are taken to hold: each paycheck and payment dated the
 * day a balance was typed in, or after it and before today. One the
 * household marks Not yet waits, and comes today.
 */
function Since({ v, L, set }: { v: finance.View; L: Lookup; set?: (key: string, waiting: boolean) => Promise<boolean> }) {
  const [busy, setBusy] = useState('');
  const [all, setAll] = useState(false);
  const list = v.since || [];
  const pick = async (s: finance.Past, choice: string) => {
    if ((choice === 'not') === !!s.waiting || busy) return;
    setBusy(s.key);
    await set(s.key, choice === 'not');
    setBusy('');
  };
  const name = (s: finance.Past) => (s.person ? `${L.person[s.person]?.name || s.person}'s paycheck` : L.payment[s.payment]?.name || s.payment);
  const shown = all ? list : list.slice(0, 5);
  return (
    <Card kind="finsince">
      <CardHead title="Taken as done" />
      <p class="muted">Dated on or after the day you typed in the balances, so counted in them.{set && ' Mark any that hasn\'t happened yet: it comes today.'}</p>
      <Rows kind="finrows">
        {shown.map((s) => {
          const x = s.payment ? L.payment[s.payment] : undefined;
          return <Row key={s.key} lead={s.person ? <Who name={L.person[s.person]?.name} n={L.order[s.person] ?? 0} /> : <Mark brand={x?.institution} kind={x?.kind} name={x?.name} />}
            title={name(s)} sub={dayLong(s.date) + (s.waiting ? ' · not yet: it comes today' : s.typed ? ' · the day its balance was typed in' : ' · since the balance was typed in')}
            end={set && <Segmented label={`${name(s)}, ${dayLong(s.date)}`} value={s.waiting ? 'not' : 'in'} pick={(c) => pick(s, c)} options={[['in', 'In'], ['not', 'Not yet']]} />}
            when={s.in ? <span class="ok">+{money(s.amount)}</span> : (s.outside ? '' : '−') + money(s.amount)} whenPlain />;
        })}
      </Rows>
      {list.length > 5 && <p class="actions"><button class="small" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${list.length}`}</button></p>}
    </Card>
  );
}

/** The accounts in the table: money and cards, not loans or property (Net worth has those). */
const shown = (a: finance.Account) => ['checking', 'savings', 'investment', 'retirement', 'card'].includes(a.kind);

/** How many stretches the table shows: now and the six paychecks after it (the table scrolls sideways for them). */
const postCols = 7;

/**
 * Each account today and post-pay after each paycheck ahead, with what it
 * changed by: what checking, savings, or a Roth IRA will hold once the
 * paycheck is in and its bills are paid, and what a card will owe. Picking
 * a column picks that paycheck. Update balances types in today's, starting
 * from what is expected; Enter keeps them, Escape drops them.
 */
function PostPay({ v, L, sel, pick, saveBalances, add }: { v: finance.View; L: Lookup; sel: number; pick: (i: number) => void; saveBalances: OverviewProps['saveBalances']; add: OverviewProps['add'] }) {
  const accounts = (v.plan.accounts || []).filter(shown);
  const cols = v.periods.slice(0, postCols);
  const [editing, setEditing] = useState(false);
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) first.current?.focus(); }, [editing]);
  const val = (key: string, n: number) => typed[key] ?? String(n || 0);
  // Each balance today: as typed in, with what has happened since; what a box starts at.
  const est = (a: finance.Account) => (owed(a.kind) ? Math.max(0, cents((v.start?.[a.id] ?? a.balance + (a.pending || 0)) - (a.pending || 0))) : v.start?.[a.id] ?? a.balance);
  // A box left empty keeps today's balance; "$1,234.56" reads as 1234.56.
  const read = (key: string, was: number) => {
    const n = parseAmount(typed[key] ?? '');
    return isNaN(n) ? was : n;
  };
  const done = async (e?: Event) => {
    e?.preventDefault();
    const out: Record<string, { balance: number; pending: number }> = {};
    for (const a of accounts) out[a.id] = { balance: read(a.id, est(a)), pending: read(a.id + ':p', a.pending || 0) };
    setBusy(true);
    const ok = await saveBalances(out, Math.max(0, read('cushion', v.plan.cushion || 0)));
    setBusy(false);
    if (ok) setEditing(false);
  };
  const type = (key: string) => (e: Event) => setTyped({ ...typed, [key]: (e.target as HTMLInputElement).value });
  // Money as a plus, what a card owes as a minus.
  const today = (a: finance.Account) => (owed(a.kind) ? -(est(a) + (a.pending || 0)) : est(a));
  const at = (a: finance.Account, p: finance.Period) => (owed(a.kind) ? -(p.accounts?.[a.id] ?? 0) : p.accounts?.[a.id] ?? a.balance);
  const total = (f: (a: finance.Account) => number) => accounts.reduce((t, a) => t + f(a), 0);
  const change = (d: number) => Math.abs(d) >= 0.005 && <span class={'delta ' + (d < 0 ? 'bad' : 'ok')}>{signed(d)}</span>;
  const head = (p: finance.Period) => (p.now ? <><span>Until {dayShort(p.last)}</span><small>Now</small></> : <><span>{dayShort(p.pay.date)}</span><small>{p.pay.people.map((id) => L.person[id]?.name || id).join(' and ')}</small></>);
  return (
    <Card kind="finpost">
      <CardHead title={<>Accounts, paycheck by paycheck <span class="muted">post-pay, after the bills</span></>}>
        {/* Keyed apart: Update balances must not become Save under the same click, or the click submits it. */}
        <span class="toolbar">
          {editing && <button key="cancel" type="button" class="small" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>}
          {editing ? <button key="save" type="submit" form="finPostForm" class="primary small" disabled={busy}>Save</button>
            : saveBalances && <button key="update" type="button" class="small" onClick={() => { setTyped({}); setEditing(true); }} disabled={!accounts.length}>Update balances</button>}
        </span>
      </CardHead>
      {accounts.length ? <form id="finPostForm" onSubmit={done} onKeyDown={(e) => { if (e.key === 'Escape' && editing) { e.stopPropagation(); setEditing(false); } }}>
        <div class="finpostscroll">
          <table class="finpost">
            <thead><tr>
              <th scope="col">Account</th>
              <th scope="col" class="today"><span>Today</span><small>{editing ? 'Type what each has' : dayShort(v.today)}</small></th>
              {cols.map((p, i) => <th key={p.start} scope="col" class={i === sel ? 'on' : ''}><button type="button" aria-pressed={i === sel} onClick={() => pick(i)}>{head(p)}</button></th>)}
            </tr></thead>
            <tbody>
              {accounts.map((a, n) => {
                const typedNow = typed[a.id] !== undefined && !isNaN(parseAmount(typed[a.id])) ? parseAmount(typed[a.id]) - est(a) : 0;
                return <tr key={a.id}>
                  <th scope="row"><span class="acct"><Mark brand={a.institution} kind={a.kind} name={a.name} size="sm" /><span><strong>{a.name}</strong>{(a.kind === 'card' ? (a.pending ? `${money(a.pending)} pending` : '') : a.detail) && <small>{a.kind === 'card' ? `${money(a.pending)} pending` : a.detail}</small>}</span></span></th>
                  <td class="today">{editing
                    ? <span class="fininputs">
                        <input ref={n === 0 ? first : undefined} class="moneyin" inputmode="decimal" aria-label={`${a.name} ${owed(a.kind) ? 'owed' : 'today'}`} value={val(a.id, est(a))} onInput={type(a.id)} />
                        {a.kind === 'card' && <input class="moneyin" inputmode="decimal" aria-label={`${a.name} pending`} placeholder="Pending" value={val(a.id + ':p', a.pending || 0)} onInput={type(a.id + ':p')} />}
                        <small>{Math.abs(typedNow) >= 0.005 ? <>expected {money(est(a))}, <span class={typedNow < 0 === !owed(a.kind) ? 'bad' : 'ok'}>{signed(typedNow)}</span></> : `expected ${money(est(a))}`}</small>
                      </span>
                    : <span class="num">{money(today(a))}</span>}</td>
                  {cols.map((p, i) => {
                    const was = i ? at(a, cols[i - 1]) : today(a), now = at(a, p);
                    return <td key={p.start} class={i === sel ? 'on' : ''}><span class={'num' + (a.id === v.checking && p.left < (v.plan.cushion || 0) ? (p.left < 0 ? ' bad' : ' warn') : '')}>{money(now)}</span>{change(now - was)}</td>;
                  })}
                </tr>;
              })}
            </tbody>
            <tfoot><tr>
              <th scope="row">Total</th>
              <td class="today"><span class="num">{money(total(today))}</span></td>
              {cols.map((p, i) => <td key={p.start} class={i === sel ? 'on' : ''}><span class="num">{money(total((a) => at(a, p)))}</span></td>)}
            </tr></tfoot>
          </table>
        </div>
        {editing && <label class="field cushion">Flag checking under <span class="moneyfield"><span aria-hidden="true">{currencySign()}</span><input inputmode="decimal" value={val('cushion', v.plan.cushion || 0)} onInput={type('cushion')} /></span></label>}
      </form> : <Empty>No accounts yet.{add && <> <button class="small" onClick={() => add('account')}>Add your checking account</button></>}</Empty>}
    </Card>
  );
}

/** An axis label: "$2,500", "$40k", "−$1,000". */
const tick = (t: number) => (t < 0 ? '−' : '') + currencySign() + (Math.abs(t) >= 10000 ? `${Math.round(Math.abs(t) / 1000)}k` : Math.abs(t).toLocaleString('en-US'));

/** Checking at the end of each day, the picked paycheck's stretch shaded; pointing at a day says what happened on it. */
function Chart({ v, L, p, cushion }: { v: finance.View; L: Lookup; p: finance.Period; cushion: number }) {
  const [hover, setHover] = useState(-1);
  const days = v.days || [];
  if (days.length < 2) return null;
  const n = days.length, H = 180;
  const vals = days.map((d) => d.balance);
  const lo = Math.min(0, ...vals), hi = Math.max(cushion, ...vals, 1);
  const step = [100, 250, 500, 1000, 2000, 2500, 5000, 10000, 25000].find((s) => (hi - lo) / s <= 5) || 50000;
  const top = Math.ceil((hi * 1.04) / step) * step, bottom = Math.floor(lo / step) * step;
  const y = (x: number) => ((top - x) / (top - bottom || 1)) * H;
  let line = `M0 ${y(days[0].balance).toFixed(1)}`;
  days.forEach((d, i) => { if (i) line += ` V${y(d.balance).toFixed(1)}`; line += ` H${(((i + 1) / n) * 1000).toFixed(1)}`; });
  const area = `${line} V${y(Math.max(bottom, 0)).toFixed(1)} H0 Z`;
  const ticks: number[] = [];
  for (let t = bottom; t <= top + 0.01; t += step) ticks.push(t);
  const idx = (s: string) => days.findIndex((d) => d.date === s);
  const s0 = Math.max(0, idx(p.start)), s1 = idx(p.last) < 0 ? n : idx(p.last) + 1;
  const h = hover >= 0 ? days[hover] : null;
  const hx = ((hover + 0.5) / n) * 100;
  const move = (e: MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHover(Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n))));
  };
  const label = (ev: finance.Event) => (ev.people ? names(ev.people, L) : L.payment[ev.payment]?.name || ev.payment);
  return (
    <Card kind="finchart">
      <CardHead title="Checking, day by day"><span class="muted">{dayShort(days[0].date)} – {dayShort(days[n - 1].date)}</span></CardHead>
      <figure aria-label={`Checking each day from ${dayShort(days[0].date)} to ${dayShort(days[n - 1].date)}; the lowest is ${money(Math.min(...vals))}. The payments list has every number.`}>
        <div class="axis" aria-hidden="true">{ticks.map((t) => <span key={t} style={{ top: `${y(t) - 8}px` }}>{tick(t)}</span>)}</div>
        <div class="plot" style={{ height: `${H}px` }} onMouseMove={move} onMouseLeave={() => setHover(-1)}>
          {ticks.map((t) => <span key={t} class={'grid' + (t === 0 ? ' zero' : '')} style={{ top: `${y(t)}px` }} />)}
          <span class="cushion" style={{ top: `${y(cushion)}px` }} />
          <span class="span" style={{ left: `${(s0 / n) * 100}%`, width: `${((s1 - s0) / n) * 100}%` }} />
          <svg viewBox={`0 0 1000 ${H}`} preserveAspectRatio="none" aria-hidden="true"><path class="area" d={area} /><path class="line" d={line} vector-effect="non-scaling-stroke" /></svg>
          {h && <>
            <span class="cross" style={{ left: `${hx}%` }} />
            <span class="dotat" style={{ left: `${hx}%`, top: `${y(h.balance)}px` }} />
            <div class="tip" style={hx < 62 ? { left: `calc(${hx}% + 14px)` } : { right: `calc(${100 - hx}% + 14px)` }}>
              <div class="tiphead"><strong>{dayLong(h.date)}</strong><strong class="num">{money(h.balance)}</strong></div>
              {(h.events || []).slice(0, 6).map((ev, i) => <div key={i} class="tipline"><span>{label(ev)}</span><span class={'num' + (ev.amount > 0 ? ' ok' : '')}>{signed(ev.amount)}</span></div>)}
            </div>
          </>}
        </div>
        <div class="paymarks" aria-hidden="true">
          {days.map((d, i) => (d.events || []).filter((e) => e.people).map((e) => <span key={d.date} style={{ left: `${((i + 0.5) / n) * 100}%` }}><Whos ids={e.people} L={L} size="sm" /></span>))}
        </div>
      </figure>
    </Card>
  );
}

export function Overview({ v, L, sel, pick, saveBalances, add, setWaiting }: OverviewProps) {
  const cushion = v.plan.cushion || 0;
  const p = v.periods[Math.min(sel, v.periods.length - 1)];
  // Today's balances: as typed in, with what has happened since.
  const checking = v.start?.[v.checking] ?? L.account[v.checking]?.balance ?? 0;
  const cardList = (v.plan.accounts || []).filter((a) => a.kind === 'card');
  const cards = cardList.reduce((t, a) => t + (v.start?.[a.id] ?? a.balance + (a.pending || 0)), 0);
  if (!v.plan.accounts?.length && !v.plan.people?.length && !add) return <Card kind="finstart"><Empty>Nothing typed in yet: Finances are filled in on the computer, or on a phone allowed to change them.</Empty></Card>;
  if (!v.plan.accounts?.length && !v.plan.people?.length) {
    return (
      <Card kind="finstart">
        <h2>Start with three things</h2>
        <Rows>
          <Row lead={<Mark kind="checking" name="Checking" />} title="Your checking account" sub="Where paychecks land and bills come out" end={<button class="small" onClick={() => add('account')}>Add an account</button>} />
          <Row lead={<Mark kind="savings" name="Pay" />} title="Who gets paid, and when" sub="Every other Friday, the 26th, twice a month" end={<button class="small" onClick={() => add('person')}>Add a paycheck</button>} />
          <Row lead={<Mark kind="home" name="Bills" />} title="What comes out each month" sub="The mortgage, the car, subscriptions, a card's balance" end={<button class="small" onClick={() => add('payment')}>Add a payment</button>} />
        </Rows>
      </Card>
    );
  }
  return (
    <div class="fin">
      {!v.checking && (
        <Card kind="finnote" role="status">
          <Mark kind="checking" name="Checking" />
          <span class="grow"><strong>No checking account yet.</strong> Paychecks land in it and payments come out of it, so until there is one every balance below reads $0.00.</span>
          {add && <button class="small" onClick={() => add('account')}>Add your checking account</button>}
        </Card>
      )}
      {!!v.since?.length && <Since v={v} L={L} set={setWaiting} />}
      <Hero p={p} next={v.periods[1]} L={L} cushion={cushion} cards={cards} hasCards={cardList.length > 0} checking={checking} />
      {v.periods.length > 1 && <Checks v={v} L={L} sel={sel} pick={pick} cushion={cushion} />}
      <PostPay v={v} L={L} sel={Math.min(sel, v.periods.length - 1)} pick={pick} saveBalances={saveBalances} add={add} />
      <Payments p={p} L={L} cushion={cushion} />
      <Chart v={v} L={L} p={p} cushion={cushion} />
    </div>
  );
}
