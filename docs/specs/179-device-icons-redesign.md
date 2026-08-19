# Issue #179 — новый визуальный язык маркеров устройств

- **Статус:** ревизия 2 после жёлтого ревью r1; готово к повторному ревью ТЗ
- **Issue:** https://github.com/Matysh/houseplan-card/issues/179
- **Приоритет:** P1
- **Тип:** feature / polish / accessibility
- **Область:** frontend, общий renderer маркера, preview, статическая карточка,
  документация и visual QA
- **Нормативный дизайн-пакет:** `House Plan Icons — Developer Package`,
  версия 1.1.1, экспорт 2026-08-18
- **Архив:** https://github.com/user-attachments/files/31235094/House.plan.Icons.-.Developer.Package.2026-08-19.zip
- **SHA-256 архива:**
  `63670C73E25D1E59DDAF1BE236F3D7F2FAC827B9B5D6DD4B77125EA9BC012025`
- **Figma frames:** Light `99:1290`, Dark `104:1539`

## 1. Пользовательский сценарий и персона

**Персона:** пользователь House Plan, который одновременно контролирует
устройства разных доменов, читает значения датчиков и оценивает состояние
связи на светлой либо тёмной теме Home Assistant.

**Сценарий:** пользователь открывает план и за один взгляд различает обычное,
активное, тревожное, заблокированное, разблокированное, виртуальное и
недоступное устройство; видит полное значение и Zigbee LQI; получает тот же
результат в полном плане, preview редактора и статической карточке пространства.

## 2. Проблема и результат

### До реализации

- plate маркера является одним заполненным rounded-square без общего внешнего
  shell из дизайн-пакета;
- hover применяется и к unavailable-маркеру;
- selected обозначается amber-цветом и конфликтует с семантикой активности;
- value и legacy secondary value рисуются отдельными спутниками, длинные
  значения обрезаются ellipsis;
- LQI использует непрерывный HSL-gradient, а не три читаемых диапазона;
- ordinary continuous pulse длится 2,4 с и по умолчанию разрастается до 3×;
- маркер не является клавиатурной целью и не активируется Enter/Space;
- light/dark, focus и semantic states не образуют единой дизайн-системы.

### После реализации

Все поверхности используют один runtime-renderer нового shell/core,
компоновок Text/Double, LQI и motion из пакета. Семантика устройств и действий
остаётся прежней; меняется её единое визуальное и доступное представление.

## 3. Нормативный источник и порядок разрешения расхождений

Единственный дизайн-источник этой задачи — архив #179. Нормативны его
`README.md`, `SPECIFICATION.md`, `ACTIVE_ANIMATION_SPEC.md`,
`DEVELOPER_HANDOFF.md`, `PACKAGE_ANNOTATION.txt`, `manifest.json` и SVG-примеры.

Порядок приоритета:

1. решения владельца в §4;
2. текстовые документы архива;
3. SVG-примеры архива;
4. текущая реализация House Plan — только для поведения, которое пакет не
   переопределяет.

Статические SVG являются эталонами геометрии и состояний, а не готовыми
production-иконками: runtime продолжает использовать динамические MDI glyphs,
HA-значения и локализованный текст.

## 4. Принятые решения владельца

1. **Unavailable.** Визуальный hover и motion отсутствуют. Click/tap остаётся
   доступен и выполняет текущее действие поверхности (More Info либо открытие
   настроек).
2. **Пользовательские pulse-настройки.** Если `ripple_color` или `ripple_size`
   явно сохранены, они сохраняют приоритет. При отсутствии поля используются
   геометрия и цвет пакета.
3. **Zigbee LQI.** `0…40` — red, `41…179` — amber, `180+` — green.
4. **Клавиатура.** Интерактивный маркер получает focus; Enter и Space выполняют
   то же действие, что click на этой поверхности.
5. Специальная кнопка либо новый action для клавиатуры не вводятся.

## 5. Цели

1. Реализовать shell/core, цвета, состояния, focus и motion пакета #179.
2. Сохранить единую проекцию на полном плане, в editor preview и static card.
3. Показывать полное динамическое значение без ellipsis в Text/Double layout.
4. Сделать маркер читаемым в light/dark и на цветном фоне плана.
5. Обеспечить минимум 44×44 CSS px для интерактивной цели и keyboard parity.
6. Сохранить существующую HA-семантику, пользовательские настройки, координаты
   и безопасный pipeline действий.

## 6. Не входит в задачу

