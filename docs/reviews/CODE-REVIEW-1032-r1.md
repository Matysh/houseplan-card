# CODE-REVIEW-1032-r1

Issue: #1032 · Трек: show · Этап: code · Заход: r1 · блокирующих циклов 0/2
Материал: `c3ac82d87ace353f0bea22ff25f888fee0b2e732` (рабочая копия на нём, `git rev-parse HEAD` сверен)
База: `origin/dev` на момент диапазона (`git log --oneline origin/dev..HEAD` — один коммит)

## Скоуп

Issue #1032 — самостоятельный инфраструктурный дефект, выявленный при сопровождении #1011: один workflow мог получить
два разных Python patch-релиза (`3.14.8`/`3.14.9`) в одном прогоне, потому что `reuse` резолвил плавающий minor `3.14`
через `.python-version`, а producer-jobs (`backend`, `geometry_parity`) резолвили его **независимо**, каждый на своём
образе runner. Сами тесты проходили, затем строгий stamp-гард (`actual Python differs from the planned producer
toolchain`) корректно падал на несовпадении — AC запрещает его ослаблять.

ТЗ (AC1–AC3, тело issue):
- AC1 — разрешать minor один раз в `reuse`, устанавливать точный patch в каждой Python-producing job, сохранить
  фактический stamp/fail-closed отказ, проверить аналогичную границу Node.
- AC2 — покрыть push product-профиль и полный dispatch Validate, перегенерировать производные workflow, добавить
  контрактную проверку producer setup/плана с разными доступными patch-релизами; mutant execution не требуется.
- AC3 — CI на одном материале подтверждает parity/backend и registry proof при разных поколениях runner images.

Изменение — единственный коммит, классы B/C (workflow, тесты, скрипт реестра мутаций, документация, release-ledger).
Класса A нет, трек `track:show` предложен автором (не решение владельца — предложение корректно оформлено).

## Проверка критериев §5 (track:show)

| Критерий | Вывод |
|---|---|
| complexity | низкая: точечная подмена источника версии в CI-workflow + контрактные тесты |
| surfaces | одна поверхность — CI pipeline (резолюция Python для producer jobs) |
| migration | нет — ни конфигов, ни compatibility-полей |
| ux-contract | нет UI/UX вообще, `User-Visible: no` |
| perf-touch | не затронуто |
| undocumented | поведение зафиксировано в этом же коммите в `docs/ARCHITECTURE.md` и `docs/DEVELOPMENT.md` |

Все критерии пройдены → `route: fix`, `track:show` остаётся в силе.

## Как проверялось

| Гейт | Статус | Примечание |
|---|---|---|
| `typecheck` / `npm test` / `npm run build` + bundle-policy | не перегонял | зелёный Validate на этом же SHA (`c3ac82d87`, run 39828323541) подтверждён владельцем в теле задачи — дешёвые гейты сошлись |
| `node scripts/mutation-registry.mjs --check` / `mutation-gate.mjs --check --id=ci-python-producer-resolves-minor-again-1032` | PASS (прогнал сам) | статическая регистрация нового мутанта `ci-python-producer-resolves-minor-again-1032`, `find` уникален в обоих workflow-файлах |
| `node --test test/ci-profiles.test.mjs test/ci-proof-registry.test.mjs test/validate-workflow.test.mjs` | PASS 76/76 (прогнал сам) | целевые тесты диффа, включая новый `#1032`-тест и отрицательные входы |
| `node scripts/ci-profiles.mjs --check` | PASS (прогнал сам) | `validate-product.yml` — валидный сгенерированный продукт из `validate.yml` |
| `node scripts/status-snapshot.mjs --check` + `npm run inventory` | PASS (прогнал сам) | числа в `docs/STATUS.md` (5057/579/484/411) совпадают с `npm run inventory` — один источник |
| `node --test test/process-digests.test.mjs test/entry-cost.test.mjs` | PASS (прогнал сам) | дайджест ревьюера/автора не разошёлся с каноном |
| Реальный CI на материале (не перегон, а чтение существующего прогона) | подтверждено | см. ниже — прочитаны логи двух producer-jobs и `reuse` на точном SHA |
| Mutant execution (ночной прогон реестра) | не прогонял и не должен был | AC2 прямо говорит «mutant execution не нужен»; доказательство — static-check + id свидетеля, обычный прогон не производился |
| `pytest tests_backend`, `golden:verify`, инварианты геометрии, performance | не прогонял | диапазон не трогает Python-продукт, рендер плана, геометрию или perf — только то, **как** CI устанавливает Python; задача не называет эти гейты в AC |
| HA-harness (`test_ha_*.py`) | не прогонял — вне скоупа диффа, Validate на SHA material это прогнала (canonical run) | |

