# Код-ревью #1146 — r1

Материал: `d75d34bf89b4a11709791b839689cf43c8c59056` (единственный коммит
`test(ui-kit): add migration census, ratchets and capture inventory`, поверх
`0529ce90c` на `dev`). Маршрут вердикта: `fix` (директива #726).
Findings policy: `mode=issues` — побочные находки вне скоупа (если были бы)
пошли бы в `outside_findings`; их нет.

## Скоуп

Задача класса B/C (инфраструктура измеримости миграции на UI Kit, по решениям
аудита #1131). Продуктовый код (`src/**`) не тронут — изменены только
`scripts/`, `test/`, `demo/` (смоки/UI Lab/капча), `docs/`,
`.github/workflows/*`, `docs/release-ledger/*`. Core user job не затронут:
«Ожидаемое изменение CSS: ±0» подтверждено — ни одна пользовательская
строка поведения не меняется.

Состав по телу issue:
1. Реестр `docs/design/ui-kit-inventory.json` (80 поверхностей / 511 ячеек).
2. Подсчёт `scripts/ui-kit-metrics.mjs` + юнит-тесты разбора шаблонов.
3. Храповики `cssLines`/`keyframes`/`transitions`/`inlineDecorativeStyles`/
   `hpDialogWithoutKit`/`btnRulesOutsideKit`/`registryOffKit` через
   `scripts/ratchets.mjs`.
4. CDP-покрытие CSS (`demo/ui-lab/ui-kit-audit.mjs`) → `docs/design/ui-kit-audit-1146.json`.
5. Сценарии съёмки 23 редких поверхностей (`demo/helpers/ui-kit-capture.mjs`,
   `demo/capture_ui_kit_transients.mjs`, точки в существующих смоках).
6. Высота кнопки инструментов (зафиксирована в `UI-KIT-METRICS.md`).

## Как проверялось

Static-first: прочитан `read:diff` (полный диф материала, ~10.2 тыс. строк),
включая все изменённые файлы целиком (workflows, демо-хелперы, смоки-точки,
`scripts/css-source.mjs`, `scripts/ratchets.mjs`, `scripts/gate-small.mjs`,
`scripts/ui-kit-metrics.mjs` целиком, оба тестовых файла целиком, оба JSON
реестра — выборочно по структуре и точечно по содержимому). Затем
независимо прослежены вызывающие пути и инварианты, после — сопоставление с
хендоффом и CI evidence.

Выполненные мной проверки (адресно, не вместо гейта):
- `unit:test/ui-kit-metrics.test.mjs` → **PASS** (10/10).
- `unit:test/ratchets.test.mjs` → **PASS** (включает новый тест #1146).
- `static:check-inputs` → **PASS** (новые файлы/глобы зарегистрированы,
  `scripts/ui-kit-metrics.mjs` корректно добавлен в `frontend.entries`).
- `read:base:scripts/css-source.mjs` — сверка рефакторинга `htmlAttributes`→`htmlTags`
  против прежней реализации (HTML-комментарии `<!-- -->` по-прежнему
  пропускаются, логика атрибутов не изменилась, добавлено только
  отслеживание границ тега).
- `read:log` — единственный коммит в материале, без скрытых хвостов.
- Прямое чтение исходников вне дифа: `scripts/css-lex.mjs` (`cssTokens`,
  `parseCss` уже экспортированы — импорт из нового `demo/ui-lab/ui-kit-audit.mjs`
  не сломан), `demo/bundle-freshness.mjs` (`assertFreshDemoBundle(page, root)`),
  `scripts/browser-attestation.mjs` (`attestLaunchedBrowser`), `demo/ui-lab/server.mjs`
  (`createLabServer`), `demo/serve.mjs` (единственная точка `newPage()` —
  `installUiKitCapture` подключается ко всем экспортируемым `launch*`-обёрткам).
- Точечная сверка evidence реестра с реальным кодом: `houseplan-card.ts:11493-11522`
  (`.modes`/`.modetab`, `.btn.zb` zoom-out/fit/in) — номера строк в реестре
  соответствуют фактическому коду.
- Арифметика: 118(K)+118(L)+254(M)+21(N)=511 ячеек; `registryOffKit`=L+M=372 —
  совпадает с `scripts/ui-kit-baseline.json`, `docs/design/UI-KIT-METRICS.md`
  и `docs/design/ui-kit-audit-1146.json.metrics` (три места — один факт, не
  независимые источники с риском расхождения: канонический источник для гейта
  — `scripts/ui-kit-baseline.json`, читаемый `readUiKitBaseline()`).
- 6 профилей (light/dark × 1280/1024/390) × 27 стадий = 162 кадра — пересчитано
  по самому `docs/design/ui-kit-audit-1146.json` (список `stages`), совпадает
  с заявленным в документации числом.
- `test/ui-kit-metrics.test.mjs` (10) + `test/ratchets.test.mjs` (+1) = 11 новых
  юнит-тестов — совпадает с приростом `Node unit 5908 → 5919` в `docs/STATUS.md`.
- Размещение новых вызовов `window.__hpUiCapture?.()` в смоках: все — либо уже
  внутри `page.evaluate`, либо обёрнуты в собственный `page.evaluate`; в
  `smoke_infinite_canvas.mjs` вызов идёт сразу после подтверждённого
  `hintShown` (элемент гарантированно смонтирован на этот момент).
  Без `HP_UI_KIT_CAPTURE_DIR` `window.__hpUiCapture` не существует, `?.()`
  — no-op: обычный прогон смоков не меняет поведение.

Переиспользовано без повторного прогона (material/env/oracle не менялись,
доказательство пригодно): **review-light / validate-gate зелёный прогон
[41153242490](https://github.com/Matysh/houseplan-card/actions/runs/41153242490)**
на этом же SHA — покрывает полный `gate:small` (typecheck/build/lint/bundle-budget
и т.д.), `node scripts/ui-kit-metrics.mjs --check` и `ratchets report --committed`
в CI-профиле, 14 задействованных capture-смоков и CDP-прогон UI Lab (офлайн,
синтетический). Этот прогон подтверждает **выполненные** проверки, не
корректность реализации — сверка с ним сделана после независимого разбора
кода, а не вместо него.

Не прогонялось (вне соразмерного объёма ревью, не являются «запасным
сценарием»): полный набор 487 браузерных смоков, pure/HA-harness backend
(бэкенд не тронут), `ratchets tighten`, полный `npm run gate:small` заново.

## Находки

Находок High/Medium в скоупе нет. Побочных находок вне скоупа нет —
`outside_findings` пуст.

Отмечено, но не является находкой (явно задокументированные, намеренные
границы метода, совпадающие с текстом ТЗ issue):
- `validateCapturePlans` проверяет только существование кадра/файла-точки
  входа, не то, что внутри файла действительно вызывается
  `window.__hpUiCapture` с совпадающим именем поверхности. Это ровно то,
  что просит тело issue («Гейт проверяет существование кадров и точек входа
  сценариев») — не пробел относительно AC.
- `docs/design/ui-kit-audit-1146.json` — вручную скомпонованный компактный
  отчёт (не перегенерируется одной командой из `demo/ui-lab/ui-kit-audit.mjs`);
  это соответствует описанному в `UI-KIT-METRICS.md` разделению «полное — в
  artifacts/, компактное — в Git» и разовому характеру аудита, а не
  непрерывному гейту.
- Трейлеры `Issue`/`User-Visible` самого коммита не читаемы напрямую
  доступным инструментарием (`read:log` отдаёт только oneline, общего
  `git show`/Bash нет). Косвенно User-Visible:no подтверждается отсутствием
  правок `CHANGELOG*.md`, явной инфра-классификацией в
  `docs/release-ledger/v1.83.0/1146.json` и утверждением issue «±0 CSS»;
  этот участок не покрыт прямым наблюдением — честно фиксирую границу,
  а не выдаю это за проверенное.

## AC · чем доказан · чем краснеет

| AC (защитный) | Чем доказан | Чем краснеет (обычный отрицательный вход) |
|---|---|---|
| Рост метрик сверх полосы (`cssLines` полоса 20, остальные 0) красит гейт | `scripts/ui-kit-metrics.mjs:uiKitViolations` + `test/ui-kit-metrics.test.mjs` (прогнано мной, PASS) | `cssLines: base+21` → violation; `transitions/keyframes/...: base+1` → violation; отсутствующий `now`/`base` → violation (все проверены юнит-тестом) |
| Полнота реестра: неизвестная корзина/дубликат id/пустая ячейка/отсутствующий кадр или план съёмки отказывают | `scripts/ui-kit-metrics.mjs:registryMetrics,validateCapturePlans` + `test/ui-kit-metrics.test.mjs` (прогнано мной, PASS) | `'?|uncertain'`, `'K|'`, `'M'` (без pipe), `'Z|unknown'`, `null`, дубликат id, `missing frame`, `missing runnable` — каждый отдельно проверен и вызывает `throws` |
| Гейт агрегирует UI Kit-строки в `ratchets.mjs report`/`--check` наравне с monolith-metrics | `scripts/ratchets.mjs:ratchetRows` + `test/ratchets.test.mjs` тест `#1146 ...` (прогнано мной, PASS) | `cssLines` сверх полосы → `state:'over'`; рост прочих метрик → `'grew'`; отсутствующий `uiKitBaseline` → `'missing'` |
| Разбор шаблонов не исполняет код и не путает комментарии/строки/вложенные литералы с реальным CSS/разметкой | `scripts/ui-kit-metrics.mjs:templates,collectUiKitReport` + `test/ui-kit-metrics.test.mjs` (прогнано мной, PASS) | синтетические фикстуры с `// css\`fake\``, `/* @keyframes fake */`, `"quoted }"`, HTML-комментарием с `<hp-dialog>` — не создают ложных фактов (проверено assert’ами на точные числа) |

## Что проверено и корректно

- Нет изменений в `src/**` — задача действительно класса B/C, Core user job
  не затронут.
- `scripts/ui-kit-metrics.mjs` — корректный читающий (non-executing) разбор
  TS AST, согласован с `css-source.mjs`/`css-lex.mjs`, интегрирован в
  `ratchets.mjs`, `gate-small.mjs`, `check-inputs.mjs`, CI workflows
  (`validate.yml`, `validate-product.yml`) без зависимости от `dist`.
  `scripts/ratchets.mjs` для `tighten` дополнительно пишет
  `scripts/ui-kit-baseline.json` — согласовано с остальными baseline-файлами.
- Реестр `ui-kit-inventory.json`: схема/счётчики арифметически и выборочно по
  evidence совпадают с фактическим кодом и с заявленными в документации
  числами (118/118/254/21, registryOffKit 372).
- `docs/design/UI-KIT-METRICS.md` честно описывает границы метода (CDP не
  доказывает недостижимость, static census не равен динамическому CSS),
  явно называет известный разрыв в онбординге (`missing-before-1147`,
  `acceptance:false`) и передаёт его в принятое ТЗ #1147, а не прячет и не
  выдаёт за пройденный кадр.
- Release-ledger классификация (`infra` для #1146 и архивной #682 в папке
  `v1.83.0/`) и смена `docs/release-ledger/cycle.json` на `v1.84.0`/
  milestone 11 — авторское суждение в разрешённых пределах, не выводится
  механически из User-Visible, обоснование относительно предыдущего stable
  присутствует в обоих файлах.
- Capture-хелпер (`demo/helpers/ui-kit-capture.mjs`) — opt-in по
  `HP_UI_KIT_CAPTURE_DIR`, no-op в обычном прогоне; единственная «private-ok»
  точка (`demo/capture_ui_kit_transients.mjs`, подмена `card._continuity`)
  явно прокомментирована как сравнительная фикстура, а не доказательство
  recovery/достижимости — соответствует политике приватных записей смоков.
- Числа CSS/реестра приведены один раз на канонический источник
  (`scripts/ui-kit-baseline.json`), зеркалируются идентично в документации и
  в коммитированном отчёте аудита — расхождений не найдено (§8).

## Чего не проверял

- Не перепроверял вручную все 511 ячеек реестра против кода (физически
  невыполнимо в рамках соразмерного ревью); сделал точечную сверку
  нескольких ячеек (подтвердилась) и положился на структурные/схемные
  гейты (`registryMetrics`, `validateCapturePlans`), зелёные в CI на этом SHA.
- Не гонял browser-смоки и CDP UI Lab прогон самостоятельно — переиспользовал
  зелёный `validate-gate` [41153242490] на этом материале (14/14 capture-смоков,
  162 кадра CDP, 0 ошибок — указано автором и согласуется со структурой
  `docs/design/ui-kit-audit-1146.json`, которую я прочитал).
- Не читал полный текст коммит-трейлеров (`Issue:`/`User-Visible:`) —
  недоступно текущим инструментарием ревью (см. «Отмечено, но не является
  находкой» выше).
- Не прогонял полный `npm run gate:small` заново — material/env/oracle не
  изменились после уже пригодного зелёного прогона на этом же SHA.

## Вердикт

**GREEN.** High: 0, Medium: 0. Побочных находок нет (`outside_findings: []`).
Маршрут: `fix` (директива #726).

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjcwZmIwZTEzM2VjZGFhYzEwNTU0ZGYzZmM3NTY2MDQwNGZmMDlhNDA4ZDI4NjI4ZDk2OGNiOTNjZmY0ODQ2MWYiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJiMWM2YmI1NmVlZTlkM2MyNjZjY2NhYThmNWFiMzNkYzM0MGYyMTAwYjBmMmMwOTNjMzc2MDYwNGNlMzc5ZWE0IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTQ2LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiJkNzVkMzRiZjg5YjRhMTE3MDk3OTFiODM5Njg5Y2Y0M2M4YzU5MDU2IiwidHJlZSI6Ijg0ZjZmODU5YzQ4YmZmY2VkOTc0ZjJmNzJjNDAxMTg5MDFkYWFjMjkiLCJib2R5RGlnZXN0IjoiOGEzMmM2NjI4YjdjZGU2NDlkZjFjZTY1NjEyYmI3NTg2NjRmMzA2ZDUzYzAxMjYyMTE4MDg4ZWQ3NTA4YjdjOSIsInByb2R1Y2VyUnVuIjoiNDExNTQwNDE4OTMiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6Ijk4NmVjZTIyMzcyOTE5ODVjYmFhODRkMjhmZDdkOTk0MDNjMTZkNTJjNWI3MzVkMDBlMWFkNTJhN2JiMzQ0NDEiLCJ2ZXJkaWN0RGlnZXN0IjoiOWI0NTZmOGE2Yzg4ZDY0YmE0Y2RiN2QxZmU0MGMyOTM3MTBhYTFjMGFhZDlhYmIyNWQyMGJkNWIwODRkOTc1MSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJiNjIyZmNmNDBkM2ZiZTMwMWJjM2Q4MWZkZTA3NTdjZDg0NzIyZWNlNWY2N2Y0YThjY2U3MWNjMGZhNmYwNTExIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTM3MDg1MDMxLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTQ2I2lzc3VlY29tbWVudC02NTM3MDg1MDMxIiwiYm9keURpZ2VzdCI6ImY3ZmM0N2Y1YTI1YTVlNmUwNTMxMWUxMTc3ZDIxN2E5ODA0ZjljNTU5Nzc4Nzc2ZDNmOTU1YTM1MjIzMGVhZGUifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1146-ui-kit-measurement`, коммит `d75d34bf89b4` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `84f6f859c48bffced974f2f72c40118901daac29`
  ```
  git log --all --format='%H %T' | grep 84f6f859c48b
  ```
- Тело issue: `8a32c6628b7cde649df1ce65612bb758664f306d53c01262118088ed7508b7c9`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":41154041893,"run_attempt":1,"digest":"44a2b4b6ff913dd041d58cca6bffea2bf919a2eb04cc7dbdc929231ba015dd86"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6ODAsIm91dHB1dF90b2tlbnMiOjMxNjA5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEzNDIwMCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjQwOTQ2NTgsImNvc3RVc2RFc3RpbWF0ZSI6MS42NzE5ODE1OTk5OTk5OTk4fV0sInR1cm5zIjo0NSwiZHVyYXRpb25NcyI6NDA1NjI3LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS42NzE5ODE1OTk5OTk5OTk4LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=80 output_tokens=31609 cache_creation_input_tokens=134200 cache_read_input_tokens=4094658 num_turns=45 -->
