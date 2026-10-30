# CODE-REVIEW-1011-r2

Issue: #1011 · Трек: ask · Этап: code · Заход: r2 · блокирующих циклов израсходовано 1 из 4 (после этого вердикта — 2 из 4)

Материал: `origin/dev..HEAD`, `git rev-parse HEAD` = `5facb98fb27da59a74e986edc9addff734656d77` (подтверждено). 4 коммита:
`007dfece9`, `c23ccf955`, `36377f489`, `5facb98fb`. База `origin/dev@2f458c4f3`.

## Материал раунда r1 и предмет дельты

r1 код-ревью прошло на материале `36377f4894b6a4fe318c174cfcc3010a1a317c60` (первые 3 коммита) и завершилось
**жёлтым** вердиктом (issue-комментарий 2026-10-22T11:12:12Z): High 0, Medium 1 (toast `_showToast` id не
передаётся на части вызовов с единственным известным i18n-ключом). **Файл `docs/reviews/CODE-REVIEW-1011-r1.md`
в репозитории не опубликован** (его нет ни в рабочем дереве, ни в истории `git log --all`), несмотря на ссылку
на него в вердикте — материалом раунда r1 служит только текст issue-комментария; это зафиксировано как
единственный источник, повторный документ не придумывается.

После этого вердикта автор самостоятельно (до применения вердикта) отозвал активный запрос S7, обнаружив
ОТДЕЛЬНЫЙ дефект AC5 (radar-section/sourcePicker без `fieldId`); эта самопроверка не образовала вердикта
(«Автоматическое ревью не отработало», model run отменён) и бюджет не тратила. Единственная дельта r1→r2 —
коммит `5facb98fb` («test: cover shared primitive callers and remaining action controls», `36377f489..5facb98fb`,
25 файлов): добавляет `data-hp="action"`/`data-action` на кнопки и передаёт идентичность в id-less вызовы
`toggleRow`/`sourcePicker` (radar swap-axes/angle-clockwise, Properties variable picker/filter, north dial),
плюс guard `missingPrimitiveIdentities` и новый `demo/smoke_e2e_primitive_fields.mjs`.

**Эта дельта не затрагивает ни одного файла, фигурировавшего в Medium-находке r1** (`src/decor-image-editor.ts`,
`src/marker-deletion.ts`, `src/toast-presentation.ts`, `test/toast-presentation.test.mjs` последний раз менялись
в `007dfece9`, до r1-ревью). Находка проверена по дельте и по чтению текущего кода — не закрыта.

## Унаследовано из r1 (без повторной проверки по существу, т.к. не затронуто дельтой)

Остальной функционал r1 (контракт hooks/tool, AC1–AC3, AC6, AC7, типы/сборка/бандл на уровне r1) принимается
по документу раунда r1 (сам вердикт — тексту комментария, т.к. файла нет) **и** перепроверен заново ниже,
поскольку задача показывает «риск по изменённым участкам» по всему диффу `origin/dev..HEAD`, а не только по
дельте r1→r2 (трек `ask` требует сверки каждого риск-класса с AC ТЗ на материале ревью целиком).

## Находки

### Medium (в скоупе AC4, блокирует зелёный вердикт) — не закрыта с r1

`_showToast(message, id?)` по контракту (`STYLING-HOOKS.md` §7.8: «`toast[data-id]` — Known i18n key... no
reverse lookup by translated text») обязан передавать `id` для любого статически известного единственного
i18n-ключа; `message` зарезервирован для составленного/внешнего текста. На момент r2 это по-прежнему
нарушается на тех же инвариантах, что в r1:

- `src/marker-deletion.ts:178` — `host._showToast(inboxT(host, 'device_inbox.selection_changed'))` — простой
  известный ключ без `id`.
- `src/marker-deletion.ts:184` — `host._showToast(inboxT(host, 'device_inbox.batch_deleted', { count }))` —
  то же.
