# Issue #98 — единая система пульсаций и активности устройства

- **Issue:** https://github.com/Matysh/houseplan-card/issues/98
- **Статус ТЗ:** реализовано локально; ожидает prerelease/CI gate
- **Приоритет:** P1 / polish
- **Оценка:** сложность 7/10, пользовательская ценность 7/10, ценность для
  разработки 8/10, score `(2×7+8)/7 = 3,14`
- **Риск:** средне-высокий — общий renderer, finite edge runtime, alarm safety
  и parity трёх surfaces меняются одновременно
- **Область:** frontend presentation, runtime событий, общий renderer устройства,
  editor preview, static card, i18n, accessibility, документация и QA
- **Модель данных:** без изменений
- **Связано:** #22 (pending/click feedback), #73 (visual continuity), #90
  (value badge), #31 (полная View accessibility), `docs/LIGHT.md`,
  `docs/ARCHITECTURE.md`
- **Touch:** View/kiosk полностью поддерживаются; device editor остаётся
  desktop-first, его preview на touch — best effort по `docs/TOUCH-SUPPORT.md`

## 1. Резюме

House Plan должен использовать один понятный визуальный язык для динамики
устройства. Вокруг сохранённого marker допускаются ровно три вида
анимированной индикации:

1. **Тревога** — красная непрерывная пульсация, пока активно критическое
   состояние.
2. **Короткое событие** — три конечные волны общей длительностью около 3,3 с.
3. **Постоянная активность** — спокойная непрерывная пульсация, пока устройство
   действительно работает, перемещается или обнаруживает присутствие.

Статичных колец больше нет. При `prefers-reduced-motion: reduce` обычная
активность обозначается компактной сплошной точкой внутри подложки, а тревога
остаётся понятной по красной подложке и доступному описанию.

Семантические причины `event / presence / transition / running` сохраняются.
Они проецируются общим pure resolver в визуальные `none / alarm / short /
continuous`. Один renderer используется на интерактивном плане, в
`hp-device-preview` и в `houseplan-space-card`.

Хранимые значения `display`, `ripple_color` и `ripple_size` не меняются.
Старый `display: ripple` продолжает читаться как `icon_ripple`.

## 2. Проблема текущей реализации

Сейчас единая пользовательская идея реализована несколькими путями:

- `device-visual.ts` классифицирует semantic activity;
- `houseplan-card.ts` и `space-card.ts` отдельно держат finite runtime;
- `device-presentation.ts` скрывает обычную activity для части display modes;
- `device-face.ts` рисует `.activity-ring`;
- тревога рисуется отдельно через `.dev.alarm::after`;
- presence является статичным кольцом;
- reduced motion превращает все activity-эффекты в статичное кольцо;
- preview умеет показать только один абстрактный event-demo;
- UI называет параметры «Цвет/Размер эффекта», не объясняя их область действия.

Из-за этого визуальная система расходится по типам устройств и surfaces.
Пользователь не может предсказать результат выбранной опции, а новый класс
устройства приходится вручную подключать к нескольким renderer/CSS-веткам.

## 3. Цели

1. Один нормативный pipeline от HA state до визуального pulse.
2. Ровно три динамических pulse-kind без статичных колец.
3. Одинаковый результат на полном плане, в preview и static card.
4. Чёткие названия display modes и контекстные подсказки.
5. Предсказуемые приоритеты alarm, short event и continuous activity.
6. Безопасный reduced-motion fallback без мигающих/движущихся колец.
7. Полная совместимость существующей конфигурации.
8. Детерминированные runtime, smoke и golden проверки.

## 4. Не входит в задачу

- новые правила выбора `primary`, binding или visual sources;
- новые классы устройств сверх уже распознаваемой семантики;
- optimistic/pending feedback между кликом и ответом HA — #22;
- изменение Glow, лучей из окон, room fill и light-source resolver;
- анимация live vacuum puck и его следа;
- boot/recovery/navigation animations;
- пользовательская настройка скорости pulse;
- изменение config schema и переименование `ripple_*` в storage;
- автоматическое включение activity mode у существующих marker;
- отдельные цвета/размеры для presence, transition и running.

