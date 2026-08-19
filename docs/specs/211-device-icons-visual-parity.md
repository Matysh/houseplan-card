# Issue #211 — визуальное соответствие маркеров дизайн-пакету #179

- **Issue:** https://github.com/Matysh/houseplan-card/issues/211
- **Исходная задача:** https://github.com/Matysh/houseplan-card/issues/179
- **Первая затронутая версия:** `v1.65.0-beta.6`
- **Приоритет:** P1
- **Тип:** bug / polish
- **Область:** frontend, общий renderer маркера, preview, статическая карточка,
  browser smoke и visual QA
- **Нормативный пакет:** `House Plan Icons — Developer Package` 1.1.1,
  экспорт 2026-08-19, SHA-256
  `63670C73E25D1E59DDAF1BE236F3D7F2FAC827B9B5D6DD4B77125EA9BC012025`

## 1. Сценарий и персона

**Персона:** обычный пользователь или владелец настенной панели, который в
View/киоске за один взгляд читает тип и состояние устройства; администратор
встречает тот же маркер в редакторе устройств и его preview.

**Поверхность и момент:** полный план, киоск, preview настроек устройства и
`houseplan-space-card` сразу после загрузки либо смены темы/состояния.

## 2. Что человек увидит до и после

**До:** круглый дизайн из #179 выглядит как большой скруглённый квадрат с
переразмеренным глифом, а внешний контур и несколько состояний не совпадают с
эталоном, особенно в тёмной теме.

**После:** на всех поверхностях маркер сохраняет круглую геометрию, правильный
масштаб глифа и точные theme/state-слои нормативных SVG при размерах 32, 56 и
96 px.

## 3. Проблема и подтверждённая причина

Реализация #179 прошла проверки внутренней согласованности, но visual QA не
сравнил runtime рядом с исходными SVG. Ошибочный runtime затем стал новым
golden, поэтому golden оказался зелёным, не доказывая дизайн.

Подтверждённые расхождения `v1.65.0-beta.6`:

1. `.device-core` использует `border-radius: 28%`, тогда как core каждого
   нормативного Icon-состояния — круг `80 × 80`, `rx=40`.
2. `ha-icon` получает viewport `0.62 × core`; пакет использует `40 × 40` внутри
   core `80 × 80`, то есть `0.5 × core` до внутренних отступов самого glyph.
3. value-section высотой `0.7875 × core` имеет радиус лишь `0.18 × core`, а
   нормативный badge — pill с радиусом, равным половине его высоты.
4. shell всегда имеет светлый stroke `#BCBCBC`; Dark Default No Blur требует
   `#252525` с opacity `0.75` и сохраняет dark outer/inner shadows без
   `backdrop-filter`.
5. Active, hover, lock/unlock, selected и focus меняют не те слои либо неверные
   цвета: например hover/selected перекрашивают внешний shell, а active не
   переносит semantic stroke на shell.
6. текущий smoke проверяет отношение shell/core и часть цветов, но не проверяет
   круглую форму, размер glyph viewport, value pill, theme-specific stroke,
   слой selection/focus и полную матрицу состояний.

## 4. Нормативные источники и разрешение расхождений

Порядок приоритета:

1. решения владельца, уже записанные в #179;
2. `SPECIFICATION.md`, `DEVELOPER_HANDOFF.md`, `ACTIVE_ANIMATION_SPEC.md` и
   `COMPARISON_NOTES.md` архива #179;
3. соответствующий SVG архива для темы, состояния и layout;
4. `docs/specs/179-device-icons-redesign.md`;
5. текущая реализация — только для поведения, которое источники выше не меняют.

Решения владельца #179, обязательные и для исправления:

- Unlock янтарный в обеих темах; зелёный Dark/Unlock из старой dark-ревизии не
  используется.
- Virtual hover такой же, как ordinary hover: меняется core, а единственное
  постоянное отличие virtual — пунктирный внешний shell. HA-less virtual не
  получает active, unavailable или pulse.
- Unavailable сохраняет прежнее правило и величину прозрачности House Plan,
  не получает hover/motion, но сохраняет обычный click/tap.
- LQI, pulse-семантика, explicit `ripple_color`/`ripple_size`, действия,
  подтверждения и порядок приоритетов остаются по принятому ТЗ #179.
- production Dark использует No Blur: `backdrop-filter` на маркере запрещён,
  но остальные dark shadows не удаляются.

Нормативные SVG служат эталоном геометрии, цвета и слоёв. Production продолжает
использовать динамический MDI glyph и HA-текст; примерный glyph из SVG не
подменяет иконку устройства.

