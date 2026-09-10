# #500 — Одна граница владения config/adoption

- **Issue:** https://github.com/Matysh/houseplan-card/issues/500
- **Тип / приоритет:** tech-debt / P3
- **Статус ТЗ:** готово к ревью (r3 — учтены High-1/High-2 r1 и High-3 r2)
- **Трек:** полный; §5 не проходит по сложности и риску (7/10), числу
  поверхностей (7 модулей) и state-контракту revision+fingerprint, который
  читают все feature-runtime и multi-client сценарии
- **Оценка:** пользовательская ценность 5/10; ценность для разработки 8/10;
  сложность 7/10; риск 7/10
- **Класс:** A (`src/**`) — по прямому указанию владельца 2026-09-10
- **Связано:** #490 (lost-ACK recovery — четвёртый вызывающий seam), #493
  (lifecycle generation панели — вторая граница из issue, здесь не трогается),
  #491/#495 (backend-транзакции — не трогаются), #34 → #425 (umbrella не
  возобновляется), #314 (rollback отклонённой записи), #368 (revision-less
  write)

## 1. Пользовательский сценарий

Пользователь этого не наблюдает. Персона, ради которой существует граница, —
администратор дома, который правит план с двух клиентов (десктоп и планшет),
и домочадцы, чей View получает чужие правки живьём. Момент — любой приход
authoritative конфига в карточку: первая загрузка, реакция на `config_updated`,
recovery после потерянного ответа, удаление пространства, Optimize, копия
пространства, тёплый старт из кэша.

## 2. До и после

**До:** идентичность конфига (`rev`, fingerprint) и его тело хранятся в полях
хоста, которые пишут шесть модулей в шестнадцати местах; каждый новый путь
adoption сам вспоминает, что перед заменой структуры надо подготовить фон,
начать continuity-кандидата, а после — пересобрать устройства и кэш. Один из
четырёх существующих путей (`space/delete`) этого не делает и переписывает
ревизию из другого ответа.

**После:** ревизии, fingerprint и приём ответов сервера принадлежат одному
типизированному модулю; все четыре пути adoption проходят одну и ту же
последовательность; прямая запись идентичности вне модуля запрещена
lint-тестом. Для пользователя ничего не меняется, кроме одного: удаление
пространства при параллельной смене фона другим клиентом больше не даёт
переходного пустого фона.

## 3. Проблема

Материал: `origin/dev` = `a824acc1`.

1. Тройка `(_serverCfg, _cfgRev, _cfgContentFingerprint)` и пара
   `(_layout, _layoutRev, _layoutContentFingerprint)` — поля хоста без
   владельца. `_serverCfg =` — **18 присваиваний в 8 модулях**
   (`houseplan-card.ts` 6, `houseplan-editor-runtime.ts` 6,
   `plan-optimize-write.ts`, `serialized-write-queue.ts`,
   `space-copy-runtime.ts`, `summary-panel-runtime-loaded.ts`,
   `vacuum-calibration-write.ts:108`, `editors/vacuum-maps-section.ts:107`);
   `_cfgRev =` — 6 в 4 модулях; `_layoutRev =` — 7 в 4; fingerprint config —
   10 мест в 5 модулях, включая `_cacheSnapshot()`, который его попутно
   пересчитывает; fingerprint layout — 5 мест.
2. Seam `_adoptStructuralResponses` (`houseplan-card.ts:4231`) имеет **семь**
   вызывающих в двух профилях. *Reload* — три: `_loadFromServer` (4315),
   `_reloadConfigOnly` (4496), summary recovery
   (`summary-panel-runtime-loaded.ts:611`); пред-условия (сравнение
   fingerprint → `_signer.prepareImage` → `_beginContinuityCandidate`) и
   пост-шаги (`_syncDecorAssets`, `_adoptInitialSpace`,
   `_resumePendingNavMode`, `_cacheSnapshot`, `_restoreZoom`,
   `_regSignature = ''`, `_maybeRebuildDevices`) продублированы во всех трёх.
   *Post-write* — четыре, каждый после собственной парной записи перечитывает
   `config/get` + `layout/get`: `space/delete` в
   `houseplan-onboarding-runtime.ts:476` **и его байт-в-байт дубликат** в
   `houseplan-editor-runtime.ts:8693`, `plan/optimize_undo`
   (`houseplan-editor-runtime.ts:9577`), `import/apply`
   (`houseplan-editor-runtime.ts:9736`). Ни один из четырёх не проходит
   гейт фона и continuity перед сменой структуры.
