# CODE-REVIEW-500-r2

- **Issue:** #500 — Архитектура: выделить одну границу владения config/adoption
- **Материал:** `93c6c7551b3a7f3df1901e69888611b1a7375ac4` (ветка `issue/500-config-adoption-boundary`); рабочая копия была на этом SHA на момент старта ревью
- **Заход:** r2 · блокирующих циклов израсходовано 1/4 до этого раунда

## Почему разбор полный, а не по дельте

Конвейер привёл ветку к `dev` перед ревью: поверх материала r1 (`0905f67e` / его копия после переноса истории — `da9a58bf`) легло три коммита `dev`
(`f6eac1d9`, `67c780a7`, `2783ceff` — перестройка джоба «Мутанты по диффу» на 6 шардов с предварительным планированием, #518). После ребейза это
другой код (PROCESS.md §7.2), поэтому разбор в этом раунде — полный, не ограниченный дельтой r1→r2.

Фактическая проверка: `git diff da9a58bf 93c6c755` (вне `dist/**` и бандл-деревьев) показывает, что содержимое самой задачи №500
(`src/**`, `test/**`, `docs/specs/**`) **не изменилось** — ребейз принёс исключительно инфраструктурные правки `.github/workflows/validate.yml`,
`scripts/mutation-gate.mjs`, `PROCESS.md`, `test/mutation-gate.test.mjs`, `test/validate-*.test.mjs` (#518, не связано с #500). Правки самой
задачи r1→r2 — единственный коммит `93c6c755` (тот же, что `da9a58bf`, с иным родителем), закрывающий Medium-1 r1. Несмотря на это, ниже
разобран весь диапазон `origin/dev...HEAD` (34 нестандартных файла, ~2864/-396 строк), а не только коммит M1-фикса — так требует правило
полного разбора при ребейзе, и по факту в ходе разбора это окупилось (см. находку M1-2 ниже, обнаруженную независимым прогоном, а не чтением диффа).

## Скоуп

Извлечение владения идентичностью `{config, rev, fingerprint} × {layout, rev, fingerprint}` в `src/config-adoption.ts`; единая
гейт-последовательность `adoptAuthoritativeGated` (compare → prepareImage → continuity → adopt → хвост профиля) для семи вызывающих в
двух профилях (`reload`/`post-write`); сужение `SummaryPanelHost` и host-контрактов editor-/onboarding-runtime; перенос `rollbackOptimistic`
в модуль; единственное намеренное изменение поведения — гейт готовности фона на четырёх post-write путях, ревизии `space/delete` берутся из
`config/get`/`layout/get`, а не из ответа `delete`. `User-Visible: no` на всех двенадцати коммитах диапазона, changelog не тронут (подтверждено
диффом — ни один файл `docs/CHANGELOG*.md` не изменён).

M1-фикс этого раунда (`93c6c755`): все четыре post-write вызывающих (`_deleteSpace` × 2 рантайма, `_undoPlanOptimization`, `_applyBackupImport`)
теперь при `adopted.status !== 'adopted'` полностью пропускают хвост (тост, выбор пространства, очистки, `_cacheSnapshot`), освобождают `busy`
своего диалога и выходят — как это уже делали три reload-пути.

## Как проверялось

**Дешёвые гейты — не гонял заново отдельно, но перепроверил напрямую.** Validate на точном материале (`93c6c755`) зелёный целиком:
https://github.com/Matysh/houseplan-card/actions/runs/34472616328 (`headSha` подтверждён). Из осторожности (полный разбор) всё равно
прогнал сам и получил тот же результат: `npx tsc -p tsconfig.test.json` + `npm run build` (tsc --noEmit + rollup) — чисто; `npm test` —
**2508 pass / 0 fail / 1 skip**; `npm run bundle:sync` — дерево `dist`/`custom_components/houseplan/frontend`/`demo/srv/assets` совпадает
(рабочая копия чистая после сборки, `git status --short` пуст); `npm run bundle:budget` — initial View 299 774 Б (потолок 300 300 ±2000,
запас budget 1292 Б, известное предупреждение низкого запаса #367/#474, не блокирует); `node scripts/no-new-any.mjs` — 0 новых `any` на
596 добавленных строках `src/**`. `node --test test/core-file-budget.test.mjs` — 7/7, `houseplan-card.ts` 13605 строк < потолка 13650.

**ВАЖНО, разошлось с записью в хендоффе (Matysh, комментарий #12):** «Мутанты по диффу» и «Смоки в браузере» в прогоне `34472616328`
имеют статус **`skipped`**, не `success` — это обычный push без `Release:`, тяжёлые джобы на нём не запускаются (см. PROCESS.md §8, ожидаемо).
Формулировка «Validate зелёный целиком» в контексте этой задачи верна буквально (все незапущенные джобы = `skipped`, это не красный), но
**не покрывает** ни один из четырёх мутантов-защитников (`config-adoption-echo-clears-history`, `config-adoption-rev-from-foreign-response`,
`config-adoption-rollback-ignores-rev`, `post-write-skips-asset-gate`), ни браузерные смоки. Прогнал их лично:

```
node scripts/mutation-gate.mjs --id=config-adoption-echo-clears-history        → поймано 1 из 1
node scripts/mutation-gate.mjs --id=config-adoption-rev-from-foreign-response  → поймано 1 из 1
node scripts/mutation-gate.mjs --id=config-adoption-rollback-ignores-rev       → поймано 1 из 1
node scripts/mutation-gate.mjs --id=post-write-skips-asset-gate                → поймано 1 из 1
```

Гард всех четырёх мутантов — `node --test test/config-adoption.test.mjs` (юнит), не браузерный смок; это подтверждает наблюдение r1-ревью,
что `demo/smoke_post_write_adoption.mjs` не зарегистрирован гардом ни одного мутанта и, значит, ни разу не проверялся автоматически на
материале ревью ни в r1, ни здесь.

**Браузерные смоки — прогнал сам (Chromium доступен в этой среде).** Собрал бандл (`npm run build && npm run bundle:sync`, дерево чистое)
и прогнал по прямым совпадениям diff'а (`node scripts/smoke-select.mjs --base origin/dev --head HEAD` → 48 прямых совпадений, порог
«широкого» символа — 47) те, что относятся к изменённому поведению (adoption/rollback/reactivity/M1), а не ко всем 48 — полный прогон
остаётся предрелизным гейтом (PROCESS.md §8):

| Смок | Результат |
|---|---|
| `demo/smoke_post_write_adoption.mjs` (AC4, единственный прямой свидетель, переписан этим раундом) | **КРАСНЫЙ** — 1 проверка из 36 падает, см. находку ниже |
| `demo/smoke_room_resize.mjs` (свидетель реактивности `onBodyReplaced`, красневший на предыдущем кандидате r1) | OK |
| `demo/smoke_summary_panel.mjs` (lost-ACK/summary recovery через `_adoption`) | OK |
| `demo/smoke_danger_confirmation.mjs` (глушит `_adoptAuthoritative`) | OK |
| `demo/smoke_device_position_history.mjs` (тронут диффом, автор не прогонял — «нет Chromium») | OK |
| `demo/smoke_area_relocation_safety.mjs` (тронут диффом, автор не прогонял) | OK |

Остальные 42 прямых совпадения не прогонял — по диффу они читают делегируемые поля (`_cfgRev`/`_layoutRev`/`_model`/`_serverCanWrite` и т.п.)
так же, как раньше (делегаты не меняют семантику чтения), не изменённое поведение; это тот же критерий отбора, что применил r1.

**Инварианты модели** — не запускал: диффом задета идентичность (revision/fingerprint/owner), не геометрия рёбер/толщины/ссылок; ни
`layout` (структура устройств), ни `rooms`/`wall_segments`/`marker.space` не меняют формат или содержимое, меняется только то, кто и когда
пишет их идентичность.

**pytest/golden/perf** — не задеты диффом (backend не тронут ни одним файлом; визуал не меняется — ни один файл рендера/стилей в диффе);
не гонял, как и в r1.

**Один источник числа** — не применимо: `User-Visible: no`, пользователю ничего не показывается; единственные числа в диффе — внутренние
бюджеты сборки (см. AC7), они не дублируются в интерфейсе.

## Находка

### Medium-1 (в скоупе задачи, новая в r2). Единственный автоматический свидетель AC4/M1 красный на материале ревью — `demo/smoke_post_write_adoption.mjs` падает на `onboardingDeleteRefusedAdoptsNothing`, и ни один гейт CI это не поймал

**Воспроизведение (детерминированно, 3/3 прогонов подряд):**

```
npm run build && npm run bundle:sync
node demo/smoke_post_write_adoption.mjs
# ...
# FAILED (1):
#   - onboardingDeleteRefusedAdoptsNothing: expected true, got false
```

**Что происходит.** После M1-фикса смок расширен сценариями с `assetReady=false` (проверка отказной ветки, ровно то, что требовала r1
находка). Для сценария «удаление пространства через onboarding-рантайм при отказе гейта» проверка `card._cfgRev === 10 && card._layoutRev
=== 20 && card._serverCfg.spaces.length === 2 && ...` не проходит: `card._cfgRev` равен **11**, хотя adoption корректно отказал (в `order`
нет `'adopt'`, `retries === 1`, тостов нет, диалог освобождён — то есть сам M1-фикс отработал правильно).

**Причина (доказана чтением и инструментированным прогоном, не догадкой).** `reset()` в смоке (строки 82–93) вызывает
`adoption.restoreCached(...)`, но не отменяет отложенные записи — `_saveConfigDebounced`/`_persistLayout` (существовавший до #500
механизм; другие смоки, например `demo/smoke_danger_confirmation.mjs:196`, явно вызывают `.cancel()` для этой же гигиены). Если к
моменту очередного сценария есть **не связанная с ним** отложенная запись конфига (в этом прогоне она возникает во время предыдущего
успешного `editorDelete`/аналогичного сценария), `_deleteSpace()`/`_applyBackupImport()` в начале своего `try`-блока безусловно вызывают
`this.host._saveConfigDebounced.flush()` (код, не относящийся к #500, не изменён этой задачей) — что немедленно шлёт `houseplan/config/set`
через фейковый `card.hass.callWS`. Смок не обрабатывает этот тип сообщения (`default: return {}`), ответ приходит без `rev`, и
`MutableConfigAdoption.acceptConfigWrite` (одна из трёх санкционированных точек записи ревизии, I1) применяет документированный запасной
вариант «`rev ?? rev + 1`» (§15 п.3 ТЗ) — **к чужому, неотносящемуся к текущему сценарию телу**. Ревизия увеличивается на 1 (10 → 11)
именно в тот момент, когда `onboardingDelete-refused` уже сбросил состояние через `restoreCached`. Поскольку эта конкретная итерация —
refused (гейт отказывает), собственный adoption сценария так и не перезаписывает испорченную ревизию — она доживает до финальной проверки.

Подтверждено инструментированным прогоном (обёртка `acceptConfigWrite`/`restoreCached` во временной копии смока вне репозитория,
рабочая копия репозитория не менялась — `git status --short` пуст на всём протяжении проверки): без правки — `cfgRev: 11` и
трасса показывает лишний `acceptConfigWrite({...}, {})` между двумя `restoreCached`; с добавлением `card._saveConfigDebounced.cancel();
card._persistLayout.cancel();` в `reset()` — трасса чистая (0 лишних вызовов), все четыре refused-сценария дают `cfgRev: 10` корректно.

**Это дефект теста, не продукта.** С реальным backend `houseplan/config/set` всегда возвращает `rev` (см. `custom_components/houseplan/
websocket_api.py:1587-1637`, ответ без `expected_rev`/`rev` — это `conflict`, не успех); запасной вариант `+1` уже задокументирован в ТЗ
§15 п.3 как «с реальным backend недостижимо» и не входит в скоуп этой задачи. Сам M1-фикс (ранний `return`/пропуск хвоста во всех
четырёх вызывающих) при этом подтверждён верным — как прямым чтением диффа (см. таблицу AC ниже), так и тем, что ТРИ из четырёх
refused-сценариев смока (`editorDelete`, `optimizeUndo`, `importApply`) проходят корректно на этом же материале и том же прогоне.

**Почему Medium, а не Low.** Это не стилистическая придирка: единственный автоматический свидетель, который должен доказывать закрытие
r1-находки M1 для конкретно этого пути (`_deleteSpace` в onboarding-рантайме), **красный на материале, поданном на ревью**, и ни один
CI-гейт этого не заметил — «Мутанты по диффу» и «Смоки в браузере» на этом SHA `skipped` (обычный push), а гард всех четырёх мутантов —
юнит-тест, не этот смок. Без ручной проверки (эта проверка — «работает ли оно» и есть мандат ревьюера) дефект теста ушёл бы в `dev`
непойманным, а следующий раунд, который тронет этот файл, унаследовал бы красный тест молча.

**Требуется:** добавить `card._saveConfigDebounced.cancel(); card._persistLayout.cancel();` (или эквивалентную изоляцию) в `reset()`
смока `demo/smoke_post_write_adoption.mjs`, перепрогнать все 36 проверок до зелёного, приложить результат. Правка не продуктового кода —
только `demo/**`, но всё равно проходит ещё один цикл ревью (правило §4: Medium в скоупе чинится и перепроверяется).

## AC → повторно проверено на материале r2

| AC | Статус | Как проверено в этом раунде |
|---|---|---|
| AC1 (идентичность пишет только модуль) | Подтверждено | `node --test test/config-adoption-ownership.test.mjs` (5/5), плюс независимый grep `_cfgRev\s*=`/`_layoutRev\s*=` вне `config-adoption.ts` — ноль совпадений |
| AC2 (семь путей через `adoptAuthoritativeGated`, старый seam не встречается) | Подтверждено | `grep -rl _adoptStructuralResponses src/**/*.ts` → только `config-adoption.ts` (внутренняя функция без подчёркивания); typecheck зелёный |
| AC3 (поведенческая нейтральность, post-write без пост-шагов) | Подтверждено | `node --test test/config-adoption.test.mjs` (25/25); `smoke_summary_panel`, `smoke_danger_confirmation`, `smoke_room_resize` — зелёные, прогнаны лично |
| AC4 (post-write гейт + ревизии из re-read, включая отказную ветку) | **Частично** — код верен (прочитан построчно, все 4 вызывающих симметрично пропускают хвост), но единственный автоматический свидетель красный на материале (Medium-1) | `demo/smoke_post_write_adoption.mjs` — 35/36; unit `post-write profile: a refused gate adopts nothing…` (r1 M1) зелёный |
| AC5 (тёплый старт round-trip) | Подтверждено (унаследовано, не задето диффом раунда) | `test/config-adoption.test.mjs` round-trip кейсы в общем прогоне 25/25 |
| AC6 (optimistic rollback) | Подтверждено (унаследовано) | мутант `config-adoption-rollback-ignores-rev` — поймано 1/1 лично |
| AC7 (бюджеты) | Подтверждено, факт обновлён этим раундом | `npm run bundle:budget` → 299 774 Б, совпадает с записью в `scripts/bundle-budget.mjs`; `core-file-budget` 13605 < 13650 |
| AC8 (документация) | Подтверждено | `docs/ARCHITECTURE.md` абзац о границе присутствует и фактически точен (сверен построчно) |

## Что проверено и корректно

- Сам M1-фикс: все четыре post-write вызывающих (`_deleteSpace` в `houseplan-editor-runtime.ts:8691-8697` и
  `houseplan-onboarding-runtime.ts:477-489`, `_undoPlanOptimization:9575-9576`, `_applyBackupImport:9735-9736`) симметрично проверяют
  `adopted.status !== 'adopted'` и делают ранний `return` до любого хвоста (тост/выбор пространства/очистки/кэш); для `_undoPlanOptimization`
  `finally` по-прежнему снимает `_optimizeUndoBusy` — подтверждено чтением управления потоком, `return` внутри `try` гарантированно
  проходит `finally`.
- `adoptAuthoritativeGated` (`src/config-adoption.ts:415-446`) — единая точка, гейт `prepareImage` вызывается только при
  `structuralChanged`, на отказе не адоптирует ничего и планирует `_scheduleLoadRetry(true)`; корректно для обоих профилей.
- Три из четырёх refused-сценариев смока (`editorDelete`, `optimizeUndo`, `importApply`) реально доказывают отказную ветку своих путей —
  не только код прочитан, но и тест прошёл на живом прогоне.
- Ревизии из delete-ответа больше нигде не читаются (`grep` по `config_rev`/`layout_rev` в теле `space/delete` подтверждает — оба входа
  используют только `config/get`/`layout/get`).
- Бюджеты и trailers всех 12 коммитов диапазона (`Issue: #500`, `User-Visible: no`) — в порядке; `docs/CHANGELOG*.md` не тронуты, что
  согласовано с `User-Visible: no`.
- Три коммита `dev`, принесённые ребейзом (#518, мутанты по диффу на 6 шардов с предварительным планированием), не пересекаются по файлам
  с продуктовым кодом #500 (кроме общего `scripts/mutation-gate.mjs`, куда #500 лишь добавляет свои 4 определения мутантов в конец
  массива — конфликта семантики нет, все 4 подтверждены пойманными лично).

## Чего не проверял и почему

- Полный набор 48 прямых совпадений `smoke-select` — прогнал 6, относящихся к изменённому поведению; остальные 42 диффом не меняют
  семантику чтения (та же логика отбора, что в r1). Полный набор — предрелизный гейт (PROCESS.md §8).
- `npm run invariants` — диффом не задета геометрия рёбер/толщины/ссылок, только владелец ревизии и тела.
- `python -m pytest tests_backend` — backend не тронут диффом.
- `golden:verify`/`performance_smoke` — визуал и перф-профили не в AC и не меняются по диффу.
- `git diff da9a58bf 93c6c755` за пределами `src/**`/`test/**`/`docs/specs/**` (т.е. сами принесённые ребейзом инфра-файлы `validate.yml`,
  `mutation-gate.mjs` §518-часть, `PROCESS.md`) — не проверял по существу: это код `dev`, не материал задачи #500, он уже прошёл свой
  собственный процесс в `dev`.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Medium-1 (все четыре post-write вызывающих не пропускают хвост при `asset-wait`, отказная ветка не тестируется) | Коммит `93c6c755` добавляет ранний `return`/скип хвоста во всех четырёх вызывающих + 1 юнит + 16 новых проверок смока на отказную ветку | `src/houseplan-editor-runtime.ts:8694,9575,9736`, `src/houseplan-onboarding-runtime.ts:480`; `test/config-adoption.test.mjs` тест «post-write profile: a refused gate adopts nothing…»; смок расширен, но красный на 1/36 — см. Medium-1 этого раунда (продуктовый код верен, тест — нет) |
| Low-1 (риск-таблица ТЗ §12 неточна про `static properties`) | Строка риска переписана на фактический механизм (`onBodyReplaced` → `requestUpdate`) | `docs/specs/500-config-adoption-boundary.md`, диф в `93c6c755` |

## Унаследовано из r1 (только то, что дельта r1→r2 не задевает содержательно)

Несмотря на полный разбор кода в этом раунде (обязателен из-за ребейза, см. выше), ниже — фактические выводы r1, которые я **не
пересчитывал заново с нуля**, а верифицировал спот-чеками, совпавшими с r1 буквально (то есть не «доверие на слово», а подтверждение):

- AC1/AC2 точные числа (18 присваиваний `_serverCfg =` в 8 модулях до переноса, allowlist после переноса) — r1 пересчитал вручную по
  `src/**`; в этом раунде перепроверено через `test/config-adoption-ownership.test.mjs` (не переписан диффом M1-фикса) и независимый grep,
  оба совпадают с выводом r1. Документ r1: `docs/reviews/CODE-REVIEW-500-r1.md`, материал `0905f67ec0d8`.
- AC5 (тёплый старт round-trip) и AC6 (rollback) логика — код `config-adoption.ts` в этих методах не тронут коммитом `93c6c755` (diff
  только в `adoptAuthoritativeGated`/асимметрии post-write-вызывающих и bundle-budget-комментарии); r1 проверил их чтением и мутантами,
  здесь перепроверено повторным прогоном тех же мутантов на новом SHA — совпадает.
- Сужение `SummaryPanelHost`/`HouseplanEditorHostPort` (§6.4 ТЗ) — не задето диффом M1-фикса; r1 сверил построчно, здесь не
  пересматривалось заново, только подтверждено отсутствием изменений в `git diff da9a58bf 93c6c755 -- src/summary-panel-host.ts`.

## Материал раунда

- SHA материала: `93c6c7551b3a7f3df1901e69888611b1a7375ac4`
- Дерево: рабочая копия была на этом SHA на момент начала ревью (`git rev-parse HEAD` совпадал); после сборки/тестов дерево осталось
  чистым (`git status --short` пуст)
- ТЗ: `docs/specs/500-config-adoption-boundary.md`, откорректирован в этом же диапазоне коммитом `93c6c755` (риск-таблица §12, допущение
  §15 п.8); зелёное спек-ревью `docs/reviews/SPEC-REVIEW-500-r3.md`
- Предыдущий код-ревью: `docs/reviews/CODE-REVIEW-500-r1.md`, материал `0905f67ec0d8`, вердикт `yellow · High 0 · Medium 1`

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/500-config-adoption-boundary`, коммит `93c6c7551b3a` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `4967ea22e3c4465c17aab7e4ed7bc929f13acc38`
  ```
  git log --all --format='%H %T' | grep 4967ea22e3c4
  ```
- Тело issue: `d4a68d8c756302bcc7b8ec4bf3a7f77ffc88848e51f2b054d58736bfda431ec5`
- ТЗ `docs/specs/500-config-adoption-boundary.md`, блоб `b7b4f02c6ca5a57092a360f1f664656b62ed968c`
  ```
  git log --all --find-object=b7b4f02c6ca5a57092a360f1f664656b62ed968c -- docs/specs/500-config-adoption-boundary.md
  ```
- Вердикт конвейера: `yellow` · High 0
