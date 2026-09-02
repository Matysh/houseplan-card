# ТЗ #51 — Пользовательские изображения в декоративном слое

- Issue: https://github.com/Matysh/houseplan-card/issues/51
- Приоритет и тип: P2, `feature` + `security`
- Маршрут: полный; задача затрагивает новый UX-контракт, persisted config,
  backend content API, untrusted SVG, импорт/экспорт и обе View-поверхности,
  поэтому не проходит критерии лёгкого трека «одна поверхность», «нет нового
  UX-контракта» и «нет compatibility-полей»
- Реализованные зависимости: #21 (CSS/content security), #39 (large-raster
  diagnostics/downscale), #50 (portable export/import), #383 (мебельные
  transforms)
- Закрытый дубль: #46

## Сценарий

Домашний администратор на поверхности **Редактор подложки** хочет добавить на
план собственный ковёр, растение, логотип или другой пассивный визуальный
элемент, которого нет во встроенной библиотеке мебели. Он нажимает одну кнопку
**«Изображение»**, выбирает уже загруженный файл либо загружает PNG, JPEG, WebP
или SVG, видит будущий размер и положение, размещает картинку и затем двигает,
масштабирует, отражает, вращает и переставляет её по слоям как мебель.

Житель и гость встречают результат в обычном View или
`houseplan-space-card`: картинка является только частью плана, не реагирует на
нажатия и не участвует в состояниях Home Assistant.

## Что человек увидит до и после

**До:** пользователь ограничен встроенными фигурами и библиотекой мебели;
собственную картинку можно сделать только подложкой всего пространства или
подготовить план во внешнем редакторе.

**После:** одна кнопка в Редакторе подложки позволяет безопасно загрузить либо
повторно выбрать своё изображение, поставить его на план и редактировать теми же
привычными жестами, что мебель; если локального файла больше нет, View не рисует
сломанный значок, а редактор сохраняет место объекта и предлагает замену.

## Проблема

`space.decor[]` сейчас принимает только `line`, `rect`, `ellipse`, `text` и
`furniture`. Имеющийся `DecorImageTransform` — только неиспользуемая заготовка:
у неё нет persisted kind, ссылки на content asset, backend validation, рендера,
palette или lifecycle.

Прямое сохранение пользовательского URL либо data URL неприемлемо:

- внешний URL раскрывает адрес Home Assistant третьей стороне и может исчезнуть;
- data URL раздувает 2 МиБ config, дублирует один файл в каждом объекте и
  усложняет export;
- SVG является активным документом при прямом открытии same-origin URL и требует
  одновременно строгой проверки содержимого и sandbox-заголовков;
- файл может использоваться несколькими объектами и пространствами, поэтому
  удаление по факту исчезновения одной ссылки разрушительно.

## Цель

Добавить reusable decor assets и `kind: image`, сохранив четыре инварианта:

1. файл загружается, читается и удаляется только через аутентифицированный
   House Plan content lifecycle с fail-closed проверкой;
2. конфигурация хранит один стабильный идентификатор, а не bytes, signed URL или
   исходный путь;
3. размещение и transforms повторяют мебель, кроме специального притягивания
   задней гранью к стене;
4. ни удаление/замена объекта, ни удаление пространства, ни импорт никогда не
   удаляют asset по предположению.

## Скоуп

В скоупе:

- статические PNG, JPEG/JPG, WebP и безопасный поднабор SVG;
- одна новая кнопка **«Изображение»** на основной панели Редактора подложки;
- palette загруженных изображений с загрузкой, повторным выбором и явным
  удалением неиспользуемого asset;
- one-shot preview/placement и transforms по контракту мебели #383;
- свойства изображения: файл, прозрачность, физический размер, угол,
  горизонтальное/вертикальное отражение и действующие действия слоя;
- отображение в полном View и `houseplan-space-card`, соблюдение
  `hide_decor` и существующего layer order;
- missing-asset placeholder и замена файла в Редакторе подложки;
- новый content namespace, upload/list/resolve/delete API, квоты, подписание,
  reference counting и конкурентно безопасное удаление;
- backend raster validation и SVG validation/canonicalization;
- full, space и plan-only export/import без вложения файлов;
- rolling-version guard, i18n RU/EN/DE/FR, документация, unit/backend/smoke,
  golden и performance coverage.

## Не-скоуп

- GIF, AVIF, TIFF, BMP, PDF, анимированный raster или SVG animation;
- загрузка по URL, drag-and-drop со страницы, clipboard paste, камера или
  встроенный поиск изображений;
