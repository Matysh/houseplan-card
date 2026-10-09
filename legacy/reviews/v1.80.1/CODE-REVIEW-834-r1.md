# CODE-REVIEW-834-r1

Issue: #834 · Трек: ask · Заход: r1 · Блокирующих циклов использовано: 0/4
Материал: `d9dfc471e45346dc055c1e15f8213c7542a77143` (рабочая копия на нём), диапазон `origin/dev..HEAD`:

```
d9dfc471 fix: retain native node capture and presented camera
5b4c8f56 perf: prune proved redundant node geometry work
a032feb9 perf: add headroom to connected-node dragging
45c33ee6 fix: stabilize and accelerate connected-floor node dragging
```

## Скоуп

ТЗ (issue body, принято в SPEC-REVIEW-834-r1, зелёный) требует: AC1 — все 100
соседних позиций ранее нестабильного узла проходят структурно и визуально;
AC2 — геометрически небезопасные позиции (реальные пересечения, схлопнутые
кольца, clearance ниже физических пределов, потерянные отверстия, смешение
единиц) остаются запрещены fail-closed, провальный retry возвращает
ИСХОДНУЮ ошибку, а не degraded-успех; AC3 — последний input побеждает,
pointerup синхронно доводит до записи, Escape/cancel/revision/unmount не
оставляют preview/запись/history, один accepted commit = один Undo/Redo;
AC4 — честные perf-метрики тёплого жеста (p95 CPU ≤50 мс, input→paint
≤100 мс, long task ≤150 мс) на связном 8-комнатном fixture; AC5 — новый
regression/perf-гейт подключён к обычному CI-маршруту, соседние
Resize/adoption/View-гейты не регрессируют.

Дифф: 57 файлов, +4741/-162. Новые модули геометрии
(`wall-boolean-cache.ts`, `wall-boolean-baseline.ts`, `wall-shell-union.ts`,
`wall-geometry-batch.ts`, `wall-local-replacements.ts`, `wall-quad-coverage.ts`,
`wall-node-room-floor.ts`, `wall-node-corners.ts`, `wall-node-openings.ts`),
рефакторинг `wall-thickness.ts`/`junction-limits.ts` для их подключения,
rAF-переработка `wall-node-editor.ts`, независимый фикс захвата указателя и
заморозки камеры (`d9dfc471`), новый connected-floor fixture и набор
unit/backend/native-perf тестов, обновление 4 канонических документов и
обоих CHANGELOG.

Риск по изменённым участкам (#707): класс **geometry** (основная масса
диффа) закрыт AC1/AC2/AC5 ТЗ; класс **perf**
(`wall-node-editor.ts:178`, rAF) закрыт AC3/AC4. Оба класса явно названы в
разделе «Проблема, скоуп» ТЗ. Трек ask — это и требовалось сверить; пробелов
не нашёл.

## Как проверялось

Разбор вёлся тремя параллельными агентами (geometry-safety,
editor/perf-pointer, tests/mutants/docs) плюс прямым чтением кода мной —
по каждому новому геометрическому модулю: может ли исключение из
оптимизированного пути быть проглочено вместо отказа; достаточно ли
предусловие шортката для заявленного тождества; корректен ли ключ/границы
кэша; не мутируются ли авторские координаты. По редактору — ограничение
одного rAF на кадр, синхронный flush на pointerup, порядок
capture→freeze-камеры, гейтинг камеры только после подтверждённого
capture. По тестам — действительно ли негативные ассерты падают при
удалении защиты (adversarial-геометрия + независимый оракул
`difference()`/`pointInPhysicalGeometry`, а не только «не бросило
исключение»). По `scripts/mutation-registry.mjs` — существование и точное
соответствие заявленных в таблице «чем краснеет» якорей (`node-shell-*`,
`node-capture-*`, `node-native-move-omits-held-button`, `node-floor-*`,
`node-opening-*`, `node-convex-fan-*`, `node-input-ledger-*`) конкретным
строкам продуктового кода.

