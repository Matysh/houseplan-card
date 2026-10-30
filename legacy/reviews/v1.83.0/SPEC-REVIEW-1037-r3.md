# SPEC-REVIEW-1037-r3

Issue: #1037 · Трек: `ask` · Этап: spec · Заход: r3 · блокирующих циклов израсходовано 2 из 4 (зелёный
вердикт цикла не образует — после этого вердикта остаётся 2 из 4).

Материал: тело issue #1037, раздел `## ТЗ` (плюс продуктовая преамбула — согласованы, без противоречий).
`bodyDigest` из `REVIEW_CONTEXT`: `d3fd5ccc3de6af1f364526dae98394c613dfcda3b9f13ee9132413bc6659347e`. Сверен
независимо: `gh issue view 1037 --json body -q .body` и содержимое `REVIEW_CONTEXT.body` побайтово совпадают
(единственное расхождение — завершающий перевод строки, добавленный шеллом при сохранении в файл). Продуктовый
код не менялся: `git log --oneline 0f92444151b6..HEAD` содержит только два docs-only коммита (документ r2 для
#1037 и несвязанный документ для #1035); `git diff --stat 0f92444151b6..HEAD -- src custom_components` пуст,
`git status` чист. `HEAD` = `306d0c3d6e000b8a9c3e547358fda068776bc1e9` — совпадает с материалом, названным в
промпте. `requestedRole`/`requiredRole` в `REVIEW_CONTEXT` — оба `reviewer`, расхождения нет.

Прочитан обязательный пакет: `docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md`; документы и якоря
предыдущих раундов `docs/reviews/SPEC-REVIEW-1037-r1.md`, `SPEC-REVIEW-1037-r2.md`; текущие комментарии issue
(аналитика, занятие, продуктовый вопрос/ответ, хендоффы и вердикты r1/r2, хендофф r3) — все из GitHub, не из
`REVIEW_CONTEXT` (поле `comments` там отсутствует). Round-scope (§2.10): адресно перечитан новый материал —
абзацы о `gs-wall-fill` в разделе `### DOM-identity и E2E-контракт` (строки 140–152 тела) и точечная правка
«Файлы и модули»/«Release-артефакты» (строки 197, 248–250) — против действующего `docs/data-hp-contract.json`
(поля `hooks.field`, `attributeMetadata`, `retiredHooks`) и `docs/STYLING-HOOKS.md` §7.1, §7.7, §7.8 целиком, а
также против фактической публикационной истории (`git` на теге `v1.82.0`). Остальные разделы ТЗ не трогались
делтой r2→r3 (сверено посимвольно с цитатами в `SPEC-REVIEW-1037-r2.md`, кроме точечного дополнения в AC9 —
см. «Закрытие раунда r2») — не перечитывались заново, их корректность унаследована из r1/r2.

## Скоуп

Делта r3 — ровно абзацы про отставку `gs-wall-fill` в разделе `### DOM-identity и E2E-контракт` плюс
формулировка «обязательной» (вместо «при необходимости») записи в `docs/data-hp-contract.json` в «Файлы и
модули»/«Release-артефакты» и уточнение AC9 («в metadata data-field есть его retirement/replacement, без
ложного активного/retired data-hp»). Продуктовый контракт, модель данных и миграция, UX, i18n, план автотестов
(кроме добавленного предложения к `test/data-hp-contract.test.mjs`), риски, откат и список release-артефактов
за пределами DOM-identity не менялись. Это узкая, локальная дельта — разбор по ней, не по задаче целиком
(`docs/process/REVIEWER.md`, «Повторный раунд»).

## Как проверялось

- **Закрытие Medium r2 проверено исполнением команд, а не принято на слово автора.** Хендофф автора утверждает:
  (а) `docs/data-hp-contract.json` объявляет `attribute: "data-hp"`, а `gs-wall-fill` — значение атрибута
  `data-field` на активном hook `data-hp="field"`, не самостоятельное значение `data-hp`; (б) `retiredHooks`
  описывает отставку значений корневого `data-hp` (прецедент `room-draft`) и была бы неверной записью для
  `gs-wall-fill`; (в) `gs-wall-fill` отсутствует в последнем опубликованном stable `v1.82.0`.
  - Прочитан `docs/data-hp-contract.json`: `retiredHooks` содержит только `room-draft` (`since`:
    `1.60.2-beta.1`, `retired`: `1.73.0-beta.1`) — ключ реестра **не** `data-hp="room-draft"` сам по себе,
    запись — про значение корневого атрибута. `hooks.field.attributeMetadata["data-field"]` существует
    (`since`, `value`, `meaning`, `audience`) и не содержит `retiredValues` — предложенный путь аддитивен,
    конфликта со схемой нет.
  - `git grep -n gs-wall-fill v1.82.0 -- src/editors/general-settings-dialog.ts docs/STYLING-HOOKS.md
    docs/data-hp-contract.json` → без совпадений, `exit=1` — воспроизведено дословно, совпадает с заявленным в
    хендоффе результатом. `git rev-list -1 v1.82.0` → `eb172115f3b90568d22a8b99dc947dd66cf2b409` — commit,
    процитированный автором (`eb172115f`), действительно тег `v1.82.0` (тег аннотированный, `git rev-parse
    v1.82.0` отдаёт объект тега, а не коммит — проверено `git cat-file -t v1.82.0` → `tag`).
  - `git log -p -- src/editors/general-settings-dialog.ts | grep gs-wall-fill` → ровно один коммит добавляет
    строку `data-hp="field" data-field="gs-wall-fill"` целиком — подтверждает, что `gs-wall-fill` никогда не
    существовал как отдельный DOM id/CSS-хук до появления атрибута `data-field` (#1011, `since: 1.83.0`); это
    не «удаление давно опубликованного идентификатора», а отмена ещё не доехавшего до stable тестового поля.
  - Итог: аргумент технически корректен и его компоненты независимо воспроизведены, а не переписаны со слов
    автора. Старая половинчатая цитата §7.1 («presence follows the product»), из-за которой был выставлен
    Medium в r2, из текста убрана; новое обоснование опирается на факт отсутствия публикации в stable, а не
    на спорную интерпретацию одного предложения — это закрывает именно то расхождение, которое отметил r2
    (`docs/STYLING-HOOKS.md:364-376` против полутекста issue), и дополнительно констатирует, что общее правило
    §7.1 для уже опубликованных stable hook'ов не отменяется.
  - `docs/STYLING-HOOKS.md` §7.8 (строки 547-549: «`schemaVersion: 1`, compatible additions and the
    one-stable-version removal policy remain unchanged») формально не исключает, что политика перехода может
    пониматься шире, чем «только корневые `data-hp`-значения» — но она сформулирована как политика для уже
    опубликованных идентичностей, и для `gs-wall-fill` этого условия не выполнено (см. выше). Автор прямо
    называет этот компромисс решением «обязательной» metadata-записи сверх строгого минимума, а не отрицанием
    правила — последовательно с осторожной трактовкой.
- `specFormatErrors(body, 'ask')` перезапущен мной напрямую (`node` импорт `scripts/review-preflight.mjs`) на
  актуальном теле issue → `[]`, совпадает с заявленным в хендоффе PASS.
- `test/data-hp-contract.test.mjs` (действующий, непродуктовый) прочитан целиком: валидирует корневые
  `data-hp`-значения и `data-tool`-словарь против `contract.hooks`/`contract.hooks.tool`, но **не** содержит
  сегодня проверки отдельных значений `data-field` против декларированного списка — предложенный новый тест
  добавляет новое измерение контроля, не дублирует и не конфликтует с существующими кейсами.
- Остальной текст ТЗ (контракт поведения, модель данных/миграция, UX, i18n, риски, откат) сверен построчно с
  текстом, процитированным в `SPEC-REVIEW-1037-r1.md`/`r2.md`, и идентичен — делта в этих разделах отсутствует
  (единственное отличие вне DOM-identity — добавленная фраза в AC9, см. «Закрытие раунда r2»).
- Открытых продуктовых вопросов не найдено (`grep` по телу на «владельц»/«вопрос»/`TODO`/`blocked`) — остаток
  текста про владельца описывает уже принятое 22.10.2026 решение о совместном окрашивании имени и показателей,
  не новый вопрос.

## Находки

Нет. High — 0, Medium — 0.

## Что проверено и корректно

- **Закрытие r2 подтверждено исполнением, не декларацией.** Технический аргумент о том, что `gs-wall-fill` —
  значение `data-field`, а не самостоятельное значение `data-hp`, и потому не подходит под `retiredHooks`,
  верен по структуре `docs/data-hp-contract.json`. Факт «`gs-wall-fill` не публиковался в stable» подтверждён
  независимым запуском `git grep` на теге `v1.82.0` и `git log -p` по истории файла — ровно то же, что заявил
  автор, без расхождений.
- Новая обязательная (не опциональная) запись `hooks.field.attributeMetadata["data-field"].retiredValues
  ["gs-wall-fill"]` с полями `ownerDialogKind`/`replacementDialogKind`/`replacementField`/`issue`/`reason`/
  `since` — аддитивна, не меняет `schemaVersion`, не создаёт скрытый DOM-дубликат и не конфликтует с
  существующей схемой `attributeMetadata`.
- AC9 обновлён точечно («в metadata data-field есть его retirement/replacement, без ложного активного/
  retired data-hp») — синхронизирован с новым решением, не повис отдельно.
- План автотестов обновлён согласованно: `test/data-hp-contract.test.mjs` получает проверку обязательного
  retirement-mapping и отсутствия выдуманной записи `data-hp="gs-wall-fill"` в `hooks`/`retiredHooks`;
  `demo/smoke_e2e_hooks.mjs` по-прежнему в обязательном целевом наборе.
- Остальное содержание ТЗ (матрица редактирования, модель данных/миграция, i18n, план автотестов за пределами
  затронутого теста, риски, откат, release-артефакты) унаследовано из r1/r2 без расхождений — делта r2→r3 его
  не касается.
- Открытых продуктовых вопросов нет; `track:ask` обоснован (не переоценивается в этом раунде — делта не меняет
  основание трека).

## Чего не проверял

- **Автотесты/гейты не запускались,** кроме `specFormatErrors`, который я прогнал сам как часть проверки
  закрытия r2 (`node` вызов `scripts/review-preflight.mjs`, результат `[]`). `npx tsc --noEmit`, `npm test`,
  `npm run build` не запускались: `node_modules` отсутствует (`ls node_modules` → No such file or directory),
  зависимости на этапе `spec` не ставятся (#696, как и в r1/r2); продуктовый код не менялся с r2 (подтверждено
  `git diff --stat`), так что эти гейты не дали бы ничего сверх уже подтверждённого факта неизменности дерева.
- Не проверял `docs/release-ledger/<previous-stable>/1037.json` — релизная классификация (`major`, названная
  в ТЗ) решается до `S7` (§2.6, §11.9), не на этапе ТЗ.
- Не запускал браузер/демо-стенд — реализации нет, Chromium не установлен (#696); все сверки DOM-identity
  выполнены чтением документов/JSON и исполнением `git`/`node`-команд против истории репозитория, не через
  исполнение приложения.
- Не перечитывал заново разделы, не затронутые делтой r2→r3 (контракт поведения, модель данных и миграция,
  план автотестов за пределами одного теста, i18n, риски, откат, UX) — их корректность унаследована из r1/r2
  (см. ниже), round-scope просит разбирать дельту, не задачу целиком.
- Не выяснял, применяется ли на практике правило §7.8 STYLING-HOOKS.md («removal policy remain unchanged») к
  отдельным значениям `data-field` так же строго, как к корневым `data-hp`-значениям — прецедентов именно
  такой отставки (значение `data-field` до публикации в stable) в репозитории ещё не было; вывод о применимости
  сделан из факта «публикации в stable не было» (однозначно подтверждён), а не из разбора гипотетического
  случая, когда такая публикация уже состоялась.

## Закрытие раунда r2

| Находка r2 | Чем закрыта | Где это видно |
| --- | --- | --- |
| Medium: удаление `gs-wall-fill` не адресует `retiredHooks`/«compatible transition» из §7.1 STYLING-HOOKS.md, на который ссылается само ТЗ | Абзац «Отставка и совместимость `gs-wall-fill` (решение по r2)» заменяет половинчатую цитату §7.1 точным техническим разбором: `gs-wall-fill` — значение `data-field`, не `data-hp`, поэтому не место в `retiredHooks`; вместо этого вводится **обязательная** (не условная) аддитивная запись `hooks.field.attributeMetadata["data-field"].retiredValues["gs-wall-fill"]`; отдельно и самостоятельно обосновано, что эта конкретная идентичность никогда не публиковалась в stable (`v1.82.0` её не содержит), поэтому строгое требование «compatible transition for one following stable release» не применяется к ней, а не отменяется в принципе | Тело issue #1037, раздел `### DOM-identity и E2E-контракт`, абзацы «Отставка и совместимость `gs-wall-fill`…» и «Почему здесь нет требования сохранять рабочий глобальный селектор…»; «Файлы и модули» (`docs/data-hp-contract.json` теперь без «при необходимости»); AC9; «План автотестов» (`test/data-hp-contract.test.mjs`) |

Закрытие полное и предметное: аргумент не просто переформулирован, а усилен новым, проверяемым фактом
(отсутствие публикации в stable), и независимо воспроизведён мной через `git grep`/`git log`/`git rev-list` на
теге `v1.82.0`, а не принят со слов автора.

## Унаследовано из r1 и r2 (без повторной проверки)

Из `docs/reviews/SPEC-REVIEW-1037-r1.md` (материал `dev@307a859f506474cf3dc52f388642bae2f7b901a6`) и
`docs/reviews/SPEC-REVIEW-1037-r2.md` (материал `dev@0f92444151b6aaaf74e2cead823c5f3d2f04daa7`) принято без
повторной сверки, так как делта r3 эти участки не трогает:

- Обязательные разделы §7.1 присутствуют, DoR §2.5 выполнен (AC1–AC10 пронумерованы, у каждого способ
  доказательства; i18n RU/EN/DE/FR ключи названы; performance названа явно; touch-правило сформулировано).
- Миграционные формулы (`min(1, room_opacity+0.25)`, дефолты новых пространств `#55606c/0.55`→`0.80`, белый
  `wall_fill` `{c:'#ffffff',a:1}`) сверены построчно с `src/logic.ts`, `src/space-render.ts`,
  `src/houseplan-card.ts` на материале r1 — расхождений нет.
- `_SPACE_DISPLAY_FIELDS`/`_ROOM_DISPLAY_FIELDS` (`custom_components/houseplan/import_export.py:90-99`),
  `support_package.py`, `support_wire_schema.py`, `validation.py` — названные в ТЗ модули переноса существуют и
  содержат заявленные поля.
- Прецеденты additive-миграции без version bump (`docs/CONFIG-COMPATIBILITY.md` «Independent Glow
  compatibility» #943, «Space settings compatibility» #945) соответствуют техническому контракту ТЗ п.8.
- Отступление от универсального принципа «global → space → room → device» в `docs/ARCHITECTURE.md» «Settings
  tiers» — осознанное, подтверждено владельцем в преамбуле issue, не маскируется.
- `docs/PDF-EXPORT.md:15-18` подтверждает корректность не-скоупа по печатной палитре.
- Новая DOM-таблица (`space-border-color`, `space-name-color`, `space-fill-color`, `space-wall-fill`,
  `room-name-color-mode`, `room-name-color`, `room-fill-color`) не конфликтует с занятыми идентичностями
  реестра `docs/STYLING-HOOKS.md:533-540` и следует конвенции `gs-*/space-*/room-*`.
- Продуктовый вопрос («цвет названий красит весь блок подписи или только имя») закрыт владельцем по форме
  §7.1, открытых продуктовых вопросов нет.

## Вердикт

Зелёный. High — 0, Medium — 0. Единственная находка r2 закрыта полно и предметно, независимо перепроверена
исполнением (`git grep`/`git log`/`git rev-list` на теге `v1.82.0`, `specFormatErrors` напрямую), а не принята
на слово автора. Новых находок в делте r2→r3 нет. Побочных находок вне скоупа нет.

Маршрут: `fix` (трек `ask`; маршрут `reclassify` применим только на треке `show`).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `306d0c3d6e00` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `5733ffb29ebe9b4316243f4c20a40920bbf4b383`
  ```
  git log --all --format='%H %T' | grep 5733ffb29ebe
  ```
- Тело issue: `d3fd5ccc3de6af1f364526dae98394c613dfcda3b9f13ee9132413bc6659347e`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ2MTQsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NzA5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo3OCwib3V0cHV0X3Rva2VucyI6MzAxOTUsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTE1NDczLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MzcxOTY3OSwiY29zdFVzZEVzdGltYXRlIjoxLjUwNzkzMzh9XSwidHVybnMiOjUyLCJkdXJhdGlvbk1zIjo0NjQyMDUsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjUxMjY0MjgsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4692 output_tokens=30214 cache_creation_input_tokens=115473 cache_read_input_tokens=3719679 num_turns=52 -->
