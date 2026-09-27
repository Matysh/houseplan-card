# CODE-REVIEW-464-r2

- **Issue:** https://github.com/Matysh/houseplan-card/issues/464
- **Ветка:** `issue/464-zigbee-topology-layer`
- **Материал:** `git diff origin/dev...HEAD` на SHA `87cab133ac345c2283050bbea27ce73534393794`
  (= текущий `HEAD` детач-чекаута ревьюера, совпадение проверено `git rev-parse HEAD`)
- **Трек:** полный (не менялся с r1)
- **Заход:** r2 · блокирующих циклов израсходовано 1 из 4 (потрачен в r1, жёлтым;
  зелёный вердикт этого раунда цикл не тратит — §4)

## Скоуп раунда

Разбор **по дельте** (PROCESS.md §2.9): предыдущий раунд (`CODE-REVIEW-464-r1.md`,
жёлтый, SHA `276bf193`) закрыт одной находкой High-1. Дельта этого раунда —
`git diff 276bf193..HEAD`, 2 коммита (`0f7b0dff` продукт+тесты+доки,
`87cab133` только `docs/images/screenshots.json`), локальна: правит один CSS-селектор,
расширяет один smoke и добавляет один mutation-gate мутант под уже найденный
дефект. Ребейза на ушедший вперёд `dev` не было, новая подсистема не задета,
контракт поведения не сменился (AC1 из ТЗ не переписан, только доказан) — полный
разбор не требуется, разбираю дельту плюс всё, до чего она дотягивается.

Файлы дельты (без `dist/**` и `custom_components/houseplan/frontend/**`,
класс D — сверены пересборкой, см. гейты):

- `src/styles/devices.styles.ts` — продуктовый фикс (класс A)
- `demo/smoke_zigbee_topology_hover.mjs`, `scripts/mutation-gate.mjs` — тесты (класс B)
- `docs/specs/464-zigbee-topology-layer-order.md`, `docs/TESTING.md`,
  `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`, `docs/images/screenshots.json` —
  документация (класс C)

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| **High-1**: реальный курсор мыши над hovered-source endpoint матчит старое правило `:host([data-pointer-hover]) .dev:hover { z-index: 5 }` (специфичность `(0,4,0)`) сильнее нового `.dev[data-hp-zigbee-topology-endpoint] { z-index: 8 }` (специфичность `(0,2,0)`); оверлей стоит на `z-index: 7` → `5 < 7`, линия рисуется поверх маркера-источника | Добавлено правило той же специфичности что и конфликтующее плюс атрибут endpoint плюс `:hover` — `(0,5,0)`, что строго выше `(0,4,0)` и решает каскад в пользу endpoint независимо от порядка объявления | `src/styles/devices.styles.ts:345` — `:host([data-pointer-hover]) .dev[data-hp-zigbee-topology-endpoint]:hover { z-index: 8; }`. Доказано исполнением: smoke добавил блок с настоящим `page.mouse.move` (не `dispatchEvent`) и `result.realPointerEndpointWins` (`demo/smoke_zigbee_topology_hover.mjs:555-579`); лично прогнан `node demo/smoke_zigbee_topology_hover.mjs` → `OK`, `"realPointerEndpointWins": true`. Тест умеет падать: новый мутант `zigbee-topology-hovered-endpoint-elevation-removed` (`scripts/mutation-gate.mjs:6067-6076`) занижает z-index новой строки до 1; лично прогнан `node scripts/mutation-gate.mjs --id=zigbee-topology-hovered-endpoint-elevation-removed` → «покраснел, как обязан» |

Других находок в r1 не было (Medium: 0).

## Унаследовано из r1

Принято без повторной проверки — делта их не задевает:

- **AC2 (ownership/lifecycle/single-projection)** и **AC3 (casing неизвестного
  LQI)** — доказаны чтением и исполнением в `CODE-REVIEW-464-r1.md` на SHA
  `276bf193a2bec40a3c2fc823d364cbda00ac10d5`; дельта r2 не трогает
  `hp-zigbee-topology-overlay.ts`, `zigbee-topology-overlay-bridge.ts`,
  `houseplan-card.ts` — файлы, где эти AC реализованы.
