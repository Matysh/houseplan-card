# CODE-REVIEW-615-r1

Issue: #615 · трек `small` · заход r1 · блокирующих циклов 0/2 (это первый заход, в котором код действительно читался — два предыдущих возврата в `S6` были доконвейерными: неудачный `workflow_sync` и конфликт ребейза на `tsconfig.test.json`, циклы ревью на них не тратились).

Материал: `git log --oneline origin/dev..HEAD` = один коммит `2bf929e3` (`fix(settings): colour tiles show alpha as a checkerboard (#615)`), `git diff origin/dev...HEAD`. Рабочая копия — на этом SHA (`git rev-parse HEAD` = `2bf929e34ed51a37b1fe0745e94863e8a2e37803`), все блобы из хендоффа (`src/hp-color-opacity.ts`, `src/editors/color-tile-ink.ts`, `src/editors/form-kit.ts`, `test/form-kit.test.mjs`, `demo/smoke_dialog_polish_605.mjs`, `scripts/mutation-registry.mjs`, `tsconfig.test.json`) сверены `git hash-object` и совпадают побайтово с якорями последнего хендоффа (2026-09-25T00:16:19Z).

## Скоуп

ТЗ (редакция r2, зелёное спек-ревью SPEC-REVIEW-615-r1/r2) закрывает регресс #605: плитки цвета General settings (10 штук: Lights/Temperature/Zigbee/Glow) снова показывают α шахматкой, плашки цвета остаются сплошными. Это правка визуального регресса редактора (администратор дома, десктоп, `docs/SCOPE.md` — обслуживает J4/J6, «плата за верность плана» и GUI-онбординг остаются читаемыми); View не затронут, персона «домочадцы/киоск» не видит изменения.

## Как проверялось

Дешёвые гейты (`typecheck`, `npm test`, `npm run build` со сверкой копий бандла, `check-docs`) подтверждены зелёным Validate на этом SHA (run 36076829827) — не перегонялись. Сам код прочитан построчно (диффы `src/hp-color-opacity.ts`, `src/editors/color-tile-ink.ts`, `src/editors/form-kit.ts`, `demo/smoke_dialog_polish_605.mjs`, `test/form-kit.test.mjs`, `scripts/mutation-registry.mjs`, changelogs, USER-GUIDE); проверены все места использования `flat-swatch`/`cover-swatch` (`general-settings-dialog.ts`, `space-form.ts`, `room-settings-dialog.ts`, `marker-dialog.ts`) — только один потребитель (плитки General) задаёт оба атрибута разом, все плашки задают только `flat-swatch`, так что `_solidSwatch = flatSwatch && !coverSwatch` не меняет поведение плашек и включает шахматку только у плиток.

Гейты, прогнанные лично в этом заходе (сверх подтверждённого Validate):

| Гейт | Результат |
|---|---|
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 5 «прямых совпадений»: `smoke_dialog_polish_605`, `smoke_bg_color`, `smoke_color_picker_consumers`, `smoke_color_picker`, `smoke_ha_controls` — совпадает с выбором автора |
| `npm run build` + `node scripts/bundle-sync.mjs` | ok, бандл пересобран для смоков |
| `node demo/smoke_dialog_polish_605.mjs` | OK, включая новые проверки `tileAlpha`, `defaultsDiffer`, `noneInkDark`, `liveAlpha`, `platesFlat`, `plateSolid` (12 комбинаций тема×ширина) |
| `node demo/smoke_bg_color.mjs`, `smoke_color_picker_consumers.mjs`, `smoke_color_picker.mjs`, `smoke_ha_controls.mjs` | OK (регресс, названы в AC3(в)) |
| `node demo/smoke_general_settings_form.mjs`, `smoke_dialog_config_parity.mjs` | OK (доп. регресс из плана автотестов) |
| `node scripts/mutation-gate.mjs --id=M-615-tile` | «поймано 1 из 1» — лично прогнан, не только со слов автора |
| `node scripts/mutation-gate.mjs --id=M-615-plate` | «поймано 1 из 1» — лично прогнан |
| `node scripts/mutation-gate.mjs --id=M-615-label` | «поймано 1 из 1» — лично прогнан |
| `node scripts/bundle-budget.mjs` | initial View 289870 B (потолок 290400±2000, запас 11196 Б) — совпадает с числом автора, предупреждение о запасе — унаследованный долг, не от этой задачи |
| `node scripts/check-docs.mjs --screenshots=warn` | passed, 1 WARN об устаревшем отпечатке скриншотов (ожидаемо на push, не на кандидате беты, §8/AGENTS.md) |

