# #476 — Явное завершение выбора цвета кнопкой «ОК»

- **Issue:** https://github.com/Matysh/houseplan-card/issues/476
- **Тип / приоритет:** feature + polish / P2
- **Трек:** полный; появляется новый наблюдаемый UX-контракт завершения общей
  поверхности выбора цвета, включая desktop, touch и fallback без Popover API
- **Оценка:** пользовательская ценность 7/10; ценность для разработки 6/10;
  сложность 3/10; риск 3/10
- **Связано:** #57, #180; `docs/SCOPE.md`, `docs/TOUCH-SUPPORT.md`

## 1. Сценарий

Персона — Home admin из `docs/SCOPE.md`. Поверхность — любой редакторский или
настроечный диалог House Plan, в котором используется стандартный выбор цвета.
Момент — администратор уже настроил цвет и, если доступно, прозрачность, но не
понимает, каким действием завершить работу с открытой поверхностью.

Desktop с мышью и клавиатурой остаётся эталонной средой редакторов. Та же кнопка
доступна на touch, поскольку `hp-color-opacity` уже является общей touch-capable
поверхностью и явное завершение не требует нового жеста.

## 2. Что человек увидит до и после

**До:** после настройки цвета в picker нет явного действия завершения, поэтому
пользователь вынужден догадываться, что поверхность закроется нажатием снаружи,
повторным нажатием на образец или `Escape`.

**После:** внизу picker находится заметная полноширинная кнопка «ОК»; нажатие
сохраняет уже показанный результат и закрывает поверхность, а прежние способы
закрытия продолжают работать.

## 3. Проблема

Единый `hp-color-opacity`, созданный в #57 и распространённый на все места
выбора цвета в #180, применяет корректные изменения сразу через событие
`hp-color-opacity-change`. Он умеет закрываться через trigger, outside pointer,
`Escape`, смену transient overlay и lifecycle родительского диалога, но не
показывает ни одного явного действия внутри самой поверхности.

Технически выбор уже состоялся, но визуально интерфейс выглядит незавершённым.
Это повторяется во всех потребителях общего компонента: decor, room/space,
общих цветах, Glow и ripple.

## 4. Решения владельца

1. Сохраняется нынешнее live-применение. «ОК» не создаёт отдельную транзакцию и
   не откладывает изменение родительского draft.
2. Outside click/tap, повторное нажатие swatch и `Escape` сохраняются; каждый
   путь оставляет последнее валидное live-применённое значение.
3. При незавершённом невалидном HEX «ОК» не закрывает picker. Последнее валидное
   применённое значение сохраняется, а ошибка у HEX-поля остаётся видимой до
   исправления.
4. Кнопка — полноширинная primary-кнопка внизу picker.

## 5. Скоуп

- одна кнопка подтверждения внутри общей поверхности `hp-color-opacity`;
- одинаковый interaction contract в native Popover API и portal/fallback;
- одинаковое поведение для `showOpacity=true` и color-only потребителей;
- локализованная подпись кнопки во всех поддерживаемых языках;
- keyboard focus, screen-reader name, forced-colors и touch hit target;
- сохранение действующих live events и всех прежних путей закрытия;
- unit, browser smoke и reviewed golden для светлой/тёмной тем, desktop/touch;
- пользовательская запись в обоих changelog.

## 6. Не входит

- кнопка «Отмена», Reset, история, presets, eyedropper или новый palette UI;
- транзакционный черновик цвета внутри компонента либо откат live-изменений;
- изменение состава HSV/HEX/opacity controls и их порядка;
- изменение формата `#rrggbb`, opacity `[0, 1]` или
  `hp-color-opacity-change`;
- изменение Save/Cancel родительских диалогов и серверной конфигурации;
- отдельные правила для decor, room, space, general settings, Glow или ripple;
- новый глобальный keyboard shortcut: `Enter` в HEX-поле сохраняет свой
  текущий смысл, а `Enter`/`Space` на самой кнопке работает нативно;
- переработка floating placement, overlay stacking либо touch parity остальных
  редакторских операций.

Если реализация потребует изменить момент применения значения, detail события,
родительские drafts или закрытие других transient overlays, задача возвращается
в `S3-spec` как расширение публичного контракта.

## 7. Контракт поведения

### 7.1 Live-применение

Hue, saturation, brightness, валидный HEX и opacity продолжают немедленно
обновлять локальный preview и отправлять существующее bubbling/composed событие
`hp-color-opacity-change` с detail `{ color, opacity }`. Родительский consumer
продолжает обновлять свой draft или сохранённый editor style так же, как до
#476.

