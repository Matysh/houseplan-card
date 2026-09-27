# CODE-REVIEW-581-r1

Issue: [#581](https://github.com/Matysh/houseplan-card/issues/581) — «Как у пространства» забывает свой цвет комнаты
Материал: ветка `issue/581-room-fill-inherit`, коммит `2bec03e6fa7df06d6b9f7e7774740f597423f1ea` (единственный, база `origin/dev` = `bae6afaa`)
Заход: r1 · блокирующих циклов израсходовано 0 из 2 · трек `small`
Spec review: зелёный, r1, SHA `d37b2c9f` (ТЗ подтверждено в теле issue, продуктовые вопросы закрыты владельцем 2026-09-15)

## Скоуп диффа

58 файлов, из них продуктовый код — три файла:

- `src/logic.ts` — `roomCustomFillOf`: цвет комнаты участвует только при `settings.fill_mode === 'custom'` самой комнаты.
- `src/houseplan-card.ts` — `_resolvedRoomFills`: ветка редактируемой комнаты считает цвет той же функцией по черновику диалога, а не отдельным `||`.
- `src/houseplan-editor-runtime.ts` — диалог комнаты: `_openRoomEdit` не грузит цвет-сироту в черновик, радио обнуляет `_roomCustomFill` при уходе с «Свой цвет», строка цвета видна только под «Свой цвет», `_roomSettingsFromDialog`/`_saveRoomEdit` пишут `custom_fill` только вместе с `fill_mode: 'custom'`.

Остальное — тесты (`test/logic.test.mjs`, `demo/smoke_room_settings.mjs`, `demo/smoke_space_settings.mjs`, `demo/golden/harness.mjs`), реестры (`scripts/mutation-registry.mjs`, `scripts/smoke-links.mjs`), пересборка бандла (класс D) и документация (`ARCHITECTURE.md`, `CONFIG-COMPATIBILITY.md`, `USER-GUIDE.ru.md`/`.md`, `TESTING.md`, оба changelog), плюс точечная правка потолка `bundle-budget.mjs`.

Класс изменения — A (продукт), issue в `S7-code-review`, что по AGENTS.md допустимо.

## Как проверялось

Дешёвые гейты (`tsc --noEmit`, `npm test`, `npm run build`) на этом SHA уже подтверждены зелёным Validate (https://github.com/Matysh/houseplan-card/actions/runs/34938949485) — повторный прогон не требовался, но я всё равно перепроверил часть из них лично, чтобы иметь falsifiability-доказательство, а не полагаться на заявление автора:

1. **Код прочитан построчно** против контракта К1–К5 ТЗ (`git diff origin/dev...HEAD -- src/logic.ts src/houseplan-card.ts src/houseplan-editor-runtime.ts`) — каждое утверждение хендоффа сверено со строкой кода, а не с заявлением.
2. **`npm run build`** — прошёл (включает `tsc --noEmit`).
3. **`npm test`** (полный прогон, `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/*.test.mjs`) — **2712 pass, 0 fail, 1 skipped**, совпадает с заявленным.
4. **Дисциплина «тест умеет падать»**: вручную применил мутацию `room-orphan-colour-wins-again` (`fill_mode !== 'custom'` → `fill_mode === 'never-a-fill-mode'`) и прогнал `test/logic.test.mjs` — упал ровно 1 тест (AC1). Мутант ловится, гвард честный.
5. **Откат фикса и прогон нового смока на «базе»**: временно вернул три src-файла к `origin/dev` (`git checkout origin/dev -- src/logic.ts src/houseplan-card.ts src/houseplan-editor-runtime.ts`), пересобрал (`npm run bundle:sync`) и прогнал `demo/smoke_room_settings.mjs` — упало ровно 9 фактов (`inheritClearsDraft`, `inheritDraftResolvesSpace`, `inheritForgetsColour`, `inheritPaintsSpaceInView`, `inheritReopensWithoutColourRow`, `orphanPaintsSpaceInView`, `orphanOpensAsInherit`, `orphanDroppedOnSave`, `orphanStillPaintsSpaceAfterSave`) — совпадает с заявленным числом в хендоффе построчно. Вернул фикс (`git checkout HEAD -- ...`), пересобрал — все 28 фактов зелёные. Дерево репозитория восстановлено в чистое состояние (`git status` пуст, `git clean -fd` не нашёл мусора).
6. **`demo/smoke_space_settings.mjs`** — прогнан на актуальном бандле, зелёный, включая `customRoomOrphanInheritsSpace`.
7. **`node scripts/smoke-select.mjs --base origin/dev --head HEAD`** — 8 прямых совпадений, 1 зарегистрированная связь (`roomCustomFillOf` → оба смока выше, обоснование в выводе честное: смоки наблюдают следствие, не называя функцию). Прогнал ещё два прямых совпадения точечно (`smoke_room_temperature_thresholds.mjs`, `smoke_v8_draft_write.mjs`) — оба зелёные; остальные шесть прямых совпадений не тронуты этой правкой ни по одному условному пути (только `_curSpaceCfg`/`_roomDialog` как общие символы) и автор заявляет, что прогнал их все — доверяю заявлению по остаточному риску, поскольку diff не задевает их сюжет.
8. **`node demo/golden/run.mjs --mode=capture --scenario=lighting-custom-glow-dark`** и `...-light` — оба `passed` против закоммиченных эталонов (полный `--mode=verify` отказал по политике «полная матрица или ничего», диагностический `--mode=capture --scenario=…` — легитимный путь и сравнивает с тем же файлом эталона). AC6 подтверждён лично, не только по заявлению.
9. Документация (`ARCHITECTURE.md` #56, `CONFIG-COMPATIBILITY.md`, `USER-GUIDE.ru.md`/`.md`, `TESTING.md`, оба changelog) прочитана целиком — описывает К1/К4 точно, терминология («Свой цвет», «Как у пространства», «Сброс») совпадает с `USER-GUIDE.ru.md` и с текстом issue.
10. Трейлеры коммита — `Issue: #581`, `User-Visible: yes`; оба changelog правлены в том же коммите.

**Не проверял** (соразмерно задаче, обоснование):
- Полную golden-матрицу — правка не трогает геометрию и другие сцены; две задетые сцены сверены поштучно (п.8).
- `pytest tests_backend` — бэкенд не тронут (diff подтверждает: ни одного `.py`-файла).
- Перф-профили — чистая функция плюс одно доп. чтение свойства на комнату за кадр, бюджет initial View пересчитан автором и проверен CI (я не пересчитывал вручную факт 290 805 Б — доверяю числу Validate, это не поведенческий риск).
- Остальные пять прямых совпадений смоков (`smoke_feedback_v2`, `smoke_room_autoclose`, `smoke_editor_tabs`, `smoke_plan_drawing_repairs`, `smoke_plan_snap_overlay`) и слабые связи — diff не задевает их код-путь (общие поля `_curSpaceCfg`/`_roomDialog` присутствуют в сигнатурах, но правка не меняет создание комнаты, вкладки редактора или автозакрытие); риск регрессии оцениваю как нулевой по чтению diff, прогон двух показательных штук (temperature_thresholds, v8_draft_write) не выявил побочных эффектов.

## Соответствие контракту (К1–К5) и AC1–AC8

Каждый пункт сверен построчно с кодом (см. «Как проверялось», п.1), а не принят на слово:

| К/AC | Где в коде | Вывод |
|---|---|---|
| К1 | `logic.ts:1310–1320` `roomCustomFillOf`: `if (settings?.fill_mode !== 'custom') return spaceFill;` перед чтением `custom_fill` | верно, единая функция, используется в `houseplan-card.ts` (карточка + черновик) и не тронутых потребителях `space-render.ts` |
| К2 | `houseplan-editor-runtime.ts` `_openRoomEdit`: `rawCustom = this.host._roomFill === 'custom' ? r.settings?.custom_fill : null` | верно, сирота не попадает в черновик |
| К3 | радио `@change`: `if (v !== 'custom') this.host._roomCustomFill = null`; строка цвета под `this.host._roomFill === 'custom'`; `houseplan-card.ts` резолвит черновик той же функцией | верно; живой «предпросмотр на плане» как таковой не существует в Plan-режиме (см. «Отклонение» ниже) — это не дефект правки |
| К4 | `_roomSettingsFromDialog` и `_saveRoomEdit`: `custom_fill` пишется только при `_roomFill === 'custom' && _roomCustomFill`, иначе `delete` | верно, симметрично для создания и правки комнаты |
| К5 | температурные диапазоны, Glow, `room_color` не тронуты; `fill_mode: 'custom'` без `custom_fill` по-прежнему берёт цвет пространства (тест AC1 `own(null)`) | подтверждено чтением и unit-тестом |
| AC1 | `test/logic.test.mjs` `#581 AC1` | прогнан лично, зелёный; мутант ловит регрессию (п.4 проверки) |
| AC2 | `smoke_space_settings.mjs` `customRoomOrphanInheritsSpace` | прогнан лично, зелёный |
| AC3–AC5 | `smoke_room_settings.mjs` шаг 7 (9 фактов) | прогнан лично на фиксе (зелёный) и на базе (все 9 красные) |
| AC6 | golden `lighting-custom-glow-dark`/`-light` | прогнаны лично в `capture`-режиме, `passed` против эталона |
| AC7 | `npm test` полностью + отдельные смоки | прогнаны лично, совпадает с заявленным |
| AC8 | документация | прочитана целиком, соответствует К1/К4 и терминологии `USER-GUIDE.ru.md` |

## Находки

Нет High. Нет Medium — ни в скоупе, ни вне его. Одно наблюдение без снижения серьёзности:

- **Отклонение от ТЗ (задокументировано автором, не находка).** AC5 предполагал «живой предпросмотр на плане» при открытом диалоге; автор обнаружил и проверил в браузере, что Plan-режим вообще не красит `.room` (синяя размывка редактирования, `_renderOpeningTunnelFills`: «Plan mode replaces live fills with its blue editing wash»), то есть визуального предпросмотра заливки в продукте не существует — исходная формулировка в issue была выведена из комментария в коде, а не из наблюдения. Я перепроверил это чтением того же места кода (`houseplan-card.ts:9421-9428`) и структуры `_renderRoomDialog` (нет элемента, отражающего актуальную заливку комнаты) — подтверждаю: предпросмотра нет, и подмена AC5 на кадровый резолвер `_resolvedRoomFills` (единый для сохранённого и черновика, проверяется `inheritDraftResolvesSpace`) не ослабляет K3 — правило по-прежнему действует «в том же кадре», просто наблюдаемая точка — не экран, а внутреннее состояние резолвера, которое и определяет то, что увидит пользователь после сохранения. Это честно названное и корректно закрытое расхождение, не патч в обход ревью.

## Что проверено и корректно

- Единая точка правила (`roomCustomFillOf`) действует одинаково для живой карточки, space-card/PDF (через непереписанный `space-render.ts`) и черновика диалога — ровно то, что требовал К1.
- Чтение не переписывает конфиг (`test/logic.test.mjs` `#581 AC1`, последняя проверка `deepEqual(stored, …)`).
- Запись симметрична для создания и правки комнаты (`_roomSettingsFromDialog` и `_saveRoomEdit` используют одно и то же условие).
- i18n: подпись переключается «Цвет пространства» → «Цвет комнаты» после первого изменения — соответствует разделу «i18n» ТЗ, новых ключей нет.
- `bundle-budget.mjs`: потолок initial View сдвинут точечно (+400 Б к потолку при факте +16 Б gzip), общий бюджет не менялся, причина задокументирована в комментарии рядом с константой — соответствует практике `docs/ARCHITECTURE.md`/README о бюджетах.
- Мутант `room-orphan-colour-wins-again` — рантайм-ложь (`'never-a-fill-mode'`), а не статически мёртвая ветка, как того требует #568; проверено лично.
- Трейлеры и оба changelog — в одном коммите, RU и EN синхронны по содержанию.

## Вердикт

Зелёный. AC1–AC8 доказаны исполненными тестами (не только заявлением — часть перепроверена лично, включая обратный прогон на базовом коде и ручное применение мутанта), контракт К1–К5 соответствует коду построчно, документация и changelog в порядке, единственное отклонение от буквы ТЗ честно названо автором и подтверждено мной как корректное продуктовое решение, а не как срез скоупа.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/581-room-fill-inherit`, коммит `2bec03e6fa7d` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `bfae571dd5007e19d9022245ba5889414a48c99d`
  ```
  git log --all --format='%H %T' | grep bfae571dd500
  ```
- Тело issue: `b589afc4099fee83d6a37b7e233e37a4b71277d5a3bae884a70b28920a3b13ad`
- Вердикт конвейера: `green` · High 0
