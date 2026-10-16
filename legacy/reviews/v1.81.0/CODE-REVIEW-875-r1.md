# CODE-REVIEW-875-r1

Issue: #875 · Этап: code · Заход: r1 · Трек: ask · Блокирующих циклов израсходовано: 0/4 до этого вердикта
Материал: ветка `issue/875-empty-backup-import`, HEAD `528f30c1725d71a96ca4ddfbf2e7d395daa58ae0`
(база `origin/dev` = `7d72fc4bf1ea67a8c643b8f5a0c842cca19857d3`, включает принятую #879).
Рабочая копия на момент ревью — ровно этот SHA, без локальных изменений.

## Скоуп

ТЗ r1 (зелёное ревью ТЗ, тот же issue) добавляет на штатный пустой writer-экран
(«нет пространств») вторичную кнопку **Import backup** рядом с **Add space**:
вход в уже существующий JSON-импортёр House Plan (full/space/plan-only) без
создания временного пространства. Новый код: `src/backup-import-intent.ts`
(instance-local epoch-ownership + чистая ACL-функция), точечные правки
`src/houseplan-card.ts` и `src/houseplan-editor-runtime.ts` (owned lazy-load,
повторные ACL-проверки, взаимное исключение с onboarding, focus-restore),
i18n-ключ `empty.import_backup` в четырёх core-словарях, стили `.empty-actions`,
новый смок `demo/smoke_empty_backup_import.mjs`, правка fixture
`demo/smoke_post_write_adoption.mjs`, unit `test/backup-import-intent.test.mjs`,
4 новых мутанта в реестре, обновлённые doc-поверхности (ARCHITECTURE, STATUS,
DEVELOPMENT, STYLING-HOOKS, data-hp-contract, USER-GUIDE ×2, CHANGELOG ×2,
release-ledger). Не входит и не тронуто: новый importer/endpoint, Add space на
непустом плане, импорт подложки, backend/ACL-семантика, схема хранения —
проверено по диффу, совпадает с заявленным скоупом ТЗ §4.

Риск по изменённым участкам (#707), заявленный конвейером: новый i18n-ключ
`empty.import_backup` в de/en/fr/ru — покрыт AC6 (locale unit test +
browser-smoke на 4 локалях × light/dark × 360 CSS px); расхождений не найдено.

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate на этом же SHA `528f30c1`
(https://github.com/Matysh/houseplan-card/actions/runs/38418451508) — не
перегонялись повторно. Самостоятельно, на той же рабочей копии, прогнано:

| Гейт | Команда | Результат |
|---|---|---|
| build (повторная проверка, не для вердикта) | `npm run build` | GREEN (tsc --noEmit + rollup, 24.7 с) |
| typecheck теста + unit нового модуля | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/backup-import-intent.test.mjs` | GREEN, 4/4 |
| подготовка артефактов для браузерных смоков | `node scripts/bundle-sync.mjs` | OK |
| целевой новый смок (named in AC1–AC7) | `node demo/smoke_empty_backup_import.mjs` | GREEN, все 14 секций (cold chooser/Enter, cancel+same-file retry, invalid JSON, delayed preview A→Cancel→B, error A→Cancel→B, full/space/plan-only/full-empty+warm, missing-confirmation+conflict, duplicate-policy revalidate, busy/double-apply, disconnect, ACL/kiosk/fixed/loading/unavailable matrix, 4 locale × 2 theme × 360px, revoked-during-lazy-load, lazy failure/retry) |
| соседний смок (settings-triggered import, задет правкой `_pickBackupImport`/`_importBackupFile`) | `node demo/smoke_post_write_adoption.mjs` | GREEN, 27 asserts |
| соседний смок (lazy editor chunk ownership) | `node demo/smoke_lazy_editor_chunk.mjs` | GREEN, 22 asserts |
| соседний смок (backup dialog UI, не владеющая часть) | `node demo/smoke_backup_transfer.mjs` | GREEN |
| `scripts/smoke-select.mjs --base origin/dev --head HEAD` | — | 63 прямых совпадения (широкие символы `_editorRuntime`/`_spaceDialog`/`_openSpaceDialog`/`_model`/`_loadOk`, общие для значительной части матрицы) + широкий список «слабых». Автор уже прогнал расширенный `gate:small --smokes` (128 direct/registered смоков, GREEN после починки fixture) — отдельное повторение всех 63 не делалось, см. «Чего не проверял» |
| ad-hoc репродукция найденного дефекта (см. «Находки») | сценарий через `demo/serve.mjs` `launch()` | подтвердил дефект, см. ниже |

Мутанты не гонялись (разработка, #709) — в реестре названы 4 новых
(`backup-import-ignores-writer`, `backup-import-replacement-retains-epoch`,
`backup-import-runtime-skips-ownership`, `backup-import-double-apply`),
каждый с патчем ровно на изменённую защитную строку и named guard-командой;
прочитаны и признаны корректно нацеленными (чтением, не исполнением).

## Находки

### Medium (в скоупе) — M1: новый guard в `_openSpaceDialog` ломает «Add space» на непустом плане, пока открыт обычный (не новый) backup-импорт из настроек

`src/houseplan-card.ts:9747`:

```ts
private _openSpaceDialog(mode: 'edit' | 'create', spaceId?: string): void {
    if (mode === 'create' && (this._backupImportIntent.loading || this._backupImportDialog)) return;
```

Это условие стоит безусловно в начале функции — оно не ограничено пустым
экраном. `_backupImportDialog` непусто не только для нового входа, но и для
**уже существующего** импорта через **Общие настройки** на обычном,
непустом плане (`_pickBackupImport` → `_importBackupFile` синхронно
выставляет `this.host._backupImportDialog = {...}` раньше любого `await`).
А `_openSpaceDialog('create', …)` — это не только кнопка пустого экрана:
это же и вкладка «+» добавления этажа на прогретом плане
(`data-hp="space-add"`, `houseplan-card.ts:10987`) и пункт «Add space» в
шапочном меню (`houseplan-card.ts:11020`). Ни одна из этих точек не
дизейблится визуально — клик просто ничего не делает.

Воспроизведено исполнением (не только чтением): на тёплом плане с
пространствами открыт `_openSettingsDialog()`, выбран JSON-файл через штатный
`.backupupload input[type=file]` (preview намеренно подвешен — имитирует
обычную сетевую задержку), затем клик по `[data-hp="space-add"]`:

```json
{
 "dialogOpenBeforeAddSpace": true,
 "spaceAddButtonExists": true,
 "spaceDialogOpenedAfterClick": false
}
```

`_spaceDialog` остаётся `null` — диалог добавления этажа не открывается,
без ошибки и без видимой причины пользователю.

**Почему это находка этой задачи, а не #844/#853:** строка-guard добавлена
именно этим диффом (в `origin/dev` её не было — `_openSpaceDialog` не знал о
backup-импорте вовсе). Это прямое нарушение ТЗ §K7: «Add space и импорт из
общих настроек на непустом плане работают как раньше» и §4 «Не входит: …
кнопка на непустом плане» — непустой план и штатный настроечный импорт этим
диффом трогать не планировалось, но в итоге их взаимодействие изменилось.

**Чем краснеет:** сценарий выше (settings-import открыт → добавление этажа
блокируется) — конкретный отрицательный случай, не абстрактный. Защитного
теста/мутанта на этот путь в реестре нет — пустая графа была бы находкой сама
по себе, но дефект серьёзнее пустой графы: сам guard неверно расширен.

**Предполагаемое исправление** (не мой выбор реализации, решает автор):
ограничить условие пустым экраном — например, `this._model.length === 0`
рядом с существующей проверкой, тем же способом, каким уже ограничен
`_canImportEmptyBackup`. Второе место с тем же условием
(`houseplan-card.ts:9754`, ветка `_ensureOnboardingRuntime().then(...)`)
фактически недостижимо на тёплом плане (`_spaceDialogUsesOnboardingRuntime`
верно только в онбординге), так что отдельного исправления не требует, но
стоит перепроверить вместе с основным guard.

## Что проверено и корректно

- **K1/AC1 (доступность).** `backupImportAllowed` — чистая функция от
  `connected/loaded/server/writer/kiosk`, не зависит от `_norm`/активного
  пространства; `_canImportEmptyBackup` дополнительно требует
  `!_hasFixedFloor && spaces.length === 0 && _model.length === 0`. Смок
  подтверждает отсутствие кнопки при `writer:false`, `admin:false+writer:false`,
  `kiosk`, `fixed`, `loading`, `unavailable`, и присутствие — для обычного
  разрешённого пользователя без admin. Отзыв прав во время открытого диалога
  (`lost rights`) и во время lazy-load чанка (`revokedDuringLazyNoUpload`)
  проверены исполнением через реальный `houseplan_config_updated`-пуш
  (`window.notifyImportConfig`), а не прямой мутацией состояния карты.
- **K2 (chooser/lazy-load).** Клик по кнопке синхронно вызывает `.click()`
  скрытого `<input type=file>` — chooser открывается в пределах user
  activation, без ожидания `import()`. `File` снимается синхронно
  (`input.files?.[0]`, `input.value=''`) до какого-либо `await`; raw `Event`
  никуда не сохраняется. Отказ ленивого чанка (`page.route(...).abort()`)
  показывает штатный toast и не ломает экран; повтор срабатывает.
- **K5 (owned epoch).** `BackupImportIntent` — instance-local, epoch
  инкрементируется в `begin()`/`cancel()`; `owns(epoch)` проверяется после
  каждого `await` в `_pickEmptyBackupImport`, `_importBackupFile`,
  `_setBackupDuplicatePolicy`, `_applyBackupImport` (включая промежуточные
  шаги после успешного `import/apply`, см. ниже). Поздние ответы отменённого
  preview/duplicate-policy/apply не подменяют новый открытый диалог —
  подтверждено исполнением (`cancelledPreviewCannotReplaceB`,
  `cancelledErrorCannotReplaceB`, `duplicateRevalidateCannotReplaceB`,
  `busyAndLateApply`). Disconnect во время зависшего preview не оставляет
  диалог (`disconnectedResponseIgnored`).
- **Два синхронных клика на Apply дают одну транзакцию** — проверено
  исполнением (`el.click(); el.click();` до перерисовки Lit) и зарегистрированным
  мутантом `backup-import-double-apply`.
- **Закрытие диалога во время уже отправленного Apply не теряет авторитетную
  конфигурацию для клиента.** Да, `_applyBackupImport` после успешного
  `import/apply` проверяет `owns(request)` и при потере владения не вызывает
  `_adoptAuthoritative` сам — но независимая подписка
  `houseplan_config_updated`/`houseplan_layout_updated`
  (`houseplan-card.ts:4413-4424`, уже существующий механизм
  multi-client-sync, не тронутый этой задачей) получает то же событие,
  которое бэкенд шлёт после `ws_import_apply` (`websocket_api.py:688-689`)
  независимо от того, какой UI его инициировал, и запускает
  `_reloadConfigOnly`. Проверено чтением, не отдельным смоком для этой
  конкретной гонки — существующий канал используется другими сценариями
  (`notifyImportConfig` в новом смоке) и не меняется этим диффом.
- **K7 (онбординг vs импорт, только применительно к пустому экрану).**
  `_onboardingShown = true` выставляется в начале `_pickEmptyBackupImport`,
  поэтому авто-онбординг не предлагается снова после отмены/ошибки импорта;
  `_openSpaceDialog('create', …)` в онбординг-ветке (`_spaceDialogUsesOnboardingRuntime`)
  недостижим одновременно с открытым backup-диалогом — открытие
  Add-space-формы на пустом экране при активном импорте действительно
  блокируется, как требует ТЗ (в отличие от M1, где та же защита
  неправомерно расширена на непустой план).
- **Focus-restore.** `BackupImportIntent.cancel(focus=true)` вызывает
  сохранённый колбэк ровно один раз (unit-тест `cancel must not restore focus
  twice`); колбэк передаётся только из `_pickEmptyBackupImport`, у
  settings-пути (`_importBackupFile(file)` без второго аргумента) колбэка нет
  — вызов `restore?.()` там безопасный no-op. После успешного Apply
  `cancel(false)` — фокус не переставляется, соответствует ТЗ §6 «не
  фокусировать удалённый empty-control».
- **i18n (AC6).** Все четыре словаря содержат `empty.import_backup` с
  текстом из ТЗ §8; unit и browser-smoke (4 локали × 2 темы × 360 CSS px)
  проверяют точный текст, `min-height ≥ 44px`, `scrollWidth ≤ clientWidth`
  на уровне страницы и диалога — отдельно проверено исполнением, расхождений
  нет.
- **Трейлеры и changelog.** Три коммита, у каждого `Issue: #875`; у
  `afbf679e` — `User-Visible: yes` и в том же коммите правки обоих
  `docs/CHANGELOG*.md`; у двух остальных (тест-фикстура, замер footprint) —
  `User-Visible: no`, оправдано содержимым (demo/test/scripts/docs, без
  изменения продуктового поведения).
- **Одно число — один источник (§8).** `LAZY_EDITOR_GZIP_CEILING = 256_149`
  в `scripts/bundle-budget.mjs` и заявленные в хендоффе 257 149 B
  gzip/потолок-1000 — совпадают; `hostRefs: 5141` в
  `scripts/monolith-baseline.json` и заявленное в комментариях — совпадают;
  `bundleBytes: 2809666` — совпадает с финальной сборкой из последнего
  хендоффа. Расхождений не найдено.
- **Release-ledger.** `docs/release-ledger/v1.80.1/875.json`: категория
  `stable-fix` с обоснованием «добавлен доступ к уже существующей в v1.80.1
  функции импорта, а не новая функция». Определение `stable-fix` в PROCESS.md
  явно включает «полировку» существующего поведения, не только багфикс;
  авторское суждение принято — это не крупная новая пользовательская
  возможность (сам импорт не меняется), а новая точка входа к ней.

## Чего не проверял

- Полный мутационный прогон (`mutation-gate`) — по правилам трека `ask`/
  процесса в разработке не гоняется; автор привёл `--check` static-readiness
  GREEN, этого достаточно для этапа ревью.
- Golden plan render — путь отрисовки плана/геометрия не менялись (новая
  кнопка — вне `.devlayer`/SVG), `ci:golden` не требовалась и не была
  проставлена конвейером; не перепроверял отдельно.
- Performance-капчер и HA pytest harness — не требуются по AC/ТЗ (backend не
  менялся), не прогонялись.
- Полные 63 «прямых совпадения» `smoke-select` построчно — не перепрогонял
  все; автор уже исполнил расширенный `gate:small -- --base=origin/dev
  --smokes` (128 direct/registered смоков) с зафиксированным результатом
  (126/128 → фикс fixture → GREEN). Из них адресно перепрогнаны 4 смока,
  максимально близких к изменённым символам
  (`smoke_empty_backup_import`, `smoke_post_write_adoption`,
  `smoke_backup_transfer`, `smoke_lazy_editor_chunk`); остальные 59 —
  унаследованы из авторского расширенного прогона, не переисполнялись.
- Реальный HA-бэкенд (atomic/CAS на реальном сервере) — задачей не
  менялся; синтетический транспорт смока подтверждает UI/owned-lifecycle,
  не серверную атомарность — как и честно указано автором.
- Touch/реальное устройство — не проверялось вручную; 360 CSS px в Chromium
  покрывает requirement по overflow/touch-target размеру из ТЗ, не более.

## Вердикт

Один дефект в скоупе (M1) — поведенческая регрессия на соседнем, явно
обещанном «без изменений» пути (`Add space` на непустом плане, пока открыт
штатный настроечный backup-импорт), вызванная неверно широким guard-условием
в этом же диффе. High нет. Решение — жёлтый вердикт, возврат автору; это не
новый issue (дефект находится в коде этой же задачи).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/875-empty-backup-import`, коммит `528f30c1725d` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0e84ed4521b6a30d06a07cb509327219ac15d3e5`
  ```
  git log --all --format='%H %T' | grep 0e84ed4521b6
  ```
- Тело issue: `05c4527700d2e56574ffda517eb387f6d66067b51ff590461d0de7673ff2b6c3`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ0MzEsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NTMxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxNDAsIm91dHB1dF90b2tlbnMiOjUzMDY5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE3ODgwMiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjk1MTU4MjMsImNvc3RVc2RFc3RpbWF0ZSI6My4xNDkzNDI1OTk5OTk5OTk4fV0sInR1cm5zIjo4MiwiZHVyYXRpb25NcyI6NzMyMTIzLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6My4xNTM4NzM1OTk5OTk5OTksImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4571 output_tokens=53089 cache_creation_input_tokens=178802 cache_read_input_tokens=9515823 num_turns=82 -->