## 5. Термины и нормативные типы

### 5.1. Semantic activity

Существующий тип остаётся источником причины:

```ts
type DeviceActivity =
  | 'none'
  | 'event'
  | 'presence'
  | 'transition'
  | 'running';
```

- `event` — наблюдённый короткий edge;
- `presence` — устойчивое обнаружение присутствия;
- `transition` — фактическое механическое движение либо короткий terminal
  fallback;
- `running` — устойчивая полезная работа.

### 5.2. Rendered pulse

Вводится визуальная проекция:

```ts
type DevicePulseKind = 'none' | 'alarm' | 'short' | 'continuous';

type DevicePulseReason =
  | 'alarm'
  | 'event'
  | 'presence'
  | 'transition'
  | 'running';

interface ResolvedDevicePulse {
  kind: DevicePulseKind;
  reason: DevicePulseReason | null;
  generation: number;
  color: string | null;
  diameterScale: number;
  expiresAt: number | null;
  reducedMotionIndicator: 'none' | 'dot';
}
```

`kind` определяет DOM/CSS. `reason` сохраняется для preview, diagnostics,
accessible description и будущих расширений, но не создаёт четвёртый вид
анимации. `generation` и `expiresAt` имеют смысл только для `short`:
continuous/alarm не должны перезапускать CSS timeline из-за обычного HA
re-render. `diameterScale` назван отдельно от масштаба самого marker и означает
максимальный диаметр волны в диаметрах подложки.

## 6. Источники семантики

### 6.1. Тревога

Тревога активна, пока хотя бы один разрешённый critical source имеет
критическое состояние:

- `binary_sensor` device class: `smoke`, `gas`, `carbon_monoxide`, `moisture`,
  `safety`, `tamper`, `problem`;
- `siren` в активном состоянии;
- `alarm_control_panel: triggered`;
- остальные случаи, уже канонически возвращаемые `isAlarmState()`.

ТЗ не расширяет `isAlarmState()`. Любое последующее расширение делается в
семантическом resolver и автоматически получает общий alarm pulse.

### 6.2. Короткое событие

Short pulse запускается только от наблюдённого edge после установленного
baseline:

| Источник | Условие |
| --- | --- |
| motion/vibration/sound | валидный `off → on` |
| door/window/garage/opening contact | валидный `off → on` |
| button/event | изменение валидного state/event token |
| stateless action House Plan | подтверждённый успешный service call |
| cover | прямой `closed ↔ open` без наблюдаемого opening/closing |
| lock | прямой `locked ↔ unlocked` без locking/unlocking |
| valve | прямой `closed ↔ open` без opening/closing |

Если в одном HA snapshot обнаружены и ordinary event, и terminal fallback,
выбирается `event`: порядок обхода сущностей и registry rows не влияет на
результат. Между разными snapshot более новый валидный short edge перезапускает
цикл целиком.

Событие не создаётся:

- на первом snapshot;
- при `unknown/unavailable/missing → value`;
- при reconnect/resume/rebuild source graph;
- при неуспешном, отменённом или неподдерживаемом service call;
- от одного только hover, focus, preview re-render или смены display mode.

### 6.3. Постоянная активность

Continuous pulse существует ровно пока semantic state активен:

| Причина | Примеры |
| --- | --- |
| presence | `occupancy/presence = on` |
| transition | cover/lock/valve `opening/closing/locking/unlocking`; moving sensor; vacuum returning |
| running | light/switch/fan/humidifier `on`; running/power binary sensor; climate heating/cooling/preheating/defrosting; vacuum cleaning; script on; распознанные working states техники |
| controls | хотя бы один выбранный canonical visual/control source реально работает |

