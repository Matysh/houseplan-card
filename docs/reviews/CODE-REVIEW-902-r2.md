# CODE-REVIEW-902-r2

Материал: `fbb2af5fd5d3c110a0e419c940aeed4ca9ba8b08` (`origin/dev..HEAD` = 5
коммитов: `ccd0e6a5` fix, `2c47dfd6` refactor, `e1380ed4` test, `1fd3487f`
docs (CODE-REVIEW-902-r1.md), `fbb2af5f` test). Трек: `ask`. Заход r2,
блокирующих циклов израсходовано 1 из 4. Маршрут вердикта: `fix`.

Предыдущие SHA материала r1 (`de31e35e…`, `090a0b58`, `102a2e08`) в этом
дереве не резолвятся — обычное дело после ребейза (REVIEWER.md «Повторный
раунд»): те же три логических коммита (fix/refactor/test) присутствуют под
новыми хешами как `ccd0e6a5`/`2c47dfd6`/`e1380ed4`, их содержимое сверено по
дереву и дифф-стату, не по SHA.

## Скоуп

Делта r2 — ровно один коммит, `fbb2af5f`: ответ на единственную находку
CODE-REVIEW-902-r1 (Medium в скоупе, «чем краснеет» пустой для защитного
AC1 — реакция `layout-raced → queueMicrotask` re-arm на реальной карточке
не была доведена ни одним тестом дальше изолированного класса
`LayoutWriteReload`). Делта меняет только `test/layout-write-reload.test.mjs`
(+31), `scripts/mutation-registry.mjs` (+8, новая декларация) и
`docs/reviews/evidence-902/ordinary.md` (+31, доказательная запись).
`src/**`, `demo/**`, changelog, release-ledger — не тронуты: `git show
fbb2af5f --stat` подтверждает ровно эти 3 файла.

Это обслуживает тот же J6 («Keep the plan true as the home evolves»,
`docs/SCOPE.md`), что и исходная реализация — делта закрывает пробел в
доказательной базе того же механизма, нового поведения не добавляет.

