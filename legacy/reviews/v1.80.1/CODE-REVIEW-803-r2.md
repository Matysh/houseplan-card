# CODE-REVIEW-803-r2

Материал раунда: `f556c1e2b6f20c6deed063dafdd26dd417627c93` (ветка `issue/803-wall-node-move`,
`HEAD` detached на этом SHA). Трек `ask`, этап code, заход r2, блокирующих циклов
израсходовано 1/4. Маршрут вердикта предопределён промптом: `route: fix`.

## Скоуп раунда

Предмет — дельта к r1, а не задача целиком (PROCESS §2.10). Материал r1
(`7e759aa9c7bc330a5775ff6bbc2fb7f43b1eaea4`) не резолвится ни как коммит, ни
его дерево (`b0ebd50de9e102d30120c260f1da6f887969ca11`) — это обычное дело
(ветка была перебазирована на `dev` после интеграции #814 с
`--force-with-lease`, что меняет хэши коммитов при неизменном содержимом), а
не находка. Эквивалентная по содержимому точка найдена по дереву: коммит
`8972e443` (`fix(build): guard all eager entry edges after node chunking`) —
непосредственный предок коммита `13cc59b9` (`docs: review document for #803`,
добавляющего `CODE-REVIEW-803-r1.md` без других изменений), то есть ровно та
точка, на которой писался r1. Дельта ревью — `git diff 8972e443..f556c1e2`
(21 файл, 627+/78-), это 6 коммитов:

```
92c3dacc fix(editor): close noisy node, snap and host-proof review gaps (#803)
1a6bd39a fix(editor): retain exact axis and HV point intersections (#803)
cf4a28f8 fix(backend): normalise legacy inputs for node host proof (#803)
7597554c fix(backend): make node proof pairing explicitly strict (#803)
d45cc266 fix(editor): scope retired node click tails to pointer stage activation (#803)
f556c1e2 refactor(editor): share unchanged node ghost templates within bundle budget (#803)
```

Сомнения в локальности дельты нет: все шесть коммитов — точечные правки
ровно тех мест, что назвал r1 (H1/M1–M4), плюс один поведенчески-нейтральный
рефакторинг бандла после интеграции #814. Новой подсистемы, смены контракта
или расхождения с AC нет — полный повторный разбор всего ТЗ не требуется,
разбирается дельта и то, что она задевает (AC2–AC4, AC8, AC10, AC11, AC6/AC7).

## Как проверялось

