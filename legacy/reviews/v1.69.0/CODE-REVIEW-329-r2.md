# CODE-REVIEW-329-r2

Issue: #329 — экстремально острая вершина комнаты рендерится «трезубцем»; ограничения на стыки стен.
Заход: r2. Предыдущий цикл (r1) — вердикт **красный**, `High: 1, Medium: 4`, документ
`docs/reviews/CODE-REVIEW-329-r1.md`, получен на SHA `e1df015d` (коммит «docs: review document for #329»,
после которого автор добавил четыре коммита закрытия находок).

## Скоуп разбора (§2.9)

Дельта r1→r2 — 4 коммита, 12 файлов, +301/-191:

```
0824e510 test: prove AC10 — Optimize adds no junction violation (#329 M4)
574fea98 docs: one limits section, and Resize does raise a toast (#329 M2, M3)
8f0b6b97 refactor: drop the chamfer helpers the honest apex made dead (#329 M1)
0bb42cae fix: the backend judges both sides after the same migration (#329 H1)
```

Файлы: `custom_components/houseplan/junction_limits.py`, `src/wall-thickness.ts`,
`test/junction-limits.test.mjs`, `tests_backend/test_junction_limits.py`,
`scripts/mutation-gate.mjs`, `docs/CONFIG-COMPATIBILITY.md`, `docs/USER-GUIDE.md`,
`docs/USER-GUIDE.ru.md`, `docs/specs/329-junction-limits.md`,
`docs/images/screenshots.json`, `dist/houseplan-card.js`,
`custom_components/houseplan/frontend/houseplan-card.js`.

Каждый коммит — прямое закрытие одной находки r1 (H1, M1, M2+M3, M4), rebase на
ушедший вперёд `dev` не производился (дельта считается от r1-документа, ветка не
двигалась), новая подсистема не задета, поведенческий контракт не меняется — он
чинится до заявленного. Разбор ограничен дельтой плюс всем, до чего она
дотягивается (backend-паритет AC9, AC10, §4/AC6 честная вершина — см. ниже).
П1–П5 как таковые (AC1–AC5), AC7a/AC7b, AC8 дельтой не задеты — унаследованы.

## Как проверялось

Прогнано (SHA `0824e510`):

- `npx tsc --noEmit` — чисто.
- `npm test` — **1389 passed, 1 failed, 1 skipped** (см. находку r2-H1 ниже).
  Функциональные тесты этой дельты, включая новые AC10-юниты (`ok 493`, `ok 494`)
  и переписанные бэкенд-паритетные фикстуры, — все зелёные; падает отдельный
  метатест реестра мутантов.
- `npm run build` + сверка бандлов: `dist/houseplan-card.js` ==
  `custom_components/houseplan/frontend/houseplan-card.js` (байт-в-байт), пересборка
  с нуля идентична закоммиченному `dist` (diff пуст).
- `node scripts/check-docs.mjs` — «Documentation checks passed (7 files, 10
  external links)» — отпечаток `docs/images/screenshots.json` (единственный файл
  дельты в `docs/`, пересчитанный после правки `src/wall-thickness.ts`) валиден.
- `python3 -m pytest tests_backend/test_junction_limits.py -q` — **8 passed**
  (окружение не несло `pytest` изначально; установлен локально `pip3 install
  pytest pytest-asyncio`, что и позволило прогнать гейт, а не просто прочитать код).
  Дисциплина «тест умеет падать»: вручную откатил патч мутанта
  `junction-limit-backend-raw-baseline` (`migrated, _ = commit_wall_segment_model(config)`
  → `migrated = config`) — **2 из 8 тестов падают**
  (`test_legacy_baseline_is_judged_after_the_same_migration`,
  `test_a_write_that_adds_a_violation_is_refused_with_a_stable_code`), затем
  восстановил файл — тест 8/8 подтверждён на исходном коде.
- `npm run bundle:sync && npm run golden:verify` — вся матрица (~80 сцен, включая
  `sharp-apex-legacy-dark` и `junction-owner-repro-dark`) — **зелёная**, 0 отказов.
  Нужен был, поскольку M1 правит геометрический файл `wall-thickness.ts`; удаление
  мёртвого кода подтверждено эмпирически — ни один кадр не сдвинулся.
- `node scripts/mutation-gate.mjs --check` — реестр анкеров цел (совпадает с
  прошедшим юнитом «every mutant patch anchors exactly once», `ok 688`).
- `node scripts/smoke-select.mjs --base e1df015d --head HEAD` — «дифф исполняемый,
  но ни один смок не связан доказуемо»; единственный символ дельты в `src/**`,
  которого нет в смоках, — `DEGENERATE_APEX_MAX_DEGREES`, но дельта его не меняет
  (значение и семантика те же, переставлен только JSDoc-комментарий при удалении
  соседних мёртвых функций). Решение: смоки не гоняю — это чистое перемещение
  комментария, а не новый контракт; поведенческую часть уже покрывает
  `golden:verify` (зелёный целиком).

