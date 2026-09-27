# CODE-REVIEW-57-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/57
- **ТЗ:** `docs/specs/057-color-opacity-picker.md` (ревью
  `docs/reviews/SPEC-REVIEW-57-r1.md`, вердикт — зелёный, Medium-1 вынесен в
  #180, Low-1 — устранён автором прозой §9)
- **Диапазон:** `git diff origin/dev...HEAD` / `git log --oneline
  origin/dev..HEAD` — коммиты `ffb1084` (ТЗ), `32e3a79` (документ спек-ревью),
  `299da59` (реализация, `Issue: #57`, `User-Visible: yes`)
- **Роль:** ревьюер кода (не автор), этап `S7-code-review`
- **Цикл:** r1/4

## Скоуп ревью

Проверялось соответствие реализации:

- ТЗ `docs/specs/057-color-opacity-picker.md` — контракту §7–§14 (единая
  поверхность, значения/преобразования, pointer/touch, keyboard/a11y, API/
  migration, AC1–AC9);
- `docs/SCOPE.md` — задача не расширяет продукт за пределы editor usability
  polish;
- `AGENTS.md`/`PROCESS.md` — классы файлов, трейлеры, оба changelog в одном
  `User-Visible: yes` коммите, отсутствие новых runtime dependencies;
- фактическому поведению `src/hp-color-opacity.ts`, `src/color-picker.ts`,
  `src/floating-surface-controller.ts`, вызовам в `src/houseplan-card.ts`;
- реально выполненным гейтам (см. ниже), включая один прогон golden-сьюта
  целиком, не только названного в ТЗ сценария.

## Как проверялось

1. Прочитан весь diff (`git diff origin/dev...HEAD --stat` и файлы по
   отдельности): `src/hp-color-opacity.ts` (412 изменённых строк),
   новый `src/color-picker.ts` (80 строк, чистые функции конверсии),
   изменения `src/houseplan-card.ts` (8 call sites получили
   `.pickerLabels=${this._colorPickerLabels}`), `src/i18n/{en,ru}.json` (6 новых
   пар ключей `color_picker.*`), `test/color-picker.test.mjs`,
   `demo/smoke_color_picker.mjs`, `demo/smoke_help_affordance.mjs` (+3 строки),
   `docs/{CHANGELOG.md,CHANGELOG.ru.md,USER-GUIDE.md,USER-GUIDE.ru.md,TESTING.md}`.
2. Подтверждено построчным поиском `<hp-color-opacity` в `houseplan-card.ts` и
   тестом-сканом (`test/color-picker.test.mjs:48-49`), что все 8 call sites
   (decor stroke/fill/text/furniture, room/space custom fill, marker Glow)
   получили новый компонент и локализованные `pickerLabels` — совпадает с §12
   ТЗ и списком, ранее сверенным в SPEC-REVIEW-57-r1.
3. Прочитан `src/hp-color-opacity.ts` целиком: подтверждено отсутствие
   `<input type="color">`, единая `.picker` поверхность
   (`role="dialog"`, `aria-label`) рендерится синхронно с saturation/value
   полем, hue/saturation/value ranges, hex-полем и (при `showOpacity`) alpha
   row+процентом — соответствует §7/§14 AC1 ТЗ дословно.
4. Прочитан `src/color-picker.ts`: `normalizeHexColor` принимает 3/6-значный
   hex с необязательным `#`, `rgbToHsv`/`hsvToRgb`/`hsvToHex` — конечные,
   clamped функции без побочных эффектов — соответствует §8 ТЗ.
5. Прочитан `FloatingSurfaceController` (`src/floating-surface-controller.ts`)
   и его использование в `hp-color-opacity.ts` (`_floating`,
   `registerOverlay`, `_renderFallback`, `_supportsPopover`) — подтверждает
   заявленное в ТЗ переиспользование общей инфраструктуры #68, а не
   параллельную реализацию.
6. Прочитан весь текст issue #57 и всех комментариев (`gh issue view 57
   --comments`): исходный запрос, аналитика с Q1, решение владельца по Q1
   («один клик — одна поверхность с цветом и прозрачностью, без вложенного
   system picker»), финальный хендофф автора с цифрами бандла и списком
   выполненных проверок. Реализация воспроизводит решение владельца дословно
   (см. «Что проверено и корректно»).
7. Прогнаны все обязательные дешёвые гейты и часть гейтов «по необходимости»
   (перечень и результаты — раздел «Гейты» ниже), включая полный
   `npm run golden:verify` — diff меняет видимый рендер во всех диалогах,
   использующих `hp-color-opacity`, что подпадает под критерий «геометрия/
   стили/слои» из инструкции к этому ревью.
8. Для каждого теста, который прогонялся, целенаправленно сломан
   соответствующий кусок продукта и подтверждено, что тест падает, затем код
   восстановлен и гейты перепрогнаны на чистом дереве (см. «Гейты»).
9. Просмотрены PNG-артефакты (`artifacts/golden/actual/*`,
   `artifacts/golden/diff/*`) для всех пяти сценариев, показавших `different`,
   чтобы отличить реальную визуальную регрессию от ожидаемого следствия новой
   поверхности (см. находку Low-1).
10. Проверены трейлеры и class-принадлежность:
    `git show 299da593 --stat` — класс A/B/C/D-файлы согласованы (продукт +
    smoke/test + документация + все три копии бандла в одном коммите),
    `Issue: #57`, `User-Visible: yes`, оба changelog в том же коммите.
11. Проверено отсутствие новых runtime dependencies:
    `git diff origin/dev...HEAD -- package.json package-lock.json` — пусто.
12. Проверено, что Medium-1 из SPEC-REVIEW-57-r1 действительно заведён
    отдельным issue: `gh issue view 180` существует, метки `P3`/`tech-debt`/
    `S1-new`, ссылается на #57.

## Обязательные гейты (всегда)

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | чисто, без вывода |
| Unit-тесты | `npm test` | `884/884`, 0 fail |
| Build + сверка бандлов | `npm run build` + `sha256sum dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js demo/srv/assets/houseplan-card.js` | все три идентичны, `6d7e2b02aee1a3af822f1f634209a0fd62e1348988b87c7a1a4eff0f08fa7490` — совпадает (без учёта регистра) с заявленным автором в хендоффе |

Falsifiability (тест должен уметь падать), применена к обоим прогнанным
наборам:

- временно вставлен `<input type="color">` в `hp-color-opacity.ts` →
  `test/color-picker.test.mjs` тест «contains no nested native color picker»
  корректно упал (`not ok 50`); код восстановлен, `npm test` снова 884/884.
- временно превращён `_setHue` в no-op → `demo/smoke_color_picker.mjs`
  корректно провалил `hueUpdatesSharedDraft` и `shiftArrowUsesTenStep`; код
  восстановлен, бандл пересобран, три копии совпадают с исходным SHA-256,
  `git status` чист.

Bundle budget (AC8): raw `1 107 696 → 1 119 200` (`+11 504 B`, совпадает с
заявленным автором), gzip (`gzip -9`) `304 081 → 306 755` (`+2 674 B`) —
близко к заявленным автором `+2 728 B` (разница из-за конкретного
gzip-инструмента/уровня в отчёте, не в самом бандле); в любом случае это
на порядок меньше бюджета ТЗ `≤15 KiB gzip`. Runtime dependencies не
добавлены (`package.json`/`package-lock.json` не изменены).

## Гейты по необходимости

| Гейт | Почему запускался | Результат |
|---|---|---|
| `node demo/smoke_color_picker.mjs` | назван в AC1–AC5 ТЗ как способ доказательства | зелёный, все 14 проверок `true`; falsifiability подтверждена (см. выше) |
| `node demo/smoke_help_affordance.mjs` | тронут (`+3` строки) для проверки color-only Glow и forced-fallback exclusivity с `hp-help`, назван в AC6/§15 ТЗ | зелёный, все проверки `true`, включая `fallbackPickerFocusable` (forced-fallback ветка для пикера) и `glowColorOnlyHasNoAlpha` |
| `npm run golden:verify` (полный набор, 66 активных сценариев в текущей матрице) | diff меняет видимый рендер (новая поверхность вместо `input[type=color]`) во всех диалогах, использующих `hp-color-opacity`, — подпадает под критерий «рендер/геометрия/стили» из инструкции к ревью, а не только названный в ТЗ сценарий | 61 passed, 5 `different` — все пять разобраны построчно, см. находку Low-1 |
| `node scripts/check-docs.mjs --external` | дёшево, диф трогает 4 файла документации | зелёный, «7 files, 10 external links» |
| `node scripts/process-gate.mjs --issues` | дёшево, проверяет трейлеры/структуру коммитов диапазона | зелёный, «гейт пройден, предупреждений 0» |

## Что проверено и корректно

- **Главный контракт владельца по Q1 воспроизведён точно.** Один
  click/tap/Enter/Space по `.trigger` открывает единственную `.picker`
  поверхность; внутри нет `<input type="color">` и второго dialog — прямым
  чтением кода и тестом-сканом, а не только smoke.
- **Все 8 call sites обновлены единообразно** и не получили адаптеров: decor
  stroke/fill/text/furniture, room/space custom fill, marker Glow — тот же
  список, что был подтверждён на этапе ТЗ. `showOpacity=false` для Glow
  по-прежнему скрывает только alpha-row (`ranges().length === 3` в smoke).
- **API и данные не расширены.** `color`/`opacity`/`showOpacity`/`disabled` и
  событие `hp-color-opacity-change` с прежней формой `{ color, opacity }` —
  без изменений сигнатуры; ни один файл backend/`types.ts`/`custom_components`
  не тронут (AC9 — подтверждено `git diff --stat`).
- **Round-trip и валидация значений (AC3)** — table-тест по всему цветовому
  кубу подтверждает допуск ≤1 канал; невалидный hex-драфт никогда не
  эмитится (`invalidHexNeverEmits` в smoke), commit восстанавливает последнее
  валидное значение — прочитано в `_commitHex` и подтверждено выполнением.
- **Touch/pointer (AC4)** — `setPointerCapture`/`releasePointerCapture`,
  `pointercancel`/`lostpointercapture` откатывают черновик без нового
  события (`pointerCancelAddsNoEvent` в smoke); второй одновременный pointer
  игнорируется (`_activePointerId !== null` guard) — проверено чтением кода,
  не отдельным multi-touch smoke (см. «Чего не проверял»).
- **Keyboard/a11y (AC5)** — все четыре ranges имеют `aria-label`/
  `aria-valuetext`, `step=1` даёт шаг 1, `Shift+Arrow` даёт шаг 10
  (`shiftArrowUsesTenStep` в smoke); hex-поле — подписанный text input с
  `aria-invalid`/`aria-describedby` без live-спама по символам; Escape
  закрывает picker и возвращает фокус на trigger без закрытия диалога
  (`escapeClosesFirstAndRefocuses`); focusable-состав включает pickerButton в
  фокус-трапе диалога и в forced-fallback ветке (`shadowFocusables`,
  `fallbackPickerFocusable`).
- **Floating lifecycle (AC6)** — общий `FloatingSurfaceController`
  используется без дублирования логики #68; forced-fallback ветка (когда
  `showPopover`/`hidePopover` недоступны) реально рендерит picker в теневой
  портал и остаётся focusable — подтверждено выполнением
  `smoke_help_affordance.mjs`, не только чтением.
- **i18n** — новые ключи `color_picker.{title,hue,saturation,value,hex,
  invalid_hex}` добавлены синхронно в `en.json`/`ru.json`; компонент остаётся
  presentation-only (`pickerLabels` — свойство, не читает `hass.locale`
  напрямую) — `cardLanguageOwnsCopy` в smoke подтверждает изоляцию по
  `config.language` на уровне карточки.
- **Trailers/классы файлов/changelog** — коммит `299da59` несёт `Issue: #57`,
  `User-Visible: yes`; оба changelog (`docs/CHANGELOG.md`,
  `docs/CHANGELOG.ru.md`) редактируются в этом же коммите; ни новых runtime
  dependencies, ни изменений `package.json`.
- **Medium-1 из SPEC-REVIEW-57-r1 закрыт корректно** — issue #180 существует,
  правильно размечен и ссылается на #57; реализация не пытается тайно
  расширить или сузить скоуп относительно принятого ТЗ.
- **Bundle budget (AC8)** — независимо пересобранный бандл даёт тот же
  SHA-256 и raw-дельту, что заявил автор; gzip-дельта на порядок меньше
  лимита `≤15 KiB` независимо от точного инструмента измерения.

## Находки

### Low-1 — реализация меняет визуальный рендер ещё в 4 golden-сценариях, не названных нигде в ТЗ/TESTING.md как ожидающие ревью

**Файлы:** `docs/TESTING.md:69-89` (раздел «Unified color and opacity picker
(#57)», называет только `decor-color-popover-mobile-ru`); фактически
затронуты также `device-dialog-desktop-en`, `device-dialog-mobile-ru`,
`device-help-popover-light-ru`, `tray-narrow-tool-ru`.

Полный прогон `npm run golden:verify` (66 активных сценариев в текущей
матрице) даёт 5 `different`, не 1: помимо названного в TESTING.md
`decor-color-popover-mobile-ru`, отличаются ещё `device-dialog-desktop-en`,
`device-dialog-mobile-ru` (marker Glow trigger — новый 40×40 swatch/picker
вместо старого layout), `device-help-popover-light-ru` (тот же Glow trigger в
соседстве с `hp-help`) и `tray-narrow-tool-ru` (decor color trigger в узкой
панели инструментов). Просмотр `artifacts/golden/actual/*.png` для всех пяти
подтверждает: рендер корректен, не обрезан, не сломан — разница целиком
объясняется новым размером/видом trigger-кнопки (`checkerboard` 40×40)
против прежнего инлайн `input[type=color]` + `range`, что каскадно сдвигает
контент диалога на 12–20 CSS px вниз. Это ожидаемое и безопасное следствие
явно принятого технического решения (§6 ТЗ), не дефект поведения.

**Почему это находка, а не просто ожидаемое поведение.** `docs/TESTING.md`
(единственное место, которое перечисляет пре-бета golden-обязательства этой
задачи) называет только один сценарий. Тот, кто перед бетой примет решение
`golden:accept` только по названному списку, рискует пропустить, что
реальный список отличающихся baseline — впятеро шире. Пре-бета гейт (полный
`golden:verify`) всё равно покажет все 5 расхождений и не даст принять
неполный набор молча — риск чисто в неполноте самодокументирования задачи,
не в скрытом от процесса дефекте.

**Решение ревьюера:** Low, не блокирует `S8-merged`. Не требует отдельного
issue — это не новая функциональность и не дефект поведения, а неполнота
одной строки в `docs/TESTING.md`, целиком описывающей последствия этой же
задачи. Оставляю с этой записью, правка необязательна: `golden:verify`
перед бетой в любом случае предъявит все 5 сценариев ревьюеру беты, а не
только названный.

## Чего не проверял

- **Multi-touch (второй одновременный pointer) как отдельный smoke** — §9
  ТЗ требует, чтобы второй pointer «отменял первый либо игнорировался
  безопасно»; `demo/smoke_color_picker.mjs` проверяет только
  `pointercancel` одного pointer. Ветка «второй pointer игнорируется»
  (`_svPointerDown`: `if (this._activePointerId !== null) return;`)
  проверена чтением кода, не исполнением — как и просил бы обычный, не
  light-track процесс при отсутствии реального multi-touch harness в
  окружении ревью.
- **200% браузерный zoom на 390 CSS px (AC7/§10 ТЗ)** — ни один smoke, ни
  один golden-сценарий (`demo/golden/matrix.mjs`) не эмулирует
  page-level 200% zoom; существующие `zoom: 0.4/2.5` в матрице — это
  масштаб плана внутри канваса, не zoom страницы. CSS-контракт
  (`width: min(292px, calc(100vw - 16px))`, `overflow: auto`) читает как
  корректный, но это не исполненное доказательство для этой конкретной
  строки AC7 — фиксирую честно, а не выдаю чтение кода за тест.
  Не блокирует: остальные AC7-грани (light/dark, checkerboard, отсутствие
  прыжка layout при disabled) подтверждены выполнением/чтением.
- **`golden:accept`** не запускал и не должен — принятие новых baseline
  (для всех 5 «different», не только названного) принадлежит пре-бета
  этапу (`PROCESS.md`, `npm run golden:accept -- --reviewed` только на
  полном Linux CI-артефакте), не циклу код-ревью.
- **`python -m pytest tests_backend -q`** — не запускал: diff не трогает ни
  одного файла `custom_components/**/*.py` (подтверждено `git diff --stat`),
  гейт неприменим.
- **performance-профили** (`benchmark:*`) — не запускал: AC явно не
  называет производительность как критерий (только «no new long task» в
  §15 плана автотестов, не в нумерованных AC1–9), diff не трогает canvas/
  рендер-цикл плана — rAF-коалессинг в pointermove-пути прочитан в коде
  (`_queueHsvEmit`) и оценивается как корректный по конструкции, но не
  измерен профайлером.
- **Полный построчный обзор `src/houseplan-card.ts` (~18500 строк)** на
  предмет иных мест, не относящихся к call sites `hp-color-opacity` —
  не требуется этим циклом: контракт ТЗ (после Medium-1 → #180) явно
  ограничен уже перечисленным списком, и `test/color-picker.test.mjs:48`
  формально фиксирует ожидаемое число (8) вызовов компонента.

## Вердикт

Зелёный. High: 0, Medium: 0, Low: 1 (не блокирует, запись оставлена в этом
документе, правка необязательна — см. Low-1). Реализация корректно и
проверяемо закрывает контракт ТЗ и решение владельца по Q1: единая
поверхность цвета и прозрачности без вложенного системного picker, на всех
восьми существующих call sites, без изменения API/схемы/данных и без новых
runtime dependencies, в рамках заявленного бюджета bundle size. Все
обязательные гейты и относящиеся к тронутым поверхностям smoke/golden гейты
выполнены лично ревьюером (не переиспользована декларация автора), включая
собственноручную проверку «тест умеет падать» для одного unit- и одного
browser-smoke теста. Единственная находка — неполнота одной строки в
`docs/TESTING.md` относительно фактического числа golden-сценариев,
меняющихся вместе с этой задачей — не блокирует, поскольку пре-бета гейт
сам по себе предъявит полный список расхождений до `golden:accept`.
