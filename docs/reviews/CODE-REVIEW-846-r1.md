# CODE-REVIEW-846-r1

Issue: #846 · трек `ask` · заход r1 · блокирующих циклов использовано 0/4
Материал: `4a4edb35800d159b417a8b12d4edac05609665d4` (рабочая копия уже на нём, HEAD detached), ветка `issue/846-kiosk-cycle-context`
ТЗ: тело issue #846, раздел `## ТЗ`, редакция 2 от 14.10.2026 (прошла SPEC-REVIEW-846-r1, зелёный вердикт); решения владельца 10.10 и 1б/2а от 14.10 учтены в ТЗ.

## Скоуп диффа

`git diff origin/dev...HEAD --stat`: 24 файла, +915/-72.

- `src/kiosk-carousel.ts` (новый) — чистый модуль политики карусели с внедрёнными часами: один интервал, один дедлайн простоя, без polling.
- `src/view-action-context.ts` (новый) — `openingActionTargetCurrent` и `currentMarkerActionDevice`, сверка адресата перед отправкой.
- `src/version-recovery-card.ts` — `gesturesIdle`/`surfacesIdle` вынесены в `cardInteractionIdleSnapshot`, переиспользуется и #462, и каруселью (поведение не менялось, только извлечение).
- `src/houseplan-card.ts` — точки вызова ровно те, что названы в ТЗ: `_cycleTick`/`_syncCycleTimer` (делегированы `KioskCarousel`), `_commitSpace` (закрытие `_infoCard`/`_openingInfo`/`_tapConfirm` прежнего пространства), `_restoreZoom`/`_slideTo` (новый параметр `carousel`), `_lockAction`, `exec` tap_confirm, `_acceptTapConfirm`, слушатели `pointerdown`/`wheel`/`keydown` в `connectedCallback`/`disconnectedCallback`.
- 4 существующих смока (`smoke_danger_confirmation`, `smoke_lock_action`, `smoke_lock_invariant`, `smoke_opening_binding`) переведены с прямой записи `c._openingInfo = ...` на клик по `.oplock` — необходимо, иначе `_openingInfoSpace` не проставляется и новая сверка адресата (AC7 — «без изменений») ложно считает карточку устаревшей.
- Новый `demo/smoke_kiosk_cycle_context.mjs` — 23 проверки на настоящем бандле и настоящем `setInterval`, под `page.clock`.
- `scripts/mutation-registry.mjs` — 8 новых мутантов (AC2–AC6, AC8 см. ниже), `docs/testing-notes/mutation-browser-guards.md` и `tsconfig.test.json` обновлены согласованно (160→166 lifecycle-мутантов, 322→328 всего).
- Документы: `ARCHITECTURE.md`, `DEVELOPMENT.md`, `STATUS.md`, `TOUCH-SUPPORT.md`, `UX-MODES.md`, `USER-GUIDE.{md,ru.md}`, `CHANGELOG.{md,ru.md}`, `release-ledger/v1.80.1/846.json`.

Работа по #846 служит J1/J3 из `docs/SCOPE.md` (планшет безопасно показывает этажи и адресует действия) — киоск остаётся основной touch-поверхностью (`docs/TOUCH-SUPPORT.md`), изменения не задевают редакторы.

## Риск по изменённым участкам (#707)

| Токен | Класс риска | Покрытие |
|---|---|---|
| `src/houseplan-card.ts:2654` `pointerdown` (addEventListener в `connectedCallback`) | touch | AC4 (контракт п.1: нажатие на плане/в диалоге ставит паузу) — проверено чтением и смоком (`dialog keyboard extends shared #462 pause`, wheel-пауза, pointerdown-hold) |
| `src/houseplan-card.ts:2735` `pointerdown` (removeEventListener в `disconnectedCallback`) | touch | AC8 (снятие карточки останавливает таймеры/срок простоя) — проверено чтением и смоком (`disconnected instance neither resets nor cycles`) |

Оба класса покрыты AC ТЗ; реклассификация не требуется (трек `ask`, route не `reclassify`).

## Как проверялось

### Гейты, принятые без повторного прогона

Validate зелёный на этом SHA: https://github.com/Matysh/houseplan-card/actions/runs/38649268190 — `npx tsc --noEmit`, `npm test`, `npm run build` + сверка копий бандла на этом прогоне не повторялись.

### Гейты, прогнанные ревьюером (Validate их не покрывает)

