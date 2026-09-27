# Code review #225 — r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/225
- **Spec:** тело issue (лёгкий трек `small`), зелёное `SPEC-REVIEW-225-r2.md`
- **Reviewed branch:** `issue/225-import-attachment-url-query`
- **Reviewed range:** `origin/dev..HEAD` = `e59962f` (единственный продуктовый коммит)
- **Base:** `origin/dev` at `5f000cb`
- **Reviewer:** Claude, независимая сессия без контекста реализации

## Вердикт

**Жёлтый · цикл r1/2 · High: 0 · Medium: 2 → в задаче.**

Диагноз и контракт («парсить URL как URL», `urlsplit(url).path`, query/fragment
не участвуют в определении файла) реализованы и покрыты честными тестами:
семь параметризованных тестов на `_internal_path`/`_content_state` плюс
полный roundtrip-тест, все зелёные в CI на точном SHA (см. «Как проверялось»).
Я независимо воспроизвёл логику `_internal_path` вне HA-харнеса и подтвердил,
что каждый из новых тестов **умеет падать** на добеговом резолвере.

Но контракт реализован не полностью: `urlsplit(url).path` доверяет пути даже
тогда, когда у URL есть `scheme`/`netloc` — то есть строка вида
`https://evil.example/houseplan_files/files/m1/doc.pdf` после фикса резолвится
как **внутренний** файл, хотя `_looks_internal` (строковая проверка префикса,
не изменена) по‑прежнему говорит «не внутренний». Это то самое расхождение,
от которого защищает `_content_state` (docstring прямо называет угрозу:
«a crafted file could ... bypass the mandatory detach decision»), только в
обратную сторону от исходного бага. Ни один AC (в частности AC5) эту форму
входа не проверяет (M1).

Отдельно: ТЗ само выписало три записи мутационного гейта с готовыми
find/replace-патчами в формате `scripts/mutation-gate.mjs` — ровно так, как
это уже делалось для прежних бэкенд-фиксов в этом же файле (#167:
`plan-only-*`, тем же коммитом). В этой задаче патчи не легли в реестр —
проверка осталась разовой, только в тексте хендоффа (M2).

Оба High отсутствуют, обе находки в скоупе issue (правка того же файла и
того же гейта, который эта задача уже трогает) — по §2.7/§7.2 PROCESS.md
это жёлтый вердикт с возвратом автору, а не отдельный issue.

## Скоуп

Единственный продуктовый коммит `e59962f` (`Issue: #225`, `User-Visible: yes`,
трейлеры на месте):

- `custom_components/houseplan/import_export.py` (+10) — `_internal_path`
  теперь режет `urlsplit(url).path` до сравнения сегментов; остальная логика
  (префиксы `plans/_/`/`FILES_URL`, `sanitize_marker_id`/`sanitize_filename`,
  требование ровно двух сегментов, посегментное сравнение) не тронута;
- `tests_backend/test_ha_import_export.py` (+128, 7 тестов) — AC1/AC1-plan,
  AC4, AC4a, AC5, AC2 (обе ветки `same_source`), AC3 (полный roundtrip);
- `docs/CHANGELOG.md` + `docs/CHANGELOG.ru.md` (+6/+6) — пользовательская
  формулировка совпадает с USER-GUIDE-стилем сообщения об ошибке, ссылка на
  #225 есть в обоих.

Никаких изменений в `src/**`, i18n, миграции, конфиге совместимости — как и
заявлено в ТЗ. Ветка `issue/225-import-attachment-url-query` соответствует
правилу именования.

