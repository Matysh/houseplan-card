# Issue #57 — единый выбор цвета и прозрачности за один клик

- **Issue:** https://github.com/Matysh/houseplan-card/issues/57
- **Статус документа:** готово к будущей реализации; issue остаётся на `S3-spec`
- **Приоритет:** P3
- **Тип:** polish/tech-debt, обычный трек
- **Пользовательское изменение:** да

## 1. Сценарий

Администратор настраивает цвет комнаты, контура, текста, мебели, decor fill либо
Glow в одном из редакторских диалогов. Он нажимает образец цвета и ожидает сразу
получить все относящиеся к значению controls на одной поверхности.

## 2. Что человек увидит до и после

До изменения первый клик открывает строку с нативным color input и прозрачностью,
а второй клик по цвету открывает отдельный системный picker без прозрачности;
после изменения один клик по образцу открывает единый House Plan picker, где цвет
и прозрачность редактируются вместе.

## 3. Проблема

Текущий `hp-color-opacity` уже объединяет swatch и alpha slider внешне, но сам
цвет делегирует `<input type="color">`. Получается вложенный workflow: popover
House Plan → системный picker → возврат к отдельной прозрачности. На touch это
особенно неудобно, а системная поверхность отличается между браузерами и не
следует theme/accessibility contract карточки.

Главное решение владельца: убрать именно эту вложенность. Отдельная сложная
профессиональная палитра, история цветов и второй dialog не нужны.

## 4. Scope

В задачу входят:

- замена нативного nested color input внутри `hp-color-opacity` единым встроенным
  picker UI;
- цветовое поле, hue, точное текстовое значение и alpha на одной поверхности;
- сохранение действующего public API и всех call sites;
- keyboard, screen reader, touch/pointer capture и обе темы;
- общий floating-surface/overlay lifecycle из #68;
- pure color conversion/validation helpers;
- bundle-size отчёт и targeted unit/smoke/golden coverage.

## 5. Не входит в задачу

- palette history, eyedropper, gradients, RGB/CMYK/Lab panels;
- сохранённые пользовательские presets или синхронизация между карточками;
- отдельная полноэкранная/mobile страница;
- runtime dependency либо загрузка кода/палитры по сети;
- изменение формата сохраняемого цвета/opacity;
- массовый redesign диалогов и editor touch parity;
- добавление alpha в consumers, где `showOpacity=false` имеет предметный смысл.

## 6. Технический выбор

Внутри существующего `hp-color-opacity` реализуется небольшой in-repo HSV picker:

- saturation/value field;
- отдельный hue range;
- alpha range + точное значение в процентах, если `showOpacity=true`;
- редактируемое hex-поле `#RRGGBB`;
- preview swatch на checkerboard.

Почему выбран этот путь:

| Вариант | Итог |
| --- | --- |
| Нативный `<input type=color>` | отклонён: сохраняет второй вложенный picker и не объединяет alpha |
| Vendored `iro.js`/`vanilla-picker`/аналог | отклонён по умолчанию: чужой lifecycle/theme/a11y и риск превысить budget ради малого surface |
| In-repo HSV controls | принят: сохраняет API, использует native ranges/floating controller и добавляет только нужный контракт |

Новых runtime dependencies в `package.json` нет. Production minified+gzip bundle
delta этой функции не превышает 15 KiB; в handoff публикуются raw и gzip значения
до/после на exact build.

Если автор докажет, что vendored dependency меньше и лучше выполняет все AC, это
допустимая техническая замена только при: локально vendored source/license,
нулевых runtime fetch, том же API, ≤15 KiB gzip delta и полном тестовом контракте.
Продуктовая поверхность от выбора реализации не меняется.

## 7. Единый interaction contract

Один click/tap/Enter/Space по swatch открывает одну surface. В момент первого
paint на ней одновременно доступны:

- saturation/value field;
- hue;
- hex value;
- opacity slider и процент для opacity-capable consumer.

Ни один control внутри не открывает системный color dialog. Изменения применяются
к draft в реальном времени через существующее событие
`hp-color-opacity-change`; сохранение/отмена принадлежит родительскому диалогу и
остаётся прежним.

Повторное нажатие trigger, click/tap вне поверхности, Escape, открытие другой
exclusive transient surface, закрытие родительского диалога, mode change или
disconnect закрывают picker. Escape сначала закрывает picker и не закрывает
dialog; второй Escape работает по обычному контракту `hp-dialog`.

