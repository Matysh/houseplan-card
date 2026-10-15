# CODE-REVIEW-847-r2

Материал: `eec36c8d612f79bf9c8e3a963855ac238d1e02bb` (`issue/847-view-input-lifecycle`, 6 коммитов над `origin/dev` `a7bd08bf`). Трек: `ask`, P2. Заход: r2, блокирующих циклов использовано 1/4 до этого раунда.
Validate на этом SHA: success (https://github.com/Matysh/houseplan-card/actions/runs/38657419562) — typecheck/test/build/bundle-policy приняты без повторного прогона.

Предыдущий раунд: `docs/reviews/CODE-REVIEW-847-r1.md` (жёлтый, материал `a80e780b8d53`/дерево `ae6c87d7c85d`). Эта пара SHA/дерево ребейзом осиротела — ожидаемо (сам r1-документ предупреждает об этом), не находка: ветка `issue/847-view-input-lifecycle` в `git branch -a` указывает ровно на материал этого раунда, её история линейно продолжает те же шесть #847-коммитов по содержанию коммитных сообщений.

## Скоуп

Делта r1→r2 — три коммита: `7aecfa7f` (завершение физических контактов в `smoke_editor_gestures.mjs` + новый remount-кейс в `smoke_view_hold_lifecycle.mjs`), `db2d2827` (явный page-error-вердикт вместо `assert.equal(...,false)`, снятие второго замороженного regex-якоря `_pointerUp`/`clearTimeout(_holdTimer)` в `device-marker-polish-contract.test.mjs`), `eec36c8d` (заявленное закрытие M1 из r1: новый мутант `view-space-change-keeps-pending-hold`, правка `smoke_view_hold_lifecycle.mjs`, обновление `docs/testing-notes/mutation-browser-guards.md` и `docs/DEVELOPMENT.md`). Ни один из трёх коммитов не трогает `src/houseplan-card.ts`, `src/touch-gesture-click-guard.ts`, `src/visual-continuity.ts`, `src/view-hold.ts` — продуктовый код не изменился с r1, изменились только тест/смок/реестр-мутантов/документация. Разбор по дельте (§2.10): полную переразборку src-файлов не повторяю, фокус — заявленное закрытие M1 (AC4(в)/D6) и сопутствующие тестовые правки.

## Риск по изменённым участкам (#707)

Трек `ask`. Поскольку делта не трогает `src/houseplan-card.ts`, все 45+ токенов риска из промпта (`PointerEvent` на `houseplan-card.ts:2398`, `pointerup`/`pointercancel` window-листенеры на `:2706–2708`/`:2797–2799` и остальные) идентичны r1 — построчно перепроверены в r1 и не отличаются сейчас (`git show <commit> --stat` для всех трёх новых коммитов не упоминает этот файл). Покрытие AC1/AC9 — унаследовано без повторной проверки. Единственный новый риск этого раунда — не токен src, а утверждение в `scripts/mutation-registry.mjs`/`docs/testing-notes/mutation-browser-guards.md` о том, что мутация строки `houseplan-card.ts:1477` (`this._viewHold.cancel();` внутри `_commitSpace`) ловится гардом; этот риск разобран ниже (находка M1-r2) — он не покрыт достоверно, несмотря на формальную запись.

## Как проверялось

Дифф `git diff origin/dev...HEAD` целиком (24 файла) и отдельно построчно три новых коммита (`git show 7aecfa7f|db2d2827|eec36c8d`). Сверка с AC1–AC9 — только по дельте (AC4(в)/D6 и примыкающие мутанты/смок-кейсы). `npm run bundle:sync` (typecheck + rollup build, прошло; совпадает с зелёным Validate). Запущен `node demo/smoke_view_hold_lifecycle.mjs` (новый/изменённый в делте, назван в AC1–AC9) — зелёный. Затем **применён сам зарегистрированный мутант** (`scripts/mutation-registry.mjs`, id `view-space-change-keeps-pending-hold`: patch, убирающий `this._viewHold.cancel();` из `_commitSpace`), пересобран бандл и смок перезапущен — находка ниже. Патч и бандл восстановлены в исходное состояние (`git checkout -- dist/ src/houseplan-card.ts src/view-hold.ts && git clean -fd dist/`), рабочее дерево чисто, `HEAD` не менялся (`eec36c8d6…` подтверждён `git rev-parse HEAD` до и после). Дополнительно прогнаны `demo/smoke_editor_gestures.mjs` (единственный смок, чьи строки правит делта помимо `smoke_view_hold_lifecycle.mjs`) и регрессионные смоки AC8 (`smoke_long_press_gesture`, `smoke_kiosk_scale_no_editor`, `smoke_touch_tips`, `smoke_tap_ctx`) — все зелёные, без деструктивного вмешательства в src.

## Находки

### M1-r2 (Medium, в скоупе) — AC4(в)/D6: заявленное закрытие M1 (r1) недостоверно — зарегистрированный мутант `view-space-change-keeps-pending-hold` не красит гард

r1 требовал (цитата из его M1): зарегистрировать мутант, убирающий `this._viewHold.cancel();` в `_commitSpace`/`houseplan-card.ts:1476`, с guard `node demo/smoke_view_hold_lifecycle.mjs` — **или** изменить сценарий так, чтобы это стало самодостаточным негативным случаем. Автор выбрал первый путь: коммит `eec36c8d` добавил

```js
// scripts/mutation-registry.mjs
{
  id: 'view-space-change-keeps-pending-hold',
  guard: 'node demo/smoke_view_hold_lifecycle.mjs',
  because: '#847 AC4(в)/D6: ... no implicit capture/terminal masks space cancellation.',
  patches: [{ file: 'src/houseplan-card.ts',
    find: '      this._cancelPendingWarmMode();\n      this._viewHold.cancel();\n      this._clearRoomFocus(true);',
    replace: '      this._cancelPendingWarmMode();\n      // mutant: old-space hold survives navigation\n      this._clearRoomFocus(true);' }],
},
```

и новый смок-блок `${route}${modality}SpaceRetiresStillDownHold` (мышь/касание остаются физически нажатыми 750 мс после `hash`/`facade`-навигации, явно проверяется отсутствие независимого pointer-терминала для мыши).

**Я применил этот патч буквально** (та же `find`-строка, единственное совпадение в файле), пересобрал бандл (`npm run build && bundle-sync`) и перезапустил ровно названный guard-смок `node demo/smoke_view_hold_lifecycle.mjs`. Результат: `{"ok":true, ...}` — **все ассерты прошли, включая `hashmouseSpaceRetiresStillDownHold`/`hashtouchSpaceRetiresStillDownHold`/`facade*` варианты**. Мутация не покраснила тест, который должен был её ловить.

Причина (нашёл трассировкой `console.error` внутри `ViewHoldGesture.cancel`): `_commitSpace` вызывает `this._closeInfoCard()` на несколько строк ниже вырезанной (строка уже существовала в r1, её делта не трогала) — `_closeInfoCard()` безусловно вызывает `_interruptViewGesture()`, которая **тоже** вызывает `this._viewHold.cancel()` (без `pointerId`, т.е. всегда снимает текущего владельца), а также `_pointers.clear()`. Стек вызовов, пойманный на мутированной сборке:

```
VIEWHOLD_CANCEL undefined
  at ViewHoldGesture.cancel
  at _interruptViewGesture
  at _closeInfoCard
  at _commitSpace
  at _onHashChange
```

То есть строка `houseplan-card.ts:1477`, которую мутант вырезает, на практике **избыточна** для сценария «смена пространства, палец ещё физически нажат»: `_closeInfoCard()` несколькими строками ниже в той же ветке `_commitSpace` уже безусловно отменяет удержание через независимый путь. Сам контракт (AC4в: смена пространства завершает удержание) **выполняется** — но не тем кодом и не тем мутантом, который теперь зарегистрирован и предъявлен как доказательство. Это означает:

- Заявление `because` в реестре («no implicit capture/terminal masks space cancellation») фактически неверно для прочитанного кода — маскирует не неявный capture/terminal, а другой явный вызов отмены тремя строками ниже.
- Если в будущем рефакторинге `_closeInfoCard()`/`_interruptViewGesture()` станут условными (например, разработчик решит пропускать дорогую очистку, когда `_infoCard` уже `null` — правдоподобный рефакторинг для «no-op» пути), а удаление строки 1477 пройдёт как раньше — ни один тест и ни один названный мутант этого не заметит, несмотря на формально «закрытую» в реестре запись. Именно этот класс регресса (D6 — «с этажа f1 поверх garden») и была обязана ловить задача.

Воспроизведение (команды):
```
# в src/houseplan-card.ts заменить (единственное вхождение):
#   this._cancelPendingWarmMode();
#   this._viewHold.cancel();
#   this._clearRoomFocus(true);
# на
#   this._cancelPendingWarmMode();
#   this._clearRoomFocus(true);
npm run bundle:sync
node demo/smoke_view_hold_lifecycle.mjs   # -> {"ok":true,...} — должен был стать red
```

Предложение по закрытию (не исполняю — только автору): либо найти/создать мутацию, которая действительно изолирует ответственность `_commitSpace` (например, убрать и строку 1477, и сделать вызов `_closeInfoCard()` внутри того же блока `_commitSpace` условным на «если был открыт infoCard», раз существующий код их не различает по сути), либо честно описать в `because`, что защита сейчас комбинированная (две независимые отмены в одном блоке), и один мутант физически не может доказать необходимость конкретно строки 1477 — тогда более правильная цель мутации — весь блок `if (id !== this._space) { ... }` целиком (ближе к исходному предложению r1 «эта ветвь никого не завершает»), либо вернуться к второму варианту из r1 (переписать сценарий так, чтобы физическое отпускание происходило только после 600 мс — тогда поведение зависит от содержимого таймера, а не от того, какая из двух строк его снимает).

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| M1 (AC4в/D6: `_commitSpace`-мутант не зарегистрирован/не ловится) | **Не закрыта.** Автор зарегистрировал мутант `view-space-change-keeps-pending-hold` (коммит `eec36c8d`) и расширил смок, но эмпирическая проверка (патч применён буквально, смок перезапущен) показывает: мутация не красит guard — см. находку M1-r2 выше | `scripts/mutation-registry.mjs:96-104`, `demo/smoke_view_hold_lifecycle.mjs` блок `${route}${modality}Space...`; воспроизведено локально, патч не оставлен в дереве |

## Унаследовано из r1

[CODE-REVIEW-847-r1](https://github.com/Matysh/houseplan-card/blob/dev/docs/reviews/CODE-REVIEW-847-r1.md), материал `a80e780b8d530daec23e3f8410d34b256e949d13` (дерево `ae6c87d7c85d095ccecf463a417b5161db223940`, осиротевшие ребейзом — см. «Скоуп» выше). Принято без повторной проверки, так как делта r1→r2 не трогает эти файлы:

- `src/view-hold.ts` (owner/foreign terminal, re-arm, stale callback, generation fence) и `test/view-hold.test.mjs` — AC1/AC2.
- `src/touch-gesture-click-guard.ts` (`interrupt()`/`abandon()`, F84/F86, `_interruptedOwners`) и `test/touch-gesture-click-guard.test.mjs` — AC6/AC9, мутанты `view-hidden-keeps-contacts`, `view-hidden-reset-allows-old-tail`, `view-hold-context-tail-unowned`, `view-pan-context-tail-unowned`, `view-capture-loss-forgets-physical-contact`.
- `src/visual-continuity.ts` и `test/visual-continuity.test.mjs` — общий `pagehide`-подписчик, идемпотентность hidden+pagehide, disposal — AC4(а)(б)(г).
- Проводка в `src/houseplan-card.ts` (`_pointerDown`, `_stagePointerUp`, `_pointerUp`, `_pointerCancel`, `_guardTouchGesture`, `disconnectedCallback`, безусловный `_onWindowBlur` для View) — AC1–AC5, AC7.
- AC7 (`_sunOutTimer`, живой `sun.sun`), AC8 (регрессия, 19 унаследованных unit + смоки), F010-контроль (room-name tap переживает implicit lostpointercapture).
- Release-артефакты: `stable-fix` в `docs/release-ledger/v1.80.1/847.json`, трейлеры `Issue:`/`User-Visible: yes` с обоими changelog в одном коммите (`a384abc7`), i18n не тронут, миграций/WS API нет.
- Touch editor not exposed; перформанс (один таймер, O(1), shared page-visibility listener).

## Что проверено и корректно

- Делта не меняет продуктовый код (`src/**`) — все 24 файла диффа против `dev`, кроме трёх новых делта-коммитов, не изменились с r1; три новых коммита трогают только тест/смок/доку/реестр.
- `demo/smoke_editor_gestures.mjs`: добавленные `pointerup` после `lostpointercapture`-терминалов в `7aecfa7f` закрывают утечку синтетического контакта между независимыми блоками сценария без изменения проверяемого поведения — зелёный прогон подтверждает.
- Новый remount-кейс (`detachedViewHoldAndTailRetired` в `7aecfa7f`) — удержание в середине, `remove()` карточки, `touchEnd` на отключённом экземпляре, повторное подключение, хвост (`click`/`contextmenu`) инертен, первый свежий клик работает — зелёный, полезное дополнительное покрытие AC6/контракта п.6 (таймеры после отключения), не заменяет и не противоречит r1.
- `db2d2827`: снятие второго замороженного regex-якоря (`_pointerUp`/`clearTimeout(_holdTimer)`) в `test/device-marker-polish-contract.test.mjs` — ровно тот паттерн «контракт по монолиту через исполнение, не текст», который уже хвалился в r1 для первого такого снятия; поведенческая замена (`view-hold.test.mjs` + смок) подтверждена мной отдельно прогоном. Замена `assert.equal(...,false)` → `if (...) throw new Error(...)` для page-error — чисто косметическая, не меняет проверяемое условие.
- `docs/testing-notes/mutation-browser-guards.md`: 338→339 (Custom-element/HA lifecycle 172→173) соответствует ровно одной новой `#847`-записи (`grep -c '#847' scripts/mutation-registry.mjs` = 12, было 11 в r1).
- Трейлеры всех 6 коммитов: `Issue: #847` везде; `User-Visible: yes` только на `a384abc7`, остальные пять — `no`; оба changelog правятся в том же коммите, что и `yes` (унаследовано из r1, не менялось).
- Гейты: `npx tsc --noEmit` + `rollup -c` (через `npm run bundle:sync`) — прошли локально, совпадает с зелёным Validate на этом же SHA. `node demo/smoke_view_hold_lifecycle.mjs`, `node demo/smoke_editor_gestures.mjs`, `node demo/smoke_long_press_gesture.mjs`, `node demo/smoke_kiosk_scale_no_editor.mjs`, `node demo/smoke_touch_tips.mjs`, `node demo/smoke_tap_ctx.mjs` — все зелёные, без регрессий в соседнем поведении.
- Рабочее дерево после всех экспериментов (включая применение и откат мутанта) восстановлено в точности до коммита `eec36c8d` (`git status --short` пуст, `git rev-parse HEAD` неизменен).

## Чего не проверял

- Полный `npm test` / весь unit-набор — не гонял: Validate зелёный на этом же SHA, делта не трогает ни одного src-файла, только новый мутант/смок/документацию; точечный прогон named unit файлов (`view-hold`, `touch-gesture-click-guard`, `visual-continuity`, `device-marker-polish-contract`) штатным `node --test` требует предварительной `tsc -p tsconfig.test.json`-компиляции (не выполнял отдельно от `npm test`, т.к. это дублирует уже зелёный Validate).
- Полную матрицу 336 смоков и `node scripts/smoke-select.mjs` «слабую связь» (48 строк, все по общему символу `_mode`) — не гонял: прямые совпадения (`smoke_view_hold_lifecycle`, `smoke_editor_gestures`, `smoke_modes`, `smoke_linked_virtual_light`, `smoke_long_press_gesture`) и AC8-регрессия покрыты; `smoke_modes`/`smoke_linked_virtual_light` не трогались делтой и не прогонялись отдельно (унаследованы из r1 как не задетые изменением).
- `node scripts/mutation-gate.mjs --check` (автоматическая ловля всем реестром) — не исполнял целиком: ловлю проверяет только ночь (#709); вместо этого вручную применил именно новую мутацию из делты — находка M1-r2 выше получена не статическим чтением, а реальным запуском.
- `golden:verify`, `pytest tests_backend`, `npm run invariants`, performance — вне объёма: отрисовка и геометрия не тронуты, Python не тронут, перформанс не назван в AC (унаследовано из r1, делта тоже не меняет геометрию/Python).
- Живой Android/bfcache сценарий (D9) — как и в r1, открытая полевая гипотеза, не предмет этого ревью.

## Вердикт

Жёлтый: одна находка Medium в скоупе (M1-r2 — продолжение незакрытого M1 из r1: формально зарегистрированный мутант не ловит регресс, который обязан ловить). High нет. Возврат автору на доработку в рамках текущей задачи #847, отдельный issue не заводится.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/847-view-input-lifecycle`, коммит `eec36c8d612f` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `2cf0ac65e0b1b8f6db892fd73bc26651a09e9908`
  ```
  git log --all --format='%H %T' | grep 2cf0ac65e0b1
  ```
- Тело issue: `11b75ad542ee26712d6b4209f4e16da51ca9e4f987e75c57fd6cba3b80769d53`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ0MzksIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NTM0fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxNTAsIm91dHB1dF90b2tlbnMiOjUzOTQ2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE1OTk3NSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjkxOTM3NDUsImNvc3RVc2RFc3RpbWF0ZSI6My4wMTg0MDkwMDAwMDAwMDA2fV0sInR1cm5zIjo4MCwiZHVyYXRpb25NcyI6OTAxNjY1LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6My4wMjI5NDMwMDAwMDAwMDA2LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=4589 output_tokens=53965 cache_creation_input_tokens=159975 cache_read_input_tokens=9193745 num_turns=80 -->
