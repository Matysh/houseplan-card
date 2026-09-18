# CODE-REVIEW-588-r1

Issue: #588 «Настройки устройства: отображение „Значение + статичный значок“ —
значение видно, цвет маркера не меняется никогда».
Материал: ветка `issue/588-value-static-icon`, вершина `9b0855b3c0aefde4b08ffef7a534d3f5a9320e05`
(коммиты `99e1765d` продукт + `9b0855b3` запись в `scripts/smoke-links.mjs`).
Заход r1, блокирующих циклов израсходовано 0/4.

## Скоуп диффа

`src/logic.ts` (DISPLAY_MODES, displayWantsValue/displayIsNeutral, normalizeDeviceDisplay),
`src/device-presentation-policy.ts`, `src/device-presentation.ts`, `src/device-pulse.ts`,
`src/device-value-badge.ts`, `src/types.ts`, `src/houseplan-card.ts` (ярлыки/подсказки + 3
ветки живого пылесоса), `src/houseplan-editor-runtime.ts` (4 ветки диалога устройства),
`custom_components/houseplan/validation.py`, `scripts/config-schema.json`,
i18n ru/en/fr/de, `demo/golden/matrix.mjs`, `demo/smoke_static_icon.mjs` (новые блоки),
`scripts/mutation-registry.mjs` (+7 новых мутантов, 3 переехавших якоря),
`scripts/smoke-links.mjs`, `scripts/bundle-budget.mjs` (перецентровка потолка),
тесты (`test/device-presentation-policy.test.mjs`, `test/device-presentation.test.mjs`,
`test/device-pulse.test.mjs`, `test/logic.test.mjs`, `test/golden-matrix.test.mjs`,
`tests_backend/test_validation.py`, `tests_backend/test_support_package.py`),
документация (`USER-GUIDE.ru.md`/`.md`, `TESTING.md`, `CONFIG-COMPATIBILITY.md`,
`CHANGELOG.md`/`.ru.md`), плюс сгенерированные бандлы (класс D — законно вместе с
исходником в одном коммите фичи).