Не прогонялось: полный HA-harness (`pytest tests_backend` целиком падает при
сборе — `ModuleNotFoundError: homeassistant`, `voluptuous`; тот же пробел был и в
r1, дельта его не устраняет и не обязана). Полная матрица браузерных смоков и
мутантов — дельта не даёт для этого повода (см. вывод `smoke-select.mjs` выше);
она предрелизный гейт, не гейт ревью.

## Находка r2 (High, в скоупе — блокирует)

### r2-H1. Новый мутант ломает `npm test`, то есть красный CI-гейт `validate.yml`

`scripts/mutation-gate.mjs` (коммит `0bb42cae`, закрытие H1) добавляет запись
`junction-limit-backend-raw-baseline` с

```js
guard: 'python3 -m pytest tests_backend/test_junction_limits.py -q',
```

`test/mutation-gate.test.mjs:33` («every guard command points at a file that
exists») требует, чтобы `guard` называл `.mjs`-файл — конвенция, которой следуют
ВСЕ остальные бэкенд-мутанты в этом же реестре (`node
scripts/backend-test-guard.mjs <pattern> [<file>]`, см. строки 1061, 1073, 1099,
1156, 1223, 1541, 1766, 1777, 1788, 1799, 1810, 1856, 3025, 3037, 3049). Новая
запись — сырой `python3 -m pytest ...` без `.mjs`, и `.split(' ').find(part =>
part.endsWith('.mjs'))` возвращает `undefined`.

Воспроизведено исполнением: `npm test` на HEAD (`0824e510`) —
`# fail 1`, тест 689 падает с
`junction-limit-backend-raw-baseline: guard не называет исполняемый файл`.
Проверено дважды (`npm test` целиком и точечно `node --test
test/mutation-gate.test.mjs`) — не флейк. `.github/workflows/validate.yml:282`
гоняет именно `npm test`, значит CI на этой ветке красный по этой же причине.

Функционально мутант работает и семантически осмыслен (я вручную применил его
патч и подтвердил, что он ловит регресс H1 — 2/8 тестов падают, откат правки
восстанавливает 8/8); дефект чисто в форме `guard`, не в сути защиты. Это не
довод в пользу «оставить как есть»: `npm test` — обязательный дешёвый гейт этого
самого ревью, и он красный на проверяемом SHA.

**Нужно:** привести `guard` к конвенции реестра, например
`node scripts/backend-test-guard.mjs test_legacy_baseline_is_judged_after_the_same_migration tests_backend/test_junction_limits.py`
(или обеими новыми тестами через `-k "test_legacy_baseline_is_judged_after_the_same_migration or test_a_write_that_adds_a_violation_is_refused_with_a_stable_code"`,
если нужно ловить оба). Однострочная правка, но `npm test` должен быть зелёным на
SHA, уходящем в `dev`.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где видно |
|---|---|---|
| **H1** (High) — бэкенд судит легаси-базу сырой, отклоняет несвязанную правку | `0bb42cae`: `validate_junction_limits` гоняет и `previous`, и `candidate` через новую `_migrated_spaces()` → `commit_wall_segment_model` до подсчёта | `junction_limits.py` (диф выше); тест `test_legacy_baseline_is_judged_after_the_same_migration` — 8/8 pytest; мутант `junction-limit-backend-raw-baseline` вручную подтверждён (2/8 падают без фикса) |
| **M1** — мёртвый код `apexCaps`/`clipPolygonOutsideCap`/`degenerateApexCaps` | `8f0b6b97`: поле интерфейса и обе функции удалены целиком, JSDoc над `wallBodiesGeometry` возвращён на место | `grep -rn` по всему репо (кроме текста самого r1-документа) — не находит; `golden:verify` вся матрица зелёная — поведение не изменилось |
| **M2** — раздел «Ограничения стыков стен» задвоен в RU-гайде | `574fea98` | `docs/USER-GUIDE.ru.md` — ровно один заголовок `### Ограничения стыков стен` (строка 420) |
| **M3** — гайд (RU+EN) описывает Resize как «просто останавливается», хотя тост есть | `574fea98`: текст переписан — «…и один раз за жест поясняет тостом, какое правило дальше нарушится» | `docs/USER-GUIDE.md`/`.ru.md` (диф выше); код `_rszMove` (`src/houseplan-card.ts:9183-9191`, `resize.limit_stopped` + `_junctionLimitLabel`) не менялся — он и раньше показывал тост, теперь описан верно |
| **M4** — AC10 (Optimize не добавляет нарушений) не доказан | `0824e510`: два юнит-теста в `test/junction-limits.test.mjs`, считающие нарушения тем же способом, что барьер записи (обе стороны через `commitWallSegmentModel`/`commit_wall_segment_model`) | `npm test` — `ok 493`, `ok 494`; первый тест на фикстуре владельца, второй — граничный случай П4 (узлы ровно в 5 см), явно проверяет, что база несёт нарушение (не доказывает пустоту) |

