// A widget: one card of the Finances grid, with its title, the small
// icon buttons beside it, and what it shows. It is a Card (parts/Card), so
// it reads as one with the other screens; how wide it is in the grid is
// its span, never the screen's business.
import type { ComponentChildren } from 'preact';
import { Card, CardHead } from '../../parts/Card';

export interface WidgetProps {
  title: ComponentChildren;
  /** For aria-labelledby and links to it. */
  id?: string;
  /** Icon buttons and links at the end of the heading (IconLink, IconButton). */
  actions?: ComponentChildren;
  /** Columns it takes in the grid: 1, 2, or the whole row. */
  span?: 1 | 2 | 'all';
  /** A look of its own (style.css), beside fx-widget. */
  kind?: string;
  children?: ComponentChildren;
}

export function Widget({ title, id, actions, span = 1, kind, children }: WidgetProps) {
  return (
    <Card id={id} kind={'fx-widget' + (span === 1 ? '' : span === 2 ? ' span2' : ' spanall') + (kind ? ' ' + kind : '')}>
      <CardHead title={title}>{actions ? <span class="fx-actions">{actions}</span> : undefined}</CardHead>
      {children}
    </Card>
  );
}

const icons = {
  open: 'M7 17 17 7M8 7h9v9',
  info: 'M12 16v-4M12 8h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  prev: 'M15 18l-6-6 6-6',
  next: 'M9 18l6-6-6-6',
};

/** A small icon button in a widget's heading; its label is what a screen reader says. */
export function IconButton({ icon, label, onClick, pressed, disabled }: { icon: keyof typeof icons; label: string; onClick: () => void; pressed?: boolean; disabled?: boolean }) {
  return <button type="button" class="fx-icon" aria-label={label} title={label} aria-pressed={pressed} disabled={disabled} onClick={onClick}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={icons[icon]} /></svg></button>;
}
