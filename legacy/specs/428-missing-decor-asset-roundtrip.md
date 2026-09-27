# ТЗ #428 — round-trip экспорта с отсутствующей картинкой декора

Issue: [#428](https://github.com/Matysh/houseplan-card/issues/428)

Статус документа: ТЗ на ревью.

Источник контракта: [ТЗ #51](051-custom-decor-images.md), раздел
«Import/export и совместимость», AC10 и AC11.

## Сценарий

1. В конфигурации пространства сохранён `decor`-объект `kind: image` с
   корректным 64-символьным SHA-256 `asset_id`.
2. Соответствующего blob и metadata sidecar уже нет в
   `<config>/houseplan/assets/`.
3. Пользователь экспортирует полный дом, одно пространство либо только
   планировку, а затем пытается импортировать полученный JSON.

Сейчас exporter честно записывает для объекта `exists_at_export: false` и
`mime: null`, но importer требует MIME из белого списка для любой строки
`decor_asset`. Поэтому House Plan отклоняет весь собственный экспорт как
`invalid_content`, хотя #51 определяет missing asset как легальное,
восстанавливаемое состояние.

После исправления документ проходит preview, сообщает об отсутствующем файле,
требует действующее явное подтверждение и сохраняет image-объект вместе с его
геометрией как repair-placeholder. Остальной импорт не меняется.

## Что человек увидит до и после

| Состояние | Сейчас | После исправления |
|---|---|---|
| Файл картинки отсутствовал уже при экспорте | Импорт всего JSON завершается ошибкой | Preview открывается, показывает missing content и требует подтверждение |
| Пользователь подтверждает импорт без файла | До подтверждения невозможно дойти | Объект и его геометрия сохраняются; во View не рисуется, в Background editor доступен для замены |
| Файл с тем же exact hash уже есть на целевой системе | Документ всё равно отклоняется из-за `mime: null` | Локальный blob проверяется по SHA-256 и переиспользуется как `available` |

Нового диалога, текста ошибки или элемента управления нет.

## Подтверждённая причина

- `custom_components/houseplan/import_export.py::content_manifest()` получает
  MIME из metadata sidecar либо расширения найденного blob. Если оба файла
  отсутствуют, результат — `None`; флаг `exists_at_export` при этом равен
  `False`.
- `_content_state()` повторно строит ожидаемые ссылки из payload, но затем
  безусловно требует у supplied `decor_asset` MIME из множества
  `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml`.
- `test_issue_51_missing_decor_asset_stays_as_repairable_geometry` покрывает
  только соседний случай: blob был у источника и потому MIME был известен, но
  blob отсутствует на target.

## Скоуп

- ограниченно скорректировать валидацию `decor_asset` в `_content_state()`;
- сохранить строгую сверку manifest с image-ссылками, заново выведенными из
  payload;
- покрыть настоящий round-trip «export при отсутствующем blob/sidecar → import
  preview» и отрицательную матрицу manifest;
- уточнить контракт missing decor asset в `docs/CONFIG-COMPATIBILITY.md`,
  `docs/USER-GUIDE.md` и `docs/USER-GUIDE.ru.md`;
- добавить пользовательскую запись в оба changelog.

## Не-скоуп

- встраивание blob/base64 в JSON;
- восстановление, загрузка, перенос или автоматическое удаление asset-файлов;
- угадывание MIME из `asset_id`: content-addressed id не содержит расширение;
- изменение формата export, `EXPORT_FORMAT_VERSION`, config/model schema либо
  storage layout;
- изменение UI подтверждения, placeholder, счётчиков preview, delete/replace,
  full/space/plan-only projection или политики внешних файлов;
- ослабление проверки любых manifest-строк, кроме строго описанного ниже
  missing `decor_asset`.

## Контракт manifest и валидации

### 1. Канонический экспорт

Exporter продолжает выдавать одну extension-neutral строку `decor_asset` на
каждый image record. Поля `asset_id` и `hash` равны canonical lowercase SHA-256,
`exists_at_export` всегда имеет настоящий тип `bool`.

- Если verified source blob существует, `exists_at_export` равно `true`, а
  `mime` обязательно входит в поддерживаемый белый список.
- Если verified source blob отсутствует либо не проходит exact hash,
  `exists_at_export` равно `false`. `mime` может быть поддерживаемой строкой,
  когда её сохранил валидный metadata sidecar, либо JSON `null`, когда MIME
  достоверно неизвестен.

Exporter не восстанавливает MIME эвристикой и не добавляет bytes.

### 2. Допустимые строки при импорте

До определения локального состояния target importer проверяет supplied
`decor_asset` по следующей матрице:

| `exists_at_export` | `mime` | Результат |
|---|---|---|
| literal `true` | поддерживаемая строка | допустимо |
| literal `true` | отсутствует, `null` или неподдерживаемая строка | `ImportFailure("invalid_content")` |
| literal `false` | поддерживаемая строка | допустимо |
| literal `false` | отсутствует или `null` | допустимо: это исправляемый missing asset |
| literal `false` | любая неподдерживаемая строка, включая `""`, либо значение другого типа | `ImportFailure("invalid_content")` |
| поле отсутствует, `null`, `0`, `1`, строка, объект или массив | любое | `ImportFailure("invalid_content")` |

Во всех допустимых строках остаются обязательными:

- exact equality supplied `asset_id` и `hash` с SHA-256, выведенным из payload;
- exact identity строки (`kind`, `owner`, `owner_id`, `field`, `url`) и отсутствие
  лишних/дублированных/пропущенных строк;
- повторная проверка target blob чтением bytes и сравнением SHA-256.

Поддерживаемый MIME — только `image/png`, `image/jpeg`, `image/webp` или
`image/svg+xml`. Неподдерживаемый указанный MIME нельзя маскировать
`exists_at_export: false`.

### 3. Локальное состояние target

Источник не определяет доступность на целевой системе:

- target blob с exact hash → `state: available`, `exists_on_target: true`,
  отдельное подтверждение для этой строки не требуется;
- target blob отсутствует, нечитаем или hash не совпадает →
  `state: missing_preserved`, `exists_on_target: false`, общий preview получает
  `confirmation_required: true`;
- после подтверждения `_detach_missing()` не удаляет image record: `asset_id`,
  geometry, opacity, flips и decor order сохраняются по контракту #51.

Значение `exists_at_export` в нормализованной preview-строке остаётся значением
из supplied manifest. `mime: null` не превращается в MIME найденного либо
предполагаемого файла и не становится authority.

## Совместимость и миграция

- Миграции config/model/storage нет.
- Номер export format не меняется: исправленный importer принимает ранее
  сгенерированный самим House Plan v2 документ, который уже соответствовал
  заявленному контракту `exists_at_export: false`.
- Все документы, которые принимались раньше, продолжают приниматься.
- Старый importer может по-прежнему отвергнуть такой JSON; исправление не может
  сделать уже установленную старую версию совместимой вперёд.
- Отсутствующий `exists_at_export` не трактуется как legacy default: exporter
  v2 всегда записывает поле, а fail-closed поведение защищает границу доверия.

## Безопасность и privacy

Manifest остаётся описательным, не авторитетным. Payload определяет полный набор
ссылок, а target bytes — фактическую доступность. Исключение для отсутствующего
MIME связано одновременно с exact image identity и literal false; оно не даёт
подсунуть внешний URL, пропустить ссылку, объявить другой hash/MIME или обойти
проверку файла. Новых данных в export и новых путей к файловой системе нет.

## Touch, accessibility, i18n и производительность

- Touch/View/kiosk не меняются: это backend round-trip до существующего preview.
- Новых текстов и ключей i18n нет; используются действующие missing-content
  confirmation и repair-placeholder.
- На каждый asset остаются тот же один bounded поиск кандидатов и, при наличии
  blob, один SHA-256 проход. Новых обходов, сетевых запросов и frontend bundle
  кода нет; performance budgets не меняются.

## Затронутые файлы и модули

- `custom_components/houseplan/import_export.py` — bounded validation
  `decor_asset` в `_content_state()`, полная image-проекция plan-only и её
  ограниченный manifest allowlist;
- `tests_backend/test_ha_import_export.py` — положительный round-trip и
  отрицательная матрица;
- `docs/CONFIG-COMPATIBILITY.md` — точное значение missing MIME;
- `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md` — пользовательское правило
  повторного экспорта/import missing image;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md` — release note;
- этот файл и `docs/specs/README.md` — трассируемость ТЗ.

Frontend `src/**`, i18n JSON, version files, screenshots/golden и workflow не
затрагиваются.

## Критерии приёмки

- **AC1 — настоящий missing round-trip (backend).** Full export, созданный при
  отсутствии blob и sidecar, содержит `exists_at_export: false, mime: null`;
  его import preview не падает, выдаёт `missing_preserved` и требует
  подтверждение.
- **AC2 — сохранение объекта (backend).** После подтверждённой подготовки
  импорта image record сохраняет exact `asset_id`, geometry, opacity, flip flags
  и decor order; `_detach_missing()` его не удаляет.
- **AC3 — три режима экспорта (backend).** Общая validation path доказана для
  full, single-space и plan-only export: missing image row во всех режимах
  импортируема по одному контракту, а projection/privacy каждого режима не
  меняются.
- **AC4 — target reuse (backend).** Для строки
  `exists_at_export: false, mime: null` existing target blob переиспользуется
  только после exact SHA-256 проверки и получает `available` без ложного
  missing confirmation.
- **AC5 — fail-closed MIME/flag (backend).** Параметризованный отрицательный
  тест доказывает матрицу: null/omitted MIME допустим только при literal false;
  unsupported non-null MIME отклоняется и при false; отсутствующий и любой
  не-bool `exists_at_export` отклоняются.
- **AC6 — identity invariants (backend).** Mismatched `asset_id`/`hash`, лишняя,
  пропущенная или дублированная manifest row по-прежнему дают
  `invalid_content`; существующее покрытие остаётся зелёным.
- **AC7 — совместимость (backend + ревью кода).** Ранее допустимые строки
  `exists_at_export: true` с поддерживаемым MIME и `false` с поддерживаемым MIME
  не меняют результат; config/model/export version не повышается.
- **AC8 — документация и release (docs gate + ревью кода).** Оба User Guide и
  compatibility doc описывают импортируемый missing round-trip; оба changelog
  обновлены в том же `User-Visible: yes` implementation commit.
- **AC9 — гейты (commands + Linux CI).** В цикле реализации зелёные
  `npm run typecheck`, `npm test`, `npm run build` и targeted backend tests;
  полный HA harness остаётся каноническим Linux CI. Golden, smoke и performance
  не требуются до команды на бету, поскольку визуальный/frontend output не
  меняется.

## План автотестов

1. Добавить helper fixture с image record и отсутствующим source asset.
2. Параметризовать `kind=full`, `kind=space` и plan-only variant; создавать
   документ через `create_export()`, не конструировать только вручную.
3. Для полного пути пропустить JSON через `create_preview()` на отдельном
   пустом target root и проверить content state, confirmation и сохранённый
   candidate payload.
4. Создать exact target blob без sidecar и доказать `available`; затем заменить
   bytes и доказать `missing_preserved`.
5. Параметризовать `exists_at_export` и `mime` по таблице, включая Python
   `False` отдельно от `0`, потому что `bool` — подкласс `int`.
6. Не заменять существующий тест #51: он остаётся регрессией для known MIME при
   missing target.

## Release-артефакты

- В `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` — одна парная запись о том,
  что повторно экспортированный план с отсутствующей пользовательской картинкой
  снова импортируется с подтверждением и без потери объекта.
- В обоих User Guide — короткое уточнение рядом с missing image/import rules.
- В `docs/CONFIG-COMPATIBILITY.md` — нормативная truth table в компактной форме.
- Screenshots/golden не обновляются: видимый рендер и UI не меняются.
- Release/version/tag не входят в задачу; issue остаётся открытой в S8 до беты.

## Риски

1. **Слишком широкое ослабление manifest.** Снимается точной проверкой
   `type(exists_at_export) is bool`, белым списком непустого MIME и неизменной
   exact identity/hash validation.
2. **Python принимает `0` как `False`.** Проверка должна быть по типу и identity,
   а тест содержит `0` и `1` как отрицательные значения.
3. **Source metadata становится authority.** Нельзя использовать supplied MIME
   или availability для выбора target файла; target hash проверяется как раньше.
4. **Проверен helper, но не настоящий export/import.** AC1 и AC3 требуют
   документы от `create_export()` и хотя бы один путь через `create_preview()`.

## Откат

Откат — revert implementation commit: importer снова потребует supported MIME
у каждой строки `decor_asset`. Данных и миграций откатывать не нужно; уже
импортированные image records остаются валидными по схеме #51. Цена отката —
возврат исходной невозможности импортировать собственный export с missing asset.

## Принятые предположения

- `exists_at_export: false` означает только подтверждённое exporter-ом отсутствие
  verified source blob; оно не обещает отсутствие exact blob на target.
- `mime: null` — единственное корректное представление неизвестного MIME,
  которое пишет текущий exporter; отсутствие ключа принимается эквивалентно
  только в той же строго missing-ветке для устойчивости JSON producers.
- Восстановимый MIME нельзя получить из SHA-256 `asset_id` без blob/sidecar,
  поэтому исправляется importer, а не вводится недостоверное значение exporter-а.
