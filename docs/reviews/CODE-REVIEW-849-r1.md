# CODE-REVIEW-849-r1

## Скоуп

Issue #849 (track:ask), этап code, заход r1. ТЗ (редакция «Дельта перед
S4 — 14.10.2026», зелёное SPEC-REVIEW-849-r1) требует:

- AC1 — подтверждение действует для всех toggle-кнопок карточки устройства
  только когда эффективное действие маркера Toggle/Run и чекбокс включён;
  скрытое `tap_confirm` при Card/More-info/None не спрашивает; строка
  остаётся собственным точным target, не подставляется controls-группа.
- AC2 — между открытием и согласием состояние/identity/availability
  перепроверяются; смена HA connection/user, привязки, состава строк или
  карточки отменяет устаревшее действие; повторная активация не дублирует
  service.
- AC3 — lock/alarm/secure controls остаются no-op; lock-бейдж клавиатурой
  только открывает сведения.
- AC4 — lock-бейдж получает доступное имя/фокус/Enter-Space, плоская зона
  не увеличена (owner-исключение 3а), cancel/no-op не показывают dispatch
  feedback.
- AC5 — single-use confirmation guard: cancel/replace/repeat/reentry/throw
  не дают второй вызов и не роняют TypeError.

Материал — `docs/SCOPE.md` J3 (безопасное действие в плане и карточке
одинаково) и «The lock invariant» (единственная санкционированная
поверхность активации замка — подписанная кнопка Unlock/Lock); затрагивается
подсистема View (UX-MODES.md, DEVICE-PRESENTATION.md).

## Материал раунда

