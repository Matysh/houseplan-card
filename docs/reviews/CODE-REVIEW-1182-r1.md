# CODE-REVIEW #1182 — заход r1

## Скоуп

Материал: `72b50f2f028192b6894a4bcb5f9ab78e7c810e73` (issue/1182-ui-kit-full-smoke-observers),
база общего предка `ebc2ca54e62fb1e433421f75b05a267967efa523`. Диапазон: 2 коммита
(`35018ebec`, `72b50f2f0`).

Изменённые файлы — ровно класс B/C, как и требует задача: 15 существующих
`demo/smoke_*.mjs`, новый отчёт `docs/design/ui-kit-smoke-observers-1182.md`,
infra-ledger `docs/release-ledger/v1.83.0/1182.json`, обновление
`scripts/ci-registry-inventory.json`. `src/**` не затронут — подтверждено
чтением `read:diff`.

Трек show, заход r1, блокирующих циклов 0/2.

## Как проверялось

1. `read:diff`/`read:log` — полный диапазон изменений прочитан целиком.
2. Для каждого изменённого смока независимо сверил новый селектор/значение
   с реальным продуктовым источником (Grep по `src/**`), а не принял
   формулировки из отчёта/хендоффа на веру:
   - `smoke_dialog_footer_width.mjs`: `560px`/`610px` подтверждены
     `src/compact-dialog-styles.ts:17` (`--hp-dialog-wide-width:560px`) и
     уже принятым (неизменным) `610px` settings-shell.
   - `smoke_optimize_cleanup.mjs`: `.rhint` → `.hpf-callout` подтверждён
     реальной разметкой подсказки в `src/editors/general-settings-dialog.ts:290`
     (`<p class="hpf-callout">${st('gs.optimize_write_required')}</p>`).
   - `smoke_hidden_device_toggle.mjs`: немедленный `inert`+`aria-hidden`
     перед финальным удалением подтверждён `src/editor-context-menu.ts:39,95`
     и тем, что `#hp-header-menu` — тот же компонент (`editor-context-menu.ts:161`,
     `header-menu.ts:160`).
   - `smoke_view_device_menu.mjs`: `13px`/`44px`/`hpf-context-menu-touch`
     подтверждены `src/editor-context-menu.styles.ts:25-27`.
   - `smoke_vacuum_route_draft.mjs`: `.hpf-callout.hpf-warning`,
     `[data-hp="settings-section"][data-section="vacuum"]`,
     `[data-settings-section="vacuum"]` подтверждены `src/editors/marker-dialog.ts:53`
     и `src/editors/settings-sections.ts:50,60`.
   - `smoke_ui_polish_963_reference.mjs`: контракт `36px`/`radius:5px` для
     `.hp-prop-action` подтверждён принятым аудитом
     `docs/design/ui-kit-audit-1150.json:296` (`"#931 fields36/radius5..."`);
     danger-ink `rgb(219, 68, 55)` — это HEX `#db4437`, заявленный issue как
     принятый semantic `--error-color` пиновой HA, не изобретённое число.
   - `smoke_settings_mock_match_948.mjs`: `160ms` подтверждён
     `docs/design/ui-kit-audit-1147.json:57` (`"paint": "160ms ease"`).
   - `smoke_grid_scale_invariance.mjs`: `[data-hp="zoom-out"]` — реальный
     контрол (`src/houseplan-card.ts`).
   - `smoke_zigbee_tooltip_layout.mjs`/`smoke_zigbee_led_topology.mjs`:
     `data-tooltip-owner` подтверждён `src/live-hover.ts`,
     `src/hp-zigbee-topology-overlay.ts`.
   Все проверенные значения — существующие продуктовые константы/разметка,
   а не принятые по факту текущей реализации «с нуля» (AC1).
