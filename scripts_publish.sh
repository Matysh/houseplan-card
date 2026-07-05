#!/usr/bin/env bash
# Публикация House Plan на GitHub + релиз. Запускать на своей машине, где ты залогинен в GitHub.
# Требуется установленный git и gh (GitHub CLI: https://cli.github.com), выполнить `gh auth login` один раз.
set -e
OWNER="Matysh"                 # владелец репозитория (github.com/Matysh)
REPO="houseplan-card"

# 1) распаковать репозиторий из бандла (если ещё нет рабочей копии)
# git clone houseplan-card.git.bundle "$REPO" && cd "$REPO"

# 2) создать ПУБЛИЧНЫЙ репозиторий и запушить всё + теги
gh repo create "$OWNER/$REPO" --public \
  --description "Интерактивный план дома для Home Assistant: этажи, комнаты и устройства на настоящем плане. Всё через UI, без YAML." \
  --source . --remote origin --push

# 3) добавить topics (для поиска в HACS)
gh repo edit "$OWNER/$REPO" --add-topic home-assistant --add-topic hacs \
  --add-topic lovelace --add-topic floorplan --add-topic custom-integration --add-topic zigbee

# 4) опубликовать РЕЛИЗ (не просто тег) с заметками
git push origin v1.9.3
gh release create v1.9.3 --title "House Plan v1.9.3" --notes-file RELEASE_NOTES_v1.9.3.md

echo "Готово. Теперь репозиторий устанавливается как HACS Custom repository (категория Integration)."
