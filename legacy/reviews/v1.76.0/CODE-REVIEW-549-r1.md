# CODE-REVIEW-549-r1

**Issue:** #549 — «Ночные мутации: один неизменяемый SHA для всех shards и итогового отчёта»
**Материал:** `723ec6d3621051c1eaa260fab469a7dcb5478398` (branch `issue/549-nightly-material`, единственный коммит `ci: фиксировать material ночных мутаций (#549)`)
**Заход:** r1 · блокирующих циклов израсходовано 0 из 4
**Трек:** инфраструктурный (§1, ускоренный вход, метка `infra`) — файлов класса A нет, S-статусов до S7 не требовалось; issue взято владельцем напрямую в `S7-code-review`.

## Скоуп

Диапазон `origin/dev..HEAD` — один коммит, шесть файлов:

- `.github/workflows/mutation-gate.yml` — новый job `material` фиксирует commit/tree один раз, `mutants` чекаутится по этому SHA, новый job `evidence` доказывает единый material всех четырёх шардов, `report` использует доказанный material вместо повторного чтения `dev`;
- `scripts/mutation-gate-report.mjs` — `mutationShardEvidence`, `validateMutationShardEvidence`, `loadMutationShardArtifacts`, CLI-режимы `--write-evidence` / `--verify-only` / `--require-evidence`;
- `scripts/mutation-gate.mjs` — новый мутант-свидетель `mutation-report-accepts-foreign-material`, глушащий проверку `materialSha`;
- `test/mutation-gate-report.test.mjs`, `test/mutation-gate.test.mjs` — юниты на identity/evidence и на новую форму workflow;
- `docs/TESTING.md` — описание обновлено под новую схему.

Продуктовый код (`src/**`) не тронут. Трейлеры коммита: `Issue: #549`, `User-Visible: no` — верно, видимого поведения нет, изменений в changelog не требуется.

Задача устраняет риск, зафиксированный аудитом 2026-09-12 (§5.5, §10 строка 9): при движении `dev` во время долгого ночного прогона разные части (шарды и итоговый report) могли ссылаться на разные деревья, а результат — приписываться последней вершине.

## Как проверялось

Дешёвые гейты уже зелёные на этом SHA (Validate run, ссылка в системном промпте) — `tsc`, `npm test` (весь набор) и `npm run build` не перегонялись повторно.

Прогнано мной дополнительно, так как это ядро дельты этого раунда:

| Команда | Результат |
|---|---|
| `node scripts/mutation-gate.mjs --check` | все якоря патчей применимы, включая новый `mutation-report-accepts-foreign-material` |
| `node scripts/mutation-gate.mjs --id=mutation-report-accepts-foreign-material` | guard `node --test --test-name-pattern="foreign SHA и отсутствующий шард" test/mutation-gate-report.test.mjs` красный на мутанте → «поймано 1 из 1» |
| `node --test test/mutation-gate-report.test.mjs test/mutation-gate.test.mjs` | 63/63 ok |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет» — браузерные smoke не выбираются, выбирать нечего (диф не трогает `src/**`) |
| `node scripts/process-gate.mjs --base=origin/dev --issues` | пройден, единственное предупреждение — ожидаемое (инфраструктурный диапазон, статусная метка не нужна до S7) |

**Что не проверялось и почему:** `npx tsc --noEmit`, полный `npm test` заново и `npm run build` — уже зелёные на этом SHA (Validate). `npm run golden:verify` — diff не меняет рендер. `python -m pytest tests_backend` — `custom_components/**` не тронут. `npm run invariants` — geometry/`layout`/`marker.space`/толщина не задеты. Браузерные smoke — инструмент подтвердил «нечего выбирать».

## Разбор по AC (тело issue #549)

