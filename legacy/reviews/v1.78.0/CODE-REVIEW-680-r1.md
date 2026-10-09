# CODE-REVIEW-680-r1

**Issue:** #680 (подзадача эпика #674, волна 3 — сокращение входа агента)
**Материал:** `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`
**SHA:** `72ce15bfa1cc7aeb7e884f9fd27fa453c05af4ce` (рабочая копия на нём, `git status` чист)
**Заход:** r1 · блокирующих циклов израсходовано 0 из 4
**Вердикт:** зелёный

## Скоуп

Четыре коммита поверх `dev@972ff701`, 33 файла, +1405/−3142:

- `696f5a78` — вход агента и канон: `AGENTS.md` (650 → 187 строк), `PROCESS.md`
  (удалены §13/§14/§7.3, поправлены ссылки «§7.2» → §2.10/§2.7 по контексту),
  `STATUS.md` (113 → 61 строка), `DEVELOPMENT.md` (Release — единственный дом
  релизной механики), `TESTING.md`, `CONTRIBUTING.md`, сообщения
  `scripts/*.mjs`.
- `4bc3e9ba` — `ARCHITECTURE.md` (2330 → 668 строк) и перенос ещё верных фактов
  в канонические документы подсистем (`docs/CANVAS.md`, `CONFIG-COMPATIBILITY.md`,
  `DECOR-EDITOR.md`, `DEVICE-PRESENTATION.md`, `FILTERING.md`, `ISOMETRIC.md`,
  `LIGHT.md`, `PDF-EXPORT.md`, `RADAR.md`, `VACUUM.md`, `WALL-THICKNESS.md`,
  `UX-MODES.md`, `WARM-REMOUNT.md`, `FURNITURE.md`).
- `fdde4654` — мутант `entry-cost-author-route-over-budget` чинится (сам патч
  теперь превышает бюджет).
- `72ce15bf` — таблица владельцев файлов при сборке (HP-1465-01) возвращена из
  `SCOPE.md` (первый файл обоих маршрутов входа) обратно в `ARCHITECTURE.md`.

Продуктовый код (`src/**`, `custom_components/**`) не тронут; правки — только
документация, `scripts/*.mjs` (мутанты/сообщения) и `.github/workflows/_process.yml`
(две строки ссылок на разделы).

Первая строка Core user jobs, которую задача обслуживает: ни одна напрямую — это
инфраструктурная задача конвейера (класс, при котором анализ и спецификация
пропускаются, `PROCESS.md` §1), обслуживающая сам процесс разработки, а не
пользовательский сценарий. Как таковая она законно вне таблицы J1–J7.

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate на этом SHA (run 36345237757, ссылка
из промпта) — `npx tsc --noEmit`, `npm test`, `npm run build` + сверка бандла не
перегонялись повторно.

Прогнано вручную (диф не трогает `src/**`, но эти проверки нацелены на задачу):

| Гейт | Команда | Результат |
|---|---|---|
| Мера входа | `node scripts/entry-cost.mjs` | author 5196/12000, reviewer 4074/9000 — совпадает с числами автора |
| Целевые юниты | `node --test test/review-doc-guard.test.mjs test/process-digests.test.mjs test/release-gate.test.mjs test/testing-doc.test.mjs test/no-new-any.test.mjs test/branch-state.test.mjs` | 103/103 pass |
| any-долг | `node scripts/no-new-any.mjs --total` | «862 вхождения в 52 файл(ах)» — совпадает с текстом `PROCESS.md`/`TESTING.md` |
| Мутант бюджета входа | `node scripts/mutation-gate.mjs --id=entry-cost-author-route-over-budget` | «поймано 1 из 1» — подтверждено самостоятельным прогоном, не только заявлением автора |
| Процесс-гейт диапазона | `node scripts/process-gate.mjs --range origin/dev..HEAD` | «гейт пройден, предупреждений 0» |
| Реестр мутантов | `node scripts/mutation-registry.mjs --check` | exit 0 |
| Документные ссылки | `node scripts/check-docs.mjs --screenshots=warn` | «Documentation checks passed (7 files, 12 external links)», WARN про устаревший отпечаток скриншотов — не связан с этим диффом (`src/**` не тронут) |
| Полный `node --test test/*.test.mjs` | — | НЕ прогонялся из этого дерева: `test-build/` не собран этим агентом (нужен `npm test`, который делает `tsc -p tsconfig.test.json` первым шагом); поскольку `src/**` не менялся и Validate уже зелёный на этом SHA, не перегонял — риск на этой ветке нулевой |
| `pytest tests_backend`, golden, performance, инварианты модели, браузерные смоки | — | не прогонялись: диф не трогает `custom_components/**/*.py`, геометрию, рендер или AC, которые их требуют (задача — документация и служебные скрипты, не продуктовая логика) |

