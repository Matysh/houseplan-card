# CODE-REVIEW — issue #51 «Custom decor images» · заход r3

- Issue: https://github.com/Matysh/houseplan-card/issues/51
- Материал раунда: `git diff 042af520fe4f6cc47d78ae6ccbb105580382e961..HEAD`
  (материал r2 объявлен в `docs/reviews/CODE-REVIEW-51-r2.md`).
- SHA материала: `043aa0d826cf1e1490a02feb4cc28f50cb96245b` (сверено с
  `git rev-parse HEAD` — совпадает).
- SHA предыдущего раунда (r2): `042af520fe4f6cc47d78ae6ccbb105580382e961` —
  жив, `git cat-file -t` → `commit`, `git merge-base --is-ancestor` подтверждает:
  прямой предок `HEAD`, ребейза не было.
- Трейлеры всех пяти коммитов дельты (`5a93fc2a`, `a5f28c3a`, `db08b92a`,
  `424a133b`, `043aa0d8`) — `Issue: #51`, `User-Visible: no`. Корректно: ни
  один не меняет наблюдаемое пользователем поведение (типизация без изменения
  рантайма, ruff-лint, публикация документа r2, пересъёмка отпечатка
  скриншотов, регенерация `config-schema.json`) — правок в `docs/CHANGELOG*`
  не требуется и не сделано.

## Скоуп раунда

Единственная предметная находка r2 (Medium, в скоупе: устаревший
`scripts/config-schema.json`) закрыта одним коммитом. Дельта — 9 предметных
файлов (без учёта бандлов), +361/-28: регенерация манифеста схемы,
`ruff`-порядок импортов в трёх backend-модулях, типизация трёх frontend-мест
(`decor-assets.ts`, `houseplan-editor-runtime.ts`, `space-render.ts`, ранее
помеченных `any`), обновлённый отпечаток документационных скриншотов и
публикация `CODE-REVIEW-51-r2.md`. Ребейза на ушедший вперёд `dev` не было,
контракт поведения не менялся, новая подсистема не задета, объём дельты
(9 файлов) на порядок меньше исходной задачи (63 файла) — критерий «разбор
остаётся полным» не выполняется, сокращение объёма правомерно.

Прочитал все пять диффов не-бандловых файлов построчно (см. «Проверено и
корректно») — это не декларативная типизация: `any` заменён на конкретные
локальные типы (`ContentItem`, `DecorAssetConfig`), добавлен non-null
assertion (`shape.asset_id!`) там, где рантайм уже гарантировал непустое
значение (тот же `if` guard, что и раньше), поведение не изменилось.

## Закрытие раунда r2

| Находка r2 | Чем закрыта | Где это видно |
|---|---|---|
| **Medium (в скоупе)** — `scripts/config-schema.json` устарел, `tests_backend/test_config_schema_manifest.py::test_issue_33_manifest_is_fresh_and_deterministic` красный после того, как `38205d87` добавил decor kind `image` в `validation.py` | `scripts/config-schema.json` регенерирован штатным `scripts/dump-config-schema.py`; добавлены 76 строк контракта `config.spaces[].decor[]<image>.*` | `scripts/config-schema.json` (диф `042af520..043aa0d8`); **воспроизведено лично**: `python3 scripts/dump-config-schema.py` (voluptuous доступен в песочнице без Home Assistant) перезаписал файл по тому же пути — `git status`/`git diff` после прогона пустые, то есть закоммиченный манифест побайтово совпадает со свежесгенерированным — детерминированность подтверждена, не только словом автора |

Единственная находка r2 закрыта предметно.

## Унаследовано из r2

Без повторной проверки приняты как есть — материал `docs/reviews/CODE-REVIEW-51-r2.md`
на SHA `042af520fe4f6cc47d78ae6ccbb105580382e961`, поскольку дельта r3 их код
не задевает:

- Весь High/Medium/Low реестр r1, закрытый и адверсариально проверенный в r2
  (UTF-16/32 DTD/entity SVG guard, `smoke_decor.mjs`, единая
  `projectDecorImage`, positive/negative resolve-кэш, touch pointerType,
  SVG per-attribute bounds, `javascript:`/`data:`-substring — сознательно
  оставлено Low).
- AC1, AC2, AC4, AC6, AC8–AC13 — унаследованы из r1 через r2, дельта r3 их не
  трогает.
