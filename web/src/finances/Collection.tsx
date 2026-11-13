// The Collection (the owner, Nov 12: "a mini Collectr" for their Pokémon
// cards; the mockup a yes, Nov 13), under Net worth: what the cards are
// worth now with the gain on what was paid and a chart of it over time,
// then each card with its picture, what one cost, what it is worth and its
// gain; a card opens its own page, large. The cards are kept in a
// collectible account worth what they are (internal/finance/collection.go),
// so Net worth counts them. A picture is the computer's own file; until a
// card has one it shows a plain placeholder, never one fetched.
import { Empty } from '../parts/Empty';
import { Row, Rows } from '../parts/Row';
import { Amount, Stat } from './ui/Amount';
import { AreaChart } from './ui/charts';
import { Widget } from './ui/Widget';
import { worthOn } from './model';
import { compact, dayShort, money } from './money';

/** One card's worth now: its price, as many times as it is kept. */
export const cardWorth = (c: finance.Collected) => (c.price || 0) * Math.max(1, c.count || 1);
/** What one card cost in all, when what one cost is typed in. */
const cardPaid = (c: finance.Collected) => (c.paid || 0) * Math.max(1, c.count || 1);
/** Its printing, condition and how many, as one line: "Set A · 4/102 · Near mint · ×2". */
const cardLine = (c: finance.Collected) => [c.set, c.number, c.grade, (c.count || 1) > 1 ? `×${c.count}` : ''].filter(Boolean).join(' · ') || 'A card';

/** The card's picture: its own, once the computer has saved one; until then a plain placeholder. */
export function CardPicture({ c, large }: { c: finance.Collected; large?: boolean }) {
  return (
    <span class={'fx-cardpic' + (large ? ' lg' : '')} role="img" aria-label={`${c.name}: no picture yet`}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="11" r="3.5" /></svg>
      {large && <span>No picture yet</span>}
    </span>
  );
}

/** The gain on what was paid, when anything was: "+$137.40 (+305%)". */
function Gain({ worth, paid }: { worth: number; paid: number }) {
  if (!(paid > 0.005)) return null;
  const pct = Math.round(((worth - paid) / paid) * 100);
  return <span class="fx-cardgain"><Amount value={worth - paid} sign tone="auto" form="full" /> <span class={pct < 0 ? 'fx-out' : pct > 0 ? 'fx-in' : ''}>({pct > 0 ? '+' : ''}{pct}%)</span></span>;
}

export interface CollectionProps {
  v: finance.View;
  /** A card's own page. */
  open: (id: string) => void;
  /** Add a card, or change one; none on a phone allowed only to look. */
  edit?: (id?: string) => void;
}

