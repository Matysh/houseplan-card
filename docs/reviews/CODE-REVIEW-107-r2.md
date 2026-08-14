# Код-ревью issue #107 — переключение виртуального источника света «Всегда» (r2)

- **Issue:** https://github.com/Matysh/houseplan-card/issues/107
- **ТЗ:** [`docs/specs/107-virtual-light-toggle.md`](../specs/107-virtual-light-toggle.md), ревью
  [`SPEC-REVIEW-107-r1.md`](SPEC-REVIEW-107-r1.md) — зелёное, High 0 / Medium 0.
- **Предыдущий цикл:** [`CODE-REVIEW-107-r1.md`](CODE-REVIEW-107-r1.md) — красный,
  H1 (презентация маркера не отражает ручное состояние при сохранённых исходящих
  `controls`) + M1 (сбор `pytest tests_backend` падает без HA) → M1 заведён
  отдельным issue [#135](https://github.com/Matysh/houseplan-card/issues/135).
- **Диапазон:** `origin/dev...HEAD`. Новый коммит цикла — `de0171dd028f87622a42e0b3d698473ef5e70cb9`
  ("fix: keep manual virtual light face canonical"), поверх `1079cdfab25617df924b8c3592631aa40e078d87`.
  Ветка `issue/107-virtual-light-toggle`.
- **Ревьюер:** Claude (код-ревью ≠ ревью ТЗ ≠ r1, свежая сессия, без контекста
  реализации и без контекста r1-обсуждения).
- **Цикл:** r2/4.

## 1. Скоуп изменения (дельта к r1)

r1 уже проверил backend (`virtual_lights.py`, `store.py`, `websocket_api.py`,
миграция в `__init__.py`), фронтовую персистентность/live-sync
(`virtual-light-state.ts`, `config-store.ts`, `houseplan-card.ts`), typed-intent
toggle (`device-toggle.ts`, `devices.ts`), i18n и документацию — эта часть не
менялась в r2 и повторно не пересматривается по существу.

Коммит `de0171d` правит ровно то, что требовал вердикт r1:

- `src/device-presentation.ts` — `resolvePresentationSources()` теперь для
  точной manual-тройки (`isManualVirtualLightMarker`) отдаёт лицо маркера
  собственному canonical light source, а не агрегату `controls`; сохранённые
  исходящие `controls` остаются в графе (не исчезают из конфигурации/light-графа
  устройства-цели), но не перехватывают иконку/CSS-класс `on`/`off` самого
  маркера;
- `src/space-card.ts` — две конструкции `virtualFingerprint` (`_captureRenderDeviceSnapshot`,
  `_frameFingerprint`) переведены на `snap?.virtualLights` вместо `snap ? snap.virtualLights…`,
  для единообразия с остальными местами файла, которые уже использовали
  optional chaining (строки 309/392/736 в исходном 1079cdf). Функционально
  эквивалентно в текущем коде (`virtualLights` всегда строится и в
  `cachedSnapshot()`, и в `fetchFresh()`), но защищает от падения, если где-то в
  графе появится `_snap`/`snap` без гарантированного поля `virtualLights`
  (например, унаследованный модульный `cache` из другой версии бандла на той же
  странице) — не увидел, что это было наблюдаемым падением сейчас, но и не
  увидел вреда от правки;
- `test/device-presentation.test.mjs` — новый unit `issue 107 manual virtual
  source owns its face despite saved outgoing controls`, воспроизводящий ровно
  комбинацию AC12/H1 (marker с `controls: ['light.ceiling']`) для `off` и `on`;
- `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` — уточнение формулировки («including
  markers that retain saved outgoing controls» / «в том числе при сохранённых
  исходящих связях управления») в том же коммите, `User-Visible: yes`.

M1 в этот коммит не входит (сознательно, по хендоффу) — это корректно: Medium
не должен чиниться заодно с фиксом High, он уже заведён issue'ом.

## 2. Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| Unit (frontend) | `npm test` | **782/782 pass** (было 781/781 в r1; +1 — новый регресс-тест `device-presentation.test.mjs`) |
| Build + сверка бандлов | `npm run build && sha256sum dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js demo/srv/assets/houseplan-card.js` | один и тот же SHA-256 `d75945b8…8442e17` для всех трёх копий, совпадает с указанным автором в хендоффе; `git status --short` пусто после сборки — воспроизводимо |
| Целевой browser smoke (тот самый, что провалил H1 в r1) | `node demo/smoke_virtual_light_toggle.mjs` (после свежей сборки и синхронизации бандла) | **7/7 true**: `initialEverywhereOn`, `clickEverywhereOff`, `secondClickEverywhereOn`, `touchSingleToggle`, `reloadFirstStateOff`, `oneServerTogglePerGesture`, `noHaServiceCalls` — включая ровно две проверки, которые падали в r1 (`clickEverywhereOff`, `reloadFirstStateOff`). Файл смока не менялся между r1 и r2 (`git log` на него показывает только исходный коммит `1079cdf`) — фикс проверен тем же, изначально проваленным, воспроизводимым тестом, не переписанным «чтобы позеленело` |
| Backend pytest, чистое подмножество (повтор r1-методики, без HA) | `python3 -m venv /tmp/venv-review-r2 && pip install pytest voluptuous && PYTHONPATH=. pytest tests_backend -q` | **всё ещё падает сбором** на `tests_backend/test_virtual_lights.py` — идентично r1 (`ModuleNotFoundError: No module named 'homeassistant'`, `Interrupted: 1 error during collection`). Ожидаемо: M1 сознательно не входит в этот коммит, чинится отдельно в #135 |

Не прогонялись (осознанно, диапазон r1→r2 не касается backend/live-sync/i18n
кода, только `device-presentation.ts`/`space-card.ts` и один unit-файл):

- полный набор `demo/smoke_*.mjs` (130 сценариев) — диапазон изменения узкий
  (один resolver презентации плюс два defensive `?.`), не задевает все
  поверхности; целевой smoke уже прогнан и является тем же смоком, который
  ловил дефект;
- `npm run golden:verify` — изменение видимого результата ограничено ровно
  той же новой комбинацией (manual virtual toggle + сохранённые `controls`),
  для которой в существующих golden-baseline нет сценария (feature появилась в
  этом же issue); в существующие baseline-сценарии эта тройка не входит, и
  визуальные regressions на них не ожидаются — не подтверждено прогоном golden
  (это решение сужения объёма, а не находка);
- performance-профили — в AC не назван численный бюджет, ТЗ §15.4 явно относит
  это к pre-beta gate (без изменений к r1);
- полный HA backend harness (`pytest-homeassistant-custom-component`) —
  недоступен в этом окружении (нет `.venv-backend`, чистый Linux-раннер).
  Backend-код (`virtual_lights.py`, `store.py`, `websocket_api.py`,
  `__init__.py`) в этом цикле не менялся относительно r1, поэтому AC2/AC3/AC4/
  AC8/AC9 повторно по существу не пересматривались — их разбор чтением из r1
  остаётся в силе.

## 3. Находки

Блокирующих находок нет.

Не найдено новых High/Medium в дельте r1→r2. Единственное отмеченное в §1 —
изменение в `space-card.ts` (`?.virtualLights`) — не тождественно
воспроизводимому дефекту: не нашёл сценария, где `this._snap`/`snap` ненулевой,
но `virtualLights` при этом отсутствует (оба источника, `cachedSnapshot()` и
`fetchFresh()`, безусловно строят это поле через `virtualLightSnapshot(...)`/
`adoptVirtualLightServerSnapshot(...)`). Правка защитная и не меняет наблюдаемое
поведение ни в одном пройденном тесте — не поднимаю до Low, так как не нашёл ни
воспроизведения, ни вреда.

## 4. Что проверено и корректно

- **H1 закрыт, доказано исполнением, не только чтением.** Целевой
  `demo/smoke_virtual_light_toggle.mjs` — тот же файл, что и в r1, без
  изменений — теперь проходит 7/7, включая обе ранее красные проверки.
  Дополнительно инструментирован новый unit
  (`test/device-presentation.test.mjs`), который специально воспроизводит
  именно тройку H1 (`binding:'virtual', is_light:true, tap_action:'toggle',
  controls:['light.ceiling']`) и проверяет оба направления (`off`/`on`) для
  `sourceKind`, `visualSources`, `visual.status` и CSS-класса `on`. Тест умеет
  падать: без ветки `manualVirtualFace` в `resolvePresentationSources()`
  `sourceKind` откатывается на `'controls'`, `visualSources` включает
  `light.ceiling` (state `on`) первым источником, и assert
  `off.visual.status === 'neutral'`/`!classes.includes('on')` не проходит —
  ровно это давал прогон смока в r1 до фикса.
- **Причинный разбор совпадает с диагнозом r1.** `resolvePresentationSources()`
  (`src/device-presentation.ts:252-260,285-287`): для eligible-тройки
  (`isManualVirtualLightMarker(d.marker)`) `lights` строится только из
  `ownedLights` (без `via==='controls'` источников), и `sourceKind` принудительно
  остаётся `'light'` независимо от того, есть ли у маркера сохранённые исходящие
  `controls`. Сами `controls`-источники при этом не исчезают из общего
  `resolvedLightSources()`/Glow-графа устройства-цели (`light.ceiling`
  продолжает управляться и показываться как обычно у себя) — правка узкая,
  ограничена лицом самого manual-маркера, что соответствует ТЗ §6.3
  («Controls остаются lossless … но не управляют state этого источника»).
- **Не расширяет eligibility.** `isManualVirtualLightMarker()` — тот же
  переиспользуемый предикат из `virtual-light-state.ts`, что уже покрыт
  AC1-тестами в r1 (`devices.test.mjs`/`device-toggle.test.mjs`), новой логики
  распознавания тройки не введено — риск регресса для неэлигибл-маркеров
  (обычные `controls`-контроллеры, cover, switch, passive sensor) минимален и
  подтверждён тем, что все существовавшие кейсы `device-presentation.test.mjs`
  (44 теста в файле) остаются зелёными без изменений.
- **AC5/§6.2 (canonical consumer contract).** `docs/LIGHT.md:137-147` уже
  декларирует «device presentation» как обязательного потребителя canonical
  ручного состояния — до r2 это было расхождением документации с кодом
  (H1), теперь код соответствует уже написанному тексту; правка документации
  не потребовалась.
- **CHANGELOG.** Обе версии (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`)
  уточнены в том же коммите `de0171d` — фраза, которую r1 отметил как
  «станет неполной без H1», исправлена точным добавлением про сохранённые
  исходящие связи. Трейлеры коммита: `Issue: #107`, `User-Visible: yes` — оба
  changelog в этом же коммите, соответствует правилу.
