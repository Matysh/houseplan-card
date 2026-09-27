# CODE-REVIEW-86-r3

- **Issue:** #86 — Тексты подсказок к настройкам, партия 1
- **ТЗ:** `docs/specs/086-settings-help-content-party1.md` (актуализировано 2026-08-30, зелёный SPEC-REVIEW-86-r1)
- **SHA материала:** `96bd3e3eccaaa57fae8a46159b90eb0702e2066b` (`origin/dev...HEAD`, 10 коммитов: `009f784d` `82585520` `30df567d` `d2d70df5` `ffd61def` `85e0f09f` `dbfaf48b` `414933e2` `0fc9b985` `96bd3e3e`)
- **Трек:** полный (нарушен критерий light-track «одна поверхность», зафиксировано автором в шапке ТЗ)
- **Заход:** r3 · блокирующих циклов израсходовано 2/4 (r1 — красный, r2 — жёлтый)

## Почему разбор полный, а не по дельте

Конвейер привёл ветку к `dev` до этого ревью: поверх материала r2 (`18ab3779`)
легли новые коммиты `origin/dev` (branch base сдвинулась с прежней `8819e390`/`ba568763`
на текущую `d14cf769`, тип `#44`). Это переписало все SHA веткb — я лично
проверил: все восемь SHA, перечисленных в шапке `CODE-REVIEW-86-r2.md`
(`fa031920`, `5994c929`, `b4c5083f`, `9e559b10`, `be6bd5f6`, `4015f7f8`,
`10f441aa`, `18ab3779`), дают `fatal: Not a valid object name` в текущей
истории (`git cat-file -e <sha>` на каждом). Это ровно случай PROCESS.md
§2.10/§7.2 «ребейз на ушедший вперёд dev — после ребейза это другой код»,
поэтому разбираю AC1–AC9 заново на `96bd3e3e`, а не только находку r2.

Я сопоставил новые SHA со старыми по содержимому коммитов (сообщение +
диф), чтобы не потерять картину: `009f784d`→(было `fa031920`, спека),
`82585520`→(`5994c929`, актуализация спеки), `30df567d`→(`b4c5083f`, feat),
`d2d70df5`→(`9e559b10`, no-new-any), `ffd61def`→(`be6bd5f6`, golden accept,
закрытие H2), `85e0f09f`→(`4015f7f8`, docs review r1), `dbfaf48b`→(`10f441aa`,
cold-onboarding smoke, закрытие M1-r1), `414933e2`→(`18ab3779`, docs accept,
закрытие H1), затем новый коммит r2-документа `0fc9b985`, и поверх — новый
для r3 коммит `96bd3e3e` (200%-zoom smoke, попытка закрытия M1-r2). Содержимое
каждой пары (кроме родителя) идентично по `git show <new> -- <path>`,
проверил построчно на трёх крупнейших (`30df567d`, `ffd61def`, `414933e2`).

## Скоуп

