# CODE-REVIEW-561-r1

**Issue:** #561 «сохранить identity карточек Masonry после reload»
**Материал:** `bb35af993a4d5cc17376568155eefc83fc44822e` (единственный коммит на ветке `issue/561-masonry-identity`, `origin/dev..HEAD`)
**Заход:** r1 · блокирующих циклов израсходовано 0 из 4
**ТЗ:** тело issue #561, раздел `## ТЗ`; ревью ТЗ — `docs/reviews/SPEC-REVIEW-561-r2.md`, вердикт зелёный

## Скоуп

Один коммит, класс A (`src/summary-panel-identity.ts`, `src/summary-panel-runtime-loaded.ts`,
`src/summary-panel.ts`) + класс B (`scripts/mutation-gate.mjs`, тесты) + класс C
(`docs/ARCHITECTURE.md`, `docs/TESTING.md`, оба changelog) + класс D (синхронные бандлы
`dist/**`, `custom_components/houseplan/frontend/**`).

Продуктовая правка: identity сводной панели в native HA Masonry теперь строится из
канонического `hui-masonry-view.cards` (порядок конфигурации), а не из фактического
DOM-пути через визуальные `.column`. Для вложенных карточек (stack/conditional)
добавляется детерминированный composed-suffix. Пока canonical anchor не разрешён —
identity `null`, настройка работает только в сессии, localStorage не трогается.
Старые DOM-path ключи не мигрируются (Q1, зафиксировано в ТЗ).

## Как проверялось

### Прочитанное внешнее допущение — проверено, а не принято на веру

Реализация целиком опирается на утверждение «`hui-masonry-view.cards` — публичный
массив top-level card elements в исходном порядке `viewConfig.cards`, и Masonry только
перекладывает эти же элементы по визуальным колонкам, не трогая массив». Это прямо
названный риск в хендоффе автора. Проверил чтением закреплённого проектом исходника
HA frontend `20260729.7` (то же дерево, на которое ссылается S2-аналитика):

- `hui-masonry-view.ts`: `@property({ attribute: false }) public cards: HuiCard[] = [];`
  — публичное свойство; `_createColumns()`/`_addCardToColumn()` берут элемент из
  `this.cards[index]` и `appendChild` его в `columnEl` (или оборачивают в
  `hui-card-options` для preview) — сам массив `cards` не переупорядочивается и не
  фильтруется, меняется только физическое размещение уже существующих элементов.
- `hui-view.ts`: `_createCards()` строит `this._cards = config.cards.map(...)` — 1:1 с
  `viewConfig.cards`, то есть с порядком конфигурации.

Допущение подтверждено чтением реального пиннутого источника, не только ссылкой на
номера строк из комментария автора.

### Ручная трассировка алгоритма (без исполнения)

Прошёл вручную `masonryPlacement`/`descendantPath` на nested-фикстуре теста
`#561 nested Masonry cards use a stable descendant suffix` (shadow-root между
`hui-vertical-stack-card` и внутренним div) и получил ту же строку, что утверждает
assert (`masonry-v2:0/shadow-root/div:0/houseplan-card:0`) — код читается корректно,
`childToken` правильно эмитит токен `shadow-root` на границе `getRootNode().host`.

### Автотесты — запущены лично, не только процитированы из хендоффа

```
npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs
node --test test/summary-panel.test.mjs test/summary-panel-runtime.test.mjs
```
→ 30/30 passed, включая все 6 новых `#561`-тестов и непереписанный `#437 placement
identity survives Masonry reflow and inner-card remount` (адаптирован под canonical
`cards`, семантика — та же: reflow/remount не меняют ключ).

```
node scripts/mutation-gate.mjs --id=summary-masonry-identity-uses-visual-dom-path
```
→ `ok чистый прогон` + `ok summary-masonry-identity-uses-visual-dom-path: тест
покраснел, как обязан` — AC7 подтверждён самим прогоном, не заявлением автора.

```
node scripts/no-new-any.mjs --base origin/dev --head HEAD
```
→ «Проверено добавленных строк в src/**/*.ts: 86 в 3 файл(ах). Новых any нет.»

