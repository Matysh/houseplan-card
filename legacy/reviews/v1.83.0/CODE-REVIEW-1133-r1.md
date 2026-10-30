# CODE-REVIEW-1133-r1

**Issue:** #1133 · **Трек:** show · **Заход:** r1 · **Материал:** `4e0df66f069e87e6585304e9f448f9c610e6004b`

## Скоуп

Issue #1133 — запись и расследование трёх независимых отказов полного Validate
(attempt1) на неизменном материале `9f7b3cc7b24...`: Golden `ui-1081-grid-pan-dark`,
performance-матрица (101ms long-task), `smoke_settings_polish_radar_vacuum_955`
(`vacuum_cancel_preserves_config`/`radar_cancel_preserves_config`). Требование —
диагностировать и либо исправить причину, либо дать явную дальнейшую классификацию,
не вводя новую общую политику допусков (#1105 остаётся отдельно).

Поставка — диагностика и явная классификация (`docs/analysis/1133-ci-flake-evidence.md`),
без заявления об устранении причины:

- `demo/helpers/ci-flake-evidence.mjs` (новый) — чистая bounded diff-функция `configDifference`
  для сравнения JSON-конфигов (changedPaths/omitted/serializedEqual/dataEqual).
- `demo/helpers/settings-polish-955.mjs` — после уже зафиксированного строгого отказа
  `*_cancel_preserves_config` (булев оракул не тронут) дополнительно снимает
  client/persisted снэпшоты и считает `configDifference` между ними; пишет в тот же
  JSON-артефакт `diagnostics`.
- `demo/golden/run.mjs`, `demo/golden/ui-lab-1081.mjs` — для сцены `uiLab1081==='grid-pan'`
  после уже снятого и записанного кадра (`captureGoldenFrame`) и ДО сравнения с baseline
  добавлена post-screenshot геометрия (stage/svg/marker rect, DPR, background position,
  transform, классы stage).
- `.github/workflows/validate-product.yml`, `.github/workflows/validate-tooling.yml`,
  `scripts/ci-profile-paths.json`, `scripts/ci-registry-inventory.json` — штатная
  регистрация нового теста/хелпера в профилях CI (генерируемые файлы).
- `docs/analysis/1133-ci-flake-evidence.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`,
  `docs/release-ledger/v1.82.0/1133.json` — явная классификация по каждому из трёх
  отказов, обновление счётчика тестов, release-ledger `category: infra`.
- `test/ci-flake-evidence.test.mjs` (новый, 3 теста) — чистые юниты на `configDifference`.

Класс изменений — **B/C**: ни одного файла `src/**` или `custom_components/**`;
продукт (видимое пользователю поведение) не затронут. User-Visible корректно
отсутствует в changelog'ах (оба `docs/CHANGELOG*.md` не изменены, записей в диффе нет).

## Как проверялось

Static-first: `read:diff`/`read:log`/`read:incoming-diff` (пустой — dev не ушёл
вперёд базы `e56afbf79d60982aa8a4311d7c671ed7ce80505e`), независимый разбор кода
каждого изменённого файла, сверка вызывающих путей (`run.mjs` → `uiLab1081CaptureEvidence`,
`settings-polish-955.mjs` → `configDifference`), подтверждение что диагностика пишется
**после** судящего кадра/оракула и не участвует в `comparison.passed`/булевом verdict.

Переиспользовано готовое зелёное доказательство материала: validate-gate
https://github.com/Matysh/houseplan-card/actions/runs/41058360695 (review-light proof
complete) — покрывает build/typecheck/tooling-validate для этого SHA целиком; не
повторялось.

Адресно прогнано (конкретные непокрытые риски: новый helper/test, сгенерированные
профили, согласованность STATUS-счётчика):

| Гейт | Команда/check_id | Результат |
|---|---|---|
| Новый юнит | `unit:test/ci-flake-evidence.test.mjs` | PASS, 3/3 |
| Указанный автором юнит для golden-диагностики | `unit:test/golden-scene-repaint.test.mjs` | PASS |
| Генератор профилей CI не разошёлся с ручными правками | `static:ci-profiles` | PASS |
| Реестр CI (inventory) не разошёлся | `static:ci-registry-inventory` | PASS |
| `docs/STATUS.md` Tests-счётчик против факта | `static:inventory` → `Node unit … 5898` | совпадает дословно с правкой STATUS (5895→5898, +3 = ровно 3 новых теста) |
| Trailer-парсер (общий юнит, не конкретные коммиты) | `unit:test/commit-provenance.test.mjs` | PASS (13/13) |
| Reading-order маршрут не задет | `unit:test/entry-cost.test.mjs` | PASS |
| Дрейф dev относительно базы | `read:incoming-diff` | пусто — дрейфа нет |

