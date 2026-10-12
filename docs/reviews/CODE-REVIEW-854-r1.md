# CODE-REVIEW-854-r1

Issue: #854 · code · track:show · r1 · блокирующих циклов 0/2.
Материал: `issue/854-static-witness-readiness` @ `9720f0a5ef8b66511a9568fe6ab6b1e827c95195`.
База: `d0bfb9626cb11c8ddacc5fc13eeea2ecc6c47f1a`.
Тело issue: `05640a34a395ecfb9565fa2619c44ea66583fae107328499774be0cbaacf24cf`.
Дата: 2026-10-12.

Саморевью по [прямому разрешению владельца для семи задач](https://github.com/Matysh/houseplan-card/issues/855#issuecomment-6125735643).
Это исключение для данной подборки, не независимая модель. Вызова модели и
model usage нет.

## Скоуп и метод

Прочитан полный diff, рабочий контракт issue, PROCESS/AUTHOR/REVIEWER и
mutation modules. Только B/C: общий статический validator, leaf preparation
policy, immutable changed inputs, CLI default, retired Validate job, tests/docs
и infra ledger. Продукт, bundle, browser guideline, nightly shards/timeouts и
outcome/ledger execution semantics не изменены.

Обычный unit/CLI теперь проверяет schema/IDs/paths/anchors/guard files и
статически наблюдаемую preparation; static PASS явно execution=0 и caught=unknown.
Changed refs закрепляются в SHA, checkout и tracked inputs должны совпасть;
источники проверки читаются из git object. База без declarations не даёт empty
PASS. Shared #830 policy не исполняет guard и не обещает обнаружить логически
слепой witness или доказать compilation применённого патча.

Dead development job сохранена только как совместимое имя для прежних proof
readers: ни checkout, ни installation, ни execution/cache/ledger steps; ошибочный
запрос даёт отказ. Исполнен настоящий shell tombstone через runStep. Удалены
ровно два свидетеля удалённых development setup conditions, не ночного oracle.
Ночной workflow явно включает execution; runner/attribution/proof code сохранён.

## Гейты

| Команда | Результат |
|---|---|
| `npm run gate:small` | Финальный PASS, 124 s: build/typecheck, весь unit, bundle-policy/budget, lint:unused, layout/any/private-write guards, smoke selection |
| `node --test test/mutation-readiness.test.mjs test/validate-workflow.test.mjs test/workflow-jobs.test.mjs test/mutation-gate-report.test.mjs test/testing-doc.test.mjs test/process-digests.test.mjs` | PASS, 65 tests |
| `node --test --test-name-pattern='#558: CLI\|#472 AC2\|#854\|every mutant patch' test/mutation-gate.test.mjs test/mutation-readiness.test.mjs test/validate-workflow.test.mjs` | 9/9 PASS |
| `node scripts/mutation-gate.mjs --check` | PASS, 1361 definitions, 713 unique-source-reads, 4 existing policy warnings, execution=0 |
| `node scripts/mutation-gate.mjs --check --changed=d0bfb9626cb11c8ddacc5fc13eeea2ecc6c47f1a..HEAD` | PASS on committed material: 198 definitions, 91 unique checker reads; selection 881 unique guards/8222 source reads, 6.05 s |
| `node scripts/check-docs.mjs --screenshots=warn`, `git diff --check` | PASS |

Первый full gate красный на двух наших несовместимостях: старый #472 contract
ожидал прежний порядок CLI args, #558 планировал HEAD..HEAD в грязном checkout.
Порядок сохранён; #558 проверяет настоящий CLI в отдельном чистом git fixture.
Целевой regression и финальный full gate зелёные, не flaky retry.

## AC → доказательство → чем краснеет

| AC | Доказательство | Отрицательный случай |
|---|---|---|
| AC1: readiness без исполнения | Реальный CLI с poisoned oracle в isolated git; shared validator/cache tests | Duplicate/malformed ID, unsafe/missing target, 0/2 anchors, missing guard/preparation/fix step, empty test name match; oracle execution бросает exception, patch остаётся before |
| AC2: shared preparation и immutable selection/compatibility | #830 short Node vs explicit tsc tests; frozen range; actual tombstone shell | Unknown/missing base, stale checkout, dirty registry/other tracked input, missing declaration, mistaken dev request дают отказ; нет empty green |
| AC3: static не caught, night не ослаблена | Sentinel ledger unchanged; workflow/unit outcome contracts; shared preparation helper reexport | Static attempt не может переписать prior proof; no-exec job нельзя превратить в execution/cache step; night flag обязателен |

Перед изменением full --check: 1363 definitions, 581 ms; после: 1361,
299–383 ms. Это локальные наблюдения с разным warm filesystem, не гарантированная
экономия. Before unique file reads не измерялись; после cached checker читает
713, независимо от повторных anchors. Changed selection отдельно дороже (6.05 s);
его существующее dependency closure не выдаётся за single-read cache.
Сравнение настоящих ночных escaped/preparation outcomes не выполнялось:
исполнять registry в development запрещено #709, результаты следующей ночи неизвестны.

## Риски и границы

- Data/path: schema до selection, relative paths и root containment; changed
  tracked material чистый, base читабельный. Registry — trusted JS declarations,
  не sandbox произвольного враждебного JS; загрузка definitions не означает
  применение мутантов/исполнение guards.
- Owners/async: invocation-scoped checker cache, immutable refs; нет новых
  callback/race, model/merge/publish authority или persistent success.
- Performance: checker без compile/build, выборка остаётся bounded static;
  честно записана стоимость closure. Ночной proof/execution не измерен здесь.
- Geometry/visual/host: class A, DOM/CSS, touch/kiosk и пользовательские
  настройки не затронуты. Browser/backend/full/golden не применимы к diff;
  smoke-select не выбирает frontend smokes.

Одна preparation policy используется checker/runner, прежний public export
сохранён. Новых text-checks монолита нет. Infra ledger, User-Visible:no,
без user milestone/changelog. Bundle возвращён штатным bundle:clean.
Mutants/model/manual dev merge/main/tag/beta/stable/Telegram не запускались.
Удалённый Validate и интеграция ещё предстоят; будущий PASS не выдуман.

## Вердикт

Вердикт: зелёный · r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 · Low: 0.
Саморевью выполнено по явному исключению владельца. AC подтверждены статическим
и negative-fixture контрактом, не пойманными production mutations. До S8 штатный
конвейер обязан подтвердить точный кандидат и интеграцию.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/854-static-witness-readiness`, коммит `9720f0a5ef8b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `f64a864aff8790377dff6a4fe80b391098ab58b7`
  ```
  git log --all --format='%H %T' | grep f64a864aff87
  ```
- Тело issue: `05640a34a395ecfb9565fa2619c44ea66583fae107328499774be0cbaacf24cf`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
