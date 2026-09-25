# CODE-REVIEW-626-r2

Issue: #626 · этап: code · заход: r2 · материал: `b80193f7268f4ae9a332857ea6100773f5fd0d88`
(рабочая копия уже на нём; `git rev-parse HEAD` = `b80193f7268f4ae9a332857ea6100773f5fd0d88`)
Ветка: `issue/626-acl-policy` · база: `origin/dev`
Validate на материале: success, `workflow_dispatch`,
https://github.com/Matysh/houseplan-card/actions/runs/36128068669
(`headSha` рана сверен командой — совпадает с материалом)

## Скоуп раунда

Единственная находка r1 (жёлтый вердикт, Medium в скоупе, High: 0):
потеря прямой HTTP-регрессии «non-admin + `admin_only=true` (умолчание) →
403» в `tests_backend/test_ha_upload.py` — старый тест `test_issue_617_
plan_upload_refuses_non_admin` был переименован и его `_setup` переведён
на `admin_only=False`, поэтому ветка по умолчанию осталась без своего
HTTP round-trip теста.

Дельта r1→r2 (`git diff 552504b834c7..HEAD`) — ровно три файла:

```
tests_backend/test_ha_upload.py     | 15 +++++++++++++++  (продукт теста)
docs/reviews/CODE-REVIEW-626-r1.md  | 239 ++++++++++++++++  (артефакт r1, не код)
docs/reviews/INDEX.md               |   3 +-                (сгенерирован пайплайном)
```

Дельта строго локальна: один новый тест в одном файле, ни `auth.py`, ни
`websocket_api.py`, ни документация, ни `mutation-registry.mjs` не
менялись между r1 и r2. Разбор по PROCESS.md §2.10 сужен до AC5
(единственный AC, которого касается правка); AC1–AC4, AC6, AC7 —
унаследованы без повторной проверки (раздел ниже).

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Medium: `tests_backend/test_ha_upload.py` — потерян HTTP round-trip регресс `admin_only=true` (умолчание) + non-admin → 403, план автотестов ТЗ требовал «расширить», а не заменить | Коммит `b80193f7` добавляет `test_issue_617_plan_upload_refuses_non_admin_by_default` — точная копия тела старого (удалённого переименованием) теста `test_issue_617_plan_upload_refuses_non_admin` с `origin/dev` (сверено `git show origin/dev:tests_backend/test_ha_upload.py` — идентичное тело: `_setup(hass)` без опций ⇒ `admin_only=true` по умолчанию, `hass_read_only_access_token` как представитель non-admin, `POST /plans/upload` → `403 unauthorized`, каталог планов не меняется) | `tests_backend/test_ha_upload.py:301-315`; тест `test_issue_626_plan_upload_refuses_read_only_but_allows_household` (`:316+`, `admin_only=false`) сохранён отдельно — оба сценария сосуществуют, один не подменяет другой |

Проверка «умеет ли тест падать» (защитный AC5-HTTP): guard стоит в
`http_api.py:390` (`if not may_write(hass, request.get("hass_user")): return
403`) внутри `HouseplanPlanUploadView.post` — тот самый эндпойнт, который
дергает тест (`/api/houseplan/plans/upload`). Убери этот `if` — ответ
станет `200`/`ok`, а не `403`, и оба ассерта (`resp.status == 403`,
`error == "unauthorized"`) покраснеют; третий ассерт (`_plans_listing`
до/после) ловит побочный эффект (файл всё же попал бы на диск).
Специального мутанта в `scripts/mutation-registry.mjs` на этот guard нет
(и не требовался в r1 — `http_api.py` этим диффом не тронут), но сам
тест исполнялся: job «Бэкенд: pytest в Home Assistant» на Validate
`b80193f7` — success, `headSha` совпадает с материалом. Дополнительно
это не новый тест «с нуля»: он воспроизводит код, который годами жил на
`dev` под этим же именем-предком — падение при поломке guard уже
исторически доказано тем же телом теста.

Находка закрыта полностью, без остатка. Второй Low-находки r1 (комментарий
в `auth.py:35-37`) касается не эта дельта — она была снята ревьюером r1
без возврата автору и не переоткрывается.

## Унаследовано из r1

Всё, кроме AC5-HTTP, принято без повторного чтения — код между
материалами r1 (`552504b834c7`) и r2 (`b80193f7`) не менялся:

| AC | Документ/материал r1 | SHA |
|---|---|---|
| AC1 (`may_write` матрица, fail-closed) | `docs/reviews/CODE-REVIEW-626-r1.md`, мутант `acl-readonly-group-becomes-writer` пойман | `552504b834c73484779720a356150aaee92afc28` |
| AC2 (6 команд × роли) | там же, `test_issue_626_authenticated_read_acl_matrix_and_trail_projection` | `552504b834c73484779720a356150aaee92afc28` |
| AC3 (`plans/list` unauthorized, без сканирования) | там же, мутант `acl-plan-catalog-open-to-viewers` пойман | `552504b834c73484779720a356150aaee92afc28` |
| AC4 (`trail/get` без `source`, storage не мутируется) | там же, мутант `acl-trail-view-exposes-source-entity` пойман | `552504b834c73484779720a356150aaee92afc28` |
| AC5-WS (`config/set` отклоняет read-only, пропускает household) | там же, `test_issue_626_authenticated_read_acl_matrix_and_trail_projection` | `552504b834c73484779720a356150aaee92afc28` |
| AC6 (документация непротиворечива) | там же, `check-docs.mjs` green на материале r1; диффом r1→r2 документы не тронуты | `552504b834c73484779720a356150aaee92afc28` |
| AC7 (регресс: `virtual_light/toggle`, `layout/get`, `assets/list`) | там же, существующие HA-harness тесты | `552504b834c73484779720a356150aaee92afc28` |