**Гейты, уже подтверждённые на этом SHA (не перегонялись повторно):**
`npx tsc --noEmit`, `npm test`, `npm run build` + `bundle-policy --verify` —
зелёный exact-SHA Validate
[37687638568](https://github.com/Matysh/houseplan-card/actions/runs/37687638568),
`conclusion: success`, проверено `gh api .../runs/37687638568` лично
(`headSha` совпадает с материалом). Разобран список джобов этого прогона:
«Фронтенд: типы, юниты, мутанты, синхрон бандла» — success, лог подтверждает
`# tests 4062 / # pass 4061 / # fail 0` (1 todo/skip, не fail). «Golden-кадры
против принятых эталонов» и все 3 шарда «Смоки в браузере» — success, и
ключевая деталь: джоб «Переиспользование» показал `Cache not found` для
ключей `smoke`/`golden`/`performance_smoke`/`geometry_parity` — то есть эти
джобы на `f556c1e2` реально выполнились заново, а не переиспользованы по
старому содержимому; это прямое покрытие AC5/AC12 на точном материале, не
унаследованное доказательство.

Единственный джоб с `Cache hit` — «Бэкенд: pytest в Home Assistant»
(переиспользование #208, содержимое `custom_components/houseplan/**` +
`tests_backend/**` побайтово совпало с прогоном-источником). Это ожидаемо:
коммит `f556c1e2` — чисто фронтендовый рефакторинг, backend-дерево не
менялось с предыдущего коммита `d45cc266`. Источник переиспользования —
прогон [37682922691](https://github.com/Matysh/houseplan-card/actions/runs/37682922691)
на `head_sha e421df2d...` (не резолвится локально — та же пре-ребейз
ситуация): проверено лично через `gh api .../runs/37682922691` и
`.../jobs` — весь прогон завершён (`status completed, conclusion success`),
джоб «Бэкенд: pytest в Home Assistant» — `success`, лог подтверждает реальный
HA harness: `collected HA-harness tests: 489` (≥50 порог) и
`1145 passed, 1 skipped in 36.91s`. Это не «зелёный pytest без HA» — импорт
`homeassistant` и `test_ha_*.py` реально собраны и исполнены. (Соседний
прогон `37682951203` на том же SHA отменён параллельным триггером — к
прогону-источнику отношения не имеет.)

**Гейты, прогнанные лично в этом ревью:**
- `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs` — чисто,
  без ошибок.
- `node --test test/wall-node-move.test.mjs test/wall-node-editor.test.mjs` —
  **33/33 passed** на материале как есть.
- Проверка «тест умеет падать» для главной находки H1 выполнена
  исполнением, не декларацией: временно заменил `src/wall-node-move.ts` на
  версию r1 (`git show 8972e443:src/wall-node-move.ts`, добыто без fetch/pull,
  чисто из локального объектного хранилища дерева материала) и перегнал
  набор — **14 passed / 3 failed**, ровно три новых regression-теста красны:
  `noisy atomized T/X use one consistent angular classifier...`,
  `equal-distance H/V snap ties use stable wall ID...`,
  `an exact original-axis and H/V intersection outranks longitudinal
  quantisation`. Файл восстановлен обратно (`git checkout -- src/wall-node-move.ts`,
  сверено байт-в-байт с версией до эксперимента); рабочая копия чиста
  (`git status` пуст) — временная правка не просочилась в вывод.
- `node scripts/mutation-gate.mjs --check` — **exit 0**, 4 предупреждения
  (все три `--test-name-pattern` не совпадают из-за `${…}` в именах тестов,
  #650, плюс сводка `browser guards: 274/200`) — точное совпадение с числом,
  заявленным автором; ни одной новой непройденной привязки анкора. Все 11
  новых `node-*` id из `scripts/mutation-registry.mjs` (по H1/M1/M3/M4 и
  retired-tail) — `ok`.
- Содержимое диффа прочитано построчно: `wall-node-move.ts` ↔
  `wall_node_move.py` (TS/Python зеркальность предиката `parallel`/`_parallel`
  и `DIRECTION_EPS` побуквенно идентичны), `websocket_api.py` (замена
  циркулярного baseline на вызов `node_move_host_baseline`),
  `wall-node-editor.ts` (рефакторинг `nodeMask`/`nodePointText`/
  `nodeMasonrySelector` сверен построчно со старой версией — поведенчески
  тождественен, включая эквивалентность списка CSS-селекторов после
  вынесения общей части), `tests_backend/test_wall_node_move.py`,
  `tests_backend/test_ha_websocket.py`, доки (CANVAS/UX-MODES/
  CONFIG-COMPATIBILITY/ARCHITECTURE/DEVELOPMENT/STATUS/оба CHANGELOG/
  USER-GUIDE.ru.md).
- Трейлеры и changelog: все 6 коммитов дельты несут `Issue: #803`; у
  `User-Visible: yes` (`92c3dacc`, `1a6bd39a`, `cf4a28f8`, `d45cc266`) в том
  же коммите правки `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` — сверено
  `git show --stat` на каждый коммит.
- Риск по изменённым участкам из промпта сверен с AC/документами (трек
  `ask`, не `show`, но проверка всё равно выполнена): geometry → AC2–AC4/
  AC8/AC9; touch → AC1/AC14 + §9 ТЗ; migration → AC11; perf → AC13/§11;
  ux (новые i18n-ключи `node_move_*`) → §9 таблица ТЗ и AC14; devices —
  перепроверил сами строки `websocket_api.py:140/274/1495/1824-1825`: это
  не device-логика, а список регистрации команд и словарь capability
  (`wall_node_move_api: 1`) в общем монолите — риск-сканер пометил файл
  целиком по факту правки, а не по домену. ТЗ §2 отдельно фиксирует, что
  устройства за стеной намеренно не двигаются, — класс покрыт явным
  исключением, не пропуском.

**Чего не проверял:**
- `pytest tests_backend` не прогнан лично (нет установленного `homeassistant`/
  `pytest` в этом окружении, сети для установки тоже нет) — заменено на
  аудит реального CI-прогона с полным HA harness (см. выше), это не то же
  самое, что «verified» без команды, а прочитанный лог конкретного job
  конкретного run с конкретным результатом.
- Полный `npm run gate:small -- --smokes` (197/197 по заявлению автора) не
  перегонялся — браузерные смоки этого раунда покрыты фреш-прогоном Validate
  (см. выше); это дешёвый гейт, но требует Chromium-смок-раннер полностью, не
  только юниты, и уже зафиксирован зелёным на точном SHA.
- `node demo/benchmark_wall_node_drag.mjs` / `benchmark_wall_node_browser.mjs`
  (AC13) не перегонялись: дельта раунда не трогает бенчмарк-файлы и не меняет
  порядок сложности горячего пути (замена `cross`/`dot` предиката на другой
  constant-time предикат; новая `node_move_host_baseline` — тот же порядок
  операций, что и удалённый циркулярный код). Числа AC13 унаследованы из
  финального комментария автора без личного перезапуска — делаю это явно
  видимым, а не молчаливым.
- `node scripts/model-invariants.mjs --config ...` на экспортах автора
  (`artifacts/803-node/*.json`) не прогонялся — эти файлы не входят в
  коммит (ожидаемо, это одноразовые экспорты, не артефакт репозитория) и
  недоступны для воспроизведения без полного интерактивного жеста в
  браузере. Инвариантность геометрии дельты проверена чтением
  (`node_move_host_baseline` не трогает `wall_segments`/`partitions`
  напрямую, только `host.id` открытых проёмов после прохождения обычных
  `validate_partition_opening_hosts`/`validate_junction_limits`) и
  исполнением юнит/HA-тестов выше.
- Реальное ручное тестирование в браузере (мышь/golden-рендер глазами) не
  выполнялось — не требуется этим этапом; визуальная корректность
  подтверждена фреш-прогоном `golden` Validate на точном SHA.

## Закрытие находок r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **H1** (блокирует) — несогласованный угловой допуск: `EPS=1e-9` для группировки осей (cross) и `1-EPS` для проверки «проходящей» (dot) — допуски различались в ~44700×, из-за чего обычный T с реалистичным угловым шумом атомизированных плеч ошибочно получал `unsupported_junction` | Единый предикат `parallel(a,b) = abs(cross(a,b)) <= DIRECTION_EPS`, `DIRECTION_EPS = sqrt(2·EPS − EPS²)` (ровно прежний, уже принятый угловой допуск `dot>1-EPS` в терминах `cross`), применён И для группировки осей, И для учёта лучей — идентично в TS и Python | `src/wall-node-move.ts:39-43`, `custom_components/houseplan/wall_node_move.py:14-41`; новый тест `noisy atomized T/X ...` (TS) / `test_noisy_atomized_t_x_classification_and_exact_inverse` (Python) и общая parity-фикстура `test/fixtures/803-wall-node-parity.json` (`T/X-noisy-atoms[-reverse]`); лично подтверждено исполнением: откат к версии r1 даёт 3 красных теста, с фиксом — 33/33 зелёных |
| **M1** — тай-брейк равноудалённых H/V-целей зависел от позиционного индекса хранения стены (a/b-порядок), а не от стабильного wall ID | Сортировка целей: расстояние → приоритет → стабильный `wallRef`/`id` → числовой anchor `(x,y)` неподвижного конца — не зависит от a/b-порядка | `src/wall-node-move.ts:168-206`; тест `equal-distance H/V snap ties use stable wall ID then a/b-independent anchor`; мутанты `node-snap-omits-stable-wall-id-tie`, `node-snap-omits-same-wall-anchor-tie` зарегистрированы и проверены `mutation-gate --check` |
| **M2** — §13 ТЗ требовал CANVAS.md/UX-MODES.md в этом же change, оба не тронуты | CANVAS.md получил раздел «NODE-MOVE — constrained hybrid (#803...)» с полным контрактом магнитов/тай-брейков; UX-MODES.md получил полный Select-only hybrid-контракт (ghost/cancel/Undo/T/X); заодно RU-гайд поправлен на «Выбрать» (снятый Low r1) | `docs/CANVAS.md` (+28), `docs/UX-MODES.md` (+24), `docs/USER-GUIDE.ru.md:870` |
| **M3** — повторная серверная проверка rehost-идентичности проёмов была циркулярна: baseline заранее копировал `after_host["id"]` из кандидата перед сравнением | Новая `node_move_host_baseline()` выводит разрешённый host независимо — из ИСХОДНОГО `_classify` интервала/midpoint lineage и frozen carrier, без обращения к полям кандидата; `websocket_api.py` вызывает именно её вместо прежнего циркулярного блока | `custom_components/houseplan/wall_node_move.py:318-383`, `websocket_api.py:1860-1869` (замена блока); реальный HA-тест `test_issue_803_second_host_identity_gate_rejects_foreign_rehost` подменяет планировщик монки-патчем, который дописывает чужой host-id в кандидат, — WS реально отказывает (`node_move_invalid`), config/rev/events не меняются; лично проверено по логу CI-прогона `37682922691` (HA harness, 1145/1 skipped) |
| **M4** — нет фикстуры на легитимный слайд мимо постороннего узла на той же бесконечной прямой и на попытку обмена связностью между рёбрами | Два новых теста: `test_foreign_infinite_carrier_point_is_allowed_but_connectivity_exchange_is_not` (Python) и `carrier ignores foreign nodes beyond its finite interval...` (TS); мутанты `node-carrier-blocks-infinite-foreign-line`, `node-foreign-connectivity-exchange-allowed` | `tests_backend/test_wall_node_move.py`, `test/wall-node-move.test.mjs`, `scripts/mutation-registry.mjs` |
| Low (сняты, не образовывали цикл): термин «Select»→«Выбрать» в RU-гайде; нет отдельного теста на Esc-после-commit; нет явного zero-handle смока для Devices/Background | Все три закрыты попутно: RU-гайд правлен (см. M2); `demo/smoke_wall_node_move.mjs` получил `idle Esc after accepted move/Redo is not Undo and makes no write`; `demo/smoke_wall_node_topology.mjs` расширил zero-handle проверку на `view/devices/decor` (Background) | `docs/USER-GUIDE.ru.md:870`, `demo/smoke_wall_node_move.mjs:+12`, `demo/smoke_wall_node_topology.mjs:+7` |

Дополнительно, сверх названного в H1/M1–M4, автор закрыл два самостоятельно
найденных в процессе исправления дефекта того же изменения:
- точное пересечение исходной оси и неколлинеарной H/V-цели ранее подчинялось
  продольному квантованию сетки, хотя §5.4 ТЗ прямо требует точный приоритет
  такого пересечения над квантованием (коммит `1a6bd39a`, тест `an exact
  original-axis and H/V intersection outranks longitudinal quantisation`,
  мутант `node-snap-rounds-exact-constraint-intersection`);
- «хвост» подавления клика после завершённого/отменённого жеста глотал
  несвязанные клавиатурные (`detail=0`) и чужие (вне stage) активации —
  например, реальный Enter по кнопке «План» сразу после commit/Esc переставал
  работать (коммит `d45cc266`, тест `retired node tail blocks only compatible
  stage clicks...`, мутанты `node-click-tail-swallows-header`/`-keyboard`).

Оба — в скоупе того же изменения (не новая функциональность), оба со своим
красным-до/зелёным-после тестом и зарегистрированным мутантом; это не новые
находки этого ревью, а корректно задокументированная работа автора.

## Проверено и корректно

- H1/M1/M3/M4 закрыты по существу, а не формально: решения соответствуют
  задокументированному в ТЗ принципу («одна проходящая ось — один предикат»,
  «второй независимый ledger, не копирующий авторитет кандидата»), а не
  точечным патчам ради конкретных входных данных — подтверждено чтением и
  перепроверкой на реверсированных/перепутанных a-b входах в тестах.
- Угловой допуск гармонизирован переиспользованием уже принятого числа
  (прежний допуск проверки «проходящей»), а не изобретением нового магического
  значения — расширение допуска группировки (с ~1e-9 до ~4.47e-5 рад) не
  создаёт риска слияния реально различных направлений: это на 2-3 порядка
  меньше любого реалистичного намеренного угла между стенами.
- Рефакторинг бандла (`f556c1e2`) поведенчески нейтрален: построчно сверены
  `nodeMask`/`nodePointText`/`nodeMasonrySelector` со старой инлайн-версией —
  идентичная разметка маски, идентичный набор CSS-классов в селекторе
  (`querySelectorAll` с перечислением через запятую не зависит от порядка),
  устранено ровно дублирование (`affected`/`oldAffected` делили одну и ту же
  ветку вычисления).
- Трейлеры, оба changelog, мутант-реестр (`mutation-gate --check` exit 0,
  счётчик `274/200` совпал буква в букву с заявленным), CANVAS/UX-MODES/
  CONFIG-COMPATIBILITY/ARCHITECTURE/DEVELOPMENT/STATUS — обновлены
  согласованно и без противоречий между собой или с кодом.
- Единственное число, видимое в нескольких местах диффа и требующее явной
  сверки источника — угловой допуск `DIRECTION_EPS = sqrt(2e-9 − 1e-18)`:
  определён в TS и Python раздельно (нет общего файла-источника чисел в этом
  проекте), но оба определения через одну и ту же формулу от одной и той же
  позиционной `EPS=1e-9`, и зафиксирован третий раз текстом в CANVAS.md
  (`sqrt(2e-9 - 1e-18)`) — значения побуквенно идентичны, разошедшихся копий
  нет.

## Унаследовано из r1

Документ r1: [`CODE-REVIEW-803-r1.md`](https://github.com/Matysh/houseplan-card/blob/f556c1e2b6f20c6deed063dafdd26dd417627c93/docs/reviews/CODE-REVIEW-803-r1.md),
материал `7e759aa9c7bc330a5775ff6bbc2fb7f43b1eaea4` (не резолвится напрямую —
пре-ребейз SHA, см. «Скоуп раунда»; содержимое сверено по эквивалентному
`8972e443`).

Принято без повторной проверки в этом раунде (дельта их не касается):
классификация узла на точных неслучайных координатах (обычный/T/X на
«ровных» входах), полное доказательство Undo через весь документ (не только
геометрию), ACL/CAS/write-lock барьеры в их прежнем виде, физическое
расстояние проёма от неподвижного конца и сохранение его полей, carrier-freeze
для T/X на обычных входах, gating Select/canEdit/kiosk, атомарность истории,
golden/baseline-согласование до этого раунда, формулы §7 ТЗ. Найденные в r1
H1/M1–M4 **не** унаследованы как принятые — они перепроверены заново выше, а
не переоценены по заявлению автора.

## Вердикт

Все пять находок r1 (1 High + 4 Medium) закрыты по существу: проверено
чтением production-пути, воспроизведением регрессии на откаченном коде (H1) и
исполнением полного набора юнит-тестов (33/33) плюс реальным логом HA-harness
CI-прогона для серверной части (1145 passed/1 skipped, M3). Мутанты для всех
новых защит зарегистрированы и проходят `mutation-gate --check`. Рефакторинг
бандла в последнем коммите раунда поведенчески нейтрален. Новых находок при
разборе дельты не возникло.

Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/803-wall-node-move`, коммит `f556c1e2b6f2` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `b38340793d654e1273f0867eaef0571028e2d046`
  ```
  git log --all --format='%H %T' | grep b38340793d65
  ```
- Тело issue: `4b36ed06fd528b34e65c357a238a679e902341f9ec589c218a720ab326b8dcd1`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4850 output_tokens=45874 cache_creation_input_tokens=169549 cache_read_input_tokens=9437214 num_turns=83 -->