Открытие picker и нажатие «ОК» без нового значения не отправляют событие.
Нажатие «ОК» после уже live-применённого изменения также не отправляет
дублирующее событие: кнопка завершает взаимодействие, а не повторно применяет
состояние.

### 7.2 Кнопка «ОК»

Кнопка является последним focusable control в DOM-порядке picker и находится
после opacity-row либо после HEX-control у `showOpacity=false`. Она занимает всю
доступную ширину внутренней области, имеет высоту не менее 40 CSS px и следует
theme tokens House Plan для primary action. В `forced-colors` используются
системные цвета/граница, а не невидимый theme-only fill.

Один click/tap либо нативная активация `Enter`/`Space`:

1. валидирует текущий HEX draft по существующему правилу commit;
2. при валидном draft закрывает picker тем же единым lifecycle-путём, что
   остальные close reasons;
3. возвращает keyboard focus на swatch trigger;
4. не передаёт click/tap нижележащему plan, toolbar или родительскому dialog.

Кнопка существует и работает одинаково во всех экземплярах общего компонента;
отдельного opt-in property у consumers нет.

### 7.3 Невалидный HEX

Если на момент нажатия «ОК» HEX draft не нормализуется как 3- или 6-значный
цвет либо поле всё ещё несёт результат предыдущей неуспешной валидации:

- picker остаётся открытым;
- `aria-invalid=true` и существующее локализованное сообщение ошибки остаются
  видимыми;
- последнее валидное значение color/opacity и родительский draft не меняются;
- новое `hp-color-opacity-change` не отправляется;
- focus остаётся/переводится в HEX input, чтобы значение можно было исправить.

После ввода валидного HEX повторное «ОК» закрывает picker по §7.2. Точное
существующее правило отображения невалидного draft (нормализация поля к
последнему валидному значению при commit) не меняется этой задачей. При этом
повторное «ОК» без нового валидного пользовательского ввода не имеет права
снять состояние ошибки только потому, что commit уже вернул в поле последнее
валидное значение: поверхность остаётся открытой до реального исправления.
Компонент обязан отдельно запоминать, что после неуспешного commit не было
нового `input`-события HEX-поля. Этот признак не сбрасывается нормализацией
draft внутри commit helper, повторным нажатием «ОК», blur или переводом фокуса;
он снимается только новым пользовательским `input` с валидным HEX.

### 7.4 Остальные способы закрытия

Повторное нажатие trigger, pointer down вне surface, `Escape`, открытие другой
exclusive transient surface, закрытие родительского диалога, mode change,
disconnect и потеря валидного anchor продолжают закрывать picker по нынешним
правилам. Они не откатывают уже live-применённое значение и не требуют
предварительно нажать «ОК».

`Escape` из focus внутри picker закрывает сначала picker и возвращает focus на
trigger; второй `Escape` принадлежит родительскому dialog. Outside pointer и
trigger-close сохраняют свой текущий focus contract.

## 8. UX, touch и доступность

- `hp-color-opacity` сохраняет `role="dialog"`, доступное название и одну
  floating surface; кнопка — нативный `button type="button"` с видимым текстом.
- Полноширинная цель имеет минимум 40 px высоты. На узком viewport она остаётся
  в обычном scroll flow поверхности, не перекрывает HSV/HEX/opacity controls и
  не увеличивает ширину за viewport.
- Tap по кнопке закрывает только picker и не превращается в editor action.
  Pointer capture HSV-поля и `pointercancel` остаются прежними.
- Light/dark theme, browser zoom, visual viewport, flip/shift placement и
  portal fallback используют существующий `FloatingSurfaceController`.
- Новых анимаций нет; `prefers-reduced-motion` не меняется.

Touch editor остаётся best effort по `docs/TOUCH-SUPPORT.md`, но доступная уже
поверхность выбора цвета получает ту же явную кнопку без намеренной деградации.
View, kiosk и device actions не затрагиваются.

## 9. i18n

`ColorPickerLabels` получает обязательное поле `confirm`; его per-card значение
передаётся всем существующим picker instances через уже общий
`_colorPickerLabels`.

Добавить `color_picker.confirm` в синхронные словари `src/i18n/{en,ru,de,fr}.json`:

- RU: `ОК`;
- EN: `OK`;
- DE: `OK`;
- FR: `OK`.

Fallback внутри presentation-only компонента — `OK`. Отдельный aria-only ключ
не нужен: видимый текст является доступным именем.

## 10. Модель данных, миграция и совместимость

