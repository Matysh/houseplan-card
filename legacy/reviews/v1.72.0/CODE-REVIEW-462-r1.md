# CODE-REVIEW-462-r1

**Issue:** https://github.com/Matysh/houseplan-card/issues/462
**Этап:** код-ревью (PROCESS.md §2.7), заход r1, блокирующих циклов израсходовано 0/4
**Ревьюер:** Claude (роль «ревьюер кода», отдельная от роли «разработчик» — Codex)
**Материал:** `git log --oneline origin/dev..HEAD` (16 коммитов, все с трейлером `Issue: #462`) и
`git diff origin/dev...HEAD` на SHA `daccaf7ea54a01e13d4150cbd588893ad90a4672` — этот SHA совпадает
с текущим `HEAD` в момент вывода вердикта (проверено `git rev-parse HEAD` непосредственно перед
подведением итогов, §2.7 «вердикт привязан к SHA»).
**ТЗ:** `docs/specs/462-card-resource-registration.md`, ревью ТЗ зелёное на r3
(`docs/reviews/SPEC-REVIEW-462-r3.md`), AC1–AC13.

## 1. Скоуп диффа

74 файла, +4739/−450 (единственный `User-Visible: yes` коммит `fcf0ce80`, остальные 15 —
`User-Visible: no`, тесты/документация/сгенерированные бандлы). Функционально:

- **Backend:** новый модуль `custom_components/houseplan/frontend_registration.py` (659 строк) —
  типизированный outcome регистрации Lovelace-ресурса, lifecycle retry на 1 секунду,
  одноразовое `persistent_notification`, честный System Health; `__init__.py` и `system_health.py`
  переведены на него; `manifest.json` получил `after_dependencies: ["lovelace"]`.
- **Frontend:** новый чистый контроллер `src/version-recovery.ts` (331 строк, без DOM/Lit/HA) +
  адаптер `src/version-recovery-card.ts` (223 строки) + интеграция в `src/houseplan-card.ts`
  (89 строк диффа: баннер в `_renderRoot`, единая точка `_openMoreInfo`, `_syncVersionRecovery`
  на всех жизненных циклах).
- **Документация:** README/USER-GUIDE EN+RU — развилка Storage/YAML `resource_mode`/legacy
  `mode: yaml`; статический parser в `scripts/check-docs.mjs`; оба changelog.
- **Тесты:** 24 backend-теста (`tests_backend/test_ha_frontend_registration.py`), 3 новых
  frontend-unit-файла, `demo/smoke_version_recovery.mjs` (405 строк), 3 golden-сценария, 14 новых
  мутантов в `scripts/mutation-gate.mjs`.

Продуктовое поведение подтверждено проверкой на реальном исходнике HA (см. §5) — задача не
меняет раздачу бандла/кэш-бастинг, только надёжность регистрации и явную диагностику.

## 2. Как проверялось — таблица гейтов

| Гейт | Прогнан | Результат |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + сверка 3 копий бандла | Нет, переиспользован | Validate зелёный на точном `HEAD` `daccaf7e`: https://github.com/Matysh/houseplan-card/actions/runs/33969641826 |
| `node scripts/check-docs.mjs` (diff трогает `src/**`) | Нет напрямую, переиспользован | Часть того же зелёного Validate (job `docs`) |
| `npm run golden:verify` (диффа рендера AC12) | Нет, переиспользован | Часть зелёного Validate (job `golden`); 3 новых baseline приняты коммитом `daccaf7e` с трейлерами `Release: v1.72.0-beta.5` + `Baseline-Reviewed: https://github.com/Matysh/houseplan-card/actions/runs/33969189246` |
| `python -m pytest tests_backend -q` | Нет, переиспользован | Часть зелёного Validate (job `backend`); локально pytest/homeassistant не установлены в этой ревью-сессии (см. §6) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | **Да** | 98 «прямых совпадений» — разбор ниже (§4.3), большинство ложные |
| `node demo/smoke_version_recovery.mjs` | **Да** (через мутанта, чистый прогон) | зелёный — `ok чистый прогон: node demo/smoke_version_recovery.mjs` |
| `node scripts/mutation-gate.mjs --id=<14 мутантов #462>` | **Да**, 10 из 14 | 10/10 покраснели корректно (см. таблицу §5); 4 backend-мутанта не прогнаны локально (нет `pytest`/`homeassistant` в этой ревью-песочнице — дорогой гейт, разрешено читать вместо повторного прогона, §2.7) |
| Чтение исходника HA (`homeassistant==2024.6.0`, минимально поддерживаемая версия) | **Да** | скачан `pip download homeassistant==2024.6.0`, подтверждено наличие `ConfigEntry.async_create_background_task(hass, target, name, eager_start=True)` — закрывает открытый вопрос по AC3 (см. §5) |
| Инварианты модели (`npm run invariants`) | Не прогнан | diff не трогает геометрию/`layout`/`marker.space`/`open_spans` — неприменимо |
| Performance-профили | Не прогнан | не названы в AC; единственное влияние на перф — бюджет бандла, уже пересчитан и задокументирован автором в `scripts/bundle-budget.mjs` (см. §7) |

