# SPEC-REVIEW-1090-r2

**Issue:** #1090 — «Houseplan тормозит основной цикл HA при обновлении качества Zigbee-связи»
**Этап:** spec (PROCESS.md §2.4) · **Трек:** ask · **Заход:** r2 · **Блокирующих циклов:** 1/4 на входе в раунд
**Материал:** тело issue #1090, `bodyDigest: 2340dfe5f3077d41d729a4d8957f235341583340d26118c70733965926dc1df0` (`bodySha256: 3741ba7f994d222875b3dd209e8c1cf7d4174c84a66a7fc218a2acc4fcda9e6d`, REVIEW_CONTEXT/sources.json совпадают); рабочая копия на `b43619787d5c72938ee2015b1b0115874564fadf` (дерево `2b64868fef58c8755deb7c763f0bbdca2d12e9b2`), `changedFiles: []` — ветка `issue/1090-lqi-event-loop` по-прежнему не содержит диффа продуктового кода (черновик автора на этом этапе не читается, судится тело issue — §2.4/§11.8).
**Побочные находки / маршрут (#926):** доверенный снимок промпта (`mode:"issues"`, `round:2`) совпадает с `REVIEW_FINDINGS_POLICY`. Побочных находок вне скоупа не обнаружено — `outside_findings` пуст.
**Маршрут вердикта (#726):** `route: fix` (этап `spec` — `reclassify` здесь не применяется).

## Скоуп

Скоуп не менялся с r1: бэкенд-performance баг J1/J7 — переход LQI coordinator на поддерживаемый API HA device registry и разделение дорогой структурной инвалидации (scope/bindings) от дешёвого value-only обновления на каждом MQTT/ZHA-пакете, с сохранением всех существующих контрактов (0/unknown/invalid, ACL, MAX_DEVICES/MAX_SNAPSHOT_BYTES, Z2M/ZHA независимость) и нагрузочным до/после свидетелем. Правки только backend; View/UI/i18n не меняются. Ledger `line-fix` относительно `v1.82.0` c `introducedBy #1029` — принят в r1 по факту (`docs/release-ledger/v1.82.0/1029.json`), в r2 не затронут.

## Как проверялось

Предмет повторного раунда — дельта тела issue, а не задача целиком (§2.10). Единственная находка r1 — **M1** (Medium, в скоупе): способ доказательства «чем краснеет» для `DeviceEntry.config_entries`/composite-части AC1 не был согласован с реальной версией закреплённого HA-харнеса (`homeassistant==2026.8.3`, два релизных цикла раньше HA 2026.10, где эта депрекация реально появляется), и ТЗ не разводило это с уже проверяемой частью про `.devices`-коллекцию.

- Сверено авторское сообщение о правке (issue comment `6437895031`, 09:08:01Z): «M1 — AC1 и раздел 8 теперь явно отделяют настоящий HA 2026.8.3 от отказных внешних API-contract adapters… Продуктовый контракт и AC2–AC8 не менялись» — принято не на слово, а перепроверено по тексту.
- Построчно сопоставлен новый текст AC1 (раздел 7) и раздела 8 с текстом, который цитировала находка M1 в r1:
  - Старый текст AC1 (дословная цитата из `SPEC-REVIEW-1090-r1.md`): «Доказательство: backend HA-test с публичной современной collection/lookup формой, **отказными shim-счётчиками** и legacy/composite входами» — единый вид доказательства на обе части AC1, без указания версии harness.
  - Новый текст AC1: «Доказательство: backend — настоящий закреплённый HA 2026.8.3 плюс контрактные входные адаптеры современного registry API: collection разрешает только итерацию по entries, lookup — async_get; обёртка обычного DeviceEntry отклоняет чтение config_entries, но разрешает config_entry_id. Это явный white-box/API-contract guard вокруг обращений House Plan, **НЕ настоящий upstream deprecation shim HA 2026.10**. Legacy/composite входы проверяются отдельно pure backend тестом; соответствие форм официальному API проверяется ревью кода.»
  - Новый текст раздела 8 (добавлен): «Разделить версии доказательств: настоящий harness остаётся HA 2026.8.3; наличие в нём upstream deprecation-сигнала, введённого позднее, не предполагается. Современная collection и запрет обычного config_entries доказываются отказным внешним API-contract adapter/счётчиком обращений, а не выдаются за прогон настоящего HA 2026.10. Реальные доступные предупреждения harness учитывать отдельно; не требовать и не подделывать отсутствующий upstream shim.»
- Проверка по существу: новая формулировка убирает именно ту двусмысленность, которую называла M1. Теперь обе половины AC1 (`.devices`-коллекция и `config_entries`/composite) доказываются **одним и тем же** явно названным механизмом — внешним contract-double/white-box-обёрткой вокруг обращений House Plan к registry API, а не воображаемым upstream-shim'ом более новой версии HA, которого на закреплённом харнессе физически нет. Текст прямо называет, что считается «чем краснеет»: пока неисправленный код читает `device.config_entries` или использует mapping-доступ (`.get/.items/.values/.keys`, индексирование) к `devices`, обёртка это отклоняет/фиксирует счётчиком — это обычный negative-input case на текущей (ещё не отремонтированной) реализации, разрешённый общей политикой, а не исполнение мутанта. «Соответствие форм официальному API проверяется ревью кода» корректно разделяет два разных вида проверки: автоматический red/green по adapter'у и ревью того, что сам adapter действительно воспроизводит документированный контракт HA (блоги 24.08 и 15.09.2026) — это не подмена друг другом, а две независимые проверки одного вопроса.
- Адресно проверена осуществимость построения такой обёртки: `custom_components/houseplan/zigbee_lqi.py:130` (`set(device.config_entries)`) — единственное место чтения `config_entries` в LQI-коде, прочитано заново на материале раунда, расхождений с диагнозом нет. Установка пакета `homeassistant` на этапе `spec` не требуется и не производилась (#696); `tests_backend/test_ha_zigbee_lqi.py` уже строит `MockConfigEntry`/реальные `dr.async_get`/`er.async_get` объекты (подтверждено в r1), что даёт готовую точку для тонкой прокси-обёртки объекта `DeviceEntry` в новом performance-тесте без необходимости менять сам пакет `homeassistant` — открытый вопрос r1 снят, более конкретного непокрытого вопроса по тексту делты нет.
- Остальной текст ТЗ (разделы 1–6, 9, AC2–AC8) сверен построчно с телом issue и не отличается по существу от описанного в r1: числа (200 bindings/1000 сообщений — AC2; 200 ZHA-устройств — AC3; 200 radios/600 markers/4 consumers — AC7), формулировки «чем краснеет» для AC2/AC3/AC5/AC7, release-артефакты (раздел 9) и скоуп/не-скоуп (раздел 4) идентичны материалу r1; самостоятельная сверка подтверждает авторское «AC2–AC8 не менялись», а не принимает его как данность.

**Гейты:** код-гейты (`tsc`/`npm test`/`gate:small`) на этапе `spec` не требуются и не запускались — диффа продуктового кода по-прежнему нет (`changedFiles: []`), что соответствует §8/REVIEWER.md. Выполнено: адресное чтение обновлённого тела issue (разделы 7 AC1, 8), построчное сравнение с цитатами находки M1 из `SPEC-REVIEW-1090-r1.md`, повторное чтение `zigbee_lqi.py:112-184` (без изменений с r1) для подтверждения единственного места чтения `config_entries`, проверка отсутствия установленного `homeassistant` в среде (согласуется с #696, не находка).

## Находки

Новых находок нет. High: 0. Medium: 0.

## Что проверено и корректно

- M1 закрыт по существу, не формально: новая формулировка AC1/раздела 8 даёт единый, явно названный и осуществимый способ доказательства для обеих частей защитного AC1 (`.devices`-коллекция и `config_entries`/composite), с честным признанием версии закреплённого харнеса и без требования несуществующего upstream-сигнала 2026.10.
- Остальные семь AC (AC2–AC8), обязательные разделы §7.1, release-ledger классификация (`line-fix`, `introducedBy #1029`) и скоуп/не-скоуп — не менялись в этом раунде; переприняты из r1 без повторной полной проверки (раздел «Унаследовано из r1» ниже), делта их не затрагивает.
- Продуктовых вопросов владельцу по-прежнему нет; единственный технический вопрос r1 (версия harness vs. версия деприкации) снят автором текстом ТЗ, а не вынесен владельцу — соответствует правилу «технический вопрос решает ревьюер, не владелец».

## Чего не проверял

- Исполнение будущих тестов (`test_ha_zigbee_lqi_performance.py`, white-box `DeviceEntry`-обёртка) — кода ещё нет; появится в реализации (S6), не на этом этапе.
- Полный текст блогов HA от 24.08.2026 и 15.09.2026 — не открывался повторно; факты о датах депрекации взяты дословно из текста ТЗ, как и в r1.
- `docs/release-ledger/v1.82.0/1090.json` — не существует и не должен существовать на этом этапе (классификация — дело автора до S7); в r2 повторно не перепроверялась, так как делта её не касается.
- Добровольная ручная/GPU-приёмка владельцем — не применима (#929).

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| M1 (Medium, в скоупе): «чем краснеет» для `DeviceEntry.config_entries`/composite-части AC1 требовало отказного upstream-shim HA 2026.10, которого на закреплённом харнессе 2026.8.3 физически нет; ТЗ не разводило это с проверяемой `.devices`-частью | Текст AC1 (раздел 7) переписан: явно назван единый механизм доказательства — внешний contract-double/white-box-обёртка вокруг обращений House Plan к registry API, с явной оговоркой «НЕ настоящий upstream deprecation shim HA 2026.10»; раздел 8 добавляет «Разделить версии доказательств: настоящий harness остаётся HA 2026.8.3… не требовать и не подделывать отсутствующий upstream shim» | Тело issue #1090, раздел «### 7. Критерии приёмки» → AC1, и «### 8. План тестов и evidence», 2-й абзац (сверено по `bodySha256: 3741ba7f994d222875b3dd209e8c1cf7d4174c84a66a7fc218a2acc4fcda9e6d`) |

## Унаследовано из r1

Без повторной проверки в этом раунде, так как делта тела issue их не касается (подтверждено авторским «AC2–AC8 не менялись» и собственной построчной сверкой текста выше):

- Диагноз и «подтверждённый путь лишней работы» (`_project` безусловно на каждый `_z2m_value`, полный обход `self.bindings`, `dr.async_get(hass).devices.get`, `devices[device_id]`, `device.config_entries`, `devices.items()`/`devices[key]` в `represented_devices`) — построчно подтверждён чтением кода в r1; документ `docs/reviews/SPEC-REVIEW-1090-r1.md`, раздел «Как проверялось» и «Что проверено и корректно», материал `ce51a57e2300fa75f4cd088cff008ffd3cfd15d0`.
- Осуществимость контракта п.4 (ZHA 30-секундный проход не требует обращения к HA registry) — проверена в r1 по `zigbee_lqi_zha.py`/`zigbee_lqi.py:122`; документ `docs/reviews/SPEC-REVIEW-1090-r1.md`, «Что проверено и корректно», п.2.
- Формулировки «чем краснеет» для AC2/AC3/AC5/AC7 и осуществимость паттерна операционных счётчиков поверх `dr.async_get`/`DeviceRegistry` в `tests_backend/test_ha_zigbee_lqi.py` — проверены в r1; тот же документ, «Что проверено и корректно», п.3.
- `User-Visible: yes`, оба changelog, release-артефакты (ARCHITECTURE/DEVELOPMENT/STATUS) и ledger-классификация `line-fix`/`introducedBy #1029` относительно `docs/release-ledger/v1.82.0/1029.json` и `docs/CHANGELOG.md` — проверены и согласованы в r1; тот же документ, «Что проверено и корректно», п.4.
- Скоуп/не-скоуп, исключение пересечений с #1029/#1053 — проверено в r1; тот же документ, «Что проверено и корректно», п.5.

## Вердикт

Зелёный. Единственная находка r1 (M1) закрыта по существу: AC1 и раздел 8 теперь явно и осуществимо разводят доказательство для `.devices`-коллекции и для `DeviceEntry.config_entries`/composite-сценария одним и тем же честно названным white-box/contract-adapter механизмом, без требования несуществующего на закреплённом харнессе (HA 2026.8.3) upstream-сигнала 2026.10. Делта локальна (только AC1 и раздел 8), независимо перепроверена построчно, новых находок не выявлено; остальные семь AC, обязательные разделы §7.1 и release-артефакты наследуются из r1 без повторной проверки. Продуктовых вопросов владельцу нет. ТЗ готово к `S5-ready`.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImI1ZGY0NWNjMDg5MDNiZTdmMTA3ZjY1ZThlZjVmNWMzNDViN2QzOGQ0ZDFkOGRkNjNiZmU5NzMxOTg0MzVhOTYiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJlYjg1MjZjM2E1ODNmYWNmMmM1YzAzZTExNjY1ZjFiNDdiOThkNjhjMTRmMDIyNTY4YTMzNTkwNjU5MjI2MmI2IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDkwLCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiJiNDM2MTk3ODdkNWM3MjkzOGVlMjAxNWIxYjAxMTU4NzQ1NjRmYWRmIiwidHJlZSI6IjJiNjQ4NjhmZWY1OGM4NzU1ZGViN2M3NjNmMGJiZGNhMmQxMmU5YjIiLCJib2R5RGlnZXN0IjoiMjM0MGRmZTVmMzA3N2Q0MWQ3MjlhNGQ4OTU3ZjIzNTM0MTU4MzM0MGQyNjExOGM3MDczMzk2NTkyNmRjMWRmMCIsInByb2R1Y2VyUnVuIjoiNDA0Nzg1MDk4NTQiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImVmM2NmMTQwNGU2OTgwNmE4ZWRkZGQ3NGViZWE4YjQ3ZTRkYWUyNTYyYWMzZDEyODAwM2Q1OGE0MzYxMDJkYTAiLCJ2ZXJkaWN0RGlnZXN0IjoiZTRiOTBhZTRhYTkwZTBmMTM4MDc4M2I1NGVjZTM4ZWQ4M2Y4Zjc3YjUzYTNlYTUyZWMzMDU5N2JkMmJiOWEzYiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI3ZDdmMTY4NWIyOGU0OWRkMDRhOWU0NTVkM2NlZjViMDE3ZjdmNTZmYmI0NzIwMGY2NzhiMjdkNDdlMTk3OThlIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDM4MDEzNTE0LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDkwI2lzc3VlY29tbWVudC02NDM4MDEzNTE0IiwiYm9keURpZ2VzdCI6IjRjZmI3ZTU3MmI3NGNkYTBlZTA4NTFmY2Y4OGQ5NDhiMDc5ZDA5ZDMyMzczMzU4Yzk3YTQzYWExZTBjMjQ4ZWIifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `b43619787d5c` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `2b64868fef58c8755deb7c763f0bbdca2d12e9b2`
  ```
  git log --all --format='%H %T' | grep 2b64868fef58
  ```
- Тело issue: `2340dfe5f3077d41d729a4d8957f235341583340d26118c70733965926dc1df0`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTgsIm91dHB1dF90b2tlbnMiOjE4OTA4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjg1NjIzLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NDkwMzQ3LCJjb3N0VXNkRXN0aW1hdGUiOjAuNjI5Njc3Mzk5OTk5OTk5OX1dLCJ0dXJucyI6MTcsImR1cmF0aW9uTXMiOjIyNTUyNiwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuNjI5Njc3Mzk5OTk5OTk5OSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=18 output_tokens=18908 cache_creation_input_tokens=85623 cache_read_input_tokens=490347 num_turns=17 -->
