# CODE-REVIEW #604 · r1

материал: `cc2300bf86c663c0c1cc490cc7585f57dd6a8c06` (ветка `issue/604-nightly-mutation-shards`, один коммит поверх `dev`@`0d30dde1`)
класс: B (инфраструктура) — `.github/workflows/mutation-gate.yml`, `scripts/mutation-gate-report.mjs`, `scripts/mutation-registry.mjs`, `test/mutation-gate-report.test.mjs`, `test/mutation-gate.test.mjs`, `docs/TESTING.md`. Ни одного файла класса A — accelerated-entry подтверждена, `git diff --stat` не задевает `src/**`, `custom_components/**/*.py`, манифесты.
заход: r1 (первый), блокирующих циклов израсходовано 0 из 4.

## Скоуп

Ночной мутационный прогон (`mutation-gate.yml`) 21.09 не дал зелёного результата: шард 2/4 снят по `timeout-minutes: 60` (реестр вырос до 810 мутантов, ~203 на шард, длительность прогона выросла с 42 до 61 мин за 11 дней), а отчётчик (`mutation-gate-report.mjs`) прочитал обрыв без строк `FAIL` как «ok» — второй, самостоятельный дефект (агрегатор проверял identity шардов, но не завершённость прогона).

Правка:
1. `mutation-gate.yml` — шесть шардов вместо четырёх (тот же делитель, что у `changed_mutants` в Validate) — снижает нагрузку на шард примерно втрое (~135 мутантов); шаг прогона получил `id: gate`, его `outcome` пишется в evidence шарда.
2. `mutation-gate-report.mjs` — шард `ok` только если лог дошёл до итоговой строки `поймано N из M` (N=M) без `FAIL` и с исходом шага `success`/не назван; иначе — новый статус `interrupted` (отказ). Агрегатор (`validateMutationShardEvidence` / `--verify-only`) отдельно отвергает шард с исходом `cancelled`/`skipped` как неполный.
3. Тесты и мутанты на оба механизма, обновление `docs/TESTING.md`.

Инфраструктурная задача не завязана на строку `docs/SCOPE.md` — под критерий подпадает (accelerated entry, AGENTS.md, «Infrastructure-only work»).

## Как проверялось

