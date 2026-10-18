# Код-ревью #954 · заход r1

Материал: `63d0ccca2e81f704e7e18bbc46dcd5e82872686c` (`origin/dev...HEAD`, база `bd6fb661`), `git rev-parse HEAD` на момент ревью совпадает. Диапазон: `15efca40` (код), `d1106786` (STATUS с замерами), `63d0ccca` (узкая правка тождества stamp-протокола). Трек на метке — `track:show`, без строки подтверждения владельца `Трек: show — решение владельца` ни в одном из двух комментариев issue.

## Вердикт

**route: reclassify · criterion: complexity** (вторично не проходит и `surfaces`).

Задача объединяет в одном заходе **все пять** пунктов из тела issue: (1) дедупликация producer push+dispatch, (2) разделение content-identity фронтенда от Git-идентичности, (3) приватный локальный receipt для pre-push, (4) точный подбор смоков, (5) перенос доказательств через границу веток с кросс-репозиторной/кросс-попыточной верификацией (ancestor, tree, run/attempt/jobs, окружение каждого producer, TTL, perf-профиль). Диф — 43 файла, ~944 вставки, 8 AC в теле issue (не «до трёх», как по умолчанию у `show`), новые скрипты (`check-proof-transfer.mjs`, `local-gate-proof.mjs`, `ci-job-environment.mjs`, `content-inputs.mjs`, `frontend-units.mjs`, `task-ci-plan.mjs`), правки `.github/workflows/validate.yml`, `_process.yml`, `_process-resume.yml`, `scripts/ci-proof.mjs`, `scripts/frontend-proof.mjs`, `scripts/gate-reuse.mjs`, `scripts/mutation-registry.mjs`, `scripts/process-track.mjs`, `scripts/process-resume.mjs`, `scripts/validate-gate.mjs`, `scripts/pre-push-gate.mjs`, `scripts/gate-small.mjs`, `scripts/smoke-links.mjs`, плюс пять процессных документов.

- **complexity ≤ 3 — не выполнено.** Это не локальный баг-фикс, а перестройка доверительной границы CI (cross-branch proof transfer с проверкой чужого run/attempt/environment/TTL — по сути новая модель доказательств), затрагивающая параллельно pre-push хук, выбор смоков и сам producer-пайплайн.
- **surfaces — одна поверхность — не выполнено.** Поверхностей минимум пять: workflow concurrency/producer job, локальный gate/pre-push хук, frontend reuse-proof schema, smoke-select эвристика, кросс-ветковый transfer. Сама формулировка issue («все пять источников лишних прогонов») признаёт это прямо.
- Остальные пункты (`migration`, `ux-contract`, `perf-touch`, `undocumented`) не являются решающими: UX и пользовательский runtime не меняются, это инфраструктура — но два первых критерия уже достаточны для `reclassify`.

Решение по маршруту принимает конвейер (перевод в `track:ask`/`S3-spec`); код остаётся в ветке. Ниже — код-ревью по существу, потому что High/Medium в скоупе и гейты маршрут не отменяет.

## Как проверялось

