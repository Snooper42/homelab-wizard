// Finances' sheet: adding or changing a payment, an account (a car picks
// its make by logo), or someone who gets paid. What is typed stays in the
// form until Save; screens/finances.ts keeps the plan.
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { Sheet } from '../parts/Sheet';
import { allBrands, brandName, brandsFor, Mark } from './Mark';
import { owed, todayISO } from './money';

export type What = 'account' | 'person' | 'payment';

export interface EditProps {
  what: What;
  /** What is changed; none adds one. */
  id?: string;
  /** Counts the times the sheet opened, so each opening starts a fresh form. */
  n: number;
  plan: finance.Plan;
  /** The account paychecks land in. */
  checking: string;
  /** Keeps the plan; false when it failed (the screen says why). */
  save: (plan: finance.Plan) => Promise<boolean>;
  close: () => void;
}

const num = (s: string) => parseFloat(String(s).replace(/[^0-9.-]/g, '')) || 0;
const text = (n?: number) => (n ? String(n) : '');
const input = (set: (s: string) => void) => (e: Event) => set((e.target as HTMLInputElement).value);

const everies: [string, string][] = [['month', 'Monthly'], ['2 weeks', 'Every 2 weeks'], ['week', 'Weekly'], ['twice a month', 'Twice a month'], ['3 months', 'Every 3 months'], ['year', 'Yearly'], ['once', 'Once']];
const categories: [string, string][] = [['home', 'Home'], ['utilities', 'Utilities'], ['car', 'Car'], ['subscriptions', 'Subscriptions'], ['loans', 'Loans'], ['cards', 'Cards'], ['spending', 'Spending'], ['savings', 'Saving'], ['other', 'Other']];
const kinds: [string, string][] = [['checking', 'Checking'], ['savings', 'Savings'], ['card', 'Card'], ['investment', 'Investment'], ['retirement', 'Retirement'], ['loan', 'Loan'], ['home', 'Home'], ['car', 'Car'], ['other', 'Other']];

/** Save, Cancel, and for one that exists Delete (asked twice); what is missing above them. */
function Actions({ busy, exists, remove, close, problem }: { busy: boolean; exists: boolean; remove: () => void; close: () => void; problem?: string }) {
  const [sure, setSure] = useState(false);
  return (
    <>
    {problem && <p class="formerr bad" role="alert">{problem}</p>}
    <div class="actions finactions">
      {exists && <button type="button" class="small danger" disabled={busy} onClick={() => { if (sure) remove(); else setSure(true); }}>{sure ? 'Click again to delete' : 'Delete'}</button>}
      <span class="grow" />
      <button type="button" class="small" onClick={close} disabled={busy}>Cancel</button>
      <button type="submit" class="primary small" disabled={busy}>Save</button>
    </div>
    </>
  );
}

/** A form that saves the plan it makes, and closes once it is kept. */
function useSaving(props: EditProps) {
  const [busy, setBusy] = useState(false);
  const keep = async (plan: finance.Plan) => {
    setBusy(true);
    const ok = await props.save(plan);
    setBusy(false);
    if (ok) props.close();
  };
  return { busy, keep };
}

function Field({ label, children, wide }: { label: string; children: any; wide?: boolean }) {
  return <label class={'field' + (wide ? ' wide' : '')}>{label}{children}</label>;
}

function MoneyField({ label, value, set, hint }: { label: string; value: string; set: (s: string) => void; hint?: string }) {
  return <Field label={label}><span class="moneyfield"><span aria-hidden="true">$</span><input inputmode="decimal" value={value} placeholder={hint || '0.00'} onInput={input(set)} /></span></Field>;
}

function AccountSelect({ label, value, set, accounts, none }: { label: string; value: string; set: (s: string) => void; accounts: finance.Account[]; none?: string }) {
  return (
    <Field label={label}>
      <select value={value} onChange={input(set)}>
        {none !== undefined && <option value="">{none}</option>}
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
    </Field>
  );
}

