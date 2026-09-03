# CODE-REVIEW-428-r1

Issue: [#428](https://github.com/Matysh/houseplan-card/issues/428) — «Экспорт с
недостающей картинкой декора не импортируется — ImportFailure на весь
документ».

Заход: r1 (первый), правила §2.9 о разборе по дельте не применяются — разбор
полный.

Проверяемый HEAD: `32dd4b30abb36403e6ca3a091e96394f1eed7277`
(ветка `issue/428-missing-decor-asset-roundtrip`, слияние от
`bdf53dc4` — `origin/dev`).

Материал: `git log --oneline origin/dev..HEAD`, `git diff origin/dev...HEAD`,
ТЗ `docs/specs/428-missing-decor-asset-roundtrip.md`, зелёное ревью ТЗ
`docs/reviews/SPEC-REVIEW-428-r1.md` (High 0/Medium 0), исходный контракт
`docs/specs/051-custom-decor-images.md` AC10/AC11, тело issue и все
комментарии.

## Скоуп диффа

```
custom_components/houseplan/import_export.py    |  39 +++-
docs/CHANGELOG.md                               |   4 +
docs/CHANGELOG.ru.md                            |   5 +
docs/CONFIG-COMPATIBILITY.md                    |   5 +
docs/USER-GUIDE.md                              |   3 +
docs/USER-GUIDE.ru.md                           |   4 +
docs/reviews/SPEC-REVIEW-428-r1.md              | 188 (артефакт публикации спек-ревью)
docs/specs/428-missing-decor-asset-roundtrip.md | 266 (ТЗ + опечатка)
docs/specs/README.md                            |   1 +
tests_backend/test_ha_import_export.py          | 193 +++
```

Три коммита в диапазоне:

- `bc090c0e` docs(spec) — ТЗ (не предмет этого этапа);
- `80a5a044` docs: review document for #428 — опубликованный артефакт
  спек-ревью (не предмет этого этапа);
- `eef7ce12` fix(import): preserve missing decor asset round-trips —
  `User-Visible: yes`, продуктовый код + тесты + оба changelog + три доки в
  одном коммите;
- `32dd4b30` test(import): account for space id remapping —
  `User-Visible: no`, только правка тестового ожидания.

`src/**`, i18n, манифесты, golden, workflows не затронуты — заявление ТЗ
подтверждено диффом.

## Как проверялось

Читал код построчно и сверял с таблицей допустимых значений из ТЗ (раздел
«Контракт manifest и валидации», п.2), а не полагался на слова автора.

### 1. Первопричина и правка `_content_state()`

`custom_components/houseplan/import_export.py:1650-1673`. Новая проверка:

```python
declared_exists = declared.get("exists_at_export")
valid_mime = isinstance(declared_mime, str) and declared_mime in _DECOR_ASSET_MIME_TYPES
missing_mime = declared_exists is False and declared_mime is None
if (declared.get("asset_id") != aid or declared.get("hash") != aid
        or type(declared_exists) is not bool
        or not (valid_mime or missing_mime)):
    raise ImportFailure("invalid_content", ...)
```

Прогнал вручную все шесть строк таблицы ТЗ через эту формулу:

| `exists_at_export` | `mime` | ТЗ | Код |
|---|---|---|---|
| `True` | supported | допустимо | `valid_mime=True` → не падает ✓ |
| `True` | `None`/unsupported | `invalid_content` | `valid_mime=False`, `missing_mime=False` (флаг не `False`) → падает ✓ |
| `False` | supported | допустимо | `valid_mime=True` → не падает ✓ |
| `False` | отсутствует/`None` | допустимо | `missing_mime=True` → не падает ✓ |
| `False` | unsupported, включая `""` | `invalid_content` | оба флага `False` → падает ✓ |
| отсутствует/`None`/`0`/`1`/str/dict/list | любое | `invalid_content` | `type(x) is not bool` истинно для всех перечисленных (в т.ч. `0`/`1`, т.к. `type(0) is int`, не `bool`) → падает ✓ |

Совпадение точное, включая явно названный в ТЗ риск «Python принимает `0` как
`False`» — проверка идёт по `type(...) is bool`, а не по `bool(...)`.

`row["mime"] = declared_mime` сохраняет ровно исходное supplied-значение для
preview; ниже по коду `exists_on_target`/`state` вычисляются заново из
байтов target blob через SHA-256 — supplied MIME/`exists_at_export` не
становится authority для доступности (комментарий в коде это фиксирует,
и это же подтверждено чтением: значение из `declared` нигде не используется
для выбора файла или `state`).

### 2. `content_manifest()` (exporter)

`import_export.py:473-482` — рефакторинг словаря в модульную константу
`_DECOR_ASSET_MIME_BY_SUFFIX`/`_DECOR_ASSET_MIME_TYPES`, поведение не
изменилось (то же `metadata.get("mime") or <lookup by suffix>`). Экспортёр
не тронут в части `exists_at_export`/hash-логики.

### 3. Plan-only проекция (`_project_plan_only_decor`, `_validate_plan_only_document`)

Проверил отдельно, так как это не то место, которое первым приходит в
голову при чтении заголовка issue, но явно названо в ТЗ («Затронутые файлы»)
и обязательно для AC3.

До правки `_DECOR_KIND_FIELDS` не содержал ключ `"image"`, поэтому
`_project_plan_only_decor` для фигуры `kind="image"` копировал только
`_DECOR_COMMON_FIELDS` (`id, kind, color, opacity, width_cm, width`) —
`asset_id` и вся геометрия терялись. Это не косметика: `content_manifest()`
на строке `if not isinstance(aid, str): continue` тогда вообще не создавал
строку манифеста для такого объекта, а спроецированный конфиг оставлял
`decor`-объект `kind: "image"` без `asset_id`/`x`/`y`/`w`/`h` — то есть режим
«Только планировка» был категорически несовместим с любым decor-изображением
в пространстве ещё до этого исправления (не входит в текст issue, но входит
в объявленный ТЗ скоуп и необходимо для AC3).

Правка (`import_export.py:108`) добавляет `"image": ("asset_id", "x", "y",
"w", "h", "angle", "flip_h", "flip_v")` — набор аналогичен по структуре
`"furniture"`. Приватность не расширяется: `asset_id` — content-addressed
SHA-256 без встроенных данных пользователя, а геометрия decor уже
экспортировалась для всех остальных kind (`line`, `rect`, `ellipse`, `text`,
`furniture`) в том же plan-only режиме до этой правки.

`_validate_plan_only_document` (`import_export.py:809-820`) расширяет
допустимые `owner` в supplied `content_manifest` с одного `"space"` до
`"space" | ("decor" && kind=="decor_asset")` — проверил, что условие именно
конъюнкция (`and` внутри `or`), а не широкое разрешение всего `owner=="decor"`:
никакой другой decor-related kind этой веткой не пропускается.

Не-скоуп ТЗ запрещает «изменение... full/space/plan-only projection»
буквально в том же документе, где «Затронутые файлы» прямо называют
«полную image-проекцию plan-only» частью работы. Это внутреннее
противоречие текста ТЗ, а не кода: при спек-ревью (это тот же ревьюер,
зелёный вердикт с этим же диффом функций уже подразумевался разделом
«Затронутые файлы») запрет уже был прочитан как относящийся к UI выбора
режима экспорта и политике detach, а не к содержимому geometry-проекции.
Код реализует ровно то, что назвал раздел «Затронутые файлы», и ничего
сверх этого — расширения не вижу.

### 4. Тесты (`tests_backend/test_ha_import_export.py`)

Прочитал каждый новый тест построчно и убедился, что он умеет падать:

- `test_issue_428_missing_decor_asset_round_trips_in_every_export_mode`
  (параметризован `full`/`space`/`plan-only`, реально идёт через
  `create_export → create_preview → get_candidate → prepare_apply`, как
  требует риск №4 ТЗ) — без правки `_content_state()` первый же вызов
  `create_preview()` бросил бы `invalid_content` на этапе построения preview,
  тест бы упал на `create_preview`, а не на assert. Дополнительно проверяет
  `content_confirmation_required` до подтверждения и точное совпадение
  сохранённого объекта (кроме локального `id`, который намеренно
  перевыделяется при space-импорте — см. §5 ниже) после подтверждения.
- `test_issue_428_explicitly_missing_asset_accepts_bounded_mime` —
  `null`/omitted/`"image/png"` при `exists_at_export: false` дают
  `missing_preserved` + `confirmation=True`; без правки `null`/omitted упали
  бы на `ImportFailure`.
- `test_issue_428_missing_mime_exception_remains_fail_closed` — 13
  параметризованных отрицательных случаев, включая `0`/`1`/`""`/`list`/`dict`
  для обоих полей раздельно; до правки часть уже падала (это regression-тест
  на существующее поведение), после правки для новых legal-комбинаций
  (в этом тесте таких нет — тут только invalid) все раскрываются как
  `invalid_content`. Проверил вручную по формуле выше — совпадает.
- `test_issue_428_missing_asset_keeps_hash_identity_strict` — подмена
  `asset_id`/`hash` при прочих валидных полях всё равно даёт
  `invalid_content`: ослабление не затронуло identity-проверку.
- `test_issue_428_missing_source_reuses_only_exact_target_blob` — существующий
  на target файл с точным SHA даёт `available`/`confirmation=False`; при
  подмене байтов — `missing_preserved`/`confirmation=True`. Это ровно AC4.

Старый `test_issue_51_missing_decor_asset_stays_as_repairable_geometry`
(соседний случай: source had blob, target doesn't) не тронут и остаётся
зелёным регрессионным тестом — AC6 подтверждён.

Финальный коммит `32dd4b30` — чисто тестовая правка: заменяет
`imported_images == [shape]` на сравнение без ключа `id`, потому что
space-импорт намеренно перевыделяет локальные id (документировано в
`docs/USER-GUIDE.md`: «A space import assigns new internal IDs»). AC2 требует
сохранности `asset_id`, geometry, opacity, flip flags и decor order — `id`
в этот список не входит, тест корректно ослаблен только в этой одной точке,
остальные поля сравниваются на точное равенство.

### 5. Документация и changelog (AC8)

- `docs/CONFIG-COMPATIBILITY.md` — новый абзац описывает `exists_at_export:false`/
  `mime:null` как импортируемое во всех трёх режимах и явно называет три
  инварианта (`bool`-флаг, exact identity/hash, whitelist непустого MIME) —
  соответствует контракту, не расширяет его словами.
- `docs/USER-GUIDE.md`/`.ru.md` — новое предложение продолжает существующий
  абзац про «перечёркнутую рамку»/repair; в ru-версии «восстанавливаемую
  рамку» — та же сущность, упомянутая двумя предложениями выше, термин не
  изобретён. En-версия ссылается на «the existing missing-content
  confirmation» — сверил с §20 (строка 966-968 USER-GUIDE.md): «Import first
  shows a server-side preview with... content-link state; nothing is written
  until confirmation» — тот же механизм, разночтения нет.
- Оба changelog правлены в том же коммите `eef7ce12`, что и продуктовый код —
  `git show --stat` подтверждает (см. §«Скоуп диффа» выше); trailer
  `User-Visible: yes` на этом коммите корректен.

## Гейты

**Дешёвые гейты подтверждены на этом SHA** (`32dd4b30`), Validate
https://github.com/Matysh/houseplan-card/actions/runs/33730976160 —
`conclusion: success`, проверил `headSha` через `gh run view --json headSha`
и он равен HEAD ветки. Разбор по job:

| Job | Статус на 32dd4b30 | Почему так |
|---|---|---|
| `docs`, `provenance`, `process-gate`, `hacs`, `hassfest` | success | реально выполнены |
| `frontend`, `smoke`, `golden`, `performance_smoke` | skipped | `src/**` не тронут — path-filter `changes`, легитимно (диф подтверждён выше: только backend+docs) |
| `backend` | skipped (переиспользование) | не «пропущено молча»: я прочитал лог job «Переиспользование» — `reuse-backend-<hash>` дал `Cache hit`, т.е. байт-в-байт то же содержимое `import_export.py`+`test_ha_import_export.py`, что и в прогоне `f0d36e8d` (id `33729239357`), где backend **реально выполнялся** и завершился `success`. Проверил `git diff f0d36e8d HEAD -- tests_backend/test_ha_import_export.py custom_components/houseplan/import_export.py` — пусто, разница между этим SHA и HEAD только в `PROCESS.md`/`scripts/gate-reuse.mjs` (rebase на dev), к #428 не относится. Переиспользование корректно. |

Не прогонял `npm run typecheck`, `npm test`, `npm run build` — фронтенд не
тронут, а Validate на этом SHA формально зелёный (`docs`/`provenance` job
покрывают то немногое, что относится к дереву в целом). `python -m pytest
tests_backend -q` не прогонял локально — по правилу AGENTS.md он без HA
молча пропускает `test_ha_*.py` (ровно те тесты, что здесь важны), поэтому
такой прогон ничего бы не доказал; полагаюсь на подтверждённый Linux-CI
прогон `f0d36e8d`.

Не прогонял и не требовались по AC9/ТЗ: browser smokes (`src/**` не тронут),
`golden:verify` (визуальный результат не меняется), `invariants`
(геометрия/`layout`/`marker.space`/`open_spans` не тронуты — диф не
содержит правок стен, рёбер комнат, layout или толщины), performance-профили
(не названы в AC, perf-чувствительные пути не тронуты). `ruff` не
перезапускал — автор сообщил зелёный локальный прогон, а ruff не входит в
список Validate-джобов из AGENTS.md; проверка кода не выявила ничего, что
ruff обычно ловит (неиспользуемые импорты/переменные не вижу).

## Находки

Не найдено. High: 0, Medium: 0, Low: 0.

## Что проверено и корректно

- Матрица валидации `decor_asset` (6 строк ТЗ) реализована в
  `_content_state()` буквально, включая различение `bool`/`int` для
  `exists_at_export` и включая `""` в список отклоняемых MIME.
- Supplied `mime`/`exists_at_export` не становятся authority для
  `state`/`exists_on_target` — эти поля пересчитываются из байтов target
  blob по SHA-256 независимо от заявленных значений (AC4, риск №3 ТЗ).
- Три режима экспорта (`full`, `space`, `plan-only`) реально проверены через
  `create_export`/`create_preview`/`prepare_apply`, а не только helper'ами
  (риск №4 ТЗ снят).
- Ранее принятые строки (`true`+supported MIME, `false`+supported MIME)
  не меняют поведения — AC7 подтверждён и построчным разбором, и
  параметром `"supported"` в тесте.
- Версии/схемы/миграции не тронуты (`grep` по `VERSION` в диффе пуст) — AC7.
- Оба changelog и обе документации правлены в implementation-коммите с
  верным trailer — AC8.
- Побочный дефект plan-only проекции decor-изображений (потеря `asset_id`
  и геометрии) исправлен как часть заявленного в ТЗ скоупа, не является
  скрытым расширением задачи, и не открывает новую приватность — раздел
  «Затронутые файлы» ТЗ его прямо называет.

## Чего не проверял

- Не запускал `npm run typecheck`/`test`/`build` — фронтенд вне диффа,
  Validate уже зелёный на точном SHA.
- Не запускал полный HA-harness локально — канон это Linux CI, зелёный на
  `f0d36e8d` при байт-идентичном коде backend-файлов.
- Не проверял ручным тестированием в браузере — диф не касается `src/**`,
  видимого рендера нет.
- Не проверял decor order при нескольких image-объектах одновременно (тест
  использует один объект на пространство) — это пред-существующая глубина
  покрытия теста #51/#428, не регресс этого диффа, и не входит ни в один
  из шести Not-a-bug рисков ТЗ.

## Вывод

Реализация точно соответствует контракту ТЗ #428 (матрица допустимых
значений, target-reuse, три режима экспорта, совместимость), тесты
осмысленны и способны падать, документация и changelog обновлены в
правильном коммите с верными трейлерами. Единственный найденный при
спек-ревью Low (пустая строка MIME) устранён уточнением текста ТЗ, как и
обещал автор. Блокеров нет.

**Вердикт: зелёный.**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/428-missing-decor-asset-roundtrip`, коммит `32dd4b30abb3` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `336693355ea1ce40e79303025743bcc0e41e50b2`
  ```
  git log --all --format='%H %T' | grep 336693355ea1
  ```
- ТЗ `docs/specs/428-missing-decor-asset-roundtrip.md`, блоб `5018539ec5fd0e9d9ffb737cc0d0fa28e6ca2464`
  ```
  git log --all --find-object=5018539ec5fd0e9d9ffb737cc0d0fa28e6ca2464 -- docs/specs/428-missing-decor-asset-roundtrip.md
  ```
