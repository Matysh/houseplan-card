# Код-ревью issue #174 — r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/174
- **ТЗ:** `docs/specs/174-linked-virtual-light-controller.md` (ревью:
  `docs/reviews/SPEC-REVIEW-174-r1.md`, вердикт зелёный)
- **Диапазон:** `origin/dev..HEAD`, коммиты
  `4a89582` (ТЗ) · `da10b3d` (spec-review doc) · `2f9cced` (реализация,
  `User-Visible: yes`) · `ea2633a` (docs-only, screenshot fingerprint)
- **Ревьюер:** Claude, свежая сессия, без контекста реализации

## Скоуп проверки

Правка меняет authority для manual-eligible виртуального источника света
(точная тройка #107: `binding=virtual` + `is_light=true` + `tap_action=toggle`)
при наличии входящей связи `controls: [marker:<id>]` от реального контроллера:
вместо безусловного перекрытия ручным state теперь реальный driver HA — единый
источник истины, а клик по любому из двух marker переключает реальное
устройство. Несвязанный источник сохраняет поведение #107 без изменений.

Затронуты: `src/devices.ts` (canonical light graph, `resolvedLightSources`),
`src/device-toggle.ts` (`resolveToggleIntent`, `resolveControls`), их тесты,
`demo/smoke_linked_virtual_light.mjs`, документация и оба changelog.
`src/houseplan-card.ts` не тронут — confirmation/re-resolve уже был общим
механизмом через `sameToggleOperationTargets`, что подтверждено чтением.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| Unit | `npm test` | 838/838 pass, 0 fail (совпадает с хендоффом) |
| Build | `npm run build` | зелёный, `dist/houseplan-card.js` создан за 10.9s |
| Три копии бандла | `sha256sum dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js demo/srv/assets/houseplan-card.js` | все три `d79008ee8d74…502e8` — совпадают побайтово и совпадают с SHA-256 из хендоффа |
| Целевой smoke (AC9–AC11) | `node demo/smoke_linked_virtual_light.mjs` | `OK`, все 31 проверка `true` (клик по лампе/контроллеру, HA-tick, Glow/fill/label, touch tap/long-press/pan/pinch/pointercancel, unlink→manual restore) |
| `git status` после build | — | пусто, сгенерированные копии не разошлись с закоммиченными |

**Дисциплина «тест умеет падать» — не поверье, а проверено мутацией:**

1. В `src/devices.ts` временно убрано условие `!control &&` перед перекрытием
   ручным state (возвращена версия бага). Пересборка `test-build` →
   `node --test test/devices.test.mjs` → красные ровно AC1-тесты:
   `issue 174: linked manual virtual source follows controller state…` и
   `issue 174: one cached reverse graph owns linked state…`. Файл восстановлен,
   тесты снова зелёные (78/78 в этом файле).
2. В `src/device-toggle.ts` временно убрана ветка `if (incoming) return
   resolveIncomingControllers(...)` в `resolveToggleIntent`. Пересборка →
   `node --test test/device-toggle.test.mjs` → красные ровно 3 теста AC3/AC4/AC5
   («redirects its toggle to the real controller driver», «source unions all
   drivers…», «keeps partial availability…»). Файл восстановлен, 35/35 зелёные.
3. После обоих восстановлений — полный `npm run build`, сверка трёх копий
   бандла и `git status` пусты: рабочее дерево вернулось к committed-состоянию.

**Не прогонялось, и почему:**

- **Полный набор `demo/smoke_*.mjs` (127 файлов).** Diff ограничен резолвером
  canonical light graph и explicit Toggle; остальные поверхности (проёмы,
  стены, sun, изометрия и т.д.) не затронуты ни одним изменённым файлом.
  Достаточно целевого smoke, названного в AC9–AC11.
- **`npm run golden:verify`.** Проверено чтением фикстур: ни один сценарий
  `demo/golden` не использует комбинацию `binding: virtual` + `is_light` +
  входящую связь `controls: [marker:*]` (`grep` по конфигу голден-сцен не дал
  совпадений на `virtual`/`is_light`). Диапазон изменения не может задеть
  существующие эталоны, а новый не нужен — визуал on/off не меняется, меняется
  только источник его вычисления.
- **`python -m pytest tests_backend -q`.** Diff не касается ни одного файла
  `custom_components/houseplan/**/*.py`; `git diff --stat` подтверждает.
- **Performance-профили.** В ТЗ (§15) заявлено «нового численного budget нет»;
  reverse-граф переиспользует уже существующий кэш `lightGraphOf`
  (`LIGHT_GRAPH_CACHE`, инвалидация по структурному fingerprint конфигурации,
  не по HA state/pointer-событию) — проверено чтением, не исполнением. Профиль
  не назван в AC, оставлен пре-релизному гейту.

## AC — разбор

| AC | Доказательство | Вердикт |
|---|---|---|
| AC1 | unit, мутация красит | Подтверждено |
| AC2 | unit (`resolvedLightSources` с изменённым HA-state и неизменным `virtualLights.rev`, а также с изменённым `rev` без смены driver — оба случая в тесте «one cached reverse graph…») | Подтверждено |
| AC3 | unit, мутация красит; `on.targets[0].via === 'control-marker-driver'`, `toggleOperation(on).kind === 'ha-service'` | Подтверждено |
| AC4 | unit («source unions all drivers…»): `switch.a`+`switch.b`, детерминированный порядок, any-on → `turn_off` объединения | Подтверждено |
| AC5 | unit («keeps partial availability…»): missing/unavailable/ha-disabled пропущены и объяснены `skippedTargets`; zero-driver `dormant` → `command: null`, `noneReason: 'configured-targets-missing'`, `toggleOperation(none) === null` (без `virtual-light` fallback) | Подтверждено |
| AC6 | unit («source unions all drivers…», вторая половина): клик по `relayA`/`relayB` даёт только собственный target каждого, тем же `driverEids`, что участвуют в linked-состоянии источника | Подтверждено |
| AC7 | unit (переименованный тест #107→#174, ветка `unlinked`) + отдельный regression-тест #107 без incoming link (`test/device-toggle.test.mjs:73`, `controls: ['light.saved']` — это исходящая ссылка устройства, не входящая) остался зелёным без изменений | Подтверждено |
| AC8 | ревью кода: `sameToggleOperationTargets` меняет идентичность target set при переходе linked↔manual (unit-тест `unlinked` в device-toggle.test.mjs: `sameToggleOperationTargets(on, unlinked) === false`); confirmation в `houseplan-card.ts` уже переоценивает intent через этот примитив на каждый confirm — проверено чтением `src/houseplan-card.ts:4387-4396`, не исполнением через реальный UI-диалог | Подтверждено (частично чтением) |
| AC9 | smoke `smoke_linked_virtual_light.mjs`: `sourceCallsRelay`, `controllerCallsRelay`, `offTickUpdatesAll`, `controllerTickUpdatesAll`, `noOperationalToggleWhileLinked` | Подтверждено |
| AC10 | тот же smoke: `touchTapCallsOnce`, `longPressOpenedInfo`/`longPressNoService`, `pointerCancelNoService`, `panNoService`, `pinchNoService` | Подтверждено |
| AC11 | тот же smoke: `externalStateUpdateWorks` (HA-tick без клика), `unlinkRestoresManualOff`, `manualToggleRestored` | Подтверждено |
| AC12 | ревью кода + unit: единственный `incomingLightControls()`/`lightGraphOf()` — переиспользован и `resolvedLightSources`, и `resolveControls`/`resolveIncomingControllers`; `grep` не находит второй независимой reverse-graph реализации | Подтверждено чтением |
| AC13 | `npm test` 838/838, включая нетронутые тесты #84/#94/#107; `npm run build` + сверка трёх SHA-256 | Подтверждено |
| AC14 | `git diff --stat origin/dev...HEAD`: ни один файл `custom_components/**/*.py`, `manifest.json`, `hacs.json`, i18n не изменён; в diff нет optimistic-state (смок явно проверяет `noOptimisticVisual`), polling или новых network paths; lock/alarm invariant не затронут (Toggle-путь не касается secure targets) | Подтверждено чтением |

## Что проверено и корректно

- Один reverse-index (`incomingByMarker` в `lightGraphOf`) — единственный
  authority и для `source.on`, и для двух Toggle-путей (клик по linked source,
  клик по controller), как требует AC12/§8.2 ТЗ.
- Lifecycle: добавление связи не стирает `off`-bit (`virtualLights.off` не
  читается/не пишется в linked-режиме); снятие последней связи возвращает
  точное сохранённое значение — подтверждено и unit, и smoke.
- Zero-driver случай — safe no-op (`command: null`,
  `configured-targets-missing`) без отката к `virtual-light` — именно то, что
  требует §9.2 ТЗ и AC5.
- Документация (`docs/LIGHT.md`, `docs/USER-GUIDE.ru.md`,
  `docs/DEVICE-LIGHT-SETTINGS-MATRIX.ru.md`, supersession-заметка в
  `docs/specs/107-virtual-light-toggle.md`) переписана консистентно с новым
  контрактом и терминологией USER-GUIDE («Всегда», «Переключить состояние»,
  «управляет другими источниками света»); оба changelog в том же коммите, что
  `User-Visible: yes`.
- Трейлеры: все четыре коммита несут `Issue: #174`; `User-Visible: yes` только
  на коммите `2f9cced`, который и содержит оба changelog-файла в этом же
  коммите. Follow-up docs-коммит `ea2633a` — `User-Visible: no`, что верно
  (только фингерпринт скриншотов).
- Отсутствие изменений в `src/houseplan-card.ts` — не пропуск, а следствие
  того, что confirmation/`resolveToggleIntent`-flow уже был общим механизмом с
  #94; проверено чтением вызывающего кода.

## Находки

Нет High. Нет Medium. Нет Low.

## Чего не проверял (см. таблицу гейтов выше для причин)

- Полный набор `demo/smoke_*.mjs` (127 файлов) — не запускался, диапазон не
  задевает не затронутые поверхности.
- `npm run golden:verify` — не запускался; проверено чтением, что ни один
  golden-сценарий не использует затронутую конфигурацию.
- `python -m pytest tests_backend -q` — не запускался, backend не тронут.
- Performance-профиль (`benchmark_large_house` и т.п.) — не запускался, budget
  не назван в AC, оставлен пре-релизному гейту.
- Ручной проход через реальный `tap_confirm`-диалог в браузере (AC8) — разобран
  по коду, не исполнялся как отдельный smoke; общий confirmation-механизм не
  получил специального сценария в новом smoke-файле.

## Вердикт

Зелёный. Все 14 AC доказаны — unit-доказательства проверены на способность
падать прямой мутацией кода, targeted smoke пройден живым запуском Chromium,
типы/тесты/сборка зелёные, три копии бандла побайтово совпадают, трейлеры и
changelog на месте. Продуктовое решение владельца (комментарий от 18.08.2026)
реализовано без искажений: связанная пара ведёт себя как два умных
устройства, HA state — единственный источник истины, несвязанный источник не
регрессировал.