- SHA ревью: `7f07cb3e056ed055c3bf4a028d35c78f6b2deb48` (= рабочая копия,
  = `HEAD`). Диапазон: `git diff origin/dev...HEAD`, 7 коммитов
  `dfd2972c..7f07cb3e`, база `dced034b` (#867 уже `S8-merged`).
- Issue: трейлеры `Issue: #849` на всех 6 некоммитах класса A/B;
  `User-Visible: yes` на `dfd2972c` и `c50b6e36`, в обоих тот же коммит
  правит `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`. Коммит с правкой
  `demo/golden/baselines/**` (`c7ebdd07`) несёт `Release: golden-849` и
  `Baseline-Reviewed-Local: sha256:16326ab6…`; `localAttestation.sha256` в
  `baselines-index.json` совпадает, `source.branch` = `issue/849-view-confirm-a11y`,
  `source.commit` = `8ba42061…` (не унаследован от чужой `#867`). Финальный
  `7f07cb3e` — чистый docs-коммит, трейлеров не несёт (верно для класса C).
- `docs/release-ledger/v1.80.1/849.json`: `category: stable-fix`,
  обоснование — v1.80.1 уже содержит `tap_confirm`, прямой toggle из
  информационной карточки и кликабельный lock-бейдж; это восстановление
  безопасной согласованности существующей stable-функциональности, не новая
  бета-фича. Согласуется с остальными записями каталога (846.json, 847.json
  и т. д. — тот же формат).

## Как проверялось

**Прочитано построчно** (не на слово от хендоффа): `src/device-toggle.ts`
(новые `infoCardTapConfirmationRequired`, `resolveInfoRowToggleIntent` и их
встраивание в существующий `resolveEntity`/`singleIntent`/`resolvePowerEntity`
secure-путь), `src/view-action-context.ts` (`acceptTapConfirmation`,
`infoCardRowContextKey`), `src/houseplan-card.ts` (`_cardToggle` целиком,
`.oplock` role/tabindex/aria-label/keydown, `_acceptTapConfirm`), все четыре
`src/i18n/*.json`, `src/styles/plan.styles.ts`, тесты
`test/device-toggle.test.mjs`, `test/view-action-context.test.mjs`, смоки
`demo/smoke_info_card_confirm.mjs`, `demo/smoke_info_card_context.mjs`,
изменения в `demo/smoke_card_controls.mjs`, реестр `scripts/mutation-registry.mjs`
+ `docs/testing-notes/mutation-browser-guards.md`, `scripts/smoke-links.mjs`,
и доки `UX-MODES.md`/`DEVICE-PRESENTATION.md`/`ARCHITECTURE.md`/
`USER-GUIDE.ru.md`/`STATUS.md`/changelog/ledger.

**Гейты, прогнанные мной:**

| Гейт | Команда | Результат |
|---|---|---|
| Статика мутаций | `node scripts/mutation-gate.mjs --check` | PASS, `browser guards: 346/200` (WARN сверх ориентира, как и было до задачи — #699), все определения `ok`, exit 0. Совпадает с финальным docs-коммитом 7f07cb3e (346/200). |
| Сборка (нужна смокам) | `npm run bundle:sync` (= `npm run build` + `bundle-sync`) | PASS, дерево бандла пересобрано для demo/srv |
| Смок AC1/AC3/AC4 | `HP_SMOKE_CHECKS=1 node demo/smoke_info_card_confirm.mjs` | **39/39 PASS** |
| Смок AC2 | `HP_SMOKE_CHECKS=1 node demo/smoke_info_card_context.mjs` | **15/15 PASS** |
| Смок regression (адаптированный) | `node demo/smoke_card_controls.mjs` | PASS (lockNeverToggles, toggles на точный `['light','turn_off','light.ceiling']`) |
| Смок — lock invariant (не в AC-плане, но затронутая поверхность) | `node demo/smoke_lock_invariant.mjs` | PASS |
| Смок, названный в плане ТЗ | `node demo/smoke_household_journeys.mjs` | PASS |

`node --test test/device-toggle.test.mjs test/view-action-context.test.mjs`
не перезапускал отдельно: это подмножество полного `npm test`, уже зелёного
на этом SHA (см. ниже), и оба файла прочитаны построчно — каждый защитный
путь (AC1 projектированный чекбокс, AC2 secure/missing/disabled/unavailable,
AC5 cancel/replace/reentry/throw) имеет явный отрицательный случай внутри
теста, не только утверждение.

**Гейты, не прогнанные мной — и почему:**

- `npx tsc --noEmit`, `npm test` (полный), `npm run build` + `bundle-policy
  --verify` — **не перегонялись отдельно**: Validate на этом точном SHA
  `7f07cb3e` зелёный
  ([run 38675477612](https://github.com/Matysh/houseplan-card/actions/runs/38675477612)),
  это и есть эти гейты (§8, #343). (Полный `npm test`, запущенный мной
  попутно при подготовке смоков через `tsc -p tsconfig.test.json`, не был
  обязателен и не требуется для вердикта — используется только как попутная
  подстраховка, не блокирует эту запись.)
- `npm run golden:verify` (205 сцен) — не прогонял: `ci:golden` закрыт тем же
  Validate-прогоном 38675477612 (автор указывает matrix 74, 205/205 на
  финальном продакшен-билде), а `baselines-index.json`/коммит `c7ebdd07`
  несут корректные трейлер и attestation на точный опубликованный материал
  (см. выше) — пересчитывать не на чем, диф у меня тот же.
- `pytest tests_backend` — не прогонял: диф не касается `custom_components/`
  (Python не изменён).
- `npm run invariants` (model-invariants) — не прогонял: диф не меняет
  геометрию плана/координаты, только toggle-логику и a11y атрибуты бейджа.
- Performance — не назван в AC, не прогонял.
- Полный browser-набор (`smoke-select` — 47 прямых совпадений символов) — не
  прогонял целиком; выбрал для исполнения ровно те смоки, что покрывают
  изменённые защитные пути AC1–AC5 и соседний lock-инвариант, плюс названный
  в ТЗ `smoke_household_journeys.mjs`. Остальные 43 прямых совпадения —
  существующее поведение `_tapConfirm`/`_infoCard`/`stopPropagation` в путях,
  которые этот дифф не трогает по логике (открытие/отмена других диалогов,
  другие режимы); доверяю зелёному Validate для них, выборочно их не
  перегонял.
- Мутанты (nightly outcome) — не исполнялись ни автором, ни мной: это
  отдельный ночной процесс (#709); я проверил, что каждый защитный AC имеет
  статически корректное определение в реестре (`--check` PASS) с патчем,
  действительно нацеленным на изменённую строку (прочитано построчно, не
  по regex).

## Риск по изменённым участкам (#707) — сверка с AC ТЗ

| Класс | Участок | Покрыт ли AC/документом |
|---|---|---|
| devices | `src/device-toggle.ts:479-485` (`infoCardTapConfirmationRequired`, `resolveInfoRowToggleIntent`) | Да — AC1 (видимый/включённый чекбокс, та же проекция, что в `marker-dialog.ts`), AC3 (secure-резолвер единый с `resolveEntity`/`resolvePowerEntity`, lock/alarm возвращают `command: null`), подтверждено `test/device-toggle.test.mjs` (тест `#849 exact row intent cannot inherit…`) и `DEVICE-PRESENTATION.md`. |
| ux | `src/i18n/{de,en,fr,ru}.json:182` (`opening.lock_info_label`) | Да — ключ и тексты совпадают с таблицей i18n в теле ТЗ («Информация о двери и замке» / «Door and lock information»), использован только в `aria-label` бейджа (`houseplan-card.ts`), покрыт AC4 и смоком `badgeHasInformationButtonName`. |

Оба класса из «Риск по изменённым участкам» имеют явную строку в ТЗ и
автотест; открытых вопросов по покрытию нет.

## Находки

Нет. High: 0, Medium: 0, Low: 0.

Рассмотренные, но не ставшие находками:
- Дублирование двух строк (`this._openingInfo = o; this._openingInfoSpace =
  this._space;`) между `@click` и новым `@keydown` у `.oplock` — стилевая
  мелочь, поведение идентично и покрыто тестом по обоим путям; не влияет на
  AC и не создаёт риска расхождения (один литерал, не вычисляемое значение).
  Не записываю как Low.
- Переиспользование `ConfigWriteContext` (исторически «write»-ориентированное
  имя) для identity-фенсинга обычного View-toggle — механически это только
  `connection`/`user` claim, не write-permission gate; ровно то, что требует
  AC2, и явно описано в `ARCHITECTURE.md` («No second authority owner is
  added»). Не дефект.

## Что проверено и корректно

- **AC1.** `infoCardTapConfirmationRequired` читает `device.marker?.tap_confirm
  === true` и `projectedTapAction(...) ∈ {toggle, run}` — тот же предикат,
  что видимость чекбокса в `marker-dialog.ts` (ранее подтверждено
  SPEC-REVIEW-849-r1 построчно). Скрытое `true` при `info`/`more-info`/`none`
  не удовлетворяет условию → строки не спрашивают (`hidden_info/more-info/none`
  в смоке, 3/3 PASS с `modal:false` и диспатчем ровно точного `entity_id`).
  Выключенный видимый чекбокс исполняет напрямую (`disabled_toggle/run`,
  2/2 PASS). `run`-маркер тоже защищает все toggle-строки (`runMarkerAlsoGuardsEveryToggleRow`).
- **AC2.** `_cardToggle` захватывает `authority = this._configWriteContext
  .claim()` и `key = infoCardRowContextKey(device, cardEntities)` **до**
  диалога, а в `execute()` заново резолвит `currentMarkerActionDevice`,
  сверяет `_configWriteContext.current(authority, hass)` и совпадение `key`
  — т.е. отдельно и состав/привязку карточки, и identity HA. Смок
  `smoke_info_card_context.mjs` воспроизводит ровно сценарий из
  owner-находки («второй клик... TypeError») на уровне identity: синтетический
  retained `.click()` после смены connection/user не долетает ни в старую,
  ни в новую authority (`oldConfirmCallsNeitherAuthority`, 4×2 PASS), а
  свежее согласие после смены исполняет ровно один раз
  (`freshCurrentConfirmActsExactlyOnce`). Отдельно: смена только
  `device_id` у явного `controls: ['switch.external']` не отменяет и не
  переадресует команду (`external:*`, положительный контроль сохранён —
  соответствует «решения и открытые вопросы» ТЗ про registry-parent).
  Направление пересчитывается по свежему состоянию (`stateReResolvedToExactRowNotControls`
  возвращает `turn_off` после смены state на `on` между открытием и
  согласием).
- **AC3.** `resolveEntity`→`resolvePowerEntity`/cover-ветка проверяет
  `secureEntity` независимо от домена и до `_cardEntities`, которая вообще
  не кладёт `lock`/`alarm_control_panel` в `kind:'toggle'` (`open` для lock,
  alarm не классифицируется вовсе) — двойная защита, не только фильтр по
  строке. Прямой вызов `c._cardToggle('lock.front_door')` в
  `smoke_card_controls.mjs` и `smoke_lock_invariant.mjs` подтверждает нулевой
  side effect. Бейдж: `@keydown` только при `Enter`/`Space` и только в
  `_mode==='view'`, устанавливает `_openingInfo`, не вызывает `hass.callService`
  — смок `enterOpensOnlyInformation`/`spaceOpensOnlyInformation` зелёный
  (0 calls), отдельная кнопка Unlock сохраняет собственный `hp-confirm`
  (`unlockStillRequiresSeparateConfirmation`).
- **AC4.** `role="button"`, `tabindex="0"`, `aria-label` — только в
  `_mode==='view'`, матчится новым ключом `opening.lock_info_label` во всех
  4 локалях. Реальный `Tab`×80 доходит до бейджа с видимым
  `:focus-visible` (новое CSS-правило в `plan.styles.ts`, не меняющее
  hit-box), ширина/высота измерены и остаются ~14.9375px (<22px) — т.е.
  плоская зона из owner-исключения 3а не расширена. `_startDevicePressFeedback`
  вызывается только внутри `execute()`, т.е. только на реальном dispatch —
  смок проверяет 0 анимаций и при открытии, и при cancel, и при
  retired/changed/unavailable отказах, ровно 1 при фактическом вызове с
  `scale:0.95`/`200ms`.
- **AC5.** `acceptTapConfirmation(confirmation, current, clear)` — чистая
  функция `view-action-context.ts`, вызываемая и из `_acceptTapConfirm`
  (маркерный путь), и из нового `_cardToggle`. Четыре юнит-теста в
  `test/view-action-context.test.mjs` воспроизводят ровно формулировку ТЗ:
  двойной accept вызывает `exec` один раз и чистит state; отменённый/заменённый
  confirmation не исполняется и не трогает чужой; реентерабельный accept
  изнутри `exec` не вызывает повторно и не стирает замену; `throw` внутри
  `exec` не мешает последующему `accept(null)` не упасть повторно (TypeError
  из owner-находки воспроизведён как регрессия и закрыт). Существующий
  мутант `kiosk-retired-confirmation-accepts-new-intent` перенаправлен на
  новое местоположение guard (`view-action-context.ts`) вместо старого
  `houseplan-card.ts` — соответствует факту переноса кода, не новой находке.
- **Golden.** Только 2 из 205 сцен изменились
  (`toggle-entity-dialog-desktop-en`, `toggle-entity-dialog-mobile-ru`) —
  ожидаемо: новые info-card строки появляются в том же диалоге. Коммит несёт
  корректный `Baseline-Reviewed-Local` с attestation на верный source/branch/commit,
  не унаследованный из параллельной `#867`.
- **i18n/docs.** Ключ `opening.lock_info_label` идентичен во всех 4 локалях
  тексту из таблицы ТЗ; `marker.tap_confirm_tip` обновлён согласованно во
  всех 4 локалях, отражая новый контракт («…and switching any row in its
  information card»/рус. аналог) — не оставлена устаревшая подсказка.
  `UX-MODES.md`, `DEVICE-PRESENTATION.md`, `ARCHITECTURE.md`,
  `USER-GUIDE.ru.md`, `STATUS.md` обновлены непротиворечиво друг другу и
  коду; значение «~15 px» фигурирует только как неизменная существующая
  CSS-геометрия (не новое число, не второй источник).
- **Трейлеры/ledger.** Все некоммиты класса A/B несут `Issue:`/`User-Visible`;
  оба `yes`-коммита правят оба changelog в том же коммите; golden-коммит несёт
  `Release:`+`Baseline-Reviewed-Local:`; `docs/release-ledger/v1.80.1/849.json`
  классифицирован как `stable-fix` с обоснованием относительно предыдущего
  stable (v1.80.1 уже содержал дефектное поведение) — согласуется с форматом
  соседних записей каталога.

## Чего не проверял

- Полный `npm test`/`npx tsc --noEmit`/`npm run build`+bundle-verify отдельно
  не гонял (см. «Как проверялось» — зелёный Validate на этом точном SHA уже
  покрывает это; гонка `npm test` у меня была попутной, не обязательной, и
  её результат не влияет на вердикт).
- Полный `golden:verify` (205 сцен) не переисполнял — доверился attestation
  и Validate.
- 43 из 47 прямых smoke-select совпадений (`_infoCard`/`_tapConfirm`/
  `_mode`/`stopPropagation` в несвязанных путях — decor/isometric/kiosk-carousel/
  furniture и т.п.) не перегонял: эти поверхности диф не меняет по коду,
  слабая связь через общее имя символа, не обязанность трека ask по §8.
- `pytest tests_backend`, `npm run invariants`, performance — не прогонял,
  диф их не затрагивает (Python/геометрия/perf AC не названы).
- Ночные mutation outcomes (`execution`/`caught`) — не исполнялись (#709),
  проверена только статика реестра.
- Полевой HA/touch-GPU acceptance — вне ревью кода, headless-доказательства
  (Tab/Enter/Space/реальный coarse-pointer tap) принимаются как заменяющие
  в рамках TOUCH-SUPPORT (desktop — reference, View — гарантированная
  поверхность).

## Вердикт

Все AC1–AC5 доказаны исполняемыми негативными пробами (юнит + смок),
«чем краснеет» заполнено для каждого защитного AC (мутант в реестре либо
отрицательный случай внутри теста). Оба класса риска (#707) из промпта
покрыты строкой ТЗ и автотестом. Трейлеры, changelog и release-ledger в
порядке. Находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/849-view-confirm-a11y`, коммит `7f07cb3e056e` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `757f0b72558a7477a4795f50267aa1cb5f8b2827`
  ```
  git log --all --format='%H %T' | grep 757f0b72558a
  ```
- Тело issue: `6843d34387eea968795a5359670b66ec4546e42ec3eb69ef2bfef6b57affb1cd`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ1MzUsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NjM1fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMjIsIm91dHB1dF90b2tlbnMiOjM0MzM3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE1NDk2NywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjczNjMyOTIsImNvc3RVc2RFc3RpbWF0ZSI6Mi40MzYxNDA0MDAwMDAwMDA2fV0sInR1cm5zIjo2OSwiZHVyYXRpb25NcyI6NzAyMzU2LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi40NDA3NzU0MDAwMDAwMDA2LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=4657 output_tokens=34357 cache_creation_input_tokens=154967 cache_read_input_tokens=7363292 num_turns=69 -->