Diff (`origin/dev...HEAD` за вычетом сгенерированных `dist/**`,
`custom_components/**/frontend/**`) добавляет 11 согласованных Party-1
`hp-help`-подсказок в `houseplan-editor-runtime.ts` и дублирует 5
space-подсказок в `houseplan-onboarding-runtime.ts`; переводит их на
en/ru/de/fr; удаляет 4 старых `.rhint`; добавляет unit-тесты
инвентаря/parity/no-duplicate, мутационный тест
`settings-help-party1-placement-removed`, расширяет
`smoke_help_affordance.mjs` cold-onboarding и 200%-browser-zoom сценариями;
правит `CHANGELOG`×2, `USER-GUIDE.ru.md`, `TESTING.md`, `docs/specs/README.md`;
принимает 6 golden-эталонов party1 (+2 не связанных с #86, для уже слитой
#383) и полный десятикадровый набор `docs/images/**` после рейза; несёт два
собственных документа ревью (`docs/reviews/CODE-REVIEW-86-r1.md`,
`-r2.md`) как часть истории ветки.

Единственная содержательная новая работа с момента r2 — коммит `96bd3e3e`
(browser-zoom smoke); всё остальное — тот же контент, что и в r2, просто с
новыми SHA после рейза.

## Закрытие раунда r2

| Находка r2 | Чем закрыта | Где это видно |
|---|---|---|
| **M1** (Medium, в скоупе) — AC7 «browser zoom 200%» не доказан ничем: ни автотестом, ни golden-кадром, хотя ТЗ §13/§14 требует оба канала | **Частично.** Коммит `96bd3e3e` добавляет в `demo/smoke_help_affordance.mjs` реальный browser-смок: `launch({width:390,height:900}, 2)` — тот самый renderer-контракт «780 физических px → 390 CSS px при DPR 2», который сама ТЗ §14 описывает как метод; открывает `gs.bg_mode.help`, проверяет 5 фактов (`zoomApplied`, `triggerInside`, `tooltipInside`, `noHorizontalDialogOverflow`, `stageStable`). Я прогнал `node demo/smoke_help_affordance.mjs` лично — все пять `party1BrowserZoom200*` = `true`, тест не тавтологичен: `inside()` зависит от реального `getBoundingClientRect()`, при отсутствии триггера/тултипа вернул бы `false`. **Golden-часть не закрыта**: `git diff origin/dev...HEAD -- demo/golden/matrix.mjs` — пусто, никакой 200%-zoom/`deviceScaleFactor`-сценарий для party1-диалогов не добавлен ни в r2, ни в r3. См. новую находку M1 ниже — это тот же пробел ТЗ, наполовину закрытый. |

## Унаследовано из r2

Формально разбор в этом заходе полный (см. выше), поэтому ничего не принято
только на основании прежнего документа без собственной проверки на `96bd3e3e`.
Из r2 без повторной аргументации, но с повторной проверкой факта, взято:
- механизм `hp-help`/`hp-dialog` (#68) не форкнут — перепроверено (`git diff
  origin/dev...HEAD` по `src/hp-help*`, `src/hp-dialog*` пуст) на текущем SHA,
  а не принято на слово из `CODE-REVIEW-86-r2.md`;
- список Party-1 из 11 ключей и их каноничные RU/EN тексты — сверены заново
  построчно с §6 ТЗ и с тестом `issue 86 Party 1 has the exact help inventory`
  на `96bd3e3e`, прогнан лично;
- содержимое `docs/images/**` — открыл `06-device-editor.png` и
  `03-space-create.png` заново глазами на текущем SHA (не переиспользовал
  скриншот из r2-документа): оба показывают новые ⓘ-иконки («Controls other
  light sources», «Is this device a light source?», «Scale (grid cell
  size)», «Zero-thickness walls»). `check-docs.mjs` зелёный на `96bd3e3e`.

Находка L1 (низкая, снята без правки в r1/r2 — `.help`-ключ не совпадает
буквально с ключом label) не задета ни рейзом, ни новым коммитом; решение
прежних раундов остаётся в силе, повторно не аргументирую.

## Как проверялось

Зелёного Validate на `96bd3e3e` на момент ревью не найдено — прогнал дешёвые
и целевые гейты лично:

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный |
| Unit | `npm test` | 1611 тестов, 1610 pass, 1 skip (тот же приватный `#281`-фикстур-скип, что и на `origin/dev`, к #86 не относится), 0 fail |
| Build + sync | `npm run build`, `npm run bundle:sync` | ок, `git status` после — чисто (три копии бандла уже были синхронны) |
| 3 копии бандла | `cmp dist/houseplan-card.js custom_components/.../houseplan-card.js`, `cmp dist/houseplan-assets.json custom_components/.../houseplan-assets.json`, `cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | идентичны (все три) |
| Bundle budget | `npm run bundle:budget` | initial View 280 304 B гзип, бюджет 300 000 — в норме |
| no-new-any | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | 119 добавленных строк в 3 файлах, новых `any` нет |
| check-docs | `node scripts/check-docs.mjs` | зелёный (7 файлов, 10 внешних ссылок); визуально перепроверил 2 из 10 кадров лично (см. «Унаследовано») |
| Выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 12 «прямое совпадение», 18 «слабая связь» — тот же список, что и в r2 (diff содержательно не изменился, кроме теста) |
| Смоки прямого совпадения (12/12) | `smoke_help_affordance` (включая новый cold-onboarding и 200%-zoom блоки), `smoke_bg_color`, `smoke_color_picker_consumers`, `smoke_device_inbox`, `smoke_dialog_zombie`, `smoke_disabled_device`, `smoke_esc_dialogs`, `smoke_gs_always`, `smoke_ha_controls`, `smoke_hidden_flag`, `smoke_motion_sense`, `smoke_sun` | все 12 зелёные |
| Мутационный гейт задачи | `node scripts/mutation-gate.mjs --id=settings-help-party1-placement-removed` | поймано 1 из 1, гейт-чек (`npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test ...`) сам по себе чистый |
| **Golden** | `npm run golden:verify` (полный лог, без `tail`, второй прогон отфильтрован `grep` на именованные сценарии) | `exitCode=0`; явно проверил, что все 8 связанных с #86/#383 сценариев (`device-inbox-desktop-en-light`, `device-inbox-desktop-ru-dark`, `device-inbox-narrow-ru-dark`, `toggle-entity-dialog-desktop-en`, `toggle-entity-dialog-mobile-ru`, `space-room-color-popover-desktop-ru`, `furniture-transform-light`, `furniture-transform-dark`) — все `passed`; ни одного `different`/`missing` во всём прогоне |
| DE/FR полный перевод | ручное чтение всех 11 `.help` + `.aria` в `de.json`/`fr.json` | смысл передан полностью, пропусков предложений нет |
| process-gate (офлайн) | `node scripts/process-gate.mjs` | пройден, 0 предупреждений (проверка статуса issue пропущена — нет `--issues`) |

**Что не прогонял и почему:**
- 18 «слабых связей» из `smoke-select` (общее имя `_config`) — все про
  геометрию/локали/optimize, diff их логики не касается, сигнала для
  расширения после 12/12 прямых совпадений нет;
- `python -m pytest tests_backend -q` — diff не касается
  `custom_components/**/*.py` (только сгенерированные фронтенд-бандлы внутри);
- остальные ~193 браузерных смока и `performance_smoke` — задача не задевает
  геометрию/перф-чувствительные пути, полный прогон здесь избыточен (§8:
  полные наборы — предрелизный гейт);
- `model-invariants` — diff не трогает геометрию, ссылки, `layout`,
  `marker.space`, `open_spans`; неприменимо.

## Находки

### M1 — AC7 «представительный reviewed golden» для browser zoom 200% так и не появился (Medium, в скоупе)

ТЗ формулирует AC7 как **двухканальное** доказательство: «Узкий viewport
390 px и browser zoom 200% не обрезают tooltip/trigger и не меняют stage
geometry. **Доказательство: smoke + representative reviewed golden**» (§13),
а план автотестов (§14) отдельно и явно перечисляет golden-требование:
«Golden: … light/dark and 200% zoom; **full Linux artifact review
required**» — отдельной строкой от смок-плана про тот же 200%-zoom
layout-pass.

r2 закрыл ровно половину: `96bd3e3e` добавил рабочий смок (проверил лично,
см. таблицу выше и «Закрытие раунда r2»). Golden-половина не появилась ни в
r2, ни в этом коммите:

- `git diff origin/dev...HEAD -- demo/golden/matrix.mjs` — **пусто**, ни один
  сценарий не добавлен и не изменён этим diff'ом вообще;
- `grep -n "zoom\|deviceScaleFactor\|dpr2" demo/golden/matrix.mjs` — единственное
  совпадение `dpr2: true` относится к неродственному сценарию
  `tunnelContinuity` (геометрия проёмов, строка 484), а `large-house-zoom-*`
  (строки 130–131, 743–746) — это zoom канвы плана (`zoom: 0.4/2.5`), а не
  browser-zoom диалога, и не про #86 (уже отмечено ещё в r2);
- ни один из 8 принятых по #86/#383 golden-кадров (см. таблицу «Как
  проверялось») не задаёт `deviceScaleFactor`/увеличенный `fontSize` —
  все они сняты при обычном масштабе.

Это тот же пробел ТЗ, что и M1 из r2, просто теперь наполовину закрыт: сам
факт «trigger/tooltip не обрезаются при 200% zoom» теперь доказан
исполнением (смок), но собственное требование ТЗ о **golden-кадре** с
человеческим ревью реального рендера при 200% zoom остаётся неисполненным
после двух раундов внимания именно к этому AC. Я не могу заменить это
решение своим чтением CSS или доверием к смоку: ТЗ называет golden отдельным
обязательным каналом доказательства, а не альтернативой смоку, и это
продуктовое решение автора ТЗ (какая степень доказательства нужна для
рендер-регрессий), а не техническая деталь реализации, которую покрывает
свобода §7.1.

**Как воспроизвести:** `git diff origin/dev...HEAD -- demo/golden/matrix.mjs`
→ пустой diff; `grep -n "zoom\|deviceScaleFactor" demo/golden/matrix.mjs` →
только неродственные совпадения.

**Что нужно:** добавить в `demo/golden/matrix.mjs` минимум один
representative party1-сценарий (например тот же `gs.bg_mode.help` в общих
настройках или один space-диалог) с `deviceScaleFactor: 2` и уменьшенным
`viewport.width` (390 CSS px, как в смоке) для light и dark тем — как прямо
требует §14 — принять через `npm run golden:accept -- --reviewed` на полном
Linux-артефакте, приложить ссылку на прогон. Альтернатива — явно
зафиксировать в ТЗ (правкой документа, не просто в хендоффе) решение
владельца/автора о том, что golden-канал для этого под-AC избыточен и смока
достаточно, с обоснованием; тогда это перестанет быть находкой. Пока такой
записи нет ни в ТЗ, ни в решениях владельца по #86, действующий контракт —
тот, что в §13/§14.

### L1 — `.help`-ключ не совпадает буквально с ключом видимого label (Low, снимается без правки)

Унаследовано из ревью ТЗ (SPEC-REVIEW-86-r1) и CODE-REVIEW-86-r1/r2:
`space.cell_cm.help` соседствует с `space.scale_label`, `space.fill_mode.help`
— с `space.fill_label`. Не создаёт двусмысленности контракта, тот же паттерн
уже был у пилотов #68, находится в рамках технической свободы реализации по
PROCESS.md §7.1. Не задето ни рейзом, ни коммитом `96bd3e3e`. Оставляю без
правки.

## Что проверено и корректно

- **AC1 (инвентарь).** `grep -oE "_help\('[^']+\.help'\)"` по обоим рантаймам
  на `96bd3e3e` — ровно 11 Party-1 ключей плюс существующие 8 пилотных
  `marker.*` из #68, новых мест за пределами §6 нет. 5 `space.*`-ключей
  идентичны между `houseplan-editor-runtime.ts` и
  `houseplan-onboarding-runtime.ts`. Доказано тестом `issue 86 Party 1 has
  the exact help inventory` (прогнал, зелёный) и мутационным гейтом
  `settings-help-party1-placement-removed` (прогнал лично — мутант пойман).
- **AC2/AC3 (канонический текст, parity).** RU/EN в `en.json`/`ru.json`
  побайтово совпадают с таблицей §6 ТЗ — сверил тестом (жёсткий
  `assert.equal`, прогнал, зелёный). DE/FR прочитаны целиком лично — передают
  тот же смысл без пропусков предложений. `.help.aria` пары присутствуют во
  всех 4 словарях, тест `i18n: every literal help call has body and full
  aria keys in every language` зелёный (проверяет объединённый
  `helpSource` — оба рантайма).
- **AC4 (без дублей).** `marker.controls_hint`, `gs.bg_daynight_hint`,
  `gs.north_hint`, `space.zero_wall_help` удалены из всех 4 словарей и обоих
  рантаймов — тест `issue 86 removes explanatory hints…` зелёный, `grep`
  лично подтвердил отсутствие.
- **AC5 (все поверхности).** General (`gs.glow_radius`, `gs.bg_mode`,
  `gs.north`), Space (`space.cell_cm`, `space.zero_wall_style`,
  `space.bg_mode`, `space.north`, `space.fill_mode`), Marker
  (`marker.controls.help`) и Device catalog
  (`device_inbox.show_hidden.help`) — все присутствуют в diff'е шаблонов;
  открытие подтверждено `smoke_help_affordance` (все `party1*Inventory`
  флаги `true`) и визуально — открыл `06-device-editor.png`,
  `03-space-create.png`, а через `golden:verify` подтвердил ещё 6 кадров
  (`device-inbox-*`, `toggle-entity-dialog-*`,
  `space-room-color-popover-desktop-ru`) без наложений/обрезки.
- **AC6 (input/a11y).** Переиспользует lifecycle #68 без форка; `smoke_help_affordance`
  (прогнал, зелёный) покрывает hover/focus/click/Escape/disabled/Popover-fallback,
  включая `keyboardFocus: true`.
- **AC7 (узкий viewport 390 px + 200% zoom).** Часть про 390 px доказана и
  смоком (`party1ShowHiddenHelpInsideNarrowViewport`), и golden
  (`device-inbox-narrow-ru-dark`, `toggle-entity-dialog-mobile-ru`, оба
  `passed`). Часть про 200% zoom теперь доказана смоком
  (`party1BrowserZoom200*`, все 5 флагов `true`, прогнал лично), но не
  golden-каналом — см. находку M1.
- **AC8 (модель не меняется).** Прочитан весь diff `src/**` — ни одного
  изменения вне JSX-шаблонов, CSS и `_help()`-геттеров; `strictNumber`,
  `touchSpaceDisplay`, `@change`/`@input` обработчики не тронуты. `npm test`
  (1610/1611 pass) включает существующие config-serialization снапшоты — без
  регрессий.
- **AC9 (партии 2/3 отсутствуют).** `src/**` вне i18n просмотрен построчно —
  только `houseplan-editor-runtime.ts`, `houseplan-onboarding-runtime.ts`,
  `dialogs.styles.ts`; ни одного `_help()` вне §6 сверх уже существующих
  пилотов; в i18n нет ключей `opening.*`/`wallthick.*`/`decor.*`/`device.binding.*`
  партий 2/3.
- **Одно число — один источник.** Diff не добавляет и не меняет ни одной
  пользовательской величины — только текст подсказок и разметка; правило
  неприменимо. `test/single-source-numbers.test.mjs` прошёл в составе `npm test`.
- **Трейлеры и changelog.** `Issue: #86` на всех 10 коммитах; `User-Visible: yes`
  только на `30df567d`, в нём же правки обоих changelog (проверил `git show
  30df567d -- docs/CHANGELOG.md docs/CHANGELOG.ru.md`). Коммиты, трогающие
  `demo/golden/baselines/**` (`ffd61def`) и `docs/images/**` (`414933e2`),
  несут `Release:`+`Baseline-Reviewed:` со ссылками на зелёные прогоны.
  `docs/specs/README.md` содержит строку #86 → файл спеки.
- **process-gate.mjs (офлайн).** Пройден, 0 предупреждений.

## Вывод

Контент-часть партии 1 (11 подсказок, 4 локали, source contract,
mutation-тест, cold-onboarding поведение) корректна и без регрессий после
второго рейза — я лично пересобрал бандл, прогнал `golden:verify` полным
логом, все 12 прямых смоков и заново открыл документационные кадры, а не
принял их на слово из документа r2.

Новый коммит `96bd3e3e` реально закрывает исполняемую часть находки r2 (M1):
поведение при 200% browser zoom теперь доказано смоком, который умеет
падать. Но собственное требование ТЗ §13/§14 о **golden-кадре** для этого же
under-AC — отдельный, явно названный канал доказательства — так и не
выполнено ни в r2, ни здесь. High-находок нет, поэтому вердикт снова
жёлтый, а не красный: то же самое требование ТЗ, что и в r2, теперь
закрыто наполовину вместо нуля, и чинится в этом же issue без нового
цикла спецификации.
