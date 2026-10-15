# Код-ревью #912 — заход r3

Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`,
ровно `0dd9b3ffe6758c869df290ff9ce1ddf9b3c20614` (рабочая копия на нём).
Трек: `ask`. Блокирующих циклов израсходовано 1 из 4.

`origin/dev` не продвинулся с r2 (`67c8e9456f58e1a533b6ac570cc8716d1b9dc8a6` —
то же дерево, что было базой r2). Делта r2→r3 — три новых коммита поверх
ревью-зафиксированного `f05e3ede`, без ребейза: разбор по дельте, а не
задачи целиком (`docs/process/REVIEWER.md`, «Повторный раунд»).

## Скоуп

Issue #912: сохранить успешно полученные карты связей Zigbee2MQTT между
перезапусками Home Assistant/интеграции до явного действия пользователя
(«Обновить карту» или сохранённое выключение связей). Контракт поведения,
AC1–AC7 и решение владельца 1б зафиксированы в теле issue, прошли зелёное
SPEC-REVIEW-912-r1 и не менялись с r1/r2 (тот же якорь
`hp:z2m-persistent-topology-20261015`).

Коммиты в материале r2→r3 (`git log --oneline f05e3ede..HEAD`):

- `be85b208` (fix, User-Visible: yes) — снимает перманентную блокировку
  записи после обнаружения некорректного/чужого кеша (M1 из r2).
- `360b36bc` (test, User-Visible: no) — убирает из параметров теста сценарий
  «OFF→OFF без изменений», который структурно не доходит до writer'а
  (семантический no-op в `websocket_api.py:1779`), и потому не был
  валидным свидетелем «действие пробует реальную запись».
- `0dd9b3ff` (docs, User-Visible: no) — evidence-документ с ordinary
  before/after прогоном и перечнем прогнанных гейтов.

Все три несут `Issue: #912`; `User-Visible: yes` только на `be85b208`, с
правкой обоих changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) в том
же коммите.

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate ровно на этом SHA
(https://github.com/Matysh/houseplan-card/actions/runs/38774642025,
`conclusion: success`). Так как в этой дельте впервые за цикл правится
Python-файл продукта (`zigbee_topology.py`) и backend-тест, отдельно
перепроверил по логу job'а, что `pytest tests_backend` на этом SHA выполнен
заново (не reuse) и действительно включает новый тест.

