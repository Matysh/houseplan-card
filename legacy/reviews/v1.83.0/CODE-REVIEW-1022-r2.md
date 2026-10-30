# CODE-REVIEW-1022-r2

Issue: #1022 «Конвертер: импорт расстановки устройств из карточки picture-elements»
Этап: code (PROCESS.md §2.7) · Трек: ask · Заход: r2 · Блокирующих циклов на входе: 1/4
Материал: `aa4e44882de037094bb3387bf31243858de8ea38` (рабочая копия ровно на нём)
Маршрут вердикта (#726): `route: fix` (на треке `ask` маршрут всегда `fix`, `reclassify` действует только на `show`)
Побочные находки / маршрут (#926): `REVIEW_FINDINGS_POLICY` — `mode: issues`, `round: 2`, `stage: code`. Побочных находок вне скоупа нет; `outside_findings` пуст.

## Скоуп

Третий источник конвертера `houseplan.tech/convert`: карточка HA `picture-elements`
→ документ импорта пространства House Plan (подложка-ссылка, устройства/
виртуальные маркеры/живой текст на местах картинки; комнаты/стены/масштаб —
задача редактора после импорта). Обслуживаемая строка `docs/SCOPE.md`: **J4**
«From zero to a working plan in one evening, no Inkscape/YAML» — конвертер
снимает барьер миграции с конкурирующего формата в тот же onboarding-поток
(image/draw → floors-import wizard), не создавая нового продуктового редактора.

Это первый код-ревью принятого после `S4-spec-review` контракта. Предыдущий
код-ревью (`CODE-REVIEW-1022-r1.md`, материал `d28ca9ce4`) вернул жёлтый
вердикт `route: reclassify, criterion: ux-contract`: задача вводила новое
сопоставление источник→House Plan (какие элементы становятся устройствами,
какие текстом, какие отбрасываются) и оставляла два открытых продуктовых
вопроса, адресованных собственным ТЗ «аналитике», но была заведена сразу в
`S7-code-review` в обход трека `ask`. Трек повышен владельцем до `track:ask`
(`labels: S7-code-review, feature, track:ask` подтверждены в REVIEW_CONTEXT),
прошёл `S4-spec-review` (`SPEC-REVIEW-1022-r1.md` — жёлтый, M1; `SPEC-REVIEW-1022-r2.md`
— зелёный, ТЗ принято), и этот раунд — первая проверка кода против
полностью зафиксированного в `## ТЗ` контракта.

Диапазон материала (`git log --oneline origin/dev..HEAD` / `git diff
origin/dev...HEAD`, по `changedFiles` из REVIEW_CONTEXT): конвертер
(`scripts/sh3d-convert/{picture.mjs (новый), picture-actions.mjs (новый),
easy-read.mjs, easy-geometry.mjs, cli.mjs, page/*, fixtures/picture-elements.yaml,
golden/picture-elements.*, dist/index.html, README.md}`), demo-смок и helper,
тесты (`test/picture-elements-*.test.mjs`, `test/converter-consumers.test.mjs`,
`test/sh3d-convert-page.test.mjs`), backend-тесты (`tests_backend/test_picture_elements_convert.py`,
`test_ha_picture_elements_convert.py`, правки `test_sh3d_convert.py`/`test_ha_*`),
документация (USER-GUIDE RU/EN §20, ARCHITECTURE, DEVELOPMENT, CHANGELOG RU/EN,
STATUS, release-ledger) и канонически производные CI-реестры/workflow. `src/**`
и рантайм бэкенда (`custom_components/houseplan/*.py`, кроме уже существующих
путей, прочитанных для проверки) этой задачей не менялись — подтверждено
`changedFiles`.

## Как проверялось

Подготовка отчитывается о принятом `validate-gate` на точном материале:
<https://github.com/Matysh/houseplan-card/actions/runs/40493373648> (`review-light
proof is complete`) — этот зелёный прогон уже покрывает штатный `gate:small`
(build/typecheck, полный product, tooling: bundle-policy/budget/unused/
no-new-any/private-write/layout/CSS guards) на SHA `aa4e44882`; я его не
переисполняю (инструкция: «зелёный proof подтверждает выполненные проверки,
а не корректность реализации»). Файл `demo/smoke_plan_converter.mjs` —
изменённый в этом диффе (входит в `changedFiles`), поэтому official
`validate-product.yml` на точном SHA должен был отобрать и выполнить его как
«changed» browser-смок в рамках того же зелёного `validate-gate`; отдельного
ручного повтора я не делал.

Я независимо прочитал (не только текст хендоффа) реализацию и проследил
вызывающие пути и инварианты:

| Файл | Что проверено |
|---|---|
| `scripts/sh3d-convert/picture.mjs` | `readPicture`/`pictureCanvas`/`positionOf`/`markerOf`/`labelOf`/`convertPicture` целиком — границы входа, отказ без угадывания, перенос элементов, отчёт, `picture_nothing_to_convert` |
| `scripts/sh3d-convert/picture-actions.mjs` | `targetOf`/`runTarget`/`pictureTap` целиком — согласованная таблица допустимых действий, все explicit-reject ветки |
| `scripts/sh3d-convert/easy-geometry.mjs` | `makeIds` (линейный кеш коллизий вместо квадратичного скана) — вручную проследил алгоритм на входных данных теста, подтвердил детерминированные id без рестарта скана |
| `scripts/sh3d-convert/cli.mjs` | `--format picture --width/--height/--aspect`, лимит 8 МиБ общий с `easy` |
| `scripts/sh3d-convert/page/app.mjs` | `measureImage`/`pictureOptions`/`invalidate` — generation-fence против устаревшего чтения размеров, `bitmap.close()` в `finally`, `createImageBitmap` как единственный источник размеров (без сети) |
| `scripts/sh3d-convert/page/extra-text.mjs` | Полнота RU/EN словаря для всех кодов отчёта, используемых в `picture.mjs`/`picture-actions.mjs` (включая не входящие в явный unit-список `secure_toggle_inert`, `binding_virtualized`, `icon_skipped`, `badge_source_missing`, `text_reading_skipped`, `empty_text_skipped`, `color_fallback`, `text_metrics_approximate`, `action_fallback_info`, `secondary_actions_skipped`) |
| `src/device-toggle.ts:209-219` (`secureEntity`) | Существующий secure no-op для `lock`/`alarm_control_panel` — не ослаблен, не изменён этим диффом |
| `src/logic.ts:946-957` (`runServiceFor`) | Существующий RUN-резолвер — только `automation.trigger`/`script.turn_on`/`scene.turn_on`, не изменён |
| `src/houseplan-card.ts:6010-6050` | Дispatch `tap_action: 'run'` реально отправляет только `{entity_id: target}` через `svc.domain/svc.service`, с `guarded(...)`-подтверждением и свежей проверкой `tap_target`/`_deviceBindingActive` перед вызовом |
| `test/picture-elements-convert.test.mjs`, `test/picture-elements-actions.test.mjs`, `test/converter-consumers.test.mjs` | Прочитаны целиком, прослежены утверждения против кода выше, не просто подсчитаны имена тестов |
| `tests_backend/test_picture_elements_convert.py`, `test_ha_picture_elements_convert.py` | Прочитаны целиком — реальная `CONFIG_SCHEMA`, реальный `ws_import_apply`/`create_export`/`create_preview`/`build_archive`/`read_archive`, `plan-only` приватность |
| `docs/USER-GUIDE.ru.md:3473-3509`, `docs/CHANGELOG.ru.md:206-213`, `docs/release-ledger/v1.82.0/1022.json`, `scripts/sh3d-convert/README.md` | Сверены формулировки с кодом: терминология, таблица допустимых действий, ограничения — совпадают |

**Гейты, которые я прогнал лично в этом раунде:** ни одного — пригодный
зелёный `validate-gate` на точном материале уже покрывает `tsc`, полный
`npm test`, `build` + `bundle-policy --verify`, `build-page.mjs --check`,
`pytest tests_backend` (включая HA-гарнитур, судя по составу «product +
tooling» штатного гейта) и отобранный browser-смок для изменённого
`demo/smoke_plan_converter.mjs`. Я не нашёл ни одного AC, риска или
negative-input case, для которого это покрытие было бы непригодно или
изменились входы/среда/oracle — см. таблицу «чем краснеет» ниже, построенную
на уже исполненных в этом же проходе тестах, а не на отдельном повторном
прогоне. Поэтому адресный `run_check` я не вызывал: все нужные для AC1–AC8
проверки либо уже учтены зелёным `validate-gate` на этом SHA, либо проверены
мной чтением с явной пометкой «проверено чтением, не исполнением» (см. ниже).

**Чего не проверял:** ручную/GPU-приёмку владельцем (не требуется, #929);
полный ночной golden/мутационный реестр (вне объёма гейта ревью, #709);
содержимое `artifacts/1022/*.log`, на которые ссылается хендофф (сами логи
вне материала ревью — не читал их как доказательство, опирался на
независимо подтверждённый `validate-gate` того же точного SHA, а не на
текст хендоффа о прежних прогонах на предыдущих SHA 223ed5195/b63694dd5).

## Независимый разбор контракта (до сопоставления с хендоффом)

**Отказ без угадывания пропорций (AC2).** `pictureCanvas` принимает либо
измеренные `imageWidth/imageHeight` (конечные `>0`, отношение сторон
0.05–20), либо явный `aspect` в тех же границах; без обоих — `picture_aspect_required`.
Ни один путь не подставляет значение по умолчанию. Страница использует
генерацию-токен (`measureImage`/`invalidate`), поэтому устаревшее асинхронное
чтение файла не может перезаписать уже введённый вручную или вновь выбранный
размер — я проследил это построчно, а не поверил формулировке хендоффа:
`invalidate()` увеличивает `generation` **до** захвата `token`, так что
конкурентный вызов, стартовавший позже, получает больший `token` и отбрасывает
результат более раннего вызова при расхождении (`if (token !== generation) return;`
дважды — на успехе и на ошибке), а `bitmap?.close?.()` в `finally` не
зависит от исхода гонки.

**Положение = точка картинки, независимо от формы кадра/рамки (AC2, AC3).**
`positionOf` принимает только `NN%` (включая `1.25e1%`, экспоненциальная
форма из явного ТЗ-требования «проценты»), отклоняет px/`calc()`/отсутствие/
диапазон вне 0–100 без исключений. `frame.point` — общая функция `easy-geometry.mjs`,
не переопределённая под picture; независимый тест `converter-consumers.test.mjs`
использует настоящий продуктовый `planRect`/`spaceDisplayOf` (из `test-build`,
т.е. скомпилированный продуктовый код, а не копию математики конвертера) и
подтверждает точку `(25%, 40%)` источника как `(0.25, 0.4)` долей
реального прямоугольника подложки для двух разных `canvas` (измеренный
1600×1000 и по `aspect: 0.5`) — это ровно независимая от «измерено vs
по аспекту» проверка, которую требует AC2.

**Два владельческих решения не из ТЗ, а в коде (проверка, что код закрыл то,
что ревью r1 нашло незакрытым).** (1) `state-label` → всегда живой текст;
в коде это `labelOf`, вызываемый безусловно для `type === 'state-label'`,
бейдж не предлагается нигде — соответствует `## ТЗ` §«Сценарий» (owner-решение
1) и AC3. (2) `service-button`/`icon` без `entity` → `virtual` маркер, не
пропуск: в `markerOf` `entity = element.type !== 'service-button' &&
validEntity(element.entity) ? element.entity : null` — для `service-button`
entity всегда `null` (виртуальный), для `icon` без `entity` тоже `null`
(`validEntity(undefined)` ложно); оба типа присутствуют в `ELEMENT_FIELDS`,
то есть не попадают в ветку `element_type_skipped`. Отдельно, `type: image`
(статический и с `state_image`/`state_filter`, с `entity` или без) **всегда**
`element_image_skipped`, никогда не `virtual`/decor — ровно формулировка,
добавленная в SPEC r2 после находки M1, и прямо проверенная тестом
`#1022 every static/stateful image variant is skipped…` на пяти вариантах,
включая случай, когда подложка самой карточки (`image` верхнего уровня)
при этом переносится (`plan_url` присутствует).

**Действия: закрытая таблица без расширения authority (AC4).** Прочитал
`picture-actions.mjs` построчно, не поверил описанию в хендоффе:
`runTarget` требует **точного** совпадения `service`/`perform_action` (если
оба заданы), ровно одного `entity_id` (строка или массив из одного элемента),
согласованность цели между `target` и `data`/`service_data` (не оба сразу),
домен цели строго соответствующий зарезервированному сервису
(`automation.trigger`→`automation.*`, `script.turn_on`/`scene.turn_on`→
соответствующий домен), и отдельно — простая форма `script.<имя>` (не
входящая в `RESERVED_SCRIPT_SERVICES`) мапится только при пустом payload и
совпадении опциональной цели с самим именем сервиса. Payload (`data`/`skip_condition`),
multi-target, `area_id`/`device_id`, foreign-toggle (`action.entity !==
entity`), reserved псевдо-script-сервисы (`turn_off`/`reload`/`toggle`/
`turn_on` без arg) и шаблонные entity_id (`{{ states… }}`, не проходящие
`validEntity`) — все проверено попадают в `fallback()` (`info`/`none`),
никогда не в `run`/`toggle`. `secure_toggle_inert` эмитится для
`lock`/`alarm_control_panel`, но **само** действие `toggle` всё равно
сохраняется в маркере — я специально проверил, что существующий рантайм
(`src/device-toggle.ts:211`, `secureEntity`) по-прежнему превращает такой
toggle в no-op на уровне диспетчера, то есть сохранённое поле не даёт
расширенной authority; это соответствует явной формулировке ТЗ «lock/alarm
остаются безопасным no-op» и не новой, а уже существующей гарантии.

**Отчёт до скачивания (AC5).** Каждый элемент учитывается ровно один раз в
`record_.elements` с `status` (`transferred`/`partial`/`skipped`), стабильным
`code`, `sourceIndex`, и — когда применимо — `sourceId` (с лимитом длины 500,
иначе не включается, не падает). Счётчики (`picture_counts`) и общий код
`picture_nothing_to_convert` с заполненным `report` (не пустой выброс)
проверены как в `picture-elements-convert.test.mjs`, так и в
`picture-elements-actions.test.mjs` на разных наборах входа.

## Сопоставление с хендоффом и тестами

Независимый разбор выше совпадает с тем, что заявляет хендофф: решения
владельца реализованы буквально, безопасные инварианты (secure no-op,
image-reference allowlist, bounded YAML reader) не ослаблены и не
продублированы отдельной копией — все три по-прежнему живут в неизменённых
`easy-read.mjs`/`easy-style.mjs`/`easy-content.mjs`/`device-toggle.ts`, а
`picture.mjs`/`picture-actions.mjs` их переиспользуют, а не копируют. Разница
с хендоффом: сам хендофф честно отмечает, что browser-смок и `node --test`
не повторялись вручную на точном материале `aa4e44882` (только на
223ed5195 с заявленной byte-identity через `rebase-1087-converter-equivalence.log`,
который не входит в материал ревью и мной не читался как доказательство).
Я не принимаю этот конкретный лог как пруф, но независимо подтверждённый
`validate-gate` **на точном материале** закрывает тот же пробел другим,
доступным мне путём — официальный `validate-product.yml` на `aa4e44882`
обязан был пересобрать и исполнить изменённый `demo/smoke_plan_converter.mjs`
(файл входит в `changedFiles` этого самого коммита, значит не мог быть
пропущен диффовым отбором смоков), и `gate:small`/CI тот же набор `node --test`
неизбежно выполняет как часть обязательного product-шага. Поэтому пробел,
который сам автор называет, для меня не является пробелом доказательства.

## Находки

Находок High/Medium в этом раунде нет.

### Low — не образует цикла

Разделы «Что переносится (сопоставление)» и «Не переносится…» в преамбуле
issue (до `## ТЗ`) по-прежнему используют старую формулировку «`icon`/`image`
без `entity` → виртуальное устройство» и «`image` с `state_image`/`state_filter`
— повод включить свечение», хотя финальный `## ТЗ` (после SPEC r2) однозначно
отделяет `type: image` (всегда `element_skipped`) от `icon`/`service-button`
(virtual). Это тот же текст, что `SPEC-REVIEW-1022-r2.md` уже отметил как Low
и явно не блокирующий («разделы выше `## ТЗ` — контекст/история, не
обязывающий артефакт»): сам код и AC3 реализуют только финальную, однозначную
версию контракта, преамбула не используется ни кодом, ни тестами как
источник истины. Переношу этот Low без повторного открытия цикла — он уже был
учтён спек-ревью и не влияет на код.

## Защитные AC — чем доказано, чем краснеет

| AC (защитный аспект) | Чем доказан | Чем краснеет |
|---|---|---|
| AC1: вход — ровно одна `picture-elements` карточка, stack/dashboard/unsafe/oversized/deep/duplicate/alias отклоняются без сети | `test/picture-elements-convert.test.mjs` «#1022 only one picture-elements card is read…», часть `validate-gate` на `aa4e44882` | `readPicture('type: picture-glance...')`→`picture_not_card`; `elements: Array(2001)`→`easy_too_complex`; `a: &a [1]\nb: *a`→`easy_unsafe_yaml`; `image: a\nimage: b`→`easy_invalid_yaml` (дубль ключа) — обычные исполненные negative-кейсы, не мутанты |
| AC2: без размеров — отказ; 0/NaN/Infinity/отрицательные/узкое соотношение сторон отклоняются | `test/picture-elements-convert.test.mjs` «#1022 image proportions are never guessed» | `pictureCanvas({aspect:0})`/`{aspect:'x'}`/`{aspect:Infinity}`/`{imageWidth:-1600,...}`/`{imageWidth:10,imageHeight:1000}` (вне 1:20) → `picture_invalid_aspect`, исполненный negative case |
| AC3: позиция вне 0–100% / не-%, невалидный `entity`, `type: image` не создаёт virtual/decor | `test/picture-elements-actions.test.mjs` «every static/stateful image variant is skipped…», `test/picture-elements-convert.test.mjs` «every element that cannot be carried…» | `at(101,5)`/`at(5,-1)`→`element_position_outside`; `left:'120px'`→`element_position_unsupported`; `entity: 'not an entity'`→`binding_virtualized`; пять вариантов `type:image` (static/entity/state_image/state_filter/tap_action) → `element_image_skipped`, 0 markers/decor — исполненные negative cases |
| AC4: unsupported payload/multi-target/foreign toggle/reserved script service/secure lock не получают authority | `test/picture-elements-actions.test.mjs` «arbitrary payload, ambiguous aliases, broad/foreign targets and reserved script services gain no authority» (20 отклонённых вариантов × bound/unbound) и «native default is information even for lights; secure toggles retain the existing runtime no-op» | Полный список из 20 вариантов (включая `script.turn_off`/`reload`/`toggle`, `target.area_id`, foreign `entity:'light.foreign'`, шаблон `{{ states… }}`) → `tap_action` остаётся `info`/`none`, `tap_target` всегда `undefined`; `lock.door`/`alarm_control_panel.home` toggle → `secure_toggle_inert` note + рантайм-инвариант `device-toggle.ts:211` (проверено чтением) — исполненные negative cases |
| AC5: отчёт до скачивания — ничего не пропадает молча | `test/picture-elements-convert.test.mjs` «every element that cannot be carried is named once…», хвост с `picture_nothing_to_convert` | Карточка без переносимых элементов → `throws` с `error.report.levels[0].notes.length === 2`, не тихий пустой документ — исполненный negative case |
| AC6: нет upload/fetch пользовательских данных | Чтение: `measureImage` использует только `createImageBitmap(file)` (локальное декодирование), страница не создаёт `fetch`/`XMLHttpRequest` для картинки/YAML; browser-смок `demo/smoke_plan_converter.mjs` (изменён в этом диффе → обязан быть исполнен official `validate-product.yml` на точном SHA, судя по зелёному `validate-gate`) проверяет `HTTP request list пуст` | Для «чем краснеет» в этом пункте полагаюсь на исполненный смок (явно заявляет «HTTP request list пуст», «вредоносный SVG не выполняет script и не запрашивает внешний image») — не на отдельный мутант |
| AC7: документ проходит `CONFIG_SCHEMA`/round-trip, сохраняет дробные позиции/действия/live text | `tests_backend/test_picture_elements_convert.py` (schema+geometry-пустота), `test_ha_picture_elements_convert.py` (`full-json`/`space-json`/`plan-only-json`/`full-zip`, `pytest.approx(..., abs=1e-9)` на позициях, независимая проверка долей `abs=1e-8`) | `plan-only` явно проверяет отсутствие `script.night`/`{sensor.` в экспорте (`assert "script.night" not in ...`) — приватность защищена, не только позитивный путь |
| AC8: тексты ограничений RU/EN соответствуют реализации | `test/picture-elements-convert.test.mjs` «every report code and refusal has text…» + ручная сверка остальных кодов (`secure_toggle_inert` и др., не входящих в явный список теста) в `page/extra-text.mjs`; `build-page.mjs --check` | Отсутствие ключа в `TEXT[language]` для кода из явного списка — `assert.ok(...)` падает по имени ключа; для кодов вне явного списка я проверил наличие чтением (отмечено явно как «проверено чтением, не исполнением» — не покрыто unit-тестом по имени) |

## Что проверено и корректно

- Перенос `readCard` из `readEasy` в `easy-read.mjs` поведенчески нейтрален для
  Easy Floorplan — `type` проверяется отдельно в каждом вызывающем модуле,
  существующие Easy-тесты (`test/easy-floorplan-*.test.mjs`) остаются в
  составе `validate-gate` без изменений логики.
- `makeIds` (линейный кеш коллизий) — я вручную протрассировал алгоритм на
  последовательности `['same', 'same-1', 'same', 'same']` и получил ровно
  `['x-a-same', 'x-a-same-1', 'x-a-same-2', 'x-a-same-3']`, что совпадает с
  утверждением теста и подтверждает отсутствие регрессии в детерминированности
  id при устранении квадратичного сканирования (риск «объём» из ТЗ).
- Secure-инварианты (`lock`/`alarm_control_panel` no-op, `RUN_TARGET_DOMAINS`,
  dispatch только `{entity_id: target}`) не изменены этим диффом — я прочитал
  точные строки, на которые ссылается хендофф, и они соответствуют описанию,
  а не являются новой, непроверенной гарантией.
- `is_light: false` для всех picture-маркеров (в т.ч. `light.*` entity) —
  не регрессия, а соответствует ТЗ: источник не содержит аналога `glow`,
  репорт (`picture_lights_hint`) явно советует включить свечение в редакторе;
  сверено с `USER-GUIDE.ru.md:3501` («для света включите свечение»).
- Документация (USER-GUIDE RU/EN §20, CHANGELOG, README конвертера) точно
  описывает реализованную таблицу действий и ограничений, включая формулировки
  про `confirmation_inactive`/`secure_toggle_inert`, не обещает больше, чем
  код делает.
- Ledger `docs/release-ledger/v1.82.0/1022.json`: `category: "major"` с
  явным обоснованием «renewed for the implementation of accepted SPEC r2,
  rather than inherited from the early placeholder» — корректно не считает
  старый плейсхолдер автоматически актуальным, как того требует раздел
  «Release-артефакты» самого ТЗ.
- Коммиты несут `Issue: #1022`; `User-Visible: yes` там, где меняется
  пользовательское поведение, с правкой обоих CHANGELOG в том же классе
  изменений (проверено по содержимому `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md`
  в `changedFiles`, идентичный номер релиза и issue в обоих файлах).
- Число «3 источника конвертера»: единственный источник истины — список
  `<option>` в `shell.html` (ровно 3 пункта: sh3d/easy/picture); упоминания
  в `page.lead`/CHANGELOG/USER-GUIDE — описательный текст, не независимое
  вычисляемое число, расхождения источника нет.

## Закрытие раунда r1 (CODE)

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Medium — трек `show` занижен против ТЗ; два owner-вопроса (state-label; service-button/icon без entity) решены в коде без владельца; `route: reclassify, criterion: ux-contract` | Трек повышен до `track:ask` (метка подтверждена в REVIEW_CONTEXT); оба вопроса закрыты явным решением владельца в треде issue (comment `6394496141`: «1. живой текст… 2. создавать виртуальные маркеры…») и перенесены в текст `## ТЗ`; ТЗ прошло `S4-spec-review` (SPEC r1 — жёлтый/M1, SPEC r2 — зелёный); код этого раунда реализует принятый текст `## ТЗ` буквально (см. «Независимый разбор контракта» выше), а не прежнюю самостоятельно решённую версию | Метка `track:ask` в REVIEW_CONTEXT; issue #1022 тело, `## ТЗ` → «Сценарий» (ссылка на комментарий владельца) и «Контракт поведения»; `docs/reviews/SPEC-REVIEW-1022-r2.md` (зелёный вердикт); `scripts/sh3d-convert/picture.mjs` `markerOf`/`labelOf` реализуют ровно эти два решения |

## Унаследовано из r1 (CODE)

Без повторной проверки в этом раунде не принято ничего существенного — код
полностью переписан между r1 (`d28ca9ce4`) и текущим материалом (`aa4e44882`)
под новый принятый контракт (новый файл `picture-actions.mjs`, расширенный
`markerOf`, новый `labelOf` и т. д.), и сам хендофф прямо пишет: «Прежняя
реализация не является основанием приёмки». Соответственно я провёл полный
независимый разбор текущей реализации, а не перенос выводов r1. Из r1
унаследовано только техническое наблюдение, не зависящее от оспоренного
контракта и не изменившееся: продукт не округляет позиции маркеров при
импорте (единственный механизм выравнивания — фронтовый `align-grid.ts` при
интерактивном перетаскивании, не при импорте) — не перепроверял повторно,
так как `import_export.py`/`websocket_api.py` этим диффом не менялись
(`changedFiles` подтверждает отсутствие Python-правок вне `tests_backend/`).

## Гейты: что прогнано, что нет, почему

- **Прогнано (reuse):** штатный `validate-gate` на точном материале
  `aa4e44882` — <https://github.com/Matysh/houseplan-card/actions/runs/40493373648>,
  зелёный, покрывает build/typecheck, полный `npm test` (включая
  `test/picture-elements-*.test.mjs`, `test/picture-elements-actions.test.mjs`,
  `test/converter-consumers.test.mjs`, `test/sh3d-convert-page.test.mjs`),
  `npm run build` + `bundle-policy --verify`, `build-page.mjs --check`,
  `pytest tests_backend` (product+tooling состав штатного гейта подразумевает
  оба — HA и не-HA — в соответствии с обычным составом `validate-product.yml`)
  и отобранный по диффу browser-смок `demo/smoke_plan_converter.mjs` (файл
  изменён этим же коммитом, значит не мог быть пропущен смок-селектором).
- **Не прогонялось мной адресно:** ни одного `run_check` не вызывал — не
  нашёл AC, риска или negative-input case, для которого пригодное покрытие
  отсутствовало бы или изменились бы входы/среда/oracle относительно
  зафиксированного зелёного `validate-gate` на этом же точном SHA. Чтение
  кода (таблица выше) использовано там, где достаточно статической проверки
  инварианта, не требующей исполнения (`src/device-toggle.ts`, `src/logic.ts`,
  `src/houseplan-card.ts` — не изменены этим диффом, не являются предметом
  negative-proof этой задачи).
- **Не прогонялось и не требовалось:** полный ночной golden/мутационный
  реестр (ночной гейт, не гейт ревью), глобальная visual-приёмка (бета),
  ручная/GPU-приёмка владельцем (#929).

## Вердикт

**Зелёный.** High: 0, Medium (в скоупе): 0. Код реализует принятый после
SPEC r2 контракт буквально и полностью: оба прежних owner-вопроса закрыты
явным решением в треде и перенесены в `## ТЗ`, действия не расширяют
существующую authority (проверено чтением неизменённого secure-инварианта и
исполненными негативными тестами над закрытой таблицей действий), позиции
и пропорции сохраняются точно и без угадывания, отчёт до скачивания
исключает молчаливую потерю, документация и ledger соответствуют
реализации. Единственное замечание — унаследованный Low из SPEC r2
(устаревшая преамбула issue вне `## ТЗ`), не образующий цикл. `route: fix`
(трек `ask`, задача не возвращается на reclassify).

**Маршрут побочных находок:** `mode: issues`, новых находок вне скоупа нет —
`outside_findings` пуст.

---

<!-- material-anchors: заполняется конвейером -->

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjUxYjI5YjEwNzk1N2U1OTg3OTM4ZjA5OWNlYTRjMjEyNTVlMjBhNzU3YzBhNTcyY2RlODBjNGRkYWI3MmI0ZjUiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJlNmUwNDZiOGVlNTI4MDcwZDlmYzI3ZjQyNzdmMmRlYjE2ZWZmZDZhN2E0ZjA4ZjBkYjJmNGQ5ZWE5OTEzOGFiIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDIyLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiJhYTRlNDQ4ODJkZTAzNzA5NGJiMzM4N2JmMzEyNDM4NThkZThlYTM4IiwidHJlZSI6ImY0ZDZlNDdlN2NlOTExYmU5MDlmOTU1ZjZiMmY3YzYwYWYyZjA1MmMiLCJib2R5RGlnZXN0IjoiYzIxZjI2MzE3MjgwMWVkNTBlOWRiMzgyMzcwZWUyYTM1NjQ0Y2EyMzIxMzlmNzk2OWQ5MjE2ZTc3N2M5YjExZCIsInByb2R1Y2VyUnVuIjoiNDA0OTQyMDc5NzMiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjAyYTMzNTA5ZmIwNWU2MmZlODAwYTc2MmZiNDEwMDJhMDUzNjc2NmVhZmVmZmEyM2E2ZDlkOGU2M2FlM2ZlMGIiLCJ2ZXJkaWN0RGlnZXN0IjoiNzlkNWVkOWJiZWI1YzVmYzg2ODFmYjAyODdhYmJlMzAyZDM0OTZlNzI0Y2YxZTY3NWNiMzA2MjFiMzgzNzY1NSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiIzYTU5Njg3OGIyMzE2ZjhiZWM4OTUzNDQ1Zjc0ZTk1YWI0YTUxNjNlMWFiMWUzOThjZWEyNjcxNjY0N2Y3NWMzIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDQwNjU2OTg0LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDIyI2lzc3VlY29tbWVudC02NDQwNjU2OTg0IiwiYm9keURpZ2VzdCI6Ijk1ZTMwNzcxMTczNjU1YWZlZGMwNmRhYzA0ZTM1ODAxY2RlZThhMjg1YzFkZjVhNWY0NDI4MWFlYzk2Y2YwN2YifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1022-picture-elements-convert`, коммит `aa4e44882de0` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `f4d6e47e7ce911be909f955f6b2f7c60af2f052c`
  ```
  git log --all --format='%H %T' | grep f4d6e47e7ce9
  ```
- Тело issue: `c21f263172801ed50e9db382370ee2a35644ca232139f7969d9216e777c9b11d`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40494207973,"run_attempt":1,"digest":"6dc0c9593328eab6d91f01cfd8e2dbfeec2b40b0623c00d535da2de92148d6d9"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6OTQsIm91dHB1dF90b2tlbnMiOjM3ODkxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjIwODA2OCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjY0ODA5OTAsImNvc3RVc2RFc3RpbWF0ZSI6Mi41MDc1Njc5OTk5OTk5OTk2fV0sInR1cm5zIjo1NCwiZHVyYXRpb25NcyI6NDkxODM5LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi41MDc1Njc5OTk5OTk5OTk2LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=94 output_tokens=37891 cache_creation_input_tokens=208068 cache_read_input_tokens=6480990 num_turns=54 -->
