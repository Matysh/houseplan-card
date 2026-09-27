# CODE-REVIEW-228-r2

- Issue: [#228](https://github.com/Matysh/houseplan-card/issues/228) — надёжное рисование стен и операции с готовым контуром
- ТЗ: `docs/specs/228-plan-drawing-problems.md` (ревью ТЗ зелёное, r1, #228)
- Ветка: `issue/228-plan-drawing-problems`
- Коммит реализации r1: `2aaef12` (`fix: make plan drawing fail closed`)
- Коммит фикса r2: `172d5d7` (`fix: close plan repair review findings`, `Issue: #228`, `User-Visible: yes`)
- Заход ревью: r2 · блокирующих циклов израсходовано 1 из 4 (r1 был жёлтым и списал единицу; настоящий заход разбирает дельту по §2.10 PROCESS.md / issue #214)
- Ревьюер: Claude (код-ревью), сессия без контекста реализации и без контекста r1-ревью

## 0. Предыдущий раунд и SHA

Вердикт r1 найден в комментарии issue
([issuecomment-5379067039](https://github.com/Matysh/houseplan-card/issues/228#issuecomment-5379067039)):
жёлтый · заход r1 · блокирующих циклов 1/4 · High: 0 · Medium: 2 (M1, M2, обе в
скоупе). Полный документ — `docs/reviews/CODE-REVIEW-228-r1.md` (в дереве на
этом SHA, коммит `9540627`).

**Замечание к процессу, не к коду:** сам текст вердикта в комментарии issue SHA
не называет — только «Документ: …». SHA восстановлен из шапки документа
(«Коммит реализации: `2aaef12`») и из хендоффа автора чуть выше
(«Реализация: 2aaef12») и хендоффа фикса чуть ниже («предыдущий проверенный
SHA 2aaef12 → фикс 172d5d7»), так что дельта для этого раунда однозначна:
`git diff 2aaef12..172d5d7` (= `git diff 2aaef12..HEAD`, `HEAD` этой ветки —
`172d5d7`). Это не блокирует разбор, но стоит перенести в шаблон вердикта:
именование SHA явно, а не только через ссылку на документ.

Ребейза не было: `git merge-base origin/dev HEAD` не изменился относительно
диапазона задачи, `2aaef12` не достижим из `origin/dev` (задача просто ещё не
слита) — код, проверенный в r1, и код на этом SHA продолжают одну и ту же
историю без переписывания. Дельта локальна, полный разбор не требуется по
§2.10/§7.2 AGENTS.md.

## 1. Скоуп проверки — дельта r1→r2

`git diff --stat 2aaef12..172d5d7`: 10 файлов, +420/−24.

Продуктовый код — только `src/houseplan-card.ts` (+17/−9, две точки:
`_offerExistingWallFace` и `_validateWallRepair`) и новый экспорт в
`src/wall-face-repair.ts` (+15, чистая функция `repairMovesHostedPartition`).
Тесты — `test/wall-face-repair.test.mjs` (+22/−2, новый unit-тест) и
`demo/smoke_plan_drawing_repairs.mjs` (+29, два новых сценария). Остальное —
три синхронные копии бандла, оба changelog (RU+EN, `User-Visible: yes` в том
же коммите) и сам `docs/reviews/CODE-REVIEW-228-r1.md`, добавленный в дерево
отдельным коммитом `9540627` между r1 и фиксом.

Дельта задевает ровно AC6/AC7/AC8 (repair ≤2 см, негативная матрица, room
dialog) и §8.6 ТЗ — те же строки, что и обе находки M1/M2 из r1. Ни одна
другая поверхность (snap-overlay, strict-Shift, delete-room dialog,
room-deletion transaction) не тронута — их AC (AC1–AC5, AC9–AC14) наследуются
из r1 без повторной проверки, раздел 4.

## 2. Как проверялось — гейты

Дешёвые гейты прогнаны полностью (стоят минуты, код изменился):

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| Unit | `npm test` | `# tests 1032 / # pass 1032 / # fail 0 / # skipped 0` (на 1 больше, чем в r1 — ровно новый тест `repairMovesHostedPartition`) |
| Build | `npm run build` | зелёный, `dist/houseplan-card.js` собран за ~12s |
| Синхронность бандла | `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` и `cmp … demo/srv/assets/houseplan-card.js` | обе копии побайтно идентичны, `git status` после сборки чист |
| Named smoke (дельта) | `node demo/smoke_plan_drawing_repairs.mjs` | 16/16 `true`, `OK` |

Дополнительно, специально для дисциплины «тест умеет падать» (§8 PROCESS.md,
это условие честности сокращения гейтов на дельте): временно откатил
`src/houseplan-card.ts` и `src/wall-face-repair.ts` к состоянию `2aaef12`,
пересобрал, скопировал бандл в `demo/srv/assets/` и повторно прогнал тот же
smoke — рабочее дерево затем восстановлено к `HEAD` и пересобрано, `git
status` чист.

- на коде до фикса `ambiguousLargeGapUsesWallsFlow` → **`false`** (упал), все
  остальные 15 проверок остались `true`. Это прямое доказательство того, что
  проверка M2 фальсифицируема и действительно закрывает найденный дефект, а не
  переформулирует его условие.
- `hostedOpeningBlocksRepair` на коде до фикса остался `true`: ожидаемо — сам
  инлайновый guard (`if (proposal.sourceKey.startsWith('static:partition|'))
  …`) в `2aaef12` был по чтению кода уже корректен, M1 была находкой про
  **отсутствие доказательства**, а не про баг в логике (это прямо
  сформулировано в M1 из r1: «Guard … по чтению кода верен … Но ни один тест
  не воспроизводит этот случай»). Для этой находки доказательство падения даёт
  прямой unit-тест на извлечённую функцию: `repairMovesHostedPartition` в
  `2aaef12` не существовала вовсе (`grep` по старому файлу — 0 совпадений),
  поэтому импорт этой функции в `test/wall-face-repair.test.mjs` на коде до
  фикса завершился бы ошибкой сборки/импорта, а не тихим прохождением. Тест
  падать умеет, просто не через тот же smoke-сценарий, а через прямой unit.

**Чего не прогонял и почему:**

- `smoke_plan_snap_overlay.mjs`, `smoke_unified_wall_tool.mjs` — прогнаны в r1
  зелёными (34/34, 19/19), дельта r1→r2 не касается ни snap-overlay, ни
  strict-Shift кода; наследуются без повторного прогона (раздел 4).
- `npm run golden:verify`, полный smoke-набор (127 файлов), `pytest
  tests_backend`, performance-профиль — как и в r1: diff не меняет ни один
  существующий видимый кадр (правки чинят внутреннюю ветку без нового
  рендера), ни один `.py`-файл не тронут, задача не задевает все поверхности.
  Полные наборы — предрелизный гейт (§8 PROCESS.md), не гейт ревью; причины не
  изменились с r1 и заново не переоцениваю их для дельты, которая эти
  поверхности не трогает.

## 3. Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **M1** — AC7 требует `unit + smoke` для «invalid hosted opening», guard в `_validateWallRepair` (houseplan-card.ts:12673, на SHA `2aaef12`) существовал, но не был воспроизведён ни одним тестом | Guard вынесен в именованную экспортируемую чистую функцию `repairMovesHostedPartition` (`src/wall-face-repair.ts:29-40`), покрытую прямым unit-тестом с тремя ветвями (совпадающий host, несовпадающий host/kind, не-partition `sourceKey`); плюс сквозной smoke-сценарий `hostedOpeningBlocksRepair`, который проводит `_offerExistingWallFace` → `_saveRoom()` через реальный hosted-opening на дистанции 1,2 см и проверяет, что `_curSpaceCfg` не изменился и показан именно `toast.wall_repair_changed` | `src/wall-face-repair.ts:29-40` (функция); `test/wall-face-repair.test.mjs:53-70` (unit, 3 ветви); `demo/smoke_plan_drawing_repairs.mjs:104-118` (smoke); вызов на Create-пути — `src/houseplan-card.ts:12674-12676` внутри `_validateWallRepair`, дёргается из `_applyWallFaceBatch` (`:12777`) |
| **M2** — широкая (>2 см, screen-scale) диагностика в `_offerExistingWallFace` не различала `diagnostic.kind === 'repair'` и `'ambiguous'`; при ambiguous клик перехватывался и подсвечивался произвольный `proposals[0]` вместо обычного Walls flow (§8.6 ТЗ) | Условие сужено с `if (diagnostic.kind !== 'none')` до `if (diagnostic.kind === 'repair')`; при `'ambiguous'` код больше не входит в ветку, падает через к `if (!face …) return false;` — обычный Walls flow, без toast, без подсветки, без перехвата клика | `src/houseplan-card.ts:7684` (изменённое условие); regression-сценарий `ambiguousLargeGapUsesWallsFlow` в `demo/smoke_plan_drawing_repairs.mjs:94-102`, воспроизведён как падающий на коде до фикса (раздел 2 выше) |

Обе находки закрыты фактическим кодом и тестом, который умеет падать (M2 —
прямым воспроизведением регресса; M1 — прямым unit-тестом на извлечённую
функцию), а не заявлением автора. Хендофф автора
([issuecomment-5379081221](https://github.com/Matysh/houseplan-card/issues/228#issuecomment-5379081221))
совпадает с тем, что видно в дельте.

## 4. Унаследовано из r1

Без повторной проверки в этом раунде, полностью на основании
`docs/reviews/CODE-REVIEW-228-r1.md` (в дереве на SHA `9540627`,
предмет разбора там — SHA `2aaef12`, тот же код в этих AC дельтой r2 не
тронут):

- **AC1–AC4** (активная ось/узел на текущем отрезке, fail-closed на
  неоднозначных endpoint, strict-Shift через точное пересечение луча, цвет
  подписи по точному вектору) — `src/plan-snap-overlay.ts`, `src/logic.ts`
  (`isExact45Vector`), рендер `.active-axis`/`.active-vertex`. Дельта r1→r2 не
  трогает ни один из этих файлов.
- **AC5/AC8** (комната из готового контура, `Shift+click` bypass,
  create-existing-face сохраняет партиции) — кроме уточнённой в M2 ветки
  широкой диагностики, остальная логика `_offerExistingWallFace` и
  `findWallFaceAtPoint`/`wall-face-graph.ts` не менялась.
- **AC9** (диалог удаления через `hp-dialog`, не `confirm()`) — `src/houseplan-card.ts`
  вне тронутого дельтой диапазона строк, `src/room-deletion.ts` не в diff.
- **AC10–AC12** (Keep/Delete walls материализация и rehost, атомарность
  Undo, fail-before-mutation порядок) — `src/room-deletion.ts` не в diff r2.
- **AC13–AC16** (View не регрессирует, touch/gesture guard не тронут, perf-путь
  не заходит в hover, backend/schema не тронуты) — ни один из названных в r1
  файлов (`src/houseplan-card.ts:_svgPointerMove`, `custom_components/**/*.py`)
  не в diff r2.
- **AC17** (гейты/i18n/changelog/документация уровня r1) — новые i18n-ключи в
  дельте не добавлялись (использован уже существующий `toast.wall_repair_changed`,
  проверено `grep` — есть в обоих `src/i18n/*.json` и не создан в этом диффе);
  changelog RU+EN обновлён именно в фикс-коммите `172d5d7` с точными формулировками
  под M1/M2 (см. раздел 5).

Основание для наследования: дельта `2aaef12..172d5d7` не задевает ни один файл
и ни одну строку, от которых зависят перечисленные AC — проверено `git diff
--stat` (раздел 1) и точечным чтением затронутых строк (раздел 3). Это не
«не проверялось», а «проверено в r1 на коде, который здесь не менялся».

## 5. Дополнительно проверено в этом раунде

- Оба changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правлены в том же
  коммите `172d5d7`, что и код, с `User-Visible: yes` — трейлеры на коммите
  корректны (`Issue: #228`, `User-Visible: yes`). Текст обеих правок точно
  называет оба закрытых поведения: «ambiguous wider gaps remain ordinary
  drawing» (M2) и «a wall carrying a hosted opening is never moved by repair»
  (M1) — формулировки не обобщают и не расходятся с кодом.
- `repairMovesHostedPartition` вызывается из `_validateWallRepair`, которая
  используется на **обоих** путях подтверждения repair —
  `_applyWallRepair` (одиночный, `:12685`) и `_applyWallFaceBatch` (через
  `repairs[0]`, `:12777`) — оба реально достижимы из `_saveRoom`/`_offerExistingWallFace`
  флоу, guard не обходится ни одним из них.
- Оставление предложения (`_offerExistingWallFace`) hosted-репейра без
  немедленного отказа и отказ только на Create — соответствует ТЗ §8.6
  дословно («Room dialog не применяет repair заранее. Create повторно
  проверяет … hosted openings»), это не новый пробел, а сознательный
  двухфазный контракт, уже заложенный в ТЗ и подтверждённый в r1.
- Тестовый счётчик: r1 зафиксировал `1031 pass`, здесь `1032 pass` — разница
  ровно на 1 новый unit-тест M1, без скрытых удалений/пропусков (`0 skipped`,
  расходится с хендоффом автора «1 skipped», как и в r1 — этот разброс не
  влияет на вердикт, оба прогона зелёные).

## 6. Чего не проверял

- Всё, что унаследовано из r1 (раздел 4) — не переисполнялось повторно; список
  причин не изменился и заново не переоценивался, кроме подтверждения, что
  соответствующие файлы вне дельты.
- `npm run golden:verify`, полный (127 файлов) smoke-набор,
  `python -m pytest tests_backend`, performance-профиль — не запускал в этом
  раунде; причины совпадают с r1 (раздел 2) и дельта их не меняет: новых
  видимых кадров нет, `.py` не тронут, задача не задевает все поверхности.
  Это предрелизный гейт (§8 PROCESS.md, §11.4 AGENTS.md), не гейт ревью.
- Многопользовательский конкурентный сценарий и touch-специфичные жесты для
  repair-пути — не переисполнялись; вывод r1 («чтением, не исполнением») не
  затронут дельтой, которая не трогает `_markupClick`-обёртку или
  multi-client код.

## 7. Вердикт

Обе Medium-находки r1 закрыты кодом и тестом, способным падать; никаких новых
находок в дельте не обнаружено. High — 0, Medium — 0.

Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0

Готово к очереди на пре-релиз (`S8-merged`).
