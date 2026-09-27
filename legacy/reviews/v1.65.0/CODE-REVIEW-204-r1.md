# CODE-REVIEW-204-r1

- Issue: [#204](https://github.com/Matysh/houseplan-card/issues/204)
- ТЗ: [docs/specs/204-space-create-display-defaults.md](../specs/204-space-create-display-defaults.md)
- Ветка: `issue/204-space-create-display-defaults`, коммит `12c4f77`
- Диапазон: `origin/dev..HEAD` = `f703242` (spec) → `ec0ccaf` (spec review doc) → `12c4f77` (реализация)
- Вердикт: **зелёный**

## Скоуп ревью

Этап `code` по PROCESS.md §2.7: реализация против ТЗ #204 (единственный
implementation-коммит `12c4f77`, `User-Visible: yes`). Задача — честные
create-dialog defaults для «Всегда отображать границы комнат» и «Отображать
названия комнат»: File `false/false`, Draw `true/true`, сохранение выбора
пользователя (`displayTouched`) при последующих File↔Draw, и убрать скрытую
Save-подмену `draw && mode==='create' ? true : d.showBorders`. Обычный Create
и Floors/Areas onboarding должны следовать одной политике.

## Как проверялось

1. Прочитаны в порядке: `docs/SCOPE.md`, `AGENTS.md`, `PROCESS.md` §2.7,
   тело issue #204 и все комментарии (аналитика, ТЗ, код-ревью спеки,
   реализация), `docs/USER-GUIDE.ru.md` (раздел «Пространства» — таблица
   «Источник плана» уже содержала термин «Без изображения» до этого коммита),
   `docs/UX-MODES.md` (подтверждено: описывает только рантайм-резолвер
   `show_borders`/`show_names`, не create-dialog UX — не затронут, non-scope
   ТЗ верен).
2. Прочитан весь `git diff origin/dev...HEAD` построчно: новый модуль
   `src/space-dialog.ts`, точки интеграции в `src/houseplan-card.ts`
   (`_openSpaceDialog('create')`, `_openNextImport`, `_saveSpaceDialog`,
   радиокнопки File/Draw, оба `_boolInput` переключателя), новый unit-файл
   `test/space-dialog.test.mjs`, новый браузерный smoke
   `demo/smoke_space_create_display_defaults.mjs`, правка существующего
   `demo/smoke_space_settings.mjs`, запись мутанта в
   `scripts/mutation-gate.mjs`, документация (`CHANGELOG.md`/`.ru.md`,
   `USER-GUIDE.ru.md`, `TESTING.md`, `STATUS.md`, `docs/specs/README.md`),
   `tsconfig.test.json`.
3. Построчно сверена корневая причина ТЗ (§3) с диффом: скрытая ветка
   `show_borders: draw && d.mode === 'create' ? true : d.showBorders` (и
   аналог для `show_names`) в `_saveSpaceDialog()` заменена на прямую запись
   `d.showBorders`/`d.showNames` — подмена действительно убрана, не
   переименована.
4. Проверен весь конечный автомат `displayTouched` (§6 ТЗ) против
   `src/space-dialog.ts`: `initialSpaceDisplayDraft` (File `false/false`,
   `displayTouched:false`), `switchSpacePlanSource` (проецирует source-default
   пока `!displayTouched`, иначе меняет только `source`), `touchSpaceDisplay`
   (ставит `displayTouched:true`, второй control не трогает) — все 6 пунктов
   контракта покрыты один в один, скрытых переходов не осталось.
5. Проверено, что обычный Create (`_openSpaceDialog('create')`,
   `src/houseplan-card.ts:13239`) и каждый шаг onboarding (`_openNextImport`,
   `src/houseplan-card.ts:13613`) используют один и тот же
   `...initialSpaceDisplayDraft()` — общий чистый state, без риска утечки
   touched между этажами (AC5).