1. **Dev меняется после запуска/между shards/перед report — итог продолжает ссылаться на первоначальный material SHA.**
   Job `material` чекаутит `dev` (или `inputs.ref` для dispatch) один раз, фиксирует `sha`/`tree` через `git rev-parse` (`mutation-gate.yml:56-65`). `mutants` чекаутится по `needs.material.outputs.sha` (`:79-82`), а не по `dev` заново. `report` больше не делает `git rev-parse HEAD` после повторного чекаута `dev` (это было причиной прошлой находки r1/#472) — теперь чекаутит `${{ github.sha }}` только ради кода отчётчика и передаёт `--sha=${{ needs.material.outputs.sha }}` (`:192-218`). Подтверждено тестом `test/mutation-gate.test.mjs` («moving ref фиксируется один раз») и прочитано в самом YAML. **Доказано.**

2. **Каждый artifact содержит SHA; агрегатор отвергает смешанные/неполные evidence, а не пишет общий green.**
   `mutationShardEvidence` требует полные 40-символьные `materialSha`/`materialTree`/`workflowSha` и целые `runId`/`runAttempt`/`shard`/`shardCount`, иначе бросает (`mutation-gate-report.mjs:43-61`). `validateMutationShardEvidence` для каждого из 4 шардов проверяет совпадение всех полей с `expected`, иначе пишет `foreign material SHA` / `foreign material tree` / `foreign run id` / `impossible run attempt`, и итог `ok=false` (`:69-109`). Job `evidence` в `--verify-only` завершается ошибкой (`process.exitCode = 1`) при `ok=false`, то есть это не просто рекомендация, а красный статус job (`mutation-gate-report.mjs:298-301`). Проверено чтением и юнитами `#549: foreign SHA и отсутствующий шард отвергаются fail-closed`, дополнительно — мутационным свидетелем (см. выше). **Доказано.**

3. **Rerun/частичный повтор явно сохраняет либо заново фиксирует согласованный material для всего набора.**
   Механика GitHub Actions: «rerun failed jobs» переиспользует output успешно завершившихся job — если `material` уже отработал, его `sha`/`tree` остаются теми же и для нового `run_attempt`, так что перезапущенный шард пишет evidence с тем же `materialSha`, что и уцелевшие шарды прежней попытки; `validateMutationShardEvidence` при этом берёт по каждому shard **самый новый** attempt (`byShard`, `:81-88`), что подтверждено тестом «partial retry выбирает новый attempt, но сохраняет единый material». Полный rerun («re-run all jobs») пересоздаёт `material` заново с текущим `dev` — тогда все четыре шарда и evidence одной попытки согласованно ссылаются на новый material. Разобрано по коду и механике Actions, не воспроизведено живым прогоном (это требует реального workflow dispatch с искусственным rerun — вне доступных инструментов ревью). **Проверено чтением, не исполнением.**

4. **Negative fixture с artifact другого SHA обнаруживается.**
   `test/mutation-gate-report.test.mjs` — `#549: foreign SHA и отсутствующий шард отвергаются fail-closed` и `#549: partial retry с другим material не склеивается со старыми шардами`; оба прогнаны (63/63 включает их). Плюс мутационный свидетель `mutation-report-accepts-foreign-material`, который глушит именно строку проверки `materialSha` и подтверждает, что без неё тест обязан покраснеть — прогнан лично, «поймано 1 из 1». **Доказано автотестом, тест умеет падать (проверено запуском мутанта).**

Ограничение из тела issue («Сохранить #513: полный набор вне повседневного цикла») не нарушено: `on:` в `mutation-gate.yml` не менялся (`workflow_dispatch` + `schedule`), в push/PR-гейты job не добавлен.

## Что проверено и корректно

- Скоуп строго инфраструктурный (классы B/C), продуктовый код не тронут — соответствует ускоренному треку §1.
- Fail-closed выдержан и на крайних случаях: если `material` не запустился и job `mutants` пропущен, `evidence` (у него `if: always()`) не найдёт вообще ни одного артефакта и получит `evidence is missing` по всем 4 шардам — красный итог, не пропуск.
- Если шард падает на раннем шаге (до `node scripts/mutation-gate.mjs`), «Записать identity шарда» (`if: always()`) всё равно пишет `evidence.json`, но лог-файл физически отсутствует — `loadMutationShardArtifacts` добавляет `log is missing`, тоже красный итог, а не молчаливый пропуск.
- `docs/TESTING.md` обновлён в том же коммите, описание соответствует коду.
- Один источник числа: `materialSha`/`materialTree` берутся из единственного job `material` и передаются как есть во все нижестоящие job без параллельного пересчёта — расхождения «посчитано дважды» не возникает.

## Находки

Нет находок уровня High или Medium. Мелких Low-находок, требующих правки или явного снятия, тоже не нашёл: реализация закрывает все четыре AC, тесты содержательны, мутационный свидетель подтверждён личным прогоном.

## Вердикт

Зелёный. AC выполнены и доказаны (три — автотестом с подтверждённой способностью падать, один — чтением кода и механики GitHub Actions с явной пометкой). Дешёвые гейты, относящиеся к этой дельте, прогнаны лично и зелёные; более широкие гейты (build/tsc/golden/invariants/pytest/browser-smoke) не требовались диффом и не прогонялись обоснованно.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/549-nightly-material`, коммит `723ec6d36210` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `479c34eaa9e809f5daa13dc5b6f0833a7ea56318`
  ```
  git log --all --format='%H %T' | grep 479c34eaa9e8
  ```
- Тело issue: `61a94896cf07a1fabc1d54fcfdb78d67d71e76f0e027e9bb3f9538094ec940fd`
- Вердикт конвейера: `green` · High 0
