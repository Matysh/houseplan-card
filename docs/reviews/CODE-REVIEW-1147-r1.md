# CODE-REVIEW: issue #1147 (заход r1)

**Материал:** `1052c2d8bb178e60cd5c005604804831a41eb085` (ветка `issue/1147-ui-kit-view`, база `dfac7a91c34277f62d9a240553f5ba785ed733b2`).
**Трек:** ask. **Этап:** code. **Маршрут вердикта:** `fix`.

## Скоуп

Пакет мигрирует поверхности группы «Просмотр и киоск» (реестр #1146/#1131) на общий UI Kit:
токены движения (`ui-motion.ts`, `ui-motion.styles.ts`), общая карточка-уведомление
(`ControlSurfacePresentation`, тост/version-recovery/view-runtime notice), телефонная
шестерёнка через `EditorContextMenu`, общая кнопка-иконка шапки, callout/disclosure причин
тревоги/обслуживания, kiosk-size/tap-confirm/onboarding на `<hp-dialog class="ui-dialog">`,
общий плавающий бейдж, и попутный фикс «read-only карточка держит Kit-отступ 20px независимо
от загрузки редактора» (второй коммит). Core user job: домочадец смотрит/подтверждает
действия в View/киоске; администратор создаёт пространство (docs/SCOPE.md).

## Как проверялось

Static-first: прочитан REVIEW_CONTEXT (тело issue #1147, хендофф, ciEvidence), затем
`read:diff` (единый дифф от общего предка) и выборочно — полные файлы в рабочей копии
(она уже на материале). Прослежены вызывающие пути и побочные эффекты для каждого
риск-класса из пакета #707, затем сопоставлены с хендоффом.

**Переиспользованное доказательство:** validate-gate на этом SHA —
https://github.com/Matysh/houseplan-card/actions/runs/41173903744 (product+tooling+docs,
GREEN). Это подтверждает typecheck/build/CSS-consumers/UI Kit caps/bundle policy и полный
набор из 24 заявленных smoke + golden 35/35 — не повторялось.

**Адресные прогоны, сделанные в этом заходе** (конкретные пробелы: новый defensive-AC
сценарий и три репрезентативных риск-класса из изменённых участков, не покрытых
построчным чтением):

| Проверка | check_id | Результат |
|---|---|---|
| Сборка (нужна для smoke/test-build) | `build:build`, `build:bundle:sync`, `build:test` | GREEN |
| Новый нативный guard PNG10000 на первом пространстве (AC5, прежде отсутствовавший путь) | `smoke:demo/smoke_first_space_large_plan.mjs` | GREEN — `nativeGuardAndRetainedDraft1280/390: true`, guard виден, редактор не грузится, нет записи при отмене, черновик сохраняется |
| Шестерёнка телефона → EditorContextMenu: Escape/внешний тап/фокус (AC3) | `smoke:demo/smoke_mobile_view_header.mjs` | GREEN — `escapeImmediatelyRetires`, `escapeClosesAndFocuses`, `outsideTapClosesMenu`, `crossClosesOnPhone`, `admin*_targets44InCard` и др. все true |
| Причины тревоги/обслуживания — callout/disclosure (AC4) | `smoke:demo/smoke_device_issue_reasons.mjs` | GREEN — переходы maintenance↔alarm+maintenance↔none корректны |
| Общее движение/reduced-motion в обоих режимах (AC2) | `smoke:demo/smoke_ui_kit_motion.mjs` | GREEN — `{"profiles":4,"native":false,"motion":"PASS"}` |
| `@keyframes ≤ 14` (AC2) | прямое чтение `src/styles/*.ts` | 8+4+1 = 13, подтверждён хендофф (19→13) |
| Поведенческий юнит-тест вместо текстового парсинга source (header-menu) | `unit:test/mutation-browser-offload.test.mjs` | GREEN |
| Консолидация reduced-motion строк в styles-split | `unit:test/styles-split.test.mjs` | GREEN |
| Статическая готовность registry мутаций (перенесено 16 определений) | `static:mutation-registry` | GREEN (static only; execution=0/caught=unknown — так и заявлено в хендоффе, это НЕ красный/зелёный свидетель поведения) |

Не повторялись: общий tsc/build/`npm test`/`gate:small` целиком, остальные 20 заявленных
smoke и 35 golden — покрыты зелёным validate-gate на этом же SHA, входы/окружение/oracle
не менялись.

## Разбор риск-классов (#707)

### touch: `hp-plan-converter-info.ts:31` (удалена) · `settings-action.styles.ts:25`
Инлайновое правило `a{...touch-action:manipulation...}` в `hp-plan-converter-info.ts`
удалено и заменено вызовом `settingsInlineLinkCss('a')`
(`src/styles/settings-action.styles.ts:1915-1917` после правки), которая содержит то же
самое `touch-action:manipulation` плюс общий `settingsTextLinkCss`. Токен не потерян, а
перенесён во владельца примитива — ровно по контракту пакета («К означает использование
общего примитива без локальной краски»). TOUCH-SUPPORT.md не требует дополнительной
проверки: целевая зона не изменилась.

### perf: `chrome-tooltip.ts:49` (requestAnimationFrame), `editor-context-menu.ts:142`
(getComputedStyle), `header-menu.ts:150` (getBoundingClientRect), `hp-dialog.ts:651`
(getComputedStyle), `hp-settings-select.ts:152` (requestAnimationFrame) и ещё 4
(`control-surface-presentation.ts:55`, `toast-presentation.ts:8344`,
`summary-panel-runtime-loaded.ts`, `view-device-menu.ts` — последний не тронут, геометрия
бралась и до пакета).
Проверено построчно: все вызовы `getComputedStyle`/`getBoundingClientRect` происходят либо
в `updated()` жизненного цикла Lit (после рендера, до paint — см. комментарий в
`control-surface-presentation.ts:37`), либо в обработчиках открытия/закрытия, вызванных
пользовательским действием (клик, Escape, outside-tap), а не в теле `render()`. Это
соответствует контракту «Перф: ... без синхронного чтения layout в render». Паттерн чтения
текущего `opacity/translate` перед запуском exit-анимации — не новый (аналог существовал в
`editor-context-menu.ts` и `hp-dialog.ts` до пакета), просто вынесен в общий
`controlSurfaceFrames()`. Новых постоянных `setInterval`/`MutationObserver` не добавлено;
`requestAnimationFrame` используется для одного кадра анимации «появления» — так же, как
раньше. Регрессии не найдено.

## Доказательства по AC (защитные — с третьим столбцом)

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (реестр К/Н) | Чтение `docs/design/ui-kit-audit-1147.json`, `ui-kit-inventory.json`; census в хендоффе (К94/Н6 из 100 ячеек) | н/п (учётный, не защитный) |
| AC2 (движение/reduced-motion, `@keyframes≤14`) | `smoke:demo/smoke_ui_kit_motion.mjs` (адресный прогон, GREEN) + прямой подсчёт `@keyframes` в репозитории (13) | Обычный тест: `smoke_ui_kit_motion.mjs` падает, если `motion!=="PASS"` или профиль не захвачен — реальный негативный путь, не просто регистрация |
| AC3 (шапка/меню, 44px, keyboard/focus) | `smoke:demo/smoke_mobile_view_header.mjs` (адресный прогон, GREEN, 60+ ассертов) | Обычный тест: падает при потере Escape/outside-tap/фокуса/44px — продемонстрировано как живой assert, не witness |
| AC4 (причины тревоги/notice, без дублей) | `smoke:demo/smoke_device_issue_reasons.mjs` (адресный прогон, GREEN) + переиспользованный validate-gate для device-issues/version/runtime recovery smoke | Обычный тест: падает, если переход состояний (maintenance↔alarm) теряет текст/aria |
| AC5 (kiosk-size/tap-confirm/onboarding, PNG10000 guard на первом пространстве) | `smoke:demo/smoke_first_space_large_plan.mjs` (адресный прогон, GREEN — новый файл, независимо собран и выполнен в этом заходе) | Обычный тест: явные assert на `toBeVisible`, отсутствие запроса `houseplan-editor-runtime-*.js`, отсутствие `POST/PUT/DELETE`, сохранение черновика — padает при регрессии guard'а или утечке загрузки редактора |
| AC6 (темы/ширины, golden) | Переиспользован validate-gate: targeted golden 35/35 по заявленным intents, release-ledger `docs/release-ledger/v1.83.0/1147.json` содержит пофайловый `expectation:"change"` с обоснованием на каждую карточку | Golden-свидетель зарегистрирован в CI прогоне 41173903744, не исполнялся повторно в этом заходе |
| AC7 (CSS меньше, храповики в полосах) | Прямая проверка `@keyframes` (13≤14); census в хендоффе (cssLines 7820→7216, declarations 8080→7797); `static:mutation-registry` GREEN | н/п (метрический, не защитный) |

## Release-ledger и changelog

`docs/release-ledger/v1.83.0/1147.json`: `category:"stable-fix"`, обоснование — поверхности
уже существуют в stable 1.83.0, пакет чинит пропавший guard и переносит оформление на Kit
без смены моделей/прав/записей. `introducedBy` не требуется (не новая бета-фича). Классификация
соответствует #838.

`docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` правлены в одном и том же диффе (видно в
`read:diff`), формулировки на RU/EN синхронны по смыслу (единый UI Kit + PNG-guard на первом
пространстве + независимость отступа read-only карточки), ссылка на #1147 в обоих. Трейлеры
Issue/User-Visible самих коммитов (`git log` полный текст) не были доступны ни через один
объявленный check (только `read:log` в формате oneline) — это честная граница тулинга
ревью, не находка: двойное изменение числа/видимого поведения проверено по diff
changelog'ов напрямую, а не по трейлеру.

## Что проверено и корректно

- Перенос телефонной шестерёнки на `EditorContextMenu` сохраняет набор/порядок действий,
  Escape/outside-tap закрывают, фокус возвращается к `gear` (инициатору) — подтверждено
  чтением `src/editor-context-menu.ts` (методы `close/outside/key/focus`) и независимым
  прогоном smoke.
- Общая карточка-уведомление (`ControlSurfacePresentation`) используется тостом,
  version-recovery и (по заявлению хендоффа, не перепроверено построчно для
  view-runtime notice) отказом View-модуля; текст/повтор/защита повторной загрузки
  не тронуты в разобранных файлах (`toast-presentation.ts`, `version-recovery-card.ts`).
- Фикс независимости отступа read-only карточки: `info-card-styles.ts` больше не
  дублирует `.body.hpf-form{padding:20px}` локально — `ensureInfoCardStyles()`
  безусловно вызывает `ensureFormKitStyles(host)` до адопции собственного листа, то есть
  padding гарантирован общим form-kit листом независимо от состояния editor runtime.
  Подтверждено чтением `src/info-card-styles.ts` целиком.
- Главный новый дефектный фикс AC5 (отсутствовавший guard на первом пространстве)
  реализован через fallback `this._onboardingRuntime?._renderBackdropGuard()` в
  `houseplan-card.ts:_renderRoot`/пустой-план ветке, когда `_editorRuntime` ещё не
  загружен — независимо исполнен и зелёный.
- `touch-action:manipulation` при реструктуризации `hp-plan-converter-info.ts` не потерян,
  перенесён во владельца примитива.
- Перф-паттерны чтения layout — все вне `render()`, без регрессии по сравнению с
  существовавшим кодом.

## Чего не проверял

- Полный повторный прогон `gate:small`/golden 35/35/оставшихся 20 заявленных smoke —
  переиспользован зелёный validate-gate на этом SHA без материальных изменений входов.
- Полный текст коммитных сообщений (трейлеры Issue:/User-Visible:) — недоступен ни через
  один объявленный check; оценка опирается на фактический diff changelog'ов.
- Поведение `view-runtimes.ts` notice (отказ View-модуля) на общей карточке — не читался
  построчно; принято по хендоффу и переиспользованному CI (`smoke_view_runtime_recovery.mjs`
  входит в заявленный зелёный набор).
- Визуальное сравнение 35 golden попиксельно — не переисполнялось; доверие к
  зафиксированным хешам/scene intents в release-ledger.

## Находки

Находок уровня High/Medium в скоупе не обнаружено. Побочных находок вне скоупа нет.

## Вердикт

**green**. High: 0, Medium: 0.

Маршрут публикации — `mode: issues` (политика `HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`);
новых outside findings нет.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImQ1MTliMTIxOTRjMWJiODAxNmQ1NzcxZmI1YzdhNmFhODYzNTBiYzczZjQyNDliOTRiNzQ3ZjQ0NTA1NWQ2ZjMiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJkODc1NGFjY2UwMjFhZTBkMmRjMGU5MWZjNDA0OWQ0MzVkODcwZWEwYzU5ZDU0ZGY1ODQyM2RiMTU4YjY4MmFjIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTQ3LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIxMDUyYzJkOGJiMTc4ZTYwY2Q1YzAwNTYwNDgwNDgzMWE0MWViMDg1IiwidHJlZSI6IjhkMGQ3YTM1OTkzODRmN2JhOGQ5NGU0NzMwNzU2ZjczMDg1ZGQyN2IiLCJib2R5RGlnZXN0IjoiNGQxNzFkNGQ3YmUxMDZjZDRmMjBmYjlhNWIzMjcwZTcwY2ZiMTJiYTBkNjU1OGY2N2I5MGQxZTkwNTk1ODgyOCIsInByb2R1Y2VyUnVuIjoiNDExNzU1NjA3MDQiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjQ1NDg0ZjcyMWFiYjJjMjRhYzBhZTMyMjgwNGYyYzY3YzNiMmU1MmIyNGJhZDc5YmQzYWUxNmUyMzgwZjBiODUiLCJ2ZXJkaWN0RGlnZXN0IjoiMzBhMjNiY2E4MDZiZmY0N2Q3MjVjMmQ3Y2E5MzkzZjgyYzQ4MTIxMzRiZGZhZDgyYTg4ZTA2MzVmYzcyNzI5ZiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI1NDgyYjE3MmM3MjRjZDI3YjZjZjNhY2EzOGU1ZTZhNTg2N2Y4YWUzN2E0MDY5ZDFiMDgxNmFkOTFiNjJiMTA2IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTQwMjQ0MTAwLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTQ3I2lzc3VlY29tbWVudC02NTQwMjQ0MTAwIiwiYm9keURpZ2VzdCI6ImE1M2YxNmZkNjU5MDYzY2UyZDE1YmNmMDYzNWM5NzJjOTE5YTY5YTliODQ5NjA4YzQ4ZGE2MDFhMTkxYWUxYzcifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1147-ui-kit-view`, коммит `1052c2d8bb17` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `8d0d7a3599384f7ba8d94e4730756f73085dd27b`
  ```
  git log --all --format='%H %T' | grep 8d0d7a359938
  ```
- Тело issue: `4d171d4d7be106cd4f20fb9a5b3270e70cfb12ba0d6558f67b90d1e905958828`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":41175560704,"run_attempt":1,"digest":"f31db46b6161d0e2e3da9c02742614ecf1e11fd46729379b626792e118100429"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTA0LCJvdXRwdXRfdG9rZW5zIjoyMzg4OCwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxNTMwNTUsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo1Mzc3ODM1LCJjb3N0VXNkRXN0aW1hdGUiOjEuOTI2ODc1fV0sInR1cm5zIjo2MiwiZHVyYXRpb25NcyI6NTEwOTIxLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS45MjY4NzUsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=104 output_tokens=23888 cache_creation_input_tokens=153055 cache_read_input_tokens=5377835 num_turns=62 -->
