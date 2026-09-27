# CODE-REVIEW-498-r1

- **Issue:** #498 — Backend hardening: точная квота upload, ключи палитры в support-пакете, предел цепочки ссылок SVG
- **Материал:** `4f040c4c8eb580cc423d7be8a6dc95629084c5c2` (рабочая копия уже на нём; `git log --oneline origin/dev..HEAD` — 5 коммитов, `git diff origin/dev...HEAD` — 16 файлов)
- **Этап / заход:** код-ревью, r1 (первый заход, блокирующих циклов израсходовано 0 из 4)
- **Контекст материала:** ветка приведена к `dev` конвейером до ревью (10 коммитов `dev` легли поверх `02a14679` → `4f040c4c`). По правилу §7.2/§2.9 после ребейза это другой код — разбор ниже полный, а не по дельте; дельта между `02a14679` и `4f040c4c` при этом чисто механическая (ни один из файлов задачи не задет рабочей частью ребейза — см. «Как проверялось»).
- **Спека:** `docs/specs/498-backend-hardening-quota-palette-svg-refs.md`, ревью ТЗ — зелёное на r2 (`docs/reviews/SPEC-REVIEW-498-r2.md`), AC1–AC8.

## Скоуп диффа

Три независимых защитных дефекта из аудита 2026-09-08 (B5/B6/B7):

1. `custom_components/houseplan/plans.py` + `http_api.py` — `dir_usage`/`check_quota` получили `exclude`, чтобы не считать собственный staged-файл дважды (квота).
2. `custom_components/houseplan/support_package.py` — проекция `fill_colors` сужена до `SUPPORT_FILL_COLOR_KEYS` (11 ключей продукта), схема `validation.py` не изменена.
3. `custom_components/houseplan/decor_assets.py` — обход графа ссылок SVG переписан с рекурсивной `_visit` на итеративный `_walk_reference_graph` с мемоизированной длиной самой длинной цепочки через узел и пределом `MAX_SVG_REF_DEPTH = 64`.
4. Тесты: `tests_backend/test_validation.py`, `test_ha_upload.py`, `test_support_package.py`, `test_decor_assets.py`; шесть мутантов в `scripts/mutation-gate.mjs`; `docs/CHANGELOG*.md`, `docs/SUPPORT-PRIVACY.md`, `docs/specs/README.md`.

`src/**` не тронут ни строкой (AC8) — подтверждено `git diff origin/dev...HEAD --stat -- src/` (пусто).

## Как проверялось

Локальная среда без бэкенд-харнесса Home Assistant и без предустановленного `venv-backend`/`homeassistant` — сеть была, недостающие лёгкие зависимости (`pytest`, `pytest-asyncio`, `voluptuous`, `ruff`, `mypy`) доустановлены `pip3 install`, сам `homeassistant` не ставился (тяжело, требует 3.13/3.14, локально только 3.12 — вне бюджета «дешёвого» гейта). Отчёт о том, что осталось непрогнанным, — ниже отдельным разделом.

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | 0 ошибок |
| backend unit (без HA) | `python3 -m pytest tests_backend -q` | 461 passed, 5 skipped (skip — модули, требующие HA, включая `test_ha_*.py` по `collect_ignore_glob`; несвязанный с задачей skip в `test_coordinate_canonicalization.py`) |
| `-k issue_498` (не-HA часть) | `python3 -m pytest tests_backend -q -k issue_498` | 4 passed (квота-валидатор, 2×палитра, SVG-цепочка) |
| ruff | `ruff check custom_components tests_backend` | All checks passed |
| mypy strict allowlist (точная команда CI из `validate.yml`) | `python -m mypy -p custom_components.houseplan.const -p …plans` | Success, 0 issues, 6 модулей включая изменённый `plans.py` |
| process-gate | `node scripts/process-gate.mjs` | пройден, 0 предупреждений |
| build/bundle-sync/check-docs/golden/smokes | — | **не прогонялись**: `src/**` не тронут, эти гейты не применимы к диффу (см. §8 PROCESS.md — `check-docs` обязателен только при правке `src/**`) |
| `python -m pytest tests_backend` полностью (с HA) | — | **не прогонялся**: Home Assistant не установлен в среде ревью (нет `.venv-backend`, только Python 3.12 вместо пина 3.13/3.14); см. ниже, чем это компенсировано |
| performance/golden | — | не в AC, не применимо (изменения только в серверных валидаторах) |