- новые правила определения `on`, `working`, `open`, alarm и activity;
- новые HA service calls, actions или обход secure confirmation;
- новые display modes и новые пользовательские настройки дизайна;
- смена MDI-иконок либо поставка собственного icon font;
- настройка порогов LQI пользователем;
- автоматическое устранение пересечений соседних маркеров;
- изменение комнатной LQI-заливки, Glow, света, комнатных fills или isometry;
- миграция сохранённых координат и marker config;
- перенос каждого example SVG из архива в production bundle.

## 7. Визуальная система

### 7.1. Геометрия

Маркер состоит из независимых слоёв:

1. прозрачная hit area минимум 44×44 CSS px;
2. внешний shell: прозрачный fill, stroke и внешние shadows;
3. внутренний core с MDI glyph либо динамическим значением;
4. semantic/focus/selection decoration;
5. pulse layer с `pointer-events: none`;
6. LQI и дополнительные секции, если включены.

Для Icon-эталона shell имеет диаметр `101.5/127` viewBox, core — `80/127`;
отношение core/shell равно `0.788` с допустимым расхождением не более 0,5 CSS
px на QA-размерах 32, 56 и 96 px. Координата сохранённого маркера остаётся
центром icon core, поэтому включение Text/Double и смена стороны не двигает
устройство на плане.

Light shell: stroke `#BCBCBC`; core по умолчанию white. У light-варианта
запрещены backdrop blur и inner shadows. Внешние shadows масштабируются от
референса 56 px: `0 1px 2px rgb(37 40 45 / 12%)` и
`0 4px 8px -1.07px rgb(37 40 45 / 18%)`.

Dark использует core `#252525`, stroke и внешние shadows неизменённой
dark-ревизии пакета, но production renderer нормативно следует поставленному
варианту `Dark/Icon Default No Blur.svg`: `backdrop-filter: blur(20px)` на
каждом маркере запрещён. Это сохраняет дизайн-пакетный fallback и исключает
дорогой отдельный backdrop-composite layer для 20–200 устройств в View/kiosk.
Тема берётся из актуальных HA theme tokens; переключение темы не требует
remount и не меняет semantic state.

### 7.2. Цвета

Нормативные semantic colors:

| Смысл | Цвет |
|---|---|
| hover / focus / neutral activity | `#0C82F0` |
| active / working / unlocked | `#F0A00C` |
| alert / low LQI | `#F0410C` |
| unavailable core | `#B5BAC1` |
| locked glyph | black |
| presence activity / high LQI | `#1DC21D` |

Тема не подменяет semantic colors. Контраст glyph/core и читаемость текста
проверяются в light/dark и на светлом, тёмном и насыщенном фоне плана.

### 7.3. Состояния и приоритет

Нормативный визуальный приоритет:

```text
Alert > Focus > Selected > Hover > semantic state > Default
```

- **Default:** theme-default shell/core и обычный glyph.
- **Hover:** blue decoration пакета; не меняет semantic state и не
  перезапускает pulse.
- **Focus:** blue keyboard-focus decoration, видимая без hover.
- **Selected:** отдельная selection decoration пакета, не amber semantic fill.
- **Active/working:** amber.
- **Lock:** locked glyph black; **Unlock:** unlocked glyph amber.
- **Alert:** red и всегда выше остальных состояний.
- **Unavailable:** gray core/glyph по текущему правилу прозрачности; без
  визуальной реакции на hover и без motion.
- **Virtual:** пунктирный внешний shell. У обычного virtual default/hover
  меняется только цвет оформления. Реальная HA unavailable и active pulse для
  HA-less virtual device не синтезируются.

Текущая semantic-модель `neutral/open/working/alarm`, activity resolver и
domain-specific HA rules сохраняются. Для lock presentation дополнительно
различает locked/unlocked, не меняя secure action. Generic physical `open`
для cover/contact/valve не переименовывается в lock state и продолжает
существующую отдельную semantic-проекцию.

`display: static_icon` получает новую theme-default shell/core геометрию, но
остаётся нереактивным к HA state, values и pulse. На интерактивной поверхности
он сохраняет разрешённые hover/focus/click.

## 8. Text, Double и дополнительные секции

### 8.1. Text

В `display: value` динамический текст находится внутри общего shell. Полная
строка всегда доступна визуально: CSS ellipsis, clipping и скрытие хвоста
запрещены. Сначала шрифт равномерно уменьшается до `0.25 × marker size`
(8 CSS px при размере 32); если этого недостаточно, text section расширяет
shell. Измерение выполняется детерминированно и кэшируемо, без layout-loop и
ResizeObserver на каждый маркер.

