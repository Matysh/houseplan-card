# CODE-REVIEW — issue #1020, заход r1

Материал: `2c616d8710476203d1c5c902a985941104ddac06` (рабочая копия на этом SHA, не переключался).
Трек: ask. Этап: code. Блокирующих циклов: 0/4.

## Скоуп

ТЗ (редакция 3, 26.10.2026): общий абзац-подсказка о конвертере планов (Sweet
Home 3D / Easy Floorplan) на пустом экране House Plan и в существующем
диалоге «Создать пространства из этажей HA»; единый источник URL/форматов,
используемый также в «Общих настройках»; перевод на 4 языка; доступность
подсказки для non-writer/admin без server storage без расширения прав;
отдельная lazy-граница от редактора.

Изменённые файлы просмотрены по списку REVIEW_CONTEXT: продуктовый код
(`src/hp-plan-converter-info.ts`, `src/plan-converter.ts`,
`src/floor-import-dialog.ts`, `src/houseplan-card.ts`,
`src/houseplan-onboarding-runtime.ts`, `src/view-runtime-code.ts`,
`src/view-runtimes.ts`, `src/compact-dialog-styles.ts`,
`src/styles/settings-action.styles.ts`, `src/styles/form-kit.styles.ts`,
`src/styles/form-kit-tokens.ts`, `src/editors/settings-styles.ts`,
`src/editors/general-settings-dialog.ts`, `src/i18n/converter.ts` и 4
JSON-словаря, `src/i18n/*` четыре локали), тесты
(`test/plan-converter.test.mjs`, `test/i18n-dead-keys.test.mjs`,
`test/golden-matrix.test.mjs`), смоки/golden-инфраструктура
(`demo/smoke_first_space_converter.mjs`, `demo/helpers/first-space.mjs`,
`demo/golden/harness.mjs`, `demo/golden/matrix.mjs`), документация
(`docs/ARCHITECTURE.md`, `docs/USER-GUIDE(.ru).md`,
`docs/CHANGELOG(.ru).md`, `docs/STATUS.md`,
`docs/design/1020-first-space/*`), release-ledger
(`docs/release-ledger/v1.82.0/1020.json`), реестры
(`scripts/mutation-registry.mjs`, `scripts/smoke-links.mjs`,
`scripts/ci-registry-inventory.json`, `scripts/bundle-manifest.mjs`).

## Как проверялось

Static-first: прочитан REVIEW_CONTEXT (тело issue, хендофф, ciEvidence),
весь список изменённых файлов из `changedFiles`/`fullHunkReads` — продуктовый
код полностью, стили/реестры точечно с опорой на `read:base:*` для сравнения
с базой там, где риск («perf»-метка на `filter:` в
`form-kit.styles.ts`/`settings-action.styles.ts`) требовал понять, что именно
изменилось, а не просто что строка задета.

Проверены независимо:
- `src/hp-plan-converter-info.ts` — компонент, `pointerdown`/`click`
  `stopPropagation` (защита от передачи жеста в план/карту), `touch-action:
  manipulation`, `target=_blank`/`rel=noopener noreferrer`, reduced-motion.
- `src/plan-converter.ts` — единственный источник `PLAN_CONVERTER.url` и
  `formats`; `planConverterFormats()` не мутирует входной массив.
- `src/i18n/converter.ts` + 4 словаря — текст/ссылка разделены на сегменты
  (`before_link`/`link`/`after_link`/`supported_formats`), URL и расширения
  живут в данных (`plan-converter.ts`), не в переводах — проверено по всем
  четырём файлам.
- `src/editors/general-settings-dialog.ts:286-288` — существующий
  `gs.converter_description`/`gs.converter_link` теперь берёт `{formats}` из
  `planConverterFormats()`, тот же `PLAN_CONVERTER.url` — один источник,
  дублирования списка форматов больше нет (AC4/AC6).
- `src/houseplan-card.ts:10913-10948` — empty screen: `hp-plan-converter-info
  placement="empty"` вынесен за пределы ветки `_serverStorage &&
  _canManageConfiguration` и рендерится в обеих ветках (после кнопок или
  после `empty.read_only`/`empty.install`) — соответствует контракту п.2 ТЗ.
- `src/floor-import-dialog.ts:29` — тот же компонент под списком этажей,
  перед footer.
- `src/view-runtime-code.ts`/`src/view-runtimes.ts` — отдельный
  `converterInfoCode`/`ViewRuntimeBoundary` с собственным fingerprint,
  `informational=true` порт (без claim на `_configWriteContext`),
  `wantsConverter()` включает все три ветки (writer+storage через
  `_serverCfg.spaces.length===0`, non-writer/no-storage через
  `_serverStorage===false && _model?.length===0`, и открытый
  `_importDialog`). Дефект лениво гружаемого чанка не прерывает остальной
  View (отдельный boundary, не блокирует запись).
