# SPEC-REVIEW — issue #1071, заход r1

Материал: тело issue #1071, раздел `## ТЗ` (сам issue закреплён на SHA дерева
`0d733917f1f1fd51bc93fc4bca63b07cf2675a03`, bodyDigest
`c60a1b2ca16b499b6065a8462f078ff6da6443f7dd32c995207a1f3193f4a022`).
Трек: `track:ask` (заявлен владельцем в первом комментарии: «трек: ask —
уточнение пользовательской семантики верхнего цвета при выбранной группе»).
Этап: `S4-spec-review`, заход r1.

## Скоуп

Задача — баг мультиселекта декора (#1038): верхнее поле цвета/прозрачности
в тулбаре редактора подложки при N>1 выбранных предметах по-прежнему пишет
в `_decorStyle`/`settings.decor_default_style` (стиль создания новых
объектов), а не в выбранный набор, в отличие от боковой панели Properties,
которая уже использует корректный groupColorDraft/compound-field writer.
ТЗ описывает контракт переиспользования существующего group-write пути для
второй поверхности (тулбар), без новых batch-операций, без новой модели
данных, без миграции. Обслуживаемая работа пользователя — J6 «Keep the plan
true as the home evolves» (редактор подложки, групповое редактирование
существующих объектов декора).

## Как проверялось

Кодовый Validate на этапе spec не требовался и не запускался (CI на SHA
документа ревью не нужен). Проведена **только** осуществимость/доказуемость
AC и терминологии чтением материала — репозитория на зафиксированном
коммите `0d733917f1f1fd51bc93fc4bca63b07cf2675a03` (рабочая копия уже на
нём) — без tsc/build/npm test/gate:small:

- прочитаны обязательные источники роли (`docs/SCOPE.md`, `AGENTS.md`,
  `docs/process/REVIEWER.md`) и разделы канона §2.4, §2.5, §7.1;
- прочитано тело issue #1071 через `gh issue view` и сверено побайтно с
  `body` из `REVIEW_CONTEXT` — совпадает;
- прочитаны комментарии issue (`gh api .../issues/1071/comments`): оценка
  владельца с треком `ask`, старый отказ механической подготовки («Missing
  required section: problem/tests» от 08:16:35Z) и черновик кода
  (§11.8, не используется как довод — текущее тело issue уже содержит обе
  секции, прогон не образует находку);
- адресно проверена причина бага чтением `src/houseplan-editor-runtime.ts`
  (`_renderDecorBar`, `_decorStyle`, `_updateDecorStyle`, `_persistDecorStyle`
  → `settings.decor_default_style`) — подтверждает описание issue: верхнее
  поле безусловно привязано к стилю создания, а не к выборке;
- адресно проверено существование переиспользуемой инфраструктуры:
  `src/editors/properties/group-color-draft.ts` (resolver/parser mixed-канала)
  и `src/editors/properties/surface.ts` (уже использует
  `groupColorDraft`/`parseGroupColor`) — контракт «один
  resolver/compound-field writer» для второй поверхности осуществим;
- адресно проверен спорный пункт скоупа «компактный desktop работает без
  скрытого Properties»: `src/editors/properties/editor.ts:162`
  `get wide(): boolean { return this.allowed && this.width >= 960; }` и
  `render()` (строка 680) `if (!this.wide) return nothing;` — подтверждают,
  что при ширине <960px боковая панель Properties не рендерится вовсе, то
  есть сегодня при компактном desktop группового перекрашивания нет вообще
  ни одной рабочей поверхностью; это делает заявленный AC2-пункт не только
  осуществимым, но и более обоснованным, чем в тексте issue;
- сверены i18n-ключи, заявленные к переиспользованию (`mixed_values`,
  `group_incompatible`) — существуют в `src/editors/properties/strings.ts`
  (en/ru явно, de/fr — через существующий fallback на `en`), новых ключей
  не требуется — заявление ТЗ подтверждено;
- сверена модель данных: `settings.decor_default_style` существует
  (`src/houseplan-card.ts`, `src/houseplan-editor-runtime.ts:9493-9504`,
  `src/space-render.ts`) — пункт контракта «Group edits не меняют
  settings.decor_default_style» привязан к реальному полю, а не к
  гипотетическому;
- сверена классификация release-ledger: `git show
  v1.82.0:src/editors/decor/group-edit.ts` → `fatal: path ... exists on
  disk, but not in 'v1.82.0'` — подтверждает авторское обоснование
  `line-fix` (мультиселект #1038 появился после текущего stable);
- сверены названные в «Плане автотестов»/AC3 файлы:
  `test/decor-group-edit.test.mjs`, `test/decor-group-text.test.mjs`,
  `demo/smoke_decor_multiselect.mjs`, `demo/smoke_decor_group_text_scale.mjs`
  — все существуют;
- сверена история #1038 в `docs/reviews/INDEX.md` (spec r1 жёлтый → r2
  зелёный; code r1 жёлтый по perf group-text → r2 зелёный) — контракт,
  который переиспользует #1071, уже прошёл независимую приёмку, и пункт 5
  ТЗ («перепроверить действующий мультиселект») корректно адресует именно
  те классы риска, что всплывали там.

Не прогонялись (и не требовались на этом этапе): tsc, build, npm test,
gate:small, demo-смоки, golden, invariants, performance — задача находится
на этапе ревью ТЗ, продукт ещё не менялся, кодового Validate §2.4/§8 не
требует. Единственная проведённая проверка осуществимости — чтение
перечисленных выше файлов на зафиксированном SHA; обычных negative-input
прогонов не требовалось, так как все сомнения снимались чтением
существующего работающего кода (боковая панель/#1038), а не поведением,
которого ещё нет.

## Обязательные разделы (§7.1) и DoR (§2.5)

Все обязательные разделы присутствуют и однозначны: Проблема · Сценарий ·
Что человек увидит до/после · Скоуп и не-скоуп · Контракт поведения (п.1–5)
· UX/i18n/входные устройства · Модель данных/совместимость/производительность
· Критерии приёмки AC1–AC3 с доказательством · План автотестов · Риски,
откат, release-артефакты.

DoR по пунктам:

| Пункт | Статус |
|---|---|
| ТЗ в теле, трек `ask` | да |
| AC1…ACn пронумерованы, способ доказательства указан у каждого | да (unit/smoke/golden/аудит существующих suites — таблица в issue) |
| Затронутые файлы/модули перечислены | да (раздел «Технические решения») |
| i18n: ключи en+ru | да — переиспользуются существующие `mixed_values`/`group_incompatible`/colour/opacity, новых не требуется (подтверждено чтением `strings.ts`) |
| Миграция/совместимость | да — «новых полей/миграции нет», подтверждено отсутствием новых ключей конфигурации в контракте |
| Производительность | да — «не менять byte/performance bands», переиспользуется существующий O(N) group patch |
| Touch | да — best effort по TOUCH-SUPPORT, без новых жестов |
| Release-артефакты | да — changelog RU/EN, DECOR-EDITOR, USER-GUIDE.ru, ARCHITECTURE/DEVELOPMENT/STATUS, `ci:golden` с именованными сценами, release-ledger line-fix с обоснованием |
| Откат | да — revert коммитов реализации, старые значения читаются прежними версиями |
| Открытых продуктовых вопросов нет | да — ни один пункт контракта не оставлен как вопрос владельцу; технических вопросов владельцу не задано |

## Находки

Находок нет: ни High, ни Medium (ни в скоупе, ни вне скоупа), ни Low. ТЗ
осуществимо, однозначно, проверяемо, и каждое утверждение о поведении,
которое удалось сопоставить с кодом/документами (причина бага, существующий
group-write путь, ширина 960px для `wide`, существующие i18n-ключи,
`settings.decor_default_style`, отсутствие файла в теге v1.82.0, наличие
названных тестовых файлов), подтвердилось. Открытых противоречий между ТЗ,
`docs/DECOR-EDITOR.md` §1 (Multiple selection, #1038) и
`docs/USER-GUIDE.ru.md` «Несколько объектов декора» не обнаружено: контракт
новой задачи (только вторая поверхность — тулбар — для уже установленного
правила «одинаковые kind — общая пара цвет/прозрачность, image — только
opacity, mixed kinds не перекрашиваются») — прямое следствие, а не
изменение существующего инварианта.

## Что проверено и корректно

- Причина бага подтверждена чтением кода, не только текстом issue.
- Технические решения ТЗ (переиспользование `PropertiesEditor`/group-color-
  draft/compound-field контракта) опираются на реально существующий,
  уже принятый в #1038 код, а не на гипотетическую инфраструктуру.
- Границы скоупа (N=0/N=1 не трогаются, mixed kinds не перекрашиваются,
  новые batch-операции/миграция/реальный HA — не-скоуп) сформулированы без
  двусмысленности и совпадают с действующим контрактом DECOR-EDITOR.md §1.
- AC1–AC3 каждый привязан к конкретному, существующему или заявленному
  новому тестовому артефакту; для AC3 делегирование выбора «связанных»
  смоков планировщику задачи на этапе реализации — штатная практика
  (`smoke-select.mjs`, REVIEWER.md «Объём гейтов»), а не недосказанность ТЗ.
- Release-ledger классификация `line-fix` обоснована и подтверждена git-
  историей (файл `group-edit.ts` отсутствует в теге `v1.82.0`).
- i18n и модель данных не вводят новых пользовательских полей/строк —
  утверждение проверено, а не принято на веру.

## Чего не проверял

- Исполнение/прохождение будущего `smoke_decor_group_toolbar.mjs` — его ещё
  нет, это предмет кода, не ТЗ.
- Полноту аудита AC3 по всем шести kind и mixed-комбинациям — это работа
  реализации и код-ревью, не ревью ТЗ; здесь проверялась только
  осуществимость самой формулировки аудита.
- Golden-сцены `decor-multiselect-light/dark` — отсутствие полной визуальной
  матрицы на этапе ТЗ не гейт (§8, «Объём гейтов»; свежесть скриншотов — не
  гейт задачи).
- Реальное ручное устройство/GPU-приёмку — не требуется на этом этапе.

## Гейты

| Гейт | Прогнан | Почему |
|---|---|---|
| tsc/build/npm test/gate:small | нет | этап spec, кодовый Validate не требуется (§2.4, REVIEWER.md) |
| demo-смоки (smoke_decor_multiselect.mjs и др.) | нет | продукт не менялся; существование файлов проверено чтением (`ls`/`find`), не исполнением |
| golden/`ci:golden` | нет | визуальных изменений нет (ТЗ, не реализация); метка `ci:golden` зафиксирована на issue для будущей реализации |
| invariants (геометрия) | нет | задача не меняет геометрию/модель данных |
| performance | нет | ТЗ явно заявляет «не менять byte/performance bands», без изменений кода на этом этапе |
| адресное чтение кода (осуществимость) | да | `_renderDecorBar`/`_decorStyle`/`_updateDecorStyle`/`_persistDecorStyle`, `group-color-draft.ts`, `surface.ts`, `editor.ts` (`wide`), `strings.ts`, `houseplan-card.ts`/`space-render.ts` (`decor_default_style`), `git show v1.82.0:...`, наличие тестовых файлов — все перечислены выше в «Как проверялось» |

## Маршрут и побочные находки

Побочных находок вне скоупа нет (режим `mode=issues` по
`REVIEW_FINDINGS_POLICY`, новых issue не заводилось — заводить было нечего).
Маршрут вердикта: `route: fix` (High/Medium в скоупе отсутствуют, `ask`,
критерий §5 для `show`-reclassify неприменим).

## Вердикт

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 → в задаче

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `0d733917f1f1` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `43637daf0d1e65486909bf6fead2b97577657e50`
  ```
  git log --all --format='%H %T' | grep 43637daf0d1e
  ```
- Тело issue: `c60a1b2ca16b499b6065a8462f078ff6da6443f7dd32c995207a1f3193f4a022`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ2NjUsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NzY1fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMTYsIm91dHB1dF90b2tlbnMiOjI3ODU0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjk2MDI1LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NDkwMzg2NiwiY29zdFVzZEVzdGltYXRlIjoxLjY0MzY0NTIwMDAwMDAwMDR9XSwidHVybnMiOjYzLCJkdXJhdGlvbk1zIjozMzg4MDAsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjY0ODQxMDIwMDAwMDAwMDMsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4781 output_tokens=27874 cache_creation_input_tokens=96025 cache_read_input_tokens=4903866 num_turns=63 -->
