# CODE-REVIEW-822-r1

Issue: #822 · Трек: `track:show` · Заход: r1 · Этап: code
Материал: `02f12245d5a99a7e523f031015e71f693a0ce8f8` (рабочая копия на нём, `git rev-parse HEAD` сверен)
Диапазон: `0dcf4d98..02f12245` (2 коммита: `6c00fe69` fix, `02f12245` test)

## Скоуп

Один endpoint `houseplan/space/delete`, общая чистая функция
`_space_delete_candidate` (`custom_components/houseplan/websocket_api.py:1853`):
явные `marker.vacuum.map_routes[]`, указывающие на удаляемое пространство,
теперь вырезаются внутри уже ревизионно-защищённой атомарной пары
config/layout — исполнение существующего контракта #162
(`docs/VACUUM.md`, «Maps and floors», строка 99: «deleting a space removes the
routes that pointed at it… leaves the dock and the other routes alone»), ранее
исполнявшегося только тестовым TS-зеркалом `createSpaceDeletionCandidate`.
Диалоговые тексты, i18n, схема/миграция, UI/touch — не тронуты. Соответствует
диапазону и границам ТЗ в теле issue дословно.

## Риск по изменённым участкам (#707)

Единственный класс — **devices** (`websocket_api.py:1883-1891`, вставка внутри
цикла по маркерам `_space_delete_candidate`). Поведение зафиксировано заранее:

- `docs/VACUUM.md` «Maps and floors (#162)», строка 99 — сам контракт («routes
  that pointed at it» снимаются, док и прочие маршруты не трогаются) существовал
  до этой задачи;
- `docs/VACUUM.md`, новый абзац строки 104-109 (этот же коммит) — что именно
  делает `_space_delete_candidate` сейчас (hidden/removed, последнее
  пространство, `[]` вместо отсутствия поля);
- AC1/AC3 тела issue — построчная спецификация того же поведения с указанием
  доказательства и мутанта.

Критерии §5 (route: fix, не reclassify):
- `complexity` — 10 строк в одной функции, анализ владельца «сложность 3/10,
  риск 3/10» подтверждён чтением: фильтрация без побочных структур;
- `surfaces` — один endpoint, один модуль, диалог/i18n не меняются;
- `migration` — нет схемы/версии/новых compatibility-полей; `CONFIG_SCHEMA`
  прогоняется по-прежнему, бизнес-валидатор `validate_marker_vacuum_routes`
  путь `space/delete` не вызывает — как и раньше, не новое поведение;
- `ux-contract` — текст подтверждения не менялся, контракт уже описан #162;
- `perf-touch` — проход внутри уже существующего `for marker in …` только при
  явном удалении пространства, не per-frame, фронт не тронут;
- `undocumented` — ожидаемое поведение зафиксировано заранее (см. выше),
  задача не вводит нового решения, только устраняет расхождение сервера с уже
  описанным контрактом.

Вывод: `route: fix`.

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate на этом SHA
(https://github.com/Matysh/houseplan-card/actions/runs/37662973493,
`conclusion: success`, джоба «Бэкенд: pytest в Home Assistant» —
`success`, т.е. реальный HA-прогон `tests_backend/` уже зелёный на материале).
Перегонять `tsc`/`npm test`/`npm run build` не стал — фронтенд в диффе не
тронут вовсе (`src/**` нет в `git diff --stat`).

Самостоятельно прогнано (дёшево, по диффу и AC):

| Команда | Результат |
|---|---|
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет… смоки не выбираются», 9 файлов — совпадает с заявлением автора |
| `node scripts/mutation-gate.mjs --check` | PASS; оба новых якоря (`space-delete-server-keeps-vacuum-routes`, `space-delete-server-revives-legacy-routes`) — `ok`; browser guards 267/200 (не выросли, это не browser-мутанты) |
| `node scripts/process-gate.mjs --range origin/dev..HEAD --issues` | PASS, 2 коммита, 0 предупреждений |
| `gh run view 37662973493 --json jobs` | обе релевантные job (`HACS: валидация репозитория`, `Бэкенд: pytest в Home Assistant`) — `success` |
| Статический поиск `'vacuum\["map_routes"\] = kept_routes'` | ровно одно вхождение — патчи обоих мутантов бьют уникальную строку, не пересекаются |

