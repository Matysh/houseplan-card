# CODE-REVIEW-86-r5

- **Issue:** #86 — Тексты подсказок к настройкам: очередь и правила (Party 1)
- **Заход:** r5 · блокирующих циклов израсходовано 3 из 4
- **Материал:** `git log --oneline origin/dev..HEAD`, `git diff origin/dev...HEAD`
- **HEAD:** `fa146fb1` · **origin/dev:** `2b0ac0c0` (включает #44, merge-base == origin/dev)
- **Спецификация:** `docs/specs/086-settings-help-content-party1.md` (актуализирована 2026-08-30, коммит `20883c31` до ребейза)

## Почему разбор снова полный, а не по дельте

После зелёного вердикта r4 (на `7408f8af`) `dev` продвинулся на 5 коммитов —
слияние #44 «discovery filters become visible, explained and previewable»
(`d14cf769..2b0ac0c0`, включая собственный цикл ревью #44 с фиксами
M1‑M2). Ветка `issue/86-settings-help-party1` перебазирована на этот новый
`dev`. Все SHA из документов r1–r4 (`7408f8af`, `96bd3e3e`, `18ab3779` и т.д.)
более не существуют в истории (`git cat-file -t` → `fatal: Not a valid object
name` для каждого) — это не косметика, а другое дерево (PROCESS.md §2.10/§7.2).
Это ровно случай, для которого прямо предписан полный разбор.

Важное обстоятельство: `git merge-base HEAD origin/dev == origin/dev`, то есть
диапазон `origin/dev...HEAD` — это **весь** вклад ветки #86 целиком (в dev уже
влит #44, в ветке сверх него — только #86). Это даёт полный и единственный
источник правды для разбора, без необходимости реконструировать историю по
кускам.

Дополнительная проверка ребейза: #44 и #86 модифицируют одни и те же файлы
(`src/houseplan-editor-runtime.ts`, `src/i18n/{en,ru,de,fr}.json`,
`src/styles/dialogs.styles.ts`, `docs/images/screenshots.json`,
`docs/CHANGELOG*.md`). Список конфликтов, зафиксированный в issue перед
финальным ребейзом, содержал только сгенерированные бандлы и changelog —
никаких конфликтов в `src/**`/`i18n/**`. Прочитал итоговый diff этих файлов:
изменения #86 (add `_help(...)` triggers, новые `.help`/`.help.aria` ключи)
корректно легли поверх кода #44 (`_renderDiscoveryFilters`, новые i18n-ключи
дискавери) без потерь с обеих сторон — рекомбинация чистая.

## Что проверялось и как

### Гейты, прогнанные лично на `fa146fb1`

| Гейт | Результат |
| --- | --- |
| `npx tsc --noEmit` | зелёный, без ошибок |
| `npm test` | 1615 тестов, 1614 pass, 0 fail, 1 skip (тот же приватный `#281`-скип, что и в r1–r4) |
| `npm run build` + `git status --porcelain` после build | 0 diff — закоммиченный `dist/` побайтово совпадает со свежей сборкой |
| `node scripts/bundle-sync.mjs` | 0 diff в `custom_components/houseplan/frontend` и `demo/srv/assets` — три канонические копии синхронны |
| `node scripts/bundle-budget.mjs` | initial View 280 678 B / 300 000 B бюджета, headroom 19 322 B — в норме |
| `node scripts/no-new-any.mjs` | «Новых any нет» (119 добавленных строк в 3 файлах) |
| `node scripts/check-docs.mjs --external` | «Documentation checks passed (7 files, 10 external links)» — фингерпринт скриншотов не протух, sha256 каждого PNG совпадает с манифестом (тот самый канал, что в r1 поймал H1 — здесь чисто) |
| `node scripts/mutation-gate.mjs --id=settings-help-party1-placement-removed` | мутант поймал `test/i18n.test.mjs` — «покраснел, как обязан» |
| `npm run golden:verify` | 147/147 `passed`, 0 different/missing (полный лог сохранён) |
| 13/13 smoke «прямого совпадения» из `smoke-select.mjs` | все `OK`, все party1-флаги в `smoke_help_affordance.mjs` — `true` |

Почему прогнал сам, а не принял «Validate зелёный» на веру: разобрался в
устройстве последнего прогона (run 33310161342, `headSha=fa146fb1`) —
job «Классификация изменённых файлов» сравнивал только `04da7eb1..fa146fb1`
(3 файла `docs/images/**`), потому что предыдущий push (`04da7eb1`, реальный
ребилд бандла) получил **cancelled** прогон (run 33310044199, перекрыт
следующим push тремя минутами позже), а не зелёный. В итоге `frontend`,
`golden`, `smoke`, `backend` в финальном прогоне — не «переиспользованы по
хешу» (шаг reuse-маркеров явно вернул `Cache not found` по всем четырём), а
**skipped** классификацией. То есть ни один реальный CI-прогон после
финального ребейза не исполнил тяжёлые гейты по-настоящему. Заявление
«Validate на `fa146fb1` зелёный ⇒ дешёвые гейты подтверждены» из вводных
раунда не подтвердилось при проверке — пришлось прогонять самому. Отдельно
завёл **#387** (infra, P2, вне скоупа #86) с точным описанием механизма и
предложением чинки; на вердикт #86 не влияет, так как содержимое проверено
мной исполнением напрямую и оказалось корректным.