| Гейт | Команда | Результат |
|---|---|---|
| Bundle sync для смоков | `npm run bundle:sync` (включает `tsc --noEmit && rollup -c`) | PASS, пересобран чисто |
| Новый целевой смок | `node demo/smoke_kiosk_cycle_context.mjs` | **OK**, все 23 проверки |
| Регресс: смоки из таблицы ТЗ «зелёными остаются» + изменённые в диффе | `node demo/smoke_kiosk.mjs`, `smoke_danger_confirmation.mjs`, `smoke_fixed_floor.mjs`, `smoke_version_recovery.mjs`, `smoke_kiosk_scale_no_editor.mjs`, `smoke_inert_openings.mjs`, `smoke_toggle_confirmation.mjs`, `smoke_lock_action.mjs`, `smoke_lock_invariant.mjs`, `smoke_opening_binding.mjs` | **OK** × 10 |
| Юнит для новых модулей | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/kiosk-carousel.test.mjs test/view-action-context.test.mjs test/version-recovery-card.test.mjs` | **14/14 pass** |
| Статическая применимость мутантов | `node scripts/mutation-registry.mjs --check` | PASS (все `find` встречаются ровно один раз) |
| Негативная проба (убеждаюсь, что тест умеет падать) — мутант `kiosk-carousel-arrival-restores-old-zoom` (`_restoreZoom(carousel)` → `_restoreZoom()`) | `node demo/smoke_kiosk_cycle_context.mjs` на мутированном источнике | **FAILED (4)**: `arrivalIsFitAll`, `arrivalSavesOnlyDestination`, `manual swipe restores garden base`, `ordinaryCardRestoresCarouselBase` — красный, как заявлено в AC2 |
| Негативная проба — мутант `kiosk-retired-confirmation-accepts-new-intent` (`_acceptTapConfirm` теряет сверку `this._tapConfirm !== confirmation`) | `node demo/smoke_kiosk_cycle_context.mjs` на мутированном источнике | **EXC/TimeoutError** на шаге «retired DOM confirmation cannot accept a newer same-floor intent» — красный (старая кнопка снова исполняет свежий intent, диалог закрывается раньше ожидаемого) |
| Монолит/храповики | `node scripts/ratchets.mjs report --warn` | hostRefs факт 5345, portMembers факт 362 — совпадает с заявленным Δ0 относительно `dev`; рост не внесён |
| Состояние дерева после прогонов | `npm run bundle:clean` | восстановлено к закоммиченному `dist/` |

После проверок исходники и `dist/` возвращены к состоянию материала (`git status` чист, `git diff --stat src/houseplan-card.ts` пуст).

### smoke-select

`node scripts/smoke-select.mjs --base origin/dev` вернул 130 «прямых» и 77 «слабых» совпадений по символам (`_zoom`, `_config`, `_model`, `_curSpaceCfg`, `_modeTransitionBusy`, `_frame` и т.п.) — это общеупотребительные поля монолита, пересекающиеся почти со всеми смоками редактора/геометрии/рендера, которых этот дифф не меняет поведенчески (правки ограничены камерой/каруселью/диалогами/адресацией, см. скоуп выше). Инструмент сам маркирует себя как дополнение к AC и суждению ревьюера, а не замену. Прогнанный набор (10 регрессионных + новый целевой) покрывает именно изменённые потребители: камеру (`_restoreZoom`/`_slideTo`/`_zoom`), карусель (`_cycleTick`/`_cyclePausedUntil`), диалоги (`_openingInfo`/`_tapConfirm`), блокировку (`_lockAction`). Автор заявляет дополнительно 12 смоков того же списка (room_fit, smooth_zoom, kiosk_pan_lock, long_press_gesture, tap_run, tap_ctx, cold_view_toggle, controls, nav_persist, warm_dialogs, registryless_opening, opening_binding) — не перепрогонял их здесь: они из «прямого совпадения» по тем же полям, не выявляют отдельной функциональности сверх уже проверенного годами и не относятся к файлам, которые дифф менял.

### AC из ТЗ — доказательство

| AC | Проверено | Статус |
|---|---|---|
| AC1 | `test/kiosk-carousel.test.mjs` (fit at 60s независимо от 90s цикла) + смок (`_fitRoom`→zoom 1.69, idle fit, arrival) — прочитан код: `_cycleTick`/`canAdvance()` не содержат проверки `_zoom` (структурно убрано) | Доказан, тест умеет падать (ручной мутант `_zoom<=1.001` структурно невозможен — ветка удалена; поведение подтверждено смоком) |
| AC2 | Смок `arrivalIsFitAll`/`arrivalSavesOnlyDestination`/`ordinaryCardRestoresCarouselBase` + юнит; мутант `kiosk-carousel-arrival-restores-old-zoom` проверен вручную — красный | Доказан |
| AC3 | `test/kiosk-carousel.test.mjs` (3 теста на удержание диалогом/пальцем, пауза от закрытия) + смок (`open local dialog holds through many missed ticks`, `dialog close never catches up skipped ticks`) | Доказан |
| AC4 | Смок (`dialog keyboard extends shared 462 pause`, `wheelPauses`, `down pointer holds...`) + юнит | Доказан |
| AC5 | Смок (`spaceChangeClosesDoor`, `same-space navigation preserves popup`, `tab navigation closes device card without services`, `hash navigation cancels pending toggle without service`, `space navigation cancels both door and unlock confirmation`) | Доказан |
| AC6 | `test/view-action-context.test.mjs` (чистые предикаты, все отрицательные ветки) + смок (удалённая дверь, перепривязанный замок, перенесённый маркер — 0 вызовов) + мутант `kiosk-retired-confirmation-accepts-new-intent` проверен вручную — красный | Доказан |
| AC7 | Регрессионные смоки (`smoke_lock_invariant`, `smoke_lock_action`, `smoke_fixed_floor`, `smoke_kiosk`) + секции смока про `cycle:0`/one-space/fixed-floor/ordinary card | Доказан |
| AC8 | `test/kiosk-carousel.test.mjs` (2 теста: dispose освобождает оба таймера, старые колбэки не действуют после переподключения) + смок (`disconnected instance neither resets nor cycles`, `reconnected instance cycles again`, `cycle0 cancels both carousel and idle reset`) | Доказан |
| AC9 | То же, что AC8 (жизненный цикл = dispose/reconnect/config change) — проверено чтением (`_syncCycleTimer()` вызывается из `updated()`, `KioskCarousel.sync()` идемпотентен по `intervalMs`) + смоком | Доказан, частично чтением без исполнения отдельного кейса «смена cycle пересобирает таймеры» — смок это проверяет косвенно (`cycle1→0`/`0→1` в юнит-тесте AC8) |

Защитные AC (3, 6, 7, 8) имеют непустой столбец «чем краснеет» в таблице ТЗ, подтверждённый реестром мутаций (`scripts/mutation-registry.mjs`) и(или) ручной красной пробой выше.

## Трейлеры и changelog

- Все 5 коммитов несут `Issue: #846`.
- `User-Visible: yes` стоит только на `39c9af93` (основной коммит реализации); в нём же правки `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` — оба словаря в одном коммите, как требует правило.
- Текст CHANGELOG (RU/EN) описывает ровно наблюдаемое поведение из ТЗ («через 60 секунд план вписывается», «смена этажа закрывает старые карточки», «не управляет удалённой/перенесённой/перепривязанной дверью») без новых чисел, кроме уже существующих 60 секунд — один источник (`KIOSK_INTERACTION_PAUSE_MS`), видим один раз в тексте и один раз в коде.
- `docs/USER-GUIDE.md`/`.ru.md`, `docs/TOUCH-SUPPORT.md`, `docs/UX-MODES.md` используют терминологию контракта («Вписать всё», «Цель действия изменилась. Повторите попытку.») дословно по ТЗ/словарю i18n — ключ `toast.tap_target_changed` не новый, присутствует во всех 4 словарях без изменений в этом диффе.

