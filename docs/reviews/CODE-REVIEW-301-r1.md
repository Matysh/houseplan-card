# CODE-REVIEW-301-r1

Issue: #301 — «Add search/filter to entity selector for doors, windows and other openings»
Этап: code (S7-code-review) · заход r1 · блокирующих циклов 0/2
Проверено на: ветка `issue/301-opening-entity-search`, HEAD `56dbb488`
(`fix: keep opening picker semantics accurate` `13219307`, `feat: search opening entity selectors` `8b4730df`
поверх `dev`@`19332a91`, тот же SHA, на котором ТЗ получило зелёный вердикт).

Это первый засчитанный код-ревью раунд (`заход r1`, `блокирующих циклов 0/2`) — разбор полный, разделы
«Закрытие раунда r<N-1>» и «Унаследовано из r<N-1>» не применяются: предыдущие циклы принадлежат этапу
spec, а не code, у стадий разный бюджет (`AGENTS.md`, «Cycles are counted per stage»).

## Скоуп

Диалог свойств проёма (дверь/окно/ворота/открытый проём): нативные `<select>` для контакта и замка
заменены на существующий паттерн `dropbtn`/`droppanel`/`candlist` с текстовым поиском по
`friendly_name`/`entity_id`. Кандидаты и их порядок (дверные `device_class` первыми у контактов) не меняются,
формат `opening.contact`/`opening.lock` не меняется. Закрывает J4/J6 из `docs/SCOPE.md` (поддержание точного
плана в больших инсталляциях) — без конфликта с продуктовой рамкой и с лок-инвариантом (замок только
привязывается, путь актуации не создаётся).

## Как проверялось

Прочитаны: `docs/SCOPE.md`, `AGENTS.md`, `PROCESS.md` (§2.7, §2.9/2.10, §4, §7, §8, §12), тело issue #301 и все
десять комментариев (пять ТЗ-итераций и обмен из-за сбоя автоматического ревью на споте — все находки
предыдущего этапа закрыты авторм, зелёный вердикт spec получен на `dev`@`fd4fc801`), `docs/USER-GUIDE.ru.md`
(раздел про проёмы, до и после правки).

Код: `git log --oneline origin/dev..HEAD` (3 коммита) и `git diff origin/dev...HEAD` построчно —
`src/houseplan-card.ts` (тип `_openingDialog`, `_toggleOpeningEntityPicker`/`_filterOpeningEntities`/
`_selectOpeningEntity`, замена `opt()` на `picker()`, ветки `contact`/`lock`/`passage`), `src/logic.ts`
(`filterOpeningEntityCandidates`), `src/styles.ts`, `src/i18n/{en,ru}.json`, `scripts/mutation-gate.mjs`,
`test/opening-entity-search.test.mjs`, `demo/smoke_opening_entity_search.mjs`, оба CHANGELOG,
`docs/USER-GUIDE.ru.md`, `docs/TESTING.md`. Отдельно прочитаны и сверены с диффом `_contactCandidates`
(`houseplan-card.ts:12875`, дверные классы первыми, без пересортировки после диффа), `_lockCandidates`
(`:12892`), `_saveOpening` (`:12755`) — подтверждено чтением, что запись `o.contact`/`o.lock` не изменилась
(`o.contact = d.contact || null; o.lock = ... d.lock || null`), `_editOpening`/место создания проёма (`:12550`,
`:12572`) — новые поля `contactOpen/contactFilter/lockOpen/lockFilter` всегда стартуют `undefined`, старое
состояние между разными открытиями диалога не протекает.

### Гейты — что прогнано и почему

Всегда (дёшево, прогнаны на HEAD):
- `npx tsc --noEmit` — чисто.
- `npm test` — 1290 pass / 0 fail / 1 skip (без изменений в счёте, ожидаемо).
- `npm run build` + сверка трёх копий бандла (`dist/houseplan-card.js`,
  `custom_components/houseplan/frontend/houseplan-card.js`, `demo/srv/assets/houseplan-card.js` через
  `npm run bundle:sync`) — байт-в-байт идентичны, `git status` после пересборки чист.
- `node scripts/check-docs.mjs` — обязателен, диф трогает `src/**`: «Documentation checks passed (7 files,
  10 external links)».
- `node scripts/mutation-gate.mjs --check` — все 5 новых мутантов задачи (`opening-search-filter-dead`,
  `opening-search-name-only`, `opening-search-order-resorted`, `opening-search-hides-none`,
  `opening-search-select-not-wired`) — `ok`, наряду с остальными существующими мутантами репозитория.
  Это же служит доказательством «тест умеет падать» для `filterOpeningEntityCandidates` и для смока —
  guard-команды мутантов запускают именно unit-тесты/смок задачи и ловят внесённый дефект.