## Как проверялось

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | pass |
| `npm test` | **962/962 pass** |
| `npm run build` + сверка трёх копий бандла | pass, `dist`/`custom_components/houseplan/frontend`/`demo/srv/assets` побайтово совпадают, `git status` после сборки чист |
| CI `Validate` на точном SHA `e59962f` (`gh run view 32403605914`) | `completed success`; job `backend` — `completed success`, лог: «Backend unit tests (pure + HA harness) — 335 passed in 3.78s» (полный HA-харнес, включая `test_ha_*.py`, не только «чистое» подмножество) |
| Независимая проверка «тест умеет падать» — извлёк `_internal_path` (плюс `sanitize_marker_id`/`sanitize_filename`, у функции нет собственной HA-зависимости, она приходит из модуля целиком) и прогнал старую/новую версию на всех кейсах AC1/AC1-plan/AC4/AC4a/AC5 вне HA-харнеса | новая версия проходит все кейсы AC1/AC1-plan/AC4/AC4a/AC5; **старая версия (`origin/dev`) красная** на 4/5 кейсов AC1, обоих кейсах AC1-plan-с-query и обоих кейсах AC4a — регрессия доказуема, а не заявлена на слово |
| `python -m pytest tests_backend -q` локально | не прогонял — окружение ревью на py3.12 без `homeassistant`, `test_ha_*.py` тем же механизмом молча пропускается (см. `AGENTS.md`); заменено CI-прогоном выше и независимой проверкой резолвера |
| browser `demo/smoke_*.mjs` (127 шт.) | не прогонял — задача не касается `src/**`, ни один AC их не называет |
| `npm run golden:verify` | не прогонял — визуала нет, бэкенд-only фикс |
| performance-профили | не прогонял — не названы в AC, путь не производительный |

## Проверка AC1–AC7

| AC | Метод по ТЗ | Статус | Как закрыт |
|---|---|---|---|
| AC1 | backend unit | ✅ | `test_issue_225_attachment_url_resolves_regardless_of_query` (5 кейсов) + `..._plan_url_resolves_regardless_of_query` (3 кейса); я пересчитал `urlsplit(url).path` для каждого кейса вручную и вне HA — совпадает |
| AC2 | backend unit/`_content_state` | ✅ | `test_issue_225_content_state_accepts_a_cache_busted_attachment`, обе ветки `same_source`; зелёный в CI на точном SHA (см. выше) |
| AC3 | backend HA-харнес, roundtrip | ✅ | `test_issue_225_backup_with_an_attachment_survives_a_full_round_trip`; зелёный в CI |
| AC4 | backend unit, traversal | ✅ | `test_issue_225_traversal_stays_closed_with_a_query` (4 кейса); подтверждено чтением — `sanitize_marker_id`/`sanitize_filename` и посегментное сравнение работают над `urlsplit(url).path`, то есть после отделения query, ровно как и до фикса |
| AC4a | backend unit | ✅ | `test_issue_225_hostile_looking_query_does_not_reject_a_valid_path` (2 кейса); я подтвердил разбором, что мусор в query/fragment действительно не участвует в резолвинге |
| AC5 | backend unit | ⚠️ формально ✅, но неполно | `test_issue_225_external_url_is_still_external` зелёный для `https://example.invalid/floor.svg?v=1` — путь этого URL (`/floor.svg`) не совпадает с внутренним префиксом. AC **не покрывает** случай, когда путь абсолютного/protocol‑relative внешнего URL *совпадает* с внутренним префиксом — см. M1: в этом случае `_internal_path` **резолвит его как внутренний**, хотя `_looks_internal` говорит «нет» |
| AC6 | regression, существующие тесты без правок | ✅ | diff — только добавления в конец файла (проверено `git show`), ни одна существующая строка теста не изменена; CI backend green |
| AC7 | plan-only idempotency (`:704`) | ✅ (чтением) | тесты `test_plan_only_export_projects_geometry_and_round_trips_room_labels` и соседние в диапазоне 489–736 не задеты диффом; `_internal_path` используется в plan-only пути так же, как раньше, отличие только в разборе query/fragment |

## Находки

### M1 (Medium, в скоупе) — `_internal_path` доверяет `path` даже при непустых `scheme`/`netloc`

`urlsplit(url).path` отбрасывает не только query/fragment, но и `scheme` с
`netloc`. Для строки с полной схемой или protocol‑relative префиксом это
означает, что путь резолвится как внутренний, даже когда URL целиком указывает
на другой хост.

