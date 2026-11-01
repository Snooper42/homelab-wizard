// Bringing a bank's file into the ledger: a CSV (any bank's columns,
// picked or guessed) or an OFX/QFX statement, read on this device, never
// sent anywhere. Plain functions: the file's text in, rows out, then the
// rows as transactions, skipping any already in the ledger.
import { isoDay, parseAmount } from './money';

/** A row of a bank's file, read: its day, amount (money in a plus), payee, and the bank's own ID when it gives one. */
export interface Imported { date: string; amount: number; payee: string; memo?: string; id?: string }

/** A CSV's text as rows of cells: commas or semicolons, quotes, and "" inside them. */
export function csvRows(text: string): string[][] {
  const first = text.split(/\r?\n/, 1)[0] || '';
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : first.includes('\t') && !first.includes(',') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows.map((r) => r.map((x) => x.trim()));
}

/** Which column holds what: indexes into a row, -1 for none. Debit and credit are a bank's two money columns. */
export interface Columns { date: number; amount: number; debit: number; credit: number; payee: number; memo: number }

/** The columns guessed from a header row's words. */
export function guessColumns(header: string[]): Columns {
  const find = (...words: string[]) => header.findIndex((h) => words.some((w) => h.toLowerCase().includes(w)));
  return {
    date: find('date', 'posted', 'day', 'datum'),
    amount: find('amount', 'value', 'betrag'),
    debit: find('debit', 'withdrawal', 'money out', 'paid out'),
    credit: find('credit', 'deposit', 'money in', 'paid in'),
    payee: find('payee', 'description', 'name', 'merchant', 'details', 'empfänger', 'beschreibung'),
    memo: find('memo', 'note', 'reference', 'category'),
  };
}

/** A day as a bank writes it: 2026-10-30, 10/30/2026 (or 30/10/2026 when dayFirst), 30.10.2026, Oct 30 2026; "" when it is none. */
export function readDay(s: string, dayFirst = false): string {
  s = s.trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})([/.-])(\d{1,2})\2(\d{2,4})/);
  if (m) {
    const year = m[4].length === 2 ? 2000 + +m[4] : +m[4];
    const [mo, d] = m[2] === '.' || dayFirst ? [+m[3], +m[1]] : [+m[1], +m[3]];
    return ymd(year, mo, d);
  }
  const t = Date.parse(s);
  return isNaN(t) ? '' : isoDay(new Date(t));
}

const ymd = (y: number, m: number, d: number) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : '');

/** Whether a file's days read as day first (a 13th or later in the first place, or dots): 30/10/2026 is. */
export function daysFirst(cells: string[]): boolean {
  return cells.some((c) => /^\d{1,2}\./.test(c) || (/^(\d{1,2})\//.exec(c) && +/^(\d{1,2})\//.exec(c)![1] > 12));
}

/** A CSV's rows (header first) as what happened, with the columns given. A row with no day or amount is left out. */
export function fromCsv(rows: string[][], col: Columns): Imported[] {
  const body = rows.slice(1);
  const dayFirst = daysFirst(body.map((r) => r[col.date] || ''));
  const money = (s: string | undefined) => { const n = parseAmount((s || '').replace(/[()]/g, (p) => (p === '(' ? '-' : ''))); return isNaN(n) ? 0 : n; };
  const out: Imported[] = [];
  for (const r of body) {
    const date = readDay(r[col.date] || '', dayFirst);
    const amount = col.amount >= 0 ? money(r[col.amount]) : money(r[col.credit]) - Math.abs(money(r[col.debit]));
    if (!date || !amount) continue;
    out.push({ date, amount: Math.round(amount * 100) / 100, payee: (r[col.payee] || '').replace(/\s+/g, ' ').trim(), memo: col.memo >= 0 ? r[col.memo] || undefined : undefined });
  }
  return out;
}

/** An OFX or QFX statement's transactions: each STMTTRN's day, amount, name (or memo), and the bank's FITID. */
export function fromOfx(text: string): Imported[] {
  const out: Imported[] = [];
  for (const block of text.split(/<STMTTRN>/i).slice(1)) {
    const tag = (name: string) => block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, 'i'))?.[1].trim() || '';
    const d = tag('DTPOSTED');
    const amount = parseFloat(tag('TRNAMT'));
    if (!/^\d{8}/.test(d) || isNaN(amount)) continue;
    out.push({ date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, amount: Math.round(amount * 100) / 100, payee: (tag('NAME') || tag('MEMO')).replace(/\s+/g, ' '), memo: tag('NAME') && tag('MEMO') ? tag('MEMO') : undefined, id: tag('FITID') || undefined });
  }
  return out;
}

/** Whether a file's text is an OFX or QFX statement rather than a CSV. */
export const isOfx = (text: string): boolean => /<OFX>|OFXHEADER/i.test(text.slice(0, 2000));

/**
 * The same transaction already in the ledger: the bank's own ID on the
 * account, or else on the account, on the day, for the amount, to the same
 * payee (or with no payee on either).
 */
export function already(t: Imported, account: string, ledger: finance.Transaction[]): boolean {
  return ledger.some((q) => (q.account === account && t.id && q.bank === t.id)
    || ((q.account === account || q.to === account) && q.date === t.date && Math.abs((q.to === account ? -q.amount : q.amount) - t.amount) < 0.005
      && (!q.payee || !t.payee || alike(q.payee, t.payee))));
}

/** The words of a payee that say who it is: three letters or more, no store numbers. */
const named = (s: string): string[] => s.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 3 && !['the', 'and', 'inc', 'llc', 'payment', 'purchase', 'card', 'debit', 'pos'].includes(w));

/** Two payees for the same: the same words, or one of them in the other ("Trader Joe's" and "TRADER JOE'S STORE 552", "Roth IRA" and "TRANSFER TO ROTH"). */
export function alike(a: string, b: string): boolean {
  const x = named(a), y = new Set(named(b));
  return a.toLowerCase() === b.toLowerCase() || x.some((w) => y.has(w));
}
