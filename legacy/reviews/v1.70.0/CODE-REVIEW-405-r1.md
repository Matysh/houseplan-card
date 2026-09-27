# CODE-REVIEW-405-r1

- Issue: https://github.com/Matysh/houseplan-card/issues/405
- Этап: код-ревью, заход r1, блокирующих циклов израсходовано 0/4 (цикл считается по этапу — код-ревью ещё не возвращала эту задачу автору, §10.4)
- ТЗ: `docs/specs/405-dropped-promise-and-witness-floor.md`, ревизия 2, зелёное `SPEC-REVIEW-405-r2` на SHA `d5c93d4e`
- SHA материала ревью: `24af34cc` (сверено `git rev-parse HEAD` непосредственно перед выводом вердикта)
- Скоуп задачи по решению владельца сужен до M2 (оброненный промис в `_deletePhysicalSelection` для draft-ветки). M4 (порог кадров-свидетелей) закрыта отдельно в #409 (`8119c523`), golden-двойник — #408. Ни один из них этим коммитом не затрагивается.

## Материал

```
git log --oneline origin/dev..HEAD
24af34cc docs: refresh #405 screenshot source fingerprint
b4809a12 fix: await draft deletion through the card facade (#405)
```

Класс A: `src/editor-secondary.ts`, `src/houseplan-card.ts`, `src/houseplan-editor-runtime.ts`.
Класс B: `demo/smoke_free_walls.mjs`, `test/editor-secondary.test.mjs`, `scripts/mutation-gate.mjs`, `tsconfig.test.json`.
Класс D: `dist/**`, `custom_components/houseplan/frontend/**` (пересобранные бандлы).
Класс C: `docs/images/06-device-editor.png`, `docs/images/screenshots.json` (фингерпринт документации).

Трейлеры на обоих коммитах — `Issue: #405`, `User-Visible: no` — присутствуют и обоснованы: спецификация прямо утверждает отсутствие видимых изменений интерфейса (раздел «Что человек увидит до и после»), фикс меняет только тип возвращаемого значения внутреннего метода и его использование программными вызывающими (смок, будущие вызывающие), а не UI-контракт. Проверено чтением `@click`-обработчиков (см. AC6 ниже) — ни один не блокирует кнопку и не ждёт промис.

## Как проверялось — гейты

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | green |
| unit-тесты | `npm test` | 1712 passed, 0 failed, 1 skipped (совпадает с хендоффом) |
| сборка + сверка бандлов | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | green, `git status` после сборки чист — закоммиченный бандл воспроизводится байт-в-байт |
| новый `any` | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | 11 добавленных строк в 3 файлах, новых `any` нет |
| документация | `node scripts/check-docs.mjs` (diff трогает `src/**` — обязателен) | green: «Documentation checks passed (7 files, 10 external links)», в т.ч. `sourceFingerprint` в `docs/images/screenshots.json` сверен с текущим `src/**` — свежий |
| выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 8 прямых совпадений: `smoke_decor`, `smoke_danger_confirmation`, `smoke_editor_tabs`, `smoke_free_walls`, `smoke_furniture_polish`, `smoke_furniture`, `smoke_opening_preview`, `smoke_partition_openings` (совпадает с хендоффом) |
| выбранные смоки | `node demo/smoke_<8 файлов>.mjs` (после `npm run bundle:sync` — стенд `demo/srv/assets` не коммитится, собран локально) | все 8 → `OK`, exit 0 |
| мутационный гейт | `node scripts/mutation-gate.mjs --id=draft-delete-drops-the-promise` | `чистый прогон: node demo/smoke_free_walls.mjs` → ok; мутант красный, поймано 1 из 1 |
| негативный мутант вручную | ручной откат `await` → `void` в `_deleteDraftWhole()`, пересборка, прогон `smoke_free_walls` | `deleteOnDraftRemovesWholeOutline: expected true, got false` — дословно тот эффект, что описан в исходном аудите issue; дерево восстановлено, `git status` чист |
| unit `runContext` | `node --test test/editor-secondary.test.mjs` | green, 1/1 |

Не прогонялись и почему:
- `npm run golden:verify` — diff не касается `demo/golden/**`, видимого рендера продукта нет;
- `node scripts/model-invariants.mjs --config …` — diff не трогает геометрическую модель (рёбра, записи толщины, `layout`, `marker.space`, `open_spans`); изменяется только тип возврата и проброс промиса вокруг уже существующей логики удаления, сама логика (`sp[key] = filter(...)`, `_commitPhysicalGeometry`) не тронута ни строкой;
- `python -m pytest tests_backend` — Python не тронут;
- performance-профили — в AC не названы, путь не чувствителен к перфу (не добавляется новая асинхронная работа, только проброс уже существующего промиса);
- полный набор `demo/smoke_*.mjs` (212 файлов) — задача не задевает всё дерево; выбор `smoke-select` уже даёт 8 прямых совпадений на изменённые символы (`_deletePhysicalSelection`, `_editorSecondary`, `_editorSecondaryContextId`, `_runEditorContext`, `_deleteDraftWhole`), что покрывает все три изменённых файла.

## AC — построчная проверка

