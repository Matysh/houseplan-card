# Код-ревью issue #94 — универсальное «Переключить состояние»

- **Дата:** 2026-08-12
- **Issue:** https://github.com/Matysh/houseplan-card/issues/94
- **Проверенная версия:** локальный `dev` после `v1.62.0-beta.3`, включая
  незакоммиченные исправления #95–#97
- **Итог ревью до правок:** changes requested — 2 high, 4 medium, 1 minor
- **Итог после локальных правок:** замечания устранены; проверки отложены до
  ближайшего pre-release по принятому правилу владельца

## 1. Охват

Проверены:

1. нормативный алгоритм и acceptance criteria в
   `docs/specs/094-universal-state-toggle.md`;
2. pure resolver `src/device-toggle.ts`;
3. target selection через exact binding, device role и `controls`;
4. capability/security/service guards;
5. dialog projection, hint, lossless Save и preview;
6. обычный click, confirmation re-resolve и обработка ошибок;
7. общий cover target для действия и presentation;
8. backend schema и import/export round-trip;
9. unit/smoke-матрица и архитектурная документация;
10. совместимость с визуальной непрерывностью #73 и локальными правками
    #95–#97.

## 2. Найденные и исправленные замечания

### CR94-01 — High: domain service ошибочно считался capability конкретной entity

**Было:** `POWER_DOMAINS` разрешал `climate`, `water_heater`, `siren` и
`camera`, если нужный service существовал на уровне domain. Но HA публикует
services для всего domain; неподдерживающая их конкретная entity всё равно
оставалась «исполняемой» в hint, а вызов затем отклонялся Home Assistant.

Это прямо противоречило §9.1 и mutation gate 6 ТЗ. Home Assistant Core
подтверждает entity-level guards:

- Climate `TURN_OFF=128`, `TURN_ON=256`:
  https://github.com/home-assistant/core/blob/dev/homeassistant/components/climate/const.py
- Water heater `ON_OFF=8`:
  https://github.com/home-assistant/core/blob/dev/homeassistant/components/water_heater/__init__.py
- Siren `TURN_ON=1`, `TURN_OFF=2`:
  https://github.com/home-assistant/core/blob/dev/homeassistant/components/siren/const.py
- Camera `ON_OFF=1`:
  https://github.com/home-assistant/core/blob/dev/homeassistant/components/camera/__init__.py

**Исправлено:** введён декларативный `POWER_ADAPTERS` с state semantics,
unknown policy и точными feature masks. Feature-gated entity теперь получает
команду только при наличии требуемых bits; service catalog остаётся вторым
guard. Media player и legacy vacuum включены в тот же реестр.

**Покрытие:** параметрические unit-матрицы для всех базовых power adapters и
для climate, media player, siren, water heater, camera, legacy vacuum — как
разрешённые, так и запрещённые/missing-feature варианты; отдельная матрица
`unknown` проверяет полный/неполный capability mask.

### CR94-02 — High: click мог использовать target из сохранённого визуального frame

**Было:** #73 намеренно может некоторое время показывать последний цельный
`_renderDevices` snapshot, но `_clickDevice(ev, d)` разрешал action прямо по
переданному `d`. Если binding/controls изменились до атомарной смены frame,
нажатие без confirmation могло вызвать прежнюю цель. Confirmation уже делал
повторное разрешение, обычный click — нет.

**Исправлено:** в View действие сначала находит текущий `DevItem` в
`this._devices` по стабильному marker id. Action, binding, controls и command
разрешаются только из него; исчезнувший marker даёт no-op. Локальная
House Plan info-card по-прежнему может использовать видимый snapshot — это
безопасная read-only поверхность и намеренный контракт исправления #96.

**Покрытие:** smoke сохраняет старый `DevItem`, меняет controls, перестраивает
live devices и проверяет, что click вызывает только новую группу.

### CR94-03 — Medium: неизвестный persisted action расходил UI и runtime

**Было:** неизвестный token на light проецировался как default `toggle`, тогда
как `toggleOriginOf()` правильно не признавал его toggle-origin. Селектор мог
показать «Переключить состояние», hint оставался пустым, а click был no-op.

**Исправлено:** light default применяется только к действительно отсутствующему
token (`null`, `undefined`, пустая legacy-строка). Неизвестное значение fail-
closed проецируется в локальную карточку; backend по-прежнему отклоняет его при
записи.

