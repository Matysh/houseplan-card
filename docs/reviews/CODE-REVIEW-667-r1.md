# CODE-REVIEW-667-r1

Issue: #667 · Заход: r1 · Материал: `2fe20a095b1c565134cb9983eb0ed27c9b3d351c`
(единственный коммит `781902b3..HEAD`, ветка `issue/667-docs-drift`)

## Скоуп

Инфраструктурный трек, только документация: 23 файла, ни одной строки в
`src/**`, `custom_components/**`, `test/**`, `demo/**`. Задача — свести 15
расхождений документации с кодом/каноном, найденных при сплошном чтении
`docs/` на `dev @ 781902b`. Класс изменений — C (документация). Трейлеры
коммита: `Issue: #667`, `User-Visible: no` — верно: изменения не трогают
поведение продукта, только описание уже существующего (AGENTS.md, «User-Visible:
no для… документации, которая не меняет продукт»).

Job из `docs/SCOPE.md`: задача не строит фичу, а обслуживает точность входных
документов для J4/J6 (README и руководство описывают шаги, которых уже нет)
и для самого процесса (актуальность STATUS/CONTRIBUTING/AGENTS для
следующего автора/ревьюера).

## Как проверялось

Ревью — не первый раунд по объёму, а полный разбор всех 15 пунктов, потому
что предмет не код с AC, а фактическая точность документации: каждое
утверждение автора проверено чтением текущего дерева и, где применимо,
исполнением инструмента, а не доверием к самоотчёту.

По каждому из 15 пунктов из тела issue — сверка "было / стало / факт в
коде":