Не прогонялось: `build:*`, полный `gate:small`, смоки/perf/golden-матрица целиком —
не требовались: ни один риск диффа не задевает TypeScript/бандл/продукт-рантайм,
полные наборы — предрелизный гейт, а не гейт ревью (§8); совместимое доказательство
уже принято validate-gate на этом SHA. Коммитные трейлеры (`Issue:`/`User-Visible:`)
по тексту самих коммитов не проверялись буквально — доступный тулинг ревью не даёт
`git show`/доступа к телу коммита, только `read:log` (oneline) и объявленные
checks/diff; содержимое диффа (нет правок `docs/CHANGELOG*.md`) и общий trailer-юнит
(PASS) не дают оснований подозревать нарушение, но это честная граница, а не
независимое прочтение трейлеров этого материала.

## Независимый разбор

- `configDifference`: рекурсивный bounded diff, `limit` валидируется (`1..128`,
  `Number.isSafeInteger`), глубина ограничена 128 (защита от патологически вложенных
  объектов — для JSON-конфигов без циклов достаточно). Различает добавление/удаление
  ключа, смену значения, изменение длины массива и порядка элементов (`[1,2]` vs
  `[2,1]` → `changedPaths:['/0','/1']`), JSON Pointer escaping (`~0`/`~1`) корректен.
  Отдельно считает `serializedEqual` (строгое байтовое сравнение) и `dataEqual`
  (структурное) — что явно разводит "строгий оракул всё ещё красный" и "данные
  совпадают, но ключи/массив в другом порядке"; это именно то разграничение, которого
  не хватало историческому логу (`docs/analysis` корректно констатирует это).
- Вызов из `settings-polish-955.mjs`: диагностика строится строго **после**
  `out[name+'_cancel_preserves_config']=…` (булев результат уже вычислен и записан) и
  только при его `false`; `diagnostics[name]` не используется нигде для изменения
  `out`/`checkAll(out)` — проверено чтением всего файла. Оригинальный оракул
  (`JSON.stringify(original)===JSON.stringify(current)`) не изменён ни синтаксически,
  ни по порядку вычисления.
- Вызов из `demo/golden/run.mjs`: `uiLab1081CaptureEvidence(page)` вызывается на
  строке 1051, **после** `captureGoldenFrame` (1050, кадр уже снят и неизменяем) и
  задолго до блока сравнения с baseline (`result.status=…`, строки ~1192–1214);
  результат кладётся в `result.captureEvidence`, который нигде не читается при
  вычислении `comparison.passed` — проверено `Grep` по использованию `captureEvidence`
  и чтением окружающего кода сравнения. Это ровно post-verdict evidence, не ещё один
  compare/retry/mask, как и заявлено в `demo/golden/README.md`/анализе.
  `ui1081-device` — существующий маркер из `addUiLab1081Fixture` (не переименован и
  не задет).
- Профили/реестр CI: три правки (`demo/helpers/…` в tooling-include, тестовый файл в
  tooling-include и product-exclude) симметричны соседним записям (`ci-profiles.test.mjs`
  и т.п.) и подтверждены генератором (`static:ci-profiles`/`static:ci-registry-inventory`
  PASS — не разошлись с версией в дереве).
- `docs/release-ledger/v1.82.0/1133.json`: `category: infra` оправдан — чистая
  диагностика/инструментирование CI, не пользовательская функция и не фикс
  продукта; `visual` поле отсутствует обоснованно (сцена golden не меняет baseline
  и не заявляет намеренное визуальное изменение).
- `docs/analysis/1133-ci-flake-evidence.md`: по каждому из трёх отказов даёт именно
  "явную дальнейшую классификацию" (как требует issue), без утверждений о факте
  устранения причины, явно отделяет отдельное решение владельца #1145 (117ms) от
  этой поставки и не ретроактивно его применяет; корректно утверждает, что
  исторический 100ms-лимит остаётся FAIL.

Рискованных гипотез для этого диффа немного (инструментирование, а не логика
продукта): (а) диагностика могла бы незаметно ослабить оракул — опровергнуто чтением
порядка вычислений; (б) сгенерированные профили могли разойтись с генератором —
опровергнуто `static:ci-profiles`/`static:ci-registry-inventory`; (в) STATUS-счётчик
мог разойтись с фактом — опровергнуто `static:inventory`. Других вызывающих путей,
побочных эффектов или путей отказа в диффе нет: новый helper нигде не импортируется
продуктовым кодом (`src/**`), только двумя demo-файлами.

## Находки

Находок High/Medium не выявлено.

## Что проверено и корректно

- Диагностика в Golden и Cancel-смоке строго post-verdict, не меняет существующие
  строгие оракулы и не создаёт второй путь PASS.
- Новый `configDifference` корректно реализован и покрыт тремя юнит-тестами,
  включая отрицательные случаи (`assert.throws` на `limit=0` и `limit=129`) — защитный
  путь имеет разрешённого свидетеля отказа прямо в тесте.
- Генерируемые CI-профили/реестр синхронизированы с генератором.
- `docs/STATUS.md` Tests-счётчик (5898) совпадает дословно с фактическим выводом
  `npm run inventory` — одно число, один источник.
