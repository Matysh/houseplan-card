# #498 — Backend hardening: точная квота upload, ключи палитры в support-пакете, предел цепочки ссылок SVG

- **Issue:** https://github.com/Matysh/houseplan-card/issues/498
- **Тип / приоритет:** bug / P3
- **Трек:** полный — три независимых модуля (`plans.py`+`http_api.py`, `support_package.py`, `decor_assets.py`), критерий §5 «одна поверхность» не проходит
- **Оценка:** пользовательская ценность 4/10; ценность для разработки 5/10; сложность 3/10; риск 2/10
- **Связано:** аудит 2026-09-08 §11 п.9 (B5/B6/B7); #436 (лимиты SVG `MAX_SVG_*`); HP-1454-06/HP-1460-02 (потоковая загрузка в `.upload-*` внутри `files_root`); #421 (support preview); `docs/SUPPORT-PRIVACY.md`, `docs/DECOR-EDITOR.md`

## 1. Проблема

Три защитных гейта считают или обходят не то, что должны. Подтверждено чтением `dev@2e387ac1` и локальными пробами.

**B5. Квота вложений считает собственный staged-файл дважды.** `HouseplanUploadView` пишет тело в `tempfile.mkstemp(prefix=".upload-", dir=files_root)`, затем вызывает `check_quota(files_root, tmp.stat().st_size, MAX_FILES_BYTES, MAX_FILES_COUNT)`. `dir_usage(files_root)` рекурсивно суммирует всё под корнем — включая этот временный файл — после чего `check_quota` прибавляет `incoming` ещё раз и считает `count + 1`. Проба: 600 Б в `m1/a.pdf` + staged 300 Б при лимите 1000 → `quota_exceeded`. Симметрично по числу файлов: при 999 сохранённых законный тысячный отклоняется как 1001-й. Отказ консервативный — обхода лимита нет, но у границы квоты пользователь получает ложный `507` на файле, который влезает.

**B6. Проекция support-пакета копирует любые ключи `fill_colors`.** Схема (`validation.py:2202`) принимает `{str: {c, a}}` с произвольными именами — намеренно широко, ради совместимости чтения. Проекция `_global_settings` (`support_package.py:146`) переносит все строковые ключи. Продукт знает ровно 11 ключей (`DEFAULT_FILL_COLORS`, `src/logic.ts:1412`; `fillColorsOf` читает только их). Ключ вида `private-owner@example.test` UI не создаст, но ручная правка `.storage` или импорт его сохранит, и при явной отправке пакета он уедет в чужие руки. Существующий тест `test_rich_plan_projection_preserves_safe_structure_and_drops_unknown_values` закрепляет текущее поведение на ключе `"warm"`.

**B7. Проверка циклов ссылок SVG рекурсивна.** `_validate_svg` строит `ref_graph` (`href`, `url(#…)`) и обходит его рекурсивной `_visit`. Плоская цепь `linearGradient id="g0" href="#g1"`… длиной 2500 проходит все лимиты #436 (элементов ≤5000, глубина дерева 2, атрибуты в норме) и роняет обход `RecursionError` (проба воспроизведена). `http_api.py:258` ловит только `DecorAssetError` → клиент получает 500 вместо кода отказа. Вход writer-only; XSS/RCE нет.

## 1.1. Сценарий

Редактор с почти заполненной квотой вложений (1 ГБ / 1000 файлов) прикладывает последний мануал — «Storage quota exceeded», хотя место есть. Владелец, у которого в конфиге завёлся нестандартный ключ палитры (импорт из чужого файла, ручная правка), отправляет support-пакет — ключ уезжает целиком. Редактор загружает SVG-декор, сгенерированный инструментом с длинной цепочкой градиентов, — «Internal Server Error» без объяснения.

## 1.2. Что человек увидит до и после

До: см. §1.1. После: вложение, которое влезает в квоту, принимается; отказ у границы — только когда места действительно нет. Пакет поддержки содержит палитру заливок только по одиннадцати слотам карточки, значения без изменений. SVG-декор со слишком длинной цепочкой ссылок отклоняется понятным сообщением «слишком большой», как и прочие превышения лимитов; цепочка в пределах лимита принимается; зацикленная — отклоняется как некорректная, как и раньше.

## 2. Скоуп

1. **Квота без двойного счёта** (§4): `check_quota` умеет исключить из учёта собственный staged-файл; чужие staged-файлы остаются в счёте (консервативно: они станут вложениями).
2. **Проекция палитры по allowlist** (§5): только ключи продукта; схема не сужается.
3. **Итеративный обход графа ссылок с пределом** (§6): явный стек, трёхцветная раскраска, `MAX_SVG_REF_DEPTH = 64`.
4. **Тесты и мутанты** (§7): граничные и отрицательные на валидаторах и на endpoint в HA.