- **Ревью ТЗ** — `SPEC-REVIEW-464-r1.md`, зелёное, SHA спеки `aae9efb9`.
- **Гейты `typecheck`/`test`/`build`/`bundle`/`no-new-any`/`process-gate`/
  `benchmark:zigbee-topology` на SHA `276bf193`** — зелёный Validate
  (run 33994548645), зафиксировано в `CODE-REVIEW-464-r1.md`.
- **i18n, трейлеры структуры коммитов, cleanup-матрица (pointerleave/touch/
  pen/mode/space/setting/disconnect)** — проверены в r1, дельта их не касается.

## Как проверялось в этом раунде

| Гейт | Статус | Как |
|---|---|---|
| `typecheck` / `npm test` / `npm run build` + 3 копии бандла | ✅ зелёный, не перегонял отдельно | Validate на точном SHA `87cab133`: https://github.com/Matysh/houseplan-card/actions/runs/33996034405 (success) — «дешёвые гейты на этом SHA уже подтверждены». Дополнительно лично прогнал `npm run bundle:sync` (`tsc --noEmit && rollup -c` внутри) для собственного воспроизведения — зелёный, `git status` после чист: пересборка байт-в-байт совпала с закоммиченным `dist/**`/`custom_components/houseplan/frontend/**` |
| `node scripts/check-docs.mjs` | ✅ зелёный | Прогнал сам: `Documentation checks passed (7 files, 12 external links)`; diff трогает `src/**`, отпечаток скриншотов обязателен — коммит `87cab133` обновляет только `sourceFingerprint`/`sourceSha256`, все `imageSha256` побайтно не изменились (сверено чтением диффа `docs/images/screenshots.json`) |
| `node demo/smoke_zigbee_topology_hover.mjs` (прямое совпадение `smoke-select.mjs`) | ✅ зелёный | Прогнал сам после `bundle:sync`: `OK`, включая новый `realPointerEndpointWins: true` |
| Мутант `zigbee-topology-hovered-endpoint-elevation-removed` | ✅ красный при повреждении, как обязан | Прогнал сам: `node scripts/mutation-gate.mjs --id=zigbee-topology-hovered-endpoint-elevation-removed` → «поймано 1 из 1» |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | ✅ выполнен | Прямое совпадение: только `smoke_zigbee_topology_hover.mjs` (уже прогнан выше). 29 слабых связей — все по одному распространённому символу `_mode`; дельта не трогает переключение режимов (только CSS-селектор hover/endpoint и тесты/доки) — решил не гонять, риска регрессии не вижу |
| `npm run golden:verify` | не гонял | В `demo/golden/**` нет Zigbee-topology-сценария (проверено чтением `demo/golden/matrix.mjs` и содержимого `demo/golden/`); дельта не расширяет видимый в golden рендер, а обновлённый скриншот-фингерпринт уже подтверждён `check-docs.mjs` и байт-в-байт сверкой `imageSha256` |
| Остальные 6 из 7 старых мутантов задачи + полный `mutation-gate.mjs --check` | не гонял | Не задеты дельтой (файлы мутантов для AC2/AC3 не менялись); наследую зелёный статус r1/хендоффа автора; полный `--check` — предрелизный объём, несоразмерен точечной правке |
| `npm run invariants` | не гонял | Дельта не трогает геометрию комнат/стен, `layout`, `marker.space`, `open_spans` — только экранный z-index topology-оверлея |
| `python -m pytest tests_backend` | не гонял | Диапазон не трогает `custom_components/**/*.py` |
| `npm run benchmark:zigbee-topology`, `bundle:budget`, `no-new-any`, `process-gate --issues` | не гонял | Не задеты дельтой; зелёный статус наследую из Validate на `87cab133` и хендоффа автора r2 (перечислены поимённо в его комментарии) |

## Что проверено и корректно

- **Специфичность CSS разрешает конфликт правильно.** Новое правило
  `:host([data-pointer-hover]) .dev[data-hp-zigbee-topology-endpoint]:hover`
  весит `(0,5,0)` — строго больше конфликтующего `:host([data-pointer-hover])
  .dev:hover` `(0,4,0)` — независимо от порядка объявления в файле. Проверено
  и расчётом, и (сильнее) реальным исполнением через `page.mouse.move`.
