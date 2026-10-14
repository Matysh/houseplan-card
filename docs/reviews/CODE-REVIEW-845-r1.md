# CODE-REVIEW-845-r1

Материал: `origin/dev..HEAD`, вершина `c022eff8ad95f9ca7cf95e92f1e89594e9e2bdf0`
(база `eb53fb76`). ТЗ: issue #845, редакция 4 от 14.10.2026 (SPEC-REVIEW-845-r2,
GREEN). Трек `ask`, этап `code`, заход r1, блокирующих циклов 0/4.

## Скоуп

31 файл, 13486(+)/87(-), из них подавляющая часть строк — две JSON-фикстуры
(`test/fixtures/845-wall-corpus-identities.json`,
`test/fixtures/845-wall-identity-parity.json`). Продуктовый код:
`src/wall-segment-model.ts`, `src/wall-node-move.ts`, новый
`src/codepoint-order.ts`, `custom_components/houseplan/wall_segment_model.py`.
Остальное — тесты/харнесс (`test/wall-identity-corpus.test.mjs`,
`test/helpers/wall-identity-corpus.mjs`, `test/helpers/wall-node-parity-runner.mjs`,
`test/wall-parity-ci.test.mjs`, правки `test/wall-segment-model.test.mjs`,
`test/wall-node-move.test.mjs`, `tests_backend/wall_node_parity.py` +
их новые pytest-обёртки), CI (`validate.yml`, `scripts/check-inputs.mjs`,
`tsconfig.junction-parity.json`), 11 записей `scripts/mutation-registry.mjs`,
каноны (`CONFIG-COMPATIBILITY.md`, `WALL-THICKNESS.md`, `ARCHITECTURE.md`,
`DEVELOPMENT.md`, `STATUS.md`, `TESTING.md`), оба changelog,
`docs/release-ledger/v1.80.1/845.json`. Монолит, схема, `model_version`,
WS API, i18n — не тронуты (подтверждено `git diff --stat`).