Открытие не меняет высоту/scroll родительского dialog. Popover API, portal
fallback, flip/shift, visual viewport, resize/orientation и focus traversal
переиспользуют `FloatingSurfaceController`/`hp-dialog.registerOverlay` из #68.

## 8. Значения и преобразования

- Canonical external color остаётся lowercase либо normalized `#RRGGBB` по
  действующему `safeStoredColor` contract.
- Opacity наружу остаётся числом `[0,1]`; UI показывает целые `0–100%`.
- HSV существует только как transient representation и не сохраняется.
- Hex input принимает `RGB`, `RRGGBB`, с необязательным `#`; после commit
  нормализуется в `#rrggbb`/действующий canonical case.
- Невалидный незавершённый hex остаётся draft до blur/Enter и не отправляет
  испорченное значение. На commit восстанавливается последнее валидное значение.
- Изменение hue у achromatic цвета сохраняет transient hue в открытой session,
  чтобы последующее повышение saturation давало выбранный hue.
- Все conversions конечны, clamped и имеют round-trip tolerance ≤1 RGB channel.

`showOpacity=false` полностью скрывает alpha row, не меняет входной opacity и
эмитит его существующее значение вместе с новым цветом для API compatibility.

## 9. Pointer и touch

- Touch по saturation/value field использует Pointer Events и capture; движение
  за пределами поля продолжает текущую drag-session до up/cancel.
- Второй pointer отменяет изменение первого либо игнорируется безопасно; pinch
  родительского canvas не начинается через открытую picker surface.
- Touch targets hue/alpha/close-independent controls не меньше 40×40 CSS px.
- `touch-action` задаётся только интерактивному полю/slider, не всему dialog.
- `pointercancel`/lost capture сохраняют последнее уже эмитированное валидное
  draft, очищают drag state и не создают дополнительное событие.
- Compatibility mouse после tap не открывает/закрывает surface второй раз.

Сам picker получает явную touch-поддержку. Остальные операции редакторов остаются
best effort согласно `docs/TOUCH-SUPPORT.md`.

## 10. Keyboard и accessibility

- Trigger остаётся настоящей кнопкой с `aria-haspopup="dialog"` и
  `aria-expanded`.
- Surface имеет локализованное accessible name и участвует в composed focus trap.
- Hue, saturation, value и opacity доступны как отдельные native range inputs
  либо эквивалентные sliders с `aria-valuemin/max/now/text`.
- Pointer-only saturation/value field не является единственным способом: рядом
  существуют keyboard-доступные saturation и value controls.
- Arrow меняет значение на 1, `Shift+Arrow` — на 10; Home/End устанавливают
  границы, где это соответствует native range semantics.
- Hex — подписанный text input с сообщаемой validation ошибкой без live-region
  spam на каждый символ.
- Focus-visible не смешивается с hover; при закрытии Escape focus возвращается
  на trigger, при outside click не переносится.
- При 200% zoom и viewport 390 CSS px поверхность не имеет горизонтального
  overflow; допустим внутренний вертикальный scroll.

## 11. Theme и visual contract

- Surface использует HA/House Plan theme tokens, не hardcoded light palette.
- Saturation/value и hue tracks остаются читаемыми в light/dark themes.
- Checkerboard явно показывает opacity, включая 0%.
- Trigger продолжает показывать итоговую пару color+opacity.
- Disabled component не открывается и не меняет draft.
- `prefers-reduced-motion` отключает только open/close transition; color drag
  остаётся немедленным.

## 12. API, модель данных и migration

Сохраняется существующий contract:

```ts
color: string
opacity: number
showOpacity: boolean
disabled: boolean
hp-color-opacity-change: { color: string; opacity: number }
```

Существующие call sites не получают адаптеров и охватывают как минимум decor
stroke/fill/text/furniture, room/space custom fill и marker Glow override.
Config schema, backend, storage и migration не меняются; старые colors/alpha
открываются и сохраняются losslessly в прежнем формате.

## 13. i18n

Добавляются пары en/ru для общих controls: Color picker, Hue, Saturation, Value/
Brightness, Hex color и Opacity (существующий `space.opacity` можно переиспользовать
только если семантика и scanner допускают это без связности с space dialog).

`hp-color-opacity` остаётся presentation-only и получает уже локализованные labels
properties от House Plan; он не читает глобальный словарь или `hass.locale`.
Две карточки с разными `config.language` не влияют друг на друга.

## 14. Acceptance criteria

1. **AC1 — один уровень.** Первый click/tap/keyboard activation открывает surface,
   где сразу доступны color и opacity; внутри нет `<input type=color>` или второго
   picker dialog. **Доказательство:** DOM unit + desktop/touch smoke.
