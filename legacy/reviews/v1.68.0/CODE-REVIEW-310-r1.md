# CODE-REVIEW-310-r1

Issue: https://github.com/Matysh/houseplan-card/issues/310
Ветка: `issue/310-pair-apex` @ `0e6fbfb00b81166bf3d9323fd21dfb86524cd3ed`
ТЗ: `docs/specs/310-pair-apex.md` (ревизия 2, SPEC-REVIEW-310-r2 — зелёный)
Заход: r1 (первый код-ревью, документов CODE-REVIEW-310-* ранее не существовало)

## 1. Скоуп диффа

`git diff origin/dev...HEAD`:

- `src/wall-thickness.ts` — новая `pairButtEndTrimWedges`, парная ветка `linearWallJoinPatches` без визуального лимита/фаски, `drawWallPreviewD` вычитает клин из тел сегментов перед юнионом.
- `src/physical-geometry.ts` — `physicalBodyParts` вычитает клинья #310 из тел партиций/драфтов до `cutPartitionBody` (до разрезов проёмов).
- `scripts/mutation-gate.mjs` — 3 новых мутанта (`pair-chamfer-returns`, `butt-end-trim-disabled`, `butt-end-trim-unbounded`).
- `test/wall-thickness.test.mjs` — 5 новых `issue 310`-тестов + 2 переписанных `issue 309`-теста.
- `docs/WALL-THICKNESS.md`, оба `CHANGELOG*`, `docs/images/screenshots.json` — документация/трейлеры.
- `demo/golden/baselines/{baselines-index.json,junction-309-spike-dark.png}` (отдельный коммит `0e6fbfb0`) — принятие единственной изменившейся сцены.

Соответствует заявленному скоупу ТЗ §3 (`linearWallJoinPatches`, новый торцевой трим и его прокладка в `physicalBodyParts`/превью/карте, golden `junction-309-spike-dark`, юниты/мутанты, docs). Продуктовый код не менялся сверх этого; данных/i18n/UX-контролов действительно не задето.

## 2. Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | чисто (пусто) |
| Unit | `npm test` | 1313 pass / 0 fail / 1 skip (1314 объявлено) — совпадает с хендоффом |
| Build + бандлы | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | собрано; `cmp` — совпадение байт в байт; `git status` после билда чист (закоммиченные копии актуальны) |
| Docs fingerprint | `node scripts/check-docs.mjs` (обязателен — диф трогает `src/**`) | `Documentation checks passed (7 files, 10 external links)` |
| Мутанты #310 | `node scripts/mutation-gate.mjs --id=pair-chamfer-returns` <br> `--id=butt-end-trim-disabled` <br> `--id=butt-end-trim-unbounded` | все три: «тест покраснел, как обязан» — **самостоятельно перепроверено**, не со слов автора |
| Смок-выборка | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 190 смоков в матрице; вывод — 3 «зарегистрированные связи» (см. §5) |
| Прогнанные смоки | `node demo/smoke_{junction_holes,real_plan_masonry,multiwall_junction,wall_junctions,free_walls,wall_thickness}.mjs` (после `npm run bundle:sync`) | все `OK` — самостоятельно перепроверено |
| Golden | `npm run golden:verify` (диф меняет геометрию рендера, п.8 требует) | 129/129 `passed`, включая обновлённую `junction-309-spike-dark-dark` и байтово прежние `junction-309-step-dark`/`junction-309-hump-dark` |
| Backend | — | не запускался: `custom_components/**/*.py` не тронут диффом |
| Model invariants | — | не запускался: диф не трогает модель/конфиг (рёбра комнат, `walls`, `layout`, `marker.space`, `open_spans`) — только вычисляемая геометрия рендера кладки, что явно оговорено в ТЗ §4 |
| «Одно число — один источник» | — | неприменимо: диф не добавляет и не меняет ни одной пользовательски видимой величины (только форма кладки) |

### Не прогонялось и почему

- `demo/smoke_resize_pointer_real_plan.mjs`, `demo/smoke_resize_wall_thickness.mjs` — `smoke-select` дал по ним «зарегистрированную связь» через `closePoint`, но это общий геометрический хелпер, используемый по всему `wall-thickness.ts`/resize-коду; диф не меняет его поведение и не трогает Resize-путь вовсе (только `linearWallJoinPatches`/`pairButtEndTrimWedges`/`drawWallPreviewD`). Решение — не гонять: связь по одному распространённому имени, тема смоков (Resize-указатель) не пересекается с изменением.
- `python -m pytest tests_backend -q` — диф не трогает Python.
- Полная матрица `demo/smoke_*.mjs` (190 файлов) и `performance_smoke` — не требуется по объёму задачи (§8 PROCESS.md: полные наборы — предрелизный гейт).

