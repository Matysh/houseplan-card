# CODE-REVIEW-927-r1

Issue: #927 · Этап: code · Трек: show · Заход: r1 · блокирующих циклов 0/2
Материал: `02ef97a3af7d4a2c5010124e5f991729d2b2f7fd` (один коммит
`docs: clarify four historical review claims`, `origin/dev..HEAD`)

## Скоуп

Чисто документационная (класс C) задача: добавляет датированную errata
`docs/analysis/927-evidence-errata-2026-10-17.md` с четырьмя точечными
фактическими исправлениями в принятых отчётах `CODE-REVIEW-910-r1.md`,
`-909-r1.md`, `-907-r1.md`, `-911-r1.md` (сейчас архивированы в
`legacy/reviews/v1.81.0/`), плюс навигационные абзацы в
`docs/DEVELOPMENT.md`/`docs/STATUS.md` и классификацию
`docs/release-ledger/v1.81.0/927.json` (`category: infra`). Исходные
отчёты, их вердикты, машинные якоря и raw не редактируются — подтверждено
побайтовым сравнением (см. «Как проверялось»). Продуктовый код, демо,
тесты, скрипты и бандл не затронуты; `src/**`, `demo/**`, `scripts/**` —
без диффа.

Строку `docs/SCOPE.md` задача прямо не обслуживает — это процессная
инфраструктура (точность исторической прозы ревью), что и отражено
классификацией `infra`, без пользовательского changelog/milestone;
коммит несёт `User-Visible: no`, оба `docs/CHANGELOG*.md` не тронуты —
проверено `git diff origin/dev...HEAD --stat -- docs/CHANGELOG.md
docs/CHANGELOG.ru.md` (пусто).

**Критерии §5 (трек show → route):** complexity — тривиальная prose-правка,
риск ≤3; surfaces — одна поверхность (один новый analysis-документ плюс
его навигационные ссылки); migration — нет конфигов/compatibility-полей;
ux-contract — нет видимого поведения вообще; perf-touch — не затронуто;
undocumented — ожидаемый результат однозначно описан в самом теле issue
#927 (четыре пронумерованных пункта исправлений с первичными ссылками) и
воспроизведён документом один в один. Ни один критерий не проваливается →
`route: fix`.

## Как проверялось

