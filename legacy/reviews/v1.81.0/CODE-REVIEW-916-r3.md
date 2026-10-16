# CODE-REVIEW-916-r3

Issue: #916 · этап code · заход r3 · блокирующих циклов израсходовано 1 из 4
(track:ask) · трек ask.

Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`,
ровно `8596fd9a97aa6cf04b5c5ee3377b6e8edab2c801` (рабочая копия уже на нём,
`git status` чист, `HEAD^{tree}` = `3a6232afa96d56fa3cbf7e619e15802e0024297a`
— совпадает с `material.tree` в `REVIEW_CONTEXT`). `origin/dev` = `1a85d9a2`,
диапазон — три коммита: `379d2955` (реализация), `9624f03b` (документ
CODE-REVIEW-916-r1), `8596fd9a` (документ SPEC-REVIEW-916-r1).

## Скоуп

Инфраструктура подготовки стабильного релиза (класс B/C, `User-Visible: no`),
работа из `docs/SCOPE.md` не обслуживает ни одну строку напрямую — обслуживает
процесс выпуска, что корректно для класса «инфраструктура» (§1). Три пункта
одним коммитом `379d2955`:

1. **AC1** — `readDeliveryHistory` переходит на `--topo-order`, учитывает
   реализацию, пришедшую вторым родителем merge.
2. **AC2** — `ghApi` получает `maxBuffer: 8 * 1024 * 1024`, фикс `ENOBUFS`.
3. **AC3** — новый `scripts/stable-field-decision.mjs` + интеграция в
   `candidate-readiness.mjs`/`release-prepare.mjs`: разовое проверяемое
   продвижение `v1.81.0` из принятой владельцем `v1.81.0-beta.4` без
   per-issue/native/GPU receipts.

Это третий заход ревью по этой issue (первый код-заход был `r1`, жёлтый;
промежуточная механическая неудача преflight не образовала собственного
раунда и цикл не потратила — см. ниже), но **первый реальный код-разбор после
маршрутизации** `show → ask`: между `r1` и этим заходом продуктовый/B-код не
менялся ни байтом.

## Закрытие раунда r1 (CODE-REVIEW-916-r1)

| Находка/причина возврата r1 | Чем закрыта | Где видно |
|---|---|---|
| `route: reclassify`, `criterion: complexity` (сопутствующий `surfaces`) — трек `show` не проходит критерии §5 для AC3 | Трек поднят пайплайном до `ask` после жёлтого вердикта r1; задача прошла полный маршрут ТЗ | метка `track:ask` на issue; автоматический комментарий «Ревью show: решать есть что — трек повышен до `track:ask`» (2026-10-16T05:48:44Z); сам текст ТЗ внесён в тело issue |
| ТЗ для реклассифицированной задачи должно пройти `S4-spec-review` | SPEC-REVIEW-916-r1, зелёный, High 0/Medium 0, `route: fix` | `docs/reviews/SPEC-REVIEW-916-r1.md`, body-digest `28942cc2…` |
| Два Low-нюанса r1 (неинформативная ошибка git в `merge-base --is-ancestor`; дублированная константа 8 МиБ) | Сняты самим ревьюером r1 как Low без возврата автору, кода не касались | `docs/reviews/CODE-REVIEW-916-r1.md`, раздел «Находки» |
| Находок к коду в r1 не было (High 0, Medium 0) | Код с тех пор не менялся — подтверждено `git diff 379d2955..HEAD --name-only` → только два review-документа | этот документ, раздел «Унаследовано» |

Отдельно: между `r1` (код) и зелёным SPEC-REVIEW-916-r1 был один
преflight-отказ («Механическая подготовка ревью не пройдена; модель не
вызывалась, цикл не израсходован», 2026-10-16T05:55:12Z, комментарий
`6209098429`) — он относится к спек-этапу (отсутствовал обязательный раздел
«Проблема» в ещё не дописанном теле issue) и не образует отдельного
код-раунда; номер `r3` для этого документа нужен только чтобы не затереть
`r1`/промежуточные артефакты публикации, реального код-раунда `r2` не было.

## Унаследовано из r1 (без повторного исполнения)

Материал кода идентичен байт-в-байт: `git diff 379d2955..HEAD` показывает
только `docs/reviews/CODE-REVIEW-916-r1.md` и `docs/reviews/SPEC-REVIEW-916-r1.md`
(480 добавленных строк, 0 изменений вне `docs/reviews/`). Поэтому
принимаю без повторного разбора по существу, с указанием источника:

- Построчная сверка AC1–AC3 против кода `scripts/release-ledger.mjs`,
  `scripts/stable-field-decision.mjs`, `scripts/candidate-readiness.mjs`,
  `scripts/release-prepare.mjs` — `docs/reviews/CODE-REVIEW-916-r1.md`,
  разделы «Разбор AC1–AC3» и «Проверено и корректно».
- Таблица «AC · чем доказан · чем краснеет» для защитных AC2/AC3 (все три
  столбца заполнены, отрицательные случаи — обычные, исполнявшиеся в
  зелёном прогоне) — тот же документ, раздел «AC — чем доказаны, чем
  краснеют».
- Проверка release-ledger записей 916/913/914 и `field-decisions/v1.81.0.json`
  (SHA `abac4e50`/`cdd992c8` реальны, `testedSha` — верный dereference тега) —
  тот же документ, раздел «Проверено и корректно».
- Пересчёт «ровно 7 полей версии в 6 файлах» и проверка порядка проверок в
  `readStableFieldDecision` — также перепроверено независимо в
  `docs/reviews/SPEC-REVIEW-916-r1.md`, п.4 («Как проверялось»), с тем же
  результатом.

## Что я проверил заново в этом раунде

- `git rev-parse HEAD` = `8596fd9a97aa6cf04b5c5ee3377b6e8edab2c801`,
  `HEAD^{tree}` совпадает с `material.tree` из `REVIEW_CONTEXT` — материал
  ревью подтверждён на уровне дерева, не только SHA коммита.
- `bodyDigest` в `REVIEW_CONTEXT` (`28942cc2…`) совпадает с `bodyDigest`,
  зафиксированным в «Материал раунда» `SPEC-REVIEW-916-r1.md` — тело issue не
  менялось между зелёным ТЗ-ревью и этим код-раундом.
- Validate на точном материале: `gh run view 38859811206` →
  `headSha: 8596fd9a97aa6cf04b5c5ee3377b6e8edab2c801`, `conclusion: success` —
  подтверждено напрямую через GitHub API, а не принято на слово из хендоффа.
- Целевые unit-наборы перегнаны свежо на этом SHA (дёшево, `node_modules`
  установлен): `node --test test/release-ledger.test.mjs
  test/task-delivery-903.test.mjs test/candidate-858.test.mjs
  test/release-contract.test.mjs test/monolith-text-anchors.test.mjs` →
  `pass 62, fail 0, skipped 0`, 2.8 с. Совпадает с результатом r1 (62/62) —
  регрессии нет.
- `node scripts/process-gate.mjs --range origin/dev..HEAD --issues` → «гейт
  пройден», одно ожидаемое WARN «инфраструктурный диапазон, статусная метка
  не требуется до S7-code-review» (то же WARN, что в r1).
- Трейлеры всех трёх коммитов диапазона: `379d2955` — `Issue: #916` /
  `User-Visible: no` (продукт/код); `9624f03b` и `8596fd9a` — `Issue: #916` /
  `User-Visible: no` (документы ревью, `8596fd9a` дополнительно несёт
  `Delivery-Phase: spec-review/v1`). `User-Visible: no` корректен — видимое
  поведение карточки не меняется, changelog не трогается ни одним коммитом.
