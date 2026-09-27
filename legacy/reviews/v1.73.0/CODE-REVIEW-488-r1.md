# CODE-REVIEW-488-r1

**Issue:** [#488](https://github.com/Matysh/houseplan-card/issues/488) — панель
`/houseplan` пуста в реальном HA (стейдж 0 px + `hass` не доходит до карточки
при первом заходе).
**Заход:** r1 · блокирующих циклов израсходовано 0 из 2 (лимит §4 для лёгкого
трека — 2 цикла ревью ТЗ; для код-ревью — общий лимит 4, см. §4).
**SHA материала ревью:** `2b2fc944` (проверено `git rev-parse HEAD`
непосредственно перед вынесением вердикта — совпадает с SHA зелёного Validate,
на который ссылается заказчик ревью:
https://github.com/Matysh/houseplan-card/actions/runs/34198029189).
**Диапазон:** `git diff origin/dev...HEAD`, 4 коммита
(`471527c4` fix, `28772133` test, `e97e5681` docs, `2b2fc944` docs).

## Скоуп

Диф правит два независимых, но совместно найденных дефекта монтирования
кастомной панели HA:

1. **Стейдж 0 px.** `<ha-panel-custom>` — блок без собственной высоты; `:host`
   с `height:100%` резолвится в `auto`, вся цепочка схлопывается. Правка берёт
   высоту от viewport: `100vh`, затем
   `calc(100dvh − safe-area-inset-top − safe-area-inset-bottom)`.
2. **`hass` не доходит до карточки при первом открытии** (второй, ранее не
   описанный в теле issue корень — см. «Не заявлено в issue, но обосновано»
   ниже). HA присваивает `panel/hass/narrow/route` элементу сразу после
   `load` модуля, до того как top-level `await import('./houseplan-card.js')`
   даст классу определиться; значения оседают как собственные data-свойства
   инстанса и затеняют accessors. `_adoptPreUpgradeProperties()` в
   конструкторе и `connectedCallback` переносит их через accessors.

Правки: `src/houseplan-panel.ts` (+27/−… строк), новый сценарий в
`demo/smoke_houseplan_panel.mjs` (реальный порядок монтирования HA + хост без
высоты), 2 мутанта в `scripts/mutation-gate.mjs`, обновлённый
`test/houseplan-panel.test.mjs`, `docs/specs/486-house-plan-panel.md`,
`CHANGELOG.md`/`CHANGELOG.ru.md`, пересобранный `dist/**` +
`custom_components/houseplan/frontend/**`, обновлённый
`docs/images/screenshots.json` (только provenance, не сами PNG).

**Не заявлено в issue, но обосновано.** Тело issue в разделе «Причина» называет
только высоту; про затенение accessors — ни слова, хотя раздел «Симптом» прямо
описывает два состояния («первый заход — пустая шапка панели, ни заголовка
карточки, ни плана» и «после возврата — шапка карточки есть, стейдж всё равно
пуст») и сам помечает первое как догадку («вероятно, вуаль… проверить в
исправлении»). Автор нашёл настоящую причину первого состояния (свойства
затенены, `hass` физически не долетает до карточки), задокументировал её в
`docs/specs/486-house-plan-panel.md` тем же коммитом и покрыл тестом и
мутантом. Это не расширение скоупа: раздел «Приёмка» issue требует «план виден
с первого захода» — без фикса затенения это требование не выполняется одной
только высотой. Отношу к находкам не считаю; это корректное закрытие AC, а не
самодеятельность помимо задачи.

## Как проверялось

Дешёвые гейты не перегонялись бы (Validate на этом SHA зелёный), но диф
трогает `src/**` и заявляет два защитных контракта дорогим гейтом (смок) —
это явно требует мутанта и его прогона (§2.7), а «дешёвые» пришлось прогнать
самостоятельно, т.к. `npm run bundle:sync` понадобился для смока (класс D
пересобирается, но не входит в Validate из этого списка проверок отдельно).

| Гейт | Прогнан | Результат |
|---|---|---|
| `npx tsc --noEmit` | да (внутри `npm run build`) | 0 ошибок |
| `npm run build` + `npm run bundle:sync` | да | dist ⟷ custom_components/.../frontend ⟷ demo/srv/assets — `cmp` всех трёх пар без вывода (идентичны) |
| `npm test` | да | `tests 2248, pass 2247, fail 0, skipped 1` (пропуск — приватная фикстура #281, к делу не относится) |
| `node scripts/check-docs.mjs` | да (diff трогает `src/**`) | `Documentation checks passed (7 files, 12 external links)` |
| `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | да | `Новых any нет` (26 добавленных строк в 1 файле) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | да | Вывод: НЕОПРЕДЕЛЁННОСТЬ — символы `PRE_UPGRADE_PROPERTIES`, `_adoptPreUpgradeProperties` не зарегистрированы ни в одном смоке (инструмент не знает про добавленный в этом же диффе `demo/smoke_houseplan_panel.mjs`). Прямое соответствие «правка `src/houseplan-panel.ts` → смок `demo/smoke_houseplan_panel.mjs`» очевидно и без инструмента: единственный смок про панель — этот, и диф его же и расширяет. Прогнан. |
| `node demo/smoke_houseplan_panel.mjs` | да | все 63 проверки `true`/OK, включая новые `haSequence*` и `autoHeightHost*` |
| `node scripts/mutation-gate.mjs --id=panel-ignores-pre-upgrade-properties` | да | `panel-ignores-pre-upgrade-properties: тест покраснел, как обязан` (1/1) |
| `node scripts/mutation-gate.mjs --id=panel-host-height-from-parent` | да | `panel-host-height-from-parent: тест покраснел, как обязан` (1/1) |
| `npm run golden:verify` | да (diff меняет CSS-высоту хоста панели, видимый результат под вопросом) | 60/60 `passed`, 0 упавших; без панель-специфичного baseline (харнес и так фиксирует высоту хоста — подтверждено чтением `demo/golden/`) |
| `python -m pytest tests_backend -q` | нет | diff не трогает `custom_components/houseplan/**/*.py` |
| `npm run invariants` / model-invariants | нет | diff не трогает геометрию комнат, `layout`, `marker.space`, `open_spans` — панель это HTML-обвязка вокруг уже существующей карточки |
| performance-профили | нет | не названы в AC, diff не касается чувствительных к перфу путей |

## Таблица «чем краснеет» (§2.7, защитные AC)

| AC/защита | Чем доказан | Чем краснеет |
|---|---|---|
| Хост панели берёт высоту от viewport, а не от `<ha-panel-custom>` (иначе стейдж 0 px) | `demo/smoke_houseplan_panel.mjs` → `autoHeightHostFillsViewportMinusInsets`, `autoHeightHostKeepsPositiveStage` (оба `true` в реальном прогоне) | `node scripts/mutation-gate.mjs --id=panel-host-height-from-parent` — мутант возвращает `height:100%`, смок краснеет (подтверждено прогоном) |
| Собственные pre-upgrade свойства (`panel/hass/narrow/route`) переносятся через accessors, `hass` доходит до карточки уже на первом открытии | `demo/smoke_houseplan_panel.mjs` → `haSequenceLeavesNoShadowingOwnProperties`, `haSequenceForwardsInitialHass`, `haSequenceForwardsLaterHass`, `haSequenceAdoptsNarrowThroughAccessor`, `haSequenceAdoptsRouteAndPanel` (все `true`) | `node scripts/mutation-gate.mjs --id=panel-ignores-pre-upgrade-properties` — мутант убирает перенос, смок краснеет (подтверждено прогоном) |
| Существующие golden-панели не меняются | `npm run golden:verify` | не мутировалось намеренно; регресс проявился бы падением одного из 60 сценариев — их нет |

## Находки

Нет ни High, ни Medium, ни Low.

Разобрано и не вызвало вопросов (детали — «Как проверялось» и код-чтение):
- Порядок вызова `_adoptPreUpgradeProperties()` в массиве `['panel','hass','narrow','route']`
  не влияет на корректность: `hass`-setter вызывает `_ensureShell()` и не
  зависит от того, установлены ли уже `narrow`/`route`, а их setters не имеют
  побочных эффектов на карточку. Проверено чтением, подтверждено прогоном
  смока (`haSequenceAdopts*` все `true`).
- Второй вызов `_adoptPreUpgradeProperties()` в `connectedCallback` — не
  находка: после апгрейда собственных свойств уже нет (`hasOwnProperty`
  ложный), вызов становится no-op. Не вредит, просто defensive.
- `delete` на собственных data-свойствах, выставленных простым присваиванием
  до апгрейда элемента — стандартно configurable/writable, `delete` не может
  бросить исключение. Проверено чтением.
- Регэксп-проверки в `test/houseplan-panel.test.mjs` (`assert.doesNotMatch(panel,
  /:host \{[^}]*height: 100%;/`) корректно ограничены блоком `:host{...}`
  классом символов `[^}]*` — не цепляют `.page { height: 100%; }` ниже по файлу.
  Проверено чтением; это вспомогательные регресс-тесты поверх поведенческого
  смока, а не единственное доказательство.
- Трейлеры коммитов: `Issue: #488` во всех четырёх, `User-Visible: yes` только
  в продуктовом коммите `471527c4` (единственном, меняющем видимое поведение),
  с правками в оба changelog в этом же коммите; остальные три —
  `User-Visible: no` (тест/доки), корректно.
- Классы изменений (`AGENTS.md`) соблюдены: A — `src/houseplan-panel.ts`;
  B — `demo/**`, `scripts/mutation-gate.mjs`, `test/**`, все со ссылкой на
  #488; C — `docs/**`; D — `dist/**`, `custom_components/houseplan/frontend/**`
  меняются только вслед за источником, не сами по себе.
- `docs/images/screenshots.json`: диф — только `sourceFingerprint`/`sourceSha256`,
  `imageSha256` не менялся ни в одной записи; согласуется с `check-docs.mjs`
  зелёным и с коммитом `2b2fc944`, прямо объясняющим, почему картинки не
  перевыпускались.
- Продуктовая рамка (`docs/SCOPE.md`): правка закрывает J1 («show the whole
  home… live spatial overview») в самом буквальном виде — без неё вход в
  продукт через боковую панель не работает вовсе. В скоуп, приоритет P1
  оправдан.

## Чего не проверял

- Реальный HA-инстанс (только Playwright-эмуляция через двойник
  `<ha-panel-custom>` в `demo/smoke_houseplan_panel.mjs`, включая порядок
  вызовов `_createPanel`/`setCustomPanelProperties`, который смок
  воспроизводит текстом, а не импортом настоящего HA frontend). Ручного
  тестирования в цикле ревью нет по правилам процесса; проверено чтением кода
  и поведенческим смоком с мутантами, не исполнением на живом HA.
- `python -m pytest tests_backend` — не запускал, diff не трогает
  `custom_components/houseplan/**/*.py`.
- `node scripts/model-invariants.mjs` — не запускал, diff не трогает
  геометрию/`layout`/`marker.space`/`open_spans`.
- Полный `ls demo/smoke_*.mjs` матрицы кроме `smoke_houseplan_panel.mjs` — не
  прогонял; diff ограничен монтированием панели, `smoke-select.mjs` не назвал
  других кандидатов, а тема (панель) больше ни в одном смоке не фигурирует.
- Performance-профили — не в AC, не затронуты.

## Вердикт

Зелёный. AC issue выполнены и доказаны исполняемым смоком с двумя мутантами,
подтверждённо краснеющими; побочный, изначально не описанный в issue корень
(затенение accessors) корректно диагностирован, задокументирован и покрыт тем
же гейтом; golden не регрессирует; трейлеры и changelog в порядке.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/488-panel-host`, коммит `2b2fc94479d8` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `76c6fb8b02386f04bf88c536fdba9c2ab46effbc`
  ```
  git log --all --format='%H %T' | grep 76c6fb8b0238
  ```
