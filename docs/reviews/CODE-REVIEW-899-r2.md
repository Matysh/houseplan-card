# CODE-REVIEW-899-r2

## Скоуп

Issue #899 — ночной прогон мутаций на `dev`@`0dd6e8ec` красный: 5 сбежавших
мутантов, 3 свидетеля без доказательства, 2 шарда упёрлись в часовой timeout.
Задача инфраструктурная (класс B/C, без A/D), трек `show`.

Это заход r2, блокирующий цикл 1/2. В r1 — один High (H1): новый LED-смок
(`demo/smoke_led_strip_glow.mjs`, введён в `e239e2eb`) падал в 2 из 5 прогонов
подряд на точном материале задачи из-за гонки между персистентной камерой
этажа и кликом по `zoom-fit` перед cold-dialog сценой. Маршрут r1 — `fix`.

Материал ревью — ровно `603fc815d3f5deba0efce883e8fbd9a2504b72e6`. Делта к
материалу r1 (`ed4bd3d6`) — один новый коммит `603fc815` (+66/−5,
`demo/smoke_led_strip_glow.mjs` и `docs/STATUS.md`), адресующий ровно H1.
Остальной диапазон (`e239e2eb`, `ed4bd3d6`) не менялся с r1.

## Как проверялось

Дешёвые гейты подтверждены Validate на `603fc815`
(https://github.com/Matysh/houseplan-card/actions/runs/38711777646, success)
— `npx tsc --noEmit`, `npm test`, `npm run build` повторно не гонялись.

Сам прогнал (ровно по риску диффа — делта трогает только сам LED-смок,
тот самый файл, где была находка H1):

- `npm run build && node scripts/bundle-sync.mjs` → бандл собран.
- `HP_SMOKE_CHECKS=1 node demo/smoke_led_strip_glow.mjs` на точном материале
  `603fc815` (тот же пин Chromium `chromium_headless_shell-1234`,
  151.0.7922.34) — **прогнан 5 раз подряд, 5 из 5 зелёные** (`OK`, без
  `FAILED`, все 154 ожидаемых имени присутствуют в каждом прогоне, включая обе
  проверки, которые краснели в r1: «#899 cold LED conversion starts with the
  intended device dialog» и «the press loads the tool and draws for the same
  marker»). Логи — `/tmp/led-run-{1..5}.log` в рабочей копии ревьюера (не
  артефакт CI).
- Прочитан диф `603fc815` построчно и сопоставлен с продуктовым кодом:
  `data-hp-state`/`data-hp-mode` (`src/houseplan-card.ts:10657-10805`),
  класс `mode-transition` и `?inert=${this._modeTransitionBusy}`
  (`src/houseplan-card.ts:10919,10922`), ключ localStorage `LS_ZOOM =
  'houseplan_card_zoom_v1'` (`src/houseplan-card.ts:409`) — все три публичных
  сигнала, на которые теперь опирается смок, реальны и соответствуют описанию
  в коммите; это не новый приватный test-only хук.
- `node scripts/no-new-private-writes.mjs --base origin/dev --head HEAD` →
  «Новых записей в приватное состояние карточки нет» (161 добавленная строка
  в 1 demo-файле проверены).
- `node scripts/no-new-any.mjs --base origin/dev --head HEAD` → 0 новых `any`
  (диапазон `src/**` в этом коммите не тронут).
- Проверено, что `smoke_led_strip_glow.mjs` не входит в
  `NATIVE_CHECK_FLOORS` (`scripts/candidate-native.mjs`) — три новых имени
  проверок не ломают native-candidate gate, т.к. этот смок в нём не участвует.

Не прогонял повторно: `pytest tests_backend`, `npm run invariants`,
performance, golden — причины те же, что в r1 (Python/геометрия/рендер не
тронуты этим диапазоном, `ci:golden` не поднят). Остальные демо-смоки,
`test/*.test.mjs` и `mutation-gate.mjs --check` — не перепрогонял: дельта
r2 их не касается, и они уже зафиксированы Validate на этом SHA и
статическим приемом в r1 для неизменных файлов.

## Находки

Новых находок нет. H1 из r1 закрыт.

## Закрытие раунда r1

| находка | чем закрыта | где это видно |
|---|---|---|
| H1 — LED-смок нестабилен: 2/5 падений на точном материале задачи из-за гонки персистентной камеры этажа и клика `zoom-fit` перед cold-dialog сценой | `603fc815`: сцена больше не полагается на `settled()` сразу после клика. Вместо этого (1) после `reload()` явно ждёт `ha-card[data-hp-state="ready"][data-hp-mode="view"]` и `.stage` без `hpboot`/`mode-transition`/`inert`, снимая пробу `savedZoom !== 1` (камера пинча ещё жива); (2) после клика `zoom-fit` ждёт **и** `localStorage` `houseplan_card_zoom_v1.f1 === 1`, **и** то же ready/view-состояние, прежде чем читать `fittedView`; (3) после `setMode('devices')` ждёт `ha-card[data-hp-state="ready"][data-hp-mode="devices"]` без `mode-transition`/`inert`, прежде чем открывать диалог `d_tv`. Именно отсутствие второго ожидания (пункт 2) было корнем гонки в r1 — клик и `settled()` не гарантировали, что персистентная запись зума в `localStorage` уже произошла и не перезапишет Fit позже. | `demo/smoke_led_strip_glow.mjs` (diff `603fc815`, строки после `await page.reload()` до `check('#899 cold LED conversion starts with the intended device dialog', ...)`); подтверждено 5 моих независимых прогонов (5/5 PASS) поверх заявленных автором 5/5 прогонов (`artifacts/899-r1-fixed-whole-{1..5}.log` в комментарии автора) — итого 10 подряд чистых прогонов на фиксированном материале против 2/5 падений до фикса. |

## Унаследовано из r1

Принято без повторной проверки (материал и окружение не изменились с r1,
делта `603fc815` их не касается):

- 20 детерминированных modulo-шардов вместо 10 (workflow, CLI-дефолт,
  тесты на покрытие/делители) — `scripts/mutation-registry.mjs`,
  `test/mutation-shards-899.test.mjs`, документ r1, SHA `ed4bd3d6`.
- Три «невалидных» определения мутантов (unreachable-code фикс) —
  `src/device-signal.ts:79`, `src/zigbee-topology.ts`, `src/new-device-ack.ts:32`,
  документ r1, SHA `ed4bd3d6`.
- Четыре «сбежавших» определения, кроме LED-гварда (
  `view-edit-late-import-forgets-recheck`, `snapshot-battery-read-untracked`,
  `core-budget-ignores-growth`,
  `signal-snapshot-forgets-sibling-with-battery-off`) — документ r1,
  SHA `ed4bd3d6`/`e239e2eb`.
- Перенос четырёх метаданных-кейсов в `test/mutation-gate.test.mjs` и удаление
  запрещённого text-anchor файла — документ r1, SHA `ed4bd3d6`.
- `docs/release-ledger/v1.80.1/899.json` — категория `infra`, обоснование
  относительно v1.80.1 — документ r1, не менялся в r2.
- Трейлеры `Issue: #899` и `User-Visible: no` на всех трёх коммитах диапазона
  — корректно, changelog не требуется.
- 97/97 PASS по `test/device-signal.test.mjs test/mutation-gate.test.mjs
  test/mutation-shards-899.test.mjs` — документ r1, SHA `ed4bd3d6`; делта r2
  этих файлов не трогает.

## Что проверено и корректно

- Фикс H1 воспроизводимо закрывает найденную гонку (см. таблицу выше),
  использует только публичные сигналы продукта, не вводит новых приватных
  test-хуков и не ослабляет существующие ожидания (`!readyDevices.stage
  .includes('mode-transition')`, явный `savedZoom !== 1` precondition и т.д.
  — все 151 прежних и 134 исходных LED-проверок сохранены, добавлены ровно
  3 именованных readiness-проверки, итого 154 — подтверждено списком имён в
  моих прогонах).
- `docs/STATUS.md` обновлён в том же коммите с описанием нового ожидания
  («The cold LED guard waits for the revealed View, the public Fit command's
  saved base zoom and interactive Devices DOM») — соответствует коду.
- Диапазон делты r2 (`603fc815`) ограничен ровно тем файлом и той сценой, где
  была находка — нет побочных изменений в продуктовом коде, реестре мутаций
  или release-ledger.
- Критерии §5 (трек `show`) по-прежнему пройдены: одна поверхность
  (ночной mutation-gate и его guard'ы), без миграции конфига, без нового
  UX-контракта, без влияния на производительность/touch, ожидаемое поведение
  зафиксировано в самом отчёте/issue. `route: fix`.

## Чего не проверял

- Полный ночной мутационный прогон на 20 шардах — по-прежнему не гоняется ни
  на одном треке при разработке; подтвердит только следующая запланированная
  ночь.
- `pytest tests_backend`, `npm run invariants`, performance, golden — причины
  не изменились с r1 (ничего из этого делта не затрагивает).
- `npx tsc --noEmit`, `npm test`, `npm run build` целиком — зелёный Validate
  на точном SHA `603fc815` уже подтверждён (ссылка выше), повторный прогон
  избыточен.
- Остальные демо-смоки (`smoke_view_edit_permissions.mjs` и т.д.) — делта r2
  их не трогает, причины те же, что в r1.
- Устойчивость фикса за пределами 10 подряд прогонов (5 моих + 5 авторских) —
  гонка статистическая; структурный аргумент (явное ожидание персистентного
  значения в `localStorage`, а не предположение о его синхронности) сильнее
  самого факта отсутствия повторов, но абсолютной гарантии 10 прогонов не
  дают. Если гонка когда-либо вернётся, её поймает ночной прогон
  `led-pinch-calls-action` — это и есть предназначение задачи #899.

## Вердикт

H1 закрыт, новых находок нет. Критерии §5 трека `show` пройдены (одна
поверхность, без миграции, без нового UX-контракта, без влияния на
производительность/touch, поведение зафиксировано в отчёте) — как и в r1.

`route: fix` (зелёный вердикт не формирует цикл и не требует reclassify).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/899-nightly-mutation-evidence`, коммит `603fc815d3f5` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `9818028b1019cfe7c4fa3a059b94990ed256ed3d`
  ```
  git log --all --format='%H %T' | grep 9818028b1019
  ```
- Тело issue: `37902d69ba795d38be4a799b213aebc17cef4b9474527e6df678ced1c65f576b`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ1OTYsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0Njg2fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo2NCwib3V0cHV0X3Rva2VucyI6MTgwNTgsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6NzM5NzAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoyMDU3MzU3LCJjb3N0VXNkRXN0aW1hdGUiOjAuODg4MDU5NH1dLCJ0dXJucyI6MzksImR1cmF0aW9uTXMiOjQ1MTQ3NiwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuODkyNzQ1NCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4660 output_tokens=18076 cache_creation_input_tokens=73970 cache_read_input_tokens=2057357 num_turns=39 -->
