# CODE-REVIEW — issue #922 · заход r1

Материал: `44cf9e187684b7da36c9d5b8e30f0422c96460b2` (дерево
`5ca71ed648c629294b6e9fc8aa3b133562d16069`), рабочая копия пинована на нём
весь раунд. Трек: `show`. Бюджет циклов: 0/2.

## Скоуп

Issue #922 — отчёт из пакетной проверки (`batch-findings-2026-10-15`,
F-BATCH-20261015-001): жадный regex в `specFormatErrors` захватывал
*последний* `AC<n>`-токен строки, поэтому корректная строка `AC6 — ...
Согласовано с AC1-4.` теряла номер 6 и format-preflight ошибочно отклонял
валидное ТЗ (`Numbered contiguous AC1..ACn required`). Causa — чтение
[review-preflight.mjs:51 на e9ce196](https://github.com/Matysh/houseplan-card/blob/e9ce19632456e5b7f5bead49ce8bbd5f992bc0f4/scripts/review-preflight.mjs#L51).

Диапазон `origin/dev..HEAD` — один коммит, шесть файлов, все классов B/C
(`scripts/`, `test/`, `docs/`), класса A нет →
`infrastructure = true`, продуктовый код/рантайм карточки не тронут.
Это закрывает ровно инструментальный дефект препроверки ТЗ, никакую
строку `docs/SCOPE.md` «Core user jobs» напрямую не продвигает и не должно —
задача инфраструктурная, обслуживает сам процесс ревью, а не конечного
пользователя карточки.

## Изменения

| Файл | Суть |
|---|---|
| `scripts/review-preflight.mjs` | `^.*\bAC(\d+)\b.*$` → `^.*?\bAC(\d+)\b.*$`: ленивый префикс вместо жадного — строка идентифицируется первым AC-токеном, а не последним |
| `test/review-preflight.test.mjs` | +2 теста: позитивный (4 формы перекрёстных ссылок не ломают номер/evidence) и негативный (пропущенный AC, отсутствующий evidence, лимит show, скрытые в цитате/fence AC по-прежнему ловятся) |
| `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md` | Фиксация решения и его границ (не меняет остальные проверки, не семантическое одобрение) |
| `docs/release-ledger/v1.81.0/922.json` | `category: infra`, обоснование относительно `v1.81.0` |

## Как проверялось

| Гейт | Статус | Примечание |
|---|---|---|
| Validate на `44cf9e18` | ✅ переиспользован | https://github.com/Matysh/houseplan-card/actions/runs/38965244496 — success; `tsc --noEmit` / `npm test` / `npm run build`+bundle-policy не перегонял (§8, дешёвые гейты подтверждены) |
| `node --test test/review-preflight.test.mjs` | ✅ запущен сам | 12/12 PASS, 0 skip, локально на пиновке |
| Ad-hoc пробы `specFormatErrors` (не продуктовый файл, временный `/tmp`-скрипт, реализация не патчилась) | ✅ запущен сам | см. «Находки» и «Проверено и корректно» |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | ✅ запущен сам | «Исполняемого frontend-диффа нет… Browser-smoke не выбираются» — ожидаемо, диф не трогает `src/**/*.ts` |
| `pytest tests_backend` | — не прогонял | Python не тронут |
| `npm run invariants` | — не прогонял | геометрия не тронута |
| `golden:verify` | — не прогонял | нет метки `ci:golden`, нет рендер-диффа |
| `npm run gate:small` целиком | — не перегонял | автор привёл PASS в хендоффе (20:47:52–20:50:08 UTC) + Validate зелёный на этом SHA — полный набор не requerial для этой дельты (§8: «предрелизный гейт, а не гейт ревью») |
| `node scripts/inventory.mjs` | ✅ запущен сам | вывод `Node unit … 4649` совпал с `docs/STATUS.md` дословно — число одного источника, дублей `4649`/`4646` в другом месте нет |

## Находки

### Low — несимметричный edge-case «ссылка перед номером строки» (принимается, не блокирует)

Эвристика «первый AC-токен строки — номер критерия» верна для описанного в
issue и для принятой в проекте формы записи (`- AC<n> — …`, «пронумерованные
критерии» — `PROCESS.md:189`), где собственный номер всегда открывает
строку. Но если ссылка стоит *перед* собственным номером в этой же строке
(`- Согласовано с AC1-4 AC6 — requirement`), результат снова ломается — на
этот раз лениво берётся `AC1`, и контур «AC1..ACn» формально рвётся
(проверено своей пробой, воспроизведение ниже). Это тот же класс дефекта, что
в issue, просто с другим направлением; до фикса было наоборот — жадный regex
как раз брал последний токен и такую запись разбирал верно, а issue-кейс
ломал.

Снимаю без доработки: issue описывает и фиксирует только одно направление
(ссылка после номера), во всех реальных ТЗ проекта и во всех новых тестах
собственный номер критерия всегда стоит первым токеном строки — это не
предположение, а наблюдаемая конвенция (`PROCESS.md §2.5`, все примеры AC в
issue/тестах). Отдельный issue не завожу: воспроизводится только искусственной
перестановкой слов, которую никто в проекте не пишет, серьёзность не
дотягивает даже до Low-с-issue, достаточно отметить как принятое ограничение.

Воспроизведение (ad-hoc, implementation не менялась):
```
specFormatErrors(ТЗ_с_AC1..AC7_и_строкой
  "- Согласовано с AC1-4 AC6 — requirement 6; unit.", 'ask')
→ [{ field: 'body.spec.AC', message: 'Numbered contiguous AC1..ACn required' }]
```

## Проверено и корректно

- **Базовый сценарий issue воспроизведён и закрыт.** На своей пробе (не из
  test-файла) взял ТЗ с `AC1…AC7` и строкой `AC6 — requirement 6 Согласовано
  с AC1-4` → `specFormatErrors` не выдал `body.spec.AC`; до фикса (по описанию
  issue и чтению старого regex на `e9ce196`) это было `Numbered contiguous
  AC1..ACn required`.
- **Защитный AC — таблица «чем доказан / чем краснеет»** (изменение чисто
  защитное: парсер не должен давать ни ложный reject, ни ложный accept):

  | AC (неявный, из текста issue) | Чем доказан | Чем краснеет |
  |---|---|---|
  | Корректное ТЗ с перекрёстной ссылкой после номера AC не отклоняется | `test/review-preflight.test.mjs` `#922: trailing AC references do not replace a criterion number or its evidence block` (4 формы ссылок × bullet/table) — 12/12 PASS в сборе | Запустил узкую пробу с реальным жадным regex-паттерном issue (текстовое сравнение, implementation не патчилась) — убедился, что до фикса текст давал бы `Numbered contiguous…`; сам тест написан так, что при откате ленивого `.*?` на жадный `.*` строка `AC6…AC1-4` снова даст `ids` без 6 → тест пошёл бы RED (отрицательный случай внутри теста, не мутант в реестре) |
  | Пропущенный AC, отсутствующий evidence, лимит show=3, AC в цитате/fenced-блоке по-прежнему ловятся (фикс не ослабил защиту) | `test/review-preflight.test.mjs` `#922: cross-references still cannot excuse missing criteria, evidence or the show limit` — 4 сабкейса, все PASS | Тест сам содержит отрицательный вход (реально убранный AC6, реально пустой evidence, 4-й AC в show, AC2 только в `>`/`` ``` ``-блоке) и явно проверяет, что `errors` непустой — это и есть встроенный witness, не accounting-проверка |
  | Число тестов в `docs/STATUS.md` (4649) соответствует фактическому `npm run inventory` | Запустил `node scripts/inventory.mjs` сам | Вывод дословно `4649`, второго места с этим числом в репозитории нет |
- Trailers коммита `44cf9e18`: `Issue: #922`, `User-Visible: no` — корректно,
  инструмент для мейнтейнеров, конечный пользователь карточки изменения не
  видит; changelog (ru/en) не трогается, что и ожидаемо при `no`.
- `docs/release-ledger/v1.81.0/922.json`: `category: infra`, без
  `introducedBy` (фикс не бета-фичи, а стоящего с #855 инструмента) —
  совпадает с прецедентами `917.json`/`929.json` в этом же релизе.
- `docs/ARCHITECTURE.md` / `docs/DEVELOPMENT.md` / `docs/STATUS.md` описывают
  ровно то, что делает код: сохраняется идентичность по первому токену,
  остальные проверки (разделы, непрерывность, evidence, лимит show,
  `plain()`-исключение цитат/fence) не затронуты — прочитал все три правки,
  расхождений с диффом `scripts/review-preflight.mjs` нет.
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` сам
  подтвердил отсутствие frontend-диффа → смоки не выбираются обоснованно, не
  от лени.
- Маршрут вердикта §5: `complexity` (один regex + 2 теста + документация —
  риск ≤3), `surfaces` (один модуль — `review-preflight.mjs`), `migration`
  (нет конфига/compat-полей), `ux-contract` (нет UX, инструмент не
  пользовательский), `perf-touch` (не тронуто), `undocumented` (ожидаемое
  поведение зафиксировано в самом issue и теперь в ARCHITECTURE/DEVELOPMENT/
  STATUS) — все критерии пройдены → `route: fix`.

## Чего не проверял

- Полный `npx tsc --noEmit` / `npm test` / `npm run build` с сверкой трёх
  копий бандла — не перегонял; зелёный Validate на этом же SHA
  (`44cf9e18`, run 38965244496) и факт, что диф не трогает `src/**/*.ts` ни
  одной строкой, делают это избыточным для раунда ревью.
- `npm run gate:small` целиком своими руками — положился на вывод автора в
  хендоффе (PASS, 20:47:52–20:50:08 UTC) вместе с зелёным Validate; сам
  прогнал только узкий тест-файл и дополнительные ad-hoc пробы на
  немодифицированной реализации.
- `pytest tests_backend`, `npm run invariants`, `golden:verify`,
  performance — не прогонял: Python, геометрия, рендер и `ci:golden` в этой
  задаче не затронуты (подтверждено classify() всех 6 файлов и
  `smoke-select`).
- Мутационный реестр (`scripts/mutation-registry.mjs`) под этот фикс не
  заводился и не проверялся — автор прямо пишет «Мутанты не исполнялись»;
  для раунда ревью `show` это не требуется, встроенного в тест отрицательного
  случая достаточно (см. таблицу AC выше).
- Не трогал исполняемую реализацию `scripts/review-preflight.mjs` ни на
  секунду (никакого временного патча/отката regex с прогоном) — весь разбор
  старого жадного поведения сделан чтением diff/issue и сравнением строк, а
  не исполнением мутанта.

## Вердикт

Зелёный. High: 0. Medium: 0. Low: 1 (отмечен выше, снят ревьюером, записи
не образует цикл). `route: fix`, задача проходит все критерии §5.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/922-ac-cross-references`, коммит `44cf9e187684` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `5ca71ed648c629294b6e9fc8aa3b133562d16069`
  ```
  git log --all --format='%H %T' | grep 5ca71ed648c6
  ```
- Тело issue: `5cf8e0428854ebfef3e332c3ae95e9037851ce8ec47835d3d84e73a4d8a99439`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ4OTEsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0OTgxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo2Niwib3V0cHV0X3Rva2VucyI6MjU1NjgsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6Njk0ODEsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoyMTEyNzAyLCJjb3N0VXNkRXN0aW1hdGUiOjAuOTU2Mjc2NDAwMDAwMDAwMX1dLCJ0dXJucyI6MzQsImR1cmF0aW9uTXMiOjMzOTU3MiwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuOTYxMjU3NDAwMDAwMDAwMiwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4957 output_tokens=25586 cache_creation_input_tokens=69481 cache_read_input_tokens=2112702 num_turns=34 -->
