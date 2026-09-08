# CODE-REVIEW-437-r3

Issue: [#437](https://github.com/Matysh/houseplan-card/issues/437) — конфигурируемая read-only сводная панель поверх плана.
Этап: код-ревью, заход **r3**, блокирующих циклов израсходовано **2/4** до этого раунда (полный трек, лимит 4).

## Материал раунда и объявление дельты (PROCESS §2.9/§2.10)

- Вердикт r2: жёлтый, High 0 / Medium 1 (M5), документ `docs/reviews/CODE-REVIEW-437-r2.md`, материал `HEAD = 89976c85edc443da6a08ca0034eaa99d322f13d0`.
- Заявленный автором фикс (issue-комментарий 2026-09-08T17:22:50Z) — коммит `f87d3dc5`. **На момент старта ревью в локальном чекауте этого коммита не было** — `git log` на детаче показывал верхушкой `b371b683` (публикация документа r2). Причина: чекаут не был обновлён после публикации, не действие автора — `git fetch origin issue/437-summary-panel` сразу нашёл `f87d3dc5` на удалённой ветке (`b371b683..f87d3dc5`). После fetch переключился на актуальный `HEAD = f87d3dc5457834cddc3b447cb1390d2f5921c24d`. Указываю это явно: SHA в вердикте r2 не был назван относительно текущего дерева, и расхождение стоило отдельной проверки, а не потому что кто-то потерял коммит.
- Дельта r2→r3: `git diff 89976c85..f87d3dc5` — 1 продуктовый коммит (`f87d3dc5: fix: stabilize summary panel transitions (#437)`), 50 файлов в diffstat, из которых источник — 3 файла (`src/houseplan-card.ts`, `src/houseplan-editor-runtime.ts`, `src/summary-panel-runtime-loaded.ts`, суммарно +26/−22 логики, без учёта форматирования), плюс оба `CHANGELOG*`; остальное — сгенерированный бандл (класс D, три копии) и публикация `docs/reviews/CODE-REVIEW-437-r2.md` (перенесена автоматически из `b371b683`, не редактировалась).
- **Разбор полным не признан необходимым**: дельта не ребейзится на ушедший вперёд `dev` (`git merge-base f87d3dc5 origin/dev` = `ed9ee026`, тот же, что и у всего материала #437), контракт AC1–AC26 не меняется, новой подсистемы не заведено — правка целиком внутри уже существующего камера/mode-transition пути (`_viewForModeTarget`, `_prepareModeTransition`, `_viewModeSnap`, `_roomLabelReferenceViewWidth`) и CSS-инъекции сводной панели (`ensureStyle`). Объём дельты (3 файла источника, +26/−22) не сопоставим с объёмом исходной задачи (82 файла, +5131/−424). Разбор велся **по дельте**, с прицельным расширением на смоки камеры/refit — именно та зона, где r2 нашла регресс M5.

## Закрытие раунда r2

| Находка r2 | Чем закрыта | Где это видно |
|---|---|---|
| **M5** — `_setMode()` безусловно вызывает `_bootSoftCancel()`, который в первые 1500мс после раскрытия карточки синхронно пересчитывает камеру от текущего `_view` раньше, чем `_setMode` восстанавливает `_viewModeSnap`; `smoke_zoom_out.mjs` красный (`viewCenterRestored: expected true, got false`, X расходится на 84.59 логических единиц) | `_prepareModeTransition` (`houseplan-card.ts:1445-1452`) больше не строит `targetStageHeight` как относительную дельту от предыдущего измеренного состояния (`from.stageHeight + from.editorChromeHeight − targetChromeHeight`, накапливавшую ошибку через несколько переключений режима), а считает её абсолютно на каждом вызове: `Math.max(1, (this.panelHost ? this.clientHeight : innerHeight) − measuredCardHeaderHeight(...))`. Это устраняет именно накопление дрейфа по X через два переключения (View→devices→View), которое проявлялось в M5. `_bootSoftCancel()` сам по себе остался безусловным (не переносился и не гардился) — устранена не гонка вызовов, а источник числовой ошибки, который эта гонка проявляла | `src/houseplan-card.ts:1445-1452`, `src/boot-soft-layout.ts:7-19` (`measuredCardHeaderHeight`, переиспользован, не менялся в этой дельте). **Прогнано лично**: `node demo/smoke_zoom_out.mjs` → `OK`, поле `"viewCenterRestored": true` (было `false` на `89976c85`, зафиксировано в документе r2 дословной командой и числом — воспроизводимость находки установлена самим r2, в этом раунде подтверждено закрытие) |

## Унаследовано из r1/r2 (без повторной проверки)

Дельта `89976c85..f87d3dc5` не касается ни одного из файлов, доказывающих следующее, поэтому оно наследуется из `docs/reviews/CODE-REVIEW-437-r1.md` (материал `96e07b9a`) и `docs/reviews/CODE-REVIEW-437-r2.md` (материал `89976c85`) без повторной проверки в этом раунде:

- **M1–M4 (r1, закрыты в r2)** — `demo/smoke_kiosk.mjs` per-instance ключ, `test/summary-panel.test.mjs` защита AC18 удалённых устройств, tap-target 44×44 формы настроек, `src/summary-panel-identity.ts` кеш идентичности — ни один из этих файлов (`src/summary-panel-style.ts`, `src/summary-panel-identity.ts`, `test/summary-panel.test.mjs`, `demo/smoke_kiosk.mjs`) не тронут дельтой r2→r3;
- AC1, AC3–AC14, AC16, AC19, AC20, AC22–AC26 — доказательства лежат в файлах, не тронутых ни r2, ни r3 (`src/summary-panel-editor.ts`, `summary-panel-host.ts`, backend `validation.py`/`const.py`/`websocket_api.py`, i18n-словари, лимиты, kiosk-права);
- `pytest tests_backend/test_summary_panel.py` — 396 passed / 3 skipped на `96e07b9a` (r1); backend не тронут ни в r2, ни в r3 (проверено `git diff --stat` по `custom_components/**/*.py` — пусто в обеих дельтах);
- L3 (`summary-panel-identity.ts`, архитектурное сомнение по Masonry-индексу до первого кеширования) — файл не тронут дельтой r3, остаточное наблюдение остаётся как есть, не блокирует;
- границы SCOPE, версионирование backend, change-aware проверка сломанных ссылок — не тронуты.

## Как проверялось — гейты

Зелёного Validate на `f87d3dc5` не найдено — прогнал сам, на актуальном чекауте после `git fetch`.

| Гейт | Команда | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit` | pass, 0 ошибок |
| Юниты (полный набор) | `npm test` | 2269 tests, 2268 passed, 0 failed, 1 skipped (33.3s) |
| Сборка + бандл (3 копии) | `npm run build && npm run bundle:sync` | pass; `sha256sum` подтвердил байтовое совпадение `dist/houseplan-card.js` ↔ `custom_components/houseplan/frontend/houseplan-card.js` ↔ `demo/srv/assets/houseplan-card.js` (`c03169ee55…`); `git status --porcelain` после сборки пуст — закоммиченное дерево бандла не разошлось с исходником |
| Новый `any` | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | pass, 2072 добавленные строки в 17 файлах, новых `any` нет |
| Документация (диф трогает `src/**`) | `node scripts/check-docs.mjs` | красный ожидаемо: отпечаток скриншотов устарел (правило #479, некритично на обычном push, обязательно перед beta candidate) — тот же статус, что в r1 и r2, не новая находка |
| Бюджет бандла | `node scripts/bundle-budget.mjs` | pass, initial View 291 480 B при потолке 292 000±2000, headroom 9 586 B; уже учтённое предупреждение о запасе (#367), не новая находка |
| Процесс-гейт | `node scripts/process-gate.mjs` | «гейт пройден, предупреждений 0» (12 коммитов в диапазоне `origin/dev..HEAD`) |
| Единственность отображаемых чисел | `node --test test/single-source-numbers.test.mjs` | pass, 3/3 — дельта не добавляет и не дублирует новую видимую величину (правки — камера/CSS-механика, не значения) |
| Выбор смоков по дельте r2→r3 | `node scripts/smoke-select.mjs --base 89976c85 --head f87d3dc5` | 19 прямых совпадений (`_applyView`, `_zoom`, `_stageEl`, `fitView`, `_viewModeSnap`, `_modeTransitionVisual`, `panelHost`) + 12 слабых связей |
| Прямые совпадения (все 19) | `node demo/smoke_zoom_out.mjs`, `smoke_room_fit.mjs`, `smoke_pan_any_zoom.mjs`, `smoke_smooth_zoom.mjs`, `smoke_kiosk_pan_lock.mjs`, `smoke_isometric_contract.mjs`, `smoke_warm_dialogs.mjs`, `smoke_warm_owners.mjs`, `smoke_zigbee_topology_hover.mjs`, `smoke_backdrop.mjs`, `smoke_edit_walk.mjs`, `smoke_editor_tabs.mjs`, `smoke_hide_layers.mjs`, `smoke_houseplan_panel.mjs`, `smoke_linked_virtual_light.mjs`, `smoke_preloader_lifecycle.mjs`, `smoke_furniture.mjs`, `smoke_infinite_canvas.mjs`, `smoke_editor_gestures.mjs` | все **OK** (19/19) |
| Названные автором в хендоффе (не в прямых совпадениях инструмента, проверены отдельно по AC/заявлению) | `node demo/smoke_summary_panel.mjs`, `smoke_kiosk.mjs`, `smoke_german_locale.mjs`, `smoke_room_link.mjs` | все **OK** (4/4) |
| Backend | `python -m pytest tests_backend -q` | не прогонялся — дельта не трогает `custom_components/**/*.py` вообще (`git diff --stat 89976c85..f87d3dc5 -- 'custom_components/houseplan/**/*.py'` пуст), наследуется прогон r1 |
| Golden/invariants/perf | — | не прогонялись: дельта не меняет геометрию/`layout`/`marker.space`/толщины стен (правки — камера-viewport и CSS-инъекция, не модель плана) и не меняет видимый рендер панели за пределами уже проверенных смоков; прогонять не по чему (PROCESS §8, «по необходимости») |

Итого 23 из 23 отобранных инструментом смоков плюс 4 названных автором — зелёные. Причина такого объёма (выше типичного для однокоммитной дельты в 26/−22 строк): правка лежит в общем камера/viewport-пути (`_applyView`, `fitView`, `_viewForModeTarget`), который используют почти все режимы карточки, и именно в этой зоне r2 нашла регресс — сузить выборку до одного «прямого» смока было бы неоправданно после уже подтверждённого прецедента.

## Находки

Новых находок нет. High: 0, Medium: 0.

### Low (не блокируют, решение ревьюера — снято с записью)

- **L4** — `src/houseplan-card.ts:1448`: `measuredCardHeaderHeight(this.renderRoot, this._stageEl!, this.panelHost)!` — non-null assertion поверх функции, чья сигнатура явно возвращает `number | null` (`src/boot-soft-layout.ts:11`, `return height >= 0 ? height : null`). Рантайм не ломается: `x - null` в JS коэрцирует `null` в `0`, так что при `null` формула просто пропускает вычитание высоты шапки и падает на `Math.max(1, this.clientHeight)`/`innerHeight` — деградация, не исключение. Но это скрывает от TypeScript ветку, которую сама функция объявляет возможной (`card` ещё не отрендерен), полагаясь на побочный эффект коэрсии, а не на явную обработку. Не блокирую: путь возврата `null` требует отсутствия `ha-card` в дереве в момент вызова из `updateComplete.then()` — по инварианту `_prepareModeTransition` вызывается только когда карточка уже подключена и обновление завершено, что делает `null` практически недостижимым здесь; все 23 прогнанных смока, включая покрывающие первый рендер (`smoke_preloader_lifecycle`, `smoke_houseplan_panel`), зелёные.
- **L5** — `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` (правка в этом же коммите, трейлеры соблюдены) описывают два новых наблюдаемых эффекта (нейтральная смена языка, устойчивый размер подписи комнаты), но не упоминают восстановление камеры View при возврате из редактора (M5) — при том что это тоже наблюдаемое пользователем поведение. Не блокирую: сломанное поведение никогда не попадало в опубликованный релиз (вся ветка #437 живёт в «Unreleased», `v1.73.0-beta.6` собрана до фиче-коммита `96e07b9a`), так что для пользователя это не «регрессия исправлена», а часть ещё не выпущенной новой функциональности — упоминание не обязательно по духу правила о `User-Visible: yes` (описывать нужно то, что видит пользователь после релиза, а не внутреннюю историю багфиксов до него).

## Что проверено и корректно

- M5 закрыт по существу и подтверждён исполнением того же смока и того же поля (`viewCenterRestored`), которым r2 доказал поломку.
- Формула `targetStageHeight` в `_prepareModeTransition` заменена с относительной (накапливающей ошибку через несколько переключений режима) на абсолютную — прочитано и прослежено по всем трём точкам вызова `_viewForModeTarget` (`_commitViewModeAtomic:1408-1412`, `_prepareModeTransition:1450-1452`, `_roomLabelReferenceViewWidth:6413-6419`); во всех трёх высота гарантированно положительна до входа в `fitView`, поэтому снятая в `_viewForModeTarget` защита `Math.max(1, stageHeight)` была избыточной, а не ослаблением инварианта.
- Снятый ранний `return` по `targetStageWidth <= 0 || targetStageHeight <= 0` в `_prepareModeTransition` тоже прослежен: `targetStageWidth = this._stageEl?.clientWidth || from.stageWidth`, а `from.stageWidth` по построению `_currentModeVisual()` (`houseplan-card.ts:1268-1269`, возвращает `null` при `clientWidth <= 0`, что выше по стеку останавливает вызов `_prepareModeTransition` целиком) не может быть нулевым индуктивно — реального пути к делению на ноль в `fitView` не нашёл; закреплено прогоном камера-центричных смоков.
- Новая `w`-компонента `_viewModeSnap` (используется в `_roomLabelReferenceViewWidth` только когда `snap.space === this._space && snap.w`) корректно масштабирует эталонную ширину подписи комнаты по отношению зумов; подтверждено `smoke_room_link.mjs`.
- Переход `ensureStyle()` на `adoptedStyleSheets` с фолбэком на `<style>`-элемент при отсутствии поддержки `CSSStyleSheet`/`adoptedStyleSheets` — корректная feature-detection, кеш `styleSheet` предотвращает повторное создание листа; подтверждено `smoke_german_locale.mjs`.
- Оба changelog правятся в одном коммите с `User-Visible: yes` (`f87d3dc5`) — трейлеры соблюдены.
- Три копии бандла байтово идентичны на `HEAD`; `git status` после пересборки чист — закоммиченное дерево не разошлось.
- Backend и Python-стороны дельта не касается вообще.
- Расхождение с заявленным в issue SHA (см. «Материал раунда») — не действие автора, устранено `git fetch`, не повлияло на объём или выводы ревью.

## Чего не проверял

- `python -m pytest tests_backend -q` в этом раунде — дельта не трогает `custom_components/**/*.py`, полный прогон наследуется из r1 (396 passed, 3 skipped на `96e07b9a`).
- `npm run golden:verify` и `check-docs --screenshots=strict` — предрелизные гейты, не гейт ревью; дельта не меняет геометрию/раскладку/цвета панели за пределами уже проверенных смоков.
- `node scripts/model-invariants.mjs` — дельта не трогает геометрию/`layout`/`marker.space`/толщины стен, прогонять не по чему.
- Полная матрица `demo/smoke_*.mjs` — прогнаны только 19 прямых совпадений выборки `smoke-select` плюс 4 названных автором; 12 «слабых» совпадений (общий символ `_zoom`/`_applyView`, без прямой связи с изменёнными строками) не прогонялись — полный прогон предрелизный, а связь слабая по собственной классификации инструмента.
- Реальная разметка `hui-masonry-view`/`hui-sections-view` для L3 (`summary-panel-identity.ts`) — файл не тронут дельтой, вопрос не переоткрывался.

## Вердикт

Зелёный. M5 закрыт и подтверждён независимым запуском того же смока и того же численного свидетельства, которым он был обнаружен в r2. Новых находок нет. Задача готова к `S8-merged`.

---

## Материал раунда

- Ветка: `issue/437-summary-panel`, коммит `f87d3dc5457834cddc3b447cb1390d2f5921c24d`.
- Дерево материала: `2d8230d8d154e7e1bfead96e530ef666bf5599b4`.
- Родитель от `dev`: `ed9ee026dc08054e12038b7dbd1b8525e7706d04` (`git merge-base f87d3dc5 origin/dev`).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/437-summary-panel`, коммит `b371b68309a3` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `7109ccb126afc6b861eae9d99efcd9d5eb9b2bf4`
  ```
  git log --all --format='%H %T' | grep 7109ccb126af
  ```
- ТЗ `docs/specs/437-summary-panel.md`, блоб `58a2db80c2161079bc9044c107063e54bfcf0be6`
  ```
  git log --all --find-object=58a2db80c2161079bc9044c107063e54bfcf0be6 -- docs/specs/437-summary-panel.md
  ```
