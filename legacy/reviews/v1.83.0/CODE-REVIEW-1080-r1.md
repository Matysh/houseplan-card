# CODE-REVIEW-1080-r1

Вердикт: жёлтый · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 1 → в задаче · Документ: docs/reviews/CODE-REVIEW-1080-r1.md

Материал: `d2cafbffbcb7f5a0e9817719a14520191f804474` (ветка `issue/1080-decor-preview-ownership`, база `dev@7a011241a`).
Маршрут побочных находок: `mode=issues` (доверенный снимок `HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`); побочных находок вне скоупа нет, `outside_findings: []`.
`route: fix`.

## Скоуп

Issue #1080, трек `ask`, этап code, заход r1. ТЗ: убрать визуальный «отпечаток» превью
декора (мебель/фигуры-линии/изображения) после передачи владения между обычным
(settled) и live-слоем редактора подложки — AC1–AC5. Изменённые файлы: `src/live-editor.ts`,
`src/houseplan-card.ts` (продукт, класс A); `demo/golden/{harness,matrix}.mjs`,
`demo/smoke_decor_preview_ownership.mjs` (новый), `scripts/mutation-registry.mjs`,
`scripts/ci-registry-inventory.json`, `scripts/smoke-links.mjs`, `test/*.test.mjs` (класс B);
остальное — документация/release-ledger (класс C/D).

