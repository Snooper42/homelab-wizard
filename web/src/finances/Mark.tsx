// What stands before an account or payment: its brand's mark in the
// brand's colour (logos.ts), or its initials there for a brand with no mark
// we may use, else an icon for its kind, else its first
// letter. And a person's initial, in their colour. A brand's mark is
// .fmark.logo, not .brand: that is the sidebar's name, margins and all.
import { brands } from './logos';

/** Feather-style icons for kinds of accounts and payments (24 by 24 strokes). */
const kindIcons: Record<string, string> = {
  checking: 'M3 21h18M5 21V10l7-6 7 6v11M9 21v-6h6v6',
  savings: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  card: 'M2 6h20v12H2zM2 10h20M6 15h4',
  cards: 'M2 6h20v12H2zM2 10h20M6 15h4',
  investment: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  retirement: 'M6 2h12M6 22h12M7 2c0 6 10 6 10 10S7 16 7 22M17 2c0 6-10 6-10 10s10 4 10 10',
  loan: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  loans: 'M22 9 12 4 2 9l10 5 10-5zM6 11v5c3 2 9 2 12 0v-5',
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  car: 'M5 17H3v-5l2.5-5h13l2.5 5v5h-2M7 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0M13 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0M3 12h18',
  utilities: 'M13 2 4 14h7l-1 8 9-12h-7z',
  subscriptions: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
  spending: 'M3 3h2l2.5 12h11L21 7H6.5M9 20h.01M18 20h.01',
  collectible: 'M6 3h12l4 6-10 12L2 9zM11 3 8 9l4 12 4-12-3-6M2 9h20',
  other: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  minus: 'M5 12h14',
};

export interface MarkProps {
  /** The brand (logos.ts), when it has one. */
  brand?: string;
  /** The account's or payment's kind, for its icon. */
  kind?: string;
  /** Its name: the first letter when there is no brand or icon. */
  name: string;
  size?: 'sm' | 'lg';
}

export function Mark({ brand, kind, name, size }: MarkProps) {
  const b = brand ? brands[brand] : undefined;
  const cls = 'fmark' + (size ? ' ' + size : '');
  if (b?.letters) return <span class={cls + ' logo mono' + (b.letters.length > 1 ? ' two' : '')} style={{ background: b.bg, color: b.ink }} aria-hidden="true">{b.letters}</span>;
  if (b) {
    return (
      <span class={cls + ' logo'} style={{ background: b.bg, color: b.ink }} aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d={b.path!} fill="currentColor" /></svg>
      </span>
    );
  }
  const icon = kind && kindIcons[kind];
  if (icon) return <span class={cls + ' icon'} aria-hidden="true"><svg viewBox="0 0 24 24"><path d={icon} /></svg></span>;
  return <span class={cls + ' letter'} aria-hidden="true">{(name || '?').trim().charAt(0).toUpperCase()}</span>;
}

/** A person's initial in their colour (person-0 … person-3 in style.css); two overlap. */
export function Who({ name, n, size }: { name: string; n: number; size?: 'sm' | 'lg' }) {
  return <span class={`fwho p${n}` + (size ? ' ' + size : '')} aria-hidden="true">{(name || '?').charAt(0).toUpperCase()}</span>;
}

/**
 * The brands for a kind of account's picker, by name: those that fit it
 * (banks for checking, brokers for retirement, makes for a car), then every
 * other bank, broker, and card, for checking at a broker or a card from a
 * bank. A car's and a home's are only their own.
 */
export function brandsFor(kind: string): string[] {
  const want = { checking: ['bank'], savings: ['bank'], card: ['card', 'bank'], investment: ['investment'], retirement: ['investment'], loan: ['bank', 'car'], car: ['car'], home: ['home'] }[kind];
  const byName = (list: string[]) => list.sort((a, b) => brands[a].name.localeCompare(brands[b].name));
  const fits = byName(Object.keys(brands).filter((k) => (want ? want.includes(brands[k].kind) : !brands[k].kind || brands[k].kind === 'card')));
  if (!want || kind === 'car' || kind === 'home') return fits;
  return [...fits, ...byName(Object.keys(brands).filter((k) => ['bank', 'investment', 'card'].includes(brands[k].kind) && !fits.includes(k)))];
}

/** Every brand, for a payment's picker: bills first, then the rest. */
export const allBrands = (): string[] => Object.keys(brands).sort((a, b) => (brands[a].kind ? 1 : 0) - (brands[b].kind ? 1 : 0) || brands[a].name.localeCompare(brands[b].name));

export const brandName = (k: string): string => brands[k]?.name || k;