```
node scripts/smoke-select.mjs --base origin/dev --head HEAD
```
→ НЕОПРЕДЕЛЁННОСТЬ (0 связанных смоков; символы вроде `masonryPlacement`,
`descendantPath` нигде не упоминаются смоками). Решение: не прогонять браузерный
смок в этом раунде — правка невизуальна (нет DOM/CSS/рендер-изменений, ТЗ §6 это
прямо утверждает), а production-shaped summary-panel smoke по AC8 явным решением
ТЗ вынесен на prerelease-гейт. Полная матрица — предрелизная обязанность.

### Собственная отрицательная проба AC4 (fail-closed), не заявленная автором

AC7-мутант в реестре покрывает только AC1/AC2/AC3 (визуальный DOM-путь вместо
canonical index). Отдельно защитный AC4 («unresolved never falls back») мутантом в
реестре не назван. Снял guard вручную и вернул код обратно:

```diff
-  if (masonry.kind === 'unresolved') return null;
+  // mutant: unresolved falls back to structural path instead of fail-closed
```

Прогон `node --test --test-name-pattern="561" test/summary-panel.test.mjs
test/summary-panel-runtime.test.mjs` дал 2 красных из 5: `unresolved Masonry stays
session-only…` (ожидалось отсутствие get/set в localStorage) и `unresolved native
Masonry identity never falls back to a visual DOM path` (получил
`'hui-masonry-view/div:0/houseplan-card:0'` вместо `null`). Файл возвращён в исходное
состояние, `git status`/`git diff --stat` после отката — пусто, повторный чистый
прогон — 5/5 ok.

### Таблица «AC · чем доказан · чем краснеет» (§435)

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 full reload/rebalancing | `test/summary-panel.test.mjs`: `#561 full Masonry reload uses canonical cards…` (запущен лично) | мутант `summary-masonry-identity-uses-visual-dom-path` (запущен лично, PASS: тест краснеет) |
| AC2 одинаковые карточки | тот же тест (`Set` size 3, `notEqual` C/B) + `#561 identical Masonry cards reload their own local preferences` (рантайм, запущен лично) | тот же мутант — визуальный DOM-путь схлопывает индексы по колонке |
| AC3 живой reflow/remount/nested | `#437 placement identity survives…` + `#561 nested Masonry cards use a stable descendant suffix` (оба лично запущены) | тот же мутант для reflow-части; nested suffix — проверено чтением (трассировка выше) и тестом, покрывающим сам механизм `childToken`/`descendantPath` |
| AC4 fail-closed | `#561 unresolved Masonry stays session-only…`, `#561 unresolved native Masonry identity never falls back…` | собственная проба выше (guard снят вручную → оба теста красные, `null` заменился на структурный путь) |
| AC5 upgrade policy | `#561 unresolved Masonry stays session-only…` (старый ключ не читается/не трогается, новый берёт legacy-seed для масштабов и `show=false`) | без легаси-сида тест `assert.deepEqual(runtime.local, {…icon_scale:1.2, font_scale:0.9})` красит на дефолтах 1/1; без «не читать старый ключ» упал бы `assert.equal(browser.reads.includes(oldKey), false)` — оба ассерта реальны, тест прогнан лично |
| AC6 совместимость #437/#493 | fallback-ветка (`enclosingNativeCard`/`structuralPath`) байт-в-байт унаследована из до-#561 кода и гейтится только новой проверкой «нет ли `hui-masonry-view` в цепочке»; упражняется существующими `#493`-тестами в `summary-panel-runtime.test.mjs` (`hostFixture()` без masonry-предка) — прогнаны лично в составе тех же 30/30 | проверено чтением: ветка `not-masonry` не изменена диффом |
| AC7 mutation witness | сам мутант в `scripts/mutation-gate.mjs`, id `summary-masonry-identity-uses-visual-dom-path` | запущен лично (см. выше), 1 из 1 поймано |
| AC8 стандартные гейты | Validate green на `bb35af99`: https://github.com/Matysh/houseplan-card/actions/runs/34724545711 (typecheck/test/build) + лично `no-new-any`, `mutation-gate --id=…`, `check-docs` (warn-режим — как на обычном push) | — (не защитный AC, обычная сверка) |

## Что проверено и корректно