Риск по изменённым участкам (#707): `src/live-editor.ts:416` — токен `requestAnimationFrame`,
используемый для различения устаревшего/живого кадра. Класс покрыт: контракт
«отложенный rAF/async artwork не возвращает отменённое поколение» — AC4 ТЗ, и
прямым unit-тестом `test('#1080 a cancelled or detached frame cannot paint or
consume a later action')` в `test/live-editor.test.mjs` (исполнен мной, PASS,
см. таблицу гейтов).

## Независимый разбор (до авторских выводов)

Корневая причина подтверждена чтением, не только заявлением автора:
`editorTemplate` (live-слой, `src/live-editor.ts:294`) вызывает тот же
`host._renderDecorLayer(...)`, что и обычный `render()` компонента
(`src/houseplan-card.ts:11347`) — оба дерева читают одно и то же состояние
(`_furnPreviewInput`/`_cursorPt`/`_decorDraft`) и потому рисуют одинаковое
превью. Но во время живого жеста `routeHouseplanEditorUpdate` отводит
обновление в `scheduleHouseplanEditor` (только live-слой), а обычный Lit-рендер
не перезапускается — значит settled-копия превью замораживается на положении
последнего полного рендера, а live-копия идёт дальше. Это и есть источник
«отпечатка»: до фикса ничего не прятало устаревшую settled-копию во время
живого движения.

Фикс (`src/live-editor.ts:395-403`) после рендера live-кадра проверяет
`target.querySelector(selector)` для `['.ddraft', '.furniture-placement-preview',
'.decor-image-placement-preview']` и только для реально нарисованного вида
прячет (`style.visibility = 'hidden'`) совпадающую settled-копию через
`.decorlayer ${selector}` — узкий селектор, не широкий decor-hide (AC6).
`commitHouseplanEditor` (полный рендер, не изменён по существу) сначала
`restore(state)` (возвращает видимость settled), затем чистит live-слой
(`render(nothing, target)`) — порядок «владение возвращается settled раньше
очистки live» сохранён, переключения «сначала удалить, потом восстановить на
следующем rAF» нет (AC2 п.2).

Защита от устаревшего/отсоединённого кадра (`scheduleHouseplanEditor`,
`src/live-editor.ts:412-426`): замыкание захватывает сам `frame`-id и
проверяет `states.get(value) !== state || state.raf !== frame` перед покраской.
Прослежено и подтверждено модульным тестом: кадр, отменённый `commitHouseplanEditor`
без реального `cancelAnimationFrame` (тестовая заглушка), и кадр, оставшийся
после `disposeHouseplanEditor` (новое состояние в `WeakMap` имеет другой
идентификатор), оба корректно не красят и не резолвят `whenHouseplanEditorSettled`.

`lostpointercapture` (`src/houseplan-card.ts:11148`): добавлена строка
`if (this._decorDraft?.pid === e.pointerId) this._stagePointerCancel(e);` —
по той же схеме, что уже существующие `backdropGesture.owns`/`decorLine.owns`
проверки. `_stagePointerCancel` → `_editorRuntime._stagePointerCancel` уже
содержит корректную проверку `pid` перед очисткой `_decorDraft` (строка 2298
`houseplan-editor-runtime.ts`, код не новый) — новая строка лишь включает этот
путь для прямоугольника/овала при потере настоящего pointer capture, которого
раньше не было (это и есть задокументированный баг AC4 «Rectangle / ellipse»).

Text подтверждён отсутствием отдельного canvas-превью: `grep` по
`_decorTool === 'text'`/`text-placement-preview` в `houseplan-card.ts` не находит
отдельного transient-пути — клик сразу открывает диалог, поэтому отдельного
«отпечатка» для текста архитектурно не существует (соответствует анализу
автора).

Мутанты (`scripts/mutation-registry.mjs`) точно бьют по добавленным строкам:
`decor-preview-keeps-settled-footprint-1080` патчит именно новую строку
`hide(state, root, '.decorlayer ${selector}')` на no-op; `decor-preview-keeps-lost-capture-draft-1080`
патчит именно новую строку `lostpointercapture`-проверки на `if (false)`.
Оба зарегистрированы, не исполнялись (ночной прогон, политика #905/#709) —
это корректный «чем краснеет» для защитных AC1/AC4 без обхода общей политики.

## Гейты: что прогнано и результат

| Гейт | Выполнено | Результат |
|---|---|---|
| `read:diff`, `read:log` | да | прочитан точный дифф и 4 коммита диапазона |
| `build:test` | да | PASS (подготовка `test-build/` для тестов, читающих его) |
| `unit:test/live-editor.test.mjs` | да, исполнено заново | PASS — включая новый `#1080 a cancelled or detached frame...` |
| `unit:test/furniture-art-runtime.test.mjs` | да, исполнено заново | PASS — включая новый `#1080 delayed artwork does not update a detached preview host...` |
| `unit:test/golden-matrix.test.mjs` | да, исполнено заново | PASS — версия `GOLDEN_MATRIX_VERSION=96` подтверждена тестом |
| `build:build`, `build:bundle:sync` | да | PASS (нужны как предпосылка для браузерного smoke) |
| `smoke:demo/smoke_decor_preview_ownership.mjs` | да, исполнено заново | PASS (`OK`) — все именованные проверки AC1–AC4 (`preview.old-position.no-painted-footprint`, `preview.presented-frames.one-owner-without-blank`, `preview.hover.*`, `preview.cancel.*`, `preview.commit.*`, `preview.{rect,ellipse,line,image}.*`, `preview.{pointercancel,lostpointercapture}.*`, `preview.changed-{symbol,tool,space}.*`, `preview.view.no-editor-ghost`, `preview.reconnect.no-retired-ghost`) |
| `static:bundle-budget` | да | PASS; существующее предупреждение «запас бюджета 5385 Б» — репозиторный, не вызван #1080 (headroom не менялся этой задачей) |
| `static:mutation-registry` | да | PASS — оба новых определения структурно корректны |
| `static:status-snapshot` | да | **FAILED** — «snapshot block is stale»; см. находку ниже |
| `static:smoke-select` | попытка | недоступен в этом runner'е (требует `--base`/`--head`, аргументы модели не задаются) — не воспроизведён заново; переиспользован заявленный автором локальный PASS (нет оснований сомневаться: выбор смоков по диффу механический) |

Не прогонялось отдельно (переиспользовано как пригодное evidence, т.к. вход/код/окружение не менялись и ciEvidence зелёный — `review-light-golden proof is complete`, https://github.com/Matysh/houseplan-card/actions/runs/40329511195):
- полный `gate:small`/tsc/build сверх перечисленного — риски диффа покрыты адресно;
- Golden-захват сцены `decor-preview-handoff-1080` — в манифесте нет `golden:run`-проверки; переиспользован зафиксированный PNG SHA256 и запись «просмотрено» автора;
- `smoke_furniture.mjs`, `smoke_decor.mjs`, `smoke_decor_text.mjs`, `smoke_decor_images.mjs`, `smoke_kiosk.mjs` — пути, которые этот дифф не трогает (View/kiosk architecturally не получают editor-слои, text не имеет отдельного transient-превью); низкий маржинальный риск повторного прогона;
- совместный кандидат с #1081 — временный локальный merge, не часть материала этой задачи и не даёт полномочий слияния; его результат — заявление автора, не проверяемое в рамках ревью #1080 без изменения предмета ревью;
- `pytest tests_backend`, `npm run invariants` — неприменимо (нет правок Python/геометрии в этом диффе).

## Находки

### Medium (в скоупе) — M1: `docs/STATUS.md` снимок регрессировал теги релиза внутри этого же диффа

Воспроизведение: диф задачи (`read:diff`) меняет сгенерированный блок
`docs/STATUS.md`:

```
-| Latest stable tag | `v1.82.0` |
-| Latest prerelease tag | `v1.83.0-beta.2` |
+| Latest stable tag | `v1.79.0` |
+| Latest prerelease tag | `v1.80.0-beta.5` |
```

То есть ДО коммитов #1080 файл указывал верные теги (`v1.82.0`/`v1.83.0-beta.2`),
ПОСЛЕ — откатился на три стабильных и несколько бета-релизов назад. Строка
`Version` (`**1.83.0-beta.2**`) в этом же блоке не изменилась — значит «текущая
версия дерева» и «последний известный пре-релизный тег» внутри одной таблицы
теперь расходятся (1.83.0-beta.2 vs v1.80.0-beta.5), хотя обычно второе должно
совпадать с первым или идти впереди него.

Это прямое нарушение «одно число — один источник» (§8): та же задача в этом же
диффе заводит `docs/release-ledger/v1.82.0/1080.json` с `"baseStable": "v1.82.0"`
и везде в хендоффе/анализе (`docs/analysis/1080-decor-preview-ownership.md`,
хендофф-комментарий) называет v1.82.0 последним стабильным, а
v1.83.0-beta.2 — текущим пре-релизом. Автогенерируемый снимок в этом же
коммите утверждает другое число для того же факта.

Проверено исполнением: `static:status-snapshot` (read-only регенерация блока
по дереву/`git tag`) на материале `d2cafbffbcb7f5a0e9817719a14520191f804474`
возвращает `docs/STATUS.md: snapshot block is stale — run node
scripts/status-snapshot.mjs --write` (exit 1) — то есть закоммиченный снимок не
совпадает с тем, что даёт пересчёт прямо сейчас, в среде с полным доступом к
тегам. Это подтверждает: коммит задачи содержит устаревший/неверный пересчёт
(вероятно, `status-snapshot.mjs --write` был запущен в локальном окружении
автора без актуальных тегов) — не вопрос окружения ревью, а фактическое
содержимое материала.

Последствие: `docs/STATUS.md` — документ, который `AGENTS.md` прямо называет
источником «current state for a resuming session» и местом, которое читают при
подготовке релиза; искажённые «Latest stable/prerelease tag» способны увести
будущую сессию/владельца к неверным предположениям о состоянии линии релизов
(например, при выборе stable-fix/line-fix базы для следующей задачи).

Это Medium в скоупе (файл — часть измененных файлов #1080, правка — часть
коммитов диапазона): по правилу «Medium в скоупе чинится в текущем issue» —
жёлтый вердикт, отдельный issue не заводится. Исправление — перегенерировать
блок (`node scripts/status-snapshot.mjs --write`) на окружении с актуальными
тегами и закоммитить вместе с остальным диффом задачи.

## Что проверено и корректно

- Корневая причина «отпечатка» независимо прослежена по коду (общий
  `_renderDecorLayer` в settled/live деревьях + отвод live-свойств из полного
  Lit-рендера) и совпадает с объяснением автора.
- Порядок передачи владения (settled restore → live clear на полном рендере;
  live paint → settled hide на живом кадре) соответствует контракту AC2 п.1–2,
  включая запрет «удалить-потом-восстановить-на-следующем-rAF».
- Селекторы `decorPreviewSelectors` узкие (`.ddraft`,
  `.furniture-placement-preview`, `.decor-image-placement-preview`), не задевают
  сохранённый декор и не используют широкий decor-hide (AC6).
- Защита от устаревшего/отсоединённого кадра (`frame`-токен + проверка
  идентичности `state`) верна и покрыта исполненным unit-тестом, который я
  перезапустил и подтвердил зелёным.
- Потеря pointer capture у `_decorDraft` (прямоугольник/овал) теперь
  маршрутизируется в уже существующий корректный путь отмены — убедился, что
  `_stagePointerCancel`/`_editorRuntime._stagePointerCancel` уже проверяли
  `pid` до этой правки, то есть новая строка только включает недостающий вызов,
  не меняет существующую логику отмены.
- Ядро AC1–AC4 подтверждено исполнением браузерного smoke
  `demo/smoke_decor_preview_ownership.mjs`, который я перезапустил (после
  `build:build`+`build:bundle:sync`) и получил `OK` — независимо от заявления
  хендоффа.
- Мутанты в `scripts/mutation-registry.mjs` бьют точно по добавленным строкам
  (`static:mutation-registry` PASS), «чем краснеет» для AC1/AC4 оформлено
  корректно — зарегистрированные свидетели с честным «не исполнялся».
- Текст (text) верно исключён из инвентаризации превью: отдельного
  canvas-размещения нет, подтверждено отсутствием соответствующего кода.
- Трейлеры: `User-Visible: yes` сопровождён правками `docs/CHANGELOG.md` и
  `docs/CHANGELOG.ru.md` в этом же диффе (оба присутствуют и описывают один и
  тот же пользовательский эффект).
- `GOLDEN_MATRIX_VERSION` 95→96 синхронно обновлена в `demo/golden/matrix.mjs` и
  обоих местах `test/golden-matrix.test.mjs`, тест перезапущен — PASS.
- `docs/testing-notes/mutation-browser-guards.md` — арифметика итогов
  (91→92, 264→265, итог 528→530) верна.

## Чего не проверял

- Визуальное совпадение с эталоном UI Lab UI-038 и целевая Golden-сцена
  `decor-preview-handoff-1080` — не перезахватывал (нет доступного
  `golden:run`/capture-чека в этом runner'е); доверился записи автора (PNG
  SHA256, визуальный просмотр) и зелёному `ciEvidence`/validate-gate для этого
  материала.
- Совместный сценарий с #1081 (AC5, «furniture-pan не ломается») — не
  воспроизводил: это требует кода другой задачи, не входящего в материал
  #1080; временный merge автора не даёт полномочий слияния и не является
  частью этого ревью. Сама задача #1080 архитектурно не трогает жест pan
  (разделение зафиксировано в ТЗ), риск регрессии в #1081 со стороны кода
  #1080 структурно мал (единственная точка пересечения — тот же live-editor
  commit/paint путь, который я прочитал целиком).
- `static:smoke-select` — не смог исполнить в этом runner'е (не принимает
  `--base`/`--head`); переиспользовал заявленный автором локальный результат.
- Полный ночной прогон `mutation-gate` (реестр 1926 определений) — вне
  объёма ревью по правилам track `ask`/code (ночной, не гейт ревью).
- `pytest tests_backend`, `npm run invariants` — неприменимо, диф не трогает
  Python/геометрию.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImQ3MDNlOTFlYjU0ZjY5MjQ0ZGQ2OTNiZmE1Nzc1NTk3NDkzYWE3YzQ1YTczNGI2ZDg5ZDYyMTA1YmFkMDExY2IiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI1MzlmZDE1YzMwMjY1ZWExNWViNWE3OGY3Y2M3ZjY2NDY0MDg0YjY5YmMxNTRjMzFiZGQxYzcyZTM3NTc1YjU5IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDgwLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiJkMmNhZmJmZmJjYjdmNWEwZTk4MTc3MTlhMTQ1MjAxOTFmODA0NDc0IiwidHJlZSI6ImVjMzY4MGM2MTU5NTQ2MzA4MDA1MGYzM2QwNGI5ZjVlNGQxNzlhNGQiLCJib2R5RGlnZXN0IjoiMTc0MzRiNjRlYjhjZmIwMGNjYWYyOGVlZWY0NWYyYzE4Njg2Y2YwMTk0YmMyZDhiMDVhZTMxY2U1ZGUwOWU5MSIsInByb2R1Y2VyUnVuIjoiNDAzMzA5MzY1MjMiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjYzYmQzMTIzOTVkNDRkMWNkZWY2MmZkNzFmNTgwYWU0YjYwMmIxYWE2MDFiMDYzNzdiYzZkOWZjYTc4NmQ3MWYiLCJ2ZXJkaWN0RGlnZXN0IjoiZGZlYmUwMTc2YWZlNGM5MWI0N2E3ZWE2MjgyYmI5OWZkMGE1MmVmOTkyNDU4ZWY3YTg2YTRhYWUzNGE2MTk5NyIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiIzMzM4ZDhkOTI5MzhmMGY5N2U2MjJlZDQ0ZGI2MDJkYjNkYzM0YjllZWZkZGEwMWQ1ZDA1ZmIxMDRkYzM0YmZjIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDE3NTQ0Mjk3LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDgwI2lzc3VlY29tbWVudC02NDE3NTQ0Mjk3IiwiYm9keURpZ2VzdCI6Ijc1MmNjNGNmMDE4ZTZlYjQ2ZjE5OTRiZjk1NzE4ZmYyZjAzZDNkYWM1N2I3YWY0NGVhNDMzZjdmOTQ5Mjg0MzQifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1080-decor-preview-ownership`, коммит `d2cafbffbcb7` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `ec3680c61595463080050f33d04b9f5e4d179a4d`
  ```
  git log --all --format='%H %T' | grep ec3680c61595
  ```
- Тело issue: `17434b64eb8cfb00ccaf28eeef45f2c18686cf0194bc2d8b05ae31ce5de09e91`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6OTQsIm91dHB1dF90b2tlbnMiOjUzNDUwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE3NzI2MywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjU5MjQyNTYsImNvc3RVc2RFc3RpbWF0ZSI6Mi40Mjg1OTEyfV0sInR1cm5zIjo2MywiZHVyYXRpb25NcyI6NzkyNTY3LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi40Mjg1OTEyLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=94 output_tokens=53450 cache_creation_input_tokens=177263 cache_read_input_tokens=5924256 num_turns=63 -->