Ограничения:

- `automation: on` означает enabled, а не running;
- `media_player` не получает continuous pulse от `on/playing/paused`;
- `cover` open/closed остаётся glyph-state, а не working status;
- `unavailable/unknown` снимает обычную activity;
- transition заканчивается сразу при terminal state, без доведения до 3,3 с;
- terminal fallback, наоборот, является short pulse и ограничен finite runtime.

## 7. Приоритеты и projection

Нормативный порядок:

1. удалённый/effective hidden marker не рендерится;
2. HA-disabled design preview и orphaned binding не имеют pulse;
3. `static_icon` возвращает `none` даже при alarm;
4. alarm возвращает `alarm` и перекрывает всё;
5. если `live_states === false`, обычный pulse отсутствует;
6. finite event runtime возвращает `short`;
7. актуальная `presence/transition/running` возвращает `continuous`;
8. иначе `none`.

`unavailable` не является device-level veto само по себе. Resolver сначала
отбрасывает недоступные samples: активный critical source другого entity всё
ещё обязан показать alarm, а доступный рабочий source — continuous. Pulse
отсутствует из-за availability только когда после фильтрации не осталось ни
одного доступного релевантного source. Это сохраняет действующий контракт
`combineVisualSamples()` и не позволяет одному диагностическому entity погасить
реальную тревогу устройства.

Short pulse имеет приоритет над continuous. После окончания short resolver
снова проверяет актуальную семантику и без паузы возвращает continuous, если
устройство продолжает работать.

Если во время terminal fallback появляется реальный transition state, finite
fallback сбрасывается и сразу заменяется continuous transition. При первом
входе в alarm ordinary finite runtime **очищается**, а текущие samples становятся
новым baseline. Замораживание запрещено: после снятия тревоги старый short не
возобновляется, но новый валидный edge, произошедший уже после alarm,
обрабатывается обычно.

## 8. Матрица display modes

Хранимые токены не меняются. `badge` остаётся default.

| Config | RU | EN |
| --- | --- | --- |
| `badge` | Значок + состояние | Icon + state |
| `icon_ripple` | Значок + состояние и активность | Icon + state and activity |
| `value` | Значение + состояние | Value + state |
| `static_icon` | Всегда статичный значок | Always static icon |

### 8.1. Полная матрица

| Режим | Нейтрально / unavailable | Working/open state | Short | Continuous | Alarm | Satellites |
| --- | --- | --- | --- | --- | --- | --- |
| Значок + состояние | текущая тёмная/приглушённая подложка | жёлтая working, оранжевая physical open; cover меняет glyph | нет | нет | красная подложка + alarm pulse | icon/morph, value badge и LQI разрешены |
| Значок + состояние и активность | как выше | как выше | три волны | единая спокойная пульсация | красная подложка + alarm pulse | как выше |
| Значение + состояние | динамическая подложка | жёлтая/оранжевая подложка | нет | нет | красная подложка + alarm pulse | value вместо icon, fallback icon, value badge/LQI |
| Всегда статичный значок | всегда нейтральная тёмная подложка | без изменений | нет | нет | нет | только базовый icon; без morph/value/value badge/LQI/RGB/live-vacuum overlays |

Alarm является safety-исключением для всех state-aware modes. Только явный
`static_icon` скрывает alarm presentation; диалог сохраняет предупреждение для
alarm-capable binding.

Hover, focus outline, shadow и click action не входят в display projection и
остаются одинаковыми по действующему контракту.

## 9. Визуальный контракт

### 9.1. Alarm

- системный цвет `#f25a4a` либо единый design token с тем же контрастом;
- красная plate сохраняется;
- один expanding/fading pulse, непрерывно пока alarm активен;
- пользовательские `ripple_color/ripple_size` игнорируются;
- интенсивность не усиливается при hover;
- частота/opacity не создают WCAG flashing violation.

### 9.2. Short

