# Issue #219 — единая палитра замков и glyph на оранжевых подложках

- **Issue:** https://github.com/Matysh/houseplan-card/issues/219
- **Связанные контракты:** #179, #211, #213, #217
- **Тип:** bug / polish, обычный полный трек
- **Приоритет:** P1
- **Пользовательское изменение:** да

## 1. Сценарий и персона

**Персона:** домочадец, который по плану проверяет, открыта ли дверь, заперт ли
замок и работает ли устройство; администратор, который сверяет те же состояния
в Device preview и статической карточке пространства.

**Сценарий:** в светлой теме рядом находятся два устройства с оранжевой
semantic-подложкой. Активное устройство рисует белый glyph, а открытая дверь —
тёмный. Одновременно lock-состояние проёма всё ещё использует прежние black / amber
цвета, хотя владелец принял новый red / green смысл.

## 2. Что человек увидит до и после

До исправления одинаковая оранжевая подложка может содержать и белые, и тёмные
иконки в одной теме. Закрытый замок выглядит чёрным, открытый — оранжевым.

После исправления каждый glyph на оранжевой подложке белый в светлой теме и
`#252525` в тёмной. Замок имеет отдельную однозначную палитру: открыто /
разблокировано — красный, закрыто / заблокировано — зелёный.

## 3. Подтверждённая причина

`src/styles.ts` задаёт разные правила для состояний, использующих оранжевую
подложку:

- `.dev.on` уже имеет theme-specific foreground: white / `#252525`;
- `.dev.open` всегда использует `#4a2800`, независимо от темы;
- `.dev.lock-unlocked` и `.oplock.unlocked` используют старый amber-контракт;
- `.dev.lock-locked` и `.oplock.locked` используют старый black-контракт.

Все три device-поверхности используют `cardStyles` и общий `renderDeviceFace()`,
поэтому причина не в разных renderer, а в несовместимых semantic CSS tokens.

## 4. Нормативные источники и приоритет

При расхождении применяются в следующем порядке:

1. решение владельца в #219: lock open = red, lock closed = green; orange glyph
   = white в Light и black в Dark;
2. это ТЗ после зелёного SPEC-REVIEW;
3. геометрия, слои, темы и interaction priority из #179/#211/#213/#217;
4. текущая реализация для всего поведения, явно не изменяемого этой задачей.

Новое решение заменяет только state-цвета старого Lock/Unlock-контракта. Оно не
отменяет принятые размеры, glyph paths, shell/core geometry, тени и действия.

## 5. Цели

1. Дать lock-состояниям одну red/green палитру во всех представлениях.
2. Устранить theme-расхождение всех device glyph на оранжевой подложке.
3. Сохранить общий renderer и действующий приоритет interaction/alert слоёв.
4. Зафиксировать новую таблицу цветов автоматическими и визуальными проверками.

## 6. Scope

В задачу входят:

- semantic CSS states в `src/styles.ts`;
- ordinary device marker для `lock-locked`, `lock-unlocked`, `on`, `open`;
- compact `.oplock` badge у door/gate opening;
- одинаковая проекция на интерактивном плане, в Device preview и static space
  card через существующие shared DOM/CSS;
- contract/unit tests и существующая light/dark device state-table golden;
- оба changelog, `docs/TESTING.md`, при необходимости канонический документ
  device icon states, generated bundles и screenshot fingerprint.

## 7. Не входит в задачу

- новые настройки цветов или миграция конфига;
- изменение определения `on`, `open`, `locked`, `unlocked`;
- изменение MDI icon, размеров, shell/core ratio, теней или stroke width;
- изменение hit-area, hover target, click/tap/keyboard/lock action;
- изменение alarm, unavailable, virtual, selected, focus или pulse animation;
- изменение оранжевых линий/створок проёмов, selection ring, room fill или Glow;
- изменение info-card текста и red warning-кнопки Unlock;
- принятие golden baseline на Windows, выпуск беты или закрытие issue.

## 8. Нормативная таблица состояний

### 8.1. Замки

