# HP-UX-03 — предпросмотр отображения устройства

Статус: **реализовано и проверено для v1.60.2-beta.3**
Дата: **2026-08-08**
Область: **диалог добавления/редактирования устройства, единый resolver визуального состояния, текстовый режим значения и происхождение привязки из Home Assistant**

## 1. Зафиксированное продуктовое решение

В диалоге устройства появляется живой блок **«Предпросмотр»**, который до сохранения показывает ровно тот marker, который пользователь получит на плане с текущими значениями формы.

Предпросмотр обязательно отображает:

1. фактический визуал marker прямо сейчас;
2. интеграцию Home Assistant, которой принадлежит выбранная привязка;
3. сущность или набор сущностей, из которых сейчас получен визуал;
4. локализованное текущее состояние;
5. понятное объяснение результата: нейтральная/жёлтая/оранжевая/красная/приглушённая подложка, наличие и тип активности, значение либо fallback к иконке;
6. несохранённые изменения иконки, режима отображения, размера, поворота, controls, роли источника света и tap action;
7. отдельную безопасную демонстрацию обычного activity-эффекта, когда реальное устройство сейчас не активно.

Предпросмотр не является второй независимой реализацией визуала. Interactive
план, диалог и статическая `houseplan-space-card` используют один
`ResolvedDevicePresentation` и один renderer лица marker.

## 2. Проблема текущего интерфейса

Поле «Отображение» предлагает три варианта:

- «Значок»;
- «Значок + активность»;
- «Значение вместо иконки».

Пользователь до сохранения не видит:

- какую подложку получит конкретное устройство;
- почему работающий объект стал или не стал жёлтым;
- какая сущность выбрана источником состояния среди нескольких сущностей устройства;
- что именно добавляет «Значок + активность», если сейчас нет движения/события;
- какое значение появится вместо иконки и почему иногда остаётся иконка;
- как пользовательский размер, угол, icon и activity color выглядят вместе;
- не взяла ли логика вспомогательный switch, status LED или диагностическую сущность;
- какой интеграцией HA фактически предоставлена привязка.

Сейчас визуал строится поздно, уже на плане, через несколько связанных функций (`_visualSamples`, `_deviceVisual`, `_stateClass`, `_actEntity`, форматирование value и `_renderDevice`). Попытка нарисовать упрощённый пример прямо в форме неминуемо создаст расхождение с настоящим marker.

## 3. Цели

1. Дать точный ответ «как это устройство будет выглядеть на плане сейчас» до Save.
2. Объяснить, почему получен именно такой визуал, не требуя знания entity ID и внутренних приоритетов.
3. Сделать режимы «Значок» и «Значок + активность» различимыми даже у спокойного устройства.
4. Сделать «Значение вместо иконки» предсказуемым для числовых и текстовых состояний.
5. Показывать реальную интеграцию-провайдера без эвристик по имени/модели.
6. Исключить повторную реализацию логики отображения внутри диалога.
7. Не менять данные плана, HA state или runtime активности до подтверждённого Save.
8. Подготовить самостоятельный компонент, который можно будет перенести при будущем разделении длинного диалога по HP-UX-04.

## 4. Не входит в задачу

- симулятор всех возможных состояний сущности;
- управление устройством из предпросмотра;
- изменение state или service call в Home Assistant;
- редактирование интеграции, config entry, entity registry или device registry;
- настройка отдельных цветов для working/open/alarm;
- новая пользовательская настройка источника состояния;
- полный предпросмотр комнатного Glow, солнечных лучей или заливки комнаты;
- отдельный каталог/логотипы интеграций;
- сохранение названия интеграции в marker;
- изменение модели `display` или добавление нового режима;
- изменение визуальной семантики, уже утверждённой в `2026-08-05-device-visual-state-design.md`, кроме явно описанного ниже расширения текстового value.

## 5. Термины

- **Binding provider** — интеграция HA, которой принадлежит выбранная `device:*` или `entity:*` привязка.
- **Visual source** — сущность или набор сущностей, по которым resolver вычисляет подложку и activity marker прямо сейчас.
- **Value source** — единственная сущность/derived reading, текст которой может заменить иконку.
- **Actual preview** — реальный результат для текущих HA states и несохранённых полей формы.
- **Effect demo** — локальная краткая демонстрация ordinary activity без изменения HA и без записи runtime-события marker.
- **Draft marker** — временная проекция полей открытого диалога, не входящая в `_markers` и server config.
- **Fallback to icon** — предсказуемое отображение базовой/морфирующейся иконки, когда value получить нельзя.

## 6. Размещение и структура интерфейса

### 6.1. Место в диалоге

Блок располагается непосредственно после select **«Отображение»** и его короткой подсказки. Настройки activity color/size и общий size/rotation остаются рядом с ним.

Порядок секции:

1. Иконка.
2. Отображение.
3. Предпросмотр.
4. Настройки activity, если выбран `icon_ripple`.
5. Размер и поворот.

Предпросмотр обновляется и от последующих полей, поэтому после изменения activity/size/angle пользователь остаётся в той же прокрученной области и сразу видит результат выше. Допускается сделать stage `position: sticky` только внутри широкого desktop layout при доказанном отсутствии конфликтов с `hp-dialog`; базовое ТЗ требует обычный блок в потоке без вложенной прокрутки.

