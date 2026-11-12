// A loan on its account's page (the owner, Nov 12: their share of the
// mortgage goes as a Zelle payment to the person they share it with): what
// is left and when it is paid off, the plan's payment each month (theirs,
// and the whole one when the papers say more), its rate, and this month's
// interest against what comes off; then the payments linked to it (a
// transaction's `payment`), one paid over the plan's asked about each time
// (the owner's pick: Count it keeps it counted in full, `extra`; Not this
// one takes it off), the same payee's next ones offered to link by
// themselves, and Link a payment… for any other.
import { useState } from 'preact/hooks';
import { Rows } from '../parts/Row';
import { Amount } from './ui/Amount';
import { Widget } from './ui/Widget';
import { TxRow } from './widgets/Latest';
import { payoffWords } from './widgets/Loans';
import { alike } from './importData';
import { allPayments, dayShort, type Lookup, money, monthName } from './money';

export interface LoanProps {
  v: finance.View;
  L: Lookup;
  ledger: finance.Ledger | null;
  a: finance.Account;
  /** Saves the ledger with a change; none on a phone allowed only to look. */
  saveLedger?: (l: finance.Ledger) => Promise<boolean>;
}

/** What a linked transaction paid over its planned payment, when it's more than a cent. */
const overOf = (t: finance.Transaction, x: finance.Payment | undefined) => (x ? Math.max(0, Math.round((Math.abs(t.amount) - x.amount) * 100) / 100) : 0);

export function LoanSection({ v, L, ledger, a, saveLedger }: LoanProps) {
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const p = (v.loans || []).find((x) => x.account === a.id);
  const into = allPayments(v.plan).filter((x) => x.to === a.id && !x.card);
  const byId = Object.fromEntries(into.map((x) => [x.id, x]));
  const txs = ledger?.transactions || [];
  const newest = (list: finance.Transaction[]) => [...list].sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
  const linked = newest(txs.filter((t) => t.payment && byId[t.payment]));
  // Not linked to anything, not said to pay nothing, not a transfer: money out that could pay it.
  const free = newest(txs.filter((t) => !t.payment && !t.notPlanned && !t.to && t.amount < 0));
  const payees = [...new Set(linked.map((t) => t.payee || ''))].filter(Boolean);
  const offers = into.length ? free.filter((t) => payees.some((n) => alike(n, t.payee || ''))).slice(0, 6) : [];
  const pick = free.filter((t) => !offers.includes(t)).slice(0, 12);
  const keep = async (change: (t: finance.Transaction) => finance.Transaction) => {
    if (!saveLedger || !ledger || busy) return;
    setBusy(true);
    await saveLedger({ ...ledger, transactions: ledger.transactions.map(change) });
    setBusy(false);
  };
  const link = (id: string) => keep((t) => (t.id === id ? { ...t, payment: into[0].id, notPlanned: undefined } : t));
  const unlink = (id: string) => keep((t) => (t.id === id ? { ...t, payment: undefined, extra: undefined, notPlanned: true } : t));
  const count = (id: string) => keep((t) => (t.id === id ? { ...t, extra: true } : t));
  // The papers' payment when they're typed in: the whole loan's, of which the plan's may be a share.
  const whole = p?.rows?.[p.made || 0]?.payment;
  const next = p?.rows?.[p.made || 0];
  const monthly = into.reduce((s, x) => s + x.amount, 0);
  return (
    <>
      <Widget title="The loan" span="all" kind="fx-loan">
        <dl class="fx-loanfacts">
          <div><dt>Each month</dt><dd>{monthly ? <Amount value={monthly} form="full" /> : '—'}{whole && monthly && Math.abs(whole - monthly) > 0.5 ? <span class="muted"> of {money(whole)}, the whole payment</span> : null}</dd></div>
          {p?.rate !== undefined && <div><dt>Rate</dt><dd>{p.rate}%</dd></div>}
          {p?.months !== undefined && <div><dt>Months left</dt><dd>{p.months}</dd></div>}
          <div><dt>{p && p.balance > 0.005 && p.date && !p.never ? 'Paid off' : 'Payoff'}</dt><dd>{p && p.date && !p.never && p.balance > 0.005 ? `${monthName(p.date + '-01').slice(0, 3)} ${p.date.slice(0, 4)}` : p ? payoffWords(p) : 'Add a payment that goes to it'}</dd></div>
        </dl>
        {next && <p class="fx-sub">Its next payment, {dayShort(next.date)}: {money(next.interest)} interest, {money(next.principal)} off what's owed.</p>}
      </Widget>
      <Widget title="Payments linked to this loan" span="all" kind="fx-loanlinked"
        actions={saveLedger && into.length ? <button class="small" aria-expanded={picking} onClick={() => setPicking(!picking)}>Link a payment…</button> : undefined}>
        <p class="fx-sub fx-lead">{into.length ? `Each one counts as paying ${into[0].name}. Link one, and the same payee's next ones are offered here.` : 'No payment in the plan goes to this loan: add one in Plan › Recurring, then link what pays it.'}</p>
        {picking && <div class="fx-loanpick">
          <p class="fx-sub">Money out not linked to anything yet, newest first:</p>
          {pick.length ? <Rows kind="fx-rows">{pick.map((t) => <TxRow key={t.id} t={t} v={v} L={L} end={<button class="small" disabled={busy} onClick={() => link(t.id)}>Link</button>} />)}</Rows> : <p class="fx-say">Nothing to link.</p>}
        </div>}
        {!!offers.length && <div class="fx-loanoffer">
          <p class="fx-sub"><strong>These look like it:</strong> the same payee as the ones linked.</p>
          <Rows kind="fx-rows">{offers.map((t) => <TxRow key={t.id} t={t} v={v} L={L} end={saveLedger && <span class="actions"><button class="small" disabled={busy} onClick={() => unlink(t.id)}>Not this one</button><button class="small fx-primary" disabled={busy} onClick={() => link(t.id)}>Link</button></span>} />)}</Rows>
        </div>}
        {linked.length ? <Rows kind="fx-rows">{linked.map((t) => {
          const over = overOf(t, byId[t.payment!]);
          return <TxRow key={t.id} t={t} v={v} L={L} end={over > 0 && !t.extra
            ? <span class="fx-loanask"><span class="warn">{money(over)} more than its {money(byId[t.payment!].amount)}: count all of it?</span>{saveLedger && <><button class="small" disabled={busy} onClick={() => unlink(t.id)}>Not this one</button><button class="small fx-primary" disabled={busy} onClick={() => count(t.id)}>Count it</button></>}</span>
            : <span class="pill ok">{t.extra ? 'Counted in full' : 'Counted'}</span>} />;
        })}</Rows> : <p class="fx-say">None linked yet.</p>}
      </Widget>
    </>
  );
}
