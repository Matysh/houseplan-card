# Issue #90 — управляемый бейдж со значением рядом с устройством

- **Статус:** реализовано локально / ревизия 2 после ревью 2026-08-11; ожидает beta-проверки
- **Issue:** https://github.com/Matysh/houseplan-card/issues/90
- **Область:** frontend, marker config, backend validation, import/export, документация и QA
- **Приоритет:** P2
- **Тип:** feature / UX

## 1. Резюме

В настройках каждого устройства появляется явная настройка отдельного бейджа
со значением. Пользователь самостоятельно решает:

1. нужен ли бейдж;
2. какое конкретно значение Home Assistant он показывает;
3. с какой стороны маркера он расположен: справа, снизу, слева или сверху.

Checkbox, источник и положение являются live-настройками: существующий блок
предпросмотра обязан сразу показывать итоговый marker вместе с бейджем именно
так, как он будет выглядеть на плане.

Новая настройка заменяет неявный выбор температуры/влажности по иконке и
`primary`-сущности для явно настроенных устройств. Старые нетронутые
конфигурации продолжают выглядеть как раньше. Бейдж является независимой
поверхностью и не заменяет существующий режим «Значение вместо иконки».

## 2. Проблема текущей реализации

Сейчас компактное значение около маркера определяется скрытыми эвристиками:

- температура появляется только у `mdi:thermometer`, `mdi:air-filter` либо при
  включённом `use_climate_temp`;
- влажность появляется только тогда, когда именно `primary`-сущность признана
  датчиком влажности;
- температура и влажность не имеют пользовательского выбора источника;
- два показателя потенциально претендуют на одно и то же место справа;
- LQI всегда располагается снизу и не участвует в раскладке с другими
  показателями;
- изменение автоматической иконки или порядка сущностей может незаметно
  изменить отображение;
- глобальное поле `show_temperature` фактически управляет и температурой, и
  влажностью, но не объясняет конкретный выбор источника;
- режим «Значение вместо иконки» решает другую задачу и не позволяет оставить
  обычную иконку с выбранным показанием рядом.

Результат непредсказуем: пользователь видит либо случайно подходящее значение,
либо не видит ничего и не может объяснить или исправить результат в UI.

## 3. Пользовательская ценность

### 3.1. Оценка

**Ценность: высокая, 8/10.** Это не декоративная настройка, а устранение
необъяснимого поведения одного из основных элементов плана.

Функция позволяет без отдельных карточек показывать рядом с устройством:

- температуру, влажность, заряд батареи, мощность, расход, давление;
- состояние бинарного датчика или реле;
- положение шторы/клапана;
- текущую температуру climate-устройства;
- громкость media player;
- средний LQI;
- состояние явно управляемого источника.

Особенно полезны мультисенсоры и сложные HA-устройства, у которых десятки
сущностей и текущая эвристика почти неизбежно выбирает не то либо ничего.

### 3.2. Почему это лучше автоматической эвристики

- результат объясним и воспроизводим;
- изменение иконки не меняет значение;
- один marker показывает ровно один выбранный внешний бейдж;
- пользователь может осознанно распределить бейджи вокруг плотной группы;
- preview становится достоверным инструментом настройки;
- сохранённая ссылка переживает перестановку сущностей в реестре HA.

## 4. Цели

1. Дать пользователю прямое управление одним внешним value-бейджем marker.
2. Сделать выбор источника стабильным и не зависящим от порядка registry rows.
3. Обеспечить одинаковый результат на полном плане, статической карточке
   пространства и в preview редактора.
4. Исключить перекрытие нижнего value-бейджа и LQI.
5. Сохранить внешний вид существующих нетронутых конфигураций.
6. Не связывать выбор бейджа с влиянием устройства на комнатную температуру,
   свет, controls, Glow или заливку комнаты.

## 5. Не входит в задачу

- несколько пользовательских value-бейджей у одного marker;
- произвольное перетаскивание бейджа мышью;
- ручной offset, размер шрифта, цвет, фон и рамка;
- формулы, шаблоны, единицы пользователя, prefix/suffix;
- изменение алгоритма режима «Значение вместо иконки»;
- автоматическое предотвращение пересечения бейджа с соседними устройствами;
- использование произвольных сложных JSON-атрибутов HA;
- изменение комнатных подписей и метрик комнаты.

## 6. Термины

- **Внешний value-бейдж** — компактная плашка рядом с marker, управляемая этой
  задачей.