- ровно три последовательные волны;
- одна волна 1,1 с, total runtime 3,3 с;
- повторный edge увеличивает generation и перезапускает весь цикл;
- старый DOM/timer не накапливается;
- цвет и максимальный диаметр берутся из ordinary activity settings.

### 9.3. Continuous

- один breathing pulse без статичной фазы;
- один общий tempo для presence, transition и running: рекомендуемо 2,4 с
  `ease-in-out infinite`;
- reason не меняет геометрию, скорость и интенсивность;
- выключение/idle/terminal state снимает pulse немедленно;
- смена причины `presence → running` не должна визуально вспыхивать или
  перезапускать timeline, если kind остаётся `continuous`.

### 9.4. Цвет и размер ordinary activity

Порядок цвета:

1. валидный `marker.ripple_color`;
2. текущий RGB canonical light source;
3. `--hp-accent`.

Размер: `marker.ripple_size`, default `3`, текущие backend limits сохраняются.
Параметры применяются только к `short/continuous`, не к alarm и не к
reduced-motion dot.

## 10. Reduced motion и accessibility

При `prefers-reduced-motion: reduce`:

- `.device-pulse` с движущимися кольцами не рендерится либо полностью скрыт;
- alarm читается по красной plate и accessible state;
- working/open читаются по существующим plate/glyph states;
- в `icon_ripple` short/continuous отображаются `.activity-dot`;
- short dot живёт то же finite окно 3,3 с;
- continuous dot существует до окончания semantic state;
- у других display modes dot отсутствует;
- статичное outline/ring запрещено.

Dot находится **внутри нижнего правого угла plate**, а не снаружи marker:

- не конфликтует с `new-device` dot сверху справа;
- не увеличивает bounding box;
- не пересекается с внешним value badge и нижним LQI;
- имеет контрастную 1 px обводку через plate/background token;
- не является интерактивной целью и имеет `aria-hidden="true"`.

Доступное имя/описание marker включает локализованную причину:

- alarm: «Тревога»;
- event: «Короткое событие»;
- presence: «Обнаружено присутствие»;
- transition: «Устройство перемещается/переключается»;
- running: «Устройство работает».

Визуальный эффект не должен быть единственным носителем критической
информации. В рамках #98 обновляется существующее `aria-label` полного marker и
`role="img"` preview; static card сохраняет read-only семантику. Добавление
полной клавиатурной навигации по объектам плана, нового tab order или
`role="button"` относится к #31 и не должно скрыто появиться в этой задаче.

Для alarm кроме motion всегда остаются красная plate и локализованный текст в
доступном имени/информационной поверхности. Для short/continuous отсутствие
анимации при reduced motion не меняет действие по нажатию и hit area.

## 11. UI настроек устройства

### 11.1. Названия и подсказки

Один общий `marker.display_hint` заменяется подсказкой для текущего mode.

Нормативный смысл:

- **Значок + состояние:** plate и icon показывают состояние без обычной
  пульсации; критическая тревога пульсирует красным.
- **Значок + состояние и активность:** дополнительно показывает короткие
  события и непрерывную реальную активность.
- **Значение + состояние:** выводит однозначное HA value, при невозможности —
  state-aware icon; alarm остаётся видимым.
- **Всегда статичный значок:** marker не реагирует на HA state; hover, focus и
  click продолжают работать.

Поля переименовать:

- RU: «Цвет пульсации активности», «Размер пульсации активности»;
- EN: `Activity pulse color`, `Activity pulse size`.

Под полями: «Не влияет на красную тревогу» / `Does not affect red alarms`.

Поля показываются только при `icon_ripple`. Их сохранённые значения не
стираются при временном выборе другого display mode и применяются снова после
возврата.

### 11.2. Preview

`hp-device-preview` получает готовый `ResolvedDevicePulse`, а не вычисляет
activity заново.

В режиме `icon_ripple` доступны две независимые preview-команды:

