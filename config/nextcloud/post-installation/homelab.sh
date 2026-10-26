#!/bin/sh
# Run once by Nextcloud's image after it installs itself, as www-data.
set -e
# Background jobs come from the nextcloud-cron container every 5 minutes.
php /var/www/html/occ background:cron
# Its heavier upkeep at night (01:00 to 05:00 UTC).
php /var/www/html/occ config:system:set maintenance_window_start --type=integer --value=1
