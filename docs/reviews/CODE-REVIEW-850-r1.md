# CODE-REVIEW-850-r1

Issue: #850 · Трек: ask · P2 · Заход: r1 · блокирующих циклов израсходовано 0 из 4
Материал: `74b462f4d921838ef330bcf51588c9073c374f7d` (ветка `issue/850-sensor-tick-work` поверх `dev` `414d3378`)

## Скоуп

ТЗ (редакция 2 от 14.10.2026, принята зелёным вердиктом спек-ревью r2) требует убрать
доказанную лишнюю работу тика датчика с плана на большом доме: пересборку снимка
рендера (2×N презентаций, глубокое копирование), LED-кадра и трубок, геометрического
отпечатка преград света и графа источников света — без изменения картинки, без
глобального throttle, без снижения качества, с сохранением гарантий TOUCH-SUPPORT и
политики LED #789. AC1–AC6 (`## ТЗ` → «Критерии приёмки»).

Диапазон материала: `git log --oneline origin/dev..HEAD` — 10 коммитов
(`5ad68fff` … `74b462f4`). `git diff --stat origin/dev...HEAD`: 41 файл,
+2340/−265, из них продуктовый код — `src/render-snapshot-capture.ts` и
`src/render-snapshot-reuse.ts` (новые модули), `src/houseplan-card.ts` (захват снимка
вынесен, −164 строки чистого диффа), `src/led-strip-runtime.ts`, `src/live-interaction-runtime.ts`,
`src/glow-scene.ts`, `src/devices.ts`, `src/ha-binding-status.ts`,
`src/render-device-snapshot.ts`, `src/houseplan-render-lifecycle.ts`,
`src/houseplan-editor-runtime.ts` (1 строка, тип параметра).

## Риск по изменённым участкам (#707, трек ask)

- **touch** (`src/live-interaction-runtime.ts`): весь диапазон изменений в этом файле
  прочитан целиком (не только указанные строки 41–47). Правки — только новые
  приватные поля (`capture`, `fingerprints`, `geometryBuilds`), метод `geometry()`
  (кэш архитектурного отпечатка по записи/эпохе/масштабу) и `work()` (счётчики).
  Ни хендлеры указателя, ни `hover()`, ни `viewport()` не тронуты. Покрыто ТЗ прямо:
  «Производительность и touch» → «Наведение не меняется», «View и kiosk на touch
  сохраняют гарантии TOUCH-SUPPORT» — и кодом: `dispose()` сбрасывает оба новых поля
  (`capture.reset()`, `fingerprints = new WeakMap()`), то есть кэши не переживают
  отключение. Класс покрыт AC ТЗ — не нашёл несовпадения.
- **perf** (`glow-scene.ts`, `houseplan-render-lifecycle.ts` и ещё 265 строк): это
  буквально предмет задачи, покрыт AC1–AC6 целиком. Прочитаны все перечисленные в
  ТЗ «Файлы и модули» продуктовые файлы построчно (см. «Как проверялось» ниже).

Оба класса покрыты AC ТЗ. `route: fix` подтверждаю.

## Как проверялось