## 3. Находки

**High: 0. Medium: 0 (в скоупе задачи и вне его). Low: 3, ни один не блокирует, оставлены с
записью ниже.**

| # | Файл:строка | Что | Severity | Решение |
|---|---|---|---|---|
| L1 | `src/version-recovery-card.ts:176` | `viewOnly` включает `host._config?.kiosk === true`, хотя `VersionRecoveryController._reconcile()` (`src/version-recovery.ts:242`) уже сам не вызывает `isVersionReloadSafe()` вне kiosk-ветки. Задвоение безопасное (belt-and-suspenders), но при будущем рефакторинге кто-то может решить, что `viewOnly` — единственный источник kiosk-гейта, и убрать внешнюю проверку по ошибке | Low | Оставлено с записью; не влияет на корректность текущего кода |
| L2 | `src/styles/base.styles.ts` (правила `.version-recovery*`, `:host(houseplan-card)`) | Стили лежат в общем `baseStyles`, который импортирует и `houseplan-space-card` (`src/space-card.ts:9,932`). Селектор `:host(houseplan-card)` корректно не матчится на space-card, поэтому визуальной утечки нет — это чистый вопрос лишних байт в бандле space-card | Low | Оставлено; `test/version-recovery-card-contract.test.mjs` уже фиксирует границу селектора |
| L3 | `custom_components/houseplan/frontend_registration.py:537` | `entry.async_on_unload(state.cancel)` регистрируется при каждом вызове `async_setup_frontend_registration`, включая гипотетический повторный вызов без промежуточного unload — список on-unload callbacks мог бы расти. `cancel()` идемпотентен, и повторный вызов достижим только при нарушении контракта HA (setup без unload между вызовами), что не воспроизводится ни в одном тесте и не считается реальным путём в текущем HA lifecycle | Low | Оставлено с записью; не воспроизводится, не блокирует |

Ни один из этих трёх пунктов не меняет вывод AC и не варьирует поведение, наблюдаемое
пользователем — вердикт по ним: **правится не будет, оставлены как документированные
наблюдения** (решение ревьюера, §2.7 «Low либо правится, либо снимается с записью»).

Отдельно отмечаю (не находка, наблюдение по §2.4/2.6 «скоуп не расширяется»): коммит `65d38b24`
(`fix: keep continuity cache read-only until load`, `Issue: #462`, `User-Visible: no`) добавляет
guard `!this._loadOk` в `_seedHiddenDevices` и `_syncAreaRelocations`
(`src/houseplan-card.ts:3958,5120-5121`) — защита от того, что continuity-cache-кадр,
нарисованный до завершения авторитетной загрузки config+layout, мог бы вызвать деструктивную
запись (перезаписать серверную фильтрацию или удалить валидный snapshot area-relocation) поверх
устаревшего состояния. Это тот же инвариант `_loadOk`, от которого зависит новый предикат
`initialFrameSettled` (`version-recovery-card.ts:155`), поэтому чинить его в рамках этой же задачи
оправдано — это не отдельная попутная правка, а условие корректности самого AC8. Пользовательски
видимый эффект (защита от редкой потери непримечательного состояния при холодном старте) реален,
но обнаружен как превентивное упрочнение, а не как воспроизведённый дефект; `User-Visible: no`
для него — решение автора на грани, но не искажение фактов и не блокирует.

## 4. AC-по-AC разбор

### 4.1 Backend (AC2, AC3, AC4, AC5, AC11)

