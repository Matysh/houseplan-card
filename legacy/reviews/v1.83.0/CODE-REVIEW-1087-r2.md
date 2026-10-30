# CODE-REVIEW — issue #1087, заход r2

**Материал:** `95806b097d864058a15d26981f3ce6d4c06b5614` (рабочая копия на нём;
`git log --oneline origin/dev..HEAD`:
`95806b097` docs: review document for #1087 ·
`cabe9691b` docs(devices): retain behavior summary before independent review ·
`f2c2bd5ae` fix(devices): register and localize the HA dialog validation error ·
`0e0426974` fix(devices): choose HA dialogs independently of displayed values).
Трек: `ask`. Этап: `code`. ТЗ ревью пропущено по разовому разрешению владельца от
2026-10-27 (тело issue). Повторная передача на код-ревью — после зелёного r1 и
разрешения конфликта слияния с принятым #1090 (комментарий `#6437977726`).

## Скоуп

Исправление #1087 без изменений с r1: открытие HA (tap «More Info» и кнопка
«Открыть в HA» информационной карточки) резолвится независимым общим resolver
`src/device-more-info.ts`, с опциональным ручным выбором собственной сущности
устройства (`markers[].more_info_entity`, picker под действием More Info).
Правый клик View остаётся открытием настроек Houseplan (#997), не затронут.

Обслуживаемая строка SCOPE: J3/J4/J6 — предсказуемое управление своим
устройством с плана без путаницы между измерением и функциональной сущностью.

## Как проверялось

Static-first: прочитаны `docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md`
(через PROCESS.md-ссылки), тело issue #1087 (ТЗ, контракт, AC-таблица,
уточнения владельца от 2026-10-27 о правом клике и о команде «передавай»),
хендофф `#6437977726`, `docs/reviews/CODE-REVIEW-1087-r1.md` целиком.

Диапазон и дифф этого захода прочитаны оракулом `read:log`/`read:diff`
(126 933 Б, прочитан целиком постранично) и независимо сверены файл за файлом
с материалом r1 (`5d21cf972`):

- Список изменённых файлов (`diff --git` заголовки) **идентичен** списку из
  r1/`REVIEW_CONTEXT.changedFiles` — новых файлов в скоупе не появилось, ни
  один файл из r1 не исчез.
- Все продуктовые/тестовые хунки — `custom_components/houseplan/const.py`,
  `import_export.py:1602`, `support_config_projection.py`, `support_package.py`,
  `support_wire_schema.py` (обе копии, включая `scripts/support-relay/...`),
  `validation.py:1077-1092`, `src/device-more-info.ts` (новый, все функции
  `resolveDeviceMoreInfoTarget`/`moreInfoEntityFailure`/`moreInfoEntityCandidates`
  построчно сверены с r1), `src/devices.ts` (export `DEVICE_STATE_DOMAINS`),
  `src/houseplan-card.ts` (`_openDeviceMoreInfo`, оба HA-входа, условие кнопки
  `d.primary || d.marker?.more_info_entity`, правый клик не тронут —
  подтверждено отсутствием изменений контекстного меню в диффе и свидетелем
  `rightClickStillOpensSettings` в `demo/smoke_device_more_info.mjs`),
  `src/editors/marker-dialog.ts`/`marker-form-state.ts`/`marker-more-info.ts`
  (picker: `filter:`-токен на own-roster, Auto/manual, dirty/Cancel),
  `src/houseplan-editor-runtime.ts` (draft/save/`moreInfoDraftInvalid`),
  `src/marker-more-info-fields.ts`, `src/types.ts`, i18n (4 языка × 2
  неймспейса, ключи идентичны), `test/*`, `tests_backend/*`, мутационный
  реестр (`more-info-invalid-write-1087`, `more-info-tap-opens-measurement-1087`
  — патчи соответствуют актуальному исходнику, honestly помечены «не
  исполнялся») — **побайтово те же правки**, что независимо разобраны и
  приняты в r1. Расхождений в продуктовом коде между материалом r1 и текущим
  материалом не найдено.