## 5. Скоуп

В задачу входят:

- точная shell/core/value geometry для Icon, Text и Double;
- theme-specific default stroke, opacity, outer shadows и допустимый Dark inner
  shadow без blur;
- точная проекция Default, Hover, Active/working, Lock, Unlock, Selected,
  Focus, Alert, Virtual и Unavailable с уже принятым приоритетом;
- одинаковый результат общего `renderDeviceFace()` в полном плане, киоске,
  Device preview и `houseplan-space-card`;
- сохранение icon-core центра как saved anchor, 44×44 hit area, Text/Double
  сторон и полного текста;
- независимый от production CSS visual-contract fixture и расширение targeted
  smoke, чтобы исходный дефект падал до исправления;
- обновление затронутых screenshots/golden только по каноническому процессу.

## 6. Не-скоуп

- новые состояния, glyphs, display modes или настройки пользователя;
- изменение semantic/activity resolvers, HA entity selection, LQI-порогов,
  actions, confirmation/security, Glow, vacuum lifecycle или isometry;
- изменение сохранённого config, координат либо миграция данных;
- устранение пересечений соседних маркеров;
- публикация либо удаление `v1.65.0-beta.6`;
- принятие новых golden без полного Linux CI artefact и ручного сравнения.

## 7. Визуальный контракт

### 7.1. Геометрия

Все коэффициенты измеряются относительно diameter icon core.

| Элемент | Контракт |
|---|---|
| Icon core | круг; width = height = `1.0`; radius = `0.5` |
| Icon shell | круг; diameter `101.5 / 80 = 1.26875`; core и shell концентричны |
| MDI viewport | width = height = `0.5`; path сохраняет собственные внутренние отступы |
| Text core | pill высотой `1.0`; radius = `0.5`; ширина зависит от полного текста |
| Double value core | pill высотой `0.7875`; radius = `0.39375`; ширина по полному значению и padding SVG |
| Selected/Focus ring | отдельный круглый слой; не заменяет внешний shell и не превращает core в rounded-square |
| Hit area | минимум 44×44 CSS px, центрирована по icon core и не меняет визуальные bounds |

Допуск для измеримых width/height/radius на 32/56/96 px — не более 0.5 CSS px.
Сохранённая координата остаётся центром icon core при любом layout и стороне
value badge.

### 7.2. Базовые theme-токены

| Тема | Core default | Glyph default | Shell default |
|---|---|---|---|
| Light | `#FFFFFF` | `#000000` / эквивалентный package black | `#BCBCBC`, `1.5` reference units |
| Dark | `#252525` | `#FFFFFF` | `#252525` opacity `0.75`, `1.5` reference units |

Light использует только package outer shadows. Dark No Blur сохраняет outer
shadows и белый inner highlight из `Icon Default No Blur.svg`, но не содержит
`backdrop-filter`, `foreignObject` или отдельный backdrop-composite layer.
Stroke/shadow масштабируются вместе с marker так, чтобы 32/56/96 сохраняли
одинаковую пропорцию и не расходились с прямым SVG-рендером более допустимой
визуальной погрешности.

### 7.3. Состояния и слои

| Состояние | Core | Glyph | Shell / decoration |
|---|---|---|---|
| Default Light | white | black | базовый Light shell |
| Default Dark | `#252525` | white | базовый Dark shell |
| Hover Light | blue `#0C82F0` | white | базовый Light shell не синеет |
| Hover Dark | blue `#0C82F0` | `#252525` | базовый Dark shell не синеет |
| Active Light | amber `#F0A00C` | white | amber semantic stroke как в `Light/Icon Active.svg` |
| Active Dark | amber `#F0A00C` | `#252525` | amber semantic stroke как в `Dark/Icon Active.svg` |
| Lock Light | black | white | black semantic stroke |
| Lock Dark | `#252525` | white | dark lock stroke |
| Unlock | amber | Light: white; Dark: `#252525` | amber semantic stroke; owner override для Dark |
| Selected | текущий semantic core не теряется | по semantic core | amber selection ring отдельным слоем; base/semantic shell остаётся видимым |
| Focus | текущий semantic core не теряется | neutral SVG может стать blue | blue focus ring отдельным слоем; не shell-shadow substitute |
| Alert | red `#F0410C` | white | red semantic stroke/alert; выше hover/selection/focus по принятому alert-контракту |
| Virtual | ordinary state core/glyph | ordinary | тот же shell, но dashed; hover меняет только core/glyph |
| Unavailable | по принятой серой проекции #179 | по принятой проекции | прежняя opacity House Plan; без hover и motion |

