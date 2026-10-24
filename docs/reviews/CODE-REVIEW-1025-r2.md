# CODE-REVIEW-1025-r2

Issue: [#1025](https://github.com/Matysh/houseplan-card/issues/1025) «Редакторы: сдвиг стен, проёмов и устройств клавишами-стрелками»
Трек: `ask` · Этап: code · Заход: r2 · блокирующих циклов 1/4
Материал: `0d718483b8814b664fdadfc1a6e54e39e220543d` (рабочая копия на нём, `git rev-parse HEAD` сверен)
Побочные находки: mode=issues (снимок политики подтверждён, расхождений нет)

## Скоуп

Ревью по дельте (§2.10): предыдущий материал —
`4470fa350c04b79d73cdeb4fb20d53e2443d72c7` (r1). Делта до текущего HEAD —
два коммита, три файла, **только класс C (документация)**:

```
git diff 4470fa350c04b79d73cdeb4fb20d53e2443d72c7..HEAD --stat
 docs/development-notes/editor-nudge-integration.json | 47 +++++++
 docs/release-ledger/v1.82.0/1025.json                 |  4 +-
 docs/reviews/CODE-REVIEW-1025-r1.md                   | 191 ++++++++++++
 3 files changed, 240 insertions(+), 2 deletions(-)
```

`src/**`, `test/**`, `demo/**`, `scripts/**` **не затронуты** со времени r1.
Единственная задача раунда — проверить, закрыта ли единственная Medium-находка
r1 (неверная классификация release-ledger), и что докс-правка не внесла новых
дефектов и не затронула ни один AC ТЗ по существу.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Medium (в скоупе): `docs/release-ledger/v1.82.0/1025.json` имел `category: "stable-fix"`, хотя стрелочный перенос стен/проёмов/устройств отсутствовал в v1.82.0 полностью (была только Decor-стрелка, #447) — по определению PROCESS.md §11.9 это `major`, как и сравнимые прецеденты `1003.json`/`1035.json`/`1049.json`. | Коммит `0d718483b` меняет `category` → `"major"` и переписывает `rationale`: «Stable v1.82.0 supports arrow-key movement only for Decor (#447); Plan walls/openings and Devices have no keyboard translation. This adds a new user capability for those editors… Reusing existing physical and CAS writers does not make the new input behavior a fix to a capability already present in stable.» Формулировка прямо отвечает на довод r1 (reuse writer’а ≠ адрес классификации), а не просто меняет слово. | `git diff 4470fa350c04b79d73cdeb4fb20d53e2443d72c7..HEAD -- docs/release-ledger/v1.82.0/1025.json`; текущее содержимое файла в HEAD. |

Сверка с прецедентами, на которые r1 ссылался, подтверждает единообразие:
`1003.json`/`1035.json`/`1049.json` — все `major` за «расширение существующего
механизма на новый пользовательский охват»; новый `rationale` 1025.json
использует тот же критерий («v1.82.0 did not have this capability»), не
техническую реализацию. Других открытых находок r1 не было (High: 0).

Сопроводительная запись `docs/development-notes/editor-nudge-integration.json`
(`codeR1Followup`) честно фиксирует нулевой дифф по продукту/тестам
(`"productAndTestChanges": 0, "bodyOrAcChanges": 0`) — проверено: дельта
действительно ограничена тремя docs-файлами (см. скоуп выше), заявление не
голословно.

## Унаследовано из r1 (без повторной проверки)

Документ `docs/reviews/CODE-REVIEW-1025-r1.md`, материал
`4470fa350c04b79d73cdeb4fb20d53e2443d72c7` — весь продуктовый код, тесты и
смоки этого раунда идентичны r1 (дельта не их касается), поэтому принимается
без повторного исполнения:

- Полное покрытие AC1–AC12 таблицей «чем доказан / чем краснеет», пустых
  третьих столбцов нет.
- Риск по изменённым участкам (#707, geometry) —
  `src/device-contact-write.ts:62-63`, токен `canonicalizePosition`: класс
  закрыт в r1 (unit `test/editor-nudge.test.mjs:72-78` + смоки
  `nudge.contact_selected_effective_one_cell` /
  `nudge.contact_other_effective_anchor_fixed` /
  `nudge.wall_contact_zoom_keeps_full_world_step`). Файл не менялся со времени
  r1 — повторный разбор не требуется (§2.10: пригодный неизменившийся check не
  повторять).
- Раздел «Что проверено и корректно» r1 (топология связанности,
  доминирующая ось 45°, фильтрация Ctrl/Meta/Alt и Shadow DOM,
  guard-цепочка AC10, трейлеры, USER-GUIDE/ARCHITECTURE/STATUS) — код не
  менялся, выводы переносятся без повторного чтения исходников.
- Инвариант геометрии (`npm run invariants` эквивалент через
  `model-invariants.mjs`), прогнанный ревьюером r1 адресно на `free`/`door`
  фикстурах — зафиксирован в r1-документе и в `codeR1Followup.reviewerGeometryProof`
  текущего HEAD; геометрия с тех пор не менялась.

## Как проверялось в r2

**Принятый validate-gate для точного материала HEAD** —
https://github.com/Matysh/houseplan-card/actions/runs/40112600483
(`headSha=0d718483b8814b664fdadfc1a6e54e39e220543d`, conclusion success).
Проверил состав job’ов, не только зелёную метку:

| Job | Результат | Значение для r2 |
|---|---|---|
| Классификация изменённых файлов | success | подтверждает, что дифф r1→r2 — docs-only (class C) |
| Предполёт: документация, провенанс, процесс | success | трейлеры `Issue:#1025`/`User-Visible:no` на обоих коммитах, формат JSON release-ledger |
| Переиспользование: это дерево уже проверено | success | конвейер сам распознал, что продуктовое дерево не изменилось с принятого r1-прогона — повторный полный Validate не требуется |
| Фронтенд: типы/юниты/мутанты/синхрон бандла | success (reused) | не затронуто дельтой |
| Продукт: свежие проверки диапазона и упаковки | success (reused) | не затронуто дельтой |
| Браузер: выбранные проверки push | success (reused) | не затронуто дельтой |
| Мутанты по диффу / Golden / Смоки в браузере / Perf / Бэкенд pytest / HACS / Hassfest / Geometry parity | skipped | ожидаемо: дифф не product/geometry/Python/visual — см. «Чего не проверял» |

**Адресные проверки, которые я прогнал сам** (единственный реальный пробел —
изменённый `release-ledger` JSON и сопутствующая notes-запись, не покрытые
отдельной job-строкой выше кроме предполёта):

```
node --test test/release-ledger.test.mjs
# 6 pass, 0 fail — "missing, stale and unjustified classifications cannot be guessed" зелёный на новой category=major

node --test test/release-contract.test.mjs test/task-delivery-903.test.mjs
# 56 pass, 0 fail

node --test test/user-stable-changelog.test.mjs test/release-narrative.test.mjs
# 14 pass, 0 fail — генерация пользовательского changelog не ломается на major-категории этой задачи

node -e "JSON.parse(readFileSync('docs/release-ledger/v1.82.0/1025.json'));
         JSON.parse(readFileSync('docs/development-notes/editor-nudge-integration.json'))"
# both valid JSON
```

Все три набора читают структуру release-ledger/changelog, которую как раз
меняет дельта — это адресный пробел по изменённому файлу (§8), не повтор
общего гейта.

**Не прогонял и почему:** `npm test`/`gate:small`/полный browser-план/Golden/
HA pytest/мутанты ночным прогоном — дельта не трогает `src/**`, `test/**`
(кроме уже упомянутых targeted release-ledger тестов), `demo/**`; validate-gate
на этом же SHA сам пришёл к выводу «дерево уже проверено» и пропустил
product/visual/backend шаги как неприменимые — переисполнение было бы
неадресным повтором (§8, «review-light proof is complete»).

## Находки

Нет. High: 0, Medium: 0.

## Что проверено и корректно

- Новая классификация `major` сформулирована по правильному критерию
  (видел ли пользователь возможность в предыдущем stable), а не по тому, что
  реализация переиспользует существующие writer’ы — именно тот довод, который
  r1 указал как ошибку. Текст rationale ссылается на конкретный факт
  (`#447` — единственная существовавшая Decor-стрелка) вместо общей фразы.
- `category: "major"` единообразна с прецедентами той же линии (`1003`,
  `1035`, `1049`) — все три расширяют существующий механизм на новый охват и
  классифицированы `major` по тому же принципу.
- `summary.ru`/`summary.en` не изменились и остаются точным описанием
  пользовательского эффекта — смена категории не требовала переписывать текст,
  который уже был корректен.
- Оба коммита дельты (`e494ec5c0`, `0d718483b`) несут `Issue: #1025` и
  `User-Visible: no`; `User-Visible: no` корректна — видимое пользователю число
  или текст в этой дельте не меняется (меняется только внутренняя
  release-категория и служебная notes-запись), поэтому требование «оба
  changelog в этом же коммите» не применяется.
- `codeR1Followup` в `editor-nudge-integration.json` зафиксировал факт
  нулевого продуктового/тестового диффа (`productAndTestChanges: 0`,
  `bodyOrAcChanges: 0`) — проверил сам по `git diff --stat`, заявление верно.
- JSON обоих изменённых файлов синтаксически валиден, целевые release-ledger/
  changelog-тесты зелёные на новой категории.

## Чего не проверял

- Полный `npm test`, `gate:small`, полный browser-план, Golden-матрица, HA
  pytest, исполнение зарегистрированных мутантов — вне объёма: дельта r1→r2
  не трогает `src/**`/`demo/**`/`custom_components/**`, а validate-gate на
  этом же SHA сам отметил дерево как уже проверенное и пропустил эти job’и
  как неприменимые (§8).
- Ни один зарегистрированный мутант не исполнялся — запрещено вне ночного
  workflow (#709, #905); в этом раунде и не требовалось — AC-защита
  (мутанты `keyboard-connected-wall-detaches-1025`,
  `keyboard-opening-45-uses-vertical-1025`,
  `keyboard-device-selection-keeps-old-control-focus-1025`,
  `keyboard-layout-late-ack-regresses-revision-1025`) унаследована из r1
  без изменений кода, который они покрывают.
- Ручная dev/GPU-приёмка владельцем не проводилась и не является условием
  (REVIEWER.md, «Позиция ревьюера»).
- Фактический текст release-changelog стабильного релиза (emoji/жирный пункт
  для `major`) не генерировался и не проверялся — это задача релизного
  тулинга перед бетой, не этого ревью; проверено только то, что категория в
  ledger теперь корректна и не ломает тесты, которые читают этот ledger.

## Вердикт

Единственная Medium-находка r1 закрыта точным и обоснованным изменением
(`category: "major"` с rationale, отвечающим на довод ревью), дельта не вносит
нового кода и не задевает ни один AC по существу, адресные release-ledger/
changelog-тесты зелёные на новой категории. High: 0, Medium: 0.

---

<!-- material-anchors: заполняется конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1025-editor-keyboard-nudge`, коммит `0d718483b8814b664fdadfc1a6e54e39e220543d`.
- Предыдущий материал (r1): `4470fa350c04b79d73cdeb4fb20d53e2443d72c7`,
  документ `docs/reviews/CODE-REVIEW-1025-r1.md`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1025-editor-keyboard-nudge`, коммит `0d718483b881` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `21b6ca1c68ba95c229d17a3e39de0105fd55d77d`
  ```
  git log --all --format='%H %T' | grep 21b6ca1c68ba
  ```
- Тело issue: `5e7b2f41ff57149449ef4262ce67c50035c8ecfd3f02802c472bd6caa0dcd261`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ4NjcsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0OTYxOTk5OTk5OTk5OTk5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo0OCwib3V0cHV0X3Rva2VucyI6MTQ4OTcsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6Nzc4MTIsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxODM0MTIwLCJjb3N0VXNkRXN0aW1hdGUiOjAuODI3MTM3OTk5OTk5OTk5OX1dLCJ0dXJucyI6MjksImR1cmF0aW9uTXMiOjE5MjU2OCwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuODMyMSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4915 output_tokens=14916 cache_creation_input_tokens=77812 cache_read_input_tokens=1834120 num_turns=29 -->
