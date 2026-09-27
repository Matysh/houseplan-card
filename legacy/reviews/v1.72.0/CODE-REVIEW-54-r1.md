# CODE-REVIEW-54-r1 — #54: контекстные связи Zigbee на плане (hover overlay)

- Issue: [#54](https://github.com/Matysh/houseplan-card/issues/54)
- Этап: `code` (PROCESS.md §2.7)
- Диапазон: `origin/dev...HEAD`, `origin/dev` = `ec9824f2`, `HEAD` = `a2867df9`
  (ветка `issue/54-zigbee-topology-hover`, детач `HEAD`)
- ТЗ: [`docs/specs/054-zigbee-topology-overlay.md`](../specs/054-zigbee-topology-overlay.md),
  ревью ТЗ зелёное на заходе r2 — [`SPEC-REVIEW-54-r2.md`](SPEC-REVIEW-54-r2.md)
  (r1 → M1/L1-L3 закрыты правкой `aed0b5b6`, подтверждено r2 зелёным)
- Заход: **r1** код-ревью (первый заход этого этапа для #54; ревью ТЗ и код-ревью
  считаются отдельно — см. историю комментариев issue)
- Блокирующих циклов израсходовано: 0/4 до этого захода
- Вердикт: **жёлтый**

Это первый заход код-ревью #54 — полный разбор, раздел «дельта/унаследовано»
(PROCESS.md §2.10) не применяется.

## Скоуп ревью

60 файлов, +3433/−627 (`git diff origin/dev...HEAD --stat`).

Продуктовый код (класс A): `src/types.ts` (+2), `src/houseplan-card.ts` (+1
импорт, +1 render seam), `src/houseplan-editor-runtime.ts` (+19/-11, General
Settings wiring), новые модули `src/zigbee-topology.ts` (332),
`src/zigbee-topology-runtime.ts` (234), `src/zigbee-topology-settings.ts` (45),
`src/zigbee-topology-overlay-bridge.ts` (22), `src/hp-zigbee-topology-overlay.ts`
(203), `src/hp-zigbee-topology-settings.ts` (208), `src/i18n/topology.ts` (16) и
`src/i18n/topology/{en,ru,de,fr}.json` (по 27 ключей).

Гейты/инструменты (класс B): `test/zigbee-topology.test.mjs` (184, 9 тестов/10
subtests), `demo/smoke_zigbee_topology_hover.mjs` (102, 12 проверок),
`demo/benchmark_zigbee_topology.mjs` (47), `scripts/mutation-gate.mjs` (+4
мутанта), `scripts/config-field-registry.mjs` (+1 запись), `scripts/smoke-links.mjs`
(+1 связь), `package.json` (+1 npm-скрипт), `tsconfig.test.json`,
`tests_backend/test_support_package.py` (+regression-тест на исключение
`zigbee_topology` из support-пакета).

Документация (класс C): `docs/ARCHITECTURE.md`, `docs/CONFIG-COMPATIBILITY.md`,
`docs/SCOPE.md` (J7), `docs/SUPPORT-PRIVACY.md`, `docs/UX-MODES.md`,
`docs/USER-GUIDE.md`/`.ru.md`, оба `docs/CHANGELOG*.md`, `docs/images/screenshots.json`
(fingerprint).

Backend Python (`custom_components/houseplan/**/*.py`) — **не тронут**
(`git diff origin/dev...HEAD -- 'custom_components/**/*.py'` пуст), что
совпадает с явным заявлением ТЗ §15: House Plan backend не добавляется.
Сгенерированное (класс D): `dist/**`, `custom_components/houseplan/frontend/**`
— сверено `bundle:sync`, диф молчит после пересборки (см. таблицу гейтов).

Прочитано до вердикта: `docs/SCOPE.md`, `AGENTS.md`, `PROCESS.md` (включая
§2.7, §2.10, §4, §7.2, §8), тело issue #54 и все 10 комментариев (аналитика
14.08 и 30.08, Stage 0 research, решение владельца 04.09, оба захода
SPEC-REVIEW, хендофф реализации), `docs/specs/054-zigbee-topology-overlay.md`
целиком, `docs/UX-MODES.md`, `docs/CONFIG-COMPATIBILITY.md`,
`docs/SUPPORT-PRIVACY.md`, весь новый и изменённый продуктовый код построчно
(`src/zigbee-topology.ts`, `src/zigbee-topology-runtime.ts`,
`src/zigbee-topology-settings.ts`, `src/zigbee-topology-overlay-bridge.ts`,
`src/hp-zigbee-topology-overlay.ts`, `src/hp-zigbee-topology-settings.ts`, дифы
`houseplan-card.ts`/`houseplan-editor-runtime.ts`/`types.ts`), `test/zigbee-topology.test.mjs`
целиком, `custom_components/houseplan/diagnostics.py` и `support_package.py`.

