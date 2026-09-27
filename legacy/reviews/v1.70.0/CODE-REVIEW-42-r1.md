# CODE-REVIEW-42-r1

- Issue: https://github.com/Matysh/houseplan-card/issues/42
- ТЗ: docs/specs/042-backend-engineering-quality.md, ревизия 6 (принята арбитражем владельца после исчерпания бюджета SPEC-REVIEW, 4/4)
- Диапазон материала: `origin/dev..HEAD`, HEAD = `ab337193abb8c629322313a0bf2d747105942db4`
- Коммиты: `313dfd07` (feat, User-Visible: yes) · `ffe8c3d1` (test) · `cfa8b5af` (test) · `ab337193` (build: bundle sync)
- Заход код-ревью: **r1**, блокирующих циклов израсходовано **0 из 4** до этого вердикта
- Трейлеры: у всех 4 коммитов корректны (`Issue: #42`, `User-Visible: yes|no`); `User-Visible: yes` на `313dfd07` сопровождён правками обоих changelog в том же коммите — выполнено.

## Скоуп

Полный трек (не `small`), диапазон затрагивает класс A (`custom_components/houseplan/**/*.py`, `src/houseplan-card.ts`, `src/i18n/*.json`), класс B (`.github/workflows/validate.yml`, `.github/workflows/mutation-gate.yml`, `scripts/mutation-gate.mjs`, `test/**`, `tests_backend/**`, `pyproject.toml`, `requirements_test.txt`), класс C (`docs/**`) и класс D (`dist/**`, `custom_components/houseplan/frontend/**`, коммит `ab337193` — bundle-sync после `feat`, по правилу класса D корректен). Первый код-ревью раунда — разбор полный по всем пяти блокам ТЗ, дельта по спецификации (§2.10) здесь неприменима: это код-ревью, а не повторный спек-раунд.

## Как проверялось