- **Внутреннее значение** — содержимое marker в режиме «Значение вместо
  иконки» (`display: value`). Это другая поверхность.
- **Системный LQI** — существующая небоксированная подпись качества связи под
  marker, управляемая `show_signal` и настройкой пространства.
- **Источник бейджа** — сохранённая конкретная HA-сущность, её поддерживаемый
  атрибут либо производное значение House Plan.
- **Legacy auto** — существующая эвристика температуры/влажности для marker без
  новой явной настройки.

## 7. UX диалога устройства

### 7.1. Размещение

Новый блок располагается в настройках устройства **после поля
«Отображение» и его пояснения, непосредственно над предпросмотром**.

В свёрнутом состоянии отображается одна строка:

> `[ ] Отображать бейдж со значением`

Если флаг включён, ниже раскрываются два поля:

1. **Значение** — выпадающий список доступных источников;
2. **Расположение** — выпадающий список:
   - Справа;
   - Снизу;
   - Слева;
   - Сверху.

Порядок в списке расположений нормативный: `right`, `bottom`, `left`, `top`.
По умолчанию используется **Справа**.

### 7.2. Поведение

- Все изменения немедленно отражаются в существующем preview.
- Preview показывает не условную схему, а тот же resolved badge, текст,
  позицию, unavailable-состояние и LQI-layout, что полный план и статическая
  карточка пространства. Сохранение для обновления preview не требуется.
- Выключение чекбокса скрывает два поля, но сохраняет последний источник и
  позицию. Повторное включение восстанавливает их.
- Если пользователь включает чекбокс впервые, рекомендуемый источник
  выбирается только в локальном draft и отражается в preview. Он записывается
  в config лишь потому, что включение checkbox является явным действием
  пользователя. Простое открытие диалога рекомендацию не материализует. Если
  источников нет, checkbox disabled и под ним
  показано: «У этого устройства нет доступных значений».
- Если сохранённый источник временно отсутствует, чекбокс остаётся доступным,
  выпадающий список содержит отдельную выбранную строку «Источник недоступен»
  и предупреждение. Пользователь может сохранить настройку, отключить бейдж
  или выбрать другой источник.
- При явной смене HA-привязки в том же диалоге источник старой привязки не
  переносится: выбирается рекомендация новой привязки либо бейдж отключается,
  если кандидатов нет.
- В `display: static_icon` сохранённый чекбокс показывается disabled с
  объяснением: «Статичный значок не показывает живые значения». Настройка не
  удаляется и восстанавливается после возврата в динамический display mode.
- Для скрытого marker preview продолжает показывать его реальный дизайн по
  существующему `designPreview`-контракту.

### 7.3. Текст строк списка

Каждая опция должна показывать:

- понятное имя показателя;
- friendly name сущности, если одного имени показателя недостаточно;
- текущее форматированное значение вторичной строкой;
- entity id/attribute в tooltip либо вторичной технической строке.

Примеры:

- `Температура · Датчик климата` — `23,4 °C`;
- `Текущая температура · Кондиционер` — `24,1 °C`;
- `Заряд батареи · Датчик двери` — `78 %`;
- `Состояние · Реле света` — `Включено`;
- `Положение · Штора` — `35 %`;
- `Качество Zigbee-сигнала (среднее)` — `142`.

Технический entity id не должен заменять friendly name, но всегда должен быть
доступен для диагностики.

## 8. Доступные источники

### 8.1. Общий принцип

Dropdown строится только из источников, связанных с текущим marker:

1. активные сущности его `device:`/`entity:` binding;
2. прямые активные HA-сущности из `controls`;
3. прямые `marker:*` targets из `controls` как производное состояние;
4. производный собственный state пассивного/виртуального источника света;
5. производный средний LQI текущего устройства.

Для `marker:*` бейдж не обходит controls/light graph самостоятельно: он
потребляет уже разрешённое состояние существующего канонического resolver из
#84. Второго обхода, собственного определения `on/off` и отдельного cycle
resolver не создаётся.

Произвольные сущности со всего Home Assistant не предлагаются. Это сохраняет
смысл настройки «значение этого устройства» и не превращает dropdown в общий
entity picker.

### 8.2. State сущности

Допускается state активной сущности, если:

- сущность принадлежит разрешённому набору выше;
- её domain не `button` и не `event`;
- `entity_category` не равен `config`;
- state является строкой, числом или boolean либо временно отсутствует;
- сущность не отключена в HA.