## Доказательство AC по коду и реальному CI

Я не ограничился чтением и перепроверил ключевое утверждение AC3 исполнением (чтением готовых логов, не повторным
прогоном): в прогоне `39828323541` на точном материале `c3ac82d87`:

- `reuse` (job `119997611620`) — image `ubuntu-24.04 Version: 20261012.334.1`, `setup-python` запросил плавающий
  `python-version: 3.14`, получил `3.14.8`, экспортировал job-output `python_version=3.14.8` из
  `steps.python.outputs.python-version` (а не из `steps.probe...`, как было раньше).
- `geometry_parity` (job `119997720877`) — **тот же** image `20261012.334.1`, установил точный `3.14.8` через
  `needs.reuse.outputs.python_version`, stamp-шаг прошёл.
- `backend` (job `119997720874`) — **другой** image `20261018.339.1`, тоже установил точный `3.14.8` (не независимо
  резолвил другой patch на другом образе), stamp-шаг прошёл, `actual Python differs...` в логе нет.

Это прямое исполняемое доказательство межобразной устойчивости (AC3), а не умозаключение из диффа: producer-jobs на
двух разных поколениях runner-image получили одну и ту же точную patch-версию из общего плана.

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (установка точного patch) | чтение кода `validate.yml`/`validate-product.yml` + `test/ci-profiles.test.mjs` (`#1032`-тест, 76/76 PASS) + реальный CI (два разных image, один и тот же patch) | id `ci-python-producer-resolves-minor-again-1032` — зарегистрированный свидетель, статически PASS, **не исполнялся** (политика: mutant execution вне ночного workflow запрещена, AC2 это не требует) |
| AC1 (strict actual-version stamp не ослаблен) | `test/ci-proof-registry.test.mjs`: новый цикл по `['node','python']`, искусственное расхождение `99.0.0` → `producedRegistryRecords(...).length === 0` | обычный отрицательный случай на неизменённой реализации, результат — PASS (прогнал сам), это не мутант продукта |
| AC2 (оба workflow, разные patch-комбинации, запрет повторного резолва) | `test/ci-profiles.test.mjs`: цикл по `validate.yml`/`validate-product.yml`, прямая и обратная пара `3.14.8`/`3.14.9`, плюс `assert.throws` на `python-version-file`/захардкоженные `"3.14"`/`"3.14.8"` | обычные отрицательные фикстуры в самом тесте, PASS |
| AC3 (устойчивость на разных поколениях runner-image) | прочитан реальный лог прогона `39828323541` на материале `c3ac82d87`: `reuse`=image 334.1, `geometry_parity`=image 334.1, `backend`=image 339.1 — все три с единым `3.14.8` | не защитный AC в узком смысле (не гард/лимит) — проверено исполнением существующего CI, не чтением |

## Находки

Находок нет — ни High, ни Medium, ни Low.

## Что проверено и корректно

- Корень дефекта устранён именно там, где он возникал: `backend`/`geometry_parity` раньше ставили Python через
  `python-version-file: .python-version` (независимый плавающий резолв на каждом runner-image), теперь — через
  `python-version: ${{ needs.reuse.outputs.python_version }}` (точный patch из общего плана). Третьего места
  установки Python в обоих workflow нет (`grep` по `setup-python` — ровно три вхождения: bootstrap + два producer).
- `reuse`-job больше не теряет точную версию при сбое registry/API probe: job-output `python_version` теперь берётся
  напрямую из `steps.python.outputs.python-version` вместо `steps.probe.outputs.python_version`
  (`scripts/ci-registry-cli.mjs` мог пере-вычислить это значение другим путём внутри скрипта регистрации).
