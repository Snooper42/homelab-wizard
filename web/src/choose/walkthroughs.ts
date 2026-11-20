// Where to find a key, step by step, for the settings that are hard to find:
// the plan's field shows these in place of .env.example's one line. Each says
// first what's needed before the steps can work (a paid plan, an account),
// and names things as the other site does, never by the setting's code.

export interface Walkthrough {
  /** What's needed first, before the steps can work. */
  lead: string;
  steps: string[];
  /** The page the first step opens, and its button's words. */
  link?: { url: string; label: string };
}

export const walkthroughs: Record<string, Walkthrough> = {
  // Proton's manual port-forwarding page: a P2P server, NAT-PMP on. Gluetun
  // picks the server itself, so any P2P one does: only the key is kept.
  PROTONVPN_WIREGUARD_PRIVATE_KEY: {
    lead: 'Needed for qBittorrent, and only on a paid Proton VPN plan: the free plan doesn’t allow downloads like these.',
    steps: [
      'Sign in at account.protonvpn.com and open Downloads, then WireGuard configuration.',
      'Choose Router as the platform, turn on NAT-PMP (Port Forwarding), and press Create next to any server marked P2P (⇄).',
      'In the file it shows, copy the long text after PrivateKey = and paste it here. Only that line: the rest isn’t needed.',
    ],
    link: { url: 'https://account.protonvpn.com/downloads', label: 'Open Proton’s WireGuard page' },
  },
};