| Состояние | Core и semantic stroke | Glyph Light | Glyph Dark |
|---|---|---|---|
| `locked` / закрыто | green `#66D17A` | white `#FFFFFF` | `#252525` |
| `unlocked` / открыто | red `#F0410C` | white `#FFFFFF` | `#252525` |
| unknown/unavailable | существующая neutral-проекция | без изменений | без изменений |

Таблица применяется одинаково к `.dev.lock-*` и `.oplock.*`. Locked использует
`mdi:lock`, unlocked/known-open — `mdi:lock-open-variant`, unknown — текущий
`mdi:lock-question`. Состояния `locking`/`unlocking` сохраняют текущую known-open
классификацию и не получают новой state machine в этой задаче.

### 8.2. Оранжевая device-подложка

После изменения оранжевую semantic-подложку device core имеют обычные состояния
`on`/working (`#F0A00C`) и physical `open` (`var(--hp-open)`). Для обоих:

- Light glyph: `#FFFFFF`;
- Dark glyph: `#252525`;
- CSS `light-dark()` остаётся fallback, а явные `.theme-light/.theme-dark`
  классы являются авторитетными при доступном `hass.themes.darkMode`.

Оранжевый selection ring не является подложкой и не меняет текущий glyph.

## 9. Приоритет состояний и взаимодействие

Порядок существующих слоёв не меняется:

- alarm остаётся выше hover/focus/selected и использует свой red alert contract;
- hover меняет ordinary state core/glyph на blue theme projection;
- focus и selected остаются отдельными ring-слоями и не стирают semantic core;
- unavailable остаётся серым, полупрозрачным и без hover;
- virtual сохраняет dashed shell с ordinary state core;
- press feedback, pulse и reduced motion не меняются.

Правка не добавляет selectors, зависящих от pointer modality, и не меняет
touch/pen/mouse/keyboard contract.

## 10. Архитектура и зоны изменений

Ожидаемая реализация остаётся декларативной:

```text
ResolvedDevicePresentation classes / opening lock state
  → shared semantic CSS variables in cardStyles
  → existing device-face / oplock DOM
  → plan + preview + static card
```

Ожидаемые файлы:

- `src/styles.ts` — state tokens и theme-specific foreground;
- `test/device-marker-polish-contract.test.mjs` — точные semantic contracts;
- `demo/golden/matrix.mjs` и `test/golden-matrix.test.mjs` — orange `open` рядом
  с `on`, обе темы, lock red/green states;
- `docs/TESTING.md`, оба changelog и при необходимости device-icon docs;
- три generated bundle после `npm run build`.

`src/device-presentation.ts`, `src/device-face.ts` и `src/houseplan-card.ts` не
должны меняться, если анализ реализации не обнаружит, что CSS-классы не доходят
до одной из уже общих поверхностей. Такое расширение сначала фиксируется в
implementation evidence; новый renderer запрещён.

## 11. Данные, i18n, accessibility, privacy и security

Config/backend schema, persisted layout, localStorage и сериализация не меняются;
миграция не нужна. Новых строк и i18n-ключей нет. `aria-label`, state text,
tooltip и действия сохраняются; красный/зелёный не становятся единственным
носителем смысла, потому что glyph и текст состояния различаются. Network,
permissions и private data не затрагиваются.

## 12. Performance

Изменение ограничено CSS variables и fixture/test metadata. Оно не добавляет DOM,
JS в render path, observers, timers, filters, blur или layout measurement.
Performance budget и размер hit-area должны остаться без изменений.

## 13. Риски

| Риск | Последствие | Снижение риска и доказательство |
|---|---|---|
| Broad selector перекрасит alert/hover/unavailable | Семантически более важное состояние станет неверным | Сохраняется текущая specificity/порядок; unit проверяет selectors, golden — комбинации |
| Compact opening badge и device marker разойдутся | Одна lock-сущность будет иметь два цвета | Один contract test проверяет обе пары `.oplock` и `.dev.lock-*` |
| `light-dark()` не следует HA theme | Цвет зависит от browser color-scheme | Сохраняются явные `.theme-light/.theme-dark`; тест требует обе проекции |
| Golden покажет ожидаемую дельту вместе с посторонней | Можно принять лишнее визуальное изменение | Меняется существующая state-table, reviewer сверяет light/dark artifacts; baseline принимается только полным Linux-run по процессу |
| Красный/зелёный затронут info-card action status | Меняется не запрошенная UX-семантика | Scope ограничен marker/badge CSS; info-card selectors и код действий остаются byte-unchanged |

