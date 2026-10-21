# CODE-REVIEW-947-r2

Issue: #947 «Настройки устройства: финальный UX общих и профильных разделов».
Трек: ask. Заход: r2 (код-ревью). Блокирующих циклов на этапе `code`
израсходовано 1 из 4 до этого вердикта (жёлтый r1). Материал:
`28e72c3958eb6d055b695f68a181a02065722211` (рабочая копия на нём), база
`origin/dev` = `ed3cb6d3004281170d860a7005adc57ad027da64`. Материал предыдущего
раунда: `ecbb1e520a63cbef0fe6033d270dfd2643cdfc4b` (прямой предок текущего
HEAD — `git merge-base ecbb1e52 HEAD` подтверждает это).

## Скоуп раунда

Повторный раунд — разбор по дельте (PROCESS.md §2.10), а не задачи целиком.
Дельта `ecbb1e52..HEAD` состоит из пяти «родных» коммитов #947 и одного
служебного merge-коммита:

1. `38985cfe` fix(device): undo pending legacy radar removal without losing
   edits — закрывает единственную Medium-находку r1.
2. `ce4a532f` test(device): retain static mutation anchors after radar undo —
   механическое обновление двух статических `find:`-якорей реестра мутаций
   под новый текст строки (регистрация, не исполнение).
3. `eadaed20` Merge accepted properties source into Device settings without
   rewriting history — слияние уже принятого в `dev` #931 (панель свойств)
   в ветку задачи. Подтверждено: второй родитель (`ed3cb6d3`) уже является
   предком `origin/dev` (`git merge-base --is-ancestor ed3cb6d3 origin/dev` →
   true), поэтому `git diff origin/dev...HEAD` по-прежнему показывает ровно
   85 файлов, относящихся к #947, без единого файла #931 — слияние корректно
   не расширяет скоуп этой задачи.
4. `fe142774` test(device): carry the accepted properties golden set before
   joint capture — перенос уже принятого dev-комплекта baseline без новой
   приёмки (класс D, с `Release:`).
5. `024e2061` fix(device): explain inherited glow radius without calling the
   field empty — новая, не связанная с r1-находкой правка текста подсказки
   радиуса свечения, найденная автором при ручном визуальном сличении
   совместного дерева.
6. `e5a46ca3` docs(device): refresh native proof after joint integration and
   radius guidance — обновление evidence-пары/README под (3) и (5).
7. `28e72c39` test: accept reviewed Device settings over current Properties
   panel — финальная приёмка golden (класс D, `Release:` +
   `Baseline-Reviewed-Local:`).

Коммиты #931 между `ecbb1e52` и `eadaed20` (`b0024361` … `ed3cb6d3`) — чужая,
уже принятая задача со своим независимым код-ревью (видно по `docs/reviews/
CODE-REVIEW-947-r1.md` отсутствию и по собственным `docs: review document for
#931` коммитам в истории); эта работа не разбиралась повторно — не часть
материала #947.

## Как проверялось

