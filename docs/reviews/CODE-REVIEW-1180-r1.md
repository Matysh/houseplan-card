# CODE-REVIEW-1180-r1

**Issue:** #1180 · **Этап:** code (код-ревью, PROCESS.md §2.7) · **Трек:** show
**Материал:** `2cb230f04d48d9ffb4862f325641a2c16861fbba` (task-patch от общего
предка `96a97b8f74bf66d6c0c9423ec6657eabb052416d`). Заход r1, блокирующих
циклов 0/2 (лимит трека `show`).

## Скоуп

Единственный документационный кадр `device-display-preview` переснят в
штатном адаптивном fullscreen-диалоге: `viewport` сценария в
`demo/docs/screenshots.mjs` меняется с `1180×1100` на `480×1100` (ширина,
высота 1100 сохранена). Плюс `docs/release-ledger/v1.83.0/1180.json`
(классификация `infra`) и регенерированный `scripts/ci-registry-inventory.json`
(две позиции ссылок на новый файл ledger). Продуктовый код, остальные десять
сценариев документации, сам oracle полной видимости, `.content` как
единственный scroll owner — не тронуты. Обслуживает блокер выпуска
v1.84.0-beta.1 (кадр документации не помещался в десктопный `.content`).

## Как проверялось

Static-first: прочитаны `REVIEW_CONTEXT`, `sources.json`/`sources-1.md`
(тело issue + все три комментария), `review-execution-policy` (каталог
check-id), `read:diff` (полный task-patch — он укладывается в один экран, три
файла) и `read:log` (один коммит в диапазоне). `static:ci-registry-inventory`
прогнан адресно: конкретный риск — расхождение сгенерированного индекса с
исходниками; результат PASS, пустой stdout (генератор не нашёл расхождений с
закоммиченным файлом).

Независимо от хендоффа прослежено:
- `demo/docs/screenshots.mjs:49-55` — единственная правка: `viewport.width`
  1180→480, `height` не менялась, остальные поля (`space`, `dialog`,
  `deviceId`, `devicePresentationPreview`, `expectDialog`) идентичны строке
  выше (`device-editor`) и не затронуты.
- `demo/docs/capture.mjs:144-169` (не входит в дифф, прочитан целиком) — сам
  oracle полной видимости не менялся: клик по вкладке Appearance, скролл
  `.content` к превью, затем строгая проверка
  `visiblePreview.top/bottom` внутри `visibleScroller.top/bottom` ±1px с
  `throw` при нарушении. Это ровно тот путь, который в канонической съёмке
  41285944011 упал на старом viewport (624.9px превью vs 610px `.content`).
- `src/styles/dialog-composition.styles.ts:266-269` — `@media (max-width:
  480px)` переводит `:host([settings-layout]) .surface`/`ha-dialog` в
  `height:100dvh; max-height:100dvh`. Это существующий продуктовый
  breakpoint (не придуманное число задачи): на viewport `480` правило
  `max-width:480px` срабатывает, снимая фиксированную ~610px высоту
  десктопного `.content` и давая место для 624.9px превью без прокрутки
  содержимого за пределы вьюпорта.
- `docs/USER-GUIDE.ru.md:1720` — alt-текст `06-device-display-preview.png`
  уже не упоминает десктоп («Живой предпросмотр выбранного отображения
  устройства»), правка документации не нужна — соответствует телу issue.
- `scripts/release-ledger.mjs:40-50` (`validateEntry`) — требует `schema:1`,
  `issue>0`, валидный `baseStable`, `category` из допустимого набора,
  непустой `rationale`; для `line-fix` — обязательный `introducedBy`.
  Запись `1180.json` (`schema:1, issue:1180, baseStable:"v1.83.0",
  category:"infra", rationale:"..."`) удовлетворяет условию целиком;
  `infra` не входит в тело stable и не получает milestone (таблица
  категорий PROCESS.md §11.9) — корректно для чисто документационной правки
  без изменения поведения.
- `scripts/docs-accept.mjs` — не сравнивает `viewport` кандидата с текущим
  `DOC_SCREENSHOTS` (grep не нашёл использования `viewport` в приёмке), то
  есть смена ширины сценария не меняет контракт приёмки PNG; сам PNG-артефакт
  умышленно не входит в этот коммит (AC2: приёмка — на dev из CI artifact,
  вне ветки задачи) — согласуется с диффом (ни один файл `docs/images/*.png`
  не тронут).