- Release-ledger классификация (`infra`) соответствует содержанию поставки.
- Нет правок `src/**`/`custom_components/**`, нет новых compatibility-полей,
  миграций, UX-контракта, touch/perf-путей; трек `show` обоснован.

## Чего не проверял

- Буквальное содержимое трейлеров (`Issue:`/`User-Visible:`) двух коммитов диапазона
  — недоступно через предоставленный тулинг (нет `git show`/доступа к телу коммита,
  только oneline-лог и объявленные read/diff/unit checks); не нашёл признаков
  нарушения (нет правок changelog, общий trailer-юнит PASS), но это не равнозначно
  прочтению самих трейлеров этого материала.
- Полный `gate:small`, build/typecheck напрямую в этой сессии — переиспользовано
  принятое доказательство validate-gate для материала (контекст подтверждает
  `review-light proof is complete`); адресных пробелов, которые требовали бы
  самостоятельного build/typecheck, не найдено.
- Полная golden-матрица/perf-матрица/полный смок-набор — не требуются: диапазон не
  меняет замеры/пороги/baseline, только добавляет пост-кадровую метадату и
  пост-отказовую диагностику; это предрелизный, а не ревью-гейт.

## Маршрут

Критерии §5 (complexity/surfaces/migration/ux-contract/perf-touch/undocumented)
пройдены: изменение инструментальное, одна поверхность (CI-диагностика/генерируемые
профили), без миграций/compatibility-полей, без нового UX-контракта, без влияния на
производительность/touch, ожидаемое поведение зафиксировано в самом issue и в
`docs/analysis/1133-ci-flake-evidence.md`. `route: fix`.

---

**Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 → в задаче · Документ: docs/reviews/CODE-REVIEW-1133-r1.md**

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImYyMTE3YTZjNjJiYzhjY2UyNTk5ZWJhZGE4NGI5Y2Y4NGNkOTU5YzgzZGMxNTRjNDAyNjFkNTg4NDZmYWYyNDIiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI2YWFiNTQxZTRjNGFhOTAwMzg2MjBjOTJjMDk2MDVkNDJkYTI1OWI4NjQyNmEyNWIwN2U0YjI3OWM5ZjFjNWRlIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTMzLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI0ZTBkZjY2ZjA2OWU4N2U2NTg1MzA0ZTlmNDQ4ZjljNjEwZTYwMDRiIiwidHJlZSI6IjFmOTczYzkwYjg4Njc1YzkyMmEzYWRlMzkxZjYyMjMwYjdhODQ3NTIiLCJib2R5RGlnZXN0IjoiNmE5NmYyZTVjZWQyZTRiNTdiYTg2ZmZkOTg4NTIzZmQ4NDhiMGYxZWIzMzM4MGUxMGUwZjY5NjE0MWM1YzNlZiIsInByb2R1Y2VyUnVuIjoiNDEwNjA2OTY4MDkiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImY5OTYyOWRmNWRlYjcyYjE4NjE1MzYzNmRjMjg4NTUwMzAyYzcwNWY0OTQ4MDVkZjdjMzBmNTliMjZhMWE5MjEiLCJ2ZXJkaWN0RGlnZXN0IjoiZDk1MzkxZGNlN2EwY2Q3OTcwNmZjZTBiZmNhMmMxOTNlZWExNzJjOWMwYTY4MDVjZWIyMTkwMmYzYWI0NWI5YSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJkOTUzOTFkY2U3YTBjZDc5NzA2ZmNlMGJmY2EyYzE5M2VlYTE3MmM5YzBhNjgwNWNlYjIxOTAyZjNhYjQ1YjlhIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTIzNzIwMTA5LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTMzI2lzc3VlY29tbWVudC02NTIzNzIwMTA5IiwiYm9keURpZ2VzdCI6IjE1ODk2YjM1OGM1YTc1YjYxNDUwMjVmNGEzZmUyNzM1ZTgxYTNkNzQyNGZmNDliOWZhYmRhN2ZhYjM3Y2Q2M2QifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1133-ci-flake-diagnostics`, коммит `4e0df66f069e` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `1f973c90b88675c922a3ade391f62230b7a84752`
  ```
  git log --all --format='%H %T' | grep 1f973c90b886
  ```
- Тело issue: `6a96f2e5ced2e4b57ba86ffd988523fd848b0f1eb33380e10e0f696141c5c3ef`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":41060696809,"run_attempt":1,"digest":"e149b5f6e5ce010c886e2a7b1d92979719a855f732b15b4432b7fa27a529ac13"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NjAsIm91dHB1dF90b2tlbnMiOjE4OTgxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjExOTU5MiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjI4OTc4MjAsImNvc3RVc2RFc3RpbWF0ZSI6MS4yNDc4NjJ9XSwidHVybnMiOjQ0LCJkdXJhdGlvbk1zIjoyNjg4NTEsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjI0Nzg2MiwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=60 output_tokens=18981 cache_creation_input_tokens=119592 cache_read_input_tokens=2897820 num_turns=44 -->
