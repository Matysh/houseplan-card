# CODE-REVIEW — issue #51 «Custom decor images» · заход r1

- Issue: https://github.com/Matysh/houseplan-card/issues/51
- Материал: `git log origin/dev..HEAD`, `git diff origin/dev...HEAD`
- SHA материала: `38205d87a6e65bf670e214050223a9e22a9d2a42` (сверено с
  `git rev-parse HEAD` непосредственно перед выводом)
- База: `origin/dev` = `e438c25ebe5ffbd4214da473d62a305016a3f3df`
- Ветка приведена к `dev` конвейером до ревью (8 коммитов dev поверх исходного
  `c4e45aa9`, итог — единственный ребейзнутый коммит `38205d87`). Это другой код
  (§7.2) — разбор ниже полный, не по дельте. Второго раунда до этого не было,
  поэтому раздел «Унаследовано из r<N-1>» не применяется.
- Трейлеры коммита `38205d87`: `Issue: #51`, `User-Visible: yes` — оба
  changelog правлены в этом же коммите (проверено, см. «Гейты»/AC16).

## Скоуп изменения

Новый decor kind `image`: приватное content-addressed хранилище
PNG/JPEG/WebP/SVG (backend `decor_assets.py`, `http_api.py`, `websocket_api.py`,
`validation.py`, `import_export.py`, `const.py`), одна кнопка «Изображение» в
Background editor, furniture-parity transforms без wall magnet, palette с
явным удалением неиспользуемого файла, отображение в full View и
`houseplan-space-card`, missing-asset repair-placeholder, export v2/import v1
совместимость, i18n RU/EN/DE/FR, документация. 63 файла, ~4200/1200 строк.
Спека `docs/specs/051-custom-decor-images.md` (16 AC) прошла ревью ТЗ зелёным
(`docs/reviews/SPEC-REVIEW-51-r1.md`, единственная находка — Low, косметика).

## Как проверялось

Ревью выполнено чтением всего диффа (`git diff origin/dev...HEAD`) плюс двумя
параллельными агентами: один разобрал backend security (`decor_assets.py`,
`http_api.py`, `websocket_api.py`, `validation.py`, `import_export.py`,
`tests_backend/*`), второй — frontend (`decor-assets.ts`,
`houseplan-editor-runtime.ts`, `space-render.ts`, `space-geometry.ts`,
`houseplan-card.ts`, `backdrop-pick.ts`, `test/decor-assets.test.mjs`,
i18n). Их находки перепроверены мной лично там, где это осмысленно (см. ниже):
самое серьёзное — воспроизведено собственноручно, не принято на слово.

