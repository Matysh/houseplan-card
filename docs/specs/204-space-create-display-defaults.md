# Issue #204 — честные defaults границ и имён при создании пространства

- Дата: 2026-08-19
- Тип: bug · приоритет P2
- Оценка: пользовательская ценность 7/10 · ценность для разработки 6/10 · сложность 4/10 · риск 5/10
- Issue: [#204](https://github.com/Matysh/houseplan-card/issues/204)
- Ветка: `issue/204-space-create-display-defaults`

Канонические документы: `docs/SCOPE.md`, `docs/UX-MODES.md`,
`docs/USER-GUIDE.ru.md`, `docs/TESTING.md`, `docs/specs/040-floor-area-onboarding.md`.

## 1. Сценарий и персона

Администратор создаёт пространство вручную либо последовательно заводит этажи
через Floors/Areas onboarding. В диалоге он выбирает источник «Рисовать комнаты
вручную», проверяет настройки отображения и сохраняет. Значения на экране должны
быть теми значениями, которые попадут в config и будут показаны при повторном
открытии.

## 2. До и после

**До:** оба переключателя — «Всегда отображать границы комнат» и «Отображать
названия комнат» — видимо выключены. Для `create + draw` Save игнорирует их и
принудительно записывает `true/true`. Повторное открытие показывает включённое
состояние, которого пользователь не выбирал.

**После:** при выборе ручного пространства оба действующих product defaults
сразу видимо включены и именно они сохраняются. Для пространства с файлом
исходный default остаётся `false/false`. Если пользователь изменил хотя бы один
из двух переключателей, дальнейшие File ↔ Draw в том же открытом диалоге не
перезаписывают ни один из его выборов.

## 3. Подтверждённая причина

`_openSpaceDialog('create')` и `_openNextImport()` создают dialog state с
`source:'file'`, `showBorders:false`, `showNames:false`. Радиокнопки источника
меняют только `source`. `_saveSpaceDialog()` отдельно содержит скрытую ветку:

```ts
show_borders: draw && d.mode === 'create' ? true : d.showBorders
show_names: draw && d.mode === 'create' ? true : d.showNames
```

Поэтому только `create + draw` нарушает round-trip. Create с файлом и Edit уже
сохраняют показанные значения; backend принимает явные boolean без подмены.
#203 исправляет runtime-смысл `show_names`, но не dialog defaults и не Save.

## 4. Scope

- сделать default-пару источника частью create-dialog state: File `false/false`,
  Draw `true/true`;
- применять пару при переключении источника, пока пользователь не тронул ни
  один из этих двух controls;
- после первого пользовательского изменения сохранять оба текущих значения при
  любых следующих File ↔ Draw;
- сохранять в config ровно `d.showBorders` и `d.showNames` без скрытой ветки;
- одинаково применить контракт в обычном Create и Floors/Areas onboarding;
- проверить Save/reopen, Cancel и source-switch round-trip.

## 5. Non-scope

- изменение runtime resolver `spaceDisplayOf()` или render поведения #203;
- миграция уже созданных spaces и переписывание explicit/implicit settings;
- изменение defaults Edit, legacy spaces либо space с уже сохранёнными values;
- изменение `hide_decor`, `hide_openings`, fill/Glow, background, масштаба или
  других полей диалога при source switch;
- добавление предупреждения, текста, reset-кнопки или отдельных preferences на
  каждый source;
- изменение HA Floors/Areas registry или backend schema/API.

## 6. Контракт dialog state

Create state получает внутренний ephemeral признак `displayTouched` (имя может
быть другим). Он не сохраняется в config.

1. Новый обычный Create и каждый новый шаг onboarding открываются как File с
   видимой парой `false/false`, `displayTouched:false`.
2. Пока `displayTouched:false`, переход на Draw атомарно ставит `true/true`, а
   переход на File — `false/false`. Повторные переходы воспроизводят default
   выбранного source и не влияют на прочие поля.
3. Изменение любого из двух переключателей ставит `displayTouched:true`. Второй
   control не меняется автоматически.
4. При `displayTouched:true` смена source меняет только `source`; текущая пара
   сохраняется целиком. Это даёт в том числе намеренные `true/false` и
   `false/true`.
5. Save для Create и Edit всегда записывает текущие dialog booleans. Значение
   не выводится заново из наличия background.
6. Cancel/close уничтожает ephemeral state. Следующий Create снова начинает с
   File `false/false`; следующий этаж onboarding получает собственный чистый
   state и не наследует touch предыдущего.

Выбор source и изменение control происходят синхронно в одном новом object
state, поэтому Lit не может отрисовать промежуточную ложную пару.

## 7. Данные и совместимость

Persisted schema не меняется: `settings.show_borders` и `settings.show_names`
уже boolean. Новые hand-drawn spaces по default по-прежнему получают
`true/true`; меняется только честность UI и возможность до Save выбрать другое.
Новые file spaces по default по-прежнему получают `false/false`.

Existing spaces и imports/backups не мигрируются. Edit читает effective values
и сохраняет их как раньше; ephemeral touch нужен только create-mode. Downgrade
читает те же booleans. Нет нового model/version marker.

## 8. UX, accessibility, touch и i18n

Состав, порядок и тексты controls не меняются. Обновляются checked states двух
существующих HA switches. Keyboard, pointer и touch проходят один и тот же
`change` handler; focus не переносится, live announcement не требуется. Цвет не
является единственным сигналом — состояние остаётся нативно доступным через
checked/ARIA контракт control. Новых locale keys нет.

## 9. Acceptance criteria

| AC | Критерий | Доказательство |
|---|---|---|
| AC1 | Новый Create открывается как File с `false/false`; первый переход Draw показывает `true/true`. | Targeted dialog smoke + state assertions. |
| AC2 | Save сразу после выбора Draw сохраняет показанные `true/true`; reopen читает `true/true`. | Production-bundle smoke. |
| AC3 | Пользовательские `false/false`, `true/false` и `false/true` для Draw сохраняются без подмены и совпадают после reopen. | Table-driven smoke/unit seam. |
| AC4 | До touch File ↔ Draw переключает `false/false` ↔ `true/true`; после touch source меняется, а оба booleans остаются. | Source-switch matrix. |
| AC5 | Новый этап Floors/Areas onboarding следует той же матрице и не наследует touch/values предыдущего этажа. | Extended onboarding smoke. |
| AC6 | Create с файлом по default сохраняет `false/false`; Edit существующего пространства не меняет values при open/save. | Regression smoke. |
| AC7 | Cancel не пишет config; новый Create возвращает чистый default. | Save-call/config snapshot assertions. |
| AC8 | Остальные dialog fields побайтно сохраняются при source transitions; runtime #203 остаётся зелёным. | Focused state regression + existing smoke. |
| AC9 | Старый hidden Save override ловится мутантом. | Mutation gate. |
| AC10 | Рабочие gates зелёные. | typecheck, unit, build, targeted smokes; bundle copies identical. |

## 10. План реализации и тестов

Создание начального state и source transition следует вынести в маленький pure
helper либо эквивалентную общую функцию, чтобы обычный Create и `_openNextImport`
не расходились. Handlers двух переключателей помечают pair touched. Save удаляет
ветку `draw && create ? true : ...`.

Основной targeted browser сценарий может расширить `demo/smoke_space_settings.mjs`
или быть выделен как `smoke_space_create_display_defaults.mjs`. Он проходит
default, source matrix, mixed values, Save/reopen, Cancel и onboarding. Unit
допустим для pure state helper; DOM/Save round-trip остаётся обязательным.

Mutation entry восстанавливает принудительные `true` в Save либо отключает
touched guard и обязан падать на mixed-value/source-switch проверке. Golden не
нужен: checked и persisted booleans являются точным доказательством. Полный
smoke/golden/performance остаётся предрелизным gate.

## 11. Риски и меры

| Риск | Мера |
|---|---|
| Source switch затирает осознанный mixed choice | Один touched guard на пару, AC3/AC4. |
| Onboarding расходится с обычным Create | Общий initializer/transition и AC5. |
| Touch предыдущего этажа протекает дальше | Новый state на каждый `_openNextImport()`. |
| Исправление меняет существующий product default | Persisted default pairs остаются прежними. |
| Edit получает create-only reset | Mode matrix и AC6. |

Производительность и security/privacy boundary не меняются: локальные boolean
transitions не добавляют I/O, registry access или HA service calls.

## 12. Release-артефакты и rollback

Изменение пользовательское. Implementation-коммит имеет `User-Visible: yes` и
включает:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #204;
- `docs/USER-GUIDE.ru.md` — defaults File/Draw и сохранение выбора;
- `docs/TESTING.md` — source/touch/onboarding matrix;
- `docs/STATUS.md` — фактическую release-линию;
- targeted smoke, mutation entry и три синхронные bundle copies.

Отдельные backend, schema/migration, i18n, screenshot/golden, security и
performance artifacts не нужны. Rollback — revert implementation-коммита;
данные остаются валидными, но вернётся скрытая Save-подмена для create+draw.

## 13. Принятые предположения

1. Один touched flag намеренно защищает пару: изменение одного control означает,
   что dialog больше не вправе автоматически сбрасывать и второй.
2. Пока пользователь не менял controls, каждый source switch показывает default
   текущего source; отдельная память values по источникам не требуется.
3. Internal helper/field names и выбор smoke-файла являются техническими
   решениями при сохранении §6.
4. Продуктовых вопросов больше нет: Q1–Q2 приняты владельцем по defaults.