Диагностические сущности допускаются: battery, power, energy, signal и другие
измерения являются ценными кандидатами. `unknown`/`unavailable` не удаляют
строку из списка — источник может восстановиться.

### 8.3. Поддерживаемые атрибуты

Чтобы не показывать сотни служебных полей и не сохранять сложные объекты,
разрешён централизованный allowlist скалярных атрибутов:

| Domain | Атрибуты |
|---|---|
| `climate` | `current_temperature`, `temperature`, `current_humidity`, `humidity` |
| `water_heater` | `current_temperature`, `temperature` |
| `cover`, `valve` | `current_position` |
| `fan` | `percentage` |
| `humidifier` | `current_humidity`, `humidity` |
| `light` | `brightness` |
| `media_player` | `volume_level` |
| `vacuum`, `lawn_mower` | `battery_level`, `fan_speed` |

В список попадает только реально объявленный атрибут либо уже сохранённая
ссылка на него. Allowlist хранится в одном frontend-модуле вместе с metadata:
локализованное имя, единица/преобразование и порядок.

Преобразования:

- `brightness` 0–255 → 0–100%;
- `volume_level` 0–1 → 0–100%;
- `current_position`, `percentage`, humidity и `battery_level` → проценты;
- температуры форматируются в единицах HA;
- остальные значения используют HA formatter либо безопасный fallback.

Произвольные строковые/массивные атрибуты (`entity_picture`, `hvac_modes`,
`supported_features` и т. п.) не предлагаются.

### 8.4. Производные источники

Поддерживаются два производных типа:

- **Средний LQI** — тот же `lqiFor()`, который использует текущий системный
  индикатор;
- **Состояние marker-источника** — итоговое `on/off` для пассивного источника
  или прямого `marker:*` target, вычисленное существующим light/control graph.

Если внешний value-бейдж показывает средний LQI, отдельный системный LQI у
этого marker не рисуется, чтобы не дублировать одно значение.

### 8.5. Рекомендация при первом включении

Рекомендуемый источник выбирается детерминированно:

1. существующий legacy climate temperature при `use_climate_temp: true`;
2. существующий legacy temperature;
3. существующий legacy humidity;
4. `primary` state, если он допустим;
5. temperature;
6. humidity;
7. battery;
8. первый функциональный state по существующему role resolver;
9. первый прочий кандидат в стабильном порядке entity id;
10. средний LQI.

Порядок реестра HA не используется как семантический приоритет.

## 9. Форматирование значения

1. Для state сначала вызывается `hass.formatEntityState()`.
2. Для атрибута сначала вызывается HA attribute formatter, если он доступен.
3. Если HA formatter отсутствует или не вернул пригодный текст, применяется
   нормативное преобразование §8.3.
4. Последний fallback — существующий безопасный scalar formatter House Plan;
   отдельный параллельный formatter для badge не вводится.
5. Суффикс и единица (`°C`, `°F`, `%` и т. п.) входят в готовый текст resolver.
   `device-face.ts` не приклеивает `°`/`%`: иначе при переводе legacy
   temperature/humidity на общий badge получится двойная единица.
6. `0`, `false`, `off`, `closed` являются валидными значениями и не скрывают
   бейдж.
7. `unknown`, `unavailable`, отсутствующий source и невалидный scalar дают
   видимый бейдж `—` с приглушённым unavailable-стилем и полным объяснением в
   tooltip/accessible label. Позиция при этом не прыгает.
8. Длинный текст сокращается многоточием. Полное локализованное значение
   остаётся в `title` и accessibility-описании.
9. Значение рендерится только как текст; HTML из HA не интерпретируется.

## 10. Взаимодействие с существующими режимами

| Режим/настройка | Результат |
|---|---|
| Значок + динамическая подложка | Внешний бейдж показывается по настройке |
| Значок + активность | Бейдж показывается; activity ring проходит позади него |
| Значение вместо иконки | Внутреннее и внешнее значения независимы; допускаются разные источники |
| Значение вместо иконки и тот же source | Допускается, preview показывает неблокирующее предупреждение о дублировании |
| Всегда статичный значок | Внешний бейдж подавлен, настройка сохранена |
| `live_states: false` | Явный бейдж продолжает показывать доступное HA-значение; статусная подложка остаётся нейтральной |
| Явно выключенный бейдж | Legacy temperature/humidity для marker не показывается |
| Явно включённый бейдж | Имеет приоритет над глобальным `show_temperature` |
| Per-space `label_temp`, `label_hum`, `label_lqi`, `label_light` | Не подавляют явно настроенный value-badge: это свойство marker. Тумблеры продолжают управлять штатными room labels |
| Показ системного LQI выключен на card/space | Системная строка LQI скрыта; явно выбранный value-badge, включая source LQI, остаётся видимым |
| Источник badge = LQI | Показывается выбранный boxed badge; отдельный LQI скрыт |
| Скрытый/HA-disabled marker | Marker и его бейдж не показываются по общему lifecycle-контракту |

