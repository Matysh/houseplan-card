# ТЗ #431 — канонизация координат `kind: image`

Issue: [#431](https://github.com/Matysh/houseplan-card/issues/431)

Статус документа: ТЗ на ревью.

Источники контракта: [ТЗ #51](051-custom-decor-images.md),
[ТЗ #224](224-config-coordinate-canonicalization.md) и
[ТЗ #291](291-lattice-coordinate-write-barrier.md).

## Сценарий

Автор плана добавляет собственное изображение в редакторе Подложки, двигает,
масштабирует или поворачивает его и сохраняет конфигурацию. Позже он повторно
сохраняет план без геометрических изменений либо запускает «Оптимизировать
планы».

Сейчас `kind: image` проходит frontend- и backend-барьеры записи вне списка
box-декора. Незаметные хвосты чисел с плавающей точкой сохраняются, поэтому
повторный no-op жест или оптимизация способен снова дать технический diff и
лишнюю ревизию.

После исправления изображение следует тому же контракту `x/y/w/h/angle`, что
`rect`, `ellipse` и `furniture`: следующая штатная запись или Optimize приводит
его координаты к канонической форме, а повтор операции является no-op.

## Что человек увидит до и после

| Ситуация | Сейчас | После исправления |
|---|---|---|
| Сохранение изображения после drag/resize/rotate | План выглядит правильно, но в конфиг могут попасть шумовые float-координаты | Геометрия сохраняется канонически без визуального сдвига |
| Повторный no-op жест или Optimize | Может появиться ещё одно изменение/ревизия того же плана | Повторная операция не создаёт нового геометрического diff |
| Старый план с шумовыми координатами изображения | Шум остаётся после обычной записи | Нормализуется при следующей записи или явном Optimize |

Новых кнопок, сообщений, настроек и визуальных состояний нет.

## Подтверждённая причина

- `DecorKind` уже содержит `image`, а `DecorImage` использует box-поля
  `x/y/w/h/angle`.
- `src/coordinate-canonicalization.ts` не включает `image` ни в сбор значений
  для `latticeCanonicalizationReport()`, ни в реальную канонизацию config.
- `custom_components/houseplan/coordinate_canonicalization.py` содержит то же
  неполное зеркало.
- Общая fixture перечисляет остальные четыре вида декора, но не `image`, поэтому
  frontend и backend согласованно подтверждают один и тот же дефект.

## Скоуп

- включить `image` в box-контракт frontend-сбора статистики и канонизации;
- включить `image` в Python-зеркало канонизации;
- сделать полный набор box-видов явным и проверяемым, чтобы обходы не содержали
  независимые цепочки сравнений;
- расширить shared fixture и оба runtime-набора тестов;
- добавить отрицательные доказательства, что выпадение вида из frontend либо
  backend краснит соответствующий тест;
- уточнить compatibility-документацию и добавить парную changelog-запись.

## Не-скоуп

- изменение формата `DecorImage`, asset API, загрузки, рендера или редактора;
- новая миграция, повышение model/config/export version либо запись при чтении;
- изменение точности, порога lattice snap или формулы канонизации;
- рекурсивное округление неизвестных числовых полей;
- канонизация `opacity`, `width_cm`, `flip_h`, `flip_v`, `asset_id` или других
  presentation/content-полей;
- изменение поведения неизвестных и будущих `decor.kind` без отдельной
  классификации их геометрии.

## Контракт поведения

### 1. Каталог геометрических классов декора

Frontend имеет один runtime-каталог box-видов:

```text
rect · ellipse · furniture · image
```

Тип `DecorKind` обязан получать эти варианты из того же каталога, а не повторять
отдельный независимый список. Сбор статистики и фактическая канонизация используют
один predicate/каталог. Python объявляет точное зеркало box-набора.

Shared contract перечисляет ожидаемый box-набор. Frontend unit и backend test
сверяют с ним свои runtime-каталоги exact-set сравнением и прогоняют одинаковую
геометрию для каждого вида. Удаление одного вида из любого runtime-каталога либо
рассинхронизация shared contract обязаны дать красный тест.

### 2. Поля и числовой контракт

Для каждого box-вида, включая `image`:

- `x`, `y`, `w`, `h` проходят существующую lattice-канонизацию относительно
  `1/240` с действующим порогом;
- `angle` проходит существующую scalar-канонизацию до девяти десятичных знаков;
- near-node значения учитываются в `latticeCanonicalizationReport()` как
  `canonicalized`, а намеренно off-grid значения — как `far` без snap;
- повторная канонизация результата byte-equivalent и идемпотентна.

Все остальные поля image record сохраняются без изменений. Невалидные,
нечисловые и non-finite значения продолжают обрабатываться действующей схемой;
эта задача не меняет её политику валидации.

### 3. Пути записи и Optimize

Новые специальные writer-ветки не добавляются. Исправление действует через
существующие общие барьеры:

- frontend config candidate до `houseplan/config/set`;
- backend config schema и storage helper;
- предварительную и финальную канонизацию Optimize;
- сбор отчёта Optimize о lattice-изменениях.

Существующие route guards #291 остаются без изменений: задача исправляет полноту
данных внутри барьера, а не инвентарь writer-ов.

## Совместимость и миграция

- Новых полей и миграции нет; model/config/export versions не меняются.
- Старые конфиги читаются byte-for-byte как раньше. Image geometry становится
  канонической только при следующей штатной записи или явном Optimize.
- Уже канонические изображения не меняются.
- Старые версии House Plan продолжают читать результат как обычный
  `kind: image`; downgrade не требует обратной миграции.

## Touch, accessibility, i18n и производительность

- Touch/View/kiosk и доступность не меняются: жесты и рендер остаются прежними.
- Новых строк и ключей i18n нет.
- Новых обходов config нет. Четырёхэлементный membership-check заменяет текущую
  цепочку сравнений внутри уже существующих обходов; бюджеты производительности
  не меняются.
- Security/privacy и сетевые поверхности не затрагиваются.

## Затронутые файлы и модули

- `src/editors/decor/types.ts` — единый runtime box-каталог и производные типы;
- `src/coordinate-canonicalization.ts` — использование каталога при сборе и
  канонизации;
- `custom_components/houseplan/coordinate_canonicalization.py` — Python-зеркало;
- `test/fixtures/coordinate-canonicalization.json` — shared набор и image row;
- `test/coordinate-canonicalization.test.mjs` — frontend completeness,
  idempotency и preservation;
- `tests_backend/test_coordinate_canonicalization.py` — backend mirror и schema;
- `scripts/mutation-gate.mjs` — постоянный свидетель backend-защиты;
- `docs/CONFIG-COMPATIBILITY.md` — явный image box-контракт;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md` — release note;
- этот файл и `docs/specs/README.md` — трассируемость.

User Guide, i18n, screenshots/golden, smoke и performance fixtures не меняются.

## Критерии приёмки

- **AC1 — frontend image canonicalization (unit).** `image.x/y/w/h` получают
  тот же lattice-результат, а `image.angle` тот же scalar-результат, что
  эквивалентный `furniture`; immutable и in-place API дают одинаковый результат.
- **AC2 — отчёт и идемпотентность (unit).** Image near-node/off-grid значения
  правильно входят в `latticeCanonicalizationReport()`; повторная
  канонизация/Optimize не создаёт изменений.
- **AC3 — backend mirror (backend).** Python helper и `CONFIG_SCHEMA` дают для
  image record точный shared expected result и сохраняют его идемпотентно.
- **AC4 — полнота box-набора (unit + backend + mutation).** Runtime-каталоги TS
  и Python exact-set равны shared contract `rect/ellipse/furniture/image`, а
  каждый вид реально прогоняется через `x/y/w/h/angle`. Удаление `image` из TS
  краснит targeted unit; удаление из Python краснит targeted backend test через
  зарегистрированный mutation-gate witness.
- **AC5 — поля вне геометрии (unit + backend).** `asset_id`, `opacity`,
  `flip_h`, `flip_v` и неизвестное extension-поле переживают обе канонизации без
  изменений; неизвестный `decor.kind` не начинает округляться рекурсивно.
- **AC6 — совместимость (ревью кода).** Формула, пороги, версии, схемы данных,
  writer inventory, UI и i18n не меняются; действующие тесты #224/#248/#291
  остаются зелёными.
- **AC7 — документация и release (docs gate + ревью кода).** Compatibility doc
  называет `image` среди box-видов; оба changelog обновлены в том же
  `User-Visible: yes` implementation commit.
- **AC8 — гейты (commands + Linux CI).** Зелёные `npm run typecheck`,
  `npm test`, `npm run build`, targeted backend test и оба отрицательных
  свидетеля. Полный HA harness каноничен в Linux CI.

## План автотестов и таблица защитных свидетелей

1. Добавить в shared fixture `boxKinds` и representative `image` с шумом во
   всех пяти геометрических полях и отдельными полями, которые менять нельзя.
2. В frontend unit сравнить runtime-каталог с `boxKinds`, затем
   параметризованно проверить каждый вид и image preservation.
3. В backend test сравнить Python-зеркало с тем же `boxKinds`, проверить helper
   и `CONFIG_SCHEMA` на том же expected output.
4. Добавить Optimize/no-op проверку для image: первый прогон очищает измеримый
   шум, второй возвращает отсутствие persisted changes.
5. Выполнить отрицательные прогоны до передачи на код-ревью:

| Защитный AC | Чем доказан | Чем обязан краснеть |
|---|---|---|
| AC4 frontend completeness | targeted `coordinate-canonicalization` unit | удалить `image` из TS box-каталога → unit fail |
| AC4 backend completeness | targeted backend test | mutation-gate: удалить `image` из Python box-каталога → backend fail |
| AC5 allowlist boundary | unit + backend preservation cases | заменить box-ветку рекурсивным округлением/задеть extension field → preservation fail |

## Release-артефакты

- В `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` — парная запись: координаты
  пользовательских изображений теперь проходят общий стабильный барьер записи и
  не создают повторный технический diff.
- В `docs/CONFIG-COMPATIBILITY.md` — `image` явно включён в действующий
  `x/y/w/h/angle` box-контракт.
- Screenshots/golden и User Guide не обновляются: визуал и пользовательский поток
  не меняются.
- Release/version/tag не входят в задачу; issue остаётся открытой в S8 до беты.

## Риски

1. **Исправлен writer, но не отчёт.** Один predicate обязан использоваться обоими
   TS-обходами; AC2 проверяет счётчик Optimize.
2. **Frontend и backend снова расходятся одинаково незаметно.** Exact-set
   сравнение обоих runtime-каталогов с одной fixture и backend-мутант делают
   удаление наблюдаемым.
3. **Случайно канонизированы presentation/content-поля.** AC5 фиксирует
   allowlist и неизвестное extension-поле.
4. **Тест проверяет список, но не поведение.** AC4 требует прогнать каждый вид,
   а не ограничиваться сравнением строк каталога.

## Откат

Откат — revert implementation commit. Новых полей и миграций нет; уже
канонизированные image-координаты остаются валидными. Цена отката — возврат
floating-point шума для следующих записей изображений.

## Принятые предположения

- Box-геометрия определяется структурой `x/y/w/h/angle`; текущий полный набор —
  `rect`, `ellipse`, `furniture`, `image`.
- `angle` остаётся scalar, а не lattice-полем; `flip_h/flip_v` не кодируются
  отрицательными размерами и не канонизируются.
- Shared fixture является языконезависимым тестовым контрактом; продуктовый
  runtime не читает fixture с диска.
- Исправление считается пользовательским bugfix (`User-Visible: yes`), хотя
  визуальный кадр не меняется: оно устраняет наблюдаемые лишние сохранения и
  повторные Optimize-изменения.
