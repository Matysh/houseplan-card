# CODE-REVIEW-131-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/131
- **Диапазон:** `origin/dev..HEAD` (`0164e65` спека, `031148e` спек-ревью,
  `cebb19a` реализация)
- **Роль:** ревьюер кода (не автор), этап `S7-code-review`
- **Трек:** обычный, цикл r1/4
- **ТЗ:** `docs/specs/131-readonly-cold-start.md`, spec-review
  `docs/reviews/SPEC-REVIEW-131-r1.md` (зелёный, r1)

## Скоуп ревью

Проверялось соответствие реализации контракту §7 ТЗ (инвариант выбранного
пространства, приоритет, обязательная/необязательная части загрузки,
деградация live-sync, reload/cache/warm remount) и AC1–AC12 (§11), а также:

- `docs/SCOPE.md` — задача чинит регрессию внутри уже закрытых J1/J6 и
  гарантированного View/touch/kiosk-контракта, не расширяет скоуп;
- `AGENTS.md` — классы файлов, трейлеры, синхронность трёх копий бандла;
- `docs/ARCHITECTURE.md`, `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md` —
  правки в срезе одного коммита `cebb19a`;
- фактический код `src/houseplan-card.ts` и новый `src/initial-load.ts` —
  построчно, включая места, не упомянутые в diff явно (порядок вызовов в
  `updated`/`willUpdate`/`connectedCallback`/`disconnectedCallback`,
  `_onConnReady`/`_onConnLost`, `_reloadConfigOnly`).

## Как проверялось

### Гейты, которые я прогнал

1. `npx tsc --noEmit` — green, без вывода.
2. `npm test` — **771/771 green** (`node --test`, `duration_ms 4267`). Автор
   сообщал 770/771 с известным Windows-only падением
   `test/process-gate.test.mjs`; в этом (Linux) окружении все 771 зелёные —
   согласуется с тем, что тот дефект специфичен для Windows-путей и здесь не
   воспроизводится.
3. `npm run build` — green. Три копии бандла после build побайтно совпадают
   друг с другом и с git-версией (никаких незакоммиченных изменений):
   `sha256 00f526a2231487fabd36387731c83a483bc8387798c9b51dccd440ba5ae6a5ca`,
   идентично значению из комментария автора «Implementation handoff». `git
   status --porcelain` после build — пусто.
4. `node --check demo/smoke_readonly_cold_start.mjs` — синтаксис ок.
5. **`node demo/smoke_readonly_cold_start.mjs` — запущен полностью (не
   только синтаксическая проверка).** Результат: все 13 внутренних проверок
   `true`, `OK`. Он назван в AC3/AC4/AC6/AC8 и напрямую покрывает тронутую
   поверхность — цикл реализации по процессу его не обязан был гонять, но
   ревью обязано ответить «оно вообще работает», и это самый прямой способ.
6. **Дисциплина «тест умеет падать» — проверена активно, не только чтением.**
   Временно подменил `src/houseplan-card.ts` на версию `origin/dev` (без
   `src/initial-load.ts`), пересобрал бандл и прогнал тот же smoke:
   он **упал** с точной сигнатурой дефекта из issue —
   `"space":"f1"`, `"exactSpace":null`, `"activeSpace":null`, `rooms:2` но
   `decor:0`, `walls:1`, `glow:0` — и дополнительно показал `"configGets":9`
   (непрерывный full-load retry от отказа необязательной подписки — ровно
   риск §14.2 ТЗ и находка аналитики S2). После проверки восстановил
   `src/houseplan-card.ts` и `src/initial-load.ts` из HEAD, пересобрал,
   сверил SHA-256 всех трёх копий бандла — снова
   `00f526a2231487fabd36387731c83a483bc8387798c9b51dccd440ba5ae6a5ca`, `git
   status --porcelain` пуст. Тест не тавтологичен: он реально различает
   старое и новое поведение.
