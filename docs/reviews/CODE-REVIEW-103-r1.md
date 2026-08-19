# Код-ревью issue #103 · цикл r1/4

Toggle confirmation: показывать текущее и ожидаемое состояние.

- **Issue:** https://github.com/Matysh/houseplan-card/issues/103
- **ТЗ:** `docs/specs/103-toggle-confirmation-state.md`, принято зелёным
  `docs/reviews/SPEC-REVIEW-103-r1.md`
- **Диапазон:** `origin/dev..HEAD`, 3 коммита
  (`a449edc` ТЗ, `6c7958c` ревью ТЗ, `9327737`/`9327737...cf` реализация)
- **Ревьюер:** Claude, свежая сессия без контекста реализации

## Скоуп

Диапазон изменил:

- `src/device-toggle.ts` — новый pure `formatToggleConfirmation()` и тип
  `ToggleConfirmationFormatter`; `resolveToggleIntent`/резолвер не менялись;
- `src/houseplan-card.ts` — `_tapConfirm` расширен до discriminated union
  `{kind:'toggle', lines, initialIntent, deviceId, exec}` /
  `{kind:'run', text, exec}`; новый `_toggleConfirmationLines()` и
  `_toggleConfirmationStateText()`; шаблон диалога рендерит `lines` для toggle
  и прежний `<p>` для run;
- `src/styles.ts` — `.tapconfirm-body`/`.tapconfirm-line` (перенос длинных
  строк, нет горизонтального скролла);
- `src/i18n/en.json` + `src/i18n/ru.json` — 15 новых ключей `confirm.*` в обоих
  файлах;
- `test/device-toggle.test.mjs` — юнит-тесты форматтера;
- `demo/smoke_toggle_confirmation.mjs` — новый браузерный смок;
- `docs/CHANGELOG.md` / `docs/CHANGELOG.ru.md`, `docs/USER-GUIDE(.ru).md`,
  `docs/TESTING.md`, `docs/specs/README.md` — документация и changelog в
  том же коммите, что и поведение;
- три копии бандла (`dist/`, `custom_components/.../frontend/`,
  `demo/srv/assets/`) и `docs/images/screenshots.json` (обновление
  `sourceFingerprint`/`sourceSha256`, `imageSha256` каждого сценария не
  изменился — визуальный контент прежний).

Соответствует `docs/SCOPE.md` J3 («tap-to-toggle for safe domains») и не
задевает lock invariant: secure-цели (`lock`/`alarm_control_panel`/guarded
`cover`) резолвер отфильтровывает раньше формирования intent, `toggleOperation`
для них `null`, confirmation не открывается — новая ветка кода это условие не
меняет.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | green |
| Unit | `npm test` | 880/880 green |
| Build + сверка бандлов | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js && cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | green, три копии идентичны |
| Целевой browser smoke (AC1,3,6,7,8,9) | `node demo/smoke_toggle_confirmation.mjs` | green, все 9 подпроверок true |
| Регрессия смежных confirmation-путей | `node demo/smoke_cover_tap.mjs`, `node demo/smoke_virtual_light_toggle.mjs`, `node demo/smoke_tap_run.mjs`, `node demo/smoke_ha_controls.mjs`, `node demo/smoke_controls.mjs` | все green |
| Golden | `npm run golden:verify` (свежий бандл) | 100% `passed`, 0 failed/error — новых сценариев dialog нет, стили аддитивны и не задели существующие сцены |
| i18n-паритет | `node -e "..."` сравнение ключей `en.json`/`ru.json` | равны, расхождений нет |
| Process gate | `node scripts/process-gate.mjs` | «гейт пройден, предупреждений 0» (без `--issues`, офлайн-часть) |
| Backend | не прогонялся | `custom_components/**/*.py` в диффе нет — гейт не применим |
| Performance-профили | не прогонялись | не названы в AC, изменение — только текст/CSS диалога |

**Дисциплина «тест умеет падать» — проверено для прогнанных тестов:**

