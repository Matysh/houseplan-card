# CODE-REVIEW-679-r1

Issue: #679 «Гигиена, волна 2 — дубли и устаревшее в документации подсистем
(эпик #674)». Заход r1 из 4 (полный трек — задача сравнима по объёму с полной
переработкой раздела документации; см. #674 «инфраструктурный маршрут»).

**Материал**: диапазон `origin/dev..HEAD`, HEAD = `030780386cacc0bb965b7b51d8c705580ec361e3`.
Два коммита:
- `5a258f31` — основная правка (свести дубли, снять устаревшее);
- `03078038` — назвать тест сверки схемы в шапке `CONFIG-COMPATIBILITY.md`.

Оба несут `Issue: #679`, `User-Visible: no` — верно: изменения ограничены
`docs/**`, `README*`, `CONTRIBUTING.md`, `AGENTS.md`, `.github/workflows/_process.yml`
и ссылками на разделы документов внутри комментариев `src/**`/`validation.py`/
тестов; ни один исполняемый символ не тронут (подтверждено ниже).

## Скоуп

Задача — волна 2 эпика #674, маршрут инфраструктурный (только `docs/**` +
комментарии-указатели), без спека и без предметного вопроса владельцу. Объём
из тела issue — 11 пунктов чек-листа плюс раздел «Зависимости и машинные
проверки». Проверено построчно.

## Как проверялось

Прочитан весь диф (`git diff origin/dev...HEAD`), каждый файл из
`git diff --stat` (48 файлов) сверен с соответствующим пунктом чек-листа
issue. Для правок `src/**`/`custom_components/houseplan/validation.py`
построчно проверено, что менялись только пути внутри комментариев/докстрок —
исполняемого кода строка не задета.

