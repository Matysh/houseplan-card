# Code review — issue #146, cycle r1

Вердикт: **красный** · цикл r1/4 · High: 1 · Medium: 0

Ветка: `issue/146-four-phase-sun-background` · implementation-коммит
[`debb13b`](https://github.com/Matysh/houseplan-card/commit/debb13baa280042c79a004c97152e3b1be5ab11b)
· ТЗ: [`docs/specs/146-four-phase-sun-background.md`](../specs/146-four-phase-sun-background.md)
(зелёный [`SPEC-REVIEW-146-r1`](SPEC-REVIEW-146-r1.md), High:0, Medium:1 → #147,
не блокирует).

## Скоуп проверки

`git diff origin/dev...HEAD` — 35 файлов, 2575(+)/782(-). Ядро изменений:
`src/sun.ts` (новый `resolveDayCycle`/палитра/резолвер), `src/day-cycle-render.ts`
(новый файл — общие layer-шаблоны), `src/houseplan-card.ts` (lifecycle,
defaults, рендер стейджа), `src/space-card.ts`/`src/space-render.ts`
(статическая карточка), `src/styles.ts` (весь визуальный контракт),
`custom_components/houseplan/{store,const,import_export}.py` (миграция и
export/import), `src/i18n/{en,ru}.json`, тесты (`test/sun.test.mjs`,
`tests_backend/test_ha_import_export.py`, smoke), документация (`SUN.md`,
`ARCHITECTURE.md`, `CONFIG-COMPATIBILITY.md`, `USER-GUIDE.ru.md`,
`TESTING.md`, `STYLING-HOOKS.md`) и оба changelog.

Единственный implementation-коммит `debb13b` несёт `Issue: #146` ·
`User-Visible: yes`; оба changelog обновлены в этом же коммите — требование
выполнено. Три копии bandle идентичны (см. ниже).

## Как проверялось

Дешёвые гейты (всегда):

- `npx tsc --noEmit` → **зелёный**, без вывода.
- `npm test` → **802/802 green**.
- `npm run build` → зелёный; свежая пересборка дала SHA-256
  `67293527e2154b2bc879d45a173dfba64c5a70cd090e770059e2b08c7c6ea0fe` для всех
  трёх файлов (`dist/houseplan-card.js`,
  `custom_components/houseplan/frontend/houseplan-card.js`,
  `demo/srv/assets/houseplan-card.js`) — совпадает с хендофф-комментарием
  автора; `git status` после билда пуст (закоммиченные копии побайтно
  совпадают со свежей сборкой).

Гейты по необходимости (diff меняет рендер/CSS-layering/lifecycle на всех
поверхностях фона — обоснование запуска целевых smoke и golden):

- `node demo/smoke_bg_color.mjs` → все проверки `true`, `OK` (paper opacity,
  night-does-not-dim-plan, static/kiosk/space-card parity).
- `node demo/smoke_sun.mjs` → все проверки `true`, `OK` (существующие оконные
  лучи/compass не задеты).
- `node demo/smoke_sun_live_bg.mjs` → все проверки `true`, `OK`.
- `node demo/smoke_general_settings.mjs` → все проверки `true`, `OK`, включая
  `newSpaceUsesDaynight`/`floorImportUsesDaynight` (AC10).
- `node demo/smoke_render_perf.mjs` → все проверки `true`, `OK`, включая
  `clockTickModelBuilds: 0`/`modelBuildsPer10Renders: 0` — прямое
  доказательство AC14 (нет geometry/device rebuild на clock tick).
- `npm run golden:verify` (полный набор, инструмент запрещает частичный прогон
  в режиме verify) → **нашёл найденный ниже High**. Дополнительно: 4 новые
  `day-cycle-*` сцены и другие тематические сцены (`plan-snap-*`,
  `wall-junctions-*`, `isometric-wall-junctions-dark`) — `missing-baseline`;
  для контроля я прогнал тот же `golden:verify` на чистом `origin/dev` (тот же
  Linux/Chromium в этой среде, `demo/golden/baselines/**` не менялся этим
  diff'ом) — там `plan-snap-*`/`wall-junctions-*` тоже отсутствуют, а
  `geometry-plan-editor-dark`/`tray-wide-selection-en`/`tray-wide-tool-ru`/
  `tray-medium-group-en` тоже `different`. Это подтверждает: это все —
  пред-существующая среда-специфичная нестабильность/техдолг, не относящийся к
  #146. Но `large-house-zoom-250-dark` на `origin/dev` **passed**, а на этой
  ветке (дважды, воспроизводимо) — `different`. Разбор ниже, в «Находках».
- `python -m pytest tests_backend` — не прогонялся: в этой среде отсутствует
  пакет `homeassistant` (`ModuleNotFoundError`), значит `test_ha_*.py`
  (включая новый `test_ha_import_export.py`) молча пропускаются, а зелёный
  результат ничего не доказывает (`AGENTS.md`, «Backend»). Backend-логика
  (`store.py::migrate_config_background_mode`, `import_export.py`) и сам новый
  тест проверены **чтением, не исполнением** — см. «Что проверено».
- Performance-профили/Full Performance — не прогонялись: предрелизный гейт
  (AC16), а таргетированный `smoke_render_perf.mjs` уже дал прямое числовое
  доказательство отсутствия rebuild на clock tick (см. выше).

## Находки

### [High] `.zoomwrap`'s новый `z-index: 1` прячет `.zoombadge` за планом на любом zoom>100% — независимо от `bg_mode`

**Файл:** `src/styles.ts:181-185` (`.zoomwrap { position: absolute; inset: 0;
z-index: 1; }` — строка `z-index: 1` добавлена этим diff'ом) против
`src/styles.ts:472-485` (`.zoombadge` — `position: absolute`, без `z-index`)
и `src/houseplan-card.ts:14758-14760` (`${this._zoom > 1 ? html`<div
class="zoombadge">...` : nothing}`, рендерится как **сиблинг** `.zoomwrap`,
после него в DOM).

**Причина.** До этого diff'а ни `.zoomwrap`, ни `.zoombadge` не имели
`z-index` — оба в слое `auto`, порядок рисования определялся порядком в DOM, и
`.zoombadge` (декларирован ПОСЛЕ `.zoomwrap`) закономерно рисовался сверху.
Этот diff добавил `.zoomwrap { z-index: 1 }`, чтобы держать план выше нового
`.hp-day-cycle-env { z-index: 0 }` (`styles.ts:201-208`). Но
`.hp-day-cycle-env` и без этого правила уже стоял бы ниже `.zoomwrap` по чистому
порядку DOM (он декларирован раньше) — явный `z-index: 1` был не нужен для
заявленной цели и стал побочным регрессом: положительный `z-index` выводит
ВСЁ содержимое `.zoomwrap` (план, комнаты, устройства, measure-layer) в более
высокий слой стекинга, чем любой сиблинг с `z-index: auto`, **независимо от
порядка в DOM**. `.farhint`/`.homearrow`/`.recoveryoverlay`/`.bootveil` не
задеты — у них уже был явный `z-index` (12/12/75/40). У `.zoombadge` его не
было и не появилось.

**Сценарий отказа:** любой пользователь View/kiosk, увеличивающий план сверх
100% (масштабирование колёсиком/пинчем — обычное действие, никак не связанное
с `bg_mode`), теряет видимый индикатор процента зума в левом нижнем углу —
элемент существует в DOM (`pointer-events: none`, не блокирует
взаимодействие), но визуально полностью скрыт под планом.

**Воспроизведено, не только прочитано:**

1. `npm run golden:verify` на этой ветке — сцена `large-house-zoom-250-dark`
   (View, `zoom: 2.5`, фикстура `bg_mode` не задан → эффективный режим
   `static`, то есть день/night-фон здесь вообще не активен — регресс не
   специфичен для `daynight`) даёт `different`; повторный прогон —
   тот же результат (детерминированно, не флейк).
2. Тот же `golden:verify` на чистом `origin/dev` (тот же чекаут, тот же
   Chromium) — та же сцена **passed**.
3. Визуальное сравнение `demo/golden/baselines/large-house-zoom-250-dark.png`
   (бейзлайн) и `artifacts/golden/actual/large-house-zoom-250-dark.png`
   (текущий рендер): единственное отличие — плашка `250%` в левом нижнем углу
   присутствует на бейзлайне и полностью отсутствует на актуальном рендере;
   `artifacts/golden/diff/large-house-zoom-250-dark.png` подсвечивает magenta
   ровно область этой плашки, весь остальной кадр — «без изменений» (серый с
   низкой альфой).

**Не покрыто ни одним AC/smoke этой задачи** — ни один из существующих
`demo/smoke_*.mjs` не проверяет видимость `.zoombadge` при zoom>1, поэтому
`npm test`/targeted smoke зелёные, а регресс виден только через golden-пиксели
существующей (не новой) сцены `large-house-zoom-250-dark`.

**Требуется:** дать `.zoombadge` собственный `z-index` выше `1` (например,
как у `.farhint`/`.homearrow` — `12`), либо убрать не обязательный для цели
`z-index: 1` с `.zoomwrap` (естественный порядок DOM уже держит его выше
`.hp-day-cycle-env` без этого правила) — на выбор автора; и повторный прогон
`npm run golden:verify` (весь набор — гейт verify не даёт частичного) до
`passed` на `large-house-zoom-250-dark`, а также визуальный просмотр 4 новых
`day-cycle-*` сцен перед их принятием как baseline.

## Что проверено и корректно

- **AC1 (real-sun резолвер границ)** — `test/sun.test.mjs` («day cycle: real
  sun selects exact four-phase boundaries») бьёт по обеим сторонам ±6° и
  точным границам при `rising`/`falling`; тест умеет падать (замена `<=`/`>=`
  на `<`/`>` в `dayCyclePhaseFromSun` немедленно ломает утверждения на
  границах).
- **AC2 (atomic clock-fallback на garbage)** — `test/sun.test.mjs` («strict sun
  snapshot keeps rays compatibility separate») перебирает
  missing/NaN/Infinity/non-boolean для каждого поля и подтверждает `null`
  (→ fallback), а `sunStateOf` (оконные лучи) не получил новое требование
  `rising` — соответствует ТЗ §7.1. `smoke_sun_live_bg.mjs`:
  `invalidSampleUsesClock: true`. Известное расширение до «любого из
  elevation/azimuth/rising» (а не только elevation/rising) реализовано именно
  так, как задокументировано в Medium-1 зелёного SPEC-REVIEW (→ #147,
  сознательно не блокирует, не новая находка).
- **AC3 (позиция света следует реальным данным, fallback — дуга прототипа,
  geometry не пересчитывается)** — `test/sun.test.mjs` («real decorative
  position…», «fallback arc and night visibility…») численно совпадает с §8.1/
  §8.2 ТЗ (east/south/west/north, дуга 05:00→13:00→21:00); `night.sunOpacity
  === 0` подтверждён и в unit, и в `smoke_sun_live_bg.mjs`
  (`nightLightHidden: true`). Отсутствие geometry rebuild — прямое числовое
  доказательство `smoke_render_perf.mjs` (см. «Как проверялось»).
- **AC5 (пиксели плана не меняются между фазами)** — прочитан
  `src/styles.ts:198-248`: единственный phase-зависимый эффект на SVG —
  `filter: drop-shadow(...)` на групповом `.hp-paperg` (три zero-offset
  drop-shadow, как требует §9) — drop-shadow не подмешивает цвет в пиксели
  самой фигуры, только рисует внешний halo за её alpha-контуром, поэтому
  внутренность footprint остаётся байт-в-байт прежней. Подтверждено визуально:
  `artifacts/golden/actual/day-cycle-dawn-dark.png` и `...night-dark.png` —
  комнаты/стены/labels идентичны по цвету между сценами, виден только
  внешний halo и фон вокруг плана. `smoke_bg_color.mjs`:
  `nightDoesNotDimPlan/nightPaperStaysOpaque/paperOpaque: true`. Старый
  потребитель `dayPhase().planDim` удалён из `_targetBrightness`
  (`houseplan-card.ts:908-911`, теперь безусловно `return 1`) и из
  `_stageBg`/`transitionBrightness` — риск №1 таблицы §19 ТЗ закрыт.
- **AC6 (переход 1100ms, plan не мигает, reduced-motion мгновенно)** —
  `smoke_sun_live_bg.mjs`: `phaseTransitionIs1100ms: true`; в `styles.ts`
  четыре константных `.hp-day-cycle-bg` слоя честно кросс-фейдят через `opacity
  1100ms` (не декларация `transition` на самом градиенте) — соответствует
  требованию §11.1 «действительно интерполируемые CSS primitives»; `@media
  (prefers-reduced-motion: reduce)` отключает все четыре анимируемых правила
  (`transition: none`).
- **AC7 (одна фаза на full View/kiosk/static card, editors не задеты)** —
  `smoke_bg_color.mjs`: `kioskApplies/kioskSharesDay/staticCardApplies/
  staticCardSharesDawn: true`; `_dayCycleState()` возвращает `null` при
  `viewWeight <= 0` (editors) — прочитано в `houseplan-card.ts:12654-12659`.
- **AC8 (фон работает без north/sun.sun, оконные лучи — нет)** —
  `smoke_sun_live_bg.mjs`: `backgroundIndependentOfNorth/
  raysStillNeedNorth: true`. i18n-хинты (`gs.sun_missing`, `gs.north_hint`)
  корректно переписаны на «фон работает, лучи — нет» в обеих локалях.
- **AC9 (однократная идемпотентная миграция)** — прочитан
  `custom_components/houseplan/store.py:29-71`: `migrate_config_background_mode`
  — чистая функция, no-op при уже валидном `bg_mode`, no-op на документах без
  `config` (layout/virtual-light stores), сохраняет неизвестные поля
  (`copy.deepcopy` + точечная модификация); вызывается только при
  `old_minor_version < 2` (после миграции `STORAGE_MINOR_VERSION=2` не
  перезапускает её). Новый тест
  `tests_backend/test_ha_import_export.py::test_background_defaults_and_store_migration_preserve_legacy_view`
  бьёт ровно эти случаи (idempotence через `is migrated`, сохранение
  `future_*`/`rev`, no-op для layout-подобного документа) — **проверено
  чтением, не исполнением** (см. «Как проверялось», нет `homeassistant`).
- **AC10 (новые defaults материализуют `daynight`, Edit не трогает
  существующий mode)** — `smoke_general_settings.mjs`:
  `newSpaceUsesDaynight/floorImportUsesDaynight: true`.
  `custom_components/houseplan/const.py`: `DEFAULT_CONFIG["settings"]["bg_mode"]
  == "daynight"`. Прочитан `houseplan-card.ts:12168` (space-dialog init
  сохраняет `null`, если явного override нет) и `:12961`
  (`bgModeOf(this._settings, {})` — глобальный dialog открывается с текущим
  ЭФФЕКТИВНЫМ режимом, не константой) — открытие+сохранение существующего
  space/global dialog без изменения выбора не меняет сохранённый режим.
- **AC11 (export/import контракт §12.4)** — прочитан
  `custom_components/houseplan/import_export.py`: `_materialize_global_
  background`/`_materialize_space_background` — раздельные fallback
  (`create_export` для space передаёт **эффективный global** экспортируемого
  инстанса, а `parse_document`/`build_space_merge` для одиночного
  space-импорта — жёсткий `"static"`, не режим целевой установки) — в точности
  различие, которое требует §12.4 («legacy per-space import не наследует
  target»). Новый тест `test_background_mode_is_materialized_across_export_
  and_legacy_import` бьёт full/space export, legacy full/space import (через
  `parse_document`) и `build_space_merge` — **проверено чтением, не
  исполнением**.
- **AC12 (i18n без нового режима, pointer-inert, не двигает focus/hit
  targets)** — `src/i18n/{en,ru}.json` обновлены симметрично, третий
  публичный токен не добавлен (селектор остаётся `static`/`daynight`,
  подтверждено чтением `houseplan-card.ts:14025-14027`). `.hp-day-cycle-env`
  — `pointer-events: none` (styles.ts:206) и `aria-hidden="true"`
  (`day-cycle-render.ts`). `npm test` включает общий тест полноты i18n-ключей
  (802/802 green) — контентная проверка конкретных строк выполнена чтением.
- **AC13 (lifecycle: 30s только в fallback+visible, catch-up, cleanup)** —
  `smoke_sun_live_bg.mjs`: `clockTimerArmed/hiddenStopsClock/
  visibleRestartsClock/visibilityKeepsHover: true`. Прочитаны
  `_dayCycleTick`/`_syncDayCycleClock`/`_dayCycleVisibility`
  (`houseplan-card.ts:12660-12706`) и их зеркало в `space-card.ts:143-190`:
  таймер существует только при `source === 'clock'` и видимой вкладке,
  `disconnectedCallback` чистит и таймер, и `_dayCycleClockKey` в обоих
  файлах.
- **AC14 (bounded update, без geometry/device rebuild, RAF/canvas/сети/
  storage)** — прямое числовое доказательство `smoke_render_perf.mjs`:
  `modelBuildsPer10Renders: 0`, `clockTickModelBuilds: 0`,
  `clockTickKeepsModel/Devices/WallUnion/SunRays: true`. Diff не добавляет ни
  `requestAnimationFrame`, ни canvas/WebGL, ни новых сетевых/HA/storage вызовов
  — подтверждено чтением всего diff (`git show debb13b`).
- **AC15 (гейты, документация, три bundle, один коммит)** — единственный
  коммит `debb13b` несёт оба трейлера, оба changelog,
  `SUN.md`/`ARCHITECTURE.md`/`CONFIG-COMPATIBILITY.md`/`USER-GUIDE.ru.md`/
  `TESTING.md`/`STYLING-HOOKS.md` и все три копии bundle; локальная пересборка
  побайтно совпала (см. «Как проверялось»).
- **Инвариант неизменного плана (§10 ТЗ)** — ни один цветовой filter
  (`brightness`/`contrast`/`saturate`/`sepia`/`hue-rotate`), overlay или смена
  fill не применяется к дереву плана; единственный phase-зависимый filter —
  внешний drop-shadow на группе paper (см. AC5 выше). Старые
  `_skyPlan`/`_skyElev`/`_skySnap`/`.stage.daynight`/`.skysnap` полностью
  удалены, а не оставлены мёртвым кодом рядом с новым путём.
- **Security/network verdict (AC16, §18 ТЗ)** — прочитан весь diff: ни новых
  HTML/URL-приёмников, ни новых сетевых вызовов, ни новых HA service calls,
  ни новых storage-полей сверх заявленной `bg_mode`-семантики. Негативный
  вердикт подтверждается.

## Чего не проверял

- **`npm run golden:accept -- --reviewed`** — не выполнялся и не должен
  выполняться на этом этапе: 4 новых `day-cycle-*` сцены (и ряд не связанных с
  #146 сцен) остаются `missing-baseline`; принятие baseline — предрелизный шаг
  по полному Linux CI артефакту (`AGENTS.md`, `PROCESS.md` §8/13), не гейт
  код-ревью. Сами 4 сцены просмотрены визуально (`artifacts/golden/actual/
  day-cycle-{dawn,day,dusk,night}-dark.png`) — план не тонирован, ночью не
  виден световой круг, halo не создаёт по-комнатных швов; годны как кандидат
  на baseline после фикса High и повторного прогона.
- **`python -m pytest tests_backend`** — не выполнялся (нет `homeassistant` в
  этой среде); backend-логика и новый тест разобраны чтением (см. «Как
  проверялось» и AC9/AC11 выше).
- **Полный browser smoke-suite (127 файлов)** — не прогонялся; прогнаны 5
  целевых smoke, относящихся к тронутым поверхностям (`bg_color`, `sun`,
  `sun_live_bg`, `general_settings`, `render_perf`), плюс golden как более
  широкая пиксельная сеть — она и нашла регресс, не покрытый ни одним из этих
  smoke по имени.
- **Performance smoke / Full Performance (эталонные бюджеты)** — не
  прогонялись, предрелизный гейт; косвенное доказательство отсутствия rebuild
  уже получено через `smoke_render_perf.mjs`.
- **`prefers-reduced-motion`/`forced-colors` в реальном браузере с
  ОС-настройкой** — не проверялось интерактивно; поведение разобрано чтением
  CSS (`@media (prefers-reduced-motion: reduce)` блок в `styles.ts`) и
  соответствует контракту §13 ТЗ.
- **Ручной интерактивный проход в браузере (не headless)** — не выполнялся;
  весь визуальный вывод основан на golden/smoke харнессе и прямом просмотре
  сохранённых PNG.

## Итог

High: 1 (описан выше, блокирует — регресс видимости `.zoombadge` на
zoom>100%, воспроизведён детерминированно и локализован до одной CSS-строки).
Medium: 0 (единственная содержательная находка этого масштаба — расширение
azimuth-гейта на фазу — уже заведена на этапе ревью ТЗ как
[#147](https://github.com/Matysh/houseplan-card/issues/147) и не повторяется
здесь). Low: 0 новых; ранее отмеченные в SPEC-REVIEW Low-2/Low-3 не относятся к
коду.

Вердикт красный: цикл возвращается автору на исправление стекинга
`.zoombadge`/`.zoomwrap` (см. «Требуется» в находке), с последующим зелёным
`npm run golden:verify` на `large-house-zoom-250-dark` и визуальным
подтверждением 4 новых `day-cycle-*` сцен перед их будущим принятием как
baseline.