| Гейт | Результат | Источник |
| --- | --- | --- |
| `npx tsc --noEmit` / `npm test` / `npm run build` + bundle-policy | PASS | job «Фронтенд: типы, юниты, мутанты, синхрон бандла» (прогон `38774642025`) |
| `pytest tests_backend` | Свежий прогон, **не** reuse: `1499 passed, 1 skipped in 67.07s`, HA-harness собран (602 `test_ha_*`) | лог job `116559324556` «Бэкенд: pytest в Home Assistant» (прочитан напрямую, не со слов автора) |
| `golden:verify` (`ci:golden`) | `skipped` — корректно: дельта r2→r3 не трогает `hp-zigbee-topology-overlay.ts` ни другой render-риск | тот же прогон |
| Смоки в браузере (3 шарда) | PASS | тот же прогон |
| `mutation-gate --check` / geometry parity / perf-смок / «бандл головы dev» | `skipped`, nightly-only/не требуются AC этой дельты | тот же прогон |
| Ordinary recovery witness (до/после фикса) | Автором: `pytest -k invalid_store` — 10 FAIL на дереве `5825861a` (до `be85b208`), 10 PASS после; полный backend — 1499 PASS/1 skip | `docs/reviews/evidence-912/r2-storage-recovery.md`, перепроверено чтением diff `be85b208` (см. ниже) — не повторял исполнение на до-фикс дереве сам (временный откат продукта с прогоном — исполнение мутанта, запрещено вне ночи, #905) |

Не прогонял сам: `tsc`/`npm test`/`npm run build`/`pytest`/`golden:verify` —
взял зелёный Validate на этом точном SHA и лично прочитал лог
`pytest`-job'а, чтобы исключить скрытый reuse теперь, когда правится Python.
Не откатывал `_save()` к до-фикс виду и не гонял тест на этом состоянии —
такое исполнение мутанта реализации запрещено вне ночного workflow даже
ревьюеру; вместо этого подтвердил логикой diff (ниже), почему тест был бы
RED без `be85b208`, и опёрся на документированный автором ordinary
before/after прогон.

## Разбор правки

**Было (r2, Medium M1):** `_save()` безусловно поднимал `ZigbeeScanError`,
если `self._storage_error` был установлен при `async_setup` — один раз
установленный флаг навсегда блокировал любую следующую запись: обычный
Refresh по любому топику, сохранённое выключение функции и даже новый
успешный скан, независимо от того, связана ли причина исходного отказа с
текущей записью.

**Стало (`be85b208`):**

```python
async def _save(self, topics: dict[str, dict[str, Any]]) -> None:
    try:
        await self._store.async_save({...})
    except Exception as err:
        raise ZigbeeScanError("storage_clear") from err
    self._saved = topics
    self._storage_error = None   # успешная запись снимает диагностику чтения
```

`_save()` больше не блокирует запись по историческому факту чтения — она
всегда пытается реальный I/O, и только текущий отказ `self._store.async_save`
отклоняет действие (`storage_clear`); успех снимает `_storage_error`.
`async_save_config` дополнительно пробует durable-clear при выключении, если
`self._storage_error` установлен (даже без предшествующего `self._enabled`/
`self._saved`), так что сохранённый OFF — тоже путь восстановления, а не
только Refresh. `async_setup` (чтение при старте) не изменён: некорректный
кеш по-прежнему не интерпретируется, не сканируется и не перезаписывается
автоматически — ровно требование AC4/контракта п.8.

Признаю диагностику по чтению кода достаточной для «почему тест стал бы
падать на старом коде»: старый `_save` поднимал исключение **до** вызова
`self._store.async_save`, поэтому новый ассерт в тесте
(`writes == 1, "an explicit action must attempt I/O despite the earlier read
error"`) на до-фикс дереве получил бы `writes == 0` — сам факт монтажа
`monkeypatch.setattr(..., "async_save", fail_save)` и счётчика `writes`
доказывает, что тест способен отличить «отказ без попытки записи» от
«отказ при настоящей попытке записи». Это соответствует общей политике:
обычный отрицательный случай (принудительный `OSError`) встроен в сам тест,
а не подменяет продукт.

### Проверка теста (`tests_backend/test_ha_zigbee_topology.py`,
`test_issue_912_invalid_store_is_preserved_until_explicit_recovery`, 5
видов порчи × `refresh`/`off`)

Прочитан построчно. Последовательность на реальном HA entry: порча кеша →
restore с `storage_read` → первая попытка recovery с принудительным
`OSError` в `async_save` (`writes == 1`, отказ `storage_clear`, диск/конфиг
не изменились) → вторая попытка с настоящим `async_save` (успех, диагностика
снята, `_durable() == {}` либо новая карта) → реальный `async_unload`/
`async_setup` подтверждает, что восстановленное состояние переживает
перезапуск без ошибки и без лишнего MQTT publish. Воспроизводит in-scope
сценарий Medium из r2 буквально (`future`/`foreign`/`topic`/`nodes`/`time` —
та же матрица, что в прежнем тесте).

Убранный параметр `off-already-disabled` (`360b36bc`) — проверил
обоснование чтением `websocket_api.py:1779-1789`:
`if msg["config"] == data.get("config"):` — семантический no-op отправляет
`{"ok": True}` и **не доходит** до `async_save_config_state`/
`async_save_config`. Сценарий «уже OFF, конфиг не менялся» структурно не
мог быть свидетелем «действие пробует запись» — параметр был неприменим,
а не ослаблением покрытия. AC4 («failed save/clear» матрица) по-прежнему
закрыт оставшимися `off`/`refresh`.

### Пограничный случай: уже выключено + повреждённый кеш

Если функция уже выключена в момент обнаружения порчи, у админа нет прямого
«OFF→OFF»-пути восстановления (это no-op, см. выше); единственный путь —
включить (само включение `_save` не вызывает), затем нажать «Обновить карту»
для любого топика (`_start` теперь безусловно пытается реальную запись) или
повторно выключить реальным изменением конфигурации. Это рабочий и
задокументированный (`USER-GUIDE.md`: «explicit Update map or saved OFF can
replace it») путь, просто требует один дополнительный шаг «включить». Не
считаю это находкой: ТЗ не обещает восстановления без хотя бы одного
явного действия пользователя, а сценарий «стартовал выключенным и уже с
порченным кешем» — редкая комбинация поверх уже редкого случая порчи.