Воспроизведено извлечением и прогоном литеральной логики `_internal_path` вне
HA (сравнение с `_looks_internal`, определённой в том же файле построчно):

```
url = "https://evil.example/houseplan_files/files/m1/doc.pdf"
_looks_internal(url)               -> False   (не меняется фиксом)
_internal_path(root, url)  (НОВЫЙ)  -> ('attachment', <root>/files/m1/doc.pdf)
_internal_path(root, url)  (СТАРЫЙ, origin/dev) -> None
```

То же самое для protocol-relative `//evil.example/houseplan_files/files/m1/doc.pdf`
и для варианта с `?v=1`. `urlsplit` реально разбирает такие строки так, что
`netloc="evil.example"`, `path="/houseplan_files/files/m1/doc.pdf"` — я
проверил это отдельно интерпретатором, это не домысел.

Практический эффект ограничен (traversal по‑прежнему закрыт AC4 —
посегментные проверки не меняются): `_looks_internal` в `_content_state` не
кидает `ImportFailure`, потому что она сама смотрит на исходную строку и
по‑прежнему говорит «внешний». Но `internal is not None` (новое поведение)
уводит такую запись в ветку `available`/`detach_required` вместо `external`:
`content_manifest` на экспорте и `_content_state` на импорте начинают
описывать заведомо внешнюю ссылку так, будто она указывает на настоящий
локальный файл, включая проверку `is_file()` по пути, который в
действительности к этому URL не относится. Это ровно тот класс
несогласованности, который докстринг `_content_state` называет угрозой
(«a crafted file could ... bypass the mandatory detach decision»), только не
исходный баг issue, а новый, привнесённый самим фиксом.

Ни один AC (в частности AC5, единственный про «внешний» URL) не проверяет
такую форму — тест `https://example.invalid/floor.svg?v=1` не совпадает по
path с внутренним префиксом и потому не может поймать эту ветку.

**Фикс:** перед тем как доверять `parsed.path`, требовать
`not parsed.scheme and not parsed.netloc`, иначе — как и сегодня для любой
внешней ссылки — возвращать `None`. Пара строк плюс тест-кейс(ы) с `https://`
и `//`-префиксом на пути, совпадающем с внутренним namespace.

**Вердикт:** в скоупе issue (тот же файл, тот же контракт «разобрать URL как
URL»), чинится в этом же цикле.

### M2 (Medium, в скоупе) — заявленный мутационный гейт не зарегистрирован

ТЗ issue содержит раздел «Мутационный гейт» с тремя id и готовыми
find/replace-патчами (`internal-path-ignores-query`,
`internal-path-allows-traversal`, `roundtrip-import-with-attachment`) —
буквально в формате записей `scripts/mutation-gate.mjs`. Это не абстрактная
формулировка риска: патчи прямо адресуют строки `import_export.py`.

