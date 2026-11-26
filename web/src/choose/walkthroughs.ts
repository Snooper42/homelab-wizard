
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
      'Sign in at account.protonvpn.com and click Downloads in the menu on the left. Scroll down past the apps to WireGuard configuration.',
      'Fill in its parts 1 to 3: any name (homelab, say), Router as the platform, and under VPN options turn on NAT-PMP (Port Forwarding). Leave the other options as they are.',
      'In part 4, Select a server to connect to, press Create next to any server marked P2P (⇄).',
      'A window shows the new file. Copy only the long text after PrivateKey = (it ends with =) and paste it here. Leave the rest.',
    ],
    link: { url: 'https://account.protonvpn.com/downloads', label: 'Open Proton’s WireGuard page' },
  },
};
