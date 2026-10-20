# CODE-REVIEW-978-r1

Этап: code · Трек: show · Заход: r1 · Блокирующих циклов израсходовано: 0/2
Материал: `465ba4c06389c6433983b7786b808cc0e3b3f347` (база `origin/dev` = `782c3d3cf...`)
Диапазон: `782c3d3cf..465ba4c06` (2 коммита: `bbaa01a60` код+доки+ledger, `465ba4c06` C-only правка ledger)

## Скоуп

Issue #978 — follow-up к #977: в форме «Источник состояния значка»
(`src/editors/marker-state-source.ts`) строка
`const current = hass.states?.[eid]?.state;` читала HA-состояние сохранённого
`entity_id` до проверки его принадлежности/допустимости, в обход уже принятого
в #977 контракта (foreign/disabled/pending/virtual-источник не должен читаться).
Это защитный баг-фикс одной формы, без нового UX-решения — контракт описан в
#977 (AC2/AC6) и в `docs/USER-GUIDE.ru.md` («Нет данных — активность неизвестна,
другой датчик незаметно не подставляется»).

Маршрут §5: `complexity` ≤3 (автор 1/10, фактически одно условие), `surfaces` —
одна форма, `migration` — нет новых полей/схемы, `ux-contract` — поведение уже
описано в #977/USER-GUIDE, `perf-touch` — нет нового чтения/подписки/touch,
`undocumented` — ожидаемое поведение зафиксировано. Все критерии пройдены →
**route: fix**.

## Как проверялось

Рабочая копия уже на материале `465ba4c06`, `git fetch/pull/checkout` не делал.

Дешёвые гейты на этом SHA уже подтверждены Validate CI (ссылка в задаче
ревьюеру) — `npx tsc --noEmit`, `npm test`, `npm run build` со сверкой бандла
повторно не гонял. Вместо этого бюджет раунда потрачен на:

1. Чтение диффа (`git diff origin/dev...HEAD`) и полного тела/всех комментариев
   issue #978 (`gh issue view 978 --json ... `).
2. Чтение `src/marker-state-source.ts` (`markerStateSourceCandidates`,
   `stateSourceOwnership`) и диффа `src/editors/marker-state-source.ts` построчно,
   сверка семантики `candidates` до и после правки (`git show 782c3d3cf:...`).
3. Разбор по коду (без исполнения) всех 11 сценариев нового
   `test/marker-state-source-form.test.mjs` — для каждого прогнал вручную логику
   `markerStateSourceCandidates`/`stateSourceOwnership` и убедился, что на
   **прежней** реализации (`hass.states?.[eid]?.state` без гейта) getter-ловушка
   на `states[eid]` в тесте обязана сработать (foreignReads>0) для всех
   отрицательных кейсов, то есть тест действительно красный на старом коде.
   Это разбор по коду с явной записью «проверено чтением, не исполнением» —
   возврат строки к старому виду и прогон на неизменённой продуктовой копии
   запрещён политикой (исполнение мутанта), поэтому не делал.
