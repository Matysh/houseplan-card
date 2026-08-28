# #159 — Новый набор мебели и двухуровневая библиотека

Issue: [#159](https://github.com/Matysh/houseplan-card/issues/159)

Источник набора: [архив в комментарии](https://github.com/Matysh/houseplan-card/issues/159#issuecomment-5449707137), SHA-256 `9E969016EE3B4B4E3DB776FEC53C8B387B91368B118EB5E39911483DEF1B0953`.

## Сценарий

Администратор дома в desktop-редакторе подложки открывает библиотеку мебели,
сначала выбирает понятную категорию по фронтальной иконке, затем — конкретный
вариант по виду сверху, задаёт его реальный размер и ставит на план. Домочадцы
видят обновлённый линейный символ в обычном View и киоске без дополнительных
действий и без изменения поведения плана.

## Что человек увидит до и после

До изменения библиотека показывает 30 условных видов сверху одним длинным
списком. После изменения она показывает компактный каталог категорий с новыми
фронтальными иконками и второй экран с вариантами вида сверху; на план можно
разместить 56 символов, а уже размещённая мебель с прежними ID автоматически
получает новый рисунок там, где дизайнер передал замену.

## Проблема

Текущая библиотека собрана из простых программных примитивов. В ней мало
вариантов, а часть символов недостаточно похожа на реальный предмет. Плоский
список плохо масштабируется: добавление 26 вариантов сделает его длиннее и не
объяснит пользователю связь «Диваны → двухместный / трёхместный / угловой».

Полученный набор решает визуальную часть, но не может быть вставлен как
произвольный SVG из config: House Plan намеренно не принимает пользовательский
markup. Нужен детерминированный compile-time каталог безопасной path-геометрии,
который сохраняет текущий config-контракт `decor[].symbol`.

## Проверенный вход и права

- Архив содержит 33 SVG категорий меню и 44 SVG вида сверху: 18 `replace`,
  26 `add`.
- Технический валидатор архива проходит; все 77 SVG состоят только из
  автономных `path` с `fill="none"`, `stroke="currentColor"`, без внешних ссылок,
  transforms, CSS, растра, текста, script/filter/mask/clipPath.
- Владелец репозитория сообщил в рабочей сессии, что все иконки нарисованы им
  собственноручно. Однако сам архив содержит `author/license: TBD`, а рабочая
  сессия не является публичным проверяемым источником лицензии. До следующего
  ревью владелец должен оставить в issue явное подтверждение авторства и
  разрешение использовать, изменять и распространять набор под MIT License
  репозитория без отдельной атрибуции в UI. Только после этого в vendored-копию
  попадают `author: Matysh`, `license: MIT`; исходный `TBD` не переносится как
  релизная метаинформация.
- Превью из архива — материал визуального ревью, не runtime-ресурс и не источник
  геометрии.

## Scope

1. Вендоринг нормализованного исходного набора в
   `assets/furniture/houseplan-0.3.0/`: manifest, README/provenance, MIT license
   и 77 SVG. PNG-превью остаются в issue и не дублируются в git.
2. Детерминированный генератор, который валидирует разрешённый SVG-поднабор и
   создаёт раздельные TS-каталоги:
   - plan-art, нужный View и редактору;
   - menu-art, импортируемый только ленивым editor graph.
3. Итоговый каталог из 56 плановых символов: все 30 прежних ID плюс 26 новых.
4. Замена рисунка и default-размера для 18 прежних ID из manifest без миграции
   сохранённой мебели.
5. Двухуровневая палитра «категории → варианты» с фронтальными и top-view SVG.
6. Полные EN/RU/DE названия категорий и вариантов.
7. Обновление свойств мебели, тестов, golden/smoke, документации и changelog.

## Не входит

- загрузка пользовательских SVG/паков и выбор пакета;
- удаление либо переименование любого существующего symbol ID;
- 3D/изометрическая мебель, заливки, цвета, тени и материалы;
- новые жесты, wall magnet, resize/rotate, z-order или collision detection;
- новые плановые предметы для четырёх menu-only исходников `computer`, `oven`,
  `hood`, `exercise`;
- изменение backend-схемы decor и миграция config;
- обещание удобного редактирования на touch: редактор остаётся desktop-first.

## Каталог и совместимость

### Замены существующих ID

`coffee_table`, `table_dining`, `table_round`, `desk`, `chair`, `armchair`,
`sofa`, `bed_single`, `bed_double`, `nightstand`, `bookshelf`, `wardrobe`,
`stove`, `tv`, `toilet`, `bathtub`, `bidet`, `kitchen_sink`.

Для нового размещения применяются размеры из manifest. Для уже сохранённой
мебели `x/y/w/h/angle` остаются байт-в-байт прежними; меняется только рисунок,
разрешаемый по тому же `symbol`.

### Новые ID

`coffee_table_round`, `coffee_table_oval`, `coffee_table_rounded`,
`table_dining_oval`, `table_dining_rounded`, `desk_corner`, `chair_bar`,
`armchair_office`, `sofa_three_seat`, `sofa_corner_right`, `cabinet_tv`,
`cabinet_shoe`, `cabinet_sink`, `wall_unit`, `kitchen_floor`,
`kitchen_floor_corner`, `kitchen_wall`, `kitchen_wall_corner`, `shelf_floor`,
`shelf_wall`, `cooktop_two`, `tv_wall`, `toilet_built_in`, `bathtub_corner`,
`bidet_built_in`, `kitchen_sink_double`.

### Неперерисованные прежние ID

`fridge`, `dishwasher`, `washer`, `dryer`, `ac`, `water_heater`, `shower`,
`sink`, `stairs`, `fireplace`, `plant`, `rug` сохраняют текущую геометрию,
размеры и поведение. Они получают фронтальные category icons из нового набора.

### Категории

Каждый плановый символ имеет ровно одну категорию. Для неперерисованных ID:

| Symbol | Category |
|---|---|
| `ac` | `air_conditioner` |
| `water_heater` | `boiler` |
| `fridge` | `fridge` |
| `dishwasher` | `dishwasher` |
| `washer` | `washer` |
| `dryer` | `dryer` |
| `shower` | `shower` |
| `sink` | `sink` |
| `stairs` | `stairs` |
| `fireplace` | `fireplace` |
| `plant` | `plant` |
| `rug` | `rug` |

Остальные связи берутся из `symbols[].menu_icon` manifest. Категория без
единого top-view symbol не отображается. Поэтому `computer`, `oven`, `hood`,
`exercise` остаются в vendored source для будущего дополнения, но не создают
пустых или неработающих кнопок.

## Контракт UX

### Первый уровень: категории

- Открытие «Мебели» показывает четыре прежние группы в прежнем порядке:
  мебель, техника, сантехника, прочее.
- Внутри группы показывается одна плитка на непустую категорию: новая
  фронтальная иконка и локализованное имя.
- Плитка не начинает размещение и не меняет config. Она открывает второй
  уровень внутри той же context tray/palette.
- Закрытие палитры сбрасывает навигацию на первый уровень и возвращает инструмент
  в Select по существующему контракту.

### Второй уровень: варианты

- Заголовок показывает кнопку «Назад», фронтальную иконку и имя категории.
- Все варианты категории показываются плитками с реальным видом сверху и
  локализованным названием. Даже категория с одним вариантом проходит через
  этот экран: одинаковый результат клика важнее экономии одного клика.
- Клик по варианту вооружает прежний stamp-flow, подсвечивает вариант и
  показывает прежние поля ширины/глубины и подсказку размещения.
- Выбор другого варианта сбрасывает width/depth на defaults нового варианта,
  как нынешний выбор другого symbol. Ручные размеры не переносятся между
  разными вариантами.
- «Назад» возвращает к категориям и снимает вооружённый symbol, чтобы нажатие
  по плану после смены экрана не поставило скрыто выбранный предмет.
- После успешной одиночной установки инструмент возвращается в Select, как
  сейчас. Многократный stamp не добавляется.

### Свойства уже размещённого предмета

- Поле «Символ» остаётся одним select без дополнительного шага, но варианты
  группируются сначала по четырём product-группам, затем по category label.
- Текущий ID всегда выбран, в том числе для старого или нового символа.
- Смена symbol сохраняет текущую коробку, положение и поворот по действующему
  контракту; default-размер используется только при новом размещении.

### Доступность и touch

- Категории/варианты — настоящие `button` с `title`/accessible name; «Назад»
  доступен с клавиатуры и имеет локализованную подпись.
- Палитра сохраняет собственный вертикальный/горизонтальный scroll и не
  увеличивает рабочую область редактора.
- Touch editor: best effort. Плитки не могут быть меньше действующих touch
  targets, а нажатие внутри tray не проходит на план. View/kiosk рендерят
  мебель полностью и являются release-blocking.

## Рендер и безопасность

1. Runtime не читает SVG-файлы и не принимает SVG/path из config. Генератор
   извлекает только локальные `path[d]` из проверенного vendored набора.
2. Разрешённый source-контракт: корректный XML; точный viewBox; только `svg/g/path`;
   `fill=none`, `stroke=currentColor`; без URL, style/class, event attributes,
   transform, script, text, foreignObject, image, animation и SVG effects.
   Нарушение прерывает генерацию/тест, а не попадает в bundle.
3. Все path одного символа объединяются в одну неизменяемую `d`-строку. Один
   размещённый предмет остаётся одним интерактивным `<path>`, включая erase-hit.
4. Source viewBox хранится рядом с `d`. Рендер применяет translate/rotate и
   non-uniform scale из source box в сохранённые `w/h`; `vector-effect` не даёт
   scale менять пользовательскую физическую толщину контура.
5. Plan path получает текущие `color`, `opacity`, `width_cm`, round cap/join и
   все существующие `data-hp/data-id/data-kind/data-symbol` hooks.
6. Menu/variant preview рендерит тот же immutable path в своём viewBox с
   `currentColor`, прозрачным фоном и фиксированным non-scaling stroke. Variant
   preview сохраняет реальные пропорции в 40×40, как текущая палитра.
7. Неизвестный `decor[].symbol` по-прежнему валиден для backend, не падает и
   ничего не рисует в старой карточке.

## Модель данных и миграция

Persisted schema не меняется:

```ts
{ kind: 'furniture', symbol: string, x, y, w, h, angle?, ...style }
```

- Новых config-полей, schema/model version и migration нет.
- `operation`, category ID, source viewBox и SVG path — compile-time metadata,
  не пользовательские данные.
- Сохранение старого плана не переписывает symbol или геометрию мебели.
- Backend продолжает валидировать только безопасный формат ID, а не закрытый
  список символов — forward compatibility сохраняется.

## Генерация и source of truth

- `assets/furniture/houseplan-0.3.0/manifest.json` — список дизайнерских
  замен/добавлений и menu mapping.
- README внутри каталога фиксирует SHA-256 исходного архива, URL issue/Figma,
  авторство и отличия нормализованной копии (`author/license/pack_id`).
- `scripts/generate-furniture-assets.mjs` валидирует пакет и атомарно генерирует
  два стабильных файла без timestamp/абсолютных путей:
  `src/furniture-plan-art.generated.ts` и
  `src/furniture-menu-art.generated.ts`.
- `--check` пересобирает в памяти и падает при stale generated output. Он входит
  в unit/CI-проверку задачи.
- Plan-art импортируется `src/furniture.ts`, потому что нужен обычному View.
  Menu-art импортируется только `src/houseplan-editor-runtime.ts`, чтобы 33
  фронтальные иконки не попали в initial View graph.

## i18n

Меняются `src/i18n/en.json`, `ru.json`, `de.json`:

- `furn.category_<id>` для каждой отображаемой категории;
- `furn.sym_<id>` для всех 26 новых ID;
- существующие 18 `furn.sym_*` получают уточнённые названия manifest;
- `furn.back_to_categories` и accessible label для возврата, если общий ключ
  Back не подходит грамматически.

RU/EN берутся из manifest и редакционно нормализуются под текущий UI. DE
переводится в том же изменении; fallback на английский для нового каталога не
допускается.

## Производительность и bundle

- На один предмет остаётся один plan `<path>`; DOM-сложность View не растёт от
  числа исходных subpaths.
- Категории/варианты создаются только при открытом editor palette.
- `npm run bundle:budget` обязан пройти общий initial View ceiling.
- В handoff записываются gzip-дельты initial View и lazy editor относительно
  `origin/dev`. Front-menu art в initial View graph — блокирующая ошибка.
- Дополнительный initial View gzip для 44 plan SVG — не более 18 KiB. Это
  блокирующий критерий задачи: при превышении реализация упрощает представление
  и повторяет замер. Поднять общий budget или принять превышение в #159 нельзя;
  иное решение требует отдельного изменения ТЗ и нового ревью до реализации.

## Критерии приёмки

### AC1 — целостность и provenance пакета (`unit`, ревью кода)

В issue есть публичное подтверждение владельца об авторстве всех 77 SVG и
разрешении использовать, изменять и распространять их под MIT License
репозитория без отдельной UI-атрибуции. Vendored source соответствует
зафиксированному архиву по всем 77 SVG; нормализованы только подтверждённые
метаданные author/license/pack ID и документация. Генератор отклоняет
запрещённый SVG и `--check` подтверждает актуальность двух generated каталогов.

### AC2 — полная совместимость ID (`unit`)

Итоговый каталог содержит ровно 56 уникальных ID: прежние 30 без удаления или
переименования и новые 26. 18 replacement-ID используют новый art/defaults,
12 retained-ID — прежний art/defaults. Unknown ID остаётся безопасным no-op.

### AC3 — категории и варианты (`unit`, `smoke`)

В первом уровне есть только непустые категории с фронтальными иконками; четыре
menu-only категории скрыты. Переход во второй уровень, Back, выбор каждого
варианта, selected state, reset defaults и однократный stamp выполняют UX-контракт.

### AC4 — плановый рендер (`unit`, `smoke`, `golden`)

Новый и replacement symbol одинаково рисуются в Background editor, View,
light/dark theme и при непропорциональном resize; stroke остаётся одинаковой
толщины, цвет/opacity/rotation/hooks/erase-hit не регрессируют. Сохранённый
replacement-предмет сохраняет свою коробку и получает новый рисунок.

### AC5 — свойства и round-trip (`unit`, `smoke`)

Properties select показывает/выбирает все 56 ID; смена symbol сохраняет
геометрию, save/reload не меняет ID, а backend принимает новые IDs без обновления
allow-list.

### AC6 — локализации (`unit`, smoke)

Все видимые category/symbol labels существуют и непусты в EN/RU/DE; ни одна
плитка не показывает ключ или английский fallback в RU/DE.

### AC7 — editor/touch safety (`smoke`, ревью кода)

Pointer внутри обоих уровней палитры не ставит мебель на план и не начинает
pan; закрытие/Back не оставляют скрытый armed stamp. View и kiosk не получают
новых handlers и рендерят те же symbol paths.

### AC8 — bundle и DOM budget (`build`, unit)

Budget проходит; initial View gzip delta ≤18 KiB, menu-art отсутствует в initial
graph; один мебельный объект создаёт один основной plan path и один erase-hit
только в активном erase-mode.

### AC9 — документация и релиз (`review`)

Обновлены `docs/FURNITURE.md`, релевантный user guide/`docs/STATUS.md`,
`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`; provenance и desktop-first правило
зафиксированы. Golden candidates приняты только из Linux CI по штатному процессу.

## План автотестов

1. Расширить `test/furniture.test.mjs`: множества ID, category mapping,
   replacements/retained, source viewBox/path, finite transform, unknown ID,
   default sizes и one-path contract.
2. Новый тест generator/integrity: manifest↔SVG↔generated parity, запрет каждого
   опасного SVG-класса, orphan menu policy, deterministic output.
3. Расширить `demo/smoke_furniture.mjs`: category → variants → select → size →
   place, Back/close safety, properties change, reload, старый/new symbol.
4. Golden matrix: category screen light, category screen dark, variant screen с
   несколькими формами и plan scene с replacement + retained + new furniture.
5. i18n parity tests для всех новых ключей EN/RU/DE.
6. Build manifest comparison с `origin/dev` и `npm run bundle:budget`.

## Release-артефакты

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`: значимое пользовательское
  изменение со ссылкой на #159;
- `docs/FURNITURE.md`: каталог, двухуровневый выбор, размеры/совместимость,
  provenance;
- user guide/STATUS — только разделы, где перечисляется библиотека мебели;
- обновлённые Linux golden baselines и запись визуального review;
- новые docs screenshots — только если изменяемый сценарий входит в их matrix;
- bundle-size delta initial/lazy в handoff и отчёте code review;
- security artifact отдельно не нужен: безопасность доказывает allow-list
  generator и отсутствие runtime SVG input.

## Риски и митигации

| Риск | Митигация |
|---|---|
| Новый рисунок неожиданно меняет старый план | replacement только по явно переданным ID; геометрия config не меняется; golden before/after |
| Menu art раздует View bundle | отдельный lazy import и graph assertion |
| SVG path меняет толщину при resize | `vector-effect: non-scaling-stroke`, экстремальные aspect-ratio tests |
| Пустая category создаёт dead end | category выводится только при ≥1 plan symbol; invariant test |
| Новый symbol ломает backend | backend сохраняет regex-only forward-compatible validation; round-trip smoke |
| Длинные переводы ломают tray | RU/EN/DE golden и внутренний scroll без изменения stage |
| Небезопасный SVG попадёт в runtime | strict compile-time validator; в config нет markup/path |

## Откат

Кодовый откат возвращает прежний каталог и палитру. Persisted schema не
изменялась: старые 30 ID снова рисуются прежними символами. Новые 26 ID в старой
версии остаются валидными данными backend и безопасно не рисуются; после
возврата новой версии появляются снова с сохранённой геометрией. Удалять или
переписывать такие records при откате запрещено.

## Открытый продуктово-правовой вопрос

До повторного перехода в `S4-spec-review` владелец должен публично подтвердить в
issue следующую суть: он является автором всех 77 SVG из указанного архива и
разрешает House Plan использовать, изменять и распространять их на условиях
MIT License репозитория без обязательной отдельной атрибуции в интерфейсе.
Issue остаётся `blocked` поверх `S3-spec`, пока подтверждения нет.

## Принято предположительно, поменять свободно на ревью

- Generated TS, а не runtime SVG imports, выбран ради CSP/HACS и контроля bundle.
- Четыре menu-only SVG вендорятся для полноты авторского исходника, но скрыты до
  появления top-view counterparts.
- Все категории, включая одиночные, используют одинаковый второй уровень;
  это осознанно добавляет один клик ради предсказуемого интерфейса.
- Исходные PNG-превью не дублируются в git: issue остаётся immutable source,
  а product visuals защищает штатная golden matrix.
