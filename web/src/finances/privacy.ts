// A household member's private Finances on her phone's page
// (private-finances.md 3.2 to 3.4). Once she turns privacy on, the computer
// keeps only her sealed envelope and refuses the plain Finances calls; this
// page then answers them itself, in front of the same screens: the plan and
// ledger opened here (seal.ts), read forward with the computer's own Go
// built for the page (finance.wasm, cmd/financewasm), and saved sealed
// again. The opened key and her plain Finances live in this page's memory
// only, never in its storage, and go when it locks: the page hidden, another
// screen picked, or 5 minutes without a touch.
//
// The one limit, said where she turns it on: the computer serves this page,
// so her Finances stay private while the page is the homelab's own; the
// Homelab app on her iPhone doesn't have that limit.
import { go, onPhone } from '../core';
import { todayISO } from './money';
import * as seal from './seal';
import type { Bytes, Envelope, Private } from './seal';

/** Where her Finances are: not a member's phone (or not known yet), plain, sealed and locked, or opened here. */
export type State = 'none' | 'plain' | 'locked' | 'open';

interface PhoneMe { person?: string; personName?: string; finances?: string }
declare global {
  interface Window {
    /** companion.js's /api/me answer, once read: whose phone this is. */
    phoneMe?: Promise<PhoneMe>;
    /** finance.wasm's projection (cmd/financewasm). */
    homelabFinance?: { project(plan: string, ledger: string, today: string): { view?: string; error?: string } };
    /** companion.js: loads finance.wasm (and the Go runner it needs), once. */
    phoneProjection?: () => Promise<void>;
  }
}

// The calls the page answers itself once her Finances are sealed.
const PLAIN = new Set(['Finances', 'SaveFinances', 'FinancesLedger', 'SaveFinancesLedger', 'FinancesReceipt', 'SaveFinancesReceipt']);
const LOCK_AFTER = 5 * 60000;

let state: State = 'none';
let known: Promise<void> | null = null;
let me: PhoneMe = {};
let envelope: Envelope | null = null;
let key: CryptoKey | null = null;
let data: Private | null = null;
let real: Backend;
const watchers: (() => void)[] = [];
const tell = () => watchers.forEach((fn) => fn());

/** Calls fn whenever her Finances lock, open, or turn private. */
export const watchPrivate = (fn: () => void) => { watchers.push(fn); };
export const privateState = () => state;
/** Whether her envelope opens by a passkey (else by a passphrase), besides the code. */
export const byPasskey = () => !!envelope?.kdf.passkey;
/** Whether this phone may change her Finances (Settings › Phones on the computer). */
export const mayChange = () => me.finances === 'edit';

/** A call refused while her private Finances are locked. */
export class Locked extends Error {
  constructor() {
    super('Your Finances are private: unlock them to see them.');
    this.name = 'Locked';
  }
}
export const isLocked = (e: unknown) => (e as Error | null)?.name === 'Locked';

const sealedCalls = () => real as Required<Pick<Backend, 'FinancesSealed' | 'SaveFinancesSealed' | 'FinancesSealedReceipt' | 'SaveFinancesSealedReceipt'>>;

/** Finds out, once, whether this is a member's phone and whether her Finances are sealed. */
function find(): Promise<void> {
  return (known ??= (async () => {
    me = (await window.phoneMe?.catch(() => ({}))) || {};
    if (!me.person) { state = 'none'; return; }
    try {
      const e = await sealedCalls().FinancesSealed();
      envelope = e || null;
      state = e ? 'locked' : 'plain';
    } catch {
      state = 'none'; // a computer from before private Finances
    }
  })());
}