## 3. AC — доказательства

1. **Остриё (AC1).** Код: `linearWallJoinPatches` (src/wall-thickness.ts:1310-1316) теперь строит `[node,pA,hit,pB]` без проверки `VISUAL_MITRE_LIMIT`/`chamferApex`. Тест `linear wall joins bevel an excessive mitre...` (test/wall-thickness.test.mjs:2755) обновлён на `acute[0].length === 4`; тест `issue 310 the acute 10/20 pair keeps its full apex...` проверяет апекс дальше `1.5·hMax`. Мутант `pair-chamfer-returns` красит именно эту ветку — перепроверено исполнением. **Доказано автотестом, умеющим падать.**
2. **Зубец срезан (AC2).** `pairButtEndTrimWedges` (src/wall-thickness.ts:1151) строит клин полуплоскостью грани партнёра; `physicalBodyParts` вычитает его до разрезов проёмов. Юнит `issue 310 the butt-end trim is addressed...` пробует точку в старой зоне зубца через `physicalBodySet(...).geometry` — она пуста. Мутант `butt-end-trim-disabled` красный — перепроверено. Golden `junction-309-spike-dark` пересчитан и проходит `golden:verify`. **Доказано.**
3. **Адресность (AC3).** `reach = Math.min(2 * self.halfDepth, self.length)` (src/wall-thickness.ts). Тест `issue 310 the butt-end trim reach is bounded...` проверяет, что все вершины клина не дальше `2·halfDepth` вдоль оси на почти-параллельной паре; тест «issue 310 the butt-end trim is addressed...» отдельно пробует точку в 200 units от узла — тело стены там цело. Мутант `butt-end-trim-unbounded` красный — перепроверено. **Доказано.**
4. **Узлы ≥3 не тронуты (AC4).** `golden:verify` — 129/129, включая `junction-309-step-dark`/`junction-309-hump-dark` и 16 старых `junction-*`-сцен + owner-repro байтово прежние (сам `run.mjs` сравнивает хэши; расхождение = fail). **Доказано golden-гейтом.**
5. **Без дыр (AC5).** Для узлов ≥3 — прежний `junctionContractHoles`, не тронут (не в диффе). Для пар — новый тест `issue 310 pair grid contract: masonry equals strips plus patch minus wedges` (test/wall-thickness.test.mjs:3274), плотная сетка `3·h` с шагом `h/4` на трёх конфигурациях (owner spike, square-90, near-parallel), сверка с фактическим выходом `linearWallBody`/`linearWallJoinPatches`/`pairButtEndTrimWedges`, near-edge зона пропускается корректно (нестабильный оракул на общей границе). Прогнан лично — `ok`. **Доказано.**
6. **90° равных толщин (AC6).** `issue 309 a square corner of equal depths keeps its byte-identical mitre` (не менялся, зелёный) + новый `issue 310 a square pair of equal depths has no butt-end wedge` — `pairButtEndTrimWedges` возвращает `[]` для равных перпендикулярных стен. **Доказано.**
7. **Мутанты (AC7).** Все три (`pair-chamfer-returns`, `butt-end-trim-disabled`, `butt-end-trim-unbounded`) перепроверены лично — каждый красит целевой тест, гварды не тавтологичны. **Доказано.**

