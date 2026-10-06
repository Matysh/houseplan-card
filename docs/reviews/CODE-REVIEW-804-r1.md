# CODE-REVIEW-804-r1

Материал: ветка `issue/804-partition-room-lineage`, SHA `e8e5718ecd7b2f950bb65309a473ad8834650a96`
(поверх `de2029b7f`, зелёный SPEC-REVIEW-804-r1). Трек `ask`, заход r1, блокирующих
циклов израсходовано 0/4.

## Скоуп

Два коммита:
- `b3f5aefa` `fix(editor): preserve residual wall identity when creating room` —
  продуктовый фикс, `Issue: #804`, `User-Visible: yes`, оба changelog в этом же
  коммите.
- `e8e5718e` `test(editor): verify room undo and canonical opening metadata` —
  доработка одного browser-смока (реальные кнопки Undo/Redo вместо хоткеев,
  `isDeepStrictEqual` вместо `JSON.stringify`, исправлен `angle` фикстуры
  проёма), `Issue: #804`, `User-Visible: no`.

Правка устраняет конфликт `duplicate-id` при создании комнаты на части более
длинной независимой стены (#801 → #804): после `reconcileCoincidentPartitions`
новый helper `settleWallFaceLineage` сбрасывает lineage-подсказку новой стены
комнаты ровно для тех рёбер, чей исходный partition ID всё ещё занят
выжившим остатком; остальные подсказки (полное поглощение) не трогает.
Выбор кандидата (`selectWallFaceLineage`) — чистый перенос прежнего инлайн-кода
в `src/wall-face-lineage.ts` без изменения логики сортировки/приоритета.

## Как проверялось

Дешёвые гейты подтверждены Validate на этом точном SHA (success,
run 37446711085 — typecheck, `npm test`, `npm run build`+bundle policy,
полный backend с HA harness, preflight/provenance/process), повторно не
гонялись.

По риску (геометрия, #707) и AC с защитным контрактом прогнано лично, в этой
сессии, поверх чистого `git status` (следы билда удалены `git checkout --
dist && git clean -fd dist demo/srv/assets test-build`, рабочая копия вернулась
к `nothing to commit, working tree clean` на том же SHA):

| Гейт | Команда | Результат |
|---|---|---|
| Unit AC2/AC4 (новый модуль) | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/wall-face-lineage.test.mjs` | 28/28 pass |
| Мутант на самом фиксе | вручную заменил тело `settleWallFaceLineage` на `lineage.slice()` в `test-build/`, перезапустил тот же файл | 22/28 упало (`not ok` по всем AC2/AC4/backend-fixture кейсам) — тест действительно красит отсутствие сеттлинга; откатил правку, вернул 28/28 |
| Mutation-gate якорь | `node scripts/mutation-gate.mjs --check --id=wall-face-lineage-skips-post-reconcile-settlement` | ok, `find` встречается ровно один раз в `src/houseplan-editor-runtime.ts:6729` |
| Production smoke (AC1/AC3/AC4/AC5) | `npx rollup -c && node scripts/bundle-sync.mjs && node demo/smoke_wall_face_lineage.mjs` на свежепересобранном бандле | 9 сценариев / 42 проверки, все `true`, `OK` |
| Красный свидетель AC1 на базовом коде | временно убрал вызов `settleWallFaceLineage(...)` в `src/houseplan-editor-runtime.ts`, пересобрал бандл, `HP_LINEAGE_SCENARIO="Garderoba without workaround" node demo/smoke_wall_face_lineage.mjs` | 6 из 8 проверок красные (`roomCreated`, `actualConfigSaved`, `twoOriginalContinuations`, `roomThicknessPreserved`, `oneHistoryCommand`, `noMigrationError`) — совпадает с заявленным `RED6`; откатил правку |
| Model-invariants на всех 11 shared-кандидатах | `node scripts/model-invariants.mjs --config <after-конфиг i> --json` для каждого элемента `test/fixtures/804-wall-face-lineage-backend.json` | `{"violations": [], "notes": []}` на всех 11 |
| Backend-контракт (чтением) | `grep` по `custom_components/houseplan/websocket_api.py` | обычный `config/set` (строка 1716) вызывает `validate_partition_opening_hosts` без `allow_optimize_rehost`; флаг `True` стоит только в ветке Optimize (строка 2119) — п.4 ТЗ не нарушен, фикс эту границу не трогает |
| Трейлеры и changelog | `git log`, `git show --stat` на обоих коммитах | `Issue:`/`User-Visible` на каждом; `yes` на фикс-коммите — оба `docs/CHANGELOG*.md` в нём же; `no` на тестовом — без changelog, корректно |

## Не проверялось (и почему)

- Полный `npx tsc --noEmit` продукта, полный `npm test`, `npm run build` со
  сверкой трёх копий бандла и bundle-budget — уже зелёные в Validate на этом
  SHA (#343), повторный прогон не требуется.
- `pytest tests_backend/test_wall_face_lineage.py` и общий backend-harness —
  в этом окружении нет импортируемого `homeassistant` (чистый `python3`, без
  `.venv-backend`), прогнать не могу; полагаюсь на зелёный Validate
  (`40 passed` заявлено автором, backend-ветка CI включает harness).
  Сам фикстурный JSON и Python-тест прочитан построчно: он валидирует
  `CONFIG_SCHEMA`, `commit_wall_segment_model` (идемпотентность),
  `validate_wall_model_transition`, `validate_junction_limits` и
  `validate_partition_opening_hosts` с ожидаемым `ok`/`reject` по каждому из
  11 кандидатов плюс отдельный тест на настоящий дубль ID — структура
  соответствует AC4/AC6.
- `golden:verify` — рендер не менялся (чистая identity-логика, без нового
  визуального пути), в ТЗ зафиксирован как «golden специально не меняется»;
  метки `ci:golden` на ветке нет.
- Полный `node scripts/process-gate.mjs --issues` и `gate:small` целиком — уже
  заявлены автором с конкретным результатом (pass, 0 warnings / PASS 111s) и
  покрыты тем же зелёным Validate.
- Мутант `wall-face-lineage-skips-post-reconcile-settlement` штатным
  `scripts/mutation-gate.mjs` на реестре не исполнял (сам мутант — удел ночи,
  #709); проверил только, что заявленный `find`-якорь существует ровно один
  раз и `--check` проходит.

## Находки

Нет. High: 0, Medium: 0.

## Проверено и корректно

- Причинная цепочка дефекта и исправление совпадают с ТЗ дословно: `roomLineage`
  строится до reconciliation (`selectWallFaceLineage`, чистый перенос
  исходного кода без изменения правил выбора), `reconcileCoincidentPartitions`
  возвращает фактический список выживших независимых стен/остатков
  (`reconciled.partitions`), и только после этого `settleWallFaceLineage`
  вычищает только те подсказки новых комнат, чей исходный ID ещё занят —
  ровно контракт п.1 ТЗ.
- Полное поглощение (контракт п.2): ID остаётся в подсказке и наследуется
  через существующую ветку `assignLineage`/`preferredCarriers`
  (`src/wall-segment-model.ts:517-526`), что подтверждено сценарием «fully
  consumed carrier» (residuals: 0, `leftId === sourceId`) и backend-фикстурой
  того же имени.
- Общий барьер уникальности не ослаблен: негативный тест
  («the original unsatisfied hints still fail the unchanged duplicate-ID
  barrier») и backend-тест настоящего дубля каталожного ID по-прежнему падают
  с `duplicate-id`, оба без мутации входа.
- Проёмы (контракт п.4): `same-id-residual-host` принимается обычным
  `config/set`-эквивалентом (frontend+backend), `other-residual-host` и
  `consumed-partition-host` отклоняются `PartitionOpeningHostError` с
  сохранением исходной абсолютной геометрии/метаданных и откатом
  optimistic-состояния (браузерный смок `opening absorbed` / `opening
  new-residual`); `allow_optimize_rehost` не используется ни в одном из
  участвующих путей.
- Одна транзакция/один шаг истории (контракт п.5): batch-сценарии `save` /
  `keep` / `cancel` / `escape` показывают ровно один `history`/`config/set`
  на подтверждённый набор комнат и ноль частичных записей при отмене; Undo
  восстанавливает геометрию исходника побайтово (`geometry()`-сравнение),
  Redo и независимая перезагрузка карточки (`config/get`) воспроизводят те же
  ID.
- Соседние комнаты/пространства/маркеры не затронуты
  (`neighboursAndOtherFloorUnchanged`, `after.spaces[1] === before.spaces[1]`,
  `markers` без изменений) — контракт п.3 и п.6 ТЗ.
- Трейлеры, changelog (RU+EN в одном коммите с `User-Visible: yes`),
  документация (`ARCHITECTURE.md`, `WALL-THICKNESS.md`, `STATUS.md`,
  `DEVELOPMENT.md`) и реестр мутантов/smoke-links согласованы и
  непротиворечивы; второй коммит — чисто тестовый, `User-Visible: no`
  корректен (changelog не требуется).
- Единственное число, видимое пользователю в этом диффе, — запись changelog
  («без обводки/без Optimize»), она не дублирует никакое другое число и не
  вычисляется из нескольких источников.

## Риск по изменённым участкам (#707)

Класс geometry (`wall-face-lineage.ts` целиком + точка вызова в
`houseplan-editor-runtime.ts`) покрыт ТЗ построчно: AC1 (production-путь),
AC2 (таблица остатков/поглощения/реверса/толщин с инвариантами), AC4
(host-переходы проёмов), AC6 (общие frontend/backend кандидаты +
model-invariants). Все четыре перепроверены лично в этой сессии (см. таблицу
гейтов выше), включая подтверждённый красный свидетель на откате фикса —
класс не остаётся без привязки к AC ни по одной из 31+ перечисленных строк.

## Чего не хватает для возврата

Ничего — AC1–AC6 доказаны исполнением (не только чтением), защитные AC имеют
непустой столбец «чем краснеет» с заявленным и лично подтверждённым
мутантом/негативной веткой, трейлеры и changelog на месте, риск по участкам
закрыт ТЗ и перепроверен.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/804-partition-room-lineage`, коммит `e8e5718ecd7b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `f9c416a41954a8c83f06c00e60a1f24bd06b0157`
  ```
  git log --all --format='%H %T' | grep f9c416a41954
  ```
- Тело issue: `1e789aa35c51cc19d85713d3d60ac7dcb3654b3c0ec2bc66e2283874322bf6dc`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4275 output_tokens=25970 cache_creation_input_tokens=125067 cache_read_input_tokens=6474860 num_turns=71 -->