Помимо запуска команд — вычитка диффа и **выборочная сверка перенесённых фактов
с текущим кодом** (не только с текстом до переноса), поскольку именно это
единственный способ поймать «слова просто переехали в другой файл» или
«факт устарел при переносе»:

- `entry-cost.mjs`, `wc -l` — числа маршрутов и итоговые длины файлов (AGENTS.md
  187, STATUS.md 61, ARCHITECTURE.md 668, TESTING.md 747) совпадают с заявленными
  в комментарии «Сделано» день в день.
- `git show fdde4654` — прочитан целиком; мутант меняет патч с 2000 на 12001
  «слово», что действительно превышает бюджет 12000 независимо от длины
  остального маршрута; проверено исполнением (таблица выше).
- Ссылки «§7.2» → §2.10/§2.7: PROCESS.md §2.10 действительно озаглавлен
  «Повторный раунд ревью — объём по дельте» (полный разбор после ребейза), §2.7
  — «Код-ревью» (сверка SHA перед выводом); проверил `grep` по каждому файлу
  из «Сделано» (`_process.yml`, `branch-state.mjs`, `merge-candidate.mjs`,
  `review-doc-guard.mjs`, `pre-push-gate.mjs`, `test/branch-state.test.mjs`) —
  ни одной оставшейся «§7.2» в активном каноне; репозиторный `grep` на «§13»/«§14»/«§7.3»
  находит только внутренние ссылки старых архивных `legacy/docs/**` и
  `docs/specs/**` документов на *их собственные* разделы, не на `PROCESS.md`.
- Символы, названные в перенесённых фактах ARCHITECTURE → подсистемные
  документы, проверены `grep`/чтением исходников как реально существующие и
  соответствующие описанию: `GLOW_SCALE_MAX`/`GLOW_MIN_FRAC`/`GLOW_GAMMA`
  (`src/logic.ts:1707-1709`, формула совпадает), `isoPlaneMatrix()`
  (`src/iso-projection.ts:70`), `ISO_OVERLAY_SAFETY_GAP_CSS_PX = 4`
  (`src/iso-overlays.ts:12`), `effectiveDeviceBaseSize()`
  (`src/device-marker-geometry.ts:10`), `AssetIntegrityVerifier`
  (`custom_components/houseplan/asset_integrity.py:64`), `POWER_ADAPTERS`
  (`src/device-toggle.ts:120`), `device-hit-owner.ts`, `resolveInitialSpace`/
  `resolveFixedFloor` (`src/initial-load.ts:40,70`) — все существуют, ни один
  переименован или удалён.
- Таблица владельцев файлов при сборке (HP-1465-01), перенесённая последним
  коммитом обратно в `ARCHITECTURE.md`: подтвердил, что удалённая из неё фраза
  «`config/set` removes only what its own commit replaced» не потеряна, а
  остаётся рядом в тексте `ARCHITECTURE.md:420-421` — перенос не уронил факт.
- Список всех файлов, названных в перенесённых блоках (`space-card.ts`,
  `space-render.ts`, `devices.ts`, `ha-binding-status.ts`, `wall-thickness.ts`,
  `config-store.ts`, `command-stack.ts`, `sun.ts`, `day-cycle-render.ts`,
  `version-recovery.ts`, `space-editor.ts` и т. д.) — сверен `ls`/`find`,
  все существуют под указанными именами.