Отдельно я сам проследил цепочку **reuse/waive** в CI для гейтов `backend`
и `geometry_parity`, которые на финальном SHA показаны как «skipped»:

- `Бэкенд: pytest в Home Assistant` выполнился и прошёл на пуше коммита
  `45c33ee6` (run `37831856493`); с тех пор ни `custom_components/**`, ни
  `tests_backend/**` не менялись — последующие прогоны законно
  переиспользуют этот результат по побайтовому совпадению входов.
- `Геометрия: TS/Python parity исполнена` выполнился и прошёл на пуше
  коммита `a032feb9` (run `37839911481`, уже после второго изменения
  `src/junction-limits.ts`); с тех пор файл не менялся — финальный SHA
  законно переиспользует этот результат.

Это не самоотчёт автора: оба гейта реально исполнялись в CI на содержимом,
побайтово совпадающем с содержимым в `d9dfc471`, что подтверждено логом
`Переиспользование: это дерево уже проверено` (`##[notice]... входы
побайтово те же, что в предыдущем успешном прогоне (#208)`).

## Находки

### Medium — слабая проверка топологии в численном retry (в скоупе)

**Файл:** `src/wall-shell-union.ts:46-47`
**Суть:** `canonicalComputedWallGeometry` после квантования координат
операнда сверяет топологию так: `topology(normalized) !== topology(geometry)`,
где `topology()` — отсортированный список количеств колец по полигону
(`value.map(polygon => polygon.length).sort(...).join(',')`). Это
сравнение чувствительно только к ОБЩЕЙ мультимножественности количеств
колец, но не к тому, какое именно кольцо (дыра) принадлежит какому
компоненту. Если округление координат квантовки сдвигает отверстие так, что
оно формально «переходит» от одного компонента к соседнему с таким же
числом колец (например компонент A: 3→2 кольца, компонент B: 2→3 кольца —
сумма и мультимножество `{2,3}` сохраняются), проверка это не поймает, хотя
это ровно «реальная потеря доказательства», которую комментарий в этом же
файле (`src/wall-shell-union.ts:1-4,22-24`) и ТЗ прямо запрещают
(«Each operand must preserve its rings, holes and component topology»).
`preserveCertifiedSeparation` (там же, строки 55-69) эту брешь не
закрывает — она сравнивает bounding-box компонентов РАЗНЫХ операндов
(body vs shell), а не перераспределение колец ВНУТРИ одного операнда.

**Чем краснеет сейчас:** мутант `node-shell-retry-merges-disconnected-components`
(scripts/mutation-registry.mjs:~485) вырезает всю строку с проверкой
топологии целиком — его ловит `test/wall-node-connected.test.mjs:98`
(`tinyGap` схлопывает два отдельных контура в один, другое число колец).
Но это доказывает только «проверка существует», не «проверка верна для
заявленного инварианта». Сценарий «перестановка кольца между компонентами
одинакового размера» не представлен ни тестом, ни отдельным мутантом —
третий столбец таблицы «AC2 numerical safety» для этого конкретного
отказа пуст.

**Почему Medium, не High:** эксплуатация требует специфического числового
совпадения (два компонента с равным числом колец, округление у которых
меняет принадлежность конкретного кольца без изменения общего количества),
что для реальной геометрии связного этажа маловероятно и не
воспроизведено ни в одном известном repro. Это пробел в доказательстве
защитного AC, а не продемонстрированный путь пропуска небезопасной
геометрии.

**Что сделать:** усилить `topology()` — сравнивать не только число колец на
полигон, но и площадь/число вершин каждого кольца (или ring-by-ring
identity, раз canonicalComputedWallGeometry строит `canonical` поэлементно
в том же порядке, что и `geometry`, до самостоятельного `union(canonical)`),
либо добавить мутант и тест на «кольцо мигрирует между компонентами
одинакового размера».

