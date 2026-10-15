# CODE-REVIEW-848-r1

Issue: #848 · Трек: ask · Этап: code · Заход: r1 · блокирующих циклов 0/4
Материал: `73de91b11a08e37d0da573d1269a31a1ef61d8c1` (origin/dev..HEAD, 7 коммитов, 42 файла, +1425/-88)
ТЗ принято: SPEC-REVIEW-848-r1 (зелёный), body digest `24889dff0004…e05cf8a`.

## Скоуп

AC1–AC6: наблюдаемый idle/loading/ready/error контракт для трёх опциональных
View-границ (live-подсказки, summary, Zigbee-оверлей), одна явная same-build
retry-попытка через immutable hashed root + nonce, честный отказ при чужом
fingerprint/отказе общей зависимости, сохранение summary-preference identity,
защита от late-attach после disconnect/HA-retirement, и общий с #462/#894
kiosk reload-бюджет на сборку/сессию без второго источника бюджета.
Затронутые классы риска по промпту конвейера — touch
(`live-interaction-runtime.ts:18`), devices (`is_admin` в
`zigbee-topology-overlay-bridge.ts`), ux (новый notice + 6×4 новых i18n-ключей),
visual/render (`hp-zigbee-topology-overlay.ts`, `ci:golden`).

## Как проверялось

Чтение исходников (все изменённые src/test/demo/scripts/docs файлы из
`git diff origin/dev...HEAD`), сверка с контрактом ТЗ по каждому AC, проверка
мутантов в `scripts/mutation-registry.mjs` и их `because`, чтение
`demo/smoke_view_runtime_recovery.mjs`, `..._dirty_reload.mjs`,
`..._kiosk_recovery.mjs` целиком, сверка i18n-паритета 4 словарей, сверка
трейлеров и changelog обоих языков, сверка `docs/release-ledger/v1.80.1/848.json`.

### Гейты