Выбор бейджа не изменяет статус устройства, activity, light role, Glow,
controls, комнатные метрики и click action.

## 11. Раскладка

### 11.1. Якоря

Бейдж привязывается к внешнему прямоугольнику `.dev`, а не к glyph и не к
activity ring:

- `right`: центр бейджа по вертикали, начало за правой гранью marker;
- `left`: центр по вертикали, конец перед левой гранью;
- `top`: центр по горизонтали, нижняя грань над marker;
- `bottom`: центр по горизонтали, верхняя грань под marker.

Зазор и размеры вычисляются от `--dev-size`, поэтому масштаб конкретного
устройства, zoom, kiosk scale и статическая space-card дают одинаковые
пропорции. Поворот glyph не поворачивает бейдж.

### 11.2. Конфликт с LQI

Если position = `bottom` и системный LQI одновременно видим:

1. value-бейдж располагается первым, ближе к marker;
2. LQI располагается второй строкой ниже;
3. общий контейнер центрируется относительно marker;
4. между строками сохраняется масштабируемый gap;
5. ни один элемент не меняет выбранную пользователем сторону автоматически.

При `top`, `left` и `right` системный LQI остаётся на штатном нижнем якоре.
Если value source сам является LQI, отдельная строка LQI подавляется.

### 11.3. Другие пересечения

- Activity ring может проходить под бейджем, но не сдвигает его и не вызывает
  layout jump.
- Бейдж имеет `pointer-events: none`, поэтому не создаёт новую click target и
  не мешает hover/drag marker.
- Автоматический flip у края плана запрещён: явно выбранная сторона стабильна.
- Соседние marker и подписи комнат автоматически не перестраиваются.
- Родительский слой не должен обрезать бейдж по прямоугольнику самого marker.

### 11.4. Safe area предпросмотра и текущая регрессия clipping

В текущем `hp-device-preview` размер preview рассчитывается преимущественно по
диаметру marker/activity ring, а `.previewstage` использует
`overflow: hidden`. В результате существующий боковой temperature/humidity
badge может быть слегка обрезан границей stage. Это подтверждённая регрессия и
часть scope issue #90, а не допустимое ограничение preview.

Новый preview обязан учитывать **полный визуальный bounding box** face:

- marker plate;
- activity ring;
- внешний value-бейдж в выбранной позиции;
- системный LQI;
- нижний стек value badge + LQI;
- HA-disabled/new-device служебные badges, если они присутствуют.

Алгоритм fit/центрирования использует максимальные extents всех этих элементов
и оставляет не менее одного масштабируемого gap до каждой границы previewstage.
Нормативный browser-assert сравнивает `getBoundingClientRect()` бейджа и stage:
`badge.left >= stage.left + gap`, `badge.right <= stage.right - gap`, аналогично
по вертикали. Проверка выполняется для четырёх позиций, минимальной ширины
диалога, максимального activity ring и legacy temperature/humidity badge.
Нельзя исправлять clipping простым `overflow: visible`, если это позволяет
бейджу залезть в facts-колонку или за скругление preview-карточки. Допустимы:

1. внутренний safe-area wrapper с рассчитанным padding;
2. вычисление fit по расширенному face bounding box;
3. комбинация обоих подходов.

При смене right → bottom → left → top marker остаётся визуально центрированным
в доступной области вместе со спутниками, без скачка размера stage. Длинное
значение сначала сокращается до нормативной max-width, затем участвует в fit.
Legacy temperature/humidity badge до явной настройки также получает этот fix.

## 12. Модель данных

### 12.1. TypeScript

```ts
type ValueBadgePosition = 'right' | 'bottom' | 'left' | 'top';

type ValueBadgeSource =
  | { kind: 'entity_state'; entity_id: string }
  | { kind: 'entity_attribute'; entity_id: string; attribute: string }
  | { kind: 'derived_lqi' }
  | { kind: 'derived_marker_state'; ref: `marker:${string}` };

interface MarkerValueBadge {
  enabled: boolean;
  source?: ValueBadgeSource | null;
  position: ValueBadgePosition;
}

interface MarkerCfg {
  // ...
  value_badge?: MarkerValueBadge | null;
}
```