Находка в скоупе задачи (файл — буквальный центр AC1/AC2 этой задачи) →
жёлтый вердикт, возврат автору, отдельный issue не заводится.

## Что проверено и корректно

- **Численная стабилизация (AC1/AC2).** `unionWallShellGeometry` ретраит
  ровно один раз, при провале retry пробрасывает ИСХОДНОЕ исключение
  (`catch { throw original; }`), никогда не конвертирует отказ в
  degraded-успех — подтверждено и чтением, и
  `test/wall-node-connected.test.mjs:93-132` (включая `error === failure`
  и точное число попыток). `preserveCertifiedSeparation` корректно
  монотонна по округлению. Все 100 соседних позиций связного fixture
  строят `status: 'ok'` с независимыми пространственными оракулами
  (`pointInPhysicalGeometry`) — не просто «не упало» (`test/wall-node-connected.test.mjs:27-47`).
- **Исторический #278-fixture.** Раньше требовал `degraded-extra` из-за той
  же численной нестабильности; теперь строит один связный T-контур,
  проверено независимым material/area-оракулом
  (`test/wall-union-isolation.test.mjs`, точные координаты/площадь
  ожидаемого T). Отдельный новый тест с инъекцией
  (`operations.mergeExtra` бросает) подтверждает, что genuine-отказ
  по-прежнему корректно даёт `degraded-extra` с сохранением обоих
  компонентов — фикстура не просто «перестала быть негативным примером»,
  а получила замену на явную fault-injection. То же сделано в
  `test/resize-controller.test.mjs` (NaN-колонна вместо исторического бага).
- **Select-only шорткаты (`wall-quad-coverage.ts`, `wall-node-room-floor.ts`,
  `wall-node-corners.ts`, `wall-node-openings.ts`, `wall-geometry-batch.ts`,
  `wall-local-replacements.ts`).** Каждый шорткат фактически используется
  ТОЛЬКО через опциональные поля `WallGeometryOperations`, не подключён к
  обычному View-пути по умолчанию (единственный вызов без порта использует
  исторический путь). Предусловия консервативны (ambiguous/degenerate →
  `null`/`false` → откат на точный путь); адверсариальные тесты
  (`wall-quad-coverage.test.mjs`: concave bay, hole touching boundary,
  self-crossing star, cancelled orientation, subnormal products) сверяются
  с независимым `difference()`-оракулом. `wall-node-room-floor.ts`'s
  identity-shortcut (`A\(O\H)=A∩H`) корректно гейтится доказанным
  containment через bbox + `wallQuadCovered`, с fallback на
  `subtractLocalWallGeometry` при любой неопределённости/исключении.