### 6.2. Состав блока

```text
Предпросмотр                                     [Сейчас]

┌──────────────────── stage ─────────────────────┐
│                  [ marker ]                    │
└────────────────────────────────────────────────┘

Предоставлено интеграцией   Local Tuya (localtuya)
Источник отображения        Water switch · switch.water_switch
Текущее состояние           Включено
Результат                   Работает · жёлтая подложка

[Показать пример активности]   — только для «Значок + активность»
```

Обязательные части:

- заголовок «Предпросмотр»;
- badge **«Сейчас»** или **«Пример»**;
- визуальная stage;
- всегда видимая строка интеграции;
- краткие строки источника, состояния и результата;
- раскрываемые технические подробности для сложных случаев;
- demo-кнопка только когда она имеет смысл.

### 6.3. Визуальная stage

- нейтральный фон использует текущие theme tokens House Plan, а не белый hardcode;
- stage не изображает комнату и не обещает точный Glow;
- marker использует те же CSS classes, CSS variables, icon morph, value, badges и activity ring, что на плане;
- stage не имеет pointer actions marker и не открывает more-info;
- max `size`/`ripple_size` не создаёт horizontal scroll и не обрезается молча;
- если полный bounding diameter не помещается, весь preview-face пропорционально уменьшается, а рядом появляется подпись `Предпросмотр уменьшен до 60%`; отношение icon/ring сохраняется;
- фактический размер на плане продолжает определяться card `icon_size`, marker `size` и текущим zoom; stage показывает пропорции, а не сантиметры.

## 7. Actual preview — основной контракт

Actual preview является значением по умолчанию и отвечает только на вопрос «что видно сейчас».

Он учитывает:

- текущий `hass.states`;
- актуальные device/entity registries;
- выбранный draft binding;
- draft `icon` или фактический auto icon;
- draft `display`;
- draft `tapAction`;
- draft `controls`;
- draft `isLight`;
- draft `useClimateTemp`;
- draft `rippleColor`, `rippleSize`, `size`, `angle`;
- card `live_states`, `show_temperature`, `show_signal`;
- выбранную/автоматически определённую комнату и effective space settings, необходимые для тех же badges, что на плане;
- существующий activity runtime исходного marker, если редактируется уже размещённый объект и binding/source не изменился.

Для этого пункта «source не изменился» имеет формальное значение: совпадает
`activitySourceSignature`, построенная из binding, effective `sourceKind`,
отсортированных пар `role + entity_id` всех effective visual/critical sources и
текущего value source. Порядок ключей в registry и порядок одинаковых controls
не влияют на сигнатуру; добавление, удаление или замена effective control,
изменение роли сущности либо binding меняют её. Runtime window исходного marker
можно читать только при точном совпадении этой сигнатуры.

Actual preview не учитывает как визуальные настройки marker:

- имя;
- model/description/link/manuals;
- несохранённую room position;
- координаты marker;
- hide/show как ghost-стиль.

Если marker пользовательски скрыт, preview всё равно показывает его будущий **видимый** дизайн, а рядом выводит состояние `Скрыто с плана`. Иначе ghost подавит значения/эффекты и предпросмотр перестанет решать задачу.

## 8. Effect demo

### 8.1. Причина

У спокойного устройства «Значок» и «Значок + активность» выглядят одинаково. Пользователь должен увидеть выбранные цвет и размер кольца до реального движения или события.

### 8.2. Поведение

- Кнопка RU: **«Показать пример активности»**.
- EN: **“Preview activity effect”**.
- Доступна только при `display: icon_ripple`, когда сейчас нет ни alarm, ни
  реального ordinary activity (`event`, `presence`, `transition`, `running`).
- Во время реального ordinary activity кнопка disabled и имеет подсказку
  `Эффект уже виден в реальном состоянии`.
- Клик запускает локальный `event`-эффект на 3,3 секунды с draft color/size.
- Badge `Сейчас` временно меняется на `Пример`.
- Строки интеграции, source и current state продолжают показывать реальные данные.
- Result явно говорит `Демонстрация эффекта; состояние HA не изменено`.
- Повторный клик перезапускает окно.
- Закрытие диалога немедленно очищает demo timer.
- Demo не пишет `_activityRt`, не создаёт event marker, не вызывает service и не влияет на marker на плане.
- Любой новый реальный эффект (`event`, `presence`, `transition`, `running` или
  `alarm`) немедленно прекращает demo. Реальность всегда имеет приоритет;
  draft-кольцо и фактическое кольцо одновременно не рисуются.
- `prefers-reduced-motion` показывает статическое кольцо и объясняет, что анимация отключена системной настройкой.

Постоянный симулятор working/open/alarm не добавляется: он создаст второй state editor и смешает реальность с примером.

## 9. Интеграция, предоставившая устройство

### 9.1. Две разные строки

Предпросмотр различает:

1. **«Предоставлено интеграцией»** — владелец binding;
2. **«Источник отображения»** — сущность, которая фактически определяет визуал.