Также без повторной проверки принято: не-скоуп соблюдён (entity-level
фильтрация, ACL радаров, `virtual_light/toggle` — не тронуты ни r1, ни
r2); трейлеры `552504b8`/`e6987459` корректны (сверено в r1); Low-находка
про комментарий в `auth.py` снята в r1 и не переоткрывается.

## Как проверялось в r2

| Гейт | Статус | Источник |
|---|---|---|
| `npx tsc --noEmit` | не гонял | Validate green на материале (job «Фронтенд»); диффа по `src/**` нет ни в r1, ни в дельте r1→r2 |
| `npm test` | не гонял | то же |
| `npm run build` + сверка 3 копий бандла | не гонял | Validate green («Фронтенд: …синхрон бандла») |
| `node scripts/check-docs.mjs` | не гонял | job «Предполёт» green на материале; дельта r1→r2 документов не касается |
| `python -m pytest tests_backend -q` (реальный HA) | не гонял — `homeassistant` не установлен в этой среде | job «Бэкенд: pytest в Home Assistant» на `b80193f7` — success; проверил `headSha` рана командой `gh run view` — совпадает с `git rev-parse HEAD` |
| Мутанты по диффу (6 шардов) | не гонял — CI это уже сделал | все 6 шардов «Мутанты по диффу» на `b80193f7` — success |
| `node scripts/smoke-select.mjs` | не гонял повторно | дельта r1→r2 не касается `src/**`; вывод r1 («исполняемого frontend-диффа нет») остаётся в силе, дельта его не меняет |
| `golden:verify` | не применимо | нет видимого изменения рендера ни в r1, ни в дельте |
| Инварианты геометрии | не применимо | правка не касается геометрии |
| Performance-профили | не применимо | в AC не названы |

Помимо CI: прочитан весь дифф `552504b834c7..HEAD` (три файла, см. выше),
сверено тело нового теста с телом его предка на `origin/dev` посимвольно,
прочитан guard `http_api.py:372-398` (`HouseplanPlanUploadView.post`),
подтверждено расположение `may_write()`-проверки на `http_api.py:390` до
любой записи на диск.

## Находки

Ни одной новой High/Medium/Low находки в дельте r1→r2. Единственная
находка r1 закрыта полностью (раздел «Закрытие раунда r1» выше).

## Что проверено и корректно

- Восстановленный тест `test_issue_617_plan_upload_refuses_non_admin_by_
  default` — точное воспроизведение исторически существовавшего теста;
  покрывает именно ту ветку (`admin_only=true` по умолчанию), которую
  потеряла правка r1.
- Оба HTTP-сценария (`admin_only=true` non-admin → 403,
  `admin_only=false` read-only → 403 / household → 200) теперь
  сосуществуют как отдельные тесты — ни один не подменяет другой; план
  автотестов ТЗ («расширить существующий тест… либо добавить отдельный»)
  выполнен вариантом «добавить отдельный».
- Коммит `b80193f7`: трейлеры `Issue: #626`, `User-Visible: no` —
  верно, правка тестовая, продуктовое поведение не меняется, оба
  changelog не требуются.
- `docs/reviews/INDEX.md` — правка сгенерирована пайплайном
  (`node scripts/reviews-index.mjs`) вместе с публикацией документа r1,
  не ручная правка автора.
- Не-скоуп по-прежнему соблюдён: дифф r1→r2 не касается ни одного файла
  вне `tests_backend/test_ha_upload.py`.

## Чего не проверял

- Не выполнял `tsc`/`npm test`/`npm run build`/`pytest tests_backend`
  вручную — только чтением и по зелёному Validate на точном SHA
  материала (`headSha` рана сверен с `git rev-parse HEAD`).
- Не устанавливал `homeassistant` в этой среде — полагаюсь на
  canonical Linux CI backend job, зелёный на этом самом SHA.
- Не прогонял browser-smokes и golden — дельта r1→r2 не трогает
  `src/**`, вывод `smoke-select.mjs` из r1 (пусто) остаётся в силе.
- Не проверял поведение при реальном HA-инстансе за пределами
  backend-job CI — тот же остаточный риск, что и в r1, принят ТЗ.
- Не проверял производительность — не заявлена в AC, дельта тестовая.

## Вердикт

Единственная Medium-находка r1 закрыта восстановленным тестом,
воспроизводящим тело своего исторического предка; новых находок в
дельте r1→r2 нет. Все семь AC подтверждены (AC1–AC4, AC6, AC7 —
унаследованы от r1 без изменений в коде; AC5 — переподтверждён целиком,
включая ранее ослабленную HTTP-ветку). Изменение решает заявленный
сценарий (`docs/SCOPE.md` J2/J6: read-only остаётся зрителем,
администратор не теряет доступ) и не ухудшает ни один смежный core user
job.

---

<!-- material-anchors: заполняется конвейером (#414) -->

## Материал раунда

- Ветка: `issue/626-acl-policy`, коммит `b80193f7268f4ae9a332857ea6100773f5fd0d88`.
- Вердикт: green

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/626-acl-policy`, коммит `b80193f7268f` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `338932c37fe9f6fbed43aa4db18abbbbc91fb515`
  ```
  git log --all --format='%H %T' | grep 338932c37fe9
  ```
- Тело issue: `83f287ba63d6a04d1ffa6f1205382587c2342cbc04bfaebcde04219d841fa564`
- Вердикт конвейера: `green` · High 0
