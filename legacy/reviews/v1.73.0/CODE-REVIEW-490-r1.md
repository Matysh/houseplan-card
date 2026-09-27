# CODE-REVIEW-490-r1

- **Issue:** #490 — Атомарный recovery и live-состояние сводной панели
- **Этап:** code (PROCESS.md §2.7)
- **Заход:** r1 · блокирующих циклов израсходовано 0 из 4
- **SHA реализации:** `c6e6660d483c9297fc5fa86e9f9b5a7ad82a85a5` (ветка `issue/490-summary-recovery-live-state`)
- **ТЗ:** `docs/specs/490-summary-recovery-live-state.md`, ревью ТЗ зелёное на `95a34f73` (см. комментарий issue)
- **Диапазон:** `git diff origin/dev...HEAD` (57 файлов, 1179+/429-), из них продуктовый код:
  `src/summary-panel.ts`, `src/summary-panel-runtime-loaded.ts`, `src/summary-panel-host.ts`,
  `src/houseplan-card.ts` (2 строки), тесты `test/summary-panel.test.mjs`,
  `test/render-device-snapshot.test.mjs`, новый `demo/smoke_summary_panel.mjs` (recovery/live
  сценарии добавлены к существующему UI-смоку), `scripts/smoke-links.mjs`, changelog x2, dist/бандлы.

## Скоуп

Задача устраняет F1 (lost-ACK recovery устанавливал только `rev`, но старый `candidate`) и
F2 (entity-источники сводной панели не входили в render dependency set). Это единственная
задача в этом заходе; ТЗ уже прошло отдельное зелёное ревью, здесь оценивается реализация
против AC1–AC6.

## Как проверялось