- временно нейтрализовал ветку `isGroup && nextEffect==='turn-on'` в
  `formatToggleConfirmation` → `npm test` дал `not ok 159` (тест группы), после
  отката снова 880/880;
- временно подменил `closed → confirm.state_open` в
  `_toggleConfirmationLines` → `node demo/smoke_toggle_confirmation.mjs` дал
  `englishCurrentExpected: false` и `russianCurrentExpected: false`, после
  отката снова все 9 true и бандлы пересобраны/сверены заново.

## AC — разбор

| AC | Доказательство | Вывод |
|---|---|---|
| 1. current/expected lines для исполняемой цели | unit `toggle confirmation formats every next effect...`; smoke `englishCurrentExpected`/`russianCurrentExpected` | подтверждено |
| 2. expected строго по `nextEffect`, не по домену | unit-тест перебирает все `ToggleNextEffect` на одном intent с фиксированным `state`; чтение `formatToggleConfirmation` — ветвление только по `nextEffect`/`isGroup`, не по domain/semantics | подтверждено |
| 3. локализация power/cover/valve/virtual/group | unit (partial/all-off group, virtual) + smoke `englishGroupAndVirtualCopy`, RU/EN рендер | подтверждено |
| 4. partial group не обещает изменение skipped | unit `describes executable group targets and skipped targets separately` (denominator = только `targets`, skipped — отдельная строка); проверено на способность теста падать | подтверждено |
| 5. `toggle` → «решит HA» | unit-тест `nextEffect: 'toggle'` → `expected:by-ha` | подтверждено |
| 6. no-op не открывает confirmation | smoke `noOperationDoesNotOpen` (guarded cover, secure no-op) | подтверждено |
| 7. Confirm выполняет заново разрешённый intent | smoke `sameTargetUsesCurrentDirection` (cover меняет state closed→open между открытием и подтверждением, выполняется `close_cover`, а не команда снимка) | подтверждено |
| 8. смена target set отменяет actuation, старый toast | smoke `changedTargetCancels` (переброс bindingRef на другую cover-сущность → 0 service calls, `toast.tap_target_changed`) | подтверждено |
| 9. desktop/mobile, keyboard, screen-reader order | smoke `accessibleDomOrder` (`dialog.title === текст вопроса`, `data-line 0/1`, 2 кнопки) + `narrowDialogDoesNotScrollHorizontally` на 390px; keyboard focus/Escape/scrim — **проверено чтением, не исполнением**: `dismiss-on-scrim`, `@hp-close` и структура footer/кнопок в диффе не изменены | подтверждено (смок + чтение) |
| 10. run/другие confirmations не регрессируют | smoke `smoke_tap_run.mjs` green; чтение шаблона — ветка `kind==='run'` рендерит тот же `<p>{text}</p>` с тем же заголовком `btn.run`, что и раньше | подтверждено |

## Что проверено и корректно

- Инвариант lock/alarm/guarded-cover не тронут: секьюрные цели отфильтровываются
  резолвером `#94` до формирования `nextEffect`/`targets`, confirmation для них
  не строится ни при каком новом коде.
- `formatToggleConfirmation` — чистая функция, не знает про HA/DOM; вся i18n и
  HA-formatter-специфика инкапсулированы в `_toggleConfirmationStateText`/
  `_toggleConfirmationLines` в `houseplan-card.ts`, как и требовало ТЗ §5
  («`houseplan-card.ts` не выводит next state по domain самостоятельно»).
- Direction всегда берётся из `intent.nextEffect`, не из `currentState` —
  единственный источник расчёта — резолвер #94; UI не дублирует его логику.
- Denominator группы — количество фактических `targets` (`byEntity` без
  skipped), а не число сконфигурированных ссылок; skipped выводится отдельной
  строкой и не входит в «включено N из M».
- Race-контракт #94 не нарушен: `exec()` заново находит `currentDevice` →
  пересчитывает intent → сравнивает через `sameToggleOperationTargets` с
  исходным снимком; при совпадении целей выполняется **текущее**
  направление/команда (не снимок на момент открытия).
