# CODE-REVIEW-179-r2

- **Issue:** https://github.com/Matysh/houseplan-card/issues/179
- **ТЗ:** `docs/specs/179-device-icons-redesign.md` (зелёное SPEC-REVIEW r2)
- **Диапазон:** `origin/dev..HEAD` — ровно один коммит, `9daa2e9` («fix: align
  device compatibility guards and vacuum puck»). `origin/dev` уже стоит на
  `6fdb7dc` — весь материал из CODE-REVIEW-179-r1 (зелёный, `48bcdaf` и далее)
  туда слит; r2 проверяет только delta сверху.
- **Ревьюер:** Claude (свежая сессия, без контекста реализации r1/r2)
- **Вердикт:** зелёный · цикл r2/4 · High: 0 · Medium: 0

## Скоуп

Автор объяснил в комментарии к issue: r1 был зелёным и слит, но параллельный
полный smoke-прогон нашёл 7 существующих guard-смоков, которые ещё читали
старую подложку `.dev` напрямую (до редизайна `48bcdaf` фон/бордер маркера были
на самом `.dev`, после — на дочерних `.device-core`/`.device-shell`). При их
актуализации всплыл реальный, а не тестовый, дефект: живой vacpuck пылесоса не
получил обновлённую тему пакета (light/dark core, обводка, тень), хотя
действующий (до-#179) контракт «пылесос выглядит как базовая иконка устройства,
только круглая и меньше» — `docs/USER-GUIDE.ru.md` и комментарий в
`src/styles.ts` («owner's wording: «иконка похожа на иконку базы, только
круглая и чуть меньше»») — привязывает его вид к базовому маркеру. Редизайн
базового маркера изменил это «оригинал», а vacpuck не подтянулся — это пробел
именно в объёме #179, не посторонняя находка.

Диапазон (`git diff --stat origin/dev...HEAD`, 16 файлов) состоит из:
- `src/houseplan-card.ts`, `src/styles.ts` — применение существующего
  `deviceThemeClass()` к `.vacpuck` и его CSS-блока (core/stroke/shadow теперь
  зеркалят `.device-shell`/`.device-core` из r1, а не старые `--hp-bg`/`--hp-line`/
  `--shadow-1` токены);
- 7 demo-смоков (`smoke_cover_no_plate`, `smoke_cover_plate_precedence`,
  `smoke_hidden_flag`, `smoke_icon_scale`, `smoke_infinite_canvas`,
  `smoke_motion_sense`, `smoke_vacuum`) — assertions переориентированы на новую
  DOM-структуру и текущие тайминги/значения (например, длительность continuous
  pulse `2.4s → 3.6s` — уже принятая r1 величина, эти смоки её просто не знали);
- 3 сгенерированных копии бандла (`dist/`, `custom_components/.../frontend/`,
  `demo/srv/assets/`) — класс D, следствие правки styles/houseplan-card;
  1 doc-скриншот (`docs/images/06-device-display-preview.png`) и
  `docs/images/screenshots.json` (весь `sourceFingerprint` пересчитан, как и
  ожидается при любой правке `src/`);
  оба changelog.
- Посторонних правок вне этого плана не найдено.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | green |
| Unit | `npm test` | 930 tests, 930 pass, 0 fail, 0 skip |
| Build + bundle parity | `npm run build && cmp` (все 3 копии) | green, побайтово идентичны — прогонялось дважды (до и после mutation-gate), оба раза чисто |
| Docs fingerprint | `node scripts/check-docs.mjs --external` | green, 7 files, 10 external links |
| Process gate (офлайн) | `node scripts/process-gate.mjs` | green, диапазон = 1 коммит, 0 предупреждений |
| 7 целевых compatibility-смоков (ровно то, что чинит коммит) | `node demo/smoke_cover_no_plate.mjs`, `smoke_cover_plate_precedence.mjs`, `smoke_hidden_flag.mjs`, `smoke_icon_scale.mjs`, `smoke_infinite_canvas.mjs`, `smoke_motion_sense.mjs`, `smoke_vacuum.mjs` | все 7 green, лично прогнаны |
| Регрессия mutation-guards из r1 (тот же styles.ts) | `node scripts/mutation-gate.mjs --id=device-unavailable-hover-restored` / `--id=device-marker-lqi-low-boundary-shifted` / `--id=device-long-value-ellipsis-restored` / `--id=device-keyboard-bypasses-click-path` | все 4: чистый прогон зелёный, мутант красный — гейты пережили этот диф без деградации |
| `--check` реестра мутаций | `node scripts/mutation-gate.mjs --check` | все 20 патчей, включая 4 device-, ложатся ровно один раз |

**Гейты НЕ прогонялись, и почему:**

- Полный `node scripts/mutation-gate.mjs` (без `--id`) и полный browser-smoke
  набор (127 файлов) — диф касается ровно одной подсистемы (device marker +
  vacpuck) и её уже известного набора зависимых смоков; все 7 задетых смоков
  прогнаны лично, полный набор — предрелизный гейт (PROCESS.md §8).
- `npm run golden:verify` — grep по `demo/golden/` не нашёл ни одного сценария,
  завязанного на vacpuck; визуальный риск ограничен цветами core/shell, которые
  дословно совпадают с уже принятым в r1 (`golden`-проверенным) пакетом
  `.device-shell`/`.device-core` (тот же `border: 1px solid #BCBCBC` и тот же
  `box-shadow: 0 1px 2px rgb(37 40 45/12%), 0 4px 8px -1.07px rgb(37 40 45/18%)`
  — сверено построчно, см. ниже). Полный набор — предрелизный гейт.
- `python -m pytest tests_backend -q` — Python-код не тронут.
- Performance-профили — диф не добавляет новых подписок/наблюдателей (только
  CSS custom properties и класс-строка), числового бюджета в AC для этого
  фикса не названо; предрелизный гейт.
- **Мутационная проверка вручную** (временный откат `deviceThemeClass()` на
  `.vacpuck` в `src/houseplan-card.ts` и повторный прогон `smoke_vacuum.mjs`)
  была задумана, но заблокирована системой разрешений — ревьюеру запрещено
  редактировать продуктовый код (роль в PROCESS.md §6: «Ревьюер кода… Не имеет
  права: править продуктовый код»). Вместо этого проверено чтением: и
  `smoke_cover_no_plate.mjs`, и `smoke_vacuum.mjs` сверяют точные
  `getComputedStyle(...).backgroundColor`/`.borderTopColor` со значениями,
  которые совпадают только при наличии обеих правок (тема + пакетный
  shell/shadow) — вернуть старые токены (`var(--hp-bg)`, `var(--shadow-1)`)
  сломало бы именно эти сравнения, не давая тесту пройти «случайно».

## Находки

Нет High и Medium. Два Low, оба решены на месте без правки кода (запись ниже).

- **Low-1 (снят).** Формальный трейс: `docs/specs/179-device-icons-redesign.md`
  не упоминает vacpuck ни в одном AC — эта правка не была частью исходного ТЗ.
  Не поднимаю как Medium «вне скоупа», потому что решение задокументировано
  самим владельцем в комментарии issue («реальный пробел… vacpuck оставался на
  старых theme colors») и находится внутри той же поверхности, что и #179
  (единственная причина, по которой vacpuck вообще имеет цветовой контракт —
  «выглядит как базовая иконка», а базовую иконку поменял именно #179). Формальной
  правки ТЗ (новый AC15) не внесено — при следующей правке этого маркера стоит
  дописать его в §8 ТЗ, но блокировать r2 из-за отсутствия строки в уже принятом
  документе не за что: issue как канонический источник (`PROCESS.md`, преамбула)
  фиксирует то же решение.
- **Low-2 (снят).** RU changelog («Живой маркер робота-пылесоса использует те
  же цвета темы, обводку и тень») не использует уже устоявшийся в
  `docs/USER-GUIDE.ru.md` термин «puck» (там прямо: «живой puck»,
  «движущийся puck», строки 649/828/879/1153). EN-версия термин использует
  верно («The live vacuum puck…»). Смысл фразы не искажён и путаницы у
  пользователя не создаёт, поэтому не блокирую; для единообразия в следующей
  правке лучше сказать «живой puck пылесоса».

## Проверено и корректно

- **Тема vacpuck.** `.vacpuck` теперь объявляет `--vac-core-bg`/`--vac-core-fg`
  через `light-dark(#fff, #252525)` с явным переопределением
  `.vacpuck.theme-light`/`.vacpuck.theme-dark` — тот же паттерн (тот же
  `light-dark()` fallback + классовое переопределение), что уже принят и
  проверен для `.dev` в r1 (`--device-core-bg`/`--device-core-fg`,
  `src/styles.ts:1867-1868`); новой техники CSS не введено. `deviceThemeClass()`
  — не новая функция, тот же хелпер из `src/device-face.ts`, который уже
  применяется к `.dev` во всех трёх поверхностях (`houseplan-card.ts`,
  `hp-device-preview.ts`, `space-render.ts`); здесь просто добавлен четвёртый
  вызов на vacpuck. **проверено чтением + smoke (`smoke_vacuum.mjs` green,
  лично прогнан).**
- **Border/shadow parity.** `.vacpuck`: `border: 1px solid #BCBCBC` и
  `box-shadow: 0 1px 2px rgb(37 40 45/12%), 0 4px 8px -1.07px rgb(37 40 45/18%)`
  — построчно идентичны `.device-shell` (`src/styles.ts:1912,1915-1917`),
  сверено дословно. Владельческий контракт «vacpuck = уменьшенная базовая
  иконка» соблюден для нового пакета так же, как соблюдался для старого.
  **проверено чтением.**
- **7 compatibility-смоков.** Прочитаны целиком (не только diff): новые
  assertions измеряют то же самое, что старые (нейтральный/жёлтый/оранжевый
  фон, unlocked-amber, geometry без ellipsis, границы пульсации), но через
  корректный текущий DOM (`.device-core`/`.device-shell` вместо `.dev` — с r1
  фон и бордер физически переехали на дочерние элементы, поэтому старые
  селекторы стали мимо цели, а не «менее строгими»). В одном месте строгость
  даже выросла: `smoke_cover_no_plate.mjs` теперь дополнительно проверяет
  `color === 'rgb(0, 0, 0)'` у закрытого замка (AC4 r1: чёрный glyph), чего
  раньше не было. Убранная «-2px» компенсация границы в
  `smoke_icon_scale.mjs`/`smoke_infinite_canvas.mjs` соответствует факту:
  `.device-core` (`src/styles.ts:1951-1966`) не имеет собственного `border` —
  бордер только на `.device-shell`, значит вычитать пиксель больше не нужно.
  Ни одна проверка не смягчена до тавтологии (`typeof x === 'string'` и т.п.) —
  все сравнивают конкретные `getComputedStyle`-значения. **лично прогнаны, все
  7 green.**
- **Отсутствие побочных правок.** `git diff --stat` ограничен файлами из
  описания коммита; секьюрный lock-инвариант (`docs/SCOPE.md` CR-1) в этом
  диффе не затронут (правка не касается `lockState`/`_clickDevice`/
  `resolveToggleIntent`) — подтверждено чтением, отдельный прогон
  `smoke_lock_*` не требовался, т.к. эти файлы не входят в diff.
  **проверено чтением.**
- **Регрессия r1-мутаций.** Все 4 mutation-guard, введённые в r1
  (`device-unavailable-hover-restored`, `device-marker-lqi-low-boundary-shifted`,
  `device-long-value-ellipsis-restored`, `device-keyboard-bypasses-click-path`),
  лично прогнаны заново на новом HEAD — чистый код зелёный, мутант красный для
  каждого. Правка `.vacpuck` не задела их поведение. **лично прогнано,
  мутация подтверждена исполнением.**
- **Freshness/parity.** `npm run build` дважды (до и после mutation-gate)
  давал побайтово идентичные три копии бандла — сборка не расходится с тем,
  что закоммичено, и mutation-gate корректно восстанавливает файлы после себя
  (`git status` пуст после каждого прогона). `check-docs.mjs --external` зелёный
  — screenshot fingerprint (`docs/images/screenshots.json`) актуален относительно
  нового `src/`. **лично прогнано.**
- **Трейлеры и процесс.** Единственный коммит `9daa2e9` несёт `Issue: #179` и
  `User-Visible: yes`; оба changelog правятся в этом же коммите (RU и EN),
  соответствует правилу «правки в оба changelog в том же коммите».
  `process-gate.mjs` (офлайн) — 0 предупреждений на диапазоне из 1 коммита.

## Чего не проверял

- Полный `golden:verify`, полный browser-smoke набор (127), полный
  mutation-gate без `--id`, `performance_smoke`, `pytest tests_backend` —
  предрелизный гейт по PROCESS.md §8, диф не расширяет их необходимость
  (обосновано выше по каждому пункту).
- Мутационную проверку самой правки `.vacpuck` не выполнил исполнением
  (запрещено редактировать продуктовый код в роли ревьюера) — заменено разбором
  точных значений в assertions (см. «Как проверялось»).
- Визуальную приёмку `docs/images/06-device-display-preview.png` глазами не
  делал — доверился зелёному `check-docs.mjs --external` (фингерпринт
  подтверждает, что скриншот пересобран из текущего кода, а не устарел);
  единственный байт разницы в размере файла для полноценной ревизии PNG
  не даёт повода подозревать регрессию.

## Итог

Единственный коммит диапазона (`9daa2e9`) — точечный compatibility-фикс внутри
уже принятого объёма #179: обновляет 7 существующих guard-смоков под новую DOM-
структуру маркера из r1 и приводит vacpuck в соответствие с той же темой/пакетом
shell, что уже получил основной маркер. Оба изменения проверены построчным
сравнением с уже отревьюенными в r1 значениями (не с нуля), все 7 задетых
смоков и 4 унаследованных mutation-guard лично прогнаны и зелёные. Секьюрный
lock-инвариант не затронут. High: 0, Medium: 0; два Low сняты с записью
(отсутствие формального AC15 в ТЗ — компенсировано решением владельца в issue;
RU-терминология «маркер» вместо устоявшегося «puck» — не искажает смысл).
Задача уходит в очередь на пре-релиз.
