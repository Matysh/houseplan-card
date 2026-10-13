# CODE-REVIEW-877-r1

Issue: #877 · трек: show · заход r1 · блокирующих циклов использовано 0 из 2
Материал: `5314361eb834194304ef586da6b76af91c94fc59` (рабочая копия на этом SHA,
`git merge-base origin/dev HEAD` = `7d72fc4bf1ea67a8c643b8f5a0c842cca19857d3`,
dev впереди на 1 коммит, слияние чистое — ветка не ребейзилась, трек show).

## Скоуп

Мастер повторной установки (`custom_components/houseplan/config_flow.py`,
`previous_data.py`) больше не показывает «Previous installation found», когда
прежняя модель достоверно без пространств (0 `spaces`, независимо от маркеров
и наличия config-файла), а layout-хранилище не содержит незавершённой парной
записи (`optimize_pending`). После подтверждения финальной формы набор уходит
в архив — тем же путём, что и «Начать с чистого листа». Решение владельца
2026-10-13 зафиксировано в теле issue; трек show подтверждён автором (одна
поверхность, без миграции/i18n/perf/touch).

Закрывает J4/J6 (`docs/SCOPE.md`): убирает лишний шаг мастера установки для
пустой предыдущей модели, не добавляя нового поведения вне описанного
«Start fresh».

## Риск по изменённым участкам (#707/#726)

Промпт отдельно поднял `store.py:18` (новый импорт `OPTIMIZE_PENDING`) и
`store.py:158` (удалённое определение) как потенциальный класс `migration`.
Проверено:

- Это чистый перенос строковой константы `"optimize_pending"` из `store.py`
  в `const.py`; `store.py` импортирует её и реэкспортирует — `store.OPTIMIZE_PENDING`
  и `from .store import OPTIMIZE_PENDING as _OPTIMIZE_PENDING` в
  `websocket_api.py:103-108` продолжают резолвиться без изменений (грепом
  проверено — других мест импорта константы нет).
