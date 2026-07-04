# Разработка и деплой

## Окружение (cowork-сессии)

- Эталон кода — **git-репозиторий** (в сессии живёт в `/tmp/hpc`, восстанавливается из
  `houseplan-card.git.bundle`: `git clone houseplan-card.git.bundle hpc`).
- Папка пользователя `houseplan/houseplan-card/` — зеркало репо (rsync после каждого коммита)
  + актуальный `houseplan-card.git.bundle`.

### ⚠️ Грабли файловой синхронизации (критично)
1. Сетевой mount иногда отдаёт файлы **обрезанными/перемешанными** — правки через Edit-tool
   с Windows-стороны ненадёжны. Правило: **править python-патчами по чистой копии в /tmp,
   писать через bash**, assert на count(old)==1.
2. **Сборку rollup вести ТОЛЬКО в /tmp/hpc** (`npm ci` уже сделан). Сборка на mount однажды
   дала синтаксически валидный, но битый бандл («wi is not defined»), который валил рендер
   ВСЕХ дашбордов HA (карточка грузится как extra_module на каждой странице!).
3. `.git` на mount не создаётся («Operation not permitted» на dot-каталогах) — поэтому bundle.

## Сборка

```bash
cd /tmp/hpc && npm ci        # один раз
npx rollup -c                # → dist/houseplan-card.js
node --check dist/houseplan-card.js
cp dist/houseplan-card.js custom_components/houseplan/frontend/
```

## Деплой на дачу (ha.jbstudio.pro)

- SSH: порт **323**, root, ключ `ha_jb` (пользователь загружает в чат; в песочнице /tmp/ha_jb, chmod 600).
- JS: `scp -P 323 -i /tmp/ha_jb dist/houseplan-card.js root@ha.jbstudio.pro:/config/custom_components/houseplan/frontend/`
- Интеграция целиком: tar c custom_components/houseplan (--exclude __pycache__) → tar x на сервере.
- **Проверка обязательна**: `md5sum` локально == на сервере == `curl http://homeassistant:8123/houseplan_files/houseplan-card.js | md5sum`
  (внутри SSH-аддона `localhost` — НЕ HA, использовать хост `homeassistant`).
- Изменения Python требуют рестарта HA (`ha core restart`, держит соединение до конца, HTTP
  поднимается через 1–3 мин). Изменения JS — только обновление страницы (static path отдаётся
  с no-cache).
- После деплоя JS — проверить в браузере (Ctrl+F5) и console (не должно быть ошибок из
  houseplan-card.js; битый бандл роняет все дашборды).

## Кэш фронтенда и «пустой вид»

- URL модуля карточки содержит `?v=<VERSION из const.py>`. Браузеры держат ES-модуль в
  memory-cache: после деплоя нового JS **бампните VERSION в const.py и рестартуйте HA**,
  иначе обычный F5 оставит старую версию.
- После reload страницы HA-фронтенд (с kiosk-mode) иногда оставляет вид пустым
  («InvalidStateError: Transition was aborted», hui-view не создаётся 1–2 мин).
  Лечится повторной SPA-навигацией: pushState + событие location-changed, или подождать.

## Релиз

Тег `vX.Y.Z` + GitHub Release → workflow `.github/workflows/release.yml` собирает и прикладывает
`houseplan-card.js`. Версию бампать синхронно: `src/houseplan-card.ts` (CARD_VERSION),
`package.json`, `custom_components/houseplan/manifest.json`, `custom_components/houseplan/const.py`.

## Воспроизводимые скрипты (данные)

- Извлечение геометрии/подложек из прототипа и генерация `src/data/*` — см. историю коммитов
  и docs/ARCHITECTURE.md (трансформации SVG→базовое пространство: f1 0.647/(490,27), f2 0.896/(351,21)).
- Подгонка комнат: рендер плана с прямоугольниками поверх (cv2) → снап к стенам → ручная доводка.

## Прод-объекты в HA (дача)

- Дашборд `plan-doma`, панельный вид, карточка `custom:houseplan-card` (icon_size 2.5).
- Интеграция houseplan: entry загружен, `.storage/houseplan.layout` — раскладка (сервер).
- Старый прототип `/config/www/houseplan/` (iframe) сохранён как запасной, не трогать.
- Бэкапы configuration.yaml: `.bak-avgtemp` (до правки среднего датчика).