- Golden (`npm run golden:verify`, 153/153 в r1) и полный HA-harness — не
  перепрогонял: дельта r3 не меняет визуальные числа и не меняет вызывающий
  контракт HA-специфичных тестов (только порядок импортов и типы).
- Bundle budget — известный долг #367 (запас < 15000 Б) остаётся, число
  практически не изменилось (291041 Б → 291018 Б).

## Как проверялось (гейты этого раунда)

Дешёвые гейты прогнал сам (зелёного Validate на `043aa0d8` на момент начала
ревью не было — CI ещё не завершился):

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный |
| Unit (frontend) | `npm test` | 1778 tests, 1777 passed, 1 skipped, 0 failed |
| Build | `npm run build` | зелёный |
| Bundle sync (3 копии) | `npm run bundle:sync` | зелёный; `git status` после — чисто |
| Bundle budget | `npm run bundle:budget` | initial View 291018 B / 300000 B, запас 8982 Б — прошёл, тот же долг #367 |
| `no-new-any` по дельте раунда | `node scripts/no-new-any.mjs --base 042af520 --head HEAD` | зелёный: 16 добавленных строк в 3 файлах, новых `any` нет |
| `no-new-any` по всей задаче | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | зелёный: 808 строк в 10 файлах |
| Docs fingerprint (обязателен: дельта трогает `src/**`) | `node scripts/check-docs.mjs --external` | зелёный: «Documentation checks passed (7 files, 10 external links)», включая сверку `sourceFingerprint`/`captureScriptSha256`/побайтовых хешей 10 PNG |
| Регенерация config-schema (целевая проверка находки r2) | `python3 scripts/dump-config-schema.py` (voluptuous есть в песочнице) | манифест перезаписан по тому же пути; `git diff`/`git status` после — пусто → закоммиченный файл идентичен свежесгенерированному |
| Backend pure lint | `ruff check` | **не прогнан**: `ruff` не установлен в песочнице ревьюера и не ставится через `pip`/`python -m ruff` (нет пакета); см. ниже, чем компенсировано |
| **Backend: `pytest tests_backend` + coverage-порог** (обязателен: дельта трогает `.py`) | не смог прогнать локально: `pytest-homeassistant-custom-component==0.13.357`/`homeassistant==2026.8.3` требуют Python ≥3.14, в песочнице только 3.12.3, `pip install` за пином падает `No matching distribution` | **воспроизведено через реальный прогон CI на этом же SHA** — см. находку ниже, это не пропуск гейта, а его результат |
| Model invariants | не прогонял | дельта не трогает `marker.space`, `open_spans`, thickness-записи, `layout` — весь diff `042af520..HEAD` вне бандлов состоит из импортов, типов и данных манифеста/скриншотов, геометрии не касается |
| Целевые смоки/`smoke-select` | `node scripts/smoke-select.mjs --base 042af520 --head 043aa0d8` | «НЕОПРЕДЕЛЁННОСТЬ»: изменено 3 файла `src/**`, 5 символов на изменённых строках (`ContentItem`, `DECOR_ASSET_ID_RE`, `DecorAssetConfig`, `DecorShape`, `decorAssetIds`), ни один смок не привязан. Не прогонял: все пять символов — либо локальные типы, стираемые при компиляции (`ContentItem`, `DecorAssetConfig`, `DecorShape` — только аннотации, без изменения рантайма), либо неизменная сигнатура существующей функции (`decorAssetIds`, `DECOR_ASSET_ID_RE`), которую уже покрывает `test/decor-assets.test.mjs:18` (юнит зелёный в `npm test` выше) |
| Golden / HA full harness / performance | не прогонял | см. «Унаследовано из r2» — дельта не меняет визуальные числа и HA-специфичный контракт |

### Как проверялось: реальный CI-прогон на `043aa0d8`

Поскольку локальный backend-гейт недоступен (Python 3.14 нет в песочнице),
проверил статус актуального прогона `Проверка (CI)` для этого SHA напрямую
через `gh api`/`gh run view`:

- `run 33685317804`, `headSha 043aa0d826cf1e1490a02feb4cc28f50cb96245b`,
  итог `completed / cancelled`.