- **Универсальный (не Select-only) путь.** `unionWallShellGeometry` и
  батч-вычитание проёмов (`subtractWallOpeningCuts`) подключены для ВСЕХ
  потребителей `wallBodiesGeometry`, не только Select — это корректно
  (баг влиял на всех), и математическое тождество `A\B\C=A\(B∪C)` держится
  независимо от побочных эффектов; fallback воспроизводит точный
  исторический порядок при неудаче. `bevelMultiWallBody` тоже меняет путь
  по умолчанию (composed local-replacements вместо последовательного),
  с полным откатом на `bevelMultiWallBodySequential` при любом исключении;
  покрыто `test/wall-node-canonical-parity.test.mjs` (две НЕЗАВИСИМЫЕ
  функции реального пайплайна, сравнение по площади/топологии/junction-
  вердиктам) плюс существующий junction-regression-набор (#249/#271/#275/
  #288/#302/#309/#310, 16 golden-сцен), зелёный на этом SHA (см. гейты).
- **`junction-limits.ts`/`houseplan-editor-runtime.ts`.** Добавленный
  `onRoomInnerContour` — чисто наблюдательный колбэк, вызывается ПОСЛЕ
  того, как `checkRoomClearance` уже использовал `inner`; бросок из
  колбэка не перехватывается (не может превратить отказ в
  фиктивный успех) — подтверждено `test/wall-node-proof.test.mjs`
  (`'scene contour capture is observation only...'`, включая инъекцию
  «отравленного» кэша сцены и проверку, что clearance-вердикт не меняется).
  Проброс `baselineGeometry`/`subtractRoomMasonry` для переиспользования
  junction-proof детально протестирован сравнением «canonical» vs «reused»
  результатов по всем 100 позициям связного fixture
  (`test/wall-node-proof.test.mjs`, тесты `'834 junction reuse matches...'`
  и `'834 all 100 connected positions keep exact old floor boundaries...'`)
  — закрывает предварительное опасение одного из суб-агентов о «непокрытом
  пути»: тест существует, просто в другом файле, чем тот, что ему называли.
- **rAF/указатель (AC3).** `move()` планирует не более одного rAF на кадр
  (`if (this.moveFrame !== null) return;`), устаревший callback игнорируется
  по identity (`if (this.moveFrame !== frame) return;`). `flushMove()`
  переиспользует geometry для повторной snapped-точки/оси без
  пересчёта, включая повторный ОТКАЗ (не только valid). `up()` синхронно
  вызывает `flushMove()` до paint/записи. `cancel()` (Escape,
  pointercancel/lostpointercapture, смена режима/этажа/revision через
  `render()`, `dispose()` на unmount) снимает `moveFrame`/`pendingMove`,
  снимает capture, восстанавливает paint. Один `record()` на успешный
  `up()` → один Undo/Redo. Все подтверждено модульными тестами
  (`test/wall-node-editor.test.mjs`) и browser-смоком
  (`demo/smoke_wall_node_connected.mjs`), которые реально проверяют
  негативные ветки (retired-frame race, stale write после Esc), а не
  только happy path.
- **Независимый фикс камеры/capture (`d9dfc471`).** `freezeViewport()`
  (→ `_cancelCameraTransition(false, true)`) вызывается строго ПОСЛЕ
  успешного `stage.setPointerCapture`; все пути отказа (ambiguous,
  unsupported junction, нет API, не mouse/primary/button0, busy) возвращают
  `true` ДО попытки capture — отказанный hit не может снять текущую
  анимацию камеры. `_cancelCameraTransition(false, true)` действительно
  замораживает ПОКАЗАННЫЙ кадр (`commitTarget=false` не коммитит
  `presented = to`), не прыгает на цель анимации. Три независимых
  мутанта (`node-capture-keeps-old-camera-animation`,
  `node-capture-jumps-to-camera-target`, `node-native-move-omits-held-button`)
  существуют, нацелены на правильные строки и совпадают с заявленными
  эффектами; `test/node-native-input.test.mjs` отличает дефект
  тест-драйвера (пропущенный `button: 'left'`) от продуктового дефекта.
- **Mutation-registry (AC2 evidence table).** Все три формально названных
  якоря (`node-shell-loses-numerical-retry`,
  `node-shell-retry-merges-disconnected-components`,
  `node-shell-retry-erases-certified-separation`) существуют, патчат
  именно описанные строки и подкреплены тестами с реальными геометрическими
  проверками (не просто `assert.doesNotThrow`). Остальные неформально
  упомянутые в evidence-таблице защиты (corner-fallback, floor
  operands, clock, final input, matched paint, convex coverage, mandatory
  openings) тоже находят точное соответствие в реестре.
- **Бюджеты.** `scripts/monolith-baseline.json`/`node-editor-bundle-budget.mjs`
  меняют только учётную базу raw generated-tree (2,777,899→2,780,814,
  согласовано как разрешённое исключение); `scripts/bundle-budget.mjs`
  (runtime/load gzip-потолки View/lazy-editor) не тронут. Числа
  в `docs/DEVELOPMENT.md` и скриптах не расходятся — одно число, один
  источник.
- **Трейлеры/changelog.** Все 4 коммита несут `Issue: #834` и
  `User-Visible: yes`; каждый коммит с `User-Visible: yes` правит ОБА
  changelog в том же коммите (проверено `git show --stat` на каждом из
  4 коммитов по отдельности).
- **Гейт AC5 (регистрация).** `scripts/smoke-links.mjs` добавляет связку
  изменённых файлов → `smoke_wall_node_connected.mjs`; `package.json`
  добавляет `benchmark:wall-node-connected`, указывающий на реальный
  существующий файл.
- **Backend parity (AC2).** `tests_backend/test_wall_node_connected.py`
  параметризован по всем 100 смещениям, проверяет схему, junction-limits,
  partition-opening-hosts, точную Undo-инверсию и инвариантность длины
  проёмов — не «не упало».

## Чего не проверял

- **`npx tsc --noEmit`, `npm test`, `npm run build` + сверка бандла,
  `npm run golden:verify`, `node scripts/model-invariants.mjs`,
  `node scripts/mutation-gate.mjs --check` — не перегонял сам.** Validate
  на точном SHA `d9dfc471e45346dc055c1e15f8213c7542a77143` зелёный
  (run `37854983161`, job «Фронтенд: типы, юниты, мутанты, синхрон
  бандла» — success; «Golden-кадры против принятых эталонов» — success;
  «Перф-смок: бюджет времени кадра» — success; «Смоки: все шарды
  зелёные» — success). Мутанты реестра по правилам трека `ask` в разработке
  не гоняются (ночной прогон, #709) — их отсутствие в этом прогоне не
  находка.
- **`pytest tests_backend` и junction TS/Python parity исполнением на
  этом SHA.** У меня в среде ревью нет собираемого Home Assistant (нет
  `.venv-backend`/`homeassistant`), поэтому сам не гонял. На ЭТОМ SHA оба
  задания CI показаны «skipped» — я прошёл по трассе reuse-кэша и
  подтвердил, что это легитимное переиспользование побайтово идентичного
  прогона: `backend` реально выполнился и прошёл на пуше `45c33ee6`
  (run `37831856493`), `geometry_parity` — на пуше `a032feb9`
  (run `37839911481`); ни `custom_components/**`, ни
  `tests_backend/**`, ни `src/junction-limits.ts` с тех пор не менялись.
  Это не находка, а подтверждение, что «дешёвые гейты» в данном случае
  включают и эти два по цепочке reuse, а не только то, что прогнал
  Validate ПОСЛЕДНЕГО коммита напрямую.
- **Браузерный AC4-протокол (реальные 60×8 native pointer moves,
  calibration).** Не исполнял сам; полагаюсь на зелёный
  `smoke_wall_node_connected` в составе «Смоки: все шарды зелёные» на
  этом SHA и на детальные числовые таблицы в хендоффах автора (конкретные
  команды и результаты названы на каждом шаге, включая два предыдущих
  красных Validate с honest root-cause).
- **Полный HA-harness (`test_ha_*.py`) и его сборка.** Вне скоупа этого
  ревью (не изменялся), не проверялся.
- **Черновик автора до S5.** По §2.4/§11.8 не читается, не учитывался.

## Вердикт

Один Medium в скоупе (слабая проверка топологии в однократном численном
retry, `src/wall-shell-union.ts:46-47`), High не найдено. Жёлтый вердикт,
возврат автору для усиления проверки/добавления мутанта на описанный
сценарий; остальной периметр (rAF/указатель/камера, Select-only шорткаты,
бюджеты, трейлеры, гейты) проверен и корректен.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/834-node-geometry-performance`, коммит `d9dfc471e453` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `7d94330aa20f65b299a726ce06cb5b7bafb0e12e`
  ```
  git log --all --format='%H %T' | grep 7d94330aa20f
  ```
- Тело issue: `748943c2a398aa56ed4fe383b98244248d65da00d99180a3263b27037395bc87`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4498 output_tokens=122458 cache_creation_input_tokens=479448 cache_read_input_tokens=18116370 num_turns=97 -->
