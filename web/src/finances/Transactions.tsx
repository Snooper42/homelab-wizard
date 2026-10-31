// Finances › Transactions: what actually happened, from the ledger
// (data/finance-ledger.json), newest first and by day: each with its
// payee's mark, its category and account, and what it came to, money in
// green. Above them, this month's money in and out (a transfer between
// the household's accounts is neither). A row opens its form; on a phone
// allowed only to look, nothing opens.
import { Empty } from '../parts/Empty';
import { Row, Rows } from '../parts/Row';
import { Amount, Stat } from './ui/Amount';
import { Widget } from './ui/Widget';
import { brandOf, Mark } from './Mark';
import { dayLong, type Lookup, plural } from './money';

export interface TransactionsProps {
  v: finance.View;
  L: Lookup;
  /** The ledger; null until it is read. */
  ledger: finance.Ledger | null;
  /** Opens a transaction's form; none on a phone allowed only to look. */
  edit?: (what: 'transaction', id: string) => void;
}

/** A transaction's mark: its payee's logo, a transfer's arrows, else its payee's first letter. */
export function TxMark({ t, size }: { t: finance.Transaction; size?: 'sm' | 'lg' }) {
  return <Mark brand={t.to ? undefined : brandOf(t.institution, t.payee)} kind={t.to ? 'savings' : undefined} name={t.payee || '?'} size={size} />;
}

/** What a transaction is, in words: its payee, or where a transfer went. */
export const txTitle = (t: finance.Transaction, L: Lookup): string => t.payee || (t.to ? `To ${L.account[t.to]?.name || 'another account'}` : 'No payee');

export function Transactions({ v, L, ledger, edit }: TransactionsProps) {
  if (!ledger) return <div class="fin"><Empty>Reading…</Empty></div>;
  const list = [...ledger.transactions].reverse();
  const month = v.today.slice(0, 7);
  const thisMonth = ledger.transactions.filter((t) => t.date.startsWith(month) && !t.to);
  const sum = (f: (t: finance.Transaction) => boolean) => thisMonth.filter(f).reduce((s, t) => s + t.amount, 0);
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
        <Widget title="Transactions" span="all" kind="fx-transactions">
          {days.map((d) => (
            <section key={d.date} class="fx-txday" aria-label={dayLong(d.date)}>
              <h3>{dayLong(d.date)}{d.date === v.today ? ', today' : ''}</h3>
              <Rows kind="fx-rows">
                {d.list.map((t) => {
                  const a = L.account[t.account];
                  const where = t.to ? `${a?.name || t.account} → ${L.account[t.to]?.name || t.to}` : a?.name || t.account;
                  const what = t.splits?.length ? t.splits.map((s) => s.category).join(', ') : t.category || (t.to ? 'Transfer' : 'No category');
                  return <Row key={t.id} lead={<TxMark t={t} />} title={txTitle(t, L)}
                    sub={<>{what} · {where}{t.note && <span class="fx-txnote"> · {t.note}</span>}</>}
                    when={<Amount value={t.amount} sign={t.amount > 0} tone={t.amount > 0 && !t.to ? 'in' : ''} form="full" />} whenPlain
                    onOpen={edit ? () => edit('transaction', t.id) : undefined} openLabel={edit ? 'edit' : undefined} />;
                })}
              </Rows>
            </section>
          ))}
          {!days.length && <Empty>{edit ? 'No transactions yet: add what you spend with Add a transaction, as it happens or from the receipt.' : 'No transactions yet.'}</Empty>}
        </Widget>
      </div>
    </div>
  );
}