- **Нет скрытых конфликтов той же природы.** Перепроверил чтением все
  `z-index`-правила `devices.styles.ts` (`grep`) — единственная другая
  hover-зависимая пара (`.dev:focus-visible { z-index: 5 }`) реагирует на
  клавиатурный фокус, а не на реальный курсор; топология активируется только
  реальным mouse-hover (зафиксировано ещё в аналитике issue: «touch и kiosk не
  меняются, топология доступна только admin + mouse hover»), так что этот путь
  не достижим для endpoint-элементов и не относится к AC1.
- **Мутант защищает именно новую строку**, а не дублирует старый: `find`/
  `replace` бьёт по селектору с `:hover`, отличному от базового
  `zigbee-topology-endpoint-elevation-removed`; `id` уникален
  (`grep -c` = 1 по всему файлу).
- **Регрессионный smoke использует настоящий курсор**, а не синтетический
  `dispatchEvent` — то же средство, которым сам дефект был найден в r1;
  ждёт до 5 c появления `:hover` + атрибута + отрисованной линии перед
  сравнением `getComputedStyle(...).zIndex`, что исключает гонку с отрисовкой.
- **Документация и трейлеры.** `CHANGELOG.md`/`CHANGELOG.ru.md` в одном
  коммите с `User-Visible: yes` (`0f7b0dff`), формулировка «including the one
  under the pointer» / «включая маркер прямо под курсором» точно описывает
  зафиксированное поведение и не расширяет сам контракт. `docs/TESTING.md` и
  ТЗ `docs/specs/464-...md` получили по абзацу, описывающему именно этот
  инвариант (реальный `:hover` vs синтетический `pointerover`) — согласуется
  с находкой r1 дословно. `87cab133` несёт `User-Visible: no` — корректно,
  видимых кадров это не меняет (imageSha256 не тронут).
- **Инварианты модели вне периметра** — дельта не касается геометрии,
  подтверждено чтением диффа: единственный продуктовый файл — CSS-стили.

## Чего не проверял

- Полный `mutation-gate.mjs --check` (весь проект) и оставшиеся 6 старых
  мутантов задачи — несоразмерно точечной правке, не задеты дельтой.
- `npm test` целиком и `npm run build` отдельным прогоном юнит-сьюта — положился
  на зелёный Validate точного SHA `87cab133`; лично воспроизвёл только
  `tsc --noEmit && rollup -c` через `bundle:sync`.
- 29 смоков со слабой связью по символу `_mode` — не гонял, дельта не трогает
  переключение режимов; решение зафиксировано в таблице гейтов.
- Реальное touch/pen устройство за пределами эмуляции `pointerType` — тот же
  довод, что и в r1: различие смок/реальное устройство здесь не той природы,
  что в закрытой находке (`pointerType` — явное поле события, не завязано на
  hit-testing браузера, в отличие от `:hover`).
- Визуальный скриншот итоговой сцены — числовой `getComputedStyle(...).zIndex`
  уже является единственным источником, управляющим порядком отрисовки;
  дополнительный кадр ничего не добавил бы.

## Единый источник числа

Дельта не вводит и не меняет пользователем видимую величину (числовое
значение, дублируемое в двух местах интерфейса) — правится исключительно
порядок отрисовки (`z-index`), самого числа/значения пользователю не
показывается. `test/single-source-numbers.test.mjs` не затрагивается дельтой
(файл не менялся, диапазон не относится к value-badge/подписям).

## Вывод

High-1 из r1 закрыт: причина (специфичность CSS `:hover` выше специфичности
endpoint-правила) устранена добавлением правила ещё большей специфичности,
доказано личным исполнением smoke с настоящим курсором и личным исполнением
нового защитного мутанта, который краснеет при откате правки. Других находок
не внесено. AC2/AC3 наследуются из r1 без повторной проверки — дельта их не
касается. Документация и трейлеры в порядке.

**Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/464-zigbee-topology-layer`, коммит `87cab133ac34` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `445cc106c18942021aa8209aeac33ac47f1ccbda`
  ```
  git log --all --format='%H %T' | grep 445cc106c189
  ```
- ТЗ `docs/specs/464-zigbee-topology-layer-order.md`, блоб `043ada287e048ed9750080c342b2a2fdb869d9f0`
  ```
  git log --all --find-object=043ada287e048ed9750080c342b2a2fdb869d9f0 -- docs/specs/464-zigbee-topology-layer-order.md
  ```
