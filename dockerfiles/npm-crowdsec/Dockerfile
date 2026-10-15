# Nginx Proxy Manager with the CrowdSec OpenResty (Lua) bouncer built in.
#
# Follows CrowdSec's own reference build (crowdsecurity/cs-openresty-bouncer):
# the lua-cs-bouncer library goes into OpenResty's lualib, its ban/captcha
# templates into /var/lib/crowdsec/lua/templates, lua-resty-http alongside, and
# an http-level include checks every request against CrowdSec's decisions.
# Nginx Proxy Manager keeps OpenResty under /etc/nginx, so lualib is
# /etc/nginx/lualib and anything in /etc/nginx/conf.d is loaded inside http {}.
#
# Never update this container by pulling jc21/nginx-proxy-manager: that image
# has no bouncer. Bump NPM_VERSION in .env and run
#   ./homelab update nginx-proxy-manager
# which rebuilds this image.

ARG NPM_VERSION=2.16.0
FROM jc21/nginx-proxy-manager:${NPM_VERSION}

ARG LUA_CS_BOUNCER_VERSION=v1.0.19
ARG LUA_RESTY_HTTP_VERSION=v0.17.2

RUN set -eux; \
    src="$(mktemp -d)"; \
    git clone --quiet --depth 1 --branch "${LUA_RESTY_HTTP_VERSION}" https://github.com/ledgetech/lua-resty-http "$src/http"; \
    cp "$src"/http/lib/resty/http*.lua /etc/nginx/lualib/resty/; \
    git clone --quiet --depth 1 --branch "${LUA_CS_BOUNCER_VERSION}" https://github.com/crowdsecurity/lua-cs-bouncer "$src/cs"; \
    cp -R "$src"/cs/lib/. /etc/nginx/lualib/; \
    mkdir -p /var/lib/crowdsec/lua/templates /etc/crowdsec/bouncers; \
    cp "$src"/cs/templates/* /var/lib/crowdsec/lua/templates/; \
    cp "$src"/cs/config_example.conf /etc/crowdsec/bouncers/crowdsec-openresty-bouncer.conf.example; \
    rm -rf "$src"; \
    test -f /etc/nginx/lualib/crowdsec.lua; \
    test -f /etc/nginx/lualib/resty/http.lua

COPY crowdsec_openresty.conf /etc/nginx/conf.d/crowdsec_openresty.conf
COPY homelab-init.sh /usr/local/bin/homelab-init.sh

# Writes the bouncer config from the environment, then hands over to NPM's
# own /init (s6-overlay), which must remain PID 1.
ENTRYPOINT ["/usr/local/bin/homelab-init.sh"]