## Находки

### Medium — вне скоупа (заведён отдельный issue)

**`docs/UX-MODES.md:181` и `docs/TOUCH-SUPPORT.md:154-155` противоречат коду и
новому `docs/WALL-THICKNESS.md` §11 о том, финиширует ли Esc/Reset открытую
цепочку стен.**

- `UX-MODES.md:181`: «Re-selecting Walls, Reset, pan, pinch and pointer
  cancellation are not finish actions.»
- `TOUCH-SUPPORT.md:154-155`: «Only an explicit tool/editor/floor change
  finishes an open chain as ordinary walls.» — Esc и Reset в перечень не входят.
- `docs/WALL-THICKNESS.md:658` (**добавлено этим самым диффом**, перенос факта
  из ARCHITECTURE): «Changing Plan tool, editor or floor, `Esc`, the tray's
  Reset, route/hash departure and a room-face batch whose every face was
  rejected all finish an open chain through one bounded lossless finalizer
  (`finalizeWallChainSpace`).»

Проверено чтением кода, не исполнением: `src/houseplan-card.ts:2941-2958`
(обработчик `Escape` при активном пути вызывает `this._finishWallChain()`);
`src/houseplan-editor-runtime.ts:4928-4932` (кнопка трея `btn.reset` при
активном инструменте `draw` тоже вызывает `_finishWallChain()`);
`_finishWallChain()` → `_finalizeWallChainPartitions()` → `finalizeWallChainSpace()`
(`src/writer-fixed-point.ts:64`) — тот же финализатор, что персистит цепочку как
обычные partition'ы. Код и `WALL-THICKNESS.md` §11 согласны; `UX-MODES.md` и
`TOUCH-SUPPORT.md` утверждают обратное для тех же двух действий.