Читал `custom_components/houseplan/frontend_registration.py` целиком (659 строк) плюс
`tests_backend/test_ha_frontend_registration.py` (24 теста) и `system_health.py`/`__init__.py`
диффы. Параллельно второй читатель (независимый субагент) прошёл тот же материал —
расхождений в выводах нет.

- **AC2 (честный outcome).** `async_register_lovelace_resource` (строки 191–265) различает все
  7 состояний; existing-запись обновляется без дубля (`_async_remove_duplicate_resources`,
  164–189, тест `test_registration_keeps_one_canonical_resource_and_removes_duplicates:114-130`);
  отсутствующий файл никогда не даёт успешный loader (`async_setup_frontend_registration:518-535,
  562-564`, тест `test_ha_setup.py::test_missing_frontend_bundle_does_not_skip_backend_setup:54-83`
  проверяет `resource_status == "not_attempted"`, `loader == "none"`). **Держится.**
- **AC3 (retry без двойного loader).** `_schedule_retry` (475–504) всегда ставит фиксированную
  секундную задержку через `async_call_later` внутри колбэка `async_at_started`, даже когда HA уже
  running (в этом случае `async_at_started` вызывает колбэк синхронно, но `async_call_later`
  всё равно откладывает retry) — подтверждено и чтением, и тестом
  `test_already_running_setup_still_uses_the_fixed_one_second_delay:338-390`. Отмена
  start-listener/timer/retry-task привязана к `entry.async_on_unload(state.cancel)` (537),
  `cancel()` (92–105) корректно останавливает все три; все три окна отмены (до старта, во время
  задержки, во время задачи) явно проверены в `test_retry_lifecycle_handles_are_cancelled:456-551`
  тремя «поколениями» entry. Удаляется только собственный versioned URL setup'а
  (`_owned_fallback_urls`, 130–137 + `_remove_owned_fallback_url`, 304–327), чужой/пользовательский
  URL никогда не трогается (`test_preexisting_exact_fallback_is_used_but_never_claimed_or_removed:
  670-720`). Повторный вызов `_schedule_retry` из одного-единственного места (591) — «второй retry
  не наступает» верно по построению, а не только по тесту. **Держится.**
- **AC4 (одноразовое notification).** Флаг пишется в `entry.data` только после того, как
  `persistent_notification.async_create` вернулся без исключения (`_async_create_reload_notice:
  350-433`), гонка «fallback-путь vs retry-завершение» серилизована `state._notice_lock` (360);
  тест `test_reload_notice_is_localized_and_persisted_once:723-770` дважды вызывает функцию и
  проверяет ровно одно создание. Missing file/static failure не расходуют флаг (365–372,
  `pending_frontend`). Uninstall dismiss-ит best-effort (631–634). **Держится.**
- **AC5 (System Health).** `system_health.py:37-75` кладёт все восемь полей §10 поверх
  существующей статистики плана; параметризованный тест
  `test_system_health_reports_frontend_registration_matrix:1150-1335` покрывает
  missing/success/pending/yaml/exception и отдельно проверяет, что старые поля (`config_rev`,
  `spaces`, …) не исчезли (1314–1335). **Держится.**
- **AC11 (downgrade/compatibility).** `websocket_api.py`, отдающий `integration_version`, этим
  диффом не тронут (нет в списке изменённых файлов); существующий `test_ha_websocket.py`
  не модифицирован. `test_ha_setup.py` получил один новый тест, остальные не изменены.
  **Держится** (проверено чтением, не повторным прогоном полного backend-набора — см. §6).

**Разрешённая неопределённость.** Backend-субагент отметил открытый вопрос: доступен ли
`ConfigEntry.async_create_background_task` на минимально поддерживаемой HA 2024.6? Я скачал
`homeassistant==2024.6.0` (`pip download`) и прочитал `homeassistant/config_entries.py` из wheel —
метод существует с сигнатурой `(hass, target, name, eager_start=True)`, ровно как используется в
`frontend_registration.py:494-497`. Вопрос закрыт, разрыва по минимальной версии нет.

`after_dependencies: ["lovelace"]` (`manifest.json:4-6`) — техническая избыточность поверх уже
существующей жёсткой цепочки `houseplan → frontend → lovelace` (проверено: `dependencies` в
манифесте houseplan уже содержит `frontend`, а `frontend`'s собственный манифест в
HA 2026.8.3 содержит `lovelace` как hard dependency) — это defense-in-depth, не фикс
несуществующего разрыва, и явно назван так в ТЗ §22 п.3 (не выдан за факт).

