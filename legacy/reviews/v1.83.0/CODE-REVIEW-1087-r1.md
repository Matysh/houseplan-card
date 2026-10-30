# CODE-REVIEW — issue #1087, заход r1

**Материал:** `5d21cf9728eff7b5f61ac4c5fae954a8197a7c72` (рабочая копия на нём; `git log --oneline origin/dev..HEAD`:
`5d21cf972` docs(devices): retain behavior summary before independent review ·
`6d9176ab4` fix(devices): register and localize the HA dialog validation error ·
`879953630` fix(devices): choose HA dialogs independently of displayed values).
Трек: `ask`. Этап: `code`. ТЗ ревью пропущено по разовому разрешению владельца от 2026-10-27 (см. тело issue и комментарии); код-ревью запущено по отдельной команде владельца «передавай» (комментарий #6437977726).

## Скоуп

Исправление #1087: открытие HA (обычный tap «More Info» и кнопка «Открыть в HA» в
информационной карточке) больше не повторно использует `presentation-primary`
(который может указывать на измерительную сущность из-за автоматической иконки
`mdi:thermometer`/`mdi:air-filter`), а резолвится независимым общим resolver
(`src/device-more-info.ts`), с опциональным ручным выбором собственной сущности
устройства (`markers[].more_info_entity`, UI — picker под действием More Info).
Правый клик View остаётся открытием настроек Houseplan (#997), не затронут.

Обслуживаемая строка SCOPE: J3/J4/J6 — предсказуемое управление своим устройством
с плана без путаницы между измерением и функциональной сущностью.

## Как проверялось

Static-first: прочитаны `docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md`,
тело issue #1087 целиком (ТЗ, контракт выбора/открытия, UX, модель данных,
AC-таблица, все комментарии владельца/автора вплоть до хендоффа
#6437977726), `docs/DEVICE-PRESENTATION.md`, `docs/CONFIG-COMPATIBILITY.md`,
`docs/ARCHITECTURE.md`, `docs/USER-GUIDE.ru.md`/`.md` (новые разделы).

Диапазон и дифф прочитаны оракулом `read:log`/`read:diff` (полный unified diff,
101 019 Б, прочитан целиком постранично). Независимо от авторских выводов
прослежены:

- `src/device-more-info.ts` (новый): `resolveDeviceMoreInfoTarget`,
  `moreInfoEntityFailure`, `moreInfoEntityCandidates` — все ветки (virtual,
  bindingStatus≠active, exact/entity-binding, explicit/malformed, auto-резолюция
  через `resolvedDeviceStateEntities` на отфильтрованном own-roster, отсутствие
  state). Сверено с `src/devices.ts` (`primaryEntity`, `resolvedDeviceStateEntities`,
  `DEVICE_STATE_DOMAINS`) и `src/logic.ts` (`isControllable`), чтобы подтвердить:
  новый resolver не вызывает `primaryEntity()` и потому структурно не зависит от
  иконки ни при каком её значении — это снимает первоисточник бага (приоритет
  измерения из авто-иконки), а не просто обходит частный случай.
- `src/houseplan-card.ts`: `_openDeviceMoreInfo` (новый) — проверка актуальности
  binding (`bindingKind`/`bindingRef` сверяются с живым `this._devices`),
  `_deviceBindingActive` (переиспользован, включая его toast при
  ha_disabled/unverified), ветвление `entityId` → `_openMoreInfo` /
  `explicit` → toast отказа / иначе → `_infoCard` (безопасный no-op). Оба входа
  (`more-info` tap action и кнопка «Open in HA» инфо-карточки) сведены к одному
  вызову `_openDeviceMoreInfo`; правый клик (контекстное меню) в диффе не
  тронут — проверено отсутствием изменений в этом коде.
- `src/editors/marker-more-info.ts`, `src/marker-more-info-fields.ts`,
  `src/editors/marker-dialog.ts`, `src/houseplan-editor-runtime.ts`: draft
  (`moreInfoEntity`/`moreInfoTouched`/`moreInfoOpen`/`moreInfoFilter`), сброс при
  смене binding (оба места — ha/virtual), `markerDirty`/`MARKER_DIALOG_TRANSIENT_KEYS`
  (filter/open — transient, entity/touched — нет), `markerProblems` →
  `canSave`/footer «review N fields» (переиспользованный путь, не новый), запись
  `markerMoreInfoFields` (Auto-touched стирает ключ, untouched — лосслесс
  сохранение, включая явный `null`).
- `custom_components/houseplan/validation.py`: новая ветка в
  `validate_marker_value_badges` — change-aware (`validate_all` или смена
  значения/binding), формат через переиспользуемый `_CONTROL_ENTITY_ID_RE`,
  согласованность с `binding` (`device:`/`entity:` ровно свою сущность);
  `more_info_entity is None` (включая явный `null`) всегда пропускает проверку
  (Auto). Сверено, что backend не содержит и не требует HA-реестра (как и
  заявлено — ownership/enabled проверяет только runtime).
- `custom_components/houseplan/import_export.py`: добавление `more_info_entity`
  в список полей, стираемых при виртуализации дубликата (строка 1602) — то есть
  чужой reference не переживает превращение в virtual-копию; подтверждено тестом
  `test_issue1087_..._virtual_copy_strips_it`.
- `support_config_projection.py`/`support_package.py`/обе копии
  `support_wire_schema.py` (integration и `scripts/support-relay/...`) —
  идентичные правки (`more_info_entity` → `"entity"`/`REF_OR_NULL`), псевдонимизация
  подтверждена тестом `test_issue1087_more_info_entity_uses_the_same_private_entity_namespace`.
- i18n: все 4 языка (`ru/en/de/fr`) получили одинаковый набор ключей в обоих
  неймспейсах (`i18n/*.json` и `i18n/settings/*.json`); формулировки сверены с
  `docs/USER-GUIDE.ru.md`/`.md` и с уже существующим `tap.more_info` (строка
  «Диалог HA (more-info)» в ru.json — не изобретена, использована как есть).
- Golden/демо: `demo/golden/harness.mjs`/`matrix.mjs` — новые сценарии
  `more-info-dialog-desktop-en`/`-mobile-ru` ссылаются на уже существующую
  фикстуру `switch.golden_washer_child_lock` (`demo/fixtures/visual-matrix.mjs`,
  не изменён в этой задаче) — не выдуманная сущность.
  `demo/smoke_device_more_info.mjs` — построчно прочитан: auto-открытие
  climate, точный ручной выбор, отказ foreign/deleted без fallback, сохранение
  Auto стирает ключ, Cancel откатывает обе смены (binding+override), Escape
  закрывает только picker, поиск не делает dirty, 4 ширины/темы без overflow,
  0 `callService` в конце прогона.
- Мутационный реестр: 2 новых witness
  (`more-info-invalid-write-1087`, `more-info-tap-opens-measurement-1087`) и
  обновление существующего `view-edit-direct-entry...`-подобного witness под
  изменившийся литерал кода (строка `_openDeviceMoreInfo` вместо
  `_openMoreInfo(p)`), отчёт честно помечает «не исполнялся» — согласно общей
  политике это допустимо вне ночного прогона; патч/replace в реестре прочитан и
  соответствует фактическому исходнику (не фиктивная регистрация).

Гипотезы дефектов, которые были целенаправленно проверены и отклонены как
несущественные (разобрано чтением, не исполнением):

- **Реальное окружение vs фикстура.** Resolver не завязан на отдельный «тестовый»
  путь: `resolveDeviceMoreInfoTarget` — чистая функция от `hass`/`registry`/
  `device`, используется и в runtime (`houseplan-card.ts`), и в редакторе
  (`marker-more-info.ts`) без дублирования логики.
- **`role.find(isControllable) || role[0]` в Auto-ветке `device-more-info.ts`.**
  При прочтении до конца: `role` всегда однороден по домену внутри каждой ветки
  `resolvedDeviceStateEntities` (кроме составной Power-топологии, где
  `role[0]` — lifecycle-сущность, не входящая в `DEVICE_STATE_DOMAINS`, и в этом
  случае код и так уходит в `device.primary`, который сам содержит тот же
  `isControllable`-паттерн). Итог: ветвление детерминированно сходится к тому
  же результату, что и исторический `primaryEntity()`, без иконки. Код
  переиспользует существующую идиому ради единообразия, а не из-за новой
  логики — не дефект, но его польза в этой ветке не видна без параллельного
  чтения `devices.ts`; отмечаю как Low-наблюдение, не блокирует.
- **Кнопка «Open in HA» на неактивном binding.** Условие показа расширено с
  `d.primary` до `d.primary || d.marker?.more_info_entity`: для сущности,
  которая была явно выбрана, пока binding был активен, а затем стала
  `ha_disabled`/`unverified`, кнопка может показаться, но клик проходит через
  `_deviceBindingActive(current)` (default `notify=true`), который показывает
  штатный toast `ha_disabled_action`/`ha_binding_unverified` — не тихий no-op,
  не обращение к чужому устройству.
- **Отмена/смена binding/tap action.** Прослежено, что `moreInfoEntity`/
  `moreInfoTouched` входят в итоговый draft и, следовательно, в `markerDirty` и
  в `Cancel`-откат (весь объект драфта отбрасывается), а `moreInfoOpen`/
  `moreInfoFilter` объявлены transient и не участвуют в dirty/в сохранении.
- **Гонка/холодный старт.** Никаких новых асинхронных операций не добавлено —
  resolver синхронный, единственный новый I/O — существующее событие
  `hass-more-info`; async-риск в ТЗ назван отсутствующим, подтверждено чтением
  (нет новых `await`/`fetch`/`callService` на пути открытия).

## Гейты — что прогнано и что переиспользовано

| Гейт | Статус | Источник |
|---|---|---|
| `read:diff`, `read:log` (материал `5d21cf972`) | выполнено сейчас | `run_check`, этот раунд |
| Build/typecheck, product+tooling unit (node), backend pytest, `process-gate --issues`, `mutation-gate --check`, `config-compatibility-inventory`, `status-snapshot --check` | **зелёные на точном материале `5d21cf9728eff7b5f61ac4c5fae954a8197a7c72`** | validate-gate: https://github.com/Matysh/houseplan-card/actions/runs/40482035728 (подтверждено системным контекстом: «review-light-golden proof is complete»); переиспользовано, не повторялось |
| `node --test test/device-more-info.test.mjs` (14 кейсов), `test/dialog-baseline.test.mjs`, `test/resize-optimize.test.mjs`, `test/golden-matrix.test.mjs` | покрыто тем же зелёным CI-прогоном выше | — |
| `node demo/smoke_device_more_info.mjs` (новый, 21 проверка) | покрыто тем же CI (product включает named smoke по diff) | — |
| `pytest tests_backend/test_validation.py test_ha_import_export.py test_marker_history.py test_support_package.py` | покрыто тем же CI | — |
| Golden-сцены `more-info-dialog-desktop-en`/`-mobile-ru` (`ci:golden`-путь) | покрыто — прямое системное подтверждение «review-light-golden proof is complete» для этого материала | не повторялось |
| Мутации (продуктовые) | **не прогонялись** — по правилу «мутанты не выполняются во время разработки/ревью, только ночью»; оба новых witness зарегистрированы и прочитаны построчно (патч соответствует актуальному исходнику) | честно помечено «не исполнялся» в хендоффе и здесь |
| Полная regression/полная golden-матрица/performance | **не прогонялись** — не названы в AC, объём гейтов ревью соразмерен задаче (§8), это дело предрелизного гейта | — |

Адресного пробела (непокрытого AC, риска или negative-case) по итогам
независимого разбора не найдено — дополнительный прогон не потребовался.

## Риск по изменённым участкам (#707) — трек ask, сверка с AC ТЗ

| Класс | Участок | Покрывающий AC/раздел ТЗ |
|---|---|---|
| migration | `import_export.py:1602` (поле в списке virtualize-strip) | AC5 («manual переживает … transfer … support не выдаёт raw ID», подтверждено `test_issue1087_...survives_real_transfer_and_virtual_copy_strips_it`) |
| migration | `validation.py:1080-1083` (change-aware валидация нового поля) | AC5 + раздел «Модель данных и совместимость» («Валидировать тип/формат и допустимость изменённой ссылки change-aware, существующие старые/неразрешимые ссылки не стирать автоматически») |
| perf | `marker-more-info.ts:34` (`filter:` токен picker) | Раздел «i18n, производительность и ввод» («Список только по текущему device roster, без глобального сканирования HA») + AC3 (поведение picker) |
| ux | новые ключи i18n (`backup.error.invalid_more_info_entity`, `toast.more_info_target_unavailable`, `marker.more_info_*` ×4 языка) | AC7 (четыре языка, подсказки/поиск/нет результатов/отказ) + AC2 («понятный отказ» для toast) |

Все классы покрыты именованным AC/разделом ТЗ. **Маршрут: `fix`** (как и
указано владельцем для данного ревью; на `ask` переквалификация не
применяется).

## Находки

Нет находок High или Medium в скоупе. Одно Low-наблюдение зафиксировано выше
(переиспользованная, но в этой ветке функционально избыточная идиома
`role.find(isControllable) || role[0]` в `src/device-more-info.ts`) — не имеет
наблюдаемого следствия (итоговый ownership-гейт `moreInfoEntityFailure`
применяется к результату независимо от способа его получения), цикл не
открывает, правка не требуется.

## Что проверено и корректно

- AC1: Auto отделён от иконки структурно (resolver не принимает icon),
  подтверждено и синтетическим unit-свидетелем, воспроизводящим реальный старый
  баг (`d.primary` остаётся historical-sensor, `resolveDeviceMoreInfoTarget`
  возвращает `climate.floor`), и native-smoke с точным `hass-more-info.entityId`
  на обоих HA-входах.
- AC2: явная цель — точная; unavailable/unknown — валидны; foreign/deleted/
  disabled/no-readable-state/malformed отказывают без fallback на соседнюю
  сущность (7 параметризованных unit-кейсов + native).
- AC3: picker — Auto + свои сущности, поиск по имени+id внутри списка, Save/
  Cancel/dirty, сброс при смене binding, Escape закрывает только picker, без
  горизонтального скролла на 360/1100 px — native smoke проверяет все пункты
  буквально.
- AC4: entity-binding точен (включая незарегистрированную YAML-сущность),
  virtual не получает HA-цель, открытие не вызывает служб (`noServices` в конце
  smoke, 0 вызовов).
- AC5: sparse-поведение (`markerMoreInfoFields`), survival через
  full/space-перенос, историю (Undo/Redo), Optimize; support отдаёт только
  псевдонимизированный id, обе wire-schema синхронны.
- AC6: выбор HA-диалога не меняет `resolveDevicePresentation`/`primary`/
  `value_source` (прямой unit-сравнение до/после).
- AC7 (инфраструктурно): новые golden-сцены ссылаются на существующую
  фикстуру; размеры picker/диалога проверяются и в golden, и в native smoke;
  зафиксировано доверенным системным контекстом как «review-light-golden proof
  is complete» для точного материала ревью.
- Правый клик View (#997) не тронут, регрессия подтверждена
  (`rightClickStillOpensSettings`).
- Трейлеры/changelog/release-ledger/registry (`config-field-registry.mjs`,
  `config-schema.json`, `ci-registry-inventory.json`, `monolith-baseline.json`,
  `bundle-budget.mjs` с объяснением дельты) присутствуют и согласованы;
  `docs/release-ledger/v1.82.0/1087.json` — `stable-fix` относительно v1.82.0,
  milestone 1.83, `visual` с двумя `expectation: "new"` сценами.

## Чего не проверял

- Не выполнял продуктовые мутации (не разрешено вне ночного workflow; оба
  witness прочитаны и приняты как зарегистрированные, не исполненные).
- Не запускал полную регрессию/полную golden-матрицу/performance-гейты — не
  названы в AC, это предрелизный объём (§8).
- Ручную dev/GPU-приёмку владельцем не требую и не фиксирую как отсутствующую
  находку (добровольна, #929).
- Не пересчитывал вручную абсолютные числа STATUS Tests-счётчиков (5660/685/
  579/459) — это генерируемый документ, сверенный `status-snapshot.mjs --check`
  в уже переиспользованном зелёном CI.

## Унаследовано

Это первый раунд ревью (r1); предыдущих вердиктов по этому заходу нет (две
предшествующие остановки были механическими preflight-отказами — отсутствующие
разделы ТЗ и неслитый rebase, — без вызова модели и без вердикта, что
соответствует «блокирующих циклов 0/4» ниже).

---

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 → в задаче · Документ: docs/reviews/CODE-REVIEW-1087-r1.md

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImM0ZjEwMTAzZWU3YjBkNzY4ZGI5NzFjZjIyNjU0ZDUzNWI4ZTlhMGQ5NDdhN2ExMjhhYTJhMWZkNWRjZDFlYjQiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJlMmZkZjk3M2M5YzA2ODhkNzE3NmE3NTg5MmY4ODgzMTE1NjNlYmNhOTg4MjM1MWZiZjk1MjJjMDgzYjVkYTgzIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDg3LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI1ZDIxY2Y5NzI4ZWZmN2I1ZjYxYWM0YzVmYWU5NTRhODE5N2E3YzcyIiwidHJlZSI6ImIxNzRhNTQ4ZDQ2YTI4MmNjOTVhOGEyYmMyZjgyOTZlZjY3MTlhNjAiLCJib2R5RGlnZXN0IjoiNTdkZmJmNzJlODQxZjczMjJiYWRmYWFhZGM4OWU2NTcxMmU3ZDM0MGYwOTVkMzZkOTc2MjJhYTc2Zjk4ZGU4MiIsInByb2R1Y2VyUnVuIjoiNDA0ODMwMDE4ODMiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjExYzIwOGFjMmNlZWVjOWUwOGFhOWJjMjQ2NWZjZTAzMDQyODU2MWNkN2I4NzdhZWVkYzg2NjY5MDJmODEzNWIiLCJ2ZXJkaWN0RGlnZXN0IjoiZjllMzdkNzMwYTI2NmU3MGFmYjFjNWU4YTQwZGM3OGViNGRjZDYwNmQ2OGEzZmU1ZjZlZjdiZjA4ZTc1ZGJmZiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI0N2RhZmM4Nzg2NTMwMjc2ZWRiZTQ4MjA4Zjk2ODc3MGYxZjkyY2YzMzZkNDFiMmM2M2NhOTEyODZhYjIyN2FmIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDM4ODA3NzUzLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDg3I2lzc3VlY29tbWVudC02NDM4ODA3NzUzIiwiYm9keURpZ2VzdCI6IjgwMjg3MGQyZmEzNmFkOTRiZDg4ZTNiYzg2ZDRkMDk0NDFlNDkxNWU5NmRlYjc0YTJmOGVlYTgzMThkNzQ3NzAifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1087-ha-more-info-target`, коммит `5d21cf9728ef` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `b174a548d46a282cc95a8a2bc2f8296ef6719a60`
  ```
  git log --all --format='%H %T' | grep b174a548d46a
  ```
- Тело issue: `57dfbf72e841f7322badfaaadc89e65712e7d340f095d36d97622aa76f98de82`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40483001883,"run_attempt":1,"digest":"0309d45ac223752b2f5b929ed91fb7fa38b96f0bbebd706216428e0196079c31"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NzgsIm91dHB1dF90b2tlbnMiOjQ5MjI4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE5NjE4OCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjU1ODA1NTMsImNvc3RVc2RFc3RpbWF0ZSI6Mi4zOTMyOTg1OTk5OTk5OTk2fV0sInR1cm5zIjo0OCwiZHVyYXRpb25NcyI6NTk4NzAzLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi4zOTMyOTg1OTk5OTk5OTk2LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=78 output_tokens=49228 cache_creation_input_tokens=196188 cache_read_input_tokens=5580553 num_turns=48 -->