Server config, editor drafts, storage/model version и backend schema не
меняются. Новых persisted полей, compatibility aliases и миграции нет.

Публичный consumer API сохраняет свойства `color`, `opacity`, `disabled`,
`showOpacity`, событие и его detail. Дополнение `ColorPickerLabels.confirm`
является внутренним compile-time контрактом House Plan: все production
consumers уже получают единый объект labels. Для defensive runtime fallback
отсутствующее/пустое `confirm` отображается как `OK`, поэтому стороннее ручное
создание custom element со старым объектом labels не ломается.

Downgrade возвращает прежний picker без кнопки и продолжает читать тот же
config. Данные не теряются и обратная миграция не нужна.

## 11. Затронутые файлы и модули

- `src/hp-color-opacity.ts` — label, кнопка, validation/close path и стили;
- `src/houseplan-card.ts` — per-card localized `ColorPickerLabels`;
- `src/i18n/{en,ru,de,fr}.json` — `color_picker.confirm`;
- `test/color-picker.test.mjs` и i18n/source contract tests;
- `demo/smoke_color_picker.mjs` — click/tap, invalid HEX, focus и события;
- при необходимости существующий fallback smoke, без создания второго
  component implementation;
- `demo/golden/matrix.mjs`/`harness.mjs` только если существующим color-picker
  сценам нужна подготовка для видимой кнопки; принимаемые PNG и golden index;
- `docs/TESTING.md`, `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`;
- generated `dist/**` и `custom_components/houseplan/frontend/**` по
  manifest-driven bundle contract.

User Guide и config compatibility docs не меняются: новая кнопка
самообъясняющаяся, а конфигурационный контракт отсутствует. Если в реализации
понадобится объяснять кнопку отдельно в руководстве, это считается сигналом,
что affordance не решил исходную проблему.

## 12. Критерии приёмки

- **AC1 — видимая кнопка и геометрия (unit + golden).** Каждый открытый
  `hp-color-opacity`, включая `showOpacity=false`, показывает последним control
  полноширинную primary-кнопку с высотой не менее 40 CSS px; она помещается в
  light/dark desktop/touch кадрах без clipping и перекрытия controls.
- **AC2 — live parity (unit + smoke).** Hue/SV/HEX/opacity по-прежнему немедленно
  отправляют ровно существующий `{ color, opacity }` и обновляют parent draft;
  открытие и «ОК» не добавляют event, если значение уже применено.
- **AC3 — успешное завершение (smoke).** Реальный click/tap и keyboard activation
  по «ОК» закрывают native popover и fallback, ставят `aria-expanded=false`,
  возвращают focus на trigger и не вызывают действие plan/dialog под surface.
- **AC4 — невалидный HEX (unit + smoke).** При невалидном draft «ОК» оставляет
  picker открытым, error/`aria-invalid` видимыми, focus в HEX input, последнее
  валидное parent value неизменным и не отправляет событие; после исправления
  та же кнопка закрывает picker. Повторное «ОК» без нового валидного input также
  не закрывает поверхность.
- **AC5 — прежние close paths (smoke).** Outside pointer, trigger и `Escape`
  продолжают закрывать surface и сохраняют последнее валидное live-значение;
  `Escape` не закрывает родительский dialog тем же нажатием.
- **AC6 — i18n и a11y (unit + smoke).** EN/RU/DE/FR имеют parity, production
  instances получают per-card `confirm`, fallback даёт `OK`, видимый текст
  является accessible name, Tab достигает кнопки после последнего field.
- **AC7 — touch/fallback/lifecycle (smoke + golden).** На narrow touch кнопка
  имеет достаточную цель, tap потребляется surface; Popover API и forced
  fallback дают один и тот же результат, disconnect не оставляет portal и
  pending emit.
- **AC8 — совместимость, release и бюджеты (unit + docs gate + commands).** Нет
  новых config/storage/backend полей и изменений event API; оба changelog
  содержат пользовательскую запись, целевые docs/tests актуальны, bundle
  проходит действующие initial/editor gzip budgets.

## 13. План автотестов

1. Расширить `test/color-picker.test.mjs`: обязательный `confirm` label,
   defensive `OK`, native `type="button"`, последний DOM-control,
   полноширинный/40 px CSS contract и неизменный event detail.
2. Расширить `demo/smoke_color_picker.mjs` реальными действиями:
   - live изменить hue и opacity, запомнить число событий, нажать «ОК» и
     доказать close/focus без дополнительного события;
   - открыть снова, ввести невалидный HEX, нажать «ОК», проверить open/error/
     focus/no-event, повторным «ОК» доказать отсутствие обхода, исправить и
     закрыть;
   - повторить color-only consumer;
   - доказать сохранение outside/trigger/`Escape`.
