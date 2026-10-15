# CODE-REVIEW-847-r3

Материал: `70c3546aa71128153a8a6e2437c40669962c80dd` (`issue/847-view-input-lifecycle`, 8 коммитов над `origin/dev` `a7bd08bfdffa2b2747fa711f827e302ab4690781`). Трек: `ask`, P2. Заход: r3, блокирующих циклов использовано 2/4 до этого раунда.
Validate на этом SHA: success (https://github.com/Matysh/houseplan-card/actions/runs/38660716957) — typecheck/test/build/bundle-policy приняты без повторного прогона (#343).

Предыдущий раунд: `docs/reviews/CODE-REVIEW-847-r2.md` (жёлтый, материал `eec36c8d612f`). Делта r2→r3 — ровно один коммит: `70c3546a` («witness combined space hold retirement paths»). Он не трогает ни один файл `src/**`: изменены только `demo/smoke_view_hold_lifecycle.mjs`, `scripts/mutation-registry.mjs`, `docs/DEVELOPMENT.md`, `docs/testing-notes/mutation-browser-guards.md` (`git show --stat 70c3546a`). Разбор по дельте (§2.10): полную переразборку src-файлов не повторяю, весь объём этого раунда — заявленное закрытие M1-r2.

## Скоуп

ТЗ (тело issue, раздел `## ТЗ`, редакция 2 от 14.10.2026) и AC1–AC9 неизменны с r1/r2 — body digest автор называет тем же (`11b75ad542ee…`), дифф тела не проверялся построчно повторно, т.к. платформа ревью — коммиты, а issue отдельно не редактировался между r2 и r3 (нет события edit в комментариях). Предмет этого раунда — единственная оставшаяся находка M1-r2 (AC4(в)/D6: защитный мутант `view-space-change-keeps-pending-hold` должен красить `node demo/smoke_view_hold_lifecycle.mjs`, если `_commitSpace` перестаёт завершать зависшее удержание при смене пространства).

## Риск по изменённым участкам (#707)

Трек `ask`. Поскольку делта не трогает `src/houseplan-card.ts` (и вообще ни одного `src/**`-файла), все 45+ токенов риска из промпта (`PointerEvent` на `houseplan-card.ts:2398`, `pointerup`/`pointercancel` на `:2707–2708`/`:2798–2799` и остальные) идентичны r1/r2 — покрытие AC1–AC9 этими токенами унаследовано без повторной проверки (`git show 70c3546a --stat` не упоминает `houseplan-card.ts`). Единственный предмет нового риска — сам текст мутации в `scripts/mutation-registry.mjs` (разобран ниже, это и есть находка/закрытие M1-r2, а не новый непокрытый класс).

## Как проверялось

`git show --stat/--patch 70c3546a` — единственный коммит делты, построчно. Сверка с AC4(в)/D6 (единственный задетый AC). Остальное (AC1–AC3, AC5–AC9) не передельтовано — делта их не касается.

Главное действие раунда — не чтение, а повторение эксперимента r1/r2 на новой версии мутанта:
1. На чистом `HEAD` (`70c3546a`) прогнан `node demo/smoke_view_hold_lifecycle.mjs` — зелёный, все 40 именованных кейсов `true` (включая новые `*SpaceRetiresOwnerImmediately`).
2. Применён **буквально** зарегистрированный мутант `view-space-change-keeps-pending-hold` целиком — оба патча из `scripts/mutation-registry.mjs`: убраны `this._viewHold.cancel();` (houseplan-card.ts:1477) **и** вызов `this._closeInfoCard()` на следующей строке сделан условным на `this._infoCard` (houseplan-card.ts:1481). Патчи применены к `src/houseplan-card.ts` тем же `find`/`replace`, единственное совпадение каждого. `npm run bundle:sync` — typecheck и rollup прошли без ошибок. `node demo/smoke_view_hold_lifecycle.mjs` → **красный**:
   ```
   AssertionError [ERR_ASSERTION]: hash/mouse: actual navigation tears down the owner immediately, not just at timer expiry
   1 !== null
   ```
   Мутация теперь ловится ровно названным guard-смоком — заявленное закрытие M1-r2 подтверждено исполнением, не чтением.
3. Для проверки, что оба под-патча действительно нужны вместе (а не что один из них один делает всю работу, а второй — косметика/overclaim), повторно, по отдельности:
   - только первый патч (убрать `this._viewHold.cancel();`, без условия на `_closeInfoCard()`) → `npm run bundle:sync` → `node demo/smoke_view_hold_lifecycle.mjs` → **зелёный** (`{"ok":true,...}`, все 40 кейсов `true`). Ожидаемо: `_closeInfoCard()` по-прежнему безусловно вызывает `_interruptViewGesture()` → `this._viewHold.cancel()` без аргумента, которая одна снимает владение независимо от первой строки.
   - (второй патч сам по себе логически симметричен: пока жива явная отмена на 1477, условие на `_closeInfoCard()` ничего не меняет — отдельно не прогонялся, вывод из структуры кода, не отдельный запуск.)

   Это подтверждает формулировку `because` в реестре («This is combined protection, not proof that either redundant line alone is necessary») — не overclaim, а точное описание эмпирически проверенного поведения.
4. Рабочее дерево после каждого шага восстановлено: `git checkout -- src/houseplan-card.ts && npm run bundle:clean`. `git status --short` пуст, `git rev-parse HEAD` = `70c3546aa711…` неизменен на всех этапах.

## Находки

Нет. Единственная открытая находка предыдущего раунда (M1-r2) закрыта — проверено эмпирически (не чтением), по сценарию, который предыдущие два раунда уже признавали корректным способом доказательства (прямое применение зарегистрированного мутанта к `src/houseplan-card.ts` и перезапуск названного guard-смока).

High: 0. Medium: 0.

## Закрытие раунда r2

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| M1-r2 (Medium, в скоупе) — AC4(в)/D6: зарегистрированный мутант `view-space-change-keeps-pending-hold` не красил `node demo/smoke_view_hold_lifecycle.mjs`, потому что `_closeInfoCard()` внутри `_commitSpace` безусловно вызывает независимый `_interruptViewGesture()` → `this._viewHold.cancel()`, маскируя удаление явной отмены на `houseplan-card.ts:1477` | Коммит `70c3546a`: мутация расширена вторым патчем — вызов `_closeInfoCard()` на `houseplan-card.ts:1481` сделан условным на `this._infoCard` (внутри `_commitSpace`, не глобально); смок получил прямую проверку `(await state(page)).owner === null` сразу после навигации (`*SpaceRetiresOwnerImmediately`), не только инертность спустя 750 мс. Я применил патч буквально и перепроверил: `node demo/smoke_view_hold_lifecycle.mjs` красный (`AssertionError: hash/mouse: actual navigation tears down the owner immediately... 1 !== null`) — см. «Как проверялось», шаг 2 | `scripts/mutation-registry.mjs:95-106` (два `patches[]`-элемента), `demo/smoke_view_hold_lifecycle.mjs:239-246` (новая проверка `owner === null`); воспроизведено локально в этом раунде, патч откачен, `HEAD` не менялся |

## Унаследовано из r2 (и транзитивно из r1)

[CODE-REVIEW-847-r2](https://github.com/Matysh/houseplan-card/blob/dev/docs/reviews/CODE-REVIEW-847-r2.md), материал `eec36c8d612f79bf9c8e3a963855ac238d1e02bb` (дерево `2cf0ac65e0b1b8f6db892fd73bc26651a09e9908`). Принято без повторной проверки, т.к. делта r2→r3 (один коммит `70c3546a`) не трогает эти файлы:

- `src/view-hold.ts` (owner/foreign terminal, re-arm, stale callback, generation fence) и `test/view-hold.test.mjs` — AC1/AC2.
- `src/touch-gesture-click-guard.ts` (`interrupt()`/`abandon()`, F84/F86, `_interruptedOwners`) и `test/touch-gesture-click-guard.test.mjs` — AC6/AC9 и соответствующие мутанты.
- `src/visual-continuity.ts` и `test/visual-continuity.test.mjs` — общий `pagehide`-подписчик, идемпотентность hidden+pagehide, disposal — AC4(а)(б)(г).
- Проводка в `src/houseplan-card.ts` (`_pointerDown`, `_stagePointerUp`, `_pointerUp`, `_pointerCancel`, `_guardTouchGesture`, `disconnectedCallback`, безусловный `_onWindowBlur` для View) — AC1–AC5, AC7; в этом раунде и r2 не менялась.
- AC7 (`_sunOutTimer`, живой `sun.sun`), AC8 (регрессия, 19+ унаследованных unit + смоки), F010-контроль (room-name tap переживает implicit lostpointercapture).
- `demo/smoke_editor_gestures.mjs` (закрытие физических контактов, коммит `7aecfa7f`) и снятие второго замороженного regex-якоря в `test/device-marker-polish-contract.test.mjs` (коммит `db2d2827`) — проверены в r2, делтой r3 не затронуты.
- Release-артефакты: `stable-fix` в `docs/release-ledger/v1.80.1/847.json`, трейлеры `Issue:`/`User-Visible: yes` с обоими changelog в одном коммите (`a384abc7`), i18n не тронут, миграций/WS API нет.
- Touch editor not exposed; перформанс (один таймер, O(1), shared page-visibility listener).
- Риск по изменённым участкам (#707) — весь список токенов из r1/r2, делтой r3 не затронут (см. раздел выше).

## Что проверено и корректно

- Делта r3 (`70c3546a`) не меняет продуктовый код — `src/**` не затронут, изменены только тест/реестр мутантов/документация (`git show --stat`).
- Новая проверка в смоке (`assert.equal((await state(page)).owner, held.pointerId, ...)` перед навигацией и `assert.equal((await state(page)).owner, null, ...)` сразу после неё, до ожидания 750 мс) — наблюдает `ViewHoldGesture.pointerId` напрямую (`src/view-hold.ts:20`), не опосредованно через инертность плана; это и есть тот сильный, мутационно-чувствительный виджет, которого не хватало в r1/r2.
- Текст `because` в `scripts/mutation-registry.mjs` и формулировки в `docs/DEVELOPMENT.md`/`docs/testing-notes/mutation-browser-guards.md` честно описывают связку двух путей отмены внутри `_commitSpace` и прямо отказываются утверждать, что какая-то одна из них необходима поодиночке — эмпирически подтверждено (см. «Как проверялось», шаг 3): удаление только первой строки оставляет смок зелёным.
- Патч `find`-строк в реестре по-прежнему уникально совпадает в `src/houseplan-card.ts` (дрейфа кода относительно реестра нет) — подтверждено применением.
- Трейлеры коммита `70c3546a`: `Issue: #847`, `User-Visible: no` — верно, изменений, видимых пользователю, нет; changelog не требуется и не трогается.
- Рабочее дерево после всех экспериментов (три раза: полный мутант, частичный мутант, откат) восстановлено в точности до `70c3546a` (`git status --short` пусто, `git rev-parse HEAD` неизменен на всём протяжении).
- Собранный бандл с применённым и без применённого мутанта компилируется без ошибок TypeScript — изменение регистра мутации не затрагивает типы.

## Чего не проверял

- ТЗ (тело issue) построчно заново — не перечитывал весь текст повторно, доверился заявлению автора о неизменном body digest (`11b75ad542ee…`) и отсутствию события редактирования issue между r2 и r3 в списке комментариев; делта этого раунда AC не меняет и не добавляет.
- AC1–AC3, AC5–AC9, F010, release-ledger, i18n, миграции — не передельтовывал: делта r3 не трогает ни одного файла, который их реализует или проверяет (см. «Унаследовано из r2»).
- Полный `npm test`/весь unit-набор, полную матрицу смоков, `node scripts/mutation-gate.mjs --check` целиком — не гонял: Validate зелёный на этом же SHA (#343), делта r3 не трогает ни одного src-файла, только тест/реестр одного мутанта/документацию; именно этот мутант я проверил исполнением напрямую (см. выше), что сильнее статической проверки реестра.
- `golden:verify`, `pytest tests_backend`, `npm run invariants`, performance — вне объёма и в этом раунде: отрисовка и геометрия не тронуты, Python не тронут, перформанс не назван в AC (унаследовано из r1/r2, делта тоже не меняет геометрию/Python).
- Живой Android/bfcache сценарий (D9) — как и в r1/r2, открытая полевая гипотеза, не предмет этого ревью.
- Ночной `mutation-gate` фактический прогон всего реестра (ловлю всех 1529+ определений) — по правилу раздела «Трек show»/«Объём гейтов» это не гейт разработки ни на каком треке, ловлю проверяет только ночь (#709); я применил вручную именно изменённый в делте мутант, что и было предметом незакрытой находки.

## Вердикт

Зелёный: находок нет (High 0, Medium 0). Единственная находка предыдущего раунда (M1-r2) закрыта и подтверждена исполнением — зарегистрированный мутант `view-space-change-keeps-pending-hold` теперь ловится guard-смоком, а формулировка защиты в реестре и документации точно (без overclaim) описывает эмпирически проверенное поведение. Задача может двигаться дальше по конвейеру.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/847-view-input-lifecycle`, коммит `70c3546aa711` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `3c364599763219aa49e2e2e46e6b02783970642e`
  ```
  git log --all --format='%H %T' | grep 3c3645997632
  ```
- Тело issue: `11b75ad542ee26712d6b4209f4e16da51ca9e4f987e75c57fd6cba3b80769d53`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ0MzUsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NTI0OTk5OTk5OTk5OTk5NX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NDYsIm91dHB1dF90b2tlbnMiOjIxNTczLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjkzOTA4LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MTk0ODcyOSwiY29zdFVzZEVzdGltYXRlIjowLjk4MTE5OTgwMDAwMDAwMDF9XSwidHVybnMiOjMyLCJkdXJhdGlvbk1zIjo0MjI2MDgsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjowLjk4NTcyNDgsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4481 output_tokens=21591 cache_creation_input_tokens=93908 cache_read_input_tokens=1948729 num_turns=32 -->
