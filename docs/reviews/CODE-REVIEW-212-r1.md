# CODE-REVIEW-212-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/212
- **Спецификация:** `docs/specs/212-device-icons-polish.md` (зелёный SPEC-REVIEW-212-r1)
- **Диапазон:** `origin/dev...HEAD` = `ec6f77b` (specify) · `5cae1fd` (spec review doc)
  · `120d413` (`fix: polish device icons and pointer feedback`, `Issue: #212`,
  `User-Visible: yes`)
- **Ветка:** `issue/212-device-icons-polish`
- **Роль:** ревьюер кода, свежая сессия, без контекста написания ТЗ/кода.

## Скоуп проверки

Единая задача #212, консолидирующая #22/#154/#181: 10% визуальное уменьшение
marker geometry, форма `display: value`, accepted-action feedback (200 ms),
instance-local pointer modality и снятие sticky touch-hover, гейтинг всех
`:hover` в общем View/shared CSS, обновление `docs/UX-MODES.md`,
`docs/TOUCH-SUPPORT.md`, `docs/USER-GUIDE.ru.md`, `docs/TESTING.md`, оба
changelog. AC1–AC16 из спецификации.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit` | зелёный |
| Юнит | `npm test` | 952/952 зелёных |
| Сборка | `npm run build` | зелёная; `md5sum dist/… custom_components/…/frontend/… demo/srv/assets/…` — три копии идентичны |
| Документация | `node scripts/check-docs.mjs --external` | «Documentation checks passed (7 files, 10 external links)» |
| Mutation-proof (§19.1: 4 критичных guard'а) | `node scripts/mutation-gate.mjs --id=device-visual-factor-removed` и ещё 3 (`device-text-capsule-radius-restored`, `device-press-duration-drifted`, `device-touch-hover-gate-removed`) | все 4: «тест покраснел, как обязан» — тесты доказанно умеют падать |
| Таргетированные browser smoke (названные в §19.1) | `node demo/smoke_device_icon_design.mjs` | зелёный, включая новые ключи `acceptedActionFeedback`, `reducedMotionUsesNoScale`, `keyboardActionFeedback`, `textCoreIsStadium` |
| | `node demo/smoke_device_preview_parity.mjs` | зелёный |
| | `node demo/smoke_static_icon.mjs` | зелёный |
| | `node demo/smoke_state_value.mjs` | зелёный |
| | `node demo/smoke_icon_scale.mjs` | зелёный |
| | `node demo/smoke_touch_tips.mjs` (переписан под real-touch context) | зелёный |
| | `node demo/smoke_feedback_v2.mjs` | зелёный |
| | `node demo/smoke_help_affordance.mjs` | зелёный (включая `mouseHover` внутри вложенного `hp-dialog`) |
| | `node demo/smoke_long_press_gesture.mjs` | зелёный |
| Regression-смоки затронутой поверхности (не названы в §19.1, но задеты диффом hover/pointer) | `smoke_lock_action`, `smoke_lock_invariant`, `smoke_toggle_confirmation`, `smoke_vacuum`, `smoke_opening_binding`, `smoke_editor_gestures`, `smoke_isometric_live_touch`, `smoke_kiosk_pan_lock`, `smoke_pan_any_zoom` | все зелёные — lock-инвариант и gesture-safety не задеты |
| Regression-смоки затронутой поверхности (найдены сломанными) | `smoke_glow.mjs`, `smoke_room_settings.mjs`, `smoke_ux_fixes.mjs` | **красные** — см. находки M1/M2 ниже |
| Golden | `npm run golden:verify` (диагностически, Windows/Linux CI локально недоступен) | ожидаемо много `different` (10% resize, value-radius, hover-гейт) — согласно §19.2 принятие эталонов не входит в код-ревью и остаётся пре-релизным шагом |

Геометрический вывод AC1/AC3 проверен **чтением, не исполнением**, с ручным
выводом формул (см. ниже) — сверх того, что покрывают unit/smoke.

## AC-трассировка

- **AC1 (10% geometry).** Формула: `--dev-size: calc(icon-size × dev-scale ×
  var(--device-visual-factor, 0.9))`; `--puck-size` использует тот же
  множитель. Unit (`device-marker-polish-contract.test.mjs`) + browser smoke
  (`geometryMatchesAt32_56_96`, `referenceStateMatrixMatches`) зелёные;
  mutation-proof `device-visual-factor-removed` красит guard. **Доказано.**
- **AC2 (anchor/hit area).** `.dev::before` держит `width/height:
  max(44px, --device-shell-size)`; painted face уменьшается, hit target и
  `left/top` anchor — нет. `hitAreaAtLeast44` в smoke зелёный. **Доказано
  чтением + smoke.**
- **AC3 (value capsule).** Проверено чтением и ручным геометрическим выводом:
  core height фиксирована (`--dev-size`), core `border-radius = --dev-size/2`;
  shell height фиксирована (`--device-shell-size`), `border-radius =
  --device-shell-size/2`. Поскольку `--device-shell-size = --dev-size ×
  1.26875` и `--device-shell-pad`/`border` устроены так, что `--dev-size + 2×
  (pad+border) = --device-shell-size` (уже верно в базовом пакете #179), прямой
  подстановкой получается: `straight_length_inner = straight_length_outer =
  core-content-width − 0.68×dev-size`, т.е. эрозия равномерна — прямые стороны
  и полукруглые торцы получают **одинаковый** inset, не приближённо, а точно по
  формуле. `textCoreIsStadium` (browser smoke) и mutation-proof
  `device-text-capsule-radius-restored` подтверждают на практике. **Доказано.**
- **AC4/AC5 (feedback, gate действия).** `_startDevicePressFeedback` вызывается
  ровно в трёх точках, все — непосредственно перед реальным `callWS`/
  `callService`: virtual-light toggle, обычный toggle (включая cover/valve —
  `projectedTapAction` проецирует legacy `'cover'` в `'toggle'`, тот же путь),
  `run` (script/scene/automation) внутри `guarded()` **после** согласия
  confirmation. `info`/`more-info`/gate `_deviceBindingActive` перед `run` не
  получают feedback. `_keyDevice` идёт через тот же `_clickDevice`. Смоки
  `acceptedActionFeedback`, `informationalActionHasNoFeedback`,
  `keyboardActionFeedback`, `touchDispatchGetsFeedback` зелёные;
  mutation-proof `device-press-duration-drifted` красит guard. **Доказано.**
- **AC6 (composition/lifecycle).** `renderDeviceFace` кладёт `activity-ring`/
  `activity-dot`/`newdot`/`habadge`/`.lqi` **соседями** `.device-shell`, а не
  внутри него — анимация `scale` на `.device-shell` не касается их. Web
  Animations `scale`-keyframe анимирует только раскрашенное тело относительно
  собственного центра (стандартный `transform-origin` элемента). `updated()`
  зовёт `_pruneDevicePressFeedback()` — снимает анимацию исчезнувшего маркера;
  `_cancelDevicePressFeedback()` вызывается на смену режима/пространства/
  `visibilitychange`/reduced-motion change. `feedbackLifecycleBounded` в smoke
  зелёный. **Доказано чтением + smoke.**
- **AC7 (reduced motion/focus).** `_reducedMotion` переключает набор keyframes
  на `outline`-акцент вместо `scale`; `reducedMotionUsesNoScale` зелёный.
  Focus/`:focus-visible` не гейтится pointer-атрибутом (см. AC10). **Доказано.**
- **AC8 (modality authority).** `PointerModalityController`/
  `nextPointerModality` — чистые функции, покрыты unit-матрицей
  (`pointer-modality.test.mjs`), включая изоляцию двух экземпляров и отказ
  compatibility-mouse (`sourceCapabilities.firesTouchEvents`) возвращать hover.
  Browser smoke `touchOnlyHardwareRejectsMouseHover`,
  `compatibilityMouseIgnored`, `realMouseRestoresHover` зелёные. **Доказано.**
- **AC9 (JS hover cleanup).** `_clearTransientHover` вызывается на terminal
  `pointerup`/`pointercancel`/`lostpointercapture`, начало multi-touch,
  `_commitSpace`, `_setMode`, `visibilitychange` hidden,
  `disconnectedCallback`. Smoke `touchClearsTransientHover`/
  `touchClearsAllTransientHover` зелёные. **Доказано.**
- **AC10 (CSS/nested hover inventory).** Все `:hover` в `styles.ts`,
  `hp-dialog.ts`, `hp-help.ts`, `hp-color-opacity.ts`, `space-card.ts` гейтированы
  `:host([data-pointer-hover])`; unit-тест сканирует эти 5 файлов и требует
  пустой список голых селекторов. **Но** `hp-device-preview.ts` получил такой
  же гейтированный селектор (`:host([data-pointer-hover]) .previewstage
  .dev:hover`), не входит в список файлов юнит-теста и не входит в список
  элементов, которым родительская карточка проставляет атрибут — см. **M2**.
  Кроме этого файла, AC10 доказан.
- **AC11 (desktop/hybrid parity).** `smoke_help_affordance.mjs`
  (`mouseHover`/`mouseLeave`) и `smoke_feedback_v2.mjs`
  (`realMouseRestoresHover`) зелёные на реальных `PointerEvent`. **Но** три
  ранее существовавших регрессионных смока той же поверхности (room/device
  tooltip и hover) остались на старом `MouseEvent`-API и красные — см. **M1**.
- **AC12 (gesture/action safety).** `smoke_editor_gestures`,
  `smoke_isometric_live_touch`, `smoke_kiosk_pan_lock`, `smoke_pan_any_zoom`,
  `smoke_lock_action`, `smoke_lock_invariant`, `smoke_toggle_confirmation`,
  `smoke_vacuum`, `smoke_opening_binding` — все зелёные, регрессии не
  обнаружено. **Доказано.**
- **AC13 (surface parity).** Один `renderDeviceFace` на full/preview/static;
  `smoke_device_preview_parity`, `smoke_static_icon` зелёные. **Доказано.**
- **AC14 (no data/i18n change).** `git diff` не содержит правок в `src/i18n/**`
  ни в `custom_components/**/*.py`. **Доказано чтением.**
- **AC15 (documentation address).** `docs/UX-MODES.md` получил раздел
  hover/pressed ownership; `docs/CANVAS.md` не тронут (`git diff` пуст);
  `check-docs.mjs --external` зелёный. **Доказано.**
- **AC16 (performance).** Один `MediaQueryList`-listener и один
  `MutationObserver` на карточку (не на маркер); `_pruneDevicePressFeedback`
  сканирует `.dev[data-id]` только пока жив хотя бы один press-анимейшн (узкое
  окно ~200 мс на одно нажатие), не на каждый кадр. Полный
  `performance_smoke` — пре-релизный гейт, не прогонялся по правилу
  соразмерности. **Проверено чтением, не исполнением**, кроме этого — за
  пределами код-ревью.

## Находки

### M1 — три существующих regression-смока сломаны миграцией mouse→pointer событий (Medium, в скоупе)

`src/houseplan-card.ts` заменил обработчики комнаты/маркера с
`@mouseenter/@mousemove/@mouseleave` на `@pointerenter/@pointermove/
@pointerleave`, а статический `HouseplanCard._touchSeen` удалён целиком — это
входит в скоуп (§12, AC8/AC9/AC11). Автор обновил под новое API
`smoke_touch_tips.mjs`, `smoke_feedback_v2.mjs`, `smoke_help_affordance.mjs`,
`smoke_device_icon_design.mjs`, но пропустил три других существующих смока той
же поверхности:

- `demo/smoke_glow.mjs` — трогает `_hoverRoom` через
  `new MouseEvent('mouseenter')`. **Воспроизведение:** `node
  demo/smoke_glow.mjs` → `FAILED (3): hoverUsesPlainSvg, hoverUsesNeutralDarkening,
  hoverLayerOrder`. На `origin/dev` (проверено в чистом worktree) тот же смок
  зелёный целиком.
- `demo/smoke_room_settings.mjs` — `node demo/smoke_room_settings.mjs` →
  `FAILED (1): tooltipShowsHumiditySource`.
- `demo/smoke_ux_fixes.mjs` — использует и `MouseEvent('mousemove', …)` для
  tooltip, и несуществующий более `c.constructor._touchSeen = true` для
  проверки touch-подавления. `node demo/smoke_ux_fixes.mjs` → `FAILED (8):
  tipTemp, tipHum, tipHasTempLine, tipHasHumLine, tipMetricOrder,
  tipPositionUnchanged, tipHasArea, tipHasAreaLine`.

**Это не регрессия поведения для реального пользователя** — я подтвердил
диагностически: подменив в `smoke_ux_fixes.mjs` вызовы на настоящие
`PointerEvent('pointermove', {pointerType:'mouse', …})` (без изменения
продуктового кода), все 7 из 8 упавших проверок содержимого/позиции тултипа
(`tipTemp`, `tipHum`, `tipHasTempLine`, `tipHasHumLine`, `tipMetricOrder`,
`tipPositionUnchanged`, `tipHasArea`, `tipHasAreaLine`) зазеленели — реальная
мышь по-прежнему корректно показывает тултип с температурой/влажностью/
площадью в прежнем порядке и позиции. Единственная оставшаяся red
(`noHoverSuppressesTooltip`) — прямое следствие удалённого `_touchSeen`,
который тест больше не может имитировать без настоящего touch-события
(смотри как это сделано в переписанном `smoke_touch_tips.mjs`).

**Почему это всё равно находка, а не «просто устаревший тест».** CI-джоб
`smoke` в `.github/workflows/validate.yml` прогоняет **весь** набор
`demo/smoke_*.mjs` на каждый push (только байт-в-байт идентичный вход снимает
прогон через `reuse`-кэш — здесь `src/**` меняется, значит прогон
неизбежен). Эти три файла красные прямо сейчас на этом SHA — обязательный
пре-релизный гейт CI будет красным. Кроме того, `smoke_ux_fixes.mjs`
`noHoverSuppressesTooltip` после фикса перестаёт что-либо проверять (тест
не падает по правильной причине, а молча не взаимодействует с картой) — это
ровно тот «тест, который не умеет падать по факту», который правило ревью
требует ловить.

**Требуется:** в `smoke_glow.mjs`, `smoke_room_settings.mjs`,
`smoke_ux_fixes.mjs` заменить `MouseEvent('mouse{enter,move,leave}')` на
`PointerEvent('pointer{enter,move,leave}', {pointerType:'mouse', …})` (по
образцу уже переписанных смоков этого же коммита) и переписать touch-latch
проверку в `smoke_ux_fixes.mjs` через настоящий `PointerEvent('pointerdown',
{pointerType:'touch'})` вместо `c.constructor._touchSeen`.

### M2 — `hp-device-preview.ts` гейтирует hover, но никто не выставляет ему атрибут (Medium, в скоупе)

`src/hp-device-preview.ts:357` меняет `.previewstage .dev:hover { z-index: 2;
}` на `:host([data-pointer-hover]) .previewstage .dev:hover { z-index: 2; }`
— тот же паттерн, что и в `hp-dialog.ts`/`hp-help.ts`/`hp-color-opacity.ts`.
Но:

- `houseplan-card.ts._syncPointerHoverTargets()` и `._syncPointerHoverSubtree()`
  выставляют `data-pointer-hover` только на `'hp-dialog, hp-help,
  hp-color-opacity'` — `hp-device-preview` в списке нет;
- у `HpDevicePreview` нет собственного `PointerModalityController` (в отличие
  от `HouseplanSpaceCard`, который держит свой);
- unit-тест `device-marker-polish-contract.test.mjs` («removes the global
  touch latch and gates every shared hover selector») сканирует только
  `['styles.ts', 'hp-dialog.ts', 'hp-help.ts', 'hp-color-opacity.ts',
  'space-card.ts']` — `hp-device-preview.ts` не входит, поэтому «голый» (в
  реальности осиротевший) селектор не поймался.

**Воспроизведение:** `<hp-device-preview>` рендерится напрямую в шаблоне
`houseplan-card.ts:19684` (Device editor → preview). В демо-харнессе:
открыл `_setMode('devices')` → `_openMarkerDialog(...)`, нашёл вложенный
`hp-device-preview`, продиспатчил на нём настоящие `PointerEvent('pointerover'
/'pointermove', {pointerType:'mouse'})`. Результат: у карты
`data-pointer-hover` появляется (`true`), у `hp-device-preview` — нет
(`false`) ни при каких условиях, поскольку ничего не вызывает
`toggleAttribute` на этом элементе. Эффект: `.previewstage .dev:hover
{ z-index: 2 }` в Device preview теперь **не включается никогда** (до #212
работал через голый `:hover`) — маленькая, но настоящая регрессия видимого
поведения на явно указанной в скоупе поверхности (§5: «Device preview»;
§16 явно называет этот файл среди тех, что нужно трогать «если parity
требует явной передачи»).

**Требуется:** либо добавить `hp-device-preview` в список целей
`_syncPointerHoverTargets`/`_syncPointerHoverSubtree` (симметрично
`hp-dialog`/`hp-help`/`hp-color-opacity`), либо завести собственный
`PointerModalityController` внутри `HpDevicePreview` по образцу
`HouseplanSpaceCard`; вместе с этим расширить список файлов в
naked-hover-selector unit-тесте, чтобы такой пробел не проходил снова.

## Проверено и корректно

- Формула 10%-коэффициента, её применение к shell/core/glyph/puck/rings и
  сохранение anchor/hit-area — код и мат. вывод сходятся, mutation-proof
  ловит регрессию.
- Радиус `display: value` — точный геометрический вывод показывает
  равномерный inset по всему периметру, не приближение.
- Feedback-контракт (кому положен, длительность, reduced-motion, keyboard,
  lifecycle, отсутствие влияния на semantic state/LQI/badges) — сходится по
  коду и по смокам на всех проверенных путях диспатча (toggle, virtual-light,
  cover через projected toggle, run/script, keyboard Enter/Space, touch tap).
- Lock-инвариант, gesture-safety (pan/pinch/long-press/second pointer),
  toggle-confirmation — не задеты; все относящиеся смоки зелёные.
- Три копии бандла идентичны, документация (UX-MODES/TOUCH-SUPPORT/
  USER-GUIDE.ru/TESTING/оба CHANGELOG) обновлена в том же коммите с верным
  адресом (CANVAS.md не тронут), трейлеры корректны.
- i18n/backend не задеты.

## Чего не проверял

- **`npm run golden:accept`** не запускался и не должен — принятие эталонов
  вне код-ревью (PROCESS.md §8, §13). `golden:verify` прогнан диагностически
  локально (Windows), ожидаемо показывает массовые `different` от 10%-resize
  и гейта hover; финальная сверка на полном Linux CI-артефакте — задача
  пре-релиза.
- **`performance_smoke` и `npm run inventory`** не прогонялись — не относятся
  к гейту код-ревью (PROCESS.md §8), AC16 закрыт чтением кода.
- **Полный набор из 127 `demo/smoke_*.mjs`** не прогонялся целиком — прогнаны
  все смоки из §19.1 плюс 12 смоков смежных поверхностей (lock/confirmation/
  gesture/vacuum/opening), которые и вскрыли M1. Оставшиеся ~100 смоков не
  относятся к затронутым файлам (plan/backup/floors/registry и т.п.) и не
  прогонялись.
- **`python -m pytest tests_backend`** не прогонялся — диапазон не трогает
  `custom_components/**/*.py`.
- Ручная визуальная приёмка golden-скриншотов (Light/Dark 32/56/96, pressed
  midpoint, reduced-motion accent) не проводилась — не относится к код-ревью,
  явно назначена на пре-релиз (§19.2).

## Вердикт

Продуктовое поведение для реального пользователя не сломано ни разу за то,
что я смог воспроизвести (M1 — только стенд, не поведение; M2 — реальная, но
небольшая визуальная регрессия в admin-only Device preview). High: 0.
Обе находки — Medium, в скоупе задачи (пункты §12/§13 самой спецификации),
чинятся в этой же ветке без нового issue.

**Вердикт: жёлтый · цикл r1/4 · High: 0 · Medium: 2 → в задаче**