Не прогонялось (совпадает с «чего не проверял» автора, обоснованно):
- `golden:verify`/`docs:capture` — только Linux CI/WSL (#455); AC4 сам это фиксирует как предрелизный гейт, ожидаемый список кадров (`general-color-popover-desktop-en` + возможные `settings-help-zoom-*`) назван явно.
- Полная матрица смоков (266 шт.) — выборка `smoke-select.mjs` даёт только «прямые совпадения», широких/неопределённых связей нет, расширять нет оснований.
- HA backend, Windows-гейт, perf-профили — диф не трогает Python/geometry/perf-контракты, в AC не названы.
- Инварианты модели (`npm run invariants`) — геометрия/конфиг не меняются (только CSS и цвет подписи), точка данных `{c,a}` не тронута.

## AC — доказательства

| AC | Проверено | Вывод |
|---|---|---|
| AC1 (шахматка/цвет по α, живой ввод 0/100) | Прочитано (`_solidSwatch`, рендер `hp-color-opacity.ts:850-867`) + лично прогнан смок `tileAlpha`/`defaultsDiffer`/`liveAlpha` | Доказано исполнением, тест умеет падать — подтверждено мутантом M-615-tile лично |
| AC2 (подпись по видимому цвету) | Юнит `test/form-kit.test.mjs` (`#615`) прочитан, формула `colorTileInk` сверена вручную (0.299/0.587/0.114, порог 0.6, `CHECKER_MEAN=211=(184+238)/2`) | Доказано юнитом, мутант M-615-label лично краснеет |
| AC3(а) (одна поверхность, hex, клавиатура) | Прежние `oneSurface`/`opensPicker`/`upperHex`/`tileWholeSurfaceOpens`/`tileKeyboardOpens` — зелёные в моём прогоне | Разобрано чтением + исполнением (не менялось по существу, кроме снятия условия `opacity==='1'`, что и есть предмет задачи) |
| AC3(б) — защитный AC (плашки остаются сплошными) | Новые `platesFlat`/`plateSolid` прочитаны и прогнаны лично; таблица «чем краснеет» в ТЗ и хендоффе называет мутант M-615-plate — прогнан лично, «поймано 1 из 1» | Защитный AC полностью доказан: тест + названная мутация + результат прогона, столбец не пуст |
| AC4 (golden) | Кадр `general-color-popover-desktop-en` существует в `demo/golden/matrix.mjs`/`baselines-index.json` — сверено чтением. Съёмка отложена на предрелизный гейт, как и предписывает ТЗ | Проверено чтением, не исполнением — исполнение вне скоупа этого гейта (только Linux CI) |

Трейлеры коммита: `Issue: #615`, `User-Visible: yes`; `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` правлены в том же коммите — сверено `git show --stat` и текстом записи.

## Находки

**L1 (Low).** «Одно число — один источник» (§8): `CHECKER_MEAN = 211` в `src/editors/color-tile-ink.ts:22` — вручную посчитанное среднее шахматки `hp-color-opacity` (`#b8b8b8`/`#eee`, CSS в `src/hp-color-opacity.ts:113-116`). Это два независимых литерала без общей константы и без теста, который бы их связывал (`grep` по `b8b8b8`/`CHECKER_MEAN` не находит перекрёстной проверки). Если шахматку в CSS перекрасят, `colorTileInk` продолжит смешивать с прежним 211 и подпись на средних α станет слегка менее контрастной, чем видимый цвет — не крах и не потеря функциональности, только постепенно расходящаяся аппроксимация контраста. Снимаю без правки: риск узкий (шахматка — общий паттерн продукта, встроен во множестве мест, менять только эти два хардкода без ревью остальных потребителей `hp-color-opacity` маловероятно), связь задокументирована комментарием в коде, а сам приём (смешивание со средним тоном для эвристики контраста) уже сознательно принят как приближение в разделе ТЗ «Риски». Если владелец сочтёт нужным — можно вынести числа в общий модуль, отдельного issue не требуется.

Других находок нет. High: 0, Medium: 0.

## Что проверено и корректно

- Изоляция режима `cover-swatch` от остальных потребителей `hp-color-opacity` подтверждена чтением всех вызовов (`general-settings-dialog.ts`, `space-form.ts`, `room-settings-dialog.ts`, `marker-dialog.ts`) — только плитки задают `cover-swatch`, плашки — нет.
- Значения по умолчанию `light_none.a=0`, `light_on.a=0.18` (`src/logic.ts:1436,1438`) совпадают с тем, что проверяет `defaultsDiffer`.
- `dist/houseplan-card.js` и `custom_components/houseplan/frontend/houseplan-card.js` побайтово совпадают (`cmp`) после локальной пересборки — комплект бандла синхронен.
- Ни новых i18n-ключей, ни изменений модели данных/`{c,a}`/миграции — сверено чтением диффа (нет правок в `src/i18n*`, конфиг не тронут).
- Мутанты `M-615-tile`/`M-615-plate`/`M-615-label` не только заявлены, но и лично прогнаны через `mutation-gate.mjs --id=…`, каждый даёт «поймано 1 из 1» — дисциплина «тест умеет падать» выполнена по прогнанным тестам.

## Вердикт

Зелёный. AC1–AC4 доказаны (AC4 — в объёме, доступном на этом гейте), защитный AC3(б) закрыт тестом с названной мутацией и результатом прогона, регрессий по смокам нет, трейлеры и changelog на месте. Единственная находка (L1) — Low, снята без правки с запиской выше.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/615-swatch-checkerboard`, коммит `2bf929e34ed5` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0810efbc7b22e071c9911b6fa529ab677d3b65f0`
  ```
  git log --all --format='%H %T' | grep 0810efbc7b22
  ```
- Тело issue: `c97b73a26ff6fd7f6f98066a8188d815fbfac1ad9db4ed0085317efe13f01a30`
- Вердикт конвейера: `green` · High 0
