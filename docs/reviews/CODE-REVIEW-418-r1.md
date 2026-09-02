# CODE-REVIEW-418-r1

Issue: [#418](https://github.com/Matysh/houseplan-card/issues/418) — «Диалог помощи: поздний ответ возвращает отменённое превью, а правка текста уходит под старым ключом идемпотентности»
Этап: code (PROCESS.md §2.7) · Заход: r1 · блокирующих циклов израсходовано 0 из 2
Проверяемый SHA: `080eb5ceffae91a526b8374360a0d17d5cfe404c` (ветка `issue/418-support-dialog-races`)
Диапазон: `origin/dev...HEAD` = 2 коммита (`2b978d63` — код и тесты, `080eb5ce` — обновление docs-fingerprint)

## Скоуп

Лёгкий трек, ТЗ в теле issue (принято зелёным на этапе spec, комментарий `IC_kwDOTOcLQM8AAAABSHhBzA`). Задача — не новая функциональность, а восстановление двух уже опубликованных гарантий контракта #43 (`docs/SUPPORT-PRIVACY.md`, §6.4/§6.5 спеки #43):

1. Поздний ответ `houseplan/support/preview`, пришедший после того, как согласие на вложение отозвано (или устарело относительно нового поколения запроса), не должен применяться к состоянию диалога и должен best-effort отзывать валидный token.
2. Idempotency key повтора submit должен ротироваться только когда эффективный (trimmed) payload реально изменился после фактической неуспешной попытки; validation/preview-ошибки без вызова `houseplan/support/submit` ключ не меняют.

Диафрагма изменений: `src/houseplan-editor-runtime.ts`, `src/support-feedback.ts`, `test/support-feedback.test.mjs`, `demo/smoke_support_feedback.mjs`, `scripts/mutation-gate.mjs`, оба changelog, `docs/images/screenshots.json` (только fingerprint), синхронные `dist/**` и `custom_components/houseplan/frontend/**`. Ровно то, что заявлено в разделе «Затронутые файлы» ТЗ — расширения скоупа нет.

## Как проверялось

Зелёного `Validate` на SHA `080eb5ce` в момент ревью не найдено, поэтому дешёвые гейты прогнаны самостоятельно, на чистом рабочем дереве (`git status` — clean после каждого прогона):

- `npx tsc --noEmit` — зелёный, без вывода.
- `npm test` — `# tests 1737 · pass 1736 · fail 0 · skipped 1` — совпадает с числом, заявленным автором.
- `npm run build` → `npm run bundle:sync` — сборка и обе копии бандла (`custom_components/houseplan/frontend`, `demo/srv/assets`) синхронизированы; `git status --short` после прогона пуст — коммит уже содержит байт-в-байт актуальный бандл.
- `npm run bundle:budget` — initial View 290568 B gzip, headroom 9432 B — совпадает с отчётом автора; предупреждение о запасе — известное, доотмечено #367, не регрессия этой задачи.
- `node scripts/check-docs.mjs` — зелёный (7 файлов, 10 внешних ссылок).
- `node scripts/no-new-any.mjs --base origin/dev --head HEAD` — 53 добавленные строки в 2 файлах, новых `any` нет.
- `node scripts/process-gate.mjs --range origin/dev..HEAD --issues` — зелёный, 0 предупреждений.
- `node demo/smoke_support_feedback.mjs` — **25/25 true**, включая все 5 новых проверок (`latePreviewConsentStaysRevoked`, `latestPreviewGenerationWins`, `stalePreviewErrorIsIgnored`, `validationDoesNotRotateKey`, `idempotencyKeyFollowsEffectivePayload`) и оба responsive viewport.
- `node scripts/mutation-gate.mjs --id=support-stale-preview-response-revives-consent` — «тест покраснел, как обязан», поймано 1 из 1.
- `node scripts/mutation-gate.mjs --id=support-edited-retry-reuses-old-idempotency-key` — «тест покраснел, как обязан», поймано 1 из 1.
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` — одно прямое совпадение `demo/smoke_support_feedback.mjs` (символ `_supportDialog`), слабых/зарегистрированных связей не найдено; он же и есть единственный запущенный смок. Полная матрица (213 смоков) остаётся предрелизным гейтом — задача не задевает другую подсистему.

### Не запускалось (и почему)

- `golden:verify` — diff не меняет штатный визуал; проверено напрямую: `git diff` по `docs/images/screenshots.json` меняет только `sourceFingerprint`/`sourceSha256` (10 вхождений), все 10 `imageSha256` — контекстные строки, байт-в-байт неизменны. Канонический capture подтверждён ссылкой на прогон `33640761942` в передаче на ревью.
- `python -m pytest tests_backend -q` — `custom_components/**/*.py` не тронут.
- `npm run invariants` / инварианты модели — diff не касается геометрии, `layout`, `marker.space`, `open_spans`; проверено `git diff --stat` (только `src/houseplan-editor-runtime.ts`, `src/support-feedback.ts` и тестовая/демо-инфраструктура).
- performance-профили — не названы в AC, render-loop не тронут (изменения — O(1) внутри обработчиков events/WS-ответов).
- Остальные 212 смоков — smoke-select не нашёл ни прямых, ни слабых связей за пределами `smoke_support_feedback.mjs`; тема задачи (гонки диалога поддержки) локальна одному файлу состояния и одному компоненту рендера.

## AC1 — отменённый/устаревший preview не возвращается

Прочитан код `_supportPreviewRequestIsCurrent` (`src/houseplan-editor-runtime.ts:9196`), `_buildSupportPreview` (`:9203`), `_setSupportAttachment` (`:9272`) и разметка `.supportpreview` (`:9460`, теперь `state.attach && state.preview`).

Прослежены вручную три сценария до состояния счётчика `_supportPreviewGeneration` на каждом шаге:

- **building → attach:false → поздний success**: generation инвалидируется инкрементом в `_setSupportAttachment(false)` *до* того, как ответ вернётся; по возврату `_supportPreviewRequestIsCurrent` возвращает `false` → ветка `void this._discardSupportPreview(token)`, состояние не патчится. Разметка `.supportpreview` дополнительно требует `state.attach`, то есть даже гипотетический патч мимо guard не раскрыл бы данные в DOM без согласия.
- **off → on (два поколения в полёте)**: пронумеровал поколения по коду — `_setSupportAttachment(false)` инкрементирует счётчик, следующий `_setSupportAttachment(true)` инкрементирует ещё раз внутри `_buildSupportPreview`; при ответе позднего (первого) поколения после раннего (второго) currency-проверка сравнивает захваченный `generation` с текущим значением счётчика, которое уже сдвинуто новым поколением — проигрывает корректно независимо от порядка возврата промисов.
- **устаревшая ошибка**: catch-ветка (`:9263`) делает ту же проверку currency до патча `status:'error'` — устаревший reject не трогает актуальный UI.

Всё три сценария дополнительно **воспроизведены исполнением** через `demo/smoke_support_feedback.mjs` с управляемыми (deferred) Promise на `houseplan/support/preview` — не поверил чтению кода на слово, прогнал: `latePreviewConsentStaysRevoked` (5/5 условий true, включая единственный `discard` вызов для отменённого token `b`), `latestPreviewGenerationWins` (обратный порядок разрешения промисов, побеждает поколение `c`, `discard` для `d` ровно один раз), `stalePreviewErrorIsIgnored`.

Mutation-gate `support-stale-preview-response-revives-consent` заменяет весь guard на `return true` — прогнан лично, smoke краснеет, «поймано 1 из 1»: тест умеет падать, а не просто существует.

**AC1 выполнен, доказательство — реальное исполнение smoke + личный запуск mutation-теста.**

## AC2 — ключ идемпотентности соответствует эффективному payload

Прочитан `supportSubmissionFingerprint`/`supportSubmissionIdentity` (`src/support-feedback.ts:56-75`) и точка вызова в `_submitSupport` (`src/houseplan-editor-runtime.ts:9337-9343`): fingerprint фактически отправляемого (`trim()`) payload фиксируется в состоянии **в момент реальной попытки** (патч `status:'sending'` вместе с `submissionFingerprint`), а не на каждой правке текста — `_updateSupportDraft` (`:9103`) это поле не трогает. Ротация ключа условна: `state.submissionFingerprint && state.submissionFingerprint !== fingerprint` — при первом обращении (`submissionFingerprint === ''` из `newSupportDialogState`) условие ложно, ключ свежего draft сохраняется; после первой попытки любое расхождение с зафиксированным fingerprint даёт новый ключ.

Прослежены вручную по коду четыре случая ротации и убедился, что trim применяется симметрично (`fingerprint` использует `.trim()`, submit использует `.trim()`) — trim-only правка не меняет отправляемое значение и не ротирует ключ; смена `preview.token` входит в fingerprint наравне с текстом, что документировано в ТЗ как принятое допущение.

Проверено исполнением, не чтением: unit `submission identity follows the effective trimmed payload` (`test/support-feedback.test.mjs:41-80`) — прогнан в составе `npm test`, зелёный, покрывает первую попытку/неизменённый retry/смену message/смену contact/смену preview-token отдельно. Browser smoke (`idempotencyKeyFollowsEffectivePayload`) прогоняет реальные `houseplan/support/submit` вызовы через 6 последовательных неуспешных попыток (rate-limit) с восемью независимыми сравнениями ключей и содержимого payload — прошёл 1/1.

Отдельно проверено чтением (не исполнением): `validationDoesNotRotateKey` — validation-ветка `_submitSupport` (`:9327-9335`) возвращается до вычисления `supportSubmissionIdentity`, то есть до появления вызова submit; ключ и `submissionFingerprint` физически не могут измениться. Тот же смок это же и замеряет исполнением, так что это не голое чтение, а совпадение с фактическим прогоном.

Mutation-gate `support-edited-retry-reuses-old-idempotency-key` заменяет условную ротацию на безусловное `state.idempotencyKey` — прогнан лично, smoke краснеет, «поймано 1 из 1».

**AC2 выполнен, обе стороны (сохранение и ротация ключа) доказаны исполнением unit- и browser-теста плюс личным запуском mutation-теста.**

## AC3 — контракт #43 не регрессировал

Полный `demo/smoke_support_feedback.mjs` прогнан целиком, а не выборочно: **25/25 true**, включая унаследованные проверки `freshDefaults`, `preview`/`downloadExact`, `success`/`freshAfterSuccess`, `retryAndManualRecovery` (busy controls, неизменённый retry с тем же ключом — `retryKey`), оба responsive viewport (320×760, 760×320). Гейты tsc/test/build/bundle-sync/no-new-any/check-docs — зелёные, см. раздел «Как проверялось» выше, с фактическими числами, не «verified» без команды.

**AC3 выполнен.**

## Единое число — единый источник

Diff не добавляет и не меняет величину, отображаемую пользователю дважды: preview `sha256`/`size`/`spaces` в `.supportpreview` берутся из `state.preview` без параллельного источника, идентично до фикса. `docs/images/screenshots.json` подтверждает нулевой видимый diff (все `imageSha256` неизменны). Замечаний по этому пункту нет.

## Терминология и трейлеры

- `support.title` = «Помощь и обратная связь» / «Help & feedback» — не менялся; формулировки changelog используют то же название, взятое из `docs/USER-GUIDE.ru.md:1920` и `docs/USER-GUIDE.md:1099`, а не изобретены.
- Коммит `2b978d63`: `Issue: #418`, `User-Visible: yes`, оба `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` — в этом же коммите вместе с продуктовым кодом (подтверждено `git show --stat`).
- Коммит `080eb5ce`: `Issue: #418`, `User-Visible: no`, только `docs/images/screenshots.json`, со ссылкой на канонический прогон — корректно.
- Новых i18n-ключей и видимых контролов нет (`git diff --stat -- src/` — только два `.ts`-файла с рантайм-логикой).

## Находки

Нет ни одной. High: 0, Medium: 0, Low: 0.

Разобрана вся генерация-guard логика вручную по числам поколений для трёх порядков ответа (building→off, off→on обратный порядок, off во время building с последующим reject) — во всех случаях код ведёт себя так, как того требует контракт ТЗ, и это же независимо подтверждено прогоном smoke с управляемыми Promise и двумя mutation-тестами, которые я лично исполнил (не поверил на слово числу «1 из 1» в отчёте автора).

## Что не проверялось и почему это нормально

- Полная матрица 213 браузерных смоков — не задета по инструменту выборки (единственная прямая связь), а тема задачи (состояние одного диалога) не пересекает другие подсистемы. Остаётся предрелизным гейтом.
- `golden:verify` — не требовался: визуал не меняется, что подтверждено байт-в-байт неизменными `imageSha256`.
- Backend/pytest — файлы бэкенда не тронуты.
- Инварианты модели — геометрия не тронута.
- Performance-профиль — не в AC, изменения O(1), вне render-loop.

## Вердикт

Зелёный. Обе гонки закрыты именно так, как того требует контракт ТЗ и docs/SUPPORT-PRIVACY.md/#43, доказательства — реальные прогоны (не «verified» без команды), включая два mutation-теста, лично исполненных для проверки «тест умеет падать». Гейты (tsc/test/build/bundle-sync/budget/check-docs/no-new-any/process-gate/smoke) зелёные на SHA `080eb5ce`, оба changelog и трейлеры на месте, скриншот-fingerprint обновлён отдельным `User-Visible: no` коммитом с байт-в-байт неизменными изображениями.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/418-support-dialog-races`, коммит `080eb5ceffae` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `2ad3677387f626d36125344737f3f6ca4e4fd3e5`
  ```
  git log --all --format='%H %T' | grep 2ad3677387f6
  ```
