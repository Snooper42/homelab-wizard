// Finances › Transactions: what actually happened, from the ledger
// (data/finance-ledger.json), newest first and by day: each with its
// payee's mark, its category and account, Receipt when one is kept with
// it, and what it came to, money in green. Above them, this month's money
// in and out (a transfer between the household's accounts is neither), and
// a search with filters: words in the payee, category, note, or tags, an
// account, a category, a tag, a month, and money in or out. A row opens
// its form; on a phone allowed only to look, only a row with a receipt
// opens, to show the receipt under it.
import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Empty } from '../parts/Empty';
import { Row, Rows } from '../parts/Row';
import { Amount, Stat } from './ui/Amount';
import { Widget } from './ui/Widget';
import { Mark, payeeBrand } from './Mark';
import { BudgetsWidget } from './widgets/Budgets';
import { inHome } from './model';
import { dayLong, type Lookup, monthName, plural } from './money';
import { tagsOf } from './reportData';

export interface TransactionsProps {
  v: finance.View;
  L: Lookup;
  /** The ledger; null until it is read. */
  ledger: finance.Ledger | null;
  /** Opens a transaction's form, or the categories; none on a phone allowed only to look. */
  edit?: (what: 'transaction' | 'categories' | 'budgets' | 'import', id?: string) => void;
  /** Reads a receipt by its name, for a phone allowed only to look (its rows open no form). */
  readReceipt?: (name: string) => Promise<string>;
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

/** A transaction's mark: its payee's logo, a transfer's arrows, else its category's icon, else its payee's first letter. */
export function TxMark({ t, size, categories }: { t: finance.Transaction; size?: 'sm' | 'lg'; categories?: finance.Category[] }) {
  const brand = t.to ? undefined : payeeBrand(t.institution, t.payee);
  const icon = t.to ? 'savings' : iconOf(categories, t.splits?.length ? t.splits[0].category : t.category);
  return <Mark brand={brand} kind={brand ? undefined : icon} name={t.payee || '?'} type={brand ? undefined : icon} size={size} />;
}

/** What a transaction is, in words: its payee, or where a transfer went. */
export const txTitle = (t: finance.Transaction, L: Lookup): string => t.payee || (t.to ? `To ${L.account[t.to]?.name || 'another account'}` : 'No payee');

/** A transaction's categories: its own, or its parts'. */
const catsOf = (t: finance.Transaction): string[] => (t.splits?.length ? t.splits.map((s) => s.category) : t.category ? [t.category] : []);

/** The words a search looks through: payee, categories, note, tags, and the accounts. */
const wordsOf = (t: finance.Transaction, L: Lookup): string => [t.payee, ...catsOf(t), t.note, ...(t.tags || []), L.account[t.account]?.name, t.to && L.account[t.to]?.name].filter(Boolean).join(' ').toLowerCase();

export function Transactions({ v, L, ledger, edit, readReceipt }: TransactionsProps) {
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
  const [account, setAccount] = useState('');
  const [category, setCategory] = useState('');
  const [month, setMonthPick] = useState('');
  const [way, setWay] = useState('');
  const [tag, setTag] = useState('');
  if (!ledger) return <div class="fin"><Empty>Reading…</Empty></div>;
  const all = ledger.transactions;
  // What each came to in the plan's currency, so the totals add up (an account may keep another).
  const home = new Map(inHome(v.plan, all).map((t) => [t.id, t.amount]));
  const amt = (t: finance.Transaction) => home.get(t.id) ?? t.amount;
  const cats = [...new Set(all.flatMap(catsOf))].sort();
  const tags = tagsOf(all);
  const months = [...new Set(all.map((t) => t.date.slice(0, 7)))].sort().reverse();
  const want = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = all.filter((t) => (!account || t.account === account || t.to === account)
    && (!category || catsOf(t).includes(category))
    && (!month || t.date.startsWith(month))
    && (!tag || !!t.tags?.includes(tag))
    && (!way || (way === 'move' ? !!t.to : !t.to && (way === 'in' ? t.amount > 0 : t.amount < 0)))
    && want.every((w) => wordsOf(t, L).includes(w)));
  const filtered = shown.length !== all.length;
  const list = [...shown].reverse();
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
        <BudgetsWidget v={v} edit={edit ? () => edit('budgets') : undefined} />
        <Widget title={filtered ? `${plural(shown.length, 'transaction')} of ${all.length}` : 'Transactions'} span="all" kind="fx-transactions"
          actions={edit && <>
            <button type="button" class="small" onClick={() => edit('import')}>Import a file</button>
            <button type="button" class="small" onClick={() => edit('categories')}>Categories</button>
          </>}>
          {!!all.length && <div class="fx-txfilters" role="search" aria-label="Find transactions">
            <input type="search" class="fx-txsearch" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} placeholder="Search payee, category, note" aria-label="Search transactions" />
            <select aria-label="Account" value={account} onChange={(e) => setAccount((e.target as HTMLSelectElement).value)}>
              <option value="">Every account</option>
              {(v.plan.accounts || []).filter((a) => all.some((t) => t.account === a.id || t.to === a.id)).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
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
          {filtered && !!shown.length && <p class="fx-sub fx-txtotal">Together <Amount value={shown.filter((t) => !t.to || account).reduce((s, t) => s + (account && t.to === account ? -amt(t) : amt(t)), 0)} form="full" sign /></p>}
          {days.map((d) => (
            <section key={d.date} class="fx-txday" aria-label={dayLong(d.date)}>
              <h3>{dayLong(d.date)}{d.date === v.today ? ', today' : ''}</h3>
              <Rows kind="fx-rows">
                {d.list.map((t) => {
                  const a = L.account[t.account];
                  const where = t.to ? `${a?.name || t.account} → ${L.account[t.to]?.name || t.to}` : a?.name || t.account;
                  const what = t.splits?.length ? t.splits.map((s) => s.category).join(', ') : t.category || (t.to ? 'Transfer' : 'No category');
                  const opens = edit ? () => edit('transaction', t.id) : t.receipt && readReceipt ? () => look(t) : undefined;
                  const open = seen?.id === t.id ? seen : null;
                  return <Fragment key={t.id}><Row lead={<TxMark t={t} categories={v.categories} />} title={txTitle(t, L)}
                    sub={<>{what} · {where}{t.receipt && <span class="fx-txreceipt"> · Receipt</span>}{t.note && <span class="fx-txnote"> · {t.note}</span>}{!!t.tags?.length && <span class="fx-txtags">{t.tags.map((x) => <span key={x} class="fx-tag">{x}</span>)}</span>}</>}
                    when={<Amount value={t.amount} sign={t.amount > 0} tone={t.amount > 0 && !t.to ? 'in' : ''} form="full" currency={a?.currency} />} whenPlain
                    onOpen={opens} openLabel={edit ? 'edit' : opens ? (open ? 'hide the receipt' : 'see the receipt') : undefined} />
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
