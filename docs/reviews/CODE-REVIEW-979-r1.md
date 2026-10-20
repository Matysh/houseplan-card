# CODE-REVIEW-979-r1

Материал: `e987ea901492e20333b2f1252f0c98e76fbcf52f` (ветка `issue/979-activity-preview-polish`,
2 коммита над `origin/dev` — `d3c775fad`, `e987ea901`). Трек: `show`. Заход r1,
блокирующих циклов израсходовано 0/2.

## Скоуп

Issue #979 — полировка настройки «Источник состояния значка» из #977/#978 и
компоновки встроенного превью устройства. Три AC, сформулированные
владельцем непосредственно в теле issue:

- **AC1** — один select источника без поиска (в т.ч. при >8 сущностях);
  «Активно при» — ровно два режима «Автоматически»/«Задать вручную»; штатный
  `hp-help` у названия поля с объяснением семантики Auto (тип/класс + пример
  свет/автоматизация) и Manual (точное сравнение); один текстовый input без
  крестика/кнопки добавления/постоянного hint; невалидное значение остаётся
  видимым с ошибкой и не сохраняется; Auto удаляет только явное условие; смена
  сущности возвращает Auto.
- **AC2** — превью: full-width изображение, затем все сведения и объяснение
  причины; высота ограничена и подобрана визуально, не растёт пропорционально
  ширине; длинные названия/entity_id без горизонтального overflow; крупные
  эффекты не обрезаются, доступен scroll.
- **AC3** — изменены только ввод/компоновка; own-device authority, явная
  неизвестность, приоритет тревог/protected, обычный Save/Cancel/Glow и формат
  `state_source` (singleton `active_states`) не меняются; без миграции/legacy
  UI; RU/EN/DE/FR согласованы.

Работа закрывает J1/J6 (`docs/SCOPE.md`): понятная настройка индикации и
чтение результата в уже существующем редакторе устройства; View/киоск не
затронуты.

Это уже второй хендофф на этот раунд: первый материал (`d3c775fad`, preview
192px) автор сам отозвал до модели, обнаружив, что каноническая docs-сцена
`device-display-preview` не помещается целиком (611px превью при 609px
скроллера) — уменьшил до 184px и добавил регрессию на этой fixture. Отозванный
материал не получал модельного вердикта, поэтому это не отдельный раунд.

## Как проверялось