Комбинации `Selected + Hover/Working/Green/Alert` и `Focus + Alert` сверяются с
одноимёнными Light SVG; для Dark применяется тот же порядок слоёв с dark base
tokens. Generic physical `open` остаётся существующей отдельной оранжевой
семантикой и не превращается в Lock/Unlock.

### 7.4. Text, Double, LQI и motion

Исправление геометрии применяется к Text/Double без изменения уже принятого
контракта полного текста, auto-fit, четырёх сторон, third legacy section и LQI.
Value и его section остаются настоящим DOM-текстом Roboto/System 600.

LQI bands, pulse kinds/timings/colors, reduced motion и explicit ripple
настройки не меняются. Исправление не добавляет layout-read, per-marker
subscription, ResizeObserver или per-frame JS.

## 8. UX, touch и доступность

Это исправление внешнего вида, а не взаимодействия. View и киоск остаются
touch-first: click/tap, pan/pinch, long press, keyboard Enter/Space, secure
confirmation и dialog focus return должны пройти без регрессий. Device editor
остаётся desktop-first / touch best effort. Static card и preview не получают
интерактивность или tab-stop.

Форма/decoration не меняют pointer bounds. Unavailable остаётся кликабельным,
несмотря на отсутствие визуального hover.

## 9. Данные, совместимость и i18n

- schema version и wire/config model не меняются;
- `display`, `value_badge`, `value_badge_position`, `show_signal`,
  `ripple_color`, `ripple_size`, coordinates и defaults round-trip без записи;
- новых i18n-ключей и пользовательских строк нет;
- downgrade меняет только внешний вид и не требует обратной миграции.

## 10. Архитектурный контракт и файлы

Остаётся один pipeline:

```text
existing semantic/activity resolvers
  → ResolvedDevicePresentation / ResolvedDevicePulse
  → renderDeviceFace
  → full plan | kiosk | Device preview | houseplan-space-card
```

Ожидаемые зоны изменений:

- `src/styles.ts` — geometry/theme/state tokens и отдельные decoration layers;
- `src/device-face.ts` — только если для selection/focus нужен явный общий слой;
- `test/device-face.test.mjs` и/или новый pure visual-contract test;
- `demo/smoke_device_icon_design.mjs` — computed geometry/theme/state matrix;
- `demo/golden/*` и demo-only reference assets — независимая side-by-side таблица;
- `docs/images/*`, `docs/TESTING.md`, оба changelog.

`src/device-visual.ts`, `src/device-presentation.ts` и `src/device-pulse.ts` не
должны меняться без доказанного отсутствующего renderer fact: эта задача не
переопределяет semantic state.

## 11. Независимая visual QA

Новый fixture не должен получать ожидаемые значения импортом из production
CSS/TypeScript. Он хранит отдельно измеренный контракт package 1.1.1 и прямые
reference SVG для репрезентативных состояний.

Таблица сравнения содержит два соседних столбца — **Reference SVG** и
**Runtime** — для Light/Dark и размеров 32/56/96. Минимальный набор строк:
Default, Hover, Active, Lock, Unlock, Selected, Focus, Alert, Virtual,
Unavailable, Text и Double Right. Дополнительно runtime state-table сохраняет
четыре Double sides, LQI bands и комбинации состояний из §7.3.

Code review обязан посмотреть side-by-side результат глазами и записать это в
вердикте; успешный `golden:verify` без такого сравнения AC не закрывает.

## 12. Acceptance criteria

- [ ] **AC1 — круглая геометрия.** Icon core круглый, MDI viewport равен
      `0.5 × core`, shell/core ratio `1.26875`, value section является pill;
      32/56/96 укладываются в допуск §7.1.
      **Доказательство:** computed-style browser smoke + side-by-side golden.
- [ ] **AC2 — theme parity.** Light/Dark Default используют точные core/glyph,
      shell stroke/opacity и package shadows; ни один marker не создаёт
      backdrop-filter.
      **Доказательство:** smoke token/geometry assertions + reviewed golden.
- [ ] **AC3 — state parity.** Hover, Active, Lock, Unlock, Selected, Focus,
      Alert, Virtual и Unavailable соответствуют §7.3 и прямым SVG; decoration
      применяется к правильному слою.
      **Доказательство:** light/dark computed-style matrix + side-by-side golden.