1. **Показать короткую пульсацию** — запускает local-only short demo на 3,3 с.
2. **Показать постоянную пульсацию** — включает continuous demo до повторного
   нажатия, смены binding/display, появления real pulse или закрытия preview.

Правила:

- demo не меняет HA state, config и основной `_activityRt`;
- real alarm/short/continuous имеет приоритет и отключает demo;
- одновременно активен максимум один demo;
- кнопка continuous меняет label на «Остановить постоянную пульсацию»;
- reduced motion показывает dot и пояснение, а не кольцо;
- preview facts различают reason, даже если rendered kind один;
- fit учитывает максимальный ordinary pulse, alarm pulse и satellites без
  clipping.

## 12. Архитектура

### 12.1. Нормативный pipeline

```text
HA states + registry
  → entityVisualSample(s)
  → combineVisualSamples
  → per-card finite edge runtime
  → resolveDevicePresentation
  → resolveDevicePulse
  → renderDeviceFace/device-pulse
  → interactive plan | preview | static card
```

Рекомендуется отдельный pure module `src/device-pulse.ts`:

```ts
resolveDevicePulse({
  display,
  visual,
  liveStates,
  effectiveHidden,
  bindingStatus,
  runtime,
  rippleColor,
  rippleScale,
  reducedMotion,
}): ResolvedDevicePulse
```

Resolver не читает DOM, timers, `matchMedia` и global state. `now` передаётся
явно через runtime/presentation options для детерминированных тестов.

Полный `ResolvedDevicePresentation` может содержать pulse как вложенную
проекцию, но не должен одновременно оставлять второй нормативный
`activity + classes` path. На время одного beta допускается compatibility
adapter старых классов; бизнес-решение всегда принимается до renderer.

### 12.2. Runtime ownership

Finite runtime остаётся per card instance:

- interactive card и static card не делят Map;
- Map key — стабильный marker id;
- отдельная `activitySourceSignature` включает binding и только
  visual/critical sources, которые способны породить semantic edge;
- signature **не включает** display mode, value/value-badge source, LQI,
  temperature visibility, satellites, icon или preview-only presentation;
- source signature change устанавливает новый baseline;
- runtime хранит `startedAt`, `expiresAt`, semantic reason и generation;
- один timeout только будит render около expiry; истина определяется `now <
  expiresAt`, а не фактом срабатывания timer;
- disconnect очищает timers/Map;
- hidden tab не проигрывает накопившийся short после возврата.

Текущую `presentationSourceSignature()`, которая также включает value source,
нельзя без проверки объявить activity signature: смена бейджа или глобального
`show_temperature` не должна отменять либо искусственно перезапускать pulse.
Допустимо сохранить старую функцию для memo/snapshot и добавить узкую
`activitySourceSignature()` рядом с semantic resolver.

`prefers-reduced-motion` подписывается один раз на surface/card host, а не на
каждый marker. Host передаёт актуальный boolean в pure resolver и вызывает один
re-render при изменении media query. Full card, static card и standalone
preview самостоятельно владеют подпиской и очищают её при disconnect.

Можно сохранить совместимость текущего `flashTs/flashKind/gen`, если наружный
контракт даёт те же гарантии. Переименование runtime fields не является целью.

### 12.3. Один renderer

`renderDeviceFace()` рендерит один слой:

```html
<span class="device-pulse pulse-short reason-event gen-2" aria-hidden="true">
  <i></i><i></i><i></i>
</span>
```

или continuous/alarm variant. Reduced-motion dot создаётся тем же renderer.

Удалить:

- `.dev.alarm::after` как отдельный pulse path;
- статичную `.activity-ring.presence` ветку;
- reduced-motion static ring;
- surface-specific самостоятельное решение вида pulse.