Автор сам заметил расхождение (раздел «Замечено, не правлено» в комментарии) и
не стал править — по существу верно: `UX-MODES.md`/`TOUCH-SUPPORT.md` —
документы подсистем волны 2 по объёму этой задачи (`## Не входит` issue #680),
и правка не входит в перечень AC. Но находка реальна, продуктово видима
(поведение двух admin-редакторов) и способна ввести в заблуждение будущего
агента, который по `AGENTS.md` › «Read this first» обязан прочитать именно эти
файлы перед правкой Walls/touch-кода — значит не может быть «оставлена в тексте
ревью» (§12), заведён отдельный issue:

**#684** — `docs`, `P2`, `S1-new`: https://github.com/Matysh/houseplan-card/issues/684

### Low

Не найдено дополнительных находок уровня Low сверх уже раскрытых автором и
принятых мной без правки:

- Комментарии-шапки `src/houseplan-card.ts:6` и
  `src/houseplan-editor-runtime.ts:6` про «LEGACY fallback — src/data/*,
  1489×1053» устарели, но это правка `src/**` (класс A) — она сняла бы с задачи
  статус инфраструктурной (пропуск анализа/спецификации, `PROCESS.md` §1).
  Решение автора не трогать их в этой ветке корректно; принимаю без находки.

## Что проверено и корректно

- Заявленные числа (`entry-cost`, длины файлов, any-долг) воспроизведены
  самостоятельно и совпадают день в день с текстом «Сделано».
- Мутант `entry-cost-author-route-over-budget` реально красн​еет на патче и
  ловится единственным названным тестом — «тест умеет падать» проверено
  исполнением, а не по описанию.
- Все ссылки «§NN», изменённые этим диффом (в `PROCESS.md`, `.github/workflows/_process.yml`,
  `scripts/branch-state.mjs`, `scripts/merge-candidate.mjs`,
  `scripts/review-doc-guard.mjs`, `scripts/pre-push-gate.mjs`,
  `test/branch-state.test.mjs`), ведут в раздел с ожидаемым содержанием; висячих
  ссылок на удалённые §13/§14/§7.3 в активном каноне не найдено.
- Все символы и файлы, названные в фактах, перенесённых из `ARCHITECTURE.md` в
  документы подсистем, существуют и описаны точно (сверено выборочно по восьми
  символам из разных файлов — не нашёл ни одного расхождения).
- Трейлеры `Issue: #680` и `User-Visible: no` присутствуют на всех четырёх
  коммитах; `User-Visible: no` корректен — видимого пользователю поведения
  диф не меняет, правка обоих `docs/CHANGELOG*.md` не требуется.
- «Одно число — один источник» (§8): число any-долга и числа `entry-cost`
  убраны из прозы в командные измерения (`--total`, `entry-cost.mjs`) везде,
  где раньше дублировались текстом — само это было пунктом объёма задачи и
  выполнено.
- `git status` рабочей копии чист, `HEAD` соответствует материалу ревью
  (`72ce15bf`), новых незапушенных коммитов на момент ревью нет.

## Чего не проверял

- Полный `npm test` / `npm run build` + трёхстороннюю сверку бандла в этом
  дереве — не перегонял: `src/**` не тронут, а Validate уже зелёный на этом
  точном SHA (run 36345237757). Прогнал только целевые юнит-файлы и отдельные
  скрипты гейтов, перечисленные в таблице выше.
- Полный `node scripts/mutation-gate.mjs` (все 41 заявленных мутанта) — прогнал
  только один (`entry-cost-author-route-over-budget`, единственный, который
  автор явно называет «был красным, теперь почтен») точечно по `--id=`;
  оставшиеся 40 «пойманы с первого раза» принимаю со слов автора без
  повторного исполнения — полный мутационный прогон здесь тяжёл (затрагивает
  Python/`tests_backend`, для которого в этой песочнице нет `pytest`) и
  несоразмерен объёму чисто документного диффа (§8, «полные наборы — предрелизный
  гейт, а не гейт ревью»).
- `pytest tests_backend`, `npm run golden:verify`, `npm run invariants`,
  browser smokes (`smoke-select.mjs`) — не прогонял: диф не трогает
  `custom_components/**/*.py`, геометрию, рендер или что-либо из AC этой
  задачи, что требовало бы их.
- Не читал построчно все 33 изменённых файла целиком — при объёме diff 4547
  строк это было бы предрелизным гейтом, а не гейтом ревью (§8). Прочитал diff
  целиком по всем файлам (не только выборку выше) для проверки на осмысленность
  и отсутствие потери фактов при сокращении; глубокая построчная сверка «каждый
  перенесённый факт с каждым его источником в коде» сделана выборочно на
  восьми репрезентативных символах из разных подсистем (Glow, Iso, Canvas,
  Device-presentation, Initial-load) — не на всех примерно ста перенесённых
  утверждениях.
- Не проверял английскую версию нигде не упомянутых файлов
  (`docs/CHANGELOG.md`/`.ru.md`) на предмет других расхождений, не связанных с
  этим диффом — вне материала.

## Продуктовое рассуждение

Задача не расширяет и не меняет пользовательский сценарий — это чистое
снижение стоимости входа для агентов конвейера (спецификация задачи закрыта
до этого ревью, разработка была инфраструктурной). Единственный риск такого
рода задач — потеря факта при сокращении текста; целевая проверка (см. выше)
не обнаружила потерянных фактов, только одно уже раскрытое автором и вынесенное
мной в отдельный issue расхождение в документах, которые эта задача не должна
была трогать по объёму.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/680-hygiene-wave3`, коммит `72ce15bfa1cc` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `e8357cbc7cb8c7fb2ec1d8a259950238fcb0479f`
  ```
  git log --all --format='%H %T' | grep e8357cbc7cb8
  ```
- Тело issue: `390deb7365b595c9e043f0762991b74d9d79e543ab74462b0cb78619e86d386f`
- Вердикт конвейера: `green` · High 0