function ScheduleFields({ every, setEvery, start, setStart, day2, setDay2, startLabel }: { every: string; setEvery: (s: string) => void; start: string; setStart: (s: string) => void; day2: string; setDay2: (s: string) => void; startLabel: string }) {
  return <>
    <Field label="How often"><select value={every} onChange={input(setEvery)}>{everies.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></Field>
    <Field label={startLabel}><input type="date" value={start} onInput={input(setStart)} required /></Field>
    {every === 'twice a month' && <Field label="And on day"><input type="number" min="1" max="31" value={day2} onInput={input(setDay2)} /></Field>}
  </>;
}

function PaymentForm(props: EditProps) {
  const { plan, id, checking } = props;
  const x = (plan.payments || []).find((p) => p.id === id);
  const [name, setName] = useState(x?.name || '');
  const [brand, setBrand] = useState(x?.institution || '');
  const [amount, setAmount] = useState(text(x?.amount));
  const [estimate, setEstimate] = useState(!!x?.estimate);
  const [every, setEvery] = useState(x?.schedule.every || 'month');
  const [start, setStart] = useState(x?.schedule.start || todayISO());
  const [day2, setDay2] = useState(String(x?.schedule.day2 || 15));
  const [kind, setKind] = useState(x?.kind || 'home');
  const [from, setFrom] = useState(x?.from || checking || '');
  const [to, setTo] = useState(x?.to || '');
  const [card, setCard] = useState(x?.card || '');
  const { busy, keep } = useSaving(props);
  const [problem, setProblem] = useState('');
  const accounts = plan.accounts || [];
  const submit = (e: Event) => {
    e.preventDefault();
    const wrong = !name.trim() ? 'Give it a name.' : !card && num(amount) <= 0 ? 'Type how much it is.' : every === 'twice a month' && !(num(day2) >= 1 && num(day2) <= 31) ? 'The second day is 1 to 31.' : '';
    setProblem(wrong);
    if (wrong) return;
    const p: finance.Payment = { id: x?.id || '', name: name.trim(), amount: num(amount), estimate, kind, institution: brand || undefined,
      schedule: { every, start, day2: every === 'twice a month' ? num(day2) : undefined }, from: from === checking ? undefined : from || undefined, to: to || undefined, card: card || undefined };
    const list = (plan.payments || []).slice();
    const at = list.findIndex((q) => q.id === x?.id);
    if (at >= 0) list[at] = p; else list.push(p);
    keep({ ...plan, payments: list });
  };
  const remove = () => keep({ ...plan, payments: (plan.payments || []).filter((q) => q.id !== x?.id) });
  return (
    <form class="finform" onSubmit={submit}>
      <div class="formhead"><Mark brand={brand} kind={kind} name={name || 'Payment'} size="lg" /><h2 id="finSheetTitle">{x ? x.name : 'Add a payment'}</h2></div>
      <div class="formgrid">
        <Field label="Name"><input value={name} onInput={input(setName)} placeholder="Mortgage" required /></Field>
        <Field label="Logo"><select value={brand} onChange={input(setBrand)}><option value="">None</option>{allBrands().map((k) => <option key={k} value={k}>{brandName(k)}</option>)}</select></Field>
        <MoneyField label={card ? 'Usual amount (the next is the balance)' : 'Amount'} value={amount} set={setAmount} />
        <Field label="Category"><select value={kind} onChange={input(setKind)}>{categories.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></Field>
        <ScheduleFields every={every} setEvery={setEvery} start={start} setStart={setStart} day2={day2} setDay2={setDay2} startLabel={x ? 'Starting' : 'Next on'} />
        <AccountSelect label="Comes out of" value={from} set={setFrom} accounts={accounts.filter((a) => !owed(a.kind) && a.kind !== 'home' && a.kind !== 'car')} none={accounts.length ? undefined : 'Checking'} />
        <AccountSelect label="Goes into" value={to} set={setTo} accounts={accounts.filter((a) => a.id !== from && a.kind !== 'home' && a.kind !== 'car')} none="Nowhere (a bill)" />
        <AccountSelect label="Pays off a card" value={card} set={setCard} accounts={accounts.filter((a) => a.kind === 'card')} none="No" />
        <label class="check wide"><input type="checkbox" checked={estimate} onChange={(e) => setEstimate((e.target as HTMLInputElement).checked)} /> The amount changes each time (an estimate)</label>
      </div>
      <Actions busy={busy} exists={!!x} remove={remove} close={props.close} problem={problem} />
    </form>
  );
}

function AccountForm(props: EditProps) {
  const { plan, id } = props;
  const a = (plan.accounts || []).find((q) => q.id === id);
  const [kind, setKind] = useState(a?.kind || (plan.accounts?.some((q) => q.kind === 'checking') ? 'savings' : 'checking'));
  const [name, setName] = useState(a?.name || '');
  const [brand, setBrand] = useState(a?.institution || '');
  const [balance, setBalance] = useState(text(a?.balance));
  const [pending, setPending] = useState(text(a?.pending));
  const [rate, setRate] = useState(text(a?.rate));
  const [original, setOriginal] = useState(text(a?.original));
  const [loan, setLoan] = useState(a?.loan || '');
  const [detail, setDetail] = useState(a?.detail || '');
  const { busy, keep } = useSaving(props);
  const [problem, setProblem] = useState('');
  const loans = (plan.accounts || []).filter((q) => q.kind === 'loan');
  const submit = (e: Event) => {
    e.preventDefault();
    const wrong = !name.trim() && !brand ? 'Give it a name.' : num(balance) < 0 && (owed(kind) || kind === 'home' || kind === 'car') ? 'Type it without a minus.' : '';
    setProblem(wrong);
    if (wrong) return;
    const next: finance.Account = { id: a?.id || '', kind, name: name.trim() || (brand ? brandName(brand) : ''), institution: brand || undefined, balance: num(balance), detail: detail.trim() || undefined, updated: todayISO(),
      pending: kind === 'card' ? num(pending) : undefined, rate: kind === 'savings' ? num(rate) : undefined, original: kind === 'loan' ? num(original) : undefined,
      loan: kind === 'home' || kind === 'car' ? loan || undefined : undefined };
    const list = (plan.accounts || []).slice();
    const at = list.findIndex((q) => q.id === a?.id);
    if (at >= 0) list[at] = next; else list.push(next);
    keep({ ...plan, accounts: list });
  };
  // Removing an account takes what points at it along.
  const remove = () => keep({
    ...plan,
    accounts: (plan.accounts || []).filter((q) => q.id !== a?.id).map((q) => (q.loan === a?.id ? { ...q, loan: undefined } : q)),
    payments: (plan.payments || []).map((x) => ({ ...x, from: x.from === a?.id ? undefined : x.from, to: x.to === a?.id ? undefined : x.to, card: x.card === a?.id ? undefined : x.card })),
    people: (plan.people || []).map((e) => ({ ...e, account: e.account === a?.id ? undefined : e.account, deductions: (e.deductions || []).map((d) => ({ ...d, account: d.account === a?.id ? undefined : d.account })) })),
  });
  const owes = owed(kind), property = kind === 'home' || kind === 'car';
  const picks = brandsFor(kind);
  return (
    <form class="finform" onSubmit={submit}>
      <div class="formhead"><Mark brand={brand} kind={kind} name={name || 'Account'} size="lg" /><h2 id="finSheetTitle">{a ? a.name : 'Add an account'}</h2></div>
      {!a && <div class="kindpick" role="radiogroup" aria-label="Kind">
        {kinds.map(([v, t]) => <button key={v} type="button" role="radio" aria-checked={kind === v} class={kind === v ? 'on' : ''} onClick={() => { setKind(v); setBrand(''); }}><Mark kind={v} name={t} size="sm" />{t}</button>)}
      </div>}
      {kind === 'car' && <div class="makepick" role="radiogroup" aria-label="Make">
        {picks.map((k) => <button key={k} type="button" role="radio" aria-checked={brand === k} class={brand === k ? 'on' : ''} onClick={() => setBrand(k)}><Mark brand={k} name={brandName(k)} />{brandName(k)}</button>)}
        <button type="button" role="radio" aria-checked={!brand} class={!brand ? 'on' : ''} onClick={() => setBrand('')}><Mark kind="car" name="Another make" />Another make</button>
      </div>}
      <div class="formgrid">
        <Field label="Name"><input value={name} onInput={input(setName)} placeholder={{ checking: 'Chase Checking', savings: 'Savings', card: 'Chase Freedom', investment: 'Brokerage', retirement: '401(k)', loan: 'Car loan', home: 'Home', car: '2022 RAV4', other: 'Jewelry' }[kind]} required={!brand} /></Field>
        {kind !== 'car' && kind !== 'other' && <Field label={kind === 'home' ? 'Logo' : 'Bank'}><select value={brand} onChange={input(setBrand)}><option value="">None</option>{picks.map((k) => <option key={k} value={k}>{brandName(k)}</option>)}</select></Field>}
        <MoneyField label={owes ? 'Owed' : property ? 'Worth' : 'Balance'} value={balance} set={setBalance} />
        {kind === 'card' && <MoneyField label="Pending" value={pending} set={setPending} />}
        {kind === 'savings' && <Field label="Interest, % a year"><input inputmode="decimal" value={rate} onInput={input(setRate)} placeholder="3.2" /></Field>}
        {kind === 'loan' && <MoneyField label="Borrowed at the start" value={original} set={setOriginal} />}
        {property && <AccountSelect label="Loan against it" value={loan} set={setLoan} accounts={loans} none="None" />}
        <Field label={{ home: 'Address', car: 'Year and model', card: 'Last 4 digits', checking: 'Last 4 digits', savings: 'Last 4 digits' }[kind] || 'Note'}><input value={detail} onInput={input(setDetail)} /></Field>
      </div>
      <Actions busy={busy} exists={!!a} remove={remove} close={props.close} problem={problem} />
    </form>
  );
}

function PersonForm(props: EditProps) {
  const { plan, id, checking } = props;
  const e = (plan.people || []).find((q) => q.id === id);
  const [name, setName] = useState(e?.name || '');
  const [net, setNet] = useState(text(e?.net));
  const [gross, setGross] = useState(text(e?.gross));
  const [every, setEvery] = useState(e?.schedule.every || '2 weeks');
  const [start, setStart] = useState(e?.schedule.start || todayISO());
  const [day2, setDay2] = useState(String(e?.schedule.day2 || 15));
  const [account, setAccount] = useState(e?.account || checking || '');
  const [deds, setDeds] = useState((e?.deductions || []).map((d) => ({ name: d.name, amount: text(d.amount), account: d.account || '' })));
  const { busy, keep } = useSaving(props);
  const accounts = (plan.accounts || []).filter((a) => !owed(a.kind) && a.kind !== 'home' && a.kind !== 'car');
  const [problem, setProblem] = useState('');
  const setDed = (i: number, k: string, v: string) => setDeds(deds.map((d, j) => (j === i ? { ...d, [k]: v } : d)));
  const submit = (ev: Event) => {
    ev.preventDefault();
    const wrong = !name.trim() ? 'Give their name.' : num(net) <= 0 ? 'Type the take-home pay on each check.' : every === 'twice a month' && !(num(day2) >= 1 && num(day2) <= 31) ? 'The second day is 1 to 31.' : '';
    setProblem(wrong);
    if (wrong) return;
    const p: finance.Earner = { id: e?.id || '', name: name.trim(), net: num(net), gross: num(gross) || undefined, account: account === checking ? undefined : account || undefined,
      schedule: { every, start, day2: every === 'twice a month' ? num(day2) : undefined },
      deductions: deds.filter((d) => d.name.trim()).map((d) => ({ name: d.name.trim(), amount: num(d.amount), account: d.account || undefined })) };
    const list = (plan.people || []).slice();
    const at = list.findIndex((q) => q.id === e?.id);
    if (at >= 0) list[at] = p; else list.push(p);
    keep({ ...plan, people: list });
  };
  const remove = () => keep({ ...plan, people: (plan.people || []).filter((q) => q.id !== e?.id) });
  const taken = deds.reduce((t, d) => t + num(d.amount), 0);
  return (
    <form class="finform" onSubmit={submit}>
      <div class="formhead"><h2 id="finSheetTitle">{e ? e.name : 'Add someone who gets paid'}</h2></div>
      <div class="formgrid">
        <Field label="Name"><input value={name} onInput={input(setName)} required /></Field>
        <MoneyField label="Take-home per check" value={net} set={setNet} />
        <ScheduleFields every={every} setEvery={setEvery} start={start} setStart={setStart} day2={day2} setDay2={setDay2} startLabel={e ? 'A payday' : 'Next payday'} />
        <AccountSelect label="Lands in" value={account} set={setAccount} accounts={accounts} none={accounts.length ? undefined : 'Checking'} />
        <MoneyField label="Gross per check (optional)" value={gross} set={setGross} />
      </div>
      <h3 class="formsub">Deductions <span class="muted">{gross && taken ? `$${(num(gross) - taken).toFixed(2)} left of gross` : ''}</span></h3>
      {deds.map((d, i) => (
        <div class="dedrow" key={i}>
          <input aria-label="Deduction" value={d.name} placeholder="401(k)" onInput={(ev) => setDed(i, 'name', (ev.target as HTMLInputElement).value)} />
          <span class="moneyfield"><span aria-hidden="true">$</span><input aria-label={`${d.name || 'Deduction'} amount`} inputmode="decimal" value={d.amount} onInput={(ev) => setDed(i, 'amount', (ev.target as HTMLInputElement).value)} /></span>
          <select aria-label={`${d.name || 'Deduction'} goes into`} value={d.account} onChange={(ev) => setDed(i, 'account', (ev.target as HTMLSelectElement).value)}>
            <option value="">Nowhere (tax, insurance)</option>
            {(plan.accounts || []).filter((a) => a.kind === 'retirement' || a.kind === 'savings' || a.kind === 'investment').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button type="button" class="small" aria-label={`Remove ${d.name || 'deduction'}`} onClick={() => setDeds(deds.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      <p><button type="button" class="small" onClick={() => setDeds([...deds, { name: '', amount: '', account: '' }])}>Add a deduction</button></p>
      <Actions busy={busy} exists={!!e} remove={remove} close={props.close} problem={problem} />
    </form>
  );
}

function FinanceSheet({ edit }: { edit: EditProps | null }) {
  return (
    <Sheet id="finSheet" titleId="finSheetTitle">
      {edit?.what === 'payment' && <PaymentForm key={'p' + edit.n} {...edit} />}
      {edit?.what === 'account' && <AccountForm key={'a' + edit.n} {...edit} />}
      {edit?.what === 'person' && <PersonForm key={'e' + edit.n} {...edit} />}
      {!edit && <h2 id="finSheetTitle">Finances</h2>}
    </Sheet>
  );
}

/** Draws the sheet with a form in it (closed, or for null, empty). */
export function mountFinanceSheet(el: Element, edit: EditProps | null) { render(<FinanceSheet edit={edit} />, el); }