6. Проверено, что Edit (`src/houseplan-card.ts:13214`) выставляет
   `displayTouched: true` сразу — источник переключается без авто-сброса
   уже сохранённых values (AC6), что и есть корректное поведение «Edit не
   должен применять create-only defaults».
7. Прогнаны все заявленные автором гейты локально (см. таблицу ниже),
   включая исполнение (не чтение) целевого мутанта — тест обязан был
   покраснеть без патча и покраснел на мутанте.
8. Проверены трейлеры всех трёх коммитов диапазона (`Issue: #204` на каждом;
   `User-Visible: no` на двух docs-коммитах, `User-Visible: yes` на
   реализации) и что оба changelog (`docs/CHANGELOG.md`,
   `docs/CHANGELOG.ru.md`) правлены в том же коммите `12c4f77`, что и продукт
   (`git show --stat 12c4f77`).
9. Проверено побайтовое совпадение трёх копий бандла после чистой пересборки
   (`dist`, `custom_components/houseplan/frontend`, `demo/srv/assets`) —
   идентичны и `git diff` после пересборки пуст, т.е. закоммиченные копии не
   разошлись с исходником.

## Гейты — что прогнано и результат

| Гейт | Статус | Результат |
|---|---|---|
| `npx tsc --noEmit` | прогнан | green, без ошибок |
| `npm test` | прогнан | 916/916 green (включая 4 новых теста `space-dialog.test.mjs`) |
| `npm run build` + сверка 3 копий бандла | прогнан | build green; `md5sum` трёх копий совпадает; `git diff --stat` после build пуст |
| `git diff --check` | прогнан | без ошибок пробелов |
| `node demo/smoke_space_create_display_defaults.mjs` | прогнан | green (`OK`), проверены все состояния AC1–AC8 |
| `node demo/smoke_space_settings.mjs` | прогнан | green (`OK`), regression не сломан |
| `node scripts/mutation-gate.mjs --check` | прогнан | green, якорь мутанта найден ровно 1 раз |
| `node scripts/mutation-gate.mjs --id=space-create-hidden-display-override` | прогнан (исполнение) | «чистый прогон» зелёный без мутанта, с мутантом — «тест покраснел, как обязан», поймано 1/1 |

**Не прогонялось и почему:**
- `npm run golden:verify` — диф не меняет геометрию, рендер, стили или слои
  (только checked-state двух HA switches и порядок записи двух boolean в
  Save); визуального следствия нет, ТЗ §10 явно исключает golden.
- Полный набор `demo/smoke_*.mjs` (127 файлов) — задача касается одной
  поверхности (create-dialog + onboarding wizard), два целевых смока плюс
  regression-смок покрывают её; по процессу полный набор — предрелизный
  гейт, а не гейт ревью.
- `python -m pytest tests_backend -q` — диф не затрагивает
  `custom_components/houseplan/**/*.py`; backend принимает произвольные bool
  без изменений (подтверждено в самой ТЗ и не оспаривается диффом).
- performance-профили — путь не является perf-чувствительным (локальные
  boolean transitions без I/O), в AC не назван.

## Проверка AC (PROCESS §2.7: автотест + доказано, что умеет падать, либо чтение с явной пометкой)