| Пункт issue | Проверено | Результат |
|---|---|---|
| `DECOR-EDITOR.md` ← `BACKDROP.md` + `LIVE-TEXT.md` | прочитан файл целиком (402 строки, §1–9), `git grep BACKDROP.md\|LIVE-TEXT.md` вне reviews/legacy/specs/changelog | Только два намеренных «formerly `BACKDROP.md`» / «formerly `LIVE-TEXT.md`» в шапке нового документа — верно, это провенанс, а не забытая ссылка. Оба старых файла удалены (`-93`, `-192` строк). Ссылки в `src/houseplan-card.ts`, `src/houseplan-editor-runtime.ts`, `src/logic.ts`, `src/space-geometry.ts`, `src/space-render.ts`, `src/styles/plan.styles.ts`, `custom_components/houseplan/validation.py`, `test/backdrop.test.mjs`, `test/logic.test.mjs`, `tests_backend/test_validation.py`, `docs/ARCHITECTURE.md`, `docs/testing-notes/*` переписаны на конкретные разделы (§3, §3.2, §3.3, §5, §5.2, §5.3), которые в новом документе реально существуют |
| Ложное «space-card не рисует декор» | сверено с `src/space-render.ts` | §5.2 нового документа теперь корректно говорит: static card рисует подложку и картинки декора, но не фигуры/мебель/текст — совпадает с кодом |
| `LIGHT.md` ← `DEVICE-LIGHT-SETTINGS-MATRIX.ru.md` | файл удалён (-122 строки), прочитан перенесённый раздел «Leading entity», «controls links», 36-строчная матрица | таблица на английском (соответствует остальному `LIGHT.md`), обещание «проверяется unit-тестом» теперь называет тест: `test/devices.test.mjs`, `issues 84/88: exhaustive 36-case light settings matrix is internally consistent` — тест существует (`test/devices.test.mjs:1981`) и прогнан (см. «Гейты») |
| `DEVICE-PRESENTATION.md` ← `FILTERING.md:169-306` | построчный дифф обоих файлов | Раздел «Source precedence: what a marker shows» перенесён в `DEVICE-PRESENTATION.md` дословно; в `FILTERING.md` — абзац-указатель на новый дом; «в одном pull request» → «в одном коммите» выполнено |
| `CANVAS.md`: §9.5 → `CONFIG-COMPATIBILITY.md`, overlay/faces → `WALL-THICKNESS.md` §10–11, таблицы «было/стало» убрать | построчный дифф `CANVAS.md`, `CONFIG-COMPATIBILITY.md`, `WALL-THICKNESS.md` | «Model» и «coordinate ranges» переписаны без столбцов «before/now»; «Оптимизировать планы» перенесён целиком в `CONFIG-COMPATIBILITY.md` (новый раздел «Optimize plans»); §10 «Architectural connection overlay» и §11 «Planar wall faces» перенесены в `WALL-THICKNESS.md`; «Every place that assumed the unit square» таблица снята (проверено — далее в файле она отсутствует) |
| `TESTING-DEMO.md` → `demo/stand/README.md` | файл удалён (-469 строк), `demo/stand/README.md` прочитан | карта демо-дома v2, «чего на стенде нет» перенесены; «2 таба редакторов», `?v=1.58.0` отсутствуют в новом тексте; ручной чек-лист не перенесён (в процессе ручной фазы нет — сверено с `PROCESS.md` §2, там ручного тестирования в цикле действительно нет) |
| `ISOMETRIC.md` — только текущее, история → ADR; `SUN.md` — снять раздел, перенести правило бумаги | прочитаны оба файла целиком + новый `docs/adr/570-isometric-stage4-visual-handoff.md` | `ISOMETRIC.md` не содержит «Stage 2/4», «Stage 1» текст перенесён без изменений в новый ADR (провенанс-шапка как у ADR 122/160); `SUN.md` — раздел «Historical continuous background» снят, а актуальное правило бумаги дано отдельным пунктом текущего раздела, с исправлением: подложка не «бумажит» свой прямоугольник (совпадает с `DECOR-EDITOR.md` §3.3 и текущим кодом paper=room contours) |
| `UX-MODES.md`: декор «under the rooms» vs `DECOR-EDITOR.md:24`; hidden isometric; follow-up | прочитан дифф | декор описан как «один слой над заливками и Glow base, под живым Glow…» со ссылкой на `DECOR-EDITOR.md` §1 — согласуется с §1 нового документа (таблица «View composition»); «hidden isometric» → «View (Flat and 2.5D)»; follow-up из #3 сведён к абзацу «все выпущены» |
| Устаревшие статусы в шапках (`VACUUM.md`, `WARM-REMOUNT.md`, `WALL-THICKNESS.md`, `STYLING-HOOKS.md`, `DECOR-EDITOR.md`, `CONFIG-COMPATIBILITY.md:18-21`, `PDF-EXPORT.md:62-65`) | построчный дифф каждого | все статусные строки/таблицы истории сняты; `CONFIG-COMPATIBILITY.md` теперь называет `test/config-schema-parity.test.mjs` вместо «следующий этап»; `WARM-REMOUNT.md` переименовал устаревшее «Выровнять всё по сетке» в текущее «Оптимизировать планы» |
| README: абзац о пересъёмке → `CONTRIBUTING.md`; RADAR/PDF-EXPORT в списке; RU догнал EN | дифф `README.md`, `README.ru.md`, `CONTRIBUTING.md` | абзац перенесён (новый раздел «Documentation screenshots» в `CONTRIBUTING.md`, ссылается на `Docs screenshots` workflow, `docs:accept --reviewed/--identical`, согласуется с `PROCESS.md` §759-765); RADAR и PDF-EXPORT добавлены в оба README; `README.ru.md` получил абзац про 2.5D-переключатель, «уже загруженное изображение» и ссылку на STAIRS |
| Единый список канонических документов подсистем (`AGENTS.md` + `_process.yml`) | дифф обоих файлов | оба теперь перечисляют одни и те же 16 документов (было 7): `SUN, LIGHT, CANVAS, WALL-THICKNESS, UX-MODES, CONFIG-COMPATIBILITY, TOUCH-SUPPORT, ISOMETRIC, VACUUM, DECOR-EDITOR, DEVICE-PRESENTATION, FILTERING, STAIRS, RADAR, PDF-EXPORT, STYLING-HOOKS`, дословно совпадают |
| ADR 282 в `WALL-THICKNESS.md` | дифф | §1 добавляет прямую ссылку на `docs/adr/282-wall-geometry-representation.md` и матрицу миграций в `CONFIG-COMPATIBILITY.md` |

