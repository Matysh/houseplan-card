# CODE-REVIEW-292-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/292
- **Этап:** код-ревью (PROCESS.md §2.7)
- **Диапазон:** `origin/dev..HEAD` на SHA `2fda6fa086e7ed7aa0d5964ec57683224fde0c39`
  (6 коммитов: `e1f0d231` спека, `474dbd62`/`314b498e` документы спек-ревью,
  `e03238ec` правка спеки r1→r2, `cd886335` реализация, `2fda6fa0` приёмка
  фингерпринта скриншотов)
- **Заход:** r1 · блокирующих циклов израсходовано 0 из 4
- **Ревьюер:** Claude (роль ревьюер кода, PROCESS.md §6), свежая сессия без
  контекста реализации

## Скоуп

Первый заход код-ревью — разбор полный, не по дельте (§2.9 неприменим).

Продуктовый диапазон (класс A/B, коммит `cd886335`):

- `src/resize.ts` — новый тип `SAFE_RESIZE_REASONS`/`SafeResizeReason` (без
  изменения набора значений) и новая тест-диагностика
  `auditSafeResizeEligibility()`; логика `resolveSafeResize`/`applySafeResize`
  **не менялась**;
- `src/i18n/en.json`, `src/i18n/ru.json` — переписаны 4 текста disabled-причин
  (`side-angle`, `duplicate-physical-wall`, `partial-shared`,
  `unequal-shared`); ключи те же;
- `demo/smoke_room_resize.mjs` — добавлены проверки click/Enter/Space на
  disabled-ручке и явный подсчёт `_writeConfig`/history после pointerdown;
- `scripts/mutation-gate.mjs` — один новый мутант
  `resize-audit-resolver-bypassed`;
- `test/resize-availability-audit.test.mjs` (новый), `test/resize-production-path.test.mjs`
  (+2 теста) — точный baseline на обеих реальных фикстурах и source-guard;
- `docs/RESIZE.md`, `docs/TESTING.md`, оба `CHANGELOG*.md` — документация того
  же коммита;
- `dist/**`, `custom_components/houseplan/frontend/**` — синхронный бандл
  (класс D, ожидаемо вместе с A).

`src/houseplan-card.ts` **не менялся** — активация click/Enter/Space,
`aria-disabled`, `_rszReasonText`/`_rszOptsFor`/`_rszObstacles` уже существовали
из #277/#289; #292 меняет только содержимое i18n-строк и добавляет
не-влияющую на runtime тест-диагностику.

Отдельный коммит `2fda6fa0` (класс C, `User-Visible: no`) принимает новый
`sourceFingerprint` в `docs/images/screenshots.json` после пересборки — без
изменения самих изображений (`imageSha256` не менялся ни в одном сценарии).

## Как проверялось

Локальный запуск на выданном SHA, ветка `issue/292-resize-availability-audit`
содержит весь `origin/dev` (рабочая копия к моменту ревью приведена, §10.4):

