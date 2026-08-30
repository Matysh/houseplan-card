# CODE-REVIEW-381-r1

- Issue: https://github.com/Matysh/houseplan-card/issues/381 — «Действие по
  нажатию: добавить "Ничего не делать"»
- Этап: код-ревью (PROCESS.md §2.7)
- Ветка: `issue/381-no-op-tap-action`, ревизия на момент разбора `0e95c063`
  (приведена конвейером к `dev` до ревью: поверх легло 1 коммит `dev`,
  `f69a17cd` → `0e95c063` — тот же код, другой SHA; переисполнение не требуется,
  разбор полный по правилам первого захода)
- Заход: r1 · блокирующих циклов израсходовано 0 из 4
- ТЗ: `docs/specs/381-no-op-tap-action.md` (ревизия 2), ревью ТЗ зелёное
  (`docs/reviews/SPEC-REVIEW-381-r2.md`, заход r2, 1/4 циклов) — вопросов к
  контракту нет, разбирается его реализация.

## Скоуп диффа

`git diff origin/dev...HEAD` (46 файлов): продуктовый код —
`src/logic.ts`, `src/device-toggle.ts`, `src/houseplan-card.ts`,
`custom_components/houseplan/validation.py`, четыре словаря i18n; тесты —
`test/logic.test.mjs`, `test/device-toggle.test.mjs`,
`test/device-marker-polish-contract.test.mjs`,
`tests_backend/test_validation.py`, `demo/smoke_tap_ctx.mjs`,
`scripts/smoke-links.mjs`; документация — `docs/ARCHITECTURE.md`,
`docs/CONFIG-COMPATIBILITY.md`, `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`,
`docs/TESTING.md`, оба changelog, `docs/specs/README.md`; сгенерированное —
три копии бандла, `docs/images/{01-view-desktop,06-device-editor}.png` +
`screenshots.json` (пересъёмка из-за смены `sourceFingerprint`, весь `src/**`
затронут добавлением i18n-ключа). Единственная поверхность (Редактор
устройств → `tap_action`), без миграции конфига, без нового UX вне уже
одобренного контракта, без влияния на геометрию/толщину/`layout`.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | green, без вывода |
| Unit-тесты | `npm test` | 1585 всего, 1584 pass, 0 fail, 1 skip — совпадает с числом хендоффа автора |
| Build | `npm run build` | green, `dist` собран за 10.3 с |
| Сверка бандла | `cmp dist/houseplan-card.js custom_components/.../houseplan-card.js`, `diff dist/houseplan-assets.json .../houseplan-assets.json`, `diff -rq dist/houseplan-assets .../houseplan-assets` | все три идентичны байт-в-байт |
| Docs fingerprint | `node scripts/check-docs.mjs` | «Documentation checks passed (7 files, 10 external links)» — обязателен, диф трогает `src/**` |
| no-new-any | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | «Новых any нет» (9 добавленных строк в 3 файлах проверены) |
| Выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 1 зарегистрированная связь: `demo/smoke_tap_ctx.mjs` ← `DeviceTapAction`, `TAP_ACTIONS` (see ниже) |
| Целевой browser smoke | `npm run bundle:sync && node demo/smoke_tap_ctx.mjs` | все 9 проверяемых полей `true` (кроме ожидаемого `virtInfo: "no-virt"` на этом демо-фикстуре) |
| Мутационная проверка смока | вручную закомментирована строка `if (action === 'none') return;`, пересобран бандл, смок перезапущен | смок **упал** на `noneHasNoEffects: expected true, got false` — тест умеет падать; после проверки файл восстановлен, `git status` чист |
| Bundle budget | `npm run bundle:budget` | initial View 277959 B gzip / бюджет 300000 B — совпадает с числом хендоффа |
| Docs screenshots provenance | `gh run view 33299523695` | `Скриншоты документации` / `workflow_dispatch` / success — тот самый CI-прогон, из которого приняты PNG |
| CI на этом SHA | `gh api repos/.../commits/0e95c063/check-runs` | лёгкая «Проверка (CI)» зелёная; полный смок-шард — `skipped` (не предрелизный прогон) — подтверждает вводную «зелёного Validate нет» |
| Backend targeted pytest | не прогонялся мной | нет `pytest`/`homeassistant` в этом окружении (нет `.venv-backend`); полагаюсь на запись автора: `.venv\Scripts\python.exe -m pytest tests_backend/test_validation.py -q -k tap_action` → 2 passed, плюс собственное построчное чтение изменения схемы (см. AC7 ниже) |