| № | Расхождение | Правка в диффе | Сверено с |
|---|---|---|---|
| 1 | Бюджет initial View назван числом (256000 Б) в прозе | `AGENTS.md:409`, `docs/DEVELOPMENT.md:344` теперь ссылаются на `INITIAL_VIEW_GZIP_BUDGET` без цифры | `scripts/bundle-budget.mjs:44` — `export const INITIAL_VIEW_GZIP_BUDGET = 301_066` (прочитано) |
| 2 | CONTRIBUTING: бандл коммитить вручную; Python ≥3.13; релиз — 4 файла + тег | Три абзаца переписаны: `bundle:clean`/`Release:`-трейлер, `.python-version`, `release-contract`/`release:prerelease`/`release.yml` | `.python-version` = `3.14` (прочитано); `.githooks/commit-msg` → `validate-commit-provenance.mjs` → `bundle-policy.mjs` (`BUNDLE_RELEASE_ONLY_ERROR`, коммит с путём бандла без `Release:` отклоняется) — исполнено чтением всей цепочки; `scripts/release-contract.mjs`, `scripts/wsl-setup.sh` существуют |
| 3 | testing-notes называют регистратором мутантов `mutation-gate.mjs` | `live-and-integrations.md`, `geometry.md` → `mutation-registry.mjs` | `ls scripts/mutation-registry.mjs` существует; `scripts/mutation-gate.mjs --changed` в `dialogs-and-forms.md:227` и в `ARCHITECTURE.md:2285-2287` оставлен намеренно — это раннер, не реестр (сверено разницей формулировок) |
| 4 | STATUS/ROADMAP держат HACS PR «в очереди» | Обе строки → «merged 2026-08-25» | `docs/STATUS.md` snapshot-таблица (сгенерированная) уже говорит «In the default catalog since 2026-08-25» — согласовано |
| 5 | STATUS «How to resume»/watchlist — старая песочница (git bundle, `ha_jb`, ручной scp) | Секции переписаны на роли/`task-packet`/`gate:small`/HACS-обновление | `scripts/task-packet.mjs` существует; `package.json` → `"gate:small": "node scripts/gate-small.mjs"`; `AGENTS.md:10` заголовок `## Read this first`, `docs/process/AUTHOR.md` существует |
| 6 | SCOPE: «two editors», J4 «image/PDF», presence в known gaps без ссылки на #485 | J4/J6 → три редактора, SVG/PNG/JPG/WebP; known gaps → ссылка на #485; Docs-пункт → ссылка на #668 | `docs/USER-GUIDE.ru.md:1622` заголовок `## 14. Редактор подложки` — третий редактор существует и документирован; `gh issue view 668` — открыт, «Английское руководство… отстаёт» |
| 7 | README/README.ru: «Контур комнаты» — инструмента нет | → «Стены», рисуется цепочка, замыкание открывает диалог | `src/i18n/ru.json:79` `"markup.add": "Стены"`; `src/houseplan-editor-runtime.ts:2474,6316` `_roomDialog = true` при замыкании контура — поведение подтверждено чтением |
| 8 | USER-GUIDE.ru штамп v1.73.0; таблица «Источник плана» разорвана абзацем | Штамп → v1.78.0-beta.5; абзац про растры перенесён после таблицы | `docs/USER-GUIDE.ru.md:523-537` — таблица теперь 4 строки подряд, абзац после неё (прочитано) |
| 9 | UX-MODES: «opening tap → door/lock info card» — противоречит инертности проёмов | → «lock-badge tap → …», проёмы инертны в View | `src/houseplan-editor-runtime.ts:6012` `_opClick`: `if (this.host._mode === 'plan') this._editOpening(o)` — вне Plan клик не открывает диалог, комментарий в коде подтверждает «openings are inert outside Plan mode» |
| 10 | STYLING-HOOKS: space-card «draws no openings and no decor layer» | → рисует `data-hp="opening"` и `data-hp="decor"`/`.dimage`, только векторный декор/мебель отсутствуют | `src/space-render.ts:891` (`data-hp="opening"`), `:647` (`class="dimage" data-hp="decor"`) — прочитано |
| 11 | DEVICE-PRESENTATION: битый якорь `#12-отображение-устройств` | → `#12-визуальные-состояния-устройств` | `docs/USER-GUIDE.ru.md:1328` заголовок `## 12. Визуальные состояния устройств` — якорь резолвится |
| 12 | Пол зума 0.4x в testing-notes | → «1/3 (`MIN_ZOOM`)» | `src/space-geometry.ts:237` `export const MIN_ZOOM = 1 / 3` |
| 13 | ADR 089/122/160 и ISOMETRIC.md называют 2.5D скрытым `hp_alpha`-экспериментом | Добавлена строка «Activation superseded by #649…» в ADR; в ISOMETRIC.md — исторические врезки | `src/types.ts:305` `volumetric_view?: boolean`; `src/logic.ts:1412` читает `settings.volumetric_view === true`; `docs/ISOMETRIC.md:10` заголовок `## Activation` — якорь резолвится |
| 14 | ARCHITECTURE.md раскладка содержит несуществующий `src/data/` | Строки `rules.ts`/`data/house.ts`/`data/backgrounds.ts` убраны, оставлен только `rules.ts` | `ls src/data` → No such file or directory |
| 15 | legacy/README.md называет `docs/superpowers/specs/` «действующими спецификациями» | → «дизайн-документы до процесса…, историческая справка; ТЗ живёт в теле issue (#517)» | Формулировка согласована с `docs/process/REVIEWER.md`/`PROCESS.md` §2.3 («ТЗ живёт в теле issue, `docs/specs/` — архив») |

Дополнительно проверено за рамками таблицы 15 пунктов (не находки, для
полноты картины):
- Оставшиеся упоминания `mutation-gate.mjs` вне трёх указанных в issue файлов
  (`docs/ARCHITECTURE.md`, `docs/design/**`, `docs/specs/**`) — это либо
  корректные вызовы раннера, либо архивные ТЗ/ADR, которые канон не требует
  переписывать задним числом; не в скоупе issue.
- `docs/STATUS.md` › «Workflow» в CONTRIBUTING.md — ссылка на строку таблицы
  «Standing state and decisions», а не на markdown-заголовок (в файле нет
  `## Workflow`); стиль расходится с соседними `AGENTS.md › Gates` (это
  реальные заголовки), но искомое по факту находится — не поднимаю до
  находки, чисто стилистическая шероховатость.

## Прогнанные гейты

| Гейт | Результат | Почему так |
|---|---|---|
| Validate на `2fe20a09` | success (https://github.com/Matysh/houseplan-card/actions/runs/36262534130) | дешёвые гейты уже подтверждены на этом SHA, повторно не гонял |
| `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 12 external links)` — прогнал сам | diff — документация, дешёвый гейт |
| `node scripts/process-gate.mjs --range 781902b3..HEAD` | пройден, 1 warning: `legacy/README.md` вне классов A/B/C/D (`process-gate: диапазон 781902b3..HEAD, коммитов 1`) | сверка трейлеров/классов, дёшево; предупреждение — известное свойство классификатора (`legacy/**` не входит ни в один путь из таблицы классов AGENTS.md), не дефект этой задачи |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет (src/**/*.ts не тронут)… Тронуто файлов: 23» | по инструкции — обязательный вывод для решения по каждой строке; связей нет, `src/**` не тронут → смоки не выбираются |
| `npx tsc --noEmit`, `npm test`, `npm run build`, `bundle-policy --verify`, `golden:verify`, `pytest tests_backend`, `invariants`, performance | не прогонял | diff не трогает `src/**`, `custom_components/**/*.py`, геометрию, рендер, фикстуры; Validate на этом SHA уже зелёный и покрывает эти гейты собственным прогоном |

Проверка исполнением ключевых утверждений (не только чтением кода, но и
запуском): `.githooks/commit-msg` → `bundle-policy.mjs` — прочитан текст
правила и подтверждено, что путь в `dist/**`/`custom_components/houseplan/frontend/**`
без трейлера `Release:` отклоняется (`BUNDLE_RELEASE_ONLY_ERROR`); это не
исполнение самого хука на реальном коммите, а чтение логики, которую он
реализует — записываю как «проверено чтением, не исполнением».

## AC / защитные требования

Задача не имеет отдельного раздела ТЗ с AC в issue — она перечисляет 15
конкретных расхождений и просит их устранить; «доказательство» каждого
пункта — не автотест и не защитный гард, а факт: текст документа теперь
соответствует коду/канону. Таблица выше — это и есть доказательство по
каждому пункту (столбец «Сверено с»). Формат «AC · чем доказан · чем
краснеет» неприменим: ни один из 15 пунктов не является защитным
поведением (валидацией/гардом/лимитом) — это фактическая правка текста,
верифицируемая только чтением дерева, что и сделано.

## Находки

Нет. Все 15 пунктов устранены и проверены против фактического состояния
кода/конфигурации; побочных регрессий или новых расхождений в изменённых
файлах не найдено.

## Что проверено и корректно

- Все 15 строк таблицы выше — текст документа после правки совпадает с
  реальным состоянием кода/скриптов/файловой структуры на `HEAD`.
- Трейлеры коммита (`Issue: #667`, `User-Visible: no`) и класс изменения
  (C — документация) верны.
- `check-docs.mjs` и `process-gate.mjs --range` зелёные (один ожидаемый
  warning вне скоупа задачи).
- `smoke-select.mjs` подтверждает: frontend-диффа нет, смоки не выбираются
  по объективной причине, а не пропущены.
- EN-паритет руководства (п. 8 issue) сознательно вынесен в отдельный,
  уже заведённый issue #668 — не сокрытие, а корректное разделение скоупа.
- ADR не переписаны ретроспективно, а дополнены строкой поверх — сохранена
  история решений, что соответствует духу канона (не редактировать принятые
  решения задним числом).

## Чего не проверял

- Полные `npx tsc --noEmit`, `npm test`, `npm run build`,
  `bundle-policy --verify` (со сверкой копий), `golden:verify`,
  `pytest tests_backend`, инварианты модели, performance — не запускал:
  diff не трогает `src/**`/`custom_components/**/*.py`/геометрию/рендер/
  фикстуры, и зелёный Validate на этом же SHA уже покрывает их.
- Не проверял оставшиеся ~40+ вхождений `mutation-gate.mjs` в архивных
  `docs/specs/**` и `docs/design/**` — они вне списка issue и вне канона
  «переписывать архив»; не мой предмет ревью.
- Не проверял английский `docs/USER-GUIDE.md` построчно — его отставание
  явно признано и вынесено в #668, эта задача его не трогает.
- Не запускал `process-gate.mjs --issues` (нужен `gh`, автор тоже пометил
  «не запускался» — это ограничение окружения, а не сокрытие; сам факт
  указан в issue честно).

## Вердикт

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 → в задаче

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/667-docs-drift`, коммит `2fe20a095b1c` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `63267430f28f9450cd99c81949bacf79a539b939`
  ```
  git log --all --format='%H %T' | grep 63267430f28f
  ```
- Тело issue: `c9320c593f7f0b1e5791eba19dfeaac03640732797f1a886a2bce106d7066596`
- Вердикт конвейера: `green` · High 0