3. Оба `space/delete` после adoption перезаписывают `_cfgRev`/`_layoutRev`
   ревизиями из ответа `space/delete` (`houseplan-onboarding-runtime.ts:477–478`,
   `houseplan-editor-runtime.ts:8694–8695`) — второй писатель той же ревизии
   после adoption. Тот же класс дефекта, что M1 r1 в #490, в двух копиях.
4. `SummaryPanelHost` экспортирует восемь внутренних шагов adoption как
   публичный контракт (`summary-panel-host.ts:84–94`): любой следующий
   feature-runtime получит тот же набор ножей и повторит #490 M1.
5. `houseplan-card.ts` — 13 699 строк при потолке 13 700 (`core-file-budget`).

## 4. Скоуп

1. Новый модуль `src/config-adoption.ts` — владелец идентичности config и
   layout и единственная точка превращения ответа сервера в локальное
   состояние (§6.1–6.2).
2. Единая гейт-последовательность adoption для всех **семи** путей в двух
   профилях (§6.3); `_adoptStructuralResponses` становится внутренней деталью
   модуля.
3. Хост оставляет `_serverCfg`, `_cfgRev`, `_cfgContentFingerprint`, `_layout`,
   `_layoutRev`, `_layoutContentFingerprint` как **делегаты** к модулю
   (чтение — всюду как раньше; запись — только через модуль).
4. Сужение `SummaryPanelHost` и host-контракта onboarding-runtime до одного
   метода adoption вместо восьми шагов.
5. Lint-тест «идентичность пишет только модуль» по образцу
   `single-source-numbers`; allowlist локальных замен `_serverCfg`/`_layout`
   — зафиксированный список, только вниз. Vacuum-писатели
   (`vacuum-calibration-write.ts`, `editors/vacuum-maps-section.ts`) переходят
   на `beginOptimistic`/`stageLocalConfig`/`rollbackOptimistic` модуля вместе
   с переносом `rollbackOptimistic` и в allowlist не входят.
6. Regression witness `space/delete` (оба входа) при параллельной смене
   `plan_url` — до переноса; тесты модуля на синтетических ответах; мутанты
   на защиты.
7. `docs/ARCHITECTURE.md` — абзац о границе; `core-file-budget` — храповик
   вниз.

## 5. Не входит

- Feature lifecycle registry (вторая граница из issue): #493 дал панели
  рабочий образец, открытого инцидента нет; отдельная задача при появлении
  второго потребителя.