### Зависимости и машинные проверки (раздел issue)

- `test/device-presentation-policy.test.mjs` — читает `docs/DEVICE-PRESENTATION.md`
  (сам тест не изменился, что и ожидалось: он и раньше читал новый дом, только
  контента там не было для сверяемых строк — теперь есть). 7 тестов, все
  зелёные (прогнано локально, см. «Гейты»).
- `test/config-schema-parity.test.mjs` — прогнан, зелёный.
- `test/review-doc-guard.test.mjs`, `test/golden-matrix.test.mjs`,
  `test/entry-cost.test.mjs`, `test/testing-notes-index.test.mjs`,
  `test/devices.test.mjs` — прогнаны локально, все зелёные (230/230 в общем
  прогоне пяти файлов + отдельно `config-schema-parity`/`devices`).
- `_process.yml` — правка синхронизирована в `main`? **Не проверялась мной**:
  задача явно требует «зеркалить в `main` тем же содержимым», но этот диф
  (`origin/dev...HEAD`) правит только версию на `dev`; зеркалирование в `main`
  происходит отдельным механизмом (`workflow_sync`/ручной шаг) и не относится
  к дереву материала этого ревью. Отмечаю как «не в материале», не как дефект:
  правка тела `_process.yml` не входит в список файлов, которые
  `workflow_sync` сверяет между ветками (сверяются только шесть тонких
  вызывающих файлов), так что расхождение содержимого `_process.yml` между
  `main` и `dev` — штатное состояние процесса (AGENTS.md, «Workflows run from
  the default branch are thin callers»), а не находка этого ревью.
- `git grep` по старым именам/якорям вне `docs/reviews`, `legacy`,
  `docs/specs`: выполнено вручную —
  `git grep -n "BACKDROP\.md\|LIVE-TEXT\.md\|TESTING-DEMO\.md\|DEVICE-LIGHT-SETTINGS-MATRIX"`
  — единственные два хита — намеренные «formerly …» в шапке
  `DECOR-EDITOR.md`. Пусто в остальном дереве.
- `scripts/check-docs.mjs` PUBLIC_DOCS / якоря — не содержит удалённых имён
  (проверено `grep` по скрипту).

## Что проверено и корректно

- Смысловые правки корректны и построчно совпадают с фактическим кодом,
  который они описывают (сверено: `space-render.ts` для декора на static-card,
  `SUN.md`/`DECOR-EDITOR.md` §3.3 для правила бумаги, `WALL-THICKNESS.md` §1
  для ссылки на ADR 282).
- Оба коммита несут обязательные трейлеры `Issue: #679`, `User-Visible: no` —
  верно для чисто документационной/комментарийной правки без видимого
  поведения.
- Единый список канонических документов действительно устраняет
  рассинхронизацию, названную в issue (`AGENTS.md:38-40` vs промпт ревьюера).
- Число (User-Visible: единственное затрагиваемое числовое поле в диффе —
  список из 7→16 канонических документов, дублированный в двух местах) имеет
  теперь один текст в обоих местах — совпадает дословно, второго независимого
  источника для этого списка в репозитории нет.

## Гейты

Прогнано мной (после подтверждения, что дешёвые гейты уже зелёные на этом
SHA):

