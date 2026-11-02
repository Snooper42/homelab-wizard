// The money card on a wall screen's Status (kiosk mode), when Settings ›
// Phones lets that screen have it: the next payday and who is paid, what
// checking holds once its bills are paid, and the next 3 bills. The screen
// is sent only these (finance.WallCard), and no amount at all while Hide
// amounts is on: then each says $•••.
import { render } from 'preact';
import { Card } from '../parts/Card';
import { Mark, brandOf } from '../finances/Mark';
import { dayLong, money, setCurrency, setHidden } from '../finances/money';

export function WallCard({ w }: { w: finance.Wall }) {
  setCurrency(w.currency);
  setHidden(!!w.hidden);
  const who = (w.who || []).filter(Boolean).join(' and ');
  return (
    <Card kind="wallcard" id="wallCardBox">
      <div class="wallfacts">
        <div><div class="wallcaption">Next payday</div><div class="wallbig">{w.payday ? dayLong(w.payday) : 'None ahead'}</div>{who && <div class="muted">{who}</div>}</div>
        {w.payday && <div><div class="wallcaption">Left after its bills</div><div class="wallbig">{money(w.left)}</div></div>}
      </div>
      {w.bills.length > 0 && (
        <ul class="wallbills" aria-label="The next bills">
          {w.bills.map((b) => (
            <li key={b.date + b.name}>
              <Mark brand={brandOf(b.institution, b.name)} name={b.name} size="sm" />
              <span class="wallbill">{b.name}<span class="muted">{dayLong(b.date)}</span></span>
              <span class="wallamount">{money(b.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Draws the card into el, or nothing (null). */
export function mountWallCard(el: Element, w: finance.Wall | null) { render(w ? <WallCard w={w} /> : null, el); }
