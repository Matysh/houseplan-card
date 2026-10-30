# CODE-REVIEW-1080-r2

Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0 · Документ: docs/reviews/CODE-REVIEW-1080-r2.md

Материал: `46c94bb33d095dc2783de59ea7673b1e484fbb3f` (ветка `issue/1080-decor-preview-ownership`, база `dev@7a011241a`).
Маршрут побочных находок: `mode=issues` (доверенный снимок `HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`); побочных находок нет, `outside_findings: []`.
`route: fix`.

## Скоуп

Issue #1080, трек `ask`, этап code, заход r2. Дельта раунда — ровно два новых коммита
поверх ревьюированного в r1 материала `d2cafbffb`:
`aba575ab4` (docs: review document for #1080 — публикация `docs/reviews/CODE-REVIEW-1080-r1.md`)
и `46c94bb33` (docs: refresh current release tags in #1080 status snapshot — исправление
единственной находки M1 из r1). Продуктовый код (`src/live-editor.ts`, `src/houseplan-card.ts`)
и все тестовые/демо-файлы не менялись: независимо подтверждено полным
`read:diff` (origin/dev..HEAD) — хунки по `src/*`, `test/*`, `demo/*`, `scripts/*`
побайтно совпадают с тем, что цитирует и проверяет `docs/reviews/CODE-REVIEW-1080-r1.md`.

Риск по изменённым участкам (#707): `src/live-editor.ts:416` — токен `requestAnimationFrame`
в `scheduleHouseplanEditor`, различающий устаревший/живой кадр. Строка подтверждена
прямым чтением текущего файла (не изменилась с r1); класс покрыт AC4 ТЗ и
юнит-тестом `test('#1080 a cancelled or detached frame cannot paint or consume a
later action')` в `test/live-editor.test.mjs` — доказательство унаследовано из r1
(код теста и код продукта идентичны байт-в-байт), повторное исполнение не требуется
(материал/вход/окружение этого узла не менялись).

## Независимый разбор дельты

Дельта r2 — документация C-класса, не продукт. Прямое подозрение: исправление
M1 могло задеть что-то сверх двух строк тегов, как было заявлено автором. Проверено
по `read:diff`: хунк `docs/STATUS.md` против `origin/dev` показывает строки
`Latest stable tag`/`Latest prerelease tag` **без** `+`/`-` (то есть HEAD совпадает
с `dev`, а значит и со значением, которое r1 требовал восстановить), изменилась
только строка `Tests` (счётчики инвентаря, не относится к M1) и добавлен абзац
«Decor preview ownership (#1080) suppresses only ready live transient
counterparts…» в прозаической части (не генерируемый блок, ожидаемая правка
по `PROCESS.md §2.6`). Других хунков вне `docs/STATUS.md` и нового файла
`docs/reviews/CODE-REVIEW-1080-r1.md` в дельте r1→r2 нет.

`docs/release-ledger/v1.82.0/1080.json` (не менялся в r2) содержит
`"baseStable": "v1.82.0"`; после фикса M1 это теперь совпадает с
«Latest stable tag» в `docs/STATUS.md` — расхождение «одно число — два источника»
(§8), которое и было предметом M1, устранено.

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| M1 (Medium, в скоупе): `docs/STATUS.md` снимок указывал устаревшие теги (`v1.79.0`/`v1.80.0-beta.5`) вместо актуальных (`v1.82.0`/`v1.83.0-beta.2`), расходясь с `release-ledger`/анализом/хендоффом того же диффа | Коммит `46c94bb33` перегенерировал блок `node scripts/status-snapshot.mjs --write` на окружении с подлинными `origin` tag refs (`v1.82.0`, `v1.83.0-beta.2`); затронуты ровно две строки таблицы | `docs/STATUS.md:26-27` теперь `v1.82.0`/`v1.83.0-beta.2`, совпадает с `docs/release-ledger/v1.82.0/1080.json:"baseStable"`. Проверено исполнением `static:status-snapshot` на материале `46c94bb33` — **PASS** («snapshot block is current»), в отличие от r1, где тот же чек на `d2cafbffb` возвращал `FAILED` |

## Унаследовано из r1

Весь независимый разбор корневой причины, контракта передачи владения (AC1–AC2),
защиты устаревшего/отсоединённого кадра (AC4), маршрутизации `lostpointercapture`
для прямоугольника/овала, инвентаризации видов превью (мебель/фигуры-линии/
изображения/текст), узости селекторов (AC6), а также результаты исполненных
гейтов (`unit:test/live-editor.test.mjs`, `unit:test/furniture-art-runtime.test.mjs`,
`unit:test/golden-matrix.test.mjs`, `build:build`+`build:bundle:sync`,
`smoke:demo/smoke_decor_preview_ownership.mjs` — все PASS, перезапущены ревьюером r1)
приняты без повторной проверки: документ `docs/reviews/CODE-REVIEW-1080-r1.md`
(опубликован этим же материалом, содержит `publication-receipt`), материал
`d2cafbffbcb7f5a0e9817719a14520191f804474`, независимо подтверждено, что
продуктовый/тестовый/demo код между `d2cafbffb` и текущим `46c94bb33` не менялся
(см. выше). Трейлеры `Issue`/`User-Visible: yes` и парность `docs/CHANGELOG.md`/
`docs/CHANGELOG.ru.md` также наследуются из r1 — они расположены в неизменном
коммите `d2cafbffb`.

## Гейты: что прогнано и результат

| Гейт | Выполнено в r2 | Результат |
|---|---|---|
| `read:diff`, `read:log` | да | прочитан точный дифф и 6 коммитов диапазона (4 унаследованы из r1, +2 в r2) |
| `static:status-snapshot` | да, адресно для закрытия M1 | **PASS** — «snapshot block is current» (был FAILED на `d2cafbffb` в r1) |

Не прогонялось повторно (переиспользовано как пригодное evidence — материал
продукта/тестов/demo не менялся с r1, вход/окружение/oracle те же):
- `unit:test/live-editor.test.mjs`, `unit:test/furniture-art-runtime.test.mjs`,
  `unit:test/golden-matrix.test.mjs`, `build:build`, `build:bundle:sync`,
  `smoke:demo/smoke_decor_preview_ownership.mjs`, `static:bundle-budget`,
  `static:mutation-registry` — все PASS в r1 на идентичном продуктовом/тестовом
  коде; независимо подтверждено побайтовое совпадение хунков через `read:diff`
  в этом раунде, новых рисков в этих узлах дельта r2 не создаёт;
- `static:smoke-select` — то же ограничение runner'а, что и в r1 (не принимает
  `--base`/`--head`); дельта r2 не продукт, доп. смоков не выбирает;
- совместный сценарий с #1081, визуальное сравнение с UI Lab UI-038,
  `pytest tests_backend`/`npm run invariants` — не применимо к этому раунду по
  тем же основаниям, что в r1 (см. «Чего не проверял» там); дельта r2 их не
  затрагивает.
- `ciEvidence` (validate-gate https://github.com/Matysh/houseplan-card/actions/runs/40336696881,
  «review-light-golden proof is complete») подтверждает план проверок материала
  `46c94bb33` как контекст, не как замену независимого разбора; независимый разбор
  выполнен выше.

## Находки

Нет. Единственная находка предыдущего раунда (M1) закрыта и подтверждена
исполнением (см. «Закрытие раунда r1»). Новых находок в дельте r2 (два
docs-коммита) не обнаружено.

## Что проверено и корректно

- Дельта r1→r2 ограничена ровно `docs/STATUS.md` (2 строки тегов +
  один абзац в прозаической части) и новым файлом `docs/reviews/CODE-REVIEW-1080-r1.md`;
  подтверждено чтением полного `read:diff` против `origin/dev`, а не со слов
  хендоффа.
- Продуктовый код (`src/live-editor.ts:416` и окрестности, `src/houseplan-card.ts`
  `lostpointercapture`), тесты и demo-smoke побайтно идентичны материалу r1 —
  весь независимый разбор и исполненные гейты r1 остаются в силе.
- M1 закрыт по существу, не косметически: `static:status-snapshot` перешёл из
  FAILED (r1, `d2cafbffb`) в PASS (r2, `46c94bb33`); «одно число — один источник»
  (§8) восстановлено между `docs/STATUS.md` и `docs/release-ledger/v1.82.0/1080.json`.
- Трейлеры и changelog-парность (`User-Visible: yes` + оба `docs/CHANGELOG*.md`)
  не затронуты дельтой r2 и остаются корректными из r1.

## Чего не проверял

- Повторно не проверял AC1–AC5 по существу (визуальный отпечаток, передача
  владения, commit/cancel, инвентаризация видов превью, совпадение с UI Lab
  UI-038) — продуктовый код не менялся с r1, где это было независимо прослежено
  и исполнено; см. «Унаследовано из r1».
- Совместный сценарий с #1081 и визуальную Golden-сцену `decor-preview-handoff-1080`
  не перезахватывал — то же ограничение и то же обоснование, что в r1 (нет
  доступного `golden:run`/capture-чека в этом runner'е, код #1080 не менялся).
- `pytest tests_backend`, `npm run invariants` — неприменимо, дельта r2 не
  трогает Python/геометрию (как и r1).

---

## Материал раунда

- Ветка: `issue/1080-decor-preview-ownership`, коммит `46c94bb33d095dc2783de59ea7673b1e484fbb3f`.
- Дерево материала: `8283932d7e0dc438b9e2fbd23482e7a7629fdc84`.
- Тело issue: `17434b64eb8cfb00ccaf28eeef45f2c18686cf0194bc2d8b05ae31ce5de09e91`.
- Предыдущий документ: `docs/reviews/CODE-REVIEW-1080-r1.md`, материал `d2cafbffbcb7f5a0e9817719a14520191f804474`.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjgzMDljODA4MDkzYTg4NWNhMDRlOGY1YzViZDg0NTI1Mjg5NDQwZGM1NGNhZDc4NTQ4YTRjZjQwNWJmNWU1MTYiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJiOWYyMjQxYzFmMjU5NTIxN2Y0Yzg1MTA3MWI5N2M1ZTc0YzI3OTc0NzBkNTk5MmI5ZmMwODMzMzNlYWMxMDNjIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDgwLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiI0NmM5NGJiMzNkMDk1ZGMyNzgzZGU1OWVhNzY3M2IxZTQ4NGZiYjNmIiwidHJlZSI6IjgyODM5MzJkN2UwZGM0MzhiOWUyZmJkMjM0ODJlN2E3NjI5ZmRjODQiLCJib2R5RGlnZXN0IjoiMTc0MzRiNjRlYjhjZmIwMGNjYWYyOGVlZWY0NWYyYzE4Njg2Y2YwMTk0YmMyZDhiMDVhZTMxY2U1ZGUwOWU5MSIsInByb2R1Y2VyUnVuIjoiNDAzMzc1MTY0ODkiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImM5NWQ5ODhiMWExZjYzMTEyNzg1YTNlMjRiNjcxZTMyYzZjMDFhYTM4MjI1Y2U5YTQxNTlhZjk3ZDA2YzdiY2MiLCJ2ZXJkaWN0RGlnZXN0IjoiZjk0MDhjNzBhZGNmMzcxZWQwM2E3MWViNjRkNzM4ZTA0ZjBkYmViNzFiNmYxOTAxOTkyZDBjOTM5YzI1NDhmYyIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI1MGRiYzA3YzU0MDkyYjI3OGE3MjljMWFmYmIxMzZlODM1ZDgwOTRhY2JkODhhYTViOWM1MGU4YzZmNzZjMDY4IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDE4MzAxODAwLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDgwI2lzc3VlY29tbWVudC02NDE4MzAxODAwIiwiYm9keURpZ2VzdCI6IjIxYTUwMTZjYzgxMTA0ZDBlODAxNmRmNmViYzY3NTUxM2Y2MTcwOTQwODYwZDA2ZDU2ZmE0M2Y4NGI5ZGU0YWUifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1080-decor-preview-ownership`, коммит `46c94bb33d09` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `8283932d7e0dc438b9e2fbd23482e7a7629fdc84`
  ```
  git log --all --format='%H %T' | grep 8283932d7e0d
  ```
- Тело issue: `17434b64eb8cfb00ccaf28eeef45f2c18686cf0194bc2d8b05ae31ce5de09e91`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40337516489,"run_attempt":1,"digest":"a166a1be27e9805eb1d64077974957f2ae9e8ef31362b4eef2cad48e0b6118af"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MzAsIm91dHB1dF90b2tlbnMiOjEzMDk1LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjk3NDcxLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MTEzNzE4MCwiY29zdFVzZEVzdGltYXRlIjowLjc0ODMyOTk5OTk5OTk5OTl9XSwidHVybnMiOjIxLCJkdXJhdGlvbk1zIjoxNTg4NTcsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjowLjc0ODMyOTk5OTk5OTk5OTksImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=30 output_tokens=13095 cache_creation_input_tokens=97471 cache_read_input_tokens=1137180 num_turns=21 -->
