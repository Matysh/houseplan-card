# CODE-REVIEW-1036-r1

Issue: #1036 «Печать и экспорт: PDF-чертёж и SVG текущего вида в одном диалоге»
Трек: ask · Этап: code · Заход: r1 · блокирующих циклов 0/4
Материал: `issue/1036-svg-export@86b11405edec0fd2d45491669c579ddab104e844`
(рабочая копия на этом SHA; `git rev-parse HEAD` сверен перед вердиктом).
ТЗ: зелёный SPEC r2 (`docs/reviews/SPEC-REVIEW-1036-r2.md`,
Spec-Draft sha256:5d9cbe312aa4abb3b75b484e890f9d8cad0c531d14499059f905adf0fca2087e).

## Скоуп

Диапазон `origin/dev..HEAD`, 5 коммитов:

- `85697890d` feat: download the current View as SVG from the print dialog
- `cab67f2cd` test: register SVG export guard witnesses and refresh input inventory
- `c4a3a356f` fix: retain PDF preferences and bound repeated SVG image placements
- `5af94adc4` test: exercise the SVG colour completion guard directly
- `86b11405e` test: pass the PDF format explicitly in golden captures

Изменённые файлы продукта: `src/pdf/{hp-pdf-dialog,pdf-export,export-options,svg-snapshot}.ts`,
минимальный read-only callback `svgSource` в `src/houseplan-card.ts`, общий leaf
`src/settings-select-control.ts` (прежний экспорт `selectControl` вынесен из
`src/editors/form-kit.ts` без изменения поведения), i18n RU/EN/DE/FR. Плюс
тесты (`test/svg-export.test.mjs`, `demo/smoke_svg_export.mjs`, правки
`demo/smoke_pdf_export.mjs`, `demo/golden/run.mjs`), реестр мутантов, бюджеты
бандла, docs (ARCHITECTURE/PDF-EXPORT/DEVELOPMENT/STATUS/SCOPE/USER-GUIDE,
changelog RU+EN), release ledger `docs/release-ledger/v1.82.0/1036.json`.

Трейлеры: все 5 коммитов несут `Issue: #1036`; `User-Visible: yes` у
`85697890d` и `c4a3a356f` — оба правят `docs/CHANGELOG.md` и
`docs/CHANGELOG.ru.md` в тех же коммитах (проверено чтением diff по коммитам).

## Риск по изменённым участкам (#707) — покрытие классов AC ТЗ

- **perf** (`src/pdf/svg-snapshot.ts:15,30,32,59,86` — `getBoundingClientRect`/
  `getComputedStyle`): контракт ТЗ прямо ограничивает эти вызовы — «SVG runtime
  остаётся lazy, без сериализации/обхода DOM на HA ticks или render; захват
  выполняется только по команде скачивания» (раздел «Модель, файлы и
  миграция»). Проверено чтением: `captureSvgView`/`finishSvgView` вызываются
  ровно один раз, синхронно внутри `context.save(request)` из явного клика
  «Скачать» (`src/pdf/pdf-export.ts:103-110`), не из рендер-цикла, не из
  таймера/observer. Busy-состояние («Формируем…») покрывает время обхода.
  Класс покрыт.
- **ux** (новые ключи `export.*` в `src/i18n/{de,en,fr,ru}.json`): покрыты
  AC1 (заголовок/формат/кнопка), AC2 (fade чекбокса), AC3 (фон/picker), AC9
  (компоновка/UI-kit/320px/reduced-motion) и разделом «i18n» ТЗ, который
  перечисляет эти ключи поимённо. Все 4 локали синхронны (сверено diff),
  `test/i18n.test.mjs` получил адресные allow-list записи для легитимных
  DE/FR омографов (`export.transparent`). Класс покрыт.

## Как проверялось

