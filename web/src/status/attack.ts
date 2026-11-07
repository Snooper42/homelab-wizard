// CrowdSec's scenarios in words a household reads: "Probing for a known
// security hole", not "vpatch-CVE-2017-9841". The scenario's own name and
// the address it came from stay in the row's tooltip.

const words: [RegExp, string][] = [
  [/(^|-)cve-|^vpatch-/i, 'Probing for a known security hole'],
  [/sensitive-files/, 'Looking for private files (passwords, backups)'],
  [/path-traversal/, 'Trying to reach files outside the site'],
  [/sqli/, 'Trying to break into a database'],
  [/xss/, 'Trying to plant a script in a page'],
  [/backdoor/, 'Looking for a back door left by other attackers'],
  [/admin-interface/, 'Looking for admin pages'],
  [/wordpress|wp-/, 'Scanning for WordPress holes'],
  [/bad-user-agent/, 'A known attack tool'],
  [/open-proxy/, 'Trying to use the homelab as a proxy'],
  [/ssh.*bf|ssh-.*brute/, 'Guessing an SSH password'],
  [/(^|-)bf$|bruteforce|brute-force/, 'Guessing passwords'],
  [/crawl/, 'Crawling every page'],
  [/probing/, "Probing for pages that aren't there"],
];

/** A scenario in words, with "Suspicious requests" for one not known here. */
export function attackWords(scenario: string): string {
  const s = scenario.replace(/^crowdsecurity\//, '');
  return words.find(([re]) => re.test(s))?.[1] || 'Suspicious requests';
}

let regions: Intl.DisplayNames | null = null;
/** Where an attack came from: its country's name and its network ("Netherlands · Example Hosting B.V."). */
export function attackFrom(a: { country?: string; network?: string }): string {
  let country = a.country || '';
  try {
    regions ||= new Intl.DisplayNames(['en'], { type: 'region' });
    if (/^[A-Z]{2}$/.test(country)) country = regions.of(country) || country;
  } catch { /* no names: the code */ }
  return [country, a.network].filter(Boolean).join(' · ');
}

/** The tooltip: CrowdSec's own name for it, and the address. */
export const attackDetail = (a: { scenario: string; ip?: string }) => `${a.scenario}${a.ip ? ' from ' + a.ip : ''}`;
