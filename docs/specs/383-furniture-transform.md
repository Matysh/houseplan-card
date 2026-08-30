# Issue #383 — плавные трансформации и зеркалирование мебели

- **Issue:** https://github.com/Matysh/houseplan-card/issues/383
- **Статус документа:** готово к ревью ТЗ
- **Приоритет / тип:** P2 · feature / polish
- **Область:** Редактор подложки, furniture geometry/render, свойства мебели,
  selection hit-area, backend schema, import/export, i18n, документация и QA
- **Связи:** заменяет #382; продолжает контракт мебели из #177/#179/#359/#361
- **Ревизия:** 1 (2026-08-30)

## Сценарий

Пользователь расставляет мебель на плане, выбирает разреженный символ, например
стол или угловой диван, и подгоняет его под реальный размер. Он плавно тянет
угол с сохранением пропорций, удерживает `Shift` для независимых осей либо
использует среднюю ручку конкретной грани. Если ручка проходит через
противоположную сторону, рисунок зеркалится, но предмет остаётся тем же
объектом. Тот же результат можно точно задать отрицательным размером или двумя
галочками в свойствах. При вращении `Shift` помогает получить точный угол 45°.

## Что человек увидит до и после

**До:** размер скачет по ячейкам сетки, доступны только угловые ручки,
отражение отсутствует, свободное вращение неожиданно требует `Shift`, а по
пустым промежуткам разреженного рисунка трудно попасть.

**После:** мебель меняет размер непрерывно; четыре дополнительные ручки меняют
одну ось; знак размера и галочки задают отражение; вращение без модификатора
свободное, с `Shift` — по 45°; курсор ручки явно обозначает поворот; невидимая
область выбора следует линиям символа и выступает на физические 10 см с каждой
стороны. Видимый рисунок и размеры существующей мебели сами не меняются.

## Проблема в текущей реализации

- Общий `resizeDecorBox()` получает `gridPitch` и округляет обе оси до сетки.
- Одна рамка трансформаций обслуживает мебель, прямоугольники, эллипсы и текст;
  в ней только четыре угловые ручки и общая ручка поворота.
- `w`/`h` являются положительными extents во frontend и backend; запись
  отрицательных значений ломает центр, рамку, snapping и schema validation.
- `_dtMove()` сейчас округляет обычный поворот по 5°, а `Shift` включает
  свободный угол — обратный требуемому контракт.
- Furniture path использует `pointer-events: visiblePainted`; отдельный
  расширенный select hit-path существует для линии, но не для мебели.
- Числовые размеры мебели при Save также округляются по сетке.

## Скоуп

- Отдельный плавный transform-путь только для `kind: furniture`.
- Угловой и одноосевой resize в локальных осях предмета, включая повёрнутую
  мебель, crossing через ноль и неизменную опорную грань/точку.
- Свободный поворот и `Shift`-привязка к 45° только для мебели.
- Две галочки отражения и знаковые width/height в свойствах мебели.
- Положительные persisted `w`/`h` плюс необязательные `flip_h`/`flip_v`.
- Отражение furniture SVG в editor preview, View и kiosk.
- Select hit-area вдоль фактических линий символа с физическим расширением
  10 см наружу с каждой стороны.
- Сквозное сохранение через Undo/Redo, Optimize, canonicalization и все виды
  export/import.
- Паритет EN/RU/DE/FR, пользовательская документация и full-track QA.

## Не-скоуп

- Изменение resize/rotation прямоугольников, эллипсов, текста и подложки.
- Изменение перемещения мебели, wall magnet, placement preview, сетки либо
  дефолтных размеров новых предметов.
- Произвольный skew, деформация отдельных линий символа или редактирование его
  SVG-path.
- Кликабельность всего пустого прямоугольного bounding box.
- Новый режим touch UI: редактор остаётся desktop-first/best-effort по
  `docs/TOUCH-SUPPORT.md`; отображение на touch обязано быть правильным.
- Зеркалирование обычных decor shapes, проёмов или backdrop.

## Контракт поведения

### 1. Угловые ручки

1. Pointer переводится из координат плана в локальные оси исходного предмета
   обратным поворотом вокруг зафиксированного противоположного угла.
2. Округления к `gridPitch`, магнитов и дискретного шага размера нет. Каждое
   фактическое перемещение pointer может изменить размер.
3. Без `Shift` сохраняется исходное отношение абсолютных `w:h`; с `Shift`
   локальные ширина и высота следуют pointer независимо.
