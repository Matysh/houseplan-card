# CODE-REVIEW-1014-r1

Issue: #1014 · Этап: code · Трек: show · Заход: r1 · Материал: `7189c503a7306b343fbe1b4ad670d254d37d1208`

## Скоуп

Чисто процессная/инфраструктурная задача (метки `infra`, `process`, `track:show`):
правило «замена пути без объяснения — Medium» закрепляется в `PROCESS.md` §7.2,
`docs/process/AUTHOR.md` и `docs/process/REVIEWER.md`; механическая подсказка
(не гейт) при `src/**` insert > 3× deletions для `fix`/`refactor`/`chore` без
строки «оставлен старый путь:» в хендоффе добавлена в `scripts/task-packet.mjs`
и `scripts/review-preflight.mjs`; воспроизводимая метрика доли коммитов,
уменьшивших `src`, и net-строк по типам — в `scripts/process-metrics.mjs`
(`--source-range=<base>..<candidate>`) и в брифе независимого ревью линии
(`scripts/release-review.mjs`). Новый общий модуль `scripts/source-replacement.mjs`
содержит парсер Git numstat, фильтр релизных промоушенов (`isBetaCommit`,
перенесён из `process-metrics.mjs` с переэкспортом для обратной совместимости)
и собственно логику подсказки/метрики. Продуктовый код (`src/**`) не тронут —
границы ТЗ соблюдены.

Первый вопрос про `docs/SCOPE.md`: задача не продуктовая, а процессная
(класс C/B), что явно разрешено треком `process`/`infra`; строки Core user
jobs она не закрывает и не обязана.

Материал на `track:show`, дереву к `dev` не приводился (3 коммита дельты у
`dev`, слияние чистое по `git merge-tree`) — согласно политике трека это не
находка, ревью идёт по ветке как есть.