Пример:

```text
Предоставлено интеграцией   Local Tuya (localtuya)
Источник отображения        Лампа кухни · light.kitchen · Hue
```

Это корректно для marker, привязанного к Local Tuya switch, но управляющего Hue light через `controls`.

### 9.2. Авторитетный resolver провайдера

```ts
interface IntegrationProvider {
  domain: string;
  label: string;
  configEntryId?: string;
  configEntryTitle?: string;
  confidence: 'registry-owner' | 'entity-platform' | 'identifier-fallback';
}

resolveBindingProviders(hass, binding, metadata): IntegrationProvider[]
```

#### `device:<id>`

Приоритет:

1. `device.config_entry_id` в актуальном HA;
2. legacy `device.config_entries[]` до завершения совместимости HA;
3. уникальные `entity.platform` активных сущностей устройства;
4. domain из `device.identifiers` только как последний fallback.

В Home Assistant 2026.8 устройство принадлежит одному config entry. Старый merged-device может временно дать несколько providers; UI показывает уникальный список, а не выбирает первый случайный.

#### `entity:<entity_id>`

Приоритет:

1. `entity.platform` как domain интеграции, создавшей сущность;
2. `entity.config_entry_id`, если доступен, для config entry title;
3. raw domain entity ID не является integration domain и не используется вместо `platform`.

#### `virtual`

```text
Предоставлено интеграцией   House Plan · виртуальное устройство
```

Это явно не HA integration и не должно выглядеть как неизвестная ошибка.

### 9.3. Человекочитаемое название

Для `domain` используется следующий fallback chain:

1. локализованное название компонента, уже доступное в HA frontend;
2. имя integration manifest;
3. config entry title, если он не дублирует пользовательское имя устройства;
4. raw domain в читаемом виде.

Рекомендуемый вывод: `Local Tuya (localtuya)`, `MQTT (mqtt)`, `Template (template)`.

Config entry title может выводиться второй строкой/tooltip, например `Котельная · localtuya`, но не подменяет название интеграции: title часто является пользовательским экземпляром, а не типом provider.

### 9.4. Запрещённые эвристики

Нельзя определять интеграцию по:

- имени marker;
- `friendly_name`;
- model/manufacturer;
- ключевым словам `Tuya`, `Zigbee`, `Matter`;
- первой сущности в несортированном объекте;
- только `identifiers[0][0]`, когда registry/config entry metadata доступны.

Существующий `domainOfDevice()` решает внутреннюю задачу фильтрации и не должен автоматически становиться пользовательским resolver интеграции.

### 9.5. Несколько providers

Для legacy merged device или нескольких источников:

- строка binding provider показывает максимум два label и `ещё N`;
- tooltip/раскрытые подробности содержат полный уникальный список;
- сортировка стабильна: registry-owner первым, затем label/domain;
- повторяющиеся domains/config entries дедуплицируются;
- providers external `controls` не смешиваются с владельцем binding, а показываются у соответствующих visual sources.

### 9.6. Загрузка metadata

- получение config entries/manifests выполняется лениво только при открытом marker dialog;
- результат кешируется на уровне card по registry/config revision;
- открытие/Save не блокируются ожиданием красивого label;
- raw `entity.platform` показывается сразу;
- после загрузки manifest/config entry строка обновляется без скачка stage;
- ошибка metadata lookup не ломает preview и не создаёт toast: остаётся raw domain;
- внешние сетевые запросы к сайтам интеграций запрещены.

Metadata-fetches допустимы в текущей архитектуре, потому что marker/device
dialog доступен только при `_canEdit`, то есть администратору HA. Это явный
инвариант функции, а не предположение о правах обычного пользователя. Если в
будущем gate редактора будет ослаблен, доступность config-entry/manifest WS для
не-администратора необходимо заново проверить, а недоступность metadata должна
по-прежнему давать безопасный raw-domain fallback без поломки preview.

## 10. Источник отображения и объяснение

### 10.1. Один структурированный результат

Текущие `_visualSamples`, `_deviceVisual`, `_stateClass`, `_actEntity`, value/icon/badge calculations преобразуются в общий pure projection:

```ts
interface ResolvedDevicePresentation {
  binding: string;
  providers: IntegrationProvider[];

  sourceKind: 'cover' | 'light' | 'controls' | 'device_role' | 'primary' | 'none';
  visualSources: ResolvedPresentationSource[];
  criticalSources: ResolvedPresentationSource[];
  valueSource: ResolvedValueSource | null;

  visual: DeviceVisualState;
  display: 'badge' | 'icon_ripple' | 'value';
  icon: string;
  valueText: string | null;
  valueFullText: string | null;
  fallbackReason: ValueFallbackReason | null;
  activity: DeviceActivity;

  classes: string[];
  tempText: string | null;
  humText: string | null;
  lqiText: string | null;
  lightColor: string | null;
  explanation: PresentationExplanation;
}
```

План и preview получают один объект; диалог лишь добавляет human-readable строки из `explanation`.

### 10.2. Приоритет источников

Сохраняется текущий контракт:

1. cover, если draft tap action явно `cover`;
2. effective `resolvedLightSources`, включая external controls и явный `isLight`;
3. `resolvedDeviceStateEntities` по функциональной роли;
4. primary fallback;
5. критические сущности добавляются отдельно и могут переопределить результат alarm.

Preview не получает упрощённый «первый entity» path.

### 10.3. Пользовательское объяснение

Технические enums не показываются как основной текст.

| Internal | RU result |
|---|---|
| `available + neutral + none` | `Доступно · нейтральный значок` |
| `working + running`, badge | `Работает · жёлтая подложка` |
| `working + running`, icon_ripple | `Работает · жёлтая подложка и активность` |
| `open` | `Открыто/разблокировано · оранжевая подложка` |
| cover open | `Открыто · состояние показано формой иконки` |
| `presence` | `Присутствие обнаружено · постоянное кольцо` |
| `event` | `Зафиксировано событие · короткие волны` |
| `transition` | `Устройство движется · кольцо до завершения` |
| `unavailable` | `Недоступно · приглушённое отображение` |
| `alarm` | `Тревога · красная подложка и критическая пульсация` |

Для media player preview явно объясняет нейтральное powered/playing состояние: `Воспроизведение не считается работой устройства`. Для cover объясняет отсутствие жёлтой подложки. Для composite switch с Power entity объясняет: `Состояние берётся из питания; вспомогательные переключатели не учитываются`.

### 10.4. Несколько visual sources

Основная строка показывает:

- один источник — friendly name + entity ID;
- два — оба friendly names;
- три и более — `3 источника` с кратким агрегированным состоянием.

Раскрытие «Подробнее» показывает таблицу:

| Поле | Содержание |
|---|---|
| Сущность | локализованное имя + `entity_id` |
| Интеграция | provider этой сущности |
| Состояние | `hass.formatEntityState` |
| Роль | основной источник / control / свет / критическая тревога |

Debug IDs доступны, но не загромождают основной UX.

### 10.5. Особый случай пылесоса

Для marker с `marker.vacuum.live` preview показывает только общее **лицо базы**:
иконку или value, подложку, badges и activity по тем же правилам, что обычный
marker. Отдельный движущийся puck робота и клиентский/серверный след внутри
preview-stage не рисуются: это координатная механика плана, а не часть face.

Explanation дополнительно сообщает: `Живой робот и след отображаются на плане`.
На самом плане puck и trail продолжают использовать существующий runtime; общий
presentation resolver определяет лицо базы и не получает ответственность за
геометрию или историю следа.

## 11. Поведение трёх display modes

### 11.1. «Значок» (`badge`)

- показывает effective icon;
- учитывает state icon morph;
- показывает status plate;
- не показывает ordinary activity;
- alarm всё равно показывает красную critical activity;
- temp/hum/LQI badges следуют фактическим настройкам карточки;
- Result объясняет, что обычная активность отключена выбранным display.

### 11.2. «Значок + активность» (`icon_ripple`)

- включает всё из «Значок»;
- добавляет semantic event/presence/transition/running activity;
- использует draft `rippleColor` и `rippleSize` для ordinary activity;
- alarm всегда использует критический красный стиль, игнорируя пользовательский цвет;
- при отсутствии реальной активности stage честно совпадает с «Значок», а demo-кнопка показывает разницу;
- если `live_states: false`, actual preview нейтрален, explanation сообщает `Живые состояния выключены в настройках карточки`; demo остаётся доступной как помеченный пример.

### 11.3. «Значение вместо иконки» (`value`)

Режим расширяется до числовых **и текстовых** состояний без нового config value.

Приоритет value:

1. derived temperature, когда текущий marker действительно показывает climate/device temperature;
2. derived humidity по текущей логике marker;
3. одна однозначная `valueSource` из effective source resolver;
4. иначе fallback к icon.

Форматирование:

- использовать `hass.formatEntityState` / существующий `hassValue`;
- numeric obeys `display_precision`, locale and unit HA;
- text state локализуется HA (`on` → `Включено`, `open` → `Открыто`);
- unit не дублируется;
- текст в одну строку, с max width и ellipsis;
- полное значение доступно в `title`, `aria-label` и explanation;
- собственное округление House Plan запрещено.

Одинаковый контракт длинного value применяется на основном плане, в preview и
в `houseplan-space-card`:

- face сохраняет существующий `min-width: var(--dev-size)` и внутренние отступы;
- ширина может расти с текстом, но ограничивается
  `max-width: calc(var(--dev-size) * 4)`;
- `.valtext` занимает доступную ширину и использует
  `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`;
- hit area и layout-box marker ограничены тем же max-width и не расширяются до
  полного скрытого текста;
- полный локализованный текст доступен в `title`, `aria-label` и explanation;
- renderer не переносит value на вторую строку и не влияет полным текстом на
  соседние hit areas, автокомпоновку или kiosk layout.

Fallback к icon применяется, когда:

- нет state object;
- state пуст;
- state `unknown`/`unavailable`;
- visual source set неоднозначен и нельзя честно выбрать одно value;
- значение не является scalar string/number/boolean;
- binding virtual и не имеет state.

