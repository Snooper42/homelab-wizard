import { render } from 'preact';
import { ActionLink } from '../ActionLink';

export interface FootProps {
  system: string;
  version: string;
  /** The computer in a few words ("412 GB free · plugged in") and how it is, once Setup has read it; until then, and
   *  where it can't be read, the system and version stand in. They're in its tooltip either way. */
  machine?: { words: string; tone: 'ok' | 'warn' | 'bad' } | null;
  /** ready: an update waits, its line hidden by Later; finishing: it goes in place. */
  update: '' | 'ready' | 'finishing';
  /** Shows the update line again. */
  openSetup: () => void;
}

export function Foot({ system, version, machine, update, openSetup }: FootProps) {
  const about = [system, version].filter(Boolean).join(' · ');
  return (
    <>
      {machine?.words
        ? <span class="machine" title={about || undefined}><span class={'dot ' + machine.tone} aria-hidden="true" /><span class="part">{machine.words}</span></span>
        /* Each part kept whole: a long Windows name wraps before the version, not inside it. */
        : (system || version) && <><span class="part">{system}</span> · <span class="part">{version}</span></>}
      {update && (
        <ActionLink id="footUpdate" cls="update" title={update === 'ready' ? 'Show the update' : 'The line at the top follows it'} onClick={openSetup}>
          {update === 'ready' ? '● Update ready' : '● Updating…'}
        </ActionLink>
      )}
    </>
  );
}

export function mountFoot(el: Element, props: FootProps) { render(<Foot {...props} />, el); }
