# CODE-REVIEW #974 · r1

**Материал:** `dc41ae8d9e564e8f8296c4acf30c8109dd811628` (origin/dev..HEAD = этот один коммит)
**Трек:** show · **Заход:** r1 · блокирующих циклов использовано 0 из 2

## Скоуп

Ночной полный мутационный прогон (shard 14, run 39374393552, `dev`@`f34e6a6f488d`)
нашёл сбежавший мутант `vacuum-native-late-delete-resurrects-run`: тест
`test_full_snapshot_book_lifecycle_budget_restart_and_private_projection`
оставался зелёным даже при удалённой проверке generation в
`TrailBook.on_snapshot` (`custom_components/houseplan/trails.py:378`), потому
что и до, и после удаления проверки отрицательный вызов возвращал `False` по
не связанной с generation причине (повторный digest/revision у `foreign-generation`;
отсутствие `current` у вызова после `delete`). Задача инфраструктурная
(PROCESS §1): правит только тестового свидетеля и сопроводительную
документацию, без единого файла класса A. Диапазон:

- `tests_backend/test_ha_vacuum_paths.py` — заменён negative-input в
  существующем AC1-кейсе на неповторный snapshot (новая геометрия, новая
  допустимая revision) + проверка неизменности `restarted.data`; добавлен
  новый параметризованный тест AC2
  `test_full_snapshot_book_lifecycle_late_predelete_reply_cannot_overwrite_new_run`
  (live / json-restart) на поздний ответ прежнего generation после
  delete/recreate с тем же marker/route/map/source.
- `docs/DEVELOPMENT.md`, `docs/STATUS.md` — фиксация причины прежнего
  ложного PASS и контракта свидетеля.
- `docs/release-ledger/v1.81.0/974.json` — `category: infra`.

Продуктовый код (`custom_components/houseplan/trails.py` и весь `src/**`) не
тронут — подтверждено `git diff --stat` (4 файла, все тест/документация/ledger).
Мутация (id/guard/patch) в `scripts/mutation-registry.mjs:2124-2131` не менялась.

## Как проверялось

- Прочитан `git diff origin/dev...HEAD` целиком (все 4 файла, оба изменённых
  теста построчно, с контекстом вокруг — весь блок
  `test_full_snapshot_book_lifecycle_*`).
- Прочитан `TrailBook.on_snapshot` (`trails.py:372-432`) и `same_run_identity`
  (`trails.py:51-70`) — порядок проверок: generation (`cur.get("_generation") !=
  generation`) проверяется **до** сверки digest/revision и до блока записи.
- Прочитана регистрация мутанта: `find: 'or cur.get("_generation") !=
  generation \\', replace: 'or False \\'` — мутант не трогает
  `same_run_identity`, только обнуляет генерационный терм условия.
