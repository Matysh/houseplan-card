#!/usr/bin/env bash
# Бандл головы dev для стенда разработки (#657).
#
# С #657 бандл в дереве dev меняется только релизным кандидатом, поэтому
# между бетами `custom_components/houseplan/frontend/` в dev — бандл последней
# беты. Свежий бандл головы dev Validate публикует в служебную ветку
# `dev-build` (scripts/dev-build.mjs): один коммит без истории с
# `custom_components/houseplan/frontend/**` и DEV-BUILD.json (SHA источника).
#
# Скрипт кладёт этот бандл поверх рабочей копии стенда. В
# /opt/hp/bin/hp-update-dev.sh — два вызова вокруг `git pull` dev:
#
#   demo/stand/update-dev-bundle.sh --reset <checkout>   # до pull: вернуть отслеживаемый бандл
#   git -C <checkout> pull --ff-only
#   demo/stand/update-dev-bundle.sh <checkout>           # после pull, до перезапуска HA
#
# Первый вызов нужен, потому что наложенный бандл — локальная правка
# отслеживаемых файлов, и pull кандидата беты на ней остановился бы.
#
# Если dev-build отстаёт от головы dev (Validate ещё идёт или упал), скрипт
# предупреждает и всё равно ставит последний опубликованный бандл: он собран
# из чуть более старого dev, но из того же конвейера, а не из дерева беты.
set -euo pipefail

reset=false
if [ "${1:-}" = "--reset" ]; then reset=true; shift; fi
checkout=${1:?usage: update-dev-bundle.sh [--reset] <checkout-of-dev>}
remote=${HP_DEV_BUILD_REMOTE:-origin}
branch=${HP_DEV_BUILD_BRANCH:-dev-build}
target=custom_components/houseplan/frontend

cd "$checkout"
if $reset; then
  git checkout -- "$target"
  git clean -fdq -- "$target"
  echo "update-dev-bundle: $target возвращён к закоммиченному"
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