Не прогонялись и не требовались: `npm run golden:verify` (рендер маркера не
затронут — см. AC4), `npm run invariants` (геометрия/`layout`/`open_spans`/
толщина не затронуты), полный набор `demo/smoke_*.mjs` (205 файлов — только
диффу и AC соразмерен один целевой), performance-профили (AC9 не называет
влияния и `bundle:budget` уже в пределах бюджета).

Вывод `smoke-select.mjs` полностью:

```
Изменено файлов src/**: 3 · символов проекта на изменённых строках: 4
Матрица: 205 смоков · порог «широкого» символа: больше 41 смоков

Зарегистрированная связь (1):
  demo/smoke_tap_ctx.mjs
    ← DeviceTapAction, TAP_ACTIONS
    the Device editor exposes the canonical ordered action list and the same
    scenario proves explicit none consumes pointer and keyboard activation
    without UI, feedback or HA side effects (#381)
```

Решение по строке: единственная зарегистрированная связь — тот же файл, что
уже прогнан целевым образом и провёл мутационную проверку. Других связей
(прямых или неопределённых) инструмент не назвал; расширять выборку не
требуется — диф ограничен одной поверхностью и не касается других consumers
`tap_action` (fingerprint/virtual-light/cover — не изменены, см. AC7 ниже).

**Один номер — один источник:** диф не вводит и не дублирует ни одной
пользовательской величины (нет чисел, площадей, толщин, координат) — правило
не применимо к этому изменению.

## Разбор по AC (`docs/specs/381-no-op-tap-action.md`)

- **AC1 — selector и persisted value.** `TAP_ACTIONS` расширен до
  `['info','more-info','toggle','run','none']` (`src/logic.ts:910`), рендерится
  в этом порядке (`houseplan-editor-runtime.ts:12346`). Save пишет точный
  literal только когда `tapActionTouched` (`houseplan-editor-runtime.ts:7937-7940:
  return { tap_action: d.tapAction || null }`), иначе сохраняет прежний
  lossless-контракт (`originalTapAction`) — Cancel не трогает `_markerDialog`
  вовсе. Доказано: unit (`test/logic.test.mjs` — порядок), smoke
  `fiveCurrentOptions`/`noLegacyOptions`/`defaultInfo` = true. **Выполнен.**
- **AC2 — quiet no-op.** `projectedTapAction` возвращает `'none'` только для
  точного literal (`device-toggle.ts:463-473`), не для `null`/`''`/unknown.
  `_clickDevice` (`houseplan-card.ts:5202-5209`) резолвит актуальный marker по
  id, проецирует action и делает `return` на `'none'` **до** guard/toggle/run/
  info веток — то есть до `_deviceBindingActive`, `_tapConfirm`, `_showToast`,
  `callService`/`callWS`, `_startDevicePressFeedback`. `_keyDevice` вызывает тот
  же `_clickDevice`. Доказано: unit `projectedTapAction('none', …)` = `'none'`
  для light/switch; текстовый contract-тест
  (`device-marker-polish-contract.test.mjs`) фиксирует порядок операторов и
  отсутствие вызовов между проекцией и no-op веткой; browser smoke шпионит на
  все перечисленные side-effect-точки и подтверждает 0 вызовов + `stopped`/
  `defaultPrevented` = true для click/Enter/Space. Мутация (ручная, описана
  выше) доказывает, что смок умеет падать. **Выполнен.**
