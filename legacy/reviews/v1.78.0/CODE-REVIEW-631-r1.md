# CODE-REVIEW — issue #631, заход r1

Материал: `36f0db6e1ae9388ff31e84cdb7cbae26545d38f9` (рабочая копия на нём, детач HEAD).
Диапазон: `origin/dev..HEAD`, один коммит:
`test(editors): unit contracts for dialog baselines and form problems (#631)`.

## Скоуп

Класс B (инфраструктурный трек, `src/**` не тронут — подтверждено `git diff
origin/dev...HEAD --stat`, только 4 файла): `tsconfig.test.json`,
`test/dialog-baseline.test.mjs`, `test/dialog-form-problems.test.mjs`,
`scripts/mutation-registry.mjs`. Задача: покрыть юнитами `dialog-baseline.ts`
(`stableKey`, `dialogDirty`, warm-перенос) и четыре `*-form-state.ts`
(`*Problems`), которые раньше были доказаны только браузерными смоками и
мутантами с гардами на те же смоки, и перевести три существующих мутанта на
юнит-гарды.

Трейлеры коммита: `Issue: #631`, `User-Visible: no` — оба на месте. При
`User-Visible: no` правка обоих changelog не требуется; ни один changelog в
диффе не тронут — согласовано.

Продуктовая рамка (SCOPE.md): задача не добавляет пользовательского
поведения, это укрепление доказательной базы существующего контракта
Save/dirty (относится к J6 «Keep the plan true as the home evolves» —
уверенность в том, что редакторы ведут себя как задокументировано). Класс B
такой рамки не требует по существу, отклонений от неё нет.

## Как проверялось

1. Прочитан код без исполнения: `src/editors/dialog-baseline.ts`,
   `space-form-state.ts`, `general-form-state.ts`, `marker-form-state.ts`,
   `room-form-state.ts` (все — не в диффе, сверены построчно с утверждениями
   новых тестов: транзиентные наборы, порядок ошибок, условия create/edit).
2. Собран `test-build` (`npx tsc -p tsconfig.test.json && node
   scripts/fix-test-build.mjs`) и прогнаны сами тесты:
   `node --test test/dialog-baseline.test.mjs test/dialog-form-problems.test.mjs`
   → pass 25, fail 0 (совпадает с числом автора).
3. «Тест умеет падать» — не декларативно, а прогоном:
   - Все 9 мутантов, названных в AC3/новых контрактах, прогнаны индивидуально
     через `node scripts/mutation-gate.mjs --id=<id>`:
     `dialog-baseline-key-order-sensitive`, `dialog-baseline-missing-reads-clean`,
     `space-dialog-key-counts-raw-scale-input`, `room-draft-key-drops-label-scale`,
     `room-create-ignores-area`, `marker-ha-binding-accepts-virtual`,
     `general-required-number-falls-back-to-hidden-value`,
     `space-required-temperature-forgets-raw-draft`,
     `marker-virtual-name-remains-a-late-toast` — все девять «поймано 1 из 1».
   - `node scripts/mutation-gate.mjs --check` (статическая проверка якорей
     реестра) — rc 0, без ошибок.
   - Дополнительно проверен участок, для которого в реестре нет отдельного
     мутанта — контракт «вложенный объект сравнивается как есть» в
     `stableKey` (тест `#631 stableKey: nested objects…`, строки 79–91). Я
     вручную пропатчил `stableKey` на рекурсивную нормализацию вложенных
     ключей (правдоподобная ошибочная реализация) и убедился, что именно
     этот тест краснеет (`AssertionError`, `notStrictEqual`), затем откатил
     патч (`git status` после отката — чистый) и пересобрал `test-build`.
     Это не пробел AC3 (AC3 требует перевода гардов существующих мутантов, а
     не мутанта на каждую фразу AC1) — просто эта конкретная ветка теста не
     зарегистрирована в реестре, но нефиктивна.
4. `node scripts/smoke-select.mjs --base origin/dev --head HEAD` →
   «Исполняемого frontend-диффа нет… Browser-smoke этим диффом не
   выбираются». Согласуется с тем, что `src/**` не менялся и рендер не
   затронут — смоки не нужны.
5. `node scripts/process-gate.mjs` → «гейт пройден, предупреждений 0» (без
   `--issues`, как и заявлено автором).
