# CODE-REVIEW-660-r1

Issue: #660 · Заход: r1 · Материал: `93d93f8c8911f74eb761106e22244ac1ba799949`
(HEAD, `git diff origin/dev...HEAD`, два коммита:
`ea11a6d6` feat + `93d93f8c` test).

## Скоуп

Follow-up к #647: крестик закрытия редактора переносится из внешнего
соседнего слота внутрь сегментированной группы `.modes` (сразу после активной
кнопки), расстояние `.modes` → `.zoomctl` уменьшается вдвое измеримым
контрактом (50/40.5 px), desktop-кнопки управления сводной панелью становятся
доступны во всех трёх редакторах (сам overlay остаётся View-only), и `Esc`
получает терминальный выход в View для Plan и Devices (Decor его уже имел).
Мобильный gear-меню (Q2 — альтернатива) не меняется. Задача — полный
продуктовый трек; ТЗ прошло SPEC-REVIEW-660-r1/r2/r3 (зелёный на r3), реализация
описана как её точное следствие. Работа закрывает J4/J6 (обслуживание плана
предсказуемее), полироль desktop-first контракта редакторов, без новой
предметной функции — в рамках `docs/SCOPE.md`.

## Как проверялось

Дешёвые гейты (`typecheck`, `npm test`, `npm run build`, `bundle-policy
--verify`, `no-new-any`, `no-new-private-writes`, диф-мутанты 6/6 шардов)
подтверждены зелёным Validate на этом самом SHA
(https://github.com/Matysh/houseplan-card/actions/runs/36229721971,
`workflow_dispatch`) — но в этом конкретном прогоне `changes`-джоб пометил
только фронтенд-путь как затронутый: **все «тяжёлые» джобы (smoke, golden,
performance_smoke, backend, hacs, hassfest, geometry_parity) в этом Validate
были `skipped`**, не «success». Раздел «AC · чем доказан · чем краснеет» из ТЗ
предполагает исполненные browser-смоки и golden-сверку — этого в материале не
было, поэтому прогнал сам:

| Гейт | Результат | Комментарий |
|---|---|---|
| `npx tsc --noEmit` / `npm test` / `npm run build` | не перегонял | зелёный Validate на этом SHA, дешёвые гейты сошлись (#343) |
| `bundle-policy --verify`, диф-мутанты (6/6 шардов) | не перегонял | тот же зелёный Validate; шарды диф-мутантов явно включают все шесть новых/изменённых #660-свидетелей (проверено по exact match строк в `scripts/mutation-registry.mjs`) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прогнал | 8 прямых совпадений (`_deviceDrag`, `_mode`, `stopPropagation`), 43 слабых; ниже — какие взял |
| `node demo/smoke_editor_tabs.mjs` (AC1, AC4, AC5, AC7, AC8 — назван в ТЗ) | **зелёный** | включает новые `planEscapeKeepsInternalPriority`, `planNeutralEscapeExits`, `deviceNeutralEscapeExits`, `decorEscapeKeepsInternalPriority`, `decorNeutralEscapeExits`, `summaryControlsStayInPlan`, `summaryControlsStayInEveryEditor` |
| `node demo/smoke_toolbar_stable_width.mjs` (AC3, AC4, AC5, AC6, AC9 — назван в ТЗ) | **зелёный** | все 7 ширин (1400/1200/1000/768/620/481/390); `modeToZoomGapMatchesSpec` и `closeSlotLivesInsideModes` true на каждой |
| `node demo/smoke_mobile_view_header.mjs` (AC2, AC9 — назван в ТЗ) | **зелёный** | `crossClosesOnPhone` (реальный клик по ×), `admin481_unchanged`, `admin768_unchanged`, `admin1400_unchanged` |
| `node demo/smoke_modes.mjs` (прямое совпадение) | зелёный | не регрессировал переключением режимов |
| `node demo/smoke_drag_bounds.mjs` (прямое совпадение) | зелёный | геометрия decor/markers не задета |
| `node demo/smoke_device_position_history.mjs` (прямое совпадение, `_deviceDrag`) | зелёный | `escapeAbortsWithoutWrite` — подтверждает приоритет отмены drag над новым терминальным Esc (AC8 для Devices) |
| `node demo/smoke_kiosk.mjs`, `node demo/smoke_summary_panel_polish.mjs` (риск по смежным поверхностям) | зелёные | kiosk и summary-persist контракты не задеты |
| `node scripts/check-docs.mjs --screenshots=warn` (диф трогает `src/**`) | зелёный | 1 ожидаемое `WARN` про устаревший скриншот-отпечаток (см. «Промотион», не гейт ревью); термин-скан по `docs/UX-MODES.md`/`USER-GUIDE*` не нашёл запрещённых старых формулировок |
| `npm run golden:verify` (видимое изменение) | прогнал, см. ниже | ожидаемый диф, без сюрпризов |
| `python -m pytest tests_backend -q` | не прогонял | диф не касается `custom_components/**/*.py` |
| `npm run invariants` | не прогонял | диф не трогает геометрию/её модель |
| performance-профиль | не прогонял | не назван в AC |

### Golden: анализ диффа, а не просто «есть diff»

`npm run golden:verify` (после `npm run bundle:sync` на свежий билд) даёт ~30
`different` из ~90 кадров. Проверил, что рисунок diff'а совпадает ровно с
объявленным изменением, а не течёт куда-то ещё:

- Все geometry/lighting/junction/device-icon/device-value кадры — `passed`
  (канва и рендер устройств не задеты).
- Все `*-mobile-ru` и `*-phone-*` кадры — `passed` (мобильный контракт
  Q2/AC2/AC9 не изменился — ожидаемо).
- `different` — ровно desktop-сценарии с видимым `.hdr` (диалоги
  `*-dialog-desktop-en/de`, попoверы `*-popover-desktop-en/ru`,
  `support-desktop-*`, `backup-*-desktop-*`, `optimize-*-dialog-*`) и
  editor-режимы (`tray-wide/medium-*`, `furniture-*`) — именно там, где
  крестик сменил позицию, появились/остались summary-controls и сместился
  промежуток до zoom.

Это ожидаемый, локализованный diff, а не регрессия. Baseline-приёмка —
предрелизный шаг (`npm run golden:accept -- --reviewed` на Linux/аттестованном
WSL), не обязанность код-ревью; сам риск назван автором в ТЗ.

## AC · чем доказано (сверка таблицы автора)

| AC | Заявлено ТЗ | Проверено | Как |
|---|---|---|---|
| AC1 (desktop summary в редакторах, overlay View-only) | unit + browser smoke | ✅ | `test/summary-panel-runtime.test.mjs` (`renderControls(false)` ≠ `nothing` в plan/devices/decor, `renderControls(true)` = `nothing`), `smoke_editor_tabs` `summaryControlsStayIn*`; чтением подтверждено, что `renderPanel()`/`syncPresentation()` не тронуты и `eligible` по-прежнему требует `_mode === 'view'` (`summary-panel-runtime-loaded.ts:860`) |
| AC2 (мобильное меню не меняется) | unit + smoke на 390/480 | ✅ | `header-menu.ts` diff — только комментарий, `mode === 'view'` guard (:79) не тронут; `smoke_mobile_view_header` зелёный на 390/320/481 |
| AC3 (gap 50/40.5 ±1) | browser layout smoke | ✅ | проверено чтением CSS-каскада (`.head{gap:10px}` из `dialogs.styles.ts` / `6px` в `@media 620px`, `.spacer{flex:0 0 30px/28.5px}`) — арифметика 10+30+10=50 и 6+28.5+6=40.5 совпадает с исполненным `modeToZoomGapMatchesSpec` на всех 7 ширинах |
| AC4/AC5 (порядок и стабильность слота) | browser smoke | ✅ | `closeSlotLivesInsideModes`, `widthAndTabsStable`, `slotOrder` (View=lastChild, редактор=после активной) — все true |
| AC6 (доступность ×) | smoke | ✅ | `crossVisibleAndSized`, `crossHitTarget`, `idleSlotInert`, `idleSlotKeepsSize` — true; `aria-hidden` в View подтверждено чтением шаблона |
| AC7 (нейтральный Esc) | keyboard smoke | ✅ | `planNeutralEscapeExits`, `deviceNeutralEscapeExits`, `decorNeutralEscapeExits` — true; чтением подтверждено, что каждая ветка `_onKey` заканчивается `return` (нет двойного действия) |
| AC8 (приоритет Esc) | smoke-сценарии | ✅ | `planEscapeKeepsInternalPriority`, `decorEscapeKeepsInternalPriority` (новые), `escapeAbortsWithoutWrite` в `smoke_device_position_history` (существующий, для Devices+drag) |
| AC9 (узкие ширины, touch-выход) | mobile/layout smoke | ✅ | `crossClosesOnPhone` (реальный клик), `w390/w481_noHeadOverflow`, `.modes` схлопнут до 24px, `.modetab` скрыты — не весь контейнер |
| AC10 (документация) | check-docs + ревью диффа | ✅ | `docs/UX-MODES.md`, `USER-GUIDE(.ru).md` обновлены непротиворечиво; term-scan прошёл |

Каждый защитный AC также подтверждён исполненным диф-мутантом
(`scripts/mutation-registry.mjs`, секция `#660`) — 5 новых witness'ов
(`toolbar-close-slot-leaves-mode-group`, `toolbar-mode-zoom-gap-regresses`,
`editor-summary-controls-return-to-view-only`,
`phone-editor-close-hidden-with-mode-buttons`,
`editor-neutral-escape-does-not-exit`) плюс find/replace-обновление всех
унаследованных #647/#616-мутантов под новую разметку; Validate на материале
подтвердил все 6 шардов диф-мутантов зелёными — то есть каждый снятый guard
реально покраснел на своей мутации, а не только заявлен текстом.

## Что проверено и корректно

- `_onKey`: и в ветке `devices`, и в терминале ветки `plan` (после лестницы
  инструментов) добавлен явный `return` — не может быть двойного действия
  одним нажатием (по коду и по исполненным сценариям выше).
- Изменение сигнатуры `renderControls(kiosk=false)` — `if (kiosk &&
  this.host._mode !== 'view') return nothing;` — оставляет kiosk-путь
  View-only (kiosk и так всегда в View по продуктовому контракту, редакторы
  туда не рендерятся), не открывает новую поверхность.
- `.editor-close-slot` теперь потомок `.modes` во всех режимах (в шаблоне —
  внутри `.map()` для активного редактора и после `.map()` для View), CSS
  `.editor-close-slot[aria-hidden='true']{pointer-events:none}` сохраняет
  инертность пустого резерва.
- Мобильный медиа-запрос `@media (max-width:480px)` больше не прячет весь
  `.modes` целиком (что было бы High, как в SPEC-REVIEW-660-r2): прячет только
  `.modetab`, коллапсирует контейнер до 24px без фона — крестик остаётся
  единственным touch-выходом, подтверждено кликом в смоке.
- Трейлеры: `feat`-коммит `User-Visible: yes` содержит оба changelog
  (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) в одном коммите; `test`-коммит
  `User-Visible: no`. Оба несут `Issue: #660`.
- Числа продублированы в одном источнике: 50/40.5 px — единственное место
  расчёта (CSS `gap`+`flex-basis`), смок измеряет фактический
  `getBoundingClientRect`, а не копию константы; расхождения быть не может.
- Второй коммит (`93d93f8c`) — легитимный ответ на красный Validate первого
  захода (`no-new-private-writes` поймал прямые записи в `_setMode`/`_tool` в
  собственном же новом тесте): переведён на публичный факад
  `window.__hpTest.setMode/setTool` (реальные клики, `demo/helpers/hp-test.mjs`
  подтверждает существование обоих методов), а не подавлен. Оставшаяся
  приватная запись `c._areaSel = savedAreaSel` — не новая (существовала на
  `origin/dev` до этой задачи), помечена `private-ok` по существу (нет
  публичного сеттера для отката тестовой фикстуры).

## Находки

**Low (снята с записью, не блокирует).** `src/houseplan-card.ts` в `_onKey`
диф без функциональной необходимости убрал два поясняющих WHY-комментария:
«close the topmost open dialog; info popups first, then editors» (был перед
лестницей диалогов) и «The palette is one explicit surface: Escape closes it
and returns to Select in one step…» (перед веткой `_decorTool === 'furniture'`).
Код под ними не менялся — это чистая потеря документации порядка приоритета,
не относящаяся к скоупу задачи. Функционального риска нет (те же исполненные
сценарии AC8 подтверждают порядок), поэтому не блокирую; отмечаю для автора на
будущее внимание к сопутствующим правкам в часто редактируемом файле.

High/Medium не найдено.

## Чего не проверял

- Полный HA backend harness (`pytest tests_backend` с реальной Home Assistant)
  — диф не касается `custom_components/**/*.py`.
- `npm run invariants` — диф не меняет геометрическую модель ни её ссылки.
- `performance_smoke` / отдельный performance-профиль — не назван в AC, диф не
  выглядит как влияющий на кадровый бюджет (только CSS/шаблон шапки и ветка
  клавиатуры).
- Полная браузерная матрица (~276 смоков) — выбор ограничен AC-названными
  смоками, прямыми совпадениями `smoke-select` и явно рискованными соседями
  (kiosk, summary-persist, device-drag-history); полный набор — предрелизная
  обязанность, а не гейт код-ревью.
- Принятие golden-baseline'ов (`golden:accept`) — предрелизный шаг на
  Linux/аттестованном WSL, не входит в код-ревью; проверил только форму диффа
  (см. выше), не выполнял приёмку.
- Ручного визуального просмотра в реальном браузере (сверх Playwright-смоков)
  не делал — не было доступного дисплея; вся визуальная сверка прошла через
  `getBoundingClientRect`/скриншот-diff инструменты.

## Материал раунда

- SHA материала: `93d93f8c8911f74eb761106e22244ac1ba799949`.
- ТЗ: редакция r3 (см. SPEC-REVIEW-660-r3, зелёный).
- Validate (workflow_dispatch, review-кандидат):
  https://github.com/Matysh/houseplan-card/actions/runs/36229721971 — success
  на фронтенд/провенанс/диф-мутантах; тяжёлые джобы (smoke/golden/backend/
  hacs/hassfest/geometry_parity/performance) — skipped в этом прогоне, закрыты
  ревьюером локально (см. таблицу гейтов).

## Вердикт

Зелёный. Все 10 AC доказаны исполнением (unit + browser smoke + diff-мутанты),
защитные AC имеют исполненного покрасневшего свидетеля, документация и
changelog согласованы, трейлеры верны. Единственная находка — Low, снята с
записью, не блокирует.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/660-toolbar-polish`, коммит `93d93f8c8911` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `152eca2a0629e2bb15b609e6cf594282c17ef0f6`
  ```
  git log --all --format='%H %T' | grep 152eca2a0629
  ```
- Тело issue: `8934e3862ceec6de29d1fd24fe32df49790efd62d8288fb28e36eecb05e44387`
- Вердикт конвейера: `green` · High 0
