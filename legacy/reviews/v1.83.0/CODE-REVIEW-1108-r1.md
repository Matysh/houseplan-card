# CODE-REVIEW-1108-r1

**Issue:** #1108 — Color picker smoke measures hue height during the accepted entrance animation
**Материал:** `101e58b71058daa3f10f4aacc1ebb03c07e5cede` (tree `3941faed69ea26ee21ab826529139999b8113ff0`)
**Трек:** show · **Этап:** code · **Заход:** r1 · Блокирующих циклов: 0/2
**Outside-findings policy:** `mode=issues` (доверенный снимок `HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`, round 1) — побочные Medium вне скоупа передаются в `outside_findings`. Побочных находок вне скоупа не обнаружено.

## Скоуп

Задача инфраструктурная (класс B/C): синхронизировать `demo/smoke_color_picker.mjs` с реальной конечной (finite) entrance-анимацией попапа color-picker (#1081), устранив гонку наблюдения (`hueTrackContract` мог ловить дробный transform-кадр вместо устоявшейся геометрии). Продукт, CSS, допуски и поведение #1093 менять запрещено. Диапазон диффа подтверждён:

- `demo/smoke_color_picker.mjs` — единственный источник смока: +5 строк после открытия попапа.
- `docs/STATUS.md` — информационная строка про синхронизацию смока.
- `docs/release-ledger/v1.82.0/1108.json` — новая запись ledger, категория `infra`.
- `scripts/ci-registry-inventory.json` — механическая правка (добавление пути новой ledger-записи в детерминированно генерируемый реестр).

Других файлов в диффе нет (`read:diff`, подтверждено выполнением чека).

## Как проверялось

Static-first: прочитан `docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md` (заменяет прямое чтение перечисленных пунктов PROCESS.md), тело issue #1108 и все 3 комментария владельца (включая диагностический отчёт #1093 с естественной 12-кадровой трассировкой и хендофф), `docs/STATUS.md`, release-ledger запись.

Независимый разбор кода — до сопоставления с авторскими выводами:
- Проверен ровно изменённый блок `demo/smoke_color_picker.mjs:31-35` через `read:diff` и `read:base:demo/smoke_color_picker.mjs` (чек-раннер, без повторного исполнения смока) — сравнение построчное, диффа вне заявленных файлов нет.
- Прослежен вызывающий путь: `trigger?.click()` → `await picker?.updateComplete` → (новое) `await Promise.all(picker.shadowRoot.querySelector('.picker').getAnimations({subtree:true}).filter(finite).map(a => a.finished.catch(()=>{})))` → `await frame()` (двойной rAF, как раньше) → первые geometry-чувствительные ассерты (`narrowViewportFits`, `hueTrackContract`, `confirmIsFullWidthTouchTarget`).
- Сверено с прецедентом `demo/smoke_color_picker_presentation.mjs:12-20` (`settle()`): тот же паттерн — `getAnimations({subtree:true})`, фильтр по конечному `endTime`, `.finished.catch(()=>{})`, двойной rAF. Идиома не новая, уже валидировалась 136 проверками presentation-смока — риск нового бага в самом паттерне низкий.
- Отсутствие optional-chaining в новой строке (`picker.shadowRoot...`, без `?.`) согласуется с уже существующим стилем файла ниже по потоку (`await picker.updateComplete` на строке 64 и далее — без `?.`); на этом этапе `trigger`/`picker` гарантированно не null, так как клик уже произошёл. Нового риска NPE правка не вносит.
- Проверено, что остальные повторные открытия попапа в том же файле (после confirm/escape) не требуют такого же ожидания: последующие geometry-чувствительные проверки (`confirmIsFullWidthTouchTarget`) выполняются внутри того же «окна» первичного открытия, до повторного закрытия/открытия; более поздние повторные открытия измеряют только логические свойства (значения, aria, события), не геометрию — патч не должен покрывать и не покрывает их.
- `getComputedTiming().endTime` конечен для анимаций с ограниченной длительностью (не `infinite`-iteration) — стандартное поведение Web Animations API; это тот же фильтр, что уже использует presentation-смок.

Сопоставление с хендоффом и proof:
- CI validate-gate зелёный на точном материале `101e58b7…` (https://github.com/Matysh/houseplan-card/actions/runs/40614355915, «review-light proof is complete»), покрывает `gate:small --base=cc9209f8…` (сборка/typecheck, product+tooling units, range/policy/budget/CSS/unused guards). Это переиспользуемое доказательство для неизменных входов/окружения — не дублировалось.
- Хендофф отдельно называет 3 нативные команды: `node demo/smoke_color_picker.mjs` (21/21, включая `hueTrackContract=true`), `node demo/smoke_color_picker_presentation.mjs` (136 проверок), `node demo/smoke_ui_lab_1081.mjs` — все на свежем bundle/pinned Chromium. Файл `demo/smoke_ui_lab_1081.mjs` существует и не входит в изменённые файлы (Glob), что подтверждает заявление «существующий тест не менялся».
- Так как сам целевой смок (`smoke:demo/smoke_color_picker.mjs`) уже исполнялся и на этом же SHA подтверждён зелёным validate-gate, повторный прогон через фиксированный runner не выполнялся — это было бы дублированием уже пригодного доказательства (не адресным пробелом).

## AC → чем доказан → чем краснеет

| AC | Доказано | Чем краснеет |
|---|---|---|
| AC1 (ожидание реальной finite-анимации перед измерением геометрии) | `node demo/smoke_color_picker.mjs` зелёный на патче (хендофф + reused validate-gate); независимо прочитан вызывающий путь — ожидание стоит именно перед первыми geometry-ассертами | Исторический CI 40610878036 (до патча) дал `hueTrackContract=false` на той же логике двух rAF без ожидания анимации — зарегистрированный внешний негативный случай (boolean, без численного сэмпла, что честно оговорено автором) |
| AC2 (строгий 32px/hue/min/max/step/gradient предикат не ослаблен; транзиентные non-32 кадры отвергаются) | Построчное сравнение диффа: сам предикат (`hue.getBoundingClientRect().height === 32` и соседние условия) не тронут ни единым символом; естественная 12-кадровая трассировка на неизменённом accepted runtime (comment 6458009624) зафиксировала 4/12 наблюдений `31.999969482421875`/`32.000030517578125`, которые строгое `=== 32` отвергает | Обычный (не мутантный) отрицательный случай — наблюдаемые естественные кадры входа анимации на неизменённой реализации, зафиксированные автором с конкретными числами/метками времени; это допустимый класс свидетеля по общей политике (не мутант, не patch-and-run) |
| AC3 (существующие behavior-ассерты и presentation-смок зелёные на свежем runtime; честная документация находки) | Все 21 предикат `smoke_color_picker.mjs`, 136 проверок `smoke_color_picker_presentation.mjs`, `smoke_ui_lab_1081.mjs` — PASS на fingerprint `06085343…`; independent review (этот документ) выполнен | N/A — AC3 не защитный (описательный/процессный), доказывается прямыми зелёными прогонами, не инвариантом |

AC2 — защитный AC (сохранение строгого инварианта геометрии); третий столбец таблицы заполнен обычным отрицательным случаем с конкретными числами и источником (issue-комментарий), что соответствует общей политике «Отрицательные проверки и мутанты» — находки нет.

## Находки

Находок High/Medium нет.

Низкоуровневые наблюдения (Low, не блокируют, не требуют действия автора):
- Комментарий к новому коду (`// #1108: ...`) объясняет неочевидный инвариант (почему нужно ждать именно finite-анимацию, а не просто ещё один rAF) — соответствует стандарту «комментарий только при неочевидном WHY», претензий нет.
- `scripts/ci-registry-inventory.json` — механическая, детерминированно генерируемая правка (`scripts/ci-registry-inventory.mjs`, staleness-guard уже встроен в сам генератор); проверено, что добавление ограничивается двумя вхождениями новой ledger-записи, согласованными по шаблону с соседними issue (#1104/#1106/#1107).

## Что проверено и корректно

- Диапазон диффа строго соответствует заявленному скоупу (4 файла, ни одного продуктового/src-файла).
- Новая логика ожидания — точная копия уже проверенного паттерна `smoke_color_picker_presentation.mjs`, что резко снижает риск нового класса дефектов.
- Строгий 32px-предикат и все остальные 20 поведенческих предикатов не изменены.
- Release-ledger классификация `infra` относительно `v1.82.0` обоснована корректно (без `introducedBy`, не нужен — не правка бета-фичи).
- `docs/STATUS.md` получил краткую фактическую строку без новых утверждений сверх диффа.
- User-Visible: не затронуто — ни одного CHANGELOG-файла в диффе нет, что согласуется с чисто тестовой правкой; трейлеры коммита (`Issue:`/`User-Visible:`) напрямую инструментами ревью не читаемы (доступный `read:log` отдаёт только oneline), но косвенно подтверждены прохождением `process-gate --issues` в составе зелёного validate-gate, который этот трейлер проверяет.
- Критерии §5 для track:show пройдены: сложность/риск низкие (5 строк в одном demo-файле), одна поверхность (один смок-файл), миграции конфига нет, нового UX-контракта нет (тест-онли), влияния на производительность/touch-контракт нет, ожидаемое поведение не ново — задача восстанавливает уже принятый (#1081) контракт анимации, не придумывает новый. → `route: fix`.

## Чего не проверял

- Полный beta golden/performance/HA E2E набор — не входит в объём гейта ревью (предрелизный гейт), и явно вне полномочий хендоффа.
- Численный CI-сэмпл исторического сбоя (#1093) — недоступен и не восстанавливался; это честно задокументировано автором и не является пробелом ревью.
- Повторный прогон `smoke:demo/smoke_color_picker.mjs`/`smoke:demo/smoke_color_picker_presentation.mjs` через фиксированный runner не выполнялся — доказательство уже пригодно (зелёный validate-gate на точном SHA, те же входы/окружение/oracle), повторное исполнение было бы дублированием, а не адресной проверкой пробела.
- Полный `gate:small`/`tsc`/`build`/`npm test` в этой сессии не перезапускался — переиспользован зелёный validate-gate того же материала.

## Гейты: что прогнано, что нет, почему

| Гейт | Статус | Почему |
|---|---|---|
| `read:diff`, `read:log`, `read:base:*` (4 файла) | Прогнано (чек-раннер) | Нужно для независимого построчного разбора диффа |
| validate-gate / `gate:small` на материале `101e58b7…` | Переиспользовано (не перезапускалось) | Уже зелёное на точном SHA, входы/окружение не менялись |
| `smoke:demo/smoke_color_picker.mjs`, `smoke:demo/smoke_color_picker_presentation.mjs`, `smoke_ui_lab_1081.mjs` | Переиспользовано из хендоффа + reused validate-gate | Тот же SHA, та же среда/oracle — целевой AC-пробел не выявлен, повтор был бы дублированием |
| `static:ci-registry-inventory` / `unit:test/release-ledger.test.mjs` | Не прогонялись отдельно | Покрыты заявленным `gate:small` (author: «свежие range/policy/budget/CSS/unused guards исполнены»); изменение механическое и детерминированное (генератор со встроенным staleness-guard) |
| Полный beta golden/perf/HA E2E | Не прогонялись | Вне объёма гейта ревью; задача инфраструктурная, AC их не называют |

## Вердикт

Зелёный. Находок High/Medium нет. Маршрут — `fix` (критерии §5 для track:show пройдены: сложность/риск низкие, одна поверхность, миграции нет, нового UX-контракта нет, перф/touch не затронуты, поведение не ново).

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjZiN2VhMWEzMDMxZWE5YzliNTQxM2EzNDQ0ODM2ODI3MTg2ZjJmNzNhZWRkMjVkZjMwZDdiMTI5NTQ3MzBjYjciLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI2MzcwOTI4MDZiZDUzMTZlZTg0NWY3ZjZiNTBkMGI2MjcxMDQ0OTY4MTk0YmJlNDUzN2IxNTc4NjBiMTNlMDIzIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTA4LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIxMDFlNThiNzEwNThkYWEzZjEwZjRhYWNjMWViYjAzYzA3ZTVjZWRlIiwidHJlZSI6IjM5NDFmYWVkNjllYTI2ZWUyMWFiODI2NTI5MTM5OTk5YjgxMTNmZjAiLCJib2R5RGlnZXN0IjoiMzliOWFiY2YzMGRlMjI5MjAyZmUzNTE1ODQ5ZDY2ZWFhNzEzZTA1OGQ5ZGQ1Mzc3MjU4ODBlMDUwYjNjMmQxMyIsInByb2R1Y2VyUnVuIjoiNDA2MTUwNDkxNDciLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImZlMzNmMGRkZDRiMDc1MzU4ODhjZTcwZDlmODEyMGM2Y2IwZDhhOWJiNTU1NTAzN2I2YTQyN2VmMDMxMDk4NGUiLCJ2ZXJkaWN0RGlnZXN0IjoiODg3YjhmMWI5Y2YxMTIwNDEzZDNiMDY1NTJhZGI1ZmUzOGMxZDQ0NzA3NDBkZDlkNjhjOGNkODZlMzhhZmUzZiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI5NGQzMjAzZTA5OWViMWQxYjRiZTJjNmM2NGUzMzdkZjM5YTc2NTRlZWY1NGEyZTY3Mjg0NGFmNDFmN2E4M2Q3IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDU4MjcyMzM1LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTA4I2lzc3VlY29tbWVudC02NDU4MjcyMzM1IiwiYm9keURpZ2VzdCI6IjE1MGI3YmU5YzFiYzg5ZjBmZThjZWU5MGI1OGM0NGMxYTczY2UyN2NhZjM2NDIwYjgzYTE0MjdiOTQ4MWZiOWUifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1108-picker-smoke-settled`, коммит `101e58b71058` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `3941faed69ea26ee21ab826529139999b8113ff0`
  ```
  git log --all --format='%H %T' | grep 3941faed69ea
  ```
- Тело issue: `39b9abcf30de229202fe3515849d66eaa713e058d9dd537725880e050b3c2d13`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40615049147,"run_attempt":1,"digest":"8845cb46e9ea2dcddbcf393a856ed3fc502d3bc0ed9b747737caa44843fb325c"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NDIsIm91dHB1dF90b2tlbnMiOjE5NDg2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjk2NjgzLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MTM0MjI3MCwiY29zdFVzZEVzdGltYXRlIjowLjg1MDEyOTk5OTk5OTk5OTl9XSwidHVybnMiOjMwLCJkdXJhdGlvbk1zIjoyNzQ5NTgsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjowLjg1MDEyOTk5OTk5OTk5OTksImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=42 output_tokens=19486 cache_creation_input_tokens=96683 cache_read_input_tokens=1342270 num_turns=30 -->
