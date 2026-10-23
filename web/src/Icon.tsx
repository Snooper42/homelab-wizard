import { icons } from './icons';

/** A Feather icon from icons.ts. */
export function Icon({ name }: { name: string }) {
  // Constant markup from the table, never page data.
  return <svg class="icon" viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: icons[name] }} />;
}
