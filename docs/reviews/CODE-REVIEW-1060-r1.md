# CODE-REVIEW-1060-r1

Issue: [#1060](https://github.com/Matysh/houseplan-card/issues/1060) · Этап: code · Трек: ask · Заход: r1 · блокирующих циклов 0/4

Материал: `d352775c6df35f1d5f8e461f92421fc1dcf8ce8b` (HEAD, рабочая копия на нём), база `3efc9b0b4e43dc3a0b23f5eb4be22a6f8ba0dcc9`. Коммиты:
`2a0cbd411` "Bound task checks and authenticate unchanged CI work", `d352775c6` "Keep smoke intent independent of Golden acceptance" — оба с трейлерами `Issue: #1060` и `User-Visible: no`. Расхождений нет.

## Скоуп

Чистая инфраструктура CI: `scripts/{ci-proof*,ci-registry-*,ci-profile*,classify-base,validate-gate,merge-candidate,smoke-select,browser-push-plan,gate-small,task-*}`, сгенерированные `.github/workflows/validate*.yml` и `scripts/ci-profile-paths.json`/`scripts/ci-registry-inventory.json`, адресные тесты, `test/data/smoke-selection-history.json`, `PROCESS.md`/`ARCHITECTURE.md`/`DEVELOPMENT.md`/`TESTING.md`/`STATUS.md`, `docs/release-ledger/v1.82.0/1060.json`. Продуктовые `src/`, Python-интеграция, эталоны и релизные артефакты не затронуты — видимого пользователю поведения нет, `User-Visible: no` на обоих коммитах верен.

Release-ledger: `category: infra`, `baseStable: v1.82.0` совпадает с `docs/release-ledger/cycle.json`; обоснование («восстанавливает reuse, ограничивает unit-плановые проверки, убирает дубли, разделяет доказанную зелёную базу от судимого диапазона, не меняет продуктовое поведение») соответствует диффу. Корректно не получает пользовательский milestone (infra не входит, §11.9).

Четыре AC задачи:
- **AC1** — рабочий проверяемый reuse (immutable policy + computed tooling dependencies).
- **AC2** — ограниченный выбор browser-проверок (фиксированные пороги, explicit-first, historical replay).
- **AC3** — устранение дублирующих исполнений CI (ожидание companions, scoped receipts, запрет reused→producer).
- **AC4** — актуальная доказанная база dev (integration base отдельно от судимого диапазона).

Все четыре — защитные AC (валидация/отказ/инвариант), для каждого ниже — таблица «AC · чем доказан · чем краснеет».

## Как проверялось

Принятый proof для материала подтверждён validate-gate (https://github.com/Matysh/houseplan-card/actions/runs/40126588128, "review-light proof is complete"). Используется как есть, не повторяется: build/typecheck, product+tooling unit-группы, bundle-policy/budget, unused/CSS/layout/private-write guards, `gate:small` 242с/failed=0 — приняты из хендоффа и proof, отдельно не гонялись.

Непокрытых адресных пробелов — по одному на каждый AC плюс сквозные свойства (монолит-список, свежесть generated outputs, doc-consistency). Для них выполнен точечный прогон существующих (не изменённых мной) тестовых файлов — обычное исполнение, без патчей кода/гвардов/мутантов:

| Проверка | Команда | Результат |
|---|---|---|
| AC1: real policy ↔ independent equivalence, подмены таблиц/budget/local-vs-remote | `node --test test/ci-registry-inputs.test.mjs` | 17/17 PASS |
| AC1/AC3: scoped task receipts, запрет reused-цепочки, companion-аутентификация | `node --test test/task-check-reuse.test.mjs test/task-check-source.test.mjs test/task-check-workflow.test.mjs` | 36/36, 7/7(top)/*, 2/2 — все PASS |
| AC3: S7/merge discovery, delayed push, canonical fallback | `node --test test/validate-gate.test.mjs test/merge-candidate.test.mjs` | 36/36, 86/86 (вместе с task-packet/gate-small) PASS |
| AC4: integration base vs judged range, red/partial/foreign/unavailable | `node --test test/classify-base.test.mjs` | 39/39 PASS |
| AC2: фиксированные пороги, overflow-defer, historical replay 223→41/168→34/75→17 | `node --test test/smoke-select.test.mjs` | 20/20 PASS |
| AC2: declared smokes независимы от Golden epoch (коммит `d352775c6`) | `node --test test/task-visual-intent.test.mjs` (тест `#1060 Golden acceptance expires visual changes but preserves declared smokes locally and in CI`) | 4/4 PASS |
| Монолит-список не расширен | `git diff` на `test/monolith-text-anchors.test.mjs` (пусто) + `node --test test/monolith-text-anchors.test.mjs` | diff пуст, 2/2 PASS |
| Свежесть `scripts/ci-registry-inventory.json` | `node scripts/ci-registry-inventory.mjs` (без `--write`) + assert в `test/ci-registry-inputs.test.mjs:140` | exit 0, тест в составе 17/17 PASS |
| Дубль-сканер удалён, не оставлен параллельно | `git diff` `scripts/task-check-scope.mjs`/`scripts/tooling-dependencies.mjs`/`scripts/ci-registry-equivalence.mjs`, `grep -rn "scanJavaScript\|relativeDependencies" scripts/` | старое тело BFS вырезано из `task-check-scope.mjs`, перенесено byte-for-byte в новый `tooling-dependencies.mjs`; `ci-registry-equivalence.mjs` переключён на него; остальные вызовы `relative-dependencies.mjs` — независимые существовавшие потребители |
| Workflows (generated): `task_reuse`/`receipt` гейтинг, `contents: write` только на non-fork, `classify-base --mode=integration` развод base/range_base | чтение диффа трёх `validate*.yml` + кода `classify-base.mjs`/`ci-profiles.mjs` | логических ошибок (needs/if/удалённые шаги) не найдено |
| Doc↔code consistency диффнутых абзацев PROCESS/ARCHITECTURE/DEVELOPMENT/STATUS | построчное сопоставление с кодом и тестами | согласовано по смыслу, одно расхождение — см. находки |

Чего не проверял: полный `npm test`/`tsc`/`gate:small`/build (покрыты принятым proof, см. выше), browser smokes/Golden/performance и исполнение мутантов (`mutation-gate.mjs --check` — PASS, только статика, `execution=0` — это предрелизный/ночной объём, явно отмечено автором как «НЕ сделано» и корректно не требуется на этом этапе), реальное выполнение `ci-registry-cli.mjs --publish-proof` в GitHub Actions (только статический разбор workflow и соответствующих unit-тестов), построчный аудит частей `ARCHITECTURE.md`/`DEVELOPMENT.md`, не относящихся к диффу #1060.

## Находки

### Low — неверный путь фикстуры в документации

`docs/DEVELOPMENT.md:4955` (абзац добавлен этим диффом): «Read-only replays in `test/fixtures/smoke-select/historical-plans.json`…» — такого файла не существует. Реальный новый файл — `test/data/smoke-selection-history.json`, зарегистрирован в `scripts/ci-profile-paths.json:144` и используется в `test/smoke-select.test.mjs:12` и `test/browser-push-plan.test.mjs:14`.

Воспроизведение:
```
grep -n "historical-plans" -r .            # ничего, кроме DEVELOPMENT.md:4955
ls test/fixtures/smoke-select/             # historical-plans.json отсутствует
ls test/data/smoke-selection-history.json  # существует, 3066 строк
```
Числа в этом же абзаце (41/34/17 вместо 223/168/75) верны и подтверждены исполнением (см. таблицу выше) — ошибка только в пути. Функционального риска нет: тесты и генератор ссылаются на правильный путь, AC2 это не затрагивает. Снимается записью: автор правит путь в `docs/DEVELOPMENT.md` при следующей правке этого абзаца; цикла не открывает.

Других находок — High и Medium, в скоупе или вне скоупа — нет. Побочных находок нет: заводить issue по политике `mode=issues` не из чего (снимок `HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`, issue 1060, stage code, round 1 — сверен, расхождений с REVIEW_FINDINGS_POLICY не обнаружено).

## Что проверено и корректно

- **AC1.** `scripts/ci-registry-equivalence.mjs::validateSnapshotPolicy` теперь пересчитывает реальный `immutableToolingDependencies` из immutable Git-объектов (batched `readMany`/budget), сверяет с закоммиченными `ci-profile-paths.json`/`ci-registry-inventory.json` и явно разделяет allow-exclusions (`tooling`) от positive-triggers (`!test/*.test.mjs` в `product`) — именно баг из примера в issue («Генератор profilePaths получил tooling dependencies, независимая проверка осталась на старом вызове») исправлен на уровне вызова, не точечным патчем. Старый inline-сканер (`task-check-scope.mjs`) удалён и заменён общим `tooling-dependencies.mjs`; дублирующей реализации не осталось (проверено чтением и grep).
- **AC2.** `smoke-select.mjs` заменил относительный `BROAD_SHARE=0.2`/`0.05` на абсолютные `MAX_SYMBOL_SMOKES=32`/`MAX_RARE_SMOKES=8`/`MAX_INFERRED_SMOKES=32` — рост чужого корпуса больше не расширяет «широкий» список (тест `#1060 corpus growth cannot promote broad or weak names...`, исполнен). Оверфлоу lexical-кандидатов откладывает весь неявный набор целиком, но не усекает registered/changed/declared/visual-minimum (`requiredSmokeIds`, тест `#1060 overflow defers the whole inferred set and preserves every explicit route`). Historical replay (`test/data/smoke-selection-history.json`) реально прогоняется через `selectSmokeConnections` и даёт заявленные 41/34/17 вместо 223/168/75 — подтверждено исполнением, не чтением файла. Коммит `d352775c6` отдельно отвязал `declaredSmokes` от эпохи Golden (`task-intent.mjs::readTaskIntent` не проверяет `baselineIndex`, в отличие от `readTaskVisualIntent`) — подтверждено тестом `#1060 Golden acceptance expires visual changes but preserves declared smokes locally and in CI`, где после `accepted:"beta"` `golden.mode` становится `none`, но `smoke.ids` остаётся прежним.
- **AC3.** `scripts/task-check-reuse.mjs`/`task-check-source.mjs` требуют прямого успешного producer (run/attempt/job/timestamps/companion green), запрещают цепочку reused→reused (`direct.mode !== 'executed'` → отказ) и проверяют, что `registryPublicationRecords` публикует только executed-записи, не reused (тест `#1060 scoped receipts use the existing immutable index and cannot publish a reused chain`). `merge-candidate.mjs`/`validate-gate.mjs` дожидаются `missing-companion` в пределах `VALIDATE_APPEAR_MS`, не создавая второй producer по первому пустому ответу API; `productPushExpected` отдельно учитывает force-push (не даёт «доказательства» fast-forward).
- **AC4.** `classify-base.mjs::integrationBases` разводит `base` (доказанное зелёное покрытие product+companions на точном SHA/tree) и `range` (судимый диапазон для process-гардов); красный/частичный/чужой/недоступный результат не становится `base` (`base.proven=false`) — проверено таблицей из 19+ видов порчи в `test/classify-base.test.mjs`, целиком выполненной. Более новый red/partial не прячется за старым green на том же SHA; при недоказанной базе `validate.yml` явно расширяет проверки (`classify-changes.mjs --all`), не сужает.
- Сгенерированные файлы (`scripts/ci-profile-paths.json`, `scripts/ci-registry-inventory.json`, три `validate*.yml`) актуальны — проверено прогоном генератора и штатным тестом сверки, а не чтением diff как единственного источника истины.
- Монолит-список `FROZEN_TEXT_ANCHOR_TESTS` не тронут, новых regex-по-тексту тестов не добавлено.

## Таблица «AC · чем доказан · чем краснеет»

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 | `test/ci-registry-inputs.test.mjs` (17/17, исполнено) | `'#1060 actual generated Git policy authenticates reuse and rejects counterfeit dependency/exclusion lists'` — 5 подмен таблицы/зависимостей → `assert.rejects(/computed policy differs/)`; symlink-вход → `/missing\/unsafe/` |
| AC2 | `test/smoke-select.test.mjs` (20/20, исполнено) | `'#1060 corpus growth cannot promote broad or weak names...'` и `'...overflow defers the whole inferred set...'` — явные `assert.deepEqual`/`assert.equal` на испорченном/разросшемся корпусе |
| AC3 | `test/task-check-reuse.test.mjs`+`task-check-source.test.mjs`+`task-check-workflow.test.mjs` (36+7+2, исполнено) | `ci-proof.test.mjs:205` `'#1060 task reuse requires an independently verified exact record...'` — 4 испорченных контекста → `status==='failed'`; `task-check-workflow.test.mjs:37` — reused-запись не публикуется |
| AC4 | `test/classify-base.test.mjs` (39/39, исполнено) | `'#1060 split status cannot replace missing, red, foreign or partial proof and companions'` — 19 вариантов порчи → `base.proven===false`; `'...latest red product cannot hide behind an earlier green run...'` |

Все четыре строки имеют непустой третий столбец с реально исполненным (не статическим) негативным свидетелем — требование §2.7 выполнено.

## Маршрут

`route: fix` (не `show`, критерий §5 не применяется).

## Вердикт

Один Low без функционального риска, снимается записью; High/Medium — 0. Задача полностью покрыта реально исполненными негативными тестами по всем четырём защитным AC, соответствие коду и документации подтверждено построчно и исполнением, а не чтением диффа.

**Вердикт: зелёный**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1060-ci-targeted-reuse`, коммит `d352775c6df3` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a491ce8a2c1cb5f3acf5a4d1e5e981708ba3e45f`
  ```
  git log --all --format='%H %T' | grep a491ce8a2c1c
  ```
- Тело issue: `7ee61b102d7345a854b770395dbffb45325fc23b9cd13f01ba5745d1fa6dab82`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ3NzksIm91dHB1dF90b2tlbnMiOjIzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0ODk0fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoyMTIsIm91dHB1dF90b2tlbnMiOjU2MzY3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjI3MTIwMywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjk4NDUwODEsImNvc3RVc2RFc3RpbWF0ZSI6My40NjE5ODIyMDAwMDAwMDA1fV0sInR1cm5zIjo3NiwiZHVyYXRpb25NcyI6NDg3NzAzLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6My40NjY4NzYyMDAwMDAwMDA2LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=4991 output_tokens=56390 cache_creation_input_tokens=271203 cache_read_input_tokens=9845081 num_turns=76 -->
