# CODE-REVIEW-252-r2

Вердикт: зелёный · заход r2 · блокирующих циклов 0/4 · High: 0 · Medium: 0

## Скоуп раунда и почему разбор полный, а не по дельте

Между CODE-REVIEW-252-r1 (зелёный, на поведенческом коммите `8fd8ccb`,
ветка ещё не ребейзнута) и этим раундом ветка была перебазирована на
`origin/dev` (комментарий автора 2026-08-23T07:33:24Z: `git rebase
origin/dev`, новая база `6d0fa3b`). Это прямо попадает под критерий
«ребейз на ушедший вперёд dev — после ребейза это другой код» (§7.2
инструкции ревью), поэтому разбор в этом раунде — полный: весь диапазон
`git log --oneline origin/dev..HEAD` и `git diff origin/dev...HEAD` на
текущем `HEAD = b58136a`, а не только диф от r1.

Дополнительно проверено: `origin/dev` за время ревью успел уйти ещё на
2 коммита вперёд самой ветки (`6d0fa3b..origin/dev` → `2d1fca1`,
`a952f5f`). Разобран коммит `a952f5f` («feat(api): let config/get and
layout/get return less», issue #256, `User-Visible: no`) — он трогает
`custom_components/houseplan/{projection.py,websocket_api.py}` и
`tests_backend/test_projection.py`, не пересекается по файлам с #252 и
по контракту строго аддитивен (отсутствие новых параметров = байт-в-байт
старый ответ). Слияние #252 в `dev` потребует технического ребейза на
`2d1fca1`, но это не меняет оценку текущего диффа.

Состав диффа `origin/dev...HEAD` (34 файла): `src/space-reference-repair.ts`,
`src/plan-optimizer.ts`, `src/houseplan-card.ts`, `src/styles.ts`, RU/EN
i18n, `scripts/mutation-gate.mjs`, unit-тесты, `demo/smoke_orphan_space_
references.mjs`, `demo/golden/{harness,matrix}.mjs` + 2 golden-сцены,
канонические доки (`CANVAS.md`, `CONFIG-COMPATIBILITY.md`, `ARCHITECTURE.md`,
`TESTING.md`, `USER-GUIDE.{md,ru.md}`), оба changelog, синхронные копии
бандла (`dist/`, `custom_components/.../frontend/`), `docs/specs/252-*.md`
и три ревью-документа предыдущих раундов.

## Закрытие раунда r1 (CODE-REVIEW-252-r1)

| Находка r1 | Чем закрыта | Где видно |
|---|---|---|
| Low, снято с записью на будущее: мёртвый ключ `gs.optimize_reference_warning` остался в `en.json`/`ru.json`, код его больше не вызывает | Ключ полностью удалён из обоих словарей коммитом `6c779b5` | `git diff origin/dev...HEAD -- src/i18n/en.json src/i18n/ru.json` — строка с ключом присутствует только как удаление (`-`); `test/i18n.test.mjs:77` `assert.doesNotMatch(cardSource, /this\._t\('gs\.optimize_reference_warning'/)` — прогнан в составе `npm test`, зелёный |

Отдельное процессное наблюдение, не находка к этому коду: сам вердикт
r1 называет только «поведенческий коммит `8fd8ccb`», не итоговый SHA
ветки на момент ревью (тогда это было `df51542`, что следует из
комментария автора о трёх коммитах `8fd8ccb`/`668ed49`/`df51542`).
Инструкция ревью прямо требует называть SHA, на котором получен
вердикт — здесь он не назван. Это не изменяет оценку текущего кода
(в этом раунде разбор полный и не зависит от того, что именно проверял
r1), фиксирую для гигиены пайплайна.

## Унаследовано из r1

Поскольку разбор в этом раунде полный (см. «Скоуп» выше), формально
наследовать нечего — весь код перечитан заново без опоры на выводы r1.
Единственное, что действительно взято без повторной проверки в деталях
— зелёный вердикт SPEC-REVIEW-252-r2 (одобренное ТЗ, коммит спеки не
менялся с r1 кода): нормативные разделы §6–7 спеки использованы как
эталон при сверке кода в этом раунде, само содержание спеки не
пересматривалось.

## Как проверялось

Прочитан целиком и построчно: `src/space-reference-repair.ts` (весь
файл, 369 строк), `src/plan-optimizer.ts` (изменённый фрагмент),
`src/houseplan-card.ts` (весь изменённый фрагмент — `_optimizeReference
Context`, `_previewAlignDialog`, `_toggleOptimizeLivePositions`, рендер
диалога), `src/styles.ts`, оба i18n-файла целиком по добавленным ключам,
`scripts/mutation-gate.mjs` (весь диф + не тронутые соседние мутанты),
`demo/smoke_orphan_space_references.mjs` целиком, `demo/golden/{harness,
matrix}.mjs`, `test/space-reference-repair.test.mjs` целиком (11 тестов),
`test/plan-optimizer.test.mjs`, `test/i18n.test.mjs`, `test/golden-matrix.
test.mjs`, канонические доки (`CANVAS.md`, `CONFIG-COMPATIBILITY.md`,
`ARCHITECTURE.md`, `TESTING.md`, `USER-GUIDE.md`, `USER-GUIDE.ru.md`),
оба changelog, `docs/specs/252-optimize-orphan-layout-report.md` целиком.

Лично прогнано на текущем `HEAD` (`b58136a`), не со слов автора:

- `npx tsc --noEmit` → чисто, без вывода;
- `npm test` → 1140/1140 pass, 0 fail, 0 skipped;
- `npm run build` → зелёно; `sha256sum dist/houseplan-card.js
  custom_components/houseplan/frontend/houseplan-card.js` — совпадают
  побайтово (`e5389ba8...`), обе копии синхронны;
- `node scripts/check-docs.mjs` → «Documentation checks passed (7 files,
  10 external links)» — обязателен, диф трогает `src/**`;
- `node scripts/mutation-gate.mjs --check` → все патчи, включая новые
  `orphan-cleanup-partial-registry-deletes` и `orphan-cleanup-proven-
  owners-kept`, ложатся на текущий код ровно один раз (реестр не
  расходится с кодом); полный дорогой прогон (пересборка бандла на
  мутанта) не повторялся — это предрелизный гейт, автор уже прогнал его
  целиком (136/136) на этом же дереве, а `--check` подтверждает, что с
  тех пор код под патчами не менялся;
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` →
  прямое совпадение, те же 6 смоков, что называл автор:
  `smoke_orphan_space_references`, `smoke_grid_snap`,
  `smoke_optimize_coordinate_canonicalization`,
  `smoke_optimize_geometry_preflight`, `smoke_optimize_micro_interval`,
  `smoke_warm_dialogs`. После `npm run bundle:sync` (стенд-копия не
  коммитится, #255) все 6 лично прогнаны и зелёные, все поля результата
  `true`;
- `node demo/golden/run.mjs --mode=verify` (полный набор, 97 сценариев,
  не только targeted) → 97/97 `passed`, включая обе #252-сцены
  `optimize-orphan-references-dark-en` и `optimize-orphan-references-
  light-ru`. Прогнан полностью, а не только targeted, потому что диф
  меняет видимый рендер диалога (новые секции, кнопка, `<details>`) и
  это первый полный прогон именно на этом (постребейзном) дереве в этом
  ревью — независимая проверка, а не повтор доверия к словам автора.

Не прогонял отдельно: `npm run invariants -- --config <файл>` в виде
CLI на внешнем экспорте — конкретного экспорта живой инсталляции для
этой ветки нет. Вместо этого проверено, что `test/model-invariants.
test.mjs` (тест «все модели, которые возит с собой проект, инварианты
не нарушают (#254)») входит в `npm test` и гоняет ровно `checkReferences`
— инвариант, чей докстринг в `scripts/model-invariants.mjs` прямо
называет #252 («37 забытых позиций в layout») как один из дефектов,
которые он проверяет — на всех fixture-моделях проекта и на
`demo/srv/demo.html`; тест прошёл в составе прогнанного `npm test`.
Точечный CLI-прогон нужен для проверки конкретной конфигурации, а не
кода — здесь её нет.

Не прогонял: `python -m pytest tests_backend -q` (диф не трогает
`custom_components/**/*.py`), браузерное ручное тестирование (заменено
headless smoke + полным golden), performance-профили (не названы в
AC8 для этого цикла, `src/space-reference-repair.ts` — maintenance-only
путь, не render loop, что явно оговорено в спеке §12).

## Находки

Нет находок уровня High или Medium.

Low, не блокирует, не требует отдельного цикла:

- `SpaceReferenceReport.deadSpaceIds` (`src/space-reference-repair.ts:361`)
  вычисляется (проход по layout, сборка `Set`, сортировка) и покрыт
  тестами, но с этого раунда нигде не читается в продуктовом коде —
  `grep -rn "deadSpaceIds" src/` вне `space-reference-repair.ts` пуст.
  Раньше это поле питало `gs.optimize_reference_warning`
  (`visibleDeadIds`/`remainingDeadIds` в `houseplan-card.ts`); теперь его
  функцию полностью взял на себя `referenceDetails` (собран из
  `removedPositions`/`liveMissingPositions`/`unverifiedPositions`).
  Поведения не меняет и данные не портит — чистая мёртвая работа
  внутри чистой функции. На усмотрение автора: убрать поле или оставить
  как совместимый API отчёта.

## Что проверено и корректно (в этом раунде, полным чтением)

- **Классификация владельца (AC1–AC3).** Три исхода (`absent`/`live`/
  `unverified`) в едином проходе по `layout`
  (`src/space-reference-repair.ts:302-360`) построены доказательно:
  `rl_`-подписи проверяются по `existingRoomIds` (детерминировано из
  config, авторитетность реестра не нужна); явный marker — по
  `activeMarkers`/`removedMarkers` (`removed:true` — доказанное
  удаление, живой активный marker — `live`, независимо от реестра);
  `lg_<entity>` и авто-устройство (через персистентный, монотонно
  накапливающий историю `settings.known_devices` — проверено, что
  `diffNewDevices` в `src/logic.ts:2017-2025` НИКОГДА не выбрасывает
  старые id, только добавляет новые, то есть однажды увиденное
  устройство остаётся «известным» и после исчезновения — это и делает
  классификацию «доказанно отсутствует» возможной для реальных
  installation-сценариев из issue) требуют `rosterAuthoritative` для
  перехода в `absent`; неизвестный namespace — всегда `unverified`,
  без исключений. Юнит-тесты `test/space-reference-repair.test.mjs:225-346`
  проверяют все три исхода по каждой категории, идемпотентность
  второго прохода и fail-closed при `authoritative:false` и при
  полностью неизвестном ключе (`future_widget:one`) даже при
  авторитетном реестре — соответствует риску спеки «Future owner
  удалён как мусор → Unknown namespace всегда unverified».
- **Живой владелец в удалённом пространстве, opt-in (AC2, §7.2).**
  `_toggleOptimizeLivePositions` пересобирает preview через
  `_previewAlignDialog(!prev)`, ничего не пишет (проверено смоком
  `explicitCleanupRebuildsPreviewWithoutWriting`: `calls.length === 0`
  после тоггла). Кнопка — настоящий `<button>` с `aria-pressed`,
  `min-height: 44px` (`src/styles.ts` `.optimize-cleanup`) — touch target
  соблюдён. Текст переключается «будут сохранены» / «выбраны для
  удаления» без противоречия (это и есть предмет коммита `df51542`,
  перепроверено смоком `!selectedText.includes('They will be kept.')`).
- **Осознанное расширение поведения detach (важно для регресса #244).**
  До #252 `repairSpaceReferences` при Area-remap/detach активного
  маркера БЕЗ подтверждённого назначения сразу удаляла его layout-
  позицию целиком (см. `docs/specs/244-orphan-space-references.md:194-197`,
  подтверждено историческим `docs/reviews/CODE-REVIEW-244-r3.md`). В
  этом диффе эта немедленная автоматическая точка удаления убрана —
  такая позиция теперь попадает в общий проход классификации и, будучи
  позицией живого активного маркера, становится `live-in-missing-space`
  (сохраняется по умолчанию, требует явного opt-in). Я расценил это как
  сознательное расширение, а не регресс/недосмотр: поведение прямо
  протестировано и НАЗВАНО как таковое (`test('issue 252 detaches a live
  marker but preserves its stale coordinates until explicit cleanup')`,
  `test('issue 252 Area remap never transplants or silently deletes old
  coordinates')` — переименованы и переписаны из старых #244-тестов,
  которые раньше проверяли обратное), и задокументировано в обоих
  канонических местах именно как замена старого правила: `docs/CANVAS.md`
  («It may delete an unattached layout entry only after classifying its
  owner…») и `docs/CONFIG-COMPATIBILITY.md` («Without a valid target it
  removes the marker's missing placement but preserves its old position
  for the owner-aware cleanup decision») — обе фразы буквально описывают
  именно это изменение, а не более старую формулировку с «and stale
  position». Риск, который #244 закрывала этим правилом («старые
  координаты попадают на чужой план, если тот же id позже переиспользован»),
  явно не выше нуля, но он теперь ограничен временным окном до explicit
  opt-in вместо немедленного стирания — компромисс сделан осознанно
  и виден пользователю (позиция называется по имени и предлагается к
  удалению), а не тихо. Отдельного мутационного гейта на «Area-remap не
  транспланирует координаты» больше нет, потому что сам код-путь,
  который мог бы это сделать, удалён вместе со специальным случаем —
  проверено чтением: единственное место, где `layout[markerId].s`
  переписывается в маркерном проходе, — ветка `exact &&
  positionSpace === storedSpace && targetSpace`, которая для Area/detach
  (`exact === false`) никогда не выполняется.