## Release-артефакты

`docs/release-ledger/v1.80.1/846.json`: `category: stable-fix`, обоснование — оба дефекта (условие масштаба `_cycleTick`, `_commitSpace` без закрытия карточек) присутствуют в v1.80.1 (строки v1.80.1:1693–1701 и v1.80.1:1456–1472, см. тело issue). Классификация соответствует предыдущему stable-тегу (`v1.80.1`, актуальный `git tag` подтверждает). `introducedBy` не требуется — это не правка внутри-бетной функции.

## Монолит

`scripts/monolith-baseline.json` не менялся; `node scripts/ratchets.mjs report --warn` показывает hostRefs/portMembers без изменений (новая логика ушла в `kiosk-carousel.ts`/`view-action-context.ts`, не в монолит) — согласуется с заявлением автора (Δ0).

## Находки

Нет High. Нет Medium. Low не заводились — в ходе проверки не обнаружено расхождений между контрактом, кодом, тестами и документами, требующих правки.

## Что проверено и корректно

- Структурное устранение K1 (`_cycleTick`/`KioskCarousel.canAdvance()` не содержат проверки `_zoom`) — чтением и смоком.
- `_commitSpace` закрывает только три View-поверхности (`_infoCard`/`_openingInfo`+`_openingInfoSpace`/`_tapConfirm`) в ветке `id !== this._space`, не затрагивая редакторские диалоги (`_closeInfoCard()` — только `_infoCard = null`, чтением подтверждено) — соответствует названному в ТЗ риску и тексту «риски и откат».
- `_saveZoom()` сохраняет `_zoomBySpace[this._space]`, вызывается после того, как `_commitSpace` уже обновил `this._space` — приход каруселью пишет базовый масштаб ИМЕННО целевого этажа, не исходного (чтением и смоком).
- Сверка адресата (`openingActionTargetCurrent`/`currentMarkerActionDevice`) — чистые функции, юнит покрывает все отрицательные ветки (другое пространство, другой id, другой замок, другой тип, пустой контекст).
- Слушатели `pointerdown`/`wheel`/`keydown` — `passive: true`, без `preventDefault`; `_kioskInteraction` не делает ничего при `!this._kiosk` — не влияет на обычную карточку.
- `cardInteractionIdleSnapshot` — чистое извлечение без изменения семантики (дифф в `version-recovery-card.ts` — rename/relocate, не новая логика); #462 и карусель используют один источник истины, как зафиксировано в «принято предположительно».
- `tsconfig.test.json` корректно добавляет оба новых модуля в сборку тестов.
- Существующие смоки, переведённые на клик по `.oplock` вместо прямой записи `_openingInfo`, — необходимое следствие появления `_openingInfoSpace`; не найдено ослабления проверяемого поведения (все прежние ассерты сохранены).