| Команда | Результат |
|---|---|
| `npx tsc --noEmit` | green, без вывода |
| `npm test` | 1251 тестов: 1250 passed, 1 expected skip (совпадает с хендоффом автора) |
| `npm run build` | green; `git status` после пересборки чист — бандл побайтово совпал с закоммиченным |
| `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | идентичны |
| `node scripts/check-docs.mjs` | «Documentation checks passed (7 files, 10 external links)» |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «зарегистрированная связь»: `smoke_resize_pointer_real_plan.mjs`, `smoke_room_resize.mjs` — оба прогнаны (см. ниже) |
| `node demo/smoke_room_resize.mjs` | OK, включая новые click/Enter/Space/zero-write проверки |
| `node demo/smoke_resize_pointer_real_plan.mjs` | OK |
| `node demo/smoke_resize_outer_reconciliation.mjs` | OK (не назван смок-селектором, но прогнан автором и мной — касается той же shared-wall механики) |
| `node scripts/mutation-gate.mjs --id=resize-audit-resolver-bypassed` | «тест покраснел, как обязан» — 1 из 1 пойман |
| `node scripts/model-invariants.mjs --config <real-plan-second-floor.json как config>` | «Инварианты выполнены» — статически, до правки |
| `node scripts/model-invariants.mjs --config <тот же план после применённого AC2-сдвига>` | «Инварианты выполнены» — см. отдельную проверку AC8 ниже |
| `node scripts/process-gate.mjs` | «гейт пройден, предупреждений 0» |
| `gh run view 32744762964` (Validate) | `conclusion: success`, `headSha: 2fda6fa0…` — точный SHA, как того требует §8 |
| `gh run view 32744514520` (Docs screenshots) | `conclusion: success` |

Не прогонялось, с причиной:

- `npm run golden:verify` (полный визуальный гейт) — diff не меняет разметку,
  CSS или геометрию рендера, только текст `aria-label`/toast и тест-only
  функцию; AC9 его не называет. Предрелизный гейт по §8, не гейт ревью.
- `python -m pytest tests_backend -q` — ни один файл `custom_components/**/*.py`
  не тронут.
- Полный набор `demo/smoke_*.mjs` (184 файла) — смок-селектор указал два
  зарегистрированных смока, оба прогнаны; полный прогон — предрелизная
  обязанность (§8).
- Полный `scripts/mutation-gate.mjs` (все мутанты) — AC9 называет только
  «mutation» в единственном числе для нового резолвера; остальные шесть
  существующих мутантов Resize не затронуты этим диффом (`resolveSafeResize`/
  `applySafeResize` не менялись).
- `performance_smoke` — AC не называет влияние на перф; audit — test-only,
  рендер не тронут.

### Отдельная проверка AC6 и AC8 — не только чтением

AC6 требует, чтобы `auditSafeResizeEligibility()` не превратился во вторую,
расходящуюся реализацию eligibility. Тест `resize-production-path.test.mjs`
проверяет это только по исходнику (audit вызывает `resolveSafeResize`, не
содержит имён приватных guard-функций). Это не доказывает, что тестовая
реконструкция `optionsFor()` (не экспортируемая из продукта функция,
переписанная в тесте) даёт **те же числа**, что реальный `_rszOptsFor`/
`_rszObstacles()` в `src/houseplan-card.ts`. Проверил это исполнением, не
чтением: поднял демо-стенд (`npm run bundle:sync` + `demo/serve.mjs`), загрузил
`real-plan-second-floor.json` через тот же `config/get`, что и продукт, открыл
инструмент Resize и посчитал `.rszhandle` в DOM по `aria-disabled`/`aria-label`:

```
total 37 enabled 5
breakdown { partial-shared:14 unequal-shared:7 side-angle:6 diagonal:2 duplicate-physical-wall:3 }
```

Это **точно** совпадает с тестовым «raw»-подсчётом (до `optimizePlans`) в
`test/resize-availability-audit.test.mjs`. AC6 подтверждён исполнением в
реальном браузере, а не только статическим grep по исходнику.

(Побочное наблюдение, не находка: числа из тела issue при заведении —
`enabled 11/37` — относятся к состоянию до слияния #289, чей более строгий
guard по смешанным ролям задел и эту фикстуру. Это ожидаемо и явно принято
предположением спеки №1: «после исправлений число запретов может оставаться
высоким» — не регресс этой задачи.)

AC8 требует, чтобы после разрешённых целевых сдвигов на реальных фикстурах
проходили инварианты модели (wall keys, mixed-role, references, opening
host/fit, room orientation, physical geometry preflight) и не менялись число
стен и мультисет `wall.cm`. Автоматический тест на это в диффе покрывает
только количество стен и `cm` для одной ручки (`resize_pointer.wall_metadata_preserved`
в `smoke_resize_pointer_real_plan.mjs`, не новый для этой задачи). Полного
`checkWallKeys`/`checkReferences`/`checkMixedRoleRecords` прогона после сдвига
в диффе нет. Собрал это руками: применил `resolveSafeResize`/`applySafeResize`
для `room-a` edge 2 (флагманский случай AC2) на `real-plan-second-floor.json`,
воспроизвёл продуктовый ре-кей (`rekeyWallsAfterMove`/`rekeyOpenSpansAfterMove`,
как делает `_rszApplyPreview`), собрал результат обратно в конфиг и прогнал
`node scripts/model-invariants.mjs --config`: «Инварианты выполнены»; число
стен 24→24, мультисет `cm` не изменился. (Первая попытка без ре-кея дала два
нарушения «запись толщины вне ребёр» — это была ошибка моей реконструкции, не
дефект продукта: без вызова того же `rekeyWallsAfterMove`, что использует
`_rszApplyPreview`, старые ключи стен закономерно не совпадают с новой
геометрией.)

## Находки

Нет High. Нет Medium.

**Low (снимается с записью, не блокирует).** Автоматическое покрытие AC8 в
этом диффе уже, чем формулировка AC: оно проверяет только число стен/`cm` для
одной ручки, а не полный список инвариантов для всех разрешённых сдвигов.
Основная логика (`applySafeResize`, `rekeyWallsAfterMove`,
`rekeyOpenSpansAfterMove`) не менялась этой задачей — она унаследована из
#277/#289/#290 и уже прошла код-ревью там. Я лично воспроизвёл флагманский
случай AC2 через исполнение (см. выше) и подтвердил инварианты. Снимаю находку
без возврата автору: риск отсутствует для текущего диффа, а требовать новый
широкий автотест ради задачи, которая не меняет геометрический код, было бы
избыточно — но следующая задача, трогающая `rekeyWallsAfterMove` или
`applySafeResize`, обязана дать такой тест сама.

## Что проверено и корректно

- **AC1** — точный baseline на обеих реальных фикстурах (`real-plan-first-floor.json`,
  `real-plan-second-floor.json`) зафиксирован тестом с diff по handle id при
  расхождении (`assertExactAudit`); тест зелёный, digest/per-room breakdown
  проверены построчно.
- **AC2** — `room-a:2`/`room-b:2` второй фикстуры: оба enabled, план содержит
  ровно `['room-a','room-b']`, третья комната не входит (`test/resize-availability-audit.test.mjs:183-190`,
  плюс независимо воспроизведено мной через исполнение выше).
- **AC3** — выделенный тест «Optimize removes the confirmed false near-axis
  reasons only» показывает `diagonal 2→0`, `side-angle 6→3` после Optimize,
  реальный угол остаётся заблокирован; для `duplicate-physical-wall`
  соответствующий контракт (ложный дубликат снимается, реальная перегородка
  остаётся) — унаследован из существующего теста issue #281
  (`test/resize-optimize.test.mjs`), не переписан и не ослаблен этой задачей.
- **AC4** — `resolveSafeResize`/`applySafeResize` не менялись; шесть
  существующих Resize-мутантов (axis eligibility, third-room cascade,
  topology signature, side ownership, physical jamb, commit preflight) не
  затронуты диффом и продолжают защищать эти guard'ы; новый седьмой мутант
  защищает только сам audit.
- **AC5** — `demo/smoke_room_resize.mjs` теперь проверяет, что click, Enter и
  Space на disabled-ручке показывают один и тот же текст (`disabledActivation.expected`
  сверяется со всеми тремя), pointerdown не создаёт drag/history/write
  (`safe_resize.disabled_zero_history`/`disabled_zero_write` считают реальные
  вызовы `_writeConfig`, восстановленные после проверки). Прогнано, зелёное.
- **AC6** — подтверждено исполнением в реальном браузере (см. выше), не
  только по исходнику.
- **AC7** — логика клампа/preflight не менялась (унаследована из #277/#290,
  проверено чтением: `clampSafeResize`/`validateSafeResize` не входят в
  изменённые строки `src/resize.ts`).
- **AC8** — подтверждено целевым воспроизведением флагманского случая (см.
  выше); Low-находка про ширину автоматического покрытия зафиксирована и
  снята с запиской.
- **AC9** — типecheck/test/build/bundle-sync/check-docs зелёные; целевой
  eligibility-тест, названные production-смоки и точечный mutation прогнаны
  локально мной независимо от хендоффа автора, с совпадающим результатом.
- Тексты причин (`src/i18n/en.json`/`ru.json`) не обещают Optimize для
  `diagonal`/`side-angle` (проверено тестом
  `test/resize-production-path.test.mjs:67-68` и содержательно — обе строки
  действительно не содержат «Optimize»/«Оптимиз»), а `duplicate-physical-wall`
  называет безусловное действие («remove or move» / «удалите или
  переместите») — соответствует §5 спеки и было единственной Medium-находкой
  спек-ревью r1, закрытой в r2.
- Трейлеры коммита `cd886335`: `Issue: #292`, `User-Visible: yes`, оба
  changelog правлены в том же коммите. Коммит `2fda6fa0`: `User-Visible: no`,
  корректно для чисто фингерпринт-принятия без изменения картинок.
  `process-gate.mjs` зелёный, 0 предупреждений.
