# CODE-REVIEW — issue #1000, заход r1

Материал: `280357238ce62885dc5b714290ca35c23854914a` (tree `fa4429af…`), трек `ask`, этап `code`.
ТЗ-источник: тело issue, редакция 3 (bodyDigest `88dc3d01…`), канон owner-решений
6417069616 / 6415792068 / 6420546189.

## Скоуп

До трёх threshold-правил на маркере устройства (attention/alarm, 6 операторов,
число/текст/enum), непрерывная 3000мс confirm/clear, общая модель причин
(native/threshold/+будущий external), поверхности — маркер/предпросмотр/карточка
причин (без новых room/summary counters), TS↔Python парность, перенос через
JSON/ZIP/copy. Полный список изменённых файлов — из `review-context.json`
(src/marker-alert*.ts, src/editors/marker-alerts.ts, custom_components/houseplan/
marker_alerts.py + validation.py, i18n×4, демо/golden/мутации, changelog/ledger/
USER-GUIDE).

## Как проверялось

Static-first: прочитан body/ТЗ редакции 3 целиком, handoff (comment 6451173252),
риск-классы из пакета (migration: validation.py; perf: render-snapshot-*; ux: новые
i18n-ключи), затем независимо прослежен код по каждому классу риска и основным AC:

- `custom_components/houseplan/validation.py:29,1096-1099,2225` — change-aware
  гейт `alert_sources` (лосслесс-схема + семантическая проверка только для
  нового/изменённого блока, по образцу #845/value_badge).
- `custom_components/houseplan/marker_alerts.py` — структурная валидация:
  max 3, уникальные id, operand typing (bool не число, order-операторы только
  с числом, eq/ne с текстом).
- `src/marker-alert-config.ts`, `src/marker-alert.ts` — TS-парность с Python
  (regex id/entity, text-limit через `[...value].length`, NUMBER regex без
  тысячных разделителей, `alertNumber`/`alertOperand`/`evaluateMarkerAlert`).
- `src/marker-alert-source.ts` — owner-index (`markerAlertOwnership`),
  enum/number/text/unknown-классификация виджета, честная недоступность.
- `src/marker-alert-runtime.ts` — `ConfirmedMarkerAlerts`: единственный
  bounded-таймер на ближайший дедлайн, перечитывание на границе (`advance`
  вызывается и из таймера), noise/инверсия до срока отменяют кандидата,
  неопределённый результат трактуется как `false`-кандидат (матчит §lifecycle
  ТЗ).
- `src/marker-alert-view-runtime.ts` — `permitted()` включает
  `live_states !== false` и `_configWriteContext.current`; retire/foreign-owner
  сценарии проверены по коду (`current()` сверяет identity и точное содержимое
  правила).
- `src/view-runtimes.ts` — `wantsAlerts()` гейтит ленивую загрузку только
  наличием `alert_sources`; `ViewRuntimes.disconnect()`/`connect()` закрывает
  раннер вместе с картой.
- `src/device-presentation.ts` — `combined.status` переопределяется в `alarm`
  при любой customIssue с severity alarm (тот же канал, что и встроенные
  аварии); `customIssues` обнуляются при `!options.liveStates` (Static/kiosk
  не читает пользовательские причины).
- `src/marker-alert-presentation.ts`, `device-issues.ts` — общий
  discriminator native/threshold/external, native classifier не переписан.
- `src/device-copy.ts` — копия удаляет `more_info_entity`, не трогает
  `alert_sources` (соответствует заявленному в changelog поведению).
- `scripts/mutation-registry.mjs` — 5 заявленных в handoff мутантов
  (`threshold-constructor-crosses-instance-1000`,
  `threshold-skips-confirmation-1000`, `threshold-retains-foreign-owner-1000`,
  `threshold-writer-skips-alert-validation-1000`,
  `threshold-cold-view-imports-without-rule-1000`) зарегистрированы с
  patch/find-replace, указывающими на реальные строки текущей реализации —
  согласуется с таблицей «чем краснеет» в handoff.
- `src/i18n/{de,en,fr,ru}.json` и `src/i18n/settings/{de,en,fr,ru}.json` —
  по 38 ключей `marker.alerts.*` на локаль и единый ключ
  `backup.error.invalid_alert_sources` во всех четырёх каталогах.
- `docs/USER-GUIDE.ru.md:3729-3735` — раздел «Пороговые тревоги устройства»
  описывает конструктор, 3с, static-гейт, отсутствие новых counters —
  соответствует контракту.
- `docs/release-ledger/v1.82.0/1000.json` — category `major`, обоснование
  (новая пользовательская функция), golden-интенты перечислены точно.
- Changelog: сверены через `read:base:docs/CHANGELOG.md` и
  `read:base:docs/CHANGELOG.ru.md` (оракул), чтобы отличить то, что было в
  dev до этого диффа, от того, что добавил именно этот коммит — см. находку
  ниже.

### Выполненные гейты (reuse, не повторялись)

- `review-light-golden` / validate-gate на точном SHA:
  https://github.com/Matysh/houseplan-card/actions/runs/40566436175 — зелёный,
  подтверждён пакетом ревью.
- Из handoff приняты как пригодное свидетельство (зелёный proof подтверждает
  выполненные проверки, не корректность): `gate:small --base=…` PASS
  (build/typecheck/unit/bundle/unused/monolith/статические guard'ы),
  `process-gate` PASS; 5/5 обязательных smoke + 20/20 golden intents (пиксели
  сверены, разрешены только task-intent дельты); backend
  `test_marker_alerts.py test_ha_marker_alerts.py test_ha_import_export.py
  test_ha_backup_archive.py` — 347 PASS; парное immutable9db1e66f
  воспроизведение (0 различающихся пикселей таблицы); cold
  readonly/kiosk-запросы (chunk не грузится без правил); 5 мутантов
  `--check` PASS (0 executed/caught, статическая регистрация).

### Адресные проверки, которые я не повторял и почему

Ни один из покрытых выше рисков не требовал нового прогона: изменённые входы,
среда и oracle не менялись относительно зафиксированного evidence, а код,
который я трассировал независимо (таймер/owner/lazy-load/comparator/copy),
совпадает с тем, что описывает handoff и зелёный proof. Единственный найденный
дефект (см. ниже) — документационный, не требует отдельного исполняемого
доказательства: он виден прямым чтением файла.

## Находки

### F-CHANGELOG-DUP (Medium, в скоупе)

**Что:** В `docs/CHANGELOG.md` (строки 20–22 раздела «Unreleased») и
`docs/CHANGELOG.ru.md` (строки 27–29) этот же дифф добавил **три**
практически дублирующих пункта `(#1000)` про одну и ту же функцию
(«Configure up to three own-device threshold alarms…» / «Добавлены до трёх
пороговых тревог устройства…»), отличающихся только постепенно
дописываемым хвостом:

```
20: … native safety and maintenance keep their meaning. (#1000)
21: … native safety and maintenance keep their meaning. The constructor uses HA state choices and keeps changes local until the device is saved. (#1000)
22: … native safety and maintenance keep their meaning. The compact constructor uses common UI Kit controls and HA state choices and keeps changes local until the device is saved. (#1000)
```

(и симметрично в RU-файле, строки 27–29).

**Как воспроизвести:** `Read docs/CHANGELOG.md` офсет 1–25 — три идущих подряд
строки с `(#1000)`, из которых только последняя (22) — финальная/самая полная
версия текста. Сверено оракулом `read:base:docs/CHANGELOG.md` /
`read:base:docs/CHANGELOG.ru.md`: ни одной из трёх строк в базе до этого диффа
не было (т.е. все три добавлены именно этим диффом, не унаследованы из dev).
Для сравнения: соседний дубль `(#1087)` (строки 18–19 EN / 25–26 RU) уже
существовал в базе — он вне скоупа #1000, я его не поднимаю как находку.

**Почему это находка, а не вкусовщина:** это файл, который редакция
публикует как есть в Unreleased-ветке релизных заметок. Пользователь увидит
одну и ту же возможность описанной три раза подряд с разной (неполной →
полной) детализацией — и на EN, и на RU. Это явный артефакт незавершённой
правки (правка дописывалась по ходу раундов, старые черновые строки не
удалялись), а не три отдельных факта. При публикации релиза это попадёт в
пользовательский changelog в таком виде.

**Serverity:** Medium, в скоупе этого диффа — требует консолидации в один
пункт `(#1000)` в обоих файлах перед мерджем.

## Что проверено и корректно

- TS↔Python парность comparator/validator (id/entity regex, length limits,
  NUMBER-формат, bool-exclusion, order-operator↔number only) — построчно
  совпадает.
- Lifecycle 3000ms: единственный bounded-таймер на ближайший дедлайн, без
  per-tick polling; перечитывание на границе через повторный вызов `advance`;
  owner/retire/foreign-authority корректно обнуляют pending и entries.
- Приоритет причин: threshold/native alarm используют один и тот же
  `visual.status === 'alarm'` канал; attention не конкурирует с alarm;
  native maintenance classifier не переписан.
- Lazy-loading: `alerts`-чанк грузится только при наличии непустого
  `alert_sources` хотя бы у одного немаркированного-как-removed маркера;
  Static/`live_states:false`/disconnected не подключают раннер и не держат
  таймеров.
- Миграция: схема остаётся лосслесс (`vol.Optional("alert_sources"): object`),
  семантическая проверка — только change-aware (копия паттерна #845), старый
  план без `alert_sources` не переписывается.
- i18n: все 4 локали (`de/en/fr/ru`) содержат одинаковый набор из 38 ключей
  `marker.alerts.*` плюс единый `backup.error.invalid_alert_sources`.
- Copy: `alert_sources` не удаляется при копировании устройства, удаляется
  только HA-only `more_info_entity` — соответствует заявленному changelog.
- USER-GUIDE.ru.md содержит содержательный, точный раздел про функцию
  (конструктор, 3с, static-гейт, отсутствие новых counters).
- release-ledger `v1.82.0/1000.json`: category `major` с обоснованием,
  golden-интенты перечислены полно.
- 5 заявленных mutation-witness id реально зарегистрированы в
  `scripts/mutation-registry.mjs` с патчами по текущим строкам кода (не
  фиктивные ссылки).

## Чего не проверял

- Полный визуальный diff всех 20 новых/изменённых golden PNG — принят по
  зелёному proof (review-light-golden) и перечисленным в handoff SHA-сверкам;
  самостоятельно пиксели не пересравнивал.
- Полный объём `tests_backend` (кроме упомянутых 4 файлов) и весь
  `test/marker-alert-*.test.mjs` построчно — трассировал только пути,
  покрывающие найденные риски; остальное принято через зелёный
  `gate:small`/pytest proof.
- Производительность (`render-snapshot-reuse.ts`) не перемерял цифрами —
  проверил только механизм инвалидации (`_alerts.version` в presentation key)
  по коду; числовые дельты бандла (handoff) не пересчитывал.
- Остальные ~150 строк risk-класса ux (новые ключи `marker.alerts.*` построчно
  по смыслу перевода на DE/FR) не вычитывал слово в слово — проверил
  структурное соответствие (идентичный набор ключей, заполненность).

## Маршрут

`route: fix` (как зафиксировано в пакете). Medium-находка в скоупе →
**жёлтый** вердикт, возврат автору; отдельный issue не заводится.
Побочных находок вне скоупа #1000 нет (пример — дубль `#1087` в changelog —
предсуществующий, не от этого диффа, в outside_findings не выношу, так как
mode=issues требует Medium **вне скоупа**, а он не являлся бы находкой этого
ревью: предсуществующее состояние вне диапазона материала).

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImU0NTAxZjkxYWFlZWFhOGZjYTUwODU2MGM3MTNjNmUyNzA1MDc0YjY5ZGQ1YzI4ZWE3YWE1NjI3ZWU4YzI3MTgiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJhMzE4OGI4MzgyZmRiOGRjZDc2ZDkyN2RmM2EwNDAwNWJmN2NkMzRlMTk0ZWZlMTRjN2QwODllODhjNmRhMDdkIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDAwLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIyODAzNTcyMzhjZTYyODg1ZGM1YjcxNDI5MGNhMzVjMjM4NTQ5MTRhIiwidHJlZSI6ImZhNDQyOWFmMTExN2VlZjZiZjQ1NmViNzE0Zjg5YTg1NGMyOTIxY2MiLCJib2R5RGlnZXN0IjoiODhkYzNkMDFkNDJiNDVjODNlYmI4MDI5MDU1YzFkMTUwOWEyY2Y0MWUxZTNjM2ZlNDI1YjE2NDBhOGY3MGQ1ZCIsInByb2R1Y2VyUnVuIjoiNDA1Njg0MTY3MDYiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImIyYWRlMjg1MTdhNDFlZTg1Yjk4ZTc4ODM4MWZhNjI1MWM5NWJjZDcxMjBkNjZlNTA5Y2YxYzIyNjRiZWRhYjAiLCJ2ZXJkaWN0RGlnZXN0IjoiNzA0MzZmMTUwZDA0YWY2Mzg3M2QwZTlmODg2OTExZmQwM2EwN2Y2ZjI1ZGM2OTM0Nzk0NDc3MGI3M2UyYWI5MiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJmNjNkM2EzNWY0MDc5MWE1YjRjNWI1NzJiZmYwYThjOWM1ZGI1MWJkZjk4ZmE0MzJlZmYzZTEwNGQzZjI4OTQ0IiwiZmluZGluZ3MiOlt7ImlkIjoiRjEiLCJpc3N1ZSI6MTEwNywidXJsIjoiaHR0cHM6Ly9naXRodWIuY29tL01hdHlzaC9ob3VzZXBsYW4tY2FyZC9pc3N1ZXMvMTEwNyIsInBheWxvYWREaWdlc3QiOiI2N2RjMGMyMWQxZTY4NmMwMTY2M2MzZWVmNTBlYTQyYWRjMzExYzhlZjk0ZjhkOWZiMmIyYmU4MjI2YTllY2JkIiwiYm9keURpZ2VzdCI6ImU5YmU0NmY1ZTNmMGY4NGZhMzdlZjM0NWU0ZjcyNzQ4M2JiMTk3YjBiZjJjYTAyMzcyNDg5NzkyNmY1YzI3ZTciLCJ0aXRsZURpZ2VzdCI6IjI2NTcxY2IzM2QxY2Y5ZTAwZTgwMWI2OTcyYTA0MjMxNjM5N2QxZWI2MGViNzhhNjJhYTM0NjA2YWM2MDc5OGYifV0sImNvbW1lbnQiOnsiaWQiOjY0NTM2OTY1MTksInVybCI6Imh0dHBzOi8vZ2l0aHViLmNvbS9NYXR5c2gvaG91c2VwbGFuLWNhcmQvaXNzdWVzLzEwMDAjaXNzdWVjb21tZW50LTY0NTM2OTY1MTkiLCJib2R5RGlnZXN0IjoiZDFhOGUwZTcxNzgzMGY3MmMzZWVhMDQ0N2I5ZTFjNWQzYjc5N2I0M2Y0MGMzZjk4NjM5MjQ1NjQ2NmJiNDA1NiJ9fX0 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1000-device-thresholds`, коммит `280357238ce6` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `fa4429af1117eef6bf456eb714f89a854c2921cc`
  ```
  git log --all --format='%H %T' | grep fa4429af1117
  ```
- Тело issue: `88dc3d01d42b45c83ebb8029055c1d1509a2cf41e1e3c3fe425b1640a8f70d5d`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6ODQsIm91dHB1dF90b2tlbnMiOjIzNTI1LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEzNDU1MywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjQ0NzA0MjQsImNvc3RVc2RFc3RpbWF0ZSI6MS42Njc3MTQ4MDAwMDAwMDA0fV0sInR1cm5zIjo1NiwiZHVyYXRpb25NcyI6MzE4NDQ1LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS42Njc3MTQ4MDAwMDAwMDA0LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=84 output_tokens=23525 cache_creation_input_tokens=134553 cache_read_input_tokens=4470424 num_turns=56 -->
