# CODE-REVIEW-1026-r1

Материал: `997db87fca389ab89a83d899bc97c755b249bb8c` (точный SHA рабочей копии,
голова `issue/1026-own-offline`, принятый `dev`: `e8c618924cfa2845dcf1073f65404cd093efed10`).
Трек `track:ask`, заход r1, блокирующих циклов 0/4. SPEC r1 GREEN принят
(`SPEC-REVIEW-1026-r1.md`, 2026-10-24), продуктовых вопросов не осталось.

## Скоуп

Issue #1026: развести «выключено» и «потеряло HA-доступность» для всех доменов.
Единый own-only факт `OwnDeviceAvailability` на `device.entities` (трёхзначная
матрица: available/unavailable/unknown), применяемый ко всем поверхностям
(icon/value/legacy badge, LED вариант 3, full/space/preview, Flat/2.5D).
Закрывает J1/J2 (`docs/SCOPE.md`): различимость «выключено» vs «недоступно»
на плане. A: `device-own-availability.ts` (новый), `device-presentation*.ts`,
`device-visual.ts`, `device-face.ts`, `led-strip-runtime.ts`, `iso-tiles.ts`,
`space-render.ts`, `houseplan-card.ts`, `devices.styles.ts`. B: pure units,
native `smoke_device_offline.mjs`, 2 golden-сцены, реестр мутантов, инвентари.
C: `DEVICE-PRESENTATION.md`, `STYLING-HOOKS.md`, `CONFIG-COMPATIBILITY.md`,
`ISOMETRIC.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`, `STATUS.md`, оба
`USER-GUIDE`, оба `CHANGELOG`, `release-ledger/v1.82.0/1026.json`.

## Как проверялось

Принятый proof и хендофф переиспользованы, не повторялись:

| Проверка | Результат | Источник |
| --- | --- | --- |
| CI product на точном SHA (validate-gate) | SUCCESS, все применимые job зелёные | [run 40084843716](https://github.com/Matysh/houseplan-card/actions/runs/40084843716) |
| `node demo/smoke_device_offline.mjs` (в составе «Браузер: выбранные проверки push») | 44/44, passed | тот же run, job «Браузер: выбранные проверки push» |
| `golden device-offline-light`, `golden device-offline-dark` | passed (expectation=new, обе темы) | тот же run/job |
| 28 связанных smoke (controls, led_strip_*, mode_transition, space_card, zigbee_led_topology и др.) | все passed | тот же run/job |
| «Фронтенд: типы, юниты, мутанты, синхрон бандла» | success, полный product-юнит-набор зелёный | тот же run |
| «Мутанты по диффу», «Перф-смок», «Golden против эталонов», «Смоки: все шарды» | skipped (политика: мутанты и полный regression — не гейт ревью/задачи, §8, AGENTS.md «no mutants during development») | тот же run |

Адресно перепроверено мной (пробел: подтвердить, что пригодные unit-тесты
действительно исполняются и содержат содержательные отрицательные случаи, а
не переиспользуют старый сборочный артефакт):
`npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test
test/device-own-availability.test.mjs test/device-presentation-policy.test.mjs
test/device-presentation.test.mjs test/device-visual.test.mjs
test/led-strip-runtime.test.mjs test/render-snapshot-incremental.test.mjs`
→ **113/113 PASS**, 0 fail. Это обычный прогон на неизменённой реализации,
не исполнение мутанта.

Чтением (не исполнением) проверены: `src/device-own-availability.ts` (контракт
exact/device/virtual/controller, три значения, bounded reads),
`device-presentation.ts`/`device-presentation-policy.ts` (единый `offline`-гейт,
static/live/lifecycle/bindingUnavailable, сохранение authority алармов),
`device-visual.ts` (media_player/composite Power больше не подделывают
unavailable), `devices.styles.ts`/`device-face.ts` (opacity только у
`ha-icon`/`.valtext`/`.value-badge-content`, один эффективный уровень без
умножения), `led-strip-runtime.ts`/`iso-tiles.ts`/`houseplan-card.ts`/
`space-render.ts` (вариант 3: без бейджа — обычная геометрия, с бейджем —
приглушён только текст; серый пунктир/iso-грей удалены), `mutation-registry.mjs`
(новые записи только зарегистрированы, не исполнялись — соответствует
политике).

## Не проверялось (и почему не требуется)

- Полный `npm test`/`gate:small` повторно — уже PASS на этом же SHA (обычный
  push-хук, 248 с, 0 падений; воспроизведено в хендоффе), новый прогон не
  адресует непокрытый пробел.
- Исполнение зарегистрированных мутантов (`device-own-offline-*`,
  `controller-*`) — вне ночного workflow запрещено политикой; для AC1–AC4 в
  таблице ниже это отражено как «зарегистрирован, не исполнялся», что
  достаточно для «чем краснеет».
- Полная Golden-матрица/полный regression/ручная dev-приёмка — не гейт ревью
  (§8), относится к предрелизному гейту.
- Python/`pytest tests_backend` — диапазон не трогает `custom_components/**`.
- `npm run invariants` — геометрия плана/контактов не менялась (только
  measured visual invariant через smoke, уже PASS).

## Находки

Нет High и Medium.

**Low (снят ревьюером, не блокирует):** `src/styles/devices.styles.ts`,
комментарий у `.dev.ghost` (строка «BLUE, so a hidden device cannot be mistaken
for an unavailable one (translucent dark)») остался от прежнего контракта, где
`.unavail` был whole-marker opacity + серый фон. После этой задачи `.unavail`
красит только содержимое glyph/Text/badge, фон/рамка прежние — сравнение «эта
(translucent dark)» больше не описывает код. Поведенческого расхождения нет
(ghost и confirmed-offline по-прежнему визуально различимы), это только
текстовая неточность комментария, добавленная как побочный эффект принятого
изменения. Не продуктовый дефект, автору на исправление не возвращается.

## Что проверено и корректно

- **AC1** (off/idle/standby/paused/Power=off не offline): `device-visual.ts`
  убрал `media_player.off → unavailable` и `Power=off → unavailable`;
  `entityVisualSamplesForDevice` теперь форсирует `neutral/none/available` при
  `Power=off`, а не копирует unavailable-ветку. Доказано
  `test/device-own-availability.test.mjs` (21 домен × 6 состояний) и
  `test/device-visual.test.mjs` (композитный Power, лежачее реле) — 113/113
  PASS выше.
- **AC2** (exact/device/virtual/controller трёхзначная матрица, чужие
  controls/value/missing/disabled не создают ложный offline):
  `device-own-availability.ts` читает ровно `device.entities`; тест
  `buildDevices`-сценарий («real roster ownership excludes claimed and disabled
  siblings») показывает, что `switch.elsewhere` (controls) и отключённый
  diagnostic не входят в roster `exact`, а включение диагностики в registry
  делает `physical` available только через неё. `ha_disabled`/`orphaned`/
  `unverified`/`virtual` → `unknown`, не `unavailable`.
- **AC3** (opacity только у содержимого, рамка/фон/контакт/тень/LQI/батарея
  прежние, без умножения с source-quality): CSS-диф показывает ровно три
  целевых селектора на 0.35 (`ha-icon`, `.valtext`, `.value-badge-content`);
  старое `--device-face-bg: #B5BAC1` снято. `.dev:not(.unavail)
  .value-badge.unavailable/.missing` гейтит 0.66 только при отсутствии
  общего offline — single effective level подтверждён нативно
  (`twoReasonsHaveOneOfflineOpacity: true`,
  `docs/development-notes/device-offline-validation.json`) и golden
  device-offline-light/dark (passed, обе темы, CI выше).
  `confirmedAlarmCoexistsWithOwnOffline`/`ownRecoveryKeepsConfirmedAlarmColorAndFrame`
  в `smoke_device_offline.mjs` отдельно доказывают, что alarm-фон/рамка не
  гасятся офлайн-подачей контроллера с другим `state_source` (#251-сценарий).
- **AC4** (LED вариант 3): `ledStripView` больше не возвращает `'unavailable'`
  (тип сужен до `'on' | 'off'`), пунктирный `stroke-dasharray` и серый
  `#9e9e9e` core удалены; `iso-tiles.ts` убрал `unavail` body/tint. Badge
  (`houseplan-card.ts`, `space-render.ts`) получает класс `unavail` только из
  `presentation.offline` устройства-ленты (его собственный roster, не roster
  целевой лампы) — приглушается только `.value-badge-content` внутри бейджа,
  геометрия/обводка ленты не меняются. Доказано native LED smoke (44/44) +
  pure `led-strip-runtime.test.mjs`.
- **AC5** (lifecycle/static/live gates, тревоги, источники, LQI/батарея не
  регрессируют): `offline` в `device-presentation-policy.ts` явно гейтится
  `!effectiveHidden && !bindingUnavailable && !neutralFace && liveStates`;
  тест «static/live/lifecycle gates suppress offline paint» (в прогнанном
  наборе выше) подтверждает `static_icon`/`value_static_icon`/
  `liveStates:false` не показывают офлайн-подачу. Battery/LQI не затронуты
  (отдельные DOM-узлы вне `.device-core`/`.value-badge-content`).
- **AC6** (own-only tick/registry invalidation = full, без нового скана):
  новый тест `render-snapshot-incremental.test.mjs` («diagnostic-only own
  ticks and registry ownership match complete snapshots») сравнивает
  incremental и full на каждом шаге, проверяет неизменность ссылки на
  непричастный маркер (`perf-device-8`) и корректную инвалидацию при смене
  registry-владения диагностической сущности. PASS в прогоне выше (499 мс).
  Bounded-reads доказаны отдельным Proxy-тестом (ровно 1 чтение при первой
  положительной строке, полный проход только при подтверждении offline).
- **AC7** (без миграции/скрытых writes, документация и ledger): нет новых
  persisted полей (`CONFIG-COMPATIBILITY.md` явно это фиксирует); оба
  changelog и `release-ledger/v1.82.0/1026.json` (`category: major`,
  обоснование соответствует явному решению владельца в ТЗ про замену
  намеренного stable-поведения) добавлены в тех же коммитах с
  `User-Visible: yes` (`d7961f90e`, `3e4007f18` — оба правят оба changelog).
  `Issue: #1026` на каждом непустом коммите подтверждён `git log`.

Трейлеры, число 0.35 (единственный источник — CSS), визуальный `release-ledger`
field (`golden: device-offline-light/dark`, `smokes: smoke_device_offline.mjs`)
— соответствуют факту: именно эти проверки и прогнаны в CI выше, дублирования
источника числа не найдено.

## Вердикт

Зелёный. High: 0, Medium: 0, один Low снят без возврата автору.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1026-own-offline`, коммит `997db87fca38` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `e2514c59f773eb85a81a0a078a0474de5405860e`
  ```
  git log --all --format='%H %T' | grep e2514c59f773
  ```
- Тело issue: `f5e8c2470c3fe633146f6e65216dfbf49adc4757fdd841b6781b33cf2741dd41`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ3NzEsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0ODY2fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMTIsIm91dHB1dF90b2tlbnMiOjMwOTU1LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE1MjY1NSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjY2MTMwNzgsImNvc3RVc2RFc3RpbWF0ZSI6Mi4yNDMwMDk2fV0sInR1cm5zIjo2MywiZHVyYXRpb25NcyI6NDEzODkwLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi4yNDc4NzU2MDAwMDAwMDEsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4883 output_tokens=30974 cache_creation_input_tokens=152655 cache_read_input_tokens=6613078 num_turns=63 -->