- **AC3 — независимые жесты.** `_ctxDevice` и long-press таймер
  (`houseplan-card.ts` вне изменённого диапазона) не читают `tap_action`
  вовсе — диф не касается этих функций (0 строк изменено). Doказано чтением:
  ни `_ctxDevice`, ни `_holdTimer`-путь не входят в диф. Smoke `ctxMoreInfo`,
  `ctxPrevented`, `editorNative` = true. **Выполнен.**
- **AC4 — presentation parity.** `device-presentation.ts` (рендер
  face/pulse/badge/LQI/Glow/hover) ссылается на `tapAction` только для
  legacy `'cover'` (`device-presentation.ts:264,331`) — не тронут диффом и не
  получил новой ветки для `'none'`. Раз рендер структурно не читает новое
  значение, presentation не может измениться; проверено чтением, не
  исполнением (новый DOM-diff-тест не заводился — не нужен, так как нет кода,
  способного создать регресс). **Выполнен**, доказательство слабее
  заявленного в ТЗ «unit, DOM assertion» буквально, но эквивалентно по
  надёжности: change surface = 0 в файле, отвечающем за представление.
- **AC5 — defaults и legacy.** `projectedTapAction` не тронут в части
  absent/`null`/`''`/`cover`/unknown-веток — только добавлена явная проверка
  `'none'` в существующую цепочку `if`. Существующие тесты на `''`/`undefined`/
  `'future-action'`/`'cover'` (`device-toggle.test.mjs`) не менялись и
  остаются green. **Выполнен.**
- **AC6 — соседние действия.** Ветки `toggle`/`run`/`info`/`more-info`
  (`houseplan-card.ts:5217-5315`) не изменены (диф в этом файле — ровно 3
  строки, весь остальной код байт-в-байт как в `dev`). Toggle/Run-зависимые
  поля в редакторе остаются под `effectiveTapAction === 'toggle'/'run'`
  (`houseplan-editor-runtime.ts:12352-12428`), блок `controls` рендерится
  безусловно (`:12430+`) — подтверждает, что controls остаётся доступен для
  `none`, как того требует ТЗ. **Выполнен.**
- **AC7 — backend и transfer.** `MARKER_SCHEMA` добавляет `"none"` в
  `vol.Any(...)` рядом с существующими literal и `cover`
  (`validation.py:1693`). `test_every_tap_action_the_editor_offers_is_accepted`
  расширен явной проверкой `"none" in _ts_list("TAP_ACTIONS")` и продолжает
  читать список из `src/logic.ts`, а не дублировать его — кросс-языковая
  проверка исключает рассинхронизацию. `Marker.tap_action` остаётся
  `string | null` без сужения (`types.ts:130`), поэтому full/space transfer и
  duplicate-virtualization (не тронуты диффом — 0 строк) продолжают работать
  на прежнем generic-копировании поля; **не проверял** отдельным прогоном
  duplicate-virtualization fixture — диф её не касается и не может внести
  туда регресс (поле как было `string | null`, так и осталось). Backend pytest
  сам не прогонял (см. таблицу гейтов) — читаю изменение схемы: однострочное
  добавление в allow-list, риск ошибки минимален и синтаксически проверяем
  глазами. **Выполнен с одной унаследованной (не самостоятельно
  перепроверенной) зависимостью** — см. «Чего не проверял».
- **AC8 — i18n и docs.** `tap.none` добавлен в одном месте (после `tap.run`)
  во всех четырёх словарях с точными переводами из ТЗ (RU «Ничего не делать»,
  EN «Do nothing», DE «Nichts tun», FR «Ne rien faire»). `USER-GUIDE.md`/
  `.ru.md` добавляют строку таблицы и абзац про defaults; `CONFIG-
  COMPATIBILITY.md` и `ARCHITECTURE.md` описывают literal, порядок операций и
  downgrade-границу — сверено построчно с кодом (см. AC2) и совпадает.
  Единственное отступление — новый параграф про `none` лёг в раздел
  «Legacy device tap action», хотя `none` не легаси; содержательно не
  вводит в заблуждение (раздел и так объединяет весь `tap_action`-compat), не
  требует правки — снимаю как Low без цикла. **Выполнен.**
