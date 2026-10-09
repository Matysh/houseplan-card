# CODE-REVIEW-683-r1

Issue: #683 — «Лестницы: собственные цвета, трапеция направления и равномерный
шаг ступеней».
Этап: code (код-ревью, PROCESS.md §2.7).
Заход: r1 · блокирующих циклов израсходовано 0 из 4.
Материал: `git log --oneline origin/dev..HEAD` и `git diff origin/dev...HEAD`,
ровно SHA `20d2863eea3f94a83269bf8c2ba460a81ebdb41f` (рабочая копия уже на нём;
`git rev-parse HEAD` сверен непосредственно перед подведением итогов).

## Скоуп

Задача обслуживает J1 («что происходит сейчас» — понятный символ, не
завязанный на цвет темы HA) и J4/J6 («GUI без ручной правки конфига» — два
стандартных `hp-color-opacity`, snapshot цвета декора) из `docs/SCOPE.md`.
Видимое поведение меняется: `User-Visible: yes` верен, оба CHANGELOG обновлены
в одном коммите (`5b5b8081`).

Диапазон коммитов: `5b5b8081` (feat, продуктовый код + документация +
changelog), `64b544f1`/`2c9ff32d` (chore(golden), с `Release:` и
`Baseline-Reviewed-Local:` трейлерами), `1a7b1dfc` (fix: манифест
`scripts/config-schema.json`), `20d2863e` (docs: fingerprint скриншотов).
Трейлеры `Issue:`/`User-Visible:` присутствуют на каждом коммите; на
коммитах, трогающих `demo/golden/baselines/**`, есть ровно один
`Baseline-Reviewed-Local:` плюс `Release:` — по правилу.

## Как проверялось

Прочитаны: `docs/SCOPE.md`, `docs/process/REVIEWER.md`, `AGENTS.md`, тело
issue #683 (ТЗ r1, все 17 разделов, AC1–AC14), `docs/STAIRS.md`. Разобран
полный `git diff origin/dev...HEAD` (39 файлов) построчно: `src/stairs.ts`
(модель, `stairVisualStyle`/`stairVisualFields`/`stairStyleVars`,
`stairIntervalCount`, геометрия трапеции/ступеней, `renderFingerprint`),
`src/stairs-editor.ts`, `src/stairs-editor-model.ts`, `src/stairs-box.ts`,
`src/stairs-view.ts`, `src/space-render.ts`, `src/styles/plan.styles.ts`,
`src/pdf/pdf-scene.ts`, backend (`validation.py`, `import_export.py`,
`support_package.py`), i18n × 4, `docs/ARCHITECTURE.md`,
`docs/CONFIG-COMPATIBILITY.md`, оба `USER-GUIDE`, `scripts/bundle-budget.mjs`,
`scripts/config-schema.json`, `scripts/mutation-registry.mjs`,
`scripts/monolith-baseline.json`, `demo/golden/baselines/*`,
`demo/smoke_stairs.mjs`, `test/stairs.test.mjs`, `test/pdf-scene.test.mjs`,
backend тесты.

### Таблица AC — доказательство и что я сделал сам