- `src/decor-image-editor.ts:190` — тот же ключ `decor.image_in_use` получает `id` корректно...
- `src/decor-image-editor.ts:213–214` — ...а на пути ошибки WS `in_use` при удалении тот же
  `decor.image_in_use` (либо `backup.error.io_error`) передаётся **без** `id` — тот самый пример из r1,
  построчно не изменился.
- `src/houseplan-editor-runtime.ts:8151` — тернарник `'toast.space_added_onboard' : 'import.done'` без `id`,
  хотя оба — известные ключи (на соседних строках `:348`, `:8276` тот же `import.done` получает `id`
  корректно).
- `src/editors/properties/editor.ts:491` и `src/houseplan-card.ts:5565` — тернарник
  `direction === 'undo' ? 'history.undone' : 'history.redone'` без `id`.
- `src/houseplan-card.ts:5675` / `src/houseplan-editor-runtime.ts:7593` — тернарник по `ha_disabled` без `id`
  (соседняя строка `houseplan-card.ts:5687` с одиночным ключом `toast.ha_disabled_action` id передаёт).

Зарегистрированный witness `e2e-toast-keeps-no-key-1011` (guard `test/toast-presentation.test.mjs`) и сам тест
(диффнут в делте r1, не в r1→r2) проверяют только механику `ToastPresentation.show/id` (роутинг между
диалогами, retire на безключевой замене) — **не** корректность вызова на каждом call site. Source-gate
(`scripts/data-hp-source.mjs`) проверяет только литералы `data-hp`/`data-tool`, не аргументы `_showToast`.
Новый `demo/smoke_e2e_hooks.mjs` проверяет единственный путь `toastKeyFromRealNegativeInput` (загрузка
неподдерживаемого формата → `toast.plan_formats`) — не покрывает перечисленные выше. Других witness/тестов,
которые эти инварианты проверяют, не найдено.

**Чем краснеет:** обычный негативный прогон без подмены исходников — например, вызвать
`device_inbox.selection_changed` (через изменение `navigation`/`signature` в сценарии удаления инбокса из
`src/marker-deletion.ts`) и прочитать `data-id` показанного toast: ожидание по контракту —
`device_inbox.selection_changed`, факт — `message`. Это прямой разрешённый негативный пример на неизменённой
реализации (политика ревью, «Отрицательные проверки и мутанты»), не мутант; я не исполнял его на бандле/сборке —
записываю как «проверено чтением, не исполнением», достаточным для демонстрации разрыва между контрактом
(`STYLING-HOOKS.md` §7.8) и кодом.

**AC задета:** AC4 («toast key доступны... перенос toast не теряет идентичность»). Автор не оспорил и не
закрыл находку в комментариях между r1 и r2 — handoff r2 (2026-10-22T11:47:38Z) говорит только о фиксе AC5
(primitive callers), о toast id не упоминает.

Находка в скоупе, Medium → по правилу (`docs/process/REVIEWER.md`, «Находки и вердикт») — жёлтый вердикт,
возврат автору, отдельный issue не заводится.

## Риск по изменённым участкам (#707) — проверка по AC ТЗ

