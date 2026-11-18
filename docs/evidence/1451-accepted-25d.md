# #1451 — приёмка переноса согласованного 2.5D

Авторский срез от 18.11.2026. Это результаты конкретной интеграции, а не
полный beta/stable/ночной прогон и не разрешение изменить golden. Итоговый
отчёт S6 общей очереди хранится отдельно. Дополнительных прогонов ради
подготовки этого документа не было.

## Материал и проверенный кандидат

Принятый пакет: [DEV-HANDOFF-ff45c3ef.zip](https://github.com/user-attachments/files/35034114/DEV-HANDOFF-ff45c3ef.zip),
комментарии [передачи](https://github.com/Matysh/houseplan-card/issues/1451#issuecomment-6981976657)
и [подтверждения](https://github.com/Matysh/houseplan-card/issues/1451#issuecomment-6982091082).

| Материал | Идентификатор |
| --- | --- |
| SHA-256 архива | `25849fcbf0652186f93143844fd7255d0a905aabfdd4fb05087d428b0605fe00` |
| SHA-256 `FILES.json` | `9376539b8b0457ab74f8af666bc596cf4a184989ead1ea7229457bd5c18fae39` |
| SHA-256 исходного patch | `1b4c1a475a28d3c6a1525e9d7a0b3fd13d41d1ab136d648540ebacff6bdd5e12` |
| База принятого прототипа | `09f5f5082ce065406e1d5d275255875e082c6d34` |
| Fingerprint принятого прототипа | `ff45c3efb16d6e9be13b79765b76ac901501cc8622a4318ef9a8189d62016c4b` |
| Исходник окончательной визуальной/native серии | `fac0ba5fe8df4a4c7b7a0bb809fc9b4932820c52` |
| Digest установленного текущего кандидата | `021b1fa6c3e321d6fb5b4df4f82e58ef482eb9084f417ab2452d2b7868def89c` |
| Fingerprint текущего frontend | `628cbd3a9c90bc951994d688ab0999cefa19a7f788ab1f9504fdd13a1566324c` |

SHA архива совпал с передачей; применимость patch была проверена до
интеграции. Прототиповые числа `309 tests` и нулевая разница его собственных
кадров — исторические результаты авторов пакета, не результаты текущего dev.

### Дополнительный ремонт экранной камеры

После основной серии отдельно проверено центрирование относительно summary
и screen profile. Найдены два связанных дефекта: quarter-turn центрирование
не передавало сжатие пола, а manual camera использовала fit предыдущей
проекции. После исправления native-проверка выявила ещё один переход:
provisional Flat bounds заменялись подготовленными без rebase камеры.
Исправлена смена basis в том же пространстве; собственный Flat geometry
owner отмечает уже выполненный rebase, чтобы не применять его дважды.

Последовательные адресные результаты ремонта (финальный проверенный
исходник — `9ba7f47df`; уже зелёные cases без изменения поведения не повторялись):

- `node --test --test-name-pattern='#1451' test/screen-camera.test.mjs` —
  2/2 PASS (`output/1451-screen-final-tests.log`), offsets справа/снизу,
  90°/270°, manual projection changes и same-plane resize.
- `node --test --test-name-pattern='provisional Flat fit' test/projection-view-camera.test.mjs`
  — 1/1 PASS (`output/1451-basis-change-unit.log`).
- Сборка с типами — PASS (`output/1451-basis-final-build.log`).
- `node demo/smoke_iso_flat_parity.mjs --screen-only --screen-90-only` —
  strict native PASS (`output/1451-projection-native-screen90-final.log`),
  fingerprint `f1a08fcd242bc609c8e8d45d9ded085b8ca158ae1eef01c5212625a19356ec60`.
  Offset 573.999995 px при ожидаемых 574; физический центр сохранён,
  CTM scale во всех ISO→Flat→ISO состояниях `1.1747070646155207`.

Это адресный ремонт, не повтор всех прежних зелёных серий. Вторая screen
ветка 270° ранее прошла на `108635e83`; после последнего общего изменения
обе ветки включены в обычный default smoke и обязательный S6. Исходник
визуальных PNG остаётся явно указанным выше: сравнение форм/материалов не
подменяется утверждением, что каждый кадр переснят после screen-only ремонта.

Первый запуск формального S6 остановлен исполнителем до реальных тестовых
кейсов ради этого ремонта; его 800 отменённых шагов не считаются PASS или
продуктовыми отказами. Синхронная проверка чистоты долго перебирала локальные
артефакты, и admission истёк. При следующем запуске временный
`core.excludesFile` исключает только `/output/` и `/.coverage` из списка
неотслеживаемых артефактов Git; файлы сохранены, tracked source, fingerprints
и состав тестов не исключены и не сокращены. Итог S6 фиксирует очередь.

## Что сохранено и что изменилось

- Камера 35°/40° и ещё три quarter-turn ракурса; сохранённые `PlanRotation`
  остаются 0/90/180/270. Физические размеры и якоря читаются из плана.
- Штатный `volumetric_view`, без DOM/URL-признака лаборатории, в том числе
  общий профиль main/worker. Редакторы и скрытые границы возвращают Flat;
  ошибки конструкции/volume имеют полный Flat fallback.
- Проёмы и 60 SVG-моделей используют согласованные формы и высоты. Для
  существующего `hinge: top` принятое 2.5D-изображение теперь наклоняется
  до 30° вокруг неподвижного нижнего края. Это изменение только визуального
  контракта: saved v1-поле, Flat и значения источников не мигрируются.
  Этот выбор явно отмечается владельцу до выпуска, как требует handoff.
- `workstation`/`workstation_tower_id` — необязательная typed same-floor 1:1
  связь только `desk`/`desk_corner` с существующим `computer`. Установка
  сохраняет мировой crop системника, снятие опирается на его текущую
  геометрию; операция и cleanup используют обычную историю и writer.
- Optional `furniture_workstation_api: 1` защищает три whole-document writer
  маршрута. Это не право записи и не новый обязательный handshake; старый
  клиент может менять координаты/стили без изменения связи, но не терять её.
- JSON full/space использует v4 **только при наличии workstation metadata**;
  прежний выбор 1/2/3 без неё сохранён, включая raw migration-source rollback.
  House ZIP уже был v4: только дополнительный
  `required_api.furniture_workstation_api: 1` условен. Извлечённый house JSON
  не принимается обычным JSON reader. Необязательные битые связи чинятся
  с вычисленным предупреждением, не снимая независимую privacy-проверку.
- Flat/PDF используют исходные top-view crops, не объёмную сетку. PDF не
  сжимает целый компьютер в box системника; clip следует трансформации и fit.
  Static card не расширена: она и раньше не выводила мебель.

## Фактические адресные проверки

Команды выполнялись в подготовленном WSL с Node 22.23.4 и проектным Python
окружением. `output/…` ниже — сохранённые локальные журналы исполнителя,
а не опубликованные ссылки на секретные лаборатории. Подготовка
`tsc -p tsconfig.test.json` / `node scripts/fix-test-build.mjs` и сборки
выполнялись корневым исполнителем отдельно, с журналами подготовки.

| Команда | Фактический результат / журнал |
| --- | --- |
| `node --test test/furniture-workstation.test.mjs test/projection-view-camera.test.mjs` | 8/8 PASS на первом профильном срезе; `output/1451-root-pure.log` |
| `node --test test/projection-view-camera.test.mjs` | 8/8 PASS после ремонта off-centre/узкого редактора; `output/1451-full-frame-camera.log` |
| `node --test test/pdf-workstation.test.mjs` | 5/5 PASS, включая настоящий pdfjs-разбор, clip scope/fit и отражения; `output/1451-pdf-workstation.log` |
| `python -m pytest tests_backend/test_furniture_workstation.py -q --show-capture=no` | Первый запуск: 26 PASS, 2 FAIL; `output/1451-workstation-python.log`. Это не полный зелёный запуск |
| `python -m pytest tests_backend/test_furniture_workstation.py -q --show-capture=no -k 'invalid_optional_json or common_writers'` | 4 PASS, 24 deselected после адресного исправления двух ожиданий; `output/1451-workstation-python-repair.log` |
| `python -m pytest tests_backend/test_furniture_workstation.py -q --show-capture=no -k migration_source` | Новый отдельный кейс PASS, 28 deselected; `output/1451-workstation-migration-source.log` |
| `python -m pytest tests_backend/test_house_document.py tests_backend/test_house_archive.py -q --show-capture=no` | 31 PASS; `output/1451-workstation-house-regression.log` |
| `python -m pytest tests_backend/test_validation.py -q --show-capture=no -k 'decor or scoped_candidate_equals_config_schema'` | 8 PASS, 239 deselected; `output/1451-workstation-validation-regression.log` |
| `node scripts/generate-furniture-volume.mjs --check` | 60/60 models current; источник и generated registry согласованы |
| `node --test test/furniture-volume-generator.test.mjs` | 4/4 PASS |
| `node --test test/furniture-volume.test.mjs test/furniture-volume-catalog.test.mjs test/iso-lab-furniture.test.mjs` | 19/19 PASS; 96 accepted mesh hashes и 1920 model/camera/mirror/aspect сочетаний внутри проверок |
| `node output/1451-handoff/unpacked/qa/opening-matrix.mjs` | 240 схем окон, 14 760 положений, 30 сочетаний штор, 144 случая дверей/ворот; `output/1451-opening-matrix.log` |

Два исходных Python-отказа были ошибками ожиданий теста: сравнение
с неканонизированными координатами вместо допустимого 9-decimal результата и
лишний `expected_layout_rev` без layout-изменения в тестовом config/set.
Исправления проверены адресно; успешные кейсы не выдаются за новый полный
запуск файла. После добавления migration-source проверки в новом backend
файле 29 уникальных кейсов покрыты успешными основными/адресными результатами,
но сумма повторных результатов не объявляется числом уникальных кейсов.

Тесты проверяют запрет старого клиента до хранения на config/set,
space/delete и optimize, отсутствие выдачи прав через capability, scoped
переназначение ID, версии/отказы reader, исправление ссылок и недоверие
к repair metadata файла. PDF-проверки не заменяют browser/HA проверку.

## Текущий native/camera срез

На первом профильном срезе `001ffa9…` пройдены native smoke: ordinary entry и все четыре off-centre
возврата View→Flat editor→View (`output/1451-projection-native-roundtrip-ctm.log`),
а также ordinary entry и все четыре hidden-border случая
(`output/1451-projection-native-hidden-camera.log`). Проверялись physical
centre/scale, попадание клика, Flat редактор и неизменность config/layout.
Прежние неудачные camera журналы сохранены и не считаются PASS.

Настоящие HA journeys находятся в companion
[issue #79](https://github.com/Matysh/houseplan-e2e/issues/79) /
[PR #80](https://github.com/Matysh/houseplan-e2e/pull/80), commit `e9b9171`:
`tests/isometric-product.admin.spec.mjs`. Это реальные публичные UI и ответы
backend, не private card methods, mock hass или перехваченные записи.

Среда: HA 2026.11.1, Playwright 1.63.0, Chromium 153.0.8010.12. Отдельный
loopback HA и синтетический план; личная HA-установка, исходный UI Lab,
приватный экспорт и данные авторизации не изменялись и сюда не включены.

Фактическая команда текущего camera-повтора из companion checkout
(путь результата показан переменной вместо приватного рабочего каталога):

```sh
npx playwright test tests/isometric-product.admin.spec.mjs --project=admin --no-deps \
  --grep='native 2.5D' --workers=1 --max-failures=1 \
  --output="$RESULTS/native-finalfac-results" --reporter=line
```

Результат на окончательном `fac0ba5…`: **2/2 PASS, 39.6 с**, без пропусков — обычная панель и
обычная Lovelace-карточка, четыре стороны, compression sin(40°), переход в
редактор, перезагрузка, отсутствие view-only writes и неизменность документов/
ревизий. Это свежая проверка всех исправлений камеры, включая принятие
измеренного pixel frame при холодном открытии и plane пассивного preview.
Предыдущие 2/2 PASS на `001ffa9…` (38.2 с) и `60f6eeb…` (34.5 с)
сохранены как история, не подменяют этот результат.

Ранее на `bf8dfb97e7d9b21c823c27cae74e1a642dd90faa` прошли реальные straight
и corner workstation journeys: установка одной записью, Undo/Redo,
перезагрузка, снятие/Undo и отказ viewer-записи. Связанный код после того
среза не менялся; эти зелёные journeys не повторялись. Первый corner запуск
остановился на запрещённом underscore в имени screenshot после продуктовых
assertions; после исправления только этот journey повторён с
`--no-deps --grep='native desk_corner workstation'` и прошёл (18.5 с).
Изначальный отказ сохранён в native-логах; это не скрытый зелёный результат.

## Визуальное сравнение и его границы

По явному решению владельца сравниваются восемь принятых PNG и
**синтетический**, а не отсутствующий private LOCAL-REFERENCE план.
Нулевая попиксельная разница разных сцен не требуется и не заявляется.

На окончательном `fac0ba5…` обновлены все восемь кадров: 1480×1080, DPR 1,
fit/reduced motion, 35/125/215/305°, светлая и тёмная темы. Во всех кадрах
проверены отсутствие camera lab flag, пять volume-furniture ID, отсутствие
page errors и изменения fixture от просмотра. Fingerprint установленного
кандидата и synthetic capture проверен на совпадение. Прежние зелёные
gallery60/60 и HTTP200 всех 60 SVG не повторялись: их входы не изменились.
После замены контрола цвета отдельно проверено реальное поведение общего
picker в галерее; это не повторная проверка моделей/маршрутов. Все восемь
PNG и обе контактные таблицы побайтно совпали с `60f6eeb…`: cache-camera
ремонт не изменил согласованный вид готовой сцены. Свежий native card
кадр и его SHA обновлены; panel кадр также совпал побайтно.

Просмотрены все восемь пар в двух contact sheets и full-resolution детали
light125° / dark305°. Ракурс, формы мебели, материалы, wall top/side и поднятые
проёмы соответствуют обработке принятого образца. Сохранённая геометрия,
цвета пола/фона, состояния проёмов/света, fit и подписи у синтетического плана
другие; это отличия входов, а не попиксельная эквивалентность. Высокая ближняя
стена закономерно перекрывает часть мебели; соседние стороны и галерея
покрывают её форму. Golden не обновлялись.

Публичные обезличенные изображения и пояснения:
[светлая тема](1451/comparison-light.png),
[тёмная тема](1451/comparison-dark.png),
[native panel](1451/native-panel.png), [native card](1451/native-card.png),
[straight reload](1451/native-desk-reload.png),
[corner reload](1451/native-corner-desk-reload.png).
Два workstation reload кадра относятся к указанному прежнему зелёному срезу;
camera comparison/panel/card — к окончательному `fac0ba5…` кандидату.

## Разбор полного S6 и адресное исправление отказов

Первый завершённый полный S6 (`20261118T185107912-9d66b84a`) на
`d7f65198e…`: materialClean=true, 800 шагов, 13 отказов. Это не принятие
кода. Все найденные отказы разобраны; повторный S6 перед ревью выполняет
общая очередь с применимым reuse, а не этот авторский отчёт.

| Отказ | Исправление и адресное подтверждение |
| --- | --- |
| Native color в новой галерее | Использован общий `hp-color-opacity`, отдельная прозрачность сохранена. Упавший case 1/1 PASS; одна gallery-сборка и реальное HEX→ОК, цвет desk/corner, opacity .35, фильтры/тема/Escape PASS, без page errors |
| CSS scope | Четыре helper-правила действительно ограничены ISO View. Lexer проверяет положительные классы одного stage, без исключений из сканирования: 18 probes и ранее упавший compiled case PASS |
| Coordinate write guard | Реальная граница payload вместо произвольных 260 символов. Обе CAS-ревизии и длинные capability metadata покрыты положительным/отрицательными контролями: TAP 2/2 PASS |
| Source readers / mutation gate / guard-name reader / offload | Обновлены 10 смещённых якорей и устаревшие контрактные фильтры, не восстановлены отменённые zero-yaw ожидания. 1790 определений проверены без исполнения; два anchor consumer и один name consumer PASS, текущий height/offload case PASS |
| Два ISO unit | Четыре affine-ракурса и inverse footprint вместо zero-yaw/screen-AABB предположений. Оба ранее упавших case PASS; legacy ×1.12 и floor-aligned ×1.0 остаются проверяемыми |
| Wall corpus / writer manifest | Добавлена только строка нового mesh JSON с configs=0; все 578 геометрических документов/baseline сохранены. Новый decor-only writer зарегистрирован с настоящим runtime/history witness: physical fields неизменны, wall-edit negative control работает. Оба упавших metadata case и новый witness PASS |
| Live touch | Старые identity/2D-symbol/raw-face-count ожидания заменены принятой математикой и physical membership. Исправлен сам fixture: canonical hosted стены 15 cm вместо void hosts, источник света вне тела стены. Все проверки PASS; реальные поверхности 156→149 при контакте, остальные слои/ID стабильны; два glow source и live color сохранены |
| Wall-node topology | Найден настоящий cold-camera дефект: frame [1,1] до mount принимался за pixels, последующая конверсия раздувала viewBox до 768480. `acceptedViewFrame` не принимает placeholder без live view/измеренного stage; тёплая доверенная камера сохраняется. Новый unit и исходный native сценарий без force PASS: 4 scenarios / 100 cycles / 112 writes, lifecycle/legacy проверки |

Точные локальные closure-журналы: `output/1451-coordinate-guard-repaired.log`,
`1451-mutation-anchors-repaired.log`, `1451-anchor-consumers-repaired.log`,
`1451-name-filter-consumer-repaired.log`, `1451-offload-current-profile.log`,
`1451-corpus-inventory-repaired.log`, `1451-writer-registration-repaired.log`,
`1451-s6-addressed-cold-affine-workstation.log`,
`1451-s6-workstation-history-witness.log`, `1451-s6-native-wall-repaired.log`,
`1451-s6-native-touch-final.log`. Локальные notes с точными gallery/native
argv и путями: `output/1451-gallery-repair-results.md`,
`output/1451-final-camera-native-results.md`.

Первый запуск нового runtime witness остановился из-за отсутствующего
`decorOrder.label` в unit host. Дополнен только fixture; повторён только
новый case, PASS. Coordinate unit дал зелёный TAP, но внешний shell wrapper
ошибся при чтении `$?`; это отдельно сохранено в
`output/1451-coordinate-guard-wrapper-note.md`, не выдано за чистый shell exit.
Перед native повтором guard корректно остановил оба сценария на старом
demo manifest до функциональных cases. Demo синхронизирован штатно;
`npm run bundle:sync` оказался алиасом с дополнительной сборкой — лишний
build зафиксирован, не скрыт как «sync без build». После синхронизации
строгие freshness guards включены и оба native сценария прошли.

Отдельная адресная валидация смыслового ремонта мутаций на `60f6eeb…`:

```sh
node scripts/mutation-gate.mjs --execute-nightly --id=<id>
```

Для `iso-floor-foreshortening-returns`, `iso-room-labels-lift-with-devices`,
`iso-opening-depth-orthographic-again`, `stage4-w1-camera-rotation-regresses`
каждый clean named guard PASS, затем заявленный тест обнаружил искажение,
caught 1/1, exit 0. Четыре отдельных detached workspace, не root dist;
журналы `output/1451-proof-<id>.log`. Это не полный ночной шард и не новый
обязательный гейт для остальных задач. Зелёные модели, реальные
workstation journeys и gallery routes без изменения входов не повторялись.

### Второй S6: готовность и камера пассивного превью

Второй завершённый S6 `20261118T195311402-750d819e` на `8b9044dff…`:
800 шагов, 158 зачтены повторно, три отказа. Это не положительное ревью.
Остальные первоначальные отказы закрыты; итог следующего S6 публикует очередь.

1. Новый stage6 unit передал scene literal мимо действующего typed-fixture
   gate. Объект объявлен `OverlaySceneFixture` без cast/ослабления validator,
   функциональные assertions неизменны. Повторён только упавший consumer:
   PASS, `output/1451-typed-fixture-repaired.log`.
2. При preview→full центр повторно ISO-проецировался: вычисленный результат
   совпал со смещением из лога с ошибкой `1.14e-13`. Единая presentation-plane
   authority теперь берёт проверенные projection/base/display/rotation
   реально нарисованного preview, а не отсутствие lazy geometry за Flat.
   Frame принимается только с измеренными pixels; depth использует ту же
   authority. Flat/no-borders и старая ещё видимая live-сцена при подготовке
   другого режима сохраняют свой смысл. Ключи/схема пакета не менялись.
   Три новых policy unit PASS (`output/1451-passive-preview-policy.log`).
   Исходный native с неизменённым 1 px oracle PASS на `fac0ba5…`:
   viewport до/после совпадает точно, максимум SVG delta `5.68e-14 px`,
   ISO builds=0, четыре quarter builds=[0,0,0,0], disk main producers=0,
   freshLight и запрет cache/device writes сохранены. Команда:
   `node demo/smoke_floor_persistent_cache_isometric.mjs`, журнал
   `output/1451-cache-preview-camera-native.log`.
3. Kiosk setting-off оказался гонкой ожидания теста, не терминальным
   ready-ISO состоянием продукта. После реального push revision 7 уже
   принята и setting=false, но public state=booting/cache=pending и старая
   ISO-сцена ещё удерживается. После bounded ожидания публичного ready
   именно текущего киоска state=ready/cache отсутствует и stage=Flat.
   Ожидание не зависит от желаемой проекции; прежние три результата и все
   остальные проверки сохранены. `node demo/smoke_isometric_live_touch.mjs`
   PASS всех 47 результатов, `output/1451-touch-kiosk-readiness-fac0.log`,
   подробности `output/1451-touch-kiosk-readiness-result.md`.

Подготовка этого ремонта сначала обнаружила пропущенный import planRotation;
он добавлен, свежие TypeScript/test-build и build прошли. Demo обновлён
прямым `node scripts/bundle-sync.mjs`, без повторной сборки из npm-алиаса.
Точные окончательные HA/capture команды и происхождение изображений:
`output/1451-final-preview-camera-results.md`; исторический
`output/1451-final-camera-native-results.md` для `60f6eeb…` сохранён.

### Третий S6: изолированный host пассивной камеры

Третий завершённый S6 `20261118T203048023-ac6c2def` на
`a11073ebf2f8c89433196c51adb8a2a06f2a3536`: materialClean=true,
800 шагов, 446 зачтены, 799 успешных и один отказ. Новых продуктовых
отказов нет: source-extracted unit `_syncFloorPreviewCamera` не предоставил
своему host новые `_presentedViewPlane` / `_adoptViewPlane` зависимости.
Остальные первоначальные и повторные отказы прошли общий S6.

Исправлен только host этого unit: явная плоскость 125°/40°, принятие камеры
до чтения и записи SVG, отсутствие повторной записи для той же камеры.
Refit, live/config writes и requestUpdate запрещены явными assertions.
Это не no-op adoption и не изменение настоящей математики камеры.
Повторён только упавший case:

```sh
node --test --test-name-pattern='passive SVG follows an adopted camera' test/floor-cache-publication.test.mjs
```

1/1 PASS, `output/1451-publication-preview-fixture-repaired.log`.
Продуктовые исходники, native oracle 1 px, кандидат, изображения и эталоны
не менялись. Повторных build/HA/gallery/capture/mutation прогонов для
этого ремонта нет; окончательный S6 и передачу на ревью фиксирует очередь.

## Привязка к AC и оставшиеся ограничения

| AC | Подтверждение и граница |
| --- | --- |
| 1, 2, 14 | Текущие native panel/card 2/2; четыре off-centre и четыре hidden-border smoke; camera unit 8/8. Kiosk сохраняет тот же renderer; эти два настоящих HA journey не изображаются отдельным kiosk-тестом |
| 3, 5 | Профильные opening/shade matrices, geometry/refinement тесты, сравнение восьми кадров. `hinge: top` визуально 30° с неподвижным низом, без data migration |
| 4 | 60 current SVG, generator 4/4, furniture 19/19, gallery 60/60; не второй сохраняемый mesh |
| 6, 11, 12 | Depth/outline/scene/loader/cache профиль и fault-проверки; финальные объём и перечень — в S6 отчёте. Одни screenshot-пары не доказывают все состояния/клики |
| 7 | Workstation helper/backend cases и прежние genuine straight/corner mount/history/reload/ACL journeys |
| 8, 9, 10 | Copy/remap/repair/privacy/reader-version и три old-client writer барьера; JSON4 условен, house v4 уже существовал; metadata ремонта вычислена сервером |
| 13 | Текущие восемь synthetic кадров и предметное сравнение, без exact-pixel/same-scene утверждения |
| 15 | Исходный manifest, этот отчёт, актуальные продуктовые контракты и итоговый S6 отдельно; автоматического принятия golden или выпуска версии нет |

Не добавлялись свободная камера, 3D-редактор, новые семейства столов,
самостоятельная оптимизация кэша или собственные падающие тени полотен I-08.
Этот срез не доказывает все произвольные исторические геометрии, все
положения мебели или полный релизный набор. Публикация версии и принятие
новых product golden остаются отдельными решениями владельца.
