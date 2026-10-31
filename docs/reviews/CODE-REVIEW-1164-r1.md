# Code review: issue #1164 — заход r1

**Материал:** `84e5633aa3317f072a36c0a2d9c6a9734012c872` (один коммит `fix(release): link stable collections to milestones by number`, поверх `dev` `aa2079df7`).
**Трек:** show. **Маршрут:** fix (не требуется reclassify — см. ниже).

## Скоуп

Задача переводит итоговые ссылки «Все пользовательские изменения» в
`docs/changelog_user_stable_{ru,en}.md` с запроса по названию milestone на
страницу milestone по номеру (`/milestone/N?closed=1`), фиксирует постоянный
формат названия milestone `X.Y.Z` для **текущего** цикла (`readMergeEntry`,
`reconcileEntry`, `verifyMilestone`) и сохраняет одно явное legacy-исключение
для уже опубликованного тела `v1.83.0` (неизменяемая копия тега). Изменения
только в релизном учёте/тулинге и документации; продуктовый код и
конфигурация пользователя не затронуты. `User-Visible: no`, ledger —
`infra` (`docs/release-ledger/v1.83.0/1164.json`), обоснование соответствует.

### Маршрут вердикта (§5)

- complexity ≤3: механическая замена функции ссылки + одна новая guard-функция, один модуль релизного учёта — да.
- surfaces: один модуль (release-ledger/narrative/contract) — да.
- migration: новых compatibility-полей и миграции конфига нет — да.
- ux-contract: карточка/диалоги не меняются — да.
- perf-touch: не затронуто — да.
- undocumented: поведение зафиксировано тем же коммитом в PROCESS.md и docs/DEVELOPMENT.md — да.

Все критерии §5 пройдены → `route: fix`.

## Как проверялось

Static-first: прочитан `REVIEW_CONTEXT`, тело issue #1164 и все три комментария
владельца (включая отклонённый хендофф из-за нераспознанного поля `gates`),
`read:diff`/`read:log` материала, полный `scripts/release-ledger.mjs` (не
только диф) для проверки, как `assertMilestoneNaming` встраивается в
`readMergeEntry`/`reconcileEntry`/`verifyMilestone`, и полный
`test/release-ledger.test.mjs` для проверки фикстур нового теста.

Код проверен независимым разбором до чтения авторского хендоффа:
- `milestoneTitle(targetStable) = targetStable.slice(1)` безопасен, т.к. вызывается
  только после `validateCycle`, которая уже проверяет `^v\d+\.\d+\.\d+$` для `targetStable`.
- `assertMilestoneNaming` сверяет `cycle.milestone.title` именно с цифрами
  `targetStable` (не с отдельным regex), поэтому название не может разойтись
  с целевым stable при правильной реализации.
- `validateCycle` (используется для `milestoneLink`, историчного `readCatalogue`)
  не ужесточён — старые `cycle.json` на тегах v1.81.0…v1.83.0 с `1.81`…`1.83`
  по-прежнему читаются; это проверено как чтением кода, так и тестом
  `milestoneLink('x/y', published)` с `title: '1.81'`.
- `legacyMilestoneQuery`/`milestoneLink` комбинация в `release-contract.mjs`:
  для `published === true` (только когда `tag === cycle.baseStable && tag !== cycle.targetStable`,
  т.е. уже опубликованный stable) тело `RELEASE-NOTES.md` сравнивается с
  авторским changelog после замены `(legacyMilestoneQuery)` → `(milestoneLink)`;
  иначе сравнение дословное. Легаси-ветка не может активироваться для новой
  публикации (`tag === targetStable` исключает её).
- Прогнали найденные полезные нагрузки (negative cases) не воспроизводя их
  руками — они уже оформлены как assertions в `test/release-ledger.test.mjs`
  и `test/release-narrative.test.mjs` и перепроверены исполнением (ниже).

Исполнены адресные проверки через `run_check` (все `executed:true, passed`,
материал не менялся — `materialUnchanged:true`):
- `read:diff`, `read:log` — подтверждение диапазона и содержимого диффа.
- `unit:test/release-ledger.test.mjs` — новый тест
  «milestone naming is permanently X.Y.Z…» зелёный; подтверждает и AC3
  (отказ `assertMilestoneNaming`/`verifyMilestone`/`reconcileEntry` на
  неверном названии), и сохранение старых названий через `validateCycle`.
- `unit:test/release-narrative.test.mjs` — новые assertions зелёные, включая
  отказ на ссылке по названию (`/by number/`) — прямой свидетель AC2 — и
  прохождение legacy-исключения только с `published: true`.
