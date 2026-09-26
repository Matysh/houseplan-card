# CODE-REVIEW-654-r1

Issue: #654 · заход r1 · материал: `f5c6d70b7c1013eb6335d71b4abbd4f52f895915` (единственный коммит на ветке, `git log --oneline origin/dev..HEAD`), рабочая копия проверена на этом же SHA (`git status` — чисто).

## Скоуп

Полный трек (аналитика уже зафиксировала: сложность 6/10, риск для render-path и асинхронного контракта первого кадра — критерии `small`/`trivial` не выполнены). Правит два дефекта первого кадра 2.5D:

1. `getComputedStyle` внутри `_renderBody()` (вызывается из `render()`) — вынесено в `updated()` и мемоизировано.
2. Возможная вспышка Flat→2.5D при холодном старте/kiosk, пока грузится ленивый `iso-scene-render` — закрыто состоянием готовности первого кадра, переиспользующим существующий boot veil.

Класс A (`src/houseplan-card.ts`, новые `src/iso-first-frame.ts`, правки `src/iso-materials.ts`, `src/styles/plan.styles.ts`) + класс B (`test/iso-stage6.test.mjs`, новый `demo/smoke_iso_first_frame.mjs`, `scripts/render-layout-read.mjs`, правки `scripts/gate-small.mjs`, `scripts/check-inputs.mjs`, `scripts/smoke-links.mjs`, `scripts/mutation-registry.mjs`, `scripts/bundle-budget.mjs`, `tsconfig.test.json`) + класс C (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`, `docs/ISOMETRIC.md`) + класс D (пересобранный `dist/**`/`custom_components/houseplan/frontend/**`, скриншоты). Трейлеры коммита: `Issue: #654`, `User-Visible: yes` — оба changelog правлены в том же коммите. Соответствует Rule #1 (issue в `S7-code-review`) и таблице классов AGENTS.md.

Соответствие `docs/SCOPE.md`: J1/J2 (правильная спатиальная картина «с первого взгляда», без ложного тёмного-пола кадра) и исключение #89 (детерминированное 2.5D-представление той же карты, без нового движка/камеры) — задача полностью укладывается в закрытые core-jobs, нового функционала не добавляет.

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate на этом SHA (workflow_dispatch, https://github.com/Matysh/houseplan-card/actions/runs/36223220008): `Фронтенд: типы, юниты, мутанты, синхрон бандла` — success, `Мутанты по диффу (1..6)/6` — все success, `Бэкенд: pytest в Home Assistant` — success (изменений в Python нет, это уже отвязано от диффа). Эти job'ы не гоняю повторно.

Сам прогнал (свежий build+bundle:sync перед смоками):

| Гейт | Команда | Результат |
|---|---|---|
| AST layout-read | `node scripts/render-layout-read.mjs` | `OK` |
| unit (файл диффа) | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/iso-stage6.test.mjs` | 13/13 green |
| no-new-any | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | новых `any` нет |
| no-new-private-writes | `node scripts/no-new-private-writes.mjs --base origin/dev --head HEAD` | новых записей нет |
| bundle budget | `npm run bundle:budget` | initial View 295 055 B (потолок 296 000, ±2000) — совпадает с заявленным автором замером (295 047), новый потолок обоснован в комментарии `scripts/bundle-budget.mjs` |
| docs | `node scripts/check-docs.mjs` | зелёный (7 файлов, 12 ссылок) |
| process-gate | `node scripts/process-gate.mjs --issues` | 0 предупреждений |
| smoke (новый, AC1/AC3/AC4) | `node demo/smoke_iso_first_frame.mjs` | все 7 проверок green |
| smoke (регресс, названы в плане ТЗ) | `smoke_isometric_contract.mjs`, `smoke_iso_theme_walls.mjs`, `smoke_iso_tiles.mjs` | все проверки green, включая `editorIsFlat`/`viewRestoresIso` |
| smoke (touch/kiosk, AC6) | `smoke_isometric_live_touch.mjs` | все проверки green (`kioskSettingOffIsFlat`, `warmRemountIso`, touch pinch/pan) |
| smoke (boot veil, соседний контракт) | `smoke_preloader_lifecycle.mjs` | все проверки green |
| smoke (выбранный `smoke-select`, помеченный автором как посторонний Windows-сбой) | `demo/smoke_furniture_lazy_art.mjs` | green на Linux — подтверждает, что репортованный автором сбой (`C:\C:\...`) действительно средовой, не регрессия |

`node scripts/smoke-select.mjs --base origin/dev --head HEAD --json` — 276 попаданий (в основном слабые совпадения по `_mode`/`_spaceModel`/`_modeTransitionBusy`, естественные для монолита с одним общим классом), плюс точный `registered`-линк на новый смок (`smoke-links.mjs`). Прогнал все «сильные» совпадения, относящиеся к 2.5D/boot-veil/kiosk; остальные ~260 слабых попаданий (правки формы, стен, декора и т.д., через общие геттеры) не трогают изменённый код по существу — их не гонял, дифф их не затрагивает функционально, а полный прогон 276 смоков не соразмерен объёму задачи (PROCESS §8, «полные наборы — предрелизный гейт»).

Два целевых исполнительных пробника (не коммитятся, только для ревью, средой Linux Chromium из `demo/serve.mjs`):
- живой счётчик `getComputedStyle` на span'е `_cssColor`: 5 не относящихся к теме/режиму обновлений `hass` → 0 новых вызовов; последующая смена `darkMode` → ровно 1 новый вызов. Прямое доказательство AC2 «без смены темы/режима новый вызов для бумаги не появляется» на уровне исполнения браузера, а не только по unit-тесту состояния.
- покадровая выборка `View → редактор (тёмная тема) → View` на дефолтном фикстурном пространстве `f1`, которое по умолчанию является image-plan (`bg` truthy, подтверждено — см. ниже) — переход никогда не показал `.stage.projection-iso` с `readiness !== 'ready'`; кадр либо ещё `iso:false` (в процессе `_modeTransitionBusy`), либо уже `iso:true, readiness:'ready'`. Подтверждает AC5 «без промежуточного неверного набора» для того случая, для которого регрессионный смок (`smoke_isometric_contract.mjs`) проверяет только финальное состояние, а не покадрово.

## AC → доказательство → чем краснеет

| AC | Доказано | Чем краснеет |
|---|---|---|
| AC1 — классификация с первого кадра | unit (`memoIsoLightFloorRooms`, `IsoFirstFrameState.sync` в `test/iso-stage6.test.mjs`) + smoke (`smoke_iso_first_frame.mjs`: `ordinaryFirstVisibleIsSettledIso`/`kioskFirstVisibleIsSettledIso` требуют `light===true`, `shadowOpacity==='1'` с первого видимого кадра) | мутант `iso-first-frame-reads-paper-during-render` (возврат DOM-чтения в `_renderBody`) ловится гейтом `render-layout-read.mjs` — подтверждено в CI («Мутанты по диффу», все 6 success) |
| AC2 — нет layout-read в render-пути | AST (`scripts/render-layout-read.mjs`, проверяет `render`/`_renderBody`/`willUpdate` + все `src/iso-*.ts`) + unit (`resolves` counter) + мой живой счётчик вызовов в браузере (0 лишних, 1 на смену темы) | тот же мутант выше; отдельно — снятие guard `paperReady && context.key === this.paperContext` в `sync()` не зарегистрировано как diff-мутант, но по чтению кода единственный существующий unit-тест (`assert.equal(resolves, 1, ...)`) его ловит |
| AC3 — атомарный холодный старт | smoke (`ordinaryNeverShowsIntermediateFlat`, `ordinaryPendingOutlivesBootCap`, `kioskNeverShowsIntermediateFlat`) — покадровая выборка `requestAnimationFrame` при задержанном чанке (1600 мс/350 мс, дольше boot cap) | мутант `iso-first-frame-reveals-flat-during-lazy-load` (снятие `hpiso-pending`) ловится смоком — подтверждено в CI |
| AC4 — безопасный отказ | smoke (`failedChunkReleasesFiniteFlatFallback`) при инъецированном 503 на оба внутренних retry-attempt `EditorRuntimeLoader`; редакция диагностики — существующий регресс-тест `smoke_isometric_contract.mjs::isoDiagnosticsAreRedacted/lateFailureIsRedactedAndLatched` (не менялся, зелёный) | сам смок падает без release-to-Flat; диагностика проверена построчно чтением `failed:` колбэка — `runtimeFailure()` вызывается независимо от `info.terminal`, что корректно: `EditorRuntimeLoader._loadWithRetry` уже исчерпал оба попытки до вызова `failed`, фоновых ретраев нет — «зависание» невозможно по конструкции (`src/editor-runtime-loader.ts:90-113`) |
| AC5 — точная инвалидация кэша | unit (`memoIsoLightFloorRooms` реагирует на бумагу/fill/rooms; `IsoFirstFrameState` реагирует на смену контекста) + smoke `smoke_isometric_contract.mjs::editorIsFlat/viewRestoresIso` (финальное состояние) + мой покадровый пробник (промежуточных кадров нет) | мутант `iso-light-floor-memo-never-reuses` (unit) — подтверждено в CI; для перехода режимов отдельного diff-мутанта нет, закрыто прямым исполнением пробника выше |
| AC6 — соседние контракты | smoke `smoke_isometric_live_touch.mjs` (touch pinch/pan, kiosk on/off, warm remount), `smoke_iso_tiles.mjs`, `smoke_iso_theme_walls.mjs` — все зелёные, включая theme/colour-scheme неизменность | регрессия названных смоков — существующие ассерты (`themeKeepsWalls`, `flatBack`, `kioskSettingOffIsFlat` и т.д.) |

## Находки

Нет находок в скоупе, требующих цикла. Один Low, снимаю с записью (правка не обязательна, серьёзность недостаточна для цикла):

- **Low — строка CSS-фолбэка бумаги утроена.** `'var(--ha-card-background, var(--card-background-color, #111))'` + `'rgb(17, 17, 17)'` теперь повторяется буквально в трёх местах: `src/houseplan-card.ts:1207`, `:1212` (было раньше, не новое) и новое `:4029` (`_isoFirstFrame.sync(...)`). Функционально корректно — значение сейчас идентично во всех трёх местах, гейты это подтверждают, — но это утроенный магический литерал, а не общая константа/хелпер. Риск чисто в сопровождении: будущая правка одного места без остальных двух разошлась бы. Не блокирует, помечаю как принятый долг без отдельного issue (масштаб слишком мал для §12).

## Что проверено и корректно

- Порядок Lit-хуков: `prepare()` в `willUpdate()` (до рендера, синхронно и детерминированно — сразу коммитит белую бумагу для drawn-плана), `sync()` в `updated()` (после коммита DOM, только там читает `getComputedStyle` через `_cssColor`) — соответствует ожиданию п.1 issue «вне render()/willUpdate()».
- `_isoFirstFrame.pending()`/`readiness()` корректно развязаны от `_desiredProjection`: Flat-карточка и все редакторы никогда не получают `pending`/wait (`readiness('flat', ...) === null` — подтверждено unit и smoke `flatKioskHasNoIsoWait`).
- Boot veil переиспользован буквально (тот же `<div class="bootveil">`, тот же CSS-приём `visibility:hidden` на `.zoomwrap`/`.zoombadge`), новый класс `hpiso-pending` добавлен в тот же селектор в `plan.styles.ts` — соответствует «принято предположительно» пункту ТЗ.
- `EditorRuntimeLoader` вызывает `failed()` только после того, как обе внутренние попытки (`attempt 0/1`) исчерпаны и никакого фонового ретрая не будет (`src/editor-runtime-loader.ts:90-113`) — поэтому `runtimeFailure()` в колбэке `failed` корректно вызывается вне зависимости от `info.terminal`: и `terminal:false` (сетевой сбой) кладёт loader в `idle`, откуда следующий явный `_ensureIsoSceneRuntime()` (например, повторное включение настройки) снова вызывает `runtimeLoading()` и сбрасывает флаг — воспроизведено смоком `lateFailureExplicitRetryRestoresIso` (существующий, зелёный).
- Бюджет бандла: рост потолка на 1100 Б обоснован комментарием с разбивкой и подтверждён замером (295 055 Б у меня против 295 047 Б у автора — расхождение мкб из-за версии окружения, оба ниже потолка 296 000).
- i18n не менялся, `docs/USER-GUIDE.ru.md` терминология («Объёмный вид») не расходится, новых строк нет — соответствует заявленному «нет i18n-изменений».
- `docs/ISOMETRIC.md` дополнен точным описанием нового контракта (cold start, kiosk, terminal failure, paper resolution timing) — соответствует Release-артефактам ТЗ.

## Чего не проверял

- Полный `npm test`/`npm run typecheck`/`npm run build` целиком не перегонял — доверяю зелёному Validate на этом же SHA (`Фронтенд: типы, юниты, мутанты, синхрон бандла` — success); только пересобрал (`npm run build`/`bundle:sync`) как предпосылку для локальных смоков.
- `golden:verify` не гонял: ТЗ прямо говорит «не ожидаются, установившийся кадр не меняется»; сам факт, что демо-скриншоты (`docs/images/*.png`) обновились в этом диффе — это WSL-принятые документационные скриншоты (заявлены автором как 11/11 pixel-identical), а не golden-baseline; `check-docs.mjs` их принял.
- `python -m pytest tests_backend` не гонял вручную — диф не касается `custom_components/houseplan/**/*.py`; в Validate этот job зелёный без изменений на входе.
- Инварианты модели (`npm run invariants`) не гонял — задача не трогает геометрию/wall/room-модель, только presentation-таймінг и лениво загружаемый рендер; ни один AC их не называет.
- Из 276 позиций `smoke-select` прогнал точный `registered`-линк и «сильные» iso/kiosk/touch-совпадения (см. таблицу выше); ~260 слабых совпадений (по одиночным геттерам вроде `_spaceModel`/`_mode`, не связанным с изменённой логикой по существу) не гонял — несоразмерно объёму полностью прогонять весь набор на этой задаче.
- Performance-профиль (`performance_smoke`) не гонял: не назван в AC, Validate этот job на обычном push скипает по design (не `Release`/`full=true`/PR).
- Визуальную деградацию плиток/материалов 2.5D не разбирал повторно — геометрия и материалы прямо исключены из скоупа задачи («Не скоуп»), и `smoke_iso_tiles.mjs`/`smoke_iso_theme_walls.mjs` не тронуты по существу (только импорт нового модуля/памятки), зелёные без изменений в их логике.

## Вердикт

Зелёный. AC1–AC6 доказаны сочетанием AST/unit/smoke/diff-mutants и там, где автотеста не было, — прочтением кода плюс двумя точечными исполняемыми пробниками этого ревью (счётчик layout-read и покадровый переход режимов). Единственная находка — Low, снята с запиской, цикла не образует.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/654-iso-first-frame`, коммит `f5c6d70b7c10` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `06d2377b0c58f32daf6a381eea14b054c7b2c680`
  ```
  git log --all --format='%H %T' | grep 06d2377b0c58
  ```
- Тело issue: `d96095b1978fa9259b2fe1fa89ed256c0a292a59b2850e254cb56b8fb19a4ad1`
- Вердикт конвейера: `green` · High 0