4. Пропорциональный scale выбирается по доминирующей нормализованной дельте
   pointer: из `abs(localWidth)/orig.w` и `abs(localHeight)/orig.h` берётся
   значение оси, дальше ушедшей от исходного масштаба. Это сохраняет ratio,
   предсказуемо следует активному направлению руки и не зависит от сетки.
5. Противоположный угол остаётся в прежних мировых координатах при любом
   angle, ratio mode и flip. Центр и положительные extents пересчитываются
   вокруг него; сам angle не меняется.
6. Пересечение опорной вертикали меняет горизонтальное отражение, пересечение
   опорной горизонтали — вертикальное. Оба пересечения могут произойти одним
   жестом. Pointer capture и history gesture не прерываются.

### 2. Средние ручки граней

1. Только у выбранной мебели добавляются четыре видимых knob и четыре прежнего
   screen-size невидимых hit-circle посередине верхней, правой, нижней и левой
   граней рамки. Они поворачиваются вместе с рамкой.
2. Левая/правая ручка меняет только локальную ширину и `flip_h`; верхняя/нижняя
   — только локальную высоту и `flip_v`. Другая ось, aspect ratio и angle не
   меняются; `Shift` здесь ничего не переключает.
3. Противоположная грань остаётся неподвижной в мировых координатах. При
   crossing меняется соответствующий flip, жест непрерывно продолжается.
4. У прямоугольников, эллипсов и текста средние ручки не появляются.

### 3. Нулевой порог и границы

- Raw signed distance хранится в состоянии текущего жеста и может пройти через
  ноль; persisted `w`/`h` никогда не бывают нулевыми или отрицательными.
- Технический минимум абсолютного физического размера мебели — **0,1 см**.
  Пока pointer находится в полосе `[-0,1; +0,1] см`, рисунок показывается с
  размером 0,1 см, а прежний знак сохраняется в точке точного нуля. После выхода
  на другую сторону меняется flip. Это предотвращает нулевую SVG-матрицу и
  дребезг знака, не блокируя crossing.
- Существующий `CANVAS_LIMIT` и clamp top-left/extent сохраняются. Если размер
  упирается в предел, фиксированная опора и отношение сторон имеют приоритет
  над дальнейшим движением pointer.

### 4. Вращение

1. Для мебели без `Shift` используется непрерывный угол pointer; в live state
   он не округляется к 5°. Persisted angle сохраняется с текущей точностью
   transform-контроллера и нормализуется в `[-180; 180]`.
2. С `Shift` угол округляется к ближайшему кратному 45° относительно мировой
   ориентации: `…, -90, -45, 0, 45, 90, …`. На точной середине действует
   детерминированное математическое округление от нуля.
3. Если `Shift` нажать/отпустить во время pointer capture, тот же жест сразу
   переключает snapped/free preview без скачка исходной опорной геометрии.
4. Для rect/ellipse/text остаётся нынешнее поведение: без `Shift` шаг 5°, с
   `Shift` свободное вращение.
5. У furniture rotation handle применяется локальный SVG/data-URI курсор с
   круговой стрелкой и hotspot в центре; safe fallback — `grab`, при активном
   drag — `grabbing`. Курсор других transform frames не меняется.

### 5. Свойства мебели

1. Width и Height отображаются в выбранных единицах плана (m либо ft) со
   знаком: `flip_h` даёт отрицательную ширину, `flip_v` — отрицательную высоту.
2. Поля принимают конечные положительные и отрицательные числа без округления
   к сетке. Абсолютное значение переводится в физический `w`/`h`, знак — в
   соответствующий flip. Значение `0` невалидно, и Save недоступен, пока поле
   равно нулю/пусто/нечисловое либо выходит за прежний `CANVAS_LIMIT`.
3. Галочки **«Отзеркалить по горизонтали»** и **«Отзеркалить по вертикали»**
   находятся в свойствах мебели рядом с размерами. Каждая меняет только знак
   своего поля; абсолютный размер, центр, angle, symbol и style не меняются.
4. Ручная смена знака немедленно синхронизирует checkbox. Повторное открытие и
   reload показывают то же состояние. Cancel не пишет ни размер, ни flip.
5. Save сохраняет размер вокруг текущего центра, как и сейчас, но для мебели не
   вызывает `snapToGrid`; rect/ellipse сохраняют существующее округление.

### 6. Persisted модель и рендер

Каноническая furniture shape расширяется:

```yaml
kind: furniture
w: 0.18       # всегда > 0
h: 0.075      # всегда > 0
flip_h: true  # optional; false канонически отсутствует
flip_v: true  # optional; false канонически отсутствует
```

- Backend принимает только boolean для присутствующих флагов и продолжает
  валидировать положительные `w`/`h` прежним `_FURN_SIZE`.
- `false` принимается для lossless round-trip, но новая frontend-запись удаляет
  false-поля. Отсутствие обоих флагов пиксельно равно текущему рендеру.
- Отражение выполняется внутри положительного локального box относительно его
  центра, затем применяется прежний angle относительно того же центра.
  Положение, bounding box, frame, wall magnet и anchors не меняются.
- Оба flip одновременно эквивалентны повороту art на 180° только визуально;
  angle и оба флага не нормализуются/склеиваются, чтобы свойства и Undo были
  предсказуемы.
- Preview нового предмета всегда начинается без flip; изменение symbol/style
  существующего предмета не сбрасывает его флаги.

### 7. Область выбора

1. В `mode=decor`, `tool=select` для каждого furniture создаётся отдельный
   невидимый SVG hit-path с тем же `d`, rotate/translate/scale и отражением, что
   у видимого path. В View, kiosk и других decor tools узла нет.
2. Hit-path повторяет только нарисованные линии: `fill="none"`, transparent
   stroke, round linecap/join, `pointer-events: stroke`. Пустоты внутри symbol
   и весь bounding box не становятся кликабельными.
3. Отступ от внешней границы видимого штриха равен 10 см с каждой стороны.
   Поэтому полный физический stroke hit-path равен `visible_width_cm + 20 см`;
   значение переводится в screen stroke с тем же zoom/cell-scale helper, чтобы
   физический отступ не зависел от `cell_cm`, grid precision и browser zoom.
4. Hit-path вызывает те же select/move/double-click properties handlers, но не
   имеет собственного визуального hover. Frame и его ручки рендерятся выше и
   имеют приоритет; среди перекрытых furniture действует текущий DOM/z-order.
5. Erase и placement preview сохраняют нынешние отдельные hit contracts.

## История, перенос и совместимость

- Один pointerdown→pointerup остаётся одной записью Undo/Redo, включая extents,
  position, angle и оба flip. `Escape`/cancel восстанавливает весь исходный
  object; pointercancel не создаёт частично сохранённого результата.
- Frontend и backend coordinate canonicalization продолжают обрабатывать только
  `x/y/w/h/angle`; boolean-флаги проходят без преобразования. Optimize обязан
  сохранить их и не материализовать отсутствующие false.
- Full export/import, space export/import и plan-only export/import сохраняют
  `flip_h`/`flip_v`; для plan-only они добавляются в furniture allowlist.
- Миграции нет. Старые shapes без флагов рендерятся и сериализуются как прежде.
  Старый frontend, не знающий флаг, покажет предмет без отражения; текущий
  backend с `ALLOW_EXTRA` сохраняет неизвестные поля. Старый plan-only exporter
  может отбросить их — это документируемая downgrade-граница.
- #382 считается функционально заменённой #383, но не закрывается этой задачей
  до принятого проектом момента пакетного закрытия issue.

## UX, доступность и i18n

Добавить ключи во все четыре словаря:

| Ключ | RU | EN | DE | FR |
|---|---|---|---|---|
| `furn.flip_h` | Отзеркалить по горизонтали | Flip horizontally | Horizontal spiegeln | Retourner horizontalement |
| `furn.flip_v` | Отзеркалить по вертикали | Flip vertically | Vertikal spiegeln | Retourner verticalement |

- Checkboxes имеют native label и keyboard activation; порядок tab следует
  DOM после размеров. Числовые inputs сохраняют локализованную подпись единиц.
- Knob остаются мышиными/pointer controls текущего редактора; их hit radii не
  уменьшаются. Визуальный knob и невидимый hit-circle имеют существующий
  контраст в светлой/тёмной теме.
- Курсор встроен локально, без сетевой загрузки и без внешнего asset URL.

## Затронутые файлы и модули

- `src/editors/decor/types.ts`, `src/editors/decor/geometry.ts`.
- `src/houseplan-card.ts`, `src/houseplan-editor-runtime.ts`, стили transform
  frame и furniture hit-area.
- `src/i18n/{en,ru,de,fr}.json`.
- `custom_components/houseplan/validation.py`,
  `custom_components/houseplan/import_export.py`; canonicalization/optimize
  только если тест докажет, что существующий lossless path недостаточен.
