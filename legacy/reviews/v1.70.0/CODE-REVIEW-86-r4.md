# CODE-REVIEW-86-r4

- **Issue:** #86 — Тексты подсказок к настройкам, партия 1
- **ТЗ:** `docs/specs/086-settings-help-content-party1.md` (актуализировано этим же раундом, п.14 «Golden»; зелёный SPEC-REVIEW-86-r1)
- **SHA материала:** `7408f8afbfc86471c266e4728be5970a4b378b76` (`origin/dev` = `d14cf769`, диапазон не переписан рейзом)
- **Заход:** r4 · блокирующих циклов израсходовано 3/4 (r1 — красный, r2 — жёлтый, r3 — жёлтый)
- **Объём разбора:** по дельте (см. ниже)

## Почему разбор по дельте, а не заново

Между документом r3 (`96bd3e3e`) и текущим HEAD (`7408f8af`) веток не
переписывал ребейз: `git merge-base origin/dev HEAD` == `git rev-parse
origin/dev` == `d14cf769` — та же база, что была у r3, рейза не было. Дельта —
ровно 3 коммита (`git log --oneline 96bd3e3e..HEAD`): `983533a9` (сам
документ r3, не продуктовое изменение), `769cc13d` и `7408f8af`.

`git diff 96bd3e3e..HEAD -- . ':!docs/reviews'` касается только: файлов
golden-конвейера (`demo/golden/{matrix,harness,run}.mjs`), двух новых PNG
эталонов, `baselines-index.json`, `docs/images/screenshots.json` +2 PNG,
`docs/specs/086-…md`, `test/golden-matrix.test.mjs`, и производных бандл-деревьев
(переименование хешированных файлов из-за смены встроенного
`sourceFingerprint`). `git diff 96bd3e3e..HEAD -- src/ custom_components/houseplan/*.py
tests_backend/` — пусто: ни строки продуктового кода, ни бэкенда дельта не
трогает. Это ровно находка r3 M1 (golden-канал для AC7 «browser zoom 200%») и
её механическое следствие (обязательная пересъёмка docs-скриншотов из-за
сдвига общего `sourceFingerprint`), новой подсистемы не задето, контракт
поведения не менялся. Разбираю AC7 заново по существу дельты и наследую
остальные AC из r3 без повторного пересчёта — условия PROCESS.md §2.9
выполнены: дельта локальна и сопоставима по объёму с самой находкой, которую
закрывает.

## Скоуп дельты

- `769cc13d` — добавляет два golden-сценария `settings-help-zoom-200-en-light`
  / `settings-help-zoom-200-ru-dark` (390×900 CSS px, `deviceScaleFactor: 2`)
  в `demo/golden/matrix.mjs` (`GOLDEN_MATRIX_VERSION` 52→53); учит
  `harness.mjs` открывать `general-help` диалог и явно проверять, что trigger
  и tooltip остаются в viewport и у диалога нет horizontal overflow; учит
  `run.mjs` поднимать по браузеру на каждый уникальный `deviceScaleFactor`
  сценариев вместо одного общего; добавляет `test/golden-matrix.test.mjs`
  проверку состава новых сценариев; правит §14 ТЗ, описывая контракт.
- `7408f8af` — принимает два новых PNG-эталона (reviewed) и обновляет
  `docs/images/screenshots.json` + 2 PNG, чья пиксельная сумма сдвинулась
  из-за смены `sourceFingerprint` (тот же хеш встроен и в docs, и в golden
  корпус — правка `harness.mjs`/`matrix.mjs`/`run.mjs` меняет его для обоих).

## Закрытие раунда r3

| Находка r3 | Чем закрыта | Где это видно |
|---|---|---|
| **M1** (Medium, в скоупе) — ТЗ §13/§14 требует для AC7 два отдельных канала доказательства («smoke + representative reviewed golden»); смок был закрыт в r3, golden-кадр так и не появился ни в r2, ни в r3 | **Закрыта полностью.** `769cc13d` добавляет ровно то, что r3 требовал текстом «Что нужно»: `deviceScaleFactor: 2`, viewport 390 CSS px, light+dark, `helpTextRegion` семантическая проверка, `npm run golden:accept -- --reviewed` со ссылкой на прогон. Проверил лично трояко: (1) прочитал assertion в `harness.mjs` — бросает, если `aria-expanded != 'true'`, trigger/surface вне viewport или `dialog.scrollWidth > dialog.clientWidth + 1`, это не тавтология; (2) открыл оба принятых PNG (`demo/golden/baselines/settings-help-zoom-200-{en-light,ru-dark}.png`, 390×900) — на обоих виден открытый попап `gs.bg_mode.help` («Follows the Sun» / «Следует за Солнцем»), диалог целиком в кадре, переполнения нет; (3) вытащил лог job `Golden-кадры против принятых эталонов` прогона Validate на этом же SHA (databaseId `99251300227`, run `33309242147`) — оба новых сценария в списке `passed`, из 147 сценариев ни одного `different`/`missing`, и ключ переиспользования golden в этом прогоне — `cache not found` (job `Переиспользование`, шаг «Маркер golden»), то есть это не переиспользованный старый результат, а настоящее исполнение на `7408f8af`. |

