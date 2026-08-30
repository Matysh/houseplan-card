# CODE-REVIEW-86-r1

- **Issue:** #86 — Тексты подсказок к настройкам, партия 1
- **ТЗ:** `docs/specs/086-settings-help-content-party1.md` (актуализировано 2026-08-30, зелёный SPEC-REVIEW-86-r1)
- **SHA материала:** `bd27fca107f61eee74d69bffeb1e15506402b6a4` (`origin/dev...HEAD`, diff трёх коммитов 97c807ba/58fb2ef5/bd27fca1)
- **Трек:** полный (нарушен критерий light-track «одна поверхность», сам автор это фиксирует в шапке ТЗ)
- **Заход:** r1 · блокирующих циклов израсходовано 0/4

## Скоуп

Diff добавляет 11 согласованных Party-1 `hp-help` подсказок (масштаб пространства,
общий Glow-радиус, режим заливки, роль источника света — обновлён текст пилота,
управление другими источниками, общий/локальный север, общий/локальный фон, стиль
стен нулевой толщины, «Показывать скрытые на плане») в `houseplan-editor-runtime.ts`
и параллельно — 5 space-подсказок в `houseplan-onboarding-runtime.ts`; переводит их
на en/ru/de/fr; удаляет 4 старых `.rhint`; добавляет unit-тесты инвентаря/parity/
no-duplicate, мутационный тест, один браузерный смок и правки трёх документов
(`CHANGELOG`×2, `USER-GUIDE.ru.md`, `TESTING.md`). Он же трогает
`docs/images/screenshots.json` (без файлов картинок).

## Как проверялось

