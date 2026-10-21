# CODE-REVIEW-983-r1

Issue: #983 · Этап: code · Трек: show · Заход: r1 · блокирующих циклов 0/2
Материал: `git diff origin/dev...HEAD`, `HEAD = db1709c3fbeb32a4e92677c893baaeb157e9bbc6`
Коммиты в материале:
- `1f8ffe4858b2` ci: select task-push browser progress checks by proven inputs — `Issue: #983`, `User-Visible: no`
- `db1709c3fbeb` ci: preserve scripts-only proof tools and validate selected browser wiring — `Issue: #983`, `User-Visible: no`

## Скоуп

Инфраструктурная задача (аудит 2026-10-21 §5.4 R4): `task-ci-plan.mjs`
на push ветки задачи с меткой `ci:golden`/`ci:full` гонял полную
browser-матрицу (все шарды смоков + весь golden) на каждом промежуточном
push, что стоило сотен машинных минут на длинных UI-ветках (пример:
#976 — 11 push, 857.7 машинных минут). Задача сужает промежуточный push
до доказанного подмножества (затронутые golden-сцены по явным связям,
`smoke-select`/изменённые smoke-файлы), сохраняя полную матрицу на
`workflow_dispatch full=true` (S7, ночь, кандидат беты, PR) и
консервативный fallback на full при недоказанной связи. Продуктового
кода (`src/**`) диапазон не затрагивает вовсе — это строго CI/tooling
изменение. Не создаёт новых UX-контрактов, миграций конфигурации и не
влияет на производительность/touch продукта — критерии §5 трека `show`
выполняются, `route: fix`.

Файлы: `.github/workflows/validate.yml`, `scripts/browser-push-plan.mjs`
(новый), `scripts/browser-selected.mjs` (новый),
`scripts/browser-plan-proof.mjs` (новый), `scripts/task-ci-plan.mjs`,
`scripts/classify-changes.mjs`, `scripts/ci-proof.mjs`,
`test/browser-push-plan.test.mjs` (новый),
`test/validate-workflow.test.mjs`, два комментария-свидетеля в
`demo/golden/device-battery.mjs` и `demo/smoke_modes.mjs`,
`PROCESS.md`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`,
`docs/STATUS.md`, `docs/release-ledger/v1.81.0/983.json`.

## Как проверялось

`node scripts/smoke-select.mjs --base origin/dev --head HEAD` лично
прогнан: «Исполняемого frontend-диффа нет (src/**/*.ts не тронут)»,
16 файлов тронуто. Подтверждает: диапазон ревью не содержит продуктового
кода, поэтому отдельный browser-смок/golden-прогон от меня не требуется
сверх того, что уже реально исполнила CI на этом SHA (ниже).

Дешёвые гейты (`tsc`, `npm test`, `npm run build` + bundle-policy)
подтверждены зелёным Validate на точном SHA материала
(run 39529273932, `conclusion: success`, `headSha: db1709c3f...`,
проверено `gh run view`), повторно не гонялись — правило #343.

Дополнительно я сам проверил через `gh run view`/`gh run download`
(не со слов автора) два релевантных прогона на точном SHA материала:

| Прогон | Событие | Результат | Что показывает |
|---|---|---|---|
| [39529273932](https://github.com/Matysh/houseplan-card/actions/runs/39529273932) | `workflow_dispatch full=true` (S7) | success, все шарды смоков + `Golden-кадры против принятых эталонов` + перф-смок — success, `Браузер: выбранные проверки push` — **skipped** | AC3: кандидат S7 получает полную матрицу, выбранный push-воркер в full-прогоне не участвует |
| [39528567227](https://github.com/Matysh/houseplan-card/actions/runs/39528567227) | `push` (реальный push ветки) | success, `Браузер: выбранные проверки push` — success, полные смоки/golden/перф — **skipped** | AC1/AC2: промежуточный push реально выполнил только выбранное |

Скачан `ci-proof-39528567227-1/proof.json` этого push-прогона и
прочитан напрямую. `browserPlan.planned.files` совпадает со списком
файлов `git diff origin/dev...HEAD --stat` этого материала;
`golden.mode: "selected"`, `ids`: 4 сцены `device-battery-*`
(связь из `demo/golden/device-battery.mjs` → `goldenConnections()`);
`smoke.mode: "selected"`, `ids: ["smoke_modes.mjs"]`; оба
`executed.*.result: "success"`. Это не декларация автора, а
независимо скачанный артефакт точного SHA ревью.

## Находки

### Low — защитные ветки `unknownEntry`/`harnessChanged` без собственного отрицательного случая

`scripts/browser-push-plan.mjs`, функция `browserPushPlan`, блок
`ci:full`:

```js
const unknownEntry = ids.some(id => !allSmokes.includes(id));
const harnessChanged = files.some(f => /^demo\//.test(f) && !/^demo\/smoke_/.test(f)
  && !/^demo\/(golden|docs|stand)\//.test(f));
```

Обе ветки — честный fail-safe (расширяют до `full`, не сужают), и по
чтению корректны: `unknownEntry` ловит ссылку реестра `smoke-select` на
удалённый/переименованный smoke-файл, `harnessChanged` — правку общего
browser-harness (`demo/serve.mjs`, `demo/fixtures/**` и т.п.) без
зарегистрированной связи. Но ни одна не покрыта отдельным тестом в
`test/browser-push-plan.test.mjs`: там проверены `unknownSource` (src
без выбора) и golden-линки (`links: {}` → full), а эти две ветки — нет.
Хендофф-таблица автора заявляет «removed smoke/harness change → full»
как доказанное для AC2 — по факту это не продемонстрировано тестом,
только разобрано чтением.

Чем краснеет (не исполнялся, проверено чтением): отрицательный случай
не зарегистрирован и не исполнен — ни ordinary test, ни id witness.

Трек `show`: отсутствие записи в реестре/отрицательного теста для
защитной ветки — бухгалтерия, не дефект поведения (REVIEWER.md,
«Трек show»). Low, цикла не открывает.

### Low — AC2 «потеря сцены в тесте» продемонстрирована только для golden-связей, не для smoke-реестра

Формулировка AC2 («удаление явной связи из AC видно как потеря сцены в
тесте») проверена тестом `#983 a real dedicated golden input selects
its declared scenes...` только на стороне golden (`links: {}` → full).
Симметричный случай для smoke (`registeredSmokes` ссылается на
удалённый smoke-файл → `unknownEntry`) теста не имеет — та же причина,
что и выше, записываю отдельно, так как относится к другой строке AC.
Low, та же категория бухгалтерии, цикла не открывает.

## Что проверено и корректно

- **AC1** (push с `ci:golden`, golden только по затронутым сценам,
  conservative fallback на full при недоказанной связи, полный golden
  на dispatch S7): проверено чтением `browserPushPlan`/`goldenConnections`
  и реальным исполнением на материале (таблица выше + `proof.json`).
  Негативные случаи — удаление/отсутствие связи (`links: {}` → full),
  удалённый src-модуль не может выпасть из покрытия (`corpus: []` всё
  равно даёт full по regex `^(?:src|assets)/`) — покрыты тестом и
  прочитаны корректно.
- **AC2** (push с `ci:full` — подмножество `smoke-select`, dispatch —
  вся матрица, пустой/недоказанный выбор при изменённом `src/**` не
  даёт пустой зелёный): подтверждено тестом
  `#983 ci:full uses smoke-select entries...` (`unproven`/`empty` →
  full, `ids.length > 100`) и реальным прогоном (`smoke_modes.mjs`
  выбран по изменению самого файла). `taskCiPlan` корректно не строит
  browser-план для `workflow_dispatch`/`pull_request`/`schedule` и
  возвращает прежний безусловный full — тест
  `#983 unrelated tests/docs...` и `#983 actual heavy CLI...` это
  подтверждают реальным вызовом CLI/шага workflow, не только юнитом.
- **AC3** (S7 по-прежнему получает полную матрицу; замер машинных
  минут; perечень fresh/skipped и оснований): полная матрица на S7
  подтверждена реальным прогоном (таблица выше), а не только тестом.
  `proof.browserPlan` реально публикует `planned/executed/skipped` с
  причинами — проверено по скачанному артефакту. Защита от подделки
  (`forged selected-success metadata` не проходит без реального
  зелёного `browser_selected`) разобрана в `scripts/ci-proof.mjs:424-437`
  и покрыта тестом `#983 real proof policies refuse partial progress...`,
  включая перекрёстную сверку с независимо запрошенным списком `jobs`
  (`executedCheckIsGreen`), а не только с полем внутри самого `proof.json` —
  это и есть «чем краснеет» для защитного механизма AC3.
  Измерение «до/после на двух сопоставимых задачах (например, #976 и
  следующая UI-задача)» в АС буквально требует задачи, которой ещё не
  существует (следующая UI-задача не прошла этот контур до мержа
  инфраструктуры физически не могла). Автор честно обозначил это
  ограничение и заменил его контролируемым сравнением full/selected на
  одном и том же дереве продукта этого же SHA (0.75 golden-мин / 17.68
  всего против 68.12 golden-мин / 74.00 всего) плюс отдельно
  промаркированной исторической оценкой по #976 (bounded replay,
  явно не выдаваемой за фактическую экономию). Это не подмена факта
  удобным, а более строгий контролируемый эксперимент при честно
  названном ограничении — принимаю как выполнение намерения AC3, не
  нахожу.
- Трейлеры `Issue: #983`/`User-Visible: no` — на обоих коммитах, верно
  (чисто инфраструктурное изменение, нет видимого пользователю
  поведения продукта → changelog не требуется).
- `docs/release-ledger/v1.81.0/983.json`: `category: "infra"`, без
  milestone — верно, инфраструктурная/внутренняя правка не входит в
  пользовательский milestone релиза; `introducedBy` не требуется
  (не правка новой бета-функции).
- §8 «одно число — один источник»: в диффе нет пользовательски видимых
  величин (чисто CI/infra), применимости нет.
- `UNCONSUMED_JOBS.browser_selected` зарегистрирован, его каноническое
  имя совпадает с `name:` реальной job в `validate.yml` (сверено
  `grep`) — не повиснет как недекларированная job в реестре полноты.
- `test/validate-workflow.test.mjs`: обновлённые числовые assertions
  (`card-bundle` 5→6, `card-test-build` 2→3, `bundle-sync.mjs` 3→4)
  лично пересчитаны по факту (`grep -c` по `validate.yml`) — совпадают.
- `proof` job (`needs:` + `if: always()`) корректно добавляет
  `browser_selected` без изменения семантики условного skip у прочих
  опциональных job — тот же паттерн, что у `golden`/`geometry_parity`.
- Документация (`ARCHITECTURE.md`, `DEVELOPMENT.md`, `STATUS.md`,
  `PROCESS.md`) обновлена в соответствии с реальным поведением кода —
  несоответствий при чтении не найдено.

## Чего не проверял

- Не гонял `npx tsc --noEmit`/`npm test`/`npm run build` локально —
  подтверждены зелёным Validate на точном SHA (#343), сверено
  независимо через `gh run view` (status/conclusion), не только со
  слов автора.
- Не гонял `golden:verify`/Chromium локально — на точном SHA это уже
  реально исполнено дважды в CI (полный прогон и выбранный), оба
  success, артефакт `proof.json` скачан и прочитан лично; локальный
  повтор был бы тем же самым прогоном без новой информации, а
  Chromium-смоук не назван в теле issue (#696).
- `pytest tests_backend` — не прогонял, диапазон не трогает Python.
- `npm run invariants` — не прогонял, диапазон не трогает геометрию
  модели/`src/**` (подтверждено `smoke-select`: «src/**/*.ts не
  тронут»).
- Не проверял содержимое/пороги golden-эталонов, реестр #981 и
  профили воркфлоу #980 — явно вне скоупа задачи и не тронуты диффом.
- Исторический «bounded replay» #976 (857.7 → оценка 37.3/60.7
  сэкономленных минут) принят как заявленная автором оценка, не как
  факт — он так и помечен в handoff, пересчитывать его самостоятельно
  не стал (не часть AC, иллюстрация).

## Побочные находки

Доверенный снимок политики: `mode=issues`. Побочных находок Medium
вне скоупа нет — отдельные issue не заводились.

---

Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 → в задаче

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/983-browser-push-plan`, коммит `db1709c3fbeb` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `69c8c37479d777b6c595f30499ac3122d2290876`
  ```
  git log --all --format='%H %T' | grep 69c8c37479d7
  ```
- Тело issue: `4bb107df18e4370df213425019c8fe4391807fecb5314747fb24b77d130c2e6e`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMDMsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTg4fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo3Niwib3V0cHV0X3Rva2VucyI6NDcxNDUsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTMwMDM2LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MzY2MTg3MywiY29zdFVzZEVzdGltYXRlIjoxLjcyNDEyMDZ9XSwidHVybnMiOjQ0LCJkdXJhdGlvbk1zIjo1NjcyOTUsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjcyOTMwODYsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5179 output_tokens=47162 cache_creation_input_tokens=130036 cache_read_input_tokens=3661873 num_turns=44 -->