7. Дополнительно прогнал 4 существующих browser-smoke, которые дёргают тот
   же переставленный код (`_warmVpArmed`/`_restoreZoom`/порядок в
   `_loadFromServer`/`connectedCallback`/`disconnectedCallback`), потому что
   это «поверхности, тронутые диффом», а не только названные в AC:
   `demo/smoke_warm_remount.mjs`, `demo/smoke_kiosk.mjs`,
   `demo/smoke_warm_owners.mjs`, `demo/smoke_warm_dialogs.mjs` — все green,
   регрессий в warm-continuity/kiosk-контракте не найдено.
8. Прочитан весь diff `src/houseplan-card.ts` и весь новый `src/initial-load.ts`
   построчно (не только заголовки функций), плюс: `test/initial-load.test.mjs`
   (проверено, что unit-тесты покрывают именно матрицу AC1/AC5 — валидный/устаревший
   hash × `LS_NAV` × `default_floor` × 0/1/N пространств, включая
   `legacy 'f1'` и «hash применён один раз, дальше не мешает навигации»),
   `demo/smoke_readonly_cold_start.mjs` целиком (не только последний вывод),
   `docs/ARCHITECTURE.md`/`docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md`/
   `tsconfig.test.json` диффы, `git log` трейлеры трёх коммитов.

### Гейты, которые я НЕ прогнал, и почему

- **`npm run golden:verify`** — не прогонял. ТЗ §12 обоснованно (и spec-review
  это подтвердил) заявляет, что нового намеренного визуала нет: конечный
  вид совпадает с уже существующим состоянием после клика по вкладке,
  которое уже покрыто действующими golden-baseline. Правка не меняет ни один
  рендер-путь (`_curSpaceCfg`, слои пола/декора/стен/Glow остаются теми же
  функциями) — меняется только момент, когда `_space` становится точным ID,
  а не логика самой отрисовки после этого момента. Дополнительно проверил
  это чтением: ни одна из четырёх прогнанных смоук-проверок (warm_remount,
  kiosk, warm_owners, warm_dialogs), которые визуально чувствительны к
  той же цепочке кода, не показала расхождений. Решение — сознательный
  пропуск, не молчаливый.
- **Полный набор из 127 `demo/smoke_*.mjs`** — не прогонял. Диф не касается
  геометрии, редакторов, экспорта/импорта, правил иконок и прочих
  поверхностей, не связанных с cold start/space selection/subscriptions;
  гонять все 127 было бы гейтом уровня пре-релиза, а не этого код-ревью.
  Прогнал 5 смоуков (сам новый плюс 4 связанных по коду) — соразмерно диффу.
- **`npm run performance_smoke` / perf-профили** — не прогонял. AC11 явно
  требует «нормализация не в hot path»; проверил это чтением (см. ниже,
  раздел «Что проверено и корректно») — все три вызова `_adoptInitialSpace`
  и оба вызова `_candidateBackdrop` находятся строго в load/reload путях
  (`setConfig` из cache, `_loadFromServer`, `_reloadConfigOnly`), ни один не
  вызывается из `willUpdate`/`updated`, которые исполняются на каждый
  hass-тик. Новый per-tick код не добавлен — perf-гейт не относится к этому
  диффу по своему собственному критерию (AC11), а не потому что его дорого
  гонять.
- **`python -m pytest tests_backend -q`** — не прогонял. `custom_components/**/*.py`
  в диффе не тронут (`git diff --stat` подтверждает: только
  `src/**`, `test/**`, `demo/**`, `docs/**`, `tsconfig.test.json`,
  `dist/**`/frontend copies).
- **Ручной просмотр в браузере (не Playwright)** — не делал; данных
  достаточно от исполняемых unit/smoke прогонов с реальным shadow DOM
  (`demo/smoke_readonly_cold_start.mjs` читает `root.querySelectorAll(...)`,
  а не только внутреннее состояние `_model`).

## Находки

Находок уровня **High** и **Medium** нет.

Замечаний уровня **Low** нет: единственная Low-находка предыдущего этапа
(SPEC-REVIEW Low-1, плотная формулировка §7.2 про hash/warm-viewport) —
находка ТЗ, не кода; в реализации проверенное поведение (`_hashApplied`,
`_warmVpArmed`, `preserveCurrent`) соответствует и коду, и намерению ТЗ, и не
требует правки текста ради корректности кода.

