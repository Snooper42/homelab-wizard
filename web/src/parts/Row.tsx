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
  onOpen?: (e: MouseEvent) => void;
  openLabel?: string;
  /** With onOpen, the row is a toggle and this whether it is on (picked, in a list being picked from). */
  pressed?: boolean;
}

export function Row({ dot, lead, title, sub, subTone, children, end, when, whenTitle, whenPlain, onOpen, openLabel, pressed }: RowProps) {
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
  return <li class={'opens' + (pressed ? ' on' : '')}><button type="button" class="rowopen" aria-pressed={pressed} onClick={onOpen}>{body}{openLabel && <span class="sr">, {openLabel}</span>}</button></li>;
}