- Отличие от r1 ограничено документацией/реестрами после разрешения конфликта
  с #1090: новые абзацы в `docs/ARCHITECTURE.md` (#1087-резолвер), `STATUS.md`
  (сводка + перегенерированные счётчики Tests 5660/686/584/459 — сгенерированный
  блок `status-snapshot.mjs`, не ручной текст), `CHANGELOG.md`/`.ru.md`,
  `CONFIG-COMPATIBILITY.md`, `DEVELOPMENT.md`, `DEVICE-PRESENTATION.md`; новый
  файл `docs/release-ledger/v1.82.0/1087.json` (`stable-fix` от v1.82.0,
  milestone 1.83, два `visual.golden` с `expectation: "new"`); новый файл
  `docs/reviews/CODE-REVIEW-1087-r1.md` (сам опубликованный отчёт r1, закоммичен
  в ветку); `docs/testing-notes/mutation-browser-guards.md` (счётчик
  537→538 с новым witness); `scripts/ci-registry-inventory.json`/
  `monolith-baseline.json`/`bundle-budget.mjs`/`config-field-registry.mjs`/
  `config-schema.json`/`smoke-links.mjs` — производные CI-индексы, пересчитанные
  под новую базу (`fd62d98ee`, после #1090). Ни один из этих файлов не меняет
  продуктовое поведение #1087.

CI-доказательство: системный контекст подтверждает зелёный `validate-gate` для
точного текущего материала `95806b097d864058a15d26981f3ce6d4c06b5614`
(https://github.com/Matysh/houseplan-card/actions/runs/40488293154,
«review-light-golden proof is complete»). Это покрывает build/typecheck,
product+tooling unit, backend pytest, `process-gate --issues`,
`mutation-gate --check` (статический), golden-сцены `more-info-dialog-*` —
для материала этого раунда, не только r1.

Гипотезы дефектов независимо перепроверены на дельте r1→r2 (не на всём коде
заново, т.к. продуктовый код не менялся): реальное окружение vs фикстура,
холодный старт/гонка, границы входов (foreign/disabled/missing/virtual),
правый клик — выводы r1 остаются в силе, расхождений не найдено.

## Гейты — что прогнано и что переиспользовано

| Гейт | Статус | Источник |
|---|---|---|
| `read:log`, `read:diff` (материал `95806b097`) | выполнено сейчас | `run_check`, этот раунд |
| Build/typecheck, product+tooling unit, backend pytest, `process-gate --issues`, static `mutation-gate --check`, golden-сцены `more-info-dialog-desktop-en`/`-mobile-ru` | **зелёные на точном материале `95806b097d864058a15d26981f3ce6d4c06b5614`** | validate-gate: https://github.com/Matysh/houseplan-card/actions/runs/40488293154 («review-light-golden proof is complete»); переиспользовано, не повторялось |
| `node --test test/device-more-info.test.mjs`, `test/dialog-baseline.test.mjs`, `test/resize-optimize.test.mjs`, `test/golden-matrix.test.mjs` | покрыто тем же зелёным CI | — (продуктовый код не менялся с r1) |
| `node demo/smoke_device_more_info.mjs` (21 проверка, вкл. `rightClickStillOpensSettings`, 0 `callService`) | покрыто тем же CI | — |
| `pytest tests_backend/test_validation.py test_ha_import_export.py test_marker_history.py test_support_package.py` | покрыто тем же CI | — |
| Мутации (продуктовые) | **не прогонялись** — правило «мутанты не выполняются вне ночного workflow»; оба witness (`more-info-invalid-write-1087`, `more-info-tap-opens-measurement-1087`) зарегистрированы, патчи сверены с актуальным исходником построчно, честно «не исполнялся» | #699, `mutation-browser-guards.md` |
| Полная regression/полная golden-матрица/performance | **не прогонялись** — не названы в AC, объём гейтов ревью соразмерен задаче (§8) | — |

Независимая построчная сверка диффа r1→r2 (выше) не выявила ни одного
непокрытого AC, риска или negative-input case, появившегося между раундами —
дополнительный адресный прогон не потребовался. Повторные общие
`tsc`/`build`/`npm test`/`gate:small` не запускались, так как не являются
основанием для ревью и доказательство материала уже пригодно и не инвалидировано.

## Риск по изменённым участкам (#707) — трек ask, сверка с AC ТЗ

| Класс | Участок | Покрывающий AC/раздел ТЗ |
|---|---|---|
| migration | `import_export.py:1602` (поле в списке virtualize-strip); `validation.py:1080-1083` и соседние строки change-aware ветки | AC5 (`test_issue1087_..._virtual_copy_strips_it`, `..._survives_real_transfer...`) + раздел «Модель данных и совместимость» |
| perf | `marker-more-info.ts:34` (`filter:` токен picker) | Раздел «i18n, производительность и ввод» («список только по текущему device roster») + AC3 |
| ux | новые ключи i18n (`backup.error.invalid_more_info_entity`, `toast.more_info_target_unavailable`, `marker.more_info_*` × 4 языка × 2 неймспейса) | AC7 (4 языка, подсказки/поиск/нет результатов/отказ) + AC2 («понятный отказ») |

Все классы покрыты именованным AC/разделом ТЗ — без изменений относительно r1
(продуктовый код этих участков не менялся). **Маршрут: `fix`**.

## Находки

Нет находок High или Medium в скоупе. Унаследованное Low-наблюдение из r1
(функционально избыточная, но безвредная идиома `role.find(isControllable) ||
role[0]` в `src/device-more-info.ts`) остаётся в силе без изменений — код не
менялся, повторный разбор подтверждает прежний вывод (не блокирует).

## Что проверено и корректно

AC1–AC7 — независимо подтверждены построчной сверкой кода r2 с ранее принятым
кодом r1 (идентичен) плюс зелёным CI точного материала r2:

- AC1: Auto отделён от иконки структурно (`resolveDeviceMoreInfoTarget` не
  принимает icon); synthetic-свидетель и native smoke с точным
  `hass-more-info.entityId` покрыты переиспользованным CI.
- AC2: явная цель точна; unavailable/unknown валидны; foreign/deleted/
  disabled/no-readable-state/malformed отказывают без fallback.
- AC3: picker — Auto + свои сущности, поиск внутри списка, Save/Cancel/dirty,
  сброс при смене binding, Escape закрывает только picker, без overflow на
  360/1100 px.
- AC4: entity-binding точен, virtual не получает HA-цель, открытие не вызывает
  служб (0 `callService` в native smoke).
- AC5: sparse-поведение, survival через full/space-перенос/историю/Optimize;
  support отдаёт только псевдонимизированный id, обе wire-schema синхронны.
- AC6: выбор HA-диалога не меняет presentation/primary/value_source; правый
  клик View (#997) не тронут — подтверждено отсутствием изменений в этом коде
  и прогнанным `rightClickStillOpensSettings`.
- AC7: новые golden-сцены ссылаются на существующую фикстуру; размеры
  picker/диалога проверены golden+native smoke; системный контекст подтверждает
  «review-light-golden proof is complete» для точного материала этого раунда.

Трейлеры/changelog/release-ledger/registry (`config-field-registry.mjs`,
`config-schema.json`, `ci-registry-inventory.json`, `monolith-baseline.json`,
`bundle-budget.mjs`) согласованы с новой базой; `docs/release-ledger/
v1.82.0/1087.json` — `stable-fix` от v1.82.0, milestone 1.83, корректно
обоснован.

## Чего не проверял

- Не выполнял продуктовые мутации (вне ночного workflow; оба witness приняты
  как зарегистрированные, не исполненные).
- Не запускал полную регрессию/полную golden-матрицу/performance-гейты — не
  названы в AC, предрелизный объём (§8).
- Не пересчитывал вручную сгенерированные STATUS Tests-счётчики
  (5660/686/584/459) — сверены `status-snapshot.mjs --check` в переиспользуемом
  зелёном CI точного материала.
- Ручную dev/GPU-приёмку владельцем не требую и не фиксирую как отсутствующую
  находку (добровольна, #929).

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| — (r1 был зелёным, High 0/Medium 0, Low 1 необязательное) | Находок не было; Low-наблюдение не требовало правки и осталось неизменным | `docs/reviews/CODE-REVIEW-1087-r1.md`, раздел «Находки» |

## Унаследовано из r1

Приняты без повторного независимого разбора «с нуля» (переподтверждены
построчной дифф-сверкой выше, так как продуктовый код между r1 и r2
побайтово идентичен):

- Полный независимый разбор `src/device-more-info.ts`, `src/houseplan-card.ts`
  (`_openDeviceMoreInfo`, оба HA-входа, правый клик), редактора
  (draft/dirty/Cancel/Escape/picker), Python-валидации/support-проекций/обеих
  wire-schema, i18n 4 языков, golden-сцен и мутационного реестра — документ
  `docs/reviews/CODE-REVIEW-1087-r1.md`, материал `5d21cf9728eff7b5f61ac4c5fae954a8197a7c72`.
- Зелёный CI материала r1: https://github.com/Matysh/houseplan-card/actions/runs/40482035728
  (product/tooling/docs) — факты и адресные доказательства, перечисленные в r1,
  не повторялись здесь, только сверены на отсутствие продуктового дрейфа.
- Вердикт r1: зелёный, High 0 / Medium 0, маршрут `fix`, блокирующих циклов 0/4.

---

Вердикт: зелёный · заход r2 · блокирующих циклов 0/4 · High: 0 · Medium: 0 ·
маршрут находок: `issues` (новых побочных находок нет) · Документ:
`docs/reviews/CODE-REVIEW-1087-r2.md`

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImJjMWZlZDIxOGJkOWI5ZTM4YmU5NGIyZDRlZjQzZTRkZTU3Njk2MDA2MGI0MzcyMGJiOWEzNzE3M2YxYTRjYmIiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI4ODFkOTBjZmQ3NDVlNTBmMjY1MWVjODljOTc1MzI5YmUwODliMDc0ODNhYTQ4MzIxMDk3ZDNhYmFhMmJhNjUzIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDg3LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiI5NTgwNmIwOTdkODY0MDU4YTE1ZDI2OTgxZjNjZTZkNGMwNmI1NjE0IiwidHJlZSI6ImRjMzNmMDNmNjM3MThkNzhlNTMwOTc1YThlYmQxYWQ0ZDZmMjY3ZDUiLCJib2R5RGlnZXN0IjoiNTdkZmJmNzJlODQxZjczMjJiYWRmYWFhZGM4OWU2NTcxMmU3ZDM0MGYwOTVkMzZkOTc2MjJhYTc2Zjk4ZGU4MiIsInByb2R1Y2VyUnVuIjoiNDA0ODkzMDA4NjkiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImFjNjA1MGNkY2MzMTBkM2U3ZWI3YzhkN2M3MjdkN2NjMmM0NTUzZGIxOGUxZmJlNWM5YjI1MTJhNmY4YTU1ZTMiLCJ2ZXJkaWN0RGlnZXN0IjoiYTljOTY2ODY5MzY3NzQyN2Q0YjQ5MWJkNzI0NzA4MDYyM2IwOGExMjc3ZGI5M2E0YmMxNTQ2ZjI2ZTBjNGEyMyIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiIzNGRlMTk3MjRkYTk5ZGVkYTEyMzdmNjFmZjEyYjRkNjExMDZiMGM5ZjkxZGY4ODRmZmY5MTE5OWZkMzhjYTQ0IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDM5ODAwMDI1LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDg3I2lzc3VlY29tbWVudC02NDM5ODAwMDI1IiwiYm9keURpZ2VzdCI6IjU0YmNlNGJlMzA1MDYzMzZmYWEyYjYxODliYjQxMGM1ZGYwOTg5YWZiMWE3ODNhZDBmZDVhZjJjMWFhNDY4MDIifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1087-ha-more-info-target`, коммит `95806b097d86` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `dc33f03f63718d78e530975a8ebd1ad4d6f267d5`
  ```
  git log --all --format='%H %T' | grep dc33f03f6371
  ```
- Тело issue: `57dfbf72e841f7322badfaaadc89e65712e7d340f095d36d97622aa76f98de82`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40489300869,"run_attempt":1,"digest":"6c7b25b35fd0c3a4dfbc5d76ec67f475c15b0d560bf2cfc35f6ef3ec19255950"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MzIsIm91dHB1dF90b2tlbnMiOjEzNzYzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjk2MDgwLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MTE2Mjk4NSwiY29zdFVzZEVzdGltYXRlIjowLjc1NDYxMDk5OTk5OTk5OTl9XSwidHVybnMiOjI0LCJkdXJhdGlvbk1zIjoxODI2ODcsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjowLjc1NDYxMDk5OTk5OTk5OTksImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=32 output_tokens=13763 cache_creation_input_tokens=96080 cache_read_input_tokens=1162985 num_turns=24 -->
