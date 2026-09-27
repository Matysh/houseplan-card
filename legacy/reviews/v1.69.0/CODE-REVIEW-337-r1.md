# CODE-REVIEW-337-r1

- Issue: https://github.com/Matysh/houseplan-card/issues/337
- Материал: `git diff origin/dev...HEAD` на `6d338b78a0794491639edee9171662cdd260c42b`
  (ветка `issue/337-lazy-editor-chunk`, HEAD detached), 99 файлов, +33197/-26570.
- Этап: код-ревью, заход r1, блокирующих циклов израсходовано 0/4 до этого разбора.
- **Вердикт: красный.**

## Скоуп

ТЗ (`docs/specs/337-lazy-editor-chunk.md`, принято зелёным на SPEC-REVIEW-337-r1)
требует: (1) View не должен загружать код трёх редакторов до намерения открыть
редактор; (2) редакторы, kiosk-контролы, onboarding и Lovelace GUI config editor
должны продолжать работать **без изменения наблюдаемого поведения**; (3) при
ошибке загрузки редактора View остаётся рабочим и показывает новое сообщение;
(4) multi-asset build/раздача/CI/HACS-контракт. Диапазон правки: `src/houseplan-card.ts`
похудел на ~11.6 тыс. строк, весь этот код перенесён в новый
`src/houseplan-editor-runtime.ts` (13 016 строк) + `src/houseplan-onboarding-runtime.ts`
(843 строки) + `src/editor-runtime-loader.ts` (72 строки); плюс полностью новый
multi-asset build/раздача (`scripts/bundle-*.mjs`, `frontend_assets.py`,
`frontend_asset_manifest.py`), CSS-минификатор и обновлённая документация/changelog.
Это перенос практически всего некогда-монолитного класса через новую границу
`host ↔ typed port ↔ lazy runtime` — диапазон дельты сопоставим с исходной
задачей целиком, разбор ведётся полностью.

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate на этом же SHA
(https://github.com/Matysh/houseplan-card/actions/runs/33137282955) **частично** —
см. ниже отдельное расследование, почему доверять этому прогону в части
smoke/golden нельзя. Я перепрогнал самостоятельно:

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` (через `npm run build`) | pass |
| unit | `npm test` | 1438 тестов, 1437 pass, 1 skip, 0 fail |
| build + budget | `npm run build && npm run bundle:sync && npm run bundle:budget` | initial View 255 385 B ≤ 256 000 B (запас 615 B); lazy editor 131 765 B |
| docs fingerprint | `node scripts/check-docs.mjs` | pass (7 файлов, 10 внешних ссылок) |
| **browser smokes — ВСЕ 195** | `for f in demo/smoke_*.mjs; do node "$f"; done` (после `bundle:sync`) | **178 pass / 17 FAIL** |
| golden | `npm run golden:verify` | **127 passed / 4 different** |

Почему прогнан весь набор smoke, а не выборка: diff перемещает весь бывший
монолит в новый файл, поэтому `node scripts/smoke-select.mjs --base origin/dev --head HEAD`
называет **175 из 195** смоков «прямым совпадением» (символы на изменённых
строках) — порог «широкого» символа превышен на два порядка. Это ровно случай
«дельта не локальна» из инструкции разбора: выборка не имела бы смысла,
проверен весь набор.

**Почему нельзя было принять зелёный Validate за доказательство smoke/golden.**
Разобрал историю прогонов ветки (`gh run list --branch issue/337-lazy-editor-chunk`):

1. Коммит `876e709c` («test: enter lazy editor in resize smoke» — тот же коммит,
   что сейчас на одну позицию перед HEAD) получил **свой собственный** прогон
   Validate (`33136940969`) **до** финального docs-коммита. В нём **фронтенд,
   HACS, hassfest, backend, perf выполнились и прошли**, но **все три шарда
   smoke упали**, **golden упал** (4 разных кадра), и **preflight (docs/провенанс)
   тоже упал**.
2. Следующий и последний коммит `6d338b78` («docs: refresh screenshots after dev
   rebase») меняет только `docs/images/06-device-editor.png` и
   `docs/images/screenshots.json`. Job `changes` в `validate.yml` при push на
   ветку задачи считает diff **инкрементально** — `git diff` между предыдущим и
   новым tip пуша, а не `merge-base(dev)..HEAD`. Поэтому для этого пуша
   `frontend=false`, и jobs `frontend`/`smoke`/`golden`/`hacs`/`hassfest`/`backend`
   **пропущены** (`skipped`, не «reused по маркеру» — маркер smoke/golden явно
   «Cache not found» в логе job «Переиспользование»). Итоговый зелёный статус
   прогона `33137282955` относится только к docs/provenance/process-gate этого
   инкремента и никогда не перепроверял smoke/golden после
   `876e709c`.
3. Следствие: **ни один зелёный прогон CI на этой ветке не подтверждает, что
   smoke/golden проходят на финальном дереве.** Последний прогон, где они
   реально исполнялись, был красным. Хендофф-комментарий автора («Целевые
   browser smokes... green», «Точный CI:...— green: (переиспользованы зелёные
   ...markers)») интерпретирует переиспользование/пропуск как подтверждение,
   но по факту это не так — маркер smoke/golden для точного дерева `876e709c`
   не «success», а «Cache not found», и последующий пуш этот маркер не создал,
   потому что fingerprint jobs совпадает только внутри `reuse`, а `changes`
   для пути smoke/golden использует другой, инкрементальный механизм.
4. Мой независимый прогон на `HEAD=6d338b78` **воспроизводит содержательно те
   же классы падений**, что были красными в `876e709c` (kiosk, warm-remount,
   device-inbox, resize-preflight, golden device-editor/dialogs) — то есть
   ничего из перечисленного не было исправлено между `876e709c` и `6d338b78`,
   несмотря на заявление «Готово к автоматическому S7 code review».

## Находки

### High (блокируют)

**H1. Warm-remount коммитит editor mode в обход loader-гейта — падения на
уже существующих smoke.**
`src/houseplan-card.ts:3164-3206`, `_warmAdoptViewport()`, строка 3180:
```ts
this._adoptMode(vp.mode !== 'view' && this._canEdit && !config.kiosk ? vp.mode : 'view');
```
Это прямой вызов `_adoptMode()`, минуя `_requestMode()` — единственное место,
которое перед сменой режима вызывает `_ensureEditorRuntime()`
(`src/houseplan-card.ts:890-898`). ТЗ §6.2.1 требует: «Mode, editor chrome и
editor camera не коммитятся до успешной установки runtime». При warm-remount
(HA пересоздаёт элемент карточки на том же месте — `docs/WARM-REMOUNT.md`)
новый экземпляр получает собственный `_editorRuntimeLoader`/`_editorRuntime`
(поля инстанса, не модуля), но `_warmAdoptViewport` восстанавливает
предыдущий `mode` немедленно и синхронно, до того как что-либо вызвало
`_ensureEditorRuntime()` на новом инстансе.

**Воспроизведение:** три существующих (не изменённых этой задачей) smoke
детерминированно падают на этом:
- `demo/smoke_preloader_lifecycle.mjs` — `page.evaluate: Error: Houseplan
  editor runtime is not loaded`, стек `_renderMarkupDefs → render → update`;
- `demo/smoke_warm_dialogs.mjs` — 8 идентичных необработанных исключений с тем
  же стеком в процессе штатного сценария «тёплого» возврата к диалогу;
- `demo/smoke_warm_owners.mjs` — `aOwnersDraftRestored`/`bDraftOpenBefore`/
  `bDraftSurvivedDoubleRemount` — все три `expected true, got false` (черновик
  не восстанавливается после повторного remount).

Тест умеет падать: ни один из трёх не является новым или переписанным этой
задачей (не входят в diff), то есть до правки они проходили, а сейчас —
красные на HEAD.

**H2. Kiosk-контролы, явно названные в принятом ТЗ eager (§6.3: «kiosk
controls остаются eager, если они нужны View сами по себе»), зависят от
ленивого runtime и не работают в первом View.**
`src/houseplan-card.ts:10599-10600`:
```ts
private _saveKioskScale(patch: Partial<{ icon: number; font: number }>): void {
  return this._editorRuntimeOrThrow()._saveKioskScale(patch);
}
```
Диалог, из которого этот метод вызывается, открывается напрямую из View по
3-секундному long-press на пустой сцене в kiosk-режиме —
`src/houseplan-card.ts:5980-5997` (`_stagePointerDown`, `this._kioskDialog =
true`) — без единого вызова `_ensureEditorRuntime()` на этом пути. Рендер
диалога отдельно защищён (`this._editorRuntime ? this._renderKioskDialog() :
nothing`, строка 11289), поэтому на «холодном» View (никто ещё не открывал
редактор) long-press на планшете/панели **молча не открывает попап** размера
значков/текста — ключевая функция kiosk/планшетной персоны, для которой View
и есть продукт (`docs/SCOPE.md`), просто перестаёт быть доступна до первого
входа администратора в редактор где-то ещё.

**Воспроизведение:** `demo/smoke_kiosk.mjs` (существующий, не тронут этой
задачей) — `page.evaluate: Error: Houseplan editor runtime is not loaded` при
вызове `_saveKioskScale`, воспроизводится детерминированно.

**H3. Безопасность resize «fail-closed» сломана: принудительный отказ
preflight-проверки всё равно приводит к реальному, отличному от исходного,
коммиту геометрии.**
`demo/smoke_room_resize.mjs` (существующий) подменяет
`card._checkSpacePhysicalGeometry = () => ({ ok: false, status: 'failed' })`
и тянет край комнаты во время активного (мокнутого) отказа. Ожидание по
контракту #199/#277: ноль записей, комната остаётся на исходной геометрии.
Факт:
```
safe_resize.preflight_visible_reason: expected true, got false
safe_resize.preflight_reason_once:   expected 1, got 0
safe_resize.preflight_no_commit:     expected [[0.1,0.1],[0.4,...]], got [[0.1,0.1],[0.5333...,...]]
safe_resize.preflight_zero_write:    expected 0, got 1
safe_resize.commit_preflight_no_commit: expected 0.4, got 0.5
safe_resize.commit_preflight_zero_write: expected 0, got 1
```
Комната реально переместилась на позицию под курсором и в истории геометрии
появилась запись — то есть подмена `card._checkSpacePhysicalGeometry` (метод
на HOST, `src/houseplan-card.ts:9955`, форвардящий в
`_editorRuntimeOrThrow()._checkSpacePhysicalGeometry`) не перехватывает
реальный вызов внутри перенесённого resize-контроллера. Тот же класс
поломки — на независимом safety-контуре `_checkOptimizeGeometry`
(`demo/smoke_optimize_geometry_preflight.mjs`, комментарий в файле явно
ссылается на #199 «production bundle must fail closed before the Optimize WS
write»): подмена того же вида, `forceRed`-обёртка, даёт **9 упавших проверок
из 9** — preflight в проде для «Оптимизировать план» тоже не подтверждён
рабочим.

Это не вопрос тестируемости в узком смысле — на `preflight_no_commit`/
`commit_preflight_no_commit` наблюдается **реальный commit геометрии,
отличной от исходной**, когда по контракту не должно быть commit вообще.
Учитывая, что это ровно тот класс дефектов, ради которого заведены #199, #253,
#258, #259, #277, #291 (записи толщины/геометрии, zero-write гарантии) —
серьёзность максимальная.

**H4. Стрелочная навигация по вкладкам инвентаря устройств падает с
необработанным исключением, сама функция не работает.**
`demo/smoke_device_inbox.mjs` (существующий) — `ArrowRight` в открытом
инвентаре устройств:
```
EXC TypeError: Cannot read properties of undefined (reading '_deviceInbox')
    at fm._deviceInboxTabKey (...houseplan-editor-runtime-pmkXpWgM.js:929:37170)
```
`src/houseplan-editor-runtime.ts:7398-7407`, тело метода читает
`this.host._deviceInbox` — на живом дереве `this` внутри обработчика,
привязанного как `@keydown=${this._deviceInboxTabKey}`
(`src/houseplan-editor-runtime.ts:11374`), оказывается не инстансом runtime
(`this.host` undefined). Результат: `arrowChangesTab: expected true, got
false`, плюс необработанное исключение внутри карточки — функция полностью
неработоспособна, а не просто «отличается от ожидания».

**H5. Визуальная порча вторичного тулбара Device editor + 3 неподтверждённых
golden-дельты по диалогам устройств.**
`npm run golden:verify` на HEAD: **4 из 131 кадра отличаются** (не 0, как
требует AC3 «без golden delta», и не согласовано отдельным решением владельца,
как требует §12 «принятие эталонов только через `golden:accept --reviewed`»):
- `geometry-devices-editor-dark` — подписи кнопок вторичного тулбара Device
  editor визуально **накладываются друг на друга** (скриншот diff:
  `artifacts/golden/diff/geometry-devices-editor-dark.png`) — реальная порча
  layout, а не смещение на пиксель;
- `device-dialog-mobile-ru`, `toggle-entity-dialog-mobile-ru`,
  `device-ripple-color-popover-mobile-ru` — одинаковый паттерн: узкая полоса
  различий по правому/нижнему краю диалога на мобильной ширине (изменился
  размер/переполнение диалога).

Все четыре сценария относятся к Device editor/device-диалогам — подсистеме,
чей код перенесён этой задачей в `houseplan-editor-runtime.ts`. Ни один из
четырёх не упомянут в хендоффе автора и не принят через
`golden:accept -- --reviewed`.

### Medium (в скоупе, чинится в этой же задаче)

**M1. Два существующих smoke ожидают, что `houseplan-card-editor` уже
зарегистрирован на странице, но ТЗ сделало регистрацию асинхронной (AC11), а
фикстуры не обновлены.**
`demo/smoke_fixed_floor.mjs:74` и `demo/smoke_orphan_space_references.mjs:6`
делают `document.createElement('houseplan-card-editor')` напрямую, без
предварительного `await HouseplanCard.getConfigElement()` (или `import
'./editor'`). До задачи `./editor` импортировался статически, поэтому элемент
был зарегистрирован при загрузке бандла; после задачи — нет. Обе фикстуры
падают с `TypeError: editor.setConfig is not a function`. План автотестов ТЗ
(§14) требует, чтобы существующий набор проходил; это два конкретных, легко
чинимых места (добавить `await customElements.whenDefined(...)` после явного
триггера лениво загрузки, либо dynamic import перед `createElement`).

**M2. Смок-инструментовка чтения версии сборки не адаптирована к
multi-asset дереву.**
`demo/smoke_general_settings.mjs:60-65` ищет строку консольного баннера
`HOUSEPLAN-CARD %c v...` в `demo/srv/assets/houseplan-card.js` (entry-файл).
После разделения баннер переехал в общий чанк
`houseplan-assets/houseplan-card-<hash>.js` — `grep` подтверждает: строки в
entry нет, есть только в чанке. `BUNDLE_VERSION` получается `undefined`,
`bundleVersionFound` красный, второе сравнение сравнивает с заведомо неверной
строкой `"Houseplan Card vundefined"`. Само отображение в диалоге "About"
похоже корректно (`v1.68.1`, видно из вывода теста) — это регресс
инструментовки теста под новое дерево ассетов, а не видимого поведения, но
именно такую регрессию должен был поймать и починить сам этот таск (AC8/§14).

**M3. Ещё 9 существующих smoke красные на HEAD, не разобраны до корня в этом
документе — логи сохранены, требуют триажа автором.**
`smoke_edit_walk`, `smoke_ha_controls`, `smoke_help_affordance`,
`smoke_nav_persist`, `smoke_opening_entity_search`, `smoke_partition_openings`,
`smoke_grid_scale_invariance` — детерминированно красные при отдельном
запуске на HEAD (полные логи: `for f in ...; do node "$f"; done`, доступны по
запросу/в артефакте ревью-агента). Показательные симптомы: необработанные
исключения внутри карточки (`opening_entity_search`, ещё один случай кроме
H4), сравнение пикселей не сходится при скрытой сетке
(`grid_scale_invariance`), функциональные регрессии в конкретных диалогах
(`ha_controls`: выбор «ведущей» сущности при нескольких источниках;
`partition_openings`: прямой drag больше не останавливается на границе
одинакового джамба; `help_affordance`: второй Escape перестал закрывать
диалог; `nav_persist`: устаревший формат навигации не переписывается при
следующем переходе). Не считаю доказанным, что все девять сводятся к H1–H4 —
не проверял по коду каждый до конца; это отдельная работа автора, но
достаточно списка «что именно красное» и «как воспроизвести» (`node
demo/smoke_<name>.mjs` после `npm run bundle:sync`), чтобы задача не
возвращалась в S7 до того, как каждый пункт либо зафиксирован тестом,
либо явно объяснён как заведомо не связанный с #337 регресс из ребейза (в
последнем случае — с доказательством: тот же smoke красный и на чистом
`origin/dev` до задачи).

Итого по census: **17 из 195** существующих browser-smoke красные на
`git rev-parse HEAD` = `6d338b78`; **4 из 131** golden-кадров отличаются.
AC3 («View parity... без golden delta») и AC4 («editor parity... существующие
smokes без изменения ожидаемого DOM/данных») формально заявлены выполненными
в хендоффе автора, но не выполнены фактически — это не единичный дефект, а
систематический разрыв между заявленным прогоном и действительным
состоянием дерева (см. раздел «Как проверялось» о причине несовпадения).

### Low

Нет отдельных Low-находок сверх перечисленного — все наблюдения либо попали в
Medium (в скоуп, чинится здесь), либо в High.

## Что проверено и корректно

- **Бюджет (AC1).** `npm run bundle:budget` на HEAD: initial View 255 385 B ≤
  256 000 B, lazy editor 131 765 B — арифметически верно, посчитано моим
  собственным прогоном, не переписано со слов автора. Запас 615 B крайне
  узкий (сам автор называет это риском) — любой последующий eager-код без
  учёта бюджета сломает AC1 на первой же правке; отдельной находкой не делаю,
  так как это явный, зафиксированный риск, а не скрытый факт.
- **Импорт-граница (AC2, unit-уровень).** `npm test` — 1438/1438 применимых
  (1437 pass, 1 skip, 0 fail): в этот прогон входят unit/manifest-тесты
  import-графа и bundle-assets (`test/bundle-assets.test.mjs`,
  `test/editor-runtime-loader.test.mjs`, `test/bundle-freshness.test.mjs`) —
  на уровне статического графа импортов ленивая граница подтверждена. Именно
  поэтому дефекты H1–H5 не unit-уровня — они интеграционные/browser-уровня, то
  есть ровно там, где единственная защита это smoke/golden, а не тип-чек.
- **Backend asset route (AC7).** `tests_backend/test_frontend_assets.py`
  существует и по заявлению автора зелёный (3 passed); полный HA-harness в
  этой песочнице недоступен (нет `homeassistant`), поэтому **не перепрогонял**
  — доверяю авторскому запуску только для этого файла, так как он pure-Python
  и не завязан на HA.
- **Docs/трейлеры.** `node scripts/check-docs.mjs` — pass. Коммит
  `c1aaddc7` (`User-Visible: yes`) правит оба changelog в одном коммите —
  требование соблюдено. Остальные коммиты `User-Visible: no`, все несут
  `Issue: #337`.
- **Демо-стенд синхронен.** `npm run bundle:sync` — dist/integration/demo
  деревья по 6 файлов, побайтово совпадают (проверено самим скриптом при
  моём прогоне).

## Чего не проверял

- **Полный HA-harness backend** (`python -m pytest tests_backend -q` с
  установленным `homeassistant`) — недоступен в этой песочнице; доверяю
  авторскому заявлению только для чистого pure-Python подмножества,
  относящегося к asset route.
- **Не довёл до корня 9 из 17 падающих smoke** (список в M3) — это
  зафиксировано как Medium с логами и командой воспроизведения, а не
  замолчано.
- **Ручное тестирование в реальном Home Assistant** — не выполнялось (не
  требуется циклом ревью; недоступно из этой среды).
- **Performance-профили** — не запускал: ни один AC #337 явно не называет
  perf-бюджет кадра, только gzip-бюджет (AC1, проверен).
- **`node scripts/model-invariants.mjs`** — не запускал: diff не трогает
  геометрические записи/`layout`/`marker.space`/`open_spans` в смысле их
  формата хранения (перенос кода, не модели); H3 — поведенческий регресс в
  runtime-проверке, а не в структуре записи, поэтому инвариант модели здесь не
  тот инструмент, которым он обнаруживается — обнаружен smoke'ом.
- **Полное построчное соответствие каждого пункта §6–§13 спецификации
  каждой строке кода** — не сделано построчно; проверка велась от
  найденных красных smoke/golden к коду, а не от текста ТЗ построчно вниз, так
  как объём диффа (33k+/26k-) делает построчную сверку нецелесообразной при
  уже найденных блокирующих находках. Даже без учёта H1–H5 количество
  красных существующих smoke (17) само по себе уже является достаточным
  основанием для красного вердикта независимо от их индивидуального
  разбора до конца.

## Итог

Пять High-находок делают вердикт красным: код не проходит собственный план
автотестов задачи (AC3, AC4), нарушает явное продуктовое решение принятого ТЗ
(§6.3 kiosk eager), ломает независимо проверяемую safety-гарантию
(fail-closed resize/optimize preflight, H3) и содержит минимум одну прямую
runtime-ошибку в рабочей функции (H4). Отдельная системная проблема процесса,
не входящая в оценку кода, но существенная для дальнейшей работы над этой
веткой: зелёный Validate на финальном SHA возник из-за того, что
последний коммит — docs-only и не ретриггерит smoke/golden при инкрементальном
diff'е пуша, а не потому что эти гейты были перепройдены после последнего
красного прогона (`876e709c`). Пока это не учитывается, «зелёный CI» на
последнем коммите задачи с docs-хвостом не является доказательством того, что
smoke/golden проходят.