### 4.2 Frontend (AC6–AC10, AC12)

Читал `src/version-recovery.ts` и `src/version-recovery-card.ts` целиком, диффы
`src/houseplan-card.ts`/`base.styles.ts`/i18n, три тестовых файла и
`demo/smoke_version_recovery.mjs` полностью. Второй независимый читатель (субагент) прошёл тот же
материал параллельно — расхождений нет.

- **AC6 (точное сравнение).** `normalizeRuntimeVersion`/`compareRuntimeVersions`
  (`version-recovery.ts:69-83`) трактуют не-строку/пустую/whitespace-строку как `unknown`, что
  стирает устаревший mismatch, а не оставляет его (мутант
  `version-recovery-treats-unknown-as-mismatch` прогнан лично мной — покраснел). Матрица
  §11.1 реализована в `_reconcile()` (233–260) построчно. **Держится.**
- **AC7 (обычный режим никогда не reload сам).** Вне kiosk `_reconcile()` (242–247) никогда не
  вызывает `_armTimer()`; единственный путь к `reload()` — `renderVersionBanner`'s
  `event.isTrusted && controller.hasCurrentMismatchNotice` (`version-recovery-card.ts:195-197`).
  Мутант `version-recovery-auto-reloads-ordinary-view` прогнан лично мной — покраснел.
  **Держится.**
- **AC8 (kiosk safety).** Все 10 полей `isVersionReloadSafe` (`version-recovery.ts:99-110`)
  замаплены на конкретное состояние карточки в `cardVersionReloadSafetySnapshot`
  (`version-recovery-card.ts:151-186`). `surfacesIdle` переиспользует существующий
  `_editorSecondaryDialogBlocked` (`houseplan-card.ts:9017-9027`, покрывает `_dangerConfirm`,
  `_importDialog`, `_backupImportDialog`, `_kioskDialog` и ещё 15 диалогов) плюс отдельно
  `_partitionDeleteDialog`/`_roomDeleteDialog`/`_backdropGuard`/`_vacFit`. `_openMoreInfo`
  (`houseplan-card.ts:5603-5619`) — единственная точка входа для всех вызовов (проверено: все
  5 call site — pointer/`_ctxDevice`, keyboard через `_clickDevice`, vacuum-иконка, info-card
  кнопки — сведены к этой функции), продлевающая `_cyclePausedUntil` безусловно при
  `this._kiosk`, независимо от модальности вызова. `_tick()` (278–306) перечитывает
  `hooks.safety()` заново на каждом 250-мс тике — не залипающий снапшот, TOCTOU-окна нет (проверка
  и `claimReloadTarget` происходят синхронно в одном тике). Четыре мутанта
  (`version-recovery-ignores-editor-state`, `-ignores-dialog-state`,
  `-ignores-pending-config-write`, `-ignores-interaction-pause`) прогнаны лично мной — все
  покраснели. **Держится.**
- **AC9 (защита от reload-loop).** `attemptedTarget`/`claimReloadTarget`
  (`version-recovery.ts:117-147`) читают и пишут один и тот же ключ `sessionStorage`; target
  durable записан ДО вызова `reload()` (293–298, подтверждено мутантом
  `version-recovery-marks-target-after-reload` — покраснел лично у меня); сохранённый target
  уважается новым инстансом (мутант `version-recovery-ignores-stored-target` — покраснел лично у
  меня); недоступный `sessionStorage` — fail-safe в баннер (`attemptedTarget`/`claimReloadTarget`
  catch-блоки, 121-127/138-147). **Держится.**
- **AC10 (граница full/space).** `test/version-recovery-card-contract.test.mjs:16-31` статически
  подтверждает отсутствие импорта version-recovery в `src/space-card.ts` (grep подтвердил
  0 совпадений); браузерно — `demo/smoke_version_recovery.mjs:349-362`
  (`staticOwnsNoController: !('_versionRecovery' in staticCard)`). **Держится.**
