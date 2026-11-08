// Finances › Transactions: what actually happened, from the ledger
// (data/finance-ledger.json), newest first and by day: each with its
// payee's mark, its category and account, Receipt when one is kept with
// it, and what it came to, money in green. Above them, this month's money
// in and out (a transfer between the household's accounts is neither), and
// a search with filters: words in the payee, category, note, or tags, an
// account, a category, a tag, a month, and money in or out. A row opens
// its form; on a phone allowed only to look, only a row with a receipt
// opens, to show the receipt under it. A row that pays a planned payment
// says so; above them, those that look like one but are not linked yet,
// each to link with a click or say Not it. Select picks rows (Select all
// takes every one shown, so a filter then Select all is a whole import or
// month; Shift+click a range) to delete together, give one category, or
// move to another account, each with Undo after.
import { Fragment } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Empty } from '../parts/Empty';
import { Row, Rows } from '../parts/Row';
import { Amount, Stat } from './ui/Amount';
import { Widget } from './ui/Widget';
import { Mark, payeeBrand, paysAlike } from './Mark';
import { joined, type Pair, pairs, suggestLinks } from './importData';
import { categoryHue } from './hues';
import { BudgetsWidget } from './widgets/Budgets';
import { inHome } from './model';
import { allPayments, dayLong, dayShort, type Lookup, money, monthName, plural } from './money';
import { tagsOf } from './reportData';
import { showUndo } from '../status/UndoNote';

export interface TransactionsProps {
  v: finance.View;
  L: Lookup;
  /** The ledger; null until it is read. */
  ledger: finance.Ledger | null;
  /** Opens a transaction's form, or the categories; none on a phone allowed only to look. */
  edit?: (what: 'transaction' | 'categories' | 'budgets' | 'import', id?: string) => void;
  /** Reads a receipt by its name, for a phone allowed only to look (its rows open no form). */
  readReceipt?: (name: string) => Promise<string>;
  /** Keeps the ledger, for a link made or said Not it; none on a phone allowed only to look. */
  saveLedger?: (l: finance.Ledger) => Promise<boolean>;
}

/**
 * Transactions that look like a planned payment but are not linked to it:
 * each says which and what was planned, with Link and Not it, and Link all.
 * A linked one is taken as that payment's, so the plan does not take it
 * out again on its day.
 */
function LinksWidget({ v, L, ledger, save }: { v: finance.View; L: Lookup; ledger: finance.Ledger; save: (l: finance.Ledger) => Promise<boolean> }) {
  const [busy, setBusy] = useState(false);
  const found = suggestLinks(ledger.transactions, allPayments(v.plan).filter((x) => !x.card), v.dues || {}, v.checking, paysAlike);
  if (!found.size) return null;
  const list = ledger.transactions.filter((t) => found.has(t.id)).reverse();
  const keep = async (change: (t: finance.Transaction) => finance.Transaction) => {
    if (busy) return;
    setBusy(true);
    await save({ ...ledger, transactions: ledger.transactions.map(change) });
    setBusy(false);
  };
  const link = (ids: string[]) => keep((t) => (ids.includes(t.id) ? { ...t, payment: found.get(t.id)!.payment } : t));
  const notIt = (id: string) => keep((t) => (t.id === id ? { ...t, notPlanned: true } : t));
  return (
    <Widget title="These look like planned payments" span="all" kind="fx-links"
      actions={list.length > 1 && <button type="button" class="small" disabled={busy} onClick={() => link(list.map((t) => t.id))}>Link all {list.length}</button>}>
      <p class="fx-sub fx-lead">Linked, one is taken as paying it, so the plan doesn't take it out again on its day.</p>
      <Rows kind="fx-rows">
        {list.map((t) => {
          const g = found.get(t.id)!, x = L.payment[g.payment];
          return <Row key={t.id} lead={<TxMark t={t} categories={v.categories} />} title={txTitle(t, L)}
            sub={`${dayLong(t.date)} · looks like ${x?.name || g.payment}, planned ${money(x?.amount || 0)} for ${dayShort(g.due)}`}
            when={<Amount value={t.amount} sign={t.amount > 0} tone={t.amount > 0 ? 'in' : ''} form="full" />} whenPlain
            end={<span class="fx-linkbtns">
              <button type="button" class="small" disabled={busy} aria-label={`Link ${t.payee || 'it'} on ${dayLong(t.date)} to ${x?.name}`} onClick={() => link([t.id])}>Link</button>
              <button type="button" class="small" disabled={busy} aria-label={`${t.payee || 'It'} on ${dayLong(t.date)} is not ${x?.name}`} onClick={() => notIt(t.id)}>Not it</button>
            </span>} />;
        })}
      </Rows>
    </Widget>
  );
}