Validate на материале `e987ea901` зелёный
(https://github.com/Matysh/houseplan-card/actions/runs/39515818184) —
`tsc --noEmit`, `npm test`, `npm run build` + сверка бандла этим прогоном
подтверждены, повторно не гонялись.

Я независимо прогнал то, что Validate не покрывает и что требуют AC
(браузерные смоки) плюс быстрые адресные гейты:

| Гейт | Команда | Результат |
|---|---|---|
| Адресные unit | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/marker-state-source-form.test.mjs test/marker-state-source.test.mjs test/dialog-baseline.test.mjs` | 35/35 PASS (совпадает с хендоффом) |
| Смок AC1/AC2 (назван в AC) | `node demo/smoke_marker_state_source.mjs` (после `npm run build && node scripts/bundle-sync.mjs`) | 32/32 PASS — ownOnly, autoFirst, noSearchWithManyEntities, twoClearModes, autoHelpExplains, helpEscKeepsForm, singleManualField, emptyManualRejected, reservedManualRejected, exactMatch/exactNonmatch, removedCurrentStateHint, previewFullWidthAboveFacts, readableLayout{1280,720}×{en,ru}, defaultPreviewFitsDocumentationViewport и др. — все true |
| Смок AC2 (badge/preview parity) | `node demo/smoke_device_preview_parity.mjs` | 33/33 PASS, включая `badgeBounds` при rippleSize=8 |
| `smoke-select` прямые совпадения | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` → `demo/smoke_cover_tap.mjs`, `demo/smoke_kiosk_cycle_context.mjs` | оба PASS |
| process-gate | `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | PASS, 0 предупреждений |
| Бюджеты | `node scripts/ratchets.mjs report` | все метрики в полосе, 0 превышений; `bundleBytes 3285676` совпадает с заявленным |

Рабочее дерево после прогона возвращено `npm run bundle:clean`; сгенерированные
скриншоты в `demo/out/` остаются untracked.

### Чего не проверял

- Не гонял `npm run gate:small` целиком (409с в хендоффе) и 54 «слабые связи»
  `smoke-select` — для CSS/разметки одного диалога и i18n-строк это
  несоразмерный объём; ни одна из них не содержит прямого совпадения с
  изменёнными символами, а два прямых совпадения я проверил сам.
- Контекстная проверка `hp-help` реальным Playwright-тапом (`hasTouch=true`),
  упомянутая автором как дополнительная ручная проверка, не воспроизводилась —
  скрипта в репозитории нет, а сам компонент `hp-help` в этом диффе не менялся
  (переиспользуется как есть в `general-settings-dialog.ts`,
  `radar-section.ts`), так что регрессии тач-поведения эта задача не создаёт.
- `golden:verify`, `pytest tests_backend`, `npm run invariants` — не
  запрашивались AC и не относятся к правке (нет Python, нет геометрии/плана).
- Полный предрелизный CI точного кандидата — остаётся обязанностью перед
  бетой, не гейтом ревью.

## Находки

Находок нет — ни High, ни Medium, ни Low.

## Что проверено и корректно

- **AC1.** `src/editors/marker-state-source.ts`: поиск и поле `stateSourceFilter`
  убраны целиком (включая `MARKER_DIALOG_TRANSIENT_KEYS`, `MarkerStateSourceDraft`,
  `HouseplanEditorHostPort['_markerDialog']`, `houseplan-card.ts`) — `grep` по
  репозиторию не нашёл висячих ссылок на старые ключи/поле. Select режима —
  ровно `standard`/`states` с текстами «Автоматически»/«Задать вручную»; `hp-help`
  у поля «Активно при» с текстом, явно называющим тип/класс/состояние и пример
  свет=работа vs автоматизация=разрешение (en/ru/de/fr идентичны по смыслу).
  Manual — один `<input>` без кнопок/постоянного hint, `aria-label` задан.
  Невалидность (пустая строка, `unknown`/`unavailable`, CR/LF, >255 символов)
  решается уже существующим, не тронутым в этом диффе `normalizeMarkerStateSource` +
  `markerStateSourceFields` (возвращает `{}` при touched+invalid — сохранение не
  происходит, старое значение не перезаписывается); это поведение было принято в
  ревью #977/#978 и здесь не меняется — подтверждено чтением и смоком
  (`emptyManualRejected`, `reservedManualRejected`). Смена сущности
  (`#marker-state-source` change) и переключение в `standard` одинаково удаляют
  только `active_states`, не весь объект — подтверждено новым unit-тестом
  `#979 automatic clears only the condition...` и смоком.
- **AC2.** `hp-device-preview.ts`: `.previewgrid` — один столбец,
  `.previewstage` — фиксированная высота 184px (`overflow:auto` сохранён),
  `.previewfacts`/`.previewsource` — одна колонка на всю ширину вместо двух
  тесных. Регрессия на канонической docs-сцене `device-display-preview`
  (`defaultPreviewFitsDocumentationViewport`) добавлена после авторского
  самостоятельного отзыва первого материала — проверено исполнением, PASS.
  `readableLayout*` проверяет `b`-элементы >250px шириной и отсутствие
  horizontal-overflow на RU/EN 1280/720, light/dark. `badgeBounds`
  (`smoke_device_preview_parity.mjs`) подтверждает, что крупный эффект
  (rippleSize=8) не обрезается.
- **AC3.** Diff не трогает `marker-state-source.ts` (резолвер/ownership/нормализация
  не изменились, кроме удаления неиспользуемого поля `stateSourceFilter` из
  типа драфта) и не трогает backend/semantic schema. RU/EN/DE/FR обновлены
  согласованно (сверены построчно) — raw-ключей не осталось. Трейлеры `Issue:
  #979`/`User-Visible: yes` на обоих коммитах; оба изменяют `docs/CHANGELOG.md`
  и `docs/CHANGELOG.ru.md` в том же коммите. `docs/release-ledger/v1.81.0/979.json`
  классифицирует как `line-fix`, `introducedBy: 977`, без milestone — корректно:
  функция не существовала в stable v1.81.0, это внутри-бетное исправление
  текущей 1.82-линии. `docs/USER-GUIDE.ru.md`/`.md`, `ARCHITECTURE.md`,
  `DEVICE-PRESENTATION.md`, `DEVELOPMENT.md`, `STATUS.md` обновлены с той же
  терминологией, что и UI («Автоматически»/«Задать вручную»).
- **Защитная таблица AC·доказано·краснеет** в хендоффе заполнена по всем трём
  AC без пустого третьего столбца — соответствует требованию §2.7. Отрицательные
  случаи (пустая/зарезервированная строка, foreign/disabled без чтения состояния)
  — обычные negative-input на неизменённой реализации, мутанты не исполнялись
  (это прямо и честно указано автором).
- **Риск по изменённым участкам (#707), класс `ux`** (новые ключи
  `marker.state_source_manual`, `marker.state_source_mode_help`,
  `marker.state_source_mode_help.aria` в de/en/fr/ru): поведение зафиксировано
  непосредственно AC1 тела issue #979 (два режима, обязательный `hp-help` с
  описанной семантикой) и отражено в `docs/USER-GUIDE.ru.md`/`USER-GUIDE.md` —
  критерий `undocumented` §5 пройден, UI-контракт не новый, а описанный тем же
  AC (`ux-contract` пройден). Компонент `hp-help` и хелпер `field({help})`
  переиспользованы без изменений (`form-kit.ts` в диффе отсутствует) — не новый
  примитив. Остальные критерии §5: `complexity` (владелец оценил 3/10),
  `surfaces` (одна форма/один preview одного диалога), `migration` (схема/бэкенд
  не меняются, явно подтверждено release-ledger), `perf-touch` (нет
  polling/подписок, тач — лучшее усилие как и раньше) — пройдены. Переклассификация
  не требуется.