- Логическая трассировка (чтением, не исполнением — мутант вне ночного
  workflow исполнять запрещено, #905) обоих негативных кейсов против
  мутированного условия:
  - AC1 (`late`, revision 3, геометрия `[[0,0],[300,0]]`, отличная от
    хранимой `fresher`/revision 2): на исходном коде `foreign-generation`
    отбивается в начале функции по generation, `restarted.data` не меняется.
    При обнулённой проверке generation поток проходит identity (route/map
    совпадают), ревизию (3 не меньше 2), digest отличается от сохранённого →
    код доходит до блока записи и переписывает `paths/_native_digest/
    _native_revision`, то есть `restarted.data == before` **упадёт** — тест
    чувствителен к мутации.
  - AC2 (`late`, revision 3, после delete/recreate с тем же marker/route/map):
    `old_generation` отличен от нового `generation` того же marker/route/map;
    на исходном коде отбивается тем же generation-термом с начала функции,
    `book.data == before` держится. При обнулённой проверке identity всё ещё
    совпадает (route="route", map="floor" у старого и нового run), digest
    `late` отличается от хранимого (`fresh`, revision 2) → код пишет данные
    нового run поверх, т.е. `book.data == before` **упадёт** — ровно сценарий
    `...resurrects-run`.
  - Оба вывода получены чтением кода и условий, не патчем файла/прогоном
    мутанта — соответствует разрешённому способу доказательства для
    защитного AC.
- Подсчитан охват `-k full_snapshot_book_lifecycle` по именам тестов в файле:
  ровно 3 совпадения (1 обычный + 2 параметризации) — совпадает с заявленным
  автором локальным прогоном «3 passed, 12 deselected».
- Проверен `scripts/backend-test-guard.mjs` — подтверждает, что guard реально
  запускает `pytest <file> -q -k <pattern>`, т.е. оба изменённых теста входят
  в тот же зарегистрированный guard мутанта.
- Проверен коммит `dc41ae8d9`: трейлеры `Issue: #974`, `User-Visible: no` —
  корректно, `docs/CHANGELOG*.md` не тронуты (и не должны быть).
- Проверен формат `docs/release-ledger/v1.81.0/974.json` против соседней
  инфра-записи `970.json` — совпадает (`schema`, `category: infra`,
  `rationale`), без `introducedBy` — обоснованно: это не правка новой
  бета-фичи, а ремонт существующего тестового свидетеля.
- Проверен `https://github.com/Matysh/houseplan-card/actions/runs/39379788553`:
  `headSha = dc41ae8d9e564e8f8296c4acf30c8109dd811628` (ровно материал),
  `conclusion = success`, джоб «Бэкенд: pytest в Home Assistant» —
  `success`; джобы golden/смоки/мутанты-по-диффу — `skipped` (ожидаемо: нет
  `src/**`, фронтенда и диффа в продуктовом Python). Это закрывает AC3 в
  части обычного backend-прогона на реальном harness и дешёвых гейтов
  (typecheck/test/build) без повторного прогона.
- Синтаксическая проверка (`python3 -m ast`) изменённого тестового файла —
  OK; полный pytest локально не запускался — в этом окружении нет
  `homeassistant`/`.venv-backend` (ожидаемо вне cloud-агента автора, см.
  раздел «Чего не проверял»).

## AC · чем доказан · чем краснеет

| AC | Доказано | Чем краредет (защитный AC) |
|---|---|---|
| AC1 — чужое generation отклоняет неповторный snapshot, данные не меняются; то же generation принимает тот же snapshot | `test_ha_vacuum_paths.py:204-209` (новый `late`, `before`/`after`-диф) | Отрицательный вход `foreign-generation` на неповторном snapshot; зарегистрированный `vacuum-native-late-delete-resurrects-run` (`mutation-registry.mjs:2124`) — здесь **не исполнялся**; логически воспроизведён чтением (раздел «Как проверялось») |
| AC2 — ответ прежнего generation после delete/recreate не затрагивает новый run того же marker/route/map/source, live и JSON-restart | `test_full_snapshot_book_lifecycle_late_predelete_reply_cannot_overwrite_new_run[live]` и `[json-restart]` | Отрицательный вход — сохранённый generation удалённого run против нового run с тем же identity; тот же зарегистрированный мутант — **не исполнялся**; логически воспроизведён чтением |
| AC3 — `npm run gate:small`, обычный backend-прогон в pinned Linux HA harness, статический `mutation-gate.mjs --check` зелёные | Validate run 39379788553 на точном SHA материала: job «Бэкенд: pytest в Home Assistant» = success; автор дополнительно привёл отдельный WSL-прогон guard'а и полного файла с SHA-256 изменённого файла, совпадающим с коммитом | — (не защитный AC, инфраструктурный гейт) |

Все три строки проверены и чтением реализации, и ссылкой на фактический
зелёный прогон именно этого SHA — не только заявлением автора.

## Находки

Находок нет — ни High, ни Medium, ни in-scope, ни out-of-scope.

Проверено отдельно и не вызвало замечаний:
- Порядок проверок в `on_snapshot` (generation → identity → digest/revision →
  запись) делает выбор нового `late`-snapshot в обоих тестах действительно
  необходимым и достаточным для изоляции именно generation-причины отказа —
  не случайный рефактор теста, а точное устранение описанной в issue причины
  пробела.
- `copy.deepcopy(...)` перед обоими негативными вызовами и честное сравнение
  всего `data` после — исключает ложное "не изменилось", если бы мутация
  затронула вложенный словарь по ссылке.
- Маршрут вердикта (§5): сложность/риск низкие (один тестовый файл + доки),
  одна поверхность (backend-тест на один guard), нет миграции конфига, нет
  нового UX-контракта, нет влияния на performance/touch, ожидаемое поведение
  зафиксировано в `docs/DEVELOPMENT.md`/`docs/STATUS.md` этим же коммитом и
  в PROCESS §2.7 (контракт защитного AC) — критерии reclassify не задеты,
  `route: fix`.
- Трейлеры и release-ledger (раздел «Как проверялось») — без замечаний.

## Чего не проверял

- Мутант `vacuum-native-late-delete-resurrects-run` не исполнял — ни
  ручным патчем `trails.py`, ни через `mutation-gate.mjs`: вне ночного
  workflow это запрещено (#905) даже ревьюеру. Эквивалент — логическая
  трассировка условия в разделе «Как проверялось».
- Полный `npx tsc --noEmit` / `npm test` / `npm run build` с сверкой трёх
  копий бандла — не перегонял: Validate на этом точном SHA зелёный (ссылка
  выше), правка не продуктовая, бандл не меняется.
- Полный `pytest tests_backend` локально в этой сессии не запускал — в
  рабочем окружении ревью нет `homeassistant`/`.venv-backend` (подтверждено
  `ModuleNotFoundError`). Опирался на job «Бэкенд: pytest в Home Assistant»
  того же Validate-прогона (success) и на отдельный прогон автора в реальном
  pinned Linux HA harness (WSL) с совпадающим SHA-256 изменённого файла.
- Браузерные смоки/golden — не выбраны диффом (нет `src/**`, нет изменений
  рендера/touch); `smoke-select` по этому диффу автором заявлен как
  «исполняемого frontend-диффа нет», что подтверждается составом diff --stat.
- Инварианты модели (`npm run invariants`) — не прогонял: диффа геометрии
  карточки нет, правка только backend-теста.
- Ночной полный мутационный прогон, который подтвердит новый caught — не
  запускал и не могу: это следующая плановая ночь по #709, не входит в
  объём ревью.

## Материал раунда

- SHA: `dc41ae8d9e564e8f8296c4acf30c8109dd811628`
- Дерево: `26c0b215814f8d0d321dcde9f376344813b5f115`
- Диапазон: `origin/dev..HEAD` = 1 коммит (`dc41ae8d9`)
- Validate на материале: https://github.com/Matysh/houseplan-card/actions/runs/39379788553 (success, headSha совпадает)

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/974-vacuum-late-delete-witness`, коммит `dc41ae8d9e56` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `26c0b215814f8d0d321dcde9f376344813b5f115`
  ```
  git log --all --format='%H %T' | grep 26c0b215814f
  ```
- Тело issue: `e3610ba0e3635a6cf1441e34c46fca970658eb2523ef45f1e3fb31e8e85a9e09`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMDMsIm91dHB1dF90b2tlbnMiOjE0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTczfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo1OCwib3V0cHV0X3Rva2VucyI6MjE4MDUsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6ODAyNjMsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoyMDMzODkwLCJjb3N0VXNkRXN0aW1hdGUiOjAuOTQ1OTk2fV0sInR1cm5zIjozNiwiZHVyYXRpb25NcyI6Mjc1MDAwLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MC45NTExNjksImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5161 output_tokens=21819 cache_creation_input_tokens=80263 cache_read_input_tokens=2033890 num_turns=36 -->