Класс `.dev.alarm` сохраняется только для alarm plate. Внешние
`activity-event/presence/transition/running` classes можно оставить временно
для compatibility hooks на один beta-cycle, но production CSS и новые тесты не
должны от них зависеть. Перед stable их судьба фиксируется в реестре
compatibility #33: удалить либо документировать как deprecated styling hooks.

## 13. Сохранение и обратная совместимость

- `display` tokens не меняются;
- `ripple` продолжает нормализоваться в `icon_ripple`;
- `ripple_color` и `ripple_size` читаются/пишутся как раньше;
- Open → Save без изменения display не материализует новые поля;
- импорт/экспорт round-trip побайтно сохраняет эти поля;
- backend validation limits не меняются;
- downgrade видит прежние поля и может показать старый ring — это ожидаемая
  визуальная разница, не потеря данных;
- schema/model migration не требуется.

## 14. Эдж-кейсы

- несколько sources одновременно: alarm > newest short > continuous;
- short приходит во время continuous и после себя возвращает актуальный
  continuous;
- два short подряд перезапускают три волны через generation;
- alarm возникает во время short и полностью его подавляет;
- alarm снимается после expiry short — старый short не возвращается;
- alarm onset очищает finite runtime и синхронизирует baseline всех sources;
- binding/source graph изменился — старые edges не переносятся;
- смена display, value badge, LQI и `show_temperature` не меняет activity
  signature и не создаёт edge;
- `unavailable → on` после reconnect — baseline без события;
- один unavailable sample не гасит доступный alarm/continuous другого sample;
- быстрый `opening → open` прекращает continuous сразу;
- прямой `closed → open` запускает short fallback;
- custom color невалиден — безопасный fallback, без CSS injection;
- `ripple_size` min/max, marker scale 0.5/3, value badge на четырёх сторонах;
- hover/focus не меняет opacity/speed и не перезапускает animation;
- `static_icon → icon_ripple` показывает только актуальную continuous
  семантику, но не старый finite event;
- live_states on/off применяется немедленно без Save;
- preview draft не мутирует runtime полного плана;
- две карточки одного плана имеют независимый generation/timer;
- reduced-motion меняется во время активного effect без remount;
- media-query listener существует один раз на surface, а не на marker;
- HA-disabled preview ghost не получает alarm/activity dot;
- new-device dot и activity dot видны раздельно;
- theme/contrast и пользовательский accent;
- touch hover отсутствует, click target не увеличивается pulse layer.
- background/resume просрочивает short по `expiresAt` до первого нового paint;
  замороженная браузером CSS-анимация не продолжает старые три волны.

## 15. Производительность и безопасность

- один pure pulse resolve на уже построенную presentation;
- не повторять `resolvedLightSources` ради цвета внутри каждого surface;
- continuous смена HA state не создаёт новые DOM nodes каждый tick;
- максимум один finite timeout на marker с short runtime;
- CSS animation использует transform/opacity, не layout properties;
- pulse layer `pointer-events: none`;
- color проходит существующую safe color normalization;
- нет HTML из HA state/labels;
- golden/performance fixture не должен получить дополнительный full-plan
  rebuild при каждом animation frame.

## 16. Тестирование

### 16.1. Unit

Обязательная таблица `semantic → pulse`:

- все display modes × alarm/event/presence/transition/running/none;
- alarm > short > continuous;
- live_states false;
- static_icon;
- hidden, HA-disabled, orphaned/unavailable;
- terminal fallback и замена real transition;
- initial/reconnect/unavailable baseline;
- rapid retrigger/generation;
- source signature reset;
- activity signature не зависит от display/value badge/LQI/temperature UI;
- один unavailable source рядом с доступным alarm/running source;
- alarm onset baseline reset и отсутствие stale short после alarm;
- custom/fallback color и scale;
- reduced-motion dot/none, hot media-query change, никогда static ring.

### 16.2. Browser smoke

- motion, contact, button/event, presence, working switch, climate, cover,
  lock, valve, vacuum, script, alarm;
