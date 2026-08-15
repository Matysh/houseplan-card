# #157 — тип проёма «Открытый проём»

- Issue: [#157](https://github.com/Matysh/houseplan-card/issues/157)
- Приоритет: P2
- Ветка: `issue/157-open-passage`
- Статус документа: полное ТЗ подготовлено; issue остаётся в `S3-spec`, review не запущено по прямому указанию владельца
- Основание: issue владельца от 2026-08-14 и аналитика от 2026-08-15

## 1. Пользовательская проблема и результат

На реальном плане часто есть арка или обычный открытый дверной проём: стена
сохраняется по сторонам, но полотна двери и связанных с ним устройств нет.
Сейчас такой объект приходится изображать дверью либо виртуально открытым
участком стены. Дверь добавляет ложную створку и предлагает датчик/замок, а
виртуальный участок означает отсутствие кладки и отмечается пунктиром в
редакторе.

После #157 пользователь получает четвёртый тип обычного проёма —
`passage` / «Открытый проём». Он:

- вырезает реальный участок кладки;
- не рисует створку, дугу, пунктир или самостоятельную рамку;
- продолжает пол через существующую геометрию opening tunnel;
- всегда пропускает свет между двумя распознанными комнатами;
- не имеет датчика, замка и параметров створки;
- доступен в существующем потоке размещения и редактирования проёмов.

## 2. Подтверждённая техническая база

На момент подготовки ТЗ:

- `OpeningCfg.type` и backend schema знают только `door`, `window`, `gate`;
- Full card уже вырезает из wall body все сохранённые opening geometry и рисует
  room-coloured tunnel fill;
- `renderOpeningVisibleGeometry()` имеет fallback-ветку двери, поэтому простого
  расширения union недостаточно: `passage` ошибочно получил бы дверную створку;
- Plan сохраняет невидимый hitbox и hover outline отдельно от видимого символа;
  этот механизм можно переиспользовать для выбора `passage`;
- свет уже считает `door`/`gate` внутренним проходом только при наличии пола с
  обеих сторон и оставляет внешний проём непрозрачным;
- скрытая изометрия вырезает opening geometry из стены отдельно от построения
  полотен, но fallback в `buildIsoOpeningBasis()` также превращает неизвестный
  тип в дверь;
- Static card сейчас не рисует opening symbols и не подаёт opening cuts в свою
  wall geometry;
- `CONFIG_SCHEMA` сохраняет неизвестные sibling-поля opening благодаря
  `extra=vol.ALLOW_EXTRA`, а marker validators уже задают принятый образец
  change-aware проверки «старое битое можно прочитать и пронести без изменения,
  новое битое записать нельзя»;
- full-card и static-card snapshots сейчас подписываются на `contact`/`lock`
  каждого проёма без проверки типа.

## 3. Нормативные продуктовые решения

1. Сохраняемый literal нового типа — только `passage`.
2. Пользовательское название:
   - RU: `Открытый проём`;
   - EN: `Open passage`.
3. Новый проём размещается тем же инструментом, на тех же физических стенах и
   с теми же правилами snap/центрирования/измерений, что дверь.
4. Default ширины нового проёма — **90 см**, как у двери.
5. В покое `passage` не имеет собственного архитектурного символа. Видим только
   физический разрыв кладки и пол внутри него.
6. В Plan допускается временный editor chrome: hover/selection outline, hitbox,
   центральная точка preview и размерные подсказки. Это не часть итогового
   условного обозначения и не показывается в View/Static.
7. `contact`, `lock`, `invert`, `flip_h`, `flip_v` для `passage` неприменимы.
8. При переходе существующего проёма в `passage` сохранение удаляет эти пять
   известных полей. Если были непустые `contact` или `lock`, до сохранения
   показывается явное предупреждение.
9. Обратный переход из сохранённого `passage` не восстанавливает удалённые
   привязки или флаги.
10. Для света `passage` прозрачен только когда проба по обе стороны стены
    попадает на пол комнаты. Внешний либо неопределённый край остаётся
    fail-dark.
11. `passage` отличается от open span наличием кладки по сторонам и физических
    откосов. Open span по-прежнему означает отсутствие кладки на всём участке и
    показывается пунктиром только в Plan.
12. Публичность скрытого изометрического режима не меняется.

## 4. Scope

### 4.1 Модель и backend

- расширить TypeScript union и backend enum литералом `passage`;
- добавить change-aware semantic validator неприменимых полей;
- подключить его ко всем путям записи и импорта;
- сохранить lossless round-trip незатронутых legacy/future данных.

### 4.2 Plan editor

- добавить `passage` в submenu инструмента проёмов;
- добавить четвёртый radio-вариант в диалог;
- применить default 90 см;
- скрывать binding/flip/invert controls;
- показывать предупреждение о снятии существующих привязок;
- корректно создавать, выбирать, перетаскивать, менять тип и удалять объект;
- сохранять обычный geometry history/undo contract.

### 4.3 Рендер и свет

- Full 2D Plan/View;
- Static card;
- скрытая изометрия;
- общий wall cut и opening tunnel fill;
- Glow/light barrier geometry;
- исключение stale binding-полей `passage` из runtime подписок и UI.

### 4.4 Совместимость и документация

- full/space export-import;
- downgrade note;
- RU/EN i18n;
- пользовательское руководство, LIGHT, ISOMETRIC и CONFIG-COMPATIBILITY;
- unit/backend tests, smoke и golden evidence.

## 5. Non-scope

- моделирование криволинейной арки, верхней перемычки или высоты проёма;
- выбор формы проёма, материала откосов или декоративной обналички;
- датчик присутствия либо иной entity binding для `passage`;
- изменение прозрачности по состоянию сущности;
- публичное включение изометрии;
- общая parity-задача по отображению `door`/`window`/`gate` в Static card;
- автоматическое преобразование существующих дверей или open spans;
- изменение формата open spans;
- изменение существующей семантики дверей, окон и ворот.

В этой задаче «арка» — пользовательское название открытого проёма. Геометрически
это прямоугольный полноразмерный разрыв стены в текущей 2.5D-модели.

## 6. Контракт данных

### 6.1 TypeScript

```ts
export interface OpeningCfg {
  id: string;
  type: 'door' | 'window' | 'gate' | 'passage';
  x: number;
  y: number;
  angle: number;
  length: number;
  contact?: string | null;
  lock?: string | null;
  invert?: boolean;
  flip_h?: boolean;
  flip_v?: boolean;
}
```

Общие optional-поля остаются в интерфейсе ради совместимости чтения. Для
канонической записи `type: 'passage'` допустимы только `id`, `type`, `x`, `y`,
`angle`, `length` и неизвестные текущей версии extension-поля.

Пример канонической записи:

```json
{
  "id": "o-passage-hall",
  "type": "passage",
  "x": 0.417,
  "y": 0.286,
  "angle": 90,
  "length": 0.09
}
```

### 6.2 Defaults и ограничения

- `lengthCm = 90` при новом размещении;
- существующие ограничения диалога `20..600 см`, step 5 см сохраняются;
- `x`, `y`, `angle`, `length`, id generation и нормализация не меняются;
- версия модели и migration step не добавляются;
- существующие три литерала и их сериализация не меняются.

### 6.3 Канонизация из UI

При сохранении `passage` frontend:

1. записывает актуальные id/type/geometry;
2. удаляет `contact`, `lock`, `invert`, `flip_h`, `flip_v`, а не записывает
   `null`/`false`;
3. при редактировании существующего opening сохраняет неизвестные sibling-поля;
4. не меняет другие openings и их порядок.

Явное редактирование `passage` может канонизировать перечисленные известные
неприменимые поля. Несвязанное сохранение не должно переписывать объект.

## 7. Backend validation и broken-read contract

### 7.1 Schema

Inline opening schema в `validation.py` принимает четвёртый enum literal. Поля
`contact`, `lock`, `invert`, `flip_h`, `flip_v` остаются syntactically readable,
чтобы загрузка и round-trip старых/будущих данных не ломались до semantic stage.

### 7.2 Semantic validator

Добавляется чистая функция, например:

```py
validate_opening_passages(
    config: dict,
    previous: dict | None = None,
    *,
    validate_all: bool = False,
) -> None
```

Она сопоставляет пространства по `space.id`, openings внутри пространства по
`opening.id` и применяет правила:

| Ситуация | Результат |
|---|---|
| Новый `passage` без запрещённых ключей | принять |
| Смена другого типа на `passage`, запрещённый ключ остался | отклонить |
| В существующем `passage` добавлен или изменён любой запрещённый ключ | отклонить |
| Неизменённый некорректный `passage` проходит с несвязанной правкой | принять без переписывания |
| Из некорректного `passage` удалены запрещённые ключи | принять |
| Full/space import содержит любой запрещённый ключ у `passage` | отклонить |

Запрещённым считается само наличие ключа, включая `contact: null` и
`flip_h: false`: каноническая новая запись не содержит неприменимых полей.

Если старый объект имел другой `type`, смена контекста на `passage` считается
новой семантикой и проверяется полностью, даже когда значение binding-поля
текстово не изменилось.

Стабильный public error code: `invalid_passage_fields`. Сообщение содержит id
пространства, id проёма и отсортированный список запрещённых полей, но не
значения entity ids.

### 7.3 Точки подключения

Одна и та же проверка обязательна для:

- `houseplan/config/set` с предыдущей конфигурацией;
- `houseplan/plan/optimize` с предыдущей конфигурацией;
- merge-import с предыдущей конфигурацией;
- replace/full import с `validate_all=True`;
- space import с `validate_all=True` для входящего/перенумерованного content.

Ошибка преобразуется в существующий websocket/import error contract; partial
write запрещён.

## 8. UX редактора

### 8.1 Палитра и размещение

В submenu «Проём» после двери добавляется пункт:

- label: `Открытый проём` / `Open passage`;
- icon: `mdi:arch`;
- id/type: `passage`;
- default: 90 см, `flipH=false`, `flipV=false`.

Порядок пунктов: окно, дверь, открытый проём, ворота. Hover/click resolver,
physical-wall eligibility, запрет на open span, center magnet, shoulder rulers и
commit flow полностью общие с остальными openings.

Preview нового типа не рисует дверной symbol. Он показывает только существующие
временные элементы размещения: центральную точку, размерные подписи и нейтральный
selection footprint. Пунктир open span и створка не используются.

### 8.2 Диалог

Диалог содержит четвёртый radio option. При `type === 'passage'`:

- поле ширины остаётся;
- contact selector скрыт;
- invert скрыт;
- lock selector скрыт;
- flip horizontal и flip vertical скрыты;
- icon диалога — `mdi:arch`;
- Save и Delete работают как для остальных openings.

Если draft содержит непустой `contact` или `lock`, после выбора `passage`
показывается видимый inline warning:

- RU: `При сохранении датчик открытия и замок будут удалены.`;
- EN: `Saving will remove the open/close sensor and lock.`

Текст может грамматически перечислять только реально заполненные поля, но смысл
и наличие предупреждения обязательны. Warning имеет `role="status"` и не
полагается только на цвет или icon.

Переключение radio само по себе не изменяет config. Пока диалог не сохранён,
скрытые значения остаются в draft: если пользователь вернулся к исходному типу,
поля снова видны. Save с `passage` удаляет их. Отдельный confirm modal не нужен:
явное предупреждение в открытом commit-диалоге удовлетворяет продуктовой
формулировке и не добавляет второй уровень подтверждения.

Если прочитан уже сохранённый некорректный `passage` со stale bindings, диалог
показывает то же предупреждение, а Save канонизирует запись. Cancel ничего не
меняет.

### 8.3 История и взаимодействие

- create/edit/type change/delete используют существующие history labels;
- drag меняет только geometry и остаётся одним history step;
- undo/redo восстанавливает целиком прежний opening, включая type и bindings;
- в Plan невидимый opening выбирается существующим hitbox и показывает hover
  outline;
- в View и Static `passage` inert и не открывает info card;
- stale `contact`/`lock` у прочитанного `passage` не создают lock badge,
  opening info или live entity subscription.

## 9. Нормативная матрица рендера

| Surface/state | Кладка | Пол/tunnel | Собственный symbol | Editor chrome |
|---|---|---|---|---|
| Full View | разрыв по `length` | есть | нет | нет |
| Full Plan, покой | разрыв по `length` | есть | нет | только при hover/selection |
| Full Plan, placement | будущая позиция читается по preview/размерам | preview не коммитит geometry | нет створки/пунктира | да |
| Static card | разрыв по `length` | есть | нет | нет |
| Скрытая изометрия | полноразмерный вертикальный разрыв, видимые откосы | существующий floor | нет полотна и его тени | нет |

### 9.1 Full 2D

- `renderOpeningVisibleGeometry()` обязан иметь явную ветку `passage`,
  возвращающую пустую visible geometry; fallback неизвестного типа не должен
  превращать его в дверь.
- `openingVisibleMetrics()` продолжает выдавать размеры hitbox/outline по длине
  и толщине стены.
- wall cut и opening tunnel используют существующий общий pipeline без отдельной
  декоративной рамки.
- `openingAmount('passage', ...)` всегда возвращает `1` и не читает contact.
- lock badge разрешён только для `door` и `gate`, а не по условию
  `type !== 'window'`.
- `hide_openings` скрывает symbols старых типов, но не заделывает физический
  разрыв `passage`.

### 9.2 Static card

Static должен показать новый тип, но #157 не меняет исторический визуал трёх
старых типов. Поэтому static wall fingerprint и wall builder получают только
нормализованные cuts с `type === 'passage'`; door/window/gate по-прежнему не
добавляют Static symbols/cuts в рамках этой задачи.

Для плана без `passage` output Static и cache fingerprint остаются прежними. При
наличии `passage` canonical wall geometry и tunnel/floor layer должны дать
чистый разрыв и пол, в том числе при default wall thickness. Никаких HTML
hit-targets или entity subscriptions для passage Static не создаёт.

### 9.3 Изометрия

- `IsoOpeningType` расширяется `passage`;
- structural basis для `passage` содержит пустой список leaves;
- opening остаётся во входных cuts wall boolean geometry;
- projection и bounds безопасно обрабатывают пустой basis;
- не рисуются panel, leaf shadow и live-state animation;
- откосы являются частью общей extrusion geometry стены;
- высота/форма арки не моделируются: cut идёт на полную текущую высоту стены.

## 10. Свет и Glow

Классификация проходов должна стать явной, а не зависеть от условия
`type !== 'window'`:

- `door`, `gate`, `passage` — кандидаты interior passage;
- `window` — не passage;
- каждый кандидат проходит одинаковую проверку пола по обе стороны;
- только прошедшие кандидаты вычитаются из light masonry и добавляются в cuts;
- `passage` не зависит от HA state, `contact` и `invert`, даже если эти поля
  присутствуют в старой битой записи;
- наружный `passage`, passage у пустой стороны или на нераспознанной геометрии
  остаётся непрозрачным для light;
- sun/window rays по-прежнему используют только windows;
- ширина прозрачного участка и Glow footprint совпадают с открытой дверью той
  же geometry при одинаковом floor test.

Fingerprint/cache key света должен зависеть от geometry passage так же, как от
других interior passages. Изменение type door↔passage при неизменной geometry не
обязано перестраивать barriers, если итоговая классификация та же; correctness
важнее этой оптимизации.

## 11. Import, export и совместимость

### 11.1 Текущая версия

- full export и space export сохраняют literal `passage` без remap;
- import remap меняет id пространства/opening по существующим правилам, но не
  type и geometry;
- valid passage проходит full/space import;
- passage с запрещённым ключом отклоняется до commit;
- неизвестные sibling-поля сохраняются backend schema и при несвязанном
  round-trip;
- оптимизация не удаляет и не превращает passage.

### 11.2 Старые конфигурации

Конфигурация без `passage` не мигрируется, не переписывается и не меняет
визуальное или runtime-поведение. Нового top-level capability flag не требуется.

### 11.3 Downgrade

Перед реализацией текущий pre-feature frontend фактически попадает для
неизвестного opening type в дверную fallback-ветку. Поэтому ожидаемый
best-effort downgrade для frontend v1.64.0:

- загрузка и рендер не падают;
- passage может выглядеть как дверь, то есть визуальная точность не гарантируется;
- старый диалог не знает radio option и не должен считаться поддерживаемым
  редактором этого типа;
- старый backend со строгим enum может отклонить последующую запись всей
  конфигурации, содержащей `passage`.

Эти ограничения явно записываются в `docs/CONFIG-COMPATIBILITY.md`. Реализация
должна подтвердить отсутствие runtime crash source-аудитом/fixture-тестом
pre-feature поведения; поддержка редактирования на старой версии не требуется.

## 12. I18n, accessibility и touch

Минимальный набор новых RU/EN ключей:

- `opening.passage`;
- `opening.passage_binding_warning`;
- при необходимости отдельный help/description key для отличия от open span.

Требования:

- RU/EN key parity test проходит;
- radio имеет обычную label association и доступен с клавиатуры;
- warning читается screen reader и не кодируется одним цветом;
- toolbar item получает локализованный accessible label через существующий
  menu contract;
- новый тип не уменьшает существующие touch targets;
- невидимый passage hitbox в Plan сохраняет существующий минимум; во View его
  pointer events отключены по общему contract openings.

## 13. Performance, security и observability

- отдельного runtime animation/state resolver для `passage` нет;
- stale bindings не попадают в full/static snapshot entity sets;
- wall, light и iso caches используют существующую geometry/fingerprint
  архитектуру; новый unbounded cache не добавляется;
- change-aware validator работает линейно по spaces/openings с map по id;
- error не логирует entity ids и не раскрывает больше существующей config API;
- права websocket/import не меняются;
- отдельного benchmark profile не требуется; перед бетой проходит канонический
  performance gate всего продукта.

## 14. Acceptance criteria

1. В toolbar и opening dialog доступен `Открытый проём` / `Open passage` с
   default 90 см.
2. Для passage показывается только ширина; contact, lock, invert, flip_h,
   flip_v скрыты и не записываются.
3. При смене объекта с непустым contact/lock на passage до Save виден явный
   warning; Cancel сохраняет исходник, Save удаляет bindings, обратная смена
   после Save их не восстанавливает.
4. Full View/Plan показывает чистый физический разрыв стены и продолжение пола,
   без створки, дуги, пунктира или рамки.
5. Passage остаётся выбираемым, перемещаемым и удаляемым в Plan через временный
   editor chrome, но inert в View/Static.
6. Static card показывает passage как разрыв с полом; план без passage и старые
   opening types сохраняют прежний Static output.
7. Скрытая изометрия показывает полноразмерный cut и откосы, без leaf/panel
   shadow и без crash.
8. Внутренний passage пропускает light/Glow независимо от state; наружный или
   неопределённый passage остаётся fail-dark.
9. Backend принимает канонический passage и отклоняет новую/изменённую запись с
   любым из пяти запрещённых ключей кодом `invalid_passage_fields`.
10. Неизменённый legacy-broken passage проходит несвязанное сохранение; его
    исправление принимается; import валидирует весь входящий content.
11. Full/space export-import сохраняют type/geometry и обычный id remap; partial
    write при ошибке отсутствует.
12. Конфиги с door/window/gate не мигрируют и проходят regression suite без
    изменений.
13. Старый frontend v1.64.0 на passage не падает; точный fallback и ограничение
    старого backend задокументированы.
14. RU/EN parity, unit/backend tests, build, smoke и новые golden evidence
    проходят в предусмотренный процессом момент.

## 15. Тест-план

### 15.1 TypeScript unit

- `OpeningPlacementType`/preset: passage, 90 см, false flips;
- placement на physical wall, запрет на open span, center magnet и measurements
  не расходятся с door;
- `openingAmount('passage', null/on/off/unavailable, invert)` всегда 1;
- `renderOpeningVisibleGeometry(passage)` не содержит leaf/arc/glass/gate path;
- metrics/hitbox остаются конечными и положительными;
- full renderer не создаёт lock badge/info/binding subscription для stale
  passage fields;
- light: две комнаты пропускают, внешний край не пропускает, footprint равен
  door при одинаковой geometry;
- Static fingerprint/output меняется для passage и не меняется для старых типов;
- iso basis passage имеет zero leaves, projection/bounds безопасны;
- RU/EN parity.

### 15.2 Backend unit

- schema принимает canonical passage и прежние три types;
- новый/сменивший тип passage с каждым запрещённым ключом, включая null/false,
  отклоняется;
- одновременный список полей даёт стабильный отсортированный error;
- неизменённый broken passage + unrelated config edit принимается;
- изменение geometry при неизменных broken fields принимается как несвязанное с
  этими полями изменение;
- удаление broken fields принимается;
- изменение/добавление broken field отклоняется;
- config/set и optimize вызывают validator;
- merge, full replace и space import покрыты success/failure/atomicity cases;
- valid export-import round-trip сохраняет type и geometry.

### 15.3 Smoke/manual

В реализации, а перед бетой — каноническим smoke gate:

1. создать passage через toolbar на общей толстой стене;
2. убедиться в preview без створки и в default 90 см;
3. сохранить, hover/select, перетащить, undo/redo, удалить;
4. создать дверь с contact+lock, выбрать passage, увидеть warning, Cancel;
5. повторить и Save; убедиться, что bindings удалены и не восстановились;
6. проверить Full View и Static в light/dark themes;
7. включить Glow: внутренний проход светится насквозь, наружный — нет;
8. проверить скрытую изометрию;
9. full и space export/import;
10. загрузить downgrade fixture старым frontend и подтвердить отсутствие crash.

### 15.4 Golden

Добавить детерминированную сцену с двумя комнатами, толстой общей стеной,
внутренним passage и источником Glow:

- Full 2D, dark theme;
- Static, dark theme;
- скрытая изометрия, dark theme;
- при необходимости отдельный exterior fail-dark кадр.

Новые baselines предпочтительнее переписывания несвязанных эталонов. Любое
изменение существующего `smoke_opening_*` baseline требует объяснения в PR/code
review evidence.

### 15.5 Команды и момент запуска

В цикле реализации:

```text
npm run typecheck
npm test
npm run build
python -m pytest tests_backend
```

Golden, browser smoke и performance выполняются перед бетой согласно release
runbook. Полный HA harness канонически выполняется в Linux CI; невозможность
локального Windows `fcntl` не считается заменой CI.

## 16. План реализации

1. Расширить types/schema и добавить чистый semantic validator со всеми call
   sites и backend tests.
2. Расширить placement preset, toolbar, dialog draft/save canonicalization,
   warning и i18n.
3. Добавить явные passage branches в 2D symbol/amount/locks/subscriptions.
4. Подключить passage cut/tunnel к Static без изменения output старых типов.
5. Сделать light classifier явным и покрыть interior/exterior cases.
6. Добавить zero-leaf passage basis в скрытой изометрии.
7. Покрыть import/export и downgrade fixture.
8. Обновить документацию и release artifacts, пройти implementation gates.

## 17. Release-артефакты

При реализации #157 в том же user-visible commit обязательны:

- `docs/CHANGELOG.md`;
- `docs/CHANGELOG.ru.md`;
- `docs/USER-GUIDE.ru.md` — таблица passage/open span и поток редактора;
- `docs/LIGHT.md` — explicit interior-passage rule;
- `docs/ISOMETRIC.md` — zero-leaf/full-height-cut поведение скрытого режима;
- `docs/CONFIG-COMPATIBILITY.md` — enum, broken-read validator и downgrade;
- при необходимости `docs/TESTING.md` — новая smoke/golden сцена;
- новые reviewed golden baselines и ссылка на evidence в issue/PR.

Коммит продуктового кода должен иметь терминальные trailers:

```text
Issue: #157
User-Visible: yes
```

## 18. Риски и меры

| Риск | Мера |
|---|---|
| Fallback рисует passage как дверь | явные branches и отрицательные renderer tests |
| Невидимый объект нельзя выбрать | сохранить отдельные metrics/hitbox/hover tests |
| Stale binding продолжает влиять на UI/runtime | type allowlist для locks/info/subscriptions, tests с broken fixture |
| Строгая схема блокирует несвязанные сохранения | change-aware semantic validator вместо cross-field schema reject |
| Import обходит правило | подключить validator к обоим import flows и optimize |
| Static меняет старые планы | fingerprint/cuts только для passage, regression snapshots без passage |
| Свет утекает наружу | сохранить двусторонний floor probe и exterior test |
| Iso создаёт дверное полотно | zero-leaf basis и golden |
| Старый frontend портит новый тип | документировать downgrade как read-only best effort |

## 19. Откат

Код можно откатить обычным revert, но уже сохранённый literal `passage` станет
неизвестен старому backend. Поэтому безопасный rollback релиза требует либо
предварительно вернуть такие openings к `door`/`gate`, либо сохранить frontend и
backend read support для `passage`, отключив только создание в UI. Автоматически
превращать passage в дверь при rollback запрещено: это создаёт ложный symbol и
может предложить небезопасные lock bindings.

## 20. Принятые технические предположения

Следующие мелкие решения приняты без дополнительного продуктового вопроса и
могут быть изменены при реализации, если не нарушаются acceptance criteria:

- `mdi:arch` — рабочая icon; при отсутствии в поставляемой версии MDI допустим
  локализованно нейтральный `mdi:door-open` без изменения persisted contract;
- passage расположен между door и gate в submenu;
- inline warning достаточен, отдельный confirm modal не нужен;
- draft временно хранит скрытые bindings, чтобы смена radio до Save была
  обратимой;
- unknown sibling-поля сохраняются при явном edit, запрещённые известные поля
  удаляются;
- наличие запрещённого ключа, даже с null/false, неканонично для новой записи;
- Static получает только passage cuts, чтобы не расширять #157 до общей opening
  parity;
- «арка» в этой версии — полноразмерный прямоугольный cut без кривой перемычки;
- отдельный performance benchmark не нужен, если общий pre-beta gate не
  показывает регрессию.
