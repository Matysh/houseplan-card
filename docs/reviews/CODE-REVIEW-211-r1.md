# CODE-REVIEW-211-r1 — визуальное соответствие маркеров дизайн-пакету #179

- **Issue:** https://github.com/Matysh/houseplan-card/issues/211
- **ТЗ:** `docs/specs/211-device-icons-visual-parity.md` (принято `SPEC-REVIEW-211-r2`, зелёный)
- **Диапазон реализации:** `6feb018..270cf63`
  - `4e82976` fix: match device icons to designer package · `Issue: #211` · `User-Visible: yes`
  - `270cf63` test: strengthen unavailable hover mutant · `Issue: #211` · `User-Visible: no`
- **Цикл:** r1/4

## Скоуп проверки

Диапазон реализации ограничен двумя коммитами: `src/styles.ts` (geometry/theme/state
tokens), новый независимый reference-fixture (`demo/srv/reference/device-icons/**`),
расширенный `demo/smoke_device_icon_design.mjs`, новый
`demo/capture_device_icon_reference.mjs`, точечная правка мутационного теста
`scripts/mutation-gate.mjs`, три копии бандла, оба changelog, `docs/TESTING.md` и
шесть скриншотов `docs/images/*`. Ни `device-visual.ts`, ни `device-presentation.ts`,
ни `device-pulse.ts`, ни `device-face.ts` не тронуты — совпадает с §10 ТЗ
(«не должны меняться без доказанного отсутствующего renderer fact»). Конфиг,
i18n, `custom_components/**/*.py` не задеты.

## Как проверялось

Проверка велась не по описанию хендоффа, а самостоятельным прогоном на чистом
дереве и собственным чтением диффа/скриншотов.

### Гейты — прогнаны

```
npx tsc --noEmit                                          → чисто, без ошибок
npm test                                                   → 939 pass, 0 fail, 0 skipped
npm run build                                              → OK
cmp dist vs custom_components/.../houseplan-card.js        → идентичны
cmp dist vs demo/srv/assets/houseplan-card.js               → идентичны
node scripts/check-docs.mjs                                 → "7 files, 10 external links" — OK
node demo/smoke_device_icon_design.mjs                       → все 29 фактов true, OK
node demo/smoke_device_preview_parity.mjs                    → все 15 фактов true, OK
node demo/smoke_static_icon.mjs                              → все 12 фактов true, OK
node demo/smoke_disabled_device.mjs                          → все 7 фактов true, OK
node scripts/mutation-gate.mjs --id=device-unavailable-hover-restored
    → чистый прогон зелёный; мутант красный, «поймано 1 из 1»
node demo/capture_device_icon_reference.mjs                  → сгенерирован
    artifacts/device-icon-reference/device-icons-reference-runtime.{html,png}
node demo/golden/run.mjs --mode=capture --scenario=device-icon-state-table-light
node demo/golden/run.mjs --mode=capture --scenario=device-icon-state-table-dark
    → оба "different" (ожидаемо, старый baseline зафиксировал баг)
```

Независимая проверка «тест умеет падать» (дисциплина применена к самому
дорогому и самому content-heavy тесту, `smoke_device_icon_design.mjs`): в
отдельном `git clone` собран бандл со **старым** `src/styles.ts` (коммит
`6feb018`, до фикса) и **новым** смоком/reference-фикстурой (`270cf63`).
Результат: **13 фактов красные** — `geometryMatchesAt32_56_96`,
`referenceStateMatrixMatches`, `referenceHoverMatches`,
`virtualUsesThemeDefaultWithDashedShell`, `iconCoreIsCircle`,
`valueBadgeIsPill`, `activeUsesPackageAmber`,
`lightActiveUsesWhiteGlyphAndAmberShell`, `darkDefaultShellUsesPackageStroke`,
`darkHoverChangesCoreOnly`, `selectionDecoratesCoreNotShell`,
`focusDecoratesCoreNotShell`, `darkLockUsesWhiteGlyphAndDarkShell`. Это больше,
чем девять фактов, названных в хендоффе (хендофф перечислял по смыслу, не по
имени предиката) — расхождение не в пользу автора, а в сторону более сильного
доказательства: тест ловит регрессию с запасом. AC9 подтверждён независимо, не
на слово.

### Визуальная проверка «глазами» (обязательна по §11 ТЗ)

