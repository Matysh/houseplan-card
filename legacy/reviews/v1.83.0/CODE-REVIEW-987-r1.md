# CODE-REVIEW-987-r1

**Issue:** #987 · **Этап:** code · **Трек:** show · **Заход:** r1 · блокирующих циклов 0/2
**Материал:** `c89e9b2a10b3a96b10b91dd903a92b4eaf8ca4d5` (ровно, рабочая копия на нём)
**База:** `origin/dev` = `4145b45f2c0a02efe9c8ad658489c2f6b4157e9d`

## Скоуп

Инфраструктурная задача (класс B/C, PROCESS §1): устранить потенциальную причину
однократного CDP-отказа `page.evaluate: Resulting promise was garbage collected`
на исторической строке 121 `demo/smoke_marker_state_source.mjs` (переход
editor → static-card), перенеся это действие на уже принятый
`evaluateRetainedAction` (#967/#975). Попутно обновлён устаревший структурный
oracle `sourceAfterDisplay`, не учитывавший принятые в #1007 обёртки
`.hpf-section`. Продуктовый код (`src/**`), бандл, workflow, shards, pins не
меняются — соответствует `docs/SCOPE.md` (job: надёжность инструментов
разработки, не продуктовая работа) и AC3.

Маршрут вердикта (§5, трек `show`): задача проходит все критерии —
`complexity` (точечная замена одного `page.evaluate` на готовый хелпер + один
CSS-селектор в тесте), `surfaces` (одна поверхность — один demo-smoke),
`migration` (нет), `ux-contract` (продукт не меняется вовсе), `perf-touch`
(нет), `undocumented` (поведение, которое проверяет oracle, уже зафиксировано
принятым #1007; сам lifetime-контракт `evaluateRetainedAction` уже
задокументирован и принят в #967/#975). → **route: fix**.

## Как проверялось

Зелёного Validate на `c89e9b2a1` не найдено — все гейты ниже прогнаны
ревьюером самостоятельно, на материале как есть (`git status` чист,
`git rev-parse HEAD` = материалу).

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | PASS, без вывода |
| Build | `npm run build` (дважды, в составе `bundle:sync`) | PASS, `created dist in ~57s` |
| Юнит-набор целиком | `npm test` (tsc test + fix-test-build + `node --test test/*.test.mjs`) | 5537/5539 PASS, 1 skipped, 1 временный fail — см. ниже |
| AC1 смок | `node demo/smoke_marker_state_source.mjs` (после `npm run bundle:sync`) | PASS: все 51 именованных oracle `true`, включая `sourceAfterDisplay: true`, `completed: true` |
| AC2 юниты хелпера | `node --test test/retained-page-action.test.mjs` | 6/6 PASS (pending-hold, sync, throw, reject, deadline-timeout, invalid-args) |
| AC2 независимый GC-контроль | `node demo/smoke_editor_styles_lazy.mjs` (тот же свежий бандл) | PASS, включая `unrootedActionShowsCdpCollection`, `retainedActionSurvivesCdpCollection`, `retainedActionReleasesItsOwner` |
| release-ledger | `node --test test/release-ledger.test.mjs` | 6/6 PASS |
| docs-гейты | `node --test test/docs-freshness.test.mjs test/docs-acceptance.test.mjs` | 16/16 PASS |
| smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет… Browser-smoke этим диффом не выбираются» — явное решение, не НЕОПРЕДЕЛЁННОСТЬ; дополнительных смоков к названным в AC не требуется |
| process-gate | `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | PASS, 1 ожидаемый WARN (п.8, инфраструктурный диапазон без статусной метки до S7 — #562) |
| whitespace | `git diff --check origin/dev...HEAD` | PASS (exit 0) |

Про единственный `fail` в полном `npm test`: `test/ci-registry-inputs.test.mjs`
→ `computed inventory and generated profiles match the executable source`
упал из-за того, что на момент прогона в рабочем дереве лежали
`demo/out/marker-state-source-977/manual-en.png` и `unknown-ru.png` —
generated-output скриншоты, оставленные **моим же** прогоном AC1-смока
(`demo/out/` не в `.gitignore`, поэтому любые смок-артефакты в дереве меняют
вычисляемый inventory). После `rm -rf demo/out` повторный
`node --test test/ci-registry-inputs.test.mjs` → 14/14 PASS. Это
самостоятельно внесённая и устранённая загрязнённость среды ревью, а не
дефект материала: диффа это не касается, `dist/`/`custom_components/`
восстановлены `npm run bundle:clean`, финальный `git status` чист.

`bundle-policy --verify` (сверка трёх копий) не гонял — по §8 копии сверяются
только на кандидате релиза, не на обычной B/C-задаче; `golden:verify` и
`pytest tests_backend` не гонял — нет `ci:golden` и нет правок Python;
инварианты модели не гонял — геометрия не затронута; performance не гонял —
не назван в AC. Ручного dev/GPU-прогона на Windows не делал — для `show`
необязателен (§7.1, #929), а продукт не меняется вовсе.

## Находки

Нет. High: 0. Medium: 0 (ни в скоупе, ни вне скоупа — побочных находок нет).

## Что проверено и корректно

- Все три AC доказаны исполнением, не только чтением: AC1 — живой прогон
  смока (51/51 oracle, включая обновлённый `sourceAfterDisplay`), AC2 — живой
  прогон `retained-page-action.test.mjs` и `smoke_editor_styles_lazy.mjs`,
  AC3 — `git diff --stat` подтверждает только `demo/**`+`docs/**` (класс B/C),
  без `src/**`, бандла, workflow, pins.
- Защитный аспект (deadline вместо unbounded await, exactly-once release
  handle) покрыт существующим `test/retained-page-action.test.mjs` —
  «чем краснеет»: тест №5 `an action that never completes fails its named
  deadline instead of passing or retrying` — обычный отрицательный случай с
  командой (`node --test test/retained-page-action.test.mjs`) и результатом
  (PASS, т.е. гард реально отказывает по дедлайну, а не повисает/ретраит).
  Этот хелпер и его тесты не менялись этим диффом (приняты в #967) —
  переиспользование уже пригодного доказательства корректно по static-first.
- Трейлеры коммита корректны: `Issue: #987`, `User-Visible: no` — согласуется
  с отсутствием продуктовых изменений; `docs/CHANGELOG*` не трогались, и это
  правильно.
- `docs/release-ledger/v1.82.0/987.json`: `category: "infra"` обоснована
  (чисто тестовый lifecycle-фикс без продуктового поведения) и согласуется с
  прецедентом `674.json` (тоже `infra`, тоже без пользовательского milestone).
- Формулировки в `docs/DEVELOPMENT.md`/`docs/STATUS.md` честно разграничивают
  «устранили известный класс слабой CDP lifetime-границы» от «доказали
  причину конкретного отказа» — не выдают один успешный baseline-прогон за
  опровержение исходного Linux-флака, что соответствует требованию тела
  issue не путать таймаут/повтор с исправлением.
- Одно число, видимое дважды: «51 именованных oracle» в теле issue/
  `docs/DEVELOPMENT.md` и фактический вывод смока совпадают (считал сам —
  50 булевых полей + `completed`).

## Чего не проверял

- Полный golden/perf/HA-гейты — не требуются объёмом задачи (§8, только B/C
  demo/docs правки, нет `ci:golden`, нет Python).
- Воспроизведение исходного Linux CDP-флака — невозможно по построению (один
  отказ в одном прогоне, частота не установлена; сам автор это не заявляет).
- Ручная Windows/GPU-приёмка — необязательна на `show`, продукт не меняется.
- `bundle-policy --verify` (сверка dist/custom_components/demo-копий) — гейт
  кандидата, не обычной задачи.

## Побочные находки

Побочных находок нет. Маршрут публикации — `mode=issues`
(`HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`), но заводить нечего.

## Вердикт

Зелёный. AC1–AC3 доказаны исполнением на названном материале, гейты из §8
соразмерного объёма прогнаны и зелёные, находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/987-marker-promise`, коммит `c89e9b2a10b3` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `47403940dee767b58a677c3a13937423f7cf74d2`
  ```
  git log --all --format='%H %T' | grep 47403940dee7
  ```
- Тело issue: `54bbe6a6aec80f8defa11131b908af5d33a891d7380c497e5cef3ca4f3a51f5d`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ5NDUsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDM0OTk5OTk5OTk5OTk5NX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTUwLCJvdXRwdXRfdG9rZW5zIjozMTU1NCwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxNDg3OTksImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo3ODY0NTY3LCJjb3N0VXNkRXN0aW1hdGUiOjIuNDgzOTQ5Mzk5OTk5OTk5OH1dLCJ0dXJucyI6ODksImR1cmF0aW9uTXMiOjg0MDAxOCwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjIuNDg4OTg0Mzk5OTk5OTk5NywiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5095 output_tokens=31572 cache_creation_input_tokens=148799 cache_read_input_tokens=7864567 num_turns=89 -->
