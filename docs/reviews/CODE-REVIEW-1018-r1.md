# CODE-REVIEW-1018-r1

Материал: `a01f4f88d5d4c49c6c77e59b2844f0c7d45fa85c` (`issue/1018-parallel-path-coverage`, `origin/dev..HEAD` = 20 коммитов). Рабочая копия проверена `git rev-parse HEAD` — совпадает. Трек: `ask`. Заход r1, блокирующих циклов израсходовано 0/4.

## Скоуп

Задача инвентаризирует исторические параллельные пути (по истории коммитов и по исполнению полного unit/smoke/Golden набора), заводит ночной диагностический артефакт без gate/release-полномочий и делает первое доказанное удаление в одной подсистеме — legacy top-level `onOpacity` в `ColorField`/`ColorTile` (`src/editors/form-kit.ts`, `src/styles/form-kit.styles.ts`). `User-Visible: no`, поведение не меняется. Это J1/J4/J6 из `docs/SCOPE.md` (качество кодовой базы без изменения пользовательских сценариев) — не продуктовая фича, но легитимная техдолг-задача, явно отделённая от #1014/#1015/#1019.

## Как проверялось

Прочитаны целиком: тело issue (ТЗ, AC1–AC8), все 14 комментариев (включая capacity holds, два технических возврата и финальный хендофф на `a01f4f88d`), `AGENTS.md`, `docs/process/REVIEWER.md`. Материал статический: `git log`/`git diff origin/dev...HEAD`, `git show` по каждому нетривиальному коммиту.

