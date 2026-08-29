# Issue #378 — выбираемый источник для режима «Значение + состояние»

- **Issue:** https://github.com/Matysh/houseplan-card/issues/378
- **Статус документа:** первая редакция, готова к ревью
- **Приоритет / тип:** P2 · feature / polish
- **Область:** frontend presentation + editor, marker config, backend validation,
  import/export, документация и QA
- **Связи:** #90 (канонические источники value badge), #321 (пользовательский
  сценарий position only)
- **Ревизия:** 1 (2026-08-29)

## Сценарий

Администратор дома на desktop открывает диалог уже размещённой маркизы, выбирает
режим «Значение + состояние», а затем источник «Положение · Маркиза». Preview
сразу показывает `42 %`. После сохранения то же значение видят на полном плане и
в static space card владелец, член семьи и гость; нажатие по маркеру по-прежнему
управляет маркизой по существующей настройке действия.

## Что человек увидит до и после

**До:** режим показывает слово `Open`, потому что умеет брать только state
автоматически выбранной сущности. **После:** пользователь одним селектором
выбирает полезный показатель и видит `42 %` вместо иконки, без дополнительного
слова и без template sensor.

## Проблема

`resolveValue()` в `src/device-presentation.ts` выбирает одну visual entity и
передаёт её в `validStateValue()`. Атрибут выбрать нельзя. В то же время
`src/device-value-badge.ts` уже содержит:

- канонический набор `ValueBadgeSource`;
- построение кандидатов текущего устройства;
- allowlist поддерживаемых атрибутов;
- преобразования brightness/volume/percentage/temperature;
- unavailable-контракт и стабильные ключи источников.

Создание второй таблицы или второго formatter приведёт к расхождению двух
селекторов. Простого добавления поля в диалог тоже недостаточно: конфиг проходит
backend delta-validation, ссылки `marker:*` переписываются при rebind и
переносятся между пространствами через import/export.

## Скоуп

- Отдельный селектор источника лица значения в диалоге устройства при
  `display: value`.
- Явный источник state, поддерживаемого attribute либо derived value из ровно
  того же набора и в том же порядке, что value badge.
- Общий resolver и formatter для value badge и внутреннего лица значения.
- Live preview и одинаковый результат в основном плане и static space card.
- Опциональное поле marker config, lossless delta-validation, rebind и полный
  import/export reference seam.
- Обновление документации режима и decision table.

## Не-скоуп

- Новые атрибуты, единицы, формулы, шаблоны либо произвольный entity picker.
- Изменение внешнего value badge или положения его капсулы.
- Новый display mode.
- Изменение визуального состояния подложки, activity, pulse, alarm, Glow,
  room metrics или LQI palette.
- Изменение tap/click target и действий `info`, `toggle`, `run`, `cover`.
- Выбор нескольких значений либо prefix/suffix пользователя.

## Контракт поведения

### 1. Выбор источника

1. При `display: value` сразу под подсказкой режима отображается поле
   «Источник значения».
2. Первая строка — «Автоматически (как раньше)». Она соответствует отсутствию
   явного источника. Далее идут кандидаты `valueBadgeCandidates()` в том же
   порядке, с теми же названиями, техническими подписями и текущими значениями,
   что в selector value badge.
3. Оба потребителя используют общий `ValueSource`/`ValueSourceCandidate`, общий
   source-key codec и общий formatter/resolver. Совпадение списков доказывается
   тестом на одну и ту же ссылку/проекцию данных, а не сравнением двух копий
   allowlist.
4. Отсутствие кандидатов не запрещает legacy auto: строка «Автоматически»
   остаётся доступной. Для virtual marker selector disabled с существующим
   объяснением `value_virtual`; сохранённый явный источник не удаляется.
5. Переключение на другой display mode скрывает поле, но сохраняет выбор.
   Возврат в `value` восстанавливает его.
6. При явной смене HA binding в диалоге старый `value_source` сбрасывается в
   auto: перенос источника прежнего устройства был бы ложной настройкой.

### 2. Разрешение и форматирование

1. Если `marker.value_source` отсутствует или `null`, вызывается существующий
   auto-path `resolveValue()` без изменения порядка климатической legacy-
   эвристики, power-gate и проверки неоднозначности.
