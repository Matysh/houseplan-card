# CODE-REVIEW-953-r1

Issue: #953 · Этап: code · Заход: r1 · Трек: show (инфраструктура, B/C)
Материал: `04a802c2ea8513cbd052f5f805e0eaad6e151608` (ровно HEAD рабочей копии)
Маршрут побочных находок: mode=issues (снимок prepare совпал с REVIEW_FINDINGS_POLICY)

## Скоуп

Ночной полный мутационный прогон (`run 39099638179`, материал `dev@ddfff3809fa3`)
был отменён владельцем во всех 20 шардах; до отмены шард 9 успел зафиксировать
сбежавший мутант `hidden-display-toggle-uses-hidden-source-roster` — тест
оставался зелёным на сломанном коде. Задача чинит только браузерный
свидетель этого определения (один файл смока + один unit-тест), сохраняя id,
guard и patch мутанта без изменений; продуктовый код (`src/**`,
`custom_components/**`) не тронут вовсе. Класс изменения — B/C
(demo/**, test/**, scripts/mutation-registry.mjs — только текст `because`,
документация, release-ledger). Это не продуктовая фича из `docs/SCOPE.md`, а
инфраструктурный вход, разрешённый AGENTS.md («Инфраструктура… пропускает
анализ и спецификацию, входит сразу в S7»). Дубликатом #954 не является —
та правка касается переиспользования проверок, эта — неполноты одного
конкретного свидетеля.

## Маршрут §5 (трек show)

| критерий | решение |
|---|---|
| complexity | 2/10 по заявке автора; подтверждено объёмом диффа (8 файлов, 108 строк, без продуктового кода) — ≤3 |
| surfaces | одна поверхность: свидетель действий скрытого связанного светильника |
| migration | нет — конфиг/compat-поля не меняются |
| ux-contract | нет нового UX — поведение резолвера (#919 AC2) уже принято ранее, здесь только доказательство |
| perf-touch | не затронуто — продуктовый код не менялся |
| undocumented | поведение уже зафиксировано: тот же мутант/guard существовал с #919, меняется только обоснование и полнота доказательства |

Все критерии пройдены → `route: fix`.

## Как проверялось

Дешёвые гейты на `04a802c2` подтверждены зелёным Validate
(https://github.com/Matysh/houseplan-card/actions/runs/39121112373) — `tsc
--noEmit`, `npm test`, `npm run build` + сверка бандла переиспользованы без
повторного прогона (#343).

Прогнано самостоятельно (не входит в Validate, требуется по AC/диффу):

| гейт | команда | результат |
|---|---|---|
| diff-selection | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет… Тронуто файлов: 8» — src не тронут, смоки по умолчанию не выбираются; тем не менее AC2/AC3 прямо называют смок — прогнан отдельно |
| названный в AC смок | `npm run bundle:sync && node demo/smoke_hidden_device_toggle.mjs` | `OK`, 0 failures |
| названный в AC смок, список проверок | `HP_SMOKE_CHECKS=1 node demo/smoke_hidden_device_toggle.mjs` | все 6 новых имён присутствуют и совпадают с заявленными автором: `linkedLightAbsentWithEyeOff`, `linkedLightRevealedAsOrdinary`, `revealedLinkedLightDispatchesExactHADriver`, `revealedLinkedLightNeverTogglesDormantManualState`, `revealedLinkedLightPreservesSavedPair`, `unlinkedRevealedLightDoesNotOperateFormerDriver`, `unlinkedRevealedLightUsesOnlyManualToggle`, `unlinkedRevealedLightPreservesSavedPair` |
| полный unit-набор (повторно, т.к. первый локальный прогон словил 1 флейковый фейл в несвязанном zoom-таймер тесте, не в файлах диффа) | `npm test` (второй, чистый прогон) | `# tests 5254 / pass 5253 / fail 0 / skipped 1` — включает новый тест `test/hidden-device-visibility.test.mjs` |
| бандл восстановлен после локальной сборки для смока | `npm run bundle:clean` | рабочее дерево чистое (`git status --porcelain` пусто) |

Независимая проверка AC1 через GitHub API (не на веру из тела issue):
- `gh api .../actions/runs/39099638179` → `head_sha=deee605c...`, `head_branch=main`,
  `conclusion=cancelled` — подтверждает, что это оболочка workflow на `main`,
  отличная от материала ночи.
- `gh api .../check-runs/117593151347` (шард 9) → `conclusion=cancelled`.
- `.../check-runs/117593151347/annotations` → `"The run was canceled by
  @Matysh."` — дословное совпадение с заявленной причиной отмены.
- `gh run view --job 117593151347 --log` → строка чекаута
  `ref: ddfff3809fa3d263f117edff7e6c24bb0e981353` — подтверждает материал ночи
  дословно, и строка `FAIL hidden-display-toggle-uses-hidden-source-roster:
  тест остался зелёным на сломанном коде` — подтверждает сам сбежавший мутант,
  давший повод для задачи.

Прочитано (не исполнялось повторно, т.к. гейт уже дешёвый/не требуется):
полная ночная матрица мутантов (#709 — не прогоняется вне ночи ни на одном
треке, включая ревью); golden (диффом рендер не затронут, `ci:golden` не
проставлена и не требуется); pytest tests_backend (Python не менялся);
`npm run invariants` (геометрия не менялась).

## Разбор по коду

`scripts/mutation-registry.mjs`: диффом меняется только строка `because`;
`id`, `guard`, `patches` байт-в-байт те же (построчное сравнение диффа) —
мутация и её исполнение ночью не затронуты, политика «не исполнять мутанты
вне ночи» не нарушена (новый `src/**`/`custom_components/**` дифф отсутствует
вовсе).

`demo/smoke_hidden_device_toggle.mjs`: новая фаза монтирует сохранённый
скрытый виртуальный светильник (`binding: 'virtual'`, `hidden: true`) со
входящей связью от скрытого реального HA-реле (`binding: 'device:d_kettle'`,
`controls: ['marker:hidden-linked-light']`). `toggle()` кликает по настоящей
кнопке `[data-hp="hidden-devices"]` (кнопка глаза), `linkedFace.click()` —
настоящий клик по смонтированному элементу устройства, без патчей рантайма.
Прочитано: проверяется ровно один вызов `window.__serviceCalls` с точным
`['homeassistant', 'turn_on'|'turn_off', {entity_id:['switch.kettle']}]`,
отсутствие записи `houseplan/virtual_light/toggle` в перехваченном
`callWS`, и неизменность `stored()` (реальный `houseplan/config/get` +
`houseplan/layout/get`) до/после клика. После обычного конфигурационного
события (`controls = []`) — тот же native click даёт только
`houseplan/virtual_light/toggle` и не обращается к бывшему драйверу. Это
ordinary negative input на неизменённой реализации, не патч продукта —
допустимо общей политикой.

`test/hidden-device-visibility.test.mjs`: новый тест вызывает
`resolveToggleIntent`/`toggleOperation` из НЕИЗМЕНЁННОГО
`test-build/device-toggle.js` на трёх входах неизменённого резолвера —
`devices: display` (после `HiddenDeviceRoster.read(source, true)`),
`devices: source` (сырой скрытый ростер) и `devices: unlinked` (после снятия
`controls`). Прочитано `src/device-toggle.ts:692-723` и
`src/devices.ts:472-518`: `lightGraphOf` строит `markerById` только из
`!device.hidden` записей (devices.ts:484), поэтому с `devices: source`
(оба элемента `hidden: true`) `incomingLightControls` не находит входящую
связь для `marker:lamp`, и резолвер закономерно падает на dormant
`virtual-light` fallback — именно так, как ожидает тест. С `devices: display`
(`HiddenDeviceRoster.read` проецирует `hidden: false` для обоих, не мутируя
источник — `src/hidden-device-visibility.ts:26-33`) та же связь находится и
резолвер отдаёт `ha-service` с `switch.relay`. Тест нетривиален: он реально
упирается в код, который различает source/display ростеры, а не дублирует
browser-смок. Проверено чтением и подтверждено независимым запуском
(`node --test`, зелёный). В конце теста `assert.equal(lamp.hidden, true)` и
`assert.equal(driver.hidden, true)` подтверждают, что исходные объекты
`source` не мутируются проекцией — соответствует AC3 «сохраняет исходные
hidden-флаги».

`docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md`: запись добавлена в «Unreleased»
несмотря на `User-Visible: no` — это соответствует PROCESS.md (раздел
«Авторский changelog стабильного релиза»): эти файлы ведут техническую
задачно-коммитную историю включая инфраструктуру и беты, пользовательский
текст отдельно в `docs/changelog_user_stable_*.md` и не создаётся для infra.
Трейлеры коммита `04a802c2`: `Issue: #953`, `User-Visible: no` — согласованы
с диффом (оба changelog правятся, но это дополнительная практика проекта для
infra-записей, а не признак скрытого user-visible изменения).

`docs/release-ledger/v1.81.0/953.json`: `category: "infra"`,
`rationale` описывает ремонт свидетеля без изменения поведения — верно
согласно таблице PROCESS.md §11.9 (`infra` → без milestone, без
`introducedBy`); формат совпадает с соседними записями каталога
(`638.json` и др.). Milestone релиза не затронут — корректно для infra.

## AC · чем доказан · чем краснеет

| AC | Доказательство | Чем краснеет |
|---|---|---|
| AC1 | Таблица шардов в теле issue + независимая проверка через `gh api` (check-run 117593151347, annotations, job log — все совпали дословно с заявленным) | Не защитный AC — фактическое описание инцидента, подтверждено чтением внешних источников |
| AC2 | `node demo/smoke_hidden_device_toggle.mjs` — зелёный, включает `revealedLinkedLightDispatchesExactHADriver`, `revealedLinkedLightNeverTogglesDormantManualState`, `revealedLinkedLightPreservesSavedPair` | Зарегистрированный мутант `hidden-display-toggle-uses-hidden-source-roster` (`scripts/mutation-registry.mjs`) — **не исполнялся** в этом раунде (общая политика, #905); поимку подтверждает только ночь |
| AC3 | Тот же смок (`unlinkedRevealedLight*`) + `node --test test/hidden-device-visibility.test.mjs` зелёный, 3 входа (display/source/unlinked) различают резолвер по коду (`src/devices.ts:484`) | Обычный отрицательный случай внутри самого теста: `devices: source` и `devices: unlinked` оба дают другой результат (`virtual-light` fallback), чем `devices: display` (`ha-service`) — наблюдаемое красенение проверено исполнением |

Пустых третьих столбцов нет.

## Находки

Не найдено. High: 0, Medium: 0, Low: 0.

## Что проверено и корректно

- Продуктовый код (`src/**`, `custom_components/**`) не затронут — подтверждено `git diff --stat` по диапазону.
- Единственный мутант задачи (`hidden-display-toggle-uses-hidden-source-roster`) не исполнялся вручную в этом раунде; патч/guard/id не менялись.
- Новый unit-тест реально различает source/display/unlinked входы неизменённого резолвера (проверено чтением `src/device-toggle.ts` и `src/devices.ts`) и не мутирует исходные объекты.
- Новая фаза смока использует настоящий клик по кнопке глаза и по смонтированному элементу устройства, без патчей рантайма или сборки.
- Причина и материал отменённой ночи (AC1) подтверждены независимо через GitHub API, а не только цитированием тела issue.
- Release-ledger классификация `infra` и трейлеры коммита согласованы с PROCESS.md §11.9 и §3 п.10.
- `route: fix` — все критерии §5 трека show пройдены.
- Рабочее дерево после локальных сборок/прогонов восстановлено (`npm run bundle:clean`), в репозиторий руками ничего не внесено.

## Чего не проверял

- Полный ночной мутационный реестр не перезапускался — вне ночного workflow это запрещено политикой (#709/#905) на любом треке; фактическую поимку мутанта подтвердит только следующая ночь.
- `golden:verify`, `pytest tests_backend`, `npm run invariants` — не прогонялись: диффом не затронуты рендер, Python-бэкенд и геометрия.
- Ручная dev/GPU-приёмка не выполнялась — по REVIEWER.md она добровольна и не является находкой при её отсутствии.
- Причина исходной отмены ночного прогона (почему владелец отменил все 20 шардов) не исследовалась глубже — это решение владельца, а не предмет этой задачи.

## Вердикт

Зелёный. Побочных находок нет.

Trailer: `Issue: #953`, `User-Visible: no` на единственном коммите `04a802c2` — корректны.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/953-hidden-display-witness`, коммит `04a802c2ea85` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `90a59d6085cbf07704b408ac6c681fb3c13ed2a1`
  ```
  git log --all --format='%H %T' | grep 90a59d6085cb
  ```
- Тело issue: `bd23ac9da9bb225e934e2235ec0a3d269693609c1616ac875b45755fc02af232`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMDEsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTg2fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxNDQsIm91dHB1dF90b2tlbnMiOjI3NTMwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEwNDc0MiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjYzMTY5OTgsImNvc3RVc2RFc3RpbWF0ZSI6MS45NTc5NTU2fV0sInR1cm5zIjo3NywiZHVyYXRpb25NcyI6NzcyNTA4LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS45NjMxNDE2MDAwMDAwMDAyLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5245 output_tokens=27547 cache_creation_input_tokens=104742 cache_read_input_tokens=6316998 num_turns=77 -->