Слишком длинная, но валидная строка **не** вызывает fallback: она сокращается визуально через ellipsis, полное значение сохраняется доступным. Preview обязан написать причину настоящего fallback, например `Несколько источников состояния — показана иконка`.

Статусная подложка и alarm продолжают применяться к value badge. Обычная activity в value mode не рисуется.

### 11.4. Однозначность value source

Value source считается однозначным, если effective visual role содержит одну сущность. Для нескольких controls/lights/passive sources нельзя молча брать первый элемент объекта или primary другой роли.

Это намеренное уточнение текущего поведения. Оно предотвращает ситуацию, когда подложка агрегируется по группе ламп, а текст неожиданно берётся из несвязанного primary устройства.

## 12. Draft updates

| Изменение формы | Обновление preview |
|---|---|
| Binding | новый DevItem, provider, source, state, auto icon и visual |
| Virtual/HA mode | provider House Plan либо HA; state reset |
| Controls add/remove | пересчитать sources, status, activity, value ambiguity и source integrations |
| Tap action → cover | cover становится source/value/icon morph до Save |
| `isLight` | пересчитать light source и working status |
| `useClimateTemp` | добавить/убрать derived temperature value/badge |
| Custom icon | мгновенно заменить base icon |
| Reset to auto icon | восстановить актуальный auto icon без записи override |
| Display | немедленно сменить icon/activity/value presentation |
| Activity color/size | обновить реальную activity или следующий demo frame |
| Size/angle | обновить face и fit scale |
| Room | пересчитать effective space display options/badges |
| Name/model/link/description/files | визуал не меняется; provider не пересчитывается по этим полям |
| Hide/Show draft | только badge состояния формы; face остаётся design preview |

Все обновления происходят без Save и без мутации `_serverCfg`, `_markers`, `_devices`, layout и runtime state исходного marker.

## 13. Реактивность HA

Пока диалог открыт:

- новый `hass.states` пересчитывает preview;
- реальное working/presence/transition появляется и исчезает live;
- короткий witnessed event существующего marker использует его текущее runtime window;
- после смены binding/source старое event window не переносится;
- новый draft binding получает baseline и не генерирует ложное событие от первого snapshot;
- device/entity registry update обновляет names, provider, source и disabled/orphaned status;
- завершение 3,3-секундного окна вызывает repaint preview;
- закрытый/backgrounded dialog не держит timers.

Если во время Effect demo приходит любое реальное ordinary/critical событие,
demo отменяется до вычисления следующего кадра и preview сразу показывает
фактический presentation.

Если dialog открыт в момент внешнего изменения server config, применяется существующая optimistic/revision policy. Preview сам не является основанием перезаписывать внешний config.

## 14. Состояния binding

| Binding | Preview |
|---|---|
| Active | полный actual preview |
| Active, state unavailable | приглушённый marker, integration/source видны |
| HA-disabled | служебный disabled face без live status; explanation с причиной; Show остаётся заблокирован по отдельному ТЗ |
| Orphaned | `mdi:help-circle`/сохранённый icon, integration `не определена`, source `привязка не найдена` |
| Removed tombstone в Add | не выбирается; preview не создаётся |
| User-hidden | видимый design preview + badge `Скрыто с плана` |
| Virtual | neutral custom/auto icon; provider House Plan; value fallback reason |
| Binding ещё не выбран | placeholder и инструкция выбрать устройство |

Preview использует центральный resolver из
`2026-08-08-ha-disabled-devices-design.md`. Локальные проверки `disabled_by` и
отдельная имитация disabled/orphaned внутри preview запрещены.

## 15. Responsive layout и touch

### 15.1. Desktop

Reference environment: desktop browser, fine pointer, mouse/keyboard.

- при достаточной ширине stage и explanation располагаются двумя колонками;
- minimum text column позволяет длинным RU/EN labels переноситься;
- entity IDs используют `overflow-wrap: anywhere`;
- footer `hp-dialog` не сдвигается и не обрезается;
- блок не создаёт отдельного вертикального/горизонтального scrollbar;
- stage не меняет ширину диалога при activity ring.

### 15.2. Touch classification

По `docs/TOUCH-SUPPORT.md`:

- **Device editor: best effort / intentionally degraded.** Полный комфорт preview гарантируется на desktop.
- На touch preview, если показан, складывается в одну колонку и не должен перекрывать Save/Cancel/Delete/Hide.
- Effect demo может отсутствовать на touch, если его корректный responsive вариант дорог.
- Интеграция и текстовое explanation остаются доступны, если сам dialog устройства доступен.
- Safety floor обязателен: preview не вызывает service, не меняет config и не ломает выход в View.
- Дорогая touch-полировка не должна усложнять общий renderer или View.

### 15.3. Narrow desktop

Небольшая ширина окна с fine pointer остаётся поддерживаемым desktop editing case. В отличие от touch-устройства, narrow desktop обязан сохранить всю функциональность preview в stacked layout без horizontal scroll.

## 16. Доступность