Инварианты модели (`npm run invariants`) — **не прогонялись, сознательно**: диф не трогает геометрию,
рёбра комнат, `layout`, `marker.space`, `open_spans` или записи толщины стен — только представление выбора
сущности в диалоге и чистую функцию фильтрации массива `{value,label}`. Правило #254 не применяется.

Браузерные смоки — выбор по `node scripts/smoke-select.mjs --base origin/dev --head HEAD`:
- Новый `demo/smoke_opening_entity_search.mjs` (назван в плане тестов ТЗ) — прогнан, все 16 проверок `true`:
  фильтр по имени и по `entity_id`, сохранение порядка (дверные первыми), пункт «нет» первым и всегда
  доступен, пустой результат, выбор/сохранение контакта и замка, формат `opening.contact`/`opening.lock`
  не изменился, `passage` по-прежнему без пикеров привязки.
- «Прямое совпадение» (называют изменённые символы `_contactCandidates`/`_lockCandidates`):
  `demo/smoke_opening_binding.mjs`, `demo/smoke_registryless_opening.mjs` — прогнаны, оба `OK` без изменений
  в наборе проверок.
- «Зарегистрированная связь» (общий символ `_openingDialog`, 11 смоков) — инструмент явно предупреждает, что
  это не обязанность прогонять. Прочитаны все 11 названий; выбраны и прогнаны два с содержательным риском
  для этого диффа: `demo/smoke_inert_openings.mjs` (лок-инвариант/View-режим — диалог правится, стоило
  перепроверить, что интерактивность вне Plan-режима не задета) и `demo/smoke_partition_openings.mjs`
  (использует тот же `_saveOpening`/`_editOpening` путь для проёмов на перегородках) — оба `OK`. Остальные
  девять (`smoke_dialog_footer_width`, `smoke_grid_scale_invariance`, `smoke_grid_snap`,
  `smoke_isometric_live_touch`, `smoke_open_passage`, `smoke_opening_inner_distances`,
  `smoke_opening_measure`, `smoke_opening_preview`, `smoke_opening_entity_search` уже отдельно) не прогнаны:
  связь только через тип поля черновика диалога (`_openingDialog`), новые ключи в нём опциональны и не
  читаются нигде за пределами правленных веток рендера/`_saveOpening`/`_editOpening` — геометрия,
  измерения, изометрия и предпросмотр этого черновика не касаются.

`npm run golden:verify` — **не прогонялся**: ни один golden-сценарий (`demo/golden/*.mjs`) не открывает
`_openingDialog` (`grep` по `_editOpening`/`_openingDialog` в `demo/golden/` пуст) — они снимают только
холст (символы проёмов на плане), который этот диф не меняет. Диалог свойств — не часть golden-снимков.

`python -m pytest tests_backend` — не прогонялся, диф не трогает `custom_components/**/*.py` (только
скомпилированный фронтенд-бандл внутри интеграции, класс D).

Perf-профили — не названы в AC, не запускались; влияние на производительность явно заявлено в ТЗ (O(n)
локальный фильтр по уже сформированному массиву, кап 200, без debounce) и правдоподобно при чтении кода —
`filterOpeningEntityCandidates` не делает ничего дороже `Array.filter`+`slice`.

## AC — разбор

| AC | Доказательство по ТЗ | Проверено | Итог |
|---|---|---|---|
| AC1 контакт ищется по имени | unit+smoke | `test/opening-entity-search.test.mjs` тест 1, смок `contactOrderPreserved`/`searchByEntityId` | Выполнен |
| AC2 находит и по `entity_id` | unit+smoke | unit тест 2 (запрос по id находит запись, чьё имя не совпадает), смок `searchByEntityId` | Выполнен |
| AC3 регистр/пробелы не влияют | unit | unit тест 3 (`'  GARAGE door  '`) | Выполнен |
| AC4 «нет» видно всегда, очищает | unit+smoke | смок `emptyStateKeepsNoneFirst`+`noneClearsContact` (пункт «нет» умышленно вне фильтруемого массива в `filterOpeningEntityCandidates`, поэтому отдельного unit нет — это описано в самом ТЗ) | Выполнен |
| AC5 замок ведёт себя как контакт | smoke | смок `lockSearchWorks`/`lockSelectedAndClosed`, чтение: `picker()` общий для обоих | Выполнен |
| AC6 порядок и приоритет сохраняются | unit+smoke | unit тест 1 (пустой запрос) + мутант `opening-search-order-resorted`, смок `contactOrderPreserved` (дверные впереди motion-сенсора после фильтра) | Выполнен |
| AC7 формат сохранения не меняется | smoke | смок `savedSameFields`, чтение `_saveOpening:12755` (`o.contact = d.contact \|\| null`, без изменений) | Выполнен |
| AC8 пустой результат → `marker.nothing_found`, «нет» доступен | smoke | смок `emptyStateKeepsNoneFirst` | Выполнен |

