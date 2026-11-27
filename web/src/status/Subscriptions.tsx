import { render } from 'preact';
import { AppMark } from '../parts/AppMark';
import { Card } from '../parts/Card';
import { brandOf, Mark } from '../finances/Mark';

export interface Offer {
  /** The apps that together replace it, by ID. */
  apps: string[];
  replaces: string;
  /** Direct (the same thing) or Equivalent (does the same job). */
  kind: string;
  monthly: number;
  annual: number;
  /** What it takes for the saving to be real. */
  condition: string;
  counted?: boolean;
}

export interface SubscriptionsProps {
  offers: Offer[] | null;
  /** The apps running now, by ID. */
  running: Set<string>;
  catalog: api.Catalog | null;
  icons?: Record<string, string>;
  /** The yearly saving each day, as the nightly backup recorded it. */
  history: savings.Point[];
  /** Opens an app's page (installed) or its page to add. */
  open: (id: string) => void;
}

const money = (n: number) => '$' + (n >= 100 ? Math.round(n).toLocaleString('en-US') : n.toFixed(2));
/** A year's amount in whole dollars, as every sum here is: "$60", "$1,457". */
const dollars = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

function Tile({ o, p, faded }: { o: Offer; p: SubscriptionsProps; faded?: boolean }) {
  const name = (id: string) => p.catalog?.apps.find((a) => a.id === id)?.name || id;
  const service = o.replaces.replace(/\s*\(.*\)$/, '');
  return (
    <li class={'subtile' + (faded ? ' faded' : '')}>
      <div class="subsvc">
        <Mark brand={brandOf(undefined, o.replaces)} name={service} size="lg" auto />
        <span class="subsvcname"><strong>{service}</strong><span class={'pill ' + (o.kind === 'Direct' ? 'ok' : '')}>{o.kind}</span></span>
      </div>
      <div class="subcost"><span class="subbig">{money(o.monthly)}</span><span class="muted"> a month</span><span class="subyear">{dollars(o.annual)} a year</span></div>
      <button type="button" class="subby" onClick={() => p.open(o.apps[0])}>
        <span class="muted">{faded ? 'Could be' : 'Replaced by'}</span>
        <span class="subapps">{o.apps.map((id) => <span key={id} class="subappname"><AppMark id={id} name={name(id)} icon={p.icons?.[id] || ''} small />{name(id)}</span>)}</span>
      </button>
    </li>
  );
}

/** The paid service an offer replaces, by its name without the note in brackets: two apps that replace one service count it once. */
const serviceOf = (o: Offer) => o.replaces.replace(/\s*\(.*\)$/, '').trim().toLowerCase();
const isLibrary = (o: Offer) => o.kind === 'Library';

/** The offers, one per paid service, with every app that can stand in for it (any one of them does). Its price, kind
 * and condition are the row the computer counts (`counted`, so this page and Status' yearly figure agree), else the
 * dearest row's (a computer before it sent `counted`). */
function perService(list: Offer[]): Offer[] {
  const out = new Map<string, Offer>();
  for (const o of list) {
    const k = serviceOf(o), had = out.get(k);
    if (!had) { out.set(k, { ...o, apps: [...o.apps] }); continue; }
    const apps = [...had.apps];
    for (const id of o.apps) if (!apps.includes(id)) apps.push(id);
    out.set(k, o.counted && !had.counted ? { ...o, apps } : { ...had, apps });
  }
  return [...out.values()];
}

