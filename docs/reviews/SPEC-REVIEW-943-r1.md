# SPEC-REVIEW-943-r1

Issue: #943 — «Удалить базовое затемнение комнат («Темнота дома»), сохранив свечение ламп»
Этап: spec (PROCESS.md §2.4) · Трек: ask · Заход: r1 · блокирующих циклов израсходовано 0/4
Материал: тело issue #943, редакция «ТЗ. Редакция 1, 2026-10-18», плюс оба существующих
комментария (occupation + «Оценка»/триаж). Никакого кода по этой задаче ещё не писалось —
`gh issue view 943` подтверждает `track:ask`, `S4-spec-review`, `ci:full`, `ci:golden`, `P2`.

## Скоуп ревью

Проверяю ТЗ в теле issue #943 на обязательные разделы §7.1, однозначность AC1–AC7 и
способ их доказательства, соответствие продуктовому скоупу (`docs/SCOPE.md`) и
канону подсистемы (`docs/LIGHT.md`, `docs/CONFIG-COMPATIBILITY.md`, `docs/ISOMETRIC.md`,
`docs/USER-GUIDE.ru.md`), и полноту раздела «Затронутые модули» сверкой с реальным
кодом репозитория (`origin/dev`/рабочая копия — код ещё не менялся этой задачей, поэтому
сверяю заявления ТЗ с текущим, непродуктовым для #943 состоянием дерева).

## Как проверялось

- Прочитаны `docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md`, релевантные куски
  `PROCESS.md` (§2.4, §2.5, §7.1, §7.2).
- Тело issue #943 целиком, оба комментария (claim + «Оценка»).
- Канон: `docs/LIGHT.md` (раздел «Glow over the data fill (#55)», «Which surfaces render
  pools»), `docs/CONFIG-COMPATIBILITY.md` (раздел «Independent Glow compatibility»),
  `docs/USER-GUIDE.ru.md` (§13 «Заливки комнат и свет», строка Glow в таблице режимов
  пространства).
- Текущий код для перепроверки каждого утверждения «Затронутых модулей»: `src/logic.ts`,
  `src/houseplan-card.ts`, `src/space-render.ts`, `src/editors/general-settings-dialog.ts`,
  `src/houseplan-editor-runtime.ts`, `src/styles/plan.styles.ts`, i18n (`en/ru/de/fr.json`),
  `custom_components/houseplan/validation.py`, и — за рамками списка ТЗ —
  `custom_components/houseplan/support_package.py`,
  `custom_components/houseplan/support_wire_schema.py`, `docs/SUPPORT-PRIVACY.md`,
  `tests_backend/test_support_package.py`.
- `grep`/чтение, без исполнения продукта: этап spec, зависимости (`node_modules`,
  Python venv/`homeassistant`) намеренно не установлены (#696) — это ожидаемое
  состояние среды на этом этапе, а не упущение ревью.

## Чего не проверял и почему

- **Гейты `tsc`/`npm test`/`npm run build`/`pytest tests_backend` не прогонялись.**
  Продуктовый код по #943 не существует (issue в `S4-spec-review`, материал —
  только текст ТЗ), `node_modules` и Python-окружение в рабочей копии не установлены —
  это ожидаемо для spec-этапа (#696) и подтверждено: `ls node_modules` →
  «No such file or directory», `python3 -m pytest --version` → «No module named pytest».
  Сборки/тесты нечего сверять с диффом, которого нет.
- Golden/скриншоты, performance, touch-смоки — не прогонялись по той же причине
  (нет кода, нет кандидата для рендера).
- Ручная dev/GPU-приёмка не проводилась и не требуется (добровольна, #929).
- `docs/reviews/INDEX.md` на предмет истории #55/#61 не содержит релевантных строк —
  исторические ревью не перепроверялись, ТЗ сам явно просит их не переписывать.

## Находки

### Medium (в скоупе) — «Затронутые модули» не называют parity-контракт
support-пакета (#498); Python-часть не «не требует изменения»

**Файл/раздел ТЗ:** issue #943, разделы «Затронутые модули» и «Данные, чтение и
миграция» («Существующий Python validator не требует изменения; тестами
подтверждаем принятие legacy и прежнюю строгость»).

**Суть:** ТЗ называет единственным Python-файлом `custom_components/houseplan/
validation.py` и утверждает, что бэкенд вообще не требует изменений. Это верно
для `validation.py` (там `fill_colors` — открытая схема `{str: {c, a}}`,
именам ролей безразлична, см. `validation.py:2358-2367`), но неверно для
совсем другого, не упомянутого в ТЗ подмножества бэкенда — support/diagnostics
package (#498):

- `custom_components/houseplan/support_package.py:144-159` — константа
  `SUPPORT_FILL_COLOR_KEYS`, буквально закомментированная как
  `# The eleven palette slots the card reads (src/logic.ts DEFAULT_FILL_COLORS).`
  и используемая в `_global_settings()` (строки 186-194) как allow-list при
  сборке support-пакета.
- `custom_components/houseplan/support_wire_schema.py:278-294` —
  `GLOBAL_SETTINGS["fill_colors"]`, тот же список из 11 имён (включая
  `glow_base`) как **закрытая** схема: `validate()` (строка ~1049) делает
  `set(value) - rule.fields.keys()` и отклоняет объект при любом чужом ключе.
- `docs/SUPPORT-PRIVACY.md:21-24` — «the fill palette only by the eleven slot
  names the card defines» — тот же счёт прямо в пользовательской/приватностной
  документации support-пакета.
- `tests_backend/test_support_package.py:478-490` —
  `test_issue_498_palette_allowlist_matches_the_card_defaults` читает
  `src/logic.ts`, регэкспом вытаскивает ключи блока
  `export const DEFAULT_FILL_COLORS: FillColors = { … }` и утверждает
  `set(card_keys) == set(support_package.SUPPORT_FILL_COLOR_KEYS)` **и**
  `len(card_keys) == len(support_package.SUPPORT_FILL_COLOR_KEYS) == 11`.

**Чем краснеет:** это механическая, не продуктовая проверка — после того как
реализация уберёт строку `glow_base: { c: '#0d1b2a', a: 0.5 },` и поле
`glow_base: FillColorEntry;` из `DEFAULT_FILL_COLORS`/`FillColors` в
`src/logic.ts` (именно это прямо предписывает ТЗ в «Затронутых модулях»),
`card_keys` в этом тесте станет десятью именами без `glow_base`, а
`SUPPORT_FILL_COLOR_KEYS` на Python-стороне останется прежним списком из
одиннадцати — тест упадёт на обоих `assert`. Это не домысел и не
мутационная проверка: тест уже существует, читает `src/logic.ts` как текст
(разрешённый замороженный монолитный контракт, не новый) и предсказуемо
ломается любым обычным удалением строки, которое ТЗ и так предписывает
коду. Выполнять этот тест сейчас (до изменения `logic.ts`) бессмысленно —
он зелёный на неизменённом коде, что и наблюдается логически из regex:
11 ключей в `DEFAULT_FILL_COLORS` сейчас равны 11 ключам
`SUPPORT_FILL_COLOR_KEYS` сейчас. Доказательство по чтению, не по
исполнению (нет окружения для pytest на этом этапе, см. «Чего не
проверял»).

**Почему это находка ТЗ, а не мелочь для реализации:** ТЗ прямо заявляет,
что бэкенд не нуждается в правках за пределами подтверждающих тестов
`validation.py`, и не перечисляет `support_package.py`/
`support_wire_schema.py`/`SUPPORT-PRIVACY.md` вообще. DoR требует
«перечислены затронутые файлы и модули» (PROCESS.md §2.5) и ровно это
не выполнено для реального, автоматически обнаруживаемого разрыва.
Риск не гипотетический: обычный набор гейтов для «чисто фронтенд» ТЗ
(как оно описано) не включает `pytest tests_backend` («назван в ТЗ при
правке Python» — а ТЗ прямо пишет, что Python не трогаем), поэтому
исполнитель с высокой вероятностью не прогонит этот тест и не заметит
поломку до более позднего полного гейта или вообще до жалобы после
релиза — хотя сам support-package — это пользовательский канал поддержки
(человек жмёт «Скачать пакет поддержки» и получает ошибку генерации или
расхождение в документированной приватности).

**Предлагаемое исправление ТЗ (одним абзацем в «Затронутые модули» и
AC):** добавить `support_package.py` (`SUPPORT_FILL_COLOR_KEYS`,
убрать `glow_base`, обновить счёт 11→10 там, где он захардкожен в тесте),
`support_wire_schema.py` (`GLOBAL_SETTINGS["fill_colors"]`, убрать
`glow_base` из списка полей закрытой схемы) и `docs/SUPPORT-PRIVACY.md`
(заменить «eleven» на «ten»/снять точный счёт), и явно назвать
`tests_backend/test_support_package.py::test_issue_498_palette_allowlist_matches_the_card_defaults`
как часть доказательства AC (например, расширить AC5 или AC7, которые
и так покрывают backend validation/import-export тесты).

Это Medium **в скоупе** задачи — чинится правкой текста ТЗ (и позже кода)
в этом же issue, отдельный issue не заводится (PROCESS.md §2.4, #202).
Единственная находка цикла; High-находок нет.

## Что проверено и корректно

- Обязательные разделы §7.1 присутствуют и в правильном порядке: сценарий/что
  увидит человек → проблема/основание → скоуп и не-скоуп → контракт поведения
  (10 пунктов) → UX и i18n → данные/миграция → затронутые модули → AC1–AC7 →
  план автотестов и отрицательные свидетели → риски → откат и
  release-артефакты → «принято предположительно».
- Описание текущего («До») поведения дословно совпадает с каноном:
  `docs/LIGHT.md` строки 400-412 («Floor order is paper → resolved data
  room/tunnel fill → Glow base → decor → radial pools…», «painted only for
  rooms whose fill resolver returned nothing or a fully transparent colour»)
  — ровно то, что ТЗ называет «До: при включённом Glow отсутствие видимой
  заливки … добавляет цвет/alpha glow_base». Легаси-проекция
  `fill_mode: glow` в ТЗ («НЕ возрождает равномерное затемнение») совпадает
  с `docs/CONFIG-COMPATIBILITY.md` строки 805-812.
- Все перечисленные в «Затронутых модулях» файлы и символы реально
  существуют и содержат именно то, что заявлено: `FillColors`/
  `DEFAULT_FILL_COLORS` в `src/logic.ts:1430-1453`; `_resolvedGlowBase`/
  `_renderGlowBaseRooms` в `src/houseplan-card.ts:9058-9080` и их вызов на
  11204; fallback в 2.5D-классификации пола на `src/houseplan-card.ts:10826-10827`
  (`fill.opacity > 0 ? fill : glowBase.byId.get(id)`) — ровно то место,
  которое AC6/контракт п.6 просит убрать; отдельные shapes/tunnels в
  `src/space-render.ts:608-618`; тайл `gs.glow_base` в
  `src/editors/general-settings-dialog.ts:154`; CSS-классы
  `.glow-base-layer`/`.glow-base-tunnels` в `src/styles/plan.styles.ts:446-453,1133`;
  ключ `gs.glow_base` присутствует ровно в en/ru/de/fr (других локалей нет).
  `performance-contract.test.mjs:279-283` действительно читает исходный текст
  `_renderGlowBaseRooms` как монолитный текстовый контракт — ТЗ корректно
  просит обновить этот «obsolete base-only участок» без новых regex-якорей,
  не заводя новый текстовый тест (политика REVIEWER.md соблюдена).
- Смоки, названные для замены ожиданий (`smoke_room_settings`,
  `smoke_space_settings`, `smoke_ux_fixes`, `smoke_glow`,
  `smoke_glow_geometry_resilience`, `smoke_opening_tunnel_fill`,
  `smoke_glow_blending`, `smoke_decor_layer_order`,
  `smoke_isometric_live_touch`, `smoke_live_pan_coverage`) совпадают с
  `grep -rl glow_base demo/` (нашлись `smoke_opening_tunnel_fill.mjs` и
  `smoke_decor_layer_order.mjs` среди прочих потребителей) — список не
  придуман, а выверен по реальным потребителям.
- AC1–AC7 пронумерованы, для каждого указан способ доказательства
  (unit/smoke/golden/backend), что удовлетворяет DoR-пункту про способ
  доказательства каждого AC (PROCESS.md §2.5).
- Защитный/негативный план (раздел «План автотестов и отрицательные
  свидетели») описывает корректный порядок доказательства регресса:
  обычный прогон нового смока на неизменённом продукте должен дать RED по
  симптому владельца (насыщенный legacy `glow_base`/alpha 1 даёт старую
  закраску) до изменения рендерера, что соответствует требованию «Дефект
  растра/композитинга — нужен свидетель, красный на старом коде именно по
  симптому» (PROCESS.md §7.1) и не описывается как временный патч
  продукта — это обычный negative-input case на текущей неизменённой
  реализации, разрешённый общей политикой.
- i18n: ключ `gs.glow_base` корректно назван для удаления во всех четырёх
  существующих локалях (других `src/i18n/*.json`, кроме en/ru/de/fr, нет).
- Классификация release ledger (`baseStable: v1.81.0`, `stable-fix`,
  `milestone 1.82`) соответствует фактическому текущему стабильному тегу:
  `docs/CHANGELOG.md` подтверждает `## v1.81.0 — 2026-10-16` как последний
  stable; функция затемнения существовала уже в этом стабильном релизе
  (исторически из #55/#61), так что «упрощение существовавшего поведения»
  — разумная авторская классификация, а не вывод из `User-Visible` (сам
  трейлер появится только в коммитах реализации).
- Touch/host-риск (контракт: «удалённые pointer-none слои не должны менять
  room/device gestures») корректно отражает то, что Glow-слой и так
  `pointer-events:none` (`docs/LIGHT.md:423`), то есть удаление не может
  задеть жесты по построению — риск назван правильно, а не для галочки.
- Продуктовых вопросов владельцу действительно не осталось непокрытыми:
  отдельно проверил кандидатов на скрытую продуктовую неоднозначность
  (поведение default-пространства «Свой цвет 0% + Glow», которое сейчас
  документировано как визуально равное режиму «Нет» именно из-за базового
  затемнения — `docs/USER-GUIDE.ru.md:2010-2022`) — после удаления базы оба
  режима одинаково лишаются затемнения и визуальный паритет между ними не
  нарушается, так что скрытого продуктового вопроса здесь нет, только
  перефразировка руководства, уже охваченная общим пунктом «обновить
  подсказки/руководство, если они обещают затемнение».

## Маршрут и вердикт

Находка Medium лежит целиком в скоупе issue #943 (это та же задача —
«полностью убрать функцию», а не смежная), High-находок нет. По правилу
PROCESS.md §2.4/§2.7: Medium в скоупе без High даёт жёлтый вердикт, ТЗ
возвращается автору на правку текста (добавить `support_package.py` /
`support_wire_schema.py` / `docs/SUPPORT-PRIVACY.md` в «Затронутые модули»
и соответствующий backend-тест в доказательства AC), отдельный issue не
заводится. Побочных находок вне скоупа нет — новый issue по политике
`mode=issues` не создаётся.

**Вердикт: жёлтый · заход r1 · блокирующих циклов 1/4 · High: 0 · Medium: 1 → в задаче**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `c7b35a1b42d8` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a36742f6b6d2986d87ee9feed6a23e90e585762b`
  ```
  git log --all --format='%H %T' | grep a36742f6b6d2
  ```
- Тело issue: `541108e510297d079a518ebb880f46db4aa7c2e000dc8895dbda8d2f438a700c`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix` (критерий `spec-review-943-r1`)
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ2MTQsIm91dHB1dF90b2tlbnMiOjE2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0Njk0fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMzIsIm91dHB1dF90b2tlbnMiOjQ5NTE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEyNTIyOCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjYyNTU3MTMsImNvc3RVc2RFc3RpbWF0ZSI6Mi4yNDc0ODg2MDAwMDAwMDA1fV0sInR1cm5zIjo3NSwiZHVyYXRpb25NcyI6NTk2NTI5LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi4yNTIxODI2MDAwMDAwMDAzLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=4746 output_tokens=49533 cache_creation_input_tokens=125228 cache_read_input_tokens=6255713 num_turns=75 -->
