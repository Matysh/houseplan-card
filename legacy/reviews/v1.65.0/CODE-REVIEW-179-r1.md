# CODE-REVIEW-179-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/179
- **ТЗ:** `docs/specs/179-device-icons-redesign.md` (зелёное SPEC-REVIEW r2)
- **Диапазон:** `origin/dev..HEAD`, коммиты `517a710`…`7af6d74`, основной —
  `48bcdaf` («feat: redesign device marker faces»)
- **Ревьюер:** Claude (свежая сессия, без контекста реализации)
- **Вердикт:** зелёный · цикл r1/4 · High: 0 · Medium: 0

## Скоуп

Единый shell/core-рендерер маркера устройства (пакет дизайнера #179) на полном
плане, editor preview и static space card: geometry/theme, приоритет
состояний, Text/Double без ellipsis, категориальный marker LQI, motion
timings/цвета, keyboard/hit-area/aria, backward-совместимый config. Диапазон
ограничен ровно тем, что перечислено в хендоффе; посторонних правок не найдено
(`git diff --stat origin/dev...HEAD` — только файлы из плана ТЗ §13 плюс
docs/i18n/tests).

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | green |
| Unit | `npm test` | 930 tests, 930 pass, 0 fail, 0 skip |
| Build + bundle parity | `npm run build && cmp` (все 3 копии) | green, побайтово идентичны |
| Mutation guards (новые, не полный набор) | `node scripts/mutation-gate.mjs --id=device-unavailable-hover-restored` / `--id=device-marker-lqi-low-boundary-shifted` / `--id=device-long-value-ellipsis-restored` / `--id=device-keyboard-bypasses-click-path` | все 4: чистый прогон зелёный, мутант красный — «тест умеет падать» подтверждено для каждого |
| Целевые browser smokes (названные в ТЗ §16.2) | `node demo/smoke_device_icon_design.mjs`, `smoke_device_preview_parity.mjs`, `smoke_static_icon.mjs`, `smoke_state_value.mjs`, `smoke_disabled_device.mjs` | все green |
| Secure-action smokes (lock invariant, `docs/SCOPE.md` CR-1) | `smoke_lock_action.mjs`, `smoke_lock_invariant.mjs`, `smoke_toggle_confirmation.mjs` | все green |
| Смежный smoke, задетый styles.ts (continuous-пульсация cover) | `smoke_cover_tap.mjs` | green |
| Golden (диагностика, не acceptance) | `node demo/golden/run.mjs --mode=capture --scenario=device-icon-state-table-light` / `-dark` | `missing-baseline` (ожидаемо, как и заявил автор), рендер без runtime-ошибок, изображения сверены визуально — см. «Проверено и корректно» |
| `--check` реестра мутаций | `node scripts/mutation-gate.mjs --check` | все патчи, включая 4 новых, ложатся ровно один раз |

**Гейты НЕ прогонялись, и почему:**

- Полный `node scripts/mutation-gate.mjs` (без `--id`) и полный browser-smoke
  набор (127 файлов) — задача касается общего рендерера маркера, но не всех
  127 поверхностей; PROCESS.md §8 прямо резервирует полный прогон за
  предрелизным гейтом. Прогнаны все смоки, названные в ТЗ §16.2, плюс
  secure-action и один смежный (cover), которые diff трогает напрямую.
- `npm run golden:verify` (полный набор, 100+ сценариев) — golden-политика
  (`demo/golden/policy.mjs`) сама отказывается гонять `verify` частично;
  полный прогон — Linux CI перед бетой (canon, `AGENTS.md`). Вместо этого
  выполнена диагностика `golden/run.mjs --mode=capture` только по двум новым
  сценариям — видимый результат сверен глазами (см. ниже), это не замена
  gate, а проверка «не сломано визуально».
- `python -m pytest tests_backend -q` — Python-код (`custom_components/**`)
  не тронут (только doc-комментарий `validation.py` был прочитан для сверки
  диапазона `ripple_size`, не изменён).
- Performance-профили (`performance_smoke.mjs`) — AC13 не называет числовой
  бюджет для прогона именно на этом ревью; код прочитан на отсутствие
  per-marker `ResizeObserver`/`matchMedia`/`backdrop-filter` (ниже) вместо
  измерения. Профиль остаётся предрелизным гейтом (ТЗ §16.4).

## Находки

Нет. High: 0, Medium: 0. Ниже — два Low, оба решены на месте (не требуют
правки, оставлены с записью).

- **Low-1 (снят).** `src/styles.ts`, блок `.dev` (~строка 1875): `--device-core-bg`
  и `--device-core-fg` объявлены дважды подряд в одном правиле — сначала через
  `var(--card-background-color…)`/`var(--primary-text-color…)`, затем тем же
  свойством через `light-dark(#fff, #252525)`. Второе объявление всегда
  выигрывает (последнее правило для custom property в одном селекторе), первое
  — мёртвый код. Функционально не влияет: `.dev.theme-light`/`.dev.theme-dark`
  всё равно переопределяют обе переменные явно, когда `hass.themes.darkMode`
  известен (см. `deviceThemeClass`, `smoke_device_icon_design.mjs` —
  `lightThemeCoreIsWhite`/`darkThemeCoreIs252525` подтверждают оба пути).
  Косметика, не блокирует.
- **Low-2 (снят).** Цветовая линия `tone-humidity` (`border-color: #4fc3f7`),
  различавшая temperature/humidity legacy-сателлиты бордюром, не имеет
  преемника в новом shell — все секции (value badge, LQI-как-badge, legacy
  temp/hum) теперь визуально одинаковы (белая/тёмная пилюля без цветной рамки).
  Это не регрессия относительно ТЗ: §8.2 прямо требует единый shell без
  отдельных «спутников», а пакет дизайнера не определяет per-tone цвета —
  унификация здесь является сутью задачи, а не побочным эффектом. Отмечаю для
  протокола, правки не требую.

## Проверено и корректно (по каждому AC)

- **AC1 (shell/theme).** `src/styles.ts` — `--device-shell-size: calc(var(--dev-size) * 1.26875)`
  = `101.5/80`, `--device-shell-pad` даёт `0.788` core/shell с учётом
  1px stroke — совпадает с ТЗ §7.1. Light: `stroke #BCBCBC`,
  `box-shadow: 0 1px 2px rgb(37 40 45/12%), 0 4px 8px -1.07px rgb(37 40 45/18%)`,
  `backdrop-filter: none` явным правилом. Dark: `--device-core-bg:#252525`
  через класс `.dev.theme-dark`. Подтверждено смоком
  (`sharedShellGeometry`, `packageShadowColor`, `noBackdropBlur`,
  `lightThemeCoreIsWhite`, `darkThemeCoreIs252525` — все `true`).
  **unit + smoke.**
- **AC2 (states/priority).** CSS-каскад разложен так, что правила
  `.dev.alarm…` идут физически последними среди правил с равной специфичностью
  (`.dev.sel`, `.dev:focus-visible`, `.dev.alarm`), что при равенстве
  специфичности (по 3 класс-эквивалента на каждый селектор) даёт порядок
  Alert > Focus > Selected по исходному коду — соответствует нормативному
  приоритету §7.3. Golden-диагностика `device-icon-state-table-{light,dark}`
  визуально подтверждает: alarm-маркер (одновременно `sel`+`alarm`+focus)
  рисуется красным поверх всех остальных decorations. **unit (presentation
  matrix, не показан здесь, но покрыт `device-presentation.test.mjs`) +
  golden-диагностика.**
- **AC3 (unavailable).** `.dev:not(.unavail):hover` исключает `.unavail` из
  hover-перекраски и shell-border; клик/keyboard остаются разрешены (`_clickDevice`
  не проверяет unavailable). Мутант `device-unavailable-hover-restored`
  красный при восстановлении общего hover — **проверил лично**, гейт ловит
  регрессию. **unit + smoke, мутация подтверждена исполнением.**
- **AC4 (secure locks).** `lockState` вычисляется только для `lock.*`
  entity (не путается с generic cover/contact `open`), `lock-locked` даёт
  чёрный glyph на theme-фоне, `lock-unlocked` — amber `#F0A00C`. Keyboard путь
  (`_keyDevice` → `_clickDevice`) — тот же самый метод, что pointer click, без
  отдельной ветки для секьюрных действий. `smoke_lock_action.mjs` и
  `smoke_lock_invariant.mjs` (полный набор secure-инвариантов из
  `docs/SCOPE.md` CR-1) — оба green, обход подтверждения не найден.
  **unit + secure-action smoke, лично прогнано.**
- **AC5 (virtual/static).** `.dev.virtual .device-shell { border-style: dashed }`
  — только shell, не core (не путается с реальным unavailable). `static_icon`
  получает theme-aware core/shell, но не реагирует на live state/pulse/value
  (`resolveDevicePresentation` подставляет нейтральный `visual` для
  `staticIcon`, не тронуто в этом diff). `smoke_static_icon.mjs` green.
  **unit + smoke.**
- **AC6 (Text/Double).** `deviceTextScale()` — детерминированная функция без
  DOM-измерения (юнит подтверждает `0.45` для короткого, `0.25`-floor для
  длинного); `overflow: visible`, `text-overflow` не установлен. Shell
  расширяется по content (`width: max-content` на core/badge). Единый
  `device-sections` контейнер для badge + legacy secondary (третья секция).
  Мутант `device-long-value-ellipsis-restored` красный при восстановлении
  `ellipsis` — **проверил лично**. `textIsComplete`/`doubleUsesOneShell` в
  smoke — true. **unit + smoke + мутация, всё исполнено.**
- **AC7 (LQI).** `markerLqiBand`/`markerLqiColor` — границы `<=40`/`<180`/`>=180`
  дают ровно `low/mid/high` на `{0,40,41,179,180}` (юнит-тест по всем пяти
  граничным значениям). `logic.ts::lqiColor()` (комнатный градиент) не
  импортируется больше в `device-presentation.ts` для маркера, но
  используется по-прежнему для заливки комнаты — не тронут. Мутант
  `device-marker-lqi-low-boundary-shifted` (сдвиг `<=40` → `<40`) красный —
  **проверил лично**. **unit + мутация, исполнено.**
- **AC8 (motion).** Timings/easing сверены с ТЗ §10: continuous
  `3.6s cubic-bezier(.45,.05,.55,.95)`, short `1.1s×3, delay 0/1.1/2.2,
  cubic-bezier(.22,.61,.36,1)`, alarm `2.4s, 2 волны с задержкой 1.2s,
  тот же easing`, scale `1→1.5`. `semanticPulseColor()` даёт
  green/presence, amber/running|working|open, blue/иначе — юнит-тест
  `device-pulse.test.mjs` проверяет все три ветки плюс explicit-override
  приоритет. **unit (исполнено) + smoke (`presenceContinuousGreen` true).**
- **AC9 (reduced motion).** `reducedMotionIndicator: 'dot'` заменяет кольца;
  `.activity-dot` берёт цвет из того же `--ripple-color`, что и кольца
  (раньше был явный `null` под reduced motion — терялся цвет точки, теперь
  исправлено). Одна host-level `matchMedia` подписка (`_motionMedia`,
  `houseplan-card.ts`), в device-слое новых подписок не добавлено (grep
  подтверждает). **unit + проверено чтением (нет второй подписки).**
- **AC10 (keyboard/a11y).** `role="button"`/`tabindex="0"` только когда
  `mode === 'view' || 'devices'`; `planNotInTabOrder` в smoke подтверждает
  отсутствие атрибутов в Plan-режиме. Preview (`hp-device-preview.ts`) и
  static card (`space-render.ts`) получили `role="img"` без tabindex —
  не входят в tab order (grep подтверждает отсутствие `tabindex` в обоих
  файлах). Enter/Space вызывают тот же `_clickDevice`, что click (мутант
  `device-keyboard-bypasses-click-path` красный при подмене пути —
  **проверил лично**). `aria-label` включает `state_a11y_*`/`lqi_a11y_*` —
  `unavailableAriaIsReadable` в smoke подтверждает наличие "unavailable" и
  "LQI/signal" в одной строке. Hit-area 44×44 — через `.dev::before` c
  `max(44px, shell-size)`, `hitAreaAtLeast44` true. Возврат фокуса после
  диалога — существующий, не тронутый этим diff механизм `hp-dialog.ts`
  (`connectedCallback` захватывает opener, `disconnectedCallback` его
  восстанавливает); маркер теперь фокусируем, поэтому механизм
  автоматически распространяется без нового кода — **проверено чтением, не
  отдельным тестом** (в ТЗ явно «по существующему dialog contract», не
  новая фича). **unit + smoke + мутация (частично исполнено, частично
  чтением).**
- **AC11 (parity).** Один `renderDeviceFace()` вызывается из всех трёх
  поверхностей (`houseplan-card.ts`, `hp-device-preview.ts`,
  `space-render.ts`) — новых копий DOM/state-mapping не найдено (grep по
  `renderDeviceFace` — 3 вызова, все из общего модуля).
  `smoke_device_preview_parity.mjs` и `smoke_static_icon.mjs` green.
  **existing smoke.**
- **AC12 (совместимость).** `ripple_size` дефолт `3→1.5` заменён
  консистентно во всех 4 местах записи/чтения конфига (grep подтверждает
  отсутствие старого литерала `3`); "не материализуется" — та же
  тернарная схема `!== 1.5 ? value : null`, что и раньше была `!== 3`,
  проверено чтением каждого из 4 мест (нет посвящённого юнит-теста на этот
  конкретный литерал — **проверено чтением, не исполнением**, отмечаю
  честно). Backend `vol.Range(min=1, max=20)` (`validation.py`) не менялся;
  UI-слайдер расширен `2→1`, что *внутри* уже разрешённого backend-диапазона,
  не нарушение. i18n en/ru parity — новые ключи присутствуют в обоих файлах
  построчно. **unit (частично) + чтение кода + backend-схема прочитана.**
- **AC13 (производительность).** `grep ResizeObserver` — только
  существующие host/viewport подписки, ни одной новой per-marker; `grep
  backdrop-filter` — единственное вхождение `none` на `.device-shell`
  (запрещающее правило, соответствует Dark No-Blur решению M4 из
  SPEC-REVIEW r1). Motion — только `transform`/`opacity`
  (не задевает layout). SVG-примеры пакета не импортированы в `src/`/`dist`
  (grep по характерным именам файлов архива — пусто). **проверено чтением,
  не исполнением; performance_smoke — предрелизный гейт, не гонялся здесь.**
- **AC14 (release artifacts).** `docs/CHANGELOG.md`/`.ru.md`,
  `docs/USER-GUIDE.md`/`.ru.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`
  обновлены в том же коммите `48bcdaf` (`User-Visible: yes`), терминология
  USER-GUIDE.ru.md согласована с уже принятой в файле («жёлтая подложка»
  и т.п., не изобретена заново). i18n en/ru добавлены parity. Golden
  matrix version `31→32`, новый юнит `golden-matrix.test.mjs` проверяет
  структуру двух новых сценариев. Скриншоты (`docs/images/*.png`,
  `screenshots.json`) обновлены вместе с кодом.

## Трейлеры и процесс

- Каждый из 7 коммитов диапазона несёт `Issue: #179` и ровно один
  `User-Visible: yes|no`; `yes` — только на `48bcdaf`, где лежат оба
  changelog. Остальные 6 — `no` (доки/тесты/ТЗ), корректно.
  `node scripts/process-gate.mjs --issues` — green по заявлению автора;
  офлайн-часть (`--check`, структура трейлеров) визуально сверена по
  `git log`, расхождений не найдено.
- Ветка `issue/179-device-icons-redesign` соответствует номеру issue.
  Диапазон коммитов не содержит посторонних правок вне плана ТЗ §13.

## Итог

Реализация соответствует ТЗ по всем 14 AC, включая явно принятые владельцем
решения (§4) и технические предположения (§20). Секьюрный инвариант замков
(`docs/SCOPE.md` CR-1) не затронут — подтверждено прогоном
`smoke_lock_invariant.mjs`/`smoke_lock_action.mjs`. Все 4 новых mutation-guard
лично прогнаны и подтверждённо ловят свою регрессию — это самое сильное
доступное в этом процессе доказательство «тест умеет падать» для AC3/AC6/AC7/AC10.
Golden-baseline осознанно не принят (корректно оставлено предрелизному Linux
CI гейту); диагностический прогон двух новых сценариев не выявил визуальных
дефектов. Два Low-замечания зафиксированы и сняты без правки кода (обоснование
выше). High: 0, Medium: 0 — задача уходит в очередь на пре-релиз.