/** A receipt as kept: a picture, or a PDF in a frame (with words where a frame shows no PDF). */
export function ReceiptView({ url }: { url: string }) {
  return url.startsWith('data:application/pdf')
    ? <object class="receiptview pdf" data={url} type="application/pdf" aria-label="The receipt"><p class="muted">A PDF receipt, kept with this transaction.</p></object>
    : <img class="receiptview" src={url} alt="The receipt" />;
}

/** A category's icon: its own, else its group's; none, none. */
export function iconOf(categories: finance.Category[] | undefined, name: string | undefined): string | undefined {
  const c = (categories || []).find((q) => q.name.toLowerCase() === (name || '').toLowerCase());
  return c?.icon || (c?.parent ? iconOf(categories, c.parent) : undefined);
}

/**
 * A transaction's mark: its payee's logo, a transfer's arrows, its
 * category's icon, else its payee's own mark (its initials on its colour)
 * where there would be a plain letter; a payee whose logo was set to None
 * keeps the letter.
 */
export function TxMark({ t, size, categories }: { t: finance.Transaction; size?: 'sm' | 'lg'; categories?: finance.Category[] }) {
  const brand = t.to ? undefined : payeeBrand(t.institution, t.payee);
  const cat = t.splits?.length ? t.splits[0].category : t.category;
  const icon = t.to ? 'savings' : iconOf(categories, cat);
  return <Mark brand={brand} kind={brand ? undefined : icon} name={t.payee || '?'} type={brand ? undefined : icon} size={size} auto={!t.to && !icon && t.institution !== 'none' && !!t.payee?.trim()} hue={t.to ? undefined : categoryHue(cat, categories)} />;
}

/** What a transaction is, in words: its payee, or where a transfer went. */
export const txTitle = (t: finance.Transaction, L: Lookup): string => t.payee || (t.to ? `To ${L.account[t.to]?.name || 'another account'}` : 'No payee');

/** A transaction's categories: its own, or its parts'. */
const catsOf = (t: finance.Transaction): string[] => (t.splits?.length ? t.splits.map((s) => s.category) : t.category ? [t.category] : []);

/** The words a search looks through: payee, categories, note, tags, and the accounts. */
const wordsOf = (t: finance.Transaction, L: Lookup): string => [t.payee, ...catsOf(t), t.note, ...(t.tags || []), L.account[t.account]?.name, t.to && L.account[t.to]?.name].filter(Boolean).join(' ').toLowerCase();

/**
 * Rows that look like one transfer between the household's own accounts,
 * a minus on one and the same plus on another a few days apart: Join
 * makes them one (neither spending nor income), Not one transfer keeps
 * them apart and stops asking.
 */
