# CODE-REVIEW — #1070 (заход r1)

Трек: `ask`. Этап: `code`. Материал: `e6de76bf015d37c8e10f1d895f468f7ebfc39734`
(ровно он; рабочая копия уже на нём). Маршрут вердикта (#726, дано промптом): `fix`.

## Скоуп

24 коммита `b44ac26ca..e6de76bf0`: presentation-only поворот плана на 90°/180°/270°
(кнопки рядом с масштабом в Просмотре/редакторах, параметр карточки `rotation`
обеих GUI-форм, запоминание на устройстве для `houseplan-card` и
`houseplan-space-card`, Flat/2.5D/редакторы/статическая карточка/PDF), плюс
сопутствующие инфраструктурные правки того же branch (узкая шапка/high-DPI
фиксы для мобильного заголовка, устранение гонки «протухшего» коллбэка
`ResizeObserver` заголовка, перенос dev-утилиты в `scripts/dev/**`, и фикс
транспорта `ci-proof.mjs` через файл для больших NEEDS_JSON). Служит строке J1
(«показать план целиком») и прямо входит в заявленный владельцем скоуп
issue — произвольного расширения за пределы ТЗ не нашёл.

## Как проверялось

Задача огромна (508 КБ диффа, 100 изменённых файлов). Следуя static-first
(#857) и «пригодный неизменившийся check не повторять» (§8), использовал
принятый `validate-gate` (https://github.com/Matysh/houseplan-card/actions/runs/40556404201,
«review-light-golden proof is complete») как источник исполненных обычных
build/test/smoke/Golden результатов для материала `e6de76b`, и независимо
проследил код для каждого риск-класса из промпта (`geometry`, `touch`,
`migration`, `devices`, `perf`, `ux`) и каждого AC1–AC12, прежде чем сверяться
с авторским хендоффом.

Прочитано целиком (не выборочно): `src/view-frame.ts`, `src/view-frame-view.ts`,
`src/iso-projection.ts` (релевантные функции), `src/card-editor-validation.ts`,
`src/mode-transition.ts`, `src/editors/vacuum-fit-overlay.ts`, `src/vacuum-view.ts`
(релевантные функции), `src/types.ts:420-460`, `src/editor.ts` (релевантные
функции), `src/pdf/pdf-scene.ts` (релевантные функции), `src/styles/chrome.styles.ts`
(релевантные медиа-блоки), `test/view-frame.test.mjs`, `test/mode-transition.test.mjs`
(релевантный тест), `demo/smoke_plan_rotation.mjs`,
`demo/smoke_plan_rotation_editors.mjs`, `demo/smoke_plan_rotation_mobile.mjs`,
`docs/analysis/1070-plan-quarter-rotation.md`, `docs/release-ledger/v1.82.0/1070.json`,
`docs/CHANGELOG.md`/`.ru.md` (изменённые участки), `docs/USER-GUIDE.ru.md`
(изменённые участки), `docs/ISOMETRIC.md`/`docs/TOUCH-SUPPORT.md` (изменённые
участки), все четыре `src/i18n/*.json` и `src/i18n/settings/*.json` по ключам
`title.rotate_left/right` и `editor.rotation*`, `docs/testing-notes/mutation-browser-guards.md`
(релевантные witness-записи), а также целиком вызывающие пути `_rotation`,
`_rotatePlan`, `_viewOr`, `_planScreenDelta`, `_screenToVb` в `src/houseplan-card.ts`
и `src/live-viewport.ts:200-310`.

### Гейты: что прогнал, что нет и почему

- **Прогнал адресно** (`mcp__houseplan_review__run_check`): `read:log`,
  `read:diff` — чтение диффа/лога материала, не исполнение продукта; оба PASS,
  материал неизменён (`materialUnchanged: true`).
- **Не прогонял** `build:*`, `unit:test/*.test.mjs`, `smoke:demo/smoke_plan_*`
  заново: validate-gate уже выполнил их на этом же материале (`c90e8511`→`e6de76b`
  — смена SHA только из-за review/docs, не меняет product/test входы), и для
  найденных мной утверждений не нашлось конкретного непокрытого AC/риска —
  независимый разбор кода подтвердил логику, которую уже проверяют
  существующие unit/smoke (пофайлово см. «Что проверено»). Повторный прогон
  не адресован ни одному конкретному пробелу, поэтому не запускал.
- **Не могу прогнать и не требуется**: `scripts/dev/verify-plan-rotation-mobile-1070.mjs`
  (пиновый native-HA инструмент, не входит в manifest проверяемых check_id,
  сам автор явно маркирует его как «author verification, not CI execution»);
  полный `ci:full`/baseline Golden — не гейт ревью (§8, предрелизный гейт).
- `pytest tests_backend` не запускал: задача не трогает Python backend.
- `invariants` не запускал: геометрия плана/слоёв не изменяется (поворот —
  только отображение); проверка через чтение подтверждает отсутствие записи
  в конфиг/layout (смок `smoke_plan_rotation.mjs` также явно проверяет
  `noWrites.length === 0`, выполнено в validate-gate).

## Независимый разбор по риск-классам (#707)

- **geometry** (`src/iso-projection.ts`, `src/view-frame.ts` и вызывающие пути)
  — поворот строится точной таблицей (`quarterBasis`), без `Math.cos/sin` для
  канонических углов; `isoRotationBasis` использует ту же таблицу для 0/90/180/270
  и откатывается на тригонометрию только для нестандартных углов (которые
  `isoCameraFor` никогда не создаёт — `rotDeg` всегда приходит из `PlanRotation`).
  `turnMatrix` математически проверен вручную против `turnPoint` (совпадает).
  AC2 (точная обратимость, 4 оборота без накопления ошибки) и AC9
  (четыре различных проекционных стороны, общий физический источник,
  кэш переиспользуется) закрыты одним и тем же unit-тестом
  (`test/view-frame.test.mjs`), который проверяет и `builds === 1`, и
  идентичность ссылки `scene.geometry` на пятой итерации — это одновременно
  функциональное доказательство и «чем краснеет» для защитного AC11
  (счётчики кэша не растут): убери кэш-ключ по ротации — тест немедленно
  покраснеет на `builds` или `scene.geometry !== initial.geometry`.
- **touch** (`src/editors/vacuum-fit-overlay.ts`, `src/live-viewport.ts`)
  — указатель→план идёт через один общий `_planScreenDelta`
  (`turnVector` + `inversePlanRotation`), переиспользуемый `_vacDelta`
  калибровкой пылесоса; `src/vacuum-view.ts` `syncVacuumTips` берёт
  `getScreenCTM()` с внутреннего `[data-hp-plan-rotation-frame]`, а не с
  внешнего `<svg>`, поэтому корректно учитывает поворотную матрицу —
  именно тот риск («свои преобразования через getScreenCTM»), который ТЗ
  называет отдельно. `live-viewport.ts` использует уже повёрнутый
  `host._viewOr(...)` и инверс-повёрнутый `host._planVisibleRect(view)` для
  сетки — архитектурно согласовано с остальным кодом.
- **migration** (`src/types.ts:440-443`) — `CardConfig.rotation?: number`
  чисто аддитивное опциональное поле; миграции не требуется и не заявлено
  (ТЗ: «миграции нет» подтверждается чтением).
- **devices** (`src/vacuum-view.ts:33-34`) — см. touch выше; тот же файл.
- **perf** (`ResizeObserver` в `src/houseplan-card.ts:4409-4480`) — коммит
  `8f5c885a9` вводит `ownsHeader()` — явную проверку идентичности наблюдателя
  (`this._roHdr === observer`), `isConnected` и совпадения `stage` с текущим
  `this._stageEl` перед любой записью `_hdrH`/варма. Это устраняет гонку
  «протухшего» коллбэка после disconnect/remount, зарегистрированную отдельным
  witness `plan-rotation-stale-header-observer-1070`
  (`docs/testing-notes/mutation-browser-guards.md:659-664`), с честной пометкой
  «registration and ordinary PASS do not claim nightly caught execution» —
  соответствует политике #709/#905 (без исполнения мутанта вне ночи).
- **ux** (новые ключи `title.rotate_left/right`, `editor.rotation`,
  `editor.rotation_invalid`) — присутствуют и идентичны по смыслу во всех
  четырёх языковых каталогах (`en/de/ru/fr`, основной и settings), подпись
  кнопок/`aria-label` берутся из `renderPlanRotationControls`
  (`src/view-frame-view.ts`), разметка и `data-hp` атрибуты совпадают с
  остальными кнопками масштаба (`.btn.zb`, 44×44 CSS px).

## Проверка AC1–AC12 (ТЗ, не выводы хендоффа)

AC-соответствие подтверждено чтением кода + существующими авто-тестами
(unit `test/view-frame.test.mjs`, `test/mode-transition.test.mjs`, смоки
`demo/smoke_plan_rotation*.mjs`), прогнанными и зафиксированными зелёным
validate-gate на этом материале:

| AC | Статус | Чем доказан |
|---|---|---|
| AC1 | проверено чтением + смок | Кнопки в `.zoomctl` слева от «−», скрыты в киоске (`this._kiosk ? nothing : …`, `houseplan-card.ts:11149`); `smoke_plan_rotation.mjs` проверяет отсутствие WS-записей и неизменность `configRevision`/`layoutRevision`. |
| AC2 | unit | `turnPoint`/`inversePlanRotation` round-trip и 4×90°=identity, точная матрица без `sin/cos` (`test/view-frame.test.mjs:14-27,32`). |
| AC3 | unit + golden intent | SVG/HTML один маршрут (`framePercent`/`turnMatrix` общий `view-frame.ts`); icon с углом получает `angle + rotation` (`houseplan-card.ts:12165-12166`); золотые сцены `plan-rotation-flat-90/270-1070` в ledger. |
| AC4 | проверено чтением | `sunPolygons` не пересчитываются по повороту — смок явно сравнивает JSON до/после (`smoke_plan_rotation.mjs:78-79`). |
| AC5 | unit | `PlanRotationPreference` — отдельный браузер/pространство/denied storage (`test/view-frame.test.mjs:54-86`). |
| AC6 | unit, «чем краснеет» встроен в тест | `invalidCardRotation`/`effectivePlanRotation` отбивают `-90/360/45/'90'/null/NaN/Infinity` прямо в assert (`test/view-frame.test.mjs:76-80`) — удаление guard'а красит тест немедленно. |
| AC7 | смок на реальных координатах | `smoke_plan_rotation_editors.mjs` сравнивает сохранённые координаты стены/узла/устройства/декора на 0° и 90° (разница устройства <0.0002). |
| AC8 | смок | Пан/колесо в `smoke_plan_rotation.mjs` проверяют экранные направления и якорь под курсором. |
| AC9 | unit | Четыре различные стороны (`Set(sides).size === 4`), геометрия переиспользуется (`test/view-frame.test.mjs:88-116`). |
| AC10 | unit | `rotatePdfCommands` поворачивает линии/текст-декор/растр/безье, не поворачивает «горизонтальные» подписи (`test/view-frame.test.mjs:118-135`); компас получает `north + rotation` (`pdf-scene.ts:752`); авто-fit меняет местами стороны (`pdf-scene.ts:785-787`). |
| AC11 | unit | `builds === 1` и идентичность `scene.geometry` после пяти проекций (см. geometry выше). |
| AC12 | CSS + проверено чтением | `chrome.styles.ts:212-223`: `grid-template-columns` разводит поле этажа/крестик на первой колонке/строке и выносит `.header-actions` на вторую строку только для `ha-card:not([data-hp-mode='view'])` ниже 360px; View теряет только `.modes` (пустой mode-slot) и остаётся одной строкой. Числовая/пиксельная приёмка на реальном native-HA fixture — авторский, не повторяемый в ревью инструмент (вне manifest), подтверждён validate-gate. |

## Качество и читаемость

Код аккуратный, с единой точкой входа для каждого класса преобразований
(`turnPoint`/`turnVector`/`turnMatrix`/`framePercent`/`_planScreenDelta`),
что прямо снимает риск «15 разрозненных мест», названный в ТЗ. Комментарии
по делу (например, обоснование точных матриц вместо `Math.cos/sin`,
обоснование лиза наблюдателя). Дублирования или оставленного старого пути
не нашёл — замены нет, это аддитивная функциональность.

## Унаследовано / переиспользовано (не проверялось заново)

- `docs/reviews/INDEX.md` — раздел «Повторный раунд» неприменим, это r1.
- Полный Golden/Smoke набор и performance — результат `validate-gate`
  (run 40556404201) и упомянутых в хендоффе push-CI 40531508714/40531513044/
  40531509120 на материале `658770cd`/`e6de76b`; не повторял.

## Чего не проверял

- Физический планшет/реальный GPU — не гейт ревью (#929), автор честно
  помечает как неисполненное.
- Полную 122-сценовую Golden-матрицу пиксель-в-пиксель — переиспользовал
  зелёный `validate-gate`, не пересчитывал вручную.
- `scripts/dev/verify-plan-rotation-mobile-1070.mjs` на пиновом native HA —
  вне доступного execution surface ревью; его результат — авторская,
  не CI-, улика, что прямо задокументировано самим автором.

## Находки

Высоких и Medium-в-скоупе находок не обнаружено. Побочных находок нет.

## Вердикт

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 →
в задаче · Документ: docs/reviews/CODE-REVIEW-1070-r1.md

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImI0Y2NkNTVjNWM5NTEzOWIwZDMxNjk5OWVhOThiMGMwNDEyNDJkM2Y1MzNjYWVjNTUwNWVjZDg0NzkxNDM4ZGEiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI4NWRlYmFkZTMyZjA0M2RmNTc3OTE3YTVmZGM2ZjVjYmVmNWYyZThhMzA2ZjM2YjcxODExODFmNzQyZmM3NjI3IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDcwLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiJlNmRlNzZiZjAxNWQzN2M4ZTEwZjFkODk1ZjQ2OGY3ZWJmYzM5NzM0IiwidHJlZSI6ImU1MWJkOWEwMjEwMTUwYmJhNmY1NmEwN2Q4OTczZThlN2MzNjVlZTEiLCJib2R5RGlnZXN0IjoiYTRhMWQzM2I2NGY0ZDkxOTk1Yzg3YjIzOTQyMGU2M2ZiZGQxZGU4MDExMjUwNzFkNDRmNDc2MTEzZWJlZTI2NCIsInByb2R1Y2VyUnVuIjoiNDA1NTk4MjU2NTgiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjhlNzMyZjVmYWVjYjZiN2Y5ZTU2OGNjZjMzZDgxNTVjMDBkNmVhNjRkYjJlMTVmM2NjNTk2ZTYxZDU4ZGYwNTEiLCJ2ZXJkaWN0RGlnZXN0IjoiYWFlMTk4Yzc4ZmQzMTgwYjFjY2E2Mzk3MjJlYTQ0MDZhN2RhOTQyMWZiOGExMTc1ODljMmFhMDFkN2NmYTU0NiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiIwYjBkZDYwYjgxYmU1YjY1ZWY5MmE3ZjRlYTE1MDRmZTE1MDMyZTBmNmQxMzVjMGJkY2U2ZDZiZGY0ZGMyYzA3IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDUwNTQ0MDI1LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDcwI2lzc3VlY29tbWVudC02NDUwNTQ0MDI1IiwiYm9keURpZ2VzdCI6IjQwNzdkNTUwMzk4OTE0YzhhY2NlOWVhNmU2NTNhZWUxYWVkMWJlMzRlMDJiMjljMzdjOWU5ODJmZWJkZDljMjAifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1070-plan-quarter-rotation`, коммит `e6de76bf015d` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `e51bd9a0210150bba6f56a07d8973e8e7c365ee1`
  ```
  git log --all --format='%H %T' | grep e51bd9a02101
  ```
- Тело issue: `a4a1d33b64f4d91995c87b239420e63fbdd1de801125071d44f476113ebee264`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40559825658,"run_attempt":1,"digest":"d4483093e378ca26ff9ec3dfb63853df26538bab5715cac505d76c8fe4e69d05"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTA2LCJvdXRwdXRfdG9rZW5zIjozMTY5MSwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoyMTczMjQsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo3NzYxNTg0LCJjb3N0VXNkRXN0aW1hdGUiOjIuNzM4NzM0OH1dLCJ0dXJucyI6NjIsImR1cmF0aW9uTXMiOjQ1MTk2OSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjIuNzM4NzM0OCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=106 output_tokens=31691 cache_creation_input_tokens=217324 cache_read_input_tokens=7761584 num_turns=62 -->
