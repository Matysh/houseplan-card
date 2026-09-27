# CODE-REVIEW-683-r2

Issue: #683 — «Лестницы: собственные цвета, трапеция направления и равномерный
шаг ступеней».
Этап: code (код-ревью, PROCESS.md §2.7).
Заход: r2 · блокирующих циклов израсходовано 1 из 4.
Материал: `git log --oneline origin/dev..HEAD` и `git diff origin/dev...HEAD`,
ровно SHA `f880db0338642092ce1a6a03cc7bfbe45a12fc75` (рабочая копия уже на нём;
`git rev-parse HEAD` сверен непосредственно перед подведением итогов —
совпадает).

## Скоуп

Задача обслуживает J1/J4/J6 (см. CODE-REVIEW-683-r1.md, скоуп не изменился в
этом раунде). Предмет r2 — точечная правка одной находки M1 из r1: golden-
матрица лестниц не показывала «пользовательские цвета», хотя AC13 требовал
именно этого через golden.

Дельта раунда: `git diff 20d2863eea3f94a83269bf8c2ba460a81ebdb41f..HEAD`
(SHA r1 из блока «Материал раунда» предыдущего документа) — 8 файлов:

```
 demo/golden/baselines/baselines-index.json          |  28 +--
 demo/golden/baselines/stairs-flat-hover-dark.png     | Bin
 demo/golden/baselines/stairs-flat-normal-light.png   | Bin
 demo/golden/baselines/stairs-flat-selected-light.png | Bin
 demo/golden/baselines/stairs-isometric-dark.png      | Bin
 demo/golden/matrix.mjs                               |   2 +
 docs/images/screenshots.json                         |  24 +-
 docs/reviews/CODE-REVIEW-683-r1.md                   | 246 +++++
```

`src/**`, backend, i18n, документация подсистемы — не тронуты. Дельта
локальна: правка одного golden-фикстура, регенерация 4 объявленных сцен и
docs-screenshot fingerprint (без изменения самих кадров), плюс публикация
предыдущего документа ревью (шаг конвейера, не автора). Разбор по делу — по
дельте; AC1–AC12 и AC14 наследуются из r1 без повторной проверки (см. раздел
ниже), полной проверке подвергнут только AC13.

Коммиты дельты (все с `Issue: #683`):

| Коммит | Тип | User-Visible | Прочие трейлеры |
|---|---|---|---|
| `dd365cff` | docs (публикация CODE-REVIEW-683-r1.md, класс C) | no | — |
| `d5f3e17f` | test(golden): добавлен явный `color`/`opacity`/`fill_color`/`fill_opacity` в `stairLayerFixture` (класс B) | no | — |
| `2f86266f` | chore(golden): приняты 4 PNG (класс D) | no | `Release: v1.78.0-beta.6`, `Baseline-Reviewed-Local: sha256:a56c54ff…` |
| `f880db03` | docs: обновление `sourceFingerprint` (класс C) | no | — |

Ни один из четырёх коммитов не меняет видимое пользователю поведение
продукта (правка — только в demo-фикстуре/эталонах/докс-метаданных), поэтому
`User-Visible: no` верен и оба CHANGELOG не требуются в этой дельте. На
коммите, трогающем `demo/golden/baselines/**`, есть ровно один
`Baseline-Reviewed-Local` плюс `Release:` — по правилу §10.1.

## Как проверялось

Прочитаны (в этом раунде заново): тело issue #683 целиком, все 12 комментариев
(включая Q1–Q4 и решения владельца, вердикт SPEC-REVIEW r1, полный
CODE-REVIEW-683-r1.md, все handoff-комментарии автора между r1 и r2),
`docs/reviews/INDEX.md` (строки #663/#676 по лестницам — контекст похожих
находок в прошлом, ничего нового не всплыло).

Дельта разобрана построчно:

- `demo/golden/matrix.mjs:213-217` — в объект `golden-stair-straight-small`
  (kind `straight`, `direction: 'backward'`, x=0.72/y=0.27/angle=45) добавлены
  `color: '#0066cc'`, `opacity: 0.85`, `fill_color: '#ffd23f'`,
  `fill_opacity: 0.55`. Остальные три объекта фикстуры (`straight-large`
  forward, `spiral-large`, `spiral-small`) остались без цветовых полей —
  рендерятся fallback-стилем. Grep `stairLayerFixture` подтвердил: этот
  фикстур используется ровно в 4 объявленных сценах
  (`stairs-flat-normal-light`, `stairs-flat-hover-dark`,
  `stairs-flat-selected-light`, `stairs-isometric-dark`) и нигде больше —
  побочных эффектов на другие сцены матрицы структурно нет.
- `demo/golden/baselines/baselines-index.json` — `localAttestation.sha256`
  нового манифеста (`a56c54ffef7cd397d89f9eb895937c9af4c3d053d1289ee5c2cf7e9ecb8dd42b`)
  побайтово совпадает с трейлером `Baseline-Reviewed-Local` коммита
  `2f86266f`; `source.commit`/`source.tree` в манифесте указывают на
  `d5f3e17f` (коммит с правкой фикстуры) — цепочка происхождения не порвана.
  Изменились ровно 4 хэша сцен (`stairs-flat-*`, `stairs-isometric-dark`),
  остальные 180 записей `scenarios` не тронуты диффом.
- `docs/images/screenshots.json` — сверил построчно: `sourceFingerprint`
  сменился (ожидаемо — исходники изменились), но все 11 `imageSha256`
  идентичны байт-в-байт диффу до/после — подтверждает заявление автора
  «11/11 попиксельно совпали, обновлён только отпечаток».

### Гейты — что прогнал сам в этом раунде и почему