- Job **«Бэкенд: pytest в Home Assistant»** (`100431708612`) — **failure**.
  Сам `pytest tests_backend/ -q --cov=... --cov-branch` зелёный: `526 passed,
  2 skipped`. Падает следующий шаг, сравнивающий покрытие с
  `scripts/backend-coverage-baseline.txt`:
  ```
  coverage: 86.9% (baseline 87.2%)
  Process completed with exit code 1
  ```
  (порог — `actual >= baseline - 0.1`, см. `custom_components` job логи;
  механизм описан в `docs/specs/042-backend-engineering-quality.md` §4:
  «одно число, шаг CI сравнивает: ниже baseline − 0.1 п.п. → красный»,
  ratchet **не должен снижаться**).
- Остальные job'ы на этом SHA: «Предполётные проверки» — success (значит,
  проверка свежести `config-schema.json` теперь тоже зелёная в CI, совпадает
  с моим локальным воспроизведением находки r2); «Фронтенд: типы, юниты,
  мутанты, синхрон бандла» — success; «Hassfest», «HACS» — success; смоки
  шард 1/3 — success, шард 2/3 — cancelled (следствие общего fail-fast после
  красного backend-job, не отдельная находка); Golden/perf-smoke — skipped
  по той же причине.

## Находки

### Finding 1 (Medium, в скоупе) — backend coverage ratchet красный на `HEAD`: 86.9% < baseline 87.2% − 0.1

**Гейт:** `python -m pytest tests_backend -q --cov=custom_components/houseplan
--cov-branch` + шаг сравнения с `scripts/backend-coverage-baseline.txt` —
стандартный гейт код-ревью для задач, трогающих `custom_components/**/*.py`
(PROCESS.md §8), встроенный в тот же job CI. Все 526 тестов зелёные — падает
именно порог покрытия.

**Причина, воспроизведённая по логам реального прогона (не только словом
автора):** сравнил построчную таблицу `coverage --cov-report=term` на
`043aa0d8` (job `100431708612`) с последним зелёным прогоном этого же job на
`origin/dev` до фичи #51 (`cfa5c779`, job `100381072223`):

| Файл | dev (`cfa5c779`) | `HEAD` (`043aa0d8`) |
|---|---|---|
| `decor_assets.py` | файла не существовало | 292 стат., 71 непокрыт (**71%**) |
| `http_api.py` | 185 стат., 56 непокрыт (68%) | 304 стат., 87 непокрыт (69%) |
| `websocket_api.py` | 1069 стат., 155 непокрыт (84%) | 1145 стат., 169 непокрыт (83%) |
| **TOTAL проекта** | **87.2%** (зафиксировано как baseline) | **86.9%** |

Фича #51 добавила крупный новый модуль (`decor_assets.py` — SVG/raster
security-валидация, ровно тот код, где в r1 нашли обходимый DTD/entity-фильтр)
с покрытием заметно ниже среднего по проекту (71% против ~85-87%), плюс
расширила `http_api.py`/`websocket_api.py` без пропорционального прироста
тестов на новые ветки. Взвешенное среднее по всему backend просело на 0.3 п.п.
и вышло за допуск ratchet-гейта (0.1 п.п.).

**Не воспроизведено мной построчно (какие именно 71 из 292 statements
`decor_assets.py` не покрыты)** — `coverage.xml` в артефактах прогона не
публикуется, а локальный запуск `pytest --cov` недоступен: пин
`pytest-homeassistant-custom-component==0.13.357`/`homeassistant==2026.8.3`
требует Python ≥3.14 (см. `tests_backend/requirements.txt` — пины
преднамеренные, менять их ради ревью нельзя), в песочнице только 3.12.3;
`pip install -r tests_backend/requirements.txt` в отдельном venv (проверил)
падает `No matching distribution`. Табличные Miss-числа выше — это реальные
данные CI на этом SHA, не догадка, но точные номера строк я не устанавливал.

**Не архитектурный риск** — существующий malicious/regression corpus
`tests_backend/test_decor_assets.py` (27 тестов) уже ловит все находки r1/r2
(UTF-16/32 DTD/entity, oversized attrs, unit-interval). Но именно потому, что
это security-критичный модуль (метка `security` на issue, r1 уже нашёл
обходимый фильтр в непокрытом углу), 29% непокрытых statements в нём — это
плоскость, где обходы прячутся, а не косметика.

**В скоупе задачи, фикс не архитектурный:** добавить backend-тесты на
непокрытые ветки `decor_assets.py`/`http_api.py` (или обосновать `# pragma:
no cover` для реально недостижимого кода) до восстановления ≥87.1%; по
правилу ratchet baseline **нельзя** просто занизить — механизм специально
задуман монотонным (docs/specs/042 §4: «Пороги 90%→95%: … меняющие ОДНО число
… baseline»; вниз это число двигать не предполагается).