Раздел «§8 план тестов» ТЗ обещал дополнительно юнит «пара с коротким толстым саппортом (#271+#310)» под риском №3 — см. находку Medium ниже, этот юнит не найден в диффе.

## 4. Находки

### High — недостоверный `Baseline-Reviewed` в коммите `0e6fbfb0`

Коммит `test: accept the #310 pair-apex baseline` несёт трейлер
`Baseline-Reviewed: https://github.com/Matysh/houseplan-card/actions/runs/32886626656`,
но этот прогон физически не может быть источником эталона #310:

- `gh run view 32886626656` → `head_branch: issue/309-junction-visual-limit`,
  `head_sha: 6c1534f170e501806ff38b73ebfd4f82c87ab730`, заголовок «test: pin the
  golden matrix guard to version 46 (#309)» — это чужая ветка и коммит, который
  на графе истории **предшествует самому первому коммиту #310** (`c8d56b6c`):
  `git log --oneline 6c1534f1..HEAD` показывает все шесть коммитов #310 как
  потомков этого SHA, то есть в дереве этого прогона кода `pairButtEndTrimWedges`
  и безлимитного mitre для пар физически не существовало.
- У этого прогона в принципе нет артефакта `golden-images`: `gh run view`
  показывает единственный артефакт `performance-smoke`. По `.github/workflows/validate.yml:411-416`
  шаг `Upload golden candidates/diffs` грузит `golden-images` только
  `if: failure() || has_baselines == 'false'` — то есть только когда `golden`
  упал (новые пиксели не совпали со старым эталоном) либо когда эталонов не
  было вовсе. Job `golden` в прогоне `32886626656` завершился `✓` (успех) —
  артефакт для ревью просто не создавался.
- Прогон на самой ветке `issue/310-pair-apex`, где эталон реально мог не
  совпасть (SHA `de0867b0`, коммит с кодом трима, до принятия эталона), **не
  существует**: `gh api "repos/Matysh/houseplan-card/actions/runs?branch=issue/310-pair-apex"`
  возвращает ровно три прогона (`c8d56b6c`, `8d41651b`, `0e6fbfb0`) — коммит
  `de0867b0` был запушен в одном пуше вместе с уже принятым `0e6fbfb0`, поэтому
  единственный Validate-прогон на этой ветке стартовал сразу с уже обновлённым
  эталоном и `golden` в нём тоже прошёл зелёным без артефакта.

Итог: ни разу не существовало прогона Linux CI, который произвёл бы кандидатные
изображения #310 для ревью — то есть эталон `junction-309-spike-dark.png` был
принят не через артефакт CI, как того требует `demo/golden/README.md`
(«Future updates must still use the golden-images artifact produced by the
Linux CI job as the review set») и `PROCESS.md` §8/§12/§13
(«эталоны golden принимаются только через `npm run golden:accept --
--reviewed` на полном артефакте Linux CI»), а вставленная ссылка на чужой
прогон — это ровно то, что `AGENTS.md` §«Commits» запрещает явно: «Never
invent a review link». Хук `commit-msg`/`validate-commit-provenance.mjs`
здесь бессилен: `validateCommitMessage` (scripts/validate-commit-provenance.mjs:53-62)
проверяет только, что трейлер `Baseline-Reviewed` **не пуст**, содержимое
ссылки не проверяется вообще — обойти это механически легко, что и произошло.

Замечу отдельно: сам PNG, судя по всему, визуально корректен — я independently
прогнал `npm run golden:verify` на Linux (текущее окружение) и получил
129/129 `passed`, то есть текущий закоммиченный эталон согласован с кодом на
пиксельном уровне в среде с тем же пиннингом Chromium, что и у CI. Находка не
о качестве изображения, а о недостоверности записи о том, как оно было
принято — а это именно тот механизм (различие рендеринга шрифтов/окружений
между локальной машиной и CI), ради которого правило существует.

**Требуется:** новым коммитом (не переписывая `de0867b0`/`0e6fbfb0` — история
опубликованной ветки не перезаписывается) либо (а) добыть настоящий прогон CI
с реальным артефактом `golden-images` для кода #310 (можно — второй пуш только
кода без принятого эталона, дать `golden` упасть, скачать артефакт, принять
`--from=...`, скорректировать трейлер), либо (б) если это институционально
не нужно повторно — как минимум исправить трейлер на честную запись
происхождения с указанием, что канонический прогон отсутствовал, и это
решение отдельно согласовать с владельцем, поскольку прямо противоречит
зафиксированному в `demo/golden/README.md` контракту.

### Medium (в скоупе) — обещанный тест на пересечение #271+#310 отсутствует

ТЗ (ревизия 2, зелёное ревью r2) риск №3: «Двойной трим (#271 + #310) в одном
узле — интерференция; покрыть юнитом на коротком толстом саппорте пары», и
§8 плана тестов повторяет: «пара с коротким толстым саппортом (#271+#310)».
В `test/wall-thickness.test.mjs` пять тестов `issue 310` (строки 3104, 3208,
3243, 3251, 3274) покрывают AC1-AC6, но ни один не соответствует этому
описанию; единственный тест с «short thick support» в файле — `issue 302 a
mitre past the short thick support degrades to a bevel` (test/wall-thickness.test.mjs:2976),
он про ≥3-лучевой узел (#302/#271) и не про пару.

Структурно риск может быть неопасен: `pairButtEndTrimWedges` работает только
над `[...draftSegments, ...partitionSegments]` в `physicalBodyParts`
(src/physical-geometry.ts:267-268), то есть только над независимыми
партициями/драфтами, а `buildMultiWallNodeMap`/`bevelMultiWallBody` (#271) —
над структурной картой узлов, которая считает лучи иначе и per WALL-THICKNESS.md
относится к узлам ≥3 канонических лучей. Формально это разные тела и разные
проходы, так что дословная «интерференция» в одном узле может быть
невозможна. Но ТЗ прошло зелёное ревью именно с этим риском и этим пунктом
плана, и раз обещанный тест не написан, отсутствие интерференции не
**доказано**, а предположено — то самое расхождение, которое код-ревью обязано
поймать. Фикс — либо написать юнит по описанию плана (партиция с коротким
плечом у узла, где тело идёт в #271-путь и одновременно участвует в паре),
либо явно снять пункт из риска/плана тестов с обоснованием несовместимости
путей, задокументированным в ТЗ или в WALL-THICKNESS.md.

## 5. Что проверено и корректно

- Полный mitre для пар — без визуального лимита, скол убран из этой ветки,
  фаска `#309` осталась только в узлах ≥3 лучей (`VISUAL_MITRE_LIMIT`
  используется в диффе только там, где раньше — код проверен построчно).
- `pairButtEndTrimWedges`: фильтрация вырожденных сегментов, T-узлы
  (`pointOnSegmentInterior`) корректно исключаются из парной ветки (иначе
  трёхлучевой узел получил бы парную трактовку), клин строится
  Сазерленд-Ходжменом по полуплоскости грани партнёра — реализация читаема и
  соответствует контракту §2.2 ТЗ.
- Порядок операций в `physicalBodyParts`: трим применяется **до**
  `cutPartitionBody` (до вырезания проёмов), как и требует ТЗ.
- `drawWallPreviewD` индексно совместим с `segments` — тримит тела **до**
  фильтрации `null` (комментарий в диффе объясняет почему), не путает индексы.
- Не в скоупе (по ТЗ) — снап-оверлей `_drawPreviewJoinPatchD` (src/houseplan-card.ts:19944)
  делит `linearWallJoinPatches`, но не применяет `pairButtEndTrimWedges` к
  ранее сохранённым телам; ТЗ §3 явно относит «снап»/превью-слушатели к
  не-скоупу («форма кладки, слушателей нет»), так что это не находка.
- Трейлеры `de0867b0`: `Issue: #310`, `User-Visible: yes`, оба CHANGELOG
  правятся в этом же коммите — соответствует правилу.
- Трейлеры `0e6fbfb0`: `Issue: #310`, `User-Visible: no`, `Release:
  v1.68.0-beta.1` — формально на месте (кроме содержания `Baseline-Reviewed`,
  см. High).
- Дублирование `subtractWedgeFromBody` (physical-geometry.ts) и
  `clipBodyByWedge` (wall-thickness.ts) — почти одинаковая функция
  «разность многоугольников, взять кольцо большей площади» в двух файлах.
  Не блокирует (Low, простительно: разные модули/типы входа), но стоило бы
  вынести в общий хелпер при следующей правке этой области — не поднимаю до
  Medium, оставляю на суждение автора.

## 6. Чего не проверял

- Полную браузерную смок-матрицу (190 файлов) и `performance_smoke` —
  избыточно для объёма задачи, это предрелизный гейт.
- `python -m pytest tests_backend` — диф не трогает Python.
- `scripts/model-invariants.mjs` — диф не меняет модель/конфиг (только
  вычисляемую геометрию рендера), инварианты неприменимы.
- Скриншоты документации визуально (глазами) — `check-docs.mjs` подтвердил
  отпечаток, содержательного изменения скриншотов, требующего пересъёмки
  `Docs screenshots`, диф не подразумевает (не трогает публичные экраны/тексты
  документации).
- Точный побайтовый прогон `golden:accept` заново (не переигрывал принятие
  эталона — это разрушило бы уже принятое состояние; сверял только текущий
  результат `golden:verify`).
