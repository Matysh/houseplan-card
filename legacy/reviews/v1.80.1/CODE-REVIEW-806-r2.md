# CODE-REVIEW-806-r2

Issue: #806 · Трек: ask · Этап: code-review · Заход: r2 · блокирующих циклов израсходовано 1/4
Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`
**SHA материала: `16f5a30f62bc5d15f3f0161cc7c52457c144b7a2`** (рабочая копия на нём).

## Скоуп

Три новых коммита поверх r1 (`7812a26f`), на той же ветке `issue/806-battery-shadow-optout`:

1. `1d2d23f1` `test(golden)` — добавляет в `GOLDEN_SCENARIOS` четвёртую battery-сцену
   `device-battery-board-medium`: тот же `batteryBoard: 'desktop'`, но
   `bgMode: 'static', bgColor: '#808080'`, `theme: 'light'` — явный нейтрально-серый
   фон, не третья тема оформления. Тест на 4 сцены вместо 3, с проверкой `bg_mode`/
   `bg_color` в собранном fixture.
2. `3bfd3f41` `test(golden)` — усиливает ту же сцену: добавляет `fillMode: 'custom',
   customFill: { c: '#808080', a: 1 }`, то есть красит не только внешний `bg_color`
   фона страницы, но и заливку самой комнаты (`fill_mode`/`custom_fill` на уровне
   `space.settings`), которая в фикстуре `battery-room` покрывает весь `viewBox`
   `[0,0]×[1,1]` — ровно там, где стоят battery-маркеры. Тест расширен проверкой
   обоих полей в собранном fixture.
3. `16f5a30f` `chore(golden)` — принимает новый эталон `device-battery-board-medium.png`
   (сцена новая, не замена существующей), обновляет `baselines-index.json`
   (105→110 witnesses, полная матрица 205 сцен — совпадает с фактическим
   `GOLDEN_SCENARIOS.length`). `Release:`/`Baseline-Reviewed-Local:` трейлеры на
   месте, локальный хеш `d5e785e7…` совпадает с `localAttestation.sha256` индекса.

Это ровно адресная правка единственной находки r1 (Medium, в скоупе): AC1 ТЗ требует
доказательства тени «на светлом, среднем и тёмном фоне» тремя golden/crop-фонами, а
во всём harness существовало только два значения `theme`. Остальной код (формула
тени, политика показа, backend-схема, i18n, трейлеры) с r1 не менялся — диффа по
`src/**`/`custom_components/**` в этом раунде нет вовсе (см. `git diff --stat
7812a26f..16f5a30f` ниже).

Риск по участкам из промпта (трек `ask`) не изменился с r1 — файлы и строки те же,
в этом раунде не тронуты:

| Класс | Участок | AC ТЗ | Вывод |
| --- | --- | --- | --- |
| migration | `validation.py:2004`, `types.ts:256` | AC3 («round-trip… schema/config lifecycle») | покрыт (не менялся с r1, см. «Унаследовано из r1») |
| perf | `devices.styles.ts:269` (`filter: drop-shadow`) | §8 (browser-smoke 200 battery-маркеров) | покрыт (не менялся с r1) |
| ux | `marker.hide_battery` в de/en/fr/ru.json:835 | AC3 (RU/EN/DE/FR строки) | покрыт (не менялся с r1) |

## Как проверялось

Validate на `16f5a30f` зелёный
(https://github.com/Matysh/houseplan-card/actions/runs/37504094255) —
`typecheck`/`npm test`/`npm run build`+`bundle-policy --verify` и бэкенд-`pytest`
(workflow несёт отдельную job `pytest в Home Assistant`) приняты без повторного
прогона целиком.

Дельта этого раунда — только golden/test-файлы, поэтому объём гейтов сузился до
проверки самой дельты (§8):

| Гейт | Команда | Результат |
| --- | --- | --- |
| `git diff --stat 7812a26f..16f5a30f` | — | `baselines-index.json` (21 строки), новый `device-battery-board-medium.png`, `matrix.mjs` (+6), `golden-battery.test.mjs` (+21/-4); ни одного файла `src/**`/`custom_components/**` — дельта ровно та, что заявлена в commit message |
| Целевой unit (test-build) | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/golden-battery.test.mjs` | 9/9 pass, 0 fail |
| Мутационная проверка находки r1 (сцена красит тест) | вручную заменил в рабочей копии `bgColor: '#808080'` на `'#ffffff'` в новой сцене, перезапустил тест, вернул файл | `#806 battery shadow matrix has an explicit neutral medium background witness` — `not ok`, тест ловит потерю серого фона немедленно |
| Визуальная проверка нового эталона | открыл `demo/golden/baselines/device-battery-board-medium.png` | нейтрально-серая (`#808080`) плоскость на весь кадр, четыре состояния battery на трёх размерах поверх неё — не светлый и не тёмный крайний тон |
| Счётчик сцен в commit message | `node -e "import('./demo/golden/matrix.mjs').then(m=>console.log(m.GOLDEN_SCENARIOS.length))"` | `205` — совпадает с «Полная матрица: 205 сцен» в сообщении коммита `16f5a30f` |
| Трейлер-аттестация | сверка руками | `Baseline-Reviewed-Local: sha256:d5e785e7…` дословно равен `localAttestation.sha256` в `baselines-index.json` |

### Чем краснеет (AC1, остаток находки r1)

| AC | Чем доказан | Чем краснеет |
| --- | --- | --- |
| AC1, третий (средний) фон | `test/golden-battery.test.mjs`: `#806 battery shadow matrix has an explicit neutral medium background witness` (проверяет `theme`, `bgMode`, `bgColor`, `fillMode`, `customFill` сцены и те же поля в собранном fixture `settings`), golden-эталон `device-battery-board-medium.png` | убрать/сменить `bgColor`/`customFill` сцены — тест красится немедленно (проверено мутантом выше, не гипотетически); убрать саму сцену — красится счётчик `boards.length === 4` и `deepEqual` списка id в первом тесте файла |

## Находки

Нет. Единственная находка r1 (Medium, в скоупе) закрыта по существу, не
косметически: добавлена четвёртая golden-сцена с независимо проверяемым
нейтрально-серым фоном (и внешний `bg_color`, и заливка самой комнаты под
маркерами — то есть серый фон гарантирован на уровне пикселей, а не только
метаданных сцены), новый эталон принят отдельным `chore(golden)`-коммитом с
корректной аттестацией, тест демонстрируемо красится при потере защиты.

## Что проверено и корректно

- Новая сцена `device-battery-board-medium` — третий, самостоятельный фон
  (`#808080`), а не вариация существующих light/dark тем и не повтор «мобильного
  масштаба», который в r1 ошибочно закрывал этот пункт.
- Серый фон применяется и через `bg_mode`/`bg_color` (общий фон страницы), и
  через `fill_mode: 'custom'`/`custom_fill` на `space.settings` — у
  `battery-room` `poly` покрывает весь `view_box` `[0,0]×[1,1]`, то есть заливка
  комнаты реально оказывается под battery-маркерами на скриншоте, а не только в
  конфиге. Визуально подтверждено: эталон — сплошная серая плоскость на весь
  кадр.
- Паттерн `fillMode: 'custom'`/`customFill` для принудительного цвета
  фона/заливки уже используется в `matrix.mjs` для десятков других сцен
  (`device-presentation`, decor-glow и т.д.) и в `harness.mjs:706-723` как общий
  механизм — не изобретение нового скрытого пути ради одной сцены.
- `baselines-index.json`: `witnesses.count` вырос 105→110, добавлена одна
  строка `scenarios["device-battery-board-medium"]`, остальные хеши в дифф-окне
  не менялись (никакая из четырёх ранее принятых в r1 сцен не затронута
  повторно).
- Трейлеры трёх новых коммитов: `Issue: #806`, `User-Visible: no` (верно — нет
  видимого пользователю изменения, это тестовая инфраструктура),
  `Release: v1.80.0-beta.6`; `Baseline-Reviewed-Local` только на
  golden-коммите, который не трогает `src/**`/`custom_components/**/*.py`
  (правило `process-gate` п.6, то же что и в r1).
- Остальной код (формула тени, предикат показа, backend-схема, i18n, документация)
  не менялся с r1 — дифф между `7812a26f` и `16f5a30f` ограничен четырьмя
  golden/test-файлами (см. таблицу «Как проверялось»), поэтому находки r1 вне
  AC1-фона не применимы повторно и не требуют новой проверки.

## Чего не проверял

- Полный `npx tsc --noEmit`/`npm test`/`npm run build`+`bundle-policy --verify`
  целиком — принято по зелёному Validate на точном SHA `16f5a30f` (ссылка выше),
  разрешено §8 при совпадении SHA.
- `pytest tests_backend` исполнением — по-прежнему нет `voluptuous`/харнесса
  локально; в этом раунде это не риск, так как дифф не трогает ни один
  backend-файл (см. `git diff --stat` выше), а Validate на этом SHA несёт
  отдельную зелёную job `pytest в Home Assistant`.
- `golden:verify`/`golden:capture` целиком (полная матрица 205 сцен) — не
  гонялась; сверил точечно только новую сцену и то, что остальные записи
  индекса не менялись в этом диффе.
- Производительность (`demo/smoke_device_battery_performance.mjs` и полная
  матрица бенчмарков) — не перегонял повторно: дифф раунда не затрагивает
  `devices.styles.ts`/`device-battery-geometry.ts`/рантайм, perf-риск не
  изменился с r1, где смок уже зелёный.
- Ручного тестирования в браузере, помимо просмотра PNG-эталона, не было.

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
| --- | --- | --- |
| Medium: AC1 требует доказательства тени на светлом/среднем/тёмном фоне golden/crop-сравнением трёх фонов, а harness поддерживал только два значения `theme`; четыре принятых в r1 golden-сцены давали ровно два различных фона (mobile/zigbee-overlap — тот же тёмный тон на другом масштабе) | Добавлена пятая golden-сцена `device-battery-board-medium` с независимым нейтрально-серым фоном (`bgColor`+`customFill` = `#808080`), закреплена отдельным тестом, принята golden-коммитом с валидной аттестацией; подтверждено мутантом, что тест красится при потере защиты | `demo/golden/matrix.mjs:899-903` (сцена), `test/golden-battery.test.mjs:28-56` (assertions), `demo/golden/baselines/device-battery-board-medium.png` + `baselines-index.json` (эталон и хеш), коммиты `1d2d23f1`/`3bfd3f41`/`16f5a30f` |

