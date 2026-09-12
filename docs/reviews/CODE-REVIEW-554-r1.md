# CODE-REVIEW-554-r1

Issue: #554 · заход r1 · блокирующих циклов израсходовано 0 из 2 (лёгкий трек, лимит 2)
Материал ревью: `51ead265f061753662f007bf0b27490918a069ad` (dev на момент постановки: `66a6485418c7663d749642c8c5740c95d3c9f490`; над ней лёг 1 коммит dev до ребейза — `2e1c0ee7` → `51ead265`, полный разбор per §7.2).

## Скоуп

Backend-only фикс (класс A: `custom_components/houseplan/*.py`) плюс тесты (класс B) и
документация (класс C, changelog оба языка + `docs/TESTING.md`):

```
custom_components/houseplan/http_api.py |  1 +
custom_components/houseplan/plans.py    | 18 +++++++++++---
docs/CHANGELOG.md                       |  5 ++++
docs/CHANGELOG.ru.md                    |  5 ++++
docs/TESTING.md                         |  7 ++++++
scripts/mutation-gate.mjs               | 13 ++++++++++
tests_backend/test_ha_upload.py         | 32 +++++++++++++++++++++++++
tests_backend/test_validation.py        | 42 +++++++++++++++++++++++++++++++++
```

ТЗ (тело issue, лёгкий трек, зелёное ревью r1): `check_quota` получает новый
опциональный параметр `additional_disk_bytes`; attachment upload после полной
записи staging-файла передаёт `additional_disk_bytes=0` — низкодисковая
проверка перестаёт вычитать уже физически занятые байты второй раз. Дефолт
(`None` → используется `incoming`) сохраняет прежний резерв для plan upload и
любого другого вызова, где байты ещё не записаны.

## Как проверялось

Validate зелёный на этом точном SHA (issue-предпосылка, проверено `gh run view`):
`https://github.com/Matysh/houseplan-card/actions/runs/34718545632` →
`headSha: 51ead265…`, `conclusion: success`. Job-список подтверждён отдельным
запросом: `Бэкенд: pytest в Home Assistant` — success, все шесть шардов
`Мутанты по диффу (N/6): затронутые свидетели краснеют` — success, фронтенд
job (typecheck/unit/build/bundle-sync) — success.

| Гейт | Статус | Как подтверждён |
|---|---|---|
| `npx tsc --noEmit` | не гонял повторно | часть зелёного Validate на `51ead265` (job «Фронтенд») |
| `npm test` | не гонял повторно | тот же job, diff не трогает `src/**` |
| `npm run build` + сверка бандла | не гонял повторно | тот же job |
| `python -m pytest tests_backend -q` | не гонял повторно | job «Бэкенд: pytest в Home Assistant» — success, включает оба новых теста |
| Мутант `quota-reserves-staged-bytes-twice-on-disk` (AC5) | подтверждён | все 6 шардов «Мутанты по диффу» на этом SHA — success; мутант входит в изменённый `scripts/mutation-gate.mjs`, значит вошёл в диапазон диффа шардов и был отобран |
| `node scripts/check-docs.mjs` | не требуется | diff не трогает `src/**` |
| `npm run model-invariants` | не требуется | diff не трогает геометрию/`layout`/`marker.space`/`open_spans` |
| golden / smoke / performance | не требуется | diff backend-only, нет видимого/фронтенд-поведения |
| `node scripts/process-gate.mjs --issues` | подтверждено автором в хендоффе, трейлеры сверены мной вручную | `git show -s` на `51ead265`: `Issue: #554`, `User-Visible: yes`, оба changelog правлены в этом же коммите |

Дополнительно вручную (чтения кода, без исполнения — HA harness недоступен в
этой сессии):

- прочитаны `plans.py:224-261` (новая сигнатура и логика `check_quota`),
  `http_api.py:440-461` (место вызова с `additional_disk_bytes=0`);
- `grep` по всему `custom_components/` подтвердил ровно два вызова
  `check_quota`: `http_api.py` (attachment, новый параметр) и
  `websocket_api.py:2349` (plan upload, вызов **до** записи на диск, без
  нового параметра → дефолт `None` → `disk_incoming = incoming`, старое
  поведение не изменилось);
- прочитаны оба новых теста (`test_validation.py` — юнит на `check_quota`,
  `test_ha_upload.py` — HTTP endpoint) и мутант в `mutation-gate.mjs`, сверены
  границы вручную (см. AC-таблицу ниже);
- прочитан `http_api.py:367-391` (внешний `finally`/`_cleanup`) — существующий
  путь очистки `.upload-*` не меняется этим диффом, новый endpoint-тест лишь
  проверяет его результат при отказе на новой границе.

## AC → доказательство → чем краснеет