Прогнано лично на SHA `bd27fca1` (окружение содержит Node 22 и Chromium, `npm ci`
не требовался):

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный |
| Unit | `npm test` | 1607 тестов, 1606 pass, 1 skip (тот же тест, что скипается и на `origin/dev`, к #86 не относится), 0 fail |
| Build + 3 копии бандла | `npm run build` затем `cmp dist/houseplan-card.js custom_components/.../houseplan-card.js` и `cmp dist/houseplan-assets.json custom_components/.../houseplan-assets.json` | идентичны |
| Bundle budget | `npm run bundle:budget` | initial View 280 313 B гзип, бюджет 300 000 — в норме |
| check-docs | `node scripts/check-docs.mjs` | зелёный (**но см. находку H1** — зелёный статус здесь ложноположителен) |
| Выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 12 «прямое совпадение», 18 «слабая связь» (см. ниже) |
| Смоки прямого совпадения (12/12) | `node demo/smoke_help_affordance.mjs`, `smoke_bg_color`, `smoke_color_picker_consumers`, `smoke_device_inbox`, `smoke_dialog_zombie`, `smoke_disabled_device`, `smoke_esc_dialogs`, `smoke_gs_always`, `smoke_ha_controls`, `smoke_hidden_flag`, `smoke_motion_sense`, `smoke_sun` | все 12 зелёные |
| Мутационный гейт задачи | `node scripts/mutation-gate.mjs --id=settings-help-party1-placement-removed` | мутант пойман (`node --test` покраснел, как обязан) |
| **Golden** | `npm run golden:verify` | **красный, exit 1** — см. находку H2 |

**Что не прогонял и почему:**
- 18 «слабых связей» из `smoke-select` (общее имя `_config`) — не прогонял: каждая
  из них про геометрию/локали/optimize, не про диалоги настроек, диф не касается их
  логики, и после прогона всех 12 прямых совпадений сигнала для расширения нет.
- `python -m pytest tests_backend -q` — не прогонял: diff не касается
  `custom_components/**/*.py`, backend не затронут (среда ревью к тому же не имеет
  установленного pytest — `No module named pytest`, что подтверждает отсутствие
  окружения, а не маскирует красный результат: гейт неприменим по diff).
- Остальные 193 браузерных смока — задача не задевает геометрию/логику модели
  целиком, полный прогон здесь избыточен (PROCESS §8: полные наборы — предрелизный
  гейт).
- `model-invariants` — diff не трогает геометрию, ссылки, `layout`, `marker.space`
  или `open_spans`; не применимо.
- Реальный CI Validate на этом SHA не найден зелёным — прогнал дешёвые гейты сам,
  как и предписано.

## Находки

### H1 — Манифест скриншотов документации подделан, а не пересчитан (High, в скоупе)

`docs/images/screenshots.json` в коммите `bd27fca1` меняет `sourceFingerprint`
(`d77faa6e…` → `401722…`) и все десять `sourceSha256` на то же новое значение —
но ни один PNG в `docs/images/**` в этом коммите не изменился
(`git show bd27fca1 --stat -- docs/images/` показывает только правку JSON,
0 файлов картинок). Я запустил `npm run build` и `node scripts/check-docs.mjs` на
HEAD — гейт зелёный, потому что зафиксированный `sourceFingerprint` теперь
математически совпадает с текущим `src/**`. То есть кто-то отдельно посчитал
`visualFingerprint()` и вписал результат в JSON руками, не выполнив настоящую
пересъёмку.

Это прямо запрещённый в проекте путь. `scripts/docs-accept.mjs` (единственный
легитимный писатель этого файла) копирует новые PNG из артефакта CI
`Docs screenshots` и **не может** обновить манифест без файлов: он сверяет
`imageSha256` каждого кадра с байтами кандидата и требует `--reviewed`.
Исторический прецедент в этом же репозитории — коммиты «`docs: refresh screenshot
fingerprint`» (например `b1b1e743`) — **всегда** одновременно переписывают все
десять PNG (см. `git show b1b1e743 --stat`), потому что даже визуально идентичный
кадр даёт другие байты при пересъёмке (комментарий в `docs-accept.mjs` объясняет
это явно). Здесь PNG не тронуты вовсе — списанный ярлык не соответствует
содержимому.

Хуже того, содержимое двух сценариев из этого манифеста **действительно
устарело**: `space-create` (`fixture: 'empty'` → `card._openSpaceDialog('create')`
→ рендерится ровно тот `_renderSpaceDialog()` из
`houseplan-onboarding-runtime.ts`, куда этот diff добавил 5 подсказок) и
`device-editor` (`dialog: 'device'` → маркер-диалог, где `marker.controls_label` +
`.rhint` заменены на `helpfieldlabel` с новой иконкой) должны показывать новые
значки подсказок — а показывают старую картинку без них. Спецификация §17 прямо
требует «актуальные screenshots» как release-артефакт; вместо этого CI-гейт
`docs` обманут значением, которое ему не принадлежит.

**Как воспроизвести:** `git show bd27fca1 --stat -- docs/images/` → 0 изменённых
`.png`; `git show b1b1e743 --stat` → для сравнения, легитимный рефреш всегда меняет
все 10 файлов.

**Что нужно:** прогнать GH Actions `Docs screenshots` (`workflow_dispatch`),
скачать артефакт, `npm run docs:accept -- --reviewed --from=<artifact>`, отдать
на ревью человеку и закоммитить обновлённые PNG вместе с манифестом. Понижать
трек до «просто поправить фингерпринт» — то самое сокрытие, которое AGENTS.md
называет запрещённым по отношению к golden-эталонам и что не менее верно для
docs-скриншотов.

### H2 — `npm run golden:verify` красный: 6 эталонов расходятся с рендером (High, в скоупе)

Прогнал `npm run golden:verify` на `bd27fca1`: `exitCode=1`. Расхождения:

```
different   device-inbox-desktop-en-light
different   device-inbox-desktop-ru-dark
different   device-inbox-narrow-ru-dark
different   toggle-entity-dialog-desktop-en
different   toggle-entity-dialog-mobile-ru
different   space-room-color-popover-desktop-ru
```

Все шесть напрямую объясняются этим diff'ом, не совпадением имени символа:

- `device-inbox-*` — сценарии `dialog: 'device-inbox'` (`demo/golden/matrix.mjs:383-392`)
  снимают ровно тот блок, где чекбокс «Показывать скрытые на плане» обёрнут в
  новый `<span class="device-inbox-filter-help">` с триггером
  `device_inbox.show_hidden.help` (`houseplan-editor-runtime.ts:11815-11825`).
- `toggle-entity-dialog-*` — сценарии `dialog: 'device'` для `golden-washer`
  (`matrix.mjs:765-778`) открывают тот же маркер-диалог, где
  `marker.controls_label` + постоянный `.rhint` заменены на
  `<div class="helpfieldlabel">` с триггером `marker.controls.help`
  (`houseplan-editor-runtime.ts:12588-12592`) — сдвиг разметки докатывается вниз до
  `toggle_entity`-секции того же диалога.
- `space-room-color-popover-desktop-ru` — сценарий `dialog: 'space-room-color'`
  (`matrix.mjs:795-797`) открывает попап цвета комнаты в диалоге пространства,
  выше которого теперь стоит новый `helpfieldlabel` для `space.fill_mode.help`.

Ни один `demo/golden/baselines/**` файл в diff'е не менялся
(`git diff --stat origin/dev...HEAD -- demo/golden/` — пусто), значит эти шесть
эталонов не пересматривались вовсе. Хендофф-комментарий автора в issue
(«Проверки: npm test… smoke_help_affordance… mutation… docs и bundle budget — OK»)
`golden:verify` не упоминает — гейт не прогонялся.

Отдельно (не блокирует и не относится к #86): `furniture-transform-light/dark` —
`missing-baseline`, но baseline для них отсутствует в дереве и на `origin/dev` тоже
— унаследованный, не внесённый этим diff'ом пробел, к задаче не относится.

**Как воспроизвести:** `npm run bundle:sync && npm run golden:verify` на
`bd27fca1` → `EXIT=1`, шесть `different`.

**Что нужно:** просмотреть `artifacts/golden/diff/{device-inbox-*,
toggle-entity-dialog-*, space-room-color-popover-desktop-ru}.png`, убедиться, что
новая раскладка — то, что задумано (правдоподобно, раз это ровно новые триггеры
подсказок), и принять через `npm run golden:accept -- --reviewed` на полном
Linux CI-артефакте. ТЗ §14 прямо планировал «Golden: general settings and space
dialog with help open… full Linux artifact review required» — этот пункт плана
не выполнен, а не просто пропущен по недосмотру мелочи.

### M1 — Onboarding-путь 5 space-подсказок не доказан исполнением (Medium, в скоупе)

ТЗ §8 требует: «Пять space-подсказок присутствуют и в обычном editor runtime, и в
отдельном onboarding runtime… их текст и поведение идентичны», а §14 планирует
браузерный смок «по одному placement на… space». `demo/smoke_help_affordance.mjs`
целиком работает через обычный редактор (`card._openSpaceDialog('edit', card._space)`),
и ни один смок/golden не открывает cold-onboarding путь
(`_openSpaceDialog('create')` при пустом `_serverCfg.spaces`), который ведёт в
`HouseplanOnboardingRuntime._renderSpaceDialog()` с отдельной, скопированной
реализацией `_help()` (`houseplan-onboarding-runtime.ts:54-60`). Единственная
проверка, которая реально открывала бы этот путь в браузере — сценарий
`space-create` документационных скриншотов — сам оказался несвежим (H1).
Статический regex-тест в `test/i18n.test.mjs` (`helpSource` = конкатенация двух
файлов) доказывает только, что строка `this._help('space.xxx.help')` присутствует
в исходнике `houseplan-onboarding-runtime.ts`, а не что она реально рендерится,
не мутирует `_spaceDialog` и работает мышью/клавиатурой/тапом в этом отдельном
компоненте.

Прочитал код: `_help()` в онбординге текстуально идентичен варианту в
`houseplan-editor-runtime.ts`, импорт `./hp-help` добавлен, сигнатура и порядок
аргументов совпадают — на вид рабочий. Но это «проверено чтением, не
исполнением», а не автотест, и явно заявленного как такового в
`docs/reviews`/handoff нет. Учитывая, что H1 обесценил единственный кандидат на
исполняемое доказательство, AC5/AC7 для onboarding-поверхности сейчас не доказаны
никак, кроме моего чтения.

**Что нужно:** либо добавить в `demo/smoke_help_affordance.mjs` (или отдельный
файл) сценарий, открывающий `_openSpaceDialog('create')` из пустого состояния и
повторяющий read-only/inventory проверки для всех пяти onboarding-триггеров, либо
явно зафиксировать в ТЗ/тестовом плане, что onboarding-путь покрывается только
docs-скриншотом — и тогда почему это допустимо. Совместно с H1 естественно
чинится одним заходом: настоящая пересъёмка `space-create` подтвердит хотя бы
рендер, а отдельный смок — поведение.

### L1 — `.help`-ключ не совпадает буквально с ключом видимого label (Low, снимается без правки)

Унаследовано из ревью ТЗ (SPEC-REVIEW-86-r1): `space.cell_cm.help` соседствует с
`space.scale_label`, `space.fill_mode.help` — с `space.fill_label`. Не создаёт
двусмысленности контракта, тот же паттерн уже был у пилотов #68, находится в
рамках технической свободы реализации по PROCESS.md §7.1. Оставляю без правки.

## Что проверено и корректно

- **AC1 (инвентарь).** `grep -oE "_help\('[^']+\.help'\)"` по обоим рантаймам даёт
  ровно 11 Party-1 ключей плюс уже существующие 8 пилотных `marker.*` ключей из
  #68 — новых мест за пределами §6 нет. Пять `space.*`-ключей продублированы
  один-в-один в `houseplan-onboarding-runtime.ts`. Доказано и чтением, и тестом
  `issue 86 Party 1 has the exact help inventory` (`test/i18n.test.mjs`) — тест
  запускался (`npm test`, зелёный) и умеет падать: мутационный гейт
  `settings-help-party1-placement-removed` подтверждает (прогнал лично).
- **AC2/AC3 (канонический текст, parity).** RU/EN тексты в `en.json`/`ru.json`
  побайтово совпадают с таблицей §6 ТЗ — сверил вручную все 11 строк. DE/FR
  прочитаны целиком (см. выдержку выше) — передают тот же смысл, не пропускают
  предложений. `.help.aria` пары присутствуют во всех 4 словарях, тест
  `i18n: every literal help call has body and full aria keys in every language`
  прогонялся и прошёл.
- **AC4 (без дублей).** `marker.controls_hint`, `gs.bg_daynight_hint`,
  `gs.north_hint`, `space.zero_wall_help` удалены из всех 4 словарей и из обоих
  рантаймов — подтверждено тестом `issue 86 removes explanatory hints…` (прошёл)
  и `grep` лично.
- **AC6 (input/a11y).** Переиспользует lifecycle #68 без форка
  (`import './hp-help'`, тот же `_help()` контракт); `smoke_help_affordance.mjs`
  (прогнал, зелёный) покрывает hover/focus/click/Escape/disabled/Popover-fallback
  для нового содержимого партии наравне со старым пилотом.
- **AC7 (узкий viewport 390 px).** `party1ShowHiddenHelpInsideNarrowViewport` в
  смоке проверяет геометрию попапа в 390 px — прошло. 200%-zoom и «reviewed
  golden» часть AC7 не доказана — см. H2.
- **AC8 (модель не меняется).** Прочитан весь diff `src/**` — ни одного изменения
  вне JSX/CSS шаблонов и двух новых `_help()`-методов; `strictNumber`,
  `touchSpaceDisplay`, обработчики `@change`/`@input` не тронуты. `npm test`
  (1606/1607 pass) включает существующие config-serialization снапшоты — без
  регрессий.
- **AC9 (партии 2/3 отсутствуют).** Diff `src/**` просмотрен построчно — нет ни
  одного `_help()` вне §6 сверх уже существующих `marker.*` пилотов; в i18n-файлах
  нет добавленных ключей `opening.*`, `wallthick.*`, `decor.*`,
  `device.binding.*` и т. п. из партий 2/3.
- **Гейты общего назначения.** typecheck/test/build/bundle-sync/bundle-budget/
  check-docs (формально) — все зелёные, три копии бандла идентичны.
- **Одно число — один источник.** Diff не добавляет и не меняет ни одной
  пользовательской величины (только текст подсказок) — правило неприменимо.
- **Трейлеры.** `Issue: #86` на всех трёх коммитах; `User-Visible: yes` в
  `bd27fca1` — оба changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правлены
  в этом же коммите, формулировки на месте.

## Вывод

Контент-часть партии 1 (11 подсказок, переводы, source contract, mutation-тест)
выполнена аккуратно и проходит собственные unit- и smoke-гейты. Но два
предрелизных для видимого рендера гейта, обязательных именно для этой задачи —
`docs`-скриншоты и `golden` — либо подделаны (H1), либо действительно красные и
не прогонялись (H2). Оба находятся в скоупе issue (сам diff их и ломает) и
требуют настоящей пересъёмки/приёмки, а не текстовой правки. Пока это не сделано,
вердикт не может быть даже жёлтым.