- `.github/workflows/docs-screenshots.yml:90-111` — джоба реально выполняет
  `node scripts/capture-determinism.mjs` (два прогона `capture.mjs`,
  побайтовое сравнение) и `node demo/docs/capture.mjs --stability=3`
  (три снимка без правки состояния); оба шага исполняют тот же
  `applyDocumentationState`, то есть и oracle полной видимости для
  `device-display-preview` реально проходил в этой джобе на материале.

Риски по применимым классам (§2.6): visual (промежуточный кадр/детерминизм)
— покрыт тем же неизменным stability/determinism oracle, прогнанным в CI на
материале; geometry/async/данные-права/host-input/объём — неприменимы,
продуктовый код и рантайм не затронуты.

### Переиспользованные проверки (материал не менялся)

`validate-gate` зелёный на этом SHA
(https://github.com/Matysh/houseplan-card/actions/runs/41286856420,
«review-light proof is complete»); точные CI product/docs/tooling
(41286856420/41286856394/41286856399) — success. Хендофф называет конкретные
прогоны: `node --test test/capture-determinism-args.test.mjs
test/capture-determinism-gate.test.mjs test/docs-accept.test.mjs
test/docs-acceptance.test.mjs` (PASS), `npm run gate:small` (PASS, 104с),
pre-push product+tooling union (PASS), `diff-check` (PASS). Конкретно для
AC1/AC2 определяющее доказательство — не юнит-тесты (они проверяют
инфраструктуру приёмки/детерминизма в общем виде и не знают про конкретный
viewport), а факт успешного прохождения `docs-screenshots.yml` на точном
материале: шаги `capture-determinism.mjs` и `capture.mjs --stability=3`
исполняют неизменный oracle полной видимости для сценария
`device-display-preview` при новом viewport. Эти числа и ссылки не
переисполнялись мной повторно: ни код сценария, ни oracle, ни окружение с
момента получения этого доказательства не менялись.

## AC → чем доказано → чем краснеет (защитные AC)

