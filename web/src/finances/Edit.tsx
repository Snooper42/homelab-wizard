// Finances' sheet: adding or changing a payment, an account (first what
// kind, then its bank, broker, or make by logo, and what it holds), or
// someone who gets paid; and updating every balance at once. What is typed
// stays in the form until Save; screens/finances.ts keeps the plan.
import { render } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Segmented } from '../parts/Segmented';
import { Sheet } from '../parts/Sheet';
import { AcctMark, allBrands, brandName, brandOf, brandsFor, kindForBrand, Mark, ownKey, subTypeName, subTypes, suggestType, Who } from './Mark';
import { allPayments, currencySign, money, owed, parseAmount, parseDay, todayISO } from './money';
import { TxMark } from './Transactions';

export type What = 'account' | 'person' | 'payment' | 'balances' | 'transaction';

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
  /** Each account today as expected, by ID (View.Start): what Update balances starts from. */
  start?: Record<string, number>;
  /** Keeps the plan; false when it failed (the screen says why). */
  save: (plan: finance.Plan) => Promise<boolean>;
  /** The categories a transaction is offered (the plan's, or the defaults). */
  categories?: finance.Category[];
  /** The ledger, and keeping it (a transaction's form); false when it failed. */
  ledger?: finance.Ledger | null;
  saveLedger?: (l: finance.Ledger) => Promise<boolean>;
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
    onClickCapture: (e: MouseEvent) => { if ((e.target as Element).closest('.brandgrid button, .kindswap button, .dedrow button, button.addded, .ownlogo button')) setTouched(true); },
  };
  const keep = async (plan: finance.Plan) => {
    setBusy(true);
    const ok = await props.save(plan);
    setBusy(false);
    if (ok) props.close();
  };
  return { busy, keep, touched, watch };
}

/**
 * An image of one's own as a small data URL: drawn into 96 pixels square
 * on this device (never sent anywhere to be made smaller), as PNG, or as
 * WebP when a photo makes the PNG too large for the file.
 */
async function shrink(f: File): Promise<string> {
  const bmp = await createImageBitmap(f);
  const n = 96, scale = Math.min(n / bmp.width, n / bmp.height, 1);
  const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
  const c = new OffscreenCanvas(n, n);
  c.getContext('2d')!.drawImage(bmp, (n - w) / 2, (n - h) / 2, w, h);
  const url = (b: Blob) => new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => bad(r.error); r.readAsDataURL(b); });
  const png = await url(await c.convertToBlob({ type: 'image/png' }));
  return png.length < 60000 ? png : url(await c.convertToBlob({ type: 'image/webp', quality: 0.85 }));
}