Дешёвые гейты (`npx tsc --noEmit`, `npm test`, `npm run build`) на этом SHA уже зелёные — Validate run [35594217191](https://github.com/Matysh/houseplan-card/actions/runs/35594217191), `success`; перегонять не стал (проверил только заявленный run — `databaseId=35594217191`, `headSha=cc2300bf...`, `conclusion=success`, совпадает с материалом). Дополнительно сам прогнал целевые дешёвые проверки диффа:

| Гейт | Команда | Результат |
|---|---|---|
| Тесты диффа (не в составе полного `npm test`, но входят в него) | `node --test test/mutation-gate-report.test.mjs test/mutation-gate.test.mjs` | 76 pass, 0 fail |
| Новый мутант 1 умеет падать | `node scripts/mutation-gate.mjs --id=mutation-report-truncated-log-is-ok` | `mutation-report-truncated-log-is-ok: заявленный тест покраснел на мутанте` → `поймано 1 из 1` |
| Новый мутант 2 умеет падать | `node scripts/mutation-gate.mjs --id=mutation-evidence-ignores-cancelled-step` | `mutation-evidence-ignores-cancelled-step: заявленный тест покраснел на мутанте` → `поймано 1 из 1` |
| Якоря патчей реестра живы | `node scripts/mutation-gate.mjs --check` | без `FAIL`, чисто |
| Синтаксис workflow | `python3 -c "yaml.safe_load(...)"` на `.github/workflows/mutation-gate.yml` | `YAML_OK` |
| Трейлеры коммита | `git log -1 --format=%B` | `Issue: #604`, `User-Visible: no` — верно, поведение продукта не меняется, оба changelog не тронуты (и не должны быть) |

**Не прогонял:** `npm run typecheck`/`npm test`/`npm run build` целиком (уже зелёные на этом SHA по ссылке выше), `node scripts/check-docs.mjs` (diff не трогает `src/**`), браузерные смоки/`golden:verify` (diff не трогает рендер/`demo/**`/`src/**`), `python -m pytest tests_backend` (`custom_components/**/*.py` не тронут), инварианты геометрии (`npm run invariants`, diff не трогает рёбра/толщину/`layout`), performance-профили (не названы в AC и не затронуты). Сам ночной `mutation-gate.yml` целиком не запускал — автор сам это отметил как избыточное («час машинного времени ради утверждения, которое держит юнит-тест»); я согласен: логика воспроизведена и доказана юнит-тестами и целевым запуском мутантов.

## AC · чем доказан · чем краснеет

| AC | Доказательство | Краснеет |
|---|---|---|
| Прерванный по таймауту/отмене шард — отказ (`interrupted`), не «ok» | `node --test --test-name-pattern="#604: лог без итоговой строки" test/mutation-gate-report.test.mjs` — прогнал сам, ok | мутант `mutation-report-truncated-log-is-ok` — сам прогнал: `node scripts/mutation-gate.mjs --id=mutation-report-truncated-log-is-ok` → тест краснеет на снятой защите |
| Агрегатор (evidence-джоб) отвергает незавершённый шард как неполный | `node --test --test-name-pattern="#604: evidence несёт исход шага" test/mutation-gate-report.test.mjs` — сам прогнал, ok | мутант `mutation-evidence-ignores-cancelled-step` — сам прогнал, краснеет |
| Делитель шардов (6) согласован во всех четырёх местах workflow | `node --test test/mutation-gate.test.mjs` — тест «#604: делитель шардов…» разбирает сам YAML регэкспами по matrix/имени job/трём `--shard(s)=` и убеждается, что старого `4` не осталось | тест по конструкции падает при рассинхроне: проверено чтением теста — воспроизводить искусственный рассинхрон не стал, логика теста прямая (regex-сверка чисел) |
| Прежние контракты отчёта (#472, #549, #550) не сломаны | те же 76 тестов — 11 прежних тестов файла зелёные без изменения утверждений; две прежние зелёные фикстуры дополнены итоговой строкой (иначе новый более строгий парсер сам бы их забраковал) | не требуется — это регресс-проверка, не новая защита |

## Что проверено чтением, не исполнением

- Реальность того, что `if: always()` шаг «Записать identity шарда» действительно выполняется после `timeout-minutes`-cancel job-а — не гипотеза автора: это эмпирический факт из исходного инцидента (в комментарии владельца к issue отмечено, что evidence.json шарда 2 был корректно записан этим самым always()-шагом уже в старом workflow, до этой правки). Прочитал код `mutation-gate.yml`: `id: gate` присвоен шагу прогона, следующий шаг `if: always()` читает `steps.gate.outcome` — синтаксически и логически корректно.
- Путь `--require-evidence` (report-джоб) и `--verify-only` (evidence-джоб) оба проходят через `loadMutationShardArtifacts` → `validateMutationShardEvidence`, то есть прерванный шард одинаково валится в обоих местах, а не только в одном. Прочитал `scripts/mutation-gate-report.mjs` целиком (строки 90–172, 190–333) — логика `INTERRUPTED_OUTCOMES` и `SUMMARY_LINE` согласована между `parseShardLogs` и `validateMutationShardEvidence`, дублирование двух независимых проверок (evidence-джоб через `outcome`, report-джоб дополнительно через отсутствие итоговой строки в логе) — намеренная защита в глубину, а не бага: даже без корректно записанного `outcome` (старые артефакты) обрыв лога сам по себе теперь ловится по отсутствию `поймано N из M`.
- Путь `ledger`-пропуска в `scripts/mutation-gate.mjs` (`--ledger`, PR-гейт) не печатает итоговую строку, когда весь план уже пойман по журналу — по устройству это дало бы `interrupted` в новой логике. Прочитал: этот путь используется только диф-гейтом (`gate:small`/PR), не `mutation-gate.yml`, а ночной прогон явно не передаёт `--ledger` (подтверждено и автором, и текстом workflow) — так что дыры в ночном прогоне это не создаёт.
- Единственное число, видимое человеку из этой правки — таблица «шард | результат» в issue-репорте и Telegram-сводке; источник один (`parsed.shards`), в обе строки автор подставляет один и тот же массив без дублирующего пересчёта — «одно число, один источник» соблюдён.

## Находки

Нет. High: 0, Medium: 0.

## Что проверено и корректно

- Диапазон изменений строго инфраструктурный (класс B), issue корректно вошёл в поток через accelerated entry.
- Трейлеры коммита корректны (`Issue: #604`, `User-Visible: no`), changelog не тронут — верно для правки, не меняющей продукт.
- Тесты умеют падать — оба новых мутанта проверены лично, а не по слову автора.
- Регресс прежних тестов файла отчётчика не сломан.
- `timeout-minutes: 60` осознанно оставлен как страж от зависшего Chromium, а не поднят — правильное решение: рост реестра лечится числом шардов, а не расширением таймаута.
- Комментарий автора честно называет то, что не прогонялось (сам ночной workflow), с обоснованием почему это избыточно на этом этапе.

## Вердикт

Зелёный. Правка узкая, тестами подтверждена, находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/604-nightly-mutation-shards`, коммит `cc2300bf86c6` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `1510b85d07832e0d60cbba6e0b43e090a93f2f20`
  ```
  git log --all --format='%H %T' | grep 1510b85d0783
  ```
- Тело issue: `01d666c98d9827d22c0ae7d613a2d020a4a962a45cf2f77419b6384e22bae3b4`
- Вердикт конвейера: `green` · High 0
