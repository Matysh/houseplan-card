# CODE-REVIEW #369 — заход r3

- Issue: https://github.com/Matysh/houseplan-card/issues/369
- Ветка: `issue/369-audit-lows`, ревью-SHA `3965475c2d9ee19a2524a03d64f6b00264827233`
- Вердикт: **зелёный** · заход r3 · блокирующих циклов израсходовано 1 из 4 · High: 0 · Medium: 0

## Скоуп разбора и почему он полный, а не по дельте

Владелец закрыл предыдущий (r2, красный, H1) вердикт коммитом `2c984d8f`
на SHA `b5c5bff3`, затем **перебрал ветку набело поверх свежего `dev`**
(`#366` въехал; в комментарии закрытия явно сказано «ветка пересобрана
начисто поверх свежего dev»). `b5c5bff3` не существует в текущей истории
репозитория (`git cat-file -t b5c5bff3` → `Not a valid object name`) —
это не ошибка синхронизации, это последствие ребейза: код на новом
основании технически другой (PROCESS §7.2), поэтому по правилу из
инструкции этого раунда («ребейз на ушедший вперёд dev... — разбор
полный») я разбираю **весь диапазон `origin/dev..HEAD`**, а не только
изменения после r2, и подтверждаю закрытие r2-H1 прямым чтением кода на
текущем SHA, а не диффом от отсутствующего объекта.

`merge-base(origin/dev, HEAD) == origin/dev` — ветка ровно на один шаг
впереди dev содержательно (три коммита: `8ee1c91f`, `2c984d8f`,
`3965475c`), несмотря на то что `git diff origin/dev...HEAD --stat` по
всему дереву показывает бандл/скриншоты — это пересборка, не чужой код
(проверено: `npm run build` + `bundle:sync` воспроизводят те же байты,
`git status` чист после пересборки).

Диапазон диффа по существу (без бандла/скриншотов):
`assets/furniture/**`, `demo/smoke_furniture_polish.mjs` (новый),
`docs/{CHANGELOG.md,CHANGELOG.ru.md,FURNITURE.md,USER-GUIDE.md,
USER-GUIDE.ru.md,VACUUM.md}`, `scripts/generate-furniture-assets.mjs`,
`scripts/mutation-gate.mjs`, `src/{device-presentation.ts,devices.ts,
houseplan-card.ts,houseplan-editor-runtime.ts,vacuum.ts}`,
`test/{device-presentation,devices,furniture-assets,vacuum}.test.mjs`.
Это ровно семь пунктов ТЗ ревизии 2 (`docs/specs/369-audit-lows.md`) —
новой подсистемы дельта не касается.

## Закрытие раунда r2

r2 (красный, SHA `b5c5bff3`) назвал одну блокирующую находку H1 и одну
Low.

| Находка r2 | Чем закрыта | Где это видно |
|---|---|---|
| **H1** — Shift-слушатели превью мебели переживают Escape (`_onKey` закрывает палитру прямым присваиванием, минуя `_furnShiftDetach`) | В ветке `e.key === 'Escape'` добавлен вызов `this._editorRuntime?._furnShiftDetach();` рядом с `_clearFurniturePreview()` | `src/houseplan-card.ts:2807`, внутри `if (this._decorTool === 'furniture')` блока Escape-обработчика (`_onKey`, decor-режим) |
| **H1** — те же слушатели переживают `disconnectedCallback` (вызывался только `_clearFurniturePreview()`) | В `disconnectedCallback` добавлен `this._editorRuntime?._furnShiftDetach();` следом за `_clearFurniturePreview()` | `src/houseplan-card.ts:2700`, внутри `disconnectedCallback()` (границы метода — строки 2572–2717, проверено чтением) |
| **Low** — дублирующий idempotent-вызов `_furnShiftDetach()` в `_furnPlace` | Вызов остался в единственном экземпляре | `src/houseplan-editor-runtime.ts:4757` — `grep -n _furnShiftDetach` по файлу показывает ровно один вызов внутри `_furnPlace` (было два в r2) |

Дополнительное доказательство, не заявленное автором как самостоятельный
пункт, но проверенное мной: новый смок получил Escape-регресс
(`rearmAttachesAgain`, `escapeClosesPalette`, `escapeDetachesListeners`,
`demo/smoke_furniture_polish.mjs:146-161`) — прогнан, все три ассерта
зелёные (см. «Гейты» ниже), и мутант `furniture-shift-listeners-not-
attached` по-прежнему валит именно этот файл, значит регресс способен
падать.

## Унаследовано из r2