| AC | Доказано | Чем доказан | Чем краснеет |
|---|---|---|---|
| AC1 — staged boundary | да | `test_issue_554_low_disk_reserve_distinguishes_staged_and_unwritten_bytes` (первая половина, `additional_disk_bytes=0`): `free == MIN_FREE_BYTES` проходит, `free == MIN_FREE_BYTES-1` кидает `low_disk_space`; endpoint-версия — `test_issue_554_upload_uses_actual_free_space_after_staging` | снятие `additional_disk_bytes=0` в `http_api.py` (мутант `quota-reserves-staged-bytes-twice-on-disk`) возвращает старое `free - incoming`, endpoint-тест кидает `AssertionError` на `accepted.status == 200`; мутант подтверждён красным в CI на этом SHA (все 6 шардов «Мутанты по диффу» success = мутант был пойман) |
| AC2 — not-yet-written boundary | да | та же тест-функция, вторая половина: без `additional_disk_bytes` `free == MIN_FREE_BYTES+incoming` проходит, на 1 байт меньше — отказ | прочитан по коду: если бы дефолт стал `0` вместо `incoming`, этот блок теста упал бы на первом `assert`-free (граница совпала бы с AC1); отдельного мутанта на дефолт нет, но проверка чтением подтверждает единственную ветку `if additional_disk_bytes is None` |
| AC3 — store quota и concurrency (#498 не регрессирует) | да | `test_issue_498_concurrent_uploads_still_count_each_other` не тронут диффом и прошёл в backend-job на этом SHA; логика `dir_usage`/`exclude` не менялась — новый параметр находится только в независимой disk-проверке | не заявлено новой мутацией — существующий #498-мутант (`quota-ignores-foreign-staged-uploads`) не задет этим диффом и остаётся в наборе |
| AC4 — cleanup | проверено чтением, не исполнением + endpoint-тест | `HouseplanUploadView.post`: внешний `try/finally` → `_cleanup(temps)` не менялся этим диффом; `test_issue_554_upload_uses_actual_free_space_after_staging` явно проверяет `not list(root.glob(TMP_PREFIX + "*"))` и что в `m1/` лежит ровно принятый файл после отказа следующей загрузки | AC не заявляет новой защиты (существующий механизм), поэтому отдельного мутанта не требуется правилом §2.7 |
| AC5 — защитная проверка | да | именованный мутант `quota-reserves-staged-bytes-twice-on-disk` в `scripts/mutation-gate.mjs`, guard `node scripts/backend-test-guard.mjs issue_554_upload_uses_actual_free_space_after_staging tests_backend/test_ha_upload.py` | подтверждён отдельным полем guard; сам факт зелёного Validate на этом SHA означает, что все 6 «Мутанты по диффу» шардов поймали свои отобранные мутанты, включая этот — красный шаг остановил бы Validate |

## Находки

Нет.

Рассмотренные, но не подтвердившиеся гипотезы:

- *«Дефолтный путь (`additional_disk_bytes=None`) мог случайно перестать
  резервировать байты»* — опровергнуто чтением: единственный другой вызывающий
  (`websocket_api.py:2349`, plan upload, вызывается **до** `path.write_bytes`)
  не передаёт новый параметр, значит `disk_incoming == incoming`, поведение
  идентично коду до этого диффа.
- *«Docstring теперь не совпадает с фактическим единственным использованием
  `additional_disk_bytes=0`»* — текст обобщает контракт для будущих вызывающих
  (`additional_disk_bytes` — часть, ещё не записанная физически; по умолчанию
  весь `incoming`), а не только для текущего единственного вызова; расхождения
  с кодом нет.
- *«Число 512 МиБ теперь видно в двух местах и может разойтись»* — не
  задето: `MIN_FREE_BYTES` как было единственной константой в `const.py`, так
  и осталось; правка меняет только вычитаемое, а не порог.

## Что проверено и корректно

- Новая сигнатура `check_quota` обратно совместима: единственный сторонний
  вызов (`websocket_api.py`) не передаёт новый параметр и получает прежнее
  поведение — соответствует контракту ТЗ п.2.
- Attachment upload передаёт `additional_disk_bytes=0` вместе с уже
  существующим `exclude=tmp_path` — оба относятся к одному и тому же
  staged-файлу, но к разным измерениям (store quota vs disk free), что и было
  целью ТЗ.
- Тесты бьют ровно в границы (`MIN_FREE_BYTES` и `MIN_FREE_BYTES ± 1`), а не
  «где-то около», что делает саму границу проверяемой, а не просто
  направление изменения.
- Трейлеры коммита (`Issue: #554`, `User-Visible: yes`) и оба changelog
  (RU/EN) — в одном коммите `51ead265`, соответствует §2.6/§3.10.
- `docs/TESTING.md` описывает оба новых теста и привязывает их к мутанту —
  раздел не разошёлся с тестами.
- Скоуп не расширен: правка ограничена одной disk-guard веткой в `check_quota`
  и её единственным затронутым вызывающим, как и заявлено в ТЗ §4.

## Чего не проверял

- Не перегонял `npm test`, `npx tsc --noEmit`, `npm run build`,
  `python -m pytest tests_backend -q` локально — Validate зелёный на этом
  точном SHA (job-список подтверждён отдельным запросом `gh run view`),
  а diff не трогает `src/**`, golden, smoke или perf-профили.
- Не гонял мутант `quota-reserves-staged-bytes-twice-on-disk` вручную
  (нет HA-окружения в сессии ревью, `.venv-backend` отсутствует) — принято по
  зелёным шардам «Мутанты по диффу» на этом SHA, где падение любого
  непойманного отобранного мутанта завалило бы соответствующий шард.
- `check-docs.mjs`, `model-invariants`, browser-смоки, `golden:verify`,
  performance-профили — не запускал: diff не касается `src/**`, геометрии или
  видимого поведения, AC их не называет.

## Вердикт

Зелёный. High: 0, Medium: 0.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/554-staged-free-space`, коммит `51ead265f061` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `bedcc50dd2b4a1cf36d4e7bf2908448d92728bf6`
  ```
  git log --all --format='%H %T' | grep bedcc50dd2b4
  ```
- Тело issue: `3108990578ecf761611c8830494881c27f6d0cffdef2f0d283304bd9c32968e7`
- Вердикт конвейера: `green` · High 0