Просмотрен `artifacts/device-icon-reference/device-icons-reference-runtime.png`
целиком (28 строк: Default/Hover/Active/Lock/Unlock/Selected/Focus/Alert/
Virtual/Unavailable/Text/Double Right для Light и Dark, плюс Default на
32/56/96 px). Круглая геометрия, размер MDI-глифа, value-pill радиус, theme
stroke и цвета состояний в runtime визуально совпадают с колонкой Reference
SVG построчно, включая Lock/Unlock (проверены отдельным 4×-кропом — форма и
пропорция глифа замка совпадают с эталоном в обеих темах).

Также открыт и прочитан `artifacts/golden/actual/device-icon-state-table-{light,dark}.png`
целиком. Комбинация `alarm + sel` с `focusDevice` на одном маркере
(«golden-climate») отрендерена так: core и shell — красные (alert выигрывает
покраску, как требует §7.3), а кольцо декорации — синее (focus), не янтарное
(selected). Это прямое следствие принятого в #179 приоритета
`Alert > Focus > Selected > Hover > semantic > Default`: кольцо — теперь
отдельный CSS-слой (`--device-ring-color`/`--device-ring-width` на
`.device-core`), и правило `:focus-visible` в каскаде идёт позже `.sel`, то
есть более приоритетное состояние перекрывает кольцо менее приоritetного —
ровно то поведение, которого требует таблица приоритета. До этого коммита
кольцо было частью `box-shadow` на `.device-shell` и `.dev.alarm` (более
специфичное правило ниже по каскаду) стирало декорацию selection/focus
полностью — то есть alert раньше «съедал» кольцо целиком, а не выигрывал
только цвет core/shell. Новое поведение (alert красит core/shell, но не
гасит более высокоприоритетный focus-ring) точнее реализует буквальное
требование §7.1 «Selected/Focus ring — отдельный круглый слой; не заменяет
внешний shell» и не описано ни одним найденным мной артефактом как
регрессия. Технически это расширение видимой информации (можно увидеть, что
элемент одновременно и alert, и focused), не потеря её.

Проверены также обновлённые документационные скриншоты
(`docs/images/01-view-desktop.png` и другие) — маркеры на них уже круглые, а
не скруглённо-квадратные; `sourceFingerprint` в `screenshots.json` пересчитан
и совпадает с проверкой `check-docs.mjs`.

### Коммиты и трейлеры

Оба коммита несут `Issue: #211`. `4e82976` (`User-Visible: yes`) в одном
коммите правит оба changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) —
условие AGENTS.md выполнено. `270cf63` (`User-Visible: no`) правит только
`scripts/mutation-gate.mjs` — чистый class B, трейлер соответствует.

## Что проверено и корректно

- **AC1 (геометрия).** Круглый core (`border-radius: 50%` вместо `28%`),
  shell/core `1.26875` сохранён через `box-sizing: border-box` и
  компенсирующий `--device-shell-pad` независимо от переменной ширины
  stroke — геометрия не плывёт между состояниями с разной толщиной обводки.
  Value-pill радиус — `height/2` (`0.39375`), а не `0.18`. `geometryMatchesAt32_56_96`
  подтверждает допуск на 32/56/96 px, включая painted bbox настоящего
  `mdi:lightbulb-spot` (реальный SVG-путь, не bounding box `ha-icon`).
- **AC2 (theme parity).** Light/Dark default core/glyph/stroke/shadow и
  запрет `backdrop-filter` подтверждены смоком и визуальной таблицей;
  `darkDefaultShellUsesPackageStroke` сверяет буквальный `rgba(37,37,37,0.75)`.
- **AC3 (state parity).** Default/Hover/Active/Lock/Unlock/Alert сверены
  байт-в-байт с прямым SVG (цвет **и** ширина stroke) в обеих темах;
  Selected/Focus/Virtual/Unavailable подтверждены отдельными вычисляемыми
  фактами и визуально. Тёмный Unlock корректно использует утверждённый
  владельцем янтарный override, а не архивный зелёный.
- **AC4 (combinations).** Golden-сценарий `device-icon-state-table-*`
  содержит маркер с `alarm+sel+focus` одновременно; результат просмотрен и
  соответствует принятому в #179 приоритету слоёв (см. выше).
- **AC5 (layouts).** Text/Double/third section/LQI не сломаны
  (`doubleUsesOneShell`, `textIsComplete`, `lqiBandsProjected`).
