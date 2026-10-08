# CODE-REVIEW-825-r1

Issue: #825 · Заход: r1 · Трек: ask · Этап: code
Материал: `89e4e435123267b81dd6cd626aa3436a9e960a0c` (единственный коммит
поверх `origin/dev`, рабочая копия на нём же, `git rev-parse HEAD` сверен).

## Скоуп

Три дополненных находки общего пула View/input-сценариев (findings-2026-10-06,
после #813/#789):

- **F36 (bug/P2):** pan-ветка `_stagePointerMove` отменяла только `_holdTimer`,
  но не `KioskHoldGesture` (`_kioskHold`) — начавшаяся панорама дольше 3 с
  могла внезапно открыть диалог «Размеры на этом экране».
- **F35 (flaky witness/P2):** `smoke_led_zoom_quality.mjs` мерил LED-дедлайн от
  `__clampStarted`, выставленного *до* `waitForTimeout(45)` плюс
  незафиксированный Node↔page round-trip — потерянное временное окно, не
  доказанный продуктовый дефект.
- **F39 (tech-debt/P3):** точный `.temprange` в `devices.styles.ts` без
  потребителя в разметке, изолирован от живого `.hpf-temprange`.

ТЗ прошло зелёный SPEC-REVIEW-825-r1. Скоуп кода: `src/houseplan-card.ts`,
точный мёртвый блок `devices.styles.ts`, три названных smoke-файла и их
unit/guard-записи. Новый UX, длительности (3000/160 мс) и продуктовый
wheel/lease-алгоритм — явно не-скоуп; это проверено по диффу (см. ниже).

## Как проверялось

Чтение точного SHA построчно: `src/houseplan-card.ts`, `src/kiosk-hold.ts`,
`src/zoom-scale-activity.ts`, оба smoke-файла, новый helper
`demo/helpers/clamped-wheel-lease.mjs`, новый unit `test/clamped-wheel-lease.test.mjs`,
правки `test/kiosk-hold.test.mjs`, `scripts/mutation-registry.mjs` и весь
набор документов (ARCHITECTURE/DEVELOPMENT/STATUS/TOUCH-SUPPORT/UX-MODES/
USER-GUIDE.ru/CHANGELOG×2/testing-notes). Отдельно проверено исполнением:
`gh run view` по ссылке Validate (`37764497454`, SHA совпадает, `conclusion:
success`) и построчно вытащены логи трёх шардов браузерных смоков —
`smoke_kiosk_scale_no_editor`, `smoke_led_zoom_quality`, `smoke_kiosk_pan_lock`
все `ok`, плюс `Golden-кадры против принятых эталонов: success`,
`Перф-смок: success`, `Фронтенд: типы, юниты, мутанты, синхрон бандла: success`.
`Мутанты по диффу` — `skipped` (ожидаемо, мутанты в разработке не гоняются
ни на каком треке, #709). `HACS/Hassfest/pytest/Геометрия` — `skipped`
(в диффе нет Python/геометрии — корректная классификация).

## Находки

Нет. 0 High, 0 Medium.

## Что проверено и корректно

**F36 — AC1/AC2.** `src/houseplan-card.ts:6945`:
```
if (this._kioskHold.pointerId === ev.pointerId) this._kioskHold.cancel();
```
стоит сразу после присвоения `this._panLock = owner === 'swipe' ? 'swipe' : 'pan'`
внутри `if (this._panLock === null && …STAGE_TAP_DISTANCE_PX)` — ровно
существующий порог распознавания, без новой константы. Срабатывает один раз
за press (переход `_panLock` из `null` в не-`null` необратим на этом press),
поэтому возврат к исходной точке не переармляет удержание — `arm()` вызывается
только в `_stagePointerDown` (строка 6795), повторно для того же press не
вызывается. Проверка `pointerId` делает отмену владельческой: второй палец
уже отменяет hold раньше, в ветке `pointers.size !== 0` при pointerdown
(строка 6799), так что false-cancel чужого hold невозможен. Применяется и к
pan, и к swipe — соответствует формулировке changelog «панорама или свайп
этажа».

Доказано исполнением, не только чтением: `smoke_kiosk_scale_no_editor.mjs`
добавляет блок (строки ~248–293) с настоящими trusted mouse- и CDP
`Input.dispatchTouchEvent`-touch-press: движение 25/20 px (> 8 px
`STAGE_TAP_DISTANCE_PX`) → ожидание `HOLD_MS` → `…NeverOpensHold`; затем
возврат в исходную точку на том же press → снова ожидание → `…
ReturnToOriginDoesNotRearmHold`; плюс `…ActuallyMovesPlan` (реальный план
двигается, а не просто подавлен тест), `slowPanUsesTrustedMouseAndTouch`,
`slowPanHasNoWritesServicesOrEditor` (0 service-вызовов, 0 editor-chunk
запросов). Флаг `--pan-red-witness` подтверждён автором как красневший на
`cea75aa2` (до фикса) по двум named assertions, не по setup-таймауту — это
то самое «исходная beta.8 должна краснеть по открывшемуся диалогу» из
контракта п.1 ТЗ. В CI (шард 1/3) `smoke_kiosk_scale_no_editor` — `ok`.

Регистр мутанта `kiosk-hold-survives-recognized-pan`
(`scripts/mutation-registry.mjs`) бьёт именно эту строку `find`/`replace`
(сверено посимвольно с актуальным текстом файла) и привязан к тому же
smoke-гарду — третий столбец защитного AC заполнен, не пуст.

Юнит `test/kiosk-hold.test.mjs` получил два новых поименованных кейса
(`recognized pan`/`recognized swipe`) в существующем параметризованном тесте
`#813 AC2` — это регрессионная маркировка сценария на уровне контракта
`KioskHoldGesture.cancel()`, а не замена интеграционного доказательства;
реальная проверка «карточка действительно это делает» лежит в smoke- и
мутационном гарде выше, как и требует §2.7.

**F35 — AC3/AC4.** Старая схема (`__clampStarted` выставлен *до*
`waitForTimeout(45)`, затем голый `wheel()` и `setTimeout(…175−prev…)`) ровно
воспроизводила описанный в ТЗ дефект измерения. Новый
`demo/helpers/clamped-wheel-lease.mjs`:
- ставит `page.clock.install()` + `pauseAt`, владеет временем только своего
  `page`/`context`;
- оборачивает `window.setTimeout`, фиксируя исключительно 160 мс таймер
  (сверено: `ZOOM_SCALE_QUIET_MS = 160` в `src/zoom-scale-activity.ts:2`) —
  значит witness не угадывает тайминг, а читает настоящий таймер владельца
  (`card._zoomScaleActivity.timer`);
- вставляет реальные 240 мс Node↔page задержки (`setTimeout(resolve, 240)`)
  между командами внутри фазы, при этом браузерное время остаётся под
  управлением `page.clock.runFor(...)` относительно зафиксированного
  `before.lease.deadline` — то есть фаза детерминирована независимо от
  фактической длительности round-trip, как требует п.5 контракта;
- `finally` восстанавливает `window.setTimeout`, снимает слушатель и
  `page.clock.resume()` — teardown не течёт в другие smoke.

`clampedWheelVerdict` раздельно проверяет: ранняя отмена (`during.coarse`),
продление дедлайна (`!deadline.coarse`), неизменность `scale`/`cache` во всех
трёх фазах, отсутствие повторного входа в `coarse` в idle (`!idle.coarse`).
`report.delivery` отдельно доказывает, что именно *доверенное* wheel-событие
было доставлено внутри измеренного окна (число событий `+1` на каждый вызов
`wheel()`, `trusted === true`, `at < deadline`) — закрывает требование «private
setter/прямой вызов метода вместо события не подходит».

`test/clamped-wheel-lease.test.mjs` — юнит на чистую функцию
`clampedWheelVerdict`: проверено, что тест **умеет падать** — четыре
независимых мутации входных сэмплов (`during.coarse=false`,
`deadline.coarse=true`, `idle.coarse=true`, `scale`/`cache` изменены) каждая
даёт `false` ровно своему ключу, не маскируя друг друга.

Второй зарегистрированный мутант `led-zoom-noop-renews-lease` патчит
`_startCameraTransition` (`src/houseplan-card.ts:1175`, комментарий сверен
посимвольно) — вставляет `this._zoomScaleActivity.change({w:2,h:2},{w:1,h:1})`
на no-op camera ветке. Проверено по `src/zoom-scale-activity.ts:34-36`:
`change()` трактует `{2,2}→{1,1}` как настоящее изменение (не
`sameExtent`), значит мутант действительно продлевает/перезапускает lease —
корректно ловится смоком `smoke_led_zoom_quality`, третий столбец AC3/AC4
не пуст.

В CI (шард 2/3) `smoke_led_zoom_quality` — `ok`.

**F39 — AC5.** Удалённый блок (`devices.styles.ts:535-540`, точный селектор
`.temprange`, не `.hpf-temprange`) проверен по всей разметке и smoke-реестру:
`grep` по `src/`, `demo/`, `test/` не находит ни одного потребителя класса
`.temprange` вне `.hpf-temprange` (используется в
`src/editors/room-settings-dialog.ts:223`, `demo/golden/harness.mjs`,
`demo/smoke_room_temperature_thresholds.mjs`,
`demo/smoke_room_settings_form.mjs`) — живой hook `hpf-temprange` не задет,
`docs/STYLING-HOOKS.md` `.temprange` никогда не документировал. Отдельный
test-хелпер `test/helpers/editor-style-ownership.mjs:194` уже *до* этой задачи
фиксировал словами «`.temprange` нет ни в одной разметке» — значит удаление
не противоречит ни одному существующему контракту владения стилями.
`Golden-кадры против принятых эталонов` в Validate — `success`, новых PNG
дифф не вносит (`git diff --stat` не показывает `demo/golden/**`) —
соответствует «эталоны не обновляются для визуально нейтральной уборки».

**AC6 (регрессия).** `smoke_kiosk_pan_lock` (не изменён в этом диффе,
используется как контроль) — `ok` в шарде 3/3; полный прогон
`smoke_led_zoom_quality` включает unchanged-часть (wheel/pinch/stationary/
pure pan/fit/room/space/projection/mode/disconnect/reduced motion/static
full48) — тот же `ok`, то есть новые правки не сломали существующий LIGHT.md
контракт.

**Трейлеры и changelog.** Единственный коммит несёт `Issue: #825` и
`User-Visible: yes`; `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` правлены
в том же коммите, формулировки согласованы друг с другом и с
`docs/USER-GUIDE.ru.md` («Неподвижное удержание пустого места 3 секунды» —
термин согласован с UX-MODES.md и ARCHITECTURE.md). Других правок видимого
поведения в диффе нет.

**Побочная находка #831 (вне скоупа).** Автор в хендоффе отдельно
зафиксировал несвязанный дефект (sub-threshold jitter блокирует Close-клик
после открытия диалога, PROCESS §3.9) с красным symptom oracle и завёл его
отдельным issue **#831** (labels: `bug`, `P2`, `tests`, `S1-new`,
`track:ask`), не реализуя здесь. Это ровно процедура для Medium вне скоупа —
действие уже выполнено автором корректно, повторно заводить не нужно.

## Один источник на число (§8)

Диапазон не вводит новых пользовательских чисел: `KIOSK_HOLD_MS = 3000`
(`src/kiosk-hold.ts:13`) и `ZOOM_SCALE_QUIET_MS = 160`
(`src/zoom-scale-activity.ts:2`) не менялись и остаются каждое с одним
источником в коде; changelog/UX-MODES/USER-GUIDE упоминают их словами
(«3 секунды», «160 ms») без переопределения значения. Таблица в
`docs/testing-notes/mutation-browser-guards.md` (54→56, 286→288) считается
скриптом реестра и сверяется тестом (`test/testing-doc.test.mjs`,
`scripts/mutation-registry-check.mjs`) — единственный источник правды —
`MUTANT_DEFINITIONS`, документ его только отражает; зелёный `npm test` в
Validate подтверждает согласованность.

## Чего не проверял

- Не гонял `npx tsc --noEmit` / `npm test` / `npm run build` /
  `bundle-policy --verify` вручную — зелёный Validate на этом же SHA
  (https://github.com/Matysh/houseplan-card/actions/runs/37764497454,
  `conclusion: success`) уже их покрывает (§8, #343), и дополнительно по
  логам этого прогона подтверждён зелёным «Фронтенд: типы, юниты, мутанты,
  синхрон бандла».
- Не гонял `golden:verify` и полный browser-смок-сьют вручную — та же ссылка
  Validate: «Golden-кадры против принятых эталонов» и все три смок-шарда —
  `success`/`ok`, включая три именно названных в ТЗ smoke-файла.
- Не гонял `node scripts/smoke-select.mjs` отдельно — AC и gate:small уже
  явно называют ровно эти три smoke, дополнительный отбор не меняет вывод.
- Не гонял mutation suite (ни локально, ни полным реестром) — по процессу
  мутанты в разработке не гоняются ни на каком треке (#709); проверено
  вместо этого, что оба новых мутанта текстуально бьют реальные строки кода
  и логически способны ловить именно описанный мутантом дефект (см. разбор
  выше) — поимку подтвердит ночной прогон.
- Не воспроизводил живым браузером вручную (ни локально, ни в этой сессии) —
  полагался на исполненные CI-смоки на этом SHA и построчный разбор кода;
  отдельного расхождения между логами CI и прочитанным кодом не нашёл.
- Не проверял `pytest tests_backend`/HACS/Hassfest/«Геометрия» — в диффе
  нет Python/геометрических правок, что подтверждено `skipped` этих джобов в
  самом Validate-прогоне (корректная классификация, не пропуск).
- Не проверял «пять повторов WSL/Chromium», заявленные автором локально для
  AC3 вне CI, — не единственный источник доказательства по ТЗ («отсутствие
  флака само по себе не единственный oracle»), и по существу AC3 доказан
  детерминированным browser-time witness'ом и прошедшим в CI единичным
  прогоном, разобранным выше построчно.

## Вердикт

Зелёный. Код делает ровно заявленное в ТЗ #825 и только его: F36 исправлена
на точке признания жеста с владельческой проверкой pointerId, F35 заменена
детерминированным witness'ом вместо гонки Node↔page, F39 — доказанно мёртвый
CSS без изменения живого hook'а. Контракт AC1–AC6 подтверждён исполнением (CI
на этом самом SHA) и построчным чтением для защитных свойств; оба новых
защитных AC имеют зарегистрированный мутант с непустым столбцом «чем
краснеет». Трейлеры и оба changelog на месте. Побочная находка вне скоупа
уже корректно заведена автором отдельным issue (#831), повторного действия
не требует.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/825-kiosk-pan-led-witness`, коммит `89e4e4351232` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `5a47107c6801944b86a0982c926cc4b235fd6199`
  ```
  git log --all --format='%H %T' | grep 5a47107c6801
  ```
- Тело issue: `6a7f01e8fd471ed8b93d9145ecb5aa08a9eb9ea3c66046fe10d24fa917e7e45d`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4088 output_tokens=27700 cache_creation_input_tokens=99072 cache_read_input_tokens=3719080 num_turns=54 -->