Мутанты не исполнялись (развитие — только статика, ловлю проверяет ночь,
#709) — соответствует треку show.

## Разбор AC (чтением, с опорой на зелёный HA-прогон)

**AC1** (успешное удаление чистит только свои маршруты). Код:
`websocket_api.py:1881-1891` — фильтрация выполняется безусловно для
**каждого** маркера цикла, в том числе `hidden`/`removed` (условие
`removed is not True` стоит ниже, для другой ветки логики, и не пропускает
фильтр маршрутов). Тест
`test_issue_822_space_delete_commits_only_its_routes` (`remove_markers`
False/True) сверяет весь `config/get` целиком против вручную отфильтрованного
`expected`, плюс `layout`, `rev +1`, ровно одно событие на шину, `removed_markers`
и неизменное состояние `vacuum.robot`. На коде без фильтра (`pass` вместо
`vacuum["map_routes"] = kept_routes`, см. мутант
`space-delete-server-keeps-vacuum-routes`) `expected` в тесте по-прежнему
вычисляется отфильтрованным, а реальный `config` — нет: `assert config["config"]
== expected` обязан покраснеть. Тест умеет падать — подтверждено чтением, не
исполнением (HA-окружения в ревью-сессии нет), но независимо подтверждено
прогоном настоящего pytest в Validate на этом SHA (job выше). AC1 — доказан.

**AC2** (отказы ничего не чистят). `ws_space_delete` возвращает ошибку до
`_commit_pair` при `space_in_use`/конфликте ревизий/`space_not_found`
(`websocket_api.py:2077-2103`) — `_space_delete_target` вызывается раньше
проверки `dependencies`, но работает на `json.loads(json.dumps(...))`-копиях
(`_space_delete_candidate` строки 1857-1858), исходные `current_config`/
`current_layout` не мутируются ни при каком исходе. Тест
`test_issue_822_refused_delete_preserves_routes_and_revisions`
(4 параметра) сравнивает `_read_pair(client) == before` целиком. AC2 — доказан.

**AC3** (последнее пространство, явный `[]`, legacy calibration). Строки
1905-1908: при `deleting_last_space` маркер отвязывается от пространства, но
фильтрация маршрутов (1884-1891) уже отработала раньше и безусловно —
попадание в `[]` гарантировано списковым включением, а не удалением ключа.
Мутант `space-delete-server-revives-legacy-routes` специально проверяет именно
разницу между `[]` и отсутствующим ключом (`vacuum.pop("map_routes", None)`)
— без него опустевший список воскресил бы retained legacy calibration через
существующий fallback резолвера (описан в `docs/VACUUM.md` «Calibration»).
Тесты `test_issue_822_last_space_keeps_explicit_empty_routes` (оба
`remove_markers`) и `test_issue_822_candidate_preserves_unrelated_and_legacy_routes`
(5 чистых case: отсутствующий массив, `null`, уже пустой, чужой orphan,
только legacy-калибровка) покрывают оба направления. AC3 — доказан.

Таблица «AC · чем доказан · чем краснеет» (воспроизвожу проверку из
комментария автора, пустых столбцов нет — находки Medium по §2.7 отсутствуют):

| AC | Доказательство | Мутант/негатив |
|---|---|---|
| AC1 | `test_issue_822_space_delete_commits_only_its_routes[False/True]`, полный `config/get` | `space-delete-server-keeps-vacuum-routes` (якорь `ok`) |
| AC2 | `test_issue_822_refused_delete_preserves_routes_and_revisions[4 случая]` | негативные случаи в самом тесте |
| AC3 | `test_issue_822_last_space_keeps_explicit_empty_routes[False/True]` + 5 compatibility-кейсов | `space-delete-server-revives-legacy-routes` (якорь `ok`) |

## Трейлеры и changelog

`6c00fe69`: `Issue: #822`, `User-Visible: yes` — `docs/CHANGELOG.md` и
`docs/CHANGELOG.ru.md` правятся в этом же коммите (проверено `git show
--stat`). `02f12245`: `Issue: #822`, `User-Visible: no` — изменения только в
тесте и `docs/DEVELOPMENT.md`, changelog не требуется и не тронут. Формат
совпадает с `PROCESS.md` §3 п.10.

## Одно число — один источник (§8)

Диффом не вводится и не дублируется ни одна новая пользователю видимая
величина: счётчик «сопоставление карт роботов: N» в диалоге подтверждения не
менялся (фронтенд не тронут) и остаётся на прежнем единственном источнике
(`src/space-deletion.ts` зеркало); серверная сторона теперь просто исполняет
то же число фактическим удалением записей, не считая его заново для показа.

## Что проверено и корректно

- Фильтрация безусловна для всех маркеров независимо от `hidden`/`removed` —
  соответствует AC1 буквально.
- Порядок и поля оставшихся маршрутов не трогаются (список-включение не
  модифицирует элементы), root `vacuum.source/trail_mode/calibration` и
  позиция/привязка дока не затрагиваются — тест сверяет это явным diff
  ожидаемого конфига.
- Мутации происходят на уже продублированных (`json.loads(json.dumps(...))`)
  структурах — никаких побочных эффектов на вход при отказах.
- `_space_delete_target` (путь #819 `remove_markers`) не меняет и не обходит
  новую фильтрацию: она отрабатывает внутри `_space_delete_candidate`
  независимо от того, вызывается ли предварительное удаление маркеров.
- Запись реестра мутаций (`scripts/mutation-registry.mjs`) синтаксически и по
  формату идентична соседним записям; `guard` использует существующий
  `backend-test-guard.mjs` с явным третьим аргументом (тестовым файлом) —
  обычная практика для backend-мутантов.

## Что не проверял и почему (трек show, узкий объём §8)

- Не перегонял `npx tsc --noEmit` / `npm test` / `npm run build` —
  фронтенд (`src/**`) в диффе не изменён вовсе, а дешёвые гейты уже зелёные на
  этом точном SHA (ссылка на Validate выше).
- Не запускал `pytest tests_backend/` сам — в этой ревью-сессии нет pinned
  HA-окружения (`homeassistant` не установлен, `.venv-backend` отсутствует);
  опираюсь на зелёный прогон той же самой джобы Validate на материале
  `02f12245` плюс разбор кода/теста на предмет «умеет падать» (раздел выше).
- `golden:verify` не запускал: `ci:golden` не проставлен, рендер плана не
  тронут — запись в этот раздел, не гейт задачи.
- `npm run invariants` не запускал: геометрия плана/ссылки на неё не менялись
  (только удаление элементов списка `map_routes` и позиций layout,
  существовавшее до этой задачи поведение).
- Полный `mutation-gate` прогон (исполнение мутантов) не делал — на `show`
  мутанты в разработке не гоняются никем, ловлю проверяет ночной прогон
  (#709); проверил только статические якоря (`--check`), оба новых — `ok`.
- Ручного/браузерного смока не делал — `smoke-select` сам подтвердил, что
  выбирать нечего (frontend-дифф отсутствует), а issue не называет frontend
  smoke.

## Находки

Одна находка Low, не блокирует, цикла не открывает (трек show: Low — не
дефект поведения и не невыполненный AC):

- **Low · документация вне скоупа диффа.** `test/fixtures/space-delete-with-markers.json:3`
  всё ещё утверждает: «Stairs and robot map routes are left out on purpose:
  the two candidates treat them differently today». После этой задачи
  утверждение про `map_routes` больше не верно — сервер теперь фильтрует их
  так же, как TS-зеркало (`src/space-deletion.ts` строки 164-172, не
  изменённые этой задачей, но уже совпадающие); расходится только обработка
  `stairs`, которую фронтенд-зеркало не трогает вовсе
  (`grep -n stair src/space-deletion.ts` — пусто) против серверной нуллификации
  `target_space_id` (`websocket_api.py:1877-1880`, вне диапазона этой задачи).
  Комментарий — чисто описательный (`"about"` в JSON-фикстуре, не участвует в
  логике теста), пользователю не виден, ни один AC его не требует обновлять, и
  ТЗ прямо ограничивает скоуп backend+docs/VACUUM.md. Оставляю как отметку, не
  как Medium: поведенческого дефекта или невыполненного AC здесь нет.

Находок High и находок Medium в скоупе — нет. Находок Medium вне скоупа,
требующих отдельного issue, — нет.

## Вердикт

Зелёный. AC1-AC3 доказаны реальным HA-тестом (зелёный Validate на точном SHA
материала) и статическим мутационным якорем; защитные AC имеют непустую
колонку «чем краснеет»; трейлеры и changelog в порядке; риск по изменённому
участку (devices) заранее зафиксирован в `docs/VACUUM.md` и AC issue — трек
show не повышается.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/822-vacuum-route-cleanup`, коммит `02f12245d5a9` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `12e168741eb17c8752959821dec1b84715fc2e7d`
  ```
  git log --all --format='%H %T' | grep 12e168741eb1
  ```
- Тело issue: `1dabf13752c309613110eccecc8f326f894917dfd26eb5c21c3fe79b00930b72`
- Вердикт конвейера: `green` · High 0 · маршрут `fix` (критерий `undocumented`)
<!-- hp:usage input_tokens=4640 output_tokens=21704 cache_creation_input_tokens=88023 cache_read_input_tokens=3111974 num_turns=47 -->