Зелёного Validate на HEAD (`ab337193`) не существует — оба прогона CI на этой ветке (`33316584357`, `33316653216`) красные на **фронтенд-** и **бэкенд-**джобах. Прогнал дешёвые гейты сам и независимо воспроизвёл обе причины красноты локально (см. таблицу и находки High).

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | чисто |
| Frontend unit | `npm test` | **1636/0**, 1 skipped — совпадает с хендоффом |
| Build + bundle sync | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | совпадает байт-в-байт |
| Bundle budget | `npm run bundle:budget` | 282 738 / 300 000 B gzip — совпадает с хендоффом |
| no-new-any | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | **КРАСНЫЙ** — см. Finding H1 |
| check-docs (src/** тронут) | `node scripts/check-docs.mjs` | чисто (7 файлов, 10 внешних ссылок) |
| i18n паритет | скрипт сверки ключей en/ru/de/fr | 22/22/22/22 добавленных ключа идентичны по имени во всех 4 словарях |
| Backend install (как в CI) | `pip install -r requirements_test.txt` в чистом venv | **КРАСНЫЙ** — воспроизведено независимо от CI, см. Finding H2 |
| Backend pure pytest (изолированный venv без застрявшего requirements_test.txt) | `pytest tests_backend/test_backend_quality.py -q` | 3/3 пройдено |
| — то же, `test_validation.py` | `pytest tests_backend/test_validation.py -q` | 142 passed, 1 skipped |
| ruff (узкий набор, установлен вручную вне сломанного requirements_test.txt) | `ruff check custom_components/houseplan --config pyproject.toml` | «All checks passed!» |
| mypy strict (6 модулей allowlist) | `mypy -p const -p projection -p coordinate_canonicalization -p frontend_asset_manifest -p junction_limits -p plans` | «Success: no issues found in 6 source files» |
| Мутанты AC5 (ручная проверка m1c) | удалил `invalid_light_entity` из `ERROR_CODES`, перезапустил `test_backend_quality.py` | тест **упал** ожидаемо, затем восстановлено (`git status` чист) |
| smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «НЕОПРЕДЕЛЁННОСТЬ»: диф трогает 1 файл `src/**`, единственный широкий символ `_serverCfg` — ни один смок не привязан доказуемо. Решение: не гонять смоки — AC6 покрыт юнитом, поведение `_errText` не имеет отдельного визуального следа |
| golden / performance / полный HA-harness | — | не гонялись: не изменяют визуал/перф; предрелizный гейт (§8) |
| `python -m pytest tests_backend -q` (полный, с HA) | — | невозможно в песочнице — `homeassistant` не установлен, `.venv-backend` отсутствует (см. AGENTS.md «Backend»); эквивалент — независимая проверка через изолированный venv + чтение кода |

## Находки

### High H1 — `no-new-any` красный на HEAD: новый необоснованный `any`

`src/houseplan-card.ts:9743` (добавлено `313dfd07`):

```ts
const space = this._serverCfg?.spaces?.find((item: any) => String(item.id) === spaceId);
```

`_serverCfg` типизирован (`ServerConfig`), и везде рядом `spaces` используется без нового `any` (`this._serverCfg?.spaces || []`, `.spaces.length` и т.д. — уже типизированный массив). Аннотация `: any` здесь не обоснована ни отсутствием типа, ни комментарием `// any-ok: …`. Гейт `scripts/no-new-any.mjs` (обязательная часть локального набора, §8) красный и на CI (job «Фронтенд: типы, юниты, мутанты, синхрон бандла», оба прогона ветки), и локально — воспроизведено дословно тем же выводом.

Чинится в скоупе: убрать `: any` (тип элемента `spaces` выводится сам) либо использовать точный тип элемента.

### High H2 — `requirements_test.txt` невозможно установить: бэкенд-CI не работал ни разу

`requirements_test.txt` пинует одновременно:
```
pytest==9.1.1
pytest-homeassistant-custom-component==0.13.45
pytest-cov==7.1.0
```
но `pytest-homeassistant-custom-component==0.13.45` сам жёстко требует `pytest==7.3.1` и `pytest-cov==3.0.0` (проверено чтением METADATA пакета). Это неразрешимый конфликт версий, а не транзиентная сетевая ошибка:

- воспроизведено в CI дважды подряд, на обоих прогонах ветки (`30f45e53`, `ab337193`): `pip install -r requirements_test.txt` → `ResolutionImpossible`;
- воспроизведено независимо в чистом sandbox-venv (не CI-окружение) той же командой — идентичная ошибка.

Это ровно Блок 1 ТЗ («requirements_test.txt — единая точка правды зависимостей»), и он ломает **весь** бэкенд-джоб CI: до `pytest` дело не доходит вообще — ни ruff-шаг, ни guard тихого скипа harness, ни сам pytest с `--cov`, ни сравнение с baseline. Следствия:
- **AC1** (coverage.xml + сравнение с baseline) не доказан прогоном ветки, как того явно требует сама формулировка AC1 — прогона просто не было ни разу;
- **AC2** (защита от тихого скипа harness) не доказан по той же причине;
- `scripts/backend-coverage-baseline.txt` остаётся плейсхолдером **`80.0`**, который автор в хендоффе прямо назвал заглушкой и обещал заменить «после зелёного CI» — зелёного CI не случилось, обещание не выполнено, а нормативный текст ТЗ (раздел «Принятые предположения») требует закоммитить фактическое число до код-ревью;
- заявление хендоффа «pytest pure 243/0» не могло быть получено прогоном именно этого `requirements_test.txt` (независимо перепроверено: сборка зависимостей по этому файлу невозможна в принципе, а не «медленная» или «требует HA»); откуда взято число — не сказано, и с той же командой из ТЗ оно не воспроизводится;
- зеркало в `.github/workflows/mutation-gate.yml:67` ставит зависимости той же командой — мутационный гейт по Python-гвардам (`error-code-dropped-from-contract`, `error-scanner-loses-a-class-source`, `error-code-via-variable-dropped`) в CI тоже не может выполниться.

Логика самих CI-шагов (сравнение с baseline, порог `≥50` для `test_ha_*`, upload артефакта) прочитана и выглядит корректной — проблема ровно в пиннинге зависимостей, не в механизме.

Чинится в скоупе: привести `requirements_test.txt` к разрешимому набору (например, снять собственный пин `pytest-cov`/`pytest` до версий, совместимых с `pytest-homeassistant-custom-component==0.13.45`, либо поднять `pytest-homeassistant-custom-component` до версии, допускающей `pytest-cov==7.1.0` — выбор версии `оставлен` автору), прогнать реальный CI на итоговом коммите и закоммитить фактический baseline до повторного ревью.

## Проверено и корректно

- **Блок 5 (WS error contract), логика сканера** — прочитан построчно и проверен исполнением в изолированном venv: `ERROR_CODES`/`ERROR_CODE_FAMILIES` (`const.py`) и сканер (`tests_backend/test_backend_quality.py`) корректно находят оба пути эмиссии — литералы `send_error`, четыре validation-класса с `code = "..."`, `JunctionLimitError` (f-string семейство), `MarkerControlError` литералами И через переменные (`source_error`/`attribute_error`, кортеж `code`). Мутант m1c (удаление `invalid_light_entity` из `ERROR_CODES`) вручную воспроизведён — тест падает с понятной ошибкой, затем код восстановлен и `git status` чист.
- **i18n**: 22 новых ключа `backup.error.*` добавлены идентично и полно во всех 4 словарях (en/ru/de/fr) — сверено скриптом, не только заявлением автора.
- **`_errText` code-first (AC6, M2 r1)**: порядок проверок в `houseplan-card.ts:9765` — код проверяется раньше `e.message`; JSON.parse первым, legacy regex — read-compat fallback с deprecated-комментарием и датой; неизвестный код рендерит `err.code`/`err.unknown`, а не сырой `e.message` (уходит в `console.warn`). Прочитано построчно, поведение соответствует тексту ТЗ блока 5.
- **mypy strict allowlist (AC4)**: прогнан исполнением на всех 6 модулях — чисто. `junction_limits.py` (геометрия!) проверен построчно на предмет поведенческих изменений: диф — исключительно добавление type hints (`dict[str, Any]`, `list[float]` и т.п.), логика функций не тронута ни в одной строке — инварианты модели (`npm run model-invariants`) не требуются, т.к. геометрическое поведение не менялось (проверено чтением, не исполнением).
- **ruff narrow (AC3)**: прогнан исполнением — чисто; noqa-контракт-тест (`test_issue_42_every_noqa_carries_a_reason`) проверен — все новые `noqa: BLE001` в `websocket_api.py`/`http_api.py` несут причину ≥10 символов.
- **Structured JSON details**: `OpeningPassageError`/`PartitionOpeningJambMarginError` теперь сериализуют `json.dumps(...)`; `test_validation.py` обновлён на `json.loads(...)` и по-прежнему проверяет отсутствие утечки `binary_sensor` в сообщении; прогнан исполнением — зелёный.
- **quality_scale.yaml**: `docs-troubleshooting`/`docs-examples` → `done` — проверено, что `docs/USER-GUIDE.ru.md` уже содержит «## 22. Диагностика» **до** начала работы над #42 (введено в v1.59.0-rc.2, задолго до этого issue) — заявление хендоффа о ложном пробеле («инвентаризация грепала английское слово») подтверждено; никакой недостающей работы по документации не скрыто.
- **Changelog×2, ARCHITECTURE.md**: правки внесены в том же коммите `313dfd07`, что и поведение; описывают ровно видимое изменение (локализованные тексты ошибок).
- **Одно число — один источник**: этот дифф не вводит новую пользователем видимую величину, дублируемую в двух местах. `margin_cm`/`fields` — единственное место рендера (`_errText`), источник один (JSON от бэкенда), изменился только формат парсинга (JSON вместо regex), а не число мест вычисления. `test/single-source-numbers.test.mjs` не входит в затронутый диапазон и не требовал перепрогона.
- **Коммиты класса B** (`ffe8c3d1`, `cfa8b5af`) корректно переиспользуют `Issue: #42`, `User-Visible: no`.

## Чего не проверял и почему

- **Полный `pytest tests_backend/ -q` с реальным HA-harness** — недоступен в песочнице (`homeassistant` не установлен, `.venv-backend` отсутствует); по AGENTS.md это ожидаемо для этого окружения. Компенсировано изолированным venv для «чистых» файлов (`test_backend_quality.py`, `test_validation.py`) и чтением остального с исполнением мутанта.
- **Полный код `websocket_api.py` (925 строк) построчно** — диф в этом файле (168 строк) целиком мехнический (реордер импортов + noqa-причины); прочитан полностью, поведенческих изменений вне диффа не искал построчно по всему файлу — вне скоупа диффа.
- **Браузерные смоки** — не гонялись; `smoke-select.mjs` вернул «НЕОПРЕДЕЛЁННОСТЬ» (единственный тронутый `src`-файл, единственный широкий символ `_serverCfg`), в АС ни один смок не назван. Решение снять — риск узкий (текстовый рендер ошибки), покрыт юнитом AC6.
- **golden/performance/полный HA-harness** — предрелизные гейты (§8, §11.4), не гейт этого ревью; диф не меняет визуал/геометрию рендера.
- **`import_export.py`, `http_api.py`, `__init__.py`, `frontend_assets.py`, `trails.py`** — прочитаны целиком по своим (коротким, 1–22 строк) диффам: везде реордер импортов / удаление неиспользуемых (`F401`) / добавление причины к `noqa`, поведенческих изменений не обнаружено.

## Вердикт

**Красный.** Оба High-находки — не стилистические придирки: `no-new-any` красный на HEAD и `requirements_test.txt` невозможно установить — это ровно те «дешёвые гейты», которые обязаны быть зелёными перед выходом из «В разработке» (§8), и они не были зелёными ни разу за оба прогона CI этой ветки. Раз ревью кода отвечает на вопрос «оно вообще работает» вместо ручного тестирования — ответ по бэкенд-блоку (Блок 1/4, AC1/AC2) сейчас «не проверено ни разу», а не «работает». Оба фикса локальны и в скоупе задачи (одна аннотация типа; пересборка одного файла зависимостей), пятого повторного цикла не требуют технически, но по букве процесса должны пройти повторный код-ревью после исправления (§4).
