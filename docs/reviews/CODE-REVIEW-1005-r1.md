# CODE-REVIEW-1005-r1

Issue: #1005 · Трек: ask · Этап: code · Заход: r1 · блокирующих циклов 0/4
Материал: ровно `bf6f65a382495865f766ccb10cac03ea4d023873` (`origin/dev..HEAD`, 3 коммита: `295ae515c` реализация, `d840aaf6c` открытие цикла 1.83, `bf6f65a38` дополнение negative-input smoke).
ТЗ: тело issue #1005, ревью ТЗ r1 — зелёный (`SPEC-REVIEW-1005-r1.md`), High 0 / Medium 0.

## Скоуп

Диагностика Zigbee (Общие настройки) получает блок «Почему данные неполные» в конце секции ZHA и после всех топиков Zigbee2MQTT: конкретные узлы/причины вместо одной общей пометки `route_partial`. Новый чистый модуль `src/zigbee-topology-diagnostics.ts` считает причины на основе существующих `mapTopologyNodes`/`resolveProviderUplinks`; `_status()` и новый `_incompleteDetails()` в `hp-zigbee-topology-settings.ts` используют один и тот же расчёт. `zigbee-provider-routes.ts`/`zigbee-topology.ts` получили необязательные diagnostic-only поля (`failedStages`, `unknownStage`, `mappingReason`) без изменения правил partial/маршрутов. i18n: 21 новый ключ в en/ru (канон) и синхронно в de/fr. Открыт release-cycle 1.83 (`baseStable v1.82.0 → targetStable v1.83.0`, milestone 9), `#1005` классифицирован `stable-fix`, `#674` (пост-стабильный архив) — `infra`. Соответствует J7 (SCOPE.md); редактор остаётся desktop-first (TOUCH-SUPPORT.md не расширяется).

## Как проверялось