`enabled: false` разрешает сохранять последний `source` и `position`. Для
`enabled: true` отсутствие source является допустимым только как runtime
состояние старого/повреждённого конфига; UI не создаёт такую запись.

### 12.2. Backend validation

Backend семантически проверяет новую или изменяемую пользователем запись:

- известный `kind`;
- строковый `entity_id` формата HA;
- attribute из frontend/backend общего allowlist;
- канонический `ref` формата `marker:<id>` для derived marker — тот же формат
  и те же helper/правила broken reference, что у `controls` (#84);
- position из четырёх значений;
- boolean `enabled`;
- согласованность discriminated union.

Произвольный attribute, пустой id/ref и несогласованная форма union
отклоняются **на записи нового/изменённого badge**. Неизвестные соседние ключи
в `value_badge` и `source` сохраняются (`ALLOW_EXTRA`) по downgrade-контракту
`docs/CONFIG-COMPATIBILITY.md`: чтение и round-trip конфига из будущей версии
не падают и не стирают неизвестные данные.

### 12.3. Ссылки, удаление и import remap

`derived_marker_state.ref` является внутренней marker-ссылкой наравне с
`controls[] = marker:<id>`:

- import/export #50 добавляет её в таблицу remap внутренних id;
- при импорте пространства target id ремапится вместе с `marker.id`;
- target вне импортируемого пространства снимается, badge становится
  `enabled: false`, position сохраняется, а import preview увеличивает счётчик
  отброшенных внешних marker-ссылок;
- атомарная очистка/удаление target marker из #84 обрабатывает badge тем же
  общим helper: source сохраняется как broken/missing для runtime-диагностики,
  но не перепривязывается молча;
- badge не добавляет ребро управления и не обходит граф, поэтому не создаёт
  отдельного цикла сверх уже проверенного `controls` graph.

## 13. Совместимость и миграция

### 13.1. Отсутствующее поле

`value_badge == null/undefined` означает **legacy compatibility**, а не
явное выключение:

- renderer выполняет текущую temperature/humidity эвристику без изменения;
- `show_temperature` продолжает управлять этим legacy-результатом;
- существующие планы остаются pixel-identical до явного изменения настройки.

### 13.2. Диалог старого marker

Для marker без `value_badge` UI строит эффективный draft:

- если legacy badge сейчас существует — checkbox визуально включён, выбран
  тот же source, position = right;
- иначе checkbox выключен, но dropdown заранее получает рекомендуемый source;
- draft содержит внутренний `valueBadgeTouched = false`.

Сохранение других полей не материализует новую настройку. `value_badge`
записывается только после взаимодействия с checkbox/source/position. Это
защищает конфигурацию от случайной миграции при временно неполном registry.

### 13.3. Явная настройка

- `enabled: false` полностью подавляет legacy temperature/humidity этого
  marker независимо от `show_temperature`;
- `enabled: true` показывает выбранный source независимо от
  `show_temperature`;
- глобальное `show_temperature` сохраняется как compatibility-настройка для
  marker без явного `value_badge` и не удаляется из schema;
- новые marker используют тот же draft/recommendation contract, но не получают
  произвольный generic badge без действия пользователя.

### 13.4. `use_climate_temp`

Существующее поле сохраняет ответственность за участие climate
`current_temperature` в средней температуре комнаты.

- У marker без новой настройки оно также сохраняет старое поведение badge.
- У явно настроенного marker оно **не управляет внешним badge**.
- Текст настройки меняется с «Использовать датчик температуры устройства» на
  «Учитывать температуру устройства в комнате»; help объясняет, что внешний
  badge настраивается ниже отдельно.

Так выбор показания не начинает неявно менять агрегаты комнаты и наоборот.

## 14. Runtime-архитектура

### 14.1. Один resolver

Добавляется чистый `resolveDeviceValueBadge()` либо эквивалентный модуль,
который получает:

- `hass`/registry projection;
- `DevItem`;
- marker config;
- effective display/global compatibility settings;
- уже вычисленные presentation/light sources при необходимости.

Результат:

```ts
interface ResolvedValueBadge {
  configured: boolean;
  enabled: boolean;
  source: ValueBadgeSource | null;
  sourceLabel: string;
  text: string;
  fullText: string;
  position: ValueBadgePosition;
  availability: 'available' | 'unavailable' | 'missing';
  isLqi: boolean;
}
```

`ResolvedDevicePresentation` получает одно поле `valueBadge`. Старые
`tempText`/`humText` перестают быть независимыми renderer decisions: legacy
эвристика также преобразуется в этот единый результат. В одном face никогда
не рендерятся два внешних value-бейджа.

### 14.2. Один renderer

`device-face.ts` рендерит единый DOM:

```html
<span class="value-badge pos-right available">23,4 °C</span>
```

Полный план, preview и static space-card используют тот же
`ResolvedDevicePresentation`. Ни один renderer не выбирает source и не
форматирует значение самостоятельно.

`hp-device-preview` не имеет права повторно вычислять источник или позицию. Он
получает готовый `valueBadge`, использует общий `renderDeviceFace()` и отдельно
решает только задачу безопасного fit полного face bounding box (§11.4).

### 14.3. Кандидаты редактора

Список кандидатов строится только при открытом диалоге и memoize-ится по:

- binding;
- active registry revision;
- controls;
- relevant state/attribute signature.

Plan render не строит dropdown candidates. Новых подписок к HA не добавляется.

## 15. Lifecycle и edge cases

| Ситуация | Нормативное поведение |
|---|---|
| Значение равно `0` | Показать `0` с единицей |
| State `off`/`false` | Показать локализованное состояние |
| `unknown`/`unavailable` | Стабильный бейдж `—`, unavailable style |
| Сущность временно исчезла из `hass.states` | Бейдж `—`; source не переназначать |
| Registry row удалён после сохранения | Бейдж `—`; editor показывает missing source |
| HA-disabled source внутри активного device | Бейдж `—`; не подменять другой сущностью |
| HA-disabled весь binding | Marker скрыт по lifecycle-контракту |
| Смена friendly name | Label обновляется, source id сохраняется |
| Смена unit system HA | Значение переформатируется без миграции config |
| Source меняет numeric state на text | HA-formatted text показывается, если scalar |
| Source начинает возвращать object/array | Бейдж `—`; HTML/JSON не выводить |
| Обычное виртуальное устройство без HA binding, light role и controls | Checkbox disabled: нет кандидатов |
| Пассивный forced-light marker без контроллеров | Доступно его каноническое derived marker state: по #84 источник имеет состояние всегда |
| Виртуальный passive light с входящим controller | Доступно уже resolved derived marker state |
| Несколько controls | Каждый прямой source — отдельная явная опция |
| Target marker удалён | Сохранённый source missing, без silent fallback |
| Controls graph изменён | Сохранённый source остаётся либо становится missing |
| Marker size изменён | Бейдж масштабируется от `--dev-size` |
| Glyph повёрнут | Бейдж остаётся горизонтальным |
| Нижний badge + LQI | Стек: badge ближе, LQI ниже |
| Badge source = LQI | Только boxed value badge, без дубликата LQI |
| `display: value` | Внутреннее и внешнее значения независимы |
| `display: static_icon` | Badge подавлен, config сохранён |
| User-hidden marker в device editor | Ghost marker следует существующему контракту |
| Импорт старой конфигурации | Поле отсутствует → legacy auto |
| Экспорт/импорт новой конфигурации | Source и position round-trip без изменений |

## 16. Accessibility и touch

- Бейдж не является отдельной интерактивной целью.
- Accessible name marker дополняется: «{имя устройства}, {имя показателя}:
  {полное значение}».
- Внутренний span скрывается от screen reader либо маркируется так, чтобы
  значение не читалось дважды.
- `—` сопровождается текстом «значение недоступно», а не читается как
  необъяснимый символ.
- Все label/select связаны программно; checkbox имеет описание причины
  disabled.
- В режиме просмотра touch hit target остаётся marker, бейдж не перехватывает
  tap/pinch/pan.
- Редактор на touch остаётся best-effort согласно общей политике проекта, но
  нативные select/checkbox должны быть доступны.

## 17. I18n и документация

Новые строки добавляются синхронно в RU/EN:

- `marker.value_badge.enabled`;
- `marker.value_badge.source`;
- `marker.value_badge.position`;
- четыре позиции;
- no candidates / unavailable / missing / duplicate notices;
- названия allowlisted attributes и derived sources;
- обновлённые label/help `use_climate_temp`.

`<hp-help>` обязателен у checkbox включения, поля source и поля position. Для
них добавляются пары `<key>.help` и `<key>.help.aria` в RU/EN по контракту #68;
тест паритета help-реестра обязателен.

Обновить:

- `docs/USER-GUIDE.ru.md` и английский пользовательский документ;
- `docs/ARCHITECTURE.md` — marker presentation/data model;
- `docs/TESTING.md`;
- пример marker config;
- changelog значимой beta.

## 18. Безопасность и производительность

- Все значения проходят текстовое Lit-binding; `unsafeHTML` запрещён.
- Attribute source ограничен allowlist, backend повторяет проверку.
- Runtime не сканирует весь HA registry для каждого marker.
- Сохранённый source не вызывает service calls.
- Изменение live value не должно пересоздавать marker DOM или запускать
  анимацию layout; меняется только текст/availability class.
- Snapshot visual continuity обязан сохранять и badge, чтобы возврат на вкладку
  не давал промежуточный legacy/пустой кадр.
- Фича укладывается в существующий large-house/performance профиль и его
  fail-closed сверку окружения; отдельный профиль и новый бюджет не заводятся.
  Существующие candidate/beta performance checks не ослабляются.

## 19. План реализации

1. Добавить типы, constants/allowlist и frontend/backend schema.
2. Обновить import/export и validation tests.
3. Реализовать candidate discovery, recommendation и formatter.
4. Реализовать `resolveDeviceValueBadge` и интегрировать в
   `ResolvedDevicePresentation`.
5. Перевести legacy temp/humidity projection на единый resolved badge.
6. Добавить draft/touched/save lifecycle в диалог marker.
7. Добавить UI и live preview.
8. Заменить `.tval/.hval` единым четырёхпозиционным CSS-компонентом и LQI stack.
9. Обновить static card, tooltip/accessibility и visual snapshot capture.
10. Добавить unit, backend, DOM smoke и golden fixtures.
11. Обновить документацию и выпустить через beta согласно promotion rule.

## 20. Тестовая матрица

### 20.1. Unit/frontend

- четыре позиции;
- source state: numeric/text/binary/zero/false;
- каждый allowlisted attribute и преобразование percent/temperature;
- unknown/unavailable/missing/non-scalar;
- deterministic recommendation;
- explicit on/off overrides legacy/global setting;
- legacy marker остаётся pixel/semantic compatible;
- bottom + LQI stack и LQI dedup;
- static mode suppression with config preservation;
- display=value independence;
- hidden/disabled lifecycle;
- binding change reset;
- candidate filtering and stable ordering;
- source ids survive rename/reorder.
- explicit badge не зависит от `label_temp`/`label_hum`/`label_lqi`/`label_light`;
- системный LQI продолжает зависеть от своих card/space toggles.

### 20.2. Backend/import-export

- все valid union variants;
- invalid kind/position/entity/attribute rejected на новой/изменённой записи;
- unknown extra keys переживают read/round-trip;
- enabled true without source rejected on write, но существующий повреждённый
  config читается без падения и даёт `—`;
- `marker:<id>` remap, external target drop/disable и import preview counter;
- full/partial export-import round-trip;
- old config without field accepted.

### 20.3. Browser/visual

- preview = interactive plan = static card;
- RU/EN long labels do not create horizontal dialog scroll;
- изменение checkbox/source/position без сохранения немедленно обновляет
  preview;
- marker scale 0.5/1/3;
- icon rotation 0/137°;
- activity ring behind badge;
- all four positions in light/dark theme;
- bottom badge with visible LQI;
- legacy правый temperature/humidity badge целиком помещается в preview;
- ни один из четырёх badge anchors не обрезается previewstage при минимальной
  ширине диалога и при activity ring максимального размера;
- long value ellipsis/title;
- touch pointer events do not steal marker click or pinch;
- visual continuity after tab hide/restore.

Golden fixtures должны содержать минимум один marker для каждой позиции и
отдельный нижний badge + LQI. **Любой ненулевой diff существующих golden
считается регрессом.** Новые эталоны принимаются только из полного
Linux-артефакта CI по действующему HP-QA-01 контракту.

### 20.4. Мутационный гейт #85

Для каждого мутанта сохраняются исполнимый patch/команда и имя краснеющего
теста:

1. Удалить touched gate, чтобы сохранение чужого поля материализовало
   `value_badge` → падает `marker value badge untouched save preserves legacy`.
2. Игнорировать `enabled: false` и вернуть legacy temperature/humidity → падает
   `explicit disabled value badge suppresses legacy metric`.
3. Заставить `hp-device-preview` вычислять source самостоятельно вместо
   `ResolvedDevicePresentation.valueBadge` → падает
   `device preview consumes resolved value badge verbatim`.
4. При missing source выбрать первый candidate → падает
   `missing value badge source never falls back silently`.
5. Не подавлять системный LQI при source `derived_lqi` → падает
   `derived lqi value badge renders exactly once`.
6. Убрать full-face safe gap/fit → browser-тест
   `preview value badge bounding box stays inside stage` падает хотя бы для
   right/left либо max activity ring.

## 21. Критерии приёмки

1. В диалоге над preview есть checkbox «Отображать бейдж со значением».
2. При включении доступны source и одна из четырёх позиций.
3. Выбранный source, а не иконка/порядок entities, определяет значение.
4. Full plan, preview и static card показывают одинаковый badge.
5. Checkbox, source и position обновляют preview немедленно, до сохранения.
6. Бейдж ни с одной стороны не обрезается в preview; текущая регрессия
   бокового legacy-бейджа исправлена.
7. Внешний badge не перекрывает системный LQI при нижней позиции.
8. Одновременно рендерится не более одного внешнего value-бейджа marker.
9. Missing/unavailable source не заменяется молча другим и показывает `—`.
10. Explicit off действительно убирает legacy temperature/humidity.
11. Explicit on работает независимо от глобального `show_temperature`.
12. Старые нетронутые markers выглядят как до изменения, кроме исправленного
    clipping в preview.
13. `static_icon` остаётся полностью статичным.
14. Badge не меняет свет, Glow, controls и комнатные агрегаты.
15. Config проходит backend validation и import/export round-trip.
16. RU/EN, keyboard, screen reader и touch-view контракты выполнены.
17. Реализация выходит сначала в beta/RC.

## 22. Сложность, риски и оценка

### 22.1. Сложность

**Средняя/выше средней.** Сам UI прост, но корректная функция затрагивает
семантический projection, schema, три renderer surface, compatibility и
registry lifecycle.

Оценка инженерного объёма:

| Блок | Оценка |
|---|---:|
| Модель, validation, import/export | 0,5–1 день |
| Resolver/candidates/formatting/compatibility | 1–1,5 дня |
| Dialog UX и preview | 0,5–1 день |
| Legacy temp/humidity → единый resolver с pixel parity | 0,5–1 день |
| Full-face preview fit и измеримый safe area | 0,5–1 день |
| Renderer/CSS/LQI layout/a11y | 0,5–1 день |
| Tests, golden, docs, beta hardening | 1–1,5 дня |
| **Итого** | **4,5–8 рабочих дней, одна beta-итерация** |

### 22.2. Основные риски

| Риск | Вероятность/ущерб | Снижение |
|---|---|---|
| Регрессия старых temp/humidity | средняя/высокий | absence = legacy, touched gate, parity fixtures |
| Source исчезает после registry refresh | высокая/средний | stable ref, `—`, no silent fallback |
| Перегруженный dropdown сложного устройства | средняя/средний | scope, grouping, allowlist, ordering |
| Несовпадение plan/preview/static | средняя/высокий | единый presentation resolver и face renderer |
| Перекрытия с LQI/activity | средняя/средний | нормативный stack и golden matrix |
| Clipping спутников в узком preview | высокая/средний | full-face extents, safe area и browser matrix |
| Скрытое изменение room average | низкая/высокий | полное разделение badge и climate aggregate |
| Новая per-state работа ухудшит render | низкая/средний | memo/snapshot, candidates только в dialog |
| Слишком длинные текстовые states | высокая/низкий | max-width, ellipsis, full accessible text |

## 23. Принятые продуктовые решения и вопросы

Блокирующих вопросов для начала реализации нет. В этом ТЗ предложены следующие
решения, которые должны считаться нормативными после принятия issue:

1. Один внешний пользовательский бейдж на marker.
2. Явная per-device настройка важнее глобального `show_temperature`.
3. Нетронутые marker остаются на legacy auto без принудительной миграции.
4. Системный LQI сохраняется; снизу элементы складываются в стек.
5. `static_icon` подавляет бейдж, не стирая настройку.
6. Неизвестное значение показывается как стабильный `—`, а не исчезает.
7. Выбор badge source не влияет на среднюю температуру комнаты.
8. Поддерживаются states связанных сущностей и ограниченный набор полезных
   scalar attributes; произвольные attributes не поддерживаются.
