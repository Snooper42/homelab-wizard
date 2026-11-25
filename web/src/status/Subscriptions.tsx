// Status › Subscriptions (the owner, Nov 25: "build out the subscriptions tab with pricing… within the status tab"): what
// the apps you run stand in for, each beside the paid service it replaces with its price (docs/Savings.md, the one place
// prices live), then what more the apps you don't run yet could replace. Three cards of one anatomy over them.
import { render } from 'preact';
import { AppMark } from '../parts/AppMark';
import { Card } from '../parts/Card';
import { Spark } from '../Spark';

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

function Row({ o, p, faded }: { o: Offer; p: SubscriptionsProps; faded?: boolean }) {
  const name = (id: string) => p.catalog?.apps.find((a) => a.id === id)?.name || id;
  return (
    <li class={'subrow' + (faded ? ' faded' : '')}>
      <button type="button" class="subapp" onClick={() => p.open(o.apps[0])}>
        <span class="sublogos" aria-hidden="true">{o.apps.slice(0, 2).map((id) => <AppMark key={id} id={id} name={name(id)} icon={p.icons?.[id] || ''} small />)}</span>
        <span class="subnames"><strong>{o.apps.map(name).join(' + ')}</strong><span class="muted">instead of {o.replaces}</span></span>
      </button>
      <span class={'pill ' + (o.kind === 'Direct' ? 'ok' : '')} title={o.kind === 'Direct' ? 'The same thing, at home' : 'Does the same job, its own way'}>{o.kind}</span>
      <span class="subprice"><strong>{money(o.monthly)}</strong><span class="muted"> a month</span></span>
      <span class="subprice"><strong>{money(o.annual)}</strong><span class="muted"> a year</span></span>
      {o.condition && <span class="subwhen muted">{o.condition}</span>}
    </li>
  );
}

export function Subscriptions(p: SubscriptionsProps) {
  // A service priced only by the year (no monthly plan) is a twelfth of it a month.
  const offers = (p.offers || []).filter((o) => Number.isFinite(o.annual)).map((o) => ({ ...o, monthly: Number.isFinite(o.monthly) && o.monthly > 0 ? o.monthly : o.annual / 12 })).sort((a, b) => b.annual - a.annual);
  const runs = (o: Offer) => o.apps.every((id) => p.running.has(id));
  const now = offers.filter(runs), more = offers.filter((o) => !runs(o));
  const year = now.reduce((t, o) => t + o.annual, 0), month = now.reduce((t, o) => t + o.monthly, 0);
  const could = more.reduce((t, o) => t + o.annual, 0);
  const pts = p.history.filter((x) => x.annual > 0);
  const since = pts.length > 1 ? pts[pts.length - 1].annual - pts[0].annual : 0;
  const sinceDay = pts.length > 1 ? new Date(pts[0].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  return (
    <div class="subpage">
      <div class="row header"><div><h1>Subscriptions</h1><p class="lead">What your apps stand in for, at their annual prices</p></div></div>
      <div class="anttiles">
        <Card kind="anttile" id="subYear">
          <div class="anthead"><h2>Saved a year</h2><span class="muted">{now.length} services</span></div>
          <div class="antfig">{p.offers ? money(year) : '—'}</div>
          <div class="antline muted">{since > 0 ? `+${money(since)} since ${sinceDay}` : 'From the apps running now'}</div>
          <div class="antfoot">{pts.length > 2 ? <Spark values={pts.map((x) => x.annual)} w={240} h={36} title="The yearly saving over time" /> : <span class="antempty" />}</div>
        </Card>
        <Card kind="anttile" id="subMonth">
          <div class="anthead"><h2>A month</h2><span class="muted" /></div>
          <div class="antfig">{p.offers ? money(month) : '—'}</div>
          <div class="antline muted">{now[0] ? `${now[0].replaces} the most, ${money(now[0].monthly)}` : 'Nothing replaced yet'}</div>
          <div class="antfoot">{year > 0 ? <span class="antbar" role="img" aria-label="Direct and equivalent"><span style={{ width: `${Math.round(100 * now.filter((o) => o.kind === 'Direct').reduce((t, o) => t + o.annual, 0) / year)}%` }} /></span> : <span class="antempty" />}</div>
        </Card>
        <Card kind="anttile" id="subCould">
          <div class="anthead"><h2>Could save too</h2><span class="muted">{more.length} more</span></div>
          <div class="antfig">{p.offers ? money(could) : '—'}<span class="muted"> a year</span></div>
          <div class="antline muted">{more[0] ? `${more[0].apps.map((id) => p.catalog?.apps.find((a) => a.id === id)?.name || id).join(' + ')} instead of ${more[0].replaces}` : 'Every one you could'}</div>
          <div class="antfoot"><span class="antempty" /></div>
        </Card>
      </div>
      <Card kind="subcard" id="subNow">
        <h2>Replaced now <span class="n">{now.length}</span></h2>
        {now.length ? <ul class="sublist">{now.map((o) => <Row key={o.replaces + o.apps.join()} o={o} p={p} />)}</ul> : <p class="muted">None of your apps replaces a paid service yet.</p>}
      </Card>
      {more.length > 0 && <Card kind="subcard" id="subMore">
        <h2>Could replace too <span class="n">{more.length}</span></h2>
        <ul class="sublist">{more.map((o) => <Row key={o.replaces + o.apps.join()} o={o} p={p} faded />)}</ul>
      </Card>}
    </div>
  );
}

export const mountSubscriptions = (el: Element, p: SubscriptionsProps | null) => render(p && <Subscriptions {...p} />, el);
