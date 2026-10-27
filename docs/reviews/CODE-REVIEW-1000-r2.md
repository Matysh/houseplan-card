# CODE-REVIEW — issue #1000, заход r2

Материал: `349becd509d23f082b47c3882e8a8137d7ce82ff` (tree `473602a04d2c…`),
трек `ask`, этап `code`. Предыдущий раунд: r1, материал
`280357238ce62885dc5b714290ca35c23854914a` (tree `fa4429af1117…`),
`docs/reviews/CODE-REVIEW-1000-r1.md`, вердикт 🟡 жёлтый, Medium 1, High 0.

## Скоуп раунда

r2 — ответ на единственное Medium-замечание r1 (`F-CHANGELOG-DUP`): три
почти дублирующих пункта `(#1000)` про пороговые тревоги в
`docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` сведены к одному. По
`docs/process/REVIEWER.md` «Повторный раунд» предмет ревью — дельта
`280357238ce6..349becd509d2`, а не задача целиком; полный повторный
разбор продуктового кода не требуется, т.к. дельта локальна (docs-only) и
не задевает ни один AC, кроме достоверности changelog-текста.

## Как проверялось

1. Прочитан `docs/reviews/CODE-REVIEW-1000-r1.md` целиком — зафиксированная
   находка, перечень выполненных в r1 проверок и их результат (переиспользую,
   не повторяю).
2. `run_check(read:log)` на материале `349becd50` — полный список коммитов
   диапазона. Верхний коммит `349becd50 docs: consolidate threshold release
   notes after CODE r1` — единственное изменение поверх материала r1,
   плюс `58c340b43 Merge accepted dev into issue/1000-device-thresholds` и
   `c74c144bf docs: review document for #1000` (коммит самого r1-документа).
   Коммиты `eeaf18111..9270b2b72` и далее — те же коммиты реализации, что
   видел r1.
3. `run_check(read:diff)` на материале `349becd50` — полный диф
   `origin/dev..HEAD`. Хунк `docs/CHANGELOG.md` (строки 496–515 диффа) и
   `docs/CHANGELOG.ru.md` (516–536) показывает ровно один добавленный пункт
   `(#1000)` про пороговые тревоги в каждом файле плюс отдельный
   самостоятельный пункт `(#1000)` про virtual copy — без следов тройного
   дубля. Список файлов диффа идентичен `changedFiles` пакета ревью (та же
   87-файловая поверхность, что видел r1).
4. Прямым `Read` подтверждено текущее состояние обоих changelog-файлов:
   `docs/CHANGELOG.md:12-14,20` и `docs/CHANGELOG.ru.md:18-20,27` — по одному
   пункту `(#1000)` на функцию, текст совпадает с самой полной (третьей)
   версией из дубля r1. `Grep "#1000"` по обоим файлам — по 2 совпадения в
   каждом (virtual copy + threshold alarms), повторов нет.
5. Выборочно перечитаны (не вся переправка, а именно строки, которые r1
   указал как рискованные) `custom_components/houseplan/validation.py:1085-1100`,
   `src/render-snapshot-capture.ts:75-114`, `src/i18n/en.json:1345-1350` —
   содержимое побайтно совпадает с тем, что описал r1; слияние `dev`
   (58c340b43) их не затронуло.
6. `docs/release-ledger/v1.82.0/1000.json` и `docs/STATUS.md` (счётчики
   Node/pure/HA/smokes) — без изменений относительно r1, числа совпадают с
   хендоффом (5713/690/591/467).

### Гейты: прогнаны в этом раунде

| Гейт | Статус | Зачем |
|---|---|---|
| `run_check(read:log)` | PASS, `materialUnchanged: true` | Зафиксировать точный диапазон коммитов r1→r2 |
| `run_check(read:diff)` | PASS, `materialUnchanged: true` | Независимо увидеть итоговый хунк changelog после фикса, не через заявление автора |

### Гейты: переиспользованы без повтора (reuse)

- `review-light-golden` / validate-gate на точном SHA `349becd50…`:
  https://github.com/Matysh/houseplan-card/actions/runs/40587933048 —
  зелёный; пакет ревью подтверждает, что план проверок материала выполнен.
  Смена SHA — только docs-коммит после r1, не инвалидирует это
  доказательство (материал не исполняемый код в этой части).
