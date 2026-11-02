// Wallos, on a click: the subscriptions Wallos keeps on this machine, read
// only while it runs (the computer only), with those the plan doesn't have
// yet to add, each or all. A subscription is in the plan already when a
// payment has its name (as a person would write it) or its brand. Each
// added is a payment from its next day in Wallos, with its brand's logo,
// and its type from Wallos's category, else from its brand. Those turned
// off in Wallos, and those on a rhythm Finances doesn't keep (every 6
// months), are named, not added.
import { useState } from 'preact/hooks';
import { Row, Rows } from '../../parts/Row';
import { Amount } from '../ui/Amount';
import { Widget } from '../ui/Widget';
import { brandOf, kindForBrand, Mark, subTypeName, suggestType } from '../Mark';
import { cleanPayee } from '../payees';
import { allPayments, dayShort, money, plural } from '../money';

type Sub = app.AppSubscription;

/** Words for matching: lower case, letters and digits, one space between. */
const flat = (s: string) => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** A Wallos category as a subscription's type ("Entertainment" is streaming); none when it doesn't say. */
export function typeFromCategory(cat: string | undefined): string {
  const c = flat(cat || '');
  const pairs: [RegExp, string][] = [
    [/entertainment|music|video|stream|tv|movie/, 'streaming'], [/cloud|hosting|storage|backup|vpn/, 'cloud'], [/software|productivity|technology|app/, 'software'],
    [/gam/, 'gaming'], [/news|magazine|reading|book/, 'news'], [/health|fitness|sport|wellbeing|gym/, 'fitness'], [/food|beverage|meal|grocer/, 'food'], [/phone|mobile|telecom/, 'phone'],
  ];
  return (c && pairs.find(([re]) => re.test(c))?.[1]) || '';
}

/** The payment a subscription in Wallos becomes: from its next day, its brand's logo, its category's type. */
export function paymentFromWallos(s: Sub, today: string): finance.Payment {
  const brand = brandOf(undefined, s.name) || brandOf(undefined, cleanPayee(s.name));
  const kind = kindForBrand(brand) || (/utilit/i.test(s.category || '') ? 'utilities' : 'subscriptions');
  const type = kind === 'subscriptions' ? typeFromCategory(s.category) || suggestType(brand, s.name) : '';
  return { id: '', name: s.name, amount: s.amount, kind, institution: brand, type: type || undefined, schedule: { every: s.every, start: s.next || today } };
}

/** What Wallos holds, sorted for the widget: to add, in the plan already, turned off, and on a rhythm Finances doesn't keep. */
export function sortWallos(subs: Sub[], plan: finance.Plan) {
  const payments = allPayments(plan);
  const names = new Set(payments.flatMap((x) => [flat(x.name), flat(cleanPayee(x.name))]));
  const brands = new Set(payments.map((x) => brandOf(x.institution, x.name)).filter((b) => b && b !== 'none'));
  const inPlan = (s: Sub) => {
    const b = brandOf(undefined, s.name) || brandOf(undefined, cleanPayee(s.name));
    return names.has(flat(s.name)) || names.has(flat(cleanPayee(s.name))) || (!!b && brands.has(b));
  };
  const out = { add: [] as Sub[], have: [] as Sub[], off: [] as Sub[], odd: [] as Sub[] };
  const seen = new Set<string>();
  for (const s of subs) {
    if (seen.has(flat(s.name))) continue; // the same one twice in Wallos: once
    seen.add(flat(s.name));
    if (s.off) out.off.push(s);
    else if (inPlan(s)) out.have.push(s);
    else if (!s.every) out.odd.push(s);
    else out.add.push(s);
  }
  return out;
}

const rhythm: Record<string, string> = { week: 'a week', '2 weeks': 'every other week', month: 'a month', '3 months': 'every 3 months', year: 'a year' };

export function WallosWidget({ v, read, keep }: { v: finance.View; read: () => Promise<Sub[]>; keep: (plan: finance.Plan) => Promise<boolean> }) {
  const [got, setGot] = useState<{ busy?: boolean; subs?: Sub[]; problem?: string }>({});
  const pull = async () => {
    setGot({ busy: true });
    try { setGot({ subs: await read() }); } catch (e) { setGot({ problem: String((e as Error)?.message || e) }); }
  };
  const add = (subs: Sub[]) => keep({ ...v.plan, payments: [...(v.plan.payments || []), ...subs.map((s) => paymentFromWallos(s, v.today))] });
  const sorted = got.subs && sortWallos(got.subs, v.plan);
  const button = <button type="button" class="small" disabled={got.busy} onClick={pull}>{got.busy ? 'Reading Wallos…' : got.subs ? 'Read again' : 'From Wallos'}</button>;
  const names = (list: Sub[]) => list.map((s) => s.name).join(', ');
  return (
    <Widget title="Subscriptions in Wallos" span="all" kind="fx-wallos" actions={button}>
      {!got.subs && !got.problem && <p class="fx-sub fx-lead">Wallos is running here. Bring in the subscriptions it keeps that the plan doesn't have yet; Wallos isn't changed.</p>}
      {got.problem && <p class="formerr bad" role="alert">{got.problem}</p>}
      {sorted && <>
        {sorted.add.length ? <>
          <p class="fx-sub fx-lead" role="status">{plural(sorted.add.length, 'subscription')} not in the plan yet.</p>
          <Rows kind="fx-rows">
            {sorted.add.map((s) => {
              const x = paymentFromWallos(s, v.today);
              return <Row key={s.name} lead={<Mark brand={x.institution} name={s.name} kind={x.kind} type={x.type} />} title={s.name}
                sub={[rhythm[s.every] ? `${money(s.amount)} ${rhythm[s.every]}` : '', s.next && `next ${dayShort(s.next)}`, x.type && subTypeName(x.type)].filter(Boolean).join(' · ')}
                end={<button type="button" class="small" onClick={() => add([s])} aria-label={`Add ${s.name} to the plan`}>Add</button>}
                when={<Amount value={s.amount} form="full" />} whenPlain />;
            })}
          </Rows>
          {sorted.add.length > 1 && <div class="fx-wallosall"><button type="button" class="small" onClick={() => add(sorted.add)}>Add all {sorted.add.length}</button></div>}
        </> : <p class="fx-sub fx-lead" role="status">{!got.subs!.length ? 'Wallos has no subscriptions yet.' : sorted.odd.length || sorted.off.length ? 'Nothing in Wallos to add.' : 'Every subscription in Wallos is in the plan.'}</p>}
        {!!(sorted.have.length || sorted.odd.length || sorted.off.length) && <div class="fx-wallosnotes">
          {!!sorted.have.length && <p class="fx-sub fx-wallosnote">In the plan already: {names(sorted.have)}.</p>}
          {!!sorted.odd.length && <p class="fx-sub fx-wallosnote">On a rhythm Finances doesn't keep, so add them by hand: {sorted.odd.map((s) => `${s.name} (${s.cycle})`).join(', ')}.</p>}
          {!!sorted.off.length && <p class="fx-sub fx-wallosnote">Turned off in Wallos, so left out: {names(sorted.off)}.</p>}
        </div>}
      </>}
    </Widget>
  );
}