function PairsWidget({ L, ledger, save }: { L: Lookup; ledger: finance.Ledger; save: (l: finance.Ledger) => Promise<boolean> }) {
  const [busy, setBusy] = useState(false);
  const list = pairs(ledger.transactions);
  if (!list.length) return null;
  const keep = async (change: (txs: finance.Transaction[]) => finance.Transaction[]) => {
    if (busy) return;
    setBusy(true);
    await save({ ...ledger, transactions: change(ledger.transactions) });
    setBusy(false);
  };
  const join = (ps: Pair[]) => keep((txs) => {
    const gone = new Set(ps.map((p) => p.in.id)), made = new Map(ps.map((p) => [p.out.id, joined(p)]));
    return txs.filter((t) => !gone.has(t.id)).map((t) => made.get(t.id) || t);
  });
  const apart = (p: Pair) => keep((txs) => txs.map((t) => (t.id === p.out.id || t.id === p.in.id ? { ...t, apart: true } : t)));
  const name = (id: string) => L.account[id]?.name || id;
  return (
    <Widget title="These look like transfers" span="all" kind="fx-pairs"
      actions={list.length > 1 && <button type="button" class="small" disabled={busy} onClick={() => join(list)}>Join all {list.length}</button>}>
      <p class="fx-sub fx-lead">Money out of one of your accounts and the same into another: joined, it is one transfer, neither spending nor income.</p>
      <Rows kind="fx-rows">
        {list.map((p) => (
          <Row key={p.out.id + p.in.id} lead={<TxMark t={joined(p)} />} title={`${name(p.out.account)} → ${name(p.in.account)}`}
            sub={`${p.out.payee || 'Out'}, ${dayShort(p.out.date)} · ${p.in.payee || 'in'}, ${dayShort(p.in.date)}`}
            when={<Amount value={-p.out.amount} form="full" />} whenPlain
            end={<span class="fx-linkbtns">
              <button type="button" class="small" disabled={busy} aria-label={`Join ${money(-p.out.amount)} from ${name(p.out.account)} to ${name(p.in.account)}`} onClick={() => join([p])}>Join</button>
              <button type="button" class="small" disabled={busy} aria-label={`${money(-p.out.amount)} from ${name(p.out.account)} to ${name(p.in.account)} is not one transfer`} onClick={() => apart(p)}>Not one transfer</button>
            </span>} />
        ))}
      </Rows>
    </Widget>
  );
}