### 8.2. Double

Иконка и value badge входят в один общий shell. Поддерживаются сохранённые
позиции `right`, `bottom`, `left`, `top`; icon core остаётся anchor. Высота
внутренней value-секции равна `0.7875 × icon core`, как в референсе.

Если у нетронутой legacy-конфигурации одновременно разрешены два значения,
второе становится третьей секцией того же shell, а не отдельным спутником.
Новая пользовательская модель второго бейджа не вводится.

Длинное значение проходит тот же auto-fit, что Text: полная строка без
ellipsis, а shell при необходимости расширяется. Динамический текст остаётся
текстом DOM, а не SVG path; шрифт — HA/system Roboto с weight 600 и безопасным
system fallback.

## 9. Zigbee LQI

Числовое LQI располагается под shell по геометрии пакета и окрашивается
категориально:

- `<= 40` — `#F0410C`;
- `41…179` — `#F0A00C`;
- `>= 180` — `#1DC21D`.

Границы применяются к текущему resolved average LQI без изменения источника,
агрегации, форматирования и флагов `show_signal`. Значение `0` валидно. Для
missing/unavailable LQI сохраняется текущая политика отсутствия подписи.

Категориальная функция применяется только к marker LQI. Непрерывный
HSL-gradient комнатной LQI-заливки остаётся неизменным.

В `Light/Zigbee LQI Low.svg` архива low ошибочно окрашен amber. Текстовая
спецификация архива и решение владельца имеют приоритет: production low — red.

## 10. Motion

### 10.1. Continuous

- одно кольцо;
- duration `3.6s`, infinite;
- easing `cubic-bezier(.45,.05,.55,.95)`;
- scale `1 → 1.5`, opacity `.55 → 0`;
- цвет соответствует resolved ordinary activity: `presence` — green;
  running/working/open/unlocked — amber; neutral transition — blue. Явный
  пользовательский либо валидный live-light color сохраняет приоритет по
  §10.4.

### 10.2. Short

- три кольца;
- каждое длится `1.1s`;
- delays `0`, `1.1s`, `2.2s`;
- easing `cubic-bezier(.22,.61,.36,1)`;
- общий цикл `3.3s`;
- новое событие перезапускает цикл через существующий generation/runtime.

### 10.3. Alert

- red независимо от custom pulse color;
- wave stroke 3 reference units;
- scale до `1.5`;
- два wave-starts с интервалом `1.2s`, цикл `2.4s`;
- easing `cubic-bezier(.22,.61,.36,1)`;
- alert имеет приоритет над ordinary short/continuous.

### 10.4. Пользовательские настройки и fallback

Явно сохранённые `ripple_color` и `ripple_size` сохраняются без миграции.
Отсутствующий `ripple_size` использует package scale `1.5`, отсутствующий
`ripple_color` разрешается в порядке:

1. валидный live RGB контролируемого light, если он уже является текущим
   источником pulse color;
2. semantic green для presence;
3. semantic amber для running/working/open/unlocked;
4. package blue для neutral transition/activity.

UI-default размера меняется на `1.5`, но Open → Save не материализует поле и
не переписывает существующее явно сохранённое значение. Backend допустимый
диапазон и import/export round-trip не меняются.

### 10.5. Reduced motion

При `prefers-reduced-motion: reduce` animated rings отсутствуют. Ordinary
activity обозначается статической semantic point из существующего единого
pulse renderer; alert остаётся красным статическим состоянием. Marker не
создаёт собственную media-query subscription: используется одна подписка на
surface/card host.

## 11. Интерактивность и доступность

- Интерактивные маркеры в View/kiosk и Device editor получают `tabindex="0"`
  и button semantics.
- Enter/Space вызывают тот же существующий click handler текущей поверхности:
  action/More Info в View и открытие настроек в Device editor.
- Space предотвращает прокрутку только когда активирует marker.
- Pointer/touch поведение, long-press/context action и drag в редакторе не
  меняются; keyboard path не создаёт прямой HA service call.
- Background/Plan, read-only static card и неинтерактивный preview не входят в
  tab order и не получают ложный button role.
- Minimum hit area 44×44 CSS px центрирована по icon core и не влияет на
  visual bounds, координату, pulse либо collision geometry.
- `aria-label` включает локализованное имя, semantic state, activity/alert и,
  если LQI показан, число и понятный диапазон «низкий/средний/высокий».