2. Если источник задан явно, auto-path не выбирает и не подставляет другую
   сущность. State, attribute, `derived_lqi` и `derived_marker_state`
   разрешаются тем же кодом, что value badge.
3. `cover.current_position = 42` отображается `42 %`; brightness, volume,
   humidity, battery и temperature получают ровно те же преобразования и
   единицы, что внешний badge. `valueText` — компактный текст,
   `valueFullText` — доступное полное значение/tooltip.
4. Временно отсутствующий, unknown/unavailable или переставший быть скалярным
   **явный** источник сохраняется и отображает `—` внутри лица значения. Он не
   заменяется иконкой и не переключается на auto. Presentation сохраняет
   диагностический код `value_no_state` или `value_non_scalar`, но explicit-
   ветка не трактует этот код как разрешение сменить лицо.
5. Для auto-path прежняя семантика остаётся: `value_no_state`,
   `value_ambiguous_sources` и `value_non_scalar` откатывают лицо к иконке.
   Явный источник по определению снимает `value_ambiguous_sources`.
6. `value_virtual` имеет приоритет над сохранённым источником: virtual marker
   остаётся с иконкой, как сейчас.
7. Ключ выбранного источника входит в `sourceSignature` даже в unavailable-
   состоянии, чтобы смена выбора/восстановление данных инвалидировала snapshot.
8. Если внешний badge показывает тот же source key, существующая подсказка о
   дублировании остаётся и сравнивает уже явный источник лица.

### 3. Preview и действия

- Preview строит draft marker с текущим `display` и `value_source` и вызывает
  тот же `resolveDevicePresentation()`, что оба plan renderer; отдельной mock-
  строки `42 %` нет.
- Смена selector обновляет preview без Save.
- Сохранение не требуется для preview, но Cancel не пишет draft в config.
- Выбор источника не меняет `primary`, visual sources, `tap_action`,
  `tap_target`, `toggle_entity`, controls или more-info entity.
- Pointer и touch hit area не меняются; на touch результат и действие идентичны
  desktop. View/киоск считаются release-blocking поверхностями.

## UX

Новый selector расположен рядом с причиной выбора режима, до блока внешнего
value badge. В нём переиспользуются строки кандидатов #90. Новые строки нужны
только для собственной подписи/help и auto-опции:

- «Источник значения»;
- «Выберите, что заменит иконку. Действие по нажатию не изменится»;
- «Автоматически (как раньше)»;
- missing-hint, который говорит, что лицо покажет `—`, пока источник не
  восстановится или пользователь не выберет другой.

Сохранённый источник, которого нет среди текущих кандидатов, добавляется одной
выбранной disabled-looking, но сохраняемой строкой «Источник недоступен» по
паттерну value badge. Пользователь может оставить её, выбрать другой источник
или auto. Само открытие и сохранение диалога без изменения selector не
материализует рекомендацию и не удаляет неизвестное значение.

## Модель данных и миграция

### Frontend

В `Marker` добавляется:

```ts
value_source?: ValueBadgeSource | null;
```

Имя техническое и не обещает связь с tap target. Тип источника извлекается из
badge-модуля в нейтральный общий контракт либо реэкспортируется без дублирования.

- absence/`null` = legacy auto;
- object = explicit source;
- выбор auto удаляет поле при записи нового frontend-конфига;
- неизвестный untouched literal losslessly round-trips согласно
  `docs/CONFIG-COMPATIBILITY.md`; после явной правки поля записывается только
  канонический source либо отсутствие.

Миграции и массовой материализации нет: существующие marker остаются без поля и
выглядят как до #378.

### Backend validation

`MARKER_SCHEMA` принимает `value_source` как lossless object/`null`, а
семантическая delta-validation применяет к изменённому значению тот же набор
kind/полей/entity-id/attribute, что `value_badge.source`. Общая функция
валидации источника должна исключить второй backend allowlist.

Для `derived_marker_state` ref обязан вести на существующий не-removed marker с
`is_light: true`, как у badge. Полный импорт валидирует все новые данные;
обычная запись сохраняет untouched future literal.

### Reference seam и import/export

