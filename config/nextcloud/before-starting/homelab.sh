#!/bin/sh
# Run by Nextcloud's image at each start, as www-data: the addresses it
# answers on are this machine, the other containers, and NEXTCLOUD_DOMAINS
# (its domain name and the tailnet address, from .env).
set -e
# Not installed means its first install failed (the log above says why):
# stop here rather than serve the setup page to whoever opens it first.
if ! php /var/www/html/occ status --output=json | grep -q '"installed":true'; then
	echo "Nextcloud did not install; fix the cause above, then remove appdata/nextcloud/html and start it again." >&2
	exit 1
fi
php /var/www/html/occ config:system:delete trusted_domains
i=0
for d in localhost nextcloud $NEXTCLOUD_DOMAINS; do
	php /var/www/html/occ config:system:set trusted_domains "$i" --value="$d"
	i=$((i + 1))
done
