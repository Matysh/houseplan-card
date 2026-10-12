# Код-ревью #857 · r1

Саморевью по [разрешению владельца для семи infra задач](https://github.com/Matysh/houseplan-card/issues/855#issuecomment-6125735643).
Материал: `ca21d81a1d22a7fd55ca6d56a52a2032e164dee8` относительно
`4c98dbc3` (dev с #860). Только B/C. Читались обязательный канон, роли,
полный контракт issue, SDK parser/metrics, producer/seal/publication и
existing request-epoch/recovery helpers; риск — authority/stale mutation.

## Разбор

Старый hp:usage, пять полей и aggregate consumer не изменены. Новый v1 payload
хранит реальные ключи modelUsage и nullable buckets, turns/duration, subtype,
outcome и provider estimate. Init model/usage-only не выдумывают attribution.
Берётся последний result; transcript, errors и tool content не публикуются.
Secret-like/invalid ids и слишком большой map отвергаются, но известный
exhausted/error сохраняется даже при unreadable ids. Dimensions отдельно от
aggregate в JSON/Markdown metrics; marker только в собственном anchor block.

Context проверяет свежий issue body digest, точные checkout SHA/tree и пути;
ограниченный immutable packet содержит обязательные role sources и каждый
changed file. Pipeline-дифф требует canon. Prompt сохраняет прежний порядок
SCOPE/AGENTS/REVIEWER, risky/negative obligations, targeted history из #860;
не повторяет неизменившееся доказательство, но требует новое при изменении
material/environment/oracle. Модель default и max-turns 150 сохранены.

Известный SDK exhausted/error — дополнительный отказ seal, никогда разрешение.
Unknown usage не заменяет уже существующий required full sealed verdict.
Failed model job даёт integration read-only trusted tools snapshot, затем
privileged recovery проверяет epoch/body/head/latest run дважды перед возвратом
только своего S4/S7 в S3/S6. Stop/new request/new material/replayed old run
не мутируются. Нет cycle increment, verdict, merge или автоматической смены
model/limit. Сбой API остаётся явным, не даёт прав на слияние.

## Гейты

- `npm run gate:small`: PASS 125 s, обязательный union без сужения.
- Usage/evidence/metrics/anchor/digests/entry: PASS 129 tests.
- Реальные publication push-refusal fixtures: PASS 32 tests.
- Trusted prepare/integrate/workflow job contracts: PASS 14 tests.
- `mutation-gate --check`: static PASS 1366 definitions, 4 прежних warnings,
  execution=0, caught=unknown; два дешёвых unit witnesses добавлены.
- `git diff --check`, check-docs, entry-cost --check: PASS.

Первый полный гейт обнаружил три compatibility ошибки: literal paths к
trusted scripts и прежнее расположение aggregate после ship anchor fence.
Исправлены без ослабления старых tests; финальный полный гейт зелёный.

## AC → доказательство → чем краснеет

| AC | Доказательство | Отрицательный случай |
|---|---|---|
| AC1 | SDK single/multi/null/last result, frozen usage tests, separate metrics | Lost actual ids, invented init id, null→0, secret/extra payload, aggregate double count |
| AC2 | role parity, immutable packet, unchanged model flags, full prompt reading | Stale body/SHA, traversal/oversized context, role flag drops canon, risky file omitted |
| AC3 | Real ship seal shell + collector fixtures + current-epoch recovery unit | Exhausted/error with otherwise green output, unreadable ids lose refusal, stale head/body/new epoch/run/blocked/closed cannot mutate |

## Находки

High 0 · Medium 0 · Low 0. Вердикт: green. Замечания локального pre-commit
разбора закрыты в проверенном материале, не остаются открытыми findings.

## Границы и следующий шаг

Paid model rounds, реальное OAuth billing/quota и quality/savings cohort не
исполнялись: пользователь разрешил саморевью при недоступной модели.
Observations создают измерительный канал, не обещают экономию. Before:
reviewer entry 5079 слов; after 5122 (+43 слова объяснения политики),
обязательные источники не урезаны. Packet читает каждый required source один
раз и deduplicates changed paths; реальный эффект проверяется будущими
сравнимыми раундами с negative findings, не синтетической денежной оценкой.
Нет A/product behavior, новых milestones, mutants/model invocation,
release/tag/Telegram. Следующий статус S7; после Validate/интеграции — S8.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/857-model-evidence`, коммит `ca21d81a1d22` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `3611bdf80e2c0ee5a60794d754984bc478d2fca7`
  ```
  git log --all --format='%H %T' | grep 3611bdf80e2c
  ```
- Тело issue: `87f477ac3fb4556e49f52a2deeb286e678bbed5e6c994096b0de671080e934aa`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
