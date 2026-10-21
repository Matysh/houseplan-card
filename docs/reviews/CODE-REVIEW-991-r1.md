# CODE-REVIEW-991-r1

Issue: #991 · Этап: code · Трек: show · Заход: r1 · блокирующих циклов использовано 0 из 2
Материал: `6c1742489784ee7697c5589152fafd8a25a60dd8` (рабочая копия на нём на всём протяжении ревью)
Побочные находки: `mode=issues` (снимок `HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`) — отдельные issue, если найдутся вне скоупа. Внутри скоупа побочных находок нет.

## Скоуп

Уточнение #977/#979/#989: поиск по сущностям внутри раскрытого списка «Источник
состояния значка» (настройки устройства → «Отображение на плане»), без
возврата отдельного поля поиска в закрытой форме. Переиспользует общий
`sourcePicker`/`sourcePickerOverlay` из #989 (Escape закрывает только панель).
Job по `docs/SCOPE.md`: J6 «Keep the plan true as the home evolves» —
редакторская эргономика существующего поля, не новая функция.

Изменённые файлы по диапазону `origin/dev..HEAD` (4 коммита):
`src/editors/marker-state-source.ts`, `src/editors/marker-dialog.ts`,
`src/editors/marker-form-state.ts`, `src/houseplan-card.ts`,
`src/houseplan-editor-runtime.ts`; тесты
`test/marker-state-source-form.test.mjs`, `test/dialog-baseline.test.mjs`,
`demo/smoke_marker_state_source.mjs`; документация ARCHITECTURE/DEVICE-
PRESENTATION/DEVELOPMENT/USER-GUIDE(ru)/CHANGELOG(ru)/STATUS/release-ledger;
генерируемое — `demo/golden/baselines/*`, `scripts/monolith-baseline.json`,
`scripts/mutation-registry.mjs` (три новых registry-определения),
`docs/testing-notes/mutation-browser-guards.md` (инвентарь).

## Риск по изменённым участкам (#707)