4. Смоки, выбранные по диффу (диф трогает рендер формы, AC1/AC2 явно называют
   browser regression и `demo/smoke_marker_state_source.mjs`) — прогнал сам:
   - `npm run build` → чисто (tsc --noEmit + rollup, 30.4s).
   - `node scripts/bundle-sync.mjs` → синхронизировал `demo/srv/assets`
     (локальный `dist/` в репозитории зафиксирован на старом релизном коммите
     `b5c252172`, без правки #978 — без пересборки смок проверял бы старый бандл).
   - `node demo/smoke_marker_state_source.mjs` → PASS, все 18 наблюдаемых
     проверок `true`, включая новые `foreignHintHasNoState`,
     `foreignIdStaysSelected`, `foreignCancelPreservesBlock`,
     `disabledHintHasNoState`, `currentHintTracksOwnSource`. Pinned Chromium
     151.0.7922.34 (headless-shell), совпадает с заявленным в отчёте автора.
   - `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs &&
     node --test test/marker-state-source-form.test.mjs
     test/marker-state-source.test.mjs` → 19/19 PASS (11 новых form-кейсов +
     8 существующих resolver-кейсов `#977`), совпадает с заявленным.
   - `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report`
     → «гейт пройден, предупреждений 0».
   - `node scripts/release-ledger.mjs catalogue --candidate=HEAD --issue=978` →
     issue 978 корректно отсутствует в `userIssues` (line-fix не входит в
     пользовательский milestone), без ошибок по записи.
5. Чтение всех изменённых doc-файлов (`ARCHITECTURE.md`, `DEVICE-PRESENTATION.md`,
   `STATUS.md`, `DEVELOPMENT.md`, оба `CHANGELOG*`) на соответствие факту диффа.
6. Проверка трейлеров и release ledger (ниже).

## Находки

Находок нет — ни High, ни Medium, ни вне скоупа.

## Что проверено и корректно

- **Суть фикса.** `candidates` (`markerStateSourceCandidates(d.binding, registry)`)
  уже вычислялся в прежней версии функции для выпадающего списка — это не новое
  чтение/скан реестра, а переиспользование существующего значения (подтверждено
  diff `782c3d3cf` → `465ba4c06`: единственная продуктовая правка —
  `const current = candidates.includes(eid) ? hass.states?.[eid]?.state : undefined;`).
  `markerStateSourceCandidates` уже фильтрует по
  `!stateSourceOwnership(binding, eid, registry)`, то есть исключает
  foreign/disabled/disabled-parent/pending/virtual до попадания в список — ровно
  тот канонический guard, который требует AC1.
- **AC1** (не читать state недопустимого источника). Прочитан по коду и
  подтверждён и unit-, и browser-свидетелем: для foreign/disabled/disabled
  parent/pending/sibling-без-записи/virtual `candidates.includes(eid)` всегда
  `false` (прослежено через `stateSourceOwnership`/`markerStateSourceCandidates`
  построчно для каждого из 8 негативных сценариев теста), значит правая часть
  тернарника не исполняется и `hass.states[eid]` не читается. Подтверждено
  browser-кейсами `foreignHintHasNoState`/`disabledHintHasNoState` = `true`
  (hint `—`), `foreignIdStaysSelected`/`foreignCancelPreservesBlock` = `true`
  (недопустимый ID остаётся выбран, конфиг не меняется открытием формы).
- **AC2** (допустимый источник сохраняет live-hint, включая `unknown`; exact
  entity binding без parent реестра работает). Прослежено по коду для
  `binding` вида `device:own`, `entity:sensor.anchor` и `entity:<eid>` без
  записи в реестре — во всех трёх случаях `eid` корректно попадает в
  `candidates` (через `ownEntity`-ветку в `markerStateSourceCandidates`), чтение
  состояния происходит как раньше. Browser-кейсы `liveActive`, `exactMatch`,
  `exactNonmatch`, `unknownNoFallback`, `unknownExplained`, `autoClears` = `true`.
- **AC3** (схема/face/action/light/геометрия/touch/лимиты не меняются, нет новых
  записей/подписок/скана). Продуктовый диф — ровно одна строка в одной
  функции формы; `src/marker-state-source.ts` (общий resolver) не тронут;
  `planStaticParity` в смоке = `true`. `npm run build` прошёл без ошибок типов.
- **Трейлеры и changelog.** Коммит `bbaa01a60` несёт `Issue: #978` и
  `User-Visible: yes`; оба `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` правлены в
  том же коммите, формулировки совпадают по смыслу (ru/en), конкретных чисел,
  видимых пользователю дважды, в диффе нет.
- **Release ledger.** `docs/release-ledger/v1.81.0/978.json`:
  `category: line-fix`, `introducedBy: 977`, обоснование — функция появилась
  только в текущей dev-линии (#977), в `v1.81.0` её не было → корректно
  исключена из пользовательского changelog/milestone. Механический гейт ранее
  (комментарий #3 в issue) отклонил первую версию ledger за отсутствие
  `introducedBy`; C-only коммит `465ba4c06` добавил только это поле, код/тесты
  не менял — подтверждено `git show --stat 465ba4c06` (1 файл, 1 строка) и
  `release-ledger.mjs catalogue` без ошибок.
- **Доки.** Правки `ARCHITECTURE.md`/`DEVICE-PRESENTATION.md`/`STATUS.md`/
  `DEVELOPMENT.md` точно описывают добавленный guard и названные тесты, без
  переобещаний (не меняют описание resolver/#977-контракта). `USER-GUIDE.ru.md`
  уже фиксирует нужное поведение («другой датчик незаметно не подставляется») —
  фикс приводит код в соответствие с уже описанным, новых строк в
  пользовательском гайде не требуется.

### AC → чем доказан → чем краснеет (защитные AC)

| AC | Чем доказан | Чем краснеет |
|----|-------------|--------------|
| AC1 (не читать недопустимый source) | `test/marker-state-source-form.test.mjs` (8 негативных unit-кейсов с getter-ловушкой) — прогнан: 19/19 PASS; разбор по коду подтверждает, что на прежней реализации (`hass.states?.[eid]?.state` без гейта `candidates.includes`) ловушка обязана сорваться для каждого из этих кейсов → обычный тест, «не исполнялся» не применяется, проверено и исполнением (PASS сейчас), и чтением (красный на старом коде) | Обычный тест (см. выше), PASS на материале, подтверждённое чтением падение на пред-#978 коде |
| AC1/AC2 (форма не меняет конфиг при открытии; foreign ID остаётся выбран) | `demo/smoke_marker_state_source.mjs`, кейсы `foreignIdStaysSelected`, `foreignCancelPreservesBlock`, `foreignHintHasNoState`, `disabledHintHasNoState` — прогнан мной лично после `npm run build`+`bundle-sync`, все `true` | Обычный browser-смок, PASS на материале |

## Чего не проверял

- **Полный `npm run gate:small`** и повторный полный `npm test`/`tsc --noEmit`
  целиком — не гонял: Validate CI на этом же SHA (`465ba4c06`) уже зелёный
  (ссылка в задаче), материал/окружение/оракул не менялись. Вместо повтора
  целиком прогнал прицельно тяжёлую для диффа часть (build, bundle-sync,
  browser-смок, два релевантных unit-файла, process-gate, release-ledger
  catalogue) — то, что Validate не покрывает по духу задачи (свежесть
  локального `dist/`, конкретный смок, выбранный по диффу).
- **Golden-скриншоты иконок/плана.** Диф не трогает canvas-рендер значков,
  только текстовый hint в диалоговой форме редактора; `planStaticParity=true`
  в смоке подтверждает отсутствие регрессии в статичном плане. Golden-наборы
  не перегонял — AC3 прямо просит не перепринимать посторонние golden.
  8 fallback-смоков, предложенных `smoke-select` в отчёте автора
  (`daycycle_zoom_layers`, `decor_layer_order`, `hide_layers`, `mode_transition`,
  `modes`, `static_zoom_sharpness`, `visual_continuity`, `wall_hatch_density`) —
  проверил обоснование по каждому: все про подсистемы, которых диф не касается
  (слои/режимы/zoom/стены/перерисовка), согласен с исключением.
- **Мутационное/nightly-тестирование и ручной откат продуктовой строки.**
  Не делал: политика прямо запрещает исполнение мутанта (временный патч
  исполняемой реализации) вне ночного workflow; «краснота» старого кода
  установлена разбором по коду и зафиксирована выше как «проверено чтением».
- **Реальная интеграция с Home Assistant / реальным registry.** Не проверял —
  вне объёма этой формы-фикса; существующий fake-backend смока и unit-моки
  реестра признаны достаточными для этого класса изменений (track show,
  risk 2/10).

## Побочные находки (политика: mode=issues)

Побочных находок нет — новый issue не заводился.

## Вердикт

Зелёный. Находок нет, все AC доказаны либо обычным тестом (PASS +
подтверждённая чтением красность на пред-фикс коде), либо прицельным
browser-смоком, который я прогнал лично на пересобранном бандле. Маршрут:
fix (все критерии §5 пройдены).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/978-icon-source-form-ownership`, коммит `465ba4c06389` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `83da5613f3528c089e33947dc2d6c2a5284cf492`
  ```
  git log --all --format='%H %T' | grep 83da5613f352
  ```
- Тело issue: `75c52f10e85a0ad4c9bda6fc9231b602ac85273c1e93875b3192341df0c8d0ce`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMDEsIm91dHB1dF90b2tlbnMiOjIyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjEwOTk5OTk5OTk5OTk5NX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NzYsIm91dHB1dF90b2tlbnMiOjIyNzA1LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjcxNzk0LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MjQ2NDc5MiwiY29zdFVzZEVzdGltYXRlIjoxLjAwNzMzNjM5OTk5OTk5OTh9XSwidHVybnMiOjQ1LCJkdXJhdGlvbk1zIjozNDIzMDksImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjAxMjU0NzM5OTk5OTk5OTksImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5177 output_tokens=22727 cache_creation_input_tokens=71794 cache_read_input_tokens=2464792 num_turns=45 -->
