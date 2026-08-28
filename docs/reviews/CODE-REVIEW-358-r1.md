# CODE-REVIEW-358-r1

Issue: #358 · этап: code · заход r1 · блокирующих циклов израсходовано 0/2
SHA ревью: `bb3c1fd1` (HEAD ветки `issue/358-cold-view-vacuum`, детач от `origin/dev`)

## Скоуп

Систематический аудит после #357: единственный оставшийся достижимый из
холодного View жёсткий стаб `_vacMapId` — вызывается внутри `willUpdate`
(`_captureRenderDeviceSnapshot`) для любого пылесоса с телеметрией. На
холодной вкладке бросает `Houseplan editor runtime is not loaded`,
исключение внутри `willUpdate` убивает весь цикл обновления Lit — карточка
замирает целиком, не только клик, как в #357.

Задача — light track (`small`), ТЗ в теле issue, ревью по PROCESS.md §2.7.
Диф: `src/houseplan-card.ts`, `src/houseplan-editor-runtime.ts`, новый смок
`demo/smoke_cold_view_vacuum.mjs`, мутант в `scripts/mutation-gate.mjs`,
запись в `scripts/smoke-links.mjs`, оба changelog, синхронизация трёх копий
бандла и `docs/images/screenshots.json` (фингерпринт документации).

Соответствие job из `docs/SCOPE.md`: чинит регресс в основном View-пути
(J1/J2 — «живая пространственная карта» не должна замирать), правка не
расширяет скоуп.

## Как проверялось

Материал — `git log --oneline origin/dev..HEAD` (один коммит) и
`git diff origin/dev...HEAD`. Ручного тестирования не было, весь разбор —
чтением диффа плюс браузерные смоки локально.

**Дешёвые гейты (нет зелёного Validate на этом SHA — прогнал сам):**

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | чисто, без вывода |
| `npm test` | `tests 1499 / pass 1498 / fail 0 / skipped 1` — совпадает с числом, заявленным автором |
| `npm run build` | успешно, `dist` собран |
| `npm run bundle:sync` | пересобрал; `git status --short` пуст — три копии бандла (dist, `custom_components/.../frontend`, `demo/srv/assets`) идентичны коммиту |
| `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` — diff трогает `src/**`, фингерпринт скриншотов в коммите уже обновлён и совпадает |

**Инварианты модели (`npm run invariants`)** — не прогонял: диф не трогает
геометрию, `layout`, `marker.space`, рёбра/толщину стен, `open_spans`.
Не применимо к этой задаче.

**Браузерные смоки** — выбор через
`node scripts/smoke-select.mjs --base <origin/dev SHA> --head HEAD`
(изменено 2 файла `src/**`, 11 символов проекта на изменённых строках,
16 прямых совпадений):

```
demo/smoke_cold_view_vacuum.mjs   ← _editorRuntime, _vacMapId, willUpdate
demo/smoke_binding_picker.mjs     ← _planHass
demo/smoke_cold_view_toggle.mjs   ← _editorRuntime
demo/smoke_controls.mjs           ← DevItem
demo/smoke_decor_text.mjs         ← _decorShapeDbl
demo/smoke_decor.mjs              ← _decorShapeDown
demo/smoke_drag_bounds.mjs        ← _decorShapeDown
demo/smoke_furniture.mjs          ← _decorShapeDbl
demo/smoke_grid_scale_invariance.mjs ← _editorRuntime
demo/smoke_ha_controls.mjs        ← _editorRuntime
demo/smoke_lazy_editor_chunk.mjs  ← _editorRuntime
demo/smoke_live_text.mjs          ← _decorShapeDbl
demo/smoke_partition_openings.mjs ← _editorRuntime
demo/smoke_static_icon.mjs        ← _planHass
demo/smoke_vacuum_firstuse.mjs    ← _vacCalConfirm
demo/smoke_ws_resilience.mjs      ← willUpdate
```

Решение по каждой строке:

- **Прогнал** (прямое совпадение на реально изменённом символе, либо
  AC-обязательный):
  - `smoke_cold_view_vacuum.mjs` — новый, доказывает AC1/AC3 — **OK**
  - `smoke_vacuum.mjs` — назван AC2 в issue напрямую (нет в выдаче
    smoke-select, т.к. не ссылается на изменённые символы текстом, но
    AC требует его явно) — **OK**
  - `smoke_vacuum_firstuse.mjs` — назван AC2, плюс прямое совпадение на
    `_vacCalConfirm` (гард К2) — **OK**
  - `smoke_decor.mjs` — прямое совпадение на `_decorShapeDown`, метод
    реально изменён (К2-гард) — **OK**
  - `smoke_drag_bounds.mjs` — то же самое совпадение на `_decorShapeDown` — **OK**
  - `smoke_cold_view_toggle.mjs` — тот же класс регрессии (#357),
    родственный контракт «холодная вкладка + `_editorRuntime`» — **OK**
  - `smoke_lazy_editor_chunk.mjs` — прямой контракт ленивой загрузки
    редакторского чанка, который меняющийся гард `_vacCalConfirm` мог
    задеть — **OK**
- **Не прогонял** (связь через широко используемое имя, символ сам не
  менялся):
  - `smoke_binding_picker.mjs`, `smoke_static_icon.mjs` — совпадение на
    `_planHass`, который в диффе фигурирует только как непереименованный
    параметр по умолчанию, не как изменённая логика.
  - `smoke_controls.mjs` — совпадение на типе `DevItem`, использованном в
    сигнатуре без изменения самого типа.
  - `smoke_decor_text.mjs`, `smoke_furniture.mjs`, `smoke_live_text.mjs` —
    совпадение на `_decorShapeDbl`, парном методе, который сам не тронут
    (гард получил только `_decorShapeDown`).
  - `smoke_grid_scale_invariance.mjs`, `smoke_ha_controls.mjs`,
    `smoke_partition_openings.mjs`, `smoke_ws_resilience.mjs` — совпадение
    на широких именах (`_editorRuntime`, `willUpdate`), не специфичных для
    вносимого изменения; уже покрыты по духу выбранными cold-view смоками.

Результаты (все зелёные, без правки ассертов):

```
smoke_cold_view_vacuum   → OK (все 10 подпроверок true)
smoke_vacuum             → OK
smoke_vacuum_firstuse    → OK (13 подпроверок true)
smoke_decor              → OK (13 подпроверок true)
smoke_drag_bounds        → OK (12 подпроверок true)
smoke_cold_view_toggle   → OK (12 подпроверок true)
smoke_lazy_editor_chunk  → OK (12 подпроверок true)
```

**AC3 (мутант «вернуть делегацию `_vacMapId` в runtime»)**: скрипт
`scripts/mutation-gate.mjs` в этом окружении не принимает выборочный `--id`
и вместо точечного прогона выполняет полный «чистый прогон» всех гардов
подряд; он остановился на несвязанном с задачей `FAIL … красный без
мутанта: node scripts/backend-test-guard.mjs … tests_backend/test_frontend_assets.py`
— причина `No module named pytest` (в этом контейнере не установлен
Python-бэкенд-харнесс, см. AGENTS.md «Backend» — pytest без Home Assistant
не то же самое, что полный харнесс, а тут его вообще нет). Это ограничение
окружения ревьюера, а не дефект диффа: диф не трогает
`custom_components/**/*.py` вообще.

Проверил мутант вручную вместо гейта: применил патч мутанта
(`cold-view-vacuum-mapid-delegated`) к рабочей копии `src/houseplan-card.ts`
руками (тот же find/replace, что в `scripts/mutation-gate.mjs`), пересобрал
(`npm run build && node scripts/bundle-sync.mjs`) и прогнал
`node demo/smoke_cold_view_vacuum.mjs`:

```
page.evaluate: Error: Houseplan editor runtime is not loaded
    at Dm._editorRuntimeOrThrow (...)
    at Dm._vacMapId (...)
    at Dm._captureRenderDeviceSnapshot (...)
    at Dm.willUpdate (...)
```

Смок падает некрасиво (необработанное исключение вместо контролируемого
`FAIL`) — это ожидаемо, ровно как описывает issue: `willUpdate` рушится
целиком. Мутант убит. После проверки восстановил файл из бэкапа,
пересобрал и снова прогнал смок на чистом коде — зелёный, `git status
--short` пуст.

**`python -m pytest tests_backend -q`** — не прогонял: диф не трогает
`custom_components/houseplan/**/*.py`; изменённые файлы под
`custom_components/houseplan/frontend/**` — класс D (генерируемое),
получены исключительно из `npm run bundle:sync`, вручную не редактировались
(проверено побайтовой идентичностью после локального пересобранного
прогона).

**`npm run golden:verify`** — не прогонял: диф не меняет геометрию, стили
и слои рендера; единственное визуальное изменение — фингерпринт
скриншотов документации (регенерация хэша из-за правки `src/**`, покрыта
`check-docs.mjs`), а не новый визуальный контент.

**Performance-профили** — не названы в AC, диф не трогает
производительность-чувствительные пути (только выбор map-id и два гарда).

## Находки

Не найдено. Правка — механический перенос владения (карта вместо
делегирования в редакторский runtime) по уже принятому образцу #357,
плюс два точечных гарда по образцу уже принятого `_decorShapeDbl` и
остальных редакторских диалогов. Инвариант HP-1541-01 (`selected_map: 0`
как валидный id, nullish-, а не truthy-проверка) перенесён дословно вместе
с комментарием — сверено построчно, диф не меняет ни один символ внутри
тела метода при переносе.

## Что проверено и корректно

- **К1 (перенос `_vacMapId`)**: `_vacMapId` теперь публичный метод
  `HouseplanCard`, тело идентично прежней реализации в
  `houseplan-editor-runtime.ts` (только откуда чтение `this` → `this`,
  без изменения логики). `HouseplanEditorHostPort` пополнен записью
  `_vacMapId: (d, tele, planHass?) => string` — типы совпадают с сигнатурой
  карты. Runtime-версия теперь однострочно делегирует в `this.host._vacMapId(...)`
  — тот же приём, что `_toggleIntent` в #357.
- **К2 (гарды)**:
  - `_decorShapeDown` получил `if (!this._editorRuntime) return;` — точно
    такой же гард, как у `_decorShapeDbl` (#337); проверено смоками
    `smoke_decor.mjs`/`smoke_drag_bounds.mjs` (не бьёт существующее
    поведение) и новым холодным смоком (тихий no-op на pointerdown).
  - Рендер `_vacCalConfirm` обёрнут `this._editorRuntime ?` — выровнено с
    соседними редакторскими диалогами (`_deviceInbox`, `_markerDialog`,
    `_rulesDialog`, `_settingsDialog` в том же шаблоне).
- **К3 (холодный смок)**: `demo/smoke_cold_view_vacuum.mjs` — инжектирует
  пылесос с реальной телеметрией (`vacuum_position`, `selected_map: 0`),
  проверяет: карточка рендерится на холодной вкладке; **три
  последовательных кадра** телеметрии подтверждают, что `willUpdate` не
  просто пережил первый рендер, а продолжает работать (`secondFrameCommitted`,
  `thirdFrameCommitted` сверяют, что снэпшот реально обновился, а не просто
  существует); `mapIdResolved` проверяет HP-1541-01 (`selected_map: 0` →
  `'0'`); `noEditorRuntimeRequest` — редакторский чанк не запрошен;
  `noPageErrors` — исключений нет; декор-гард (К2) проверен pointerdown по
  реальному DOM-узлу `.dshape`.
- **AC2**: `smoke_vacuum.mjs`, `smoke_vacuum_firstuse.mjs` зелёные без
  правки ассертов (прогнал сам, см. таблицу выше) — регресс в тёплом
  пути не внесён.
- **Трейлеры**: `Issue: #358`, `User-Visible: yes` на коммите; оба
  changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правлены в том
  же коммите, формулировка на пользовательском языке («карточка
  замирает» / «freezes»), без утечки внутренних имён методов.
- **Трассируемость аудита**: `scripts/smoke-links.mjs` пополнен записью,
  привязывающей `vacMapIdWithFallback`/`vacMapIdFromAttrs`/`readVacTelemetry`
  к новому смоку — будущий diff по этим символам сам найдёт нужный смок.
- **Мутационный гейт**: новый мутант `cold-view-vacuum-mapid-delegated`
  добавлен, `guard` указывает на правильный смок; убит вручную (см. выше).
- **Одно число — один источник**: диф не добавляет и не меняет
  пользовательски видимую величину, отображаемую параллельно в двух
  местах (map id — внутреннее значение для сопоставления координат
  телеметрии, не рендерится пользователю как число/подпись). Проверка
  `test/single-source-numbers.test.mjs` — часть `npm test`, прошла в
  общем прогоне (1498/1498).
- **Границы аудита (раздел issue «Результат аудита в целом»)**: утверждение
  «остальные жёсткие заглушки недостижимы из холодного View» не
  перепроверял по всем 305 узлам графа — это отдельное объёмное
  статическое исследование вне этого диффа; для целей этого code review
  важно только то, что сам диф закрывает названные в AC1–AC4 дыры, что
  подтверждено смоками и мутантом.

## Чего не проверял

- Полный набор `demo/smoke_*.mjs` (200 файлов) — не запускал; выбор
  ограничен `smoke-select.mjs` + AC-именованными смоками (см. таблицу).
  Полный прогон — обязанность пред-релизного гейта (PROCESS.md §8), не
  этого ревью.
- `npm run invariants` — диф не трогает геометрию/толщину стен/`layout`.
- `python -m pytest tests_backend -q` — диф не трогает Python-код бэкенда;
  окружение ревьюера к тому же не имеет `pytest` вовсе.
- `npm run golden:verify` — диф не меняет визуальный рендер; единственное
  затронутое изображение (`01-view-desktop.png`) — побочный продукт
  пересборки бандла (иная хэш-сумма бандла → новый скриншот с тем же
  содержимым), покрыт `check-docs.mjs`, не самостоятельный визуальный
  гейт.
- Performance-профили — не названы в AC, диф не касается чувствительных
  к перфу путей.
- Полный `node scripts/mutation-gate.mjs` (весь набор мутантов) — не
  прогонял; прогнал только «чистый прогон» гардов до первой (несвязанной)
  остановки и точечно проверил новый мутант вручную патчем/ребилдом.

## Вердикт

Все AC1–AC4 доказаны: AC1/AC2 браузерными смоками (прогнаны лично),
AC3 — мутант проверен вручную и убит новым смоком, AC4 — чтением
диффа (гарды идентичны принятым образцам) плюс смок-проверка декор-гарда
исполнением. Трейлеры и changelog в порядке. Находок нет.

**Зелёный.**