- **AC1** (задержанное подтверждение, `await` возвращает управление только после удаления draft). Доказано смоком: `demo/smoke_free_walls.mjs:226-231`, стаб подтверждения теперь резолвится через `setTimeout(...,0)` (реальная макрозадача), `draftDeleteReturnsPromise: true`, `deleteOnDraftRemovesWholeOutline: true`. Тест умеет падать — см. ручной негативный мутант выше.
- **AC2** (мутант, отбрасывающий промис `_deleteDraftWhole`, красит `deleteOnDraftRemovesWholeOutline: false`). Доказано дважды: `scripts/mutation-gate.mjs --id=draft-delete-drops-the-promise` (пойман 1 из 1) и ручной прогон с тем же патчем, вывод дословно совпадает с находкой исходного аудита issue.
- **AC3** (отмена: ожидание завершается, draft остаётся, новой записи истории нет). `demo/smoke_free_walls.mjs:217-224`: `historyBeforeCancel` снят до отмены, `cancelledDraftDeleteKeepsOutlineAndHistory` сверяет и `room_drafts[0].id`, и `c._geometryHistory.size` — оба true в прогоне.
- **AC4** (partition/column/пустой выбор/partition-с-проёмами сохраняют результат, но возвращают `Promise<void>`). Смок явно проверяет все четыре ветки: `hostedPartitionDeleteReturnsPromise`+`hostedPartitionWaitsForDecision` (проём хостится — диалог остаётся открытым, партиция на месте, синхронная ветка сохранена), `partitionDeleteReturnsPromise`+`deleteRemovesPartition`, `columnDeleteReturnsPromise`+`deleteRemovesColumn`, `emptyDeleteReturnsPromise` (без выбора). Все true. Плюс `tsc --noEmit` green для типов.
- **AC5** (`runContext`/оба `_runEditorContext`/card-фасад не теряют результат; устаревший context не запускает action). Технически сверено построчно с ТЗ: `src/editor-secondary.ts:221-224` (`runContext<T>(...): T | undefined`), `src/houseplan-editor-runtime.ts:5290-5293`, `src/houseplan-card.ts:7897,8929-8931`. Доказано `test/editor-secondary.test.mjs` (sync-значение, промис, устаревший context → `undefined` и `staleCalled === false`) и `tsc --noEmit`. Дополнительно подтверждено уже существующим смоком `smoke_danger_confirmation` (`staleContextCannotMutate: true`, не менялся, остаётся зелёным).
- **AC6** (визуальное поведение кнопок не меняется, UI не ждёт промис). Проверено чтением, не исполнением: все `@click`-обработчики (`houseplan-editor-runtime.ts:5346,5377,5417` и др.) оборачивают вызов в стрелочную функцию и отбрасывают возвращаемое значение — ни `disabled`, ни индикатор ожидания к промису не привязаны. Смоки `smoke_decor`, `smoke_editor_tabs`, `smoke_furniture*`, `smoke_opening_preview`, `smoke_partition_openings` не меняли своих пользовательских утверждений и остаются зелёными.

## Одно число — один источник

Диф не добавляет и не меняет ни одной пользовательски видимой величины (площадь, длина, подпись, подсветка) — только тип возврата внутреннего метода и его проброс. Раздел неприменим.

## Документация / скриншоты

`docs/images/06-device-editor.png` и `docs/images/screenshots.json` обновлены в отдельном коммите `24af34cc`, `check-docs.mjs` подтверждает свежесть `sourceFingerprint` на текущем `src/**`. Из 10 сценариев реально изменился один кадр (`device-editor`, заявлено 76 px, max 2 RGB, alpha unchanged) — авторский разбор относит его к шуму захвата и ссылается на инфраструктурный `#410`, не на этот фикс; девять `imageSha256` не изменились (совпадает с «9 witnesses» в хендоффе — это девять неизменившихся кадров, а не число принятых). Commit сделан человеком (владельцем), не агентом — соответствует требованию §8 «коммит делает человек». Демо/golden-эталоны (`demo/golden/baselines/**`) не тронуты.

## Находки

Нет. High: 0, Medium: 0, Low: 0.

Реализация — точное, буквальное следование технической карте ТЗ (все шесть строк карты сверены с кодом на HEAD), контракт из шести пунктов выполнен, каждый AC либо доказан автотестом с подтверждённой способностью падать, либо разобран чтением кода. Риски, названные в ТЗ (превращение синхронных исключений в отклонение промиса, обобщение `runContext`), корректно приняты и не расширяют скоуп — ссылка на #404 по наблюдаемости отклонений уместна.

## Что проверено и корректно

- Вся цепочка типов `runContext` → `_runEditorContext` (runtime) → `_runEditorContext` (card) → `_deletePhysicalSelection` (runtime, async) → `_deletePhysicalSelection` (card facade) — генерик пробрасывается без потери результата на каждом звене.
- Мутационный гейт `draft-delete-drops-the-promise` реально ловит регресс — воспроизведено вручную, вывод совпадает с находкой исходного Medium-аудита issue.
- Сборка воспроизводима: `dist/houseplan-card.js` и `custom_components/houseplan/frontend/houseplan-card.js` идентичны закоммиченным, `git status` чист после `npm run build` и после `npm run bundle:sync`.
- Трейлеры, `User-Visible: no`, отсутствие правок changelog — согласованы и обоснованы ТЗ.

## Чего не проверял

- Полный набор из 212 браузерных смоков — прогнаны только 8 отобранных `smoke-select`; остальные не относятся к изменённым символам.
- `golden:verify`, `model-invariants`, `pytest tests_backend`, performance-профили — не запускались, обоснование см. в таблице гейтов выше.
- Ручное тестирование в UI HA не проводилось — вне цикла ревью по PROCESS.md, роль ручного тестирования здесь выполняет код-ревью с прогоном автотестов и мутационного гейта.

## Вердикт

Зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0