## Унаследовано из r3

Разбор по дельте (см. выше), поэтому AC1–AC6, AC8, AC9 не пересчитывались
заново — дельта их не задевает (ноль строк вне golden-конвейера/docs). Из
`docs/reviews/CODE-REVIEW-86-r3.md` (SHA `96bd3e3e`) принимается без
повторной аргументации:

- инвентарь 11 Party-1 ключей, отсутствие дублей title/`.rhint`, parity
  RU/EN/DE/FR, source-контракт и мутационный гейт
  `settings-help-party1-placement-removed` — код, который это доказывает
  (`houseplan-editor-runtime.ts`, `houseplan-onboarding-runtime.ts`,
  словари), в дельте `96bd3e3e..HEAD` не изменился ни на строку;
- cold-onboarding browser smoke (5 `space.*` подсказок) — файл
  `demo/smoke_help_affordance.mjs` дельтой не тронут;
- AC7 «узкий viewport 390 px» (без zoom) — доказательство из r3
  (`device-inbox-narrow-ru-dark`, `toggle-entity-dialog-mobile-ru`) не
  затронуто, эти сценарии по-прежнему в матрице и `passed` в том же прогоне;
- AC8 (модель/поведение настроек не меняются) — `src/**` в дельте пуст, новых
  рисков не появилось;
- находка **L1** (Low, снята без правки ещё в SPEC-REVIEW-86-r1 и
  подтверждена в r1/r2/r3 code-review: `.help`-ключ не совпадает буквально с
  ключом label) — дельта её не касается, решение прежних раундов остаётся в
  силе, powторно не аргументирую.

## Как проверялось

Зелёный точный Validate уже есть на этом же SHA (`7408f8af`, run
`33309242147`, `headSha` совпадает побайтово, `conclusion: success`) — сверил
это сам через `gh run view --json headSha,conclusion`, а не со слов автора.

| Гейт | Как проверено | Результат |
|---|---|---|
| Typecheck, unit, build, sync 3 копий бандла, bundle:budget, no-new-any | job «Фронтенд» прогона `33309242147` | `success` — не перегонял сам (инструкция раунда: эти гейты на этом SHA уже подтверждены) |
| check-docs, provenance, process.yml sync, process-gate | job «Предполётные проверки», шаг «Вердикт»: `DOCS/WORKFLOW_SYNC/PROVENANCE/PROCESS_GATE = success` | все 4 зелёные |
| **Golden** (`npm run golden:verify`) | job «Golden-кадры против принятых эталонов» того же прогона: 147/147 `passed`, включая `settings-help-zoom-200-en-light` и `settings-help-zoom-200-ru-dark`; job «Переиспользование» подтверждает `Cache not found` для ключа golden — прогон настоящий, не переиспользован | `exitCode=0`, реальное исполнение на `7408f8af` |
| Смоки в браузере | job «Смоки» в этом прогоне — `skipped`, но легитимно: `gate-reuse.mjs` считает ключ smoke только по `demo/smoke_[^/]+\.mjs`, дельта их не трогает (`Cache hit`, шаг «Маркер smoke»); дополнительно прогнал `node scripts/smoke-select.mjs --base 96bd3e3e --head HEAD` лично — «Исполняемого frontend-диффа нет (src/**/*.ts не тронут). Browser-smoke этим диффом не выбираются» | пропуск обоснован инструментом, не тихий |
| Селекторы нового кода harness.mjs (`data-help-key`, `.trigger`, `.tooltip:popover-open`, `aria-expanded`, `_openSettingsDialog`) | сверил построчно с `src/hp-help.ts` (476–484) и `src/houseplan-card.ts`/`houseplan-editor-runtime.ts` (`_openSettingsDialog`) | все селекторы существуют в реальном коде, не выдумка |
| Два PNG, изменившихся в `docs/images/**` из-за сдвига общего `sourceFingerprint` | извлёк `06-device-editor.png` и `08-room-card.png` до/после дельты, сравнил пиксельно (`PIL.ImageChops.difference`) | разница — единицы пикселей на границах текста (суб-пиксельный anti-aliasing), визуально идентичны на глаз, содержимого не меняли; согласуется с тем, что дельта не трогает `src/**` |
| Трейлеры | `git show -s --format=%B` на `769cc13d`, `7408f8af` | `Issue: #86` на обоих; `User-Visible: no` на обоих (корректно — тест/тулинг, ни одного видимого пользователю изменения); `7408f8af` несёт `Release:`+`Baseline-Reviewed:` со ссылкой на зелёный Linux-прогон приёмки скриншотов |
| `test/golden-matrix.test.mjs` | прочитал новый тест целиком: проверяет ровно 2 сценария, оба темы, оба языка, `deviceScaleFactor: 2`, `viewport: 390×900`, `dialog: general-help`, `openHelp: gs.bg_mode.help`, `capture: page` | тест не тавтологичен для состава матрицы (упадёт, если сценарий переименуют/уберут атрибут) |