- векторный/SVG-редактор, перекраска содержимого, crop, маска пользователя,
  фильтры, blend modes или удаление фона;
- HA entity bindings, hover/click actions, состояния устройств, Glow, солнце,
  стены, комнаты, проёмы или физическая мебель;
- автоматическое удаление orphan-файлов по возрасту, при удалении объекта,
  замене картинки, удалении пространства или импорте;
- перенос bytes в JSON, ZIP или новый архивный backup-формат;
- wall magnet: у произвольной картинки нет семантической «задней» грани;
- изменение поведения существующих инструментов, общей палитры цвета,
  картинки-подложки пространства и marker attachments.

## Контракт поведения

### 1. Единая кнопка и palette

- На основной панели Background editor рядом с мебелью появляется ровно одна
  новая локализованная кнопка **«Изображение»**. Отдельной кнопки «Файлы» или
  отдельного постоянного asset manager нет.
- Кнопка открывает overlay/palette в существующем overlay host и не меняет fit
  либо camera плана. Вверху palette находится **«Загрузить файл»**, ниже —
  ранее загруженные assets, доступные всем пространствам текущей House Plan
  integration.
- Строка asset показывает безопасно экранированное исходное имя, тип, размеры,
  thumbnail и число использующих его decor-объектов. Сортировка — новый upload
  первым; повторная загрузка тех же canonical bytes не создаёт второй asset.
- Выбор строки закрывает palette и вооружает одно размещение. Успешный upload
  добавляет/обновляет строку и сразу вооружает тот же preview. Cancel file picker,
  закрытие palette или `Esc` ничего не размещают и ничего не удаляют.
- `Esc`, смена инструмента, пространства или редактора до клика снимает preview.
  После одного клика создаётся один объект, он остаётся выбранным, а инструмент
  возвращается в **Select** — тот же one-shot контракт, что у мебели.

### 2. Upload и форматы

- Расширение и заявленный browser MIME не являются доказательством формата.
  Backend определяет PNG/JPEG/WebP по signature и успешному bounded decode;
  SVG — только по успешному безопасному XML/SVG pipeline. Несовпадение
  расширения, MIME и bytes отклоняет upload понятной ошибкой.
- Raster до отправки проходит существующий #39 header probe. Порог декодированной
  памяти 128 МиБ, target longest side 4096 px и hard side 16384 px остаются
  едиными с картинкой-подложкой. SVG никогда не растеризуется.
- Один **сохранённый canonical asset** ограничен 2 МиБ. Если исходный raster не
  укладывается либо попал под warning #39, UI предлагает создать уменьшенную
  копию и показывает исходный/будущий размер; потеря качества никогда не
  происходит молча. Alpha PNG/WebP сохраняется, непрозрачный результат может
  кодироваться JPEG тем же проверенным pipeline. Если безопасный результат всё
  ещё больше 2 МиБ, upload отклоняется без изменения config/palette.
- Backend повторно проверяет фактический format, полное декодирование raster,
  положительные bounded dimensions, pixel/decompression limits и итоговый
  размер. Доверия к client probe, metadata или имени нет.
- Canonical bytes записываются copy-on-write во временный файл, `fsync`/atomic
  rename завершают upload. Любой parse, quota, I/O, cancellation или validation
  failure удаляет temporary и не создаёт видимую запись.
- Upload, list metadata и delete требуют обычного House Plan write permission.
  Чтение файла требует HA session либо ограниченную signed content-ссылку.

### 3. Безопасный SVG

SVG принимается только как один статический, самодостаточный документ. Проверка
не использует regex sanitizer и выполняется на backend до появления preview:

- XML parser запрещает DTD, entity declarations/resolution, processing
  instructions и внешние ресурсы;
- разрешён только SVG namespace и фиксированный allowlist статической
  геометрии/групп/defs, локальных gradients, `clipPath` и `mask`;
- запрещены `script`, `foreignObject`, `iframe`, `object`, `embed`, SVG animation,
  event attributes, неизвестные namespaces, `<image>`, внешние/data/blob URLs,
  CSS imports и любые ссылки кроме локального `#id` на разрешённый элемент;
- безопасные geometry, transform, fill/stroke, opacity, gradient, clip и mask
  attributes имеют allowlist и числовые/строковые bounds; element count,
  nesting depth, attribute count/length и path/text length ограничены;
- документ обязан иметь конечный положительный `viewBox` либо конечные
  положительные intrinsic width/height, из которых backend создаёт canonical
  `viewBox`; иначе aspect ratio определить нельзя и файл отклоняется;
