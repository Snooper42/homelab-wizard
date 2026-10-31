// Finances' sheet: adding or changing a payment, an account (first what
// kind, then its bank, broker, or make by logo, and what it holds), or
// someone who gets paid. What is typed stays in the
// form until Save; screens/finances.ts keeps the plan.
import { render } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Segmented } from '../parts/Segmented';
import { Sheet } from '../parts/Sheet';
import { allBrands, brandName, brandOf, brandsFor, Mark, Who } from './Mark';
import { currencySign, money, owed, parseAmount, parseDay, todayISO } from './money';

export type What = 'account' | 'person' | 'payment';

export interface EditProps {
  what: What;
  /** What is changed; none adds one. */
  id?: string;
  /** A new account of this kind, past the choice of kind ("Add your checking account"). */
  kind?: string;
  /** Counts the times the sheet opened, so each opening starts a fresh form. */
  n: number;
  plan: finance.Plan;
  /** The account paychecks land in. */
  checking: string;
  /** Keeps the plan; false when it failed (the screen says why). */
  save: (plan: finance.Plan) => Promise<boolean>;
  close: () => void;
}

const num = (s: string) => { const n = parseAmount(s); return isNaN(n) ? 0 : n; };
const text = (n?: number) => (n ? String(n) : '');
const input = (set: (s: string) => void) => (e: Event) => set((e.target as HTMLInputElement).value);

const everies: [string, string][] = [['month', 'Monthly'], ['2 weeks', 'Every 2 weeks'], ['week', 'Weekly'], ['twice a month', 'Twice a month'], ['3 months', 'Every 3 months'], ['year', 'Yearly'], ['once', 'Once']];
const categories: [string, string][] = [['home', 'Home'], ['utilities', 'Utilities'], ['car', 'Car'], ['subscriptions', 'Subscriptions'], ['loans', 'Loans'], ['cards', 'Cards'], ['spending', 'Spending'], ['savings', 'Saving'], ['other', 'Other']];
/** The kinds of account, as adding one lists them: in groups, each with what it is for. */
const kindGroups: { name: string; kinds: [string, string, string][] }[] = [
  { name: 'Cash', kinds: [['checking', 'Checking', 'Where paychecks land and bills come out'], ['savings', 'Savings', 'Kept apart, earning interest']] },
  { name: 'Credit', kinds: [['card', 'Credit card', 'What it owes, and what is pending'], ['loan', 'Loan', 'A mortgage, a car loan, a student loan']] },
  { name: 'Investing', kinds: [['investment', 'Investment', 'A brokerage account, crypto'], ['retirement', 'Retirement', 'A 401(k), an IRA']] },
  { name: 'What you own', kinds: [['home', 'Home', 'What it is worth, and the loan against it'], ['car', 'Car', 'Picked by its make'], ['collectible', 'Collectibles', 'Trading cards, jewelry, art'], ['other', 'Something else', 'A boat, a share in a business']] },
];
/** "Add a checking account", "Add collectibles". */
const adding: Record<string, string> = { checking: 'a checking account', savings: 'a savings account', card: 'a credit card', loan: 'a loan', investment: 'an investment account', retirement: 'a retirement account', home: 'a home', car: 'a car', collectible: 'collectibles', other: 'something else' };
/** The name an account takes from its bank when none is typed: "Fidelity brokerage". */
const named = (kind: string, b: string) => ({ checking: `${b} Checking`, savings: `${b} Savings`, investment: `${b} brokerage`, retirement: `${b} retirement`, loan: `${b} loan` }[kind] || b);
/** Worth what is typed in, and nothing is paid out of them or into them. */
const held = (kind: string) => kind === 'home' || kind === 'car' || kind === 'collectible';

/**
 * Save, Cancel, and for one that exists Delete (asked twice); what is
 * missing above them. Cancel (or Escape) on a form with something typed
 * asks once before it drops it. An account that payments use (uses names
 * them) asks whether they go with it (removeAll) or stay.
 */