- Прочитал оба добавленных с r1 документа (`CODE-REVIEW-916-r1.md`,
  `SPEC-REVIEW-916-r1.md`) целиком: внутренне непротиворечивы, цитаты кода и
  SHA в них соответствуют фактическому дереву (перепроверено выборочно —
  `versionFiles`, `testedSha`, ledger-записи), выводы согласуются друг с
  другом и с текущим состоянием issue.
- Маршрут: трек `ask` подтверждён меткой задачи, строка «Трек: ask»
  зафиксирована в контексте задачи; на `ask` маршрут вердикта всегда `fix`
  (§5) — переклассификация r1 закрыта, новых критериев §5 не применяю.

## AC1–AC3 — статус доказательства (без повтора исполнения)

| AC | Тип | Доказательство | Чем краснеет | Источник |
|---|---|---|---|---|
| AC1 (учёт второго родителя) | не защитный (полнота) | `test/task-delivery-903.test.mjs`, `test/release-ledger.test.mjs` | обычный regression-кейс: `--first-parent` дал бы `[9]` вместо `[2,9]` | унаследовано r1, перепрогон 62/62 в этом раунде |
| AC2 (ограниченный транспорт 8 МиБ) | защитный | `test/release-ledger.test.mjs` | malformed JSON → `SyntaxError`; `exit(7)` → `error.status===7`; 9 МБ при лимите 8 МиБ → `ENOBUFS` — все три исполнялись | унаследовано r1, перепрогон 62/62 |
| AC3 (схема/подлинность/публикация решения) | защитный | `test/release-contract.test.mjs`, `test/candidate-858.test.mjs` | 10+7+4 параметризованных негативных кейса (A/dependency/build/capture/pin/unknown builder, смена tag/SHA, чужой/malformed/revoked record, owner veto, draft/wrong-tag/wrong-SHA публикация) — все обычные, исполнялись | унаследовано r1, перепрогон 62/62 |