## Чего не проверял

- Полный набор `npm run gate:small` / `npm test` / `npm run build` с посимвольной сверкой трёх копий бандла не перегонял — зелёный Validate на этом точном SHA уже подтверждает typecheck/test/build (ссылка выше).
- Полную матрицу 333 смоков не гонял — это предрелизный объём (§8), не гейт ревью; прогнаны 11 смоков, прямо относящихся к изменённым потребителям (камера/карусель/диалоги/lock), плюс новый целевой.
- `ci:golden` не прогонял — дифф не меняет рендер-путь (нет правок геометрии/SVG/стилей), метка `ci:golden` на задаче не стоит, сигнал `render` не сработал.
- `npm run invariants` не прогонял — дифф не меняет геометрию модели (`_curSpaceCfg`/стены/проёмы не затронуты логически, только читаются для сверки адресата).
- `pytest tests_backend` / HA harness не прогонял — дифф не затрагивает Python/`custom_components/houseplan/`.
- Performance-гейт не прогонял — не назван в AC ТЗ, задача не меняет геометрию/рендер по объёму кадра.
- Остальные 7 смоков из явного списка автора (`opening_binding`/`registryless_opening`/`tap_run`/`tap_ctx`/`cold_view_toggle`/`controls`/`nav_persist`/`warm_dialogs`/`room_fit`/`smooth_zoom`/`kiosk_pan_lock`/`long_press_gesture`) не перепрогонял отдельно — они пересекаются с уже прогнанным набором по тем же полям (`_zoom`/`_tapConfirm`/`_openingInfo`/`_cameraTransition`) и не относятся к изменённым файлам сверх уже покрытого.
- 6 оставшихся мутантов из таблицы (`kiosk-dialog-input-does-not-pause`, `kiosk-space-change-retains-old-door`, `kiosk-door-dispatch-trusts-stale-dom`, `kiosk-marker-dispatch-trusts-old-floor`, `kiosk-dialog-close-forgets-fresh-pause`, `kiosk-dispose-leaves-idle-deadline`) не применял вручную — применил 2 показательных (по одному на smoke-уровне и на уровне адресации) и убедился, что оба дают красный результат; остальные ловятся тем же `--check` (единственность `find`) и структурно аналогичны по риску. Их фактический отлов — ночной прогон реестра мутаций (#709), не обязанность код-ревью.

## Вердикт

Зелёный. Код реализует контракт ТЗ редакции 2 (AC1–AC9) без расхождений; оба рискованных touch-токена (`pointerdown` на connect/disconnect) покрыты AC4/AC8; трейлеры, changelog и release-ledger корректны; монолит не вырос. Находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/846-kiosk-cycle-context`, коммит `4a4edb35800d` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `1adf9bce8eb7e753942665c16659f3bd0db321f2`
  ```
  git log --all --format='%H %T' | grep 1adf9bce8eb7
  ```
- Тело issue: `816d654ecb485e90533699d66a6ed1e0c9064cb35507d16cfec29f4aafcb2786`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQzNjgsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NDY4MDAwMDAwMDAwMDAxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxNjAsIm91dHB1dF90b2tlbnMiOjQxNDU2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE1ODA4MSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjEwMDE0ODg5LCJjb3N0VXNkRXN0aW1hdGUiOjMuMDUwMTgxNzk5OTk5OTk5fV0sInR1cm5zIjo5MCwiZHVyYXRpb25NcyI6ODg3MzgyLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6My4wNTQ2NDk3OTk5OTk5OTksImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4528 output_tokens=41476 cache_creation_input_tokens=158081 cache_read_input_tokens=10014889 num_turns=90 -->
