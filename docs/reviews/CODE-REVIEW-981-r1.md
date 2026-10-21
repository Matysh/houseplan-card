# CODE-REVIEW-981-r1

Материал: `8791276f736b196f6ef946b4a89702459bbf1589` (ветка `issue/981-content-proof-registry`,
база — текущий `dev`). Заход r1, блокирующих циклов израсходовано 0 из 4. Трек `ask`,
инфраструктурная задача (класс B/C), прямой вход в `S7-code-review` без отдельного
ревью ТЗ — согласно AGENTS.md «инфраструктурная задача … входит на S7-code-review».

## Скоуп

Issue #981 (источник — внутренний аудит CI 21.10.2026, связано с #954 п.2/п.5, #492,
#541, #573, #856): замена привязанных к ветке `actions/cache`-маркеров переиспользования
гейтов Validate на content-addressed реестр `ci-proofs` (orphan-ветка), версия-инвариантный
`candidate-tree-id` для кандидата беты, и включение `frontend` в число переиспользуемых job.
Пять AC: AC1 (наследование на `dev` после слияния), AC2 (наследование/полнота для
кандидата беты), AC3 (отрицательные свидетели реестра), AC4 (`reuse` ≤ 15 с, маркеры
`actions/cache` сняты, pre-push читает тот же реестр), AC5 (замер машинных минут до/после).
Продуктовый код (`src/**`, `custom_components/**`) не затронут — трейлеры `User-Visible: no`
на всех 10 коммитах корректны, changelog не требуется.

## Как проверялось