- Цвет и motion не являются единственным носителем alert, availability, lock
  или LQI band.
- Focus после закрытия открытого marker dialog возвращается на исходный
  marker по существующему dialog contract.

Secure lock/cover/valve actions продолжают проходить через текущий action
resolver и confirmation policy. Новый DOM-shell и keyboard handler не имеют
отдельного пути обхода подтверждения.

**Touch editor: best effort / intentionally degraded.** Device editor
сохраняет текущие touch drag/tap/pointer-cancel guarantees и увеличенную hit
area, но его полный editor workflow остаётся desktop-first. View/kiosk touch —
блокирующий и полностью поддерживаемый контракт.

## 12. Совместимость и данные

- config schema version не меняется;
- `display`, `value_badge`, `value_badge_position`, `ripple_color`,
  `ripple_size`, `show_signal` и legacy fields сохраняют формат и round-trip;
- существующие координаты относятся к icon core и не мигрируют;
- явно сохранённые pulse color/size воспроизводятся как раньше, кроме нового
  shell и motion geometry;
- отсутствующие поля не материализуются при Open → Save;
- старые версии карточки читают тот же config; downgrade меняет только
  внешний вид;
- runtime не зависит от наличия в bundle статических SVG-примеров;
- ru/en i18n parity обязательна.

## 13. Архитектурный контракт

```text
HA/device registry + marker config
  → existing semantic/activity resolvers
  → resolveDevicePresentation
  → resolveDevicePulse
  → renderDeviceFace (shell/core/text/LQI/motion)
  → full plan | editor preview | static space card
```

Один resolved presentation и один `renderDeviceFace()` остаются источником
истины всех поверхностей. Surface передаёт только interaction/theme context и
не вычисляет semantic state повторно.

Рекомендуемые зоны изменений:

- `src/device-visual.ts` — lock presentation facet без смены action semantics;
- `src/device-presentation.ts` — theme/semantic projection, marker-only LQI
  band, defaults pulse;
- `src/device-pulse.ts` — package timings/scale/reduced motion;
- `src/device-face.ts` — единый shell и Text/Double/third section DOM;
- `src/styles.ts` — tokens, geometry, states, focus, auto-fit и motion;
- `src/houseplan-card.ts` и общие surface adapters — role/tabindex/keydown;
- i18n, unit, smoke, golden fixtures и документация.

Нельзя вводить surface-specific копию state mapping, formatter либо motion
runtime. Text auto-fit не должен читать layout на каждом render/animation
frame. Pulse использует transform/opacity и не меняет layout.

## 14. Эдж-кейсы

- light/dark hot switch во время continuous/short pulse;
- colored room background и минимальный marker size 32;
- marker sizes 32/56/96, user scale 0.5…3 и explicit ripple size 1…20;
- alarm во время hover/focus/selected и снятие alarm;
- unavailable во время active pulse, затем reconnect baseline без false short;
- locked, unlocked, locking и unlocking с secure action;
- virtual default/hover без HA entity и linked virtual with resolved controller;
- `static_icon` при реальном alarm/working/unavailable;
- `0`, `false`, very long localized string, unit symbol и third legacy value;
- Double на четырёх сторонах вместе с LQI;
- LQI exactly `0`, `40`, `41`, `179`, `180`, missing;
- rapid short retrigger, short поверх continuous, reduced-motion hot switch;
- keyboard activation после drag, click confirmation и dialog focus return;
- несколько cards одного плана с независимыми runtime и theme context;
- hidden/HA-disabled/orphaned marker и read-only static card.

## 15. Acceptance criteria

- [ ] **AC1 — shell/theme.** Icon, Text и Double используют package shell/core
      geometry и Light/Dark tokens; light не содержит blur/inner shadow.
      **Доказательство:** unit token assertions + reviewed golden 32/56/96.
- [ ] **AC2 — states.** Default, Hover, Focus, Selected, Active, Lock, Unlock,
      Alert, Virtual и Unavailable соблюдают §7.3 и нормативный приоритет.
      **Доказательство:** presentation unit matrix + light/dark state-table
      golden.
- [ ] **AC3 — unavailable.** Unavailable не получает visual hover/motion, но
      click/tap по-прежнему открывает текущее действие поверхности.
      **Доказательство:** unit + browser smoke.
- [ ] **AC4 — secure locks.** Locked black, unlocked amber, locking/unlocking
      continuous; pointer и keyboard проходят один action/confirmation path.
      **Доказательство:** unit + secure-action smoke.