- после проверки дерево сериализуется заново в canonical UTF-8 SVG и повторно
  парсится тем же строгим parser. Asset id считается уже от этих bytes.

Обнаружение любого запрещённого или неподдерживаемого элемента, атрибута, URL
или namespace отклоняет **весь файл** с локализованной причиной. Ничего не
вырезается молча и визуально изменённая версия не сохраняется.

SVG content response имеет точный `image/svg+xml`,
`X-Content-Type-Options: nosniff` и sandbox CSP без script, object, navigation,
forms, network и same-origin privilege. Те же заголовки действуют при обычной
аутентификации и по signed URL. В карточке SVG вставляется только как SVG
`<image>`, никогда как inline markup.

### 4. Первичное размещение

- Preview центрируется на текущем указателе и проходит общий decor/room smart
  magnet и grid snap. Специального furniture wall magnet и автоматического
  поворота к стене нет.
- Начальная физическая ширина равна 100 см, высота вычисляется по intrinsic
  aspect ratio. Если высота получилась больше 200 см, высота становится 200 см,
  а ширина пропорционально уменьшается. Значения переводятся в normalized
  geometry через текущие `cell_cm`/grid helpers и не зависят от camera zoom,
  DPI или числа пикселей файла.
- Начальный angle — 0°, `flip_h/flip_v` отсутствуют, opacity — 1.0. Общий
  color/opacity picker не перекрашивает и не делает новый image прозрачным;
  opacity меняется в свойствах конкретного изображения.
- Preview показывает exact будущие bounds, content и transform. Клик на
  валидной позиции append-ит объект наверх текущего decor order и создаёт одну
  именованную Undo-команду. Save failure использует действующий rollback
  server-backed snapshot и не оставляет фантомный объект.

### 5. Выбор и transforms

- В **Select** и **Erase** hit area изображения — весь повёрнутый прямоугольник,
  включая полностью прозрачные пиксели. Alpha hit-test не применяется.
- Move, smooth corner resize, четыре middle handles, crossing, rotation cursors,
  `Esc`, Undo/Redo и pointer-capture/cancel повторяют мебель #383:
  - углы по умолчанию сохраняют aspect ratio, `Shift` разрешает независимые оси;
  - middle handle меняет только одну ось;
  - crossing хранит положительный extent и переключает `flip_h`/`flip_v`;
  - rotation свободный, `Shift` привязывает к ближайшим 45°;
  - move остаётся grid-bound и использует обычный decor/room magnet;
  - pinch, pan и `pointercancel` не создают лишней операции и не сохраняют
    промежуточный transform.
- Double click открывает свойства с thumbnail/именем, **«Заменить изображение»**,
  opacity, signed width/height, двумя checkbox отражения, angle и действующими
  действиями слоя. Signed size и checkbox меняют те же `flip_h/flip_v`, что
  crossing; persisted `w/h` остаются строго положительными.
- Замена выбирает существующий либо новый asset, меняет только `asset_id`
  выбранного объекта и сохраняет geometry/style/layer. Другие объекты с прежним
  asset не меняются; старый файл не удаляется.

### 6. Отображение и слои

- Image — пассивный decor kind. Он участвует в том же `space.decor[]` order и
  находится там же, где мебель: над plan image и room/data fills, но под Glow,
  солнцем, стенами, проёмами, устройствами и подписями комнат.
- `display.hide_decor` скрывает image в обоих View, но Background editor
  продолжает показывать и редактировать его по действующему правилу скрытого
  декора.
- Полный View и `houseplan-space-card` используют одну projection-функцию,
  одинаковые signed URLs и одинаковые rotate/flip/opacity. Image не получает
  hover, focus, tooltip, click/action или HA subscription.
- В Plan/Devices editors и при неактивном Background tool изображение ведёт себя
  как обычный decor context согласно `DECOR-EDITOR.md`; device/input ownership
  не меняется.
- Все четыре повёрнутые вершины участвуют в content bounds. Прозрачные поля
  файла не отсекаются и тоже входят в bounds.
- Resolve/sign выполняется один раз на уникальный `asset_id`; несколько объектов
  используют один painted URL. Signed URL и raw URL никогда не пишутся в config.

### 7. Missing asset и repair

- Неизвестный `asset_id`, отсутствующий/повреждённый файл, несовпавший hash либо
  отказ resolve считается `missing`, а не поводом удалить decor record.
- В View/kiosk/`houseplan-space-card` missing image не создаёт broken-image icon,
  placeholder, сетевой запрос к догаданному пути или пустой интерактивный слой;
  остальные части плана продолжают отображаться.