3. Исполнил через `mcp__houseplan_review__run_check` (оракул из манифеста,
   без argv/env/cwd):
   - `read:diff`, `read:log` — PASS.
   - `build:build`, `build:bundle:sync`, `build:test`, `build:typecheck` —
     PASS (понадобились перед смоками: первый запуск
     `smoke:demo/smoke_ui_polish_963_reference.mjs` и
     `smoke:demo/smoke_grid_scale_invariance.mjs` упал с
     `Failed to fetch dynamically imported module` до `build:bundle:sync`;
     `smoke:demo/smoke_canvas_surface_gestures.mjs` падал с
     `ERR_MODULE_NOT_FOUND test-build/wall-segment-model.js` до `build:test`).
   - Адресно перевыполнил 4 из 15 изменённых смоков — наиболее рискованные
     по логике (не просто переименование селектора):
     `smoke:demo/smoke_ui_polish_963_reference.mjs` (новый независимый paint-oracle
     вместо побайтового сравнения со старым прототипом),
     `smoke:demo/smoke_grid_scale_invariance.mjs` (добавлен реальный zoom-out +
     проверка вершины стека `op-hit`),
     `smoke:demo/smoke_zigbee_led_topology.mjs` (замена фиксированного таймаута
     на перехват конкретного доверенного pen-события),
     `smoke:demo/smoke_canvas_surface_gestures.mjs` (измеренные отступы вместо
     фиксированных координат drag). Все 4 — PASS с содержательными
     чекпоинтами (не только exit0); для 963/grid_scale в stdout — явный JSON
     с перечнем именованных проверок, все `true`, включая ранее падавшие
     `openingEdgeHitAndActionMatch` и `*_action_paint`.
   - Остальные 11 изменённых смоков и полный `gate:small` не перезапускал:
     переиспользую зелёный `review-light` на материале `72b50f2f0...`
     (validate-gate run
     [41296749192](https://github.com/Matysh/houseplan-card/actions/runs/41296749192)),
     так как у меня нет конкретного необъяснённого риска по их диффам после
     независимой сверки с продуктовым источником — только переименования
     селекторов/констант с подтверждённым источником (п.2 выше).
4. Сверил `docs/release-ledger/v1.83.0/1182.json` по схеме с соседними
   `1180.json`/`1181.json` — формат и `category: infra` совпадают, `baseStable`
   верен (предыдущий stable v1.83.0).

## Находки

Находок нет.

## Что проверено и корректно

- **AC1** (причина каждого из 15 RED + сохраняемый контракт): таблица в
  `docs/design/ui-kit-smoke-observers-1182.md` содержит по строке на смок
  с «AC1 · чем доказан · чем краснеет»-эквивалентом (целевой PASS +
  исходный полный CI `41285641666` как отрицательный свидетель). Для
  каждого утверждения о «принятом Kit» самостоятельно нашёл источник в
  `src/**` или `docs/design/ui-kit-audit-114*/1150.json` — ни одно число
  не оказалось выдуманным по факту текущей реализации.
- **AC2** (список запрещённых/разрешённых правок): все проверенные замены
  действительно относятся к устаревшим наблюдателям (семантические
  селекторы, immediate-inert+finite-leave вместо sleep, измеренная
  типографика вместо фиксированных координат, независимый Kit-oracle для
  `#963` при сохранении старого геометрического oracle неизменным).
  `#963` — единственный файл, где реально меняется способ сравнения
  paint (с побайтового сравнения со старым прототипом на независимый
  oracle); это прямо предписано AC2 и подтверждено документированным
  контрактом `36px/radius5` (#1150) и HA-пином `#db4437`.
- **AC3** (gate:small + смоки PASS, ledger актуален): инфраструктурный
  ledger и CI-inventory корректно обновлены; целевое исполнение (4/15
  смоков заново, остальные — через CI evidence) подтверждает PASS с
  реальными чекпоинтами, а не только `exit 0`.
- `src/**` не затронут — задача не вышла за заявленные границы B/C.
- `build:typecheck` — PASS, никаких побочных регрессий сборки.

## Чего не проверял

- Полный `gate:small` и остальные 11 изменённых смоков не перезапускал —
  переиспользую зелёный `validate-gate` для материала текущего SHA
  (п. «Как проверялось», пункт 3) в соответствии с политикой «не дублировать
  пригодное доказательство».
- Полный exact candidate CI (все browser smokes, не только изменённые) —
  вне объёма code-review; по PROCESS.md это ответственность release
  producer перед бетой, что сам отчёт автора прямо признаёт.
- Трейлеры `Issue:`/`User-Visible:` в теле коммитов — доступный `read:log`
  отдаёт только oneline-формат, полный текст коммита через разрешённые
  проверки не читается. Содержательно `User-Visible: no` самоочевиден из
  диффа (только test/infra-слой, `src/**` не тронут) и согласован с
  `category: infra` в ledger; формальная сверка трейлера недоступным
  инструментом не выполнялась.

## Маршрут

`route: fix`. Задача проходит критерии §5: сложность/риск низкие (чисто
инфраструктурные правки существующих offline-наблюдателей), одна
поверхность (слой demo-смоков, без продуктовых surface), миграций нет,
новый UX-контракт не вводится (контракты явно сохраняются), влияния на
производительность/touch нет, ожидаемое поведение уже задокументировано в
принятых `#1147-#1150` артефактах (`docs/design/ui-kit-audit-*.json`) и
продуктовом источнике.

## Побочные находки

Побочных находок, выходящих за рамки материала ревью, не обнаружено.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImU1MjBkY2NkN2JmMDkyMDQ3NTQzZWU3NmU1OWE4NTA5MTRhMjUxMzdmN2JmN2M4ODRhMTc0MGY4ZDM2NTkzOTYiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI2OWM1ZjI1OWM1MWJjMTgzZmFmNjExODg3MmM2Nzk0YjBmNWU5ZDMyOTlhYmZmNjZkMjk5NWY5YzBiMWY3ZmI2IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTgyLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI3MmI1MGYyZjAyODE5MmI2ODk0YTRiY2I1ZjlhYjc4ZTdjODEwZTczIiwidHJlZSI6IjJjZjA2YjkwMDQ2ZjYyNDhmMTY1NDNkNDIyMjE3NGEyZmIxMzc3YTkiLCJib2R5RGlnZXN0IjoiNzk0MmIwMTk2MzEyNzgwNzVkNTA2MzQxYzI0Y2FhNmVmMzhjZDZiZThmNGRiNzE5MzIxMmEyNWVlOWExYzE4NyIsInByb2R1Y2VyUnVuIjoiNDEyOTc0Njk1MzIiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjZiNTY4NTNkMDQzODg2M2JmYjc0YmY5NDJkMDRjZTBhNGFmYzYxMzk4ZGY0ODE1ZTAwMTFjMThkMDlkNjZhZGUiLCJ2ZXJkaWN0RGlnZXN0IjoiZDNhNjVjMWE4Mzk1NmU5NGU3OTIzYjcwYzZjNTc5YjJjNTY0NmZkMjgwMDUwZjVmMTNjODJkODI3ZDQwOTg1ZCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiIwZDBhNDM3ZmYzMjVhM2QzM2NiOWI2MWUyMzg0YzczMDFkNDc2N2NmMzFiYjVhODE1MGNjZmE4ZDJlODUzOGNkIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTU2ODM0NDQwLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTgyI2lzc3VlY29tbWVudC02NTU2ODM0NDQwIiwiYm9keURpZ2VzdCI6ImNhYjZhZjljODI2MjBmYTU4NzBhMjVkMDgzMDZiNTk2ZTE5ZWMzZjIxMmI5MmJlMTFiOGIxMDY4OGE1ZWIxMzkifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1182-ui-kit-full-smoke-observers`, коммит `72b50f2f0281` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `2cf06b90046f6248f16543d4222174a2fb1377a9`
  ```
  git log --all --format='%H %T' | grep 2cf06b90046f
  ```
- Тело issue: `7942b019631278075d506341c24caa6ef38cd6be8f4db7193212a25ee9a1c187`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":41297469532,"run_attempt":1,"digest":"bd9d1ddbe1aa6daaad6c2ad91af306ef1434ba1192760afbfc5162618f5de298"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6ODQsIm91dHB1dF90b2tlbnMiOjIxNDIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEzNDM5MywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjQ0MzYwNzUsImNvc3RVc2RFc3RpbWF0ZSI6MS42MzkxNTQ5OTk5OTk5OTk1fV0sInR1cm5zIjo2OCwiZHVyYXRpb25NcyI6NjA1OTc1LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS42MzkxNTQ5OTk5OTk5OTk1LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=84 output_tokens=21420 cache_creation_input_tokens=134393 cache_read_input_tokens=4436075 num_turns=68 -->