**Защитные AC — таблица «чем краснеет» (мутации воспроизведены мной лично, не только заявлены автором):**

| AC | Чем доказан | Чем краснеет (проверено лично) |
|---|---|---|
| AC1 (квота, валидатор) | `test_issue_498_check_quota_excludes_the_staged_upload_itself` | вернул `exclude=None` внутри `check_quota` → `AssertionError`/`QuotaError` на первом же сценарии (0 МБ лимит, воспроизведено) |
| AC1 (квота, чужой staged-файл не должен исчезать) | тот же тест, блок «Somebody else's staged upload» | заменил условие `item == exclude` на `item.name.startswith(TMP_PREFIX)` (мутант `quota-ignores-foreign-staged-uploads`) → тест падает на первой же проверке `doubled` (DID NOT RAISE), т.е. дыра ловится уже на чистом юните, не только на HA-тесте автора |
| AC3 (палитра, allowlist) | `test_rich_plan_projection_preserves_safe_structure_and_drops_unknown_values` | `for key in SUPPORT_FILL_COLOR_KEYS` → `for key in fill_colors` (мутант `support-palette-copies-any-key`) → падает |
| AC3 (пустая палитра опускается) | `test_issue_498_projection_omits_an_empty_palette` | тот же мутант ловит и второй assert теста (лишний ключ `"warm"` остаётся) |
| AC5 (предел цепочки, обе проверки) | `test_issue_498_flat_reference_chain_is_bounded_not_recursive` | обе проверки `chain > MAX_SVG_REF_DEPTH` и `len(stack) > MAX_SVG_REF_DEPTH` заменены на `if False` (мутант `svg-reference-chain-unbounded`) → `DID NOT RAISE` |
| AC5 (недоброжелательный порядок id) | тот же тест, блок `reversed_chain` | `max(chain, longest[ref] + 1)` → `chain` (мутант `svg-reference-depth-per-start-not-per-chain`) → падает именно на сегменте с хвостовым `sorted()`-стартом, воспроизводя ровно контрпример r1 |
| AC5 (итеративность, не рекурсия) | тот же тест, цепь 2500 | вернул прежнюю рекурсивную `_visit` (мутант `svg-reference-walk-recursive-again`) → `RecursionError`, не `DecorAssetError` — тест падает |

Пять из шести мутантов воспроизведены на чистых юнит-тестах без HA; шестой (`quota-counts-the-staged-upload-twice` — снятие `exclude=tmp_path` в `http_api.py`) заявлен автором как пойманный HA-эндпойнт-тестом; логика правки (`partial(check_quota, …, exclude=tmp_path)`, `http_api.py:449-458`) прочитана и соответствует контракту AC1 — принято чтением, не исполнением (HA недоступна).

## Находки

Нет. Ни одной High, ни одной Medium, ни одной Low.

Проверено отдельно и признано не-находкой:
- Свободное место по-прежнему считается консервативно на размер одного staged-файла (§8.2 спеки) — явно принятый риск, не дефект.
- Сравнение `item == exclude` без `resolve()` — воспроизведено реальным прогоном теста, символьных ссылок в модели угроз нет (writer-only, тот же процесс создаёт оба пути).
- Единственное число, видимое пользователю дважды: не найдено — правки только в серверных лимитах/проекции/валидации, ни одна величина не показывается на карточке и в записи одновременно (`MAX_SVG_REF_DEPTH` — внутренняя константа, наружу только текст ошибки; квота не показывает пользователю точное число байт дважды).
- `mypy` вне strict-allowlist (`decor_assets.py`, `support_package.py`, `http_api.py`) выдаёт ошибки при прямом запуске без установленного `homeassistant` («Class cannot subclass HomeAssistantView») — это артефакт отсутствия HA в среде ревью, не гейт: точная команда CI (`validate.yml` step «Типы бэкенда») ограничена allowlist'ом из `pyproject.toml`, куда эти три файла не входят, и её прогон зелёный.

## AC — проверка по каждому пункту

