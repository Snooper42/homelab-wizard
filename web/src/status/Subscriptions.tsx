// Status › Subscriptions (the owner, Nov 25: "build out the subscriptions tab with pricing… within the status tab"): what
// the apps you run stand in for, each beside the paid service it replaces with its price (docs/Savings.md, the one place
// prices live), then what more the apps you don't run yet could replace. Three cards of one anatomy over them.
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

/** One paid service as a tile (the owner, Nov 25: "the logo of the app that's being replaced, a nice ui with the pricing,
 * and then the logos and the apps replacing it"): its mark and name, its price a month and a year, and under them the
 * apps that stand in for it. What it takes for the saving to be real is the tile's tooltip. */
function Tile({ o, p, faded }: { o: Offer; p: SubscriptionsProps; faded?: boolean }) {
  const name = (id: string) => p.catalog?.apps.find((a) => a.id === id)?.name || id;
  const service = o.replaces.replace(/\s*\(.*\)$/, '');
  return (
    <li class={'subtile' + (faded ? ' faded' : '')} title={o.condition}>
      <div class="subsvc">
        <Mark brand={brandOf(undefined, o.replaces)} name={service} size="lg" auto />
        <span class="subsvcname"><strong>{service}</strong><span class={'pill ' + (o.kind === 'Direct' ? 'ok' : '')}>{o.kind}</span></span>
      </div>
      <div class="subcost"><span class="subbig">{money(o.monthly)}</span><span class="muted"> a month</span><span class="subyear">{money(o.annual)} a year</span></div>
      <button type="button" class="subby" onClick={() => p.open(o.apps[0])}>
        <span class="muted">{faded ? 'Could be' : 'Replaced by'}</span>
        <span class="subapps">{o.apps.map((id) => <span key={id} class="subappname"><AppMark id={id} name={name(id)} icon={p.icons?.[id] || ''} small />{name(id)}</span>)}</span>
      </button>
    </li>
  );
}

/** The paid service an offer replaces, by its name without the note in brackets: two apps that replace one service count it once. */
const serviceOf = (o: Offer) => o.replaces.replace(/\s*\(.*\)$/, '').trim().toLowerCase();
/** A Library service (Spotify, Netflix…): a saving only if you own the media, so kept apart from the total (the owner, Nov 26). */
const isLibrary = (o: Offer) => o.kind === 'Library';

/** The offers, one per paid service: the dearest row's price, with every app that can stand in for it (any one of them does). */
function perService(list: Offer[]): Offer[] {
  const out = new Map<string, Offer>();
  for (const o of list) {
    const k = serviceOf(o), had = out.get(k);
    if (!had) { out.set(k, { ...o, apps: [...o.apps] }); continue; }
    for (const id of o.apps) if (!had.apps.includes(id)) had.apps.push(id);
  }
  return [...out.values()];
}

export function Subscriptions(p: SubscriptionsProps) {
  // A service priced only by the year (no monthly plan) is a twelfth of it a month.
  const offers = (p.offers || []).filter((o) => Number.isFinite(o.annual)).map((o) => ({ ...o, monthly: Number.isFinite(o.monthly) && o.monthly > 0 ? o.monthly : o.annual / 12 })).sort((a, b) => b.annual - a.annual);
  const runs = (o: Offer) => o.apps.every((id) => p.running.has(id));
  // Each paid service once (the owner, Nov 26): replaced now by any app you run, else one you could add.
  const now = perService(offers.filter(runs));
  const replaced = new Set(now.map(serviceOf));
  const more = perService(offers.filter((o) => !runs(o) && !replaced.has(serviceOf(o))));
  const counted = now.filter((o) => !isLibrary(o)), library = now.filter(isLibrary);
  const year = counted.reduce((t, o) => t + o.annual, 0), month = counted.reduce((t, o) => t + o.monthly, 0);
  const libraryYear = library.reduce((t, o) => t + o.annual, 0);
  const could = more.filter((o) => !isLibrary(o)).reduce((t, o) => t + o.annual, 0);
  const pts = p.history.filter((x) => x.annual > 0);
  const since = pts.length > 1 ? pts[pts.length - 1].annual - pts[0].annual : 0;
  const sinceDay = pts.length > 1 ? new Date(pts[0].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  const appName = (id: string) => p.catalog?.apps.find((a) => a.id === id)?.name || id;
  // Where the saving comes from: each kind of app's share of the year, largest first, in its category's colour.
  const cats = p.catalog?.categories || [];
  const byCat = new Map<string, number>();
  for (const o of counted) { const c = p.catalog?.apps.find((a) => a.id === o.apps[0])?.category || 'other'; byCat.set(c, (byCat.get(c) || 0) + o.annual); }
  const parts = [...byCat.entries()].sort((x, y) => y[1] - x[1]).map(([id, n], i) => ({ id, label: cats.find((c) => c.id === id)?.label || 'Your own', n, tone: `var(--cat-${(i % 8) + 1})` }));
  return (
    <div class="subpage">
      <div class="row header"><div><h1>Subscriptions</h1><p class="lead">{p.offers ? `${money(year)} a year, ${money(month)} a month, instead of ${counted.length} subscriptions` : 'Reading the prices…'}</p>
        {libraryYear > 0 && <p class="muted sublibrary">{`+ ${money(libraryYear)} a year more if you own the media (${library.length} like ${library[0].replaces.replace(/\s*\(.*\)$/, '')})`}</p>}</div></div>
      <div class="subtop">
        <Card kind="subcard" id="subWhere">
          <div class="anthead"><h2>Where it comes from</h2><span class="muted">{since > 0 ? `+${money(since)} since ${sinceDay}` : ''}</span></div>
          {year > 0 ? <>
            <div class="subbar" role="img" aria-label={parts.map((x) => `${x.label} ${money(x.n)}`).join(', ')}>{parts.map((x) => <span key={x.id} style={{ width: `${(100 * x.n) / year}%`, background: x.tone }} />)}</div>
            <ul class="sublegend">{parts.map((x) => <li key={x.id}><i style={{ background: x.tone }} />{x.label}<strong>{money(x.n)}</strong></li>)}</ul>
          </> : <p class="muted">None of your apps replaces a paid service yet.</p>}
        </Card>
        <Card kind="subcard" id="subCould">
          <div class="anthead"><h2>Could save {money(could)} more</h2><span class="muted">a year</span></div>
          <ul class="subnext">{more.filter((o) => !isLibrary(o)).slice(0, 3).map((o) => (
            <li key={o.replaces + o.apps.join()}><button type="button" class="subapp" onClick={() => p.open(o.apps[0])}>
              <span class="sublogos" aria-hidden="true"><AppMark id={o.apps[0]} name={appName(o.apps[0])} icon={p.icons?.[o.apps[0]] || ''} small /></span>
              <span class="subnames"><strong>{o.apps.map(appName).join(' + ')}</strong><span class="muted">instead of {o.replaces}</span></span>
              <span class="subprice"><strong>{money(o.annual)}</strong></span>
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