Дешёвые гейты на материале `8791276f7` уже зелёные (см. «Чего не проверял»): Validate run
[39569032097](https://github.com/Matysh/houseplan-card/actions/runs/39569032097) —
`conclusion: success`, `headSha` сверен командой `gh run view` и совпадает с материалом
побайтово. Поверх этого самостоятельно прочитан весь дифф (43 файла, +10960/-977) и
прогнаны выбранные по диффу/AC проверки:

| Гейт | Команда | Результат |
|---|---|---|
| Выбор смоков по диффу | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Browser-smoke этим диффом не выбираются» — `src/**/*.ts` не тронут, смоки проверять нечего |
| Новые юниты реестра (реальное исполнение) | `node --test test/ci-proof-registry.test.mjs test/ci-registry-inputs.test.mjs` | 55/55 PASS локально, включая настоящий bare-Git CAS/orphan фикстуры и реальный `npm run build`/`broken.mjs`-отказ |
| Классификация релиза | `validateEntry()` из `scripts/release-ledger.mjs` на `docs/release-ledger/v1.81.0/981.json` | `OK valid`; категория `infra` не входит в пользовательский milestone (`isUserReleaseEntry` ложно) |
| Сверка SHA Validate-прогона | `gh run view 39569032097 --json headSha,conclusion` | `headSha=8791276f7…`, `success` |

Инвариантов модели (геометрия не тронута), `pytest tests_backend` (Python backend не тронут),
`golden:verify` (метки `ci:golden` нет, рендер не тронут) и performance (в AC не назван) —
не прогонялись, по диффу они не применимы (см. «Чего не проверял»).

Прочитаны целиком: `scripts/ci-registry-inputs.mjs`, `ci-registry-verify.mjs`,
`ci-registry-equivalence.mjs`, `ci-proof-registry.mjs`, `ci-registry-cli.mjs`,
`ci-registry-records.mjs`, `ci-registry-build.mjs`, изменения в `ci-proof.mjs`; дифф
`.github/workflows/validate.yml` и `validate-product.yml` целиком (job `changes`, `reuse`,
`frontend`, `bundle`, `product_guards`, `smoke`/`smoke_done`, `golden`, `performance_smoke`,
`geometry_parity`, `backend`, `proof`); тесты `test/ci-proof-registry.test.mjs`,
`test/ci-registry-inputs.test.mjs`, дифф `test/validate-workflow.test.mjs`,
`test/development-loop-954.test.mjs`, `test/proof-loop-856.test.mjs`,
`test/classify-changes.test.mjs`; дифф `PROCESS.md`, `docs/ARCHITECTURE.md`,
`docs/DEVELOPMENT.md`, `docs/TESTING.md`, `docs/STATUS.md`,
`docs/ci/981-registry-evidence.md`, `docs/release-ledger/v1.81.0/981.json`; дифф
`scripts/mutation-registry.mjs` (новые определения мутантов #981).

## Находки

Находок уровня High или Medium нет.

Низкий уровень/наблюдения, не блокирующие:
- `ci-registry-verify.mjs`/`ci-registry-cli.mjs` принимают параметр `night` в
  `registryPolicy({ fresh, night, stable, candidate })`, но ни один workflow не
  прокидывает `NIGHT_INPUT` — ночной прогон полагается исключительно на
  `-f fresh=true` из `scripts/workflow-pending.mjs:53`, что фактически достаточно
  (подтверждено чтением: `intentPolicy` строит `registryPolicy({fresh: bool(FRESH_INPUT), ...})`,
  и `allowed = !(fresh || night || stable)`), но сам параметр `night` сейчас
  мёртв. Не блокирует AC — ночь и так получает fresh по `fresh=true`; фиксирую
  как наблюдение, не нахожу эффект на поведение.

## Проверено и корректно (по AC)

- **AC3 (отрицательные свидетели — защитный AC).** Таблица «AC · чем доказан · чем
  краснеет»:

  | AC | Чем доказан | Чем краснеет |
  |---|---|---|
  | AC3 red/cancelled/incomplete source | `test/ci-registry-inputs.test.mjs`/`ci-proof-registry.test.mjs`, обычный прогон (см. таблицу выше, 55/55 PASS) | `refusals.red`/`cancelled`/`incomplete` в `test/ci-proof-registry.test.mjs:43-45` — реальный assert на `accepted === false` при каждой подмене `run.conclusion`/`status`; тест падает, если убрать проверку (подтверждено чтением сопоставленных строк `ci-registry-verify.mjs:30-31`, не мутацией реализации — правило §2.7/#905) |
  | AC3 другой toolchain/recipe/tree/key | то же | `refusals.otherToolchain/otherRecipe/otherTree/otherKey` (строки 46-49) против `ci-registry-verify.mjs:21-25` |
  | AC3 чужой repo/workflow/branch | то же | `refusals.foreignWorkflow/foreignRepository/foreignBranch` (50-52) против `ci-registry-verify.mjs:27-30` |
  | AC3 несовпадающий attempt/sha/revision | то же | `refusals.otherAttempt/otherSha/otherRevision` (53-55) против `ci-registry-verify.mjs:32-36` |
  | AC3 истёкший/будущий/битый timestamp, истёкший артефакт | то же | `refusals.expired/future/corruptTime/expiredArtifact/wrongArtifactAttempt` (56-60) против `ci-registry-verify.mjs:41-48` |
  | AC3 отсутствующий/не зелёный actual job | то же | `refusals.missingActualJob/duplicateActualJob/redActualJob/incompleteActualJob` (61-64) против `ci-registry-verify.mjs:37-40` |
  | AC3 подмена реестра/inventory/companion | то же | `refusals.tamperedIndex/tamperedInventory/missingInventory/missingImmutableRecord/missingImmutableProof/redCompanion` (68-73) против `ci-registry-verify.mjs:46-61` |
  | AC3 расхождение фактических Git-входов/recipe при совпавшем ключе (forged key) | `test/ci-registry-inputs.test.mjs` — «actual proof/lookup/producer recipes … cannot lie behind identical metadata» (183-194), реальный bare Git с подменённым trust-кодом | `assert.rejects(..., /ci-registry-cli/)` и `/actual workflow recipe/` в `ci-registry-equivalence.mjs:42,97` — настоящее исполнение с реальными git-объектами, не regex по тексту |
  | AC3 corrupt JSON в реестре | `test/ci-proof-registry.test.mjs:142-146` — реальный bare-Git коммит с `{corrupt JSON` в ветке `ci-proofs` | `fetchRegistry(a).read(...) === null` (JSON.parse ловится в `ci-proof-registry.mjs:18-19`) |
  | AC3 beta — маска не должна стирать другие байты | `test/ci-registry-inputs.test.mjs:70-78,202-213` | `maskJsonScalars`/`sourceEquivalenceCommon` бросают на несинхронных/посторонних изменениях (`ci-registry-inputs.mjs:87`, `ci-registry-equivalence.mjs:75`) |

  Все перечисленные тесты реально исполнены локально в рамках этого ревью (таблица
  гейтов выше, 55/55 PASS) — это обычные negative-input cases на неизменённой
  реализации, не правка исполняемого кода ради проверки (политика #905 соблюдена:
  правок в скрипты/сборки я не вносил).

- **AC3, продолжение — зарегистрированные мутанты.** `scripts/mutation-registry.mjs`
  добавляет 4 новых определения (`ci-registry-trusts-claimed-git-inputs`,
  `ci-registry-trusts-tampered-index`, `ci-registry-accepts-absent-actual-job`,
  `ci-registry-masks-whole-json`), каждое со своим `guard`-тестом; статическая
  регистрация подтверждена, исполнение — задача ночного мутационного прогона
  (#709), не ревью (политика общая, не ослаблена).

- **AC1/AC2 (наследование по дереву, candidate-tree-id).** Прочитано чтением, не
  исполнением полного сценария push в `dev` (структурно недоступен до S8 — см.
  «Чего не проверял», прецедент — CODE-REVIEW-954-r1 трактует такое же ограничение
  как честно отмеченное, не блокирующее). Логика `registryInputs`/`versionNormalizer`/
  `maskJsonScalars` (`ci-registry-inputs.mjs:60-116`) правильно маскирует только 7
  синхронизированных scalar-зеркал версии (`package.json`, `package-lock.json` дважды,
  `manifest.json`, `const.py`, два `CARD_VERSION`), сохраняя остальные байты —
  подтверждено исполнением `test/ci-registry-inputs.test.mjs` («beta normalization
  masks every synchronized canonical mirror, preserves every other byte», 61-69, и
  «JSON mask cannot erase …», 70-78). Автор независимо продемонстрировал сквозной
  цикл на контролируемом материале до ребейза: полный producer
  [39561557339](https://github.com/Matysh/houseplan-card/actions/runs/39561557339) и
  унаследовавший все 6 семейств кандидат
  [39561608307](https://github.com/Matysh/houseplan-card/actions/runs/39561608307) —
  данные воспроизведены в `docs/ci/981-registry-evidence.md:20-28`, числа (83.20/8.70
  машинных мин, 12 immutable записей) не противоречат друг другу и фигурируют один раз
  с одним источником (прогон, а не повторный пересчёт).

- **AC3, skip-propagation (диагностический баг, найденный самим автором).**
  Диагностический run [39557393281](https://github.com/Matysh/houseplan-card/actions/runs/39557393281)
  был зелёным в Actions, но пропустил `product_guards`/`bundle` — задокументировано
  в `docs/ci/981-registry-evidence.md:36-41`. Фикс подтверждён чтением: все job,
  зависящие от `reuse`/`bundle` через `if: always()`, теперь несут явные
  `needs.X.result == 'success'` (`validate-product.yml`: `bundle` строка ~890,
  `product_guards` ~924, `browser_selected`/`smoke`/`smoke_done`/`golden`/
  `performance_smoke`/`dev_build` — грепом подтверждено 9 мест с явным условием
  в обоих workflow-файлах). `evaluateCiProof` отдельно требует `bundle`/
  `product_guards` «executed/success» всегда, когда `proof.registry` присутствует
  (`ci-proof.mjs:462-471`) — подтверждено реальным исполнением теста
  «unchanged pre-registry dev reader accepts the fresh additive v1 migration proof»
  (`test/ci-proof-registry.test.mjs:175-199`, строка 197-198 — удаление
  `product_guards` из списка job даёт `status: 'failed'`).

- **AC4 (`reuse` ≤ 15 с, снятие `actions/cache`).** `timeout-minutes: 1` на job
  `reuse` в обоих workflow; `registryProbeCli` ограничивает сетевой бюджет 8 секундами
  (`ci-registry-cli.mjs:56-57`). `actions/cache/restore|save` для прежних маркеров
  переиспользования в diff-е `reuse`/`smoke_done`/`golden`/`performance_smoke`/
  `geometry_parity`/`backend` удалены целиком (подтверждено чтением диффа — все блоки
  «Маркер …»/«Записать маркер успеха» заменены на `ci-registry-cli.mjs --stamp-job=…`).
  Автор приводит реальные измерения 13 с/10 с (`docs/ci/981-registry-evidence.md:28,30,41`).
  Локальный `local-registry-proof.mjs` читает тот же реестр (прочитан, использует
  `fetchRegistry`/`cleanRegistryInputs` из тех же модулей).

- **AC5 (замер машинных минут).** `docs/ci/981-before-week.json` (популяция 113
  обычных push + 12 кандидатов, 14–20.10 UTC) и `docs/ci/981-controlled-after.json`
  (точные job seconds без billing rounding) присутствуют и описаны в
  `docs/ci/981-registry-evidence.md`; методология (кандидат определяется по
  trailer `Release:` фактического коммита, не по заголовку) честная и
  воспроизводимая. «После» для реального трафика на `dev` принципиально
  недоступно до S8 — отмечено автором прямо, не выдаётся за исполненное.

- **Трейлеры и changelog.** Все 10 коммитов несут `Issue: #981` и
  `User-Visible: no`; продуктовый код не тронут, changelog не требуется —
  условие §3 п.10 не нарушено.

- **Классификация release-ledger.** `docs/release-ledger/v1.81.0/981.json` —
  `category: infra`, `rationale` по существу; `validateEntry()` из
  `scripts/release-ledger.mjs` принимает запись (`OK valid`), `isUserReleaseEntry`
  для `infra` ложно — пользовательский milestone не затронут, что соответствует
  природе задачи (чистая CI-инфраструктура, без видимого пользователю поведения).

- **Одно число — один источник (§8).** `docs/STATUS.md` (Node unit 4962→5009,
  browser smokes 401→402) сгенерирован инструментом `status-snapshot.mjs`, не
  вручную; количество новых юнит-тестов (+47) соответствует объёму новых тестов
  в `ci-proof-registry.test.mjs` (28 параметризованных `refusals` + ~12 прямых
  тестов) и `ci-registry-inputs.test.mjs` (13 тестов) после вычета старых
  удалённых/переписанных кейсов — не обнаружено дублирующегося счёта одной и той
  же величины с разным источником.

## Чего не проверял

- **Полное исполнение сценария AC1 на реальном push `dev`.** Структурно
  недоступно на этапе код-ревью: автоматический push в `dev` происходит только
  после зелёного вердикта (S8), поэтому «реальный пуш dev со ссылкой» из текста
  AC1 не может существовать на момент этого ревью. Логика наследования
  проверена чтением (`ci-registry-inputs.mjs`, `ci-registry-equivalence.mjs`) и
  исполнением её юнит-тестов, плюс контролируемым прогоном на пред-ребейзном
  SHA (см. выше). Прецедент — `docs/reviews/CODE-REVIEW-954-r1.md`: такое же
  структурное ограничение зафиксировано как «честно помечено как неисполненное
  ожидание», не как находка.
- Полные `npm test`/`npx tsc --noEmit`/`npm run build`+`bundle-policy --verify` —
  не перегонялись: зелёный Validate на материале `8791276f7` (run 39569032097,
  `headSha` сверен) уже подтверждает их; перегонял только точечно (таблица выше).
- `golden:verify`, `pytest tests_backend`, `npm run invariants` — не прогонялись:
  метки `ci:golden` нет, Python/геометрия не тронуты, диффом не выбираются.
- Performance-гейт (`performance.yml`) — в AC не назван, диффом не задет.
- Мутационный прогон `node scripts/mutation-gate.mjs` (исполнение, не `--check`) —
  не запускался: вне ночного workflow запрещён политикой (#709/#905), включая
  ревьюера; автор также честно пишет «мутанты не запускались».
- Фактическая неделя трафика «после» внедрения (часть AC5) — не может быть
  измерена до реального развёртывания на `dev`; не выдаётся автором за
  исполненную, не проверяю как исполненную.

## Побочные находки

Доверенный снимок политики: `mode: "issues"`. Побочных находок, подпадающих под
Medium вне скоупа, не обнаружено — новые issue не заводились.

## Вердикт

High: 0, Medium: 0 (в скоупе). Зелёный.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/981-content-proof-registry`, коммит `8791276f736b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `35d75437daee82b469ef99091b070197dedc42df`
  ```
  git log --all --format='%H %T' | grep 35d75437daee
  ```
- Тело issue: `7066ede0c418d5943b3ad39d819a0bb30637b862c006df42f63c00f7cdd0a8cd`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ3ODAsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0ODc1fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo4Miwib3V0cHV0X3Rva2VucyI6Mjk4NDAsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTYwNDMxLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NTA0NjE0OCwiY29zdFVzZEVzdGltYXRlIjoxLjk0OTUxNzU5OTk5OTk5OTl9XSwidHVybnMiOjU5LCJkdXJhdGlvbk1zIjozODkwNjgsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjk1NDM5MjU5OTk5OTk5OTgsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4862 output_tokens=29859 cache_creation_input_tokens=160431 cache_read_input_tokens=5046148 num_turns=59 -->