- `unit:test/release-contract.test.mjs` — весь файл зелёный (25/25), включая
  `current repository release metadata satisfies its own publication contract`
  (реальный прогон против фактических `docs/RELEASE-NOTES.md` и
  `docs/changelog_user_stable_{ru,en}.md` текущего репозитория — ключевое
  сквозное доказательство того, что новые ссылки по номеру и
  legacy-исключение для `v1.83.0` действительно совместимы).
- `unit:test/user-stable-changelog.test.mjs` — зелёный, включая обновлённую
  retrospective-проверку на `.../milestone/<N>?closed=1`.
- `unit:test/merge-candidate.test.mjs`, `unit:test/candidate-858.test.mjs`,
  `unit:test/merge-continuation-882.test.mjs`, `unit:test/review-preflight.test.mjs`,
  `unit:test/task-delivery-903.test.mjs` — зелёные после переименования фикстур
  milestone-title на `X.Y.Z` (регрессий от более новой проверки имени нет).
- `build:typecheck` — зелёный (на случай скрытой проблемы с типами в .mjs/TS
  соседях; изменённые файлы — JS, прямого риска не было, но проверено).
- `static:ci-registry-inventory` — зелёный, подтверждает, что
  `scripts/ci-registry-inventory.json` синхронизирован с новым
  `docs/release-ledger/v1.83.0/1164.json` (точечный риск «generated-файл не
  перегенерирован»).