## Закрытие раунда r2

| Находка r2 | Чем закрыта | Где это видно |
| --- | --- | --- |
| Medium (в скоупе): `_storage_error` выставляется один раз и никогда не очищается; `_save()` безусловно отказывает по историческому факту чтения — Refresh/сохранённое выключение/новый успешный скан блокируются навсегда без пути восстановления через продукт | `be85b208`: `_save()` больше не проверяет `self._storage_error` перед попыткой записи; успешная запись сбрасывает диагностику; `async_save_config` пробует durable-clear при выключении и при наличии `self._storage_error` | `custom_components/houseplan/zigbee_topology.py:234-249`; тест `test_issue_912_invalid_store_is_preserved_until_explicit_recovery` (`tests_backend/test_ha_zigbee_topology.py:386-470`), PASS на свежем прогоне `pytest` (лог job `116559324556`); `docs/CONFIG-COMPATIBILITY.md`, `docs/USER-GUIDE(.ru).md`, оба `CHANGELOG` описывают новое поведение |

## Унаследовано из r2 (без повторной проверки в этом раунде)

| Что | Документ/материал r2 | Почему не повторял |
| --- | --- | --- |
| SPEC-REVIEW-912-r1 (зелёный, AC1–AC7), контракт п.1б | `docs/reviews/SPEC-REVIEW-912-r1.md`, тело issue, якорь `hp:z2m-persistent-topology-20261015` | Тело issue не менялось с r1/r2 |
| Полный независимый разбор всего диффа `origin/dev...HEAD` на `f05e3ede` (AC1–AC7, migration/devices/ux классы, трейлеры, бюджеты, release-ledger, i18n, admin-гварды WS, golden) | `docs/reviews/CODE-REVIEW-912-r2.md` | `origin/dev` не продвинулся (`67c8e945` — та же база); r2 правок не меняла дельта r2→r3, кроме снятого Medium — риск-классы `devices`/`ux` этой дельтой не затронуты вовсе (не тронуты `websocket_api.py` capability-флаги, i18n-файлы) |
| Бюджетные потолки `2936529`/`265955` (owner-approved) | `docs/reviews/CODE-REVIEW-912-r2.md`, issuecomment-6194871293/6195062293 | `scripts/bundle-budget.mjs`/`monolith-baseline.json` не в диффе r2→r3 |
| `release-ledger/v1.80.1/912.json` (`category: major`) | `docs/reviews/CODE-REVIEW-912-r2.md` | Файл не в диффе r2→r3 |
| Факт реального прогона `pytest` на дереве до правки (1494 passed/1 skipped) | Validate `38767840045`, прогон `38755995729` | Исторический факт, не переисполнял; в этом раунде отдельно проверил именно новый прогон (1499 passed) |

## AC — чем доказаны, чем краснеют (изменившиеся строки)

| AC | Доказательство | Чем краснеет |
| --- | --- | --- |
| AC3 bounds/recovery | `test_issue_912_invalid_store_is_preserved_until_explicit_recovery` (новая версия, 386–470): восстановление без скана, затем явная попытка записи при обоих действиях | Встроенный ordinary negative input: принудительный `OSError` в `async_save` (`writes == 1`, отказ `storage_clear`) до настоящего успеха — подтверждает, что действие пробует реальный I/O, а не короткое замыкание по старой диагностике |
| AC4 матрица отказов | Та же матрица 5 видов порчи, теперь + двухшаговый recover/retry | То же; дополнительно — тест подтверждает конечное содержимое Store/config после отказа и после успеха, не только факт вызова (требование AC4 «подтвердить конечное содержимое, не только mock-call count») |

Остальные строки таблицы AC не меняются относительно `CODE-REVIEW-912-r2.md`
(унаследованы, см. выше).

## Проверено и корректно

- Трейлеры `Issue: #912` на всех трёх коммитах дельты; `User-Visible: yes`
  только на `be85b208`, оба changelog правятся в том же коммите.
