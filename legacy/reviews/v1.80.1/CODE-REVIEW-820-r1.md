# CODE-REVIEW-820-r1

Issue: #820 «Восстановить или архивировать данные прежней установки».
Материал: ровно `748b2f67fac7842d074b465f6aa771e597d81da9` (`origin/dev..HEAD`,
один коммит, рабочая копия уже на нём). Трек `track:ask`, заход r1,
блокирующих циклов 0/4. Маршрут вердикта: `route: fix` (на `ask` всегда `fix`).

## Скоуп

Один коммит, класс A (Python-интеграция) + B (тесты/mutation-registry) + C
(документация):

- `custom_components/houseplan/config_flow.py` — новый шаг-меню `previous_data`
  перед существующим шагом `user`.
- `custom_components/houseplan/previous_data.py` — новый модуль: read-only
  инвентаризация (N пространств, M файлов, дата) + архивирование rename'ом.
- `strings.json` + 4 `translations/*.json` (en/ru/de/fr) — новые ключи.
- `tests_backend/test_previous_data.py`, `tests_backend/test_ha_config_flow.py`
  — unit + реальный HA config-flow.
- `scripts/mutation-registry.mjs` — 4 новых мутанта (не исполнялись, см. ниже).
- `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`,
  `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`, оба `CHANGELOG`.

`src/**`, WS-контракты, runtime Store-загрузчики, схема config/layout — не
менялись (подтверждено `git diff --stat`: ни один файл `src/**` в диффе).

## Как проверялось

Ручного исполнения тестов в этом раунде не делал: на материале
`748b2f67` уже есть зелёный Validate
(https://github.com/Matysh/houseplan-card/actions/runs/37653211446,
`conclusion: success`), и в нём, помимо typecheck/`npm test`/`npm build`,
есть job **«Бэкенд: pytest в Home Assistant»**, отдельно подтверждённый
зелёным (проверил `gh run view --job` и лог):

- шаг «HA-harness присутствует» → `collected HA-harness tests: 468` (т.е.
  `test_ha_*` реально собраны `pytest --collect-only`, не исключены);
- шаг «Backend unit tests» → команда `python -m pytest tests_backend/ -q
  --cov=...` → **`1102 passed, 1 skipped in 37.18s`**, без единой строки
  `ERROR`/`ImportError` в логе — совпадает с цифрой, которую автор назвал в
  хендоффе;
- coverage 89.2% ≥ baseline 87.2% — отдельный шаг-гейт, зелёный.

Это не pure-run с выброшенными `test_ha_*` (критерий из промпта и
`docs/TESTING.md`): HA-harness тесты реально в выборке и реально пройдены на
материале этого SHA. Дешёвые гейты (typecheck/test/build) этим же Validate
подтверждены и не перегонялись мной отдельно — условие
«Дешёвые гейты на этом SHA уже подтверждены» выполнено документально, не на
слово автора.

Дальше — чтение кода построчно: `previous_data.py` (209 строк) и
`config_flow.py` (67 изменённых строк) разобраны полностью против каждого AC
и каждого защитного сценария из ТЗ, с перепроверкой тестов как «умеющих
падать» — не формальным запуском, а разбором, какой код каждый assert ловит
(ниже — с указанием конкретных строк).

## Проверено и корректно — по каждому AC

**AC1 (меню, N/M/mtime, read-only).** `previous_data.py:132-142`
(`inspect_previous_data`) не пишет на диск и не вызывает `Store` — только
`Path.open`/`os.scandir`/`lstat`. Порядок пунктов меню `["restore",
"start_fresh"]` (`config_flow.py:72`) — restore первым, как в решении
владельца. Тест `test_previous_data_menu` проверяет тип `MENU`, порядок,
плейсхолдеры `spaces=1/files=4/modified` и **неизменность снимка диска**
(`before == after`, backend) — тест умеет падать: любое случайное
`Store.async_load` в детекторе дало бы мутацию файла и провалило бы сравнение
снимков. Unit `test_summary_read_only` отдельно фиксирует N=2/M=3/
modified=max(mtime) на синтетическом дереве и тоже сверяет снимок до/после.