export function Transactions({ v, L, ledger, edit, readReceipt, saveLedger }: TransactionsProps) {
  // The receipt shown under its row, on a phone allowed only to look: read, still reading, or why not.
  const [seen, setSeen] = useState<{ id: string; url?: string; problem?: string } | null>(null);
  const look = async (t: finance.Transaction) => {
    if (seen?.id === t.id) { setSeen(null); return; }
    setSeen({ id: t.id });
    // Read late, after another row was opened (or this one closed), it is not shown.
    const still = (next: { id: string; url?: string; problem?: string }) => setSeen((now) => (now?.id === t.id ? next : now));
    try { still({ id: t.id, url: await readReceipt!(t.receipt!) }); } catch (e) { still({ id: t.id, problem: String((e as Error)?.message || e) }); }
  };
  const [q, setQ] = useState('');
  const [accountPick, setAccount] = useState('');
  const [categoryPick, setCategory] = useState('');
  const [monthPick, setMonthPick] = useState('');
  const [way, setWay] = useState('');
  const [tagPick, setTag] = useState('');
  // Picking rows to change together: which are picked, the category typed for them, Delete asked once, saving.
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [catFor, setCatFor] = useState('');
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  // While selecting, outside a field or a sheet: Ctrl+A (⌘A) selects every row shown, Escape stops selecting (Shortcuts.tsx says so).
  const keyed = useRef({ all: () => {}, stop: () => {} });
  // The ledger as now, for an Undo pressed after it changed.
  const latest = useRef(ledger);
  // The row last clicked while selecting, where a Shift+click's range starts.
  const anchor = useRef('');
  latest.current = ledger;
  useLayoutEffect(() => {
    if (!picking) return undefined;
    const keys = (e: KeyboardEvent) => {
      if (e.defaultPrevented || document.documentElement.classList.contains('sheet-open') || !document.getElementById('finances')?.classList.contains('active')) return;
      if ((e.target as Element).closest?.('input, textarea, select, [contenteditable], [role=menu], dialog, .sheet')) return;
      if (e.key === 'Escape') { e.preventDefault(); keyed.current.stop(); }
      else if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'a') { e.preventDefault(); keyed.current.all(); }
    };
    document.addEventListener('keydown', keys);
    return () => document.removeEventListener('keydown', keys);
  }, [picking]);
  if (!ledger) return <div class="fin"><Empty>Reading…</Empty></div>;
  const all = ledger.transactions;
  // What each came to in the plan's currency, so the totals add up (an account may keep another).
  const home = new Map(inHome(v.plan, all).map((t) => [t.id, t.amount]));
  const amt = (t: finance.Transaction) => home.get(t.id) ?? t.amount;
  const cats = [...new Set(all.flatMap(catsOf))].sort();
  const tags = tagsOf(all);
  const months = [...new Set(all.map((t) => t.date.slice(0, 7)))].sort().reverse();
  const accounts = (v.plan.accounts || []).filter((a) => all.some((t) => t.account === a.id || t.to === a.id));
  // A pick whose last transaction went (deleted, or moved to another category or month) filters by
  // nothing: its menu would show Every … while the list stayed empty.
  const account = accounts.some((a) => a.id === accountPick) ? accountPick : '';
  const category = cats.includes(categoryPick) ? categoryPick : '';
  const month = months.includes(monthPick) ? monthPick : '';
  const tag = tags.includes(tagPick) ? tagPick : '';
  const want = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = all.filter((t) => (!account || t.account === account || t.to === account)
    && (!category || catsOf(t).includes(category))
    && (!month || t.date.startsWith(month))
    && (!tag || !!t.tags?.includes(tag))
    && (!way || (way === 'move' ? !!t.to : !t.to && (way === 'in' ? t.amount > 0 : t.amount < 0)))
    && want.every((w) => wordsOf(t, L).includes(w)));
  const filtered = shown.length !== all.length;
  const list = [...shown].reverse();
  // What the picked act on: those picked that the filters still show.
  const chosen = shown.filter((t) => picked.has(t.id));
  const pick = (ids: Set<string>) => { setPicked(ids); setSure(false); setProblem(''); };
  // A click picks a row or lets it go; Shift+click picks every row from the last one clicked to it, as shown.
  const toggle = (id: string, range: boolean) => {
    const next = new Set(picked), order = list.map((t) => t.id), from = anchor.current ? order.indexOf(anchor.current) : -1, to = order.indexOf(id);
    if (range && from >= 0 && to >= 0) for (const x of order.slice(Math.min(from, to), Math.max(from, to) + 1)) next.add(x);
    else if (next.has(id)) next.delete(id); else next.add(id);
    anchor.current = id;
    pick(next);
  };
  const stopPicking = () => { setPicking(false); pick(new Set()); setCatFor(''); anchor.current = ''; };
  const pickAll = () => pick(new Set([...picked, ...shown.map((t) => t.id)]));
  keyed.current = { all: pickAll, stop: stopPicking };
  const change = async (txs: finance.Transaction[]) => {
    if (busy || !saveLedger) return false;
    setBusy(true);
    const ok = await saveLedger({ ...ledger, transactions: txs });
    setBusy(false);
    if (ok) pick(new Set()); else setProblem('It could not be kept: try again.');
    return ok;
  };
  // A change to the picked, kept, then undone with Undo (or ⌘Z) while its note shows: each as it was put back
  // into the ledger as it is then, a deleted one in again.
  const undoable = async (words: string, was: finance.Transaction[], txs: finance.Transaction[]) => {
    if (!(await change(txs))) return;
    showUndo(words, () => {
      const now = latest.current;
      if (!now || !saveLedger) return;
      const back = new Map(was.map((t) => [t.id, t])), there = new Set(now.transactions.map((t) => t.id));
      saveLedger({ ...now, transactions: [...now.transactions.map((t) => back.get(t.id) || t), ...was.filter((t) => !there.has(t.id))] });
    });
  };
  const removePicked = () => {
    if (!sure) { setSure(true); return; }
    const ids = new Set(chosen.map((t) => t.id));
    undoable(`Deleted ${plural(chosen.length, 'transaction')}`, chosen, all.filter((t) => !ids.has(t.id)));
  };
  // A category for each picked one that is not a transfer between the household's accounts; its parts, if split, are let go.
  const categorize = () => {
    const was = chosen.filter((t) => !t.to), ids = new Set(was.map((t) => t.id)), c = catFor.trim();
    if (!ids.size) { setProblem('Transfers between your accounts take no category.'); return; }
    undoable(c ? `${plural(was.length, 'transaction')} put in ${c}` : `Took the category off ${plural(was.length, 'transaction')}`, was,
      all.map((t) => (ids.has(t.id) ? { ...t, category: c || undefined, splits: undefined } : t)));
  };
  // Into another account (a file brought into the wrong one): a transfer keeps the account it went into, so not one into this.
  const moveTo = (acct: string) => {
    const was = chosen.filter((t) => t.account !== acct && t.to !== acct), ids = new Set(was.map((t) => t.id));
    if (!ids.size) { setProblem(chosen.some((t) => t.to === acct) ? 'A transfer can’t come out of the account it goes into.' : 'They are in it already.'); return; }
    undoable(`Moved ${plural(was.length, 'transaction')} to ${L.account[acct]?.name || acct}`, was, all.map((t) => (ids.has(t.id) ? { ...t, account: acct } : t)));
  };
  const into = (v.plan.accounts || []).filter((a) => a.kind !== 'home' && a.kind !== 'car' && a.kind !== 'collectible');
  const now = v.today.slice(0, 7);
  const thisMonth = all.filter((t) => t.date.startsWith(now) && !t.to);
  const sum = (f: (t: finance.Transaction) => boolean) => thisMonth.filter(f).reduce((s, t) => s + amt(t), 0);
  // By day, newest first, each day's transactions as they were entered, latest on top.
  const days: { date: string; list: finance.Transaction[] }[] = [];
  for (const t of list) {
    if (days.at(-1)?.date !== t.date) days.push({ date: t.date, list: [] });
    days.at(-1)!.list.push(t);
  }
  return (
    <div class="fin">
      <div class="fx-board">
        <Widget title="This month" span="all" kind="fx-txsum">
          <div class="fx-stats">
            <Stat value={<Amount value={sum((t) => t.amount > 0)} form="whole" tone="in" />} caption="Money in" />
            <Stat value={<Amount value={-sum((t) => t.amount < 0)} form="whole" tone="out" />} caption="Money out" />
            <Stat value={<Amount value={sum(() => true)} form="whole" sign tone="auto" />} caption={plural(thisMonth.length, 'transaction')} />
          </div>
        </Widget>
        {saveLedger && <PairsWidget L={L} ledger={ledger} save={saveLedger} />}
        {saveLedger && <LinksWidget v={v} L={L} ledger={ledger} save={saveLedger} />}
        <BudgetsWidget v={v} edit={edit ? () => edit('budgets') : undefined} />
        <Widget title={filtered ? `${plural(shown.length, 'transaction')} of ${all.length}` : 'Transactions'} span="all" kind="fx-transactions"
          actions={edit && <>
            {saveLedger && !!all.length && <button type="button" class="small" aria-pressed={picking} onClick={() => (picking ? stopPicking() : setPicking(true))}>{picking ? 'Done' : 'Select'}</button>}
            <button type="button" class="small" onClick={() => edit('import')}>Import a file</button>
            <button type="button" class="small" onClick={() => edit('categories')}>Categories</button>
          </>}>
          {!!all.length && <div class="fx-txfilters" role="search" aria-label="Find transactions">
            <input type="search" class="fx-txsearch" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} placeholder="Search payee, category, note" aria-label="Search transactions" />
            <select aria-label="Account" value={account} onChange={(e) => setAccount((e.target as HTMLSelectElement).value)}>
              <option value="">Every account</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select aria-label="Category" value={category} onChange={(e) => setCategory((e.target as HTMLSelectElement).value)}>
              <option value="">Every category</option>
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {!!tags.length && <select aria-label="Tag" value={tag} onChange={(e) => setTag((e.target as HTMLSelectElement).value)}>
              <option value="">Every tag</option>
              {tags.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>}
            <select aria-label="Month" value={month} onChange={(e) => setMonthPick((e.target as HTMLSelectElement).value)}>
              <option value="">Every month</option>
              {months.map((m) => <option key={m} value={m}>{monthName(m + '-01')} {m.slice(0, 4)}</option>)}
            </select>
            <select aria-label="In or out" value={way} onChange={(e) => setWay((e.target as HTMLSelectElement).value)}>
              <option value="">In and out</option>
              <option value="out">Money out</option>
              <option value="in">Money in</option>
              <option value="move">Between my accounts</option>
            </select>
            {filtered && <button type="button" class="small" onClick={() => { setQ(''); setAccount(''); setCategory(''); setMonthPick(''); setWay(''); setTag(''); }}>Show all</button>}
          </div>}
          {picking && <div class="fx-txpick" role="group" aria-label="The selected transactions">
            <span class="fx-txpicked" role="status">{chosen.length ? `${plural(chosen.length, 'transaction')} selected` : 'None selected: click a row to select it'}</span>
            {chosen.length < shown.length
              ? <button type="button" class="small" disabled={busy} onClick={pickAll}>Select all {shown.length}</button>
              : <button type="button" class="small" disabled={busy} onClick={() => pick(new Set())}>Select none</button>}
            {!!chosen.length && <>
              <span class="fx-txpickcat">
                <input value={catFor} onInput={(e) => setCatFor((e.target as HTMLInputElement).value)} list="fxPickCategories" placeholder="Category" aria-label="Category for the selected" />
                <button type="button" class="small" disabled={busy} onClick={categorize}>{catFor.trim() ? 'Set category' : 'Clear category'}</button>
              </span>
              {into.length > 1 && <select class="fx-txpickmove" aria-label="Move the selected to an account" value="" disabled={busy} onChange={(e) => { const a = (e.target as HTMLSelectElement).value; if (a) moveTo(a); }}>
                <option value="">Move to…</option>
                {into.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>}
              <button type="button" class="small danger" disabled={busy} onClick={removePicked}>{sure ? `Click again to delete ${plural(chosen.length, 'transaction')}` : `Delete ${chosen.length}`}</button>
            </>}
            {problem && <span class="formerr bad" role="alert">{problem}</span>}
            <datalist id="fxPickCategories">{[...new Set([...(v.categories || []).map((c) => c.name), ...cats])].map((c) => <option key={c} value={c} />)}</datalist>
          </div>}
          {filtered && !!shown.length && <p class="fx-sub fx-txtotal">Together <Amount value={shown.filter((t) => !t.to || account).reduce((s, t) => s + (account && t.to === account ? -amt(t) : amt(t)), 0)} form="full" sign /></p>}
          {days.map((d) => (
            <section key={d.date} class="fx-txday" aria-label={dayLong(d.date)}>
              <h3>{dayLong(d.date)}{d.date === v.today ? ', today' : ''}</h3>
              <Rows kind="fx-rows">
                {d.list.map((t) => {
                  const a = L.account[t.account];
                  const where = t.to ? `${a?.name || t.account} → ${L.account[t.to]?.name || t.to}` : a?.name || t.account;
                  const what = t.splits?.length ? t.splits.map((s) => s.category).join(', ') : t.category || (t.to ? 'Transfer' : 'No category');
                  const on = picking && picked.has(t.id);
                  const opens = picking ? (e: MouseEvent) => toggle(t.id, e.shiftKey) : edit ? () => edit('transaction', t.id) : t.receipt && readReceipt ? () => look(t) : undefined;
                  const open = !picking && seen?.id === t.id ? seen : null;
                  return <Fragment key={t.id}><Row lead={picking ? <><span class={'fx-check' + (on ? ' on' : '')} aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" /></svg></span><TxMark t={t} categories={v.categories} /></> : <TxMark t={t} categories={v.categories} />} title={txTitle(t, L)}
                    sub={<>{what} · {where}{t.payment && L.payment[t.payment] && <span class="fx-txpays"> · pays {L.payment[t.payment].name}</span>}{t.receipt && <span class="fx-txreceipt"> · Receipt</span>}{t.note && <span class="fx-txnote"> · {t.note}</span>}{!!t.tags?.length && <span class="fx-txtags">{t.tags.map((x) => <span key={x} class="fx-tag">{x}</span>)}</span>}</>}
                    when={<Amount value={t.amount} sign={t.amount > 0} tone={t.amount > 0 && !t.to ? 'in' : ''} form="full" currency={a?.currency} />} whenPlain
                    onOpen={opens} pressed={picking ? on : undefined} openLabel={picking ? undefined : edit ? 'edit' : opens ? (open ? 'hide the receipt' : 'see the receipt') : undefined} />
                    {open && <li class="fx-receiptshown">{open.url ? <ReceiptView url={open.url} /> : open.problem ? <span class="formerr bad" role="alert">{open.problem}</span> : <span class="muted" role="status">Reading the receipt…</span>}</li>}
                  </Fragment>;
                })}
              </Rows>
            </section>
          ))}
          {!all.length && <Empty>{edit ? 'No transactions yet: add what you spend with Add a transaction, as it happens or from the receipt.' : 'No transactions yet.'}</Empty>}
          {!!all.length && !shown.length && <Empty>None match: try fewer words, or Show all.</Empty>}
        </Widget>
      </div>
    </div>
  );
}
