# CODE-REVIEW-899-r1

## Скоуп

Issue #899 — ночной прогон мутаций на `dev`@`0dd6e8ec` красный: 5 сбежавших
мутантов, 3 свидетеля без доказательства (ошибка подготовки до теста), 2 шарда
(1/10, 7/10) упёрлись в часовой timeout, материал шардов отвергнут как
неполный. Задача инфраструктурная (класс B/C, без A/D), трек `show`.

Материал ревью — `ed4bd3d6bbd30339f39b26827ec5039f64d8623e` (два коммита над
`origin/dev`: `e239e2eb` — основная правка, `ed4bd3d6` — перенос четырёх
метаданных-кейсов в существующий ридер реестра). Диапазон:
12 файлов, 420+/35−, без строк `src/**`.

Изменения:

1. 20 детерминированных modulo-шардов вместо 10 (workflow, CLI-дефолт отчёта,
   тесты на покрытие/делители).
2. Три «невалидных» определения мутантов чинятся так, чтобы препод-компиляция
   не считала код недостижимым (TS unreachable-code) — `.at(-1)` →
   `[length - 1]`, и тавтологические/заведомо-ложные динамические условия
   вместо литералов `return ...;` / `if (false)`.
3. Пять «сбежавших» определений чинятся так, чтобы мутация действительно
   ловилась существующим guard'ом: снятие второго редундантного барьера
   (`view-edit-late-import-forgets-recheck`), добавление второй забытой
   зависимости (`snapshot-battery-read-untracked`), усиление роста сверх
   `cap+band` (`core-budget-ignores-growth`), новый юнит-тест на изоляцию
   snapshot-зависимостей (`signal-snapshot-forgets-sibling-with-battery-off`)
   и новый реальный Chromium-сценарий в LED-смоке
   (`led-pinch-calls-action`).
4. `docs/release-ledger/v1.80.1/899.json` — категория `infra`,
   обоснование относительно v1.80.1. `User-Visible: no` на обоих коммитах,
   без изменения пользовательских changelog — корректно, правка не меняет
   поведение продукта.

## Как проверялось

Дешёвые гейты подтверждены Validate на `ed4bd3d6`
(https://github.com/Matysh/houseplan-card/actions/runs/38706313840,
success) — `npx tsc --noEmit`, `npm test`, `npm run build` повторно не
гонялись.

Сам прогнал (т.к. `src/**` не тронут, `smoke-select.mjs` ничего не выбирает,
а правка напрямую меняет сам LED-смок и реестр мутаций — риск не покрыт
Validate):

- `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs &&
  node --test test/device-signal.test.mjs test/mutation-gate.test.mjs
  test/mutation-shards-899.test.mjs` → 97/97 PASS.
- `npm run build && node scripts/bundle-sync.mjs` → бандл собран, скопирован в
  `demo/srv/assets`.
- `HP_SMOKE_CHECKS=1 node demo/smoke_led_strip_glow.mjs` на точном материале
  `ed4bd3d6` (Chromium `chromium_headless_shell-1234`, 151.0.7922.34 — тот же
  пин, что называет авторский гейт) — **прогнан 5 раз подряд, 2 из 5 красные**
  (см. находку H1). После находки вернул рабочую копию в исходное состояние
  (`npm run bundle:clean`).

