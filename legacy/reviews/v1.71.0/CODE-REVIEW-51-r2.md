# CODE-REVIEW — issue #51 «Custom decor images» · заход r2

- Issue: https://github.com/Matysh/houseplan-card/issues/51
- Материал раунда: `git diff 38205d87a6e65bf670e214050223a9e22a9d2a42..HEAD` (материал
  предыдущего раунда объявлен документом `docs/reviews/CODE-REVIEW-51-r1.md`,
  раздел «Материал раунда» той же ветки).
- SHA материала: `042af520fe4f6cc47d78ae6ccbb105580382e961` (сверено с
  `git rev-parse HEAD` непосредственно перед выводом — совпадает).
- SHA предыдущего раунда (r1): `38205d87a6e65bf670e214050223a9e22a9d2a42` — жив
  (не осиротел), `git cat-file -t` подтверждает.
- Трейлеры фикс-коммита `042af520`: `Issue: #51`, `User-Visible: no` (правки
  не создают нового пользовательского поведения сверх того, что уже
  задокументировано для feature-коммита `38205d87`; см. «Один вопрос про
  User-Visible» ниже).

## Скоуп раунда

Автор ответил на все содержательные находки CODE-REVIEW-51-r1 (High:1,
Medium:3, Low:2) одним коммитом `042af520` поверх `38205d87`. Дельта: 29
файлов, +831/-307 (без учёта переносимого `docs/reviews/CODE-REVIEW-51-r1.md`
и сгенерированных бандлов — предметных 8 файлов исходников/тестов). Разбор
этого раунда — **по дельте**, не по задаче целиком: ребейза на ушедший вперёд
`dev` не было (`38205d87` остаётся прямым предком `HEAD`), контракт поведения
не сменился, новая подсистема не задета. Объём дельты (8 предметных файлов, ни
одного нового модуля) заметно меньше исходной задачи (63 файла) — критерий
«разбор остаётся полным» не выполняется, сокращение объёма правомерно.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **High** — DTD/entity-фильтр обходится UTF-16 кодировкой SVG, entity bomb достигает `ET.fromstring` в обход собственной защиты | Байтовый префильтр заменён на encoding-aware `expat.ParserCreate()` с хендлерами `StartDoctypeDeclHandler`/`EntityDeclHandler`/`ExternalEntityRefHandler`/`ProcessingInstructionHandler`, которые фейлят закрыто **до** любого построения дерева; вызывается раньше `ET.fromstring` | `custom_components/houseplan/decor_assets.py:162-197` (`_reject_svg_declarations`); регрессионный тест `tests_backend/test_decor_assets.py::test_svg_utf16_doctype_is_rejected_before_entity_expansion` — **воспроизведено лично**: тест красный на `38205d87` (`DID NOT RAISE`, отдельный worktree), зелёный на `HEAD`; дополнительно я сам скормил `_reject_svg_declarations`/`validate_asset` UTF-32/UTF-32LE/UTF-32BE-кодированные billion-laughs, вариант без XML-декларации и parameter-entity/XXE-пейлоад (`SYSTEM "file:///etc/passwd"`) — все отклонены (`DTD, entities...` либо `The SVG is not valid XML`), обхода не нашёл |
| **Medium (в скоупе)** — `demo/smoke_decor.mjs` вызывает убранный делегатор `c._furnPlace` напрямую | Вызов переведён на `c._editorRuntime._furnPlace(...)`, тот же паттерн, что уже применён к `smoke_furniture.mjs` в r1 | `demo/smoke_decor.mjs:192`; **воспроизведено лично**: `node demo/smoke_decor.mjs` зелёный на `HEAD` (прогнал сам, свежая сборка) |
| **Medium (в скоупе)** — AC5 «одна projection-функция» не буквальна: дублирование формулы между `houseplan-card.ts` и `space-render.ts` | Вынесена единая `projectDecorImage(shape, w, h)` в `src/decor-assets.ts`, оба сайта её вызывают; при этом static-рендерер заодно перешёл на `normalizeAngle` (было `Number(shape.angle)\|\|0` — визуально эквивалентно, r1 сам это установил) | `src/decor-assets.ts:35-51`; `src/houseplan-card.ts:8762-8765`; `src/space-render.ts:641-644`; unit `test/decor-assets.test.mjs` сверяет точные числа (angle 405→45, flip, opacity clamp) и fail-closed `null` при `w=0` — прогнал сам, зелёный |
| **Medium (в скоупе)** — нет negative/positive-кэша resolve по `asset_id`, каждая нерелевантная правка конфига переспрашивает `houseplan/assets/resolve` | `WeakMap`-кэш в `resolveDecorAssets`, ключ — стабильный `hass.connection` (или сам `hass`) плюс полный отсортированный набор id; повторный вызов с тем же набором возвращает тот же `Map` без нового `callWS` | `src/decor-assets.ts:23,79-90`; unit `test/decor-assets.test.mjs` («missing asset ids are negative-cached...», `calls === 1` после второго вызова) — прогнал сам, зелёный; smoke `smoke_decor_images.mjs` (`staticResolveCachesCompleteAssetSet`) подтверждает на уровне `houseplan-space-card._load` — прогнал сам, `true` |
| **Low** — тач-committed размещение картинки использовало mouse-допуск снапа | `_decorImagePlace` теперь принимает `pointerType` и форвардит его в `_decorSnap`; оба вызывающих места (`_decorPointerDown`, `_furnPointerUp`) прокидывают реальный `pointerType` | `src/houseplan-editor-runtime.ts:4203,5045,5130-5134`; smoke `smoke_decor_images.mjs` (`touchCommitUsesTouchSnapTolerance`) — прогнал сам, `true` |
| **Low, информационно** — SVG numeric/string bounds отдельных атрибутов не проверялись | Добавлен `MAX_SVG_ATTR_VALUE_CHARS=65536` (лимит на одно значение атрибута) и `_validate_svg_unit_interval` для `opacity`/`fill-opacity`/`stroke-opacity`/`stop-opacity`/`offset` (конечность и диапазон 0..1 либо 0..100%) | `custom_components/houseplan/decor_assets.py:38,54-56,170-181,234-244`; тесты `test_svg_rejects_non_finite_or_out_of_range_unit_values`, `test_svg_rejects_one_oversized_attribute_before_tree_use` — прогнал сам, зелёные (и красные на `38205d87`, см. «Как проверялось») |
| **Low, информационно** — `javascript:`/`data:`-substring проверка тривиально обходима непечатным символом | **Не тронуто.** Оставляю как было принято в r1: не эксплуатируется при текущем allowlist (`href` — строгий `^#id`, единственный URL-приёмник), не архитектурный риск. **Снимаю повторно с той же записью**, фикса не требую | `custom_components/houseplan/decor_assets.py:246-248` (без изменений в дельте) |

