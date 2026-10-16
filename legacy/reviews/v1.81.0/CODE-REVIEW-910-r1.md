# CODE-REVIEW-910-r1

Issue: #910 · Трек: ask · Заход r1 · блокирующих циклов 0/4
Материал: `5dc7ded316f3754a8fc72f2dbc1e69b0a2bdfc8d` (`issue/910-evidence-accuracy`,
`git diff origin/dev...HEAD`, один коммит `test: isolate dirty series and
clarify evidence history`).
Спецификация: тело issue #910 (раздел `## ТЗ`), принята зелёным на
SPEC-REVIEW-910-r1 (High 0, Medium 0).

## Скоуп

`git diff origin/dev...HEAD --stat`: 8 файлов, +218/−0, только классы B/C:

- `test/node-performance-report.test.mjs` — новый юнит AC1 (uniform-dirty triple).
- `test/process-digests.test.mjs` — новый юнит AC2 (текстовый контракт чек-листа).
- `docs/DEVELOPMENT.md` — раздел «Evidence accuracy and historical errata (#910)»
  (bounded checklist, 34 строки).
- `docs/TESTING.md` — одна строка-указатель на раздел выше (878 → 880 строк,
  ровно потолок #681/#898).
- `docs/ARCHITECTURE.md`, `docs/STATUS.md` — абзацы-дайджесты задачи.
- `docs/analysis/910-evidence-errata-2026-10-15.md` — новая датированная errata
  (8 пунктов F-BATCH-006/008/013/015/028/032/034/040).
- `docs/release-ledger/v1.80.1/910.json` — авторский ledger, `category: infra`.

Нет файлов класса A, нет исполняемого продукта/демо-кода, нет golden baselines.
Коммит несёт `Issue: #910` и `User-Visible: no`; изменение не затрагивает
пользовательское поведение Houseplan, поэтому второй changelog не требуется —
проверено (оба `docs/CHANGELOG*.md` действительно не менялись в диффе).

Маршрут `track:ask` — прямое поручение владельца от 2026-10-15, явно
процитированное в ТЗ («расширение маршрута... явным поручением»), не ошибка
агента; принято без вопроса.

## Как проверялось

| Гейт | Статус | Источник |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + bundle-policy | не перегонял | зелёный Validate на точном материале `5dc7ded3`: https://github.com/Matysh/houseplan-card/actions/runs/38761372020 (#343) |
| `node --test test/node-performance-report.test.mjs test/process-digests.test.mjs` | **прогнал сам** | 17/17 PASS (включает оба новых теста `#910 AC1`/`#910 AC2`), 0 fail, 0 skipped |
| `golden:verify`, смоки, `pytest tests_backend`, инварианты геометрии, performance | не применимо | диапазон не трогает `src/**`, `demo/**` рендер, Python, геометрию стен/плана; AC не называют ни один из этих гейтов |
| `node scripts/mutation-gate.mjs --check` (статический) | не перегонял — принят авторский | definitions=1600, execution=0 (ночной прогон реестра — не обязанность код-ревью, #709) |
| Исполнение мутантов/ручной патч гарда | **не исполнялось и не исполнял** | запрещено ревьюеру вне ночного workflow (§2.7, #905); AC1/AC2 проверены чтением + обычным прогоном без патча реализации |

Чтением проверены: `demo/helpers/node-performance-report.mjs:92-120` (сигнатура
и `nodeSeriesSummary`), весь новый тест `#910 AC1`, весь новый тест
`#910 AC2`, `scripts/md-anchors.mjs` (используемые `sectionText`/`markdownLinks`),
содержимое нового раздела `docs/DEVELOPMENT.md` и errata-документа. Для AC3
дополнительно сверены первичные источники по 7 из 8 пунктов errata (см. ниже)
через GitHub API/веб (не повторное исполнение исторических тестов/benchmark/
мутантов — только чтение issue-комментариев, ревью-документов и прогона
Actions job steps).

## Разбор по AC

| AC | Чем доказан | Чем краснеет / граница |
|---|---|---|
| AC1 | Новый юнит: все три receipt делаются `dirty:true` и при этом взаимно `deepEqual` друг другу и (с точностью до `dirty`) clean-контролю; `nodeSeriesSummary` даёт `comparable:false` для uniform-dirty и `true` для uniform-clean; оба входа `deepEqual` до/после. Прочитан код `signature()` (demo/helpers/node-performance-report.mjs:92-105): `material.dirty !== false` делает `signature` → `null`, а `comparable = keys.every(key => key && key === keys[0])` — `key &&` отбрасывает `null` независимо от взаимного равенства. Это и есть изоляция: отказ идёт по собственной невалидности сигнатуры, а не по межreceipt mismatch, что прямо соответствует формулировке AC1 и «Проблеме» ТЗ | Ordinary negative case в самом тесте (uniform `dirty:true` triple отклонён) — проверено исполнением (PASS). Проверено чтением: если убрать проверку `dirty!==false` из `signature`, либо убрать `key &&` перед `key === keys[0]`, uniform-dirty получил бы одинаковые non-null (или одинаково null) ключи и тест AC1 покраснел бы на `assert.equal(summary.comparable, false)`. Мутант не исполнялся (запрещено вне ночи) |
| AC2 | Новый `test/process-digests.test.mjs` тест: секция `docs/DEVELOPMENT.md#evidence-accuracy-and-historical-errata-910` существует, `docs/TESTING.md` ссылается на неё тем же якорем, 19 обязательных фраз (`executed`/`reused`/`equivalence`/`not run / unknown`, различение golden threshold vs nonzero differingPixels vs byte-identical witness floor, сохранение raw/exit до display, запрет переписывать original verdict/anchors/raw) присутствуют дословно, ровно одна локальная ссылка в секции резолвится на существующий `docs/analysis/910-evidence-errata-2026-10-15.md` | Текстовый контракт: удаление/правка любой из 19 фраз или битая/лишняя ссылка красит тест — проверено чтением тела теста (цикл `assert.ok(norm(section).includes(norm(phrase)))` по списку, `assert.equal(links.length, 1)`). Это не семантическая проверка и не заявлена как таковая (сам текст прямо это оговаривает) |
| AC3 | `docs/analysis/910-evidence-errata-2026-10-15.md`, 8 пунктов. Проверено чтением и перекрёстной сверкой с первичными источниками (не повторным исполнением): F-BATCH-013 (#846 AC9-дубликат и «AC1–AC9» вывод — подтверждено построчным чтением `CODE-REVIEW-846-r1.md:69,116`); F-BATCH-008 (Run 38640250337: шаг `Review` стартовал 21:28:05Z, cancelled 21:42:13Z — подтверждено прямым запросом `gh api .../jobs/.../steps`, секунда в секунду совпадает с errata); F-BATCH-034 (#894 сумма 402/457 — подтверждено сверкой арифметики 20+22+22+56+22+45+15+8+29+24+85+39+15=402, 10+11+34=55→457 и дословным текстом комментария 6186570973); F-BATCH-032 (#861 второй FAIL UNKNOWN — подтверждено дословным текстом комментария 6185905496: «Второй — UNKNOWN: stdout был tool-truncated»); F-BATCH-040 (#895: README `evidence-895/README.md` подтверждает фактически измеренные `fcef2752…`/`b6f18353…`, а не `d28cdbee`; арифметика 131+74=205 совпадает с «205/205 threshold PASS»; оригинальный текст ревью на L98 действительно смешивает «78 сцен с nonzero differingPixels в пределах floor10», что при floor10=10 арифметически бессмысленно — errata права, что это разные величины); F-BATCH-015 (#896: финальный handoff подтверждает «четыре inherited foreign-HA consumers и десять… adapters» = 4+14, и «восемь именованных native-смоков» в исходном ревью — оба числа у errata совпадают). F-BATCH-028 (#849) сверен частично: полный `npm test` 4715/0/1 в комментарии 6183968610 подтверждён дословно; более тонкий довод «TypeError-провенанс переоценён» проверен по формулировке отчёта, но не по полному диффу #846 — точечно, пропорционально риску (см. «Чего не проверял») | Defensive-характер здесь ограничен: это не guard/лимит в продукте, а фактическая точность исторической прозы. «Чем краснеет» не применимо в терминах мутанта — явно оговорено в ТЗ/не-скоупе («не NLP fact-checker»). Проверено чтением, не исполнением, как и требует общее правило для такого рода AC |

## Находки

Нет High. Нет Medium.

## Что проверено и корректно

- Изменённый юнит действительно закрывает проблему из ТЗ: старый тест
  (`#888 foreign, dirty, partial...`, тот же файл) портит только один receipt
  из трёх — rejection там объясним межreceipt mismatch. Новый `#910 AC1`
  явно добавляет недостающий uniform-dirty случай и фиксирует, что отказ не
  зависит от различия между receipts.
- `docs/TESTING.md` не превысил потолок 880 строк (#681/#898) — ровно на
  пределе, ссылка короткая, сам чек-лист вынесен в `docs/DEVELOPMENT.md`, как
  и описано в хендоффе.
- Release-ledger классификация (`category: infra`, `baseStable: v1.80.1`)
  согласована с прецедентами (`905.json`, `896.json` — тот же паттерн для
  аналогичных B/C-only задач); `User-Visible: no` в трейлере коммита
  соответствует отсутствию milestone и правке обоих changelog — расхождений
  нет, число (строки трейлера) видно один раз с одним источником (коммит).
- Семь из восьми пунктов errata перепроверены по первичным источникам
  (issue-комментарии, GitHub Actions job steps, арифметика) и совпадают
  дословно/числом — ни одного искажённого факта, изобретённого future-SHA-
  измерения или переписанного original verdict/anchor не найдено.
- Чек-лист (AC2) прямо оговаривает собственные границы («не семантическую
  истинность отчётов», «не новый исполнитель/универсальная платформа») —
  согласуется с «Не-скоуп» ТЗ.
- Старые мутанты/гварды/бюджеты не тронуты; `mutation-gate.mjs --check`
  статически PASS без исполнения.

## Чего не проверял

- Полный `npx tsc --noEmit`/`npm test`/`npm run build`+bundle-policy —
  приняты по зелёному Validate на точном материале (#343, ссылка выше); сам
  прогнал только два целевых файла теста (дешёвый, целевой гейт).
- Golden/смоки/pytest/инварианты/performance — не применимо, диапазон не
  трогает `src/**`, рендер, Python или геометрию; AC их не называют.
- Исполнение мутантов (новых/старых) — запрещено ревьюеру вне ночного
  workflow; поимка AC1 подтверждена чтением кода гарда, не прогоном.
- F-BATCH-028 (#849): точный довод о провенансе TypeError-регрессии
  (связь с `_acceptTapConfirm`/#846) проверен по формулировке отчёта и части
  обвязки (`view-action-context.ts`/тесты), но не полным построчным диффом
  #846 — риск здесь ниже, чем у числовых фактов, уже перепроверенных выше.
- Полная цепочка публикации Validate на `5dc7ded3` (job steps CI) не
  перечитывалась построчно — принят статус success по ссылке из задания.
- Старые закрытые issue (#888/#861/#862/#895 и т.д.) не переоткрывались и их
  вердикты не пересматривались — это прямо вне скоупа ТЗ и не входит в
  обязанности этого ревью.

## Вывод

Задача делает ровно заявленное: один обычный unit изолирует uniform-dirty
серию без исполнения мутантов, bounded чек-лист — текстовый контракт со
своими явными границами, errata — точная и проверяемая по первичным
источникам историческая правка без переписывания исходных вердиктов/anchors.
Классы изменений B/C, трейлеры и release-ledger корректны. Находок нет.

Зелёный.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/910-evidence-accuracy`, коммит `5dc7ded316f3` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `5fd0ae71119753bdbf4ee05c7f25a7ffda8bd782`
  ```
  git log --all --format='%H %T' | grep 5fd0ae711197
  ```
- Тело issue: `a487b7cb59bc6f925f0c216dbfbf8a8132bc4ecf97f9bf2751618792db997a39`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ1NzUsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NjY1fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo1Miwib3V0cHV0X3Rva2VucyI6MjIwMDAsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6OTkwNTQsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoyMTIxODY0LCJjb3N0VXNkRXN0aW1hdGUiOjEuMDQwNjkyOH1dLCJ0dXJucyI6NDMsImR1cmF0aW9uTXMiOjM4NjAwMiwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjEuMDQ1MzU3ODAwMDAwMDAwMSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4627 output_tokens=22018 cache_creation_input_tokens=99054 cache_read_input_tokens=2121864 num_turns=43 -->