- `rewriteMarkerControlReferences()` переписывает `value_source.ref` вместе с
  controls и `value_badge.source.ref` при смене marker id.
- Full export/import сохраняет поле штатно.
- Space export оставляет derived ref только если target входит в переносимый
  набор; иначе удаляет `value_source` (возврат в auto) и увеличивает счётчик
  dropped marker links.
- Space import remap-ит живой target на новый marker id. При skip/virtualize или
  отсутствующем target поле удаляется, сырой `marker:old-id` не протекает.
- Виртуализация дубликата удаляет HA-dependent `value_source`, как
  `value_badge`, `controls` и tap fields.

## i18n

Добавить с паритетом EN/RU/DE/FR:

- `marker.value_source`
- `marker.value_source.help` и `.aria`
- `marker.value_source_auto`
- `marker.value_source_missing_hint`

Имена state/attribute/derived-кандидатов и `marker.value_badge_missing`
переиспользуются. Тексты `marker.display_hint_value` во всех четырёх языках
обновляются: значение может быть выбранным, а не только «однозначным» auto.

## Затронутые файлы и модули

- `src/types.ts`, `src/device-value-badge.ts`, `src/device-presentation.ts`,
  `src/device-presentation-policy.ts` (только explicit-dash gate),
  `src/devices.ts`.
- `src/houseplan-card.ts`, `src/houseplan-editor-runtime.ts`.
- `src/i18n/{en,ru,de,fr}.json`.
- `custom_components/houseplan/validation.py`,
  `custom_components/houseplan/import_export.py`, websocket validation call
  sites при переименовании validator.
- Frontend/backend unit tests и целевой browser smoke.
- `docs/DEVICE-PRESENTATION.md`, `docs/ARCHITECTURE.md`,
  `docs/CONFIG-COMPATIBILITY.md`, `docs/USER-GUIDE.md`,
  `docs/USER-GUIDE.ru.md`, оба changelog.

## Критерии приёмки

- **AC1 — список и сохранение (unit + smoke).** В `display: value` selector
  содержит auto и ровно те же кандидаты/порядок, что value badge; выбор
  `cover.current_position` сохраняет `value_source`, повторное открытие
  восстанавливает выбор, выбор auto удаляет поле.
- **AC2 — результат на всех renderer (unit + smoke + golden).** При position 42
  preview, полный план и static space card показывают `42 %` вместо иконки;
  desktop/touch tap вызывает тот же action/target, что до выбора.
- **AC3 — паритет formatter (unit).** Все поддерживаемые attribute kinds,
  entity state, LQI и marker state дают одинаковые `text/fullText/availability`
  для лица и value badge.
- **AC4 — legacy compatibility (unit + backend).** Marker без поля и с `null`
  проходит прежние F09–F12 сценарии: auto state, ambiguity/no-state/non-scalar
  fallback и virtual fallback не меняются; простое Save не материализует поле.
- **AC5 — fail explicit (unit + smoke).** Сохранённый явный источник, временно
  исчезнувший либо unavailable, остаётся выбранным, на лице показывает `—`,
  даёт корректный диагностический reason и не подменяется иконкой/другим state;
  возврат source восстанавливает значение без повторного выбора.
- **AC6 — независимость (unit).** Выбор не меняет внешний badge, visual/activity
  state, room aggregates, Glow, LQI palette, primary и tap resolver; duplicate-
  hint срабатывает при совпадении source keys.
- **AC7 — конфиг и ссылки (backend + unit).** Delta-validation режет каждый
  некорректный новый kind/attribute/entity/ref, сохраняет untouched future
  literal, rebind переписывает derived ref, full transfer сохраняет, space
  transfer remap-ит либо явно удаляет dangling ref с отчётом.
- **AC8 — preview/Cancel/binding (smoke).** Selector меняет draft preview сразу;
  Cancel ничего не пишет; смена binding сбрасывает старый source в auto.
- **AC9 — локализация и документация (unit + docs gate).** Четыре словаря имеют
  паритет, обновлены guide/presentation/architecture/compatibility, docs
  screenshots соответствуют точному SHA.
