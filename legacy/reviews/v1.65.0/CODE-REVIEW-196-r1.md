# CODE-REVIEW-196-r1

Issue: [#196](https://github.com/Matysh/houseplan-card/issues/196) — «Тултип комнаты: показывать влажность рядом с температурой»
Трек: `small` (лёгкий), ТЗ — тело issue, ревью ТЗ — [SPEC-REVIEW-196-r1](./SPEC-REVIEW-196-r1.md) (зелёный, r1/2).
Диапазон: `origin/dev..HEAD`, один коммит `d01d092` («feat: show humidity in room tooltips»).
Ревьюер: Claude, код-ревью. Автор реализации: Codex (см. хендофф в issue).

## Скоуп

Один коммит класса A+B+C+D:

- `src/houseplan-card.ts` — `_tip`/`_showTip` получают `hum?`, room hover передаёт `_roomHum(r)`, рендер тултипа добавляет строку `tip.hum_avg` между температурой и LQI.
- `src/i18n/en.json`, `src/i18n/ru.json` — ключ `tip.hum_avg`.
- `demo/smoke_ux_fixes.mjs`, `demo/smoke_room_settings.mjs` — расширены под AC1–AC3.
- `docs/USER-GUIDE.ru.md`, `docs/TESTING.md`, `docs/STATUS.md`, `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md` — обновлены в том же коммите.
- `dist/houseplan-card.js`, `custom_components/houseplan/frontend/houseplan-card.js`, `demo/srv/assets/houseplan-card.js` — три копии сгенерированного бандла.

Трейлеры коммита: `Issue: #196`, `User-Visible: yes`; оба changelog правлены в этом же коммите — соответствует §7.1/§10.2 PROCESS.md. Соответствует классам файлов из AGENTS.md (A/C/D в одном коммите допустимо, документация — часть DoD).

Скоуп не расширен: device tooltip и room label (уже показывают влажность) не тронуты, что и требовало ТЗ («не входит в задачу»).

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| unit | `npm test` | 900/900 pass |
| build + сверка бандлов | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js && cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | зелёный, три копии побайтно идентичны; `git status --porcelain` после сборки пуст — закоммиченный бандл уже соответствует источнику |
| целевой смок AC1–AC3 | `node demo/smoke_ux_fixes.mjs` | `OK`, все поля включая новые (`tipHum`, `tipHasHumLine`, `tipMetricOrder`, `tipPositionUnchanged`, `noHumidityOmitted`, `deviceTooltipHasNoHumidity`, `noHoverSuppressesTooltip`) — `true`/ожидаемые значения |
| целевой смок AC1–AC2 (override без HA-зоны) | `node demo/smoke_room_settings.mjs` | `OK`, включая `tooltipShowsHumiditySource`, `invalidHumiditySourceIsOmitted`, `humFromSourceAreaLess` |
| дисциплина «тест умеет падать» | пересборка `origin/dev` (без правки тултипа) во временном `git worktree` с теми же файлами смоков из HEAD, повторный прогон | оба смока **падают** предсказуемо: `smoke_ux_fixes` → `tipHum: expected 48, got undefined`, `tipHasHumLine`/`tipMetricOrder` → `false`; `smoke_room_settings` → `tooltipShowsHumiditySource: expected true, got false`. Подтверждает, что новые проверки не тавтологичны |

Гейты не прогонялись, и почему:

- **Полный набор `demo/smoke_*.mjs` (127 файлов)** — не прогонялся. Diff меняет ровно одну текстовую строку в одной существующей UI-поверхности (room hover tooltip); AC называют только `smoke_ux_fixes`/`smoke_room_settings`, оба прогнаны целевым образом. Остальные смоки не имеют отношения к тултипу комнат.
- **`npm run golden:verify`** — не прогонялся. Проверено чтением: единственные golden-сценарии, трогающие тултип-подсистему (`hover-over-glow-dark`, `hover-nested-room-dark` в `demo/golden/matrix.mjs:246-249`), реализованы в `demo/golden/harness.mjs:563-569` через прямую установку `card._hoverRoom = {...}` — это state оверлея подсветки периметра комнаты, а не `card._tip`. Реальный `mousemove` там не диспатчится, `_showTip()`/`_tip` не участвуют, значит новая строка влажности эти эталоны не задевает. Само ТЗ также утверждает «новый golden не требуется» — проверено, а не принято на веру.
- **`python -m pytest tests_backend -q`** — не прогонялся: ни один файл `custom_components/**/*.py` не изменён.
- **performance-профили** — не прогонялись: AC не называют перф-влияние, `_roomHum()`/`_climate()` — уже существующий кеш, новых подписок/сканов registry нет (см. ниже).

## Находки

Нет. High: 0, Medium: 0, Low: 0.

## Что проверено и корректно

- **AC1** (`tip.hum_avg` после температуры, до LQI, при валидной средней влажности зоны) — доказано смоком `smoke_ux_fixes` (`tipHasHumLine`, `tipMetricOrder`, `tipHum: 48`) и подтверждено регрессионным прогоном на немодифицированном `dev` (тест падает без правки).
- **AC2** (override `hum_source` без HA-зоны, без дублирования резолвера) — доказано смоком `smoke_room_settings` (`humFromSourceAreaLess`, `tooltipShowsHumiditySource`) и чтением кода: `_roomHum()` (`houseplan-card.ts:16796-16800`) — единственный резолвер, `_showTip` вызывает только его, никакой inline-логики источника в месте вызова (`:15645-15649`) нет.
- **AC3** (null/невалидный источник — строки нет; device tooltip без ложной влажности; `_noHover` не создаёт тултип) — доказано смоками (`noHumidityOmitted`, `invalidHumiditySourceIsOmitted`, `deviceTooltipHasNoHumidity`, `noHoverSuppressesTooltip`) и чтением: второй вызов `_showTip` (device tooltip, `:16749`) передаёт только `(e, d.name, metrics)` — три аргумента, `lqi/temp/hum` остаются `undefined`, регрессии в существующем контракте нет; guard `if (this._noHover) return;` (`:5766`, начало `_showTip`) не тронут.
- **AC4** (i18n-паритет EN/RU, typecheck/unit/build, три копии бандла) — доказано прогоном `npm test` (включает `test/i18n.test.mjs`, парность ключей), `npx tsc --noEmit`, `npm run build` + `cmp` трёх копий.
- **AC5** (нет новых HA-подписок/registry-обходов/config-writes/schema/backend изменений, скоуп не расширен) — проверено чтением: единственные изменения в `houseplan-card.ts` — тип `_tip`, сигнатура `_showTip` (новый последний опциональный параметр), один вызов `_roomHum(r)` в существующем hover-обработчике и два новых template-условия рендера. `_roomHum`/`_climate()` не изменены (не в diff), кеш `_climateCache` тот же. `custom_components/**` не тронут.
- **Позиционирование тултипа и существующие строки** (площадь, температура, LQI, цвет LQI) не изменились — `tipPositionUnchanged`, `tipHasArea`, `tipHasAreaLine`, `tipHasTempLine` зелёные.
- **Touch/View-контракт**: `docs/TOUCH-SUPPORT.md` не применяется — hover tooltip остаётся View-поверхностью без изменения touch-контракта; влажность и так видна в подписи комнаты без hover.
- **Документация**: `docs/USER-GUIDE.ru.md:173` — таблица режимов теперь перечисляет влажность в подсказке Просмотра, терминология («средняя влажность») совпадает с i18n-ключом и не изобретена заново. `docs/TESTING.md` — обе строки обновлены и помечены `[auto: smoke_...]` вместо прежнего `[manual]`, соответствует фактическому покрытию. `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` — по одной записи, ссылка на #196, формулировка соответствует контракту (источник/зона, скрытие при отсутствии данных). `docs/STATUS.md` — строка текущего цикла включает #196.
- **Трейлеры и changelog-дисциплина**: единственный коммит несёт `Issue: #196` и `User-Visible: yes`; оба changelog правлены в нём же — выполнено §10.2/AGENTS.md.

## Чего не проверял

- Полный набор из 127 браузерных смоков — обоснование выше (диффу и AC достаточно двух целевых).
- `npm run golden:verify` — не прогонялся; замена — чтение `demo/golden/harness.mjs`/`matrix.mjs`, подтвердившее отсутствие пересечения сценариев с `_tip`.
- Бэкенд (`pytest tests_backend`) — не затронут диффом.
- Ручной просмотр в браузере (в цикле нет фазы ручного тестирования; целевые смоки и чтение кода отвечают на вопрос «оно работает»).
- Производительность — вне AC, изменение не касается путей рендера, чувствительных к перфу.

## Вердикт

Зелёный. Все AC1–AC5 доказаны — либо целевым автотестом с подтверждённой способностью падать, либо чтением кода с явной пометкой. High/Medium/Low находок нет. Задача готова к слиянию в `dev`.
