// A household member's private Finances, sealed on her own phone so only
// she can open them, the person who runs the homelab included
// (.claude/prompts/private-finances.md 3.1). Her phone makes a random data
// key and seals her plan and ledger with it (AES-256-GCM, a fresh 96-bit
// nonce each save); the key is wrapped twice, by her recovery code and by
// her passkey (or, where the passkey can't give a secret, a passphrase), and
// the computer keeps only the envelope (internal/finance/sealed.go), which it
// can't open. Nothing here leaves the phone but that envelope: the opened
// key is a CryptoKey that can't be read out, held while Finances is open.
//
// The format, for the iPhone app to match (step 4):
// - sealed: nonce (12) || AES-256-GCM(data key, the JSON {plan, ledger}),
//   associated data "homelab-finances:1:<username>";
// - a wrapped key: nonce (12) || AES-256-GCM(wrapping key, the 32-byte data
//   key), associated data "homelab-finances-key:1:<username>";
// - by the recovery code: scrypt(the code's 16 bytes, kdf.salt, N 2^17, r 8,
//   p 1, 32 bytes); by a passphrase: scrypt(its UTF-8, NFKC, kdf.passphraseSalt,
//   the same); by the passkey: HKDF-SHA256(its PRF output, no salt, info
//   "homelab-finances-passkey:1", 32 bytes), the PRF asked with PRF_INPUT;
// - a receipt: as sealed, of its data URL, associated data
//   "homelab-finances-receipt:1:<username>".

/** Bytes, as WebCrypto takes them. */
export type Bytes = Uint8Array<ArrayBuffer>;

/** Her plan and ledger, as the computer would have kept them plain. */
export interface Private {
  plan: unknown;
  ledger: unknown;
}

/** The envelope as the computer keeps it (finance.Envelope): bytes in standard base64. */
export interface Envelope {
  version: number;
  rev?: string;
  kdf: { name: string; salt: string; n?: number; r?: number; p?: number; passphraseSalt?: string; passkey?: string };
  wrappedByPasskey?: string;
  wrappedByCode: string;
  sealed: string;
}

/** How turning privacy on wraps the key: always the code, and the passkey's secret or a passphrase. */
export interface Ways {
  code: Bytes;
  prf?: { secret: Bytes; credential: Bytes };
  passphrase?: string;
}

const N = 1 << 17, R = 8, P = 1;
/** What the passkey's PRF is asked with: the same on every phone of hers. */
export const PRF_INPUT = new TextEncoder().encode('homelab-finances:1');
/** The least a passphrase may be. */
export const MIN_PASSPHRASE = 12;

const enc = new TextEncoder();
const subtle = () => {
  if (!globalThis.crypto?.subtle) throw new Error('This page can only keep Finances private over the homelab’s secure address (https).');
  return crypto.subtle;
};
const b64 = (b: Bytes) => { let s = ''; for (const c of b) s += String.fromCharCode(c); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s || ''), (c) => c.charCodeAt(0));
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const aad = (what: string, username: string) => enc.encode(`${what}:1:${username}`);