- Иммутабельность `_serverCfg` и перевод локальных правок редактора
  (`{ ...cfg, settings }`, геометрические жесты in-place) на команды модуля —
  это umbrella-rewrite (#34/#425). Локальные замены остаются в editor runtime
  под allowlist.
- Backend: `websocket_api.py`, пары Optimize/Undo/Import (#491/#495).
- Изменение формата кэша localStorage `LS_CFG`, протокола WS, схемы конфига.
- Поведение `_sendConfigCandidate` при отсутствии `rev` в ответе (`rev + 1`)
  — сохраняется как есть, централизуется и помечается долгом (§15).
- Любая правка UX, i18n, настроек, golden.

## 6. Контракт границы

### 6.1 Состояние и владение

```ts
// src/config-adoption.ts
export interface StructuralIdentity {
  config: ServerConfig | null;   // тело; ссылка та же, что видит редактор
  configRev: number;
  configFingerprint: string;     // fingerprint принятого/отправленного тела
  layout: DeviceLayout;
  layoutRev: number;
  layoutFingerprint: string;
}
```

Инварианты:

- **I1.** `configRev` и `layoutRev` меняются только тремя способами: adoption
  authoritative ответа, приём ответа собственной записи, восстановление из
  кэша. Никакой другой код их не присваивает (AC1).
- **I2.** Ревизия принимается только **вместе** с телом, к которому относится:
  `adoptAuthoritative(cfgResp)` берёт `cfgResp.rev`; `acceptConfigWrite(candidate,
  response)` берёт `response.rev` для `candidate`. Ревизия одного ответа не
  прикладывается к телу другого (закрывает п.3 §3; AC4).
- **I3.** Одинаковый fingerprint при adoption — эхо: тело, история геометрии,
  drag и viewport не трогаются, ревизия обновляется (как сегодня, AC3).
- **I4.** Ссылочная идентичность: модуль хранит тот объект, который получил,
  без клонирования — редактор сравнивает `host._serverCfg === cfg`
  (`houseplan-editor-runtime.ts:8099`) и мутирует тело in-place.

### 6.2 API модуля

```ts
export class ConfigAdoption implements StructuralIdentity {
  /** Чистое сравнение без мутации: что изменится, если принять ответ. */
  compare(cfgResp?: AuthoritativeConfigResponse, layResp?: LayoutResponse):
    { configChanged: boolean; layoutChanged: boolean; candidateConfig: ServerConfig | null };
  /** Принять authoritative ответ(ы); побочные эффекты хоста — через callbacks. */
  adoptAuthoritative(cfgResp, layResp?, layoutOverride?): { configChanged; layoutChanged };
  /** После собственного config/set: fingerprint = candidate, rev = ответ. */
  acceptConfigWrite(candidate: ServerConfig, response: { rev?: number }): void;
  /** После layout/set или собственного layout-события. */
  acceptLayoutWrite(layout: DeviceLayout, response: { rev?: number }): void;
  /** После парной записи (plan/optimize, copy, import): оба тела + обе ревизии. */
  acceptPairWrite(config, layout, response: { config_rev?; layout_rev? }): void;
  /** Локальная замена тела редактором до записи; идентичность не меняется. */
  stageLocalConfig(config: ServerConfig): void;
  stageLocalLayout(layout: DeviceLayout): void;
  /** Тёплый старт и кэш: формат LS_CFG неизменен. */
  restoreCached(snapshot: CachedSnapshot): boolean;
  snapshot(): CachedSnapshot;
  /** Optimistic write (#314): захват и точный откат по rev+fingerprint. */
  beginOptimistic(previous, attempted): OptimisticAttempt<ServerConfig>;
  rollbackOptimistic(attempt): boolean;
}
```

Побочные эффекты хоста при смене структуры (очистка `_geometryHistory`,
`_devicePositionHistory`, `_cancelDeviceDrag`, `_pendingPhysicalWrites`,
`_clearRoomFocus`, `_cancelCameraTransition`, `_clearGeometryGesture`,
`_seedDecorStyle`, virtual lights, capabilities, `_continuity.note`) остаются в
хосте и вызываются модулем через типизированный `AdoptionHost`-интерфейс в
**том же порядке**, что сегодня в `_adoptStructuralResponses` — модуль владеет
идентичностью и последовательностью, не логикой этих подсистем.

### 6.3 Единая гейт-последовательность

```ts
export async function adoptAuthoritativeGated(host: AdoptionHost, input: {
  cfgResp?: AuthoritativeConfigResponse; layResp?: LayoutResponse;
  reason: 'structural-response' | 'config-reload' | 'summary-recovery'
        | 'space-delete' | 'optimize-undo' | 'import-apply';
  profile: 'reload' | 'post-write';
}): Promise<'adopted' | 'asset-wait'>;
```

Шаги 1–4 общие для обоих профилей, шаг 5 — по профилю. Профиль `reload` —
ровно как сегодня в `_reloadConfigOnly`/summary recovery:

1. `compare` → если структура не изменилась, шаги 2–3 пропускаются.
2. `await host._signer.prepareImage(hass, host._candidateBackdrop(candidate))`;
   при отказе — `_continuity.note('asset-failed')`, `_scheduleLoadRetry(true)`,
   возврат `'asset-wait'`, **ничего не адоптировано**.
3. Если `_continuity.hasCompleteFrame && state === 'steady'` —
   `_beginContinuityCandidate(reason, true)`.
4. `adoptAuthoritative(...)`.
5. Пост-шаги профиля `reload`: `_syncDecorAssets(candidate)`
   (fire-and-forget), `_adoptInitialSpace(_model, true)`,
   `_resumePendingNavMode()`, `_cacheSnapshot()`, `_restoreZoom()` если
   видимое пространство сменилось, `_regSignature = ''`,
   `_maybeRebuildDevices()`.
   Профиль `post-write` **пост-шагов не имеет**: последовательность
   заканчивается шагом 4, а хвост каждого post-write вызывающего (очистки,
   `_cfgEpoch++`, выбор пространства, `_cacheSnapshot`, toast) остаётся в
   вызывающем **без изменений** — включая `_adoptInitialSpace(_model, true)`
   в ветке `_hasFixedFloor` у `import/apply`
   (`houseplan-editor-runtime.ts:9757`) и `_commitSpace(...)` у обоих
   `space/delete` и у `import/apply` без фиксированного этажа. Общий хвост
   у четырёх путей разный по составу и порядку; вычленять из него «общую
   часть» значило бы менять порядок побочных эффектов, чего это ТЗ не делает.

Особенности вызывающих остаются снаружи и не размножаются:
`_loadFromServer` — флаги `_connectionWasLost`, `_serverStorage`, warm-viewport
логика `_warmVpArmed`, `_loadOk`, подписки; `_reloadConfigOnly` — continuity
кандидат `'config-reload'` **до** запроса и ветка `_cfgWriting`; summary —
`confirmedSummaryPanelWriteRecovery` и генерация; `space/delete` —
`_commitSpace` при удалении текущего пространства и toast; `optimize_undo` —
сброс `_canOptimizeUndo`/`_undoKind`, очистки историй, `_cfgEpoch++`, toast;
`import/apply` — очистки `_dirtyPos`/`_sentPos`/`_defPos`, снапшотов
устройств, `_signer.invalidate` + `_resign`, `_cfgEpoch++`, выбор
пространства (`_adoptInitialSpace` при `_hasFixedFloor`, иначе
`_commitSpace(nextSpace)`), `_cacheSnapshot`. Две копии
`space/delete` обязаны вызывать одну последовательность; слияние их в один
метод хоста допустимо, но не требуется этим ТЗ.

**Единственное намеренное изменение поведения — гейт на post-write путях.**
Все четыре post-write пути получают шаги 2–3 (готовность фона и continuity
перед сменой структуры), а оба `space/delete` перестают перезаписывать
`_cfgRev`/`_layoutRev` ревизиями из ответа `space/delete` — обе ревизии
берутся из адоптированных `config/get` и `layout/get` (I2). Backend отдаёт в
`space/delete` те же значения, что затем вернёт `get`, поэтому в штатном
случае числа совпадают; расходятся они только при параллельной записи между
`delete` и `get` — и тогда прежний код ставил ревизию **старше** тела, а
следующая запись получала ложный `conflict`. Для `optimize_undo` и
`import/apply` изменение сводится к ожиданию `prepareImage` при смене
`plan_url` (Undo/Import могут вернуть другой фон) — сегодня они адоптируют
структуру до подписания фона, тот же переходный дефект, что M1 #490.

### 6.4 Сужение публичных контрактов

`SummaryPanelHost` теряет `_beginContinuityCandidate`, `_adoptStructuralResponses`,
`_syncDecorAssets`, `_adoptInitialSpace`, `_resumePendingNavMode`,
`_restoreZoom`, `_cacheSnapshot`, `_candidateBackdrop`, `_scheduleLoadRetry`,
`_signer`, `_continuity` и получает один `_adoptAuthoritative(cfgResp, reason)`.
Host-интерфейсы onboarding-runtime и editor-runtime
(`houseplan-editor-runtime.ts:842`) теряют `_adoptStructuralResponses` и
получают тот же метод с профилем `post-write`. `plan-optimize-write.ts` и
`space-copy-runtime.ts` вместо пяти полей идентичности получают
`acceptPairWrite`. `serialized-write-queue.ts` сохраняет чистые
`enqueueSerializedWrite`/`optimisticAttempt`; `rollbackOptimistic` переезжает
в модуль (единственный писатель тела из отката), и вместе с ним на модуль
переходят все его вызывающие — editor runtime, `vacuum-calibration-write.ts`,
`editors/vacuum-maps-section.ts`.

## 7. UX

Нет изменений. Персоны View и киоск не затрагиваются; touch-контракт
(`docs/TOUCH-SUPPORT.md`) не меняется.

## 8. Модель данных и миграция

Нет. Формат `LS_CFG` (`config, rev, config_fingerprint, layout, layout_rev,
layout_fingerprint, virtual_lights`) сохраняется побайтово; старый кэш без
fingerprint восстанавливается с пересчётом, как сегодня. Схема конфига, WS
и `docs/CONFIG-COMPATIBILITY.md` — без изменений.

## 9. i18n

Нет новых ключей; `toast.cfg_reload_failed`, `toast.space_deleted`,
`toast.conflict` используются как прежде.

## 10. Критерии приёмки

| # | AC | Чем доказан | Чем краснеет |
|---|---|---|---|
| AC1 | Идентичность пишет только модуль: в `src/**` вне `config-adoption.ts` нет присваиваний `_cfgRev`, `_layoutRev`, `_cfgContentFingerprint`, `_layoutContentFingerprint` (в т.ч. через `host.`); присваивания тел `_serverCfg =`/`_layout =` вне модуля — только локальные замены до записи (staging) в allowlist `{ 'houseplan-editor-runtime.ts': N, 'houseplan-card.ts': M }` (размещение устройств), счётчики зафиксированы и могут только уменьшаться; во **всех остальных** файлах `src/**` — ноль, в том числе `plan-optimize-write.ts`, `serialized-write-queue.ts`, `space-copy-runtime.ts`, `summary-panel-runtime-loaded.ts`, `houseplan-onboarding-runtime.ts`, `vacuum-calibration-write.ts`, `editors/vacuum-maps-section.ts` (последние два — через `stageLocalConfig`/`beginOptimistic`/`rollbackOptimistic` модуля) | unit `test/config-adoption-ownership.test.mjs` (regex по `src/**`, по образцу `single-source-numbers`) | вернуть одно присваивание в `plan-optimize-write.ts` — тест красный; поднять счётчик allowlist без правки теста — красный |
| AC2 | Все **семь** путей adoption (§3 п.2) идут через `adoptAuthoritativeGated`; имя `_adoptStructuralResponses` не встречается в `src/**` вне `config-adoption.ts`; `SummaryPanelHost`, host-интерфейсы onboarding- и editor-runtime не содержат шагов §6.4 | unit (grep по `src/**` на отсутствие имён вне модуля) + `npm run typecheck` | оставить вызов `_adoptStructuralResponses` в любом из семи мест — красный |
| AC3 | Поведенческая нейтральность: таблица переходов модуля на синтетических ответах совпадает с сегодняшней — эхо (тот же fingerprint: тело и истории не тронуты, rev обновлён), смена config (истории очищены, fingerprint новый), только layout, ответ без `rev` (старый rev сохранён), `layoutOverride`, virtual lights, профиль `post-write` завершается шагом 4 и не выполняет пост-шагов профиля `reload` (хост-callbacks `_adoptInitialSpace`/`_resumePendingNavMode`/`_restoreZoom`/`_syncDecorAssets` не вызываются модулем); хвосты четырёх post-write вызывающих не меняются — сверка диффом на ревью; существующие свидетели зелёные без изменения ожиданий: `demo/smoke_summary_panel.mjs` (lost-ACK + параллельная правка + порядок `prepare → adopt`), `demo/smoke_ws_resilience.mjs`, `test/render-invalidation.test.mjs`, `test/serialized-write-queue.test.mjs`, `test/summary-panel-runtime.test.mjs`, `test/config-store.test.mjs` | unit `test/config-adoption.test.mjs` + перечисленные смоки/юниты | мутант «эхо тоже очищает историю» — unit красный; мутант «prepareImage не ждём» — `smoke_summary_panel` красный (`recoveryPreparesBackdropBeforeAdoption`, уже есть) |
| AC4 | Post-write пути: для каждого из четырёх (`space/delete` ×2 входа, `optimize_undo`, `import/apply`) при параллельной смене `plan_url` другим клиентом `prepareImage` вызывается **до** adoption; после обоих `space/delete` `configRev`/`layoutRev` равны ревизиям адоптированных `config/get`/`layout/get`, а не ответа `delete` | `demo/smoke_post_write_adoption.mjs` на production bundle: четыре сценария с synthetic HA, моки `prepareImage` и порядок вызовов (по образцу `recoveryPreparesBackdropBeforeAdoption`), для `space/delete` — оба входа (onboarding и editor runtime) и проверка ревизий; unit модуля «ревизия не берётся из чужого ответа» (I2) | вернуть `host._cfgRev = response.config_rev` в любой копии `delete` — смок и unit красные; убрать гейт в любом из четырёх — смок красный |
| AC5 | Тёплый старт: `snapshot()` → `restoreCached()` восстанавливает идентичность ровно (rev, оба fingerprint, layout, virtual lights); ключи `LS_CFG` неизменны; кэш без fingerprint восстанавливается с пересчётом | unit `test/config-adoption.test.mjs` (round-trip и фикстура старого кэша) | переименовать ключ или потерять `layout_rev` — красный |
| AC6 | Optimistic rollback (#314) через модуль: откат только при совпадении rev **и** fingerprint попытки; откат не меняет rev; конфликтный reload побеждает | `test/serialized-write-queue.test.mjs` перенесён/адаптирован + мутант | мутант «откат без проверки rev» — красный |
| AC7 | Бюджеты: `core-file-budget` для `houseplan-card.ts` опущен до нового размера (храповик вниз), `bundle:budget` не поднят; новых WS-запросов на путях adoption нет (те же `config/get`/`layout/get`, что сегодня) | `test/core-file-budget.test.mjs`, `npm run bundle:budget`; отсутствие новых `callWS` — ревью диффа | поднять потолок — красный (по правилу теста) |
| AC8 | Документация: `docs/ARCHITECTURE.md` описывает границу (владелец, три способа смены ревизии, единая последовательность); changelog не трогается (`User-Visible: no`) | ревью кода | — |

## 11. План автотестов

- `test/config-adoption.test.mjs` — таблица переходов AC3, round-trip AC5,
  I2/I4 (ссылка та же; ревизия не от чужого ответа), rollback AC6.
- `test/config-adoption-ownership.test.mjs` — lint AC1/AC2 по `src/**`.
- `demo/smoke_post_write_adoption.mjs` — AC4 на production bundle с
  synthetic HA: второй клиент меняет `plan_url` между записью и `get`; четыре
  сценария (`space/delete` из onboarding и из editor runtime, `optimize_undo`,
  `import/apply`), порядок `prepare → adopt`, ревизии из `get`.
- Существующие: `smoke_summary_panel`, `smoke_ws_resilience`,
  `render-invalidation`, `serialized-write-queue`, `summary-panel-runtime`,
  `config-store`, `core-file-budget` — без изменения ожиданий,
  кроме адаптации импорта в `serialized-write-queue.test.mjs`.
- Мутанты в `scripts/mutation-gate.mjs` (§2.7, защиты в продуктовом коде):
  `config-adoption-echo-clears-history`, `config-adoption-rev-from-foreign-response`,
  `config-adoption-rollback-ignores-rev`, `post-write-skips-asset-gate`
  (снимает гейт в `post-write` профиле — смок AC4 красный на всех четырёх).
- Гейт по диффу: `typecheck`, `test`, `build`, `bundle:budget`, `no-new-any`;
  смоки по `smoke-select` для `_serverCfg`/`_cfgRev`/`_adoptStructuralResponses`;
  golden/perf — предрелизный набор (диффом не задеты: рендер не меняется).

## 12. Риски и защита

| Риск | Защита |
|---|---|
| Реактивность: `_serverCfg` станет геттером, а Lit-обновления зависят от поля | `_serverCfg`, `_layout`, `_cfgRev` и fingerprint не входят в `static properties` хоста (проверено на `a824acc1`); обновления идут через `requestUpdate()` явно; смоки render-invalidation |
| Редактор сравнивает и мутирует тело по ссылке | I4 — без клонирования; unit на идентичность ссылки |
| Скрытый порядок побочных эффектов в `_adoptStructuralResponses` | Порядок переносится один в один, тест-таблица AC3 фиксирует наблюдаемые результаты; ревьюер сверяет диффом |
| Ребейз-конфликты в `houseplan-card.ts`/`houseplan-editor-runtime.ts` (горячие файлы) | Небольшие коммиты: (1) модуль + тесты, (2) хост-делегаты, (3) четыре пути, (4) сужение контрактов, (5) lint + бюджеты + docs; `scripts/rebase-on-dev.mjs` |
| Гейт на post-write путях — единственное изменение поведения | Собственный AC4 и смок на все четыре пути; зафиксировано в §6.3 как намеренное |
| Профиль `post-write` случайно получит пост-шаги `reload` (`_adoptInitialSpace`, `_restoreZoom`) или хвост вызывающего изменится при переносе | Профиль явный в сигнатуре и не имеет пост-шагов; таблица AC3 включает кейс «post-write завершается шагом 4»; хвосты вызывающих в диффе не меняются (ревью); смок AC4 проверяет сегодняшнее правило выбора пространства после Import: при `_hasFixedFloor` — `_adoptInitialSpace`, иначе целевое/прежнее пространство — а не его отсутствие |
| Windows-гейт владельца | Никаких новых spawn/путей; тесты — чистые Node |

## 13. Откат

Один revert коммитов ветки `issue/500-config-adoption-boundary`; данные,
кэш и протокол не менялись, откатывать нечего кроме кода. Флага Labs нет —
рефакторинг без пользовательской поверхности.

## 14. Release-артефакты

- Changelog RU/EN: **нет** (`User-Visible: no` на всех коммитах).
- Пользовательская документация: нет.
- Golden/скриншоты: нет (визуал не меняется).
- `docs/ARCHITECTURE.md`: абзац о границе (AC8).
- Performance: бюджеты по AC7, без новых замеров.
- Security: нет.

## 15. Принято предположительно (техническое, менять свободно)

1. Имя и место модуля — `src/config-adoption.ts`, класс `ConfigAdoption`;
   хост держит один экземпляр `_adoption` и делегаты-геттеры.
2. Побочные эффекты хоста при смене структуры остаются в хосте и вызываются
   через `AdoptionHost` — модуль владеет идентичностью и порядком, не
   подсистемами. Альтернатива «перенести очистки в модуль» отвергнута:
   это тянет за собой историю геометрии, камеру и жесты (umbrella).
3. `_sendConfigCandidate` сохраняет `rev ?? rev + 1`; централизуется в
   `acceptConfigWrite`, помечается `// TODO(#500-followup)`; отдельный issue
   после этой задачи — угаданная ревизия при ответе без `rev` противоречит I2,
   но менять её здесь значит менять поведение с backend-заглушками (демо).
4. Allowlist AC1: `houseplan-editor-runtime.ts` (замены `_serverCfg`/`_layout`
   до записи) и `houseplan-card.ts` (staging `_layout` при размещении
   устройств, `applyDevicePlacement`); начальные значения — фактические числа
   после переноса, только вниз.
5. `_reloadLayoutOnly` (слияние `mine` поверх ответа) использует
   `acceptLayoutWrite(merged, resp)` — семантика та же: тело слитое, ревизия
   ответа; отдельного «adopt layout with override» не заводится.
6. Lifecycle registry не начинается даже частично: post-write пути берут
   готовую последовательность, а не новый механизм регистрации.
7. Два профиля вместо одного: у `reload` пост-шаги общие и одинаковые в трёх
   местах, у `post-write` хвосты разные (Import выбирает пространство по
   `_hasFixedFloor`, Delete — `_commitSpace`, Undo — сброс undo-состояния),
   поэтому `post-write` = только гейт + adoption, хвосты остаются на месте.
   Склеивать профили значило бы менять поведение Import/Undo/Delete (выбор
   пространства, viewport). Третьего профиля не заводится; новый вызывающий
   с иным набором шагов — повод пересмотреть границу, а не добавить ветку.