- **AC9 — гейты и бюджет.** См. таблицу выше: typecheck/test/build green,
  `no-new-any` чист, `check-docs` green, целевой backend pytest — авторская
  запись (команда+результат названы), browser smoke — green и подтверждённо
  падает на мутации, bundle budget в пределах (277959/300000 B), рост
  некритичен (диф добавляет один `<option>` и одну ветку `if`). **Выполнен.**

## Находки

Нет High. Нет Medium (ни в скоупе, ни вне). Один Low снят без цикла:

- **L1 (Low, снят без цикла).** `docs/CONFIG-COMPATIBILITY.md`: параграф про
  новый канонический `tap_action: none` находится под заголовком «Legacy
  device tap action», хотя `none` — не legacy-токен, а новый canonical.
  Не искажает контракт (раздел и так единственное естественное место для
  всей tap_action-совместимости, соседний параграф про `cover` — настоящий
  legacy), поэтому правки не требую; фиксирую записью здесь.

## Что проверено и корректно

- Порядок операций в `_clickDevice`: `stopPropagation` → drag/suppress/hold
  guard → resolve актуального marker по id → `projectedTapAction` → `none`
  return — раньше любого capability/UI/HA-пути. Подтверждено чтением и
  мутационным прогоном смока.
- `projectedTapAction` различает явный `'none'` от absence/`null`/`''`/
  unknown — новых путей ложного срабатывания (truthy/falsy) не найдено.
- Backend allow-list, i18n-паритет (4 словаря), user guides (EN/RU),
  architecture/compatibility доки, оба changelog в одном
  `User-Visible: yes`-коммите (`07d3ee6b`, трейлеры `Issue: #381` +
  `User-Visible: yes` подтверждены `git show -s --format=full`).
- Три копии бандла синхронны байт-в-байт; docs-скриншоты пересняты и приняты
  штатной джобой `Скриншоты документации` (проверено `gh run view`), а не
  локальным захватом.
- Смок `demo/smoke_tap_ctx.mjs` — не декоративный: явно проверено, что он
  падает при устранении no-op-ветки.

## Чего не проверял

- Полный `pytest tests_backend -q` (и даже целевой `-k tap_action`) не
  прогонял сам — в этом окружении нет `pytest`/пакета `homeassistant` и нет
  `.venv-backend`. Опираюсь на запись автора (команда и результат «2 passed»
  названы явно, что процесс требует) плюс собственное построчное чтение
  однострочного изменения схемы.
- Not-touched duplicate-virtualization и import/export код (0 строк в диффе)
  — не искал функцию отдельно и не гонял её fixture: диф структурно не может
  задеть её (`tap_action` как был generic `string | null`, так и остался).
- Полный набор `demo/smoke_*.mjs` (205 файлов) и `golden:verify` — не
  запускал; диф ограничен одной нерендер-поверхностью, `smoke-select.mjs`
  назвал ровно один относящийся смок, presentation-код не тронут (AC4).
- Орфография DE/FR переводов сверена только структурно (наличие ключа,
  соответствие ТЗ-строке); носителем языка текст не вычитывал.
- Ручную/браузерную проверку вне `demo/smoke_tap_ctx.mjs` (например, реальный
  HA-инстанс) не делал — по правилам процесса фазы ручного тестирования нет,
  её роль здесь исполняет код-ревью и автотесты.

## Вердикт

Все AC доказаны автотестом (с проверенной способностью падать) либо чтением
кода в точках, где сам диф не создаёт новой ветки исполнения. High: 0,
Medium: 0. Единственный Low снят без цикла с записью выше.

`Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 · Документ: docs/reviews/CODE-REVIEW-381-r1.md`