Прецедент в этом же файле — issue #167 (`feat: add plan-only space export`,
коммит `7f397a6`): пять аналогичных backend-мутантов
(`plan-only-room-area-restored` и соседние, гвард
`node scripts/backend-test-guard.mjs <pattern>`) были добавлены в реестр
**тем же коммитом**, что и сама правка. `scripts/backend-test-guard.mjs`
уже поддерживает произвольный `-k`-паттерн по `test_ha_import_export.py`, то
есть механизм для #225 был готов без доработок — `node
scripts/backend-test-guard.mjs issue_225_attachment_url_resolves` и подобные
сразу работали бы как guard.

В `e59962f` `scripts/mutation-gate.mjs` не менялся (проверено `git show
e59962f --stat` и `git log --follow -- scripts/mutation-gate.mjs`). Хендофф
описывает, что автор вручную прогонял мутации через отдельные патч-версии
файла и даже сделал полезное наблюдение (первая редакция
`internal-path-allows-traversal` оказалась «эквивалентной» — traversal
защищён двумя независимыми проверками одновременно) — но эта работа нигде не
осела постоянной проверкой. Без записи в реестре периодический
предрелизный `mutation-gate` (`.github/workflows/mutation-gate.yml`) никогда
не перепроверит, что будущий рефакторинг `_internal_path` не вернёт баг
#225 бесшумно — то есть именно тот сценарий, ради которого механизм
существует (см. комментарий в начале `scripts/mutation-gate.mjs`: «зелёный
тест в этом проекте несколько раз означал ничего не проверено»).

**Вердикт:** в скоупе issue (`scripts/mutation-gate.mjs` — класс B, «может
использовать issue того изменения, которое покрывает»), чинится добавлением
двух работающих записей в этом же цикле (третью, `internal-path-allows-
traversal`, — с патчем, который автор уже подобрал как небезрезультатный,
согласно находке из хендоффа).

## Что проверено и корректно

- Диагноз бага (несовпадение `_looks_internal`/`_internal_path` из-за
  `sanitize_filename` над сырым хвостом с `?v=...`) и контракт исправления
  (`urlsplit`, query/fragment не участвуют в определении файла) — совпадают
  с фактическим кодом `_internal_path` до и после правки.
- Данные пользователя не переписываются: URL в конфиге сохраняется как есть
  (проверено чтением — фикс меняет только внутреннюю логику резолвинга,
  возвращаемое значение из `create_export`/`_content_state` не трогает
  `item["url"]`; тест `test_issue_225_content_state_accepts_a_cache_busted_attachment`
  отдельно утверждает `rows[0]["url"] == url`).
- `identity()` (`:1034-1039`) не включает `storage`/`state` в ключ сравнения
  — смена классификации `external → internal` для канонических cache-busted
  ссылок (сама цель фикса) не ломает сопоставление manifest-строк; тем же
  свойством объясняется, почему M1 не валит существующие проверки
  идентичности, только их семантику для одной специфичной формы входа.
- Traversal-защита (AC4) не ослаблена: `sanitize_marker_id`/
  `sanitize_filename` и требование `len(tail) == 2` работают над результатом
  `urlsplit(url).path`, то есть над тем же материалом, что и раньше для
  URL без scheme/netloc — я прогнал старую и новую версию резолвера на всех
  четырёх кейсах AC4 и получил идентичный `None` в обеих.
- AC6/AC7 не нарушены: diff — чистое добавление в конец файла тестов, ни
  одна существующая строка не тронута; plan-only regression-диапазон вне
  диффа.
- Trailers `Issue: #225`/`User-Visible: yes`, оба changelog в одном коммите,
  ветка `issue/225-import-attachment-url-query` — по правилам.
- Три копии бандла побайтово совпадают после локальной пересборки — класс D
  не разошёлся, хотя эта задача его не трогает (бэкенд-only).

## Чего не проверял

- `python -m pytest tests_backend -q` в собственном окружении — ревью
  выполняется на py3.12 без установленного `homeassistant`; `conftest.py`
  тем же механизмом, что и у автора, молча пропустил бы `test_ha_*.py`, то
  есть локальный зелёный прогон здесь ничего не доказывает (см. `AGENTS.md`,
  раздел «Backend»). Использован CI `Validate` на точном SHA (`backend`:
  335 passed, полный HA-харнес) плюс независимое исполнение чистой логики
  `_internal_path` вне HA — сильнее, чем «поверил хендоффу».
- Полный набор из 127 browser-smoke и `performance_smoke` — задача не
  касается `src/**`, ни один AC их не называет, поверхность чисто бэкендовая.
- `npm run golden:verify` — визуальных изменений нет.
- Мутационный гейт (`node scripts/mutation-gate.mjs`, дорогой прогон с
  пересборкой бандла в отдельном worktree) целиком не запускал — сам факт
  отсутствия трёх заявленных записей в реестре зафиксирован находкой M2 без
  необходимости гонять существующие 40+ мутантов, которых этот диф не
  касается.
