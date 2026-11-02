// Memory: what each app holds right now, from Docker's stats (Status
// samples them every 10 seconds while it is open). An app counts its own
// helpers too (its database, its cache), so a group's total is what
// stopping its apps would give back.

const units: Record<string, number> = { b: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12, kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3, tib: 1024 ** 4 };

/** Bytes from Docker's way of writing memory ("512.3MiB", "1.2GiB", "800kB"); 0 when it cannot tell. */
export function parseMem(s: string): number {
  const m = /^\s*([\d.]+)\s*([a-z]+)?\s*$/i.exec(s || '');
  if (!m) return 0;
  return parseFloat(m[1]) * (units[(m[2] || 'b').toLowerCase()] ?? 0);
}

/** Memory in a few characters: "180 MB", "2.1 GB". */
export function formatMem(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(bytes >= 1e10 ? 0 : 1)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  return bytes > 0 ? '<1 MB' : '0 MB';
}

/**
 * Each app's memory by its ID: its own container's and its helpers'
 * (dependsOn of kind helper), each helper counted once. Stats are named by
 * compose service, as core.Usage reads them.
 */
export function memoryByApp(stats: docker.Stat[], catalog: api.Catalog | null): Record<string, number> {
  const bytes = new Map(stats.map((s) => [s.name, parseMem(s.mem)]));
  const kind = new Map((catalog?.apps || []).map((a) => [a.id, a.kind]));
  const out: Record<string, number> = {};
  const claimed = new Set<string>();
  for (const a of catalog?.apps || []) {
    if (a.kind === 'helper') continue;
    let n = bytes.get(a.id) || 0;
    for (const d of a.dependsOn || []) {
      if (kind.get(d) === 'helper' && !claimed.has(d)) { n += bytes.get(d) || 0; claimed.add(d); }
    }
    if (bytes.has(a.id) || n) out[a.id] = n;
  }
  return out;
}
