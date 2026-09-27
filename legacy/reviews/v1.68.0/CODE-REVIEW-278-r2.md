# CODE-REVIEW-278-r2

- **Issue:** https://github.com/Matysh/houseplan-card/issues/278
- **Этап:** код-ревью, заход r2, блокирующих циклов израсходовано 1/4 (потрачен r1 — жёлтый вердикт; зелёный вердикт бюджет не тратит, #227)
- **Проверяемый диапазон:** дельта `49504379..79285ab1` (r1 SHA `495043791e0fa916708f832248f13dfacf23dbdc` → HEAD `79285ab1d2f3b413a7fa54fb77ff47dd9dbfb2cd`), ветка `issue/278-wall-union-isolation`
- **Спецификация:** `docs/specs/278-wall-union-isolation.md` (зелёное ревью ТЗ, r2)
- **Вердикт:** зелёный · High: 0 · Medium: 0

## Скоуп раунда

r1 (`docs/reviews/CODE-REVIEW-278-r1.md`) вернул жёлтый вердикт с единственной
Medium-находкой M1: `docs/TESTING.md` называл 4 из 5 mutation-id для чек-листа
#278 неточно (несовпадение с реестром `scripts/mutation-gate.mjs`), что делало
канонический тест-чеклист нечитаемым машиной и вводящим в заблуждение
человеком — нарушение AC15.

Дельта r1→r2 — ровно два коммита:

- `c123757f` — публикация документа `CODE-REVIEW-278-r1.md` (инфраструктурный
  шаг конвейера, класс C, не авторский код);
- `79285ab1` — правка автора: 4 неточных id в `docs/TESTING.md` заменены на
  точные имена реестра.

Продуктовый код (`src/**`), тесты, фикстуры, golden-эталоны, backend — не
затронуты. Дельта строго локальна: `git diff --stat 49504379..79285ab1`
показывает изменения только в `docs/TESTING.md` (6 строк) и в самом
опубликованном документе ревью. `dev` не ушёл вперёд между раундами
(`origin/dev` — предок HEAD, ребейза не было), новая подсистема не задета,
контракт поведения не менялся. Основание для полного разбора (§2.10) —
ребейз, смена контракта, новая подсистема, сопоставимый с задачей объём —
отсутствует. Объём разбора этого раунда сокращён до дельты и AC15, которую
она задевает.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **M1** — `docs/TESTING.md` называет 4 из 5 mutation-id неточно (`isolated-wall-extra-discarded`, `strict-accepts-degraded`, `wall-thickness-writer-bypasses-barrier`, `invariants-bypasses-production-geometry` — не совпадают с реестром) | Коммит `79285ab1` заменяет все 4 id на точные имена: `wall-isolated-extra-discarded`, `strict-wall-barrier-accepts-degraded`, `wall-thickness-writer-bypasses-common-barrier`, `model-invariants-bypasses-production-geometry` | `git show 79285ab1 -- docs/TESTING.md`; лично сверено построчно с выводом `node scripts/mutation-gate.mjs --list` — все 5 id чек-листа (включая ранее верный `wall-component-failure-kills-primary`) присутствуют в реестре дословно, без допусков |

## Унаследовано из r1

Без повторной проверки — техническая часть контракта и все AC, доказательство
которых дельта не задевает — принято по выводу `docs/reviews/CODE-REVIEW-278-r1.md`
на SHA `495043791e0fa916708f832248f13dfacf23dbdc`:

- типизированный structural result (`ok`/`degraded-extra`/`failed-core`/
  `not-applicable`), per-extra transactional изоляция, `components[]` —
  AC1–AC3;
- render-safe проекция и parity потребителей (Plan/View, Static, hidden Iso,
  Glow/light barrier, sun) — AC4–AC5;
- единый strict commit barrier для всех geometry writers, откат, 0 WS/Undo
  при отказе, toast — AC6–AC9;
- production model-invariants на реальной команде (плохая/валидная фикстура)
  — AC10;
- регрессии #197/junction/fail-dark — AC11;
- реестр 5 mutation-id целостен и один живьём воспроизведён (`--check`,
  ручной мутант `degraded-extra`→`failed-core` ломает
  `smoke_wall_union_isolation.mjs`) — AC12 (частично, как и в r1: 4 из 5
  подтверждены чтением, не прогоном `--id=`, см. «Чего не проверял» ниже);
- performance-бюджеты §13 — AC13;
- зелёные tsc/test/build/bundle-сверка/смоки на SHA r1, полный `golden:verify`
  (108/108) — AC14;
- CHANGELOG RU/EN, USER-GUIDE RU/EN, WALL-THICKNESS.md, ARCHITECTURE.md,
  CANVAS.md, STATUS.md — точны, терминология соответствует
  `docs/USER-GUIDE.ru.md` — часть AC15, не связанная с `TESTING.md`.

Эти выводы не переоценивались заново в r2: дельта их доказательства не
задевает (ни один изменённый байт не лежит в `src/**`, тестах или фикстурах).

## Как проверялось в r2

Дешёвые гейты прогнаны заново (§2.10: они гоняются в каждом раунде, код
изменился и стоят минуты):

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| Unit | `npm test` | 1204/1204 pass, 0 fail, 0 skip |
| Build + 3 копии бандла | `npm run build && npm run bundle:sync` + `cmp` `dist/`, `custom_components/houseplan/frontend/`, `demo/srv/assets/` | все три побайтово идентичны; `git status --porcelain` чист после сборки |
| Docs fingerprint | `node scripts/check-docs.mjs` | «Documentation checks passed (7 files, 10 external links)» (диф не трогает `src/**`, гейт не обязателен, но дешёвый — прогнан) |
| Точечная проверка M1 | `node scripts/mutation-gate.mjs --list` + построчная сверка с `docs/TESTING.md` | все 5 id AC15-чек-листа совпадают дословно |
| `smoke-select.mjs` по дельте | `node scripts/smoke-select.mjs --base 49504379 --head HEAD` | «Исполняемого frontend-диффа нет… Browser-smoke этим диффом не выбираются» — выбирать нечего, диф не трогает `src/**`, тесты и фикстуры |
| Commit-трейлеры | `git show -s --format="%B" 79285ab1` | `Issue: #278`, `User-Visible: no` — корректно: чистая правка документации для разработчиков, не меняющая пользовательское поведение, changelog не требуется |
| Ребейз/дрейф `dev` | `git merge-base --is-ancestor origin/dev 79285ab1` | true — `dev` не ушёл вперёд между раундами, полный разбор по этому основанию не требуется |

Не запускались повторно (не требуется дельтой и уже пройдены на r1 без
изменений с тех пор): `npm run invariants`, `smoke_wall_union_isolation.mjs`
и соседние geometry-смоки, `benchmark_wall_union_isolation.mjs`,
`npm run golden:verify`, `python -m pytest tests_backend` (backend не
затронут ни разу за весь диапазон #278), `mutation-gate.mjs --id=` живой
прогон — дельта не касается `src/**`, тестов, фикстур или golden-эталонов, а
значит не может изменить их результат.

## Находки

Нет. M1 закрыта точно (см. таблицу выше), новых находок делта не порождает —
изменение состоит из четырёх строковых замен id, каждая сверена дословно с
реестром.

## Проверка AC

AC1–AC14 и часть AC15 (changelog/user/architecture/wall-thickness/canvas/status
docs) — унаследованы из r1 без повторной проверки, дельта их не задевает (см.
«Унаследовано из r1»).

AC15 в части `docs/TESTING.md` — перепроверена заново в этом раунде: ✅.
`docs/TESTING.md` теперь называет для чек-листа #278 ровно те 5 mutation-id,
что существуют в `scripts/mutation-gate.mjs` (сверено `--list`, дословное
совпадение строк, без опечаток и без допуска на разницу в написании).

## «Одно число — один источник»

Дельта не вводит и не меняет ни одной пользовательской величины: правка —
только в id-строках внутреннего тест-чеклиста для разработчиков
(`docs/TESTING.md`), не в пользовательском UI и не в changelog. Правило не
применимо к этой дельте.

## Что проверено и корректно

- Все 4 замены в `docs/TESTING.md` — точные, посимвольно совпадают с именами
  в живом реестре `scripts/mutation-gate.mjs --list`, включая ранее верный
  5-й id `wall-component-failure-kills-primary` (не тронут, и не должен был).
- Коммит `79285ab1` несёт корректные трейлеры (`Issue: #278`,
  `User-Visible: no`) и не расширяет скоуп: единственный тронутый файл —
  `docs/TESTING.md`, ровно тот, что назвала находка M1.
- Дешёвые гейты (tsc/test/build/bundle-сверка) зелёные на итоговом HEAD
  `79285ab1`, что подтверждает: правка документации не сломала ничего в
  продуктовом коде (ожидаемо, поскольку `src/**` не тронут, но проверено, а
  не предположено).
- `dev` не сдвинулся между r1 и r2 — снований для полного разбора вместо
  разбора по дельте (§2.10) нет.

## Чего не проверял

- Не прогонялся живой `mutation-gate.mjs --id=<mutant>` ни для одного из 5
  id — не требуется этим раундом: сами мутанты в `scripts/mutation-gate.mjs`
  не менялись (дельта их не касается), их поведение проверено в r1
  (`wall-component-failure-kills-primary` — вручную и живьём, реестр —
  `--check`); данный раунд правит только текст `docs/TESTING.md`, ссылающийся
  на уже проверенные id.
- Не переигрывались `npm run invariants`, browser-смоки, `benchmark_*`,
  `golden:verify` — дельта не содержит изменений в `src/**`, тестах,
  фикстурах или golden-эталонах, поэтому их результат не может отличаться от
  r1; `smoke-select.mjs` по дельте `49504379..HEAD` подтверждает это
  формально («Исполняемого frontend-диффа нет»).
- `python -m pytest tests_backend` не запускался — весь диапазон #278 (не
  только эта дельта) не трогает `custom_components/houseplan/**/*.py`.
- PNG golden-эталонов не пересматривались повторно — не создавались и не
  менялись в этой дельте; визуальная приёмка была выполнена и задокументирована
  в r1.

## Итог

Единственная находка r1 (M1) закрыта точно и полно: все 4 неточных
mutation-id заменены на дословно совпадающие с реестром имена, дешёвые гейты
зелёные, трейлеры корректны, скоуп не расширен. Дельта строго локальна,
`dev` не ушёл вперёд, оснований для полного разбора нет. Blocking (High)
находок нет, Medium-находок нет. Задача готова к слиянию.