- Ветка/трейлеры: один коммит, `Issue: #561`, `User-Visible: yes`, оба changelog
  (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правлены в этом же коммите.
- `docs/ARCHITECTURE.md` и `docs/TESTING.md` описывают новый резолвер и границы
  проверки — по существу и без противоречий коду.
- `summaryLocalKey`/`preferenceKey`/`loadLocal`/`saveLocal` в
  `summary-panel-runtime-loaded.ts` корректно превращают `slot: null` в
  `key: null`, что гейтит и `getItem`, и `setItem` (строки 408-409, 428-432) —
  подтверждено и чтением, и тестами выше.
- Единственная точка вызова `stableSummaryPlacementSlot` — `placementSlot()`,
  сигнатура `string | null` пробрасывается корректно, `tsc` (в составе Validate)
  зелёный.
- Кеш `placementSlots` не маскирует «unresolved»: `masonryPlacement` пишет в
  `WeakMap` только на ветке `resolved`, поэтому повторный вызов после появления
  `cards` действительно пересчитывает identity — соответствует ТЗ п.3.6.
- Скоуп не расширен: новый публичный `card_id`, миграция хранения, перенос после
  reorder — не введены; ровно то, что запрещало ТЗ.
- «Одно число — один источник»: не применимо, диффе не добавляет и не дублирует
  пользовательскую величину (identity — не отображаемое число).
- Геометрия/`layout`/толщины стен не затронуты — `model-invariants` не требуется.
- Python-бэкенд не затронут — `pytest tests_backend` не требуется.
- Визуальных изменений нет (ТЗ §6 прямо это утверждает, диффом подтверждено —
  ни CSS, ни шаблонов, ни рендера) — `golden:verify` не требуется.

## Находки

Нет. High: 0, Medium: 0, Low: 0.

## Чего не проверял и почему

- Полный `npm test`/`npx tsc --noEmit`/`npm run build` со сверкой трёх копий
  бандла — не перегонял: Validate зелёный на точном SHA `bb35af99`
  (https://github.com/Matysh/houseplan-card/actions/runs/34724545711), это дешёвые
  гейты и они уже сошлись на этом прогоне. Отдельно перепроверил только
  `no-new-any` и `mutation-gate --id=…`, так как они дёшевы и напрямую относятся
  к защитным AC7.
- Полная матрица браузерных смоков (`demo/smoke_*.mjs`) — не прогонял; выборка
  `scripts/smoke-select.mjs` вернула НЕОПРЕДЕЛЁННОСТЬ, а ТЗ AC8 явно относит
  production-shaped summary-panel smoke (включая touch/kiosk viewport rotation)
  на prerelease-гейт. Решение принято на этапе ТЗ (зелёное ревью ТЗ), а не мной
  сейчас задним числом.
- `npm run golden:verify`, `python -m pytest tests_backend`,
  `node scripts/model-invariants.mjs` — не запускал: диф не меняет визуальный
  результат, геометрию/ссылки на неё или Python-код.
- Полная пересъёмка `check-docs`/`docs:capture` в строгом режиме — не делал:
  Validate использует `--screenshots=warn` на обычном push (heavy=false), строгий
  режим — обязанность prerelease-гейта (#479); зелёный Validate на этом SHA уже
  подтвердил обычный (warn) прогон check-docs.

## Материал раунда

- SHA: `bb35af993a4d5cc17376568155eefc83fc44822e`
- Диапазон: `origin/dev..HEAD` — один коммит
- Рабочая копия после всех проб (`git status --porcelain`) — чисто, HEAD не менялся

## Вердикт

Зелёный. Все AC1–AC8 доказаны автотестами, которые я лично прогнал и для двух
защитных (AC4, AC7) — лично сломал и восстановил. Внешнее допущение о контракте
`hui-masonry-view.cards` проверено чтением реального пиннутого исходника HA
frontend, а не принято на слово автора. Находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/561-masonry-identity`, коммит `bb35af993a4d` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `195362973e09276e933bcc4b699e64a46cbb4b5d`
  ```
  git log --all --format='%H %T' | grep 195362973e09
  ```
- Тело issue: `9543698e33142ca2ceb66d906e271f5158a010ed8bfb00e873019519e5743970`
- Вердикт конвейера: `green` · High 0