- `run`-подтверждение осталось на прежней простой форме (`text` + `<p>`),
  discriminated union не заставил его притворяться toggle — ТЗ §7 требование
  выполнено буквально.
- i18n: все 15 новых ключей присутствуют в обоих словарях; в целом по файлам
  `en.json`/`ru.json` расхождений ключей нет.
- Три копии бандла синхронны (`cmp` byte-for-byte), `docs/images/screenshots.json`
  обновил только fingerprint/sourceSha256 — `imageSha256` каждого сценария не
  изменился, то есть визуальный результат существующих сцен не задет; отдельного
  golden-сценария для диалога не требовалось (ТЗ §11 — narrow smoke покрывает).
- Оба changelog правлены в том же коммите, что и поведение (`932773773f0b`),
  трейлеры `Issue: #103`/`User-Visible: yes|no` на месте на всех трёх коммитах.

## Находки

Ни одной High/Medium-находки. Три ранее отмеченные Low из ревью ТЗ
(`SPEC-REVIEW-103-r1.md`) не имеют кодового следствия — направление в рантайме
берётся из `nextEffect`, а не из нормативной таблицы ТЗ, поэтому неточность
таблицы (`closing` в одной строке с `open`) не воспроизвелась в коде.

- **Low (снято, без правки).** `houseplan-card.ts`, ветка
  `if (actionDevice.marker?.tap_confirm) { const lines = this._toggleConfirmationLines(initial); if (!lines.length) return; ... }`
  — защитный `if (!lines.length) return` недостижим при нынешних инвариантах
  резолвера: везде, где `toggleOperation(intent)` истинен (единственное условие,
  пропущенное раньше по коду), у intent уже гарантированно есть `nextEffect` и
  `targets.length >= 1` (прослежено по всем веткам `resolveToggleIntent`/
  `resolveGroupEntities`/virtual-light intent). Формально это тихий no-op вместо
  открытия диалога, если бы условие когда-нибудь стало достижимым, но сегодня
  это мёртвый код, а не наблюдаемый дефект. Правка не требуется; снимаю с
  записью здесь, как того требует §8/§12 процесса.

## Чего не проверял

- **Backend** (`python -m pytest tests_backend`) — не прогонял: диапазон не
  затрагивает ни одного файла `custom_components/**/*.py`.
- **Performance-профили** — не прогонял: AC их не называет, изменение не
  трогает чувствительные к перфу пути (только текст диалога и аддитивный CSS).
- **Полный набор из 127 браузерных смоков** — прогнал только целевой
  (`smoke_toggle_confirmation`) плюс пять смежных по confirmation/cover/virtual-
  light/run поверхности; остальные 121 не запускал — diff не задевает
  геометрию, wall-thickness, canvas, sun/light рендер и т.д., которые они
  покрывают.
- **Ручная проверка в реальном браузере вне demo-харнесса** (реальный screen
  reader, реальная Tab-навигация) — не выполнялась; keyboard/Escape/scrim
  утверждение AC9 закрыто чтением кода (структура диалога не менялась), как и
  предусмотрено самим ТЗ («narrow browser smoke + code review»).
- **`node scripts/check-docs.mjs --external`** — не перепрогонял; автор в
  хендоффе указал green, доверяю без повторного запуска (внешний, не входит в
  обязательный набор ревью).
- **`process-gate.mjs --issues`** (сетевая проверка статуса issue через `gh`) —
  не прогонял с токеном; офлайн-часть (`process-gate.mjs` без флага) прошла
  чисто.

## Вердикт

Зелёный. Все 10 AC доказаны — юнитами/смоками, которые я прогнал и убедился,
что они умеют падать, либо явным «проверено чтением, не исполнением» там, где
так предусмотрено самим ТЗ (клавиатура/screen-reader в AC9, идентичность
`run`-ветки в AC10). High: 0, Medium: 0. Единственная Low-находка — недостижимая
защитная ветка — снята без правки, с записью выше.

`Вердикт: зелёный · цикл r1/4 · High: 0 · Medium: 0 → нет · Документ: docs/reviews/CODE-REVIEW-103-r1.md`