- [ ] **AC5 — virtual/static.** Virtual имеет dashed shell; HA-less virtual не
      синтезирует unavailable/activity. `static_icon` использует theme-default
      shell и не реагирует на live state/value/pulse.
      **Доказательство:** unit + existing static-icon smoke.
- [ ] **AC6 — Text/Double.** Полные строки видимы без ellipsis; четыре стороны,
      anchor, auto-fit и третья legacy section соответствуют §8.
      **Доказательство:** unit layout facts + browser smoke + long-value golden.
- [ ] **AC7 — LQI.** Marker LQI использует red/amber/green thresholds на
      границах, а room fill сохраняет continuous gradient.
      **Доказательство:** boundary unit tests + room-fill regression test.
- [ ] **AC8 — motion.** Continuous/short/alert timings, ring counts, retrigger,
      easing, reason→color mapping, scale и colors соответствуют §10; explicit
      color/size сохраняются.
      **Доказательство:** pure resolver tests + DOM/style smoke.
- [ ] **AC9 — reduced motion.** Rings отсутствуют, ordinary point и static red
      alert остаются; одна subscription на host.
      **Доказательство:** unit + reduced-motion browser smoke.
- [ ] **AC10 — keyboard/a11y.** Только интерактивные surfaces получают focus;
      Enter/Space эквивалентны click, hit area >=44×44, aria-label содержит
      state/LQI, focus возвращается после dialog.
      **Доказательство:** keyboard/touch/browser smoke.
- [ ] **AC11 — parity.** Full plan, editor preview и static card используют
      один presentation/face renderer и дают одинаковую read-only projection.
      **Доказательство:** existing preview/static parity smokes.
- [ ] **AC12 — совместимость.** Schema и saved config не мигрируют; Open → Save
      не материализует defaults; explicit pulse settings round-trip.
      **Доказательство:** frontend/backend config tests.
- [ ] **AC13 — производительность.** Нет per-frame JS, per-marker media query,
      ResizeObserver/layout loop или SVG example assets в production bundle;
      transform/opacity motion не вызывает layout; ни Light, ни Dark marker не
      создаёт per-marker `backdrop-filter`/backdrop-composite layer.
      **Доказательство:** code assertion + `performance_smoke.mjs` перед beta.
- [ ] **AC14 — release artifacts.** ru/en copy, guides, architecture/testing
      docs, changelogs, targeted smokes и golden review актуальны.

## 16. Тестирование

### 16.1. Цикл реализации

После каждого логического блока:

```bash
npm run typecheck
npm test
npm run build
```

Unit coverage:

- полная state/priority/theme/display matrix;
- lock/unlock и generic open не смешиваются;
- LQI boundaries и неизменность room gradient;
- pulse kinds, timings, fallback/explicit settings и reduced motion;
- Text/Double/third section facts, long values и anchor;
- keyboard surface policy и accessible labels;
- config/default/round-trip compatibility.

### 16.2. Targeted browser smoke перед S7

Добавить `demo/smoke_device_icon_design.mjs` и прогнать его вместе с:

- `demo/smoke_device_preview_parity.mjs`;
- `demo/smoke_static_icon.mjs`;
- `demo/smoke_state_value.mjs`;
- `demo/smoke_disabled_device.mjs`;
- релевантным secure-action/keyboard smoke из существующего набора.

Новый smoke проверяет light/dark, все состояния, Text/Double, четыре позиции,
long value, LQI boundaries, unavailable click, 44×44 hit area, keyboard и
reduced motion.

### 16.3. Mutation gates

Зарегистрировать targeted mutants, которые обязаны быть пойманы тестами:

1. generic hover снова применяется к `.unavail`;
2. LQI `40/180` уходит в соседний диапазон либо меняет room gradient;
3. Text/Double снова получает ellipsis;
4. keyboard activation вызывает отдельный action path.

### 16.4. Golden и pre-beta

Golden matrix: desktop/mobile, light/dark, neutral/hover/focus/selected,
active/lock/unlock/alert/virtual/unavailable, Text, четыре Double, third section,
LQI low/mid/high, reduced motion, sizes 32/56/96 и цветной фон.
Комбинации `Selected + Hover/Working/Green/Alert` и `Focus + Alert` проверяются
в обеих темах: Light сверяется с прямыми SVG-эталонами, Dark — с тем же
нормативным приоритетом слоёв, поскольку отдельных Dark combo-assets в архиве
нет.

