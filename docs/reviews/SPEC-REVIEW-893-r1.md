# SPEC-REVIEW-893-r1

Issue: #893 «Редакторы: направляющие только к видимым опорам и безопасная
отмена перетаскивания при уходе со страницы»
Этап: spec (ревью ТЗ, PROCESS.md §2.4) · Трек: ask · Заход: r1 · блокирующих
циклов израсходовано 0 из 4.
Материал: тело issue #893, зафиксированное на dev `ef1aeaf6cf94f2f692654e975a4ee18c40b143a7`
(v1.81.0-beta.2). `bodyDigest` пакета: `e67873c221aba2a1ced13357846b196ecc90576f16fcad31813a1ea923ae1f00`.
Реализация не начата.

## Скоуп

`houseplan-editor-runtime` `_alignCandidates`/`_renderAlignGuides`, device
drag lifecycle в `houseplan-card.ts` (pagehide/visibility/disconnect/смена
editor или space), device-spacing/filter projection для общего eligibility,
`docs/CANVAS.md` §9.3, unit/native смоки. Явно вне скоупа: сохранённые
координаты, radii/priorities #873/#885, правила room-label, геометрия стен,
скрытые слои, форма/магниты группировки #866.

Служит J6 (`docs/SCOPE.md`): «drag/resize… multi-client live sync,
optimistic locking» — задача чинит достоверность направляющих и безопасность
жеста при уходе со страницы внутри уже закрытой работы, новых поверхностей
не добавляет.

## Как проверялось