Дельта вычислена явно: `git diff --stat ecbb1e52..HEAD -- src/ test/ docs/...`
с последующим построчным чтением каждого из пяти «родных» коммитов
(`git show <sha>`) по отдельности, а не агрегированного диффа. Каждый найденный
файл сверен по `git log --oneline ecbb1e52..HEAD -- <файл>`, чтобы отличить
«родную» правку #947 от унаследованного через merge содержимого #931
(`scripts/bundle-budget.mjs`, `scripts/monolith-baseline.json`,
`docs/release-ledger/v1.81.0/931.json`, бóльшая часть `scripts/
mutation-registry.mjs` — все оказались чужими, последняя правка в каждом из
них от коммитов `b0024361`…`c24b170d` (#931), не от #947).

### Проверка исправления Medium (r1)

Прочитан построчно весь диф `38985cfe` по `marker-dialog.ts`,
`marker-form-state.ts`, `houseplan-editor-runtime.ts`. Прослежена логика
руками:

- `legacyRadar` больше не гасится условием `!d.radarRemove` — калаут остаётся
  на экране и после клика «Удалить».
- Калаут меняет текст/действие по `d.radarRemove`: обычная подсказка+«Открыть
  предыдущие настройки радара» → предупреждение об удалении при
  сохранении+«Отменить удаление», которая вызывает
  `restoreMarkerRadarRemoval` без повторного открытия формы.
- `restoreMarkerRadarRemoval`/`rememberMarkerRadarRemoval` в
  `marker-form-state.ts` — UI-only `WeakMap`, привязанная к владельцу сессии
  диалога (`dialogSession`); восстанавливает `radarRemove:false` и
  `radarTouched` из снимка (или, если объект `radar` в драфте сменился/сессия
  другая, деградирует на `d.radarTouched`/`false` для чужого радара — не
  затирает посторонний черновик).
- `radar-section.ts` не трогался этим фиксом: при восстановлении
  `d.radarRemove=false` и `d.radar` не пуст, поэтому `active` снова `true`,
  и полная форма радара (калибровка/источники) рендерится повторно —
  именно то, что требовал AC5 «путь совместимости».
- `remove()`-кнопка остаётся без изменений, «обычное Save удаления»
  по-прежнему работает (отдельно проверено в сценарии `confirmed_removal_
  still_works` нового смока).

Новый юнит-тест `test/dialog-baseline.test.mjs` (`#947 undo radar removal…`,
`#947 opaque future profiles…`) собран и выполнен локально:

```
npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs \
  && node --test test/dialog-baseline.test.mjs
# 14 pass / 0 fail, включая оба новых #947-теста
```

Логика теста прослежена построчно: оба случая (обычный touched/untouched
радар и «opaque future»-профиль с другой сессией) покрывают именно те ветки
`restoreMarkerRadarRemoval`, которые отличают её от наивной реализации
(обычное восстановление, вырожденный случай другого радара/новой сессии).

Браузерный смок `demo/smoke_radar_legacy_removal_947.mjs` — новый файл,
прочитан целиком. Сценарий: три фикстуры (`known`/`edited`/`future` — опорный
кейс для непрозрачного будущего формата) открывают путь совместимости, жмут
«Удалить», проверяют видимость и клик «Отменить удаление» с точным
сравнением JSON-черновика радара/флага `touched`/имени, затем раздельно
проверяют Cancel (не трогает сохранённое) и Save (сохраняет тот же радар
побайтово) и, отдельно, что обычное подтверждённое удаление по-прежнему
работает. `checkAll(out)` в `demo/serve.mjs:79-82` требует `true` для
каждого ключа через строгое `JSON.stringify`-сравнение — тест может падать
не только в теории.

Запустить этот и прочие браузерные смоки самостоятельно в этой ревью-среде
не удалось — см. «Чего не проверял». Вместо этого принят **комбинированный**
довод из двух независимых источников:

- автор в хендофф-комментарии (2026-10-18 19:58 и 20:53) заявляет явный
  отрицательный прогон на **неизменённом** r1-материале: «обычный новый
  `node demo/smoke_radar_legacy_removal_947.mjs` на неизменённом A-коде r1
  воспроизвёл ровно шесть отрицательных результатов… на исправленном коде
  все 16 наблюдений PASS» — это ровно требуемый по общей политике «обычный
  отрицательный случай с командой и результатом» (новый тест против старой,
  уже опубликованной ревизии кода, а не патч текущей реализации);
- моя собственная проверка чтением логики (выше) подтверждает, что
  обнаруженный в r1 баг (полное исчезновение калаута/формы после «Удалить»)
  структурно устранён, а не просто скрыт другим путём.

### Проверка новой правки 024e2061 (вне r1-находки)

Это чисто текстовая правка (8 строк: `marker.glow_radius.help` в 4 локалях +
`marker.glow_radius_empty_hint` в 4 `settings/*.json`) без изменения модели/
логики: подпись заполненного наследуемого радиуса перестаёт называть поле
«Пусто», подсказка объясняет переопределение/очистку — ровно в формулировке
согласованного владельцем v6 (см. `docs/design/settings-dialogs-944/
device-implementation-evidence/README.md`, абзац о найденном противоречии).
`demo/smoke_device_settings_947.mjs` получил два новых ассерта
(`radius_caption_describes_inheritance`, `radius_help_explains_override_and_
clear`), не удаляя и не ослабляя прежний `radius_filled_but_not_materialized`
(поле показывает значение, но `glowRadius===''` в драфте — override не
материализуется). Changelog (EN+RU, один коммит) корректно описывает именно
это изменение. User-Visible: yes оправдан — текст виден пользователю.

### Проверка golden-приёмки (`28e72c39`)

`git show 28e72c39 -- demo/golden/baselines/baselines-index.json` даёт ровно
те же 7 деклараций хэшей, что были объявлены и приняты в r1:
`device-dialog-desktop-{en,de}`, `device-dialog-mobile-ru`,
`toggle-entity-dialog-{desktop-en,mobile-ru}`, `device-help-popover-light-ru`,
`device-ripple-color-popover-mobile-ru` — пересдвиг пикселей ожидаем
(изменился текст калаута и подсказки радиуса в этих же диалогах), расширения
набора сцен нет, остальные 205 сцен матрицы78 не тронуты. `localAttestation`
указывает источник `issue/947-device-settings@e5a46ca3` (ветка и коммит
совпадают с «родным» деревом #947, не #931) — паспорт относится к верному
материалу.

### Гейты

| Гейт | Результат | Источник |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + `bundle-policy --verify` | не перегонял полностью — зелёный Validate на точном SHA `28e72c39`: https://github.com/Matysh/houseplan-card/actions/runs/39165231932 (подтверждено автором 2026-10-18 21:08 и совпадает с доверенным снимком препролога) | CI |
| `npm run build` (локально, для свежего `dist/` под смоки) | PASSED, 17.4s | выполнено мной |
| `npx tsc -p tsconfig.test.json && node --test test/dialog-baseline.test.mjs` | 14 pass / 0 fail (включая 2 новых `#947`-теста) | выполнено мной локально |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | `demo/smoke_radar_legacy_removal_947.mjs` — прямое совпадение по `_markerDialog`; широкий диф (`houseplan-editor-runtime.ts`) даёт 85 прямых совпадений — ожидаемо для монолита, полный прогон не требуется для точечной дельты r2 | выполнено мной |
| Браузерные смоки по дельте (`smoke_radar_legacy_removal_947`, `smoke_device_settings_947`, `smoke_radar_setup`) | **не удалось выполнить в этой среде** — см. «Чего не проверял» | см. ниже |
| `golden:verify` (`ci:golden`) | принят D-коммитом `28e72c39`, `Baseline-Reviewed-Local: sha256:ede16903…`, ровно 7 деклараций сцен | чтение коммита |
| `pytest tests_backend` | не применим — дельта `ecbb1e52..HEAD` не трогает `custom_components/**` (унаследованные правки Python принадлежат #931) | `git log` по пути |
| `npm run invariants` | не применим — дельта только в presentation-слое диалога (калаут/подсказка), геометрии/модели плана нет | чтение диффа |
| мутанты (исполнение) | не запускались и не должны были (вне ночного прогона); `ce4a532f` — чисто механическая синхронизация двух статических `find:`-анкеров под новый текст строки, не новая регистрация и не исполнение | чтение `scripts/mutation-registry.mjs`, `test/mutation-gate.test.mjs` |

## Чего не проверял

- **Браузерные смоки не выполнены мной лично.** Попытка запустить
  `demo/smoke_radar_legacy_removal_947.mjs` (и, для диагностики, два не
  связанных с #947 смока — `demo/smoke_room_save_retry_946.mjs` и
  `demo/smoke_climate_temp.mjs`) в этой ревью-среде закончилась одинаковой
  ошибкой headless-браузера: `EXC Failed to fetch dynamically imported
  module: http://.../assets/houseplan-card.js` с таймаутом
  `page.waitForFunction`. Эта ошибка воспроизводится на **уже принятом,
  несвязанном с #947** смоке — значит, это ограничение текущей исполняющей
  среды (загрузка динамического ES-модуля бандла хедлесс-браузером по
  loopback HTTP), а не регрессия, внесённая этим диффом. Честно отмечаю:
  браузерное исполнение в рамках этого раунда не проводилось ни мной; принят
  комбинированный довод — построчное чтение логики фикса + исполненный
  юнит-тест + явный заявленный автором RED→GREEN прогон нового смока на
  старой/новой ревизии кода (см. выше).
- Полную матрицу golden/смоков не гонял — это предрелизный гейт
  (PROCESS.md §8), а точечная приёмка 7 деклараций уже подтверждена отдельным
  D-коммитом с WSL-паспортом.
- Не проверял содержимое #931 (панель свойств) по существу — это чужая,
  уже прошедшая отдельный код-ревью задача; проверил только то, что её
  слияние не расширило скоуп #947 и не изменило поведение, используемое
  диалогом устройства (аддитивные опциональные поля в `form-kit.ts`:
  `valueLabel`, `readonly`, `leading` — ни одно не передаётся из
  `marker-dialog.ts`).
- Backend/Python и инварианты геометрии — не применимы к этой дельте
  (см. таблицу гейтов).
- PNG-скриншоты (`led-light-1280-pair.png` и обновлённые пары) не сверял
  попиксельно — положился на присутствие, размеры и SHA-256 в
  `evidence.json`, совпадающие с описанием найденного автором противоречия.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Medium: потеря возможности отменить «Удалить» у legacy-radar-профиля в той же сессии (callout и форма полностью исчезают) | `legacyRadar` больше не зависит от `d.radarRemove`; добавлено явное состояние «Отменить удаление» с восстановлением точного черновика (радар/touched/правки имени и других полей) через UI-only `WeakMap`-снимок, привязанный к владельцу сессии | `src/editors/marker-dialog.ts:817-871` (отменённая строка условия `legacyRadar`, новый блок `callout`), `src/editors/marker-form-state.ts` (`rememberMarkerRadarRemoval`/`restoreMarkerRadarRemoval`), `src/houseplan-editor-runtime.ts:11583-11590` (перехват патча `radarRemove` для снятия снимка); юнит-тест `test/dialog-baseline.test.mjs` (14/14 PASS, выполнено мной); новый смок `demo/smoke_radar_legacy_removal_947.mjs` (заявленный автором RED6→GREEN16) |
| Low (снят ревьюером): задвоенный абзац футера `docs/USER-GUIDE.md:1376-1378` | Не трогался этим раундом — низкий приоритет, ревьюер r1 уже снял находку без блокировки, задача не обязывала к правке | не проверялось повторно — вне скоупа дельты |

## Унаследовано из r1 (без повторной проверки)

Следующее принято без повторного исполнения — соответствующие файлы не
менялись в дельте `ecbb1e52..HEAD` (кроме перечисленного выше), проверено
`git log --oneline ecbb1e52..HEAD -- <путь>` по каждому пункту:

- Удаление ручного объявления нового радара только для hardware-recognized
  устройств (`recognizeRadarBinding`), раздельность от `recognizeRadar`.
- `marker.hide_signal` не тронут по модели/схеме.
- AC3 (preview `scale=1`, отсутствие материализации поворота/размера),
  AC6 (границы пылесоса/радара, guard `isActive()` на Save/Hide/Delete),
  AC7 (тема/mobile/MDI, media-блоки 320/390px).
- `docs/RADAR.md`, `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md` —
  терминология и полнота по арбитражу владельца от 18.10.2026.
- i18n-парность четырёх локалей (280 общих ключей + 18 мёртвых удалены
  синхронно), кроме восьми строк, изменённых `024e2061` (проверено заново
  в этом раунде — см. выше).
- Трейлеры/changelog/release-ledger/bundle-budget исходного диффа #947
  (до `ecbb1e52`).

Документ-источник: `docs/reviews/CODE-REVIEW-947-r1.md`, материал
`ecbb1e520a63cbef0fe6033d270dfd2643cdfc4b`.

## Находки

Новых находок нет. Medium r1 закрыт правкой `38985cfe`+`ce4a532f` с
достаточным доказательством (юнит-тест исполнен мной, логика прослежена
чтением, браузерный смок добавлен и заявлен автором как RED→GREEN на
старой/новой ревизии). Правка `024e2061` — точечное, корректно
задокументированное улучшение текста в рамках той же задачи, не расширяет
скоуп и не создаёт нового риска. Слияние `#931` не затронуло код/поведение
диалога устройства (аддитивные опции `form-kit.ts` не используются
`marker-dialog.ts`) и не расширило диапазон `origin/dev...HEAD` за пределы
85 файлов #947.

## Маршрут побочных находок

Доверенный снимок политики: `mode=issues` (`HP_REVIEW_OUTSIDE_FINDINGS_FILE_
ISSUES`, issue #947, round 2). Побочных находок, подлежащих заведению
отдельным issue, не обнаружено.

## Вердикт

High: 0. Medium: 0. Единственная Medium-находка r1 закрыта с достаточным
доказательством; новая попутная правка в скоупе задачи и корректно
задокументирована. Зелёный вердикт, цикл не образуется.

`route: fix`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/947-device-settings`, коммит `28e72c3958eb` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a8545ed8c08e6e4432e0d9dcc63a3e2224189424`
  ```
  git log --all --format='%H %T' | grep a8545ed8c08e
  ```
- Тело issue: `a3d9a3e96733c14d016336d076da0b5768fca7c8fb75c2b9ff7377ddc51db350`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMjEsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjEwOTk5OTk5OTk5OTk5NX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTIwLCJvdXRwdXRfdG9rZW5zIjo0MjMyNSwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxNjg1MTYsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo2NzIxNzQ2LCJjb3N0VXNkRXN0aW1hdGUiOjIuNDQxOTAzMn1dLCJ0dXJucyI6NjcsImR1cmF0aW9uTXMiOjcxOTkxNSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjIuNDQ3MTE0MiwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5241 output_tokens=42343 cache_creation_input_tokens=168516 cache_read_input_tokens=6721746 num_turns=67 -->