3. Forced-fallback path проверить существующим smoke affordance либо узким
   расширением color-picker smoke: portal удалён, нижележащий click не вызван.
4. Обновить существующие golden-сцены, уже покрывающие общую surface:
   `decor-color-popover-mobile-ru`, `decor-color-popover-desktop-en`,
   `general-color-popover-desktop-en`, `device-ripple-color-popover-mobile-ru`,
   `space-room-color-popover-desktop-ru`. Вместе они доказывают RU/EN,
   light/dark, desktop/touch, opacity/color-only. Не создавать дублирующую сцену
   только ради той же кнопки.
5. Защитные мутанты: удалить click handler, повторно emit на confirm, закрыть
   surface при invalid HEX, убрать stopPropagation, не передать новый label в
   один из языков и сделать кнопку auto-width — соответствующие AC обязаны
   покраснеть.

## 14. Release-артефакты

- Пользовательские записи со ссылкой на #476 в `docs/CHANGELOG.md` и
  `docs/CHANGELOG.ru.md` в product-коммите.
- `docs/TESTING.md` актуализирует общий color-picker contract.
- Пять существующих color-picker golden обновляются из канонического Linux CI,
  явно просматриваются и принимаются с `Baseline-Reviewed` по процессу.
- Документационные screenshots переснимаются/принимаются только если их
  visual fingerprint объявлен устаревшим обычным gate; отдельного нового
  пользовательского screenshot не требуется.
- Performance/security artifacts не добавляются: кнопка не входит в render
  loop, не читает сеть и не меняет данные. Действующие bundle budget и
  prerelease performance gates остаются обязательными.

## 15. Производительность и безопасность

Один статический button и один click handler добавляются только в уже открытый
lazy editor picker. Закрытая карточка, View, camera render, geometry и backend
не получают новой работы. Runtime dependency и сетевой запрос не добавляются.

Кнопка не выполняет HA action, не пишет config и не обходит parent Save/Cancel.
Потребление click/tap защищает от случайного действия под закрывающейся
поверхностью. Существующие CSP, permissions и privacy contract не меняются.

## 16. Риски

- **Случайно превратить live picker в transaction.** Снимается AC2 и прямой
  проверкой parent draft до «ОК».
- **Повторно отправить последнее значение.** Снимается счётчиком событий до и
  после confirm в AC2.
- **Закрыть surface с невалидным HEX.** Снимается единым validation result и
  AC4, без проверки только CSS-класса.
- **Разойтись между Popover API и fallback.** Снимается одним `_pickerTemplate`
  и реальными smoke обоих путей.
- **Провалить tap в план после удаления portal.** Снимается потреблением события
  и sentinel-action в AC3/AC7.
- **Обрезать нижнюю кнопку на touch/zoom.** Снимается существующим viewport
  placement, scroll flow и reviewed narrow golden.
- **Оставить один язык без кнопки.** Снимается type/i18n parity и AC6.

## 17. Откат

Feature flag не нужен: изменение локально для общей surface и не меняет данные.
Для отката удаляются button/handler, поле `confirm` и новый i18n key, а прежние
close paths и live event contract остаются рабочими. Родительские consumers,
config и backend откатывать не требуется.

Если после выпуска понадобится другая семантика подтверждения — например,
транзакционный draft с Cancel, — это отдельная продуктовая задача и миграция
interaction contract, а не скрытая правка обработчика #476.

## 18. Принятые предположения

Следующие технические решения предположительны и могут быть свободно изменены
ревьюером без нового продуктового решения владельца:

- рабочее имя нового поля — `ColorPickerLabels.confirm`, ключ —
  `color_picker.confirm`;
- confirm может переиспользовать существующий HEX commit helper, но решение о
  закрытии не выводится только из нормализованного `_hexDraft`: компонент хранит
  отдельный признак неуспешного commit без последующего валидного
  пользовательского `input`. Невалидный commit устанавливает признак, а снять
  его может только новое `input`-событие HEX-поля с валидным значением; blur,
  нормализация draft и повторный confirm его не снимают. `_closePicker(true,
  ...)` вызывается только когда текущий draft валиден и этот признак снят;
- отдельный custom event `confirm` не нужен: родители уже получили live value;
- кнопка стилизуется внутри shadow DOM `hp-color-opacity` theme tokens без
  зависимости от HA-private web components;
- тест fallback может быть частью существующего smoke, если это сохраняет
  реальное browser proof и не дублирует весь сценарий.
