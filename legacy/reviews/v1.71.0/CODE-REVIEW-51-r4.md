# CODE-REVIEW — issue #51 «Custom decor images» · заход r4

- Issue: https://github.com/Matysh/houseplan-card/issues/51
- Материал раунда: `git diff 043aa0d826cf1e1490a02feb4cc28f50cb96245b..HEAD`
  (материал r3 объявлен в `docs/reviews/CODE-REVIEW-51-r3.md`).
- SHA материала: `f7dfc6cab2dd02b19e19e222b981c85fd7c9b66b` (сверено с
  `git rev-parse HEAD` — совпадает).
- SHA предыдущего раунда (r3): `043aa0d826cf1e1490a02feb4cc28f50cb96245b` —
  жив, `git cat-file -t` → `commit`, `git merge-base --is-ancestor
  043aa0d8 HEAD` подтверждает: прямой предок `HEAD`, ребейза не было.
- Трейлеры обоих коммитов дельты (`6bfa42ca`, `f7dfc6ca`) — `Issue: #51`,
  `User-Visible: no`. Корректно: ни один не меняет продуктовый код или
  наблюдаемое пользователем поведение (только `tests_backend/**` и
  `demo/smoke_gear_tabs.mjs`) — правок в `docs/CHANGELOG*` не требуется и
  не сделано.

## Скоуп раунда

Единственная предметная находка r3 (Medium, в скоупе: backend coverage
ratchet красный из-за недопокрытого `decor_assets.py`, 71%) закрыта одним
коммитом (`6bfa42ca`). Второй коммит раунда (`f7dfc6ca`) — попутная
стабилизация ранее упавшего в CI `demo/smoke_gear_tabs.mjs`, тест-инфраструктура,
не связанная с #51 по существу, но входящая в тот же материал.

Дельта — 2 файла (без бандлов, без учёта опубликованного `docs/reviews/CODE-REVIEW-51-r3.md`,
который положил конвейер, а не автор): `tests_backend/test_decor_assets.py`
(+71 строка, новые тесты) и `demo/smoke_gear_tabs.mjs` (+12/-4, замена
таймаута на `page.waitForFunction`). Продуктовый код (`src/**`,
`custom_components/houseplan/**` за пределами тестов) не тронут вообще.
Ребейза на ушедший вперёд `dev` не было, контракт поведения не менялся,
новая подсистема не задета, объём дельты (2 файла, только тесты) на
порядок меньше исходной задачи — критерий «разбор остаётся полным» не
выполняется, сокращение объёма правомерно. Разбирал дельту построчно
(diff показан целиком выше), не декларативно.

## Закрытие раунда r3

| Находка r3 | Чем закрыта | Где это видно |
|---|---|---|
| Finding 1 (Medium, в скоупе): `pytest tests_backend` с coverage-ratchet красный на `043aa0d8` — `decor_assets.py` покрыт на 71%, ниже среднего проекта; `coverage: 86.9%` при `baseline 87.2%` | `6bfa42ca` добавил 8 новых тестов в `test_decor_assets.py`: реальные валидные JPEG/WebP(VP8/VP8L/VP8X)-фикстуры для полного декодирования через Pillow (`test_supported_raster_headers_and_full_decode`), граничные условия размера/расширения upload (`test_upload_size_and_extension_guards`), SVG dimensions/viewBox/text edge cases (`test_svg_dimension_and_text_boundaries_fail_closed`), пустой каталог и путь метаданных (`test_catalog_empty_directory_and_metadata_path`), malformed spaces/asset-id в reference scan (`test_reference_scan_skips_malformed_spaces_and_asset_ids`) | Независимо перепроверил на реальном CI-логе job'а «Бэкенд: pytest в Home Assistant» прогона [33685974303](https://github.com/Matysh/houseplan-card/actions/runs/33685974303) (SHA `6bfa42ca`, backend job **success**): `custom_components/houseplan/decor_assets.py 292 32 132 22 87%` (было 71% на `043aa0d8`), `TOTAL … 87%`, `coverage: 87.5% (baseline 87.2%)` — ratchet зелёный, `534 passed, 2 skipped`. Дополнительно прогнал сам локально: `python3 -m pytest tests_backend/test_decor_assets.py -q` → `35 passed` (совпадает с заявленным автором числом), `ruff check tests_backend/test_decor_assets.py` → чисто |

