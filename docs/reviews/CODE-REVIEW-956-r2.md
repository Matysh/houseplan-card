# CODE-REVIEW-956-r2

Issue: #956 · Этап: code · Трек: ask · Заход: r2 · блокирующих циклов использовано 0/4
Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`
SHA материала: `ea31f1c8631725776d66a8b99fe25569817ab252` (рабочая копия на нём, `git fetch/checkout` не выполнялись)
Validate на этом SHA: success, headSha совпадает (https://github.com/Matysh/houseplan-card/actions/runs/39229516281)
Route: `fix`
Побочные находки: `mode=issues` (доверенный снимок prepare) — побочных Medium/High вне скоупа не найдено, новые issue не заводились.

## Почему есть r2 при зелёном r1

r1 завершился зелёным (High 0, Medium 0, `docs/reviews/CODE-REVIEW-956-r1.md`,
материал `100a33f686b9d0a45bb628097fac3d5ad46612a3`). Пока шло то ревью, `dev`
продвинулся (слились #961, #962, #963), и по #312/#856 вердикт, вынесенный на
уже неактуальном дереве, не переносится на новую вершину без свежего
кандидата. Автор перебазировал ветку на новый `dev` (`aa2e7db5c5e8a760b1d2a1effd36ba403c5c5041`)
через канонический `rebase-on-dev.mjs` и дополнил материал двумя
коммитами: применением одобренной владельцем базы размера бандла и переносом
«author implementation checkpoint» из временного `docs/testing-notes/956-modal-toast.md`
в канонический issue-комментарий. Старый SHA `100a33f686b9…` и его дерево
`e1bab09ea025…` в текущем материале не резолвятся — это ожидаемое следствие
ребейза (§2.10), а не находка: `100a33f686b9…` был частью переписанной истории
ветки `issue/956-modal-toast`, которую ребейз заменил, сохранив эквивалентное
содержимое под новыми хэшами.

## Скоуп

Тот же общий слой toast-уведомлений карточки, что в r1: `ToastPresentation`
переносит единственный DOM-узел сообщения в footer верхнего активного
`hp-dialog` (HA или native fallback) либо в корневой плейсхолдер карточки.
Изменённые относительно `origin/dev` файлы те же 23, что перечислены в r1,
плюс сам документ `docs/reviews/CODE-REVIEW-956-r1.md` (теперь часть истории)
и обновлённый `docs/reviews/INDEX.md`.

Коммитов в материале 7 (все с `Issue: #956`, трейлер `User-Visible` на
не-docs-only): `8e7b15ca6` (fix, `User-Visible: yes`, оба changelog в этом же
коммите), `a7d5ba0dc` (test), `19470ee76` (docs-only, без трейлеров — класс C,
корректно), `4193f296b` (build, применяет одобренную базу размера),
`8e373ab38` (docs, удаляет временный testing-note), `e40fc6522` (docs:
публикует `CODE-REVIEW-956-r1.md`), `ea31f1c86` (docs: индекс). Это не новый
набор логических изменений — это те же 5 коммитов r1 под новыми хэшами плюс
два служебных (публикация r1-документа и индекс), которые не являются
авторской работой этого раунда.

## Как проверялось

### Факт «ребейз без продуктовой дельты» — проверено независимо, не со слов автора

Я не смог разрешить старый SHA `100a33f686b9…` локально (ожидаемо после
ребейза, см. выше), поэтому не повторял буквально авторскую команду
`git diff 100a33f686b9… HEAD -- src …`. Вместо этого построчно сверил
содержимое каждого изменённого относительно `origin/dev` файла с тем, что
дословно процитировано и описано в `docs/reviews/CODE-REVIEW-956-r1.md`:

- `src/toast-presentation.ts` — полностью читан; строка 62
  (`requestAnimationFrame`) и вся остальная логика (`_route`, `setToastOwner`,
  `show`/`clear`/`disconnect`) побайтово совпадают с тем, что цитирует r1.
- `src/hp-dialog.ts`, `src/houseplan-card.ts` — дифф к `origin/dev` читан
  полностью; `_toastOwner`/`_syncToastOwner`/`toastRootOf`/`_toastPresentation`
  и вызовы в `connectedCallback`/`disconnectedCallback`/`firstUpdated`/
  `_requestClose`/`rejectClose`/`updated`/`_showToast` соответствуют описанию
  AC3–AC5 в r1 без расхождений.
