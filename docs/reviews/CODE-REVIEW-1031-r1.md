# CODE-REVIEW-1031-r1

Issue: #1031 · Трек: ask · Этап: code · Заход: r1 · блокирующих циклов израсходовано 0 из 4
Материал: `c3b63601f360643697eb1c2a4de914125b1ede8d` (рабочая копия на нём; `git status` чистый)

## Скоуп

ТЗ (см. тело issue) требует: при draft ON / saved OFF в Zigbee-разделе общих
настроек дать составное действие «Сохранить настройки и обновить карту»
(Z2M) / «Сохранить настройки и прочитать ZHA», которое валидированно сохраняет
весь диалог через существующий CAS writer, оставляет диалог открытым и
запускает загрузку только после успешного ACK, с session/identity-фенсингом,
одним pending-действием и неизменной admin-only/background-политикой.
Не-скоуп (Python/WS API, admin-only политика, cleanup карт, background jobs,
геометрия, LQI #1029) диффом не затронут — подтверждено чтением: единственные
изменения в Python-дереве отсутствуют, `custom_components/**` в `git diff
--stat` не фигурирует.

Риск по изменённым участкам (#707), трек `ask` — сверка с AC ТЗ:
- ux (новые i18n-ключи `save_and_update`/`save_and_read_zha`/`save_and_load_help`
  в 4 языках) — покрыт AC7 (`src/i18n/topology/*.json`, `USER-GUIDE.{md,ru.md}`,
  оба `CHANGELOG`).
- async/CAS-координация (новый `zigbee-topology-action.ts`,
  `_saveSettingsDialog({keepOpen})`) — покрыт AC1/AC2/AC4.
- dirty baseline после keep-open save (`dialog-baseline.ts`,
  `general-form-state.ts`) — покрыт AC5.
- admin/standalone-политика (`_mayLoad`, `_emit`) — покрыт AC6.
Все классы из риск-строки имеют названный AC — находок по покрытию нет.

## Как проверялось

Зелёного Validate на `c3b63601f` нет — все гейты ниже прогнаны мной лично на
этом SHA.

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | чисто, без вывода |
| Unit (полный) | `npm test` | 5555 тестов: 5554 PASS / 0 FAIL / 1 SKIP, 199.2 с |
| Build | `npm run build` | `dist` собран, 37.7 с |
| Bundle policy | `node scripts/bundle-policy.mjs --verify` | «свежая сборка dist цела (60 ассетов); закоммиченная копия не сверяется — бандл меняет только кандидат (#657)» |
| Bundle ratchet | `node scripts/ratchets.mjs report` | `monolith bundleBytes: факт 3316651 · потолок 3316618 (+33, полоса +2000)` — в полосе, не ошибка; согласуется с авторским обоснованием +4276 байт |
| Mutation registry (статика) | `node scripts/mutation-gate.mjs --check --id=<each of 5 new 1031 ids>` | все 5 `ok`, `execution=0` (как и требует политика вне ночного прогона); `browser guards: 462/200` — WARN, не FAIL |
| Mutation registry inventory | `node scripts/mutation-registry-check.mjs` | чисто, exit 0 |
| Process gate | `node scripts/process-gate.mjs --issues` | «гейт пройден, предупреждений 0» |
| Smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 21 прямое совпадение (включая новый `smoke_zigbee_enable_refresh.mjs`), 3 зарегистрированные связи, остальное — слабые/широкие |
| Целевой smoke (новый) | `node demo/smoke_zigbee_enable_refresh.mjs` | **падает** (см. находку ниже) |
| Смежные зарегистрированные/прямые smoke | `smoke_zigbee_topology_job.mjs`, `smoke_zigbee_incomplete_reasons.mjs`, `smoke_editor_draft_exit.mjs`, `smoke_general_settings_form.mjs`, `smoke_signal_visibility.mjs`, `smoke_signal_visibility_lifecycle.mjs`, `smoke_lazy_editor_chunk.mjs` | все 7 PASS |

Не прогонялось и почему:
- `npm run invariants` — геометрия плана диффом не затронута (ТЗ прямо исключает
  её из скоупа; изменения только в Zigbee-settings/dialog-baseline/i18n).
- `golden:verify` — метки `ci:golden` на issue нет, рендер плана не меняется
  (только DOM/layout диалога настроек), golden-сдвигов ТЗ не заявляет.
- `pytest tests_backend` — Python-дерево в диффе отсутствует.
- Полный `npm run gate:small -- --smokes` (вся выбранная матрица ~41 файл) —
  не гонял повторно: это предрелизный объём (§8), не гейт ревью; выборочно
  прогнал те smoke, что `smoke-select` относит к этому диффу напрямую/по
  регистру, плюс сам новый целевой smoke.
- Мутанты не исполнялись нигде (ни точечно, ни пакетно) — только статический
  `--check`, как требует политика вне ночного workflow.

## Находки

### High — новый целевой smoke не проходит на материале ревью; заявленные «43 PASS» не воспроизводятся

Файл: `demo/smoke_zigbee_enable_refresh.mjs`, функция `setup()` (строки 29–33).

Автор в хендоффе заявляет: «`node demo/smoke_zigbee_enable_refresh.mjs`: 43
PASS, включая реальный General Settings owner...». Я прогнал эту же команду
на материале `c3b63601f` пять раз подряд — каждый раз процесс падает
необработанным исключением ещё до первого содержательного `record(...)`:

```
page.evaluate: TypeError: Cannot read properties of null (reading 'querySelector')
    at eval (eval at evaluate (:311:30), <anonymous>:39:12)
    at async <anonymous>:337:30
    at setup (.../demo/smoke_zigbee_enable_refresh.mjs:33:14)
```

Причина (диагностирована построчно, вне продуктового кода — не правил ни
смок, ни продукт, только читал и добавлял временные debug-копии в `/tmp`):
`setup()` делает `page.reload()`, дожидается только
`window.__card?._booting === false` (строка 31), затем сразу переопределяет
`card.hass` на новый объект (строки 45 и далее) и кликает `[data-hp="settings"]`
(строка 69). После `page.reload()` `_editorRuntime` ещё не прогружен (это
ленивый чанк); его догрузка обычно укладывается в ~85 мс и чем-то похожа на
фон. Но стоит один раз переприсвоить `card.hass = {...}` перед кликом (ровно
то, что делает `setup()`), как `_ensureEditorRuntime()` реально начинает
резолвиться только спустя ~1.4 с (замерено `performance.now()` в отдельной
debug-копии) — на порядок дольше, чем бюджет `window.__hpTest.settled()`
(≈2 кадра + короткие таймауты). Из-за этого `dialog` в строке 70
(`querySelector('hp-dialog[data-kind="settings"]')`) остаётся `null`, и
следующая строка (`dialog.querySelector(...)`) кидает `TypeError`.

Это ровно тот гоночный сценарий, для которого в кодовой базе уже есть
устоявшийся приём: `demo/smoke_zigbee_topology_job.mjs:49` явно делает
`await card._ensureEditorRuntime();` сразу после `page.reload()` и перед
первым взаимодействием с диалогом настроек. Новый `setup()` этот шаг не
унаследовал.

Подтверждение диагноза: я скопировал файл во `/tmp` (не трогая материал
ревью в репозитории), добавил одну строку
`await page.evaluate(() => window.__card._ensureEditorRuntime());` сразу
после ожидания `_booting === false` в `setup()`, и прогнал получившийся файл
без прочих изменений. Результат — **все 43 проверки PASS**, включая
`compositeActionWarnsBeforeSaving`, `failedSaveKeepsRetryableDraftWithoutScan`,
`conflictCannotStartAndLeavesRetryableDraft`, все 6 `*PreventsLateScan` и
`detachedSaveCannotReacquireMetadata`, keyboard/360px-матрицу на 4 языках.
Это подтверждает, что причина — исключительно отсутствие ожидания в
тестовом fixture, а не дефект продукта: реализация `zigbee-topology-action.ts`,
`_saveSettingsDialog({keepOpen})`, `acceptGeneralBaseline`,
`_mayLoad`/`_actionsBusy` и i18n ведут себя корректно по каждому из AC1–AC8,
когда тест реально успевает дойти до проверок.

**Чем краснеет:** обычный запуск `node demo/smoke_zigbee_enable_refresh.mjs`
на неизменённом материале ревью — воспроизводится детерминированно (5/5
попыток), не разовая флакующая случайность.

**Почему это High, а не Medium:** это не стилистическая придирка к тесту.
`demo/smoke_zigbee_enable_refresh.mjs` — единственный смок-свидетель,
названный в ТЗ для AC1, AC2, AC3, AC4, AC5, AC7, AC8 (AC6 частично тоже
проверяет этот же файл: `standaloneWithoutCallbackRemainsSaveFirst`,
`nonAdminCannotInvokeSaveCallback`). Он уже зарегистрирован в
`scripts/ci-registry-inventory.json` и будет подхвачен обычным
`gate:small -- --smokes`/ночным прогоном — то есть попадёт в CI в
неработоспособном виде. Авторский хендофф заявляет результат («43 PASS»),
который я не смог воспроизвести ни разу на том же SHA — это прямое
расхождение между заявленным и фактическим состоянием доказательной базы
задачи, а не мелкая шероховатость.

**Путь исправления** (не мой — для автора): добавить в `setup()`
аналогичный `demo/smoke_zigbee_topology_job.mjs:49` вызов
`await page.evaluate(() => window.__card._ensureEditorRuntime());` сразу
после ожидания `_booting === false` и до переопределения `card.hass`/клика
по `[data-hp="settings"]`.

Других находок (Medium/Low) по итогам разбора нет.

## Что проверено и корректно

- **Контракт пункт 1–3** (составное действие, предупреждение, тот же
  валидированный CAS writer с `keepOpen`): `src/houseplan-editor-runtime.ts`
  `_saveSettingsDialog(options)` переиспользует существующий
  `OptimisticAttempt`/`_saveConfigNow`/`expected_rev`-путь без второго writer;
  при `keepOpen` баланс `busy:false` и `acceptGeneralBaseline` — ветки кода
  чтением соответствуют контракту. Отдельного partial-patch нет.
- **Пункт 4** (ACK перед стартом, без оптимизма): `ZigbeeTopologyLoadGate.run()`
  (`src/zigbee-topology-action.ts`) вызывает `load()` только после
  успешного `prepare()` и повторной проверки `current()`; `_load()` в
  `hp-zigbee-topology-settings.ts` дополнительно сверяет identity/session
  перед стартом. Доказано и unit (`test/zigbee-topology-action.test.mjs`,
  все 4 теста в полном `npm test`), и (после подтверждения моим патчем)
  смоком.
- **Пункт 5** (один pending на компонент, блокировка конфликтующих действий):
  `ZigbeeTopologyLoadGate.pending` + `this._actionsBusy` блокируют
  `_emit`/тумблер/textarea во время сохранения — читается в
  `hp-zigbee-topology-settings.ts` (`_emit`, `ha-switch .disabled`,
  `textarea ?disabled`).
- **Пункт 6** (ошибка Save не запускает скан, обычный rollback): `_load()`
  вызывает `prepare()` только для несохранённого состояния
  (`this.savedEnabled ? undefined : this.prepareLoad`), а `run()`
  прерывается на `!await options.prepare()`/исключении без вызова `load()`.
  Мутант `zigbee-enabled-refresh-resaves-unrelated-draft-1031` (статически
  зарегистрирован, `execution=0`, как и требует политика) целится ровно в
  эту строку.
- **Пункт 7** (keep-open не трогает session, поздние правки остаются dirty):
  `acceptDialogBaseline` проверяет владельца сессии (`dialogSession(...) ===
  owner`) перед продвижением baseline — не меняет `sessions`, только
  `baselines`. Подтверждено unit-тестом `#1031 keep-open baseline preserves
  session and later edits...`.
- **Пункт 8/9** (ретированные контексты, standalone без callback):
  `_loadContext`-сверка в `updated()` инвалидирует gate при смене
  owner/identity/session/active/enabled/topics; `metadataWanted` теперь также
  проверяет `isConnected` — это тот самый lifecycle-фикс из авторского
  возврата в S6 (коммит `c3b63601f`), и он читается именно так, как описан
  в комментарии к issue: без `isConnected` в проверке detached-компонент мог
  бы получить повторный `requestUpdate()` из `changed()`-колбэка gate и
  реанимировать metadata-подписку. С фиксом — нет.
- **Трейлеры и changelog:** все 4 коммита несут `Issue: #1031`; `User-Visible`
  — `yes` только на первом коммите (`27a713f6b`), который в одном коммите
  правит оба `docs/CHANGELOG*.md`; остальные три — `User-Visible: no`
  (test/fix без видимого поведения) — соответствует §3 п.10.
- **release-ledger:** `docs/release-ledger/v1.82.0/1031.json` — `stable-fix`
  относительно предыдущего stable v1.82.0, обоснование описывает
  существующий баг, а не новую бета-функцию; `introducedBy` не требуется и не
  указан — соответствует формату соседних записей (сверено с `1008.json`).
- **i18n:** `save_and_update`/`save_and_read_zha`/`save_and_load_help`
  присутствуют во всех 4 словарях (`en/ru/de/fr`) с текстами, совпадающими
  с ТЗ дословно для en/ru; `USER-GUIDE.md`/`USER-GUIDE.ru.md` обновлены тем
  же словарём терминов.
- **Одно число, один источник (§8):** `bundleBytes` в
  `scripts/monolith-baseline.json` (3316618) и измеренный ratchet-факт
  (3316651) расходятся лишь на 33 байта — в пределах штатной полосы, не
  второй независимый источник того же числа.

## Чего не проверял

- Полную ночную матрицу golden/мутантов/performance — вне объёма ревью (§8),
  предрелизная обязанность.
- Реальный Home Assistant/ZHA/Z2M backend — вне скоупа ТЗ, фикстура остаётся
  fake WS, что ТЗ и предполагает.
- Остальные ~34 smoke из полного `gate:small -- --smokes`, не относящиеся к
  диффу напрямую или по регистру (см. список `smoke-select` — «широкие» и
  «слабая связь» категории) — автор уже прогонял их пакетно, пересчитывать не
  стал.

## Маршрут находок

Доверенный снимок: `mode=issues`. Находка выше — **в скоупе задачи** (тот же
новый файл `demo/smoke_zigbee_enable_refresh.mjs`, который ТЗ прямо называет
обязательным тестовым артефактом). Новый issue не заводится — находка
возвращается автору в рамках текущего #1031.

## Вердикт

High: 1 (сломанный целевой smoke, обоснование и фикс-направление выше).
Medium: 0.

Продуктовый код (`zigbee-topology-action.ts`, `_saveSettingsDialog`,
`dialog-baseline.ts`, `general-form-state.ts`, `hp-zigbee-topology-settings.ts`,
i18n, changelog/guide/ledger) по чтению и по подтверждённому мной прогону
исправленной копии теста соответствует контракту ТЗ полностью. Единственная
находка — тестовый fixture, не продукт, но она блокирует подтверждение
AC1–AC8 на предъявленном материале и расходится с заявленным автором
результатом, поэтому вердикт не может быть зелёным.

**route: fix**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1031-zigbee-settings-refresh`, коммит `c3b63601f360` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `9cfa5f0dc7c6a948c11d6b9fe02ee4c7034a9f32`
  ```
  git log --all --format='%H %T' | grep 9cfa5f0dc7c6
  ```
- Тело issue: `ca030988210605e5e20c9c6f17a1030eb1d2bf42ff0b58493b965f61c03647eb`
- Вердикт конвейера: `red` · High 1 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ4MjIsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0OTE2OTk5OTk5OTk5OTk5NX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MjM4LCJvdXRwdXRfdG9rZW5zIjo2NjkzMiwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoyMTYyMDcsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxNjgwOTcxMywiY29zdFVzZEVzdGltYXRlIjo0Ljg5NjU2NjU5OTk5OTk5OH1dLCJ0dXJucyI6MTI2LCJkdXJhdGlvbk1zIjoxNDEyNDYwLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6NC45MDE0ODM1OTk5OTk5OTksImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5060 output_tokens=66951 cache_creation_input_tokens=216207 cache_read_input_tokens=16809713 num_turns=126 -->