- `test/decor-geometry.test.mjs`, furniture/render/interaction contracts,
  `tests_backend/test_validation.py`, `tests_backend/test_ha_import_export.py`,
  optimize/WebSocket tests, golden matrix и целевой browser smoke.
- `docs/FURNITURE.md`, `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`,
  `docs/CONFIG-COMPATIBILITY.md`, `docs/ARCHITECTURE.md`, при необходимости
  `docs/TESTING.md`, оба changelog.

## Критерии приёмки

- **AC1 — плавный угловой resize (unit + smoke).** Sub-grid движение меняет
  размер мебели без grid rounding; без `Shift` ratio исходного object сохранён,
  с `Shift` оси независимы; противоположный угол неизменен при 0° и повороте.
- **AC2 — одноосевые ручки (unit + golden + smoke).** Четыре средние ручки
  видны только у furniture и меняют ровно одну локальную ось, в том числе при
  angle 30°/90°; противоположная грань остаётся неподвижной.
- **AC3 — crossing и minimum (unit + smoke).** Каждая corner/edge ручка может
  пройти через опору, переключить правильный flip и продолжить жест; оба flip
  работают вместе; `w/h` всегда конечны, положительны и не меньше 0,1 см.
- **AC4 — rotation (unit + smoke).** Furniture вращается свободно без `Shift`,
  с `Shift` получает ближайшие 45°, модификатор можно менять во время drag;
  остальные decor kinds сохраняют шаг 5°/Shift-free.
- **AC5 — properties sync (unit + smoke).** Знаковые m/ft inputs, checkboxes,
  Save/reopen/reload и Cancel синхронны; zero/invalid блокирует Save; изменение
  flip не сдвигает центр, не меняет absolute size, angle, symbol или style.
- **AC6 — render parity (golden).** Асимметричный symbol показан в normal,
  H, V и H+V ориентациях в light/dark; existing no-flag fixture пиксельно не
  меняется; mirrored art имеет тот же positive box и rotation pivot.
- **AC7 — точная hit-area (unit/DOM + smoke).** Клик с отступом <10 см от
  фактического штриха выбирает мебель, >10 см и пустота bbox — нет; контракт
  одинаков при разных `cell_cm`/zoom/angle/flip, frame handles выигрывают.
- **AC8 — cursor и frame (DOM + manual screenshot).** У furniture rotation
  handle круговая стрелка с safe fallback, у остальных handle прежний cursor;
  средние knob не меняют размер/контраст существующих handles.
- **AC9 — history и cancel (integration).** Resize/crossing/rotate/property Save
  являются одиночными history commands; Undo/Redo возвращает геометрию и flip;
  Escape/pointercancel возвращает исходный object и не пишет config.
- **AC10 — backend и transfer (backend).** Bool-флаги проходят validation,
  иные типы отклоняются; отрицательные/нулевые physical `w/h` по-прежнему
  отклоняются; full/space/plan-only, config/set и Optimize сохраняют flags.
- **AC11 — регрессии (unit + smoke).** Move, wall magnet, new placement,
  rect/ellipse/text/backdrop transforms, erase и View/kiosk interaction не
  меняются; существующая мебель не получает flags при unrelated Save.
- **AC12 — i18n/docs/release.** Четыре словаря паритетны; обе версии guide,
  furniture/compatibility/architecture описывают жесты и модель; оба changelog
  обновлены в пользовательском коммите.
- **AC13 — гейты и бюджет.** В implementation loop зелёные `npx tsc --noEmit`,
  `npm test`, `npm run build` и целевой backend pytest. Golden, browser smoke и
  performance выполняются перед beta по runbook; initial/editor budgets не
  регрессируют за установленный допуск.

## План автотестов

- Вынести furniture resize/rotation/sign projection в чистые helpers и покрыть
  таблицами: 0°/30°/90°, четыре угла, четыре грани, ratio/free, sub-grid,
  crossing каждой/обеих осей, exact-zero band, fixed world anchor и limits.
- Property projection tests: flags→signed displayed units→absolute extents и
  обратный путь, zero invalid, checkbox sign toggle, false-field omission.
- Renderer contract: точный порядок local mirror/scale/translate/rotate,
  одинаковый transform visible/hit paths, screen-physical hit width и отсутствие
  hit node вне Select.
- Backend validation: absent/true/false accepted; `0`, `1`, strings/null rejected
  как flags; negative/zero `w/h` rejected.
