# CODE-REVIEW-53-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/53
- **ТЗ:** `docs/specs/053-pdf-export.md` (спецревью зелёное на r2, `docs/reviews/SPEC-REVIEW-53-r2.md`)
- **Ветка:** `issue/53-pdf-export`
- **SHA материала:** `6562d4820492fc8223099ecc060ea479c52411fb` (сверено `git rev-parse HEAD` непосредственно перед выводом, §2.7)
- **Диапазон:** `origin/dev..HEAD`, 20 коммитов, `git diff origin/dev...HEAD` — 150 файлов, +5073/‑969
- **Заход:** r1 (первый код-ревью задачи; ТЗ и его ревью — отдельный, уже пройденный этап)

## Скоуп

Первая реализация #53: экспорт текущего пространства в одностраничный
векторный PDF A4 — собственный минимальный PDF-writer (`src/pdf/pdf-writer.ts`),
печатная сцена из канонической геометрии (`pdf-scene.ts`, `pdf-dimensions.ts`),
диалог с четырьмя галочками (`hp-pdf-dialog.ts`), встроенный сабсет Roboto с
кириллицей, ленивый чанк `pdf`, i18n на 4 языках, golden-сцена,
9 mutation-свидетелей, смок `demo/smoke_pdf_export.mjs`, документация.

Не в скоупе ревью: AC12 (ручная проверка скачивания в мобильном приложении HA)
— по ТЗ выполняется владельцем до закрытия issue, задокументировано в
хендофф-комментарии как открытый риск.

## Как проверялось

### Дешёвые гейты — приняты по ссылке, не перегонялись

Полный Linux Validate зелёный на точном материале ревью SHA `6562d482`:
https://github.com/Matysh/houseplan-card/actions/runs/34075522192 — покрывает
`typecheck`, `npm test`, `build` со сверкой копий бандла, `hacs`, `hassfest`,
`backend`. Это разрешено §8/§343: на этом SHA они не перегоняются.

### Гейты, которые не покрыты Validate-ссылкой и прогнаны мной в этом раунде

| Гейт | Команда | Результат |
|---|---|---|
| Mutation-свидетели §53 (9 шт.) | `node scripts/mutation-gate.mjs --check` (пустой прогон), затем `node scripts/mutation-gate.mjs --id=<mutant>` по каждому из 9 | **все 9 «поймано 1 из 1»** — см. таблицу AC ниже, полный вывод сохранён в логах сессии |
| i18n dead keys | `node --test test/i18n-dead-keys.test.mjs` | 2/2 pass — новые ключи `pdf.*` имеют потребителя |
| Разбор кода (не гейт, а чтение) | `pdf-writer.ts`, `pdf-scene.ts`, `pdf-dimensions.ts`, `pdf-export.ts`, `svg-path.ts`, `pdf-raster.ts`, `pdf-date.ts`, `hp-pdf-dialog.ts`, `generate-pdf-font.mjs`, интеграция в `houseplan-card.ts` | прочитаны целиком |

### Гейты, сознательно не прогнанные, и почему

- **`node demo/smoke_pdf_export.mjs`, `smoke_isometric_contract.mjs`,
  `smoke_room_link.mjs`, `golden:verify`, `check-docs.mjs`** — не перегонялись
  повторно: все пять уже зелёные на материале ревью SHA согласно
  хендофф-комментарию автора (конкретные команды и результаты названы) и
  входят в тот же зелёный Validate-прогон (`smoke`, `golden`, `docs` —
  джобы, названные в §8 PROCESS.md как часть Validate). Диффом задет весь
  `src/**`, поэтому `check-docs` обязателен как гейт — его зелёность
  подтверждена ссылкой на прогон приёмки скриншотов
  (`docs/images/screenshots.json`, `sourceFingerprint` обновлён и совпадает
  с текущим деревом — проверено чтением).