Трейлеры коммита `fbb2af5f`: `Issue: #902`, `User-Visible: no` — верно,
видимого поведения делта не меняет. Оба changelog не нужны и не
редактировались.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Validate на материале | CI run [38764266919](https://github.com/Matysh/houseplan-card/actions/runs/38764266919) | подтверждён `gh run view` — `headSha=fbb2af5fd5d3c110a0e419c940aeed4ca9ba8b08`, `conclusion=success`; `tsc`/`npm test`/`npm run build`+bundle verify переиспользованы, не перегонял |
| Целевой юнит (личный прогон) | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/layout-write-reload.test.mjs test/coordinate-write-barrier-guard.test.mjs` | 39/39 PASS, raw exit 0, ~196 мс, включая новый `#902 r1 M1 actual card re-arms once after both reads overlap real released writes` |
| Статическая регистрация мутанта | `node scripts/mutation-gate.mjs --check` | PASS, raw exit 0; `definitions=1604` (было 1603 в r1 — ровно +1 новая декларация `layout-full-read-drops-real-overlap-rearm`), `execution=0`, `caught=unknown (nightly only)` — мутант не исполнялся, это статический --check, не caught |
| Уникальность точки патча | `grep -n "if (repeatLayoutRead) queueMicrotask(() => {" src/houseplan-card.ts \| wc -l` | `1` — `find` в декларации применяется ровно к одной строке, патч не двусмысленен |
| process-gate | `node scripts/process-gate.mjs --issues --report` | PASS, 5 коммитов, 0 предупреждений |
| Чистота дерева/bundle | `git status --porcelain`, `git diff origin/dev...HEAD -- dist/` | дерево чистое, 0 строк диффа в `dist/` — ожидаемо, `src/**` не менялся |

Не прогонял: полный `npm test`/`tsc`/`npm run build` с побайтной сверкой трёх
копий бандла — Validate зелёный на этом самом SHA (см. выше), а делта не
трогает `src/**`/`dist/**`, перегонять бессмысленно. `golden:verify` — нет
`ci:golden`, рендер не затронут. `npm run invariants` — геометрия не
менялась. `pytest tests_backend` — Python не менялся. Остальные 8 нативных
смоков из решения автора в r1 (`smoke_pageshow_layout_ack` и соседи) —
делта их не касается (изменения только в юнит-тесте и реестре), повторный
прогон не требуется по принципу «неизменный check не повторять»
(REVIEWER.md «Повторный раунд»); `smoke-select` по новому диапазону не
перезапускал — делта не трогает `src/demo` путей.

## Проверка мутанта по существу (чтением, не исполнением)

Мутанта `layout-full-read-drops-real-overlap-rearm` я не исполнял (общая
политика #905 — временный патч исполняемой реализации вне ночного workflow
запрещён, включая ревьюеру). Разобрал логически по коду:

- `src/layout-write-reload.ts:45-61` (`LayoutWriteReload.reconcile`) делает
  максимум 2 попытки; если обе попытки реально пересечены собственной
  записью без адопции — возвращает `{ status: 'layout-raced' }`.
- `src/houseplan-card.ts:4430` транслирует это в `repeatLayoutRead = true`;
  `src/houseplan-card.ts:4474-4476` при `repeatLayoutRead` планирует ровно
  один `queueMicrotask(() => { ...; void this._loadFromServer(); })`.
- Патч мутанта меняет условие на `if (false && repeatLayoutRead)
  queueMicrotask(...)` — тело никогда не выполнится, повторной загрузки
  после `layout-raced` не будет.
- Новый тест (`test/layout-write-reload.test.mjs`, добавлен в `fbb2af5f`)
  удерживает первое чтение, пропускает через него две реальные
  пересекающиеся записи (`.4`, `.6`), исчерпывая оба цикла `reconcile`
  внутри настоящего `_loadFromServer` реальной карточки (`host._loadFromServer
  = proto._loadFromServer.call(host)` — не голый класс), и утверждает ровно
  3 `houseplan/layout/get` и 3 `houseplan/config/get` (2 от исходной пары +
  1 от re-arm) и 1 `houseplan/trail/get` (только финальный adoption tail).
  При мутации третьей пары не будет — счётчик `layout/get` останется 2, а
  не 3, и ассерт на 3 явно упадёт.

Это удовлетворяет требованию «AC · чем доказан · чем краснеет»: третий
столбец для защитного AC1/M1 называет конкретный зарегистрированный
свидетель с честным «не исполнялся», что допустимо по общей политике
(статический `--check` и регистрация — не caught, но и не обязаны им быть
вне ночи).

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Medium: `layout-raced → queueMicrotask` re-arm проверен только на голом классе `LayoutWriteReload` (`test/layout-write-reload.test.mjs:247-268` в материале r1), ни один host-тест не доводит реальное двойное пересечение до `layout-raced` внутри настоящего `_loadFromServer` — пустой столбец «чем краснеет» для защитного AC1 | Добавлен новый тест на реальной карточке (`host._loadFromServer` = `proto._loadFromServer.call(host)`, не изолированный класс), доводящий оба цикла `reconcile` до `layout-raced` и проверяющий итоговые 3/3/1 чтения, позицию, историю, `_loading`/`_loadOk`/`_sentPos`, плюс идемпотентность после settle. Параллельно зарегистрирован мутант `layout-full-read-drops-real-overlap-rearm`, целящийся именно в точку вызова в `houseplan-card.ts` (не только в класс) — оба способа закрытия, предложенные в r1, применены одновременно | `test/layout-write-reload.test.mjs:247-283` (тест `#902 r1 M1 actual card re-arms once after both reads overlap real released writes`); `scripts/mutation-registry.mjs` (новая запись `layout-full-read-drops-real-overlap-rearm`); `docs/reviews/evidence-902/ordinary.md` (раздел «Code-review r1 M1: actual-card re-arm after the second overlap») |

Других находок в r1 не было (High: 0, Medium: 1 — закрыта полностью выше).

## Унаследовано из r1

Принято без повторной проверки, т.к. делта `fbb2af5f` не трогает `src/**`,
`demo/**`, changelog, release-ledger — содержимое этих файлов идентично
проверенному в `docs/reviews/CODE-REVIEW-902-r1.md` на материале r1 (три
логических коммита fix/refactor/test, те же деревья под новыми хешами после
ребейза):

- Основной механизм `LayoutWriteReload.reconcile`/`begin`/`guard`/`retire`
  (`src/layout-write-reload.ts`) — защитные свойства (own-write overlap
  инвалидирует старый read; write внутри backdrop await инвалидирует adopt;
  retired owner не трогает новый контекст).
- AC1/AC2 — нативный смок `smoke_pageshow_layout_ack.mjs`, воспроизводящий
  баг на pre-fix коде (RED на `ack-before-pair`) и зелёный на всех трёх
  порядках ACK/pair на HEAD.
- AC3 — 36 (+1 новый = 37, без учёта r1 M1 теста) host-тестов: reject,
  более новая внешняя ревизия, connection/user/A→B→A/detach, held-drag
  cancel, passive View/kiosk с неизменным числом чтений, short-detach.
- Документация (`ARCHITECTURE.md`, `WARM-REMOUNT.md`,
  `CONFIG-COMPATIBILITY.md`, `USER-GUIDE.ru.md`) и changelog (RU/EN)
  соответствуют реализованному поведению; термины взяты из существующего
  словаря USER-GUIDE.
- `docs/release-ledger/v1.80.1/902.json`: `stable-fix` с обоснованием
  относительно v1.80.1, `introducedBy` не требуется — классификация
  корректна.
- Трейлеры `Issue:`/`User-Visible:` на коммитах r1, инвентарь
  `coordinate-write-barrier-guard.mjs` (3→2 писателей).

Документ и SHA того раунда: `docs/reviews/CODE-REVIEW-902-r1.md` (вердикт
жёлтый, High 0 Medium 1), материал `de31e35ea3f64852b6f41b75bdf6f37c5086e83a`
(пере-укоренён под `e1380ed4` на текущем дереве).

## Что проверено и корректно

- Новый тест действительно идёт через реальную карточку, а не через
  изолированный класс — подтверждено чтением `harness()`
  (`test/layout-write-reload.test.mjs:12-90`: `_loadFromServer: () =>
  proto._loadFromServer.call(host)`) и личным прогоном (39/39 PASS).
- Зарегистрированный мутант целится в уникальную строку
  `src/houseplan-card.ts` (проверено `grep -c`), логически обязан ловиться
  новым тестом (разбор выше).
- `mutation-gate --check` статически принимает декларацию, подсчёт
  `definitions` вырос ровно на 1 относительно r1 (1603→1604).
- Трейлеры коммита верны, видимого поведения нет, changelog не требовался
  и не трогался.
- Дерево чистое, `dist/` не затронут, process-gate без предупреждений.
- Делта не меняет предмет ревью ради доказательства (#905) — правки только
  в тесте/реестре/evidence, продуктовый код `src/**` байт-в-байт тот же,
  что был принят (частично с Medium) в r1.

## Чего не проверял

- Полный `npm test`/`tsc`/`npm run build` с побайтной сверкой бандла заново
  не прогонял целиком — переиспользован зелёный Validate на этом точном SHA
  (подтверждён `gh run view`), а делта не трогает `src/**`/`dist/**`.
- `golden:verify`, `npm run invariants`, `pytest tests_backend` — не
  применимы (рендер/геометрия/Python не менялись).
- 9 нативных смоков, выбранных и прогнанных автором в r1
  (`smoke_pageshow_layout_ack` и соседи) — не перепрогонял: делта их не
  касается, неизменившийся check не повторяется по правилу повторного
  раунда.
- Мутант `layout-full-read-drops-real-overlap-rearm` не исполнялся (ни
  мной, ни кем-либо вне ночного workflow) — только статическая регистрация
  и логический разбор; «поймает» подтвердит только ночной прогон реестра.
- Полные тела #397/#491 и исторические ручные мутанты r1 (3 шт., вручную
  применённые прошлым ревьюером) заново не переигрывал — не предмет
  текущей делты.

## Вердикт

Зелёный. High: 0, Medium: 0. Единственная находка r1 закрыта обоими
предложенными способами (новый ordinary host-тест + зарегистрированный
мутант на точке вызова), делта не вносит нового риска и не трогает
продуктовый код.

route: fix

---

## Материал раунда

- Ветка: `issue/902-pageshow-layout-ack`, `HEAD` = `fbb2af5fd5d3c110a0e419c940aeed4ca9ba8b08`.
- `origin/dev..HEAD`: 5 коммитов (`ccd0e6a5`, `2c47dfd6`, `e1380ed4`, `1fd3487f`, `fbb2af5f`).
- Делта r2 против материала r1: ровно `fbb2af5f` (3 файла, +70/-0).
- Вердикт конвейера: зелёный · High 0 · Medium 0 · маршрут `fix`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/902-pageshow-layout-ack`, коммит `fbb2af5fd5d3` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `8ef4ed971bf51015001be1a9c24a5ebcb2672213`
  ```
  git log --all --format='%H %T' | grep 8ef4ed971bf5
  ```
- Тело issue: `6548baf32eb6b4f90589020d4465bbd480b72510029dd8cf4b2e5ca4652a272b`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ1NzMsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NjczfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo1NCwib3V0cHV0X3Rva2VucyI6MTg5ODIsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6OTQyNDMsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoyMzE1MzI0LCJjb3N0VXNkRXN0aW1hdGUiOjEuMDI5OTY0OH1dLCJ0dXJucyI6MzUsImR1cmF0aW9uTXMiOjIzMDMzNSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjEuMDM0NjM3OCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4627 output_tokens=19002 cache_creation_input_tokens=94243 cache_read_input_tokens=2315324 num_turns=35 -->