Все шесть находок r1, требовавшие правки, закрыты предметно, не декларативно —
по каждой я либо лично проиграл регрессию (High, Medium×2 через unit/smoke),
либо прочитал изменённый код и совпадающий новый тест (оставшиеся). Седьмая
(Low-информационная про URL-substring) сознательно оставлена как есть, с тем
же обоснованием, что и в r1 — вторичной находкой её не завожу.

## Унаследовано из r1

Без повторной проверки приняты как есть — материал `docs/reviews/CODE-REVIEW-51-r1.md`
на SHA `38205d87a6e65bf670e214050223a9e22a9d2a42`, поскольку дельта их не
задевает (нет изменений соответствующих файлов между `38205d87` и `HEAD`):

- **AC1** (кнопка/palette/one-shot), **AC2** (100 см/aspect/cap 200),
  **AC4** (properties/replace/no-delete-on-replace), **AC6** (raster/SVG
  сигнатуры, атомарность аплоада), **AC8** (content-addressed id, dedup),
  **AC9** (server-side refcount, in_use), **AC10** (missing/repair
  placeholder), **AC11** (export v2/import v1 lifecycle), **AC12** (rolling
  compatibility gate), **AC13** (i18n паритет) — все проверены r1 чтением
  и/или тестами, дельта r2 их кода не меняет.
- Golden-сцены (`npm run golden:verify`, 153/153 в r1) — не перепрогонял:
  дельта не меняет визуальные числа (см. AC5 в таблице выше — новая
  `projectDecorImage` даёт **побитово те же** x/y/w/h/opacity/transform
  для валидных входов, что и было до вынесения в функцию; unit-тест сверяет
  точные значения). Полный HA-harness (`test_ha_websocket.py`,
  `test_ha_import_export.py`) — не перепрогонял по той же причине, что в r1
  (нет `homeassistant`/Pillow в песочнице ревьюера); дельта их не касается
  (`decor_assets.py` дельта — только `_validate_svg`/`_reject_svg_declarations`
  внутренние правки, вызывающий контракт не изменился).