| Гейт | Статус | Источник |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + bundle-policy | переиспользованы | Validate full=true SUCCESS на точном `73de91b1`, [run 38700899423](https://github.com/Matysh/houseplan-card/actions/runs/38700899423) — явно подтверждено в задаче (#343), не перегонялись |
| `golden:verify` (метка `ci:golden`, #827) | переиспользован | тот же run 38700899423 включал golden (owner подтвердил `full=true`); 205/205, без правки эталонов |
| smoke-select по диффу | подтверждено чтением | `scripts/smoke-links.mjs` сопоставляет все новые `src/view-runtime-*.ts` + `summary-panel-runtime-entry.ts` с тремя новыми смоками — прямое совпадение, не "НЕОПРЕДЕЛЁННОСТЬ" |
| named native smokes (`smoke_view_runtime_recovery/_dirty_reload/_kiosk_recovery`) | не перегонялись мной, приняты по номерам в handoff | автор назвал точные количества (53/53, 5 named, 6 named) на точном SHA; я прочитал код смоков целиком и подтвердил, что сценарии реальны (настоящие 404 через `page.route`, настоящие клики/CDP navigation-history, не приватные поля) |
| pytest tests_backend / HA harness | не прогонялся — не применим | диф не трогает `custom_components/**`/`tests_backend/**` |
| model-invariants | не прогонялся — не применим | диф не меняет геометрию/её ссылки |
| performance | не прогонялся — не назван в AC | ТЗ не называет performance как критерий приёмки для этой задачи (perf fallback — отдельная #850) |

**Чего не проверял:** полевой/GPU прогон (headless Chromium ≠ реальное устройство,
это прямо признано в handoff и не оспаривается), повторный запуск
golden/tsc/test/build (переиспользован зелёный Validate), мутанты из реестра
(не исполняются в разработке, #709 — ночь).

## Проверка AC по коду (чтением) и доказательствам

| AC | Доказано чем | Проверено |
|---|---|---|
| AC1 | unit `view-runtime-boundary.test.mjs` (initial error visible, ticks never import) + native smoke (`ticks-and-hover-do-not-reimport`, no unhandled rejection) | чтением + тест умеет падать (явная проверка `attempts=[0]` после 10 вызовов `ensure()`) |
| AC2 | unit (`canRetry`→false после 1 retry, mismatched factory terminal до конструирования) + bundle-assets.test.mjs (duplicate/missing retry root бросает) + native smoke (`one-real-nonce-request-and-ready`, `foreignBuildIsRejectedBeforeCustomElementRegistration`, `dependency404…RemainsHonestReloadOnly`) | чтением + исполнением |
| AC3 | `summary-panel-identity.ts` — единый `summaryPreferenceKey()`, используемый и тёплым рантаймом (`summary-panel-runtime-loaded.ts:376`), и холодной проверкой notice (`view-runtimes.ts:summaryRecoveryRequested`) — одно число, один источник; native smoke `saved-show-preference-preserved`, `hiddenSummaryIsNotReportedAsBroken` | чтением + исполнением |
| AC4 | unit (`retired owner`, `disconnect/context retirement`, `guardedViewRuntimeReload` rejects retired decision) + native `smoke_view_runtime_dirty_reload.mjs` (настоящий dirty-marker, native modal блокирует фон, Escape→Cancel/Discard, один реальный `location` reload) + recovery smoke (`pendingImportSharedWithoutConstructingForDetachedCard`, `warmCodeCreatesDistinctRuntimeBeforeFirstRender`) | чтением + исполнением |
| AC5 | `version-recovery.test.mjs`: новый `setRuntimeFailure`/`recoveryTarget` явно прогоняется против всех `allSafe()` гейтов по одному выключенному (цикл по ключам) + общий бюджет между двумя хостами (`storage.getItem(...)==='new@bbbbbbbb'`, один reload на двоих) + native `smoke_view_runtime_kiosk_recovery.mjs` (настоящий held-pan блокирует, CDP `Page.getNavigationHistory().transitionType==='reload'`, точная камера до/после, второй terminal и warm remount не создают новый reload) | чтением + исполнением, включая отрицательный прогон (каждый safety-флаг по одному) |
| AC6 | mutant `view-runtime-notice-disappears-during-retry` (pure Node) + native smoke (персистентность >3.5s, RU/EN×360/1280, keyboard Enter + tap, 44px контролы, hidden-summary не отказавшая, aggregate double-click не плодит попытки) | чтением + исполнением |

Защитные AC — таблица «чем краснеет»:

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 | unit, явный счётчик попыток | удаление проверки `if (this.value === 'error') return Promise.resolve(false)` — мутант `view-runtime-retry-storm` |
| AC2 | unit + bundle-assets negative + native | мутант `view-summary-retry-reuses-failed-root` (Chromium module-map), `view-zigbee-installs-foreign-root` (регистрация до проверки fingerprint) |
| AC3 | native (localStorage diff до/после) | прямое падение ассерта `saved-show-preference-preserved` при регрессии адреса ключа (уже случалось в ветке — 19 failures, исправлено `b48da057`) |
| AC4 | unit + native (dirty_reload) | мутант `view-runtime-retired-owner-installs`, `view-runtime-reload-bypasses-discard` |
| AC5 | unit (цикл по safety-флагам + общий бюджет 2 хоста) | явный отрицательный цикл в самом тесте (`[key]: false` на каждом из 9 флагов, затем снятие и проверка ровно одного reload) |
| AC6 | mutant + native | мутант `view-runtime-notice-disappears-during-retry` |

Пустых третьих столбцов нет.

## Находки

### Low — неиспользуемый публичный класс после рефакторинга (не блокирует)

`src/summary-runtime-loader.ts`: `SummaryRuntimeSlot`, `SummaryRuntimeLike` и
метод `SummaryRuntimeLoader.attach()` остались в модуле, но `houseplan-card.ts`
теперь подключает summary исключительно через `ViewRuntimes`/`ViewRuntimeBoundary`
(`src/houseplan-card.ts:2258` — `_viewRuntimes`, не `_summarySlot`). Проверка
`grep -rn "SummaryRuntimeSlot" src/ test/ demo/ scripts/` показывает единственное
упоминание — объявление класса; `.attach()` вызывается только из
`test/summary-runtime-loader.test.mjs`, который тестирует сам этот путь в
изоляции, а не через карточку. Код жив с точки зрения `tsc --noUnusedLocals`
(гейт `lint:unused`), потому что символы экспортированы — гейт по конструкции
не ловит неиспользуемые публичные экспорты, только непрочитанные локали и
непортовые приватные члены. Это не дефект поведения и не влияет ни на один AC:
отмечаю как Low, не открываю цикл. Если авторы захотят — `SummaryRuntimeSlot`/
`SummaryRuntimeLike`/`.attach()` и соответствующий кусок
`test/summary-runtime-loader.test.mjs` можно удалить в рамках последующей
уборки; откладывать это необязательно.

## Что проверено и корректно

- **is_admin / видимость Zigbee** (риск «devices»): единая точка
  `zigbeeTopologyOverlayRequested()` (`src/zigbee-topology-overlay-bridge.ts`)
  используется и для рендер-гейта, и для решения о попытке загрузки/показе
  отказа в `ViewRuntimes.wantsZigbee()` — не-admin хост не видит ни оверлей, ни
  его ошибку. Нет регрессии прав.
- **i18n-паритет** (риск «ux»): все 6 новых ключей (`view.runtime_failed`,
  `_retry`, `_reload`, `_live`, `_summary`, `_zigbee`) идентично присутствуют в
  `en.json`, `ru.json`, `de.json`, `fr.json`.
- **Единый источник summary-preference-ключа** (риск корректности #8): тёплый
  рантайм и холодная проверка читают один и тот же `summaryPreferenceKey()`
  (`src/summary-panel-identity.ts`), включая сохранённую семантику
  `location.pathname` — не «новый» источник, тот же, что был.
- **build-identity fingerprint pattern**: `__HOUSEPLAN_SOURCE_FINGERPRINT__` —
  установленный паттерн (16+ модулей уже так делают), подстановка проверена в
  `scripts/bundle-manifest.mjs`/`test/bundle-assets.test.mjs` с negative-кейсами
  на дублирующийся/отсутствующий root.
- **Единый reload-бюджет** (риск архитектуры): `VersionRecoveryController`
  получил `setRuntimeFailure()`/`recoveryTarget()`, не второй класс/бюджет;
  `showCurrentVersionNotice()` явно не выдаёт отказ опционального кода за
  version mismatch (`src/version-recovery.ts:254-260`). Проверено явным
  отрицательным тестом: без известного fingerprint — нет авто-reload вообще
  (намеренно, тест `AC5: ordinary cards and unverified build identities never
  auto reload`), это соответствует «не придумывать build identity на лету».
- **Трейлеры и changelog**: оба `User-Visible: yes` коммита (`45b24911`,
  `28f00086`) содержат правки `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в
  том же коммите; остальные 5 коммитов — `User-Visible: no`, у всех есть
  `Issue: #848`.
- **release-ledger**: `docs/release-ledger/v1.80.1/848.json` —
  `category: stable-fix`, обоснование опирается на то, что сломанный путь
  (lazy live/summary/zigbee import) уже существовал в v1.80.1, это не полировка
  бета-функции — согласуется с диффом (нет новых полей конфигурации/миграций).
- **Canon-доки**: `docs/UX-MODES.md`, `docs/USER-GUIDE.ru.md`/`.md`,
  `docs/ARCHITECTURE.md` обновлены в соответствии с реализованным поведением
  (постоянная плашка, bounded retry, общий kiosk-бюджет, discard-guard).
- **44px / touch**: `.view-runtime-notice .btn { min-width: 44px; min-height: 44px; }`
  (`src/styles/chrome.styles.ts`) и smoke `both-controls-touch-floor`.
- **Golden**: владелец подтвердил `full=true` на точном SHA с golden 205/205,
  без правки эталонов, попадание в допуск (`max ratio 0.000677551`).

## Вердикт

High: 0, Medium: 0, Low: 1 (не блокирует, не образует цикл).
AC1–AC6 доказаны чтением и исполнением; дефектные AC — явными негативными
прогонами (unit-циклы по safety-флагам, mutation definitions, native CDP
navigation-history проверки). Трейлеры, changelog, release-ledger, i18n-паритет,
is_admin-гейт, golden — в порядке. Единственная находка — Low (мёртвый код
после рефакторинга, не влияющий на поведение или AC).

**Зелёный.**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/848-view-lazy-recovery`, коммит `73de91b11a08` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `cd07b15042bee4a12db821ae72234ed444e7f597`
  ```
  git log --all --format='%H %T' | grep cd07b15042be
  ```
- Тело issue: `24889dff00040233379351ead603ecd44db212285b206ca905151477de05cf8a`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ1NDAsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NjM0OTk5OTk5OTk5OTk5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMDgsIm91dHB1dF90b2tlbnMiOjQzMzc2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE3NzQ5MSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjY5NTIyMzEsImNvc3RVc2RFc3RpbWF0ZSI6Mi41MzQzODYyfV0sInR1cm5zIjo3MywiZHVyYXRpb25NcyI6NTA2ODEyLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi41MzkwMjEyLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=4648 output_tokens=43395 cache_creation_input_tokens=177491 cache_read_input_tokens=6952231 num_turns=73 -->