| AC | Как доказан | Итог |
|---|---|---|
| AC1 | `smoke_space_create_display_defaults.mjs`: `freshFile`/`untouchedDraw` | подтверждено исполнением |
| AC2 | тот же smoke: Save сразу после Draw → `savedMixed`/`reopenedMixed` (мутантно доказано отдельно на mixed-паре) | подтверждено исполнением |
| AC3 | unit `space-dialog.test.mjs` («every supported Draw pair...») + smoke `mixedTouched`/`savedMixed`/`reopenedMixed` | подтверждено исполнением |
| AC4 | smoke `untouchedDraw`/`untouchedFileAgain` (до touch) и `mixedFile`/`mixedDrawAgain` (после touch) | подтверждено исполнением |
| AC5 | smoke `onboardingFirst`/`onboardingSecond` — второй этаж не наследует touched первого | подтверждено исполнением |
| AC6 | smoke `savedFileDefaults` (File create) + `editSourcePreservesPair` (Edit не сбрасывает при смене source) | подтверждено исполнением |
| AC7 | smoke `cancelDidNotWrite` (снапшот `_serverCfg` до/после Cancel идентичен) + `freshAfterCancel` | подтверждено исполнением |
| AC8 | unit «source and display transitions are immutable and preserve unrelated fields» (title/cellCm через spread) + regression `smoke_space_settings.mjs` (atticSettings побайтно) | подтверждено исполнением |
| AC9 | `mutation-gate.mjs --id=space-create-hidden-display-override`: старый hidden override восстановлен патчем, гард обязан покраснеть — исполнено, поймано 1/1 | подтверждено исполнением, тест доказанно умеет падать |
| AC10 | таблица гейтов выше | подтверждено исполнением |

Отдельно проверено чтением, не исполнением: путь `_warmReviveDialog` (§2810)
восстанавливает весь снятый снапшот `_spaceDialog` целиком через spread —
поле `displayTouched` уже присутствует в снапшоте на момент захвата, разрыва
контракта при warm-remount нет.

## Находки

Нет ни High, ни Medium, ни Low.

## Что проверено и корректно

- Скрытая Save-подмена `draw && mode==='create' ? true : d.showBorders`
  (и аналог для `show_names`) удалена буквально, а не переименована —
  `src/houseplan-card.ts` теперь пишет ровно `d.showBorders`/`d.showNames`.
- Общий helper `src/space-dialog.ts` используется одинаково обычным Create,
  onboarding (`_openNextImport`) и радиокнопками — реализация п. «Onboarding
  расходится с обычным Create» риска (§11 ТЗ) закрыта одной точкой правды,
  а не дублированием логики.
- Edit-режим стартует с `displayTouched: true`, что предотвращает
  create-only default reset при смене источника существующего пространства.
- Мутационный тест не просто присутствует «для галочки»: реально исполнен,
  подтверждает что тест красный без патча (`runCleanGuards`) и красный
  именно на мутанте — дисциплина «тест умеет падать» соблюдена.
- Три копии бандла синхронны, трейлеры и оба changelog в одном коммите —
  требования AGENTS.md/PROCESS.md выполнены.
- Терминология `docs/USER-GUIDE.ru.md` («Без изображения») уже существовала
  в этом разделе до правки — не изобретена, взята из документа.
- `docs/specs/README.md`: порядок строк в таблице был не отсортирован по
  номеру issue уже до этого коммита (не новая проблема, ссылка на #204
  вставлена корректно).

## Чего не проверял

- Полный browser smoke-набор (127 файлов), `golden:verify`,
  `performance_smoke` и backend pytest — не запускались; обоснование см.
  таблицу гейтов выше. Остаются предрелизным гейтом по процессу.
- Ручная проверка в реальном браузере (визуальный клик по диалогу) не
  проводилась — путь доказан Playwright-смоками поверх собранного бандла,
  что эквивалентно для этой поверхности (нет ручного цикла тестирования на
  этапе code review по регламенту).
- Touch/keyboard input specifics (real device) не проверялись — ТЗ §8
  утверждает общий `change`-обработчик для pointer/touch/keyboard, что
  подтверждено чтением кода (`_boolInput` — единая точка на `<ha-switch>`/
  `<input type=checkbox>`), не отдельным touch-тестом.
- `docs/specs/040-floor-area-onboarding.md` целиком не перечитывался повторно
  на этапе code review — при spec review уже подтверждено отсутствие
  конфликтующих утверждений про defaults; код (`_openNextImport`) реализует
  именно контракт §6 ТЗ #204, что и было предметом проверки здесь.