/** Your own image for a logo: picked from a file, shown at once, and kept with the plan when it is saved. */
function OwnLogo({ value, set, what }: { value?: string; set: (img: string | undefined) => void; what: string }) {
  const file = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState('');
  const read = async (f?: File) => {
    if (!f) return;
    try { set(await shrink(f)); setProblem(''); } catch { setProblem('That file is not a picture this can read: try a PNG or a JPEG.'); }
  };
  return (
    <div class="ownlogo">
      <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden aria-label={`Your own image for ${what}`} onChange={(e) => { read(e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} />
      <button type="button" class="small" onClick={() => file.current?.click()}>{value ? 'Use another image' : `Use your own image for ${what}`}</button>
      {value && <button type="button" class="small" onClick={() => set(undefined)}>Remove your image</button>}
      {problem && <span class="formerr bad" role="alert">{problem}</span>}
    </div>
  );
}

/** The plan's own logos once a form is saved: its image under its key, or the one it opened with gone when removed. */
function withLogo(plan: finance.Plan, key: string, img: string | undefined, opened: string, had: string | undefined): Record<string, string> | undefined {
  const logos = { ...(plan.logos || {}) };
  if (img) logos[key] = img;
  else if (had) delete logos[opened];
  return Object.keys(logos).length ? logos : undefined;
}

/**
 * A box ticked, read on its click: by its change event the form, which
 * marked itself touched on the input event before it, has drawn the box
 * again as it was, so a click by mouse or finger never ticked it.
 */
const tick = (set: (on: boolean) => void) => (e: MouseEvent) => set((e.currentTarget as HTMLInputElement).checked);

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
      {!!people?.length && <option value="paycheck:">With each paycheck, whoever is paid</option>}
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
  // A new payment's category follows its logo (Netflix a subscription) until one is picked by hand.
  const kindPicked = useRef(!!x);
  const follow = (b: string) => { const k = kindForBrand(b); if (k && !kindPicked.current) setKind(k); };
  const rename = (n: string) => { setName(n); if (!picked.current) { const b = brandOf(undefined, n) || ''; setBrand(b); follow(b); } };
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
  // A subscription's type: the one picked, or "" for the one suggested from its logo or name as they change.
  const [type, setType] = useState(x?.type || '');
  // The household's own image for its logo, as it opened (its brand's, or its name's).
  const opened = ownKey(brandOf(x?.institution, x?.name), x?.name);
  const had = plan.logos?.[opened];
  const [img, setImg] = useState(had);
  const suggested = suggestType(brand, name);
  const { busy, keep, touched, watch } = useSaving(props);
  const [problem, setProblem] = useState('');
  const accounts = plan.accounts || [];
  const submit = (e: Event) => {
    e.preventDefault();
    const wrong = !name.trim() ? 'Give it a name.' : !card && num(amount) <= 0 ? 'Type how much it is.' : card && card === from ? 'A card can\'t pay itself off: pick the account it comes out of.' : every === 'twice a month' && !(num(day2) >= 1 && num(day2) <= 31) ? 'The second day is 1 to 31.' : every === 'twice a month' && num(day2) === parseDay(start).getDate() ? 'The second day is the first one again: pick another.' : '';
    setProblem(wrong);
    if (wrong) return;
    const p: finance.Payment = { id: x?.id || '', name: name.trim(), amount: num(amount), estimate, kind, institution: brand || undefined,
      schedule: { every, start, day2: every === 'twice a month' ? num(day2) : undefined, person: every === 'paycheck' ? person : undefined }, from: from === checking ? undefined : from || undefined, to: to || undefined, card: card || undefined,
      type: kind === 'subscriptions' && type ? type : undefined };
    const list = (plan.payments || []).slice();
    const at = list.findIndex((q) => q.id === x?.id);
    if (at >= 0) list[at] = p; else list.push(p);
    keep({ ...plan, payments: list, logos: withLogo(plan, ownKey(brand, p.name), img, opened, had) });
  };
  const remove = () => keep({ ...plan, payments: (plan.payments || []).filter((q) => q.id !== x?.id) });
  return (
    <form class="finform" onSubmit={submit} {...watch}>
      <div class="formhead"><Mark brand={brand === 'none' ? '' : brand} kind={kind} name={name || 'Payment'} type={kind === 'subscriptions' ? type || suggested : undefined} img={img} size="lg" /><h2 id="finSheetTitle">{x ? x.name : 'Add a payment'}</h2></div>
      <BrandPick kind={kind} value={brand === 'none' ? '' : brand} set={(k) => { picked.current = true; setBrand(k || 'none'); follow(k); if (k && !name.trim()) setName(brandName(k)); }} payment />
      <OwnLogo value={img} set={setImg} what={brand && brand !== 'none' ? brandName(brand) : name.trim() || 'this payment'} />
      <div class="formgrid">
        <Field label="Name"><input value={name} onInput={input(rename)} placeholder="Mortgage" required /></Field>
        <MoneyField label={card ? 'Other spending on it each time (each pays the balance)' : 'Amount'} value={amount} set={setAmount} />
        <Field label="Category"><select value={kind} onChange={input((k) => { kindPicked.current = true; setKind(k); })}>{categories.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></Field>
        {kind === 'subscriptions' && <Field label="Type"><select value={type} onChange={input(setType)}>
          <option value="">{suggested ? `${subTypeName(suggested)} (from its ${brand && brand !== 'none' ? 'logo' : 'name'})` : 'Other (pick one)'}</option>
          {subTypes.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select></Field>}
        <ScheduleFields every={every} setEvery={setEvery} start={start} setStart={setStart} day2={day2} setDay2={setDay2} startLabel={x ? 'Starting' : 'Next on'} people={plan.people} person={person} setPerson={setPerson} />
        <AccountSelect label="Comes out of, or is charged to" value={from} set={setFrom} accounts={accounts.filter((a) => (a.kind === 'card' || !owed(a.kind)) && !held(a.kind))} none={accounts.length ? undefined : 'Checking'} />
        <AccountSelect label="Goes into" value={to} set={setTo} accounts={accounts.filter((a) => a.id !== from && !held(a.kind))} none="Nowhere (a bill)" />
        <AccountSelect label="Pays off a card" value={card} set={setCard} accounts={accounts.filter((a) => a.kind === 'card')} none="No" />
        <label class="fcheckbox wide"><input type="checkbox" checked={estimate} onClick={tick(setEstimate)} /> The amount changes each time (an estimate)</label>
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
  // And whenever the name picks one out of view as it is typed ("Toyota" far down): the grid goes to it.
  useLayoutEffect(() => {
    if (!value) return undefined;
    const id = requestAnimationFrame(() => {
      const g = grid.current, on = g?.querySelector('.on');
      if (!g || !on) return;
      const top = on.getBoundingClientRect().top - g.getBoundingClientRect().top, bottom = top + on.getBoundingClientRect().height;
      if (top < 0 || bottom > g.clientHeight) g.scrollTop += top - 4;
    });
    return () => cancelAnimationFrame(id);
  }, [value]);
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
  // The logo: the one picked (None too, kept as "none"), else the brand in its name as it is typed
  // ("Chase Checking" is Chase; a car's model, "CX-5", its make).
  const [brand, setBrand] = useState(brandOf(a?.institution, a?.name, a?.kind || props.kind) || '');
  const picked = useRef(!!a?.institution);
  const rename = (n: string) => { setName(n); if (!picked.current) setBrand(brandOf(undefined, n, kind) || ''); };
  const pickBrand = (k: string) => { picked.current = true; setBrand(k || 'none'); };
  const opened = ownKey(brandOf(a?.institution, a?.name, a?.kind), a?.name);
  const had = plan.logos?.[opened];
  const [img, setImg] = useState(had);
  // "none" is a None picked by hand: no logo, and no bank to name it after.
  const real = brand === 'none' ? '' : brand;
  const [balance, setBalance] = useState(text(a?.balance));
  const [pending, setPending] = useState(text(a?.pending));
  const [rate, setRate] = useState(text(a?.rate));
  const [original, setOriginal] = useState(text(a?.original));
  const [loan, setLoan] = useState(a?.loan || '');
  const [detail, setDetail] = useState(a?.detail || '');
  const [paidEach, setPaidEach] = useState(!!a?.paidEach);
  const [spend, setSpend] = useState(text(a?.spend));
  // A payment that pays this card off already: paid off with each paycheck too would pay it twice.
  const payer = (plan.payments || []).find((x) => a && x.card === a.id);
  const { busy, keep, touched, watch } = useSaving(props);
  const [problem, setProblem] = useState('');
  const loans = (plan.accounts || []).filter((q) => q.kind === 'loan');
  const submit = (e: Event) => {
    e.preventDefault();
    const wrong = !name.trim() && !real ? 'Give it a name, or pick its bank.' : num(balance) < 0 && (owed(kind) || held(kind)) ? 'Type it without a minus.'
      : kind === 'card' && paidEach && payer ? `“${payer.name}” pays it off already: delete that payment, or leave this off.` : kind === 'card' && paidEach && num(spend) < 0 ? 'Type the spending without a minus.' : '';
    setProblem(wrong);
    if (wrong) return;
    // A balance (or a card's pending) typed in again is today's; a new name alone leaves its day.
    const retyped = !a || num(balance) !== a.balance || (kind === 'card' && num(pending) !== (a.pending || 0));
    const next: finance.Account = { id: a?.id || '', kind, name: name.trim() || (real ? named(kind, brandName(real)) : ''), institution: brand || undefined, balance: num(balance), detail: detail.trim() || undefined, updated: retyped ? todayISO() : a?.updated,
      pending: kind === 'card' ? num(pending) : undefined, rate: kind === 'savings' || kind === 'loan' || kind === 'card' ? num(rate) || undefined : undefined, original: kind === 'loan' ? num(original) : undefined,
      loan: kind === 'home' || kind === 'car' ? loan || undefined : undefined,
      paidEach: kind === 'card' && paidEach ? true : undefined, spend: kind === 'card' && paidEach ? num(spend) || undefined : undefined };
    const list = (plan.accounts || []).slice();
    const at = list.findIndex((q) => q.id === a?.id);
    if (at >= 0) list[at] = next; else list.push(next);
    keep({ ...plan, accounts: list, logos: withLogo(plan, ownKey(brand, next.name), img, opened, had) });
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
  const pick = (k: string) => { setKind(k); setBrand(''); picked.current = false; setStep('form'); };
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
  const said = name.trim() || (real ? named(kind, brandName(real)) : '');
  return (
    <form class="finform" ref={form} onSubmit={submit} {...watch}>
      {/* What it will be: its mark, its name, and its amount, as typed. */}
      <div class="formhead">
        <Mark brand={real} kind={kind} name={said || 'Account'} img={img} size="lg" />
        <div class="grow">
          <h2 id="finSheetTitle">{a ? a.name : `Add ${adding[kind] || 'an account'}`}</h2>
          {!a && <div class="formsays muted">{said || 'Its name, below'}{balance.trim() && ` · ${owes ? 'owes ' : ''}${money(num(balance))}`}</div>}
        </div>
        {!a && !props.kind && <button type="button" class="small" onClick={() => setStep('kind')}>Change</button>}
      </div>
      {/* An account's kind is picked when it is added; other things and collectibles can trade places later
          (jewelry typed in as Other before there were collectibles). */}
      {a && (a.kind === 'other' || a.kind === 'collectible') && <div class="kindswap"><Segmented label="Kind" value={kind} pick={setKind} options={[['collectible', 'Collectibles'], ['other', 'Something else']]} /></div>}
      {kind !== 'other' && kind !== 'collectible' && <BrandPick kind={kind} value={real} set={pickBrand} />}
      <OwnLogo value={img} set={setImg} what={real ? brandName(real) : said || 'this account'} />
      <div class="formgrid">
        <Field label="Name"><input value={name} onInput={input(rename)} placeholder={real ? named(kind, brandName(brand)) : { checking: 'Chase Checking', savings: 'Savings', card: 'Chase Freedom', investment: 'Brokerage', retirement: '401(k)', loan: 'Car loan', home: 'Home', car: '2022 RAV4', collectible: 'Trading cards, jewelry', other: 'A boat' }[kind]} required={!brand} /></Field>
        <MoneyField label={owes ? 'Owed' : held(kind) ? 'Worth' : 'Balance'} value={balance} set={setBalance} />
        {kind === 'card' && <MoneyField label="Pending" value={pending} set={setPending} />}
        {kind === 'card' && <label class="fcheckbox wide"><input type="checkbox" checked={paidEach} onClick={tick(setPaidEach)} /> I pay it off in full with each paycheck</label>}
        {kind === 'card' && paidEach && <MoneyField label="Spending on it between paychecks, about" value={spend} set={setSpend} hint="400.00" />}
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

/**
 * Update balances: every account in one list, each box starting at what
 * it is expected to hold today, the difference shown as it is typed, and
 * Enter (or Save) keeping them all as today's.
 */
function BalancesForm(props: EditProps) {
  const { plan, start } = props;
  const accounts = plan.accounts || [];
  // What each is expected to hold (what a card or loan owes, less a card's pending), and its pending.
  const est = (a: finance.Account) => (owed(a.kind) ? Math.max(0, Math.round(((start?.[a.id] ?? a.balance + (a.pending || 0)) - (a.pending || 0)) * 100) / 100) : start?.[a.id] ?? a.balance);
  const [typed, setTyped] = useState<Record<string, string>>(() => ({ cushion: String(plan.cushion || 0), ...Object.fromEntries(accounts.flatMap((a) => [[a.id, String(est(a))], ...(a.kind === 'card' ? [[a.id + ':p', String(a.pending || 0)]] : [])])) }));
  const { busy, keep, touched, watch } = useSaving(props);
  const [problem, setProblem] = useState('');
  const first = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => { first.current?.focus(); first.current?.select(); }, []);
  const read = (key: string, was: number) => { const n = parseAmount(typed[key] ?? ''); return typed[key]?.trim() && !isNaN(n) ? n : was; };
  const submit = (e: Event) => {
    e.preventDefault();
    const bad = accounts.find((a) => (owed(a.kind) || held(a.kind)) && read(a.id, est(a)) < 0);
    const wrong = bad ? `${bad.name}: type it without a minus.` : '';
    setProblem(wrong);
    if (wrong) return;
    const today = todayISO();
    keep({ ...plan, updated: today, cushion: Math.max(0, read('cushion', plan.cushion || 0)), accounts: accounts.map((a) => ({ ...a, balance: read(a.id, est(a)), pending: a.kind === 'card' ? read(a.id + ':p', a.pending || 0) : a.pending, updated: today })) });
  };
  const type = (key: string) => (e: Event) => setTyped({ ...typed, [key]: (e.target as HTMLInputElement).value });
  return (
    <form class="finform finbalances" onSubmit={submit} {...watch}>
      <div class="formhead"><h2 id="finSheetTitle">Update balances</h2></div>
      <p class="formsub muted">Each starts at what it should hold today. Type what your bank shows, then press Enter.</p>
      <ul class={'balancelist' + (accounts.some((a) => a.kind === 'card') ? ' cards' : '')}>
        {accounts.map((a, i) => {
          const d = read(a.id, est(a)) - est(a);
          return (
            <li key={a.id}>
              <AcctMark a={a} size="sm" />
              <label class="grow" for={'bal-' + a.id}><strong>{a.name}</strong>
                <small>{owed(a.kind) ? 'owed' : held(a.kind) ? 'worth' : 'today'} · expected {money(est(a))}{Math.abs(d) >= 0.005 && <>, <span class={d < 0 === !owed(a.kind) ? 'bad' : 'ok'}>{signedText(d)}</span></>}</small>
              </label>
              <span class="moneyfield"><span aria-hidden="true">{currencySign()}</span><input id={'bal-' + a.id} ref={i === 0 ? first : undefined} inputmode="decimal" value={typed[a.id]} onInput={type(a.id)} /></span>
              {a.kind === 'card' && <label class="pendingfield"><span class="moneyfield"><span aria-hidden="true">{currencySign()}</span><input aria-label={`${a.name} pending`} inputmode="decimal" value={typed[a.id + ':p']} onInput={type(a.id + ':p')} /></span><small aria-hidden="true">pending</small></label>}
            </li>
          );
        })}
      </ul>
      {!accounts.length && <p class="muted">No accounts yet: add one first.</p>}
      <label class="field cushion">Flag checking under <span class="moneyfield"><span aria-hidden="true">{currencySign()}</span><input inputmode="decimal" value={typed.cushion} onInput={type('cushion')} /></span></label>
      <Actions busy={busy} exists={false} remove={() => {}} close={props.close} problem={problem} touched={touched} />
    </form>
  );
}

/** +$487.60, −$12.00. */
const signedText = (n: number) => (n < 0 ? '−' : '+') + money(Math.abs(n));

/**
 * A transaction: money out, money in, or moved between the household's
 * own accounts; its payee (the logo follows the name, as a payment's
 * does), day, account, category, the planned payment it pays, and a note.
 * Picking a planned payment fills in what is still empty from it. Splits
 * and tags a transaction already has are kept as they are.
 */
function TransactionForm(props: EditProps) {
  const { plan, checking, ledger } = props;
  const t = (ledger?.transactions || []).find((q) => q.id === props.id);
  const accounts = (plan.accounts || []).filter((a) => !held(a.kind));
  const payments = allPayments(plan);
  const [way, setWay] = useState(t?.to ? 'move' : t && t.amount > 0 ? 'in' : 'out');
  const [payee, setPayee] = useState(t?.payee || '');
  const [amount, setAmount] = useState(t ? String(Math.abs(t.amount)) : '');
  const [date, setDate] = useState(t?.date || todayISO());
  const [account, setAccount] = useState(t?.account || checking || accounts[0]?.id || '');
  const [to, setTo] = useState(t?.to || '');
  const [category, setCategory] = useState(t?.category || '');
  const [payment, setPayment] = useState(t?.payment || '');
  const [note, setNote] = useState(t?.note || '');
  // Parts across categories, as typed (amounts without a sign: the whole's way), and tags, comma between.
  const [parts, setParts] = useState((t?.splits || []).map((sp) => ({ category: sp.category, amount: text(Math.abs(sp.amount)), note: sp.note || '' })));
  const [tagText, setTagText] = useState((t?.tags || []).join(', '));
  const setPart = (i: number, k: string, val: string) => setParts(parts.map((sp, j) => (j === i ? { ...sp, [k]: val } : sp)));
  const placed = parts.reduce((sum, sp) => sum + num(sp.amount), 0);
  const split = () => setParts(parts.length ? [...parts, { category: '', amount: '', note: '' }] : [{ category: category.trim(), amount: amount.trim(), note: '' }, { category: '', amount: '', note: '' }]);
  const { busy, touched, watch } = useSaving(props);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState('');
  // What was typed before: payees and categories to pick from as they are typed.
  const past = (f: (q: finance.Transaction) => string | undefined) => [...new Set((ledger?.transactions || []).map(f).filter(Boolean) as string[])].sort();
  // The household's categories first (each under its group's name), then any typed before that is not one of them.
  const named = (props.categories || []).map((c) => c.name);
  const categoryList = [...named, ...past((q) => q.category).filter((c) => !named.some((n) => n.toLowerCase() === c.toLowerCase()))];
  // A new one's category is what its payee had last, until one is typed.
  const catTyped = useRef(!!t);
  const lastFor = (who: string) => [...(ledger?.transactions || [])].reverse().find((q) => q.payee && q.payee.toLowerCase() === who.trim().toLowerCase() && q.category)?.category;
  const typePayee = (who: string) => { setPayee(who); if (!catTyped.current) setCategory(lastFor(who) || ''); };
  const choose = (id: string) => {
    setPayment(id);
    const x = payments.find((q) => q.id === id);
    if (!x) return;
    if (!payee.trim()) setPayee(x.name);
    if (!amount.trim() && x.amount) setAmount(String(x.amount));
    if (!category.trim()) setCategory(categories.find(([k]) => k === x.kind)?.[1] || '');
    if (x.card && way !== 'move') setWay('out');
  };
  const keepLedger = async (list: finance.Transaction[]) => {
    setSaving(true);
    const ok = await props.saveLedger!({ ...(ledger || { transactions: [] }), transactions: list });
    setSaving(false);
    if (ok) props.close();
  };
  const submit = (e: Event) => {
    e.preventDefault();
    const n = num(amount);
    const used = way === 'move' ? [] : parts.filter((sp) => sp.category.trim() || num(sp.amount));
    const wrong = !(n > 0) ? 'Type how much it was.' : way === 'move' && !to ? 'Pick the account it went into.' : way === 'move' && to === account ? 'It went into another account: pick that one.' : way !== 'move' && !payee.trim() ? 'Who was paid, or who paid?' : !date ? 'Pick the day.'
      : used.some((sp) => !sp.category.trim()) ? 'Give each part a category.' : used.length && Math.abs(used.reduce((sum, sp) => sum + num(sp.amount), 0) - n) >= 0.005 ? `The parts come to ${money(used.reduce((sum, sp) => sum + num(sp.amount), 0))}, not ${money(n)}.` : '';
    setProblem(wrong);
    if (wrong) return;
    const next: finance.Transaction = { ...(t || {}), id: t?.id || '', date, account, amount: way === 'in' ? n : -n, payee: payee.trim() || undefined, category: category.trim() || undefined,
      note: note.trim() || undefined, payment: payment || undefined, to: way === 'move' ? to : undefined, institution: t?.institution,
      splits: used.length > 1 ? used.map((sp) => ({ category: sp.category.trim(), amount: way === 'in' ? num(sp.amount) : -num(sp.amount), note: sp.note.trim() || undefined })) : undefined,
      tags: tagText.split(',').map((x) => x.trim().toLowerCase()).filter((x, i, all) => x && all.indexOf(x) === i) };
    // One part alone is the whole: its category is the transaction's. Split, the categories are the parts'.
    if (used.length === 1) next.category = used[0].category.trim();
    if (used.length > 1) next.category = undefined;
    if (!next.tags!.length) next.tags = undefined;
    const list = (ledger?.transactions || []).slice();
    const at = list.findIndex((q) => q.id === t?.id);
    if (at >= 0) list[at] = next; else list.push(next);
    keepLedger(list);
  };
  const remove = () => keepLedger((ledger?.transactions || []).filter((q) => q.id !== t?.id));
  return (
    <form class="finform" onSubmit={submit} {...watch}>
      <div class="formhead"><TxMark t={{ id: '', date, account, amount: 0, payee, institution: t?.institution, category, to: way === 'move' ? to || 'x' : undefined }} categories={props.categories} size="lg" /><h2 id="finSheetTitle">{t ? (t.payee || 'Transfer') : 'Add a transaction'}</h2></div>
      <div class="kindswap"><Segmented label="What it was" value={way} pick={setWay} options={[['out', 'Money out'], ['in', 'Money in'], ['move', 'Between my accounts']]} /></div>
      <div class="formgrid">
        <Field label={way === 'in' ? 'From' : way === 'move' ? 'What for (optional)' : 'Paid to'}><input value={payee} onInput={input(typePayee)} list="finPayees" placeholder={way === 'in' ? 'Alex\'s paycheck' : way === 'move' ? 'Emergency fund' : 'Costco'} /></Field>
        <MoneyField label="Amount" value={amount} set={setAmount} />
        <Field label="Day"><input type="date" value={date} onInput={input(setDate)} required /></Field>
        <AccountSelect label={way === 'in' ? 'Into' : way === 'move' ? 'Out of' : 'Out of, or charged to'} value={account} set={setAccount} accounts={accounts} />
        {way === 'move' && <AccountSelect label="Into" value={to} set={setTo} accounts={accounts.filter((a) => a.id !== account)} none="Pick one" />}
        {way !== 'move' && !parts.length && <Field label="Category"><input value={category} onInput={input((c) => { catTyped.current = true; setCategory(c); })} list="finCategories" placeholder="Groceries" /></Field>}
        <Field label="Pays a planned payment"><select value={payment} onChange={input(choose)}>
          <option value="">None</option>
          {payments.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select></Field>
        <Field label="Note" wide><input value={note} onInput={input(setNote)} /></Field>
        <Field label="Tags (a comma between)" wide><input value={tagText} onInput={input(setTagText)} placeholder="vacation, tax-deductible" /></Field>
      </div>
      {way !== 'move' && <>
        <h3 class="formsub">Split across categories <span class="muted">{parts.length ? (Math.abs(placed - num(amount)) < 0.005 ? 'all of it placed' : `${money(num(amount) - placed)} left to place`) : ''}</span></h3>
        {parts.map((sp, i) => (
          <div class="dedrow" key={i}>
            <input aria-label={`Part ${i + 1} category`} value={sp.category} placeholder="Groceries" list="finCategories" onInput={(ev) => setPart(i, 'category', (ev.target as HTMLInputElement).value)} />
            <span class="moneyfield"><span aria-hidden="true">{currencySign()}</span><input aria-label={`Part ${i + 1} amount`} inputmode="decimal" value={sp.amount} onInput={(ev) => setPart(i, 'amount', (ev.target as HTMLInputElement).value)} /></span>
            <input aria-label={`Part ${i + 1} note`} value={sp.note} placeholder="Note" onInput={(ev) => setPart(i, 'note', (ev.target as HTMLInputElement).value)} />
            <button type="button" class="small" aria-label={`Remove part ${i + 1}`} onClick={() => setParts(parts.filter((_, j) => j !== i))}>Remove</button>
          </div>
        ))}
        <p><button type="button" class="small addded" onClick={split}>{parts.length ? 'Add a part' : 'Split it'}</button></p>
      </>}
      <datalist id="finPayees">{past((q) => q.payee).map((x) => <option key={x} value={x} />)}</datalist>
      <datalist id="finCategories">{categoryList.map((x) => <option key={x} value={x} />)}</datalist>
      <Actions busy={busy || saving} exists={!!t} remove={remove} close={props.close} problem={problem} touched={touched} />
    </form>
  );
}

function FinanceSheet({ edit }: { edit: EditProps | null }) {
  return (
    <Sheet id="finSheet" titleId="finSheetTitle">
      {edit?.what === 'payment' && <PaymentForm key={'p' + edit.n} {...edit} />}
      {edit?.what === 'account' && <AccountForm key={'a' + edit.n} {...edit} />}
      {edit?.what === 'person' && <PersonForm key={'e' + edit.n} {...edit} />}
      {edit?.what === 'balances' && <BalancesForm key={'b' + edit.n} {...edit} />}
      {edit?.what === 'transaction' && <TransactionForm key={'t' + edit.n} {...edit} />}
      {!edit && <h2 id="finSheetTitle">Finances</h2>}
    </Sheet>
  );
}

/** Draws the sheet with a form in it (closed, or for null, empty). */
export function mountFinanceSheet(el: Element, edit: EditProps | null) { render(<FinanceSheet edit={edit} />, el); }