// The recovery code's words: 256 plain ones, so its 16 bytes are 16 words.
export const WORDS = [
  'acorn', 'actor', 'adult', 'agent', 'alarm', 'album', 'alley', 'amber', 'angle', 'ankle', 'apple', 'apron',
  'arena', 'armor', 'arrow', 'atlas', 'attic', 'award', 'bacon', 'badge', 'bagel', 'baker', 'banjo', 'barn',
  'basil', 'beach', 'beard', 'bench', 'berry', 'bike', 'bird', 'blank', 'blaze', 'bloom', 'board', 'boat',
  'bonus', 'boots', 'bread', 'brick', 'bride', 'brook', 'broom', 'brush', 'bucket', 'buddy', 'bugle', 'cabin',
  'cable', 'cactus', 'camel', 'camera', 'candy', 'canoe', 'canvas', 'cargo', 'carpet', 'carrot', 'castle', 'cedar',
  'chain', 'chair', 'chalk', 'cherry', 'chess', 'chief', 'cider', 'circus', 'clay', 'cliff', 'clock', 'cloud',
  'clover', 'coach', 'cobra', 'cocoa', 'comet', 'coral', 'corn', 'cotton', 'couch', 'crane', 'crayon', 'cream',
  'crown', 'cube', 'daisy', 'dance', 'delta', 'denim', 'desert', 'diary', 'dinner', 'donkey', 'door', 'dragon',
  'drum', 'eagle', 'easel', 'echo', 'elbow', 'ember', 'engine', 'falcon', 'fancy', 'farm', 'feather', 'fence',
  'fern', 'ferry', 'fiddle', 'field', 'flag', 'flute', 'forest', 'fossil', 'fox', 'frost', 'garden', 'garlic',
  'gecko', 'ginger', 'glove', 'goat', 'gold', 'grape', 'gravy', 'guitar', 'hammer', 'harbor', 'harp', 'hazel',
  'helmet', 'heron', 'hill', 'honey', 'hotel', 'island', 'ivory', 'jacket', 'jelly', 'jewel', 'judge', 'juice',
  'kayak', 'kettle', 'kitten', 'kiwi', 'koala', 'ladder', 'lake', 'lamp', 'lemon', 'lily', 'lizard', 'llama',
  'magnet', 'mango', 'maple', 'marble', 'meadow', 'melon', 'mirror', 'mitten', 'monkey', 'moose', 'motor', 'muffin',
  'napkin', 'nest', 'noodle', 'oasis', 'ocean', 'olive', 'onion', 'orange', 'otter', 'owl', 'paddle', 'panda',
  'parade', 'parrot', 'pasta', 'peach', 'peanut', 'pebble', 'pencil', 'pepper', 'piano', 'pickle', 'pillow', 'pilot',
  'pizza', 'planet', 'plum', 'pocket', 'pony', 'potato', 'puppy', 'quilt', 'rabbit', 'radio', 'rain', 'raven',
  'ribbon', 'river', 'robin', 'rocket', 'rose', 'ruby', 'saddle', 'salad', 'salmon', 'sandal', 'scarf', 'shell',
  'shovel', 'silver', 'skate', 'sled', 'snail', 'spider', 'spoon', 'squid', 'stamp', 'star', 'statue', 'stove',
  'sugar', 'summer', 'sunset', 'swan', 'table', 'taco', 'teapot', 'tent', 'tiger', 'toast', 'tomato', 'train',
  'tuba', 'tulip', 'turtle', 'valley', 'velvet', 'violin', 'wagon', 'walnut', 'walrus', 'whale', 'willow', 'window',
  'winter', 'wizard', 'yogurt', 'zebra',
];
const index = new Map(WORDS.map((w, i) => [w, i]));

/** A new recovery code: 128 random bits. */
export const newCode = () => random(16);
/** The code as the 16 words shown to her once. */
export const codeWords = (code: Bytes) => [...code].map((b) => WORDS[b]);
/** The code back from its words however typed (spaces, capitals), or null when it isn't one. */
export function codeFromWords(text: string): Bytes | null {
  const words = text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  if (words.length !== 16 || words.some((w) => !index.has(w))) return null;
  return Uint8Array.from(words, (w) => index.get(w)!);
}