- Фактический Python-stamp (`producerToolchain` в `scripts/ci-registry-cli.mjs:21-24`) не тронут: несоответствие
  actual/plan по-прежнему `throw Error`. Это подтверждено и отрицательным юнитом, и тем, что реальный прогон CI на
  материале прошёл stamp-шаг без ошибки.
- `validate-product.yml` — валидный сгенерированный продукт `validate.yml` (`ci-profiles.mjs --check` зелёный),
  изменения синхронны в обоих файлах.
- Документация (`docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`) обновлена в том же коммите, вставки
  уместны по месту (раздел «Authenticated content proof index» и описание toolchain pins), без противоречий.
- `docs/release-ledger/v1.82.0/1032.json`: категория `infra`, обоснование относительно текущего stable корректно —
  это CI-инфраструктурный фикс без пользовательского поведения, не входит в пользовательский milestone релиза.
- Трейлеры коммита: `Issue: #1032`, `User-Visible: no` — присутствуют, changelog не тронут, что соответствует `no`.
- `docs/STATUS.md`: числа тестов (5057/579/484/411) — один источник, `npm run inventory` даёт то же самое.
- Mutation registry: новая запись `ci-python-producer-resolves-minor-again-1032` структурно идентична соседним
  записям, `find`-паттерн уникален в обоих файлах (`mutation-gate.mjs --check` зелёный), execution=0 — честно, по
  общей политике вне ночного workflow так и должно быть.

## Чего не проверял

- Полные `npm test`/`npm run build`/`bundle-policy --verify`/`typecheck` — не перегонял: они дешёвые, но уже сошлись
  на этом точном SHA по зелёному Validate (`run 39828323541`), процесс явно разрешает на это сослаться.
- Исполнение мутанта (ни зарегистрированного, ни ручного патча workflow/реестра) — запрещено вне ночного workflow;
  не делал ни я, ни (по заявлению автора) автор.
- `pytest tests_backend` (полный), HA-harness `test_ha_*.py`, `golden:verify`, инварианты геометрии, performance-гейт
  — не прогонял: диапазон не меняет Python-продукт/геометрию/рендер/perf, AC их не называет; HA-harness в принципе
  не может собраться в этой cloud-среде без `homeassistant`, но Validate на материале его уже прогнала в CI.
- Полную матрицу browser-смоков — Validate на материале уже прошла `full=false` обычным dispatch по диффу; отдельных
  browser-смоков по AC задача не называет (чисто CI-инфраструктурный диф, рендер не затронут).
- Ручную dev/GPU-приёмку владельцем — не требуется и не является находкой при отсутствии (REVIEWER.md, «Позиция
  ревьюера»).

## Побочные находки

Побочных находок нет. Маршрут публикации — mode=issues (доверенный снимок политики), но заводить нечего.

## Вердикт

Зелёный. Код делает ровно то, что заявлено в AC1–AC3, подтверждено и чтением, и реальным исполнением CI на точном
материале, strict stamp/trust/reuse-политика не ослаблена, документация и release-ledger согласованы, трейлеры на
месте. route: fix.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1032-ci-python`, коммит `c3ac82d87ace` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `9f666447413b8ab203a200a98e873e10af15a80d`
  ```
  git log --all --format='%H %T' | grep 9f666447413b
  ```
- Тело issue: `a7bdd0d64384ec8589854c9ed72b33122f38fd9825cc47a559b55d8efd4faf6f`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMDUsIm91dHB1dF90b2tlbnMiOjE1LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTgwMDAwMDAwMDAwMDAxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo4Miwib3V0cHV0X3Rva2VucyI6MjQ4MTMsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6OTMwNzIsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjozNDAyNzE3LCJjb3N0VXNkRXN0aW1hdGUiOjEuMzAxMTI1NH1dLCJ0dXJucyI6NTAsImR1cmF0aW9uTXMiOjM1MTI4MiwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjEuMzA2MzA1NCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5187 output_tokens=24828 cache_creation_input_tokens=93072 cache_read_input_tokens=3402717 num_turns=50 -->