- В Background editor на сохранённых bounds виден нейтральный локализованный
  placeholder **«Изображение недоступно»**. Он selectable/erasable, сохраняет
  frame/handles/properties/layer и предлагает **«Заменить изображение»**.
- Замена repair-ит только этот объект. Исчезновение asset во время открытой
  сессии переводит все его экземпляры в placeholder после следующего
  authoritative resolve; geometry/history не меняются.

### 8. Явное удаление asset

- Удаление decor image удаляет только объект. Замена, Undo удаления, удаление
  пространства и удаление последней ссылки не показывают и не запускают
  удаление файла.
- В palette у asset с нулём ссылок доступно отдельное **«Удалить файл»** с
  подтверждением имени. У используемого asset действие disabled и показывает
  число ссылок.
- Backend внутри config write lock заново считает ссылки во всех пространствах.
  Если между list и delete появилась ссылка, delete отвечает стабильным
  `in_use`, файл остаётся, palette обновляется. Client-supplied count не
  авторизует удаление.
- Удаление без ссылок атомарно убирает content и catalog record. Повторное
  удаление отсутствующего id идемпотентно сообщает `removed: false`.
- Нет scheduled/age collector для promoted assets. Рост ограничивается upload
  quota и явным удалением.

## Модель данных

### Persisted decor record

```ts
interface DecorImage {
  id: string;
  kind: 'image';
  asset_id: string;       // 64 lowercase hex SHA-256 canonical bytes
  x: number;
  y: number;
  w: number;              // positive normalized extent
  h: number;              // positive normalized extent
  angle?: number;         // normalized to the existing decor range
  opacity?: number;       // absent = 1
  flip_h?: boolean;       // absent = false
  flip_v?: boolean;       // absent = false
}
```

`color`, `width`, `width_cm`, fill и furniture `symbol` к image неприменимы и
не пишутся новым frontend. Backend schema валидирует id, finite/ranges,
положительные размеры, opacity и boolean flags. Missing physical asset не делает
config structurally invalid: это необходимый контракт для переноса без bytes и
repair.

### Asset identity и catalog

- `asset_id` — SHA-256 **canonical stored bytes**. Благодаря этому одинаковый
  upload переиспользуется, а случайное/злонамеренное совпадение id с другими
  bytes невозможно.
- Dedicated namespace находится под House Plan content root и попадает в HA
  backup. Blob не хранится в `.storage/houseplan.config`.
- Catalog хранит `asset_id`, sanitized display name, exact MIME/extension,
  canonical byte size, intrinsic width/height, created timestamp и schema
  version. Ни browser path, signed token, user id, space id, refcount, thumbnail
  bytes или исходный unsanitized filename не являются persisted config.
- Refcount/`used_by` всегда вычисляется из authoritative config. Один image asset
  может использоваться любым числом объектов и пространств в пределах общего
  лимита decor.
- Квота namespace: максимум 200 promoted assets и 256 МиБ canonical bytes;
  один asset — максимум 2 МиБ. Общая проверка учитывает concurrent uploads и
  существующий reserve/low-disk guard. Identical-byte upload не расходует новый
  file slot или bytes.

## Backend API и capability

Точные transport names являются частью реализации и покрываются contract tests:

| Endpoint | Контракт |
|---|---|
| `POST /api/houseplan/assets/upload` | один multipart file; write permission; validate/canonicalize; `{asset, reused}` |
| `houseplan/assets/list` | metadata newest-first + authoritative `used_by`; write permission |
| `houseplan/assets/resolve` | bounded unique `ids[]`; возвращает metadata/content path либо `missing`; authenticated read |
| `houseplan/assets/delete` | `asset_id`; write permission; server ref-check; `{removed}` либо `in_use` |
| `houseplan/content/sign` | дополнительно подписывает только canonical asset content paths |
| `GET /api/houseplan/content/assets/_/<name>` | authenticated/signed inert streaming response с exact MIME/security headers |

`houseplan/config/get` добавляет неперсистентную capability
`decor_assets_api: 1`. Кнопка и upload/edit flows доступны только при exact
поддерживаемой версии. Missing/invalid/unknown capability fail-closed оставляет
существующие image records как missing и показывает при попытке редактирования
локализованное требование обновить карточку и интеграцию; существующие редакторы
не ломаются.

Upload/list/delete не принимают `space_id`, owner или refcount как authority.
Resolve ограничен 200 уникальными корректными ids за вызов; frontend batching
не превышает лимит `content/sign`.