- [ ] **AC4 — combinations.** Alert, Focus, Selected, Hover и semantic state
      сохраняют принятый приоритет и отдельные слои; generic open не становится
      lock state.
      **Доказательство:** unit/presentation regression + combination golden.
- [ ] **AC5 — layouts.** Icon, Text, Double на четырёх сторонах, third section
      и LQI сохраняют anchor, полный текст и нормативную круглую/pill форму.
      **Доказательство:** existing layout units + targeted smoke/golden.
- [ ] **AC6 — surface parity.** Полный план, киоск, Device preview и static card
      используют общий face и одинаково проецируют read-only состояние.
      **Доказательство:** preview/static parity smokes + code inspection.
- [ ] **AC7 — interaction regression.** 44×44 hit area, unavailable click/tap,
      hover suppression, Enter/Space и secure action path не изменились.
      **Доказательство:** targeted browser smokes.
- [ ] **AC8 — data and semantics.** Нет config/i18n/migration изменений; LQI,
      pulse, activity, actions, Glow и vacuum semantics не изменены.
      **Доказательство:** unit suite + diff inspection.
- [ ] **AC9 — failing-before-fix guard.** Новые geometry/state assertions
      доказанно падают на `v1.65.0-beta.6` как минимум из-за `28%`, `0.62`,
      value radius и Dark shell.
      **Доказательство:** запись mutation/before-fix результата в handoff.
- [ ] **AC10 — release artifacts.** Оба changelog описывают исправление #211;
      screenshots/visual matrix актуальны, а golden принимаются только по
      полному reviewed Linux CI artefact.
      **Доказательство:** docs/provenance checks и prerelease gate.

## 13. План тестирования

### Цикл реализации

```bash
npm run typecheck
npm test
npm run build
```

Перед `S7-code-review` после fresh build и синхронизации трёх bundle-копий:

```bash
node demo/smoke_device_icon_design.mjs
node demo/smoke_device_preview_parity.mjs
node demo/smoke_static_icon.mjs
node demo/smoke_disabled_device.mjs
```

Если secure keyboard path затронут diff'ом, дополнительно запускается его
существующий named smoke. `golden:capture`/`golden:verify` выполняются для
визуальной диагностики; обновлённые baselines не принимаются на Windows.

Перед следующей бетой обязательны полный Linux golden, browser smoke и
performance gate по release runbook. Полный HA harness остаётся каноничным в
Linux CI из-за `fcntl`.

## 14. Производительность, риски и откат

**Бюджет:** DOM и число marker layers не должны расти без необходимости;
рендер 200 устройств не получает layout read, backdrop layer, per-frame JS или
per-marker media subscription. Исправление CSS geometry само по себе не должно
ухудшать performance budget.

**Риски:** theme-specific shadows могут расходиться между WebView; MDI glyph
имеет собственные пустые поля; длинные values расширяют shell; неверный
specificity снова смешает semantic core и selection/focus.

**Митигации:** отдельные tokens/layers, computed assertions на 32/56/96,
реальные MDI glyphs в runtime column, контрастные backgrounds и прямые SVG в
reference column.

**Откат:** один revert implementation commit возвращает CSS/fixture; данных и
миграций нет. Возврат к ошибочным beta.6 golden не является допустимым способом
отката эталона.

## 15. Release-артефакты

В user-visible implementation commit обновить:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #211;
- `docs/TESTING.md` — independent reference/runtime matrix и named smoke;
- затронутые документационные screenshots после визуальной проверки.

Golden baseline меняется отдельным допустимым коммитом только через
`npm run golden:accept -- --reviewed` по полному Linux CI artefact с обязательными
`Release:` и `Baseline-Reviewed:` trailers. Поставка — только следующей beta по
прямой команде владельца.

## 16. Принятые технические предположения

Эти решения пользователь не наблюдает как отдельный продуктовый контракт и
могут быть изменены ревьюером:

1. Репрезентативные reference SVG хранятся только в `demo/` и не попадают в
   production bundle.
2. Exact CSS projection может использовать custom properties, псевдоэлементы
   либо явный decoration span, если один общий renderer остаётся источником
   истины.
3. Expected facts теста транскрибируются из package 1.1.1 отдельно от
   production tokens; тест не импортирует реализацию, которую проверяет.
4. Для визуального pixel diff допустим anti-aliasing threshold, но проверка
   width/height/radius/color/stroke остаётся точной и не маскируется threshold.
5. Существующие ошибочные baselines не удаляются до появления полного нового
   reviewed Linux artefact; локальный actual используется для ревью, не для
   принятия эталона.
