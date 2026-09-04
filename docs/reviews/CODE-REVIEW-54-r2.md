# CODE-REVIEW-54-r2 — #54: контекстные связи Zigbee на плане (hover overlay)

- Issue: [#54](https://github.com/Matysh/houseplan-card/issues/54)
- Этап: `code` (PROCESS.md §2.7)
- Диапазон общий: `origin/dev...HEAD`, `origin/dev` = `ec9824f2`, `HEAD` = `f0ed526a`
  (ветка `issue/54-zigbee-topology-hover`, детач `HEAD`, merge-base с `origin/dev`
  не сдвинулся — `ec9824f2` тот же, что в r1, ребейза не было)
- ТЗ: [`docs/specs/054-zigbee-topology-overlay.md`](../specs/054-zigbee-topology-overlay.md),
  ревью ТЗ зелёное на заходе r2 — [`SPEC-REVIEW-54-r2.md`](SPEC-REVIEW-54-r2.md)
- Заход: **r2** код-ревью
- Блокирующих циклов израсходовано: **1/4** (зелёных вердиктов ревью ТЗ бюджет
  не тратит, §2.10/#227; израсходован ровно жёлтый заход r1 код-ревью)
- Вердикт: **зелёный**

## Скоуп ревью (по дельте, PROCESS.md §2.10)

Предыдущий заход (r1) отревьюил материал на SHA `a2867df9` полным разбором и
вернул один Medium (M1). Дельта этого раунда — `git diff a2867df9..HEAD`,
3 коммита:

| Коммит | Класс | Содержимое |
|---|---|---|
| `aab5c3ca` | C (docs) | публикация `docs/reviews/CODE-REVIEW-54-r1.md` шагом конвейера |
| `4203a01b` | A/B (продукт+тест) | правка M1: `src/zigbee-topology-runtime.ts` (+12/-3), новый юнит и мутант в `test/zigbee-topology.test.mjs` (+28), `scripts/mutation-gate.mjs` (+11, одна новая запись) |
| `f0ed526a` | C/D (docs+generated) | пересчёт `sourceFingerprint` в `docs/images/screenshots.json` после правки `src/**`; `dist/**` и `custom_components/houseplan/frontend/**` регенерированы пересборкой |

Дельта локальна и не расширяет скоуп: новая подсистема не задета, контракт
поведения `docs/specs/054-zigbee-topology-overlay.md` не менялся, ребейза на
ушедший вперёд `dev` не было (merge-base с `origin/dev` — тот же `ec9824f2`,
что и на r1). Объём разбора этого раунда — единственная правка (M1) плюс всё,
до чего она дотягивается: контракт Z2M-runtime (AC13–AC16), i18n/perf-бюджет
бандла, регенерация бандла/скриншотов. Остальные 17 AC (AC1–AC12, AC17–AC20)
дельта не задевает — унаследованы из r1 без повторной проверки (раздел ниже).

Трейлеры всех трёх коммитов: `Issue: #54` / `User-Visible: no` — верно, правка
внутренняя (фича ещё не выпущена, публичного поведения не меняет).

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **M1** — невалидный ответ Zigbee2MQTT на верном топике/transaction молча роняется (`parseMessage` → `null`), запрос висит полный 150 с таймаут и репортит `timeout` вместо `invalid_payload` (AC16) | `src/zigbee-topology-runtime.ts:201,219-222,227` — добавлен флаг `responseActive`, выставляемый в `true` только после публикации запроса (`:227`, сразу перед `callService`). Пока `responseActive === false`, «мусорное» сообщение на response-топике молча игнорируется (перед отправкой запроса это заведомо чужой/протухший пакет — ровно то, что и раньше корректно игнорировалось для `retain===true`). После `responseActive === true` тот же `parseMessage → null` немедленно вызывает `responseReject?.(fail('invalid_payload'))` (`:220`), и `withTimeout` (Promise.race) возвращает ошибку сразу, не дожидаясь дедлайна | Новый юнит `test/zigbee-topology.test.mjs:175-197` («Z2M runtime rejects a malformed response immediately instead of timing out») — воспроизвёл лично `node --test --test-name-pattern="malformed response immediately" test/zigbee-topology.test.mjs`: green, `error: 'invalid_payload'`, `cleanups: 2`, elapsed < 250 ms при таймауте 500 ms. Мутант `scripts/mutation-gate.mjs:5644-5654` (`zigbee-topology-z2m-malformed-response-waits-for-timeout`) снимает именно новую ветку (`if (value === null) return;` вместо ветки с `responseReject`) — лично прогнал `node scripts/mutation-gate.mjs --id=zigbee-topology-z2m-malformed-response-waits-for-timeout`: чистый прогон green, мутация красит тест, «поймано 1 из 1» |
| L1 (diagnostics.py не фильтрует settings) | не тронута — принята r1 без правки, отдельным улучшением вне #54 | не в скоупе этого раунда |
| L2 (`duplicate_link` шире факта) | не тронута — принята r1 как снятая находка | не в скоупе этого раунда |
| L3 (плотность диффа/стиль) | не тронута — принята r1 как снятая находка | не в скоупе этого раунда |

Регрессии от фикса нет: существующий тест `Z2M runtime verifies retained bridge
info, correlates transaction and cleans subscriptions` (`test/zigbee-topology.test.mjs:138-172`)
теперь дополнительно шлёт `stale-not-json` на response-топик **до**
`responseActive` (в момент подписки, до отправки запроса) — прогнан, остаётся
green: подтверждает, что новая ветка не путает «протухший мусор до запроса»
(игнорировать) с «мусор после запроса» (немедленный `invalid_payload`).

## Унаследовано из r1

Документ `docs/reviews/CODE-REVIEW-54-r1.md` (материал: коммит `a2867df9a224`,
дерево `90d12b3a6980a4537b454e8a922212ac9ce0fed3`). Принято без повторной
проверки в этом раунде, так как дельта их не задевает:

- **AC1–AC12, AC17–AC20** — доказаны в r1 таблицей AC (unit/smoke/mutation
  witness, чтение кода) и не связаны с изменённым кодом (`refreshZ2mTopology`
  затрагивает только AC13–AC16).
- **Defence-in-depth admin-гейта (AC3)** — лично воспроизведённая r1 мутация
  (`zigbee-topology-overlay-bridge.ts:17`) не пересматривалась повторно.
- **AC5 «route не создаёт рёбер»** — лично воспроизведённая r1 мутация
  `normalizeZhaTopology` не пересматривалась повторно, код `zigbee-topology.ts`
  дельтой не тронут.
- **Приватность на уровне персистентной конфигурации (AC17)**, включая
  backend-тест `tests_backend/test_support_package.py` — код `settings`-слоя
  дельтой не тронут, backend Python дельтой не тронут (`git diff a2867df9..HEAD -- '*.py'` пуст).
- **Golden red на трёх кадрах общих настроек** (`general-color-popover-desktop-en`,
  `settings-help-zoom-200-en-light`, `settings-help-zoom-200-ru-dark`) —
  диагноз r1 (топологически ожидаемый сдвиг от нового блока Zigbee, не
  принят намеренно) не пересматривался: правка M1 не рендерит и не меняет
  разметку General Settings, только таймаут MQTT-обработчика. Остаётся
  предрелизным вопросом (PROCESS.md §8), не блокирует код-ревью.
- **Полный CI Validate на SHA `a2867df9`** (типы/юниты/мутанты/бандл-синхрон,
  3 browser-smoke шарда, perf-smoke — success) — не перезапрашивался повторно;
  дельта покрыта локальными гейтами этого раунда (таблица ниже). На SHA
  `f0ed526a` зелёного Validate не найдено на момент ревью — гейты прогнаны лично.
- **AC18 (performance budget)** — численный бенчмарк r1
  (`npm run benchmark:zigbee-topology`, 500 узлов/2979 связей, 5–13× запас) не
  перезапускался: правка M1 не в горячем пути normalize/map/hover, а в
  MQTT-обработчике ошибок, который выполняется только при явном
  ручном refresh Z2M.
- **AC19 (lazy boundary)** — три chunk'а вне `initialViewFiles` не
  перепроверялись поимённо; косвенно подтверждено этим раундом через
  `npm run bundle:budget` (см. таблицу гейтов) — initial View почти не
  изменился (295355 → 295365 B, +10 B), что согласуется с тем, что
  `zigbee-topology-runtime.ts` остаётся lazy-chunk'ом.

## Как проверялось (гейты этого раунда)

`npm ci` не выполнялся — зависимости и Chromium уже установлены средой,
рабочая копия чистая на входе и осталась чистой после всех прогонов.

| Гейт | Команда | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit` | green, код 0 |
| Unit | `npm test` | **1906/1907 green, 1 skipped, 0 failed** (включая новый тест `zigbee-topology.test.mjs:175`, subtest `ok 1884`) |
| Сборка | `npm run build` | green |
| Синхронность бандлов | `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` + `npm run bundle:sync` (нулевой diff после, `git status --short` пуст) | идентичны байт-в-байт |
| Документация/скриншоты | `node scripts/check-docs.mjs` (обязателен: дельта трогает `src/**`) | green — `Documentation checks passed (7 files, 12 external links)`; `sourceFingerprint` уже обновлён коммитом `f0ed526a`, `imageSha256` кадров не изменился (диф `docs/images/screenshots.json` — только хеши источника) |
| Новый `any` | `node scripts/no-new-any.mjs --base a2867df9 --head HEAD` | green — 11 добавленных строк в 1 файле, новых `any` нет |
| Целевой мутант (новый, M1) | `node scripts/mutation-gate.mjs --id=zigbee-topology-z2m-malformed-response-waits-for-timeout` | green: чистый прогон green, мутация красит тест — «поймано 1 из 1» |
| Регрессия остальных zigbee-мутантов | `node scripts/mutation-gate.mjs --id=<каждый из 4 прежних id>` (по одному) | все 4 green, «поймано 1 из 1» каждый — правка M1 не сломала соседние guard'ы |
| Целевой smoke | `node demo/smoke_zigbee_topology_hover.mjs` | green — 12/12 полей `true` |
| Выбор смоков | `node scripts/smoke-select.mjs --base a2867df9 --head HEAD` | НЕОПРЕДЕЛЁННОСТЬ: 1 файл `src/**` изменён, 0 символов проекта на изменённых строках привязано к смокам — связь не доказана инструментом. Решение ревьюера: правка — таймер/promise-логика внутри `refreshZ2mTopology`, без DOM/UI поверхности; достаточным свидетелем считаю юнит + mutation witness выше и повторный прогон целевого smoke (регрессии на 12/12 нет) |
| Bundle budget | `npm run bundle:budget` | green — initial View 295365 B gzip (потолок 296000±2000, запас 4635 B); +10 B к r1 — предупреждение о низком запасе (#367) не новое и не относится к #54, project-wide долг |
| Модельные инварианты | не прогонялся | дельта не трогает геометрию/`layout`/`marker.space`/`open_spans`/рёбра комнат — гейт неприменим, инвариант из r1 не пересматривался |
| Backend pytest | не прогонялся | дельта не трогает `custom_components/**/*.py` (`git diff a2867df9..HEAD -- '*.py'` пуст) |
| Golden / полный smoke-матрикс (221) | не прогонялся | предрелизный гейт (PROCESS.md §8); диагноз r1 по трём кадрам General Settings не изменился, правка M1 не рендерит UI |
| CI Validate на точном SHA `f0ed526a` | не найден зелёный прогон | подтверждено оператором задачи в постановке ревью — прогон не найден/не завершён/не success; дешёвые гейты выше прогнаны лично взамен |

## Критерии приёмки — таблица (только AC, которых касается дельта)

| AC | Вердикт | Доказательство | Чем доказан | Чем краснеет |
|---|---|---|---|---|
| AC14 Z2M contract | доказан | `zigbee-topology-runtime.ts:201,216-224,227,234` — transaction/timeout/retained/foreign-фильтрация не изменились по сути, добавлена только явная ветка «наш топик, наша transaction-фаза, `parseMessage` вернул `null`» | unit `zigbee-topology.test.mjs:138-197` (обе Z2M-runtime теста) | мутанты `zigbee-topology-z2m-foreign-response-accepted`, `zigbee-topology-z2m-subscriptions-leak`, `zigbee-topology-z2m-malformed-response-waits-for-timeout` — все три лично прогнаны, все красят соответствующий тест |
| AC15 no implicit work | не тронут дельтой, унаследован из r1 | — | — | — |
| AC16 failures | доказан (M1 закрыта) | `zigbee-topology-runtime.ts:219-222` — `invalid_payload` теперь достижим немедленно на верном топике/фазе, без ожидания 150 с | unit `zigbee-topology.test.mjs:175-197` (`error === 'invalid_payload'`, `elapsed < 250ms` при timeout 500ms) | лично воспроизвёл мутацию `zigbee-topology-z2m-malformed-response-waits-for-timeout` — тест красится, `поймано 1 из 1` |

Остальные AC (AC1–AC13, AC17–AC20) — вне зоны действия дельты, наследуются из
r1 без повторной проверки (раздел «Унаследовано из r1»).

## Что проверено и корректно

- Правка M1 закрывает ровно то, что требовал r1: `invalid_payload` теперь
  достижим сразу после начала собственного запроса, а не только теоретически
  существует как код ошибки.
- Различение «протухший/чужой пакет до запроса» (игнорировать) и «наш топик,
  наша фаза, но нераспарсиваемый payload» (немедленный `invalid_payload`)
  подтверждено двумя тестами одновременно: новым (мусор после запроса →
  ошибка) и существующим изменённым (мусор до запроса → игнорируется, `ready`
  всё равно достигается по корректному payload).
- Cleanup обеих MQTT-подписок (`cleanups === 2`) сохраняется и на ошибочном
  пути — `finally`-блок (`:238-242`) не менялся.
- Регенерация `dist/**`/`custom_components/houseplan/frontend/**` после
  правки синхронна во всех проверяемых копиях; `docs/images/screenshots.json`
  обновил только `sourceFingerprint`/`sourceSha256`, `imageSha256` не
  изменился — правка не затронула видимый рендер, что снимает вопрос «одно
  число — один источник» для скриншотов в этом раунде (фикс не производит
  никакой пользовательской величины).
- Ни одна из четырёх ранее существовавших `zigbee-topology-*` мутаций не
  перестала краситься — правка не задела соседние guard'ы контракта Z2M/ZHA.

## Чего не проверял

- **Golden-изображения** — не пересматривал; диагноз r1 (три ожидаемых кадра
  General Settings, топологически объяснимых новым блоком Zigbee) не
  переоценивался, поскольку правка этого раунда не касается разметки/стилей.
  Остаётся предрелизным гейтом.
- **Полный локальный прогон 221 браузерного смока** — не делал; `smoke-select`
  на этой дельте вернул НЕОПРЕДЕЛЁННОСТЬ (0 символов проекта привязано к
  смокам на изменённой строке), решил не гонять полный матрикс: правка —
  чистая асинхронная логика внутри уже покрытого unit+mutation модуля,
  без новой DOM/UI поверхности; ограничился повторным прогоном целевого
  `smoke_zigbee_topology_hover.mjs` (green, без регрессии).
- **CI Validate на точном SHA `f0ed526a`** — не нашёл зелёного прогона на
  момент ревью (подтверждено в постановке задачи); не проверял историю
  запусков через `gh run list` повторно после локальных гейтов.
- **Модельные инварианты и backend pytest** — не прогонял: дельта не касается
  геометрии/`layout` и не касается `custom_components/**/*.py`, оба гейта
  неприменимы по построению диффа.
- **Немецкий/французский текст, мультипровайдерный browser-сценарий, diagnostics.py** —
  как и в r1, не пересматривались: дельта их не касается.

## Вердикт

Единственная находка предыдущего раунда (M1) закрыта точечной, доказанной
правкой: новый юнит-тест воспроизводит ровно сценарий из находки и
показывает исчезновение дефекта (`invalid_payload` вместо 150-секундного
`timeout`), выделенный мутационный тест подтверждает, что защита реальна и
умеет падать без неё. Регрессий у соседних guard'ов и AC, которых касается
код Z2M-runtime, нет. Новых High/Medium находок в этом раунде не найдено.

Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/54-zigbee-topology-hover`, коммит `f0ed526a5924` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `f65587d326738cadfbbecd0d501fad0118bf10a2`
  ```
  git log --all --format='%H %T' | grep f65587d32673
  ```