## Как проверялось

`npm ci` не выполнялся — зависимости и Chromium уже установлены средой
(рабочая копия чистая на входе).

| Гейт | Команда | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit` | green, код 0 |
| Unit | `npm test` | **1905/1906 green, 1 skipped, 0 failed** (включая 10 subtests `test/zigbee-topology.test.mjs`) |
| Сборка | `npm run build` | green |
| Синхронность бандлов | `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` + `npm run bundle:sync` (нулевой diff после) | идентичны байт-в-байт |
| Документация/скриншоты | `node scripts/check-docs.mjs` (обязателен: diff трогает `src/**`) | green — `Documentation checks passed (7 files, 12 external links)`; `docs/images/screenshots.json`.`sourceFingerprint` уже обновлён в этом диапазоне (коммит `a2867df9`) |
| Новый `any` | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | green — 1074 добавленных строк в 10 файлах, новых `any` нет |
| Выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 19 «прямое совпадение» (включая целевой `smoke_zigbee_topology_hover.mjs`), 23 «слабая связь», 1 «зарегистрированная связь» — см. раздел ниже |
| Целевой smoke | `node demo/smoke_zigbee_topology_hover.mjs` (запущен лично) | green — 12/12 полей `true` |
| Performance benchmark | `npm run benchmark:zigbee-topology` (запущен лично) | green: normalizeMs 9.88 (бюджет 80), mapMs 6.06 (160), firstHoverMs 1.22 (180), repeatedHoverMs 5.95 (120) на 500 узлах/2979 связях |
| i18n parity | `node -e` diff ключей `en/ru/de/fr` topology-словарей (запущен лично) | green — 27/27/27/27, missing/extra пусты для всех трёх переводов |
| Config registry/audit | `node scripts/config-audit.mjs` | green — `settings.zigbee_topology` зарегистрирован (`status: current`), без ошибок |
| Модельные инварианты | не прогонялся | diff не трогает геометрию/`layout`/`marker.space`/`open_spans`/рёбра комнат — гейт неприменим по построению (overlay только читает уже спроецированные экранные координаты существующих markers) |
| Backend pytest | не прогонялся | diff не трогает `custom_components/**/*.py` — гейт пуст по построению; единственная затронутая backend-строка — уже существующий тест `tests_backend/test_support_package.py`, прочитан вручную |
| Полный smoke-матрикс (221) | не прогонялся локально целиком | CI Validate на точном SHA `a2867df9` (ссылка ниже) прогнал все 3 шарда + сводный job — все green; смысла дублировать 221 браузерный тест локально при уже зелёном CI на этом SHA нет |
| Golden | не прогонялся локально | CI Validate на этом SHA: job `golden` **red** — 3 существующих кадра общих настроек (`general-color-popover-desktop-en`, `settings-help-zoom-200-en-light`, `settings-help-zoom-200-ru-dark`) сдвинулись из-за нового блока Zigbee; автор эталоны не принимал. Согласно PROCESS.md §8 полный golden — предрелизный гейт, а принятие делает `npm run golden:accept -- --reviewed` на CI-артефакте перед бетой. Локально не пересматривал сами PNG — доверяю описанию автора и списку из ровно трёх, топологически ожидаемых кадров (все из экрана «Общие настройки», куда и добавлена новая секция); не блокирует код-ревью |

CI Validate на SHA `a2867df9` (https://github.com/Matysh/houseplan-card/actions/runs/33869683826)
проверен через `gh run view` напрямую: `Фронтенд: типы/юниты/мутанты/синхрон
бандла` — success (это же исполнило 4 мутанта `zigbee-topology-*` из
`scripts/mutation-gate.mjs` и убедился, что все их guard-тесты красятся —
поэтому не повторял мутации из CI лично), `Смоки в браузере` (все 3 шарда +
сводный) — success, `Перф-смок` — success, `Golden` — failure (ожидаемо, см.
выше), `Hassfest`/`Бэкенд pytest`/`HACS` — skipped (путь не изменился).

### Мутанты — выборочно исполнены лично

`scripts/mutation-gate.mjs` содержит 4 записи `zigbee-topology-*`; все четыре
`find`-строки совпадают байт-в-байт с текущим кодом (не мертвы), и CI уже
подтвердил, что каждая красит `test/zigbee-topology.test.mjs`. Дополнительно
проверил лично два случая, не покрытых записями в `mutation-gate.mjs`:

1. **AC3 (permissions), `src/zigbee-topology-overlay-bridge.ts:17`.** Заменил
   `input.hass?.user?.is_admin !== true` на `false` (снял admin-гейт рендера
   оверлея), пересобрал (`npm run build && node scripts/bundle-sync.mjs`),
   прогнал `node demo/smoke_zigbee_topology_hover.mjs` — поле `nonAdminHasNoOverlay`
   покраснело (`expected true, got false`), остальные 11 остались зелёными.
   Откатил файл, пересобрал, дерево снова чистое (`git status --short` пуст).
   Guard реален и умеет падать.
2. **AC5 (no inferred route), `src/zigbee-topology.ts`, функция
   `normalizeZhaTopology`.** Добавил блок, создающий связь из `record?.routes`
   (используя существующее тестовое поле `routes: [{ dest_nwk, next_hop }]` из
   `test/zigbee-topology.test.mjs:56`) в дополнение к `neighbors`. Пересобрал
   тест-билд (`npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs`)
   и прогнал `node --test test/zigbee-topology.test.mjs` — тест «ZHA
   normalization keeps directional observations and never infers route edges»
   покраснел (`Expected values to be strictly equal: 2 !== 1`), остальные 8
   остались зелёными. Откатил файл. ТЗ явно требует для AC5 «provider fixtures
   + mutation witness» (§13), а готовой записи в `mutation-gate.mjs` для этого
   инварианта нет — восполняю пробел этим прогоном лично (для чистого юнита
   PROCESS.md §2.7 считает это достаточным доказательством) и не считаю это
   отдельной находкой, раз защита подтверждена и умеет падать.

## Критерии приёмки — таблица

| AC | Вердикт | Доказательство | Чем доказан | Чем краснеет |
|---|---|---|---|---|
| AC1 default/off | доказан | `zigbee-topology-overlay-bridge.ts:17-19`, `zigbee-topology-settings.ts:19-21` | unit (`zigbee-topology.test.mjs:33`) + smoke `defaultOff`/`offHasNoLazyChunk` | smoke `offHasNoLazyChunk` реально проверяет отсутствие сетевого ресурса; отдельно не мутировал — риск низкий, чтение подтверждает простую булеву цепочку |
| AC2 persistence | доказан | `zigbee-topology-settings.ts:37-45` (`writeZigbeeTopologySettings` мёрджит в `{...settings}`), `houseplan-editor-runtime.ts` save-path | unit `zigbee-topology.test.mjs:39-43` (сохраняет посторонний `keep:7` в обе стороны) + smoke `settingPersists` | unit явно проверяет неудаление соседнего поля; end-to-end (сохранение topology вместе с ДРУГИМ полем диалога через реальный `_saveSettingsDialog`) отдельно не смокировано — риск низкий, код читается прямолинейно (один общий `settings`-объект) |
| AC3 permissions | доказан | `zigbee-topology-overlay-bridge.ts:17`, `hp-zigbee-topology-settings.ts:84,102-103,144-152`, `zigbee-topology-runtime.ts:132-134` (`requireAdmin`, defence-in-depth на 3 уровнях) | unit (`readZhaTopology` denies non-admin) + smoke `nonAdminHasNoOverlay` | **лично воспроизвёл** — см. «Мутанты» выше, smoke красится |
| AC4 contextual only | доказан | `hp-zigbee-topology-overlay.ts:172` (рендер только при `_hovered`), `zigbee-topology.ts:296-322` (incident-only resolver) | unit + smoke `incidentOnly` | чтением + unit-таблица связей |
| AC5 no inferred route | доказан | `normalizeZhaTopology` не читает `record?.routes` нигде (grep пуст) | unit `zigbee-topology.test.mjs:52-64` (фикстура содержит `routes`, счёт связей = 1) | **лично воспроизвёл мутацию** — см. «Мутанты» выше, тест красится |
| AC6 same-space mapping | доказан | `zigbee-topology.ts:280,313` (exact `candidates.length===1`, same-space branch) | unit `zigbee-topology.test.mjs:82-101` | мутант `zigbee-topology-ambiguous-marker-selected` (CI green — красит guard) |
| AC7 cross-space truth | доказан | `zigbee-topology.ts:300,313` (`remote` — `Set`, дедуп по markerId), `hp-zigbee-topology-overlay.ts:193-196` (только count, без направления) | unit (`remoteCount:1`) + smoke `crossSpaceCount` | чтением; отдельная адверсариальная проверка мульти-провайдерного дедупа (два провайдера дают одного и того же remote-соседа) сделана в фоновом ревью подагентом вручную (см. §«Верифицировано подзадачами» ниже) — не задваивает count |
| AC8 ambiguous/hidden lifecycle | доказан | `zigbee-topology.ts:256-259` (`drawable()`), `:283` (`ambiguous_placement`) | unit `zigbee-topology.test.mjs:103-114` | мутант `zigbee-topology-ambiguous-marker-selected` (CI green) |
| AC9 modality/modes | доказан (частично чтением) | `zigbee-topology-overlay-bridge.ts:17` (`view`+`kiosk`+admin gate), `hp-zigbee-topology-overlay.ts:129-131` (`_mouseAllowed` требует `pointerType==='mouse'` И `data-pointer-hover`, которые никогда не ставит клавиатурный фокус), `space-card.ts` не содержит ссылок на zigbee (grep пуст) | smoke `touchClears`, `editorHasNoOverlay`, `nonAdminHasNoOverlay` | kiosk-режим, режимы `devices`/`decor` отдельно (только `plan` в smoke) и keyboard-focus не смокированы явно — **проверено чтением**: `pointer-modality.ts` ставит `data-pointer-hover` только по реальным PointerEvent, фокус клавиатуры в этот путь не попадает |
| AC10 cleanup | доказан (частично чтением) | `hp-zigbee-topology-overlay.ts:76-84` (`disconnectedCallback`), `:141-148` (`_pointerOut`), `:150-152` (`_pointerDown` non-mouse) | smoke `leaveClears`, `touchClears` | сценарий «выключить настройку прямо во время видимых линий» отдельно не смокирован — **проверено чтением**: выключение убирает элемент из рендера через bridge, что триггерит `disconnectedCallback` в тот же тик |
| AC11 pointer ownership | доказан | `hp-zigbee-topology-overlay.ts:41` (`:host{pointer-events:none}`, наследуется CSS-каскадом на все потомки, явных `pointer-events:auto` переопределений нет — grep пуст) | smoke `pointerTransparent` (реальный `getComputedStyle` на host и на `.remote`) | клик/пан/зум-регрессия не смокирована отдельным сценарием (spec §14 п.4 упоминает её) — **проверено чтением**: слой добавлен как sibling после существующей разметки, не оборачивает markers, `pointer-events` наследуется; структурного пути к перехвату клика нет |
| AC12 LQI visual | доказан | `hp-zigbee-topology-overlay.ts:185-189` (цвет по `lqiColor`, unknown → пунктир), `zigbee-topology.ts:314` (направление hovered→neighbor, без усреднения) | unit (случай `lqi: undefined`) | чтением; golden-сценарий заявлен в ТЗ §14.5, полный golden не прогонялся (см. таблицу гейтов) |
| AC13 ZHA contract | доказан | `zigbee-topology-runtime.ts:137-145` (только `zha/devices`, никогда `zha/topology/update`) | unit `zigbee-topology.test.mjs:116-136` | мутант `zigbee-topology-zha-read-starts-scan` (CI green) |
| AC14 Z2M contract | доказан с оговоркой | `zigbee-topology-runtime.ts:186-234` (transaction, timeout, retained/foreign фильтрация, cleanup в `finally`) | unit `zigbee-topology.test.mjs:138-184` | мутанты `zigbee-topology-z2m-foreign-response-accepted`, `zigbee-topology-z2m-subscriptions-leak` (CI green) — **но см. Medium M1**: путь «невалидный JSON на верном топике» не покрыт ни одним тестом и содержит реальный дефект |
| AC15 no implicit work | доказан | `zigbee-topology-runtime.ts:98-112` (`run()`, inflight `Map`) | unit `zigbee-topology.test.mjs:116-131` (2 конкурентных вызова → 1 `callWS`) | чтением + unit assert `calls===1` |
| AC16 failures | доказан с оговоркой | `zigbee-topology-runtime.ts:84-96` (`errorCode`/`fail`) | unit (permission, timeout пути) | **см. Medium M1** — `invalid_payload` код де-факто недостижим на response-топике Z2M |
| AC17 privacy | доказан | `zigbee-topology-settings.ts:1-4` (единственный персистируемый тип — `{enabled, z2mBaseTopics}`), нет `console.*`/`localStorage` в новых файлах (grep пуст), `support_package.py` — allow-list, не тронут, но уже исключает `zigbee_topology` по построению | unit (`zigbee-topology.test.mjs:33-44`) + backend regression `tests_backend/test_support_package.py` (`zigbee_topology not in plan["settings"]`, топик-строка не встречается в сырых байтах) + reviewer code audit (эта строка — часть требуемого доказательства AC17) | **Low-находка L1** по `diagnostics.py` — см. ниже, не про AC17 буквально (IEEE/raw topology туда физически попасть не может — эти данные никогда не пишутся в `settings`) |
| AC18 bounds/performance | доказан | `demo/benchmark_zigbee_topology.mjs`, лимиты `zigbee-topology.ts:63-66` (`TOPOLOGY_MAX_*`) | **лично прогнан** `npm run benchmark:zigbee-topology` — все 4 метрики в 5-13× запасе от бюджета | численный прогон — самодоказательство |
| AC19 lazy boundary | доказан | `zigbee-topology-overlay-bridge.ts:19` (`void import(...)`), `hp-zigbee-topology-settings.ts:89-91` (динамический импорт runtime) | `dist/houseplan-assets.json`: 3 новых chunk'а (`hp-zigbee-topology-overlay-*`, `zigbee-topology-*`, `zigbee-topology-runtime-*`) находятся только в `lazyFiles`, не в `initialViewFiles` | сверено вручную по сгенерированному манифесту; `initialViewGzipBytes` вырос всего на 490 B (294865→295355, см. заметку ниже) |
| AC20 i18n | доказан | `src/i18n/topology/{en,ru,de,fr}.json` | **лично прогнан** diff ключей — 27/27/27/27, `remote_count` не требует русской числовой формы (число не согласуется с существительным, стиль совпадает с прочими проектными ключами вида `"ещё {n}"`) | сравнение множеств ключей |

## Находки

### Medium (в скоупе, чинится в этой же задаче)

**M1 — невалидный ответ Zigbee2MQTT на верном топике зависает на полный 150-секундный таймаут и репортит `timeout` вместо `invalid_payload`.**

`src/zigbee-topology-runtime.ts:211-215`:
```ts
const value = parseMessage(message);
if (value && transactionOf(value) === transaction) responseResolve?.(value);
```
`parseMessage` (`:151-156`) при ошибке `JSON.parse` молча возвращает `null`.
Раз `value` ложно, ветка просто ничего не делает — `responseResolve` не
вызывается никогда для этого сообщения, и нет отдельной ветки, которая бы
пометила «получили мусор на верном топике с верной transaction» как
`invalid_payload`. Воспроизвёл лично (не поверил отчёту подагента на слово):

```
node --input-type=module -e "
import { refreshZ2mTopology, zigbeeTopologyRuntimeSnapshot } from './test-build/zigbee-topology-runtime.js';
... // подписка на bridge/response/networkmap отвечает 'not-json-garbage'
await refreshZ2mTopology(hass, 'zigbee2mqtt', 2000);
"
# elapsed ms 2006
# {"z2m:zigbee2mqtt":{"phase":"error","error":"timeout"}}
```

С реальным таймаутом 150 000 мс это значит: если Z2M/брокер вернёт битый
payload на правильный топик и с правильной transaction (повреждённая сеть,
несовместимая версия Z2M, прокси-мидлварь), пользователь увидит "Загрузка…"
**2.5 минуты**, а затем получит `error_timeout` («провайдер не ответил
вовремя») — хотя ответ пришёл и был получен, просто не распарсился. Это прямо
противоречит AC16 («invalid payload... дают локализованный status») в той
части, что статус обязан быть локализован *под причину*, а не просто не ронять
план: код `invalid_payload` в `ZigbeeTopologyErrorCode` существует специально
для этого случая, но недостижим с этого пути. Ни один существующий тест не
шлёт невалидный JSON на response-топик (`test/zigbee-topology.test.mjs`
проверяет только `retain`/foreign-transaction фильтрацию и «нет retained
info» — не «мусор в самом response»).

Правка в скоупе: в обработчике `bridge/response/networkmap` отличать «не наш
пакет» (нет transaction/чужая transaction — игнорировать и ждать дальше) от
«наш топик, наша transaction, но `parseMessage` вернул `null`» (сразу
`responseResolve`/reject с `invalid_payload`, не дожидаясь дедлайна).

### Low (сняты этим ревью с запиской, правка не обязательна)

**L1 — `custom_components/houseplan/diagnostics.py:41` отдаёт `config.get("settings", {})` без фильтрации**, то есть `zigbee_topology.enabled` и введённые `z2m_base_topics` (потенциально идентифицирующая MQTT-строка, например `private/site/zigbee2mqtt` — ровно такой пример использует тестовая фикстура #43/#54) попадают в стандартный HA "Download diagnostics" отчёт целиком. Это **не нарушает AC17 буквально**: AC17 и `docs/CONFIG-COMPATIBILITY.md` говорят про «IEEE/raw topology» и «provider snapshots», которые физически не персистятся и потому не могут попасть в diagnostics ни при каких условиях — а «diagnostics» отдельно от «support report» в тексте AC17 относится именно к этому неотфильтрованному core-механизму HA. `docs/SUPPORT-PRIVACY.md`, где явно упомянуты «base topics», описывает другую фичу — приватный support-relay (`support_package.py`), которая уже корректно фильтрует по allow-list и покрыта регрессионным тестом. Кроме того, поведение `diagnostics.py` (сырой дамп `settings` без редактирования, кроме `markers`) — не новое для #54: оно уже применялось ко всем существующим полям настроек до этой задачи. Снимаю без требования правки в рамках #54; стоит завести отдельным улучшением редактирования `diagnostics.py` по образцу `support_package.py`, если владелец сочтёт MQTT base-topic достаточно чувствительной строкой — это будет самостоятельная задача над всем diagnostics.py, а не точечная правка #54.

**L2 — `pushDirectionalLink` (`zigbee-topology.ts:114-126`) маркирует код `duplicate_link` как для байт-идентичных повторов, так и для конфликтующих значений одного направления** (сохраняется первое, второе отбрасывается с тем же кодом предупреждения). §9 ТЗ говорит про «exact duplicates», что подразумевает идентичность, а не любое повторное наблюдение. Функционально безопасно (не изобретает и не усредняет значения), просто имя предупреждения шире факта. Не требует правки — уточнение семантики кода предупреждения, а не дефект поведения.

**L3 — плотность диффа в нескольких местах указывает на автоматическую вставку без переноса строки** (`houseplan-card.ts`: `import ... './device-marker-geometry'; import { renderZigbeeTopologyOverlay } ...` на одной строке; аналогично в `houseplan-editor-runtime.ts` в нескольких местах, плюс однострочная вставка `<hp-zigbee-topology-settings ...>` в `_renderSettingsDialog`). Только стиль/читаемость, не влияет на поведение или типизацию (`tsc`/eslint не жалуются на длину строк в проекте). Снимаю без требования правки.

## Что проверено и корректно

- Полная цепочка defence-in-depth для admin-гейта (bridge-render, widget UI,
  runtime `requireAdmin`) — три независимых точки отказа, лично воспроизвёл
  снятие одной из них и убедился, что smoke ловит регресс.
- Инвариант «route не создаёт рёбер» (AC5) — лично воспроизвёл мутацию,
  существующий unit-тест ловит регресс; ТЗ требовало именно mutation witness,
  теперь он есть (пусть и не оформлен как постоянная запись в
  `scripts/mutation-gate.mjs` — для чистого юнита текущее ревью засчитывает
  это как достаточное доказательство).
- Приватность на уровне персистентной конфигурации (AC17 буквально): IEEE,
  узлы, связи, ошибки провайдера физически не могут попасть в
  `settings`/backup/export/support-report — они существуют только в
  runtime-кэше (`WeakMap`), который никогда не сериализуется. Backend-тест
  `tests_backend/test_support_package.py` подтверждает это для
  support-пакета конкретным regression-кейсом.
- Ленивая загрузка (AC19): три новых chunk'а физически отсутствуют в
  `initialViewFiles` манифеста; прирост initial-view бандла — 490 B (наличие
  bridge-функции и её условного `import()`).
- Производительность (AC18): лично прогнанный бенчмарк на 500 узлах/2979
  связях укладывается в бюджет с 5–13-кратным запасом по всем четырём
  метрикам.
- i18n-паритет (AC20): 27/27/27/27 ключей en/ru/de/fr идентичны по составу;
  видимый текст в UI-строках User Guide (RU) совпадает буквально с ключами
  `toggle`/`zha_read`/`z2m_update` в `src/i18n/topology/ru.json`.
- Полный CI Validate на точном SHA `a2867df9`: типы/юниты/мутанты/бандл-синхрон,
  все 3 браузерных smoke-шарда и perf-smoke — green; единственный красный job
  (`golden`) — три ожидаемых, топологически объяснимых кадра общих настроек,
  не принятых намеренно (правильное поведение по PROCESS.md).
- `settings.zigbee_topology` зарегистрирован в `scripts/config-field-registry.mjs`
  и проходит `node scripts/config-audit.mjs` без ошибок; backend Python не
  тронут ни одним файлом, что совпадает с явным заявлением ТЗ.

## Чего не проверял

- **Golden-изображения не пересматривал попиксельно.** Доверяю описанию
  автора (3 кадра, все из экрана общих настроек, вертикальный сдвиг от новой
  секции) и факту, что job `golden` в CI на этом SHA дал ожидаемый и
  локализованный красный результат, а не разлетелся по всему матриксу.
  Полный `golden:verify`/`golden:capture` локально не прогонял — это
  предрелизный гейт (PROCESS.md §8), эталоны принимаются отдельно перед
  бетой через `npm run golden:accept -- --reviewed` на Linux CI-артефакте.
- **Полный локальный прогон всех 221 браузерных смоков не делал** — CI
  Validate на точном SHA уже прогнал все 3 шарда + сводный job зелёным;
  дублирование того же прогона на той же ревизии ничего нового не покажет.
  Лично перепрогнал только целевой `smoke_zigbee_topology_hover.mjs` и
  дважды мутировал код (AC3, AC5), чтобы убедиться, что смок/юнит умеют
  падать.
- **Клик/пан/зум-регрессия при видимом hover-слое** — не смокирована ни
  автором, ни мной отдельным сценарием (заявлена в §14 ТЗ пунктом плана
  автотестов, но `demo/smoke_zigbee_topology_hover.mjs` её не реализует).
  Оценил как низкий риск по коду (`pointer-events:none` наследуется,
  слой добавлен sibling'ом, не оборачивает markers) — доказательство
  «чтением», не исполнением. Не поднимаю до Medium, так как это пробел в
  тестовом покрытии одной из многих defence-in-depth гарантий, а не
  найденный дефект поведения.
- **Немецкий/французский текст на предмет естественности формулировок** —
  проверил только паритет ключей и отсутствие technical/raw-текста; носитель
  языка эти переводы не вычитывал (как и остальные i18n-задачи проекта).
- **`custom_components/houseplan/diagnostics.py`** — прочитан и находка L1
  зафиксирована, но не проверял остальные существующие поля `settings` на
  предмет того, не более ли они уже чувствительны (вне скоупа #54).
- **Мультипровайдерный (ZHA+Z2M одновременно) сценарий на реальном браузере**
  — логика дедупликации `resolveMappedTopologyHover` проверена юнитом и
  рассуждением (Map/Set по `markerId` в общем цикле по топологиям), но нет
  browser-smoke с двумя одновременно активными провайдерами.

## Вердикт

Один Medium-дефект в скоупе задачи (M1, Z2M invalid-payload на response-топике
маскируется под `timeout` на 150 секунд) — без High это жёлтый вердикт,
возврат автору на исправление в этом же issue (PROCESS.md §2.7, §4). Все 20 AC
прослеживаются к коду и тестам; 19 из 20 не имеют замечаний; missing route-
inference mutation witness для AC5 закрыт лично в ходе этого ревью и не
требует действий автора. Три Low-находки (L1–L3) сняты с запиской, правка не
обязательна.

Вердикт: жёлтый · заход r1 · блокирующих циклов 1/4 · High: 0 · Medium: 1 → в задаче

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/54-zigbee-topology-hover`, коммит `a2867df9a224` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `90d12b3a6980a4537b454e8a922212ac9ce0fed3`
  ```
  git log --all --format='%H %T' | grep 90d12b3a6980
  ```