Принятый **validate-gate proof** для точного SHA `a01f4f88d` (https://github.com/Matysh/houseplan-card/actions/runs/40077870524, «review-light proof is complete») покрывает build/typecheck/product+tooling units/bundle policy-budget-lint:unused — этот прогон не повторялся.

Адресно (сверх покрытого proof, для конкретных рисков дельты) выполнено только:

| Проверка | Команда | Результат |
|---|---|---|
| Статическая валидность нового mutant-определения (не исполнение мутанта) | `node scripts/mutation-registry.mjs --check` | exit 0 — патч `form-kit-inline-opacity-input-dropped-1018` находит свою цель ровно один раз в `src/editors/form-kit.ts` |
| Подсчёт фактических вызовов `colorField`/`colorTile` вне `form-kit.ts` | `grep -rn "colorField(\|colorTile(" src --include=*.ts \| grep -v form-kit.ts \| wc -l` | 10 — совпадает с заявленным «10 literal calls» |
| Поиск оставшихся `onOpacity` во всём `src/` | `grep -rn "onOpacity" src` | 3 вхождения: тип `inputs.onOpacity(raw)`, его использование в `colorField`, и единственный вызывающий `src/editors/properties/surface.ts:102` внутри `inputs: {...}` — все относятся к сохранённому nested-контракту, ни одного top-level |
| Чтение diff `f8ce07b3b` (form-kit.ts/styles.ts, CSS fixtures) | — | подтверждает, что удалён только top-level `onOpacity`/числовой fallback/`colortile-meta .hpf-unit`; общий `.hpf-unit`/`.hpf-colorfield > .hpf-opacity > .hpf-unit` (строки 211–217, 389–390 `form-kit.styles.ts`) не тронут, элемент не остаётся без стиля |
| Чтение `.github/workflows/_nightly.yml` diff и `test/coverage-diagnostic.test.mjs` теста изоляции | — | `diagnostic-coverage` job: `continue-on-error: true`, `permissions: contents: read`, `timeout-minutes: 135`, upload `if: always()` с `timeout-minutes: 15`, `retention-days: 1`; тест `nightly job uses exact immutable intent... no proof wiring` явно грепает `ci-proof-registry.mjs`/`release-evidence.mjs`/`mutation-gate.mjs` на отсутствие упоминаний diagnostic-coverage |
| Чтение `rollup.config.mjs`/`bundle-manifest.mjs`/`css-template-minifier.mjs`/`fix-test-build.mjs` diff | — | все coverage-ветки под `coverageMapsEnabled()` (default `false`); обычная сборка (`sourcemap: false`, `map: null`) структурно не меняется — согласуется с заявленной byte-parity (`raw 3 436 937 B`, manifest fingerprint `ee619cb3…`) |
| Поиск REMOVE-записей в итоговой disposition | `grep "REMOVE" docs/audits/parallel-paths-1018-disposition.md` | ровно 3 REMOVE, все одной подсистемы (`form-kit` onOpacity) — соответствует «один коммит на подсистему» (контракт п.8) |
| Проверка `defaultStair`/`snapStairToStairs` | `grep` в disposition | явная строка KEEP с current callers — не задеты (не-скоуп ТЗ) |
| Трейлеры всех 20 коммитов диапазона | `git log --format=%s%n%b` по каждому SHA | `Issue: #1018`/`User-Visible: no` на всех commit, кроме merge (`660418962`, 2 родителя) и двух docs-only (`54a1e4157`, `495765ced`) — трейлеры там не требуются (§3 п.10) |
| Release-ledger | `docs/release-ledger/v1.82.0/1018.json` | `category: "infra"`, обоснование относительно текущего stable — техдолг без пользовательского поведения, верно исключён из пользовательского milestone |

Тесты/мутанты не исполнялись вручную сверх вышеперечисленного статического `--check`; полный `gate:small`/build/test не повторялся — покрыт принятым proof.

## Проверка AC по существу

- **AC1** (исторический список): `docs/audits/parallel-paths-1018-disposition.md` + JSON, 76 кандидатов (73 KEEP / 3 REMOVED одной подсистемы), seed-коммиты из преамбулы разобраны, `defaultStair`/`snapStairToStairs` сохранены с явными callers — разобрано чтением, доказательство достаточно.
- **AC2/AC4/AC5** (полное покрытие, raw-отчёт, честная неполнота): before-capture на `a34f5806c` — `complete=false, safeZero=false`, 1337 provenance-причин вместо нулевого списка; `test/coverage-diagnostic.test.mjs` содержит прямые негативные входы (foreign/hash/escaping map, failed/skipped/duplicate/absent invocations, timeout fixture) — проверено чтением теста, структура соответствует заявленному.
- **AC3** (карты после всех трансформаций, обычная сборка не меняется): `rollup.config.mjs`/`bundle-manifest.mjs`/`css-template-minifier.mjs`/`fix-test-build.mjs` — coverage-путь строго за флагом, default off; подтверждено чтением плюс byte-parity receipts из хендоффа.
- **AC6** (ночной артефакт не даёт proof-полномочий): подтверждено и workflow-диффом, и собственным тестом изоляции (см. таблицу выше) — проверено исполнением теста изоляции (входит в принятый proof) и чтением workflow.
- **AC7/AC8** (удаление onOpacity, первая подсистема отдельным коммитом): `f8ce07b3b` — ровно то, что заявлено; 10 литеральных вызовов без legacy-аргумента; защитный мутант `form-kit-inline-opacity-input-dropped-1018` зарегистрирован (`scripts/mutation-registry.mjs`), привязан к `demo/smoke_ui_1051.mjs`, который реально нажимает `.hpf-inline-alpha` (`alpha.fill('75')`, atomic Save/Undo) — **не исполнялся** (политика: ночь/реестр, не ревью). Это закрывает требование таблицы «AC · чем доказан · чем краснеет» для защитного AC7.

## Что проверено и корректно

- Единственное изменение `src/**` — `form-kit.ts`/`form-kit.styles.ts`; остальные найденные подсистемы не тронуты (соответствует контракту п.8 «один коммит на подсистему»).
- Нет утечки `onOpacity` как top-level (все 3 оставшихся вхождения — nested `inputs.onOpacity`).
- CSS-очистка точечная, не осиротившая используемые селекторы.
- Nightly job корректно изолирован от proof-реестров собственным тестом.
- Трейлеры и release-ledger корректны; User-Visible:no — CHANGELOG не тронут, и не должен быть.
- Технические возвраты в процессе (companion CI без Chromium в no-browser tooling lane) закрыты адресно: `test/coverage-recorder.test.mjs` сохранил только Node-only часть, реальный Chromium-путь перенесён в новый `demo/smoke_coverage_recorder.mjs`, зарегистрированный в `scripts/ci-registry-inventory.json`.

## Чего не проверял

- Не повторял `gate:small`/`npm run build`/`npm test`/мутационный прогон целиком — принят proof `runs/40077870524` на точном SHA.
- Не исполнял ни один мутант (политика #905) — для AC7 и AC3/AC5 использованы ordinary negative test cases (чтением) и id зарегистрированного свидетеля с «не исполнялся».
- Не проверял содержимое больших сгенерированных артефактов (`docs/audits/parallel-paths-1018-before.json` 10985 строк, `.json.gz` карта 2.9 МБ) построчно — опирался на `bounded reader` (`coverage-audit-read.mjs`) примеры из хендоффа и структурные тесты merger/identity, которые покрыты proof.
- Не запускал Playwright/браузерные смоки локально (среда ревью не имеет такой необходимости при принятом proof); `demo/smoke_coverage_recorder.mjs` и `smoke_ui_1051.mjs` проверены чтением кода, а не повторным запуском.
- Не проверял полную матрицу Golden — не требуется (нет `ci:golden`, нет визуального риска, `User-Visible: no`).
- Ручная dev/GPU-приёмка не требовалась и не выполнялась (не гейт, #929).

## Находки

Нет High. Нет Medium. Побочных находок нет (`mode=issues`: отдельные issue не заводились — заводить нечего).

## Вердикт

Зелёный. AC1–AC8 выполнены и доказаны в объёме, соразмерном задаче; защитные AC имеют непустой столбец «чем краснеет»; трейлеры и release-ledger корректны; изменение продукта ограничено заявленной подсистемой и не меняет поведение.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1018-parallel-path-coverage`, коммит `a01f4f88d5d4` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `c74773e29dd55ac95668bf1b4451ee38bb5164de`
  ```
  git log --all --format='%H %T' | grep c74773e29dd5
  ```
- Тело issue: `25c7b3e973e9da5a222319fa6eaa6df982a51974adcf97f3ba18c617abbdcc58`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ3ODcsIm91dHB1dF90b2tlbnMiOjIzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0OTAxOTk5OTk5OTk5OTk5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo4Miwib3V0cHV0X3Rva2VucyI6MjM0NTIsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTMwMTMyLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NDMzNjkwOCwiY29zdFVzZEVzdGltYXRlIjoxLjYyMjU5MzZ9XSwidHVybnMiOjUwLCJkdXJhdGlvbk1zIjoyOTExMDIsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjYyNzQ5NTYwMDAwMDAwMDMsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4869 output_tokens=23475 cache_creation_input_tokens=130132 cache_read_input_tokens=4336908 num_turns=50 -->