- **AC6 (surface parity).** `smoke_device_preview_parity` и `smoke_static_icon`
  зелёные — план, preview и static card используют общий `renderDeviceFace()`
  без расхождений.
- **AC7 (interaction regression).** 44×44 hit area, unavailable
  click/tap без hover, keyboard/tab order, secure-путь — все факты зелёные,
  `smoke_disabled_device` не задет.
- **AC8 (data/semantics).** Диапазон реализации не касается
  `device-visual.ts`/`device-presentation.ts`/`device-pulse.ts`, i18n или
  `custom_components/**`; unit-suite (939) зелёный без исключений.
- **AC9 (failing-before-fix).** Независимо подтверждено (13 фактов красные на
  старом CSS, все зелёные после фикса) — см. раздел «Как проверялось».
- **AC10 (release artifacts).** Оба changelog, `docs/TESTING.md`, обновлённые
  скриншоты — всё в user-visible коммите; golden не принят вручную (верно —
  ждёт полного reviewed Linux CI artefact).

## Находки

Нет находок уровня High или Medium. Два Low, оба не блокируют и не требуют
правки в этом цикле:

- **L1.** `virtualUsesThemeDefaultWithDashedShell` в смоке проверяет только
  состояние `virtual` в покое; «virtual hover идентичен ordinary hover»
  (§7.3 ТЗ) не покрыт отдельным вычисляемым фактом — только логическим
  чтением каскада (правило `.dev:not(.unavail):hover` не имеет исключения
  для `.virtual` и не переопределяется ничем более специфичным). Риск
  минимален и ограничен одним недостающим предикатом в уже большом смоке.
  Снимаю без правки: поведение не изменилось этим диапазоном (правила
  `.virtual`/`.dashed` не тронуты диффом), это пробел покрытия, а не дефект
  поведения.
- **L2.** Комбинации `Alert+Focus+Selected` не сверены с одноимённым SVG
  архива буквально (§7.3 формально требует «сверяются с одноимёнными Light
  SVG»), потому что такого экспортированного файла в переданном архиве нет —
  собственный AC4 ТЗ признаёт это, требуя доказательство именно
  «combination golden», которое выполнено и просмотрено. Снимаю без правки:
  доказательство соответствует явно заявленному в ТЗ уровню, более сильного
  источника истины не существует.

Отдельно фиксирую техническую неточность в хендоффе, не влияющую на вердикт:
он сообщает «938 pass, 1 skipped», а независимый прогон на этом же дереве
даёт «939 pass, 0 skipped» (совпадает с `npm run inventory`). Не поднимаю как
находку — расхождение не воспроизводится и не меняет результат ни одного
гейта.

## Чего не проверял и почему

- **Полный набор из 152 browser smokes** — не запускал; диапазон реализации
  ограничен общим рендерером маркера и его собственным smoke/preview/static
  покрытием, названным в AC и хендоффе. Остальные 148 не имеют отношения к
  геометрии/theme/state маркера.
- **`npm run golden:verify` по полному набору сценариев** — не запускал;
  прогнал `capture` только по двум сценариям, прямо относящимся к задаче
  (`device-icon-state-table-{light,dark}`), и открыл получившиеся PNG.
  Полный golden-прогон и оценка остальных ~90 сценариев на предмет побочных
  визуальных отличий из-за глобального изменения CSS маркера — предрелizный
  гейт (PROCESS.md §8), а не гейт код-ревью; риск того, что какой-то другой
  golden-сценарий с устройствами теперь тоже "different", реален, но это
  ожидаемое и штатно обрабатываемое следствие правки, а не повод возвращать
  задачу на этом этапе.
- **`python -m pytest tests_backend -q`** — не запускал; диапазон не
  затрагивает `custom_components/**/*.py`.
- **Performance-профили** — не запускал; правка не добавляет DOM-узлов,
  layout read или подписок (`device-face.ts` не тронут), а AC не называет
  performance-смок явно.
- **Полный Linux CI-прогон** — не запускал локально; это гейт CI при выходе
  из код-ревью, не задача рецензента.

## Вердикт

Все десять AC выполнены и подтверждены либо автотестом, который доказанно
умеет падать, либо непосредственным визуальным просмотром, как того требует
§11 ТЗ. Регрессий в интеракции, данных, конфиге и семантике не найдено.

**Зелёный.**