## Унаследовано из r1

Без повторной проверки в этом раунде принято (дифф `7812a26f..16f5a30f` эти файлы
не затрагивает):

- Формула тени (`deviceBatteryShadow`, контрольные точки 19px→.7/1.8/1.3,
  56px→1.6/3.6/3.2) и её дублирование в CSS `calc()` — `docs/reviews/CODE-REVIEW-806-r1.md`,
  раздел «Что проверено и корректно», SHA `7812a26f`.
- Политика показа (`global && !hide_battery && !effectiveHidden`,
  `device-presentation.ts:760`), единый предикат `showMarkerBatteryOf` между
  save/preview/presentation — там же, SHA `7812a26f`.
- Backend-схема (`vol.Optional("hide_battery"): bool`, строгий `isinstance`,
  `support_package._project_marker` не протаскивает нестрогие значения),
  `tests_backend/test_marker_hide_battery.py` — там же, SHA `7812a26f`
  (разобрано чтением; окружения с `voluptuous` по-прежнему нет).
- `scripts/config-schema.json` синхронизация и `test/config-schema-parity.test.mjs`
  — там же, SHA `7812a26f`.
- i18n RU/EN/DE/FR, секция `card_appearance`, оба `USER-GUIDE*`/`CHANGELOG*` в
  коммите с `User-Visible: yes` — там же, SHA `7812a26f`.
- Трейлеры коммитов класса A/B первых трёх коммитов задачи и правило
  «`Release:` не трогает `src/**`/`*.py`» — там же, SHA `7812a26f`.
- Из этапа ТЗ: весь текст ТЗ, зелёный на `docs/reviews/SPEC-REVIEW-806-r2.md`
  (принято в r1 без повторной проверки, тело issue с тех пор не менялось).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/806-battery-shadow-optout`, коммит `16f5a30f62bc` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `f9fcdbe056bfb3af4cc170476d538882e65c0ff2`
  ```
  git log --all --format='%H %T' | grep f9fcdbe056bf
  ```
- Тело issue: `78874c4b29e42011cd8d9fc46caaa3ae6df2365f98da3f9b058b1420d2a240de`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4270 output_tokens=18504 cache_creation_input_tokens=75651 cache_read_input_tokens=1895316 num_turns=35 -->
