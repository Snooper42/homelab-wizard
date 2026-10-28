// A segmented control: one choice of a few, as a row of buttons with the
// chosen one raised. Settings › Appearance's choices are drawn with it.
import type { ComponentChildren } from 'preact';

export interface SegmentedProps {
  /** Its name, read out with the choices. */
  label: string;
  value: string;
  /** Each choice: its value and its words. */
  options: [string, ComponentChildren][];
  pick: (value: string) => void;
}

export function Segmented({ label, value, options, pick }: SegmentedProps) {
  return (
    <div class="seg" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} class={value === v ? 'on' : ''} onClick={() => pick(v)}>{text}</button>
      ))}
    </div>
  );
}
