# CODE-REVIEW-909-r1

Issue: [#909](https://github.com/Matysh/houseplan-card/issues/909) — «Убрать мёртвую
summary attachment-границу и исправить битую ссылку ревью». Трек `track:ask`,
заход r1, блокирующих циклов 0/4.

Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD` на
SHA `007f9765a31b832d14ad303ced34a41e802b1ee5` (рабочая копия на нём же).
Коммиты в материале:

- `63f0211777a8e59e5b16fdc4d6ee0a9ddb48f4f0` — `refactor: remove unused summary
  attachment and slot API`
- `007f9765a31b832d14ad303ced34a41e802b1ee5` — `docs: record ordinary summary
  cleanup evidence`

Оба несут `Issue: #909` / `User-Visible: no`; changelog не тронут — согласовано
(класс A/B-правка без видимого поведения).

## Скоуп

Принятое SPEC-REVIEW-909-r1 (зелёное): удалить подтверждённо мёртвые
`SummaryRuntimeSlot`, `SummaryRuntimeLike`, `SummaryRuntimeAttachment` и метод
`SummaryRuntimeLoader.attach()` из `src/summary-runtime-loader.ts`, перенести
полезные тестовые гарантии на живые `create()`/`ensure()`/`ViewRuntimeBoundary`,
исправить одну битую относительную ссылку в `SPEC-REVIEW-883-r1.md`
(SPEC883→SPEC843). Не-скоуп: сам `ViewRuntimeBoundary`, `view-runtimes.ts`,
фабрика/pending-кэш, fingerprint, retry, поведение панели, архивация
документов. Диффstat подтверждает границу: только
`src/summary-runtime-loader.ts`, `test/summary-runtime-loader.test.mjs`,
`scripts/mutation-registry.mjs`, плюс документация/ledger/evidence —
`ViewRuntimeBoundary` и `view-runtimes.ts` без диффа (проверено:
`git diff origin/dev...HEAD --stat -- src/view-runtime-boundary.ts
src/view-runtimes.ts` — пусто).

## Как проверялось

| Гейт | Статус | Команда / результат |
| --- | --- | --- |
| `typecheck`/`npm test`/`npm run build`+`bundle-policy --verify` | не перегонялся отдельно — подтверждён зелёным Validate на этом же SHA ([run 38778918388](https://github.com/Matysh/houseplan-card/actions/runs/38778918388)) | — |
| Статический реестр мутантов | прогнан | `node scripts/mutation-registry.mjs --check` → exit 0 |
| Целевые unit (loader+boundary) | прогнан | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/summary-runtime-loader.test.mjs test/view-runtime-boundary.test.mjs` → 11/11 PASS |
| Полный поиск консьюмеров удаляемого API | прогнан | `grep -rn "SummaryRuntimeSlot\|SummaryRuntimeLike\|SummaryRuntimeAttachment\|\.attach(" src/ test/ demo/ scripts/` → пусто |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прогнан | 9 прямых совпадений (connectedCallback/disconnectedCallback) |
| Все 9 смоков прямого совпадения | прогнаны лично | `danger_confirm_branches`, `dialog_help_clipping`, `dialog_modal_recovery`, `floor_cache_reuse`, `ha_form_shell_parity`, `preloader_lifecycle`, `space_card_bg`, `summary_dialog_scroll`, `warm_owners` — все exit 0 / OK |
| AC2-именованные смоки | прогнаны лично | `node demo/smoke_summary_warm_attach.mjs` → 17/17 `true`, OK; `node demo/smoke_view_runtime_recovery.mjs` → 53/53 `true`, OK |
| Линк-чекер (AC3) | прогнан | `node scripts/reviews-archive.mjs --check-links` → «битых относительных ссылок: 0» |
| Архивный dry-run (AC3) | прогнан | `node scripts/reviews-archive.mjs --through=v1.80.1` → move 0 (без `--apply`) |
| Инварианты модели / pytest / performance | не прогонялись | дифф не трогает геометрию, Python или performance-путь; в AC не названы |

Для исполнения смоков понадобился собственный свежий `npm run build` +
`node scripts/bundle-sync.mjs` (бандл и `demo/srv/assets` — generated outputs,
разрешены); после проверки бандл возвращён `npm run bundle:clean`, рабочее
дерево чистое (`git status --short` пусто). Продукт/тесты не менялись ради
отрицательного свидетеля — только обычные прогоны на неизменной реализации.

## Находки

Не найдено. Ни одной High, ни одной Medium.

## Что проверено и корректно

- **AC1 (нет product consumer, API мёртво).** Полный `grep` по
  `src/ test/ demo/ scripts/` на `SummaryRuntimeSlot|SummaryRuntimeLike|
  SummaryRuntimeAttachment|\.attach(` не даёт совпадений — класс/типы/метод
  удалены без остатка. Прочитан `src/view-runtimes.ts:11,12,67-72`: продукт уже
  использует `ViewRuntimeBoundary(host, summaryRuntimeLoader, port(...))` —
  текущий `SummaryRuntimeLoader` (`src/summary-runtime-loader.ts:28`) теперь
  лишь именованный подкласс `ViewRuntimeCode` без своего кода, используемый
  ровно там же, где и раньше. Проверено чтением, не исполнением.
- **Перенос мутанта в реестре.** `scripts/mutation-registry.mjs` переносит id
  `summary-runtime-attaches-after-first-render` с удалённого патча на
  `src/view-runtime-boundary.ts`, строка `const warm =
  this.code.create(this.host);` (подтверждено текущим содержимым файла —
  строка существует дословно) и перевешивает `unitGuard` с
  `test/summary-runtime-loader.test.mjs` на `test/view-runtime-boundary.test.mjs`
  (единственное вхождение, без дублирования группы). Тест «#848 AC3/AC4: …
  warm adoption is synchronous» (`test/view-runtime-boundary.test.mjs:65-74`)
  проверяет `warm.installed.length === 1` сразу после `connect()`, без
  ожидания промиса — если `this.code.create(...)` всегда вернёт `null`
  (патч мутанта), эта синхронная проверка обязана покраснеть. Разобрано
  чтением кода, мутант вручную не исполнялся (политика #905): это
  зарегистрированный свидетель с «не исполнялся», его прогон — обязанность
  ночного `mutation-gate.yml`.
- **AC2 (нет ослабления существующих гарантий).** Построчно сверен дифф
  `test/summary-runtime-loader.test.mjs`: все четыре переписанных теста не
  теряют утверждений — «warm synchronous» теперь проверяется через
  `loader.create(host)` напрямую (та же точка, что раньше вызывал `attach()`
  изнутри), «concurrent cold mounts» добавляет более сильную проверку
  (`factoryA === factoryB`), «cancelled attachment» перенесён на реальный
  `ViewRuntimeBoundary` с его публичным `connect/disconnect/ensure` (не новая
  обёртка — тот же API, что использует продукт), «failed import forgotten»
  добавляет явный `assert.rejects(first, /network/)`, которого не было в
  старой версии. Лично выполненные `smoke_summary_warm_attach.mjs` (17/17
  `true`) и `smoke_view_runtime_recovery.mjs` (53/53 `true`) — поведение
  холодного/тёплого монтирования, переподключения, конкурентного импорта и
  восстановления после сбоя не изменилось.
- **AC3 (ссылка и архив).** `docs/reviews/SPEC-REVIEW-883-r1.md:20` правлена
  единственной строкой: `../../houseplan-card/docs/reviews/SPEC-REVIEW-843-r1.md`
  → `SPEC-REVIEW-843-r1.md`; verdict/anchors файла не изменены (сверено диффом
  — единственная строка). Линк-чекер и архивный dry-run подтверждают
  отсутствие побочных поломок и отсутствие реального `--apply`.
- **Release-ledger (`docs/release-ledger/v1.80.1/909.json`).** `category:
  infra`, обоснование соответствует факту: чистка мёртвого кода и документации
  без видимого пользователю эффекта, `introducedBy` не требуется (новая фича
  не вводится). Milestone корректно отсутствует.
- **Трейлеры.** Оба коммита несут `Issue: #909` и `User-Visible: no`;
  `CHANGELOG.md`/`CHANGELOG.ru.md` не тронуты — согласовано с `no`.
- **Числа, видимые дважды.** Единственное число, повторяющееся в правке —
  «22/22» целевых unit в evidence-doc (loader+boundary+смежный
  mutation-browser-offload файл) и отдельно «11/11» лично прогнанных мной
  loader+boundary — оба источника совпадают по направлению (все PASS), расхождения
  в счёте — из-за разного набора файлов (я не гонял отдельно
  `mutation-browser-offload`, не относящийся к этой задаче), не конфликт.

## Чего не проверял

- Полный `npx tsc --noEmit` / `npm test` (все файлы) / `npm run build` +
  `bundle-policy --verify` в режиме кандидата отдельно от меня — положился на
  зелёный Validate на этом же SHA (ссылка выше); перегонял только то, что
  Validate не покрывает.
- Ночной прогон реестра мутантов (`mutation-gate.yml`) — не запускался ни
  автором, ни мной; статический `--check` и регистрация — не caught, это
  честно отражено выше, а не находка.
- `pytest tests_backend`, инварианты модели, performance-гейты — дифф не
  трогает Python, геометрию или performance-путь, и AC их не называет.
- Остальные 351 смоков матрицы (кроме 11, прогнанных лично) и golden —
  полный набор вне объёма ревью этой задачи (§8); визуального риска в пути
  отрисовки плана дифф не создаёт.
- Архивация документов `--apply` — не выполнялась ни автором, ни мной;
  задача прямо это запрещает (не-скоуп).

## Вердикт

Код делает ровно заявленное в принятом ТЗ: удаляет подтверждённо мёртвый
`SummaryRuntimeSlot/Like/Attachment/attach`, сохраняет все работающие гарантии
loader/boundary на их реальных путях, чинит одну историческую ссылку без
побочных эффектов. Все три AC проверены исполнением (не только автором, но и
мной лично) и ни один тест не ослаблен. High/Medium не найдено.

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 · Документ: docs/reviews/CODE-REVIEW-909-r1.md

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/909-summary-cleanup`, коммит `007f9765a31b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0f6e52acb8a0e5bc7c691622cc07bc863d801474`
  ```
  git log --all --format='%H %T' | grep 0f6e52acb8a0
  ```
- Тело issue: `71c026a4f669d29af1bfe90922e19057a68a01b7c8e78d1ca3c26f342fb37d78`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ1NjgsIm91dHB1dF90b2tlbnMiOjEzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NjMzfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMTAsIm91dHB1dF90b2tlbnMiOjI2NTc0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEwNDUyNiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjQ5MTIzODUsImNvc3RVc2RFc3RpbWF0ZSI6MS42NjY1NDEwMDAwMDAwMDAzfV0sInR1cm5zIjo3NiwiZHVyYXRpb25NcyI6NDkyNTMzLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS42NzExNzQwMDAwMDAwMDA0LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=4678 output_tokens=26587 cache_creation_input_tokens=104526 cache_read_input_tokens=4912385 num_turns=76 -->
