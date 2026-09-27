# CODE-REVIEW-310-r2

Issue: https://github.com/Matysh/houseplan-card/issues/310
Ветка: `issue/310-pair-apex` @ `89ac6024bca2e836ac53ed0b85fbce728c25adc9`
ТЗ: `docs/specs/310-pair-apex.md` (ревизия 2, SPEC-REVIEW-310-r2 — зелёный)
Заход: r2 (второй код-ревью; r1 — жёлтый, High:1/Medium:1)

## 1. Раунд r1 и дельта

r1 проведён на SHA `0e6fbfb0` (документ `docs/reviews/CODE-REVIEW-310-r1.md`,
закоммичен `2e3874f1`). Вердикт r1: жёлтый, High:1, Medium:1.

Дельта r1→r2 — ровно один коммит, `89ac6024` (`git diff 0e6fbfb0..89ac6024`):

```
test/wall-thickness.test.mjs | 55 ++++++++++++++++++++++++++++++++++++++++++++
1 file changed, 55 insertions(+)
```

Продуктовый код (`src/**`) не тронут — только новый юнит-тест и текст коммита
(правка происхождения эталона живёт в trailer'ах нового коммита, а не в файлах).
Это чисто аддитивная дельта: разбор по существу — что доказывают эти 55 строк
и честен ли новый trailer `Baseline-Reviewed`; остальной код унаследован из r1
без повторного вычитывания (раздел 4).

## 2. Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **High** — `Baseline-Reviewed` в `0e6fbfb0` указывал на прогон ветки `issue/309-junction-visual-limit` (SHA `6c1534f1`, предок первого коммита #310), у которого к тому же нет артефакта `golden-images` (job `golden` там прошёл зелёным без выгрузки) | Новым коммитом `89ac6024` (историю `0e6fbfb0`/`de0867b0` не переписывали) добавлен честный trailer `Baseline-Reviewed: .../runs/32894391916` — реальный Validate-прогон **на самом SHA `0e6fbfb0`**, ветка `issue/310-pair-apex`; job `golden` в нём зелёный. Commit message прямо называет прежний trailer ошибкой и описывает новый как «подтверждающий прогон этого кода и эталона», не выдавая его за пре-accept review-артефакт | Проверено `gh run view 32894391916 --json headBranch,headSha,status,conclusion` → `headBranch: issue/310-pair-apex`, `headSha: 0e6fbfb0...`, `conclusion: success`; `gh run view ... --json jobs` → `golden: success`. Commit `89ac6024` message (см. §3.1) |
| **Medium (в скоупе)** — обещанный ТЗ §8/риск №3 юнит «пара с коротким толстым саппортом (#271+#310)» отсутствовал в диффе | Добавлен `issue 310 a short deep support pair bounds the wedge by its own length and stays hole-free` (`test/wall-thickness.test.mjs:3348`): деградированная толстая (h=20) стена длиной 30 < 2·20 против тонкой (h=10) опоры; проверяет, что все вершины клина не выходят за `min(2·halfDepth, length)`, и что сеточный контракт (кладка = полосы ∪ патч − клинья) чист на этой конфигурации. Комментарий в тесте фиксирует структурную невозможность интерференции с латеральным тримом #271: его карта узлов (`buildMultiWallNodeMap`) требует ≥3 канонических лучей, узел-пара в неё не попадает | `test/wall-thickness.test.mjs:3348-3402`; мутационно перепроверено (см. §3.2) |

## 3. Проверка дельты

### 3.1 Честность нового `Baseline-Reviewed`

Проверено самостоятельно, не со слов автора:

```
gh run view 32894391916 --repo Matysh/houseplan-card \
  --json headBranch,headSha,status,conclusion,workflowName
→ {"conclusion":"success","headBranch":"issue/310-pair-apex",
   "headSha":"0e6fbfb00b81166bf3d9323fd21dfb86524cd3ed",
   "status":"completed","workflowName":"Validate"}

gh run view 32894391916 --repo Matysh/houseplan-card --json jobs \
  -q '.jobs[] | {name,conclusion}'
→ ...  "golden": "success"  ...
```

SHA прогона совпадает байт-в-байт с SHA коммита `0e6fbfb0`, который несёт и код
`pairButtEndTrimWedges`/безлимитный mitre, и принятый PNG — то есть ссылка
больше не указывает на посторонний прогон/ветку, находка High r1 (недостоверная
ссылка = «invent a review link») закрыта фактически, не только формулировкой.

Отдельно: это не тот же самый процесс, что описан в `demo/golden/README.md`
(«use the `golden-images` artifact produced by the Linux CI job as the review
set», т.е. кандидат из CI-артефакта разбирается **до** `golden:accept`) — этот
прогон стартовал уже с закоммиченным эталоном и лишь подтверждает постфактум,
что код+эталон согласованы на Linux CI (то самое пиксельное несоответствие
шрифтов между окружениями, ради которого правило существует, тут исключено
объективно, а не на словах). Это ровно вариант «б», который r1 сама
предлагала как приемлемое закрытие («честная запись происхождения» +
согласование с владельцем) — и коммит-сообщение с этим и оформлен, автор —
владелец. Отдельно High/Medium не поднимаю: r1 явно допускала этот путь как
достаточный.

### 3.2 Новый юнит-тест — умеет падать

Временно откатил ограничение `reach` до `2·halfDepth` без учёта длины стены
(`self.length`) в `src/wall-thickness.ts:1202` и пересобрал `test-build`:

```
const reach = Math.min(2 * self.halfDepth, self.length);  →  const reach = 2 * self.halfDepth;
```

```
node --test --test-name-pattern "short deep support pair" test/wall-thickness.test.mjs
не ok 1 - issue 310 a short deep support pair bounds the wedge by its own length and stays hole-free
  error: "wedge vertex 41.19...,-10.00... reaches past the wall's own end"
```

Тест красный на мутации, целится в правильную ветку. Правка отменена
(`git checkout -- src/wall-thickness.ts`), `test-build` пересобран обратно.
Гварда не тавтологична коду под тестом.

Структурный аргумент теста (интерференция с #271 невозможна, т.к.
`buildMultiWallNodeMap` требует ≥3 лучей) — тот же факт, что независимо
подтверждала r1 по `src/wall-thickness.ts:1984,2032`; сам код `pairButtEndTrimWedges`
и `reach = Math.min(2 * self.halfDepth, self.length)` в этой дельте не менялись
(существовали уже на момент r1, там же был проверен мутант `butt-end-trim-unbounded`) —
новый тест лишь добавляет покрытие обещанного сценария, не меняя контракт.

## 4. Унаследовано из r1

Без повторной проверки в r2 (документ `docs/reviews/CODE-REVIEW-310-r1.md`,
коммит `2e3874f1`, база — SHA `0e6fbfb0`), так как дельта r1→r2 их не задевает:

- Скоуп диффа (§1 r1): `linearWallJoinPatches` без лимита, `pairButtEndTrimWedges`,
  порядок вычитания в `physicalBodyParts` до `cutPartitionBody`, `drawWallPreviewD`.
- AC1–AC4, AC6, AC7 (§3 r1) — остриё без фаски, зубец срезан, узлы ≥3 лучей
  байтово прежние (`golden:verify` 129/129 включая `junction-309-step/hump`),
  90°-пара без клина, все три мутанта `pair-chamfer-returns`/
  `butt-end-trim-disabled`/`butt-end-trim-unbounded` красные.
- AC5 (парный сеточный контракт) — тест `issue 310 pair grid contract...`
  (test/wall-thickness.test.mjs:3274), не менялся в этой дельте.
- §5 r1 «Что проверено и корректно»: T-узлы корректно исключены из парной
  ветки, читаемость реализации, трейлеры `de0867b0`/`0e6fbfb0` (кроме содержания
  `Baseline-Reviewed`, закрыто выше), Low-находка о дублировании
  `subtractWedgeFromBody`/`clipBodyByWedge` — не поднята до Medium в r1, автор
  её не трогал в этой дельте, остаётся на его суждение при следующей правке
  области (Low, не блокирует).
- §6 r1 «Чего не проверял»: полная браузерная смок-матрица, `pytest
  tests_backend`, `model-invariants`, побайтовый `golden:accept` — основания
  не изменились (дельта r2 их тем более не касается, диф даже не трогает
  `src/**`).

## 5. Гейты этого раунда

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | чисто |
| Unit | `npm test` | 1315 объявлено / 1314 pass / 0 fail / 1 skip — совпадает с хендоффом |
| Мутация нового теста | ручной откат `reach` в `src/wall-thickness.ts` + `tsc -p tsconfig.test.json && fix-test-build.mjs && node --test` на целевом тесте | красный на мутации (см. §3.2), правка отменена |
| Build + бандлы | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | собран, `cmp` — побайтовое совпадение, `git status` чист |
| Docs fingerprint | — | не запускался: дельта r1→r2 не трогает `src/**` (только тест) |
| Смок-выборка | `node scripts/smoke-select.mjs --base 0e6fbfb0 --head HEAD` | «Исполняемого frontend-диффа нет (`src/**/*.ts` не тронут)» — выбирать нечего, браузерные смоки к этой дельте неприменимы |
| Golden | `npm run bundle:sync && npm run golden:verify` | 129/129 `passed` (перепрогнан лично на текущем HEAD, не только со слов автора) |
| Backend | — | не запускался: Python не тронут |
| Model invariants | — | не запускался: диф не меняет модель/геометрию/конфиг, только тестовый файл |
| «Одно число — один источник» | — | неприменимо: дельта не добавляет и не меняет пользовательски видимых величин |

## 6. Чего не проверял

- Полную браузерную смок-матрицу (190 файлов) и `performance_smoke` —
  избыточно, дельта не трогает `src/**` вовсе; `smoke-select` подтвердил
  «выбирать нечего».
- `python -m pytest tests_backend` — Python не тронут ни в этом раунде, ни
  накопленным диффом с `origin/dev`.
- `scripts/model-invariants.mjs` — геометрия/модель/конфиг не менялись.
- Скриншоты документации — `check-docs.mjs` не запускался (диф не трогает
  `src/**`), содержательных изменений публичных экранов эта дельта не вносит.
- Повторную полную вычитку кода `pairButtEndTrimWedges`/`physicalBodyParts`/
  `drawWallPreviewD` — не требуется, эти файлы не в дельте r1→r2, r1 их
  проверила построчно (§4 «Унаследовано из r1»).

## 7. Итог

Обе находки r1 закрыты по существу и подтверждены независимо (не со слов
автора): High — реальный, честно описанный CI-прогон на правильном SHA с
зелёным `golden`; Medium — юнит написан по плану ТЗ, мутационно проверен на
способность падать. Новых находок в дельте r1→r2 нет. Продуктовый код не
менялся с r1, весь его разбор наследуется без повторной проверки.

**Вердикт: зелёный.**