Golden принимается только по Linux CI artifact согласно HP-QA-01. Перед beta
запускаются полный golden, smoke и performance наборы по release runbook;
Windows не является каноном полного HA harness из-за `fcntl`.

## 17. Риски и откат

### Риски

- рост shell у длинных значений может чаще пересекаться с соседями;
- old explicit ripple size 3+ визуально заметно больше package default;
- Dark No-Blur отличается от основного Dark example отсутствием
  backdrop-filter, но сохраняет core/stroke/shadow geometry пакета;
- новый focus/tab order увеличивает число клавиатурных остановок на больших
  планах;
- ошибочная привязка общего `lqiColor()` изменит комнатную заливку;
- новый DOM может изменить snapshot/golden fingerprint всех поверхностей.

### Митигации

- центр icon core и saved coordinates неизменны;
- explicit settings не переписываются скрыто;
- marker-only LQI helper отделён и покрыт regression test;
- интерактивность добавляется только существующим actionable surfaces;
- один renderer и одна token table исключают drift;
- No-Blur Dark не создаёт 20–200 дорогих backdrop-composite layers;
- targeted golden содержит контрастные backgrounds и dense layout.

### Откат

Откат выполняется одним revert implementation commit. Миграции данных нет,
поэтому rollback возвращает старый renderer без преобразования config. ТЗ и
архив остаются диагностическим контрактом.

## 18. Release-артефакты

В том же user-visible implementation commit обновить:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #179;
- `docs/USER-GUIDE.md` и `docs/USER-GUIDE.ru.md`: состояния, Text/Double,
  LQI, keyboard и static mode;
- `docs/ARCHITECTURE.md`: общий presentation/face pipeline и theme context;
- `docs/TESTING.md`: новый smoke, mutation и golden matrix;
- ru/en i18n для доступных state/LQI descriptions и изменённого static hint;
- screenshot/golden fingerprints и review manifest по HP-QA-01.

Release note: единая новая визуальная система устройств на светлой и тёмной
теме, полные значения, читаемый LQI и клавиатурное управление. Поставка сначала
в beta; stable — только после release gates.

## 19. План реализации

1. Зафиксировать package tokens и pure projection facts unit-тестами.
2. Расширить presentation lock/LQI/theme facts без изменения semantic/action
   resolvers.
3. Перевести `renderDeviceFace()` на shell/core и общие Text/Double sections.
4. Реализовать package states, focus, unavailable и light/dark CSS.
5. Обновить pulse timings/defaults/reduced motion.
6. Подключить keyboard/hit area/accessibility к интерактивным surfaces.
7. Обновить preview/static parity, settings default и i18n/docs.
8. Добавить unit, mutation, targeted smoke и golden fixtures.
9. Прогнать typecheck, unit, build и named smokes; отправить в S7.
10. Перед beta выполнить полный golden/smoke/performance gate в Linux CI.

## 20. Принятые технические предположения

1. Package SVGs — visual reference; runtime DOM/SVG строится из тех же ratios и
   tokens, потому что MDI glyph, HA text и theme динамические.
2. `Light/Zigbee LQI Low.svg` содержит ошибочный amber; red из textual spec и
   решения владельца нормативен.
3. Package не задаёт minimum font size для бесконечно длинного значения:
   используется floor `0.25 × marker size`, затем расширяется shell.
4. Generic physical `open` сохраняет текущую отдельную semantic-проекцию;
   специальные black/amber Lock/Unlock применяются только к lock domain.
5. `static_icon` остаётся нереактивным, но default plate становится
   theme-aware, потому что package задаёт разные Light/Dark defaults.
6. Отсутствующий pulse color сохраняет существующий validated live-light RGB
   раньше semantic fallback; это единственный package-compatible способ не
   потерять текущий пользовательский light-color effect.
7. Marker LQI меняет только цвет подписи; room LQI fill остаётся непрерывным.
8. Preview и static card показывают новый дизайн, но не получают ложную
   интерактивность либо tab stop.
9. Green continuous variant нормативно означает `presence`; amber означает
   running/working/open/unlocked, blue — neutral transition. Это явный mapping
   трёх package assets, который архив сам не задаёт.
10. Production Dark использует поставленный `Icon Default No Blur` fallback:
    визуально дорогой `backdrop-filter: blur(20px)` на каждом marker запрещён
    ради блокирующих View/kiosk поверхностей с 20–200 устройствами.