- `src/styles/base.styles.ts`, `src/styles/toast.styles.ts` — читаны
  полностью; вынос `.toast`/`.toast-portal` в отдельный модуль, порядок
  `[toastStyles, css\`…\`]` в `baseStyles` и `HpDialog.styles` идентичны.
- `test/toast-presentation.test.mjs`, `test/toast-paint-oracle.test.mjs`,
  `demo/helpers/toast-paint-956.mjs`, `demo/smoke_modal_toast_956.mjs`,
  `demo/smoke_styling_hooks.mjs` — читаны полностью; три юнита, независимый
  ink-oracle (допуск на один физический пиксель фазы растра, порог
  `ratio > .92`, `ink > 20`) и параметризованный browser-сценарий 4×2×2 с
  lifecycle-веткой соответствуют AC1–AC6 так же, как в r1.
- `scripts/mutation-registry.mjs` — дифф к `origin/dev` содержит ровно те же
  два определения (`modal-toast-below-top-layer-956`,
  `modal-toast-reannounces-on-route-956`), что цитирует r1; дополнительно
  проверено, что правка #962 того же файла (переписывание двух мутаций #931,
  строки ~19654) находится в полностью другом месте файла и не пересекается —
  рискованная точка слияния снята чтением, а не доверием.
- `scripts/monolith-baseline.json` — единственное отличие от значения,
  которое видел r1 (`3217625`), это новое одобренное значение `3219838`;
  остальные поля (`delegates`, `portMembers`, `hostRefs`, `portPrivates`,
  `harnessPrivates`) не менялись.
- `docs/testing-notes/956-modal-toast.md` отсутствует в итоговом дереве
  (создан и затем удалён внутри материала; `grep -rn 956-modal-toast` по
  репозиторию не находит висячих ссылок, кроме упоминаний в самом
  `CODE-REVIEW-956-r1.md`, что ожидаемо).

Вывод: продуктовый код, тесты и демо-сценарии этого раунда идентичны тому, что
уже исполнено и подтверждено в r1 лично прошлым ревьюером; новой продуктовой
дельты нет.

### Проверено лично в этом раунде