Риск по изменённым участкам (#707) — класс **geometry**
(`wall_segment_model.py` и парный TS): все перечисленные строки относятся к
D1 (резерв id лестниц), D3 (порядок по кодовым точкам), D4 (короткое ребро),
D5 (приоритет точек разбиения), D6 (наследование толщины) и численной
канонизации (D7/«numbers») — каждая поверхность прямо названа в AC1–AC8 ТЗ.
Класс полностью покрыт AC; расширения трека не требуется.

## Как проверялось

| Гейт | Статус | Как |
|---|---|---|
| `tsc --noEmit`, `npm test` (полный), `npm run build`+bundle-policy | подтверждено ссылкой | Validate GREEN на `c022eff8`: https://github.com/Matysh/houseplan-card/actions/runs/38519078464 (#343) — не перегонялось повторно |
| `node --test test/wall-segment-model.test.mjs test/wall-node-move.test.mjs test/wall-identity-corpus.test.mjs` | **GREEN, прогнано лично** | 53/53, включая локалькомпар-пробу и корпусный guard с негативными пробами |
| `node --test test/wall-parity-ci.test.mjs` | **GREEN, прогнано лично** | 1/1 — реальный шаг `validate.yml` исполняется, пропуск `wall_node_parity.py` ловится как находка |
| `npx tsc -p tsconfig.junction-parity.json` + `fix-test-build.mjs` | **GREEN, прогнано лично** | компилирует `wall-segment-model.ts`/`wall-node-move.ts`/`junction-limits.ts` в изолированный build |
| `python tests_backend/wall_node_parity.py --build-dir=test-build/junction-parity` | **GREEN, прогнано лично** | 96 сценариев (39 partition + 21 из 845-identity + 36 комнатных) + 71 корпусный документ; 1168 переносов, 993 принятых, 993 точных browser-baseline Undo/Redo — совпадает с заявленным автором числом |
| `python tests_backend/junction_parity.py --build-dir=test-build/junction-parity` | **GREEN, прогнано лично** | 15 сценариев |
| Независимая регенерация `845-wall-corpus-identities.json` | **выполнено, совпадение байт-в-байт** | см. «Проверка паспорта» ниже |
| `pytest tests_backend` (1420/1421 по заявлению автора) | не прогнано | в этой сессии нет `pytest`/HA-harness (`.venv-backend` отсутствует); покрыто job `backend` в зелёном Validate на этом SHA |
| `ruff`, `mutation-gate --check` | не прогнано | нет venv в сессии; покрыто Validate (`changed_mutants`, `backend`) на этом SHA |
| `npm run invariants -- --config <export>` (ручной CLI) | не прогнано | AC не называет конкретный экспорт; риск уже закрыт исполняемым паритетом и корпусным guard над 71 реальным документом (см. ниже), который сильнее точечного ручного запуска |
| `ci:golden` / performance | н/п | рендер плана не тронут, AC не называет performance; метки `ci:golden` нет |

### Проверка паспорта (red witness для AC4/AC8)

Это самый важный защитный AC в задаче, и я не ограничился чтением. Поднял
`git worktree` на `a7ee8e44` (материал аналитики, тот же код, что и в
`v1.80.1` для всех четырёх поверхностных файлов — проверено пустым
`git diff --stat v1.80.1 a7ee8e44 -- <4 файла>`), собрал старый
`wall-segment-model.ts` через `tsc -p tsconfig.test.json`, подложил текущий
(новый) `test/helpers/wall-identity-corpus.mjs` и прогнал
`corpusPassport(commitWallSegmentModel, corpus)` против того же корпуса
(71 документ из 54 файлов `test/fixtures/**`, `demo/fixtures/*.mjs`,
`demo/srv/demo.html`).

- Результат **побайтно совпал** с закоммиченным
  `test/fixtures/845-wall-corpus-identities.json` (кроме поля `baseline`,
  которое само по себе и есть ссылка на этот SHA) — паспорт не выдуман, это
  честный снимок поведения ДО правки.
- Затем собрал `wall-segment-model.ts` с HEAD (`c022eff8`) и прогнал тот же
  генератор — результат тоже побайтно совпал с закоммиченным паспортом.
  Значит правка не переименовала и не переупорядочила ни одного id/ссылки
  ни в одном из 71 реальных документов репозитория и демо-стенда — именно
  то, что требует AC4/AC8.
- `test/wall-identity-corpus.test.mjs` (прогнан выше) содержит и обратную
  пробу: `assert.throws` на развороте каталога, переименовании id,
  перелинковке комнаты/проёма и непосланном новом config — все четыре
  пробы падают, то есть guard умеет краснеть, а не только зеленеть.

## Находки

Нет. High: 0, Medium: 0, Low: 0.

## Что проверено и корректно

- **D1 (id лестниц).** TS `nonCatalogIds`/`migrateRoomDraftsToPartitions`
  теперь резервируют `space.stairs` в обоих местах (`wall-segment-model.ts:240,
  720, 759`); Python уже резервировал — направление «TS как Python»
  выдержано. Мутанты `wall-identity-ts-forgets-stairs` /
  `wall-identity-python-forgets-stairs` зарегистрированы и указывают именно
  на эти строки.
- **D2 (`wall_ids`).** `wall-node-move.ts:281` теперь отказывает `invalid`
  при несовпадении длины `wall_ids`/`poly`, как Python; продуктовый путь не
  меняется (commit восстанавливает `wall_ids` сам). Мутант
  `wall-node-room-length-unchecked` цел.
- **D3 (порядок).** Общий модуль `src/codepoint-order.ts` корректно обходит
  суррогатные пары (`codePointAt` + шаг индекса 2 для code point > 0xFFFF);
  используется во всех идентичных сортировках `wall-segment-model.ts` и в
  tie-break пересечений `wall-node-move.ts:281`. Негативный тест
  («#845 wall identity is independent of String.localeCompare») подменяет
  `String.prototype.localeCompare`, бросающий исключение, и прогоняет весь
  набор — зелёный, то есть реального обращения к locale больше нет нигде на
  этом пути. Три направленных мутанта (utf16/locale/reversed) на месте.
- **D4 (короткое ребро).** Python `_atomize`: жёсткий отказ остался только
  при `length <= EPS` (вырожденный случай), а в диапазоне `(EPS, 2·eps)`
  правка просто не вставляет точки разбиения (`continue`), не трогая
  `poly`/`parents`. Поведение совпадает с тем, что TS уже делал. Подтверждено
  исполнением: `D4-degenerate-edge` в общей фикстуре по-прежнему отказывает,
  `D4-T-0.1002/0.1003/0.1004` и `D4-persisted-3.4mm` проходят и дают точный
  Undo — проверено в реальном TS/Python паритете (прогнан лично).
- **D5 (приоритет точек разбиения).** Сверил новый порядок `global_breaks`
  в Python построчно с `atomicPolyForRoom` (`wall-thickness.ts:1768–1786`):
  общие границы комнаты (считаются внутри цикла по комнате) → canonical
  zero cuts → legacy cuts → `space.walls` → opening edges — порядок
  идентичен с точностью до структуры кода. Дедупликация «ближайшая точка
  побеждает первой» сохранена в обеих реализациях.
- **D6 (наследование толщины).** `_legacy_thickness_at` воспроизводит
  `lookupWall`/`thicknessCmAt`/`exactCoveringWall` пошагово: точный key →
  совпадение по концам с допуском → угол+midpoint в пол-клетки → конечный
  tie-break по «сырой» строке. Для tie-break сознательно используется
  UTF-16BE кодирование (мимикрия под `<` в raw JS), а не codepoint-компаратор
  — в документе и в коде явно объяснено, почему это другой контракт, чем
  identity-сортировки D3. `clampWallCm`-эквивалент (`1..100`) и формат
  `Number.toString()` (`number_text`) сверены построчно с TS.
- **AC7 (числа).** Девятизначная канонизация остаётся перед генерацией
  детерминированных ключей на обеих сторонах; `1/8192` входит в общую
  фикстуру и в исполняемый паритет — пройдено лично.
- **AC6 (исполняемый паритет в CI).** `geometry_parity` теперь обязательный
  job гоняет и `junction_parity.py`, и `wall_node_parity.py`, со строгим
  списком входов в `check-inputs.mjs` (включая продуктовые файлы и все
  фикстуры/демо). `test/wall-parity-ci.test.mjs` исполняет реальный YAML-шаг
  через `runStep`, а не regex по тексту — подтверждено личным прогоном;
  тест ловит как удаление вызова `wall_node_parity.py`, так и отказ любой
  из двух команд (`exit 19`).
- **AC8 (регрессия) / общий корпус.** Независимо подтверждено (см. выше)
  побайтным сравнением на обеих версиях кода.
- Трейлеры: единственный коммит `c022eff8` несёт `Issue: #845` и
  `User-Visible: yes`; оба `docs/CHANGELOG*.md` правлены в этом же коммите;
  тексты по-русски и по-английски описывают одно и то же поведение одним
  числом изменений (нет цифр, которые расходились бы между ними).
- `docs/release-ledger/v1.80.1/845.json`: `stable-fix` обоснован —
  `git diff --stat v1.80.1 a7ee8e44 -- <4 поверхностных файла>` пуст
  (проверено лично), то есть баг жил уже в `v1.80.1`, это не
  внутри-бетная правка; `introducedBy` не требуется.
- Каноны (`CONFIG-COMPATIBILITY.md` «Stable wall identity», `WALL-THICKNESS.md`
  «Stable stored identity», `ARCHITECTURE.md`, `DEVELOPMENT.md`, `STATUS.md`,
  `TESTING.md`) описывают ровно то поведение, что в коде; расхождений не
  нашёл.
- Скоуп: других файлов вне названных в ТЗ «Файлы и модули» не тронуто
  (схема/WS API/i18n/monolith — без изменений, сверено `git diff --stat`).

## Чего не проверял

- Полный `npm test`/`tsc --noEmit`/`npm run build`+bundle-policy целиком —
  положился на зелёный Validate этого SHA (#343); прогнал только файлы,
  прямо относящиеся к #845 (53+1 тестов), лично.
- `pytest tests_backend` целиком (1420 тестов по заявлению автора) и
  `ruff` — в этой сессии нет `pytest`/виртуального окружения backend
  (`.venv-backend` отсутствует, HA harness не собирается). Это покрывается
  job'ами `backend`/`changed_mutants` зелёного Validate на этом SHA; не
  перепроверено заново.
- `npm run invariants -- --config <export>` (ручной CLI по сохранённому
  экспорту) — ни один AC не называет конкретный файл экспорта; риск по
  геометрии фактически закрыт исполняемым TS/Python паритетом и корпусным
  guard'ом, которые гоняют 71 настоящий документ (фикстуры + демо-стенд) и
  которые я лично воспроизвёл дважды (на старом и новом коде) — это строже,
  чем единичный ручной прогон инвариантов.
- Живой HA/браузер, golden/скриншоты, performance-профиль — не требуются
  AC, рендер плана не менялся, `ci:golden` не проставлен.
- Мутанты из `mutation-registry.mjs` не исполнялись (политика «только
  ночью», #709) — проверил только, что все 11 новых `find`-патчей ссылаются
  на реально существующие строки текущего кода (не regex-фикция).

## Вердикт

Зелёный. Защитные AC (1, 2, 3, 4, 5, 8) доказаны исполняемыми тестами с
подтверждённой способностью краснеть (локальный прогон локаль-пробы,
корпусный guard с четырьмя негативными пробами, реальный CI-шаг с
управляемым отказом); AC6/AC7 — исполняемым паритетом, прогнанным лично на
материале. Паспорт AC4/AC8 независимо регенерирован на старом и новом коде
и совпал побайтно в обоих случаях — это не декларация, а воспроизведённое
доказательство. Risk-строка #707 по классу geometry полностью покрыта
таблицей AC. Трейлеры, changelog, release-ledger и каноны в порядке.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/845-wall-identity-parity`, коммит `c022eff8ad95` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `457e9ddf33417f68abbb5f659513cf7d3bfe3dc0`
  ```
  git log --all --format='%H %T' | grep 457e9ddf3341
  ```
- Тело issue: `ad7288266eef9fc9115bbdd9aa6192159b6f55916f2ef9ebe36b5be4b8a2d84b`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ0ODIsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NTY3fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMjIsIm91dHB1dF90b2tlbnMiOjM1Nzg0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE0MjQyOSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjcyMDc3NzgsImNvc3RVc2RFc3RpbWF0ZSI6Mi4zNjkzNTU2fV0sInR1cm5zIjo2OSwiZHVyYXRpb25NcyI6NTk2NDI1LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi4zNzM5MjI2LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=4604 output_tokens=35801 cache_creation_input_tokens=142429 cache_read_input_tokens=7207778 num_turns=69 -->
