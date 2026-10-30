# CODE-REVIEW-1004-r2

Трек: ask · Этап: code · Заход r2 · блокирующих циклов 0/4

Материал: `f591799af9c00fa5f2b7a94f87adcd8577f991d0` (рабочая копия уже на нём).
Диапазон `origin/dev..HEAD` = `origin/dev` (`70ef213d7`, ancestor of HEAD).
Предыдущий раунд: `CODE-REVIEW-1004-r1.md`, материал `cec6d9f735022efea969f7dadf6bf390b5343171`,
вердикт зелёный, High 0 / Medium 0.

## Скоуп

ТЗ не изменилось: тело issue #1004 (AC1–AC8) — распространить opt-in Zigbee
hover-диагностику (связи/стрелки) на устройства, представленные LED-лентой.
Это J7 (`docs/SCOPE.md`). Вопрос — есть ли контентная дельта со времён r1,
которую нужно заново проверить.

## Почему понадобился r2 (не содержательная правка)

Из комментариев issue (бот-владелец):
- после фактического r1 GREEN `dev` продвинулся на 7 коммитов; слияние ветки
  с `dev` конфликтовало → задача вернулась в `S6-in-progress` техническим
  возвратом **до запуска ревью кода** («зелёный вердикт в силе, переделывать
  работу не нужно… осталась не правка кода, а ребейз»,
  issuecomment-6380699974);
- после ребейза новая попытка слияния снова конфликтовала (`docs/STATUS.md`,
  `docs/testing-notes/mutation-browser-guards.md`) против только что принятого
  #1057 → второй технический возврат **тоже без прогона ревью**
  (issuecomment-6380934... «Ревью не запускалось… код никто не читал, цикл не
  израсходован»);
- после разрешения конфликта ветка получила точный материал `f591799af`.

Оба возврата — не находки ревью, а чисто интеграционные конфликты (§2.10:
«ребейз — другой код, принимать без проверки нельзя»), поэтому раунд всё
равно требуется, но по существу это проверка дельты слияния, а не повторный
разбор фичи.

## Дельта с r1: пусто для собственного кода #1004

Прямое сравнение дерева:

```
git diff cec6d9f73..f591799af -- \
  src/hp-zigbee-topology-overlay.ts src/zigbee-topology-endpoint.ts \
  src/device-hit-owner.ts src/led-strip-runtime.ts \
  test/zigbee-topology-endpoint.test.mjs test/zigbee-provider-routes.test.mjs \
  test/zigbee-mapping-memo.test.mjs demo/smoke_zigbee_led_topology.mjs \
  demo/golden/zigbee-led.mjs
```
→ 0 строк. Все файлы, которые несут риск по четырём заявленным классам
(geometry/touch/devices/perf), байт-в-байт совпадают с материалом r1. Это
подтверждает и повторяющиеся номера строк в блоке риска текущего прогона —
они идентичны строкам, уже разобранным в r1 (523/527/530/532/534;
332-удалена/350/378; 282/388/389; 221-удалена/237/238; 51/55).

`docs/release-ledger/v1.82.0/1004.json` и обе записи `docs/CHANGELOG(.ru).md`
по #1004 — без изменений с r1 (проверено построчным диффом).

Полный список изменившихся с r1 файлов (`git diff --stat cec6d9f73..f591799af`,
20 файлов) принадлежит трём источникам, ни один не является собственным кодом
#1004:
- документ ревью `docs/reviews/CODE-REVIEW-1004-r1.md` (сам артефакт r1);
- слияние уже принятого #1054 (`src/houseplan-card.ts` +13/−2,
  `demo/smoke_detached_authority.mjs`, 3 новых мутанта
  `*-1054` в `scripts/mutation-registry.mjs`, собственная запись
  `docs/release-ledger/v1.82.0/1054.json`, собственная строка changelog
  `(#1054)`) — всё это код отдельной задачи со своим зелёным
  `CODE-REVIEW-1054-r1.md`, уже смержен в `dev` (`origin/dev` указывает на
  коммит, включающий эту ветку) и ранее прошёл свой код-ревью. Прочитан
  затронутый фрагмент `houseplan-card.ts:577-607,2805-2834` — изменения
  касаются логики `_read`/`authorityChanged` при detach/reattach HA и не
  пересекаются с Zigbee-топологией ни по символам, ни по файлам;
