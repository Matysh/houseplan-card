# CODE-REVIEW-962-r1

**Issue:** #962 «Полный мутационный прогон по расписанию не прошёл» (2026-10-19, `dev@3d2994905ab3`)
**Материал:** `467baec5110632bc13a228411bcf0e7fc0f9d0d3` (рабочая копия на нём, `origin/dev..HEAD` = один коммит)
**Трек:** show · этап: code · заход: r1 · блокирующих циклов израсходовано 0/2
**Класс:** B (gates/tooling) + C (docs) — инфраструктурная задача, продукт (`src/**`, `custom_components/**`) не тронут

## Скоуп

Ночной мутационный прогон 2026-10-19 вскрыл три независимых дефекта тестовой
инфраструктуры, не связанных с продуктовым регрессом:

1. **Сбежавшие мутанты (4)** — тест оставался зелёным на сломанном коде:
   `dialog-card-loses-its-heading`, `native-radar-select-overflows-ha-body-947`,
   `properties-finish-rebases-edited-field`, `settings-ray-preview-is-passive-955`.
2. **Гард, красный без мутанта (1)** — `pytest -k plan_opacity` ничего не
   выбирал (тест назывался `test_backdrop_opacity_...`), т.е. падал и на
   исправном коде.
3. **Свидетели без доказательства (4)** — `pytest.fail` внутри HA WS-колбэка
   (`BaseException`) вешал `receive_json()` до таймаута раннера
   (`support-v2-submit-skips-read-acl`, `support-v2-client-skips-closed-validation`);
   мутации `properties-image-ratio-ignored` и
   `properties-visual-history-rewinds-marker-siblings` падали на подготовке
   (`npx tsc`) ещё до запуска теста.

Правки — только в `demo/**`, `test/**`, `tests_backend/**`,
`scripts/mutation-registry.mjs`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`,
`docs/release-ledger/v1.81.0/962.json`. Продуктовый код, пороги гейтов и
классификация исходов мутаций не менялись — это прямо утверждается в AC3 и
подтверждается диффом (`git diff --stat` не показывает файлов вне
перечисленных путей).

## Как проверялось

Лёгкие гейты (`npx tsc --noEmit`, `npm test`, `npm run build` + сверка копий
бандла) на этом SHA уже подтверждены зелёным Validate
(https://github.com/Matysh/houseplan-card/actions/runs/39222133386) — не
перегонял. Прогнал адресно то, что Validate не покрывает: AC-специфичные
юниты/смоки/pytest-выборку и перечитал продуктовый код, который новые тесты
утверждают как контракт (чтением, не мутацией — исполнение любого
зарегистрированного мутанта вне ночного workflow запрещено и не
выполнялось).

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck + сборка (нужна для test-build/смоков) | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs`; `npm run build` | PASS, 0 ошибок; бандл собран |
| Юнит: fills-heading + соседи группы | `node --test test/form-shell-consumers.test.mjs test/dialog-baseline.test.mjs test/space-dialog.test.mjs test/mutation-browser-offload.test.mjs` | PASS 37/37 |
| Юнит: properties finish | `node --test test/properties-controller.test.mjs` | PASS 11/11 |
| pytest: переименованный `plan_opacity` | `python -m pytest tests_backend/test_validation.py -q -k plan_opacity` | PASS 1/1 (честно напечатан баннер `HA harness NOT collected`) |
| Смок #947 (native select) | `node demo/smoke_settings_native_select_947.mjs` (после `node scripts/bundle-sync.mjs`, иначе смок бьётся о несвежий `demo/srv/assets`) | PASS, все поля `true`, включая новое `*_native_select_has_no_layout_extent` |
| Смок #955 (ray-origin) | `node demo/smoke_settings_polish_955.mjs --fast` | PASS, все поля `true`, включая новые `ray_preview_draft`/`ray_keyboard_draft` |
| `tests_backend/test_ha_support_v2.py` (AC3) | не прогонялся — см. «Чего не проверял» | — |
| Полный `npm test` / реестр мутаций целиком | не прогонялся — покрыт Validate; повторный полный набор — предрелизный гейт, не ревью | — |