Прогон 33685974303 в целом завершился `failure` не из-за backend-а, а
из-за независимого падения `Смоки в браузере (шард 3 из 3)` — это и есть
триггер второго коммита раунда (`f7dfc6ca`, `smoke_gear_tabs`). Проверил
отдельно: на итоговом `HEAD` (прогон [33686693823](https://github.com/Matysh/houseplan-card/actions/runs/33686693823),
уже названный в контексте задачи как зелёный Validate) шард 3 содержит
`ok smoke_gear_tabs`; job «Бэкенд: pytest в Home Assistant» в этом прогоне
**skipped**, потому что джоб «Переиспользование: это дерево уже проверено»
законно переиспользовал побайтово идентичный backend-результат прошлого
зелёного прогона (диапазон коммита `f7dfc6ca` не трогает backend-релевантные
пути) — это не пропуск гейта, а корректное переиспользование того же
самого прогона, который я сверил выше напрямую по логу.

## Проверено и корректно

- **Новые тесты не декларативны.** Построчно сверил каждый новый тест с
  реализацией в `custom_components/houseplan/decor_assets.py`
  (`validate_asset`, `_validate_svg`, `asset_refs`, `asset_meta_path`,
  `read_catalog`): все `pytest.raises(..., match=...)` соответствуют
  реальным сообщениям об ошибках и реальным веткам кода (`_check_size`,
  `ext not in ASSET_EXTENSIONS`, `viewBox`-парсинг на 4 значения,
  `_validate_dimensions` safety limit, SVG text-branch, `root.is_dir()`
  false-branch, `isinstance`/regex-guard в `asset_refs`). Проверил сам,
  что тест умеет проходить не «вхолостую»: локальный прогон зелёный
  (35/35), плюс независимое подтверждение по логу реального CI на
  backend job с ростом покрытия именно целевого модуля.
- **Coverage ratchet — монотонный, не занижен.** `scripts/backend-coverage-baseline.txt`
  не менялся в этой дельте (`git diff 043aa0d8..HEAD -- scripts/backend-coverage-baseline.txt`
  пуст), остаётся `87.2`; фактическое покрытие выросло до `87.5%` за счёт
  реальных тестов, а не понижения планки — соответствует монотонному
  контракту гейта (docs/specs/042-backend-engineering-quality.md §4).
- **`smoke_gear_tabs.mjs`-правка не ослабляет проверку.** Сравнил diff:
  утверждение `out.kioskNoAddButton = !sr.querySelector('.tab.tabadd')`
  не изменилось; заменён только механизм ожидания — `page.waitForFunction`
  на появление `ha-card` в shadow root вместо гонки `setTimeout(350)` +
  форсированного переприсваивания `hass`. Т.к. Lit рендерит шаблон
  компонента одним синхронным проходом, появление `ha-card` в DOM означает
  завершение того же render()-прохода, в котором решается наличие
  `.tab.tabadd` — проверка становится детерминированной, а не слабее.
  Остальная часть файла (`res`-блок с выравниванием шестерёнок, диалогом
  создания, mobile-блок) не тронута.
- **Трейлеры и провенанс.** Оба коммита дельты несут `Issue: #51`,
  `User-Visible: no` — корректно, видимое поведение не меняется. Job
  «Предполётные проверки» (провенанс коммитов, процессный гейт) в прогоне
  33686693823 — success.
- **User-Visible.** Нет изменений в `docs/CHANGELOG*` — и не требовалось:
  диффа `src/**`/`custom_components/**` продуктового кода нет.

## Унаследовано из r1–r3 (без повторной проверки)

Дельта раунда не касается ничего из перечисленного ниже — переносится по
документам предыдущих раундов, SHA которых подтверждены как прямые предки
`HEAD` (см. цепочку merge-base выше и в `CODE-REVIEW-51-r3.md`):

- **AC1–AC4, AC6, AC8–AC13, AC16** (продуктовый контракт: upload/palette,
  furniture-parity transforms без wall magnet, raster pipeline, reusable
  lifecycle, missing-repair, import/export, i18n, unified projection) —
  из `docs/reviews/CODE-REVIEW-51-r1.md`, SHA `38205d87`, доказаны
  автотестом либо разобраны чтением.
- **High r1** (SVG DTD/entity billion-laughs, UTF-16-обход байтового
  префильтра) — закрыт `encoding-aware expat.ParserCreate()`, адверсариально
  перепроверен на 6 кодировках/вариантах в `docs/reviews/CODE-REVIEW-51-r2.md`,
  SHA `042af520`.
- **Medium r1 (3 шт.)** — `smoke_decor.mjs` на актуальном runtime API,
  единая `projectDecorImage` (устраняет «одно число — два источника» между
  full/static-рендером), positive/negative resolve-кэш — все три закрыты и
  перепроверены в `CODE-REVIEW-51-r2.md`, SHA `042af520`.
- **Low r1 (2 шт.)** — touch pointerType для snap, SVG per-attribute bounds —
  закрыты там же; третий Low (data:/javascript: substring) сознательно
  оставлен как принятый риск, запись сохраняется.
- **Medium r2** (устаревший `scripts/config-schema.json`) — закрыт,
  перепроверен в `docs/reviews/CODE-REVIEW-51-r3.md`, SHA `043aa0d8`
  (`git diff` после регенерации пуст).
- **Гейты, зелёные на `043aa0d8` и не тронутые этой дельтой:** `tsc --noEmit`,
  `npm test` (1777 passed/1 skipped), `npm run build`, `bundle:sync`,
  `bundle:budget` (291018/300000, известный долг #367), `no-new-any`,
  `check-docs.mjs --external` (отпечаток документационных скриншотов),
  `ruff check custom_components/houseplan`, golden/model-invariants
  (дельта их не касается — ни разу не тронуты с r1, продуктовый код без
  изменений).
- Model invariants (`npm run invariants`) не нужны ни в этом раунде, ни
  накопительно — diff всей задачи не создаёт новых ссылок на геометрию
  комнат/стен сверх уже проверенного в r1.

## Что проверил лично в этом раунде

- `git diff 043aa0d8..HEAD` — весь, построчно (2 файла, не считая
  опубликованного документа r3).
- `python3 -m pytest tests_backend/test_decor_assets.py -q` — 35 passed
  (локально, после `pip install pytest defusedxml Pillow`).
- `python3 -m ruff check tests_backend/test_decor_assets.py` — чисто.
- Реальные логи CI: job «Бэкенд: pytest в Home Assistant» прогона
  33685974303 (SHA `6bfa42ca`) — построчная таблица покрытия,
  `decor_assets.py` 87%, `TOTAL` 87.5% vs `baseline 87.2%`, `534 passed,
  2 skipped`; job «Смоки в браузере (шард 3 из 3)» прогона 33686693823
  (SHA `f7dfc6ca`, тот самый Validate) — `ok smoke_gear_tabs`.
- `node scripts/smoke-select.mjs --base 043aa0d8 --head HEAD` →
  «Исполняемого frontend-диффа нет (`src/**/*.ts` не тронут). Browser-smoke
  этим диффом не выбираются — выбирать нечего».
- `git diff 043aa0d8..HEAD -- scripts/backend-coverage-baseline.txt` —
  пусто, планка не занижена.
- `git merge-base --is-ancestor 043aa0d8 HEAD` — подтверждён прямой предок,
  ребейза не было.

## Что не проверял и почему

- **Полный `tsc --noEmit` / `npm test` / `npm run build` / сверка трёх
  копий бандла заново** — не прогонял: диффа `src/**` в этом раунде нет,
  а Validate на точном `HEAD` (`f7dfc6ca`, прогон 33686693823) уже зелёный
  по этим шагам (см. контекст задачи) — повторный прогон не добавляет
  информации.
- **Полный `pytest tests_backend`/HA-harness заново** — не перезапускал
  весь набор (нет пиновой версии Python 3.14/HA в песочнице ревьюера);
  вместо этого прочитал реальный лог зелёного backend job на точном SHA
  фикса (`6bfa42ca`) и убедился по построчной таблице покрытия, что
  находка r3 закрыта числом, а не декларацией. Backend job в финальном
  Validate-прогоне (`f7dfc6ca`) законно skipped как переиспользование
  идентичного backend-результата — проверил это переиспользование, а не
  принял на слово.
- **`golden:verify`, model invariants, performance-профили** — не
  прогонял: дельта раунда не трогает `src/**`, рендер, геометрию комнат/стен
  или производительные пути; этот вывод не новый — он наследуется от всех
  предыдущих раундов, где diff этих областей тоже не касался.
- **`check-docs.mjs`** — не перезапускал: диффа `src/**` нет, отпечаток
  документационных скриншотов от этого раунда зависеть не может.
- **`smoke-select` по остальным ~65 smoke-файлам** — не прогонял: сам
  инструмент подтвердил «выбирать нечего» для этой дельты (frontend-код
  не тронут); `smoke_gear_tabs.mjs`, единственный изменённый smoke-файл,
  подтверждён напрямую логом реального CI, а не инструментом выбора.
- **`node scripts/no-new-any.mjs`** — не перезапускал: дельта не содержит
  TypeScript.

## Вывод

Единственная находка r3 закрыта предметно и подтверждена числом (не
заявлением автора): покрытие `decor_assets.py` выросло с 71% до 87%,
общий coverage ratchet зелёный (87.5% vs baseline 87.2%, планка не
занижена) — подтверждено чтением реального CI-лога на точном SHA фикса.
Побочная стабилизация `smoke_gear_tabs.mjs` не ослабляет проверяемый
инвариант и подтверждена тем же реальным CI на финальном SHA. Новых
находок в дельте r4 нет. High: 0, Medium: 0.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/51-custom-decor-images`, коммит `f7dfc6cab2dd` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0fdd0e0043cec7cd4015dbcae6bc7949c4b64167`
  ```
  git log --all --format='%H %T' | grep 0fdd0e0043ce
  ```