export function CollectionPage({ v, open, edit }: CollectionProps) {
  const cards = v.plan.collection || [];
  const held = (v.plan.accounts || []).filter((a) => cards.some((c) => c.account === a.id));
  const worth = cards.reduce((t, c) => t + cardWorth(c), 0);
  const paid = cards.reduce((t, c) => t + cardPaid(c), 0);
  const latest = cards.map((c) => c.priceOn || '').sort().at(-1);
  // What the accounts the cards are kept in were worth on each day one was set, oldest first.
  const days = [...new Set(held.flatMap((a) => (a.history || []).map((p) => p.date)))].sort();
  const values = days.map((d) => held.reduce((t, a) => t + worthOn(v, a, d), 0));
  return (
    <div class="fin">
      <div class="fx-board">
        <Widget title={<>Collection{cards.length ? <span class="fx-sub"> {cards.length === 1 ? '1 card' : `${cards.length} cards`}{latest ? `, prices from ${dayShort(latest)}` : ''}</span> : null}</>} span="all" kind="fx-collection"
          actions={edit && <button type="button" class="small" onClick={() => edit()}>Add a card</button>}>
          {cards.length ? <>
            <Stat size="lg" value={<Amount value={worth} />} caption="Worth now, counted in your net worth"
              aside={paid > 0.005 ? <div class="fx-right"><Gain worth={cards.filter((c) => c.paid).reduce((t, c) => t + cardWorth(c), 0)} paid={paid} /><div class="fx-sub">on the {money(paid)} you paid</div></div> : undefined} />
            {values.length > 1 && <AreaChart values={values} xLabels={[0, values.length - 1].map((i) => ({ i, label: i === values.length - 1 ? 'Today' : dayShort(days[i]) }))} zero={false} height={160} format={compact}
              label={`The collection's worth on each day a price was set, from ${dayShort(days[0])}: ${money(values[values.length - 1])} now`}
              tip={(i) => <><strong>{dayShort(days[i])}</strong><br />{money(values[i])}</>} />}
          </> : <Empty>{edit ? 'No cards yet: add one with what it says on it, what you paid and what it is worth now. Your cards are kept in their own account, so they count in your net worth.' : 'No cards yet.'}</Empty>}
        </Widget>
        {!!cards.length && <Widget title="Cards" span="all" kind="fx-cards">
          <Rows kind="fx-rows">
            {cards.map((c) => (
              <Row key={c.id} lead={<CardPicture c={c} />} title={c.name} sub={cardLine(c)}
                end={c.paid ? <span class="fx-cardpaid muted">paid {money(cardPaid(c))}</span> : undefined}
                when={<span class="fx-cardworth"><Amount value={cardWorth(c)} form="full" /><Gain worth={cardWorth(c)} paid={cardPaid(c)} /></span>} whenPlain
                onOpen={() => open(c.id)} openLabel="its page" />
            ))}
          </Rows>
          <p class="fx-sub">Each card is worth the price set for it{edit ? ': change one on its page' : ''}.</p>
        </Widget>}
      </div>
    </div>
  );
}

export interface CardPageProps {
  v: finance.View;
  id: string;
  /** Back to the Collection. */
  done: () => void;
  /** Its form; none on a phone allowed only to look. */
  edit?: () => void;
}

/** A card opened large: its picture, what it is worth and its gain, what it cost and when, and where it is counted. */
export function CardPage({ v, id, done, edit }: CardPageProps) {
  const c = (v.plan.collection || []).find((x) => x.id === id);
  if (!c) return <Empty>This card isn't in the collection any more. <button class="small" onClick={done}>Collection</button></Empty>;
  const account = (v.plan.accounts || []).find((a) => a.id === c.account);
  return (
    <div class="fin fx-card">
      <div class="fx-accthead">
        <button type="button" class="link" onClick={done}>‹ Collection</button>
      </div>
      <div class="fx-cardpage">
        <div class="fx-cardside">
          <CardPicture c={c} large />
          {edit && <span class="actions"><button class="btn" onClick={edit}>Edit</button></span>}
        </div>
        <div class="fx-cardmain">
          <div><h2>{c.name}</h2><p class="muted">{cardLine(c)}</p></div>
          <div class="fx-board">
            <Widget title="Worth now" span="all" kind="fx-cardnow">
              <Stat size="lg" value={<Amount value={cardWorth(c)} />} caption={c.priceOn ? `${c.typed ? 'Your own price' : 'Its price'}, set ${dayShort(c.priceOn)}` : 'No price set yet'}
                aside={c.paid ? <div class="fx-right"><Gain worth={cardWorth(c)} paid={cardPaid(c)} /><div class="fx-sub">You paid {money(cardPaid(c))}</div></div> : undefined} />
            </Widget>
            <Widget title="About it" span="all" kind="fx-cardabout">
              <Rows kind="fx-rows">
                <Row title="How many" when={String(c.count || 1)} whenPlain />
                <Row title="Paid" when={c.paid ? `${money(c.paid)} each${c.paidOn ? `, ${dayShort(c.paidOn)}` : ''}` : 'Not typed in'} whenPlain />
                <Row title="Its price" when={c.typed ? 'Your own: never looked up' : 'Typed in for now'} whenPlain />
                <Row title="Counted in" when={account ? `Net worth, ${account.name}` : 'Net worth'} whenPlain />
              </Rows>
            </Widget>
          </div>
        </div>
      </div>
    </div>
  );
}