- Из r1 (материал `280357238…`, тот же продуктовый код, не изменённый
  в r2): `gate:small` PASS (build/typecheck/unit/bundle/unused/monolith),
  `process-gate` PASS, 5/5 обязательных smoke + 20/20 golden intents,
  backend `test_marker_alerts.py test_ha_marker_alerts.py
  test_ha_import_export.py test_ha_backup_archive.py` — 347 PASS, парное
  воспроизведение immutable `9db1e66f` (0 различий), cold
  readonly/kiosk-запросы, 5 зарегистрированных mutation-witness id
  (`--check` PASS, 0 executed/caught).
- Не требовали нового прогона: продуктовый TS/Python код, i18n-ключи,
  golden PNG, тесты — не изменились между r1 и r2 (подтверждено `read:diff`
  выше — единственный изменённый хунк находится в двух changelog-файлах).

## Находки

Новых находок нет.

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| F-CHANGELOG-DUP (Medium, в скоупе): три нарастающих дубля пункта `(#1000)` про пороговые тревоги в `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` | Коммит `349becd50 docs: consolidate threshold release notes after CODE r1` свёл три строки к одной (самой полной), не тронув отдельную запись про virtual copy | `docs/CHANGELOG.md:20`, `docs/CHANGELOG.ru.md:27`; подтверждено `run_check(read:diff)` (хунк показывает ровно один добавленный пункт на файл) и прямым `Read`/`Grep "#1000"` текущего файла |

## Унаследовано из r1

Без повторной проверки приняты (документ `docs/reviews/CODE-REVIEW-1000-r1.md`,
материал `280357238ce62885dc5b714290ca35c23854914a`, продуктовый код этой
части не менялся в r2 — подтверждено `read:diff` выше):

- TS↔Python парность comparator/validator (id/entity regex, length limits,
  NUMBER-формат, bool-exclusion, order-operator↔number only).
- Lifecycle 3000ms: единственный bounded-таймер на ближайший дедлайн,
  перечитывание на границе, owner/retire/foreign-authority корректно
  обнуляют pending и entries.
- Приоритет причин: threshold/native alarm используют общий
  `visual.status === 'alarm'` канал; attention не конкурирует с alarm;
  native maintenance classifier не переписан.
- Lazy-loading `alerts`-чанка только при непустом `alert_sources`;
  Static/`live_states:false`/disconnected не держат таймеров.
