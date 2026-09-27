# CODE-REVIEW-676-r1

Материал ревью: `dd905888cbf016a76457b1c17e2bb8d57143645f` (ветка `issue/676-stairs-editing`,
`git log --oneline origin/dev..HEAD`: `93051edf` fix · `89e8aecb` refactor ·
`69e03451` chore(golden) · `ab89187f` test(bundle) · `dd905888` test(mutation)).
Заход r1, полный разбор (первый код-ревью этого этапа; предыдущие пять
комментариев «ревью не запускалось» цикл не тратили — код никто не читал).

## Скоуп

Слой редактирования лестниц (`src/stairs-editor.ts`) переписан на
box-контракт декора/мебели: чистые функции протяжки/ресайза/магнита/курсора/
диалога вынесены в новый ленивый модуль `src/stairs-box.ts`; рамка выделения
перенесена в верхний оверлей карточки (`src/houseplan-card.ts`, +2 строки);
подсказка Просмотра — в `src/stairs-view.ts`; стили — `src/styles/plan.styles.ts`;
i18n ×4; golden `stairs-flat-selected-light` принят; тесты — новый
`test/stairs-box.test.mjs`, расширенный `demo/smoke_stairs.mjs`, шесть новых
мутантов + обновление одного старого + два переведённых в browser-offload
witness; попутный B-фикс `test/bundle-assets.test.mjs` (потолок графа судится
только по свежему бандлу, #657). Класс A+B+C+D, продуктовая задача, полный
трек — соответствует заявке автора.

Закрывает J6 (`docs/SCOPE.md`: «Keep the plan true as the home evolves» —
редактор плана) и, подсказкой в Просмотре, J1 (пространственный обзор дома).
Девять исходных дефектов (#663) сведены к контрактам К1–К8 и покрыты AC1–AC12.

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate на этом SHA
(https://github.com/Matysh/houseplan-card/actions/runs/36328481049,
`conclusion: success`, задачи `Фронтенд: типы, юниты, мутанты, синхрон бандла`
и все шесть шардов «Мутанты по диффу» — success); тяжёлые джобы (`golden`,
`smoke`, `performance_smoke`, `backend`, `hassfest`, `hacs`, `geometry_parity`)
в этом прогоне **skipped** (не heavy-триггер) — они не покрыты и перепроверены
мной локально ниже.

| Гейт | Прогнан | Результат |
|---|---|---|
| `npx tsc --noEmit` / `npm run build` | через Validate (SHA) + локально `npm run bundle:sync` | зелёный |
| `npm test` | через Validate (SHA) + локально `npm run gate:small` («юниты (npm test)» 70 с) | зелёный |
| `node --test test/stairs-box.test.mjs` (с tsc test-build) | локально | 12/12 pass |
| `npm run gate:small` | локально, полностью | зелёный (build+typecheck, no-new-any, no-new-private-writes, smoke-select, юниты, bundle-policy --verify, бюджет, lint:unused — все ok) |
| `node demo/smoke_stairs.mjs` (AC1, AC4–AC8, AC11, AC12) | локально, свежий бандл (`bundle:sync`) | 55/55 проверок `true`, `OK` |
| `npm run golden:verify` | локально, свежий бандл | 184/184 `passed`, включая `stairs-flat-selected-light` |
| Мутанты задачи (`stairs-handle-cursor-ignores-bearing`, `stairs-dialog-clamps-to-wall-thickness`, `stairs-resize-mirrors-past-anchor`, `stairs-move-magnet-turns-any-angle`, `stairs-gesture-click-reaches-plan-tool`, `stairs-view-tooltip-ignores-target-state`) + обновлённый `stairs-link-auto-creates-target-object` | `node scripts/mutation-gate.mjs --id=<каждый>` | 7/7 «заявленный тест покраснел на мутанте» |
| `node scripts/mutation-gate.mjs --check` | локально | `browser guards: 200/200`; 3 предупреждения реестра — все `#650` (шаблонные имена тестов в `geometry-corpus.test.mjs`/`mutation-nightly-reuse.test.mjs`), не относятся к этой задаче |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | локально | 68 прямых совпадений, все по общим идентификаторам (`_mode`, `_model`, `_curSpaceCfg`, `stopPropagation`, `cellCm`, `_editorRuntime`…), кроме `demo/smoke_stairs.mjs` — единственного смока, реально завязанного на изменённый код |
| Спот-чек смоков из выборки (`smoke_furniture`, `smoke_furniture_polish`, `smoke_decor`, `smoke_wall_chain_thickness`, `smoke_room_resize`) | локально | все `OK` |

### Чего не проверял и почему

- Остальные ~135 смоков из широкой выборки `smoke-select` не прогонял:
  фактический продуктовый диф сужен до `stairs-editor.ts`, `stairs-box.ts`
  (новый, импортируется только ленивым редактором), `stairs-view.ts`,
  `stairs-editor-model.ts` (2 строки — комментарий), `plan.styles.ts` (только
  классы лестниц + одна аддитивная строка к существующему правилу
  `.dtfurnitureframe .dtrot`) и `houseplan-card.ts` (+2 строки, оба под
  `_mode === 'plan'` и `_tool === 'stairs'`/наличие `_editorRuntime`).
  Совпадения инструмента — по общеупотребимым идентификаторам, не по
  специфике правки; спот-чек пяти наиболее смежных (мебель, декор, магнит
  стены, ресайз комнаты) прошёл зелено.
- `python -m pytest tests_backend` — не прогонял: диф не касается
  `custom_components/**/*.py`.
- `npm run invariants` — не прогонял: гейт проверяет ссылки/геометрию стен,
  перегородок и `wall_keys`/`hidden_obstacles`/`physical_geometry`; модель
  `stairs` и её валидация — заявленный и подтверждённый чтением не-скоуп,
  `stairs.ts` не тронут. Изменилась только *редакторская* box-математика над
  уже существующими полями `x/y/angle/length/width/radius`, которые
  инвариант-гейт не проверяет.
- Полная матрица `golden`/`smoke`/`performance_smoke` (все 278 браузерных
  смоков) — предрелизная обязанность, не гейт код-ревью; прогнан AC-набор и
  прямое совпадение (`smoke_stairs.mjs`) плюс точечная выборка.
- Отпечаток скриншотов документации (`check-docs --screenshots=strict`) —
  подтверждённо устарел (warn на push, error только на кандидате); автор
  прямо перечислил это в «НЕ сделано» со ссылкой на прецедент #479 —
  корректно, не блокирует ревью.

## Находки

Нет ни одной блокирующей (High) или требующей возврата (Medium в скоупе)
находки.

**Low (снята мной, с записью — не блокирует, автор менять не обязан).**
`src/stairs-editor.ts:305`, `saveDialog`: сравнение «ничего не изменилось»
берёт `current.target_space_id ?? null` для эталона, а вычисляет
`dialog.targetSpaceId || null` для нового значения. Если бы в конфиге когда-
либо оказалась пустая строка `target_space_id: ''` (модель это допускает —
`stairs.ts:84` требует только `string | null`), «Сохранить» без единой правки
поля превратило бы `''` в `null` и всё равно записало бы историю — минимальное
нарушение К7 «ничего не пишет». Не воспроизводится через сам редактор: каждый
путь записи (`defaultStair`, `draftStair`, `saveDialog`) уже отдаёт только
`null` или непустую строку, значит `''` может попасть в конфиг только через
ручное редактирование YAML/импорт в обход UI. Не блокирую: сценарий не
описан ни одним AC, а починка ради теоретического края потребовала бы либо
менять модель (не-скоуп задачи), либо использовать несимметричную проверку
только в редакторе — стоимость несоразмерна вероятности.

## Проверено и корректно (по контрактам К1–К8)

- **К1/AC1** — доминирующая ось протяжки, tie-break по x, знаковые углы
  0/90/180/270, `direction: forward`, минимум 30 см по обеим осям, винтовая —
  квадрат от A к B; клик короче клетки — дефолт с магнитом перемещения.
  Юниты `test/stairs-box.test.mjs` (`draftStair`, `draftLeadingHandle`) плюс
  смок (`dragDrawsTheDrawnSize`, `dragUpwardRisesUpward`,
  `dragDrawsTheSpiralSquare`) — реальные числовые проверки размеров/центра/угла,
  не пустые true.
- **К2/AC4/AC7** — рамка в `<g data-hp="stair-frame">` вставляется картой в
  верхний оверлей после `_renderTextFrame`, выше `.wallbodies`
  (`compareDocumentPosition` в смоке подтверждает `DOCUMENT_POSITION_FOLLOWING`);
  радиус узла — `0.018 × max(view.w, view.h)`, постоянен на экране (проверено
  на зуме ×1 и ×3 в смоке, различие ≤ 1 px); курсор по сектору мировой
  нормали (`resizeCursor`) покрыт юнитами на 0/45/90/135/180/225/270/315°,
  на повёрнутых на 10/30/90° лестницах, плюс смок на реально повёрнутом узле
  через `getComputedStyle`.
- **К3/AC3** — `snapEdgeToFaces`/`magnetStairMove`: сторона в пределах 6
  клеток и 5° ложится на грань; поворот ограничен 5° (юнит проверяет ровно
  «повернулось до параллели, не дальше»); 30°-лестница не трогается; грань,
  смотрящая внутрь массива (скрытая в теле стены), не магнитит — юнит с двумя
  вариантами обхода полигона (по часовой/против) плюс отдельный тест на
  лестницу, перекрывающую тело стены снаружи/изнутри.
- **К4/AC2/AC11** — `resizeStair`: неподвижный якорь проверен геометрически
  (совпадение середины неподвижной стороны до/после с точностью 1e-9), угол
  не меняется, протаскивание за якорь клэмпится к минимуму без зеркала,
  `Shift` — пропорционально по большей оси. Отдельный юнит на винтовой (растёт
  один тангенс, противоположный неподвижен).
- **К5** — вращение продолжает существующий контракт (не менялось по ТЗ),
  проверено смоком (`shiftRotationSnaps45`).
- **К6/AC6** — `_suppressClick`/`swallowNextClick` плюс `@click=${stop}` на
  обоих видах узлов; смок проверяет и «Лестницу» (`resizeUnderStairsToolAddsNoStair`,
  `rotateUnderStairsToolAddsNoStair`), и «Выбор» (`resizeUnderSelectKeepsSelection`),
  с реальным синтезированным `click` после `pointerup`, как это делает браузер.
- **К7/AC5** — `stairFieldToCm`/`stairSizeFromField`: границы 30–10000 см,
  424,62 × 155,38 см сохраняются бит в бит (юнит plus смок
  `untouchedDialogSaveKeepsSizes` + `untouchedDialogSaveWritesNoHistory`,
  сравнение `JSON.stringify` до/после и размера `_geometryHistory`).
- **К8/AC8** — `stairTargetState === 'active'` как единственное условие
  подсказки; все пять состояний (`active/missing/self/deleted/fixed`)
  проверены отдельными смоук-шагами (`hoverTip`) с реальными
  pointerenter/pointerleave и проверкой `card._tip`.
- **AC9** — golden `stairs-flat-selected-light` принят из полного Validate
  (run 36320878644) после ребейза с тем же отпечатком исходников; локальная
  перепроверка (`golden:verify`, свежий бандл) — 184/184 `passed`, остальные
  три лестничные сцены не изменились.
- **AC10** — i18n-паритет en/ru/de/fr подтверждён диффом (`stairs.tooltip_navigate`,
  `history.stair_resize`, `history.stair_rotate`, идентичные плейсхолдеры) и
  зелёным `test/i18n.test.mjs` в `npm test`.
- **AC12** — переключение на «Стены» убирает `.hp-stair-frame` из DOM
  (`_activateMarkupTool`: `if (tool !== 'select' && tool !== 'stairs')
  this.stairs.clearSelection()`, плюс `inputEnabled` уже гейтит `renderFrame`);
  клик по точке бывшего узла двигает `_path.length` (смок:
  `frameGoneUnderWallsTool`, `wallsToolClickIsAWallPoint`, `frameReturnsUnderSelect`).
- Бюджет: eager-код лестниц вынесен в `stairs-box.ts` (импортируется только
  ленивым редактором) вторым коммитом именно потому, что первая версия съела
  ~2,5 КБ initial View; итоговый запас initial View 1 896–1 973 Б (уже был
  тесен до ветки — падение на 77 Б, не новое сужение), потолок ленивого
  редактора поднят в том же коммите, что и график (`bundle-budget.mjs`,
  `core-file-budget.test.mjs`, `monolith-baseline.json` — числа сверены и
  совпадают с заявленными).
- Мутанты `stairs-gesture-click-reaches-plan-tool` и
  `stairs-view-tooltip-ignores-target-state` переведены в browser-offload
  witness (`test/mutation-browser-offload.test.mjs`) по прецеденту #659 —
  это не файл монолита (`houseplan-card.ts`/`houseplan-editor-runtime.ts`),
  freeze-список `test/monolith-text-anchors.test.mjs` не расширен, правило
  §2.7 о контрактах по монолиту не задето. Витнесс перепроверен вручную:
  обе строковые проверки (наличие точного блока подавления клика, счётчик
  `@click=${stop}` = 2, отсутствие прямого `_showTip` без гварда) действительно
  краснеют на соответствующих мутантах — не ритуальная регулярка.
- Документация (`docs/STAIRS.md`, `docs/ARCHITECTURE.md`, `USER-GUIDE(.ru).md`,
  `docs/data-hp-contract.json`) описывает ровно реализованное поведение,
  терминология («рамка», «узел», «магнит», «Переход на этаж …») совпадает с
  `docs/USER-GUIDE.ru.md`. Оба changelog правлены в том же коммите, что и
  `User-Visible: yes` (`93051edf`); одно число, видимое пользователю
  («Переход на этаж {title}»), — источник один: `stairTargetState` +
  `_model.find(...).title`, использован и подсказкой, и (без изменений)
  навигацией в `stairs-view.ts`.
- Трейлеры: каждый коммит несёт `Issue: #676`; `User-Visible: yes` только на
  `93051edf` (с обоими changelog); `89e8aecb`/`ab89187f`/`dd905888` —
  `User-Visible: no`, корректно (рефакторинг, тестовый гейт, тестовые
  свидетели); `69e03451` несёт `Release:`/`Baseline-Reviewed:` за правку
  `demo/golden/baselines/**`, как того требует `AGENTS.md`.

## Риски (приняты, не находки)

- Перф жеста (`write()` на каждый `pointermove`) — вне скоупа, унаследовано
  от #663, задокументировано автором.
- `_suppressClick` сгорает по `setTimeout(0)`; если браузер не синтезирует
  `click` (отменённый touch), флаг просто не используется — без побочных
  эффектов, автор отметил это явно.
- Обход тел стен для магнита берёт сторону из знака площади полигона;
  самопересекающиеся тела не встречались и не тестировались — принято как
  документированное ограничение, симметричное существующему магниту мебели.

## Материал раунда

SHA: `dd905888cbf016a76457b1c17e2bb8d57143645f`.
Предыдущего раунда код-ревью для этой задачи не было (пять комментариев
«Ревью не запускалось» — красный/несостоявшийся Validate и обрыв
model-review, ни один цикл ревью не потрачен). Разделы «Закрытие раунда
r0» и «Унаследовано» не применяются.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/676-stairs-editing`, коммит `dd905888cbf0` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `799688ce253fd14dd4ebacdb6e4166243dde9431`
  ```
  git log --all --format='%H %T' | grep 799688ce253f
  ```
- Тело issue: `72bccdffa1d7cdfdd71c8c8ee5d1cd66f64b6aba7db2003b718c0af2f2292183`
- Вердикт конвейера: `green` · High 0
