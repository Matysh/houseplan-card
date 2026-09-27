# #372 — Компактное верхнее кадрирование `houseplan-space-card` без заголовка

Issue: [#372](https://github.com/Matysh/houseplan-card/issues/372)

## Сценарий

Персона **администратор дома** размещает `custom:houseplan-space-card` на
dashboard, где название этажа уже задано секцией или соседней карточкой. Он
явно указывает `title: ""`, чтобы получить компактную read-only схему без
дублирующего заголовка.

Карточка остаётся обычной View-поверхностью на desktop и touch. Редакторы и
полная `custom:houseplan-card` в этом сценарии не участвуют.

## Что человек увидит до и после

Сейчас текст и настоящий header уже исчезают, но над верхней границей плана
остаётся тёмная часть симметричного 5%-го поля кадрирования. После изменения
явно пустой `title` уберёт только это верхнее пустое поле: план начнётся от
верхнего края сцены, а боковые и нижнее поля сохранятся.

## Проблема

`src/space-card.ts` уже не создаёт `.hp-static-title`, когда вычисленный title
пуст: браузерный harness на актуальном `dev` даёт `topGap = 0 px` между
`ha-card` и `.hp-static-stage`. Поэтому отмеченная в issue полоса не является
высотой header.

Полосу создаёт `spaceFrame(..., pad = 0.05)` в static render: content frame
симметрично расширяется на 5% длинной стороны и становится SVG `viewBox`.
Тёмный фон сцены виден в верхней части этого frame раньше, чем начинается
бумага/геометрия плана.

Владелец подтвердил решение: явное `title: ""` становится компактным режимом
верхнего кадрирования. Убирается только верхняя доля штатного padding;
остальные края, footer и все другие варианты `title` сохраняют прежнее
поведение.

## Скоуп

- только `custom:houseplan-space-card`;
- только конфигурация с **явно заданным** `title: ""`;
- удаление верхней части 5%-го content-frame padding;
- сохранение левого, правого и нижнего padding в прежнем размере;
- одинаковое поведение для изображения-плана и нарисованного плана;
- одинаковое поведение в светлой/тёмной теме и на desktop/touch;
- regression-тесты для DOM header и численного SVG frame;
- RU/EN документация и changelog.

## Не-скоуп

- изменение кадрирования полной `custom:houseplan-card`, View, kiosk или
  любого редактора;
- удаление бокового или нижнего поля static card;
- новая настройка padding, compact mode или отдельный UI-контрол;
- изменение `spaceFrame` для других потребителей;
- изменение алгоритма content/outlier voting, fit, auto-placement, масштаба
  иконок или room labels;
- изменение footer, `show_button`, `button_label`, `button_target` и deep link;
- изменение цвета сцены, бумаги, стен, backdrop, Glow, солнца или устройств;
- исправление произвольных пробелов в строке title: значение, отличное от
  точной пустой строки, сохраняет текущую семантику;
- миграция сохранённых Lovelace-конфигураций.

## Контракт поведения

1. `title` отсутствует: карточка, как прежде, подставляет название пространства,
   рисует header и использует симметричный 5%-й content-frame padding.
2. `title` содержит непустую строку: карточка, как прежде, рисует эту строку и
   использует симметричный 5%-й padding.
3. `title === ""`: `.hp-static-title` отсутствует; `.hp-static-stage` начинается
   на верхней границе `ha-card`; верхняя координата SVG `viewBox` совпадает с
   верхней координатой выбранного **непаддированного** content frame.
4. В режиме пункта 3 левая, правая и нижняя границы SVG `viewBox` совпадают с
   прежним симметрично padded frame. Меняются только `viewBox.y` и вытекающая
   из него `viewBox.height`; нижняя координата `y + height` неизменна.
5. Величина сохраняемого padding остаётся текущей: 5% длинной стороны
   непаддированного frame. Новая магическая величина не вводится.
6. Выбор main-mass/outlier, fallback для пустого пространства и защита
   вырожденных осей остаются прежними. Если content frame отсутствует и
   используется stored `view_box`, compact mode не выдумывает новый crop.
7. `show_button` не влияет на frame. Footer сохраняет текущую высоту и
   действие; compact mode уменьшает только высоту сцены на удалённую верхнюю
   долю padding.
8. Background/day-cycle заполняют получившуюся сцену как раньше; никакой слой
   не получает отдельного сдвига. SVG, devlayer и backdrop используют один и
   тот же compact `viewBox`.
9. Изменение не скрывает ошибку header CSS: тест отдельно доказывает отсутствие
   `.hp-static-title` и нулевой DOM gap, а отдельно — изменение координат
   content frame.

## UX и доступность

- Новых контролов, фокусов, hover-состояний и действий нет.
- Static schematic остаётся inert; единственная интерактивная поверхность —
  существующая footer-кнопка.
- Порядок DOM не меняется: optional title → body/stage → optional footer.
- Compact mode не добавляет ARIA-узлы и не меняет доступное имя footer-кнопки.
- Удалённое поле находится внутри сцены, поэтому скругление и фон `ha-card`
  остаются нативными для темы Home Assistant.

## Модель данных, миграция и совместимость

Публичный интерфейс не расширяется:

```ts
interface SpaceCardConfig {
  title?: string;
}
```

- schema/config version не меняется;
- backend и House Plan config store не меняются: `title` принадлежит Lovelace
  config экземпляра карточки;
- старые карточки без `title` визуально не меняются;
- старые карточки с непустым `title` визуально не меняются;
- только уже валидная явная пустая строка получает уточнённую семантику;
- YAML и GUI round-trip не переписываются.

## i18n

Новых и изменённых UI-строк нет. `src/i18n/{en,ru,de}.json` не меняются.

## Производительность и bundle

- frame вычисляется один раз на render, как сейчас;
- допустим один pure helper или необязательный параметр существующего frame
  resolver; DOM measurement и второй проход по SVG запрещены;
- асимптотика остаётся O(число объектов пространства);
- новых runtime dependencies и сетевых запросов нет;
- bundle budget не повышается.

## Touch и темы

- изменение только визуальное и одинаково для mouse/touch;
- pointer-events static stage остаётся `none`;
- footer tap target и навигация не меняются;
- светлая и тёмная темы используют тот же frame; меняются только действующие
  theme colors фона;
- `prefers-reduced-motion`, day-cycle transitions и continuity overlay не
  получают новой анимации или ветки поведения.

## Затронутые файлы и модули

- `src/space-card.ts` — отличить точный explicit-empty title и передать compact
  top-frame contract в static renderer;
- `src/space-render.ts` — применить per-edge frame только к static card;
- при необходимости узкий pure helper в `src/space-geometry.ts`, без изменения
  default-пути остальных потребителей;
- `test/space-geometry.test.mjs` либо новый узкий unit-тест — арифметика
  per-edge padding, degenerate/fallback и неизменность трёх краёв;
- `demo/smoke_space_card.mjs` — omitted/non-empty/explicit-empty матрица,
  численный DOM/SVG contract и реальный compact render;
- `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md` — точная семантика `title: ""`;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md` — пользовательское изменение.

## Критерии приёмки

- **AC1 — явная пустая строка компактна:** при `title: ""` title-узел отсутствует,
  DOM gap между `ha-card` и stage равен 0, а верхняя координата SVG frame
  совпадает с непаддированной верхней границей content. **Доказательство:**
  `demo/smoke_space_card.mjs` и unit-тест frame math.
- **AC2 — меняется только верх frame:** для одной fixture explicit-empty и
  контрольный обычный режим имеют одинаковые left/right/bottom границы;
  compact `y` сдвинут ровно на прежний верхний padding, `height` уменьшен на
  ту же величину. **Доказательство:** unit + browser smoke по численным
  `viewBox` и `getBoundingClientRect()`.
- **AC3 — остальные title-режимы совместимы:** omitted title показывает
  название пространства, непустой title показывает заданный текст; оба режима
  сохраняют прежний симметричный frame и высоту stage. **Доказательство:**
  browser smoke с тремя экземплярами карточки.
- **AC4 — содержимое и footer не расходятся:** SVG, backdrop, devlayer,
  устройства, room labels и continuity overlay остаются в одном compact frame;
  `show_button: true/false` не меняет frame, а footer deep link работает как
  прежде. **Доказательство:** browser smoke и ревью кода.
- **AC5 — edge cases безопасны:** пустое пространство, stored fallback frame,
  collinear/degenerate content и outlier fixture не создают нулевой/NaN/
  Infinity `viewBox` и не меняют voting. **Доказательство:** unit-тесты
  `space-geometry` и существующие canvas-frame tests.
- **AC6 — поддерживаемые поверхности:** compact render не имеет horizontal
  overflow на desktop и touch width, работает в light/dark и не возвращает
  интерактивность schematic. **Доказательство:** browser smoke на двух widths/
  themes; полный Linux smoke/golden перед ревью/бетой.
- **AC7 — документация и релиз:** RU/EN guide описывают различие omitted,
  non-empty и explicit-empty title; оба changelog содержат ссылку на #372.
  **Доказательство:** docs/process gates и ревью кода.
- **AC8 — сборка и бюджет:** typecheck, unit, build, bundle sync/budget и
  `check-docs` зелёные; новых зависимостей нет. **Доказательство:** CI Validate
  на точном SHA ветки.

## План автотестов

1. Pure unit: для прямоугольного content frame вычислить прежний uniform frame
   и compact-top frame; сравнить left/right/bottom и точный удалённый top pad.
2. Pure unit: повторить для portrait/landscape, degenerate axis, fallback без
   content и outlier-набора; все числа конечны, voting одинаков.
3. Расширить `demo/smoke_space_card.mjs` тремя карточками на одной fixture:
   omitted, `title: "Named"`, `title: ""`.
4. В браузере проверить наличие title node, DOM top gap, `viewBox`, stage
   aspect/height и неизменность footer deep link.
5. Повторить explicit-empty при `show_button: false`, на 390 px dark и 900 px
   light; stage остаётся inert и не переполняет карточку по горизонтали.
6. Добавить semantic pixel witness: верхняя строка плана в compact fixture
   достигает верхней границы viewport, тогда как control сохраняет штатный
   padding. Assertion должен падать при возврате симметричного frame.
7. В цикле реализации: `npm run typecheck`, `npm test`, `npm run build`, затем
   целевой `node demo/smoke_space_card.mjs`. Перед передачей в код-ревью —
   Linux Validate, полный golden verify и полный browser smoke по процессу.

## Риски

- **Случайно меняется полная карточка.** Снижается параметром default-off только
  у static renderer и AC3/ревью диффа.
- **Удаляется padding со всех сторон.** Снижается точной проверкой четырёх
  границ AC2.
- **Frame и devlayer получают разные координаты.** Снижается единым `vb` и AC4.
- **Вырожденный frame становится нулевым.** Снижается сохранением текущего
  degenerate/fallback resolver и AC5.
- **Тест проверяет только отсутствие title, которое уже работает.** Снижается
  отдельным численным и pixel assertion именно верхнего content padding.
- **Docs screenshot source fingerprint устаревает после `src/**`.** Снижается
  обязательным canonical Docs screenshots workflow и приёмкой полного artifact.

## Откат

Убрать передачу compact-top режима и новые frame assertions, вернув static
renderer к симметричному `spaceFrame(..., 0.05)`. Данные и Lovelace config не
меняются, поэтому обратная миграция и очистка не нужны. Откат возвращает только
известную верхнюю тёмную полосу у `title: ""`.

## Release-артефакты

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`: компактный `title: ""` со
  ссылкой на #372;
- `docs/USER-GUIDE.md` и `docs/USER-GUIDE.ru.md`: таблица/пример трёх режимов
  title;
- целевой browser artifact из `demo/smoke_space_card.mjs`: control и
  explicit-empty на light/dark и narrow/wide;
- полный `npm run golden:verify` доказывает отсутствие побочных визуальных
  изменений существующей матрицы; новый baseline не обязателен, если targeted
  semantic pixel witness однозначно доказывает AC1/AC2;
- поскольку меняется `src/**`, запустить canonical workflow **Docs
  screenshots**, принять только полный Linux artifact командой
  `npm run docs:accept -- --reviewed --from=<artifact>` и закоммитить свежий
  `docs/images/screenshots.json`; ожидаемо все канонические PNG остаются
  пиксельно неизменными, так как static space card в них не снята;
- backend, migration, security и отдельный performance artifact не требуются;
  общий bundle budget и CI Validate обязательны.

## Принято предположительно, поменять свободно

- имя pure helper и точное место per-edge арифметики;
- exact-empty определяется сравнением `config.title === ""`; whitespace-only
  сохраняет прежнее поведение и не нормализуется;
- конкретная synthetic fixture и допустимый raster tolerance pixel witness;
- reuse существующего `spaceFrame` через новый optional argument либо отдельный
  узкий helper допустимы, если default path побайтово/численно не меняется;
- новый golden baseline добавляется только если targeted smoke не даёт
  ревьюеру однозначного визуального доказательства.
