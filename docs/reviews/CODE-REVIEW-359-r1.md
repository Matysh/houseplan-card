# CODE-REVIEW-359-r1

Issue: [#359](https://github.com/Matysh/houseplan-card/issues/359) — Предпросмотр мебели на плане перед размещением
SHA: `8b66d67d` (`issue/359-furniture-placement-preview`)
ТЗ: `docs/specs/359-furniture-placement-preview.md`, spec review r2 — зелёный
Заход: r1 · блокирующих циклов израсходовано 0 из 4 (r1 — первый заход code review, разбор полный)

## Скоуп проверки

Диапазон `origin/dev..HEAD` — 5 коммитов, из них один продуктовый:
`8b66d67d feat: preview furniture placement` (Issue: #359, User-Visible: yes).
Остальные четыре — спек и спек-ревью документы (r1/r2), уже принятые до этого
этапа.

Диф продуктового кода: `src/furniture.ts`, `src/houseplan-card.ts`,
`src/houseplan-editor-runtime.ts`, `src/styles/plan.styles.ts`. Плюс тесты
(`test/furniture.test.mjs`, `test/golden-matrix.test.mjs`,
`demo/smoke_furniture.mjs`, `demo/golden/harness.mjs`, `demo/golden/matrix.mjs`),
документация (`docs/FURNITURE.md`, `docs/USER-GUIDE.ru.md`, оба CHANGELOG) и
бандл/дистрибутив (класс D, обновлён `bundle:sync`).

Диф не трогает геометрию комнат/толщину/`layout`/`marker.space`/`open_spans`:
`_furnWalls` используется только на чтение для магнита мебели, схема decor не
меняется. `npm run invariants` не требуется — подтверждено чтением диффа
(нет изменений в space-geometry/wall-degrade/rekey путях кроме одного нового
импорта `clampCanvasN`, который уже существует и не меняет поведение).

## Как проверялось

Дешёвые гейты прогнаны лично на этом SHA (зелёного Validate на нём нет):

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | чисто, без вывода |
| unit | `npm test` | `tests 1511 · pass 1510 · fail 0 · skipped 1` |
| build | `npm run build` | `created dist in 15.3s` |
| bundle sync | `npm run bundle:sync` | три копии синхронны (`custom_components`, `demo/srv/assets`) |
| bundle budget | `npm run bundle:budget` | View 272469 B / 282000 B (headroom 9531 B), editor 137196 B |
| furniture pack | `npm run furniture:check` | `Furniture pack OK: 44 plan symbols, 33 menu icons` |
| **docs fingerprint** | `node scripts/check-docs.mjs` | **`ERROR screenshot source fingerprint is stale`** — см. находку ниже |
| docs пересборка (диагностика находки) | `node demo/docs/capture.mjs` | пересобрал скриншоты/фингерпринт локально, подтвердил причину; изменения отменены (`git checkout -- docs/images/`), не коммитил |
| browser smoke | `node demo/smoke_furniture.mjs` | `OK`, все 60+ именованных ассертов true |
| golden (новый сценарий) | `node demo/golden/run.mjs --mode=capture --scenario=furniture-placement-preview-light` | `missing-baseline` — ожидаемо, приёмка эталона требует полного Linux CI (AC10, `demo/golden/README.md`) |
| golden (регрессия) | `npm run golden:verify` | все существующие сценарии `passed`, кроме нового (`missing-baseline`, ожидаемо) — новая композиция decor-слоя не сдвинула ни один принятый эталон |
| smoke-select (широкий охват) | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 4 файла `src/**`, 44 изменённых символа-проекта; 31 «прямое совпадение», включая `demo/smoke_furniture.mjs` (уже прогнан). Остальные «прямые» — общие декор-символы (`_curSpaceCfg`, `_decorTool`, `_svgPoint`, `NORM_W`, `_editorRuntime`, `_pointers`) на диффах в `_stagePointerMove/_stagePointerLeave/_stagePointerUp`, которые новый код только оборачивает веткой `_decorTool === 'furniture'`, не меняя остальные ветки — прочитаны построчно (см. ниже), не прогонялись целиком: точечный per-tool guard, не общая decor-логика |

Инвариант «один источник числа»: preview и commit используют один и тот же
чистый `resolveFurniturePlacement` (`src/furniture.ts:418`) — подтверждено
и unit-тестом (`preview и commit равны для одного input`), и smoke
(`previewAndCommitAreIdentical`), и чтением кода (`_furnPlace` больше не
пересчитывает привязку отдельно, а берёт результат `_resolveFurniturePlacement`
целиком). Второй показываемый параметр — ширина/глубина в полях палитры — тот
же `pal.w/pal.h`, что уходит в резолвер; отдельного пути нет.

## Находки

### High — 1

**docs-гейт на этом SHA красный: скриншот-фингерпринт устарел, а PNG не
пересобраны.**

- Файл: `docs/images/screenshots.json`
- Воспроизведение: `node scripts/check-docs.mjs` →
  `ERROR screenshot source fingerprint is stale; run npm run build && node demo/docs/capture.mjs`.
  Причина — числами: записанный в коммите `sourceFingerprint` —
  `c94b78394be8a5a7dc2973652aa9aba4b6896cfd4c7f44c0038fadf911e62eb4` (тот же,
  что и на `origin/dev`, `git show origin/dev:docs/images/screenshots.json`
  и `git show HEAD^:docs/images/screenshots.json` совпадают — на `dev` гейт
  был зелёным). Диф трогает `src/furniture.ts`, `src/houseplan-card.ts`,
  `src/houseplan-editor-runtime.ts`, `src/styles/plan.styles.ts` — фингерпринт
  считается по всему `src/**`, значит любая правка делает его устаревшим.
  Пересчитанный локально фингерпринт — `5e7ddb2ac8885e8e6edf2113a1f35551ce3338234da9324d0874e3f861205502`;
  `docs/images/*.png` и `docs/images/screenshots.json` в коммите
  `8b66d67d` не обновлены.
- Последствие: это ровно `docs` job из `validate.yml` — «реальный блокер»
  (AGENTS.md). На этом SHA он красный детерминированно, не по вкусу CI-раннера.
  Слияние в `dev` без починки повторит #230/#234: `dev` останется с красным
  `docs` до следующей задачи (#237).
- Это не про содержание документации — `docs/FURNITURE.md` и
  `docs/USER-GUIDE.ru.md` обновлены корректно и по делу (см. «Проверено и
  корректно»). Дело исключительно в шаге релиз-артефактов «пересобрать
  скриншоты», который ТЗ не назвало явно (в разделе «Release-артефакты» ТЗ
  вообще не упомянут скриншотный гейт), но `AGENTS.md`/`PROCESS.md` требуют
  его для любой правки `src/**`, а хендофф автора его не называет и не
  прогонял.
- Почин: `npm run build && node demo/docs/capture.mjs`, затем
  `node scripts/check-docs.mjs` до зелёного, закоммитить обновлённые
  `docs/images/*.png` и `docs/images/screenshots.json` вместе с остальным
  диффом (или отдельным коммитом класса C/D с тем же issue-трейлером).

Находка в скоупе задачи (сама задача внесла правку в `src/**`, из-за которой
гейт стал красным) — чинится в этом же issue, отдельный issue не заводится.

## Проверено и корректно

- **AC1 (появление)** — `mouseHoverShowsRealSymbol` в smoke: реальный path,
  `data-symbol` совпадает с выбранным символом.
- **AC2 (геометрический паритет)** — `resolveFurniturePlacement`
  (`src/furniture.ts:418`) — чистая функция, вызывается один раз и для превью
  (`_resolveFurniturePlacement` → `_furniturePreviewPlacement`), и для коммита
  (`_furnPlace`). Unit-тест сравнивает результат `deepEqual` для одинакового
  входа; отдельный тест покрывает `free`/`Shift` и canvas-guard
  (`clampCanvasN`, лимит 5000) и `null` для неизвестного символа. Smoke
  `previewAndCommitAreIdentical` сравнивает реально размещённый `sofa` с
  зафиксированным значением превью перед кликом — `x/y/w/h` с точностью
  `1e-12`, `angle` точно.
- **AC3 (живые размеры)** — `sizeUpdatesPreviewWithoutPointerMove`: изменение
  поля Width без нового движения мыши меняет `w` превью и `transform`.
  Работает потому, что рендер геометрии превью читает текущий `_furnPalette`
  на каждый рендер (`_furniturePreviewPlacement` — геттер, не кэш).
- **AC4 (чистота)** — `previewDoesNotMutateConfigOrHistory`: `_decorList.length`,
  `_cfgEpoch`, undo/redo-имена не меняются на `pointermove`. Прочитано в коде:
  `_furnPointerMove` пишет только `_furnPreviewInput` (`@state`, не часть
  конфига) и ничего не передаёт в `_saveConfig`/`_recordGeometry`.
- **AC5 (очистка)** — `pointerLeaveClearsPreview`,
  `previewClearsAfterCommit` в smoke; остальные точки очистки (Escape,
  кнопки «закрыть»/«назад»/категория палитры, переключение инструмента,
  `_setMode`, смена `_space`, `_stagePointerCancel`,
  `_clearGeometryGesture`) не покрыты ни отдельным smoke-шагом, ни
  source-contract тестом (ТЗ допускал последний опционально, «если нельзя
  надёжно доказать одним smoke» — план его не потребовал письменно, но и не
  реализовал). **Проверено чтением, не исполнением**: все девять точек вызова
  `_clearFurniturePreview()` (`src/houseplan-editor-runtime.ts:1178, 2207,
  2238, 4722, 4746, 4867, 4878, 4902, 5222, 5345, 5357, 5361` и
  `src/houseplan-card.ts:1450, 2691, 2797`) расположены до любого early-return,
  который мог бы их обойти — прослежено построчно для `_setMode` (в самом
  начале функции, до проверки «тот же режим»), для Escape-ветки (до сброса
  `_furnPalette`), для кнопок палитры и переключателя инструментов в
  `_renderDecorBar`/`_renderFurnPalette`/`_renderDecorSecondary`. Пропусков не
  нашёл.
- **AC6 (ввод)** — `shiftBypassesTheWallMagnet` (было
  `shiftKeepsTheMagnet` — переименовано согласно новому контракту `Shift`,
  смок обновлён консистентно с CANVAS.md §9.4 и ТЗ п.3);
  `touchCancelMoveAndSecondContactDoNotSave` — четыре синтетических
  touch-сценария (move>8px, cancel, второй contact, `isPrimary:false`) не
  создают запись. Прочитано: `_furnPointerMove` помечает `pending.cancelled`
  при движении больше 8px (тот же порог, что уже использует `_stagePointerMove`
  для pan-lock, `src/houseplan-card.ts:6220` — не новое магическое число), а
  `_decorPointerDown` игнорирует второй контакт, не создавая для него
  собственный `pending`.
- **AC7 (визуальный контракт)** — `previewIsTransientAndInert`: `aria-hidden`,
  `pointer-events: none` (вычисленный computed style), `opacity: 0.55` с
  допуском `1e-6`. CSS-правило `.decorlayer .furniture-placement-preview`
  (`src/styles/plan.styles.ts`) не задевает никакой другой класс.
- **AC8 (совместимость)** — весь остальной furniture-flow (drag/resize/rotate,
  erase, View-рендер) прогнан тем же расширенным smoke и остаётся зелёным;
  `npm test` без регрессий (1510 pass, 0 fail); `npm run golden:verify` —
  все ранее принятые сценарии `passed`, ни один не сдвинут новым кодом
  decor-слоя.
- **AC9 (неизвестный символ)** — unit-тест
  `resolveFurniturePlacement({..., symbol: 'future_unknown_symbol'})` → `null`;
  smoke `unknownSymbolFailsDark` форсирует невалидный `_furnPalette`, проверяет
  отсутствие ghost и записи, и что инструмент остаётся вооружён для восстановления
  валидного выбора.
- **AC10 (композиция)** — golden-сценарий `furniture-placement-preview-light`
  зарегистрирован в `matrix.mjs` и `test/golden-matrix.test.mjs`; harness
  (`demo/golden/harness.mjs`) программно вооружает предмет, ставит курсор и
  проверяет DOM-контракт (символ, `aria-hidden`, `pointer-events`, opacity,
  порядок относительно `[data-hp="wall"]`) до самого растрового захвата —
  капчур прошёл (`missing-baseline`, эталон не принят локально — верно по
  правилам `demo/golden/README.md` и по `npm run golden:verify`, который не
  нашёл ни одной существующей регрессии).
- Трейлеры: `Issue: #359`, `User-Visible: yes` на продуктовом коммите; оба
  CHANGELOG (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правлены в том же
  коммите `8b66d67d`. Формулировки соответствуют реальному поведению (сверено
  построчно с кодом), терминология `docs/USER-GUIDE.ru.md` и `docs/FURNITURE.md`
  не придумана заново, согласована с существующим разделом «Мебель».
- Ветка/процесс: один продуктовый коммит на весь диф, класс A корректно
  отделён от класса D (бандл) — все три копии бандла синхронны
  (`bundle:sync`), бюджет в пределах (`bundle:budget`).

## Чего не проверял

- **`python -m pytest tests_backend`** — не прогонялся: диф не касается
  `custom_components/**/*.py`.
- **Performance-профили** — не прогонялись: не названы в AC, диф не трогает
  чувствительные к перфу пути (рендер одного дополнительного SVG-path на
  pointermove — цена признана в ТЗ и не требует профиля).
- **`npm run invariants`** — не прогонялся: диф не меняет рёбра комнат, записи
  толщины, `layout`, `marker.space`, `open_spans`; `_furnWalls` используется
  только на чтение существующим (не новым) резолвером стен.
- **Полный `demo/smoke_*.mjs` набор** — не прогонялся целиком; выбор сужен
  инструментом `smoke-select.mjs` (см. таблицу выше) до
  `smoke_furniture.mjs`, который прогнан. Остальные «прямые совпадения» разобраны
  чтением как точечные ветки существующей decor pointer-логики, не общие пути.
- **`docs/images/*.png` визуально** — не сверял пиксель-в-пиксель новые
  скриншоты с прежними (не требуется: находка в том, что фингерпринт вообще
  не пересобран в коммите, а не в содержимом самих кадров).

## Вердикт

Функционально фича сделана верно и полно: единый resolver, паритет
preview/commit, полная очистка по всем перечисленным в контракте границам
(включая девять точек, проверенных чтением), touch/pen fail-safe, unknown-symbol
fail-dark, новый golden-сценарий и расширенный smoke — всё воспроизводимо и
падение тестов проверяемо (пробовал ломать резолвер мысленно на canvas-guard —
тест зафиксировал бы `-5000`, а не что-то другое; unknown-symbol тест ловит
регрессию `furnitureGraphic` напрямую).

Единственная находка — не в продуктовой логике, а в release-артефакте:
скриншотный гейт документации остался красным на этом SHA. Это High по
формальному эффекту (гарантированно красный обязательный job `docs` в
`validate.yml` при слиянии) и по прецеденту (#230/#234/#237), поэтому
вердикт — красный, а не жёлтый с отложенным High.

Вердикт: красный · заход r1 · блокирующих циклов 0/4 · High: 1 · Medium: 0 → в задаче