- Bundle budget (291041 B / 300000 B, запас 8959 Б < порога 15000 Б, известный
  долг #367) — переподтверждено в этом раунде (см. «Как проверялось»), число
  практически не изменилось (было 291046 Б на предыдущей сборке автора).

## Как проверялось (гейты этого раунда)

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный |
| Unit (frontend) | `npm test` | 1778 tests, 1777 passed, 1 skipped, 0 failed |
| Build | `npm run build` | зелёный |
| Bundle sync (3 копии) | `npm run bundle:sync` | зелёный; `git status` после — чисто (dist / `custom_components/.../frontend` / build совпадают побайтово; `demo/srv/assets` не коммитится, #255 — сверено `cmp`) |
| Bundle budget | `npm run bundle:budget` | initial View 291041 B / 300000 B, запас 8959 Б — прошёл, тот же известный долг #367 |
| `no-new-any` по дельте | `node scripts/no-new-any.mjs --base 38205d87 --head HEAD` | зелёный: 51 добавленная строка в 5 файлах, новых `any` нет |
| Backend pure (целевой) | `python3 -m pytest tests_backend/test_decor_assets.py -q` | 27 passed |
| **Backend pure (полный набор, без HA-only модулей)** | `python3 -m pytest tests_backend -q --ignore=test_ha_websocket.py --ignore=test_ha_import_export.py --ignore=test_coordinate_canonicalization.py` (последний игнор — падает по отсутствию `homeassistant` уже при коллекции, не тема этой задачи) | **1 failed, 292 passed** — см. Finding 1 (новая, ниже) |
| Docs fingerprint (обязателен: дельта трогает `src/**`) | `node scripts/check-docs.mjs` | **ERROR: screenshot source fingerprint is stale** — см. Finding 1 (новая, ниже) |
| Model invariants | не прогонял | дельта не трогает `marker.space`, `open_spans`, thickness-записи, `layout` — сверено `git diff 38205d87..HEAD -- src custom_components/houseplan/*.py \| grep -E "marker\\.space\|open_spans\|layout\|thickness"`: единственное совпадение — неизменённая строка контекста (`layoutChanged` continuity-note). Инварианты нерелевантны, не пропущены |
| Целевые смоки (названные автором) | `node demo/smoke_decor_images.mjs`, `smoke_decor.mjs`, `smoke_decor_layer_order.mjs`, `smoke_furniture.mjs` | все 4 — **OK**, прогнаны лично на свежей сборке |
| Выбор дополнительных смоков по дельте | `node scripts/smoke-select.mjs --base 38205d87 --head HEAD` | 214 смоков в матрице, изменено 5 файлов `src/**`, 13 символов на изменённых строках, порог «широкого» — 42. **14 прямых совпадений**: только `smoke_decor_images.mjs` и `smoke_decor.mjs` привязаны к специфичным для дельты символам (`_decorImagePlace`, `_decorSnap`) — оба уже прогнаны выше. Остальные 12 (`smoke_drag_bounds`, `smoke_grid_snap`, `smoke_active_chain_ink`, `smoke_card_tool_conflict`, `smoke_edit_walk`, `smoke_hide_layers`, `smoke_infinite_canvas`, `smoke_island_rooms`, `smoke_junction_holes`, `smoke_junction_limits`, `smoke_partition_openings`, `smoke_wallthick_standalone`) совпали только по `NORM_W`/`_svgPoint` — распространённые символы, слабая связь (аналог `_mode`/`_config` из r1); не прогонял — непропорционально узкой дельте |
| Golden / HA full harness / performance | не прогонял в этом раунде | см. «Унаследовано из r1» — дельта не меняет визуальные числа и не касается вызывающего контракта HA-специфичных тестов; полный набор остаётся предрелизной обязанностью |

Регрессионная дисциплина «тест умеет падать» проверена мной лично, не только
по словам автора: воспроизвёл красный прогон новых тестов на предыдущем SHA —
`git worktree add --detach <tmp> 38205d87`, скопировал новый
`tests_backend/test_decor_assets.py` поверх старого `decor_assets.py` →
**6 упавших** (`test_svg_utf16_doctype_is_rejected_before_entity_expansion`,
4× `test_svg_rejects_non_finite_or_out_of_range_unit_values`,
`test_svg_rejects_one_oversized_attribute_before_tree_use`), на `HEAD` те же
27 тестов зелёные. Для demo-смоков — `smoke_decor.mjs` уже официально
воспроизведён в r1 (красный на `38205d87`, зелёный на фикс-коммите); здесь
переподтверждаю зелёный на актуальном `HEAD`.

Отдельно проверил направление фикса High-находки на предмет обхода: скормил
`_reject_svg_declarations`/`validate_asset` тем же billion-laughs payload'ом,
закодированным в UTF-32 (LE/BE/BOM), вариант без XML-декларации и
parameter-entity/XXE (`<!ENTITY % pe SYSTEM "file:///etc/passwd">`) —
все шесть вариантов отклонены (`DTD, entities...` либо невалидный XML),
самостоятельного обхода не нашёл.

## Находки

### Finding 1 (Medium, в скоупе) — манифест `scripts/config-schema.json` устарел; пере-прогон полного `tests_backend` красный

**Файлы:** `custom_components/houseplan/validation.py` (добавлен decor kind
`image`, часть исходного `38205d87`, не дельты r2), `scripts/config-schema.json`
(не обновлён ни в `38205d87`, ни в `042af520`).

`python -m pytest tests_backend -q` — стандартный гейт код-ревью «если менялся
бэкенд» (PROCESS.md §8) — **красный**:
`tests_backend/test_config_schema_manifest.py::test_issue_33_manifest_is_fresh_and_deterministic`
падает с `AssertionError: scripts/config-schema.json is stale — the schema
changed; run python3 scripts/dump-config-schema.py and commit the diff`.

Ни автор (хендофф-комментарии обоих раундов гоняли только
`test_decor_assets.py -q`), ни ревью r1 (тоже ограничилось
`test_decor_assets.py`, что явно записано в его «Гейты») этот файл не
запускали — находка не относится к дельте r2 буквально (сама схема не
менялась между `38205d87` и `HEAD`), но я обязан был прогнать полный пере-набор
по правилу «backend тронут → `pytest tests_backend`», и он красный **прямо
сейчас**, на актуальном `HEAD` этого раунда.

**Воспроизведено лично, включая причину и фикс:**
- на `origin/dev` (`e438c25e`, отдельный worktree) тот же тест **зелёный**
  (4 passed) — устаревание манифеста началось именно с фичи #51;
- на `38205d87` (материал r1, отдельный worktree) тест уже **красный**
  (1 failed, r1 просто не заметил, так как не гонял этот файл);
- `python3 scripts/dump-config-schema.py` (без HA/Pillow, только
  `voluptuous`, установленный в песочнице) добавляет **76 новых строк**
  в манифест — ровно поля новой decor-разновидности
  `config.spaces[].decor[]<image>.{asset_id,angle,color,flip_h,flip_v,h,w,x,y,
  opacity,id,kind,width,width_cm}` (наследуются от `_DECOR_COMMON` плюс новые
  `asset_id`/`flip_h`/`flip_v`); после регенерации
  `test_config_schema_manifest.py` зелёный (4 passed). Файл
  `scripts/config-schema.json` **восстановлен** мной обратно (`git checkout --`)
  сразу после проверки — рабочее дерево ревью чисто, коммитить фикс не мне.

Частичное смягчение: JS-паритет (`test/config-schema-parity.test.mjs`, все 3
подтеста) остаётся зелёным, потому что новая запись реестра
`scripts/config-field-registry.mjs` (`spaces[].decor[]<kind='image'>`) адресует
уже существующий в манифесте обобщённый путь `decor[]` через
дискриминирующий селектор, а не требует нового пути буквально — поэтому баг не
пойман фронтенд-паритетом, только python-снимком (#33 contract).

Не архитектурный риск и не влияет на рантайм пользователя — это
контрактный снимок для #33 (детерминированность схемы для будущих
потребителей манифеста). Но это реальный красный узел стандартного гейта
код-ревью, введённый именно этой задачей, и если он уедет в `dev` как есть —
это тот же класс цены, что у #230/#234/#237 («красный job до следующей
задачи»), только для `tests_backend` вместо `docs`.

**Фикс механический, в скоупе задачи, чинится тем же коммитом:**
`python3 scripts/dump-config-schema.py && git add scripts/config-schema.json`,
без изменения продуктового кода.

## Проверено и корректно

- Все шесть предметных находок r1 закрыты кодом и тестом, не только словом
  автора (таблица «Закрытие раунда r1» выше); High полностью снят, обхода
  фикса адверсариально не нашёл (UTF-32, no-declaration, parameter-entity/XXE).
- `projectDecorImage` — единственная точка формулы проекции для full View и
  `houseplan-space-card`, устраняет класс «одно число — два источника»
  (#233/#234): сверено побитово через unit-тест с конкретными числами
  (не тавтология).
- Negative/positive resolve-кэш не меняет наблюдаемое поведение для
  пользователя (та же итоговая карта ассетов), только убирает лишние WS-вызовы;
  единственный найденный мной остаточный (не блокирующий) кейс — если один и
  тот же уже закэшированный как «отсутствующий» `asset_id` внезапно появится на
  сервере (переливка того же контента) без изменения набора id, шаг
  `resolveDecorAssets` с тем же ключом вернёт закэшированный (устаревший)
  результат до следующего изменения набора id или перезагрузки страницы.
  Практически недостижимо: контент-адресация делает такой сценарий
  «удалили → залили обратно тот же файл» единственным триггером, а
  server-side refcount (AC9) не доверяет клиентскому кэшу при удалении — то
  есть безопасность не страдает, только витрина может на короткое время
  отставать. **Low, снимаю с записью**, фикс не требую.
- Touch-committed размещение и SVG per-attribute границы — фикс подтверждён
  и кодом, и тестом (unit + smoke), поведение соответствует заявленному в r1
  направлению.
- Три копии бандла синхронны, бюджет не превышен (тот же известный долг #367).

## Чего не проверял

- Полный HA-harness (`test_ha_websocket.py`, `test_ha_import_export.py`) —
  как и в r1, нет `homeassistant`/Pillow в песочнице; дельта r2 не меняет
  вызывающий контракт этих модулей (только внутренности `_validate_svg`).
- Golden (`npm run golden:verify`) и performance-профиль — не перепрогонял;
  дельта не меняет визуальные числа (см. «Унаследовано из r1»), полный набор
  остаётся предрелизным.
- 12 из 14 «прямых совпадений» `smoke-select` — не прогонял, слабая связь по
  распространённым символам (`NORM_W`, `_svgPoint`), не специфичным для
  дельты; решение по каждой строке см. таблицу «Как проверялось».
- Точный количественный эффект resolve-кэша на числе живых WS-вызовов в
  большом плане (AC14, 1000 записей) — принял unit-тест (`calls === 1` после
  повторного вызова) и smoke (`staticResolveCachesCompleteAssetSet`) как
  достаточное доказательство контракта, не гонял отдельный
  performance-профиль.
- Не проверял, ломает ли отсутствие регенерации `config-schema.json` что-либо
  за пределами самого `test_config_schema_manifest.py` (например, внешние
  потребители манифеста вне репозитория) — вне доступного мне материала.

## Один вопрос про `User-Visible`

Коммит `042af520` помечен `User-Visible: no`. Формально верно для
security/perf/consolidation-правок (SVG-валидатор, кэш, дедуп formula) — они
не меняют то, что видит пользователь. Но правка touch-снапа (Finding 5 из r1)
меняет реально ощутимое поведение при размещении картинки пальцем/пером
(допуск снапа расширяется до тач-радиуса). Поскольку вся фича #51 ещё не
проходила через бету (issue остаётся в `S6`/`S7`, ни разу не публиковался с
этим багом), пользователь никогда не видел прежнего (более тесного) допуска
на релизе — упоминать это отдельной строкой changelog не требуется; исходная
запись фичи в `docs/CHANGELOG.md`/`.ru.md` (добавленная в `38205d87`) уже
покрывает завершённое поведение целиком. Не находка, оставляю как
рассуждение для протокола.

## Вердикт

Единственная блокирующая (High) находка r1 закрыта и лично проверена
адверсариально. Все Medium/Low из r1 закрыты предметно. Новая находка этого
раунда — Medium в скоупе, механический фикс (`scripts/config-schema.json`
регенерация), без архитектурного риска и без High. По правилу §2.7 это
жёлтый вердикт: возврат автору, фикс проходит следующий цикл ревью.

Вердикт: жёлтый · заход r2 · блокирующих циклов 2/4 · High: 0 · Medium: 1 → в задаче

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/51-custom-decor-images`, коммит `042af520fe4f` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `460c8f2339fbae285d0e53cb6dbb177c935ce573`
  ```
  git log --all --format='%H %T' | grep 460c8f2339fb
  ```