- **`npm run model-invariants -- --config <...>`** — не прогонялся. Диффом не
  тронуты `src/wall-thickness.ts`, `src/physical-geometry.ts`,
  `src/plan-geometry-preflight.ts`, `src/zero-walls.ts`, `src/space-geometry.ts`,
  `src/logic.ts` (проверено `git diff --stat` — пусто). PDF только читает уже
  построенную геометрию через существующие резолверы и разделяемый кэш
  (`sharedWallGeometry`, `resolveInnerContour`, `resolveRoomArea`); записи
  толщины, `layout`, `marker.space`, `open_spans` не затронуты — гейт не
  применим.
- **`python -m pytest tests_backend`** — бэкенд не тронут (нет диффа в
  `custom_components/**/*.py`).
- **Performance-профили `large-house-*-smoke`** — задеты только
  `src/iso-*`/`src/live-*`/`src/render-*` в списке §8 их не включают; PDF
  вообще не входит в initial View граф (см. AC11), поэтому изменение не может
  задеть эти профили. Собственный perf-порог AC (< 200 мс CPU на текущем
  20‑комнатном `large-house`) доказан отдельным unit-тестом
  (`test/pdf-scene.test.mjs`, «under 200 ms»), который я прочитал и который
  входит в зелёный `npm test`.
- **Полный набор `demo/smoke_*.mjs`** — не запускался: диффом не задета ни
  одна другая функциональная область (никаких изменений в `src/wall-*`,
  `src/editors/**` кроме стилей заголовка, разобранных ниже).

## Находки

Ни одной High или Medium. Одна Low.

### Low-1 — расхождение текста ТЗ §8.3 с фактическим поведением фолбэка шрифта

`docs/specs/053-pdf-export.md` §8.3 утверждает: «Глиф вне сабсета →
`.notdef` (пустой прямоугольник)». Фактически (`src/pdf/pdf-writer.ts:55`):

```ts
const glyph = PDF_FONT_GLYPHS[code] || PDF_FONT_GLYPHS[0x3f] || 0;
```

`0x3f` — код символа `?`; `PDF_FONT_GLYPHS["63"]` резолвится в реальный,
видимый глиф вопросительного знака (проверено чтением
`src/pdf/pdf-font.generated.ts:7`), а не в глиф `0` (`.notdef`). На листе вне
сабсета печатается видимый «?», а не пустой прямоугольник — расхождение с
текстом ТЗ, не с продуктом: поведение внутренне непротиворечиво и не хуже
описанного (видимый плейсхолдер читаемее пустого прямоугольника).

Формулировка ТЗ «язык плана ограничен четырьмя поддерживаемыми, поэтому в
практике не встречается» тоже неточна: `pdf.room_names`/decor-текст — это
**пользовательский ввод** (название комнаты, текстовый декор), не
локализация карточки; пользователь волен ввести любой символ вне
Latin/Cyrillic/пунктуации сабсета (например, CJK), и тогда сработает именно
этот фолбэк. AC8 требует только «кириллица и латиница» — выполнено и
доказано парсингом `pdfjs-dist`; фолбэк для символов вне сабсета в AC не
заявлен и веткой не тестируется отдельно, но и не заявлен как отсутствующий
риск — это чисто текстовая неточность ТЗ, не отсутствие защиты в коде.

Серьёзность: Low — расхождение документации и факта без порчи вывода. Не
требую правки кода; вопрос — снять формулировку ТЗ или оставить как есть.
**Снимаю с записью**: поведение (видимый placeholder вместо пустого
прямоугольника) безопаснее описанного в ТЗ и не нарушает ни один AC;
исправление текста ТЗ увеличивало бы объём этого раунда без изменения кода
— решение за автором на будущее, не блокирует.

## Таблица AC — доказательство и «чем краснеет»