Зелёного Validate на этом SHA нет (подтверждено: `gh run list` по ветке `issue/1005-zigbee-incomplete-reasons` отдаёт только `CI product/tooling/docs`, workflow `Validate` там не запускался — это CI задачи, а не кандидат слияния). Все дешёвые гейты прогнаны мной лично на материале `bf6f65a38`:

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | PASS, без ошибок |
| Юниты | `npm test` | 5529 passed / 0 failed / 1 skipped (включая `no-new-any`, `no-new-private-writes`, `bundle-policy`, `bundle-sync`, `bundle-freshness`, `release-ledger`, `release-membership`, `status-snapshot`, `monolith-metrics`) |
| Сборка | `npm run build` | PASS, `created dist` |
| Бандл-политика | `node scripts/bundle-policy.mjs --verify` | PASS («бандл меняет только кандидат», #657 — комитченная копия не сверяется вне Release-коммита) |
| Бандл-бюджет | `node scripts/bundle-budget.mjs` | PASS, все профили под потолком (initial View 333 931 / 352 000, lazy editor 324 126 / 324 435 и т.д.) |
| process-gate | `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | PASS, 0 предупреждений |
| mutation-gate --check | `node scripts/mutation-gate.mjs --check` | PASS (static), `execution=0`, 3 новых browser witness статически зарегистрированы (`zigbee-incomplete-details-start-open-1005`, `zigbee-incomplete-heading-enlarged-1005`, `zigbee-incomplete-mixes-provider-groups-1005`); браузерные мутанты не исполнялись — ночь единственное легитимное окно поимки |
| smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 8 прямых совпадений + 3 зарегистрированные связи = совпадает с заявленным автором списком «ещё 9» (минус уже AC-именованные `smoke_zigbee_incomplete_reasons`/`smoke_zigbee_topology_job`) |
| Названный в AC smoke | `node demo/smoke_zigbee_incomplete_reasons.mjs` (после `npm run bundle:sync`) | PASS, все 23 проверки `true` |
| Соседние AC-smoke | `node demo/smoke_zigbee_topology_job.mjs`, `node demo/smoke_settings_navigation.mjs` | PASS |
| 9 smoke-select кандидатов | `smoke_bg_color`, `smoke_controls`, `smoke_device_hit_capsules`, `smoke_device_signal_topology`, `smoke_signal_visibility_device_policy`, `smoke_zigbee_topology_hover`, `smoke_device_signal_settings`, `smoke_device_signal`, `smoke_zigbee_tooltip_layout` | PASS (все 9, запущены лично) |
| Golden (ci:golden) | проверено через `gh run view 39663798729 --log` | Полная матрица (`mode:"full"`, ~200 кадров), все `passed ... diff=0px`; классификатор риска корректно пометил изменение как «unproven golden connection» (диагностика не трогает отрисовку) |
| STATUS.md снимок | `node scripts/status-snapshot.mjs --check` | «snapshot block is current» |

Не прогонялось: `pytest tests_backend` (нет изменений Python/backend), `npm run invariants` (геометрия не меняется), performance (не назван в AC), полная golden/release-матрица (это предрелизный гейт, не гейт ревью — пройдена кандидатом уже на этом SHA отдельным CI).

## Находки

**Low — дублирование фразы в `docs/USER-GUIDE.md` (английский).** При вставке нового абзаца про диагностику исходное предложение «After data is loaded, moving a real mouse over a mapped Zigbee marker shows its parent (end device) or active next hop…» было разорвано: первая часть обрублена на «…shows links on the plan.» (строка 495–496), затем идёт новый абзац про «Why the data is incomplete», а затем ещё раз «Moving a real mouse over a mapped Zigbee marker shows its parent (end device)…» (строка 505) — то же действие описано дважды подряд с обрывком предложения в середине. Русская версия того же места вставлена корректно, отдельным абзацем между существующими (`docs/USER-GUIDE.ru.md:518-527`), без потери текста. Не искажает факты, не блокирует; снимаю как Low без возврата.
  - *Воспроизведение:* `docs/USER-GUIDE.md:495-505` до/после сравнение с `origin/dev:docs/USER-GUIDE.md:495`.

Других находок, вне- или внутри-скоупных, не обнаружено.

## Что проверено и корректно

- **Контракт отображения (AC1):** блок — нативный `<details>`/`<summary>` по образцу `zha_manual` (`src/hp-zigbee-topology-settings.ts:475-476` vs новый `:299`), треугольник штатный (браузерный `list-style-type: disclosure-*`, подтверждено smoke `nativeMarker`), заголовок точно `incomplete_title` = «Почему данные неполные» (сверено в `ru.json`), шрифт/размер/интервал наследуются от общего класса `.status` (12px/1.45 — `src/hp-zigbee-topology-settings.ts:66`), не отдельная панель. ZHA — один блок в конце секции; Z2M — один блок после всех топиков (DOM-порядок подтверждён smoke `providerFootersFollowAllControls`).
- **Причины и доказуемость (AC2/AC3):** `zigbee-topology-diagnostics.ts` строит причины из единственного источника — текущих `mapTopologyNodes`/`resolveProviderUplinks`/normalized warnings, дедуплицирует по `code\0nodeKey`, различает `registry_missing`/`registry_ambiguous`/`placement_missing`/`ambiguous_placement`, не путает `route_unknown`-generic с уже объяснённой точной причиной того же узла (явный `continue` в коде, покрыт тестом «actual resolver: … avoids generic route_unknown duplication»). Z2M `failed:[...]` этапы сохраняются (`failedStages`), malformed/слишком длинные/не-строковые значения отбрасываются с честным `unknownStage` вместо исключения или утечки произвольного объекта (тест «multiple and malformed failed stages preserve the reported failure, not raw objects» — проверено исполнением, `!JSON.stringify(reason).includes('secret')`). 86 unit-тестов в затронутых файлах выполнены — 0 fail.
- **Жизненный цикл и идентичность (AC4):** `_diagnosticModels()` отдаёт `EMPTY_DIAGNOSTICS` при смене `hass.connection`/`user.id`/`_admin`, что подтверждено smoke-сценариями смены подключения/пользователя/прав (`connectionChangeRetiresNames`, `userChangeRetiresNames`, `permissionLossRetiresNames` — все `true` при реальном запуске). Раскрытие спойлера не делает RPC (`spoilerAndThemesDoNotFetchOrScan: true`, `subscriptions === 1` после 4 кадров hass-обновлений).
- **Безопасность текста (AC5):** имена/топики выводятся как `textContent` Lit-шаблона (не `unsafeHTML`), smoke с `<img src=x onerror=...>` в имени радио и в MQTT-топике длиной ~150 символов подтверждает отсутствие `img/script/svg` в DOM и `!window.__injected && !window.__topicInjected` — выполнено лично, PASS.
- **Отсутствие побочных RPC/сканов (AC6):** `radioCalls` (reads/scans/cancels) не меняются при раскрытии/сворачивании и смене темы — подтверждено исполнением smoke.
- **Гейты по диффу:** typecheck/юниты/сборка/бандл-бюджет/бандл-политика/process-gate/mutation-gate(static)/golden/все названные и smoke-select smoke — зелёные, см. таблицу выше.
- **Release-ledger:** `docs/release-ledger/v1.82.0/1005.json` — `stable-fix` с обоснованием относительно `v1.82.0` (явное улучшение существующего диагностического поведения, без смены route/scan-контракта) — согласуется с кодом. `674.json` — `infra` (пост-стабильная архивация документации). `cycle.json` обновлён на `v1.82.0 → v1.83.0`, milestone 9 — подтверждено владельцем в теле issue/комментариях. Трейлеры `Issue:`/`User-Visible:` на месте во всех трёх коммитах класса A/B; `User-Visible: yes` коммит (`295ae515c`) правит оба changelog в одном коммите.
- **Одно число — один источник (§8):** `bundleBytes` в `scripts/monolith-baseline.json` (3 300 750) обновлён тем же коммитом, что и факт роста бандла; проверено `bundle-policy --verify`/`bundle-budget` — расхождения нет, единственный источник — `npm run build` на материале.

## Чего не проверял

- Полную golden/performance/release-матрицу — это предрелизный гейт (§8), не гейт ревью; точечно проверено через факт зелёного CI-прогона на этом же SHA (см. таблицу).
- `pytest tests_backend` — в диффе нет Python/backend изменений.
- `npm run invariants` — геометрия модели не меняется (диагностика не производит и не трогает geometry/placements).
- Ручную интерактивную проверку в реальном Home Assistant/радиосети — вне допустимого объёма ревью; автоматические browser-свидетели и честное описание ограничений среды покрывают это по политике REVIEWER.md.
- Исполнение зарегистрированных browser-мутантов (`zigbee-incomplete-*-1005`) — запрещено вне ночного workflow; подтверждена только их статическая регистрация (`mutation-gate --check`, `execution=0`).

## Побочные находки

`REVIEW_FINDINGS_POLICY`: `mode=issues`. Побочных находок вне скоупа нет — новых issue не заводил.

## Вердикт

Зелёный. High 0, Medium 0 (одна находка Low снята без возврата). AC1–AC6 подтверждены исполнением (unit + smoke) и/или прочтением кода с explicit continue-веткой против дублирования `route_unknown`. Все обязательные и названные в АС гейты — зелёные, включая golden (полная матрица на материале, diff=0px). route: fix.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1005-zigbee-incomplete-reasons`, коммит `bf6f65a38249` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `703d224452c7aa237bbc257d7959dd446eb2d00b`
  ```
  git log --all --format='%H %T' | grep 703d224452c7
  ```
- Тело issue: `f9d97e355ce30ed1870601c669637e797d6f9db6c6102a289b5200c3906b787c`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ4MTEsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0OTAxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMDIsIm91dHB1dF90b2tlbnMiOjI4NzIxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE3NjY4NywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjU5MzM4NjMsImNvc3RVc2RFc3RpbWF0ZSI6Mi4xODA5MzQ1OTk5OTk5OTl9XSwidHVybnMiOjYyLCJkdXJhdGlvbk1zIjo2NDU4MDksImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoyLjE4NTgzNTU5OTk5OTk5OTQsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4913 output_tokens=28739 cache_creation_input_tokens=176687 cache_read_input_tokens=5933863 num_turns=62 -->