- Сам ключ `optimize_pending` — не новое поле: он документирован в
  `docs/CONFIG-COMPATIBILITY.md` § «Crash-resumable config/layout pairs (#491)»
  как «durable authority for every paired config/layout write»; этот диф не
  меняет его формат, не трогает `STORAGE_VERSION`/`STORAGE_MINOR_VERSION`, не
  добавляет персистентных полей — только новое read-only чтение существующего
  поля в `previous_data.py`.
- Причина переноса — тоже документирована: `previous_data.py` обязан
  импортироваться без Home Assistant (`tests_backend/test_backend_quality.py`
  #436, функция `_ha_dependent_backend_modules`/`_needs_home_assistant`);
  `store.py` тянет `homeassistant.helpers.storage.Store` и раньше делал
  `previous_data.py` транзитивно HA-зависимым, если бы константа осталась там.

Критерий `migration` пройден — задокументировано, обоснование и источник
названы. Остальные критерии §5 тоже пройдены и подтверждены документом:
`complexity` (3/10 ценность, 2/10 сложность — оценка автора в ТЗ, не оспорена
чтением кода), `surfaces` (один модуль-пара + один шаг мастера),
`ux-contract` (переиспользует уже описанный путь «Start fresh», никакой новой
формулировки диалога — `docs/USER-GUIDE.ru.md`/`.md` обновлены тем же
коммитом), `perf-touch` (один разовый разбор JSON в мастере установки, не на
горячем пути, не touch), `undocumented` (ожидаемое поведение зафиксировано в
теле issue, `docs/USER-GUIDE.{ru.,}md`, `docs/ARCHITECTURE.md`,
`docs/STATUS.md`). **route: fix** — реклассификация не требуется.

## Как проверялось

Статический разбор диффа (`git diff origin/dev...HEAD`, 14 файлов) построчно:
`config_flow.py`, `const.py`, `previous_data.py`, `store.py`, тесты backend,
`mutation-registry.mjs`, доки и release-ledger.

Прочитано и прослежено чтением (без исполнения отдельно, где не требовалось):
- `inspect_previous_data()` (previous_data.py:152-166): `spaces = None if
  unsafe else _spaces(...)`; `empty = spaces == 0 and _layout_settled(...)`.
  Короткое замыкание `and` подтверждено тестом
  `test_layout_read_only_without_spaces` (монкипатч `Path.open`, проверяет, что
  layout не читается, пока `spaces != 0`).
- `_layout_settled()` (previous_data.py:139-149): нет файла → settled=True;
  нечитаемый JSON/не-dict envelope → False; `data` не dict → False;
  `OPTIMIZE_PENDING in data` → False. Версия layout-стора сознательно не
  проверяется — ТЗ требует только читаемости JSON-объекта с `data`, версия
  здесь ни на что не влияет (ключ не версионирован отдельно от общей схемы).
- `config_flow.async_step_user()` (config_flow.py:40-45): `found and empty` →
  `_start_fresh=True`, без перехода в `previous_data`; `elif found` — прежнее
  меню. Архивация — только на `user_input is not None` (подтверждение формы),
  что совпадает с «ничего не пишется до подтверждения».

Исполнено на этом SHA:
- `python3 -m pytest tests_backend/test_previous_data.py -q` → **42 passed**
  (чистые тесты без HA; окружение ревью не имеет `homeassistant`, поставить
  негде — см. «Чего не проверял»).
- `python3 -m ruff check custom_components/houseplan tests_backend` →
  **All checks passed!**
- Сверка job'а CI на материале: `gh run view 38420851525` → `headSha` =
  `5314361e...` (точное совпадение с материалом), job **«Бэкенд: pytest в
  Home Assistant»: success** — это и есть прогон `test_ha_config_flow.py` с
  реальным HA harness, которого нет в песочнице ревью; задача зелёная именно
  на материале, не на более новом коммите.

## Таблица защитных AC (§2.7)

| AC | Чем доказан (тест, исполнение) | Чем краснеет (мутант реестра) |
|---|---|---|
| AC1 — без пространств, без меню, финал как Start fresh | `test_spaceless_starts_fresh_without_menu` (3 варианта: markers/no-markers/no-config), `test_spaceless_cancel_changes_nothing`, `test_spaceless_archive_failure_never_creates_entry`, unit `test_spaceless_is_empty` — все зелёные в CI-прогоне на материале | `reinstall-skip-keeps-spaceless-set` (меню пропущено без `_start_fresh`), `reinstall-empty-ignores-space-count`, `reinstall-empty-trusts-unknown-config` |
| AC2 — есть пространство → меню как раньше | `test_previous_data_menu`, `test_restore_previous_data`, `test_start_fresh` (параметризованы markers/no-markers), unit `test_one_space_is_not_empty` | `reinstall-empty-ignores-space-count` (тот же мутант ловит и эту сторону — `spaces is not None` вместо `== 0`) |
| AC3 — неизвестное/pending ≠ пустое, меню остаётся | `test_unknown_previous_data_keeps_menu` (6 кейсов), unit `test_unknown_is_not_empty`, `test_unsafe_is_not_empty` | `reinstall-empty-trusts-unknown-config`, `reinstall-empty-ignores-pending-pair`, `reinstall-empty-trusts-broken-layout` |

Пустых третьих столбцов нет. Мутанты не запускались (track show, #709) —
проверено только, что названия мутантов и гард-паттерны (`backend-test-guard.mjs
<pattern> <file>`) указывают на реально существующие тесты (`grep` по именам
функций в `test_ha_config_flow.py` подтвердил совпадение для всех пяти
`reinstall-*` записей).

## Находки

Нет High. Нет Medium. Нет Low.

Код соответствует ТЗ и решению владельца буквально: условие пустоты — только
`spaces == 0` (маркеры/устройства не участвуют, как и решил владелец,
заменив более раннюю формулировку «оба счётчика» из тела issue); отсутствие
config-файла трактуется как 0 пространств (как решил владелец отдельным
комментарием); `optimize_pending` в layout блокирует пропуск шага даже при
битой структуре (строже `_pending_target` в `store.py`, в безопасную
сторону — риск явно назван автором в хендоффе). Discovery остаётся read-only
до подтверждения формы — проверено и тестами, и чтением (нет вызовов
`Store`/записи в `inspect_previous_data`, `archive_previous_data` вызывается
только после `user_input is not None`).

Трейлеры: `f82dbb7d` — `Issue: #877`, `User-Visible: yes`, оба changelog
(`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правятся тем же коммитом.
`5314361e` — `Issue: #877`, `User-Visible: no`, docs-only (release-ledger).
Оба корректны.

Один показатель, видимый пользователю, в диффе не прибавляется — только
решение «показывать/не показывать» уже существующий шаг; дублирующихся чисел
нет (§8).

Release-ledger `docs/release-ledger/v1.80.1/877.json`: `stable-fix` против
`v1.80.1`, обоснование — v1.80.1 уже несёт шаг #820 и задаёт лишний вопрос;
это убирает его, не добавляя модели/миграции/фичи. Классификация верна:
правка существующего стабильного поведения, не новая бета-функция, `introducedBy`
не требуется.

## Что проверено и корректно

- Логика `empty` (previous_data.py) — читает только существующие
  задокументированные поля, короткое замыкание подтверждено тестом,
  версионная проверка layout сознательно не делается и это соответствует ТЗ.
- `config_flow.py` — пропуск меню и архивация только на финальном
  подтверждении; отмена до подтверждения ничего не пишет (тест
  `test_spaceless_cancel_changes_nothing`); ошибка переноса — `archive_failed`,
  запись не создаётся.
- Перенос `OPTIMIZE_PENDING` в `const.py` не меняет поведения, реэкспорт из
  `store.py` сохраняет все существующие импорты рабочими; подтверждено
  grep'ом по всем использованиям и зелёным `ruff`.
- Changelog (RU+EN), USER-GUIDE (RU+EN), ARCHITECTURE.md, STATUS.md, release-ledger
  обновлены тем же изменением, терминология («Start fresh», «Previous
  installation found») не изобретена — взята из уже существующих разделов тех
  же документов.
- Тесты покрывают все три AC, включая параметризацию markers/no-markers/
  no-config и граничные случаи («нет данных», «только архив» — регрессия
  усилена новыми ассертами о неизменности архива).

## Чего не проверял

- Не прогонял полный `pytest tests_backend/` с Home Assistant harness —
  в песочнице ревью нет пакета `homeassistant`/`pytest-homeassistant-custom-component`,
  поставить негде (нет `.venv-backend`, сеть ограничена для тяжёлых пакетов
  HA). Вместо этого сверил: `gh run view 38420851525` — тот же SHA материала,
  job «Бэкенд: pytest в Home Assistant» зелёный. Это прогон именно
  `test_ha_config_flow.py` (где и живут AC1/AC2/AC3-сценарии мастера), а не
  более новый коммит.
- Не прогонял `npx tsc --noEmit`, `npm test`, `npm run build` — фронтенд не
  тронут, Validate на материале уже зелёный (та же ссылка), дифф —
  Python+docs+тесты+реестр мутантов, фронтенд-гейты к нему неприменимы.
- Не запускал мутанты реестра (трек show, #709) — только сверил названия
  гард-тестов с реально существующими функциями в `test_ha_config_flow.py`.
- Не запускал смоки/golden/invariants/performance — дифф не трогает рендер,
  геометрию, canvas, touch; `smoke-select.mjs` не применим (нет исполняемого
  frontend-диффа, как и указал автор в хендоффе); в AC эти гейты не названы.
- Реальный мастер HA в браузере не открывал — то же ограничение окружения,
  что и у автора; полагаюсь на pytest-харнесс (зелёный в CI на материале) как
  эквивалентное доказательство поведения конфиг-флоу.

## Вердикт

Зелёный. AC1–AC3 доказаны исполнением тестов на материале (CI job на точном
SHA) и подтверждены независимым чтением логики; защитные AC закрыты
мутантами реестра с названными гард-тестами; трейлеры, changelog и
release-ledger корректны; риск по участку `store.py` (класс `migration`)
разобран и подтверждён документом CONFIG-COMPATIBILITY.md — реклассификация
не нужна.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/877-no-spaces-fresh-install`, коммит `5314361eb834` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `9fbaafcfb690cb43a135a1eb5b4bfa9eef7d0f5c`
  ```
  git log --all --format='%H %T' | grep 9fbaafcfb690
  ```
- Тело issue: `63a270980e39a03f43642be1b305c35af758367178386facd39ede0d1d15947c`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ4MjMsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0OTEzfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo1NCwib3V0cHV0X3Rva2VucyI6MjQ4MTgsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTA1NTcyLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MjU1MzI1MywiY29zdFVzZEVzdGltYXRlIjoxLjE4MTIyNjZ9XSwidHVybnMiOjM5LCJkdXJhdGlvbk1zIjoyOTY1MTIsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjE4NjEzOTYsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4877 output_tokens=24836 cache_creation_input_tokens=105572 cache_read_input_tokens=2553253 num_turns=39 -->
