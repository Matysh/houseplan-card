# CODE-REVIEW-1009-r2

Issue: #1009 · этап code · трек `show` (owner-подтверждённый меткой `track:show`).
Заход: r2 · блокирующих циклов израсходовано 1 из 2.
Материал: `4b8c568b9ac2b9273690b78ae64a2fb76e25cdb7` (рабочая копия на нём,
`git rev-parse HEAD` сверен — совпадает). База `origin/dev` ушла на 3 коммита
вперёд материала (track:show, #696): ветка не приводилась к dev, материал —
как есть; ребейз — один раз, при слиянии, под Validate.
Политика побочных находок: снимок `mode:"issues"` сверен байт-в-байт с
`$REVIEW_FINDINGS_POLICY` (issue 1009, stage code, round 2, path null).
Маршрут побочных находок не задействован — побочных находок нет.

## Скоуп

Делта r1→r2 — ровно один новый коммит `4b8c568b9` поверх материала r1
(`8e0761ef21f9`): «docs(vacuum): keep raster guard notes in subsystem guide».
Это прямой фикс единственной находки r1 (Medium, в скоупе: добавленный в
`docs/TESTING.md` абзац поднял файл с 880 до 891 строк и сломал его
собственный гейт `test/testing-doc.test.mjs`, #681/#898). Правка переносит тот
же абзац — без изменения содержания утверждений — из общей инструкции
`docs/TESTING.md` в канонический документ подсистемы `docs/VACUUM.md`, рядом
с существующим разделом про Ecovacs. Диффа класса A по-прежнему нет: только
`docs/TESTING.md` (-11), `docs/VACUUM.md` (+10) — оба класс C. Исполняемый
смок `demo/smoke_vacuum_ecovacs.mjs`, `docs/STATUS.md` и
`docs/release-ledger/v1.82.0/1009.json` в дельте не менялись.

`docs/SCOPE.md`: правка документационная, перемещает уже зафиксированное
описание гарда между двумя каноническими файлами — не добавляет функций и не
затрагивает ни одну строку Core user jobs напрямую; обслуживает ту же
доказательную базу J1 (растровая карта Ecovacs), что и r1.

### Критерии §5 (track:show) — route

Дельта не меняет ни один из шести критериев относительно разбора r1:
- complexity: перенос одного абзаца между двумя doc-файлами — ≤3.
- surfaces: одна поверхность (документация одного гарда).
- migration: нет.
- ux-contract: `User-Visible: no` в коммите, видимое поведение карточки не
  затронуто (диффа `src/**`/`custom_components/**` по-прежнему нет).
- perf-touch: не затронуты.
- undocumented: содержание абзаца не изменилось при переносе (см. сверку
  текста ниже) — то же самое поведение гарда остаётся зафиксированным, теперь
  в более подходящем каноническом месте (`VACUUM.md` входит в список
  канонических документов подсистем, `AGENTS.md`).

Все шесть критериев пройдены → **`route: fix`**.

## Как проверялось

| Гейт | Статус | Источник |
|---|---|---|
| `npx tsc --noEmit`, `npm test` (полный), `npm run build`+`bundle-policy --verify` | подтверждено | Validate на материале `4b8c568b9`, run success: https://github.com/Matysh/houseplan-card/actions/runs/39724006576 (headSha сверен `gh run view --json headSha` → совпадает) — не перегонял по правилу «дешёвые гейты на этом SHA уже подтверждены» |
| `node --test test/testing-doc.test.mjs` (адресно, дельта r1→r2) | PASS, 2/2, исполнено мной | подтверждает закрытие находки r1 отдельно от Validate: `docs/TESTING.md` снова ≤880 строк, тест `#681 TESTING.md: инструкция не длиннее 880 строк…` зелёный |
| `wc -l docs/TESTING.md` | 880 | ровно на пределе, как и до правки r1 |
| Сверка текста перенесённого абзаца (TESTING.md до r1 vs VACUUM.md после r2) | прочитано построчно | то же утверждение: ожидание detach диалога, неизменный предикат B−R>50/B−G>40/>1000, негативный прозрачный PNG через тот же screenshot/count путь, отсутствие platform skip/delay/retry, headless-граница доказательства — перенесено без ослабления |
| Битые ссылки на старое место абзаца | нет | `grep -rn "Ecovacs raster proof\|ecovacs-raster\|smoke_vacuum_ecovacs" docs/*.md` — только `DEVELOPMENT.md` (независимая строка о `bundle:sync`) и `mutation-browser-guards.md` (идентификатор мутанта, не абзац) |
| `node scripts/status-snapshot.mjs --write` (регенерация) | без диффа к закоммиченному | числа `docs/STATUS.md` не дублированы вручную, делта r1→r2 их не трогает |
| `git diff --check` | PASS | пробелов/конфликтов нет |
| `git merge-tree --write-tree HEAD origin/dev` | exit 0, заявлено автором | слияние чистое (track:show, #696 — не повод ребейзить сейчас) |
| `gh run view 39724006576 --json headSha,conclusion` | headSha=`4b8c568b9...`, conclusion=success | подтверждает, что ссылка Validate относится ровно к материалу этого раунда, а не к более старому коммиту |

### Гейты, которые НЕ перегонялись в r2, и почему

- Полный `npm test`, `npx tsc --noEmit`, `npm run build`+bundle-policy — уже
  зелёные на этом точном SHA в Validate (см. таблицу); перегон добавил бы
  только дублирующий прогон без новой информации (дельта — docs-only, не
  затрагивает ни одну из этих проверок иначе, чем через `testing-doc.test.mjs`,
  который я прогнал адресно).
- `pytest tests_backend` — Python не тронут ни в r1, ни в r2.
- `npm run invariants`, `golden:verify`, performance — геометрия/рендер не
  затронуты; метки `ci:golden` нет.
- AC-смок `node demo/smoke_vacuum_ecovacs.mjs` — не перегонял повторно:
  смок и его runtime-зависимости (`src/**`, бандл, продукт) в дельте r1→r2 не
  менялись, а исполнение AC1–AC3 этим же смоком в трёх независимых окружениях
  уже доказано и унаследовано из r1 (см. ниже) — повторный прогон был бы
  обычным PASS без новой проверяемой переменной.
- Мутант `ecovacs-raster-invisible-939` — не исполнялся (ни автором, ни мной);
  честно отмечено «не исполнялся» в таблице AC обеих сторон. Поимку
  подтверждает только ночной прогон реестра (#709).
- Полные ship/release-review наборы — предрелизный гейт, не ревью одной
  задачи (§8).

## AC — разбор (дельта r1→r2 не меняет вывод по существу, перепроверено)

| AC | Чем доказан | Чем краснеет | Вердикт |
|---|---|---|---|
| AC1 (ожидание выхода диалога; порог/predicate неизменны) | Унаследовано из r1 — независимое исполнение в трёх окружениях (native Windows/WSL автора, эта CI-песочница); дельта r2 не меняет код смока, подтверждено `git diff --stat` (только два doc-файла) | До правки r1 — `rasterReallyPainted=false` на неизменённом dev, задокументировано автором | Подтверждено (унаследовано) |
| AC2 (обычный отрицательный вход — прозрачный PNG) | Унаследовано из r1 — `transparentRasterNotPainted=true` в трёх окружениях, тот же screenshot/count путь, код не менялся в дельте | Прозрачный PNG не проходит `blue>1000`; альтернативно `ecovacs-raster-invisible-939`, честно «не исполнялся» | Подтверждено (унаследовано) |
| AC3 (продуктовые файлы/рендер/калибровка не меняются; исходные проверки смока зелёные) | Чтением — `git diff --stat` r1→r2 не содержит `src/**`/`custom_components/**`, только `docs/TESTING.md`/`docs/VACUUM.md`; плюс унаследованные из r1 16 прочих `out.*` зелёных полей | Любая из проверок внутри `checkAll(out)` фатальна — проверено чтением в r1, код не изменился | Подтверждено |

Защитный AC (AC1/AC2 — гард/негативный предикат): строка «чем краснеет»
заполнена для обеих, пустых столбцов нет.

## Находки

Находок нет. Единственная находка r1 закрыта точечно и без побочных
эффектов: перенос абзаца не изменил его содержание, не создал битых ссылок,
не затронул продукт и вернул `docs/TESTING.md` ровно на закреплённый лимит.

## Что проверено и корректно

- Гонка и её устранение (`waitFor({state:'detached'})`), неизменный
  предикат, негативный прозрачный PNG — унаследовано из r1, код не менялся.
- Фикс находки r1: `docs/TESTING.md` восстановлен до 880 строк без изменения
  лимита; `test/testing-doc.test.mjs` зелёный — проверено мной адресным
  прогоном, а не принято на слово хендоффа.
- Содержание перенесённого абзаца в `docs/VACUUM.md` эквивалентно исходному
  (сверено построчно) — не ослаблено, не урезано по сути, только
  переформулировано местами стилистически.
- Отсутствие изменений класса A в дельте r1→r2 — диффом и отсутствием нового
  упоминания `src/**`/`custom_components/**`.
- Трейлеры: `Issue: #1009`, `User-Visible: no` на коммите дельты — корректно
  для doc-only правки.
- `docs/release-ledger/v1.82.0/1009.json` не менялся в дельте — классификация
  `infra` остаётся верной (правка r2 ещё более однозначно документационная,
  чем r1).
- Validate зелёный ровно на SHA материала — сверено `gh run view --json
  headSha` (#312: вердикт привязан к SHA, числа и факты сверены с
  `git rev-parse HEAD`).

## Чего не проверял

- Повторный прогон AC-смока `demo/smoke_vacuum_ecovacs.mjs` в r2 — дельта его
  не касается, унаследован из r1 (см. «Унаследовано из r1»).
- Ночной прогон мутаций и его поимка для `ecovacs-raster-invisible-939` — вне
  объёма code-review (#709, только ночь).
- `pytest tests_backend`, `npm run invariants`, `golden:verify`, performance —
  не применимы к этой дельте (docs-only).
- Ручная GPU-приёмка на физическом Windows-устройстве владельцем — не гейт
  ревью (REVIEWER.md, headless не объявляется реальной GPU-проверкой, #929).
- Полный ship/release-review набор — предрелизный, не ревью одной задачи.

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| Medium (в скоупе): добавленный абзац поднял `docs/TESTING.md` с 880 до 891 строк, сломав `test/testing-doc.test.mjs` (#681/#898, предел ≤880) при полном `npm test` | Абзац перенесён (не сокращён и не удалён по содержанию) из `docs/TESTING.md` в `docs/VACUUM.md`; `docs/TESTING.md` вернулся к 880 строкам, лимит не менялся | `git diff 8e0761ef21f9..HEAD -- docs/TESTING.md docs/VACUUM.md` (-11/+10); `wc -l docs/TESTING.md` → 880; `node --test test/testing-doc.test.mjs` → PASS 2/2 (прогнано мной в r2); авторский лог полного `npm test` на native Windows — PASS, exit 0 |

## Унаследовано из r1

- Независимое исполнение AC1–AC3 и всех исходных проверок смока
  (`demo/smoke_vacuum_ecovacs.mjs`) в трёх окружениях (native Windows и WSL
  автора, CI-песочница ревьюера r1: blue=80060, transparentBlue=462) —
  документ `docs/reviews/CODE-REVIEW-1009-r1.md`, материал
  `8e0761ef21f92434be78fd2f3dc595a7de487b99`. Код смока в дельте r1→r2 не
  менялся — принято без повторного браузерного прогона.
- Классификация `docs/release-ledger/v1.82.0/1009.json` (`category: "infra"`
  относительно `baseStable: v1.82.0`) — файл не менялся в дельте, решение из
  r1 остаётся в силе.
- Трейлеры `Issue:`/`User-Visible:` на коммите r1 (`8e0761ef21f9`) — сверены
  в r1, не пересматривались.
- Отсутствие диффа класса A/B продукта — подтверждено в r1 и повторно в r2
  (дельта добавляет только doc-only коммит).

## Вердикт

Трек `show`: задача проходит все шесть критериев §5 → `route: fix`.
Единственная находка r1 (Medium, в скоупе) закрыта точечно: абзац перенесён
без потери содержания, `docs/TESTING.md` восстановлен до 880 строк, целевой
тест зелёный — проверено мной адресным исполнением, а не принято на слово.
Новых находок дельта не вносит. AC1–AC3 остаются подтверждёнными (унаследованы
из r1, код смока не менялся). High: 0, Medium: 0 → **зелёный вердикт**.

---

<!-- material-anchors: заполняется конвейером -->

## Материал раунда

- Ветка: материал — `4b8c568b9ac2b9273690b78ae64a2fb76e25cdb7`.
- Дельта к материалу r1: `git diff 8e0761ef21f92434be78fd2f3dc595a7de487b99..4b8c568b9ac2b9273690b78ae64a2fb76e25cdb7`.
- Тело issue: digest `2a9ccee04afcdf87c29ad6dcd7ea8e9a9124b8b5b87602031a52bdeddda3c3f3` (не изменилось с r1).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1009-ecovacs-raster-smoke`, коммит `4b8c568b9ac2` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `dd9cb4766aace90081910b1ab4a2d31ff2ab7234`
  ```
  git log --all --format='%H %T' | grep dd9cb4766aac
  ```
- Тело issue: `2a9ccee04afcdf87c29ad6dcd7ea8e9a9124b8b5b87602031a52bdeddda3c3f3`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxOTcsIm91dHB1dF90b2tlbnMiOjIzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MzEyfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo1Miwib3V0cHV0X3Rva2VucyI6MTQwOTAsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6NzQwOTMsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxODU4MDYwLCJjb3N0VXNkRXN0aW1hdGUiOjAuODA4OTg3OTk5OTk5OTk5OH1dLCJ0dXJucyI6NDEsImR1cmF0aW9uTXMiOjE1ODc1OSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuODE0Mjk5OTk5OTk5OTk5OCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5249 output_tokens=14113 cache_creation_input_tokens=74093 cache_read_input_tokens=1858060 num_turns=41 -->
