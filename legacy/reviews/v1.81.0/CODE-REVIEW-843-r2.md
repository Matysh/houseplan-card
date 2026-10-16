# CODE-REVIEW-843-r2

Issue: #843 · Трек: ask · Этап: code · Заход: r2 · блокирующих циклов 0/4
Материал: `a8f71719bc7c92b5da13f7f9ef98bcc938ff2f11` (= `git rev-parse HEAD`, сверено)
Спецификация: ТЗ редакция 2 от 13.10.2026 (тело issue, без изменений с r1) ·
SPEC-REVIEW-843-r1 — зелёный, High 0 / Medium 1 вне скоупа (→ #883).

## Скоуп

Тот же фикс #803, что и в r1: применение истории переноса узла стены вне
Select, переживание смены инструмента/режима/этажа и своей ожидающей/летящей
записи настроек, курсор и этаж результата — только после ответа сервера,
честные отказы, удаление только непригодной команды. Контракт 1–6 и AC1–AC7
ТЗ. `stable-fix` относительно v1.80.1 (`docs/release-ledger/v1.80.1/843.json`).

**Почему r2, а не продолжение r1.** r1 (материал `62014589cc7e`) вынес зелёный
вердикт без находок. Зелёный вердикт цикла не образует и бюджет §4 не тратит —
отсюда «блокирующих циклов 0/4» и в этом заходе. После вердикта были добавлены
ровно два коммита, оба класса C (документация, `User-Visible: no`):
`e3f7d99a` — публикация самого документа `CODE-REVIEW-843-r1.md` в
`docs/reviews/`, `a8f71719` — обновление `docs/reviews/INDEX.md` под новый
документ. Продуктовый код (классы A/B) между материалом r1 и текущим HEAD не
менялся — проверено `git diff` между коммитами ветки: единственные изменённые
файлы в этих двух коммитах — `docs/reviews/CODE-REVIEW-843-r1.md` (новый, 211
строк) и `docs/reviews/INDEX.md` (+2/-1). SHA материала r1 (`62014589cc7e`) и
его дерево (`3fbb3088d5e9…`) в текущей истории не резолвятся — согласно
`PROCESS.md` §2.10 это обычное дело после сдвига каталога/ребейза, а не
находка; материал этого раунда найден по номеру issue и содержимому ветки, а
не по мёртвому SHA.

Затронутые продуктовые файлы (не изменились с r1): `src/wall-node-history.ts`,
`src/geometry-history-state.ts`, `src/wall-node-write.ts`,
`src/wall-node-editor.ts`, `src/wall-node-card-adapter.ts`,
`src/houseplan-editor-runtime.ts`, `src/houseplan-card.ts`,
`src/command-stack.ts`, `src/config-adoption.ts`, `src/i18n/{ru,en,de,fr}.json`,
бэкенд-тесты, смок, мутанты, каноны.

J6 (SCOPE.md): «предсказуемое исправление плана и отмена» — прямое попадание.

### Риск по изменённым участкам (#707) — каждый класс сверен с AC

- **geometry** (`houseplan-editor-runtime.ts`, `wall-node-card-adapter.ts`,
  `wall-node-editor.ts`, `command-stack.ts`): контракт 1–2, 5–6 и AC1, AC4–AC7.
  Токен `_junctionLimitsIntroduced` на runtime.ts:928/944 — не логическое
  изменение: тот же `introduced:`-колбэк, переехавший внутрь выделенного
  метода `_loadNodeMove()` вместе с добавленными `canShow`/`show` (контракт 6);
  сверено построчно — вызов и аргументы идентичны строке, существовавшей на
  `dev`.
- **migration** (`config-adoption.ts` — `adoptionEpoch`): контракт 3–4, AC2–AC3.
  Это не миграция формата данных (ТЗ §«Модель данных»: «формат геометрии, WS
  API… не меняются»), а новый счётчик идентичности конфига в памяти; строки
  97, 145–147, 215 сверены построчно (см. «Контракт → реализация» ниже) —
  `acceptConfigWrite` (наша прямая запись) эпоху не двигает, все прочие пути
  identity-смены — двигают.
- **ux** (i18n, 20 строк в 4 словарях): контракт 5–6, раздел «i18n» и «UX» ТЗ.
  5 ключей × 4 словаря, тексты RU/EN совпадают с таблицей ТЗ дословно (сверено
  построчно), DE/FR — по смыслу; `test/i18n.test.mjs`/`i18n-dead-keys` держат
  набор одинаковым.

Все три класса закрыты пунктами контракта и AC — `route: fix`, понижать трек
или просить reclassify нет оснований.

## Как проверялось

Независимое построчное чтение продуктового диффа (`git diff
origin/dev...HEAD`, 30 файлов) без доверия одним только выводам r1: сверка
контракта 1–6 с кодом, чтение тестов (unit-рантайм, backend pytest, native
smoke) на предмет «тест умеет падать», сверка всех 7 анкеров мутаций прямым
`grep -c` на уникальность в целевом файле, сверка трейлеров/changelog/ledger,
сверка индекса ревью.

### Контракт → реализация (сверено лично, не только по r1)

1. **Право истории ≠ право переноса.** `wall-node-card-adapter.ts:56–64`:
   `writer()` (`_canEdit && !_kiosk && isConnected`) используется в `history:`
   (строка 141–145, `enabled: () => ['plan','decor'].includes(host._mode) &&
   writer()`) без привязки к `tool`; `context()` (строка 58–64) остаётся
   Select-only (`_mode==='plan' && _tool==='select'`) для захвата/ручек.
   Разделение подтверждено чтением и `#843 node history`-тестами в
   `wall-node-card-adapter.test.mjs`.
2. **Смена инструмента/режима/этажа/редактора не гасит команду.**
   `_runNodeHistory` (`houseplan-editor-runtime.ts:2177-2184`) вызывается из
   `_undoGeometry`/`_redoGeometry` через `nodeHistoryNext(...)`, независимо от
   `_tool`/`_mode`/`_space`. Приоритет черновика — первые две строки
   `_runNodeHistory`: `if (this.host._path.length ||
   this.host._splitSel?.pts?.length) { this._clearGeometryGesture(); return; }`
   — подтверждено тестом «#843 contract 2».
3. **Своя очередь записи.** `settleOwnQueue` (`wall-node-write.ts`) ждёт
   `_writeChain`/flush **до** чтения `host._cfgRev` в `work = …then(async () =>
   {... const revision = host._cfgRev …})` — т.е. ревизия берётся после
   собственной очереди, не до. `nodeBasisHolds`/`nodeAdoptionEpoch` сверяют
   `adoptionEpoch` и `nodeFloorFingerprint` цели. `failedQueues` WeakSet не даёт
   упавшей записи пропустить команду вперёд — следующий `writeWallNode` сам
   вызывает `deferred()` первым делом. `superseded-node-response` не тронута
   (строка сравнения `current !== identity && current !== JSON.stringify(response.config)`
   сохранена).
4. **Изменения целевого этажа.** `config-adoption.ts:145-147` —
   `adoptionEpoch++` на любом `configChanged || nextRev !== this.configRev` в
   `adoptResponses` (чужая authoritative-adoption); `acceptConfigWrite` (свой
   `config/set`, строки 198-201) эпоху **не** двигает — это единственное
   исключение, как и требует контракт 3. `acceptPairWrite` (215),
   `seedIdentity` (238, только при смене `configRev`/`configFingerprint`) и
   `restoreCached` (285) эпоху двигают — все три меняют содержимое/версию не
   через очередь узловой записи, значит корректно трактуются как «чужой»
   идентити-сдвиг для контракта. Своя правка этажа вне истории (диалог/
   переименование) превращает запрос в `stale-node-snapshot` →
   `nodeHistoryRefusal` классифицирует как `outdated` →
   `stack.removeWhere(item => item === command)` — удаляется только эта
   команда (`wall-node-history.ts:62`). Backend-тест
   `test_843_apply_is_not_proved_and_lands_over_a_same_floor_change`
   действительно демонстрирует, что сервер не ловит Redo поверх изменения
   того же этажа (прочитано: `redone["spaces"][0]["partitions"][1]["a"] ==
   [0, -1]` — перенос всё же применился поверх чужого изменения, без клиентской
   проверки повредил бы геометрию) — это и есть обоснование клиентской сверки
   в `nodeBasisHolds`.
5. **Курсор после принятия.** `CommandStack.confirmUndo/confirmRedo`
   (`command-stack.ts`) делают `peekUndo() === command && this.undo() ===
   command` — курсор не двигается, если на вершине уже другая (более новая)
   команда. Кнопки обоих тулбаров (`decor`-панель строка ~5238/5242,
   markup-панель ~11241/11246) получили `|| this.nodeMove?.busy` в `?disabled`.
6. **Другой этаж.** `_showGeometrySpace` — выделенный без изменения поведения
   общий путь (`_clearGeometryGesture` + `_commitSpace`/`_saveNav`/
   `_restoreZoom`, только если `_space !== spaceId`), используется и обычной
   историей (`_applyGeometryState`), и `port.show` из `wall-node-history.ts`.
   `canShow: id => this.host._canCommitSpace(id)` — отказ до отправки,
   `history.space_unavailable`.

### AC — доказательство и красный случай (перепроверено самостоятельно)

| AC | Доказано | Чем краснеет | Моя проверка |
|---|---|---|---|
| AC1 | `node-history-runtime.test.mjs` `#843 AC1 …` (5 вариантов) + `smoke_node_history_context.mjs` (реальные тулбар/клавиши/pointer-перенос, `AC1 Draw/Resize/Plan→View→Plan/Background`) | мутант `node-history-requires-select` | Анкер `enabled: () => […] && writer(), api,` встречается в файле 1 раз (`grep -c`), патч превращает его обратно в Select-only — соответствует механизму AC1 |
| AC2 | `wall-node-write.test.mjs` `#843 AC2/AC7…`, `node-history-runtime.test.mjs` аналоги | мутант `node-write-revision-before-own-queue` | Анкеры (`await settleOwnQueue(host);` и `expected_rev: revision, intent: history.intent,`) по 1 разу каждый; патч берёт `host._cfgRev` ДО `settleOwnQueue` — ровно дефект H2 из ТЗ |
| AC3 | unit ×3 + backend `test_wall_node_move.py` (`test_843_undo_after_own_settings_or_other_floor_change_is_proved_and_keeps_it`, `test_843_any_change_of_the_target_floor_refuses_the_inverse`, `test_843_apply_is_not_proved_and_lands_over_a_same_floor_change`) | мутант `node-redo-skips-floor-check` (снимает сверку только для не-`undo`, т.е. для Redo — там, где сервер не доказывает) | Прочитан backend-тест целиком: третий параметризованный тест прямым текстом показывает, что сервер принимает Redo поверх чужого изменения того же этажа без ошибки — клиентская проверка обязательна, mutant её выключает только там |
| AC4 | unit ×2 (транспорт, `api!==1`+холодный адаптер) + смок `AC4 in flight` (курсор/кнопки не двигаются, пока запрос летит) | мутант `node-history-clears-on-temporary-refusal` | Анкер `if (refusal === 'outdated') stack.removeWhere(…)` — 1 раз; патч заменяет условие на безусловный `removeWhere(() => true)` — прямое воспроизведение H5/потери истории на временном отказе |
| AC5 | unit ×2 + смок `AC5` (переключение этажа после ответа, `_canCommitSpace` ложно) | мутант `node-history-shows-floor-before-answer` | Анкер `let config: ServerConfig;` — 1 раз; патч вставляет `port.show(space)` перед ожиданием ответа — воспроизводит H3 (невидимое применение на другом этаже) |
| AC6 | регрессия на `dev`, unit + smoke матрица mode/tool/patch | мутант `node-history-without-writer-check` | Анкер `const writer = () => host._canEdit && !host._kiosk && host.isConnected;` — 1 раз; патч убирает `_canEdit` |
| AC7 | `wall-node-write.test.mjs`, `wall-node-editor.test.mjs` | мутант `node-gesture-retires-on-own-save` | Анкер в `wall-node-editor.ts` (`current(s)`) — 1 раз; патч убирает исключение `s.basis && this.port.holds?.(s.basis)` — воспроизводит H2-перенос (жест гасится своей же принятой правкой) |

Все семь анкеров `find` проверены лично `grep -c` на точное единичное
вхождение в указанном файле — ни один не расплывчатый и не ложится «куда
попало». Пустых столбцов «чем краснеет» нет.

### Прочие проверки

- **i18n**: `history.unavailable/conflict/space_unavailable/
  node_outdated_undo/node_outdated_redo` — во всех четырёх словарях, RU/EN
  текст дословно совпадает с таблицей ТЗ (сверено построчно diff'ом выше).
  `toast.geometry_unsafe` не переиспользован для истории.
- **Трейлеры**: все 7 продуктовых коммитов несут `Issue: #843`; `User-Visible:
  yes` — только на `f26017d2` (`fix(editor): node history outside Select,
  after the own write queue`), и этот же коммит правит оба
  `docs/CHANGELOG{,.ru}.md` (сверено `git show --stat`). Два новых docs-коммита
  этого раунда несут `User-Visible: no` и ничего не должны были менять в
  changelog — не меняют.
- **Release-ledger**: `docs/release-ledger/v1.80.1/843.json` —
  `category: "stable-fix"`, обоснование ссылается на реальное поведение
  v1.80.1/#803 (`applyHistory` в Select-only, ревизия до `flush()`, `clear()`
  на отказе) — проверено: это действительно баги, а не новая функция; формат
  данных/WS API дифф не меняет.
- **Канон**: `docs/ARCHITECTURE.md` и `docs/UX-MODES.md` правки прочитаны
  целиком — описывают именно реализованный механизм (own-queue, adoptionEpoch,
  confirmUndo/confirmRedo, `_showGeometrySpace`), без расхождений с кодом.
- **Одно число — один источник** (§8): новых отображаемых величин дифф не
  вводит; ревизия конфигурации остаётся источником истины сервера, клиент не
  дублирует отдельную копию (`host._cfgRev`/`response.rev`).
- **Монолит/бандл**: `chore(monolith)` (`4bc85adb`) и `refactor(editor)`
  (`4f13097b`) коммиты — оба уже были в материале r1 и не менялись в этом
  раунде; `4f13097b` — чистое перемещение типа `SpaceGeometryState` в
  `geometry-history-state.ts`, сверено diff'ом: убраны только два неиспользуемых
  импорта (`OpenSpanEntry`, `MarkerRoomReferenceSnapshot`), логика
  `_applyGeometryState`/`_showGeometrySpace`/`_runNodeHistory` идентична тому,
  что разобрано в пункте «Контракт → реализация» выше — рефакторинг не вносит
  расхождения с контрактом.
- **`docs/reviews/INDEX.md`**: число документов обновлено 48→49, фактически в
  `docs/reviews/*.md` (без `INDEX.md`) — 49 файлов (`ls | wc -l` проверено);
  новая строка `#843 | CODE-REVIEW-843-r1.md | code · r1 | 🟢 | 0 | 0` совпадает
  с содержанием самого документа. Запись этого раунда (r2) индекс пока не
  содержит — её добавит публикующий шаг после вердикта, как и в r1.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| — (находок не было: High 0, Medium в скоупе 0, Medium вне скоупа 0) | закрывать нечего | `docs/reviews/CODE-REVIEW-843-r1.md`, раздел «Находки»: «Нет. High: 0. Medium в скоупе: 0. Medium вне скоупа: 0» |

Единственный «разобранный риск» r1 (reload после отказа с равным содержимым,
но изменившейся ревизией → `adoptionEpoch` двигается → `history.conflict`
вместо точной причины, исход безопасен) — тот же риск, что сам автор назвал в
ТЗ/отчёте; код, к которому он относится (`config-adoption.ts`
`restoreCached`/`adoptResponses`), в этом раунде не менялся — риск
унаследован без изменений, новым обстоятельством не выглядит.

## Унаследовано из r1

С материала r1 (SHA `62014589cc7e`, не резолвится сейчас — ожидаемо после
сдвига каталога ревью, см. «Скоуп» выше) до текущего HEAD (`a8f71719`)
продуктовый код (классы A/B) не менялся — изменились только два docs-коммита.
Поэтому без повторного исполнения принято:

- Заявленные числа прогонов автора: `pytest` backend (34 passed), native smoke
  `smoke_node_history_context` (создан на уровне контракта и AC1/AC4/AC5,
  структуру и ассерты проверил лично чтением файла в этом раунде — см. «Как
  проверялось»), `ruff` чисто — сами команды не перезапускал.
- Зелёный push-Validate на точном SHA материала **этого** раунда
  (`a8f71719`, run `38459150568`, указан в постановке задачи) принимается как
  подтверждение `typecheck`/`npm test`/`npm run build`+`bundle-policy
  --verify` — независимое от r1 подтверждение на актуальном SHA, не
  унаследованное с прошлого раунда.
- Политика мутаций: на `track:ask` в разработке мутанты не исполняются никем
  (#709) — не стал исполнять и я; вместо этого лично проверил анкеры (см.
  таблицу AC выше) — это строже, чем просто сослаться на r1.
- `smoke_wall_node_connected` не прогонялся в r1 (отказ среды — Chromium вне
  песочницы) и не является частью обязательных по AC смоков для #843; тот же
  статус действителен и сейчас, окружение ревью не изменилось.

## Находки

Нет. High: 0. Medium в скоупе: 0. Medium вне скоупа: 0 (находка, уже заведённая
на этапе spec как #883, к этой подсистеме кода не относится и здесь не
повторяется).

## Что проверено и корректно

- Делта с r1 (два docs-коммита: публикация `CODE-REVIEW-843-r1.md` и
  обновление `docs/reviews/INDEX.md`) не затрагивает продуктовый код —
  проверено построчно по diff'ам этих двух коммитов.
- Контракт 1–6 ТЗ сверен с кодом самостоятельно (не только по тексту r1):
  Select-only захват отделён от Plan/Background-widе Undo/Redo, приоритет
  черновика, own-queue перед вычислением ревизии, `adoptionEpoch` как
  единственный легальный механизм продвижения ревизии через свою очередь,
  `confirmUndo/confirmRedo`, `_showGeometrySpace` как общий путь перехода.
- Все 7 AC проверены по паре «тест/смок + анкер мутанта», каждый анкер лично
  подтверждён уникальным вхождением в целевой файл.
- i18n (4 словаря × 5 ключей), трейлеры, changelog (оба языка в
  `User-Visible: yes`-коммите), release-ledger (`stable-fix`, обоснование
  соответствует факту), канон (ARCHITECTURE.md, UX-MODES.md) — в порядке.
- Backend-тест AC3 прочитан целиком: параметризованный
  `test_843_apply_is_not_proved_and_lands_over_a_same_floor_change`
  действительно демонстрирует отсутствие серверного доказательства Redo —
  негативный случай настоящий, не вакуумный.
- Рефакторинг `geometry-history-state.ts` (входит в материал, не менялся в
  этом раунде) — чистое перемещение типа, поведение идентично.

## Чего не проверял

- **Гейты не перегонял сам.** Зелёный Validate на точном SHA материала
  (`a8f71719`): https://github.com/Matysh/houseplan-card/actions/runs/38459150568
  покрывает `typecheck`/`npm test`/`npm run build`+`bundle-policy --verify` по
  правилу раздела «Объём гейтов» (PROCESS.md §8). Сам `npx tsc --noEmit`,
  `npm test`, `npm run build` не запускал.
- **Мутанты не гонял** и не должен — track:ask в разработке их не исполняет
  никто, ловлю обеспечивает ночной прогон (#709). Проверил только регистрацию
  всех 7 мутантов и уникальность их `find`-анкеров в текущем коде (лично, не
  по заявлению автора).
- **Backend pytest и native-смоки не запускал.** Доверяю заявленным в r1
  числам в связке с зелёным push-Validate; backend-тест (3 новых
  параметризованных теста для AC3) и смок `smoke_node_history_context.mjs`
  прочитаны целиком и напрямую — их логика, ассерты и связь с AC проверены
  построчным чтением, а не только по отчёту.
- **`smoke_wall_node_connected`** — не прогонялся ни в r1, ни сейчас (отказ
  среды, не входит в обязательные по AC смоки #843).
- **Настоящий браузер + настоящий HA** — вне скоупа ревью кода; ТЗ отмечает это
  как технически непроверенное ограничение, не блокирующее фикс.
- **golden:verify** — задача не меняет рендер плана, `ci:golden` не ставился и
  не требуется.
- **model-invariants** — формат геометрии не менялся (контракт 6: «формат
  геометрии, WS API… не меняются»); правка — протокол истории/очереди записи,
  не геометрическая модель.
- **Полный повторный просмотр делты r1→r2 построчно вручную для docs-файлов**
  не требовался отдельным гейтом — оба docs-коммита проверены `git show
  --stat`/прочтением diff'ов полностью (воспроизведено выше в «Скоуп»), это и
  есть доказательство, не пропуск.

## Вердикт

Зелёный. Цикл не образуется (бюджет §4 не расходуется зелёным вердиктом).

Материал раунда: `a8f71719bc7c92b5da13f7f9ef98bcc938ff2f11`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/843-node-history-context`, коммит `a8f71719bc7c` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `ee3d500961ca1a023b679e14f001fc58528e3e24`
  ```
  git log --all --format='%H %T' | grep ee3d500961ca
  ```
- Тело issue: `af0faa3c4455e1fc0f45e9500b6820fdc9f92ebea7fdfe6b1dc604de40c79b97`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ2OTUsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0Nzg1fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo1Miwib3V0cHV0X3Rva2VucyI6Mjg2ODAsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTE5OTA0LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MjM1NjM4NCwiY29zdFVzZEVzdGltYXRlIjoxLjIzNzc5Njc5OTk5OTk5OTd9XSwidHVybnMiOjQxLCJkdXJhdGlvbk1zIjozMzI0MjEsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjI0MjU4MTc5OTk5OTk5OTcsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4747 output_tokens=28698 cache_creation_input_tokens=119904 cache_read_input_tokens=2356384 num_turns=41 -->
