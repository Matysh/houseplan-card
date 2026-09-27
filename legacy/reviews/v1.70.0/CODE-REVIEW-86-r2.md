# CODE-REVIEW-86-r2

- **Issue:** #86 — Тексты подсказок к настройкам, партия 1
- **ТЗ:** `docs/specs/086-settings-help-content-party1.md` (актуализировано 2026-08-30, зелёный SPEC-REVIEW-86-r1)
- **SHA материала:** `18ab3779980e1d22f2cdc4a6da12a4ef2c1a4df9` (`origin/dev...HEAD`, 8 коммитов: `fa031920` `5994c929` `b4c5083f` `9e559b10` `be6bd5f6` `4015f7f8` `10f441aa` `18ab3779`)
- **Трек:** полный (нарушен критерий light-track «одна поверхность», зафиксировано автором в шапке ТЗ)
- **Заход:** r2 · блокирующих циклов израсходовано 1/4 (r1 — красный)

## Почему разбор полный, а не по дельте

Между r1 (красный, материал `bd27fca1`→`c862de65`) и этим заходом ветка была
**перебазирована на ушедший вперёд `origin/dev`** (комментарий автора: «ветка
перебазирована на актуальный dev `8819e390`»; конфликт возник в
`custom_components/houseplan/frontend/**`, `dist/**`, `docs/images/**`,
`docs/CHANGELOG*.md` — то есть в сгенерированных деревьях и релизных
артефактах, задетых параллельно слитой #383). Предыдущие SHA (`bd27fca1`,
`489cc8b6`, `c862de65`, `8633187d`, `3274ac39`) не существуют в текущей истории
(git rebase их переписал), в чём я убедился лично: `git show -s <sha>` на них
даёт `fatal: ambiguous argument`. Это ровно случай PROCESS.md §2.10/§7.2 «ребейз
на ушедший вперёд dev — после ребейза это другой код», поэтому разбираю AC1–AC9
заново, а не только находки r1.

Отдельно: конвейер уже один раз пытался прогнать ревью до этого рейза и
остановился на конфликте («Ревью не запускалось» в issue) — тот заход не
состоялся и бюджет циклов не потратил (в issue это явно записано), поэтому
текущий заход законно `r2`, а не `r3`.

## Скоуп