/** Puts the page's Finances calls in front of the computer's, on a phone. */
export function installPrivate() {
  if (!onPhone() || !window.go?.main?.App) return;
  real = window.go.main.App;
  window.go.main.App = new Proxy(real, {
    get: (t, m) => (typeof m === 'string' && PLAIN.has(m) ? (...args: unknown[]) => answer(m, args) : (t as unknown as Record<string | symbol, unknown>)[m]),
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') lock(); });
  for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, touched, { passive: true, capture: true });
}

async function answer(method: string, args: unknown[]): Promise<unknown> {
  await find();
  const pass = () => (real as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[method](...args);
  if (state === 'none' || state === 'plain') {
    try {
      return await pass();
    } catch (e) {
      // Turned private on another of her devices since: find out again.
      if (state === 'plain' && /Finances are private/.test(String((e as Error)?.message))) { known = null; await find(); tell(); if ((state as State) === 'locked') throw new Locked(); }
      throw e;
    }
  }
  if (state === 'locked' || !key || !data) throw new Locked();
  touched();
  switch (method) {
    case 'Finances': return view();
    case 'FinancesLedger': return { ...(data.ledger as object), rev: envelope!.rev };
    case 'SaveFinances': await save({ ...data, plan: unrev(args[0]) }); return view();
    case 'SaveFinancesLedger': await save({ ...data, ledger: unrev(args[0]) }); return { ...(data.ledger as object), rev: envelope!.rev };
    case 'SaveFinancesReceipt': return sealedCalls().SaveFinancesSealedReceipt(await seal.sealText(key, me.person!, String(args[0])));
    case 'FinancesReceipt': return seal.openText(key, me.person!, await sealedCalls().FinancesSealedReceipt(String(args[0])));
  }
  return pass();
}

const unrev = (x: unknown) => { const { rev: _rev, ...rest } = (x || {}) as { rev?: string }; return rest; };

// The projection: the computer's own Go, loaded the first time it's wanted.
// (companion.js loads it, the phone's bridge: the computer's window never does).
async function projection(): Promise<void> {
  if (window.homelabFinance) return;
  try {
    await window.phoneProjection!();
  } catch {
    throw new Error('This computer’s Homelab Wizard can’t open private Finances on this page yet: update it on the computer, then try again.');
  }
}

/** Her Finances read forward from today, on this phone, as the computer would have. */
async function view(): Promise<finance.View> {
  await projection();
  const r = window.homelabFinance!.project(JSON.stringify(data!.plan), JSON.stringify(data!.ledger), todayISO());
  if (r.error || !r.view) throw new Error(r.error || 'Finances couldn’t be read forward');
  const v = JSON.parse(r.view) as finance.View;
  v.plan.rev = envelope!.rev;
  v.readOnly = !mayChange();
  return v;
}

const CHANGED = 'Your Finances were changed on another of your devices after this was read. The latest is shown now: make your change again.';

/** Seals next and keeps it on the computer; when another device of hers saved first, opens hers instead and says so. */
async function save(next: Private) {
  const sealed = await seal.reseal(key!, envelope!, me.person!, next);
  try {
    const r = await sealedCalls().SaveFinancesSealed(envelope!.rev!, sealed);
    envelope = { ...sealed, rev: r.rev };
    data = next;
  } catch (e) {
    if (!/changed on another device/.test(String((e as Error)?.message))) throw e;
    const latest = await sealedCalls().FinancesSealed();
    if (latest) { data = await seal.openSealed(key!, latest, me.person!); envelope = latest; }
    throw new Error(CHANGED);
  }
}

/** Opens her Finances with the key, once unwrapped. */
async function opened(k: CryptoKey) {
  const latest = await sealedCalls().FinancesSealed();
  if (!latest) { state = 'plain'; envelope = null; tell(); return; }
  data = await seal.openSealed(k, latest, me.person!);
  envelope = latest;
  key = k;
  state = 'open';
  await view(); // the projection loaded, or why not, before the screens draw
  touched();
  tell();
}

/** Unlocks with her passkey (Face ID or her phone's code). */
export async function unlockWithPasskey() {
  await opened(await seal.unlockWithPasskey(envelope!, me.person!, await passkeySecret(envelope!.kdf.passkey!)));
}
/** Unlocks with her passphrase (a phone whose passkey can't lock them). */
export async function unlockWithPassphrase(passphrase: string) {
  await opened(await seal.unlockWithPassphrase(envelope!, me.person!, passphrase));
}
/** Unlocks with the 16 words of her recovery code. */
export async function unlockWithCode(words: string) {
  const code = seal.codeFromWords(words);
  if (!code) throw new Error('A recovery code is 16 words from the list it was shown with. Check each word and try again.');
  await opened(await seal.unlockWithCode(envelope!, me.person!, code));
}

/** Drops the opened key and her plain Finances from this page. */
export function lock() {
  if (state !== 'open') return;
  key = null;
  data = null;
  state = 'locked';
  clearTimeout(idle);
  tell();
}
let idle = 0;
function touched() {
  if (state !== 'open') return;
  clearTimeout(idle);
  idle = window.setTimeout(lock, LOCK_AFTER);
}

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));
type PRFResults = { enabled?: boolean; results?: { first?: BufferSource } };
const prfOf = (c: PublicKeyCredential) => (c.getClientExtensionResults() as { prf?: PRFResults }).prf;
const bytes = (b: BufferSource) => new Uint8Array(b instanceof ArrayBuffer ? b : b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));

