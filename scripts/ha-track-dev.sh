#!/bin/sh
# Голова dev House Plan на своей инсталляции Home Assistant (#835).
#
# После каждого зелёного push в dev Validate публикует в служебную ветку
# `dev-build` всю интеграцию этого коммита: Python из дерева и свежий
# фронтенд из сборки (scripts/dev-build.mjs). HACS ставит только релизы,
# поэтому голову dev на свою инсталляцию ставит этот скрипт — из
# shell_command Home Assistant (docs/DEVELOPMENT.md, «Tracking the head of
# dev on your own installation»):
#
#   sh /config/scripts/ha-track-dev.sh          скачать сборку и поставить, если она другая
#   sh /config/scripts/ha-track-dev.sh --poll   сначала сверить маркер (~300 байт), качать
#                                               только при изменении — для опроса по расписанию
#
# Печатает `updated <source-sha> <tree>` (поставлена новая сборка — нужен
# перезапуск HA) или `unchanged <source-sha> <tree>`. «Та же сборка» —
# по хешу дерева интеграции, а не по SHA: коммит в dev, не меняющий того,
# что попадает в HA, ничего не ставит. При любом сбое установленная
# интеграция не тронута, код выхода ненулевой. Прежняя копия лежит в
# <config>/houseplan-dev-prev — для отката. Хеш поставленной сборки хранится
# в самой копии (.dev-build-tree): откат переносом каталога или установка
# релиза через HACS не оставляют устаревшей отметки.
#
# Переменные окружения — для тестов и нестандартных установок:
#   HP_CONFIG_DIR            каталог конфигурации HA (по умолчанию /config)
#   HP_DEV_BUILD_URL         архив ветки dev-build (по умолчанию codeload GitHub)
#   HP_DEV_BUILD_MARKER_URL  DEV-BUILD.json ветки (по умолчанию raw GitHub)
set -eu

repo=Matysh/houseplan-card
config=${HP_CONFIG_DIR:-/config}
url=${HP_DEV_BUILD_URL:-https://codeload.github.com/$repo/tar.gz/refs/heads/dev-build}
marker_url=${HP_DEV_BUILD_MARKER_URL:-https://raw.githubusercontent.com/$repo/dev-build/DEV-BUILD.json}
dst=$config/custom_components/houseplan
prev=$config/houseplan-dev-prev
next=$config/.houseplan-dev-next
mark=.dev-build-tree

poll=false
case "${1:-}" in
  '') ;;
  --poll) poll=true ;;
  *) echo "usage: ha-track-dev.sh [--poll]" >&2; exit 2 ;;
esac

fail() { echo "ha-track-dev: $*" >&2; exit 1; }
# Значение 40-символьного hex-поля из DEV-BUILD.json.
field() { sed -n "s/.*\"$1\": *\"\([0-9a-f]\{40\}\)\".*/\1/p" "$2"; }

tmp=$(mktemp -d "${TMPDIR:-/tmp}/hp-dev-build.XXXXXX")
trap 'rm -rf "$tmp" "$next"' EXIT
installed=$(cat "$dst/$mark" 2>/dev/null || true)

# Опрос: маркер дёшев, архив — нет. Маркер с raw.githubusercontent может
# отставать на несколько минут (кэш CDN), поэтому вызов по вебхуку идёт без
# --poll и сразу качает архив.
if $poll && curl -fsSL --retry 2 -o "$tmp/marker.json" "$marker_url"; then
  tree=$(field integrationTree "$tmp/marker.json")
  if [ -n "$tree" ] && [ "$tree" = "$installed" ]; then
    echo "unchanged $(field source "$tmp/marker.json") $tree"
    exit 0
  fi
fi

curl -fsSL --retry 2 -o "$tmp/build.tar.gz" "$url" || fail "не удалось скачать $url"
mkdir "$tmp/x"
tar -xzf "$tmp/build.tar.gz" -C "$tmp/x" || fail "архив $url не распаковался"
root=
for dir in "$tmp/x"/*/; do root=${dir%/}; break; done
[ -n "$root" ] && [ -f "$root/DEV-BUILD.json" ] || fail "в архиве нет DEV-BUILD.json"
source=$(field source "$root/DEV-BUILD.json")
tree=$(field integrationTree "$root/DEV-BUILD.json")
src=$root/custom_components/houseplan
for need in manifest.json __init__.py frontend/houseplan-card.js frontend/houseplan-assets.json; do
  [ -f "$src/$need" ] || fail "в сборке нет $need — ветка dev-build старого формата (до #835)?"
done
[ -n "$source" ] && [ -n "$tree" ] || fail "в DEV-BUILD.json нет source или integrationTree"

if [ "$tree" = "$installed" ]; then
  echo "unchanged $source $tree"
  exit 0
fi

mkdir -p "$config/custom_components"
rm -rf "$next"
cp -R "$src" "$next" || fail "не удалось скопировать сборку в $next"
printf '%s\n' "$tree" > "$next/$mark"
rm -rf "$prev"
if [ -d "$dst" ]; then
  mv "$dst" "$prev" || fail "не удалось отложить установленную копию"
fi
if ! mv "$next" "$dst"; then
  if [ -d "$prev" ]; then mv "$prev" "$dst"; fi
  fail "не удалось поставить сборку; установленная копия возвращена"
fi
echo "updated $source $tree"