### CR94-04 — Medium: legacy cover терял identity после disable в HA

**Было:** legacy `tap_action: cover` искал cover только в active
`device.entities`, если рядом оставался хотя бы один активный sibling. После
disable cover в HA старое явное намерение превращалось в анонимный no-target и
presentation переставал знать прежнюю cover entity.

**Исправлено:** legacy-cover origin сначала сохраняет приоритет активной cover,
а при её отсутствии ищет историческую цель в `allEntities`. Общий resolver
возвращает `ha-disabled` и сохраняет тот же cover identity для hint/presentation,
но более ранняя disabled registry row не может заслонить рабочую cover. Новый
device-role toggle по-прежнему исключает disabled rows.

### CR94-05 — Medium: пустой service catalog считался поддержкой всех services

**Было:** отсутствие/пустой `hass.services` давало optimistic `true` для любого
service. Это нарушало runtime guard из ТЗ и позволяло построить команду без
доказательства её существования.

**Исправлено:** отсутствующий catalog/domain/service теперь означает
`unsupported`. После появления актуального HA snapshot resolver автоматически
пересчитывает hint и command. Синтетический HA в `demo/srv/demo.html` теперь
публикует явный service catalog, поэтому smoke-среда проверяет тот же fail-closed
контракт и не создаёт ложные no-op.

### CR94-06 — Medium: device binding не выбирал первую действительно поддерживаемую entity роли

**Было:** resolver выбирал первую entity «подходящего domain», а затем мог
остановиться на `unsupported`, хотя следующая равноправная entity той же
functional role имела требуемую capability. Это не соответствовало формулировке
§8.1 «первая поддерживаемая entity».

**Исправлено:** проверка идёт по уже выбранной shared functional role.
Capability-unsupported peer можно пропустить только внутри неё; missing,
unavailable и secure identity сохраняются без retarget. Config/diagnostic
switch более слабой роли по-прежнему никогда не подставляется.

### CR94-07 — Minor: статус ТЗ оставался «готово к реализации»

**Исправлено:** ТЗ, specs index, архитектура, STATUS, TESTING и RU/EN changelog
актуализированы под опубликованную beta.3 и этот локальный hardening pass.

## 3. Проверенные инварианты без изменений

- exact `entity:` binding не ищет sibling при unsupported/missing/unavailable;
- raw external controls владеют tap только у explicit toggle и не дают fallback
  на собственную entity контроллера;
- passive forced-light marker сохраняет единственное документированное driver-
  исключение и дедупликацию;
- partial group вызывает только отображённое доступное подмножество;
- any-on/all-off group semantics соответствует ТЗ;
- lock, alarm и cover classes `garage`/`door`/`gate` остаются secure no-op;
- cover/valve open/close/stop используют одновременно feature bit и service;
- confirmation сравнивает target set, а направление намеренно пересчитывается
  по текущему state;
- legacy `cover` и отсутствующий default-light action сохраняются lossless до
  явного изменения select;
- backend принимает текущие actions и legacy `cover`, неизвестные tokens
  отклоняет; import/export сохраняет action-поля без преобразования;
- отдельного `cover` в текущем UI нет;
- right-click, long press, touch/pinch и confirmation UX этим проходом не
  менялись.

## 4. Изменённые файлы

- `src/device-toggle.ts`
- `src/houseplan-card.ts`
- `test/device-toggle.test.mjs`
- `demo/smoke_controls.mjs`
- `demo/srv/demo.html`
- `docs/specs/094-universal-state-toggle.md`
- `docs/specs/README.md`
- `docs/ARCHITECTURE.md`
- `docs/STATUS.md`
- `docs/TESTING.md`
- `docs/CHANGELOG.md`
- `docs/CHANGELOG.ru.md`

## 5. Проверка

Локально выполнены только read-only/static проверки ревью:

- `git diff --check`;
- `npm run typecheck`;
- `node --check test/device-toggle.test.mjs`;
- `node --check demo/smoke_controls.mjs`;
- поиск всех consumers `resolveToggleIntent`, `projectedTapAction`,
  `toggleCoverEntity`, `sameToggleCommandTargets`;
- сверка backend schema/import-export;
- сверка capability flags с официальным Home Assistant Core.

Unit, browser smoke, backend tests, build и generated bundles **не запускались**
по правилу проекта: локальные правки делаются без тестов, минимальный целевой
прогон выполняется при следующем pre-release.