- Stage имеет `role="img"` и полный локализованный `aria-label`: имя marker, integration, state, visual result.
- Цвет не является единственным объяснением: Result всегда называет смысл текстом.
- Техническое раскрытие доступно с клавиатуры.
- Demo — настоящий `<button>`, имеет видимый focus и объявляет начало/окончание примера без частого live-region spam.
- Actual state changes используют ненавязчивый `aria-live="polite"`; alarm допускает `assertive` только один раз на переход.
- Полное ellipsized value доступно screen reader.
- `prefers-reduced-motion` заменяет движения статическим эквивалентом.
- Preview не добавляет marker в tab order как интерактивное устройство.
- Контраст всех status chips соответствует WCAG AA в поддерживаемых темах.

## 17. Архитектура реализации

### 17.1. Разделение projection и DOM

Предлагаемые чистые модули:

```text
src/device-presentation.ts
  resolveDevicePresentation(...)
  resolvePresentationSources(...)
  resolveValuePresentation(...)
  explainDevicePresentation(...)

src/integration-provider.ts
  resolveBindingProviders(...)
  resolveEntityProvider(...)
  integrationDisplayName(...)

src/hp-device-preview.ts
  Lit presentation component; no config writes/services
```

Допускаются другие filenames, но три ответственности не смешиваются:

1. semantic projection;
2. integration provenance;
3. preview UI.

### 17.2. Общий renderer лица marker

Из `_renderDevice` выделяется face renderer, например:

```ts
renderDeviceFace(
  presentation: ResolvedDevicePresentation,
  options: {
    surface: 'interactive-plan' | 'preview' | 'static-card';
    interactive: boolean;
  },
): TemplateResult
```

Plan wrapper продолжает отвечать за coordinates, pointer events, new dot и tooltip. Preview wrapper отвечает за stage fit и explanation. Icon/value/badges/activity DOM общий.

`houseplan-space-card` и её `space-render.ts` также обязаны получать тот же
`ResolvedDevicePresentation` и вызывать тот же face renderer. Static wrapper
отвечает только за свои координаты и не копирует icon/value/badge/activity DOM.
Таким образом, после задачи существуют три wrappers (interactive plan, preview,
static card), но ровно одна semantic projection и одна реализация face.

Нельзя копировать текущий фрагмент `<ha-icon> / .valtext / .activity-ring` в новый компонент вручную.

### 17.3. Draft DevItem

Создать pure helper:

```ts
deviceFromMarkerDraft(hass, dialogDraft, buildContext): DevItem | null
```

Он повторно использует текущие binding/auto-icon/primary/control helpers, но не вставляет объект в `_devices`. Для existing marker сохраняется runtime identity только пока binding и effective sources не менялись.

### 17.4. Explanation codes

Pure resolver возвращает стабильные reason codes, а не готовые английские строки:

```ts
type PresentationReason =
  | 'neutral'
  | 'working'
  | 'working_activity'
  | 'open'
  | 'cover_icon_state'
  | 'presence'
  | 'event'
  | 'transition'
  | 'media_neutral'
  | 'unavailable'
  | 'alarm'
  | 'live_states_disabled'
  | 'value_no_state'
  | 'value_ambiguous_sources'
  | 'value_non_scalar'
  | 'vacuum_live_plan_only'
  | 'hidden_design_preview'
  | 'composite_power_source'
  | 'activity_display_disabled'
  | 'ha_disabled'
  | 'orphaned';
```

I18n layer собирает RU/EN explanation. Проверки не должны сравнивать длинный prose string.

### 17.5. Metadata cache

- integration provider cache keyed by config-entry/domain + registry revision;
- in-flight запросы дедуплицируются;
- disconnect диалога не обязан отменять общий safe promise, но результат не обновляет уничтоженный component;
- registry/config entry changes инвалидируют соответствующие entries;
- cache не сериализуется в config/localStorage.

### 17.6. Runtime event isolation

Effect demo хранится внутри preview component. Existing activity snapshot читается read-only. Preview никогда не вызывает `_stampActivity` и не использует marker ID для demo timer.

## 18. Модель данных и совместимость

- `Marker.display` остаётся `badge | icon_ripple | value`.
- Legacy `ripple` продолжает читаться как `icon_ripple`.
- Новых persist fields нет.
- Integration/provider не сохраняется: registry остаётся источником истины.
- Text value является расширением runtime-рендера существующего `display: value`.
- Text value и отказ от случайного первого source применяются не только к
  preview, но и к уже сохранённым marker на interactive/static плане сразу
  после обновления frontend.
- Backend validation не меняется.
- Config/model version не повышается.
- Open → Cancel не меняет ничего.
- Open → Save без изменений должен остаться byte-semantically эквивалентным с учётом уже существующих нормализаций.
- Старые HA без formatter показывают raw state через существующий fallback.
- Старые HA с `device.config_entries[]` поддерживаются до окончания заявленного HA compatibility window.

### 18.1. Видимое изменение существующих планов

Задача намеренно меняет отображение уже сохранённых marker с `display: value`:

1. однозначное локализованное текстовое состояние теперь показывается как value;
2. несколько равноправных sources больше не выбирают первый случайный state —
   marker показывает icon fallback с reason `value_ambiguous_sources`;
3. длинный текст ограничивается общим face-контрактом из §11.3.

