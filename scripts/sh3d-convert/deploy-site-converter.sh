#!/bin/sh
# Run the accepted prepared package as root; atomically replace only converter UI.
set -eu
stage=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
expected_root=$1
previous_sha=$2
template_sha=$3
asset=$4
asset_sha=$5
site=$(readlink -f /var/www/houseplansite-current)
case "$site" in /var/www/houseplansite-releases/*) ;; *) echo 'Unexpected site root' >&2; exit 1;; esac
[ "$site" = "$expected_root" ] || { echo 'Site release changed' >&2; exit 1; }
printf '%s\n' "$asset" | grep -Eq '^converter-[a-f0-9]{16}\.js$'
hash() { sha256sum "$1" | cut -d ' ' -f 1; }
[ "$(hash "$site/includes/converter.php")" = "$previous_sha" ]
[ "$(hash "$stage/converter.php")" = "$template_sha" ]
[ "$(hash "$stage/$asset")" = "$asset_sha" ]
php -l "$stage/converter.php"
backup=$(mktemp -d /var/backups/houseplan-converter-1210-XXXXXXXX)
cp -p "$site/includes/converter.php" "$backup/converter.php"
cp "$stage/receipt.json" "$backup/receipt.json"
if [ -e "$site/assets/js/$asset" ]; then
  [ "$(hash "$site/assets/js/$asset")" = "$asset_sha" ]
else
  install -m 644 "$stage/$asset" "$site/assets/js/$asset"
fi
temporary="$site/includes/.converter-1210-$$.php"
install -m 644 "$stage/converter.php" "$temporary"
[ "$(readlink -f /var/www/houseplansite-current)" = "$site" ]
[ "$(hash "$site/includes/converter.php")" = "$previous_sha" ]
mv -f "$temporary" "$site/includes/converter.php"
printf 'backup=%s\nroot=%s\ntemplate=%s\nasset=%s\n' "$backup" "$site" "$template_sha" "$asset_sha"
# Rollback: after verifying the current template still has template_sha, install
# backup/converter.php to a sibling temporary file, then mv it over the template.
# The previous template still names the untouched old assets. No service restart.