### Не прогонял и почему

- **18 «слабых связей» смоков** (`smoke-select.mjs`, общий символ `_config`) —
  контент партии 1 не менялся с r3, риск для этих смоков уже признавался
  низким в r2/r3/r4; не нашёл оснований пересматривать.
- **`python -m pytest tests_backend`** — diff не касается ни одного `.py`
  файла (`git diff origin/dev...HEAD --stat` не содержит `custom_components/**/*.py`).
- **`npm run invariants`** / модельные инварианты — diff не трогает геометрию,
  `layout`, `marker.space`, `open_spans`, толщину стен; ТЗ §11 прямо фиксирует
  «Config, backend, layout и storage не меняются», подтверждено чтением diff
  (только шаблоны рендера и i18n).
- **`performance_smoke`** — ни ТЗ, ни diff не касаются путей, чувствительных
  к перфу (чисто DOM/CSS-триггеры уже существующего `hp-help` из #68).
- Полный `demo/smoke_*.mjs` набор (206 файлов) — не запускал целиком;
  `smoke-select.mjs` даёт 13 прямых совпадений (все прогнаны) и не находит
  оснований для более широкого прогона.

### Одно число — один источник

Diff не добавляет и не меняет ни одной пользовательской величины (числа,
единицы, отображаемые значения) — только текстовые подсказки и разметку
(`id=`/`<label for=>`, `helpfieldlabel`, обёртки). Единственное число,
фигурирующее в контенте — «3.6 м» радиуса свечения на golden-скриншотах —
это существующее значение конфигурации, отображаемое ровно один раз (в самом
поле), подсказка его не дублирует и не пересчитывает. Проверка
`test/single-source-numbers.test.mjs` входит в зелёный `npm test`.

## AC — построчно

1. **AC1 (инвентарь 11 placements).** Прочитал diff
   `src/houseplan-editor-runtime.ts`/`houseplan-onboarding-runtime.ts`: 10
   новых вызовов `this._help('*.help')` (`space.cell_cm`, `gs.glow_radius`,
   `space.fill_mode`, `marker.controls`, `gs.north`, `space.north`,
   `gs.bg_mode`, `space.bg_mode`, `space.zero_wall_style`,
   `device_inbox.show_hidden`) + 1 существующий пилот `marker.light_role.help`
   (текст обновлён, trigger не дублирован) = 11. Ровно совпадает с таблицей
   §6 ТЗ. Тест `test/i18n.test.mjs` («issue 86 Party 1 has the exact help
   inventory…») проверяет тот же список и `assert.equal(..., 11)` — зелёный.
2. **AC2 (канонический контент).** Сверил построчно все 11 RU/EN пар из diff
   `en.json`/`ru.json` с таблицей §6 ТЗ — совпадают дословно. DE/FR передают
   тот же смысл (проверил выборочно `de.json`/`fr.json` diff — присутствуют
   все те же 11×2 ключа, непустые).
3. **AC3 (parity).** `npm test` включает parity-проверку 4 локалей (часть
   i18n.test.mjs, покрывающего весь словарь, не только Party 1) — зелёная.
4. **AC4 (no duplicates).** Diff `houseplan-editor-runtime.ts` показывает
   явное удаление старых `rhint`: `gs.bg_daynight_hint` (заменено на
   `nothing`), `gs.north_hint` (удалён блок), `space.zero_wall_help` (удалена
   строка), `marker.controls_hint`/`.rhint` (заменены на `helpfieldlabel`).
   Тесты `test/i18n.test.mjs` («issue 86 removes explanatory hints…», «help
   hosts do not duplicate their explanation in a title attribute») —
   зелёные, прогнаны в составе `npm test`.
5. **AC5 (все поверхности).** Smoke `smoke_help_affordance.mjs` прогнан лично:
   флаги `party1GeneralInventory`, `party1SpaceInventory`,
   `party1ShowHiddenHelpIsReadOnly`, `party1GeneralHelpIsReadOnly`,
   `party1SpaceHelpIsReadOnly` — все `true`. Marker dialog проверен чтением
   (`marker.controls.help` trigger рядом с label, не внутри него) — паттерн
   идентичен уже проверенным General/Space.
6. **AC6 (input/a11y).** Тот же smoke: `mouseHover`, `touchClick`,
   `keyboardFocus`, `escapeHelpFirst`, `disabledExplanation`,
   `shadowFocusables`, `exclusive` — все `true`. Не новый код для #86 (общий
   механизм #68), но применённый к новым placements — проверено тем же
   smoke на новых узлах.
7. **AC7 (layout, узкий viewport + 200% zoom).** Два канала, как требует
   ТЗ §14: (а) smoke — флаги `party1BrowserZoom200Applied/TriggerInside/
   TooltipInside/NoHorizontalOverflow/StageStable` — все `true`, прогнано
   лично; (б) golden — `npm run golden:verify` лично, сценарии
   `settings-help-zoom-200-en-light`/`-ru-dark` в списке `passed`; открыл оба
   PNG глазами — popover `gs.bg_mode.help` целиком внутри 390×900 viewport на
   обеих темах, текст совпадает с каноническим §6. Также визуально открыл
   `docs/images/06-device-editor.png` (единственный из 10 docs-скриншотов,
   реально содержащий новые ⓘ-триггеры после этого ребейза — рядом с
   «Controls other light sources» и «Is this device a light source?») —
   подсказки на месте, без визуальных дефектов.
8. **AC8 (модель/поведение не меняются).** Прочитан весь diff
   `src/houseplan-editor-runtime.ts`/`onboarding-runtime.ts`: единственные
   изменения — разметка (`id=`, `<label for=>`, обёртки `helpfieldlabel`/
   `device-inbox-filter-help`) и вызовы `_help()`; ни одного изменения в
   обработчиках `@input`/`@change`, ни в save-путях, ни в config schema.
   `npm test` включает существующие снапшоты сериализации конфига — зелёные,
   не менялись.
9. **AC9 (партии 2/3 отсутствуют).** `grep` по diff `en.json` на добавленные
   строки, не относящиеся к 11 ключам Party 1 — пусто (только заголовок
   файла). Просмотрел полный список изменённых файлов (`git diff
   origin/dev...HEAD --stat`) — нет файлов, относящихся к проёмам, decor,
   толщине стен вне уже выпущенной `zero_wall_style`, размерам room labels.

## Трейлеры и changelog

16 коммитов ветки; ровно один с `User-Visible: yes` (`30c15a07` — «feat: add
critical settings help content»), и он же в том же коммите обновляет
`docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` (проверил `git show 30c15a07 --
docs/CHANGELOG*.md`). Остальные 15 коммитов (`fix`/`test`/`docs`/`build`,
включая оба пост-ребейзных `04da7eb1`/`fa146fb1`) — `User-Visible: no`,
корректно, так как это тестовые/build/docs-инфраструктурные шаги без нового
пользовательского поведения. Все коммиты несут `Issue: #86`.

## Закрытие r4

r4 был зелёным вердиктом (High: 0, Medium: 0) — находок не было, закрывать
нечего. Единственное событие между r4 и этим заходом — не правка по замечанию
ревью, а внешний ребейз на ушедший вперёд `dev` (#44), что и потребовало
полного, а не дельта-разбора (см. раздел выше).

## Унаследовано из r1–r4 (контекст, не молчаливое доверие)

Все пункты ниже перепроверены мной заново на актуальном `fa146fb1` (см.
раздел AC выше и таблицу гейтов) — перечисляю только для прослеживаемости
истории задачи, а не как пропущенную проверку:

- ТЗ (`docs/specs/086-settings-help-content-party1.md`) прошло ревью ТЗ
  зелёным в SPEC-REVIEW-86-r1 (коммит `20883c31`, домержен без изменений
  смысла в текущий `fa146fb1` — сверил текст файла, содержимое идентично).
- H1/H2 из CODE-REVIEW-86-r1 (подделанный фингерпринт скриншотов, красный
  `golden:verify`) закрыты внутри r1 и не всплывали в r2–r4; в r5 канал,
  поймавший H1 (`check-docs.mjs`), снова прогнан лично и чист.
- M1 из r2/r3 (AC7 browser zoom 200% без golden-канала) закрыт в r3 двумя
  golden-сценариями; в r5 они снова открыты глазами (см. AC7).

## Находки

**В скоупе задачи: нет.** High: 0, Medium: 0.

**Вне скоупа (заведено отдельно):** обнаружен процессный пробел в самом
Validate-workflow — job классификации файлов сравнивает изменения с головой
предыдущего push, и если тот прогон был `cancelled` (не «force-push»,
единственный ранее защищённый случай — issue #347), тяжёлые гейты у
следующего push тихо помечаются как нерелевантные, хотя фактически не
исполнялись ни разу после ребейза. На вердикт #86 это не повлияло — все
затронутые гейты прогнаны лично и прошли зелёными без единой находки. Заведено
как **#387** (`infra`, `P2`, `S1-new`), со ссылкой на #86.

## Вердикт

Зелёный. Party 1 (11 подсказок, 4 локали) полностью соответствует
`docs/specs/086-settings-help-content-party1.md`, ребейз на #44 выполнен без
потерь с обеих сторон, все 9 AC доказаны исполнением или чтением кода с явной
пометкой, changelog и трейлеры в порядке.