2. **AC2 — все consumers.** Existing call sites продолжают работать через тот же
   API; `showOpacity=false` скрывает только alpha. **Доказательство:** source-contract
   unit + smoke matrix.
3. **AC3 — точные значения.** HSV/RGB, hex и alpha round-trip без повреждения,
   invalid draft не эмитится. **Доказательство:** table/property unit tests.
4. **AC4 — touch.** Drag поля/hue/alpha, cancel и multi-touch безопасны на 390px
   viewport; nested/system picker не появляется. **Доказательство:** real-touch smoke.
5. **AC5 — keyboard/a11y.** Все четыре dimensions и hex доступны с клавиатуры,
   labels/roles/values корректны, Escape/focus trap работают. **Доказательство:**
   accessibility/browser smoke.
6. **AC6 — floating lifecycle.** Native/fallback surface не обрезается, корректно
   flip/shift-ится и конкурирует с `hp-help` по #68. **Доказательство:** forced-
   fallback smoke.
7. **AC7 — visual parity.** Light/dark/200% zoom читаемы, checkerboard отражает
   alpha, dialog layout не прыгает. **Доказательство:** reviewed golden.
8. **AC8 — budget.** Нет runtime dependency/fetch; minified+gzip delta ≤15 KiB,
   raw/gzip числа записаны. **Доказательство:** exact production build artifact.
9. **AC9 — compatibility.** Config/backend schema и serialized values не меняются.
   **Доказательство:** round-trip unit + code review.

## 15. План автотестов

### Unit

- RGB↔HSV round trips, hue wrap, grayscale remembered hue;
- safe hex parsing/commit/cancel and alpha clamping;
- single event payload and no event for invalid draft;
- `showOpacity`, disabled and existing property/event API;
- source scan prohibits native `input[type=color]` in component;
- en/ru key parity and presentation-only labels.

### Browser smoke

- each representative consumer: decor stroke/fill, room fill, Glow color-only;
- pointer field/hue/alpha/hex, live draft and parent Cancel/Save;
- keyboard traversal/ranges/hex/Escape and dialog focus wrap;
- real touch, multi-touch/pointercancel, 390px/200% zoom;
- native Popover and forced portal fallback, viewport edges/rotation;
- `hp-help` exclusive overlay interaction and two-card language isolation.

### Golden

- open picker in light/dark desktop;
- mobile 390px with non-100% alpha checkerboard;
- color-only Glow variant without alpha row;
- golden baseline updates only from reviewed full Linux artifact.

### Performance and size

- production build size before/after: raw and gzip;
- pointermove updates only local component/draft, without parent full render per
  raw event (rAF/coalescing allowed);
- no new long task in targeted editor smoke.

## 16. Затронутые поверхности

- `src/hp-color-opacity.ts`, `src/color.ts` либо новый small pure color helper;
- `src/houseplan-card.ts` only for localized properties/call-site parity;
- `src/i18n/en.json`, `src/i18n/ru.json`;
- component unit tests, dialog/touch smoke and golden fixtures;
- `docs/USER-GUIDE.ru.md`, `docs/TESTING.md`.

## 17. Риски и откат

| Риск | Мера |
| --- | --- |
| Custom field недоступен keyboard | отдельные native range alternatives |
| Pointer drag перегружает render | local state + rAF/coalesced emission |
| Цвет round-trip дрейфует | property/table tests и canonical external RGB |
| Surface обрезается dialog | общий floating controller #68 |
| Bundle непропорционально растёт | ≤15 KiB gzip hard budget |

Откат возвращает прежнее внутреннее содержимое `hp-color-opacity`; public API и
сохранённые данные не меняются, поэтому migration rollback не нужен.

## 18. Release-артефакты

Implementation commit имеет `User-Visible: yes` и одновременно обновляет:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`;
- `docs/USER-GUIDE.ru.md` — единый one-click color+opacity workflow;
- `docs/TESTING.md` — component/touch/fallback/keyboard coverage.

Нужны reviewed desktop/mobile golden artifacts, targeted smoke report и bundle
size note с exact build SHA. Новые i18n keys добавляются синхронно en+ru.

## 19. Принятые технические предположения

- базовый implementation — in-repo HSV field + native ranges, без dependency;
- external model остаётся `#RRGGBB` + opacity `[0,1]`;
- live change API сохраняется, Save/Cancel принадлежит parent dialog;
- pointer field дополняется, а не заменяет keyboard-доступные ranges;
- exact easing/layout допустимо уточнять на реализации без изменения one-click
  и accessibility contracts.
