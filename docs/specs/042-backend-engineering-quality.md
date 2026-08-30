# ТЗ #42 — Измеряемое инженерное качество backend

- Issue: https://github.com/Matysh/houseplan-card/issues/42
- Приоритет: P2, tests/tech-debt; полный трек (backend class A + видимое
  поведение ошибок — решение аналитики 2026-08-15)
- Ревизия: 4 (2026-08-30) — по SPEC-REVIEW-42-r2 (M1-хвост в AC5); механизм +
  ступень baseline, пороги — последующие trivial
- Тип: infra/tests + один видимый пользователю блок (тексты ошибок)

## Замеры ревизии (HEAD, песочница)

Pure-coverage 89.1% (2377/258); HA-модули (~1.5К stmts, включая
import_export 1065) измеримы только в CI. Ruff E,F,B,I: 333 (E501 — 291,
содержательных 42). Ни одного requirements/pyproject в репо; зависимости
бэкенд-CI — строка в validate.yml + зеркало в mutation-gate.yml. WS-коды
де-факто стабильны и фронт мапит по code (`backup.error.<code>`, 26 ключей
en/ru); дыры: сырой английский message в fallback и regex-парсинг message у
`invalid_passage_fields`/`invalid_partition_opening_jamb_margin`.

## Сценарий

Разработчик ломает покрытие или типы бэкенда — CI краснеет с конкретным
модулем и числом. Пользователь получает ошибку от бэкенда — видит
локализованный текст по стабильному коду; неизвестный код даёт общий
локализованный fallback с кодом, а не сырую английскую фразу.

## Что человек увидит до и после

Почти ничего: единственная видимая часть — тексты редких ошибок. **До**:
неизвестная ошибка = английская message; два кода парсятся regex'ом из
английской строки. **После**: локализованный fallback с кодом; structured
JSON-details. Всё остальное — инженерные гейты.

## Скоуп (одна ступень, пять блоков)

### 1. Tooling-фундамент

`pyproject.toml` (первый в репо): метаданные не нужны — только конфиг
инструментов. Зависимости бэкенд-теста выносятся в
`requirements_test.txt` (pinned); validate.yml и зеркало в mutation-gate.yml
ставят из него (одна точка правды вместо двух строк).

### 2. Lint (ruff, narrow)

Конфиг в pyproject: `select = ["E", "F", "B", "I"]`,
`ignore = ["E501"]` (291 длинная строка — НЕ переписываются: «без массового
rewrite»), target py313. Чинятся 42 содержательных нарушения: I001/F401/
F841/E731/B905 — механически; **B023 (×17, loop-var в замыкании) — каждый
случай разбирается отдельно**: реальная гонка → фикс с юнитом, доказанная
синхронность → `# noqa: B023` с причиной в комментарии. CI-джоба
`ruff check custom_components/houseplan` в validate.yml (backend).

### 3. Typing (mypy strict, растущий allowlist)

`[tool.mypy]` per-module: strict для стартового списка достижимых
pure-модулей — `const`, `projection`, `coordinate_canonicalization`,
`frontend_asset_manifest`, `junction_limits`, `plans` (+ те из
`validation`/`wall_segment_model`/`geometry_migration`, что пройдут без
каскадного рефакторинга — финальный список фиксируется по факту зелени и
называется в handoff). Список strict-модулей может только РАСТИ —
контракт-тест сравнивает конфиг с committed-списком и падает при удалении.
HA-boundary модули (websocket/http/store/repairs/…) — вне ступени (нужны
stubs HA, CI-итерации) — следующая ступень, зафиксировано здесь.

### 4. Coverage (механизм + baseline-гейт)

- validate.yml backend: pytest → `--cov=custom_components/houseplan
  --cov-branch --cov-report=xml --cov-report=term`; артефакт coverage.xml.
- `scripts/backend-coverage-baseline.txt` — одно число (стартовое =
  фактический общий % CI-прогона pure+harness, снимается первым прогоном
  ветки); шаг CI сравнивает: ниже baseline − 0.1 п.п. → красный.