- **perf** — `src/editors/marker-state-source.ts:42`, токен `filter:`.
  Отфильтровываемый массив — `rows`, построенный из
  `markerStateSourceCandidates(d.binding, registry)` (резолвер не менялся,
  `docs/DEVICE-PRESENTATION.md` «Manual ordinary state source (#977)»): это
  уже существовавший ограниченный список собственных сущностей устройства,
  тот же, что раньше перечислял `<select>`. Фильтр — тривиальный
  `includes()` по этому же короткому массиву на каждый кейстрок, без обращения
  к полному реестру/состояниям HA. Тело issue прямо фиксирует
  «Миграция/backend/.../**performance**/View/touch-контракт: нет» — это
  авторское решение по объёму, а не вывод из User-Visible. Критерий
  `perf-touch` пройден документом+кодом → `route: fix`, а не `reclassify`.
  Остальные критерии §5 (`complexity` ≤3 — локальная правка одного поля;
  `surfaces` — один диалог; `migration` — нет persisted-полей, новые
  `stateSourceOpen/stateSourceFilter` транзиентны и не сериализуются;
  `ux-contract` — расширение уже принятого паттерна `sourcePicker` из #989,
  переиспользуются существующие переводы `opening.search_ph`/
  `marker.nothing_found`; `undocumented` — поведение зафиксировано ниже в
  `docs/DEVICE-PRESENTATION.md`, `docs/ARCHITECTURE.md`, `docs/USER-GUIDE(.ru).md`)
  тоже пройдены.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | чисто, без ошибок |
| Unit/pure | `npm test` (= `tsc -p tsconfig.test.json && fix-test-build && node --test test/*.test.mjs`) | `tests 5502 · pass 5501 · fail 0 · skipped 1` (пропуск — `#281 private fixture is not present`, окружение, не в этой задаче; предыдущий прогон той же команды дал transient `fail 1` без дальнейшего воспроизведения — повторный чистый прогон зафиксирован как итоговый) |
| Build + бандл | `npm run build` → `node scripts/bundle-policy.mjs --verify` | сборка создана (60 ассетов), «свежая сборка dist цела»; закоммиченная копия не сверяется на этом этапе (#657) — она подтверждена отдельным owner-approved коммитом `6c17424` с точным байтовым числом |
| `npm run bundle:sync` + адресные browser smoke (Chromium headless-shell 151.0.7922.34, пин совпал) | `node demo/smoke_marker_state_source.mjs` | **OK**, все 47 проверок true, включая `searchInsidePanel`, `ownOnly`, `autoFirst`, `filterNameCaseInsensitive`, `filterIdCaseInsensitive`, `noMatchStillAuto`, `clearRestoresOwn`, `escapeClosesOnlyPicker`, `searchDoesNotDirty`, `sameSourceKeepsManual`, `cancelSelectionPreservesSaved`, `foreignIdStaysSelected`, `disabledHintHasNoState` |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | — | прямое совпадение (3): `smoke_marker_state_source.mjs` (назван в AC), `smoke_cover_tap.mjs`, `smoke_kiosk_cycle_context.mjs` — оба прогнаны |
| `node demo/smoke_cover_tap.mjs` | | **OK**, все 30 проверок true |
| `node demo/smoke_kiosk_cycle_context.mjs` | | **OK** |
| Регистрация мутантов (статика, не caught) | `node scripts/mutation-gate.mjs --check` | readiness ok, три новых id (`state-source-search-ignores-query-991`, `state-source-search-dirties-draft-991`, `state-source-picker-escape-does-not-close-991`) зарегистрированы и попадают в `definitions=1735`; **не исполнялись** — ночь единственный источник caught-свидетельства (#709/#905) |
| golden | не перезапускал `golden:verify` | baseline уже приняты выделенным коммитом `cb77d771d` с `Baseline-Reviewed: <CI run 39559218220>` и `Release:` трейлером — ровно 3 сцены из 189 витнесов, что совпадает с текстом коммита («два source-form сцены + Auto в mobile color-popover»); пересчитывать нет смысла — материал и окружение не менялись с акцепта |
| инварианты геометрии | не прогонял | дифф не трогает геометрию/ссылки на неё |
| `pytest tests_backend` | не прогонял | дифф не трогает Python |
| performance harness | не прогонял | не назван в AC, тело issue явно исключает performance |

Рабочее дерево после сборки восстановлено (`git checkout -- dist/` +
`git clean -fd dist/ demo/out/`); `git status` чист, `HEAD` остаётся
`6c1742489784ee7697c5589152fafd8a25a60dd8`.

## AC → доказательство

| AC | Доказано | Чем | Чем краснеет (защитная часть) |
|---|---|---|---|
| AC1 компактная форма и поиск | да | `test/marker-state-source-form.test.mjs` (`#991 search is inside...`, выполнен, PASS) + `demo/smoke_marker_state_source.mjs` (`initialClosedNoSearch`, `searchInsidePanel`, `filterNameCaseInsensitive`, `filterIdCaseInsensitive`, `noMatchStillAuto`, `clearRestoresOwn`, light/dark×RU/EN на 1280/720 и narrow 360 в двух сочетаниях языка/темы) | mutant `state-source-search-ignores-query-991` (зарегистрирован, не исполнялся, ночь); обычный граничный случай 255-символьного несовпадающего запроса выполнен и прошёл (PASS) |
| AC2 только UI-состояние | да | `MARKER_DIALOG_TRANSIENT_KEYS` включает `stateSourceOpen/stateSourceFilter`, подтверждено `test/dialog-baseline.test.mjs` (`#631`, PASS); смока `searchDoesNotDirty`, `escapeClosesOnlyPicker`, `cancelSelectionPreservesSaved`, `sameSourceKeepsManual` — все true | mutant `state-source-search-dirties-draft-991` (зарегистрирован, не исполнялся) на «пустой третий столбец» закрыт: третий столбец не пуст. Escape — mutant `state-source-picker-escape-does-not-close-991` (зарегистрирован, не исполнялся — DOM/overlay-регистрация недоступна чистым шаблонам, обоснованно смоук-only) |
| AC3 сохранность семантики и границ | да | резолвер (`src/marker-state-source.ts`) не тронут диффом; `markerStateSourceCandidates` вызывается без изменений. `test/marker-state-source-form.test.mjs` (`#991 protected faces neither open the picker nor read own source states` — getter-trap, бросает при обращении к состоянию; PASS подтверждает отсутствие чтения). Смока `ownOnly`, `foreignIdStaysSelected`, `foreignHintHasNoState`, `disabledHintHasNoState`, `foreignCancelPreservesBlock` — true | getter-trap сам по себе — выполненный отрицательный свидетель (бросил бы исключение при регрессии); отдельного mutant id не требуется, третий столбец не пуст |

Все три AC доказаны исполнением (не только чтением); «проверено чтением, не
исполнением» потребовалось только для утверждения «резолвер не изменился» —
подтверждено прямым диффом (`src/marker-state-source.ts` отсутствует в списке
изменённых файлов).

## Трейлеры, ledger, одно число — один источник

- `b7008d0b8` несёт `Issue: #991` + `User-Visible: yes` и в этом же коммите
  правит оба `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` — условие выполнено.
- `cb77d771d` — class D (golden), несёт `Release: v1.82.0-beta.6` +
  `Baseline-Reviewed: <CI run>` — условие выполнено.
- `6c1742489` — class D (bundle base), `User-Visible: no`, owner-approved
  агрегатный бандл по чату; подтверждает фиксированное число
  `scripts/monolith-baseline.json.bundleBytes = 3287997`, тот же байт
  фигурирует в тексте коммита — один источник, число не разъезжается.
- `docs/release-ledger/v1.81.0/991.json`: `category: line-fix`,
  `introducedBy: 977`, обоснование — функция #977 не существовала в
  stable v1.81.0, поэтому уточнение остаётся вне пользовательского milestone
  1.82 (совпадает с `docs/STATUS.md` «The next accounting cycle is 1.82
  against stable v1.81.0»). Классификация авторская, согласуется с каноном.

## Находки

Нет High. Нет Medium в скоупе. Нет Medium вне скоупа — новый issue не заводился.

Low (не блокирует, не открывает цикл на `track:show`): новый guard в
`src/editors/marker-dialog.ts` (`change: (next) => { if (this.host._markerDialog === d) ... }`)
защищает конкретно от «delayed overlay callback» (`sourcePickerOverlay`
регистрирует document-level слушатель для outside-click/Escape, который может
сработать после того, как `_markerDialog` уже заменён чем-то другим — это и
документировано в `docs/ARCHITECTURE.md`: «The owner checks draft identity
before accepting delayed overlay callbacks»). Поведение задокументировано и
не воспроизводит дефекта — все обычные сценарии (ввод, выбор, Escape,
Cancel/Save, переоткрытие) прошли смоук зелёным, т.к. в них `d === host.
_markerDialog` совпадает в момент события. Но именно гонку (несовпадение в
момент колбэка) отдельный тест не воспроизводит — есть только статическая
документация намерения. Это учётный разрыв, не наблюдаемый пользователем
дефект поведения, поэтому по правилам трека `show` остаётся Low и не образует
цикла.

## Что проверено и корректно

- Поиск фильтрует только собственные/допустимые сущности устройства, без
  обращения к состояниям чужих/отключённых сущностей (getter-trap тест).
- Auto всегда доступен и не теряется ни при каком запросе, включая длинный
  несовпадающий.
- Открытие/фильтр/закрытие не делают черновик dirty и не трогают
  `stateSource`/`stateSourceTouched`; Cancel откатывает выбор, Save сохраняет.
- Повторный выбор уже выбранной сущности не сбрасывает «Активно при» и future-
  ключи сохранённого блока (getter-trap + juxtaposed unit).
- Virtual/protected лица оставляют picker отключённым, без построения списка
  строк и без открытия панели.
- Переводы переиспользованы (`opening.search_ph`, `marker.nothing_found`) во
  всех четырёх языках — проверено по `src/i18n/{en,ru,de,fr}.json`.
- `src/marker-state-source.ts` (резолвер) и модель данных не изменены —
  подтверждено диффом.
- Golden: ровно 3 сцены из 189 изменились и приняты отдельным
  Baseline-Reviewed коммитом, совпадает с ожидаемым визуальным следом правки
  (две source-form сцены + Auto-строка в mobile ripple-color popover).
- Бандл-гейт прошёл; закоммиченный байт-бюджет подтверждён отдельным
  owner-approved коммитом с тем же числом в тексте и в `monolith-baseline.json`.

## Чего не проверял и почему

- Полный golden-прогон (`golden:verify`) — уже принят адресным коммитом на
  точном SHA CI-прогона; материал/окружение с тех пор не менялись.
- `pytest tests_backend`, инварианты геометрии, performance harness — вне
  диффа и вне AC (ТЗ явно исключает performance/geometry/backend).
- 49 «слабых» совпадений из `smoke-select` (общий символ `_markerDialog` —
  почти все смоки, открывающие диалог устройства) — не прогонял: это
  обычный шумовой сигнал от повсеместного поля хоста, ни один не касается
  `sourcePicker`/`stateSource` по содержимому файла (проверено `grep` по
  тройке тематически ближайших — `smoke_esc_dialogs`, `smoke_dialog_zombie`,
  `smoke_warm_dialogs` — совпадений с `state_source`/`sourcePicker` нет).
- Исполнение зарегистрированных мутантов — запрещено вне ночного workflow
  (#905); ограничился статической readiness (`mutation-gate.mjs --check`).
- Адверсарная гонка «delayed overlay callback после замены `_markerDialog`»
  (Low-находка выше) — не воспроизводил намеренным race-тестом; это
  потребовало бы патча исполняемой копии ради провоцирования гонки, что
  запрещено политикой негативных проверок вне ночного ранa.
- Ручная dev/GPU-приёмка владельцем — не требуется и не является находкой
  (#929).

## Вердикт

Все три AC выполнены и доказаны исполнением; типы, тесты, сборка и адресные
смоки зелёные на точном материале `6c1742489`; трейлеры, ledger и changelog
корректны; единственный флагованный риск (`perf`) закрыт документом+кодом и
остаётся на треке `show` без повышения.

Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 → в задаче

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/991-icon-source-search`, коммит `6c1742489784` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `5ceafdfd7e4b0a585b9c97663b3845f297bccd59`
  ```
  git log --all --format='%H %T' | grep 5ceafdfd7e4b
  ```
- Тело issue: `b5f26182b9a936386709ca8ab8b4d8364efe62a940117e83652ee62c0bd4f92b`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUwNTMsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTUzMDAwMDAwMDAwMDAwNX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTMwLCJvdXRwdXRfdG9rZW5zIjozNDYzNSwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxNzc2NzAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo5MzMwNTg0LCJjb3N0VXNkRXN0aW1hdGUiOjIuOTIzNDA2OH1dLCJ0dXJucyI6NzIsImR1cmF0aW9uTXMiOjg5MTgwNCwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjIuOTI4NTU5OCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5183 output_tokens=34655 cache_creation_input_tokens=177670 cache_read_input_tokens=9330584 num_turns=72 -->