// scrypt (RFC 7914): WebCrypto has PBKDF2 but not scrypt, so its core is here.
async function pbkdf2(password: Bytes, salt: Bytes, bytes: number): Promise<Bytes> {
  const key = await subtle().importKey('raw', password, 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 1 }, key, bytes * 8));
}
function salsa8(b: Uint32Array, o: number, x: Uint32Array) {
  for (let i = 0; i < 16; i++) x[i] = b[o + i];
  const rot = (v: number, n: number) => (v << n) | (v >>> (32 - n));
  for (let i = 0; i < 8; i += 2) {
    x[4] ^= rot(x[0] + x[12], 7); x[8] ^= rot(x[4] + x[0], 9); x[12] ^= rot(x[8] + x[4], 13); x[0] ^= rot(x[12] + x[8], 18);
    x[9] ^= rot(x[5] + x[1], 7); x[13] ^= rot(x[9] + x[5], 9); x[1] ^= rot(x[13] + x[9], 13); x[5] ^= rot(x[1] + x[13], 18);
    x[14] ^= rot(x[10] + x[6], 7); x[2] ^= rot(x[14] + x[10], 9); x[6] ^= rot(x[2] + x[14], 13); x[10] ^= rot(x[6] + x[2], 18);
    x[3] ^= rot(x[15] + x[11], 7); x[7] ^= rot(x[3] + x[15], 9); x[11] ^= rot(x[7] + x[3], 13); x[15] ^= rot(x[11] + x[7], 18);
    x[1] ^= rot(x[0] + x[3], 7); x[2] ^= rot(x[1] + x[0], 9); x[3] ^= rot(x[2] + x[1], 13); x[0] ^= rot(x[3] + x[2], 18);
    x[6] ^= rot(x[5] + x[4], 7); x[7] ^= rot(x[6] + x[5], 9); x[4] ^= rot(x[7] + x[6], 13); x[5] ^= rot(x[4] + x[7], 18);
    x[11] ^= rot(x[10] + x[9], 7); x[8] ^= rot(x[11] + x[10], 9); x[9] ^= rot(x[8] + x[11], 13); x[10] ^= rot(x[9] + x[8], 18);
    x[12] ^= rot(x[15] + x[14], 7); x[13] ^= rot(x[12] + x[15], 9); x[14] ^= rot(x[13] + x[12], 13); x[15] ^= rot(x[14] + x[13], 18);
  }
  for (let i = 0; i < 16; i++) b[o + i] += x[i];
}
// BlockMix: b (32r words) into y, then back into b in its order (the even blocks, then the odd).
function blockMix(b: Uint32Array, y: Uint32Array, r: number, x: Uint32Array, t: Uint32Array) {
  t.set(b.subarray((2 * r - 1) * 16, 2 * r * 16));
  for (let i = 0; i < 2 * r; i++) {
    for (let k = 0; k < 16; k++) t[k] ^= b[i * 16 + k];
    salsa8(t, 0, x);
    y.set(t, ((i & 1) * r + (i >> 1)) * 16);
  }
  b.set(y);
}
/** scrypt(password, salt, N, r, p) as dkLen bytes. */
export async function scrypt(password: Bytes, salt: Bytes, n: number, r: number, p: number, dkLen: number): Promise<Bytes> {
  const bytes = await pbkdf2(password, salt, p * 128 * r);
  const view = new DataView(bytes.buffer);
  const words = 32 * r;
  const b = new Uint32Array(words), y = new Uint32Array(words), v = new Uint32Array(words * n), x = new Uint32Array(16), t = new Uint32Array(16);
  for (let q = 0; q < p; q++) {
    for (let i = 0; i < words; i++) b[i] = view.getUint32((q * words + i) * 4, true);
    for (let i = 0; i < n; i++) { v.set(b, i * words); blockMix(b, y, r, x, t); }
    for (let i = 0; i < n; i++) {
      const j = b[(2 * r - 1) * 16] & (n - 1);
      for (let k = 0; k < words; k++) b[k] ^= v[j * words + k];
      blockMix(b, y, r, x, t);
    }
    for (let i = 0; i < words; i++) view.setUint32((q * words + i) * 4, b[i], true);
  }
  return pbkdf2(password, bytes, dkLen);
}

const aes = (raw: Bytes, use: KeyUsage[]) => subtle().importKey('raw', raw, 'AES-GCM', false, use);
async function seal(key: CryptoKey, data: Bytes, ad: Bytes): Promise<Bytes> {
  const nonce = random(12);
  const out = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv: nonce, additionalData: ad }, key, data));
  const all = new Uint8Array(12 + out.length);
  all.set(nonce);
  all.set(out, 12);
  return all;
}
async function open(key: CryptoKey, data: Bytes, ad: Bytes): Promise<Bytes> {
  if (data.length < 28) throw new Error('nothing sealed');
  return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: data.subarray(0, 12), additionalData: ad }, key, data.subarray(12)));
}

const stretch = async (secret: Bytes, salt: string) => aes(await scrypt(secret, unb64(salt), N, R, P, 32), ['encrypt', 'decrypt']);
const passphraseBytes = (s: string) => enc.encode(s.normalize('NFKC'));
async function fromPasskey(secret: Bytes) {
  const k = await subtle().importKey('raw', secret, 'HKDF', false, ['deriveBits']);
  const bits = await subtle().deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode('homelab-finances-passkey:1') }, k, 256);
  return aes(new Uint8Array(bits), ['encrypt', 'decrypt']);
}
async function unwrap(wrapping: CryptoKey, wrapped: string | undefined, username: string, why: string): Promise<CryptoKey> {
  let raw: Bytes;
  try {
    raw = await open(wrapping, unb64(wrapped || ''), aad('homelab-finances-key', username));
  } catch {
    throw new Error(why);
  }
  return aes(raw, ['encrypt', 'decrypt']);
}
const sealData = async (key: CryptoKey, username: string, data: Private) => b64(await seal(key, enc.encode(JSON.stringify(data)), aad('homelab-finances', username)));

