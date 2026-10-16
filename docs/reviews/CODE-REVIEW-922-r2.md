# CODE-REVIEW — issue #922 · заход r2

Материал: `c3a35f9a5b878ec0f9728b76515cfdb2761c3808`, рабочая копия пинована
на нём весь раунд (`HEAD detached at c3a35f9a`). Трек: `show`. Бюджет циклов:
0/2 (зелёный r1 цикл не образовал — §4).

## Скоуп

Issue #922 не изменился: жадный `^.*\bAC(\d+)\b.*$` в `specFormatErrors`
захватывал *последний* `AC<n>`-токен строки, из-за чего корректная строка
`AC6 — … Согласовано с AC1-4.` теряла номер 6 и format-preflight ошибочно
отклонял валидное ТЗ.

Этот раунд — не новая работа, а повтор ревью после неудачного слияния r1
(§2.10): ветка `issue/922-ac-cross-references` конфликтовала с `dev`,
автор сделал `git rebase origin/dev`, получил новую вершину `c3a35f9a` и
вернул `S7-code-review`. `git diff origin/dev...HEAD` на новой базе — три
коммита, восемь файлов:

| Файл | Класс | Суть |
|---|---|---|
| `scripts/review-preflight.mjs` | B | тот же regex-фикс, что в r1 |
| `test/review-preflight.test.mjs` | B | те же 2 регрессионных теста, что в r1 |
| `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md` | C | тот же текст решения; вставка в ARCHITECTURE.md сдвинута перед секцией `## Read-only release transport (#921)`, которая на новой базе уже существует в `dev` |
| `docs/release-ledger/v1.81.0/922.json` | C | та же классификация `infra` |
| `docs/reviews/CODE-REVIEW-922-r1.md` | C | публикация отчёта r1 (штатный шаг конвейера) |
| `docs/reviews/INDEX.md` | C | перегенерация индекса после публикации r1 и ребейза |

Класса A нет → `infrastructure = true`, продуктовый код/рантайм карточки не
тронут; задача по-прежнему обслуживает инфраструктуру ревью, не
`docs/SCOPE.md` «Core user jobs» напрямую — так же, как в r1.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Low «ссылка перед номером строки» (принята ревьюером без доработки, не High/Medium, цикла не открыла) | Не требовала закрытия — High/Medium в r1 не было, вердикт был зелёным. Edge-case остаётся тем же ограничением, что и в r1: автор не расширял грамматику | `docs/reviews/CODE-REVIEW-922-r1.md`, раздел «Находки»; код `scripts/review-preflight.mjs` между r1 и r2 побайтно не изменился (см. ниже) |

Других находок в r1 не было — High:0, Medium:0. Возврата автору на доработку
кода не случилось; вернулась только S6 из-за конфликта слияния (не
содержательной правки), что и породило r2.

## Унаследовано из r1

Принято без повторной проверки, т.к. материал B-файлов не изменился со
времени зелёного r1 (`docs/reviews/CODE-REVIEW-922-r1.md`, материал
`44cf9e187684b7da36c9d5b8e30f0422c96460b2`, дерево `5ca71ed648c6`):

- Сам фикс (`^.*\bAC(\d+)\b.*$` → `^.*?\bAC(\d+)\b.*$`) и оба новых теста в
  `test/review-preflight.test.mjs` — построчно идентичны диффу, описанному
  в r1 (сверено текстовым сравнением диффов обоих раундов, см. «Как
  проверялось»).
- Базовый сценарий issue воспроизведён и закрыт (AC6 с перекрёстной
  ссылкой `AC1-4` больше не теряет номер).
- Защитная таблица «AC · чем доказан · чем краснеет» из r1: пропущенный AC,
  отсутствующий evidence, лимит show=3, AC в цитате/fenced-блоке по-прежнему
  ловятся — встроенный в тест отрицательный случай, не бухгалтерия.
- Low-находка «ссылка перед собственным номером строки» — тот же принятый
  ревьюером r1 edge-case, автор его не трогал и не обещал исправлять.
- `44cf9e18` → `c3a35f9a`: я не резолвлю старый SHA (он осиротел ребейзом,
  это ожидаемо по материалу r1), а сверяю текст diff и хэши текущих блобов
  вместо `git diff 44cf9e18..HEAD`.

## Что проверено заново в r2 (дельта — ребейз)

Ребейз — не локальная правка по букве §2.10 («ребейз на ушедший вперёд
`dev`» — один из явно названных случаев полного разбора), поэтому разбор
веду полно, а не только по B-файлам:

- **Побайтовое совпадение B-файлов с r1.** `git diff origin/dev...HEAD --
  scripts/review-preflight.mjs test/review-preflight.test.mjs` даёт тот же
  хунк, что в таблице «Изменения» `CODE-REVIEW-922-r1.md`: тот же ленивый
  `.*?`, те же два теста с теми же четырьмя формами ссылок и теми же
  негативными сабкейсами (пропущенный AC6, пустой evidence, 4-й AC в show,
  AC2 только в quote/fence). Семантических отличий нет.
- **ARCHITECTURE.md/DEVELOPMENT.md не потеряли и не задвоили #921.**
  Прочитал обе вставки целиком: абзац #922 в ARCHITECTURE.md вставлен перед
  уже существующей в `dev` секцией `## Read-only release transport (#921)`,
  не внутри неё и не поверх; в DEVELOPMENT.md абзац #922 вставлен перед
  `## Review handoff identity (#904)`, порядок секций не нарушен; других
  правок соседних разделов нет (`git diff` выше показывает только добавленные
  строки).
- **Одно число — один источник (§8).** `node scripts/inventory.mjs` на
  текущем `HEAD` даёт `Node unit … 4657`, дословно совпадает с
  `docs/STATUS.md` (было `4655` на прежнем `dev`, +2 — ровно новые тесты
  этого issue); второго места с `4657` в репозитории нет.
- **Отсутствие конфликтных маркеров.** `git diff origin/dev...HEAD | grep
  '^<<<<<<<\|^=======\|^>>>>>>>'` — пусто.
- **Индекс ревью свеж и корректен.** `node scripts/reviews-index.mjs
  --check` → «свеж»; строка `#922` в `INDEX.md` указывает на
  `CODE-REVIEW-922-r1.md`, зелёный, с перенесённой находкой Low — ожидаемо,
  индекс публикует отчёт r1, а не r2 (r2 публикуется этим же шагом после
  вердикта).
- **Трейлеры всех трёх коммитов диапазона.** `Issue: #922`, `User-Visible:
  no` на каждом; `User-Visible: no` корректно — changelog не трогается,
  поведение карточки не меняется.
- **Release ledger.** `docs/release-ledger/v1.81.0/922.json`: `category:
  infra`, без `introducedBy`, `baseStable: v1.81.0` совпадает с
  `docs/STATUS.md` «Latest stable tag»; формат и тон обоснования совпадают с
  прецедентами `917.json`/`929.json` того же релиза.
- **process-gate.** `node scripts/process-gate.mjs --issues` → «гейт
  пройден», 1 предупреждение — ожидаемое инфраструктурное WARN п.8
  (`#562`, класса A нет, статусная метка не требуется до S7).
- **smoke-select.** `node scripts/smoke-select.mjs --base origin/dev --head
  HEAD` → «Исполняемого frontend-диффа нет… Browser-smoke не выбираются»,
  тронуто 8 файлов — соответствует составу диффа, ни один не `src/**/*.ts`.

## Как проверялось

| Гейт | Статус | Примечание |
|---|---|---|
| Validate на `c3a35f9a` | ✅ переиспользован | https://github.com/Matysh/houseplan-card/actions/runs/38967850294 — success; `tsc --noEmit`/`npm test`/`npm run build`+bundle-policy не перегонял (§8, дешёвые гейты подтверждены на материале) |
| `node --test test/review-preflight.test.mjs` | ✅ запущен сам | 12/12 PASS, 0 skip |
| `node --test test/reviews-index.test.mjs` | ✅ запущен сам | 35/35 PASS, 0 skip — индекс не сломан вставкой `#922` |
| `node scripts/reviews-index.mjs --check` | ✅ запущен сам | «docs/reviews/INDEX.md свеж» |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | ✅ запущен сам | фронтенд-дифф отсутствует, смоки обоснованно не выбраны |
| `node scripts/process-gate.mjs --issues` | ✅ запущен сам | «гейт пройден», 1 ожидаемое инфра-WARN |
| `node scripts/inventory.mjs` | ✅ запущен сам | `4657` совпало с `docs/STATUS.md` дословно |
| `git diff origin/dev...HEAD` текстовое сравнение с диффом r1 | ✅ запущен сам | побайтовое совпадение B-файлов, см. раздел дельты |
| `pytest tests_backend` | — не прогонял | Python не тронут |
| `npm run invariants` | — не прогонял | геометрия не тронута |
| `golden:verify` | — не прогонял | нет `ci:golden`, нет рендер-диффа |
| `npm run gate:small` целиком | — не перегонял | Validate зелёный на этом SHA + оба целевых тест-файла и process-gate сам прогнаны; полный набор избыточен для этой дельты (§8) |
| Мутационный реестр | — не прогонял | код не менялся с r1, где это уже было явно снято как неприменимое к `show` |

