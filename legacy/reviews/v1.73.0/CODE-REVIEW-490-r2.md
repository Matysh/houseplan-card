# CODE-REVIEW-490-r2

- **Issue:** #490 — Атомарный recovery и live-состояние сводной панели
- **Этап:** code (PROCESS.md §2.7)
- **Заход:** r2 · блокирующих циклов израсходовано 1 из 4
- **SHA материала:** `01c653a4c660e47d62c1f4bcb879b634ea09800d` (рабочая копия)
- **ТЗ:** `docs/specs/490-summary-recovery-live-state.md`, ревью ТЗ зелёное на `95a34f73`
- **Диапазон:** `git diff origin/dev...HEAD` (58 файлов), продуктовый код:
  `src/summary-panel-runtime-loaded.ts`, `src/summary-panel-host.ts`, `src/summary-panel.ts`,
  `src/houseplan-card.ts` (2 строки), `demo/smoke_summary_panel.mjs`, `scripts/smoke-links.mjs`,
  тесты `test/summary-panel.test.mjs`, `test/render-device-snapshot.test.mjs`, changelog×2,
  dist/бандлы.

## Почему разбор полный, а не по дельте r1→r2

Автор перебазировал ветку на ушедший вперёд `dev` (`origin/dev` = `24c1b723`, инфраструктурный
коммит про review-controller/доки, продуктового кода не касается). SHA реализации r1
(`c6e6660d483c9297fc5fa86e9f9b5a7ad82a85a5`), названный в вердикте r1 и в самом документе
`docs/reviews/CODE-REVIEW-490-r1.md` («ребейз его осиротит, и это нормально»), в этом дереве
не резолвится (`git cat-file` → `Not a valid commit name`). Это прямо описанный в инструкции
случай «ребейз на ушедший вперёд dev — после ребейза это другой код» (§7.2), поэтому ниже —
полный разбор AC1–AC6, а не только чтение диффа фикса M1. По факту `dev` продвинулся только
инфраструктурно (`.github/workflows/process.yml`, `AGENTS.md`, `PROCESS.md`, `docs/SCOPE.md`,
`docs/STATUS.md`, `docs/TESTING.md`) — конфликтов с продуктовым кодом #490 нет, поэтому большая
часть выводов совпадает с r1, но получена самостоятельным повторным прогоном, а не унаследована
на слово.

## Скоуп

Задача устраняет F1 (lost-ACK recovery принимал только `rev`, но старый `candidate`) и F2
(entity-источники сводной панели не входили в render dependency set). r1 нашёл единственную
находку M1 (Medium, в скоупе): recovery-адаптация вызывала общий `_adoptStructuralResponses`
напрямую, минуя asset-readiness gate (`_signer.prepareImage`) и continuity-overlay
(`_beginContinuityCandidate`), которые есть во всех остальных вызывающих того же seam. Эта
ревизия проверяет, закрыто ли M1, и заново проверяет AC1–AC6 целиком.

## Как проверялось