## Что проверено и корректно

- **Единый resolver (§8 п.2 ТЗ).** `resolveInitialSpace()` в
  `src/initial-load.ts` — чистая функция без побочных эффектов; все три места
  выбора пространства (`setConfig` при чтении `LS_CFG`, `_loadFromServer`,
  `_reloadConfigOnly`) идут через один и тот же `_initialSpaceSelection()` →
  `_adoptInitialSpace()`. Разошедшихся копий правил приоритета нет — ровно то,
  что требует архитектурный контракт.
- **Порядок «нормализация до первого live-sync await» (§8 п.1, AC2).** В
  `_loadFromServer()` (`src/houseplan-card.ts:3246-3271`) `_adoptInitialSpace`,
  `_resumePendingNavMode`, `_cacheSnapshot` и восстановление viewport
  выполняются **до** `this._loadOk = true` и до вызова
  `_ensureLiveSyncSubscriptions()`; сама подписка на события вынесена в
  отдельный метод, вызываемый уже после этой точки. Раньше (в `origin/dev`)
  было наоборот: три `await subscribeEvents(...)` шли до выбора пространства,
  это и была причина дефекта — воспроизвёл её напрямую (см. «Как проверялось»
  п.6).
- **Изоляция rejection необязательных подписок (§8 п.4, AC7, AC9).**
  `_ensureLiveSyncSubscriptions()` строит массив `attempts` и передаёт их в
  `settleBestEffort()` (`Promise.allSettled` под капотом,
  `src/initial-load.ts:44-49`) — отклонение одной подписки не бросает
  исключение наружу и не может попасть во внешний `catch` `_loadFromServer`,
  который по-прежнему реагирует только на отказ обязательных
  `config/get`/`layout/get`/asset (`src/houseplan-card.ts:3272-3282`,
  не изменено диффом кроме сдвига `_loadOk`). Юнит-тест
  `best-effort optional work starts every attempt and contains rejections`
  (`test/initial-load.test.mjs:53-61`) подтверждает это на уровне чистой
  функции с управляемыми fulfilled/rejected промисами.
- **Идемпотентность и отсутствие retry storm (§8 п.5–6, AC7, AC11).**
  Каждая из трёх подписок оборачивается общим хелпером `subscribe()`
  (`:3319-3335`), который проверяет `current()` до попытки и повторно после
  резолва (`generation === this._liveSyncGeneration && this.isConnected &&
  this.hass?.connection === connection && !current()`) — гонка
  disconnect/reconnect посреди подписки корректно ликвидирует «зомби»-
  подписку вызовом её же `unsubscribe()`. `disconnectedCallback` теперь чистит
  и `_unsubTrail` (`:1947-1950`), чего не было на `origin/dev` — там подписка
  на trail никогда не отписывалась при отключении карточки, и её poле
  оставалось «занятым» стейл-функцией, из-за чего `_ensureLiveSyncSubscriptions`
  ошибочно посчитала бы канал уже подписанным после реконнекта. Эта правка не
  упомянута в ТЗ явно, но необходима для корректности той самой
  idempotency-гарантии, которую ТЗ требует (§8 п.6) — это не выход за скоуп, а
  предусловие для него.
- **Ретрай отклонённой подписки происходит на «следующей обычной
  загрузке/реконнекте» (§7.4), а не в hot path.** Единственные вызовы
  `_ensureLiveSyncSubscriptions()` — `connectedCallback` (переподключение/
  ремонт карточки, `:1862`) и конец успешного `_loadFromServer` (`:3271`),
  который сам вызывается из `_onConnReady` (`ready`-событие сокета,
  `:3729`) и из `willUpdate` только пока `!this._loadOk` (`:3070`). Ни
  `willUpdate`, ни `updated()` не вызывают его напрямую на каждый
  hass-тик — подтверждает AC11 «нормализация не в render hot path».