**Маршрут (§5/#726):** `route: fix`. Все критерии пройдены:
- `complexity` ≤3 — узкий рефакторинг + одна новая функция-подсказка с чётким порогом, риск низкий (только advisory, ничего не блокирует);
- `surfaces` — одна логическая поверхность: три точки ровно по тексту ТЗ (packet/preflight/metrics), общий модуль;
- `migration` — нет новых compatibility-полей и миграций конфига;
- `ux-contract` — нет пользовательского UX вовсе (инструменты процесса);
- `perf-touch` — не затронуто;
- `undocumented` — поведение документируется этим же изменением в каноне процесса (PROCESS.md/AUTHOR.md/REVIEWER.md), догадок не осталось.

## Как проверялось

Принят proof validate-gate для материала `7189c503a…` (review-light proof
complete, https://github.com/Matysh/houseplan-card/actions/runs/40026212609) —
покрывает `gate:small` (build/typecheck, no-new-any/private-writes/layout,
bundle-policy/budget/unused) и полный `node --test` на этом SHA. Не повторял.

Адресно (непокрытый ранее конкретный пробел — новый код этой задачи и его
граничные случаи) прогнал сам:

| Гейт | Команда | Результат |
|---|---|---|
| Юнит нового модуля + сопряжённые контракты | `node --test test/source-replacement.test.mjs test/monolith-text-anchors.test.mjs test/ci-profiles.test.mjs test/ci-registry-inputs.test.mjs` | 31 PASS, 0 FAIL |
| Синхронность канона и REVIEWER/AUTHOR-дайджестов | `node --test test/process-digests.test.mjs` | 10 PASS, 0 FAIL |
| Схема release-ledger | `node --test test/release-ledger.test.mjs` | 6 PASS, 0 FAIL |
| Чтение диффа | `git diff origin/dev...HEAD`, `git log --oneline origin/dev..HEAD`, построчное чтение всех изменённых файлов | вручную |

Чего не проверял и почему: полный `npm run gate:small`/`tsc`/`npm test`/
mutation-gate — уже в принятом proof на этом SHA, продукт (`src/**`) не менялся,
повторный прогон был бы избыточным общим набором, а не адресной проверкой.
Chromium/смоки/golden/pytest/инварианты — не нужны: правка не трогает
`src/**`, рендеринг, HA-бэкенд или геометрию; тело issue не называет смоук.

## Доказательства AC (защитные — таблица «чем краснеет»)

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| Подсказка срабатывает строго при `added > 3×deleted` для `fix/refactor/chore`, не раньше | `test/source-replacement.test.mjs`: `sourceReplacementWarnings([commit(type,3,1)]).length === 0` и `([commit(type,1,0)]).length === 1` для всех трёх типов, прогнано мной — PASS | тот же обычный (неисполняемый мутант) negative-input case в неизменённом тесте: если порог сдвинуть на единицу, `(3,1)` даст 1 вместо 0 или `(1,0)` — 0 вместо 1, тест упадёт |
| `feat` не получает механической подсказки | `sourceReplacementWarnings([commit('feat',500,0)]).length === 0` — PASS | тот же тест красен, если `feat` попадёт в `replacementTypes` |
| Реальное «оставлен старый путь:» в выбранном хендоффе подавляет подсказку; цитата/код-блок/пример — нет | `test('#1014 only a real selected handoff suppresses the hint…')`: прямая строка → 0 предупреждений; та же фраза в `> цитате` или в ```code``` → 1 — PASS, обе ветки исполнены | тест красен при инверсии любой из двух ветвей (ложное подавление по цитате или неподавление при реальной строке) |
| Подсказка не меняет `ok`/`track`/`status`/`semanticApproval` | `checkReviewInput` в тесте возвращает `ok:true, semanticApproval:false, warnings.length===1`; `packet.trackDetail.track==='show'`, `packet.status==='S6-in-progress'` неизменны при наличии предупреждения — PASS | тест красен, если добавление `warnings` случайно повлияет на `ok`/`status`/`track` |
| CLI `--source-range` на реальном Git-дереве даёт тот же расчёт, что и общий парсер, без сети | `test('#1014 release-range CLI…')`: настоящий временный `git init`, два коммита, вызов `process-metrics.mjs --source-range=base..HEAD`, сверка вывода и `out.json`/`out.md` — PASS, исполнено | тест красен при расхождении CLI-пути и `sourceGrowthMetrics`/`parseSourceCommitLog` |

«Что удалено взамен добавленного» (п.3, ревью-чеклист) — поведенческое правило
для ревьюера, не код; проверено чтением PROCESS.md/AUTHOR.md/REVIEWER.md —
формулировка идентична в трёх местах и ссылается на один канон (§7.2, #1014).

## Что проверено и корректно

- Дифф не трогает `src/**` — границы ТЗ соблюдены буквально.
- `isBetaCommit` в новом модуle — побитовая копия логики из `process-metrics.mjs`
  (проверил операторный приоритет `||`/`&&` — идентичен прежнему `if`); старая
  реализация в `process-metrics.mjs` удалена целиком, остался только импорт и
  ре-экспорт для обратной совместимости — само изменение следует своему же
  правилу «что удалено взамен добавленного» (дог-фудинг, без расхождений).
  Неиспользуемые импорты (`isReleaseMessage`, `committedBundleMustMatch`,
  старый `parseNumstat`) в `process-metrics.mjs` не осталось — проверил `grep`.
- `sourceChurn` корректно выбирает `commit.sourceFiles` при наличии (нужно для
  `review-preflight.mjs`, где `commit.files` — уже список путей-строк, а не
  numstat-объектов) и иначе падает на `commit.files` (используется в
  `task-packet.mjs`/`process-metrics.mjs`, где `files` — numstat-объекты) —
  согласованно с местами вызова, не наткнулся на путаницу форматов.
  i18n/binary корректно исключены (`Number.isSafeInteger` отсекает `null` у
  бинарных файлов numstat).
- `process-metrics.mjs --source-range` валидирует refs регэкспом и
  дополнительно отклоняет значения, начинающиеся с `-`, плюс использует
  `--end-of-options` перед `git rev-parse --verify`; аргументы идут в
  `execFileSync` без шелла — инъекция через `ref` исключена на двух уровнях.
- `docs/STATUS.md`: коммит `7189c503a` (только `docs/STATUS.md`, класс C —
  трейлеры `Issue`/`User-Visible` для него не требуются) переставляет абзац
  «Source replacement» после «Dreame native recovery» и восстанавливает
  опубликованное число `Node unit 5174` — сверил байт-в-байт с
  `origin/dev:docs/STATUS.md` (строка 23) и финальный `git diff origin/dev...HEAD -- docs/STATUS.md`
  показывает ровно один добавленный абзац, без расхождений в числе
  (§8 «одно число — один источник» выполнено).
- Коммит `d9b22433` несёт корректные трейлеры `Issue: #1014` и
  `User-Visible: no` (класс B — `scripts/`, `test/`, оба changelog не
  требуются при `no`).
- `docs/release-ledger/v1.82.0/1014.json`: `category: infra`, `baseStable:
  v1.82.0` — соответствуют предыдущему stable и характеру правки; `summary`
  не обязателен для `infra` (`isUserReleaseEntry` требует его только для
  `major`/`stable-fix` — сверил `scripts/release-ledger.mjs`); задача не
  попадёт в пользовательский milestone релиза, что верно для чисто
  процессной инфраструктуры.
- `scripts/ci-profile-paths.json`, `.github/workflows/validate-{product,tooling}.yml`,
  `scripts/ci-registry-inventory.json` — новый тест добавлен в алфавитном
  порядке во всех списках (между `source-fingerprint` и `stacked-fields`);
  согласованность подтверждена исполнением `test/ci-profiles.test.mjs` и
  `test/ci-registry-inputs.test.mjs` (PASS).
- Хендофф отвечает формату (`Сделано/Файлы/Гейты/НЕ сделано/Риски/Следующий
  статус`), гейты в нём совпадают по составу с тем, что я перепроверил
  адресно; «НЕ сделано» честно называет, что числовой лимит и product API не
  менялись.

## Чего не проверял

- Полные `npm run gate:small`, `tsc`, общий `npm test`, `mutation-gate.mjs`
  без `--check` — покрыты принятым proof на этом SHA, продукт не менялся,
  повторный прогон был бы общим набором, а не адресной проверкой пробела.
- Смоки/Chromium/golden/pytest/инварианты геометрии — не применимо: нет
  изменений в `src/**`, рендеринге, HA-бэкенде, Python или геометрии; в теле
  issue смоук не назван.
- Производительность — не затронута и не названа в AC.
- Семантическую сторону retained-path объяснений в реальных будущих хендоффах
  — это предмет будущих ревью, не этой задачи; здесь проверен только
  механизм распознавания строки.

## Находки

Нет. High: 0, Medium: 0, Low: 0.

## Маршрут побочных находок

Доверенный снимок: `mode=issues`. Побочных находок (Medium вне скоупа) нет —
новые issue не заводились.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1014-source-replacement-rule`, коммит `7189c503a730` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `5b68883ba5f610d8de85b0adc39ee48cfc686db3`
  ```
  git log --all --format='%H %T' | grep 5b68883ba5f6
  ```
- Тело issue: `0ca39a6d5abad4f1fcb44cd19e8c43113102b35a9ce33edda4cdd5221ded9202`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxODAsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1Mjc0OTk5OTk5OTk5OTk5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo2OCwib3V0cHV0X3Rva2VucyI6Mjk4MjgsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6OTg0NDUsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoyOTQ3MzAzLCJjb3N0VXNkRXN0aW1hdGUiOjEuMjgxNjU2NTk5OTk5OTk5OH1dLCJ0dXJucyI6MzksImR1cmF0aW9uTXMiOjM3NjAwOCwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjEuMjg2OTMxNTk5OTk5OTk5NywiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5248 output_tokens=29847 cache_creation_input_tokens=98445 cache_read_input_tokens=2947303 num_turns=39 -->
