# CODE-REVIEW-847-r1

Материал: `a80e780b8d530daec23e3f8410d34b256e949d13` (`issue/847-view-input-lifecycle`, 4 коммита над `origin/dev`).
Трек: `ask`, P2. Заход: r1, блокирующих циклов использовано 0/4.
Validate на этом SHA: success (https://github.com/Matysh/houseplan-card/actions/runs/38654011737) — typecheck/test/build/bundle-policy приняты без повторного прогона.

## Скоуп

ТЗ (редакция 2 + «Дельта r2», принято SPEC-REVIEW-847-r2, зелёный) закрывает J1/J3: View-удержание маркера (600 мс) и click/contextmenu-хвост больше не переживают отмену, отпускание рядом с маркером, потерю фокуса окна, уход страницы в фон/`pagehide`, смену пространства и отключение; таймер растворения солнечных лучей не срабатывает на отключённом экземпляре. Редакторы не затронуты (удержание маркера есть только в View) — `Touch editor: not exposed` подтверждается (новых путей в `_editorRuntime`/Devices-editor дифф не создаёт). AC1–AC9 размечены защитными критериями «чем краснеет» в теле issue.

Изменённые файлы: `src/view-hold.ts` (новый), `src/touch-gesture-click-guard.ts`, `src/visual-continuity.ts`, тонкая проводка в `src/houseplan-card.ts`; тесты `test/view-hold.test.mjs` (новый), `test/touch-gesture-click-guard.test.mjs`, `test/visual-continuity.test.mjs`, фикстурные правки `test/device-marker-polish-contract.test.mjs`, `demo/smoke_editor_gestures.mjs`; новый смок `demo/smoke_view_hold_lifecycle.mjs`; `scripts/mutation-registry.mjs` (+11 деклараций), `scripts/smoke-links.mjs`; каноны `docs/TOUCH-SUPPORT.md`, `docs/USER-GUIDE{,.ru}.md` §11, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`, `docs/testing-notes/mutation-browser-guards.md`; оба `docs/CHANGELOG{,.ru}.md`; `docs/release-ledger/v1.80.1/847.json`.

## Риск по изменённым участкам (#707)

Трек `ask` — каждый класс риска из подборки покрыт AC ТЗ:
- `PointerEvent` типизация нового `_onViewPointerTerminal` (houseplan-card.ts:2397) и три новых window-capture-листенера (`pointerup`/`pointercancel`/`lostpointercapture`, :2706–2708, снятие :2797–2799) — реализуют AC1 («где бы их ни получила карточка») и AC9/F84 (второй контакт после lost capture первого ещё держащегося пальца). Прочитан код и unit/смок-доказательство — подтверждено.
- Остальные токены (45 ещё) — проводка `_viewHold.cancel()`/`_touchClickGuard.interrupt()/abandon()` в существующих pointer-обработчиках (`_stagePointerUp`, `_pointerUp`, `_pointerCancel`, `_guardTouchGesture`, `_commitSpace`, `disconnectedCallback`) — все перечислены в разделе ТЗ «Файлы и модули» и имеют строку в таблице AC1–AC9/AC-защиты. Непокрытого класса не нашёл.

## Как проверялось

Чтение построчно всех пяти изменённых src-файлов целиком и диффов тестов/смоков/реестра мутантов; сверка с AC1–AC9 таблицы ТЗ одна к одной; сверка `docs/TOUCH-SUPPORT.md` и `docs/USER-GUIDE.ru.md` §11 (оба уже отражают новый контракт тем же текстом, что и в ТЗ — согласовано). Трейлеры: `Issue: #847` на всех 4 коммитах; `User-Visible: yes` только на `77f2b349`, который в одном и том же коммите правит оба `docs/CHANGELOG{,.ru}.md` — правило соблюдено. `docs/release-ledger/v1.80.1/847.json`: `stable-fix` обоснован построчными ссылками на существующий в v1.80.1 код (`_holdTimer`, `_onWindowBlur`, `_sunOutTimer`) — классификация соответствует предыдущему stable, без признаков новой беты-функции (`introducedBy` не требуется).

### Разобрано построчно (проверено чтением, где не покрыто автотестом отдельно)
- `src/view-hold.ts` — pointer-owned 600 мс таймер с generation fence; `cancel(pointerId)` игнорирует чужой `pointerId`, `cancel()` без аргумента — безусловный выход из жизненного цикла. Соответствует AC1 и защищено `test/view-hold.test.mjs` (owner/foreign terminal, re-arm, stale callback).
- `src/touch-gesture-click-guard.ts` — `interrupt()`/`abandon()` добавлены без замены `reset()`; `_interruptedOwners` корректно освобождается только собственным терминалом пришедшего контакта (не по времени), что совпадает с решением владельца 1а и риском «недостаточное завершение», явно принятым в разделе «Риски» ТЗ. `pointerTerminal(..., 'lostpointercapture')` по-прежнему не считается физическим освобождением (F84) — проверено построчно и `test/touch-gesture-click-guard.test.mjs` (новые тесты «F84», «F86», «blur»/«hidden»).
- `src/visual-continuity.ts` — `onPageHide`/`hide()` идемпотентны через новый флаг `runtime.hidden` (не только `hiddenAt`), слушатель добавляется/снимается вместе с первым/последним подписчиком. Закрывает M1 из SPEC-REVIEW-847-r1 по существу — пробел (`pagehide` без слушателя) действительно существовал на `dev` и теперь закрыт. Проверено `test/visual-continuity.test.mjs` (новые тесты на идемпотентность и long-hidden duration).
- `houseplan-card.ts` — проводка `_commitSpace`, `disconnectedCallback` (`_abandonViewInput()` + `_sunFadeReset()`), `_onWindowBlur` (безусловно для `_mode==='view'`), `_pointerDown`/`_stagePointerUp`/`_pointerUp`/`_pointerCancel`/`_guardTouchGesture` — последовательно заменяет `clearTimeout(this._holdTimer)` на `this._viewHold.cancel(...)` везде, где раньше таймер не снимался (D1 из ТЗ). Разобрано построчно, см. находку ниже про AC4(в).
- Авторский мутант «compatibility click после завершённого удержания» — проверено, что он блокируется не флагом `_holdFired` (который `_onWindowBlur` теперь сбрасывает безусловно и в этом случае), а `TouchGestureClickGuard.interrupt(pointerId)`, вызываемым изнутри `_viewHold.arm()`'s callback и перехватываемым `stopImmediatePropagation()` в capture-фазе до того, как событие достигнет `_clickDevice`. Сброс `_holdFired` на blur безопасен и не реоткрывает D7.

## Находки

### M1 (Medium, в скоупе) — AC4(в)/D6: «`_commitSpace` не завершает удержание» не доказано ни мутантом, ни изолирующим негативным случаем

ТЗ (таблица AC, строка AC4) явно требует: **«Мутанты: blur снимает удержание только при непустом `_pointers`; `_commitSpace` не завершает удержание»**. Второй из них не зарегистрирован в `scripts/mutation-registry.mjs` (там 11 новых `#847`-записей — ни одна не трогает `src/houseplan-card.ts:1476` (`this._viewHold.cancel();` внутри `_commitSpace`)), и действующий смок не ловит его удаление.

Воспроизведение логического разрыва:
- `demo/smoke_view_hold_lifecycle.mjs`, блок AC4/AC6, сценарий `${route}SpaceRetiresHold`:
  ```js
  await touch(cdp, 'touchStart', [{ ...p, id: 5 }]); await wait(page, 100);
  if (route === 'hash') await page.evaluate(() => { location.hash = '#space=garden'; });
  else await page.evaluate(() => window.__hpTest.switchSpace('garden'));
  await touch(cdp, 'touchEnd'); await sameInert(page, initial, `${route}SpaceRetiresHold`);
  ```
  Касание отпускается (`touchEnd`) сразу после смены пространства — т.е. на ~100–150 мс после начала, задолго до порога 600 мс. Реальное `pointerup`, которое при этом доставляется браузером, ловится глобальным `window.addEventListener('pointerup', this._onViewPointerTerminal, true)` (houseplan-card.ts:2706) **независимо** от `_commitSpace` и само вызывает `this._viewHold.cancel(event.pointerId)`.
- Если удалить `this._viewHold.cancel();` из `_commitSpace` (houseplan-card.ts:1476) — ровно мутация, названную в ТЗ, — тест выше не покраснеет: к 600 мс таймер давно снят последующим `touchEnd`, который в сценарии выполняется независимо от того, успел ли `_commitSpace` что-то сделать.
- Исходный дефект D6 из основания ТЗ требует обратного порядка: палец остаётся физически нажатым **после** смены пространства, вплоть до 600 мс и позже («с этажа `f1` поверх `garden`» — то есть устройство старого этажа открывается уже после перехода, при удержанном пальце). Этого сценария в смоке нет.

Чем это вредно для продукта: если в будущем рефакторинге `_commitSpace` потеряет вызов отмены удержания (например, при слиянии с #846, который правит ту же функцию — риск явно назван в разделе «Риски» ТЗ), ни один тест не заметит регресс, а пользователь при автоматическом/программном переключении этажа во время удержания увидит карточку устройства с предыдущего этажа — именно тот UX-дефект, который задача обязана закрыть.

Предложение по закрытию (не исполняю — только для автора): либо зарегистрировать мутант, убирающий `this._viewHold.cancel();` в `_commitSpace`/houseplan-card.ts:1476, с guard `node demo/smoke_view_hold_lifecycle.mjs`, либо (дешевле) изменить `${route}SpaceRetiresHold` так, чтобы `touchEnd` отправлялся после прохождения 600 мс от начала жеста (как в оригинальном D6), что сделает сценарий самодостаточным негативным случаем без отдельной записи в реестре.

## Что проверено и корректно

- AC1/AC2 — `ViewHoldGesture` (owner/foreign terminal, re-arm, stale queued callback) закрыто unit-тестом с поддельными часами и смоком (реальный CDP `touchCancel`, retired-callback не стирает новый `_pointers`). Мутанты `view-hold-owner-terminal-ignored`, `view-hold-foreign-terminal-retires-owner` зарегистрированы и исполняются дешёвым unit-guard'ом.
- AC3 — реальный мышиный релиз на найденной границе невидимой 44px-цели (`demo/smoke_view_hold_lifecycle.mjs`, блок AC3/AC5) и мутант `view-hold-terminal-only-marker` (guard — тот же смок).
- AC5 — реальный blur через iframe, короткое (100 мс) и долгое (900 мс) нажатие мышью и касанием; хвост инертен, следующий клик и `Enter` работают немедленно. Мутант `view-blur-keeps-activation-tail`.
- AC6/AC9 (F84/F86) — все сценарии (пропавшие окончания одного/двух касаний, поздний чужой терминал, второй контакт после implicit lost capture ещё нажатого первого, touch-contextmenu после hold/pan) покрыты и в `test/touch-gesture-click-guard.test.mjs` (новые тесты ровно под F84/F86), и в смоке. Четыре мутанта (`view-hidden-keeps-contacts`, `view-hidden-reset-allows-old-tail`, `view-hold-context-tail-unowned`, `view-pan-context-tail-unowned`, `view-capture-loss-forgets-physical-contact`) явно проверяют каждую защиту отдельно.
- AC4(а)(б)(г) — отмена+blur, hidden/pagehide (включая дубликат hidden+pagehide — идемпотентность), pageshow(persisted) — реальный iframe-blur, явно названная эмуляция `visibilityState`, явно dispatched `PageTransitionEvent`. `test/visual-continuity.test.mjs` закрывает M1 SPEC-REVIEW-847-r1 (общая точка подключения `pagehide`, disposal с последним unsubscribe).
- AC7 — живой `sun.sun` через `hass`, `remove()` во время 2-секундного fade, таймер обнуляется немедленно, после паузы `_sunShown=false`, после переподключения соответствует новой высоте. Мутант `view-sun-fade-outlives-detach`.
- AC8 — существующие 19 unit-тестов (`touch-gesture-click-guard`, `kiosk-hold`, `pointer-modality`) и существующие смоки (`smoke_long_press_gesture`, `smoke_kiosk_scale_no_editor`, `smoke_touch_tips`, `smoke_tap_ctx` и др.) не тронуты по логике; `test/device-marker-polish-contract.test.mjs` вместо замороженного regex на `_holdTimer` честно ссылается на поведенческое доказательство (`view-hold.test.mjs` + смок) — это снятие именно того regex, который правило о «монолите только через исполнение» просит снимать, а не заменять новым текстовым якорем.
- F010 (AC9) — положительный контроль: настоящий тап по названию комнаты, чьё `lostpointercapture` приходит доверенно после `pointerup`, сохраняет отложенный room-fit (`_touchClickGuard.hasPointer` различает состояние «ещё удерживается» от «уже отпущен, потеря capture не кассирует принятый тап» — houseplan-card.ts:7246-7252). Проверено построчно и смоком (`trustedRoomNameTapSurvivesImplicitLoss`).
- Release-артефакты: `stable-fix` классификация обоснована по строкам кода, присутствующим в v1.80.1; оба changelog и трейлеры в одном коммите; i18n не тронут (новых ключей и правда нет); миграций/config/WS API дифф не содержит.
- Производительность/touch: один таймер на экземпляр, O(1) на терминал; `subscribePageVisibility` остаётся одним shared-листенером; `Touch editor: not exposed` — редакторские пути (`_deviceDrag`, `_editorRuntime`) в диффе не изменены, кроме косметической правки фикстуры `smoke_editor_gestures.mjs` (досылка настоящего `pointerup` после синтетического `lostpointercapture`, чтобы не оставлять фиктюрный контакт «висящим» между независимыми сценариями — само по себе корректно и не меняет проверяемое поведение).

## Чего не проверял

- Полный прогон `npm run gate:small`/`npx tsc --noEmit`/`npm test`/`npm run build` — не повторял: Validate зелёный на этом же SHA (`a80e780b`), гейт дешёвый и уже подтверждён.
- `node scripts/mutation-gate.mjs --check` (ловлю ли мутанты фактическим прогоном) — не исполнял: по правилу трека `ask`/«Объём гейтов» мутанты в разработке не гоняются ни на каком треке, ловлю проверяет только ночь (#709). Проверил лишь то, что регистрация статически присутствует (кроме указанного в M1 пробела) и `because` у каждой осмысленная.
- Живой Android/bfcache сценарий (D9, настоящая потеря terminal-событий; настоящий `pagehide`→restore в мобильном браузере) — согласно самому ТЗ это открытая полевая гипотеза, не предмет этого ревью; текст смока и канонов честно называет эмуляцию эмуляцией.
- `golden:verify`, полные 334 смока, `pytest tests_backend`, performance — не входят в объём: отрисовка плана не меняется (ТЗ прямо пишет «Golden не нужен»), Python не тронут, performance не упомянут в AC.
- Инварианты модели (`npm run invariants`) — не прогонял: дифф не трогает геометрию или ссылки на неё (только input lifecycle состояние экземпляра).
- Не проверял отдельно все «ещё 45» токенов из списка риска построчно — выборочно проверил представительные (window-listeners на 2706-2708/2797-2799, PointerEvent на 2397) и системные места (`_commitSpace`, `disconnectedCallback`, `_guardTouchGesture`); оставшиеся — одно‑/двухстрочная замена `clearTimeout(this._holdTimer)` → `this._viewHold.cancel(...)` в уже просмотренных методах, не отдельные новые классы риска.

## Вердикт

Жёлтый: одна находка Medium в скоупе (M1), High нет. Возврат автору на доработку в рамках текущей задачи #847, отдельный issue не заводится.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/847-view-input-lifecycle`, коммит `a80e780b8d53` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `ae6c87d7c85d095ccecf463a417b5161db223940`
  ```
  git log --all --format='%H %T' | grep ae6c87d7c85d
  ```
- Тело issue: `11b75ad542ee26712d6b4209f4e16da51ca9e4f987e75c57fd6cba3b80769d53`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ0MzcsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NTI3fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMTIsIm91dHB1dF90b2tlbnMiOjUxOTQ2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE2Njc1NywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjY2NDIxNjQsImNvc3RVc2RFc3RpbWF0ZSI6Mi41MTUxNDQ4MDAwMDAwMDAzfV0sInR1cm5zIjo2NSwiZHVyYXRpb25NcyI6NTg5MzYwLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi41MTk2NzE4MDAwMDAwMDAyLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=4549 output_tokens=51964 cache_creation_input_tokens=166757 cache_read_input_tokens=6642164 num_turns=65 -->