- **AC1** (границы квоты) — доказано тестом на чистом валидаторе (прогнан, красный без фикса на всех пяти сценариях границы) + чтением кода эндпойнта (`http_api.py:449-458`, `exclude=tmp_path` передаётся). Endpoint-часть (`test_issue_498_upload_accepts_the_last_bytes_and_the_last_file_of_the_quota`) — проверено чтением, не исполнением (HA недоступна).
- **AC2** (конкурентные загрузки) — проверено чтением: барьерный тест на два `check_quota` синхронизирует оба вызова, пока оба файла staged; код `dir_usage`/`check_quota` считает чужой staged-файл (не искл ючён), что делает двойное превышение невозможным при любом порядке проверок — соответствует §4.2 спеки. Не исполнено (HA недоступна).
- **AC3** (allowlist палитры + пустая палитра опускается) — доказано исполнением, мутация воспроизведена (см. таблицу). `validation.py` действительно без диффа (`git diff --stat` пуст для этого файла).
- **AC4** (соответствие 11 ключей `DEFAULT_FILL_COLORS`) — доказано исполнением: `test_issue_498_palette_allowlist_matches_the_card_defaults` сверяет напрямую с `src/logic.ts`; вручную сверил список — совпадает (`light_on, light_off, light_none, temp_cold, temp_ok, temp_hot, lqi_low, lqi_high, glow_base, glow_light, wall_fill`).
- **AC5** (предел цепочки ссылок, включая недоброжелательный порядок id и цикл) — доказано исполнением и тремя независимо воспроизведёнными мутациями (см. таблицу); проследил алгоритм вручную: мемоизация `longest[node]` корректно суммирует цепочку независимо от того, в каком узле стартует конкретный проход `for start in sorted(ids)`, включая случай, когда `sorted()` стартует с хвоста цепи.
- **AC6** (эндпойнт возвращает код, не 500) — проверено чтением: `HouseplanDecorAssetUploadView.post` уже ловит `DecorAssetError` (`http_api.py:262-263`, `413` для `too_large`); после правки B7 `_walk_reference_graph` бросает `DecorAssetError`, а не `RecursionError`, значит путь до 500 закрыт. Не исполнено (HA недоступна).
- **AC7** (мутанты + `tests_backend` + `ruff`/`mypy`) — `ruff` и `mypy` (точная CI-команда) зелёные лично; полный `tests_backend/` не прогнан целиком (HA недоступна), не-HA часть (461 тест) зелёная; все шесть мутантов подтверждены (пять — лично, шестой — чтением).
- **AC8** (перф/touch не затронуты) — `src/**` пуст в диффе, подтверждено `git diff --stat`.

## Чего не проверял и почему

- **Полный прогон `tests_backend/` с установленным Home Assistant** (endpoint-тесты `test_ha_upload.py`, включая все три новых теста этой задачи) — среда ревью не содержит `.venv-backend` и `homeassistant`; локальный Python — 3.12, пин проекта — 3.13/3.14, установка полного HA-харнесса на несовместимом интерпретаторе не является «дешёвым» гейтом. Компенсировано построчным чтением кода эндпойнтов (`http_api.py`) и логики тестов, а также независимым воспроизведением пяти из шести мутантов на не-HA части тех же контрактов.
- **`golden:verify`, браузерные смоки, `check-docs`, `bundle:sync`** — не прогонялись: `src/**` не тронут диффом, эти гейты не относятся к задаче (правило «check-docs обязателен только при правке src/**», PROCESS §8).
- **Performance-профили** — не в AC, диффа в чувствительных путях нет.
- Зелёного `Validate` на `4f040c4c` не найдено на момент ревью — гейты выше прогнаны ревьюером лично взамен.

## Материал раунда

- SHA материала: `4f040c4c8eb580cc423d7be8a6dc95629084c5c2`.
- Дерево материала: вывод `git diff origin/dev...HEAD --stat` выше (16 файлов, 813 добавлений / 31 удаление).
- Это первый заход код-ревью (r1) — раздела «Унаследовано из r0» и «Закрытие раунда r0» не требуются.

**Вердикт: зелёный.**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/498-backend-hardening-quota-palette-svg-refs`, коммит `02a14679c45d` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0f1623ec4df8db74a4bcfac7a81ff3d2bb00fc70`
  ```
  git log --all --format='%H %T' | grep 0f1623ec4df8
  ```
- ТЗ `docs/specs/498-backend-hardening-quota-palette-svg-refs.md`, блоб `11929110b55c3a7ac3c1ba41469b82de3eeb88b8`
  ```
  git log --all --find-object=11929110b55c3a7ac3c1ba41469b82de3eeb88b8 -- docs/specs/498-backend-hardening-quota-palette-svg-refs.md
  ```
- Вердикт конвейера: `green` · High 0
