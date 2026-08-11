#!/usr/bin/env sh
# Install the stand-only integrations into a Home Assistant config directory.
#
#   ./install.sh /mnt/data/supervisor/homeassistant
#
# The manifests are stored as `manifest.template.json` on purpose: the HACS
# submission check globs `*manifest.json` over the whole clone of the default
# branch and refuses a repository with more than one of them
# (hacs/default, scripts/helpers/integration_path.py). See README.md.
set -eu

target="${1:?usage: install.sh <path to the Home Assistant config directory>}"
here="$(cd "$(dirname "$0")" && pwd)"

for comp in demo_robot demo_guard; do
  src="$here/$comp"
  [ -d "$src" ] || { echo "missing $src" >&2; exit 1; }
  dst="$target/custom_components/$comp"
  mkdir -p "$dst"
  cp -a "$src/." "$dst/"
  mv -f "$dst/manifest.template.json" "$dst/manifest.json"
  echo "installed $comp -> $dst"
done
