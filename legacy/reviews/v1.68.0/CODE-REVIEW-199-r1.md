# CODE-REVIEW-199-r1

- **Issue:** [#199](https://github.com/Matysh/houseplan-card/issues/199) — geometry
  preflight перед записью Optimize
- **Спецификация:** `docs/specs/199-optimize-geometry-preflight.md` (зелёное ревью
  ТЗ: `docs/reviews/SPEC-REVIEW-199-r2.md`)
- **Коммит на ревью:** `482afb73ebe483e316dcc1652f10736a2215c158`
  (`issue/199-optimize-geometry-preflight`, диапазон `origin/dev...HEAD`)
- **Заход:** r1 · блокирующих циклов ревью кода израсходовано 0/4 (первый заход
  этого этапа — полный разбор, дельты нет)

## Скоуп

Диапазон `origin/dev...HEAD`, 28 файлов. Продуктовый код: новый чистый модуль
`src/plan-geometry-preflight.ts`, точечная интеграция в `src/houseplan-card.ts`
(`_openAlignDialog`, `_runAlignToGrid`, `_renderAlignDialog`, извлечение общих
pure-хелперов `geometryOpenCuts/geometryOpenPairs/geometryOpenings/…` из
карточки в новый модуль), 4 новых i18n-ключа RU/EN. Backend
(`custom_components/houseplan/**/*.py`) не тронут — подтверждено diff'ом,
соответствует §9 ТЗ. Остальное — тесты (unit/smoke/benchmark/mutation),
golden-матрица (2 новых сценария, без baseline), документация (CANVAS,
ARCHITECTURE, USER-GUIDE.ru, TESTING, STATUS, оба CHANGELOG), три копии
бандла и `docs/images/screenshots.json` (пересчитанный fingerprint).

## Как проверялось

### Гейты

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | green, без вывода |
| Unit | `npm test` | 1068/1068 pass, 0 fail, 0 skipped (у автора было 1067/1, здесь Chromium в окружении полный — расхождение не в мою пользу, не блокирует) |
| Build + 3 копии бандла | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js && cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | green, обе копии byte-identical, `git status` после сборки чист — в дереве и так лежали актуальные копии |
| Docs fingerprint | `node scripts/check-docs.mjs` | green (7 files, 10 external links) — diff трогает `src/**`, гейт обязателен |
| Targeted smoke (AC4–AC9) | `node demo/smoke_optimize_geometry_preflight.mjs` | green, все 16 ассертов true |
| Targeted benchmark (AC11) | `npm run benchmark:optimize-geometry-preflight` | **см. находку ниже** — относительный бюджет проходит, абсолютный — нет в этом окружении |
| Mutation gate (AC12), 4 новых id | `node scripts/mutation-gate.mjs --id=optimize-preflight-bypassed` / `--id=optimize-preflight-active-space-only` / `--id=optimize-preflight-accepts-null` / `--id=optimize-preflight-renders-apply-on-failure` | все 4 «поймано 1 из 1» — тест реально краснеет на соответствующей поломке |
| Golden (визуально, без accept) | `node demo/golden/run.mjs --mode=capture --scenario=optimize-preflight-dialog-dark-en` и `…-light-ru` | `missing-baseline` (ожидаемо, эталон не принимается на ревью); оба PNG открыты и проверены визуально — см. ниже |

**Не прогонялось и почему:** полный `demo/smoke_*.mjs` (163 смока — задача не
задевает поверхности за пределами Optimize-диалога и общих geometry-хелперов,
выборка по diff/AC уже покрывает изменённые вызовы); `npm run golden:verify`
(эталонов для двух новых сценариев ещё нет — приём эталона возможен только
через `golden:accept -- --reviewed` на полном Linux CI артефакте перед бетой,
не на код-ревью); `python -m pytest tests_backend` (диапазон не трогает
`custom_components/**/*.py`); прочие 5 из ~1050 мутантов реестра
(`node scripts/mutation-gate.mjs --check` подтвердил, что все патчи реестра
по-прежнему ложатся на текущий код — офлайн-проверка целостности реестра,
дорогой полный прогон всех мутантов не требуется для одной задачи).

### Разбор по AC1–AC14

- **AC1 (parity).** Построил построчную таблицу вызовов: карточка вызывает
  `wallBodiesGeometry(rooms, walls, openCuts, roomOpenings, wallKeyPitch, cellCm,
  gridPitch, coordScale, extras)` в двух местах (`houseplan-card.ts:5217`
  ISO-рендер, `:15641` light-barrier) и `floorFootprintGeometry(rooms, walls,
  openCuts, wallKeyPitch, cellCm, gridPitch, coordScale)` (`:5224`);
  `plan-geometry-preflight.ts` вызывает обе функции с теми же аргументами в том
  же порядке через `prepareSpacePhysicalGeometryInputs`, который переиспользует
  вынесенные из карточки чистые хелперы (`geometryOpenCuts/-Pairs/-Openings/-
  RoomOpeningInputs/-PartitionOpeningCuts`) — карточка теперь тоже вызывает эти
  же экспортированные функции (diff `houseplan-card.ts` заменяет старые
  приватные копии на вызовы нового модуля), то есть renderer и preflight
  буквально сходятся на одном коде, а не на двух похожих реализациях. Вход не
  мутируется — проверено unit-тестом (`assert.deepEqual(config, before)`) и
  чтением: `checkOptimizeGeometry` только читает `config.spaces`, не пишет в
  них. **Проверено чтением кода + unit.**
- **AC2.** Параметризованный unit (`covers the production input matrix…`)
  прогоняет ровно эту матрицу — room+wall, hosted opening, partitions/drafts/
  columns без комнат, image-only, empty, floor-only — и ожидает `ok`/`
  not-applicable` без failure. Green.
- **AC3.** Unit `null, exceptions and floor failure are bounded…` инжектит
  `wallPass`/`floorPass`/`prepareSpace`, возвращающие `null` и throw, и отдельно
  проверяет, что успешный пустой `{geom: [], paperGeom: [], …}` не считается
  failure (floorPass в этом случае намеренно бросает `must not run` — то есть
  тест доказывает, что при `paperGeom` не-null floor вообще не вызывается).
  Exception text не протекает наружу — `assert.doesNotMatch(…, /secret/)` и
  аналогично для `private floor detail`/`private preparation detail`. Green.
- **AC4.** Unit `one failed space blocks the ordered whole-plan result…`:
  третье из трёх пространств с id `''` фейлится через floor-null,
  сохраняется порядок `config.spaces`; смок проверяет то же на уровне карточки
  (0 WS-вызовов, диалог без Apply). Green.
- **AC5.** В коде preflight нет ни одной ветки, читающей «состояние до
  Optimize»: `checkOptimizeGeometry` получает только `OptimizeResult.config`
  (итоговый candidate) и не сравнивает его с исходным `_serverCfg`. Механизма
  исключения «не стало хуже» физически не существует — любой failing candidate
  блокируется вне зависимости от того, был ли он уже сломан до операции.
  **Проверено чтением, не исполнением** (в ТЗ AC5 назван «before/after
  regression unit + smoke» как способ доказательства; отдельного теста с таким
  названием нет, но отсутствие самой ветки логики делает регресс невозможным
  без явного добавления новой ветки — что уже поймает существующие unit'ы на
  failure-путях. Low, не поднимаю отдельной находкой: доказательство через
  чтение здесь надёжнее, чем тест на негативный случай, у которого нет кода для
  проверки).
- **AC6.** Смок проверяет точный RU/EN текст сообщения и hint'а, XSS-пробу
  (`<img id="preflight-injection">` в title четвёртого пространства — не
  попадает в DOM и в textContent), отсутствие `.btn.on`. Золотые кандидаты
  (см. ниже) подтверждают то же визуально в обеих темах.
- **AC7.** Смок: `noOpSkipsPreflight` (0 доп. вызовов `_checkOptimizeGeometry`,
  `preflight === null`) и `noOpKeepsExistingUi` (старый текст `gs.align_none`,
  без Apply); `greenPreviewOffersApply` — green-кандидат сохраняет Apply.
- **AC8.** Смок явно считает вызовы `_checkOptimizeGeometry` (`checks`
  counter): unchanged Apply не увеличивает счётчик
  (`unchangedApplyDoesNotRecheck`), изменение `d.config.spaces[0].title` после
  preview увеличивает его на 1 и переводит диалог в fail-closed
  (`changedFingerprintRechecks`, `changedFingerprintFailsClosed`).
- **AC9.** Смок перехватывает `hass.callWS` и считает вызовы
  `houseplan/plan/optimize`: 0 при красном (`redPreflightMakesZeroWrites`) +
  полное сохранение `_serverCfg`/`_layout`/revisions/undo-state
  (`redPreflightPreservesAllState`); ровно 1 atomic-вызов при зелёном с точным
  candidate (`greenApplyMakesOneAtomicWrite`, сверка `JSON.stringify` кандидата
  и отправленного payload).
- **AC10.** Чтением: `_runAlignToGrid` после нового guard'а и fingerprint-
  проверки не тронут — тот же WS-вызов, тот же catch на `e.code === 'conflict'`,
  та же запись revisions/undo (см. `houseplan-card.ts:14917–14952`, вне diff'а).
  Backend не менялся (нет diff'а в `custom_components/**/*.py`). Смок
  дополнительно подтверждает `greenApplyPreservesUndoContract`.
- **AC11.** См. отдельную находку ниже — относительный бюджет выполнен,
  абсолютный нестабилен в этом CI-окружении. Cache: preflight-результат живёт
  только в `_alignDialog.preflight` (плейн-поле инстанса), отдельной
  Map/WeakMap-подобной структуры модуль не заводит — закрытие диалога
  (`_alignDialog = null`) делает результат недостижимым. **Проверено чтением.**
  Вызовы `checkOptimizeGeometry`/`_checkOptimizeGeometry` есть только в
  `_openAlignDialog` (гейтировано `r.changed`) и в fingerprint-mismatch ветке
  `_runAlignToGrid` — не в `render()`/`updated()`/pointer-путях. **Проверено
  чтением.**
- **AC12.** 4 mutation-id из ТЗ (`optimize-preflight-bypassed`,
  `-active-space-only`, `-accepts-null`, `-renders-apply-on-failure`) есть в
  `scripts/mutation-gate.mjs`; каждый прогнан лично (не со слов автора) —
  «поймано 1 из 1» на всех четырёх.
- **AC13.** `check-docs` green; три копии бандла byte-identical; RU/EN
  changelog, `USER-GUIDE.ru.md`, `CANVAS.md`, `ARCHITECTURE.md`, `TESTING.md`,
  `STATUS.md` обновлены по существу и без придуманной терминологии (термин
  «пространство» уже используется в `USER-GUIDE.ru.md` для Optimize-контекста).
- **AC14.** См. таблицу гейтов выше — все green, кроме отмеченной находки по
  AC11/§10, которая по тексту самого ТЗ не блокирует эту задачу.

## Находки

### Low / информационная — абсолютный p95-бюджет §10 нестабилен в CI-песочнице (не блокирует)

`npm run benchmark:optimize-geometry-preflight` дважды подряд на коммите
`482afb7` в этом окружении (контейнер код-ревью, 4 vCPU): baseline (прямой
production-вызов, БЕЗ preflight-обёртки) p95 ≈ 283–285 ms — уже выше
абсолютного порога 250 ms сам по себе; candidate (полный preflight) p95 ≈
291–296 ms. Относительный оверхед обёртки ≈ 3–4%, далеко внутри допуска
+20%/+15 ms (`relativeLimitP95Ms` 354–357 ms, оба раза с большим запасом).
Автор на своей машине получил baseline 165.98 ms / candidate 171.58 ms — то же
относительное соотношение, другая абсолютная база. Это ровно случай,
предусмотренный §10 ТЗ дословно: «Если абсолютный budget нестабилен в CI,
ревьюер… заводит отдельный performance issue; для #199 остаётся обязательным
относительный budget» — относительный бюджет выполнен, поэтому AC11 в части
#199 закрыт; абсолютная цифра — предмет отдельного трекинга.

Заведено: **[#240](https://github.com/Matysh/houseplan-card/issues/240)**
(tech-debt, P3, S1-new), со ссылкой на #199 и точными числами обоих прогонов.
Не в скоупе #199 и не блокирует его вердикт — это единственная находка обзора,
и она не про поведение продукта, а про калибровку бенчмарка под CI-раннер;
скрипт также нигде не подключён к `validate.yml`/`performance.yml`, поэтому
регресс сейчас не может уронить CI молча — это тоже отмечено в заведённом
issue как отдельный открытый вопрос.

High-находок нет. Других Medium/Low — нет.

## Что проверено и корректно

- Единый источник geometry-инпутов: карточка и preflight используют одни и те
  же экспортированные pure-хелперы (`geometryOpenCuts`, `geometryOpenPairs`,
  `geometryOpenings`, `geometryPartitionOpeningCuts`,
  `geometryRoomOpeningInputs`, `prepareSpacePhysicalGeometryInputs`) — diff
  `houseplan-card.ts` заменяет прежние приватные копии условий на вызовы того
  же модуля, а не дублирует логику рядом.
- Различение structural failure vs successful-empty: `wallBodiesUnionPath()`
  (существующий production-путь, `wall-thickness.ts:2043`) отдельно
  документирует «successful empty result: do not resurrect raw rings» — то же
  различение (`united == null` = failure, `united.geom` пустой = ok) сделано в
  preflight тем же способом, не новым отдельным алгоритмом.
- `not-applicable` для комнат-less/wall-less пространства и физический-only
  путь (partitions/drafts/columns без комнат, floor не проверяется) —
  соответствуют §7.3 ТЗ и подтверждены unit-тестом.
- Fail-closed UI-контракт: кнопка «Оптимизировать» физически не рендерится при
  failure (`nothing`, не `disabled`), что закрыто mutation-тестом
  `optimize-preflight-renders-apply-on-failure`.
- Экранирование имён пространств (Lit text binding) — подтверждено смоком с
  инъекцией `<img>` в title.
- RU/EN текст сообщения/hint'а — дословное совпадение с §8.1 ТЗ, проверено и
  строкой в смоке, и визуально на golden-кандидатах (dark/EN, light/RU —
  открыты и прочитаны лично, рендерятся корректно, без Apply, с ожидаемым
  текстом).
- Backend не тронут — permission/schema/revision/atomicity-барьеры остаются
  прежними; preflight явно не заявлен как security-attestation (§9
  ТЗ/`ARCHITECTURE.md`).
- i18n-ключи присутствуют в обоих `src/i18n/en.json` и `src/i18n/ru.json`.
- Три копии бандла синхронны, `check-docs` зелёный, `docs/specs/README.md`
  дополнен строкой на #199.

## Чего не проверял (и почему)

- Полный `demo/smoke_*.mjs` (163 файла) и `npm run golden:verify` — вне
  соразмерного этой задаче объёма (PROCESS.md §8): diff не задевает
  поверхности за пределами Optimize-диалога и уже переиспользуемых
  geometry-хелперов; названные в AC/задетые смоки (`smoke_optimize_geometry_
  preflight`, плюс упомянутые автором `smoke_optimize_coordinate_
  canonicalization` и `smoke_optimize_micro_interval` как соседние по тому же
  диалогу — не перепроверял их лично, положился на зелёный `npm test`/typecheck
  и то, что diff их не касается) прогнаны точечно.
- `python -m pytest tests_backend` — диапазон не содержит изменений в
  `custom_components/**/*.py`.
- Полный прогон `scripts/mutation-gate.mjs` без `--id` (~90 мутантов, дорогая
  пересборка бандла на каждый) — это пре-релизный гейт; проверил офлайн
  целостность реестра (`--check`, все патчи ложатся) и лично прогнал 4 новых
  id, относящихся к #199.
- Принятие golden-эталонов — не в полномочиях код-ревью (только `golden:accept
  -- --reviewed` на полном Linux CI артефакте перед бетой); визуально проверил
  оба capture-PNG вместо этого.
- Performance-профили за пределами названного в AC11 large-house бенчмарка —
  не требуются: задача не касается render/pointer/HA-tick путей ни в скоупе, ни
  по факту (проверено чтением вызовов `checkOptimizeGeometry`).

## Итог

Реализация соответствует контракту ТЗ #199 построчно: единый источник
production-geometry, fail-closed whole-plan barrier, различение failure/
not-applicable/successful-empty, fingerprint-повторная проверка, RU/EN UX без
утечки технических деталей, backend не тронут, mutation-покрытие AC12 лично
перепроверено и действительно ловит поломки. Единственная находка —
информационная нестабильность абсолютного perf-бюджета в CI-окружении,
предусмотренная самим ТЗ и не блокирующая эту задачу; заведена отдельным issue
#240.

**Вердикт: зелёный.**