Из документа r2 (не найден в `docs/reviews/**` — публикация ревью-дока
для code-стадии #369, судя по дереву, ещё не коммитилась; текст находки
и её разбор взяты из комментария ревьюера в issue от r2, SHA `b5c5bff3`)
принимаю без повторного разбора «с нуля», но **перепроверяю на текущем
SHA**, а не по вере:

- Пункты (а), (б), (в), (г), (ж) — r2 подтвердил их доказанными
  (автотестом с «умеющим падать» мутантом либо прямым чтением). Я не
  повторяю продуктовое рассуждение по каждому с нуля, но перечитал
  итоговый код каждого на `3965475c` (см. «Что проверено» ниже), потому
  что ребейз формально меняет файл целиком и правка H1 живёт в тех же
  файлах (`houseplan-card.ts`, `houseplan-editor-runtime.ts`), где могла
  задеть соседний код.
- Low «буквально пустой repo-wide `grep Matyushin` недостижим» — принято
  ещё на спек-стадии (SPEC-REVIEW-369-r1, раздел о L1/Low), прецедент
  `CODE-REVIEW-269-r1.md`. Проверено: `grep -rn Matyushin` вне
  `docs/specs/**` и `docs/reviews/**` действительно пуст.

## Как проверялось (полный разбор, не по дельте — см. выше)

Материал: `git log --oneline origin/dev..HEAD`, `git diff
origin/dev...HEAD`, тело issue #369, `docs/specs/369-audit-lows.md`
(ревизия 2), все комментарии issue (включая сорванную попытку ревью из-за
конфликта слияния и оба реальных раунда). Ручного тестирования в UI не
было — весь разбор через код, автотесты и браузерные смоки на реальном
собранном бандле.

### AC — построчно

