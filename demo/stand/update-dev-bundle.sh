#!/usr/bin/env bash
# Бандл головы dev для стенда разработки (#657).
#
# Frontend не хранится в Git (#1598). Готовая ветка dev-build содержит
# backend и frontend одного проверенного SHA. Скрипт накладывает её frontend
# на checkout стенда перед перезапуском HA. Устаревший dev-build остаётся
# явным предупреждением, а не свидетельством установки текущего dev.
#
# Старый caller --reset перед git pull поддерживается для checkout, ещё
# отслеживающих snapshot. На новых исходниках ignored frontend не мешает pull.
set -euo pipefail

reset=false
if [ "${1:-}" = "--reset" ]; then reset=true; shift; fi
checkout=${1:?usage: update-dev-bundle.sh [--reset] <checkout-of-dev>}
remote=${HP_DEV_BUILD_REMOTE:-origin}
branch=${HP_DEV_BUILD_BRANCH:-dev-build}
target=custom_components/houseplan/frontend

cd "$checkout"
if $reset; then
  if [ -n "$(git ls-files -- "$target")" ]; then
    git checkout -- "$target"
    git clean -fdq -- "$target"
    echo "update-dev-bundle: $target возвращён к закоммиченному"
  else
    echo "update-dev-bundle: $target не отслеживается; reset не требуется"
  fi
  exit 0
fi
git fetch --quiet "$remote" "+refs/heads/$branch:refs/remotes/$remote/$branch"
built=$(git show "$remote/$branch:DEV-BUILD.json" | sed -n 's/.*"source": *"\([0-9a-f]\{40\}\)".*/\1/p')
head=$(git rev-parse HEAD)
if [ "$built" != "$head" ]; then
  echo "update-dev-bundle: $branch собран из ${built:0:8}, а рабочая копия на ${head:0:8} — ставлю последний опубликованный" >&2
fi
# Заменить каталог целиком: переименованные content-hashed чанки не должны
# копиться от сборки к сборке.
rm -rf "$target"
git archive "$remote/$branch" "$target" | tar -x
echo "update-dev-bundle: $target ← $branch (${built:0:8})"
