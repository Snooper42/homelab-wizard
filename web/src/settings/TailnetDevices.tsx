// Settings › Phones › Devices on your tailnet: every phone and computer on
// the household's tailnet (Tailscale's own status), when each was last
// seen, and Remove for a lost or sold one. Removing is done in Tailscale's
// admin console (no device can remove another), so Remove opens it there.
import { render } from 'preact';
import { ago, never } from '../format';
import { CardHead } from '../parts/Card';
import { Row, Rows } from '../parts/Row';

/** A month unseen: a device that may be lost, or sold, or put away. */
const awayFor = 30 * 864e5;
const away = (d: tailnet.Device) => !d.online && !never(d.lastSeen) && Date.now() - new Date(d.lastSeen!).getTime() > awayFor;

/** Tailscale's names for each system, as people say them. */
const systems: Record<string, string> = { iOS: 'iPhone or iPad', macOS: 'Mac', android: 'Android', windows: 'Windows', linux: 'Linux' };

export function TailnetDevices({ devices, open }: { devices: tailnet.Device[]; open: (url: string) => void }) {
  const online = devices.filter((d) => d.online).length;
  return (
    <>
      <CardHead title="Devices on your tailnet"><span class="muted">{devices.length === 1 ? '1 device' : `${devices.length} devices`}, {online} online</span></CardHead>
      <p class="muted">Each of these can open the apps away from home. One that is lost or sold: Remove it, and it can no longer reach them.</p>
      <Rows>
        {devices.map((d) => (
          <Row key={d.ip || d.name} dot={d.online ? 'ok' : away(d) ? 'warn' : ''} title={d.name}
            sub={[systems[d.os || ''] || d.os, d.self ? 'this machine' : d.online ? 'online now' : never(d.lastSeen) ? 'not seen yet' : `last seen ${ago(d.lastSeen)}`].filter(Boolean).join(' · ')
              + (away(d) ? '. Not seen for a month: if it is lost, remove it' : '')}
            subTone={away(d) ? 'warn' : undefined}
            end={!d.self && <button class="small" aria-label={`Remove ${d.name}`} title="Opens it in Tailscale's admin console, where Remove is" onClick={() => open(d.admin || '')}>Remove…</button>} />
        ))}
      </Rows>
    </>
  );
}

export const mountTailnetDevices = (el: Element, props: { devices: tailnet.Device[]; open: (url: string) => void }) => render(<TailnetDevices {...props} />, el);
