# CODE-REVIEW-937-r1

Material: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD` at
**`7ee4a2ea6051777ff96189cde88c5fd3583c2c87`** (рабочая копия на этом SHA,
подтверждено `git rev-parse HEAD`). Трек `track:ask`, этап `code`, заход r1,
блокирующих циклов израсходовано 0/4.

Коммиты диапазона (все с `Issue: #937`, трейлеры корректны):

| commit | тема | User-Visible | changelog в этом же коммите |
|---|---|---|---|
| e44aaf47 | feat: migrate Easy Floorplan + current wall model | yes | да (ru+en) |
| 5708c6f0 | test: site deployment guard, input ownership | no | — |
| a0d5b5a3 | fix: value identity, malformed flags | yes | да (ru+en) |
| 7c0db5cf | test: backend version proof без npm install | no | — |
| 9a16c48a | test: все mapped symbols, virtual duplicate imports | no | — |
| 7ee4a2ea | fix: real target limits, effective space settings | yes | да (ru+en) |

## Скоуп

Issue #937 (ТЗ редакция 3, зелёное `SPEC-REVIEW-937-r2`, M1 закрыта): обновление
внешнего конвертера `/convert/` — актуальная модель House Plan (v10) для
Sweet Home 3D и новый источник Easy Floorplan с расширенным переносом
(устройства, entity/Area-привязки, мебель/тексты/подложки, свет) и
автоматическим масштабом. Служит J4 `docs/SCOPE.md` (администратор с готовым
планом не рисует его заново). Диапазон не трогает `src/**` — никакого
изменения рендера карточки; весь диф — `scripts/sh3d-convert/**`,
`demo/smoke_plan_converter.mjs`, тесты Node/Python, документация,
release-ledger.

Release-ledger `docs/release-ledger/v1.81.0/937.json`: `category: major`,
обоснование — новая пользовательская возможность с geometry/HA-bindings,
корректно отделена от прошлого stable; `summary.ru/en` заполнены (это было
причиной одного из технических возвратов автора до модели — на момент этого
ревью поле присутствует и содержит содержательный текст). Классификация
обоснована и не выведена механически из `User-Visible`.

## Как проверялось

Прогон `Validate` на этом SHA зелёный
(https://github.com/Matysh/houseplan-card/actions/runs/38983373735,
`headSha=7ee4a2ea6051777ff96189cde88c5fd3583c2c87`, `conclusion=success`).
Разобрал его job-ы персонально: `heavy=false` на пуше в task-ветку (не
`dev`/`main`), поэтому job «Смоки в браузере», golden и perf-smoke были
**skipped**, а не выполнены — это ожидаемая экономия конвейера (§8:
«полные наборы — предрелизный гейт»), но не доказательство browser-smoke AC.
Реально выполненными на этом SHA в Validate были: typecheck+build (job
«Фронтенд»), полный `npm test`, и **полный** `pytest tests_backend/` с
настоящим HA-harness — job «Бэкенд: pytest в Home Assistant» → `1512 passed,
1 skipped`, лог подтверждает установку `homeassistant==2026.8.3` и реальный
сбор `test_ha_*` (не «NOT collected»).

Поскольку AC7–AC9 называют browser-smoke как метод доказательства, а Validate
его не прогонял на этом SHA, прогнал его сам:

