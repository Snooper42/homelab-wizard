// The sidebar's foot: this system and the app's version, each kept whole,
// and a link to the update line while an update waits (after Later) or
// goes in place.
import { render } from 'preact';
import { ActionLink } from '../ActionLink';

export interface FootProps {
  system: string;
  version: string;
  /** ready: an update waits, its line hidden by Later; finishing: it goes in place. */
  update: '' | 'ready' | 'finishing';
  /** Shows the update line again. */
  openSetup: () => void;
}

export function Foot({ system, version, update, openSetup }: FootProps) {
  return (
    <>
      {/* Each part kept whole: a long Windows name wraps before the version, not inside it. */}
      {(system || version) && <><span class="part">{system}</span> · <span class="part">{version}</span></>}
      {update && (
        <ActionLink id="footUpdate" cls="update" title={update === 'ready' ? 'Show the update' : 'The line at the top follows it'} onClick={openSetup}>
          {update === 'ready' ? '● Update ready' : '● Updating…'}
        </ActionLink>
      )}
    </>
  );
}

export function mountFoot(el: Element, props: FootProps) { render(<Foot {...props} />, el); }