function Actions({ busy, exists, remove, close, problem, touched, uses, removeAll }: { busy: boolean; exists: boolean; remove: () => void; close: () => void; problem?: string; touched: boolean; uses?: string; removeAll?: () => void }) {
  const [sure, setSure] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const cancel = () => { if (touched && !leaving) setLeaving(true); else close(); };
  const asking = sure && !!uses && !!removeAll;
  const said = leaving && touched ? 'Nothing here is saved yet. Cancel again to drop it, or Save.'
    : asking ? `${uses} it. Delete them with it, or keep them: one out of it then comes out of checking, one into it goes nowhere, and a paycheck lands in checking.` : problem;
  return (
    <>
    {said && <p class={'formerr ' + (leaving || asking ? 'warn' : 'bad')} role="alert">{said}</p>}
    <div class="actions finactions">
      {exists && (asking ? <>
        <button type="button" class="small danger" disabled={busy} onClick={removeAll}>Delete it and them</button>
        <button type="button" class="small danger" disabled={busy} onClick={remove}>Delete it, keep them</button>
      </> : <button type="button" class="small danger" disabled={busy} onClick={() => { if (sure) remove(); else setSure(true); }}>{sure ? 'Click again to delete' : 'Delete'}</button>)}
      <span class="grow" />
      <button type="button" class="small" onClick={cancel} disabled={busy}>Cancel</button>
      <button type="submit" class="primary small" disabled={busy}>Save</button>
    </div>
    </>
  );
}

/** A form that saves the plan it makes, and closes once it is kept; touched once anything in it changes. */
function useSaving(props: EditProps) {
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  // Typing, a pick, or a row added or removed: what Cancel asks about.
  const watch = {
    onInput: (e: Event) => { if (!(e.target as Element).matches('.brandsearch')) setTouched(true); },
    onChange: (e: Event) => { if (!(e.target as Element).matches('.brandsearch')) setTouched(true); },
    onClickCapture: (e: MouseEvent) => { if ((e.target as Element).closest('.brandgrid button, .kindswap button, .dedrow button, button.addded')) setTouched(true); },
  };
  const keep = async (plan: finance.Plan) => {
    setBusy(true);
    const ok = await props.save(plan);
    setBusy(false);
    if (ok) props.close();
  };
  return { busy, keep, touched, watch };
}

function Field({ label, children, wide }: { label: string; children: any; wide?: boolean }) {
  return <label class={'field' + (wide ? ' wide' : '')}>{label}{children}</label>;
}