Миграция данных и opt-in не требуются, но оба первых изменения должны быть
отдельно названы в RU/EN `docs/CHANGELOG*.md` как user-visible changes. Мелкая
формулировка `small fixes and improvements` для них недостаточна.

## 19. Производительность

- semantic resolver pure и memoizable;
- preview пересчитывается только при изменении draft-relevant полей, HA sources или global display settings;
- изменение unrelated entity state не должно создавать тяжёлый полный `buildDevices` специально ради preview;
- manifest/config-entry metadata не загружается на каждый render;
- animation использует CSS и существующие ring primitives;
- скрытый/закрытый dialog не держит RAF;
- target: изменение select/slider визуально отражается в следующем animation frame без заметной задержки;
- preview не должен существенно увеличивать обычную стоимость `_renderDevice` на плане.

## 20. Безопасность и целостность

- Stage `pointer-events` не запускает marker action.
- Demo не вызывает HA service.
- Provider metadata экранируется как текст; HTML от integration title не принимается.
- Raw entity/config IDs не включаются в внешние URL.
- «Открыть в HA» остаётся отдельным существующим действием, не частью preview stage.
- Preview не подтверждает и не сохраняет настройки.
- Ошибка resolver отображает safe fallback и логируется без падения всего dialog/View.
- Внешний state update не переписывает draft поля пользователя.

## 21. I18n

Минимальный набор новых ключей RU/EN:

```text
marker.preview.title
marker.preview.actual
marker.preview.example
marker.preview.integration
marker.preview.source
marker.preview.current_state
marker.preview.result
marker.preview.details
marker.preview.demo_activity
marker.preview.demo_notice
marker.preview.demo_already_visible
marker.preview.virtual_provider
marker.preview.unknown_provider
marker.preview.no_binding
marker.preview.hidden_notice
marker.preview.scaled
marker.preview.multiple_sources
marker.preview.more_sources
marker.preview.value_fallback.*
marker.preview.reason.vacuum_live_plan_only
marker.preview.reason.*
```

Интеграционные label не переводятся House Plan вручную; используются HA metadata/fallback domain.

## 22. Тестовый план

### 22.1. Unit: presentation projection

1. Neutral sensor → neutral icon.
2. Working switch → yellow badge.
3. Working switch + icon_ripple → yellow + running.
4. Motion edge → event window.
5. Presence on → persistent presence.
6. Cover tap intent → cover source, morph, no yellow open state.
7. Controls override device role.
8. Alarm secondary entity overrides ordinary source.
9. Media player playing remains neutral; off is faded.
10. Composite Power switch ignores option switches.
11. `live_states: false` suppresses ordinary state/activity, not alarm.
12. Hidden design preview renders visible face with notice.
13. Disabled/orphaned safe projections.
14. Plan and preview receive structurally equal presentation for the same saved marker/draft.
15. Static card receives the same presentation and face structure.
16. Vacuum base resolves normally; live puck/trail остаются вне face projection.

### 22.2. Unit: value mode

1. Numeric sensor obeys HA formatted precision/unit.
2. RU decimal separator and unit appear once.
3. Text `on/off/open` uses HA localization.
4. Long text remains value with ellipsis/full text.
5. unknown/unavailable falls back to faded icon with reason.
6. Missing state falls back with reason.
7. Non-scalar value falls back.
8. Multiple controls do not pick first arbitrarily.
9. Derived temperature/humidity priority remains compatible.
10. Alarm styling remains in value display.
11. Existing saved numeric marker keeps expected face within the new shared width contract.
12. Existing saved text marker changes from icon fallback to localized value.
13. Existing ambiguous marker changes from arbitrary value to explained icon fallback.

### 22.3. Unit: integration provenance

1. Device with `config_entry_id` resolves owner domain/name.
2. Legacy `config_entries[]` deduplicates providers.
3. Entity binding uses `entity.platform`.
4. Effective external control shows its own source integration separately.
5. Manifest/localized name missing → raw domain.
6. Identifier fallback used only without better metadata.
7. Virtual → House Plan.
8. Orphaned → unknown, no crash.
9. User-edited model/name cannot change provider.
10. Metadata cache invalidates on registry/config entry revision.

### 22.4. Component tests

1. Every draft field from §12 updates preview before Save.
2. Cancel causes zero config/layout mutations.
3. Effect demo lasts 3,3 s and never touches `_activityRt`/services.
4. Real ordinary activity or alarm interrupts demo before the next frame.
5. Reduced motion renders static demo.
6. Details disclosure has correct keyboard/focus behavior.
7. Long integration/source/state wraps without horizontal scroll.
8. Max size/ripple fits and exposes scale notice.
9. Footer remains visible and stable.
10. Preview closes cleanly with dialog replacement/nested dialog flows.
11. Demo button is disabled with an explanation while a real effect is visible.
12. Activity runtime is reused only for an exactly equal `activitySourceSignature`.

### 22.5. Browser smoke: parity

Для набора fixtures сравниваются **interactive plan marker, preview face и
`houseplan-space-card` static face**:

