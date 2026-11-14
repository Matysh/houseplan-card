# Обработка недоверенных планов: аудит #1395

Дата: 14.11.2026. База: `3c29bb9c7c6a8626a472c7d978f32963c704cc8a`
(выделенное ядро #1391). Это отчёт об ограниченной проверке и адресном ремонте,
**не сертификат безопасности будущего анонимного сервиса**. Живой HA владельца,
его файлы, URL из payload и внешний renderer не использовались.

## Потребители и границы

1. Аутентифицированная интеграция HA: существующие ACL, файловые квоты,
   транзакции и лимиты сохраняются. Strict-профиль не включается в Store,
   старт, обычное сохранение или чтение старого бэкапа.
2. Будущий недоверенный caller: обязан явно окружить **весь запрос**
   `with input_scope(STRICT_INPUT_POLICY): ...`. Вложенный вызов наследует
   бюджет; заменить/сбросить его другой политикой нельзя. Policy не сериализуется
   и не расширяет безусловные пределы.

`input_policy` — чистый модуль: нет HA, сети, файлового ввода или создания
thread/process. ContextVar переносит один бюджет через вложенные синхронные
вызовы. При передаче работы в собственный executor будущий адаптер обязан
перенести context либо открыть scope непосредственно внутри worker. Один scope
в родительской coroutine не является доказательством ограничения чужого thread.

## Находки и решения

### F1 — Medium: неконтролируемая глубокая копия переносимого JSON — исправлено

В Python 3.14 decoder принимает глубоко вложенное неизвестное поле
`config.extra`; следующий `opening_repair` →
`coordinate_canonicalization.copy.deepcopy` выбрасывал `RecursionError` наружу.
Валидный envelope с 1500 уровнями занимал всего 3496 bytes, с 10000 — 20496.
Это отказ операции, не доказательство изменения сохранённого плана.

Теперь HA получает `ImportFailure(invalid_config)` без нового depth64-запрета:
прежний depth65 принимается. Strict сначала линейно сканирует bytes, до
`json.loads` и выделения дерева, и возвращает `capacity_exceeded`.
Сканер считает контейнеры, скаляры и object keys; скобки/escape внутри строк
инертны. Синтаксис, дубликаты и запрет prototype keys остаются у decoder.
Strict scanner принимает только UTF-8: raw NUL отклоняется до decoder,
исключая UTF-16/32 autodetection. Экранированный U+0000 остаётся обычными
UTF-8 bytes. Без strict bounds HA сохраняет прежние кодировки ZIP JSON.

Доказательства: `test_ha_deep_copy_failure_is_a_domain_error_without_new_depth64_cap`,
`test_depth_guard_runs_before_the_json_decoder_and_preserves_source`, реальный
HTTP preview в `tests_backend/test_ha_input_security.py`: прежние config/layout,
ревизии, lock и preview-сессии неизменны, следующий корректный preview работает.

### F2 — Medium: EOCD count не доказывал фактическое число ZIP entries — исправлено

До `ZipFile` проверялось заявленное число записей <=1600 и central directory
<=2 MiB, но фактический directory мог содержать больше записей. Это оставляло
лишние `ZipInfo` allocations до поздней проверки `infolist`; абсолютный 2-MiB
предел уже ограничивал масштаб, поэтому не заявляется безграничная ZIP bomb.

Теперь ограниченный central directory разбирается до `ZipFile`: сигнатуры,
переменные длины, фактический count <=1600 и равенство EOCD. Оба случая
«заявлена1, фактически2/1601» воспроизводились красными тестами до ремонта;
spy запрещает сам вход в `ZipFile`, поэтому тест проверяет порядок allocation.
Валидный сосед продолжает импортироваться.

### F3 — Low: overflow JSON exponent обходил parse_constant — исправлено

`1e999`/`-1e999` превращаются в бесконечность через `parse_float`, не через
`parse_constant`. Два отрицательных теста до правки принимали эти значения.
Один `finite_json_float` теперь используется direct import, ZIP JSON и
structural upload; корректное конечное `1e100` разрешено. Формат/модель не меняются.

### F4 — Medium: detail исключения попадал в protocol message — исправлено

WS import/export и HTTP portable preview использовали `ImportFailure.message`,
куда могли попасть детали decoder/schema/файлового отказа. Probe с искусственным
`/PRIVATE-FIXTURE/path TOKEN=PRIVATE-FIXTURE` показывал reflection=true до и false
после. Это демонстрация канала, не утверждение утечки настоящего секрета.

`public_message` возвращает стабильный существующий код; локальный `.message`
сохранён для диагностики, но не отправляется автоматически клиенту/support.
ZIP HTTP уже использовал код. Новых кодов/переводов нет: `invalid_json`,
`invalid_config`, `invalid_format`, `capacity_exceeded`, `zip_limit`,
`zip_cancelled`, `not_ready` уже есть в каноническом каталоге ошибок/локалях.

### F5 — High для будущего анонимного caller: нет request-wide resource policy — закрыто в ядре

Синтаксические counters не исключали квадратичную геометрию: 50/100/200/400
параллельных partitions дают 1225/4950/19900/79800 intersection calls.
В строгом профиле добавлены общие 2M work units и вторичные5s monotonic;
charge выполняется до exact predicates, legacy numeric geometry, AABB query
и отдельных migration dependency/room/opening inner loops. Проверка отмены/
времени при первом unit и не реже следующих256; повторная валидация, миграция
и следующий этаж не получают новый бюджет. Bit-limit4096 не ослаблен.
Дополнительная сверка rejected branches нашла два пропуска: zero-thickness
carrier возвращал False до числового предиката, а reservation overlap сканировал
occupied без charge. Оба адресных теста были красными и исправлены: теперь
charge идёт до early refusal/каждой пары. Сканы соседних openings и repair
intervals также считают каждый элемент, в том числе несовпадающий host.

Покрытие не объявляется preemptive CPU/memory isolation: сортировка, JSON/XML/PIL
library call и отдельная большая bigint-операция не могут прерываться посередине.
Конечные bytes/counters ограничивают их вход; checkpoint проверяет до/после.
Будущему серверу всё равно нужны отдельный worker с жёстким лимитом памяти/CPU,
конкурентные квоты, rate limits и перенос cancellation context. Без этого
анонимный endpoint нельзя считать готовым. В HA новые strict ceilings не включены.

### F6 — Medium для strict caller без декодера: raster header-only fallback — исправлено

HA сохраняет прежний fallback без Pillow. Strict при недоступном decoder
возвращает `not_ready`, а не принимает один заголовок. Pillow является
зависимостью подготовленного runtime; факт полного decode проверяется в
`decor_assets.validate_asset`. Тест выключает import Pillow и различает оба
профиля. Это не замена sandbox для native image decoder.

### F7 — High: обход нового pre-scan через UTF-16/32 — исправлено после ревью

Первое code review установило расхождение: `strict_json` сохранял auto-detect
`json.loads(bytes)`, а scanner понимал ASCII bytes. Экранированная кавычка
UTF-16/32 переворачивала учёт строки и скрывала последующую вложенность.
До ремонта восемь fixtures (LE/BE,16/32bit, с/без BOM) достигали запрещённого
spy-decoder вместо раннего отказа. Теперь raw NUL в strict scan даёт
`invalid_json`, reason=`json_encoding`, до `json.loads`. HA без strict bounds
сохранён: настоящий ZIP с UTF-16/32 manifest принимается HA, но отклоняется
strict до staging write. UTF-8 имеет положительного соседа.

После замечания о SVG исправлен и каталог:8MiB — предел исходных bytes
строгой подложки, **не обещание допуска8MiB SVG-геометрии**. Она также проходит
прежние decor content caps, включая canonical output2MiB; whitelist не расширен.
Для HA-допустимого содержимого, запрещённого strict, caller получает
`capacity_exceeded`, reason=`strict_image_policy`, вместо неразличимого общего
invalid_image. Отсутствующий raster decoder по-прежнему даёт not_ready.
Reason сохраняется в доменной ошибке архива, не автоматически в HA protocol.

Подтверждённых открытых High в исследованном scope нет. Остаточные ограничения
F5 относятся к реализации будущего сервиса, не объявлены выполненными здесь.

## Каталог лимитов и enforcement

| Ввод / ресурс | HA | Явный strict | Фактический владелец |
|---|---|---|---|
| Portable JSON / config |32/16 MiB|те же|`import_export.parse_document`, config schema/Store|
| ZIP / expanded total |2/2 GiB|256/512 MiB|`backup_archive._check_directory`, `expanded_size`, streaming `read`|
| Central directory / entries |2 MiB/1600 actual|те же|pre-ZipFile header walk + `_validate_info`|
| Manifest / plan / decor / attachment input bytes |2/8/2/50 MiB|те же внешние ceilings; ниже дополнительные content caps|descriptors, actual bytes, typed image validation|
| Structural payload / staged total |32/64 MiB|те же + JSON bounds|`structural_upload.parse_payload`, manager append|
| JSON depth / nodes |нет нового cap; безопасный отказ recursion|UTF-8 only,64/1,000,000|bytes pre-scan; keys + scalar/container values|
| JSON суммарные строки |ограничены JSON bytes; имена500 chars|то же|bytes/schema, не новый отдельный string-tree allocator|
| XML depth |decor64; backdrop XML opaque|64 + decor whitelist для backdrop|Expat до ElementTree, затем прежняя SVG validation|
| Raster dimensions / pixels |decor16384 /33,554,432; backdrop только signature+8MiB, без pixel cap|decor и backdrop16384 /33,554,432, decoder обязателен|decor header bounds + Pillow decode; отдельный HA backdrop rule|
| Decor SVG / strict backdrop content caps |decor: canonical output2MiB,5000elements,512000attrs chars,ref depth64; HA backdrop эти caps не получает|те же decor caps, в том числе для backdrop|reject whitelist; single attr65536chars; dimensions/pixels как у decor|
| Graph nodes/edges / rooms |404000/202000 /400 per space|не выше HA|`validate_graph`, 200000 walls/2000 partitions, room cycle<=500|
| Exact numeric intermediates |4096bits|то же|`plan_graph_exact.integer`/rational operations|
| Geometry budget / time |нет нового cap|2,000,000units /5s|один `input_scope`, не timeout продолжающегося thread|
| Stored plans |256 MiB/200files|не повышается|`backup_files.check_quotas` / existing file adapter|
| Stored attachments |1 GiB/1000files|не повышается|тот же quota owner|
| Stored decor |256 MiB/200files|не повышается|тот же quota owner|
| Free disk reserve |512 MiB|не понижается|существующая проверка места перед публикацией|

Слишком высокий compression ratio сам по себе не запрещает хороший файл:
малый highly-compressed валидный JSON имеет положительный тест. Actual expanded
bytes/per-file limits важнее ratio. Поддельный streaming reader отдельно проверяет
actual-vs-declared enforcement; это инструментированный reader, **не** заявление
о найденном обходе настоящего Python ZIP decoder.

## Просмотренные владельцы и границы анализа

| Модули | Что проверено / результат |
|---|---|
| `validation`, `import_export`, migration/repair |detached candidate, строгие keys/nonfinite, config16MiB, unknown metadata; F1/F3/F4 исправлены, модель11/exportv3 неизменны|
| `backup_archive` |preallocation F2, допустимые имена/types/methods, CRC/hash/truncation, actual/aggregate bytes; ZIP имена не задают staging paths, только `blob-{index}`|
| `backup_files`, `file_usage` |no-follow directory traversal, own-session marker, server-chosen destinations, quotas, idempotent publish/rollback; ACL и transaction journal остаются в HA adapter|
| `structural_upload` |owner/revision/digest/one-shot lease, 32/64MiB, отмена; прямой parser теперь тоже проверяет bytes до decode|
| `decor_assets` |signatures/pixels/full decode, SVG DTD/PI/entities/events/script/foreignObject/external/data/CSS URL reject; strict F6, старый whitelist не расширен|
| `asset_integrity` |stream hash, bounded256 LRU, file-signature/single-flight; внутренний путь обязан дать проверенный caller, API не принимает pathname из JSON|
| `plan_graph*`, `graph_write` |counts/exact4096bits, cycles/intersections/projection, detached migration, F5 budget; graph patch/baseline не становятся authority client-а|
| `wall_node_*`, `wall_segment_model`, coordinate migrations |числовые shared predicates и legacy pairs под тем же budget; copy/commit/refusal invariants сохраняются, rounding/битность не менялись|
| HA HTTP/WS/backup runtime |safe messages, private staging, cancellation/lock release и пара durable stores — существующие реальные HA regression fixtures, не mock доказательство ACL|

### Два SVG назначения — намеренно разные

Decor всегда whitelist. HA backdrop сохраняет #1033: opaque XML без internal
DTD/entity expansion, исходные Sweet Home3D/LibreOffice bytes и ZIP round-trip;
обычный внешний DOCTYPE допускается, но сервер его не загружает. Script/data:/
foreignObject внутри старой подложки не переименованы в «safe SVG content»:
их обезвреживает image context и отдача `CSP: sandbox` + `nosniff`.
Реальный HA тест `test_uploaded_svg_is_sandboxed_and_a_pdf_is_not` защищает headers.
Future strict backdrop использует тот же decor whitelist и content caps как
**reject**, не sanitizer: bytes/hash не переписываются.3-MiB comment-fixture
подтверждает только round-trip оригинальных bytes: комментарий не входит в
canonical SVG и не доказывает допуск3MiB геометрии.3-MiB `desc`-fixture
отвергается strict по более раннему ограничению текста (`strict_image_policy`), но
остаётся допустимой HA-подложкой.5000элементов/512000атрибутных символов также
могут ограничить strict раньше8MiB.

Strict SVG не допускает элемент `<text>`; текст внутри `title`/`desc` ограничен
4096 символами. Поэтому большой `desc` не является доказательством достижения
предела canonical output2MiB. Измеренный full import10×400 комнат расходует
около43% unit budget и85% времени5s: на больших обычных импортах первым может
сработать именно cooperative deadline, а не лимит геометрических операций.

### Файлы, отмена, атомарность

Core reader не публикует данные и не владеет завершением HA-session. Открывшийся
output закрывается в finally, а HA adapter дожидается файлового worker прежде,
чем удалять положительно опознанный own staging и отпускать lock. Регрессии
`test_ha_backup_archive.py`, `test_ha_import_export.py`, `test_ha_structural_upload.py`
проверяют preview/apply/cancel/conflict/durability; новые malicious ZIP fixtures
проверяют пустой staging для ранних отказов и неизменность source archive.
Не делается blanket-delete неизвестных директорий или пользовательских файлов.

## Фактические измерения

Ubuntu24.04 WSL2, Python3.14.7, kernel6.18.33.2-microsoft-standard-WSL2.
`scripts/security/input_capacity.py`: отдельный subprocess, внешний watchdog12s;
генерация fixture вне таймера, меряется `validate_graph`, реальные monotonic5s.
Одна серия — диагностика, не сравнительный performance PASS/медиана.

| Синтетика | Nodes/edges/rooms | JSON bytes | HA до/после, ms | Strict ms / units / исход |
|---|---|---|---|---|
| Shared-wall grid20×20 |441/840/400|199113|86.51/84.26|95.18 /29178 /accepted|
| Parallel400 |800/400/0|58822|216.55/225.22|237.83 /131400 /accepted|
| Parallel1600 |3200/1600/0|243622|3507.38/3524.29|3541.00 /2000000 /capacity_exceeded, geometry_work|

Все измерения сохранили исходный JSON. Watchdog нигде не засчитан как защита
ядра. Граница units±1, общий бюджет двух последовательных вызовов и fake clock
5s/5s+epsilon проверяются детерминированно, отдельно от замера wall-clock.
Реальный дом с изображениями/маркерными данными здесь не бенчмаркался.

После ревью измерен **полный `parse_document`**, не только `validate_graph`:
1этаж×400комнат,371213bytes →390.32ms/86544units/accepted;
10этажей×400комнат,3708125bytes →4271.03ms/865440units/accepted.
Генерация/project/create_export были вне таймера в HA default scope, сам import
— в одном strict request scope.50×400fixture (18413938config bytes) превышает
прежний16-MiB config ceiling уже при подготовке source: graph_document_limit.
Его strict import **не измерен и не назван прошедшим**. Верхние counters не
обещают допустимость любой комбинации максимумов. На более медленной машине
вторичный5s может сработать раньше2M units; время не гарантирует успех одного
большого файла на любой машине. Внешний watchdog для полной подготовки60s,
он нигде не засчитан как защита ядра.

## Воспроизведение и тестовые границы

Из подготовленного WSL, обычного checkout, без пользовательского HA:

```sh
python scripts/security/input_capacity.py --profile strict
python scripts/security/input_capacity.py --profile ha
python scripts/security/input_capacity.py --profile strict --full-import
python scripts/security/input_capacity.py --profile ha --root /path/to/pre-fix-checkout
python -m pytest -q tests_backend/test_input_policy.py tests_backend/test_input_archive_security.py tests_backend/test_ha_input_security.py
```

Шесть классов имеют отрицательный fixture и допустимого соседа:
ZIP ratio/actual bytes; path/link/method/encryption/NUL; JSON bounds/nonfinite;
SVG/image/decoder; geometry budget/exact; error disclosure.
Тесты ставят ловушки на socket/urlopen для active SVG и проверяют исходные bytes.
Ни один тест не является сетевым сканером или атакой на реальную установку.
Статическая проверка границ core проходит без HA/Pillow/site dependencies;
реальные HA тесты используют установленный изолированный pytest runtime.

Остаточные риски: native decoder/library CVE, OS-level symlink races вне закрытых
adapter путей, конкурентное потребление нескольких запросов, суммарная память
нескольких копий32-MiB документа, отсутствие hard preemption. Ни один из этих
пунктов не заменён обещанием «strict = безопасный публичный сайт». Новые аудитные
fixtures выбираются по security/storage областям, не новым глобальным гейтом.