Diff добавляет 11 согласованных Party-1 `hp-help`-подсказок в
`houseplan-editor-runtime.ts` (масштаб пространства, общий Glow-радиус, режим
заливки, роль источника света — обновлён текст пилота #68, управление другими
источниками, общий/локальный север, общий/локальный фон, стиль стен нулевой
толщины, «Показывать скрытые на плане») и дублирует 5 space-подсказок в
отдельном `houseplan-onboarding-runtime.ts`; переводит их на en/ru/de/fr;
удаляет 4 старых `.rhint`; добавляет unit-тесты инвентаря/parity/no-duplicate,
мутационный тест `settings-help-party1-placement-removed`, расширяет
`smoke_help_affordance.mjs` cold-onboarding сценарием; правит `CHANGELOG`×2,
`USER-GUIDE.ru.md`, `TESTING.md`, `docs/specs/README.md`; принимает 6
golden-эталонов (+2 не связанных с #86, для уже слитой #383) и полный
десятикадровый набор `docs/images/**` после рейза.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **H1** (High) — `docs/images/screenshots.json` подделан, PNG не пересняты | Коммит `18ab3779` заменяет **все 10** PNG (байты изменились) и все 10 `imageSha256`/`sourceSha256` в манифесте, `oxipng: null → "oxipng 10.2.0"` — признак настоящей пересъёмки через `docs:accept`, а не ручной правки JSON; трейлеры `Release:`+`Baseline-Reviewed:` со ссылкой на прогон 33306281294 | `git show 18ab3779 --stat -- docs/images/` (11 файлов, включая JSON); я лично открыл `docs/images/03-space-create.png` и `06-device-editor.png` — на обоих видны новые иконки-подсказки («Scale (grid cell size)» ⓘ, «Zero-thickness walls» ⓘ, «Controls other light sources» ⓘ) |
| **H2** (High) — `golden:verify` красный, 6 эталонов не приняты | Коммит `be6bd5f6` принимает ровно эти 6 (`device-inbox-desktop-en-light`, `device-inbox-desktop-ru-dark`, `device-inbox-narrow-ru-dark`, `toggle-entity-dialog-desktop-en`, `toggle-entity-dialog-mobile-ru`, `space-room-color-popover-desktop-ru`) + 2 несвязанных `furniture-transform-*` для #383, с `Release:`+`Baseline-Reviewed:` (прогон 33305056892) | Я прогнал `npm run golden:verify` лично на `18ab3779` (полный лог, без truncation) — `exitCode=0`, все 6 сценариев `passed`; визуально открыл `device-inbox-desktop-en-light.png`, `toggle-entity-dialog-desktop-en.png`, `space-room-color-popover-desktop-ru.png` — новые ⓘ-иконки на месте, без наложений и обрезки |
| **M1** (Medium, в скоупе) — cold-onboarding путь 5 space-подсказок не доказан исполнением | Коммит `10f441aa` добавляет в `smoke_help_affordance.mjs` реальный запуск `launchColdView()` с пустым `_serverCfg.spaces`, дожидается `_onboardingRuntime && !_editorRuntime`, проверяет инвентарь всех 5 `space.*.help`, открытие одной подсказки, read-only черновика и то, что editor runtime не подгрузился | Я прогнал `node demo/smoke_help_affordance.mjs` лично — `party1ColdOnboardingInventory/HelpOpens/HelpIsReadOnly/KeepsEditorLazy` все `true`, `checkAll` требует `true` по умолчанию (падает при `false`), `OK` |
| **L1** (Low, снят без правки) — `.help`-ключ не совпадает буквально с ключом label | Не задета рейзом и правками r1→r2, решение прежнее в силе | `space.cell_cm.help` рядом с `space.scale_label`, `space.fill_mode.help` рядом с `space.fill_label` — как и в r1 |

## Унаследовано из r1

Так как разбор в этом заходе полный (см. выше — ребейз на ушедший вперёд dev),
формально всё перепроверено заново на текущем SHA, а не унаследовано без
проверки. Из r1 без повторной **аргументации** взято только:
- сам факт, что механизм `hp-help`/`hp-dialog` (#68) не форкнут и не изменён —
  перепроверено тем же способом (`git diff` по `src/hp-help*`, `src/hp-dialog*`
  пуст) и подтверждено заново, а не принято на слово;
- список Party-1 из 11 ключей и их каноничные RU/EN тексты — сверены заново
  построчно с §6 ТЗ и с тестом `issue 86 Party 1 has the exact help inventory`.

Никакой пункт r1 не принят по одному лишь заявлению автора без собственной
проверки в этом заходе.

## Как проверялось

Дешёвые гейты Validate на `18ab3779` формально зелёные (прогон 33306392784),
но при разборе job'ов выяснилось, что тяжёлые job'ы (`Фронтенд: типы, юниты,
мутанты, синхрон бандла`, `Golden-кадры…`, `Смоки в браузере…`) там **skipped
(переиспользованы)** через `scripts/gate-reuse.mjs` — то есть Validate НЕ
прогнал их заново на этом SHA, а сверил хеш входов с прошлым успешным прогоном.
Механизм легитимный (ключ = контент-хеш `src/**`+гарнитура job'а, не имя ветки
или SHA — прочитал `scripts/gate-reuse.mjs`), но раз я это заметил, не
полагаюсь на устную переиспользованную метку и прогнал сам:

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный |
| Unit | `npm test` | 1611 тестов, 1610 pass, 1 skip (тот же приватный `#281`-фикстур-скип, что и на `origin/dev`, к #86 не относится), 0 fail |
| Build + sync | `npm run build`, `npm run bundle:sync` | ок |
| 3 копии бандла | `cmp dist/houseplan-card.js custom_components/.../houseplan-card.js`, `cmp dist/houseplan-assets.json custom_components/.../houseplan-assets.json` | идентичны (третья копия `demo/srv/assets` пересобрана тем же `bundle:sync`) |
| Bundle budget | `npm run bundle:budget` | initial View 280 304 B гзип, бюджет 300 000 — в норме |
| no-new-any | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | 119 добавленных строк в 3 файлах, новых `any` нет |
| check-docs | `node scripts/check-docs.mjs` | зелёный, и в этот раз обоснованно — см. закрытие H1 |
| Выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 12 «прямое совпадение», 18 «слабая связь» |
| Смоки прямого совпадения (12/12) | `smoke_help_affordance`, `smoke_bg_color`, `smoke_color_picker_consumers`, `smoke_device_inbox`, `smoke_dialog_zombie`, `smoke_disabled_device`, `smoke_esc_dialogs`, `smoke_gs_always`, `smoke_ha_controls`, `smoke_hidden_flag`, `smoke_motion_sense`, `smoke_sun` | все 12 зелёные, включая новый cold-onboarding блок |
| Мутационный гейт задачи | `node scripts/mutation-gate.mjs --id=settings-help-party1-placement-removed` | мутант пойман |
| **Golden** | `npm run golden:verify` (полный лог, без `tail`) | `exitCode=0`, 0 `different`/`missing`, все 6 задетых #86 сценариев `passed` |
| process-gate (офлайн) | `node scripts/process-gate.mjs` | пройден, 0 предупреждений (проверка статуса issue пропущена — нет `--issues`) |

**Что не прогонял и почему:**
- 18 «слабых связей» из `smoke-select` (общее имя `_config`) — все про
  геометрию/локали/optimize, diff их логики не касается, сигнала для
  расширения после 12/12 прямых совпадений нет;
- `python -m pytest tests_backend -q` — diff не касается
  `custom_components/**/*.py`;
- остальные ~193 браузерных смока и `performance_smoke` — задача не задевает
  геометрию/перф-чувствительные пути, полный прогон здесь избыточен (§8:
  полные наборы — предрелизный гейт);
- `model-invariants` — diff не трогает геометрию, ссылки, `layout`,
  `marker.space`, `open_spans`; неприменимо.

## Находки

### M1 — AC7 «browser zoom 200%» не доказан ничем (Medium, в скоупе)

ТЗ §13 формулирует AC7: «Узкий viewport 390 px **и browser zoom 200%** не
обрезают tooltip/trigger и не меняют stage geometry. Доказательство: smoke +
representative reviewed golden», а план автотестов §14 отдельно требует
golden «light/dark and 200% zoom; full Linux artifact review required».

Проверил оба канала:

- `grep -n "zoom" demo/smoke_help_affordance.mjs` — **пусто**: файл проверяет
  только `{ width: 390, height: 780 }` с `deviceScaleFactor=1` (2-й аргумент
  `launch`), то есть узкий viewport, но никакого 200%-zoom;
- ни один из 6 принятых в рамках закрытия H2 golden-сценариев
  (`device-inbox-*`, `toggle-entity-dialog-*`,
  `space-room-color-popover-desktop-ru`, см. `demo/golden/matrix.mjs:383-397,
  765-778, 795-797`) не задаёт zoom-эмуляцию; в матрице вообще нет ни одного
  сценария, который проверял бы party1-триггеры при 200% browser zoom
  (`large-house-zoom-250-dark` — это zoom канвы плана, а не browser-zoom
  диалога, и не про эту задачу).

Находка r1 упомянула эту часть AC7 мимоходом («200%-zoom и «reviewed golden»
часть AC7 не доказана — см. H2»), но фактическое закрытие H2 (`be6bd5f6`)
приняло именно и только эти 6 уже существовавших в плане сценариев — ни один
из них 200%-zoom не тестирует, поэтому проблема осталась ровно там же, где
была, просто перестала быть видна за красным `golden:verify`.

Прочитал добавленный CSS (`src/styles/dialogs.styles.ts`, новые
`.helpfieldlabel`, `.help-inline-label`, `.device-inbox-filter-help`): все три
класса используют `display: flex/inline-flex`, `flex-wrap: wrap`,
`min-width: 0` и `overflow-wrap: anywhere` на вложенном `<label>` — тот же
паттерн, что и уже принятый в #68 `.markerhelplabel`. Это делает вероятным, что
разметка действительно не обрезается при увеличении шрифта, но это чтение, а
не исполнение, и для новых host-классов (`.helpfieldlabel`,
`.device-inbox-filter-help`) при 200% zoom его никто — ни автор, ни
предыдущий заход — не подтвердил ни автотестом, ни golden-кадром, как того
явно требует собственное ТЗ задачи.

**Как воспроизвести:** `grep -n "zoom" demo/smoke_help_affordance.mjs` → 0
совпадений; `grep -n "zoom" demo/golden/matrix.mjs` рядом со сценариями
`device-inbox-*/toggle-entity-dialog-*/space-room-color-popover-desktop-ru`
→ 0 совпадений.

**Что нужно:** либо добавить golden-сценарий(ы) с эмуляцией 200% zoom для
одного-двух party1-диалогов (например `page.emulateMedia`/увеличенный
`fontSize`/`deviceScaleFactor`, как принято в проекте) и smoke-проверку, что
`.trigger`/label не выходят за `visualViewport`, либо явно зафиксировать в
ТЗ/тестовом плане и в этом ревью, что 200%-zoom проверяется только моим
чтением CSS — и указать, почему этого достаточно для приёмки. Само по себе
чтение CSS без исполнения я делаю сейчас как ревьюер, но AC7 в ТЗ прямо назвал
другой способ доказательства, который не выполнен.

### L1 — `.help`-ключ не совпадает буквально с ключом видимого label (Low, снимается без правки)

Унаследовано из ревью ТЗ (SPEC-REVIEW-86-r1) и CODE-REVIEW-86-r1: `space.cell_cm.help`
соседствует с `space.scale_label`, `space.fill_mode.help` — с `space.fill_label`.
Не создаёт двусмысленности контракта, тот же паттерн уже был у пилотов #68,
находится в рамках технической свободы реализации по PROCESS.md §7.1. Не задето
рейзом. Оставляю без правки.

## Что проверено и корректно

- **AC1 (инвентарь).** `grep -oE "_help\('[^']+\.help'\)"` по обоим рантаймам —
  ровно 11 Party-1 ключей плюс существующие 8 пилотных `marker.*` из #68, новых
  мест за пределами §6 нет. 5 `space.*`-ключей идентичны между
  `houseplan-editor-runtime.ts` и `houseplan-onboarding-runtime.ts` (метод
  `_help()` в обоих файлах текстуально идентичен, `src/hp-help*` не менялся).
  Доказано тестом `issue 86 Party 1 has the exact help inventory` (прогнал,
  зелёный) и мутационным гейтом `settings-help-party1-placement-removed`
  (прогнал лично — мутант пойман).
- **AC2/AC3 (канонический текст, parity).** RU/EN в `en.json`/`ru.json`
  побайтово совпадают с таблицей §6 ТЗ — сверил вручную и тестом
  `issue 86 Party 1 has the exact help inventory and canonical RU/EN copy`
  (жёсткое `assert.equal` по каждому ключу, прогнал, зелёный). DE/FR прочитаны
  целиком — передают тот же смысл без пропусков предложений. `.help.aria`
  пары присутствуют во всех 4 словарях, тест
  `i18n: every literal help call has body and full aria keys in every language`
  зелёный (теперь явно проверяет и `houseplan-onboarding-runtime.ts` через
  объединённый `helpSource`, а не только `cardSource`, как было в r1).
- **AC4 (без дублей).** `marker.controls_hint`, `gs.bg_daynight_hint`,
  `gs.north_hint`, `space.zero_wall_help` удалены из всех 4 словарей и обоих
  рантаймов — тест `issue 86 removes explanatory hints…` зелёный, `grep`
  лично подтвердил отсутствие. Текст пилота `marker.light_role.help` заменён
  каноническим (сверил `git diff` — старый текст «Controls whether this
  marker itself is a spatial light source…» заменён на текст §6 таблицы ТЗ).
- **AC5 (все поверхности).** General (`gs.glow_radius`, `gs.bg_mode`,
  `gs.north`), Space (`space.cell_cm`, `space.zero_wall_style`,
  `space.bg_mode`, `space.north`, `space.fill_mode`), Marker
  (`marker.controls.help`) и Device catalog
  (`device_inbox.show_hidden.help`) — все присутствуют в диффе шаблонов;
  открытие подтверждено `smoke_help_affordance` (`party1GeneralInventory`,
  `party1SpaceInventory`, `party1ShowHiddenHelpIsReadOnly` и т. д. — все
  `true`) и визуально — открыл `device-inbox-desktop-en-light.png`,
  `toggle-entity-dialog-desktop-en.png`, `space-room-color-popover-desktop-ru.png`,
  `06-device-editor.png`, `03-space-create.png`: везде новые ⓘ-иконки на месте
  своих полей, без наложений на соседние элементы и без обрезки.
- **AC6 (input/a11y).** Переиспользует lifecycle #68 без форка; `smoke_help_affordance`
  (прогнал, зелёный) покрывает hover/focus/click/Escape/disabled/Popover-fallback,
  включая `keyboardFocus: true`.
- **AC7 (узкий viewport 390 px).** Часть про 390 px доказана (`party1ShowHiddenHelpInsideNarrowViewport`
  в смоке, узкий golden `device-inbox-narrow-ru-dark`, `toggle-entity-dialog-mobile-ru`
  — все `passed`). Часть про 200% zoom — см. находку M1.
- **AC8 (модель не меняется).** Прочитан весь diff `src/**` (83+44+33 строк
  в трёх файлах не считая i18n) — ни одного изменения вне JSX-шаблонов, CSS и
  `_help()`-геттеров; `strictNumber`, `touchSpaceDisplay`, `@change`/`@input`
  обработчики не тронуты. `npm test` (1610/1611 pass) включает существующие
  config-serialization снапшоты — без регрессий.
- **AC9 (партии 2/3 отсутствуют).** `src/**` вне i18n просмотрен построчно —
  только `houseplan-editor-runtime.ts`, `houseplan-onboarding-runtime.ts`,
  `dialogs.styles.ts`; ни одного `_help()` вне §6 сверх уже существующих
  пилотов; в i18n нет ключей `opening.*`/`wallthick.*`/`decor.*`/`device.binding.*`
  партий 2/3.
- **Одно число — один источник.** Diff не добавляет и не меняет ни одной
  пользовательской величины — только текст подсказок и разметка; правило
  неприменимо.
- **Трейлеры и changelog.** `Issue: #86` на всех 8 коммитах; `User-Visible: yes`
  только на `b4c5083f`, в нём же правки обоих changelog; коммиты, трогающие
  `demo/golden/baselines/**` (`be6bd5f6`) и `docs/images/**` (`18ab3779`), несут
  `Release:`+`Baseline-Reviewed:` со ссылками на конкретные зелёные прогоны.
  `docs/specs/README.md` содержит строку #86 → файл спеки.
- **process-gate.mjs (офлайн).** Пройден, 0 предупреждений.

## Вывод

Все три блокирующих находки r1 (H1, H2, M1) закрыты содержательно — я лично
пересобрал бандл, прогнал `golden:verify` полным логом (не через `tail`, чтобы
не потерять реальный код возврата), запустил новый cold-onboarding смок и
открыл сами PNG глазами, а не поверил хендофф-комментариям. Контент-часть
партии 1 (11 подсказок, 4 локали, source contract, mutation-тест) корректна и
без регрессий после рейза.

Новая находка — AC7 в части «browser zoom 200%» так и не получила ни
автотеста, ни golden-кадра, ни явной записи «проверено чтением» от автора,
хотя ТЗ этой же задачи прямо называет это дважды (AC7 и план тестов §14). Я
проверил CSS чтением и паттерн выглядит безопасным (совпадает с уже принятым
в #68), но это не заменяет обещанное автором доказательство и не было
названо явно нигде в хендоффе. High-находок нет, поэтому вердикт — жёлтый, а
не красный: это находка уровня Medium в скоупе задачи, которая чинится в этом
же issue.