- **AC10 — гейты и бюджет (commands).** `npx tsc --noEmit`, `npm test`,
  `npm run build`, backend pytest, `no-new-any`, целевой smoke,
  `golden:verify` и `check-docs` зелёные; bundle budget без существенной дельты.

## План автотестов

- Расширить unit `device-value-badge` общим resolver contract и таблицей всех
  source kinds/formatter branches.
- Расширить `device-presentation`/decision fixtures: explicit position,
  unavailable explicit dash, restored source, legacy F09–F12 без изменений,
  source signature и duplicate badge.
- Unit editor save/draft: untouched, explicit, auto, missing, binding change,
  Cancel.
- Unit `devices`: rebind `derived_marker_state` для обоих потребителей.
- Backend pytest: schema/delta-validation, future literal, renamed marker,
  full/space import-export keep/remap/drop/virtualize.
- Новый либо расширенный целевой Playwright smoke диалога: preview + save +
  reopen + unavailable/recovery + main/static render + desktop/touch action.
- Golden-сценарий с cover 42 % и выбранным source принимается только через
  штатный reviewed Linux artifact; docs screenshots — только workflow
  `Docs screenshots` на точном SHA.

Мутанты: удалить explicit branch → AC2 красный; заменить source formatter на
raw attribute → AC3; fallback explicit в auto/icon → AC5; не переписать ref →
AC7; материализовать auto при открытии → AC4/AC8.

## Производительность и безопасность

- Сеть, сервисы HA и частота обновлений не меняются.
- Candidate discovery уже кэшируется; один выбранный source разрешается O(1),
  кроме существующего derived marker-state graph. Новый обход всех HA entities
  запрещён.
- В snapshot/signature добавляется один короткий source key; заметной дельты
  bundle/render budget не ожидается и она проверяется штатным budget gate.
- Backend принимает только те же ограниченные source shapes и attributes, что
  badge; произвольный template/code/URL не исполняется. Security artifact не
  требуется, кроме unit отрицательных входов.

## Touch

Сам selector — desktop-поверхность редактора. Результат живёт в View и киоске:
размер/hit target маркера и tap semantics не меняются. AC2 и AC6 обязаны
проверить touch pointer path; расхождение desktop/touch блокирует выпуск.

## Риски

- Две настройки с похожим названием: смягчается размещением source сразу под
  display и сохранением отдельного заголовка «Бейдж со значением» ниже.
- Расхождение formatter/candidates: запрещено контрактом общей функции и AC3.
- Dangling `marker:*` после rebind/import: закрывается полным reference seam AC7.
- Изменение legacy auto при рефакторинге: закрывается неизменными decision
  fixtures и AC4.
- `—` может быть принят за значение: missing warning и preview reason объясняют
  восстановление; молчаливый fallback опаснее.

## Откат

`git revert` реализационного коммита. Старый frontend/backend losslessly
пропустит дополнительный marker key благодаря `ALLOW_EXTRA`, но проигнорирует
его и покажет legacy auto; данные не теряются. Повторная установка новой версии
восстановит выбор. Массовая очистка конфига не нужна.

## Release-артефакты

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`: user-visible пункт со ссылкой
  #378 в том же коммите, что поведение.
- `docs/USER-GUIDE.md` и `.ru.md`: как выбрать position/percentage/temperature
  и что tap не меняется.
- `docs/DEVICE-PRESENTATION.md`: explicit/auto/dash строки decision table.
- `docs/ARCHITECTURE.md` и `docs/CONFIG-COMPATIBILITY.md`: общий resolver,
  optional key, delta-validation и reference seam.
- Golden cover 42 % + reviewed artifact; docs screenshots с точного SHA.
- Отдельного performance/security отчёта нет: результаты budget и негативных
  validation tests входят в handoff.

## Принято предположительно, поменять свободно

Это технические решения, а не новые продуктовые требования:

- имя persisted-поля `marker.value_source`;
- извлечь neutral source module или реэкспортировать тип/функции из текущего
  `device-value-badge.ts` — выбирается вариант с меньшим циклом зависимостей;
- расширить существующий smoke или создать отдельный;
- хранить diagnostic fallback рядом с explicit `—` отдельным полем либо снять
  запрет fallback в policy через explicit-флаг; публичный результат нормативен,
  внутренняя форма нет.