| AC | Чем доказано | Чем краснеет |
|---|---|---|
| AC1 (полная видимость превью в `.content` на 480×1100, без изменения продукта) | Неизменный oracle `demo/docs/capture.mjs:164-168` (`throw` при `visiblePreview` вне `visibleScroller` ±1px), реально исполненный в CI-джобе `docs-screenshots.yml` (`capture-determinism.mjs` + `capture.mjs --stability=3`) на материале `2cb230f0…`, run docs41286856394 → success | Зарегистрированный отрицательный прогон с результатом: канонический beta-derived run [41285944011](https://github.com/Matysh/houseplan-card/actions/runs/41285944011) — тот же неизменный oracle на старом `viewport:1180×1100` упал с `preview 624.90625px > .content 610px` (RED до AC1) |
| AC2 (детерминизм: 11 кадров совпадают между процессами; `--stability=3` без послаблений) | `scripts/capture-determinism.mjs` + `demo/docs/capture.mjs --stability=3`, исполнены в `docs-screenshots.yml` на материале (docs41286856394 → success); логика гейта — `unit:test/capture-determinism-gate.test.mjs`, переиспользован по хендоффу/tooling CI | `test/capture-determinism-gate.test.mjs`: «разошедшийся кадр назван по имени», «пропавший и появившийся кадр — тоже расхождение», «#862 failed capture aborts» — обычные отрицательные случаи внутри теста, не мутант |

AC3 (целевые тесты/приёмка зелёные, CODE-review, ledger `infra` против
v1.83.0) не защитный AC в смысле §2.7 (не guard/limit/инвариант) — закрыт
данным документом (независимое код-ревью) + переиспользованным зелёным CI +
проверенной чтением схемой `docs/release-ledger/v1.83.0/1180.json` против
`validateEntry`.

## Трек show — критерий §5 (route)

- `complexity` ≤3 — да (диффа на три строки по существу, без новой логики).
- `surfaces` — одна поверхность (кадр документации `device-display-preview`).
- `migration` — нет новых compatibility-полей/миграции конфига.
- `ux-contract` — новый контракт не вводится: используется уже существующий
  продуктовый breakpoint `@media (max-width:480px)`, продуктовое поведение
  не меняется.
- `perf-touch` — продуктовый код не тронут, touch-контракт не затрагивается.
- `undocumented` — ожидаемое поведение (fullscreen-вариант диалога на узком
  viewport, полная видимость превью) уже зафиксировано в продуктовом CSS и в
  неизменном `capture.mjs`-oracle, не изобретается задачей.

Все критерии пройдены → `route: fix`.

## Находки

Находок уровня High или Medium в скоупе не выявлено.

## Что проверено и корректно

- Единственная содержательная правка — `viewport.width` одного сценария;
  остальные десять сценариев и сам `capture.mjs` не изменены (подтверждено
  полным `read:diff`).
- `docs/release-ledger/v1.83.0/1180.json` соответствует `validateEntry`
  (`scripts/release-ledger.mjs`) и корректно классифицирован как `infra`
  (без пользовательского поведения, не входит в тело stable/milestone).
- `scripts/ci-registry-inventory.json` синхронизирован с исходниками —
  подтверждено исполнением `static:ci-registry-inventory` (PASS, пустой
  diff).
- PNG-артефакты и `docs/images/screenshots.json` умышленно не входят в
  коммит — соответствует AC2 («приёмка PNG — на dev из CI artifact, вне
  ветки задачи») и подтверждается самим диффом.
- Alt-текст `USER-GUIDE.ru.md` уже нейтрален к устройству съёмки, правки не
  требовалось.
- Число `480` — из одного источника (существующий breakpoint
  `dialog-composition.styles.ts`), не задвоено и не изобретено заново в
  задаче; высота `1100` не менялась — нет двух независимых значений одной
  величины.
- Классификация `infra` согласуется с отсутствием правок changelog в диффе
  (User-Visible вероятно `no`, продуктовое поведение не меняется).

## Чего не проверял

- Сами PNG-кадры (`docs/images/*.png`) не пересняты и не входят в материал —
  соответствует AC2 по дизайну задачи, глобальная приёмка кадров на dev вне
  объёма этого ревью.
- Трейлеры `Issue:`/`User-Visible:` коммита не читались напрямую:
  fixed-check runner отдаёт только `git log --oneline` (без тела/трейлеров),
  общий `git show`/Bash недоступен. Содержательное требование (отсутствие
  правок changelog при вероятном `User-Visible:no`, при классификации
  `infra`) подтверждено по диффу; формат самих трейлеров — предположительно
  уже проверяется gate `commit-provenance`/tooling CI (зелёный на этом SHA),
  но не перепроверен мной напрямую.
- Полный `npm run gate:small`, `pytest tests_backend`, смок-сьют, golden —
  не перезапускались: продуктовый/Python-код не тронут, конкретного
  непокрытого пробела для них нет; переиспользован зелёный `validate-gate`
  на точном материале.
- `build:build`/`build:bundle:sync`/`build:typecheck` — не запускались
  адресно: правка — литерал в dev-only модуле `demo/docs/screenshots.mjs`,
  не входящем в продуктовый бандл; тип поля не менялся.

## Гейты

| Гейт | Прогнан в этом раунде | Почему |
|---|---|---|
| `read:diff`, `read:log` | Да | обязательное чтение полного диффа/коммитов диапазона |
| `static:ci-registry-inventory` | Да (PASS) | адресная проверка конкретного риска — расхождение генерируемого индекса с исходниками |
| `docs-screenshots.yml` (capture-determinism + `--stability=3`, содержит AC1/AC2 oracle) | Нет, переиспользован | уже исполнен на точном материале (docs41286856394 → success), oracle и входы не менялись с момента получения доказательства |
| `unit:test/capture-determinism-args.test.mjs`, `capture-determinism-gate.test.mjs`, `docs-accept.test.mjs`, `docs-acceptance.test.mjs` | Нет, переиспользован | PASS по хендоффу + зелёный tooling CI на этом же материале |
| `npm run gate:small`, pre-push product+tooling union, `diff-check` | Нет, переиспользован | PASS по хендоффу + зелёный `validate-gate`; продуктовый код не тронут, конкретного непокрытого пробела нет |
| `build:build`/`build:bundle:sync`/`build:typecheck` | Нет | правка — литерал в dev-only модуле вне продуктового бандла, тип не менялся |
| `pytest tests_backend`, смок-сьют, golden, инварианты геометрии | Нет | Python/продуктовый/геометрический код не менялся — неприменимо |

## Маршрут

`route: fix` — задача проходит все критерии §5 трека `show`
(`complexity`/`surfaces`/`migration`/`ux-contract`/`perf-touch`/
`undocumented`), High/Medium в скоупе не найдено.

## Побочные находки

Побочных находок вне скоупа #1180 нет. `outside_findings` пуст (политика
`mode=issues`, новых issue не заводится).

**Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 ·
Документ: docs/reviews/CODE-REVIEW-1180-r1.md**

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjY2YmY1MDRmOWUxNjg0NjdkNzczZTNkMmUwNWUwODJlZThmYzE5MTQwMDIxMDc1OTFiMzQ4ODBkNjg0NGM3ZjciLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI2MmRlZTE2ODcyZGU0YmRlNjBkN2UyZWUzNGU5MGYyZmM0OWE0OGZlOGIyN2JhM2NjMTAxYjhjNWY1Y2MyYzZjIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTgwLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIyY2IyMzBmMDRkNDhkOWZmYjQ4NjJmMzI1NjQxYTJjMTY4NjFmYmJhIiwidHJlZSI6ImM3ZjZjYjg3YWVhODAyOTM2OGJmZGYwOTdjZTE3YzA2YjkyMWUyNGEiLCJib2R5RGlnZXN0IjoiNmI4Njg1ZjQ0YjA1NjM3MjY3NDNkM2JmMGNlYTFjNzYzZDE2ODQwNmVlZTY2YjRjYjFiZmQ0NjM2MmVkNGY1YiIsInByb2R1Y2VyUnVuIjoiNDEyODc1OTEyMzAiLCJwcm9kdWNlckF0dGVtcHQiOiIyIn0sInJlcG9ydERpZ2VzdCI6IjkwMGQ0Zjg3OWJlODcxZTY0MjAwZGI0YTExNTUyNTk3NTg5OWUwYjFjMmRiZjYwNWQ2MDAxZWUzNTNmYjdkNjYiLCJ2ZXJkaWN0RGlnZXN0IjoiOGE1ZjJiMmY4OGJmNDM5NDc1ZjQ4MTBiNmI1MDA4NmYxZWVhZjhmOWNmMWEyZTkwNTYyMmEwMzY0NzE0ZmU1YSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI1MDZlNmMwOTY2OTFmYzZmMjA4NTM5NTEyOTZkMDNlNzRkNDgyZWY3NmY5NjRiNmYzMDg2OWQ3ZjhlMjk4YTA2IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTU1OTk3MTk0LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTgwI2lzc3VlY29tbWVudC02NTU1OTk3MTk0IiwiYm9keURpZ2VzdCI6ImRhNDkzOTQ4NWU4NWVlNmIyYmNkODMzMmJlNDFmNTkwZjBkYzg5ZDA1YWYzNDUwZmEyMDQ3MzYzY2Q2MGQ1NTkifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1180-docs-responsive-preview`, коммит `2cb230f04d48` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `c7f6cb87aea8029368bfdf097ce17c06b921e24a`
  ```
  git log --all --format='%H %T' | grep c7f6cb87aea8
  ```
- Тело issue: `6b8685f44b0563726743d3bf0cea1c763d168406eee66b4cb1bfd46362ed4f5b`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":41287591230,"run_attempt":2,"digest":"96ea56f24ef94bbb8b6e95de3273232733dc8101ef87bbccfb61ffdda9077bf7"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NjgsIm91dHB1dF90b2tlbnMiOjI1MzUxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEzMjk2NSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjI2MTg0NDIsImNvc3RVc2RFc3RpbWF0ZSI6MS4zMDkxOTQ0fV0sInR1cm5zIjo0NCwiZHVyYXRpb25NcyI6MzYyMDkwLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4zMDkxOTQ0LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=68 output_tokens=25351 cache_creation_input_tokens=132965 cache_read_input_tokens=2618442 num_turns=44 -->