/**
 * Turns privacy on: a new data key, her Finances sealed with it, and the key
 * wrapped by her code and by her passkey or passphrase. The envelope is what
 * the computer keeps; the key, for this page while Finances is open.
 */
export async function turnOn(data: Private, username: string, ways: Ways): Promise<{ envelope: Envelope; key: CryptoKey }> {
  if (!ways.prf && (ways.passphrase || '').length < MIN_PASSPHRASE) throw new Error(`A passphrase is ${MIN_PASSPHRASE} characters or more.`);
  const raw = random(32);
  const kdf: Envelope['kdf'] = { name: 'scrypt', salt: b64(random(16)), n: N, r: R, p: P };
  const wrap = async (w: CryptoKey) => b64(await seal(w, raw, aad('homelab-finances-key', username)));
  const wrappedByCode = await wrap(await stretch(ways.code, kdf.salt));
  let wrappedByPasskey: string;
  if (ways.prf) {
    kdf.passkey = b64(ways.prf.credential);
    wrappedByPasskey = await wrap(await fromPasskey(ways.prf.secret));
  } else {
    kdf.passphraseSalt = b64(random(16));
    wrappedByPasskey = await wrap(await stretch(passphraseBytes(ways.passphrase!), kdf.passphraseSalt));
  }
  const key = await aes(raw, ['encrypt', 'decrypt']);
  raw.fill(0);
  return { envelope: { version: 1, kdf, wrappedByPasskey, wrappedByCode, sealed: await sealData(key, username, data) }, key };
}

/** The data key, opened by her recovery code. */
export const unlockWithCode = async (e: Envelope, username: string, code: Bytes) =>
  unwrap(await stretch(code, e.kdf.salt), e.wrappedByCode, username, 'That recovery code doesn’t open these Finances. Check each word and try again.');
/** The data key, opened by her passphrase (a phone whose passkey gives no secret). */
export const unlockWithPassphrase = async (e: Envelope, username: string, passphrase: string) =>
  unwrap(await stretch(passphraseBytes(passphrase), e.kdf.passphraseSalt || ''), e.wrappedByPasskey, username, 'That passphrase doesn’t open these Finances. Try again, or use your recovery code.');
/** The data key, opened by her passkey's secret. */
export const unlockWithPasskey = async (e: Envelope, username: string, secret: Bytes) =>
  unwrap(await fromPasskey(secret), e.wrappedByPasskey, username, 'That passkey doesn’t open these Finances. Use your recovery code instead.');

/** Her plan and ledger, opened. */
export async function openSealed(key: CryptoKey, e: Envelope, username: string): Promise<Private> {
  let plain: Bytes;
  try {
    plain = await open(key, unb64(e.sealed), aad('homelab-finances', username));
  } catch {
    throw new Error('These private Finances couldn’t be opened: they were changed, or aren’t yours.');
  }
  return JSON.parse(new TextDecoder().decode(plain)) as Private;
}

/** The envelope for a save: her Finances sealed anew under the same key, the same ways to open it. */
export async function reseal(key: CryptoKey, e: Envelope, username: string, data: Private): Promise<Envelope> {
  const { rev: _rev, ...rest } = e;
  return { ...rest, sealed: await sealData(key, username, data) };
}

/** A receipt (its data URL) sealed, as base64, and opened again. */
export const sealText = async (key: CryptoKey, username: string, text: string) => b64(await seal(key, enc.encode(text), aad('homelab-finances-receipt', username)));
export async function openText(key: CryptoKey, username: string, sealed: string): Promise<string> {
  try {
    return new TextDecoder().decode(await open(key, unb64(sealed), aad('homelab-finances-receipt', username)));
  } catch {
    throw new Error('This receipt couldn’t be opened: it was changed, or isn’t yours.');
  }
}