Соответствует заявленному скоупу ТЗ; посторонних файлов класса A не задето.

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate на этом SHA
(https://github.com/Matysh/houseplan-card/actions/runs/35336653719), поэтому
`tsc --noEmit`/`npm test`/`npm run build` не перегонялись «для очистки совести» —
но поскольку diff трогает геометрию/бэкенд-схему и рендер, ниже я всё равно
исполнил протокольно важные гейты сам, чтобы не доверять только заявлению автора.

| Гейт | Команда | Результат |
|---|---|---|
| typecheck + build | `npm run build` | зелёный, dist пересобран |
| bundle-sync | `npm run bundle:sync` | зелёный |
| unit-тесты (полный набор) | `node --test test/*.test.mjs` | **2765 pass, 0 fail, 1 skip** — совпадает с заявленным автором результатом |
| no-new-any | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | зелёный, новых `any` нет (72 добавленные строки в 8 файлах) |
| smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 2 «зарегистрированные связи»: `smoke_static_icon.mjs`, `smoke_device_preview_parity.mjs` — оба прогнаны ниже |
| смок AC5–AC7 | `node demo/smoke_static_icon.mjs` | **OK, все 28 фактов true** (прогнан лично, не только по слову автора) |
| смок AC7 (парность превью) | `node demo/smoke_device_preview_parity.mjs` | OK, все факты true |
| бэкенд (чистый набор, без полного HA) | `pytest tests_backend/test_validation.py tests_backend/test_support_package.py` (venv 3.12 + voluptuous, HA-тесты пропущены conftest'ом) | **170 passed, 1 skipped** — совпадает с заявленным |
| схема бэкенда | `python scripts/dump-config-schema.py --check` | `manifest fresh: 291 paths` — файл не изменился после генерации |
| мутанты (все 7 новых) | `node scripts/mutation-gate.mjs --id=<каждый>` | **7 из 7 «заявленный тест покраснел на мутанте»** |
| мутанты (3 переехавших якоря) | `device-presentation-policy-static/-value/-diagnostics` | все 3 по-прежнему ловятся после переименования `staticIcon`→`neutralFace` |
| golden | `npm run golden:verify` (Linux, локальный Chromium) | **170 сцен побайтово совпали, ровно 2 «different»: `device-icon-state-table-{light,dark}`** — визуально сверил diff/actual/baseline (см. ниже) |
| bundle-budget | `npm run bundle:budget` | `291346 B gzip` — точно совпадает с заявленным фактом, потолок `292400±2000` не пробит |
| check-docs | `node scripts/check-docs.mjs` | ожидаемо `ERROR: stale fingerprint` — это предрелизный гейт (§8), не гейт ревью; пересъёмка идёт перед бетой |

**Golden — визуальная проверка.** Открыл `artifacts/golden/diff/device-icon-state-table-light.png`:
diff подсвечивает **ровно один** маркер (верхний левый, `golden-light-one`).
`baseline` показывает его оранжевым цветным кружком (цвет RGB-лампы), `actual` —
белым нейтральным кружком с текстом `on`. Это дословно то, что обещают К1/К2 и
описание AC9 в хендоффе. Остальные 170 сцен совпали побайтово — это независимое
подтверждение AC10 (я не поверил заявлению «остальное не сдвинулось», а
прогнал полный `golden:verify` и увидел 0 неожиданных расхождений).

**Не прогонял:** полный HA-харнесс (`test_ha_*.py` — в песочнице нет
`homeassistant`, пакет с пином `0.13.357` требует Python 3.14, которого в этом
окружении нет; conftest.py корректно пропускает эти файлы без HA — совпадает с
задокументированным поведением AGENTS.md); perf-профили (`large-house-interaction-v1`
формально применим, т.к. тронут `houseplan-card.ts`, но все три правки в нём —
замена `=== 'static_icon'` на `displayIsNeutral(...)` в трёх уже существующих
ветках без новых вычислений и без новых проходов по данным; ТЗ прямо
декларирует нулевую разницу в стоимости с `value`, и это подтверждается
чтением диффа — новых сравнений по стоимости O(1) не добавляет); полную
матрицу браузерных смоков (250 файлов) — smoke-select не назвал широких
связей, задача не задевает ничего вне названных двух смоков.

## Проверка AC по цепочке доказательств

| AC | Доказательство | Проверено |
|---|---|---|
| AC1 | `test/device-presentation-policy.test.mjs` — 5 статусов × `value_static_icon`, контраст с `value` | тест прочитан, прогнан, ловит мутант `value-static-icon-keeps-live-colour` |
| AC2 | там же + `test/device-presentation.test.mjs` (`fallbackReason`) — 4 причины × 2 режима, контраст со `static_icon` (не просит значения вовсе) | прочитан, прогнан, ловит `value-static-icon-loses-value-fallback` |
| AC3 | `test/device-presentation.test.mjs` — `sourceDetails:false` даёт `42 %` для `value_static_icon`, пустоту для `static_icon` | прочитан, прогнан, ловит `value-static-icon-takes-the-sourceless-fast-path`; дополнительно прочитан весь `resolveDevicePresentation` — все 4 вызывающих места (`houseplan-card.ts`×2, `space-card.ts`, `space-render.ts`) идут через единый путь, значит правка не точечная, а на всю подсистему |
| AC4 | `test/device-pulse.test.mjs`, `test/device-presentation.test.mjs` (`valueBadge===null`, тревожный источник нейтрален) | прочитан, прогнан, ловит `value-static-icon-pulses-on-alarm` |
| AC5 | `demo/smoke_static_icon.mjs` — новый блок (`valueStatic*`, `dynamicValueColoured`) | прогнан лично, 28/28 фактов true |
| AC6 | тот же смок — puck/след на сопоставленной карте, `.vacwarn` на несопоставленной (`m9`), буфер `_vacRt` проверен в обеих ветках | прогнан лично; отдельно перечитал `src/vacuum-routes.ts:344-353` — `routeWarningKey` действительно `null` для `ready`, разведение по двум конфигурациям в r3 ТЗ оправдано и корректно реализовано; все 3 мутанта (`-keeps-live-vacuum`, `-keeps-vacuum-overlay`, `-keeps-route-warning`) прогнаны лично и ловятся |
| AC7 | тот же смок + `smoke_device_preview_parity.mjs` | прогнаны лично; плюс прочитан код 4 веток `houseplan-editor-runtime.ts` — все переведены на `displayWantsValue`/`displayIsNeutral` |
| AC8 | `test_validation.py`, `test_support_package.py`, схема | backend-тесты прогнаны лично (170 passed), `dump-config-schema.py --check` подтвердил свежесть; `import_export.py` не тронут — проверено чтением: `create_export`/`build_space_merge` прогоняют конфиг через тот же `CONFIG_SCHEMA`/`MARKER_SCHEMA`, значит новый токен проходит структурно, без специального кода — README ТЗ называет `test_ha_import_export.py` в плане тестов, но там нет отдельного теста на новый токен; это не пробел в защите (механизм общий и уже доказан через `test_validation.py`), а неточность плана автотестов — не блокирует |
| AC9 | golden + `test/golden-matrix.test.mjs` | golden визуально сверен (см. выше), контракт фикстуры прочитан и прогнан в общем наборе |
| AC10 | `golden:verify` (170/172 идентичны), `npm test` (2765/2765) | оба прогнаны лично |
| AC11 | тест полноты локалей в общем наборе | прогнан в составе `npm test`; плюс вручную сверил все 4 файла (ru/en/fr/de) — 3 ключа на каждый | 
| AC12 | `USER-GUIDE.ru.md`/`.md`, `TESTING.md`, `CONFIG-COMPATIBILITY.md`, changelog RU+EN | прочитаны построчно, текст точно описывает К1/К2/К2а; см. находку ниже про одну неточную фразу в `TESTING.md` |

## Находки

### Low — `docs/TESTING.md` называет непроверяемую поверхность «PDF»

Новая строка чек-листа (`docs/TESTING.md:2652-2657`) требует от ручного
тестировщика убедиться, что `value_static_icon` показывает значение
«включая... PDF, где источники резолвятся лениво». Формулировка дословно
повторяет K3 из тела issue («…на всех поверхностях, включая основной путь
рендера плана, карточку пространства и PDF»).

Фактически архитектурный PDF-экспорт (`src/pdf/pdf-export.ts` → `pdf-scene.ts`)
не рисует маркеры устройств вообще — ни в каком режиме `display`, не только в
новом. Это не регрессия задачи, а давнее и намеренное ограничение: комментарий
`src/pdf/pdf-scene.ts:393` — `// Architectural export deliberately has no
marker/device projection pass` (существует с 2026-09-07, до #588), а функция
`rasters()` в `pdf-export.ts` собирает только фон плана и декор-изображения, без
единого прохода по `DevItem`/`resolveDevicePresentation`. Существующий (не
менявшийся) докблок в начале `src/device-presentation.ts` тоже называет ровно
три потребителя — «Interactive plan, static space card and the device editor
preview» — PDF среди них нет.

Практический эффект: ручной тестировщик, дойдя до этого пункта, откроет PDF,
не найдёт там ни одного маркера ни в старом, ни в новом режиме — и либо
потратит время на выяснение, либо ошибочно заведёт баг. Функциональность
задачи не страдает: ни один AC1–AC12 не требует поведения в PDF, а
K3-формулировка описывает *источник* неточности (унаследована из тела issue,
уже трижды прошедшего ревью ТЗ и не пойманная там).

**Как обнаружено:** не по совпадению имени — прочитал весь `src/pdf/*.ts` в
поисках места, где `resolveDevicePresentation`/`sourceDetails` могли бы
использоваться для PDF (раз K3 их называет), не нашёл ни одного вызова, и
проверил историю строки-комментария, чтобы отличить «регрессию этой задачи» от
«давнего факта архитектуры».

Не блокирует: узкая фраза в ручном чек-листе, не в AC, не в пользовательской
документации (`USER-GUIDE` PDF не упоминает), не в коде. Достаточно снять
слово «и PDF» из строки `docs/TESTING.md:2652-2657` в этом же PR или следующей
правкой; отдельного issue не требует. Снимаю без возврата на цикл —
письменная фиксация здесь и есть запись по правилу Low (§2.7).

## Что проверено и корректно

- Два производных предиката (`displayWantsValue`, `displayIsNeutral`) полностью
  заменяют разбросанные сравнения с токеном; grep по всему `src/**/*.ts` на
  `=== 'static_icon'` / `=== 'value'` не нашёл ни одного пропущенного места —
  оставшиеся три вхождения оправданы (маппинг `PresentationReason`, быстрый
  путь К3, определение самого предиката).
- Три ветки живого пылесоса (К2а) переведены на `displayIsNeutral`, режим
  подавляет puck/след/бейдж маршрута и не наполняет буфер позиций;
  разведение AC6 по двум конфигурациям (сопоставленная/несопоставленная карта)
  корректно устраняет тавтологию, найденную в ревью ТЗ r2 (M3) — перепроверено
  чтением `vacuum-routes.ts` независимо от заявления автора.
- Мутационное покрытие полное и по-настоящему проверяет защиту: все 7 новых +
  3 переехавших мутанта лично прогнаны и ловятся; ни один guard не «зелёный по
  умолчанию».
- i18n (ru/en/fr/de) — 3 новых ключа на локаль, формулировка причины в
  предпросмотре («не меняет цвет маркера», а не «не меняет значок») отражает
  К1/К2 точно, а не скопирована бездумно со `static_icon`.
- Golden-эталоны обновлены выборочно и обоснованно (RGB-лампа выбрана
  намеренно, чтобы кадр не был тавтологией) — визуально подтверждено.
- Документация (USER-GUIDE ru/en, CONFIG-COMPATIBILITY, changelog) — точная,
  без лишних заявлений, кроме одной находки выше.
- `import_export.py`/`support_package.py` не тронуты обоснованно: оба
  копируют `display` как непрозрачное значение, а не список констант — новый
  токен проходит структурно.
- Перецентровка `INITIAL_VIEW_GZIP_CEILING` документирована с числами и не
  меняет общий бюджет; лично пересчитан факт (291346 B) — совпадает.
- Трейлеры: `Issue: #588` на обоих коммитах, `User-Visible: yes` на
  продуктовом коммите с правками в обоих changelog в том же коммите.

## Чего не проверял и почему

- Полный HA-харнесс (`test_ha_*.py`) — недоступен в песочнице (нет Python
  3.14 / `pytest-homeassistant-custom-component`); это ожидаемое ограничение
  окружения, а не решение пропустить проверку — чистый backend-набор
  (170 тестов) прогнан лично и целиком покрывает AC8.
- Perf-профили (`large-house-interaction-v1`) — не прогонял: правка в
  `houseplan-card.ts` — это замена трёх строковых сравнений на вызов функции
  той же асимптотики в уже существующих ветках, без новых проходов/аллокаций;
  ТЗ прямо декларирует нулевую разницу в стоимости, что подтверждается
  чтением. Несоразмерно гонять тяжёлый гейт ради трёх однострочных замен.
- Полная матрица из 250 браузерных смоков — `smoke-select` не назвал широких
  совпадений сверх двух уже прогнанных, что при точечности диффа (одна
  подсистема представления устройства) достаточно.

## Вердикт

Все 12 AC доказаны — частью автотестом с проверкой «умеет падать» (мутанты
1/1 по каждому защитному AC), частью личным запуском смоков/бэкенда/golden, не
только на слово автора. Единственная находка — Low, вне AC, не блокирует.

**Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/588-value-static-icon`, коммит `9b0855b3c0ae` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `477d28bbee006b670c293dfce422a1aa2ef1be6b`
  ```
  git log --all --format='%H %T' | grep 477d28bbee00
  ```
- Тело issue: `503d9f130d95a9bb723107478993f63ddb64e51e20b212e60a0f9d8dac331e44`
- Вердикт конвейера: `green` · High 0
