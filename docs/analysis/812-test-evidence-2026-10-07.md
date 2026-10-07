# #812 — свидетельства надёжности проверок, 2026-10-07

Основание: [issue #812](https://github.com/Matysh/houseplan-card/issues/812),
зелёное `SPEC-REVIEW-812-r1`. Реализация от `dev@083a491f` после #811;
последующий `fd950549` меняет только сгенерированный индекс ревью.
Среда исполнения: Ubuntu/WSL, Node 22.23.2, установленный по lockfile Playwright
и его Chromium. Bash-сценарии выполнены на Linux, не пропущены на Windows.

Это журнал конкретных probes, не новый источник требований. ТЗ остаётся в issue.
Результат обязательного `gate:small` на финальном коммите и SHA публикуются в
хендоффе перед S7. Продукт, численные бюджеты, эталоны и CI/reuse policy не меняются.

## Матрица AC и отрицательных свидетельств

| AC | Положительное доказательство | Чем краснеет / отрицательная проба |
|---|---|---|
| AC1 | `check-inputs` проверяет реальные imports `process-gate`, строки с `/*`, URL, escaped quotes, regex, re-export и template interpolation. Общий scanner статический. | До исправления новые probes теряли настоящие импорты; импортоподобные строки/комментарии не должны становиться code-ребром. Fixture содержит `throw`: discovery её не исполняет. |
| AC2 | Виртуальный mixed graph проходит оба порядка корней и рёбер, цикл и повышение data → code; каждый code-файл читается один раз. | Старый общий `seen` терял `c.mjs`; data-only, `stopAt`, `LEAF_FILES`, directory documentation/binary и baseline overlay остаются отрицательными границами обхода. |
| AC3 | Один `importClosure` подключён к четырём sandbox-harness. Исполняемая fixture получает transitive static/re-export/side-effect/script-URL модули, возвращает `{total:42,child:"42"}`. | Реальные старые closures из `083a491f` копировали 5/9, 8/9, 8/9 и 6/9 модулей; все четыре запуска отказывали из-за missing side/re-export leaf. Новый копирует 9/9. По отдельности удалены четыре обязательных leaf-модуля из временных sandbox: каждый запуск отказывает с `ERR_MODULE_NOT_FOUND`. Missing source даёт `ENOENT`, цикл конечен. |
| AC4 | Общий workflow parser задаёт приоритет shell; семь вариантов реально исполняются Bash. Метрики получают комментарии исполнением двух актуальных шагов `_process.yml` с fake gh. | Старый detector ошибочно считал inherited bash нарушением (1 вместо 0). Старый шаблон метрик терял реальный список конфликтов. Реальные large-label/removed-label/blocked/review-4 случаи сохранены; две копии шага с неизвестной первой строкой дают `unknown`, несмотря на Validate/rebase ниже. |
| AC5 | Дифф `space-render` без известного символа выбирает и основной, и identity smoke, сохраняя `unproven` и visual minimum. Чужой файл основной smoke не выбирает. | До добавления связи targeted test отказал: `smoke_space_card.mjs` отсутствовал, `undefined` вместо файла связи. После изменения suite 15/15. |
| AC6 | Первый radar-сценарий сверяет plan coordinates, heading=0, draft strings и SVG endpoints после двух primary-жестов; Cancel проходит реальное подтверждение и не меняет server radar. | Усиленный oracle со старым событием без `isPrimary` дал exit 1: `oneGestureIncomplete=false`, `installationDrafted=false`. После двух `isPrimary:true` — exit 0. Вторичные жесты оставляют mount пустым, одного primary-жеста недостаточно. Spy проверяет также payload каждого config/set до Cancel. |
| AC7 | Тот же iteration-plan helper используется runner и unit; `warmups=0` исполняет ровно `[0,1,2]` для трёх samples. Остальные ранее поддержанные значения сравнены со старой формулой. Ошибка общего контракта получает текущий профиль. | До fix план содержал лишний `-1`; error interaction-профиля начинался с `large-house-v1`. Оба probes отказали, после fix зелёные. |
| AC8 | Backdrop включён в существующий общий цикл проверок 2.5D budget-файлов: потолок 1550 и прежние relative allowance. README/TESTING сверены с workflow. | До включения backdrop membership probe отказал. Теперь к его реальному JSON применяется тот же assert потолка и allowances, что к остальной семье; численные JSON не правились. |
| AC9 | Self-contained setter исполняется после сериализации, как в browser. На 10 000 различных epochs независимый callback захвата stack вызван 8 раз; сохранены первые/последняя из восьми записей, cfgEpoch=10 000, dropped=9992. | До fix независимый счётчик захватов был 10 000 вместо 8. Повтор того же epoch не считается изменением; прочие diagnostic counters сохраняются. Лог явно сообщает лимит и число отброшенных traces. |
| AC10 | README ссылается на конкретный handoff #809, сцену, известные browser majors 141/151 и отмечает неизвестные исторические детали; требует pinned repeat. | Это документарная приёмка, не новый golden run и не доказательство причины расхождения. Ни skip/allowlist, ни threshold, ни baseline acceptance не добавлены. |

## Выполненные targeted-команды

```sh
node --test test/check-inputs.test.mjs test/relative-dependencies.test.mjs
node --test test/process-track.test.mjs test/publish-push-refusal.test.mjs test/rebase-generated.test.mjs test/ship-review.test.mjs test/gate-reuse.test.mjs test/classify-changes.test.mjs
node --test test/process-metrics.test.mjs test/workflow-pipefail.test.mjs test/workflow-step.test.mjs test/review-doc-guard.test.mjs
node --test test/smoke-select.test.mjs
node --test test/performance-runner.test.mjs test/performance-budget.test.mjs test/performance-contract.test.mjs test/performance-resize-attribution.test.mjs test/switch-cycle-guard.test.mjs
node --test test/performance-workflow.test.mjs test/bundle-freshness.test.mjs
npm run bundle:sync
HP_SMOKE_CHECKS=1 node demo/smoke_radar_setup.mjs
node scripts/mutation-gate.mjs --check
```

Все перечисленные targeted-команды завершились успешно. Workflow-матрица:
112/112, 0 skipped; performance suites: 51/51 и 19/19. Browser smoke: 52
именованных результата `true`, exit 0; независимо повторён второй сессией.
`mutation-gate --check` проверяет только якоря, без исполнения мутантов;
имеющиеся предупреждения динамических имён и browser membership 251/200
не превращены в новую политику или исключения.

## Границы и риски

- Scanner — ограниченный лексический разбор зависимостей, не интерпретатор JS.
  Вычисляемые пути не выполняются и не угадываются. Общая логика применяется и
  к input graph, и к sandbox closure; разрешение путей остаётся за вызывающим.
  Дополнительный read-only аудит текущих scripts/test JS через уже установленный
  TypeScript AST: 455 модулей, 876 относительных рёбер, 0 misses и 0 extras;
  TypeScript не добавлен в runtime scanner и не является новой зависимостью.
- `check-inputs.mjs` содержит собственные декларации manifest/`NOT_AN_INPUT`.
  Его строки данных не являются чтением этих файлов: они исключены только у
  самого manifest. Реальные imports всё равно транзитивны; отдельный unit
  проверяет, что обычный reader такого исключения не получает.
- Async: реальные workflow/Bash и browser Cancel. Данные/права: server config
  не меняется, продуктовые схемы не затронуты. Геометрия/визуал: oracle читает
  существующую проекцию независимо, продуктовая геометрия и golden неизменны.
  Объём: циклический граф, 12 000 меток, 10 000 epoch changes. Host/input:
  Linux shell inheritance, primary/non-primary pointer events.
- Ограничение сбора stack меняет диагностические накладные расходы, не бюджет.
  Окончательное сравнение #814 должно использовать этот harness для обеих сторон.
- Полный performance/golden не запускался: он не требуется ТЗ для неизменных
  бюджетов и диагностической обвязки. Исторический F28 не оправдывает новый
  красный golden. Бандл, screenshot и review index в коммит задачи не входят.
