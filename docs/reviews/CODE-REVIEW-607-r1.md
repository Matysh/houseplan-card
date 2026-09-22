# CODE-REVIEW-607-r1

## Скоуп

Issue [#607](https://github.com/Matysh/houseplan-card/issues/607) — в реальном
Home Assistant (ветка `ha-dialog` внутри `hp-dialog`, не нативный `<dialog>`
демо-стенда) крестик HA в шапке диалога настроек, за которым следует выбор
«Продолжить» в подтверждении «Отменить изменения?», оставлял диалог невидимым
с живым состоянием формы до перезагрузки страницы. Материал ревью — ровно
`9bbf6fb2487bfef24bfab6da256165d0965c278f`, заход r1, рабочая копия на этом
SHA не менялась. Ревью ТЗ (`SPEC-REVIEW-607-r1.md`) зелёное, продуктового
контракта и AC1–AC4 не отменяет.

Диапазон `origin/dev...HEAD` (база `61d51dd9`, тег стабильного релиза
v1.77.0): один продуктовый файл `src/hp-dialog.ts`, один unit-контракт
(`test/hp-dialog-contract.test.mjs`), расширение существующего смока
(`demo/smoke_dialog_modal_recovery.mjs`), новый явный тяжёлый diagnostic на
настоящем `home-assistant-frontend` (`demo/verify_ha_dialog_discard_recovery.mjs`),
запись исключения в `scripts/check-inputs.mjs`, документация
(`demo/helpers/README-ha-dialog-505.md`, `docs/CHANGELOG.md`,
`docs/CHANGELOG.ru.md`, `docs/STATUS.md`) и сгенерированное дерево (`dist/**`,
`custom_components/houseplan/frontend/**`, `docs/images/screenshots.json`,
`docs/reviews/SPEC-REVIEW-607-r1.md`). Полный трек, скоуп задачи — общий
контракт восстановления `HpDialog.rejectClose()` для четырёх форм настроек;
разбор идёт по всей ТЗ-поверхности, так как это первый заход код-ревью.

## Как проверялось

Дешёвые гейты (`typecheck`, `npm test`, `npm run build` со сверкой копий
бандла) уже подтверждены зелёным Validate на этом же SHA
(https://github.com/Matysh/houseplan-card/actions/runs/35795417282) — не
перегонялись. Сам код прочитан построчно (`src/hp-dialog.ts:449–470, 562–590`)
и сверен построчно с механизмом бага и с контрактом поведения из `## ТЗ`.

Дополнительно, поскольку AC1/AC4 — защитные (реальное восстановление
физического modal, guard против второго `hp-close`, guard против переоткрытия
отсоединённого элемента, идемпотентность повторного `rejectClose()`), гейты,
которые это доказывают, прогнаны мной лично, включая две адресные
отрицательные мутации кода (снята каждая защита по очереди, зафиксирован
красный результат, код возвращён к материалу ревью и перепроверен зелёным):

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck+build (для мутаций) | `npm run build && node scripts/bundle-sync.mjs` | зелёный на материале; использован для двух временных мутаций ниже, дерево возвращено к `9bbf6fb2` (`git status` чист) |
| Основной lifecycle-смок | `node demo/smoke_dialog_modal_recovery.mjs` | зелёный, все 23 проверки `true`, включая три новых для #607 |
| **Мутация 1** — `live(!this._closing)` → `true` (отменяет саму суть фикса) | тот же смок | **красный**: `rejectedHaCloseReopensSameShell: false`, `repeatedRejectIsIdempotent: false` |
| **Мутация 2** — в `rejectClose()` убран `if (this.isConnected)` перед `requestUpdate()` | тот же смок | **красный**: `disconnectedRejectDoesNotReopen: false` |
| Adressный unit-контракт | `node --test test/hp-dialog-contract.test.mjs` | зелёный, 4/4 |
| Четыре формы настроек, нативный fallback (AC3) | `node demo/smoke_device_settings_form.mjs`, `smoke_room_settings_form.mjs`, `smoke_general_settings_form.mjs`, `smoke_space_settings_form.mjs` | все зелёные |
| Настоящий HA-компонент (AC1/AC2), пиновый `home-assistant-frontend==20260729.7` | `node demo/verify_ha_dialog_discard_recovery.mjs` | зелёный: Device/Room/Space/General — Continue сохраняет тот же modal и черновик, ровно один `hp-close` до и ровно ещё один после повтора, Discard и чистое закрытие работают; `pageErrors`/`externalRequests`/`websocketAttempts` пустые |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | — | единственное прямое совпадение — `smoke_dialog_modal_recovery.mjs` (символ `rejectClose`); подтверждает, что выборка выше полна |
| `node scripts/check-docs.mjs` (diff трогает `src/**`) | — | зелёный, 7 файлов / 12 внешних ссылок |
| `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | — | зелёный, 12 добавленных строк в 1 файле, новых `any` нет |
| `npm run bundle:budget` | — | зелёный (initial View 290284 Б при потолке 290900±2000); существующее предупреждение о headroom 10782 < 15000 — долг с #367/#474, не создан этим диффом |
| `docs/images/screenshots.json` | чтение диффа | только `sourceFingerprint`/`sourceSha256` изменились, все `imageSha256` идентичны — подтверждает `docs:accept --identical`, пиксели не менялись |
| Golden (`npm run golden:verify`) | не прогонялся | diff не меняет рендер/геометрию/стили (см. выше), не применимо |
| Инварианты модели | не прогонялись | diff не трогает геометрию, `layout`, `marker.space`, `open_spans`, толщину — не применимо |
| `pytest tests_backend` | не прогонялся | diff не трогает `custom_components/**/*.py` |

**Таблица «чем краснеет» для защитных AC (§2.7):**

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (реальное восстановление modal + черновика) | `demo/smoke_dialog_modal_recovery.mjs` (`rejectedHaCloseReopensSameShell`) + `demo/verify_ha_dialog_discard_recovery.mjs` на настоящем `ha-dialog` | Мутация 1 выше — красный |
| AC4, идемпотентность повторного `rejectClose()` | `demo/smoke_dialog_modal_recovery.mjs` (`repeatedRejectIsIdempotent`) | Мутация 1 выше — красный (тот же прогон) |
| AC4, отсоединённый элемент не переоткрывается | `demo/smoke_dialog_modal_recovery.mjs` (`disconnectedRejectDoesNotReopen`) | Мутация 2 выше — красный |
| AC4, одна попытка закрытия = один `hp-close` (в т.ч. на повторной попытке) | `demo/verify_ha_dialog_discard_recovery.mjs` (`one close before retry`, `retry emits exactly one more close`) на настоящем компоненте | не мутировался отдельно — guard (`if (this._closing) return;`) не тронут этим диффом (существовал до #607); поведение подтверждено дважды подряд на реальном `ha-dialog` |

## Находки

### Medium (в скоупе задачи) — новые guard'ы AC4 проверяются только смоком, но не зарегистрированы в `scripts/mutation-registry.mjs`

Три новых защитных поведения, добавленных этим диффом в
`demo/smoke_dialog_modal_recovery.mjs` (`rejectedHaCloseReopensSameShell`,
`repeatedRejectIsIdempotent`, `disconnectedRejectDoesNotReopen`), проверяются
только этим браузерным смоком — то есть «дорогим гейтом» в терминах
PROCESS.md §2.7: «Мутант в `scripts/mutation-gate.mjs` обязателен, когда
защита живёт в продуктовом коде и проверяется дорогим гейтом (смок, бэкенд,
golden): там ревьюер не воспроизведёт отрицательный прогон второй раз».

Я воспроизвёл этот отрицательный прогон вручную дважды (см. таблицу «чем
краснеет» и Мутации 1–2 выше), но в `scripts/mutation-registry.mjs` для этих
трёх новых поведений записи нет — при том, что для того же файла и того же
смока в реестре уже есть ровно такой шаблон для аналогичных guard'ов #463
(`dialog-native-update-recovery-disabled`, `dialog-native-reconnect-recovery-disabled`,
и ещё два соседних `id`). Без записи в реестре штатный CI-гейт мутаций никогда
не прогонит эти две конкретные мутации снова: регресс, который тихо уберёт
`live(!this._closing)` или `if (this.isConnected)` в `rejectClose()`, для
CI будет неотличим от рефакторинга, пока кто-то не повторит ровно ту же ручную
проверку, что и я сейчас.

**Воспроизведение находки** (не бага — процессного пробела): `grep -n
"hp-dialog.ts" scripts/mutation-registry.mjs` не показывает записи с `id`,
упоминающим #607, `_closing` или `live`; четыре существующих `id` вида
`dialog-native-*` относятся только к #463.

Чинится в этой же задаче: два `id` по образцу существующих
`dialog-native-*-disabled` записей, `guard: 'node demo/smoke_dialog_modal_recovery.mjs'`,
патчи — ровно те два, что я использовал для Мутаций 1 и 2 выше. Без High —
это не блокирует, но остаётся Medium в скоупе (правится в этом issue, не
отдельным issue: правка тривиальна и материал уже есть в этом документе).

## Что проверено и корректно

- **Контракт поведения ТЗ, пункты 1–2, 7** (`src/hp-dialog.ts:449–470,
  562–590`): `_requestClose` явно коммитит фазу `_closing=true` через
  `requestUpdate()` до диспетча `hp-close`; `rejectClose()` сбрасывает
  `_closing=false` и снова обновляется; оба рендера `ha-dialog` используют
  `.open=${live(!this._closing)}`. Директива `live()` сверяется с фактическим
  DOM-свойством, а не с последним значением, переданным Lit, поэтому
  переход `false → true` реально долетает до `ha-dialog`, даже когда внешний
  `wa-dialog` уже скрылся вне цикла обновления Lit — ровно то, что описано в
  «Проблема» и «Механизм». Нативный fallback (`<dialog>`) не тронут диффом
  вообще — пункт 7 выполняется тривиально.
- **AC1/AC2 на настоящем компоненте**: `demo/verify_ha_dialog_discard_recovery.mjs`
  запущен лично на пиновом `home-assistant-frontend==20260729.7` (скачан по
  зафиксированному URL, sha256 из `HA_DIALOG_PIN` совпал) для всех четырёх
  форм (marker/room/space/settings). Continue восстанавливает тот же
  физический modal с тем же изменённым черновиком; Discard и чистое закрытие
  работают без регрессии; `pageErrors`, `externalRequests`, `websocketAttempts`
  пустые — офлайн-изоляция фикстуры #505 не нарушена.
- **AC3, нативный fallback**: все четыре `smoke_*_settings_form` зелёные,
  плюс основной `smoke_dialog_modal_recovery.mjs` подтверждает, что нативная
  ветка (`earlyFallbackReadyForLateRegistration`,
  `openFallbackDoesNotSwitchAfterLateHaRegistration`,
  `wideNativeFallbackFitsAndCentresOnNarrowViewport` и т.д.) не задета.
- **AC4, защита жизненного цикла**: подтверждена поведенчески (не только
  чтением) двумя целевыми мутациями кода — см. таблицу «чем краснеет» выше.
  Guard против второго `hp-close` за одну попытку закрытия (`if
  (this._closing) return;`) не тронут этим диффом и дважды подтверждён на
  настоящем компоненте (`one close before retry` / `retry emits exactly one
  more close`).
- **Скоуп и не-скоуп ТЗ**: diff не меняет тексты, расположение кнопок, логику
  Save/Discard, конфигурацию, backend, onboarding или версию закреплённого HA
  frontend — совпадает с разделом «Не входит».
- **i18n**: новых или изменённых ключей нет — подтверждено `git diff` (нет
  изменений в `src/i18n/**`).
- **Документация в том же коммите**: `docs/CHANGELOG.md` и
  `docs/CHANGELOG.ru.md` оба получили запись со ссылкой на #607 в коммите
  `9bbf6fb2`, соответствует трейлеру `User-Visible: yes`. `docs/STATUS.md`
  обновлён (снимок и раздел Dialog UX). `demo/helpers/README-ha-dialog-505.md`
  документирует новый diagnostic.
- **`scripts/check-inputs.mjs`**: новый тяжёлый diagnostic явно исключён из
  обычного Validate («запускается человеком») — соответствует плану ТЗ
  («явный diagnostic вместо общего полного smoke-набора»).
- **Golden/скриншоты**: `docs/images/screenshots.json` показывает только
  изменение `sourceFingerprint`/`sourceSha256`; все `imageSha256` идентичны —
  никакой визуальный кадр не изменился, `docs:accept --identical` — корректный
  путь принятия.
- **Bundle budget**: `npm run bundle:budget` зелёный, headroom-предупреждение
  — существующий долг (#367/#474), не создан этим диффом (добавлен только
  один маленький импорт `lit/directives/live.js`).
- **`no-new-any`**: 0 новых `any` на 12 добавленных строках.
- **Трейлеры и трассируемость**: коммит `9bbf6fb2` несёт `Issue: #607` и
  `User-Visible: yes`; issue помечен `bug`/`P1`/`S7-code-review`.

## Чего не проверял

- Полный `npm test` / `npx tsc --noEmit` / `npm run build` с посимвольной
  сверкой трёх копий бандла — не перегонял отдельно: зелёный Validate на
  точном SHA уже это покрывает (ссылка выше); вместо этого прогнал точечный
  `node --test test/hp-dialog-contract.test.mjs` и дважды полный
  `npm run build && node scripts/bundle-sync.mjs` для собственных мутаций.
- `npm run golden:verify`, `python -m pytest tests_backend`, инварианты
  модели (`npm run invariants`/`model-invariants.mjs`) — не применимы: diff
  не меняет рендер, Python-бэкенд или геометрию/ссылки на неё.
- Полный набор из 260 браузерных смоков — не прогонял; `smoke-select.mjs`
  называет ровно один прямой смок, остальные (4 form-смока) выбраны по AC3
  явно из текста ТЗ, а не по инструменту.
- Ручное тестирование в реальном браузере Home Assistant (живой инстанс,
  не пиновая офлайн-фикстура) — вне гейтов цикла ревью по PROCESS.md;
  замена — исполненный `demo/verify_ha_dialog_discard_recovery.mjs` на
  настоящем frontend-пакете, что и есть предусмотренное ТЗ доказательство.

## Вердикт

Один Medium в скоупе задачи (реестр мутаций не пополнен для новых guard'ов
AC4), High нет. По правилу §2.7/§3.8 это жёлтый вердикт — задача возвращается
автору на правку в том же issue, без нового цикла лимита (Medium без High).

---

**Материал раунда:** SHA `9bbf6fb2487bfef24bfab6da256165d0965c278f`, диапазон
`origin/dev (61d51dd9)...HEAD`. Рабочая копия временно мутировалась дважды для
негативных проб (см. таблицу «Как проверялось») и была возвращена к этому SHA
перед выводом (`git status` чист).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/607-ha-dialog-close`, коммит `9bbf6fb2487b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `62136a4b9d9e58155ead9d47f39421126d2c636c`
  ```
  git log --all --format='%H %T' | grep 62136a4b9d9e
  ```
- Тело issue: `c78f51ffc0d5268ea3a82d980f9061b9f2756d0a850072fec514342889af8c9e`
- Вердикт конвейера: `yellow` · High 0