6. Дешёвые гейты (`npx tsc --noEmit`, `npm test` полностью, `npm run build` со
   сверкой бандла) не перегонялись — они уже подтверждены зелёным Validate на
   этом же SHA `36f0db6e` (https://github.com/Matysh/houseplan-card/actions/runs/35942748069).
   Целевые юнит-файлы из этого прогона я перепрогнал отдельно (см. п.2) как
   часть проверки конкретных находок задачи, а не для замены Validate.

## Соответствие AC

- **AC1** (одинаковые черновики с разным порядком ключей — не dirty;
  транзиентные ключи каждого диалога игнорируются; вложенный объект — как
  есть, выбор задокументирован; без снимка → dirty): доказано юнитами в
  `dialog-baseline.test.mjs` и подтверждено чтением четырёх
  `*-form-state.ts` — наборы транзиентных ключей в тестах совпадают
  дословно с константами в коде (`SPACE_DIALOG_TRANSIENT_KEYS`,
  `TRANSIENT` в general, `MARKER_DIALOG_TRANSIENT_KEYS`, десять полей
  `roomDraftKey`). Выбор по вложенным объектам зафиксирован комментарием в
  тесте (стр. 80–84) и в src (`stableKey` doc-комментарий). Мутационно
  доказаны 3 из 4 пунктов (порядок ключей, транзиентность per-диалог, no
  baseline → dirty); четвёртый (вложенные объекты) проверен вручную по п.3
  выше и падает на правдоподобной мутации.
- **AC2** (тесты `*Problems` на каждый код ошибки и на пустой список):
  выполнено для всех четырёх форм в `dialog-form-problems.test.mjs`,
  включая совместный порядок кодов («все ошибки сразу — в порядке полей») и
  ранее не покрытую `roomProblems` (edit/create, границы диапазона).
  Мутанты `room-create-ignores-area` и `marker-ha-binding-accepts-virtual`
  подтверждают, что это не тавтологичные ассерты.
- **AC3** (гарды соответствующих мутантов переведены со смоков на юниты):
  подтверждено диффом `scripts/mutation-registry.mjs` (три `guard:` заменены
  с `node demo/smoke_*_settings_form.mjs` на `node --test
  test/dialog-form-problems.test.mjs`) и прогоном каждого из трёх — «поймано
  1 из 1» за секунды, без браузера.

## Проверено чтением, не исполнением

- Соответствие тестовых фикстур (`spaceDraft`, `generalDraft`, `markerDraft`,
  `roomHost`) реальной форме полей `SpaceDialogState`,
  `GeneralSettingsDraft`, `MarkerDialogDraft`, `RoomDraftHost` — сверено
  построчно с src, расхождений нет.
- Логика `spaceDialogProblems`/`generalProblems`/`markerProblems`/
  `roomProblems` (порядок веток, условия `edit`/`create`, режим `ha` для
  маркера, режим заливки для температуры) — прочитана и сопоставлена с
  ассертами; исполняемо подтверждена прогоном тестов (не только чтением).

## Чего не проверял

- Полный `npm test` (250 файлов), `npx tsc --noEmit`, `npm run build` —
  не перегонял; основание — зелёный Validate на этом же SHA (см. выше),
  диффу без правок src это не противоречит.
- Полный ночной прогон `mutation-registry.mjs` (все мутанты, не только
  девять из этой задачи) — не запускал, это предрелизный/ночной гейт, не
  гейт ревью.
- `node scripts/check-inputs.mjs --coverage`, `node scripts/no-new-any.mjs` —
  не перегонял; диффу не касается (нет `src/**`, нет новых `input`-полей).
- `node scripts/check-docs.mjs` — не требуется: `src/**` не тронут.
- golden/perf/pytest — не по диффу (нет рендера, нет `custom_components/**`).
- Браузерные смоки — не запускал; `smoke-select.mjs` подтвердил, что для
  этого диффа выбирать нечего.
- Ручное тестирование в браузере не проводилось (задача не меняет `src/**`,
  User-Visible: no).

## Находки

Не выявлено. High — 0, Medium — 0, Low — 0.

## Итог

Все три AC доказаны исполняемыми тестами и/или мутациями (плюс один
мутационно не зарегистрированный, но лично проверенный на «умение падать»
пункт AC1). Диапазон материала подтверждён совпадением blob-хешей файлов
диффа с якорями, приложенными автором в issue (`89e6f73f…`, `a08b616a…`,
`107801f8…`, `858994a6…`) — несмотря на разные корневые деревья до/после
ребейза, содержание изменённых файлов идентично заявленному. Рабочая копия
после проверки чиста (`git status` — «nothing to commit, working tree
clean»).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/631-form-state-units`, коммит `36f0db6e1ae9` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a7cbed4ee3b2c1bd0a8334bae66400e50e2c26ba`
  ```
  git log --all --format='%H %T' | grep a7cbed4ee3b2
  ```
- Тело issue: `65fb6131e45f761b7a50d4daf8a05706d1c987d495b7132e1fba4307f9549702`
- Вердикт конвейера: `green` · High 0