- light off/on;
- motion event;
- presence;
- climate idle/heating;
- cover closed/open/opening;
- media player off/playing;
- valve closed/opening/open;
- alarm;
- numeric sensor;
- text sensor;
- multiple controls;
- unavailable;
- custom icon/size/angle/activity color.
- vacuum base с `marker.vacuum.live` — face одинаков; puck/trail исключены из
  face-parity и не требуются внутри preview/static stage;
- user-hidden marker с видимым design preview и отдельным hidden notice;
- `live_states: false` с подавленной ordinary activity и сохранённым alarm;
- сохранённые value-marker до/после новых правил: long text и ambiguous sources.

Проверяются DOM classes, icon, value text, title/aria-label полного значения,
badges и CSS variables. Для P1 отдельно фиксируется миграционный visual diff
существующих saved fixtures. Pixel screenshot дополняет, но не заменяет
структурные assertions.

### 22.6. Responsive/manual

- desktop wide, medium and narrow fine-pointer;
- RU/EN;
- light/dark HA themes;
- browser zoom 80/100/150%;
- reduced motion;
- очень длинные device/integration/entity names;
- rapid state changes while dialog open;
- binding switch во время active event;
- touch best-effort: stage не перекрывает footer, demo не обязателен, выход безопасен.

## 23. Критерии приёмки

Функция готова, если:

1. В marker dialog всегда есть preview для выбранного binding/virtual marker.
2. Preview меняется до Save от всех визуально значимых draft fields.
3. Saved interactive marker, static marker и preview используют один semantic projection и face renderer.
4. Preview показывает binding integration для device/entity и House Plan для virtual.
5. Integration определяется registry/config metadata, а не именем/model.
6. External visual source другой интеграции показан отдельно и не подменяет owner binding.
7. Пользователь видит source, localized current state и human-readable result.
8. «Значок + активность» имеет безопасную local demo при отсутствии реального эффекта.
9. Demo не меняет HA, config, layout или marker runtime.
10. Text state корректно отображается в `value`; unknown/unavailable/ambiguous имеют объяснимый icon fallback.
11. HA formatter определяет локаль, precision и unit.
12. Alarm, cover, media player, controls и light semantics совпадают с планом.
13. Preview не создаёт horizontal scroll и не ломает dialog footer.
14. Цвет не является единственным объяснением результата.
15. Open/Cancel не меняет данные.
16. Нет нового persist field или migration.
17. View performance и поведение marker не ухудшились.
18. Desktop поддержан полностью; touch соответствует best-effort/safety policy.
19. Long value на всех трёх поверхностях использует единый max-width/ellipsis и
    не расширяет соседние hit areas.
20. Реальное ordinary/critical событие всегда прерывает Effect demo.
21. Vacuum preview показывает лицо базы и честно объясняет отсутствие puck/trail.
22. RU/EN changelog отдельно сообщает оба изменения поведения существующего
    `display: value`.

## 24. Решения, заложенные в ТЗ и требующие подтверждения владельца

1. **Preview по умолчанию показывает реальное состояние сейчас**, а не заранее выбранный красивый пример.
2. **Для `icon_ripple` добавляется отдельная кнопка локальной демонстрации activity** на 3,3 секунды.
3. **Строки provider и visual source разделены.** Интеграция binding не подменяется интеграцией external control.
4. **Режим value начинает показывать локализованные текстовые состояния**, а не только числа.
5. **Длинный валидный text value сокращается ellipsis, но не заменяется иконкой.**
6. **При нескольких равноправных visual sources value не выбирает первый случайный**, а показывает иконку и объясняет неоднозначность.
7. **Hidden marker показывает видимый design preview с отдельной подписью**, а не бесполезный ghost.
8. **Preview не пытается рисовать полный комнатный Glow**, но объясняет light-source result.
9. **Friendly integration label улучшается асинхронно**, raw domain доступен сразу и достаточен как fallback.
10. **Новое text/ambiguous поведение value применяется к уже сохранённым
    планам** и документируется как видимое изменение, без миграции данных.
11. **Interactive plan, preview и `houseplan-space-card` используют один face
    renderer**; статическая карточка не является исключением.
12. **Реальный ordinary/critical эффект всегда важнее Effect demo** и немедленно
    прекращает демонстрацию.

## 25. Связанные документы и источники

- `docs/superpowers/specs/2026-08-05-device-visual-state-design.md` — утверждённая семантика availability/status/activity.
- `docs/FILTERING.md`, раздел `What a marker SHOWS` — фактический приоритет sources.
- `docs/TOUCH-SUPPORT.md` — desktop-first редакторы и best-effort touch.
- `docs/superpowers/specs/2026-08-08-ha-disabled-devices-design.md` — forced hidden/disabled binding.
- [Home Assistant Frontend data](https://developers.home-assistant.io/docs/frontend/data/) — registry/config-entry/manifest contexts и форматирование entity state.
- [Home Assistant WebSocket API](https://developers.home-assistant.io/docs/api/websocket/) — `entity.platform` как integration, создавшая entity.
- [HA 2026.8: device registry single config entry](https://developers.home-assistant.io/blog/2026/07/21/device-registry-single-config-entry/) — актуальный владелец device и legacy compatibility.