## 3. Не-скоуп

- Ослабление или изменение численных лимитов (`MAX_FILES_BYTES`, `MAX_FILES_COUNT`, `MAX_SVG_*`) — нет.
- Сужение схемы `fill_colors` в `validation.py` — нет: старый/расширенный конфиг должен читаться; лишние ключи для карточки невидимы и безвредны.
- Автоматическая очистка чужих `.upload-*` (HP-1460-02 уже убирает свои в `finally`) — нет.
- Перенос staging за пределы `files_root` (другая ФС → не-атомарный `rename`) — нет.
- Проверка квоты планов (`ws_plan_upload`) — считает `len(raw)` до записи, не затронута.

## 4. Квота: собственный staged-файл вне счёта

### 4.1. Контракт

`dir_usage(path, *, exclude: Path | None = None) -> (bytes, files)` — файл, равный `exclude` (сравнение по `Path` после `resolve()` обеих сторон не требуется: `rglob` отдаёт пути под `path`, `exclude` создан `mkstemp` в том же каталоге; сравниваем `item == exclude`), не учитывается ни в байтах, ни в счётчике.

`check_quota(path, incoming, max_bytes, max_files, *, exclude: Path | None = None)` — прокидывает `exclude` в `dir_usage`. Остальная арифметика без изменений: `count + 1 > max_files` → `too_many_files`; `used + incoming > max_bytes` → `quota_exceeded`; проверка свободного места — как была (`free - incoming`; сам staged-файл уже занял место на диске, так что здесь двойной счёт консервативен на величину одного файла — допустимо и в скоуп не входит, §8.2).

`HouseplanUploadView.post` передаёт `exclude=tmp_path`.

### 4.2. Границы, которые обязаны проходить

- ровно `max_bytes` суммарно после promote (used + incoming == max_bytes) — принимается;
- ровно `max_files` файлов после promote (count + 1 == max_files) — принимается;
- на один байт / один файл больше — отклоняется;
- чужой `.upload-*` в `files_root` (параллельная загрузка) — учитывается: два параллельных файла, каждый из которых влезает по отдельности, а вместе нет, никогда не сохраняются оба. Если проверки идут последовательно (первый уже продвинут), отклоняется второй; если обе проверки идут, пока оба файла staged, каждая видит чужой staged-файл и отклоняются оба — консервативно, повтор любого из них проходит. Обход лимита исключён в обоих порядках.

## 5. Проекция палитры по allowlist

В `support_package.py`:

```python
# The eleven palette slots the card reads (src/logic.ts DEFAULT_FILL_COLORS).
# The config schema stays open on purpose; a package must not.
SUPPORT_FILL_COLOR_KEYS = (
    "light_on", "light_off", "light_none", "temp_cold", "temp_ok", "temp_hot",
    "lqi_low", "lqi_high", "glow_base", "glow_light", "wall_fill",
)
```

`_global_settings`: `out["fill_colors"] = {key: _copy_keys(item, ("c", "a")) for key in SUPPORT_FILL_COLOR_KEYS if isinstance(item := fill_colors.get(key), dict)}`; пустой результат — ключ `fill_colors` не пишется (правило «пустое опускается», как у `_project_value_badge`). Значения по-прежнему только `c`/`a`.

Синхронизация с `DEFAULT_FILL_COLORS`: тест `test_support_package.py` читает `src/logic.ts`, извлекает ключи объекта `DEFAULT_FILL_COLORS` регэкспом и требует равенства множеств с `SUPPORT_FILL_COLOR_KEYS` (по образцу `_ts_list` в `test_validation.py`, который читает `src/logic.ts`, а не дублирует значения).

## 6. Итеративный обход графа ссылок

В `_validate_svg` после сборки `ref_graph` — вызов `_walk_reference_graph(ids, ref_graph)`:

```python
MAX_SVG_REF_DEPTH = 64  # rendering follows href/url() chains; a chain this long is not art
```

Инвариант: **предел — длина самой длинной цепочки, проходящей через узел**, а не высота стека того обхода, который первым до узла добрался (ревью ТЗ r1, Medium 2: цепь любой длины можно нарезать сегментами ≤64 и подобрать `id` так, чтобы `sorted()` стартовал с хвоста).

Алгоритм: явный стек `[(node, iter(children), chain)]`, где `chain` — длина самой длинной цепочки от `node` вниз, известная на данный момент (сам узел = 1); `visiting` — узлы на текущем пути; `longest[node]` — мемоизированная длина после полного обхода узла. Для каждого `start in sorted(ids)` без `longest`:

- потомок в `visiting` → `invalid_image` «cyclic local reference» (как сейчас);
- потомок в `longest` → `chain = max(chain, longest[ref] + 1)`, без спуска;
- иначе — спуск; если высота стека уже превышает `MAX_SVG_REF_DEPTH` → `too_large` (ограничение работы, не только результата);
- узел исчерпан → `longest[node] = chain`; `chain > MAX_SVG_REF_DEPTH` → `too_large` «The SVG reference chain exceeds the safety limit»; родитель получает `max(parent_chain, chain + 1)`.

Ни одной рекурсивной функции — `RecursionError` невозможен по построению. Сложность O(узлы + рёбра): каждый узел обходится один раз. Цепочка из 64 узлов принимается, из 65 — нет, при любом порядке `id`.

Семантика цикла и «висячей» ссылки не меняется; существующие тесты `test_svg_rejects_the_whole_unsafe_document` (цикл) и `test_svg_preserves_safe_local_gradient_clip_mask_and_transparency` зелёные без правок.

## 7. Тесты и мутанты

### 7.1. Квота

- `test_validation.py::test_issue_498_check_quota_excludes_the_staged_upload_itself`: `d/m1/a.pdf` 600 Б, `d/.upload-x` 300 Б, лимит 1000/10 → без `exclude` — `quota_exceeded` (фиксирует старое поведение как ошибку), с `exclude=d/.upload-x` — проходит; `max_files=2` с одним сохранённым — проходит; `max_files=1` — `too_many_files`; чужой `d/.upload-y` 200 Б при лимите 1000 → `quota_exceeded` (600+200+300 > 1000).
- `test_ha_upload.py::test_issue_498_upload_accepts_the_last_bytes_and_the_last_file_of_the_quota`: monkeypatch `http_api.MAX_FILES_BYTES`/`MAX_FILES_COUNT`; первый файл ровно до границы по байтам — 200; ещё один байт — 507 `quota_exceeded`; по числу файлов: `MAX_FILES_COUNT=2`, два файла — 200/200, третий — 507 `too_many_files`.
- `test_ha_upload.py::test_issue_498_concurrent_uploads_still_count_each_other`: два `client.post` через `asyncio.gather`, `check_quota` обёрнут барьером на два вызова (обе проверки идут, пока оба файла staged); каждый влезает по отдельности, сумма — нет → не `[200, 200]`, суммарно сохранено ≤ квоты, ни одного `.upload-*` на диске.

### 7.2. Проекция

- `test_support_package.py::test_rich_plan_projection_preserves_safe_structure_and_drops_unknown_values` — ключ `"warm"` заменяется на `"temp_hot"`; добавляется `"private-owner@example.test": {c, a}` и утверждение, что ни ключ, ни его подстрока в `raw` не встречаются.
- `test_support_package.py::test_issue_498_palette_allowlist_matches_the_card_defaults` — сверка с `src/logic.ts`.
- `test_support_package.py::test_issue_498_projection_omits_an_empty_palette`.

### 7.3. SVG

- `test_decor_assets.py::test_issue_498_flat_reference_chain_is_bounded_not_recursive`: цепь длиной 2500 → `DecorAssetError("too_large")` (не `RecursionError`); цепь длиной 64 — принимается; 65 — `too_large`; **недоброжелательный порядок id** — цепь 65 с именами `n0065→n0064→…→n0001` (sorted стартует с хвоста) → `too_large`; цикл `a→b→a` — `invalid_image` (регрессия).
- `test_ha_upload.py::test_issue_498_decor_upload_refuses_a_deep_reference_chain_with_a_code_not_a_500`: цепь 2500 через `/api/houseplan/assets/upload` → 413 `too_large`, цепь 64 → 200 (в HA; доказывает отсутствие 500).

### 7.4. Мутанты (`scripts/mutation-gate.mjs`, гард `backend-test-guard.mjs`)

- `quota-counts-the-staged-upload-twice`: в `HouseplanUploadView.post` убрать `exclude=tmp_path`; свидетель — 7.1 endpoint-тест границ.
- `quota-ignores-foreign-staged-uploads`: `dir_usage` пропускает все файлы с префиксом `TMP_PREFIX`; свидетель — 7.1 параллельный тест.
- `support-palette-copies-any-key`: allowlist → `fill_colors.keys()`; свидетель — 7.2 первый тест.
- `svg-reference-chain-unbounded`: обе проверки предела отключены; свидетель — 7.3 (цепь 65).
- `svg-reference-depth-per-start-not-per-chain`: мемоизированная длина потомка не учитывается (`chain` вместо `max(chain, longest[ref] + 1)`); свидетель — 7.3 (недоброжелательный порядок id).
- `svg-reference-walk-recursive-again`: итеративный обход заменён на прежнюю рекурсивную `_visit`; свидетель — 7.3 (цепь 2500: `RecursionError` ≠ `DecorAssetError`).

Каждый из шести мутантов — отрицательным прогоном штатным раннером до S7.

## 8. Критерии приёмки