- Export/import fixtures: H/V/H+V через full, space, plan-only; Optimize и обе
  canonicalization реализации сохраняют bools.
- Golden: asymmetric furniture в четырёх ориентациях, normal/selected frames с
  side handles, 0°/30°, light/dark, no visible hit halo.
- Playwright smoke: select near stroke, reject bbox gap, drag corner sub-grid,
  Shift independent, side handle, cross zero, free/45 rotation, property
  sign/checkbox, Undo/Redo, Cancel и reload.

Мутанты: оставить `gridPitch` → AC1; поменять общий controller → AC4/AC11;
сохранить отрицательный `w` → AC3/AC10; отразить относительно origin → AC6;
расширить bbox вместо path → AC7; считать 10 см screen pixels → AC7; забыть
plan-only allowlist → AC10; визуализировать hit-path → AC6/AC7; позволить
handle проиграть halo → AC7.

## Риски

- **Общий transform-контроллер.** Неусловная смена modifier или шага нарушит
  rect/ellipse/text. Снимается furniture-specific helper/branch и AC4/AC11.
- **Знак против геометрии.** Отрицательные extents могут инвертировать frame,
  центр и snapping. Persisted extents всегда положительны; signed distance —
  только transient/UI projection.
- **Crossing у rotated object.** Screen-axis расчёт сдвинет fixed anchor.
  Обратный rotate и world-corner assertions покрывают риск.
- **Неравномерный SVG scale.** `vector-effect` и local path scale могут сделать
  10 см разными по осям. Hit width вычисляется в screen/physical пространстве
  единым helper и проверяется на широком/высоком symbol; если один stroked path
  не может дать корректный физический offset при non-uniform scale, реализация
  обязана построить эквивалентный invisible hit geometry, а не приблизить bbox.
- **Слишком большая hit-area.** Соседние предметы могут перекрываться. Точный
  10-см path halo и текущий z-order ограничивают область; handles выше halo.
- **Downgrade.** Старый View проигнорирует flags и временно покажет original.
  Данные остаются положительными и backend-compatible; граница документируется.

## Откат

Миграции нет, поэтому frontend UX/render можно revert-нуть без преобразования
геометрии. После выхода флагов backend validation и import/export allowlist
следует временно оставить: старый renderer их проигнорирует, но config не станет
невалидным и данные не потеряются. Полное удаление полей возможно только после
отдельной data-fix, снимающей `flip_h`/`flip_v` с сохранённых furniture shapes.

При откате повторяются validation, full/space/plan-only round-trip и открытие
конфига с обоими flags. Слепой одновременный revert frontend+backend после
публичного сохранения flags запрещён.

## Производительность и безопасность

Live resize/rotate остаётся O(1) на pointer event. Отражение добавляет только
SVG transform; невидимый path — один дополнительный DOM-узел на предмет и
только в активном Select. Новых подписок, HA данных, сетевых запросов, таймеров
и HTML-инъекций нет. Data-URI cursor статичен и локален. Performance gate должен
проверить editor DOM/frame time на существующей большой furniture fixture.

## Release-артефакты

- Пользовательские записи в `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в том
  же `User-Visible: yes` коммите, что код.
- Обновлённые обе версии user guide, `FURNITURE`, compatibility и architecture.
- Reviewed golden/screenshots: четыре ориентации асимметричного symbol,
  выбранная рамка с восемью resize handles, light/dark и поворот.
- Browser smoke report для жестов, properties, history и физической hit-area.
- Штатные pre-beta golden/smoke/performance результаты по runbook; отдельного
  security artifact не требуется, потому что внешнего ввода/URL/API нет.

## Принятые предположения

- Изменения transform UX относятся только к furniture; общий код можно
  переиспользовать внутренне, но наблюдаемое поведение других decor kinds
  остаётся прежним.
- Новая мебель и существующая мебель без флагов имеют `flip_h=false`,
  `flip_v=false`; false канонически представлено отсутствием поля.
- Точный zero не является сохраняемым размером: это кратковременная зона
  crossing при drag и невалидный draft в properties.
- Пропорциональный crossing может одновременно поменять оба flip, если pointer
  проходит через противоположный угол; crossing только одной оси с сохранением
  ratio меняет знак только пересечённой локальной оси.
- Десять сантиметров измеряются от внешней границы уже видимого furniture
  stroke, а не от его centerline; поэтому полный hit stroke шире на 20 см.