## 14. Acceptance criteria

1. **AC1 — lock badge palette.** Compact opening badge показывает `locked` с
   core/stroke `#66D17A`, `unlocked` с core/stroke `#F0410C`; Light glyph белый,
   Dark glyph `#252525`; unknown остаётся neutral. **Доказательство:** contract
   unit + light/dark visual artifact.
2. **AC2 — lock marker parity.** Обычный marker lock-сущности использует ту же
   red/green таблицу и прежние `mdi:lock` / `mdi:lock-open-variant` во View,
   Device preview и static card. **Доказательство:** presentation/unit source
   contract + shared-renderer test + golden state-table.
3. **AC3 — orange glyph parity.** `on` и physical `open` на оранжевой подложке
   имеют белый glyph в Light и `#252525` в Dark; failing-before-fix assertion
   ловит прежний постоянный `#4a2800` у `.dev.open`. **Доказательство:** contract
   unit + state-table light/dark golden с одновременно видимыми `on` и `open`.
4. **AC4 — interaction priority.** Alarm, hover, focus, selected, unavailable,
   virtual и press/pulse selectors сохраняют прежний приоритет и значения;
   hit-area и действия не меняются. **Доказательство:** существующие device
   presentation/polish/pointer tests + source review.
5. **AC5 — поверхности и темы.** Plan, preview и static card используют один
   `cardStyles`/`renderDeviceFace` contract; обе темы проверены одной fixture без
   поверхностных fork. **Доказательство:** shared-renderer unit + golden matrix.
6. **AC6 — невидимые контракты.** Нет изменений config/backend/i18n/a11y text,
   DOM geometry, touch и performance path. **Доказательство:** diff review,
   typecheck, полный unit и build.
7. **AC7 — release artifacts.** Оба changelog и `docs/TESTING.md` описывают новую
   палитру; `dist`, demo и integration bundle идентичны; screenshot manifest
   актуален. **Доказательство:** diff, hash comparison, `check-docs`.

## 15. Проверки реализации и ревью

Обязательный implementation loop:

```text
npm run typecheck
npm test
npm run build
```

Дополнительно по изменённой поверхности:

- targeted device marker contract tests;
- `npm run golden:verify` на code review / предрелизном гейте с обязательной
  проверкой `device-icon-state-table-light` и `device-icon-state-table-dark`;
- сверка SHA-256 трёх bundle;
- `node scripts/check-docs.mjs --external`.

Golden baseline не принимается автором реализации. Если baseline должен
измениться, это делается только через процесс reviewed Linux artifact.

## 16. Release-артефакты

- `docs/CHANGELOG.md`;
- `docs/CHANGELOG.ru.md`;
- `docs/TESTING.md`;
- актуализация канонической таблицы device states, если она дублирует старую
  black/amber lock-палитру;
- light/dark state-table golden artifact для review;
- `docs/images/screenshots.json` после штатного capture, если source fingerprint
  изменился; PNG коммитятся только при реальной проверенной дельте;
- три идентичных generated bundle.

## 17. Откат

Откат — один product commit #219 вместе с обоими changelog, документацией,
fixture/test metadata и generated bundles. Данные пользователя не меняются,
поэтому миграции назад нет. Частичный откат только одной из lock-проекций или
одной темы запрещён: он восстановит исходное расхождение.

## 18. Принятые предположения

1. «Чёрный в тёмной теме» — существующий designer foreground `#252525`.
2. Red/green lock palette применяется и к compact opening badge, и к обычному
   marker lock-сущности.
3. Red/green используют существующие semantic цвета `#F0410C` / `#66D17A`; это
   не настраиваемая пользователем палитра.
4. «Все иконки на оранжевой подложке» относится к device core. Оранжевые линии
   проёмов, selection ring и activity ripple не являются подложкой glyph.
5. Дополнительных предупреждений, настроек и текстов не требуется.