- AC1. Вложение, после которого суммарный объём равен `MAX_FILES_BYTES` или число файлов равно `MAX_FILES_COUNT`, принимается; на один байт или один файл больше — отклоняется `507` с прежними кодами `quota_exceeded`/`too_many_files`. Доказательство: `test_issue_498_check_quota_excludes_the_staged_upload_itself` (валидатор) и `test_issue_498_upload_accepts_the_last_bytes_and_the_last_file_of_the_quota` (endpoint в HA).
- AC2. Две параллельные загрузки, каждая из которых влезает, а сумма — нет, никогда не сохраняются обе; после запросов в `files_root` нет `.upload-*`. Доказательство: `test_issue_498_concurrent_uploads_still_count_each_other`.
- AC3. Support-пакет содержит `fill_colors` только по ключам `SUPPORT_FILL_COLOR_KEYS`, значения только `c`/`a`; ключ, отсутствующий в списке, не встречается в байтах пакета; пустая палитра опускается. Схема `fill_colors` не изменена. Доказательство: `test_rich_plan_projection_preserves_safe_structure_and_drops_unknown_values`, `test_issue_498_projection_omits_an_empty_palette`, отсутствие диффа в `validation.py`.
- AC4. `SUPPORT_FILL_COLOR_KEYS` равен множеству ключей `DEFAULT_FILL_COLORS` из `src/logic.ts` (11 штук). Доказательство: `test_issue_498_palette_allowlist_matches_the_card_defaults`.
- AC5. SVG с цепочкой локальных ссылок длиннее `MAX_SVG_REF_DEPTH` отклоняется `DecorAssetError("too_large")` при любом порядке `id`; цепочка ровно `MAX_SVG_REF_DEPTH` принимается; цикл — `invalid_image`; цепь из 2500 звеньев не поднимает `RecursionError`. Доказательство: `test_issue_498_flat_reference_chain_is_bounded_not_recursive`.
- AC6. Endpoint `/api/houseplan/assets/upload` отвечает на цепь 2500 кодом `413 too_large`, на цепь 64 — `200`. Доказательство: `test_issue_498_decor_upload_refuses_a_deep_reference_chain_with_a_code_not_a_500` (HA).
- AC7. Шесть мутантов §7.4 пойманы штатным раннером; полный `tests_backend/` зелёный; `ruff`, `mypy` (allowlist) зелёные.
- AC8. Производительность и touch не затронуты: правки только в серверных валидаторах и проекции; `src/**` без изменений (доказательство — дифф).

## 8.0. Совместимость и откат

Форматы Store, конфига и support-пакета не меняются (пакет становится строго подмножеством прежнего). Лимиты не меняются. Откат — revert одного коммита.

## 8.1. UX, модель данных, i18n

Не затрагиваются. Новое сообщение `too_large` для цепочки ссылок — серверный текст на английском, как остальные `DecorAssetError`; карточка показывает код.

## 8.2. Риски и меры

- `exclude` сравнивается как `Path` без `resolve()`: обе стороны — пути под одним каталогом, созданные одним процессом; symlink-игры внутри `files_root` не в модели угроз (writer-only).
- Проверка свободного места по-прежнему консервативна на размер одного staged-файла — намеренно, дешевле, чем знать, на той ли ФС лежит temp.
- Предел 64 у цепочки ссылок может отклонить экзотический сгенерированный SVG; это writer-only гейт с кодом ошибки, а не 500 — приемлемая цена.

## 9. Release-артефакты

`docs/CHANGELOG*.md` — пункт (user-visible: квота у границы, SVG вместо 500, палитра в пакете). `docs/SUPPORT-PRIVACY.md` — одна фраза про allowlist палитры в перечне «safe display settings».

## 10. Затронутые файлы

`custom_components/houseplan/plans.py`, `custom_components/houseplan/http_api.py`, `custom_components/houseplan/support_package.py`, `custom_components/houseplan/decor_assets.py`, `tests_backend/test_validation.py`, `tests_backend/test_ha_upload.py`, `tests_backend/test_support_package.py`, `tests_backend/test_decor_assets.py`, `tests_backend/test_ha_websocket.py` (endpoint декора), `scripts/mutation-gate.mjs`, `docs/CHANGELOG*.md`, `docs/specs/README.md`, `docs/SUPPORT-PRIVACY.md`.

## 11. Принятые предположения

- Чужие `.upload-*` считаются в квоту (консервативно). Альтернатива — не считать никакие temp-файлы — открыла бы обход лимита параллельными загрузками.
- Предел цепочки ссылок = 64, как `MAX_SVG_DEPTH`: одна константа ясности ради, отдельное имя ради независимой настройки.
- Allowlist палитры живёт в Python и сверяется тестом с TS, а не генерируется: два источника, один тест равенства — как у прочих контрактов между карточкой и интеграцией.