| Гейт | Команда | Результат |
|---|---|---|
| typecheck+build | `npm run build` | OK (`tsc --noEmit && rollup -c`, bundle собран) |
| bundle budget | `node scripts/bundle-budget.mjs` | OK, в пределах потолка |
| монолит/связность | `node scripts/unused-locals-gate.mjs` | OK; `bundleBytes` 2972702 факт vs 2972707 заявленных в базе — в пределах, `info`, не `fail` |
| генератор geometry-runtime | ручная проверка `syncGeometryRuntime(check=true)` | `OK: runtime up to date` — закоммиченный `geometry-runtime.generated.mjs` не разошёлся с каноническими TS-модулями и бэкенд-константами |
| юниты конвертера | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/sh3d-convert*.test.mjs test/easy-floorplan-*.test.mjs test/converter*.test.mjs` | **39/39 PASS** |
| browser-smoke (AC7/AC8/AC9) | `node demo/smoke_plan_converter.mjs` | **PASS** (пиновый `chromium-headless-shell 151.0.7922.34 rev1234`; SH3D+Easy file/paste, YAML, download parity, source/input races, stale click, RU/EN, offline, 360px) |
| статическая готовность мутантов | `node scripts/mutation-gate.mjs --check` | OK: `plan-converter-forgets-input-generation` зарегистрирован корректно (patch `find` встречается в `page/app.mjs` ровно один раз), `execution=0` (nightly-only, не caught локально — по общей политике это ожидаемо) |
| полный локальный гейт | `npm run gate:small` (на этом SHA, в этой рабочей копии) | **PASS, 244 с, упало 0** — build+typecheck, no-new-any, render-layout-read, private-write guard, полный `npm test`, bundle integrity/budget, lint:unused |

**Чего не проверял:** ручной GPU-прогон демо на реальном дисплее (не требуется,
#929); полные golden/perf-наборы (diff не меняет рендер карточки, `ci:golding`
не требуется); фактическую выкладку сайта на `demo/dev` (явно отложена автором
до S8, вне материала этого ревью); исчерпывающую сверку каждого значения
`EASY_FURNITURE` с актуальным `easy-floorplan` апстримом построчно — доверился
тесту `#937 every mapped furniture ID exists in the actual canonical HP
catalogue` плюс тому, что таблица стилей по ТЗ §14 — техническое решение,
изменяемое по усмотрению автора/ревьюера.

## Разбор по AC (чтением + исполнением)

Для каждого AC — доказательство найдено, тест умеет падать (проверено
чтением негативных ветвей и/или выполнением), защитные AC имеют названного
красного свидетеля:

- **AC1** (`sh3d-convert.test.mjs`, pytest). `convert.mjs` теперь зовёт общий
  `modernDocument`/`commitWallSegmentModel` (переиспользован из
  `easy-geometry.mjs`/`output.mjs`), `MODEL_VERSION = CURRENT_MODEL_VERSION`
  (10, не захардкожено). Независимые стены и wall-only floor больше не
  отбрасываются (`!rawRooms.length && !walls.length`, было `!rawRooms.length`).
  Чем краснеет: тест `partition limit` (`test/converter-output.test.mjs`) был
  явно RED до фикса (2001 partition проходил без исключения) — автор это
  зафиксировал и я прочитал тест: `assert.throws(..., 'output_too_complex')`,
  лимит берётся из реальной бэкенд-константы `MAX_PARTITIONS` через
  `build-runtime.mjs` (regex-чтение `validation.py`, без дублирования числа).
- **AC2** (T-узел). Прочитал `test/easy-floorplan-geometry.test.mjs` целиком:
  тест `explicit T-junction: wall end meets the MIDDLE` строит ровно
  требуемую M1-фикстуру (конец стены к середине другой), проверяет 7 атомов,
  3 инцидентных на T-узле, ровно один 2-owner carrier, 0 partitions (без
  задвоенной кладки). `atomizeSourceWalls` (easy-geometry.mjs:68) режет по
  реальным пересечениям/перекрытиям, конфликт толщины на общем атоме кидает
  `easy_thickness_conflict` (не «первый элемент массива» — порядок стен `a`/`b`
  в тесте `rectangle sideWalls...` специально переставлен так, чтобы порядковое
  решение провалило бы тест). Self-intersection и wall-only T тоже покрыты.
- **AC3** (масштаб). `easy-scale.mjs` реализует точно объявленный приоритет:
  медиана обычных одностворчатых дверей (исключены roll/double/slide через
  фильтр `motion`/`sash`), иначе медиана соотношений мебели (исключены
  rug/stairs и неизвестные типы через `easyFurnitureSymbol`), иначе `1
  cm/unit`. Отрицательные/неконечные размеры отфильтрованы `positive()`.
  Тест `easy-floorplan-read.test.mjs` покрывает все три ветки и исключения.
- **AC4/AC5** (маппинг устройств/контента). Прочитал `easy-markers.mjs`,
  `easy-content.mjs`, `easy-style.mjs` построчно. Ключевой фикс коммита
  a0d5b5a3 подтверждён кодом: если `badgeEntity` указан явно и не резолвится
  ни в одно reading, `selected` остаётся `undefined` и ветка `!selected`
  уходит в `badge_source_missing`, **не** в фоллбэк на другую сущность —
  тест `#937 a missing explicit badge source never silently becomes another
  entity` проверяет это прямым утверждением `display === 'badge'` и
  `value_source === undefined`. `booleanAt` кидает на нечисловые/нестроковые
  флаги (было `'false'`/`'true'` строками — тест это ловит). `literalCaption`
  экранирует `{}` символами `❴❵`, тест подтверждает, что `{lock.front}` не
  становится живым шаблоном. `safeImageReference` отклоняет data:/javascript:/
  protocol-relative/credentials-в-URL и **нормализует** `/local/../..`-обход
  через `URL`, так что traversal не проходит (проверил вручную логику
  построения URL — нормализация `..` происходит до сравнения с `/local/`).
- **AC6** (реальный HA backend). `tests_backend/test_ha_easy_floorplan_convert.py`
  — настоящий `hass`-fixture, `create_preview`/`ws_import_apply.__wrapped__`/
  `create_export`/`CONFIG_SCHEMA`, без подмены валидатора. Параметризован по
  4 golden-файлам. Проверяет: старое пространство и `settings` не меняются,
  `duplicate_policy=skip/virtual` работает (включая `virtual` создание копий
  с `binding: 'virtual'`), экспортированный документ проходит `parse_document`
  обратно.
- **AC7** (отказ на враждебный вход, race). `easy-read.mjs` закрывает алиасы,
  директивы, `__proto__`/`constructor`/`prototype`/`<<`, non-finite,
  unique-keys, глубину/число узлов/геометрию до дорогого прохода. Race:
  `page/app.mjs` — `generation`-токен проверяется после каждого `await`
  (`handleFile`) и перед скачиванием (кнопка проверяет
  `token === generation && lastResult === result`); зарегистрированный
  мутант `plan-converter-forgets-input-generation` целится ровно в этот
  инкремент и **не исполнялся** локально (общая политика, nightly-only) —
  честно отражено в комментариях автора и здесь.
- **AC8/AC9** (офлайн, сайт). Сам прогнал `demo/smoke_plan_converter.mjs` —
  PASS, ноль HTTP-запросов, RU/EN, 360px. `site-page.mjs`/
  `test/converter-site.test.mjs`: сохранение стороннего wrapper (Google/
  Yandex), отказ на неожиданный layout/задвоенный wrapper/уже обёрнутый
  артефакт/неполный commit SHA — все четыре негативных случая в тесте.
  Фактическая раскладка явно отложена автором до после S8 (не входит в
  материал этого ревью).

## Находки

Нет. High: 0, Medium: 0, Low: 0.

Корректность геометрии, безопасность разбора входа, переиспользование
канонического писателя стен (без дублирования алгоритма), honesty-отчёт
потерь, защита от гонки/приватности и сайт-деплоймент — всё проверено чтением
и, где это оправдано AC, исполнением с подтверждённым красным свидетелем. Явно
искал типичные ловушки такого диффа — угадывание host по первому элементу
массива, подмену entity при отсутствии явного reading, обрезание пути
`/local/../..`, молчаливое поглощение независимых стен, захардкоженные лимиты
вместо бэкенд-констант — ни одна не подтвердилась: все учтены явным кодом и
тестом.

## Побочные находки

Доверенный снимок политики:
`{"schema":"houseplan-outside-findings-policy/v1","mode":"issues",...}`.
Побочных находок вне скоупа issue #937 нет — новые issue не заводились.

## Вердикт

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 → в задаче

Маршрут: `fix` (трек `ask`, `reclassify` неприменим вне `show`).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/937-plan-converter`, коммит `7ee4a2ea6051` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `fd4478074a267eebb33bd149d43dfb9d6daabca5`
  ```
  git log --all --format='%H %T' | grep fd4478074a26
  ```
- Тело issue: `681132ec128c8b811fcfcb3ca432c085896c39b385723c27925e6f71b3045cd9`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ3ODQsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0ODY5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxNDgsIm91dHB1dF90b2tlbnMiOjM4NjYyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjI1OTcyMSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjEyNjcyNjA5LCJjb3N0VXNkRXN0aW1hdGUiOjMuOTYwMzIxNzk5OTk5OTk5Nn1dLCJ0dXJucyI6ODYsImR1cmF0aW9uTXMiOjcxMTA2NSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjMuOTY1MTkwOCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4932 output_tokens=38679 cache_creation_input_tokens=259721 cache_read_input_tokens=12672609 num_turns=86 -->