- **AC12 (View/touch/a11y/визуальная стабильность).** `ordinaryStageDoesNotMove` (smoke) — баннер
  не двигает stage bbox; `role=status`/`aria-live=polite`/`aria-atomic=true` без повторного
  объявления благодаря early-return в `_showBanner` (`version-recovery.ts:308-310`); кнопка
  ≥44×44 CSS px (`buttonMin44` в smoke); `prefers-reduced-motion` отключает анимацию
  (`_hideBanner`, 320-330 + `base.styles.ts`). Подавление тоста #353 — точное условие
  `info.terminal && this._versionRecovery.hasCurrentMismatchNotice`
  (`houseplan-card.ts:717,747`), не более широкое: non-terminal и terminal-без-баннера всегда
  показывают тост (проверено и unit-веткой, и smoke-сценариями
  `lazyToastWithBanner`/`terminalToastWithoutBanner`). Три golden-сценария (desktop/touch/kiosk
  after-attempt) приняты в `daccaf7e` со ссылкой на прогон CI. **Держится.**

### 4.3 Документация (AC1) и артефакты сборки (AC13)

`scripts/check-docs.mjs` (диф +72 строки) статическим парсером требует ровно два снепшота
(`resource_mode: yaml` современный + помеченный legacy `mode: yaml`), запрещает плоский
top-level `resources:`, и требует оба hard-reload shortcut во всех четырёх документах — сверил
построчно с README.md/README.ru.md/USER-GUIDE.{md,ru.md}, текст идентичен ожидаемому контракту.
Мутант `resource-docs-flatten-current-yaml` прогнан лично мной — покраснел. **Держится.**

AC13: три бандл-дерева (`dist`, `custom_components/.../frontend`, демо-стенд) синхронны — это
часть зелёного Validate на `daccaf7e`, отдельно не перепроверял. i18n: en/ru/de/fr на фронтенде
(`src/i18n/*.json`) и en/ru/de/fr на бэкенде (`strings.json`+`translations/*.json`) — сверил
построчно, ключи присутствуют во всех восьми файлах без исключений.

## 5. Таблица «чем краснеет» (защитные AC, §2.7)

| AC | Чем доказан | Чем краснеет | Прогнал сам? |
|---|---|---|---|
| AC1 (docs contract) | `node scripts/check-docs.mjs` | мутант `resource-docs-flatten-current-yaml` (плоский `resources:` вместо вложенного) | Да — покраснел |
| AC3 (retry без delay) | `pytest -k retry_waits_one_second` | мутант `frontend-registration-retries-without-delay` (снята фиксированная секундная задержка) | Нет (нет pytest/HA локально) — подтверждено чтением assertion `timer["delay"] == 1.0` дважды независимо (я + субагент) |
| AC3 (retry вообще не наступает) | тот же тест | мутант `frontend-registration-skips-retry` (убран вызов `_schedule_retry`) | Нет — чтением: assertion `"callback" in started` |
| AC3 (unload-race) | `pytest -k retry_lifecycle_handles_are_cancelled` | мутант `frontend-registration-is-not-unload-bound` (убран `entry.async_on_unload`) | Нет — чтением: assertion `len(before_start_entry.unload_callbacks) == 1` |
| AC4 (флаг персистится) | `pytest -k reload_notice_is_localized_and_persisted_once` | мутант `frontend-reload-notice-forgets-persisted-flag` | Нет — чтением: assertion `len(created) == 1` после второго вызова |
| AC6 (unknown не путается с mismatch) | `node --test --test-name-pattern="malformed values stay unknown" test/version-recovery.test.mjs` | мутант `version-recovery-treats-unknown-as-mismatch` | **Да — покраснел** |
| AC6 (config/get владеет capability-adoption до соседних отказов) | `node demo/smoke_version_recovery.mjs` | мутант `version-recovery-delays-config-capability-adoption` | **Да — покраснел** (бандл пересобран, полный дорогой прогон) |
| AC7 (обычный режим не reload) | `node --test --test-name-pattern="ordinary mode always" test/version-recovery.test.mjs` | мутант `version-recovery-auto-reloads-ordinary-view` | **Да — покраснел** |
| AC8 (editor guard) | `test/version-recovery-card.test.mjs` (`card adapter maps editor state`) | мутант `version-recovery-ignores-editor-state` | **Да — покраснел** |
| AC8 (dialog guard) | тот же файл (`maps blocking surfaces`) | мутант `version-recovery-ignores-dialog-state` | **Да — покраснел** |
| AC8 (config-write guard) | тот же файл (`maps config writes`) | мутант `version-recovery-ignores-pending-config-write` | **Да — покраснел** |
| AC8 (interaction-pause guard) | тот же файл (`maps interaction pause`) | мутант `version-recovery-ignores-interaction-pause` | **Да — покраснел** |
| AC9 (target записан до reload) | `test/version-recovery.test.mjs` (`marks the exact target before one reload`) | мутант `version-recovery-marks-target-after-reload` | **Да — покраснел** |
| AC9 (сохранённый target уважается) | тот же файл (`same target is once per tab`) | мутант `version-recovery-ignores-stored-target` | **Да — покраснел** |