Дешёвые гейты на этом SHA подтверждены ссылкой из задания (Validate run [39114037258](https://github.com/Matysh/houseplan-card/actions/runs/39114037258), success) — `tsc --noEmit`, `npm test`, `npm run build` с проверкой бандла заново не гонял.

Выполнено дополнительно (бюджет раунда на чтение + точечные дешёвые прогоны):

| Гейт | Статус | Примечание |
|---|---|---|
| `node --test test/development-loop-954.test.mjs` | PASS, 10/10 | Новый файл-свидетель AC1–AC7; прочитан построчно — assert'ы бьют по реальным негативным входам (foreign repo, tampered bytes, non-ancestor, expired/corrupt receipt, WSL_INTEROP exclusion, docs-only key stability), а не по моку реализации |
| `node --test test/process-track.test.mjs test/validate-gate.test.mjs test/pre-push-gate.test.mjs test/process-resume.test.mjs test/classify-changes.test.mjs test/validate-workflow.test.mjs test/proof-loop-856.test.mjs` | PASS, 146/146 | Все файлы, чьи контракты этот дифф меняет |
| `node --test test/process-digests.test.mjs` | PASS, 10/10 | REVIEWER.md/AUTHOR.md остаются синхронны с PROCESS.md после правок |
| Чтение diff (`git diff origin/dev...HEAD`) целиком | — | `scripts/*`, `.github/workflows/*`, `docs/*`, `test/*` — построчно |

Не прогонялось и почему: `npx tsc --noEmit` / `npm test` (весь набор) / `npm run build` + сверка бандла — уже зелёные на этом точном SHA (ссылка задания, #343); полный браузерный Validate, golden, pytest backend, performance, invariants — не требуются: диф не трогает `src/**` геометрии, UX, Python-рантайм или touch; задача инфраструктурная класса B/C, пользовательский рендер не меняется. Мутанты не запускал и не запускал скрыто — только статический `--check` (через существующий зелёный Validate), что согласуется с общей политикой (ночной прогон отдельно).

## Находки

Высоких и Medium-находок (блокирующих или в/вне скоупа) не найдено.

**Low (не блокирует, не открывает цикл, фиксирую как замечание):**
- `docs/CHANGELOG.md` / `docs/CHANGELOG.ru.md`: добавлена запись про переиспользование dev-проверок в секцию `## Unreleased`, хотя все три коммита несут `User-Visible: no`, а сама секция — пользовательский changelog вперемешку с записями о фичах (ZIP-бэкап, CO₂ и т.д.). PROCESS.md §2.6 резервирует changelog RU+EN за «пользовательским» поведением; инфраструктурная запись там неуместна по жанру, но вреда не несёт — пользователь HACS увидит нейтральную техническую строку. Снимаю правкой не требую, т.к. это редакционная, не поведенческая находка.

## Что проверено и корректно

- **AC1 (один producer на материале).** `proofCandidate`/`validateGate` (scripts/validate-gate.mjs) теперь принимают и ещё идущий push как кандидата (не только dispatch), но зачёт идёт только по `run.status === 'completed'` + `evaluateCiProof` — в процессе выполнения push ничего не подтверждается заранее, race не создаёт ложного PASS. `.github/workflows/validate.yml` concurrency: `cancel-in-progress` выключён только для `workflow_dispatch` на ветках `issue/*`, сохранён для остальных событий/веток — ночной/релизный контур не задет. Подтверждено тестами `test/validate-workflow.test.mjs` («only issue dispatch coalesces with push; protected nightly/full concurrency remains separate») и `test/validate-gate.test.mjs` («#954 without mutants…»).
- **AC2 (content-identity вместо SHA).** `contentInputKey`/`inputReader` (scripts/content-inputs.mjs) читают input'ы по дереву коммита через `git show <ref>:<path>`, отклоняют символические ссылки, бросают на пустом списке. `frontendContentKey`/`restoreFrontend` (scripts/frontend-proof.mjs) вводят schema 2 параллельно с exact-SHA schema 1; тест `#954 real schema2 producer…` проверяет docs-only transition PASS, смену окружения/чужой репозиторий/правку `src/**`/untracked-правку/не-ancestor sibling-issue/подмену байт — все FAIL, как заявлено в таблице AC автора.
- **AC3 (локальный receipt).** `scripts/local-gate-proof.mjs`: ключ включает `environment` (node/platform/arch/argv/envHash), явно исключает только `GIT_*` и `WSL_INTEROP` — остальной PATH/tool-опции остаются входом. `restoreLocalGate` проверяет `schema`, `key`, `outcome==='success'`, TTL 24ч, байтовую сверку `dist`/`test-build` через `artifactTree`, отказ при симлинке на целевой директории. `pre-push-gate.mjs` теперь зовёт `npm run gate:small` (не напрямую `gate-small.mjs`), чтобы совпасть с обычным npm-lifecycle входом — обоснованно комментарием «PATH/lifecycle — значимый вход receipt». Тест `#954 local receipt restores actual bytes…` бьёт по каждому из перечисленных отказов на реальной нетронутой реализации.
- **AC4 (точный подбор смоков).** `scripts/smoke-links.mjs` добавляет явную связь backup-сценариев; тест `#954 common orchestration fields cannot select unrelated smoke contracts` показывает, что общие `_config`/`_editorRuntime` не дают `direct`-совпадения, но `unproven`/`visualMinimum` не пустые (не тихий зелёный). AC4 из комментария автора воспроизведён мной только чтением (конкретный прогон `smoke-select.mjs --base "026b71d3^" --head 792c70b2` не повторял — не обязателен: материал тот же, что в примере автора, не новый дифф этого SHA).
- **AC5 (перенос между ветками).** `scripts/check-proof-transfer.mjs`: `directTransfer` проверяет repository/head_repository, путь workflow, regex ветки (`dev|main|issue/NN-slug`), 24-часовой TTL от `updated_at`, совпадение `key`/`sourceKey`/`claim.key`/evidence-key, `matchingProducerEnvironment` по всем трём smoke-шардам отдельно от агрегирующего раннера, `evaluateCiProof(...).status === 'green'`. `transferProtocolMatches` дополнительно сверяет байтовое тождество самих `ci-proof.mjs`/`ci-job-environment.mjs` на source SHA — закрывает риск «старый протокол ошибочно интерпретируется новым». Тесты `#954 transfer verifies direct executed source…`, `#954 actual producer stamps require all smoke shards…`, `#954 cache marker cannot override…`, `#954 source stamp implementation must match too…` проверяют весь перечисленный в AC5 список отказов (red/cancelled/wrong attempt/tree/key/env/foreign repo/stale cache marker) на реальных функциях.
- **AC6 (отрицательные свидетели, контракты #492/#573/#856 не ослаблены).** `scripts/mutation-registry.mjs`: число определений не изменилось, три адаптированных мутанта (`light-review-duplicates-running-push`, `ci-golden-label-does-not-order-golden`, `review-gate-accepts-light-proof-for-full`) целятся в новый код того же свойства, что и прежние (push как proof-дубликат, golden без явного требования, light proof выдаётся за full) — проверил, что `find`/`replace` соответствуют актуальному тексту `validate-gate.mjs`/`task-ci-plan.mjs` на этом SHA (строки совпадают дословно).
- **AC7 (до/после).** Числа в STATUS.md и в комментарии автора — ссылки на реальные run'ы (39112990382, 39113476162, 39114037258); автор честно пишет «общего wall-time ускорения на этой паре НЕТ» и не выдаёт summed job seconds за billing — соответствует требованию §8 не путать параллельные длительности со временем пользователя.
- **AC8 (документы согласованы).** `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`, `docs/TESTING.md`, `docs/process/AUTHOR.md`, `docs/process/REVIEWER.md` все получили согласованные правки; `test/process-digests.test.mjs` (сверяет ссылки/формулировки конспектов с PROCESS.md) зелёный.
- **Трейлеры.** Все три коммита материала несут `Issue: #954` и `User-Visible: no` — корректно для инфраструктурной задачи без изменения пользовательского поведения.
- **release-ledger.** `docs/release-ledger/v1.81.0/954.json`: `category: infra`, обоснование относительно `v1.81.0` названо явно («no user runtime or release-gate coverage changes»); milestone пользовательского релиза не затронут — соответствует §11.9.
- **Одно число — один источник (§8).** Единственная цифра, которая в дифф попадает дважды, — тайминги конкретных CI run (STATUS.md и комментарий автора); источник один — та же ссылка на run, расхождений не нашёл.

## Чего не проверял

- Полный браузерный Validate/golden/performance/pytest backend/invariants — не требуются этим диффом (нет изменений `src/**`, геометрии, Python-рантайма, touch); см. «Как проверялось».
- Реальное исполнение cross-branch transfer в проде (push из issue-ветки → восстановление на dev после слияния) — только через синтетические фикстуры в `development-loop-954.test.mjs`; «после штатного слияния» из комментария автора честно помечено как неисполненное ожидание, не проверяю как исполненное.
- Мутанты из обновлённого реестра — не запускал (ни вручную, ни временным патчем реализации): это запрещено вне ночного workflow общей политикой; статическая регистрация (`mutation-gate.mjs --check`, PASS по данным автора) не равна поимке.
- Повторный прогон `smoke-select.mjs --base "026b71d3^" --head 792c70b2` для AC4 — не требовался: это тот же исторический материал, что уже зафиксирован в комментарии автора, не новый код этого SHA.
- Производительность собственно CI (секунды раннеров) как пользовательский перф-контракт — вне applicable: это dev-loop, а не `docs/USER-GUIDE.ru.md` touch/perf контракт продукта.

## Побочные находки

Доверенный снимок политики: `mode=issues`. Побочных Medium-находок вне скоупа нет — новых issue не заводил.

## Маршрут

`route: reclassify`, `criterion: complexity` (вторично — `surfaces`). Перевод в `track:ask`/`S3-spec` выполняет конвейер; код остаётся в ветке `issue/954-development-loop-reuse`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/954-development-loop-reuse`, коммит `63d0ccca2e81` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `bfeeb5715a5d9f920b5c6f7ab7be8bcfcb2d4d8c`
  ```
  git log --all --format='%H %T' | grep bfeeb5715a5d
  ```
- Тело issue: `1d3d6fde3fa0ff10a690d0708c6e9bc6352e8055db9d7beb09439826483d670a`
- Вердикт конвейера: `yellow` · High 0 · маршрут `reclassify` (критерий `complexity`)
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMDMsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTk3OTk5OTk5OTk5OTk5NX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NTQsIm91dHB1dF90b2tlbnMiOjI1NDM4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE0NzgzNywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjI1ODc5NjIsImNvc3RVc2RFc3RpbWF0ZSI6MS4zNjM0MjgzOTk5OTk5OTk5fV0sInR1cm5zIjozNSwiZHVyYXRpb25NcyI6MzIwODE3LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4zNjg2MjY0LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5157 output_tokens=25457 cache_creation_input_tokens=147837 cache_read_input_tokens=2587962 num_turns=35 -->