- **M1 корректно вынесен.** Отдельный issue
  [#135](https://github.com/Matysh/houseplan-card/issues/135) существует,
  ссылается на #107 и на находку CODE-REVIEW-107-r1.md, помечен `S1-new`,
  `tech-debt`, `tests` — не оставлен как TODO в тексте ревью (§12 process).
- **Инвариант сборки.** `npm run build` воспроизводим, три копии бандла
  побайтно совпадают друг с другом и с указанным в хендоффе SHA-256.

## 5. Чего не проверял

- Полный HA backend harness — недоступен в этой среде; поскольку backend-код
  не менялся между r1 и r2, повторно не разбирал по существу AC2/AC3/AC4/AC8/AC9
  сверх того, что зафиксировано в CODE-REVIEW-107-r1.md §4.
- Полный набор из 130 `demo/smoke_*.mjs` и `npm run golden:verify` — не
  запускал; обоснование сужения в §2 (диапазон изменения узкий, целевой smoke
  уже покрывает ровно сценарий дефекта, новая визуальная комбинация не входит
  ни в один существующий golden baseline).
- Performance-профили — не в AC, отложено на pre-beta gate тем же ТЗ, что и в
  r1.
- Не проверял защитную правку `space-card.ts` (`?.virtualLights`) на предмет
  реального воспроизводимого сценария падения — не нашёл такого сценария при
  чтении обоих источников `_snap`/`snap` (`cachedSnapshot()`, `fetchFresh()` в
  `config-store.ts`), поэтому не поднимаю её в находки, но и не подтверждаю
  специальным тестом, что именно она предотвращает.
- Продуктовое соответствие `docs/SCOPE.md`/выбор J1/J3 — предмет ревью ТЗ
  (зелёное, r1), в код-ревью повторно не пересматривается.

## 6. Вердикт

H1 из r1 исправлен и подтверждён исполнением: тот же ранее красный
`demo/smoke_virtual_light_toggle.mjs` теперь зелёный 7/7 без изменений в самом
файле смока, плюс новый целевой unit-регресс. M1 корректно вынесен отдельным
issue (#135), в этот коммит не подмешан. Новых High/Medium в дельте r1→r2 не
найдено. Все обязательные гейты (`typecheck`, `npm test`, `npm run build` +
сверка бандлов, целевой smoke) зелёные; сознательно суженные (`golden:verify`,
полный набор smoke, performance, полный HA harness) обоснованы объёмом дельты
и перечислены выше.

`High: 0 · Medium: 0` — задача уходит в очередь на пре-релиз.
