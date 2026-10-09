# CODE-REVIEW-813-r1

Материал: `a4c014a6b8d28ff3328261e6cb2a34564b151b67` (ветка `issue/813-kiosk-hold-door-frame-focus`, 4 коммита поверх `dev`). Трек `ask`, заход r1, блокирующих циклов 0/4.

## Скоуп

Три пользовательских исправления + одна уборка техдолга, все по ТЗ #813:

- F11 (`34d3f3cf`): повторное удержание мышью на пустой зоне киоска — gesture-state сцены теперь согласованно завершается, когда модальный диалог масштаба перехватывает управление. Новый модуль `src/kiosk-hold.ts`.
- F14 (`43950b57`): первый кадр новой двери/окна красился проекцией устройств старого плана (новый контакт туда не попадал) → ложная анимация закрытия. `RenderDeviceSnapshot` теперь несёт `geometry`, выбор снимка — через `selectRenderDeviceSnapshot` (`src/render-device-snapshot.ts`), использован и в `houseplan-card.ts`, и в `space-card.ts`.
- F25 (`617aec7f`): клавиатурный фокус в 2.5D перебивался более специфичным правилом слоя обычных маркеров — фокусный маркер оставался под соседом. Добавлено зеркальное правило той же специфичности для `.mode-view` (`src/styles/devices.styles.ts`), Zigbee-эндпоинт (#809) остаётся выше.
- F12/F18 (`a4c014a6`, `User-Visible: no`): удалена мёртвая копия `_saveKioskScale`/`_renderKioskDialog` и `LS_KIOSK` в `houseplan-editor-runtime.ts`; удалены неиспользуемые CSS-правила `dialogs.styles.ts`, с переносом `.backupcounts` в editor-only лист после того, как её мёртвый сосед `.backupactions` исчез.

AC5 ручная GPU-проверка владельцем закрыта решением «ручная проверка не нужна» (зафиксировано в комментарии разработчика), доказательство — headless вычисленный слой + дифференциальная растровая проба, что ТЗ и допускало как операционализацию.

## Как проверялось

Дешёвые гейты уже зелёные на этом SHA (Validate run, ссылка в задаче) — `tsc --noEmit`, `npm test`, `npm run build` + `bundle-policy --verify` не перегонял по этой причине. Проверил сам то, что Validate не покрывает по диффу/AC — рендер-путь и риск «perf» по изменённым строкам `render-device-snapshot.ts`:

| Гейт | Статус | Результат |
|---|---|---|
| `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/kiosk-hold.test.mjs test/render-device-snapshot.test.mjs` | прогнал | 17/17 passed |
| Мутационная проверка вручную: `render-snapshot-ignores-geometry` (правка `src/render-device-snapshot.ts` по патчу реестра) | прогнал | тест `#813 AC4 a frame paints the projection captured for its own geometry` падает — защита жива |
| Мутационная проверка вручную: `kiosk-hold-cancel-keeps-timer` (правка `src/kiosk-hold.ts`) | прогнал | 2 теста падают (`re-arming replaces...`, `an ordinary tap...`) — защита жива |
| Оба файла восстановлены (`git status` чист) после проверки мутантов | — | подтверждено |
| `npm run build` (`tsc --noEmit && rollup`) | прогнал | зелёный |
| `npm run bundle:sync` (нужен для демо-харнесса: `demo/srv/assets` не был синхронизирован в чек-ауте) | прогнал | ОК, `dist`/`demo/srv/assets` после проверки возвращены в исходное состояние (`git checkout -- dist demo/srv/assets && git clean -fd dist demo/srv/assets`), `git status` снова чист |
| `node demo/smoke_kiosk_scale_no_editor.mjs` (AC1/AC2, самый рискованный участок — pointer lifecycle) | прогнал | OK, все 37 проверок true, включая три реальных mouse-hold подряд, tap/cancel/lost-capture/blur/detach-reattach/pinch |
| `node demo/smoke_visual_continuity.mjs` (AC3/AC4) | прогнал | OK, вся матрица F14 (new/open/missing/unknown/unavailable контакт, реальная смена состояния, newer-event, space switch, warm remount) зелёная на обеих карточках |
| `node demo/smoke_iso_tiles.mjs` (AC5) | прогнал | OK, фокус поднимает слой 2→5, differential-raster 128/129 → 0/129 изменённых пикселей в обеих темах, Flat/hover контроли не трогаются |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прогнал (только отбор) | 33 прямых совпадения + 1 зарегистрированная связь + 34 слабых; авторский отчёт о 68 прогнанных смоках (33+34+1) покрывает и обязательные, и необязательные строки — проверка не находит расхождения |

Не прогонял сам: `golden:verify` (13 сцен, по заявлению автора — 3 прогона на одном браузере, 0 различий) и `scripts/dev/editor-styles-equivalence.mjs` (44 снимка AC6) — тяжёлые визуальные гейты, принял по описанию результата в хендоффе плюс собственную проверку кода (см. ниже) вместо повторного исполнения; `npm run invariants` не прогонял и не требовал — диффа геометрических моделей (стены/полигоны/комнаты) здесь нет, `geometry` в `RenderDeviceSnapshot` — непрозрачный идентификатор конфигурации (fingerprint/epoch), не геометрические вычисления; `pytest tests_backend` не прогонял — Python не затронут; мутации реестра (9 браузерных) не прогонял целиком (как и автор — мутанты в разработке не гоняются, #709), для двух непоказательных (один render-, один kiosk-hold) проверил вручную исполнением, что они ловятся.

## Находки

Нет. High: 0, Medium: 0, Low: 0.

## Что проверено и корректно

- **AC1/AC2 (pointer lifecycle).** `src/kiosk-hold.ts` — отдельный класс с одним таймером и владеющим указателем; `arm()` безусловно переарминг, `cancel()` идемпотентен. Все пути завершения прошиты через единственный `cancel()`/`_interruptViewGesture`: `pointerup` (`_stagePointerUp`), `pointercancel`/`lostpointercapture` (строка 7241-7244), явный `_stagePointerCancel` (комментарий поясняет: холодный киоск без editor runtime раньше не чистил там таймер), `window blur` (новый `_onWindowBlur`, навешан/снят в connected/disconnectedCallback симметрично строкам 2610/2691), `disconnectedCallback` (заменил точечный `clearTimeout` на полный `_interruptViewGesture()`, с явным комментарием о риске «палец пережил detach → следующий hold читается как pinch»). Логика `arm`/`cancel` в `_stagePointerDown` ограничена `this._kiosk`, не затрагивает обычный View/редакторы вне самого `_onWindowBlur`, который по тексту ТЗ (п.1 контракта: «активный gesture state завершается согласованно» без ограничения кисоском) и явно назван риском в хендоффе, а не упущением.
  Реальный прогон `smoke_kiosk_scale_no_editor.mjs` подтвердил: три подряд настоящих mouse-hold открывают диалог каждый раз, release уходит в модалку (`releases[0].dialog === true`), viewBox плана не меняется, `_pointers.size === 0` после серии, план продолжает получать изменения HA (`planFollowsHaAfterTheHolds`). Негативная часть (tap/cancelled-touch/lost-capture/window-blur/detach-reattach/pinch) — тоже зелёная, на реальных CDP touch/mouse событиях, не на синтетическом вызове приватных методов.
- **AC3/AC4 (projection geometry).** `RenderDeviceSnapshot.geometry` — новое поле идентичности; `selectRenderDeviceSnapshot` — чистая функция (`render-device-snapshot.ts:49-59`), читается один раз за рендер в геттерах `_renderDeviceSnapshot` обеих карточек. Источник `geometry`: `_cfgEpoch` у полной карточки (уже существующий счётчик, используемый в 6 других местах кода как геометрический эпоха — не новый дублирующий источник), `` `${configFingerprint}|${space}` `` у карточки пространства. Юнит-тест `#813 AC4 a frame paints the projection captured for its own geometry` покрывает все комбинации `staged × совпадение geometry` явно, включая случай «ничего ещё не захвачено для этого плана» (историческое предпочтение сохраняется) — хорошая негативная матрица. Браузерный `smoke_visual_continuity.mjs` добавляет полноценный сценарий двух живых карточек, второй запущенной страницы, честного `setServerConfig`, сэмплирования каждого кадра плюс `transitionrun`, и явно проверяет, что существующая дверь не задета (`existingDoorUntouchedByTheNewOne`) и настоящая анимация открытия/закрытия не пострадала.
- **AC5 (iso focus layering).** Новое правило специфичности (0,5,0) `.stage.projection-iso.mode-view .dev:focus-visible { z-index: 5 }` зеркалит существующий паттерн из #809 (там слой 8 для Zigbee-эндпоинта повторяется по той же причине — специфичность каскада), это не новая практика для файла. `smoke_iso_tiles.mjs` и `smoke_device_battery_zigbee.mjs` дают per-pixel差 (differential raster) до/после фокуса в обеих темах плюс контроль «эндпоинт остаётся на 8» и «фокус не стартует сервис/скан/диалог» — реальный Shift+Tab, не programmatic dispatch события фокуса в обход браузера.
- **AC6 (мёртвый код).** Грепом подтвердил: `.curbind`, `.btn.alignall`, `.backupactions`, `.help-inline-label`, `` .temprange .tempin `` не встречаются нигде вне удалённого правила (src/demo/test/scripts/docs/legacy) — вывод ТЗ о `.temprange` (разметка использует `hpf-temprange`, не `temprange`) подтверждён. `_renderKioskDialog`/`_saveKioskScale`, оставшиеся в `houseplan-card.ts:10612-10640`, — другие, живые методы (используют `this._summary?.saveScale`), не задеты; порт `HouseplanEditorHostPort` лишился только мёртвых полей.
- **Трейлеры и changelog.** Все три `User-Visible: yes` коммита несут правки `docs/CHANGELOG.md`+`docs/CHANGELOG.ru.md` в себе же (проверено `git show --stat` по каждому SHA), `Issue: #813` на всех четырёх. Четвёртый коммит — `User-Visible: no`, корректно для чистой уборки без видимого эффекта (подтверждено `editor-styles-equivalence` 0 различий).
- **Одно число — один источник (§8).** `KIOSK_HOLD_MS = 3000` — единственная именованная константа, использована в проде; хардкод `3000` в `setTimeout` исчез. `geometry` для полной карточки — переиспользование уже существующего `_cfgEpoch`, не новая parallel-переменная. Мутационный реестр вырос с 253/200 до 262/200 ровно на заявленные 11 (9 браузерных + 2 юнит) — числа в `docs/testing-notes/mutation-browser-guards.md` и в тексте хендоффа согласованы.
- **Регрессионная проверка #809** (слой Zigbee-эндпоинта 8) не задета: правило `.mode-view .dev:focus-visible` стоит раньше правил эндпоинта той же специфичности, итоговый порядок каскада подтверждён и тестом (`iso_focusedNeighbourEndpointStaysOnEndpointLayer`), и мутантом `iso-focus-outranks-zigbee-endpoint` в реестре.
- **Риски, названные самим автором** (window blur теперь прерывает жест сцены и вне киоска, включая pan/pinch в редакторах; новая конфигурация красится сразу новой геометрией — состояние на кадр раньше; `smoke_kiosk_scale_no_editor` подорожал 25→63 с) — все три соответствуют контракту ТЗ п.1 и не являются незамеченными побочными эффектами.

## Чего не проверял

- `golden:verify` (ci:golden) и `scripts/dev/editor-styles-equivalence.mjs` — тяжёлые визуальные прогоны, не повторял исполнением; принял по описанию в хендоффе (13 сцен × 3 прогона без расхождений, 44 CSS-снимка без расхождений) в сочетании с собственным исполнением «соседних» rendering-смоков (`smoke_visual_continuity`, `smoke_iso_tiles`), которые упали бы при реальном визуальном расхождении первого кадра/stacking.
- `npm run invariants` — не запускал: диффа геометрических моделей (стены, полигоны, комнаты, проёмы-координаты) в этой задаче нет; `geometry` — непрозрачный идентификатор конфигурации, не вычисление геометрии.
- `pytest tests_backend` — Python-код не менялся, не запускал.
- Полный прогон 9 браузерных мутантов реестра (кроме двух проверенных вручную) — по правилу трека: мутанты в разработке не гоняются ни автором, ни ревьюером; поимку подтверждает ночной прогон (#709). Прочитал `because`/патчи всех 11 записей — согласуются с описанной логикой AC1–AC5.
- Ручная GPU-браузерная проверка AC5 (была требованием ТЗ до код-ревью) — владелец явно снял требование в чате сессии (зафиксировано в хендоффе разработчика); не моя обязанность её требовать повторно на этом этапе.
- Полный `smoke-select` прогон (68 смоков) не повторял целиком — дорого и избыточно против трёх целевых прогонов, которые я исполнил сам на самых рискованных участках диффа (pointer lifecycle, continuity/geometry, iso focus).

## Вывод

Все AC1–AC7 либо доказаны автотестом с подтверждённой негативной веткой (юнит-тесты + исполняемые smoke-сценарии, два мутанта проверены вручную — ловятся), либо не требуют повторной доказательной нагрузки на этом этапе (AC5 ручная проверка снята владельцем). Трейлеры, changelog, мёртвый код, границы со смежными задачами (#805/#809/#811/#812/#814) — в порядке. Находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/813-kiosk-hold-door-frame-focus`, коммит `a4c014a6b8d2` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `8225509a1857dddb0b7130a238cf7a857e6c3b6d`
  ```
  git log --all --format='%H %T' | grep 8225509a1857
  ```
- Тело issue: `68eb65d99b650cf57faaedbb64e41af73241d953a6269a34fd797b5c31852cec`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4265 output_tokens=28685 cache_creation_input_tokens=163496 cache_read_input_tokens=7640836 num_turns=70 -->