## Import/export и совместимость

- Full, single-space и plan-only export сохраняют image decor records.
- JSON по-прежнему не содержит blob, base64, signed URL или исходный файл.
  `content_manifest` получает canonical строку на каждый image record с
  `asset_id`, MIME/hash metadata на момент export и `exists_at_export`.
- Export format повышается до v2, потому что v1 importer не знает `kind:image`
  и exact manifest rows. Новый importer продолжает принимать v1. Старый export
  без images остаётся побайтово совместимым по payload после нормализации.
- Preview не доверяет supplied manifest: заново собирает ожидаемые image refs из
  payload, валидирует форму/hash и проверяет local catalog/blob. Asset считается
  доступным на target только если canonical bytes дают тот же content hash.
- Доступный asset переиспользуется без копирования. Для отсутствующих preview
  показывает число **уникальных файлов** и число затронутых объектов и требует
  то же явное подтверждение missing content, что #50.
- После подтверждения import сохраняет `asset_id`, geometry, opacity, flips и
  decor order без detach. Такие объекты становятся repair-placeholder в
  Background editor и не рисуются в View до замены или появления exact asset.
- Duplicate/replace policy для spaces не меняет asset id. Collision обычных
  decor ids решается действующим remap; content-addressed asset id не remap-ится.
- Optimize, copy/paste/duplicate, room operations и layout writes сохраняют
  `asset_id` и flip flags. Замена конкретного объекта — единственный обычный UI
  путь изменения его `asset_id`.

### Rolling compatibility и откат версии

- Новый backend принимает все старые configs без миграции и добавляет новый
  decor schema branch.
- Новый frontend со старым backend не разрешает создавать/загружать image.
- Старый frontend не обязан рисовать новый kind. Пока config содержит image,
  downgrade является read-only best effort: редактировать/сохранять план старым
  комплектом нельзя, потому что старый backend может отвергнуть новый kind.
- Автоматически превращать image в plan backdrop, furniture, external URL или
  удалять его при downgrade запрещено.

## UX, accessibility, touch и kiosk

**Touch editor: best effort / intentionally degraded.**

- Toolbar button, upload control, asset rows, delete/replace actions и dialog
  используют native button semantics, видимый focus, localized `aria-label` и
  минимум 44×44 CSS px для touch targets.
- Palette имеет dialog name, focus trap, `Esc`, возврат focus на кнопку и
  keyboard selection `Enter`/`Space`. Thumbnail получает имя файла как доступное
  описание, но декоративный image в View не входит в tab order и имеет
  `aria-hidden`.
- Загрузка показывает busy/progress state и блокирует повторный submit, но не
  блокирует закрытие редактора. Ошибка сообщается текстом и не только цветом.
- Background editing на touch остаётся best effort по `TOUCH-SUPPORT.md`, но
  safety floor обязателен: single pointer не оставляет drag stuck, второй
  pointer переводит жест в pan/pinch без commit, `pointercancel` откатывает live
  transform, View/kiosk не получают новых interaction targets.
- Light/dark theme меняет chrome/placeholder, но не пиксели пользовательского
  файла, его alpha или opacity.

## i18n

Новые или расширенные семейства ключей добавляются синхронно в RU/EN/DE/FR:

- toolbar/palette: Image, Upload file, Previously uploaded, Used in N objects,
  Delete file, Replace image;
- state: Uploading, Processing, Image unavailable, No uploaded images;
- validation: supported formats, file too large, unsafe/unsupported SVG,
  corrupt/mismatched raster, dimensions unavailable, quota/file-count/low-disk;
- confirmation/errors: delete unused file, asset became in use, upload/save/
  resolve failed, compatible integration required;
- history: add/move/resize/rotate/flip/replace/delete image.

Placeholder plurals и параметры имеют одинаковые множества во всех четырёх
локалях. UI не показывает raw backend exception, путь на диске, stack, hash или
signed URL.

## Производительность

- Bytes не входят в config, export или JS bundle. Asset tools остаются в lazy
  editor graph; core View получает только минимальный image projection/resolve.
- На config revision frontend дедуплицирует ids, resolve/sign batching выполняет
  не больше одного запроса/подписи на уникальный asset. Повторные объекты
  переиспользуют URL и browser cache.
- Content-addressed response может быть immutable-кэшируемым, но приватным;
  смена bytes всегда означает новый id/URL.
