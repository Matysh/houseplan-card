# SPEC-REVIEW-1022-r2

**Issue:** #1022 — «Конвертер: импорт расстановки устройств из карточки picture-elements»
**Этап:** spec (PROCESS.md §2.4) · **Трек:** ask · **Заход:** r2 · **Блокирующих циклов на входе в раунд:** 1/4 (бюджет этапа `spec`; бюджет этапа `code` — отдельно 1/4, задача прямо пишет в «Скоуп», что он не обнуляется этим раундом)
**Материал:** тело issue #1022, раздел `## ТЗ`. `bodyDigest: c21f263172801ed50e9db382370ee2a35644ca232139f7969d9216e777c9b11d` (сверено с REVIEW_CONTEXT, отличается от r1 — тело менялось). Рабочая копия и дерево материала — на `9bdf7ad3663e4aa43cc7a4ec87bd6cb05746fb41` (дерево `69defa127f0d28baad7c7f82b9075f53d1fbcee4`), `changedFiles: []`: это снова ревью ТЗ, продуктовый/конвертерный код в материале не менялся — изменилось только тело issue (правка M1 из r1 внесена редактированием issue, не коммитом). Дерево совпадает с тем, на котором ранее опубликован `docs/reviews/SPEC-REVIEW-1022-r1.md` (коммиты `docs: review document for #1022` на `HEAD`); код задачи по‑прежнему живёт в непубликуемой в этом раунде ветке `issue/1022-picture-elements-convert` и явная строка ТЗ («прежняя реализация не является основанием приёмки») верно не даёт опираться на него как на доказательство.
**Побочные находки / маршрут (#926):** доверенный снимок `REVIEW_FINDINGS_POLICY` — `mode:"issues"`, `round:2`, `stage:"spec"` — совпадает с переданной политикой. Новых находок вне скоупа этого раунда нет, `outside_findings` пуст.
**Маршрут вердикта (#726):** `route: fix` (этап `spec`; `reclassify` действует только на код-ревью `show`).

## Скоуп

Третий источник конвертера `houseplan.tech/convert`: карточка HA `picture-elements` → документ импорта пространства House Plan (подложка-ссылка, устройства/виртуальные маркеры/живой текст на местах картинки; комнаты/стены/масштаб — задача редактора после импорта). Это третий раунд работы над #1022 по существу и **второй раунд именно ревью ТЗ**. Предыдущий раунд (`SPEC-REVIEW-1022-r1.md`) вернул жёлтый вердикт с единственной находкой M1: абзац «Контракт поведения» внутри самого `## ТЗ` противоречил себе насчёт судьбы элемента `type: image` без `entity` — одно предложение вводило virtual-маркеры только для `service-button`/`icon`, а другое оперировало парой «icon/image без поддерживаемого действия», оставляя открытым тот же класс нерешённого продуктового вопроса (`ux-contract`), из-за которого вернулся ещё более ранний код-ревью. Автор внёс адресную правку (комментарий 6416364436, «М1 SPEC r1 исправлена адресно») и перевёл задачу в `S4-spec-review`.

Обслуживаемая строка `docs/SCOPE.md`: J4 «From zero to a working plan in one evening, no Inkscape/YAML» — конвертер снимает барьер миграции с конкурирующего формата picture-elements в тот же onboarding-поток (image/draw → floors-import wizard), не создавая нового продуктового редактора.

Прочитаны: `docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md`, тело issue #1022 целиком (включая весь контекст до `## ТЗ`, сам `## ТЗ` и приложенный раздел «Дельта после SPEC r1»), все комментарии треда (включая оба preflight-отказа, оба вердикта `S4-spec-review`/`S7-code-review` предыдущих раундов и финальный «Взял: автор ТЗ»), `docs/reviews/SPEC-REVIEW-1022-r1.md` как материал предыдущего раунда (как источник находки M1 и её формулировки «что нужно для зелёного», не как довод за приёмку), фрагменты текущей реализации на ветке задачи — только для проверки осуществимости утверждений ТЗ о «уже существующих» механизмах, не как основание приёмки нового контракта.

## Как проверялось

На этапе `spec` диффа кода нет (`changedFiles: []`), поэтому `tsc`/`npm test`/`npm run build`/`gate:small`/`pytest` не прогонялись и не требуются (§2.4/§2.5 PROCESS.md; зависимости и Chromium на этом этапе не ставились, #696). Повторный раунд разбирается по дельте (§2.10): дельта — правка M1, остальной текст `## ТЗ` не менялся (сверено построчно с материалом r1).

- **Проверка закрытия M1.** Сравнил абзац «Контракт поведения» r1 и r2 построчно. В r1 было: «…virtual markers… service-button и icon без entity…» (предложение 1, без `image`) против «…icon/image без поддерживаемого действия…» (предложение 5, пара `icon/image`) — внутреннее противоречие. В r2 предложение 5 переписано на «virtual icon/service-button без поддерживаемого действия» — пара `icon/image` из формулировки убрана, остался согласованный набор `service-button`/`icon` без `entity`. Добавлено отдельное явное предложение про `type: image`: «Отдельный элемент type: image (как со state_image/state_filter, так и статичный) в этой задаче не становится ни virtual, ни декором: он явно пропускается с element_skipped/image_unsupported и исходным id/индексом в отчёте. Это не относится к image самой карточки: её подложка переносится отдельным правилом выше.» — это снимает оба прочтения, названных в M1 как неразрешимые: `image` явно и безусловно не создаёт ни virtual-маркер, ни декор, и явно отделён от подложки карточки. AC3 дополнен симметричной фразой: «Отдельный type:image без entity или с entity, static/state_image/state_filter и с tap_action, всегда имеет явный skipped report с id и не создаёт ни virtual marker, ни decor…» — ровно то «добавить image в соответствующий AC», которое требовало «что нужно для зелёного» в r1. Условие M1 выполнено текстом, а не заявлением автора.
- **Проверка отсутствия нового аналогичного противоречия.** Перечитал весь абзац «Контракт поведения» целиком и соседние абзацы (`state-icon/icon`, `state-label`, `left/top`) на предмет того же паттерна (одно предложение определяет категорию, другое её расширяет под другим именем). Других пар вида «X, Y без поддерживаемого действия», где Y не входит в ранее названную категорию, не нашёл: везде, где упоминаются virtual-маркеры, речь идёт ровно о `service-button`/`icon` без `entity`; `image` упоминается только в выделенном предложении и в AC3, без повторного смешения.
- **Остаточная формулировка вне `## ТЗ`.** Раздел «Что переносится (сопоставление)» (предшествует `## ТЗ`, часть исходного «Запроса владельца») по‑прежнему содержит старую строку таблицы: «`service-button`, `icon`/`image` без `entity` → виртуальное устройство с действием / декор-картинка ссылкой». Формально это не изменяет вывод: `docs/reviews/SPEC-REVIEW-1022-r1.md` (скоуп) уже зафиксировал для этой же задачи, что «разделы выше [`## ТЗ`] («Запрос владельца» … «Границы») — контекст/история, не обязывающий артефакт по §7.1 AGENTS.md», и сам ТЗ так же трактует себя («## ТЗ» — ровно формальный раздел). Внутри `## ТЗ` противоречия больше нет. См. находку ниже уровня блокирующей (Low, не образует цикл).
- **Точечная осуществимость (конкретный непокрытый вопрос).** ТЗ продолжает опираться на три «уже существующих» механизма конвертера/продукта, которые должны остаться без изменений этой задачей: (1) общий ограниченный ридер с byte/depth/node-лимитами и защитой от alias/dup-key/non-finite — прочитал `scripts/sh3d-convert/easy-read.mjs:1-75` (`MAX_EASY_BYTES`/`MAX_EASY_DEPTH`/`MAX_EASY_NODES`, `checkTree` отклоняет alias/anchor/tag/non-finite/forbidden-keys, `parseDocument` с `uniqueKeys: true`) — функция `readCard` уже отделена от `readEasy` и пригодна для переиспользования под `type: picture-elements`, что делает AC1 осуществимым без новой инфраструктуры; (2) безопасный image-reference контракт — прочитал `scripts/sh3d-convert/easy-style.mjs:60` (`safeImageReference`) и `scripts/sh3d-convert/easy-content.mjs:72-84` (`image_external_reference`) — контракт уже существует и именно в заявленном виде (внешняя ссылка помечается кодом, не блокируется); (3) secure no-op для `lock`/`alarm` — подтвердил в `src/device-toggle.ts:211` (`if (domain === 'lock' || domain === 'alarm_control_panel') return true`), инвариант не новый и не ослабляется текстом ТЗ. Все три опоры контракта реальны, а не додуманы.
- **Бухгалтерия раунда.** «Скоуп» ТЗ не изменился текстом относительно r1: ветка `issue/1022-picture-elements-convert` сохраняется, бюджет код-ревью 1/4 не обнуляется, бюджет spec — отдельный счётчик, этот заход r2 входит с 1/4 блокирующих циклов (лимит 4) — соответствует «Находки и вердикт» (`docs/process/REVIEWER.md`) и §4 PROCESS.md.

**Чего не проверял:** код конвертера на ветке задачи как предмет приёмки (текст ТЗ сам исключает прежнюю реализацию из оснований приёмки; прочитан только фрагмент `scripts/sh3d-convert/picture.mjs`, доступный в дереве материала, исключительно для диагностики в r1 — в r2 не перечитывал заново, так как вопрос был текстовый, не кодовый); `pytest`/HA-гарнитур/browser smoke — неприменимо на этапе `spec`, `changedFiles: []`; содержательная классификация `docs/release-ledger/v1.82.0/1022.json` — решение автора перед код-ревью, не предмет спек-ревью; трейлеры `Issue:`/`User-Visible:` — коммитов класса A по новому контракту нет; добровольная ручная/GPU-приёмка владельцем — не требуется (#929).

## Находки

### Low — остаточная формулировка в преамбуле issue (вне `## ТЗ`) не обновлена вслед за M1

Раздел «Что переносится (сопоставление)», предшествующий `## ТЗ`, по‑прежнему пишет: «`service-button`, `icon`/`image` без `entity` → виртуальное устройство с действием / декор-картинка ссылкой; что не ложится — отчёт», а в «Не переносится, идёт в отчёт с кодом» остаётся формулировка про `image` с `state_image`/`state_filter` как «повод включить свечение» — обе фразы устарели относительно финального решения в `## ТЗ` (`type: image` без исключений всегда `element_skipped`/`image_unsupported`, никогда virtual/decor). Это тот же содержательный вопрос, что и M1, но в тексте, который сам предыдущий раунд этого же ревью явно исключил из обязывающего артефакта («разделы выше `## ТЗ` — контекст/история», `SPEC-REVIEW-1022-r1.md`, раздел «Скоуп»). Формальный контракт (`## ТЗ` → «Контракт поведения» + AC3) самодостаточен и однозначен без обращения к преамбуле, поэтому цикла не открываю. Автору стоит синхронизировать преамбулу при следующей правке issue, чтобы она не вводила в заблуждение читателя, начинающего с начала тела, — но это не блокирует «Готово к разработке».

Других Medium/High находок к тексту `## ТЗ` в этом раунде нет.

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| M1 — «Контракт поведения» противоречил себе насчёт `type: image` без `entity` (одно предложение не называло `image`, другое оперировало парой «icon/image без поддерживаемого действия», совпадающей со старой досоглашательной таблицей) | Фраза «icon/image без поддерживаемого действия» заменена на «virtual icon/service-button без поддерживаемого действия»; добавлено отдельное предложение, явно и безусловно относящее `type: image` (с entity или без, static/state_image/state_filter) к `element_skipped`/`image_unsupported`, никогда не virtual и не decor, с явным разграничением от подложки самой карточки | issue #1022, тело (`bodyDigest c21f263…`), раздел `## ТЗ` → «Контракт поведения», абзац про virtual markers (последнее предложение) и отдельное предложение про `type: image`; то же решение продублировано в AC3 («Отдельный type:image без entity или с entity… всегда имеет явный skipped report… не создаёт ни virtual marker, ни decor») |

## Унаследовано из r1

Без повторной проверки в r2 принято (материал: `docs/reviews/SPEC-REVIEW-1022-r1.md`, тело issue на `bodyDigest f03da13ca50ef2c6efb0cfd2e12412a1923075284477bad0ac2fb7332bef9186`, дерево `0757552a4cba69440c642a4a5589abb9229a16e1`), так как дельта r1→r2 текстуально не затронула эти положения:

- Наличие и порядок всех обязательных разделов §7.1 (сценарий / что человек увидит / проблема / скоуп и не-скоуп / UX / модель данных и миграция / i18n / AC1–AC8 / план автотестов / риски / откат / release-артефакты) — построчно сверено в r1, в r2 перечитано ради нового текста M1, расхождений в остальных разделах нет.
- Закрытие двух исходных продуктовых вопросов решениями владельца (`state-label` → живой текст; `service-button`/`icon` без `entity` → virtual markers) — дословные формулировки ТЗ не менялись между r1 и r2 вне абзаца M1.
- Осуществимость «ни новых config fields»: действия `run`/`tap_target`/`tap_confirm` и инвариант secure no-op для `lock`/`alarm` уже существуют в модели и рантайме — подтверждено чтением `src/logic.ts:924`, `src/types.ts:198-199`, `src/device-toggle.ts:468-481`, `src/editors/marker-dialog.ts:366-390`, `src/houseplan-editor-runtime.ts:7585-7688,11265` в r1; в r2 точечно переподтверждён только сегмент secure no-op (`src/device-toggle.ts:211`) как часть проверки осуществимости новой формулировки M1, остальное не перечитывалось — материал не менялся.
- Корректность не-скоупа и терминологии (автопоиск из дашборда, stacked/grid/conditional/custom, геометрия, исполнение YAML/CSS/HA-сервисов, выгрузка на сервер, округление позиций при импорте уже не выполняется продуктом) — текст этих разделов не менялся.
- Бухгалтерия: бюджет код-ревью 1/4 не обнуляется, бюджет spec считается отдельно по этапу — правило не изменилось.

## Что проверено и корректно

- **M1 закрыта по существу, не формально.** Противоречие снято в самом определяющем предложении (не вынесено в отдельный необязательный комментарий), и симметрично отражено в AC3 — ровно то, что требовало «что нужно для зелёного» из r1: либо явное решение в обоих предложениях абзаца, либо явный вопрос владельцу. Автор выбрал первый путь и выполнил его полностью, без недосказанности.
- **Повторного появления того же класса дефекта (`ux-contract`, нерешённый молча продуктовый вопрос) в `## ТЗ` не нашёл.** Перечитал весь абзац «Контракт поведения» и соседние на предмет скрытых пар категорий — других мест, где одно предложение определяет множество уже строго, а другое расширяет его под другим именем, нет.
- **Три опорных «уже существующих» механизма, на которые ссылается контракт, реальны**: общий ограниченный ридер с явными лимитами (`easy-read.mjs`), безопасный image-reference контракт (`easy-style.mjs`, `easy-content.mjs`), secure no-op для `lock`/`alarm` (`device-toggle.ts`). ТЗ не вводит новую опасную поверхность и не ослабляет существующие инварианты (включая «The lock invariant» из `docs/SCOPE.md`).
- **DoR §2.5 остаётся закрытым по всем пунктам**, включая «открытых продуктовых вопросов нет» — M1 был единственным, он закрыт текстом, новых вопросов правка не создала.

## Чего не проверял

- Код конвертера на ветке `issue/1022-picture-elements-convert` как предмет приёмки — вне скоупа спек-ревью по тексту самого ТЗ.
- Любые кодовые гейты (`tsc`, `npm test`, `npm run build`, `gate:small`, `pytest tests_backend`, browser smoke, HA harness) — неприменимо на этапе `spec` без изменённого материала (`changedFiles: []`); зависимости и Chromium по #696 не устанавливались.
- Содержательную классификацию `docs/release-ledger/v1.82.0/1022.json` — решение автора перед код-ревью.
- Трейлеры `Issue:`/`User-Visible:` и правки changelog — неприменимо, коммитов класса A по новому контракту нет.
- Добровольную ручную/GPU-приёмку владельцем — не требуется (#929).

## Вердикт

**Зелёный.** High: 0, Medium (в скоупе): 0. Единственная находка предыдущего раунда (M1) закрыта адресно и по существу внутри `## ТЗ` (абзац «Контракт поведения» + AC3), повторной проверкой не выявлено ни остаточного противоречия в формальном тексте, ни нового открытого продуктового вопроса. Три технических опоры контракта (ограниченный ридер, безопасный image-reference, secure no-op lock/alarm) подтверждены как существующие. Единственное замечание (Low, остаточная формулировка в преамбуле issue до `## ТЗ`) не образует цикла — тот же вывод, что уже зафиксирован в r1 относительно статуса текста вне `## ТЗ`. ТЗ готово к статусу «Готово к разработке».

**Гейты этого раунда:** кодовые гейты (`tsc`, `npm test`, `npm run build`, `gate:small`, `pytest`, smoke, HA harness) не прогонялись и не требовались — этап `spec`, диффа кода нет (`changedFiles: []`, #696). Прогнано адресное чтение: полный текст тела issue (включая дельту M1) и всех комментариев треда; `docs/SCOPE.md`/`AGENTS.md`/`docs/process/REVIEWER.md`; `docs/reviews/SPEC-REVIEW-1022-r1.md` как материал предыдущего раунда; построчное сравнение абзаца «Контракт поведения» r1 vs r2; точечная проверка осуществимости трёх существующих механизмов — `scripts/sh3d-convert/easy-read.mjs`, `scripts/sh3d-convert/easy-style.mjs`, `scripts/sh3d-convert/easy-content.mjs`, `src/device-toggle.ts`.

**Маршрут побочных находок:** `mode: issues`, новых находок вне скоупа нет — `outside_findings` пуст.

## Материал раунда

- Issue: #1022, `bodyDigest: c21f263172801ed50e9db382370ee2a35644ca232139f7969d9216e777c9b11d`.
- Дерево материала: `69defa127f0d28baad7c7f82b9075f53d1fbcee4` (SHA `9bdf7ad3663e4aa43cc7a4ec87bd6cb05746fb41`), `changedFiles: []`.
- Предыдущий раунд: `docs/reviews/SPEC-REVIEW-1022-r1.md`, тело `bodyDigest f03da13ca50ef2c6efb0cfd2e12412a1923075284477bad0ac2fb7332bef9186`, дерево `0757552a4cba69440c642a4a5589abb9229a16e1`, вердикт жёлтый, Medium 1 (M1).
- Вердикт этого раунда: зелёный · High 0 · Medium 0 · маршрут `fix`.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjMwNTg1YTFjNDFhY2I1YmIzMDNiMTliZjZjOTEyNGMyMmFjYWM5ODQ2NzM3M2UwMjg0ZWNiYzRlNjE0ZGQwNDIiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI2MWQ2OGEzODk4MTM0OGYzNTU4ZWIyZTU0ODg5MWRmNTZmYjU4NzU1MzhjZDNmZjZmNjE1MjdhNDRkYjI0ZjA2IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDIyLCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiI5YmRmN2FkMzY2M2U0YWE0M2NjN2E0ZWM4N2JkNmNiMDU3NDZmYjQxIiwidHJlZSI6IjY5ZGVmYTEyN2YwZDI4YmFhZDdjN2Y4MmI5MDc1ZjUzZDFmYmNlZTQiLCJib2R5RGlnZXN0IjoiYzIxZjI2MzE3MjgwMWVkNTBlOWRiMzgyMzcwZWUyYTM1NjQ0Y2EyMzIxMzlmNzk2OWQ5MjE2ZTc3N2M5YjExZCIsInByb2R1Y2VyUnVuIjoiNDAzMjUzMDY4MzMiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjY4MDQ2YTYzNDYxMzM2NDNlZGFmZWU0MmEwZmM0MzEyN2QwMzJkZjJhYzJlNjkyNGMwYjI4ZWQwMTAyMzQ1ZTAiLCJ2ZXJkaWN0RGlnZXN0IjoiNWYxNTQ4Y2VmZDE0ZTA5YzQ4NzkzNTYwNzhjNmMzNzQ3NmM1ODM2NzljYWYyZDk2MDgzZTY5NDdlZGVkNTY0ZiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI4ZDE5MzM5MzYyYmM0MGUzYTNiNjAwZjg4NmIzZjNmYWVhMzFiNDYyOWNjZDk3YjZjZTNlMmEzYmQyYThlZmRkIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDE2NTU2NzcxLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDIyI2lzc3VlY29tbWVudC02NDE2NTU2NzcxIiwiYm9keURpZ2VzdCI6ImE3MzNlMWY4ZmNlMmI4YjMzYzQ4MzI2YmM2NmFhNjJkYjIzYTkyNzVlOGZhYzBkMTg5MWE0YTQ0ZWIyNTc2NTkifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1022-picture-elements-convert`, коммит `9bdf7ad3663e` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `69defa127f0d28baad7c7f82b9075f53d1fbcee4`
  ```
  git log --all --format='%H %T' | grep 69defa127f0d
  ```
- Тело issue: `c21f263172801ed50e9db382370ee2a35644ca232139f7969d9216e777c9b11d`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NDAsIm91dHB1dF90b2tlbnMiOjM2NDgzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEzMjQ3NCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjE1MDk4MDYsImNvc3RVc2RFc3RpbWF0ZSI6MS4xOTY3NjcyfV0sInR1cm5zIjozMSwiZHVyYXRpb25NcyI6NDM4NjE3LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4xOTY3NjcyLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=40 output_tokens=36483 cache_creation_input_tokens=132474 cache_read_input_tokens=1509806 num_turns=31 -->