- Числа, видимые пользователю, не дублируются из двух источников: высота
  превью задаётся один раз в CSS (`184px`), `STATE_SOURCE_MAX_LENGTH`/строка
  подсказки «до 255 символов» — не новая связка этого диффа (текст был
  хардкодом и до #979, изменился только счёт состояний 1–32→1, без второго
  числового источника).

## Вердикт

Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 → в задаче

Маршрут: `fix` (переклассификация не требуется — все критерии §5 пройдены,
см. раздел выше).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/979-activity-preview-polish`, коммит `e987ea901492` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `d9a51a56b3faee51548127e72fccabecd015d61b`
  ```
  git log --all --format='%H %T' | grep d9a51a56b3fa
  ```
- Тело issue: `4d750b38ffba46daf08c7b8616705b1551ff530f96062754d4e5fe405a2cab9b`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUzNTksIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1NDQ5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMTgsIm91dHB1dF90b2tlbnMiOjMxNzI5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE1NDY4OCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjY1MDIyOTMsImNvc3RVc2RFc3RpbWF0ZSI6Mi4yMzY3MzY2MDAwMDAwMDF9XSwidHVybnMiOjY4LCJkdXJhdGlvbk1zIjo1MzEwODgsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoyLjI0MjE4NTYwMDAwMDAwMDQsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5477 output_tokens=31747 cache_creation_input_tokens=154688 cache_read_input_tokens=6502293 num_turns=68 -->