function MoneyField({ label, value, set, hint }: { label: string; value: string; set: (s: string) => void; hint?: string }) {
  return <Field label={label}><span class="moneyfield"><span aria-hidden="true">{currencySign()}</span><input inputmode="decimal" value={value} placeholder={hint || '0.00'} onInput={input(set)} /></span></Field>;
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

/** How often, from when; a payment can also come with each of someone's paychecks (people), on their paydays. */
function ScheduleFields({ every, setEvery, start, setStart, day2, setDay2, startLabel, people, person, setPerson }: { every: string; setEvery: (s: string) => void; start: string; setStart: (s: string) => void; day2: string; setDay2: (s: string) => void; startLabel: string; people?: finance.Earner[]; person?: string; setPerson?: (s: string) => void }) {
  const pick = (v: string) => { if (v.startsWith('paycheck:')) { setEvery('paycheck'); setPerson?.(v.slice(9)); } else setEvery(v); };
  return <>
    <Field label="How often"><select value={every === 'paycheck' ? 'paycheck:' + person : every} onChange={input(pick)}>
      {everies.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      {(people || []).map((e) => <option key={e.id} value={'paycheck:' + e.id}>With each of {e.name}'s paychecks</option>)}
    </select></Field>
    {every !== 'paycheck' && <Field label={startLabel}><input type="date" value={start} onInput={input(setStart)} required /></Field>}
    {every === 'twice a month' && <Field label="And on day"><input type="number" min="1" max="31" value={day2} onInput={input(setDay2)} /></Field>}
  </>;
}

function PaymentForm(props: EditProps) {
  const { plan, id, checking } = props;
  const x = (plan.payments || []).find((p) => p.id === id);
  const [name, setName] = useState(x?.name || '');
  // The logo: the one picked, else the brand in its name ("Claude Pro"), until one is picked by hand.
  const [brand, setBrand] = useState(brandOf(x?.institution, x?.name) || '');
  const picked = useRef(!!x?.institution);
  const rename = (n: string) => { setName(n); if (!picked.current) setBrand(brandOf(undefined, n) || ''); };
  const [amount, setAmount] = useState(text(x?.amount));
  const [estimate, setEstimate] = useState(!!x?.estimate);
  const [every, setEvery] = useState(x?.schedule.every || 'month');
  const [person, setPerson] = useState(x?.schedule.person || '');
  const [start, setStart] = useState(x?.schedule.start || todayISO());
  const [day2, setDay2] = useState(String(x?.schedule.day2 || 15));
  const [kind, setKind] = useState(x?.kind || 'home');
  const [from, setFrom] = useState(x?.from || checking || '');
  const [to, setTo] = useState(x?.to || '');
  const [card, setCard] = useState(x?.card || '');
  const { busy, keep, touched, watch } = useSaving(props);
  const [problem, setProblem] = useState('');
  const accounts = plan.accounts || [];
  const submit = (e: Event) => {
    e.preventDefault();
    const wrong = !name.trim() ? 'Give it a name.' : !card && num(amount) <= 0 ? 'Type how much it is.' : card && card === from ? 'A card can\'t pay itself off: pick the account it comes out of.' : every === 'twice a month' && !(num(day2) >= 1 && num(day2) <= 31) ? 'The second day is 1 to 31.' : every === 'twice a month' && num(day2) === parseDay(start).getDate() ? 'The second day is the first one again: pick another.' : '';
    setProblem(wrong);
    if (wrong) return;
    const p: finance.Payment = { id: x?.id || '', name: name.trim(), amount: num(amount), estimate, kind, institution: brand || undefined,
      schedule: { every, start, day2: every === 'twice a month' ? num(day2) : undefined, person: every === 'paycheck' ? person : undefined }, from: from === checking ? undefined : from || undefined, to: to || undefined, card: card || undefined };
    const list = (plan.payments || []).slice();
    const at = list.findIndex((q) => q.id === x?.id);
    if (at >= 0) list[at] = p; else list.push(p);
    keep({ ...plan, payments: list });
  };
  const remove = () => keep({ ...plan, payments: (plan.payments || []).filter((q) => q.id !== x?.id) });
  return (
    <form class="finform" onSubmit={submit} {...watch}>
      <div class="formhead"><Mark brand={brand} kind={kind} name={name || 'Payment'} size="lg" /><h2 id="finSheetTitle">{x ? x.name : 'Add a payment'}</h2></div>
      <BrandPick kind={kind} value={brand} set={(k) => { picked.current = true; setBrand(k); if (k && !name.trim()) setName(brandName(k)); }} payment />
      <div class="formgrid">
        <Field label="Name"><input value={name} onInput={input(rename)} placeholder="Mortgage" required /></Field>
        <MoneyField label={card ? 'Other spending on it each time (each pays the balance)' : 'Amount'} value={amount} set={setAmount} />
        <Field label="Category"><select value={kind} onChange={input(setKind)}>{categories.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></Field>
        <ScheduleFields every={every} setEvery={setEvery} start={start} setStart={setStart} day2={day2} setDay2={setDay2} startLabel={x ? 'Starting' : 'Next on'} people={plan.people} person={person} setPerson={setPerson} />
        <AccountSelect label="Comes out of, or is charged to" value={from} set={setFrom} accounts={accounts.filter((a) => (a.kind === 'card' || !owed(a.kind)) && !held(a.kind))} none={accounts.length ? undefined : 'Checking'} />
        <AccountSelect label="Goes into" value={to} set={setTo} accounts={accounts.filter((a) => a.id !== from && !held(a.kind))} none="Nowhere (a bill)" />
        <AccountSelect label="Pays off a card" value={card} set={setCard} accounts={accounts.filter((a) => a.kind === 'card')} none="No" />
        <label class="fcheckbox wide"><input type="checkbox" checked={estimate} onChange={(e) => setEstimate((e.target as HTMLInputElement).checked)} /> The amount changes each time (an estimate)</label>
      </div>
      <Actions busy={busy} exists={!!x} remove={remove} close={props.close} problem={problem} touched={touched} />
    </form>
  );
}

/**
 * A bank, broker, or make, by its mark: a search when there are many, then
 * the marks, those that fit the kind first, and the last tile for one not
 * among them (its name is typed below).
 */
function BrandPick({ kind, value, set, payment }: { kind: string; value: string; set: (k: string) => void; payment?: boolean }) {
  const [q, setQ] = useState('');
  const grid = useRef<HTMLDivElement>(null);
  // The one picked in view as the form opens (Wells Fargo is far down the list): a frame on, once the
  // sheet that holds it shows.
  useLayoutEffect(() => {
    if (!value) return undefined;
    const id = requestAnimationFrame(() => {
      const g = grid.current, on = g?.querySelector('.on');
      if (g && on) g.scrollTop += on.getBoundingClientRect().top - g.getBoundingClientRect().top - 4;
    });
    return () => cancelAnimationFrame(id);
  }, []);
  const all = payment ? allBrands() : brandsFor(kind);
  const want = q.trim().toLowerCase();
  const shown = want ? all.filter((k) => brandName(k).toLowerCase().includes(want)) : all;
  const broker = kind === 'investment' || kind === 'retirement';
  const label = payment || kind === 'home' ? 'Logo' : kind === 'car' ? 'Make' : broker ? 'Broker' : 'Bank';
  const none = payment || kind === 'home' ? 'None' : kind === 'car' ? 'Another make' : broker ? 'Another broker' : 'Another bank';
  const what = payment ? 'logos' : kind === 'car' ? 'makes' : 'banks and brokers';
  return (
    <div class="brandpick">
      <div class="brandhead">
        <span>{label}</span>
        {all.length > 9 && <input type="search" class="brandsearch" value={q} onInput={input(setQ)} placeholder={`Search ${all.length} ${what}`} aria-label={`Search ${what}`} />}
      </div>
      <div class="brandgrid" ref={grid} role="radiogroup" aria-label={label}>
        {(value && !shown.includes(value) ? [value, ...shown] : shown).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={value === k} class={value === k ? 'on' : ''} onClick={() => set(k)}><Mark brand={k} name={brandName(k)} size="sm" /><span>{brandName(k)}</span></button>
        ))}
        <button type="button" role="radio" aria-checked={!value} class={!value ? 'on' : ''} onClick={() => set('')}><Mark kind={kind} name={none} size="sm" /><span>{none}</span></button>
      </div>
      {!shown.length && <p class="muted brandnone">None by that name: pick {none}, and type its name below.</p>}
    </div>
  );
}

function AccountForm(props: EditProps) {
  const { plan, id } = props;
  const a = (plan.accounts || []).find((q) => q.id === id);
  const [kind, setKind] = useState(a?.kind || props.kind || 'checking');
  // A new account starts at its kind, unless the screen named it; one that exists, at its form.
  const [step, setStep] = useState<'kind' | 'form'>(a || props.kind ? 'form' : 'kind');
  const form = useRef<HTMLFormElement>(null);
  const moved = useRef(false);
  // Past the kind, the cursor in the form's first field (the sheet put it there only as it opened).
  useLayoutEffect(() => {
    if (!moved.current) { moved.current = true; return; }
    form.current?.querySelector<HTMLElement>(step === 'kind' ? 'button.kindrow' : 'input, select')?.focus();
  }, [step]);
  const [name, setName] = useState(a?.name || '');
  const [brand, setBrand] = useState(a?.institution || '');
  const [balance, setBalance] = useState(text(a?.balance));
  const [pending, setPending] = useState(text(a?.pending));
  const [rate, setRate] = useState(text(a?.rate));
  const [original, setOriginal] = useState(text(a?.original));
  const [loan, setLoan] = useState(a?.loan || '');
  const [detail, setDetail] = useState(a?.detail || '');
  const { busy, keep, touched, watch } = useSaving(props);
  const [problem, setProblem] = useState('');
  const loans = (plan.accounts || []).filter((q) => q.kind === 'loan');
  const submit = (e: Event) => {
    e.preventDefault();
    const wrong = !name.trim() && !brand ? 'Give it a name, or pick its bank.' : num(balance) < 0 && (owed(kind) || held(kind)) ? 'Type it without a minus.' : '';
    setProblem(wrong);
    if (wrong) return;
    // A balance (or a card's pending) typed in again is today's; a new name alone leaves its day.
    const retyped = !a || num(balance) !== a.balance || (kind === 'card' && num(pending) !== (a.pending || 0));
    const next: finance.Account = { id: a?.id || '', kind, name: name.trim() || (brand ? named(kind, brandName(brand)) : ''), institution: brand || undefined, balance: num(balance), detail: detail.trim() || undefined, updated: retyped ? todayISO() : a?.updated,
      pending: kind === 'card' ? num(pending) : undefined, rate: kind === 'savings' || kind === 'loan' || kind === 'card' ? num(rate) || undefined : undefined, original: kind === 'loan' ? num(original) : undefined,
      loan: kind === 'home' || kind === 'car' ? loan || undefined : undefined };
    const list = (plan.accounts || []).slice();
    const at = list.findIndex((q) => q.id === a?.id);
    if (at >= 0) list[at] = next; else list.push(next);
    keep({ ...plan, accounts: list });
  };
  // What uses it: payments out of it, into it, or paying it off, and paychecks into it.
  const usesIt = (x: finance.Payment) => !!a && [x.from, x.to, x.card].includes(a.id);
  const users = [...(plan.payments || []).filter(usesIt).map((x) => `“${x.name}”`),
    ...(plan.people || []).filter((e) => a && (e.account === a.id || (e.deductions || []).some((d) => d.account === a.id))).map((e) => `${e.name}'s paycheck`)];
  const uses = users.length ? (users.length > 3 ? `${users.slice(0, 3).join(', ')} and ${users.length - 3} more use` : users.length === 1 ? `${users[0]} uses` : `${users.slice(0, -1).join(', ')} and ${users.at(-1)} use`) : undefined;
  // Removing an account takes what points at it along: its payments, when
  // the household says so, or else what they say about it.
  const without = (drop: boolean) => keep({
    ...plan,
    accounts: (plan.accounts || []).filter((q) => q.id !== a?.id).map((q) => (q.loan === a?.id ? { ...q, loan: undefined } : q)),
    payments: (plan.payments || []).filter((x) => !drop || !usesIt(x)).map((x) => ({ ...x, from: x.from === a?.id ? undefined : x.from, to: x.to === a?.id ? undefined : x.to, card: x.card === a?.id ? undefined : x.card })),
    people: (plan.people || []).map((e) => ({ ...e, account: e.account === a?.id ? undefined : e.account, deductions: (e.deductions || []).map((d) => ({ ...d, account: d.account === a?.id ? undefined : d.account })) })),
  });
  const remove = () => without(false);
  const owes = owed(kind), property = kind === 'home' || kind === 'car';
  const pick = (k: string) => { setKind(k); setBrand(''); setStep('form'); };
  if (step === 'kind') {
    return (
      <form class="finform" ref={form} onSubmit={(e) => e.preventDefault()}>
        <div class="formhead"><h2 id="finSheetTitle">Add an account</h2></div>
        <p class="formsub muted">What are you adding?</p>
        <div class="kindlist">
          {kindGroups.map((g) => (
            <section key={g.name} class="kindgroup" aria-label={g.name}>
              <h3>{g.name}</h3>
              {g.kinds.map(([k, t, hint]) => (
                <button key={k} type="button" class="kindrow" onClick={() => pick(k)}>
                  <Mark kind={k} name={t} />
                  <span class="grow"><strong>{t}</strong><small>{hint}</small></span>
                  <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
                </button>
              ))}
            </section>
          ))}
        </div>
        <div class="actions finactions"><span class="grow" /><button type="button" class="small" onClick={props.close}>Cancel</button></div>
      </form>
    );
  }
  const said = name.trim() || (brand ? named(kind, brandName(brand)) : '');
  return (
    <form class="finform" ref={form} onSubmit={submit} {...watch}>
      {/* What it will be: its mark, its name, and its amount, as typed. */}
      <div class="formhead">
        <Mark brand={brand} kind={kind} name={said || 'Account'} size="lg" />
        <div class="grow">
          <h2 id="finSheetTitle">{a ? a.name : `Add ${adding[kind] || 'an account'}`}</h2>
          {!a && <div class="formsays muted">{said || 'Its name, below'}{balance.trim() && ` · ${owes ? 'owes ' : ''}${money(num(balance))}`}</div>}
        </div>
        {!a && !props.kind && <button type="button" class="small" onClick={() => setStep('kind')}>Change</button>}
      </div>
      {/* An account's kind is picked when it is added; other things and collectibles can trade places later
          (jewelry typed in as Other before there were collectibles). */}
      {a && (a.kind === 'other' || a.kind === 'collectible') && <div class="kindswap"><Segmented label="Kind" value={kind} pick={setKind} options={[['collectible', 'Collectibles'], ['other', 'Something else']]} /></div>}
      {kind !== 'other' && kind !== 'collectible' && <BrandPick kind={kind} value={brand} set={setBrand} />}
      <div class="formgrid">
        <Field label="Name"><input value={name} onInput={input(setName)} placeholder={brand ? named(kind, brandName(brand)) : { checking: 'Chase Checking', savings: 'Savings', card: 'Chase Freedom', investment: 'Brokerage', retirement: '401(k)', loan: 'Car loan', home: 'Home', car: '2022 RAV4', collectible: 'Trading cards, jewelry', other: 'A boat' }[kind]} required={!brand} /></Field>
        <MoneyField label={owes ? 'Owed' : held(kind) ? 'Worth' : 'Balance'} value={balance} set={setBalance} />
        {kind === 'card' && <MoneyField label="Pending" value={pending} set={setPending} />}
        {kind === 'savings' && <Field label="Interest, % a year"><input inputmode="decimal" value={rate} onInput={input(setRate)} placeholder="3.2" /></Field>}
        {(kind === 'loan' || kind === 'card') && <Field label={kind === 'card' ? 'Interest (APR), % a year, if it carries a balance' : 'Interest (APR), % a year'}><input inputmode="decimal" value={rate} onInput={input(setRate)} placeholder={kind === 'card' ? '24.99' : '6.5'} /></Field>}
        {kind === 'loan' && <MoneyField label="Borrowed at the start" value={original} set={setOriginal} />}
        {property && <AccountSelect label="Loan against it" value={loan} set={setLoan} accounts={loans} none="None" />}
        <Field label={{ home: 'Address', car: 'Year and model', card: 'Last 4 digits', checking: 'Last 4 digits', savings: 'Last 4 digits' }[kind] || 'Note'}><input value={detail} onInput={input(setDetail)} /></Field>
      </div>
      <Actions busy={busy} exists={!!a} remove={remove} close={props.close} problem={problem} touched={touched} uses={uses} removeAll={() => without(true)} />
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
  const { busy, keep, touched, watch } = useSaving(props);
  const accounts = (plan.accounts || []).filter((a) => !owed(a.kind) && !held(a.kind));
  const [problem, setProblem] = useState('');
  const setDed = (i: number, k: string, v: string) => setDeds(deds.map((d, j) => (j === i ? { ...d, [k]: v } : d)));
  const submit = (ev: Event) => {
    ev.preventDefault();
    const wrong = !name.trim() ? 'Give their name.' : num(net) <= 0 ? 'Type the take-home pay on each check.' : every === 'twice a month' && !(num(day2) >= 1 && num(day2) <= 31) ? 'The second day is 1 to 31.' : every === 'twice a month' && num(day2) === parseDay(start).getDate() ? 'The second day is the first one again: pick another.' : '';
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
    <form class="finform" onSubmit={submit} {...watch}>
      <div class="formhead"><Who name={name || '?'} n={Math.max(0, (plan.people || []).findIndex((q) => q.id === e?.id)) + (e ? 0 : (plan.people || []).length)} size="lg" /><h2 id="finSheetTitle">{e ? e.name : 'Add someone who gets paid'}</h2></div>
      <div class="formgrid">
        <Field label="Name"><input value={name} onInput={input(setName)} required /></Field>
        <MoneyField label="Take-home per check" value={net} set={setNet} />
        <ScheduleFields every={every} setEvery={setEvery} start={start} setStart={setStart} day2={day2} setDay2={setDay2} startLabel={e ? 'A payday' : 'Next payday'} />
        <AccountSelect label="Lands in" value={account} set={setAccount} accounts={accounts} none={accounts.length ? undefined : 'Checking'} />
        <MoneyField label="Gross per check (optional)" value={gross} set={setGross} />
      </div>
      <h3 class="formsub">Deductions <span class="muted">{gross && taken ? `${money(num(gross) - taken)} left of gross` : ''}</span></h3>
      {deds.map((d, i) => (
        <div class="dedrow" key={i}>
          <input aria-label="Deduction" value={d.name} placeholder="401(k)" onInput={(ev) => setDed(i, 'name', (ev.target as HTMLInputElement).value)} />
          <span class="moneyfield"><span aria-hidden="true">{currencySign()}</span><input aria-label={`${d.name || 'Deduction'} amount`} inputmode="decimal" value={d.amount} onInput={(ev) => setDed(i, 'amount', (ev.target as HTMLInputElement).value)} /></span>
          <select aria-label={`${d.name || 'Deduction'} goes into`} value={d.account} onChange={(ev) => setDed(i, 'account', (ev.target as HTMLSelectElement).value)}>
            <option value="">Nowhere (tax, insurance)</option>
            {(plan.accounts || []).filter((a) => a.kind === 'retirement' || a.kind === 'savings' || a.kind === 'investment').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button type="button" class="small" aria-label={`Remove ${d.name || 'deduction'}`} onClick={() => setDeds(deds.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      <p><button type="button" class="small addded" onClick={() => setDeds([...deds, { name: '', amount: '', account: '' }])}>Add a deduction</button></p>
      <Actions busy={busy} exists={!!e} remove={remove} close={props.close} problem={problem} touched={touched} />
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