- Защита от тихого скипа harness: шаг до pytest — `python -c "import
  homeassistant"` + после collect: количество собранных
  `tests_backend/test_ha_*` ≥ 50, иначе красный.
- Пороги 90% → 95%: последующие trivial-issues, меняющие ОДНО число в
  baseline-файле (механизм этой ступени их уже enforce'ит). Приёмка issue
  «≥95%» достигается той лестницей; данная ступень сдаёт механизм +
  «не ниже baseline», и это отражено в квалификации quality_scale
  (test-coverage остаётся `todo` с прогресс-ссылкой).

### 5. WS error contract + доки

- `const.py`: `ERROR_CODES` (frozenset фиксированных кодов) +
  `ERROR_CODE_FAMILIES` (префиксы шаблонных). Контракт-тест (pure, скан
  исходников) обязан покрыть ОБА пути эмиссии (M1 r1):
  (а) литералы `send_error(..., "<code>", ...)` в websocket_api;
  (б) коды, читаемые из `err.code` в обработчиках — их источники
  перечисляются явно и сканируются по месту объявления:
  `OpeningPassageError`, `PartitionOpeningHostError`,
  `PartitionOpeningJambMarginError`, `WallModelClientOutdatedError`
  (validation.py, литеральный class-attr `code = "..."` — извлекается
  regex'ом), `JunctionLimitError` (junction_limits.py,
  `f"junction_limit_{rule}"` — семейство `junction_limit_` по списку
  rules), `MarkerControlError` (префиксные коды `value_badge_*` /
  `value_source_*` — семейства). Каждый фиксированный код ∈ ERROR_CODES и
  имеет en-ключ `backup.error.<code>`; каждое семейство ∈
  ERROR_CODE_FAMILIES и обслуживается либо своим family-ключом, либо
  задокументированным общим fallback по коду — тест требует одно из двух.
  Появление в источниках кода/класса вне обоих списков → красный.
- Structured details: `invalid_passage_fields` и
  `invalid_partition_opening_jamb_margin` шлют message
  JSON-строкой (`{"space":…,"opening":…,"fields":…}`); фронт парсит
  JSON.parse с fallback на прежний regex (совместимость со старым бэкендом
  одной беты). Regex-ветка помечена deprecated-комментарием с датой
  удаления.
- Fallback `_errText` (M2 r1: реальная причина дефекта — ПОРЯДОК проверок,
  `e.message` раньше кода): порядок меняется на code-first; неизвестный код
  использует СУЩЕСТВУЮЩИЙ ключ `err.unknown`/`err.code` (уже переведён
  en/ru/de/fr) — новых i18n-ключей этот блок не вводит; сырой английский
  `e.message` в UI не показывается (уходит в console.warn).
- Доки: USER-GUIDE.ru получает паритетный §Troubleshooting (перевод §22);
  quality_scale.yaml: `docs-troubleshooting` → done,
  `docs-examples` → done ТОЛЬКО если текст HA-правила фактически
  удовлетворён существующими YAML-примерами гайда (проверка по тексту
  правила; иначе остаётся todo с причиной); `strict-typing` — остаётся
  todo с прогрессом (ступень).

## Не-скоуп (следующая ступень, зафиксировано)

Strict typing HA-boundary модулей; пороги coverage 90/95; формат-проверка
всего репо; массовая нормализация E501; перевод остальных секций гайдов.

## i18n

Новых ключей НЕТ: неизвестные коды переиспользуют существующие
`err.unknown`/`err.code` (переведены во всех 4 словарях); известные коды —
существующее пространство `backup.error.<code>`. Если реализация family-ключей
(блок 5) потребует 1–2 новых ключа — они добавляются во все 4 словаря и
называются в handoff (паритет-гейт словарей ловит пропуск).

## Контракт поведения

Tooling не меняет stored data и успешные пользовательские сценарии.
Единственное видимое изменение — тексты ошибок (блок 5): коды и структура
ответов бэкенда с существующими кодами НЕ меняются (message двух кодов
меняет ФОРМАТ на JSON — фронт совместим в обе стороны одну бету).

## Критерии приёмки

- **AC1** (CI): джоба backend публикует coverage.xml + summary; подмена
  baseline на большее число → красный шаг (доказательство прогоном ветки).
- **AC2** (CI): удаление homeassistant из шага установки или фильтр
  test_ha_* → красный ещё до pytest / на collect-пороге.
- **AC3** (локально): `ruff check` чист на выбранном наборе; каждый
  `noqa: B023` несёт объяснение (контракт-тест: noqa без текста запрещён).
- **AC4** (локально): mypy strict зелёный на стартовом allowlist;
  контракт-тест падает при СУЖЕНИИ списка.
- **AC5** (юнит): контракт-тест реализует норматив блока 5 ЦЕЛИКОМ — оба
  пути эмиссии: (а) литералы `send_error` и (б) перечисленные
  err.code-источники (четыре validation-класса, `JunctionLimitError`,
  `MarkerControlError`); каждый фиксированный код ∈ ERROR_CODES с en-ключом
  `backup.error.<code>`, каждое семейство ∈ ERROR_CODE_FAMILIES с
  family-ключом либо задокументированным fallback; источник вне перечня →
  красный. В частности `invalid_passage_fields` и
  `invalid_partition_opening_jamb_margin` обязаны быть доказаны тестом.
- **AC6** (юнит фронта): JSON-message двух кодов парсится в structured
  details; старый regex-формат по-прежнему принимается; неизвестный код →
  локализованный fallback, английский message не попадает в DOM.
- **AC7**: полный гейт; pytest 240/0 pure; бюджет ≈ без изменений (фронт
  меняет только обработку ошибок).

## План автотестов

- Юниты фронта: AC6 (парсер details + fallback) — test/logic или
  error-текст тесты.
- Pure-pytest: AC5-скан; существующие 240 не слабеют.
- Контракт-тесты: AC3-noqa, AC4-allowlist (читают pyproject/исходники).
- Мутанты: м1 — удалить код из ERROR_CODES → красный AC5;
  м1b — убрать один err.code-источник из перечня сканера (например
  `PartitionOpeningJambMarginError`) → красный AC5 (ветка (б) доказана);
  м2 — вернуть regex-first парсинг (сломать JSON-ветку) → красный AC6.
- CI-доказательства AC1/AC2 — прогоном ветки, фиксируются в handoff.

## Риски

- B023-фиксы — единственные поведенческие: каждый со своим юнитом или
  обоснованным noqa.
- Python 3.10 (песочница) vs 3.13 (CI): ruff/mypy конфиг target 3.13,
  локальная проверка на 3.10 — синтаксис кода уже совместим.
- JSON-message: старый фронт с новым бэком увидит JSON-строку в сыром
  fallback → в пределах одной беты допустимо (пары версий фронт/бэк
  обновляются вместе HACS'ом); отмечено в ченджлоге.

## Откат

`git revert`: конфиги/гейты исчезают, коды ошибок не менялись, формат
message двух кодов возвращается — фронт совместим (regex-ветка ещё жива).
Потери данных нет.

**DoR-примечания:** миграция/compatibility — только формат message двух
кодов (двусторонняя совместимость на бету); touch — не влияет;
производительность — не влияет (test/CI-time).

## Release-артефакты

- CHANGELOG×2: user-visible коротко (локализованный fallback ошибок),
  остальное — инженерная запись.
- docs/ARCHITECTURE.md: раздел «Backend quality gates» (coverage baseline,
  ruff, mypy allowlist, ERROR_CODES) со ссылками.
- USER-GUIDE.ru §Troubleshooting.

## Принятые предположения

- Baseline-число снимается ПЕРВЫМ CI-прогоном ветки и коммитится в неё же
  до S7 (ревьюер видит фактическое значение).
- `backup.error.<code>` — существующее пространство ключей для всех
  WS-ошибок (не только бэкапов) — так уже используется фронтом; переименование
  пространства — вне скоупа.
- Формат JSON-details фиксируется этим ТЗ как контракт двух кодов; общий
  механизм details для ВСЕХ кодов — следующая ступень при необходимости.