**AC2 (restore).** `async_step_restore` → `async_step_user()` без каких-либо
файловых операций; архивирование физически не может сработать на этой ветке,
потому что оно обусловлено только `self._start_fresh` (`config_flow.py:44-50`),
который restore явно переводит в `False` (`config_flow.py:84`). Backend
`test_restore_previous_data` проходит мастер целиком, дожидается setup, читает
реальные WS `houseplan/config/get` и аутентифицированный content-эндпоинт,
сравнивает байты плана до/после и использует фиксированный формат Store
(`_isolated_disk` фикстура перехватывает реальный диск только для ключей
House Plan, не трогая остальной HA) — падает, если restore хоть немного меняет
исходные байты или не подтягивает старые пространства.

**AC3 (fresh → архив, не стирание).** `archive_previous_data` переносит весь
найденный набор `rename`'ом в `houseplan/archive/<UTC-метка>-<uuid>/`
(`previous_data.py:149-191`), без `exist_ok`/перезаписи (`archive.mkdir()`
без флагов — `FileExistsError` при коллизии уходит в `except OSError`).
Повторный перенос создаёт отдельный архив — `uuid4().hex` в имени
(`previous_data.py:146`) гарантирует разные имена при любой гонке по времени.
`test_start_fresh` (backend, реальные WS) и `test_archive_roundtrip` +
`test_second_archive` (unit, побайтовая сверка всех 4 Store + 3 вложенных
каталогов, включая пустые поддиректории — `plans/empty`) подтверждают:
новый конфиг пуст, архив побайтово идентичен исходнику, два независимых
архива сосуществуют. Читал оба теста построчно — они падают на любом
отклонении набора путей или байтов (`byteset(...) == expected`, не
`len(...) == len(...)`).

**AC4 (прерванный мастер).** Параметризованный `test_abort_preserves_data`
(`choice in [None, "restore", "start_fresh"]`) прерывает flow на MENU и на
форме `user` после каждого выбора, сравнивает полный снимок (байты + mtime +
пути) и список entries. Код: перенос данных физически невозможен раньше
финального `if user_input is not None:` блока (`config_flow.py:43`) — меню и
выбор ветки меняют только внутрифлоуное состояние (`self._start_fresh`), не
диск.

**AC5 (нет данных — как сейчас).** `inspect_previous_data` возвращает
`found=False`, когда `inventory.files` пуст и `unsafe=False`
(`previous_data.py:136-142`); каталог `houseplan/archive/...` не входит ни в
`STORE_KEYS`, ни в `DATA_DIRS` (`const.py`: `PLANS_DIR/FILES_DIR/ASSETS_DIR` =
`houseplan/{plans,files,assets}`, архив — отдельный путь `houseplan/archive`,
который `_inventory` никогда не обходит), поэтому «только архив» не
триггерит меню — подтверждено `test_no_data_and_archive_only` и
`test_archive_only_uses_original_user_step`.

**AC6 (повреждённый/будущий `houseplan.config`).** `_spaces()`
(`previous_data.py:109-129`) жёстко проверяет `version == STORAGE_VERSION` и
`0 <= minor_version <= STORAGE_MINOR_VERSION`, иначе `None`; JSON-ошибки и
не-dict структуры тоже `None`. Меню всё равно показывается (`spaces=None` →
плейсхолдер `"—"` и локализованное предупреждение, `config_flow.py:68-69,74`).
И restore, и fresh не падают на повреждённом файле: fresh просто переносит
исходные байты как есть (архивирование работает с путями, не с содержимым),
restore не трогается этой задачей (прежний загрузчик Store). Все 4 комбинации
(`invalid json` / `version: 99` × `restore` / `start_fresh`) проверены
`test_corrupt_previous_config`; плюс unit `test_unreadable_count` на 6 вариантов
битых структур.