- Миграция: лосслесс-схема, change-aware семантическая проверка (паттерн
  #845), старый план без `alert_sources` не переписывается.
- i18n: 38 ключей `marker.alerts.*` + `backup.error.invalid_alert_sources`
  одинаково в `de/en/fr/ru`.
- Copy: `alert_sources` не удаляется при копировании устройства, удаляется
  только HA-only `more_info_entity`.
- `docs/USER-GUIDE.ru.md` — раздел «Пороговые тревоги устройства» точен.
- `docs/release-ledger/v1.82.0/1000.json` — category `major`, golden-интенты
  перечислены полно.
- 5 заявленных mutation-witness id реально зарегистрированы в
  `scripts/mutation-registry.mjs` с патчами по текущим строкам кода.
- review-light-golden / validate-gate зелёный на материале r1
  (https://github.com/Matysh/houseplan-card/actions/runs/40566436175).

## Что проверено и корректно (в этом раунде)

- Фикс закрывает находку r1 ровно так, как заявлено в хендоффе: дубль сведён
  к одной строке на файл, самостоятельная запись про virtual copy сохранена
  без изменений.
- Фикс не затронул ничего за пределами двух changelog-файлов: полный
  `read:diff` против `origin/dev` показывает тот же набор файлов и тех же
  хунков продуктового кода, что видел r1, плюс ровно два новых
  changelog-хунка.
- Соседний предсуществующий дубль `(#1087)` (строки 18–19 EN / 25–26 RU) не
  тронут этим диффом и остаётся вне скоупа #1000 (как и зафиксировал r1) —
  не новая находка этого раунда.
- Счётчики `docs/STATUS.md` и `docs/release-ledger/v1.82.0/1000.json` не
  регрессировали относительно r1.

## Чего не проверял

- Полный визуальный diff 20 golden PNG и построчный `test/marker-alert-*` —
  не изменились в дельте r1→r2 (подтверждено `read:diff`), приняты по
  зелёному proof r1/validate-gate без повторного пересмотра.
- Полный `tests_backend` за пределами 4 файлов из r1 — тот же код, не
  перепроверял заново.
- `docs/reviews/INDEX.md` пока не содержит строк #1000 (индекс
  генерируется скриптом `reviews-index.mjs` отдельным шагом) — не блокер
  этого ревью.

## Маршрут

`route: fix` (трек `ask`, код-ревью; `reclassify` применим только к `show`).
Находок High/Medium в скоупе нет → зелёный вердикт. Побочных находок вне
скоупа #1000 нет; `REVIEW_FINDINGS_POLICY` — `mode=issues`, `outside_findings`
пуст.

---

Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0 · Документ: docs/reviews/CODE-REVIEW-1000-r2.md

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjgzZjlmNDNjZjYwNDk1YmJjYmIyODc2OGUwZWZlYTc3MzBhZDc2YmIxZjA5NTFjMWRlYTFjODkyZmFkODg2MmQiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI3OGZhNjYxMTljZTBkZTQ2N2U3MWRhYjFmNDhlN2IwYzk3NmNhNDljZGY5N2NhYjc1MmViODhmNDdhYWM1MmMzIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDAwLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiIzNDliZWNkNTA5ZDIzZjA4MmI0N2MzODgyZThhODEzN2Q3Y2U4MmZmIiwidHJlZSI6IjQ3MzYwMmEwNGQyY2MwZmYxODQ5MTIwZDZlNzdhZmZmYzk5NDU4MWMiLCJib2R5RGlnZXN0IjoiODhkYzNkMDFkNDJiNDVjODNlYmI4MDI5MDU1YzFkMTUwOWEyY2Y0MWUxZTNjM2ZlNDI1YjE2NDBhOGY3MGQ1ZCIsInByb2R1Y2VyUnVuIjoiNDA1ODk1ODg1NzQiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjFiODVmMjNkYmM1MWU4MTE4YTQyNTZlZTA4NmY1NWE0YTJhZjE0MmM0ZjFiNGNkZjZhMTVkOTA3MmQxODExZjMiLCJ2ZXJkaWN0RGlnZXN0IjoiNWVjZjI0YjYzNjk1NDUwZjMxNTNhYmMxYTVlMGUzNDE3NzU3ZGQzMTYwNGViNjQyMzY2MzIzYzljMzZmMTIzMyIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI5MzExMWNkNDA0NzJiNDI2MTU0YTE1NzJlZDIzOGVlMTkzNjZhNjc4MWJiNThkNWFhNTQ3M2U2MjNhOTRmMzM2IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDU0NTUyMjc3LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDAwI2lzc3VlY29tbWVudC02NDU0NTUyMjc3IiwiYm9keURpZ2VzdCI6IjhiNTg2ZmE0ZTE0MmNhYzM4Yzc2MWY0OTQ3YzZlYWNlZWY3OGI5Y2I5YzAxOWNhYjQ5MzExMDlmYzczNmMxMjIifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1000-device-thresholds`, коммит `349becd509d2` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `473602a04d2cc0ff1849120d6e77afffc994581c`
  ```
  git log --all --format='%H %T' | grep 473602a04d2c
  ```
- Тело issue: `88dc3d01d42b45c83ebb8029055c1d1509a2cf41e1e3c3fe425b1640a8f70d5d`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40589588574,"run_attempt":1,"digest":"fe2a8b3008ff194813b5d3129b4d946ff12a42b07e1d897948320e430c02b431"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NDQsIm91dHB1dF90b2tlbnMiOjE2NDg3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjExNzExOCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjE4MTgxNjgsImNvc3RVc2RFc3RpbWF0ZSI6MC45OTcwNjM2MDAwMDAwMDAyfV0sInR1cm5zIjozMSwiZHVyYXRpb25NcyI6MjMwMDE3LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MC45OTcwNjM2MDAwMDAwMDAyLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=44 output_tokens=16487 cache_creation_input_tokens=117118 cache_read_input_tokens=1818168 num_turns=31 -->
