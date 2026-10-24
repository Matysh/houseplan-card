# CODE-REVIEW #1055 · заход r1 · трек show

Материал: `dc70c9d037ccef4542766a01e1b8a427e793b214` (`origin/dev..HEAD`, один коммит
«ci: allow complete selected browser task checks (#1055)»). Рабочая копия уже на
этом SHA, fetch/checkout не делал.

## Скоуп

Чисто инфраструктурная CI-правка: конечный таймаут job `browser_selected` в
`validate.yml` и `validate-product.yml` поднят с 25 до 40 минут, чтобы выбранный
(не полный) план из #1051 успевал пройти целиком, включая 7 Golden-сцен. Состав
плана, индивидуальный лимит 180 с на файл, semantic assertions, Golden
intent/baseline policy и продуктовые perf-thresholds не трогаются — это видно по
диффу (изменены ровно 2 строки на файл, остальной job не тронут). Сопутствующие
правки: `docs/DEVELOPMENT.md` и `docs/STATUS.md` (объяснение бюджета job),
`docs/release-ledger/v1.82.0/1055.json` (категория infra) и
`scripts/ci-registry-inventory.json` (включение нового ledger-файла в реестр).
Продуктовый код, UI/конфиг/переводы не меняются; `User-Visible: no` — верно,
правок user-facing changelog нет и не требуется.

Trailers коммита: `Issue: #1055`, `User-Visible: no` — оба на месте, формат
верный.

## §5-критерии (track show, route)

- complexity ≤ 3 — да, точечная правка одного числового поля в двух идентичных
  job + документация.
- surfaces — одна поверхность (конфигурация CI job `browser_selected`).
- migration — нет миграции конфига, новых compatibility-полей нет.
- ux-contract — нет, `User-Visible: no`, поведение карточки не меняется.
- perf-touch — не затронуто: это бюджет времени CI-раннера, не продуктовая
  производительность; issue прямо разводит «оценка времени CI» и «обещание
  времени продукта».
- undocumented — поведение задокументировано в этом же коммите
  (`docs/DEVELOPMENT.md`, раздел «Browser progress checks on task pushes
  (#983)», и `docs/STATUS.md`).

Все критерии пройдены → `route: fix`.

## Как проверялось

Принят готовый proof: **review-light gate для `dc70c9d037ccef4542766a01e1b8a427e793b214`
завершён** — https://github.com/Matysh/houseplan-card/actions/runs/40051548282
(«review-light proof is complete»). Общие tsc/build/npm test/gate:small не
повторял — их покрывает этот proof.

Адресно (не входит в review-light proof, впрямую бьёт по изменённым файлам и
риску «правка не сломала смежную workflow-логику»):

1. `node --test test/workflow-hygiene.test.mjs test/validate-workflow.test.mjs
   test/browser-push-plan.test.mjs test/smoke-exception-guard.test.mjs
   test/ci-proof-registry.test.mjs test/release-ledger.test.mjs
   test/ci-registry-inputs.test.mjs` → 112 pass, 0 fail. Это покрывает: верхнюю
   границу `timeout-minutes` (1–180, тест #658 в `workflow-hygiene.test.mjs`),
   что job `smoke` (соседний, НЕ изменённый) по-прежнему держит ровно 25 минут
   (`smoke-exception-guard.test.mjs`), что структура плана/`browser_selected`
   как потребитель осталась консистентной (`validate-workflow.test.mjs`,
   `browser-push-plan.test.mjs`), и схему нового файла в `release-ledger`
   (`release-ledger.test.mjs`).
2. `node --test test/release-contract.test.mjs test/ci-registry-equivalence.test.mjs`
   → 25 pass, 0 fail — реестр версий/CI-инпутов не разошёлся с новым
   ledger-файлом.
3. `node scripts/status-snapshot.mjs` (без `--write`) и сравнение с рабочей
   копией `docs/STATUS.md` — байт-в-байт совпадает (дата и счётчики тестов не
   вписаны руками).
4. `npm run inventory` → Node unit 5191 · pure backend 626 · HA-harness backend
   527 · browser smokes 425 — совпадает с числами в `docs/STATUS.md`.
5. Регенерация `scripts/ci-registry-inventory.json` через
   `registryInventory()` из `scripts/ci-registry-inventory.mjs` и побайтовое
   сравнение с закоммиченным файлом — совпадает; новая запись
   `docs/release-ledger/v1.82.0/1055.json` не вписана мимо генератора.
6. Чтением: оба workflow-диффа (`validate.yml`, `validate-product.yml`) —
   изменены ровно по две строки (комментарий + `timeout-minutes: 25 → 40`) в
   job `browser_selected`, остальной job и все прочие jobs/таймауты в обоих
   файлах не затронуты (`git diff --stat` + полный `git diff`). Арифметика
   обоснования (176/218 × 1486 с ≈ 31 мин, запас до 40 мин) проверена как
   оценка — согласуется с цифрами issue, не заявлена как гарантия.

Мутанты не запускал — задача инфраструктурная (CI-конфиг, не продуктовый код),
issue прямо фиксирует «исполнение мутантов не требуется», и ни один AC здесь не
является продуктовым защитным инвариантом (валидация/гард пользовательского
поведения). Единственный защитный элемент — верхняя граница `timeout-minutes`
(1–180 мин), которую уже покрывает существующий зарегистрированный тест
`workflow-hygiene.test.mjs` (#658); он выполнялся выше и дал ordinary PASS.

## Находки

Находок нет — ни High, ни Medium, ни в скоупе, ни вне скоупа. Побочных находок
нет, в `REVIEW_FINDINGS` ничего не публикую (в этом прогоне нечего публиковать;
политика mode=issues использовалась бы только при Medium вне скоупа).

## Что проверено и корректно

- Таймаут `browser_selected` поднят конечным литералом 40 (не expression,
  не удалён) синхронно в обоих workflow, остальные jobs/лимиты не затронуты.
- Документация (`DEVELOPMENT.md`, `STATUS.md`) объясняет бюджет и явно
  оговаривает, что это не меняет: per-invocation лимит 180 с, selected IDs,
  semantic assertions, Golden intent, продуктовые perf-thresholds; частичный
  прошлый прогон явно не засчитан зелёным.
- `release-ledger/v1.82.0/1055.json`: `category: "infra"`, обоснование точно
  отражает диффу, `introducedBy` не нужен (не line-fix бета-функции).
- `scripts/ci-registry-inventory.json` синхронен с генератором.
- Трейлеры корректны, user-facing changelog не тронут и не должен быть.
- Целевые наборы тестов (112 + 25 = 137 кейсов) зелёные на материале.

## Чего не проверял

- Полный `npm test`/`gate:small`/ночной mutation-гейт — покрыты принятым
  review-light proof для этого SHA, повторный прогон не требовался (материал,
  окружение и oracle не менялись).
- Реальный прогон CI job `browser_selected` на GitHub Actions (живой Chromium,
  фактическое время 218 smoke + 7 Golden) — вне ревью кода: это произойдёт при
  следующем push/Validate и будет видно в её собственном proof; численная
  оценка 40 минут — решение автора с обоснованной арифметикой, не
  перепроверяется исполнением здесь.
- Поведение потребителя #1051 после ребейза (AC3) — это будущий шаг другой
  задачи, вне материала этого ревью.

## Маршрут побочных находок

Побочных находок не было — публиковать в issue или в `REVIEW_FINDINGS` нечего.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1055-selected-browser-job-budget`, коммит `dc70c9d037cc` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `4219d8bc1caa9392cf352e8cc3ec02adb6edff01`
  ```
  git log --all --format='%H %T' | grep 4219d8bc1caa
  ```
- Тело issue: `9d2e093cac6ab3e278b408dcd369a20e51e1405620eccc044e6a9dad6dc0e1cd`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUwOTIsIm91dHB1dF90b2tlbnMiOjIzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjA3fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo2MCwib3V0cHV0X3Rva2VucyI6MTg0MzcsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6Nzk4MzQsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxNzAwODU0LCJjb3N0VXNkRXN0aW1hdGUiOjAuODQzOTk2ODAwMDAwMDAwMX1dLCJ0dXJucyI6MzUsImR1cmF0aW9uTXMiOjI0NjA0NCwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuODQ5MjAzOCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5152 output_tokens=18460 cache_creation_input_tokens=79834 cache_read_input_tokens=1700854 num_turns=35 -->