**Не прогонял сам и почему:**
- `npx tsc --noEmit`, `npm test`, `npm run build` + сверка копий бандла —
  сняты условием раунда «дешёвые гейты на этом SHA уже подтверждены», сверил
  только что Validate реально завершился на этом самом SHA;
- `npm run golden:verify` локально — не перегонял: `verify`-режим намеренно
  не допускает `--scenario=`-фильтр (`policy.mjs: assertGoldenInvocation` —
  «golden verify must run the complete matrix»), а полный прогон уже
  подтверждён логом реального (не переиспользованного) исполнения на этом же
  SHA; независимая проверка выполнена иначе — чтением assertion-кода и
  визуальным осмотром принятых PNG;
- 12 «прямых» и 18 «слабых» смоков из `smoke-select.mjs` — инструмент сам
  сообщил, что выбирать нечего (`src/**/*.ts` не тронут);
- `python -m pytest tests_backend -q` — diff не касается `custom_components/**/*.py`;
- мутационный гейт `settings-help-party1-placement-removed` — не перегонял:
  мутирует шаблоны `houseplan-editor-runtime.ts`/`houseplan-onboarding-runtime.ts`,
  дельта их не трогает, последний личный прогон — r1;
- `model-invariants`, `performance_smoke`, остальные ~193 браузерных смока —
  diff не касается геометрии, ссылок на неё или perf-путей.

## Находки

Нет. High и Medium в скоупе не обнаружено. Единственная открытая находка —
унаследованная L1 (Low, снята без правки ещё в r1) — дельтой не задета,
повторно не поднимаю.

## Что проверено и корректно

- **AC7 (полностью, оба канала).** Смок (390 px + browser zoom 200%) закрыт
  в r3 и не тронут этой дельтой; golden-канал теперь тоже закрыт —
  представительный reviewed кадр `gs.bg_mode.help` в общих настройках, light
  и dark, `deviceScaleFactor: 2`, семантическая проверка (`helpTextRegion`,
  границы trigger/surface) — реально исполнен и прошёл на `7408f8af`, а не
  заявлен на словах.
- **Golden-инфраструктура.** Рефакторинг `run.mjs` (пул страниц по
  `deviceScaleFactor`, отдельный `pageErrors` на страницу) не сломал
  остальные 145 сценариев — все `passed` в том же прогоне, включая уже
  бывшие проблемными в r1 `device-inbox-*`/`toggle-entity-dialog-*`/`space-room-color-popover-desktop-ru`.
  `assertFreshDemoBundle` по-прежнему вызывается на основной странице до
  цикла сценариев — подмену бандла ловит как раньше.
- **AC1–AC6, AC8, AC9.** Ноль изменений в дельте вне golden-конвейера и
  docs — унаследованы из r3 без пересчёта (см. «Унаследовано из r3»), риск
  регрессии от этой дельты в них отсутствует по построению (дельта их файлов
  не касается).
- **Одно число — один источник.** Дельта не добавляет и не меняет ни одной
  пользовательской величины (только тестовый/docs-конвейер); правило
  неприменимо.
- **Трейлеры и changelog.** `Issue: #86` на обоих коммитах дельты;
  `User-Visible: no` корректно — ни один коммит не меняет видимое поведение
  продукта, changelog не требовался и не трогался.

## Вывод

Находка r3 (M1) закрыта полностью и доказуемо: golden-кадр для AC7
«browser zoom 200%» существует, прошёл реальное (не переиспользованное)
исполнение на итоговом SHA, и я лично проверил его содержимое по трём
независимым линиям (assertion-код, пиксели PNG, CI-лог). Дельта с r3 не
трогает ни строки продуктового кода, поэтому остальные AC наследуются без
повторной проверки. High и Medium в скоупе — 0. Вердикт зелёный; по правилу
раунда бюджет циклов на зелёном вердикте не расходуется.