- **Отсутствие права записи не расширяется (AC10).** `_serverCanWrite`/
  `_canEdit` не тронуты диффом; смоук `readOnlyStaysReadOnly` (карточка
  остаётся `_canEdit === false`, нет `.modetab` в DOM) подтверждён реальным
  прогоном, не только чтением.
- **Приоритет и hash-once-then-navigate (§7.2, AC1, AC5).** `_initialSpaceSelection`
  передаёt `acceptHash: !this._hashApplied` и `preserveCurrent: this._hashApplied
  || this._navApplied || this._warmVpArmed` — воспроизводит именно то
  взаимодействие, которое подтвердил spec-review построчным чтением
  `_warmAdoptViewport`/`_pickSpace` до реализации. Юнит-тесты
  (`test/initial-load.test.mjs:23-40`) покрывают «explicit hash побеждает
  один раз, затем принятая навигация сохраняется» и «legacy `f1` никогда не
  трактуется как cold-start источник».
- **Reload/warm remount/kiosk (AC6, AC8).** Прогнанный
  `demo/smoke_readonly_cold_start.mjs` подтверждает: cold start без cache,
  warm remount без cache, «reload» (повторный маунт с валидным `LS_CFG`) и
  kiosk с `reject-all` подписками — во всех случаях `_space`, exact raw
  space, все геометрические слои и (где применимо) активная вкладка на
  месте без клика; клик по уже активной вкладке — no-op
  (`activeTabClickIsNoop: true`).
- **Trailers и class-структура (AGENTS.md).** `cebb19a`: `Issue: #131`,
  `User-Visible: yes`, оба changelog правлены в этом же коммите. Файлы —
  класс A (`src/houseplan-card.ts`, новый `src/initial-load.ts`), класс B
  (`test/initial-load.test.mjs`, `demo/smoke_readonly_cold_start.mjs`,
  `tsconfig.test.json`), класс C (`docs/ARCHITECTURE.md`, оба changelog),
  класс D (три копии бандла) — синхронны и побайтно идентичны после
  самостоятельной пересборки.
- **Соответствие `docs/SCOPE.md`.** Правка — регрессия внутри уже закрытых
  J1/J6 и гарантированного View/kiosk-контракта (`docs/TOUCH-SUPPORT.md`);
  не открывает новую функциональность, не трогает lock-инвариант, не
  удаляет файлы пользователя.

## Чего не проверял

- `python -m pytest tests_backend` — backend не тронут диффом, гейт не
  относится к задаче.
- `npm run golden:verify` и `npm run performance_smoke` — см. обоснование
  выше в разделе «Гейты… не прогнал».
- Полный набор всех 127 browser-smoke — прогнаны только 5 релевантных
  (см. выше); остальные 122 не относятся к тронутой поверхности и остаются
  на пре-релизный гейт.
- Реальный HA-сервер с настоящим read-only пользователем — не поднимал;
  весь прогон идёт через `demo/serve.mjs` с фейковым `hass`, как и
  предполагает штатная smoke-инфраструктура проекта (`AGENTS.md`).
- Поведение `houseplan-space-card` (статическая карточка) — вне скоупа ТЗ
  §6 и диффа: ни один изменённый файл к ней не относится.
- Гонку двух параллельных вызовов `_loadFromServer()` для одной и той же
  карточки (например, `_onConnReady` и `willUpdate` почти одновременно) не
  воспроизводил вручную; прочитал защиту (`this._loading` гейт в начале
  `_loadFromServer`, не изменённую диффом) и она выглядит согласованной, но
  это разобрано чтением, а не отдельным сценарием — риск не нулевой, но не
  новый (существовал и на `origin/dev` в той же форме).

## Вердикт

Зелёный. High: 0, Medium: 0. Реализация покрывает контракт §7 ТЗ и все 12 AC;
переставленный порядок mandatory/optional подтверждён построчным чтением и
воспроизведением дефекта на до-фиксной версии кода тем же smoke-сценарием,
который на исправленной версии проходит полностью. Регрессий в смежных
warm-continuity/kiosk сценариях не найдено.
