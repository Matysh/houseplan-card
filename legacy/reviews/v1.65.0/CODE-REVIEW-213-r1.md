# CODE-REVIEW-213-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/213
- **Спецификация:** `docs/specs/213-device-marker-geometry.md` (зелёный
  SPEC-REVIEW-213-r1, High 0 · Medium 0)
- **Диапазон:** `origin/dev...HEAD` = `0c93be9` (specify) · `c749d68` (spec
  review doc) · `0e5ee03` (`fix: polish device marker geometry and input`,
  `Issue: #213`, `User-Visible: yes`)
- **Ветка:** `issue/213-device-marker-geometry`
- **Роль:** ревьюер кода, свежая сессия, без контекста написания ТЗ/кода.

## Скоуп проверки

Одна реализационная задача, закрывающая AC1–AC13 из спецификации: удаление
позднего `--device-visual-factor: 0.9` в пользу единого effective-base на
границе поверхности; прямой `0.55×core` MDI viewport; общая concentric-геометрия
core/shell через новый `.device-shell-frame`; opening Lock/Unlock на визуальном
пакете #179; hover/action всей видимой value-капсулы; возврат непрерывной
`lqiColor()` для marker LQI. Изменённые модули: `src/styles.ts`,
`src/device-face.ts`, `src/device-presentation.ts`, `src/houseplan-card.ts`,
`src/space-render.ts`, `src/hp-device-preview.ts`, новый
`src/device-marker-geometry.ts`; targeted smokes, unit-тесты, mutation-gate
guard, docs (`ARCHITECTURE.md`, `TESTING.md`, `USER-GUIDE.md`/`.ru.md`, оба
changelog), reference screenshots.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit` | зелёный |
| Юнит | `npm test` | 955/955 зелёных, 0 skipped (расходится с хендофф-комментарием «954 passed, 1 skipped» — вероятно другое окружение автора; актуальный прогон здесь зелёный и это авторитетно) |
| Сборка | `npm run build` | зелёная; `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` и `cmp … demo/srv/assets/houseplan-card.js` — обе байт-в-байт идентичны, `git status` после пересборки чист (закоммиченный бандл свежий) |
| Документация | `node scripts/check-docs.mjs --external` | «Documentation checks passed (7 files, 10 external links)» |
| Mutation-proof (AC1, единственный названный в §18.2 guard) | `node scripts/mutation-gate.mjs --id=device-visual-factor-removed` | «тест покраснел, как обязан» — guard доказанно умеет падать |
| Таргетированные browser smoke (названы в §18.2 / затронуты диффом) | `node demo/smoke_device_icon_design.mjs` | зелёный, включая новые `valueCapsuleOwnsHoverAndActionAtEveryPosition`, `lqiUsesContinuousComputedColor` |
| | `node demo/smoke_device_icon_pixel_alignment.mjs` (новый, ядро AC3) | зелёный на всех 4 DPR; собственный mutant (`translateX(1px)`) детектируется — тест доказанно умеет падать |
| | `node demo/smoke_device_preview_parity.mjs` | зелёный, включая переписанный `resolvedBaseContract` |
| | `node demo/smoke_static_icon.mjs`, `smoke_icon_scale.mjs`, `smoke_state_value.mjs` | зелёные |
| | `node demo/smoke_opening_binding.mjs` | зелёный, включая новый `openingLockUsesPackageGeometryAndStates` (Light/Dark × locked/unlocked/unknown) |
| | `node demo/smoke_registryless_opening.mjs`, `smoke_lock_action.mjs`, `smoke_lock_invariant.mjs` | зелёные — secure no-toggle-on-plan инвариант не задет |
| | `node demo/smoke_touch_tips.mjs` | зелёный — hover/touch-контракт не задет |
| Regression-смоки, задетые переименованием `.device-shell` → `.device-shell-frame` | `node demo/smoke_hidden_flag.mjs`, `node demo/smoke_vacuum.mjs` | зелёные |
| Golden (диагностически, этот раннер — Linux) | `npm run golden:verify` | 30 из ~90 сценариев `different` — все просмотрены (`artifacts/golden/diff/*.png`): расхождение локализовано строго на маркерах устройств/lock-бейджах (обновлённая геометрия/глиф/LQI-цвет), стены/комнаты/tray/диалоги без затронутых markers не изменились. Ожидаемо по §18.3/§20 ТЗ: baseline принимается только `npm run golden:accept -- --reviewed` на полном Linux CI артефакте, это пре-релизный шаг, не гейт код-ревью |

Полный `smoke` (154 файла), `performance_smoke` и `pytest tests_backend`
сознательно не прогонялись — см. «Чего не проверял».

## AC-трассировка

- **AC1 (size contract).** `--device-visual-factor` удалён из `src/styles.ts`
  (`.dev`, `.vacpuck`); `effectiveDeviceBaseSize()` в новом
  `src/device-marker-geometry.ts` пересчитывает legacy `icon_size` в effective
  base один раз на границе (`houseplan-card.ts`, `space-render.ts`,
  `hp-device-preview.ts` — статический `48.6px`). Арифметика проверена: `(x/2.5)
  × 2.25 = x × 0.9`, т.е. численно тождественно старому позднему множителю для
  default/explicit/kiosk/per-marker/preview/vacuum. Юнит
  `device-marker-geometry.test.mjs` покрывает границы (`NaN`→default,
  пропорциональность). Mutation-proof `device-visual-factor-removed`
  красный на восстановленном позднем `* 0.9` внутри `--dev-size`. **Доказано**
  unit + mutation-proof + smoke `geometryMatchesAt32_56_96`.
- **AC2 (glyph).** `.dev ha-icon { --mdc-icon-size: calc(var(--dev-size) *
  0.55) }` — прямой base, без второго множителя/transform; core/shell/anchor
  не читают этот токен. `demo/smoke_device_icon_design.mjs`
  (`geometryMatchesAt32_56_96` проверяет `iconViewport/core ≈ 0.55` и painted
  bbox `≈0.458`) зелёный на 32/56/96, custom/rotated/state-swapped глиф не
  проверялся отдельным smoke сверх существующего reference-матрикса, но
  источник ratio один общий CSS-токен — клиппинг архитектурно маловероятен.
  **Доказано** source + smoke, custom/rotated путь — чтением.
- **AC3 (concentric geometry).** Ключевая переработка: `.device-shell` больше
  не несёт border/padding (`padding: 0`, `border: 0`), это чистый flex-контейнер
  размера `--dev-size` (без values) или content-based (с values). Новый
  `.device-shell-frame` — единственный визуальный слой, `inset: calc(var(
  --device-shell-inset) / -1)` растягивает его наружу от границ `.device-shell`
  на константу `--dev-size × 0.134375` (алгебраически равно старой
  `(--device-shell-size − --dev-size) / 2`, то есть тот же целевой внешний
  диаметр, но без независимого round у padding/border). Для `:not(.with-values)`
  `.device-shell` выставлен `left:0;top:0` — совпадает с `.dev`'s собственным
  боксом (который уже центрирован на сохранённой точке через
  `margin: calc(--dev-size/-2) 0 0 calc(--dev-size/-2)`), поэтому core и frame
  разделяют одну систему координат вместо двух независимо округляемых. Для
  `with-values.pos-*` анкер аналогично зафиксирован на `0` (не
  `50% − size/2`), расширение идёт только в выбранную сторону. Никаких
  `translate(1px)`, UA/DPR sniffing или per-size исключений. **Доказано**
  чтением (вывод формулы выше) + новый `smoke_device_icon_pixel_alignment.mjs`
  (dense quarter-px DOM-центры на 24…112px, alpha-weighted painted-centroid на
  12 дробных размерах × 4 DPR, red/green solid-diagnostic слои, calibrated
  предел `DPR/2 + 0.1` физ. пикселя, отдельный mutant `translateX(1px)`
  детектируется) + reviewed golden diff (только маркеры).
- **AC4 (anchor/parity).** `.dev` width/height/margin формула не изменилась
  (тот же `--dev-size`, просто из другого источника); `44×44` пол сохранён
  через `.dev::before { width/height: max(44px, --device-shell-size) }`
  (не тронут). `smoke_device_preview_parity`, `smoke_static_icon`,
  `smoke_icon_scale`, `hitAreaAtLeast44` в `smoke_device_icon_design` зелёные.
  **Доказано** unit facts + smoke.
- **AC5/AC6 (opening locks + security).** `.oplock` разложен на
  `.oplock-shell`/`.oplock-core` с ratio `1.26875`/`0.55`, Light/Dark токены и
  цвета locked (`#000`/`#252525`, белый глиф) / unlocked (`#F0A00C`,
  тема-зависимый глиф) / unknown (нейтральный, без ложного locked/unlocked)
  сверены с §10 ТЗ и подтверждены `openingLockUsesPackageGeometryAndStates` в
  `smoke_opening_binding.mjs` (обе темы × три состояния, точные RGB). Клик по
  `.oplock` по-прежнему только `this._openingInfo = o` (открывает карточку),
  без вызова сервиса; `smoke_lock_action`/`smoke_lock_invariant` зелёные без
  изменений в их коде — инвариант `docs/SCOPE.md` (единственная санкционированная
  actuation-поверхность — кнопка карточки) не затронут. **Доказано** smoke +
  чтением обработчика клика.
- **AC7/AC8 (capsule hover/action).** `.device-shell-frame` получил
  `pointer-events: auto` (был `none` на прежнем `.device-shell`); `.device-core`
  и `.device-sections` — `pointer-events: none`. Единственный обработчик клика
  остаётся на `.dev` (`@click=${(e) => this._clickDevice(e, d)}`) — событие
  бабблится от любого потомка независимо от того, что визуально «капсула»
  выходит за CSS-бокс `.dev` (overflow visible); `_clickDevice` не читает
  `e.target`, поэтому не может задвоить действие. `:hover` на `.dev` уже был
  gated через `data-pointer-hover` (`src/styles.ts:2180`) и распространяется от
  любого наведённого потомка — новых hover-правил не потребовалось, только
  снятие `pointer-events: none` с ранее «мёртвых» зон (gap, padding) через
  frame. `smoke_device_icon_design.mjs`
  (`valueCapsuleOwnsHoverAndActionAtEveryPosition`) кликает и наводит мышь на
  четыре позиции value-бейджа, проверяет `elementFromPoint` попадает в
  `device-shell-frame`, hover совпадает с core-hover цветом и действие
  засчитывается ровно один раз на позицию (`capsuleActions === 5`, включая клик
  по core). **Доказано** smoke + чтением (нет stopPropagation на пути,
  единственный listener).
- **AC9/AC10 (continuous marker LQI).** `markerLqiColor()` теперь однострочно
  делегирует в общий `lqiColor()` (`src/logic.ts`, формула не менялась:
  `hue = clamp((lqi-40)/140×120, 0, 120)`); `markerLqiBand()` не тронут и
  остаётся источником aria/data band. Юнит
  `device-presentation.test.mjs` сравнивает `markerLqiColor` с `lqiColor` на
  representative/boundary значениях и явно проверяет `41 !== 42` (нет ступени).
  Room fill (`logic.ts:1428`, `mode==='lqi'`) и tooltip (`houseplan-card.ts:16185`)
  и раньше читали `lqiColor()` напрямую, не через `markerLqiColor` — путь не
  затронут. **Доказано** unit + smoke (`lqiUsesContinuousComputedColor`
  сравнивает вычисленный computed-color с независимо построенным
  `hsl(...)`-пробником) + чтением вызывающих мест room-fill/tooltip.
- **AC11 (data/i18n compatibility).** Diff не касается `src/i18n/*.json`,
  card-config schema, миграций. Проверено чтением diff-статистики: изменённые
  файлы — только `.ts`/CSS-in-JS/тесты/доки; ни один i18n JSON не в списке.
  **Доказано чтением, не исполнением.**
- **AC12 (performance).** Чтением: реализация CSS-only + один чистый расчёт
  (`effectiveDeviceBaseSize`), новых `ResizeObserver`/`matchMedia`/per-frame JS
  нет; `backdrop-filter: none` явно сохранён и на `.oplock-shell`, и на
  `.device-shell-frame`; DOM-прирост на маркер — один статический `<span
  class="device-shell-frame">`, на opening-lock — два статических `<span>`, без
  анимационных слоёв сверх существующих. Performance-smoke не прогонялся —
  это осознанно пре-релизный гейт (§18.3 ТЗ, AGENTS.md §8), не названный в AC12
  способом доказательства сверх source review. **Доказано чтением, не
  исполнением**, инструментальная часть отложена по процессу.
- **AC13 (release artifacts).** Оба changelog обновлены в том же коммите
  `0e5ee03` (User-Visible: yes), `docs/USER-GUIDE.md`/`.ru.md`,
  `docs/ARCHITECTURE.md`, `docs/TESTING.md` обновлены там же;
  `check-docs.mjs --external` зелёный; reference screenshots
  (`docs/images/*.png`, `screenshots.json`) обновлены тем же коммитом.
  Терминология RU-текста («капсула», «жёлтая подложка» для `#F0A00C`) сверена с
  уже установленными терминами в этом же файле (устройство pulse-активности
  уже описывает тот же `#F0A00C` как «жёлтую подложку», `src/device-pulse.ts`
  `DEVICE_ACTIVITY_AMBER = '#F0A00C'`) — не изобретена заново. **Доказано**
  diff + `check-docs` + сверка терминологии чтением.

## Находки

Нет находок High или Medium — ни в скоупе, ни вне его.

**Low (снято, без правки).** Хендофф-комментарий автора заявляет «954 passed,
1 skipped»; фактический прогон в этой сессии на том же коммите — «955 passed,
0 skipped» (см. таблицу гейтов). Расхождение не воспроизводится и не влияет на
вердикт — авторитетен прогон, выполненный ревьюером на диапазоне ревью;
вероятная причина — иное окружение автора (не единственный canonical способ
получить число, `npm run inventory` тоже даёт 955). Правки не требует.

## Что проверено и корректно

- Единая система координат core/shell (общий `.device-shell` бокс + один
  `.device-shell-frame` с константным inset) устраняет источник независимого
  округления, названный в issue, — подтверждено и алгебраически, и
  dense-matrix/painted-centroid browser-доказательством с работающим mutant.
- Effective-size arithmetic численно тождественна старому позднему `× 0.9` во
  всех точках входа (default/explicit/kiosk/per-marker/preview/vacuum).
- Hover/action unification переиспользует существующую bubble-модель `.dev`
  без нового кода действия — риск задвоения действия исключён по построению
  (`_clickDevice` не смотрит на `e.target`), не только по smoke-доказательству.
- Lock security invariant (никогда не toggled с плана) не затронут: единственный
  обработчик клика на `.oplock` остаётся «открыть карточку», существующие
  lock-action/lock-invariant smoke не изменены и зелёные.
- Continuous marker LQI — тонкая, безопасная правка (делегирование в уже
  протестированную `lqiColor()`), room fill/tooltip путь не переиспользует
  `markerLqiColor` и не затронут.
- Vacuum-puck собственный MDI ratio (`0.68`) сознательно не тронут — сохранена
  договорённость из SPEC-REVIEW-213-r1 (Low снят на этапе ТЗ).
- Три копии бандла синхронны, docs fingerprint свежий, трейлеры и оба
  changelog на месте в одном коммите.
- 30 golden-сценариев, помеченных `different`, визуально сверены (не только
  по счётчику): расхождение точно очерчено пикселями маркеров/lock-бейджей,
  никакой утечки в стены/комнаты/tray/диалоги не обнаружено.

## Чего не проверял

- **Полный `npm run smoke` (154 файла).** Diff не касается poверхностей вне
  device-face/opening-lock/LQI (planering, backup, furniture, sun/glow
  вычислений и т.д.); прогнаны все targeted + все смоки, тронутые
  переименованием класса. Расширение до полного набора — предрелизный гейт
  (PROCESS.md §8), непропорционально объёму диффа.
- **`npm run golden:accept`.** Не входит в роль ревьюера кода (только релиз-
  менеджер/владелец после полного Linux CI артефакта); увиденные 30
  `different` — ожидаемое следствие AC1–AC5, не дефект.
- **`node scripts/mutation-gate.mjs` (полный набор).** Дорогой прогон
  (пересборка на мутанта), по процессу — предрелизный, не гейт ревью; прогнан
  только единственный мутант, названный ТЗ для этой задачи
  (`device-visual-factor-removed`), и он ловит регрессию.
- **`npm run performance_smoke` и полный HA-харнесс (`pytest tests_backend`).**
  Diff не касается `custom_components/**/*.py` — backend вне класса A/B этой
  задачи. Performance-профиль — источник для AC12 явно указан как
  «source review + pre-beta performance smoke»; source review выполнен,
  инструментальная часть — по процессу пре-релизная.
- **Custom/rotated/state-swapped MDI на не-32/56/96 размерах** сверх того, что
  покрывает существующий reference-матрикс в `smoke_device_icon_design.mjs` —
  архитектурно один общий CSS-токен, специальный smoke не заведён отдельно от
  общего пиксельного alignment-smoke; риск оценён как низкий чтением.

## Вердикт

Зелёный. AC1–AC13 доказаны либо автотестом, который умеет падать (unit,
mutation-proof, browser smoke с собственным mutant), либо прочтением с
явной пометкой там, где инструментальная проверка по процессу отложена до
пре-релизного гейта (AC11, частично AC12). Golden проверен диагностически на
этом (Linux) раннере и подтверждает, что видимые изменения ограничены ровно
заявленным скоупом.
