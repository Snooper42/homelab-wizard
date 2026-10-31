// A list of rows: one thing per row, with a dot for how it is, what it is,
// a line under it, and what goes at the end (a badge, a size, a button,
// when). Status's cards, Backups' jobs, Settings' people and phones, and
// Setup's jobs and changes are all drawn with it.
import type { ComponentChildren } from 'preact';

/** How a row is: well, needs a look, failing, or nothing to say. */
export type Tone = 'ok' | 'warn' | 'bad' | '';

/** The rows; kind adds a look of its own (usage: bars, week: the digest). */
export function Rows({ kind, children }: { kind?: string; children: ComponentChildren }) {
  return <ul class={'alertlist' + (kind ? ' ' + kind : '')}>{children}</ul>;
}

export interface RowProps {
  /** The dot before it, in its tone; none when left out. */
  dot?: Tone;
  /** Before the title in place of a dot: a logo, a person's initial. */
  lead?: ComponentChildren;
  /** What it is, in bold. */
  title?: ComponentChildren;
  /** The line under the title, in grey (or in tone). */
  sub?: ComponentChildren;
  subTone?: Tone;
  /** More under the title: a bar, or plain words instead of a title. */
  children?: ComponentChildren;
  /** At the end, before when: badges, sizes, buttons. */
  end?: ComponentChildren;
  /** When it happened (or the number it comes to), last. */
  when?: ComponentChildren;
  whenTitle?: string;
  /** when in the text's own colour rather than grey. */
  whenPlain?: boolean;
  /**
   * Opens what the row is (its form, its page): the whole row is then one
   * button, so it takes no Edit of its own. Only with nothing else to press
   * in it (end holds words and figures, no buttons).
   */
  onOpen?: () => void;
  /** What a screen reader hears for the row's button, when its text is not enough ("Edit Netflix"). */
  openLabel?: string;
}

export function Row({ dot, lead, title, sub, subTone, children, end, when, whenTitle, whenPlain, onOpen, openLabel }: RowProps) {
  // Inside a button only phrasing content may go: the same layout, in spans.
  const Box = onOpen ? 'span' : 'div';
  const body = <>
    {dot !== undefined && <span class={'dot ' + dot} />}
    {lead}
    <Box class="grow">
      {title !== undefined && <strong>{title}</strong>}
      {!!sub && <Box class={(subTone || 'muted') + (onOpen ? ' line' : '')}>{sub}</Box>}
      {children}
    </Box>
    {end}
    {when !== undefined && <span class={whenPlain ? 'when' : 'when muted'} title={whenTitle}>{when}</span>}
  </>;
  if (!onOpen) return <li>{body}</li>;
  return <li class="opens"><button type="button" class="rowopen" aria-label={openLabel} onClick={onOpen}>{body}</button></li>;
}
