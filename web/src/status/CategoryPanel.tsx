import { render } from 'preact';
import { AppMark } from '../parts/AppMark';
import { Card } from '../parts/Card';
import { Icon } from '../Icon';

export interface PanelRow { id: string; label: string; apps: api.AppStatus[]; stopped: string[];
  /** What its line says in place of its apps' names while none stopped (Media automation's, arr item 8). */
  summary?: string }

/** How many letters two names may have together and still fit on a row beside the logos, on a phone too (the iPhone's StatusCategory.line). */
const lineFits = 18;

export function CategoryPanel({ rows, icons, open }: { rows: PanelRow[]; icons?: Record<string, string>; open: (id: string) => void }) {
  if (!rows.length) return null;
  return (
    <Card kind="ovpanel" id="statusPanelCard">
      <ul class="ovrows">
        {rows.map((r) => {
          const running = r.apps.filter((a) => a.state === 'running').length;
          const names = r.apps.map((a) => a.name);
          // A stopped app named first, then the others: two while they fit on the row, else one, and a count.
          const lead = r.stopped.length ? [`${r.stopped.join(', ')} stopped`, ...names.filter((n) => !r.stopped.includes(n))] : names;
          const shown = lead.length > 1 && lead[0].length + lead[1].length <= lineFits ? 2 : 1;
          const line = !r.stopped.length && r.summary ? r.summary : lead.slice(0, shown).join(r.stopped.length ? ' · ' : ', ') + (lead.length > shown ? ` +${lead.length - shown}` : '');
          const warn = r.stopped.length > 0;
          return (
            <li key={r.id}>
              <button type="button" class="ovrow" data-key={r.id} title={names.join(', ')} onClick={() => open(r.id)}>
                <span class="ovlogos" aria-hidden="true">{r.apps.slice(0, 3).map((a) => <AppMark key={a.id} id={a.id} name={a.name} icon={icons?.[a.id] || ''} small />)}</span>
                <span class="ovname"><strong>{r.label}</strong><span class="muted">{line}</span></span>
                <span class={'pill ' + (warn ? 'warn' : 'ok')}>{warn ? `${running} of ${r.apps.length}` : <><Icon name="check" />{running}</>}<span class="pillword"> running</span></span>
                <Icon name="chevron" />
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export const mountCategoryPanel = (el: Element, p: { rows: PanelRow[]; icons?: Record<string, string>; open: (id: string) => void } | null) => render(p && <CategoryPanel {...p} />, el);