## Проверено и корректно

- Единственная находка r2 закрыта и лично перепроверена: регенерация
  `scripts/config-schema.json` детерминирована (перегенерировал сам —
  `git diff` пуст).
- Все пять правок дельты — типизация/порядок импортов без изменения
  поведения: прочитал построчно `decor-assets.ts`, `houseplan-editor-runtime.ts`,
  `space-render.ts`, `decor_assets.py`, `http_api.py`, `websocket_api.py`.
  Non-null assertion (`shape.asset_id!`) и приведения типов (`as ContentItem[]`)
  не меняют рантайм-путь — тот же `if`/`filter`-guard, что и раньше; `ruff`
  и `import` reordering — механические. Подтверждено тем, что `npm test`
  (1777) и `npx tsc --noEmit` зелёные на этом же дереве.
- `check-docs.mjs` подтверждает: отпечаток скриншотов пересчитан по всему
  `src/**` (обязателен, т.к. дельта трогает `src/**`), 10/10 PNG совпадают
  побайтово с принятыми — регрессии класса #230/#234/#237 в этом раунде нет.
- Три копии бандла синхронны (`bundle:sync` не изменил дерево), бюджет не
  превышен (тот же известный долг #367).
- Реальный CI-прогон на `HEAD` подтверждает и «Предполётные проверки»
  (включая свежесть `config-schema.json`) зелёными, и фронтенд-job зелёным —
  независимое от меня подтверждение моих локальных гейтов.

## Чего не проверял

- **Точные номера непокрытых строк** `decor_assets.py`/`http_api.py` —
  `coverage.xml` не публикуется как артефакт, локальный прогон недоступен
  (Python 3.14 нет в песочнице). Табличные агрегаты Miss/Stmts взяты из
  реального лога CI (job `100431708612`), это не догадка, но не построчный
  разбор.
- `ruff check custom_components/houseplan` — пакет `ruff` не ставится в
  песочнице (`pip`/`python -m ruff` не находят модуль); компенсировано тем,
  что job «Предполётные проверки»/лint на актуальном `HEAD` в реальном CI —
  success (виден в прогоне `33685317804`).
- Полный HA-harness (`test_ha_websocket.py`, `test_ha_import_export.py`,
  `test_coordinate_canonicalization.py`) и Golden — не прогонял; дельта r3 их
  не касается (см. «Унаследовано из r2»), для полноты вижу по реальному CI,
  что до backend-failure остальные job'ы (Hassfest, HACS, фронтенд, 2 из 3
  смок-шардов) зелёные.
- 4 из 5 символов `smoke-select`-выборки — не прогонял отдельно; все они
  типо-стираемые аннотации либо неизменная сигнатура, уже покрытая юнитом
  (см. таблицу гейтов). Отдельного смок-прогона не потребовалось.
- Model invariants — не прогонял: дельта не касается геометрии (сверено
  чтением всего non-bundle diff).

## Вердикт

Единственная находка r2 закрыта предметно и лично перепроверена. Новая
находка этого раунда — Finding 1, Medium, в скоупе: backend coverage ratchet
красный на актуальном `HEAD` (86.9% < 87.2% − 0.1), обнаружено не декларацией
автора, а чтением реального прогона CI на этом же SHA (job
`100431708612`, run `33685317804`), поскольку локальный пере-прогон
`pytest tests_backend` в песочнице ревьюера недоступен по версии Python.
Причина — новый security-критичный модуль `decor_assets.py` с покрытием
заметно ниже среднего по проекту. Фикс не архитектурный (добавить backend-
тесты на непокрытые ветки), но не косметический как в r2 — реальный объём
работы. Без High это жёлтый вердикт по правилу §2.7: возврат автору, фикс
проходит следующий цикл ревью, отдельный issue не заводится (Medium в
скоупе).

Вердикт: жёлтый · заход r3 · блокирующих циклов 3/4 · High: 0 · Medium: 1 → в задаче

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/51-custom-decor-images`, коммит `043aa0d826cf` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `576c3e884af13ca0395b0cf943111e3654f3eddd`
  ```
  git log --all --format='%H %T' | grep 576c3e884af1
  ```