- Large-house fixture с 1000 image records на ограниченном наборе assets не
  делает 1000 resolve/sign calls и остаётся внутри действующего frame/heap
  performance budget. Missing ids также negative-cache-ятся на текущую config
  revision.
- Raster decode/downscale не выполняется в render loop. SVG никогда не
  инлайнится и не клонирует свой DOM в основной plan SVG.
- `npm run bundle:budget` не повышается. Любое увеличение initial View graph
  измеряется и обосновывается в review; editor-only palette не имеет права
  попасть в initial graph.

## Затрагиваемые поверхности и ожидаемые файлы

Ожидаемо, точная раскладка может меняться при реализации:

- `src/editors/decor/types.ts`, geometry/projection helpers;
- `src/houseplan-card.ts`, lazy editor runtime и decor dialogs/styles;
- `src/space-render.ts`, `src/space-geometry.ts`, content signing/cache;
- новый frontend helper asset metadata/upload/resolve;
- `custom_components/houseplan/{const,http_api,websocket_api,validation,plans}.py`
  и отдельный pure asset/SVG module;
- `custom_components/houseplan/import_export.py`, integration strings/translations;
- `src/i18n/{en,ru,de,fr}.json`;
- frontend unit, pure backend, HA-harness и demo smoke fixtures;
- `docs/DECOR-EDITOR.md`, `docs/ARCHITECTURE.md`,
  `docs/CONFIG-COMPATIBILITY.md`, `docs/USER-GUIDE.md`,
  `docs/USER-GUIDE.ru.md`, `docs/TESTING.md`, `docs/TESTING-DEMO.md`;
- оба changelog в implementation commit.

## Критерии приёмки

- **AC1.** Background editor имеет ровно одну новую кнопку «Изображение»;
  palette загружает PNG/JPEG/WebP/SVG и повторно выбирает общий asset. Выбор
  вооружает one-shot preview, клик создаёт один выбранный image и возвращает
  Select; Cancel/Esc/tool/space/editor switch ничего не создают.
  **Доказательство:** component unit + `demo/smoke_decor_images.mjs`.
- **AC2.** Новый объект получает ширину 100 см и aspect-preserving height с cap
  200 см независимо от camera/DPI; preview и committed bounds совпадают при
  разных `cell_cm`, zoom и intrinsic ratios. **Доказательство:** geometry unit +
  browser smoke.
- **AC3.** Image повторяет furniture move/smooth resize/side handles/crossing/
  flips/free rotation/Shift 45°/Undo/Esc/pointercancel, но не получает wall
  magnet. Hit area — полный rotated rectangle. **Доказательство:** transform
  unit matrix + pointer smoke с отрицательной wall-magnet проверкой.
- **AC4.** Properties изменяют opacity, signed size, H/V flips, angle, layer и
  asset replacement; replace сохраняет geometry и не меняет другие refs.
  Удаление/замена объекта не удаляет файл. **Доказательство:** unit + smoke +
  backend file assertions.
- **AC5.** Full View и `houseplan-space-card` одинаково рисуют raster/SVG с
  alpha, opacity, flips, rotation и decor order; image пассивен и подчиняется
  `hide_decor`. **Доказательство:** shared projection unit + smoke + reviewed
  light/dark golden.
- **AC6.** Backend принимает только signature/decode-confirmed PNG/JPEG/WebP и
  строгий canonical SVG, ограничивает canonical asset 2 МиБ, store 200 files /
  256 МиБ и low-disk, не доверяет extension/MIME/client metadata. Ошибка или
  cancellation не оставляют temp/catalog/blob. **Доказательство:** pure backend
  corpus + HA endpoint tests, включая concurrency.
- **AC7.** SVG corpus сохраняет обычную geometry, local gradients,
  clipPath/mask и transparency, но целиком отклоняет DTD/entities, scripts,
  events, `foreignObject`, animation, image, external/data/blob URL, CSS import,
  unknown namespace и resource-limit cases. Content response всегда имеет
  exact MIME, `nosniff` и sandbox CSP. **Доказательство:** malicious/benign
  corpus + authenticated/signed HTTP tests.
- **AC8.** Asset id равен hash canonical bytes; identical upload idempotently
  переиспользует asset. Resolve/sign дедуплицированы; config содержит только
  id/transform. **Доказательство:** pure storage tests + config serialization
  unit + request-count smoke.
- **AC9.** Palette удаляет только asset с нулём ссылок после подтверждения.
  Backend повторно проверяет все пространства под lock; reference race даёт
  `in_use`. Никакой age/space/object/replace cleanup promoted assets нет.
  **Доказательство:** lifecycle/concurrency HA tests.