Зелёного Validate на `01c653a4` нет, поэтому дешёвые гейты прогнал сам:

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | green, без ошибок |
| `npm test` | green — 2282 pass, 0 fail, 1 skip (Node 22.23.2, Linux) |
| `npm run build` + `node scripts/bundle-sync.mjs` | green; `git status --porcelain` пуст — три копии бандла (`dist/`, `custom_components/houseplan/frontend`, `demo/srv/assets`) совпадают с закоммиченными |
| `node scripts/check-docs.mjs` | ERROR «screenshot source fingerprint is stale... (#479)» — тот же известный, помеченный самим инструментом долг, что и в r1; не регрессия этой задачи (отпечаток считается по всему `src/**`, любая фронтенд-правка делает его устаревшим) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 25 «прямых совпадений», 58 «слабых связей»; вывод приложен ниже |
| `node demo/smoke_summary_panel.mjs` | green — включает новый сценарий `recoveryPreparesBackdropBeforeAdoption` |
| `node demo/smoke_render_invalidation.mjs`, `smoke_device_position_history.mjs`, `smoke_danger_confirmation.mjs` | green (прямые совпадения по `entityIds`/`_adoptStructuralResponses`, уже прогонялись в r1, перепрогнаны) |
| `node demo/smoke_space_card_bg.mjs`, `smoke_sign_cap.mjs` | green — новые прямые совпадения по `_signer`, символ именно из фикса M1, в r1 не прогонялись |
| `node demo/smoke_version_recovery.mjs` | green — прямое совпадение по `_signer`/`_cfgContentFingerprint`/`_cfgRev`, концептуально ближайший к теме recovery смок |
| `node demo/smoke_nav_persist.mjs` | green — прямое совпадение по `_resumePendingNavMode`, который фикс M1 добавил в recovery-ветку |
| `node demo/smoke_linked_virtual_light.mjs` | green — прямое совпадение по `_continuity` |
| `npm run invariants` | не запускал — diff не трогает рёбра/толщину/`layout`/`marker.space`/`open_spans` |
| `python -m pytest tests_backend` | не запускал — `custom_components/**/*.py` не в diff (только сгенерированный фронтенд-бандл) |
| `npm run golden:verify`, performance-профили | не запускал — diff не меняет геометрию/раскладку/стили, только логику recovery и текстовые значения существующего блока; это предрелизный гейт (PROCESS.md §8) |

`smoke-select` (42 символа на изменённых строках, порог «широкого» — 46 смоков, матрица 232):
из 25 прямых совпадений прогнал те, что относятся к реально изменённым символам этого раунда
(`_signer.prepareImage`-гейт, `_continuity`, `_beginContinuityCandidate`, `_resumePendingNavMode`,
`entityIds`, `_adoptStructuralResponses`) — 9 смоков выше. Остальные 16 прямых совпадений
(`_cfgRev`, `_model`, `_maybeRebuildDevices`, `_cfgContentFingerprint`, `SpaceModel` и т.д.)
относятся к функциям, чьи тела в этом диффе не менялись (только новый вызывающий в
`saveDialog()`), уже покрыты `tsc`+`npm test`+`build` и были обоснованно пропущены ещё в r1 —
причина не изменилась. 58 «слабых связей» (одно распространённое имя) не прогонял.

### Проверка дисциплины «тест умеет падать» для нового ассерта

Смок `demo/smoke_summary_panel.mjs` теперь мокает `card._signer.prepareImage` и
`card._adoptStructuralResponses`, чтобы записать порядок вызовов при конкурентной замене
`spaces[0].plan_url`, и проверяет `recoveryPreparesBackdropBeforeAdoption`. Чтобы убедиться, что
это не тавтология, временно откатил гейт (убрал вызов `prepareImage`/условие `configChanged`
перед `_adoptStructuralResponses` в `saveDialog()`), пересобрал (`npm run build` +
`bundle-sync`) и перезапустил смок:

```
FAILED (1):
  - recoveryPreparesBackdropBeforeAdoption: expected true, got false
```

Затем восстановил файл из бэкапа, пересобрал и подтвердил чистое дерево (`git status
--porcelain` пуст) и зелёный смок. Тест умеет падать именно на том поле, которое доказывает M1.

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| **M1** (Medium, в скоупе) — recovery-adoption вызывал `_adoptStructuralResponses` напрямую, минуя `_signer.prepareImage()`-гейт и `_beginContinuityCandidate()`; конкурентная правка `bg.href`/`plan_url` могла на кадр показать пустой фон вместо удержания старого | `src/summary-panel-runtime-loaded.ts:443-455`: перед `_adoptStructuralResponses` теперь вычисляется `configChanged` (тот же `contentFingerprint`-компаратор, что в `_loadFromServer`/`_reloadConfigOnly`), при изменении конфига вызывается `this.host._signer.prepareImage(...)`, при неготовом asset — `_continuity.note('asset-failed')` + `_scheduleLoadRetry(true)` + `throw writeError` (adoption не выполняется), при готовом — условный `_beginContinuityCandidate('summary-recovery', true)` и только затем `_adoptStructuralResponses`; следом добавлен `_resumePendingNavMode()`, отсутствовавший в r1 | Строки кода выше; `demo/smoke_summary_panel.mjs` — сценарий `recovery` подменяет `plan_url` на `concurrentBackdrop` при синтетическом lost-ACK и мокает `prepareImage`/`_adoptStructuralResponses`, чтобы записать порядок вызовов (`recoveryOrder`); ассерт `recoveryPreparesBackdropBeforeAdoption` требует `prepare:<href>` раньше `adopt`. Проверено самостоятельным прогоном (green) и подтверждено способностью падать (см. выше) |

Соответствие порядку операций трём существующим вызывающим (`_loadFromServer`,
`_reloadConfigOnly`) проверено построчным сравнением (см. `src/houseplan-card.ts:4296-4325` и
`:4486-4506`): та же последовательность `configChanged → prepareImage-гейт →
[beginContinuityCandidate] → adoptStructuralResponses → syncDecorAssets → adoptInitialSpace →
resumePendingNavMode → cacheSnapshot → restoreZoom → regSignature reset →
maybeRebuildDevices`. Новый путь recovery воспроизводит этот же порядок вместо собственного
обходного варианта, что и требовало ТЗ §6.2.

Единственное отличие от `_loadFromServer`: там `_regSignature`/`_maybeRebuildDevices()`
выполняются в `finally` (в том числе при раннем `return` на asset-failed), а в recovery-ветке —
только на успешном пути (`recovered = true`), потому что asset-failed здесь пробрасывает
исходную `writeError` наружу как обычную ошибку записи (диалог остаётся открытым с ошибкой, а
не молча продолжает). Фоновый `_scheduleLoadRetry(true)` в этом случае в итоге доведёт adoption
до конца через штатный `_loadFromServer`/`_reloadConfigOnly`, который сам сделает эти сбросы.
Не нахожу здесь нового дефекта — это не обход правил continuity, а откладывание adoption до
готовности, ровно как требует ТЗ.

## Унаследовано из r1

Поскольку ребейз формально осиротил материал r1, я не унаследовал выводы «на слово» — весь
код и все AC перепроверены заново в этом раунде (таблица гейтов и находка M1 выше — результат
самостоятельного прогона на `01c653a4`, а не копия r1). Без повторной проверки принято только
продуктовое/процессное, что дельта не затрагивает и не может затронуть технически:

- Оценка S2 (пользовательская/девелоперская ценность 9/10, риск 8/10, приоритет P1, полный
  трек, дубликаты/связи с #437 и #493) и зелёное ревью ТЗ на `95a34f73` — issue-комментарии,
  не код; дельта реализации их не задевает.
- Формулировка AC1–AC6 и границы «Не входит» из ТЗ §5 — сам текст ТЗ не менялся в этом раунде.

Документ r1: `docs/reviews/CODE-REVIEW-490-r1.md` (в дереве, коммит `87f19941`).

## Что проверено и корректно (AC1–AC6, полный повторный разбор)

- **AC1/AC2 (атомарный lost-ACK recovery и следующая запись).**
  `confirmedSummaryPanelWriteRecovery` (`src/summary-panel.ts`) требует одновременно полный
  `ServerConfig` (`Array.isArray(config.spaces)`), safe-integer неотрицательный `rev`, точное
  совпадение сохранённой `summary_panel` с draft (`sameSummaryPanel`). При выполнении — весь
  `authoritative` документ и `rev` уходят через общий `_adoptStructuralResponses`, ничего не
  собирается вручную. Юнит (`test/summary-panel.test.mjs`, 1 позитивный + 7 негативных случаев)
  и смок (`recoveryAdoptsWholeConfig`, `recoveryAdoptsRevision`, `nextWriteUsesRecoveredRevision`,
  `nextWritePreservesConcurrentChange`) — прогнаны самостоятельно, green. Ассерты сверяют
  конкретные строки (`'Concurrent title kept'`) и revision-арифметику (`writes[0].expected_rev +
  2`), а не факт отсутствия исключения.
- **AC3 (настоящий конфликт).** Ветка `catch { throw writeError; }` — любой сбой чтения или
  отказ `confirmedSummaryPanelWriteRecovery` откатывается к исходной ошибке, диалог не
  закрывается. Смок `trueConflictStaysOpen` (принудительный `rejectConflict`) — green,
  подтверждает, что предыдущая сохранённая версия осталась в `_serverCfg`.
- **AC4/AC5 (live-источники и fast path).** `summaryPanelEntityIds()` — чистая функция без
  чтения `hass`/мутации конфига, схлопывает дубликаты, режется по `runnableSummaryPanel` (только
  v1), игнорирует локальную видимость/scope (ТЗ §7.1 дословно). В `houseplan-card.ts:4623`
  результат добавлен в тот же `entityIds` render-snapshot набор построчным `for`, второго
  listener/timer не создано (перечитал файл на предмет альтернативных подписок — не нашёл).
  Live-переходы value → unavailable → recovered → missing → present и инвариантность
  geometry/epoch/layoutRev проверены смоком (`liveState`) — green, включая
  `unrelatedTickSkipped: true`, `relevantTickRenderedOnce: true`, `stateTicksKeepGeometry: true`.
  `_capturedSnapshotSequence = -1` в `connectedCallback` (`houseplan-card.ts:2613`) инвалидирует
  кеш снапшота именно в момент ленивой загрузки рантайма — без этого свежепоявившиеся
  `entityIds()` не попали бы в snapshot до следующего изменения `hass`; проверено чтением.
- **AC6 (совместимость).** Диф не трогает EN/RU/DE/FR словари, не меняет схему/API, не
  добавляет сетевых запросов в steady state (`config/get` — тот же вызов, что и раньше, с другим
  следствием). `test/render-device-snapshot.test.mjs` подтверждает, что `_summary?.entityIds()`
  вошёл именно в существующую сборку снапшота.
- **Трейлеры и changelog.** `Issue: #490` на всех пяти коммитах диапазона; `User-Visible: yes`
  на обоих fix-коммитах (`a43bc3eb`, `01c653a4`); `docs/CHANGELOG.md`+`docs/CHANGELOG.ru.md`
  правлены в тех же коммитах, а не отдельно — проверено `git show --stat` на каждом.
  Формулировка changelog-записи в `01c653a4` («while keeping the current plan backdrop visible
  until a concurrent replacement is ready» / «текущая подложка остаётся видимой, пока
  параллельно заменённая подложка не готова») точно описывает закрытие M1, а не только
  исходные F1/F2.
- **Единственный источник числа.** Значение summary-only сущности показывается только в одной
  строке сводной панели; диф не вводит второе место того же значения. `test/single-source-
  numbers.test.mjs` прошёл в общем `npm test`.

## Что не проверял

- Полный `npm run golden:verify` и performance-профили — diff не меняет геометрию/раскладку/
  стили, только логику recovery и текстовые значения существующего блока; предрелизный гейт
  (PROCESS.md §8), непропорционален этой правке.
- `npm run invariants` — diff не трогает рёбра/толщину/`layout`/`marker.space`/`open_spans`.
- `python -m pytest tests_backend` — `custom_components/**/*.py` не в diff.
- Полную матрицу `demo/smoke_*.mjs` (232 файла) — прогнал 9 прямых совпадений на реально
  изменённых символах этого раунда (`_signer`, `_continuity`, `_resumePendingNavMode`,
  `entityIds`, `_adoptStructuralResponses`) плюс сам целевой `smoke_summary_panel.mjs`; остальные
  16 прямых и все 58 «слабых» совпадений относятся к функциям, чьи тела не менялись (только
  новый вызывающий), и уже покрыты `tsc`+`npm test`+`build`.
- Живое ручное тестирование в браузере HA — недоступно в этом цикле; вывод построен на
  автотестах (включая целевой откат-и-проверку смока выше) и чтении кода.
- Behaviour ветки `configChanged && !prepareImage` (asset-failed) для самого recovery-пути не
  воспроизведён смоком отдельно (только через ручной откат гейта выше, который доказывает
  обратное — что гейт есть и работает); полноценный «asset действительно не готов» сценарий для
  recovery повторяет уже покрытый тремя другими вызывающими путь и не является новым риском.

## Вердикт

Зелёный: M1 закрыт способом, который ТЗ §6.2 и требовал (тот же общий гейт/порядок, что у трёх
остальных вызывающих `_adoptStructuralResponses`, без собственного обходного варианта). Новых
находок нет. AC1–AC6 подтверждены самостоятельным повторным прогоном тестов (юнит + смок), а не
унаследованы из r1 на слово — обоснование в разделе «Унаследовано из r1» выше.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/490-summary-recovery-live-state`, коммит `01c653a4c660` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `3cf0250fc745fd6fe94f7f344f2aa3beb5ddd682`
  ```
  git log --all --format='%H %T' | grep 3cf0250fc745
  ```
- ТЗ `docs/specs/490-summary-recovery-live-state.md`, блоб `d4bfd4ea63f1b2ce1cb255b2764fe14d25661df7`
  ```
  git log --all --find-object=d4bfd4ea63f1b2ce1cb255b2764fe14d25661df7 -- docs/specs/490-summary-recovery-live-state.md
  ```
- Вердикт конвейера: `green` · High 0
