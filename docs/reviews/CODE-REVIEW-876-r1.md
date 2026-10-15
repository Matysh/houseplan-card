# CODE-REVIEW-876-r1

Issue: #876 · этап: code · трек: ask · заход r1 · блокирующих циклов использовано 0/4
Материал: `d1b4700e05e8daffd14aaf4ed930d2f845382aa3` (рабочая копия на нём; `git rev-parse HEAD` сверен)
Диапазон: `git diff origin/dev...HEAD`, 5 коммитов (`8dda1740`…`d1b4700e`), 66 файлов, +1310/-83

## Скоуп

Задача закрывает J7 (здоровье Zigbee-сети) по `docs/SCOPE.md`: общий
GUI-переключатель показа системного LQI в Общих настройках (под зарядом
устройств, вкл по умолчанию), трёхпозиционный выбор «Как в общих/Вкл/Выкл» в
форме пространства, единый resolver для всех потребителей, обратная
совместимость со старым `space.show_lqi` и YAML `show_signal`, удаление
дублирующего переключателя из визуальных редакторов карточек, backend-схема,
перенос/бэкап, i18n и документация. ТЗ — редакция 14.10.2026, ответы
владельца 1А/2А/3А приняты без новых вопросов.

## Как проверялось

Правило #343/#857: дешёвый гейт на этом SHA подтверждён ссылкой на
Validate (run 38686154845) — проверено через `gh run view`, фактический
список job, не только слова из промпта:

| Job | Результат |
|---|---|
| Фронтенд: типы, юниты, мутанты, синхрон бандла (`tsc`, `npm test`, `npm run build`+bundle sync) | success |
| Геометрия: TS/Python parity | success |
| Бэкенд: pytest в Home Assistant (`test_ha_*.py` реально собран, не просто «pure») | success |
| Golden-кадры против принятых эталонов | success |
| Смоки в браузере, шарды 1/2/3 из 3 — **это весь `demo/smoke_*.mjs`**, включая все 5 новых `smoke_signal_visibility*.mjs` | success (все 3 шарда) |
| Перф-смок | success |
| Мутанты по диффу | skipped (ожидаемо: #709, мутанты в разработке не гоняются ни на каком треке) |

Поскольку сам Validate на этом SHA уже прогнал полный смок-набор (не только
выборку), а не усечённый «дешёвый» набор, повторно гонять
`npx tsc --noEmit` / `npm test` / `npm run build` / конкретные смоки / `golden:verify`
/ `pytest tests_backend` не стал — они уже зелёные на материале ревью, и
причина достаточна (широкая heavy-классификация диффа, а не только
декларация в промпте).

Дополнительно самостоятельно прогнал:
`node scripts/smoke-select.mjs --base origin/dev --head HEAD` — 52 прямых
совпадения (объяснимо: diff трогает общие `_config`/`_settings`/
`_editorRuntime`/`_openSettingsDialog`/`_settingsDialog`) + 6
зарегистрированных связей (`smoke_signal_visibility_device_policy.mjs`,
`smoke_signal_visibility_ui.mjs`, `smoke_signal_visibility_work.mjs`,
`smoke_space_card_identity.mjs`, `smoke_space_card.mjs`,
`smoke_value_face_source.mjs`). Все перечисленные уже входят в прогнанный
полный смок-набор Validate — отдельный повторный прогон не потребовался.

Чтения кода: `src/signal-visibility.ts` (новый pure resolver, построчно),
все затронутые потребители (`houseplan-card.ts` ×3 точки вызова,
`live-hover.ts`, `space-render.ts`, `render-snapshot-capture.ts`,
`marker-dialog.ts`, `space-card.ts`, `space-dialog.ts`, `space-editor.ts`,
`editor.ts`), `houseplan-editor-runtime.ts`/`houseplan-onboarding-runtime.ts`
(открытие/сохранение формы пространства и общих настроек, CAS/lifecycle
guard), backend (`validation.py`, `import_export.py`, `support_package.py`),
бэкенд- и фронтенд-тесты (`test/signal-visibility.test.mjs`,
`test/logic.test.mjs`, `test/space-copy.test.mjs`,
`tests_backend/test_settings_signal_visibility.py`,
`tests_backend/test_ha_import_export.py`), все 5 новых demo-смоков целиком,
`scripts/mutation-registry.mjs` (6 новых мутантов), `docs/CONFIG-COMPATIBILITY.md`,
`docs/DEVICE-PRESENTATION.md`, `docs/UX-MODES.md`, `docs/ARCHITECTURE.md`,
`docs/USER-GUIDE(.ru).md`, `docs/CHANGELOG(.ru).md`,
`docs/release-ledger/v1.80.1/876.json`, `docs/STATUS.md`. Целенаправленно
прогнал `grep` по `show_signal|showSignal` во всём `src/` проверить, что ни
один потребитель не остался на старой цепочке `?? … ?? true` — не остался
(единственные оставшиеся места — типы полей и `!== false` на границе
`space-card.ts`, где коллапс в boolean эквивалентен прямой проверке
`card === false` внутри `effectiveShowLqi`, проверено построчно).

## Риск по изменённым участкам (#707), трек ask

- **migration** (`import_export.py:97`, `validation.py:1423,2332`,
  `types.ts:326`) — покрыт AC4 (strict boolean/enum round-trip, invalid-write
  reject, field-registry/plan-only whitelist, support-projection) и AC7
  (единый resolver). Доказано исполнением: `test_settings_signal_visibility.py`
  и `test_ha_import_export.py::test_issue_876_...` — оба в прогнанном зелёном
  HA-pytest job.
- **ux** (новые ключи `gs.show_lqi`, `gs.show_lqi_hint`, `space.lqi_inherit`,
  `space.lqi_on`, `space.lqi_off` в 4 локалях + удаление `editor.show_signal`
  из 4 словарей) — покрыт AC6 (`smoke_signal_visibility_ui.mjs`: RU/EN ×
  360/1280 × light/dark, клавиатура, 44px) и i18n dead-key/parity тестом
  (`test/i18n-dead-keys.test.mjs`, часть зелёного `npm test`).

Оба класса закрыты AC ТЗ — `route: fix`.

## AC → доказательство → чем краснеет (защитные AC)

| AC | Доказано | Чем краснеет |
|---|---|---|
| AC1 (resolver matrix, default-on, invalid-legacy) | `test/signal-visibility.test.mjs` (полная матрица global×card×mode плюс legacy), unit-тест в native demo (`smoke_general_settings.mjs`: `legacyTrueDoesNotOverrideCardDefault`, `spaceLqiOverridesCardDefault`) | мутанты `signal-visibility-card-default-masks-global`, `signal-visibility-legacy-true-becomes-explicit` (guard: `node --test test/signal-visibility.test.mjs`) |
| AC2 (форма: 3 режима, round-trip, no-accidental-override, CAS/lifecycle, readonly/kiosk) | `demo/smoke_signal_visibility.mjs` (полный сценарий: open/save/reopen/reload, unrelated-field save, reject/CAS), `demo/smoke_signal_visibility_lifecycle.mjs` (устаревшая lazy-completion, закрытая/переоткрытая форма) | мутанты `signal-visibility-inherit-retains-old-false` (unit), `signal-visibility-old-save-closes-new-dialog` (guard: `node demo/smoke_signal_visibility_lifecycle.mjs`) |
| AC3 (два клиента, все поверхности согласованы, #867 композиция) | `demo/smoke_signal_visibility.mjs` (peer/static/kiosk/preview через `config_updated`), `demo/smoke_signal_visibility_device_policy.mjs`, unit `test/signal-visibility.test.mjs` (`#876/#867`) | прямые числовые/видимые контрасты до/после toggle в самих смоках (не regex по исходнику) |
| AC4 (backend strict write/reject, перенос/бэкап/support) | `tests_backend/test_settings_signal_visibility.py`, `tests_backend/test_ha_import_export.py::test_issue_876_...`, `test/space-copy.test.mjs`, `test/config-schema-parity.test.mjs` | мутанты `signal-visibility-global-write-coerced`, `signal-visibility-plan-only-drops-mode` (guard: pytest) |
| AC5 (визуальные редакторы без тумблера, YAML-поведение) | `demo/smoke_signal_visibility.mjs` (`*NoSelector`, `*PreservesYaml` для обоих редакторов) | прямое сравнение `form.schema`/`emitted config` в смоке |
| AC6 (RU/EN×360/1280×light/dark, клавиатура, 44px, readonly/kiosk) | `demo/smoke_signal_visibility_ui.mjs`, `test/form-kit.test.mjs` (заморожен CSS-лист с точечным правилом `.hpf-signal-visibility .hpf-radios label{min-height/min-width:44px}`) | заморозка CSS-листа красит любое незаявленное изменение правила |
| AC7 (один resolver, независимость `label_lqi`, O(1) без HA-fetch) | `test/signal-visibility.test.mjs` (`AC7` тесты: независимость `label_lqi`, 50×200×100 без доступа к `entities`/`callWS`, точный счётчик), `demo/smoke_signal_visibility_work.mjs` (наблюдаемые счётчики работы) | getter-ловушки `forbidden()` на `entities`/`callWS` в unit-тесте; точный ожидаемый счётчик `17*200*100` |

Третий столбец у всех защитных AC заполнен названными мутантами/негативными
пробами — пустых строк нет.

## Что проверено и корректно

- Приоритет вычисляется ровно как в ТЗ: явный режим пространства (включая
  legacy `false`) → точное YAML `false` → общая настройка → default-on.
  Проверено построчно в `signal-visibility.ts` и по всем 8 точкам вызова
  `effectiveShowLqi` (`houseplan-card.ts` ×3, `live-hover.ts`,
  `space-render.ts`, `marker-dialog.ts`) плюс `space-card.ts` через
  `renderSpaceStatic`.
- `writeSpaceSignalVisibility`/`signalVisibilityModeOf` корректно реализуют
  «старое true наследует, старое false остаётся own-off, inherit удаляет оба
  ключа» — подтверждено unit- и native-тестами с переоткрытием формы.
- Backend: `settings.show_lqi` — строгий boolean в `CONFIG_SCHEMA`,
  `space.settings.show_lqi_mode` — строгий enum в `SPACE_DISPLAY_SCHEMA`;
  оба добавлены в `_SPACE_DISPLAY_FIELDS` (plan-only whitelist) и
  `support_package.py` с валидацией (без радио-данных).
- Трейлеры: все 5 коммитов несут `Issue: #876`; единственный
  `User-Visible: yes` (`8dda1740`) содержит оба changelog в том же коммите;
  golden-коммит (`d5ff9e84`) несёт `Release:` + `Baseline-Reviewed-Local:
  sha256:…` по правилу §10.1.
- `docs/release-ledger/v1.80.1/876.json`: `category: major` относительно
  текущего latest stable (`v1.80.1`, сверено с `docs/STATUS.md`), обоснование
  — новая установочная настройка, а не правка интер-бета; суждение
  авторское и адекватное, не вывод из `User-Visible`.
- i18n: `editor.show_signal` синхронно удалён из всех 4 словарей (en/ru/fr/de);
  новые ключи добавлены во все 4 `settings/*.json`; dead-key/parity тест
  зелёный (часть `npm test`).
- Golden: изменились ровно 2 PNG (`card-editor-invalid-default-floor-*`),
  что соответствует AC5 (убраны 2 editor-row с `show_signal`); остальные 203
  эталона byte-identical — подтверждено `baselines-index.json` и описанием
  коммита; Validate golden job зелёный на этом SHA.
- `_openSettingsDialog`/`_saveSettingsDialog` получили guard
  `!_canEdit || _kiosk` и epoch/`dialogSession`-проверку против устаревшего
  lazy-довершения — переиспользует существующий примитив `dialogSession`
  (использовался для marker-диалога), не вводит новый write-path; покрыто
  `smoke_signal_visibility_lifecycle.mjs` и мутантом
  `signal-visibility-old-save-closes-new-dialog`.
- Документация (`CONFIG-COMPATIBILITY.md`, `DEVICE-PRESENTATION.md`,
  `UX-MODES.md`, `ARCHITECTURE.md`, `USER-GUIDE(.ru).md`) согласована с кодом
  построчно; формулировки `USER-GUIDE.ru.md` использованы как терминология
  интерфейса (ревью спец-словаря не изобретает новых терминов).
- Одно число — один источник (§8): глобальное значение `show_lqi` читается
  в ровно одном месте каждым потребителем через `effectiveShowLqi`/
  `globalSignalVisibleOf`; нет второго независимо читаемого флага.

## Находки

Нет High. Нет Medium — ни в скоупе, ни вне скоупа. Low не заводился:
единственное отступление, которое я отметил по пути (временный
testing-notes-файл `docs/testing-notes/876-signal-visibility.md`, добавленный
в `8dda1740` и сам удалённый автором в `11652e6b` как «запрещённый
по-issue чеклист»), не пережило до HEAD и не требует записи.

## Чего не проверял

- Не гонял `npx tsc --noEmit`, `npm test`, `npm run build`+`bundle-policy
  --verify`, `golden:verify`, `pytest tests_backend`, конкретные
  `demo/smoke_*.mjs` вручную — все они уже зелёные в полном Validate на этом
  точном SHA (run 38686154845, все 3 смок-шарда и golden/HA-pytest job
  зелёные), включая все 5 новых `smoke_signal_visibility*.mjs`.
- Не гонял мутанты (включая 6 новых) — по правилу #709 они не гоняются в
  разработке ни на каком треке; ночной прогон реестра — отдельная
  обязанность, не этого ревью.
- Не проверял де/фр переводы исполнением UI (нет такого AC; только RU/EN
  названы в AC6) — ограничился чтением JSON и dead-key/parity тестом.
- Не открывал приложение вручную в браузере (ревьюер код-ревью работает по
  материалу CI, без собственной рабочей копии демо-стенда); полагаюсь на
  исполненные native-смоки, которые реально монтируют `houseplan-card`/
  `houseplan-space-card` и кликают по настоящим контролам.
- Инварианты геометрии (`npm run invariants`) не прогонял — диффа геометрии
  или ссылок на неё в задаче нет (LQI-видимость не меняет позиционирование).
- Performance-гейт за пределами названного в AC7 счётчика работы не
  запускал отдельно — `smoke_signal_visibility_work.mjs` уже в зелёном
  смок-шарде; отдельного `performance/` сценария AC не называет.

## Вердикт

Зелёный. Все 7 AC доказаны исполнением (реальные native-смоки через
production-бандл) либо unit/pytest с названной мутацией на каждый защитный
путь; риск по migration/ux классам закрыт AC4/AC6; трейлеры, changelog и
release-ledger корректны; гейты на материале зелёные.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/876-global-signal`, коммит `d1b4700e05e8` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `c26e75cb14837753076edb5e0986d0d86d081254`
  ```
  git log --all --format='%H %T' | grep c26e75cb1483
  ```
- Тело issue: `3d96630687985be3d66bf526839fc91917f2af1b17d8e2379958e1655ca9944d`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ1NjQsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NjU5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMjAsIm91dHB1dF90b2tlbnMiOjM3MzA2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE2NDg5MiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjczMTI2NzUsImNvc3RVc2RFc3RpbWF0ZSI6Mi40OTU0MDMwMDAwMDAwMDF9XSwidHVybnMiOjcwLCJkdXJhdGlvbk1zIjo0ODUwODksImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoyLjUwMDA2MjAwMDAwMDAwMSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4684 output_tokens=37325 cache_creation_input_tokens=164892 cache_read_input_tokens=7312675 num_turns=70 -->