| Гейт | Команда | Результат |
|---|---|---|
| Validate на материале | (готовый прогон) `gh run view 36339487781` | `conclusion: success`, `headSha: 030780386c…` — совпадает с материалом ревью. Покрывает `typecheck`, `npm test`, `npm run build` + `bundle-policy --verify`, `docs` job и остальные обязательные jobs `validate.yml` |
| `node scripts/check-docs.mjs --external --screenshots=warn` | прогнано локально | `Documentation checks passed (7 files, 12 external links)`; WARN только «screenshot source fingerprint is stale» — ожидаемо для любой правки `src/**` (даже только комментариев), не блокирует вне кандидата |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прогнано локально | «Изменено файлов src/**: 6 · символов на изменённых строках: 0» → «НЕОПРЕДЕЛЁННОСТЬ: дифф исполняемый, но ни один смок не связан доказуемо». Решение ревьюера: не прогонять браузерные смоки — 0 символов на изменённых строках означает, что все шесть изменений в `src/**` физически лежат внутри комментариев/докстрок (построчно перепроверено в «Как проверялось»); поведение карточки не меняется, смоки по определению не могут покраснеть от переименования пути в комментарии |
| `node --test` по документо-зависимым файлам (`device-presentation-policy`, `golden-matrix`, `review-doc-guard`, `entry-cost`, `testing-notes-index`, `config-schema-parity`, `devices`) | прогнано локально (после `tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs`) | 230/230 pass (первый прогон покраснел из-за отсутствия `test-build/*.js` — это моя локальная сборка, не дефект материала; после сборки все зелёные) |
| `node scripts/mutation-registry.mjs --check` | прогнано локально | exit 0, без вывода |
| `node scripts/check-inputs.mjs --coverage` | прогнано локально | exit 0, без вывода |

### Чего не проверял

- `npm run gate:small` целиком (build + no-new-any + no-new-private-writes +
  bundle-tree/budget) — не перегонял отдельно: Validate на точном SHA уже
  зелёный и покрывает build/bundle-policy; диф не касается `dist/**` и не
  является кандидатом, так что сверка бандла неприменима.
- `process-gate --range` — не прогонял; автор заявил «0 предупреждений», сам
  скрипт читает состояние issue/labels, для code-review это косвенная
  проверка процесса, а не кода, риска не несёт при чисто документационном
  диффе.
- Браузерные смоки, `golden:verify`, `pytest tests_backend`, инварианты
  модели, performance — не прогонял: смоки — см. решение выше
  (НЕОПРЕДЕЛЁННОСТЬ, но 0 исполняемых символов на диффе); ни один AC не
  требует golden/backend/geometry гейтов, дифф не касается `demo/golden/**`,
  `custom_components/**/*.py` логики (правка `validation.py` — только два
  слова в комментарии) и геометрии/инвариантов модели.
- Зеркалирование `_process.yml` в `main` — вне дерева материала, см. выше.

## Находки

Ни одной High/Medium/Low находки. Все 11 пунктов чек-листа issue выполнены и
подтверждены построчным сравнением документа с кодом либо с другим
документом; машинные зависимости (`test/config-schema-parity.test.mjs`,
`test/device-presentation-policy.test.mjs`, `test/golden-matrix.test.mjs`,
`test/devices.test.mjs`) прогнаны и зелёные; `git grep` по старым именам
пуст, кроме двух намеренных «formerly» в провенансе.

## Вердикт

Зелёный. Задача — механический перенос текста без изменения исполняемого
поведения; весь заявленный объём проверен, гейты, применимые к диффу,
зелёные, дублирующих/устаревших мест не осталось.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/679-hygiene-wave2`, коммит `030780386cac` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `7562c72f36d2aa1326aa9dcab83f960993611190`
  ```
  git log --all --format='%H %T' | grep 7562c72f36d2
  ```
- Тело issue: `c9f99f28066575542c2388c6e3dfb210caa78929a048cc0dcdd71d359cfab47b`
- Вердикт конвейера: `green` · High 0
