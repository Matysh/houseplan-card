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
| Проверенный текущий исходник | `001ffa9b3c7f67a95201b7815214d2470dfdf64b` |
| Digest установленного текущего кандидата | `3e6770d0a2ea3ed7a3cdc451bb837e18dc37d48d07734e16f0c022dd66c24745` |
| Fingerprint текущего frontend | `79c46894433b53fd5c69b0d7b350434e0e702d01b203476eedfe6c227ea486e4` |

SHA архива совпал с передачей; применимость patch была проверена до
интеграции. Прототиповые числа `309 tests` и нулевая разница его собственных
кадров — исторические результаты авторов пакета, не результаты текущего dev.

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

На `001ffa9…` пройдены native smoke: ordinary entry и все четыре off-centre
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
  --output="$RESULTS/native-camera001-results" --reporter=line
```

Результат на текущем кандидате: **2/2 PASS, 38.2 с** — обычная панель и
обычная Lovelace-карточка, четыре стороны, compression sin(40°), переход в
редактор, перезагрузка, отсутствие view-only writes и неизменность документов/
ревизий. Это свежая проверка camera-исправления.

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

На текущем `001ffa9…` обновлены все восемь кадров: 1480×1080, DPR 1,
fit/reduced motion, 35/125/215/305°, светлая и тёмная темы. Во всех кадрах
проверены отсутствие camera lab flag, пять volume-furniture ID, отсутствие
page errors и изменения fixture от просмотра. Галерея показала 60/60 ready,
все 60 исходных SVG вернулись HTTP200. Fingerprint установленного кандидата
и synthetic capture проверен на совпадение.

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
camera comparison/panel/card — к текущему кандидату.

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
