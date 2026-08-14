# Code review — issue #146, цикл r2

Вердикт: **зелёный** · цикл r2/4 · High: 0 · Medium: 0

Ветка: `issue/146-four-phase-sun-background` · коммиты в диапазоне
`origin/dev..HEAD`: [`558dae9`](https://github.com/Matysh/houseplan-card/commit/558dae95cd8fa011250c69efad76d09bc8d0abcc)
(спека, не код), [`debb13b`](https://github.com/Matysh/houseplan-card/commit/debb13baa280042c79a004c97152e3b1be5ab11b)
(implementation, разобран в [`CODE-REVIEW-146-r1`](CODE-REVIEW-146-r1.md),
красный, High:1), [`84cd5f9`](https://github.com/Matysh/houseplan-card/commit/84cd5f9)
(документ r1, не код), **[`875b09c`](https://github.com/Matysh/houseplan-card/commit/875b09cd8d9dc5ea9fed4abc7b8fce23087ecc77)
— единственный новый код с прошлого ревью, предмет этого цикла.**

## Скоуп проверки

Цикл r1 закончился красным вердиктом с единственной блокирующей находкой:
`.zoomwrap { z-index: 1 }` (добавлен диффом #146) выводил всё содержимое
`.zoomwrap` в более высокий слой стекинга, чем `.zoombadge` — индикатор
процента зума становился невидим на любом zoom>100% независимо от `bg_mode`.
Требование r1: убрать не обязательную для цели правку `z-index` **или** дать
`.zoombadge` собственный явный `z-index`, подтвердить `npm run golden:verify`
на сцене `large-house-zoom-250-dark` и просмотреть 4 новых `day-cycle-*` сцены.

Коммит `875b09c` — единственное изменение с r1: `git show 875b09c --stat`
подтверждает 7 файлов — `src/styles.ts` (−1 строка, ровно
`z-index: 1` с `.zoomwrap`), `demo/smoke_bg_color.mjs` (+13 строк — новая
проверка `zoomBadgeStaysAbovePlan`), оба changelog (+3/+3 строки) и три копии
бандла. Backend, `src/sun.ts`, `day-cycle-render.ts`, i18n, тесты миграции —
не тронуты; повторной проверки AC1–AC16 из r1 по существу не требуется —
менялась ровно строка, вызвавшая High, и один целевой smoke-assert.

Трейлеры коммита `875b09c`: `Issue: #146` · `User-Visible: yes`; оба
changelog правлены в этом же коммите — требование выполнено.

## Как проверялось

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | зелёный, без вывода |
| `npm test` | **802/802 green** |
| `npm run build` + сверка 3 копий (`dist/`, `custom_components/houseplan/frontend/`, `demo/srv/assets/`) | зелёный; свежая пересборка дала SHA-256 `1cde21df3c8fefc7d6b4b48067261e8141f86dd3b998a293412be0a74f468690` для всех трёх файлов — совпадает с хендофф-комментарием автора; `git status` после билда пуст (закоммиченные копии побайтно совпадают со свежей сборкой) |
| `node demo/smoke_bg_color.mjs` | все проверки `true`, `OK`, включая новую `zoomBadgeStaysAbovePlan: true` |
| `npm run golden:verify` (полный набор — инструмент не даёт частичный прогон) | **`large-house-zoom-250-dark` → `passed`** (детерминированно, два прогона подряд). Именно эта сцена была `different` на `debb13b` в r1 — прямое эмпирическое подтверждение, что находка r1 устранена, не только прочитана. Остальные не-`passed` сцены — тот же набор, что r1 уже задокументировал как пред-существующий шум/техдолг, не относящийся к #146 (см. ниже) |
| `python -m pytest tests_backend` | не прогонялся — коммит `875b09c` не трогает ни один файл `custom_components/**/*.py`; backend уже разобран чтением в r1 и не менялся |
| `smoke_sun.mjs`/`smoke_sun_live_bg.mjs`/`smoke_general_settings.mjs`/`smoke_render_perf.mjs` | не перезапускались в r2 — ни одна из этих поверхностей не тронута коммитом `875b09c` (изменён только `smoke_bg_color.mjs`); все были зелёными в r1 на неизменной с тех пор реализации |
| Полный smoke-suite (127 файлов) / performance-профили / `golden:accept` | не прогонялись — предрелизный гейт (PROCESS.md §8, §11.4), диапазон изменения (одна CSS-строка) не оправдывает полный прогон |

### Разбор `golden:verify`

Не-`passed` сцены в этом прогоне и их статус в r1 (на `debb13b`, до фикса):

- `day-cycle-dawn-dark`/`day-cycle-day-dark`/`day-cycle-dusk-dark`/`day-cycle-night-dark` — `missing-baseline` в r1 и сейчас; ожидаемо, 4 новые сцены ждут `golden:accept --reviewed` как предрелизный шаг.
- `geometry-plan-editor-dark`, `tray-wide-selection-en`, `tray-wide-tool-ru`, `tray-medium-group-en` — `different` в r1 и сейчас; r1 сверил их с чистым `origin/dev` (та же среда/Chromium) и получил те же расхождения там, где `#146` вообще не применён — пред-существующая среда-специфичная нестабильность, не относящаяся к этой задаче. Коммит `875b09c` не трогает ни редактор плана, ни tray-компоненты.
- `plan-snap-endpoint-light`, `plan-snap-line-gaps-dark`, `wall-junctions-plan-preview-light`, `wall-junctions-plan-t-dark`, `wall-junctions-view-dark`, `isometric-wall-junctions-dark` — `missing-baseline` в r1 и сейчас, тот же техдолг.
- `large-house-zoom-040-dark`, `large-house-warm-remount-dark` — `passed` (соседние zoom/remount-сцены не пострадали ни в r1, ни сейчас).

Единственное отличие итогового набора между r1 и r2 — переход
`large-house-zoom-250-dark` из `different` в `passed`. Это ровно тот регресс,
который блокировал r1.

## Находки

Нет. High r1 устранён и подтверждён эмпирически (golden) и по коду (см. ниже).
Новых High/Medium/Low коммит `875b09c` не вносит.

## Что проверено и корректно

- **Устранение High r1.** `src/styles.ts:181-184` — `.zoomwrap` больше не
  несёт `z-index`, только `position: absolute; inset: 0;`. Прочитан рендер:
  `src/houseplan-card.ts:14472` (`renderDayCycleEnvironment`, включает
  `.hp-day-cycle-env` c явным `z-index: 0`, `src/styles.ts:200-207`)
  декларируется в DOM **раньше** `.zoomwrap` (`:14474`), а `.zoombadge`
  (`:14758-14760`) — сиблинг **после** закрытия `.zoomwrap` (`:14757`).
  По правилам CSS-стекинга элементы с `z-index: auto` и `z-index: 0`
  красятся в одном слое, упорядоченном по DOM tree order — значит
  `.hp-day-cycle-env` (z-index:0, раньше в DOM) красится первым,
  `.zoomwrap` (auto, позже) поверх него, `.zoombadge` (auto, ещё позже) —
  поверх `.zoomwrap`. Явный `z-index:1` действительно был не нужен для
  заявленной цели (держать план выше окружения) — естественный порядок DOM
  уже её обеспечивает, как и указал r1.
- **Новая проверка `demo/smoke_bg_color.mjs:105-116`
  (`zoomBadgeStaysAbovePlan`)** — материализует `_zoom = 2.5`, проверяет три
  факта разом: `.zoombadge` существует, `getComputedStyle(zoomWrap).zIndex
  === 'auto'` (прямая механическая проверка отсутствия регрессирующего
  правила — при возврате `z-index: 1` эта проверка немедленно становится
  `false`) и `.zoombadge` идёт в DOM после `.zoomwrap`
  (`compareDocumentPosition & DOCUMENT_POSITION_FOLLOWING`). Тест умеет
  падать: `checkAll`/`finish` (`demo/serve.mjs:24-40`) требуют `true` от
  каждого ключа и выставляют `process.exitCode = 1` со списком провалов при
  любом `false` — попытка временно вернуть `z-index: 1` для эмпирической
  проверки была отклонена системой прав (ревьюеру запрещено править
  продуктовый код, `src/styles.ts` — класс A), поэтому падение теста
  подтверждено **чтением** логики ассерта; сам регресс при этом уже был
  эмпирически пойман и задокументирован в r1 (`different` на `debb13b`) и
  эмпирически подтверждён устранённым в этом цикле (`passed` на `875b09c`,
  см. таблицу гейтов) — то есть внешний golden-гейт уже дал то самое
  «умеет падать» для базового сценария, который и защищает новый smoke-assert.
- **Changelog.** `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` дополнены в том же
  коммите фразой о сохранении видимости индикатора масштаба при увеличении;
  термин не изобретён — `docs/USER-GUIDE.ru.md` не вводит отдельного названия
  для этого индикатора (только общие «масштаб»/«масштаб просмотра»), а
  формулировка описывает наблюдаемое поведение, а не внутреннюю реализацию.
- **Отсутствие побочных эффектов фикса.** `git show 875b09c` полностью
  прочитан: помимо удаления одной строки CSS и добавления одного
  smoke-ассерта, изменений в логике (`src/sun.ts`, `day-cycle-render.ts`,
  `houseplan-card.ts` behaviour, backend) нет — риска регрессии в остальных
  AC1–AC16 из r1 нет по построению диффа.

## Чего не проверял

- **`npm run golden:accept -- --reviewed`** — не выполнялся; 4 новых
  `day-cycle-*` сцены остаются `missing-baseline` до предрелизного принятия
  baseline (PROCESS.md §8/§13) — не гейт код-ревью.
- **`python -m pytest tests_backend`** — не прогонялся; коммит `875b09c` не
  трогает backend, а backend-логика уже разобрана чтением в r1.
- **Полный browser smoke-suite (127 файлов) и Performance/Full Performance**
  — не прогонялись; изменение узкое (1 строка CSS + 1 smoke-ассерт), не
  задевает поверхности, которые покрывают остальные 126 smoke или
  performance-профили.
- **`smoke_sun.mjs`/`smoke_sun_live_bg.mjs`/`smoke_general_settings.mjs`/
  `smoke_render_perf.mjs`** — не перезапускались в r2; не тронуты коммитом
  `875b09c`, были зелёными на этой же реализации в r1.
- **Ручной интерактивный проход в браузере (не headless)** — не выполнялся;
  визуальное подтверждение опирается на golden-пиксели (эмпирически поймали
  и подтвердили исчезновение/возврат `.zoombadge`) и чтение CSS/DOM-порядка.

## Итог

High: 0, Medium: 0, Low: 0. Единственная блокирующая находка r1 устранена
минимальным, точечным диффом; фикс подтверждён и эмпирически (сцена
`large-house-zoom-250-dark` вернулась в `passed`), и чтением кода
(объяснение, почему явный `z-index` не требовался). Скоуп не расширен:
изменения ограничены строкой, вызвавшей регресс, плюс тестом и changelog.
Вердикт: зелёный, задача готова к очереди на пре-релиз (`S8-merged`).