- **AC10.** Missing/corrupt/mismatched asset не рисуется и не действует в обеих
  View; Background editor показывает bounded selectable placeholder и позволяет
  replace без потери geometry/order. **Доказательство:** unit + smoke с
  disappeared file и failed resolve.
- **AC11.** Export v2 перечисляет каждый image ref, не содержит bytes/signed URL
  и сохраняет records во всех трёх режимах. Import принимает v1/v2, fail-closed
  проверяет manifest, переиспользует exact local hash, а после подтверждения
  сохраняет missing image placeholder и сообщает unique asset/object counts.
  **Доказательство:** pure + HA full/space/plan-only round-trip tests.
- **AC12.** New backend читает old config без migration; missing/unknown
  `decor_assets_api` запрещает создание/upload и не ломает остальные редакторы.
  **Доказательство:** compatibility fixtures обеих rolling directions.
- **AC13.** RU/EN/DE/FR имеют полный одинаковый key/placeholder set; keyboard,
  focus restore, 44×44 targets и touch cancellation соблюдены; View/kiosk не
  получают focus/pointer targets. **Доказательство:** i18n/accessibility unit +
  mouse/touch smoke.
- **AC14.** 1000 image records с повторяющимися/missing ids используют bounded
  batched resolve/sign, не выполняют decode в render и проходят действующие
  frame/heap ceilings; initial bundle budget не повышен. **Доказательство:**
  targeted performance smoke + `npm run bundle:budget`.
- **AC15.** Typecheck, unit и build зелёные; перед code review локально зелёный
  targeted image smoke. Перед бетой зелёные полный smoke, golden, performance и
  Linux HA harness на exact SHA. **Доказательство:** команды и CI artifacts.
- **AC16.** Canonical docs и оба User Guide описывают кнопку, форматы,
  transforms, missing/import/delete правила и лимиты; оба changelog обновлены в
  том же User-Visible implementation commit. **Доказательство:** docs diff,
  provenance и code review.

## План автотестов и отрицательной проверки

### Frontend unit

- расширить decor schema/type guards/canonicalization fixtures image record;
- initial-size matrix: landscape/portrait/square, height cap, разные `cell_cm`;
- furniture-parity transform matrix: corners, four sides, crossing, flips,
  signed properties, rotation Shift, opposite point, pointercancel;
- no-wall-magnet witness при сохранённом decor/room/grid magnet;
- rotated rectangular hit-test, bounds, hide_decor, layer order;
- unique-id resolver/cache, config revision invalidation, missing projection;
- export preview copy and compatibility capability predicate.

### Pure/backend и HA harness

- raster magic/MIME/extension/corruption/dimension/pixel/size boundaries ±1;
- benign SVG corpus и отдельный malicious case на каждый запрет, включая nested
  local reference cycles и resource bounds;
- hash/dedupe, quota/file count/free disk, atomic promote/temp cleanup,
  simultaneous identical/different uploads;
- auth/write/signed-read/content-header matrix;
- list/resolve/delete refs across two objects/two spaces, stale `used_by` race;
- config validation, v1→v2 export compatibility и full/space/plan-only import
  с available/missing/hash-mismatch assets.

### Browser

`demo/smoke_decor_images.mjs` использует production bundle и synthetic raster,
SVG и missing asset. Он проверяет upload palette, one-shot preview, exact commit,
transform/property/replace/delete/Undo, no wall magnet, pointer ownership,
light/dark View и static-card parity. Network counters доказывают batching и
отсутствие внешних SVG-запросов.

Golden получает одну детерминированную сцену с прозрачным raster, безопасным SVG,
поворотом/отражением/layer overlap и editor placeholder в light/dark. Baseline
принимается только из полного Linux CI artifact по действующему reviewed flow.

### Mutation/negative witnesses

1. Разрешить SVG event/external URL или убрать CSP/`nosniff` — corpus/HTTP test
   обязан покраснеть.
2. Подменить bytes при том же id — hash resolve/import test обязан дать missing.
3. Довериться client `used_by:0` — конкурентный delete test обязан потерять файл
   и покраснеть.
4. Вернуть auto cleanup последней ссылки — lifecycle test обязан увидеть
   исчезнувший asset.
5. Добавить wall magnet либо alpha hit-test — browser negative witness краснеет.
6. Detach missing record при import — round-trip теряет geometry и краснеет.
7. Делать resolve/sign на каждый объект — request-count/performance witness
   превышает bounded unique-id count.

## Риски

