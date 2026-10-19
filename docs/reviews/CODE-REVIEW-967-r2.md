# CODE-REVIEW-967-r2

Issue: [#967](https://github.com/Matysh/houseplan-card/issues/967) — `smoke_editor_styles_lazy`: CDP garbage-collects
the action promise when opening the room dialog.
Трек: `track:show` (владелец). Этап: code. Заход r2, блокирующих циклов 0/2.
Материал: `e61b78f7adc9f6d7c7598bfaf23ab62bb1d2bb82` (рабочая копия на этом SHA,
`git diff origin/dev...HEAD` — 8 файлов, 402 вставки / 3 удаления; из них 6
файлов реализации/документации — класс B/C, 2 файла (`CODE-REVIEW-967-r1.md`,
`INDEX.md`) — публикация документа r1 и его генерируемый индекс).
Политика побочных находок: trusted snapshot `mode=issues` (prepare,
`HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`), совпадает с `REVIEW_FINDINGS_POLICY`.

## Почему r2, а не r1

r1 вынес зелёный вердикт на материале `ccde557dafbc` (комментарий
[issuecomment-6269730922](https://github.com/Matysh/houseplan-card/issues/967#issuecomment-6269730922)).
Пока ревью шло, `dev` продвинулся, и первый rebase-кандидат `a406f56a6c`
снова разошёлся с вершиной `dev` до слияния (конфликт только в генерируемом
`docs/reviews/INDEX.md`, штатно решён `rebase-on-dev`). Итоговый кандидат —
текущий материал `e61b78f7a`, база `dev` `a7a951af1` (после слияния #968).
Это ровно случай AGENTS.md «A failed merge after a green merge... diff
changed on rebase... the new review round starts by itself» и PROCESS.md
§2.10: round образован рейбейзом, не возвратом по находке, поэтому
блокирующих циклов по-прежнему 0/2.

## Скоуп дельты r1→r2

Дельта — исключительно технический rebase плюс публикация документа r1:

- 6 файлов реализации/тестов/документации #967
  (`demo/helpers/retained-page-action.mjs`, `demo/smoke_editor_styles_lazy.mjs`,
  `test/retained-page-action.test.mjs`, `docs/DEVELOPMENT.md`,
  `docs/STATUS.md`, `docs/release-ledger/v1.81.0/967.json`) —
  побайтово идентичны содержимому, описанному и провалидированному в r1.
  Сами исходные коммиты r1 (`ccde557dafbc`, `a406f56a6c`) после rebase
  осиротели и уже отсутствуют как объекты в этом дереве (ожидаемо после
  rebase, не находка) — поэтому сверка идёт не по хешу коммита, а по
  текущему `git diff origin/dev...HEAD`, содержимое которого построчно
  совпадает с диффом, разобранным в CODE-REVIEW-967-r1.md.
- Новая база `dev` принесла только слияние #968
  (`4daaa8884`, `ce30aa4c1`) — проверено: эти коммиты трогают
  `scripts/review-context.mjs`, `test/model-evidence-857.test.mjs`,
  `docs/release-ledger/v1.81.0/968.json`, ни один файл не пересекается с
  браузерным раннером/смоком/харнесом #967. Конфликтов при rebase кроме
  генерируемого `INDEX.md` не было.
- Добавлены сам документ `docs/reviews/CODE-REVIEW-967-r1.md` (сгенерирован
  предыдущим раундом, содержимое уже проверено тем раундом) и обновление
  `docs/reviews/INDEX.md` (генератор `scripts/reviews-index.mjs`, счётчики
  101/49, новая строка `#967 · r1 · 🟢 · 0 · 0`).

Дельта локальна по критерию §2.10 (ребейз не меняет дерево реализации,
новая база не пересекается с затронутыми файлами) → объём разбора сужен
до дельты; выполненные в r1 AC-проверки не повторяются с нуля, но
ключевые гейты перепрогнаны мной лично на текущем SHA ниже, чтобы
подтвердить, что rebase ничего не сломал.

## Как проверялось

| Гейт | Результат | Комментарий |
|---|---|---|
| Validate на материале `e61b78f7a` | **зелёный**, подтверждён API | [run 39272224459](https://github.com/Matysh/houseplan-card/actions/runs/39272224459) — `conclusion: success`, `headSha` совпадает с материалом ровно; `tsc --noEmit`, `npm test`, `npm run build` + bundle-policy не перегонял отдельно (#343) |
| `node --test test/retained-page-action.test.mjs` | **сам прогнал: PASS** | 6/6, 0 failures, ~80 мс — та же реализация, что в r1, на текущем дереве |
| `node scripts/mutation-gate.mjs --check --changed=origin/dev..HEAD` | **сам прогнал: PASS** | static-readiness definitions=149, execution=0, caught=unknown (nightly only); `editor-styles-adoption-dropped-from-runtime`, `editor-styles-adopted-once-per-page` — `ok`, прежний WARN browser guards 420/200 сохранён без изменений |
| `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | **сам прогнал: PASS** | 3 коммита (код + 2 докс-коммита публикации r1), 1 ожидаемый WARN §562 (инфраструктурный диапазон без S-метки до S7) |
| `git diff --quiet origin/dev...HEAD -- src custom_components scripts/monolith-baseline.json` | **сам прогнал: пусто** | класс A/D по-прежнему не задет rebase'ом |
| `git show --stat` слитых из dev коммитов #968 | **сам проверил** | `4daaa8884`/`ce30aa4c1` трогают только `scripts/review-context.mjs`, `test/model-evidence-857.test.mjs`, `docs/release-ledger/v1.81.0/968.json` — не пересекаются с браузерным раннером/смоком #967 |
| `docs/reviews/INDEX.md` diff | **прочитан** | корректное добавление строки `#967 · r1 · 🟢`, счётчики консистентны (100→101 документов, 48→49 issue) |
| Трейлеры 3 коммитов диапазона | **прочитаны** | `c32df4825` (код), `5d8074089` (докс r1), `e61b78f7a` (докс индекс) — у всех `Issue: #967`, `User-Visible: no`; для чисто докс-коммитов трейлер не обязателен, но не противоречит правилу |
| `node demo/smoke_editor_styles_lazy.mjs` (браузерный смок AC1) | **не перегонял** | r1 уже прогнал этот смок на идентичном коде (45/45 PASS, включая GC-witness) и подтверждён независимым прогоном той же сессии ревью r1; содержимое файла в r2 побайтово то же — повторный browser-прогон не добавляет информации к уже данному и неизменному witness (§2.10, «пригодный неизменившийся check не повторять») |
| `golden:verify`, `pytest tests_backend`, `invariants`, `performance` | не прогонял | нет `ci:golden`, нет правок Python/геометрии, performance не названа в AC — неприменимо по §8, не изменилось с r1 |

Не исполнял ни одного мутанта и не патчил продукт/гард/лимит/тестовую
сборку временно — только обычная сборка (неявно, через зелёный Validate),
обычные тесты и чтение (общая политика выше).

## Находки

Находок нет — ни High, ни Medium, ни Low.

Разобранные риски дельты, которые не стали находками:

- **Осиротевшие коммиты r1 как материал.** `ccde557dafbc` и `a406f56a6c`
  больше не резолвятся как объекты в этом дереве. По REVIEWER.md
  («Повторный раунд»): «если SHA не резолвится — это не находка, а обычное
  дело: материал ищется по дереву и блобу» — дерево найдено и сверено
  через текущий `git diff`, содержимое идентично. Не находка.
- **Слияние #968 в базу dev.** Проверено построчно (`git show --stat`) —
  пересечений путей с #967 нет, конфликт при rebase был только в
  генерируемом `INDEX.md` и решён штатным генератором. Не находка.
- **Повторный browser-смок не прогонялся лично в r2.** Файл
  `demo/smoke_editor_styles_lazy.mjs` побайтово идентичен версии,
  провалидированной в r1 двумя независимыми прогонами (автор + ревьюер r1,
  оба 45/45 PASS с подлинными GC-witness). Rebase не меняет ни пины, ни
  окружение раннера. Не являюсь обязанным повторять уже пригодный check
  неизменившегося материала (REVIEWER.md, «Повторный раунд»). Не находка.

## Что проверено и корректно

- **Содержательная реализация** — не изменилась относительно r1: механизм
  `evaluateRetainedAction` по-прежнему не возвращает pending promise через
  CDP (JSHandle на плоском объекте-owner + поллинг settled-статуса),
  убирает гонку с V8 GC, описанную в issue. Подтверждено построчным
  сравнением текущего диффа `origin/dev...HEAD` с диффом, разобранным в
  r1, и собственным прогоном юнитов.
- **AC1–AC3** — полностью унаследованы из r1 (см. раздел ниже), дельта их
  не задевает: ни один из 6 файлов реализации #967 не менялся при rebase.
- Трейлеры всех 3 коммитов диапазона: `Issue: #967`, `User-Visible: no` —
  верно, включая докс-коммиты публикации документа r1 и его индекса
  (чисто-докс коммиты трейлер не обязаны нести, но несут его корректно).
- `docs/reviews/INDEX.md` — генератор отработал штатно, строка `#967`
  добавлена с правильным вердиктом/раундом, счётчики согласованы.
- Класс A/D по-прежнему не затронут (`git diff --quiet` по `src`,
  `custom_components`, `monolith-baseline.json` — пусто).
- Новая база `dev` (после слияния #968) не вносит риска для раннера/смока
  #967 — проверено построчно по файлам слитых коммитов.
- Маршрут §5 (трек show, `route`) — не изменился относительно r1:
  complexity низкая, surfaces — одна поверхность (тестовый харнес открытия
  editor-поверхностей), migration нет, ux-contract нет (продукт не
  тронут), perf-touch нет влияния, undocumented — поведение
  задокументировано в `docs/DEVELOPMENT.md` и теле issue. Все критерии §5
  пройдены → `route: fix`.

## Чего не проверял

- Полные `npm test` (4910) и `npm run build` с трёхкопийной сверкой
  бандла целиком не перегонял — приняты по зелёному Validate ровно на
  материале `e61b78f7a` (API-подтверждено: `conclusion: success`,
  `headSha` совпадает), инструкция ревью (#343).
- Браузерный смок `demo/smoke_editor_styles_lazy.mjs` не перегонял лично
  в r2 — неизменившийся относительно r1 check, уже дважды PASS (автор и
  ревьюер r1) на идентичном содержимом файла; rebase пинов/окружения не
  менял.
- `golden:verify`, `pytest tests_backend`, `npm run invariants`,
  performance — не прогонял: диапазон не трогает рендер/Python/геометрию,
  performance не названа в AC (§8, предрелизный гейт — не гейт ревью);
  не изменилось с r1.
- Остальные 2 шарда browser-smoke (396 сценариев суммарно) не
  перегонял — вне диффа и вне AC этой задачи, не изменилось с r1.
- Историческую точную причину первого отказа (CI `39259034538`/attempt 1)
  задача сознательно не объясняет — корректно заявленная граница задачи,
  не недостаток ревью (унаследовано из r1).
- Ручная dev/GPU-приёмка владельцем не выполнялась — для инфраструктурной
  тестовой правки без продуктового UI это не требуется и не является
  находкой (REVIEWER.md, «Позиция ревьюера»).

## Побочные находки

Побочных находок нет. (`mode=issues` — маршрут публикации новых issue не
задействован, так как отдельных находок вне скоупа не возникло.)

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| — | r1 не содержал находок (High/Medium/Low) — закрывать нечего | [CODE-REVIEW-967-r1.md](CODE-REVIEW-967-r1.md), раздел «Находки»: «Находок нет — ни High, ни Medium, ни Low» |

## Унаследовано из r1

Без повторной проверки в r2 приняты следующие выводы r1 (документ
`docs/reviews/CODE-REVIEW-967-r1.md`, материал раунда `ccde557dafbc`,
дерево `0b5aca00d202f3c733810c033c438983da3793bb`, вердикт пайплайна
`green`, `route: fix`, критерий `undocumented`):

- Механизм исправления (`evaluateRetainedAction` не возвращает pending
  promise через CDP) — доказан чтением и исполнением (6 юнитов на
  реальной реализации).
- AC1 (42 исходные проверки сохранены, ordering watcher-before-action не
  меняется) — доказан чтением диффа и исполнением смока, 45/45 PASS.
- AC2 (ровно один вызов действия, значение/ошибка без маскировки,
  зависание — отказ, оба handle освобождаются, именованный предел 20с) —
  доказан исполнением 6 юнитов (throw/reject/timeout/invalid input —
  подлинные отрицательные пути) и нативным GC-контролем на пиновом
  Chromium.
- AC3 (только B/C, без изменения продукта/версий/workflow/пинов/
  эталонов/порогов; мутанты не исполнялись) — подтверждён `git diff
  --quiet`, `mutation-gate --check` (execution=0) и чтением диффа
  workflow/version файлов.
- Разобранный и снятый риск «надёжность форсированного GC в
  witness-блоке» (детерминированность `HeapProfiler.collectGarbage` на
  намеренно незавершённом promise) — остаточный риск признан
  нефатальным, пункт watch-листа, не находка.
- Разобранный и снятый риск «встраивание исходника действия строкой без
  экранирования обратных кавычек» — теоретический, ограничен тестовым
  кодом, не находка.
- `docs/release-ledger/v1.81.0/967.json` (`category: infra`, без
  `introducedBy`) соответствует характеру правки.

Эти выводы опираются на содержимое 6 файлов реализации, которое в r2
подтверждено побайтово идентичным (см. «Скоуп дельты r1→r2» выше) —
условие static-first (#857) для их наследования выполнено.

## Вердикт

Зелёный. Дельта r1→r2 — исключительно ребейз на ушедший вперёд `dev`
(слияние #968, не пересекающееся с файлами #967) плюс публикация
документа и индекса r1; содержимое реализации #967 побайтово не
изменилось. AC1–AC3 унаследованы из зелёного r1 без повторной находки,
ключевые гейты (юниты, mutation-gate --check, process-gate, класс A/D)
перепрогнаны лично на точном материале r2 и совпадают с r1; Validate на
этом же SHA подтверждён через API как `success`. Критерии маршрута §5
пройдены (не изменились относительно r1) → `route: fix`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/967-modal-observer-retention`, коммит `e61b78f7adc9` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `775f073b95945280b30cec02a3bdf41829db3d5a`
  ```
  git log --all --format='%H %T' | grep 775f073b9594
  ```
- Тело issue: `1f1f96026202e29d69bfcf82f45f09112be3df77079e932dd114890233ae423d`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMDgsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTk3OTk5OTk5OTk5OTk5NX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MzYsIm91dHB1dF90b2tlbnMiOjE0OTM3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjY5MTg0LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MTI1MTAwNywiY29zdFVzZEVzdGltYXRlIjowLjY3NjM3OTQwMDAwMDAwMDF9XSwidHVybnMiOjI0LCJkdXJhdGlvbk1zIjoxOTA2NzcsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjowLjY4MTU3NzQsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5144 output_tokens=14955 cache_creation_input_tokens=69184 cache_read_input_tokens=1251007 num_turns=24 -->