**Дешёвые гейты** — не перегонял, использовал зелёный Validate на точном SHA
материала (`74b462f4`, run
[38578718732](https://github.com/Matysh/houseplan-card/actions/runs/38578718732),
`conclusion: success`). Проверил состав джобов: «Фронтенд: типы, юниты, мутанты,
синхрон бандла» — success (typecheck, `npm test`, mutation-gate --check, bundle
sync), «Перф-смок: бюджет времени кадра» — success, три шарда «Смоки в браузере» —
success. Джоб golden («Golden-кадры против принятых эталонов») в этом прогоне
**skipped**, а «Переиспользование: это дерево уже проверено» — success: дерево,
влияющее на рендер (класс `visual`/`render`, см. метку `ci:golden` в комментариях
issue), не менялось между `f3151b19` (где полный Validate с golden прошёл зелёным,
подтверждено в хендоффе автора) и `74b462f4` (два следующих коммита трогают только
`demo/smoke_wall_node_connected.mjs` и `docs/DEVELOPMENT.md`) — переиспользование
golden-доказательства законно, не повторяю.

Итого не перегонял: `npx tsc --noEmit`, `npm test`, `npm run build`+`bundle-policy
--verify`, `golden:verify`, перф-смок — все подтверждены зелёным Validate/reuse на
точном SHA.

Сам прогнал: `node scripts/mutation-gate.mjs --check` — локально на этом SHA,
структурная проверка (не исполнение, мутанты по правилам #850/§5 ночью не гоняются):
все 12 новых мутантов `#850` (`led-frame-key-*`, `led-field-paints-previous-frame`,
`led-release-keeps-frame-and-tubes`, `snapshot-*`, `light-*`, `tick-counter-missing-passes`)
— `ok`, патчи накладываются на названные строки. Это не замена исполнения, оно
ночное (#709), но подтверждает, что реестр не рассинхронизирован с кодом.

**Чего не проверял:** не исполнял мутанты (ночной прогон, не гейт ревью); не
перезапускал Full Performance (CI); не запускал HA pytest (Python не менялся в
этом диффе); не трогал ветку — ревью идёт по диффу `origin/dev...HEAD` и чтению,
без собственного запуска браузерных смоков (все уже зелёные в Validate на этом SHA).

**Чтением, не исполнением**, разобраны:
- `src/render-snapshot-capture.ts`, `src/render-snapshot-reuse.ts` целиком — механизм
  инкрементального снимка (две двухуровневых группы входов — source key / presentation
  key, Proxy-трекинг прочитанных строк `states`, fail-open при `ownKeys`/итерации,
  «lend»-перенос клонов при смене презентационного входа без смены source key).
  Прослежена логика `present()`/`fresh`/`deps` по обоим вариантам `showLqi`: при
  необходимости пересборки одного варианта второй вариант того же устройства тоже
  принудительно пересобирается в это окно (`fresh` выставляется на первом промахе),
  поэтому `deps` на конец окна — всегда объединение чтений обоих вариантов, потерь
  зависимостей между окнами не нашёл.
- `src/led-strip-runtime.ts` — двухуровневый ключ кадра (`pass` — быстрый путь при
  той же HA-проекции; `key` — состав источников света, состояние строк источников/
  primary полос, JSON-слепок содержимого `led_strips`/`room.settings` для правки
  «на месте»); сохранение модели трубки по `strip.id`+`marker`+`points` между
  пересборками кадра; освобождение только тех трубок, которые новый кадр больше не
  рисует.
- `src/devices.ts` — `lightGraphOf`/`resolvedLightSources`: `lightStateFingerprint`
  сужен до управляемых (`light.*`/`switch.*`) собственных/привязанных/forced
  сущностей и controls, кэш по identity `hass.entities`, кэш одного устройства по
  самому устройству (`owner = devices.length === 1 ? devices[0] : devices`),
  `lightPass`-разделение одного разрешения на проход рендера.
- `src/ha-binding-status.ts` — `activeRegistryHass(..., same)`: при совпадении
  `haRegistryBuildSignature` новый вызов наследует старые `devices`/`entities`
  объекты по ссылке. Это необходимая опора: без неё `hass.entities`/`hass.devices`
  получали бы новую идентичность на каждом HA-тике и ключи reuse-окна/кэшей света
  промахивались бы всегда, несмотря на остальной механизм — проверил, что
  `_planHassMemo` (houseplan-card.ts:4556–4567) и `intakeHass`
  (houseplan-render-lifecycle.ts:90–96) согласованы: новый кадр обнуляет только
  `.hass`-ключ памятки, не `sig`/`active`/`full`, так что лендинг срабатывает.
- `src/glow-scene.ts` — `lightPass.map` разделяет одно разрешение графа между
  комнатными вызовами одного прохода (`LightBarrierPass.run`), `geometryFingerprint`
  передаётся вызывающей стороной вместо пересчёта внутри.
- `src/render-device-snapshot.ts` — `entities: previous?.entities ?? cloneFact(...)`
  безопасно только потому, что идентичность `registry?.entities` — часть source key
  reuse-окна (п. выше); проверил, что это действительно так.
- Удаление параметра `designPreview` из `_devicePresentation` (houseplan-card.ts,
  houseplan-editor-runtime.ts): на `origin/dev` ни один вызов `_devicePresentation`
  не передавал третий аргумент (`grep` по всем вызовам) — мёртвый параметр, не
  регрессия.

**Проверено исполнением (через Validate на этом SHA, не локально):**
`test/render-snapshot-incremental.test.mjs` (дифференциальный оракул AC3, 250
случайных тиков + 4 отдельных теста на структурные/in-place правки — реальный
рандомизированный оракул на `large-house`, сравнивает инкрементальный снимок с
полной пересборкой на каждом тике, не заглушка); `test/led-strip-runtime.test.mjs`,
`test/led-strip-path-cache.test.mjs` (AC2, покадровая проверка входов по одному);
`test/devices.test.mjs`, `test/glow-scene.test.mjs` (AC4, включая явный тест на 20
комнатных вызовов = 1 разрешение); `demo/smoke_sensor_tick_freshness.mjs` (AC5,
браузерный смок на реальном `page.evaluate`, не моках); `demo/performance/
sensor-tick-scenarios.mjs` + `budgets-led-strips.json` (AC1/AC2/AC4, точные нулевые
бюджеты по сценариям S0/S1/S1b/S2, `S2` сознательно не включает `lightResolutions`/
`staleStripes`-исключения в нулевой бюджет там, где по ТЗ ожидается пересчёт —
согласовано с AC4(б) «S2 — разрешение пересчитано»).

## Защитные AC — таблица «чем доказан/чем краснеет»

Таблица AC1–AC6 уже в теле issue (раздел «Критерии приёмки») с третьим столбцом
«Чем краснеет на dev / мутант», принятым зелёным спек-ревью r1/r2 (единственный
Medium спек-ревью про AC4(а) закрыт в r2, проверено ранее — способ доказательства
камеры/hover назван и технически существует). Для код-ревью сверил соответствие
кода и тестов каждой строке:
- AC1 — `sensor-tick-scenarios.mjs` считает точные счётчики и падает закрыто при
  отсутствующем счётчике (мутант `tick-counter-missing-passes`, проверен
  `mutation-gate --check`, смотрел тело мутанта: `continue` вместо `failures.push`
  на отсутствующем счётчике — корректно воспроизводит «слепой» баг старого
  `recomputesOnHaTicks`).
- AC2 — `led-frame-key-without-icon-size`, `led-frame-key-holds-plan-hass`,
  `led-frame-key-without-source-state`, `led-frame-key-without-record-content` —
  каждый патчит ровно ту строку ключа/условия, которую описывает соответствующий
  пункт AC2 контракта п.4; guard-команды именуют конкретный тест.
- AC3 — `snapshot-battery-read-untracked`, `snapshot-state-read-unrecorded`,
  `snapshot-ignores-records-edited-in-place` — три независимых способа превратить
  чтение в непрослеженное (обход `createDeviceBatteryContext` мимо трекнутой
  проекции, снятие `record()` в Proxy-геттере, снятие JSON-слепка содержимого
  записей) — оракул реально ловит все три (тест «в оракул входят in-place edits»
  прочитан выше, это не декларация).
- AC4 — `light-geometry-memo-by-floor-id` (кэш по id этажа вместо identity записи —
  ловит именно баг «правка стены не обновляет свет» из описания), `light-state-
  without-controller-row` (исключение controls из состояния — лампа не гаснет).
- AC5/AC6 — `led-field-paints-previous-frame`, `led-release-keeps-frame-and-tubes` —
  оба используют `demo/smoke_sensor_tick_freshness.mjs`/`test/led-strip-path-cache.
  test.mjs` как свидетеля, оба файла реально существуют и содержат соответствующие
  проверки (прочитаны).

Пустых третьих столбцов не нашёл; «тест умеет падать» подтверждено для выборки
мутантов чтением патча и целевого теста (не полным прогоном всех 12 — ночной гейт).

## Трейлеры, changelog, release-ledger

Все 10 коммитов несут `Issue: #850`; `User-Visible: yes` ровно у одного —
`7e08d50a` («perf(snapshot): rebuild only the presentations…») — и в этом же
коммите правки `docs/CHANGELOG.md`+`docs/CHANGELOG.ru.md` (проверено `git show
--stat`/`git show -- docs/CHANGELOG*`). Формулировка одна и та же RU/EN, совпадает
с черновиком summary из ТЗ дословно. Остальные девять коммитов — `User-Visible: no`,
без изменений вовне.

`docs/release-ledger/v1.80.1/850.json`: `category: "stable-fix"`, обоснование
называет конкретные горячие пути, уже существовавшие в v1.80.1 (ключ LED-кадра по
`_renderPlanHass`, 2×N презентаций с глубокой копией на каждый тик, отпечаток
преград на каждый проход) — соответствует авторской классификации из ТЗ
(«Release-артефакты»). Это исправление существующего поведения stable-линии, не
новая бета-функция — `introducedBy` не требуется. Не нахожу расхождения с
фактическим диффом.

**Одно число — один источник (§8):** RU/EN summary в `850.json` и в обоих
CHANGELOG — один и тот же текст, не два независимых источника. Числовые метрики
профиля (AC1) живут только в `demo/performance/README.md` и в хендоффах issue
(не дублируются как «факт» в коде/доке с риском разъехаться).

## Что проверено и корректно

- Снимок рендера (AC3): инкрементальная пересборка корректна по дифференциальному
  оракулу на 250 случайных тиках + отдельным тестам на in-place правки и
  структурные изменения; заморозка (`Object.freeze`) и привязка к геометрии
  (#813) сохранены — проверено тестом `assertDeepFrozen` и `geometry: host._cfgEpoch`
  без изменений по сравнению с `dev`.
- LED (AC2/AC5/AC6): ключ кадра покрывает все перечисленные в контракте п.4 входы,
  включая ранее «дырявые» `icon_size`/палитру/виртуальный свет/содержимое записей
  «на месте» (закрыто в `c0de455c` после красного `smoke_vacuum` на CI — цикл
  исправления документирован честно автором, следы проверены: `git show c0de455c`
  действительно содержит обе точки фикса — снимок и LED-ключ).
- Свет (AC4): геометрический отпечаток преград кэшируется по записи+эпохе+масштабу
  только в View (в редакторе — `Number.NaN`, гарантированный промах, т.к.
  `NaN !== NaN`, что я подтвердил поведением JS, а не предположением) — осознанный
  fail-safe для редактора, соответствует ТЗ («Editors are desktop-first…», и ТЗ п.5
  прямо требует кэш только для View).
- Необходимая опора `_planHass`/`activeRegistryHass` lending — без неё вся схема
  reuse была бы недостижима (идентичность `hass.entities` рвалась бы каждый тик);
  проверил цепочку вручную, согласуется с `haRegistryBuildSignature` (не менялась
  в диффе).
- Удаление мёртвого параметра `designPreview` — не регрессия (проверено по всем
  вызывающим сторонам на `origin/dev`).
- Push-Validate на материале — success; смоки/golden доказаны переиспользованием
  на неизменном для рендера дереве; бюджет `smoke_wall_node_connected` поднят
  (100→110 мс) с явной ссылкой на решение владельца 14.10.2026 и записью в
  `docs/DEVELOPMENT.md` в том же коммите — не тихая правка.

## Находки

Нет High. Нет Medium в скоупе. Нет Medium вне скоупа.

## Вердикт

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0

Документ: docs/reviews/CODE-REVIEW-850-r1.md

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/850-sensor-tick-work`, коммит `74b462f4d921` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `65fdbc2d656d59f2733fb9ec9db6a3ed4ff74654`
  ```
  git log --all --format='%H %T' | grep 65fdbc2d656d
  ```
- Тело issue: `5085dfcd2dd8e133d367eedf7a2e1839bdd4bd3b6b950d761d18a91dc16754d0`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ1NTQsIm91dHB1dF90b2tlbnMiOjE2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NjM0fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo3Miwib3V0cHV0X3Rva2VucyI6MzQ1ODksImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTg1Mjc4LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NDIyNjQwNCwiY29zdFVzZEVzdGltYXRlIjoxLjkzMjQyNjgwMDAwMDAwMDJ9XSwidHVybnMiOjQ0LCJkdXJhdGlvbk1zIjo0NTEwOTMsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjkzNzA2MDgwMDAwMDAwMDIsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4626 output_tokens=34605 cache_creation_input_tokens=185278 cache_read_input_tokens=4226404 num_turns=44 -->