Ревью на этапе spec: зависимостей/Chromium не ставил (#696), код не
исполнял. Читал тело issue, `docs/SCOPE.md`, `AGENTS.md`,
`docs/process/REVIEWER.md`, `PROCESS.md` §2.4/§2.5/§7.1/§7.2, `docs/CANVAS.md`
§9.3, `docs/TOUCH-SUPPORT.md` (safety floor). Каждое утверждение раздела
«Проблема» сверил чтением текущего кода на материале (не исполнением), и
отдельно — историей git относительно `v1.80.1`, чтобы проверить авторскую
классификацию release-артефактов. Дубликаты сверил живыми статусами issues
через `gh issue view`.

Проверка претензий ТЗ к текущему коду (все — чтением, не исполнением):

- **Device eligibility.** `_alignCandidates()` в devices-ветке
  (`src/houseplan-editor-runtime.ts:10437-10454`) исключает только
  `d.space !== this.host._space` и `bindingStatus?.kind === 'ha_disabled'`;
  предиката видимости (hidden/tombstone/активная LED-замена) там нет —
  заявление ТЗ подтверждено.
- **Walls candidates.** Та же функция, ветка `this.host._markup`
  (строки 10416-10436) всегда отдаёт только вершины room polygon (+ точки
  path/split у соответствующих инструментов); для инструмента `wallthick`
  никакого дополнительного источника кандидатов нет — то есть магнит #885 у
  независимого конца стены (`docs/CANVAS.md` §9.3, строки 582-590) уже
  работает, а направляющей линии к этой же точке неоткуда взяться.
  Заявление ТЗ подтверждено.
- **pagehide.** Device-drag жизненный цикл
  (`src/houseplan-card.ts:6948-7084`, `_pointerDown/_pointerMove/_pointerUp/
  _pointerCancel`) не подписан ни на `pagehide`, ни на `visibilitychange`.
  Для сравнения, NODE-MOVE жест (#803) уже это делает:
  `src/wall-node-editor.ts:74-76,281,285` — `pagehide` → `cancel()` + dispose
  слушателя. Асимметрия, которую описывает ТЗ, реальна, и в кодовой базе уже
  есть образец реализации для переноса на device drag.
- **CANVAS §9.3 устарел.** Таблица (строка 503) всё ещё пишет
  `device markers | _savePos`. По факту `_savePos`
  (`src/houseplan-card.ts:5389`) сейчас вызывается из редактора только для
  room-label (`houseplan-editor-runtime.ts:10323`, синтетический `DevItem`);
  сам device-drag коммитит через `_devicePlacementForCanvas` +
  `_persistDevicePlacement` (`houseplan-card.ts:5257`, `:5293`, вызов на
  `:7057`), минуя `_savePos` целиком. Документ правда разошёлся с кодом —
  AC5 нацелен верно.
- **Touch safety floor.** `docs/TOUCH-SUPPORT.md` «Safety floor that still
  applies to touch editors» (строки 148-168) явно требует: никакого
  «сохранения непреднамеренной геометрии только потому, что pinch/pointer
  cancellation/второй палец были приняты за клик» — то есть обязательность
  cancellation/multitouch safety в AC3 на touch-редакторах не новое
  требование, а применение уже принятого инварианта, а не изобретённое
  ТЗ продуктовое решение.
- **Дубликаты.** `gh issue view`: #873 и #885 — `CLOSED` (их коммиты —
  `300756a8`/`659a7477` и соседние — датированы после тега `v1.80.1`, в
  бете 1.81.0); #861 и #866 — `OPEN`, и ТЗ прямо исключает их объём
  («не входят в Э1» / «не реализовать форму/магниты группировки #866»).
  Соответствие заявленному в ТЗ подтверждено.
- **Release-классификация.** `docs/STATUS.md`: предыдущий stable `v1.80.1`,
  текущий `1.81.0-beta.2` — совпадает с `material.sha` пакета. Проверка
  `git show v1.80.1:src/houseplan-editor-runtime.ts` подтверждает, что
  devices-eligibility ветка `_alignCandidates` в том же виде (без visibility
  predicate) уже существовала в `v1.80.1` → «stable-fix относительно
  v1.80.1» для eligibility/lifecycle обоснован. Коммиты #885
  (`659a7477` и далее) не входят ни в один тег `v1.80.*` → «line-fix
  introducedBy #885» для недостающей guide у Walls обоснован.

## Проверка обязательных разделов (§7.1)

Присутствуют все: сценарий · что человек увидит до/после · проблема · скоуп
и не-скоуп · контракт поведения (AC1…AC5 пронумерованы) · UX и доступность ·
модель данных и миграция · i18n · критерии приёмки со способом доказательства
· план автотестов и риски · откат · release-артефакты · блок «принято
предположительно».

По каждому AC указан способ доказательства (`unit`/`smoke`/`golden`/«ревью
кода») и для защитных случаев — явная «чем краснеет» формулировка внутри
самого текста AC (не обязана быть таблицей на этапе spec — таблица «AC · чем
доказан · чем краснеет» требуется на код-ревью, §2.7):

- AC1: «Краснеет при переборе `_devices` без visibility predicate» — явный
  мутационный критерий.
- AC2: негативные контроли перечислены прямо в AC (endpoint/axis/Shift
  diagonal/ambiguous не показывают false winning guide), плюс «existing
  wall-end-align tests unchanged» как регрессионный барьер.
- AC3: «Краснеет без retirement» + отдельный контроль на released/pending
  запись, которая не должна откатываться — покрывает ровно ту гонку
  (async: отмена vs. уже принятая запись), которую требует §2.6.
- AC4: `ci:golden` уже стоит меткой на issue (подтверждено `gh issue view`),
  соответствует требованию визуального гейта при риске в рендере плана
  (§5.1).
- AC5: доказательство «ревью кода + unit» корректно для документационного/
  структурного AC без наблюдаемого пользователем состояния.

Открытых продуктовых вопросов в ТЗ нет («Принято предположительно…» помечает
единственное решение — общий read-only visibility helper и место lifecycle
owner — явно как техническое, не продуктовое). Это согласуется с тем, что
автором аналитики и ТЗ в теле issue выступил сам владелец (`authorAssociation:
OWNER`, оценочный комментарий 2026-10-14 с «трек: ask… полный контракт и
независимое ревью ТЗ явно запрошены владельцем»): вопросы, которые в обычном
цикле шли бы владельцу, здесь сняты на этапе написания ТЗ тем же человеком.
Я отдельно проверил три места, где могла прятаться недосказанная продуктовая
развилка (поведение touch-отмены, обработка «служебного ghost»-значка,
граница eligibility по этажам) — по каждой либо уже есть канон
(TOUCH-SUPPORT safety floor), либо текущий код уже ведёт себя так, как
описывает ТЗ (cross-floor уже исключён существующим фильтром), либо решение
явно помечено как «принято предположительно». Технических вопросов автору/
ревьюеру для вердикта решать не пришлось.

## Находки

Нет. Ни одной High- или Medium-находки после проверки претензий ТЗ против
кода и истории git.

## Что проверено и корректно

- Все обязательные разделы §7.1 присутствуют и однозначны.
- Каждое фактическое утверждение раздела «Проблема» подтверждено чтением
  текущего кода на материале (см. выше, с точными строками).
- Контракт поведения (пп. 1-5) не меняет radii/priorities #873/#885,
  placement result, Shift, CSS-px константы (6/10/8/12) — сверено с
  `docs/CANVAS.md` §9.3, формулировки ТЗ воспроизводят канон точно, а не
  изобретают новые числа.
- Скоуп не пересекается с открытыми #861 (декомпозиция ядра) и #866 (форма/
  группировка) — оба явно исключены текстом ТЗ.
- Release-классификация (`stable-fix` относительно v1.80.1 для eligibility/
  lifecycle, `line-fix introducedBy #885` для Walls-guide) проверена по
  git-истории и выдерживается.
- Требование touch-safety в AC3 опирается на существующий «safety floor»
  (`docs/TOUCH-SUPPORT.md`), а не является новым продуктовым решением.
- i18n: заявление «новых ключей нет» правдоподобно — ни один AC не вводит
  новый видимый текст/тост; существующие сообщения отмены не меняются.
- Число, видимое пользователю дважды: не применимо — задача не вводит новых
  отображаемых значений (направляющие — геометрия, не число).

## Чего не проверял

- Не исполнял никакой код и не запускал гейты (`tsc`, `npm test`,
  `npm run build`, golden, invariants, smoke-select): этап spec,
  зависимости/Chromium не ставились (#696, REVIEWER.md «Объём гейтов»),
  реализации ещё нет — гейты здесь неприменимы и появятся на код-ревью.
- Не читал исходный `findings-2026-10-08.md` — файла нет в репозитории
  (внутренний артефакт анализа автора); канонический материал — тело issue,
  которое воспроизводит нужное содержание само (#517), и именно его я
  проверял.
- Не проверял построчно алгоритм `SpacingMagnet`/`device-spacing.ts` —
  только то, что заявление про исключение invisible/LED из `spacingMarkers`
  (#873) правдоподобно по сигнатуре; полная алгоритмическая корректность —
  предмет код-ревью, а не ревью ТЗ.
- Не оценивал производительность/перф-бюджеты сверх заявленного в ТЗ «нет
  синхронного layout read в render и no full geometry rebuild per move» —
  на этапе spec это заявленное намерение, а не измеримый факт; код-ревью
  проверит его по диффу.

## Вердикт

Зелёный. ТЗ выполнимо, проверяемо, не содержит непомеченных догадок,
корректно отграничено от дубликатов и соответствует J6. Готово к разработке.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `ef1aeaf6cf94` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `c017a35e0a1fd3b3a5043aa3b969a09901c92316`
  ```
  git log --all --format='%H %T' | grep c017a35e0a1f
  ```
- Тело issue: `e67873c221aba2a1ced13357846b196ecc90576f16fcad31813a1ea923ae1f00`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQyNjksIm91dHB1dF90b2tlbnMiOjEzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0MzM0fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo2NCwib3V0cHV0X3Rva2VucyI6MjI1NDEsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6ODM3OTIsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoyNDI5NDU3LCJjb3N0VXNkRXN0aW1hdGUiOjEuMDQ2NTk3NH1dLCJ0dXJucyI6NDUsImR1cmF0aW9uTXMiOjI2NTE3MCwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjEuMDUwOTMxMzk5OTk5OTk5OCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4333 output_tokens=22554 cache_creation_input_tokens=83792 cache_read_input_tokens=2429457 num_turns=45 -->
