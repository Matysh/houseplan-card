# CODE-REVIEW-956-r3

Issue: #956 · Этап: code · Трек: ask · Заход: r3 · блокирующих циклов использовано 0/4
Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`
SHA материала: `c1b83ba79ec000e4a8c711fee4d42600a427f9db` (рабочая копия на нём, `git fetch/checkout` не выполнялись)
Validate на этом SHA: success, headSha совпадает (`gh run view 39231882272 --json headSha,conclusion,headBranch` → `headSha=c1b83ba79e…`, `conclusion=success`, `headBranch=issue/956-modal-toast`) — https://github.com/Matysh/houseplan-card/actions/runs/39231882272
Route: `fix`
Побочные находки: доверенный снимок `REVIEW_FINDINGS_POLICY` — `mode=issues` (source=actions-variable, round=3); побочных Medium/High вне скоупа не найдено, новые issue не заводились.

## Почему есть r3 при зелёном r2

r2 завершился зелёным (High 0, Medium 0, `docs/reviews/CODE-REVIEW-956-r2.md`,
материал `ea31f1c8631725776d66a8b99fe25569817ab252`). Пока шло то ревью, `dev`
продвинулся ещё на коммит (слилась инфраструктурная #964), и по #312/#856
вердикт, вынесенный на уже неактуальном дереве, не переносится на новую
вершину без свежего кандидата. Автор перебазировал ветку на новый `dev`
(`ada5e0f575758bfbe3c11a14eea3c56bb4de0a81`) через канонический
`rebase-on-dev.mjs`; единственный ручной конфликт — `docs/DEVELOPMENT.md`
(оба полных блока #964 и #956 сохранены), `docs/reviews/INDEX.md` на
конфликте пересобран штатным генератором. Старый SHA материала r2
(`ea31f1c86317…`) и его дерево в текущей истории не резолвятся — ожидаемое
следствие ребейза (§2.10), а не находка.

## Скоуп

Тот же общий слой toast-уведомлений карточки, что в r1/r2: `ToastPresentation`
переносит единственный DOM-узел сообщения в footer верхнего активного
`hp-dialog` (HA или native fallback) либо в корневой плейсхолдер карточки.
Изменённые относительно `origin/dev` файлы — те же 24, что перечислены в r2
(23 из r1 плюс сам документ `CODE-REVIEW-956-r1.md`), плюс теперь также
`docs/reviews/CODE-REVIEW-956-r2.md` (опубликован в материале) и обновлённый
`docs/reviews/INDEX.md`.

Коммитов в материале 8 (`Issue: #956` на всех, кроме одного docs-only без
трейлеров — класс C, корректно): `eab8f5c61` (fix, `User-Visible: yes`, оба
changelog в этом же коммите), `3d5143c15` (test), `1169d2bf4` (docs-only, без
трейлеров), `54d470dd8` (build, одобренная владельцем база размера),
`a7faee63b` (docs, удаляет временный testing-note), `c8534ff32` (docs:
публикует `CODE-REVIEW-956-r1.md`), `da76e6e90` (docs: индекс после слияния
#964), `c1b83ba79` (docs: публикует `CODE-REVIEW-956-r2.md`). Это не новый
набор логических изменений — та же продуктовая работа r1/r2 под новыми
хэшами после второго ребейза, плюс публикация r2-документа.

## Как проверялось

### Факт «ребейз без продуктовой дельты» — проверено независимо, не со слов автора

Я не полагался на авторское заявление «дельта к r2 — только независимые
файлы #964 и документация»; проверил сам, прямым чтением `git diff
origin/dev...HEAD` по каждому изменённому файлу (не «git diff <старый
SHA>», так как старые деревья r1/r2 после ребейза не резолвятся локально —
ожидаемое следствие §2.10):

- `src/toast-presentation.ts` — прочитан целиком. Строка 62
  (`requestAnimationFrame`) и вся остальная логика (`_route`, `setToastOwner`,
  `toastRootOf`, `show`/`refresh`/`clear`/`disconnect`) побайтово совпадают с
  текстом, процитированным в r1/r2.
- `src/hp-dialog.ts`, `src/houseplan-card.ts` — дифф к `origin/dev` прочитан
  полностью: `_toastOwner`/`_syncToastOwner`/`toastRootOf`/`_toastPresentation`,
  вызовы в `connectedCallback`/`disconnectedCallback`/`firstUpdated`/
  `_requestClose`/`rejectClose`/`updated`/`_showToast`, замена `.toast` на
  `<div data-hp="toast-portal">` в обоих местах рендера карточки и
  `class="footer toast-portal"` в трёх шаблонах `hp-dialog` — идентичны
  описанию AC1–AC5 в r1/r2, расхождений не найдено.
- `src/styles/base.styles.ts`, `src/styles/toast.styles.ts` — прочитаны
  полностью; вынос `.toast`/`.toast-portal` в отдельный модуль и порядок
  `[toastStyles, css\`…\`]` в `baseStyles`/`HpDialog.styles` идентичны r1/r2.
- `test/toast-presentation.test.mjs`, `test/toast-paint-oracle.test.mjs`,
  `demo/helpers/toast-paint-956.mjs`, `demo/smoke_modal_toast_956.mjs`,
  `demo/smoke_styling_hooks.mjs` — прочитаны полностью; три node-юнита
  (owner-стек/announce-once/detach, replacement/clear retire pending frames,
  detached owner исключается + вложенные shadow root резолвятся к одной
  карточке), независимый ink-oracle и параметризованный browser-сценарий
  4×2×2 + lifecycle-ветка (nested confirm, AX-tree, keyboard/focus, таймер,
  detach) соответствуют AC1–AC6 так же, как в r1/r2.
- `scripts/mutation-registry.mjs` — дифф к `origin/dev` содержит ровно те же
  два определения (`modal-toast-below-top-layer-956`,
  `modal-toast-reannounces-on-route-956`), что цитируют r1/r2; `node
  scripts/mutation-registry.mjs --check` лично прогнан в этом раунде → exit 0
  (статическая валидность реестра, не исполнение мутанта).
- `scripts/monolith-baseline.json` — единственное отличие от `origin/dev` —
  `bundleBytes: 3217625 → 3219838`, то же одобренное владельцем значение, что
  проверяли r1/r2; остальные поля не менялись.
- `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/CHANGELOG.md`,
  `docs/CHANGELOG.ru.md`, `docs/STATUS.md` (`4885`/`393`, тот же генератор),
  `docs/testing-notes/mutation-browser-guards.md`, `docs/data-hp-contract.json`,
  `docs/release-ledger/v1.81.0/956.json`, `scripts/smoke-links.mjs` — дифф к
  `origin/dev` прочитан полностью и совпадает с содержанием, процитированным
  в r1/r2.
- `docs/testing-notes/956-modal-toast.md` отсутствует в итоговом дереве
  (создан, дважды отредактирован и затем удалён внутри материала —
  `1169d2bf4` → `54d470dd8` → `a7faee63b`); `grep -rn 956-modal-toast` по
  репозиторию не находит висячих ссылок, кроме исторических упоминаний в
  `CODE-REVIEW-956-r1.md`/`r2.md`.
- `docs/DEVELOPMENT.md` после ручного разрешения конфликта с #964: `grep -n
  "#964"` подтверждает, что блок Offline UI Lab (#964) сохранён целиком, а
  блок #956 (top-layer trap, независимые lettering reference, четыре формы/
  оба viewport/темы, `--native`/`--lifecycle`) присутствует без искажений —
  ни один блок не потерян при слиянии.
- `git merge-base --is-ancestor origin/dev HEAD` → true: ребейз чистый,
  `origin/dev` (`ada5e0f575…`, включает #964) — предок текущего `HEAD`.

Вывод: продуктовый код, тесты и демо-сценарии этого раунда идентичны тому, что
уже исполнено и подтверждено в r1 (и сверено в r2); новой продуктовой дельты
нет — вся дельта r3 относительно r2 механическая (второй ребейз + публикация
r2-документа + пересборка индекса).

### Проверено лично в этом раунде

| Проверка | Результат | Примечание |
|---|---|---|
| `gh run view 39231882272 --json headSha,conclusion,headBranch,status` | `headSha=c1b83ba79e…`, `conclusion=success`, `status=completed` | Validate привязан именно к материалу r3 |
| Построчная сверка каждого изменённого файла с r1/r2 (список выше) | расхождений нет | не повторение авторского заявления — самостоятельное чтение `git diff origin/dev...HEAD` по каждому файлу |
| `node scripts/mutation-registry.mjs --check` | PASS, exit 0 | статическая валидность реестра; мутанты не исполнялись (ночной workflow — не этот раунд) |
| `docs/DEVELOPMENT.md` — сохранность обоих блоков после ручного конфликта | оба блока (#964, #956) целиком на месте | `grep -n "#964"` + полное чтение файла |
| `git merge-base --is-ancestor origin/dev HEAD` | true | ребейз чистый, `dev` — предок `HEAD` |
| Трейлеры всех 8 коммитов материала | `fix` — `Issue:#956`/`User-Visible:yes`, оба changelog в том же коммите; `test`/`build`/`docs`(evidence)/`docs`(r1)/`docs`(index)/`docs`(r2) — `Issue:#956`/`User-Visible:no`; один docs-only (`1169d2bf4`) без трейлеров — класс C, корректно | `git show -s --format='%s%n%b'` на каждый |
| `grep -rn 956-modal-toast` | только исторические упоминания в `CODE-REVIEW-956-r1.md`/`r2.md` | временный testing-note удалён без висячих ссылок |
| Полные `npx tsc --noEmit`, `npm test`, `npm run build` + сверка bundle | не перегонял | Validate зелёный на этом точном SHA материала (подтверждено `gh run view`, не со слов); §343 разрешает не повторять при подтверждённом SHA |
| Браузерные/node-гейты (`smoke_modal_toast_956.mjs` матрица/lifecycle/native, юнит-тесты, `process-gate`) | не перегонял заново | исполняемое содержимое файлов и кода, который они проверяют, побайтово совпадает с тем, что лично исполнили прошлые ревьюеры в r1/r2 (сверено выше); материал/env/oracle не изменились — пригодный check не повторяется (§10.4, «Повторный раунд») |
| `golden:verify` | не требуется | `visual.render=false` не изменился (рендер плана не тронут) |
| `pytest tests_backend` | не требуется | Python не менялся |
| `npm run invariants` | не требуется | геометрия модели не менялась |

### Чего не проверял и почему

- Не повторял полный `npm test`/`tsc --noEmit`/`npm run build` — зелёный
  Validate привязан к точному SHA этого раунда (подтверждено `gh run view`
  напрямую).
- Не перегонял `node demo/smoke_modal_toast_956.mjs` (default/`--matrix`/
  `--lifecycle`/`--native --lifecycle`) и `node --test
  test/toast-presentation.test.mjs test/toast-paint-oracle.test.mjs` заново:
  исполняемое содержимое этих файлов и проверяемого ими кода не изменилось ни
  байтом относительно того, что лично исполнили прошлые ревьюеры в r1/r2
  (построчно сверено выше) — повторный прогон неизменившегося материала не
  требуется правилом «повторный раунд» (§10.4/#857).
- Не исполнял зарегистрированные мутанты `modal-toast-below-top-layer-956` и
  `modal-toast-reannounces-on-route-956` — запрещено вне ночного workflow, как
  и в r1/r2; статический `--check` подтверждён (см. таблицу выше), это не
  исполнение и не caught.
- Ручная проверка screen-reader/реальным GPU/физическим устройством — вне
  объёма ревью, как и в r1/r2.
- Не перепроверял 10 «common-boundary» regression-смоков и 5 смоков с
  «прямым совпадением» по `smoke-select`, лично перепрогнанных и доверенных в
  r1 — файлы, которые они защищают (`src/hp-dialog.ts`,
  `src/houseplan-card.ts`), сверены построчно к r1/r2 выше, расхождений нет.

## Риск по изменённым участкам (#707)

- **perf: `src/toast-presentation.ts:62` — токен `requestAnimationFrame`.**
  Строка и весь файл не изменились относительно r1/r2 (сверено построчно
  выше). Повторяю вывод r1/r2, проверенный лично по тексту кода на этом
  SHA: RAF планируется только из `show()`, вызываемой исключительно из
  `_showToast()` (явное действие пользователя — показ сообщения), не из
  планового рендера/pointermove. Каждый `show()` сначала отменяет предыдущий
  кадр (`cancelAnimationFrame(this._frame)`); `clear()`/`disconnect()` тоже
  отменяют pending frame. `refresh()` вызывается из `updated()` карточки на
  каждом цикле рендера, но это чистый `_route()`, который при отсутствии
  активного сообщения выходит на первой строке (`if (!root || !notice)
  return;`) без обращения к DOM и без RAF — обычный рендер карточки без
  открытого toast не создаёт работы в этом контроллере. Класс риска `perf`
  покрыт AC1 (единственное объявление на новое сообщение) и AC4 (не более
  одного активного alert, не дублирующееся объявление при рероутинге) — оба
  доказаны исполнением в r1 и не затронуты этим раундом.

## Находки

Нет. Ни новых, ни унаследованных как открытые.

## Закрытие раунда r2

r2 не содержал открытых находок (единственная Low из r1 была снята ревьюером
r1 в том же раунде и не переносилась как открытая в r2). Закрывать в r3
нечего.

| Находка r2 | Чем закрыта | Где это видно |
|---|---|---|
| — (находок не было) | — | `docs/reviews/CODE-REVIEW-956-r2.md`, раздел «Находки»: «Нет» |

## Унаследовано из r2

Весь анализ AC1–AC6, CSS-каскада, `data-hp-contract`, release-ledger
(`stable-fix`, обоснование относительно `v1.81.0`), трейлеров и перф-риска
`requestAnimationFrame` из `docs/reviews/CODE-REVIEW-956-r2.md` (материал
`ea31f1c8631725776d66a8b99fe25569817ab252`, вердикт «Зелёный, High 0, Medium
0») принят без повторного исполнения, кроме точек, явно отмеченных выше как
новая проверка этого раунда (Validate на новом SHA, сохранность обоих блоков
#964/#956 в `docs/DEVELOPMENT.md` после ручного конфликта, чистота ребейза
`git merge-base --is-ancestor`, статический `mutation-registry --check`,
побайтовая сверка кода/тестов/демо лично в r3). Основание: продуктовый код,
тесты и демо-сценарии идентичны проверенным в r1/r2 (построчная сверка выше),
а единственная содержательная дельта раунда — не продуктовая (второй ребейз
на `dev`, продвинувшийся слиянием независимой инфраструктурной #964, плюс
публикация r2-документа).

## Что проверено и корректно

- Material нового раунда действительно соответствует вершине ветки:
  `git rev-parse HEAD` = `c1b83ba79ec000e4a8c711fee4d42600a427f9db`, тот же
  SHA, что в зелёном Validate-прогоне (проверено `gh run view --json`, не
  переписано со слов пайплайна).
- Ребейз аддитивен и не внёс регресса на стыке с параллельно слившейся #964:
  единственный ручной конфликт (`docs/DEVELOPMENT.md`) разрешён сохранением
  обоих полных блоков, остальное (`docs/reviews/INDEX.md`) — штатной
  регенерацией; `origin/dev` — предок `HEAD` (чистый ребейз).
- Одобрение владельцем базы `bundleBytes: 3219838` (найдено и проверено ещё в
  r2 по issue-комментарию) не менялось в этом раунде; изменение в
  `scripts/monolith-baseline.json` по-прежнему ограничено ровно этим одним
  полем.
- Удаление временного `docs/testing-notes/956-modal-toast.md` не оставило
  висячих ссылок за пределами исторических упоминаний в документах ревью;
  содержательная evidence (red witness, матрица 16/16, lifecycle, таблица
  «AC · чем доказан · чем краснеет») осталась в issue-комментариях.
- `docs/reviews/CODE-REVIEW-956-r1.md` и `r2.md` оба присутствуют в материале
  и опубликованы корректными коммитами (`c8534ff32`, `c1b83ba79`); генератор
  индекса (`node scripts/reviews-index.mjs`), прогнанный локально для
  проверки, подтверждает, что после публикации r3-документа индекс будет
  содержать все три строки #956 code-review — расхождений в содержании
  опубликованных r1/r2-документов с их оригиналами нет.
- Трейлеры `Issue:`/`User-Visible` на месте на всех некоторых-docs-only
  коммитах материала; `User-Visible: yes` у `fix`-коммита сопровождается
  правкой обоих changelog в том же коммите (§8).
- Перф-риск `requestAnimationFrame` (toast-presentation.ts:62) разобран выше,
  код не изменился относительно лично исполненной в r1 проверки, выводы
  остаются в силе; покрыт AC1/AC4 ТЗ.

## Вердикт

Зелёный. High: 0, Medium: 0 (ни в скоупе, ни вне его). Новых находок нет.
Раунд образован не поведением кода, а тем, что `dev` продвинулся во время r2
слиянием независимой инфраструктурной задачи #964 (#312/#856) — материал
проверен заново на точном SHA, продуктовая дельта относительно r2 отсутствует
(подтверждено построчной сверкой и чтением диффа лично, не доверием к
авторскому заявлению), единственные предметные изменения этого раунда —
второй ребейз и публикация r2-документа ревью.

---

<!-- material-anchors: заполняется конвейером (#414) -->

## Материал раунда

- Ветка: `issue/956-modal-toast`, коммит `c1b83ba79ec0`.
- Тело issue: `ee6c34acc7eda9c02feefde123fbe4e1c0c9b47f10dc17fb092604a3474ee47d`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/956-modal-toast`, коммит `c1b83ba79ec0` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `56466e39cfbea14cfb0e4597951a583b57782090`
  ```
  git log --all --format='%H %T' | grep 56466e39cfbe
  ```
- Тело issue: `ee6c34acc7eda9c02feefde123fbe4e1c0c9b47f10dc17fb092604a3474ee47d`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ4NTIsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0OTQyfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo2NCwib3V0cHV0X3Rva2VucyI6MjM0NTksImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTEyNjQ2LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MzAxOTE2NCwiY29zdFVzZEVzdGltYXRlIjoxLjI4OTEzNDgwMDAwMDAwMDJ9XSwidHVybnMiOjQ0LCJkdXJhdGlvbk1zIjoyNzQ0NjgsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjI5NDA3NjgwMDAwMDAwMDIsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4916 output_tokens=23477 cache_creation_input_tokens=112646 cache_read_input_tokens=3019164 num_turns=44 -->