- `src/compact-dialog-styles.ts` — независим от onboarding/editor-рантаймов,
  подключается и из `floor-import-dialog.ts` (через `renderFloorImportDialog`
  → `ensureCompactDialogStyles`), и из `src/editors/settings-styles.ts`
  (однонаправленно: editor → shared, не наоборот) — lazy-граница не нарушена
  (проверено также по `src/houseplan-editor-runtime.ts`: нет импортов
  `PLAN_CONVERTER`/`hp-plan-converter-info`/`settingsTextLinkCss`).
- `src/styles/settings-action.styles.ts` — сверено `read:base` против
  текущей версии: `settingsTextLinkCss` — новая функция (в базе отсутствовала),
  `form-kit.styles.ts` — сверено `read:base`: строки 398-399 в базе уже
  содержали идентичный инлайновый CSS (`filter:none` на link/hover), кандидат
  просто вынес его в общую функцию и переиспользовал в
  `hp-plan-converter-info.ts`. Правка — чистое устранение дублирования,
  поведение не меняется (риск-метка «perf» на `filter:` — ложноположительная,
  не регрессия).
- `src/styles/settings-dialogs.styles.ts`/`src/editors/settings-styles.ts` —
  сверено `read:base`: в settings-dialogs.styles.ts изменений вокруг
  `.hpf-converter` нет; в settings-styles.ts добавлен только вызов
  `ensureCompactDialogStyles(host)` — ожидаемое переиспользование общего
  компактного набора в settings-диалогах, без нарушения направления
  зависимости.
- Golden-матрица (`demo/golden/matrix.mjs:1536-1543`) — 8 новых сцен
  (`first-space-{empty,floors,no-storage}×{light,dark}` +
  `first-space-floors-narrow×{light,dark}`) + 1 изменённая существующая
  (`panel-narrow-read-only-empty-light-en`, зафиксирована как `"expectation":
  "change"` в release-ledger) = 9, что совпадает с «9 целевых сцен» в
  хендоффе (расхождение числа в `matrix.mjs` разрешено чтением ledger).
- `test/plan-converter.test.mjs` — юнит на общий источник: один
  `PLAN_CONVERTER`/`planConverterFormats` проецируется в оба потребителя,
  добавление формата не мутирует исходный массив; все 4 словаря не содержат
  URL/названий форматов внутри перевода (данные отделены от текста).
- `test/i18n-dead-keys.test.mjs` — словарь `converter/en.json` включён в
  общий contract «ни одного мёртвого ключа».
- `demo/smoke_first_space_converter.mjs` — прочитан целиком: покрывает (1)
  обрыв сети `hp-plan-converter-info-*.js` не блокирует выбор этажей/ручное
  создание — это обычный негативный сценарий с реальным сетевым abort, не
  мутант; (2) четыре комбинации writer/storage/kiosk без прав — подсказка
  видна, редактор/настройки не грузятся, записей нет; (3) реальный клик
  клавиатурой (focus+Enter) открывает popup на `houseplan.tech/convert/` без
  prefetch, сохраняет выбор этажей и disabled-счётчик; (4) динамическая
  проекция добавленного формата одновременно в оба рендера; (5) Cancel/reopen
  сохраняет/восстанавливает empty-блок; (6) добавление/удаление последнего
  пространства показывает/прячет блок без флага «первого визита»; (7) 4
  языка × узкий viewport × reduced-motion × длинный формат — перенос без
  overflow, 0 записей.
- `scripts/mutation-registry.mjs` — два новых witness
  (`first-space-converter-link-target` на `target="_blank"`,
  `first-space-converter-writer-only` на `port(() => {}, true)`), оба
  guarded тем же смоком, задокументированы в
  `docs/testing-notes/mutation-browser-guards.md:634-640` как «registered for
  nightly; no mutant execution in task development» — согласуется с общей
  политикой (мутанты вне ночного workflow запрещено исполнять).

Запущено адресно через `mcp__houseplan_review__run_check`:
- `read:log` — 5 коммитов, совпадает с хендоффом.
- `read:base:src/styles/form-kit.styles.ts`,
  `read:base:src/styles/settings-action.styles.ts`,
  `read:base:src/styles/settings-dialogs.styles.ts`,
  `read:base:src/editors/settings-styles.ts` — целевое сравнение база/кандидат
  для риск-отмеченных `filter:`-строк и для проверки направления
  stylesheet-зависимости (см. выше).
- `static:mutation-registry` — PASS (реестр синтаксически валиден, новые
  записи учтены).
