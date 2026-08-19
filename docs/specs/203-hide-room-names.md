# Issue #203 — выключение названий скрывает все подписи комнат

- Дата: 2026-08-19
- Тип: bug · приоритет P2 · ценность 7/10 · сложность 3/10
- Issue: [#203](https://github.com/Matysh/houseplan-card/issues/203)
- Ветка: `issue/203-hide-room-names`

Канонические документы: `docs/SCOPE.md`, `docs/UX-MODES.md`,
`docs/STYLING-HOOKS.md`, `docs/USER-GUIDE.ru.md`, `docs/TESTING.md`.

## 1. Сценарий и персона

Администратор дома открывает настройки пространства, выключает «Отображать
названия комнат (перетаскиваются)» и сохраняет. Он ожидает чистый View без
постоянных подписей, например для маленького экрана, фонового чертежа с уже
нанесёнными названиями или плана, где достаточно интерактивных устройств.

Это штатная часть J4/J6: явно выключенный визуальный слой должен исчезнуть на
всех пользовательских представлениях одного пространства.

## 2. Что человек увидит до и после

**До:** draggable HTML-карточка исчезает вместе с температурой, влажностью,
LQI и состоянием света, но на нарисованном плане без фонового изображения
возникает другая SVG-подпись. Имя остаётся, перемещается в геометрический центр
комнаты и меняет стиль. Компактная карточка пространства повторяет дефект.

**После:** при выключенной настройке в View, Devices editor и компактной
карточке нет постоянной подписи комнаты ни в HTML, ни в SVG. В Plan editor имя
по-прежнему временно показывается как редактируемый объект. При повторном
включении возвращается прежняя draggable карточка с сохранённой позицией,
масштабом, HA Area icon и разрешёнными метриками.

## 3. Подтверждённая проблема и причина

Persisted значение и основной resolver исправны:

- `spaceDisplayOf()` возвращает `showNames: false` для явного
  `settings.show_names: false`;
- `_saveSpaceDialog()` записывает `show_names: d.showNames` для существующего
  пространства;
- основной `.devlayer` перестаёт рендерить `_renderRoomLabel()`, поэтому
  HTML-карточка и её `.rlmetrics` действительно исчезают.

Ошибка находится в двух fallback-ветках. `_renderSvgRoomLabels()` полного
renderer при `!space.bg && !disp.showNames` создаёт `<text class="rlabel">`.
`renderSpaceCard()` независимо делает то же через `staticSvgLabels`. Они
инвертируют смысл настройки. Скрытая изометрическая ветка дополнительно
форсирует HTML-карточки при `iso && !space.bg`, даже если `showNames === false`.

Именно смена HTML-карточки на SVG-текст объясняет все детали репорта: имя
остаётся, метрики пропадают, сохранённая layout-позиция не используется, цвет и
типографика становятся другими. На пространстве с `bg` дефект маскируется,
потому что SVG-fallback уже запрещён условием `space.bg`.

## 4. Scope

- сделать `show_names: false` единым запретом постоянных room-labels в полном
  flat/iso View, Devices editor и компактной карточке пространства;
- сохранить принудительную видимость редактируемой HTML-подписи в Plan editor;
- сохранить live-preview значения в открытом диалоге настроек пространства;
- при `show_names: true` не менять состав, позицию, масштаб, цвет, метрики,
  HA Area icon, drag/resize и навигацию комнатной карточки;
- удалить или обезвредить ошибочные SVG-fallback renderer и актуализировать
  больше не существующий `.rlabel` styling-hook;
- добавить browser regression, mutation gate, визуальное доказательство и
  пользовательскую/тестовую документацию.

## 5. Non-scope

- изменение текста/назначения переключателя или добавление второго режима
  «статические названия»;
- скрытие названия комнаты внутри tooltip, диалога настроек, HA Area или
  accessibility-описания самой комнаты: настройка управляет подписями на плане;
- удаление либо сброс `layout.rl_<roomId>`, масштаба подписи или room metrics;
- изменение `show_borders`, room fill, Glow, openings, devices и room hover;
- изменение дефолта `show_names` для новых/legacy пространств — это отдельная
  проблема #204;
- schema/backend/API, migration, импорт/экспорт и Optimize;
- публичное включение изометрии или изменение её геометрии;
- редизайн комнатной карточки, Plan gear/handles или compact space card.

## 6. Контракт поведения

### 6.1. Матрица видимости

| Поверхность | `show_names: true` | `show_names: false` |
|---|---|---|
| Full View, flat | Одна HTML `.roomlabel` на именованную комнату | Нет HTML/SVG room-label |
| Full View, hidden iso | Та же HTML `.roomlabel`, спроецированная существующей iso-логикой | Нет HTML/SVG room-label |
| Devices editor | Одна HTML `.roomlabel` | Нет HTML/SVG room-label |
| Plan editor | Одна редактируемая HTML `.roomlabel` | Та же editor-only `.roomlabel` |
| Compact space card | Одна HTML `.roomlabel` | Нет HTML/SVG room-label |

Условие `!space.bg` больше не создаёт альтернативный способ показать имя.
Наличие или отсутствие фонового изображения не влияет на матрицу.

### 6.2. Повторное включение

Выключение не удаляет `layout.rl_<roomId>` и room settings. После повторного
включения карточка возвращается в сохранённую позицию и с сохранёнными
`k/name_scale/label_scale`. Разрешённые `label_temp`, `label_hum`, `label_lqi`
и `label_light` снова отображаются по существующим правилам и данным.

### 6.3. Plan editor

Plan editor сохраняет исключение `_markup`: подпись нужна для drag, resize и
доступа к редактируемому имени. Это исключение не должно протекать в View после
выхода из редактора. Room gear и placeholder безымянной комнаты сохраняются.

### 6.4. Диалог настроек

При переключении `showNames` в edit-диалоге `_spaceDisplayForRender()` сразу
проецирует новое значение в затемнённый пользовательский View. Cancel возвращает
persisted значение, Save записывает boolean. Результат после повторного открытия
совпадает с сохранённым состоянием.

## 7. Данные, совместимость и styling hooks

Persisted-формат не меняется: `settings.show_names` уже валидируется и хранит
boolean. Миграция не нужна, конфигурация не переписывается при чтении.

`div.roomlabel[data-hp="room-label"]` остаётся каноническим hook видимой
подписи. `text.rlabel` существовал только в противоречащей настройке fallback-
ветке и после исправления не является доступным runtime hook; строка о нём в
`docs/STYLING-HOOKS.md` удаляется или заменяется честным описанием отсутствия
подписи. `data-hp`, `data-id` и `data-area` HTML-карточки не меняются.

Downgrade возвращает старый SVG-fallback, но не теряет данные. Пользовательский
CSS, намеренно показывавший `text.rlabel` при выключенных названиях, перестаёт
иметь target — это необходимое следствие исправления ложного поведения, а не
новая точка расширения.

## 8. UX, i18n, accessibility и touch

Новых строк и элементов управления нет. Существующий русский и английский
текст становится честным. Выключенная подпись не оставляет пустого DOM-узла,
focus target или невидимой pointer-зоны. Tooltip комнаты и room hover остаются
доступны по геометрии комнаты, поэтому получить сведения по комнате можно.

Touch/keyboard policy и события Plan editor не меняются. При включённых именах
существующие drag, resize handles, Area navigation и accessibility-описания
сохраняются.

## 9. Acceptance criteria и доказательства

| AC | Критерий | Обязательное доказательство |
|---|---|---|
| AC1 | На нарисованном пространстве без `bg`, при `show_names:false`, в flat View нет ни `.roomlabel`, ни `.room-svg-labels text`, ни `[data-hp="room-label"]`. | Targeted Playwright smoke через реальный space setting. |
| AC2 | AC1 выполняется в компактной карточке пространства. | Тот же smoke на `houseplan-space-card`. |
| AC3 | Hidden iso при `show_names:false` не форсирует подписи; при `true` сохраняет существующую projected HTML-карточку. | Расширенный isometric contract/live smoke + отдельный iso mutant. |
| AC4 | Plan editor показывает редактируемую подпись при `show_names:false`; после выхода View снова пуст. | Browser mode-transition smoke с DOM assertions. |
| AC5 | При `true` HTML-карточки, метрики, HA Area icon, сохранённая позиция/scale и текущие события не меняются. | Существующие room-card/link/parity smokes + focused regression. |
| AC6 | Toggle в edit-диалоге даёт live-preview, Save переживает повторное открытие, Cancel не пишет config. | Расширенный `smoke_space_settings.mjs` либо отдельный targeted smoke. |
| AC7 | `show_borders`, fills, Glow, devices, openings и room tooltip не меняются при выключении имён. | DOM snapshot/assertions targeted smoke + reviewed golden. |
| AC8 | Документация больше не обещает доступный `text.rlabel` hook и однозначно описывает переключатель. | Diff `STYLING-HOOKS`, user guide и `TESTING`. |
| AC9 | Ошибочный fallback доказан исполняемым мутантом. | `mutation-gate --check`, clean green / mutant red. |
| AC10 | Рабочие gates зелёные. | typecheck, unit, build и все затронутые targeted smokes. |

## 10. План автотестов

### 10.1. Unit/source contract

Новая pure-логика не требуется. Существующие unit `spaceDisplayOf` уже
доказывают чтение явного `false`. Если итоговая реализация вынесет общую функцию
матрицы видимости, добавить table-driven unit; иначе не дублировать Lit-template
в искусственном source test.

### 10.2. Browser smoke

Расширить `demo/smoke_space_settings.mjs` или создать небольшой именной smoke:

1. взять пространство без `plan_url/bg`, включить имена и зафиксировать одну
   HTML-карточку с метрикой и сохранённой layout-позицией;
2. открыть edit-диалог и выключить имена, проверить live-preview;
3. Save и повторное открытие подтверждают `false` и отсутствие любых labels;
4. перейти в Plan — подпись и editor affordance видимы; вернуться в View —
   снова скрыты;
5. повторить ключевую проверку в hidden iso и compact space card;
6. включить имена обратно и проверить восстановление карточки, позиции/scale и
   метрики;
7. отдельно проверить Cancel и отсутствие `pageerror`/console error.

`demo/smoke_styling_hooks.mjs` меняет прежнее утверждение «SVG-label существует
при false» на честное отсутствие любого label; HTML hook при true остаётся.
Смежные `smoke_room_cards.mjs`, `smoke_room_link.mjs`, room-label parity и iso
smokes прогоняются до code review.

### 10.3. Golden и mutation gate

Добавить/переиспользовать focused light/dark golden для нарисованного
пространства: reviewed baseline при `false` не содержит имён, при `true`
содержит существующие HTML-карточки. Общий `golden:verify` и полный smoke идут
перед бетой, но затронутые focused кадры обязательны при реализации.

Mutation gate обязан независимо защищать все три места исходного дефекта:

| Mutant id | Обязательная поломка | Guard |
|---|---|---|
| `hidden-room-names-full-svg-fallback` | Вернуть SVG-fallback `_renderSvgRoomLabels()` полного flat renderer при `show_names:false`. | Targeted full-card smoke из AC1 обязан завершиться non-zero. |
| `hidden-room-names-compact-svg-fallback` | Вернуть `staticSvgLabels` компактной карточки при `show_names:false`. | Targeted compact-card smoke из AC2 обязан завершиться non-zero. |
| `hidden-room-names-iso-override` | Вернуть независимый `iso && !space.bg` override, который форсирует HTML `.roomlabel` вопреки `show_names:false`. | Isometric contract/live smoke из AC3 обязан завершиться non-zero. |

Все три entries регистрируются в `scripts/mutation-gate.mjs`; каждый якорь
встречается ровно один раз. На чистом коде все guards зелёные, на каждом мутанте
соответствующий guard красный. Объединять full/compact/iso в один мутант нельзя:
иначе исправленная ветка может маскировать непроверенную соседнюю.

## 11. Риски и меры

| Риск | Мера |
|---|---|
| Скрытие протечёт в Plan и лишит пользователя редактируемого имени. | Отдельная строка матрицы, AC4 и реальный переход режимов. |
| Исправится full card, но останется compact или iso override. | Независимые AC2/AC3 и mutants по renderer. |
| Повторное включение сбросит позицию/scale/metrics. | Запрет записи layout и round-trip AC5/AC6. |
| Вместе с label исчезнет tooltip/room pointer geometry. | Label DOM меняется отдельно от room shape; AC7. |
| Удалится документированный styling hook без объяснения. | Актуализация `STYLING-HOOKS` и compatibility note §7. |

Performance улучшается либо нейтрален: удаляются DOM/SVG nodes и map по комнатам
при выключенном слое, новых проходов/таймеров/network calls нет. Security/privacy
boundary не меняется; настройка не становится механизмом сокрытия данных.

## 12. Rollback

Frontend-изменение откатывается вместе с тестами и документацией одним
коммитом. Данные и schema не меняются. Откат возвращает только ошибочный
SVG-fallback/iso override и не требует восстановления config или layout.

## 13. Release-артефакты

- пользовательские записи в `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в
  implementation-коммите с `User-Visible: yes`;
- обновления `docs/USER-GUIDE.ru.md`, `docs/STYLING-HOOKS.md` и
  `docs/TESTING.md`;
- targeted full/compact/Plan/iso browser evidence, styling-hook regression и
  executable mutation gate;
- focused reviewed light/dark golden и синхронные bundle snapshots;
- отдельные backend, schema, migration, performance и security artifacts не
  нужны;
- полные golden/smoke/performance остаются предрелизным гейтом.

## 14. Принятые предположения

Принято предположительно, поменять свободно при ревью:

1. «Скрыть названия» управляет постоянными labels на плане, но не удаляет имя
   из tooltip/диалогов и не является privacy-функцией.
2. Plan editor сохраняет текущую принудительную видимость независимо от
   persisted `show_names`, потому что там имя является редактируемым объектом.
3. Hidden iso обязан соблюдать тот же user setting, несмотря на прежний
   технический override `iso && !space.bg`.
4. Канонический styling hook видимой подписи — существующий HTML
   `div.roomlabel`; отдельный статический режим и новый hook не добавляются.
5. Если удаление мёртвого `.rlabel` CSS увеличит визуальный diff только за счёт
   отсутствующих nodes, это входит в задачу; прочая типографика не меняется.