- **Отчёт без внутренних id в основном тексте (AC4).** RU/EN строки
  `gs.optimize_orphans_removed`, `gs.optimize_live_positions(_remove)`,
  `gs.optimize_unverified`, `gs.optimize_vacuum_warning` не содержат
  `id`/`layout`/`owner`/raw-идентификаторов — проверено чтением
  `src/i18n/{en,ru}.json` и утверждено `test/i18n.test.mjs:66-84`
  регуляркой по обоим языкам. Технические id — только в `gs.
  optimize_detail_item` внутри `<details class="optimize-details">`
  (закрыт по умолчанию, нативный `<summary>`, `focus-visible` outline).
  Vacuum-mappings — отдельная строка `gs.optimize_vacuum_warning`, не
  смешана со счётчиком позиций.
- **Preview/Cancel/Apply/Undo/идемпотентность (AC5, AC6).** `changed`-
  гейтинг в `plan-optimizer.ts:572-582` обнуляет только счётчики
  фактически персистентных изменений (включая три новых
  `orphan*Removed` и `liveMissingPositionsRemoved`), не трогая массивы
  `removedPositions/liveMissingPositions/unverifiedPositions` (они
  информационны и не подразумевают запись сами по себе) — прочитано и
  проверено логически: `removedPositions` непустой невозможен при
  `changed === false`, так как удаление всегда меняет `layout`.
  Атомарность Apply/Undo и повторный no-op проверены смоком:
  `applyUsesExactAtomicEndpoint`, `undoRestoresDeadRefs` (восстанавливает
  и авто-, и opt-in-удалённые записи), `remainingOnlyWarningHasNoApply`.
- **Golden/семантика диалога (AC7).** Обе #252-сцены (`dark-en`,
  `light-ru`) в `demo/golden/matrix.mjs` покрывают live+removed+unverified
  одновременно; `demo/golden/harness.mjs` содержит машинную проверку
  состава отчёта до скриншота. Полный `golden:verify` (97/97) прогнан
  лично на текущем HEAD, а не принят со слов.
- **Release-артефакты (§13).** `User-Visible: yes` коммит `da719f5`
  содержит поведенческий код, оба changelog, все канонические доки и
  синхронные копии бандла одновременно — проверено `git show --stat
  da719f5`, а не по отдельным более поздним коммитам.

## Итог

AC1–AC8 подтверждены сочетанием юнит-тестов (доказательно падающих на
переименованных/новых мутантах mutation-gate), одного полного и одного
целевого браузерного прогона и построчного чтения. Единственное
самостоятельно найденное расхождение с прежним поведением (потеря
немедленного авто-удаления stale-позиции при detach) оказалось
сознательным, протестированным и задокументированным расширением
контракта, а не побочным регрессом — после сверки с #244 и историческим
код-ревью #244 отдельной находки по нему не завожу. Новых issue не
требуется.