| Проверка | Результат | Примечание |
|---|---|---|
| `gh run view 39229516281 --json headSha,conclusion,headBranch` | `headSha=ea31f1c86…`, `conclusion=success`, `headBranch=issue/956-modal-toast` | Validate действительно привязан к материалу этого раунда, не к старому |
| Сверка `scripts/monolith-baseline.json` | только `bundleBytes: 3217625 → 3219838` | дифф к `origin/dev`; полоса 2000Б и прочие лимиты не тронуты |
| Одобрение владельца на новую базу бандла | найдено в комментариях issue («Владелец в чате подтвердил: «Да, принять базу для #956». Применяю только bundleBytes 3219838…») | `gh issue view 956 --comments`; решение датировано и привязано к #956, не к другой задаче |
| Трейлеры всех 7 коммитов материала | `fix` — `Issue:#956`/`User-Visible:yes`, оба changelog в том же коммите; `test`/`build`/`docs`(×2 non-trivial)/`docs`(review)/`docs`(index) — `Issue:#956`/`User-Visible:no`; один `docs-only` (`19470ee76`) без трейлеров — класс C, верно | `git show -s --format='%s%n%b'` на каждый |
| `grep -rn 956-modal-toast` | только исторические упоминания в `CODE-REVIEW-956-r1.md` | временный testing-note удалён без висячих ссылок |
| Непересечение правок `scripts/mutation-registry.mjs` c #962 | подтверждено чтением обоих диффов | #962 правит записи #931 в другом месте файла |
| Полные `npx tsc --noEmit`, `npm test`, `npm run build` + сверка bundle | не перегонял | Validate зелёный на этом точном SHA материала (см. выше); §343 разрешает не повторять при подтверждённом SHA |
| Браузерные/node-гейты (`smoke_modal_toast_956.mjs` матрица/lifecycle/native, юнит-тесты, `mutation-gate --check`, `process-gate`) | не перегонял заново | содержимое исполняемых файлов и тестов побайтово совпадает с тем, что лично прогнал прошлый ревьюер в r1 (см. построчную сверку выше); материал/env/oracle не изменились — пригодный check не повторяется (§10.4, «Повторный раунд») |
| `golden:verify` | не требуется | `visual.render=false` не изменился (рендер плана не тронут) |
| `pytest tests_backend` | не требуется | Python не менялся |
| `npm run invariants` | не требуется | геометрия модели не менялась |

### Чего не проверял и почему

- Не повторял полный `npm test`/`tsc --noEmit`/`npm run build` — зелёный
  Validate привязан к точному SHA этого раунда (подтверждено `gh run view`
  напрямую, не со слов).
- Не перегонял `node demo/smoke_modal_toast_956.mjs` (матрица/lifecycle/
  native) и `node --test test/toast-presentation.test.mjs
  test/toast-paint-oracle.test.mjs` заново: исполняемое содержимое этих
  файлов и кода, который они проверяют, не изменилось ни байтом относительно
  того, что лично исполнил прошлый ревьюер в r1 (построчно сверено выше) —
  повторный прогон неизменившегося материала не требуется правилом
  «повторный раунд» (§10.4/#857).
- Не исполнял зарегистрированные мутанты `modal-toast-below-top-layer-956` и
  `modal-toast-reannounces-on-route-956` — запрещено вне ночного workflow,
  как и в r1; оба зарегистрированы, `execution: 0` по заявке автора
  (не перепроверялось числом — не риск этого раунда, т.к. реестр в этой части
  не менялся).
- Ручная проверка screen-reader/реальным GPU/физическим устройством — вне
  объёма ревью, как и в r1.
- Не перепроверял 10 «common-boundary» regression-смоков, лично
  перепрогнанных и доверенных в r1 (`smoke_dialog_modal_recovery` и т. д.) —
  файлы, которые они защищают (`src/hp-dialog.ts`, `src/houseplan-card.ts`),
  сверены построчно к r1 выше и расхождений не найдено.

## Риск по изменённым участкам (#707)

- **perf: `src/toast-presentation.ts:62` — токен `requestAnimationFrame`.**
  Строка и весь файл не изменились относительно r1 (сверено построчно выше).
  Повторяю вывод r1, проверенный лично по тексту кода: RAF планируется только
  из `show()`, вызываемой исключительно `_showToast()` (явное действие
  пользователя — показ сообщения), не из планового рендера/pointermove.
  Каждый `show()` сначала `cancelAnimationFrame` старого кадра;
  `clear()`/`disconnect()` тоже отменяют. `refresh()` — вызывается из
  `updated()` карточки на каждом цикле рендера, но это чистый `_route()`,
  который при отсутствии активного сообщения выходит на первой строке
  (`if (!root || !notice) return`) без обращения к DOM и без RAF. Класс risk
  `perf` покрыт AC1 (единственное объявление на новое сообщение) и AC4
  (не более одного активного alert, не дублирующееся объявление при
  рероутинге) — оба проверены исполнением в r1 и не затронуты этим раундом.

## Находки

Нет. Ни новых, ни унаследованных как открытые: единственная находка r1 (Low,
см. ниже) была снята самим ревьюером r1 в том же раунде, цикла не открывала и
не требует действий в r2.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Low: 5 smoke с «прямым совпадением» по `smoke-select` (`smoke_plan_drawing_repairs`, `smoke_plan_snap_overlay`, `smoke_room_autoclose`, `smoke_unified_wall_tool`, `smoke_wall_union_isolation`) не были лично прогнаны автором | Ревьюер r1 прочитал все 5 файлов и лично прогнал их (все PASS), снял находку записью в самом r1-документе; находка не блокировала вердикт и не открывала цикл | `docs/reviews/CODE-REVIEW-956-r1.md`, раздел «Находки», и `docs/reviews/INDEX.md` (строка `#956 · CODE-REVIEW-956-r1.md`, H0/M0, текст находки сохранён для трассировки) |

High/Medium в r1 не было, поэтому отдельного «возврата автору» не требовалось
и в r2 закрывать нечего, кроме учёта этого Low как уже снятого.

## Унаследовано из r1

Весь анализ AC1–AC6, CSS-каскада, `data-hp-contract`, release-ledger
(`stable-fix`, обоснование относительно `v1.81.0`) и трейлеров из
`docs/reviews/CODE-REVIEW-956-r1.md` (материал `100a33f686b9d0a45bb628097fac3d5ad46612a3`,
вердикт «Зелёный, High 0, Medium 0») принят без повторного исполнения, кроме
точек, явно отмеченных выше как новая проверка этого раунда (Validate на
новом SHA, одобренная база бандла, отсутствие пересечения с #961/#962/#963,
побайтовая сверка кода/тестов). Основание: продуктовый код, тесты и
демо-сценарии идентичны проверенным в r1 (построчная сверка выше), а
единственная содержательная дельта раунда — не продуктовая (ребейз +
применение уже одобренной владельцем цифры + перенос evidence в
issue-комментарий).

## Что проверено и корректно

- Material нового раунда действительно соответствует вершине ветки:
  `git rev-parse HEAD` = `ea31f1c8631725776d66a8b99fe25569817ab252`, тот же
  SHA, что в зелёном Validate-прогоне (проверено `gh run view --json`, не
  переписано со слов пайплайна).
- Ребейз аддитивен и не внёс регресса на стыке с параллельно слившимися
  задачами: `scripts/mutation-registry.mjs` (добавления #956 и правки #962 в
  разных местах файла), `docs/DEVELOPMENT.md`/`docs/STATUS.md` (оба получают
  независимые добавленные блоки от #956/#961/#962, без конфликтных маркеров
  и без искажения чисел — `docs/STATUS.md` показывает `4885`/`393`, тот же
  генератор, что цитирует r1).
- Одобрение владельцем новой базы `bundleBytes: 3219838` найдено в
  issue-комментариях, датировано тем же днём, относится явно к #956, и
  изменение в `scripts/monolith-baseline.json` ограничено ровно этим одним
  полем.
- Удаление временного `docs/testing-notes/956-modal-toast.md` не оставило
  висячих ссылок за пределами исторического упоминания в
  `CODE-REVIEW-956-r1.md`; содержательная evidence (red witness, матрица
  16/16, lifecycle, протокол гейтов, таблица «AC · чем доказан · чем
  краснеет») перенесена в issue-комментарии
  (`#issuecomment-6262253578`, `#issuecomment-6262925705`,
  `#issuecomment-6262803621`) и была доступна для чтения.
- `docs/reviews/INDEX.md` корректно перечисляет и `SPEC-REVIEW-956-r1.md`
  (spec · r1 · 🟢), и `CODE-REVIEW-956-r1.md` (code · r1 · 🟢, с сохранённым
  текстом снятой Low-находки для трассировки) — индекс не потерял историю
  между раундами.
- Трейлеры `Issue:`/`User-Visible` на месте на всех некоторых-docs-only
  коммитах материала; `User-Visible: yes` у `fix`-коммита сопровождается
  правкой обоих changelog в том же коммите (§8).
- Перф-риск `requestAnimationFrame` (toast-presentation.ts:62) разобран выше,
  код не изменился относительно лично исполненной в r1 проверки, выводы
  остаются в силе.

## Вердикт

Зелёный. High: 0, Medium: 0 (ни в скоупе, ни вне его). Новых находок нет;
единственная Low из r1 была снята ревьюером r1 и не требует действий здесь.
Раунд образован не поведением кода, а тем, что `dev` продвинулся во время
предыдущего ревью (#312/#856) — материал проверен заново на точном SHA,
продуктовая дельта относительно r1 отсутствует (подтверждено построчной
сверкой, не доверием к авторскому заявлению), единственное предметное
изменение — одобренная владельцем база размера бандла.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/956-modal-toast`, коммит `ea31f1c86317` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `af31b74a55a93a4e5e915e8ef968acec5dc7997a`
  ```
  git log --all --format='%H %T' | grep af31b74a55a9
  ```
- Тело issue: `ee6c34acc7eda9c02feefde123fbe4e1c0c9b47f10dc17fb092604a3474ee47d`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ4NDksIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0OTQ5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo1OCwib3V0cHV0X3Rva2VucyI6Mjk0NTgsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTIxNjY5LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MjY3Nzg2NywiY29zdFVzZEVzdGltYXRlIjoxLjMxNjk0NTQwMDAwMDAwMDN9XSwidHVybnMiOjQ3LCJkdXJhdGlvbk1zIjozNjIxMzMsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjMyMTg5NDQwMDAwMDAwMDEsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4907 output_tokens=29478 cache_creation_input_tokens=121669 cache_read_input_tokens=2677867 num_turns=47 -->