- слияние уже принятого #1057 (`tests_backend/test_trail_recorder*.py`,
  `docs/reviews/CODE-REVIEW-1057-r1.md`, `docs/release-ledger/.../1057.json`)
  — тестовая изоляция загрузчика trail recorder, Python/backend, никак не
  пересекается с LED/Zigbee кодом;
- регенерируемые счётчики `docs/STATUS.md` (строки тестов 5202→5206,
  429→430 — рост от `test_trail_recorder_imports.py`/
  `smoke_detached_authority.mjs`, не от #1004) и
  `docs/testing-notes/mutation-browser-guards.md` (категория «Custom-element
  and HA browser lifecycle» 246→249, итог 496→499 — ровно +3 новых мутанта
  `*-1054`; собственные категории #1004, зафиксированные в r1 как 85/97/57 —
  без изменений).

Обе merge-коммита, произведшие дельту, несут корректные трейлеры:
```
c1d644828 Merge accepted dev 98e7 into issue/1004-led-zigbee-topology
  Issue: #1004
  User-Visible: no
0f27058af Merge official #1004 CODE r1 review document
  Issue: #1004
  User-Visible: no
f591799af Merge accepted #1057 into #1004 after technical STATUS return
  Issue: #1004
  User-Visible: no
```
Корректно: сами эти слияния не добавляют новое видимое поведение от #1004
(новая строка changelog `(#1054)` принадлежит и была добавлена коммитом самой
задачи #1054 до слияния, не этим мерджем).

## Риск по изменённым участкам (#707) — без изменений с r1

| Класс | Токены/строки | Покрыто AC |
|---|---|---|
| geometry | `hp-zigbee-topology-overlay.ts:523,527,530,532,534` (`thickness`) | AC2, AC3, AC6 |
| touch | `hp-zigbee-topology-overlay.ts:350,378` (`pointerdown` на `_eventRoot`); 332 — удалена при переносе слушателя | AC6 |
| devices | `device-hit-owner.ts:282,388,389` (`.led-hit[data-hp="device"][data-id]`) | AC2, AC5 |
| perf | `hp-zigbee-topology-overlay.ts:237,238` (221 — удалена), `zigbee-topology-endpoint.ts:51,55` (`getComputedStyle`, `getBoundingClientRect`) | AC7 |

Все четыре класса — идентичный код, идентичное покрытие AC, что и в r1.
Маршрут: `fix` (не `show`, трек и так `ask`; реклассификация не требуется).

## Как проверялось

Принятый `validate-gate` на точном материале раунда:
`https://github.com/Matysh/houseplan-card/actions/runs/40071278190`,
`headSha = f591799af9c00fa5f2b7a94f87adcd8577f991d0` (сверено `gh run view`),
`conclusion: success`. Покрывает `npm run gate:small`-эквивалент и общий
typecheck/build/bundle-sync на объединённом (с #1054/#1057) дереве —
job «Фронтенд: типы, юниты, мутанты, синхрон бандла» реально выполнился
(`success`, не `skipped`), подтверждая отсутствие конфликтов типов/сборки
между #1004 и влитым #1054. Job «Переиспользование: это дерево уже
проверено» — `success`: браузерные смоки и Golden-сцены переиспользованы
(`skipped` с валидным receipt), а не пропущены без основания — ожидаемо,
поскольку дерево путей `src/**`/`demo/**`/`test/**`, которые смоки/Golden
покрывают, идентично уже провалидированному дереву r1. Job «Доказательство
выполненных проверок» — `success`.

Адресно (сверх принятого прогона), в этом раунде:
- побайтовое сравнение всех файлов из риск-таблицы между `cec6d9f73` (r1) и
  `f591799af` (r2) — 0 различий (см. выше);
- `git diff --stat cec6d9f73..f591799af` — построчная атрибуция каждого из
  20 изменившихся файлов к #1054/#1057/служебному документу r1, ни одного
  файла #1004;
- `docs/release-ledger/v1.82.0/1004.json`, `docs/CHANGELOG.md`,
  `docs/CHANGELOG.ru.md` (записи `#1004`) — сверены построчно с r1,
  без изменений;
- трейлеры всех некоммитированных в r1 коммитов (`c1d644828`, `0f27028af`,
  `f591799af`) — `Issue: #1004`, `User-Visible: no` на всех трёх (нового
  пользовательского поведения эти слияния не добавляют);
- фрагмент `src/houseplan-card.ts:570-610,2800-2835` (привнесённая #1054
  правка) прочитан целиком на предмет пересечения символов/файлов с
  Zigbee-топологией — пересечений нет;
- `gh run view 40071278190 --json headSha,conclusion` — SHA и статус сверены
  напрямую, не из текста хендоффа.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где видно |
|---|---|---|
| (находок High/Medium не было) | — | r1 вердикт зелёный, High 0 / Medium 0 |
| Low: формулировка атрибуции «owner's explicit permission from queue assignment» без проверяемой ссылки (не блокировала) | Не затронута этим раундом: `docs/DEVELOPMENT.md`/измерение бандла с r1 не менялись (0 строк дельты в зоне #1004) | `git diff cec6d9f73..f591799af -- docs/DEVELOPMENT.md` — изменений от #1004 нет (новые абзацы в файле — от #1054/#1057 секций, не пересекаются) |

Оба технических возврата между r1 и r2 (конфликт с продвинувшимся `dev`,
затем конфликт `docs/STATUS.md`/`docs/testing-notes/mutation-browser-guards.md`
с #1057) — не находки код-ревью, ревью кода между ними не запускалось
(это прямо зафиксировано ботом-владельцем в issue), цикл не тратился.

## Унаследовано из r1

Без повторной проверки в этом раунде, по `CODE-REVIEW-1004-r1.md`,
материал `cec6d9f735022efea969f7dadf6bf390b5343171` — всё содержательное
покрытие AC1–AC8, поскольку код не изменился ни на строку:
- таблица «AC · witness · чем краснеет» для AC1–AC7 и 4 зарегистрированных
  мутанта (`zigbee-led-svg-endpoint-dropped-1004`,
  `zigbee-led-first-vertex-anchor-1004`, `zigbee-led-halo-below-body-1004`,
  `zigbee-led-retired-path-keeps-hover-1004`), все честно «не исполнялся»;
- разбор `_markerClearance`/анизотропного зума, вырожденного случая
  origin==destination, `readZigbeeLedEndpoint` guard-цепочки,
  `_eventRoot`-расширения слушателей, CSS-подмены `led-strip-runtime.ts`,
  `_currentGeometryKey` только по `_desiredEndpointIds`;
- негативный юнит «virtual LED не заимствует radio identity» (AC5);
- i18n-формулировки `ARCHITECTURE.md`/`DEVICE-PRESENTATION.md`/
  `UX-MODES.md`/`USER-GUIDE(.ru).md` («ориентир на плане, не физическое
  положение контроллера»);
- обоснование `bundleBytes`-роста (+5082 B) прецедентом ~15 аналогичных
  `chore(monolith)`-коммитов, абсолютные потолки не тронуты;
- `release-ledger` классификация `stable-fix` с обоснованием относительно
  `v1.82.0`; `introducedBy` не требуется;
- `demo/smoke_zigbee_led_topology.mjs` прочитан целиком, honest RED on
  `origin/dev`-базе заявлен автором.

## Находки

Находок High или Medium (в скоупе или вне скоупа) не обнаружено. Low из r1
остаётся как было — не блокирует, не открывает цикл, этим раундом не
затронут (см. таблицу закрытия выше).

Побочных находок, подпадающих под `REVIEW_FINDINGS_POLICY`
(`mode: issues`), нет — новые issue не заводятся.

## Что проверено и корректно

- Весь собственный код #1004 (geometry/touch/devices/perf классы риска)
  идентичен уже принятому в r1 материалу — байт-в-байт, с подтверждением
  `git diff`.
- Интеграция с параллельно смерженными #1054/#1057 не создаёт конфликтов на
  уровне типов/сборки: job «Фронтенд: типы, юниты, мутанты, синхрон бандла»
  выполнился (не переиспользован) на объединённом дереве и прошёл.
- Оба merge-коммита дельты несут корректные `Issue:`/`User-Visible:`
  трейлеры; новой пользовательской видимости от самих слияний нет.
- `docs/release-ledger/v1.82.0/1004.json` и записи changelog `#1004` не
  изменились и остаются согласованными с r1.
- Регенерируемые счётчики (`docs/STATUS.md`, `mutation-browser-guards.md`)
  изменились ровно на величины, которые объясняются содержимым #1054/#1057
  (3 новых мутанта, +4/+1 теста) — без расхождений.
- `validate-gate` на точном материале раунда (`f591799af`) зелёный,
  `headSha` сверен напрямую через `gh run view`, не только по тексту
  хендоффа.

## Чего не проверял

- Не повторял `npm run gate:small`, `tsc`, `npm run build`, браузерные
  смоки и Golden — переиспользованы по принятому `validate-gate`
  (`runs/40071278190`, `success`, тот же SHA) и по обоснованному
  tree-reuse (job «Переиспользование: это дерево уже проверено»,
  `success`): дерево путей, которые эти проверки покрывают, не изменилось
  со времён r1 для #1004.
- Не проверял корректность самих изменений #1054
  (`src/houseplan-card.ts` detach/reattach-логика) и #1057 (Python-изоляция
  trail recorder) по существу — это код отдельных задач со своими
  собственными зелёными код-ревью (`CODE-REVIEW-1054-r1.md`,
  `CODE-REVIEW-1057-r1.md`); проверил только отсутствие пересечения
  символов/файлов с зоной #1004.
- Не исполнял зарегистрированные мутанты `*-1004` и не делал ручных патчей
  продукта — политика #905; для «чем краснеет» по-прежнему достаточно id
  зарегистрированных свидетелей с честным «не исполнялся» (не изменилось
  с r1, т.к. код не менялся).
- `pytest tests_backend` не запускал — диффа в Python от #1004 по-прежнему
  нет (изменения `tests_backend/*` в этой дельте принадлежат #1057).
- `node scripts/invariants.mjs` не запускал — геометрия модели комнат/стен
  не затронута ни #1004, ни слитыми изменениями (причина не изменилась
  с r1).
- Реальный GPU/браузерный просмотр двух Golden PNG (`zigbee-led-flat-light`,
  `zigbee-led-iso-dark`) не проверял — приёмка базовых эталонов принадлежит
  бете, не этому ревью.

## Вердикт

Содержательной дельты в собственном коде #1004 со времён зелёного r1 нет —
оба промежуточных возврата были чисто техническими конфликтами слияния с
`dev`, зафиксированными самим конвейером/владельцем, без запуска ревью между
ними. Интеграция с параллельно принятыми #1054/#1057 подтверждена зелёным
`validate-gate` на точном материале раунда. High/Medium не найдено.

**Вердикт: зелёный · заход r2 · блокирующих циклов 0/4 · High: 0 · Medium: 0 → в задаче**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1004-led-zigbee-topology`, коммит `f591799af9c0` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `b7bafa14cad6f3ce9da66242fa565f8e159bf34f`
  ```
  git log --all --format='%H %T' | grep b7bafa14cad6
  ```
- Тело issue: `d4054e55d1be25adaa2ddd3ac49e398212cfea41397217fe620fb8524bd2c034`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUyMTMsIm91dHB1dF90b2tlbnMiOjI0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MzMzfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo0Miwib3V0cHV0X3Rva2VucyI6MjEzMDUsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6NzkwMTUsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxNTMwNjAwLCJjb3N0VXNkRXN0aW1hdGUiOjAuODM1MzEzOTk5OTk5OTk5OX1dLCJ0dXJucyI6MjYsImR1cmF0aW9uTXMiOjI1NDUxMywiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuODQwNjQ2OTk5OTk5OTk5OSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5255 output_tokens=21329 cache_creation_input_tokens=79015 cache_read_input_tokens=1530600 num_turns=26 -->