## Находки

Нет. Дельта раунда — чистый ребейз без изменения логики: B-файлы побайтово
совпадают с зелёным r1, конфликтных маркеров нет, числа и трейлеры
согласованы, индекс свеж.

## Проверено и корректно

- Сценарий issue закрыт тем же фиксом, что в r1: AC6 с перекрёстной ссылкой
  `AC1-4` больше не теряет номер; защита от регрессии (пропущенный AC,
  отсутствующий evidence, лимит show, скрытые в цитате/fence AC) сохранена
  обоими тестами, прогнанными заново на текущей вершине.
- Маршрут §5: `complexity` (один regex + 2 теста + документация, риск ≤3),
  `surfaces` (один модуль `review-preflight.mjs`), `migration` (нет
  конфига/compat-полей), `ux-contract` (нет UX, инструмент не
  пользовательский), `perf-touch` (не тронуто), `undocumented` (поведение
  зафиксировано в issue и ARCHITECTURE/DEVELOPMENT/STATUS) — все критерии
  пройдены, как и в r1 → `route: fix`.
- Trailers всех трёх коммитов диапазона (`Issue: #922`, `User-Visible: no`)
  корректны; изменений, видимых пользователю карточки, нет.
- `docs/release-ledger/v1.81.0/922.json` корректен относительно
  `v1.81.0` — не меняется с r1.
- Ветка опубликована (материал ревью — удалённая ветка, рабочая копия на
  `c3a35f9a`), конфликт слияния, вызвавший r2, устранён ребейзом, новых
  конфликтных маркеров нет.

## Чего не проверял

- Полный `npx tsc --noEmit`/`npm test`/`npm run build` со сверкой трёх копий
  бандла — не перегонял; зелёный Validate на этом SHA (`c3a35f9a`, run
  38967850294) и отсутствие `src/**/*.ts` в диффе делают это избыточным.
- `npm run gate:small` целиком своими руками — положился на зелёный Validate
  плюс самостоятельный прогон обоих целевых тест-файлов и `process-gate`;
  это покрывает всё, что менялось в диапазоне.
- `pytest tests_backend`, `npm run invariants`, `golden:verify`, performance
  — не прогонял: Python, геометрия, рендер и `ci:golden` не затронуты.
- Мутационный реестр под этот фикс не проверял: код с r1 не менялся, там это
  уже обоснованно снято для трека `show`.
- Исполняемую реализацию `scripts/review-preflight.mjs` не патчил и не
  откатывал ни на секунду — весь повторный разбор дельты сделан чтением
  diff/документа r1 и сравнением хэшей/текста, не исполнением мутанта.
- Старый материал r1 (`44cf9e18`) недостижим после ребейза (ожидаемо,
  зафиксировано в его «Материале раунда») — не пытался его восстановить,
  сверка дельты сделана текстовым сравнением диффов и блобов текущей
  вершины.

## Вердикт

Зелёный. High: 0. Medium: 0. `route: fix`, задача проходит все критерии §5.
Цикл не образуется (зелёный вердикт бюджет §4 не тратит).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/922-ac-cross-references`, коммит `c3a35f9a5b87` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `796b83086f07fc536a643e30a41cbb252c1b961d`
  ```
  git log --all --format='%H %T' | grep 796b83086f07
  ```
- Тело issue: `5cf8e0428854ebfef3e332c3ae95e9037851ce8ec47835d3d84e73a4d8a99439`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ4OTIsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0OTkyfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoyOCwib3V0cHV0X3Rva2VucyI6MTQzNTEsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6NjU1MjgsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo4NjQxOTQsImNvc3RVc2RFc3RpbWF0ZSI6MC41Nzg1MTY3OTk5OTk5OTk5fV0sInR1cm5zIjoyNSwiZHVyYXRpb25NcyI6MTgxNTU5LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MC41ODM1MDg3OTk5OTk5OTk5LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=4920 output_tokens=14371 cache_creation_input_tokens=65528 cache_read_input_tokens=864194 num_turns=25 -->