1. **(а)** `docs/VACUUM.md` получил раздел «Deleting and restoring a
   vacuum marker (#369)»; `docs/USER-GUIDE.md` (англ., раздел про
   пылесосы) и `docs/USER-GUIDE.ru.md` получили зеркальные абзацы.
   Прочитано целиком — формулировки согласованы друг с другом и с
   реальным поведением `async_purge_orphans` (#335). check-docs не
   покраснел (структурная часть контракта).
2. **(б)** `smoothVacPath` (`src/vacuum.ts:250-296`) получил параметр
   `warn` (default `console.warn`), считает `droppedSegments` и вызывает
   `warn(...)` один раз на вызов, с числом сегментов, только если
   `droppedSegments > 0`. Возврат функции не изменён по структуре (тот же
   алгоритм отсева). Юнит `test/vacuum.test.mjs:461-677` проверяет: 2 из
   3 «плохих» сегментов дают ровно один warn с текстом `/2 segment/` и
   `/non-finite/`; чистый путь не шумит. Мутант `vac-trail-drop-warn-
   removed` вырезает вызов warn — юнит падает (проверено запуском).
3. **(в)** `markerClimateTarget` (`src/devices.ts:1406`) — `===null`
   заменено на `== null`. Юнит `test/devices.test.mjs:617-638` проверяет
   три ветки: отсутствующий ключ `area`, явный `area: null`, `area:
   'kitchen'` — все три дают ожидаемый ключ. Мутант `climate-legacy-
   area-undefined-lost` возвращает строгое равенство — юнит падает
   (проверено).
4. **(г)** `controllerAvailability` (`src/device-presentation.ts:210-231`)
   получил `disabledRoster`. Прочитал вызов `d.entities` до места, где
   он строится (`src/devices.ts:1198,1210`: `entities: entIds`, где
   `entIds = bindingStatus.enabledEntityIds` при `kind==='active'`) —
   значит `ownEntities.length===0` уже эквивалентно «enabledEntityIds
   пуст» для устройств `bindingKind==='device'`, и добавленная проверка
   `allEntityIds.length>0` в связке с этим и с внешним `ownEntities.
   length===0` реализует контракт «ростер непуст, но всё отключено»
   корректно, а не только по счастливой случайности. Отдельно заметил
   избыточность: дизъюнкт `d.bindingStatus?.kind === 'ha_disabled'`
   внутри `disabledRoster` никогда не меняет результат, потому что
   итоговое `&&` уже требует `d.bindingStatus?.kind === 'active'` —
   мёртвое (но безвредное) условие. Это тот же L1, что SPEC-REVIEW-369-r1
   уже принял как Low на спек-стадии («избыточное условие в (г), не
   блокирует») — не завожу повторно, привожу здесь только как
   подтверждение, что это старая, а не новая находка. Юниты
   `test/device-presentation.test.mjs:1192-1207` кроют все три случая
   ((i) истинно безростерный — available, (ii) ростер отключён
   пользователем — не available, (iii) `ha_disabled` — гасится на уровне
   `effectiveHidden`, не через эту функцию). Мутант `opted-out-roster-
   looks-alive` падает (проверено).
5. **(д)** `_furnShiftListener`/`_furnShiftAttach`/`_furnShiftDetach`
   (`src/houseplan-editor-runtime.ts:4681-4704`) — идемпотентны через
   флаг `_furnShiftAttached`. Attach — только в `_furnPick` (символ
   вооружён, превью может появиться). Detach — во всех точках снятия
   палитры: `_furnPlace` (успешная установка), все обработчики закрытия
   палитры/категории/бэка в `_renderFurnPalette` и `_renderDecorBar`/
   `_renderDecorSecondary`, плюс (после r2-H1) Escape и
   `disconnectedCallback`. Проверил, что превью и клик читают один и тот
   же источник истины (живое состояние клавиши Shift): клик —
   `ev.shiftKey` на момент pointerdown (`_furnPlace(...,ev.shiftKey,...)`,
   `houseplan-editor-runtime.ts:4790`), превью — `_furnPreviewInput.free`,
   обновляемый и из pointermove (`ev.shiftKey`), и из keydown/keyup —
   рассинхронизации источника нет. Смок `smoke_furniture_polish.mjs`
   покрывает связку: 14 ассертов, все зелёные при исполнении (см.
   «Гейты»).
6. **(е)** `_decorPointerDown` (`src/houseplan-editor-runtime.ts:4076-
   4082`): `ev.pointerType==='mouse' && ev.button!==0 && t!=='select' &&
   t!=='erase' → return false`, до всех веток инструментов (line/rect/
   ellipse/text/furniture), но не для select/erase — соответствует
   контракту «правая кнопка не ставит объект», не трогает select/erase и
   не вызывает `preventDefault` (контекстное меню браузера не подавлено).
   Смок проверяет оба клика (правый — no-op с сохранением armed-
   палитры, левый — ставит). Мутант `placement-accepts-any-mouse-button`
   падает (проверено).
7. **(ж)** `LICENSE.md`, `README.md`, `pack.json` в
   `assets/furniture/houseplan-0.3.0/`, `docs/FURNITURE.md:41` и
   `scripts/generate-furniture-assets.mjs` (provenance-проверка) все
   несут «Sergey Matyunin». `README.md` получил абзац о том, что байты
   архива не менялись и старая романизация может остаться внутри
   исходника. `grep -rn Matyushin .` (вне `.git`) даёт только
   `docs/specs/369-audit-lows.md` и `docs/reviews/SPEC-REVIEW-369-r1.md`
   — оба исторические/описательные цитаты, ожидаемо по AC7 и уже принято
   на спек-стадии.
8. **Мутанты** — все пять из ТЗ найдены в `scripts/mutation-gate.mjs`
   (`vac-trail-drop-warn-removed`, `climate-legacy-area-undefined-lost`,
   `opted-out-roster-looks-alive`, `furniture-shift-listeners-not-
   attached`, `placement-accepts-any-mouse-button`) и прогнаны мной по
   одному — 5 из 5 пойманы адресно (см. «Гейты»).

### Гейты — что прогнал сам и с каким результатом

Зелёного Validate на `3965475c` не найдено, поэтому прогнал сам:

- `npx tsc --noEmit` — чисто, без вывода.
- `npm test` — `# tests 1538 / # pass 1537 / # fail 0 / # skipped 1` —
  совпадает с заявленным автором 1537/0.
- `npm run build` — сборка без ошибок; `git status --porcelain` после
  сборки пуст → `dist/`, `custom_components/houseplan/frontend` и
  `demo/srv/assets` (после `npm run bundle:sync`) байт-в-байт совпадают
  с закоммиченными копиями.
- `node scripts/check-docs.mjs` — «Documentation checks passed (7 files,
  10 external links)» — обязателен, так как диапазон трогает `src/**`.
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` — 5
  символов на изменённых строках, 8 «прямых совпадений»: `demo/
  smoke_furniture.mjs`, `demo/smoke_furniture_polish.mjs` (по
  `_furnPreviewInput` — узкая, специфичная связь), и шесть смоков по
  `_editorRuntime` (`smoke_cold_view_toggle`, `smoke_cold_view_vacuum`,
  `smoke_grid_scale_invariance`, `smoke_ha_controls`,
  `smoke_lazy_editor_chunk`, `smoke_partition_openings`) — широкая связь
  (`_editorRuntime` встречается в 7 из 202 смоков, не редкость, но и не
  «40+», порог инструмента для «широкого» символа). Решение по каждому:
  - `smoke_furniture_polish.mjs` — прогнан (целевой смок задачи, новый).
    Результат: все 14 ассертов `true`, `OK`.
  - `smoke_furniture.mjs` — прогнан (та же подсистема — превью/палитра
    мебели, автор заявлял «зелёный без правок»). Результат: `OK`, все
    ассерты `true` (включая `noSymbolNoStamp`, `unarmedCanvasDismiss*` —
    смежные с (е) сценарии клика по стейджу).
  - `smoke_cold_view_toggle.mjs`, `smoke_cold_view_vacuum.mjs` —
    прогнаны, а не пропущены как «слабая связь»: r2-H1 был именно про
    `disconnectedCallback`, а это единственные два смока, которые реально
    гоняют холодный disconnect/reconnect цикл карточки — самая
    чувствительная часть правки. Результат: `OK` в обоих, `noPageErrors:
    true`, `runtimeColdAfter: true`.
  - `smoke_grid_scale_invariance.mjs`, `smoke_ha_controls.mjs`,
    `smoke_lazy_editor_chunk.mjs`, `smoke_partition_openings.mjs` — НЕ
    прогнаны. Связь по `_editorRuntime` признана случайной: ни один не
    трогает мебель, Shift, кнопки мыши или lifecycle отключения карточки;
    символ на изменённых строках — это просто `this._editorRuntime?.` в
    других, не связанных с этим диффом местах тех же двух файлов.
- Мутанты #369 (5/5) — раздел «AC» выше, каждый прогнан отдельно
  (`node scripts/mutation-gate.mjs --id=<id>`), «поймано 1 из 1» на
  каждом, чистый прогон перед мутацией зелёный.

### Чего не проверял и почему

- **`npm run invariants`** — диапазон не трогает геометрию комнат,
  толщину стен, `layout`, `marker.space` (кроме чтения существующего
  ключа в (в), не записи) или `open_spans`. Правило триггера инвариантов
  не выполнено — не прогонял.
- **`npm run golden:verify`** — ни один пункт не меняет геометрию/стили/
  слои по умолчанию: (д) требует нажатия Shift без движения мыши, (е) —
  правого клика, (г) — специфической комбинации `bindingStatus`, ни один
  сценарий не входит в обычный набор golden-кадров. ТЗ прямо пишет
  «golden/performance: не задеты (проверить прогоном обычного гейта)» —
  обычный гейт (build+test+check-docs) прогнан и зелёный; полный
  golden-прогон посчитал избыточным для этой задачи (несоразмерный
  объём).
- **`python -m pytest tests_backend`** — `custom_components/**/*.py` не
  тронут.
- **Performance-профили** — не названы в AC, чувствительные к перфу пути
  не тронуты (только доп. `addEventListener`/`removeEventListener` на
  время жизни палитры и одна проверка `ev.button`).
- **CODE-REVIEW-369-r1/r2 как файлы в `docs/reviews/`** — не найдены в
  дереве ни на `HEAD`, ни в `origin/dev`; текст r2 восстановлен из
  комментария ревьюера в issue (см. выше), а не из документа. Это не
  блокирует мой вывод (комментарий содержит SHA и полный текст находки),
  но стоит того, чтобы шаг публикации ревью-документов для code-стадии
  проверили отдельно — по SPEC-стадии документы `SPEC-REVIEW-369-r1.md`
  коммитятся исправно, по CODE-стадии #369 — нет ни одного.
- **Ручное тестирование в браузере** — не проводилось; вся уверенность —
  через автотесты, мутанты и смоки на реальном собранном бандле
  (Chromium headless через `demo/serve.mjs`), запущенные лично в этой
  сессии.

## Итог

Все семь пунктов ТЗ ревизии 2 реализованы и доказаны — либо автотестом с
подтверждённой «умеющей падать» проверкой (5/5 мутантов адресно), либо
прямым чтением кода с явной пометкой. Обе точки утечки Shift-слушателей,
названные в r2 (Escape, `disconnectedCallback`), закрыты именно в тех
строках, которые назвал ревьюер, и регресс на них теперь ловится смоком.
Новых High или Medium в скоупе не найдено. Единственная сопутствующая
наблюдение — мёртвый (безвредный) дизъюнкт в `disabledRoster` — это
старый принятый Low со спек-стадии, не новая находка, фиксирую для
полноты, без правки.