- четыре display modes по полной матрице;
- short три волны и cleanup после 3,3 с;
- continuous появляется/исчезает по state;
- hover не перезапускает timeline;
- preview parity и обе demo-команды;
- static card parity;
- runtime независим между двумя card instances;
- hide/resume после истёкшего short не продолжает замороженную CSS-анимацию;
- reduced-motion dot geometry и absence of rings;
- спутники marker не перекрываются.

Таймеры тестируются управляемым `now`/fake clock; CI не ждёт реальные 3,3 с
там, где достаточно pure assertion.

### 16.3. Golden

Минимальная матрица:

- desktop/mobile;
- light/dark;
- alarm;
- short в фиксированном progress;
- continuous;
- reduced-motion dot;
- четыре display modes;
- presence без статичного кольца;
- max ripple scale + value badge/LQI/new-device dot.

Новые golden принимаются только из Linux CI artifact по HP-QA-01.

## 17. Документация и release-артефакты

В той же реализации обновить:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #98;
- `docs/ARCHITECTURE.md` — presentation/pulse pipeline;
- `docs/LIGHT.md` — явно отделить marker pulse от Glow;
- `docs/FILTERING.md` — semantic sources/lifecycle;
- пользовательскую документацию по четырём display modes;
- `docs/TESTING.md` — unit/smoke/golden матрицу;
- ru/en i18n parity.

Release body: значимое пользовательское изменение одной строкой + ссылки на
RU/EN changelog. Поставка сначала в beta. Full golden/performance gate — перед
stable release согласно действующей release policy.

## 18. План реализации

1. Ввести `activitySourceSignature`, pure `ResolvedDevicePulse` и
   исчерпывающие unit tests.
2. Подключить pulse к `ResolvedDevicePresentation` без изменения DOM и
   добавить одну reduced-motion subscription на surface.
3. Перевести `renderDeviceFace()` на единый `device-pulse` renderer.
4. Удалить alarm pseudo-element, presence static ring и reduced-motion ring.
5. Нормализовать finite runtime interactive/static cards.
6. Обновить display copy и activity settings.
7. Реализовать две preview demo-команды.
8. Обновить accessibility descriptions и satellite layout.
9. Добавить browser/golden coverage и документацию.
10. Выпустить beta, проверить реальные motion/presence/alarm/cover fixtures.

## 19. Критерии приёмки

- [ ] В production есть один pure pulse resolver и один DOM renderer.
- [ ] Визуальных pulse-kind ровно три: alarm, short, continuous.
- [ ] Статичных колец нет в normal, reduced motion и preview.
- [ ] Presence показывает continuous pulse, а не кольцо.
- [ ] Real transition существует ровно пока идёт переход; terminal fallback —
      short около 3,3 с.
- [ ] Alarm использует единый renderer, системный красный и имеет высший
      приоритет.
- [ ] Матрица четырёх display modes соблюдается на всех surfaces.
- [ ] `live_states: false` подавляет ordinary activity, но не alarm.
- [ ] `static_icon` не показывает alarm/activity и сохраняет hover/focus/click.
- [ ] Цвет/размер ordinary activity не влияют на alarm.
- [ ] Reduced motion использует внутреннюю dot только для activity mode.
- [ ] Preview показывает фактический результат и две безопасные demo-команды.
- [ ] Первый snapshot/reconnect/unavailable recovery не создают false event.
- [ ] Activity signature не зависит от value/satellite/display presentation.
- [ ] Alarm onset очищает finite runtime; один unavailable source не подавляет
      доступную тревогу другого source.
- [ ] Rapid retrigger не накапливает DOM/timers и корректно перезапускает цикл.
- [ ] Background/resume не продолжает просроченную short-анимацию.
- [ ] Модель, backend и существующие конфиги остаются совместимыми.
- [ ] Full plan, preview и static card дают одинаковую projection.
- [ ] ru/en, docs, unit, smoke и golden gates актуальны.