Дешёвые гейты на этом SHA подтверждены зелёным Validate
(https://github.com/Matysh/houseplan-card/actions/runs/38968971012) —
`npx tsc --noEmit`, `npm test`, `npm run build` + `bundle-policy --verify`
повторно не перегонялись (правило #343). Диапазон не трогает `src/**`,
`demo/**` рендер, Python, геометрию стен/плана — `golden:verify`, смоки,
`pytest tests_backend`, инварианты модели, performance не применимы, AC
ни один из них не называет (их и нет как формального списка — см. ниже).

Основная работа ревью — построчная перепроверка каждого из четырёх
фактических утверждений нового документа по неизменным историческим
блобам (перечисленным в issue и в самом `927-evidence-errata` по полному
SHA):

| Проверка | Команда / способ | Результат |
|---|---|---|
| Архивные отчёты не редактировались | `diff <(git show <SHA>:docs/reviews/CODE-REVIEW-<NN>-r1.md) legacy/reviews/v1.81.0/CODE-REVIEW-<NN>-r1.md` для NN=910,909,907,911 | все четыре пары побайтово идентичны |
| #910: число фраз в литеральном массиве AC2 | `git show 26c450e5:test/process-digests.test.mjs`, подсчитан литеральный массив теста `#910 AC2` построчно | ровно **17** элементов (`` `executed` `` … «не семантическую истинность отчётов»), отчёт `CODE-REVIEW-910-r1.md:58` называет 19 — ошибка подтверждена |
| #910: фраза про `User-Visible: no` и оба changelog | `git show 26c450e5:docs/reviews/CODE-REVIEW-910-r1.md` строки 26–28 и 77–78 | L26–28 корректно: «второй changelog не требуется — проверено (оба `docs/CHANGELOG*.md` не менялись)»; L77–78 ошибочно формулирует «`User-Visible: no` … соответствует … правке обоих changelog» — внутреннее противоречие подтверждено, errata права, что это не свидетельство пропущенной правки |
| #909: `mutation-registry.mjs --check` — не CLI-проверка | `git show facf77a1:scripts/mutation-registry.mjs` целиком (19196 строк) — единственный экспорт `export const MUTANTS = …`, нет `process.argv`/`import.meta.url ===`/CLI-ветки для себя | подтверждено: модуль только объявляет мутанты, запуск с любым аргументом просто импортирует файл и завершится `exit 0` независимо от `--check` |
| #909: реальный validator — `mutation-gate.mjs --check` | `git show facf77a1:scripts/mutation-gate.mjs \| grep "'--check'"` | строки 49-50, 175 — файл явно разбирает `--check` в `argv` | 
| #909: исходная таблица действительно называла неверную команду | `git show facf77a1:docs/reviews/CODE-REVIEW-909-r1.md` строка «Статический реестр мутантов … `node scripts/mutation-registry.mjs --check` → exit 0» | подтверждено дословно |
| #907: `config-write-context.test.mjs` = 5 тестов | `git show af6affeb:test/config-write-context.test.mjs \| grep -c '^test('` | 5 |
| #907: `space-reference-repair.test.mjs` = 24-матрица + 14 = 38 | `git show af6affeb:test/space-reference-repair.test.mjs` — вложенный цикл `for (id of [3 значения]) for ([caseName,…] of [8 кейсов])` = 24 параметризованных `test()`, плюс построчный подсчёт `grep -c '^test('` = 14 верхнеуровневых | 24+14=38, итого 5+38=43 — совпадает с errata |
| #911: `wall-thickness-selection.ts` матчит `wall[-_]\|geometry\|resize\|opening` | `git show d5ec5043:scripts/candidate-readiness.mjs` строка 49: `/(?:wall[-_]|geometry|resize|opening)/.test(f)` против имени файла, содержащего `wall-` | матчит — `requiredProfiles` вернёт и `editor` (строка 48, файл назван явно), и `geometry` (строка 49) одновременно; исходный `CODE-REVIEW-911-r1.md:182-184` утверждал обратное — ошибка подтверждена |
| Коммит: trailers, changelog, ledger | `git log -1 --format=%B`, `git diff --stat` | `Issue: #927`, `User-Visible: no`; ledger `category: infra`, `baseStable: v1.81.0` — согласуется с соседними прецедентами в той же директории (866/917/921/929) |

Мутанты/исполняемые гарды не трогались и не исполнялись — в диффе нет
кода, который можно было бы патчить; это чисто чтение исторических
блобов и текущего `scripts/candidate-readiness.mjs`/`scripts/mutation-gate.mjs`
без изменений рабочей копии.

Чего не проверял: локальный приёмный файл автора
`/home/matysh/hp-batch2-root-909-20261015/artifacts/909/static.json`,
упомянутый в новом документе как подтверждение отдельного верного прогона
`mutation-gate.mjs --check` для #909, — находится вне репозитория на
машине автора и не воспроизводим ревьюером в CI. Документ сам отмечает
эту границу («Primary comments and job metadata were read, not rerun») и
не выдаёт её за новое исполнение — формулировка корректно осторожна,
отдельной находки не завожу.

## Разбор по пунктам issue

Все четыре пронумерованных пункта проблемы из тела issue #927 имеют
симметричные разделы в `927-evidence-errata-2026-10-17.md` и верны по
итогам независимой перепроверки выше — проверено чтением, не
исполнением:

1. **#910** — 17 vs 19 фраз и некорректная фраза о changelog — раздел
   «#910 — seventeen phrases, and the changelog condition». Совпадает.
2. **#909** — загрузка модуля ≠ запуск валидатора; реальная команда
   `mutation-gate.mjs --check` — раздел «#909 — loading the registry is
   not running its validator». Совпадает.
3. **#907** — 43 unit (5+38) смешаны с отдельным native cohort (19+2);
   SKIP браузера в light CI не является исполнением — раздел «#907 —
   separate the two unit files from the native cohort». Совпадает.
4. **#911** — `wall-thickness-selection.ts` действительно матчит
   `wall[-_]`, селектор возвращает editor+geometry — раздел «#911 — the
   wall path does match the geometry selector». Совпадает.

Нет формального списка AC в теле issue (не `## ТЗ`, а batch-finding с
четырьмя пронумерованными пунктами) — трек `show` это допускает; каждый
пункт проверен по существу выше, защитных AC (валидация/гард/лимит) в
этой задаче нет — таблица «чем краснеет» неприменима: задача не меняет
исполняемое поведение, только фактическую точность прозы, что сам новый
документ явно оговаривает.

## Находки

Нет High. Нет Medium.

## Что проверено и корректно

- Новый документ не редактирует и не затирает ни один из четырёх
  исходных отчётов, их вердикты, машинные якоря или raw — подтверждено
  побайтовым сравнением архивных копий с источником по именованным SHA.
- Каждое из четырёх фактических утверждений независимо перепроверено
  чтением текущего/исторического кода и дало то же число/вывод, что
  заявлено в документе (17 фраз, отсутствие CLI `--check` в
  `mutation-registry.mjs`, 5+38=43, совпадение `wall-thickness-selection.ts`
  с regex).
- Границы честно названы: не replay, не новый semantic-checker, не
  переоткрытие S8, локальный авторский receipt не выдаётся за
  воспроизведённое в CI исполнение.
- Трейлеры корректны (`Issue: #927`, `User-Visible: no`), оба changelog
  не тронуты, что соответствует отсутствию пользовательского поведения;
  `release-ledger` классификация `infra` обоснована и не идёт в
  пользовательский milestone.
- Навигационные абзацы в `docs/DEVELOPMENT.md`/`docs/STATUS.md`
  согласованы по стилю и содержанию с существующим разделом про #910 и
  не меняют зафиксированный бюджет строк соседних документов.
- Мутанты/гарды/лимиты продукта не патчились и не исполнялись в ходе
  этого ревью — общая политика об отрицательных проверках соблюдена: в
  диффе нет исполняемого предмета для патча.

## Чего не проверял

- Полный `npm test`/`npm run build`/`typecheck` повторно не гонял —
  зелёный Validate на этом же SHA (run 38968971012) уже это подтвердил,
  диапазон не содержит `src/**`/`demo/**`/Python диффа, так что
  golden/смоки/`pytest tests_backend`/инварианты/performance неприменимы
  и не перегонялись.
- Авторский локальный файл `artifacts/909/static.json` на машине автора
  (`/home/matysh/hp-batch2-root-909-20261015`) — не воспроизводим в этом
  окружении; документ сам честно отмечает это как нечто «read, not
  rerun», и это не критично для вывода, так как независимо от этого
  локального receipt сам факт «`mutation-registry.mjs` не имеет CLI
  `--check`» подтверждён прямым чтением кода модуля.
- Ручное dev/GPU-приёмочное тестирование не проводилось — задача
  документационная, не затрагивает рендер или интерактив.

## Вердикт

Зелёный. Все четыре фактических исправления независимо перепроверены и
подтверждены верными; исходные отчёты и их вердикты остаются нетронутыми;
границы (no replay, no semantic-checker, no S8 reopen) соблюдены и честно
заявлены. High: 0, Medium: 0.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/927-review-errata`, коммит `02ef97a3af7d` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `b5a66797b5fb3f468dd504101467be86ba099027`
  ```
  git log --all --format='%H %T' | grep b5a66797b5fb
  ```
- Тело issue: `cd9005793330927d21a3346eeeb8ecbf97bc5eadd89d8c6d4716151d944718d6`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ5ODAsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDh9LHsiaWQiOiJjbGF1ZGUtc29ubmV0LTUiLCJpbnB1dF90b2tlbnMiOjU0LCJvdXRwdXRfdG9rZW5zIjoyMTkzNywiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjo3NTc4OCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjE3OTQ3NjYsImNvc3RVc2RFc3RpbWF0ZSI6MC44ODE1ODMxOTk5OTk5OTk4fV0sInR1cm5zIjo0MCwiZHVyYXRpb25NcyI6MjU0NzM0LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MC44ODY2NjMxOTk5OTk5OTk4LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5034 output_tokens=21957 cache_creation_input_tokens=75788 cache_read_input_tokens=1794766 num_turns=40 -->
