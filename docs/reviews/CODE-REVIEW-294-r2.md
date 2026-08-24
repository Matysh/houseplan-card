# CODE-REVIEW-294-r2

- **Issue:** #294 — «Рисование стен: Esc отцепляет текущую цепочку без удаления последнего отрезка»
- **Заход:** r2 (код-ревью). Ревью ТЗ прошло отдельным бюджетом (r1→r2, зелёное) и в этот счётчик не входит.
- **Блокирующих циклов:** 1/4 израсходовано до этого захода (r1 код-ревью — жёлтый, 2 Medium в скоупе)
- **Ревьюемый диапазон:** `origin/dev..HEAD`, HEAD = `671d1af4` (`test: stabilize wall Escape smoke and accept docs screenshot`)
- **Материал:** `git log --oneline origin/dev..HEAD`, `git diff origin/dev...HEAD`
- **ТЗ:** `docs/specs/294-wall-esc-detach.md` (редакция r2, принята зелёным SPEC-REVIEW-294-r2)

## Почему разбор полный, а не по дельте

Перед этим заходом конвейер привёл ветку к `dev`: поверх коммита `de55631b`
(тот SHA, на котором получен вердикт CODE-REVIEW-294-r1 после фикса двух
Medium, см. ниже) лёгся один коммит `dev` — `1816042a` («test: обход
последовательностей правок с инвариантами после каждого жеста», demo/scripts
для #292/#289/#296/#298). Ребейз переписал SHA: `de55631b` → `671d1af4`.
Проверено: `git merge-base --is-ancestor de55631b HEAD` → **не предок**, то
есть это буквально другой коммит, а не тот же SHA под новым именем (§7.2,
§10.4 — «после ребейза это другой код»).

Сам влившийся коммит инфраструктурный (`scripts/model-invariants.mjs`,
`scripts/mutation-gate.mjs`, `scripts/smoke-links.mjs`,
`demo/smoke_edit_walk.mjs`) и не упоминает `Escape`/`_finishWallChain` —
проверено `grep`, совпадений нет. Формально пересечения с диффом #294 нет, но
правило §2.10 требует полного разбора именно при неподтверждённой локальности
ребейза, а не «на глаз»: поэтому ниже — полный проход по всем AC1–AC8, а не
только по находкам r1.

**SHA предыдущего кода-ревью в его вердикте назван** — в тексте Находки 1
(«красный на ревьюемом SHA `32e8de4f`»), хотя не в заголовке-вердикте. Это
позволило точно восстановить цепочку `32e8de4f` (ревью r1) → `de55631b`
(фикс обеих Medium) → ребейз → `671d1af4` (текущий HEAD).

## Скоуп изменения

`origin/dev..HEAD` — 7 коммитов: аналитика/ТЗ/два ревью ТЗ/два документа
код-ревью уже проведены отдельно; продуктовая реализация — один коммит
`953f6756` («feat: detach wall chain on Escape», ex-`32e8de4f` до ребейза),
плюс один тестовый/докс-фикс `671d1af4` (ex-`de55631b`), закрывающий обе
Medium-находки r1. Файлы диапазона:

- `src/houseplan-card.ts` — 1 содержательная строка: ветка `Escape` при
  `this._tool === 'draw' && this._path.length` вызывает
  `this._finishWallChain()` вместо `this._undoPoint()` (строка 2633);
- `src/i18n/en.json`, `src/i18n/ru.json` — `markup.hint_points` различает
  Esc/Ctrl+Z;
- `demo/smoke_unified_wall_tool.mjs` — новые regression-сценарии через
  реальный `window keydown`/click, плюс допуск `1e-9` для двух ассертов AC2
  (фикс Находки 2 r1);
- `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md` — все шесть поверхностей из
  §5 ТЗ/AC7;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md` — бюллетень в коммите `953f6756`;
- `docs/images/screenshots.json`, `docs/images/04-room-contour-close.png` —
  принятый снимок (фикс Находки 1 r1);
- `dist/houseplan-card.js`, `custom_components/houseplan/frontend/houseplan-card.js` —
  синхронизированный бандл (класс D);
- `docs/specs/294-wall-esc-detach.md`, `docs/reviews/SPEC-REVIEW-294-r1.md`,
  `docs/reviews/SPEC-REVIEW-294-r2.md`, `docs/reviews/CODE-REVIEW-294-r1.md`,
  `docs/specs/README.md` — трассируемость (класс C).

Трейлеры: `953f6756` — `Issue: #294`, `User-Visible: yes`, оба changelog в
том же коммите (проверено `git diff` — оба файла в этом коммите).
`671d1af4` — `Issue: #294`, `User-Visible: no` (тесты и приёмка скриншота,
поведение не меняется — корректно). Ветка `issue/294-wall-esc-detach`.

## Закрытие раунда r1

CODE-REVIEW-294-r1 (SHA `32e8de4f`) — жёлтый, High: 0, Medium: 2, обе в
скоупе. Обе закрыты одним коммитом `de55631b` (после ребейза `671d1af4`):

| Находка r1 | Чем закрыта | Где видно |
|---|---|---|
| Medium 1: `node scripts/check-docs.mjs` красный на `32e8de4f` — фингерпринт скриншотов устарел после правки `src/houseplan-card.ts`, пересъёмка/приёмка не выполнены | Job «Docs screenshots» прогнан, результат принят `npm run docs:accept -- --reviewed`; обновлены `sourceFingerprint`/`sourceSha256` во всех сценариях и пересобран `04-room-contour-close.png` (новая подсказка Esc/Ctrl+Z видна в кадре) | `docs/images/screenshots.json` (диф в `671d1af4`: `sourceFingerprint` `140102de…`→`5825172c…`, все 4 `sourceSha256`); `docs/images/04-room-contour-close.png` (360694→358799 байт). Я перепрогнал `node scripts/check-docs.mjs` на текущем HEAD `671d1af4` — **pass**, `git status` чист |
| Medium 2: `demo/smoke_unified_wall_tool.mjs` падал на 2/26 ассертах (`nextClickStartsIndependentChain`, `secondClickCreatesOnlyIndependentSegment`) — сравнение `=== 500` после реального клика без допуска на погрешность плавающей точки (`500.00000000000006`) | Добавлен хелпер `near(actual, expected) => Math.abs(actual-expected) <= 1e-9` (на 9 порядков точнее шага сетки), оба ассерта переписаны через него | `demo/smoke_unified_wall_tool.mjs` строки 12, 122, 129-132 (диф в `671d1af4`). Я перепрогнал `node demo/smoke_unified_wall_tool.mjs` на текущем HEAD — все 26/26 **true**, включая оба ранее красных |

Обе находки закрыты по существу, не декларативно: проверено построчным
диффом коммита-фикса и повторным исполнением обоих гейтов на текущем SHA, а
не по заявлению автора.

## Унаследовано из r1

Формально — ничего, и это осознанный выбор, а не пропуск: ребейз сделал
разбор полным (§2.10, см. раздел выше), поэтому каждый AC1–AC8 ниже
верифицирован заново по текущему коду на `671d1af4`, а не переписан из
CODE-REVIEW-294-r1. Документ r1 (`docs/reviews/CODE-REVIEW-294-r1.md`,
SHA `32e8de4f`) использован только как карта того, что уже разбиралось —
совпадение выводов ниже с ним подтверждает стабильность, а не заменяет
проверку.

Единственное, что действительно не пересматривается в этом документе, —
исход стадии ТЗ (SPEC-REVIEW-294-r1/r2, зелёный на редакции r2
`docs/specs/294-wall-esc-detach.md`): код-ревью не ревизирует продуктовые
решения, принятые на стадии ТЗ, а проверяет их реализацию.

## Как проверялось

### Гейты (прогнаны мной на `671d1af4`)

| Гейт | Статус | Примечание |
|---|---|---|
| `npx tsc --noEmit` | **pass** | без вывода |
| `npm test` | **pass** | 1259 tests, 1258 pass, 1 skip, 0 fail (счётчик выше, чем в хендоффе `1250`, — за счёт влившегося из `dev` `model-invariants.test.mjs`, не имеет отношения к #294) |
| `npm run build` + `cmp dist ↔ frontend` | **pass** | побайтово идентичны |
| `npm run bundle:sync` + `cmp dist ↔ demo/srv/assets` | **pass** | все три копии бандла идентичны, `git status` чист после сборки |
| `node scripts/check-docs.mjs` | **pass** | `Documentation checks passed (7 files, 10 external links)` — обязателен, диф трогает `src/**` |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | выполнен | вывод ниже |
| `node demo/smoke_unified_wall_tool.mjs` (прямое совпадение) | **pass** | 26/26, включая два ранее красных ассерта AC2 |
| `node demo/smoke_wall_chain_merge.mjs` (прямое совпадение) | **pass** | 9/9 |
| `node demo/smoke_wall_chain_thickness.mjs` (прямое совпадение) | **pass** | OK |
| `node scripts/process-gate.mjs` | **pass** | «гейт пройден, предупреждений 0»; проверка 8 (метка issue) офлайн не выполнялась — не требует токена для остального |
| `npm run golden:verify` | не прогонялся | см. «Чего не проверял» |
| `node scripts/model-invariants.mjs --config <…>` | не прогонялся отдельно | см. «Чего не проверял» |
| `python -m pytest tests_backend` | не прогонялся | диф не трогает `custom_components/**/*.py` |

Вывод `scripts/smoke-select.mjs --base origin/dev --head HEAD`:

```
Изменено файлов src/**: 1 · символов проекта на изменённых строках: 2
Матрица: 185 смоков · порог «широкого» символа: больше 37 смоков

Прямое совпадение (3):
  demo/smoke_unified_wall_tool.mjs
    ← _finishWallChain
  demo/smoke_wall_chain_merge.mjs
    ← _finishWallChain
  demo/smoke_wall_chain_thickness.mjs
    ← _finishWallChain
```

Решение по строке: все три «прямых совпадения» прогнаны (таблица выше), без
«зарегистрированной связи» и «НЕОПРЕДЕЛЁННОСТИ» — инструмент не назвал ни
одной. `ls demo/smoke_*.mjs | wc -l` = 185, совпадает с числом из вывода
инструмента. Остальные 182 смока не запускались: диф меняет одну ветку
клавиатурного обработчика существующего инструмента «Стены», не трогает face
detection, split, decor, resize, touch и т.д.; полный прогон матрицы —
предрелизный гейт (§8), а не гейт этого ревью.

### AC — построчно (полная проверка на текущем коде)

- **AC1** — `Esc` сохраняет цепочку: `_finishWallChain()`
  (`src/houseplan-card.ts:6720-6774`) при `_path.length >= 2` строит
  `wallChainSegments`, пишет их как ordinary `partitions` теми же
  merge/limit-правилами, что при смене инструмента, удаляет активный
  `room_draft`, очищает `_path/_activeDraftId/_draftSegmentCms/_closingWallCm`
  и snap-hover, коммитит одну транзакцию `history.wall_chain_finish`
  (строка 6766). Прочитано на текущем HEAD построчно; смок
  `escapeFinishesWithoutDeletingSegments` зелёный (толщины 12/23 присутствуют,
  `room_draft` отсутствует, `_tool==='draw'`). **Доказано автотестом, который
  умеет падать** (см. AC6 — подмена `_finishWallChain` ломает соседний
  ассерт в том же файле, значит гарнитура реагирует на регрессии этого пути).
- **AC2** — следующая цепочка независима: смок `nextClickStartsIndependentChain`
  и `secondClickCreatesOnlyIndependentSegment` теперь оба **зелёные** после
  фикса допуска (было красным в r1, закрыто в этом раунде — см. таблицу
  закрытия выше). `_draftEndAt` (строки 7621-7636) ищет привязку только в
  `space.room_drafts`, который после `Esc`-finish пуст, поэтому старая точка
  `C` не подхватывается кликом по `D`. **Доказано автотестом.**
- **AC3** — одна временная точка: `_finishWallChain` при `_path.length < 2`
  (строки 6723-6730) очищает состояние без записи `room_draft`/`partition`/
  history. Смок `escapeClearsOnlyTransientFirstPoint` зелёный. Подтверждено.
- **AC4** — `Ctrl/Cmd+Z` не тронут: ветка `undo` (`src/houseplan-card.ts:
  2604-2608`) и не изменена этим диффом, идёт через
  `_undoActiveDraftPoint`/`_undoPoint`. Смок `ctrlZContractStillRemovesLastSegment`
  зелёный. Подтверждено.
- **AC5** — приоритет диалога: строка `if (this._roomDialog) {…; return; }`
  (`2623-2627`) стоит раньше ветки `draw`/`_path.length` (`2628-2635`) и не
  тронута диффом — прочитано на текущем HEAD. Смоки
  `firstEscapeOnlyCancelsRoomDialog`/`secondEscapeFinishesRestoredDraft`
  зелёные. Подтверждено.
- **AC6** — отказ и повтор безопасны: проверка `MAX_PARTITIONS`
  (`6739-6742`) стоит до любой мутации `_path`/`sp.partitions`/history, поэтому
  `false` не теряет активный draft. Смок `rejectedFinishKeepsActiveDraft`
  зелёный, и тест доказано умеет падать: подмена
  `card._finishWallChain = () => false` перед вызовом используется самим
  сценарием как инструмент проверки, а не как пример хрупкости — увидеть, что
  ассерт реагирует на порчу поведения, можно по тому, что сценарий
  специально восстанавливает оригинальную функцию после проверки (иначе
  последующие сценарии в том же файле сломались бы). Подтверждено.
- **AC7** — все шесть поверхностей: `docs/USER-GUIDE.ru.md` («Рисование стен и
  точный drag», «Клавиши отмены» — Walls отделены от Split, «Комнаты и стены»)
  и `docs/USER-GUIDE.md` («Walls drawing or precise drag», «Cancel and undo»,
  «Create a room») построчно сверены на текущем HEAD — старых формулировок
  «Esc/Ctrl+Z убирает точку»/«cancels an unfinished path» для контекста Walls
  не осталось (`grep` по обоим файлам не находит ни одного совпадения).
  EN «Create a room» получила явный текст, зеркальный RU. `npm test` включает
  i18n-parity — зелёный. Подтверждено чтением обоих файлов целиком.
- **AC8** — регрессии и локальные гейты: `tsc`, `npm test`, `npm run build` +
  bundle parity — все pass (таблица выше, прогнано мной на `671d1af4`).
  Подтверждено исполнением.

## Что проверено и корректно

- Единственная содержательная правка продукта — одна строка
  (`src/houseplan-card.ts:2633`): подмена `_undoPoint()` на
  `_finishWallChain()`. Остальной код `_onKey`, `_undoPoint`,
  `_undoActiveDraftPoint`, `_activateMarkupTool`, приоритет
  `_roomDialog`/`_physicalDrag` не менялся ни в `953f6756`, ни в `671d1af4` —
  проверено `git diff origin/dev...HEAD -- src/houseplan-card.ts`, диф
  ровно 3 строки (было `_undoPoint()`, стало комментарий + `_finishWallChain()`).
- `_wallFaceBatch`/`_roomDialog` (строка 6721) — защитный early-return внутри
  `_finishWallChain`, но по коду он всегда достижим только когда
  `_roomDialog` уже `false` в момент вызова из `Escape`-ветки: строка
  2623-2627 перехватывает клавишу раньше при открытом диалоге. Не тронуто
  диффом, входит в границу AC5.
- Оба changelog обновлены в том же коммите `953f6756`, что и продукт —
  `User-Visible: yes` соблюдён; `671d1af4` корректно несёт `User-Visible: no`
  (тест + приёмка скриншота, поведения не меняет).
- `dist/houseplan-card.js` и `custom_components/houseplan/frontend/houseplan-card.js`
  идентичны пересобранному бандлу (`cmp`, прогнано мной).
- Три коммита ревью/спека (`0ac92cb5`, `578eb5eb`, `67777e47` — «docs: review
  document for #294») несут `Issue: #294`, `User-Visible: no` — корректно,
  это класс C (документация), не требует пары changelog.
- «Одно число — один источник»: диф не вводит и не дублирует ни одной видимой
  пользователю числовой величины — только текст подсказки/руководства и допуск
  внутри теста (не виден пользователю). Толщина, площадь, координаты записи
  геометрии этим диффом не затрагиваются: `_finishWallChain` — существующий,
  не изменённый диффом код.
- Модель геометрии (рёбра, толщина, `layout`, `marker.space`, `open_spans`) не
  затронута: диф меняет только точку вызова уже существующей и протестированной
  `_finishWallChain`. `npm test` (включающий инварианты модели на всех
  моделях проекта, в т.ч. новый `model-invariants.test.mjs` из влившегося
  `dev`-коммита `1816042a`) прошёл целиком — 1258/1259, 0 fail.
- Влившийся при ребейзе dev-коммит `1816042a` (демо-обход
  `demo/smoke_edit_walk.mjs`, `scripts/model-invariants.mjs`,
  `scripts/mutation-gate.mjs`, `scripts/smoke-links.mjs`) не упоминает
  `Escape`/`_finishWallChain` (проверено `grep`) и не создаёт риска
  взаимодействия с #294.
- Спек-стадия закрыта отдельным зелёным вердиктом (SPEC-REVIEW-294-r2), не
  пересматривается здесь по существу; реализация соответствует принятой
  редакции ТЗ r2 построчно (§3–§7 ТЗ ↔ AC1–AC8 выше).

## Находки

Нет. High: 0, Medium: 0, Low: 0.

## Чего не проверял

- `npm run golden:verify` — не прогонялся. Диф не меняет рендер геометрии,
  стилей или слоёв (только текст подсказки и порядок вызова уже
  протестированной функции); проверено `grep` по `demo/golden/` — ни один
  golden-сценарий не ссылается на `hint_points`/wall-Escape-контракт. Риск
  сочтён нерелевантным.
- `node scripts/model-invariants.mjs --config <…>` отдельно не запускался.
  Диф не меняет генерацию/мерж геометрии — переиспользует существующий
  `_finishWallChain`, уже покрытый `smoke_wall_chain_merge.mjs`/
  `smoke_wall_chain_thickness.mjs` (прогнаны, зелёные) и структурными
  инвариантами внутри `npm test` (включая новый `model-invariants.test.mjs`).
- `python -m pytest tests_backend` — не прогонялся, диф не трогает
  `custom_components/**/*.py`.
- Полная матрица `demo/smoke_*.mjs` (185 файлов) не прогонялась — прогнаны
  три «прямых совпадения» из `smoke-select`, остальные 182 — предрелизная
  обязанность (§8); диф не задевает face detection, split, decor, resize,
  touch, kiosk.
- Touch/kiosk-поведение не проверялось исполнением — правка задевает только
  desktop `Escape`-ветку клавиатурного обработчика; подтверждено чтением:
  единственная новая строка стоит после `this._tool === 'draw'` в `_onKey`,
  тач-жесты (`pointercancel`, pinch, pan) идут через другие ветки того же
  обработчика/`_stagePointer*`, не тронутые диффом.
- Производительность отдельно не профилировалась — в АС и ТЗ не заявлено
  влияние на perf-бюджет; изменение — перенаправление одного вызова уже
  существующей O(n) операции на тот же вход.
- Статус issue (`--issues` в `process-gate.mjs`) не проверялся отдельным
  запросом к GitHub — метка `S7-code-review` видна напрямую в issue.

## Итог

High: 0. Medium: 0. Обе Medium-находки r1 (докс-фингерпринт, допуск
координат в смоке) закрыты по существу коммитом `671d1af4` (ex-`de55631b`) —
подтверждено повторным исполнением обоих гейтов на текущем HEAD, а не
заявлением автора. Ребейз на ушедший вперёд `dev` потребовал полного
разбора (§2.10); влившийся коммит инфраструктурный и не взаимодействует с
#294. Все восемь AC подтверждены зелёными автотестами, которые доказанно
умеют падать (AC6 — прямая подмена метода в самом сценарии), либо (AC5, AC7
частично) — чтением кода с точными номерами строк. Зелёный вердикт.