| Класс | Место | АС, которым покрыто | Вывод |
|---|---|---|---|
| geometry | `houseplan-editor-runtime.ts:4798` `data-field="wall-thickness"` | AC5 (field) | соответствует контракту, проверено чтением |
| geometry | `houseplan-editor-runtime.ts:5599,5604` `data-action="wall-thickness-apply(-room)"` | AC7-таблица `action[data-action]` | соответствует |
| geometry | `wall-node-editor.ts:341` `data-field="wall-thickness"` (draw control) | AC5 | соответствует |
| geometry | `wall-node-editor.ts:354` `wall-node[data-node]` на `circle.hp-node-handle`, декоративный круг без `data-hp` | AC1, контрактная строка `wall-node[data-node]` («не декоративный внешний круг») | соответствует дословно |
| touch | `editors/properties/surface.ts:129` `data-action="properties-insert-variable"`, `@pointerdown=${e=>e.preventDefault()}` | AC5 (Properties); `preventDefault` — существовавшее поведение, не новая правка жеста | не меняет touch-контракт, соответствует «поведение не меняется» |
| migration | `config-reload-authority.ts:186,275` — интерфейс `_showToast(message, id?)`, вызов `toast.cfg_reload_failed` с `id` | AC4/AC8 | соответствует, id передаётся |
| migration | `houseplan-editor-runtime.ts:7741` `toast.files_migrate_failed` с `id` | AC4 | соответствует, id передаётся — этот путь не входит в находку выше |
| devices | `vacuum-calibration-write.ts:116,139,185,206` все `_showToast(..., id)` с id | AC2/AC3 | соответствует |
| devices | `vacuum-dock-restart-write.ts:75` `toast.cfg_save_failed` с id | AC2 | соответствует |
| perf | `glow-scene.ts:675,682` `data-hp="glow-layer"`/`"glow-pool"` `data-entity` | AC3 (glow) | соответствует контрактной строке дословно |

Все перечисленные конкретные риск-строки, кроме уже разобранной Medium-находки (другие файлы/строки, не входящие
в этот список), покрыты AC ТЗ и соответствуют описанной семантике. Класс «миграция» в этих двух местах не
пересекается с найденным дефектом (там id передан).