/** The secret her passkey gives this page (its PRF), asked for with Face ID. */
async function passkeySecret(credential: string): Promise<Bytes> {
  const id = Uint8Array.from(atob(credential), (c) => c.charCodeAt(0));
  const c = await navigator.credentials.get({ publicKey: {
    challenge: random(32), allowCredentials: [{ type: 'public-key', id }], userVerification: 'required',
    extensions: { prf: { eval: { first: seal.PRF_INPUT } } } as AuthenticationExtensionsClientInputs,
  } }) as PublicKeyCredential | null;
  const first = c && prfOf(c)?.results?.first;
  if (!first) throw new Error('This phone’s passkey can’t open them here. Use your recovery code instead.');
  return bytes(first);
}

/**
 * A new passkey for her private Finances, and the secret it gives; null
 * when this phone's passkeys can't give one (then a passphrase instead).
 * Cancelling Face ID is said, so she can try again or pick a passphrase.
 */
export async function makePasskey(): Promise<{ secret: Bytes; credential: Bytes } | null> {
  if (!window.PublicKeyCredential || !navigator.credentials?.create) return null;
  let c: PublicKeyCredential | null;
  try {
    c = await navigator.credentials.create({ publicKey: {
      rp: { name: 'Homelab' }, challenge: random(32),
      user: { id: random(16), name: `${me.person} (Finances)`, displayName: `${me.personName || me.person}’s private Finances` },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      extensions: { prf: { eval: { first: seal.PRF_INPUT } } } as AuthenticationExtensionsClientInputs,
    } }) as PublicKeyCredential | null;
  } catch (e) {
    if ((e as Error)?.name === 'NotAllowedError') throw new Error('Face ID was cancelled. Try again, or use a passphrase instead.');
    return null;
  }
  const prf = c && prfOf(c);
  if (!c || !prf?.enabled) return null;
  const credential = new Uint8Array(c.rawId);
  return { secret: prf.results?.first ? bytes(prf.results.first) : await passkeySecret(btoa(String.fromCharCode(...credential))), credential };
}

/**
 * Turns privacy on (3.3's steps): her plain Finances read, each receipt
 * sealed and kept, everything sealed and saved as new. Only once that save
 * succeeds does the computer remove her plain files; a failure before it
 * leaves them as they were.
 */
export async function turnOn(ways: seal.Ways) {
  const plan = unrev((await real.Finances()).plan) as finance.Plan;
  const ledger = unrev(await real.FinancesLedger()) as finance.Ledger;
  const k0 = await seal.turnOn({ plan, ledger }, me.person!, ways);
  const transactions = [];
  for (const t of ledger.transactions || []) {
    if (!t.receipt || t.receipt.endsWith('.sealed')) { transactions.push(t); continue; }
    const name = await sealedCalls().SaveFinancesSealedReceipt(await seal.sealText(k0.key, me.person!, await real.FinancesReceipt(t.receipt)));
    transactions.push({ ...t, receipt: name });
  }
  const sealed = transactions.some((t, i) => t !== ledger.transactions![i]) ? await seal.reseal(k0.key, k0.envelope, me.person!, { plan, ledger: { ...ledger, transactions } }) : k0.envelope;
  const r = await sealedCalls().SaveFinancesSealed('new', sealed);
  envelope = { ...sealed, rev: r.rev };
  data = { plan, ledger: { ...ledger, transactions } };
  key = k0.key;
  state = 'open';
  touched();
  tell();
}