| AC | Доказательство | Чем краснеет |
|---|---|---|
| AC1 (кнопка/_canEdit/диалог) | `demo/smoke_pdf_export.mjs` (`clickPrinter`, `dialogHasConditionalOptions`) + чтение `src/houseplan-card.ts` (кнопка внутри `this._norm && this._canEdit`, между `settings-button` и `support-button`) | smoke: клик по несуществующей кнопке — таймаут `waitForFunction` |
| AC2 (галочка подложки условна; persist) | smoke: `dialogHasConditionalOptions`, `optionsPersistAcrossReload` (reload реальной страницы, не переоткрытие того же элемента) | смок красный при рассинхроне `expectedCount` или `rememberedNames` |
| AC3 (скачивание, один A4) | smoke: `oneA4Page`, `downloadNameIsStable`; unit `pdf-scene.test.mjs` («chooses one A4 orientation and a standard scale») | unit сравнивает `595.2755905511812` — любое отклонение размера листа красит тест |
| AC4 (геометрия §7.1, общая стена один раз, без устройств) | unit `pdf-scene.test.mjs` («shared wall … emitted once and devices never enter»​) + мутант `pdf-shared-wall-twice`, `pdf-devices-leak` | **прогнано мной**: оба мутанта «поймано 1 из 1» |
| AC5 (внутренние размеры, не исчезают) | unit `pdf-scene.test.mjs` («dense non-rectangular rooms…», реконструкция контура из `stableDimensionEdges`) + мутант `pdf-room-edge-dropped` | **прогнано мной**: «поймано 1 из 1» |
| AC6 (внешние размеры) | unit `pdf-dimensions.test.mjs` («external dimension normal…») + мутант `pdf-outer-face-inside` | **прогнано мной**: «поймано 1 из 1» |
| AC7 (галочки реально управляют содержимым) | unit `pdf-scene.test.mjs» («respects names/dimensions switches», «dimensions switch removes…», «decor toggle…», «backdrop … disappears with its option») + мутант `pdf-dimensions-ignore-toggle` | **прогнано мной**: «поймано 1 из 1» |
| AC8 (кириллица извлекается) | unit `pdf-writer.test.mjs` — реальный парсинг `pdfjs-dist`, `getTextContent()` находит «Кухня» | мутант `pdf-font-no-tounicode` — **прогнано мной**: «поймано 1 из 1» |
| AC9 (подвал: масштаб/линейка/север/легенда) | unit `pdf-dimensions.test.mjs` (`choosePdfScale` в стандартном ряду) + мутант `pdf-scale-not-standard`; линейка/легенда — проверено чтением `pdf-scene.ts:489-533` | **прогнано мной** для масштаба: «поймано 1 из 1» |
| AC10 (детерминизм) | unit `pdf-writer.test.mjs`: `writePdf(page)` дважды, `assert.deepEqual` байтов | смена любого входа (дата, опция) даёт другой поток — проверено чтением: `CreationDate` строится из `page.now`, координаты округляются `fmt` |
| AC11 (ленивость, бюджет, отказ чанка, чужая сборка) | `bundle-budget.mjs` требует непустой `lazyPdfFiles` и отсутствие пересечения с initial; `test/bundle-assets.test.mjs` (обновлён); smoke `pdfChunkAbsentBeforeIntent`, `onePdfChunkRequest`, `failedChunkRetriesOnceAndKeepsView` | `test/bundle-assets.test.mjs` красит пересечение графов; smoke красит повторный запрос чанка не 2 раза |
| AC12 (Android) | не доказано автотестом — по ТЗ ручная проверка владельцем до закрытия, зафиксировано как открытый риск в хендоффе | — |
| AC13 (подложка, лимит 25 МБ) | unit `pdf-raster.test.mjs` (граница `MAX_PDF_RASTER_BYTES`) + smoke `rasterLimitRejectsBeforePdfWrite` + мутант `pdf-backdrop-over-geometry` (слой поверх геометрии) | **прогнано мной**: «поймано 1 из 1»; unit: `assert.throws` на лимит+1 байт |
| AC14 (модальность после reconnect) | smoke `dialogRecoversAfterReconnect` — тот же сценарий, что `smoke_dialog_modal_recovery`, применённый к `hp-pdf-dialog` | смок красит потерю центрирования/`:modal` после переподключения |
| AC15 (9 свидетелей «1 из 1») | `scripts/mutation-gate.mjs --check` + `--id=<mutant>` по каждому | **прогнано мной все 9** — сведено в строки выше |

## Что проверено и корректно

- **Единый источник числа (§8 PROCESS.md).** Площадь и внутренний контур
  комнаты в PDF читаются через `resolveRoomArea`/`resolveInnerContour`,
  которые в `houseplan-card.ts:10691-10712` вызывают **те же** `_cleanFloor` и
  `_innerRoomContour`/`_wallUnionGeometry`, что и видимая карточка комнаты
  (`_cleanFloor` используется на строке 12545 для той же цели) — проверено
  чтением обоих мест вызова. Расхождения «превью PDF ≠ карточка» не может
  возникнуть в рамках этой архитектуры.
- **Изоляция от устройств/состояний.** В `pdf-scene.ts` нет ни одного чтения
  `config.markers`/состояний HA; единственная точка, где маркер мог бы
  попасть на лист, закрыта мутантом `pdf-devices-leak` и красит тест.
- **Безопасность текста в PDF.** Текст комнаты/декора попадает в поток PDF
  только как hex-код глифов (`<${encoded.hex}> Tj`), не как сырая строка —
  инъекция в синтаксис PDF через имя комнаты/декора невозможна (нет случая,
  где пользовательская строка конкатенируется в `(...)`-литерал потока).
- **Скачивание подложки** — тот же `credentials: 'same-origin'` и
  `_display()`-путь подписанного доступа, что у экрана; отказ (`pdf.asset_failed`)
  останавливает экспорт до записи файла — соответствует ТЗ §7.6 «лист без
  обещанной подложки молча — хуже, чем честный отказ».
  Проверено чтением `pdf-export.ts:17-64`.
- **Ленивая граница.** `_pdfRuntimeLoader` в `houseplan-card.ts` — точная
  копия контракта `EditorRuntimeLoader`, использованного `iso-scene-render`
  (exact-build fingerprint, ретрай с nonce, терминальный отказ); manifest/budget
  скрипты требуют непустой `lazyPdfFiles` и отсутствие пересечения с initial —
  проверено чтением `scripts/bundle-manifest.mjs`, `scripts/bundle-budget.mjs`
  и обновлённых `test/bundle-assets.test.mjs`.
- **Трейлеры и changelog.** Все 20 коммитов диапазона несут `Issue: #53` и
  ровно один `User-Visible: yes|no`; единственный `User-Visible: yes`
  (`d277eeb7`) правит `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в том же
  коммите. Коммиты, трогающие `demo/golden/baselines/**`, несут
  `Release:`+`Baseline-Reviewed:` со ссылками на реальные прогоны CI —
  проверено `git show -s --format=%b` по каждому из 20 коммитов.
- **`docs/SCOPE.md`.** Узкое исключение для #53 записано текстом (закрывает
  Medium-находку №1 из SPEC-REVIEW-53-r1) и совпадает по формулировке с ТЗ §7.
- **Регресс из-за новой кнопки в шапке** (`fix: keep editor header geometry
  stable`, `fix: preserve projection geometry with PDF action`) — оба
  коммита адресные: сдвиг брейкпоинта `.head .count` (900px→1100px под более
  тесную шапку) и вынос точки скрытия из `620px` в отдельное правило;
  геометрия плана (не шапки) не меняется — проверено чтением обоих диффов.
  Этим объясняется широкий список пересобранных golden-эталонов (любой кадр
  с шапкой карточки); каждый принят с `Baseline-Reviewed`-ссылкой.
- **Лицензия шрифта.** `assets/fonts/LICENSE` — полный текст Apache 2.0,
  путь совпадает с указанным в ТЗ и `PDF-EXPORT.md`.
- **Мутационные свидетели §13/AC15** — все 9 прогнаны мной лично в этом
  раунде (`--check` даёт чистый прогон, `--id=<mutant>` даёт «поймано 1 из 1»
  для каждого); это «чистые юниты» в терминах §2.7 (защита в
  `src/pdf/pdf-scene.ts`/`pdf-dimensions.ts`/`pdf-writer.ts`, проверяется
  `test/pdf-scene.test.mjs`/`pdf-dimensions.test.mjs`/`pdf-writer.test.mjs` —
  не смок/бэкенд/golden), поэтому по правилу «для чистых юнитов достаточно
  прогона со снятой защитой, приведённого в документе» этого прогона
  достаточно и я не обязан требовать дополнительного golden/смок-свидетеля.

## Чего не проверял

- **AC12** (скачивание в мобильном приложении HA на Android) — не доказано
  автотестом ни автором, ни мной; по ТЗ это ручная проверка владельца до
  закрытия issue. Не блокирует код-ревью: AC12 явно размечен методом
  доказательства «вручную владельцем», а не автотестом (`docs/specs/053-pdf-export.md`
  §12).
- **Golden-кадр `pdf-export-geometry-light` визуально мной не пересматривался
  пиксель-в-пиксель** — принят автором через `npm run golden:accept -- --reviewed`
  по полному Linux CI артефакту (ссылка на прогон в хендоффе и трейлеры
  `Release:`/`Baseline-Reviewed:` коммита `6562d482`), что и является
  каноническим способом приёмки по PROCESS.md §13; я проверил чтением, что
  `demo/golden/run.mjs` реально рендерит PDF через `pdfjs-dist` в canvas (не
  берёт скриншот экрана) и что golden-сцена подключена в `demo/golden/matrix.mjs`.
- **Полный набор `demo/smoke_*.mjs`** — не прогонялся; выбор ограничен тремя
  смоками, названными в хендоффе (`pdf_export`, `isometric_contract`,
  `room_link`) плюс `smoke-links.mjs`, который регистрирует символы задачи
  за `smoke_pdf_export.mjs` — не вызывал `scripts/smoke-select.mjs` отдельно,
  так как диффом не затронута ни одна другая смок-поверхность (никаких
  изменений вне `src/pdf/**`, `src/houseplan-card.ts` (кнопка/лоадер),
  `src/styles/dialogs.styles.ts` (брейкпоинт)).
- **`npm run model-invariants`** — не прогонялся; обоснование в таблице гейтов
  выше (геометрическая модель не тронута).
- **Ручной просмотр итогового PDF в Acrobat/Preview** (§16 риск таблицы ТЗ) —
  не выполнялся; заменён более сильной автоматической проверкой —
  парсингом `pdfjs-dist` в трёх независимых unit/smoke/golden контекстах,
  что и есть механическое доказательство «открывается стандартным ридером».

## Материал раунда

- Ветка: `issue/53-pdf-export`
- Дерево материала: `git rev-parse HEAD` на момент вывода = `6562d4820492fc8223099ecc060ea479c52411fb`
- Диапазон: `origin/dev..HEAD` (merge-base `afbee9d328e9159cc69934ffa7a3c795c0320eed`)
- Полный Validate: https://github.com/Matysh/houseplan-card/actions/runs/34075522192
- Документационные кадры: https://github.com/Matysh/houseplan-card/actions/runs/34075005646
- Golden: https://github.com/Matysh/houseplan-card/actions/runs/34075026829

## Вердикт

Зелёный. High: 0. Medium: 0. Low: 1 (снята с записью, без правки кода).
Задача полностью реализует ТЗ #53 и закрывает все автоматически доказуемые
AC; AC12 корректно оставлен ручной проверке владельца по контракту ТЗ.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/53-pdf-export`, коммит `6562d4820492` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `1db7839f17586fa2cf7ad9e1aea009377c31fbff`
  ```
  git log --all --format='%H %T' | grep 1db7839f1758
  ```
