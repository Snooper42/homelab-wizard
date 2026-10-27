// The sidebar's foot: this system and the app's version, each kept whole,
// and a link to Setup while an update waits or is being finished.
import { render } from 'preact';
import { ActionLink } from '../ActionLink';

export interface FootProps {
  system: string;
  version: string;
  /** ready: an update waits; finishing: the new app's homelab files are being put in place. */
  update: '' | 'ready' | 'finishing';
  openSetup: () => void;
}

export function Foot({ system, version, update, openSetup }: FootProps) {
  return (
    <>
      {/* Each part kept whole: a long Windows name wraps before the version, not inside it. */}
      {(system || version) && <><span class="part">{system}</span> · <span class="part">{version}</span></>}
      {update && (
        <ActionLink id="footUpdate" cls="update" title={update === 'ready' ? 'Open Setup to update' : 'Open Setup to follow it'} onClick={openSetup}>
          {update === 'ready' ? '● Update ready' : '● Finishing the update…'}
        </ActionLink>
      )}
    </>
  );
}

export function mountFoot(el: Element, props: FootProps) { render(<Foot {...props} />, el); }
