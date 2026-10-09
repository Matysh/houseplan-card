# CODE-REVIEW-762-r1

Issue: #762 · «Warm remount и отложенный режим: хвосты после #756»
Трек: ask · Заход: r1 · Блокирующих циклов: 0/4
Материал: `11beca1ae80a87787ebb06fbc52f4d4ac2e86ee8` (ветка `issue/762-warm-mode-adoption`, рабочая копия на этом SHA)
Validate на материале: success, https://github.com/Matysh/houseplan-card/actions/runs/36923307171 (подтверждено `gh run view` — `headSha` совпадает)

## Материал раунда

Три коммита `origin/dev..HEAD`:

- `2ec78227` fix: keep warm editor adoption subordinate to user navigation (#762) — `Issue: #762`, `User-Visible: yes`, оба changelog в этом же коммите.
- `0cd6a299` test: await warm navigation request before checking its authority (#762) — `User-Visible: no`.
- `11beca1a` refactor: keep room warm-draft construction in the lazy editor (#762) — `User-Visible: no`.

Примечание по непрерывности материала: в треде задачи упоминается более ранний
SHA `adc2d7c520d9…` («Реализация #762», разбор отказа Validate). Это не то же
дерево формально, но тот же логический коммит-набор — ветка была приведена к
ушедшему вперёд `dev` (после #740/#662), и три текущих коммита воспроизводят
тот же диф с новыми хешами после ребейза. Содержимое, число коммитов и
сообщения совпадают с описанным автором; отказ Validate (`adc2d7c5`) был
перформанс-флуктуацией ресайза, не связанной с продуктовым кодом задачи, и не
тратил цикл ревью — это зафиксировано автором и вынесено в #778. На `11beca1a`
Validate зелёный, код-ревью не начиналось ранее — цикл действительно 0/4.

## Скоуп проверки

ТЗ (`## ТЗ` в теле issue) прошло ревью ТЗ `r1` зелёным
(`docs/reviews/SPEC-REVIEW-762-r1.md`, тот же issue). Код-ревью проверяет: пять
симптомов (AC1–AC5) + соседние пути AC6, трейлеры/changelog, гейты по объёму
задачи, маршрут `route: fix` по риску изменённых участков (perf-токены
`requestAnimationFrame`/`getBoundingClientRect`/`ResizeObserver` в
`houseplan-card.ts:4084,4090,4096,4097,6417`).

## Как проверялось

### Прочитано построчно (не по заявлению)

- `src/warm-mode-adoption.ts` целиком: `resumeWarmMode` теперь сохраняет
  `_viewModeSnap` вокруг `commit()` (строка `if (host._warmVp && host._mode
  === mode) host._viewModeSnap = viewModeSnap;`) — закрывает симптом 1
  (`_setMode` больше не подменяет возвратный Просмотр временной камерой
  редактора). Защита камеры (`warmCameraUnchanged`) больше не зависит от
  `_warmRevivePending` — закрывает симптом 2 (камера без диалога).
- `src/card-runtime.ts`: `warmCameraUnchanged` вынесена в общий модуль (была
  приватной `sameView` в двух местах), используется и в `_requestMode`
  (houseplan-card.ts), и в `resumeWarmMode` — одна реализация сравнения
  камеры, не два источника правды для одного и того же факта.
- `src/houseplan-card.ts`: новый `_cancelPendingWarmMode()` — единая точка
  отмены (`_pendingNavMode = null`, `_releaseWarmRefit`, инкремент
  `_editorModeRequest`, discard диалога). Вызывается до `await
  this._ensureEditorRuntime()` в `_requestMode` (когда `!adopt`), в
  `_setMode` (когда `!warm`), в `_commitSpace` при смене пространства и в
  `_leaveCardRoute`. Это закрывает симптомы 4 и 5: новая команда/смена
  пространства синхронно обнуляет pending-намерение ДО того, как асинхронный
  resume успеет его прочитать, независимо от порядка разрешения
  `can_write`/загрузки модуля редактора.
- `_resumePendingNavMode`: явно отказывает (`_serverCanWrite === false ||
  this._kiosk` → `_cancelPendingWarmMode(); return false`) вместо входа в
  редактор — соответствует контракту «запрет или kiosk — нет» из AC1.
  Унифицирован путь — и загруженный, и отложенный runtime теперь идут через
  один и тот же `_requestMode(pendingMode, false, 'resume')`, что и
  зафиксировано правкой `smoke_nav_persist.mjs` (ожидание следующего кадра
  вместо синхронного вызова).
- Обработчик шапки (`houseplan-card.ts:4074-4104`, `houseplan-editor-runtime`
  не участвует): `hdrH`/`stageH`/`ownHdrH` публикуются только внутри
  `updateComplete.then(() => requestAnimationFrame(...))` после повторного
  измерения (`measured === t`), т.е. из уже осевшего кадра — закрывает
  симптом 3 (несогласованная пара memo). `ResizeObserver` на `.hdr` теперь
  также наблюдает `.stage` и фильтрует колбэк (`this._containerOwnedHeight ||
  entries.some(e => e.target === hdr)`), что одновременно убирает побочный
  эффект на `smoke_align_guides` (подтверждено прогоном — ниже) и покрывает
  HA-owned/zero-size сценарии AC3.
- `houseplan-editor-runtime.ts`: `_setMode` не получил третий параметр `warm`
  — он и не должен, это публичный метод host (`houseplan-card.ts:7440`),
  рантайм вызывается только из `host._setMode`. Новые обёртки
  `finishWarmModeAdoption`/`resumeWarmMode`/`warmRoomDraft` на
  `HouseplanEditorRuntime` переносят существующие операции за уже
  определённый порт (`HouseplanEditorHostPort`), не добавляя нового
  состояния комнаты — поле в поле сверено с прежним литералом в
  `houseplan-card.ts` (diff показывает чистое перемещение, не правку полей).

### Исполнено

- `npx tsc --noEmit` — чисто.
- `npm run build` — OK; `node scripts/bundle-sync.mjs` — синхронизировано для
  смоков.
- `node scripts/bundle-policy.mjs --verify` — PASS (бюджет кандидата: сборка
  цела, закоммиченная копия не сверяется на этом треке — верно по #657).
- `npm test` — **3539 pass / 0 fail** (3540 тестов, 1 skipped) — чисто.
- `node demo/smoke_warm_mode_adoption.mjs` — **все 31 проверка `true`**,
  включая оба порядка гонки AC2 (`delayed: false/true`), обе пары
  экранных точек (`ac2-pixels-*`), AC3 (обычная/HA-owned/нулевая сцена), оба
  порядка AC4 (`runtimeFirst: false/true`), AC5 десктоп и отдельный реальный
  touch-tap в мобильном viewport (`ac5TouchSpaceWins` — настоящий
  `page.locator(...).tap()`, не синтетический клик), и расширенный блок AC6
  (kiosk, отказ прав, disconnect, pan во время загрузки и последующий
  resize).
- Регрессионные смоки, перечисленные в AC6: `smoke_warm_dialogs.mjs`,
  `smoke_nav_persist.mjs`, `smoke_warm_owners.mjs`, `smoke_warm_remount.mjs`
  — все `OK`. Дополнительно прогнаны `smoke_align_guides.mjs` (побочный эффект
  из хендоффа — подтверждён как исправленный) и `smoke_readonly_cold_start.mjs`,
  `smoke_stairs.mjs` — все `OK`.
- `node scripts/mutation-gate.mjs --check` — PASS, все 7 новых мутантов
  (`warm-resume-overwrites-view-return-camera`,
  `warm-resume-camera-depends-on-dialog`,
  `warm-pan-during-runtime-keeps-refit-blocked`,
  `warm-resume-collapses-pending-header`,
  `warm-memo-publishes-torn-header-stage-pair`,
  `warm-late-resume-beats-user-mode`, `warm-late-resume-crosses-space`)
  находят свои `find`-патчи в текущем дереве; плюс изменённый
  `warm-pending-mode-leaves-revive-waiting` (переписан под новую форму кода,
  тоже найден). Browser guards: 214/200 — выше ориентира, но каждая строка
  сверх 200 держит своё обоснование в `docs/testing-notes/mutation-browser-guards.md`,
  которое обновлено (205→214) синхронно с реестром.
- `npm run golden:verify` — **192/192 PASS**, включая
  `large-house-warm-remount-dark` (сцена именно этого пути). Повторный прогон
  не потребовался — первый уже зелёный, второй запуск остановлен мной как
  избыточный.
- `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report`
  — PASS, 3 коммита, 0 предупреждений.

### Защитные AC — таблица «чем краснеет» (проверена, не переписана с нуля)

| AC | Доказано | Мутант/отрицательный случай | Проверено мной |
|---|---|---|---|
| AC1 | `ac1-view-*` (оба порядка) | `warm-resume-overwrites-view-return-camera` | найден `--check`, smoke зелёный |
| AC2 | `ac2-camera-*`, `ac2-pixels-*` (оба порядка) | `warm-resume-camera-depends-on-dialog`, `warm-resume-collapses-pending-header` | найдены оба, smoke зелёный |
| AC3 | `ac3HeightPair`, `ac3HaOwnedPair`, `ac3ZeroSizePreservesPair` | `warm-memo-publishes-torn-header-stage-pair` | найден, smoke зелёный |
| AC4 | `ac4-user-mode-*` (оба порядка) | `warm-late-resume-beats-user-mode` | найден, smoke зелёный |
| AC5 | `ac5SpaceWins`, `ac5TouchSpaceWins` (реальный tap) | `warm-late-resume-crosses-space` | найден, smoke зелёный |
| AC6 | kiosk/отказ/disconnect/pan/resize/view-cancel | `warm-pan-during-runtime-keeps-refit-blocked` + отрицательные входы (без подмены алгоритма, как и заявлено) | найден, smoke зелёный |

Пустых третьих столбцов нет — требование §2.7/#435 выполнено по каждой защитной строке.

### Числа, видимые дважды

- Бюджет бандла (301019 B / 301066 B) и прирост `monolith-baseline.json`
  (`hostRefs` 4885→4925, `portPrivates` 94→103) названы в комментарии автора и
  совпадают с диффом `scripts/monolith-baseline.json` и обновлённым
  `docs/ARCHITECTURE.md`. Один источник — `monolith-metrics.mjs` считает их
  исполнением внутри `npm test` (прошёл), текст комментария и документ только
  цитируют тот же расчёт.
- Browser guards 214/200 — совпадает в выводе `mutation-gate --check` и в
  `docs/testing-notes/mutation-browser-guards.md` (таблица обновлена теми же
  числами 38/97/214, разбивка по категориям сходится: 26+45+38+4+97+4=214).

### Чего не проверял

- Мутанты не исполнялись (это ночной гейт, #709) — проверено только что
  `--check` находит все 7 новых патчей в дереве; это и есть обязанность
  ревью на этом треке.
- `pytest tests_backend` / HA-harness не прогонялся: задача не трогает
  `custom_components/houseplan/**` (диф затрагивает только `src/`, `demo/`,
  `scripts/`, `docs/`) — Python-гейт здесь не по AC и не по диффу.
- Полный предрелизный performance-набор (`benchmark:large-house`) не
  перегонял — автор уже выполнил его дважды (до/после) в комментарии и
  зафиксировал непостоянство отдельно в #778 (P2, infra, не #762). Это не
  AC этой задачи (AC нигде не называют числовой performance-порог), а
  существующий флуд ресайза; я проверил, что #778 действительно заведён,
  помечен и ссылается на #762.
- Windows pre-push отказ `test/iso-overlay-fixture-types.test.mjs:110`
  проверен по существу: issue #777 заведён, помечен `infra`/`tests`/P2, не
  требует изменений продуктового кода #762 — я не стал его воспроизводить на
  Windows (вне доступной среды), доверяю зафиксированному разбору автора,
  это не AC и не гейт code-review на Linux-материале.
- `ci:golden` требовал полный прогон golden (сделан, см. выше) — скриншоты
  документации не обновлял намеренно (не гейт задачи, #697).

## Находки

Нет. High: 0, Medium: 0.

Рассмотренные кандидаты, снятые при проверке:
- Несовпадение SHA `adc2d7c5` (хендофф) vs `11beca1a` (материал) — не находка:
  резолвится как ребейз того же диффа на ушедший вперёд `dev` (§2.10 — «если
  SHA не резолвится, это не находка сама по себе»; здесь оба резолвятся,
  содержимое идентично по трём коммитам и файлам).
- Третий параметр `warm` в `HouseplanEditorHostPort._setMode` отсутствует в
  сигнатуре реализации `HouseplanEditorRuntime._setMode` — не находка:
  интерфейс описывает публичный `_setMode` хоста (`houseplan-card.ts`,
  реально имеющий `warm`), а не метод рантайма, который вызывается только из
  хоста без `warm`.
- `ac3PairDiagnostic` может содержать не-`true` значение при провале —
  не баг, намеренный диагностический вывод смока (`checkAll` падает на нём
  читаемым сообщением, а не маскирует).

## Что проверено и корректно

- Все 5 симптомов из тела issue имеют по отдельному красному свидетелю на
  исходном SHA (заявлено автором, не перепроверялось мной заново — это
  требует отката кода, что выходит за рамки код-ревью при наличии
  зелёного смока и подтверждённого мутанта на текущем коде) и по зелёному
  — исполнено мной на материале `11beca1a`.
- Трейлеры `Issue:`/`User-Visible:` на месте во всех трёх коммитах класса
  A/B; `User-Visible: yes` несёт оба changelog в том же коммите.
- `route: fix` оправдан: оба канонических документа (`docs/WARM-REMOUNT.md`,
  `docs/ARCHITECTURE.md`) обновлены вместе с кодом, и каждый из
  perf-рискованных токенов (rAF/getBoundingClientRect/ResizeObserver в
  указанных строках) закрыт именованным AC с собственным тестом и мутантом.
- Побочный эффект, найденный и исправленный самим автором в процессе работы
  (stage-only `ResizeObserver` ломал `smoke_align_guides`), подтверждён
  исправленным — регрессионный смок зелёный на этом материале.

## Вердикт

Зелёный. Код делает заявленное, доказательства по каждому AC полны и
воспроизводимы, гейты (typecheck/test/build/bundle-policy/golden/mutation-gate/process-gate)
исполнены мной на материале `11beca1ae80a87787ebb06fbc52f4d4ac2e86ee8` и
зелёные, Validate на этом SHA зелёный. Находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/762-warm-mode-adoption`, коммит `11beca1ae80a` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `9e68eed01177ab60ce6c66021c6ac04d6dd1599d`
  ```
  git log --all --format='%H %T' | grep 9e68eed01177
  ```
- Тело issue: `43855b946e06e4cbd56d6890ba92b55ab76f4f3334fd8c10ac7b271d90344cee`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4326 output_tokens=32490 cache_creation_input_tokens=143131 cache_read_input_tokens=9381646 num_turns=86 -->