## Как проверялось (таблица гейтов)

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | PASS, 0 ошибок |
| unit-тесты | `npm test` (полный лог; первый параллельный прогон дал 12 ложных FAIL из-за одновременной конкуренции за CPU с build/bundle/mutation-gate; изолированный повтор ниже — авторитетный) | PASS 5554/5555, 1 skip, 0 fail, `duration_ms≈365000` |
| сборка | `npm run build` | PASS, `dist` создан |
| sync трёх копий бандла | `npm run bundle:sync` (build+rollup+`bundle-sync.mjs`→`demo/srv/assets`) | PASS |
| бандл-бюджет | `npm run bundle:budget` | PASS, все профили в полосе (`lazy editor` 329664 ≤ 329291+2000; `raw` в полосе; ceiling-правка `scripts/bundle-budget.mjs` соответствует комментарию в коде и ранее данному в ТЗ разрешению на малую корректировку) |
| process-gate | `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | PASS, 4 коммита, 0 предупреждений |
| mutation-gate (статика) | `node scripts/mutation-gate.mjs --check` | PASS: definitions=1765, unique-source-reads=957, browser 460/200 (ориентир), execution=0, caught=unknown (ночной) — соответствует политике, мутанты не исполнялись |
| контрактные unit-тесты | `node --test test/data-hp-contract.test.mjs` | PASS 11/11, включая отрицательные входы (`assert.throws` на неизвестный dynamic writer, на `missingPrimitiveIdentities`/`missingControlHooks` — тест умеет падать) |
| новый E2E-smoke | `node demo/smoke_e2e_hooks.mjs` (после `bundle:sync`) | PASS, все перечисленные assertions `true` |
| новый E2E-smoke примитивов | `node demo/smoke_e2e_primitive_fields.mjs` | PASS 10/10 |
| golden (метка `ci:golden`) | `npm run golden:verify` | PASS 220/220, все с `diff=0px ratio=0.000000 maxDelta=0`; пин Chromium совпал (`chromium-headless-shell 151.0.7922.34 rev1234`, тот же, что реально запущен); baseline не менялся, сдвига кадров нет |
| smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD --json` | Выполнен, получил списки `direct`/`registered`/`unseen`; полный матричный прогон (211 смоков) не повторялся — опираюсь на авторский отчёт (208/211 PASS, 3 устойчивых FAIL независимо воспроизведены на отдельной базе и заведены как #1013/#1028, не regressions этой задачи) как на уже выполненное доказательство, подтверждённое двумя новыми named smoke выше самостоятельно |
| pytest tests_backend | — | не прогонялся: диапазон не затрагивает Python (`custom_components/**`), гейт не применим |
| invariants | — | не прогонялся: геометрия плана/расчёты не меняются, только DOM-атрибуты на уже вычисленном состоянии (ТЗ прямо исключает «не запускают расчеты геометрии ради тестов»); риск-класс geometry разобран построчно выше чтением |
| performance | — | не назван в AC, не прогонялся |

## Трейлеры и changelog

Все 4 коммита несут `Issue: #1011`, `User-Visible: no` — корректно для чисто тестового/инфраструктурного
контракта (поведение/вёрстка не меняются). `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` при этом получили записи
в `007dfece9` — это не противоречит правилу (запись обязательна только при `yes`, не запрещена при `no`), текст
записи сам по себе констатирует «Interface, behaviour... unchanged», искажения числа пользователю нет.

## Release ledger

`docs/release-ledger/v1.82.0/1011.json`: `category: "infra"`, обоснование «no user-visible behaviour, layout,
permission, configuration or backend changes», `introducedBy` не требуется (не правка существующей бета-функции).
Соответствует авторскому суждению по §11.9 — milestone не нужен, это корректное решение для чисто тестовой
инфраструктуры.

## Что проверено и корректно

- Геометрия/сцена (AC1): `stage[data-grid-step]`, `wall-node-layer[data-state]`, `wall-node[data-node]` —
  дословно по контрактной таблице ТЗ, декоративный круг хук не получает.
- Устройства/пылесос/перф (AC2/AC3/перф): все проверенные риск-строки передают `id`/атрибуты корректно.
- Контрактные unit-тесты и их отрицательные входы реально падают на обычных некорректных данных без подмены
  исходников.
- Два новых demo-smoke реально проходят на собранном бандле (после `bundle:sync`), а не только существуют как
  файлы.
- typecheck/build/bundle-budget/process-gate/mutation-gate(static)/golden — все зелёные на материале `5facb98fb`.
- Трейлеры, ledger, changelog-текст — соответствуют правилам.

## Чего не проверял

- Полный матричный `smoke-select` (211 смоков) заново — переиспользован авторский отчёт по трём известным
  непроходящим smoke (#1013, #1028), подтверждённый двумя новыми named smoke самостоятельно.
- Реальный HA/физический touch/другие браузеры — не входят в скоуп задачи и не заявлены как проверенные.
- Исполнение зарегистрированных mutation-witness (ночной прогон, вне скоупа ревью по политике).
- `pytest tests_backend`/Python — неприменимо, диапазон не трогает backend.
- Полный обход всех ~200 вызовов `_showToast` построчно — выборочно проверил названные в r1 и дополнительно
  найденные тем же `grep`-паттерном; не исключаю, что есть другие аналогичные случаи вне перечисленных.

## Маршрут

`route: fix` (трек `ask`, не `show`; `reclassify` не применяется).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1011-e2e-hooks`, коммит `5facb98fb27d` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `2d41485983a9a0e7a40b3603a5ff1b8c89c2baeb`
  ```
  git log --all --format='%H %T' | grep 2d41485983a9
  ```
- Тело issue: `58cd852415e23d4d5c1bf1dc01317194bda672ffd746e30c51f36aa32588c253`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ5OTcsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDg2OTk5OTk5OTk5OTk5NX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTk0LCJvdXRwdXRfdG9rZW5zIjo1MzQ1NywiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxNzY5NzAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxMjkzNTI2NywiY29zdFVzZEVzdGltYXRlIjozLjgyOTg5MTQwMDAwMDAwMTV9XSwidHVybnMiOjExMiwiZHVyYXRpb25NcyI6MTI5ODU2MywiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjMuODM0OTc4NDAwMDAwMDAxNiwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5191 output_tokens=53475 cache_creation_input_tokens=176970 cache_read_input_tokens=12935267 num_turns=112 -->