Не прогонял: `pytest tests_backend` (Python не тронут), `npm run invariants`
(геометрия не тронута), performance (не назван в AC), golden (рендер не
тронут, `ci:golden` не поднят). Полный мутационный прогон (ночной) — не
гоняется ни на каком треке в разработке (#709); ревью проверяет, что защита
названа мутантом в реестре, а не воспроизводит ночь.

## Находки

### H1 — новый LED-смок нестабилен: ~40% падений на собственном материале задачи

**Файл:** `demo/smoke_led_strip_glow.mjs` (добавлено в `e239e2eb`, без правок
в `ed4bd3d6` — следовательно присутствует в материале ревью как есть).

**Сценарий:** задача добавляет в `demo/smoke_led_strip_glow.mjs` три реальных
Chromium pinch/pan/cancel-сценария с двумя trusted touch-контактами
(`two-contact release`, `pinch release`, `pinch cancel`), которые **намеренно
двигают камеру** (`#899 ${scenario.label}: both trusted moves really change
the camera` — утвердительная проверка). Эта камера персистентна между
`page.reload()` (floor-scoped camera storage, см. `docs/STATUS.md` ›
«Kiosk carousel context» — «persist base zoom for only that floor/browser»).

Следующая сцена того же файла («device dialog offers "Show as LED strip"
before the tool is loaded») делает `page.reload()`, затем кликает
`[data-hp="zoom-fit"]` и ждёт `window.__hpTest.settled()`, чтобы «вернуть
публичный Fit all» перед открытием диалога `d_tv` — именно так авторский
комментарий к задаче описывает починку старого late-conversion oracle
(«обычный public FitAll перед отдельной cold-dialog сценой + явный d_tv entry
precondition восстановили старый 600ms oracle»).

**Воспроизведение (точный материал, без модификаций):**

```
npm run build && node scripts/bundle-sync.mjs
HP_SMOKE_CHECKS=1 node demo/smoke_led_strip_glow.mjs
```

Прогнано 5 раз подряд на `ed4bd3d6`: 2 из 5 — красные, с идентичной картиной:

```
FAILED (2):
  - #899 cold LED conversion starts with the intended device dialog: expected "d_tv", got "d_light1"
  - the press loads the tool and draws for the same marker: expected true, got false
```

Диагностика смока в красном прогоне печатает фактическое состояние перед
кликом по «Show as LED strip»:

```
#899 LED tool-entry observation {
  mode: 'devices', space: 'f1', zoom: 2.574239885660067, ...
  led: { tool: true, chain: { points: [], convert: 'd_light1', space: 'f1' } }
}
```

`zoom: 2.574239885660067` — не fit-all-значение, а зум, оставшийся от
предыдущего pinch-сценария: клик по `zoom-fit` и `settled()` не гарантируют,
что восстановление персистентной камеры (после `reload()`) не произойдёт
*после* клика и перекроет «Fit all» до открытия диалога `d_tv`. В результате
диалог открывается не на том маркере (`d_light1` вместо `d_tv`), и
зависимый сценарий «press loads the tool for the same marker» падает следом.

**Почему это находка именно по этой задаче, а не старый флуд:** на
`origin/dev` (до #899) этой гонки не было — там не было ни трёх реальных
pinch-сценариев, двигающих камеру, ни клика по `zoom-fit` перед этой сценой
(`git show origin/dev:demo/smoke_led_strip_glow.mjs` подтверждает: сразу
`page.reload()` → `openMarkerDialog('d_tv')`, без восстановления камеры).
Racy-путь целиком введён в `e239e2eb`.

**Почему это противоречит собственному гейту автора:** авторский комментарий
в issue утверждает прогон именно этого смока на `e239` (байт-в-байт
идентичного `ed4` в `src/demo/scripts`, что подтверждено `git diff e239`) —
«151 names/terminal OK/childstatus 0». Один зелёный прогон не доказывает
надёжность нового 600ms-oracle, когда он падает в 2 из 5 попыток в том же
окружении (тот же Chromium-пин, тот же headless-shell).

**Почему High, а не Medium:** мутант `led-pinch-calls-action` использует этот
же файл как `guard` в реестре (`scripts/mutation-registry.mjs`). Задача #899
существует именно для того, чтобы устранить недостоверные/шумные ночные
свидетельства (release-ledger: «восстанавливается достоверность ночных
mutation definitions и обычных свидетелей»); новая нестабильность в этом же
файле воспроизводит ровно ту проблему, которую задача должна закрыть — и
будет давать случайные красные ночи/смоки, не связанные ни с одной реальной
мутацией или регрессией продукта. AC по сути не выполнен: «устойчивый
guard» для `led-pinch-calls-action` остаётся ненадёжным.

**Что нужно починить:** либо дождаться фактического применения персистентной
камеры перед кликом `zoom-fit` (не полагаться на то, что `settled()` это
гарантирует), либо явно сбросить camera storage для floor `f1` перед
`reload()` (как уже делается `localStorage.clear()` чуть ниже по файлу —
только после этой сцены, а не до неё), либо целиться кликом по видимому
элементу `d_tv`, а не полагаться на оверлей камеры. Выбор способа — решение
автора; ревью лишь фиксирует дефект и его воспроизводимость.

## Что проверено и корректно

- Три «невалидных» определения (`signal-entity-reads-functional-roster-only`,
  `signal-topology-entity-choice-follows-last-alias`,
  `new-device-ack-forgets-rejection-ownership`): прочитан окружающий код
  (`src/device-signal.ts:79`, `src/zigbee-topology.ts`, `src/new-device-ack.ts:32`)
  — патчи применяются к существующим строкам байт-в-байт, новые
  условия логически тавтологичны/заведомо ложны в рантайме (`String(...)`
  делает их недоказуемыми для `tsc` статически, что и было причиной
  unreachable-code отказа препода), поведение мутации при этом не меняется.
  Структурный юнит-тест (`test/mutation-gate.test.mjs`, новые кейсы) это же
  фиксирует исполнением — 97/97 PASS подтверждён локально.
- `core-budget-ignores-growth`: прочитан `test/core-file-budget.test.mjs` —
  актуальный cap для `houseplan-card.ts` после #898 равен 14263, band 50;
  новый юнит-тест математически доказывает `growth.length (19999) >
  max(caps) + band`, то есть прежний избыточный рост (400 строк) более не
  мог бы гарантированно превысить потолок при любом текущем размере файла —
  это и был корень «сбежавшего» мутанта. Проверено чтением и исполнением.
- `view-edit-late-import-forgets-recheck`: подтверждено чтением, что защита
  дублируется в `src/houseplan-card.ts` и `src/houseplan-editor-runtime.ts:7079`
  (`deviceEditorAllowed`) — мутация прежде патчила только первую, вторая
  «спасала» тест. Новый патч снимает обе, юнит-тест проверяет, что оба файла
  патчатся.
- `snapshot-battery-read-untracked`: новый второй патч
  (`signalContext`) снимает редундантную защиту рядом с `batteryContext`;
  подтверждено структурным тестом и чтением `src/render-snapshot-capture.ts`.
- `signal-snapshot-forgets-sibling-with-battery-off`: новый тест в
  `test/device-signal.test.mjs` прямо проверяет `first.entityIds` — ровно ту
  строку (`src/render-device-snapshot.ts`, добавление
  `deviceSignalEntityIds(...)` в зависимости), которую омиттит мутация;
  исполнен, 97/97 PASS включает этот файл.
- Сдвиг 10→20 шардов: `scripts/mutation-selection.mjs` (чистая раскладка) не
  тронут; `test/mutation-shards-899.test.mjs` исполнением доказывает
  мультимножественное равенство разбиения, что каждый старый `i/10` —
  объединение `i/20` и `(i+10)/20`, и что CLI-дефолт изменился на 20 при
  сохранении явного `--shards=10` для разбора архива — 97/97 PASS включает
  этот файл.
- `docs/release-ledger/v1.80.1/899.json`: категория `infra` обоснованна —
  правка не меняет продукт/бюджеты/golden/поведение пользователя; милестон
  не затрагивается, что согласуется с §11.9 (milestone только для
  `major`/`stable-fix`).
- Трейлеры `Issue: #899` и `User-Visible: no` на обоих коммитах — корректно,
  изменений для `docs/CHANGELOG*.md` не требуется.
- "Мутанты в разработке не гоняются" (#709, track show): отсутствие
  фактического ночного прогона на новом материале — не находка, это
  ожидаемо и зафиксировано автором как открытый риск.

## Чего не проверял

- Полный ночной мутационный прогон на 20 шардах — не гоняется ни на одном
  треке при разработке; фактическую wall-time/caught-результат подтвердит
  только следующая запланированная ночь, как и указывает сам автор.
- `pytest tests_backend` — Python-код не тронут этой задачей.
- `npm run invariants` — геометрия/модель не тронуты.
- Performance-профили — не названы в материале задачи как AC.
- Golden — рендер в продуктовом смысле не тронут, `ci:golden` не поднят.
- Остальные демо-смоки (`smoke_view_edit_permissions.mjs --only=late/--only=warm`
  и т.д.), которые автор прогнал на `e239`: не перепрогонял — они не меняют
  камеру/состояние, затронутое находкой H1, и правки в соответствующих
  мутациях не затрагивают их guard-логику напрямую.

## Вердикт

Один High (H1) — блокирует. Задача решает ровно ту проблему, ради которой
создана (устранение недостоверных ночных свидетельств), но сама вносит новую
недетерминированность в файл, который служит guard'ом одного из
исправляемых мутантов, причём именно там, где автор уже один раз
диагностировал и, по его утверждению, закрыл гонку с камерой — утверждение
не подтвердилось при повторном исполнении на точном материале.

Критерии §5 (трек `show`) задача проходит: одна поверхность (ночной
mutation-gate и его guard'ы), без миграции конфига, без нового
UX-контракта, без влияния на производительность/touch, ожидаемое поведение
описано в самом отчёте/issue. `route: fix`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/899-nightly-mutation-evidence`, коммит `ed4bd3d6bbd3` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `18c0b69fdd5eb542644c84de3ffb55fd3c12d701`
  ```
  git log --all --format='%H %T' | grep 18c0b69fdd5e
  ```
- Тело issue: `37902d69ba795d38be4a799b213aebc17cef4b9474527e6df678ced1c65f576b`
- Вердикт конвейера: `yellow` · High 1 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ1OTgsIm91dHB1dF90b2tlbnMiOjIxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NzAzfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMjAsIm91dHB1dF90b2tlbnMiOjM1OTA0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE2NDgyMSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjY5Mzc4NDUsImNvc3RVc2RFc3RpbWF0ZSI6Mi40MDYxMzN9XSwidHVybnMiOjY3LCJkdXJhdGlvbk1zIjo5MTM3MDAsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoyLjQxMDgzNiwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4718 output_tokens=35925 cache_creation_input_tokens=164821 cache_read_input_tokens=6937845 num_turns=67 -->
