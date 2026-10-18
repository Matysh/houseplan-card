# CODE-REVIEW-943-r1

Issue: #943 «Удалить базовое затемнение комнат («Темнота дома»), сохранив свечение ламп»
Трек: ask · Этап: code · Заход: r1 · блокирующих циклов использовано 0/4
Материал: `4fc71d2c0c999b06d7d14c7a908ab939eed4fb43` (ветка `issue/943-remove-room-dimming`, 5 коммитов над `origin/dev`@`90336a4b`), рабочее дерево чистое, `HEAD` совпадает.
Принятое ТЗ: SPEC-REVIEW-943-r2 (зелёный, High0/Medium0), body sha256 `aabc53d8…` — не менялось.
Маршрут вердикта (назначен пакетом, #726): `fix`.

## Скоуп

Проверялось полное удаление роли палитры `glow_base` («Темнота дома») и равномерного слоя затемнения комнат/проёмов из всех потребителей (полный Flat/киоск, три редактора, статическая `houseplan-space-card` при `light_pools:false/true`, 2.5D), при сохранении свечения ламп/LED, обычных заливок и обратной совместимости старых конфигов/бэкапов без миграции. Отдельно — синхронизация диагностической wire-схемы пакета поддержки (10 активных ролей вместо 11) и её relay-зеркала.

Правок вне заявленного скоупа не нашёл: стены/проёмы/геометрия, модель данных, права, жесты, пороги производительности и golden-бюджеты не затронуты; `legacy/**` и `docs/design/600-settings-dialogs/SPEC.md` (другая задача, #948) не переписывались.

## Как проверялось

### Гейты — что прогнано и почему

| Гейт | Статус | Источник |
|---|---|---|
| `typecheck` (`tsc --noEmit` + `--noUnusedLocals`), `npm test`, `npm run build` + `bundle-policy --verify` | PASS на материале | Validate `39080767673` (workflow_dispatch, full=true) на точном SHA `4fc71d2c`, job «Фронтенд: типы, юниты, мутанты, синхрон бандла» — все шаги success, без failed/skipped |
| Полный браузерный смок-набор (375/375, 3 шарда) | PASS на материале | тот же прогон `39080767673`, jobs «Смоки в браузере (шард 1/2/3 из 3)» и «Смоки: все шарды зелёные» — success. Внутри — `smoke_room_dimming_removed.mjs` (новый, AC2/AC4/AC6), `smoke_glow*`, `smoke_opening_tunnel_fill`, `smoke_decor_layer_order`, `smoke_isometric_live_touch`, `smoke_open_passage`, `smoke_dialog_polish_605`, `smoke_ha_controls`, `smoke_color_picker_consumers`, `smoke_general_settings*` и др. — именно те поверхности, которые задевает дифф |
| `golden:verify` (`ci:golden` на issue) | PASS 212/212 на материале | тот же прогон, job «Golden-кадры против принятых эталонов» — success; `baselines-index.json` несёт WSL-аттестацию с `source.commit: 1cf764f5…` (предпоследний коммит материала, дерево рендера идентично `4fc71d2c`) и `sha256:3aa7dbd1…` |
| Perf-smoke (бюджет кадра) | PASS на материале | тот же прогон, job «Перф-смок: бюджет времени кадра» — success |
| `pytest tests_backend` (полный, HA harness собран) + `python -m unittest scripts/support-relay/tests` | PASS, но **не на самом `4fc71d2c`** — на нём job «Бэкенд: pytest в Home Assistant» был **skipped** (reuse). Проверил вручную: все backend-файлы диффа (`support_package.py`, `support_wire_schema.py` ×2, `tests_backend/test_*`, `scripts/support-relay/tests/test_relay_v2.py`) не менялись между `1cf764f5` и `4fc71d2c` (`git diff 1cf764f5 4fc71d2c -- <эти пути>` — пусто). Validate push `39080232168` на `1cf764f5` исполнил backend-job по-настоящему (не reuse) и получил success | оба прогона привязаны к byte-identical поддереву — засчитываю как действительное доказательство для `4fc71d2c`, повторно не гонял (среда ревью не имеет `homeassistant`/`voluptuous`, установка тяжёлая и не требуется при валидном reuse) |
| `node scripts/mutation-gate.mjs --check` (static-readiness) | PASS, прогнал сам локально | все затронутые записи реестра (`decor-restored-below-room-fills`, `iso-light-floor-memo-never-reuses`) — `ok`, патчи совпадают с текущим кодом; 5 преэкзистентных WARN не относятся к #943 (`#650`, `${…}`-паттерны) |
| Инварианты модели (`npm run invariants`) | Не прогонял | дифф не меняет геометрию/ссылки на неё — не применимо (AC9 ТЗ: «пол остаётся геометрически тем же») |
| Release ledger | Проверено чтением | `docs/release-ledger/v1.81.0/943.json`, schema1, `category: stable-fix`; сверил `git show v1.81.0:src/logic.ts` — `glow_base` существовал уже в v1.81.0, значит это полировка стабильного поведения, а не правка бета-фичи текущего цикла; `introducedBy` не требуется |

Не гонял HACS/Hassfest (манифест не менялся, были skipped по классификации) и TS/Python geometry-parity (геометрия не менялась, skipped по делу).

### Разбор по коду

Прочитан построчно весь дифф (`git diff origin/dev...HEAD`, 83 файла): `src/logic.ts`, `src/houseplan-card.ts`, `src/space-render.ts`, `src/styles/plan.styles.ts`, `src/editors/general-settings-dialog.ts`, i18n ×4, `custom_components/houseplan/support_package.py`/`support_wire_schema.py` и relay-зеркало, все изменённые `demo/smoke_*.mjs`, `test/*.mjs`, `tests_backend/test_*.py`, `scripts/mutation-registry.mjs`, все затронутые канонические документы (`LIGHT.md`, `CONFIG-COMPATIBILITY.md`, `ISOMETRIC.md`, `DECOR-EDITOR.md`, `WALL-THICKNESS.md`, `UX-MODES.md`, `USER-GUIDE.md`/`.ru.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`, `STATUS.md`, `SUPPORT-PRIVACY.md`, оба `CHANGELOG`), `baselines-index.json` (метаданные приёмки) и `docs/release-ledger/v1.81.0/943.json`.

Отдельно поднял историю issue (комментарии автора 21:32–00:18) — хендофф содержит таблицу «AC · чем доказан · чем краснеет» с конкретными RED/PASS-прогонами на неизменённом коде (`demo/smoke_room_dimming_removed.mjs` на `f54ac310` — FAIL RGB delta234 до правки, PASS после; `test/room-dimming-removed.test.mjs` — оба теста RED на старом коде; support-export тест — RED до правки лишний `glow_base`). Это обычные legacy-input негативные сценарии, не мутанты; перепроверил их физическое присутствие и логику ниже.

## AC · чем доказан · чем краснеет (защитные AC)

| AC | Чем доказан (проверено) | Чем краснеет |
|---|---|---|
| AC1 (UI) | `general-settings-dialog.ts` — плитка `tile('glow_base', …)` убрана, остался только `glow_light`; `i18n/{en,ru,de,fr}.json` — ключ `gs.glow_base` удалён во всех четырёх; смоки `smoke_color_picker_consumers`/`smoke_ha_controls`/`smoke_dialog_polish_605` пересчитаны 12→11/10→9 пикеров | `test/room-dimming-removed.test.mjs` — обычный legacy-input (RED на старом коде по хендоффу автора, сам тест исполняется в `npm test`, PASS на материале) |
| AC2 (нет равномерного слоя) | `_renderGlowBaseRooms`/`_resolvedGlowBase`/base-tunnels физически удалены из `houseplan-card.ts` и `space-render.ts`; CSS-классы `.glow-base-layer`/`.glow-base-tunnels` отсутствуют во всём `src/` (`grep` пусто) | `demo/smoke_room_dimming_removed.mjs` — 28 pixel-сравнений reference/legacy (delta≤1) + DOM-отсутствие слоя по всем режимам (Flat/Plan/Devices/Decor × none/custom/temp/glow); обычный насыщенный legacy `glow_base:#15ff2a/a1` — не мутант |
| AC3 (Glow/LED сохранены) | Код пулов/LED в `space-render.ts` не тронут за пределами удаления base-присвоений | существующие `smoke_glow`, `smoke_glow_blending`, `smoke_glow_geometry_resilience`, `smoke_led_strip_glow` — обычные off/unavailable/barrier случаи, все в полном прогоне PASS |
| AC4 (static/2.5D) | `renderSpaceStatic` — `glowBaseShapes`/`passageGlowTunnels`/`glowBaseFillsById` удалены; `_isoLightFloors` берёт `roomFills.byId` без fallback на base | `smoke_room_dimming_removed.mjs` static pools false/true + iso ветки; `iso-first-frame-reveals-flat-during-lazy-load`/`led-static-live-ignored` зарегистрированы в реестре, в этом цикле не исполнялись (ночной прогон) |
| AC5 (legacy-совместимость/parity) | `fillColorsOf` больше не знает `glow_base` (чистый read-time фильтр по `DEFAULT_FILL_COLORS`) — запись не создаётся, чтение не мигрирует; `SUPPORT_FILL_COLOR_KEYS`/`GLOBAL_SETTINGS.fill_colors` (обе копии, канон и relay) — 10 ролей | `tests_backend/test_validation.py::test_issue_943_retired_darkness_does_not_relax_alpha_validation` — реально отвергает `-0.1/1.1/"not-a-number"/None`; `test_support_package.py::test_issue_943_support_export_ignores_retired_darkness_without_changing_input` — RED на старом коде (лишний ключ), PASS сейчас; `scripts/support-relay/tests/test_relay_v2.py` — новый bad-input `glow_base` в закрытой wire-схеме, ассерт `WireRejected` |
| AC6 (нет возврата после remount/pan/zoom) | Изменений в lifecycle/кеш-коде нет — слой физически не существует, восстанавливать нечего | `smoke_room_dimming_removed.mjs` kiosk warm-remount (iso×legacy матрица), `smoke_isometric_live_touch`, `smoke_live_pan_coverage` — обычные state/pan/touch события, не мутанты |

Пустых третьих столбцов нет.

## Находки

Не найдено ни одной High или Medium (ни в скоупе, ни вне скоупа). Доверенный снимок политики (`mode=issues`) сверен — новых issue заводить не из чего.

Проверил специально вероятные источники регрессии и не подтвердил их:
- Фикстура `demo/fixtures/visual-matrix.mjs:328` по-прежнему объявляет `glow_base:{c:'#1b2530',a:.78}` (файл не входит в этот диф, последний раз правился в #780) — это корректный «немой» legacy-вход: раз `fillColorsOf` его больше не читает, golden-кадры, использующие эту фикстуру (`iso-led-strip-dark`, `led-strip-*`), ожидаемо изменили контраст и входят в список из 29/31 принятых кадров.
- `test/logic.test.mjs:699` передаёт `glow_base` в `fillColorsOf({...})` внутри теста `resolveEffectiveRoomFill preserves…` — файл не в диффе, значение остаётся мёртвым входом без эффекта на проверяемые режимы (`none/lqi/light/temp/custom`), поведение теста не меняется.
- `_renderOpeningTunnelFills`/`renderOpeningTunnelFills` сохранили необязательные параметры `dataLayer`/`groupClass`, которые теперь всегда равны `'data'`/`'opening-tunnels'` — осталась мёртвая гибкость сигнатуры. Не репортирую как находку: безопасно, не меняет поведение, и ТЗ по `space-render.ts` прямо просило «убрать только отдельные base shapes/tunnels/fallback», не рефакторить сигнатуру.
- Трейлеры (`Issue:`/`User-Visible:`/`Release:`/`Baseline-Reviewed-Local:`) на всех пяти коммитах корректны; `User-Visible: yes` стоит только на коммите `05df6f9f`, где `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` правятся в том же коммите.
- Числа, видимые пользователю дважды: не нашёл ни одного нового такого числа в этом диффе (счётчики палитры 11→10 — внутренние/документные, сверяются тестом `test_issue_498_palette_allowlist_matches_the_card_defaults`, не дублирующийся независимый источник).

## Что проверено и корректно

- Полное физическое удаление роли `glow_base` из `FillColors`/`DEFAULT_FILL_COLORS`/`fillColorsOf` (`src/logic.ts`) — read-time фильтр, легаси читается без записи.
- Полное удаление слоя во всех рендер-путях: `_renderGlowBaseRooms`, `_resolvedGlowBase`, base-tunnels в `houseplan-card.ts`; `glowBaseShapes`/`passageGlowTunnels`/`glowBaseFillsById` в `space-render.ts`; CSS-классы и правила в `plan.styles.ts`. `grep -rn "glow-base" src/` — пусто.
- `_isoLightFloors` в 2.5D берёт прямой `roomFills.byId` без fallback на базу — соответствует обновлённому `ISOMETRIC.md`.
- UI и i18n: плитка и ключ `gs.glow_base` убраны из диалога и всех четырёх локалей; `glow_light`/радиус/Save/Cancel/Reset не затронуты.
- Backend/relay: обе копии закрытой wire-схемы (`custom_components/houseplan/support_wire_schema.py`, `scripts/support-relay/hp_relay/support_wire_schema.py`) синхронно убрали `glow_base` из `GLOBAL_SETTINGS.fill_colors`; `SUPPORT_FILL_COLOR_KEYS` — 10 ролей; `validation.py` (строгий цвет/alpha-контракт) не ослаблен — явный негативный backend-тест это подтверждает.
- Полный набор демо-смоков, задетых диффом, актуализирован консистентно: везде, где раньше проверялось наличие `.glow-base-layer`/`.glow-base-tunnels`/`tunnels('glow-base')`, теперь проверяется их отсутствие, а реальные data-fill/geometry/alpha-ассерты сохранены (`smoke_open_passage` — добавлен отдельный positive data-fill кейс вместо удалённого; `smoke_opening_tunnel_fill`, `smoke_glow_blending`, `smoke_decor_layer_order` — аналогично).
- `scripts/mutation-registry.mjs` обновлён только текстом/путями под новый код; `mutation-gate.mjs --check` зелёный на всех задетых записях, мутанты не исполнялись.
- Документация согласована: `LIGHT.md`, `CONFIG-COMPATIBILITY.md`, `ISOMETRIC.md`, `DECOR-EDITOR.md`, `WALL-THICKNESS.md`, `UX-MODES.md`, `USER-GUIDE.md`/`.ru.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`, `STATUS.md`, `SUPPORT-PRIVACY.md` — терминология совпадает с `USER-GUIDE.ru.md` («Темнота дома» убрана, световые пятна/заливки описаны точно так же, как в коде).
- `docs/release-ledger/v1.81.0/943.json` — классификация `stable-fix` обоснована и подтверждена (`glow_base` существовал уже в теге `v1.81.0`); схема совпадает с соседними файлами реестра.
- Трейлеры и совместный коммит для `User-Visible: yes`; `Release:`/`Baseline-Reviewed-Local:` на коммите с golden-эталонами.

## Чего не проверял

- Полный HA pytest/relay unittest не перегонял сам (среда ревью без `homeassistant`/`voluptuous`) — принял как доказательство зелёный прогон на `1cf764f5` (byte-identical backend-дерево к материалу) плюс reuse-skip на самом `4fc71d2c`.
- Инварианты модели (`npm run invariants`) — не применимо, геометрия не менялась.
- Ручная физическая GPU/WebView-приёмка — добровольна, не блокирует (#929), не запрашивалась.
- Golden-кадры не пересматривал попиксельно сам (31 сцену) — полагался на WSL-аттестацию автора (`sha256:3aa7dbd1…`, commit `1cf764f5`) и на то, что `golden:verify` 212/212 зелёный в финальном CI на самом `4fc71d2c`.
- Ночные мутанты (`column-shadow-removed`, `iso-first-frame-reveals-flat-during-lazy-load`, `led-static-live-ignored`, `live-pan-incoming-edge-clipped`, `stage3-w5-runtime-nudge-writes-storage`) — зарегистрированы, не исполнялись в этом цикле; это соответствует политике (мутанты — только ночной прогон реестра).
- `docs/design/600-settings-dialogs/SPEC.md:180` (мокап #944/#948 всё ещё упоминает `colors.glow_base`) — вне скоупа этой задачи, не проверял по существу.

## Вердикт

Зелёный. AC1–AC7 выполнены и доказаны исполнением (кроме геометрических инвариантов, не применимых к этому диффу); защитные AC имеют непустую графу «чем краснеет» с обычными negative-input свидетелями, без исполнения мутантов. Гейты, не покрытые самим материалом напрямую (backend pytest/relay unittest), подтверждены эквивалентным byte-identical прогоном на предыдущем коммите материала. High — 0, Medium — 0 (в скоупе и вне скоупа).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/943-remove-room-dimming`, коммит `4fc71d2c0c99` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `b7b35a47cd4bfabb91e3741cad6c87f43440eebd`
  ```
  git log --all --format='%H %T' | grep b7b35a47cd4b
  ```
- Тело issue: `aabc53d8ddc2ca85ca6ad283b60b023d6945fc075fc2d60bc1bd12fa79a53275`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ3ODYsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0ODcxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxNjIsIm91dHB1dF90b2tlbnMiOjQ1NDgyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE4NzcyMiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjExNTUxNTQ3LCJjb3N0VXNkRXN0aW1hdGUiOjMuNTE2MzQxNH1dLCJ0dXJucyI6OTAsImR1cmF0aW9uTXMiOjU4ODk0NCwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjMuNTIxMjEyNDAwMDAwMDAwNSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4948 output_tokens=45499 cache_creation_input_tokens=187722 cache_read_input_tokens=11551547 num_turns=90 -->