| AC | Заявлено | Проверено как |
|---|---|---|
| AC1 | snapshot цвета/opacity/fill_opacity=0, независимость от будущего decor default | unit (`stairs.test.mjs`) + smoke (`newStairsSnapshotCurrentDecorStyle`, `legacyReadDoesNotMaterializeStyle`) — прогнано мной, все true |
| AC2 | два color picker, Save/Cancel/reopen, смена типа сохраняет | smoke (`propertiesExposeBothColourControls`, `cancelKeepsStairVisualStyle`, `reopenRestoresPersistedStyle`, `kindSwitchKeepsIdentityAndLink`) — прогнано мной |
| AC3 | цвет на outline/trapezoid/treads/arrow, fill на весь rect/circle, hover/selected — только временный outline | unit DOM (CSS в `plan.styles.ts`, прочитано) + golden (я прогнал `golden:verify`, 184/184) |
| AC4 | трапеция 100/80, отступы 10%, forward/«Вверх» 80→100, стрелка одинакова | unit geometry (`stairs.test.mjs`, прогнано: `backward.arrowPath === geometry.arrowPath`) + golden |
| AC5 | treads строго между боковыми сторонами, широкое основание не дублируется | unit (`trapezoid.length === 3`, прогнано) + golden |
| AC6 | N минимизирует \|L/N−30см\|, tie → большее N, resize повторяем | unit `stairIntervalCount` — прогнано (288→10, 40→2 с комментарием «tie», 0→1) |
| AC7 | «Вверх/Вниз» на 4 языках, spiral не меняется | unit i18n (`i18n.test.mjs`, прогнано, 27/27) + smoke |
| AC8 | legacy fallback без записи, backend отклоняет плохие color/opacity | frontend unit (`stairVisualStyle` не мутирует legacy-объект, прогнано) + backend (`test_validation.py`, читано; 4 новых `broken`-кейса на `color`/`opacity`/`fill_color`/`fill_opacity`) |
| AC9 | backup/import/export/copy/support сохраняют безопасные поля | backend (`test_ha_import_export.py`, `test_support_package.py`, читано: unknown-поле `future_stair`/`unknown` подтверждённо отброшено, цветовые сохранены) |
| AC10 | footprint/bounds/magnet/hit target не зависят от trapezoid | проверено чтением: `stairFootprintGeometry`/`stairOutline` не используют `trapezoid`; regression-тест `#663 stair magnet …` не тронут диффом |
| AC11 | одна geometry для View/editor/2.5D/PDF, PDF монохромный | проверено чтением: PDF и View/editor вызывают один и тот же `cachedStairRenderGeometry`; unit (`pdf-scene.test.mjs`, прогнано: `styledOutput.commands` идентичен `plainOutput.commands`) |
| AC12 | только active получает cursor pointer | smoke (`getComputedStyle(linkedNode).cursor === 'pointer'`, прогнано) + regression target-state тесты (не тронуты) |
| AC13 | light/dark: transparent default, **пользовательские цвета**, straight-направления, spiral, без theme-подмены | golden — **см. находку M1: пользовательские цвета в матрице не представлены** |
| AC14 | кеш геометрии не зависит от стиля; 250 лестниц в бюджете | unit (`cachedStairRenderGeometry` — правка цвета не инвалидирует кеш, прогнано) + `scripts/model-invariants.mjs --config` на экспорте `makeLargeHouseFixture` (250 лестниц) — прогнано мной, «Инварианты выполнены» |

### Гейты — что прогнал я сам и почему

CI Validate на точном SHA (`20d2863e`) я не считаю панацеей автоматически —
проверил, что именно выполнилось, а не пропущено через reuse-механизм:

| Гейт | Статус | Источник |
|---|---|---|
| `npx tsc --noEmit`, `npm run build`, unit, bundle-sync | зелёные (реально исполнены) | run [36347331581](https://github.com/Matysh/houseplan-card/actions/runs/36347331581) job «Фронтенд: типы, юниты, мутанты, синхрон бандла» — success; я также сам прогнал `npm run build` локально — успех |
| Мутанты по диффу (6/6 шардов, включая 3 новых свидетеля #683: `stairs-tread-count-depends-on-render-scale`, `stairs-legacy-save-keeps-implicit-style`, `stairs-active-link-loses-pointer-cursor`) | зелёные, реально исполнены | run [36347608885](https://github.com/Matysh/houseplan-card/actions/runs/36347608885) — все 6 шардов success (не skipped) |
| Backend pytest с полным HA harness | зелёный, реально исполнен (не reuse) | run [36346278615](https://github.com/Matysh/houseplan-card/actions/runs/36346278615), SHA `99569753` (backend-релевантные файлы не менялись после этого коммита при ребейзе — сверено диффом) — job «Бэкенд: pytest в Home Assistant» success |
| `npm run golden:verify` (полная матрица, 184 сцены — `--only` не поддержан CLI, флаг был проигнорирован и прогнал всё) | **прогнал сам**, exit 0, все сцены `passed`, ни одной ошибки/расхождения | локально, эта сессия |
| `node demo/smoke_stairs.mjs` | **прогнал сам**, 62/62 проверки `true`, `OK` | локально, эта сессия |
| `node scripts/model-invariants.mjs --config <экспорт>` на `demo/fixtures/large-house.mjs` (250 лестниц, AC14) | **прогнал сам**, «Инварианты выполнены: ссылки разрешимы, записи толщины находятся» | локально, эта сессия |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | **прогнал сам**: 22 прямых совпадения, из них ровно один осмысленный (`demo/smoke_stairs.mjs`) — остальные 21 совпали по широким символам (`_decorStyle`, `cellCm`, `NORM_W`, `GRID_N`), общим для десятков несвязанных смоков; не прогонял их отдельно — риск для лестниц там нулевой | локально, эта сессия |
| `test/i18n.test.mjs`, `test/stairs.test.mjs`, `test/pdf-scene.test.mjs` | **прогнал сам** | локально: 27/27, 43/43, все pass |
| `python -m pytest tests_backend` | **не прогнал** — в этом окружении нет `.venv-backend`/`homeassistant`; полагаюсь на CI-прогон с реальным harness выше, а не на голый pytest (он бы скипнул `test_ha_*.py` и ничего не доказал, `docs/TESTING.md`) | — |
| `npm run golden:capture`/full performance suite | не прогонял — предрелизный объём, не требуется гейтом ревью (§8) | — |

## Находки

### M1 (Medium, в скоупе) — AC13 не показывает «пользовательские цвета» в golden

`demo/golden/matrix.mjs:271-282` определяет ровно 4 сцены лестниц через один и
тот же фикстур `stairLayerFixture` (`demo/golden/matrix.mjs:210-223`). Ни один
из четырёх объектов там не задаёт `color`/`opacity`/`fill_color`/
`fill_opacity` — все они рендерятся с fallback-значением decor-default
(`#607d8b`, `fillOpacity: 0`). Я проверил: во всём `demo/golden/matrix.mjs` и
`demo/golden/harness.mjs` нет ни одного места, где стул задаёт кастомный
цвет/заливку для лестницы.

AC13 в теле issue дословно требует: «Светлая и тёмная темы показывают
transparent default, **пользовательские цвета**, оба straight-направления и
spiral без theme-dependent подмены» с единственным заявленным способом
доказательства — `golden`. Фактически принятая матрица показывает только
default-стиль (транспарентная заливка, дефолтный цвет) во всех четырёх темах/
режимах; отдельного кастомного (не-default) цвета/прозрачности лестницы в
golden нет вообще.

Прецедент в этом же фикстуре показывает, что проект такую ось считает нужной:
`geo-axis-h` (decor-линия в том же `golden-geometry`, `demo/fixtures/
visual-matrix.mjs:88-89`) намеренно несёт явный нестандартный `color`/
`opacity`, отличный от темы, и это видно в golden. У лестниц аналога нет.

Смок (`coloursAndOpacityPersistAsOneEdit` в `demo/smoke_stairs.mjs`, я
прогнал — true) подтверждает, что кастомный цвет реально долетает до
`--hp-stair-line`/`--hp-stair-fill` в DOM, и CSS-правило, которое их
потребляет (`plan.styles.ts:1567-1585`), — тривиальный `var()`-проброс,
уже используемый для декора в других местах. Поэтому фактический
визуальный риск невелик — но заявленное доказательство (golden) для этой
конкретной фразы AC13 отсутствует, а не «ослаблено».

**Чем краснеет:** пусто (defensive-таблица не заведена для этого пункта,
хотя AC13 — не защитный AC, а описательный про рендер; тем не менее
раздел §8/§2.7 требует не пустой ответ на вопрос «доказано ли заявленное»).
Возврат автору: либо добавить сцену/вариант с явным нестандартным
`color`/`fill_color`/`opacity` у одной из лестниц фикстуры и принять
получившийся кадр, либо сузить текст AC13 в issue до того, что матрица
реально показывает (default + оба направления + spiral + обе темы, без
пункта про custom-цвета) и явно отметить, где custom-цвет доказан иначе
(смок).

Это Medium **в скоупе** задачи (сам golden-фикстур лестниц — часть
`demo/golden/matrix.mjs`, явно перечисленного в §11 ТЗ как область
изменений и являющегося прямым deliverable AC13/§13 плана тестов). Без
блокирующего High это дает жёлтый вердикт и возврат автору, а не отдельный
issue (#202).

## Что проверено и корректно

- **Геометрия трапеции/направления (§5, AC4/AC5).** Стрелка
  (`from`/`tip` в `stairRenderGeometry`) больше не зависит от `direction` —
  вычисляется один раз по канонической локальной оси; разворачивается
  только `startHalfWidth`/`endHalfWidth` (0.4/0.5 в зависимости от
  `forward`/`backward`). Совпадающее с внешним прямоугольником широкое
  основание не дублируется: третья линия трапеции всегда берёт узкую
  (0.4) сторону. Таблица режим→legacy→узкое/широкое основание из ТЗ
  сходится с кодом построчно.
- **Равномерный шаг (§6, AC6).** `stairIntervalCount` — чистая функция:
  `lower=floor`, `upper=ceil`, сравнение `error(upper) <= error(lower)`
  корректно выбирает большее N на равенстве (строгое `<=` в пользу
  `upper`). И прямая, и спиральная геометрия используют её на физической
  длине в см (`stair.length * cellCm * GRID_N` — точная инверсия старого
  `cmToNorm`), а не на нормализованных единицах.
- **Кеш геометрии не зависит от стиля (AC14).** `renderFingerprint`
  строится только из `kind/x/y/angle/direction/length/width/radius` (и
  `cellCm/scale`) — цветовые поля туда не входят; я убедился прогоном
  теста, что правка `color/opacity/fill_color/fill_opacity` у уже
  закешированного объекта не создаёт новую геометрию, а поворот — создаёт.
- **Snapshot и legacy fallback (§4, §9, AC1/AC8).** `stairVisualStyle`
  не мутирует переданный `stair` (проверено и юнитом, и построением
  функции — она только читает и возвращает новый объект). Материализация
  происходит только в `saveDialog` через `stairVisualFields(dialog)`,
  и «unchanged»-детектор специально сравнивает уже материализованный
  `next` с `current` — поэтому первый Save старой записи всё равно
  запишет полную четвёрку, даже если пользователь не менял ни одного
  видимого значения. Это осознанное и корректное поведение, соответствует
  ТЗ дословно.
- **Смена типа сохраняет цвета (§9, AC2/AC9).** `convertStairKind`
  переписан на деструктуризацию `{ kind, direction, length/width/radius,
  ...common }` — `common` включает цветовые поля и переживает конверсию в
  обе стороны.
- **Backend-контракт (§9, AC8/AC9).** `STAIR_SCHEMA` получил `color`/
  `fill_color` через существующий `_COLOR` и `opacity`/`fill_opacity`
  через `_finite` + `Range(0, 1)` — точное повторение уже существующего
  `_DECOR_COMMON`-паттерна, не изобретение нового. Позитивные списки в
  `import_export.py`/`support_package.py` дополнены четырьмя полями;
  тесты явно проверяют, что случайное `unknown`/`future_stair` поле
  всё равно отбрасывается, а разрешённые — нет.
- **PDF остаётся монохромным при тех же путях (§7, AC11).** Новый unit-тест
  `#683 PDF keeps stair visual styling monochrome…` — я прогнал —
  сравнивает командный поток PDF для стилизованной и обычной лестницы и
  требует их побитового равенства; отдельно проверяет, что трапеция и
  равные ступени реально попадают в PDF-путь (≥5 линий толщиной 0.25мм).
- **Cursor pointer только у active-ссылки (§7, AC12).** Живой DOM-смок
  (`getComputedStyle(linkedNode).cursor === 'pointer'`) — не только
  проверка класса/атрибута, а фактическое вычисленное CSS-свойство в
  headless Chromium; я прогнал его сам и получил `true`. Регрессионные
  проверки для `missing/self/deleted/fixed` состояний (`data-target-state`)
  не задеты диффом и не сломаны.
- **i18n (§10, AC7).** Ключи `stairs.forward`/`stairs.backward` заменены
  (не алиасированы) на `stairs.up`/`stairs.down` во всех 4 языках
  одновременно; grep по всему дереву не нашёл ни одной оставшейся ссылки
  на старые ключи. Общий i18n-тест ключевого паритета зелёный.
- **Бюджет (§14).** `INITIAL_VIEW_GZIP_CEILING` поднят с 299700 до 300200
  внутри того же общего лимита 301066 (не расширен), с подробным
  обоснованием в комментарии и правкой того же коммита — не «тихая»
  правка.
- **Манифест схемы (`scripts/config-schema.json`).** Отдельный `fix`-коммит
  корректно регенерирует 4 новых поля тем же детерминированным скриптом,
  найденная автором сама несостыковка (устаревший Validate) обработана
  штатно (повторный S7, не апелляция к владельцу).
- **Golden-принятие.** Изменились ровно 4 объявленные сцены; аттестация
  `Baseline-Reviewed-Local` в `baselines-index.json.localAttestation.sha256`
  дословно совпадает с трейлером коммита `2c9ff32d`; полный прогон
  `golden:verify`, который я выполнил сам в этой сессии, зелёный на всех
  184 сценах, включая 4 сцены лестниц — регрессий нет нигде в матрице.

## Чего не проверял

- Полный `python -m pytest tests_backend` с реальным Home Assistant —
  недоступно в этом окружении (нет `.venv-backend`); опираюсь на CI-прогон
  с harness (run 36346278615) на backend-эквивалентном дереве, а не на
  голый pytest.
- Полный browser-smoke матрицы (278 смоков) — не требуется гейтом ревью
  (§8, предрелизный объём); прогнал только `smoke-select`-совпадения и
  явно AC-именованный `demo/smoke_stairs.mjs`.
- `performance_smoke`/perf-профили — не названы в AC явно (AC14 говорит
  «performance-smoke/review», и я закрыл это через прямой прогон
  `model-invariants` + чтение бюджета O(N); отдельный perf-профиль не
  прогонял, посчитал избыточным для локальной геометрии одной лестницы).
- Реальный ручной клик в браузере (десктоп/тач) — ручного тестирования в
  цикле нет по регламенту; полагаюсь на смок с реальным `getComputedStyle`
  и golden-скриншоты вместо этого.
- Не проверял 2.5D-специфичный рендер глазами за пределами принятого
  golden-кадра `stairs-isometric-dark` (доверяю авторскому visual-diff
  review, отмеченному в handoff).

## Вердикт

Одна находка Medium (M1) внутри скоупа задачи: заявленное в AC13
доказательство («golden» показывает «пользовательские цвета») фактически
отсутствует — все четыре принятые сцены лестниц используют только
fallback-стиль. Остальные 13 AC полностью доказаны исполненными гейтами
(частично прогнанными мной лично в этой сессии) или чтением с прямой
ссылкой на строку кода. High-находок нет.

**Жёлтый.** Возврат автору: закрыть M1 (добавить кастомный цвет/заливку в
`stairLayerFixture` и принять получившийся кадр, либо явно сузить текст
AC13 под фактический охват и указать альтернативное доказательство для
оставшейся части фразы).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/683-stair-visuals`, коммит `20d2863eea3f` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0c19e8c122b0627c86c740178ee3785f35e3ea1c`
  ```
  git log --all --format='%H %T' | grep 0c19e8c122b0
  ```
- Тело issue: `5f2e2a957f1cd2869b4e054901cbce315227e529cb9fcc68495857756083a7f6`
- Вердикт конвейера: `yellow` · High 0
