#!/bin/bash
# Checks the address the iPhone app pairs with: https://homelab.<your domain>,
# which Nginx Proxy Manager serves on the home network with the domain's
# certificate. It needs no Tailscale: the Wi-Fi's DNS sends the name to the
# homelab, and the companion answers it at home only (never through the
# Cloudflare tunnel).
#
#   apple-client/scripts/phone-address.sh
#
# It only looks; it changes nothing. Run it on the Mac, on the home Wi-Fi.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=homelab-cli.sh
. "$HERE/homelab-cli.sh"

# One setting from the homelab's .env, without its quotes. Nothing else is read.
env_value() {
  [ -f "$HOMELAB/.env" ] || return 0
  sed -n "s/^$1=//p" "$HOMELAB/.env" | tail -1 | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

DOMAIN="$(env_value HOMELAB_DOMAIN)"
if [ -z "$DOMAIN" ]; then
  TS="$(env_value TAILSCALE_HOST)"
  if [ -n "$TS" ]; then
    echo "This homelab has no domain, but it has a Tailscale address: https://$TS:8099"
    echo "The phone can pair with that (with the Tailscale app on)."
    exit 0
  fi
  cat >&2 <<MSG
This homelab ($HOMELAB) has no domain set, so the phone has no https address yet.
The iPhone app only sends its key over https, so that nobody on the Wi-Fi can read it.
Set it up with: cd "$HOMELAB" && ./homelab domain setup your-domain.com   (then run this again)
MSG
  exit 1
fi

URL="https://homelab.$DOMAIN"
echo "The phone's address: $URL"

# 1. The name, as this Mac's DNS answers it (the phone on the same Wi-Fi gets the same).
IP="$(dscacheutil -q host -a name "homelab.$DOMAIN" 2>/dev/null | sed -n 's/^ip_address: //p' | head -1 || true)"
if [ -z "$IP" ]; then
  cat >&2 <<MSG
✗ homelab.$DOMAIN doesn't resolve on this Mac.
  Is the Wi-Fi's custom DNS pointing at the homelab (AdGuard)? If a VPN is on, on this Mac
  ./homelab domain resolver (in $HOMELAB) makes the names work with it on.
MSG
  exit 1
fi
case "$IP" in
  10.*|192.168.*|172.1[6-9].*|172.2[0-9].*|172.3[01].*) echo "✓ homelab.$DOMAIN is $IP, on the home network" ;;
  *) echo "! homelab.$DOMAIN is $IP, which isn't a home-network address. The companion only answers at home, so pairing would fail from there." ;;
esac

# 2. The certificate and the companion behind the proxy. Without a token the
#    companion answers 401 ("not paired"): that means the whole way works.
ERRFILE="$(mktemp)"
set +e
CODE="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$URL/api/me" 2>"$ERRFILE")"
RC=$?
set -e
ERR="$(cat "$ERRFILE" 2>/dev/null || true)"
rm -f "$ERRFILE"
case "$RC:$CODE" in
  0:401)
    echo "✓ The certificate is trusted, and the companion answers through the proxy."
    if [ -z "${HOMELAB_FROM_SCRIPT:-}" ]; then
      echo
      echo "The phone can pair with $URL. Next: apple-client/scripts/run-on-iphone.sh <your prefix>"
    fi
    ;;
  60:*|35:*|51:*|58:*)
    echo "✗ The certificate for homelab.$DOMAIN isn't trusted ($ERR)." >&2
    echo "  The iPhone refuses it too. ./homelab domain status (in $HOMELAB) shows the certificate; ./homelab domain setup makes it." >&2
    exit 1
    ;;
  0:403)
    echo "✗ The companion refused the request as coming from outside the home (403)." >&2
    echo "  Is homelab.$DOMAIN going through the Cloudflare tunnel instead of straight to Nginx Proxy Manager?" >&2
    exit 1
    ;;
  0:502|0:503|0:504)
    echo "✗ Nginx Proxy Manager answered, but the companion behind it didn't ($CODE)." >&2
    echo "  Is the serve job running? Check with: cd \"$HOMELAB\" && ./homelab schedule status" >&2
    exit 1
    ;;
  0:*)
    echo "✗ Something answered at $URL, but not the companion (HTTP $CODE)." >&2
    echo "  In Nginx Proxy Manager, homelab.$DOMAIN should forward to this Mac's port 8099." >&2
    exit 1
    ;;
  *)
    echo "✗ Couldn't reach $URL: $ERR" >&2
    exit 1
    ;;
esac