Зелёного Validate на `c6e6660d` не нашёл (прогон не завершён/не найден), поэтому дешёвые гейты
прогнал сам:

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | green, без ошибок |
| `npm test` | green — 2276 pass, 0 fail, 1 skip (Node 22.23.2, Linux) |
| `npm run build` + сверка dist/custom_components/demo-srv | green — рабочее дерево после build/`node scripts/bundle-sync.mjs` осталось чистым (без diff к закоммиченным трём копиям бандла) |
| `node scripts/check-docs.mjs` | ERROR: «screenshot source fingerprint is stale ... (#479)» — это известный, помеченный самим инструментом долг #479 (отпечаток считается по всему `src/**`, любая фронтенд-правка делает его устаревшим); не регрессия этой задачи, отдельно не блокирую |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прогнал вывод, см. ниже |
| `node demo/smoke_summary_panel.mjs` | green (`OK`) — включает новые recovery/live сценарии |
| `node demo/smoke_render_invalidation.mjs` | green — прямое совпадение по `entityIds` |
| `node demo/smoke_device_position_history.mjs` | green — прямое совпадение по `_adoptStructuralResponses` |
| `node demo/smoke_danger_confirmation.mjs` | green — прямое совпадение по `_adoptStructuralResponses` |
| `npm run invariants` | не запускал — diff не трогает рёбра/толщину/`layout`/`marker.space`/`open_spans` |
| `python -m pytest tests_backend` | не запускал — `custom_components/**/*.py` не тронут (только фронтенд-бандл) |
| golden/performance полные наборы | не запускал — это предрелизный гейт (PROCESS.md §8), diff не меняет геометрию/стили/слои рендера, только текстовые значения существующего блока |

`smoke-select` дал 22 «прямых совпадения» и 58 «слабых связей» (общее имя `_maybeRebuildDevices`/`_model`/`_cfgRev` — решение ревьюера). Прогнал те прямые совпадения, что относятся к затронутым сиротным символам (`entityIds`, `_adoptStructuralResponses`); остальные прямые совпадения (`_cfgContentFingerprint`, `_restoreZoom`, `SpaceModel` и т.д.) относятся к путям, которые эта задача не меняла (сами функции идентичны на `origin/dev`, изменился только один новый вызывающий), и уже покрыты общим `npm test`/`tsc`.

Читал код (не исполнял отдельно) `_adoptStructuralResponses`, `_beginContinuityCandidate`,
`VisualContinuityController` (`src/visual-continuity.ts`), `ContentSigner.prepareImage/display`
(`src/signing.ts`), три существующих вызывающих места adoption-seam (`_loadFromServer`,
`_reloadConfigOnly`, `space-card.ts:718`) — чтобы сравнить их с новым, четвёртым, в
`summary-panel-runtime-loaded.ts`.

## Находки

### M1 — Recovery-адаптация обходит asset-readiness gate и continuity-overlay (в скоупе, Medium)

`src/summary-panel-runtime-loaded.ts:439-452` (метод `saveDialog()`, ветка lost-ACK):

```ts
const authoritative = await this.host._getAuthoritativeConfig();
const confirmed = confirmedSummaryPanelWriteRecovery(authoritative, draft);
if (!confirmed) throw writeError;
const visibleSpace = this.host._space;
this.host._adoptStructuralResponses(authoritative);
void this.host._syncDecorAssets(confirmed.config).catch(() => undefined);
this.host._adoptInitialSpace(this.host._model, true);
this.host._cacheSnapshot();
if (this.host._space !== visibleSpace) this.host._restoreZoom();
this.host._regSignature = '';
this.host._maybeRebuildDevices();
recovered = true;
```

Это четвёртый вызывающий `_adoptStructuralResponses` в кодовой базе. Три существующих
(`houseplan-card.ts:4286` `_loadFromServer`, `houseplan-card.ts:4467` `_reloadConfigOnly`,
`space-card.ts:718`) все делают одно и то же перед вызовом adoption-seam:

```ts
if (configChanged && !await this._signer.prepareImage(
  this.hass, this._candidateBackdrop(candidateConfig),
)) {
  this._continuity.note('asset-failed');
  this._scheduleLoadRetry(true);
  return; // старый _serverCfg остаётся на экране, пока фон не готов
}
```

`ContentSigner.prepareImage` — «Sign and decode a protected image before a structural
candidate adopts it. The current frame can therefore keep its old backdrop for the whole
wait» (`src/signing.ts:350-353`). Новый путь в `saveDialog()` этот шаг не делает и не
проверяет `configChanged` вовсе — `_adoptStructuralResponses` вызывается безусловно.
Он также не вызывает `_beginContinuityCandidate(...)` (recovery-overlay, #73/#451) и не
вызывает `_resumePendingNavMode()`, которые есть во всех трёх других местах.

**Почему это задевает именно эту задачу.** ТЗ §6.2 прямо требует: «Если authoritative
adoption обнаруживает новую структурную базу, сохраняются действующие правила сброса stale
history/drag/cache и continuity #73/#451. Recovery панели не получает собственного обходного
варианта этих правил.» История/drag/cache сброс действительно сохранён — он находится внутри
самого `_adoptStructuralResponses` (geometryHistory, devicePositionHistory, drag, camera —
проверил чтением, это общий код, использованный без изменений). Но asset-readiness gate и
recovery-overlay — тоже часть тех же continuity-правил (#73/#451, тот же файл
`visual-continuity.ts`, та же авторская формулировка «keep its old backdrop for the whole
wait») — и именно по ним recovery панели завела свой обходной вариант: единственный из
четырёх вызывающих, который не ждёт `prepareImage`.

**Сценарий отказа.** Клиент A открывает диалог сводной панели, сохраняет. Ответ на
`config/set` теряется по транспорту после того, как сервер его принял. Параллельно клиент B
успевает сохранить несвязанную структурную правку — например, заменить фоновое изображение
текущего пространства (`spaces[i].bg.href`) — именно такой параллельный несвязанный write
и есть предмет AC1/AC2. Recovery клиента A подтверждает lost-ACK (`confirmedSummaryPanelWriteRecovery`
проверяет только совпадение `summary_panel`, остальная часть документа — включая `bg.href` —
принимается «как есть») и вызывает `_adoptStructuralResponses(authoritative)` напрямую.
Новый `bg.href` ещё не подписан (`ContentSigner.signed` не содержит записи для нового пути) —
`_display()` для непобранного URL возвращает `''` («a signature we hold and still trust, else
nothing», `signing.ts:161-179`), поэтому фон плана на один кадр/до ближайшего подписания
пропадает (пустой src), вместо того чтобы держать старый фон, как это гарантируют три других
пути. Само подписание триггерится тем же вызовом `_display()` и самовосстанавливается на
следующем цикле — это не постоянная поломка, а видимый, но переходный дефект рендера именно
в момент, который ТЗ описывает как основной (recovery при параллельной структурной правке).

**Проверено чтением, не исполнением** — воспроизвести смоком дорого (нужен реальный
`ContentSigner`/подписанный URL в browser harness), а `demo/smoke_summary_panel.mjs` меняет
только `spaces[0].title` и `settings.concurrent_guard_490` — ни то, ни другое не задевает
`ContentSigner`, поэтому текущий смок этот путь не покрывает и не может его поймать.

**Серьёзность:** Medium, в скоупе задачи (сам предмет AC1/AC2 — атомарное принятие «всего»
документа при recovery, включая структурные поля вроде фона). Не блокирует (не High): не
ломает данные и не искажает `summary_panel`, эффект переходный и самовосстанавливающийся,
требует узкого стечения (lost ACK + именно в этом окне конкурентная правка фона). Чинится
добавлением `configChanged`-гейта на `prepareImage` (и, по аналогии с тремя другими местами,
`_beginContinuityCandidate`) перед вызовом `_adoptStructuralResponses` в этой ветке —
без выдумывания нового поведения, тем же способом, что и в трёх существующих вызывающих.

## Что проверено и корректно

- **AC1/AC2 (атомарность и следующая запись).** `confirmedSummaryPanelWriteRecovery`
  (`src/summary-panel.ts`) требует одновременно: полный `ServerConfig` (`Array.isArray(config.spaces)`),
  числовой неотрицательный safe-integer `rev`, точное совпадение сохранённой `summary_panel`
  с draft (`sameSummaryPanel`, JSON-эквивалентность). При выполнении — весь `authoritative`
  документ и `rev` уходят через общий `_adoptStructuralResponses`, а не собираются вручную —
  это закрывает риск «принят только rev или только config» из ТЗ §11. Подтверждено и unit-тестом
  (`test/summary-panel.test.mjs`, матрица из 7 отрицательных и 1 положительного случая) и
  browser-смоком `demo/smoke_summary_panel.mjs` (`recoveryAdoptsWholeConfig`,
  `recoveryAdoptsRevision`, `nextWriteUsesRecoveredRevision`,
  `nextWritePreservesConcurrentChange`) — прогнал сам, green. Тест умеет падать: ассерты
  сверяют конкретные строки (`'Concurrent title kept'`, `'kept'`) и конкретную revision-арифметику
  (`writes[0].expected_rev + 2`), а не факт отсутствия исключения.
- **AC3 (настоящий конфликт).** Ветка `catch { throw writeError; }` вокруг recovery-попытки —
  любой сбой самого чтения (`_getAuthoritativeConfig` бросает) или отказ `confirmedSummaryPanelWriteRecovery`
  (панель отличается / config или rev невалидны) откатывается к исходной ошибке записи, диалог
  не закрывается. Смок `trueConflictStaysOpen` (принудительный `rejectConflict = true` на каждой
  попытке) — green, и явно проверяет, что предыдущая («Second summary write») сохранённая версия
  осталась в `_serverCfg`, а не смешалась со stale candidate.
- **AC4/AC5 (live-источники и fast path).** `summaryPanelEntityIds()` — чистая функция, не
  читает `hass`, не мутирует конфиг, схлопывает дубликаты, режется по `runnableSummaryPanel`
  (только поддерживаемая v1), игнорирует локальную видимость/scope, что соответствует ТЗ §7.1
  дословно («число ограничено схемой» — до 200 значений по `SUMMARY_PANEL_SCHEMA`, что и
  проверяет unit-тест на hidden/other-scope/system/unsupported случаях). В
  `houseplan-card.ts:4623` результат добавлен в тот же `entityIds` render-snapshot набор, что и
  устройства/комнаты/декор — второго listener/timer не создано (проверено чтением всего файла
  на предмет других мест, где могла бы завестись отдельная подписка). Live-переходы value →
  unavailable → recovered → missing → present и счётчики рендера/geometry-инвариантность
  проверены смоком (`liveState` секция) — green, включая `unrelatedTickSkipped: true`,
  `relevantTickRenderedOnce: true`, `stateTicksKeepGeometry: true`.
- **Кеш-инвалидация снапшота.** `_capturedSnapshotSequence = -1` добавлен именно в момент
  ленивой загрузки `LoadedSummaryPanelRuntime` (`connectedCallback`, `houseplan-card.ts:2613`) —
  без него уже захваченный снапшот (`_hassSequence` не поменялся) не подхватил бы вновь
  появившиеся `entityIds()` до следующего изменения hass. В самом recovery-пути отдельный сброс
  не нужен: `_adoptStructuralResponses` переприсваивает `_serverCfg` новой ссылкой при
  structural-change, Lit-реактивность ловит это в `willUpdate` (`houseplan-card.ts:4084-4088`) и
  инкрементирует `_cfgEpoch`, что и инвалидирует кеш снапшота обычным путём — проверено чтением.
- **AC6 (совместимость).** Диф не трогает EN/RU/DE/FR словари, не добавляет новых сетевых
  запросов в steady state (единственный новый `config/get` — тот же самый вызов, что и раньше,
  просто с другим следствием), не меняет схему/API. `test/render-device-snapshot.test.mjs`
  подтверждает, что `_summary?.entityIds()` вошёл именно в существующую сборку снапшота, а не
  завёл параллельную.
- **Трейлеры и changelog.** `Issue: #490` на всех трёх коммитах, `User-Visible: yes` на
  коммите реализации `c6e6660d`, и `docs/CHANGELOG.md`+`docs/CHANGELOG.ru.md` правлены в этом
  же коммите (не отдельным) — соответствует требованию.
- **Единственный источник числа.** Значение summary-only сущности показывается только в одной
  строке сводной панели; диф не вводит второе место, где то же значение показывалось бы снова
  (никакой другой слой плана не подписан на источники, которых нет в общем `entityIds`) — не
  вижу дублирующего числа, которое требовало бы отдельного разбора по «одно число — один
  источник».

## Что не проверял

- Полный `golden:verify` — diff не меняет геометрию/раскладку/стили, только текстовые
  значения существующего блока и внутреннюю логику recovery; посчитал непропорциональным для
  этой правки.
- Windows-специфичные 3 падения `npm test`, о которых пишет автор (#479) — не переисполнял на
  Windows, полагаюсь на то, что Linux-прогон (канонический CI job) у меня самого дал 0 fail.
- `npm run invariants` — diff не трогает геометрию/рёбра/`layout`/`marker.space`/`open_spans`.
- `python -m pytest tests_backend` — `custom_components/**/*.py` не в diff (только
  сгенерированный фронтенд-бандл под `custom_components/houseplan/frontend/`).
- Полную матрицу `demo/smoke_*.mjs` (232 файла) — прогнал только прямые совпадения, относящиеся
  к реально изменённым символам (`entityIds`, `_adoptStructuralResponses`); остальные 20 «прямых»
  и все «слабые» совпадения относятся к функциям, чьи тела не менялись в этом diff (только один
  новый вызывающий), и уже покрыты `tsc`+`npm test`+`build`.
- Живое ручное тестирование в браузере HA — недоступно в этом цикле; вывод построен на
  автотестах и чтении кода.

## Вердикт

Жёлтый: единственная находка (M1) — Medium в скоупе задачи, чинится в этой же ветке без
отдельного issue (решение владельца 2026-08-19, #202). AC1–AC6 в остальном подтверждены
тестами, которые умеют падать, и чтением кода там, где смок не достаёт (сам M1).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/490-summary-recovery-live-state`, коммит `c6e6660d483c` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `fc7364e6d21b43b3f08c757a8ce0d5d5ac9b48c2`
  ```
  git log --all --format='%H %T' | grep fc7364e6d21b
  ```
- ТЗ `docs/specs/490-summary-recovery-live-state.md`, блоб `d4bfd4ea63f1b2ce1cb255b2764fe14d25661df7`
  ```
  git log --all --find-object=d4bfd4ea63f1b2ce1cb255b2764fe14d25661df7 -- docs/specs/490-summary-recovery-live-state.md
  ```