Все пять находок r1 закрыты по существу, с наблюдаемым следом в коде/тестах, а не
только заявлением автора. Ни одна не переоткрыта.

## Унаследовано из r1

Не тронуто дельтой r1→r2, повторно не проверялось — принято по документу
`docs/reviews/CODE-REVIEW-329-r1.md`, SHA `e1df015d`:

- **AC1–AC5** (П1–П5 как юнит-предикаты с границами) — `test/junction-limits.test.mjs`
  до строки 216 дельтой не изменён (только дополнен снизу тестами AC10).
- **§4/AC6** (честная вершина легаси-апекса + golden-сцена `sharp-apex-legacy-dark`) —
  логика самого предиката (`isDegenerateApexCorner`) не менялась, только удалён
  неиспользуемый код вокруг неё; повторно подтверждено попутно этим раундом через
  `golden:verify` (зелёный), но отдельного разбора алгоритма не требовалось.
- **AC7a/AC7b** (Resize/«Толщина»: смок через настоящий pointer-жест, байт-
  неизменность плана, текст объяснения/тоста) — код и смоки не в дельте; M3 правил
  только прозу гайда, не контракт и не тест.
- **AC8** (скоуп применения — какие поверхности проверяются) — не в дельте.
- Риски, откат, release-артефакты, паритет чисел П1–П4 (кроме самого способа
  получения базовой линии, который и есть H1) — не в дельте.

## Что проверено и корректно (сверх таблицы выше)

- `docs/CONFIG-COMPATIBILITY.md` — новый абзац про обязательность миграции базовой
  линии и явное указание обеих реализаций (`commitWallSegmentModel` /
  `commit_wall_segment_model`) фактически точны: обе функции существуют и вызываются
  ровно там, где написано.
- `docs/specs/329-junction-limits.md` — ревизия 7 честно фиксирует все пять
  закрытий и не вводит новых продуктовых решений задним числом.
- Обработка `except Exception` в `_migrated_spaces()` (бэкенд): падение миграции не
  становится вердиктом этого валидатора — по коду до этой точки уже должен был
  отработать барьер модели стен, так что это защитный, а не рабочий путь; не
  создаёт регресса H1, так как обе стороны получают одинаковую (либо мигрированную,
  либо сырую при одинаковом сбое) трактовку независимо друг от друга только в
  теории — на практике оба документа уже прошли барьер записи раньше в конвейере.
- Трейлеры всех 4 коммитов — `Issue: #329`, `User-Visible: no`; корректно: правки
  чинят баг ещё не выпущенной (Unreleased) фичи этого же issue — запись в
  `docs/CHANGELOG.md`/`.ru.md` уже существует с `f514fb27` и описывает финальное,
  уже исправленное поведение, отдельной строки для самого фикса не требуется.
- «Одно число — один источник»: дельта не вводит и не меняет ни одной новой
  пользователем видимой величины (правки бэкенда, тестов и прозы документации).

## Чего не проверял и почему

- Полный `pytest tests_backend` (не только `test_junction_limits.py`) — падает уже
  на сборе (`ModuleNotFoundError: homeassistant`, `voluptuous`), эти пакеты в
  окружении не установлены; тот же пробел был в r1, дельта его не касается и не
  обязана устранять.
- Полная матрица `demo/smoke_*.mjs` и полный прогон реестра мутантов — не
  запускал: `smoke-select.mjs` не нашёл ни одной связи для этой дельты (единственный
  изменённый символ в `src/**` — переставленный комментарий), а полный прогон
  реестра — предрелизный гейт (PROCESS.md §8), не гейт ревью такого размера.
- `npm run invariants -- --config ...` — дельта не меняет геометрический контракт
  (только удаляет мёртвый код и правит бэкенд/тесты/прозу); поведенческая часть уже
  закрыта зелёным `golden:verify` по всей матрице.

## Вердикт

**Красный.** Единственная находка — High, блокирует. Она не переоткрывает ни одну
из пяти закрытых находок r1 (все пять закрыты корректно и по существу) и
исправляется одной строкой в `scripts/mutation-gate.mjs`, но `npm test` сейчас
красный на SHA, уходящем в `dev`, а это один из обязательных дешёвых гейтов этого
же процесса.
