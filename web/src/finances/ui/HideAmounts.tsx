// The eye that hides every amount, or shows them again: on Finances'
// header and beside the sidebar's Accounts. ⌘⇧H (Ctrl+Shift+H) and View ›
// Hide Amounts do the same.
import { Icon } from '../../Icon';
import { osName } from '../../core';

/** The shortcut, as this system writes it. */
export const hideKeys = () => (osName === 'mac' ? '⌘⇧H' : 'Ctrl+Shift+H');

export function HideAmounts({ hidden, toggle, small }: { hidden: boolean; toggle: () => void; small?: boolean }) {
  return (
    <button type="button" class={small ? 'iconbtn fx-eye' : 'btn fx-eye'} aria-pressed={hidden} aria-label="Hide amounts"
      title={`${hidden ? 'Show amounts' : 'Hide amounts'} (${hideKeys()})`} onClick={toggle}>
      <Icon name={hidden ? 'eye-off' : 'eye'} />{!small && (hidden ? 'Show amounts' : 'Hide amounts')}
    </button>
  );
}
