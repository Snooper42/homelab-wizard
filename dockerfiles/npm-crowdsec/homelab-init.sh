#!/bin/sh
# Entrypoint for the homelab Nginx Proxy Manager image.
#  1. Writes the CrowdSec bouncer config from CROWDSEC_API_URL/CROWDSEC_API_KEY.
#     With no key the bouncer is disabled instead of failing, so the proxy
#     always starts. Tune extra settings in
#     /etc/crowdsec/bouncers/crowdsec-openresty-bouncer.conf.local.
#  2. Creates /data/nginx/custom/server_proxy.conf once (NPM includes it in
#     every proxy host): requests from the Cloudflare Tunnel carry the
#     visitor's address in CF-Connecting-IP, so logs and CrowdSec see real
#     clients. The header is taken only from cloudflared's fixed address on
#     the tunnel's own network (198.18.89.2, internal/docker TunnelAddress):
#     at server level, set_real_ip_from replaces NPM's own list (every
#     private network), so a device at home or another container is seen
#     as itself whatever it sends (N21). A file that is still the old text
#     this image wrote is rewritten; one the household edited is kept.
#  3. Execs NPM's /init, which must stay PID 1.
set -eu

conf=/etc/crowdsec/bouncers/crowdsec-openresty-bouncer.conf
cp /etc/crowdsec/bouncers/crowdsec-openresty-bouncer.conf.example "$conf"

# set_opt sets a bouncer option, adding it when the template lacks it.
set_opt() {
	if grep -q "^$1=" "$conf"; then
		sed -i "s|^$1=.*|$1=$2|" "$conf"
	else
		echo "$1=$2" >>"$conf"
	fi
}

if [ -n "${CROWDSEC_API_KEY:-}" ]; then
	set_opt ENABLED true
	set_opt API_URL "${CROWDSEC_API_URL:-http://crowdsec:8080}"
	set_opt API_KEY "$CROWDSEC_API_KEY"
	# Pull decisions every 10s and answer from the local cache. If CrowdSec
	# is down, requests are allowed (fail open) rather than blocked.
	set_opt MODE stream
	set_opt UPDATE_FREQUENCY 10
	# AppSec: CrowdSec checks each request against its virtual-patching
	# rules. If it does not answer, the request goes through.
	set_opt APPSEC_URL "${CROWDSEC_APPSEC_URL:-http://crowdsec:7422}"
	set_opt APPSEC_FAILURE_ACTION passthrough
else
	echo "homelab-init: CROWDSEC_API_KEY is empty, so the CrowdSec bouncer is disabled" >&2
	set_opt ENABLED false
	set_opt API_URL ""
	set_opt MODE live
fi

custom=/data/nginx/custom/server_proxy.conf
old_text="# Created by the homelab image (dockerfiles/npm-crowdsec/homelab-init.sh) and
# included in every proxy host. Your edits are kept.
# Requests from the Cloudflare Tunnel carry the visitor's address in
# CF-Connecting-IP; use it so access logs and CrowdSec see real clients.
real_ip_header CF-Connecting-IP;"
if [ -e "$custom" ] && [ "$(cat "$custom")" = "$old_text" ]; then
	echo "homelab-init: server_proxy.conf now takes a visitor's address from the tunnel alone" >&2
	rm -f "$custom"
elif [ -e "$custom" ] && ! grep -q '^set_real_ip_from 198\.18\.89\.2;' "$custom"; then
	echo "homelab-init: server_proxy.conf was edited, so it is kept as it is; add 'set_real_ip_from 198.18.89.2;' to it so only the tunnel can name a visitor's address" >&2
fi
if [ ! -e "$custom" ]; then
	mkdir -p "$(dirname "$custom")"
	cat > "$custom" <<'EOF'
# Created by the homelab image (dockerfiles/npm-crowdsec/homelab-init.sh) and
# included in every proxy host. Your edits are kept.
# Requests from the Cloudflare Tunnel carry the visitor's address in
# CF-Connecting-IP; use it so access logs and CrowdSec see real clients.
# Taken only from cloudflared's fixed address on the tunnel's own network:
# here it replaces NPM's list of every private network, so a device at
# home is seen as itself whatever it sends.
real_ip_header CF-Connecting-IP;
set_real_ip_from 198.18.89.2;
EOF
fi

exec /init "$@"
