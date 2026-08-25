# CODE-REVIEW-304-r1

**Issue:** [#304 — паритет базовых осей и узлов между инструментами Plan editor](https://github.com/Matysh/houseplan-card/issues/304)
**Ветка:** `issue/304-plan-axis-parity`, HEAD `7310ce0134ca8e5b1c32e6816a2e70625ea158e2`
**Диапазон:** `origin/dev...HEAD` (2 коммита: `a2b4d32b` — код, `7310ce01` — скриншоты документации)
**Трек:** `small` (лёгкий), ТЗ в теле issue, ревью ТЗ — комментарий (зелёный, заход r1, 0/2 циклов, 2026-08-25T13:06:27Z)
**Заход:** r1 (первый код-ревью для этого issue; предыдущих раундов код-ревью нет, раздел «Унаследовано из r<N-1>» неприменим)
**Вердикт:** жёлтый · High: 1 · Medium: 0

## Скоуп

Контракт (тело issue): статический слой архитектурных осей/узлов (`plan-snap-overlay`)
должен рендериться во всех 10 `MarkupTool`, а не только в «Стены» (`draw`); transient
snap/hover остаются эксклюзивными для «Стены»; View/Device editor/Background editor слой
не получают.

Диапазон коснулся:
- `src/houseplan-card.ts` — единственная продуктовая правка (класс A), 5 добавленных / 2
  удалённые строки;
- `demo/smoke_plan_snap_overlay.mjs`, `demo/golden/harness.mjs`, `test/plan-snap-overlay.test.mjs` — тесты (класс B);
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`, `docs/STATUS.md`, `docs/USER-GUIDE.md`,
  `docs/USER-GUIDE.ru.md`, `docs/images/**`, `docs/images/screenshots.json` — документация (класс C);
- `dist/houseplan-card.js`, `custom_components/houseplan/frontend/houseplan-card.js` — сгенерированное (класс D), синхронно с `src`.

`demo/golden/matrix.mjs` и `src/plan-snap-overlay.ts` **не тронуты** — геометрия и матрица
сцен не менялись, что соответствует заявленному «не-скоупу».

## Сама правка

```ts
// было
${this._markup && this._tool === 'draw' ? svg`<g class="hp-editor-only-layer" …>
  ${this._renderPlanSnapOverlay()}</g>` : nothing}
…
private _renderPlanSnapOverlay(): TemplateResult {
  if (!this._markup || this._tool !== 'draw') { return svg``; }

// стало
${this._markup ? svg`<g class="hp-editor-only-layer" …>
  ${this._renderPlanSnapOverlay()}</g>` : nothing}
…
private _renderPlanSnapOverlay(): TemplateResult {
  if (!this._markup) { return svg``; }
```

Гейт `_tool === 'draw'` снят в двух местах; `_activePlanSnapCandidate`/`_activePlanSnapConflicts`
(строки 6996–7010, не изменены) по-прежнему возвращают `null`/`[]` вне `draw` — transient-маркер
и conflict-подсветка остаются эксклюзивными «Стенам», как требует контракт п.4. `_markup`
(строка 1524, не изменена) — это `_mode === 'plan'`, поэтому View/`devices`/`decor` не получают
слой без дополнительных условий (контракт п.6).

## Как проверялось

### Дешёвые гейты — прогнаны все

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, exit 0 |
| Unit | `npm test` | 1299 тестов, 1298 passed, 1 skipped (pre-existing `#281` private-fixture skip, не связан с #304), 0 failed |
| Build + sync | `npm run build && npm run bundle:sync` | зелёный; `dist/houseplan-card.js`, `custom_components/houseplan/frontend/houseplan-card.js`, `demo/srv/assets/houseplan-card.js` byte-identical (`cmp`) |
| Docs fingerprint | `node scripts/check-docs.mjs` | «Documentation checks passed (7 files, 10 external links)» |
| Выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 7 прямых совпадений по символу `_markup`; символ `_tool` инструмент не посчитал широким |
| Model invariants | — | не запускал: диф не трогает рёбра комнат, `layout`, `marker.space`, `open_spans`, записи толщины или `plan-snap-overlay.ts` — только условие рендера. Проверено чтением |

### Дисциплина «тест умеет падать» — проверено активно, не на слово

Временно откатил `src/houseplan-card.ts` к состоянию `origin/dev` (`git apply -R`), пересобрал
бандл (`npm run bundle:sync`) и повторно прогнал:

- `node demo/smoke_plan_snap_overlay.mjs` → падает необработанным исключением
  (`Cannot read properties of null (reading 'querySelectorAll')`) на проверке `wallthick` —
  без фикса `overlay()` для этого инструмента `null`, ассерт паритета невыполним;
- `node demo/golden/run.mjs --mode=capture --scenario=hidden-wall-diagnostics-plan-light` →
  статус `error` (новая проверка паритета внутри `prepareGoldenScenario` бросает исключение до
  снятия скриншота).

Затем восстановил фикс (`git apply`), пересобрал бандл — дерево вернулось к состоянию коммита
(`git status` пусто), оба прогона снова зелёные. Тест и golden-инвариант доказанно способны падать.

### Смоки — прямые совпадения плюс релевантные по AC6, прогнаны лично

```
node demo/smoke_edit_walk.mjs                        OK
node demo/smoke_editor_gestures.mjs                  OK
node demo/smoke_merge_split.mjs                      OK
node demo/smoke_optimize_coincident_partition.mjs    OK
node demo/smoke_resize_audit_1550.mjs                OK
node demo/smoke_room_resize.mjs                      OK
node demo/smoke_split_nonsnap.mjs                    OK
node demo/smoke_plan_snap_overlay.mjs                OK (все 43 подпроверки true)
node demo/smoke_wall_thickness.mjs                   OK
node demo/smoke_opening_preview.mjs                  OK
node demo/smoke_partition_openings.mjs               OK
node demo/smoke_resize_wall_thickness.mjs            OK
node demo/smoke_unified_wall_tool.mjs                OK
node demo/smoke_wallthick_hover_width.mjs            OK
```

Полный набор `demo/smoke_*.mjs` (188 файлов) не прогонялся — задача не задевает всё, только
рендер-слой Plan editor; полный набор остаётся предрелизным гейтом (§8).

### Golden — локально плюс канонический Linux CI-артефакт с branch'а автора

Локально (native Windows, диагностически, per `AGENTS.md` «Известное окружение»):
`node demo/golden/run.mjs --mode=capture --scenario=hidden-wall-diagnostics-plan-light|dark` —
оба **passed** (пиксельное совпадение с текущим эталоном, не только «семантика»).

Для полной картины поднял фактический прогон `Validate` на этой же ветке этим же автором
(GitHub Actions, `gh run view/api`):

- commit `a2b4d32b` (сама правка, до докс-коммита), run `32854408646`:
  job `golden` → **failure**. Полный список сцен смотрел через логи джобы; 110 сцен `passed`,
  **5 сцен `different`**: `safe-resize-handles-clamp-light`, `safe-resize-handles-clamp-dark`,
  `opening-placement-door-thick-wall-dark`, `opening-placement-passage-thick-wall-dark`,
  `opening-placement-passage-thick-wall-light`. Смок `smoke (1)` и `performance_smoke` —
  `cancelled` (не успели: следующий пуш отменил прогон), `docs` — `failure` (ожидаемо, устаревший
  отпечаток скриншотов, закрыто следующим коммитом).
- те же 5 сцен на `dev` (run `32848267582`, job `golden`, commit `2143e888`) — все **passed**.
  Разница вызвана этой веткой, не флуктуацией CI.
- скачал артефакт `golden-images` (`gh api .../artifacts/9565735845/zip`) и посмотрел
  `diff/safe-resize-handles-clamp-light.png`, `diff/opening-placement-door-thick-wall-dark.png`,
  `diff/opening-placement-passage-thick-wall-light.png` — во всех трёх новый статический слой
  осей/узлов (тот самый `plan-snap-line`/`plan-snap-node`) закономерно появляется поверх сцены,
  потому что `prepareGoldenScenario` для этих сценариев (`safeResizePreview` → `card._tool =
  'resize'`, `openingPreview` → `card._activateOpeningPlacement(type)` переводит в `_tool =
  'opening'`) не возвращает `_tool` в `draw` перед снимком — в отличие от нового кода для
  `scenario.hiddenWallDiagnostics`, который явно делает `card._tool = 'draw'` перед финальным
  кадром (`demo/golden/harness.mjs:709-711`). См. finding ниже.

## Разбор по AC

- **AC1 (паритет контрольного узла, smoke+golden).** Смок: новая fixture «room + 2 coincident
  partitions» даёт 6/6 узлов и линий в `draw` и `wallthick` (`thicknessShowsCompleteSixNodeFixture`).
  Golden: существующие сцены `hidden-wall-diagnostics-plan-{light,dark}` (комната + coincident
  partition + скрытая сохранённая цепочка) проходят пиксельно без изменений эталона, и новая
  проверка внутри `prepareGoldenScenario` (строки 675-711) явно перебирает все 10 инструментов и
  бросает исключение при расхождении DOM до снятия скриншота. **Выполнено.**
- **AC2 (все инструменты, smoke).** `allPlanToolsShareStaticAxesAndNodes` сравнивает нормализованный
  DOM-снимок (`data-key`, координаты) по всем 10 `MarkupTool`; `allPlanToolOverlaysPaintAboveWallBodies`
  подтверждает порядок относительно `.wallbodies`. **Выполнено.**
- **AC3 (дедупликация, unit+smoke).** Новый unit-тест `test/plan-snap-overlay.test.mjs` фиксирует
  6 сегментов/6 узлов для той же топологии на уровне `buildPlanSnapGeometry` (сама функция не
  менялась — диф `src/plan-snap-overlay.ts` пуст, что и ожидалось: контракт дедупликации не задет).
  Утверждение «hidden diagnostic не создаёт визуального двойника» — унаследованное поведение
  нетронутой `buildHiddenWallDiagnosticGeometry` (уже сосуществовала с полным overlay в `draw` до
  фикса); проверено чтением, не новым тестом. **Выполнено.**
- **AC4 (интерактивность, smoke).** `allPlanToolOverlaysStayPointerTransparent` проверяет
  `pointer-events: none` и оба вычисляемых стиля во всех 10 инструментах. Вторая часть AC4
  («применение толщины меняет только выбранный интервал») не тестировалась заново на новой
  fixture — код применения толщины (`_wallDialog` и связанный путь) диффом не тронут, оверлей был
  `pointer-events: none` и до фикса; проверено чтением. `smoke_wall_thickness.mjs` (несвязанная
  fixture) остаётся зелёным. **Выполнено**, вторая половина — «проверено чтением, не исполнением».
- **AC5 (границы режима, smoke).** `nonPlanModesHaveNoOverlay` проверяет `devices`, `decor`, `view`
  без слоя; `_markup` (не изменён) гарантирует то же на уровне кода. Отсутствие промежуточного
  кадра без осей при переключении инструмента (контракт п.7) — структурно невозможно: видимость
  зависит только от `_markup`, не от `_tool`; `_tool` не участвует в тайминге рендера. Проверено
  чтением. **Выполнено.**
- **AC6 (доступность и регрессии, smoke+golden).** `forcedColorsStayReadable` зелёный (существующая
  проверка, поведение не изменено). Целевые смоки draw/openings/resize (см. список выше) зелёные.
  **Но** golden-доказательство «без изменения поведения» для двух смежных сценариев неполно —
  см. finding H1. **Частично выполнено.**
- **AC7 (данные и производительность, unit + ревью кода).** Диф не трогает `_planSnapGeometrySnapshot`,
  кеш или что-либо на pointermove; конфигурация не мутируется, сохранение не вызывается при смене
  инструмента (не добавлено ни одного нового вызова записи). Проверено чтением: единственное
  изменение — булево условие рендера. **Выполнено.**

## Находки

### H1 (High) — два golden-сценария неродственных фич стали «different» на канонической Linux CI и не получили новый эталон

**Файлы:** `demo/golden/harness.mjs` (`safeResizePreview`, `openingPreview` — строки 946-1033),
`demo/golden/matrix.mjs` (сценарии `safe-resize-handles-clamp-{light,dark}`,
`opening-placement-{door,passage}-thick-wall-{dark,light}`), `demo/golden/baselines/*.png` (не
обновлены).

**Воспроизведение:** GitHub Actions, репозиторий `Matysh/houseplan-card`, run `32854408646`
(`Validate` на commit `a2b4d32b`, та же ветка), job `golden` →
https://github.com/Matysh/houseplan-card/actions/runs/32854408646/job/97823146408 — статус
`failure`; 5 из 115 сцен: `different`. Те же 5 сцен на `dev` (run `32848267582`, job `golden`,
commit `2143e888`) — все `passed`, то есть расхождение вызвано именно этой веткой, не шумом CI.
Скачанные diff-изображения (`golden-images` artefact, `9565735845`) показывают новый слой
`plan-snap-line`/`plan-snap-node`, появившийся в сценах `resize` и `opening`, где раньше рендерился
пустой `<g>`.

**Причина:** контракт issue (п.1) прямо требует показывать статический слой во всех 10
инструментах, включая `resize` и `opening` — то есть новое появление осей/узлов в этих golden-сценах
корректно и ожидаемо. Но `prepareGoldenScenario` для `scenario.hiddenWallDiagnostics` явно
возвращает `card._tool = 'draw'` перед финальным кадром (`demo/golden/harness.mjs:709-711`),
а `scenario.safeResizePreview` (переводит в `resize`) и `scenario.openingPreview` (переводит в
`opening`) — не возвращают. Пять существующих, не относящихся к #304 сцен (`safe-resize-handles-clamp-*`,
`opening-placement-*-thick-wall-*`) снимаются в этих инструментах и теперь легитимно отличаются
от принятого эталона, но новый эталон не снят и не принят: `git diff origin/dev...HEAD --
demo/golden/baselines/` пуст.

**Почему это блокирует, а не Low:** AC6 требует «без изменения поведения» для этих же
инструментов, а issue прямо перечисляет `visual/golden доказательство` как обязательный
release-артефакт (раздел «Release-артефакты»). Сейчас доказательство — отрицательное: канонический
Linux-гейт красный для пяти сцен, и это не отражено ни в одном коммите, ни в хендофф-комментарии
автора («golden:verify на native Windows — diagnostic only… Канонический полный Linux golden
остаётся обязательным pre-beta gate»), хотя автор сам инициировал этот прогон и мог его увидеть.
Без действия эти пять эталонов останутся неразрешённо «different» на предрелizном гейте — дефект,
который дешевле поймать сейчас (issue #237 — тот же класс пропуска, только для `check-docs`).
Соответствует условию жёлтого вердикта из процесса: «изменение… ухудшает смежный [сценарий]»
(§7.2/AGENTS.md) — с точки зрения непринятого эталона резинка Resize и предпросмотр проёма в
толстой стене визуально изменились без прошедшего ревью.

**Что нужно для исправления (в скоупе этой же задачи, не отдельный issue — причина в диффе этой
ветки):**
1. на Linux (CI, не native Windows) снять `npm run build && npm run bundle:sync && npm run
   golden:capture` для матрицы; проверить, что «different» ограничивается именно этими 5 сценами
   (или объяснить, если появились новые);
2. принять новые эталоны `npm run golden:accept -- --reviewed --from=<распакованный артефакт
   Linux CI>` — **важно:** текущий `Validate` на самом HEAD (`7310ce0`, run `32855061198`) сам
   пропустил job `golden` (`changes` классифицирует диф **относительно предыдущего пуша**, а не
   `origin/dev`, и коммит `7310ce0` — только докс/скриншоты); чтобы получить свежий полный
   Linux-артефакт для приёмки, нужен новый пуш/ре-триггер `Validate` на этой ветке;
3. отразить пересъёмку в хендофф-комментарии (команда + результат, не «verified»).

### Low (снято без правки, не блокирует)

- AC1 фиксирует «шесть узлов» через частный unit/smoke fixture, а не через golden-сцену с
  буквально такой же топологией (golden использует смежный, но не идентичный `golden-coincident-partition`
  фикстур). Разумно — тот же класс регресса (совмещённые/скрытые оси) реально покрыт, дублировать
  фикстуру в третьем месте не нужно.
- Комментарий-документация в шаблоне (`${''/* … */}`) — существующий в файле стиль (см. строки
  17560, 17568), новый блок ему соответствует, замечаний нет.

## Что проверено и корректно

- Гейтинг сведён к одному булеву условию, transient state (`_activePlanSnapCandidate`,
  `_activePlanSnapConflicts`) остаётся эксклюзивным «Стенам» — контракт п.4 не нарушен.
- Порядок слоёв не менялся (условие снято на уже существующем месте в шаблоне) — риск «render
  order перекрыл preview другого инструмента», названный в issue, не реализовался нигде, кроме
  golden-сцен из H1, где это ожидаемо и просто не задокументировано эталоном.
- View/Device editor/Background editor не получают слой ни по коду, ни по смоку.
- i18n не тронут (нет диффа в `src/i18n/*`, `custom_components/**/translations/*`), миграции и
  compatibility-поля не нужны — конфигурация и `plan-snap-overlay.ts` не менялись.
- Трейлеры: оба коммита несут `Issue: #304`; `a2b4d32b` — `User-Visible: yes` с правками в обоих
  changelog в том же коммите; `7310ce01` — `User-Visible: no`, докс-только, скриншоты снял workflow
  `Docs screenshots` (run `32854424829`, конклюзия `success`, SHA совпадает с `a2b4d32b`) — процесс
  скриншотов (§8 «только джобой Docs screenshots») соблюдён.
- `node scripts/process-gate.mjs --range=origin/dev..HEAD` — «гейт пройден», единственное `WARN`
  (нет `docs/specs/304-*.md`) — ожидаемо для `small`-трека.
- Один источник числа: диф не вводит новую видимую пользователю величину (только топологию
  линий/узлов), правило «одно число — один источник» неприменимо.

## Чего не проверял

- Полный `demo/smoke_*.mjs` (188 файлов) и полный `npm run golden:verify` локально — не запускал,
  задача не задевает все поверхности; вместо этого использовал целевую выборку
  (`smoke-select.mjs`) плюс фактический канонический Linux-прогон автора для golden (сильнее
  локального прогона на native Windows).
- `python -m pytest tests_backend` — не запускал, `custom_components/**/*.py` не тронут.
- Performance-профили и large-house benchmark — не запускал: `_planSnapGeometrySnapshot`/резолвер
  не тронуты, влияние на pointermove отсутствует по чтению кода, в AC не названо.
- `node scripts/model-invariants.mjs` — не запускал: диф не касается рёбер комнат, `layout`,
  `marker.space`, `open_spans`, записей толщины.
- Визуальную читаемость двух новых/скорректированных строк `docs/USER-GUIDE.md`/`.ru.md` смотрел
  только текстом; PNG-скриншоты (`docs/images/*.png`) не сверял пиксельно — доверился принятому
  workflow `Docs screenshots` и `check-docs.mjs`.

## Итог

Продуктовая правка минимальна, соответствует контракту, транзитное состояние и границы режимов не
нарушены — подтверждено и чтением, и смоками, включая доказанную способность нового смока и нового
golden-инварианта падать. Но обязательное по контракту и по разделу «Release-артефакты» golden-
доказательство неполно: два неродственных, уже существующих сценария (`safe-resize-handles-clamp-*`,
`opening-placement-*-thick-wall-*`) корректно и ожидаемо изменили внешний вид под тем же самым
кодом, но не получили пересъёмку/приёмку эталона, и это осталось незамеченным/незадокументированным
в хендоффе при том, что канонический Linux CI уже показал `golden: failure` на этой ветке.
Возврат автору для пересъёмки и приёмки этих пяти эталонов на Linux — фикс укладывается в эту же
задачу (причина в её собственном диффе), отдельный issue не нужен.