10 из 14 мутантов прогнаны лично мной командой `node scripts/mutation-gate.mjs --id=<id>` —
каждый показал `ok <id>: тест покраснел, как обязан`. 4 backend-мутанта относятся к дорогому
гейту (`pytest`/`homeassistant`, недоступны в этой ревью-песочнице) — для них по правилу §2.7
достаточно чтения: я лично прочитал целевые assertion'ы и подтвердил точное попадание в
мутированную строку (см. §4.1); независимый второй читатель (субагент) пришёл к тем же выводам
по тем же строкам.

## 6. Одно число — один источник

Версии, показанные в баннере (`version_mismatch.frontend`/`.backend`), и версия, используемая
для ключа `sessionStorage`-guard'а, читаются из **одного** вызова:
`compareRuntimeVersions(normalized.frontendVersion, normalized.backendVersion)`
(`version-recovery.ts:215-222`), где `normalized.backendVersion` — результат
`normalizeRuntimeVersion(capabilities.integration_version)` из того же `adoptCardConfigCapabilities`
(`version-recovery-card.ts:52`), что и адаптирует capability. Второго независимого пути получения
`integration_version` в новом коде нет — старое присвоение `_haIntegrationVersion` внутри
`_reloadLayoutOnly()` (`houseplan-card.ts:4914-4917` до диффа читало `resp?.integration_version`
из ответа `houseplan/layout/get`) **удалено этим диффом** (дифф `-4879,8 +4914,6` вычёркивает
строки `this._haIntegrationVersion = typeof resp?.integration_version === 'string' ? ...`),
то есть ранее существовавший второй источник (из `layout/get`) закрыт, а не оставлен рядом с
новым (`config/get` через `adoptCardConfigCapabilities`). Один источник подтверждён.

## 7. Что проверено и признано корректным

- Все 13 AC ТЗ разобраны по коду (см. §4), для защитных — таблицей «чем краснеет» (§5).
- Idempotency повторного `setup`/`reload`/`unload` — тестами `test_repeated_setup_updates_once_
  then_reuses_canonical_resource`, `test_fallback_survives_unload_reload_and_registry_
  reconciliation`, тремя «поколениями» в `test_retry_lifecycle_handles_are_cancelled`.
- `_safe_error` (`frontend_registration.py:108-110`) — только `phase:ExceptionClassName`, ни
  сообщения, ни пути, ни стектрейса; проверено по всем вызовам (`async_register_lovelace_
  resource`, `_add_fallback`, `_remove_owned_fallback_url`, `async_setup_frontend_registration`).
- Отсутствующий bundle не валит setup (`test_missing_frontend_bundle_does_not_skip_backend_
  setup`), sweep/repairs продолжают исполняться.
- Uninstall убирает все записи с базовым URL, но никогда — чужой/пользовательский URL
  (`test_uninstall_removes_all_base_url_entries_fallback_and_notice`,
  `test_preexisting_exact_fallback_is_used_but_never_claimed_or_removed`).
- `single_config_entry: true` в манифесте (не менялся этим диффом) исключает
  многократную конкурентную регистрацию из разных entries — предпосылка «второй retry не
  наступает» не имеет обходного пути через второй entry.
- Бюджет бандла (`scripts/bundle-budget.mjs`) пересчитан и задокументирован: потолок
  298 500→301 000, бюджет 300 000→301 066, измеренный факт 300 090 Б gzip (+2 587 Б за
  eager version-recovery controller), 976 Б запаса; `test/bundle-assets.test.mjs` больше не
  хардкодит число, читает константу.