**AC7 (документация/i18n).** Ключи `strings.json` и всех 4 `translations/*`
совпадают 1:1 с контрактом (`config.step.previous_data.title/description/
menu_options.restore/menu_options.start_fresh`, `config.error.
previous_data_unreadable`, `config.abort.previous_data_error/archive_failed`),
плейсхолдеры `spaces/files/modified/warning` присутствуют во всех 4 языках —
проверил построчно каждый файл диффа, не только ru/en. `test_menu_translations`
параметризован по всем 4 языкам и падает на отсутствующем ключе или
плейсхолдере. `USER-GUIDE.md`/`USER-GUIDE.ru.md` добавили раздел «Removal and
reinstallation»/«Удаление и повторная установка» с точными путями
(`.storage/houseplan.*`, `houseplan/{plans,files,assets}`,
`houseplan/archive/<...>/`) — сверил с `const.py` и `previous_data.py`,
расхождений нет. Это проверено чтением, не исполнением на живой HA — ровно
то ограничение, что заявлено в самом ТЗ для AC7.

## Защитные сценарии — таблица «чем краснеет» (не пустая, #435)

| Сценарий | Тест (строка) | Чем краснеет |
|---|---|---|
| Второй `rename` падает на середине | `test_second_rename_failure_rolls_back` (previous_data.py:134) | полный байт-сет и mtime совпадают с «до», `archive/` не остался; `monkeypatch` считает ровно 3 вызова rename (2 вперёд + 1 откат) |
| Коллизия имени архива | `test_collision_preserves_existing_archive` (:223) | старый архив `same/keep` не тронут, `ArchiveError` поднят до первой записи в него |
| `mkdir` отказывает (ENOSPC/EACCES) | `test_mkdir_failure_preserves_data` (:157), параметризован по 2 errno | снимок диска идентичен «до» |
| EXDEV между источником и архивом | `test_cross_filesystem_rejected_before_move` (:173) | `error.value.__cause__.errno == EXDEV`, диск не тронут |
| Симлинк на любом из 7 опасных путей | `test_symlinks_never_followed_or_moved` (:196), 7 локаций | `os.scandir` под guard'ом падает assertion'ом при попытке зайти во внешнее дерево; `external/sentinel` байты не тронуты |
| Неудачный откат (носитель отказал) | `test_failed_rollback_retains_bytes_and_logs_path` (:235) | сумма исходных байтов сохранена, путь частичного архива в `caplog.text` |
| Активная запись перед переносом | `test_active_entry_prevents_archive` (test_ha_config_flow.py:291) | `ABORT single_instance_allowed`, `archive/` не создан |
| Параллельный flow | `test_concurrent_flow_is_refused` (:303) | второй `async_init` получает `already_in_progress`, диск не тронут |
| Сбой инвентаризации | `test_inspection_failure_preserves_data` (:313) | `ABORT previous_data_error`, entries пуст |
| Ошибка при fresh (второй rename) через конфиг-флоу целиком | `test_archive_failure_never_creates_entry` (:270) | `ABORT archive_failed`, никакой entry, `archive/` не создан |

