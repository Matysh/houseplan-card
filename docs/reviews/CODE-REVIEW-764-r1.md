# CODE-REVIEW-764-r1

Issue: #764 · заход r1 · трек `track:show` · блокирующих циклов использовано 0 из 2
Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`
**SHA: `fec2fadd77eb65d49ace0166e037d6ce136a1478`** (рабочая копия на нём, подтверждено `git rev-parse HEAD`)
Validate на этом SHA: зелёный — https://github.com/Matysh/houseplan-card/actions/runs/37549940597

## Скоуп

Один коммит `fec2fadd` (`fix(space-card): key markers and opening symbols by
space and id (#764)`). Карточка `houseplan-space-card` (read-only, `src/space-render.ts`,
`renderSpaceStatic`): маркеры устройств и символы проёмов рисовались голым
`.map()` — Lit переиспользовал DOM-узел по позиции в списке, и при смене
состава списка (смена пространства через `setConfig`, конфигурационное
событие с сервера) узел прежнего объекта доставался новому, запуская CSS-
переход (`.op-leaf`/`.op-arc`, `.device-core`) от чужого состояния. Контракт —
тот же, что у основной карточки (#525/#534) и у комнат той же карточки
(#745): `keyed(space.id, repeat(list, (x) => x.id, ...))`.

Правка:
- `src/space-render.ts:651` — маркеры: `iconDevs.map(...)` →
  `keyed(space.id, repeat(iconDevs, (d) => d.id, ...))`.
- `src/space-render.ts:937-938` — символы проёмов: `resolvedHosted.map(...)` →
  `keyed(space.id, repeat<ResolvedPartitionOpening>(resolvedHosted, (resolved, index) =>
  resolved.opening.id || index, ...))`. Фолбэк на индекс для проёма без id —
  тот же приём, что уже применяется в `src/iso-scene-render.ts:414`
  (`String(opening.id || sourceIndex)`), не новый.
- `src/styles/plan.styles.ts` — только комментарий (ссылка на #764 рядом с
  существующей заметкой #742/#745), функциональных изменений CSS нет.
- `demo/smoke_space_card_identity.mjs` (новый) — браузерный свидетель AC1/AC2.
- `scripts/mutation-registry.mjs` — три новых мутанта с guard'ом на этот смок.
- `scripts/smoke-links.mjs` — связь `renderSpaceStatic` → смок.
- `docs/testing-notes/mutation-browser-guards.md` — счётчики 105→108,
  244→247 (сверено прогоном, см. «Как проверялось»), плюс три новых id в
  алфавитном списке.
- `docs/CHANGELOG.md` / `docs/CHANGELOG.ru.md` — пользовательская запись.

AC1/AC2/AC3 (тело issue) — работа идёт по развилке AC2 (симптом подтверждён,
исправление сделано), не AC3 (закрытие без правки). Нового UX, полей конфига,
миграции, i18n — нет, геометрия/Glow не затронуты, что соответствует
ограничению ТЗ.

## Как проверялось

Дешёвые гейты (`typecheck`, `npm test`, `npm run build` + `bundle-policy
--verify`) подтверждены зелёным Validate на этом SHA — не перегонялись.

Прогнано лично в этом раунде (SHA `fec2fadd`):

| Гейт | Команда | Результат |
|---|---|---|
| Сборка перед смоком | `npm run build` | зелёный, `tsc --noEmit` прошёл как часть |
| Синхронизация бандла стенда | `node scripts/bundle-sync.mjs` | ОК (без неё смок падает на 404 ассета — не относится к диффу, инфраструктура стенда) |
| Целевой смок (витрина AC1/AC2) | `node demo/smoke_space_card_identity.mjs` | **OK** на исправленном коде: `pathANoForeignTransition`, `pathANoNodeOutlivesTheSwitch`, `pathAEveryFrameShowsTheObject`, `pathBNoNodeSwapped`, `pathBNoForeignTransition`, `pathBEveryFrameShowsTheObject`, `onlyTheChangedObjectsAnimate` — все `[]`; `realChangeKeepsTheDoorNode`/`aRealDoorChangeStillAnimates`/`aRealLightChangeStillAnimates` — `true` (обратная половина контракта: настоящая смена состояния по-прежнему анимируется на том же узле) |
| Свидетель умеет падать | тот же смок на `src/space-render.ts` версии `origin/dev` (до правки), остальной код — версии задачи | **FAILED (6)**: `pathANoForeignTransition`, `pathANoNodeOutlivesTheSwitch`, `pathAEveryFrameShowsTheObject`, `pathBNoNodeSwapped`, `pathBNoForeignTransition`, `pathBEveryFrameShowsTheObject` — непустые списки чужих переходов/переиспользованных узлов, числа в этом прогоне совпадают по порядку с теми, что автор привёл в коммите (16 transitionrun path A / 35 path B) |
| `scripts/mutation-gate.mjs --check` | (без исполнения мутантов — не гоняются на `show`) | browser guards 247/200 — WARN по ориентиру, ожидаемо и задокументировано; 4 предупреждения реестра — все существовавшие до этой задачи (`#650`, naming-pattern), ни одно не добавлено этой веткой |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | — | зарегистрированная связь `src/space-render.ts` → `demo/smoke_space_card_identity.mjs` найдена и совпадает с записью в `smoke-links.mjs`; второй файл (`src/styles/plan.styles.ts`) триггерит файловую связь на `smoke_room_fill_transitions.mjs` (ожидаемо, правка там — только комментарий) |
| `node scripts/process-gate.mjs --issues` | — | гейт пройден, предупреждений 0 |
| Трейлеры коммита | `git log -1` | `Issue: #764`, `User-Visible: yes` — есть; оба changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правлены в этом же коммите |
| Число, видимое дважды | ручная сверка | счётчик гардов в `docs/testing-notes/mutation-browser-guards.md` (105→108 Custom-element раздел, 244→247 Total) — один источник, сверен прогоном `mutation-gate --check` выше: 247/200 совпадает |

После ручного прогона working tree возвращён в исходное состояние
(`npm run bundle:clean`, сверено `git status --short` — пусто).

## Чего не проверял

- **Golden.** Метки `ci:golden` на задаче нет; `golden:verify` не прогонялся.
  Правка меняет путь отрисовки плана (`space-render.ts`), поэтому это
  фиксируется прямо, а не тихо опускается. Риск низкий и по сути оценён:
  (а) DOM и статический вид списка без смены его состава не меняются —
  правка только про то, какой DOM-узел получает элемент списка при
  пересборке, а не что рисуется в статике; (б) это подтверждено нулевым
  диффом `plan.styles.ts` по CSS (только комментарий) и отсутствием ожидания
  "изменения статичных кадров" в самом ТЗ (AC3); (в) golden-сцен с карточкой
  пространства, по утверждению автора, не существует вовсе — значит, даже
  затребовав `ci:golden`, проверить нечем. Это согласуется с правилом
  «запись в "чего не проверял"», а не находка.
- **pytest tests_backend / HA harness.** Диффа в Python и конфигурации нет —
  не относится к этой задаче.
- **Инварианты модели (`npm run invariants`).** Диффа в геометрии/ссылках на
  неё нет (только идентичность списков рендера) — не относится.
- **Performance.** Не назван в AC, не обязателен к прогону.
- **Полный `npm test`/мутации всего реестра** — не перегонял повторно:
  зелёный Validate на этом же SHA уже их покрыл (#343); исполнение мутантов
  на `track:show` не требуется в принципе (ночной прогон, #709) — я проверил
  только то, что защита названа мутантом в реестре и что `mutation-gate
  --check` синтаксически согласован, не саму поимку.
- **Ручное тестирование в браузере (вживую, не смоком)** — не проводилось;
  закрыто целевым браузерным смоком выше, который управляет настоящим
  элементом `houseplan-space-card` через Playwright и читает вычисленные
  стили, что эквивалентно по целям ручному тестированию этого сценария.

## Находки

Нет.

## Что проверено и корректно

- **AC1 (свидетель подтверждает симптом на исходном dev).** Лично
  воспроизведено: смок, прогнанный на `src/space-render.ts` версии
  `origin/dev`, красный по шести утверждениям с конкретными списками чужих
  переходов и переиспользованных узлов — не тавтология, свидетель умеет
  падать.
- **AC2 (исправление ограничено идентичностью списков, старая анимация
  жива).** Оба списка переведены на `keyed(space.id, repeat(..., id, ...))`
  — тот же контракт, что в #525/#534/#745, подтверждено чтением кода и
  зелёным целевым смоком после правки. Обратная половина контракта (реальная
  смена состояния того же объекта по-прежнему анимируется на том же узле)
  проверена отдельными утверждениями смока (`realChangeKeepsTheDoorNode`,
  `aRealDoorChangeStillAnimates`, `aRealLightChangeStillAnimates`) — не
  заявлена, а зелёная.
- **Фолбэк id проёма на индекс** (`resolved.opening.id || index`) — не новый
  приём: совпадает с существующим `String(opening.id || sourceIndex)` в
  `src/iso-scene-render.ts:414`. Риска рассинхронизации с остальным кодом
  нет.
- **Защитный AC доказан таблицей «чем краснеет».** Три мутанта в
  `scripts/mutation-registry.mjs`, у каждого назван guard
  (`demo/smoke_space_card_identity.mjs`) и сценарий (`because`): маркеры без
  ключей, проёмы без ключей, проёмы без внешнего ключа пространства (кейс
  одинакового id на разных этажах). Пустого столбца нет. Патчи мутантов
  (`find`/`replace`) сверены построчно с текущим файлом — совпадают
  дословно, значит применятся корректно при ночном прогоне.
- **Трейлеры и changelog.** `Issue: #764`, `User-Visible: yes`; оба
  changelog правлены тем же коммитом, формулировки по-русски и по-английски
  говорят об одном и том же поведении.
- **Объём правки соответствует ТЗ.** Геометрия, Glow, конфиг, i18n, новый
  UX-контракт не затронуты — соответствует ограничению ТЗ «не затрагивать
  геометрию/Glow».
- **Число, видимое дважды** (счётчик гардов 108/247 в
  `docs/testing-notes/mutation-browser-guards.md`) имеет один источник —
  сверено прогоном `mutation-gate --check`, расхождения нет.

## Критерии трека show (route)

Задача проходит все перечисленные критерии §5:
- `complexity` — правка двух мест в одном файле на известном, трижды уже
  применённом в проекте шаблоне (`keyed`+`repeat`); сложность/риск низкие.
- `surfaces` — одна поверхность: рендер read-only карточки пространства
  (`renderSpaceStatic`).
- `migration` — нет миграции конфига, нет новых compatibility-полей.
- `ux-contract` — поведение (идентичность DOM-узла при смене списка)
  зафиксировано для той же карточки в #525/#534/#745; здесь оно
  распространяется на два ранее пропущенных места того же компонента, новый
  контракт не вводится.
- `perf-touch` — не затрагивает touch-контракт; отдельный
  performance-гейт не требуется (AC3 явно исключает).
- `undocumented` — ожидаемое поведение зафиксировано контрактом
  #525/#534/#745 (комментарий `plan.styles.ts` прямо на него ссылается) и
  AC2 этого issue.

`route: fix`.

## Вердикт

Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/764-space-card-keyed-markers`, коммит `fec2fadd77eb` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `e9d8900071b365ffa319e1a0f7122ba9428b70bd`
  ```
  git log --all --format='%H %T' | grep e9d8900071b3
  ```
- Тело issue: `b5d52228591f8e8027fed55c9871c0136ae9f537d17dd08053b181b50e48a772`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4587 output_tokens=18959 cache_creation_input_tokens=85370 cache_read_input_tokens=3754960 num_turns=52 -->