- golden: 3 новых сценария (`version-mismatch-{desktop-dark-en,touch-light-ru,
  kiosk-attempted-dark-de}`) приняты на полном Linux CI-артефакте (`Baseline-Reviewed` ссылка
  в трейлере), `demo/golden/harness.mjs` до снятия кадра явно бросает, если целевая версия
  баннера/`sessionStorage` не совпала со сценарием — фейл-фаст на рассинхрон, а не тихий кадр.
- i18n en/ru/de/fr полны на обеих сторонах (frontend `src/i18n/*.json`, backend
  `strings.json`+`translations/*.json`), `test/i18n.test.mjs` учитывает новый allowed-equal key.
- Оба changelog обновлены в том же коммите, что и поведение (`fcf0ce80`, `User-Visible: yes`).
- Все 16 коммитов диапазона несут `Issue: #462`; единственный `User-Visible: yes` коммит содержит
  правки в обоих changelog.

## 8. Чего не проверял и почему

- **Полный локальный прогон `tsc`/`npm test`/`npm run build`/`golden:verify`/
  `pytest tests_backend`** — не прогонял: они дешёвые по регламенту, но у меня уже есть зелёный
  Validate ровно на этом SHA (`daccaf7e`), и правило «дешёвые гейты уже подтверждены» разрешает их
  не перегонять в этом раунде.
- **4 backend-мутанта (`frontend-registration-*`, `frontend-reload-notice-*`)** — не прогнаны:
  в этой ревью-песочнице нет `pytest`/`homeassistant` (`.venv-backend` не создаётся вне cloud-agent
  startup script, см. AGENTS.md), а мутация-гейт для них — дорогой (пересборка + pytest). По §2.7
  для дорогого backend-гейта разрешено читать assertion вместо повторного прогона — сделано дважды
  независимо (я и субагент), см. §5.
- **97 из 98 «прямых совпадений» `smoke-select.mjs`** — не прогонял. Инструмент матчит по общим
  символам (`_mode`, `_zoom`, `_stageEl`, `_config`, …), но подавляющее большинство совпадений —
  побочный эффект того, что `VersionRecoveryCardPort` (`version-recovery-card.ts:71-136`) объявляет
  ~40 УЖЕ существующих полей карточки как readonly-типы для предикатов безопасности, не меняя их
  семантику ни в одной строке. Ни один из этих смоков (decor/furniture/kiosk/resize/…) не проверяет
  код, который этот дифф действительно меняет — реальное изменение поведения ограничено
  `_openMoreInfo`, `_renderRoot`, `_syncVersionRecovery` и новыми модулями. Прогон всех 98 был бы
  предрелизным набором, а не гейтом ревью (PROCESS.md §8). Единственный по-настоящему целевой смок
  — `smoke_version_recovery.mjs` — прогнан (см. §2).
- **`npm run invariants`** — не прогонял: diff не трогает геометрию, `layout`, `marker.space`,
  `open_spans` ни в одной строке.
- **Performance-профили** — не прогонял: не названы в AC; единственное влияние на перф —
  бюджет бандла, который уже пересчитан и обоснован автором с измеренным фактом (см. §7).
- **Ручное тестирование в браузере** — не проводилось (в этом процессе его нет вообще, код-ревью
  заменяет его, PROCESS.md §2.7).

## 9. Вывод

Все 13 AC либо доказаны автотестом, чью способность падать я лично подтвердил (10 мутантов из 14
для #462 прогнаны лично, плюс независимая пара глаз на оставшихся 4), либо разобраны по коду с
явной пометкой «проверено чтением» там, где повторный прогон дорогого гейта не входит в объём
ревью. Три Low-находки не меняют вывод ни по одному AC и оставлены с записью. High и Medium
находок нет — ни в скоупе, ни вне его.

**Вердикт: зелёный.**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/462-card-resource-registration`, коммит `daccaf7ea54a` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0caccec714620782910b4f0c0fc60ddc0f769561`
  ```
  git log --all --format='%H %T' | grep 0caccec71462
  ```
- ТЗ `docs/specs/462-card-resource-registration.md`, блоб `d3620eab48950255aa91240cd70ec3ed1edfd756`
  ```
  git log --all --find-object=d3620eab48950255aa91240cd70ec3ed1edfd756 -- docs/specs/462-card-resource-registration.md
  ```