- Ветка перед ревью содержит весь `origin/dev` (проверено
  `git merge-base --is-ancestor origin/dev HEAD`) — предревьюная приводка по
  §10.4 выполнена, читаю приведённое состояние.
- «Одно число — один источник»: новый счётчик `auditSafeResizeEligibility`
  test-only и не попадает в UI/config; единственное число, которое видит
  пользователь дважды в этом диффе, — текст disabled-причины через
  `aria-label` и через toast (click/Enter/Space) — оба берут строку из одного
  и того же `_rszReasonText()`/`_t()`, ключ не продублирован. Других
  пользовательских величин дифф не вводит.
- Docs screenshots: фингерпринт принят без изменения самих изображений
  (`imageSha256` идентичен во всех сценариях до/после, проверено диффом
  `docs/images/screenshots.json`); CI `Docs screenshots` зелёный на этом
  результате.

## Чего не проверял

- Полный `npm run golden:verify` и полный `demo/smoke_*.mjs` (184 файла) —
  предрелизный гейт, не гейт ревью (§8); diff не меняет визуал/геометрию рендера.
- `pytest tests_backend` — Python не тронут.
- Полный прогон `scripts/mutation-gate.mjs` по всем мутантам Resize — они не
  затронуты диффом (`resolveSafeResize`/`applySafeResize` не менялись);
  прогнан только новый.
- `performance_smoke` — не назван AC, чувствительные пути не тронуты (audit
  test-only).
- Состояние `docs/specs/README.md` — вне зоны код-ревью.
- Технический спор внутри спек-ревью r1/r2 (снятая Low-находка про явные теги
  доказательства AC) — не пересматриваю: решение ревьюера ТЗ в силе,
  это не предмет код-ревью.

## Вердикт

```
Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0
Документ: docs/reviews/CODE-REVIEW-292-r1.md
```