- `CONFIG-COMPATIBILITY.md` новый абзац точно описывает новую семантику
  («An explicit Update or saved OFF can replace rejected storage… Only that
  action's real write failure refuses it; a successful write clears the read
  diagnostic. Ordinary startup still preserves the rejected data without
  rewriting») — не противоречит AC4/п.8 (запрет автоматической перезаписи
  при обычном старте).
- `USER-GUIDE.md`/`USER-GUIDE.ru.md` формулировки на одном уровне
  детализации с остальным разделом, не обещают большего, чем реализовано.
- Admin-гварды WS (`zigbee_websocket.py:31,63,82`) и capability-флаги
  (`websocket_api.py:1509-1513`) этой дельтой не затронуты — соответствует
  «девices»-классу, закрытому в r2.
- i18n-ключи (`backup.error.storage_clear/storage_read` и др.) этой дельтой
  не затронуты — «ux»-класс закрыт в r2, новых ключей/формулировок нет.
- `evidence-912/r2-storage-recovery.md` честно перечисляет исполненные
  команды и их фактические результаты (PASS/FAIL, exit-коды, тайминги), не
  заявляет исполнение мутантов/замены источников/релиза.
- Убранный тестовый параметр (`360b36bc`) — не ослабление покрытия, а
  удаление структурно неприменимого сценария (подтверждено чтением
  `websocket_api.py:1779-1789`).

## Находки

Нет High. Нет Medium (ни в скоупе, ни вне скоупа). Разобранный пограничный
случай «выключено + порча на старте» (см. выше) — рабочий документированный
путь, не считаю находкой.

## Чего не проверял

- Не прогонял `tsc`/`npm test`/`npm run build`/`pytest tests_backend`/
  `golden:verify` локально — зелёный Validate на этом точном SHA
  (`38774642025`); отдельно лично прочитал лог `pytest`-job'а (не слово
  автора), чтобы исключить reuse теперь, когда правится Python.
- Не откатывал `_save()` к виду до `be85b208` и не гонял тест на этом
  состоянии — исполнение мутанта реализации вне ночного workflow запрещено
  даже ревьюеру (#905); вместо этого — чтение diff + логика ассерта
  `writes == 1` + документированный автором ordinary before/after прогон.
- Не исполнял зарегистрированные мутанты (nightly-only).
- Полные (не выборочные по диффу) performance-серии и полный golden-набор —
  не требуются этой дельтой (нет render-риска).
- Ручного HA/браузерного тестирования не делал (цикл этого не
  предусматривает).
- Сценарий «уже выключено на старте + порченный кеш» не покрыт отдельным
  тестом (разобран чтением выше, не найден дефектом).

## Вердикт

Зелёный. Medium M1 из r2 закрыт правкой `_save()`/`async_save_config`,
подтверждён ordinary-тестом со встроенным отрицательным случаем (принудительный
`OSError`, `writes == 1`) и свежим зелёным прогоном `pytest` на этом точном
SHA (1499 passed/1 skipped, прочитано из лога job'а, не со слов автора).
Остальной разбор (AC1–AC7, трейлеры, бюджеты, release-ledger, i18n,
admin-гварды) унаследован из r2 без изменений — дельта их не касается.
High не найдено, новых Medium не найдено.

---

<!-- material-anchors: заполняется конвейером -->

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/912-z2m-durable-topology`, коммит `0dd9b3ffe675` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `12c17786a95b62ed5dd5d9441d3d07a64fd4368e`
  ```
  git log --all --format='%H %T' | grep 12c17786a95b
  ```
- Тело issue: `cc7b0e742ffa10286fad8065696571b52f549fa3b091fee850f46af9e686bd62`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUwMzksIm91dHB1dF90b2tlbnMiOjIyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTQ5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo1Miwib3V0cHV0X3Rva2VucyI6MjI2MDIsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTA0NTg5LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MjI0NzY0NiwiY29zdFVzZEVzdGltYXRlIjoxLjA5NDAwOTJ9XSwidHVybnMiOjM0LCJkdXJhdGlvbk1zIjoyNzY2MzAsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjA5OTE1ODE5OTk5OTk5OTgsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5091 output_tokens=22624 cache_creation_input_tokens=104589 cache_read_input_tokens=2247646 num_turns=34 -->