- `static:bundle-budget` — FAILED с `ENOENT dist/houseplan-assets.json`: это
  не регрессия продукта, а отсутствие предварительной сборки в этом
  ad hoc окружении (скрипт требует `dist/`, которого здесь нет без
  `npm run build`). Бюджет bundle уже зафиксирован зелёным в прилинкованном
  validate-gate (`review-light-golden proof is complete`,
  https://github.com/Matysh/houseplan-card/actions/runs/40371887287) и в
  хендоффе (pre-push GREEN на HEAD 18bc4b96, 338 с, с конкретными числами
  initial/editor/onboarding дельт в пределах унаследованных полос) — повторная
  сборка здесь только ради статического чек бюджета не даёт нового
  свидетельства по сравнению с этим прогоном, поэтому не настаивал на
  полной пересборке.

Остальные доступные ordinary checks (`build:build`, `build:test`,
`build:typecheck`, `unit:test/plan-converter.test.mjs`,
`unit:test/i18n-dead-keys.test.mjs`, `smoke:demo/smoke_first_space_converter.mjs`,
`unit:test/golden-matrix.test.mjs`) не перезапускались: материал, их входы и
среда не менялись относительно зелёного validate-gate на этом же SHA, а
независимое чтение кода не выявило расхождений с заявленными в хендоффе
результатами (ни одного AC/риска без пригодного доказательства не осталось
непокрытым). Полные gate:small/npm test не являются предметом ревью (§8) и
не запускались.

## Находки

Находок, требующих возврата автору, не обнаружено. Побочных находок вне
скоупа также нет (см. REVIEW_FINDINGS — "Побочных находок нет", mode=file
получит пустой outside_findings).

## Сопоставление с AC

| AC | Результат | Доказательство |
|---|---|---|
| AC1 | Подтверждено чтением: оба блока в заданных местах/отступах (`hp-plan-converter-info` host CSS `margin:20px 0 0`/`gap:20px` в диалоге через `:host`, `margin:24px auto 0;max-width:620px` в `placement=empty`); диалог использует `ensureCompactDialogStyles`. | smoke (locator/attrs) + 9 golden сцен (release-ledger v1.82.0/1020.json) |
| AC2 | Подтверждено чтением `houseplan-card.ts:10930-10947`: блок вынесен за пределы writer/storage-ветки, рендерится в обеих ветках; `wantsConverter()` в `view-runtimes.ts` включает writer+storage/non-writer/no-storage. Lifecycle (создание/импорт/удаление последнего) — smoke. | smoke (writer/non-writer/no-storage/kiosk матрица + lifecycle loop), код прочитан |
| AC3 | Выбор этажей/disabled/отмена не тронуты (`floor-import-dialog.ts` не менял существующую логику подсчёта/чекбоксов); сохранение выбора после клика по ссылке — real-browser проверка. | smoke (focus+Enter+popup, чекбоксы до/после) |
| AC4 | `PLAN_CONVERTER`/`planConverterFormats` — единственный источник, переиспользован в `general-settings-dialog.ts:286-288`; добавление формата проецируется в оба рендера одновременно. | unit (`plan-converter.test.mjs`) + smoke (live DOM projection в обоих местах) |
| AC5 | `target="_blank"`/`rel="noopener noreferrer"`, `stopPropagation` на click/pointerdown, нет prefetch (проверено route-listener в смоке). Защищено также mutation witness `first-space-converter-link-target` (не исполнялся — nightly-only). | smoke (href/target/rel/no-prefetch/popup) + id `first-space-converter-link-target` (не исполнялся) |
| AC6 | Reduced-motion (`transitionDuration==='0s'`), 4 языка, узкий viewport, длинный формат — без overflow (`size.content <= size.w`). | smoke (4 локали × narrow × reduced-motion × long format) |
| AC7 | Отдельный `converterInfoCode`/`ViewRuntimeBoundary` с собственным lazy-чанком; `src/houseplan-editor-runtime.ts` не содержит обращений к конвертер-модулям — onboarding/View не тянут editor ради оформления. Отказ чанка не блокирует диалог (route-abort smoke). | код прочитан + smoke (route abort + floor workflow intact) + защищено mutation witness `first-space-converter-writer-only` (не исполнялся — nightly-only) |

## Release-артефакты

`docs/release-ledger/v1.82.0/1020.json`: категория `stable-fix` с обоснованием
(существующий wizard/конвертер уже в v1.82.0 stable, задача делает путь
заметным, новой персистентной модели нет) — суждение выглядит обоснованным
по факту диффа (нет новых config/LS полей, подтверждено и в ТЗ, и в коде:
`createEmptySpaceConfig`/`spaceDialogSettings` не тронуты этой задачей).
CHANGELOG.md/CHANGELOG.ru.md обновлены в одном коммите с кодом (см. `git log`:
`1eb9a7014 feat(onboarding): share converter guidance and compact floor
wizard`), USER-GUIDE.md/.ru.md содержат согласованный текст про ссылку на
конвертер на пустом экране/в диалоге этажей.

## Что не проверялось / границы

- Полная пересборка `dist/` и локальный `static:bundle-budget` не
  выполнялись (см. выше) — числовая дельта бандла принята из уже зелёного
  validate-gate/хендоффа на этом SHA, независимо не пересчитывалась.
- Визуальное пиксельное сравнение 8 новых golden-сцен с UI Lab эталоном
  (парные PNG в `docs/design/1020-first-space/implementation-evidence/`) не
  переоткрывалось как изображение — качество листинга подтверждено на уровне
  `comparison.json`/README по хендоффу (max pixel ratio 0.000308, desktop
  empty — 0 пикселей), сам процесс визуального сравнения не воспроизводился
  заново в этом ревью (не обязательный гейт ревью при пригодном CI-пруфе на
  этом SHA).
- `npm run build`/`npm test`/`gate:small` целиком не запускались — не
  являются предметом ревью (§8); полагался на адресные unit/smoke файлы,
  прочитанные целиком, и зелёный validate-gate.

## Вердикт

Green. Маршрут: fix (не требуется — замечаний нет, но маршрут вердикта
зафиксирован явно, как указано контекстом: `route: fix`).

Прогнанные гейты: `read:log`, 4×`read:base:*` (целевые сравнения база/кандидат),
`static:mutation-registry`. Не прогнан/не пройден: `static:bundle-budget`
(ENOENT dist — причина указана выше, не является регрессией продукта).
Остальные доступные ordinary checks не перезапускались по причине пригодного
reuse зелёного validate-gate на этом же SHA (см. раздел «Как проверялось»).

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjdhZjgyNTI4NDI0YTg0OWRhYWZhOTg0Mjk0ZjVhMjM0Yzk4MzhhZTA0OTRlNGZlYWQ4MzZiYWIyNDRiMDc1NzQiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI5NDE3MjRiOWY5M2JjYzI1ODBmYzVmMzBkOWM0YTk2MzlmMGJkNWU4YTRhMThlM2M4OWViZWQzMDI4NDg3NzAzIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDIwLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIyYzYxNmQ4NzEwNDc2MjAzZDFjNWM5MDJhOTg1OTQxMTA0ZGRhYzA2IiwidHJlZSI6ImI1YjE4NmNkNWVjNmEwOTY3NjYxMmM3ZTM3NmViODg1ZTExNTQxOWYiLCJib2R5RGlnZXN0IjoiNzc0Njk3NTNhZjllZDI4MmQwZDkwNDY0ZDkyMzg4NzZkYTE1MGZiNTljZjk3OTE3NWZiMWZiYzRkMGM2MTVhOCIsInByb2R1Y2VyUnVuIjoiNDAzNzI3NDMyMjciLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjFlY2VmZGY0ZjM4ZGQ5OTZlNTIwNWI2OWU5OTJmOTEwOTA0NWQ1ZDI3MDYyMjc5ZTM3OTZjMTRlNzdhYmRmZGUiLCJ2ZXJkaWN0RGlnZXN0IjoiNmI1YWIxMmNhYWQ3MjRjZjkwZTQxZjc5MWUxOWI1OGQ3M2Y3MzU2ZWNkZTlhN2UzZDM0N2JhOWQyN2ViYmQ4NCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI2YjVhYjEyY2FhZDcyNGNmOTBlNDFmNzkxZTE5YjU4ZDczZjczNTZlY2RlOWE3ZTNkMzQ3YmE5ZDI3ZWJiZDg0IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDIzNTg0NzI4LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDIwI2lzc3VlY29tbWVudC02NDIzNTg0NzI4IiwiYm9keURpZ2VzdCI6ImQ0MDE2MDhiMGVmYzU2MDUxZGJjYTk0ODdhMDRlNzhkNWFkNTlmOGNhNDg0OWU0MjFlZjRmOWVhNGNjZWE0ZTQifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1020-first-space-converter`, коммит `2c616d871047` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `b5b186cd5ec6a09676612c7e376eb885e115419f`
  ```
  git log --all --format='%H %T' | grep b5b186cd5ec6
  ```
- Тело issue: `77469753af9ed282d0d90464d9238876da150fb59cf979175fb1fbc4d0c615a8`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40372743227,"run_attempt":1,"digest":"a174299c7b0c7343cc638a17b289c0d46bc6d5ffef97a259e872d9b59047e6b5"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTE0LCJvdXRwdXRfdG9rZW5zIjoyNzk3NSwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxMzYxODcsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo1ODgyNjMwLCJjb3N0VXNkRXN0aW1hdGUiOjIuMDAxMjUyfV0sInR1cm5zIjo2OSwiZHVyYXRpb25NcyI6MzgzMzAxLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi4wMDEyNTIsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=114 output_tokens=27975 cache_creation_input_tokens=136187 cache_read_input_tokens=5882630 num_turns=69 -->