Валидировать заново `tsc`/`npm test`/`npm run build`/bundle-policy не стал —
Validate на этом точном SHA зелёный
([run 36352494031](https://github.com/Matysh/houseplan-card/actions/runs/36352494031)),
а дельта не трогает `src/**`/backend/сборку, что подтвердил и
`smoke-select`. `node scripts/check-docs.mjs` не запускал — диффа по `src/**`
нет.

Дельта явно трогает рендер (принятые PNG), поэтому golden — не «дешёвый»
гейт, обязателен к личному прогону:

| Гейт | Статус | Как прогнан |
|---|---|---|
| `npm run build` + `node scripts/bundle-sync.mjs` | зелёный | локально в этой сессии — только чтобы поднять demo-сервер для golden, не как замена Validate |
| `node demo/golden/run.mjs --mode=verify` (полная матрица) | **зелёный, 184/184 `passed`, exit 0** (лог `/tmp/golden-verify.log` в этой сессии) | прогнал сам; включает все 4 сцены лестниц и все 180 остальных — регрессий вне лестниц нет |
| Визуальная проверка 4 принятых кадров | лестница `golden-stair-straight-small` (верхний правый ромб) во всех 4 кадрах показывает жёлтую заливку `#ffd23f` внутри всего внешнего прямоугольника и синюю линию `#0066cc` на границе/трапеции/ступенях/стрелке; остальные 3 лестницы фикстуры остаются в default-стиле (прозрачная заливка, серая линия); `hover`/`selected`-кадры не искажают custom-стиль соседней лестницы | открыл все 4 PNG инструментом чтения изображений |
| `node scripts/smoke-select.mjs --base 20d2863e --head f880db03` | «Исполняемого frontend-диффа нет (`src/**/*.ts` не тронут). Browser-smoke этим диффом не выбираются» | прогнал сам — подтверждает, что дельта не задевает исполняемый код карточки |
| `node demo/smoke_stairs.mjs` | зелёный, 62/62 `true`, `OK` (включая `propertiesExposeBothColourControls`, `coloursAndOpacityPersistAsOneEdit`, `cancelKeepsStairVisualStyle` — AC2 всё ещё держится) | прогнал сам, дополнительная подстраховка, хотя дельта его не касается |
| `npx tsc --noEmit`, `npm test`, `python -m pytest tests_backend`, `node scripts/model-invariants.mjs`, performance-профили | не прогонял отдельно в r2 | не нужно: AC, которые они доказывают (AC1–AC12, AC14), дельта не задевает; см. «Унаследовано из r1» |

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| M1 (Medium, в скоупе): AC13 требует показать в golden «пользовательские цвета», но все 4 принятые сцены рендерили только fallback-стиль decor-default — заявленное доказательство отсутствовало | В `stairLayerFixture` (`demo/golden/matrix.mjs:213-217`) один из четырёх объектов (`golden-stair-straight-small`, backward-направление) получил явный нестандартный `color`/`opacity`/`fill_color`/`fill_opacity`; фикстур переиспользуется во всех 4 объявленных лестничных сценах, значит теперь каждая из них одновременно показывает default-стиль (3 других лестницы) и custom-стиль (эта одна) — ровно тот вариант закрытия, который r1 предложил как рекомендованный | Коммит `d5f3e17f` (правка фикстуры) + `2f86266f` (приёмка 4 PNG с этим стилем, `Baseline-Reviewed-Local` сверен) + личный прогон `golden:verify` (184/184 `passed`) и визуальный просмотр 4 PNG в этом раунде — жёлтая заливка/синяя линия видны во всех 4 кадрах (light/dark, flat/iso, normal/hover/selected) |

## Унаследовано из r1

Без повторной проверки в r2 приняты (документ и материал: `CODE-REVIEW-683-r1.md`,
SHA `20d2863eea3f94a83269bf8c2ba460a81ebdb41f`), поскольку дельта r1→r2 не
трогает ни один файл, от которого зависят их доказательства:

- **AC1, AC2, AC7, AC8, AC9** — модель, snapshot цвета/opacity, legacy
  fallback, i18n «Вверх/Вниз», backend-контракт (`src/stairs.ts`,
  `src/stairs-editor.ts`, `validation.py`, `import_export.py`,
  `support_package.py`, i18n × 4) — файлы не изменились между r1 и r2.
- **AC4, AC5** — геометрия трапеции 100/80, отступы 10%, treads строго
  внутри трапеции (`src/stairs.ts`) — не изменился.
- **AC6** — равномерный шаг `stairIntervalCount`, tie-break — не изменился.
- **AC10** — footprint/bounds/magnet/hit target независимы от trapezoid — код
  геометрии footprint не изменился.
- **AC11** — единая geometry для View/editor/2.5D/PDF, PDF монохромный
  (`src/pdf/pdf-scene.ts`) — не изменился; `test/pdf-scene.test.mjs` не
  тронут дельтой.
- **AC12** — cursor pointer только у active-ссылки — `src/stairs-view.ts`
  не изменился; дополнительно перепрогнан `demo/smoke_stairs.mjs` в этом
  раунде (см. таблицу гейтов) и остался зелёным.
- **AC14** — кеш геометрии не зависит от стиля, бюджет 250 лестниц —
  `renderFingerprint`/`cachedStairRenderGeometry` не изменились;
  `scripts/model-invariants.mjs` на этом деле не перепрогонял: диффа по
  геометрии/ссылкам в r2 нет.
- Бюджет `INITIAL_VIEW_GZIP_CEILING` (299638/300200) — не изменился в
  дельте.
- Ребейз на `dev`, конфликт `docs/ARCHITECTURE.md` и его разрешение — уже
  вошли в SHA r1 и не пересматриваются повторно.

## Что проверено и корректно (специфично для r2)

- **AC13 теперь доказан заявленным способом.** Golden-матрица (все 4
  объявленные сцены) одновременно показывает: transparent default (3 из 4
  лестниц фикстуры), явный пользовательский цвет/заливку (4-я лестница),
  оба направления прямой лестницы (forward у default-лестницы, backward у
  custom-лестницы) и оба типа (straight + spiral), в light и dark теме, во
  flat и isometric проекции — без theme-dependent подмены (custom-цвет
  визуально идентичен в light/dark кадрах). Личный прогон `golden:verify`
  (184/184, включая эти 4 сцены) подтверждает, что принятые эталоны
  реально соответствуют текущему коду и фикстуре, а не рассинхронизированы.
- **Провенанс приёмки эталонов корректен.** `localAttestation.sha256` в
  `baselines-index.json` побайтово совпадает с трейлером
  `Baseline-Reviewed-Local` коммита `2f86266f`, а `source.commit` манифеста
  указывает на коммит с самой правкой фикстуры (`d5f3e17f`) — цепочка
  «правка фикстуры → WSL-съёмка → приёмка» не разорвана и не подделана.
- **Docs-screenshot fingerprint не маскирует визуальную правку.** Все 11
  `imageSha256` в `docs/images/screenshots.json` не изменились —
  подтверждает, что f880db03 действительно только фиксирует новый
  `sourceFingerprint`, а не тихо меняет документационные кадры.
- **Побочных эффектов на остальную матрицу нет.** `stairLayerFixture`
  используется исключительно в 4 объявленных сценах (grep), и полный
  прогон `golden:verify` подтверждает 184/184 `passed` — ни одна из 180
  необъявленных сцен не изменилась.

## Находки

Нет. High: 0, Medium: 0. M1 из r1 закрыт рекомендованным способом и
подтверждён исполнением (не только заявлением автора).

## Чего не проверял

- Полный `python -m pytest tests_backend` и `npx tsc --noEmit`/`npm test`
  заново в r2 — не требовалось: дельта не трогает `src/**` или backend,
  Validate на этом SHA зелёный, `smoke-select` подтвердил отсутствие
  исполняемого frontend-диффа.
- `node scripts/model-invariants.mjs --config <250 лестниц>` в r2 не
  перепрогонял — AC14 дельта не задевает (геометрия/ссылки не менялись);
  прогон r1 остаётся действительным доказательством.
- Полная browser-smoke матрица (278 смоков) — не требуется гейтом ревью
  (§8, предрелизный объём); прогнал только AC-именованный
  `demo/smoke_stairs.mjs` (62/62) и `smoke-select` для этой дельты.
- Ручной клик в браузере (десктоп/тач) — ручного тестирования в цикле нет
  по регламенту; полагаюсь на исполненный `golden:verify` и
  `demo/smoke_stairs.mjs`.
- Не проверял детали рендера 2.5D-теней/бликов сверх пиксельного сравнения
  `stairs-isometric-dark` — визуально сверил только контракт AC13
  (custom-цвет виден, default прозрачен), доверяя авторскому
  visual-diff review, как и в r1.

## Вердикт

Дельта r1→r2 полностью и только закрывает M1: фикстур golden-лестниц теперь
несёт явный пользовательский цвет/заливку в одной из четырёх лестниц,
матрица переснята и принята с корректной WSL-аттестацией, а личный прогон
`golden:verify` (184/184 `passed`, включая все 4 лестничные сцены)
подтверждает, что доказательство реальное, а не заявленное. Побочных
регрессий на остальные 180 сцен и на неизменившиеся AC1–AC12/AC14 нет.
High-находок нет, Medium-находок нет.

**Зелёный.**

---

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/683-stair-visuals`, коммит `f880db033864` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `294baa50660292a8c47937a893560027a263ec4a`
  ```
  git log --all --format='%H %T' | grep 294baa506602
  ```
- Тело issue: `5f2e2a957f1cd2869b4e054901cbce315227e529cb9fcc68495857756083a7f6`
- Вердикт конвейера: `green` · High 0