Зелёный Validate уже подтверждён на этом SHA (#343):
https://github.com/Matysh/houseplan-card/actions/runs/39862343262 — Golden,
frontend, backend, упаковка. На этом основании `npx tsc --noEmit`, `npm test`,
`npm run build`+bundle-policy не перегонялись целиком; вместо этого раунд
потрачен на чтение кода и точечные дешёвые гейты:

| Гейт | Результат | Назначение |
|---|---|---|
| Validate (CI, SHA 86b11405e) | PASS (ссылка выше) | typecheck/test/build/bundle/golden/backend — общее основание раунда |
| `npx tsc -p tsconfig.test.json` (локально) | PASS | типы тестовой сборки, не дублирует Validate, дёшево |
| `node --test test/svg-export.test.mjs` (локально) | 4/4 PASS | убедился, что тест умеет падать: смотрел логику (NaN/Infinity/-1/limit+1, бюджет при повторных placements, отказ `prepareCompletion()===false`) — не просто читал код |
| `node scripts/mutation-gate.mjs --check` (локально) | static PASS, definitions=1781, execution=0 | подтверждает регистрацию 5 новых мутантов #1036, без исполнения (ночной конвейер) |
| `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | PASS, 0 предупреждений | трейлеры/формат коммитов |
| `npm run inventory` | Node unit 5066 / pure backend 579 / HA-harness 484 / browser smokes 412 / mutation guards 469 | совпадает с `docs/STATUS.md` один-в-один |

### Чего не проверял

- Полные `npm test` / `npm run build` / `golden:verify` целиком — покрыты
  зелёным Validate на этом же SHA, повторный прогон не нужен (#343).
  `npm run gate:small` целиком тоже не перегонялся отдельно — его состав
  входит в тот же Validate.
- Ручная dev/GPU-приёмка — не обязательна, headless не выдаётся за неё
  (§7.1, #929); автор прямо пометил её как «не сделано (не обязательна)».
  Полный release Validate и beta — после S8 всех #1036/#1035/#1037, не
  предмет этого ревью.
- Browser-смоки (`smoke_svg_export.mjs`, `smoke_pdf_export.mjs`,
  `smoke_settings_select.mjs`, `smoke_dialog_ui_kit.mjs`) не перезапускал
  локально (нужен Chromium headless + dev-сервер поверх уже зелёного Validate);
  принял по ссылке на прогон и по чтению самого файла смока — его сценарии
  (XML-факты, offline-рендер при заблокированной сети, pixel-diff
  Flat/2.5D < 0.3%, три редактора, 320px) соответствуют заявленным AC и не
  являются «PASS без проверки, что тест может упасть»: смотрел конкретные
  `assert.equal`/`check(...)` на отрицательные ветки (503 на подложку, invalid
  HEX, retired context, editor refusal) — не только happy path.
  Сам «способен ли тест упасть» для исполняемых AC подтверждён для unit-слоя
  личным прогоном; для browser-слоя — чтением сценария и успешным Validate,
  без дублирующего локального запуска Chromium.

## Защитные AC — таблица «чем краснеет» (сверено с `scripts/mutation-registry.mjs`)

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (PDF preferences non-regression) | `smoke_pdf_export.mjs` + новый PDF-failure шаг в `smoke_svg_export.mjs` | обычный негативный случай: HTTP 503 на подложку → PDF не скачивается, `hp.pdf.options.dimensions` остаётся прежним (проверено — это как раз регрессия, исправленная коммитом `c4a3a356f`, который переставил запись localStorage до `await context.save`) |
| AC3 (invalid HEX блокирует) | `test/svg-export.test.mjs` unit + browser | unit: `prepareCompletion()===false` → `saved=0,closed=0` (выполнен локально, PASS); witness `svg-invalid-colour-completes-1036` — не исполнялся (ночной) |
| AC5 (устройства off исключает LED/vacuum/radar) | XML-факты реального скачивания в `smoke_svg_export.mjs` | witness `svg-device-choice-ignored-1036` — не исполнялся |
| AC6 (офлайн, без сети, безопасный текст) | standalone-рендер при заблокированной сети + кириллица/`<script>` текст | обычный негативный случай в смоке: `external`/`safe` проверки на реальном XML; не отдельный witness |
| AC7 (stale-контекст не скачивает) | held fetch + событие смены конфигурации в смоке | witness `svg-stale-context-downloads-1036` — не исполнялся |
| AC8 (бюджет 25 МБ, включая повторные placements) | unit (`test/svg-export.test.mjs`, выполнен — 9 МБ×3 placements одного кэшированного asset → `svg.too_large`, `fetched===1`) + browser asset-failure | witness `svg-repeated-assets-unbudgeted-1036` — не исполнялся |
| AC10 (editor fence) | реальные mode-tab/Print/формат/Скачать во всех трёх редакторах в смоке | witness `svg-editor-view-fence-disabled-1036` — не исполнялся |

Ни одной пустой третьей колонки нет.

## Что проверено и корректно

- **Заголовок/кнопка/формат (AC1).** `pdf.title`/`title.export_pdf` →
  «Скачать файл для печати» во всех 4 локалях; `pdf.save` → «Скачать»; формат
  первым полем, `selectControl` из общего `src/settings-select-control.ts`
  (`src/pdf/hp-pdf-dialog.ts:193-197`).
- **Независимые черновики PDF/SVG (AC2).** `this.options`/`this.svgOptions` —
  раздельные поля компонента, `setOption`/`setSvg` не пересекаются; смок
  переключает SVG→PDF→SVG и видит оба черновика нетронутыми
  (`svg-choice-restored`, `pdf-dimensions-independent`). Fade — `Animation`,
  пропускается при `prefers-reduced-motion` (`src/pdf/hp-pdf-dialog.ts:122-132`).
  Структурно `<input>` чекбокса остаётся тем же узлом шаблона при смене
  формата (не меняется форма `html` между ветками), так что потеря фокуса по
  построению исключена; явного `assert` на `document.activeElement` в смоке
  нет — это проверено чтением, не исполнением.
- **Устройства off по умолчанию (AC5).** `svgDefaults()` — `devices: false`
  (`src/pdf/export-options.ts`), юнит `SVG defaults exclude devices...` PASS.
  `CHROME`/`DEVICE`-селекторы в `svg-snapshot.ts` — все классы существуют в
  реальном рендере (`grep` подтвердил `.dev`, `.vactrail`, `.radar-target`,
  `.led-strips`, `zigbee-topology-overlay` и т.д., не вымышленные строки).
- **Три фона + picker (AC3).** `background: 'transparent'|'current'|'custom'`,
  picker показывается только при `custom` (`hp-pdf-dialog.ts:216-235`), общий
  `hp-color-opacity`/`normalizeHexColor` переиспользованы без копирования
  логики. HEX/alpha реально видны в скачанном SVG (`customBackground` проверка
  в смоке `fill`/`opacity` на корневом `rect`).
  День-цикл/небо добавляются в вывод только при `background==='current'`
  (`src/pdf/svg-snapshot.ts`, строка с `options.background === 'current' &&
  child.matches('.hp-day-cycle-env,.hp-moon-sky')`) — соответствует «Как сейчас
  на плане» в ТЗ.
- **Офлайн-воспроизведение (AC4/AC6).** Native scene SVG остаётся SVG;
  HTML-презентация (лейблы/маркеры) — `foreignObject`; `on*`/`data-*`/`href`
  (кроме image/img/use) атрибуты вырезаются при клонировании; `<script>`,
  `<canvas>`, `<iframe>` и т.п. либо исключаются, либо (canvas) намеренно
  роняют экспорт как asset failure, а не рендерят пусто. Протокол ассетов
  ограничен `http/https` (same-origin) + `data:`/`blob:`
  (`src/pdf/svg-snapshot.ts`, `finishSvgView`/`embed`). Пиксельное сравнение
  offline-SVG с реальным View в смоке — `<0.00013` при пороге `0.003`
  для Flat и 2.5D (из прошлого прогона автора, не переисполнял сам, но логика
  сравнения в файле смока соответствует заявленному).
- **Контекстные гарды (AC7).** `svgSource()` в `houseplan-card.ts` бросает
  `svg.view_required` вне View, `svg.not_ready` во время boot/переходов;
  `isCurrent()` проверяет `_canEdit` (соответствует отзыву прав — кнопка
  печати и так видна только при `_canEdit`, см. `src/houseplan-card.ts:10988`),
  `_space`, `_serverCfg`, `stage.isConnected`. `finishSvgView` детачит snapshot
  до первого `await`, `pdf-export.ts` перепроверяет `isCurrent()` после
  асинхронного embed и до создания файла.
- **Бюджет 25 МБ и повторные placements (AC8).** Исправлено коммитом
  `c4a3a356f`: `embeddedBytes` считается на каждое размещение (включая кэш-хит),
  не только на фактическую загрузку; юнит это подтверждает исполнением.
- **Editor fence (AC10).** Print-действие доступно в редакторах
  (`_canEdit`, не зависит от `_mode`), но `svgSource()` немедленно бросает
  `svg.view_required`, если `_mode !== 'view'` — форма остаётся открытой, файл
  не создаётся, режим/draft/геометрия не меняются (смок гоняет все три
  режима и проверяет оба исхода: SVG-отказ и работающий PDF).
- **Регрессия golden.** Предыдущая подача `5af94adc4` ломала Validate, потому
  что `demo/golden/run.mjs` вызывал `dialog.context.save(options)` по старой
  сигнатуре; `86b11405e` поправил вызов на `{format:'pdf', options}` —
  исправление не трогает эталонные кадры, только вызов функции.
- **Документация/SCOPE/ledger.** `docs/SCOPE.md` получил явное расширение
  узкого read-only исключения #1036 (требование M2 из SPEC r1 выполнено).
  `docs/release-ledger/v1.82.0/1036.json` — `major`, обоснование соответствует
  новой пользовательской функции, без миграции. Changelog RU/EN синхронны по
  смыслу и присутствуют в тех же `User-Visible: yes` коммитах.
- **Одно число — один источник (§8).** Размеры бандла (`331_681`/`35_356` gzip
  в `scripts/bundle-budget.mjs`, `3354401` в `scripts/monolith-baseline.json`)
  обновлены согласованно с комментарием автора и проверяются
  `bundle-policy --verify` внутри Validate — не два независимых источника.
  Счётчики тестов в `docs/STATUS.md` (5066/579/484/412) совпадают с локальным
  `npm run inventory` однин-в-один.

## Находки

Нет. High: 0, Medium: 0 (в скоупе и вне скоупа).

Малое наблюдение без статуса находки: явная проверка потери фокуса при fade
(AC2, «без потери фокуса») не покрыта отдельным assert в смоке — поведение
проверено чтением структуры шаблона (стабильный узел `<input>` между
ветками формата), этого достаточно для обычного (не защитного) AC и не
является дефектом.

## Маршрут

`route: fix` (трек `ask`, не `show` — поле `route` не о реклассификации).

## Вердикт

Зелёный. Все 10 AC ТЗ доказаны автотестом с подтверждённой способностью
падать (юнит — личным прогоном, браузерный — чтением сценария поверх
зелёного Validate на материале) либо прочитаны в коде с явной пометкой.
Защитные AC имеют непустую колонку «чем краснеет» — зарегистрированные
witness id или обычный негативный случай. Классы риска `perf`/`ux` покрыты
текстом ТЗ. Трейлеры и changelog корректны. Release ledger обоснован.
Находок нет, цикл не образуется.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1036-svg-export`, коммит `86b11405edec` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `2b09cc1f8ba0217a603781ab6e5e31df06b01ba2`
  ```
  git log --all --format='%H %T' | grep 2b09cc1f8ba0
  ```
- Тело issue: `5d9cbe312aa4abb3b75b484e890f9d8cad0c531d14499059f905adf0fca2087e`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUwNjgsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTY4fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMTAsIm91dHB1dF90b2tlbnMiOjMyOTk2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE1NzE2OCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjU2MTYyMTAsImNvc3RVc2RFc3RpbWF0ZSI6Mi4wODIwOTR9XSwidHVybnMiOjYyLCJkdXJhdGlvbk1zIjo0MzIxNjEsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoyLjA4NzI2MiwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5178 output_tokens=33016 cache_creation_input_tokens=157168 cache_read_input_tokens=5616210 num_turns=62 -->