- **Same-origin SVG XSS/SSRF.** Двойная защита: strict reject/canonical reparse и
  sandboxed content response; SVG никогда не инлайнится.
- **XML/raster resource exhaustion.** Streaming byte cap ставится до parse,
  затем element/depth/attribute/path и decoded-pixel limits; тяжёлое выполняется
  вне HA event loop.
- **Потеря shared asset.** Delete авторизуется только server-side ref scan под
  config lock; никаких inferred collectors.
- **Гонка upload/catalog.** Content-addressed identity, atomic reserve/promote и
  idempotent identical upload не допускают overwrite.
- **Import показывает чужие bytes при совпавшем id.** Id — полный hash canonical
  bytes, resolve дополнительно проверяет catalog/blob consistency.
- **Большой initial bundle.** Palette и upload остаются lazy; core содержит
  только projection/resolve, budget и owner-graph покрыты тестом.
- **Сотни изображений задерживают View.** Один resolve/sign на unique id, cache,
  immutable content и bounded asset count; performance fixture фиксирует ceiling.
- **Старая версия перезапишет неизвестный kind.** Capability fail-closed и
  документированный read-only downgrade; никакой lossy migration.
- **Прозрачный asset невозможно выбрать.** Полный прямоугольный hit area и
  selection frame делают выбор предсказуемым.

## Откат

У feature нет автоматической persisted migration: старые записи не меняются,
новые `kind:image` additive. Откат frontend скрывает изображения, но не должен
удалять records или files. Откат backend ниже версии, принимающей image schema,
делает config read-only; перед намеренным постоянным downgrade пользователь
должен текущей версией удалить image objects, после чего отдельно удалить
неиспользуемые assets из palette. Автоматическая очистка недопустима.

Если implementation откатывается до публичной беты, dedicated assets остаются
в backup/content root и могут быть удалены только явной recovery-командой с тем
же reference guard. Export v2 importer остаётся backward-compatible с v1;
понижать уже опубликованный export version нельзя.

## Release-артефакты

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в том же `User-Visible: yes`
  implementation commit;
- актуальные `DECOR-EDITOR.md`, `ARCHITECTURE.md`,
  `CONFIG-COMPATIBILITY.md`, `USER-GUIDE.md`, `USER-GUIDE.ru.md`, `TESTING.md`
  и `TESTING-DEMO.md`;
- targeted `demo/smoke_decor_images.mjs` до code review;
- reviewed light/dark golden scenario, full browser smoke, performance и Linux
  HA-harness artifacts перед бетой;
- security evidence: benign/malicious SVG corpus и exact signed HTTP header
  tests;
- issue остаётся открытым в `S8-merged` до пакетного закрытия при выпуске беты.

## Решения владельца

- Одна кнопка открывает upload и palette; размещение one-shot как у мебели.
- Начальная ширина 100 см, высота по aspect ratio с cap 200 см.
- Все мебельные transforms применяются, но wall magnet отсутствует.
- Удаление/замена объекта не удаляет файл; удалить можно только явно из palette
  и только при отсутствии ссылок.
- Export остаётся JSON без bytes; missing import сохраняет geometry/order как
  editor-only repair placeholder.
- SVG с любой запрещённой/неподдерживаемой частью отклоняется целиком; ничего не
  вырезается молча.

## Принято предположительно, поменять свободно

- `asset_id` выбран content-addressed SHA-256, а не random UUID: это убирает
  collision/remap ambiguity и позволяет безопасно переиспользовать уже имеющийся
  файл на target. Владелец наблюдает только reuse, не форму id.
- Dedicated quota принята равной plan store: 200 assets / 256 МиБ, при
  подтверждённом владельцем лимите 2 МиБ на canonical asset.
- SVG без определимого aspect ratio отклоняется вместо browser default 300×150;
  молчаливый искусственный ratio сделал бы placement зависимым от renderer.
- Новый image стартует с opacity 1.0 и не использует session color/opacity
  picker: picker задаёт цвет рисуемых элементов, а не пиксели пользовательского
  файла.
- Upload, закрытый без размещения, остаётся reusable в palette до явного
  удаления: promoted asset неотличим от файла, который пользователь намеренно
  подготовил для следующего пространства.
- Export format повышается до v2, новый importer продолжает читать v1. Это
  честнее, чем называть совместимым документ с новым decor kind и manifest,
  который старый importer обязан отвергнуть.
- Точные имена helper/module/catalog storage и конкретный безопасный XML parser
  может изменить реализация после review, если поведение, bounds, доказательства
  и fail-closed контракт останутся теми же.