Защита дублируется 4 зарегистрированными мутантами
(`scripts/mutation-registry.mjs`, добавлены этим диффом):
`reinstall-archives-before-final-confirmation`,
`reinstall-moves-working-entry-data`, `reinstall-loses-rollback-record`,
`reinstall-archives-unsafe-links` — каждый ссылается на конкретный guard-тест
и на уникальную (проверил grep'ом) строку `find`. Мутанты не исполнялись —
это норма для разработки (§2.7, #709): ловлю проверяет ночной прогон реестра,
а не этот раунд.

## Один номер — один источник (§8)

N/M/дата вычисляются один раз в `inspect_previous_data` и передаются только в
`description_placeholders` одного HA-шага; больше нигде в диффе (карточка,
`src/**`, другой WS-ответ) эти числа не отображаются и не пересчитываются —
дублирования источника нет.

## Трейлеры и changelog

Коммит `748b2f67` несёт `Issue: #820` и `User-Visible: yes`; оба
`docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` правятся в этом же коммите —
соответствует §3 п.10.

## Риск по изменённым участкам (#707, трек ask — сверка по AC ТЗ)

- **migration** (`previous_data.py:4,26,119` — токены `migrate`/
  `STORAGE_VERSION`): закрыт AC6 и разделом «Модули, модель данных и
  совместимость» ТЗ — явный запрет читать через `Store.async_load`, явная
  проверка `version`/`minor_version` без миграции; подтверждено
  `test_legacy_summary_does_not_migrate` (не дописывает `settings` в файл при
  чтении устаревшего minor_version).
- **ux** (44 новых ключа в `translations/de.json` и остальных 3 языках):
  закрыт AC1/AC7 и разделом i18n ТЗ; подтверждено `test_menu_translations` по
  всем 4 языкам и ручной построчной сверкой с контрактом (см. выше).

Оба класса покрыты именованными AC, задача остаётся на `ask` без находки
«не покрыт».

## Чего не проверял

- Не исполнял pytest/npm сам в этом раунде — положился на зелёный Validate
  `748b2f67` и отдельно проверенный лог job'а «Бэкенд: pytest в Home
  Assistant» (collected 468 HA-harness тестов, 1102 passed/1 skipped, без
  ошибок коллекции). Это не моя непроверенная вера на слово автору: цифры
  сверены с реальным логом GitHub Actions.
- Golden/скриншоты — не гоняю: `src/**` и путь отрисовки плана не менялись
  (подтверждено `git diff --stat`), `ci:golden` не требуется.
- `smoke-select.mjs` — не запускал сам; доверяю выводу автора «executable
  frontend diff отсутствует» ровно потому, что дифф не касается ни одного
  файла, который этот скрипт мог бы счесть связанным (чисто Python +
  i18n + docs).
- Инварианты геометрии (`npm run invariants`) — не требуются, геометрия
  config/layout не меняется (новых полей/версий нет, подтверждено разделом
  «Модули...» ТЗ и отсутствием правок в `store.py`/`websocket_api.py` в
  диффе).
- Мутанты из `mutation-registry.mjs` не исполнял — по правилам разработки
  (§2.7) их не гоняет ни автор, ни ревьюер; проверил только, что `find`
  уникален и патч бьёт по реально существующей строке (ручная сверка, не
  `mutation-gate.mjs --check`, которым я не пользовался).
- Не выполнял интерактивный прогон мастера на живой Home Assistant —
  ручного тестирования в этом раунде нет по правилам конвейера; вместо этого
  разобрал код построчно против каждого AC и перепроверил, что тесты
  действительно могут упасть (см. таблицу выше с конкретными assert'ами).
- Не проверял `docs/DEVELOPMENT.md`/`docs/STATUS.md` на свежесть скриншотов —
  не гейт задачи (#697).

## Находки

Нет. High: 0, Medium: 0.

## Вердикт

Зелёный. AC1–AC7 доказаны автотестами (подтверждёнными зелёным CI-логом на
материале `748b2f67`) либо разобраны чтением там, где сам ТЗ ограничивает
доказательство чтением (AC7). Все защитные сценарии имеют непустую графу
«чем краснеет» — конкретный негативный тест и/или зарегистрированный мутант.
Трейлеры и changelog в порядке. Оба риск-класса (`migration`, `ux`) из
промпта покрыты именованными AC. Маршрут — `fix` (трек `ask`, не `show`,
`reclassify` неприменим).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/820-reinstall-data-choice`, коммит `748b2f67fac7` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a20b4ce47423b743ed2e74b762675b7a63a2aff3`
  ```
  git log --all --format='%H %T' | grep a20b4ce47423
  ```
- Тело issue: `abfc5ab7377e3804bced8670c561407ffdfe78de34de1e7396b88a608eae5bda`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4312 output_tokens=32079 cache_creation_input_tokens=126204 cache_read_input_tokens=2630146 num_turns=41 -->