export function Subscriptions(p: SubscriptionsProps) {
  // A service priced only by the year (no monthly plan) is a twelfth of it a month.
  const offers = (p.offers || []).filter((o) => Number.isFinite(o.annual)).map((o) => ({ ...o, monthly: Number.isFinite(o.monthly) && o.monthly > 0 ? o.monthly : o.annual / 12 })).sort((a, b) => b.annual - a.annual);
  const runs = (o: Offer) => o.apps.every((id) => p.running.has(id));
  const now = perService(offers.filter(runs));
  const replaced = new Set(now.map(serviceOf));
  const more = perService(offers.filter((o) => !runs(o) && !replaced.has(serviceOf(o))));
  const counted = now.filter((o) => !isLibrary(o));
  const year = counted.reduce((t, o) => t + o.annual, 0), month = counted.reduce((t, o) => t + o.monthly, 0);
  const could = more.filter((o) => !isLibrary(o)).reduce((t, o) => t + o.annual, 0);
  const appName = (id: string) => p.catalog?.apps.find((a) => a.id === id)?.name || id;
  // Where the saving comes from: each kind of app's share of the year, largest first, in its category's colour.
  const cats = p.catalog?.categories || [];
  const byCat = new Map<string, number>();
  for (const o of counted) { const c = p.catalog?.apps.find((a) => a.id === o.apps[0])?.category || 'other'; byCat.set(c, (byCat.get(c) || 0) + o.annual); }
  const parts = [...byCat.entries()].sort((x, y) => y[1] - x[1]).map(([id, n], i) => ({ id, label: cats.find((c) => c.id === id)?.label || 'Your own', n, tone: `var(--cat-${(i % 8) + 1})` }));
  return (
    <div class="subpage">
      <div class="row header"><div><h1>Subscriptions</h1><p class="lead">{p.offers ? `${dollars(year)} a year · ${money(month)} a month` : 'Reading the prices…'}</p></div></div>
      <div class="subtop">
        <Card kind="subcard" id="subWhere">
          <div class="anthead"><h2>Where it comes from</h2></div>
          {year > 0 ? <>
            <div class="subbar" role="img" aria-label={parts.map((x) => `${x.label} ${dollars(x.n)}`).join(', ')}>{parts.map((x) => <span key={x.id} style={{ width: `${(100 * x.n) / year}%`, background: x.tone }} />)}</div>
            <ul class="sublegend">{parts.map((x) => <li key={x.id}><i style={{ background: x.tone }} />{x.label}<strong>{dollars(x.n)}</strong></li>)}</ul>
          </> : <p class="muted">None of your apps replaces a paid service yet.</p>}
        </Card>
        <Card kind="subcard" id="subCould">
          <div class="anthead"><h2>Could save {dollars(could)} more a year</h2></div>
          <ul class="subnext">{more.filter((o) => !isLibrary(o)).slice(0, 3).map((o) => (
            <li key={o.replaces + o.apps.join()}><button type="button" class="subapp" onClick={() => p.open(o.apps[0])}>
              <span class="sublogos" aria-hidden="true"><AppMark id={o.apps[0]} name={appName(o.apps[0])} icon={p.icons?.[o.apps[0]] || ''} small /></span>
              <span class="subnames"><strong>{o.apps.map(appName).join(' + ')}</strong><span class="muted">{o.replaces}</span></span>
              <span class="subprice"><strong>{dollars(o.annual)}</strong></span>
            </button></li>
          ))}</ul>
        </Card>
      </div>
      <Card kind="subcard" id="subNow">
        <h2>Replaced now <span class="n">{now.length}</span></h2>
        {now.length ? <ul class="subtiles">{now.map((o) => <Tile key={o.replaces + o.apps.join()} o={o} p={p} />)}</ul> : <p class="muted">None of your apps replaces a paid service yet.</p>}
      </Card>
      {more.length > 0 && <Card kind="subcard" id="subMore">
        <h2>Could replace too <span class="n">{more.length}</span></h2>
        <ul class="subtiles">{more.map((o) => <Tile key={o.replaces + o.apps.join()} o={o} p={p} faded />)}</ul>
      </Card>}
    </div>
  );
}

export const mountSubscriptions = (el: Element, p: SubscriptionsProps | null) => render(p && <Subscriptions {...p} />, el);