Дополнительно закрыты пункты контракта, не входящие в нумерованные AC, но явно требуемые ТЗ:
- п.4.2 автофокус не форсируется — смок `openDoesNotForceFocus`; подтверждено чтением: `picker()` не содержит
  `autofocus`/`.focus()` на открытие панели.
- п.4.2 вторичная подпись `entity_id` видна в каждой строке — смок `rowsExplainEntityId` +
  `closedButtonExplainsEntityId`; чтение `houseplan-card.ts:19519-19521` (`<span class="cs">${candidate.value}</span>`).
- п.4.4 лимит 200 после фильтрации, не 40 — unit тест 4 (240 кандидатов → 25 при явном лимите), чтение
  `filterOpeningEntityCandidates` (`filtered.slice(0, Math.max(0, limit))`, дефолт `200`) и вызовов
  `picker()` без переопределения лимита.
- «Не входит» (п.5 ТЗ): правил отбора кандидатов (`_contactCandidates`/`_lockCandidates`) диф не касается —
  подтверждено чтением, изменений в этих методах нет за пределами их вызова из `picker()`.

## Одно число — один источник

В диффе нет новой видимой пользователю величины (площадь, счётчик, процент, подпись рядом с превью) —
только строковые `friendly_name`/`entity_id`. Закрытая кнопка (`selectedLabel`) и строка кандидата берут имя
из одного и того же списка `list` (`_contactCandidates()`/`_lockCandidates()`), с одним и тем же фолбэком
(`hass.states[...].attributes.friendly_name` → `_fullRegistryHass.entities[...].name` → сам `id`) — два места
отображения одной сущности читают общий источник, второго независимого источника имени нет. Гейт
`test/single-source-numbers.test.mjs` прошёл в общем прогоне `npm test`, содержательных дублей чисел здесь
не создаётся — раздел применим формально, находок нет.

## Что проверено и корректно

- Три копии бандла синхронны, TS компилируется, полный юнит-набор зелёный.
- Мутанты задачи (5 шт.) ловят ровно те регрессии, которые описаны в их `because`, и используют реальные
  unit/smoke-команды проекта.
- `_openingDialog` новые поля (`contactOpen`/`contactFilter`/`lockOpen`/`lockFilter`) не протекают между
  открытиями диалога (оба места создания черновика — `:12550`/`:12572` — строят объект с нуля) и сбрасываются
  при смене типа проёма (`contactOpen: false, lockOpen: false` на каждый `radio change`).
- Переключение контакт/замок-панелей взаимоисключающее (`_toggleOpeningEntityPicker` закрывает вторую панель),
  как и в трёх существующих `droppanel`-инстансах — согласованное поведение, не новый паттерн.
- `passage` по-прежнему не получает ни один из двух пикеров — подтверждено чтением условий рендера и смоком
  `passageStillHasNoBindingPickers`.
- Трейлеры: `feat`-коммит несёт `User-Visible: yes` и правит оба changelog в этом же коммите; `fix`/`docs`-
  коммиты — `User-Visible: no`, обоснованно (внутренняя правка разметки без нового поведения; обновление
  снимков документации).
- `docs/USER-GUIDE.ru.md` обновлён словами интерфейса («поле выбора», «— нет —», «entity_id»), без
  изобретённой терминологии; строка непротиворечива с таблицей настроек проёма выше по файлу.
- Лок-инвариант (`docs/SCOPE.md`) не затронут: `_saveOpening` пишет `lock` как и раньше, путей актуации не
  добавлено; `smoke_inert_openings.mjs` подтверждает интерактивность диалога ограничена Plan-режимом.

## Чего не проверял и почему

- `npm run invariants` — диф не геометрический (см. выше).
- `npm run golden:verify` — ни один golden-сценарий не открывает диалог проёма; холст не меняется.
- `python -m pytest tests_backend` — Python-код не тронут.
- 9 из 11 «слабых» смоков по общему символу `_openingDialog` — прочитаны по названию и решению не прогонять:
  геометрия/измерения/изометрия/предпросмотр не читают новые опциональные поля черновика.
- Ручное тестирование в браузере (вне смока) не выполнялось — по правилам этапа его в цикле ревью нет;
  роль замены — смоки и код-чтение выше.

## Находки

Нет High. Нет Medium. Нет Low. Реализация точно соответствует финальной редакции ТЗ, все восемь AC и
дополнительные пункты контракта закрыты воспроизводимо (unit/smoke/чтение кода с указанием строк), гейты
дёшевы и прогнаны либо осознанно пропущены с причиной.

## Вердикт

Зелёный. Основание: полное соответствие ТЗ #301 (доказано по каждому AC), все обязательные гейты (`tsc`,
`npm test`, сборка+сверка трёх копий, `check-docs`, `mutation-gate --check`) чистые, прямые смоки и выбранные
по риску слабые смоки зелёные, трейлеры и changelog в порядке, лок-инвариант и продуктовая рамка не задеты.
