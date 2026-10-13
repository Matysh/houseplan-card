# CODE-REVIEW-843-r1

Issue: #843 · Трек: ask · Этап: code · Заход: r1 · блокирующих циклов 0/4
Материал: `62014589cc7ef0a8374dfef9146ef95bc1bb0f29` (HEAD совпадает, `git rev-parse HEAD` сверен перед выводом)
Спецификация: ТЗ редакция 2 от 13.10.2026 (тело issue), SPEC-REVIEW-843-r1 — зелёный, High 0 / Medium 1 вне скоупа (→ #883).

## Скоуп

Фикс #803 (перенос узла стены / его Undo-Redo): история узла применяется вне
Select, выживает смену инструмента/режима/этажа и собственную ожидающую/летящую
запись настроек, курсор и этаж результата показываются только после ответа
сервера, отказы называют причину, из стека убирается только непригодная
команда. Контракт 1–6 и AC1–AC7 ТЗ. Правка существующего поведения v1.80.1 —
`stable-fix` (`docs/release-ledger/v1.80.1/843.json`), обоснование сверено с
кодом v1.80.1 (#803) и принято.

Затронутые файлы: `src/wall-node-history.ts` (новый), `src/geometry-history-state.ts`
(новый, общий тип `SpaceGeometryState` для карточки и рантайма — чистый рефакторинг
без изменения поведения), `src/wall-node-write.ts`, `src/wall-node-editor.ts`,
`src/wall-node-card-adapter.ts`, `src/houseplan-editor-runtime.ts`, `src/houseplan-card.ts`,
`src/command-stack.ts`, `src/config-adoption.ts`, `src/i18n/{ru,en,de,fr}.json`,
бэкенд-тесты, смок, мутанты, каноны.

J6 (SCOPE.md): «предсказуемое исправление плана и отмена» — прямое попадание.

## Как проверялось

Ревью кода без исполнения гейтов самим ревьюером (см. «Гейты» ниже) — углублённое
построчное чтение всего диффа (`git diff origin/dev...HEAD`, 28 файлов), сверка
каждого пункта контракта 1–6 ТЗ с реализацией, чтение тестов (unit-рантайм,
backend, смок) на предмет «тест умеет падать» и соответствия заявленным AC,
сверка трейлеров и changelog, сверка ratchets (bundleBytes, core-file-budget).

### Контракт → реализация (построчно)

1. **Право истории ≠ право переноса.** `wall-node-card-adapter.ts`: `context()`
   (`enabled: mode==='plan' && tool==='select' && writer()`) остаётся
   Select-only для захвата; отдельный `writer()`/`api()` без привязки к
   `tool`/`mode` используется в `history: direction => runNodeHistory({ enabled:
   () => ['plan','decor'].includes(host._mode) && writer(), ... })`. Подтверждено
   чтением и тестом `#843 node history: any Plan/Background tool…`.
2. **Смена инструмента/режима/этажа не гасит команду.** `_runNodeHistory`
   (`houseplan-editor-runtime.ts`) вызывается из `_undoGeometry`/`_redoGeometry`
   через `nodeHistoryNext`, независимо от текущих `_tool`/`_mode`/`_space`.
   Приоритет активного черновика: `if (this.host._path.length ||
   this.host._splitSel?.pts?.length) { this._clearGeometryGesture(); return; }`
   — первое нажатие гасит черновик (тест `#843 contract 2`).
3. **Своя очередь записи.** `settleOwnQueue` в `wall-node-write.ts` дожидается
   `_writeChain`/`_saveConfigDebounced` **до** вычисления `expected_rev`;
   `nodeBasisHolds` сверяет `adoptionEpoch` (растёт на любой identity-сдвиг,
   кроме `acceptConfigWrite` — подтверждено `config-adoption.test.mjs`) и
   fingerprint целевого этажа. Упавшая своя запись не пропускает команду:
   `failedQueues` WeakSet метит цепочку, следующая попытка сначала вызывает
   `deferred()` (пересылка живого конфига). `superseded-node-response`
   сохранена без изменений.
4. **Изменения целевого этажа.** Чужая adoption — старое правило
   `config-adoption.ts` (`onConfigReplace` → `_geometryHistory.clear()`), не
   тронуто; `wall-node-history.ts` лишь классифицирует отказ как `conflict` по
   `foreign = port.epoch() !== epoch`, не дублируя очистку. Своё изменение
   этажа вне истории → `stale-node-snapshot`/`node_move_*` коды →
   `nodeHistoryRefusal` относит к `outdated` → `stack.removeWhere(item => item
   === command)` удаляет только эту команду. Redo проверяется клиентом до
   отправки — backend-тест `test_843_apply_is_not_proved_and_lands_over_a_same_floor_change`
   прямо показывает отсутствие серверного доказательства для `apply`.
5. **Курсор после принятия.** `CommandStack.confirmUndo/confirmRedo` (новые
   методы, `peekUndo()===command` перед движением курсора — не вытесняют более
   новую команду, тест `command-stack.test.mjs`). `editor.busy` блокирует
   повторное нажатие и дизейблит кнопки (`?disabled=${!undoName ||
   this.nodeMove?.busy}` в обоих тулбарах — Plan и Background).
6. **Другой этаж.** `_showGeometrySpace` — вынесенный без изменения поведения
   общий путь (`_commitSpace`+`_saveNav`+`_restoreZoom`), используется и
   обычной историей, и `port.show` узловой; переключение — только после
   `port.write` разрешился. `canShow: id => this.host._canCommitSpace(id)`
   отказывает до отправки с `history.space_unavailable`.

### AC — доказательство и красный случай

| AC | Доказано | Чем краснеет |
|---|---|---|
| AC1 | `test/node-history-runtime.test.mjs` `#843 AC1 …` (5 вариантов: Draw, Resize, Plan→View→Plan, Plan→Background, другой этаж), смок `smoke_node_history_context.mjs` | `dev`: `applyHistory` вне Select → `_geometryHistory.clear()`, стек → 0 (прочитано и подтверждено тестом на реальном рантайме); мутант `node-history-requires-select` (возврат `select` в контекст) |
| AC2 | `test/wall-node-write.test.mjs` `#843 AC2/AC7 …` (ждёт/летит/оба Ctrl+Z), `#843 AC2(в)` (упавшая своя запись), `node-history-runtime.test.mjs` аналоги | `dev`: `expected_rev` до `flush()` → `stale-node-snapshot`; мутант `node-write-revision-before-own-queue` |
| AC3 | unit (`node-history-runtime.test.mjs` AC3×3) + backend `tests_backend/test_wall_node_move.py` (`test_843_undo_after_own_settings_or_other_floor_change_is_proved_and_keeps_it`, `test_843_any_change_of_the_target_floor_refuses_the_inverse`, `test_843_apply_is_not_proved_and_lands_over_a_same_floor_change` — явно показывает отсутствие серверного доказательства Redo) | мутант `node-redo-skips-floor-check` (убрать сверку этажа для `undo`-ветки, т.е. снять защиту именно там, где сервер не проверяет) |
| AC4 | `node-history-runtime.test.mjs` AC4×2 (транспорт, `api!==1`+холодный адаптер) | `dev`: курсор до ответа (`command-stack.ts:39-49` путь по ТЗ); мутант `node-history-clears-on-temporary-refusal` |
| AC5 | `node-history-runtime.test.mjs` AC5×2 (другой этаж, закреплённый этаж) | `dev`: применено невидимо; мутант `node-history-shows-floor-before-answer` |
| AC6 | `node-history-runtime.test.mjs` AC6 (View/kiosk/non-writer/Devices независимость), `wall-node-card-adapter.test.mjs` новый тест с матрицей mode/tool/patch | на `dev` уже зелёный (регрессия); мутант `node-history-without-writer-check` |
| AC7 | `wall-node-write.test.mjs` AC7, `wall-node-editor.test.mjs` `#843 AC7` (ревизия продвигается во время активного жеста) | `dev`: перенос после своей правки отклонён как небезопасный; мутант `node-gesture-retires-on-own-save` |

Все семь мутантов присутствуют в `scripts/mutation-registry.mjs`, у каждого
`because` называет AC и механизм; `find`-анкоры проверены построчным сличением
с текущим кодом (совпадают один раз в указанных файлах) — статическая часть
`mutation-gate --check`, по заявлению автора, прошла (0). Нет пустого столбца
«чем краснеет» ни у одного защитного AC.

### Прочие проверки

- **i18n**: 5 ключей (`history.unavailable/conflict/space_unavailable/
  node_outdated_undo/node_outdated_redo`) добавлены во все четыре словаря,
  RU/EN текст совпадает с ТЗ дословно; `toast.geometry_unsafe` оставлен только
  для настоящего отказа геометрии, не переиспользован для истории — как
  требовало ТЗ.
- **Монолит/бандл**: `houseplan-editor-runtime.ts` 12074 строки (потолок
  12030+50=12080, в полосе — подтверждено `wc -l`); `bundleBytes`
  2815621→2820780 (+5159, сверх полосы 2000) — зафиксировано отдельным
  коммитом `chore(monolith)` с разбором (i18n ×4 словаря + новый ленивый
  модуль), база поднята тем же коммитом — соответствует PROCESS §8.
- **Трейлеры**: все 7 коммитов несут `Issue: #843`; `User-Visible: yes` стоит
  ровно на `fix(editor)`-коммите, и оба `docs/CHANGELOG{,.ru}.md` правятся в
  этом же коммите (`git show --stat d816b452`).
- **Release-ledger**: `v1.80.1/843.json`, `stable-fix`, обоснование («applyHistory
  в Select-only, revision до flush(), clear() на отказе — всё из v1.80.1/#803»)
  проверено по факту: #803 действительно в v1.80.1, #843 не добавляет новый
  формат данных/WS API.
- **Рефакторинг типа** (`refactor(editor)`-коммит): чистое перемещение
  `SpaceGeometryState`/`nodeHistoryNext` в общий модуль, дублирование было
  дословным (сверено diff'ом) — не влияет на поведение, снижает связность
  монолита, соответствует давлению бюджета строк.
- **Одно число — один источник** (§8): новых отображаемых числовых величин
  (площадь/длина/т.п.) дифф не вводит; единственное «число, видимое дважды» —
  номер ревизии конфигурации, и он остаётся источником истины сервера
  (`host._cfgRev`/`response.rev`), клиент его не дублирует отдельной копией.
- **Контракт `_writeChain`/`superseded-node-response`**: не ослаблен, тест
  `late node response cannot replace a newer server adoption or unsaved local
  edit` сохранён и адаптирован под новую сигнатуру `basis`.

### Разобранный риск (не находка, see «Риски» автора)

В сценарии «сервер применил операцию, но ответ потерян» reload после отказа
(`_reloadRejectedPhysicalWrite` → `_reloadConfigOnly(true)`) при РАВНОМ
содержимом, но изменившейся ревизии (редкий гонки случай) поднимет
`adoptionEpoch` (тест `config-adoption.test.mjs`: «equal content with a foreign
revision» → epoch двигается), что `wall-node-history.ts` классифицирует как
`conflict` и покажет `history.conflict`, не удаляя команду из стека (удаление
только для `outdated`). Исход безопасен (геометрия не ломается, повторная
попытка строит свежий `basis` и обычно проходит), причина тоста в этом узком
случае неточна. Это тот же риск, что сам автор назвал в разделе «Риски»
отчёта («исход безопасный, причина названа неточно») — не новая находка,
дублировать её отдельной записью нет оснований.

## Находки

Нет. High: 0. Medium в скоупе: 0. Medium вне скоупа: 0 (единственная находка
вне скоупа по этой подсистеме уже заведена на этапе spec — #883 — и сюда не
относится).

## Что проверено и корректно

- Контракт 1–6 ТЗ построчно сверен с кодом — реализация соответствует.
- Все 7 AC доказаны тестами на реальном рантайме/реальном бэкенде (не моками
  поведения), защитные AC — мутантами или встроенными негативными случаями,
  столбец «чем краснеет» заполнен у каждого.
- i18n, changelog, release-ledger, трейлеры, ratchets — в порядке.
- Keyboard/toolbar пути (`houseplan-card.ts`, оба тулбара — Plan и Background)
  корректно блокируют кнопки во время запроса и гасят активный
  Draw/Split-черновик первым нажатием.
- Контракт `superseded-node-response`/`_writeChain` не ослаблен.

## Чего не проверял

- **Гейты не перегонял сам.** Push-Validate на точном SHA материала
  (`62014589`) зелёный: https://github.com/Matysh/houseplan-card/actions/runs/38455268773
  — это покрывает `typecheck`/`npm test`/`npm run build`+`bundle-policy
  --verify`/perf-смоки по правилу раздела «Объём гейтов» (ревьюер принимает
  зелёный Validate на SHA материала как подтверждение дешёвых гейтов). Сам
  `npx tsc --noEmit`, `npm test`, `npm run build` не запускал.
- **Мутанты не гонял** (и не должен — на `track:ask` в разработке мутанты не
  исполняются никем, ловлю обеспечивает ночной прогон, #709). Проверил только,
  что все 7 мутантов зарегистрированы, у каждого назван `because` и
  соответствующий AC, анкеры `find` существуют в текущем коде.
- **Backend pytest и смоки не запускал локально** — доверяю заявленным
  автором числам (`pytest` 34 passed, `smoke_node_history_context` 32
  вызовов `check` → по заявлению автора 48 отдельных проверок с учётом
  поэлементного сравнения массивов, `ruff` чисто) в связке с зелёным
  push-Validate на этом SHA, плюс собственное построчное чтение backend-теста
  (`tests_backend/test_wall_node_move.py`) — логика тестов и их связь с AC3
  прочитана и подтверждена напрямую, не только по отчёту автора.
- **`smoke_wall_node_connected` не прогонялся** — по заявлению автора,
  отказ среды (закреплённый Chromium 151 недоступен в песочнице ревью), что
  не является находкой этой задачи (окружение, а не продукт); не входил в
  перечень обязательных по AC смоков для #843 в любом случае.
- **Настоящий браузер + настоящий HA** — вне скоупа ревью кода, ТЗ прямо
  отмечает это как непроверенное технически ограничение, не блокирующее фикс.
- **golden:verify** — задача не меняет рендер плана, `ci:golden` не ставился и
  не требуется (§8).
- **model-invariants** — геометрический формат не менялся (контракт 6 ТЗ:
  «формат геометрии… не меняются»); правка — протокол истории/записи, не
  геометрическая модель, поэтому инварианты не прогонялись отдельно; смоки
  `smoke_wall_node_move`/`smoke_wall_node_topology`, по заявлению автора,
  остались зелёными на ребейзнутом бандле, что служит достаточным сигналом
  для этого диффа.

## Вердикт

Зелёный. Цикл не образуется (бюджет §4 не расходуется зелёным вердиктом).

Материал раунда: `62014589cc7ef0a8374dfef9146ef95bc1bb0f29`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/843-node-history-context`, коммит `62014589cc7e` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `3fbb3088d5e9925ed9ef5b73d23b2add053b15b7`
  ```
  git log --all --format='%H %T' | grep 3fbb3088d5e9
  ```
- Тело issue: `af0faa3c4455e1fc0f45e9500b6820fdc9f92ebea7fdfe6b1dc604de40c79b97`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ2ODksIm91dHB1dF90b2tlbnMiOjIxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0Nzk0fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo5OCwib3V0cHV0X3Rva2VucyI6MzQzNzUsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTc4MTcyLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NjM5NTE0OCwiY29zdFVzZEVzdGltYXRlIjoyLjMzNTY2MzU5OTk5OTk5OTN9XSwidHVybnMiOjU4LCJkdXJhdGlvbk1zIjo0MjUwNDUsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoyLjM0MDQ1NzU5OTk5OTk5OTIsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4787 output_tokens=34396 cache_creation_input_tokens=178172 cache_read_input_tokens=6395148 num_turns=58 -->