Смоки запускал осознанно: тело issue само называет их командами
воспроизведения для escaped-свидетелей (AC1), Chromium в среде есть
(`~/.cache/ms-playwright/chromium-1234`). Мутации не накладывал — только
штатный прогон на неизменённом продукте (ordinary PASS, не caught-свидетель).

## Разбор по AC

**AC1 — заголовок карточки, скрытый select, источник лучей.**

- `test/form-shell-consumers.test.mjs:20-23` добавляет точечный regex по
  `src/editors/general-settings-dialog.ts`: `formCard({ id: 'fills', title:
  st('gs.section_fills'), ...`. В файле этот текст встречается дважды —
  строка 186 (навигационная подпись вкладки) и строка 188 (заголовок самой
  карточки внутри `formCard(`). Старая проверка ловила любое вхождение
  подстроки `st('gs.section_fills')` в файле и потому не краснела, когда
  мутант `dialog-card-loses-its-heading` (registry:17458-17467) обнулял
  именно заголовок карточки (`title: st('gs.section_fills'),` → `title: '',`
  с 8-пробельным отступом — совпадает только со строкой 188, не с
  навигацией). Новый regex требует этот текст сразу после `formCard({\n id:
  'fills',`, то есть именно заголовка карточки — мутация обнулит `title` и
  перестанет совпадать. **Чем доказан:** ordinary PASS выше (37/37, группа
  `unitGuard('test/form-shell-consumers.test.mjs', 'test/dialog-baseline.test.mjs',
  'test/space-dialog.test.mjs')` — это и есть эффективный guard
  `dialog-card-loses-its-heading` после `UNIT_GUARD_OVERRIDES`,
  registry:19900-19907). **Чем краснеет:** зарегистрированный мутант
  `dialog-card-loses-its-heading` — ловлю подтверждает только ближайшая ночь
  (#709/#905), сам мутант не исполнял. Проверено чтением логики regex против
  конкретного патча плюс исполнением теста на чистом коде.

- `demo/smoke_settings_native_select_947.mjs:27` добавляет
  `*_native_select_has_no_layout_extent`: измеряет реальный
  `getBoundingClientRect()` каждого нативного `<select>` вместо единственной
  прежней проверки «тело диалога не скроллится вбок». Мутант
  `native-radar-select-overflows-ha-body-947` (registry:140-147) снимает
  CSS-скрытие (`min-width:0!important...overflow:hidden!important;contain:strict`)
  из `src/hp-settings-select.ts` — без него нативный select возвращает
  прежний видимый размер, и новая проверка `r.width<=1&&r.height<=1` станет
  `false`, а старая («тело не скроллится вбок») могла оставаться `true` на
  части вьюпортов — это и объясняет исходный escape. **Чем доказан:**
  ordinary PASS смока на чистом коде (все три вьюпорта — `true`). **Чем
  краснеет:** мутант `native-radar-select-overflows-ha-body-947`, ночная
  поимка. Проверено чтением патча + исполнением смока без мутации.

- `demo/helpers/settings-polish-955.mjs:149-162` добавляет
  `ray_preview_draft`/`ray_keyboard_draft`: читает
  `window.__card._settingsDialog.sunRayOrigin` (реальное приватное
  reactive-состояние диалога, `src/houseplan-card.ts:2130,2651`) в
  дополнение к `isChecked()` и классу `.is-selected` на превью-фигуре.
  Мутант `settings-ray-preview-is-passive-955` (registry:134-139) отключает
  `@change=${() => changed(origin)}` в `src/sun-settings-view.ts` — нативный
  radio может физически стать `checked` по умолчанному поведению браузера
  даже без сработавшего Lit-обработчика, поэтому старая проверка только
  `isChecked()` могла не отличить «модель обновилась» от «браузер сам
  перекрасил инпут». Проверка драфта читает именно модель, которую
  обновляет `changed(origin)`, и останется `false`, если обработчик не
  сработал. **Чем доказан:** ordinary PASS смока (`ray_preview_click`,
  `ray_preview_draft`, `ray_native_keyboard`, `ray_keyboard_draft` — все
  `true`). **Чем краснеет:** мутант `settings-ray-preview-is-passive-955`,
  ночная поимка. Проверено чтением (поле `_settingsDialog` существует и
  обновляется через `changed`) + исполнением смока.

**AC2 — конфликт finish, no-op до sync, типы мутаций, `plan_opacity`.**

- `test/properties-controller.test.mjs:75-93`, две новых проверки.
  Прочитал `src/editors/properties/controller.ts:124-158` целиком: `finish()`
  на входе всегда делает свежий `this.port.read(draft.identity, draft.field)`
  и сравнивает с `draft.before` независимо от того, звали ли `sync()`; если
  `draft.error?.key === 'external_change'` уже выставлен — отклоняет сразу,
  не сбрасывая ошибку даже если значение потом совпало с `before` (`sync()`
  только *ставит* ошибку при расхождении, никогда не снимает её). Оба новых
  теста воспроизводят ровно эту пару инвариантов и совпадают построчно с
  реальной реализацией. **Чем доказан:** ordinary PASS (11/11,
  `node --test test/properties-controller.test.mjs`). **Чем краснеет:**
  первый тест — зарегистрированный мутант
  `properties-finish-rebases-edited-field` (registry:19646-19652,
  `if (draft.error?.key === 'external_change' || ...) {` → `if (false) {`);
  прочитал мутацию построчно — без верхней проверки `finish()` пройдёт мимо
  раннего отказа, `current()` внутри `lane.run` увидит `before(10) ===
  read()(10)` (после второго `sync()`) и ошибочно закоммитит `30`,
  тест получил бы `true` вместо ожидаемого `false` — свидетель умеет
  различать. Ночная поимка не прогонялась (запрещено вне ночного workflow).
  Второй тест (no-op до sync) — дополнительное покрытие того же условия без
  привязки к отдельному id в реестре, проверено той же логикой чтения.

- `scripts/mutation-registry.mjs:19656,19672` — патчи
  `properties-image-ratio-ignored` и
  `properties-visual-history-rewinds-marker-siblings`. Это не новые
  свидетели, а ремонт самого определения мутации: в исходном отчёте оба
  падали на подготовке (`ошибка подготовки до заявленного теста`), то есть
  `npx tsc -p tsconfig.test.json` не проходил на патченном дереве — а значит
  тест вообще не запускался. Прочитал оба места:
  - `src/editors/properties/transforms.ts:65-67`: `ratio: number | null`,
    код внутри `if (ratio !== null)` опирается на сужение типа (`ratio > 0`
    без доп. проверки на `null`). Старый патч `ratio !== null && false` —
    компилятор, скорее всего, терял сужение внутри заведомо недостижимой по
    литералу `false` ветки и `ratio > 0` переставал типизироваться.
    Новый патч `ratio !== null && Number.isNaN(ratio)` — оба операнда
    рантайм-зависимы, сужение `ratio !== null` работает как в исходном коде,
    а `Number.isNaN(ratio)` почти всегда `false` на валидном ratio, то есть
    ветка выключается тем же эффектом, но без потери типов на этапе
    компиляции.
  - `src/device-position-history.ts:40-44`: `applyDeviceVisualFields<T
    extends {...}>`, `result = { ...marker }` имеет тип ровно `T`
    (специальный случай одиночного спреда). Старый патч `{ ...marker, size:
    1 }` создаёт литеральный тип с дополнительным полем, который TypeScript
    не обязан признать присваиваемым обобщённому `T` — вероятный источник
    ошибки компиляции. Новый патч разносит на два стейтмента: копия (тип
    остаётся `T`) и отдельное присваивание `result.size = 1` — тот же приём,
    что уже используется строкой ниже (`result[field.key] = field.value`) на
    этом самом generic.
  Оба объяснения подтверждают текст `docs/DEVELOPMENT.md` «Nightly witness
  repair (#962)». Мутацию не накладывал (запрещено вне ночного workflow) —
  **проверено чтением, не исполнением**; AC2 и `docs/DEVELOPMENT.md`
  (строки 2225, также `docs/STATUS.md`) честно пишут: «changed mutants are
  not executed or claimed caught before the next nightly run» — поимка
  этих двух идентификаторов остаётся следующей ночью, задача это не
  заявляет иначе.

- `tests_backend/test_validation.py:399` — переименование
  `test_backdrop_opacity_is_optional_finite_not_null` →
  `test_plan_opacity_is_optional_finite_not_null`. Гейт `pytest -q -k
  plan_opacity` раньше выбирал 0 тестов (красный без мутанта, т.к. поле в
  схеме называется `plan_opacity`, а не `backdrop_opacity`). **Чем
  доказан:** PASS выше (`1 passed, 202 deselected`). Тело теста не менялось
  — негативные случаи (`None, True, False, "0.5", -0.01, 1.01, nan, inf`)
  были и остаются.

**AC3 — support-v2 без `pytest.fail` внутри WS-колбэка.**

- `tests_backend/test_ha_support_v2.py:105-125` (capture-путь) и
  `:178-192` (submit/transport-путь). Прочитал продуктовый обработчик:
  `custom_components/houseplan/websocket_api.py:2982-2987` ловит
  `(vol.Invalid, ValueError, TypeError, OverflowError)` вокруг
  `async_build_preview`, достаёт `error.code`, если это `SupportPackageError`
  (`custom_components/houseplan/support_package.py:40-43`, подкласс
  `ValueError` с `.code`) — новый мок `capture()` бросает
  `SupportPackageError("support_rejected")` вместо `pytest.fail(...)`
  (`BaseException`, не попадающий ни в один `except`, вешавший
  `receive_json()` до таймаута раннера — отсюда «прерывание
  инфраструктуры» в отчёте). Тест утверждает `captures == []` на границе
  (т.е. что мок вообще не был вызван для будущих/смешанных/некорректных
  запросов) и дублирующе проверяет итоговый `support_rejected`.
  Второй случай: `websocket_api.py:3089-3091` проверяет `scope_readable`
  и возвращает `unauthorized` до вызова `async_submit_report`
  (`:3104`, await-контракт подтверждён импортом `from .support_transport
  import ... async_submit_report`); новый мок — `async def submit(...)`
  (совместим с `await`, в отличие от старого `lambda` + `pytest.fail`) и
  тест утверждает `submitted == []`. Оба `receive_json()`/вызова обёрнуты
  `asyncio.wait_for(..., timeout=10)` — конечное ожидание вместо зависания.
  Классификация исходов, бюджеты сборки (`test_global_build_cap_...`, не
  затронут) и остальной файл не менялись. **Проверено чтением, не
  исполнением** — тест я не запускал (см. «Чего не проверял»), но логика
  обоих except/проверок в `websocket_api.py` соответствует ожиданиям теста
  построчно, включая порядок проверок (ACL раньше транспорта).

## Чего не проверял и почему

- **`pytest tests_backend/test_ha_support_v2.py` (целиком, включая два
  изменённых теста AC3)** — не прогонял: в этой среде нет HA-харнесса
  (`ModuleNotFoundError: No module named 'homeassistant'`, не обнаружено
  `.venv-backend/bin/python` и не собирается `test_ha_*.py` вовсе).
  Зелёный `pytest tests_backend -k ...` без харнесса не покрыл бы эти тесты
  ни в `passed`, ни в `skipped` — честно не пытался выдать такой прогон за
  доказательство. Полагаюсь на чтение продуктового кода (раздел AC3 выше):
  оба except-пути и порядок ACL/транспорт проверены построчно против текста
  новых тестов.
- **Полный `npm test` и полный прогон реестра мутаций** — не гонял: лёгкие
  гейты уже зелёные на этом SHA (Validate run 39222133386), а полный ночной
  прогон реестра — отдельный nightly workflow, не гейт ревью (#709). Из
  диффа это и не требуется: ни один продуктовый файл не менялся, значит
  `npm run invariants`, `golden:verify`, performance-гейты к этой задаче не
  относятся (нет изменений геометрии/рендера/производительности).
  `smoke-select.mjs --base --head` не гонял отдельно — набор смоков и так
  прямо назван в самом теле issue (воспроизведение каждого escaped-
  свидетеля), я прогнал оба названных JS-смока; остальные измененные файлы
  — чистые юниты/pytest, для них смок не применим.
- **Ночную поимку всех пяти упомянутых мутантов** — не выполнял и не мог:
  исполнение зарегистрированного мутанта (временный патч продукта + прогон)
  вне ночного workflow запрещено даже ревьюеру (#905). Для каждого AC1/AC2
  id выше явно указано «ночная поимка», подтверждение — следующий nightly
  run, не этот раунд.
- Скриншоты документации — не гейт задачи (#697), не проверял.

## Находки

High: 0. Medium (в скоупе): 0. Medium вне скоупа: 0 — новых issue не заводил.

Побочных находок нет.

## Трейлеры и release ledger

- Коммит `467baec51`: `Issue: #962`, `User-Visible: no` — верно, видимое
  поведение продукта не меняется (только тестовая инфраструктура),
  changelog-правки не требуются и отсутствуют — согласовано.
- `docs/release-ledger/v1.81.0/962.json`: `category: "infra"`,
  `baseStable: "v1.81.0"`, обоснование — ремонт гардов/определений мутаций
  без изменения продукта, порогов гейтов или ночного режима запуска.
  Классификация соответствует §11.9: это не `major`/`stable-fix` (нет
  пользовательского поведения, нет бага в stable) и не `line-fix` —
  `infra` корректна, в пользовательский milestone релиза не входит.
- Число, видимое пользователю дважды: отсутствует — правки не меняют ни
  одной величины, которую видит пользователь (§8 неприменим к этому диффу).

## Маршрут вердикта (§5)

Все шесть критериев пройдены: `complexity` — низкая, точечные патчи тестов
и один regex/два ассерта/три рантайм-мока; `surfaces` — одна поверхность
(инфраструктура ночных мутационных свидетелей, один инцидент-отчёт);
`migration` — нет новых полей конфигурации/совместимости; `ux-contract` —
нет (User-Visible: no, продукт не тронут); `perf-touch` — не затронуты;
`undocumented` — ожидаемое поведение каждого исправления прослеживается
тестом/кодом и зафиксировано в `docs/DEVELOPMENT.md`/`docs/STATUS.md` этим
же коммитом. Ни один критерий не проваливается → `route: fix`.

## Вердикт

Зелёный. Все три AC доказаны: защитные случаи (AC1 заголовок/select/
ray-origin, AC2 finish-конфликт) имеют и доказывающий ordinary-PASS, и
названный зарегистрированный мутант с честной пометкой «не исполнялся» в
столбце «чем краснеет»; AC3 проверен чтением продукта построчно против
новых тестов (исполнение теста недоступно в этой среде — указано явно).
Продуктовый код не менялся, трейлеры и release ledger корректны.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/962-nightly-witnesses`, коммит `467baec51106` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `2ba4557d20fadafca3439b90ca4aed8f23591bc1`
  ```
  git log --all --format='%H %T' | grep 2ba4557d20fa
  ```
- Тело issue: `d56125884334327bf4581178ef5c993a09efb86c6bf459e1a12ffa9923ae6838`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMDEsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTg2fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxNDAsIm91dHB1dF90b2tlbnMiOjQ1MzA1LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEyODE0NSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjcxNTQ1MjIsImNvc3RVc2RFc3RpbWF0ZSI6Mi4zOTY4MTQ0MDAwMDAwMDA3fV0sInR1cm5zIjo3NiwiZHVyYXRpb25NcyI6ODE2MzE0LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi40MDIwMDA0MDAwMDAwMDEsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5241 output_tokens=45322 cache_creation_input_tokens=128145 cache_read_input_tokens=7154522 num_turns=76 -->
