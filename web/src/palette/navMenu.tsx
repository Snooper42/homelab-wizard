// A right-click on a screen in the sidebar opens its menu; each item does what that screen's own button does.
import { openContextMenu, type ContextEntry } from '../parts/ContextMenu';
import { financesData, openFinanceForm, toggleHideAmounts } from '../screens/finances';
import { navigate, reloadScreen } from '../app';
import { $, $$, onPhone } from '../core';

/** Opens screen, then runs fn once it shows. */
const on = (screen: string, fn: () => void) => () => { navigate(screen); fn(); };

/** The items for a screen's menu, as things are now. */
export function navItems(screen: string): ContextEntry[] {
  const again = { label: 'Check again', run: on(screen, () => reloadScreen()) };
  if (screen === 'status') {
    const items: ContextEntry[] = [again, '-', { label: 'Update all apps…', run: on('status', () => $('updateAll').click()), disabled: ($('updateAll') as HTMLButtonElement).disabled }];
    if (!$('fixIt').hidden) items.push({ label: 'Fix it', run: on('status', () => $('fixIt').click()) });
    items.push({ label: 'Back up now', run: on('backups', () => $('backupNow').click()), disabled: ($('backupNow') as HTMLButtonElement).disabled });
    return items;
  }
  if (screen === 'finances') {
    const v = financesData.value;
    if (!v || v.readOnly) return [again];
    const items: ContextEntry[] = [again, '-', { label: 'Add a transaction', run: on('finances', () => openFinanceForm('transaction')) }];
    if (v.plan.accounts?.length) items.push({ label: 'Update balances', run: on('finances', () => openFinanceForm('balances')) });
    items.push('-', { label: v.plan.hideAmounts ? 'Show amounts' : 'Hide amounts', run: () => toggleHideAmounts() });
    return items;
  }
  return [again];
}

/** Wires each screen's button in the sidebar to its menu. */
export function wireNavMenus() {
  $$('nav button[data-screen]').forEach((b) => {
    const screen = b.dataset.screen!, name = b.querySelector('span')?.textContent?.trim() || screen;
    const open = (x: number, y: number) => openContextMenu(name, x, y, navItems(screen));
    b.addEventListener('contextmenu', (e) => {
      if (onPhone()) return;
      e.preventDefault();
      open(e.clientX, e.clientY);
    });
    b.addEventListener('keydown', (e) => {
      if (onPhone() || !(e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey))) return;
      e.preventDefault();
      const r = b.getBoundingClientRect();
      open(r.left + 12, r.bottom + 4);
    });
  });
}