Переиспользовано без повторного исполнения: `review-light` plan
(https://github.com/Matysh/houseplan-card/actions/runs/41181891421, зелёный)
как контекстное подтверждение полного `validate-gate`; из хендоффа —
`npm run test:tooling` (2452/2452 после перегенерации инвентаря),
`node scripts/process-gate.mjs --range aa2079df7..HEAD` (0 предупреждений),
`node scripts/check-docs.mjs --screenshots=warn` (без новых замечаний),
commit-msg hook. Материал и окружение не менялись с момента этих прогонов,
поэтому они остаются валидным доказательством; адресно перепроверены только
модули, прямо изменённые диффом.

Не гонял: smoke-тесты (демо/браузер) — задача не трогает UI/карточку,
тело issue не называет смоук; полный `npm run test:tooling` целиком — не
требуется, т.к. узкий риск (релизный учёт + 10 затронутых тестовых файлов)
уже адресно перепроверен выше, а остальной набор не затронут диффом.

## AC · чем доказан · чем краснеет

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| 1. Все 12 ссылок в обоих user-stable changelog — `/milestone/N?closed=1` с заданными номерами | Прочитан весь диф `docs/changelog_user_stable_{ru,en}.md`: оба файла, все 6 записей каждого языка совпадают с таблицей владельца (9,7,3,4,5,6) | `unit:test/user-stable-changelog.test.mjs` (retrospective-проверка по regex `.../milestone/<N>?closed=1`) + реальный прогон `current repository release metadata satisfies its own publication contract`, оба зелёные |
| 2. Новая stable-запись со ссылкой по названию отвергается валидатором нарратива (защитный AC) | Прочитан код `validateNarrative`: `accepted` не включает title-query, когда `published` не передан/`false` | Обычный тест `test/release-narrative.test.mjs`: `assert.throws(() => check(mixed.replaceAll(collection, titleQuery)), /by number/, 'title queries break on rename')` — исполнен через `run_check`, PASS |
| 3. Текущий `cycle.json`/milestone с неверным названием останавливает слияние и `verify-milestone`; опубликованные циклы читаются как раньше (защитный AC) | Прочитан код `assertMilestoneNaming`, встроен в `readMergeEntry`, `reconcileEntry`, `verifyMilestone`; `validateCycle` не ужесточён | Обычный тест `test/release-ledger.test.mjs`: `assert.throws(() => verifyMilestone(...), /permanent naming/)`, `assert.throws(() => reconcileEntry(...), /renamed or closed/)` — исполнены через `run_check`, PASS; readability истории — `validateCycle(published)` не бросает (та же тест-функция) |

## Находки

Находок в скоупе нет (High: 0, Medium: 0).

## Что проверено и корректно

- Соответствие кода решению владельца из issue/комментариев 2026-10-31
  (номера milestone, формат `X.Y.Z`, единственное legacy-исключение).
- Отсутствие висячих ссылок на старый экспорт `milestoneQuery` во всём
  дереве (`Grep` не нашёл совпадений) — экспорт корректно переименован и
  везде заменён на `milestoneLink`/`legacyMilestoneQuery`.
- `docs/release-ledger/v1.83.0/1164.json`: категория `infra`, `baseStable`
  совпадает с текущим циклом, rationale по существу.
- `scripts/ci-registry-inventory.json` синхронизирован (подтверждено
  `static:ci-registry-inventory`).
- Трейлеры коммита: `Issue: #1164`, `User-Visible: no` (из хендоффа и общего
  контекста issue); при `User-Visible: no` требование параллельной правки
  бета-changelog в том же коммите не применяется.
- PROCESS.md/docs/DEVELOPMENT.md читаются согласованно с новым поведением
  кода (ссылка по номеру, постоянное название, исключение для старых тегов).

## Чего не проверял

- Реальный GitHub API (`gh`) — `ghApi`/`reconcileEntry`/`verifyMilestone` в
  продакшене не вызывались; покрытие — через стаб-API в unit-тестах (это же
  было верно и до задачи, диффом не меняется).
- Полный `npm run test:tooling` целиком в этом ревью не перезапускался;
  зелёный целиком прогон зафиксирован хендоффом и не противоречит адресным
  перепроверкам выше.
- Тела уже опубликованных GitHub-релизов v1.81.0…v1.83.0 — по решению
  владельца сознательно не переписываются, вне скоупа задачи.

## Побочные находки

Побочных находок нет.

Маршрут публикации: `mode=issues` (политика `HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`,
issue 1164, stage code, round 1). Новых outside-issue не заводится — находок вне скоупа нет.

## Вердикт

**green.** Все критерии §5 маршрута пройдены (`route: fix`). AC1–AC3
доказаны (AC2/AC3 — защитные, с обычным тестом-свидетелем, красящим при
отсутствии проверки). Находок нет.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImVmZjU1ODQ4YTFjMmFjNjU0OThiZjlkMDI0NDRiMWY5ODI2OTI1OWE1MTdiM2YxNjdlODU4OTk5OWQ5YWQ1YjciLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiIwYThhMmU1YjUyYWFmNWRlMjgxMWIwNDdlMzc4ZGM1OTc5ZTg3NjUzMjhiZmZjYjRkMzJmMTdiOThhMzQwNDg0IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTY0LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI4NGU1NjMzYWEzMzE3ZjA3MmEzNmMwYTJkOWM2YTk3MzQwMTJjODcyIiwidHJlZSI6IjkyYTE2MTg1NWI0ZDc3NThjODg1MTEzMTFkYjJiZWU2MTBkNGZlZTYiLCJib2R5RGlnZXN0IjoiZWJlMmI0ZDE1MTEzNmM3MDY2ZTA3NTIyZTAwZTQ3ZWIxODlkYmUzODg2NTNlMTQyYzgxNmJmYjk1NzYyODFmNiIsInByb2R1Y2VyUnVuIjoiNDExODIzNDk3ODciLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImU5OTUzZWUwZWY3ODVmNjZkMWFhMTRjNzg1MmVjZTc4MjU3YTFjNDA5ODhkYzM2YmMyMjkyM2RkZGVmZDkwMmQiLCJ2ZXJkaWN0RGlnZXN0IjoiNTI3OWE4YWZlNTQyYjcxYjlhNGMxY2JhNmQzNWNhOWIxYjhlNjM2YTM2NDZhZjc3M2M4MzQzYTlmNDdlMDhjMyIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJhMDUwNmVhNDI2YjAwNDVmMzZiNDVkYmUwNjZmOWQ3ODJjOGU2OGJlYzVmYjIwMTE1YzVmZDI5NDVjMjc5ZWQyIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTQwOTEwNzY0LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTY0I2lzc3VlY29tbWVudC02NTQwOTEwNzY0IiwiYm9keURpZ2VzdCI6IjAyNWUwMWEyYzRkOWFiNzBhMDc3MjM3ODMyMmQ5MzI1MTFkYzRmYzg1ZjU3OGRhODRjODc1ZTk3ZDMzNzUwMTMifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1164-milestone-links`, коммит `84e5633aa331` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `92a161855b4d7758c88511311db2bee610d4fee6`
  ```
  git log --all --format='%H %T' | grep 92a161855b4d
  ```
- Тело issue: `ebe2b4d151136c7066e07522e00e47eb189dbe388653e142c816bfb9576281f6`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NDYsIm91dHB1dF90b2tlbnMiOjIyMTg3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEzNjA2MiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjIwOTM0MzYsImNvc3RVc2RFc3RpbWF0ZSI6MS4xODQ4OTcyfV0sInR1cm5zIjozNiwiZHVyYXRpb25NcyI6MzQxNDExLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4xODQ4OTcyLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=46 output_tokens=22187 cache_creation_input_tokens=136062 cache_read_input_tokens=2093436 num_turns=36 -->