Пустых третьих столбцов нет.

## Проверено и корректно

- Диапазон `origin/dev..HEAD` не изменился с момента r1 ни по коду, ни по
  release-ledger записям — риск «материал подменили между раундами»
  закрыт сверкой дерева и построчного диффа.
- Документы r1 (код и ТЗ) опубликованы с правильными трейлерами, не
  затронули `docs/reviews/INDEX.md` вручную (публикация индекса — отдельный
  шаг конвейера, не предмет этого диффа).
- release-ledger классификация (`916`/`913`/`914` — `infra` относительно
  `v1.80.1`, `field-decisions/v1.81.0.json`) — авторское суждение,
  обоснование по существу, не входит в пользовательский milestone (#838);
  это суждение уже проверено дважды (r1 код, r1 ТЗ) и материал с тех пор не
  менялся.
- Один источник числа: буфер `8 * 1024 * 1024` не виден пользователю
  (внутренний лимит CLI) — §8 о видимых пользователю величинах не
  нарушается; подтверждено ещё в r1 и не изменилось.

## Чего не проверял

- Не перегонял полный `npx tsc --noEmit` / `npm test` / `npm run build` +
  сверку копий бандла — Validate на точном SHA `8596fd9a` зелёный
  (`38859811206`, подтверждено `gh run view`), материал с момента
  предыдущего полного прогона (`379d2955`, тот же Validate-прогон по коду)
  не менялся продуктово.
- Не прогонял `golden:verify`, `npm run invariants`, performance — `src/**`
  и геометрия не затронуты, визуального риска нет, AC их не требует.
- Не исполнял зарегистрированные мутанты и не патчил исполняемую
  реализацию/гарды вручную — только обычные негативные входы внутри уже
  существующих тестов, согласно общей политике; ночной прогон реестра вне
  скоупа этого раунда.
- Не проверял живой `git push`/`gh release`/реальный `verify-milestone`
  против сетевого GitHub API заново — выполнено автором ранее (42 issue,
  включая #870) и зафиксировано в r1 как неповторяемое без сети; это не
  изменилось в этом раунде.
- Не проверял `pytest tests_backend` — Python-интеграция не затронута
  диапазоном (`custom_components/**` не в диффе).
- `docs/reviews/INDEX.md` не проверял на актуальность — его обновляет шаг
  публикации, не предмет ревью.

## Находки

Нет. High: 0, Medium: 0. Маршрутизационная причина возврата r1 закрыта
(трек `ask` подтверждён, ТЗ принято зелёным). Новых находок к коду, ledger
или документам этого раунда не нашёл.

## Вердикт

Зелёный · заход r3 · блокирующих циклов 1/4 · High: 0 · Medium: 0 ·
`route: fix`.

Код не менялся с r1 (High 0/Medium 0 там же), единственная причина
предыдущего жёлтого вердикта — маршрут трека — закрыта переходом на `ask` и
принятым зелёным ТЗ-ревью. Targeted-тесты и process-gate перепрогнаны свежо
на точном материале и подтверждают отсутствие регрессии; Validate на этом же
SHA зелёный независимо проверен через GitHub API. AC1–AC3 доказаны
автотестами с обычными негативными свидетелями, защитные AC имеют
заполненную таблицу «чем краснеет». Задача готова к слиянию.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/916-stable-preflight`, коммит `8596fd9a97aa` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `3a6232afa96d56fa3cbf7e619e15802e0024297a`
  ```
  git log --all --format='%H %T' | grep 3a6232afa96d
  ```
- Тело issue: `28942cc2bdad7097d13114304b293a34f7161fd56f1dd4e06e1574a137bd51eb`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ1NzIsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NjY2OTk5OTk5OTk5OTk5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo0OCwib3V0cHV0X3Rva2VucyI6MjI5NjIsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6OTExMDAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoyMDE5NDE1LCJjb3N0VXNkRXN0aW1hdGUiOjAuOTk3OTk4OTk5OTk5OTk5OX1dLCJ0dXJucyI6MzYsImR1cmF0aW9uTXMiOjMwNzkzMywiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjEuMDAyNjY1OTk5OTk5OTk5OCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4620 output_tokens=22981 cache_creation_input_tokens=91100 cache_read_input_tokens=2019415 num_turns=36 -->
