// The two numbers the household checks against its own sums: checking now,
// and checking once the next paycheck lands. Resting on either, Tab to it,
// or a tap on a phone shows how it was reached, row by row: the balance it
// starts from, each thing in and out, and the result (finance.Working, the
// projection's own steps, so it is always the sum the app did).
import type { ComponentChildren } from 'preact';
import { Amount, Stat } from '../ui/Amount';
import { Widget } from '../ui/Widget';
import { useHoverCard } from '../../parts/Hover';
import { dayLong, dayShort, type Lookup } from '../money';

const names = (ids: string[], L: Lookup) => ids.map((id) => L.person[id]?.name || id).join(' and ');

/** What one step was, in the words its row uses elsewhere. */
function stepName(s: finance.Step, L: Lookup): string {
  if (s.people?.length) return `${names(s.people, L)}'s paycheck`;
  if (s.payment) return L.payment[s.payment]?.name || s.payment;
  if (s.interest) return 'Interest';
  return s.name || 'A transaction';
}

/** The working: where it starts, each step with checking after it, and where it ends. */
function Working({ w, L, start, end, note }: { w: finance.Working; L: Lookup; start: string; end: string; note?: string }) {
  return (
    <span class="fx-working">
      <span class="fx-workrow fx-workhead"><span>{start}</span><Amount value={w.start} form="full" /></span>
      {w.steps.map((s, i) => (
        <span key={i} class="fx-workrow">
          <span><span class="fx-sub">{dayShort(s.date)}</span> {stepName(s, L)}{s.transaction && <span class="fx-sub"> (in Transactions)</span>}</span>
          <Amount value={s.amount} sign tone={s.amount > 0 ? 'in' : ''} form="full" />
          <span class="fx-sub fx-workafter"><Amount value={s.after} form="full" /></span>
        </span>
      ))}
      {!w.steps.length && <span class="fx-workrow fx-sub"><span>Nothing in or out in between</span></span>}
      <span class="fx-workrow fx-workhead fx-workend"><span>{end}</span><Amount value={w.result} form="full" tone={w.result < 0 ? 'out' : ''} /></span>
      {note && <span class="fx-sub fx-worknote">{note}</span>}
    </span>
  );
}

/** One figure: a button, so a tap or Tab shows its working, the card beside it. */
function Figure({ value, caption, tip, id }: { value: number; caption: string; tip: ComponentChildren; id: string }) {
  const { on, card, show } = useHoverCard<HTMLButtonElement>(tip, { wide: true });
  return (
    <div class="fx-clearfig">
      <button type="button" class="fx-clearbtn" id={id} {...on} onClick={() => show(true)}>
        <Stat size="lg" value={<Amount value={value} tone={value < 0 ? 'out' : ''} />} caption={caption} />
        <span class="fx-sub fx-clearhow">How it adds up</span>
      </button>
      {card}
    </div>
  );
}

export function NowWidget({ v, L }: { v: finance.View; L: Lookup }) {
  const now = v.checkingNow, pay = v.afterPay;
  if (!now) return null;
  const typedToday = now.from === now.date;
  const who = pay && v.periods.find((p) => p.pay?.date === pay.date)?.pay;
  const whose = who ? names(who.people, L) : '';
  // Payments due on payday come out of that paycheck, after it is in.
  const sameDay = pay ? v.periods.find((p) => p.pay?.date === pay.date)?.rows.filter((r) => r.date === pay.date && !r.outside && !r.into).length || 0 : 0;
  return (
    <Widget title="Checking" span="all" kind="fx-clear">
      <div class="fx-clearrow">
        <Figure id="finNow" value={now.result} caption={typedToday ? 'Now, as typed in today' : `Now, typed in ${dayShort(now.from)}`}
          tip={<Working w={now} L={L} start={`Checking, typed in ${dayLong(now.from)}`} end="Checking now" />} />
        {pay && <Figure id="finAfterPay" value={pay.result} caption={`After ${whose ? whose + "'s" : 'the next'} paycheck, ${dayShort(pay.date)}`}
          tip={<Working w={pay} L={L} start="Checking now" end={`Once the paycheck is in, ${dayLong(pay.date)}`}
            note={sameDay ? `${sameDay === 1 ? 'One payment' : `${sameDay} payments`} due ${dayShort(pay.date)} come${sameDay === 1 ? 's' : ''} out of this paycheck after it lands, so ${sameDay === 1 ? 'it is' : 'they are'} not in this number.` : undefined} />} />}
      </div>
    </Widget>
  );
}
