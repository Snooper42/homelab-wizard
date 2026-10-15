#!/bin/sh
# Entrypoint for the homelab Nginx Proxy Manager image.
#  1. Writes the CrowdSec bouncer config from CROWDSEC_API_URL/CROWDSEC_API_KEY.
#     With no key the bouncer is disabled instead of failing, so the proxy
#     always starts. Tune extra settings in
#     /etc/crowdsec/bouncers/crowdsec-openresty-bouncer.conf.local.
#  2. Creates /data/nginx/custom/server_proxy.conf once (NPM includes it in
#     every proxy host): requests from the Cloudflare Tunnel carry the
#     visitor's address in CF-Connecting-IP, so logs and CrowdSec see real
#     clients. LAN requests have no such header and keep their own address.
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
if [ ! -e "$custom" ]; then
	mkdir -p "$(dirname "$custom")"
	cat > "$custom" <<'EOF'
# Created by the homelab image (dockerfiles/npm-crowdsec/homelab-init.sh) and
# included in every proxy host. Your edits are kept.
# Requests from the Cloudflare Tunnel carry the visitor's address in
# CF-Connecting-IP; use it so access logs and CrowdSec see real clients.
real_ip_header CF-Connecting-IP;
EOF
fi

exec /init "$@"