### Гейты — что прогнано и результат

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный |
| Unit | `npm test` | 1775 passed, 1 skipped, 0 failed (1776 подтестов) |
| Build | `npm run build` | зелёный |
| Bundle sync | `npm run bundle:sync` | зелёный, `git status` после — чисто (три копии совпадают) |
| Bundle budget | `npm run bundle:budget` | initial View 291026 B / 300000 B — **прошёл**, но запас 8974 Б < порога 15000 Б (предупреждение скрипта, ссылка на #367). Не блокирует, но следующая фича упрётся в стену бюджета — стоит упомянуть автору |
| Backend pure | `python3 -m pytest tests_backend/test_decor_assets.py -q` (без Pillow/HA в песочнице ревьюера) | 21 passed |
| Golden | `npm run golden:verify` | 153/153 passed — существующие сцены не пострадали от нового decor-слоя |
| Docs fingerprint | не прогонялся отдельно — `npm run build`/`bundle:sync` не жаловались; diff `src/**` есть, но `docs`-скриншот-гейт CI не эмулировался локально (нет соответствующего npm-скрипта в перечне пройденных мной команд) | **не проверял**, см. «Чего не проверял» |
| Model invariants (`npm run invariants`) | не прогонялся | diff не трогает `marker.space`, `open_spans`, thickness-записи, `layout` (проверено grep по `src/` и `custom_components/houseplan/*.py` — совпадений нет); decor — не геометрия комнат/стен. Инварианты сочтены нерелевантными, не пропущенными |
| smoke_decor_images.mjs, smoke_decor_layer_order.mjs, smoke_furniture.mjs (названы автором) | `node demo/<file>` | OK (переподтверждено) |
| Дополнительные smoke по `smoke-select.mjs` (см. ниже) | `node demo/<file>` × 11 | 10 зелёных, **1 красный — см. Finding 2** |
| `python -m pytest tests_backend/test_ha_websocket.py test_ha_import_export.py` (полный HA-harness) | — | **не прогонял**: нет `homeassistant`/Pillow в песочнице ревьюера (по канону AGENTS.md — Linux CI/WSL). Разобрано чтением (см. ниже) |

### Выбор дополнительных smoke (`scripts/smoke-select.mjs --base origin/dev --head HEAD`)

Инструмент: изменено 10 файлов `src/**`, 146 символов на изменённых строках,
порог «широкого» символа — 42. 67 файлов дали **прямое совпадение**, 48 —
слабую связь. Полный прогон всех 67 непропорционален задаче (диапазон широк
из-за общих символов `_curSpaceCfg`/`_mode`/`_config`/`_saveConfig` — они везде).
Прогнал 11 из прямых совпадений, выбранных по риску: `smoke_decor.mjs`
(общий decor-контракт), `smoke_furniture_polish.mjs` (transform-код теперь
общий с image), `smoke_grid_snap.mjs`, `smoke_hide_layers.mjs` (AC5
`hide_decor`), `smoke_wall_junctions.mjs` (**прецедент #234** — по имени про
стыки стен, ранее ловил регресс толщины из внешне не связанного изменения),
`smoke_backdrop_guard.mjs` (переиспользован в `backdrop-pick.ts` для
upload-диалога), `smoke_space_card.mjs`, `smoke_space_card_bg.mjs` (AC5 static
card parity), `smoke_sign_cap.mjs`, `smoke_plan_signed.mjs` (contentsigning),
`smoke_infinite_canvas.mjs` (`decorBoxItem`/«Вписать всё»).

Результат: 10 OK, **1 упал** — `demo/smoke_decor.mjs` (см. Finding 2). Не
прогонял оставшиеся ~56 прямых совпадений и все 48 слабых связей — не
пропорционально задаче; полный набор остаётся обязанностью пре-релиза.

## Находки

### Finding 1 (High) — SVG-санитайзер обходится кодировкой UTF-16: entity-bomb достигает `ET.fromstring` в обход собственной защиты от DTD/entity

**Файл:** `custom_components/houseplan/decor_assets.py:161-172`.

Проверка DTD/entity/PI — это префильтр по байтовым ASCII-подстрокам
(`b"<!doctype"`, `b"<!entity"`, `b"<?xml-stylesheet"`, а также отдельная
проверка `b"<?" in without_declaration`) поверх `data.lower()`. Она ничего не
находит, если файл закодирован в UTF-16 (каждый ASCII-символ перемежается
нулевым байтом), поэтому строка `b"<!doctype"` физически отсутствует в байтах,
хотя после декодирования это валидный `<!DOCTYPE`. `ET.fromstring(data)` в
строке 170 — это `xml.etree.ElementTree` поверх expat, который **сам
автоматически определяет кодировку по BOM** и раскрывает DTD/entity без
собственной защиты от экспоненциального разрастания (в отличие от
`defusedxml`, который здесь не используется нигде).

**Воспроизведено лично** (не только со слов агента): собрал classic
"billion laughs" (5 уровней вложенности `<!ENTITY a0>`…`<!ENTITY a4>`,
исходный размер ~800 байт), закодировал в UTF-16, скормил
`custom_components/houseplan/decor_assets.validate_asset`. Результат:
файл ушёл дальше строки 170 (`ET.fromstring` успешно раскрыл entity — сам
разросшийся текст, ~32 000 символов, дошёл до элемента `<title>` и был отклонён
**только** последующей проверкой длины текста `title`/`desc` — то есть
раскрытие уже произошло и уже стоило памяти/CPU **до** того, как сработал
любой из декларированных в ТЗ лимитов «element/depth/attribute» (они
применяются в цикле по уже построенному дереву, а не во время парсинга).
Если поместить растущую сущность не в `<title>`, а в атрибут вроде `d`, до
неё вообще не дойдёт ни один из этих лимитов раньше, чем `ET.fromstring`
целиком построит раздутое дерево в памяти — при нескольких дополнительных
уровнях вложенности из файла кратно меньше 2 МиБ получается экспоненциальный
рост в память/CPU, всё в HA executor-потоке (не фризит event loop, но реально
грузит воркер и память процесса HA — то есть DoS на типичном для HA
маломощном хосте).

Это прямой пробой явно заявленного в ТЗ контракта («XML parser запрещает DTD,
entity declarations/resolution» и «Risks»/«Streaming byte cap ставится до
parse, затем element/depth/... limits») — контракта, который является
центральным для issue с меткой `security`. Ни один существующий тест не ловит
этот класс обхода: `tests_backend/test_decor_assets.py:38` содержит DOCTYPE/
entity-кейс, но только в ASCII-кодировке — «тест умеет падать» на прямой ASCII
атаке, но не умеет упасть на этой (кодировочной) вариации, а значит не
доказывает заявленный AC7 целиком.

**Направление фикса** (не мне решать точный путь — это техническое
предположение автора): использовать `defusedxml.ElementTree.fromstring` (или
явно сконфигурировать expat-парсер так, чтобы `StartDoctypeDeclHandler`/
`EntityDeclHandler` фейлили закрыто) вместо байтового префильтра — это
единственный способ не зависеть от кодировки на входе.

**Блокирует.** AC7 не может считаться доказанным до исправления.

### Finding 2 (Medium, в скоупе) — диф ломает существующий, не относящийся к задаче smoke: `demo/smoke_decor.mjs`

**Файлы:** `src/houseplan-card.ts` (диф убирает делегатор), `demo/smoke_decor.mjs`
(не тронут этим diff, но полагается на убранный метод).

`git diff origin/dev...HEAD -- src/houseplan-card.ts` убирает из класса
`HouseplanCard` тонкие делегаторы `_furnPlace`, `_furnPick`, `_furnFieldValue`,
`_furnFieldToCm`, `_furnMoveUpdate`, `_decorApplyBox`, `_renderFurnPalette`,
`_renderFurniturePlacementPreview` и др. (были вида
`private _furnPlace(...) { return this._editorRuntimeOrThrow()._furnPlace(...); }`)
— методы теперь живут только внутри `HouseplanEditorRuntime` и вызываются как
`this._furnPlace(...)` изнутри самого runtime, что не ломает ни один реальный
пользовательский сценарий (пользователь не видит разницы). Но
`demo/smoke_decor.mjs:192` вызывает `c._furnPlace(...)` напрямую на элементе
карточки — это существующая (не относящаяся к image) конвенция теста.

Автор **знал** про эту архитектурную смену: `demo/smoke_furniture.mjs` в этом
же diff переписан с `c._furniturePreviewPlacement` на
`c._editorRuntime?._furniturePreviewPlacement()` ровно по этой причине. Но
`smoke_decor.mjs` пропущен — не входил в список прогнанных автором smoke
(«node demo/smoke_decor_images.mjs — OK; …smoke_decor_layer_order.mjs — OK;
…smoke_furniture.mjs — OK» — `smoke_decor.mjs` в списке нет).

**Воспроизведено лично, дисциплина «тест умеет падать» подтверждена в обе
стороны:**
- на `HEAD` (`38205d87`): `node demo/smoke_decor.mjs` → `TypeError: c._furnPlace
  is not a function`, процесс падает с ненулевым кодом;
- на базе (`origin/dev` = `e438c25e`, отдельный `git worktree`, свежая
  пересборка): тот же smoke проходит полностью, `OK`.

Других мест, вызывающих остальные убранные делегаторы напрямую на `c.`, не
нашлось (`grep` по `demo/*.mjs test/*.mjs` — пусто) — поражение точечное,
единственный файл.

Это не поведенческий дефект для пользователя, но это красный существующий
гейт, который переживёт этот раунд ревью незамеченным, если его не запустить
специально (что и произошло — автор его не запускал), и всплывёт при
следующем полном пре-бета прогоне ровно по сценарию #230/#234/#237 («красный
job до следующей задачи»). Фикс механический — тот же паттерн, что уже
применён к `smoke_furniture.mjs`. В скоупе задачи (тот же файл
`houseplan-card.ts`, тот же коммит), чинится в этом же issue, отдельный issue
не заводится (#202).

### Finding 3 (Medium, в скоупе) — «единая проекционная функция» AC5 не буквальна: рендер дублирован между View и Background editor

**Файлы:** `src/houseplan-card.ts:8762-8779` (Background editor слой) и
`src/space-render.ts:636-655` (View/space-card слой).

Оба места независимо собирают одну и ту же трансформ-строку
(`translate(cx cy) rotate(angle) scale(±1 ±1) translate(-cx -cy)`) и клэмп
`opacity` — но как две раздельные реализации, а не единая функция, которую оба
вызывают. Спека прямо требует: «Полный View и `houseplan-space-card`
используют одну **projection-функцию**». `houseplan-card.ts` использует
`normalizeAngle`, `space-render.ts` — свой `Number(shape.angle) || 0`; сегодня
они численно эквивалентны (период вращения, одинаковая трактовка нечисловых
значений), видимого дефекта нет.

Это ровно класс проблемы из «Одно число — один источник»: #233/#234 родились
из двух независимых формул для «одного и того же» значения, которые молча
разошлись при последующей правке одной из копий. Конкретный сценарий отказа:
кто-то поправит клэмп `opacity` в одном файле (например, изменит fallback с 1
на «унаследовать предыдущее значение») и не тронет второй — тогда full View и
`houseplan-space-card` отрисуют один и тот же `DecorImage` с разной
прозрачностью, и ни один unit-тест этого не поймает (существующий
`furniture-stroke-contract` проверяет паритет preview/placement для мебели,
не paritet View/static-card для image). Единственная защита сегодня — ручное
внимание при следующей правке.

В скоупе (оба файла в этом же diff), чинится в этом же issue сведением к одной
экспортируемой функции проекции.

### Finding 4 (Medium, в скоупе) — нет negative/positive-кэша resolve по `asset_id`; явное требование производительности из ТЗ не выполнено

**Файл:** `src/decor-assets.ts` (`resolveDecorAssets`, batching по 200,
дедупликация `Set` — есть), вызовы `houseplan-card.ts:4310` и
`space-card.ts:732`.

Спека, раздел «Производительность»: «Missing ids также negative-cache-ятся на
текущую config revision». Кэша (ни отрицательного, ни положительного) нет:
`_syncDecorAssets`/`_load` перевызывают `houseplan/assets/resolve` при каждом
`onConfigChange`/`_reloadConfigOnly`, включая случаи, когда набор
`decorAssetIds` не изменился и/или id уже был подтверждён отсутствующим
секундой раньше. Конкретный сценарий: план с одним missing image; любая
структурная правка в редакторе (подвинуть мебель, переименовать комнату) шлёт
`resolve` заново на тот же уже-известный-missing id — вместо нуля запросов на
не относящуюся к декору правку получаем один WS-вызов на каждое изменение.
AC14 (1000 записей, ограниченный resolve) формально проходит благодаря одной
только батч-дедупликации на батч в 200 — тест не проверяет повторные вызовы
между разными конфиг-ревизиями, поэтому пропускает именно то отклонение,
которое здесь описано.

В скоупе (тот же новый файл), не архитектурный блокер, но явно
недовыполненный пункт спеки — годится для правки в этом же issue.

### Finding 5 (Low) — тач-committed размещение всегда использует mouse-допуск снапа, не touch

`src/houseplan-editor-runtime.ts:5130-5150`: `_decorImagePlace` вызывает
`this._decorSnap(raw)` без `pointerType`, получая допуск по умолчанию
(`'mouse'`, ~8px) даже когда коммит пришёл с тач-пути (`_furnPointerUp`
не прокидывает `pending.pointerType`, в отличие от `_furnPlace`, который
явно форвардит его дальше). Практический эффект — тач-размещение картинки
получает более тесный магнит, чем предусмотренный touch-радиус (~14px);
паритет с мебелью небольшой, не架构ный. Можно поправить или снять с записью.

### Finding 6 (Low, информационно, не находка) — SVG: числовые/строковые bounds отдельных атрибутов не проверяются, только допустимость имени

`custom_components/houseplan/decor_assets.py` ограничивает суммарный бюджет
символов атрибутов (`MAX_SVG_ATTR_CHARS=512000`) на весь документ, но не
проверяет диапазон/конечность значения отдельных атрибутов (`transform`,
`stroke-width`, `opacity` и т. п. — только их допустимость по имени). Спека
формулирует это как «числовые/строковые bounds» для этих атрибутов. Поскольку
SVG вставляется только как `<image>` (изолированный растровый контекст в
браузере, не inline DOM — см. п. 6 «Отображение и слои»), практический риск —
не XSS/SSRF, а максимум деградация рендера самого файла в собственном
изолированном контексте. Не блокирует, не Same класс, что Finding 1 (там
пробита реальная защита от конкретной атаки; здесь просто не реализован явно
заявленный, но не критичный по факту изоляции пункт спеки). Годится либо
поправить, либо явно снять с owner-note в спеке «принято предположительно».

### Finding 7 (Low, информационно) — javascript:/data:-substring проверка в SVG сама по себе тривиально обходима, но не является рабочей защитой

`decor_assets.py:207-209`: проверка `low` на подстроки `javascript:`, `data:`,
`http:`, `https:`, `//` теоретически обходится непечатным символом внутри
схемы (например, табуляцией), но это не единственная защита — `href`
дополнительно ограничен строгим `^#id`, и ни один другой allowlisted атрибут не
трактуется как исполняемый URL-приёмник. Не эксплуатируется при текущем
allowlist. Отмечено для полноты, не как отдельный блокер.

## Проверено и корректно (по AC)

- **AC1** (кнопка/palette/one-shot) — подтверждено чтением +
  `demo/smoke_decor_images.mjs` (прогнан, OK) + переподтверждено фронтенд-агентом
  построчно (`houseplan-editor-runtime.ts:5875`, `:5130-5148`, `:5909`).
- **AC2** (100 см / aspect / cap 200) — `initialDecorImageCm`
  (`src/decor-assets.ts:66-76`) единая функция и для preview, и для commit;
  unit `test/decor-assets.test.mjs` покрывает cap-кейс реальными числами
  (400×200→100×50, 100×400→50×200 с реальным capping, не тавтология).
- **AC3** (furniture-parity, без wall magnet, hit-area — весь прямоугольник) —
  подтверждено: wall magnet явно гейтится `kind === 'furniture'`
  (`houseplan-editor-runtime.ts:4316`), image идёт через общий
  decor/room-магнит; `pointer-events: bounding-box` в
  `src/styles/plan.styles.ts` для `.dimage`/`.dimage-missing`. Демо-негативный
  свидетель есть (`noFurnitureWallMagnet`), хоть и не самый сильный (см. отчёт
  агента — не заводит отдельную находку, слабое место без конкретного сценария
  отказа).
- **AC4** (properties/replace/no-delete-on-replace) — подтверждено чтением
  (`_decorSaveShape` пишет только по `shape.id`, replace меняет только
  `asset_id` выбранного объекта) + smoke.
- **AC5** (общий рендер, hide_decor, пассивность) — hide_decor и pointer-inert
  подтверждены в обоих файлах; «одна проекционная функция» — см. Finding 3
  (дублирование, не расхождение сегодня).
- **AC6** (raster/SVG сигнатуры, лимиты, атомарность) — подтверждено чтением
  `decor_assets.py`/`http_api.py` + `test_ha_websocket.py` (согласно отчёту
  агента: concurrent-upload dedup тест реально бы упал без lock/atomic-rename)
  — проверено чтением, не исполнением (HA-harness недоступен в песочнице
  ревьюера).
- **AC7** (SVG allowlist, sandbox headers) — **не полностью доказан**, см.
  Finding 1 (High). Заголовки (exact MIME, nosniff, sandbox CSP) подтверждены
  чтением `http_api.py:195,211-213`.
- **AC8** (content-addressed id, dedup) — подтверждено: `asset_id` есть
  sha256 канонических байт (`decor_assets.py:71-72`), resolve/GET
  перепроверяют хэш на каждое чтение.
- **AC9** (server-side refcount, in_use, no auto-cleanup) — подтверждено:
  delete не принимает client refcount вообще, пересчитывает под
  `write_lock`+`upload_lock` из `config_store` (`websocket_api.py:1164-1190`);
  `test_ha_websocket.py` содержит race-тест на `in_use` и идемпотентность —
  проверено чтением утверждений теста, не исполнением.
- **AC10** (missing asset/repair) — подтверждено: View возвращает `[]` при
  пустом `href`, editor рисует selectable placeholder с «Заменить»; smoke
  покрывает.
- **AC11** (export v2/import v1, manifest без байт) — подтверждено чтением
  `import_export.py`: `_internal_path` строгий regex на 64-hex+расширение
  (защита от path traversal), `content_manifest` пересчитывает hash с диска
  (не доверяет заявленному), импорт помечает `missing_preserved` без удаления
  geometry.
- **AC12** (rolling compatibility) — backend: схема аддитивна (`vol.Any`),
  `decor_assets_api: 1` отдаётся безусловно; frontend fail-closed gate
  подтверждён (`houseplan-card.ts:4300-4306`, `_haDecorAssetsApi` сверяется с
  `DECOR_ASSETS_API_VERSION` перед показом кнопки/upload).
- **AC13** (i18n паритет) — подтверждено программно: ключи en/ru/de/fr
  идентичны построчно (сверка множеств ключей, разницы нет).
- **AC14** (bounded batched resolve) — батчинг/дедуп на вызов подтверждён;
  явно заявленный negative-cache отсутствует, см. Finding 4.
- **AC15** (гейты зелёные, targeted smoke до ревью) — typecheck/test/build
  зелёные лично переподтверждены; targeted-смоки, названные автором, зелёные;
  smoke_decor.mjs красный — см. Finding 2 (это не входит в AC15 буквально,
  так как AC15 требует только «targeted image smoke», но красный существующий
  smoke — самостоятельная находка).
- **AC16** (документация/changelog) — подтверждено: `DECOR-EDITOR.md`,
  `ARCHITECTURE.md`, `CONFIG-COMPATIBILITY.md`, `USER-GUIDE.md`/`.ru.md`,
  `TESTING.md`, `TESTING-DEMO.md` правлены; оба changelog в этом же
  `User-Visible: yes` коммите (проверено `git show --format=%b`).

## Чего не проверял

- Полный HA-harness (`tests_backend/test_ha_websocket.py`,
  `test_ha_import_export.py`, concurrency/race-тесты, golden HA-фикстуры) — в
  песочнице ревьюера нет `homeassistant`/Pillow (по канону AGENTS.md это
  Linux CI/WSL-only гейт), запуск дал бы молчаливый skip, а не
  доказательство. Разобрано **чтением** утверждений тестов и сверкой с кодом
  (см. AC6/AC9/AC11 выше) — не исполнением.
- Полный `demo/smoke_*` набор (214 файлов, 67 прямых совпадений) — прогнал 14
  из них (3 названных автором + 11 отобранных по риску), не 67. Оставшиеся ~53
  прямых совпадения и 48 слабых связей не прогнаны — непропорционально
  объёму задачи; остаются обязанностью пре-бета прогона (AGENTS.md).
  Вывод `smoke-select.mjs` приложен выше целиком со списком «прямое совпадение»/
  «слабая связь», решение по каждой из непрогнанных строки не расписано
  построчно — учтён общий довод (общие символы `_mode`/`_config` дают широкий,
  малоинформативный список).
- Performance smoke / large-house 1000-record профиль (AC14 численно) — не
  прогонял; это предрелизный гейт, доказательство AC14 принято чтением
  батчинг-кода + unit-теста дедупликации.
- `npm run docs:check`/`scripts/check-docs.mjs` (screenshot fingerprint) —
  не нашёл отдельного npm-скрипта с таким именем в `package.json`, не
  прогонял отдельно; `npm run build`/`bundle:sync` не жаловались на
  fingerprint-рассинхрон, но это не то же самое утверждение.
- Точный численный порог AC2 «bounds» на промежуточных `cell_cm`/DPI
  комбинациях сверх того, что покрывает `test/decor-assets.test.mjs`, — принял
  unit-покрытие как достаточное доказательство, не гонял ручной матрицы.
- Touch/accessibility (AC13 non-i18n часть: 44×44 таргеты, focus trap, aria) —
  не тестировал в браузере руками (ручного тестирования в цикле нет по
  процессу); принял на основе чтения CSS/aria-атрибутов в diff, не
  верифицировал реальным screen-reader/touch-эмулятором.

## Материал раунда

- Ветка на момент вывода: `38205d87a6e65bf670e214050223a9e22a9d2a42`
  (сверено `git rev-parse HEAD` непосредственно перед выводом — совпадает).
- База: `origin/dev` = `e438c25ebe5ffbd4214da473d62a305016a3f3df`.
- Предыдущего кодового раунда не было (это r1 code review); раздел
  «Закрытие предыдущего раунда» неприменим.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/51-custom-decor-images`, коммит `c4e45aa99c63` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `5fe4f2859927979f0fdec07a24b989a67c5ccb38`
  ```
  git log --all --format='%H %T' | grep 5fe4f2859927
  ```
