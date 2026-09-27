# CODE-REVIEW-476-r3

- **Issue:** #476 — Явное завершение выбора цвета кнопкой «ОК»
- **Этап:** код-ревью (PROCESS.md §2.7), заход r3, блокирующих циклов израсходовано 1 из 4
- **Ветка:** `issue/476-color-picker-ok`, HEAD `29d72b33` (detached). `origin/dev` = `88e4cf50`,
  совпадает с `git merge-base origin/dev HEAD` — ветка полностью приведена конвейером к `dev`,
  ребейз чист, конфликтов нет. Поверх материала r2 (`fc5973c2`) легло ещё **14 коммитов** `dev`
  (issue #472, #473) — это третий по счёту ребейз ветки на ушедший вперёд `dev`.
- **Диапазон:** `git log --oneline origin/dev..HEAD` — 10 коммитов; материал —
  `git diff origin/dev...HEAD`, 57 файлов, +1572/-288.
- **ТЗ:** `docs/specs/476-color-picker-ok.md`, полный трек, ревью ТЗ зелёное на r2
  (`docs/reviews/SPEC-REVIEW-476-r2.md`).

## Почему разбор полный, а не по дельте

Между CODE-REVIEW-476-r2 (зелёный, материал `fc5973c2`/`6e0e1f8c`) и этим заходом `origin/dev`
ушёл вперёд ещё на 14 коммитов (`fc5973c2..88e4cf50`): диф-зависимый перф-смок и мутационная
отчётность (#473), синхронизация `mutation-gate.yml` между `main`/`dev` (#472). PROCESS.md
§2.10/§7.2 прямо называет ребейз на ушедший вперёд `dev` «другим кодом», обязывающим к полному
разбору, а не к проверке только дельты. Сделал полный разбор: перепрогнал весь набор гейтов
заново на текущем дереве, а не поверил чужому заявлению «конфликтовали только сгенерированные
файлы».

Проверил сам, что продуктовая логика при этом не пострадала:
`git log --oneline origin/dev..HEAD -- src/hp-color-opacity.ts src/houseplan-card.ts` даёт
**ровно один** коммит — `4dc0a538 feat: add color picker confirmation`, тот же, что был
разобран в r1/r2. Все 14 новых коммитов `dev` не касаются ни одного из этих двух файлов.

## Скоуп диффа (полный)

`src/hp-color-opacity.ts` (61 строка) — полноширинная кнопка «ОК» как последний DOM-control,
CSS-контракт (100% width, ≥40px, forced-colors), признак `_hexNeedsValidInput` (защита от снятия
ошибки повторным «ОК» без нового ввода), `_confirm()` со `stopPropagation()`. `src/houseplan-card.ts`
(1 строка) — `confirm` label. `src/i18n/{en,ru,de,fr}.json` — `color_picker.confirm`.
`test/color-picker.test.mjs`, `test/i18n.test.mjs` — юниты на DOM-порядок/CSS/label/i18n-parity.
`demo/smoke_color_picker.mjs` (расширен), `demo/smoke_help_affordance.mjs` (fallback-путь),
`demo/smoke_color_picker_consumers.mjs` (новый, M2-фикс). `scripts/mutation-gate.mjs` (2 мутанта,
M1+M2), `scripts/smoke-links.mjs` (реестр выбора смоков). Оба changelog, `docs/TESTING.md`,
`docs/specs/README.md`, пересобранные `dist/**`/`custom_components/houseplan/frontend/**`,
обновлённый `docs/images/screenshots.json` (только fingerprint). Backend, геометрия,
config/storage не затронуты.

## Как проверялось

Зелёного Validate на `29d72b33` нет (in-progress на момент разбора, job `Golden` красный на
предыдущих коммитах диапазона). Прогнал сам:

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | чисто, без вывода |
| Unit-тесты | `npm test` | `2107 tests, pass 2106, fail 0, skipped 1` (рост со 2077 у r1/r2 — новые тесты #472/#473, не #476) |
| Build + sync | `npm run build && npm run bundle:sync` | `dist` собран; `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` — идентичны; `git status --short` пуст после сборки (все 3 копии бандла совпадают с закоммиченным) |
| Docs-гейт | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 12 external links)` — обязателен, diff трогает `src/**` |
| Новый `any` | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | «Новых any нет» (59 добавленных строк в 2 файлах — те же, что в r1/r2: дельта не добавила новых строк в `.ts`) |
| Process-gate | `node scripts/process-gate.mjs` | «гейт пройден, предупреждений 0» (10 коммитов в диапазоне) |
| Выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | Прямое совпадение (1): `smoke_color_picker_consumers.mjs` (← `_surface`). Зарегистрированная связь (2): `smoke_color_picker.mjs`, `smoke_help_affordance.mjs`. Слабая связь (15, общее имя `stopPropagation`) — тот же список, что в r1/r2 (`smoke_cover_*`, `smoke_decor`, `smoke_edit_walk`, `smoke_editor_gestures`, `smoke_furniture`, `smoke_hide_layers`, `smoke_inert_openings`, `smoke_modes`, `smoke_room_cards`, `smoke_space_settings`, `smoke_tap_ctx`, `smoke_tap_run`, `smoke_toggle_confirmation`, `smoke_value_face_source`) — просмотрел повторно, все про другие поверхности, не про `hp-color-opacity`; не гонял |
| Целевой смок 1 | `node demo/smoke_color_picker.mjs` | `OK`, все 21 поле `true`, включая `repeatedConfirmCannotBypassInvalidHex: true` |
| Целевой смок 2 | `node demo/smoke_color_picker_consumers.mjs` | `OK`, все 13 полей `true`, включая `generalConfirmDoesNotClickThrough: true` |
| Целевой смок 3 | `node demo/smoke_help_affordance.mjs` | `OK`, все 41 поле `true`, включая `fallbackPickerHasConfirm`/`fallbackPickerConfirmCloses` |
| Bundle budget | `npm run bundle:budget` | initial View `299595 B` gzip, потолок `300500±2000` — в бюджете; запас `1471 Б` — тот же пред-существующий долг #367 (не новый, не вызван этим диффом) |
| Golden (advisory, полный прогон) | `npm run golden:verify` | 161 сцена: **15 `different`, 146 `passed`**. Ровно те же 5 color-popover сцен, что называет ТЗ §13.4 (см. ниже), плюс те же 10 `isometric-*`, что r2 уже отнёс к пред-существующему долгу #471 — состав не изменился с r2 несмотря на 14 новых коммитов `dev` между заходами |
| Мутация 1 (M1) | `node scripts/mutation-gate.mjs --id=color-picker-invalid-confirm-latch-removed` | патч снимает `if (this._hexNeedsValidInput) {...}` в `_commitHex`; чистый прогон `smoke_color_picker.mjs` — зелёный, с мутацией — «тест покраснел, как обязан», «поймано 1 из 1» |
| Мутация 2 (M2) | `node scripts/mutation-gate.mjs --id=color-picker-confirm-click-through` | патч снимает `event.stopPropagation()` из `_confirm`; чистый прогон `smoke_color_picker_consumers.mjs` — зелёный, с мутацией — «тест покраснел, как обязан», «поймано 1 из 1» |
| Применимость всех мутантов | `node scripts/mutation-gate.mjs --check` | все патчи (включая 2 наших) ложатся на текущий код ровно один раз — реестр не отстал |

**Не гонял и почему:**
- `python -m pytest tests_backend` — diff не трогает `custom_components/**/*.py`.
- `npm run invariants`/`model-invariants.mjs` — diff не меняет рёбра комнат, толщину, `layout`,
  `marker.space`, `open_spans`; геометрия не затронута.
- Полная матрица `demo/smoke_*.mjs` (226 смоков) и полный `scripts/mutation-gate.mjs` (десятки
  мутантов, кроме двух целевых) — предрелизные гейты (PROCESS §8), не гейт код-ревью на задаче
  такого объёма.
- `npm run golden:accept` — не моя роль на этом этапе.
- «Одно число — один источник»: диф не добавляет и не меняет пользовательскую числовую величину
  (кнопка не показывает значение), правило неприменимо; `test/single-source-numbers.test.mjs`
  зелёный в составе `npm test`.

## Golden: 10 `isometric-*` diff — по-прежнему не относится к #476 (переподтверждено)

`golden:verify` на текущем HEAD (`29d72b33`) даёт ровно те же 15 `different`, что r2 нашёл на
`6e0e1f8c`, несмотря на 14 промежуточных коммита `dev`: 5 названных ТЗ §13.4 color-popover сцен
(`decor-color-popover-mobile-ru`, `decor-color-popover-desktop-en`, `general-color-popover-desktop-en`,
`device-ripple-color-popover-mobile-ru`, `space-room-color-popover-desktop-ru`) + 10 `isometric-*`
(`isometric-geometry-view-{dark,light}`, `isometric-live-layers-dark`, `isometric-touch-kiosk-dark`,
`isometric-large-warm-remount-dark`, `isometric-stage3-overlays-{light,dark}`,
`isometric-stage3-openings-dark`, `isometric-stage3-forced-colors-dark`,
`isometric-stage3-no-filter-dark`).

Просмотрел лично `artifacts/golden/actual/` и `diff/` для всех 5 color-popover сцен (2 приложены
как скриншоты в этом разборе): разница — ровно новая полноширинная кнопка «ОК»/«OK» и вертикальный
сдвиг содержимого попапа под ней; цвет, геометрия, тема не поехали ни в одной сцене.

Происхождение 10 `isometric-*` не расследовал заново с нуля — это уже сделал r2 (worktree на
чистом `origin/dev` без единого коммита #476, тот же результат) и проследил до пред-существующего
долга `dev`: `be5eeb41` (#471) изменил изометрический рендер, а последний коммит, принимающий
golden-эталоны, — `de215578`, раньше него. Проверил сам, что новые 14 коммитов между r2 и r3 не
меняют этот факт: `git diff fc5973c2..origin/dev --stat -- demo/golden/` — пусто (ни один
baseline не принимался), а diff #473 (`d95255ad`) правит только строку unit-теста
(`test/iso-scene-render.test.mjs`), не рендер и не сами эталоны. Долг тот же, не новый и не
дельта этой задачи; issue не завожу — по тем же основаниям, что и r2 (чужой смерженный код #471,
предрелизный гейт, не гейт код-ревью).

## Новое в r3: диф-зависимый перф-смок (#473) теперь целится в этот диф — проверил, шум окружения

Между r2 и r3 в `dev` прилетел диф-зависимый перф-смок (#473, `.github/workflows/validate.yml`):
правка `src/houseplan-card.ts` попадает под шаблон `perf_interaction` в
`scripts/classify-changes.mjs` (`^src\/(live-[^/]+|render-[^/]+|houseplan-render-lifecycle|houseplan-card)\.ts$`),
поэтому CI Validate на этом SHA обязан прогнать `large-house-interaction-v1` в дополнение к
обычным glow-профилям — гейта, которого не существовало на момент r1/r2. ТЗ §15 утверждает
отсутствие перфвлияния (один статический `button` в уже открытом lazy-picker), но раз появился
новый обязательный по диффу гейт, я его прогнал сам, а не доверился формулировке ТЗ:

```
npm run benchmark:large-house -- --profile=large-house-interaction-v1 --samples=3 --warmups=1
npm run benchmark:compare -- --absolute-only --budgets=demo/performance/budgets-interaction-smoke.json
```

Результат на `HEAD`: 2 из 51 проверок красные — `timing.interactionSeriesMs.median` (3230.9 vs
потолок 3000) и `longTask.editorSeries.maxSingleMs` (221 vs потолок 150).

Чтобы отличить регрессию от шума текущего окружения (тот же метод, что r2 применил к golden),
прогнал тот же профиль на чистом `origin/dev` (`88e4cf50`) в отдельном `git worktree`, без единого
коммита #476:

```
git worktree add /tmp/dev-clean origin/dev --detach
# (общий node_modules переиспользован symlink'ом — package-lock.json идентичен, diff пуст)
npm run bundle:sync
npm run benchmark:large-house -- --profile=large-house-interaction-v1 --samples=3 --warmups=1
```

Результат на чистом `dev` без #476: `timing.interactionSeriesMs.median` = 3122.6 — **тоже красный**
против того же потолка 3000. `longTask.editorSeries.maxSingleMs` на `dev` = 137 (проходит, но с
запасом 13 мс из 150 — тот же порядок величины, что просадка на HEAD). Оба замера — 3 сэмпла на
этой песочнице, разброс между веткой и чистым `dev` (3230.9 vs 3122.6, ~3.5%) меньше, чем запас
threshold'а до потолка (0%), то есть неотличим от шума общего/разделяемого раннера. Регрессия
не подтверждена: ветка с #476 и чистый `dev` без него одинаково красятся по основной метрике —
причина не в этом диффе. Не завожу отдельный issue: в отличие от golden (детерминированный
байтовый диф), это шумная временная метрика с 3 сэмплами на нештатной песочнице — у меня нет
основания утверждать, что это вообще дефект, а не особенность именно этого раннера. Owner/pipeline
стоит иметь в виду, что этот перф-гейт может красить `Validate` на всём диапазоне `dev`, а не
только на этой ветке — но это не находка задачи #476.

## Закрытие раунда r2

r2 не оставил находок (Вердикт: зелёный, High: 0, Medium: 0) — таблица «находка → чем закрыта»
пуста по построению. Единственное событие между r2 и r3 — второй по счёту ребейз ветки
(`fc5973c2 → 88e4cf50`, +14 коммитов `dev`), который сам по себе не находка (см. «Почему разбор
полный» выше), а обязательное основание для полного повторного разбора.

## Унаследовано из r2 (перепроверено, не просто принято на слово)

Документ: `docs/reviews/CODE-REVIEW-476-r2.md`, материал — `HEAD 6e0e1f8c` (SHA мёртв после
третьего ребейза — обычный случай осиротевшего SHA, §2.10, не находка; дерево материала r2 в
документе — `2e8d8ce4b232`).

Основание — не доверие, а факт, перепроверенный лично в этом заходе:
`git log --oneline origin/dev..HEAD -- src/hp-color-opacity.ts src/houseplan-card.ts` даёт один
и тот же единственный коммит `4dc0a538`, что и в r1/r2 (там он назывался `82f65acd`/`11cc5386` до
двух последующих ребейзов — тот же контент, другой хэш после перезаписи истории при ребейзе).
Перечитал оба файла целиком в текущем HEAD — расхождений с описанием r2 нет.

Наследуется (код не менялся, повторно не выводил заново логику AC, но перепрогнал все гейты,
которые их доказывают, см. таблицу выше — это отличает «унаследовано» здесь от классической
дельты):
- **AC1** (видимая кнопка/геометрия) — unit + 5 golden-сцен, разница только в кнопке (лично
  пересмотрел все 5 в этом заходе, включая 2 приложенных скриншота);
- **AC2** (live parity, без дублирующего события) — код и мутационное покрытие не менялись;
- **AC3** (успешное завершение, включая click-through-защиту M2) — мутант
  `color-picker-confirm-click-through` лично прогнан заново в этом заходе, красится;
- **AC4** (невалидный HEX, защита от обхода M1) — мутант
  `color-picker-invalid-confirm-latch-removed` лично прогнан заново в этом заходе, красится;
- **AC5** (прежние close paths) — Escape/outside/trigger, код нетронут; outside/повторный
  trigger по-прежнему не покрыты автотестом (L3 из r1, пред-существующий пробел, не этой задачи);
- **AC6** (i18n/a11y) — 4 языка, DOM-порядок = Tab-порядок, юниты зелёные в этом прогоне;
- **AC7** (touch/fallback/lifecycle) — Popover/fallback паритет, оба смока зелёные в этом прогоне;
- **AC8** (совместимость/бюджеты) — нет новых config/storage/backend полей, `bundle:budget` в
  бюджете в этом прогоне;
- Low L1 (`houseplan-card.ts:5935` — стилевая склейка двух полей в одну строку), L2 (keyboard
  activation только через `.click()`), L3 (outside/trigger не покрыты автотестом) — сняты r1 с
  записью, делта их не касается; L1 проверил построчно — та же склейка на месте, ничего не
  ухудшилось.

## AC — таблица доказательств (r3, полная, с «чем краснеет» для защитных AC)

| AC | Чем доказан | Чем краснеет | Статус в r3 |
|---|---|---|---|
| AC1 видимая кнопка/геометрия | unit + `golden:verify` (5 сцен) | не защитный AC (расположение/CSS) | переподтверждено, разница та же |
| AC2 live parity, без дублирующего события | smoke `confirmClosesWithoutDuplicateOrClickThrough`, `validCorrectionAllowsConfirm` | код не менялся с r2, мутационно не перепрогонял отдельно (не новый защитный механизм) | унаследовано |
| AC3 успешное завершение / без click-through | smoke `confirmClosesWithoutDuplicateOrClickThrough` + `generalConfirmDoesNotClickThrough` | мутация `color-picker-confirm-click-through` — лично прогнал в r3, красное | **перепроверено в r3** |
| AC4 невалидный HEX / защита от обхода | unit + smoke `invalidHex*`, `repeatedConfirmCannotBypassInvalidHex` | мутация `color-picker-invalid-confirm-latch-removed` — лично прогнал в r3, красное | **перепроверено в r3** |
| AC5 прежние close paths | smoke `escapeClosesFirstAndRefocuses`; outside/trigger — проверено чтением (L3, пред-существующий пробел) | код не тронут | унаследовано |
| AC6 i18n/a11y | unit (`i18n.test.mjs`, `color-picker.test.mjs`) + smoke `englishLabels`/`cardLanguageOwnsCopy` | не защитный AC | унаследовано, юниты зелёные в r3 |
| AC7 touch/fallback/lifecycle | smoke `confirmIsFullWidthTouchTarget`, `smoke_help_affordance.mjs` + `smoke_color_picker_consumers.mjs` | не мутировал отдельно, оба пути реально прогнаны | унаследовано, все смоки зелёные в r3 |
| AC8 совместимость/release/бюджеты | `no-new-any`, `check-docs`, `bundle:budget`, оба changelog в `4dc0a538` | не защитный AC | унаследовано, гейты зелёные в r3 |

## Находки

Нет. High: 0. Medium в скоупе: 0. Medium вне скоупа: 0.

- 10 `isometric-*` golden-diff — пред-существующий долг `dev` от #471, переподтверждено в r3
  (см. раздел выше), не находка этой задачи, issue не завожу (та же позиция, что r2).
- Красный `large-house-interaction-v1` перф-профиль — воспроизводится и на чистом `origin/dev`
  без #476, неотличим от шума общего раннера этой песочницы при 3 сэмплах; недостаточно
  оснований признать это дефектом, issue не завожу.

## Что проверено и корректно

- `src/hp-color-opacity.ts`/`src/houseplan-card.ts` идентичны коду, разобранному в r1/r2:
  единственный коммит диапазона, трогающий эти файлы (`4dc0a538`), не менялся третьим ребейзом.
- Обе Medium-находки r1 (M1/M2) остаются закрытыми воспроизводимыми мутантами, лично прогнанными
  заново в этом заходе на текущем HEAD: оба «покраснели, как обязаны».
- `dist`/`custom_components/houseplan/frontend`/`demo/srv/assets` синхронны с исходником (`cmp`
  идентичны, `git status --short` пуст после пересборки).
- Трейлеры: все 10 коммитов диапазона несут `Issue: #476`; ровно один (`4dc0a538`) —
  `User-Visible: yes` с правками в обоих changelog в этом же коммите; `process-gate.mjs` — 0
  предупреждений.
- 5 golden-diff color-popover сцен — визуально ровно кнопка и связанный со сдвиг контента, ничего
  постороннего не поехало (лично пересмотрел все 5).
- 10 golden-diff `isometric-*` подтверждённо не относятся к этому диффу (переподтверждено фактом:
  ни один коммит диапазона не трогает `src/*iso*`, состав diff не изменился за 14 коммитов dev).
- Новый диф-зависимый перф-гейт (#473) корректно классифицирует `houseplan-card.ts` как
  `perf_interaction` — прогнал его сам и показал, что красный результат не связан с #476.

## Чего не проверял

- `pytest tests_backend`, `npm run invariants`/`model-invariants.mjs`, полная матрица
  `demo/smoke_*.mjs`, полный `scripts/mutation-gate.mjs` (кроме 2 целевых), `golden:accept` —
  см. обоснование в таблице гейтов.
- 15 «слабых» смоков по `stopPropagation` — просмотрел список имён (не изменился с r1/r2), все
  про другие поверхности, не про `hp-color-opacity`; не гонял.
- `large-house-isometric-v1` перф-профиль — диф не трогает `src/iso-*`, `perf_iso` в
  `scripts/classify-changes.mjs` не срабатывает на этом диффе, гейт не обязателен.
- Не расследовал глубже происхождение golden-долга #471 сверх подтверждения, что 14 новых
  коммитов `dev` его не меняли (не моя роль — задача другого issue).
- Не выяснял, воспроизводится ли красный `large-house-interaction-v1` на дедиковинном раннере
  GitHub Actions — не мой доступ; зафиксировал только то, что он не зависит от #476 в этой
  песочнице.

## Вывод

High: 0. Medium в скоупе: 0. Medium вне скоупа: 0. Verdict: **зелёный**.

---

## Материал раунда

- Ветка: `issue/476-color-picker-ok`, HEAD `29d72b334446fb9cfe91009a9a945d1e5a14be00`.
- `origin/dev` = `88e4cf50e338c0f53f008a30acca5b46a8611289`, совпадает с
  `git merge-base origin/dev HEAD` — ветка полностью приведена, конфликтов нет.
- Диапазон: `git log --oneline origin/dev..HEAD` (10 коммитов) /
  `git diff origin/dev...HEAD` (57 файлов, +1572/-288).
- Предыдущий документ: `docs/reviews/CODE-REVIEW-476-r2.md`, материал того захода — `HEAD 6e0e1f8c`
  (мёртв после этого, третьего ребейза; дерево материала r2 — `2e8d8ce4b232`, см. документ r2).
- ТЗ: `docs/specs/476-color-picker-ok.md`, ревью ТЗ зелёное — `docs/reviews/SPEC-REVIEW-476-r2.md`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/476-color-picker-ok`, коммит `e49c48a74021` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `6b9ca28c3f24d21dc3913e4a18f9bf1bc3b47a26`
  ```
  git log --all --format='%H %T' | grep 6b9ca28c3f24
  ```
- ТЗ `docs/specs/476-color-picker-ok.md`, блоб `d21066d56e69c35fe7d0b40d9f965968dac9f803`
  ```
  git log --all --find-object=d21066d56e69c35fe7d0b40d9f965968dac9f803 -- docs/specs/476-color-picker-ok.md
  ```
